export const PROFILE_KEY='goooooook.profile.v1';
export const EMOJIS=Object.freeze(['🎤','🎵','🎸','🥁','🎹','🎧','⭐','🌈','🐱','🐼']);
let current=null;
export function normalizeProfile(p){const name=typeof p?.name==='string'?p.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().replace(/\s+/g,' '):'';if(!name||Array.from(name).length>24)throw Error('請輸入 1 至 24 個字嘅名稱');if(!EMOJIS.includes(p?.emoji))throw Error('請選擇一個提供嘅 emoji');return {name,emoji:p.emoji};}
export function readProfile(storage){try{return normalizeProfile(JSON.parse(storage.getItem(PROFILE_KEY)||'null'));}catch{return null;}}
export function getProfile(){if(current)return current;try{return current=readProfile(localStorage);}catch{return null;}}
export function setProfile(p,remember=true,storage){current=normalizeProfile(p);try{storage=storage||localStorage;if(remember)storage.setItem(PROFILE_KEY,JSON.stringify(current));else storage.removeItem(PROFILE_KEY);return true;}catch{return false;}}
export function profileLabel(p=getProfile()){p=normalizeProfile(p);return p.emoji+' '+p.name;}
