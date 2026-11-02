// Drip or Die rules: three strikes and every strike source, the HOLD button, sweep windows (shrinking,
// sliding, double, decoy, echo, chains), the recipe pace ramp, two-flavor waves and far lanes, mix orders,
// hopping skulls, the heavy cup, band jumps and widths, coughs and their counters, the level 3 inversion,
// level-to-level escalation, forced recovery, the explosion aftermath, the portrait (450 × 800) layout,
// and touch on the canvas itself (tap, lane tap and drag, press-and-hold) in both canvas shapes.
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
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

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

// ---- Three strikes ----
// Every level and prescription gets exactly three, and the HUD shows them filling up.
for (let d = 0; d < 3; d++)
  for (let tier = 0; tier < 3; tier++) {
    close();
    run(`state.difficulty=${d};openMini(0);mini.tier=${tier};startMini()`);
    assert.equal(run('mini.rules.misses'), 3, `L${tier + 1}/P${d} has 3 strikes`);
  }
run('updateMiniHUD()');
assert.equal(nodes.miniLivesLabel.textContent, 'STRIKES');
assert.equal(nodes.miniLives.textContent, '○ ○ ○');
// Idle play: each escaped sweep is a strike, and the third one ends the run (the explosion outro).
for (let tier = 0; tier < 3; tier++) {
  playAt(tier, 0);
  const seen = [];
  for (let i = 0; i < 3000 && run("mini.screen==='play'"); i++) {
    run('updateMini(.016)');
    const m = run('mini.miss');
    if (m !== seen[seen.length - 1]) seen.push(m);
    if (m === 1 && tier === 0 && seen.length === 2) {
      run('updateMiniHUD()');
      assert.equal(nodes.miniLives.textContent, '✕ ○ ○');
      assert.ok(run('mini.flashText').includes('STRIKE 1 OF 3'));
      run('drawMini()');
    }
  }
  assert.deepEqual(seen, [0, 1, 2, 3], `L${tier + 1} strikes count up to 3`);
  assert.equal(run('mini.screen'), 'outro', `L${tier + 1} third strike ends the run`);
  assert.equal(run('mini.pendingFinish.win'), false);
  for (let t = 0; t <= 2.2; t += 0.1) run(`mini.transition=${t};drawMini()`);
}
// The budget covers the whole run: one strike per phase on level 2 is the explosion.
playAt(1, 0);
run("mini.dir=1;ivNewSweep('single');mini.beatLock=0;mini.ivFumble=0;mini.pos=0.01;ivTap()");
assert.equal(run('mini.miss'), 1, 'a tap outside the window is a strike');
run('ivPhase(1);launchMini();updateMini(3.3);mini.spawn=99;mini.drops=[ivDrop(ivCupLane(),351,{bad:true})];updateIVGame(0.02)');
assert.equal(run('mini.miss'), 2, 'a skull in the cup is a strike');
run('ivPhase(2);launchMini();updateMini(3.3);mini.pressure=0.99;mini.held=true');
for (let i = 0; i < 70 && run("mini.screen==='play'"); i++) run('mini.held=true;updateMini(.016)');
assert.equal(run('mini.miss'), 3, 'pinned pressure is a strike');
assert.equal(run('mini.screen'), 'outro', 'three strikes across three phases end the run');
console.log('PASS: IV three strikes on every level, filled in on the HUD, across all phases.');

// ---- Phase 1: sweeps ----
assert.equal(run('JSON.stringify(IV_LEVELS[0].tap.patterns)'), '["single"]', 'level 1 teaches with single windows only');

// Every sweep draws its own width, and the range shrinks with every landed drip down to the floor.
playAt(0, 0);
const widths = good => run(`(()=>{mini.good=${good};const w=[];for(let i=0;i<40;i++){ivNewSweep();w.push(mini.ivSweep.width);}return w})()`);
let w0 = widths(0);
assert.ok(w0.every(w => w >= 0.16 && w <= 0.2), 'level 1 starts at 0.16 to 0.20');
assert.ok(new Set(w0.map(w => w.toFixed(4))).size > 30, 'the width changes from sweep to sweep');
assert.equal(run('mini.band'), run('mini.ivSweep.width'), 'mini.band is the current sweep width');
const w4 = widths(4);
const k4 = Math.pow(0.91, 4);
assert.ok(w4.every(w => w >= 0.16 * k4 - 1e-9 && w <= 0.2 * k4 + 1e-9), 'each drip multiplies the range by 0.91');
assert.ok(Math.max(...widths(7)) < Math.min(...w0) * 0.66, 'the last level 1 drip is much tighter than the first');
assert.ok(widths(30).every(w => near(w, 0.075)), 'level 1 floor');
playAt(1, 0);
assert.ok(widths(0).every(w => w >= 0.12 && w <= 0.15));
assert.ok(widths(11).every(w => near(w, 0.06)), 'level 2 floor');
playAt(2, 0);
assert.ok(widths(0).every(w => w >= 0.1 && w <= 0.13));
assert.ok(widths(13).every(w => near(w, 0.05)), 'level 3 floor');
// Landing a real drip shrinks the next sweep's range.
playAt(0, 0);
run("mini.dir=1;ivNewSweep('single');mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos;ivTap()");
assert.equal(run('mini.good'), 1);
assert.ok(run('mini.ivSweep.width') <= 0.2 * 0.91 + 1e-9, 'the sweep after a drip uses the shrunk range');

