import qrcode from 'qrcode-generator';
const HOUR=3600000;
const enc=new TextEncoder();
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function error(message,status=400){const e=Error(message);e.status=status;throw e;}
const hex=a=>[...a].map(b=>b.toString(16).padStart(2,'0')).join('');
async function digest(t){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(t))));}
async function pw(p,salt){const k=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']);const a=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},k,256);return btoa(String.fromCharCode(...new Uint8Array(a)));}
const sql=(env,q,...args)=>env.DB.prepare(q).bind(...args);
async function runtime(env,code){return sql(env,'SELECT * FROM room_runtime WHERE room_code=?',code).first();}
async function credential(req,env){const h=req.headers.get('authorization')||'';if(!/^Bearer [a-f0-9]{64}$/.test(h))error('請重新登入',401);const hash=await digest(h.slice(7));const s=await sql(env,'SELECT * FROM sessions WHERE token_hash=? AND expires_at>?',hash,Date.now()).first();if(!s)error('登入已失效',401);const r=await runtime(env,s.room_code);if(!r||r.last_active<=Date.now()-HOUR)error('房間閒置一小時，已結束；本機收藏仍保留',410);if(!await sql(env,'SELECT 1 FROM rooms WHERE room_code=?',s.room_code).first())error('房間已結束',410);if(s.role==='player'&&!await sql(env,'SELECT 1 FROM player_links l JOIN sessions p ON p.token_hash=l.parent_hash WHERE l.child_hash=? AND p.expires_at>?',hash,Date.now()).first())error('電視授權已撤銷',401);return {s,r,hash};}
function owner(a){if(a.s.role!=='owner')error('只有房主可以操作',403);}
function remote(a){if(!['owner','guest','controller'].includes(a.s.role))error('電視不能點歌',403);}
async function touch(env,code){const t=Date.now();const r=await sql(env,'UPDATE room_runtime SET last_active=? WHERE room_code=? AND last_active>?',t,code,t-HOUR).run();if(!r.meta.changes)error('房間已過期',410);}
async function issue(env,code,role){const token=hex(crypto.getRandomValues(new Uint8Array(32)));await sql(env,'INSERT INTO sessions(token_hash,room_code,role,expires_at) VALUES(?,?,?,?)',await digest(token),code,role,Date.now()+12*HOUR).run();return token;}
async function queue(env,code){return (await sql(env,'SELECT q.id,q.video_id AS videoId,q.youtube_url AS youtubeUrl,q.title,q.singer,q.position,o.token_hash AS addedBy FROM queue q LEFT JOIN queue_ownership o ON o.item_id=q.id WHERE q.room_code=? ORDER BY q.position,q.created_at,q.id',code).all()).results;}
async function state(env,a){const q=await queue(env,a.s.room_code),r=await runtime(env,a.s.room_code);return {roomCode:a.s.room_code,role:a.s.role,queue:q.map(({addedBy,...item})=>({...item,canRemove:a.s.role==='owner'||addedBy===a.hash})),queueRevision:r.queue_revision,paused:!!r.paused,volume:r.volume,restartRevision:r.restart_revision,restartItem:r.restart_item,expiresAt:r.last_active+HOUR,leader:r.player_hash===a.hash&&r.lease_until>Date.now()};}
function video(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)return null;let id;if(u.hostname==='youtu.be')id=u.pathname.slice(1);else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))id=u.pathname==='/watch'?u.searchParams.get('v'):/^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/.exec(u.pathname)?.[1];return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}}
async function body(req){const text=await req.text();if(enc.encode(text).length>16384)error('請求過大',413);try{return JSON.parse(text);}catch{error('無效 JSON');}}
async function sweep(env){const cut=Date.now()-HOUR;const sub='SELECT room_code FROM room_runtime WHERE last_active<=?';await env.DB.batch(['queue_ownership','sessions','songs','queue','rooms','room_runtime'].map(table=>sql(env,`DELETE FROM ${table} WHERE room_code IN (${sub})`,cut)));await sql(env,'DELETE FROM sessions WHERE expires_at<=?',Date.now()).run();}
async function next(env,a,item){const code=a.s.room_code;if(a.s.role!=='owner'&&!(a.s.role==='player'&&a.r.player_hash===a.hash&&a.r.lease_until>Date.now()))error('不是房主或主電視',403);const first=(await queue(env,code))[0];if(!first||first.id!==item)error('歌曲已切換，請重新載入',409);await env.DB.batch([sql(env,'DELETE FROM queue_ownership WHERE item_id=? AND room_code=?',item,code),sql(env,'DELETE FROM queue WHERE room_code=? AND id=? AND id=(SELECT id FROM queue WHERE room_code=? ORDER BY position,created_at,id LIMIT 1)',code,item,code),sql(env,'UPDATE room_runtime SET queue_revision=queue_revision+1,paused=0 WHERE room_code=?',code)]);await touch(env,code);return reply(await state(env,a));}
async function api(req,env,url){const path=url.pathname,method=req.method;
 if(method!=='GET'&&req.headers.get('origin')&&req.headers.get('origin')!==url.origin)error('不允許跨網站操作',403);
 if((path==='/api/rooms'||path==='/api/login')&&method==='POST'){
  const b=await body(req);if(typeof b.password!=='string'||b.password.length<6||b.password.length>72)error('密碼需6至72字元');
  const ip=req.headers.get('CF-Connecting-IP')||'unknown',bucket=await digest(ip+':'+Math.floor(Date.now()/60000));
  const count=await sql(env,'INSERT INTO auth_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts',bucket,Date.now()+120000).first();if(count.attempts>12)error('操作太頻密，請稍後再試',429);
  if(path==='/api/rooms'){
   let code;do{code=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000000).padStart(7,'0');}while(await sql(env,'SELECT 1 FROM rooms WHERE room_code=?',code).first());
   const guest=hex(crypto.getRandomValues(new Uint8Array(6))),salt=hex(crypto.getRandomValues(new Uint8Array(16))),guestSalt=hex(crypto.getRandomValues(new Uint8Array(16)));
   await env.DB.batch([sql(env,'INSERT INTO rooms(room_code,room_name,password_hash,salt,created_at) VALUES(?,?,?,?,?)',code,String(b.roomName||'Home KTV').slice(0,80),await pw(b.password,salt),salt,new Date().toISOString()),sql(env,'INSERT INTO room_runtime(room_code,last_active,guest_hash,guest_salt) VALUES(?,?,?,?)',code,Date.now(),await pw(guest,guestSalt),guestSalt)]);return reply({roomCode:code,roomToken:await issue(env,code,'owner'),role:'owner',guestPassword:guest});
  }
  const code=String(b.roomCode||'').trim().toUpperCase(),r=await runtime(env,code);if(!r||r.last_active<=Date.now()-HOUR)error('房間不存在或已過期',410);
  const room=await sql(env,'SELECT * FROM rooms WHERE room_code=?',code).first();if(!room)error('房間不存在',410);
  let role;if(await pw(b.password,room.salt)===room.password_hash)role='owner';else if(r.guest_hash&&await pw(b.password,r.guest_salt)===r.guest_hash)role='guest';else error('房間碼或密碼錯誤',401);
  await touch(env,code);return reply({roomCode:code,roomToken:await issue(env,code,role),role});
 }
 const a=await credential(req,env),code=a.s.room_code;
 if(path==='/api/state'&&method==='GET')return reply(await state(env,a));
 if(path==='/api/logout'&&method==='POST'){await env.DB.batch([sql(env,'DELETE FROM sessions WHERE token_hash=?',a.hash),sql(env,'DELETE FROM sessions WHERE token_hash IN (SELECT child_hash FROM player_links WHERE parent_hash=?)',a.hash),sql(env,'DELETE FROM player_links WHERE parent_hash=? OR child_hash=?',a.hash,a.hash)]);return reply({ok:true});}
 if(path==='/api/guest-password'&&method==='POST'){owner(a);const b=await body(req);if(typeof b.password!=='string'||b.password.length<6||b.password.length>72)error('訪客密碼需6至72字元');const room=await sql(env,'SELECT * FROM rooms WHERE room_code=?',code).first();if(await pw(b.password,room.salt)===room.password_hash)error('訪客密碼不可與房主密碼相同');const salt=hex(crypto.getRandomValues(new Uint8Array(16)));await env.DB.batch([sql(env,'UPDATE room_runtime SET guest_hash=?,guest_salt=? WHERE room_code=?',await pw(b.password,salt),salt,code),sql(env,"DELETE FROM sessions WHERE room_code=? AND role IN ('guest','controller')",code)]);await touch(env,code);return reply({ok:true});}
 if(path==='/api/invite-qr'&&method==='GET'){remote(a);const qr=qrcode(0,'M');qr.addData(url.origin+'/?room='+encodeURIComponent(code));qr.make();return new Response(qr.createSvgTag({cellSize:5,margin:20,scalable:true}),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store'}});}
 if(path==='/api/player'&&method==='POST'){owner(a);const token=await issue(env,code,'player');await sql(env,'INSERT INTO player_links(child_hash,parent_hash,room_code) VALUES(?,?,?)',await digest(token),a.hash,code).run();await touch(env,code);return reply({roomCode:code,roomToken:token});}
 if(path==='/api/player/heartbeat'&&method==='POST'){
  if(a.s.role!=='player')error('只有電視可報到',403);
  const linked=await sql(env,'SELECT 1 FROM player_links l JOIN sessions p ON p.token_hash=l.parent_hash WHERE l.child_hash=? AND p.expires_at>?',a.hash,Date.now()).first();if(!linked)error('電視連結已失效',401);
  const b=await body(req),t=Date.now();await sql(env,'UPDATE room_runtime SET player_hash=?,lease_until=? WHERE room_code=? AND last_active>? AND (player_hash=? OR lease_until<=?)',a.hash,t+20000,code,t-HOUR,a.hash,t).run();
  const r=await runtime(env,code),leader=r.player_hash===a.hash&&r.lease_until>t;if(leader&&b.playing===true)await touch(env,code);return reply({...await state(env,a),leader});
 }
 if(path==='/api/songs'&&method==='GET'){owner(a);return reply({songs:(await sql(env,'SELECT id,title,artist,category,language,youtube_url FROM songs WHERE room_code=?',code).all()).results});}
 if(path==='/api/songs'&&method==='POST')error('請使用本機收藏歌庫，不再新增雲端歌曲',405);
 if(path==='/api/queue'&&method==='GET')return reply(await state(env,a));
 if(path==='/api/queue'&&method==='POST'){
  remote(a);const b=await body(req),vid=video(String(b.youtubeUrl||''));if(!vid)error('無效 YouTube 網址');const id=crypto.randomUUID();
  try{await env.DB.batch([sql(env,'INSERT INTO queue(id,room_code,video_id,youtube_url,title,singer,position,created_at) SELECT ?,?,?,?,?,?,COALESCE(MAX(position),0)+1,? FROM queue WHERE room_code=? HAVING COUNT(*)<200 AND COALESCE(SUM(video_id=?),0)=0',id,code,vid,'https://www.youtube.com/watch?v='+vid,String(b.title||'YouTube 歌曲').slice(0,200),String(b.singer||'Guest').slice(0,80),new Date().toISOString(),code,vid),sql(env,'INSERT INTO queue_ownership(item_id,room_code,token_hash) SELECT id,room_code,? FROM queue WHERE id=?',a.hash,id),sql(env,'UPDATE room_runtime SET queue_revision=queue_revision+1 WHERE room_code=?',code)]);}catch{error('歌曲可能已在隊列，請重新載入',409);}
  if(!await sql(env,'SELECT 1 FROM queue WHERE id=?',id).first())error('隊列已滿或歌曲已在隊列',409);await touch(env,code);return reply(await state(env,a));
 }
 if(path==='/api/queue/reorder'&&method==='POST'){
  owner(a);const b=await body(req),q=await queue(env,code),ids=b.ids;if(!Array.isArray(ids)||ids.length!==q.length||new Set(ids).size!==ids.length||ids.some(x=>!q.some(s=>s.id===x)))error('隊列已變動，請重新排序',409);
  if(b.revision!==a.r.queue_revision)error('隊列版本已變，請重試',409);
  const updates=ids.map((id,i)=>sql(env,'UPDATE queue SET position=? WHERE room_code=? AND id=? AND EXISTS(SELECT 1 FROM room_runtime WHERE room_code=? AND queue_revision=?)',i+1,code,id,code,b.revision));
  updates.push(sql(env,'UPDATE room_runtime SET queue_revision=queue_revision+1 WHERE room_code=? AND queue_revision=?',code,b.revision));const result=await env.DB.batch(updates);if(!result.at(-1).meta.changes)error('隊列版本已變，請重試',409);await touch(env,code);return reply(await state(env,a));
 }
 if(path==='/api/queue/next'&&method==='POST')return next(env,a,(await body(req)).currentItemId);
 if(path.startsWith('/api/queue/')&&method==='DELETE'){
  remote(a);const id=decodeURIComponent(path.slice('/api/queue/'.length));if(a.s.role!=='owner'&&!await sql(env,'SELECT 1 FROM queue_ownership WHERE item_id=? AND room_code=? AND token_hash=?',id,code,a.hash).first())error('訪客只能移除自己點的歌',403);
  await env.DB.batch([sql(env,'DELETE FROM queue WHERE id=? AND room_code=?',id,code),sql(env,'DELETE FROM queue_ownership WHERE item_id=? AND room_code=?',id,code),sql(env,'UPDATE room_runtime SET queue_revision=queue_revision+1 WHERE room_code=?',code)]);await touch(env,code);return reply(await state(env,a));
 }
 if(path==='/api/control'&&method==='POST'){
  owner(a);const b=await body(req);if(b.action==='next')return next(env,a,b.currentItemId);
  if(b.action==='play'||b.action==='pause')await sql(env,'UPDATE room_runtime SET paused=? WHERE room_code=?',b.action==='pause'?1:0,code).run();
  else if(b.action==='volume'){if(!Number.isInteger(b.value)||b.value<0||b.value>100)error('音量需0至100');await sql(env,'UPDATE room_runtime SET volume=? WHERE room_code=?',b.value,code).run();}
  else if(b.action==='restart'){const item=(await queue(env,code))[0];if(!item)error('隊列未有歌曲');await sql(env,'UPDATE room_runtime SET restart_revision=restart_revision+1,restart_item=?,paused=0 WHERE room_code=?',item.id,code).run();}
  else error('不支援此控制');await touch(env,code);return reply(await state(env,a));
 }
 error('找不到 API',404);
}
export default {
 async fetch(req,env){try{const url=new URL(req.url);if(url.pathname.startsWith('/api/'))return await api(req,env,url);const response=await env.ASSETS.fetch(req);if((url.pathname==='/'||url.pathname==='/index.html')&&response.headers.get('Content-Type')?.includes('text/html'))return new HTMLRewriter().on('head',{element(e){e.append('<script src="/remote.js"></script>',{html:true});}}).transform(response);return response;}catch(e){console.error(e);return reply({error:e.status?e.message:'伺服器錯誤，請查看 Worker 記錄'},e.status||500);}},
 async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await sweep(env);await env.DB.batch([sql(env,'DELETE FROM player_links WHERE child_hash NOT IN (SELECT token_hash FROM sessions) OR parent_hash NOT IN (SELECT token_hash FROM sessions)'),sql(env,'DELETE FROM auth_limits WHERE expires_at<=?',Date.now())]);})());}
};
