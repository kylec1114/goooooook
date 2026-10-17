'use strict';
const el=id=>document.getElementById(id);let timer;
async function command(type){try{const r=await chrome.runtime.sendMessage({target:'background',type,...(type==='SET_STRENGTH'?{strength:Number(el('strength').value)}:{})});if(!r?.ok)throw Error(r?.error||'No response');el('status').textContent=r.active?'本分頁已啟動':'本分頁未啟動';if(type==='STATUS')el('strength').value=r.strength;el('strength').disabled=!r.active;}catch(e){el('status').textContent=e.message;}}
el('start').onclick=()=>command('START');el('stop').onclick=()=>command('STOP');el('strength').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>command('SET_STRENGTH'),150);};command('STATUS');
