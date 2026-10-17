const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export const STOP_SQL="UPDATE room_runtime SET paused=1,restart_revision=restart_revision+1,restart_item=?,last_active=? WHERE room_code=? AND (SELECT id FROM queue WHERE room_code=? ORDER BY position,created_at,id LIMIT 1)=? AND (?='owner' OR (player_hash=? AND lease_until>?))";
export async function handleStop(req,env,ctx,previous,b){
 const u=new URL(req.url);if(req.headers.get('origin')&&req.headers.get('origin')!==u.origin)return json({error:'不允許跨網站操作'},403);
 const stateReq=()=>new Request(new URL('/api/state',req.url),{headers:req.headers});
 const auth=await previous.fetch(stateReq(),env,ctx);if(!auth.ok)return auth;const s=await auth.json();
 if(s.role!=='owner'&&!(s.role==='player'&&s.leader))return json({error:'只有房主或主電視可停止'},403);
 const item=s.queue?.[0];if(!item||b.currentItemId!==item.id)return json({error:'歌曲已切換，請重新載入'},409);
 const token=req.headers.get('authorization')?.slice(7)||'';
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');const now=Date.now();
 const result=await env.DB.batch([
  env.DB.prepare(STOP_SQL).bind(item.id,now,s.roomCode,s.roomCode,item.id,s.role,hash,now),
  env.DB.prepare('UPDATE ktv_sync SET command_revision=command_revision+1 WHERE room_code=? AND changes()>0').bind(s.roomCode)
 ]);
 if(!result[0]?.meta?.changes)return json({error:'歌曲或播放權已變動，請重試'},409);
 return previous.fetch(stateReq(),env,ctx);
}
