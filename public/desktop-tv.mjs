import './tv-stage.mjs';
import {openTvTab,enterTvFullscreen} from './tv-launch.mjs';
const by=id=>document.getElementById(id),desktop=!matchMedia('(max-width: 760px), (pointer: coarse)').matches;
if(desktop){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/desktop-tv.css';document.head.append(style);
 if(by('roomNav')){
  let tvTab=null;const button=by('tvLink');if(button)button.textContent='在新分頁開啟 TV';
  document.addEventListener('click',e=>{if(!e.target.closest?.('#tvLink'))return;e.preventDefault();e.stopImmediatePropagation();try{requireRoom();if(session.role!=='owner')throw Error('只有房主可開啟 TV');if(tvTab&&!tvTab.closed){tvTab.focus();note('TV 分頁已開啟；請在該頁按「進入全螢幕」。');return;}tvTab=openTvTab(window,session);note('TV 已在新分頁開啟；此頁保留點歌及遙控。');}catch(error){note(error.message);}},true);
 }
 const stage=by('tv-stage');if(stage){
  document.body.classList.add('desktop-tv-presentation');
  const entry=document.createElement('div');entry.className='tv-entry';const text=document.createElement('span');text.textContent='TV 模式已就緒。請按一下進入全螢幕；按 Esc 可退出。';const button=document.createElement('button');button.type='button';button.textContent='進入全螢幕';entry.append(text,button);stage.prepend(entry);
  const start=async()=>{try{const entered=await enterTvFullscreen(stage,document);if(!entered)text.textContent='未能確認全螢幕；可再按一次。';}catch(error){text.textContent='未進入瀏覽器全螢幕，現時使用滿視窗 TV 模式。'+error.message;}};
  button.onclick=start;
  document.addEventListener('fullscreenchange',()=>{entry.hidden=document.fullscreenElement===stage;if(!entry.hidden)text.textContent='已退出全螢幕；可按一下重新進入。';});
  if(navigator.userActivation?.isActive)void start();
 }
}
