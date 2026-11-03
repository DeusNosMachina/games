// Gurney Grand Prix rules: the course (segments, curves, hills, gates, tunnels, night), the projection
// and crest clipping, steering by keys and by where a finger sits (more than one finger too), curves
// pushing outward, the grass, crashes (spin and speed, never a heart), positions and overtakes, donut
// gates adding time, boosts and the swipe-up gesture, softballs and tap-to-throw, Ralph's block,
// the finish (top three wins, fourth loses, the clock can run out), the medal, determinism, idle
// play losing, and drawing at every screen on the wide and the tall canvas.
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
function rcAt(z, x = 0) { mini.raceZ = z; mini.raceX = x; mini.raceVx = 0; mini.raceV = mini.raceTop; mini.raceSpin = 0; mini.raceGhost = 0; }
function rcCar(kind, dz, x, v = 0, racer = false) {
  const c = raceCar({ id: 900 + mini.raceCars.length, kind, racer, name: racer ? 'Test ' + kind : undefined, z: mini.raceZ + dz, lane: 1, pace: v / mini.raceTop, look: 0 });
  c.x = x; c.v = v; if (c.tx === undefined) c.lane = RACE_LANES.reduce((b, L, i) => (Math.abs(L - x) < Math.abs(RACE_LANES[b] - x) ? i : b), 0);
  mini.raceCars.push(c); if (racer) mini.raceRivals.push(c);
  return c;
}
`);
const n = s => run(s),
  j = s => JSON.parse(run('JSON.stringify(' + s + ')'));

// ---- The course ----
const courses = j(`[0,1,2].map(t => { const c = raceBuildCourse(t), s = c.segs.slice(c.start, c.finish);
  return { len: c.finish - c.start, start: c.start, finish: c.finish, gates: c.gates, curve: Math.max(...s.map(q => Math.abs(q.curve))),
    hill: Math.max(...s.map(q => q.y2)) - Math.min(...s.map(q => q.y2)), tunnel: s.some(q => q.tunnel), night: s.some(q => q.night),
    rings: s.filter(q => q.ring).length, after: c.segs.length - c.finish }; })`);
for (const c of courses) {
  assert.ok(c.gates.length >= 1 && c.gates.every(g => g > c.start && g < c.finish), 'gates sit between start and finish');
  assert.ok(c.after >= 150, 'the road runs on past the finish for the camera');
}
assert.ok(courses[0].len < courses[1].len && courses[1].len < courses[2].len, 'each level is longer');
assert.ok(courses[0].curve < 3.2 && courses[2].curve >= 6, `level 1 bends gently, level 3 hard: ${courses.map(c => c.curve)}`);
assert.ok(courses[2].hill > courses[0].hill * 3, 'level 3 is a mountain');
assert.equal(courses[0].tunnel, false, 'level 1 has no tunnel');
assert.ok(courses[1].tunnel && courses[1].rings > 20, 'level 2 has a donut tunnel');
assert.ok(courses[2].tunnel && courses[2].night, 'level 3 has the night tunnel');
assert.equal(n('JSON.stringify(raceBuildCourse(2).segs.map(s => s.curve + ":" + s.y2))'), n('JSON.stringify(raceBuildCourse(2).segs.map(s => s.curve + ":" + s.y2))'), 'the same level builds the same course');
// Chevrons stand on the outside of curves and point the way the road bends.
assert.ok(n('raceBuildCourse(0).segs.every(s => s.props.every(p => p.kind !== "chevron" || (Math.sign(p.x) === -Math.sign(s.curve) && p.dir === Math.sign(s.curve))))'));
console.log('PASS: three courses, longer and harder each level, with gates, a tunnel, night and chevrons.');

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
n('rcAt(mini.raceCourse.start + 30, 1.5);rcTick(1.2)');
assert.ok(n('mini.raceV') <= n('mini.raceTop * RACE_GRASS + 0.01'), 'the grass slows you');
n('rcAt(mini.raceCourse.start + 30, 0);mini.raceV = 0;rcTick(3)');
assert.ok(n('mini.raceV') > n('mini.raceTop * 0.9'), 'the gurney accelerates on its own');
close();
console.log('PASS: curves push outward with speed, steering into them holds the line, grass slows.');

// ---- Crashes ----
n('rcStart(1);rcAt(mini.raceCourse.start + 40);T.cart = rcCar("laundry", 6, 0, mini.raceTop * 0.3);rcTick(0.4)');
assert.equal(n('mini.raceCrashes'), 1, 'rear-ending traffic crashes');
assert.ok(n('mini.raceSpin') > 0 && n('mini.raceV') <= n('mini.raceTop * 0.55'), 'a crash spins you and costs speed');
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
close();
console.log('PASS: crashes spin you and cost speed, knock traffic aside, and never cost a heart.');

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
n('rcStart(1, 1, false)');
const field = j('mini.raceRivals.map(c => ({ z: c.z, pace: c.pace }))');
assert.ok(field.every((c, i) => !i || (c.z > field[i - 1].z && c.pace > field[i - 1].pace)), 'faster rivals start further ahead');
assert.ok(field.every(c => c.pace < 1), 'nobody outruns a clean gurney at top speed');
n('rcTick(4)');
assert.ok(n('mini.raceRivals.every(c => c.v > 0)'), 'rivals get going on GO');
close();
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
n('rcStart(2);rcAt(mini.raceCourse.start + 300, 0.6);T.r = rcCar("ralph", 20, -0.6, mini.raceTop * 0.6, true);T.r.pace = 0.6;rcTick(1.2)');
assert.equal(n('T.r.blocking'), true, 'Ralph blocks when you close in');
assert.ok(n('T.r.x') > 0, 'and slides into your line');
assert.match(n('mini.racePops.map(p => p.text).join()'), /RALPH/);
n('mini.raceZ = T.r.z - 25;mini.raceX = T.r.x;miniAction("throw");rcTick(0.7)');
assert.ok(n('T.r.calm') > 0 && n('T.r.spin') > 0 && !n('T.r.blocking'), 'a softball calms him down');
// Hit him and he gloats, then keeps to a lane so you can get by.
n('T.r.calm = 0;T.r.spin = 0;mini.raceGhost = 0;mini.raceSpin = 0;mini.raceZ = T.r.z - 3;mini.raceX = T.r.x;mini.raceV = mini.raceTop;rcTick(0.1)');
assert.ok(n('mini.raceCrashes') >= 1 && n('T.r.calm') > 4, 'after a crash Ralph backs off');
close();
console.log('PASS: Ralph blocks, a softball or a crash ends the block.');

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
for (let tier = 0; tier < 3; tier++) {
  n(`rcStart(${tier}, 0, false)`);
  for (let i = 0; i < 2000 && n('mini.screen') === 'play'; i++) n('updateMini(0.05)');
  assert.equal(n('mini.pendingFinish && mini.pendingFinish.win'), false, `idle loses level ${tier + 1}`);
  close();
}
console.log('PASS: deterministic under a seed; idle loses every level.');

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
n('delete window.innerWidth;delete window.innerHeight');
console.log('PASS: every screen draws on the wide and the tall canvas, win and loss.');
