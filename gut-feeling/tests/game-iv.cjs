// Drip or Die, the recovery ritual: registered as 'recovery' (with a Legendary fourth level) and run in
// place of the room's arcade on a forced run. One phase per collapse, drawn at random between the pump and
// the pressure, kept for retries; the level follows the last arcade run. Both phases at all four levels:
// three strikes and every strike source, the pump's honest windows (shrinking, sliding only from level 3
// with a crossing floor, turns that flicker first, doubles and decoys, chains), the pressure's band (jumps,
// widths, slimming, wander), every shove and its counter (a quarter-second reaction always counters),
// splits, flipped controls, dead center, the clock. Then the win (hearts back, nothing stamped), retries,
// the patch-up price, the explosion and its aftermath, every screen drawn in both canvas shapes, touch,
// the briefing each phase gets once, idle play losing, and the bot winning everything.
const { run, nodes, close, assert } = require('./harness.cjs');
run('let ivSeed=4242;Math.random=()=>{ivSeed=(ivSeed*1664525+1013904223)>>>0;return ivSeed/4294967296}');

const PUMP = 0,
  PRESSURE = 1,
  NAMES = ['pump', 'pressure'];
// A forced recovery of a given phase, level and prescription, through the countdown and into play.
function recover(tier = 0, difficulty = 1, phase = PUMP) {
  close();
  run(`ivRecovery=null;ivRecoveryNext=${phase};state.difficulty=${difficulty};openMini(0,true);mini.tier=${tier};startMini();launchMini();updateMini(3.3)`);
  assert.equal(run('mini.screen'), 'play');
  assert.equal(run('mini.ivPhase'), phase);
}
// Done with a forced run: let the next close() and open start clean.
const done = () => run('mini.forced=false;ivRecovery=null');
// Lines the marker up on the next live window and taps.
const landDrip = () => run('mini.beatLock=0;mini.ivFumble=0;mini.pos=mini.ivSweep.wins.find(w=>!w.decoy&&!w.hit).pos;ivTap()');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
run(`globalThis.ivBotTick = function () {${require('./bots/iv.cjs').policy}}`);

// ---- The registry ----
assert.equal(run('games.recovery.id'), 'recovery');
assert.equal(run('games.recovery.info.game'), 'Drip or Die');
assert.equal(run('games[0].info.game'), 'Fastpitch Fever', "the room's arcade is the throwing game");
assert.equal(run('Object.keys(games).includes("recovery")'), false, 'the recovery is not counted as an arcade');
assert.equal(run('games.recovery.music'), 'game:0', 'the recovery keeps the heart-monitor pulse');
assert.equal(run('games.recovery.legendary'), true, 'the recovery has a Legendary level');
assert.equal(run('miniTierCount(games.recovery)'), 4);
assert.equal(run('games.recovery.tierNotes.length'), 4);
assert.equal(run('IV_LEVELS.length'), 4);
assert.equal(run('typeof games.recovery.patchUp'), 'function');
assert.equal(run('typeof games.recovery.patchUpLabel'), 'function');
run('ivRecovery=null;ivRecoveryNext=0;openMini(0,true)');
assert.equal(run('miniGame()===games.recovery'), true, 'a forced run plays the recovery');
assert.equal(nodes.miniTitle.textContent, 'Drip or Die', 'the forced lobby is the recovery');
assert.equal(nodes.miniHeadline.textContent, 'One IV. Then back to the ward.');
assert.match(nodes.miniDescription.textContent, /prime the pump/, 'the lobby names the phase it drew');
close();
run('ivRecovery=null;ivRecoveryNext=1;openMini(0,true)');
assert.match(nodes.miniDescription.textContent, /hold the pressure/);
close();
// Every line of copy, both phases, every level: no em-dashes.
const copy = [...JSON.parse(run('JSON.stringify(games.recovery.tierNotes)'))];
for (const phase of [PUMP, PRESSURE]) {
  run(`ivRecoveryNext=${phase}`);
  copy.push(run('games.recovery.info.desc'));
  for (let tier = 0; tier < 4; tier++) {
    recover(tier, 1, phase);
    const l = JSON.parse(run('JSON.stringify(games.recovery.lesson())'));
    assert.equal(l.title, 'Recovery / Drip or Die', 'the briefing is the recovery’s own');
    copy.push(l.goal, l.control, l.avoid, l.cue, nodes.miniInstruction.textContent);
    done();
  }
}
for (const line of copy) assert.doesNotMatch(line, /—/, 'no em-dashes in the copy: ' + line);
close();
console.log('PASS: IV recovery registry: its own slot, four levels, not an arcade, a patch-up hook, clean copy.');

// ---- The plan: one of two phases, at random, at the last run's level ----
// The pick is drawn ahead (at load, then whenever a recovery starts) and kept until that recovery starts;
// the lobby and the run agree, and opening the lobby never touches the random numbers.
run('ivRecovery=null;state.lastTier=0');
const first = run('ivRecoveryPlan().phase');
assert.ok([PUMP, PRESSURE].includes(first), 'a pick is waiting from the start');
for (let i = 0; i < 5; i++) assert.equal(run('ivRecoveryPlan().phase'), first, 'asking again does not redraw');
const rolls = run('(()=>{const real=Math.random;let n=0;Math.random=()=>{n++;return real()};openMini(0,true);ivRecoveryPlan();Math.random=real;return n})()');
assert.equal(rolls, 0, 'opening the recovery lobby draws no random numbers');
done();
close();
// Fresh picks come out both ways, about evenly.
const picks = [0, 0];
for (let i = 0; i < 400; i++) picks[run('ivRecoveryNext=null;ivRecoveryPlan().phase')]++;
assert.ok(picks[0] > 150 && picks[1] > 150, 'both phases come up: ' + picks);
// The level is the last real run's, Legendary included; the count is the collapses so far.
for (let last = 0; last < 4; last++) {
  run(`ivRecovery=null;state.lastTier=${last};state.recoveries=3`);
  const plan = JSON.parse(run('JSON.stringify(ivRecoveryPlan())'));
  assert.equal(plan.level, last, `level ${last + 1} follows the last run`);
  assert.equal(plan.count, 3);
  assert.deepEqual(Object.keys(plan), ['phase', 'level', 'count']);
}
// A real arcade run sets the level; a recovery never does.
close();
run('state.lastTier=0;openMini(2);mini.tier=2;startMini()');
assert.equal(run('state.lastTier'), 2, 'the arcade run she started');
assert.equal(run('ivRecoveryPlan().level'), 2);
close();
// The forced lobby opens on the plan's level with every other card locked.
for (let last = 0; last < 3; last++) {
  close();
  run(`ivRecovery=null;state.lastTier=${last};openMini(0,true)`);
  assert.equal(run('mini.tier'), last, `the lobby offers level ${last + 1}`);
  assert.match(nodes.tierGrid.innerHTML, new RegExp(`tier-card selected" data-tier="${last}" >`));
  assert.equal((nodes.tierGrid.innerHTML.match(/disabled/g) || []).length, 3, 'the other three are locked');
  done();
}
close();
// Starting takes the pick and counts the collapse; the plan holds through the run; the next pick is new.
for (const phase of [PUMP, PRESSURE]) {
  close();
  run(`ivRecovery=null;ivRecoveryNext=${phase};state.recoveries=2;state.lastTier=1;openMini(0,true);startMini()`);
  assert.equal(run('mini.ivPhase'), phase, `the run plays the ${NAMES[phase]}`);
  assert.equal(run('mini.phase'), 0, 'one phase: the framework’s phase never moves');
  assert.equal(run('state.recoveries'), 3, 'starting a recovery counts the collapse');
  assert.equal(run('JSON.stringify(ivRecoveryPlan())'), JSON.stringify({ phase, level: 1, count: 2 }), 'the plan holds during the run');
  assert.ok([PUMP, PRESSURE].includes(run('ivRecoveryNext')), 'and the next pick is already waiting');
  done();
}
close();
console.log('PASS: IV plan: one of two phases at random, kept until it starts; the level follows the last run.');

