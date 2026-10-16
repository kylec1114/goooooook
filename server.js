const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const cookieSession = require('cookie-session');

const PORT = process.env.PORT || 3000;
const EXCEL_PATH = path.join(__dirname, 'data', 'goooooook.xlsx');
const LYRICS_DIR = path.join(__dirname, 'data', 'lyrics');
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-to-a-long-random-string';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieSession({
  name: 'goooooook_session',
  keys: [SESSION_SECRET],
  maxAge: 12 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'strict'
}));

const queues = new Map();
const roomTokens = new Map();

function readWorkbook() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error('找不到 data/goooooook.xlsx。請先執行：npm run setup');
  }
  return XLSX.readFile(EXCEL_PATH);
}

function sheetToObjects(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function ensureSheet(wb, name, headers) {
  if (!wb.Sheets[name]) {
    wb.SheetNames.push(name);
    wb.Sheets[name] = XLSX.utils.aoa_to_sheet([headers]);
  }
}

function getRoom(roomCode) {
  const wb = readWorkbook();
  const rooms = sheetToObjects(wb, 'Rooms');
  return rooms.find(r =>
    String(r.room_code).trim().toUpperCase() === roomCode.trim().toUpperCase() &&
    String(r.active).toUpperCase() === 'TRUE'
  );
}

function getSongs() {
  const wb = readWorkbook();
  return sheetToObjects(wb, 'Songs').map(song => ({
    song_id: song.song_id,
    title: song.title,
    artist: song.artist,
    youtube_url: song.youtube_url,
    category: song.category,
    language: song.language,
    lrc_file: song.lrc_file
  }));
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (getRoom(code));
  return code;
}

function issueRoomToken(roomCode) {
  const token = crypto.randomBytes(24).toString('hex');
  roomTokens.set(roomCode, { token, issuedAt: Date.now() });
  return token;
}

function isValidRoomToken(roomCode, token) {
  const entry = roomTokens.get(roomCode);
  if (!entry) return false;
  if (Date.now() - entry.issuedAt > 12 * 60 * 60 * 1000) {
    roomTokens.delete(roomCode);
    return false;
  }
  return entry.token === token;
}

function appendQueueLog(roomCode, singer, song) {
  const wb = readWorkbook();
  ensureSheet(wb, 'QueueLog', ['timestamp', 'room_code', 'singer', 'title', 'youtube_url']);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.QueueLog, { header: 1 });
  rows.push([new Date().toISOString(), roomCode, singer || 'Guest', song.title, song.youtube_url]);
  wb.Sheets.QueueLog = XLSX.utils.aoa_to_sheet(rows);
  XLSX.writeFile(wb, EXCEL_PATH);
}

function parseLrc(content) {
  const lines = [];
  for (const raw of content.split(/\r?\n/)) {
    const matches = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!matches.length || !text) continue;
    for (const m of matches) {
      const minutes = parseInt(m[1], 10);
      const seconds = parseInt(m[2], 10);
      const fraction = m[3] ? parseFloat('0.' + m[3]) : 0;
      lines.push({ time: minutes * 60 + seconds + fraction, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function requireRoom(req, res, next) {
  const roomCode = req.session && req.session.roomCode;
  if (!roomCode || !getRoom(roomCode)) {
    return res.status(401).json({ error: '請先登入房間' });
  }
  req.roomCode = roomCode;
  next();
}

app.post('/api/rooms', (req, res) => {
  const { password, roomName } = req.body || {};
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: '密碼至少需要 6 個字元' });
  }
  const wb = readWorkbook();
  ensureSheet(wb, 'Rooms', ['room_code', 'password_hash', 'room_name', 'active']);
  const code = randomRoomCode();
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Rooms, { header: 1 });
  rows.push([code, bcrypt.hashSync(String(password), 12), roomName || 'Home KTV', 'TRUE']);
  wb.Sheets.Rooms = XLSX.utils.aoa_to_sheet(rows);
  XLSX.writeFile(wb, EXCEL_PATH);
  const token = issueRoomToken(code);
  res.json({ ok: true, roomCode: code, roomToken: token });
});

app.post('/api/login', (req, res) => {
  const { roomCode, password } = req.body || {};
  if (!roomCode || !password) return res.status(400).json({ error: '請輸入房間碼同密碼' });
  const room = getRoom(roomCode);
  if (!room || !room.password_hash) return res.status(401).json({ error: '房間碼或密碼錯誤' });
  const ok = bcrypt.compareSync(password, String(room.password_hash));
  if (!ok) return res.status(401).json({ error: '房間碼或密碼錯誤' });
  const code = String(room.room_code).trim().toUpperCase();
  req.session.roomCode = code;
  const token = issueRoomToken(code);
  res.json({ ok: true, roomCode: code, roomToken: token, roomName: room.room_name || code });
});

app.post('/api/logout', (req, res) => {
  const roomCode = req.session && req.session.roomCode;
  if (roomCode) roomTokens.delete(roomCode);
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/songs', requireRoom, (req, res) => {
  res.json({ roomCode: req.roomCode, songs: getSongs() });
});

app.get('/api/queue', requireRoom, (req, res) => {
  res.json({ queue: queues.get(req.roomCode) || [] });
});

app.post('/api/queue', requireRoom, (req, res) => {
  const { youtubeUrl, singer, title } = req.body || {};
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) return res.status(400).json({ error: '請貼上有效 YouTube 連結' });

  const queue = queues.get(req.roomCode) || [];
  if (queue.some(song => song.videoId === videoId)) {
    return res.status(409).json({ error: '呢首歌已經喺隊列入面' });
  }

  const song = {
    videoId,
    youtubeUrl,
    title: title || 'YouTube 歌曲',
    singer: singer || 'Guest',
    addedAt: Date.now()
  };
  queue.push(song);
  queues.set(req.roomCode, queue);
  appendQueueLog(req.roomCode, song.singer, song);
  io.to(req.roomCode).emit('queueUpdated', queue);
  res.json({ ok: true, queue });
});

app.get('/api/lyrics/:videoId', requireRoom, (req, res) => {
  const songs = getSongs();
  const song = songs.find(s => String(s.youtube_url).includes(req.params.videoId));
  if (!song || !song.lrc_file) return res.json({ title: '', lyrics: [] });

  const lrcPath = path.join(LYRICS_DIR, String(song.lrc_file));
  if (!fs.existsSync(lrcPath)) return res.json({ title: song.title, lyrics: [] });

  const content = fs.readFileSync(lrcPath, 'utf8');
  res.json({ title: song.title, lyrics: parseLrc(content) });
});

io.use((socket, next) => {
  const { roomCode, roomToken } = socket.handshake.auth || {};
  if (!roomCode || !roomToken || !isValidRoomToken(roomCode, roomToken)) {
    return next(new Error('房間驗證失敗'));
  }
  socket.roomCode = roomCode;
  next();
});

io.on('connection', socket => {
  const roomCode = socket.roomCode;
  socket.join(roomCode);
  socket.emit('queueUpdated', queues.get(roomCode) || []);

  function advance() {
    const queue = queues.get(roomCode) || [];
    queue.shift();
    queues.set(roomCode, queue);
    io.to(roomCode).emit('queueUpdated', queue);
  }

  socket.on('nextSong', () => advance());
  socket.on('skipSong', () => advance());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`goooooook 已啟動：http://localhost:${PORT}`);
  console.log(`手機請用同一 Wi-Fi 開：http://<host 機 LAN IP>:${PORT}`);
  console.log('Excel、歌詞與密碼資料只存在於這部 host 機。');
});
