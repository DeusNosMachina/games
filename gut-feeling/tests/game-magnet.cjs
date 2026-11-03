// Polarity Panic (MRI pinball): physics stability and no tunneling, flipper impulse, two fingers at once through
// touch(), held buttons, keys, the plunger, nudge and tilt, the magnet and its heat, gremlin bumpers,
// the ramp, drop targets, kickbacks, multiball, drains and ball count, the quota win and victory lap,
// idle loss, determinism, and drawing at every screen in both canvas shapes.
// Test objects live on T so they never collide with the game's globals.
const { run, close, assert } = require('./harness.cjs');
run('let rng=4242;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`
var T = {};
// A run at a level, past the countdown, with the ball still waiting in the lane.
function pbStart(tier, difficulty = 1) {
  state.difficulty = difficulty; openMini(1); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  mini.limit = 1e6; T = {};
}
// Puts the first ball in play at (x, y) with velocity (vx, vy).
function pbBall(x, y, vx = 0, vy = 0) {
  const b = mini.pinBalls[0]; Object.assign(b, { state: 'play', x, y, vx, vy, fresh: false, still: 0 }); return b;
}
function pbTick(seconds, dt = 1 / 60) { for (let t = 0; t < seconds - 1e-9 && mini.screen === 'play'; t += dt) updateMini(dt); }
// Deepest overlap between a ball and any static collider (negative = clear).
function pbOverlap(b) {
  let worst = -99;
  for (const s of mini.pinT.segs) {
    if (s.drop !== undefined && !mini.pinDrops[s.drop].up) continue;
    if (s.oneWay || s.tag === 'ramp') continue;
    const dx = s.bx - s.ax, dy = s.by - s.ay, u = clamp(((b.x - s.ax) * dx + (b.y - s.ay) * dy) / (dx * dx + dy * dy), 0, 1);
    worst = Math.max(worst, MAGNET_BALL + s.r - Math.hypot(b.x - s.ax - dx * u, b.y - s.ay - dy * u));
  }
  for (const p of mini.pinT.posts) worst = Math.max(worst, MAGNET_BALL + p.R - Math.hypot(b.x - p.x, b.y - p.y));
  return worst;
}
var pbLeft = () => ({ x: activeCanvas().w * 0.2, y: 300 }), pbRight = () => ({ x: activeCanvas().w * 0.8, y: 300 });
`);
const n = s => run(s),
  j = s => JSON.parse(run('JSON.stringify(' + s + ')'));

// The registry: wide and portrait canvases (the portrait one taller than wide) and the multi-touch hook.
assert.deepEqual(j('[games[1].canvas.w,games[1].canvas.h]'), [800, 600]);
assert.ok(n('games[1].portraitCanvas.h>games[1].portraitCanvas.w'), 'portrait canvas is taller than wide');
assert.equal(n('typeof games[1].touch'), 'function', 'flippers need every finger: touch() is defined');
assert.equal(n('games[1].info.game'), 'Polarity Panic');
for (const key of ['info', 'tierNotes', 'lesson', 'scene', 'assist', 'onLose', 'resultArt', 'statLabel', 'stat', 'tactics', 'assistText'])
  assert.ok(n(`!!games[1].${key}`), key);
for (const text of j('[games[1].info.desc,games[1].info.control,games[1].info.avoid,...games[1].tierNotes]'))
  assert.ok(!text.includes('—') && !text.includes('!'), 'copy has no em-dashes or exclamation points: ' + text);
console.log('PASS: registry shape, both canvases, touch hook, copy.');

// Stability: hundreds of balls thrown at top speed in every direction for 6 seconds never escape the
// table, never pass through a wall, never exceed the top speed, and never end up inside a collider.
n('pbStart(1);mini.pinSave=0');
const chaos = j(`(()=>{let escaped=0,fast=0,worst=-99,drained=0;
  const open=[[182,440],[120,440],[250,440],[182,190],[290,230],[110,200],[250,150],[160,560],[210,560],[300,330],[90,380],[280,400]];
  for(let i=0;i<160;i++){
    const a=rand(0,Math.PI*2),o=open[i%open.length],b=pbBall(o[0],o[1],Math.cos(a)*MAGNET_VMAX,Math.sin(a)*MAGNET_VMAX);
    for(let k=0;k<6*600;k++){
      magnetBallStep(b,MAGNET_STEP);
      if(b.state!=='play'){drained++;break}
      if(Math.hypot(b.vx,b.vy)>MAGNET_VMAX+1)fast++;
      if(b.x<14||b.x>MAGNET_LANE.x1||b.y<10)escaped++;
      if(k%10===0)worst=Math.max(worst,pbOverlap(b));
    }
    mini.pinBalls=[b];b.state='plunger';mini.pinSpare=2;mini.screen='play';
  }
  return {escaped,fast,worst,drained}})()`);
assert.equal(chaos.escaped, 0, 'no ball left the table');
assert.equal(chaos.fast, 0, 'the top speed holds');
assert.ok(chaos.worst < 1, 'never more than a pixel inside a wall, rail, post or slingshot: ' + chaos.worst);
close();
// Tunneling: a top-speed ball fired straight at the thinnest rails and the dome bounces off them.
n('pbStart(1);mini.pinSave=0');
for (const [x, y, vx, vy, what] of [
  [60, 400, -1500, 0, 'left wall'],
  [330, 400, 1500, 0, 'right wall'],
  [131, 140, 0, -1500, 'lane guide gap and dome'],
  [150, 95, -1500, 0, 'lane guide'],
  [200, 120, 0, -1500, 'dome']
]) {
  n(`T.b=pbBall(${x},${y},${vx},${vy});for(let k=0;k<120;k++)magnetBallStep(T.b,MAGNET_STEP)`);
  assert.ok(n('T.b.x>14&&T.b.x<350&&T.b.y>14'), what + ' held at top speed');
  assert.ok(n('pbOverlap(T.b)') < 1, what + ' left no overlap');
}
// A top-speed ball fired down at a flipper mid-swing bounces off it rather than through it.
n('T.f=mini.pinFlips[0];T.f.held=true;T.b=pbBall(150,560,0,1500);T.low=0;for(let k=0;k<60;k++){magnetFlipStep(T.f,MAGNET_STEP);magnetBallStep(T.b,MAGNET_STEP);T.low=Math.max(T.low,T.b.y)}');
assert.ok(n('T.b.vy<0&&T.low<625'), 'a top-speed ball bounced off a swinging flipper');
close();
console.log('PASS: no escapes, no tunneling through walls, the dome or a swinging flipper, top speed respected.');

// Flipper impulse: a ball resting on a lowered flipper rolls off the tip; a flip sends it up the table,
// and harder from the tip than from the pivot.
const flipShot = u => {
  n(`pbStart(0);mini.pinSave=0;T.f=mini.pinFlips[0];T.t=magnetTip(T.f);T.b=pbBall(T.f.x+(T.t.x-T.f.x)*${u},T.f.y+(T.t.y-T.f.y)*${u}-17,0,0);pbTick(.05)`);
  n('MAGNET.touch("down",pbLeft(),1);pbTick(.06)');
  const v = j('[T.b.vx,T.b.vy,Math.hypot(T.b.vx,T.b.vy)]');
  n('MAGNET.touch("up",pbLeft(),1)');
  close();
  return v;
};
const nearPivot = flipShot(0.3),
  nearTip = flipShot(0.75);
assert.ok(nearPivot[1] < -700 && nearTip[1] < -700, 'a flip launches the ball up the table');
assert.ok(nearTip[0] > nearPivot[0], 'shots from nearer the tip go further across');
n('pbStart(0);mini.pinSave=0;T.f=mini.pinFlips[1];T.t=magnetTip(T.f);T.b=pbBall(T.f.x+(T.t.x-T.f.x)*.4,T.f.y+(T.t.y-T.f.y)*.4-17,0,0);pbTick(1.2)');
assert.ok(n('T.b.state!=="play"||T.b.y>670'), 'an untouched ball rolls off the flipper into the drain');
close();
console.log('PASS: flipper impulse, tip versus pivot, and the unflipped roll-off.');

// Two fingers at once through touch(): the left half holds the left flipper, the right half the right
// one, each released by its own finger. Holding both fires the magnet, which heats up and overheats.
n('pbStart(1);pbBall(182,250,0,0);MAGNET.touch("down",pbLeft(),1);MAGNET.touch("down",pbRight(),2);pbTick(.05)');
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [true, true], 'both flippers held at once');
assert.equal(n('mini.pinMagOn'), false, 'the magnet waits a beat');
n('pbTick(.15)');
assert.equal(n('mini.pinMagOn'), true, 'both held fires the magnet');
assert.ok(n('mini.pinHeat') > 0, 'the magnet heats up');
n('MAGNET.touch("up",pbLeft(),1);pbTick(.02)');
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [false, true], 'lifting one finger drops only its flipper');
assert.equal(n('mini.pinMagOn'), false);
n('MAGNET.touch("down",pbLeft(),3);pbTick(2)');
assert.equal(n('mini.pinHot'), true, 'held past its limit, the magnet overheats');
assert.equal(n('mini.pinMagOn'), false, 'an overheated magnet pulls nothing');
n('MAGNET.touch("up",pbLeft(),3);MAGNET.touch("cancel",pbRight(),2);pbTick(.02)');
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [false, false], 'a cancelled finger lets go too');
n('pbTick(mini.pinLv.cool)');
assert.equal(n('mini.pinHot'), false, 'letting go cools it');
// The magnet pulls a diving ball back up, mostly straight up.
n('mini.pinHeat=0;T.b=pbBall(182,600,0,500);MAGNET.touch("down",pbLeft(),4);MAGNET.touch("down",pbRight(),5);pbTick(.6)');
assert.ok(n('T.b.state==="play"&&T.b.y<560'), 'the magnet hauled a diving ball back up');
n('MAGNET.touch("up",pbLeft(),4);MAGNET.touch("up",pbRight(),5)');
close();
console.log('PASS: two fingers at once, per-finger release, the magnet, heat, overheat and cooling.');

// Buttons: LEFT and RIGHT act on press and stay held until their own pointer lifts, both at once.
run(`function pbButton(type, id, action) {
  const btn = { dataset: { action }, closest: s => (s === '#miniControls' ? {} : s === '[data-action]' ? btn : null) };
  magnetButtonEvent({ type, pointerId: id, target: btn });
  if (type === 'pointerdown') miniAction(action);
}`);
n('pbStart(1);pbBall(182,250,0,0);pbButton("pointerdown",21,"left");pbButton("pointerdown",22,"right");pbTick(.5)');
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [true, true], 'two held buttons hold both flippers');
n('pbButton("pointerup",21,"left");pbTick(.05)');
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [false, true], 'each button lets go on its own');
n('pbButton("pointercancel",22,"right");pbTick(.3);miniAction("left");pbTick(.05)');
assert.equal(n('mini.pinFlips[0].held'), true, 'a press with no pointer to follow still flips');
n('pbTick(.3)');
assert.equal(n('mini.pinFlips[0].held'), false, 'and drops by itself');
close();
// Keys: Z or ArrowLeft, slash or ArrowRight, held until keyup.
const ev = '{preventDefault(){},repeat:false}';
n(`pbStart(1);pbBall(182,250,0,0);MAGNET.key("z",${ev});MAGNET.key("arrowright",${ev});pbTick(.05)`);
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [true, true], 'keys hold the flippers');
n('keys.delete("z");keys.delete("arrowright");pbTick(.05)');
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [false, false]);
n(`MAGNET.key("/",${ev});MAGNET.key("arrowleft",${ev});pbTick(.05)`);
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [true, true], 'slash and ArrowLeft work too');
close();
console.log('PASS: two held buttons, tap buttons, and keyboard flippers.');

// The plunger: any press while the ball waits pulls it, letting go fires it, harder the longer it was held.
// A cancelled press does nothing. Space pulls and fires the same way.
n('pbStart(0)');
assert.equal(n('magnetWaiting()'), true, 'the first ball waits in the lane');
n('MAGNET.touch("down",pbLeft(),7)');
assert.equal(n('mini.pinPull&&mini.pinPull.src'), 'touch');
assert.deepEqual(j('mini.pinFlips.map(f=>f.held)'), [false, false], 'the plunger press does not flip');
n('MAGNET.touch("cancel",pbLeft(),7)');
assert.equal(n('magnetWaiting()'), true, 'a cancelled press does not launch');
n('MAGNET.touch("down",pbLeft(),8);MAGNET.touch("up",pbLeft(),8)');
T_tap = n('-mini.pinBalls[0].vy');
assert.equal(n('mini.pinBalls[0].state'), 'play', 'a tap launches');
assert.ok(n('mini.pinSave') >= 12, 'level 1 arms a long ball save at launch');
close();
n('pbStart(0);MAGNET.touch("down",pbRight(),9);pbTick(.8);MAGNET.touch("up",pbRight(),9)');
assert.ok(n('-mini.pinBalls[0].vy') > T_tap + 100, 'a held pull launches harder');
close();
n(`pbStart(0);MAGNET.key(" ",${ev});pbTick(.3)`);
assert.equal(n('mini.pinPull&&mini.pinPull.src'), 'key');
n('keys.delete(" ");pbTick(.02)');
assert.equal(n('mini.pinBalls[0].state'), 'play', 'Space launches on release');
close();
// Every launch power reaches the playfield.
for (const p of [0, 0.35, 0.7, 1]) {
  n(`pbStart(0);magnetLaunch(${p});pbTick(2.5)`);
  assert.ok(n('mini.pinBalls.some(b=>b.state==="play"&&b.x<350)'), `launch power ${p} reaches the playfield`);
  close();
}
console.log('PASS: plunger tap, hold, cancel, Space, and every power reaches play.');

// Nudge: a quick swipe up or Shift nudges the ball; too many in a row tilt, and a tilt kills the flippers.
n('pbStart(1);mini.pinSave=0;T.b=pbBall(182,400,0,300);MAGNET.touch("down",{x:400,y:500},10);MAGNET.touch("move",{x:400,y:470},10);MAGNET.touch("move",{x:400,y:430},10)');
assert.equal(n('mini.pinNudges'), 1, 'a swipe up nudges');
assert.ok(n('T.b.vy') < 150, 'the nudge pushed the ball up the table');
n('MAGNET.touch("move",{x:400,y:380},10);MAGNET.touch("up",{x:400,y:380},10)');
assert.equal(n('mini.pinNudges'), 1, 'one nudge per swipe');
n('MAGNET.touch("down",{x:400,y:500},11);MAGNET.touch("move",{x:420,y:495},11);MAGNET.touch("up",{x:420,y:495},11)');
assert.equal(n('mini.pinNudges'), 1, 'a small drift is not a nudge');
n(`pbTick(.4);MAGNET.key("shift",${ev});pbTick(.4);MAGNET.key("arrowup",${ev})`);
assert.equal(n('mini.pinNudges'), 3, 'Shift and ArrowUp nudge');
assert.equal(n('mini.pinTilted'), true, 'three quick nudges tilt');
n(`MAGNET.key("z",${ev});pbTick(.05)`);
assert.equal(n('mini.pinFlips[0].held'), false, 'tilted flippers are dead');
n('keys.clear();T.b.x=182;T.b.y=730;T.b.vy=400;pbTick(.1)');
assert.equal(n('mini.pinTilted'), false, 'the tilt clears with the next ball');
assert.equal(n('mini.pinSpare'), 1, 'and it cost the ball');
close();
console.log('PASS: swipe and key nudges, tilt, dead flippers, tilt clears on the next ball.');

// Gremlin bumpers: a hit costs one HP and kicks the ball away; enough hits evict it for the quota; it
// moves back in a little later.
n('pbStart(0);mini.pinSave=0;T.g=mini.pinGrem[2];T.b=pbBall(T.g.x,T.g.y+T.g.R+12,0,-400);pbTick(.05)');
assert.equal(n('T.g.hp'), n('T.g.max-1'), 'a hit costs a gremlin one HP');
assert.ok(n('T.b.vy') > 0, 'the bumper kicked the ball away');
n('magnetBumperHit(T.g,1,null);magnetBumperHit(T.g,1,null)');
assert.equal(n('T.g.gone'), true, 'level 1 gremlins move out after three hits');
assert.equal(n('mini.got'), 1);
assert.ok(n('mini.pinSplats.length') > 0, 'with a splat');
n('mini.pinBalls[0].state="plunger";pbTick(2.6)');
assert.equal(n('T.g.gone'), false, 'a new gremlin moves in');
close();
console.log('PASS: bumper hits, evictions and move-ins.');

// The scan ramp: a fast ball through the mouth rides it to the right inlane and every gremlin takes a
// hit; a slow one bounces back out.
n('pbStart(0);mini.pinSave=0;T.b=pbBall(70,380,-430,-560);pbTick(.15)');
assert.equal(n('T.b.state'), 'ramp', 'a fast ball enters the ramp');
n('pbTick(2)');
assert.equal(n('mini.pinRamps'), 1, 'the ride completes');
assert.ok(n('mini.pinGrem.every(g=>g.hp===g.max-1||g.gone)'), 'every gremlin took a hit');
n('mini.pinBalls=[];magnetServe(false);T.b=pbBall(60,370,-100,-150);pbTick(.4)');
assert.equal(n('T.b.state'), 'play', 'a slow ball bounces off the mouth');
assert.equal(n('mini.pinRamps'), 1);
close();
console.log('PASS: the ramp takes fast balls only and pulses every gremlin.');

// Drop targets (level 2 up): all three down pulse the gremlins and reset; level 3 starts multiball.
n('pbStart(0)');
assert.equal(n('mini.pinDrops'), null, 'level 1 has no drop targets');
close();
n('pbStart(1);mini.pinSave=0;T.b=pbBall(300,354,600,0);pbTick(.1)');
assert.equal(n('mini.pinDrops[0].up'), false, 'a hit drops a target');
n('magnetDropHit(1);magnetDropHit(2)');
assert.equal(n('mini.pinBanks'), 1, 'all three down clears the bank');
assert.ok(n('mini.pinGrem.every(g=>g.hp<g.max)'), 'level 2: the bank pulses every gremlin');
n('pbTick(2)');
assert.ok(n('mini.pinDrops.every(d=>d.up)'), 'the bank resets');
close();
n('pbStart(2);mini.pinSave=0;pbBall(182,300,0,0);[0,1,2].forEach(magnetDropHit);pbTick(.7)');
assert.equal(n('mini.pinMulti'), true, 'level 3: the bank starts multiball');
assert.equal(n('mini.pinBalls.filter(b=>b.state==="play").length'), 2, 'a second ball joins');
n('mini.pinSave=0;mini.pinBalls[1].y=760;pbTick(.05)');
assert.equal(n('mini.pinSpare'), 2, 'losing one multiball ball costs nothing');
assert.equal(n('mini.pinMulti'), false, 'multiball ends with one ball left');
close();
console.log('PASS: drop targets, bank pulse and reset, multiball.');

// Kickbacks: level 1 hops an outlane ball back to the top of its inlane, on both sides, and relights;
// level 2 kickbacks work once per ball; level 3 has none.
for (const [x, side] of [
  [28, 0],
  [336, 1]
]) {
  n(`pbStart(0);mini.pinSave=0;T.b=pbBall(${x},600,0,300);pbTick(.2)`);
  assert.equal(n('T.b.state'), 'hop', 'the kickback fired');
  assert.equal(n(`mini.pinKick[${side}]`), false);
  n('pbTick(.45)');
  assert.equal(n('T.b.state'), 'play');
  assert.ok(n(`Math.abs(T.b.x-(${side}?2*MAGNET_CX-(mini.pinLv.divider+84)/2:(mini.pinLv.divider+84)/2))<4&&T.b.y<530`), 'it lands at the top of the inlane');
  n(`T.near=99;for(let i=0;i<60;i++){updateMini(1/60);const f=mini.pinFlips[${side}];T.near=Math.min(T.near,Math.hypot(T.b.x-f.x,T.b.y-f.y))}`);
  assert.ok(n('T.near<30'), 'and rolls down onto the flipper');
  n(`pbTick(5.5)`);
  assert.equal(n(`mini.pinKick[${side}]`), true, 'level 1 relights it');
  close();
}
n('pbStart(1);mini.pinSave=0;T.b=pbBall(30,600,0,300);pbTick(.6)');
assert.equal(n('mini.pinKick[0]'), false, 'level 2 uses it up');
n('T.b.state="plunger";pbTick(8)');
assert.equal(n('mini.pinKick[0]'), false, 'and does not relight it this ball');
close();
n('pbStart(2);mini.pinSave=0;T.b=pbBall(28,600,0,300);pbTick(.6)');
assert.equal(n('mini.pinSpare'), 1, 'level 3 outlanes drain');
close();
console.log('PASS: kickbacks by level.');

// Drains and the ball count: a saved drain comes back by itself; an unsaved one costs a ball and serves
// the next; the last one short of the quota loses the run.
n('pbStart(1);T.b=pbBall(182,700,0,400);mini.pinSave=3;pbTick(.2)');
assert.equal(n('mini.pinSpare'), 2, 'a ball save keeps the ball');
pbAuto = n('mini.pinBalls.some(b=>b.state==="play")||mini.pinAuto>0');
assert.ok(pbAuto, 'the saved ball relaunches by itself');
n('pbTick(1);mini.pinSave=0;mini.pinBalls[0].x=182;mini.pinBalls[0].y=735;mini.pinBalls[0].vy=300;pbTick(.1)');
assert.equal(n('mini.pinSpare'), 1, 'an unsaved drain costs a ball');
assert.equal(n('mini.pinBallNo'), 1);
assert.equal(n('magnetWaiting()'), true, 'the next ball waits for a launch');
assert.equal(n('mini.miss'), 1);
n('magnetLaunch(.5);pbTick(.1);mini.pinSave=0;mini.pinBalls[0].x=182;mini.pinBalls[0].y=735;mini.pinBalls[0].vy=300;pbTick(.1);magnetLaunch(.5);pbTick(.1);mini.pinSave=0;mini.pinBalls[0].x=182;mini.pinBalls[0].y=735;mini.pinBalls[0].vy=300;pbTick(.1)');
assert.equal(n('mini.screen'), 'outro', 'the last drain ends the run');
assert.equal(n('mini.pendingFinish.win'), false, 'short of the quota, it is a loss');
assert.match(n('mini.pendingFinish.reason'), /Last ball/);
n('updateMini(2.3)');
assert.equal(n('mini.screen'), 'result');
assert.equal(n('mini.win'), false);
close();
console.log('PASS: ball saves, ball count, next ball, last-ball loss.');

// The quota: meeting it starts a victory lap that doubles scoring; the next drain or 30 seconds wins.
n('pbStart(0);pbBall(182,300,0,0);mini.got=mini.goal-1;T.g=mini.pinGrem[0];T.g.hp=1;magnetBumperHit(T.g,1,null)');
assert.equal(n('mini.pinCleared'), true, 'the quota starts the victory lap');
n('T.s=mini.score;magnetPoints(100)');
assert.equal(n('mini.score-T.s'), 200, 'the lap doubles points');
n('mini.pinSave=0;mini.pinBalls[0].x=182;mini.pinBalls[0].y=735;mini.pinBalls[0].vy=300;pbTick(.1)');
assert.equal(n('mini.screen'), 'outro');
assert.equal(n('mini.pendingFinish.win'), true, 'a drain after the quota wins');
close();
n('pbStart(0);pbBall(182,300,0,0);mini.got=mini.goal;magnetCheckQuota();pbTick(31)');
assert.equal(n('mini.pendingFinish&&mini.pendingFinish.win'), true, 'the lap ends itself after 30 seconds');
close();
n('pbStart(0);mini.limit=5;mini.got=mini.goal;magnetCheckQuota();pbTick(6)');
assert.equal(n('mini.pendingFinish.win'), true, 'time up with the quota met wins');
close();
n('pbStart(0);mini.limit=5;mini.got=mini.goal-1;pbTick(6)');
assert.equal(n('mini.pendingFinish.win'), false, 'time up short of the quota loses');
close();
console.log('PASS: quota, victory lap, time up.');

// Idle: nobody touches anything and the run is lost, at every level.
for (let tier = 0; tier < 3; tier++) {
  n(`state.difficulty=1;openMini(1);mini.tier=${tier};startMini();launchMini();updateMini(3.3)`);
  for (let i = 0; i < 4000 && n('mini.screen') === 'play'; i++) n('updateMini(.1)');
  assert.equal(n('mini.pendingFinish.win'), false, `level ${tier + 1} idle loses`);
  close();
}
// Launch-only (no flipping) falls short of the quota too.
for (let tier = 0; tier < 3; tier++) {
  n(`pbStart(${tier});mini.limit=${[150, 180, 210][tier]};while(mini.screen==="play"){if(magnetWaiting())magnetLaunch(.35);updateMini(1/30)}`);
  assert.equal(n('mini.pendingFinish.win'), false, `level ${tier + 1} launch-only loses`);
  close();
}
console.log('PASS: idle and launch-only play lose at every level.');

// Level 1 is gentler than level 3 by rule.
const L = j('MAGNET_LEVELS');
assert.ok(L[0].goal < L[1].goal && L[1].goal < L[2].goal, 'quotas climb');
assert.ok(L[0].gravity < L[1].gravity && L[1].gravity < L[2].gravity, 'the ball gets quicker');
assert.ok(L[0].save > L[2].save && L[0].hp <= L[2].hp, 'level 1 saves longer and its gremlins give up sooner');
assert.ok(L[0].kick === 'always' && L[2].kick === 'none' && L[0].divider < L[2].divider, 'outlanes get meaner');
assert.ok(!L[0].drops && L[1].drops && L[2].boss && L[2].multi && !L[1].boss, 'targets on 2, boss and multiball on 3');
for (let t = 0; t < 3; t++) assert.ok(L[t].limit >= 30);
n('pbStart(2)');
assert.ok(n('mini.pinBoss&&mini.pinBoss.hp>mini.pinGrem[0].hp'), 'Clank is a bigger bumper');
n('T.x=mini.pinBoss.x;pbTick(1)');
assert.notEqual(n('Math.round(mini.pinBoss.x)'), n('Math.round(T.x)'), 'Clank slides');
n('T.g=mini.got;mini.pinBoss.hp=1;magnetBumperHit(mini.pinBoss,1,null)');
assert.equal(n('mini.got-T.g'), 3, 'evicting Clank counts three');
close();
console.log('PASS: levels escalate; Clank slides and counts three.');

// Determinism: the same seed and inputs play the same; another seed differs.
const play = seed => {
  n(`rng=${seed};pbStart(1);mini.limit=150;magnetLaunch(.4);for(let i=0;i<1200&&mini.screen==='play';i++){if(i%40===0)MAGNET.touch('down',pbLeft(),1);if(i%40===8)MAGNET.touch('up',pbLeft(),1);if(i%55===0)MAGNET.touch('down',pbRight(),2);if(i%55===9)MAGNET.touch('up',pbRight(),2);if(magnetWaiting())magnetLaunch(.4);updateMini(1/60)}`);
  const r = n('mini.score+"|"+mini.got+"|"+mini.pinBalls.map(b=>Math.round(b.x)+","+Math.round(b.y)).join(";")');
  close();
  return r;
};
assert.equal(play(77), play(77), 'deterministic for a seed');
assert.notEqual(play(77), play(78), 'bumper kicks vary with the seed');
// The physics does not care about the frame rate's slicing: 1/60 and 1/120 frames land in the same place.
const slice = dt => {
  n(`rng=5;pbStart(0);mini.pinSave=0;T.b=pbBall(100,200,300,0);pbTick(1.5,${dt})`);
  const r = j('[T.b.x,T.b.y]');
  close();
  return r;
};
const a60 = slice(1 / 60),
  a120 = slice(1 / 120);
assert.ok(Math.hypot(a60[0] - a120[0], a60[1] - a120[1]) < 2, 'fixed substeps: frame slicing barely matters');
console.log('PASS: deterministic, seed-varied, frame-rate independent.');

// Every screen draws in both canvas shapes, including the busy states.
const busy =
  'mini.pinMagOn=true;mini.pinHeat=.6;mini.pinTilt=.7;mini.pinLit=[true,false,true];mini.pinMult=3;mini.pinSave=4;' +
  'mini.pinGrem[0].gone=true;mini.pinGrem[0].respawn=1;mini.pinSplats.push({x:136,y:308,t:2,s:1});mini.pinGrem[1].flash=.1;' +
  'magnetPop(180,300,"EVICTED +1000","#c9ffb0");magnetBurst(180,300,"#9be15d",10);magnetSay("MULTIBALL",2,"#ffe08a");' +
  'mini.pinBalls[0].state="ramp";mini.pinBalls[0].rs=200;magnetServe(true);mini.pinBalls[1].state="play";mini.pinBalls[1].x=200;mini.pinBalls[1].y=500;' +
  'mini.pinShake=1;mini.pinCleared=true;mini.pinLapT=12;drawMini();mini.pinHot=true;mini.pinTilted=true;drawMini();';
for (const tall of [false, true]) {
  if (tall) n('window.innerWidth=390;window.innerHeight=844');
  for (let tier = 0; tier < 3; tier++) {
    n(`state.difficulty=1;openMini(1);mini.tier=${tier};startMini();drawMini()`);
    assert.equal(n('mini.portrait'), tall, 'portrait follows the window');
    assert.equal(n('activeCanvas().h>activeCanvas().w'), tall);
    n('launchMini();drawMini();updateMini(.5);drawMini();updateMini(3);drawMini()');
    assert.equal(n('mini.screen'), 'play');
    n('MAGNET.touch("down",pbLeft(),1);drawMini();MAGNET.touch("up",pbLeft(),1);updateMini(.05);drawMini()');
    n(busy);
    n('pauseMini();drawMini();pauseMini();drawMini()');
    n(`finishMini(${tier !== 1});drawMini();updateMini(2.3);drawResultArt()`);
    assert.equal(n('mini.screen'), 'result');
    close();
  }
  if (tall) n('delete window.innerWidth;delete window.innerHeight;resize()');
}
n('MAGNET.scene($("miniPreview").getContext("2d"),420,240);MAGNET.scene($("miniPreview").getContext("2d"),260,135)');
console.log('PASS: Polarity Panic draws every screen in landscape and portrait, busy states included.');
