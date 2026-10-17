import previous from './unified-worker.mjs';
import {handleStop} from './stop-service.mjs';
const json=(d,status)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export default {
 async fetch(req,env,ctx){try{const u=new URL(req.url);
  if(u.pathname==='/api/control'&&req.method==='POST'){
   const text=await req.clone().text();if(new TextEncoder().encode(text).length>16384)return json({error:'請求過大'},413);
   let b;try{b=JSON.parse(text);}catch{return json({error:'無效 JSON'},400);}
   if(b?.action==='stop')return await handleStop(req,env,ctx,previous,b);
  }
  const r=await previous.fetch(req,env,ctx);
  if(r.ok&&['/studio','/studio.html','/room-screen','/room-screen.html'].includes(u.pathname)&&r.headers.get('Content-Type')?.includes('text/html')){
   const transformed=new HTMLRewriter().on('body',{element(e){e.append('<script type="module" src="/stop-controls.mjs"></script>',{html:true});}}).transform(r);
   const headers=new Headers(transformed.headers);headers.set('Cache-Control','no-store');headers.delete('Content-Length');
   return new Response(transformed.body,{status:transformed.status,headers});
  }return r;
 }catch(e){console.error('stop-control',e?.message);return json({error:'停止服務暫時不可用'},503);}},
 scheduled(event,env,ctx){return previous.scheduled(event,env,ctx);}
};
