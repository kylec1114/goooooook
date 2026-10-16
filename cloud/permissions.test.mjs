import assert from 'node:assert/strict';
import worker from './worker.mjs';

const token='a'.repeat(64);
function env(role,expired=false){const runtime={room_code:'1234567',last_active:expired?0:Date.now(),player_hash:'another-player',lease_until:Date.now()+20000,queue_revision:0};return {DB:{prepare(q){return {bind(){return this;},async first(){if(q.includes('FROM sessions WHERE'))return {room_code:'1234567',role,expires_at:Date.now()+3600000};if(q.includes('FROM room_runtime'))return runtime;if(q.includes('FROM rooms'))return {room_code:'1234567'};if(q.includes('FROM player_links l JOIN'))return {ok:1};return null;},async run(){return {meta:{changes:1}};},async all(){return {results:[]};}};}}};}
async function check(path,role,status,expired=false,method='POST'){const req=new Request('https://example.test'+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify({action:'pause',currentItemId:'x',ids:[],revision:0})})});const result=await worker.fetch(req,env(role,expired));assert.equal(result.status,status,path+' '+role);}
await check('/api/control','guest',403);
await check('/api/queue/reorder','guest',403);
await check('/api/player','guest',403);
await check('/api/queue/other-song','guest',403,false,'DELETE');
await check('/api/queue/next','player',403);
await check('/api/state','owner',410,true,'GET');
await check('/api/state','owner',200,false,'GET');
console.log('7 API permission and expiry tests passed');
