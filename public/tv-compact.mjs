import './desktop-tv.mjs';
import {sufficientlyVisible,requestDisplayFullscreen} from './tv-display-policy.mjs';
const by=id=>document.getElementById(id),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
const remote=!!by('roomNav'),stage=by('tv-stage');
if(remote||stage){
 const style=make('link');style.rel='stylesheet';style.href='/tv-compact.css';document.head.append(style);
 let timer=null,stopped=false,inFlight=false,revision=-1,mode='info',needsGesture=false,error='',visible=true;const buttons=[];
 const status=make('p');status.setAttribute('role','status');status.className='tv-display-status';
 const context=()=>remote?session:identity,key=()=>remote?generation:epoch;
 let localButton=null,video=null,measure=()=>{};
 if(remote){const panel=make('details');panel.className='card tv-display-controls';panel.append(make('summary','TV 畫面控制'));for(const [action,label] of [['immersive','TV 沉浸模式'],['info','顯示 TV 資訊'],['enter_fullscreen','要求 TV 全螢幕'],['exit_fullscreen','退出 TV 全螢幕']]){const b=make('button',label);b.type='button';b.disabled=true;b.onclick=async()=>{try{requireRoom();if(session.role!=='owner')throw Error('只有房主可操作');const s=context(),g=key();b.disabled=true;const d=await api('/api/tv/presentation',{action});if(context()===s&&key()===g)status.textContent='指令已送出，等待 TV 回報。';}catch(e){status.textContent=e.message;}finally{b.disabled=session?.role!=='owner';}};panel.append(b);buttons.push(b);}panel.append(make('small','真正進入全螢幕可能需要在 TV 本機按一下；此處會顯示 TV 回報。'),status);by('remote').querySelector('.card').append(panel);}
 else{
  stage.classList.add('compact-tv');video=stage.querySelector('.video');const header=stage.querySelector('.tv-room-header');localButton=make('button','進入全螢幕');localButton.type='button';header.append(localButton);stage.append(status);
  measure=()=>stage.style.setProperty('--tv-header-height',header.getBoundingClientRect().height+'px');
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(measure).observe(header);measure();
  const check=()=>{const was=visible;visible=sufficientlyVisible(video.getBoundingClientRect(),innerWidth,innerHeight,document.hidden);if(!visible&&ready&&player)player.pauseVideo();if(visible&&!was&&active)void poll();};
  stage.addEventListener('scroll',check,{passive:true});window.addEventListener('resize',check);document.addEventListener('visibilitychange',check);if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(check,{threshold:[0,0.5,1]}).observe(video);check();
  const apply=window.apply;window.apply=function(d){if(state&&d.roomCode===state.roomCode&&((d.sync&&state.sync&&d.sync.commandRevision<state.sync.commandRevision)||(Number.isFinite(d.queueRevision)&&Number.isFinite(state.queueRevision)&&d.queueRevision<state.queueRevision)))return;if(!visible&&!d.paused){const value=apply({...d,paused:true});state=d;return value;}return apply(d);};
  const stateChange=window.goKtvStateChange;window.goKtvStateChange=function(e){if(e.data===1&&!visible){seen=null;player.pauseVideo();return;}return stateChange(e);};
  localButton.onclick=async()=>{try{await requestDisplayFullscreen(document,stage,'enter');needsGesture=false;error='';stage.classList.remove('tv-await-gesture');}catch(e){error=e.message;needsGesture=true;}measure();await ack();};
  document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement){needsGesture=false;error='';stage.classList.remove('tv-await-gesture');}localButton.hidden=!!document.fullscreenElement;measure();void ack();});
 }
 async function ack(){if(remote||!ready||!leader||revision<0)return;try{await api('/api/tv/presentation/ack',{revision,mode,fullscreen:!!document.fullscreenElement,needsGesture,error});}catch(e){status.textContent='TV 顯示回報未確認：'+e.message;}}
 async function tick(){if(stopped||inFlight)return;inFlight=true;try{
  const s=context(),g=key();if(!s||(remote&&!verified)||(!remote&&(!ready||!leader)))return;for(const b of buttons)b.disabled=s.role!=='owner';
  const d=await api('/api/tv/presentation');if(context()!==s||key()!==g||stopped)return;
  if(remote){const o=d.observed;status.textContent=!o?'TV 尚未回報顯示狀態':o.revision!==d.revision?'等待 TV 套用指令':o.needsGesture?'等待 TV 本機按一下進入全螢幕':o.error?'TV 操作未完成：'+o.error:(o.mode==='immersive'?'TV 沉浸模式':'TV 資訊模式')+' · '+(o.fullscreen?'已進入網頁全螢幕':'未處於網頁全螢幕');}
  else{if(d.revision!==revision){revision=d.revision;mode=d.mode;needsGesture=false;error='';stage.classList.toggle('tv-immersive',mode==='immersive');stage.classList.remove('tv-await-gesture');stage.scrollTop=0;try{if(d.fullscreenRequest!=='none')await requestDisplayFullscreen(document,stage,d.fullscreenRequest);}catch(e){needsGesture=d.fullscreenRequest==='enter';error=e.message;if(needsGesture)stage.classList.add('tv-await-gesture');}measure();}
   localButton.hidden=!!document.fullscreenElement;status.textContent=needsGesture?'請在 TV 按一下「進入全螢幕」。':error;await ack();}
 }catch(e){status.textContent='TV 畫面控制暫未可用：'+e.message;}finally{inFlight=false;if(!stopped)timer=setTimeout(tick,3000);}}
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);});window.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;void tick();}});void tick();
}