// ---- Four levels, both phases ----
for (const phase of [PUMP, PRESSURE])
  for (let d = 0; d < 3; d++)
    for (let tier = 0; tier < 4; tier++) {
      recover(tier, d, phase);
      assert.equal(run('mini.rules.misses'), 3, `${NAMES[phase]} L${tier + 1}/P${d}: three strikes`);
      assert.equal(run('mini.tier'), tier, 'plays the level the lobby passed');
      const key = phase === PUMP ? 'pump.required' : 'press.need';
      assert.equal(run(phase === PUMP ? 'mini.required' : 'mini.need'), run(`IV_LEVELS[${tier}].${key}`));
      assert.equal(run('mini.limit'), run(`IV_LEVELS[${tier}].${phase === PUMP ? 'pump' : 'press'}.limit`));
      run('updateMiniHUD()');
      assert.equal(nodes.miniStatLabel.textContent, phase === PUMP ? 'PRIME THE PUMP' : 'HOLD THE PRESSURE');
      done();
    }
// Each level is harder than the one before.
const L = JSON.parse(run('JSON.stringify(IV_LEVELS)'));
for (let t = 1; t < 4; t++) {
  const a = L[t - 1],
    b = L[t];
  assert.ok(b.pump.floor <= a.pump.floor && b.pump.speed >= a.pump.speed && b.pump.required >= a.pump.required, `pump L${t + 1} is harder`);
  assert.ok(b.press.width[0] <= a.press.width[0] && b.press.power >= a.press.power, `pressure L${t + 1} is harder`);
  assert.ok(b.press.limit <= b.press.need * 2, `pressure L${t + 1} has a tight clock`);
}
assert.ok(L[0].press.limit >= L[0].press.need * 4, 'level 1 has all the time in the world');
assert.equal(L[0].pump.moveFrom + L[1].pump.moveFrom, 0, 'levels 1 and 2 never slide');
assert.ok(L[2].pump.moveFrom > 1 && !L[2].pump.reverse && L[3].pump.reverse > 0, 'level 3 slides later; Legendary turns');
assert.equal(L[0].press.events.join(), 'cough', 'level 1 only coughs');
assert.ok(!L[0].press.counterStrike && L[1].press.counterStrike, 'level 1 coughs never strike');
assert.ok(!L[1].press.events.includes('invert') && L[2].press.events.includes('invert') && L[3].press.events.includes('invert'));
assert.ok(L[0].pump.hint && L[0].press.hint && !L[1].pump.hint && !L[1].press.hint, 'only level 1 points the way');
console.log('PASS: IV four levels in both phases, three strikes each, every level harder than the last.');

// ---- The pump: strikes ----
recover();
run('updateMiniHUD()');
assert.equal(nodes.miniLivesLabel.textContent, 'STRIKES');
assert.equal(nodes.miniLives.textContent, '○ ○ ○');
// Idle play: each escaped sweep is a strike, and the third one ends the run in the explosion outro.
const seen = [];
for (let i = 0; i < 3000 && run("mini.screen==='play'"); i++) {
  run('updateMini(.016)');
  const m = run('mini.miss');
  if (m !== seen[seen.length - 1]) seen.push(m);
  if (m === 1 && seen.length === 2) {
    run('updateMiniHUD()');
    assert.equal(nodes.miniLives.textContent, '✕ ○ ○');
    assert.ok(run('mini.flashText').includes('STRIKE 1 OF 3'));
    run('drawMini()');
  }
}
assert.deepEqual(seen, [0, 1, 2, 3], 'strikes count up to 3');
assert.equal(run('mini.screen'), 'outro', 'the third strike ends the run');
assert.equal(run('mini.pendingFinish.win'), false);
done();
// A tap outside the window is a strike; the escape that follows in the same sweep is not a second one.
recover();
run("mini.dir=1;ivNewSweep('single');mini.beatLock=0;mini.ivFumble=0;mini.pos=mini.ivSweep.wins[0].pos>0.5?0.02:0.98;ivTap()");
assert.equal(run('mini.miss'), 1, 'a tap outside the window is a strike');
assert.ok(run('mini.flashText').includes('MISSED THE DRIP'));
run('mini.pos=0.999;mini.dir=1;mini.ivFumble=0;updateMini(0.05)');
assert.equal(run('mini.miss'), 1, 'one strike per sweep');
// A red decoy is a strike, and only one per sweep with anything else.
run("mini.dir=1;ivNewSweep('decoy');mini.beatLock=0;mini.ivFumble=0;mini.pos=mini.ivSweep.wins.find(w=>w.decoy).pos;ivTap()");
assert.equal(run('mini.miss'), 2, 'a decoy is a strike');
assert.ok(run('mini.flashText').includes('DECOY'));
run('mini.ivFumble=0;mini.pos=mini.ivSweep.wins.find(w=>w.decoy).pos;ivTap()');
assert.equal(run('mini.miss'), 2, 'one strike per sweep, decoys included');
// A tap during the pause between sweeps is ignored, never a strike.
run('mini.beatLock=0.3;mini.ivFumble=0;mini.pos=0.01;ivTap()');
assert.equal(run('mini.miss'), 2);
done();
console.log('PASS: IV pump: three strikes on the HUD, one per sweep, misses and decoys.');

