// Fastpitch Fever: the registry slot; ball physics (gravity, bounces off the floor, walls and furniture,
// frame-rate independence, an honest preview arc); controls in both canvas shapes (tap for a fastball,
// drag to sling, cancels, keys, the THROW button); the bucket; every gremlin kind and its rule; bottles,
// the E-Type and streaks; spawns, pacing and fairness (every spot a fastball can reach, every shield a
// bank shot can reach, level 1 gentler than level 3); idle play loses; every screen draws.
// Test objects live on T so they never collide with the game's globals.
const { run, nodes, close, assert } = require('./harness.cjs');
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
function ptScreen(x, y, z) { return pitchProject(x, y, z); }
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
assert.equal(n('games[0].tierNotes.length'), 3);
for (const k of ['game', 'genre', 'headline', 'desc', 'goal', 'control', 'avoid', 'cue']) {
  assert.equal(typeof n(`games[0].info.${k}`), 'string', k);
  assert.doesNotMatch(n(`games[0].info.${k}`), /—|!/, `no em-dashes or exclamation points in info.${k}`);
}
for (const t of j('games[0].tierNotes')) assert.doesNotMatch(t, /—/);
for (const t of [...j('Object.values(PITCH_INTROS)'), n('PITCH_QUOTA_MISSED')]) assert.doesNotMatch(t, /—/);
console.log('PASS: Fastpitch Fever registry: room 0, gesture layout, both canvas shapes, its own track, clean copy.');

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
// Furniture: a throw at the cabinet's front comes back off it.
n('T.v=pitchFastball({x:185,y:50,z:300});T.b=pitchNewBall(T.v);T.c=null;while(T.b.age<1&&!T.c){T.c=pitchMoveBall(T.b,PITCH_SUB)}');
assert.equal(n('T.c'), 'cabinet', 'the cabinet is solid');
assert.ok(n('T.b.vz') < 0, 'and the ball bounces back off it');
// A fastball arrives where it was sent.
n('T.q={x:-60,y:30,z:330};T.v=pitchFastball(T.q);T.Tf=Math.hypot(T.q.x-PITCH_HAND.x,T.q.y-PITCH_HAND.y,T.q.z-PITCH_HAND.z)/PITCH_FAST;T.b=ptFly(T.v,T.Tf)');
assert.ok(n('Math.hypot(T.b.x-T.q.x,T.b.y-T.q.y,T.b.z-T.q.z)') < 5, 'the fastball meets its point on time: ' + n('Math.hypot(T.b.x-T.q.x,T.b.y-T.q.y,T.b.z-T.q.z)'));
// The dotted arc is the real flight: preview points match a live ball.
n('T.aim={yaw:0.3,power:0.6};T.sim=pitchSimulate(pitchAimVelocity(T.aim),2);pitchThrow(pitchAimVelocity(T.aim));T.live=mini.pitchLive[0];T.track=[];for(let i=0;i<40;i++){updateMini(1/40);T.track.push([T.live.x,T.live.y,T.live.z])}');
const sim = j('T.sim.pts'),
  track = j('T.track');
for (let i = 0; i < 12; i++) {
  const gap = Math.min(...sim.map(p => Math.hypot(p[0] - track[i][0], p[1] - track[i][1], p[2] - track[i][2])));
  assert.ok(gap < 3, 'the flight runs along the dotted arc at ' + i + ': ' + gap.toFixed(2));
}
// Frame rate: the same throw lands in the same place at 30, 60 and 120 Hz, and in one long step.
const ends = [];
for (const dt of [1 / 30, 1 / 60, 1 / 120, 0.1]) {
  n(`ptStart(1);pitchThrow(pitchAimVelocity({yaw:-0.4,power:0.8}));T.b=mini.pitchLive[0];ptTick(0.9,${dt})`);
  ends.push(j('[T.b.x,T.b.y,T.b.z]'));
}
for (const e of ends) assert.ok(Math.hypot(e[0] - ends[1][0], e[1] - ends[1][1], e[2] - ends[1][2]) < 1.5, 'frame-rate independent flight');
close();
console.log('PASS: physics: the parabola, floor, walls and furniture, an on-time fastball, an honest arc, any frame rate.');