// Windows slide from the threshold drip (4 / 2 / 1), faster with every drip.
function share(tier, good) {
  playAt(tier, 0);
  return run(`mini.good=${good};ivDriftShare()`);
}
assert.equal(share(0, 0), 0);
assert.equal(share(0, 2), 0, 'level 1 windows hold still for drips 1 to 3');
assert.ok(share(0, 3) > 0, 'level 1 windows slide from drip 4');
assert.ok(share(0, 7) > share(0, 3) && near(share(0, 7), 0.33), 'level 1 tops out at a third of the marker speed');
assert.equal(share(1, 0), 0);
assert.ok(share(1, 1) > 0 && near(share(1, 11), 0.5), 'level 2 slides from drip 2, up to half');
assert.ok(share(2, 0) > 0 && near(share(2, 13), 0.66), 'level 3 slides from drip 1, up to two thirds');
// A sliding window really moves during the sweep; a still one does not.
playAt(0, 0);
run("mini.good=2;mini.dir=1;ivNewSweep('single');mini.beatLock=0");
let p0 = run('mini.ivSweep.wins[0].pos');
run('updateIVGame(0.1)');
assert.equal(run('mini.ivSweep.wins[0].pos'), p0, 'drip 3 window is still');
run("mini.good=3;mini.dir=1;ivNewSweep('single');mini.beatLock=0");
assert.ok(run('mini.ivSweep.drift') !== 0);
p0 = run('mini.ivSweep.wins[0].pos');
run('updateIVGame(0.1)');
assert.ok(Math.abs(run('mini.ivSweep.wins[0].pos') - p0) > 0.001, 'drip 4 window slides');
// Sliding windows stay on the bar, keep their spacing, respect the fairness floor, and echo windows
// stay inside the bounce flag. Level 3 sometimes turns a window around; level 1 never does.
function sweepStats(tier, good) {
  playAt(tier, 0);
  return run(`(()=>{const L=ivRules().tap;let flips=0,turned=0,bad=0,fair=0;for(let n=0;n<150;n++){
    mini.good=${good};mini.dir=n%2?1:-1;ivNewSweep();mini.beatLock=0;mini.helpTime=0;const s=mini.ivSweep;
    if(s.flipAt!==null)flips++;const d0=Math.sign(s.drift);let reversed=false;
    if(s.drift&&s.width/(ivSpeed()+Math.abs(s.drift))<L.minCross-1e-9)fair++;
    const gaps=s.wins.map(w=>w.pos-s.wins[0].pos);
    for(let i=0;i<400&&mini.ivSweep===s;i++){
      const before=s.drift;updateIVGame(0.008);if(mini.ivSweep!==s)break;
      if(Math.sign(s.drift)!==Math.sign(before)&&s.shift>s.shiftMin+0.01&&s.shift<s.shiftMax-0.01)reversed=true;
      for(const [j,w] of s.wins.entries()){if(w.pos-s.width/2<0.02||w.pos+s.width/2>0.98)bad++;if(Math.abs(w.pos-s.wins[0].pos-gaps[j])>1e-9)bad++;}
      if(s.bounce!==null&&s.pass===0)for(const w of s.wins)if(mini.dir>0?w.pos+s.width/2>s.bounce:w.pos-s.width/2<s.bounce)bad++;
    }
    if(reversed&&d0)turned++;mini.miss=0;}
    return {flips,turned,bad,fair}})()`);
}
for (const [tier, good] of [
  [0, 7],
  [1, 6],
  [2, 0],
  [2, 13]
]) {
  const st = sweepStats(tier, good);
  assert.equal(st.bad, 0, `L${tier + 1} drip ${good + 1}: windows stay on the bar, spaced, inside the bounce`);
  assert.equal(st.fair, 0, `L${tier + 1} drip ${good + 1}: no window crosses faster than minCross`);
  if (tier < 2) assert.equal(st.flips, 0, `L${tier + 1} windows never change their mind`);
  else assert.ok(st.flips > 20 && st.turned > 10, 'level 3 windows sometimes turn around mid-sweep');
}
// The marker speeds up about 25% across the phase.
playAt(0, 0);
const v0 = run("mini.good=0;mini.ivSweep.tempo=1;ivSpeed()");
const v7 = run('mini.good=7;ivSpeed()');
assert.ok(near(v7 / v0, 1.25, 1e-6), 'marker ramps 25% by the last drip');

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
// Letting the second window pass is a strike at the end of the sweep.
run("mini.dir=1;ivNewSweep('double');mini.beatLock=0");
wins = run('mini.ivSweep.wins.map(w=>w.pos)');
run(`mini.pos=${wins[0]};ivTap()`);
let miss = run('mini.miss');
run('mini.pos=0.995;mini.ivMove=1;updateIVGame(0.05)');
assert.equal(run('mini.miss'), miss + 1, 'an escaped drip is a strike');
// A wild tap and the escape it causes in the same sweep are one strike, not two.
run("mini.dir=1;ivNewSweep('single');mini.beatLock=0;mini.ivFumble=0;mini.pos=0.01");
miss = run('mini.miss');
run('ivTap();mini.pos=0.995;mini.ivMove=1;updateIVGame(0.05)');
assert.equal(run('mini.miss'), miss + 1, 'one strike per sweep');

// Decoys are a strike; the mint window still counts after the fumble lock.
playAt(1, 0);
run("mini.dir=1;ivNewSweep('decoy');mini.beatLock=0;mini.ivFumble=0");
const decoy = run('mini.ivSweep.wins.find(w=>w.decoy).pos');
const mint = run('mini.ivSweep.wins.find(w=>!w.decoy).pos');
miss = run('mini.miss');
run(`mini.pos=${decoy};ivTap()`);
assert.equal(run('mini.miss'), miss + 1, 'tapping a decoy is a strike');
assert.ok(run('mini.flashText').includes('DECOY'));
let good = run('mini.good');
run(`mini.pos=${mint};ivTap()`);
assert.equal(run('mini.good'), good, 'taps are ignored during the fumble lock');
run(`mini.ivFumble=0;mini.pos=${mint};ivTap()`);
assert.equal(run('mini.good'), good + 1);

// Gold-center hits in a row build the chain multiplier; an off-center hit resets it. The gold scales with the window.
run("mini.dir=1;ivNewSweep('single');mini.beatLock=0;mini.ivChain=0");
run('mini.pos=mini.ivSweep.wins[0].pos;ivTap()');
run("ivNewSweep('single');mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos+mini.band*0.12;ivTap()");
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
// Sliding windows draw, including the flicker before a turn.
run("mini.dir=-1;ivNewSweep('decoyDouble');mini.beatLock=0;mini.ivSweep.drift=0.1;mini.ivSweep.flipAt=mini.ivSweep.age+0.1;drawMini()");
console.log('PASS: IV sweeps: shrinking widths, sliding windows, fairness floor, doubles, decoys, chains, echoes.');

