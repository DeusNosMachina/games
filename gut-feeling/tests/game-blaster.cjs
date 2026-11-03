// Bedside Blaster: direct aim (tap, slide, mouse, two fingers, edge scrolling, edge arrows, the
// optional thumbstick), damage zones, armor, the charged pierce, the
// active reload, juice pickups, pouncer timing, Ralph Jr.'s weak spot, pacing, and determinism.
// Test objects live on T so they never collide with the game's globals.
const {run,close,assert}=require('./harness.cjs');
run('let rng=4242;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`
var T = {};
function bbStart(tier, difficulty = 1) {
  state.difficulty = difficulty; openMini(5); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  mini.spawn = 999; mini.bottleT = 999; mini.targets = []; T = {};
}
// Spawns a frozen gremlin with its head centred on screen point (hx, hy).
function bbGremlin(kind, hx, hy) {
  const e = spawnCrawler(kind, 'bin'), o = blasterOffset(e.r);
  e.mode = 'crawl'; e.stun = 99; e.x = hx - e.s - o.x; e.y = hy - 2 * e.s - o.y;
  return e;
}
function bbTick(seconds) { for (let t = 0; t < seconds - 1e-9; t += 0.02) updateMini(0.02); }
function bbMouse(type, x, y, extra = {}) {
  blasterPointerEvent({ type, pointerType: 'mouse', pointerId: 1, button: 0, target: $('miniCanvas'),
    ...bbClient(x, y), ...extra });
}
function bbTouch(type, id, x, y) {
  blasterPointerEvent({ type, pointerType: 'touch', pointerId: id, button: 0, target: $('miniCanvas'),
    ...bbClient(x, y) });
}
// A real finger: the blaster's window listener first (capture), then the framework's canvas listener.
function bbFinger(type, id, x, y) {
  const ev = { type, pointerType: 'touch', pointerId: id, button: 0, target: $('miniCanvas'),
    currentTarget: $('miniCanvas'), preventDefault() {}, ...bbClient(x, y) };
  blasterPointerEvent(ev);
  $('miniCanvas').events[type](ev);
}
// Invert miniPoint's letterboxed mapping for the harness's canvas rect (1000x625 unless a test swaps it).
function bbClient(x, y) {
  const r = $('miniCanvas').getBoundingClientRect(), { w, h } = games[mini.id].canvas,
    s = Math.min(r.width / w, r.height / h) || 1;
  return { clientX: r.left + (r.width - w * s) / 2 + x * s, clientY: r.top + (r.height - h * s) / 2 + y * s };
}
`);
const n=s=>run(s),j=s=>JSON.parse(run('JSON.stringify('+s+')'));
const sight=()=>j('[Math.round(mini.sight.x),Math.round(mini.sight.y)]');

// Tap anywhere: the sight sweeps to the tap, then the shot lands on whatever is under it.
n('bbStart(1);T.a=bbGremlin("crawler",200,260);arcadeDown({x:200,y:260});arcadeUp()');
assert.equal(n('mini.blasterQueue.length'),1,'a tap queues a shot while the sight sweeps');
assert.equal(n('T.a.hp'),1,'the shot has not landed mid-sweep');
n('bbTick(.1)');
assert.equal(n('T.a.mode'),'dying','the tap hit the gremlin under it');
assert.deepEqual(sight(),[200,260],'the sight snapped to the tap');
assert.equal(n('mini.ammo'),6);assert.equal(n('mini.got'),1);assert.equal(n('mini.headshots'),1);
n('mini.targets=[];bbTick(.2);arcadeDown({x:520,y:120});arcadeUp();bbTick(.1)');
assert.equal(n('mini.shotsFired'),2);assert.equal(n('mini.shotsHit'),1,'a tap on empty floor misses');
// A second finger can tap while the first one is down.
n('bbTick(.5);arcadeDown({x:300,y:300});arcadePointer=1;T.b=bbGremlin("crawler",420,240);bbTouch("pointerdown",9,420,240);bbTouch("pointerup",9,420,240)');
n('arcadeUp();arcadePointer=null;bbTick(.3)');
assert.equal(n('mini.shotsFired'),4,'the second finger fired, and so did the first one\'s tap');
assert.equal(n('T.b.mode'),'dying','the second finger tap hit its target');
close();
console.log('PASS: tap-to-fire with a sight sweep, misses, and two-finger tapping.');

// Touch aiming: a sliding finger carries the sight anywhere, ceiling and top corners included, and
// letting go shoots there. Checked through the real pointer path in a wide and a tall canvas box.
for (const box of [{ left: 0, top: 0, width: 1000, height: 625 }, { left: 8, top: 150, width: 374, height: 600 }]) {
  n(`bbStart(1);mini.ammo=mini.magazine=60;$("miniCanvas").getBoundingClientRect=()=>(${JSON.stringify(box)})`);
  const tag = box.width > box.height ? 'wide' : 'tall';
  for (const [x, y] of [[3, 3], [597, 3], [300, 2], [2, 300]]) {
    n(`T.shots=mini.shotsFired;bbFinger("pointerdown",5,${x},${y});bbFinger("pointerup",5,${x},${y});bbTick(.2)`);
    assert.deepEqual(sight(), [x, y], `${tag}: a tap reaches ${x},${y}`);
    assert.equal(n('mini.shotsFired-T.shots'), 1, `${tag}: and fires there`);
  }
  // A slide: the sight rides the finger at every step, up to the ceiling, and the room holds still.
  n('T.yaw=mini.lookTarget.yaw;T.pitch=mini.lookTarget.pitch;T.shots=mini.shotsFired;bbFinger("pointerdown",5,300,450)');
  for (const [x, y] of [[290, 440], [260, 330], [180, 200], [120, 90], [300, 75]]) {
    n(`bbFinger("pointermove",5,${x},${y});bbTick(.02)`);
    assert.deepEqual(sight(), [x, y], `${tag}: the sight follows the finger to ${x},${y}`);
  }
  assert.equal(n('mini.lookTarget.yaw'), n('T.yaw'), `${tag}: aiming does not turn the room`);
  assert.equal(n('mini.shotsFired'), n('T.shots'), `${tag}: no shot until the finger lifts`);
  n('T.g=bbGremlin("crawler",300,75);bbFinger("pointerup",5,300,75);bbTick(.1)');
  assert.equal(n('T.g.mode'), 'dying', `${tag}: letting go shoots the gremlin under the sight`);
  // Into the top-left corner: the sight gets there, the room scrolls that way, and the lift is only a look.
  n('T.yaw=mini.lookTarget.yaw;T.pitch=mini.lookTarget.pitch;T.shots=mini.shotsFired;bbFinger("pointerdown",5,300,300);bbFinger("pointermove",5,150,150);bbFinger("pointermove",5,2,2);bbTick(.3)');
  assert.deepEqual(sight(), [2, 2], `${tag}: the sight reaches the top-left corner`);
  assert.ok(n('mini.lookTarget.yaw') < n('T.yaw') - 300, `${tag}: the left edge scrolls the room left`);
  assert.ok(n('mini.lookTarget.pitch') < n('T.pitch'), `${tag}: the top edge tilts it up`);
  n('bbFinger("pointerup",5,2,2);bbTick(.2)');
  assert.equal(n('mini.shotsFired'), n('T.shots'), `${tag}: lifting while it scrolls never fires`);
  n('$("miniCanvas").getBoundingClientRect=()=>({width:1000,height:625,left:0,top:0})');
  close();
}
// The right edge scrolls the other way; at the end of the room a slide into the band still shoots.
n('bbStart(1);T.yaw=mini.lookTarget.yaw;arcadeDown({x:300,y:300});arcadeMove({x:598,y:300});bbTick(.25)');
assert.ok(n('mini.lookTarget.yaw') > n('T.yaw') + 300, 'the right edge scrolls right');
n('arcadeUp();mini.lookTarget.yaw=BLASTER_YAW[1];T.shots=mini.shotsFired;arcadeDown({x:300,y:300});arcadeMove({x:590,y:300});bbTick(.1);arcadeUp();bbTick(.2)');
assert.equal(n('mini.shotsFired-T.shots'), 1, 'nothing left to scroll, so the lift shoots');
// Hold still, then slide: the charge keeps building and the piercing shot goes where the finger ends up.
n('mini.targets=[];T.c=bbGremlin("bruiser",420,250);arcadeDown({x:250,y:330});bbTick(.3);arcadeMove({x:420,y:250});bbTick(.4)');
assert.equal(n('blasterChargeLevel()'), 1, 'a held, sliding finger charges');
n('arcadeUp();bbTick(.1)');
assert.equal(n('mini.chargedShots'), 1);assert.equal(n('T.c.mode'), 'dying', 'the charged shot landed where the slide ended');
close();
// An edge arrow: a tap on it turns the room to face its gremlin, and is not a shot.
n('bbStart(1);T.ar=spawnCrawler("crawler","cabinetR");T.ar.mode="crawl";T.ar.stun=99;T.a=blasterArrows()[0]');
assert.equal(n('T.a&&T.a.side'), 1, 'a gremlin past the right edge gets an arrow');
n('T.shots=mini.shotsFired;arcadeDown({x:T.a.x+30,y:T.a.y});arcadeUp();bbTick(.4);T.px=shooterProjection(T.ar).x');
assert.ok(n('T.px>300&&T.px<560'), 'the arrow brought it into view');
assert.equal(n('mini.shotsFired'), n('T.shots'), 'the arrow tap did not fire');
close();
console.log('PASS: touch aims anywhere in a wide and a tall box, slides carry the sight, edges and arrows look.');

// The thumbstick: off by default, the chip shows it and the choice is saved, it steers the sight, a
// finger still aims and fires with it shown, and the chip hides it again.
n('bbStart(1);delete state.stats.blasterStick');
assert.equal(n('blasterStickShown()'), false, 'no stick until she asks');
n('arcadeDown({x:260,y:565});arcadeUp();bbTick(.1)');
assert.equal(n('state.stats.blasterStick'), 1, 'the chip turns the stick on');
assert.equal(n('blasterStickShown()'), true);
assert.equal(n('mini.shotsFired'), 0, 'the chip is not a shot');
assert.equal(JSON.parse(n('localStorage.getItem(STORE)')).stats.blasterStick, 1, 'and the choice is saved');
n('T.chipG=bbGremlin("crawler",250,560);arcadeDown({x:250,y:560});arcadeUp();bbTick(.12)');
assert.equal(n('T.chipG.mode'), 'dying', 'a gremlin over the chip gets shot, not the setting');
assert.equal(n('state.stats.blasterStick'), 1);
n('mini.targets=[];bbTick(.3)');
n('mini.sight={x:300,y:300};arcadeDown({x:76,y:452});arcadeMove({x:76,y:380});bbTick(.3)');
assert.ok(n('mini.sight.y') < 150 && Math.abs(n('mini.sight.x') - 300) < 1, 'pushing the stick up raises the sight');
n('arcadeMove({x:180,y:452});T.sx=mini.sight.x;bbTick(.2)');
assert.ok(n('mini.sight.x') > n('T.sx') + 80, 'and right moves it right');
n('T.sy=mini.sight.y;arcadeMove({x:80,y:455});bbTick(.3)');
assert.ok(Math.abs(n('mini.sight.y') - n('T.sy')) < 2, 'a centred stick holds the sight still');
n('T.yaw=mini.lookTarget.yaw;arcadeMove({x:10,y:452});bbTick(1.2)');
assert.deepEqual(sight().map(v => v === 0), [true, false], 'the stick pins the sight on the left edge');
assert.ok(n('mini.lookTarget.yaw') < n('T.yaw') - 200, 'where it scrolls the room');
n('T.shots=mini.shotsFired;arcadeUp();bbTick(.1)');
assert.equal(n('mini.shotsFired'), n('T.shots'), 'letting go of the stick never fires');
n('T.st=bbGremlin("crawler",420,240);mini.sight={x:300,y:300};arcadeDown({x:76,y:452});arcadeMove({x:76,y:420});arcadePointer=1;bbTouch("pointerdown",9,420,240);bbTouch("pointerup",9,420,240);bbTick(.3)');
assert.equal(n('T.st.mode'), 'dying', 'a second finger taps and fires with a thumb on the stick');
n('arcadeUp();arcadePointer=null;mini.fireHeld=false;mini.sight={x:200,y:200};miniAction("fire");bbTick(.05)');
assert.equal(n('mini.shotsFired'), n('T.shots') + 2, 'FIRE shoots at the sight');
n('T.f=bbGremlin("crawler",450,300);arcadeDown({x:450,y:300});arcadeUp();bbTick(.12)');
assert.equal(n('T.f.mode'), 'dying', 'a tap in the room still fires where it lands with the stick shown');
n('drawMini();arcadeDown({x:90,y:440});drawMini();arcadeUp();mini.ammo=0;reloadBlaster();drawMini()');
n('arcadeDown({x:260,y:565});arcadeUp()');
assert.equal(n('state.stats.blasterStick'), 0, 'the chip hides it again');
assert.equal(JSON.parse(n('localStorage.getItem(STORE)')).stats.blasterStick, 0);
n('mini.sight={x:300,y:300};arcadeDown({x:76,y:452});arcadeMove({x:76,y:380});bbTick(.3);arcadeUp();bbTick(.12)');
assert.deepEqual(sight(), [76, 380], 'hidden, that corner is just room again: the finger slid the sight');
close();
n('bbStart(1);state.stats.blasterStick=1;bbMouse("pointermove",76,452)');
assert.equal(n('blasterStickShown()'), false, 'a mouse never sees the stick');
assert.deepEqual(sight(), [76, 452], 'and aims there as before');
n('bbMouse("pointerdown",260,565);arcadeDown({x:260,y:565});arcadeUp()');
assert.equal(n('state.stats.blasterStick'), 1, 'nor toggles it with a click');
n('bbMouse("pointermove",300,300);arcadeDown({x:76,y:452});T.how=mini.blasterPresses.main.how;arcadeUp()');
assert.equal(n('T.how'), 'stick', 'a thumb after the mouse still grabs the stick');
n('state.stats.blasterStick=0');
close();
console.log('PASS: thumbstick off by default, chip toggles and saves, stick steers and scrolls, fingers still fire.');

// Mouse: the sight follows the pointer, a left click fires there, right-drag or Shift-drag looks, edges auto-pan.
n('bbStart(1);bbMouse("pointermove",150,330)');
assert.deepEqual(sight(),[150,330],'the sight follows the mouse');
n('T.c=bbGremlin("crawler",150,330);bbMouse("pointerdown",150,330);arcadeDown({x:150,y:330});arcadeUp()');
assert.equal(n('T.c.mode'),'dying','a click fires at the pointer immediately');
n('T.yaw=mini.lookTarget.yaw;bbMouse("pointerdown",300,300,{button:2});arcadeDown({x:300,y:300});arcadeMove({x:250,y:300});arcadeUp()');
assert.equal(n('mini.lookTarget.yaw'),n('T.yaw')-90,'right-drag pans');
assert.equal(n('mini.shotsFired'),1,'right-drag never fires');
n('bbMouse("pointerdown",300,300,{shiftKey:true});arcadeDown({x:300,y:300});arcadeMove({x:350,y:300});arcadeUp()');
assert.equal(n('mini.lookTarget.yaw'),n('T.yaw'),'Shift-drag pans');
n('bbMouse("pointermove",595,300);T.yaw=mini.lookTarget.yaw;bbTick(.3)');
assert.ok(n('mini.lookTarget.yaw')>n('T.yaw')+50,'the room drifts when the sight nears an edge');
n('bbMouse("pointerout",595,300);T.yaw=mini.lookTarget.yaw;bbTick(.3)');
assert.equal(n('mini.lookTarget.yaw'),n('T.yaw'),'auto-pan stops when the mouse leaves');
close();
console.log('PASS: mouse sight follow, click to fire, right/Shift drag, edge auto-pan.');

// Damage: headshots do double; bedpan helmets pop on the first headshot; bruisers shrug off body shots.
n('bbStart(1);T.h=bbGremlin("helmet",300,250);fireBlaster(300,250)');
assert.equal(n('T.h.helmet'),false,'the first headshot pops the helmet');assert.equal(n('T.h.hp'),1);
n('mini.shotCd=0;fireBlaster(300,250)');assert.equal(n('T.h.mode'),'dying');
n('T.br=bbGremlin("bruiser",300,250);mini.shotCd=0;fireBlaster(300,250+20*T.br.s)');
assert.equal(n('T.br.hp'),3,'a body shot bounces off a bruiser');
n('mini.shotCd=0;fireBlaster(300,250)');assert.equal(n('T.br.hp'),1,'a headshot does two');
n('T.cr=bbGremlin("crawler",300,250);mini.targets=[T.cr];mini.shotCd=0;fireBlaster(300,250+20*T.cr.s)');
assert.equal(n('T.cr.mode'),'dying','one body shot evicts a crawler');
close();
console.log('PASS: headshots, helmet pops, bruiser shrugs.');

// Charged shot: hold 0.6 s and release; the beam pierces everything along its line.
n('bbStart(1);mini.sight={x:300,y:300};T.M=blasterMuzzle();T.L=Math.hypot(300-T.M.x,300-T.M.y);T.ux=(300-T.M.x)/T.L;T.uy=(300-T.M.y)/T.L');
n('T.p1=bbGremlin("crawler",300,300);T.p2=bbGremlin("crawler",300+T.ux*130,300+T.uy*130);fireBlaster(300,300)');
assert.equal(n('T.p1.mode'),'dying');assert.equal(n('T.p2.mode'),'crawl','a normal shot stops at the first gremlin');
n('mini.targets=[];bbTick(.3);mini.sight={x:300,y:300};T.q1=bbGremlin("crawler",300,300);T.q2=bbGremlin("crawler",300+T.ux*130,300+T.uy*130);T.q3=bbGremlin("bruiser",80,120)');
n('arcadeDown({x:300,y:300});bbTick(.66);arcadeUp()');
assert.equal(n('mini.chargedShots'),1,'a still hold fired a charged shot on release');
assert.equal(n('T.q1.mode'),'dying');assert.equal(n('T.q2.mode'),'dying','the charged shot pierced the second gremlin');
assert.equal(n('T.q3.hp'),3,'nothing off the line was touched');
assert.equal(n('mini.pierces'),1);
n('mini.targets=[];bbTick(.3);T.q4=bbGremlin("bruiser",300,300);fireBlaster(300,300+20*T.q4.s,true)');
assert.equal(n('T.q4.hp'),1,'charged body shots get through a bruiser');
// FIRE button / Space: press starts, release fires; the click that follows a held button is not a second shot.
n('mini.targets=[];bbTick(.3);T.shots=mini.shotsFired;mini.fireHeld=true;miniAction("fire");bbTick(.7);mini.fireHeld=false;miniAction("fire");bbTick(.1)');
assert.equal(n('mini.shotsFired-T.shots'),1,'one held trigger, one shot');assert.equal(n('mini.chargedShots'),3);
n('bbTick(.4);miniAction("fire")');assert.equal(n('mini.shotsFired-T.shots'),2,'a plain FIRE tap shoots at the sight');
close();
console.log('PASS: charged pierce through two gremlins, bruiser armor, FIRE hold and release.');

// Active reload: inside the green is instant and hot; outside jams it.
n('bbStart(1);mini.ammo=1;mini.sight={x:520,y:120};fireBlaster()');
assert.ok(n('mini.reload>0'),'emptying the magazine starts a reload');
n('T.w=blasterReloadWindow();bbTick(T.w[0]+.04);reloadBlaster()');
assert.equal(n('mini.reload'),0);assert.equal(n('mini.ammo'),7);assert.equal(n('mini.hot'),2);assert.equal(n('mini.cleanReloads'),1);
n('T.hb=bbGremlin("bruiser",300,250);fireBlaster(300,250)');
assert.equal(n('T.hb.mode'),'dying','a hot headshot does four');assert.equal(n('mini.hot'),1);
n('mini.ammo=1;mini.shotCd=0;mini.hot=0;fireBlaster(520,120);bbTick(.05);reloadBlaster()');
assert.equal(n('mini.jams'),1,'pressing outside the green jams');
n('bbTick(mini.reloadBase-.04)');assert.ok(n('mini.reload>0'),'a jam is slower than a plain reload');
n('bbTick(.8)');assert.equal(n('mini.ammo'),7);
assert.ok(n('(()=>{const a=blasterTuning(0),b=blasterTuning(2);return a.window[1]-a.window[0]>b.window[1]-b.window[0]})()'),'level 1 has the wider green');
close();
console.log('PASS: active reload window, hot rounds, jams.');

// Juice bottles add three charges.
n('bbStart(1);T.spot=BLASTER_PERCHES.find(p=>p.layer==="mid"&&p.x===852);T.bt=blasterSpawnBottle(T.spot);T.bp=shooterProjection(T.bt);mini.ammo=3;fireBlaster(T.bp.x,T.bp.y)');
assert.equal(n('mini.ammo'),5,'shooting the bottle pays three charges for one');assert.equal(n('mini.bottlesShot'),1);
n('blasterSpawnBottle(T.spot);mini.ammo=9;mini.shotCd=0;fireBlaster(T.bp.x,T.bp.y)');
assert.equal(n('mini.ammo'),10,'juice can overfill the magazine by three');
close();
console.log('PASS: juice bottle pickups.');

// Pouncers: watch 2 and later, with a short wind-up and a fast leap. Leaps that land cost an oops.
for(let t=0;t<3;t++)assert.ok(n(`!BLASTER_MIX[${t}][0].pouncer&&BLASTER_MIX[${t}][1].pouncer>0`),`level ${t+1} pouncers wait for watch 2`);
n('bbStart(1);mini.shift=1;T.cw=spawnCrawler("crawler","dresserL");T.pw=spawnCrawler("pouncer","bedside")');
assert.ok(n('T.pw.windMax<T.cw.windMax*.5&&T.pw.leapDuration<T.cw.leapDuration*.6'),'pouncers have short fuses');
n('mini.targets=[T.pw];T.pw.mode="wind";T.pw.wind=T.pw.windMax;T.waited=0;while(T.pw.mode==="wind"){updateMini(.01);T.waited+=.01}');
assert.ok(Math.abs(n('T.waited-T.pw.windMax'))<.03,'the pouncer leaps right on its wind-up');
n('T.flew=0;while(mini.targets.includes(T.pw)){updateMini(.01);T.flew+=.01}');
assert.ok(n('T.flew')<=0.6,'the leap is fast');
assert.equal(n('mini.miss'),1,'a landed leap is an oops');assert.ok(n('mini.splat!==null'),'and slime on the lens');
n('bbTick(1.5)');assert.equal(n('mini.splat'),null,'the lens wipes clean');
n('T.lw=spawnCrawler("crawler","bin");T.lw.mode="leap";T.lw.leap=T.lw.leapDuration*.5;T.lp=shooterProjection(T.lw);fireBlaster(T.lp.x+T.lp.s,T.lp.y+2*T.lp.s)');
assert.equal(n('T.lw.mode'),'dying','a gremlin can be shot mid-leap');
n('T.sw=spawnCrawler("crawler","bin");T.sw.mode="wind";T.sw.wind=.2;T.sl=spawnCrawler("crawler","bedside");T.sl.mode="leap";T.sl.leap=.1;miniAction("assist");bbTick(.4)');
assert.equal(n('T.sw.mode'),'wind');assert.equal(n('T.sl.mode'),'wind','the stun knocks leapers back');assert.ok(n('T.sw.stun>0'));
close();
console.log('PASS: pouncer timing, face splats, mid-air shots, flashlight stun.');

// Ralph Jr.: armored until he roars; two mouth hits make him flinch, fewer and he lunges.
n('bbStart(2);T.rj=blasterSpawnBoss();bbTick(.8);T.rj.mode="idle";T.rj.cycleT=9;T.rp=shooterProjection(T.rj);T.mx=T.rp.x+2*T.rj.s;T.my=T.rp.y+17*T.rj.s');
assert.ok(n('T.mx>0&&T.mx<600'),'Ralph Jr. lands in view');
n('fireBlaster(T.mx,T.my)');assert.equal(n('T.rj.hp'),14,'his mouth is shut until he roars');
n('T.rj.mode="roar";T.rj.cycleT=1;T.rj.roarHits=0;mini.shotCd=0;fireBlaster(T.mx,T.my)');assert.equal(n('T.rj.hp'),12,'the open mouth is the weak spot');
n('mini.shotCd=0;fireBlaster(T.rp.x,T.rp.y-10*T.rj.s)');assert.equal(n('T.rj.hp'),12,'the rest of him is still armor');
n('mini.shotCd=0;fireBlaster(T.mx,T.my);bbTick(1.05)');assert.equal(n('T.rj.mode'),'stagger','two hits make him flinch');assert.equal(n('mini.miss'),0);
n('T.rj.mode="roar";T.rj.cycleT=.2;T.rj.roarHits=0;bbTick(1.4)');assert.equal(n('mini.miss'),1,'an unpunished roar ends in a lunge at your face');
n('T.rj.mode="roar";T.rj.cycleT=1;T.rj.hp=2;mini.shotCd=0;fireBlaster(T.mx,T.my)');assert.equal(n('T.rj.mode'),'dying');assert.equal(n('mini.bossDown'),true);
close();
n('bbStart(2);mini.spawn=1;mini.phaseTime=mini.limit*2/3+.01;bbTick(.1)');
assert.ok(n('mini.targets.some(e=>e.kind==="boss")'),'Ralph Jr. crashes level 3 watch 3');close();
n('bbStart(1);mini.phaseTime=mini.limit*2/3+.01;bbTick(.1)');assert.ok(n('!mini.bossSpawned'),'but only on level 3');close();
console.log('PASS: Ralph Jr. weak spot, flinch, lunge and arrival.');

// Pacing: spawns run to the final seconds; level 1 is slower, sparser and more patient than level 3.
for(let tier=0;tier<3;tier++){
  n(`bbStart(${tier});mini.spawn=1;mini.bottleT=99;while(mini.screen==="play"){updateMini(.05);mini.targets=[]}`);
  const times=j('mini.spawnTimes'),limit=n('mini.limit');
  assert.equal(n("mini.screen"),"outro");assert.ok(times[times.length-1]>limit-2.6,`level ${tier+1} still spawns in the last seconds`);
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]<4.3,`level ${tier+1} spawn gap at ${times[i]}`);
  close();
}
for(let s=0;s<3;s++){
  const easy=j(`blasterTuning(0,${s})`),hard=j(`blasterTuning(2,${s})`);
  assert.ok(easy.interval>hard.interval*1.3,'level 1 spawns slower');assert.ok(easy.windup>hard.windup*1.5,'level 1 winds up longer');
  assert.ok(easy.creep>hard.creep&&easy.peek>hard.peek&&easy.cap<hard.cap,'level 1 crawls slower, peeks longer, crowds less');
}
n('bbStart(0)');assert.equal(n('blasterTuning().cap'),1,'First Rodeo starts one at a time');
const first=j('(()=>{mini.spawn=0;updateMini(.02);return mini.targets.map(e=>blasterHideVisible(BLASTER_HIDES.find(h=>h.id===e.hideId)))})()');
assert.deepEqual(first,[true],'the first gremlin appears in view');close();
console.log('PASS: spawns to the end with a rush, and level 1 is gentler than level 3.');

// Same seed, same night; routes come from furniture anchors, not a fixed list.
const night=seed=>{n(`rng=${seed};bbStart(1);mini.spawn=.5;for(let i=0;i<900;i++){updateMini(.02);for(const e of mini.targets)if(e.mode==="leap")e.mode="dying"}`);const r=n('mini.targets.map(e=>e.kind+"@"+(e.hideId||"")+":"+Math.round(e.path?e.path[1].x:0)).join()+"|"+mini.spawnTimes.map(t=>t.toFixed(2)).join()');close();return r;};
assert.equal(night(77),night(77),'deterministic for a given seed');
assert.notEqual(night(77),night(78),'different seeds take different routes');
n('rng=5;bbStart(1);mini.shift=1;T.routes=new Set();for(let i=0;i<30;i++){mini.targets=[];const e=spawnCrawler();T.routes.add(e.hideId+">"+Math.round(e.path[2].x))}');
assert.ok(n('T.routes.size')>=8,'watch 2 routes vary');close();
console.log('PASS: deterministic, randomized routes.');

// Every drawing path runs: hints, leaps, splat, boss roar, reload, charge, mouse cursor.
n('bbStart(0);mini.spawn=0;bbTick(.5);drawMini();T.d1=spawnCrawler("bruiser","bin");T.d1.mode="leap";T.d1.leap=.4;blasterSpawnBottle();drawMini()');
n('mini.splat={t:.6,x:300,y:300};mini.ammo=0;reloadBlaster();mini.fireHeld=true;miniAction("fire");bbTick(.7);drawMini();mini.fireHeld=false;bbTick(.1)');
n('T.d2=blasterSpawnBoss();bbTick(.8);T.d2.mode="roar";mini.rush=true;mini.lightBurst=.5;mini.muzzle=.05;drawMini();T.d2.mode="lunge";T.d2.leap=.3;drawMini();pauseMini();drawMini();pauseMini()');
n('bbMouse("pointermove",300,300);drawMini();finishMini(false);updateMini(2.3);drawResultArt();BLASTER.scene($("miniPreview").getContext("2d"),420,240)');
close();
console.log('PASS: every blaster draw path runs.');

// Legendary (level 4): registered, with every breed from the first watch, shorter fuses than level 3, six
// charges, a longer night with a bigger quota, and Ralph Jr. twice but never two at once.
assert.equal(n('BLASTER.legendary'), true, 'Bedside Blaster has a Legendary level');
assert.equal(n('BLASTER.tierNotes.length'), 4);
assert.equal(n('miniTierCount(BLASTER)'), 4);
for (const k of ['crawler', 'helmet', 'bruiser', 'pouncer']) assert.ok(n(`BLASTER_MIX[3][0].${k}>0`), `Legendary watch 1 has ${k}s`);
for (let s = 0; s < 3; s++) {
  const l3 = j(`blasterTuning(2,${s})`), l4 = j(`blasterTuning(3,${s})`);
  assert.ok(l4.windup < l3.windup && l4.leap < l3.leap, `Legendary watch ${s + 1} has shorter fuses than level 3`);
  assert.ok(Object.values(l4).flat().every(Number.isFinite), 'every Legendary number is finite');
  assert.ok(l4.cap >= l3.cap, 'and at least as big a crowd');
}
assert.ok(n('BLASTER_MAGAZINES[3]<BLASTER_MAGAZINES[2]&&BLASTER_GOALS[3]>BLASTER_GOALS[2]'), 'fewer charges, more evictions');
n('bbStart(3)');
assert.equal(n('mini.limit'), 150, 'the longest night');
assert.equal(n('mini.magazine'), 6);assert.equal(n('mini.ammo'), 6);
assert.ok(n('BLASTER.lesson().goal').includes('Legendary'), 'the briefing says so');
assert.ok(n('BLASTER.shiftMessage(1)').includes('Ralph Jr.'), 'watch 2 warns about Ralph Jr.');
n('mini.phaseTime=mini.limit/3+.01;bbTick(.1);T.r1=mini.targets.find(e=>e.kind==="boss")');
assert.ok(n('!!T.r1'), 'Ralph Jr. crashes Legendary watch 2');assert.equal(n('mini.bossVisits'), 1);
n('mini.phaseTime=mini.limit*2/3+.01;bbTick(.1)');
assert.equal(n('mini.targets.filter(e=>e.kind==="boss").length'), 1, 'watch 3 waits while he is still in the room');
n('T.r1.mode="roar";T.r1.cycleT=9;T.r1.hp=2;T.rp=shooterProjection(T.r1);mini.shotCd=0;fireBlaster(T.rp.x+2*T.r1.s,T.rp.y+17*T.r1.s)');
assert.equal(n('T.r1.mode'), 'dying');
n('bbTick(1.1);T.r2=mini.targets.find(e=>e.kind==="boss")');
assert.ok(n('!!T.r2&&T.r2!==T.r1'), 'then he is back for watch 3');
assert.ok(n('mini.flashText').includes('BACK'));assert.equal(n('mini.bossVisits'), 2);
n('bbTick(.8);T.r2.mode="roar";T.r2.cycleT=9;T.r2.hp=2;T.rp=shooterProjection(T.r2);mini.shotCd=0;mini.ammo=3;fireBlaster(T.rp.x+2*T.r2.s,T.rp.y+17*T.r2.s);bbTick(1.1)');
assert.equal(n('mini.bossDowns'), 2);assert.ok(n('BLASTER.onWin()').includes('twice'));
assert.ok(n('!mini.targets.some(e=>e.kind==="boss")'), 'and only twice');
close();
// The lobby offers it once level 3 has a medal.
n('T.m=state.medals[5].slice();state.medals[5][2]=1;openMini(5)');
assert.ok(n('$("tierGrid").innerHTML').includes('LEVEL 4'), 'the lobby shows Legendary');
n('state.medals[5]=T.m');close();
// Idle play loses Legendary on every prescription.
for (let d = 0; d < 3; d++) {
  n(`state.difficulty=${d};openMini(5);mini.tier=3;startMini();launchMini();updateMini(3.3);for(let i=0;i<4000&&mini.screen==="play";i++)updateMini(.05);updateMini(2.3)`);
  assert.equal(n('mini.screen'), 'result');assert.equal(n('mini.win'), false, `idle Legendary P${d} lost`);
  close();
}
// Every screen of a Legendary run draws, in a wide and a tall window.
for (const tall of [false, true]) {
  if (tall) n('window.innerWidth=390;window.innerHeight=844');
  n('state.difficulty=2;openMini(5);mini.tier=3;startMini();drawMini();launchMini();drawMini();updateMini(3.3);drawMini()');
  assert.equal(n('mini.screen'), 'play');
  n('for(let i=0;i<70;i++){updateMini(.05);drawMini()}');
  n('mini.phaseTime=mini.limit/3+.01;updateMini(.05);drawMini();T.lb=mini.targets.find(e=>e.kind==="boss");T.lb.mode="roar";drawMini();mini.ammo=0;reloadBlaster();drawMini()');
  n('finishMini(true);drawMini();updateMini(2.3);drawResultArt();drawMini()');
  assert.equal(n('mini.screen'), 'result');
  close();
  if (tall) n('delete window.innerWidth;delete window.innerHeight;resize()');
}
console.log('PASS: Legendary: every breed, short fuses, six charges, Ralph Jr. twice, idle loses, every screen draws.');
