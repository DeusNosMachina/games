// Macy's greeting poses (hug, fist bump, selfie, high five, wave, and the flinch) draw cleanly at
// every scale girl() is drawn at, and macyGreet(pose, seconds, dir) holds a pose, faces the given way,
// keeps the idles and the stride off while it plays, lets go on its own, and gives way to a step.
const { run, events, assert } = require('./harness.cjs');

const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));
const key = k => events.keydown({ key: k, target: {}, repeat: false, preventDefault: () => {} });
const keyUp = k => events.keyup({ key: k, target: {}, preventDefault: () => {} });
const step = (seconds, dt = 0.05) => run(`for (let i = 0; i < ${Math.round(seconds / dt)}; i++) advanceSimulation(${dt})`);

run('let rng = 2207; Math.random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; }');

// ---- The poses ----
const GREETS = ['hug', 'fistbump', 'selfie', 'highfive', 'wave', 'flinch'];
assert.deepEqual(json('MACY_GREETS'), ['hug', 'fistbump', 'selfie', 'highfive', 'wave']);
for (const p of GREETS) assert.ok(run(`MACY_POSES[${JSON.stringify(p)}] > 0`), `${p} is a pose`);
assert.deepEqual(json('MACY_IDLES'), ['look', 'ball', 'scrunchie', 'dance', 'yawn', 'iv'], 'greetings are not idles');

// A counting context: balanced save/restore, finite numbers everywhere, no negative radii.
run(`var macyProbe = { depth: 0, bad: [], calls: 0 };
var macyCtx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'save') return () => { macyProbe.depth++; };
    if (k === 'restore') return () => { macyProbe.depth--; };
    return (...args) => {
      macyProbe.calls++;
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) macyProbe.bad.push(String(k));
      if (k === 'ellipse' && (args[2] < 0 || args[3] < 0)) macyProbe.bad.push('negative ellipse');
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop() {} };
    };
  },
  set(t, k, v) { t[k] = v; return true; }
});`);
// The ward and the hallway (MACY_SCALE), the title and the wardrobe, the send-off and its share
// card, the map pin, the dream: every size girl() is drawn at, and a big one.
const SCALES = [0.36, 0.8, 1, 1.05, 1.15, 1.2, 1.23, 1.24, run('MACY_SCALE'), 1.45, 3];
for (const pose of GREETS) {
  const len = run(`MACY_POSES.${pose}`);
  for (const scale of SCALES)
    for (const dir of [1, -1])
      for (const f of [0, 0.1, 0.3, 0.5, 0.8, 0.97, 1, 1.4]) {
        const t = len * f;
        run(`girl(macyCtx, 300, 400, ${scale}, 0, ${dir}, false, true, { kind: '${pose}', t: ${t} })`);
        run(`girl(c, 300, 400, ${scale}, 0, ${dir}, false, false, { kind: '${pose}', t: ${t}, len: 4 })`);
      }
  run(`girl(macyCtx, 0, 0, 1, 0, 1, false, true, { kind: '${pose}', t: NaN, len: -1 })`);
}
assert.ok(run('macyProbe.calls') > 20000, 'the probe saw the drawing');
assert.equal(run('macyProbe.depth'), 0, 'every save() has its restore()');
assert.deepEqual(json('macyProbe.bad'), [], 'no NaN or Infinity coordinates, no negative radii');
console.log(`PASS: ${GREETS.length} greeting poses draw at ${SCALES.length} scales, both facings, start to finish.`);

// Each pose puts her arms where it says.
const rig = (pose, t, dir = 1) => json(`(() => { const r = macyRig({ kind: '${pose}', t: ${t} }, ${dir}); return { arms: r.arms, eyes: r.eyes || null, mouth: r.mouth || null, prop: !!r.prop }; })()`);
const hug = rig('hug', 1.2);
assert.ok(hug.arms.every(a => a && a.x > 15 && a.y > -60 && a.y < -40), 'hug: both arms wrapped forward at chest height');
assert.equal(hug.eyes, 'happy', 'hug: eyes closed');
assert.equal(hug.mouth, 'smile', 'hug: a smile');
const hugLeft = rig('hug', 1.2, -1);
assert.ok(hugLeft.arms.every(a => a.x < -15), 'hug facing left reaches left');
const bump = rig('fistbump', 0.6);
assert.ok(bump.arms[1].fist && bump.arms[1].x > 28 && Math.abs(bump.arms[1].y + 46) < 3, 'fist bump: one arm straight out, fist closed');
assert.equal(bump.arms[0], null, 'fist bump: the other arm rests');
const selfie = rig('selfie', 1.3);
assert.ok(selfie.arms[0].top && selfie.arms[0].y < -85, 'selfie: one arm up high');
assert.ok(selfie.arms[1].peace, 'selfie: the other hand a peace sign');
assert.equal(selfie.mouth, 'grin', 'selfie: the big grin');
assert.ok(selfie.prop, 'selfie: the phone');
const five = rig('highfive', 0.5);
assert.ok(five.arms[1].open && five.arms[1].y < -85, 'high five: arm up, open hand');
const wave = rig('wave', 0.9),
  wave2 = rig('wave', 1.05);
