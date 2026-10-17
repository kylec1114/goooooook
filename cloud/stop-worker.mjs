import previous from './unified-worker.mjs';
import {handleStop} from './stop-service.mjs';
import {tvRequest} from './tv-service.mjs';
import qrcode from 'qrcode-generator';
const json=(d,status)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export default {
 async fetch(req,env,ctx){try{const u=new URL(req.url);
  if(u.pathname==='/api/tv/invite-qr')return await tvRequest(req,env,ctx,previous,qrcode);
  if((u.pathname==='/api/control'||u.pathname==='/api/tv/control')&&req.method==='POST'){
   const text=await req.clone().text();if(new TextEncoder().encode(text).length>16384)return json({error:'請求過大'},413);
   let b;try{b=JSON.parse(text);}catch{return json({error:'無效 JSON'},400);}
   if(u.pathname==='/api/tv/control')return await tvRequest(req,env,ctx,previous,qrcode,b);
   if(b?.action==='stop')return await handleStop(req,env,ctx,previous,b);
  }
  if(u.pathname==='/api/tv/control')return json({error:'只接受 POST'},405);
  const r=await previous.fetch(req,env,ctx);
  if(r.ok&&['/studio','/studio.html','/room-screen','/room-screen.html'].includes(u.pathname)&&r.headers.get('Content-Type')?.includes('text/html')){
   const transformed=new HTMLRewriter().on('body',{element(e){e.append('<script type="module" src="/profile-ui.mjs"></script><script type="module" src="/tv-stage.mjs"></script>',{html:true});}}).transform(r);
   const headers=new Headers(transformed.headers);headers.set('Cache-Control','no-store');headers.delete('Content-Length');
   return new Response(transformed.body,{status:transformed.status,headers});
  }return r;
 }catch(e){console.error('tv-control',e?.message);return json({error:'播放控制服務暫時不可用'},503);}},
 scheduled(event,env,ctx){return previous.scheduled(event,env,ctx);}
};