// ---- Phase 2: the recipe ----
// Pace ramps with every catch: shorter gaps and faster falls, to a floor and a cap.
playAt(0, 1);
const pace = caught => run(`mini.caught=${caught};[ivWaveGap(),ivFallSpeed()]`);
let [gap, fall] = pace(0);
assert.ok(near(gap, 1.35) && near(fall, 110), 'level 1 starts at 1.35 s and 110 px/s');
[gap, fall] = pace(5);
assert.ok(near(gap, 1.35 * Math.pow(0.94, 5)) && near(fall, 110 * Math.pow(1.07, 5)), '×0.94 gap and ×1.07 fall per catch');
[gap, fall] = pace(40);
assert.ok(near(gap, 0.62) && near(fall, 242), 'floor 0.62 s, cap 2.2×');
playAt(1, 1);
assert.equal(pace(0).map(v => +v.toFixed(3)).join(), '1.05,140');
playAt(2, 1);
assert.equal(pace(0).map(v => +v.toFixed(3)).join(), '0.9,165');
// The live spawner uses them: the next gap and the new drops follow the catch count.
playAt(0, 1);
run('mini.caught=4;mini.spawn=0.001;mini.drops=[];updateIVGame(0.002)');
assert.ok(near(run('mini.spawn'), run('ivWaveGap()')), 'the wave timer resets to the ramped gap');
assert.ok(run('mini.drops.every(d=>Math.abs(d.speed-ivFallSpeed())<1e-9)'), 'new drops fall at the ramped speed');

// Waves: one drop while level 1 teaches, two flavors after catch 3, the right one far away after catch 6.
function waves(caught, lane, n = 300) {
  return run(`(()=>{const out=[];for(let i=0;i<${n};i++){mini.caught=${caught};mini.lane=${lane};mini.drops=[];ivSpawnWave();
    const sips=mini.drops.filter(d=>!d.bad&&!d.scoop);const want=sips.find(d=>d.planned);const skull=mini.drops.find(d=>d.bad);
    out.push({sips:sips.length,kinds:new Set(sips.map(d=>d.kind)).size,lanes:new Set(sips.map(d=>d.lane)).size,
      right:sips.filter(d=>d.kind===mini.recipe).length,want:want.lane,skull:skull.lane});}return out})()`);
}
playAt(0, 1);
let ws = waves(2, 0);
assert.ok(ws.every(w => w.sips === 1), 'the first 3 catches on level 1 get one drop per wave');
ws = waves(3, 0);
assert.ok(ws.every(w => w.sips === 2 && w.kinds === 2 && w.lanes === 2 && w.right === 1), 'from catch 3: two flavors, one right');
const farEarly = ws.filter(w => w.want === 2).length / ws.length;
const skullEarly = ws.filter(w => w.skull === 0).length / ws.length;
ws = waves(6, 0);
const farLate = ws.filter(w => w.want === 2).length / ws.length;
const skullLate = ws.filter(w => w.skull === 0).length / ws.length;
assert.ok(farEarly < 0.45 && farLate > 0.55, `from catch 6 the right one is often two lanes away (${farEarly} → ${farLate})`);
assert.ok(skullEarly > 0.35 && skullLate > skullEarly, `skulls aim at the cup more later (${skullEarly} → ${skullLate})`);
ws = waves(6, 1);
assert.ok(ws.filter(w => w.want !== 1).length / ws.length > 0.75, 'from the middle lane, far means an edge lane');
playAt(1, 1);
assert.ok(waves(0, 1).every(w => w.sips === 2 && w.right === 1), 'level 2 starts with two-flavor waves');
// Fairness: the right drop never lands within 0.35 s of a skull in its lane.
playAt(2, 1, 2);
const landings = run(`(()=>{const seen=new Set(),rec=[];let T=0;mini.helpTime=1e9;mini.catchNeed=999;
  for(let i=0;i<3500&&mini.screen==='play';i++){updateIVGame(0.016);T+=0.016;mini.helpTime=1e9;mini.miss=0;
    for(const d of mini.drops){if(seen.has(d))continue;seen.add(d);rec.push({p:!!d.planned,bad:d.bad,lane:d.hopTo??d.lane,t:T+(352-d.y)/d.speed});}}
  return rec})()`);
const skulls = landings.filter(l => l.bad);
const clashes = landings.filter(l => l.p && skulls.some(s => s.lane === l.lane && Math.abs(s.t - l.t) < 0.35));
assert.ok(landings.filter(l => l.p).length > 40);
assert.equal(clashes.length, 0, 'no wanted drop lands on top of a skull');

const drop = (kind, extra = '') =>
  run(`mini.drops.push(ivDrop(ivCupLane(),351,{kind:${kind},planned:true${extra}}));updateIVGame(0.02)`);
