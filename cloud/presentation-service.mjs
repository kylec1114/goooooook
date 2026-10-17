const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export const ACK_SQL='UPDATE ktv_display SET observed_json=?,reported_at=?,player_hash=? WHERE room_code=? AND revision=? AND EXISTS(SELECT 1 FROM room_runtime WHERE room_code=? AND player_hash=? AND lease_until>?)';
export async function presentation(req,env,ctx,previous){
 const u=new URL(req.url);if(u.pathname.endsWith('/ack')&&req.method!=='POST')return json({error:'只接受 POST'},405);if(!['GET','POST'].includes(req.method))return json({error:'不支援此方法'},405);
 if(req.method==='POST'&&req.headers.get('origin')&&req.headers.get('origin')!==u.origin)return json({error:'不允許跨網站操作'},403);
 const r=await previous.fetch(new Request(new URL('/api/state',req.url),{headers:req.headers}),env,ctx);if(!r.ok)return r;const s=await r.json();if(!['owner','player'].includes(s.role))return json({error:'只有房主或 TV 可使用'},403);if(s.role==='player'&&!s.leader)return json({error:'只有主 TV 可使用'},403);
 let b;if(req.method==='POST'){const text=await req.text();if(new TextEncoder().encode(text).length>4096)return json({error:'請求過大'},413);try{b=JSON.parse(text);}catch{return json({error:'無效 JSON'},400);}}
 if(u.pathname.endsWith('/ack')&&(s.role!=='player'||!s.leader))return json({error:'只有主 TV 可回報'},403);
 if(req.method==='POST'&&!u.pathname.endsWith('/ack')&&s.role!=='owner')return json({error:'只有房主可控制 TV 顯示'},403);
 const db=(q,...a)=>env.DB.prepare(q).bind(...a),now=Date.now();
 await db('INSERT OR IGNORE INTO ktv_display(room_code) VALUES(?)',s.roomCode).run();
 if(req.method==='POST'){
  if(u.pathname.endsWith('/ack')){
   if(!Number.isSafeInteger(b?.revision)||b.revision<0||!['info','immersive'].includes(b.mode)||typeof b.fullscreen!=='boolean'||typeof b.needsGesture!=='boolean')return json({error:'無效 TV 回報'},400);
   const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(req.headers.get('authorization')?.slice(7)||'')))].map(v=>v.toString(16).padStart(2,'0')).join('');
   const observed={revision:b.revision,mode:b.mode,fullscreen:b.fullscreen,needsGesture:b.needsGesture,error:String(b.error||'').slice(0,200)};
   const result=await db(ACK_SQL,JSON.stringify(observed),now,h,s.roomCode,b.revision,s.roomCode,h,now).run();if(!result.meta.changes)return json({error:'顯示指令或播放權已改變'},409);
  }else{
   if(!['info','immersive','enter_fullscreen','exit_fullscreen'].includes(b?.action))return json({error:'無效顯示指令'},400);
   const mode=['info','immersive'].includes(b.action)?b.action:null,request=b.action==='enter_fullscreen'?'enter':b.action==='exit_fullscreen'?'exit':'none';
   await db('UPDATE ktv_display SET mode=COALESCE(?,mode),fullscreen_request=?,revision=revision+1 WHERE room_code=?',mode,request,s.roomCode).run();
  }
 }
 const row=await db('SELECT * FROM ktv_display WHERE room_code=?',s.roomCode).first();const live=await db('SELECT player_hash,lease_until FROM room_runtime WHERE room_code=?',s.roomCode).first();
 const fresh=!!live&&live.player_hash===row.player_hash&&live.lease_until>now&&row.reported_at>now-12000;
 return json({roomCode:s.roomCode,mode:row.mode,revision:row.revision,fullscreenRequest:row.fullscreen_request,observed:fresh&&row.observed_json?JSON.parse(row.observed_json):null});
}
