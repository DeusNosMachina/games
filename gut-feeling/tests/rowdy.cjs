// Rowdy the Ram: every pose and the portrait draw cleanly, the cast spec is complete, the copy holds
// the house voice, and the reference brain stays home (never a step toward Macy), cheers on a timer,
// does a screaming run-through of the hallway now and then, and sulks for a second when Macy walks
// out mid-cheer. Until rowdy.js joins the build, this loads it into the harness page itself.
const fs = require('node:fs');
const path = require('node:path');
const { run, assert } = require('./harness.cjs');

// Values cross the VM boundary as JSON so strict deep-equality compares plain data.
const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));

const SRC = fs.readFileSync(path.join(__dirname, '../src/rowdy.js'), 'utf8');
if (run('typeof drawRowdy') === 'undefined') run(SRC);
run('let rng=7707;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');

assert.ok(!SRC.includes('Math.random'), 'rowdy.js draws randomness only through rand() and pick()');

// A counting context: balanced save/restore, finite numbers everywhere, no negative radii.
run(`var rowdyProbe = { depth: 0, bad: [], calls: 0 };
var rowdyCtx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'save') return () => { rowdyProbe.depth++; };
    if (k === 'restore') return () => { rowdyProbe.depth--; };
    return (...args) => {
      rowdyProbe.calls++;
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) rowdyProbe.bad.push(String(k));
      if (k === 'ellipse' && (args[2] < 0 || args[3] < 0)) rowdyProbe.bad.push('negative ellipse');
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop() {} };
    };
  },
  set(t, k, v) { t[k] = v; return true; }
});`);

const poses = json('ROWDY_POSES');
assert.deepEqual(poses, ['idle', 'wave', 'cheer', 'jump', 'point', 'flex', 'gallop', 'hug', 'sad', 'spin']);
run('var rowdyDraws = 0; Math.random = () => { rowdyDraws++; return 0.5; }');
for (const pose of poses) {
  for (const scale of [0.5, 0.81, 1.45, 3]) {
    for (const t of [0, 0.37, 1.9, 13.3, 61.7]) {
      for (const face of [1, -1]) {
        run(`drawRowdy(rowdyCtx, 320, 400, ${scale}, '${pose}', ${t}, { face: ${face}, prop: 'flag' })`);
        run(`drawRowdy(c, 320, 400, ${scale}, '${pose}', ${t}, { face: ${face} })`);
        run(`drawRowdy(rowdyCtx, 320, 400, ${scale}, '${pose}', ${t}, { face: ${face}, poms: true, dust: true })`);
      }
    }
  }
}
run("drawRowdy(rowdyCtx, 10, 10, 1, 'moonwalk', NaN, null)");
run('drawRowdy(rowdyCtx, 10, 10)');
run("drawRowdy(rowdyCtx, 10, 10, 1, 'cheer', 2, { shadow: false })");
// The run-through gallop: poms up (pom-pom hands) and dust behind.
run(`var rowdyKinds = []; var rp = rowdyPose('gallop', 1.3, { poms: true, dust: true });`);
assert.deepEqual(json('rp.arms.map(a => a.kind)'), ['pom', 'pom'], 'run-through: poms up');
assert.equal(run('rp.dust'), true, 'run-through: dust');
assert.deepEqual(json("rowdyPose('gallop', 1.3).arms.map(a => a.kind)"), ['fist', 'fist'], 'a plain gallop keeps its fists');
assert.ok(json("rp.arms.every(a => a.h[1] < -65)"), 'poms held above his head');
for (const s of [24, 44, 88]) {
  for (const t of [0, 3.9, 40]) run(`drawRowdyPortrait(rowdyCtx, 60, 60, ${s}, ${t}); drawRowdyPortrait(c, 60, 60, ${s})`);
}
assert.ok(run('rowdyProbe.calls') > 10000, 'the probe saw the drawing');
assert.equal(run('rowdyProbe.depth'), 0, 'every save() has its restore()');
assert.deepEqual(json('rowdyProbe.bad'), [], 'no NaN or Infinity coordinates, no negative radii');
assert.equal(run('rowdyDraws'), 0, 'drawing never consumes randomness');
run('let rng2=99;Math.random=()=>{rng2=(rng2*1664525+1013904223)>>>0;return rng2/4294967296}');
console.log(`PASS: ${poses.length} poses at 4 scales, 5 times, both facings, plus the portrait, draw cleanly.`);

