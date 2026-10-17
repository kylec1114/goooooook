import './playlist-room.mjs';
const by=id=>document.getElementById(id),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
function mount(){const settings=by('settings'),library=by('library');if(!by('roomNav')||!settings||!library||by('settings-grid'))return;
 const style=make('link');style.rel='stylesheet';style.href='/settings-library.css';document.head.append(style);
 const grid=make('div');grid.id='settings-grid';grid.className='settings-grid';
 const card=title=>{const c=make('article');c.className='card settings-card';c.append(make('h3',title));grid.append(c);return c;};
 const personal=card('個人資料'),room=card('房間與訪客'),tools=card('歌單與備份'),connection=card('連線與退出');
 const profile=make('p'),edit=make('button','修改名稱／emoji');edit.type='button';edit.onclick=()=>document.querySelector('.profile-pill')?.click();personal.append(profile,edit);
 room.append(make('p','房主可更換訪客密碼；訪客需使用房號及密碼登入。'));
 const status=make('a','版本與連線狀態');status.href='/status.html';status.className='button';connection.append(status);
 const home=by('home');if(home&&!by('home-apk-download')){const download=make('a','Android 測試版下載');download.id='home-apk-download';download.href='/download/';download.className='button';home.append(download);}
 const stash=make('div');stash.hidden=true;stash.id='legacy-library-fields';tools.append(stash);
 settings.append(grid);
 function reconcile(){
  for(const child of [...settings.children]){if(child===grid||child.tagName==='H2')continue;const title=child.querySelector?.('h3')?.textContent||'';
   if(title.includes('訪客管理'))room.append(child);
   else if(child.textContent?.includes('修改名稱'))stash.append(child);
   else{const home=child.matches?.('[data-view="home"]')?child:child.querySelector?.('[data-view="home"]');if(home)home.textContent='返回房間';connection.append(child);}
  }
  const queryLabel=by('query')?.closest('label'),results=by('results');
  for(const child of [...library.children]){if(child.tagName==='H2'){child.textContent='本機收藏';continue;}if(child===queryLabel||child===results)continue;
   if(child.classList.contains('playlist-tools')||child.id==='export'||child.contains(by('import'))||child.contains(by('songForm')))tools.append(child);else stash.append(child);
  }
  if(queryLabel){queryLabel.hidden=false;const text=[...queryLabel.childNodes].find(x=>x.nodeType===3);if(text)text.textContent='搜尋本機收藏';}if(results)results.hidden=false;
  profile.textContent=document.querySelector('.profile-pill')?.textContent||'尚未設定名稱';
 }
 reconcile();
 if(typeof MutationObserver!=='undefined'){const observer=new MutationObserver(reconcile);observer.observe(settings,{childList:true});observer.observe(library,{childList:true});}
 const update=window.update;window.update=function(d){const value=update(d);reconcile();return value;};
 if(typeof filter!=='undefined')filter='';if(typeof window.render==='function')window.render();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
