const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const XLSX = require('xlsx');
const { io } = require('socket.io-client');
const ROOT = path.resolve(__dirname, '..');
const pause = ms => new Promise(r => setTimeout(r, ms));
test('browser scripts parse and contain no placeholder markers', () => {
  for (const file of ['public/index.html','public/tv.html']) {
    const text = fs.readFileSync(path.join(ROOT,file),'utf8');
    assert.ok(!text.includes('PLACEHOLDER_'));
    for (const m of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (m[1].trim()) new vm.Script(m[1], { filename: file });
  }
});
test('isolated host authorization and playback integration', { timeout: 90000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'goooooook-test-'));
  const port = 32189;
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath,[path.join(ROOT,'server.js')], { cwd: ROOT, env: { ...process.env, GOOOOOOOK_DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore','pipe','pipe'] });
  let output = ''; child.stdout.on('data',b=>output+=b); child.stderr.on('data',b=>output+=b);
  const sockets = [];
  t.after(async () => {
    sockets.forEach(s=>s.disconnect());
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(r=>child.once('exit',r));
      child.kill('SIGTERM');
      await Promise.race([exited,pause(3000)]);
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await Promise.race([exited,pause(1000)]); }
    }
    fs.rmSync(dir,{recursive:true,force:true});
  });
  for (let i=0;i<150&&!output.includes('host ready');i++) { if(child.exitCode!==null) throw Error(output); await pause(100); }
  assert.match(output,/host ready/);
  async function request(route,body,token) {
    const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,data:await r.json()};
  }
  async function connect(credential) {
    const s=io(base,{auth:{roomCode:credential.roomCode,roomToken:credential.roomToken},transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('socket connect timeout')),5000);s.once('connect',()=>{clearTimeout(timer);resolve();});s.once('connect_error',e=>{clearTimeout(timer);reject(e);});s.connect();});
    return s;
  }
  function ack(s,event,data) { return new Promise((resolve,reject)=>s.timeout(4000).emit(event,data,(error,result)=>error?reject(error):resolve(result))); }
  const denied=await request('/api/queue'); assert.equal(denied.status,401);
  const created=await request('/api/rooms',{password:'Test-only-123!',roomName:'CI room'}); assert.equal(created.status,200);
  const a=created.data;
  const b=(await request('/api/login',{roomCode:a.roomCode,password:'Test-only-123!'})).data;
  assert.notEqual(a.roomToken,b.roomToken);
  assert.equal((await request('/api/queue',undefined,a.roomToken)).status,200);
  assert.equal((await request('/api/queue',undefined,b.roomToken)).status,200);
  const other=(await request('/api/rooms',{password:'Other-test-123!',roomName:'other'})).data;
  await t.test('cross-room socket credential is rejected',async()=>{
    await assert.rejects(connect({roomCode:other.roomCode,roomToken:a.roomToken}));
  });
  const controller=await connect(a);
  const p=(await request('/api/player',{},a.roomToken)).data;
  const tv=await connect(p);
  assert.equal((await ack(tv,'claimPlayer',{})).leader,true);
  const p2=(await request('/api/player',{},b.roomToken)).data;
  const tv2=await connect(p2);
  assert.equal((await ack(tv2,'claimPlayer',{})).leader,false);
  const url='https://youtu.be/dQw4w9WgXc';
  assert.equal((await request('/api/queue',{youtubeUrl:'https://evil.invalid/watch?v=dQw4w9WgXc'},a.roomToken)).status,400);
  assert.equal((await request('/api/queue',{youtubeUrl:url},p.roomToken)).status,403);
  const added=await request('/api/queue',{youtubeUrl:url,title:'Test <song> with apostrophe',singer:'CI'},a.roomToken); assert.equal(added.status,200);
  const item=added.data.queue[0]; assert.ok(item.id);
  assert.equal((await request('/api/queue',{youtubeUrl:url},a.roomToken)).status,409);
  assert.equal((await request('/api/queue',undefined,other.roomToken)).data.queue.length,0);
  assert.equal((await ack(controller,'nextSong',{currentItemId:item.id})).ok,false);
  assert.equal((await ack(tv2,'nextSong',{currentItemId:item.id})).ok,false);
  const wb=XLSX.readFile(path.join(dir,'goooooook.xlsx'));
  wb.Sheets.Songs=XLSX.utils.json_to_sheet([{song_id:1,title:'CI',youtube_url:url,lrc_file:'test.lrc'}]);XLSX.writeFile(wb,path.join(dir,'goooooook.xlsx'));
  fs.writeFileSync(path.join(dir,'lyrics','test.lrc'),'[00:01.50]Test line\n[00:02.00]Next line');
  const lrc=await request('/api/lyrics/dQw4w9WgXc',undefined,p.roomToken);assert.equal(lrc.status,200);assert.equal(lrc.data.lyrics[0].time,1.5);
  wb.Sheets.Songs=XLSX.utils.json_to_sheet([{song_id:1,youtube_url:url,lrc_file:'../outside.lrc'}]);XLSX.writeFile(wb,path.join(dir,'goooooook.xlsx'));
  fs.writeFileSync(path.join(dir,'outside.lrc'),'[00:00.00]private');
  assert.equal((await request('/api/lyrics/dQw4w9WgXc',undefined,p.roomToken)).status,400);
  assert.equal((await ack(tv,'nextSong',{currentItemId:item.id})).ok,true);
  assert.equal((await ack(tv,'nextSong',{currentItemId:item.id})).ok,false);
  assert.equal((await request('/api/queue',undefined,a.roomToken)).data.queue.length,0);
  assert.equal((await request('/api/logout',{},a.roomToken)).status,200);
  assert.equal((await request('/api/queue',undefined,a.roomToken)).status,401);
  assert.equal((await request('/api/queue',undefined,p.roomToken)).status,401);
  assert.equal((await request('/api/queue',undefined,b.roomToken)).status,200);
  assert.equal((await request('/api/queue',undefined,p2.roomToken)).status,200);
  await t.test('revoked credential cannot reconnect',async()=>{await assert.rejects(connect(a));});
});
