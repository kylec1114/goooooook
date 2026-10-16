export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  }
};

const encoder = new TextEncoder();
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function fail(message, status = 400) { return json({ error: message }, status); }
function id() { return crypto.randomUUID(); }
function now() { return Date.now(); }

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
async function hashToken(token) {
  const bits = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function videoId(value) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port) return null;
    let id;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(u.hostname)) id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/.exec(u.pathname)?.[1];
    return typeof id === 'string' && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

async function session(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = /^Bearer ([a-f0-9]{64})$/.test(header) ? header.slice(7) : '';
  if (!token) return null;
  const hash = await hashToken(token);
  const row = await env.DB.prepare('SELECT s.*, r.room_code FROM sessions s JOIN rooms r ON r.room_code = s.room_code WHERE s.token_hash = ? AND s.expires_at > ?').bind(hash, now()).first();
  return row || null;
}
async function requireSession(request, env, role) {
  const s = await session(request, env);
  if (!s) return { error: fail('登入已失效，請重新登入', 401) };
  if (role && s.role !== role) return { error: fail('權限不足', 403) };
  return { session: s };
}
async function createSession(env, roomCode, role) {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await hashToken(token);
  const expires = now() + 12 * 60 * 60 * 1000;
  await env.DB.prepare('INSERT INTO sessions (token_hash, room_code, role, expires_at) VALUES (?, ?, ?, ?)').bind(hash, roomCode, role, expires).run();
  return token;
}

