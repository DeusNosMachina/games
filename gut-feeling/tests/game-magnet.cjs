// Polarity Panic rules: force direction, untouched orbs, chains, thieves, overheat, surge, port swaps,
// repulsor walls, gunk splitting, side entries, the vent burp, and level 1 being gentler than level 3.
const { run, close, assert } = require('./harness.cjs');
run('let rng=4242;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
// Starts a run at a level and holds spawns still so a scenario only sees what it places.
const begin = tier => {
  close();
  run(
    `openMini(1);mini.tier=${tier};startMini();launchMini();updateMini(3.3);` +
      'mini.orbs=[];mini.magnetThieves=[];mini.magnetPickups=[];mini.magnetThiefT=99;mini.magnetPickT=99;' +
      'Object.assign(mini.magnet,{x:300,y:590,on:false,mode:1})'
  );
};
run(`function orb(o){const b={id:mini.orbSerial++,x:300,y:300,vx:0,vy:0,kind:0,bad:false,touched:true,r:19,cool:0,small:false,entering:false,held:null,trail:[],trailT:0,...o};mini.orbs.push(b);return b}`);
run('function steps(n,dt=.02){for(let i=0;i<n;i++)updateMagnet(dt)}');

// Polarity flips the force direction.
begin(0);
run('orb({x:300,y:300,touched:false});Object.assign(mini.magnet,{x:400,y:300,on:true,mode:1});updateMagnet(.02)');
assert.ok(run('mini.orbs[0].vx') > 0, 'pull moves the orb toward the magnet');
run('mini.orbs[0].vx=0;mini.magnet.mode=-1;updateMagnet(.02)');
assert.ok(run('mini.orbs[0].vx') < 0, 'push moves the orb away');
// An orb nobody touched cannot score by drifting into a port.
begin(0);
run('orb({x:135,y:100,vy:-200,touched:false});steps(5)');
assert.equal(run('mini.got'), 0);
console.log('PASS: polarity and untouched drift.');

// Chain sorting: a correct sort within 2 s doubles, triples...; a gap or a wrong color resets it.
begin(0);
run('orb({x:135,y:98,vy:-200});var s0=mini.score;steps(1);var d1=mini.score-s0');
assert.equal(run('mini.got'), 1);
assert.equal(run('mini.magnetChain'), 1);
run('orb({x:465,y:98,kind:1,vy:-200});var s1=mini.score;steps(1);var d2=mini.score-s1');
assert.equal(run('mini.magnetChain'), 2);
assert.equal(run('d2'), run('d1') * 2, 'second sort in the window scores double');
run('steps(110)');
assert.equal(run('mini.magnetChain'), 0, 'chain lapses after 2 seconds');
run('orb({x:135,y:98,vy:-200});steps(1);orb({x:465,y:98,kind:0,vy:-200});steps(1)');
assert.equal(run('mini.magnetChain'), 0, 'wrong color breaks the chain');
assert.equal(run('mini.sortErrors'), 1);
assert.equal(run('mini.got'), 3);
console.log('PASS: chain multiplier and wrong-color reset.');

// Thieves grab the nearest orb, drag it to the vent, drop it when zapped, and get flushed when dazed.
begin(1);
run('var loot=orb({x:300,y:400,touched:false});magnetSpawnThief();var th=mini.magnetThieves[0];Object.assign(th,{x:340,y:400,entering:false});steps(60)');
assert.equal(run('th.state'), 'drag', 'thief grabbed the orb');
assert.equal(run('loot.held'), run('th.id'));
run('Object.assign(mini.magnet,{x:th.x,y:th.y-40,on:true,mode:1});steps(25)');
assert.equal(run('th.state'), 'stun', 'a held field stuns the thief');
assert.equal(run('loot.held'), null, 'the stunned thief drops the orb');
run('mini.magnet.on=false;Object.assign(th,{x:300,y:556,vx:0,vy:60});var s2=mini.score;steps(2)');
assert.equal(run('mini.magnetFlushed'), 1);
assert.equal(run('mini.magnetThieves.length'), 0);
assert.ok(run('mini.score-s2') >= 300, 'flushing a thief pays a bonus');
// A thief that reaches the vent while carrying an orb steals it and costs an oops.
run('var loot2=orb({x:300,y:520});magnetSpawnThief();var t2=mini.magnetThieves[0];Object.assign(t2,{x:300,y:540,entering:false,state:"drag",target:loot2.id});loot2.held=t2.id;steps(30)');
assert.equal(run('mini.magnetStolen'), 1);
assert.equal(run('mini.miss'), 1);
assert.equal(run('mini.orbs.some(o=>o.id===loot2.id)'), false);
console.log('PASS: thief grab, stun, drop, flush and steal.');

// Overheat: over ~3 s of held force locks the magnet out until the player lets go.
begin(1);
run('arcadeDown({x:300,y:300});steps(180)');
assert.equal(run('mini.magnetHot'), true, 'held force overheats');
assert.equal(run('magnetPower()'), false);
run('var hotOrb=orb({x:380,y:300,touched:false});steps(1)');
assert.ok(Math.abs(run('hotOrb.vx')) < 1, 'an overheated magnet applies no force');
run('steps(100)');
assert.equal(run('mini.magnetHot'), true, 'holding does not cool');
run('arcadeUp();steps(60)');
assert.equal(run('mini.magnetHot'), false, 'letting go cools it');
begin(0);
run('arcadeDown({x:300,y:300});steps(500);arcadeUp()');
assert.equal(run('mini.magnetHeat'), 0, 'level 1 never overheats');
console.log('PASS: overheat lockout and cooling.');

// Surge pickup doubles reach for 5 seconds.
begin(1);
assert.equal(run('magnetRadius()'), 170);
run('var far=orb({x:300,y:550,touched:false});mini.magnetPickups=[{x:300,y:300,life:9}];Object.assign(mini.magnet,{x:300,y:300,on:true});steps(2)');
assert.equal(run('mini.magnetPickups.length'), 0);
assert.ok(run('mini.magnetSurge') > 4.9);
assert.equal(run('magnetRadius()'), 340);
assert.equal(run('far.touched'), true, 'surge reaches an orb 250 px away');
run('mini.magnet.on=false;steps(260)');
assert.equal(run('magnetRadius()'), 170, 'surge wears off');
console.log('PASS: surge pickup.');

// Level 3 swaps the ports with a 2 second warning; level 2 never does.
begin(2);
run('mini.phaseTime=43.2;steps(1)');
assert.equal(run('mini.magnetSwapWarned'), true);
assert.equal(run('mini.magnetSwap'), false, 'the warning comes first');
assert.ok(run('mini.flashText').includes('SWAP'));
run('mini.phaseTime=45;steps(1)');
assert.equal(run('mini.magnetSwap'), true);
assert.equal(run('magnetPortKind(0)'), 1, 'gold now goes left');
run('orb({x:465,y:98,kind:0,vy:-200});steps(1)');
assert.equal(run('mini.got'), 1, 'mint scores in the right port after a swap');
assert.equal(run('mini.magnetSwapAt'), 75);
begin(1);
run('mini.phaseTime=80;steps(1)');
assert.equal(run('mini.magnetSwap'), false);
console.log('PASS: port swap warning and swap.');

// Repulsor walls and the patrol barrier switch on from shift 2 of level 2 and bounce orbs.
begin(1);
assert.equal(run('magnetBarrierOn()'), false);
run('mini.shift=1');
assert.equal(run('magnetBarrierOn()'), true);
run('var w=orb({x:80,y:290,vy:-300,touched:false});steps(10)');
assert.ok(run('w.vy') > 0, 'the repulsor wall bounced the orb');
assert.ok(run('w.y') > 240);
begin(0);
run('mini.shift=2');
assert.equal(run('magnetBarrierOn()'), false, 'no walls on level 1');
console.log('PASS: repulsor walls and barrier.');

// Shoving big gunk too hard at close range splits it on levels 2 and 3, never on level 1.
begin(1);
run('orb({x:300,y:300,bad:true,r:20,vy:380});Object.assign(mini.magnet,{x:300,y:230,on:true,mode:-1});steps(1)');
assert.equal(run('mini.magnetSplits'), 1);
assert.equal(run('mini.orbs.filter(o=>o.bad&&o.small&&o.r===13).length'), 2);
begin(0);
run('orb({x:300,y:300,bad:true,r:20,vy:380});Object.assign(mini.magnet,{x:300,y:230,on:true,mode:-1});steps(1)');
assert.equal(run('mini.magnetSplits'), 0);
console.log('PASS: gunk splitting.');

// Orbs enter from the edges on levels 2 and 3; level 1 keeps its gentle grid.
begin(1);
run('var e=spawnOrb()');
assert.equal(run('e.entering'), true);
assert.ok(run('e.x<0||e.x>600||e.y>600'), 'enters from off screen');
assert.ok(run('Math.hypot(e.vx,e.vy)') > 100, 'enters with velocity');
run('steps(150)');
assert.equal(run('e.entering'), false, 'it makes it on board');
begin(0);
run('var e0=spawnOrb()');
assert.equal(run('e0.entering'), false);
assert.ok(run('e0.x>30&&e0.x<570&&e0.y<564'));
// The vent burps good orbs aside so it never clogs.
run('var burp=orb({x:310,y:563,vy:200});steps(1)');
assert.ok(run('burp.vx') > 100);
console.log('PASS: side entries and vent burp.');

// Level 1 is gentler than level 3 by rule and in practice.
const L = run('MAGNET_LEVELS');
assert.equal(L[0].thieves.reduce((a, b) => a + b), 0);
assert.ok(L[2].thieves.reduce((a, b) => a + b) > 0);
assert.equal(L[0].heat, 0);
assert.ok(L[2].heat > 0 && L[2].heat <= 3.5);
assert.ok(L[0].gate > L[2].gate, 'level 3 ports are tighter');
assert.ok(!L[0].swap && L[2].swap && !L[0].split && L[2].split);
assert.ok(L[0].goal / L[0].limit < L[2].goal / L[2].limit, 'level 1 asks for fewer sorts per second');
for (const tier of [0, 2]) {
  close();
  run(`openMini(1);mini.tier=${tier};startMini();launchMini();updateMini(3.3);for(let i=0;i<1500;i++)updateMini(.016)`);
  const seen = run('mini.magnetThieves.length+mini.magnetStolen');
  if (tier === 0) assert.equal(seen, 0, 'no thieves on level 1');
  else assert.ok(seen > 0, 'level 3 sends thieves within 24 s');
}
console.log('PASS: level 1 is gentler than level 3.');

// Every new piece of art draws: thieves in each state, pickups, walls, swap warning, hot magnet, hints.
begin(2);
run('mini.shift=2;mini.magnetSwapWarned=true;mini.phaseTime=44;mini.magnetHot=true;mini.magnetHeat=1;mini.magnetSurge=2;mini.magnetChain=3;mini.magnetChainT=1');
run('for(const s of ["seek","grab","drag","stun"]){magnetSpawnThief();Object.assign(mini.magnetThieves.at(-1),{state:s,entering:false,x:200,y:400,t:.2,zap:.1})}');
run('var g1=orb({x:220,y:380});mini.magnetThieves[1].target=g1.id;g1.held=mini.magnetThieves[2].id;orb({bad:true,small:true,r:13});mini.magnetPickups=[{x:300,y:300,life:4}];magnetPop(300,300,"CHAIN ×3","#fff");mini.magnet.on=true;drawMini()');
begin(0);
run('orb({});mini.magnet.on=true;mini.magnetEverOn=true;mini.magnetLastTouched=mini.orbs[0].id;drawMini();MAGNET.scene(mc,420,240)');
close();
console.log('PASS: Polarity Panic draws every state.');