playAt(1, 1);
run('mini.spawn=99;mini.drops=[];mini.ivOrderList=[[0,0,1]];mini.ivOrderIdx=0;mini.ivOrderStep=0;mini.ivCup=[];mini.recipe=ivKindAt(0)');
assert.equal(run('mini.recipe'), 0);
drop(0);
drop(0);
assert.equal(run('mini.caught'), 2);
assert.equal(run('mini.recipe'), 1, 'two gold then one pink');
const fall2 = run('mini.ivFall');
assert.ok(fall2 > 140, 'catches speed up the fall');
miss = run('mini.miss');
drop(0);
assert.equal(run('mini.caught'), 0, 'the wrong flavor dumps the drink in the cup');
assert.equal(run('mini.ivOrderStep'), 0);
assert.ok(run('mini.flashText').includes('DUMPED'));
assert.equal(run('mini.miss'), miss + 1, 'the wrong flavor is a strike from level 2');
assert.ok(run('mini.ivFall') < fall2, 'a dumped cup slows the pace back down');
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
// The cup eases between lanes, and a fuller cup slides more slowly.
run('mini.drops=[];mini.ivOrderList=[[0,0,1]];mini.ivOrderIdx=0;mini.ivOrderStep=0;mini.cupX=240;mini.lane=2;updateIVGame(0.05)');
const light = run('mini.cupX-240');
assert.ok(light < 320 * 0.6, 'lane changes ease instead of teleporting');
run('mini.ivOrderStep=2;mini.cupX=240;updateIVGame(0.05)');
assert.ok(run('mini.cupX-240') < light * 0.8, 'heavy cup is slower');
// Hopping skulls change lanes before they land.
run('mini.drops=[ivDrop(0,352-0.5*mini.ivFall-1,{bad:true,hopTo:1,hopY:352-0.5*mini.ivFall})];mini.lane=1;mini.cupX=400');
miss = run('mini.miss');
for (let i = 0; i < 40; i++) run('updateIVGame(0.016)');
assert.equal(run('mini.miss'), miss + 1, 'the skull hopped into the cup lane');
// Level 1: the wrong flavor costs style, not progress and not a strike; recipes are 3 long.
playAt(0, 1);
assert.equal(run('ivOrder(0).length'), 3, 'level 1 recipe flips every 3 catches');
run('mini.spawn=99;mini.drops=[];mini.recipe=ivKindAt(0)');
drop(0);
miss = run('mini.miss');
const quality = run('mini.quality');
drop(1);
assert.equal(run('mini.caught'), 1);
assert.equal(run('mini.miss'), miss, 'level 1 wrong flavor is not a strike');
assert.ok(run('mini.quality') < quality, 'it costs style');
// The CATCH hint teaches the first 3 catches only; the scene draws at every stage.
run('mini.drops=[ivDrop(0,200,{kind:mini.recipe,planned:true})];mini.caught=1;drawMini();mini.caught=5;drawMini()');
console.log('PASS: IV recipe: pace ramp, two-flavor waves, far lanes, aimed skulls, dumps, scoops, heavy cup, hoppers.');

// ---- Phase 3: the pressure band ----
// The band jumps to a new height after a 0.7 s warning, and each segment gets its own width.
playAt(0, 2);
run('mini.ivJumpIn=0.75;mini.ivSegIdx=0');
const home0 = run('mini.ivHomeTo');
const segW0 = run('mini.ivSegWTo');
run('updateIVGame(0.1)');
const next = run('mini.ivJumpNext');
assert.ok(next, 'a warning shows before the jump');
assert.ok(next.home >= 0.2 && next.home <= 0.8 && Math.abs(next.home - home0) >= 0.18 - 1e-9, 'a real jump inside 0.2 to 0.8');
assert.equal(run('mini.ivHomeTo'), home0, 'the band waits out the warning');
run('drawMini()');
for (let i = 0; i < 7; i++) run('updateIVGame(0.1)');
assert.equal(run('mini.ivJumpNext'), null);
assert.equal(run('mini.ivHomeTo'), next.home, 'then it jumps');
assert.equal(run('mini.ivSegWTo'), next.width);
assert.notEqual(next.width, segW0, 'the new segment has a new width');
const gapNext = run('mini.ivJumpIn');
assert.ok(gapNext >= 4 - 0.11 && gapNext <= 7, 'next jump in 4 to 7 s');
for (let i = 0; i < 10; i++) run('updateIVGame(0.1)');
assert.ok(Math.abs(run('mini.ivHome') - next.home) < 0.01, 'the band glides to its new height');
// Over a long stretch the band visits many heights and widths, alternating wide and narrow.
function segments(tier) {
  playAt(tier, 2);
  return run(`(()=>{const hs=[],ws=[];let idx=0;for(let i=0;i<4000;i++){mini.stable=0;mini.ivEvent=null;mini.ivCounter=null;updateIVGame(0.016);
    if(mini.ivSegIdx!==idx){idx=mini.ivSegIdx;hs.push(mini.ivHomeTo);ws.push(mini.ivSegWTo);}}return {hs,ws}})()`);
}
let seg = segments(0);
assert.ok(seg.hs.length >= 8, 'jumps every 4 to 7 s');
assert.ok(Math.min(...seg.hs) < 0.4 && Math.max(...seg.hs) > 0.6, 'heights spread across the gauge');
assert.ok(seg.ws.every(w => w >= 0.09 && w <= 0.19), 'level 1 widths between 0.09 and 0.19');
assert.ok(seg.ws.every((w, i) => (i % 2 ? w >= 0.14 : w <= 0.14)), 'segments alternate narrow and wide');
seg = segments(2);
assert.ok(Math.min(...seg.ws) < 0.1 && seg.ws.every(w => w >= 0.055), 'level 3 narrows to 0.055');
// The band also slims 20% as the time is banked; the wander quickens each third.
playAt(0, 2);
const full = run('mini.stable=0;ivBandWidth()');
assert.ok(near(run('mini.stable=mini.need;ivBandWidth()'), full * 0.8), 'band slims 20% by the end');
const wanderRate = stable =>
  run(`(()=>{mini.stable=${stable};const p=mini.ivWanderPhase;updateIVGame(0.5);return (mini.ivWanderPhase-p)/0.5})()`);
assert.ok(wanderRate(0) < wanderRate(6) && wanderRate(6) < wanderRate(12), 'wander speeds up every banked third');
// Jumps wait for a shove to be countered, and shoves wait for a jump.
playAt(1, 2);
run("mini.ivJumpIn=1;mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=0;updateIVGame(0.001)");
assert.equal(run('mini.ivEvent.kind'), 'cough');
run('updateIVGame(0.3)');
assert.ok(run('mini.ivJumpIn') > 0.99, 'no jump countdown during a cough');
run('mini.ivEvent=null;mini.ivCounter=null;mini.ivEventGap=99;mini.ivJumpIn=0.5;updateIVGame(0.01)');
assert.ok(run('mini.ivJumpNext'));
run('mini.ivEventGap=0;mini.ivEventIdx=0;updateIVGame(0.01)');
assert.equal(run('mini.ivEvent'), null, 'no cough during a jump warning');
console.log('PASS: IV band jumps with a warning, per-segment widths, slimming, quicker wander, no overlaps.');

