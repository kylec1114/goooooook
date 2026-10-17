import './profile-ui.mjs';
import {parsePlaylist,exportPlaylist,readPlaylists,appendPlaylist} from './playlist-data.mjs';
import {profileLabel} from './guest-profile.mjs';
const by=id=>document.getElementById(id),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
if(by('roomNav')){
 const style=make('link');style.rel='stylesheet';style.href='/playlist-room.css';document.head.append(style);
 const panel=make('details');panel.className='card playlist-tools';panel.append(make('summary','歌單匯入／匯出'));const description=make('p','歌單只儲存歌曲資料，不包含房號、密碼或登入憑證。匯入先儲存本機，不會自動改動房間隊列。');
 const name=make('input');name.placeholder='歌單名稱';name.maxLength=80;name.setAttribute('aria-label','歌單名稱');const select=make('select');select.setAttribute('aria-label','本機歌單');
 const file=make('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','匯入歌單 JSON');
 const saveQueue=make('button','儲存目前隊列'),download=make('button','匯出所選歌單'),enqueue=make('button','加入所選歌單到隊列'),status=make('p');status.setAttribute('role','status');panel.append(description,name,file,select,saveQueue,download,enqueue,status);by('library').append(panel);
 let list=[],busy=false,valid=true;try{list=readPlaylists(localStorage);}catch(e){valid=false;status.textContent=e.message;}
 function refreshList(){select.replaceChildren();list.forEach(p=>{const o=make('option',p.name+' · '+p.songs.length+' 首');o.value=p.id;select.append(o);});}
 function controls(){for(const el of [name,file,select,saveQueue,download,enqueue])el.disabled=busy||!valid;download.disabled=enqueue.disabled=busy||!valid||!list.length;}
 const selected=()=>list.find(p=>p.id===select.value)||list[0];
 function store(p){list=appendPlaylist(localStorage,list,p,crypto.randomUUID());refreshList();select.value=list.at(-1).id;controls();}
 file.onchange=async()=>{const f=file.files[0];if(!f)return;try{requireRoom();if(f.size>5242880)throw Error('檔案超過 5 MB');const p=parsePlaylist(await f.text());if(name.value.trim())p.name=name.value.trim();store(p);status.textContent='已匯入 '+p.songs.length+' 首到本機；房間隊列未有改動。';}catch(e){status.textContent=e.message;}finally{file.value='';}};
 saveQueue.onclick=async()=>{busy=true;controls();try{requireRoom();const d=await api('/api/state');store({name:name.value.trim()||'房間歌單',songs:d.queue});status.textContent='已儲存目前隊列，包括正在播放歌曲。';}catch(e){status.textContent=e.message;}finally{busy=false;controls();}};
 download.onclick=()=>{try{requireRoom();const p=selected(),url=URL.createObjectURL(new Blob([exportPlaylist(p)],{type:'application/json'})),a=make('a');a.href=url;a.download='goooooook-playlist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){status.textContent=e.message;}};
 enqueue.onclick=async()=>{let added=0,skipped=0;try{requireRoom();const p=selected();if(!confirm('將「'+p.name+'」嘅 '+p.songs.length+' 首加入目前隊列？不會清空或重排現有歌曲。'))return;const s=session,g=generation;busy=true;controls();for(const item of p.songs){if(session!==s||generation!==g)throw Error('房間已切換，已停止');try{const d=await api('/api/queue',{youtubeUrl:item.youtube_url,title:item.title,singer:profileLabel()});window.update(d);added++;}catch(e){if(session!==s||generation!==g)throw e;if(/隊列已滿|已在隊列|重複/.test(e.message)){const actual=await api('/api/state');if(actual.queue.some(x=>x.videoId===item.id)){skipped++;continue;}}throw e;}}status.textContent='已加入 '+added+' 首；略過重複 '+skipped+' 首。';}catch(e){status.textContent='已加入 '+added+' 首；停止：'+e.message;}finally{busy=false;controls();}};
 refreshList();controls();
 for(const id of ['createForm','joinForm']){const form=by(id),password=form.elements.password;password.minLength=6;password.maxLength=72;const hint=make('p',id==='createForm'?'🔒 房間受密碼保護。房主密碼請勿分享；朋友使用獨立訪客密碼。':'🔒 請輸入房號及訪客密碼。儲存名稱不會略過房間密碼驗證。');hint.className='room-security-note';form.append(hint);const toggle=make('input');toggle.type='checkbox';const label=make('label','顯示密碼');label.className='password-toggle';label.prepend(toggle);password.closest('label').after(label);toggle.onchange=()=>{password.type=toggle.checked?'text':'password';};}
 const logout=by('logout');logout.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();if(!confirm('登出此裝置？房主登出亦會撤銷由此登入連結的 TV。'))return;const s=session;logout.disabled=true;try{await api('/api/logout',{});if(session===s){exit();note('已登出並撤銷此登入授權。');}}catch(error){note('未能確認伺服器登出：'+error.message);}finally{logout.disabled=false;}},true);
}
