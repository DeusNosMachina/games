// The 3 AM channel: the sketch pool holds the house voice, the rotation never repeats until the
// pool is spent, tvLateTick walks a full rotation in simulated time, and every sketch draws at
// every size on a strict context. Until tvlate.js joins the build, this loads it into the page.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, assert } = require('./harness.cjs');

const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));

const SRC = fs.readFileSync(path.join(__dirname, '../src/tvlate.js'), 'utf8');
if (run('typeof tvLateDraw') === 'undefined') run(SRC);
const seed = n => run(`var tvRng=${n};Math.random=()=>{tvRng=(tvRng*1664525+1013904223)>>>0;return tvRng/4294967296}`);
seed(4242);

// ---- Source rules ----
assert.ok(!SRC.includes('Math.random'), 'tvlate.js draws randomness only through rand() and pick()');
assert.ok(!/[–—]/.test(SRC), 'no em or en dashes anywhere in tvlate.js');
const globals = [];
let inDecl = false;
for (const lineText of SRC.split('\n')) {
  const top = lineText.match(/^(?:function\s+([\w$]+)|(?:const|let)\s+([\w$]+))/);
  if (top) {
    globals.push(top[1] || top[2]);
    inDecl = !top[1] && !/;\s*$/.test(lineText);
    continue;
  }
  if (/^\S/.test(lineText) && !/^[\]})]/.test(lineText)) inDecl = false;
  const more = inDecl && lineText.match(/^ {2}([\w$]+) = /);
  if (more) globals.push(more[1]);
  if (inDecl && /^ {2}\S.*;\s*$/.test(lineText)) inDecl = false;
}
assert.ok(globals.length > 30, `found the top-level names (${globals.length})`);
for (const name of globals) assert.ok(/^(tvLate|TV_LATE)/.test(name), `global ${name} is prefixed tvLate or TV_LATE`);
for (const name of ['tvLateDraw', 'tvLateTick', 'tvLateCaption', 'tvLateSketches', 'tvLateChannelName']) {
  assert.ok(globals.includes(name), `${name} is defined`);
}
console.log(`PASS: ${globals.length} top-level names, all prefixed; no Math.random; no dashes.`);

// ---- The channel chip ----
assert.equal(run('String(tvLateChannelName)'), '3 AM');
assert.equal(run('`${tvLateChannelName}`'), '3 AM');
assert.equal(run('tvLateChannelName.name'), '3 AM');
assert.equal(run('tvLateChannelName.tagline'), 'Should not exist');
assert.ok(run('Object.isFrozen(tvLateChannelName)'));
for (const fn of ['tvLateDraw', 'tvLateTick', 'tvLateCaption', 'tvLateNow', 'tvLateShow', 'tvLateReset']) {
  assert.equal(run(`typeof ${fn}`), 'function', fn);
}
console.log('PASS: tvLateChannelName is "3 AM" / "Should not exist", and the API is all functions.');