// ---- Phase 3: events and counters ----
assert.equal(run('IV_LEVELS[0].press.events.join()'), 'cough', 'level 1 only coughs');
assert.ok(!run('IV_LEVELS[1].press.events').includes('invert'));
assert.ok(run('IV_LEVELS[2].press.events').includes('invert'));
// Level 1's gentle cough waits for 6 banked seconds and shoves at 60% strength.
playAt(0, 2);
run('mini.ivEventGap=0;mini.stable=5.9;updateIVGame(0.001)');
assert.equal(run('mini.ivEvent'), null, 'no cough before 6 banked seconds');
run('mini.stable=6;updateIVGame(0.001)');
assert.equal(run('mini.ivEvent.kind'), 'cough');
run('mini.ivEvent.t=mini.ivEvent.warn;mini.velocity=0;updateIVGame(0.001)');
assert.ok(near(run('mini.velocity'), 0.42 * 0.6, 0.01), 'gentle cough');
function coughRise(hold) {
  playAt(1, 2);
  run('mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=0;mini.pressure=0.5;mini.velocity=0;mini.held=false');
  run('updateIVGame(0.001)');
  assert.equal(run('mini.ivEvent.kind'), 'cough');
  run(`mini.ivEvent.t=mini.ivEvent.warn;mini.velocity=0;mini.held=${hold}`);
  run('updateIVGame(0.001)');
  assert.ok(run('mini.velocity') > 0.35, 'a cough shoves pressure up');
  const p = run('mini.pressure');
  for (let i = 0; i < 40; i++) run('updateIVGame(0.016)');
  return run('mini.pressure') - p;
}
assert.ok(coughRise(false) < coughRise(true) - 0.05, 'letting go counters a cough');
// A shove that knocks you out of the band for a second is a strike from level 2, style on level 1.
function counter(tier, idx, mode) {
  playAt(tier, 2);
  run(`mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=${idx};mini.stable=6;mini.ivJumpIn=99;updateIVGame(0.001)`);
  run('mini.pressure=mini.pressureTarget;mini.velocity=0;mini.ivEvent.t=mini.ivEvent.warn');
  const kind = run('mini.ivEvent.kind');
  const miss0 = run('mini.miss');
  const q0 = run('mini.quality');
  let p = run('mini.pressure');
  let armed = false;
  for (let i = 0; i < 200 && run("mini.screen==='play'"); i++) {
    if (mode === 'hold') run('mini.held=true');
    if (mode === 'release') run('mini.held=false');
    if (mode === 'freeze') run(`mini.pressure=${p};mini.velocity=0;mini.held=false;mini.ivWanderAmp=0`);
    if (mode === 'counter')
      run('mini.held=(mini.pressure+mini.velocity*.16<ivNearestCentre())!==mini.ivInverted');
    run('mini.stable=Math.min(mini.stable,6.5);updateIVGame(0.016)');
    const live = run('!!mini.ivCounter');
    if (armed && !live) break;
    armed = armed || live;
  }
  return { kind, armed, strikes: run('mini.miss') - miss0, style: q0 - run('mini.quality'), flash: run('mini.flashText') };
}
let c = counter(1, 0, 'hold');
assert.equal(c.kind, 'cough');
assert.ok(c.armed);
assert.equal(c.strikes, 1, 'an uncountered cough is a strike on level 2');
assert.ok(c.flash.includes('COUGH WON'));
c = counter(1, 0, 'counter');
assert.equal(c.strikes, 0, 'a countered cough is fine');
c = counter(1, 3, 'freeze');
assert.equal(c.kind, 'spike');
assert.equal(c.strikes, 1, 'letting a spike leave you behind is a strike on level 2');
c = counter(2, 3, 'release');
assert.equal(c.kind, 'hiccup');
assert.equal(c.strikes, 1, 'an uncountered hiccup is a strike on level 3');
c = counter(0, 0, 'hold');
assert.equal(c.strikes, 0, 'level 1 coughs never strike');
assert.ok(c.style > 0 && c.flash.includes('COUGH WON'), 'they cost style and say so');
c = counter(0, 0, 'counter');
assert.ok(c.flash.includes('COUNTERED'));
// Hiccups shove the other way.
playAt(1, 2);
run('mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=2;updateIVGame(0.001)');
assert.equal(run('mini.ivEvent.kind'), 'hiccup');
run('mini.ivEvent.t=mini.ivEvent.warn;mini.velocity=0;updateIVGame(0.001)');
assert.ok(run('mini.velocity') < -0.35, 'a hiccup shoves pressure down');
// The band splits into two halves that both count, then merges.
run('mini.ivEvent=null;mini.ivCounter=null;mini.ivEventGap=0;mini.ivEventIdx=1;updateIVGame(0.001)');
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
run('mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=1;updateIVGame(0.001)');
assert.equal(run('mini.ivEvent.kind'), 'invert');
run('mini.ivEvent.t=mini.ivEvent.warn;updateIVGame(0.001)');
assert.equal(run('mini.ivInverted'), true);
p0 = run('mini.pressure=0.5;mini.velocity=0;mini.held=true;mini.pressure');
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
console.log('PASS: IV coughs, counters and their strikes, hiccups, split bands, level 3 inversion, dead center.');

