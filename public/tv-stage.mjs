import './stop-controls.mjs';
const by=id=>document.getElementById(id),video=document.querySelector('.video');
if(video&&!by('roomNav')&&!matchMedia('(max-width: 760px), (pointer: coarse)').matches){
 const stage=video.parentElement;stage.id='tv-stage';stage.classList.add('tv-stage');
 const style=document.createElement('link');style.rel='stylesheet';style.href='/tv-stage.css';document.head.append(style);
 const header=document.createElement('div');header.className='tv-room-header';
 const info=document.createElement('div'),roomLabel=document.createElement('h2'),upNext=document.createElement('p');info.append(roomLabel,upNext);
 const invitation=document.createElement('div');invitation.className='tv-invite';const qr=document.createElement('img');qr.alt='掃碼加入房間，仍需輸入密碼';qr.width=112;qr.height=112;qr.hidden=true;
 const qrNote=document.createElement('small');qrNote.textContent='掃碼入房，請輸入房間密碼';const retry=document.createElement('button');retry.textContent='重試 QR';retry.hidden=true;invitation.append(qr,qrNote,retry);header.append(info,invitation);stage.insertBefore(header,video);
 const footer=document.createElement('div');footer.className='tv-room-footer';footer.setAttribute('role','group');footer.setAttribute('aria-label','TV 播放控制');
 const message=document.createElement('p');message.className='tv-room-message';message.setAttribute('role','status');stage.append(footer,message);
 let latest=null,busy=false,qrRoom=null,qrGeneration=0,blobUrl=null;const buttons=[];
 const say=text=>{message.textContent=text;};
 const sync=()=>{for(const b of buttons)b.disabled=b.dataset.command!=='fullscreen'&&(busy||!latest?.leader||!latest?.queue?.length);};
 async function loadQr(code){const generation=++qrGeneration;qr.hidden=true;retry.hidden=true;try{
  const response=await fetch('/api/tv/invite-qr',{headers:{Authorization:'Bearer '+identity.roomToken}});
  if(!response.ok||!response.headers.get('Content-Type')?.includes('image/svg+xml'))throw Error('QR 暫未可用');const blob=await response.blob();
  if(generation!==qrGeneration||latest?.roomCode!==code)return;
  if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(blob);qr.src=blobUrl;qr.hidden=false;
 }catch(e){if(generation===qrGeneration){retry.hidden=false;qrNote.textContent='QR 未載入；可用房號登入';}}}
 retry.onclick=()=>{if(latest?.roomCode)loadQr(latest.roomCode);};
 const render=window.render;window.render=function(d){const result=render(d);latest=d;roomLabel.textContent='房號：'+d.roomCode;upNext.textContent=d.queue[1]?'下一首：'+d.queue[1].title+' · '+(d.queue[1].singer||'Guest'):'下一首：暫無待播歌曲';if(qrRoom!==d.roomCode){qrRoom=d.roomCode;loadQr(qrRoom);}sync();return result;};
 window.goKtvCaptions=()=>{try{player.setOption('captions','fontSize',3);}catch{}};
 const oldBlocked=window.goKtvBlocked;window.goKtvBlocked=()=>{oldBlocked();say('瀏覽器阻擋播放，請按下方「播放」授權。');};
 async function fullscreen(){try{document.body.classList.remove('clean');if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch(e){say('無法進入全螢幕：'+e.message);}}
 async function command(action){if(busy||!latest?.leader||!latest.queue?.[0])return;const item=latest.queue[0].id,before=epoch;busy=true;sync();try{
  const path=action==='next'?'/api/queue/next':action==='stop'?'/api/control':'/api/tv/control';const data=action==='next'?{currentItemId:item}:{action,currentItemId:item};
  const d=await api(path,data);if(epoch!==before||state?.queue?.[0]?.id!==item)return;window.apply(d);
  if(action==='play')by('start').click();say(action==='restart'?'已重唱':action==='pause'?'已暫停':'指令已送出');
 }catch(e){say(e.message);}finally{busy=false;sync();}}
 for(const [action,label] of [['play','▶ 播放'],['pause','Ⅱ 暫停'],['restart','↻ 重唱'],['next','下一首 ▷'],['stop','■ 停止回開頭'],['fullscreen','全螢幕']]){const b=document.createElement('button');b.dataset.command=action;b.textContent=label;b.onclick=()=>{if(action==='fullscreen')return fullscreen();if(action==='play'&&ready&&leader&&latest&&!latest.paused){by('start').click();say('已嘗試播放');return;}return command(action);};footer.append(b);buttons.push(b);}
 by('full').onclick=fullscreen;by('clean').onclick=fullscreen;
 document.addEventListener('fullscreenchange',()=>{const b=buttons.find(x=>x.dataset.command==='fullscreen');b.textContent=document.fullscreenElement===stage?'退出全螢幕':'全螢幕';});
 window.addEventListener('pagehide',()=>{qrGeneration++;if(blobUrl)URL.revokeObjectURL(blobUrl);});
 if(typeof state!=='undefined'&&state)window.render(state);window.goKtvCaptions();sync();
}
