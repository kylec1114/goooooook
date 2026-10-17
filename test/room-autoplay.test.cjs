const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/room-upgrade.mjs','utf8').replace(/^import .*;\n/,'');
function setup(mobile=false){
 const elements=new Map(),calls=[],requests=[];let ps=-1,video='',nextResponse,fail=false;
 function el(){return {hidden:false,disabled:false,textContent:'',append(){},after(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){}},querySelector(){return el();}};}
 for(const id of ['player','connection','status','start','next','full','clean','reveal','session'])elements.set(id,el());
 const c=vm.createContext({console,Promise,Error,Map,URLSearchParams,setTimeout,clearTimeout,matchMedia:()=>({matches:mobile}),location:{origin:'https://example.test',replace:u=>calls.push(['redirect',u])},document:{getElementById:id=>elements.get(id)||null,createElement:el,addEventListener(){},querySelector:el,body:{classList:{add(){},remove(){}}}},matchesTarget:()=>false});
 c.window=c;c.addEventListener=()=>{};c.note=t=>elements.get('status').textContent=t;
 c.render=d=>c.state=d;
 c.api=async(path,data)=>{requests.push({path,data});if(fail)throw Error('offline');return nextResponse||c.state;};
 const player={addEventListener:(n,f)=>calls.push(['listener',n,f]),setOption(){},setVolume(){},getVolume:()=>100,getCurrentTime:()=>10,getDuration:()=>100,getVideoData:()=>({video_id:video}),getPlayerState:()=>ps,loadVideoById:id=>{video=id;ps=3;calls.push(['load',id]);},cueVideoById:id=>{video=id;ps=5;calls.push(['cue',id]);},playVideo:()=>calls.push(['play']),pauseVideo:()=>{ps=2;calls.push(['pause']);},stopVideo:()=>{ps=-1;calls.push(['stop']);},seekTo:t=>calls.push(['seek',t])};
 Object.assign(c,{player,ready:true,leader:false,current:null,seen:null,restart:null,advancing:false,epoch:1,active:true,tvMode:true,state:null});
 vm.runInContext(source,c);
 const songA={id:'a',videoId:'abcdefghijk',title:'A'},songB={id:'b',videoId:'lmnopqrstuv',title:'B'};
 function apply(extra={}){c.apply({queue:[songA,songB],leader:true,paused:false,volume:100,restartRevision:0,...extra});}
 async function event(n){ps=n;if(n===1)c.seen=c.current;return c.goKtvStateChange({data:n,target:player});}
 return {c,calls,requests,elements,songA,songB,apply,event,setVideo:id=>video=id,response:d=>nextResponse=d,fail:()=>fail=true,status:()=>c.goKtvPlaybackStatus()};
}
test('initial song attempts autoplay without an artificial authorization gate',()=>{const t=setup();t.apply();assert(t.calls.some(x=>x[0]==='load'));assert(t.calls.findIndex(x=>x[1]==='onAutoplayBlocked')<t.calls.findIndex(x=>x[0]==='load'));});
test('paused room cues instead of loading/playing a new song',()=>{const t=setup();t.apply({paused:true});assert(t.calls.some(x=>x[0]==='cue'));assert(!t.calls.some(x=>['load','play'].includes(x[0])));});
test('blocked event survives polling without repeated play or load',()=>{const t=setup();t.apply();t.c.goKtvBlocked();t.calls.length=0;t.apply();assert(t.status().blocked);assert(!t.calls.some(x=>['load','play'].includes(x[0])));});
test('blocked state persists across queue changes until a local gesture',()=>{const t=setup();t.apply();t.c.goKtvBlocked();t.calls.length=0;t.apply({queue:[t.songB]});assert(t.calls.some(x=>x[0]==='cue'));assert(!t.calls.some(x=>['load','play'].includes(x[0])));});
test('local gesture retries play and actual PLAYING clears blocked',async()=>{const t=setup();t.apply();t.c.goKtvBlocked();t.elements.get('start').onclick();assert(t.calls.some(x=>x[0]==='play'));await t.event(1);assert.equal(t.status().blocked,false);assert.equal(t.status().playedItem,'a');});
test('native PLAYING disables the legacy ended path',async()=>{const t=setup();t.apply();await t.event(1);assert.equal(t.c.seen,null);});
test('ended sends exactly one request with finished id and loads next',async()=>{const t=setup();t.apply();await t.event(1);t.response({...t.c.state,queue:[t.songB]});await t.event(0);await t.event(0);assert.equal(t.requests.length,1);assert.equal(t.requests[0].data.currentItemId,'a');assert(t.calls.some(x=>x[0]==='load'&&x[1]===t.songB.videoId));});
test('ended without observed playing cannot skip a song',async()=>{const t=setup();t.apply();await t.event(0);assert.equal(t.requests.length,0);});
test('stale video ended event cannot skip current queue head',async()=>{const t=setup();t.apply();await t.event(1);t.setVideo(t.songB.videoId);await t.event(0);assert.equal(t.requests.length,0);});
test('lost lease pauses and prevents ended advance',async()=>{const t=setup();t.apply();await t.event(1);t.apply({leader:false});await t.event(0);assert.equal(t.requests.length,0);assert(t.calls.some(x=>x[0]==='pause'));});
test('failed advance is not blindly retried on duplicate ended',async()=>{const t=setup();t.apply();await t.event(1);t.fail();await t.event(0);await t.event(0);assert.equal(t.requests.length,1);assert.equal(t.c.advancing,false);});
test('empty queue stops playback',()=>{const t=setup();t.apply({queue:[]});assert(t.calls.some(x=>x[0]==='stop'));assert.equal(t.c.current,null);});
test('heartbeat includes real blocked state',async()=>{const t=setup();t.apply();t.c.goKtvBlocked();await t.c.api('/api/player/heartbeat',{});assert.equal(t.requests[0].data.report.blocked,true);});
test('mobile TV URL redirects to remote without constructing upgrade controls',()=>{const t=setup(true);assert(t.calls.some(x=>x[0]==='redirect'&&x[1]==='/studio.html?view=remote'));assert.equal(t.c.goKtvPlaybackStatus,undefined);});