// ---- The pump: honest windows ----
// Widths shrink a little with every drip, down to the level's floor, and differ from sweep to sweep.
for (let tier = 0; tier < 4; tier++) {
  recover(tier);
  const P = L[tier].pump;
  const widths = good => run(`(()=>{mini.good=${good};const w=[];for(let i=0;i<40;i++){ivNewSweep();w.push(mini.ivSweep.width);}return w})()`);
  const w0 = widths(0);
  assert.ok(w0.every(w => w >= P.width[0] - 1e-9 && w <= P.width[1] + 1e-9), `L${tier + 1}: first sweeps in range`);
  assert.ok(new Set(w0.map(w => w.toFixed(4))).size > 30, 'the width changes from sweep to sweep');
  const k4 = Math.pow(P.shrink, 4);
  assert.ok(widths(4).every(w => w >= Math.max(P.floor, P.width[0] * k4) - 1e-9 && w <= Math.max(P.floor, P.width[1] * k4) + 1e-9), 'each drip shrinks it a little');
  assert.ok(widths(40).every(w => near(w, P.floor)), 'and never below the floor');
  done();
}
// Levels 1 and 2: windows never slide. Levels 3 and 4: they slide, never crossing the line faster than
// minCross, and never start closer to the edge than a blink.
for (let tier = 0; tier < 4; tier++) {
  recover(tier, 2);
  const P = L[tier].pump;
  const sweeps = JSON.parse(
    run(`(()=>{const out=[];for(let good=0;good<mini.required;good++)for(let i=0;i<30;i++){mini.good=good;mini.dir=i%2?-1:1;ivNewSweep();const s=mini.ivSweep;
      out.push({good,drift:s.drift,cross:s.drift?s.width/(ivSpeed()+Math.abs(s.drift)):9,first:Math.min(...s.wins.filter(w=>!w.decoy).map(w=>w.u)),flipAt:s.flipAt,
        gap:s.wins.filter(w=>w.decoy).map(d=>Math.min(...s.wins.filter(w=>!w.decoy).map(w=>Math.abs(w.u-d.u))))[0]??9,band:s.width});}return JSON.stringify(out)})()`)
  );
  if (tier < 2) assert.ok(sweeps.every(s => !s.drift), `L${tier + 1}: windows never slide`);
  else {
    assert.ok(sweeps.every(s => !s.drift || s.good + 1 >= P.moveFrom), `L${tier + 1}: no slide before drip ${P.moveFrom}`);
    assert.ok(sweeps.some(s => s.drift), `L${tier + 1}: windows slide`);
    assert.ok(sweeps.every(s => s.cross >= P.minCross - 1e-9), `L${tier + 1}: a sliding window never crosses the line in under ${P.minCross} s`);
  }
  assert.ok(sweeps.every(s => s.first >= 0.22), 'the first mint is never on top of the start edge');
  assert.ok(sweeps.every(s => s.gap >= s.band + 0.06 - 1e-9), 'decoys keep their distance');
  if (tier === 3) {
    const turns = sweeps.filter(s => s.flipAt !== null);
    assert.ok(turns.length > 20, 'Legendary windows change their minds');
    assert.ok(turns.every(s => s.flipAt >= run('IV_TURN_WARN')), 'never before a full flicker');
  } else assert.ok(sweeps.every(s => s.flipAt === null), `L${tier + 1}: windows never turn on their own`);
  done();
}
// A turn flickers IV_TURN_WARN (more than a reaction) before it happens, then the slide reverses.
recover(3);
run('mini.good=5;mini.dir=1;for(let i=0;i<200;i++){ivNewSweep();if(mini.ivSweep.flipAt!==null&&mini.ivSweep.drift)break;}mini.beatLock=0');
assert.ok(run('mini.ivSweep.flipAt') !== null);
const drift0 = run('mini.ivSweep.drift'),
  flipAt = run('mini.ivSweep.flipAt'),
  warn = run('IV_TURN_WARN');
assert.ok(warn >= 0.5, 'the flicker outlasts a reaction');
let flickerAt = null,
  turnedAt = null;
for (let i = 0; i < 400 && turnedAt === null; i++) {
  run('mini.ivSweep.shiftMin=-9;mini.ivSweep.shiftMax=9;mini.pos=0;ivDriftWindows(1/120)');
  const age = run('mini.ivSweep.age');
  if (flickerAt === null && run('ivTurning()')) flickerAt = age;
  if (Math.sign(run('mini.ivSweep.drift')) !== Math.sign(drift0)) turnedAt = age;
}
assert.ok(flickerAt !== null && turnedAt !== null, 'it flickers, then turns');
assert.ok(turnedAt - flickerAt >= warn - 0.01, 'the flicker comes a full warning ahead');
assert.ok(near(turnedAt, flipAt, 0.01));
done();
// The window stays put on level 1 while the line crosses it, and the line speeds up only a little.
recover(0);
run("mini.good=0;mini.dir=1;ivNewSweep('single');mini.beatLock=0");
const pos = run('mini.ivSweep.wins[0].pos');
for (let i = 0; i < 20; i++) run('updateMini(1/60)');
assert.equal(run('mini.ivSweep.wins[0].pos'), pos, 'level 1 windows never slide');
const v0 = run('mini.good=0;ivSpeed()'),
  v7 = run('mini.good=7;ivSpeed()');
assert.ok(near(v7 / v0, 1.15, 1e-6), 'the line ends 15% faster than it starts');
done();
// Doubles need both mints before the next sweep; gold centers in a row build the chain.
recover(1);
run("mini.good=0;mini.dir=1;ivNewSweep('double');mini.beatLock=0");
const sweepId = run('mini.ivSweepCount');
landDrip();
assert.equal(run('mini.ivSweepCount'), sweepId, 'one mint down, one to go');
landDrip();
assert.equal(run('mini.ivSweepCount'), sweepId + 1, 'both landed: next sweep');
assert.equal(run('mini.ivChain'), 2);
assert.equal(run('ivChainMult()'), 1.5);
run("mini.beatLock=0;ivNewSweep('single');mini.pos=mini.ivSweep.wins[0].pos+mini.band*0.45;ivTap()");
assert.equal(run('mini.ivChain'), 0, 'off-center hits break the chain');
assert.equal(run('mini.good'), 3);
// A second tap on a window already landed is harmless.
run("mini.beatLock=0;ivNewSweep('double');mini.pos=mini.ivSweep.wins[0].pos;ivTap();mini.ivFumble=0;ivTap()");
assert.equal(run('mini.miss'), 0);
// The assist widens the mints, never the decoys.
const band = run('ivBand()');
run('miniAction("assist")');
assert.ok(near(run('ivBand()'), band * 1.7), 'WIDEN WINDOWS widens them');
assert.equal(run('mini.flashText'), 'WINDOWS WIDENED. FIVE STYLE POINTS.');
done();
console.log('PASS: IV pump windows: shrink to a floor, slide only from level 3 and never too fast, turns flicker first.');

