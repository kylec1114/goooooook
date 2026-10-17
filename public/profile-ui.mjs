import {EMOJIS,getProfile,setProfile,normalizeProfile,profileLabel} from './guest-profile.mjs';
const by=id=>document.getElementById(id),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
if(by('roomNav')){
 const style=make('link');style.rel='stylesheet';style.href='/profile-mobile.css';document.head.append(style);
 const fields=[];const badge=make('button');badge.type='button';badge.className='profile-pill';document.querySelector('header').append(badge);
 function sync(fill=false){const p=getProfile();badge.textContent=p?profileLabel(p):'設定名稱';const singer=by('songForm')?.elements.singer;if(singer){singer.value=p?profileLabel(p):'';if(singer.closest('label'))singer.closest('label').hidden=true;}const stop=by('stop-at-start');if(stop)stop.textContent='■ 停止回開頭';for(const f of fields){if(fill&&p){f.input.value=p.name;f.emoji=p.emoji;}for(const b of f.buttons)b.checked=b.dataset.emoji===f.emoji;}}
 function fieldset(form){const group=make('fieldset');group.className='guest-profile';group.append(make('legend','你嘅名稱及 emoji'));const label=make('label','稱呼（最多 24 個字）'),input=make('input');input.name='displayName';input.required=true;input.maxLength=48;input.autocomplete='nickname';label.append(input);const picker=make('div');picker.className='emoji-picker';picker.setAttribute('role','group');picker.setAttribute('aria-label','選擇 emoji');const choice={input,emoji:getProfile()?.emoji||EMOJIS[0],buttons:[]};
 for(const emoji of EMOJIS){const label=make('label',emoji),b=make('input');label.className='emoji-option';b.type='radio';b.name='profileEmoji';b.value=emoji;b.dataset.emoji=emoji;b.setAttribute('aria-label',emoji);b.onchange=()=>{choice.emoji=emoji;};label.append(b);picker.append(label);choice.buttons.push(b);}
 const remember=make('input');remember.type='checkbox';remember.checked=true;const rememberLabel=make('label','記住我（只儲存喺呢個瀏覽器）');rememberLabel.className='remember-profile';rememberLabel.prepend(remember);group.append(label,picker,rememberLabel);form.prepend(group);choice.remember=remember;fields.push(choice);return choice;}
 function commit(f){try{const p=normalizeProfile({name:f.input.value,emoji:f.emoji});f.input.setCustomValidity('');const stored=setProfile(p,f.remember.checked);sync(true);if(!stored)note('瀏覽器未能儲存名稱；今次仍可繼續使用。');return true;}catch(e){f.input.setCustomValidity(e.message);f.input.reportValidity();return false;}}
 const dialog=make('dialog');dialog.className='profile-dialog';const profileForm=make('form'),dialogFields=fieldset(profileForm),submit=make('button','儲存並繼續');submit.className='primary';submit.type='submit';profileForm.append(submit);dialog.append(profileForm);document.body.append(dialog);
 function prompt(){sync(true);if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}}
 profileForm.onsubmit=e=>{e.preventDefault();if(commit(dialogFields)){if(dialog.close)dialog.close();else dialog.removeAttribute('open');}};
 dialog.addEventListener('cancel',e=>{if(!getProfile())e.preventDefault();});badge.onclick=prompt;
 for(const id of ['createForm','joinForm']){const form=by(id),f=fieldset(form);form.addEventListener('submit',e=>{if(!commit(f)){e.preventDefault();e.stopImmediatePropagation();}},true);f.input.addEventListener('input',()=>f.input.setCustomValidity(''));}
 dialogFields.input.addEventListener('input',()=>dialogFields.input.setCustomValidity(''));
 const require=window.requireRoom;window.requireRoom=function(){require();if(!getProfile()){prompt();throw Error('請先設定名稱及 emoji');}};
 const update=window.update;window.update=function(d){update(d);sync();if(!getProfile())prompt();};
 const settings=by('settings');if(settings){const edit=make('button','修改名稱／emoji');edit.type='button';edit.onclick=prompt;settings.append(edit);}
 sync(true);if(session&&!getProfile())prompt();
}
