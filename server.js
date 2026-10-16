const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const cookieSession = require('cookie-session');

const PORT = process.env.PORT || 3000;
const EXCEL_PATH = path.join(__dirname, 'data', 'goooooook.xlsx');
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

function readWorkbook() {
  return XLSX.readFile(EXCEL_PATH);
}

function sheetToObjects(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
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
    language: song.language
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

function appendQueueLog(roomCode, singer, song) {
  const wb = readWorkbook();
  const sheetName = 'QueueLog';
  if (!wb.Sheets[sheetName]) {
    wb.SheetNames.push(sheetName);
    wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([
      ['timestamp', 'room_code', 'singer', 'title', 'youtube_url']
    ]);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  rows.push([new Date().toISOString(), roomCode, singer || 'Guest', song.title, song.youtube_url]);
  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
  XLSX.writeFile(wb, EXCEL_PATH);
}

function requireRoom(req, res, next) {
  const roomCode = req.session && req.session.roomCode;
  if (!roomCode || !getRoom(roomCode)) {
    return res.status(401).json({ error: '請先登入房間' });
  }
  req.roomCode = roomCode;
  next();
}

app.post('/api/login', (req, res) => {
  const { roomCode, password } = req.body || {};
  if (!roomCode || !password) return res.status(400).json({ error: '請輸入房間碼同密碼' });
  const room = getRoom(roomCode);
  if (!room || !room.password_hash) return res.status(401).json({ error: '房間碼或密碼錯誤' });
  const ok = bcrypt.compareSync(password, String(room.password_hash));
  if (!ok) return res.status(401).json({ error: '房間碼或密碼錯誤' });
  req.session.roomCode = String(room.room_code).trim().toUpperCase();
  res.json({ ok: true, roomName: room.room_name || req.session.roomCode });
});

app.post('/api/logout', (req, res) => {
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
  const song = { videoId, youtubeUrl, title: title || 'YouTube 歌曲', singer: singer || 'Guest', addedAt: Date.now() };
  const queue = queues.get(req.roomCode) || [];
  queue.push(song);
  queues.set(req.roomCode, queue);
  appendQueueLog(req.roomCode, song.singer, song);
  io.to(req.roomCode).emit('queueUpdated', queue);
  res.json({ ok: true, queue });
});

io.on('connection', socket => {
  socket.on('joinRoom', roomCode => {
    if (!getRoom(roomCode)) return;
    socket.join(roomCode);
    socket.emit('queueUpdated', queues.get(roomCode) || []);
  });
  socket.on('nextSong', ({ roomCode }) => {
    const queue = queues.get(roomCode) || [];
    queue.shift();
    queues.set(roomCode, queue);
    io.to(roomCode).emit('queueUpdated', queue);
  });
  socket.on('skipSong', ({ roomCode }) => {
    const queue = queues.get(roomCode) || [];
    queue.shift();
    queues.set(roomCode, queue);
    io.to(roomCode).emit('queueUpdated', queue);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`goooooook 已啟動：http://localhost:${PORT}`);
  console.log(`手機請用同一 Wi-Fi 開：http://<你部電腦 LAN IP>:${PORT}`);
});
