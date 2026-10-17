export function openTvTab(win,s){
 if(s?.role!=='owner'||!/^[a-f0-9]{64}$/.test(s.roomToken||'')||!/^[A-Z0-9]{7}$/.test(s.roomCode||''))throw Error('請先以房主身份登入房間');
 const tab=win.open('about:blank','_blank');if(!tab)throw Error('新分頁被瀏覽器阻擋，請允許此網站開啟彈出視窗後重試');
 try{tab.sessionStorage.setItem('goooooook.ui-session.v1',JSON.stringify({roomCode:s.roomCode,roomToken:s.roomToken,role:s.role}));tab.opener=null;tab.location.replace('/room-screen.html?mode=tv&fullscreen=1');tab.focus();return tab;}
 catch{try{tab.close();}catch{}throw Error('未能安全傳遞登入資料到 TV 分頁，請允許分頁儲存後重試');}
}
export async function enterTvFullscreen(stage,doc){if(doc.fullscreenElement===stage)return true;if(typeof stage.requestFullscreen!=='function')throw Error('瀏覽器未支援全螢幕，現時使用滿視窗 TV 模式');await stage.requestFullscreen({navigationUI:'hide'});return doc.fullscreenElement===stage;}
