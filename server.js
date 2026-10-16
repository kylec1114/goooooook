const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const cookieSession = require('cookie-session');
const DATA = path.resolve(process.env.GOOOOOOOK_DATA_DIR || path.join(__dirname, 'data'));
const BOOK = path.join(DATA, 'goooooook.xlsx');
const LYRICS = path.join(DATA, 'lyrics');
const STATE = path.join(DATA, 'state');
fs.mkdirSync(LYRICS, { recursive: true });
fs.mkdirSync(STATE, { recursive: true });
const secretFile = path.join(DATA, '.session-secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { mode: 0o600, flag: 'wx' });
const secret = process.env.SESSION_SECRET || fs.readFileSync(secretFile, 'utf8').trim();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 16384 });
const sessions = new Map();
const queues = new Map();
const leaders = new Map();
const attempts = new Map();
const TTL = 12 * 60 * 60 * 1000;
const key = token => crypto.createHash('sha256').update(token).digest('hex');
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function rows(wb, name) { return wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }) : []; }
function book() { return XLSX.readFile(BOOK); }
function save(wb) { const tmp = BOOK + '.tmp.xlsx'; XLSX.writeFile(wb, tmp); fs.renameSync(tmp, BOOK); }
if (!fs.existsSync(BOOK)) {
  const wb = XLSX.utils.book_new();
  for (const [name, headers] of Object.entries({ Rooms: ['room_code','password_hash','room_name','active'], Songs: ['song_id','title','artist','youtube_url','category','language','lrc_file'], QueueLog: ['timestamp','room_code','singer','title','youtube_url'] })) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers]), name);
  save(wb);
}
function room(code) { return rows(book(), 'Rooms').find(r => String(r.room_code).trim().toUpperCase() === code && String(r.active).toUpperCase() === 'TRUE'); }
function videoId(value) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port) return null;
    let id;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname)) id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/.exec(u.pathname)?.[1];
    return typeof id === 'string' && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