// ---- The pool ----
const sfxNames = json('Object.keys(SFX)');
const pool = json(`tvLateSketches.map(sk => ({
  id: sk.id, name: sk.name, tag: sk.tag, accent: sk.accent, length: sk.length, variants: sk.variants || 1,
  last: !!sk.last, draw: typeof sk.draw, beats: sk.beats
}))`);
assert.ok(pool.length >= 8, `at least 8 sketches (got ${pool.length})`);
assert.equal(new Set(pool.map(sk => sk.id)).size, pool.length, 'unique ids');
assert.equal(new Set(pool.map(sk => sk.name)).size, pool.length, 'unique names');
for (const id of ['juicer', 'cooking', 'weather', 'rowdy', 'apology', 'shopping', 'nature', 'broadcast', 'replay', 'signoff']) {
  assert.ok(pool.some(sk => sk.id === id), `sketch ${id}`);
}
assert.deepEqual(pool.filter(sk => sk.last).map(sk => sk.id), ['signoff'], 'only the sign-off closes a rotation');
const allCaptions = [];
for (const sk of pool) {
  assert.equal(sk.draw, 'function', `${sk.id} draws`);
  assert.ok(sk.length >= 12 && sk.length <= 20, `${sk.id} runs 12 to 20 s (${sk.length})`);
  assert.ok(sk.beats.length >= 2 && sk.beats.length <= 5, `${sk.id} has 2 to 5 beats`);
  assert.ok(typeof sk.tag === 'string' && sk.tag.length > 0 && sk.tag === sk.tag.toUpperCase(), `${sk.id} tag`);
  assert.ok(/^#[0-9a-f]{6}$/i.test(sk.accent), `${sk.id} accent`);
  let prev = -1;
  for (const beat of sk.beats) {
    assert.ok(beat.at > prev && beat.at >= 0 && beat.at <= sk.length - 2, `${sk.id} beat at ${beat.at} is in order and on air`);
    prev = beat.at;
    const texts = Array.isArray(beat.text) ? beat.text : [beat.text];
    if (Array.isArray(beat.text)) assert.equal(beat.text.length, sk.variants, `${sk.id}: one text per variant`);
    for (const text of texts) {
      assert.ok(typeof text === 'string' && text.length > 0, `${sk.id} caption`);
      allCaptions.push({ id: sk.id, text });
    }
    if (beat.cue !== undefined) assert.ok(sfxNames.includes(beat.cue), `${sk.id} cue ${beat.cue} is an sfx name`);
  }
}
assert.equal(new Set(allCaptions.map(c => c.text)).size, allCaptions.length, 'no caption is reused');
const checkCaptions = who => {
  for (const { id, text } of allCaptions) {
    const shown = run(`tvLateFormat(${JSON.stringify(text)})`);
    assert.ok(shown.length < 60, `${id} caption under 60 characters with ${who}: "${shown}" (${shown.length})`);
    assert.ok(!/[–—{}]/.test(shown), `${id}: no dashes, no unfilled names: ${shown}`);
  }
};
checkCaptions('the default name');
run("state.name = 'Alexandriana'");
checkCaptions('a 12-letter name');
assert.equal(run("tvLateFormat('{name}!')"), 'Alexandriana!');
run("state.name = 'Maximilianabella'");
assert.equal(run("tvLateFormat('{name}!')"), 'Macy!', 'long names fall back so captions stay short');
run("state.name = ''");
assert.equal(run("tvLateFormat('{name}!')"), 'Macy!');
const captionCount = allCaptions.length;
console.log(`PASS: ${pool.length} sketches, ${captionCount} captions, every one under 60 characters with no dashes.`);

// ---- Rotation: no repeats until the pool is spent, sign-off last ----
seed(91);
run('tvLateReset()');
const N = pool.length;
const DT = 1 / 30;
const seen = [json('tvLateNow()')];
let guard = 0;
while (seen.length < N * 3 && guard < 200000) {
  run(`tvLateTick(${DT})`);
  const now = json('tvLateNow()');
  const last = seen[seen.length - 1];
  if (now.pos !== last.pos || now.rotation !== last.rotation) seen.push(now);
  guard++;
}
assert.equal(seen.length, N * 3, 'three full rotations aired');
for (let r = 0; r < 3; r++) {
  const block = seen.slice(r * N, r * N + N);
  assert.equal(new Set(block.map(n => n.id)).size, N, `rotation ${r} has no repeats`);
  assert.ok(block.every(n => n.rotation === r), `rotation ${r} is counted`);
  assert.deepEqual(block.map(n => n.pos), [...Array(N).keys()]);
  assert.equal(block[N - 1].id, 'signoff', `rotation ${r} ends with the sign-off`);
}
for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i].id, seen[i - 1].id, 'never the same sketch twice in a row');
const orders = [0, 1, 2].map(r => seen.slice(r * N, r * N + N).map(n => n.id).join(','));
assert.ok(new Set(orders).size > 1, 'the shuffle changes between rotations');
console.log(`PASS: three rotations of ${N}, no repeats inside a rotation, sign-off last, reshuffled each time.`);