async function handleApi(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const path = url.pathname;
  try {
    if (path === '/api/rooms' && request.method === 'POST') {
      const body = await request.json();
      const password = String(body.password || '');
      if (password.length < 6 || password.length > 72) return fail('密碼需至少6字元，最多72字元');
      let code;
      do { code = Array.from({ length: 7 }, () => ROOM_CHARS[crypto.getRandomValues(new Uint32Array(1))[0] % ROOM_CHARS.length]).join(''); } while (await env.DB.prepare('SELECT 1 FROM rooms WHERE room_code = ?').bind(code).first());
      const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
      const passwordHash = await hashPassword(password, salt);
      await env.DB.prepare('INSERT INTO rooms (room_code, room_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').bind(code, String(body.roomName || 'Home KTV').slice(0, 80), passwordHash, salt, new Date().toISOString()).run();
      return json({ ok: true, roomCode: code, roomToken: await createSession(env, code, 'controller') });
    }
    if (path === '/api/login' && request.method === 'POST') {
      const body = await request.json();
      const code = String(body.roomCode || '').trim().toUpperCase();
      const password = String(body.password || '');
      const room = /^[A-Z0-9]{7}$/.test(code) ? await env.DB.prepare('SELECT * FROM rooms WHERE room_code = ?').bind(code).first() : null;
      if (!room) return fail('房間碼或密碼錯誤', 401);
      const hash = await hashPassword(password, room.salt);
      if (hash !== room.password_hash) return fail('房間碼或密碼錯誤', 401);
      return json({ ok: true, roomCode: code, roomToken: await createSession(env, code, 'controller') });
    }
    if (path === '/api/player' && request.method === 'POST') {
      const auth = await requireSession(request, env, 'controller');
      if (auth.error) return auth.error;
      return json({ roomCode: auth.session.room_code, roomToken: await createSession(env, auth.session.room_code, 'player') });
    }
    if (path === '/api/songs' && request.method === 'GET') {
      const auth = await requireSession(request, env);
      if (auth.error) return auth.error;
      const { results } = await env.DB.prepare('SELECT id, title, artist, category, language, youtube_url FROM songs WHERE room_code = ? ORDER BY created_at DESC').bind(auth.session.room_code).all();
      return json({ songs: results });
    }
    if (path === '/api/songs' && request.method === 'POST') {
      const auth = await requireSession(request, env, 'controller');
      if (auth.error) return auth.error;
      const body = await request.json();
      const videoIdValue = videoId(String(body.youtubeUrl || ''));
      if (!videoIdValue) return fail('無效 YouTube 網址');
      const youtubeUrl = 'https://www.youtube.com/watch?v=' + videoIdValue;
      await env.DB.prepare('INSERT INTO songs (id, room_code, title, artist, category, language, youtube_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id(), auth.session.room_code, String(body.title || 'YouTube 歌曲').slice(0, 200), String(body.artist || '').slice(0, 120), String(body.category || '').slice(0, 80), String(body.language || '').slice(0, 40), youtubeUrl, new Date().toISOString()).run();
      return json({ ok: true });
    }
    if (path.startsWith('/api/songs/') && request.method === 'DELETE') {
      const auth = await requireSession(request, env, 'controller');
      if (auth.error) return auth.error;
      await env.DB.prepare('DELETE FROM songs WHERE id = ? AND room_code = ?').bind(path.split('/')[3], auth.session.room_code).run();
      return json({ ok: true });
    }
    if (path === '/api/queue' && request.method === 'GET') {
      const auth = await requireSession(request, env);
      if (auth.error) return auth.error;
      const { results } = await env.DB.prepare('SELECT id, video_id AS videoId, youtube_url AS youtubeUrl, title, singer FROM queue WHERE room_code = ? ORDER BY position, created_at').bind(auth.session.room_code).all();
      return json({ queue: results });
    }
    if (path === '/api/queue' && request.method === 'POST') {
      const auth = await requireSession(request, env, 'controller');
      if (auth.error) return auth.error;
      const body = await request.json();
      const videoIdValue = videoId(String(body.youtubeUrl || ''));
      if (!videoIdValue) return fail('無效 YouTube 網址');
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM queue WHERE room_code = ?').bind(auth.session.room_code).first();
      if (count.n >= 200) return fail('隊列已滿', 409);
      const exists = await env.DB.prepare('SELECT 1 FROM queue WHERE room_code = ? AND video_id = ?').bind(auth.session.room_code, videoIdValue).first();
      if (exists) return fail('呢首歌已經喺隊列', 409);
      const max = await env.DB.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM queue WHERE room_code = ?').bind(auth.session.room_code).first();
      await env.DB.prepare('INSERT INTO queue (id, room_code, video_id, youtube_url, title, singer, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id(), auth.session.room_code, videoIdValue, 'https://www.youtube.com/watch?v=' + videoIdValue, String(body.title || 'YouTube 歌曲').slice(0, 200), String(body.singer || 'Guest').slice(0, 80), max.p + 1, new Date().toISOString()).run();
      const { results } = await env.DB.prepare('SELECT id, video_id AS videoId, youtube_url AS youtubeUrl, title, singer FROM queue WHERE room_code = ? ORDER BY position, created_at').bind(auth.session.room_code).all();
      return json({ queue: results });
    }
    if (path.startsWith('/api/queue/') && request.method === 'DELETE') {
      const auth = await requireSession(request, env, 'controller');
      if (auth.error) return auth.error;
      await env.DB.prepare('DELETE FROM queue WHERE id = ? AND room_code = ?').bind(path.split('/')[3], auth.session.room_code).run();
      const { results } = await env.DB.prepare('SELECT id, video_id AS videoId, youtube_url AS youtubeUrl, title, singer FROM queue WHERE room_code = ? ORDER BY position, created_at').bind(auth.session.room_code).all();
      return json({ queue: results });
    }
    if (path === '/api/queue/next' && request.method === 'POST') {
      const auth = await requireSession(request, env, 'player');
      if (auth.error) return auth.error;
      const body = await request.json();
      const first = await env.DB.prepare('SELECT id FROM queue WHERE room_code = ? ORDER BY position, created_at LIMIT 1').bind(auth.session.room_code).first();
      if (first && first.id === body.currentItemId) await env.DB.prepare('DELETE FROM queue WHERE id = ?').bind(first.id).run();
      const { results } = await env.DB.prepare('SELECT id, video_id AS videoId, youtube_url AS youtubeUrl, title, singer FROM queue WHERE room_code = ? ORDER BY position, created_at').bind(auth.session.room_code).all();
      return json({ queue: results });
    }
    if (path.startsWith('/api/lyrics/')) return json({ lyrics: [] });
    return fail('找不到 API', 404);
  } catch (error) {
    return fail(error.message || '伺服器錯誤', 500);
  }
}
