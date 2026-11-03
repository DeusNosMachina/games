// Gurney Grand Prix rules: the registry (four levels, Legendary) and its copy, the course (segments,
// curves, hills, gates, tunnels, night, boost pads, ramps), the projection and crest clipping,
// steering by keys and by where a finger sits (more than one finger too), curves pushing outward, the
// edge (rumble strip, a graze that only slows, a spin-out at speed), crashes (spin and speed, never a
// heart), pads, ramps and air (over traffic, the landing), positions and overtakes, the harder fields,
// donut gates adding time, boosts and the swipe-up gesture, softballs and tap-to-throw, Ralph's block
// and his encore on Legendary, the finish (top three wins, fourth loses, the clock can run out), the
// medal, determinism, idle play losing on all four levels, and drawing at every screen on the wide and
// the tall canvas.
const { run, close, assert } = require('./harness.cjs');
run('let rng=7;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`
var T = {};
// A run in play on an empty road: no rivals in the way, no traffic, Macy centered at the start.
function rcStart(tier, difficulty = 1, empty = true) {
  state.difficulty = difficulty; openMini(3); mini.tier = tier; startMini(); launchMini(); updateMini(1.6);
  if (empty) { for (const c of mini.raceRivals) c.z = mini.raceCourse.finish + 400; mini.raceCars = mini.raceRivals.slice(); }
  keys.clear(); T = {};
}
function rcClose() { mini.open = false; mini.screen = 'lobby'; for (const d of $$('dialog')) d.close(); state.paused = false; }
function rcTick(seconds, dt = 1 / 60) { for (let t = 0; t < seconds - 1e-9; t += dt) updateMini(dt); }
// Puts Macy on segment z at full speed, with nothing spinning or boosting.
function rcAt(z, x = 0) {
  mini.raceZ = z; mini.raceX = x; mini.raceVx = 0; mini.raceV = mini.raceTop; mini.raceSpin = 0; mini.raceSpinOut = false; mini.raceGhost = 0;
  mini.raceAir = 0; mini.raceOffT = 0; mini.racePadT = 0;
}
// A straight road with nothing solid beside it: for the edge tests.
function rcBare() { for (const s of mini.raceCourse.segs) { s.props = s.props.filter(p => !p.solid); s.curve = 0; } }
// No curves, ramps or pads: for tests about traffic and rivals.
function rcFlat() { for (const s of mini.raceCourse.segs) { s.curve = 0; s.lip = null; s.ramp = null; s.pad = null; } }
function rcCar(kind, dz, x, v = 0, racer = false) {
  const c = raceCar({ id: 900 + mini.raceCars.length, kind, racer, name: racer ? 'Test ' + kind : undefined, z: mini.raceZ + dz, lane: 1, pace: v / mini.raceTop, look: 0 });
  c.x = x; c.v = v; if (c.tx === undefined) c.lane = RACE_LANES.reduce((b, L, i) => (Math.abs(L - x) < Math.abs(RACE_LANES[b] - x) ? i : b), 0);
  mini.raceCars.push(c); if (racer) mini.raceRivals.push(c);
  return c;
}
`);
const n = s => run(s),
  j = s => JSON.parse(run('JSON.stringify(' + s + ')'));

// ---- The registry and the copy ----
assert.equal(n('RACE.legendary'), true, 'the race has a Legendary level');
assert.equal(n('miniTierCount(RACE)'), 4);
assert.equal(n('RACE.tierNotes.length'), 4, 'one lobby note per level');
assert.equal(n('RACE_COURSES.length'), 4);
assert.equal(n('RACE_FIELDS.length'), 4);
assert.equal(n('RACE_TIERS.length'), 4);
const copy = j(`[...Object.values(RACE.info), ...RACE.tierNotes, ...[0, 1, 2, 3].flatMap(t => ((mini.tier = t), [RACE.shiftMessage(1), RACE.shiftMessage(2)])),
  ...Object.values(RACE_SPINOUT_LINES).flat(), ...Object.values(RACE_CRASH_LINES)]`);
for (const t of copy) {
  assert.equal(typeof t, 'string');
  assert.ok(t.length > 3);
  assert.doesNotMatch(t, /\u2014/, 'no em-dashes in the copy: ' + t);
}
for (let tier = 0; tier < 4; tier++) {
  n(`rcStart(${tier}, 1, false)`);
  const L = j('RACE.lesson()');
  assert.match(L.goal, new RegExp('out of ' + (n('mini.raceRivals.length') + 1)), 'the briefing counts the field');
  assert.doesNotMatch(L.goal, /\u2014/);
  close();
}
assert.match(n('RACE.tierNotes[3]'), /Ralph, twice/);
console.log('PASS: four levels registered with Legendary, lobby notes, briefings and copy without em-dashes.');

// ---- The course ----
const courses = j(`[0, 1, 2, 3].map(t => { const c = raceBuildCourse(t), s = c.segs.slice(c.start, c.finish);
  return { len: c.finish - c.start, start: c.start, finish: c.finish, gates: c.gates, curve: Math.max(...s.map(q => Math.abs(q.curve))),
    hill: Math.max(...s.map(q => q.y2)) - Math.min(...s.map(q => q.y2)), tunnel: s.some(q => q.tunnel), night: s.some(q => q.night),
    allNight: s.every(q => q.night), climb: s.reduce((a, q) => a + Math.max(0, q.y2 - q.y1), 0), rings: s.filter(q => q.ring).length, after: c.segs.length - c.finish }; })`);
for (const c of courses) {
  assert.ok(c.gates.length >= 1 && c.gates.every(g => g > c.start && g < c.finish), 'gates sit between start and finish');
  assert.ok(c.after >= 150, 'the road runs on past the finish for the camera');
}
assert.ok(courses.every((c, i) => !i || c.len > courses[i - 1].len), 'each level is longer');
assert.ok(courses[0].curve < 3.2 && courses[2].curve >= 6, `level 1 bends gently, level 3 hard: ${courses.map(c => c.curve)}`);
assert.ok(courses[2].hill > courses[0].hill * 3, 'level 3 is a mountain');
assert.equal(courses[0].tunnel, false, 'level 1 has no tunnel');
assert.ok(courses[1].tunnel && courses[1].rings > 20, 'level 2 has a donut tunnel');
assert.ok(courses[2].tunnel && courses[2].night && !courses[2].allNight, 'level 3 has the night tunnel');
assert.ok(courses[3].allNight && courses[3].tunnel && courses[3].curve >= 6.5, 'Legendary is lights out the whole way, tunnels and the sharpest bends');
assert.ok(courses[3].climb >= courses[2].climb, 'and the most climbing');
assert.equal(n('JSON.stringify(raceBuildCourse(2).segs.map(s => s.curve + ":" + s.y2))'), n('JSON.stringify(raceBuildCourse(2).segs.map(s => s.curve + ":" + s.y2))'), 'the same level builds the same course');
// Chevrons stand on the outside of curves and point the way the road bends.
assert.ok(n('raceBuildCourse(0).segs.every(s => s.props.every(p => p.kind !== "chevron" || (Math.sign(p.x) === -Math.sign(s.curve) && p.dir === Math.sign(s.curve))))'));
// Pads and ramps are placed by hand: on the road, out of the tunnels, more of them each level, and
// Legendary has full-width ramps on its blind crests.
const feats = j(`[0, 1, 2, 3].map(t => { const c = raceBuildCourse(t);
  return { pads: c.pads.length, ramps: c.ramps.length, crest: c.ramps.filter(r => r.w >= 1).length,
    padsOn: c.pads.every(p => Math.abs(p.x) + p.w <= 1 && p.z > c.start && p.z + p.len < c.finish && c.segs[p.z].pad === p),
    rampsOn: c.ramps.every(r => r.z > c.start && r.end < c.finish && (r.w >= 1 || Math.abs(r.x) + r.w <= 1) && c.segs[r.end - 1].lip === r),
    dry: c.ramps.every(r => c.segs.slice(r.z, r.end + 60).every(s => !s.tunnel)) }; })`);
for (const f of feats) assert.ok(f.padsOn && f.rampsOn && f.dry, 'pads and ramps sit on the road, ramps never in a tunnel: ' + JSON.stringify(f));
assert.ok(feats.every((f, i) => f.pads >= 5 && f.ramps >= 2 && (!i || (f.pads >= feats[i - 1].pads && f.ramps >= feats[i - 1].ramps))), 'more pads and ramps each level');
assert.ok(feats[3].crest >= 2 && feats[3].ramps > feats[0].ramps, 'Legendary jumps its blind crests');
// Random traffic stays off every ramp's run-up and landing; what sits there was put there on purpose.
for (let tier = 0; tier < 4; tier++) {
  n(`state.difficulty = 1;openMini(3);mini.tier = ${tier};startMini()`);
  const bad = j(`mini.raceCars.filter(c => !c.racer && !mini.raceCourse.parked.some(o => o.z === c.z) &&
    (mini.raceCourse.ramps.some(r => c.z > r.z - 45 && c.z < r.end + 60) ||
     (!c.pace && mini.raceCourse.pads.some(p => Math.abs(p.z - c.z) < 10 && Math.abs(p.x - RACE_LANES[c.lane]) < 0.45)))).length`);
  assert.equal(bad, 0, `level ${tier + 1}: no stray traffic on a ramp or parked on a pad`);
  assert.equal(n('mini.raceCourse.parked.every(o => mini.raceCars.some(c => c.z === o.z && c.kind === o.kind))'), true, 'the hand-placed obstacles are on the road');
  close();
}
console.log('PASS: four courses, longer and harder each level, with gates, tunnels, night, chevrons, pads and ramps.');

// ---- Projection ----
n('rcStart(0);rcAt(mini.raceCourse.start + 20);T.v = raceView({ w: 800, h: 500 })');
assert.ok(n('T.v.rows[5].y1 > T.v.rows[40].y1 && T.v.rows[5].w1 > T.v.rows[40].w1'), 'near road is lower and wider');
assert.ok(n('Math.abs(T.v.rows[10].x1 - 400) < 2'), 'a straight road runs up the middle');
n('rcAt(mini.raceCourse.segs.findIndex((s, i) => i > 200 && s.curve > 2) - 30);T.v = raceView({ w: 800, h: 500 })');
assert.ok(n('T.v.rows[100].x1 > T.v.rows[10].x1 + 40'), 'a right-hand bend draws to the right');
// Level 3's first crest hides the road behind it.
close();
n('rcStart(2);T.crest = mini.raceCourse.segs.findIndex((s, i) => i > 300 && s.y2 < s.y1 - 30);rcAt(T.crest - 25);T.v = raceView({ w: 800, h: 500 })');
assert.ok(n('T.v.rows.some(r => r.ok && !r.vis)'), 'segments behind a crest are hidden');
assert.ok(n('T.v.rows.filter(r => r.vis).every((r, i, a) => !i || r.y2 < a[i - 1].y2)'), 'visible rows climb the screen');
const tall = j('(() => { const v = raceView({ w: 450, h: 800 }); return { hy: v.hy, w: v.rows[8].w1, tall: v.tall, sp: v.sp }; })()');
assert.ok(tall.tall && tall.hy < 800 * 0.35 && tall.sp > 1, 'the tall canvas raises the horizon and enlarges sprites');
close();
console.log('PASS: perspective rows, bends, crest clipping, and the tall-canvas framing.');

// ---- Steering ----
n('rcStart(0)');
assert.deepEqual(j('[raceSteerAt(20, 800), raceSteerAt(240, 800), raceSteerAt(400, 800), raceSteerAt(470, 800), raceSteerAt(780, 800)].map(v => +v.toFixed(2))'), [-1, -1, 0, 0.44, 1]);
n('rcAt(mini.raceCourse.start + 20);arcadeDown({ x: 720, y: 450 });rcTick(0.3)');
assert.ok(n('mini.raceX') > 0.4, 'holding the right half steers right');
n('arcadeMove({ x: 80, y: 450 });T.x = mini.raceX;rcTick(0.4)');
assert.ok(n('mini.raceX') < n('T.x') - 0.4, 'dragging across the screen steers the other way');
n('arcadeMove({ x: 410, y: 450 });T.x = mini.raceX;rcTick(0.3)');
assert.ok(Math.abs(n('mini.raceX - T.x')) < 0.2, 'near the middle steers gently');
n('arcadeUp();T.x = mini.raceX;rcTick(0.3)');
assert.ok(Math.abs(n('mini.raceX - T.x')) < 0.05, 'letting go stops steering on a straight');
// A second thumb takes over while it is down; lifting it hands steering back.
n('arcadeDown({ x: 60, y: 450 });arcadePointer = 1;T.c = $("miniCanvas");' +
  'racePointerEvent({ type: "pointerdown", pointerId: 7, target: T.c, clientX: 700 * 1000 / 800, clientY: 300 });');
assert.equal(n('raceSteerInput()'), 1, 'the newest finger steers');
n('racePointerEvent({ type: "pointerup", pointerId: 7, target: T.c, clientX: 0, clientY: 0 })');
assert.equal(n('raceSteerInput()'), -1, 'the first finger takes back over');
n('arcadeUp(true);arcadePointer = null');
assert.equal(n('mini.racePtrs.length'), 0, 'a lost pointer drops every finger');
// Keys beat fingers.
n('keys.add("arrowleft");arcadeDown({ x: 760, y: 450 })');
assert.equal(n('raceSteerInput()'), -1);
n('keys.clear();arcadeUp()');
close();
console.log('PASS: steering by keys, by where a finger sits, by dragging, and with two thumbs.');

// ---- Curves and the grass ----
n('rcStart(0);T.bend = mini.raceCourse.segs.findIndex((s, i) => i > 200 && s.curve > 2.1);rcAt(T.bend + 5);rcTick(0.8)');
assert.ok(n('mini.raceX') < -0.3, 'a right-hand bend pushes you out to the left');
n('rcAt(T.bend + 5);arcadeDown({ x: 448, y: 450 });rcTick(0.8);arcadeUp()');
assert.ok(Math.abs(n('mini.raceX')) < 0.2, 'a gentle hold into the bend holds the line');
n('rcAt(T.bend + 5);arcadeDown({ x: 700, y: 450 });rcTick(0.5);arcadeUp()');
assert.ok(n('mini.raceX') > 0.3, 'full lock beats the push');
n('rcAt(T.bend + 5);mini.raceV = mini.raceTop * 0.4;mini.raceZ = T.bend + 5;rcTick(0.5);T.slow = mini.raceX');
n('rcAt(T.bend + 5);rcTick(0.5);T.fast = mini.raceX');
assert.ok(n('T.fast < T.slow * 2'), 'the push grows with speed');
n('rcAt(mini.raceCourse.start + 30, 0);mini.raceV = 0;rcTick(3)');
assert.ok(n('mini.raceV') > n('mini.raceTop * 0.9'), 'the gurney accelerates on its own');
close();
console.log('PASS: curves push outward with speed, steering into them holds the line.');

// ---- The edge: rumble, graze, spin-out ----
for (let tier = 0; tier < 4; tier++) {
  n(`rcStart(${tier});rcBare();T.z = mini.raceCourse.segs.findIndex((s, i) => i > mini.raceCourse.start + 20 && !s.tunnel && !s.pad && !s.ramp && !s.curve);T.g = RACE_GRAZE[${tier}]`);
  // A caster on the rumble strip: it buzzes and warns, nothing else.
  n('rcAt(T.z, 0.95);rcTick(0.1)');
  assert.equal(n('mini.raceRumble'), true, 'the rumble strip rumbles');
  assert.ok(n('mini.raceBuzz') > 0 && !n('mini.raceOff') && n('mini.raceSpinOuts') === 0, 'a warning, not a penalty');
  // A quick graze past the strip only slows you.
  n('rcAt(T.z, 1.2);rcTick(T.g * 0.5);T.v = mini.raceV;mini.raceX = 0.5;rcTick(0.5)');
  assert.ok(n('T.v') < n('mini.raceTop * 0.98'), 'a graze slows you');
  assert.equal(n('mini.raceSpinOuts'), 0, 'a graze is not a spin-out');
  // Stay out there at speed and you spin out: two full turns, the speed gone, the wheel ignored.
  n('rcAt(T.z, 1.3);rcTick(T.g + 0.1)');
  assert.equal(n('mini.raceSpinOuts'), 1, `level ${tier + 1}: off the floor at speed spins you out`);
  assert.ok(n('mini.raceSpinOut') && n('mini.raceSpin') > 0.9, 'and it lasts');
  assert.ok(n('mini.raceV') <= n('mini.raceTop * 0.4'), 'speed dumped');
  assert.equal(n('mini.miss'), 0, 'a spin-out never costs a heart');
  assert.match(n('mini.racePops.map(p => p.text).join()'), /GRASS|LAWN|OFF-ROAD|LINOLEUM|WAXED|SPIN CYCLE/);
  n('keys.add("arrowright");T.x = mini.raceX;rcTick(0.3);keys.clear()');
  assert.ok(n('mini.raceX') < n('T.x'), 'the wheel does nothing mid-spin and you slide back toward the floor');
  n('rcTick(RACE_SPINOUT)');
  assert.ok(n('mini.raceSpin') === 0 && Math.abs(n('mini.raceX')) <= 0.95, 'after the spin you are back on the edge of the floor');
  n('rcTick(3)');
  assert.ok(n('mini.raceV') > n('mini.raceTop * 0.8'), 'and you pick it up again');
  // Deeper counts faster.
  n('rcAt(T.z, 1.15);rcTick(T.g * 0.7);T.shallow = mini.raceSpinOuts;rcAt(T.z, 1.6);rcTick(T.g * 0.7)');
  assert.ok(n('T.shallow') === 1 && n('mini.raceSpinOuts') === 2, 'a deep excursion spins you sooner than a shallow one');
  // Slow on the grass is just slow; nitro is immune.
  n('rcAt(T.z, 1.3);mini.raceV = mini.raceTop * 0.4;rcTick(0.8)');
  assert.equal(n('mini.raceSpinOuts'), 2, 'below half speed the grass only slows you');
  assert.ok(n('mini.raceV') <= n('mini.raceTop * RACE_GRASS + 0.01'), 'the grass slows you');
  n('rcAt(T.z, 1.3);mini.helps = 1;miniAction("assist");rcTick(0.6)');
  assert.equal(n('mini.raceSpinOuts'), 2, 'nitro rides the grass');
  close();
}
assert.ok(n('RACE_SPINOUT >= 1 && RACE_SPINOUT <= 2'), 'a spin-out takes a second or two');
assert.ok(n('RACE_GRAZE.every((g, i) => g >= 0.25 && g <= 0.45 && (!i || g <= RACE_GRAZE[i - 1]))'), 'the graze allowance tightens with the level');
n('rcStart(0);mini.raceSpinLen = RACE_SPINOUT;mini.raceSpin = RACE_SPINOUT * 0.5;mini.raceSpinOut = true');
assert.ok(n('raceSpinAngle()') >= n('Math.PI * 2'), 'a visible 360 by halfway');
n('mini.raceSpin = 0.001');
assert.ok(n('raceSpinAngle()') > n('Math.PI * 3.9'), 'two full turns in all');
close();
// The tunnel walls scrape; they never spin you.
n('rcStart(1);T.t = mini.raceCourse.segs.findIndex(s => s.tunnel) + 20;rcAt(T.t, 1.24);rcTick(1.5)');
assert.equal(n('mini.raceSpinOuts'), 0, 'tunnel walls scrape, no spin-out');
assert.ok(n('mini.raceV') <= n('mini.raceTop * RACE_SCRAPE + 0.05'), 'they slow you instead');
close();
console.log('PASS: the rumble strip warns, a graze slows, staying off at speed spins you out for a visible two turns.');

// ---- Crashes ----
n('rcStart(1);rcFlat();rcAt(mini.raceCourse.start + 40);T.cart = rcCar("laundry", 6, 0, mini.raceTop * 0.3);rcTick(0.4)');
assert.equal(n('mini.raceCrashes'), 1, 'rear-ending traffic crashes');
assert.ok(n('mini.raceSpin') > 0 && n('mini.raceV') <= n('mini.raceTop * 0.65'), 'a crash spins you and costs speed');
assert.equal(n('mini.miss'), 0, 'a crash never costs a heart');
assert.equal(n('T.cart.knocked'), true, 'the laundry cart goes flying');
n('T.chair = rcCar("wheelchair", 3, mini.raceX, 0);rcTick(0.3)');
assert.equal(n('mini.raceCrashes'), 1, 'no second crash while spinning and blinking');
n('rcTick(2.5)');
assert.ok(n('mini.raceV') > n('mini.raceTop * 0.8') && n('mini.raceSpin') === 0, 'you recover');
// Props off the road crash you too.
n('T.vend = mini.raceCourse.segs.findIndex((s, i) => i > mini.raceZ && s.props.some(p => p.kind === "vend"));T.p = mini.raceCourse.segs[T.vend].props.find(p => p.kind === "vend");' +
  'rcAt(T.vend - 3, T.p.x);rcTick(0.2)');
assert.equal(n('mini.raceCrashes'), 2, 'the vending machine wins');
assert.match(n('mini.racePops.map(p => p.text).join()'), /VENDING MACHINE/);
// A bumped rival lurches ahead and moves over.
n('rcAt(mini.raceCourse.start + 60, 0);T.g = rcCar("gremlin", 1, 0.1, mini.raceTop * 0.6, true);T.lane = T.g.lane;rcTick(0.1)');
assert.equal(n('mini.raceCrashes'), 3);
assert.ok(n('T.g.lane !== T.lane && T.g.v > mini.raceV'), 'the bumped rival gets out of your line');
close();
// Nobody swerves into your line just ahead of you.
n('rcStart(1);rcAt(mini.raceCourse.start + 60, -0.4);T.a = rcCar("laundry", 12, 0, mini.raceTop * 0.3);T.g = rcCar("gremlin", 6, 0, mini.raceTop * 0.62, true);T.g.pace = 0.8;raceChangeLane(T.g, [T.a, T.g])');
assert.notEqual(n('T.g.lane'), 0, 'a rival will not cut across a second in front of you');
close();
console.log('PASS: crashes spin you and cost speed, knock traffic aside, move rivals over, and never cost a heart.');

// ---- Boost pads ----
n('rcStart(0);T.p = mini.raceCourse.pads[0];rcAt(T.p.z - 3, T.p.x + 0.2);rcTick(0.15)');
assert.equal(n('mini.racePads'), 1, 'your middle on the arrows: a pad');
assert.ok(n('mini.racePadT') > 0 && n('mini.raceV') >= n('mini.raceTop * RACE_PAD_KICK - 0.01'), 'a burst past top speed');
assert.equal(n('mini.raceBoosts'), 3, 'pads are free');
n('mini.raceZ = T.p.z + 1;rcTick(0.05)');
assert.equal(n('mini.racePads'), 1, 'a pad pays once');
n('T.q = mini.raceCourse.pads[1];rcAt(T.q.z - 3, T.q.x + 0.5);rcTick(0.2)');
assert.equal(n('mini.racePads'), 1, 'half a lane off misses it');
n('rcAt(T.q.z - 3, T.q.x);mini.raceSpin = 1;rcTick(0.2)');
assert.equal(n('mini.racePads'), 1, 'not while spinning');
close();
console.log('PASS: boost pads burst you past top speed, once each, only with your middle on them.');

// ---- Ramps and air ----
n('rcStart(0);T.r = mini.raceCourse.ramps[0];rcAt(T.r.end - 2, T.r.x);T.c = rcCar("parked", 22, T.r.x);rcTick(0.1)');
assert.ok(n('mini.raceAir') > 0 && n('mini.raceJumps') === 1, 'over the lip and into the air');
assert.match(n('mini.racePops.map(p => p.text).join()'), /RAMP/);
n('T.airT = mini.raceAirT;rcTick(T.airT / 2 - 0.1)');
assert.ok(n('raceLiftNow()') > n('RACE_LIFT * 0.8'), 'real height mid-air');
n('rcTick(T.airT)');
assert.equal(n('mini.raceAir'), 0, 'down again');
assert.equal(n('mini.raceCrashes'), 0, 'the parked gurney passed underneath');
assert.equal(n('T.c.knocked'), false);
assert.match(n('mini.racePops.map(p => p.text).join()'), /STUCK THE LANDING/);
assert.ok(n('mini.racePadT') > 0 || n('mini.raceV') > n('mini.raceTop'), 'a clean landing kicks you on');
// Faster means longer in the air; going slow is a hop.
n('rcAt(T.r.end - 2, T.r.x);mini.raceV = mini.raceTop * 0.6;rcTick(0.1)');
assert.ok(n('mini.raceAirT') < n('T.airT - 0.1'), 'air time grows with speed');
// In the air the wheel has a third of its grip.
n('rcAt(T.r.end - 2, T.r.x);rcTick(0.06);T.x = mini.raceX;keys.add("arrowright");rcTick(0.3);keys.clear();T.air = mini.raceX - T.x');
n('rcAt(mini.raceCourse.start + 150, 0);keys.add("arrowright");rcTick(0.3);keys.clear();T.ground = mini.raceX');
assert.ok(n('T.air') > 0 && n('T.air < T.ground * 0.6'), 'less steering in the air');
// Land in the grass at speed: spin-out. Land on something: it loses.
n('rcAt(T.r.end - 2, T.r.x);rcTick(0.1);mini.raceX = 1.6;rcTick(1.2)');
assert.ok(n('mini.raceSpinOuts') === 1, 'landing in the grass spins you out');
assert.match(n('mini.racePops.map(p => p.text).join()'), /FLOWERBED|IN THE GRASS/);
n('rcAt(T.r.end - 2, T.r.x);mini.raceGhost = 0;rcTick(0.1);T.l = rcCar("laundry", mini.raceAir * mini.raceV, mini.raceX, 0);T.crashes = mini.raceCrashes;rcTick(mini.raceAir + 0.05)');
assert.equal(n('T.l.knocked'), true, 'landing on a laundry cart sends it flying');
assert.equal(n('mini.raceCrashes'), n('T.crashes'), 'and it is not your crash');
assert.match(n('mini.racePops.map(p => p.text).join()'), /LANDED ON LAUNDRY CART/);
// Off the line, no jump.
n('rcAt(T.r.end - 2, T.r.x + 0.62);T.j = mini.raceJumps;rcTick(0.2)');
assert.equal(n('mini.raceJumps'), n('T.j'), 'miss the ramp and you just drive past it');
// Rivals fly the ramps too.
n('rcAt(T.r.z - 60, -0.62);T.g = rcCar("gremlin", 59, T.r.x, mini.raceTop * 0.8, true);rcTick(0.25)');
assert.ok(n('T.g.air') > 0, 'a rival on the ramp takes off');
assert.ok(n('raceCarLift(T.g)') > 0);
close();
console.log('PASS: ramps launch you over traffic, air time grows with speed, landings bounce, kick, spin or squash.');

// ---- Positions and overtakes ----
n('rcStart(0, 1, false)');
assert.equal(n('mini.racePlace'), 8, 'you start at the back of eight');
assert.equal(n('RACE.stat()'), '8TH / 8');
n('T.r = mini.raceRivals[0];rcAt(T.r.z - 3, -0.62);T.r.x = 0;T.r.lane = 1;rcTick(0.6)');
assert.equal(n('mini.racePlace'), 7, 'passing a rival gains a place');
assert.equal(n('mini.raceShown'), 7, 'the readout follows after a beat');
assert.ok(n('mini.racePasses') >= 1 && n('mini.racePops.some(p => p.text === "7TH")'), 'the pass pops');
assert.equal(n('mini.got'), 1);
n('mini.raceRivals[0].done = true;mini.raceRivals[0].doneT = 1');
assert.equal(n('racePlaceNow()'), 8, 'a rival over the line stays ahead');
close();
// Rivals drive at their pace, and the quick ones start further up the road.
for (let tier = 0; tier < 4; tier++) {
  n(`rcStart(${tier}, 1, false)`);
  const field = j('mini.raceRivals.filter(c => c.kind !== "ralph").map(c => ({ z: c.z, pace: c.pace }))');
  assert.ok(field.every((c, i) => !i || (c.z > field[i - 1].z && c.pace > field[i - 1].pace)), 'faster rivals start further ahead');
  assert.ok(field.every(c => c.pace < 1), 'nobody outruns a clean gurney at top speed');
  n('rcTick(4)');
  assert.ok(n('mini.raceRivals.every(c => c.v > 0)'), 'rivals get going on GO');
  close();
}
// Harder fields: the podium takes real pace from level 1 and more each level (Legendary's course does
// the rest), and Legendary is the deepest field in the building.
const thirds = j('RACE_FIELDS.map(f => f.filter(r => r[0] !== "ralph").map(r => r[2]).sort((a, b) => b - a)[2])');
assert.ok(thirds[0] >= 0.88, 'level 1 podium takes real pace: ' + thirds);
assert.ok(thirds[1] > thirds[0] && thirds[2] > thirds[1] && thirds[3] > thirds[1], 'the podium gets faster: ' + thirds);
const deep = j('RACE_FIELDS.map(f => f.filter(r => r[0] !== "ralph" && r[2] >= 0.9).length)');
assert.ok(deep[3] >= 6 && deep.every((d, i) => i === 3 || d < deep[3]), 'Legendary has the most rivals at nine tenths or better: ' + deep);
assert.ok(n('Math.max(...RACE_FIELDS[3].map(r => r[2])) >= Math.max(...RACE_FIELDS.flat().map(r => r[2]))'), 'and the fastest one');
assert.equal(n('RACE_FIELDS[3].filter(r => r[0] === "ralph" && r[5] === 1).length'), 1, 'Ralph comes back once on Legendary');
assert.equal(n('RACE_FIELDS.slice(0, 3).flat().filter(r => r[5]).length'), 0, 'and nowhere else');
// The field bunches a little: far ahead eases off, far behind leans on it, Ralph keeps his pace.
n('rcStart(1, 1, false);T.r = mini.raceRivals[3]');
assert.equal(n('(T.r.z = mini.raceZ + 10, raceBand(T.r))'), 1, 'close rivals race at their pace');
assert.ok(n('(T.r.z = mini.raceZ + 300, raceBand(T.r))') <= n('1 - RACE_BAND_AHEAD + 1e-9'), 'a rival far up the road eases off');
assert.ok(n('(T.r.z = mini.raceZ - 300, raceBand(T.r))') >= n('1 + RACE_BAND_BEHIND - 1e-9'), 'a rival far behind pushes');
assert.ok(n('RACE_BAND_AHEAD <= 0.06 && RACE_BAND_BEHIND <= 0.03'), 'the bunching stays mild');
assert.equal(n('raceBand(raceCar({ id: 77, kind: "ralph", racer: true, name: "Ralph", z: mini.raceZ + 400, lane: 1, pace: 0.7 }))'), 1, 'Ralph keeps his own pace');
close();
console.log('PASS: real positions, overtakes with pops, finishers stay ahead, the field spreads by pace and bunches a little.');

// ---- Donut gates ----
n('rcStart(1);T.limit = mini.limit;T.g = mini.raceCourse.gates[0];rcAt(T.g - 2);rcTick(0.2)');
assert.equal(n('mini.limit'), n('T.limit + mini.raceExt[0]'), 'the first gate adds its time');
assert.match(n('mini.racePops.map(p => p.text).join()'), /CHECKPOINT \+\d+ s/);
n('rcTick(0.5)');
assert.equal(n('mini.limit'), n('T.limit + mini.raceExt[0]'), 'a gate pays once');
assert.ok(n('mini.limit') >= 30, 'every level starts with at least thirty seconds');
close();
console.log('PASS: donut gates add time once each.');

// ---- Boost, the swipe and the kit ----
n('rcStart(0);rcAt(mini.raceCourse.start + 30);miniAction("boost");rcTick(1)');
assert.ok(n('mini.raceV') > n('mini.raceTop * 1.2'), 'a boost goes past top speed');
assert.equal(n('mini.raceBoosts'), 2);
n('rcTick(2);arcadeDown({ x: 600, y: 420 });mini.total += 0.05;arcadeMove({ x: 600, y: 360 })');
assert.equal(n('mini.raceBoosts'), 1, 'a quick swipe up boosts');
n('arcadeMove({ x: 600, y: 300 })');
assert.equal(n('mini.raceBoosts'), 1, 'one boost per swipe');
n('arcadeUp();mini.raceBoosts = 0;mini.raceBoostT = 0;miniAction("boost")');
assert.match(n('mini.flashText'), /NO BOOSTS/, 'boosts run out');
// Nitro is the assist: a long boost and a ghost.
n('miniAction("assist")');
assert.ok(n('mini.raceNitroT') > 3 && n('mini.raceGhost') > 3);
assert.equal(n('mini.helps'), 1);
close();
console.log('PASS: boosts by button and by swipe, a limited supply, and the nitro assist.');

// ---- Softballs ----
n('rcStart(1);rcAt(mini.raceCourse.start + 40);T.g = rcCar("gremlin", 30, 0.05, mini.raceTop * 0.7, true);miniAction("throw");rcTick(0.6)');
assert.ok(n('T.g.spin') > 0 && n('mini.raceHits') === 1, 'THROW bonks the gurney ahead');
assert.ok(n('T.g.v') < n('mini.raceTop * 0.5'), 'a bonked rival slows right down');
assert.ok(n('Math.abs(RACE_LANES[T.g.lane] - mini.raceX) > 0.3'), 'and gets out of your line');
n('T.l = rcCar("laundry", 40, 0.6, mini.raceTop * 0.3);T.v = raceView({ w: 800, h: 500 });T.s = raceSpot(T.v, T.l.z, T.l.x)');
assert.equal(n('raceCarAtPoint({ x: T.s.x, y: T.s.y - 20 }) === T.l'), true, 'a press on a gurney up the road finds it');
n('T.balls = mini.raceBalls;arcadeDown({ x: T.s.x, y: T.s.y - 20 });arcadeUp();rcTick(0.7)');
assert.equal(n('mini.raceBalls'), n('T.balls - 1'));
assert.equal(n('T.l.knocked'), true, 'tapping a laundry cart knocks it to the curb');
assert.equal(n('raceCarAtPoint({ x: 400, y: 470 })'), null, 'a press near the gurney steers instead');
n('mini.raceBalls = 0;miniAction("throw")');
assert.match(n('mini.flashText'), /OUT OF SOFTBALLS/);
close();
console.log('PASS: softballs by button and by tapping a gurney, rivals spin, traffic flies, supply runs out.');

// ---- Ralph ----
n('rcStart(2);rcFlat();rcAt(mini.raceCourse.start + 300, 0.6);T.r = rcCar("ralph", 40, -0.6, mini.raceTop * 0.6, true);T.r.pace = 0.6;rcTick(1.5)');
assert.equal(n('T.r.blocking'), true, 'Ralph blocks when you close in');
assert.ok(n('T.r.x') > 0, 'and slides into your line');
assert.match(n('mini.racePops.map(p => p.text).join()'), /RALPH/);
n('mini.raceZ = T.r.z - 25;mini.raceX = T.r.x;miniAction("throw");rcTick(0.7)');
assert.ok(n('T.r.calm') > 0 && n('T.r.spin') > 0 && !n('T.r.blocking'), 'a softball calms him down');
// Hit him and he gloats, then keeps to a lane so you can get by.
n('T.r.calm = 0;T.r.spin = 0;mini.raceGhost = 0;mini.raceSpin = 0;mini.raceZ = T.r.z - 3;mini.raceX = T.r.x;mini.raceV = mini.raceTop;rcTick(0.1)');
assert.ok(n('mini.raceCrashes') >= 1 && n('T.r.calm') > 4, 'after a crash Ralph backs off');
close();
// Legendary: get past Ralph and a few seconds later he turbos past you, ghosting, then blocks again.
const ralphSetup = tier =>
  n(`rcStart(${tier});rcFlat();
    T.r = mini.raceRivals.find(c => c.kind === "ralph");rcAt(mini.raceCourse.start + 900, -0.62);
    Object.assign(T.r, { z: mini.raceZ - 2, x: 0.62, lane: 2, done: false, v: mini.raceTop * 0.75 });rcTick(0.2)`);
ralphSetup(3);
assert.ok(n('T.r.passedAt !== undefined && !T.r.chase'), 'Ralph knows he was passed');
n('rcTick(5.5)');
assert.equal(n('T.r.chase'), true, 'and he finds the turbo button');
assert.match(n('mini.racePops.map(p => p.text).join()'), /TURBO/);
n('for (let i = 0; i < 1500 && T.r.chase; i++) updateMini(1 / 60)');
assert.ok(n('!T.r.chase && T.r.round2 && T.r.z > mini.raceZ + 40'), 'he gets back in front');
assert.equal(n('mini.raceCrashes'), 0, 'ghosting past, never through you');
n('for (let i = 0; i < 900 && !T.r.blocking; i++) updateMini(1 / 60)');
assert.equal(n('T.r.blocking'), true, 'then he blocks you again');
assert.match(n('mini.racePops.map(p => p.text).join()'), /ROUND TWO/);
assert.equal(n('T.r.encore'), 0, 'once');
close();
ralphSetup(2);
n('rcTick(8)');
assert.ok(n('!T.r.chase && T.r.z < mini.raceZ - 25'), 'on level 3 Ralph stays passed');
close();
console.log('PASS: Ralph blocks, a softball or a crash ends the block, and on Legendary he comes back for seconds.');

// ---- The finish ----
n('rcStart(0, 1, false);for (const [i, c] of mini.raceRivals.entries()) c.z = mini.raceCourse.finish - 300 - i;rcAt(mini.raceCourse.finish - 2);rcTick(0.2)');
assert.equal(n('mini.screen'), 'outro');
assert.equal(n('mini.pendingFinish.win'), true, 'first over the line wins');
assert.equal(n('mini.raceFinal'), 1);
n('rcTick(2.4)');
assert.equal(n('mini.screen'), 'result');
assert.ok(n('mini.qualityFinal') >= 88, 'a clean win is gold');
assert.match(n('$("resultText").textContent'), /First place/);
close();
n('rcStart(0, 1, false);mini.raceRivals.forEach((c, i) => (c.z = i < 3 ? mini.raceCourse.finish + 10 : mini.raceCourse.finish - 200));mini.raceRivals.slice(0, 3).forEach(c => (c.done = true));rcAt(mini.raceCourse.finish - 2);rcTick(0.2)');
assert.equal(n('mini.pendingFinish.win'), false, 'fourth is off the podium');
assert.match(n('mini.pendingFinish.reason'), /Finished 4TH of 8/);
n('rcTick(2.4)');
assert.equal(n('$("resultHeading").textContent'), 'OFF THE PODIUM.');
close();
n('rcStart(0, 1, false);mini.raceRivals.forEach((c, i) => (c.z = mini.raceCourse.finish - 300 - i));mini.raceRivals.slice(0, 2).forEach(c => (c.done = true, c.z = mini.raceCourse.finish + 5));rcAt(mini.raceCourse.finish - 2);mini.raceCrashes = 4;rcTick(0.2)');
assert.equal(n('mini.pendingFinish.win'), true, 'third is on the podium');
n('rcTick(2.4)');
assert.equal(n('mini.grade'), 1, 'third with spins is bronze');
close();
n('rcStart(0);mini.phaseTime = mini.limit - 0.05;rcTick(0.2)');
assert.equal(n('mini.pendingFinish.win'), false);
assert.match(n('mini.pendingFinish.reason'), /Out of time/);
n('rcTick(2.4)');
assert.equal(n('$("resultHeading").textContent'), 'OUT OF TIME.');
close();
console.log('PASS: top three wins, fourth loses, the clock can run out, and the medal follows the place.');

// ---- Determinism and idle ----
const replay = () =>
  n('rng=99;rcStart(1, 1, false);arcadeDown({ x: 650, y: 450 });rcTick(2);arcadeMove({ x: 150, y: 450 });rcTick(3);arcadeUp();rcTick(5);' +
    'T.state = JSON.stringify([mini.raceZ, mini.raceX, mini.racePlace, mini.raceCars.map(c => [c.z, c.x])]);rcClose();T.state');
assert.equal(replay(), replay(), 'the same seed and inputs give the same race');
for (let tier = 0; tier < 4; tier++) {
  n(`rcStart(${tier}, 0, false)`);
  for (let i = 0; i < 2000 && n('mini.screen') === 'play'; i++) n('updateMini(0.05)');
  assert.equal(n('mini.pendingFinish && mini.pendingFinish.win'), false, `idle loses level ${tier + 1}`);
  close();
}
console.log('PASS: deterministic under a seed; idle loses all four levels.');

// ---- Drawing at every screen, wide and tall ----
for (const shape of ['wide', 'tall']) {
  if (shape === 'tall') n('window.innerWidth = 390;window.innerHeight = 844');
  for (const win of [true, false]) {
    n(`state.difficulty = 1;openMini(3);mini.tier = 2;drawMini();startMini();drawMini()`);
    assert.equal(n('mini.portrait'), shape === 'tall');
    n('launchMini();for (let i = 0; i < 6; i++) { updateMini(0.3); drawMini(); }');
    assert.equal(n('mini.screen'), 'play');
    n('rcAt(mini.raceCourse.gates[1] + 40);mini.raceNightK = 1;mini.raceTunnelK = 1;mini.raceBoostT = 1;miniAction("throw");updateMini(0.05);drawMini()');
    n('raceCrash(null, { kind: "vend" });mini.flash = 1;mini.flashText = "TEST";updateMini(0.05);drawMini();pauseMini();drawMini();pauseMini()');
    n(`finishMini(${win});drawMini();updateMini(1);drawMini();updateMini(1.5)`);
    assert.equal(n('mini.screen'), 'result');
    n('drawResultArt();updateMini(0.5);drawResultArt();RACE.scene($("miniPreview").getContext("2d"), 420, 240);RACE.scene($("miniPreview").getContext("2d"), 260, 135)');
    close();
  }
}
// Pads, ramps, the run-up, the air, a spin-out and the edge warning, on Legendary at night too.
for (const shape of ['wide', 'tall']) {
  if (shape === 'tall') n('window.innerWidth = 390;window.innerHeight = 844');
  else n('delete window.innerWidth;delete window.innerHeight');
  for (const tier of [0, 3]) {
    n(`rcStart(${tier}, 1, false);T.ramps = 0;T.pads = 0;T.realRamp = raceDrawRamp;T.realPad = raceDrawPad;
      raceDrawRamp = function (...a) { T.ramps++; return T.realRamp(...a); };raceDrawPad = function (...a) { T.pads++; return T.realPad(...a); }`);
    assert.equal(n('mini.portrait'), shape === 'tall');
    n('T.p = mini.raceCourse.pads[1];rcAt(T.p.z - 25, 0);updateMini(0.02);drawMini()');
    assert.ok(n('T.pads') > 0, 'pads draw on the road');
    n('T.r = mini.raceCourse.ramps.find(r => r.w < 1);rcAt(T.r.z - 30, T.r.x);updateMini(0.02);drawMini()');
    assert.ok(n('T.ramps') > 0, 'the ramp draws up the road');
    n('rcAt(T.r.end - 1.2, T.r.x);updateMini(0.01);drawMini();updateMini(0.05);drawMini();updateMini(0.3);drawMini()');
    assert.ok(n('mini.raceAir') > 0, 'drawn mid-air');
    n('updateMini(0.7);drawMini();raceSpinOut(false);updateMini(0.05);drawMini();updateMini(0.6);drawMini()');
    n('rcAt(T.p.z + 200, 0.95);updateMini(0.05);drawMini();rcAt(T.p.z + 220, 1.2);updateMini(0.05);drawMini()');
    n('raceDrawRamp = T.realRamp;raceDrawPad = T.realPad');
    close();
  }
}
n('delete window.innerWidth;delete window.innerHeight');
console.log('PASS: every screen draws on the wide and the tall canvas, win and loss, with pads, ramps, air and spin-outs.');
