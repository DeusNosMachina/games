const {run,nodes,events,close,assert}=require('./harness.cjs');
run('let rng=1873;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
assert.equal(run('rooms.length'),6);
run('begin();drawWorld();state.hp=5;player.x=381;player.y=463;updateWorld(.016)');assert.equal(run('state.food'),1);
run('loadRoom(0);player.x=381;player.y=463;updateWorld(.016);eat()');assert.equal(run('state.food'),1);
run('state.hp=3;eat()');assert.equal(run('state.hp'),4);assert.equal(run('state.food'),0);
// Equipped attacks take genuinely different paths. Pillow damage lands after wind-up.
run('loadRoom(1);encounter.rest=0;player.x=500;player.y=420;player.attackCd=0;enemies=[makeEnemy(0,560,420)];equip(0);attack()');
assert.equal(run('enemies[0].hp'),3);run('updateWorld(.17)');assert.equal(run('enemies[0].hp'),2);
run('player.attackCd=0;equip(1);attack()');assert.equal(run('projectiles.at(-1).kind'),'bag');assert.equal(run('player.attackKind'),1);
run('player.attackCd=0;equip(2);attack()');assert.equal(run('projectiles.at(-1).kind'),'brick');assert.equal(run('player.attackKind'),2);
run('enemies=[makeEnemy(3,570,430)];hitEnemy(enemies[0]);enemies=enemies.filter(e=>e.hp>0)');assert.equal(run('enemies.length'),2);assert.ok(run('enemies.every(e=>e.small&&e.hp===2)'));
run('player.inv=0;player.shield=0;player.z=30;damage("blob",{x:600,y:420})');assert.equal(run('state.hp'),4);
run('player.z=0;damage("blob",{x:600,y:420})');assert.equal(run('state.hp'),3);assert.ok(run('player.vomit>0'));
run('player.vomit=0;player.jumpCd=0;jump()');assert.ok(run('player.vz')>0);for(let i=0;i<100;i++)run('updateCombat(.01)');assert.equal(run('player.z'),0);
run('enemies=[];encounter={wave:3,rest:0,complete:false};state.room=1;updateCombat(.01)');assert.ok(run('encounter.complete'));const paidWard=run('state.coins');run('updateCombat(.01)');assert.equal(run('state.coins'),paidWard);
console.log('PASS: nutrients, equipped weapon dispatch, delayed swings, multi-hit enemies, splitting, jumping, vomiting and ward completion.');
// Input actions and simulation clocks cannot run through briefings, pause or results.
run('openMini(2);startMini()');assert.equal(run('mini.screen'),'briefing');run('updateMini(10)');assert.equal(run('mini.phaseTime'),0);
run('launchMini();updateMini(3.1)');assert.equal(run('mini.screen'),'intro');run('updateMini(.11)');assert.equal(run('mini.screen'),'play');
run('arcadeDown({x:300,y:548});arcadeMove({x:200,y:598});arcadeUp()');assert.equal(run('mini.shot'),1);assert.ok(run('mini.queue')>0);
run('updateMini(.1);pauseMini()');const frozen=run('mini.phaseTime');run('updateMini(30)');assert.equal(run('mini.phaseTime'),frozen);run('pauseMini()');
run('finishMini(true)');const money=run('state.coins');run('miniAction("assist");leaveMini();updateMini(2)');assert.equal(run('mini.screen'),'outro');assert.equal(run('state.coins'),money);
run('updateMini(.21)');assert.equal(run('mini.screen'),'result');const paid=run('state.coins');run('resolveMiniResult(true)');assert.equal(run('state.coins'),paid);close();
// A cancelled or paused aim must never launch a volley.
run('openMini(2);startMini();launchMini();updateMini(3.3);arcadeDown({x:300,y:548});arcadeMove({x:200,y:598});arcadeUp(true)');assert.equal(run('mini.shot'),0);close();
// Magnet polarity changes force, and untouched drifting orbs cannot score by accident.
run('openMini(1);startMini();launchMini();updateMini(3.3);mini.orbs=[{id:1,x:300,y:300,vx:0,vy:0,kind:0,bad:false,touched:false,r:19,cool:0}];Object.assign(mini.magnet,{x:400,y:300,on:true,mode:1});updateMagnet(.02)');assert.ok(run('mini.orbs[0].vx')>0);
run('mini.orbs[0].vx=0;mini.magnet.mode=-1;updateMagnet(.02)');assert.ok(run('mini.orbs[0].vx')<0);close();
// Swipe helmets require two strokes; bombs never become successful cuts; blue splits.
run('openMini(4);startMini();launchMini();updateMini(3.3);mini.gels=[{id:1,x:300,y:250,r:27,hp:2,armor:true,stroke:-1,bomb:false}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeMove({x:250,y:250})');assert.equal(run('mini.gels[0].hp'),1);
run('arcadeUp();arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeUp()');assert.equal(run('mini.got'),1);
run('mini.gels=[{id:2,x:300,y:250,r:27,hp:1,split:true,stroke:-1,bomb:false,vx:0}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeUp()');assert.equal(run('mini.gels.filter(g=>!g.dead).length'),2);
run('mini.gels=[{id:3,x:300,y:250,r:28,hp:1,bomb:true,stroke:-1}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeUp()');assert.equal(run('mini.miss'),1);close();
// Runner requires the right move, not an invincible jump or a universal attack.
run('openMini(3);startMini();launchMini();updateMini(3.3);mini.rows=[{y:489,done:false,objects:[{lane:1,kind:"crate"}]}];mini.jump=35;updateRace(.02)');assert.equal(run('mini.miss'),0);
run('mini.rows=[{y:489,done:false,objects:[{lane:1,kind:"wall"}]}];updateRace(.02)');assert.equal(run('mini.miss'),1);close();
// Every tier and prescription has valid geometry, finite physics and an idle failure.
for(let d=0;d<3;d++)for(let id=1;id<6;id++)for(let tier=0;tier<3;tier++){
 run(`state.difficulty=${d};openMini(${id});mini.tier=${tier};startMini();drawMini();launchMini();updateMini(3.3)`);
 assert.ok(run('mini.limit')>=90);
 for(let n=0;n<2500&&run('mini.screen')==='play';n++)run('updateMini(.1)');
 if(run('mini.screen')==='outro')run('updateMini(2.3)');
 assert.equal(run('mini.screen'),'result',`${id}/${tier}/${d}`);assert.equal(run('mini.win'),false,`${id}/${tier}/${d} idle won`);close();
}
console.log('PASS: paused briefings/countdowns, single reward payout, aim cancellation, polarity, swipe armor/split/bomb rules, runner obstacle rules, all 45 idle tier/difficulty combinations.');
// 30/60/120 Hz must produce the same movement distance; touch pointers remain independent.
let xs=[];for(const hz of [30,60,120]){run('state.started=true;loadRoom(0);player.x=430;player.y=480;player.vomit=0;player.dash=0;keys.clear();keys.add("d")');for(let i=0;i<hz;i++)run(`advanceSimulation(${1/hz})`);xs.push(run('player.x'));}assert.ok(Math.max(...xs)-Math.min(...xs)<.01);run('keys.clear()');
run('openMini(0);startMini();launchMini();updateMini(3.3);mini.phase=2');
const holdButton={dataset:{action:'hold'},setPointerCapture:()=>{},classList:{add:()=>{}}};
nodes.miniControls.events.pointerdown({target:{closest:()=>holdButton},pointerId:3,preventDefault:()=>{}});nodes.miniControls.events.pointerup({pointerId:9});assert.equal(run('mini.held'),true);nodes.miniControls.events.pointerup({pointerId:3});assert.equal(run('mini.held'),false);close();
run('loadRoom(0);player.attackCd=0;player.vomit=0');events.keydown({key:'2',target:{},repeat:false,preventDefault:()=>{}});assert.equal(run('state.item'),1);events.keydown({key:' ',target:{},repeat:false,preventDefault:()=>{}});run('updateWorld(.01)');assert.equal(run('projectiles.at(-1).kind'),'bag');run('keys.clear()');
console.log('PASS: frame-rate-independent movement, multi-touch release, number-key equipment and Space dispatch.');

// Bedside shooting uses the center sight, consumes ammo, rewards headshots, and reloads.
run('openMini(5);startMini();launchMini();updateMini(3.3);mini.targets=[{id:1,x:850,y:268,hp:3,maxHp:3,kind:2,mode:"crawl",hit:0}];fireBlaster()');assert.equal(run('mini.targets[0].hp'),1);assert.equal(run('mini.ammo'),6);assert.equal(run('mini.headshots'),1);
run('mini.shotCd=0;mini.targets[0].x=1300;fireBlaster()');assert.equal(run('mini.targets[0].hp'),1);assert.equal(run('mini.ammo'),5);
run('reloadBlaster();mini.targets=[];updateMini(1.6)');assert.equal(run('mini.ammo'),7);
run('mini.targets=[{id:2,x:850,y:270,hp:1,kind:0,mode:"leap",leap:.95,leapDuration:1,stun:0,hit:0}];updateShooter(.1)');assert.equal(run('mini.miss'),1);
run('mini.targets=[{id:3,x:850,y:270,hp:1,kind:0,mode:"wind",wind:.2,stun:0,hit:0}];miniAction("assist");updateShooter(.3)');assert.equal(run('mini.targets[0].mode'),'wind');assert.ok(run('mini.targets[0].stun')>0);close();
console.log('PASS: sight hit testing, misses, headshots, magazines, reload, camera leaps and flashlight stun.');
// The sixth passport stamp participates in discharge, while mandatory IV cannot be skipped.
run('state.won=false;state.medals=rooms.map((_,i)=>i<5?[3,i===0?1:0,0]:[0,0,0]);checkDischarge()');assert.equal(run('state.won'),false);
run('state.medals[5][0]=1;checkDischarge()');assert.equal(run('state.won'),true);close();
run('loadRoom(0);state.hp=1;player.z=0;player.inv=0;player.shield=0;damage("blob",{x:600,y:450});updateWorld(1.31)');assert.equal(run('mini.forced'),true);run('leaveMini()');assert.equal(nodes.miniDialog.open,true);close();
console.log('PASS: six-game passport and mandatory recovery gates.');
