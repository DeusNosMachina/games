// The send-off (src/discharge.js): the hooks are no-ops until it starts; the hallway exit starts it once
// Macy is discharged and it takes the frame; thirteen beats run on time (two to three minutes) and move
// on with a tap, Space or any ward action; Escape or a long press lands on the final card; the card ends
// by itself; it hands the frame back at the exit with the toast; it replays; a pause or a dialog holds it;
// leaving the room or the title stops it quietly; every beat draws on a strict canvas in landscape and
// portrait without drawing randomness; the share card draws; and reduced motion shortens it.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Record document listeners (the harness drops them) so events can be dispatched through them in order.
process.env.GF_PRELUDE = [
  'var dischargeTestDoc = {};',
  'document.addEventListener = function (type, fn, opts) {',
  '  (dischargeTestDoc[type] = dischargeTestDoc[type] || []).push({ fn: fn, capture: opts === true || !!(opts && opts.capture) });',
  '};'
].join('\n');
const { run, box, events, nodes, assert } = require('./harness.cjs');

const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));
run('var dtRng = 2026; Math.random = () => { dtRng = (dtRng * 1664525 + 1013904223) >>> 0; return dtRng / 4294967296; }');

// ---- Source rules and shape ----
const SRC = fs.readFileSync(path.join(__dirname, '../src/discharge.js'), 'utf8');
assert.ok(!/Math\.random/.test(SRC), 'discharge.js draws randomness only through rand() and pick()');
assert.ok(!SRC.includes('—'), 'no em dashes anywhere in discharge.js');
// Top-level declarations, plus the names continuing a top-level `const a = 1,` list (two-space lines right
// after a line that ends in a comma).
const srcLines = SRC.split('\n'),
  declared = [
    ...SRC.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm),
    ...srcLines.map((l, i) => (i && /,\s*$/.test(srcLines[i - 1]) ? /^ {2}([A-Za-z_$][\w$]*) = /.exec(l) : null)).filter(Boolean)
  ].map(m => m[1]);
const strays = declared.filter(n => !/^(discharge|DISCHARGE)/.test(n) && !['updateDischarge', 'drawDischarge'].includes(n));
assert.deepEqual(strays, [], 'every global in discharge.js starts with discharge or DISCHARGE (plus the two hook names)');
for (const fn of ['dischargeStart', 'updateDischarge', 'dischargeActive', 'drawDischarge', 'dischargeAction'])
  assert.equal(run(`typeof ${fn}`), 'function', `${fn} is defined`);
const beats = json('DISCHARGE_BEATS.map(b => ({ id: b.id, title: b.title, copy: b.copy, dur: b.dur, draw: typeof b.draw }))');
assert.equal(beats.length, 13, 'thirteen beats');
assert.equal(new Set(beats.map(b => b.id)).size, beats.length, 'beat ids are unique');
assert.ok(beats.every(b => b.title && b.copy && b.dur > 0 && b.draw === 'function'), 'every beat has a title, a line of copy, a length and a draw');
assert.equal(beats[beats.length - 1].id, 'card', 'the last beat is the final card');
const words = run(`JSON.stringify([DISCHARGE_BEATS.map(b => [b.title, b.copy]), DISCHARGE_BEAT_LINES, DISCHARGE_MACHINES, DISCHARGE_CRAWL,
  DISCHARGE_TOAST, Object.values(DISCHARGE_WHO).map(w => w[0])])`);
assert.ok(!words.includes('\\u2014') && !words.includes('—'), 'no em dashes in anything anyone reads');
assert.ok(!/grand(ma|pa|mother|father)/i.test(words), 'Mimi and Dodo, never Grandma and Grandpa');
for (const who of ['dad', 'brother', 'mimi', 'dodo', 'presley', 'norah', 'taylor', 'friends', 'casey', 'julez', 'lori', 'benedetto', 'barb', 'stephanie', 'rowdy'])
  assert.ok(json('[].concat(...Object.values(DISCHARGE_BEAT_LINES)).map(l => l[1])').includes(who), `${who} gets a goodbye`);
