// Drip or Die rules: the HOLD button, sweep windows (double, decoy, echo, chains), mix orders, hopping
// skulls, the heavy cup, coughs, the level 3 inversion, forced recovery, and the explosion aftermath.
const { run, nodes, close, assert } = require('./harness.cjs');
run('let ivSeed=4242;Math.random=()=>{ivSeed=(ivSeed*1664525+1013904223)>>>0;return ivSeed/4294967296}');

function playAt(tier, phase, difficulty = 1) {
  close();
  run(`state.difficulty=${difficulty};openMini(0);mini.tier=${tier};startMini()`);
  if (phase) run(`ivPhase(${phase})`);
  run('launchMini();updateMini(3.3)');
  assert.equal(run('mini.screen'), 'play');
  assert.equal(run('mini.phase'), phase);
}

// The HOLD button tracks its own pointer so a second finger cannot release it.
run('openMini(0);startMini();launchMini();updateMini(3.3);mini.phase=2');
const holdButton = { dataset: { action: 'hold' }, setPointerCapture: () => {}, classList: { add: () => {} } };
nodes.miniControls.events.pointerdown({ target: { closest: () => holdButton }, pointerId: 3, preventDefault: () => {} });
nodes.miniControls.events.pointerup({ pointerId: 9 });
assert.equal(run('mini.held'), true);
nodes.miniControls.events.pointerup({ pointerId: 3 });
assert.equal(run('mini.held'), false);
close();
console.log('PASS: IV multi-touch hold release.');

// ---- Phase 1: sweeps ----
assert.equal(run('JSON.stringify(IV_LEVELS[0].tap.patterns)'), '["single"]', 'level 1 teaches with single windows only');

// Double drip: both mint windows count; the sweep only clears after the second.
playAt(1, 0);
run("mini.dir=1;ivNewSweep('double');mini.beatLock=0");
let wins = run('mini.ivSweep.wins.map(w=>w.pos)');
assert.equal(wins.length, 2);
let sweeps = run('mini.ivSweepCount');
run(`mini.pos=${wins[0]};ivTap()`);
assert.equal(run('mini.good'), 1);
assert.equal(run('mini.ivSweepCount'), sweeps, 'one of two windows does not clear the sweep');
run('ivTap()');
assert.equal(run('mini.miss'), 0, 'a second tap on a landed window is harmless');
run(`mini.pos=${wins[1]};ivTap()`);
assert.equal(run('mini.good'), 2);
assert.equal(run('mini.ivSweepCount'), sweeps + 1, 'both windows clear the sweep');
// Letting the second window pass costs one oops at the end of the sweep.
run("mini.dir=1;ivNewSweep('double');mini.beatLock=0");
wins = run('mini.ivSweep.wins.map(w=>w.pos)');
run(`mini.pos=${wins[0]};ivTap()`);
let miss = run('mini.miss');
run('mini.pos=0.995;mini.ivMove=1;updateIVGame(0.05)');
assert.equal(run('mini.miss'), miss + 1, 'an escaped double drip costs an oops');

// Decoys cost an oops; the mint window still counts after the fumble lock.
run("mini.dir=1;ivNewSweep('decoy');mini.beatLock=0;mini.ivFumble=0");
const decoy = run('mini.ivSweep.wins.find(w=>w.decoy).pos');
const mint = run('mini.ivSweep.wins.find(w=>!w.decoy).pos');
miss = run('mini.miss');
run(`mini.pos=${decoy};ivTap()`);
assert.equal(run('mini.miss'), miss + 1, 'tapping a decoy costs an oops');
assert.ok(run('mini.flashText').includes('DECOY'));
let good = run('mini.good');
run(`mini.pos=${mint};ivTap()`);
assert.equal(run('mini.good'), good, 'taps are ignored during the fumble lock');
run(`mini.ivFumble=0;mini.pos=${mint};ivTap()`);
assert.equal(run('mini.good'), good + 1);