// ---- The pressure: the band ----
// Holding pumps, letting go eases off.
recover(0, 1, PRESSURE);
run('mini.pressure=0.3;mini.velocity=0;mini.held=true;mini.ivEventGap=99');
for (let i = 0; i < 30; i++) run('updateIVGame(1/60)');
assert.ok(run('mini.pressure') > 0.36, 'holding raises the pressure');
run('mini.held=false');
const top = run('mini.pressure');
for (let i = 0; i < 60; i++) run('updateIVGame(1/60)');
assert.ok(run('mini.pressure') < top, 'letting go lowers it');
done();
// The band jumps to a new height after a warning, and each segment gets its own width.
recover(0, 1, PRESSURE);
run('mini.ivJumpIn=0.85;mini.ivSegIdx=0;mini.ivEventGap=99');
const home0 = run('mini.ivHomeTo'),
  segW0 = run('mini.ivSegWTo');
run('updateIVGame(0.1)');
const next = run('mini.ivJumpNext');
assert.ok(next, 'a warning shows before the jump');
assert.ok(next.home >= 0.2 && next.home <= 0.8 && Math.abs(next.home - home0) >= 0.18 - 1e-9, 'a real jump inside 0.2 to 0.8');
assert.equal(run('mini.ivHomeTo'), home0, 'the band waits out the warning');
for (let i = 0; i < 8; i++) run('updateIVGame(0.1)');
assert.equal(run('mini.ivJumpNext'), null);
assert.equal(run('mini.ivHomeTo'), next.home, 'then it jumps');
assert.equal(run('mini.ivSegWTo'), next.width);
assert.notEqual(next.width, segW0, 'the new segment has a new width');
for (let i = 0; i < 10; i++) run('updateIVGame(0.1)');
assert.ok(Math.abs(run('mini.ivHome') - next.home) < 0.01, 'the band glides to its new height');
done();
for (let tier = 0; tier < 4; tier++) {
  recover(tier, 1, PRESSURE);
  const P = L[tier].press;
  const seg = run(`(()=>{const hs=[],ws=[];let idx=0;for(let i=0;i<4000;i++){mini.stable=0;mini.ivEvent=null;mini.ivCounter=null;updateIVGame(0.016);
    if(mini.ivSegIdx!==idx){idx=mini.ivSegIdx;hs.push(mini.ivHomeTo);ws.push(mini.ivSegWTo);}}return {hs,ws}})()`);
  const mid = (P.width[0] + P.width[1]) / 2;
  assert.ok(seg.hs.length >= 8, `L${tier + 1}: the band jumps every few seconds`);
  assert.ok(Math.min(...seg.hs) < 0.4 && Math.max(...seg.hs) > 0.6, 'heights spread across the gauge');
  assert.ok(seg.ws.every(w => w >= P.width[0] && w <= P.width[1]), `L${tier + 1}: widths in range`);
  assert.ok(seg.ws.every((w, i) => (i % 2 ? w >= mid : w <= mid)), 'segments alternate narrow and wide');
  done();
}
// The band slims as the time is banked; the wander quickens each third.
recover(1, 1, PRESSURE);
const full = run('mini.stable=0;ivBandWidth()');
assert.ok(near(run('mini.stable=mini.need;ivBandWidth()'), full * 0.8), 'band slims 20% by the end');
const wanderRate = stable => run(`(()=>{mini.stable=${stable};const p=mini.ivWanderPhase;updateIVGame(0.5);return (mini.ivWanderPhase-p)/0.5})()`);
assert.ok(wanderRate(0) < wanderRate(6) && wanderRate(6) < wanderRate(12), 'wander speeds up every banked third');
done();
// Jumps wait for a shove to be countered, and shoves wait for a jump.
recover(1, 1, PRESSURE);
run('mini.ivJumpIn=1;mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=0;updateIVGame(0.001)');
assert.equal(run('mini.ivEvent.kind'), 'cough');
run('updateIVGame(0.3)');
assert.ok(run('mini.ivJumpIn') > 0.99, 'no jump countdown during a cough');
run('mini.ivEvent=null;mini.ivCounter=null;mini.ivEventGap=99;mini.ivJumpIn=0.5;updateIVGame(0.01)');
assert.ok(run('mini.ivJumpNext'));
run('mini.ivEventGap=0;mini.ivEventIdx=0;updateIVGame(0.01)');
assert.equal(run('mini.ivEvent'), null, 'no cough during a jump warning');
done();
// Dead center banks faster; pinning the top or bottom is a strike; the clock ends the run.
recover(0, 1, PRESSURE);
run('mini.ivEventGap=99;mini.pressure=mini.pressureTarget;mini.velocity=0;mini.held=false;mini.ivCentreRun=2');
const before = run('mini.stable');
run('mini.pressure=mini.pressureTarget;updateIVGame(0.01)');
assert.ok(run('mini.stable') - before > 0.015, 'dead-center multiplier');
assert.equal(run('mini.ivMult'), 2);
run('mini.pressure=0.99;mini.held=true');
for (let i = 0; i < 60; i++) run('mini.pressure=0.99;updateIVGame(1/60)');
assert.equal(run('mini.miss'), 1, 'pinned pressure is a strike');
assert.ok(run('mini.flashText').includes('PRESSURE HAS LEFT THE CHAT'));
run('mini.phaseTime=mini.limit-0.01;updateMini(0.02)');
assert.equal(run('mini.screen'), 'outro', 'the clock ends it');
assert.equal(run('mini.pendingFinish.win'), false);
done();
// The assist puts the needle back on the band.
recover(2, 1, PRESSURE);
run('mini.pressure=0.1;miniAction("assist")');
assert.equal(run('mini.pressure'), run('ivNearestCentre()'));
assert.equal(run('mini.flashText'), 'PRESSURE RESET. FIVE STYLE POINTS.');
done();
console.log('PASS: IV pressure band: hold and release, jumps with a warning, widths, slimming, dead center, pins, the clock.');

