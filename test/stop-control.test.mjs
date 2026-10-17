import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {handleStop,STOP_SQL} from '../cloud/stop-service.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
function setup(role='owner',leader=false){const s={roomCode:'1234567',role,leader,queue:[{id:'a'}],paused:false,restartRevision:2};const statements=[];let changes=1;
 const previous={fetch:async()=>new Response(JSON.stringify(s))};
 const env={DB:{prepare(sql){const statement={sql,args:[],bind(...args){this.args=args;return this;}};statements.push(statement);return statement;},async batch(){if(changes){s.paused=true;s.restartRevision++;s.restartItem='a';}return [{meta:{changes}},{meta:{changes}}];}}};
 const run=(b={currentItemId:'a'},origin='https://site.test')=>handleStop(new Request('https://site.test/api/control',{method:'POST',headers:{Origin:origin,Authorization:'Bearer token'}}),env,{},previous,b);
 return {run,s,statements,setChanges:v=>changes=v};}
test('owner stops at head without clearing queue',async()=>{const t=setup();const r=await t.run();assert.equal(r.status,200);const s=await r.json();assert.equal(s.paused,true);assert.equal(s.restartRevision,3);assert.equal(s.queue.length,1);assert.equal(t.statements[0].sql,STOP_SQL);});
test('guest cannot stop',async()=>assert.equal((await setup('guest').run()).status,403));
test('active player may stop',async()=>assert.equal((await setup('player',true).run()).status,200));
test('standby player cannot stop',async()=>assert.equal((await setup('player',false).run()).status,403));
test('stale item cannot stop another song',async()=>assert.equal((await setup().run({currentItemId:'old'})).status,409));
test('cross-origin stop rejected',async()=>assert.equal((await setup().run(undefined,'https://other.test')).status,403));
test('lease or queue race is rejected',async()=>{const t=setup();t.setChanges(0);assert.equal((await t.run()).status,409);});

import fs from 'node:fs';import vm from 'node:vm';
const frontend=fs.readFileSync('public/stop-controls.mjs','utf8').replace(/^import .*;\n/,'');
function ui(){const elements=new Map(),calls=[];const el=()=>({disabled:false,append(b){elements.set(b.id,b);},after(){}});const host=el();const c=vm.createContext({document:{getElementById:()=>null,querySelector:()=>null,createElement:el},note(){},state:null,api:async()=>{throw Error('offline');}});c.window=c;c.document.getElementById=id=>id==='tvControls'?host:null;c.apply=d=>{c.state=d;calls.push(d);};vm.runInContext(frontend,c);return {c,calls,button:elements.get('stop-at-start')};}
test('TV stop button waits for an active player state',()=>{const t=ui();assert.equal(t.button.disabled,true);t.c.apply({queue:[{id:'a'}],leader:true});assert.equal(t.button.disabled,false);});
test('stale heartbeat cannot resume after confirmed stop',()=>{const t=ui();t.c.apply({queue:[{id:'a'}],leader:true,paused:true,sync:{commandRevision:4}});t.c.apply({queue:[{id:'a'}],leader:true,paused:false,sync:{commandRevision:3}});assert.equal(t.calls.length,1);assert.equal(t.c.state.paused,true);});
test('TV stop posts current id and applies acknowledged state',async()=>{const t=ui();t.c.apply({queue:[{id:'a'}],leader:true});let sent;t.c.api=async(path,data)=>{sent={path,data};return {queue:[{id:'a'}],leader:true,paused:true,restartRevision:3};};await t.button.onclick();assert.equal(sent.path,'/api/control');assert.equal(sent.data.action,'stop');assert.equal(sent.data.currentItemId,'a');assert.equal(t.c.state.paused,true);});