function queueFile(code) { return path.join(STATE, code + '.json'); }
function getQueue(code) {
  if (queues.has(code)) return queues.get(code);
  let value = [];
  try {
    const file = queueFile(code);
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed)) value = parsed.filter(s => s && typeof s.id === 'string' && typeof s.videoId === 'string' && /^[\w-]{11}$/.test(s.videoId)).slice(0, 200);
    }
  } catch (error) { console.error('Queue state ignored:', error.message); }
  queues.set(code, value);
  return value;
}
function setQueue(code, value) {
  const safe = Array.isArray(value) ? value.slice(0, 200) : [];
  queues.set(code, safe);
  const file = queueFile(code);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(safe), { mode: 0o600 });
  fs.renameSync(tmp, file);
  return safe;
}
for (const file of fs.readdirSync(STATE)) if (file.endsWith('.json')) getQueue(file.slice(0, -5));
function issue(code, role, parent = null) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(key(token), { roomCode: code, role, parent, expires: Date.now() + TTL });
  return token;
}
function valid(hash) {
  const s = sessions.get(hash);
  if (!s || s.expires <= Date.now()) return null;
  if (s.parent) { const parent = sessions.get(s.parent); if (!parent || parent.expires <= Date.now()) return null; }
  return room(s.roomCode) ? s : null;
}
function revoke(hash) {
  sessions.delete(hash);
  for (const [h, s] of sessions) if (s.parent === hash) sessions.delete(h);
  for (const socket of io.sockets.sockets.values()) if (!valid(socket.data.hash)) socket.disconnect(true);
}
app.use(express.json({ limit: '16kb' }));
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: '不允許跨網站操作' }); }
    catch { return res.status(403).json({ error: '無效來源' }); }
  }
  next();
});
app.use(cookieSession({ name: 'goooooook_session', keys: [secret], httpOnly: true, sameSite: 'strict', maxAge: TTL, secure: process.env.COOKIE_SECURE === 'true' }));
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny' }));
function auth(req, res, next) {
  const header = req.get('authorization');
  const hash = header ? (/^Bearer ([a-f0-9]{64})$/.test(header) ? key(header.slice(7)) : null) : req.session?.credential;
  const s = hash && valid(hash);
  if (!s) return res.status(401).json({ error: '登入已失效，請重新登入' });
  req.credential = hash; req.identity = s; next();
}
function controller(req, res, next) { if (req.identity.role !== 'controller') return res.status(403).json({ error: '只有遙控端可以操作' }); next(); }
function throttle(req, res, next) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now(); let a = attempts.get(ip);
  if (!a || a.until <= now) { a = { count: 0, until: now + 60000 }; attempts.set(ip, a); }
  if (++a.count > 12) return res.status(429).json({ error: '操作太頻密，請稍後再試' });
  next();
}
function password(value) { if (typeof value !== 'string' || value.length < 6 || Buffer.byteLength(value) > 72) fail('密碼需至少6字元，最多72 UTF-8 bytes'); return value; }
function loginResponse(req, res, code) { const token = issue(code, 'controller'); req.session = { credential: key(token) }; res.json({ ok: true, roomCode: code, roomToken: token }); }
app.post('/api/rooms', throttle, (req, res) => {
  const p = password(req.body.password); const wb = book(); let code;
  do { code = Array.from({ length: 7 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(31)]).join(''); } while (room(code));
  const all = rows(wb, 'Rooms'); all.push({ room_code: code, password_hash: bcrypt.hashSync(p, 12), room_name: String(req.body.roomName || 'Home KTV').slice(0,80), active: true });
  wb.Sheets.Rooms = XLSX.utils.json_to_sheet(all); save(wb); loginResponse(req, res, code);
});
app.post('/api/login', throttle, (req, res) => {
  const code = typeof req.body.roomCode === 'string' ? req.body.roomCode.trim().toUpperCase() : '';
  const p = password(req.body.password); const r = /^[A-Z0-9]{7}$/.test(code) ? room(code) : null;
  if (!r || !bcrypt.compareSync(p, String(r.password_hash))) fail('房間碼或密碼錯誤', 401);
  loginResponse(req, res, code);
});
app.post('/api/logout', auth, (req, res) => { revoke(req.credential); req.session = null; res.json({ ok: true }); });
app.post('/api/player', auth, controller, throttle, (req, res) => { res.json({ roomCode: req.identity.roomCode, roomToken: issue(req.identity.roomCode, 'player', req.credential) }); });
app.get('/api/songs', auth, (req, res) => { res.json({ songs: rows(book(), 'Songs').map(s => ({ song_id: s.song_id, title: s.title, artist: s.artist, youtube_url: s.youtube_url, category: s.category, language: s.language })) }); });
app.get('/api/queue', auth, (req, res) => res.json({ queue: getQueue(req.identity.roomCode) }));
app.post('/api/queue', auth, controller, (req, res) => {
  const id = videoId(req.body.youtubeUrl); if (!id) fail('無效 YouTube 網址');
  const code = req.identity.roomCode; const q = getQueue(code);
  if (q.length >= 200) fail('隊列已滿', 409);
  if (q.some(s => s.videoId === id)) fail('呢首歌已經喺隊列', 409);
  const song = { id: crypto.randomUUID(), videoId: id, youtubeUrl: 'https://www.youtube.com/watch?v=' + id, title: String(req.body.title || 'YouTube 歌曲').slice(0,200), singer: String(req.body.singer || 'Guest').slice(0,80) };
  const wb = book(); const log = rows(wb, 'QueueLog'); log.push({ timestamp: new Date().toISOString(), room_code: code, singer: song.singer, title: song.title, youtube_url: song.youtubeUrl }); wb.Sheets.QueueLog = XLSX.utils.json_to_sheet(log); save(wb);
  const saved = setQueue(code, [...q, song]); io.to(code).emit('queueUpdated', saved); res.json({ queue: saved });
});
app.get('/api/lyrics/:id', auth, (req, res) => {
  if (!/^[\w-]{11}$/.test(req.params.id)) fail('無效影片ID');
  const s = rows(book(), 'Songs').find(s => videoId(String(s.youtube_url)) === req.params.id);
  if (!s?.lrc_file) return res.json({ lyrics: [] });
  const root = fs.realpathSync(LYRICS); const candidate = path.resolve(root, String(s.lrc_file));
  function inside(file) { const rel = path.relative(root, file); return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); }
  if (!inside(candidate) || path.extname(candidate).toLowerCase() !== '.lrc') fail('無效歌詞檔');
  if (!fs.existsSync(candidate)) return res.json({ lyrics: [] });
  const real = fs.realpathSync(candidate); if (!inside(real) || !fs.statSync(real).isFile() || fs.statSync(real).size > 1048576) fail('無效歌詞檔');
  const lyrics = [];
  for (const line of fs.readFileSync(real, 'utf8').split(/\r?\n/)) for (const m of line.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)) {
    if (+m[2] >= 60) continue;
    lyrics.push({ time: +m[1] * 60 + +m[2] + (m[3] ? Number('0.' + m[3]) : 0), text: line.replace(/\[[^\]]*\]/g, '').trim() });
  }
  res.json({ lyrics: lyrics.sort((a,b) => a.time - b.time) });
});
io.use((socket, next) => {
  try { const a = socket.handshake.auth || {}; if (typeof a.roomToken !== 'string' || !/^[a-f0-9]{64}$/.test(a.roomToken)) throw Error('驗證失敗'); const hash = key(a.roomToken); const s = valid(hash); if (!s || s.roomCode !== a.roomCode) throw Error('驗證失敗'); socket.data.hash = hash; socket.data.room = s.roomCode; next(); } catch { next(new Error('登入已失效')); }
});
io.on('connection', socket => {
  const code = socket.data.room; socket.join(code);
  socket.use((packet, next) => { try { if (!valid(socket.data.hash)) { socket.disconnect(true); return next(new Error('登入已失效')); } next(); } catch { socket.disconnect(true); } });
  const s = valid(socket.data.hash);
  if (s?.role === 'player' && !leaders.has(code)) leaders.set(code, socket.id);
  socket.emit('queueUpdated', getQueue(code));
  socket.on('claimPlayer', (_, ack) => { const s = valid(socket.data.hash); if (s?.role === 'player' && !leaders.has(code)) leaders.set(code, socket.id); if (typeof ack === 'function') ack({ leader: leaders.get(code) === socket.id }); });
  function advance(data, ack) {
    const s = valid(socket.data.hash); const q = getQueue(code);
    if (s?.role !== 'player' || leaders.get(code) !== socket.id || !data || typeof data.currentItemId !== 'string' || q[0]?.id !== data.currentItemId) { if (typeof ack === 'function') ack({ ok: false }); return; }
    const saved = setQueue(code, q.slice(1)); io.to(code).emit('queueUpdated', saved); if (typeof ack === 'function') ack({ ok: true });
  }
  socket.on('nextSong', advance); socket.on('skipSong', advance);
  socket.on('disconnect', () => { if (leaders.get(code) === socket.id) leaders.delete(code); });
});
const cleanup = setInterval(() => {
  for (const [hash, s] of sessions) if (s.expires <= Date.now()) sessions.delete(hash);
  for (const [ip,a] of attempts) if (a.until <= Date.now()) attempts.delete(ip);
  for (const socket of io.sockets.sockets.values()) { try { if (!valid(socket.data.hash)) socket.disconnect(true); } catch { socket.disconnect(true); } }
}, 30000);
cleanup.unref();
app.use((err, req, res, next) => { console.error(err.message); res.status(err.status || 500).json({ error: err.status ? err.message : '讀寫失敗，請關閉正在編輯的 Excel 或檢查 host 記錄' }); });
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log('goooooook host ready; room queues persist in data/state'));