// ---- The pressure: shoves and their counters ----
// Level 1's gentle cough waits for banked time and shoves at 60% strength.
recover(0, 1, PRESSURE);
run(`mini.ivEventGap=0;mini.stable=${L[0].press.eventsFrom - 0.1};updateIVGame(0.001)`);
assert.equal(run('mini.ivEvent'), null, 'no cough before some time is banked');
run(`mini.stable=${L[0].press.eventsFrom};updateIVGame(0.001)`);
assert.equal(run('mini.ivEvent.kind'), 'cough');
run('mini.ivEvent.t=mini.ivEvent.warn;mini.velocity=0;updateIVGame(0.001)');
assert.ok(near(run('mini.velocity'), 0.42 * 0.6, 0.01), 'gentle cough');
done();
// A shove that knocks her out of the band too long is a strike from level 2, style on level 1.
function counter(tier, kind, mode) {
  recover(tier, 1, PRESSURE);
  run(`mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=ivRules().press.events.indexOf('${kind}');mini.stable=6;mini.ivJumpIn=99;updateIVGame(0.001)`);
  run('mini.pressure=mini.pressureTarget;mini.velocity=0;mini.ivEvent.t=mini.ivEvent.warn');
  assert.equal(run('mini.ivEvent.kind'), kind);
  const miss0 = run('mini.miss'),
    q0 = run('mini.quality'),
    p = run('mini.pressure');
  let armed = false;
  for (let i = 0; i < 300 && run("mini.screen==='play'"); i++) {
    if (mode === 'hold') run('mini.held=true');
    if (mode === 'release') run('mini.held=false');
    if (mode === 'freeze') run(`mini.pressure=${p};mini.velocity=0;mini.held=false;mini.ivWanderAmp=0`);
    if (mode === 'counter') run('mini.held=(mini.pressure+mini.velocity*.16<ivNearestCentre())!==mini.ivInverted');
    run('mini.stable=Math.min(mini.stable,6.5);updateIVGame(0.016)');
    const live = run('!!mini.ivCounter');
    if (armed && !live) break;
    armed = armed || live;
  }
  const r = { armed, strikes: run('mini.miss') - miss0, style: q0 - run('mini.quality'), flash: run('mini.flashText') };
  done();
  return r;
}
let c = counter(1, 'cough', 'hold');
assert.ok(c.armed);
assert.equal(c.strikes, 1, 'an uncountered cough is a strike on level 2');
assert.ok(c.flash.includes('COUGH WON'));
assert.equal(counter(1, 'cough', 'counter').strikes, 0, 'a countered cough is fine');
assert.equal(counter(1, 'spike', 'freeze').strikes, 1, 'letting a spike leave you behind is a strike');
assert.equal(counter(2, 'hiccup', 'release').strikes, 1, 'an uncountered hiccup is a strike on level 3');
assert.equal(counter(3, 'hiccup', 'counter').strikes, 0, 'a countered Legendary hiccup is fine');
c = counter(0, 'cough', 'hold');
assert.equal(c.strikes, 0, 'level 1 coughs never strike');
assert.ok(c.style > 0 && c.flash.includes('COUGH WON'), 'they cost style and say so');
assert.ok(counter(0, 'cough', 'counter').flash.includes('COUNTERED'));
// Hiccups shove the other way.
recover(1, 1, PRESSURE);
run("mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=ivRules().press.events.indexOf('hiccup');updateIVGame(0.001)");
run('mini.ivEvent.t=mini.ivEvent.warn;mini.velocity=0;updateIVGame(0.001)');
assert.ok(run('mini.velocity') < -0.35, 'a hiccup shoves pressure down');
done();
// Fair shoves: caught pushing the wrong way as it lands, on the narrowest band, a player who answers a
// quarter second later and then tracks counters every cough, hiccup and spike, every level and prescription.
for (let d = 0; d < 3; d++)
  for (let tier = 1; tier < 4; tier++)
    for (const kind of ['cough', 'hiccup', 'spike']) {
      recover(tier, d, PRESSURE);
      const r = JSON.parse(
        run(`(()=>{const P=ivRules().press,wander=P.wander.map(w=>w[1]);
        mini.ivSegW=mini.ivSegWTo=P.width[0];mini.stable=mini.need*0.95;mini.ivJumpIn=99;mini.ivWanderAmp=0;P.wander.forEach(w=>w[1]=0);
        mini.ivHome=mini.ivHomeTo=0.5;mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=P.events.indexOf('${kind}');updateIVGame(0.001);
        mini.pressure=mini.pressureTarget;const wrong=${kind !== 'hiccup'};mini.velocity=(wrong?0.27:-0.23)*mini.rules.mini;mini.held=wrong;mini.ivEvent.t=mini.ivEvent.warn-0.001;
        let since=null,armed=false;const m0=mini.miss;
        for(let i=0;i<400&&mini.screen==='play';i++){mini.stable=Math.min(mini.stable,mini.need*0.95);
          if(mini.ivEvent&&mini.ivEvent.fired&&since===null)since=0;
          if(since!==null&&since>=0.25){const up=mini.pressure+mini.velocity*0.16<ivNearestCentre();mini.held=mini.ivInverted?!up:up;}
          updateIVGame(1/60);if(since!==null)since+=1/60;if(mini.ivCounter)armed=true;if(armed&&!mini.ivCounter)break;}
        P.wander.forEach((w,i)=>w[1]=wander[i]);
        return JSON.stringify({armed,strikes:mini.miss-m0});})()`)
      );
      assert.ok(r.armed, `P${d} L${tier + 1} ${kind}: armed`);
      assert.equal(r.strikes, 0, `P${d} L${tier + 1}: a quarter-second answer counters the ${kind}`);
      done();
    }
// The band splits into two halves that both count, then merges.
recover(1, 1, PRESSURE);
run("mini.ivEvent=null;mini.ivCounter=null;mini.ivEventGap=0;mini.ivEventIdx=ivRules().press.events.indexOf('split');updateIVGame(0.001)");
assert.equal(run('mini.ivEvent.kind'), 'split');
run('mini.ivEvent.t=mini.ivEvent.warn+2.5;updateIVGame(0.001)');
assert.equal(run('mini.ivCentres.length'), 2);
run('mini.pressure=mini.ivCentres[1];mini.velocity=0;mini.held=false');
const banked = run('mini.stable');
run('updateIVGame(0.01)');
assert.ok(run('mini.stable') > banked, 'either half of a split band counts');
run('mini.ivEvent.t=mini.ivEvent.warn+5.01;updateIVGame(0.001)');
assert.equal(run('mini.ivCentres.length'), 1, 'and they merge');
done();
// Flipped controls appear on levels 3 and 4 only, last 3 s, and holding then pushes down.
function invertedSeconds(tier) {
  recover(tier, 1, PRESSURE);
  const s = run(`(()=>{let s=0;for(let i=0;i<2500&&mini.screen==='play';i++){mini.stable=0;mini.phaseTime=0;mini.held=(mini.pressure+mini.velocity*.16<ivNearestCentre())!==mini.ivInverted;updateMini(.016);if(mini.ivInverted)s+=.016;}return s})()`);
  done();
  return s;
}
assert.equal(invertedSeconds(0), 0);
assert.equal(invertedSeconds(1), 0);
assert.ok(invertedSeconds(2) >= 2.9, 'level 3 flips the controls');
assert.ok(invertedSeconds(3) >= 2.9, 'and so does Legendary');
recover(2, 1, PRESSURE);
run("mini.ivEvent=null;mini.ivEventGap=0;mini.ivEventIdx=ivRules().press.events.indexOf('invert');updateIVGame(0.001)");
assert.equal(run('mini.ivEvent.kind'), 'invert');
assert.ok(run('mini.ivEvent.warn') >= 1.5, 'a long countdown first');
run('mini.ivEvent.t=mini.ivEvent.warn;updateIVGame(0.001)');
assert.equal(run('mini.ivInverted'), true);
const p0 = run('mini.pressure=0.5;mini.velocity=0;mini.held=true;mini.pressure');
for (let i = 0; i < 20; i++) run('updateIVGame(0.016)');
assert.ok(run('mini.pressure') < p0, 'holding pushes down while flipped');
run('mini.ivEvent.t=mini.ivEvent.warn+3.01;updateIVGame(0.001)');
assert.equal(run('mini.ivInverted'), false, 'the flip lasts 3 seconds');
done();
console.log('PASS: IV pressure shoves: coughs, hiccups, spikes, counters a reaction can make, splits, flipped controls.');