assert.ok(wave.arms[1].open && wave.arms[1].y < -80, 'wave: hand up');
assert.notEqual(wave.arms[1].x, wave2.arms[1].x, 'wave: side to side');
const flinch = rig('flinch', 0.1);
assert.equal(flinch.eyes, 'squeeze', 'the flinch stays');
// A stretched pose holds its shape longer.
const held = json(`macyRig({ kind: 'highfive', t: 3, len: 5 }, 1).arms[1]`);
assert.ok(held && held.y < -85, 'act.len stretches a pose');
console.log('PASS: hug, fist bump, selfie, high five and wave each pose her the way they say.');

// ---- macyGreet ----
run('begin(); loadRoom(0); player.x = 505; player.y = 470; enemies = []; player.dir = 1');
assert.equal(run('typeof macyGreet'), 'function');
assert.equal(run("macyGreet('moonwalk', 2, 1)"), false, 'an unknown pose is refused');
assert.equal(run('player.pose'), '');
assert.equal(run("macyGreet('hug', 3, -1)"), true);
assert.deepEqual(json('[player.pose, player.poseLen, player.dir]'), ['hug', 3, -1], 'hug for 3 s, facing left');
run('drawWorld()');
step(2.5);
assert.equal(run('player.pose'), 'hug', 'it holds');
assert.equal(run('player.walk'), 0, 'no stride while it plays');
step(0.6);
assert.equal(run('player.pose'), '', 'and lets go on time');
assert.equal(run('player.dir'), -1, 'still facing the way she greeted');
// Default length, and the other way.
run("macyGreet('fistbump', undefined, 1)");
assert.deepEqual(json('[player.pose, player.poseLen, player.dir]'), ['fistbump', run('MACY_POSES.fistbump'), 1]);
// A new call replaces a running one, clock and all.
step(0.5);
run("macyGreet('selfie', 2.2, -1)");
assert.deepEqual(json('[player.pose, player.poseT, player.poseLen, player.dir]'), ['selfie', 0, 2.2, -1], 'replaced');
// A bad dir leaves her facing where she was; a silly length is clamped.
run("macyGreet('wave', 999, 0)");
assert.deepEqual(json('[player.pose, player.poseLen, player.dir]'), ['wave', 12, -1]);
// No idle starts while a long greeting plays, and the idles come back after.
run("macyGreet('highfive', 10, 1)");
let idled = false;
for (let i = 0; i < 95; i++) {
  step(0.1);
  if (run('macyIsIdle()')) idled = true;
}
assert.equal(idled, false, 'no idle while a greeting plays');
assert.equal(run('player.pose'), 'highfive');
step(1);
assert.equal(run('player.pose'), '', 'done');
let waited = 0;
while (!run('macyIsIdle()') && waited < 8) {
  step(0.1);
  waited += 0.1;
}
assert.ok(run('macyIsIdle()'), 'the idles resume after');
console.log('PASS: macyGreet holds the pose for its seconds, faces the given way, replaces, and keeps idles away.');

// Moving cancels it: a key, a dash, a jump.
run("macyGreet('hug', 5, 1)");
key('a');
run('advanceSimulation(1 / 60)');
assert.equal(run('player.pose'), '', 'a step cancels it at once');
keyUp('a');
step(0.2);
run("macyGreet('wave', 5, 1)");
run('joy.x = 0.6; advanceSimulation(1 / 60); joy.x = 0');
assert.equal(run('player.pose'), '', 'so does the stick');
step(0.2);
run("player.dashCd = 0; macyGreet('selfie', 5, 1); dash(); advanceSimulation(1 / 60)");
assert.equal(run('player.pose'), '', 'so does a dash');
step(1);
// A flinch from a hit replaces it too.
run("macyGreet('hug', 5, 1); player.inv = 0; player.shield = 0; player.z = 0; state.hp = 5; damage('blob')");
for (let i = 0; i < 12 && run('player.pose') !== 'flinch'; i++) run('advanceSimulation(1 / 60)');
assert.equal(run('player.pose'), 'flinch', 'a hit still flinches');
console.log('PASS: a step, the stick or a dash cancels a greeting; a hit flinches over it.');