// ---- tvLateTick through one full rotation in simulated time ----
seed(5150);
run('tvLateReset()');
const firstOrder = json('tvLateState.order.map(i => tvLateSketches[i].id)');
const total = firstOrder.reduce((sum, id) => sum + pool.find(sk => sk.id === id).length, 0);
const STEP = 1 / 60;
const steps = Math.ceil(total / STEP) + 2;
let clock = 0;
let lastCaption = run('tvLateCaption()');
let lastId = run('tvLateNow().id');
const captionsSeen = [];
const cues = [];
const switches = [];
for (let i = 0; i < steps; i++) {
  const cue = run(`tvLateTick(${STEP})`);
  clock += STEP;
  if (cue !== null) {
    assert.equal(typeof cue, 'string');
    cues.push(cue);
  }
  const now = json('tvLateNow()');
  if (now.id !== lastId) {
    switches.push({ id: now.id, at: clock });
    lastId = now.id;
  }
  const caption = run('tvLateCaption()');
  if (caption !== lastCaption) {
    if (caption) captionsSeen.push({ id: now.id, caption, s: now.s, beat: now.beat });
    lastCaption = caption;
  }
}
assert.equal(run('tvLateNow().rotation'), 1, 'one full rotation in its total running time');
assert.equal(switches.length, N, 'every sketch handed over to the next');
let expectAt = 0;
for (let i = 0; i < N - 1; i++) {
  expectAt += pool.find(sk => sk.id === firstOrder[i]).length;
  assert.equal(switches[i].id, firstOrder[i + 1]);
  assert.ok(Math.abs(switches[i].at - expectAt) < 2 * STEP, `${firstOrder[i + 1]} starts at ${expectAt} s (${switches[i].at.toFixed(3)})`);
}
const beatTotal = firstOrder.reduce((sum, id) => sum + pool.find(sk => sk.id === id).beats.length, 0);
assert.equal(captionsSeen.filter(c => firstOrder.includes(c.id)).length >= beatTotal, true, 'every beat put its caption up');
for (const c of captionsSeen) {
  const sk = pool.find(p => p.id === c.id);
  assert.ok(c.s - sk.beats[c.beat].at < 2 * STEP, `${c.id} caption ${c.beat} appears on its beat`);
}
const cueTotal = firstOrder.reduce((sum, id) => sum + pool.find(sk => sk.id === id).beats.filter(b => b.cue).length, 0);
assert.equal(cues.filter(Boolean).length, cueTotal, 'each cued beat returns its sfx name once');
console.log(`PASS: ${total} s of ticks air ${N} sketches in order, ${beatTotal} captions on their beats, ${cueTotal} cues.`);

// Odd ticks: nothing moves on junk, big gaps are clamped, the clock stays finite.
run("tvLateShow('weather')");
for (const bad of ['NaN', '-3', 'undefined', 'null', "'x'"]) {
  run(`tvLateTick(${bad})`);
  assert.equal(run('tvLateState.s'), 0, `tvLateTick(${bad}) does nothing`);
}
run('tvLateTick(Infinity)');
assert.equal(run('tvLateState.s'), 0, 'Infinity is junk too');
run('tvLateTick(30)');
assert.equal(run('tvLateState.s'), 0.5, 'one tick moves at most half a second');
assert.equal(run("tvLateShow('nope')"), false);
assert.equal(run('tvLateShow(99)'), false);
assert.equal(run("tvLateShow('signoff')"), true);
assert.deepEqual(json('tvLateState.order'), [json("tvLateSketches.findIndex(sk => sk.id === 'signoff')")]);
for (let i = 0; i < 40; i++) run('tvLateTick(0.5)');
assert.notEqual(run('tvLateNow().id'), 'signoff', 'after a sign-off the channel comes back on');
run("tvLateShow('rowdy')");
const fresh = json('tvLateState.order.map(i => tvLateSketches[i].id)');
assert.equal(fresh[0], 'rowdy');
assert.equal(fresh[fresh.length - 1], 'signoff');
assert.equal(new Set(fresh).size, N, 'showing one sketch still lines up the whole pool');
assert.equal(run('tvLateCaption()'), '', 'no caption before the first beat');
console.log('PASS: junk and huge ticks are safe, tvLateShow jumps cleanly, and the sign-off hands back to the pool.');