// The cast spec.
run('var rowdySpec = rowdyNpcSpec()');
const spec = json('rowdySpec');
assert.equal(spec.id, 'rowdy');
assert.equal(spec.name, 'Rowdy the Ram');
assert.equal(spec.voice, 'rowdy');
assert.equal(spec.behavior, 'cheer');
for (const key of ['draw', 'portrait', 'react', 'line', 'pickCheer', 'cheerOk', 'format', 'bubbleTime', 'tick', 'talk'])
  assert.equal(run(`typeof rowdySpec.${key}`), 'function', `spec.${key}`);
assert.ok(spec.height > 100 && spec.height < 160, 'height in world units at the default scale');
assert.ok(spec.scale > 1 && spec.scale < 2);
assert.deepEqual(spec.poses, poses);
assert.deepEqual(spec.timing.autoCheer, [40, 70]);
assert.deepEqual(spec.timing.runFirst, [20, 40]);
assert.deepEqual(spec.timing.runEvery, [100, 160]);
assert.ok(!('gallopSpeed' in spec.timing) && !('greetGap' in spec.timing), 'no gallop-to-Macy timings left');
assert.ok(spec.runCheers.length >= 5 && spec.runCheers.every(c => c.length >= 3 && c.length <= 4), 'run-through cheers of 3 or 4 bursts');
for (const c of spec.runCheers) for (const b of c) assert.ok(b.length <= 30 && !/[\u2013\u2014]/.test(b), `a short burst: ${b}`);
run(`rowdySpec.draw(rowdyCtx, { x: 200, y: 300, pose: 'gallop', mode: 'run', face: -1 }, 2.2)`);
for (const pose of poses) run(`rowdySpec.draw(rowdyCtx, { x: 200, y: 300, pose: '${pose}', face: -1 }, 4.2)`);
run('rowdySpec.draw(rowdyCtx, { x: 200, y: 300 }, 0); rowdySpec.portrait(rowdyCtx, 30, 30, 44)');
assert.equal(run('rowdyProbe.depth'), 0);
assert.deepEqual(json('rowdyProbe.bad'), []);
assert.notEqual(run('rowdyNpcSpec().cheers[0].bubbles'), run('rowdyNpcSpec().cheers[0].bubbles'), 'specs are copies');
console.log('PASS: rowdyNpcSpec() has every field, and its draw and portrait callbacks work.');

// Copy: at least 60 unique lines, cheers of 3 to 5 posed bubbles, the house voice.
const lines = spec.lines;
assert.ok(lines.length >= 60, `at least 60 lines (got ${lines.length})`);
assert.equal(new Set(lines).size, lines.length, 'no duplicate lines');
const all = lines.concat(spec.greet, spec.farewell);
assert.equal(new Set(all).size, all.length, 'greetings and farewells are not reused lines');
assert.ok(spec.greet.length >= 3 && spec.farewell.length >= 3);
for (const text of all) {
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 8 && text.length <= 110, `bubble-sized: ${text}`);
  assert.ok(!/[\u2013\u2014]/.test(text), `no em or en dashes: ${text}`);
}
const ids = new Set();
for (const cheer of spec.cheers) {
  assert.ok(!ids.has(cheer.id), `cheer id ${cheer.id} is unique`);
  ids.add(cheer.id);
  assert.ok(cheer.bubbles.length >= 3 && cheer.bubbles.length <= 5, `${cheer.id} has 3 to 5 bubbles`);
  for (const b of cheer.bubbles) {
    assert.ok(typeof b.text === 'string' && b.text.length > 0 && b.text.length <= 60, `${cheer.id} bubble text`);
    assert.ok(poses.includes(b.pose), `${cheer.id} pose ${b.pose}`);
    assert.ok(!/[\u2013\u2014]/.test(b.text), `${cheer.id}: no dashes`);
  }
  assert.ok([undefined, 'ralphReady', 'won'].includes(cheer.when), `${cheer.id} when`);
}
for (const id of ['ramsey', 'get-well', 'two-bits', 'ralph']) assert.ok(ids.has(id), `cheer ${id}`);
const spell = spec.cheers.find(c => c.id === 'ramsey').bubbles.map(b => b.text).join(' ');
const letters = [...spell.matchAll(/Gimme an? ([A-Z])!/g)].map(m => m[1]).join('');
assert.equal(letters, 'RAMSEY', 'the spell-out spells RAMSEY');
const ralph = spec.cheers.find(c => c.id === 'ralph');
assert.equal(ralph.when, 'ralphReady');
assert.ok(ralph.bubbles.some(b => b.text.includes("RALPH, you're going DOWN")));
assert.ok(spec.cheers.find(c => c.id === 'two-bits').bubbles[0].text.includes('Two bits'));
console.log(`PASS: ${lines.length} unique lines, ${spec.greet.length} greetings, ${spec.farewell.length} farewells, ${spec.cheers.length} cheers.`);

