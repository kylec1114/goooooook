import './settings-library.mjs';
function inviteLink(origin,code){if(!/^[A-Z0-9]{7}$/.test(code||''))throw Error('房號無效');return new URL('/?room='+encodeURIComponent(code),origin).href;}
const by=id=>document.getElementById(id),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
function mount(){const remote=by('remote'),grid=by('settings-grid');if(!by('roomNav')||!remote||!grid||by('friend-invite'))return;
 const settingsCard=grid.children[2],heading=settingsCard.querySelector('h3');
 const stash=by('legacy-library-fields'),backupNodes=[...settingsCard.children].filter(x=>x!==heading&&x!==stash);
 const mobileHost=make('div');mobileHost.id='invite-mobile-host';settingsCard.append(mobileHost);
 const desktop=make('aside');desktop.id='invite-desktop-card';desktop.className='card';desktop.append(make('h3','邀請好友'));remote.append(desktop);remote.classList.add('remote-invite-layout');
 const shortcut=make('button','到房間遙控邀請好友');shortcut.type='button';shortcut.onclick=()=>view('remote');settingsCard.append(shortcut);
 const content=make('div');content.id='friend-invite';const hint=make('p','點一下 QR code 即可複製邀請連結。朋友仍需輸入房間密碼。');hint.id='invite-copy-hint';
 const qrButton=make('button');qrButton.type='button';qrButton.className='invite-qr-button';qrButton.disabled=true;qrButton.setAttribute('aria-label','點 QR code 複製邀請連結');qrButton.setAttribute('aria-describedby','invite-copy-hint');
 const qr=make('img');qr.width=180;qr.height=180;qr.alt='掃碼加入房間';qr.hidden=true;qrButton.append(qr);
 const link=make('input');link.type='text';link.readOnly=true;link.setAttribute('aria-label','房間邀請連結');const copy=make('button','複製邀請連結'),retry=make('button','重新載入 QR'),status=make('p','加入房間後顯示邀請連結');copy.type=retry.type='button';copy.disabled=retry.disabled=true;status.setAttribute('role','status');content.append(hint,qrButton,link,copy,retry,status);
 const style=make('link');style.rel='stylesheet';style.href='/room-invite.css';document.head.append(style);
 const mobile=matchMedia('(max-width: 760px), (pointer: coarse)');let serial=0,objectUrl=null,loadedSession=null;
 function place(){for(const child of [...settingsCard.children])if(child!==heading&&child!==mobileHost&&child!==shortcut&&child!==stash&&!backupNodes.includes(child))backupNodes.push(child);
  if(mobile.matches){heading.textContent='邀請好友';if(content.parentElement!==mobileHost)mobileHost.append(content);desktop.hidden=true;shortcut.hidden=true;for(const child of backupNodes)if(child.parentElement!==stash)stash.append(child);}
  else{heading.textContent='歌單與備份';if(content.parentElement!==desktop)desktop.append(content);desktop.hidden=false;shortcut.hidden=false;for(const child of backupNodes)if(child.parentElement!==settingsCard)settingsCard.append(child);}
  for(const child of [...remote.children])if(child!==desktop&&/邀請朋友|邀請好友/.test(child.querySelector?.('h3')?.textContent||''))child.hidden=true;
 }
 function clear(){serial++;loadedSession=null;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;qr.hidden=true;qr.removeAttribute('src');link.value='';qrButton.disabled=copy.disabled=retry.disabled=true;status.textContent='加入房間後顯示邀請連結';}
 async function load(){const id=++serial,requestedSession=session;try{requireRoom();const s=session,g=generation;loadedSession=s;link.value=inviteLink(location.origin,s.roomCode);copy.disabled=retry.disabled=false;qrButton.disabled=true;qr.hidden=true;status.textContent='QR 載入中…';
  const response=await fetch('/api/invite-qr',{headers:{Authorization:'Bearer '+s.roomToken}});if(!response.ok||!response.headers.get('Content-Type')?.includes('image/svg+xml'))throw Error('未能載入 QR；仍可複製入房連結');const blob=await response.blob();
  if(id!==serial||s!==session||g!==generation)return;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);qr.src=objectUrl;qr.hidden=false;qrButton.disabled=false;status.textContent='掃碼入房，或點 QR code 複製連結。';
 }catch(e){if(id===serial&&requestedSession===session)status.textContent=e.message;}}
 async function copyLink(){try{requireRoom();const s=session,value=inviteLink(location.origin,s.roomCode);link.value=value;if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(value);if(s===session)status.textContent='已複製邀請連結，請另外告知朋友訪客密碼。';}catch{link.focus();link.select();status.textContent='未能自動複製；連結已選取，請手動複製。';}}
 qrButton.onclick=copyLink;copy.onclick=copyLink;retry.onclick=load;
 mobile.addEventListener('change',place);place();
 if(typeof MutationObserver!=='undefined'){const observer=new MutationObserver(place);observer.observe(remote,{childList:true});observer.observe(settingsCard,{childList:true});}
 const update=window.update;window.update=function(d){const value=update(d);place();if(loadedSession!==session)void load();return value;};
 const exit=window.exit;window.exit=function(){clear();return exit();};window.addEventListener('pagehide',clear);
 if(verified&&session)void load();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