// Gold-center hits in a row build the chain multiplier; an off-center hit resets it.
run("mini.dir=1;ivNewSweep('single');mini.beatLock=0;mini.ivChain=0");
run('mini.pos=mini.ivSweep.wins[0].pos;ivTap()');
run("ivNewSweep('single');mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos;ivTap()");
assert.equal(run('mini.ivChain'), 2);
assert.equal(run('ivChainMult()'), 1.5);
run("ivNewSweep('single');mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos+mini.band*0.45;ivTap()");
assert.equal(run('mini.ivChain'), 0, 'off-center hits break the chain');
assert.ok(run('mini.ivBestChain') >= 2);

// Level 3 echo: the line bounces at the flag and the window needs a tap each way.
playAt(2, 0);
run("mini.dir=1;ivNewSweep('echo');mini.beatLock=0");
assert.ok(run('mini.ivSweep.bounce') !== null);
good = run('mini.good');
run('mini.pos=mini.ivSweep.wins[0].pos;ivTap()');
run('ivTap()');
assert.equal(run('mini.good'), good + 1, 'one hit per pass');
run('mini.pos=mini.ivSweep.bounce-0.001;mini.ivMove=1;updateIVGame(0.02)');
assert.equal(run('mini.ivMove'), -1, 'the marker reversed early');
assert.equal(run('mini.ivSweep.pass'), 1);
sweeps = run('mini.ivSweepCount');
run('mini.pos=mini.ivSweep.wins[0].pos;ivTap()');
assert.equal(run('mini.good'), good + 2);
assert.equal(run('mini.ivSweepCount'), sweeps + 1, 'the echo clears after the return tap');
console.log('PASS: IV sweeps: double drips, decoys, chains, echo bounces.');

// ---- Phase 2: mix orders ----
const drop = (kind, extra = '') =>
  run(`mini.drops.push(ivDrop(ivCupLane(),351,{kind:${kind},planned:true${extra}}));updateIVGame(0.02)`);
playAt(1, 1);
run('mini.spawn=99;mini.drops=[];mini.ivOrderList=[[0,0,1]];mini.ivOrderIdx=0;mini.ivOrderStep=0;mini.ivCup=[];mini.recipe=ivKindAt(0)');
assert.equal(run('mini.recipe'), 0);
drop(0);
drop(0);
assert.equal(run('mini.caught'), 2);
assert.equal(run('mini.recipe'), 1, 'two gold then one pink');
drop(0);
assert.equal(run('mini.caught'), 0, 'the wrong flavor dumps the drink in the cup');
assert.equal(run('mini.ivOrderStep'), 0);
assert.ok(run('mini.flashText').includes('DUMPED'));
drop(0);
drop(0);
drop(1);
assert.equal(run('mini.caught'), 3);
assert.equal(run('mini.ivServed'), 1);
assert.equal(run('mini.ivCleanOrders'), 0, 'a dumped order is not clean');
// Double scoop: the next correct sip counts twice.
run('mini.recipe=ivKindAt(0)');
drop(-1, ',scoop:true');
assert.equal(run('mini.ivDouble'), true);
const caught = run('mini.caught');
drop(run('mini.recipe'));
assert.equal(run('mini.caught'), caught + 2);
// A fuller cup slides between lanes more slowly.
run('mini.drops=[];mini.ivOrderList=[[0,0,1]];mini.ivOrderIdx=0;mini.ivOrderStep=0;mini.cupX=240;mini.lane=2;updateIVGame(0.05)');
const light = run('mini.cupX-240');
run('mini.ivOrderStep=2;mini.cupX=240;updateIVGame(0.05)');
assert.ok(run('mini.cupX-240') < light * 0.8, 'heavy cup is slower');
// Hopping skulls change lanes before they land.
run('mini.drops=[ivDrop(0,352-0.5*mini.ivFall-1,{bad:true,hopTo:1,hopY:352-0.5*mini.ivFall})];mini.lane=1;mini.cupX=400');
miss = run('mini.miss');
for (let i = 0; i < 40; i++) run('updateIVGame(0.016)');
assert.equal(run('mini.miss'), miss + 1, 'the skull hopped into the cup lane');
// Level 1: the wrong flavor costs style, not progress.
playAt(0, 1);
run('mini.spawn=99;mini.drops=[];mini.recipe=ivKindAt(0)');
drop(0);
drop(1);
assert.equal(run('mini.caught'), 1);
console.log('PASS: IV mix orders, dumps, double scoops, heavy cup, hopping skulls.');