// Formatting and progress-aware lines.
assert.equal(run("rowdyFormat('Go {name}!', { name: 'Macy' })"), 'Go Macy!');
assert.equal(run("rowdyFormat('Go {name}!', { name: '' })"), 'Go Macy!');
assert.equal(run("rowdyFormat('{name} x{n}', { name: 'Jo' }, 3)"), 'Jo x3');
const fresh = run("rowdyStateLines({ name: 'Macy', wardClears: [0,0,0,0,0,0], medals: [[0,0,0]], ralphReady: false })");
assert.ok(fresh.some(s => s.includes('zero and zero')), 'no clears yet');
assert.ok(fresh.some(s => s.includes('medals with your name')), 'no medals yet');
const busy = run("rowdyStateLines({ wardClears: [0,2,2,1,0,0], medals: [[3,3,1],[0,2,0]], ralphReady: true, ralph: false })");
assert.ok(busy.some(s => s.includes('5 ward clean-ups')), 'counts clears');
assert.ok(busy.some(s => s.includes('2 gold medals')), 'counts golds');
assert.ok(busy.some(s => s.includes('RALPH')), 'Ralph is guarding the exit');
const won = run("rowdyStateLines({ wardClears: [0,1,0,0,0,0], medals: [[1]], ralphReady: true, ralph: true, won: true })");
assert.ok(won.some(s => s.includes('parade')), 'the win');
assert.ok(won.some(s => s.includes('One ward clean-up')) && won.some(s => s.includes('Bronze')));
for (const text of fresh.concat(busy, won)) assert.ok(!/[{}\u2013\u2014]/.test(text), `formatted: ${text}`);
for (let i = 0; i < 80; i++) {
  const text = run("rowdyLine({ name: 'Macy', wardClears: [1,1,0,0,0,0], medals: [[3]], ralphReady: true })");
  assert.ok(typeof text === 'string' && !text.includes('{'), 'rowdyLine formats');
}
const picks = new Set();
for (let i = 0; i < 200; i++) picks.add(run('rowdyPickCheer({ ralphReady: true }).id'));
assert.ok(picks.has('ralph') && picks.has('ramsey') && !picks.has('victory'), 'Ralph cheer joins when he guards the exit');
for (let i = 0; i < 100; i++) {
  const id = run('rowdyPickCheer({ ralphReady: false, won: false }).id');
  assert.ok(id !== 'ralph' && id !== 'victory', 'special cheers wait for their moment');
}
console.log('PASS: {name} formatting, progress lines, and cheer picking follow the game state.');

// The reference brain. He lives at home by the nurses' station and never steps toward Macy.
const DT = 1 / 60;
run('var rowdyNpc = { x: 812, y: 270 }; var rowdyEvents = [];');
const tick = env => run(`(() => { const e = rowdyTick(rowdyNpc, ${DT}, ${env}); if (e) rowdyEvents.push(e); return e; })()`);
const pos = () => json('[rowdyNpc.x, rowdyNpc.y]');

