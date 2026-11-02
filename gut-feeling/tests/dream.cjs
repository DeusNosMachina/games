// Macy's dream (src/dream.js): when one starts (room 5 only, 14 s idle, no gremlins, no dialog, never
// on the title or under reduced motion), how long it runs, what it is made of (5 or 6 distinct vignettes
// from a pool of 12, different each night), waking early on a key or a tap (the event is swallowed),
// the stats, the music and the whooshes, every vignette on a strict canvas, and the dream track and
// effects on a fake Web Audio. world.js does not call these hooks in this build, so the test drives
// updateDream and drawDream itself.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Record document listeners (the harness drops them) so events can be dispatched through them in order.
process.env.GF_PRELUDE = [
  'var dreamTestDoc = {};',
  'document.addEventListener = function (type, fn, opts) {',
  '  (dreamTestDoc[type] = dreamTestDoc[type] || []).push({ fn: fn, capture: opts === true || !!(opts && opts.capture) });',
  '};'
].join('\n');
const { run, box, events, nodes, assert } = require('./harness.cjs');

const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));
run('var dreamRng = 2026; Math.random = () => { dreamRng = (dreamRng * 1664525 + 1013904223) >>> 0; return dreamRng / 4294967296; }');

// ---- Source rules and shape ----
const SRC = fs.readFileSync(path.join(__dirname, '../src/dream.js'), 'utf8');
assert.ok(!/Math\.random/.test(SRC), 'dream.js draws randomness only through rand() and pick()');
assert.ok(!SRC.includes('—'), 'no em dashes anywhere in dream.js');
const declared = [
  ...SRC.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm),
  ...SRC.matchAll(/^ {2}([A-Za-z_$][\w$]*) = /gm)
].map(m => m[1]);
const strays = declared.filter(n => !/^(dream|DREAM)/.test(n) && !['updateDream', 'drawDream'].includes(n));
assert.deepEqual(strays, [], 'every global in dream.js starts with dream or DREAM (plus the two hook names)');
for (const fn of ['updateDream', 'dreamActive', 'drawDream', 'dreamWake', 'dreamStart'])
  assert.equal(run(`typeof ${fn}`), 'function', `${fn} is defined`);
const pool = json('DREAM_POOL.map(d => d.id)');
assert.ok(pool.length >= 10, 'a pool of at least ten vignettes');
assert.equal(new Set(pool).size, pool.length, 'vignette ids are unique');
assert.ok(run('DREAM_POOL.every(d => typeof d.draw === "function" && typeof d.setup === "function" && d.title)'));
assert.ok(run('DREAM_POOL.filter(d => d.voice).every(d => typeof d.typed === "function")'), 'a voiced vignette says how much has typed');
const lines = json('[].concat(DREAM_NURSE_LINES, DREAM_DAD_JOKES, DREAM_ROWDY_WHISPERS)');
assert.ok(lines.includes('You were saying MINE in your sleep.') && lines.includes('You spiked the pillow.'));
assert.ok(lines.some(l => l.includes('INTESTINALE')), 'the gremlin joke in Italian');
assert.ok(json('DREAM_ROWDY_WHISPERS').every(l => l === l.toLowerCase()), 'Rowdy whispers in lowercase');
for (const type of ['keydown', 'pointerdown', 'click']) {
  const list = box.dreamTestDoc[type] || [];
  const mine = list.findIndex(l => l.fn === box.dreamOnInput);
  assert.ok(mine >= 0 && list[mine].capture, `a capture-phase ${type} listener on document`);
  assert.equal(list.findIndex(l => l.capture), mine, `the dream hears ${type} before any other capture listener`);
}
console.log(`PASS: hooks, ${pool.length} vignettes, house voice, prefixed globals, capture listeners first in line.`);

