const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const noop=()=>{};let nodes={},events={},store={};
const ctx=new Proxy({createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>{t[k]=v;return true}});
function node(id){return nodes[id]??={id,open:false,textContent:'',innerHTML:'',value:'',width:1000,height:625,style:{},dataset:{},events:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},setAttribute:noop,getContext:()=>ctx,querySelector:()=>node(id+'child'),addEventListener(type,fn){this.events[type]=fn},getBoundingClientRect:()=>({width:1000,height:625,left:0,top:0}),showModal(){this.open=true},close(){this.open=false;this.events.close?.()},focus:noop,scrollIntoView:noop,setPointerCapture:noop};}
const dialogs=[...html.matchAll(/<dialog id="([^"]+)"/g)].map(m=>node(m[1]));
const items=[0,1,2].map(i=>({...node('item'+i),dataset:{item:String(i)}}));
let cacheCount=0;const doc={createElement:()=>node("cache"+(cacheCount++)),getElementById:node,body:node('body'),hidden:false,addEventListener:noop,querySelectorAll:s=>s==='dialog'?dialogs:s==='dialog[open]'?dialogs.filter(d=>d.open):s==='[data-item]'?items:[]};
const box={document:doc,window:{addEventListener:(t,f)=>events[t]=f},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},requestAnimationFrame:noop,HTMLInputElement:class{},Math,console};vm.createContext(box);vm.runInContext(script,box);const run=s=>vm.runInContext(s,box);const close=()=>run('mini.open=false;mini.screen="lobby";for(const d of $$("dialog"))d.close();state.paused=false;');
assert.equal(run('rooms.length'),5);assert.equal(run('roomProps.length'),5);assert.equal(run('cfg().name'),'Questionable Decisions');
run('begin();drawWorld()');assert.equal(run('enemies.length'),0);assert.equal(run('collides(160,220)'),true);assert.equal(run('collides(505,470)'),false);
// Nutrients can be collected only once, capped at 3, and cannot be wasted at full health.
run('player.x=381;player.y=463;updateWorld(.016)');assert.equal(run('state.food'),1);run('loadRoom(0);player.x=381;player.y=463;updateWorld(.016)');assert.equal(run('state.food'),1);run('eat()');assert.equal(run('state.food'),1);run('state.hp=3;eat()');assert.equal(run('state.hp'),4);assert.equal(run('state.food'),0);
// Directional attacks, ranged deflections, invulnerability and visible vomiting.
run('loadRoom(1);player.x=500;player.y=420;enemies=[{id:"test",x:560,y:420,hp:2,hit:0,wind:0,type:0}];attack()');assert.equal(run('enemies[0].hp'),1);run('player.attackCd=0;enemies[0].hit=0;enemies[0].x=player.x+60;attack()');assert.equal(run('enemies.length'),0);const coinsAfterKill=run('state.coins');run('loadRoom(1);player.inv=0;player.shield=0;damage("blob",{x:600,y:400})');assert.equal(run('player.vomit'),1.15);assert.equal(run('puddles.length'),1);assert.equal(run('state.hp'),3);run('damage("blob",{x:600,y:400})');assert.equal(run('state.hp'),3);
run('player.attackCd=0;player.vomit=0;projectiles=[{x:player.x+30,y:player.y-40,vx:-100,vy:0,life:4,friendly:false}];attack()');assert.equal(run('projectiles[0].friendly'),true);
// Mandatory recovery waits for the vomit animation, then cannot be closed while unresolved.
run('player.inv=0;state.hp=1;damage("blob",{x:600,y:400})');assert.equal(run('mini.open'),false);run('updateWorld(1.31)');assert.equal(run('mini.forced'),true);run('leaveMini()');assert.equal(nodes.miniDialog.open,true);close();
// Rewards only advance stars when a personal best improves; replay coins are still earned.
run('state.medals=Array.from({length:5},()=>[0,0,0]);state.coins=0');assert.equal(run('grantReward(0,0,2,80,1).delta'),2);assert.equal(run('grantReward(0,0,1,60,1).delta'),0);assert.equal(run('stars()'),2);assert.equal(run('grantReward(0,0,3,95,1).delta'),1);assert.equal(run('stars()'),3);assert.ok(run('state.coins')>0);
// Perfect inputs must beat every game/tier/prescription/approach without hidden shortcuts.
run(`function driveTest(id,tier,difficulty,approach=0){
 state.difficulty=difficulty;openMini(id);mini.tier=tier;mini.approach=approach;startMini();let n=0,briefings=0;
 while(['briefing','intro','play','outro'].includes(mini.screen)&&n++<40000){
  if(mini.screen==='briefing'){briefings++;launchMini()}
  if(mini.screen==='play'){
   if(id===0){if(mini.phase===0&&Math.abs(mini.pos-mini.target)<.006)miniAction('tap');
    else if(mini.phase===1){let d=mini.drops.filter(d=>!d.done).sort((a,b)=>b.y-a.y)[0];if(d){if(d.bad){if(mini.lane===d.lane)miniAction('lane'+((d.lane+1)%3))}else if(d.kind===mini.recipe)miniAction('lane'+d.lane)}}
    else if(mini.phase===2)mini.held=mini.pressure+mini.velocity*.16<mini.pressureTarget;
   }
   if(id===1){mini.held=mini.cycle<mini.green-.03;if(mini.scan==='warn'&&mini.velocity>0)miniAction('brake')}
   if(id===2&&mini.mode==='input')miniAction('pad'+mini.answer[mini.input]);
   if(id===3){let row=mini.rows.find(r=>!r.done);if(row)mini.lane=row.safe}
   if(id===4&&mini.reveal<=0){if(mini.probe<0){let target=mini.targets.find(x=>!mini.found.includes(x));if(target!==undefined)miniAction('cell'+target)}else if(Math.abs(mini.lockPos-mini.lockTarget)<.006)miniAction('tag')}
  }
  updateMini(.016);
 }
 const result={id,tier,difficulty,approach,win:mini.win,miss:mini.miss,time:mini.total,grade:mini.grade,phase:mini.phase,briefings,score:mini.score};
 mini.open=false;$("miniDialog").close();return result;
}`);
let results=[];for(let d=0;d<3;d++)for(let id=0;id<5;id++)for(let tier=0;tier<3;tier++)for(let a=0;a<2;a++){
 const result=run(`driveTest(${id},${tier},${d},${a})`);results.push(result);assert.equal(result.win,true,JSON.stringify(result));assert.ok(result.score>0);assert.ok(result.briefings>=3);
}
// Idle play never awards a medal, including runner survival without token quotas.
for(let id=0;id<5;id++){
 run(`openMini(${id});startMini();launchMini();updateMini(INTRO_SECONDS);for(let i=0;i<50000&&mini.screen==='play';i++)updateMini(.016);updateMini(OUTRO_SECONDS)`);
 assert.equal(run('mini.win'),false,'Idle game '+id+' must fail');close();
}
// Wrong inputs, pressure extremes, scan momentum and traffic hazards cause real penalties.
run('openMini(0,true);startMini();launchMini();updateMini(INTRO_SECONDS);for(let i=0;i<mini.rules.misses;i++){mini.beatLock=0;mini.pos=0;ivTap()}updateMini(OUTRO_SECONDS)');assert.equal(run('mini.win'),false);assert.equal(run('gore.length'),190);close();
run('openMini(2);startMini();launchMini();updateMini(INTRO_SECONDS);mini.mode="input";mini.inputLock=0;memoryTap((mini.answer[0]+1)%4)');assert.equal(run('mini.miss'),1);assert.equal(run('mini.screen'),'briefing');close();
run('openMini(4);startMini();launchMini();updateMini(INTRO_SECONDS);mini.reveal=0;echoTap([0,1,2,3,4,5,6,7,8].find(n=>!mini.targets.includes(n)))');assert.equal(run('mini.miss'),1);close();
run('openMini(1);startMini();launchMini();updateMini(INTRO_SECONDS);mini.cycle=mini.green+mini.warning;mini.velocity=60;mini.held=true;updateMini(.016)');assert.equal(run('mini.miss'),1);close();
run('openMini(3);startMini();launchMini();updateMini(INTRO_SECONDS);mini.rows=[{z:.909,done:false,safe:0,blocked:[1,2],foam:1}];mini.cartX=400;mini.lane=1;miniAction("swat");updateMini(.03)');assert.equal(run('mini.tokens'),3);assert.equal(run('mini.miss'),0);close();
run('openMini(3);startMini();launchMini();updateMini(INTRO_SECONDS);mini.rows=[{z:.909,done:false,safe:0,blocked:[1,2],foam:2}];mini.cartX=400;mini.lane=1;miniAction("swat");updateMini(.03)');assert.equal(run('mini.tokens'),0);assert.equal(run('mini.miss'),1);close();
// Assists have a run-wide budget and a visible scoring cost; Show-off has none.
run('openMini(0);startMini();launchMini();updateMini(INTRO_SECONDS);miniAction("assist");miniAction("assist");miniAction("assist")');assert.equal(run('mini.helps'),0);assert.equal(run('mini.helpUsed'),2);assert.equal(run('mini.quality'),90);close();
run('openMini(0);mini.approach=1;startMini();launchMini();updateMini(INTRO_SECONDS);miniAction("assist")');assert.equal(run('mini.helpUsed'),0);assert.equal(run('mini.rules.coins'),run('cfg().coins*1.25'));close();
// Transform rules use a fresh pattern and enforce their actual answers.
run('openMini(2);mini.tier=2;startMini();mini.round=2;memoryRound(true)');assert.equal(run('mini.transform'),'mirror');assert.deepEqual(Array.from(run('mini.answer')),Array.from(run('mini.sequence.map(x=>3-x)')));close();
run('openMini(2);mini.tier=1;startMini();mini.round=1;memoryRound(true)');assert.equal(run('mini.transform'),'reverse');assert.deepEqual(Array.from(run('mini.answer')),Array.from(run('[...mini.sequence].reverse()')));close();
run('openMini(3);startMini();launchMini();updateMini(INTRO_SECONDS);mini.paused=true;updateMini(10)');assert.equal(run('mini.total'),0);close();
// All three discharge conditions are enforced.
run('state.won=false;state.medals=[[3,3,3],[3,0,0],[0,0,0],[0,0,0],[0,0,0]];checkDischarge()');assert.equal(run('state.won'),false);run('state.medals=[[3,0,0],[3,0,0],[3,0,0],[3,0,0],[3,0,0]];checkDischarge()');assert.equal(run('state.won'),false);run('state.medals[0][1]=1;checkDischarge()');assert.equal(run('state.won'),true);close();
for(let id=0;id<5;id++)run(`loadRoom(${id});canvas.width=700;drawWorld();canvas.width=1000;drawWorld()`);
assert.ok(!/<script[^>]+src=|<link[^>]+href="https?:|<img[^>]+src="https?:/.test(html));
console.log('PASS: 90 game/tier/difficulty/approach combinations; world combat, recovery, limited health, rewards and discharge; no idle wins; skill actions, penalties, transforms and assist budgets.');
close();run('state.difficulty=1;openMini(0);startMini()');
assert.equal(run('mini.screen'),'briefing');run('updateMini(30);miniAction("tap")');assert.equal(run('mini.phaseTime'),0);assert.equal(run('mini.miss'),0);
run('launchMini();updateMini(2.9)');assert.equal(run('mini.screen'),'intro');assert.equal(run('mini.phaseTime'),0);run('updateMini(.31)');assert.equal(run('mini.screen'),'play');
run('mini.good=mini.required-1;mini.pos=mini.target;mini.beatLock=0;ivTap()');assert.equal(run('mini.phase'),1);assert.equal(run('mini.screen'),'briefing');run('updateMini(30)');assert.equal(run('mini.spawned'),0);assert.equal(run('mini.phaseTime'),0);
run('launchMini();updateMini(INTRO_SECONDS);mini.phase=2;mini.pressure=.55;mini.stable=mini.need=14;mini.precision=[1,1,1,1];mini.phaseTime=25;finishMini(true)');assert.equal(run('mini.screen'),'outro');const money=run('state.coins');run('miniAction("tap");leaveMini();updateMini(2)');assert.equal(run('mini.screen'),'outro');assert.equal(run('state.coins'),money);run('updateMini(.21)');assert.equal(run('mini.screen'),'result');const paid=run('state.coins');run('updateMini(2);resolveMiniResult(true)');assert.equal(run('state.coins'),paid);close();
let xs=[];for(const hz of [30,60,120]){run('state.started=true;loadRoom(0);player.x=430;player.y=480;player.vomit=0;player.dash=0;keys.clear();keys.add("d")');for(let i=0;i<hz;i++)run(`advanceSimulation(${1/hz})`);xs.push(run('player.x'));}assert.ok(Math.max(...xs)-Math.min(...xs)<.01,JSON.stringify(xs));run('keys.clear();viewport.w=700;drawWorld();viewport.w=1000;drawWorld()');
for(let id=0;id<5;id++){run(`openMini(${id});startMini();drawMini()`);close()}
console.log('PASS: manual stage briefings, 3.2s countdown, 2.2s finish, frozen clocks, one-time rewards, rendering and frame-rate-independent movement.');
console.log('Perfect-input active play ranges (seconds; briefings/countdowns excluded):',JSON.stringify([0,1,2,3,4].map(id=>{const times=results.filter(r=>r.id===id).map(r=>r.time);return {game:id,min:Math.round(Math.min(...times)),max:Math.round(Math.max(...times))}})));
// Keyboard bindings and multi-touch must reach the same skill actions.
run('openMini(3);startMini();launchMini();updateMini(INTRO_SECONDS)');events.keydown({key:' ',target:{},repeat:false,preventDefault:noop});assert.ok(run('mini.swat')>0);events.keydown({key:'e',target:{},repeat:false,preventDefault:noop});assert.equal(run('mini.helps'),1);close();
run('openMini(1);startMini();launchMini();updateMini(INTRO_SECONDS);mini.velocity=60');events.keydown({key:'b',target:{},repeat:false,preventDefault:noop});assert.equal(run('mini.velocity'),0);
const holdButton={dataset:{action:'hold'},setPointerCapture:noop,classList:{add:noop}};
nodes.miniControls.events.pointerdown({target:{closest:()=>holdButton},pointerId:3,preventDefault:noop});assert.equal(run('mini.held'),true);
nodes.miniControls.events.pointerup({pointerId:9});assert.equal(run('mini.held'),true,'A second finger must not release the held movement control');
nodes.miniControls.events.pointerup({pointerId:3});assert.equal(run('mini.held'),false);close();
console.log('PASS: keyboard skill bindings and independent multi-touch hold/release.');
