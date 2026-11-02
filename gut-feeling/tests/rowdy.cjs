// Rowdy the Ram: every pose and the portrait draw cleanly, the cast spec is complete, the copy holds
// the house voice, and the reference brain greets, cheers on a timer, and sulks for a second when
// Macy walks out mid-cheer. Until rowdy.js joins the build, this loads it into the harness page itself.
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
      }
    }
  }
}
run("drawRowdy(rowdyCtx, 10, 10, 1, 'moonwalk', NaN, null)");
run('drawRowdy(rowdyCtx, 10, 10)');
run("drawRowdy(rowdyCtx, 10, 10, 1, 'cheer', 2, { shadow: false })");
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

// The reference brain.
const DT = 1 / 60;
run('var rowdyNpc = { x: 600, y: 400 }; var rowdyEvents = [];');
const tick = env => run(`(() => { const e = rowdyTick(rowdyNpc, ${DT}, ${env}); if (e) rowdyEvents.push(e); return e; })()`);
tick("{ macy: { x: 100, y: 420 }, entered: true, st: state }");
assert.equal(run('rowdyNpc.mode'), 'gallop', 'he gallops to Macy when she enters');
assert.equal(run('rowdyNpc.pose'), 'gallop');
assert.equal(run('rowdyNpc.face'), -1, 'facing her');
let greet = null;
for (let i = 0; i < 400 && !greet; i++) greet = tick("{ macy: { x: 100, y: 420 }, st: state }");
assert.ok(greet, 'he arrives and greets');
assert.equal(greet.pose, 'wave');
assert.ok(spec.greet.map(s => run(`rowdyFormat(${JSON.stringify(s)}, state)`)).includes(greet.text));
assert.ok(Math.abs(run('rowdyNpc.x') - 164) < 0.01, 'stops a friendly gap away');
tick("{ macy: { x: 100, y: 420 }, entered: true, st: state }");
assert.notEqual(run('rowdyNpc.mode'), 'gallop', 'one welcome gallop per visit');
for (let i = 0; i < 200; i++) tick("{ macy: { x: 100, y: 420 }, st: state }");
assert.equal(run('rowdyNpc.mode'), 'idle');
for (let i = 0; i < 600; i++) tick('{ macy: null, st: state }');
assert.equal(run('rowdyNpc.x'), 600, 'he trots home to the nurses station');
assert.equal(run('rowdyNpc.pose'), 'idle');

// Auto cheer every 40 to 70 seconds, audience or not.
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
for (let i = 0; i < 20; i++) {
  const left = run('(rowdyNpc.mode = "idle", rowdyNpc.nextCheer = undefined, rowdyTick(rowdyNpc, 0, { st: state }), rowdyNpc.nextCheer)');
  assert.ok(left >= 40 && left <= 70, `cheer timer ${left.toFixed(1)} s is 40 to 70 s`);
}

// Mid-cheer walk-away: sad for a second, then a farewell wave.
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

// Ralph's cheer comes first once he guards the exit; talking gets a line.
run('rowdyNpc = { x: 600, y: 400, nextCheer: 0.01 }');
const ralphStart = run('rowdyTick(rowdyNpc, 0.02, { st: { ralphReady: true, ralph: false, name: "Macy" } })');
assert.equal(run('rowdyNpc.cheer.id'), 'ralph');
assert.ok(ralphStart.text.length > 0);
const talk = run("rowdyTalk(rowdyNpc, state)");
assert.equal(run('rowdyNpc.mode'), 'talk');
assert.ok(talk.text.length > 0 && poses.includes(talk.pose));
console.log('PASS: greet gallop once per visit, auto cheers at 40 to 70 s, sad then recover on walk-away, Ralph first.');