// ---- Out of bed ----
for (const phase of [PUMP, PRESSURE]) {
  run('state.medals[0]=[2,0,0,0];state.records[0]=[777,0,0,0]');
  recover(1, 1, phase);
  run('state.hp=0');
  const recoveries = run('state.recoveries');
  if (phase === PUMP) for (let i = 0; i < 40 && run("mini.screen==='play'"); i++) landDrip();
  else run('mini.stable=mini.need-0.001;mini.pressure=ivNearestCentre();mini.velocity=0;updateIVGame(0.01)');
  assert.equal(run('mini.screen'), 'outro', `the ${NAMES[phase]} ends the recovery`);
  assert.equal(run('mini.pendingFinish.win'), true);
  run('updateMini(2.3)');
  assert.equal(run('mini.win'), true);
  assert.ok(run('state.hp') >= 3, 'hearts restored');
  assert.ok(run('Number.isFinite(mini.qualityFinal)') && run('mini.qualityFinal') > 0, 'a real score');
  assert.equal(run('JSON.stringify(state.medals[0])'), '[2,0,0,0]', "no medal stamped on the room's arcade");
  assert.equal(run('JSON.stringify(state.records[0])'), '[777,0,0,0]', 'and no best score either');
  assert.equal(run('ivRecovery'), null, 'the next collapse is a new recovery');
  assert.equal(run('state.recoveries'), recoveries, 'a won recovery keeps the count');
  assert.equal(run('games.recovery.resultArt(mc)'), false, 'a win never draws the aftermath');
  run('drawResultArt()');
  done();
}
close();
// A retry after an explosion is the same recovery: the same phase and level, no new collapse counted.
for (const phase of [PUMP, PRESSURE]) {
  recover(2, 1, phase);
  const counted = run('state.recoveries');
  for (let retry = 0; retry < 2; retry++) {
    run('finishMini(false);updateMini(2.3)');
    assert.equal(run('mini.screen'), 'result');
    assert.equal(run('$("miniRetry").textContent'), 'Reassemble. Try again.');
    run(`ivRecoveryNext=${1 - phase}`);
    nodes.miniRetry.events.click();
    assert.equal(run('mini.forced'), true, 'Retry stays in the recovery');
    assert.equal(run('mini.tier'), 2, 'at the same level');
    run('startMini();launchMini();updateMini(3.3)');
    assert.equal(run('mini.ivPhase'), phase, `the retry is the same ${NAMES[phase]}`);
    assert.equal(run('state.recoveries'), counted, 'retries do not count as collapses');
  }
  done();
}
close();
console.log('PASS: IV recovery wins restore hearts and stamp nothing; retries repeat the same phase and level.');

// ---- The patch-up ----
// A lost recovery can end from the result screen for 15% of her coins, rounded down, never below zero.
for (const [coins, cost] of [[200, 30], [99, 14], [6, 0], [0, 0]]) {
  run(`state.coins=${coins}`);
  assert.equal(run('ivPatchCost()'), cost, `${coins} coins cost ${cost}`);
  assert.equal(run('games.recovery.patchUpLabel()'), cost ? `Get patched up · ${cost} coins` : 'Get patched up · free');
}
for (const phase of [PUMP, PRESSURE]) {
  recover(3, 1, phase);
  run('state.hp=0;state.coins=99;state.medals[0]=[1,0,0,0];finishMini(false);updateMini(2.3)');
  assert.match(nodes.resultText.textContent, /14 coins/, 'the result says what it costs');
  assert.equal(nodes.miniBack.textContent, 'Get patched up · 14 coins');
  const medals = run('JSON.stringify(state.medals)'),
    earned = run('state.coinsEarned');
  run('leaveMini()');
  assert.equal(run('mini.open'), false, 'the patch-up ends the recovery');
  assert.equal(run('state.coins'), 85, 'it costs 14 of 99 coins');
  assert.ok(run('state.hp') >= 1, 'she gets at least one heart');
  assert.equal(run('JSON.stringify(state.medals)'), medals, 'never progress or medals');
  assert.equal(run('state.coinsEarned'), earned, 'lifetime earnings are untouched');
  assert.match(nodes.toast.textContent, /14 coins/, 'the toast says what it cost');
  assert.equal(run('ivRecovery'), null, 'the next collapse is a new recovery');
}
// Broke: free, and the wallet stays at zero.
recover();
run('state.hp=0;state.coins=0;finishMini(false);updateMini(2.3);leaveMini()');
assert.equal(run('state.coins'), 0, 'never below zero');
assert.equal(run('mini.open'), false);
// Before the result screen there is no way out.
recover(0, 1, PRESSURE);
run('leaveMini()');
assert.equal(run('mini.open'), true, 'a recovery in progress cannot be skipped');
done();
close();
console.log('PASS: IV patch-up: 15% of coins rounded down, never below zero, never medals, said out loud.');