// ---- Spies and helpers ----
run(`var dreamCalls = [];
var dreamRealSfx = sfx, dreamRealMusic = music;
sfx = function (name, opts) { dreamCalls.push('sfx:' + name); return dreamRealSfx(name, opts); };
music = function (name) { dreamCalls.push('music:' + name); return dreamRealMusic(name); };
var dreamSentinelHits = 0;
document.addEventListener('keydown', function () { dreamSentinelHits++; }, true);
document.addEventListener('pointerdown', function () { dreamSentinelHits++; }, true);
document.addEventListener('click', function () { dreamSentinelHits++; }, true);
// Step the dream clock: whether a dream was on at any step, at the end, and for how many seconds.
function dreamRun(seconds, dt) {
  dt = dt || 1 / 120;
  var ever = false, onFor = 0, steps = Math.round(seconds / dt);
  for (var i = 0; i < steps; i++) {
    var on = updateDream(dt);
    if (on) { ever = true; onFor += dt; }
  }
  return { ever: ever, active: dreamActive(), onFor: onFor };
}`);
const count = name => json('dreamCalls').filter(c => c === name).length;

// Dispatch like a browser: capture listeners on document in order (until one stops it), then the
// keydown handler input.js put on window.
function fire(type, extra = {}) {
  const e = {
    type,
    key: '',
    repeat: false,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    cancelable: true,
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
    stopImmediatePropagation() {
      this.stopped = true;
    },
    ...extra
  };
  for (const l of box.dreamTestDoc[type] || []) {
    if (!l.capture) continue;
    l.fn(e);
    if (e.stopped) break;
  }
  if (!e.stopped && type === 'keydown' && events.keydown) events.keydown(e);
  return e;
}

run('begin(); loadRoom(5); enemies = []; state.paused = false');
assert.equal(run('titleUp'), false);
assert.equal(run('state.started'), true);

// ---- When a dream may start ----
for (const room of [0, 1, 2, 3, 4, 6]) {
  run(`state.room = ${room}; enemies = []`);
  assert.equal(json('dreamRun(20)').ever, false, `no dream in room ${room}`);
}
run('state.room = 5; titleUp = true');
assert.equal(json('dreamRun(20)').ever, false, 'no dream on the title screen');
run('titleUp = false; state.started = false');
assert.equal(json('dreamRun(20)').ever, false, 'no dream before the game starts');
run('state.started = true; enemies = [{ hp: 3, x: 500, y: 400 }]');
assert.equal(json('dreamRun(20)').ever, false, 'no dream with a gremlin up');
run('enemies = []; $$("dialog")[1].showModal()');
assert.equal(json('dreamRun(20)').ever, false, 'no dream with a dialog open');
run('$$("dialog")[1].close(); state.paused = true');
assert.equal(json('dreamRun(20)').ever, false, 'no dream while paused');
run('state.paused = false; mini.open = true');
assert.equal(json('dreamRun(20)').ever, false, 'no dream during an arcade run');
run('mini.open = false; enemies = [{ hp: 0, deadT: 1, x: 500, y: 400 }]; player.x = 320; player.y = 420');
assert.equal(json('dreamRun(10)').ever, false);
run('player.x += 4');
assert.equal(json('dreamRun(10)').ever, false, 'moving restarts the idle clock');
run("keys.add('a')");
assert.equal(json('dreamRun(5)').ever, false, 'a held key is not idle');
run('keys.clear(); player.attack = 0.3');
assert.equal(json('dreamRun(1)').ever, false, 'a swing is not idle');
run('player.attack = 0; dreamRun(5); dream.idle = 5');
let e = fire('keydown', { key: 'x' });
assert.equal(e.prevented, false, 'no dream: keys pass through untouched');
assert.equal(run('dream.idle'), 0, 'but any key restarts the idle clock');
assert.equal(run('dreamWake()'), false, 'dreamWake() without a dream only restarts the clock');
run('dreamCalls = []');
assert.equal(json('dreamRun(13.5)').ever, false, 'still awake at 13.5 s');
assert.equal(json('dreamRun(0.6)').active, true, 'asleep once she has been still for 14 s (corpses do not count)');
assert.equal(count('music:dream'), 1, "music('dream') once");
assert.equal(count('sfx:dreamIn'), 1, "sfx('dreamIn') once");
assert.equal(run('updateDream(NaN)'), true, 'a bad dt is harmless');
console.log('PASS: dreams start only in room 5, after 14 s still, with no gremlins, dialogs, pause, arcade or title.');

