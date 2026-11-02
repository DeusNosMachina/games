// Cross-cutting rules: saves, nutrients, run lifecycle, frame-rate independence, idle failure, discharge.
// Game-specific mechanics live in game-<name>.cjs; ward combat in combat.cjs.
const {run,nodes,events,close,assert}=require('./harness.cjs');
run('let rng=1873;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
assert.equal(run('rooms.length'),6);assert.equal(run('Object.keys(games).length'),6);
run('begin();drawWorld();state.hp=5;player.x=381;player.y=463;updateWorld(.016)');assert.equal(run('state.food'),1);
run('loadRoom(0);player.x=381;player.y=463;updateWorld(.016);eat()');assert.equal(run('state.food'),1);
run('state.hp=3;eat()');assert.equal(run('state.hp'),4);assert.equal(run('state.food'),0);
console.log('PASS: nutrients and eating.');
// Simulation clocks cannot run through briefings, pause or results; rewards pay exactly once.
run('openMini(1);startMini()');assert.equal(run('mini.screen'),'briefing');run('updateMini(10)');assert.equal(run('mini.phaseTime'),0);
run('launchMini();updateMini(3.1)');assert.equal(run('mini.screen'),'intro');run('updateMini(.11)');assert.equal(run('mini.screen'),'play');
run('updateMini(.1);pauseMini()');const frozen=run('mini.phaseTime');run('updateMini(30)');assert.equal(run('mini.phaseTime'),frozen);run('pauseMini()');
run('finishMini(true)');const money=run('state.coins');run('miniAction("assist");leaveMini();updateMini(2)');assert.equal(run('mini.screen'),'outro');assert.equal(run('state.coins'),money);
run('updateMini(.21)');assert.equal(run('mini.screen'),'result');const paid=run('state.coins');run('resolveMiniResult(true)');assert.equal(run('state.coins'),paid);close();
console.log('PASS: paused briefings/countdowns and single reward payout.');
// Every game, tier and prescription has finite physics and fails when idle.
for(let d=0;d<3;d++)for(let id=0;id<6;id++)for(let tier=0;tier<3;tier++){
 run(`state.difficulty=${d};openMini(${id});mini.tier=${tier};startMini();drawMini();launchMini();updateMini(3.3)`);
 assert.ok(run('mini.limit')>=30,`${id}/${tier}/${d} limit`);
 for(let n=0;n<4000&&run('mini.screen')==='play';n++)run('updateMini(.1)');
 if(run('mini.screen')==='outro')run('updateMini(2.3)');
 assert.equal(run('mini.screen'),'result',`${id}/${tier}/${d}`);assert.equal(run('mini.win'),false,`${id}/${tier}/${d} idle won`);close();
}
console.log('PASS: all 54 game/tier/difficulty combinations reject idle play.');
// 30/60/120 Hz must produce the same movement distance.
let xs=[];for(const hz of [30,60,120]){run('state.started=true;loadRoom(0);player.x=430;player.y=480;player.vomit=0;player.dash=0;keys.clear();keys.add("d")');for(let i=0;i<hz;i++)run(`advanceSimulation(${1/hz})`);xs.push(run('player.x'));}assert.ok(Math.max(...xs)-Math.min(...xs)<.01);run('keys.clear()');
console.log('PASS: frame-rate-independent movement.');
// The sixth passport stamp participates in discharge, while mandatory IV cannot be skipped.
run('state.won=false;state.medals=rooms.map((_,i)=>i<5?[3,i===0?1:0,0]:[0,0,0]);checkDischarge()');assert.equal(run('state.won'),false);
run('state.medals[5][0]=1;checkDischarge()');assert.equal(run('state.won'),true);close();
run('loadRoom(0);state.hp=1;player.z=0;player.inv=0;player.shield=0;damage("blob",{x:600,y:450});updateWorld(1.31)');assert.equal(run('mini.forced'),true);run('leaveMini()');assert.equal(nodes.miniDialog.open,true);close();
console.log('PASS: six-game passport and mandatory recovery gates.');
