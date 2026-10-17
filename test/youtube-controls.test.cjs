const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/room-screen.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
async function setup(){const nodes=new Map(),calls=[];let options;
 const el=()=>({hidden:false,textContent:'',value:100,append(){},replaceChildren(){},removeAttribute(k){delete this[k];},classList:{add(){},remove(){}}});
 const $=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
 const c=vm.createContext({$,console,Date,encodeURIComponent,setTimeout,clearTimeout,Promise,location:{origin:'https://example.test'},document:{activeElement:null,body:el(),createElement:el},switching:false,tvMode:false,identity:{},active:true,timer:null,epoch:0,pollBusy:false,ready:true,leader:true,current:'a',seen:'a',state:{paused:false},restart:null,poll(){},youtube:async()=>{},api:async()=>({roomToken:'token'}),note(){},next:async()=>calls.push('next'),YT:{Player:function(id,o){options=o;return {getPlayerState:()=>0,pauseVideo:()=>calls.push('pause')};}}});
 vm.runInContext(js.slice(js.indexOf('async function tv(){'),js.indexOf('async function next(){'))+js.slice(js.indexOf('function render(d){'),js.indexOf('function apply(d){')),c);await c.tv();
 return {c,nodes,calls,options,event:data=>options.events.onStateChange({data}),render:d=>c.render(d)};
}
test('official controls parameter hides native timeline and keeps origin',async()=>{const t=await setup();assert.equal(t.options.playerVars.controls,0);assert.equal(t.options.playerVars.origin,'https://example.test');});
test('referrer policy identifies the embedding site',()=>{assert.match(html,/<meta name="referrer" content="strict-origin-when-cross-origin">/);assert(!html.includes('content="no-referrer"'));});
test('website guidance is outside the video and explains paused position',()=>{assert.match(html,/<div id="player"><\/div><\/div><div class="card chrome"><p id="player-help">/);assert(html.includes('暫停會保留播放位置'));});
test('paused ENDED cannot advance',async()=>{const t=await setup();t.c.state.paused=true;t.event(0);assert(!t.calls.includes('next'));});
test('nonleader ENDED cannot advance',async()=>{const t=await setup();t.c.leader=false;t.event(0);assert(!t.calls.includes('next'));});
test('natural ENDED advances once in the fallback handler',async()=>{const t=await setup();t.event(0);t.event(0);assert.equal(t.calls.filter(x=>x==='next').length,1);});
test('PLAYING while room paused is immediately paused',async()=>{const t=await setup();t.c.state.paused=true;t.event(1);assert(t.calls.includes('pause'));assert.equal(t.c.seen,null);});
test('current video link uses validated YouTube id',async()=>{const t=await setup();t.render({roomCode:'1234567',role:'owner',volume:100,queue:[{videoId:'Q9yq9NXciR8',title:'Test'}]});assert.equal(t.nodes.get('youtube-link').href,'https://www.youtube.com/watch?v=Q9yq9NXciR8');assert.equal(t.nodes.get('youtube-link').hidden,false);});
test('invalid video id hides and removes external link',async()=>{const t=await setup();t.render({roomCode:'1234567',role:'owner',volume:100,queue:[{videoId:'javascript:bad',title:'Test'}]});assert.equal(t.nodes.get('youtube-link').hidden,true);assert.equal(t.nodes.get('youtube-link').href,undefined);});