assert.ok(words.includes('Can I have your room now?') && words.includes('"No."'), 'Riley asks for the room and is told no');
assert.ok(words.includes('GUT FEELING') && words.includes('One Ensure for the road'), 'one last dad joke, one Ensure for the road');
assert.ok(json('DISCHARGE_MACHINES.map(m => m[0])').length === 9, 'nine machines, one opinion each');
assert.equal(run('DISCHARGE_TOAST'), 'Discharged. Again. The nurses are starting to suspect something.');
for (const type of ['keydown', 'pointerdown', 'pointerup', 'pointercancel', 'click']) {
  const list = box.dischargeTestDoc[type] || [];
  assert.ok(list.some(l => l.fn === box.dischargeOnInput && l.capture), `a capture-phase ${type} listener on document`);
}
assert.ok(run("audio.tracks.includes('discharge')"), "music('discharge') exists");
assert.equal(run('JSON.stringify(audio.checkTracks())'), '[]', 'song data lint, the send-off included');
console.log(`PASS: hooks, ${beats.length} beats with copy, house voice, prefixed globals, capture listeners, the discharge track.`);

// ---- Spies and helpers ----
run(`var dtCalls = [];
var dtRealSfx = sfx, dtRealMusic = music;
sfx = function (name, opts) { dtCalls.push('sfx:' + name + (opts && opts.voice ? ':' + opts.voice : '')); return dtRealSfx(name, opts); };
music = function (name) { dtCalls.push('music:' + name); return dtRealMusic(name); };
var dtSentinel = 0;
document.addEventListener('keydown', function () { dtSentinel++; }, true);
document.addEventListener('pointerdown', function () { dtSentinel++; }, true);
document.addEventListener('click', function () { dtSentinel++; }, true);
// Step the send-off: [seconds it held the frame, [beat, time] at each beat change].
function dtRun(seconds, dt) {
  dt = dt || 1 / 60;
  var held = 0, changes = [], t = 0, last = discharge.beat;
  for (var i = 0, n = Math.round(seconds / dt); i < n; i++) {
    var on = updateDischarge(dt);
    t += dt;
    if (on) held += dt;
    if (discharge.beat !== last) { changes.push([discharge.beat, t]); last = discharge.beat; }
    if (!dischargeActive()) break;
  }
  return { held: held, changes: changes, active: dischargeActive(), t: t };
}`);
const count = name => json('dtCalls').filter(c => c === name).length;
const canvasNode = run('canvas');

