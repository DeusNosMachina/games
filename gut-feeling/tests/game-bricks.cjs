// Brick Rebellion rules: the tray follows touch, mouse and keys and serves on press; contact point sets
// the bounce angle and dry spells bend it toward a brick; armor, rubber, pink chain reactions, stars and
// every pill; gremlin hops, nurse calls, creep and the red line; drops, rack clears, Ralph's fortress and
// his goo; the safety net; portrait mapping; substeps that never tunnel; level 1 gentler than level 3;
// and every state drawing on both canvases.
const { run, close, assert } = require('./harness.cjs');
run('let rng=777;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`
var T = {};
function begin(tier, difficulty = 1) {
  state.difficulty = difficulty; openMini(2); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  T = {};
}
// An empty field with three tough bricks tucked in the top-left corner, so the rack never clears by
// accident, and a ball parked on the tray, so an empty sky never counts as a drop.
function bare() {
  const B = mini.br;
  B.bricks = []; B.pills = []; B.goo = []; B.fuses = []; B.shots = []; B.creepT = 999;
  T.anchor = bricksAddBrick('plain', 0, 0, 99);
  bricksAddBrick('plain', 1, 0, 99);
  bricksAddBrick('plain', 0, 1, 99);
  T.parked = bricksMakeBall(B.tray.x, BRICKS_TRAY_Y - BRICKS_R, 0, 0, B.speed);
  T.parked.stuck = 0; T.parked.stuckT = 9999; T.parked.serve = true;
  B.balls = [T.parked];
}
const BRICK_HP = { plain: 1, blast: 1, star: 1, rubber: 2, armor: 3, gremlin: 1, nurse: 1, weak: 2 };
function brick(kind, col, row, hp) { return bricksAddBrick(kind, col, row, hp ?? BRICK_HP[kind]); }
function ball(o) { const b = bricksMakeBall(240, 400, 0, -400, 400); Object.assign(b, o); mini.br.balls.push(b); return b; }
function step(s) { for (let t = 0; t < s - 1e-9; t += 1 / 120) updateMini(1 / 120); }
function tray(x) { const t = mini.br.tray; t.x = t.target = x; t.vx = 0; }
function angle(b) { return Math.atan2(b.vx, -b.vy) * 180 / Math.PI; }
`);
const n = s => run(s);

// The run starts with a held serve; a press on the canvas moves the tray to the finger and serves.
n('begin(0)');
assert.equal(n('mini.screen'), 'play');
assert.equal(n('bricksHolding()'), true, 'a held serve waits on the tray');
assert.ok(n('$("miniControls").innerHTML').includes('SERVE'));
n('arcadeDown({x:60+150,y:560})');
assert.equal(n('bricksHolding()'), false, 'the press serves');
assert.equal(n('Math.round(mini.br.tray.x)'), 150, 'the tray jumped to the finger with the ball');
assert.ok(n('mini.br.balls[0].vy') < 0, 'the serve goes up');
n('arcadeMove({x:60+400,y:560});step(.05)');
assert.ok(n('mini.br.tray.x') > 260, 'a drag slides the tray');
n('step(.3)');
assert.equal(n('Math.round(mini.br.tray.x)'), n('Math.round(bricksTrayClamp(400))'), 'and it settles under the finger');
n('arcadeUp(true)');
assert.equal(n('mini.screen'), 'play', 'a cancelled press does nothing');
// Space serves too, and a held serve goes by itself after a beat.
n('begin(0);BRICKS.key(" ",{repeat:false})');
assert.equal(n('bricksHolding()'), false, 'Space serves');
n('begin(0);step(bricksLevel().serve+.05)');
assert.equal(n('bricksHolding()'), false, 'the serve goes by itself');
// Keys slide the tray; the mouse moves it without a button.
n('begin(0);bare();tray(240);BRICKS.key("arrowright",{repeat:false});step(.25);keys.clear()');
assert.ok(Math.abs(n('mini.br.tray.x') - (240 + 640 * 0.25)) < 3, 'arrows slide at the key speed');
n('BRICKS.key("a",{repeat:false});step(.1);keys.clear()');
assert.ok(n('mini.br.tray.x') < 400 - 50, 'A slides left');
n('bricksHover({pointerType:"mouse",clientX:187.5+(60+100)*(625/600),clientY:300});step(.4)');
assert.equal(n('Math.round(mini.br.tray.x)'), n('Math.round(bricksTrayClamp(100))'), 'a hovering mouse is the tray');
n('bricksHover({pointerType:"touch",clientX:187.5+(60+400)*(625/600),clientY:300});step(.4)');
assert.equal(n('Math.round(mini.br.tray.x)'), n('Math.round(bricksTrayClamp(100))'), 'only a mouse hovers');
close();
console.log('PASS: serve on press, Space and by itself; tray follows touch, keys and a hovering mouse.');

// Where the ball meets the tray sets the bounce: the middle goes nearly straight up, the edges go wide.
n('begin(0);bare();tray(240);T.half=mini.br.tray.w/2;mini.br.dry=0;T.b=ball({x:240+T.half,y:BRICKS_TRAY_Y-BRICKS_R-1,vx:0,vy:400});step(1/120)');
assert.ok(Math.abs(n('angle(T.b)') - 60) < 0.5, 'the right edge sends it 60 degrees right');
n('mini.br.balls=[];mini.br.dry=0;T.b=ball({x:240-T.half/2,y:BRICKS_TRAY_Y-BRICKS_R-1,vx:0,vy:400});step(1/120)');
assert.ok(Math.abs(n('angle(T.b)') + 30) < 0.5, 'halfway left sends it 30 degrees left');
n('mini.br.balls=[];mini.br.dry=0;T.b=ball({x:240,y:BRICKS_TRAY_Y-BRICKS_R-1,vx:30,vy:400});step(1/120)');
assert.ok(Math.abs(n('angle(T.b)') - 12) < 0.5, 'dead center still leans 12 degrees');
assert.equal(n('mini.br.tray.squash') > 0, true, 'the tray squashes on contact');
// After two tray bounces that hit nothing, the third bends toward the nearest brick.
n('mini.br.balls=[];mini.br.dry=2;T.b=ball({x:250,y:BRICKS_TRAY_Y-BRICKS_R-1,vx:30,vy:400});step(1/120)');
assert.ok(n('angle(T.b)') < 0, 'the dry-spell nudge bends a rightward bounce toward the corner brick');
// A nudge that would cancel an edge bounce into a straight-up loop leans toward the brick instead.
n('T.nb=brick("plain",3,8,5);tray(120);mini.br.balls=[];mini.br.dry=2;T.b=ball({x:120-0.95*T.half,y:BRICKS_TRAY_Y-BRICKS_R-1,vx:0,vy:400});step(1/120)');
assert.ok(Math.abs(n('angle(T.b)') - 12) < 0.5, 'never straight up: 12 degrees toward the brick');
n('T.nb.hp=0;mini.br.dirty=true;step(1/120)');
// With the brick nearly overhead, the nudge aims right at it rather than leaning past it.
n('T.nb=brick("plain",4,8,5);tray(240);mini.br.balls=[];mini.br.dry=2;T.b=ball({x:250,y:BRICKS_TRAY_Y-BRICKS_R-1,vx:0,vy:400});step(1/120)');
assert.ok(Math.abs(n('angle(T.b)') - n('Math.atan2(T.nb.x+T.nb.w/2-250,BRICKS_TRAY_Y-BRICKS_R-T.nb.y-T.nb.h)*180/Math.PI')) < 0.5, 'a brick overhead gets aimed at');
n('T.nb.hp=0;mini.br.dirty=true;step(1/120)');
n('T.t=brick("plain",3,8,5);mini.br.balls=[];T.b=ball({x:T.t.x+T.t.w/2,y:T.t.y+T.t.h+12,vx:0,vy:-400});step(.05)');
assert.equal(n('mini.br.dry'), 0, 'any brick contact ends the dry spell');
close();
console.log('PASS: tray contact angles, the minimum lean and the dry-spell nudge.');

// Bricks: a hit cracks or breaks; breaks score with the combo multiplier and pop. Ball reflects off faces.
n('begin(1);bare();T.p=brick("plain",3,6,2);T.b=ball({x:T.p.x+T.p.w/2,y:T.p.y+T.p.h+12,vx:0,vy:-400});step(.05)');
assert.equal(n('T.p.hp'), 1, 'one hit cracks a two-hit brick');
assert.ok(n('T.b.vy') > 0, 'the ball bounces off the bottom face');
n('T.got=mini.got;T.s=mini.score;bricksHit(T.p,1,null)');
assert.equal(n('mini.got-T.got'), 1);
assert.equal(n('mini.score-T.s'), 75, 'a two-hit brick is worth 75 at x1');
assert.ok(n('mini.br.pops.some(p=>p.text==="+75")'));
n('mini.combo=6');
assert.equal(n('bricksMult()'), 1.5);
n('mini.combo=40');
assert.equal(n('bricksMult()'), 3, 'capped at 3x');
n('mini.combo=5;mini.br.comboT=.01;step(.05)');
assert.equal(n('mini.combo'), 0, 'the combo cools without breaks');
// Armor loses one plate per hit, whatever hits it.
n('T.a=brick("armor",2,6);bricksHit(T.a,3,null)');
assert.equal(n('T.a.hp'), 2, 'one plate at a time');
n('bricksHit(T.a,1,null);bricksHit(T.a,1,null)');
assert.equal(n('T.a.hp'), 0, 'three hits break steel');
// Rubber flings the ball faster for a moment.
n('mini.br.balls=[];T.r=brick("rubber",5,6);T.b=ball({x:T.r.x+T.r.w/2,y:T.r.y+T.r.h+12,vx:0,vy:-400,spd:400});step(.03)');
assert.ok(n('T.b.fling') > 0.9, 'rubber flings');
assert.ok(n('Math.hypot(T.b.vx,T.b.vy)') > 540, 'the fling adds 40% speed');
n('T.r.hp=0;mini.br.dirty=true;mini.br.net=99;step(1.2)');
assert.ok(Math.abs(n('Math.hypot(T.b.vx,T.b.vy)') - n('T.b.spd')) < 1, 'and it fades back');
close();
console.log('PASS: cracks, breaks, scoring, combo multiplier, armor plates and rubber flings.');

// Pink bricks blow up their neighbors after a beat; a chain of three or more pays a bonus.
n('begin(0);bare();T.c=[brick("blast",3,5),brick("blast",4,5),brick("plain",5,5),brick("plain",3,6),brick("plain",7,5)];bricksHit(T.c[0],1,null)');
assert.equal(n('T.c[1].hp'), 1, 'the neighbor waits for the fuse');
n('step(.3)');
assert.equal(n('T.c.map(b=>b.hp).join()'), '0,0,0,0,1', 'the chain reaches two columns over, not three');
assert.ok(n('mini.flashText').startsWith('CHAIN REACTION · 3 BRICKS'));
assert.equal(n('mini.br.bestReaction'), 3);
close();
console.log('PASS: pink chain reactions ripple and pay a bonus.');

// Pills: stars always drop one; catching it with the tray applies it.
n('begin(0);bare();T.s=brick("star",4,4);bricksHit(T.s,1,null)');
assert.equal(n('mini.br.pills.length'), 1, 'a star drops a pill');
n('mini.br.pills=[{kind:"wide",x:240,y:BRICKS_TRAY_Y-20,vy:150}];tray(240);T.w0=mini.br.tray.w;step(.6)');
assert.equal(n('mini.br.pills.length'), 0);
assert.ok(n('mini.br.tray.w') > n('T.w0') * 1.4, 'WIDE grows the tray');
assert.equal(n('mini.br.pillsCaught'), 1);
n('mini.br.pills=[{kind:"nap",x:60,y:BRICKS_TRAY_Y-20,vy:150}];step(.9)');
assert.equal(n('mini.br.pills.length'), 0, 'a missed pill falls away');
assert.equal(n('mini.br.nap'), 0, 'and does nothing');
// MULTI: every flying ball becomes three.
n('mini.br.balls=[];ball({x:200,y:300,vx:100,vy:-380});bricksTakePill("multi")');
assert.equal(n('mini.br.balls.length'), 3);
assert.ok(n('mini.br.balls.every(b=>b.vy<0)'), 'the split keeps them climbing');
// NAP slows every ball to 70%.
n('mini.br.balls=[];T.b=ball({x:240,y:300,vx:0,vy:-400,spd:400});bricksTakePill("nap");step(1/120)');
assert.ok(Math.abs(n('Math.hypot(T.b.vx,T.b.vy)') - 280) < 1, 'NAP slows the ball');
// CATCH: the tray holds the ball until a tap.
n('mini.br.nap=0;mini.br.balls=[];bricksTakePill("catch");tray(240);T.b=ball({x:250,y:BRICKS_TRAY_Y-BRICKS_R-1,vx:0,vy:400});step(1/60)');
assert.equal(n('T.b.stuck!==null'), true, 'CATCH holds the ball');
n('tray(300);step(1/60)');
assert.equal(n('Math.round(T.b.x)'), 310, 'it rides the tray at its catch point');
n('arcadeDown({x:60+300,y:560});arcadeUp()');
assert.equal(n('T.b.stuck'), null, 'a tap lets go');
assert.ok(n('angle(T.b)') > 0, 'and it leaves at the angle of its catch point');
// GOO shrinks the tray.
n('bricksTakePill("goo");step(.6)');
assert.ok(n('mini.br.tray.w') < n('bricksLevel().tray') * 1.5 * 0.7, 'GOO shrinks the tray');
close();
console.log('PASS: stars drop pills; WIDE, MULTI, NAP, CATCH and GOO work and missed pills fall away.');

// PILLOW: ammo from the pill, fired from the tray, one hit on the first brick above.
n('begin(0);bare();tray(240);T.p=brick("plain",3,5,2);T.ammo=mini.br.pillows;bricksTakePill("pillow")');
assert.equal(n('mini.br.pillows'), n('T.ammo') + 4);
assert.ok(n('$("miniControls").innerHTML').includes('PILLOW · ' + (n('T.ammo') + 4)), 'the button shows the ammo');
n('tray(T.p.x+T.p.w/2);miniAction("pillow")');
assert.equal(n('mini.br.shots.length'), 1);
n('miniAction("pillow")');
assert.equal(n('mini.br.shots.length'), 1, 'a short cooldown between pillows');
n('step(.6)');
assert.equal(n('T.p.hp'), 1, 'the pillow hit the brick above');
assert.equal(n('mini.br.shots.length'), 0);
n('mini.br.pillows=0;miniAction("pillow")');
assert.equal(n('mini.br.shots.length'), 0, 'no ammo, no pillow');
// Stragglers: three bricks left and four quiet seconds bring a pillow pill.
n('mini.br.bricks=[T.anchor];mini.br.sinceBreak=4.1;step(1/120)');
assert.equal(n('mini.br.pills.filter(p=>p.kind==="pillow").length'), 1, 'stragglers summon a pillow pill');
close();
console.log('PASS: the pillow cannon and the straggler pill.');

// Gremlin bricks hop a column, turning around at walls and neighbors.
n('begin(1);bare();T.g=brick("gremlin",3,5);T.g.dir=1;T.g.hopT=.01;step(.02)');
assert.equal(n('T.g.col'), 4);
assert.equal(n('T.g.x'), n('bricksColX(4)'));
n('brick("plain",5,5);bricksHop(T.g)');
assert.equal(n('T.g.col'), 3, 'blocked by a neighbor, it turns around');
n('T.g2=brick("gremlin",7,7);T.g2.dir=1;bricksHop(T.g2)');
assert.equal(n('T.g2.col'), 6, 'blocked by the wall, it turns around');
close();
console.log('PASS: gremlin bricks hop.');

// Nurse calls ring when their timer runs out and drop the rack a row; level 2 also creeps.
n('begin(1);bare();T.nc=brick("nurse",1,3);T.p=brick("plain",6,3,9);T.y=T.p.y;T.nc.ring=.01;step(.02)');
assert.equal(n('T.p.y-T.y'), 27, 'the whole rack dropped a row');
assert.equal(n('mini.br.rings'), 1);
assert.ok(n('T.nc.ringMax-T.nc.ring') < 0.05, 'the bell resets');
n('bricksHit(T.nc,1,null);step(T.nc.ringMax+.1)');
assert.equal(n('mini.br.rings'), 1, 'a broken bell never rings');
n('T.y=T.p.y;mini.br.creepT=.01;step(.02)');
assert.equal(n('T.p.y-T.y'), 27, 'the rack creeps a row');
assert.equal(n('mini.br.creeps'), 1);
// Crossing the red line smashes the bricks that crossed and costs a softball.
n('T.low=brick("plain",3,10,5);T.y=T.low.y;bricksCreep()');
assert.equal(n('T.low.hp'), 0, 'the brick that crossed is gone');
assert.equal(n('mini.miss'), 1, 'and so is a softball');
assert.equal(n('mini.br.lineHits'), 1);
assert.ok(n('mini.flashText').includes('RED LINE'));
n('begin(0)');
assert.equal(n('bricksLevel().creep'), 0, 'level 1 never creeps');
close();
console.log('PASS: nurse calls, creep and the red line.');

// A ball past the tray costs a softball and serves a new one; the last softball ends the run.
n('begin(0);bare();mini.br.balls=[];ball({x:240,y:BRICKS_FH+20,vx:0,vy:300});step(1/120)');
assert.equal(n('mini.miss'), 1);
assert.equal(n('mini.br.drops'), 1);
assert.equal(n('bricksHolding()'), true, 'a fresh serve waits');
assert.equal(n('BRICKS.lives().split("●").length-1'), n('mini.rules.misses') - 1, 'the softball stock shows it');
n('mini.miss=mini.rules.misses-1;mini.br.balls=[];ball({x:240,y:BRICKS_FH+20,vx:0,vy:300});step(1/120)');
assert.equal(n('mini.screen'), 'outro');
assert.equal(n('mini.pendingFinish.win'), false);
assert.equal(n('BRICKS.onLose(mini.pendingFinish.reason).heading'), 'OUT OF SOFTBALLS.');
// The safety net bounces a falling ball instead.
n('begin(0);bare();miniAction("assist")');
assert.equal(n('mini.br.net'), 10);
n('mini.br.balls=[];T.b=ball({x:100,y:BRICKS_NET_Y-BRICKS_R-2,vx:0,vy:400});step(1/60)');
assert.ok(n('T.b.vy') < 0, 'the net bounced it');
assert.equal(n('mini.miss'), 0);
// Running out of time never wins.
n('begin(0);mini.phaseTime=mini.limit;step(1/120)');
assert.equal(n('mini.pendingFinish.win'), false);
assert.equal(n('BRICKS.onLose(mini.pendingFinish.reason).heading'), 'THE LOUNGE CLOSED.');
close();
console.log('PASS: drops, out of softballs, the safety net and the clock.');

// Clearing a rack pays a bonus, pauses, drops the next rack in on springs and serves; the last one wins.
n('begin(0);T.s=mini.score;mini.br.bricks=mini.br.bricks.slice(0,1);mini.br.bricks[0].hp=1;bricksHit(mini.br.bricks[0],1,null);step(1/120)');
assert.equal(n('mini.br.rack'), 1);
assert.ok(n('mini.br.between') > 1.4);
assert.ok(n('mini.score-T.s') >= 400, 'rack bonus');
assert.ok(n('mini.br.banner.text').includes('WARM-UP · CLEARED'));
assert.ok(n('mini.br.bricks.length') > 20 && n('mini.br.bricks.every(b=>b.oy<-300)'), 'the next rack starts above, on springs');
n('step(1.6)');
assert.equal(n('bricksHolding()'), true, 'a serve after the pause');
assert.ok(n('mini.br.bricks.every(b=>Math.abs(b.oy)<3)'), 'the rack has settled');
assert.equal(n('mini.shift'), 1, 'the rack is the shift');
n('mini.br.rack=2;mini.br.bricks=mini.br.bricks.slice(0,1);mini.br.bricks[0].hp=1;bricksHit(mini.br.bricks[0],1,null);step(1/120)');
assert.equal(n('mini.screen'), 'outro');
assert.equal(n('mini.pendingFinish.win'), true);
close();
console.log('PASS: rack clears, the next rack, and the win.');

// Ralph's fortress: shielded until both weak points fall, throws goo at the tray, and takes the rack with it.
n('begin(2);bricksBuildRack(2,false);mini.br.rack=2;mini.br.balls=[];T.f=bricksFortress()');
assert.ok(n('!!T.f') && n('T.f.span') === 4);
assert.equal(n('mini.br.bricks.filter(b=>b.kind==="weak"&&b.boss===T.f.id).length'), 2);
n('T.hp=T.f.hp;bricksHit(T.f,1,null)');
assert.equal(n('T.f.hp'), n('T.hp'), 'shielded while a weak point stands');
assert.ok(n('mini.br.pops.some(p=>p.text==="CLANK")'));
n('for(const w of mini.br.bricks.filter(b=>b.kind==="weak"))w.hp=1,bricksHit(w,1,null)');
assert.equal(n('bricksGuarded(T.f)'), false);
assert.ok(n('mini.flashText').startsWith('SHIELD DOWN'));
n('bricksHit(T.f,1,null)');
assert.equal(n('T.f.hp'), n('T.hp') - 1, 'exposed, it takes hits');
n('tray(240);mini.br.ralphT=.01;step(.02)');
assert.equal(n('mini.br.goo.length'), 1, 'Ralph throws goo');
n('T.g=mini.br.goo[0];T.g.x=240;T.g.vx=0;T.g.y=BRICKS_TRAY_Y-4;step(.05)');
assert.ok(n('mini.br.gooT') > 4, 'goo on the tray shrinks it');
n('ball({x:20,y:300,vx:0,vy:-300});T.f.hp=1;bricksHit(T.f,1,null)');
assert.equal(n('mini.br.fortressDown'), true);
assert.ok(n('mini.score') > 2500, 'the fortress pays');
n('step(2)');
assert.equal(n('mini.screen'), 'outro', 'the rest of the rack crumbles');
assert.equal(n('mini.pendingFinish.win'), true);
assert.ok(n('BRICKS.onWin()').includes('fortress'));
close();
console.log('PASS: Ralph’s fortress, his goo and the surrender.');

// Substeps: a ball fast enough to cross a brick in one frame still hits it.
n('begin(0);bare();T.p=brick("plain",4,5,3);T.b=ball({x:T.p.x+T.p.w/2,y:T.p.y+T.p.h+60,vx:0,vy:-2400,spd:2400});updateMini(.1)');
assert.equal(n('T.p.hp'), 2, 'no tunneling at 2400 px/s and a 0.1 s frame');
assert.ok(n('T.b.y') > n('T.p.y+T.p.h'), 'the ball is back below the brick');
close();
console.log('PASS: substeps never tunnel.');

// Portrait: the 480 × 760 canvas puts the field under a top band and maps presses onto it.
n('window.innerWidth=390;window.innerHeight=844;begin(0)');
assert.equal(n('mini.portrait'), true);
assert.equal(n('JSON.stringify(activeCanvas())'), '{"w":480,"h":760}');
assert.equal(n('JSON.stringify(bricksFrame())'), '{"x":0,"y":' + n('BRICKS_PORTRAIT_TOP') + '}');
n('arcadeDown({x:120,y:720});step(.3)');
assert.equal(n('Math.round(mini.br.tray.x)'), n('Math.round(bricksTrayClamp(120))'), 'a press in the thumb rail moves the tray');
n('drawMini();mini.br.pills=[{kind:"multi",x:200,y:300,vy:150}];drawMini()');
close();
n('delete window.innerWidth;delete window.innerHeight;resize()');
console.log('PASS: the portrait canvas.');

// Level 1 teaches; level 3 is the test.
const L = n('BRICKS_LEVELS');
assert.ok(L[0].speed < L[1].speed && L[1].speed < L[2].speed, 'the ball speeds up by level');
assert.ok(L[0].tray > L[1].tray && L[1].tray > L[2].tray, 'the tray shrinks by level');
assert.ok(L[0].balls.every((b, i) => b >= L[1].balls[i] && L[1].balls[i] >= L[2].balls[i]), 'fewer softballs by level');
assert.ok(!L[0].creep && L[1].creep >= L[2].creep, 'no creep on level 1, creep from level 2');
assert.ok(!L[0].nurse && L[1].nurse > L[2].nurse);
assert.ok(!L[0].pills.goo && L[2].pills.goo > L[1].pills.goo, 'goo pills start on level 2');
assert.ok(L[0].racks.every(r => !/[agnwF?]/.test(r.rows.join(''))), 'level 1 racks are plain, pink, gold and rubber');
assert.ok(/F/.test(L[2].racks[2].rows.join('')) && !L[1].racks.some(r => /F/.test(r.rows.join(''))), 'the fortress is level 3 only');
assert.ok(L.every(l => l.racks.length === 3 && l.limit >= 30));
// Same seed, same racks: the Daily Dose depends on it.
n('rng=4242;begin(2);var K1=mini.br.bricks.map(b=>b.kind+b.col+b.row).join();rng=4242;begin(2);var K2=mini.br.bricks.map(b=>b.kind+b.col+b.row).join()');
assert.equal(n('K1'), n('K2'));
close();
console.log('PASS: level 1 is gentler than level 3, and racks are reproducible.');

// Every brick, pill, power and banner draws on both canvases; so do the card and both result scenes.
for (const portrait of [false, true]) {
  if (portrait) n('window.innerWidth=390;window.innerHeight=844');
  n('begin(2);bare();["plain","blast","star","rubber","armor","gremlin","nurse"].forEach((k,i)=>brick(k,i,4));brick("plain",0,5,2);brick("plain",1,5,3);T.n=brick("nurse",7,5);T.n.ring=1;bricksAddFortress(2,1);brick("weak",1,2).boss=mini.br.fortress');
  n('for(const [i,k] of Object.keys(BRICKS_PILLS).entries())mini.br.pills.push({kind:k,x:40+i*70,y:380,vy:150})');
  n('mini.br.goo=[{x:200,y:420,vx:0,vy:200}];mini.br.shots=[{x:240,y:400,vy:-700}];mini.br.net=3;mini.br.wide=5;mini.br.catch=5;mini.br.nap=5;mini.br.gooT=3');
  n('ball({x:240,y:300,fling:.5,trail:[{x:240,y:320},{x:240,y:310}]});T.h=ball({stuck:0,serve:true,stuckT:1});mini.combo=9;mini.br.comboT=1;mini.br.shake=.2');
  n('bricksSpark(200,200,.3,30,"#fff");bricksPop(200,200,"+50","#fff");mini.br.banner={text:"WARM-UP · CLEARED",sub:"+400",t:1};drawMini()');
  n('for(const b of mini.br.bricks)if(b.kind==="weak")b.hp=0;drawMini();mini.br.between=1;drawMini()');
  close();
  if (portrait) n('delete window.innerWidth;delete window.innerHeight;resize()');
}
n('BRICKS.scene(mc,420,240);BRICKS.scene(mc,260,135)');
n('begin(0);mini.win=true;BRICKS.resultArt(mc);mini.win=false;BRICKS.resultArt(mc)');
close();
console.log('PASS: Brick Rebellion draws every state on both canvases.');