// ---- A whole dream ----
const plan = json('dream.plan.map(p => ({ id: p.id, start: p.start, dur: p.dur }))');
assert.ok(plan.length === 5 || plan.length === 6, `5 or 6 vignettes (got ${plan.length})`);
assert.equal(new Set(plan.map(p => p.id)).size, plan.length, 'all distinct');
assert.ok(plan.every(p => pool.includes(p.id)), 'all from the pool');
assert.ok(plan.every(p => p.dur >= 5 - 1e-9 && p.dur <= 8 + 1e-9), 'each 5 to 8 s');
plan.forEach((p, i) => i && assert.ok(Math.abs(p.start - plan[i - 1].start - plan[i - 1].dur) < 1e-9, 'back to back'));
const whole = json(`(() => {
  var t = 0, dt = 1 / 120, seen = [], steps = 0, held = true;
  while (dreamActive() && t < 120) {
    var seg = dreamSegmentAt(dream.t);
    if (seg.p && seen[seen.length - 1] !== seg.p.id) seen.push(seg.p.id);
    var on = updateDream(dt);
    if (!on && dreamActive()) held = false;
    t += dt;
  }
  return { t: t, seen: seen, held: held, nurse: dream.nurse };
})()`);
assert.ok(whole.t >= 35 && whole.t <= 45, `a dream runs 35 to 45 s (ran ${whole.t.toFixed(2)})`);
assert.deepEqual(whole.seen, plan.map(p => p.id), 'every vignette shows, in order');
assert.ok(whole.held, 'updateDream is true for the whole dream (the ward waits)');
assert.ok(json('DREAM_NURSE_LINES').includes(whole.nurse), 'the nurse has her line');
assert.equal(count('music:dream'), 1);
assert.equal(count('sfx:dreamIn'), 1);
assert.equal(count('sfx:dreamOut'), 1, "sfx('dreamOut') once");
assert.equal(count('music:room:5'), 1, 'the after-dark track comes back');
assert.equal(run('state.stats.dreams'), 1, 'state.stats.dreams counts it');
assert.ok(count('sfx:talk') > 0, 'the nurse talks in blips');
assert.equal(json('dreamRun(5)').ever, false, 'awake again: the idle clock starts over');
console.log(`PASS: ${plan.length} distinct vignettes (${plan.map(p => p.id).join(', ')}) in ${whole.t.toFixed(1)} s, then the nurse.`);

// ---- Different every night ----
const planFor = seed => json(`(() => { dreamRng = ${seed}; return dreamPlan().map(p => ({ id: p.id, dur: p.dur })); })()`);
assert.deepEqual(planFor(11), planFor(11), 'the same seed dreams the same dream');
assert.notDeepEqual(planFor(11).map(p => p.id), planFor(12).map(p => p.id), 'another seed dreams another');
const sizes = new Set(),
  shown = new Set();
for (let seed = 1; seed <= 120; seed++) {
  const p = planFor(seed * 7919),
    total = p.reduce((a, q) => a + q.dur, 0) + run('DREAM_INTRO + DREAM_WAKE');
  sizes.add(p.length);
  p.forEach(q => shown.add(q.id));
  assert.ok(total >= 35 && total <= 45, `seed ${seed}: ${total.toFixed(2)} s`);
  assert.ok(p.every(q => q.dur >= 5 - 1e-9 && q.dur <= 8 + 1e-9), `seed ${seed}: durations in range`);
  assert.equal(new Set(p.map(q => q.id)).size, p.length);
}
assert.deepEqual([...sizes].sort(), [5, 6], 'some nights five, some six');
assert.equal(shown.size, pool.length, 'every vignette turns up');
run('dreamRng = 4242; dreamCalls = []');
assert.equal(run('dreamStart()'), true);
const second = json('dream.last');
assert.notDeepEqual(second, plan.map(p => p.id), 'the next dream is a different one');
console.log('PASS: plans are seeded, vary in length and order, and cover the whole pool.');