// She walks in close, far, and everywhere in between: he stays put (no gallop, no greeting walk).
tick('{ macy: { x: 300, y: 300 }, entered: true, st: state }');
assert.deepEqual(pos(), [812, 270], 'walking in does not send him to her');
assert.notEqual(run('rowdyNpc.mode'), 'gallop');
const firstRun = run('rowdyNpc.nextRun');
assert.ok(firstRun >= 20 && firstRun <= 40, `first run-through booked 20 to 40 s out (${firstRun.toFixed(1)} s)`);
run('rowdyNpc.nextCheer = 9999');
for (const mx of [100, 500, 700, 760, 900, 1500, 3000]) {
  for (let i = 0; i < 60; i++) tick(`{ macy: { x: ${mx}, y: 300 }, st: state }`);
  assert.deepEqual(pos(), [812, 270], `still home with Macy at x ${mx}`);
  if (Math.abs(mx - 812) < 400) assert.equal(run('rowdyNpc.face'), mx > 812 ? 1 : -1, 'facing her from home');
}
console.log('PASS: he stays home wherever Macy stands, facing her, and books a run-through when she walks in.');

// The run-through: the path is the same wherever Macy stands. His home is near the left end of
// [80, 3120], so he sprints right to 3120, screaming a cheer in 3 or 4 bursts, then jogs home.
const runTexts = new Set(json('ROWDY_RUN_CHEERS').flat().map(t => run(`rowdyFormat(${JSON.stringify(t)}, state)`)));
function runThrough(mx, my, envExtra = '') {
  run(`rowdyNpc = { x: 812, y: 270, nextCheer: 9999 }; rowdyEvents = []; Math.random = (() => { let r = 4242; return () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; }; })();`);
  tick(`{ macy: { x: ${mx}, y: ${my} }, entered: true, st: state${envExtra} }`);
  const trail = [];
  let started = -1,
    reached = -1,
    home = -1;
  for (let i = 0; i < 60 * 80 && home < 0; i++) {
    tick(`{ macy: { x: ${mx}, y: ${my} }, st: state${envExtra} }`);
    const [x, y, mode, pose] = json('[rowdyNpc.x, rowdyNpc.y, rowdyNpc.mode, rowdyNpc.pose]');
    trail.push([x, y, mode, pose]);
    if (started < 0 && mode === 'run') started = i * DT;
    if (reached < 0 && started >= 0 && mode === 'home') reached = i * DT;
    if (reached >= 0 && mode === 'idle') home = i * DT;
  }
  return { trail, started, reached, home, events: json('rowdyEvents') };
}
const near = runThrough(812, 300),
  behind = runThrough(200, 300),
  ahead = runThrough(2500, 400),
  gone = runThrough(3100, 520);
assert.ok(near.started >= 20 && near.started <= 40, `first run-through ${near.started.toFixed(1)} s after she walks in`);
for (const r of [behind, ahead, gone]) {
  assert.equal(r.started, near.started, 'the same start whatever her spot');
  assert.deepEqual(r.trail.map(p => [p[0], p[1]]), near.trail.map(p => [p[0], p[1]]), 'the same path whatever her spot');
}
const xs = near.trail.map(p => p[0]),
  far = Math.max(...xs);
assert.equal(far, 3120, 'he sprints to the far end of the hallway');
assert.equal(Math.min(...xs), 812, 'from his side, never past home the other way');
assert.ok(near.trail.every(p => p[1] === 270), 'down his own lane');
const sprint = near.trail.filter(p => p[2] === 'run');
assert.ok(sprint.every(p => p[3] === 'gallop'), 'at a gallop');
for (let i = 1; i < sprint.length; i++) assert.ok(sprint[i][0] >= sprint[i - 1][0], 'one way out');
const sprintTime = near.reached - near.started;
assert.ok(sprintTime > 5 && sprintTime < 9, `a sprint, not a stroll (${sprintTime.toFixed(1)} s)`);
const back = near.trail.filter(p => p[2] === 'home');
for (let i = 1; i < back.length; i++) assert.ok(back[i][0] <= back[i - 1][0], 'one way back');
assert.ok(near.home - near.reached > sprintTime, 'jogging home is slower than the sprint');
assert.deepEqual(near.trail[near.trail.length - 1].slice(0, 4), [812, 270, 'idle', 'idle'], 'and he settles at home');
// Bursts: 3 or 4, all from one run cheer in order, spread along the sprint.
const bursts = near.events;
assert.ok(bursts.length >= 3 && bursts.length <= 4, `${bursts.length} bursts`);
for (const b of bursts) {
  assert.ok(runTexts.has(b.text), `a run-through cheer: ${b.text}`);
  assert.equal(b.pose, 'gallop');
  assert.ok(!/[{}\u2013\u2014]/.test(b.text));
}
const set = json('ROWDY_RUN_CHEERS').map(c => c.map(t => run(`rowdyFormat(${JSON.stringify(t)}, state)`)));
assert.ok(set.some(c => JSON.stringify(c) === JSON.stringify(bursts.map(b => b.text))), 'one whole cheer, in order');
// Where each burst started: one per stretch of the run.
run(`rowdyNpc = { x: 812, y: 270, nextCheer: 9999, nextRun: 0.01, homeX: 812, homeY: 270 }; var burstAt = [];
  for (let i = 0; i < 60 * 12; i++) { const e = rowdyTick(rowdyNpc, ${DT}, { macy: { x: 500, y: 300 }, st: state }); if (e) burstAt.push(rowdyNpc.x); if (rowdyNpc.mode === 'home') break; }`);