// ---- Escalation: level 1 starts gentler than level 3 and ends harder than it starts ----
function profile(tier, late) {
  playAt(tier, 0);
  const L = run('ivRules()');
  const tapGood = late ? L.tap.required - 1 : 0;
  const tap = run(`(()=>{mini.good=${tapGood};mini.ivSweep.tempo=1;return {w:ivWidthRange()[1],v:ivSpeed(),slide:ivDriftShare()}})()`);
  run('ivPhase(1);launchMini();updateMini(3.3)');
  const cat = run(`(()=>{mini.caught=${late ? L.catch.need - 1 : 0};return {gap:ivWaveGap(),fall:ivFallSpeed()}})()`);
  run('ivPhase(2);launchMini();updateMini(3.3)');
  const third = late ? 2 : 0;
  const press = {
    narrow: run(`mini.ivSegW=ivRules().press.width[0];mini.stable=${late ? 'mini.need' : 0};ivBandWidth()`),
    wander: L.press.wander[third][0] * L.press.wander[third][1]
  };
  return { ...tap, ...cat, ...press };
}
const l1start = profile(0, false);
const l1end = profile(0, true);
const l3start = profile(2, false);
assert.ok(l1start.w > l3start.w && l1start.v < l3start.v && l1start.slide < l3start.slide, 'phase 1: level 1 starts gentler');
assert.ok(l1end.w < l1start.w * 0.6 && l1end.v > l1start.v && l1end.slide > 0, 'phase 1: level 1 ends harder');
assert.ok(l1start.gap > l3start.gap && l1start.fall < l3start.fall, 'phase 2: level 1 starts gentler');
assert.ok(l1end.gap < l1start.gap * 0.65 && l1end.fall > l1start.fall * 1.6, 'phase 2: level 1 ends harder');
assert.ok(l1start.narrow > l3start.narrow && l1start.wander < l3start.wander, 'phase 3: level 1 starts gentler');
assert.ok(l1end.narrow < l1start.narrow && l1end.wander > l1start.wander, 'phase 3: level 1 ends harder');
// Levels 2 and 3 start about where level 1 ends.
const l2start = profile(1, false);
assert.ok(l2start.w <= l1end.w * 1.5 && l2start.gap <= l1start.gap * 0.8, 'level 2 picks up near level 1’s finish');
console.log('PASS: IV escalation: level 1 starts gentle and ends real; level 3 starts harder than level 1.');

// Mandatory recovery always runs level 1, with the same three strikes.
close();
run('state.medals[0]=[3,3,0];openMini(0,true);mini.tier=2;startMini()');
assert.equal(run('mini.tier'), 0);
assert.equal(run('mini.required'), 8);
assert.equal(run('mini.rules.misses'), 3);
close();
console.log('PASS: IV forced recovery is level 1 with three strikes.');

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
assert.equal(organs, 'heart,kidney,kidney,liver,lung,spleen,stomach');
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
// Macy has two eyes: one blinks in the pile, one pops out and rolls, and both end up looking at the scrunchie.
assert.equal(run("gore.filter(p=>p.kind==='eye'||p.organ==='eye').length"), 2, 'exactly two eyeballs in the aftermath');
assert.equal(run("gore.filter(p=>p.kind==='eye'&&p.pop).length"), 1, 'one of them rolls');
assert.ok(run("gore.filter(p=>p.kind==='eye').every(p=>p.gaze===clamp((412-p.x0)/20,-0.9,0.9))"), 'both look at the scrunchie');
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
console.log('PASS: IV explosion outro, aftermath animation, settling, two eyeballs, and a different second viewing.');

// ---- Portrait ----
// On an upright phone the framework sets mini.portrait and sizes the canvas 450 × 800; the game draws its
// own tall layout and asks every frame, since a rotation can flip it mid-run. A recording context follows
// translate/scale/rotate so every word drawn can be checked against the canvas that is up.
close();
run('openMini(0);startMini()');
assert.equal(run('JSON.stringify(ivCanvas())'), '{"w":800,"h":450}', 'landscape until the framework says otherwise');
assert.equal(run('JSON.stringify(games[0].portraitCanvas)'), '{"w":450,"h":800}');
run('mini.portrait=true;configureCanvas($("miniCanvas"),450,800)');
assert.equal(run('JSON.stringify(ivCanvas())'), '{"w":450,"h":800}', 'portrait size when upright');
run('mini.portrait=false;configureCanvas($("miniCanvas"),800,450)');
assert.equal(run('JSON.stringify(ivCanvas())'), '{"w":800,"h":450}', 'back to landscape when turned');
run(`globalThis.ivRec = { on: false, texts: [], m: [1, 0, 0, 1, 0, 0], stack: [] };
mc.save = () => ivRec.stack.push(ivRec.m.slice());
mc.restore = () => {
  if (ivRec.stack.length) ivRec.m = ivRec.stack.pop();
};
mc.translate = (x, y) => {
  const m = ivRec.m;
  m[4] += m[0] * x + m[2] * y;
  m[5] += m[1] * x + m[3] * y;
};
mc.scale = (x, y) => {
  const m = ivRec.m;
  m[0] *= x;
  m[1] *= x;
  m[2] *= y;
  m[3] *= y;
};
mc.rotate = a => {
  const [a0, b0, c0, d0] = ivRec.m;
  const c = Math.cos(a);
  const s = Math.sin(a);
  ivRec.m = [a0 * c + c0 * s, b0 * c + d0 * s, c0 * c - a0 * s, d0 * c - b0 * s, ivRec.m[4], ivRec.m[5]];
};
mc.setTransform = () => {
  ivRec.m = [1, 0, 0, 1, 0, 0];
  ivRec.stack = [];
};
mc.fillText = (t, x, y) => {
  if (!ivRec.on) return;
  const m = ivRec.m;
  ivRec.texts.push([String(t), m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
};`);
// Draws one frame; returns every word and the ones anchored off the active canvas. Drops still entering
// from above the landscape canvas may carry a label a little over the top edge.
function frameTexts() {
  run('ivRec.on=true;ivRec.texts=[];ivRec.m=[1,0,0,1,0,0];ivRec.stack=[];drawMini();ivRec.on=false');
  const { w, h } = JSON.parse(run('JSON.stringify(ivCanvas())'));
  const texts = JSON.parse(run('JSON.stringify(ivRec.texts)'));
  return { texts, off: texts.filter(([, x, y]) => x < 0 || x > w || y < -40 || y > h) };
}
function upright(on) {
  if (on) run('mini.portrait=true;configureCanvas($("miniCanvas"),450,800)');
  else run('mini.portrait=false;configureCanvas($("miniCanvas"),800,450)');
}
function onCanvas(what) {
  const { texts, off } = frameTexts();
  assert.deepEqual(off, [], what + ': every word lands on the canvas');
  return texts;
}
const ivBot = require('./bots/iv.cjs').policy;
run(`globalThis.ivBotTick = function () {${ivBot}}`);
// Every level and phase, briefing to play, with the bot playing and the phone turning every so often.
for (let tier = 0; tier < 3; tier++)
  for (let phase = 0; phase < 3; phase++) {
    close();
    run(`state.difficulty=1;openMini(0);mini.tier=${tier};startMini()`);
    if (phase) run(`ivPhase(${phase})`);
    upright(true);
    onCanvas(`L${tier + 1} phase ${phase + 1} briefing`);
    run('launchMini();updateMini(0.5)');
    onCanvas(`L${tier + 1} phase ${phase + 1} intro`);
    run('updateMini(3)');
    let low = false;
    for (let i = 0; i < 600 && run("mini.screen==='play'"); i++) {
      run('ivBotTick();updateMini(1/60)');
      if (i % 150 === 149) upright(!run('mini.portrait'));
      if (i % 9) continue;
      const tall = run('!!mini.portrait');
      const texts = onCanvas(`L${tier + 1} phase ${phase + 1} ${tall ? 'portrait' : 'landscape'} frame ${i}`);
      if (tall && texts.some(([, x, y]) => y > 600 && x < 450)) low = true;
    }
    assert.ok(low, `L${tier + 1} phase ${phase + 1}: the tall layout uses the bottom of the canvas`);
  }