// ---- Waking early ----
run('dreamRun(8)');
const sentinel = () => run('dreamSentinelHits');
let before = sentinel();
e = fire('keydown', { key: 'ArrowLeft' });
assert.equal(e.prevented, true, 'the waking key is swallowed (default prevented)');
assert.equal(e.stopped, true, 'and goes no further');
assert.equal(sentinel(), before, 'no later listener hears it');
assert.equal(run("keys.has('arrowleft')"), false, 'Macy does not walk off');
assert.equal(run('dream.waking'), true, 'the nurse wakes her');
assert.equal(run('state.stats.dreams'), 2);
assert.ok(Math.abs(run('dream.wakeAt + dream.wakeLen - dream.t') - run('DREAM_WAKE_EARLY')) < 1e-9);
const early = json('dreamRun(10)');
assert.ok(early.onFor <= run('DREAM_WAKE_EARLY') + 0.02, `woken early, done in ${early.onFor.toFixed(2)} s`);
assert.equal(early.active, false);
assert.equal(count('sfx:dreamOut'), 1);
assert.equal(count('music:room:5'), 1);

run('dreamCalls = []; dreamStart(); dreamRun(3)');
e = fire('keydown', { key: 'r', metaKey: true });
assert.equal(e.prevented || e.stopped, false, 'browser shortcuts pass');
e = fire('keydown', { key: 'Control' });
assert.equal(e.stopped, false, 'a lone modifier passes');
e = fire('keydown', { key: 'a', repeat: true });
assert.equal(e.stopped, true, 'a held key is swallowed');
assert.equal(run('dream.waking'), false, 'but a repeat does not wake her');
run('state.paused = true');
assert.equal(run('updateDream(1)'), true, 'paused: the dream holds');
const heldAt = run('dream.t');
run('updateDream(1)');
assert.equal(run('dream.t'), heldAt, 'and its clock stops');
e = fire('keydown', { key: 'Escape' });
assert.equal(e.stopped, false, 'while paused, keys reach the pause menu');
run('state.paused = false');
before = sentinel();
e = fire('pointerdown');
assert.ok(e.prevented && e.stopped, 'a tap wakes her and is swallowed');
assert.equal(run('dream.waking'), true);
e = fire('click');
assert.equal(e.stopped, true, 'the click after that tap is swallowed too');
assert.equal(sentinel(), before);
run('dreamRun(0.8)');
fire('pointerdown');
fire('click');
assert.ok(run('dream.wakeAt + dream.wakeLen - dream.t') <= run('DREAM_OUT') * 0.5 + 1e-9, 'a second tap skips to the fade');
run('dreamRun(1)');
assert.equal(run('dreamActive()'), false);
e = fire('click');
assert.equal(e.stopped, false, 'awake: clicks are clicks again');
run('dreamStart(); dreamRun(2)');
assert.equal(run('dreamWake()'), true, 'world.js can wake her with dreamWake()');
assert.equal(run('dream.waking'), true);
run('dreamRun(5); dreamStart(); dreamRun(2); state.room = 0');
assert.equal(run('updateDream(1 / 120)'), false, 'leaving the room ends a dream quietly');
assert.equal(run('dreamActive()'), false);
assert.equal(run('audio.track'), 'room:0', 'and hands the music back to the room');
run('state.room = 5');
console.log('PASS: a key or tap wakes her early with the nurse line and is swallowed; shortcuts and pause pass.');

// ---- Drawing on a strict canvas ----
// Standard 2D context members only, finite numbers, no negative radii, real colors and blend modes,
// balanced save/restore. Anything else throws.
const METHODS = new Set(
  ('save restore scale rotate translate transform setTransform resetTransform beginPath closePath moveTo lineTo ' +
    'quadraticCurveTo bezierCurveTo arc arcTo ellipse rect roundRect fill stroke clip fillRect strokeRect clearRect ' +
    'fillText strokeText measureText drawImage createLinearGradient createRadialGradient setLineDash getLineDash').split(' ')
);
const PROPS = {
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  lineDashOffset: 0,
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  shadowBlur: 0,
  shadowColor: 'transparent',
  shadowOffsetX: 0,
  shadowOffsetY: 0
};
const BLENDS = new Set(['source-over', 'source-atop', 'destination-out', 'multiply', 'screen', 'saturation', 'lighter']);
const COLOR = /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)|transparent)$/i;
const gradients = new WeakSet();
let depth = 0,
  calls = 0;