const at = json('burstAt'),
  n = at.length,
  span = 3120 - 812;
at.forEach((x, i) => assert.ok(Math.abs(x - 812 - (span * i) / n) < 10, `burst ${i} at its stretch (${x.toFixed(0)})`));
// While he runs past, Macy's distance only ever changes because he is heading for a fixed end.
assert.ok(json('rowdyNpc.run === null || rowdyNpc.mode === "home"'), 'the run ends at the wall');
console.log(`PASS: run-through ${near.started.toFixed(1)} s in: ${sprintTime.toFixed(1)} s sprint to x ${far}, ${bursts.length} bursts, jog home, settle. Same path wherever Macy is.`);

// After the first, one every 100 to 160 s while she is in the hallway; none while she is away.
run(`rowdyNpc = { x: 812, y: 270, nextCheer: 9999 }; rowdyTick(rowdyNpc, ${DT}, { macy: { x: 500, y: 300 }, entered: true, st: state });
  var runStarts = []; var wasRun = false;
  for (let i = 0; i < 60 * 600; i++) {
    rowdyNpc.nextCheer = 9999;
    rowdyTick(rowdyNpc, ${DT}, { macy: { x: 500, y: 300 }, st: state });
    const r = rowdyNpc.mode === 'run';
    if (r && !wasRun) runStarts.push(i * ${DT});
    wasRun = r;
  }`);
const starts = json('runStarts');
assert.ok(starts.length >= 4, `several run-throughs in ten minutes (${starts.length})`);
for (let i = 1; i < starts.length; i++) {
  const gap = starts[i] - starts[i - 1];
  assert.ok(gap >= 100 - 0.1 && gap <= 160 + 0.1, `run-through gap ${gap.toFixed(1)} s`);
}
run(`rowdyNpc = { x: 812, y: 270, nextCheer: 9999, nextRun: 5 };
  for (let i = 0; i < 60 * 60; i++) rowdyTick(rowdyNpc, ${DT}, { macy: null, st: state });`);
assert.deepEqual(json('[rowdyNpc.x, rowdyNpc.mode]'), [812, 'idle'], 'no run-through to an empty hallway');
assert.ok(run('rowdyNpc.nextRun') > 4.9, 'the clock waits for her');
run(`rowdyNpc = { x: 812, y: 270, nextCheer: 9999 };
  for (let i = 0; i < 60 * 300; i++) rowdyTick(rowdyNpc, ${DT}, { macy: { x: 500, y: 300 }, st: state });`);
assert.equal(run('rowdyNpc.x'), 812, 'no run-through until she has walked in');
// Bounds and home from the env; a home at the right end runs left.
run(`rowdyNpc = { x: 2600, y: 300, nextCheer: 9999, nextRun: 0.01 };
  var minX = 9999; for (let i = 0; i < 60 * 12; i++) { rowdyTick(rowdyNpc, ${DT}, { macy: { x: 500, y: 300 }, bounds: [200, 2800], home: [2600, 300], st: state }); minX = Math.min(minX, rowdyNpc.x); }`);
