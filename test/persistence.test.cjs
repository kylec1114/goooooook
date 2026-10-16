const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const pause = ms => new Promise(r => setTimeout(r, ms));
async function start(dir, port) {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], { cwd: ROOT, env: { ...process.env, GOOOOOOOK_DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore','pipe','pipe'] });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  for (let i = 0; i < 150 && !output.includes('host ready'); i++) { if (child.exitCode !== null) throw Error(output); await pause(100); }
  if (!output.includes('host ready')) throw Error('host did not start: ' + output);
  return child;
}
async function stop(child) {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(r => child.once('exit', r));
    child.kill('SIGTERM');
    await Promise.race([exited, pause(3000)]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await Promise.race([exited, pause(1000)]); }
  }
}
async function request(base, route, body, token) {
  const r = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}
test('room queue survives host restart', { timeout: 90000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goooooook-persist-'));
  const port = 32190;
  const base = 'http://127.0.0.1:' + port;
  const first = await start(dir, port);
  try {
    const created = await request(base, '/api/rooms', { password: 'Persist-test-123!', roomName: 'Persistence CI' });
    assert.equal(created.status, 200);
    const credential = created.data;
    const url = 'https://youtu.be/dQw4w9WgXc';
    const added = await request(base, '/api/queue', { youtubeUrl: url, title: 'Persistent song', singer: 'CI' }, credential.roomToken);
    assert.equal(added.status, 200);
    assert.equal(added.data.queue.length, 1);
    assert.equal(added.data.queue[0].title, 'Persistent song');
  } finally { await stop(first); }
  const second = await start(dir, port);
  try {
    const rooms = JSON.parse(fs.readFileSync(path.join(dir, 'state'), 'utf8') || '[]');
    assert.fail('state directory should contain per-room files, not a single JSON array');
  } catch (error) {
    assert.ok(error.code === 'EISDIR' || error instanceof SyntaxError || error.message.includes('state directory'));
  }
  const files = fs.readdirSync(path.join(dir, 'state')).filter(f => f.endsWith('.json'));
  assert.equal(files.length, 1);
  const roomCode = files[0].slice(0, -5);
  const login = await request(base, '/api/login', { roomCode, password: 'Persist-test-123!' });
  assert.equal(login.status, 200);
  const queue = await request(base, '/api/queue', undefined, login.data.roomToken);
  assert.equal(queue.status, 200);
  assert.equal(queue.data.queue.length, 1);
  assert.equal(queue.data.queue[0].title, 'Persistent song');
  assert.equal(queue.data.queue[0].videoId, 'dQw4w9WgXc');
  const duplicate = await request(base, '/api/queue', { youtubeUrl: 'https://youtu.be/dQw4w9WgXc' }, login.data.roomToken);
  assert.equal(duplicate.status, 409);
  assert.equal((await request(base, '/api/queue', undefined, login.data.roomToken)).data.queue.length, 1);
  await stop(second);
  fs.rmSync(dir, { recursive: true, force: true });
});
