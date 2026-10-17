const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export const TV_SQL="UPDATE room_runtime SET paused=?,restart_revision=restart_revision+?,restart_item=CASE WHEN ?=1 THEN ? ELSE restart_item END,last_active=? WHERE room_code=? AND player_hash=? AND lease_until>? AND (SELECT id FROM queue WHERE room_code=? ORDER BY position,created_at,id LIMIT 1)=?";
export function joinUrl(origin,code){if(!/^[A-Z0-9]{7}$/.test(code))throw Error('無效房號');return new URL('/studio.html?room='+encodeURIComponent(code),origin).href;}
export async function tvRequest(req,env,ctx,previous,createQr,b){
 const u=new URL(req.url),read=u.pathname==='/api/tv/invite-qr';
 if(req.method!==(read?'GET':'POST'))return json({error:'不支援此方法'},405);
 if(!read&&req.headers.get('origin')&&req.headers.get('origin')!==u.origin)return json({error:'不允許跨網站操作'},403);
 const stateReq=()=>new Request(new URL('/api/state',req.url),{headers:req.headers});
 const auth=await previous.fetch(stateReq(),env,ctx);if(!auth.ok)return auth;const s=await auth.json();
 if(s.role!=='player'||(!read&&!s.leader))return json({error:'只有主 TV 可操作'},403);
 if(read){const qr=createQr(0,'M');qr.addData(joinUrl(u.origin,s.roomCode));qr.make();return new Response(qr.createSvgTag({cellSize:5,margin:20,scalable:true}),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
 if(!['play','pause','restart'].includes(b?.action))return json({error:'不支援此 TV 指令'},400);
 const song=s.queue?.[0];if(!song||b.currentItemId!==song.id)return json({error:'歌曲已切換，請重試'},409);
 const token=req.headers.get('authorization')?.slice(7)||'',now=Date.now();
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const restart=b.action==='restart'?1:0,paused=b.action==='pause'?1:0;
 const result=await env.DB.batch([env.DB.prepare(TV_SQL).bind(paused,restart,restart,song.id,now,s.roomCode,hash,now,s.roomCode,song.id),env.DB.prepare('UPDATE ktv_sync SET command_revision=command_revision+1 WHERE room_code=? AND changes()>0').bind(s.roomCode)]);
 if(!result[0]?.meta?.changes)return json({error:'播放權或歌曲已改變，請重試'},409);
 return previous.fetch(stateReq(),env,ctx);
}