assert.equal(run('minX'), 200, 'from a right-side home he runs to the left bound');
assert.equal(run('rowdyNpc.face'), 1, 'and turns for home');
// A talk cuts a run short: he jogs home from wherever he stopped, then idles.
run(`rowdyNpc = { x: 812, y: 270, nextCheer: 9999, nextRun: 0.01 };
  for (let i = 0; i < 60 * 2; i++) rowdyTick(rowdyNpc, ${DT}, { macy: { x: 500, y: 300 }, st: state });
  rowdyTalk(rowdyNpc, state);
  for (let i = 0; i < 60 * 40; i++) rowdyTick(rowdyNpc, ${DT}, { macy: { x: 500, y: 300 }, st: state });`);
assert.deepEqual(json('[rowdyNpc.x, rowdyNpc.y, rowdyNpc.mode]'), [812, 270, 'idle'], 'back home after a talk mid-run');
console.log(`PASS: run-throughs every 100 to 160 s while she is around (${starts.length} in ten minutes), never to an empty hallway.`);

// Auto cheer every 40 to 70 seconds at home, audience or not, without a step.
run('rowdyNpc = { x: 600, y: 400 }; rowdyEvents = []');
let first = -1;
for (let i = 0; i < 75 * 60; i++) {
  const e = tick('{ macy: null, st: state }');
  if (e && first < 0) first = i * DT;
}
assert.ok(first >= 40 && first <= 70, `first auto cheer at ${first.toFixed(1)} s`);
const cheerTexts = new Set(spec.cheers.flatMap(c => c.bubbles.map(b => run(`rowdyFormat(${JSON.stringify(b.text)}, state)`))));
assert.ok(run('rowdyEvents.length') >= 3, 'a full cheer plays bubble by bubble');
for (const e of run('rowdyEvents')) {
  assert.ok(cheerTexts.has(e.text), `cheer bubble: ${e.text}`);
  assert.ok(poses.includes(e.pose));
}
assert.deepEqual(json('[rowdyNpc.x, rowdyNpc.y]'), [600, 400], 'cheering in place');
for (let i = 0; i < 20; i++) {
  const left = run('(rowdyNpc.mode = "idle", rowdyNpc.nextCheer = undefined, rowdyTick(rowdyNpc, 0, { st: state }), rowdyNpc.nextCheer)');
  assert.ok(left >= 40 && left <= 70, `cheer timer ${left.toFixed(1)} s is 40 to 70 s`);
}
// With Macy watching from up close and from across the hall, he cheers from his spot.
for (const mx of [560, 900, 2000]) {
  run('rowdyNpc = { x: 600, y: 400, nextCheer: 0.01 }; rowdyEvents = []');
  for (let i = 0; i < 60 * 25; i++) tick(`{ macy: { x: ${mx}, y: 420 }, st: state }`);
  assert.ok(run('rowdyEvents.length') >= 3, `a cheer with Macy at x ${mx}`);
  assert.deepEqual(json('[rowdyNpc.x, rowdyNpc.y]'), [600, 400], 'without a step toward her');
}
// The audience-only switch: off by default; on, a due cheer waits for her inside the watch radius.
run('ROWDY_TIMING.cheerOnlyWatched = true; rowdyNpc = { x: 600, y: 400, nextCheer: 0.01 }; rowdyEvents = []');
for (let i = 0; i < 120; i++) tick('{ macy: { x: 2000, y: 420 }, st: state }');
assert.equal(run('rowdyEvents.length'), 0, 'switch on: no cheer to the far end');
tick('{ macy: { x: 700, y: 420 }, st: state }');
assert.equal(run('rowdyNpc.mode'), 'cheer', 'switch on: she steps into range and he starts');
run('ROWDY_TIMING.cheerOnlyWatched = false');

// Mid-cheer walk-away: sad for a second, then a farewell wave. He never follows her.
run('rowdyNpc = { x: 600, y: 400, nextCheer: 0.01 }; rowdyEvents = []');
const start = tick("{ macy: { x: 520, y: 400 }, st: state }");
assert.ok(start && run("rowdyNpc.mode") === 'cheer', 'cheer starts');
tick("{ macy: { x: 520, y: 400 }, st: state }");
let x = 520;
for (let i = 0; i < 200 && run('rowdyNpc.mode') === 'cheer'; i++) {
  x -= 3;
  tick(`{ macy: { x: ${x}, y: 400 }, st: state }`);
}
assert.equal(run('rowdyNpc.mode'), 'sad', 'walking out mid-cheer makes him sad');
assert.equal(run('rowdyNpc.pose'), 'sad');
assert.equal(run('rowdyNpc.say'), null);
let bye = null,
  sadFor = 0;