// ---- Controls, in both canvas shapes ----
for (const tall of [false, true]) {
  const shape = tall ? 'portrait' : 'landscape';
  n(`ptStart(0,1,${tall})`);
  assert.equal(n('!!mini.portrait'), tall, shape);
  // A tap on a gremlin sends a fastball into it.
  n('T.g=ptGremlin("sit",-40,0,268);T.p=ptScreen(T.g.x,T.g.y+24,T.g.z);arcadeDown({x:T.p.x,y:T.p.y});arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), 1, shape + ': a tap throws');
  assert.equal(n('mini.pitchRipples.length'), 1, shape + ': and leaves a ripple');
  n('ptTick(0.6)');
  assert.equal(n('mini.got'), 1, shape + ': the fastball found the gremlin');
  n('ptTick(2.5)');
  assert.equal(n('mini.pitchHits'), 1, shape + ': once the ball stops, the throw counts as a hit');
  // A tap on the floor aims at that spot on the floor.
  n('T.f=ptScreen(20,0,300);T.r=pitchRaycast(T.f.x,T.f.y)');
  assert.ok(n('Math.hypot(T.r.x-20,T.r.y,T.r.z-300)') < 1, shape + ': a tap on the floor aims at that floor point');
  // Dragging back past the slop arms the sling; the arc follows the pull.
  n('ptTick(0.3);T.s=mini.pitchThrows;arcadeDown({x:300,y:200});arcadeMove({x:305,y:204})');
  assert.equal(n('mini.pitchPress.armed'), false, shape + ': a wobble is still a tap');
  n('arcadeMove({x:250,y:320})');
  assert.equal(n('mini.pitchPress.armed'), true, shape + ': a real drag arms the sling');
  const aim = j('mini.pitchAim');
  assert.ok(aim.yaw > 0, shape + ': pulling left aims right');
  assert.ok(near(aim.power, Math.min(1, Math.hypot(50, 120) / 165), 1e-9), shape + ': pull length is power');
  n('drawMini()');
  n('arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), n('T.s') + 1, shape + ': release throws');
  const v = j('mini.pitchLive[mini.pitchLive.length-1]');
  assert.ok(v.vz > 0 && v.vx > 0, shape + ': forward and to the right');
  // A soft pull keeps the ball; a cancelled press never throws; a drag upward throws the way it went.
  n('ptTick(0.3);T.s=mini.pitchThrows;arcadeDown({x:300,y:200});arcadeMove({x:300,y:214});arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), n('T.s'), shape + ': too soft a pull keeps the ball');
  assert.ok(n('mini.pitchPops.some(p=>p.text==="PULL BACK FARTHER")'));
  n('arcadeDown({x:300,y:200});arcadeMove({x:300,y:330});arcadeUp(true)');
  assert.equal(n('mini.pitchThrows'), n('T.s'), shape + ': a cancelled press never throws');
  n('arcadeDown({x:300,y:300});arcadeUp(true)');
  assert.equal(n('mini.pitchThrows'), n('T.s'), shape + ': a cancelled tap never throws');
  n('ptTick(0.3);arcadeDown({x:300,y:300});arcadeMove({x:340,y:180});arcadeUp(false);T.l=mini.pitchLive[mini.pitchLive.length-1]');
  assert.ok(n('T.l.vz') > 0 && n('T.l.vx') > 0, shape + ': a drag upward throws the way it went');
  assert.ok(n('T.l.vy') > n('Math.hypot(T.l.vx,T.l.vz)') * 1.6, shape + ': as a high lob');
  // Pausing drops a press in progress, so resuming never throws.
  n('ptTick(0.3);T.s=mini.pitchThrows;arcadeDown({x:300,y:200});arcadeMove({x:300,y:330});pauseMini();drawMini();pauseMini();arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), n('T.s'), shape + ': a pause drops the press');
  // Turning the phone mid-drag drops it too.
  n('arcadeDown({x:300,y:200});arcadeMove({x:300,y:330});mini.portrait=!mini.portrait;updateMini(1/60);mini.portrait=!mini.portrait;arcadeUp(false)');
  assert.equal(n('mini.pitchThrows'), n('T.s'), shape + ': a rotation drops the press');
}
n('delete window.innerWidth;delete window.innerHeight;resize()');
// Keys: arrows aim (the arc shows), Space throws; the THROW button throws the current aim.
n('ptStart(1);T.a=mini.pitchAim.yaw;T.p=mini.pitchAim.power');
const key = (k, type = 'keydown') => n(`games[0].key(${JSON.stringify(k)},{repeat:false,preventDefault(){}})`);
key('arrowright');
n('ptTick(0.25);keys.delete("arrowright")');
assert.ok(n('mini.pitchAim.yaw') > n('T.a') + 0.15, 'right arrow swings the aim right');
key('arrowup');
n('ptTick(0.25);keys.delete("arrowup")');
assert.ok(n('mini.pitchAim.power') > n('T.p') + 0.1, 'up arrow throws farther');
assert.equal(n('mini.pitchKeyAim'), true, 'the arc shows for the keyboard');
n('drawMini()');
key(' ');
assert.equal(n('mini.pitchThrows'), 1, 'Space throws');
n('ptTick(0.3);miniAction("throw")');
assert.equal(n('mini.pitchThrows'), 2, 'so does the THROW button');
const vk = j('pitchAimVelocity(mini.pitchAim)'),
  last = j('mini.pitchLive[mini.pitchLive.length-1]');
assert.ok(near(last.vx, vk.x, 80) && last.vz > 0, 'with the keyboard aim');
// Without keys, THROW repeats the last throw exactly: a tap's fastball, again.
n('ptTick(0.3);mini.pitchKeyAim=false;T.f=ptScreen(-60,0,330);arcadeDown({x:T.f.x,y:T.f.y});arcadeUp(false);T.v1=mini.pitchLive[mini.pitchLive.length-1];ptTick(0.3);miniAction("throw");T.v2=mini.pitchLive[mini.pitchLive.length-1]');
assert.ok(n('T.v1!==T.v2&&T.v1.vx===T.v2.vx&&T.v1.vz===T.v2.vz'), 'THROW repeats the last throw');
close();
console.log('PASS: controls: tap for a fastball, drag to sling, soft pulls, cancels, pauses and rotations never throw, keys and the button.');

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
n('mini.pitchBalls=5;T.g=ptGremlin("sit",60,0,330);pitchThrow(pitchFastball(pitchCenter(T.g)));ptTick(0.5)');
assert.equal(n('mini.got'), 1);
assert.equal(n('mini.pitchBalls'), 5, 'a hit refunds the throw');
close();
console.log('PASS: the bucket: throws cost a ball, hits give it back, an empty bucket refills fast, never stalls.');

// ---- Gremlins ----
// Streaks: hits build it; a throw that touches nothing breaks it.
n('ptStart(1);for(const x of [-100,0,100]){const g=ptGremlin("sit",x,0,330);mini.pitchCd=0;pitchThrow(pitchFastball(pitchCenter(g)));ptTick(0.5)}');
assert.equal(n('mini.combo'), 3, 'three hits, a streak of three');
n('mini.pitchCd=0;pitchThrow({x:0,y:-50,z:80});ptTick(2)');
assert.equal(n('mini.combo'), 0, 'a ball that finds nothing breaks the streak');
// Bedpan shields clang unless the ball came off a wall.
n('T.s=ptGremlin("shield",-60,0,330);mini.pitchCd=0;pitchThrow(pitchFastball(pitchCenter(T.s)));ptTick(0.5)');
assert.equal(n('T.s.state'), 'live', 'a straight throw clangs off the bedpan');
assert.ok(n('mini.pitchPops.some(p=>p.text.startsWith("CLANG"))'));
n('T.b=pitchNewBall({x:0,y:0,z:0});Object.assign(T.b,{x:T.s.x,y:T.s.y+60,z:T.s.z,vx:0,vy:-200,vz:0,walls:1});mini.pitchLive.push(T.b);ptTick(0.3)');
assert.notEqual(n('T.s.state'), 'live', 'a ball that came off a wall gets it');
assert.equal(n('mini.pitchBanks'), 1);
// Hidden peekers: behind each cover a fastball hits the cover, and a ball dropping over the top gets them.
for (const cover of j('PITCH_PEEKS.map(p=>p.id)')) {
  n(`ptStart(1);T.pk=pitchSpawn("peek");T.pk.cover=PITCH_PEEKS.find(p=>p.id==="${cover}");T.pk.key=T.pk.cover.key;T.pk.mode="hidden";T.pk.modeT=99;pitchPeekPlace(T.pk);T.c=pitchCenter(T.pk)`);
  n('pitchThrow(pitchFastball(T.c));ptTick(0.8)');
  assert.equal(n('T.pk.state'), 'live', 'a fastball at a peeker hidden behind the ' + cover + ' hits the cover');
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
n('ptStart(2);T.gd=pitchSpawn("timed");T.w0=mini.got;pitchThrow(pitchFastball(pitchCenter(T.gd)));ptTick(0.5)');
assert.equal(n('mini.got-T.w0'), 2, 'a golden gremlin counts twice');
n('T.gd=pitchSpawn("timed");ptTick(PITCH_TIERS[2].timed+0.5)');
assert.notEqual(n('T.gd.state'), 'live', 'and leaves when its clock runs out');
// The Ump: level 3, final inning, four hits, and a brushback when nobody hits him.
n('ptStart(1);mini.phaseTime=mini.limit*2/3+0.01;mini.pitchSpawnT=999;ptTick(0.1)');
assert.equal(n('mini.pitchUmpSpawned'), false, 'no Ump before level 3');
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
console.log('PASS: gremlins: streaks, shields need a bank, lobs over cover, peekers, walkers, chargers, hoppers, golden ones, the Ump.');

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
// Level 1 keeps the shelf clear; level 2 puts three bottles in front of the E-Type.
n('ptStart(0)');
assert.equal(n('mini.pitchBottles.filter(o=>o.set==="shelf").length'), 0);
n('ptStart(1)');
assert.equal(n('mini.pitchBottles.filter(o=>o.set==="shelf").length'), 3);
// Hitting the E-Type is not a crime, but it costs the streak.
n('mini.combo=4;T.v=pitchFastball({x:186,y:104,z:327});mini.pitchBottles=[];pitchThrow(T.v);ptTick(0.6)');
assert.equal(n('mini.combo'), 0, 'the E-Type ends the streak');
assert.equal(n('mini.pitchEtypeHits'), 1);
assert.match(n('mini.flashText'), /E-TYPE/);
close();
console.log('PASS: bottles ring and refill the bucket, the pyramid restocks, the shelf waits for level 2, the E-Type survives.');

// ---- Spawns, pacing, fairness ----
// Level 1 opens with sitting ducks, one at a time at first; walkers wait for inning 2.
n('ptStart(0);mini.pitchSpawnT=0;mini.pitchScript=PITCH_TIERS[0].script.slice();T.kinds=[];for(let i=0;i<1500&&mini.phaseTime<mini.limit/3-0.5;i++){updateMini(1/60);for(const e of mini.pitchTargets)if(e.state==="live"&&!T.kinds.includes(e.id)){T.kinds.push(e.id);T.kinds.push(e.kind)}for(const e of mini.pitchTargets)if(e.state==="live"&&mini.pitchTargets.filter(o=>o.state==="live").length>2)T.over=true;for(const e of mini.pitchTargets)e.state="gone"}');
assert.ok(j('T.kinds').filter((k, i) => i % 2).every(k => k === 'sit'), 'inning 1 of level 1 is all sitting ducks');
assert.ok(!n('T.over'), 'no more than two at a time');
for (let t = 0; t < 3; t++) for (let s = 0; s < 3; s++) assert.ok(n(`PITCH_TIERS[${t}].mix[${s}]`) !== undefined);
assert.ok(!('walk' in j('PITCH_TIERS[0].mix[0]')) && j('PITCH_TIERS[0].mix[1]').walk > 0, 'walkers arrive in inning 2');
assert.ok(!('shield' in j('PITCH_TIERS[1].mix[0]')) && j('PITCH_TIERS[1].mix[1]').shield > 0, 'level 2 shields arrive in inning 2');
assert.ok(j('PITCH_TIERS[2].mix[0]').timed > 0, 'level 3 has golden gremlins');
// Level 1 is gentler than level 3 in every dial.
const L1 = j('PITCH_TIERS[0]'),
  L3 = j('PITCH_TIERS[2]');
assert.ok(L1.walk[1] < L3.walk[0], 'slower walkers');
assert.ok(L1.peek[0] > L3.peek[0] * 1.8, 'longer peeks');
assert.ok(L1.charge < L3.charge * 0.6, 'slower chargers');
assert.ok(L1.balls[0] > L3.balls[0] && L1.refill < L3.refill, 'a bigger bucket that refills faster');
assert.ok(L1.hit > L3.hit, 'bigger gremlins');
assert.ok(L1.preview > L3.preview, 'more of the arc shown');
// Fairness: every place a gremlin can stand, walk, peek, hop or charge (past the cover it starts behind)
// is reachable by a tap's fastball, so nothing visible is ever untouchable by a plain tap.
const blocked = j(`(()=>{
  n0 = 0; const out = [];
  function test(name, x, y, z, size = 1) {
    const c = { x, y: y + 24 * size, z }, b = pitchNewBall(pitchFastball(c)), R = 24 * size * 0.7 + PITCH_BALL;
    for (let i = 0; i < 400 && !b.dead; i++) {
      const hit = pitchMoveBall(b, PITCH_SUB);
      if (Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) < R) return;
      if (hit) { out.push(name + ' blocked by ' + hit); return; }
    }
    out.push(name + ' never reached');
  }
  PITCH_SITS.forEach((s, i) => test('sit ' + i, s.x, s.y, s.z));
  PITCH_WALKS.forEach((w, i) => { for (let u = 0; u <= 1.001; u += 0.1) test('walk ' + i, ...pitchLerp3(w.a, w.b, u)); });
  PITCH_PEEKS.forEach(p => test('peek ' + p.id, ...p.up));
  PITCH_UMP_SPOTS.forEach(p => test('ump ' + p.id, ...p.up, 1.45));
  PITCH_HOPS.forEach((h, i) => test('hop ' + i, ...h));
  PITCH_CHARGES.forEach((c, i) => { for (let u = 0.5; u <= 0.95; u += 0.15) test('charge ' + i, c[0] + (90 - c[0]) * u, 0, c[2] + (PITCH_REACH - c[2]) * u); });
  return out;
})()`.replace('n0 = 0; ', ''));
assert.deepEqual(blocked, [], 'every spot is reachable: ' + blocked.join(', '));
// Every spot a shield can stand on has a bank shot off a wall that reaches it.
const banks = j(`(()=>{
  const out = [], H = PITCH_HAND;
  for (const s of PITCH_SITS.filter(s => !s.high && !s.wall)) {
    const c = { x: s.x, y: s.y + 24, z: s.z }, R = 24 * 0.8 + PITCH_BALL;
    let found = false;
    for (let wy = 10; wy <= 200 && !found; wy += 10)
      for (const wall of ['l', 'r', 'b'])
        for (let a = wall === 'b' ? -200 : 150; a <= (wall === 'b' ? 200 : 515) && !found; a += 8) {
          const q = wall === 'b' ? { x: a, y: wy, z: PITCH_BACK - PITCH_BALL } : { x: (wall === 'l' ? -1 : 1) * (PITCH_WALL - PITCH_BALL), y: wy, z: a },
            b = pitchNewBall(pitchFastball(q));
          for (let i = 0; i < 360 && !b.dead; i++) {
            const hit = pitchMoveBall(b, PITCH_SUB);
            if (b.walls && Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) < R) { found = true; break; }
            if (hit && hit !== 'wall' && hit !== 'back' && hit !== 'floor') break;
          }
        }
    if (!found) out.push('sit at ' + s.x + ',' + s.z);
  }
  return out;
})()`);
assert.deepEqual(banks, [], 'every shield spot has a bank shot: ' + banks.join(', '));
// And the level 2 guide is honest: tapping the wall where it points banks the ball in, in both shapes.
for (const tall of [false, true]) {
  const misses = j(`(()=>{
    mini.portrait = ${tall};
    const out = [];
    PITCH_SITS.forEach((s, i) => {
      if (s.high || s.wall) return;
      mini.pitchTargets = []; mini.pitchLive = []; mini.pitchCd = 0;
      const e = ptGremlin('shield', s.x, s.y, s.z), plan = pitchBankPlan(e);
      if (!plan) return out.push('sit ' + i + ' has no plan');
      const p = pitchProject(plan.q.x, plan.q.y, plan.q.z);
      arcadeDown({ x: p.x, y: p.y }); arcadeUp(false);
      for (let k = 0; k < 120; k++) updateMini(1 / 60);
      if (e.state === 'live') out.push('sit ' + i + ' missed');
    });
    mini.portrait = false;
    return out;
  })()`);
  assert.deepEqual(misses, [], (tall ? 'portrait' : 'landscape') + ': the bank guide lands: ' + misses.join(', '));
}
// Every hiding place has a lob (drag up) that drops over the cover onto the peeker behind it.
const lobs = j(`(()=>{
  const out = [], H = PITCH_HAND;
  for (const cover of PITCH_PEEKS) {
    const c = { x: cover.hide[0], y: cover.hide[1] + 24, z: cover.hide[2] }, R = 14 + PITCH_BALL,
      aligned = Math.atan2(c.x - H.x, c.z - H.z);
    let found = false;
    for (let yaw = aligned - 0.06; yaw <= aligned + 0.061 && !found; yaw += 0.02)
      for (let power = 0.1; power <= 1 && !found; power += 0.005) {
        const b = pitchNewBall(pitchAimVelocity({ yaw, power, lob: true }));
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
close();
console.log('PASS: spawns open gently, kinds arrive by inning, level 1 is gentler in every dial, every spot is fair.');

// ---- Idle play loses, on every level ----
for (let tier = 0; tier < 3; tier++) {
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
  n(`ptStart(2,1,${tall})`);
  n('drawMini();for(const k of ["sit","walk","peek","hop","shield","charge","timed"])pitchSpawn(k);pitchSpawnUmp();pitchSpawn("peek");ptTick(0.5);drawMini()');
  n('for(const e of mini.pitchTargets){if(e.kind==="peek"||e.kind==="ump"){e.mode="up";e.modeT=1;pitchPeekPlace(e)}}drawMini()');
  n('arcadeDown({x:300,y:200});arcadeMove({x:250,y:330});drawMini();arcadeUp(false);ptTick(0.1);drawMini()');
  n('mini.pitchKeyAim=true;mini.pitchPress=null;drawMini();mini.pitchKeyAim=false');
  n('for(const o of mini.pitchBottles)if(o.up){pitchKnock(o,50,100,0,null);break}mini.pitchMark={x:0,y:0,z:300,t:0.3};mini.pitchIncoming={x:0,y:80,z:400,t:0.2,dur:0.6};mini.pitchBedFx={t:0.3,x:300,y:300,art:1};mini.pitchFreeze=2;mini.pitchHitFlash=0.2;mini.pitchShake=0.2;mini.pitchEtype=0.5;mini.combo=6;drawMini()');
  n('mini.pitchBalls=0;mini.pitchFreeze=0;for(const e of mini.pitchTargets)if(e.state==="live"){e.state="dying";e.dyT=0.2}drawMini();pauseMini();drawMini();pauseMini()');
  // Losing two ways, the outro and the result art.
  for (const reason of ['quota', 'stormed']) {
    n(`ptStart(1,1,${tall});finishMini(false,${reason === 'quota' ? 'PITCH_QUOTA_MISSED' : 'undefined'})`);
    for (let t = 0; t <= 2.2; t += 0.1) n(`mini.transition=${t};drawMini()`);
    n('mini.transition=0;updateMini(2.3);drawResultArt()');
    assert.equal(n('mini.screen'), 'result');
    assert.match(n('$("resultHeading").textContent'), reason === 'quota' ? /YER OUT/ : /STORMED/);
  }
  n(`ptStart(0,1,${tall});finishMini(true);for(let t=0;t<=2.2;t+=0.2)drawMini(),updateMini(0.2);updateMini(0.5);drawResultArt()`);
  assert.equal(n('mini.win'), true);
  assert.equal(n('games[0].resultArt(mc)'), false, 'a win uses the shared ceremony');
}
n('delete window.innerWidth;delete window.innerHeight;resize()');
n('games[0].scene($("miniPreview").getContext("2d"),420,240);games[0].scene(c,260,135)');
n('ptStart(0);mini.pitchShellCache=null;pitchShell(mc,800,450);mini.portrait=true;pitchShell(mc,450,800);mini.portrait=false');
close();
console.log('PASS: every pitch draw path runs in both shapes: play, previews, effects, both losses, the win, the cards.');