function strictFail(msg) {
  throw new Error('strict canvas: ' + msg);
}
function paint(v, what) {
  if (typeof v === 'string') {
    if (!COLOR.test(v)) strictFail(`${what} is not a color: ${v}`);
  } else if (!gradients.has(v)) strictFail(`${what} is not a color or gradient`);
}
const state2d = { ...PROPS };
box.dreamStrict = new Proxy(
  {},
  {
    get(t, k) {
      if (typeof k === 'symbol') return undefined;
      if (k in PROPS) return state2d[k];
      if (k === 'canvas') return { width: 1000, height: 625 };
      if (!METHODS.has(k)) strictFail(`unknown member ${String(k)}`);
      return (...a) => {
        calls++;
        a.forEach((x, i) => {
          if (typeof x === 'number' && !Number.isFinite(x)) strictFail(`${k} argument ${i} is ${x}`);
        });
        if (k === 'save') depth++;
        if (k === 'restore' && --depth < 0) strictFail('restore without save');
        if (k === 'arc' && a[2] < 0) strictFail('arc with a negative radius');
        if (k === 'ellipse' && (a[2] < 0 || a[3] < 0)) strictFail('ellipse with a negative radius');
        if (k === 'roundRect' && typeof a[4] === 'number' && a[4] < 0) strictFail('roundRect with a negative radius');
        if ((k === 'fill' || k === 'clip') && a.length && !['nonzero', 'evenodd'].includes(a[0])) strictFail(`${k}(${a[0]})`);
        if (k === 'drawImage' && (!a[0] || typeof a[0] !== 'object')) strictFail('drawImage without an image');
        if (k === 'setLineDash' && !(Array.isArray(a[0]) && a[0].every(Number.isFinite))) strictFail('bad line dash');
        if (k === 'measureText') return { width: String(a[0]).length * 7 };
        if (k === 'createLinearGradient' || k === 'createRadialGradient') {
          if (k === 'createRadialGradient' && (a[2] < 0 || a[5] < 0)) strictFail('radial gradient with a negative radius');
          const grd = {
            addColorStop(o, col) {
              if (!(o >= 0 && o <= 1)) strictFail(`color stop offset ${o}`);
              paint(col, 'color stop');
            }
          };
          gradients.add(grd);
          return grd;
        }
        return undefined;
      };
    },
    set(t, k, v) {
      if (!(k in PROPS)) strictFail(`unknown property ${String(k)}`);
      if (k === 'fillStyle' || k === 'strokeStyle') paint(v, k);
      if (k === 'globalAlpha' && !(Number.isFinite(v) && v >= 0 && v <= 1)) strictFail(`globalAlpha ${v}`);
      if (k === 'lineWidth' && !(Number.isFinite(v) && v >= 0)) strictFail(`lineWidth ${v}`);
      if (k === 'globalCompositeOperation' && !BLENDS.has(v)) strictFail(`blend ${v}`);
      if (k === 'font' && !/\d(\.\d+)?px /.test(v)) strictFail(`font ${v}`);
      if (k === 'textAlign' && !['left', 'right', 'center', 'start', 'end'].includes(v)) strictFail(`textAlign ${v}`);
      state2d[k] = v;
      return true;
    }
  }
);
function balanced(label) {
  if (depth !== 0) strictFail(`${label}: save/restore off by ${depth}`);
}