for (let i = 0; i < 200 && !bye; i++) {
  bye = tick(`{ macy: { x: ${x}, y: 400 }, st: state }`);
  if (!bye) sadFor += DT;
}
assert.ok(sadFor > 0.9 && sadFor < 1.1, `sad for about a second (${sadFor.toFixed(2)} s)`);
assert.equal(bye.pose, 'wave', 'then he recovers with a wave');
assert.ok(spec.farewell.map(s => run(`rowdyFormat(${JSON.stringify(s)}, state)`)).includes(bye.text));
for (let i = 0; i < 300; i++) tick(`{ macy: { x: ${x}, y: 400 }, st: state }`);
assert.deepEqual(json('[rowdyNpc.x, rowdyNpc.y, rowdyNpc.mode]'), [600, 400, 'idle'], 'and stays put');

// Ralph's cheer comes first once he guards the exit; talking gets a line.
run('rowdyNpc = { x: 600, y: 400, nextCheer: 0.01 }');
const ralphStart = run('rowdyTick(rowdyNpc, 0.02, { st: { ralphReady: true, ralph: false, name: "Macy" } })');
assert.equal(run('rowdyNpc.cheer.id'), 'ralph');
assert.ok(ralphStart.text.length > 0);
const talk = run("rowdyTalk(rowdyNpc, state)");
assert.equal(run('rowdyNpc.mode'), 'talk');
assert.ok(talk.text.length > 0 && poses.includes(talk.pose));
console.log('PASS: auto cheers at 40 to 70 s from home, sad then recover on walk-away, Ralph first, never a step toward Macy.');

// Fuzz: whatever Macy does, he only ever moves on a run-through or on the way home from one.
run(`rowdyNpc = { x: 812, y: 270 }; var mx = 812, my = 300, illegal = 0, px = 812, py = 270, ent = true;
  for (let i = 0; i < 60 * 400; i++) {
    mx = Math.max(60, Math.min(3140, mx + (Math.random() - 0.5) * 40)); my = Math.max(200, Math.min(560, my + (Math.random() - 0.5) * 20));
    const mode = rowdyNpc.mode;
    rowdyTick(rowdyNpc, ${DT}, { macy: Math.random() < 0.01 ? null : { x: mx, y: my }, entered: ent, st: state });
    ent = false;
    if ((rowdyNpc.x !== px || rowdyNpc.y !== py) && !['run', 'home'].includes(rowdyNpc.mode) && !['run', 'home'].includes(mode)) illegal++;
    px = rowdyNpc.x; py = rowdyNpc.y;
  }`);
assert.equal(run('illegal'), 0, 'no step outside a run-through');
console.log('PASS: 400 s of Macy wandering: he moves only on his run-throughs.');

// ---- Turning ----
// He turns through hand-drawn views (side, three-quarter, front) and a mirror, never a squash: the
// probe records the narrowest x-to-y scale ratio any draw uses.
run(`var rowdyTurnProbe = { minSx: Infinity, bad: [], depth: 0 };
var rowdyTurnCtx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'save') return () => { rowdyTurnProbe.depth++; };
    if (k === 'restore') return () => { rowdyTurnProbe.depth--; };
    return (...args) => {
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) rowdyTurnProbe.bad.push(String(k));
      if (k === 'ellipse' && (args[2] < 0 || args[3] < 0)) rowdyTurnProbe.bad.push('negative ellipse');
      if (k === 'scale') rowdyTurnProbe.minSx = Math.min(rowdyTurnProbe.minSx, Math.abs(args[0] / args[1]));
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop() {} };
    };
  },
  set(t, k, v) { t[k] = v; return true; }
});`);
for (const pose of poses)
  for (const scale of [0.5, 1.45, 3])
    for (const t of [0, 0.37, 1.9, 13.3])
      for (const face of [1, 0.6, 0.3, 0, -0.3, -0.6, -1]) {
        const head = Math.max(-1, Math.min(1, face - 0.5));
        run(`drawRowdy(rowdyTurnCtx, 320, 400, ${scale}, '${pose}', ${t}, { face: ${face}, head: ${head}, prop: 'flag' })`);
        run(`drawRowdy(rowdyTurnCtx, 320, 400, ${scale}, '${pose}', ${t}, { face: ${face}, poms: true, dust: true })`);
      }