// ---- The explosion ----
function lose(phase) {
  recover(1, 1, phase);
  run('finishMini(false)');
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
const firstBoom = lose(PRESSURE);
assert.ok(run('gore.length') > 30, 'the loss populates gore');
assert.ok(run('gore.every(p=>p.iv)'), 'only the new aftermath');
assert.equal(run("gore.filter(p=>p.kind==='organ').map(p=>p.organ).sort().join()"), 'heart,kidney,kidney,liver,lung,spleen,stomach');
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
assert.equal(settled(), s1, 'the aftermath settles; only the loop keeps moving');
assert.equal(run("gore.filter(p=>p.kind==='eye').length"), 2, 'exactly two eyeballs');
assert.ok(run('gore.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=800&&p.y>=0&&p.y<=220)'), 'bounded');
assert.equal(run('games.recovery.resultArt(mc)'), true);
// The second viewing lands differently, whichever phase popped.
const secondBoom = lose(PUMP);
assert.notEqual(secondBoom.word, firstBoom.word, 'new burst word');
assert.notEqual(secondBoom.heart, firstBoom.heart, 'organs land elsewhere');
assert.notEqual(secondBoom.heading, firstBoom.heading, 'new result copy');
done();
close();
console.log('PASS: IV explosion outro, aftermath animation, settling, two eyeballs, and a different second viewing.');

// ---- Every screen, both canvas shapes ----
// On an upright phone the framework sets mini.portrait and sizes the canvas 450 × 800; the game draws its
// own tall layout and asks every frame, since a rotation can flip it mid-run. A recording context follows
// translate/scale/rotate so every word drawn can be checked against the canvas that is up.
recover();
assert.equal(run('JSON.stringify(ivCanvas())'), '{"w":800,"h":450}', 'landscape until the framework says otherwise');
assert.equal(run('JSON.stringify(games.recovery.portraitCanvas)'), '{"w":450,"h":800}');
done();
run(`globalThis.ivRec = { on: false, texts: [], m: [1, 0, 0, 1, 0, 0], stack: [] };
mc.save = () => ivRec.stack.push(ivRec.m.slice());
mc.restore = () => { if (ivRec.stack.length) ivRec.m = ivRec.stack.pop(); };
mc.translate = (x, y) => { const m = ivRec.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; };
mc.scale = (x, y) => { const m = ivRec.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; };
mc.rotate = a => {
  const [a0, b0, c0, d0] = ivRec.m, c = Math.cos(a), s = Math.sin(a);
  ivRec.m = [a0 * c + c0 * s, b0 * c + d0 * s, c0 * c - a0 * s, d0 * c - b0 * s, ivRec.m[4], ivRec.m[5]];
};
mc.setTransform = () => { ivRec.m = [1, 0, 0, 1, 0, 0]; ivRec.stack = []; };
mc.fillText = (t, x, y) => {
  if (!ivRec.on) return;
  const m = ivRec.m;
  ivRec.texts.push([String(t), m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
};`);
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
// Every phase, level and shape: lobby preview, briefing, countdown, play with the bot and the phone turning
// every so often, the winning outro and the result, then a losing outro and its aftermath.
for (const phase of [PUMP, PRESSURE])
  for (let tier = 0; tier < 4; tier++)
    for (const tall of [false, true]) {
      const tag = `${NAMES[phase]} L${tier + 1} ${tall ? 'portrait' : 'landscape'}`;
      close();
      run(`ivRecovery=null;ivRecoveryNext=${phase};state.difficulty=1;openMini(0,true);mini.tier=${tier}`);
      run('miniScene($("miniPreview").getContext("2d"),0,420,240)');
      run('startMini()');
      upright(tall);
      onCanvas(tag + ' briefing');
      run('launchMini();updateMini(0.5)');
      onCanvas(tag + ' intro');
      run('updateMini(3)');
      let low = false;
      for (let i = 0; i < 2000 && run("mini.screen==='play'"); i++) {
        run('ivBotTick();updateMini(1/60)');
        if (i % 150 === 149) upright(!run('mini.portrait'));
        if (i % 11) continue;
        const nowTall = run('!!mini.portrait');
        const texts = onCanvas(`${tag} frame ${i}`);
        if (nowTall && texts.some(([, x, y]) => y > 600 && x < 450)) low = true;
      }
      assert.ok(low, tag + ': the tall layout uses the bottom of the canvas');
      upright(tall);
      assert.equal(run('mini.pendingFinish.win'), true, tag + ': the bot gets out of bed');
      for (let t = 0; t <= 2.2; t += 0.25) {
        run(`mini.transition=${t}`);
        onCanvas(`${tag} winning outro at ${t.toFixed(2)} s`);
      }
      run('mini.transition=0;updateMini(2.3)');
      assert.equal(run('mini.screen'), 'result');
      run('drawResultArt()');
      run('mini.forced=false;ivRecovery=null');
    }
// The busy moments: decoys sliding and about to turn, the level 1 hint, every shove with a jump on top.
recover(3);
upright(true);
run("mini.good=6;mini.dir=-1;for(let i=0;i<200;i++){ivNewSweep('decoyDouble');if(mini.ivSweep.drift)break;}mini.beatLock=0;mini.ivSweep.flipAt=mini.ivSweep.age+0.1");
assert.equal(run('ivTurning()'), true);
run("mini.flash=0.5;mini.flashText='RED MEANS NO. THAT WAS A DECOY.  ·  STRIKE 1 OF 3'");
onCanvas('portrait decoys sliding and turning');
upright(false);
onCanvas('landscape decoys sliding and turning');
done();
for (const tall of [true, false]) {
  recover(0);
  upright(tall);
  run('mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos;mini.ivChain=2');
  assert.ok(onCanvas('level 1 hint').some(([t]) => t === 'NOW!'), 'the hint shouts NOW! on the bar');
  done();
}
for (const kind of ['cough', 'hiccup', 'spike', 'split', 'invert'])
  for (const tall of [true, false]) {
    recover(3, 1, PRESSURE);
    upright(tall);
    run(`mini.ivEvent={kind:'${kind}',t:0.2,fired:false,warn:0.8,dur:3,dir:1};mini.ivJumpNext={home:0.75,width:0.15}`);
    onCanvas(kind + ' warning with a jump');
    run(`mini.ivEvent.t=1.2;mini.ivEvent.fired=true;mini.ivInverted=${kind === 'invert'};mini.ivSplit=${kind === 'split' ? 0.12 : 0}`);
    run('mini.ivCentres=mini.ivSplit?[mini.pressureTarget-0.12,mini.pressureTarget+0.12]:[mini.pressureTarget]');
    run("mini.flash=0.5;mini.flashText='THE SPIKE LEFT YOU BEHIND  ·  STRIKE 1 OF 3'");
    onCanvas(kind + (tall ? ' portrait' : ' landscape'));
    done();
  }
for (const tall of [true, false]) {
  recover(0, 1, PRESSURE);
  upright(tall);
  run('mini.ivEventGap=99;mini.pressure=0.05');
  assert.ok(onCanvas('pressure hint').some(([t]) => t === '▲ HOLD'), 'the level 1 hint rides with the marker');
  run('mini.pressure=0.95');
  assert.ok(onCanvas('pressure hint').some(([t]) => t === '▼ LET GO'));
  done();
}
// The explosion has its own upright composition, from the build-up through the burst, either phase.
for (const phase of [PUMP, PRESSURE])
  for (const tall of [true, false]) {
    recover(2, 1, phase);
    upright(tall);
    run('finishMini(false)');
    const words = new Set();
    for (let t = 0; t <= 2.2; t += 0.05) {
      run(`mini.transition=${t}`);
      for (const [word] of onCanvas(`${NAMES[phase]} ${tall ? 'portrait' : 'landscape'} outro at ${t.toFixed(2)} s`)) words.add(word);
    }
    for (const word of ['MMMF!', 'STAND BACK!', run('mini.ivWord')]) assert.ok(words.has(word), `the outro says ${word}`);
    assert.equal(run('ivBoomStage().w'), tall ? 450 : 800);
    run('mini.transition=0;updateMini(2.3);drawResultArt()');
    done();
  }
upright(false);
close();
console.log('PASS: IV draws every screen in both shapes, both phases, all levels, busy moments and the explosion.');

// ---- Touch: the finger is the button ----
const down = (x, y) => run(`arcadeDown({x:${x},y:${y}})`);
const up = cancel => run(`arcadeUp(${cancel})`);
for (const tall of [false, true]) {
  const [W, H] = tall ? [450, 800] : [800, 450];
  const shape = tall ? 'portrait' : 'landscape';
  // The pump: a tap anywhere taps the drip.
  recover();
  upright(tall);
  run('mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos');
  down(W * 0.1, H * 0.9);
  assert.equal(run('mini.good'), 1, shape + ': a tap anywhere lands the drip');
  assert.equal(run('JSON.stringify(mini.ivRipples.map(r=>[r.x,r.y,r.tall]))'), JSON.stringify([[W * 0.1, H * 0.9, tall]]), shape + ': a ripple marks it');
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
  done();
  // The pressure: press and hold anywhere pumps; lifting or losing the finger stops.
  recover(0, 1, PRESSURE);
  upright(tall);
  run('mini.pressure=0.3;mini.velocity=0;mini.ivEventGap=99');
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
  done();
}
upright(false);
// The buttons and keys: TAP THE DRIP or HOLD TO PUMP, and Space for either.
recover();
assert.match(nodes.miniControls.innerHTML, /data-action="tap"/);
run("mini.beatLock=0;mini.pos=mini.ivSweep.wins[0].pos;games.recovery.key(' ',{repeat:false,preventDefault(){}})");
assert.equal(run('mini.good'), 1, 'Space taps the drip');
run("mini.beatLock=0;mini.pos=mini.ivSweep.wins.find(w=>!w.hit).pos;games.recovery.key(' ',{repeat:true,preventDefault(){}})");
assert.equal(run('mini.good'), 1, 'a held key does not machine-gun');
done();
recover(0, 1, PRESSURE);
assert.match(nodes.miniControls.innerHTML, /data-action="hold"/);
run("games.recovery.key(' ',{repeat:false,preventDefault(){}})");
assert.equal(run('mini.held'), true, 'Space pumps');
run('mini.held=false');
const holdButton = { dataset: { action: 'hold' }, setPointerCapture: () => {}, classList: { add: () => {} } };
nodes.miniControls.events.pointerdown({ target: { closest: () => holdButton }, pointerId: 3, preventDefault: () => {} });
assert.equal(run('mini.held'), true, 'HOLD TO PUMP pumps');
nodes.miniControls.events.pointerup({ pointerId: 9 });
assert.equal(run('mini.held'), true, 'another finger cannot let it go');
nodes.miniControls.events.pointerup({ pointerId: 3 });
assert.equal(run('mini.held'), false);
done();
for (const phase of [PUMP, PRESSURE]) {
  recover(0, 1, phase);
  assert.match(run('games.recovery.lesson().control'), /screen/, 'the briefing says the screen is the button');
  assert.match(nodes.miniInstruction.textContent, /screen/, 'so does the hint');
  done();
}
close();
for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'setTransform', 'fillText']) run(`delete mc.${k}`);
console.log('PASS: IV touch: tap anywhere, hold anywhere, ripples, cancels never act, buttons and Space.');

