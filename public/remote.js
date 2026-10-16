(() => {
'use strict';
const nativeFetch=window.fetch.bind(window);let identity=null,latest=null,qrUrl=null;
const get=id=>document.getElementById(id);
function message(t){const p=get('remoteStatus');if(p)p.textContent=t;}
async function request(path,data){if(!identity)throw Error('請先登入房間');const response=await nativeFetch(path,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+identity.roomToken,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});if(!response.ok){let d;try{d=await response.json();}catch{}if(response.status===401||response.status===410){identity=null;latest=null;if(typeof leave==='function')leave();if(get('remotePanel'))get('remotePanel').hidden=true;}throw Error(d?.error||'操作失敗');}return response;}
function guard(fn){return async()=>{try{await fn();}catch(e){message(e.message);}};}
async function invite(){const response=await request('/api/invite-qr');if(qrUrl)URL.revokeObjectURL(qrUrl);qrUrl=URL.createObjectURL(await response.blob());get('inviteQR').src=qrUrl;get('inviteLink').value=location.origin+'/?room='+encodeURIComponent(identity.roomCode);}
function update(d){latest=d;const owner=identity?.role==='owner';get('ownerTools').hidden=!owner;get('roleLabel').textContent=owner?'房主':'訪客：可點歌及移除自己點的歌';if(get('migrate'))get('migrate').hidden=!owner;get('remoteExpiry').textContent='閒置到期：'+new Date(d.expiresAt).toLocaleTimeString()+'（播放或操作可續期）';get('volume').value=d.volume;}
window.fetch=async(input,init)=>{const response=await nativeFetch(input,init);const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;
 if(response.ok&&['/api/login','/api/rooms'].includes(path)){const d=await response.clone().json();identity=d;latest=null;get('remotePanel').hidden=false;get('ownerTools').hidden=d.role!=='owner';get('roleLabel').textContent=d.role==='owner'?'房主':'訪客';get('guestInfo').textContent=d.guestPassword?'本房訪客密碼：'+d.guestPassword:'房主可在下面設定／更換訪客密碼。';guard(invite)();}
 if(response.ok&&path.startsWith('/api/queue')&&identity){const d=await response.clone().json();if(d.queueRevision!==undefined)update(d);}
 return response;
};
document.addEventListener('DOMContentLoaded',()=>{
 const panel=document.createElement('section');panel.id='remotePanel';panel.hidden=true;panel.innerHTML='<h2>房間控制</h2><p id="roleLabel"></p><p id="remoteExpiry"></p><p id="remoteStatus" role="status"></p><h3>掃碼入房</h3><img id="inviteQR" alt="入房 QR Code，不含密碼" style="width:220px;height:220px;background:white"><input id="inviteLink" readonly aria-label="入房網址"><small>掃碼只填入房號，訪客仍須輸入訪客密碼。</small><div id="ownerTools" hidden><p id="guestInfo"></p><label>新訪客密碼<input id="guestPassword" type="password" autocomplete="new-password"></label><button id="rotateGuest">更換訪客密碼並登出所有訪客</button><button data-control="play">播放／繼續</button><button data-control="pause">暫停</button><button data-control="restart">重唱</button><button data-control="next">下一首</button><label>伴奏音量<input id="volume" type="range" min="0" max="100" value="100"></label></div>';
 get('controls').prepend(panel);
 get('rotateGuest').onclick=guard(async()=>{await request('/api/guest-password',{password:get('guestPassword').value});get('guestPassword').value='';get('guestInfo').textContent='訪客密碼已更換；請自行告知訪客。';message('所有舊訪客登入已撤銷');});
 panel.querySelectorAll('[data-control]').forEach(b=>b.onclick=guard(async()=>{const action=b.dataset.control;const d=await (await request('/api/control',{action,currentItemId:latest?.queue[0]?.id})).json();update(d);renderQueue(d.queue);message('控制已送出；電視通常數秒內更新');}));
 get('volume').onchange=guard(async()=>{update(await (await request('/api/control',{action:'volume',value:Number(get('volume').value)})).json());});
 const originalLogout=get('logout').onclick;get('logout').onclick=async()=>{try{if(identity)await request('/api/logout',{});}catch(e){message(e.message);}finally{identity=null;latest=null;panel.hidden=true;if(qrUrl)URL.revokeObjectURL(qrUrl);await originalLogout();}};
 const oldRender=renderQueue;
 renderQueue=function(q){oldRender(q);const rows=[...get('queue').children];rows.forEach((row,i)=>{const remove=row.querySelector('button');if(remove&&q[i])remove.disabled=!q[i].canRemove; if(identity?.role!=='owner'||!q[i])return;for(const [label,target] of [['置頂',0],['上移',i-1],['下移',i+1]]){const b=document.createElement('button');b.textContent=label;b.disabled=target<0||target>=q.length||target===i;b.onclick=guard(async()=>{const ids=q.map(x=>x.id);const [item]=ids.splice(i,1);ids.splice(target,0,item);const result=await (await request('/api/queue/reorder',{ids,revision:latest?.queueRevision})).json();update(result);renderQueue(result.queue);});row.append(b);}});};
 const room=new URLSearchParams(location.search).get('room');if(room&&/^[A-Z0-9]{7}$/i.test(room))get('room').value=room.toUpperCase();
 get('tv').addEventListener('click',e=>{if(identity?.role!=='owner'){e.preventDefault();message('只有房主可產生電視播放連結');}});
 const oldStatus=status;status=function(t){oldStatus(t);if(!roomToken&&identity){identity=null;latest=null;panel.hidden=true;}};
});
})();