// ---- Phase 3: pressure events ----
assert.equal(run('IV_LEVELS[0].press.events.length'), 0);
assert.ok(!run('IV_LEVELS[1].press.events').includes('invert'));
assert.ok(run('IV_LEVELS[2].press.events').includes('invert'));
function coughRise(hold) {
  playAt(1, 2);
  run('mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=0;mini.pressure=0.5;mini.velocity=0;mini.held=false');
  run('updateIVGame(0.001)');
  assert.equal(run('mini.ivEvent.kind'), 'cough');
  run(`mini.ivEvent.t=mini.ivEvent.warn;mini.velocity=0;mini.held=${hold}`);
  run('updateIVGame(0.001)');
  assert.ok(run('mini.velocity') > 0.35, 'a cough shoves pressure up');
  const p0 = run('mini.pressure');
  for (let i = 0; i < 40; i++) run('updateIVGame(0.016)');
  return run('mini.pressure') - p0;
}
assert.ok(coughRise(false) < coughRise(true) - 0.05, 'letting go counters a cough');
// Hiccups shove the other way.
playAt(1, 2);
run("mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=2;updateIVGame(0.001)");
assert.equal(run('mini.ivEvent.kind'), 'hiccup');
run('mini.ivEvent.t=mini.ivEvent.warn;mini.velocity=0;updateIVGame(0.001)');
assert.ok(run('mini.velocity') < -0.35, 'a hiccup shoves pressure down');
// The band splits into two halves that both count, then merges.
run("mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=1;updateIVGame(0.001)");
assert.equal(run('mini.ivEvent.kind'), 'split');
run('mini.ivEvent.t=mini.ivEvent.warn+3.5;updateIVGame(0.001)');
assert.equal(run('mini.ivCentres.length'), 2);
run('mini.pressure=mini.ivCentres[1];mini.velocity=0;mini.held=false');
const stable = run('mini.stable');
run('updateIVGame(0.01)');
assert.ok(run('mini.stable') > stable, 'either half of a split band counts');
// Inverted controls appear on level 3 only, last about 3 s, and holding then pushes down.
function invertedSeconds(tier) {
  playAt(tier, 2);
  return run(`(()=>{let s=0;for(let i=0;i<2500&&mini.screen==='play';i++){mini.stable=0;mini.held=(mini.pressure+mini.velocity*.16<ivNearestCentre())!==mini.ivInverted;updateMini(.016);if(mini.ivInverted)s+=.016;}return s})()`);
}
assert.equal(invertedSeconds(0), 0);
assert.equal(invertedSeconds(1), 0);
assert.ok(invertedSeconds(2) >= 2.9, 'level 3 flips the controls');
playAt(2, 2);
run("mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=1;updateIVGame(0.001)");
assert.equal(run('mini.ivEvent.kind'), 'invert');
run('mini.ivEvent.t=mini.ivEvent.warn;updateIVGame(0.001)');
assert.equal(run('mini.ivInverted'), true);
let p0 = run('mini.pressure=0.5;mini.velocity=0;mini.held=true;mini.pressure');
for (let i = 0; i < 20; i++) run('updateIVGame(0.016)');
assert.ok(run('mini.pressure') < p0, 'holding pushes down while flipped');
run('mini.ivEvent.t=mini.ivEvent.warn+3.01;updateIVGame(0.001)');
assert.equal(run('mini.ivInverted'), false, 'the flip lasts 3 seconds');
// Dead center banks time faster.
playAt(0, 2);
run('mini.pressure=mini.pressureTarget;mini.velocity=0;mini.held=false;mini.ivCentreRun=2');
const before = run('mini.stable');
run('mini.pressure=mini.pressureTarget;updateIVGame(0.01)');
assert.ok(run('mini.stable') - before > 0.015, 'dead-center multiplier');
assert.equal(run('mini.ivMult'), 2);
console.log('PASS: IV coughs, hiccups, split bands, level 3 inversion, dead-center multiplier.');

