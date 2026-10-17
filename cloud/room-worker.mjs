import core from './worker.mjs';
import {validReport,matchesTarget} from '../public/room-protocol.mjs';
const sql=(env,q,...a)=>env.DB.prepare(q).bind(...a);
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function hash(req){const t=req.headers.get('authorization')?.slice(7)||'';return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function state(req,env){const u=new URL(req.url);u.pathname='/api/state';const r=await core.fetch(new Request(u,{headers:req.headers}),env);return r.ok?{data:await r.json()}:{response:r};}
async function row(env,code){await sql(env,'INSERT OR IGNORE INTO ktv_sync(room_code) VALUES(?)',code).run();return sql(env,'SELECT * FROM ktv_sync WHERE room_code=?',code).first();}
async function enrich(env,d){const s=await row(env,d.roomCode),r=await sql(env,'SELECT player_hash,lease_until FROM room_runtime WHERE room_code=?',d.roomCode).first();const fresh=!!r&&s.player_hash===r.player_hash&&r.lease_until>Date.now()&&s.reported_at>Date.now()-12000;return {...d,sync:{commandRevision:s.command_revision,appliedRevision:fresh?s.applied_revision:0,fresh,reportedAt:s.reported_at,observed:fresh&&s.observed_json?JSON.parse(s.observed_json):null}};}
async function payload(req){const text=await req.clone().text();if(new TextEncoder().encode(text).length>16384)throw Error('REQUEST_TOO_LARGE');return JSON.parse(text);}
async function api(req,env,url){const path=url.pathname,method=req.method,control=method==='POST'&&['/api/control','/api/queue/next'].includes(path),reorder=method==='POST'&&path==='/api/queue/reorder',heartbeat=method==='POST'&&path==='/api/player/heartbeat';let b;
 if(control||reorder){const a=await state(req,env);if(a.response)return a.response;await row(env,a.data.roomCode);if(reorder){b=await payload(req);if(a.data.queue.length&&(!Array.isArray(b.ids)||b.ids[0]!==a.data.queue[0].id))return json({error:'正在播放歌曲不可移動；請只排序待播歌曲'},409);}}
 if(heartbeat)b=await payload(req);
 const response=await core.fetch(req,env);if(!response.ok)return response;
 if(!['/api/state','/api/queue','/api/queue/reorder','/api/control','/api/queue/next','/api/player/heartbeat'].includes(path)&&!(path.startsWith('/api/queue/')&&method==='DELETE'))return response;
 const d=await response.json();if(!d.roomCode||!Array.isArray(d.queue))return json(d);
 if(control)await sql(env,'UPDATE ktv_sync SET command_revision=command_revision+1 WHERE room_code=?',d.roomCode).run();
 if(heartbeat&&d.leader&&validReport(b.report)){
  const report=b.report,s=await row(env,d.roomCode),h=await hash(req);let ack=0;if(matchesTarget(report,d)&&report.appliedRevision<=s.command_revision)ack=report.appliedRevision;
  await sql(env,'UPDATE ktv_sync SET applied_revision=CASE WHEN player_hash=? THEN MAX(applied_revision,?) ELSE ? END,player_hash=?,reported_at=?,observed_json=? WHERE room_code=? AND command_revision=? AND EXISTS(SELECT 1 FROM room_runtime WHERE room_code=? AND player_hash=? AND lease_until>? AND queue_revision=? AND restart_revision=? AND paused=? AND volume=?)',h,ack,ack,h,Date.now(),JSON.stringify(report),d.roomCode,s.command_revision,d.roomCode,h,Date.now(),d.queueRevision,d.restartRevision,d.paused?1:0,d.volume).run();
 }
 return json(await enrich(env,d));
}
export default {
 async fetch(req,env,ctx){try{const u=new URL(req.url);if(u.pathname.startsWith('/api/'))return await api(req,env,u);
 if(u.pathname==='/'||u.pathname==='/index.html'){u.pathname='/studio.html';return new Response(null,{status:302,headers:{Location:u.href,'Cache-Control':'no-store'}});}
 if(u.pathname==='/room-screen.html'&&u.searchParams.get('mode')!=='tv'&&!u.searchParams.has('token')){u.pathname='/studio.html';u.searchParams.set('view','remote');return new Response(null,{status:302,headers:{Location:u.href,'Cache-Control':'no-store'}});}
 const r=await core.fetch(req,env,ctx);if(!r.ok||!['/studio.html','/studio','/room-screen.html','/room-screen'].includes(u.pathname)||!r.headers.get('Content-Type')?.includes('text/html'))return r;
 const transformed=new HTMLRewriter().on('meta[name="referrer"]',{element(e){e.setAttribute('content','strict-origin-when-cross-origin');}}).on('head',{element(e){e.append('<link rel="stylesheet" href="/room-upgrade.css">',{html:true});}}).on('body',{element(e){e.append('<script type="module" src="/room-upgrade.mjs"></script>',{html:true});}}).transform(r);const headers=new Headers(transformed.headers);headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('Cache-Control','no-store');return new Response(transformed.body,{status:transformed.status,headers});
 }catch(e){console.error('room-sync',e?.message);return json({error:'同步服務暫時不可用；請檢查部署及 migration'},503);}},
 scheduled(event,env,ctx){const tasks=[];core.scheduled(event,env,{waitUntil:p=>tasks.push(p)});ctx.waitUntil(Promise.all(tasks).then(()=>sql(env,'DELETE FROM ktv_sync WHERE room_code NOT IN (SELECT room_code FROM rooms)').run()));}
};