// Start a dream and pick three variants of each vignette first (both use rand), then draw with
// randomness watched.
assert.equal(run('dreamStart()'), true);
run(`var dreamVariants = DREAM_POOL.map(d => [d.setup(), d.setup(), d.setup()]);
var dreamDraws = 0, dreamKeepRandom = Math.random;
Math.random = function () { dreamDraws++; return dreamKeepRandom(); };`);
const TIMES = [0, 0.35, 1.2, 2.6, 4.1, 5.9, 7.9, 9.1];
let frames = 0;
for (let i = 0; i < pool.length; i++) {
  for (let k = 0; k < 3; k++) {
    for (const sw of [600, 800, 1000]) {
      for (const t of TIMES) {
        const ui = (k + frames) % 2 ? 1.8 : 1,
          full = k === 1 ? `{ x: 0, y: 0, w: ${sw}, h: 625 }` : `{ x: -60, y: -140, w: ${sw + 120}, h: 905 }`;
        run(`dreamView.sw = ${sw}; dreamView.ui = ${ui}; DREAM_POOL[${i}].draw(dreamStrict, ${sw}, ${t}, dreamVariants[${i}][${k}], ${5 + k * 1.5}, ${full})`);
        balanced(`${pool[i]} at ${t}`);
        frames++;
      }
    }
    run(`DREAM_POOL[${i}].draw(c, 1000, 3, dreamVariants[${i}][${k}], 6, { x: 0, y: 0, w: 1000, h: 625 })`);
  }
}
run("dream.nurse = DREAM_NURSE_LINES[2]; dreamView.sw = 1000; dreamView.ui = 1");
for (const awake of [false, true])
  for (const sw of [600, 1000])
    for (const t of [0, 0.4, 1.1, 2.5, 4.4]) {
      run(`dreamBedside(dreamStrict, ${sw}, ${t}, { x: -80, y: -60, w: ${sw + 160}, h: 745 }, ${awake})`);
      balanced(`bedside ${awake ? 'awake' : 'asleep'} at ${t}`);
    }
// The whole pipeline across a dream: crossfades, the intro, the wake-up, at desktop, wide and phone sizes.
const span = run('dream.wakeAt + dream.wakeLen');
for (const [vw, vh] of [
  [1000, 625],
  [1000, 300],
  [540, 1169],
  [760, 625]
]) {
  for (let T = 0; T < span; T += 0.45) {
    run(`dream.t = ${T}; dreamPaint(dreamStrict, ${vw}, ${vh}); drawDream(dreamStrict, ${vw}, ${vh}); drawDream(c, ${vw}, ${vh})`);
    balanced(`frame ${T.toFixed(2)} at ${vw} x ${vh}`);
  }
}
for (const p of json('dream.plan.map(p => p.start)'))
  for (const d of [0.05, 0.4, 0.9]) run(`dream.t = ${p + d}; dreamPaint(dreamStrict, 1000, 625); drawDream(dreamStrict, 1000, 625)`);
balanced('crossfades');
assert.equal(run('dreamDraws'), 0, 'drawing never draws randomness');
run('Math.random = dreamKeepRandom; dream.active = false; dream.waking = false');
assert.ok(calls > 50000, 'the strict canvas saw the drawing');
console.log(`PASS: ${pool.length} vignettes x 3 variants x 3 widths x ${TIMES.length} times, the bedside and whole dreams draw on a strict canvas.`);

// ---- Reduced motion: no dreams at all ----
{
  const code = `const { run, box, assert } = require(${JSON.stringify(path.join(__dirname, 'harness.cjs'))});
assert.equal(run('reduced'), true);
run('begin(); loadRoom(5); enemies = []; state.paused = false');
assert.equal(run('(function () { var on = false; for (var i = 0; i < 1800; i++) on = updateDream(1 / 60) || on; return on; })()'), false);
assert.equal(run('dreamStart()'), false);
assert.equal(run('dreamActive()'), false);
let prevented = false;
assert.equal(box.dreamOnInput({ type: 'keydown', key: 'a', preventDefault() { prevented = true; } }), false);
assert.equal(prevented, false);`;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, GF_REDUCED_MOTION: '1' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
}
console.log('PASS: prefers-reduced-motion turns the whole feature off.');