// Mandatory recovery always runs level 1.
close();
run('state.medals[0]=[3,3,0];openMini(0,true);mini.tier=2;startMini()');
assert.equal(run('mini.tier'), 0);
assert.equal(run('mini.required'), 8);
close();
console.log('PASS: IV forced recovery is level 1.');

// ---- The explosion ----
function lose(forced) {
  close();
  run(`state.difficulty=1;openMini(0,${forced});startMini();launchMini();updateMini(3.3);finishMini(false)`);
  // The outro draws every stage of the build-up and the burst.
  for (let t = 0; t <= 2.2; t += 0.05) run(`mini.transition=${t};drawMini()`);
  run('mini.transition=0;updateMini(2.3)');
  assert.equal(run('mini.screen'), 'result');
  assert.equal(run('mini.win'), false);
  return {
    word: run('mini.ivWord'),
    heading: run('$("resultHeading").textContent'),
    heart: run("(p=>[Math.round(p.lx),Math.round(p.ly)])(gore.find(p=>p.organ==='heart'))").join()
  };
}
const first = lose(false);
assert.ok(run('gore.length') > 30, 'the loss populates gore');
assert.ok(run('gore.every(p=>p.iv)'), 'only the new aftermath, no old fountain');
const organs = run("gore.filter(p=>p.kind==='organ').map(p=>p.organ).sort().join()");
assert.equal(organs, 'eye,heart,kidney,kidney,liver,lung,spleen,stomach');
for (const kind of ['guts', 'spine', 'brain', 'tooth', 'splat', 'pile', 'scrunchie', 'slipper', 'smoke'])
  assert.ok(run(`gore.some(p=>p.kind==='${kind}')`), 'aftermath has ' + kind);
const snap = () => run('JSON.stringify(gore.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2)]))');
run('drawResultArt()');
const a = JSON.parse(snap());
run('updateMini(0.1);drawResultArt()');
const b = JSON.parse(snap());
assert.ok(a.filter((v, i) => v[0] !== b[i][0] || v[1] !== b[i][1]).length > 10, 'particles move between frames');
for (let i = 0; i < 480; i++) run('updateMini(1/60);drawResultArt()');
const still = "['organ','tooth','spine','pile','scrunchie','splat','brain','guts','eye','slipper']";
const settled = () => run(`JSON.stringify(gore.filter(p=>${still}.includes(p.kind)).map(p=>[p.x.toFixed(2),p.y.toFixed(2)]))`);
const s1 = settled();
for (let i = 0; i < 60; i++) run('updateMini(1/60);drawResultArt()');
assert.equal(settled(), s1, 'the aftermath settles; only the loop (drips, smoke, blinks) keeps moving');
assert.ok(run('gore.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=800&&p.y>=0&&p.y<=220)'), 'bounded');
assert.ok(run("gore.filter(p=>p.kind==='splat').every(p=>p.x===p.hx&&p.y===p.hy)"), 'splats stay on the wall');
assert.ok(run('gore.length') > 0, 'gore stays non-empty so the loop keeps animating');
assert.equal(run('games[0].resultArt(mc)'), true);
assert.equal(run('games[0].onLose().gory'), true);
assert.equal(run('games[0].resultArt(mc)'), true);
// Dying in the ward shows it too, and the second viewing lands differently.
const second = lose(true);
assert.ok(run('gore.length') > 30);
assert.notEqual(second.word, first.word, 'new burst word');
assert.notEqual(second.heart, first.heart, 'organs land elsewhere');
assert.notEqual(second.heading, first.heading, 'new result copy');
close();
// A win never draws the aftermath.
run('openMini(0);startMini();launchMini();updateMini(3.3);finishMini(true);updateMini(2.3)');
assert.equal(run('games[0].resultArt(mc)'), false);
close();
console.log('PASS: IV explosion outro, aftermath animation, settling, and a different second viewing.');