// ---- Drawing: a strict context ----
run(`var tvProbe = { depth: 0, bad: [], calls: 0, draws: 0, log: null };
var tvStrict = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'save') return () => { tvProbe.depth++; };
    if (k === 'restore') return () => { tvProbe.depth--; if (tvProbe.depth < 0) tvProbe.bad.push('restore without save'); };
    if (k === 'measureText') return s => ({ width: String(s).length * 6.5 });
    return (...args) => {
      tvProbe.calls++;
      if (['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage'].includes(k)) tvProbe.draws++;
      if (tvProbe.log) tvProbe.log.push(String(k) + ':' + args.map(a => typeof a === 'number' ? a.toFixed(3) : typeof a).join(','));
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) tvProbe.bad.push('non-finite ' + String(k));
      if (k === 'ellipse' && (args[2] < 0 || args[3] < 0)) tvProbe.bad.push('negative ellipse radius');
      if (k === 'arc' && args[2] < 0) tvProbe.bad.push('negative arc radius');
      if (k === 'roundRect' && args[4] < 0) tvProbe.bad.push('negative roundRect radius');
      if (k === 'createRadialGradient' && (args[2] < 0 || args[5] < 0)) tvProbe.bad.push('negative gradient radius');
      if ((k === 'fillText' || k === 'strokeText') && (typeof args[0] !== 'string' || !args[0])) tvProbe.bad.push('empty text');
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop(o, c) { if (!(o >= 0 && o <= 1) || /NaN|undefined/.test(c)) tvProbe.bad.push('bad stop'); } };
    };
  },
  set(t, k, v) {
    if (typeof v === 'number' && !Number.isFinite(v)) tvProbe.bad.push('non-finite ' + String(k));
    if (k === 'globalAlpha' && !(v >= 0 && v <= 1)) tvProbe.bad.push('globalAlpha ' + v);
    if (k === 'lineWidth' && !(v >= 0)) tvProbe.bad.push('lineWidth ' + v);
    if (typeof v === 'string' && /NaN|undefined|Infinity/.test(v)) tvProbe.bad.push(String(k) + ' ' + v);
    t[k] = v;
    return true;
  }
});
var tvRandoms = 0;`);
run('var tvRealRandom = Math.random; Math.random = () => { tvRandoms++; return tvRealRandom(); }');

const SIZES = [
  [120, 68],
  [320, 180],
  [600, 338],
  [400, 300],
  [900, 338]
];
const budget = {};
let frames = 0;
for (const sk of pool) {
  const times = new Set([0, 0.1, 0.3, sk.length / 2, sk.length - 0.6, sk.length - 0.05]);
  for (const b of sk.beats) {
    times.add(b.at + 0.05);
    times.add(Math.min(sk.length - 0.01, b.at + 1.1));
  }
  for (let v = 0; v < sk.variants; v++) {
    for (const s of times) {
      for (const [w, h] of SIZES) {
        for (const t of [0, 3.3, 1234.56]) {
          run(`tvLateShow('${sk.id}'); tvLateState.s = ${s}; tvLateState.variant = ${v};`);
          const before = run('tvRandoms');
          run('tvProbe.draws = 0');
          run(`tvLateDraw(tvStrict, ${w}, ${h}, ${t})`);
          run(`tvLateDraw(c, ${w}, ${h}, ${t})`);
          assert.equal(run('tvRandoms'), before, `${sk.id} drawing never consumes randomness`);
          assert.equal(run('tvLateState.s'), s, 'drawing never moves the clock');
          const draws = run('tvProbe.draws');
          budget[sk.id] = Math.max(budget[sk.id] || 0, draws);
          frames++;
        }
      }
    }
  }
}
assert.equal(run('tvProbe.depth'), 0, 'every save() has its restore()');
assert.deepEqual(json('tvProbe.bad'), [], 'no NaN or Infinity, no negative radii, no empty text');
assert.ok(run('tvProbe.calls') > 100000, 'the probe saw the drawing');
console.log(`PASS: ${frames} frames (every sketch, variant, beat and size, three clocks) draw cleanly on a strict context.`);
// drawRowdy alone is 150 to 200 fills; every other sketch is a few gremlins and a few dozen shapes.
for (const [id, n] of Object.entries(budget)) {
  const cap = id === 'rowdy' ? 400 : 150;
  assert.ok(n < cap, `${id} stays under ${cap} fills, strokes and texts per frame (worst ${n})`);
}
console.log(`PASS: fills, strokes and texts per frame, worst case: ${Object.entries(budget).map(([k, n]) => `${k} ${n}`).join(', ')}.`);

