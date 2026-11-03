// Fastpitch Fever: the registry slot and the Legendary fourth level; ball physics (gravity, bounces off
// the floor, walls and furniture, an honest launch, frame-rate independence, an honest preview arc); the
// flick (its line is where the ball comes down, its speed is how far, its length is the arc, only the
// last moments count, no auto-aim, taps and slow or downward presses throw nothing, the preview shows
// only while the finger moves, any frame rate, both canvas shapes, cancels, keys and the button); misses
// that teach (a landing scuff and a note); the bucket; every gremlin kind and its rule; bottles, the
// E-Type and streaks; spawns, pacing and fairness on all four levels (every spot a flick can reach,
// every shield a bank flick can reach, every hiding place a lob can reach, nothing lands on her without
// a tell); idle play loses; determinism; every screen draws in both shapes.
// Test objects live on T so they never collide with the game's globals.
const { run, close, assert } = require('./harness.cjs');
run('let rng=777;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`var T = {};
function ptStart(tier, difficulty = 1, tall = false) {
  mini.open = false; mini.screen = 'lobby'; for (const d of $$('dialog')) d.close(); state.paused = false;
  state.difficulty = difficulty;
  if (tall) { window.innerWidth = 390; window.innerHeight = 844; } else { delete window.innerWidth; delete window.innerHeight; }
  openMini(0); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  mini.pitchSpawnT = 999; mini.pitchTargets = []; mini.pitchLive = []; T = {};
}
// A frozen gremlin of a kind with its feet at (x, y, z).
function ptGremlin(kind, x, y, z, extra = {}) {
  const e = pitchMakeTarget(kind, x, y, z, { inT: 0, ...extra });
  e.life = 0;
  return e;
}
function ptTick(seconds, dt = 1 / 60) { for (let t = 0; t < seconds - 1e-9; t += dt) updateMini(dt); }
// Runs a ball by itself (no live targets) and returns where it is after t seconds.
function ptFly(v, t) { const b = pitchNewBall(v); while (b.age < t - 1e-9 && !b.dead) pitchMoveBall(b, PITCH_SUB); return b; }
// A throw's velocity through a room point, for tests that need a ball somewhere rather than a gesture.
function ptAt(q, loft = 0.3) { return pitchLaunch(pitchAimAt(q, loft)); }
// A finger stroke through the real pointer path: down at (x0, y0), then straight toward (x1, y1) at
// speed px/s, one sample per dt, on until it has gone len px (default: to (x1, y1)), then let go
// (or cancel, or hold). Returns the flick the game read at the moment of release.
function ptStroke(x0, y0, x1, y1, speed, o = {}) {
  const dt = o.dt || 1 / 60, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, len = o.len || L;
  if (!o.held) arcadeDown({ x: x0, y: y0 });
  const t0 = mini.total;
  let d = 0;
  while (d < len - 1e-9) { updateMini(dt); d = speed * (mini.total - t0); arcadeMove({ x: x0 + ux * d, y: y0 + uy * d }); }
  const f = mini.pitchPress && pitchFlickAim(mini.pitchPress, mini.total);
  if (!o.hold) arcadeUp(!!o.cancel);
  return f;
}
// The stroke pitchSwipeFor lays out for an aim, swiped at its speed times mult.
function ptSwipe(s, mult = 1, o = {}) { return ptStroke(s.x0, s.y0, s.x1, s.y1, s.speed * mult, o); }
// The last ball thrown.
function ptLast() { return mini.pitchLive[mini.pitchLive.length - 1]; }
`);
close();
const n = s => run(s),
  j = s => JSON.parse(run('JSON.stringify(' + s + ')')),
  near = (a, b, eps) => Math.abs(a - b) <= eps;

// ---- The registry ----
assert.equal(n('games[0].id'), 0);
assert.equal(n('games[0].layout'), 'gesture');
assert.deepEqual(j('games[0].canvas'), { w: 800, h: 450 });
assert.deepEqual(j('games[0].portraitCanvas'), { w: 450, h: 800 });
assert.equal(n('games[0].music'), 'game:pitch');
assert.equal(n('audio.tracks.includes("game:pitch")'), true, 'its track exists');
assert.equal(n('games[0].legendary'), true, 'Fastpitch Fever has a Legendary level');
assert.equal(n('miniTierCount(games[0])'), 4);
assert.equal(n('games[0].tierNotes.length'), 4, 'four lobby notes');
assert.equal(n('PITCH_TIERS.length'), 4, 'four rulesets');
for (const k of ['game', 'genre', 'headline', 'desc', 'goal', 'control', 'avoid', 'cue']) {
  assert.equal(typeof n(`games[0].info.${k}`), 'string', k);
  assert.doesNotMatch(n(`games[0].info.${k}`), /—|!/, `no em-dashes or exclamation points in info.${k}`);
  assert.doesNotMatch(n(`games[0].info.${k}`), /\btap\b/i, `info.${k} never says tap: the throw is a flick`);
}
const copy = [...j('games[0].tierNotes'), ...j('Object.values(PITCH_INTROS)'), n('PITCH_QUOTA_MISSED')];
for (let t = 0; t < 4; t++) n(`mini.tier=${t}`), copy.push(n(`games[0].shiftMessage(1)`), n(`games[0].shiftMessage(2)`));
for (const t of copy) assert.doesNotMatch(t, /—/);
console.log('PASS: Fastpitch Fever registry: room 0, gesture layout, both canvas shapes, its own track, four levels, clean copy.');

// ---- Physics ----
n('ptStart(1)');
// Gravity: before anything is touched the ball is a parabola.
const fly = j('(()=>{const v={x:0,y:300,z:400},b=ptFly(v,0.3);return [b.x,b.y,b.z]})()');
const H = j('PITCH_HAND');
assert.ok(near(fly[1], H.y + 300 * 0.3 - 0.5 * 760 * 0.09, 1.5), 'height follows the parabola: ' + fly[1]);
assert.ok(near(fly[2], H.z + 400 * 0.3, 0.5), 'depth is steady');
// The floor bounces it at half speed, and then it rolls to a stop and is done.
n('T.b=pitchNewBall({x:0,y:-200,z:0});Object.assign(T.b,{x:-20,y:100,z:300});T.hits=[];while(T.b.age<3&&!T.b.dead){const c=pitchMoveBall(T.b,PITCH_SUB);if(c)T.hits.push([c,T.b.vy])}');
assert.equal(n('T.hits[0][0]'), 'floor', 'it hits the floor first');
assert.ok(n('T.hits[0][1]') > 0, 'and bounces up');
assert.equal(n('T.b.dead'), true, 'and comes to rest');
// Side walls and the back wall reflect it, softer, and count as a bank.
n('T.b=pitchNewBall({x:900,y:200,z:300});T.c=null;while(T.b.age<1&&!T.c){T.c=pitchMoveBall(T.b,PITCH_SUB)}');
assert.equal(n('T.c'), 'wall');
assert.ok(n('T.b.vx') < 0 && near(n('Math.abs(T.b.vx)'), 900 * 0.7, 1), 'the wall reflects at 0.7');
assert.equal(n('T.b.walls'), 1);
n('T.b=pitchNewBall({x:0,y:0,z:600});Object.assign(T.b,{x:-60,y:150,z:400});T.c=null;while(T.b.age<1.5&&(T.c===null||T.c==="floor")){T.c=pitchMoveBall(T.b,PITCH_SUB)}');
assert.equal(n('T.c'), 'back', 'the back wall');
assert.ok(n('T.b.vz') < 0 && n('T.b.walls') === 1);
// Furniture: a flat throw at the cabinet's front comes back off it.
n('T.b=pitchNewBall(ptAt({x:185,y:50,z:300},0));T.c=null;while(T.b.age<1&&!T.c){T.c=pitchMoveBall(T.b,PITCH_SUB)}');
assert.equal(n('T.c'), 'cabinet', 'the cabinet is solid');
assert.ok(n('T.b.vz') < 0, 'and the ball bounces back off it');
// A launch is honest: the ball comes down through gremlin height exactly as far from her hand as the
// aim says, at every arc (an open lane down the middle of the room).
for (const dist of [200, 300, 420])
  for (const loft of [0, 0.5, 1]) {
    const got = n(`(()=>{const b=pitchNewBall(pitchLaunch({yaw:0.05,dist:${dist},loft:${loft}}));let py=b.y;
      while(!b.dead&&b.age<3){py=b.y;pitchMoveBall(b,PITCH_SUB);if(b.vy<0&&py>=PITCH_YREF&&b.y<PITCH_YREF)return Math.hypot(b.x-PITCH_HAND.x,b.z-PITCH_HAND.z)}return -1})()`);
    assert.ok(near(got, dist, 2), `a ${dist} cm throw at arc ${loft} comes down ${got.toFixed(1)} cm out`);
  }
// pitchAimAt finds the flight through a point: the ball passes within a centimeter of it.
for (const loft of [0, 0.3, 0.7, 1]) {
  const off = n(`(()=>{const q={x:-60,y:24,z:330},b=pitchNewBall(ptAt(q,${loft}));let best=1e9;while(!b.dead&&b.age<2){pitchMoveBall(b,PITCH_SUB);best=Math.min(best,Math.hypot(b.x-q.x,b.y-q.y,b.z-q.z))}return best})()`);
  assert.ok(off < 1.5, `the aim at arc ${loft} goes through its point: ${off.toFixed(2)}`);
}
// The dotted arc is the real flight: preview points match a live ball.
n('T.aim={yaw:0.3,dist:380,loft:0.4};T.sim=pitchSimulate(pitchLaunch(T.aim),2);pitchThrow(pitchLaunch(T.aim));T.live=mini.pitchLive[0];T.track=[];for(let i=0;i<40;i++){updateMini(1/40);T.track.push([T.live.x,T.live.y,T.live.z])}');
const sim = j('T.sim.pts'),
  track = j('T.track');
for (let i = 0; i < 12; i++) {
  const gap = Math.min(...sim.map(p => Math.hypot(p[0] - track[i][0], p[1] - track[i][1], p[2] - track[i][2])));
  assert.ok(gap < 3, 'the flight runs along the dotted arc at ' + i + ': ' + gap.toFixed(2));
}
// Frame rate: the same throw lands in the same place at 30, 60 and 120 Hz, and in one long step.
const ends = [];
for (const dt of [1 / 30, 1 / 60, 1 / 120, 0.1]) {
  n(`ptStart(1);pitchThrow(pitchLaunch({yaw:-0.4,dist:450,loft:0.3}));T.b=mini.pitchLive[0];ptTick(0.9,${dt})`);
  ends.push(j('[T.b.x,T.b.y,T.b.z]'));
}
for (const e of ends) assert.ok(Math.hypot(e[0] - ends[1][0], e[1] - ends[1][1], e[2] - ends[1][2]) < 1.5, 'frame-rate independent flight');
close();
console.log('PASS: physics: the parabola, floor, walls and furniture, honest launches and aims, an honest arc, any frame rate.');

// ---- The flick, in both canvas shapes ----
for (const tall of [false, true]) {
  const shape = tall ? 'portrait' : 'landscape';
  // A bottomless bucket here: the bucket has its own tests.
  n(`ptStart(1,1,${tall});mini.pitchCap=999;mini.pitchBalls=999`);
  assert.equal(n('!!mini.portrait'), tall, shape);
  // Its line is where the ball comes down, its speed is how far from her hand.
  n('T.s=pitchProject(-30,PITCH_YREF,330);T.f=ptStroke(T.s.x,T.s.y+90,T.s.x,T.s.y,1200)');
  assert.equal(n('T.f.ok'), true, shape + ': a flick up the screen throws');
  assert.equal(n('mini.pitchThrows'), 1);
  assert.ok(near(n('T.f.speed'), 1200, 1), shape + ': the speed is the finger speed: ' + n('T.f.speed'));
  assert.ok(near(n('T.f.dist'), n('pitchFlickDist(1200)'), 1e-6), shape + ': the speed sets the distance');
  const line = j(`(()=>{const P0=pitchPlanePoint(T.s.x,T.s.y+90),P1=pitchPlanePoint(T.s.x,T.s.y),L=T.f.land,
    dx=P1.x-P0.x,dz=P1.z-P0.z,n=Math.hypot(dx,dz);return {off:Math.abs((L.x-P0.x)*dz-(L.z-P0.z)*dx)/n,r:Math.hypot(L.x-PITCH_HAND.x,L.z-PITCH_HAND.z)}})()`);
  assert.ok(line.off < 0.5, shape + ': the ball comes down on the flick line: ' + line.off);
  assert.ok(near(line.r, n('T.f.dist'), 0.01), shape + ': that far from her hand');
  const v1 = j('ptLast()');
  assert.ok(near(Math.atan2(v1.vx, v1.vz), n('T.f.yaw'), 1e-9), shape + ': the launch heads for that point');
  // Harder goes farther, along the same line.
  const dists = [];
  for (const sp of [600, 1200, 1800]) {
    n(`ptTick(0.3);T.g=ptStroke(T.s.x,T.s.y+90,T.s.x,T.s.y,${sp})`);
    dists.push(n('T.g.dist'));
    const off = n(`(()=>{const P0=pitchPlanePoint(T.s.x,T.s.y+90),P1=pitchPlanePoint(T.s.x,T.s.y),L=T.g.land,dx=P1.x-P0.x,dz=P1.z-P0.z;return Math.abs((L.x-P0.x)*dz-(L.z-P0.z)*dx)/Math.hypot(dx,dz)})()`);
    assert.ok(off < 0.5, shape + ': every speed comes down on the same line');
  }
  assert.ok(dists[0] < dists[1] - 50 && dists[1] < dists[2] - 50, shape + ': harder flicks throw farther: ' + dists.map(Math.round));
  // A quick short flick is a fast low ball; a long slow swipe is a lob.
  n('ptTick(0.3);T.q=ptStroke(T.s.x,T.s.y+40,T.s.x,T.s.y,2000);T.qv={...ptLast()};ptTick(0.3);T.l=ptStroke(T.s.x,T.s.y+260,T.s.x,T.s.y,700);T.lv={...ptLast()}');
  const ang = v => Math.atan2(v.vy, Math.hypot(v.vx, v.vz)),
    spd = v => Math.hypot(v.vx, v.vy, v.vz),
    qv = j('T.qv'),
    lv = j('T.lv');
  assert.ok(n('T.q.loft') < 0.1 && ang(qv) < 0, shape + ': a short flick throws flat: ' + ang(qv).toFixed(2));
  assert.ok(n('T.l.loft') > 0.85 && ang(lv) > 0.95, shape + ': a long swipe throws a lob: ' + ang(lv).toFixed(2));
  assert.ok(spd(qv) > spd(lv) * 1.3, shape + ': the quick one is the fast one');
  // Only the last moments count: a slow sideways drift, then a flick, throws the flick.
  n('ptTick(0.3);T.a=ptStroke(T.s.x,T.s.y+200,T.s.x,T.s.y,1300)');
  n('ptTick(0.3);arcadeDown({x:T.s.x+80,y:T.s.y+200});ptStroke(T.s.x+80,T.s.y+200,T.s.x,T.s.y+200,180,{held:true,hold:true});T.b=ptStroke(T.s.x,T.s.y+200,T.s.x,T.s.y,1300,{held:true})');
  assert.ok(near(n('T.b.speed'), 1300, 13) && near(n('T.b.yaw'), n('T.a.yaw'), 0.01), shape + ': only the flick at the end counts');
  // Winding down first, or resting first, starts the swipe over: its length is the stroke that threw.
  n('ptTick(0.3);arcadeDown({x:T.s.x,y:T.s.y});ptStroke(T.s.x,T.s.y,T.s.x,T.s.y+100,400,{held:true,hold:true});T.w=ptStroke(T.s.x,T.s.y+100,T.s.x,T.s.y+20,900,{held:true})');
  assert.ok(near(n('T.w.swipe'), 80, 12), shape + ': a wind-up does not count toward the swipe: ' + n('T.w.swipe'));
  n('ptTick(0.3);T.s0=mini.pitchThrows;arcadeDown({x:T.s.x,y:T.s.y+200});ptStroke(T.s.x,T.s.y+200,T.s.x,T.s.y+80,500,{held:true,hold:true});ptTick(0.3);T.r=ptStroke(T.s.x,T.s.y+80,T.s.x,T.s.y+10,900,{held:true})');
  assert.ok(near(n('T.r.swipe'), 70, 12), shape + ': nor does a stroke before a rest: ' + n('T.r.swipe'));
  // Steering: from the same start, a flick angled left or right throws left or right.
  n('ptTick(0.3);T.k1=ptStroke(T.s.x,T.s.y+90,T.s.x-40,T.s.y,1200);ptTick(0.3);T.k2=ptStroke(T.s.x,T.s.y+90,T.s.x+40,T.s.y,1200)');
  assert.ok(n('T.k1.yaw') < n('T.k2.yaw'), shape + ': left is left');
  assert.ok(Math.abs(n('T.k1.yaw') - n('T.k2.yaw')) > 0.05, shape + ': the flick steers');
  // No auto-aim: a gremlin beside the line changes nothing about the throw.
  n('ptTick(0.5);mini.pitchTargets=[];T.n1=ptStroke(T.s.x,T.s.y+90,T.s.x+10,T.s.y,1100);T.v1={...mini.pitchLastV};ptTick(0.5)');
  n('T.g=ptGremlin("sit",T.n1.land.x+40,0,T.n1.land.z);T.g2=ptGremlin("sit",T.n1.land.x,0,T.n1.land.z+30);T.n2=ptStroke(T.s.x,T.s.y+90,T.s.x+10,T.s.y,1100);T.v2={...mini.pitchLastV}');
  assert.deepEqual(j('T.v2'), j('T.v1'), shape + ': the same flick throws the same ball, gremlins or not');
  // A tap, a slow drag, a flick down the screen or sideways: nothing thrown, and she says why.
  n('ptTick(0.5);mini.pitchTargets=[];T.c=mini.pitchThrows;arcadeDown({x:300,y:300});arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': a tap throws nothing');
  assert.match(n('mini.pitchNote.text'), /FLICK IT/, shape + ': and says flick it');
  n('ptStroke(300,400,300,300,90)');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': a slow drag throws nothing');
  assert.match(n('mini.pitchNote.text'), /QUICKER/);
  n('ptStroke(300,250,300,380,1200)');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': a flick down the screen throws nothing');
  assert.match(n('mini.pitchNote.text'), /UP INTO THE ROOM/);
  n('ptStroke(200,300,380,290,1200)');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': a sideways swipe throws nothing');
  // The faint arc shows only while the finger moves: mid-stroke yes, resting no, after release no.
  n('ptTick(0.3);T.f=ptStroke(T.s.x,T.s.y+120,T.s.x,T.s.y+40,1000,{hold:true});T.p1=!!pitchPreviewAim();drawMini()');
  assert.equal(n('T.p1'), true, shape + ': the arc shows while the finger moves');
  const prevMatch = j('(()=>{const a=pitchPreviewAim();return [a.yaw,a.dist,T.f.yaw,T.f.dist]})()');
  assert.ok(near(prevMatch[0], prevMatch[2], 0.02) && near(prevMatch[1], prevMatch[3], 25), shape + ': and it is the throw letting go would make');
  n('ptTick(PITCH_FLICK_WIN+0.05);T.p2=!!pitchPreviewAim();T.c=mini.pitchThrows;arcadeUp(false)');
  assert.equal(n('T.p2'), false, shape + ': it fades when the finger rests');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': and letting go of a resting finger throws nothing');
  n('ptTick(0.3);ptStroke(T.s.x,T.s.y+90,T.s.x,T.s.y,1200)');
  assert.equal(n('!!pitchPreviewAim()'), false, shape + ': and it is gone once the ball is away');
  // Frame rate: the same stroke read at 30, 60 and 120 Hz throws the same (160 px at 1200 px/s ends
  // on a sample at every one of those rates).
  const reads = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    n(`ptTick(0.3);T.fr=ptStroke(T.s.x,T.s.y+160,T.s.x,T.s.y,1200,{dt:${dt},len:159.5})`);
    reads.push(j('[T.fr.yaw,T.fr.dist,T.fr.loft]'));
  }
  for (const r of reads)
    assert.ok(near(r[0], reads[1][0], 0.01) && near(r[1], reads[1][1], reads[1][1] * 0.03) && near(r[2], reads[1][2], 0.08), shape + ': any frame rate, the same flick: ' + JSON.stringify(reads));
  // A cancelled press never throws; a pause drops a press; turning the phone drops it too.
  n('ptTick(0.3);T.c=mini.pitchThrows;ptStroke(T.s.x,T.s.y+90,T.s.x,T.s.y,1200,{cancel:true})');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': a cancelled flick never throws');
  n('ptStroke(T.s.x,T.s.y+90,T.s.x,T.s.y,1200,{hold:true});pauseMini();drawMini();pauseMini();arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': a pause drops the flick');
  n('ptStroke(T.s.x,T.s.y+90,T.s.x,T.s.y,1200,{hold:true});mini.portrait=!mini.portrait;updateMini(1/60);mini.portrait=!mini.portrait;arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), n('T.c'), shape + ': a rotation drops the flick');
  // The stroke pitchSwipeFor lays out throws exactly its aim, and the ball finds a gremlin there.
  n('ptTick(1);mini.pitchLive=[];T.g=ptGremlin("sit",60,0,330);T.aim=pitchAimAt(pitchCenter(T.g),0.3);T.sw=pitchSwipeFor(T.aim);T.got=mini.got;T.f=ptSwipe(T.sw);ptTick(1)');
  assert.ok(near(n('T.f.yaw'), n('T.aim.yaw'), 1e-6) && near(n('T.f.dist'), n('T.aim.dist'), 0.5), shape + ': a laid-out stroke throws its aim');
  assert.equal(n('mini.got-T.got'), 1, shape + ': and hits what it was laid out for');
}
n('delete window.innerWidth;delete window.innerHeight;resize()');
// Keys: arrows aim and set the power, W and S the arc; the arc shows while they move it; Space throws.
n('ptStart(1);T.k=JSON.parse(JSON.stringify(mini.pitchKeys))');
const key = k => n(`games[0].key(${JSON.stringify(k)},{repeat:false,preventDefault(){}})`);
key('arrowright');
n('ptTick(0.25);keys.delete("arrowright")');
assert.ok(n('mini.pitchKeys.yaw') > n('T.k.yaw') + 0.15, 'right arrow swings the aim right');
key('arrowup');
n('ptTick(0.25);keys.delete("arrowup")');
assert.ok(n('mini.pitchKeys.dist') > n('T.k.dist') + 40, 'up arrow throws farther');
key('w');
n('ptTick(0.25);keys.delete("w")');
assert.ok(n('mini.pitchKeys.loft') > n('T.k.loft') + 0.15, 'W raises the arc');
assert.equal(n('!!pitchPreviewAim()'), true, 'the arc shows while the keys set it');
n('drawMini()');
key(' ');
assert.equal(n('mini.pitchThrows'), 1, 'Space throws');
const vk = j('pitchLaunch(mini.pitchKeys)'),
  lastK = j('ptLast()');
assert.ok(near(lastK.vx, vk.x, 1e-6) && near(lastK.vz, vk.z, 1e-6), 'with the keyboard aim');
n('ptTick(1.2)');
assert.equal(n('!!pitchPreviewAim()'), false, 'and the arc fades once the keys rest');
n('miniAction("throw")');
assert.equal(n('mini.pitchThrows'), 2, 'the THROW button throws too');
// Without keys, THROW repeats the last flick exactly.
n('ptTick(0.3);T.s=pitchProject(-60,PITCH_YREF,330);ptStroke(T.s.x,T.s.y+90,T.s.x,T.s.y,1000);T.b1=ptLast();T.v1={...T.b1};ptTick(0.3);miniAction("throw");T.b2=ptLast();T.v2={...T.b2}');
assert.ok(n('T.b1!==T.b2&&T.v1.vx===T.v2.vx&&T.v1.vy===T.v2.vy&&T.v1.vz===T.v2.vz'), 'THROW repeats the last flick');
close();
console.log('PASS: the flick: line is where it lands, speed is how far, length is the arc, last moments only, no auto-aim, taps throw nothing, the arc only while moving, any frame rate, keys and the button.');

// ---- Misses teach: a scuff where it landed, and a note ----
// Level 1 is forgiving: half the right flick speed still bounces and rolls in.
n('ptStart(0);T.g=ptGremlin("sit",-20,0,410);ptSwipe(pitchSwipeFor(pitchAimAt(pitchCenter(T.g),0.3)),0.55);ptTick(2)');
assert.notEqual(n('T.g.state'), 'live', 'level 1: a flick at half speed still rolls in');
for (const [mult, side, re] of [
  [0.25, 0, /SHORT/],
  [1.6, 0, /LONG/],
  [1, 70, /WIDE RIGHT/],
  [1, -70, /WIDE LEFT/]
]) {
  n(`ptStart(0);T.g=ptGremlin("sit",-20,0,410);T.aim=pitchAimAt(pitchCenter(T.g),0.3);T.aim.yaw+=${side}/410;T.sw=pitchSwipeFor(T.aim);ptSwipe(T.sw,${mult});ptTick(2)`);
  assert.equal(n('T.g.state'), 'live', 'a ' + re.source.toLowerCase() + ' throw misses');
  assert.ok(n('mini.pitchSplats.some(s=>s.big)'), 'and leaves a scuff where it came down');
  assert.match(n('mini.pitchNote?.text||""'), re, 'and level 1 says what went wrong: ' + n('mini.pitchNote?.text'));
  n('drawMini()');
}
// A hit says nothing.
n('ptStart(0);T.g=ptGremlin("sit",-20,0,410);ptSwipe(pitchSwipeFor(pitchAimAt(pitchCenter(T.g),0.3)));ptTick(1.4)');
assert.notEqual(n('T.g.state'), 'live');
assert.equal(n('mini.pitchNote'), null, 'a hit needs no note');
// Level 3 leaves the scuff and lets her work it out.
n('ptStart(2);T.g=ptGremlin("sit",-20,0,410);ptSwipe(pitchSwipeFor(pitchAimAt(pitchCenter(T.g),0.3)),0.25);ptTick(2)');
assert.equal(n('T.g.state'), 'live');
assert.ok(n('mini.pitchSplats.length') > 0 && n('mini.pitchNote') === null, 'level 3: a scuff, no note');
// Level 1's first throw is coached with a ghost flick, and that very stroke hits.
n('ptStart(0);T.g=ptGremlin("sit",-40,0,268);T.c=pitchCoach()');
assert.match(n('T.c.text'), /SWIPE UP THROUGH IT/);
assert.ok(n('!!T.c.ghost'), 'with a ghost flick to copy');
n('ptSwipe(T.c.ghost);ptTick(1)');
assert.notEqual(n('T.g.state'), 'live', 'and copying the ghost flick hits');
close();
console.log('PASS: misses teach: a scuff where it landed, short, long or wide on level 1, a ghost flick to copy first.');

// ---- The bucket ----
n('ptStart(1)');
assert.equal(n('mini.pitchBalls'), 9);
assert.equal(n('mini.pitchCap'), 10);
n('pitchThrow({x:0,y:200,z:500});pitchThrow({x:0,y:200,z:500})');
assert.equal(n('mini.pitchThrows'), 1, 'one throw per arm swing');
n('ptTick(0.2);pitchThrow({x:0,y:200,z:500})');
assert.equal(n('mini.pitchBalls'), 7, 'each throw takes a ball');
n('mini.pitchBalls=0;T.t=mini.pitchThrows;ptTick(0.2);pitchThrow({x:0,y:200,z:500})');
assert.equal(n('mini.pitchThrows'), n('T.t'), 'an empty bucket cannot throw');
n('ptTick(PITCH_TIERS[1].empty+0.05)');
assert.equal(n('mini.pitchBalls'), 1, 'but an empty bucket gets a ball back fast');
n('T.t=PITCH_TIERS[1].refill;ptTick(T.t*2+0.05)');
assert.equal(n('mini.pitchBalls'), 3, 'below the top, a ball comes back every refill');
n('mini.pitchBalls=10;ptTick(5)');
assert.equal(n('mini.pitchBalls'), 10, 'never past the top');
// A hit puts the ball back.
n('mini.pitchBalls=5;T.g=ptGremlin("sit",60,0,330);pitchThrow(ptAt(pitchCenter(T.g)));ptTick(0.8)');
assert.equal(n('mini.got'), 1);
assert.equal(n('mini.pitchBalls'), 5, 'a hit refunds the throw');
close();
console.log('PASS: the bucket: throws cost a ball, hits give it back, an empty bucket refills fast, never stalls.');

// ---- Gremlins ----
// Streaks: hits build it; a throw that touches nothing breaks it.
n('ptStart(1);for(const x of [-100,0,100]){const g=ptGremlin("sit",x,0,330);mini.pitchCd=0;pitchThrow(ptAt(pitchCenter(g)));ptTick(0.8)}');
assert.equal(n('mini.combo'), 3, 'three hits, a streak of three');
n('mini.pitchCd=0;pitchThrow({x:0,y:-50,z:80});ptTick(2)');
assert.equal(n('mini.combo'), 0, 'a ball that finds nothing breaks the streak');
// Bedpan shields clang unless the ball came off a wall.
n('T.s=ptGremlin("shield",-60,0,330);mini.pitchCd=0;pitchThrow(ptAt(pitchCenter(T.s),0.1));ptTick(0.8)');
assert.equal(n('T.s.state'), 'live', 'a straight throw clangs off the bedpan');
assert.ok(n('mini.pitchPops.some(p=>p.text.startsWith("CLANG"))'));
n('T.b=pitchNewBall({x:0,y:0,z:0});Object.assign(T.b,{x:T.s.x,y:T.s.y+60,z:T.s.z,vx:0,vy:-200,vz:0,walls:1});mini.pitchLive.push(T.b);ptTick(0.3)');
assert.notEqual(n('T.s.state'), 'live', 'a ball that came off a wall gets it');
assert.equal(n('mini.pitchBanks'), 1);
// Hidden peekers: behind each tall cover a flat throw hits the cover, and a ball dropping over the top
// gets them. The footboard sits right under her hand, so every throw at it comes down over the top.
for (const cover of j('PITCH_PEEKS.map(p=>p.id)')) {
  n(`ptStart(1);T.pk=pitchSpawn("peek");T.pk.cover=PITCH_PEEKS.find(p=>p.id==="${cover}");T.pk.key=T.pk.cover.key;T.pk.mode="hidden";T.pk.modeT=99;pitchPeekPlace(T.pk);T.c=pitchCenter(T.pk)`);
  if (cover !== 'footboard') {
    n('pitchThrow(ptAt(T.c,0));ptTick(0.8)');
    assert.equal(n('T.pk.state'), 'live', 'a flat throw at a peeker hidden behind the ' + cover + ' hits the cover');
  }
  n('T.b=pitchNewBall({x:0,y:0,z:0});Object.assign(T.b,{x:T.c.x,y:T.c.y+90,z:T.c.z,vx:0,vy:-120,vz:0});mini.pitchLive.push(T.b);ptTick(0.4)');
  assert.notEqual(n('T.pk.state'), 'live', 'a ball dropping behind the ' + cover + ' gets it');
  assert.equal(n('mini.pitchLobs'), 1);
}
// Peekers come up on a timeline, and pitchFuture knows where they will be.
n('ptStart(1);T.pk=pitchSpawn("peek");T.pk.modeT=0.01;ptTick(0.3)');
assert.equal(n('T.pk.mode'), 'up', 'a peeker rises');
n('T.pred=pitchFuture(T.pk,0.5);ptTick(0.5);T.now=pitchCenter(T.pk)');
assert.ok(n('Math.hypot(T.pred.x-T.now.x,T.pred.y-T.now.y,T.pred.z-T.now.z)') < 1, 'the predictor follows the peek');
// Walkers pace their path and turn around; the predictor follows them through the turn.
n('ptStart(1);T.w=pitchSpawn("walk",1);T.w.u=0.95;T.w.dir=1;T.pred=pitchFuture(T.w,1.2);ptTick(1.2);T.now=pitchCenter(T.w)');
assert.equal(n('T.w.dir'), -1, 'a walker turns at the end of its path');
assert.ok(n('Math.hypot(T.pred.x-T.now.x,T.pred.z-T.now.z)') < 3, 'the predictor knows the turn, to within a frame');
// Chargers head for the bed; one that reaches the footboard is an oops.
n('ptStart(1);T.ch=pitchSpawn("charge");T.pred=pitchFuture(T.ch,1);ptTick(1);T.now=pitchCenter(T.ch)');
assert.ok(n('Math.hypot(T.pred.x-T.now.x,T.pred.z-T.now.z)') < 1, 'the predictor follows a charger');
n('T.ch.u=0.99;ptTick(1)');
assert.equal(n('mini.miss'), 1, 'a charger on the bed is an oops');
assert.match(n('mini.flashText'), /ON THE BED/);
// Hoppers rest, crouch and jump; one hit mid-air is worth more.
n('ptStart(1);T.h=pitchSpawn("hop");T.h.modeT=0.01;ptTick(0.3)');
assert.equal(n('T.h.mode'), 'air', 'a hopper jumps after a crouch');
n('T.b=pitchNewBall({x:0,y:0,z:0});T.c=pitchCenter(T.h);Object.assign(T.b,{x:T.c.x,y:T.c.y+40,z:T.c.z,vx:0,vy:-300,vz:0});mini.pitchLive.push(T.b);updateMini(1/60);updateMini(1/60)');
assert.equal(n('mini.pitchAirs'), 1, 'mid-air');
// Golden gremlins are worth two and do not wait.
n('ptStart(2);T.gd=pitchSpawn("timed");T.w0=mini.got;pitchThrow(ptAt(pitchCenter(T.gd),0.1));ptTick(0.8)');
assert.equal(n('mini.got-T.w0'), 2, 'a golden gremlin counts twice');
n('T.gd=pitchSpawn("timed");ptTick(PITCH_TIERS[2].timed+0.5)');
assert.notEqual(n('T.gd.state'), 'live', 'and leaves when its clock runs out');
// The Ump: never before level 3; the final inning of level 3; inning 2 of Legendary. Four hits, and a
// brushback when nobody hits him.
n('ptStart(1);mini.phaseTime=mini.limit*2/3+0.01;mini.pitchSpawnT=999;ptTick(0.1)');
assert.equal(n('mini.pitchUmpSpawned'), false, 'no Ump before level 3');
n('ptStart(2);mini.phaseTime=mini.limit/3+0.01;ptTick(0.1)');
assert.equal(n('mini.pitchUmpSpawned'), false, 'level 3: not in inning 2');
n('ptStart(3);mini.phaseTime=mini.limit/3+0.01;ptTick(0.1)');
assert.equal(n('mini.pitchUmpSpawned'), true, 'Legendary: the Ump is early, in inning 2');
n('ptStart(2);mini.phaseTime=mini.limit*2/3+0.01;ptTick(0.1);T.u=mini.pitchTargets.find(e=>e.kind==="ump")');
assert.ok(n('!!T.u'), 'the Ump takes the final inning of level 3');
assert.equal(n('T.u.hp'), 4);
n('T.u.mode="hidden";T.u.modeT=0.01;mini.pitchBalls=8;ptTick(0.3)');
assert.equal(n('T.u.mode'), 'up');
n('ptTick(PITCH_TIERS[2].umpUp+0.1);ptTick(0.7)');
assert.equal(n('mini.miss'), 1, 'his brushback is an oops');
assert.match(n('mini.flashText'), /BRUSHBACK/);
for (let hit = 0; hit < 4; hit++) {
  n('T.u.mode="up";T.u.modeT=5;pitchPeekPlace(T.u);T.b=pitchNewBall({x:0,y:0,z:0});T.c=pitchCenter(T.u);Object.assign(T.b,{x:T.c.x,y:T.c.y+50,z:T.c.z,vx:0,vy:-200,vz:0});mini.pitchLive.push(T.b);ptTick(0.3)');
}
assert.equal(n('mini.pitchUmpDown'), true, 'four hits eject him');
assert.equal(n('mini.got'), 7, 'four hits plus three for the ejection');
close();
console.log('PASS: gremlins: streaks, shields need a bank, lobs over cover, peekers, walkers, chargers, hoppers, golden ones, the Ump on time.');

// ---- Bottles and the E-Type ----
n('ptStart(1);T.b=pitchNewBall({x:0,y:0,z:0});T.bt=mini.pitchBottles.find(o=>o.set==="pyramid"&&o.i===0);Object.assign(T.b,{x:T.bt.x-20,y:T.bt.y+8,z:T.bt.z,vx:300,vy:0,vz:0});mini.pitchLive.push(T.b);ptTick(0.3)');
assert.ok(n('mini.pitchBottles.filter(o=>o.set==="pyramid"&&!o.up).length') >= 3, 'a ball through the bottom row clears a lane of bottles');
n('ptStart(1);mini.pitchBalls=2;T.bt=mini.pitchBottles.find(o=>o.set==="pyramid"&&o.i===0);pitchKnock(T.bt,200,100,0,null)');
assert.equal(n('T.bt.up'), false, 'a bottle goes flying');
assert.equal(n('mini.pitchBottles.filter(o=>o.set==="pyramid"&&!o.up).length'), 3, 'and the two stacked on it follow');
assert.equal(n('mini.pitchBalls'), 5, 'each bottle puts a ball in the bucket');
n('for(const o of mini.pitchBottles)if(o.set==="pyramid"&&o.up)pitchKnock(o,0,100,0,null)');
assert.equal(n('mini.pitchBalls'), 10, 'carnival rules: the whole pyramid pays two more');
n('ptTick(7.2)');
assert.equal(n('mini.pitchBottles.filter(o=>o.set==="pyramid"&&o.up).length'), 6, 'Barb from Dietary restocks it');
// A flick can ring them: the pyramid is in reach.
n('ptStart(0);T.r=mini.pitchRings;ptSwipe(pitchSwipeFor(pitchAimAt({x:-111,y:90,z:231},0.15)));ptTick(1)');
assert.ok(n('mini.pitchRings') > n('T.r'), 'a flick at the pyramid rings it');
// Level 1 keeps the shelf clear; level 2 on puts three bottles in front of the E-Type.
n('ptStart(0)');
assert.equal(n('mini.pitchBottles.filter(o=>o.set==="shelf").length'), 0);
for (const t of [1, 2, 3]) {
  n(`ptStart(${t})`);
  assert.equal(n('mini.pitchBottles.filter(o=>o.set==="shelf").length'), 3);
}
// Hitting the E-Type is not a crime, but it costs the streak.
n('mini.combo=4;mini.pitchBottles=[];pitchThrow(ptAt({x:186,y:104,z:327},0));ptTick(0.8)');
assert.equal(n('mini.combo'), 0, 'the E-Type ends the streak');
assert.equal(n('mini.pitchEtypeHits'), 1);
assert.match(n('mini.flashText'), /E-TYPE/);
close();
console.log('PASS: bottles ring and refill the bucket, a flick reaches them, the pyramid restocks, the shelf waits for level 2, the E-Type survives.');

// ---- Spawns, pacing, the four levels ----
// Level 1 opens with sitting ducks, one at a time at first; walkers wait for inning 2.
n('ptStart(0);mini.pitchSpawnT=0;mini.pitchScript=PITCH_TIERS[0].script.slice();T.kinds=[];for(let i=0;i<1500&&mini.phaseTime<mini.limit/3-0.5;i++){updateMini(1/60);for(const e of mini.pitchTargets)if(e.state==="live"&&!T.kinds.includes(e.id)){T.kinds.push(e.id);T.kinds.push(e.kind)}for(const e of mini.pitchTargets)if(e.state==="live"&&mini.pitchTargets.filter(o=>o.state==="live").length>2)T.over=true;for(const e of mini.pitchTargets)e.state="gone"}');
assert.ok(j('T.kinds').filter((k, i) => i % 2).every(k => k === 'sit'), 'inning 1 of level 1 is all sitting ducks');
assert.ok(!n('T.over'), 'no more than two at a time');
// Close, big, slow: level 1's scripted ducks are the nearest open spots, and its gremlins the biggest.
for (const s of j('PITCH_TIERS[0].script')) {
  const spot = j(`PITCH_SITS[${s.split(':')[1]}]`);
  assert.ok(spot.y === 0 && spot.z <= 410 && !spot.wall, 'level 1 opens on a close floor spot: ' + s);
}
for (let t = 0; t < 4; t++) for (let s = 0; s < 3; s++) assert.ok(n(`PITCH_TIERS[${t}].mix[${s}]`) !== undefined);
assert.ok(!('walk' in j('PITCH_TIERS[0].mix[0]')) && j('PITCH_TIERS[0].mix[1]').walk > 0, 'walkers arrive in inning 2');
assert.ok(!('shield' in j('PITCH_TIERS[1].mix[0]')) && j('PITCH_TIERS[1].mix[1]').shield > 0, 'level 2 shields arrive in inning 2');
assert.ok(j('PITCH_TIERS[2].mix[0]').timed > 0, 'level 3 has golden gremlins');
const L = j('PITCH_TIERS');
// Level 1 is gentler than level 3 in every dial.
assert.ok(L[0].walk[1] < L[2].walk[0], 'slower walkers');
assert.ok(L[0].peek[0] > L[2].peek[0] * 1.8, 'longer peeks');
assert.ok(L[0].charge < L[2].charge * 0.6, 'slower chargers');
assert.ok(L[0].balls[0] > L[2].balls[0] && L[0].refill < L[2].refill, 'a bigger bucket that refills faster');
assert.ok(L[0].hit > L[1].hit && L[1].hit > L[2].hit && L[2].hit > L[3].hit, 'gremlins shrink level by level');
assert.ok(L[0].arc[0] >= L[1].arc[0] && L[1].arc[1] >= L[2].arc[1] && L[2].arc[1] > L[3].arc[1], 'the arc shows less level by level');
// Legendary: fast walkers, more shields, the Ump early, a tight bucket, a shorter clock.
const shields = t => L[t].mix.reduce((a, m) => a + (m.shield || 0) / Object.values(m).reduce((x, y) => x + y, 0), 0);
assert.ok(L[3].walk[0] > L[2].walk[0] * 1.25 && L[3].walk[1] > L[2].walk[1] * 1.15, 'Legendary walkers are faster');
assert.ok(shields(3) > shields(2) * 1.4, 'more shields');
assert.ok(L[3].umpAt >= 0 && L[3].umpAt < L[2].umpAt, 'the Ump comes early');
assert.ok(L[3].balls[1] < L[2].balls[1] && L[3].refill >= L[2].refill, 'a tight bucket');
assert.ok(L[3].limit < L[2].limit, 'a shorter clock');
assert.ok(L[3].charge > L[2].charge && L[3].peek[0] < L[2].peek[0] && L[3].timed < L[2].timed, 'quicker chargers, peeks and golden windows');
// Fairness on every level: every place a gremlin can stand, walk, peek, hop or charge is reachable by a
// flick: some arc whose real flight gets there before touching anything but the floor (at the smallest
// gremlin, Legendary's), and whose stroke fits on the canvas in both shapes.
const blocked = j(`(()=>{
  const out = [], R = PITCH_TIERS[3].hit * 0.7 + PITCH_BALL;
  function test(name, x, y, z, size = 1) {
    const c = { x, y: y + 24 * size, z };
    for (const loft of [0.15, 0.3, 0, 0.5, 0.75, 1]) {
      const aim = pitchAimAt(c, loft);
      if (!aim) continue;
      let swipes = true;
      for (const tall of [false, true]) { mini.portrait = tall; if (!pitchSwipeFor(aim)) swipes = false; }
      mini.portrait = false;
      if (!swipes) continue;
      const b = pitchNewBall(pitchLaunch(aim));
      for (let i = 0; i < 500 && !b.dead; i++) {
        const hit = pitchMoveBall(b, PITCH_SUB);
        if (Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) < R * size) return;
        if (hit && hit !== 'floor') break;
      }
    }
    out.push(name);
  }
  PITCH_SITS.forEach((s, i) => test('sit ' + i, s.x, s.y, s.z));
  PITCH_WALKS.forEach((w, i) => { for (let u = 0; u <= 1.001; u += 0.1) test('walk ' + i + ' at ' + u.toFixed(1), ...pitchLerp3(w.a, w.b, u)); });
  PITCH_PEEKS.forEach(p => test('peek ' + p.id, ...p.up));
  PITCH_UMP_SPOTS.forEach(p => test('ump ' + p.id, ...p.up, 1.45));
  PITCH_HOPS.forEach((h, i) => test('hop ' + i, ...h));
  PITCH_CHARGES.forEach((c, i) => { for (let u = 0.5; u <= 0.95; u += 0.15) test('charge ' + i, c[0] + (90 - c[0]) * u, 0, c[2] + (PITCH_REACH - c[2]) * u); });
  return out;
})()`);
assert.deepEqual(blocked, [], 'every spot is reachable by a flick: ' + blocked.join(', '));
// Every spot a shield can stand on banks in, on every level with shields, in both shapes: the bank
// planner's stroke, swiped through the real pointer path, takes the shield down off a wall.
for (const tier of [1, 2, 3])
  for (const tall of [false, true]) {
    const misses = j(`(()=>{
      const out = [];
      PITCH_SITS.forEach((s, i) => {
        if (s.high || s.wall) return;
        ptStart(${tier}, 1, ${tall});
        const e = ptGremlin('shield', s.x, s.y, s.z), plan = pitchBankPlan(e);
        if (!plan) return out.push('sit ' + i + ' has no bank');
        ptSwipe(plan.swipe);
        ptTick(2.5);
        if (e.state === 'live' || !mini.pitchBanks) out.push('sit ' + i + ' missed');
      });
      return out;
    })()`);
    assert.deepEqual(misses, [], `level ${tier + 1} ${tall ? 'portrait' : 'landscape'}: every shield banks in: ` + misses.join(', '));
  }
n('delete window.innerWidth;delete window.innerHeight;resize()');
// Every hiding place has a lob (a long swipe) that drops over the cover onto the peeker behind it.
const lobs = j(`(()=>{
  const out = [];
  for (const cover of PITCH_PEEKS) {
    const c = { x: cover.hide[0], y: cover.hide[1] + 24, z: cover.hide[2] }, R = 14 + PITCH_BALL;
    let found = false;
    // Aimed at the peeker, or a little deeper into the hiding place: a lob that drops in.
    for (let loft = 0.5; loft <= 1.001 && !found; loft += 0.05)
    for (const deeper of [0, 6, 12]) {
      if (found) break;
      const aim = pitchAimAt({ ...c, z: c.z + deeper }, loft);
      if (!aim) continue;
      let swipes = true;
      for (const tall of [false, true]) { mini.portrait = tall; if (!pitchSwipeFor(aim)) swipes = false; }
      mini.portrait = false;
      if (!swipes) continue;
      const b = pitchNewBall(pitchLaunch(aim));
      for (let i = 0; i < 700 && !b.dead; i++) {
        const hit = pitchMoveBall(b, PITCH_SUB);
        if (Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) < R) { found = true; break; }
        if (hit) break;
      }
    }
    if (!found) out.push(cover.id);
  }
  return out;
})()`);
assert.deepEqual(lobs, [], 'every hiding place can be lobbed: ' + lobs.join(', '));
// Nothing lands on her without a tell. The Ump only throws after standing in plain view, winding up,
// for at least two seconds, on every level he plays and every prescription; a charger takes at least
// two seconds to cross the room, chevrons pointing at the bed.
for (const tier of [2, 3])
  for (const d of [0, 1, 2]) {
    const tell = j(`(()=>{
      ptStart(${tier}, ${d});
      mini.phaseTime = mini.limit * 2 / 3 + 0.01; ptTick(0.05);
      const u = mini.pitchTargets.find(e => e.kind === 'ump');
      let upFor = 0, shortest = 99, throws = 0;
      for (let i = 0; i < 1800 && mini.screen === 'play'; i++) {
        const before = mini.pitchIncoming;
        updateMini(1 / 60);
        upFor = u.mode === 'up' ? upFor + 1 / 60 : u.mode === 'sink' ? upFor : 0;
        if (!before && mini.pitchIncoming) { throws++; shortest = Math.min(shortest, upFor); }
        mini.miss = 0;
      }
      return { throws, shortest };
    })()`);
    assert.ok(tell.throws > 0 && tell.shortest >= 2 - 0.02, `level ${tier + 1} P${d}: the Ump winds up in plain view for ${tell.shortest.toFixed(2)} s before a brushback`);
  }
for (const d of [0, 1, 2]) {
  const fastest = n(`(()=>{ptStart(3, ${d});const T3=PITCH_TIERS[3],sp=T3.charge*pitchPace()*1.1;return Math.min(...PITCH_CHARGES.map(c=>Math.hypot(c[0]-140,c[2]-(PITCH_REACH-8))/sp))})()`);
  assert.ok(fastest >= 1.8, `Legendary P${d}: the quickest charger takes ${fastest.toFixed(2)} s to reach the bed`);
}
close();
console.log('PASS: spawns open gently, kinds arrive by inning, four levels in order, every spot, shield and hiding place fair on every level, every threat has a tell.');

// ---- Idle play loses, on every level ----
for (let tier = 0; tier < 4; tier++) {
  close();
  n(`state.difficulty=1;openMini(0);mini.tier=${tier};startMini();launchMini();updateMini(3.3)`);
  for (let i = 0; i < 3000 && n('mini.screen') === 'play'; i++) n('updateMini(.05)');
  assert.equal(n('mini.screen'), 'outro');
  assert.equal(n('mini.pendingFinish.win'), false, `level ${tier + 1} idle loses`);
}
close();
console.log('PASS: idle play loses on every level.');

// ---- Same seed, same game; a Daily Dose replays identically ----
const game = seed => {
  n(`rng=${seed};state.difficulty=1;openMini(0);mini.tier=1;startMini();launchMini();updateMini(3.3);for(let i=0;i<1800;i++)updateMini(1/60)`);
  const r = n('mini.pitchTargets.map(e=>e.kind+":"+(e.spot||"")+":"+Math.round(e.x)).join()+"|"+mini.pitchSerial');
  close();
  return r;
};
assert.equal(game(31), game(31), 'deterministic for a seed');
assert.notEqual(game(31), game(32), 'different seeds, different games');
const daily = () => {
  n('openMini(0);Object.assign(mini,{daily:true,dailyDate:"2026-11-02",dailySeed:12345,tier:1,approach:1});startMini();launchMini();updateMini(3.3);for(let i=0;i<1200;i++)updateMini(1/60)');
  const r = n('mini.pitchTargets.map(e=>e.kind+":"+(e.spot||"")).join()+"|"+mini.pitchSerial');
  close();
  return r;
};
n('rng=1');
const d1 = daily();
n('rng=99');
assert.equal(daily(), d1, 'a Daily Dose spawns the same for everyone');
console.log('PASS: deterministic games and Daily Doses.');

// ---- Every screen draws, in both shapes ----
for (const tall of [false, true]) {
  for (const tier of [0, 1, 2, 3]) {
    n(`ptStart(${tier},1,${tall})`);
    n('drawMini();for(const k of ["sit","walk","peek","hop","shield","charge","timed"])pitchSpawn(k);pitchSpawnUmp();pitchSpawn("peek");ptTick(0.5);drawMini()');
    n('for(const e of mini.pitchTargets){if(e.kind==="peek"||e.kind==="ump"){e.mode="up";e.modeT=1;pitchPeekPlace(e)}}drawMini()');
    // Mid-flick (the arc and the finger streak), after it (the ball, its scuffs), and a note.
    n('T.s=pitchProject(-30,PITCH_YREF,330);ptStroke(T.s.x,T.s.y+100,T.s.x,T.s.y,1100,{hold:true});drawMini();arcadeUp(false);ptTick(0.6);drawMini()');
    n('mini.pitchNote={text:"SHORT · FLICK HARDER",x:200,y:200,t:1,tall:!!mini.portrait};drawMini();mini.pitchNote=null');
    n('mini.pitchKeyAim=true;mini.pitchKeyShow=0.5;mini.pitchPress=null;drawMini();mini.pitchKeyAim=false');
    n('for(const o of mini.pitchBottles)if(o.up){pitchKnock(o,50,100,0,null);break}mini.pitchIncoming={x:0,y:80,z:400,t:0.2,dur:0.6};mini.pitchBedFx={t:0.3,x:300,y:300,art:1};mini.pitchFreeze=2;mini.pitchHitFlash=0.2;mini.pitchShake=0.2;mini.pitchEtype=0.5;mini.combo=6;drawMini()');
    n('mini.pitchBalls=0;mini.pitchFreeze=0;for(const e of mini.pitchTargets)if(e.state==="live"){e.state="dying";e.dyT=0.2}drawMini();pauseMini();drawMini();pauseMini()');
  }
  // Coaching: level 1's ghost flick, level 2's bank guide with its stroke and flight.
  n(`ptStart(0,1,${tall});ptGremlin("sit",-40,0,268);drawMini()`);
  n(`ptStart(1,1,${tall});T.sh=ptGremlin("shield",-40,0,268);pitchBankPlan(T.sh);T.c=pitchCoach();drawMini()`);
  assert.match(n('T.c.text'), /FLICK ALONG THE ARROW/, 'level 2 shows its first bank');
  assert.ok(n('!!T.c.ghost&&T.c.path.length>5'), 'with the stroke and the flight');
  // Losing two ways, the outro and the result art.
  for (const reason of ['quota', 'stormed']) {
    n(`ptStart(1,1,${tall});finishMini(false,${reason === 'quota' ? 'PITCH_QUOTA_MISSED' : 'undefined'})`);
    for (let t = 0; t <= 2.2; t += 0.1) n(`mini.transition=${t};drawMini()`);
    n('mini.transition=0;updateMini(2.3);drawResultArt()');
    assert.equal(n('mini.screen'), 'result');
    assert.match(n('$("resultHeading").textContent'), reason === 'quota' ? /YER OUT/ : /STORMED/);
  }
  n(`ptStart(3,1,${tall});finishMini(true);for(let t=0;t<=2.2;t+=0.2)drawMini(),updateMini(0.2);updateMini(0.5);drawResultArt()`);
  assert.equal(n('mini.win'), true);
  assert.equal(n('games[0].resultArt(mc)'), false, 'a win uses the shared ceremony');
}
n('delete window.innerWidth;delete window.innerHeight;resize()');
n('games[0].scene($("miniPreview").getContext("2d"),420,240);games[0].scene(c,260,135)');
n('ptStart(0);pitchShell(mc,800,450);mini.portrait=true;pitchShell(mc,450,800);mini.portrait=false');
for (let t = 0; t < 4; t++) {
  n(`mini.tier=${t}`);
  assert.equal(typeof n('games[0].lesson().goal'), 'string');
  assert.doesNotMatch(n('games[0].lesson().goal'), /—/);
}
close();
console.log('PASS: every pitch draw path runs in both shapes on every level: play, the flick, scuffs, notes, coaching, both losses, the win, the cards.');