// ---- The dream track and the whooshes ----
assert.ok(run("audio.tracks.includes('dream')"), "music('dream') exists");
assert.ok(run("audio.sounds.includes('dreamIn') && audio.sounds.includes('dreamOut')"), 'both whooshes exist');
assert.equal(run('JSON.stringify(audio.checkTracks())'), '[]', 'song data lint, the dream included');
{
  // A small recording Web Audio: every node, every frequency, finite times and values.
  const finite = (v, what) => {
    if (!Number.isFinite(v)) throw new TypeError(`${what} must be finite, got ${v}`);
  };
  class Param {
    constructor(v) {
      this.value = v;
      this.first = null;
    }
    setValueAtTime(v, t) {
      finite(v, 'setValueAtTime');
      finite(t, 'time');
      if (this.first === null) this.first = v;
      return this;
    }
    linearRampToValueAtTime(v, t) {
      finite(v, 'ramp');
      finite(t, 'time');
      return this;
    }
    exponentialRampToValueAtTime(v, t) {
      if (!(v > 0)) throw new RangeError('exponential ramp to a non-positive value');
      finite(t, 'time');
      return this;
    }
    setTargetAtTime(v, t, c) {
      finite(v, 'target');
      finite(t, 'time');
      finite(c, 'time constant');
      return this;
    }
    cancelScheduledValues() {
      return this;
    }
    cancelAndHoldAtTime() {
      return this;
    }
  }
  class Node {
    constructor(ctx, kind) {
      this.kind = kind;
      for (const p of ['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release'])
        this[p] = new Param(p === 'gain' ? 1 : 0);
      ctx.nodes.push(this);
    }
    connect(d) {
      return d;
    }
    disconnect() {}
    setPeriodicWave(w) {
      this.wave = w;
    }
    start(t = 0) {
      finite(t, 'start');
      this.startAt = t;
    }
    stop(t = 0) {
      finite(t, 'stop');
    }
  }
  const contexts = [];
  class Ctx {
    constructor() {
      this.currentTime = 0;
      this.state = 'suspended';
      this.sampleRate = 8000;
      this.nodes = [];
      this.destination = new Node(this, 'destination');
      contexts.push(this);
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    createBuffer(c, length) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
    createPeriodicWave(real, imag) {
      return { real, imag };
    }
  }
  for (const [m, kind] of [
    ['createGain', 'gain'],
    ['createOscillator', 'oscillator'],
    ['createBufferSource', 'buffer'],
    ['createBiquadFilter', 'biquad'],
    ['createDynamicsCompressor', 'compressor'],
    ['createStereoPanner', 'panner'],
    ['createDelay', 'delay']
  ])
    Ctx.prototype[m] = function () {
      return new Node(this, kind);
    };
  const timers = new Map();
  let nextTimer = 1;
  box.window.AudioContext = Ctx;
  box.setTimeout = fn => {
    timers.set(nextTimer, fn);
    return nextTimer++;
  };
  box.clearTimeout = id => timers.delete(id);
  assert.equal(run('audio.unlock()'), true);
  const ctx = contexts[0];
  ctx.currentTime = 1;
  for (const name of ['dreamIn', 'dreamOut']) {
    ctx.currentTime += 1;
    const n = ctx.nodes.length;
    run(`dreamRealSfx(${JSON.stringify(name)})`);
    assert.ok(ctx.nodes.length - n >= 4, `${name} is a layered sound`);
  }
  ctx.currentTime += 1;
  const from = ctx.nodes.length;
  run("dreamRealMusic('dream')");
  for (let s = 0; s < 12; s += 0.1) {
    ctx.currentTime += 0.1;
    const due = [...timers.values()];
    timers.clear();
    for (const fn of due) fn();
  }
  const oscs = ctx.nodes.slice(from).filter(n => n.kind === 'oscillator' && n.startAt !== undefined);
  assert.ok(oscs.length > 20, 'the dream track schedules notes');
  // The chorus: each hook note sounds twice, the second voice 0.012 octaves (14 cents) above the first.
  const byStart = new Map();
  for (const o of oscs) {
    const key = o.startAt.toFixed(4);
    byStart.set(key, [...(byStart.get(key) || []), o.frequency.first]);
  }
  const ratio = 2 ** 0.012;
  let doubled = 0;
  for (const fs of byStart.values())
    if (fs.some(a => fs.some(b => Math.abs(b / a - ratio) < 1e-6))) doubled++;
  assert.ok(doubled >= 8, `the hook is doubled 14 cents sharp (${doubled} chorused notes)`);
  run("dreamRealMusic('room:5')");
}
console.log("PASS: music('dream') plays the slowed, chorused hook; sfx('dreamIn') and sfx('dreamOut') layer up.");