// Dispatch like a browser: capture listeners on document in order (until one stops it), then the
// keydown handler input.js put on window.
function fire(type, extra = {}) {
  const e = {
    type,
    key: '',
    repeat: false,
    button: 0,
    pointerId: 1,
    pointerType: 'touch',
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
  for (const l of box.dischargeTestDoc[type] || []) {
    if (!l.capture) continue;
    l.fn(e);
    if (e.stopped) break;
  }
  if (!e.stopped && type === 'keydown' && events.keydown) events.keydown(e);
  return e;
}

// ---- Not started: every hook is a no-op ----
run('begin(); hallwayInstall(); goRoom(6); enemies = []; state.paused = false');
assert.equal(run('state.room'), 6, 'in the hallway');
assert.equal(run('dischargeActive()'), false);
assert.equal(run('updateDischarge(1 / 60)'), false, 'updateDischarge gives the frame back when idle');
assert.equal(run("dischargeAction('attack')"), false, 'dischargeAction passes when idle');
assert.equal(run("dischargeAction('tap', { x: 500, y: 300 })"), false);
run('drawDischarge(c, 1000, 625)');
let e = fire('keydown', { key: ' ' });
assert.equal(e.stopped, false, 'keys pass through untouched when idle');
e = fire('pointerdown', { target: canvasNode, clientX: 400, clientY: 300 });
assert.equal(e.stopped, false, 'presses pass through untouched when idle');
fire('click', { target: canvasNode });
console.log('PASS: before it starts, the hooks do nothing and input passes.');

// ---- The hallway exit starts it once she is discharged ----
run("state.won = false; state.ralph = false; player.x = 3090; player.y = 240; hallwayArrival = 0; updateRoomExtras(0.2); dtCalls = []");
assert.equal(run('hallwayTarget && hallwayTarget.kind'), 'exit');
run("roomExtrasAction('attack')");
assert.equal(run('dischargeActive()'), false, 'not discharged: the exit only says what is missing');
run('state.won = true; state.ralph = true; state.stats.dadJokes = 7; state.stats.ensureRefused = 12; state.evictions = 340; state.medals = rooms.slice(0, 6).map(() => [3, 2, 1, 0])');
run("updateRoomExtras(0.4); dtCalls = []; var dtSends = state.stats.sendoffs || 0");
run("roomExtrasAction('attack')");
assert.equal(run('dischargeActive()'), true, 'discharged: the exit plays the send-off');
assert.equal(run('discharge.beat'), 0);
assert.equal(run('state.stats.sendoffs'), run('dtSends') + 1, 'state.stats.sendoffs counts it');
assert.equal(count('music:discharge'), 1, "music('discharge') once");
assert.equal(run('audio.track'), 'discharge');
assert.equal(run('dischargeStart()'), false, 'a second start while it plays does nothing');
assert.equal(run('updateDischarge(1 / 60)'), true, 'it takes the frame');
run("keys.add('d'); var dtX = player.x; updateWorld(0.2); keys.clear()");
assert.equal(run('player.x'), run('dtX'), 'the ward waits: Macy does not walk off');
run('drawWorld()');
assert.equal(run('discharge.errors'), 0, 'drawWorld draws the send-off over the room');
const numbers = json('discharge.numbers');
const row = label => numbers.find(r => r.label === label);
assert.equal(row('DISCHARGE STARS').value, 36, 'her real stars');
assert.equal(row('GREMLINS EVICTED').value, 340, 'her real evictions');
assert.equal(row('DAD JOKES SURVIVED').value, 7, 'dad jokes survived');
assert.equal(row('ENSURES REFUSED').value, 12, 'Ensures refused');
assert.equal(row('RALPH').text, 'EVICTED', 'Ralph, evicted');
assert.ok(row('MEDALS').note.includes('6 of them gold'), 'the gold count');
assert.ok(numbers.every(r => r.label && r.note && !r.note.includes('—')), 'every row has a label and a note');
console.log('PASS: the exit starts it only once she is discharged; it takes the frame, plays its track and reads her numbers.');

// ---- On time: every beat, then the card, then the hallway ----
const pre = run('discharge.t'),
  whole = json('dtRun(400)');
const durs = beats.map(b => b.dur);
let at = 0;
whole.changes.forEach(([beat, t], i) => {
  at += durs[i];
  assert.equal(beat, i + 1, `beat ${i + 1} follows beat ${i}`);
  assert.ok(Math.abs(t + pre - at) < 0.05, `beat ${i + 1} starts on time (${(t + pre).toFixed(2)} vs ${at.toFixed(2)})`);
});
assert.equal(whole.changes.length, beats.length - 1, 'every beat plays, in order');
const total = durs.reduce((a, b) => a + b, 0);
assert.ok(total >= 120 && total <= 185, `two to three minutes (${total.toFixed(1)} s)`);
assert.ok(Math.abs(whole.held + pre - (total + run('DISCHARGE_OUT'))) < 0.1, `it holds the frame the whole way (${(whole.held + pre).toFixed(2)} s)`);
assert.equal(whole.active, false, 'and then lets go');
assert.equal(run('updateDischarge(1 / 60)'), false, 'the ward gets its frame back');
assert.equal(nodes.toast.textContent, 'Discharged. Again. The nurses are starting to suspect something.', 'the toast');
assert.equal(run('audio.track'), 'room:6', 'the hallway music comes back');
assert.equal(run('player.x'), run('HALLWAY_EXIT_X - 70'), 'back in the hallway at the exit');
assert.ok(run('player.y') > 262, 'just outside the exit zone, so a stray press does not replay it');
assert.ok(count('sfx:bossHit') >= 1 && count('sfx:win') >= 2, 'the stamp lands and the card cheers');
for (const voice of ['dad', 'brother', 'grandma', 'grandpa', 'cousin', 'doctor', 'nurse', 'ensure', 'macy', 'rowdy'])
  assert.ok(count('sfx:talk:' + voice) > 0, `${voice} talks`);
assert.ok(count('sfx:countdown') >= 6, 'the elevator counts down the floors');
assert.equal(run('discharge.errors'), 0);
console.log(`PASS: ${beats.length} beats on time, ${total.toFixed(1)} s in all, then the toast at the exit with the hallway track.`);

// ---- On action: a tap, Space, any ward action ----
assert.equal(run('dischargeStart()'), true, 'it replays');
assert.equal(run('discharge.beat'), 0);
assert.equal(run('state.stats.sendoffs'), run('dtSends') + 2);
assert.ok(json('discharge.numbers').some(r => r.label === 'TIMES DISCHARGED' && r.value === run('dtSends') + 2), 'a replay counts on the papers');
run('dtRun(1)');
const kinds = ['attack', 'tap', 'enter', 'jump', 'dash', 'use'];
kinds.forEach((kind, i) => {
  assert.equal(run(`dischargeAction(${JSON.stringify(kind)}, { x: cameraX + 300, y: 300 })`), true, `${kind} is swallowed`);
  assert.equal(run('discharge.beat'), i + 1, `${kind} moves on a beat`);
  assert.equal(run("dischargeAction('attack')"), true);
  assert.equal(run('discharge.beat'), i + 1, 'a second press in the same instant does not skip two');
  run('dtRun(0.3)');
});
assert.equal(run("roomAction('attack')"), true, 'world.js routes ward actions to it');
assert.equal(run('discharge.beat'), kinds.length + 1);
run('dtRun(0.3)');
const sentinel = () => run('dtSentinel');
let before = sentinel(),
  beat = run('discharge.beat');
e = fire('keydown', { key: ' ' });
assert.ok(e.prevented && e.stopped, 'Space is swallowed');
assert.equal(sentinel(), before, 'and goes no further');
assert.equal(run('discharge.beat'), beat + 1, 'Space moves on a beat');
run('dtRun(0.3)');
e = fire('keydown', { key: ' ', repeat: true });
assert.equal(e.stopped, true, 'a held key is swallowed');
assert.equal(run('discharge.beat'), beat + 1, 'but a repeat does not move on');
e = fire('keydown', { key: 'r', metaKey: true });
assert.equal(e.stopped, false, 'browser shortcuts pass');
e = fire('keydown', { key: 'Shift' });
assert.equal(e.stopped, false, 'a lone modifier passes (Shift is JUMP to input.js, which routes it back here)');
run('dtRun(0.3)');
beat = run('discharge.beat');
e = fire('pointerdown', { target: canvasNode, clientX: 500, clientY: 300, pointerId: 4 });
assert.ok(e.prevented && e.stopped, 'a press on the canvas is swallowed');
assert.equal(run('discharge.beat'), beat, 'it waits to see whether it is a tap or a hold');
run('dtRun(0.1)');
fire('pointerup', { pointerId: 4 });
assert.equal(run('discharge.beat'), beat + 1, 'a tap moves on a beat when the finger lifts');
e = fire('click', { target: canvasNode });
assert.equal(e.stopped, true, 'the click after that press is swallowed too');
e = fire('click', { target: canvasNode });
assert.equal(e.stopped, false, 'and only that one');
e = fire('pointerdown', { target: {}, clientX: 5, clientY: 5 });
assert.equal(e.stopped, false, 'a press elsewhere on the page is not ours');
run('dtRun(0.3)');
beat = run('discharge.beat');
fire('pointerdown', { target: canvasNode, clientX: 500, clientY: 300, pointerId: 5 });
run('dtRun(0.1)');
fire('pointercancel', { pointerId: 5 });
assert.equal(run('discharge.beat'), beat, 'a cancelled press does nothing');
console.log('PASS: a tap, Space and every ward action move on one beat; repeats, shortcuts and stray presses do not.');

// ---- Skipping always lands on the final card ----
const last = beats.length - 1;
for (let i = 0; i < last; i++) {
  run(`dischargeGo(${i}); dtRun(0.4)`);
  assert.equal(run("dischargeAction('escape')"), true);
  assert.equal(run('discharge.beat'), last, `skip from beat ${i} lands on the card`);
}
run('dischargeGo(2); dtRun(0.4)');
e = fire('keydown', { key: 'Escape' });
assert.ok(e.stopped, 'Escape is ours while it plays');
assert.equal(run('discharge.beat'), last, 'Escape skips to the card');
run('dischargeGo(5); dtRun(0.4)');
fire('pointerdown', { target: canvasNode, clientX: 500, clientY: 300, pointerId: 6 });
run('dtRun(0.3)');
assert.equal(run('discharge.beat'), 5, 'not a long press yet');
run('dtRun(0.4)');
assert.equal(run('discharge.beat'), last, 'a long press skips to the card');
fire('pointerup', { pointerId: 6 });
assert.equal(run('discharge.beat'), last, 'and letting go after it does not skip the card too');
assert.equal(run('discharge.out'), -1);
// The card never traps: left alone, it ends by itself.
run('dischargeGo(' + last + ')');
const alone = json('dtRun(30)');
assert.equal(alone.active, false, 'the card ends by itself');
assert.ok(alone.held <= durs[last] + run('DISCHARGE_OUT') + 0.05, `in ${alone.held.toFixed(2)} s`);
// A tap on the card heads back, and the fade swallows input until it is done.
run('dischargeStart(); dischargeGo(' + last + '); dtRun(1)');
assert.equal(run("dischargeAction('tap', { x: 2, y: 2 })"), true);
assert.ok(run('discharge.out') >= 0, 'a tap on the card heads back');
assert.equal(run("dischargeAction('attack')"), true, 'input during the fade is swallowed');
run('dtRun(2)');
assert.equal(run('dischargeActive()'), false);
console.log('PASS: Escape, a long press or skip from any beat lands on the card; the card ends on a tap or by itself.');

// ---- Share ----
run('dischargeStart(); dischargeGo(' + last + '); dtRun(1); drawDischarge(c, 1000, 625)');
const share = json('discharge.shareRect');
assert.ok(share && share.w > 40 && share.h > 20, 'the card draws a Share button');
assert.equal(typeof run("dischargeShare()"), 'string', 'Share runs the share-card pipeline');
assert.ok(run('discharge.shareSaid && discharge.shareSaid.text.length > 0'), 'and says what happened on the button');
before = run('discharge.beat');
run(`discharge.shareSaid = null; dischargeAction('tap', { x: cameraX + ${share.x + share.w / 2}, y: wardCameraY + ${share.y + share.h / 2} })`);
assert.ok(run('discharge.shareSaid !== null'), 'a tap on Share shares');
assert.equal(run('discharge.out'), -1, 'and does not head back');
run('discharge.shareSaid = null');
fire('pointerdown', { target: canvasNode, clientX: share.x + share.w / 2, clientY: share.y + share.h / 2, pointerId: 9, pointerType: 'mouse' });
assert.ok(run('discharge.shareSaid !== null'), 'a press on Share shares at once, inside the gesture');
fire('pointerup', { pointerId: 9 });
assert.equal(run('discharge.out'), -1, 'the release after it does not head back');
run('dischargeStop()');
console.log('PASS: the card has a Share button that runs the share-card pipeline on a tap or a press.');

// ---- Held and stopped ----
run('dischargeStart(); dtRun(2); state.paused = true');
let t0 = run('discharge.t');
assert.equal(run('updateDischarge(3)'), true, 'paused: it holds');
assert.equal(run('discharge.t'), t0, 'and its clock stops');
e = fire('keydown', { key: ' ' });
assert.equal(e.stopped, false, 'while paused, keys reach the pause menu');
run('state.paused = false; $$("dialog")[1].showModal()');
assert.equal(run('updateDischarge(3)'), true, 'a dialog holds it too');
assert.equal(run('discharge.t'), t0);
e = fire('keydown', { key: ' ' });
assert.equal(e.stopped, false, 'and keeps its input');
run('$$("dialog")[1].close(); dtCalls = []');
const toastBefore = nodes.toast.textContent;
nodes.toast.textContent = 'sentinel';
run('state.room = 0');
assert.equal(run('updateDischarge(1 / 60)'), false, 'leaving the room ends it quietly');
assert.equal(run('dischargeActive()'), false);
assert.equal(nodes.toast.textContent, 'sentinel', 'no toast when it was cut short');
assert.equal(run('audio.track'), 'room:0', 'and the music goes back to the room');
nodes.toast.textContent = toastBefore;
run('goRoom(6); dischargeStart(); dtRun(1); titleUp = true');
assert.equal(run('updateDischarge(1 / 60)'), false, 'the title ends it quietly');
run('titleUp = false');
console.log('PASS: a pause or a dialog holds it and keeps its input; leaving the room or the title ends it quietly.');

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
  calls = 0,
  texts = [];
function strictFail(msg) {
  throw new Error('strict canvas: ' + msg);
}
function paint(v, what) {
  if (typeof v === 'string') {
    if (!COLOR.test(v)) strictFail(`${what} is not a color: ${v}`);
  } else if (!gradients.has(v)) strictFail(`${what} is not a color or gradient`);
}
const state2d = { ...PROPS };
box.dischargeStrict = new Proxy(
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
        if (k === 'fillText') texts.push(String(a[0]));
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

// A send-off with confetti in the air, then every beat at a spread of moments (each line's start and
// middle too) at desktop, phone landscape, phone portrait, a narrow window and a very short one.
run('dischargeStart(); dischargeGo(5); dtRun(3); discharge.input = "touch"');
assert.ok(run('discharge.fx.length') > 0, 'confetti in the air');
run(`var dtDraws = 0, dtKeep = Math.random;
Math.random = function () { dtDraws++; return dtKeep(); };`);
const SIZES = [
  [1000, 625],
  [1000, 463],
  [540, 1169],
  [760, 625],
  [1000, 300]
];
const lineTimes = json('Object.fromEntries(Object.entries(DISCHARGE_BEAT_LINES).map(([k, v]) => [k, v.map(l => l[0])]))');
let frames = 0;
beats.forEach((b, i) => {
  const times = new Set([0, 0.2, 0.7, b.dur * 0.25, b.dur * 0.5, b.dur * 0.75, b.dur - 0.05]);
  for (const t of lineTimes[b.id] || []) [t, t + 0.15, t + 0.9].forEach(x => x < b.dur && times.add(x));
  for (const [w, h] of SIZES)
    for (const t of times) {
      run(`discharge.beat = ${i}; discharge.T = ${t}; discharge.t = ${t}; drawDischarge(dischargeStrict, ${w}, ${h})`);
      balanced(`${b.id} at ${t.toFixed(2)} (${w} x ${h})`);
      frames++;
    }
  run(`drawDischarge(c, 1000, 625)`);
});
for (const [w, h] of SIZES) {
  run(`discharge.beat = ${last}; discharge.T = 3; discharge.out = 0.4; drawDischarge(dischargeStrict, ${w}, ${h}); discharge.out = -1`);
  balanced(`the fade back at ${w} x ${h}`);
  run(`state.paused = true; drawDischarge(dischargeStrict, ${w}, ${h}); state.paused = false`);
  balanced(`paused at ${w} x ${h}`);
}
assert.equal(run('discharge.errors'), 0, `no beat threw (${run('discharge.lastError')})`);
assert.equal(run('dtDraws'), 0, 'drawing never draws randomness');
run(`var dtCard = dischargeShareDraw(dischargeStrict, { name: 'Macy', date: 'NOV 3, 2026' })`);
balanced('the share card');
assert.deepEqual(json('dtCard'), { w: 1080, h: 1350, kind: 'discharge' }, 'the share card is 1080 x 1350');
run('Math.random = dtKeep; dischargeStop()');
assert.ok(calls > 100000, `the strict canvas saw the drawing (${calls} calls)`);
console.log(`PASS: ${beats.length} beats x ${SIZES.length} sizes, ${frames} frames, the fade, the pause and the share card draw on a strict canvas.`);

// ---- The gallbladder's ghost: waving from a cloud over the doors and the car, three lines, one receipt row ----
const GHOST_LINES = ['Go on without me, kid. I was only holding you back.', 'Save me a seat. Kidding. Eat the fries.', 'Proud of you. Always was.'];
assert.deepEqual(
  json("['doors', 'car'].flatMap(id => DISCHARGE_BEAT_LINES[id].filter(l => l[1] === 'ghost').map(l => l[2]))"),
  GHOST_LINES,
  'the ghost says its three lines, doors then car'
);
for (const id of ['doors', 'car']) {
  const ts = json(`DISCHARGE_BEAT_LINES.${id}.map(l => l[0])`),
    dur = beats.find(b => b.id === id).dur;
  assert.ok(ts.every((t, i) => !i || t > ts[i - 1]) && ts[ts.length - 1] <= dur - 2, `${id}: lines in order, the last with time to read`);
}
assert.ok(GHOST_LINES.every(l => !l.includes('!') && !l.includes('—')), 'the ghost is warm, not shouty');
assert.equal(run("dischargeWho('ghost').name"), 'Gallbladder (ret.)', 'its name tag');
assert.equal(row('GALLBLADDER').text, 'RETIRED', 'the receipt has a gallbladder row');
assert.ok(row('GALLBLADDER').note.includes('Retired with honors'), 'retired with honors');
const doorsI = beats.findIndex(b => b.id === 'doors'),
  carI = beats.findIndex(b => b.id === 'car');
run(`dischargeStart(); var dtGhosts = 0, dtGhostReal = dischargeGhost;
dischargeGhost = function () { dtGhosts++; return dtGhostReal.apply(null, arguments); };`);
const GHOST_SIZES = [...SIZES, [390, 844], [844, 390], [1280, 720]];
const ghostAt = (i, t, w, h) => {
  texts = [];
  run(`dtGhosts = 0; discharge.beat = ${i}; discharge.T = ${t}; discharge.t = ${t}; drawDischarge(dischargeStrict, ${w}, ${h})`);
  balanced(`ghost in beat ${i} at ${t} (${w} x ${h})`);
  return { n: run('dtGhosts'), box: json('discharge.ghost'), cap: json(`dischargeLayout(dischargeStrict, ${w}, ${h}, DISCHARGE_BEATS[${i}]).cap`) };
};
let ghostFrames = 0;
for (const [w, h] of GHOST_SIZES) {
  assert.equal(ghostAt(doorsI, 3.5, w, h).n, 0, `doors (${w} x ${h}): no ghost until she is on her feet`);
  for (const [i, t] of [[doorsI, 5.2], [doorsI, 6.4], [doorsI, 7.6], [carI, 0.5], [carI, 6], [carI, 8], [carI, 10.6]]) {
    const { n, box: gb, cap } = ghostAt(i, t, w, h),
      where = `${beats[i].id} at ${t} (${w} x ${h})`;
    assert.equal(n, 1, `${where}: the ghost draws`);
    assert.ok(gb.x >= -1 && gb.y >= -1 && gb.x + gb.w <= w + 1, `${where}: on screen`);
    assert.ok(!cap || gb.y + gb.h <= cap.y, `${where}: clear of the caption`);
    assert.ok(gb.y + gb.h <= gb.macy[1] + 2, `${where}: up in the sky, above her`);
    ghostFrames++;
  }
}
assert.equal(run('discharge.errors'), 0, `the ghost drew without a throw (${run('discharge.lastError')})`);
// Its lines show up in order as the two beats play.
const heard = [];
for (const [i, D] of [[doorsI, beats[doorsI].dur], [carI, beats[carI].dur]])
  for (let t = 0; t < D; t += 0.25) {
    ghostAt(i, t, 1000, 625);
    const seen = texts.join(' ');
    GHOST_LINES.forEach((l, k) => {
      if (!heard.includes(k) && seen.includes(l.split(' ').slice(0, 3).join(' '))) heard.push(k);
    });
  }
assert.deepEqual(heard, [0, 1, 2], 'the ghost lines appear on screen, in order');
// A cameo on the final card, where there is room for it.
const cameo = SIZES.filter(([w, h]) => ghostAt(last, 3, w, h).n > 0);
assert.ok(cameo.length > 0, `a cameo on the final card (${cameo.map(s => s.join('x')).join(', ')})`);
assert.notEqual(run('dischargeGhostBob(1.3)'), 0, 'it bobs');
run('dischargeGhost = dtGhostReal; dischargeStop()');
console.log(`PASS: the gallbladder's ghost waves in ${ghostFrames} outdoor frames across ${GHOST_SIZES.length} sizes, says its lines in order, retires on the receipt and cameos on the card.`);

// ---- Reduced motion: shorter holds, no shake, sparse confetti ----
{
  const code = `const { run, assert } = require(${JSON.stringify(path.join(__dirname, 'harness.cjs'))});
assert.equal(run('reduced'), true);
run('begin(); hallwayInstall(); goRoom(6); state.won = true');
assert.equal(run('dischargeStart()'), true, 'it still plays');
let shook = 0, t = 0;
while (run('dischargeActive()') && t < 400) { run('updateDischarge(0.25)'); if (run('discharge.shake') > 0) shook++; t += 0.25; }
run('dischargeStart(); dischargeGo(5); for (var i = 0; i < 40; i++) updateDischarge(0.1)');
const fx = run('discharge.fx.length');
const bobs = [0.3, 1.1, 2.9, 7.7].map(x => run('dischargeGhostBob(' + x + ')'));
run('discharge.beat = DISCHARGE_BEATS.findIndex(b => b.id === "car"); var dtBoxes = [6, 6.4, 6.9].map(function (x) { discharge.T = x; drawDischarge(c, 1000, 625); return JSON.stringify(discharge.ghost); })');
const still = new Set(run('dtBoxes')).size === 1 && run('dtBoxes[0]') !== 'null';
run('dischargeStop()');
console.log(JSON.stringify({ t, shook, total: run('dischargeTotal()'), scale: run('DISCHARGE_REDUCED'), fx, errors: run('discharge.errors'), bobs, still }));`;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, GF_REDUCED_MOTION: '1', GF_PRELUDE: '' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.ok(out.total < total * 0.8, `reduced motion is shorter (${out.total.toFixed(1)} s vs ${total.toFixed(1)} s)`);
  assert.ok(Math.abs(out.t - (out.total + run('DISCHARGE_OUT'))) < 0.5, `and runs that long (${out.t} s)`);
  assert.equal(out.shook, 0, 'nothing shakes');
  assert.deepEqual(out.bobs, [0, 0, 0, 0], 'the ghost does not bob');
  assert.ok(out.still, 'the ghost holds still on its cloud');
  assert.equal(out.errors, 0);
  run('goRoom(6); dischargeStart(); dischargeGo(5); for (var i = 0; i < 40; i++) updateDischarge(0.1)');
  const fxNormal = run('discharge.fx.length');
  run('dischargeStop()');
  assert.ok(out.fx < fxNormal, `sparser confetti (${out.fx} vs ${fxNormal})`);
}
console.log('PASS: under prefers-reduced-motion the send-off is shorter, never shakes, keeps the confetti sparse and the ghost still.');