// ---- Turning ----
// A turn picks a hand-drawn view (side, three-quarter, front) and mirrors it, never squashing her
// through zero width. The probe records the narrowest x-to-y scale ratio any girl() call draws at.
run(`var macyTurnProbe = { minSx: Infinity, bad: [], depth: 0, calls: 0 };
var macyTurnCtx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'save') return () => { macyTurnProbe.depth++; };
    if (k === 'restore') return () => { macyTurnProbe.depth--; };
    return (...args) => {
      macyTurnProbe.calls++;
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) macyTurnProbe.bad.push(String(k));
      if (k === 'ellipse' && (args[2] < 0 || args[3] < 0)) macyTurnProbe.bad.push('negative ellipse');
      // A squash is x shrunk against y: the ratio, not the overall size.
      if (k === 'scale') macyTurnProbe.minSx = Math.min(macyTurnProbe.minSx, Math.abs(args[0] / args[1]));
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop() {} };
    };
  },
  set(t, k, v) { t[k] = v; return true; }
});`);
assert.deepEqual(
  json('[1, 0.8, 0.7, 0.6, 0.3, 0.25, 0.2, 0, -0.2, -0.5, -0.9, -1].map(facingView)'),
  ['side', 'side', 'side', 'three', 'three', 'three', 'front', 'front', 'front', 'three', 'side', 'side'],
  'facingView: side, three-quarter, front by how far round'
);
const FACINGS = [1, 0.85, 0.6, 0.4, 0.2, 0.05, 0, -0.05, -0.2, -0.4, -0.6, -0.85, -1];
const ACTS = [
  'null',
  ...['hug', 'fistbump', 'selfie', 'highfive', 'wave', 'flinch', 'look', 'ball', 'scrunchie', 'dance', 'yawn', 'iv', 'pump', 'grin'].map(
    k => `{ kind: '${k}', t: MACY_POSES.${k} * 0.5 }`
  )
];
for (const scale of SCALES)
  for (const f of FACINGS)
    for (const act of ACTS)
      for (const walk of [0, 1.3, 4.1]) {
        const head = Math.max(-1, Math.min(1, f - 0.6)),
          tail = Math.max(-1.3, Math.min(1.3, f + 0.5));
        run(`girl(macyTurnCtx, 300, 400, ${scale}, ${walk}, ${f}, false, true, ${act}, { head: ${head}, tail: ${tail} })`);
      }
// Odd inputs fall back to her right side.
run('girl(macyTurnCtx, 0, 0, 1, 0, NaN, false, true, null, { head: NaN, tail: Infinity }); girl(macyTurnCtx, 0, 0, 1, 0, 0, false, true, null, null)');
assert.equal(run('macyTurnProbe.depth'), 0, 'every save() has its restore()');
assert.deepEqual(json('macyTurnProbe.bad'), [], 'no NaN or Infinity coordinates, no negative radii');
assert.ok(run('macyTurnProbe.minSx') >= 0.5, `never a squash: smallest x scale ${run('macyTurnProbe.minSx')}`);
console.log(`PASS: every view draws at ${SCALES.length} scales, ${FACINGS.length} facings, ${ACTS.length} poses and the walk, never squashed.`);

// The views really differ: the three-quarter hoodie is narrower than the side and front ones.
run(`var macyRects = []; var macyRectCtx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'roundRect') return (...a) => macyRects.push(a);
    return (...a) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? { addColorStop() {} } : undefined);
  },
  set(t, k, v) { t[k] = v; return true; }
});`);
const torsoW = f =>
  json(`(() => { macyRects = []; girl(macyRectCtx, 0, 0, 1, 0, ${f}, false, false); return macyRects.filter(r => r[1] === -51 && r[3] === 28).map(r => r[2]); })()`);
assert.deepEqual(torsoW(1), [27], 'side: the full hoodie');
assert.deepEqual(torsoW(-0.45), [23], 'three-quarter: narrower');
assert.deepEqual(torsoW(0), [27], 'front: square on');

// A turn in the ward: head first, then the body through three-quarter and front, then the ponytail.
run('begin(); loadRoom(0); player.x = 505; player.y = 470; enemies = []; player.dir = 1; macyClearPose()');
step(1, 1 / 60);
assert.deepEqual(json('[player.facing.body, player.facing.head, player.visualDir]'), [1, 1, 1], 'settled facing right');
run('player.dir = -1; macyTurnProbe.minSx = Infinity');
const frames = [];
for (let i = 0; i < 45; i++) {
  run('advanceSimulation(1 / 60)');
  frames.push(json('[player.facing.head, player.facing.body, player.facing.tail, player.visualDir]'));
  run('girl(macyTurnCtx, 0, 0, MACY_SCALE, player.walk, player.visualDir, false, true, macyAct(), player.facing); drawWorld()');
}
const views = frames.map(F => run(`facingView(${F[1]})`));
const firstAt = (k, v) => frames.findIndex(F => F[k] <= v);
assert.ok(views.includes('three') && views.includes('front'), `the body turns through three-quarter and front: ${views.join(' ')}`);
assert.ok(views.indexOf('three') < views.indexOf('front') && views.lastIndexOf('three') > views.indexOf('front'), 'side, three-quarter, front, three-quarter, side');
const headDone = firstAt(0, -1),
  bodyDone = firstAt(1, -1),
  tailCross = firstAt(2, 0),
  bodyCross = firstAt(1, 0);