// Junk arguments draw nothing and throw nothing.
run('tvProbe.calls = 0');
for (const args of ['null, 600, 338, 1', 'tvStrict, 0, 338, 1', 'tvStrict, 600, -1, 1', 'tvStrict, NaN, 338, 1', 'tvStrict, 600, undefined, 1']) {
  run(`tvLateDraw(${args})`);
}
assert.equal(run('tvProbe.calls'), 0, 'bad sizes draw nothing');
run("tvLateShow('juicer'); tvLateState.s = 5; tvLateDraw(tvStrict, 600, 338, NaN); tvLateDraw(tvStrict, 600, 338)");
assert.deepEqual(json('tvProbe.bad'), [], 'a missing clock is treated as zero');

// Same state, same clock, same picture.
const picture = () => {
  run('tvProbe.log = []');
  run('tvLateDraw(tvStrict, 600, 338, 77.7)');
  return run('(() => { const l = tvProbe.log.join("|"); tvProbe.log = null; return l; })()');
};
for (const sk of pool) {
  run(`tvLateShow('${sk.id}'); tvLateState.s = ${sk.beats[1].at + 0.5}`);
  assert.equal(picture(), picture(), `${sk.id} draws the same frame twice`);
}

// Reduced motion: no roll bar, flicker or static noise, just the wash. reduced is fixed at load,
// so a second page with prefers-reduced-motion counts the same frame.
const signalCalls = `(() => {
  let n = 0;
  const ctx = new Proxy({}, {
    get: (t, k) => k in t ? t[k] : (...a) => {
      n++;
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop() {} };
    },
    set: (t, k, v) => { t[k] = v; return true; }
  });
  tvLateShow('broadcast');
  tvLateState.s = 0.1;
  tvLateDraw(ctx, 600, 338, 4);
  return n;
})()`;
const busyCalls = run(signalCalls);
const childScript = [
  `const { run } = require(${JSON.stringify(path.join(__dirname, 'harness.cjs'))});`,
  `const src = require('node:fs').readFileSync(${JSON.stringify(path.join(__dirname, '../src/tvlate.js'))}, 'utf8');`,
  "if (run('typeof tvLateDraw') === 'undefined') run(src);",
  `process.stdout.write(run('reduced') + ' ' + run(${JSON.stringify(signalCalls)}));`
].join('\n');
const child = spawnSync(process.execPath, ['-e', childScript], {
  env: { ...process.env, GF_REDUCED_MOTION: '1' },
  encoding: 'utf8'
});
assert.equal(child.status, 0, child.stderr);
const [calm, calmCalls] = child.stdout.trim().split(' ');
assert.equal(calm, 'true', 'the child page prefers reduced motion');
assert.ok(Number(calmCalls) < busyCalls, `reduced motion draws less signal noise (${calmCalls} < ${busyCalls} calls)`);
run('Math.random = tvRealRandom');
console.log('PASS: junk draws nothing, frames are repeatable, and reduced motion calms the static.');