run("drawRowdy(rowdyTurnCtx, 0, 0, 1, 'idle', 0, { face: NaN, head: Infinity })");
assert.equal(run('rowdyTurnProbe.depth'), 0, 'every save() has its restore()');
assert.deepEqual(json('rowdyTurnProbe.bad'), [], 'no NaN or Infinity coordinates, no negative radii');
assert.ok(run('rowdyTurnProbe.minSx') >= 0.5, `never a squash: narrowest ratio ${run('rowdyTurnProbe.minSx')}`);
// The spin goes all the way round: his front, the far side, his back, and back again.
const spinViews = new Set();
for (let i = 0; i < 60; i++) {
  const t = (i / 60) * ((2 * Math.PI) / 7),
    P = json(`(() => { const P = rowdyPose('spin', ${t}); return [P.spinTurn, P.back]; })()`);
  spinViews.add(run(`facingView(${P[0]})`) + (P[1] ? '-back' : ''));
}
for (const v of ['side', 'three', 'front', 'three-back', 'front-back']) assert.ok(spinViews.has(v), `the spin shows ${v}`);
console.log(`PASS: every pose draws at every facing in between, never squashed; the spin goes round through ${spinViews.size} views.`);

// The hallway's npc: a change of face turns him head first through the views, in about 0.22 s.
run("var rowdyTurner = { x: 400, y: 300, pose: 'cheer', face: 1 }; rowdyTurnProbe.minSx = Infinity");
run('rowdySpec.draw(rowdyTurnCtx, rowdyTurner, 10)');
run('rowdyTurner.face = -1');
const rt = [];
for (let i = 1; i <= 30; i++) {
  run(`rowdySpec.draw(rowdyTurnCtx, rowdyTurner, 10 + ${i} / 60)`);
  rt.push(json('[rowdyTurner.rowdyTurn.head, rowdyTurner.rowdyTurn.body]'));
}
const rviews = rt.map(F => run(`facingView(${F[1]})`)),
  rHead = rt.findIndex(F => F[0] <= -1),
  rBody = rt.findIndex(F => F[1] <= -1);
assert.ok(rviews.includes('three') && rviews.includes('front'), `he turns through three-quarter and front: ${rviews.join(' ')}`);
assert.ok(rHead >= 0 && rBody - rHead >= 3, `his head leads (${rHead} vs ${rBody})`);
assert.ok(rBody <= 15, `done in about 0.22 s (${rBody} frames)`);
assert.ok(run('rowdyTurnProbe.minSx') >= 0.5, 'never squashed mid-turn');
// Back the other way mid-turn: no jumps.
run('rowdyTurner.face = 1');
let rPrev = json('rowdyTurner.rowdyTurn.body'),
  rJump = 0;
for (let i = 1; i <= 30; i++) {
  if (i === 4) run('rowdyTurner.face = -1');
  if (i === 7) run('rowdyTurner.face = 1');
  run(`rowdySpec.draw(rowdyTurnCtx, rowdyTurner, 10.5 + ${i} / 60)`);
  const b = json('rowdyTurner.rowdyTurn.body');
  rJump = Math.max(rJump, Math.abs(b - rPrev));
  rPrev = b;
}
assert.ok(rJump <= 2 / (0.22 * 60) + 1e-9, `a flip mid-turn heads back smoothly (${rJump.toFixed(3)} per frame)`);
assert.equal(json('rowdyTurner.rowdyTurn.body'), 1);
// A clock that jumps back (a new visit) never turns him backwards in time.
run('rowdySpec.draw(rowdyTurnCtx, rowdyTurner, 2)');
assert.equal(json('rowdyTurner.rowdyTurn.body'), 1);
assert.equal(run('rowdyTurnProbe.depth'), 0);
assert.deepEqual(json('rowdyTurnProbe.bad'), []);
console.log(`PASS: npc.face turns him head first (${rHead} frames) and body after (${rBody} frames), cheering all the way.`);