assert.ok(headDone >= 0 && bodyDone >= 0, 'both get there');
assert.ok(bodyDone - headDone >= 3, `the head leads by a few frames (${headDone} vs ${bodyDone})`);
assert.ok(bodyDone <= Math.ceil(0.25 * 60), `the body turns in about 0.22 s (${bodyDone} frames)`);
assert.ok(tailCross > bodyCross, `the ponytail lags the body (${tailCross} vs ${bodyCross})`);
assert.ok(Math.min(...frames.map(F => F[2])) < -1.01, 'the ponytail swings past and settles');
assert.ok(Math.abs(frames[frames.length - 1][2] + 1) < 0.05, 'settled');
assert.ok(frames.every(F => F[3] === F[1]), 'visualDir follows the body');
assert.ok(run('macyTurnProbe.minSx') >= 0.5, 'never drawn squashed during the turn');
console.log(`PASS: a turn: head first (${headDone} frames), body through three-quarter and front (${bodyDone} frames), the ponytail a beat behind.`);

// A quick flip mid-turn reverses smoothly: no frame jumps more than the turn's own speed.
run('player.dir = 1');
let prev = json('player.facing.body'),
  maxJump = 0;
for (let i = 0; i < 40; i++) {
  if (i === 5) run('player.dir = -1');
  if (i === 9) run('player.dir = 1');
  run('advanceSimulation(1 / 60)');
  const b = json('player.facing.body');
  maxJump = Math.max(maxJump, Math.abs(b - prev));
  prev = b;
}
assert.ok(maxJump <= 2 / (0.22 * 60) + 1e-9, `no jumps (${maxJump.toFixed(3)} per frame)`);
assert.equal(json('player.facing.body'), 1, 'back where she started');
// Something that sets visualDir outright (a room entry, the send-off) snaps the whole turn.
run('player.dir = -1; player.visualDir = -1; advanceSimulation(1 / 60)');
assert.deepEqual(json('[player.facing.head, player.facing.body, player.facing.tail]'), [-1, -1, -1], 'a snap is a snap');
console.log('PASS: a flip mid-turn heads back smoothly; writing visualDir snaps the turn.');

// Turning to greet someone uses the same turn, and the greeting plays through it.
run('player.dir = 1; player.visualDir = 1; advanceSimulation(1 / 60)');
run("macyGreet('wave', 2, -1)");
const seen = new Set();
for (let i = 0; i < 20; i++) {
  run('advanceSimulation(1 / 60); girl(macyTurnCtx, 0, 0, MACY_SCALE, 0, player.visualDir, false, true, macyAct(), player.facing)');
  seen.add(run('facingView(player.facing.body)'));
  assert.equal(run('player.pose'), 'wave', 'the wave holds through the turn');
}
assert.ok(seen.has('front') && seen.has('three'), 'she turns round to wave, she does not flip');
assert.equal(run('player.facing.body'), -1);
// The walk keeps going through a turn.
run('macyClearPose(); player.dir = 1; player.visualDir = 1; advanceSimulation(1 / 60)');
key('d');
step(0.3, 1 / 60);
keyUp('d');
key('a');
const walks = [];
for (let i = 0; i < 16; i++) {
  run('advanceSimulation(1 / 60); girl(macyTurnCtx, 0, 0, MACY_SCALE, player.walk, player.visualDir, false, true, macyAct(), player.facing)');
  walks.push(json('[player.walk, player.facing.body]'));
}
keyUp('a');
assert.ok(walks.every((w, i) => !i || w[0] > walks[i - 1][0]), 'the stride never stops mid-turn');
assert.ok(walks.some(w => run(`facingView(${w[1]})`) === 'front'), 'and she turns round while walking');
assert.equal(run('macyTurnProbe.depth'), 0);
assert.deepEqual(json('macyTurnProbe.bad'), []);
assert.ok(run('macyTurnProbe.minSx') >= 0.5);
console.log('PASS: greeting and walking both turn her round through the views, pose and stride intact.');