// The busy moments: echoes and bounces, decoys and slides, flashes, hoppers and scoops, every shove.
playAt(2, 0);
upright(true);
run("mini.dir=1;ivNewSweep('echo');mini.beatLock=0;mini.ivSweep.drift=0.12;mini.pos=0.3");
run("mini.flash=0.5;mini.flashText='MISSED THE DRIP  ·  STRIKE 1 OF 3'");
onCanvas('portrait echo, bounce, slide and flash');
run("mini.dir=-1;ivNewSweep('decoyDouble');mini.beatLock=0;mini.ivSweep.drift=-0.1;mini.ivSweep.flipAt=mini.ivSweep.age+0.1");
onCanvas('portrait decoys sliding');
playAt(0, 0);
upright(true);
run('mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos;mini.ivChain=2');
assert.ok(onCanvas('portrait level 1 hint').some(([t]) => t === 'NOW!'), 'the level 1 hint shouts NOW! on the tall bar');
playAt(1, 1);
upright(true);
run('mini.drops=[ivDrop(0,300,{kind:1}),ivDrop(1,180,{bad:true,hopTo:2,hopY:260}),ivDrop(2,120,{scoop:true}),ivDrop(0,-90,{bad:true})]');
run("mini.ivDouble=true;mini.ivCup=[0,1];mini.ivOrderStep=2;mini.flash=0.6;mini.flashText='WRONG FLAVOR. DRINK DUMPED.  ·  STRIKE 2 OF 3'");
onCanvas('portrait hopper, scoop and a heavy cup');
playAt(0, 1);
upright(true);
run('mini.drops=[ivDrop(1,200,{kind:mini.recipe,planned:true})]');
assert.ok(onCanvas('portrait catch hint').some(([t]) => t === '▼ CATCH'), 'the CATCH arrow shows in portrait');
for (const kind of ['cough', 'hiccup', 'spike', 'split', 'invert']) {
  playAt(2, 2);
  upright(true);
  run(`mini.ivEvent={kind:'${kind}',t:0.2,fired:false,warn:0.8,dur:3,dir:1};mini.ivJumpNext={home:0.75,width:0.15}`);
  onCanvas('portrait ' + kind + ' warning with a jump');
  run(`mini.ivEvent.t=1.2;mini.ivEvent.fired=true;mini.ivInverted=${kind === 'invert'};mini.ivSplit=${kind === 'split' ? 0.12 : 0}`);
  run('mini.ivCentres=mini.ivSplit?[mini.pressureTarget-0.12,mini.pressureTarget+0.12]:[mini.pressureTarget]');
  run("mini.flash=0.5;mini.flashText='THE SPIKE LEFT YOU BEHIND  ·  STRIKE 1 OF 3'");
  onCanvas('portrait ' + kind);
}
playAt(0, 2);
upright(true);
run('mini.pressure=0.05');
assert.ok(onCanvas('portrait pressure hint').some(([t]) => t === '▲ HOLD'), 'the level 1 hint rides with the marker');
// The explosion has its own upright composition, from the build-up through the burst.
for (const tall of [true, false]) {
  close();
  run('state.difficulty=1;openMini(0);startMini();launchMini();updateMini(3.3)');
  upright(tall);
  run('finishMini(false)');
  const words = new Set();
  for (let t = 0; t <= 2.2; t += 0.05) {
    run(`mini.transition=${t}`);
    for (const [word] of onCanvas(`${tall ? 'portrait' : 'landscape'} outro at ${t.toFixed(2)} s`)) words.add(word);
  }
  for (const word of ['MMMF!', 'STAND BACK!', run('mini.ivWord')]) assert.ok(words.has(word), `the outro says ${word}`);
  assert.equal(run('ivBoomStage().w'), tall ? 450 : 800);
}
close();
console.log('PASS: IV portrait: size helper, every phase and level, busy moments, rotation mid-run, and the explosion.');

