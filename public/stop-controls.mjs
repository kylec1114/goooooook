import './room-upgrade.mjs';
const by=id=>document.getElementById(id),isRemote=!!by('roomNav');
const host=isRemote?document.querySelector('#remote .remote-controls'):by('tvControls');
if(host){
 let latest=null,busy=false;const button=document.createElement('button');button.id='stop-at-start';button.textContent='■ 停止並回到開頭';button.disabled=true;host.append(button);
 const help=document.createElement('p');help.textContent='停止會回到 0 秒並保留歌曲及隊列；按播放才繼續。';host.after(help);
 const update=()=>{button.disabled=busy||!latest?.queue?.length||(isRemote?latest.role!=='owner':latest.leader!==true);};
 const name=isRemote?'update':'apply',original=window[name];
 window[name]=function(d){if(latest?.sync&&d.sync&&d.roomCode===latest.roomCode&&d.sync.commandRevision<latest.sync.commandRevision)return;const result=original(d);latest=d;update();return result;};
 button.onclick=async()=>{if(button.disabled)return;const item=latest.queue[0].id;busy=true;update();try{
  const d=await api('/api/control',{action:'stop',currentItemId:item});
  if(!isRemote&&(!state||state.queue?.[0]?.id!==item))return;
  window[name](d);note('已停止並回到開頭；歌曲及隊列已保留。');
 }catch(e){note(e.message);}finally{busy=false;update();}};
 if(isRemote)refresh().catch(e=>note(e.message));
}