// ---- Each phase gets its own full briefing once ----
run('state.briefed=state.briefed.filter(k=>!k.startsWith("recovery:"))');
const brief = phase => {
  close();
  run(`ivRecovery=null;ivRecoveryNext=${phase};openMini(0,true);startMini()`);
  const quick = run('mini.quickBrief');
  run('launchMini()');
  done();
  return quick;
};
assert.equal(brief(PUMP), false, 'the first pump is briefed in full');
assert.equal(brief(PUMP), true, 'then a GO card');
assert.equal(brief(PRESSURE), false, 'the first pressure is briefed in full, too');
assert.equal(brief(PRESSURE), true);
assert.equal(brief(PUMP), true);
// A save from before the pressure came back: the pump was briefed, the pressure was not.
run('state.briefed=state.briefed.filter(k=>!k.startsWith("recovery:"));state.briefed.push("recovery:0")');
assert.equal(brief(PRESSURE), false);
assert.equal(brief(PUMP), true);
close();
console.log('PASS: IV briefings: each phase in full once, then a GO card, old saves included.');

// ---- Idle play loses, both phases, every level and prescription ----
for (const phase of [PUMP, PRESSURE])
  for (let d = 0; d < 3; d++)
    for (let tier = 0; tier < 4; tier++) {
      recover(tier, d, phase);
      for (let n = 0; n < 4000 && run("mini.screen==='play'"); n++) run('updateMini(.05)');
      assert.equal(run('mini.screen'), 'outro', `${NAMES[phase]} L${tier + 1}/P${d}: idle play ends`);
      assert.equal(run('mini.pendingFinish.win'), false, `${NAMES[phase]} L${tier + 1}/P${d}: idle play loses`);
      done();
    }
close();
console.log('PASS: IV idle play loses in both phases at every level and prescription.');

// ---- The bot gets out of bed in both phases, every level and prescription ----
const times = {};
for (const phase of [PUMP, PRESSURE])
  for (let d = 0; d < 3; d++)
    for (let tier = 0; tier < 4; tier++) {
      recover(tier, d, phase);
      const r = JSON.parse(
        run(`(()=>{for(let n=0;n<40000&&mini.screen!=='result';n++){if(mini.screen==='play')ivBotTick();updateMini(1/60);}return JSON.stringify({win:mini.win,miss:mini.miss,t:mini.total});})()`)
      );
      assert.equal(r.win, true, `${NAMES[phase]} P${d} L${tier + 1}: the bot wins the recovery (${r.miss} strikes)`);
      (times[NAMES[phase]] ??= []).push(Math.round(r.t));
      done();
    }
close();
run('ivRecovery=null;ivRecoveryNext=null;state.recoveries=0');
console.log('PASS: IV recovery bot wins both phases at every level and prescription. Seconds:', JSON.stringify(times));