// ---- Touch: the finger is the button ----
// The canvas takes canvas coordinates in whichever shape is up; the buttons and keys still work.
function touchAt(tier, phase, tall) {
  playAt(tier, phase);
  upright(tall);
}
const down = (x, y) => run(`arcadeDown({x:${x},y:${y}})`);
const move = (x, y) => run(`arcadeMove({x:${x},y:${y}})`);
const up = cancel => run(`arcadeUp(${cancel})`);
for (const tall of [false, true]) {
  const [W, H] = tall ? [450, 800] : [800, 450];
  const shape = tall ? 'portrait' : 'landscape';
  // Phase 1: a tap anywhere is TAP THE DRIP, strike and all.
  touchAt(0, 0, tall);
  run('mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos');
  down(W * 0.1, H * 0.9);
  assert.equal(run('mini.good'), 1, shape + ': a tap anywhere lands the drip');
  assert.equal(run('mini.ivRipples.length'), 1, shape + ': a ripple marks the touch');
  assert.equal(run('JSON.stringify(mini.ivRipples.map(r=>[r.x,r.y,r.tall]))'), JSON.stringify([[W * 0.1, H * 0.9, tall]]));
  onCanvas(shape + ' ripple');
  up(false);
  assert.equal(run('mini.good'), 1, shape + ': lifting the finger does nothing');
  run('mini.beatLock=0;mini.ivFumble=0;mini.pos=mini.ivSweep.wins[0].pos>0.5?0.02:0.98');
  down(W / 2, H / 2);
  assert.equal(run('mini.miss'), 1, shape + ': a bad tap is a strike, same as the button');
  up(true);
  assert.equal(run('mini.miss') + run('mini.good'), 2, shape + ': a cancelled touch never acts');
  for (let i = 0; i < 30; i++) run('updateMini(1/60)');
  assert.equal(run('mini.ivRipples.length'), 0, shape + ': ripples fade');
  // The last drip moves on to the briefing, which cancels the finger still on the glass.
  run('mini.good=mini.required-1;mini.beatLock=0;mini.ivFumble=0');
  run('mini.pos=mini.ivSweep.wins.find(w=>!w.decoy&&w.hits<w.need).pos');
  down(W / 2, H / 3);
  assert.equal(run('mini.phase'), 1);
  assert.equal(run('mini.screen'), 'briefing');
  assert.equal(run('mini.pointer'), null, shape + ': the briefing cancels the touch');
  assert.equal(run('mini.ivTouch'), null);

  // Phase 2: tap on or above a lane, or drag the cup; release snaps to the nearest lane.
  touchAt(1, 1, tall);
  run('mini.spawn=99;mini.drops=[]');
  const laneX = lane => (tall ? 225 + (lane - 1) * 140 : 240 + lane * 160);
  down(laneX(2), tall ? 270 : 60);
  up(false);
  assert.equal(run('mini.lane'), 2, shape + ': tapping above the right lane picks it');
  down(laneX(0), H * 0.75);
  up(false);
  assert.equal(run('mini.lane'), 0, shape + ': tapping on the left lane picks it');
  down(tall ? 4 : 30, H / 2);
  up(false);
  assert.equal(run('mini.lane'), 0, shape + ': beside the lanes counts as the nearest one');
  down(laneX(1), H / 2);
  move(laneX(1) + 6, H / 2);
  assert.equal(run('mini.ivDragX'), null, shape + ': a wobble is still a tap');
  up(false);
  assert.equal(run('mini.lane'), 1);
  // Drag from the left lane to a spot between the middle and right lanes: the cup follows the finger.
  for (let i = 0; i < 60; i++) run('updateMini(1/60)');
  down(laneX(0), H / 2);
  const between = tall ? 225 + 0.4 * 140 : 400 + 0.4 * 160;
  move((laneX(0) + between) / 2, H / 2);
  move(between, H / 2);
  assert.ok(Math.abs(run('mini.ivDragX') - 464) < 1e-9, shape + ': the drag aims the cup at the finger');
  assert.equal(run('mini.lane'), 1, shape + ': mid-drag the lane is the nearest one');
  for (let i = 0; i < 60; i++) run('updateMini(1/60)');
  assert.ok(Math.abs(run('mini.cupX') - 464) < 2, shape + ': the cup glides continuously, not lane by lane');
  move(laneX(2) - 12, H / 2);
  up(false);
  assert.equal(run('mini.lane'), 2, shape + ': release snaps to the nearest lane');
  assert.equal(run('mini.ivDragX'), null);
  for (let i = 0; i < 90; i++) run('updateMini(1/60)');
  assert.ok(Math.abs(run('mini.cupX') - 560) < 1, shape + ': and the cup settles in it');
  // A dragged cup catches like any other.
  down(laneX(2), H / 2);
  move(laneX(0), H / 2);
  for (let i = 0; i < 60; i++) run('updateMini(1/60)');
  run('mini.drops=[ivDrop(0,351,{kind:mini.recipe,planned:true})]');
  const caught = run('mini.caught');
  run('updateMini(1/60)');
  assert.equal(run('mini.caught'), caught + 1, shape + ': a dragged cup catches');
  // A cancelled drag ends without snapping anywhere new.
  move(laneX(1) + 34, H / 2);
  const lane = run('mini.lane');
  up(true);
  assert.equal(run('mini.ivDragX'), null, shape + ': a cancelled drag lets go of the cup');
  assert.equal(run('mini.lane'), lane, shape + ': and does not act');

  // Phase 3: press and hold anywhere pumps; lifting or losing the finger stops.
  touchAt(0, 2, tall);
  run('mini.pressure=0.3;mini.velocity=0');
  down(W * 0.9, H * 0.2);
  assert.equal(run('mini.held'), true, shape + ': a finger anywhere pumps');
  for (let i = 0; i < 30; i++) run('updateMini(1/60)');
  assert.ok(run('mini.pressure') > 0.3, shape + ': pressure climbs while held');
  up(false);
  assert.equal(run('mini.held'), false, shape + ': lifting the finger lets go');
  down(W / 2, H / 2);
  up(true);
  assert.equal(run('mini.held'), false, shape + ': a lost finger lets go too');
  down(W / 2, H / 2);
  run('pauseMini()');
  assert.equal(run('mini.held'), false, shape + ': pausing lets go');
  run('pauseMini()');
}
// The briefings and the in-play hints say the screen is the button, phase by phase.
close();
run('openMini(0);startMini()');
for (let phase = 0; phase < 3; phase++) {
  run(`ivPhase(${phase})`);
  assert.match(run('games[0].lesson().control'), /screen|finger/, `phase ${phase + 1} briefing mentions touch`);
  assert.match(nodes.miniInstruction.textContent, /screen|Tap a lane/, `phase ${phase + 1} hint mentions touch`);
}
close();
for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'setTransform', 'fillText']) run(`delete mc.${k}`);
console.log('PASS: IV touch: tap anywhere, lane taps and drags, hold to pump, ripples, cancels never act.');
