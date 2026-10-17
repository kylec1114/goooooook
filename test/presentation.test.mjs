import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {presentation} from '../cloud/presentation-service.mjs';import {sufficientlyVisible,requestDisplayFullscreen} from '../public/tv-display-policy.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
function setup(role='owner',leader=true){const row={mode:'info',revision:0,fullscreen_request:'none',observed_json:null,reported_at:0,player_hash:null};let valid=true;
 const previous={fetch:async()=>new Response(JSON.stringify({role,leader,roomCode:'1234567'}))};const env={DB:{prepare(q){return {bind(...a){return {async run(){if(q.startsWith('UPDATE ktv_display SET mode')){row.mode=a[0]||row.mode;row.fullscreen_request=a[1];row.revision++;}if(q.startsWith('UPDATE ktv_display SET observed')){if(!valid||a[4]!==row.revision)return {meta:{changes:0}};row.observed_json=a[0];row.reported_at=a[1];row.player_hash=a[2];}return {meta:{changes:1}};},async first(){return q.includes('FROM room_runtime')?{player_hash:row.player_hash,lease_until:Date.now()+20000}:row;}};}};}}};
 const run=(b,ack=false,origin='https://site.test')=>presentation(new Request('https://site.test/api/tv/presentation'+(ack?'/ack':''),{method:b===undefined?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer token'},body:b===undefined?undefined:JSON.stringify(b)}),env,{},previous);
 return {run,row,revoke:()=>valid=false};}
test('default display is info with no fullscreen command',async()=>{const d=await (await setup().run()).json();assert.equal(d.mode,'info');assert.equal(d.fullscreenRequest,'none');assert.equal(d.observed,null);});
test('owner changes immersive layout without requesting browser fullscreen',async()=>{const d=await (await setup().run({action:'immersive'})).json();assert.equal(d.mode,'immersive');assert.equal(d.revision,1);assert.equal(d.fullscreenRequest,'none');});
test('owner fullscreen request is a request, not observed success',async()=>{const d=await (await setup().run({action:'enter_fullscreen'})).json();assert.equal(d.fullscreenRequest,'enter');assert.equal(d.observed,null);});
test('guest cannot read or command presentation',async()=>assert.equal((await setup('guest').run()).status,403));
test('player cannot issue owner display commands',async()=>assert.equal((await setup('player').run({action:'immersive'})).status,403));
test('standby TV cannot report display state',async()=>assert.equal((await setup('player',false).run({revision:0,mode:'info',fullscreen:false,needsGesture:false},true)).status,403));
test('owner cannot impersonate TV acknowledgement',async()=>assert.equal((await setup().run({revision:0,mode:'info',fullscreen:true,needsGesture:false},true)).status,403));
test('cross-origin writes rejected',async()=>assert.equal((await setup().run({action:'info'},false,'https://other.test')).status,403));
test('unknown commands rejected',async()=>assert.equal((await setup().run({action:'delete'})).status,400));
test('TV can report local-gesture requirement without claiming fullscreen',async()=>{const d=await (await setup('player').run({revision:0,mode:'info',fullscreen:false,needsGesture:true,error:'gesture required'},true)).json();assert.equal(d.observed.needsGesture,true);assert.equal(d.observed.fullscreen,false);});
test('stale or revoked TV acknowledgement rejected',async()=>{const t=setup('player');t.revoke();assert.equal((await t.run({revision:0,mode:'info',fullscreen:true,needsGesture:false},true)).status,409);});
test('malformed acknowledgement rejected',async()=>assert.equal((await setup('player').run({revision:0,mode:'info',fullscreen:'yes',needsGesture:false},true)).status,400));
const rect={left:0,top:0,right:100,bottom:100,width:100,height:100};
test('autoplay requires more than half the player visible',()=>{assert.equal(sufficientlyVisible(rect,100,50),false);assert.equal(sufficientlyVisible(rect,100,51),true);});
test('background tab cannot autoplay',()=>assert.equal(sufficientlyVisible(rect,100,100,true),false));
test('invalid player dimensions cannot autoplay',()=>assert.equal(sufficientlyVisible({...rect,width:0},100,100),false));
test('denied enter fullscreen remains a rejection',async()=>await assert.rejects(requestDisplayFullscreen({}, {requestFullscreen:async()=>{throw Error('gesture');}},'enter'),/gesture/));
test('remote exit invokes TV exitFullscreen',async()=>{let called=0;const doc={fullscreenElement:{},exitFullscreen:async()=>called++};await requestDisplayFullscreen(doc,{},'exit');assert.equal(called,1);});
test('already-fullscreen enter does not require a second gesture',async()=>assert.equal(await requestDisplayFullscreen({fullscreenElement:{}},{},'enter'),true));

import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('public/tv-compact.mjs','utf8');
function hold(visible){const calls=[],c=vm.createContext({visible,state:{roomCode:'1234567',queueRevision:5,sync:{commandRevision:5}},apply:d=>{calls.push(d);c.state=d;}});c.window=c;vm.runInContext(source.slice(source.indexOf('const apply=window.apply;'),source.indexOf('localButton.onclick=')),c);return {c,calls};}
test('visibility hold pauses locally but preserves true room desired state',()=>{const t=hold(false);t.c.apply({roomCode:'1234567',queueRevision:6,sync:{commandRevision:6},paused:false});assert.equal(t.calls[0].paused,true);assert.equal(t.c.state.paused,false);});
test('stale command cannot overwrite a newer stopped state',()=>{const t=hold(false);t.c.apply({roomCode:'1234567',queueRevision:5,sync:{commandRevision:4},paused:false});assert.equal(t.calls.length,0);});
test('stale queue snapshot cannot resurrect a previous song',()=>{const t=hold(true);t.c.apply({roomCode:'1234567',queueRevision:4,sync:{commandRevision:5},paused:false});assert.equal(t.calls.length,0);});
test('visible player receives unchanged desired state',()=>{const t=hold(true);t.c.apply({roomCode:'1234567',queueRevision:6,sync:{commandRevision:6},paused:false});assert.equal(t.calls[0].paused,false);});
test('standby TV cannot consume main TV presentation commands',async()=>assert.equal((await setup('player',false).run()).status,403));
