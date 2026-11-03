// Ward combat rules: Macy's kit (one button per action), staggers and poise, breed behaviors, spawns,
// waves, cleared rooms that stay cleared and fights that remember who is left, Ralph's grudge and the
// two-press rematch, Ralph himself, a tuning check that mashing loses while dodging wins, the gentler
// first clears, the combo and its slam, the nutrients the ward drops, the bricks hidden around each room,
// and each department's twist. tools/ward-human.cjs is the human-speed yardstick.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, events, nodes, close, assert } = require('./harness.cjs');

const reseed = s => run(`rng=${s}`);
const steps = (n, dt = 1 / 60) => run(`for(let i=0;i<${n};i++)updateCombat(${dt})`);
// A clean slate in a combat room: first visit, full health, no saved progress in the ward.
const freshRoom = room =>
  run(
    `state.difficulty=1;state.hp=5;state.upgrades=[];state.wardClears=rooms.map(()=>0);` +
      `for(const k in wardProgress)delete wardProgress[k];keys.clear();joy.x=joy.y=0;deadDelay=0;` +
      `loadRoom(${room});equip(0);player.inv=0;player.vomit=0;player.attackCd=0;player.z=0`
  );
// A new page (a save and reload) with the given localStorage blob; body runs there with run/assert.
function freshPage(blob, body) {
  const code = `const { run, nodes, events, close, assert } = require(${JSON.stringify(path.join(__dirname, 'harness.cjs'))});\n${body}`,
    env = { ...process.env, GF_PRELUDE: `localStorage.setItem('gut-feeling-v2', ${JSON.stringify(blob)})` },
    r = spawnSync(process.execPath, ['-e', code], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
}

run('let rng=1873;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296};begin();drawWorld();state.hp=5');

// ---- The kit: one button per action ----
freshRoom(1);
run('player.x=500;player.y=420;enemies=[makeEnemy(0,560,420)];attack()');
assert.equal(run('enemies[0].hp'), 3);
run('updateWorld(.17)');
assert.equal(run('enemies[0].hp'), 2, 'the pillow lands on its hit frame, not on the press');
assert.equal(run('player.attackKind'), 0, 'SWING is always the pillow');
assert.equal(run('typeof state.item'), 'undefined', 'there is nothing to equip any more');
// BRICK: three a fight, each a lob with its own button.
assert.equal(run('wardKit.bricks'), 3, 'a fight starts with three bricks');
run('enemies[0].cool=99;projectiles=[];player.brickCd=0;throwBrick()');
assert.equal(run('projectiles.at(-1).kind'), 'brick');
assert.equal(run('wardKit.bricks'), 2, 'the badge counts down');
assert.equal(nodes.brickCount.textContent, '2');
assert.equal(run('throwBrick()'), false, 'one brick every WARD_KIT.brickCool');
run('player.brickCd=0;throwBrick();player.brickCd=0;throwBrick();player.brickCd=0');
assert.equal(run('wardKit.bricks'), 0);
assert.equal(run('throwBrick()'), false, 'no fourth brick');
assert.ok(run('floats.some(f=>f.text==="OUT OF BRICKS")'), 'it says so');
assert.equal(run('projectiles.filter(p=>p.kind==="brick"&&p.friendly).length'), 3);
// No trap: the kit is the pillow, the bricks and the bag.
run('projectiles=[]');
assert.equal(run('typeof layTrap'), 'undefined', 'the trap is gone');
assert.equal(run('typeof traps'), 'undefined');
assert.deepEqual(Object.keys(JSON.parse(run('JSON.stringify(wardKit)'))), ['bricks'], 'the kit only counts bricks');
assert.ok(!('traps' in JSON.parse(run('JSON.stringify(WARD_KIT)'))) && run('WARD.trapStun') === undefined);
run('wardBrickDue=-1;enemies=[];encounter.teach=false;encounter.wave=2;spawnWave(1);updateCombat(1/60)');
assert.ok(run('wardBrickDue') > 0, 'a new wave still has a brick on the way');
// SHIELD: held, it blocks everything and nothing gets out; let go and it drops; held to empty, it pops.
run('enemies=[];player.shield=0;player.shieldMeter=wardShieldCap();player.shieldBroken=false;shieldHold(true);updateCombat(1/60)');
assert.ok(run('player.shield') > 0, 'the bubble is up while SHIELD is held');
run('player.inv=0;state.hp=5;damage("bite",{x:600,y:420})');
assert.equal(run('state.hp'), 5, 'the bubble blocks a bite');
run('player.attackCd=0;player.attack=0;attack()');
assert.equal(run('player.attack'), 0, 'no swinging from inside the bubble');
assert.equal(run('player.brickCd=0;wardKit.bricks=1;throwBrick()'), false, 'or throwing');
run('shieldHold(false);for(let i=0;i<12;i++)updateWorld(1/60)');
assert.equal(run('player.shield'), 0, 'letting go drops it');
const capSteps = Math.ceil(run('wardShieldCap()') * 60) + 6;
run(`player.shieldMeter=wardShieldCap();shieldHold(true);for(let i=0;i<${capSteps};i++)updateWorld(1/60)`);
assert.equal(run('player.shieldBroken'), true, 'held to empty, the bag gives out');
assert.equal(run('player.shield'), 0);
assert.equal(run('shieldHold(true)'), false, 'and will not go up again until it has dried a bit');
steps(Math.ceil((run('WARD_KIT.shieldMin') / run('WARD_KIT.shieldRefill')) * 60) + 6);
assert.equal(run('player.shieldBroken'), false, 'then it is ready for a fresh press');
run('state.upgrades=["bag"]');
assert.equal(run('wardShieldCap()'), 3.5, 'the Deluxe dignity bubble holds a second longer');
run('state.upgrades=[];shieldHold(false);player.shieldMeter=wardShieldCap()');
// SPIN: the third swing of a held run, once WARD_KIT.spinCool has passed. A pressed third is the finisher.
run('globalThis.sp1=makeEnemy(0,460,420);globalThis.sp2=makeEnemy(0,340,420);for(const e of [sp1,sp2]){e.hp=e.maxHp=99;e.cool=99}enemies=[sp1,sp2];player.x=400;player.y=420;player.spinCd=0;player.comboTime=0');
const heldSwing = (pressed = false) =>
  run(`player.attackCd=0;player.pressAt=${pressed ? 'time' : -9};attack();globalThis.spun=player.spinT>0;for(let i=0;i<20;i++)updateWorld(1/60);spun`);
assert.equal(heldSwing(), false);
assert.equal(heldSwing(), false);
assert.equal(heldSwing(), true, 'the third held swing spins');
assert.ok(run('sp1.hp<99&&sp2.hp<99'), 'all the way round');
assert.ok(run('player.spinCd') > 3, 'then the spin rests');
heldSwing();
heldSwing();
assert.equal(heldSwing(), false, 'a held run inside the rest ends on the finisher instead');
run('player.spinCd=0;player.comboTime=0');
heldSwing(true);
heldSwing(true);
assert.equal(heldSwing(true), false, 'pressed swings never spin: the third is the finisher');
run('enemies=[];projectiles=[];player.spinCd=0');
console.log('PASS: one button per action: the pillow swings (a held run spins), three bricks, a held shield that pops.');

// The rules below are unit checks on hand-placed gremlins: a settled room, so no wave rolls in and the
// MRI's magnet (the room's twist, tested on its own further down) stays off.
freshRoom(1);
run('encounter.complete=true;enemies=[]');

// ---- Hits stagger; only finishers, spins, bricks and stomps stun ----
run('player.x=200;player.y=420;enemies=[makeEnemy(0,260,420)];enemies[0].cool=0');
run('hitEnemy(enemies[0],1,30,{kind:"pillow"})');
assert.equal(run('enemies[0].stun'), 0, 'a normal hit does not stun');
assert.ok(run('enemies[0].stagger') > 0.1 && run('enemies[0].stagger') <= 0.13, 'a normal hit staggers about 0.12 s');
run('player.x=800;player.y=500');
steps(12);
assert.equal(run('enemies[0].stagger'), 0, 'the stagger is over within 0.2 s');
const before = run('[enemies[0].x,enemies[0].y]');
steps(18);
const after = run('[enemies[0].x,enemies[0].y]');
assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 10, 'a staggered gremlin moves again');
run('enemies=[makeEnemy(0,260,420)];player.x=200;player.combo=2;hitEnemy(enemies[0],2,70,{kind:"finisher",stun:WARD.finisherStun})');
steps(12);
assert.ok(run('enemies[0].stun') > 0.4, 'the third combo hit stuns');
console.log('PASS: hits stagger for 0.12 s and the gremlin moves again; the finisher stuns.');

// ---- Poise: two quick hits and it hops out of reach ----
run('enemies=[makeEnemy(0,260,420)];const pe=enemies[0];pe.cool=0;hitEnemy(pe,1,0,{kind:"pillow"})');
assert.equal(run('enemies[0].poise'), 1);
steps(6);
run('hitEnemy(enemies[0],1,0,{kind:"pillow"})');
assert.ok(run('enemies[0].hopT') > 0, 'the second quick hit triggers the angry hop');
steps(12);
assert.ok(run('enemies[0].z') > 16, 'the hop is airborne');
assert.equal(run('hitEnemy(enemies[0],1,0,{kind:"pillow"})'), false, 'a hopping gremlin is out of reach');
assert.equal(run('enemies[0].hp'), 1);
steps(30);
assert.equal(run('enemies[0].z'), 0);
assert.ok(run('enemies[0].angry') > 0, 'it lands angry');
console.log('PASS: poise hop after two hits, out of reach mid-air, lands angry.');

// ---- Dash through a wind-up cancels it; a pillow stomp stuns on landing ----
run('enemies=[makeEnemy(0,300,420)];enemies[0].wind=enemies[0].windMax=0.5;enemies[0].act="bite";player.x=290;player.y=420;player.dashCd=0;dash()');
steps(1);
assert.equal(run('enemies[0].wind'), 0, 'dashing through a wind-up cancels the attack');
assert.ok(run('enemies[0].stagger') > 0.3);
run('enemies=[makeEnemy(0,330,420),makeEnemy(1,240,440)];for(const e of enemies)e.stagger=5;player.x=300;player.y=420;player.jumpCd=0;player.dash=0;player.inv=1;jump()');
steps(10);
run('player.attackCd=0;attack()');
assert.equal(run('player.spike'), true, 'an airborne swing queues a spike');
run('for(let i=0;i<120&&player.z>0;i++)updateCombat(1/60)');
assert.equal(run('player.z'), 0);
assert.ok(run('enemies.every(e=>e.stun>0.6&&e.hp<e.maxHp)'), 'the landing stomp hits and stuns everything close');
console.log('PASS: dash-through cancels wind-ups; airborne swings land as a stunning stomp.');

// ---- Bruisers: shrug from the front, hurt from behind, dizzy after crashing a charge ----
run('enemies=[makeEnemy(2,500,420)];const br=enemies[0];br.fx=-1;br.fy=0;br.cool=9');
run('hitEnemy(br,1,30,{kind:"pillow",from:{x:400,y:420}})');
assert.equal(run('enemies[0].hp'), 7, 'a front poke is shrugged off');
run('enemies[0].iframes=0;hitEnemy(enemies[0],1,30,{kind:"pillow",from:{x:600,y:420}})');
assert.equal(run('enemies[0].hp'), 6, 'a hit from behind lands');
run('enemies[0].iframes=0;enemies[0].stagger=0;hitEnemy(enemies[0],2,40,{kind:"brick",from:{x:400,y:420}})');
assert.equal(run('enemies[0].hp'), 3, 'a brick hits a bruiser for 3');
assert.ok(run('enemies[0].stun') >= 1.6, 'and stuns it');
run('enemies=[makeEnemy(2,70,520)];const bc=enemies[0];bc.chargeX=-1;bc.chargeY=0;bc.fx=-1;bc.fy=0;bc.charge=1;player.x=500;player.y=420');
steps(20);
assert.equal(run('enemies[0].charge'), 0, 'the charge ends at the wall');
assert.ok(run('enemies[0].dizzy') > 0.8 && run('enemies[0].dizzy') <= 1.2, 'a wall charge leaves it dizzy for 1.2 s');
run('enemies[0].iframes=0;hitEnemy(enemies[0],1,30,{kind:"pillow",from:{x:20,y:520}})');
assert.equal(run('enemies[0].hp'), 5, 'dizzy bruisers take front hits, plus one bonus damage');
steps(75);
assert.equal(run('enemies[0].dizzy'), 0);
console.log('PASS: bruiser armor, back hits, brick stuns, and 1.2 s dizzy after a wall charge.');

// ---- Split peas: halves re-merge after 4 s alone ----
run('enemies=[makeEnemy(3,570,430)];hitEnemy(enemies[0]);enemies=enemies.filter(e=>e.hp>0)');
assert.equal(run('enemies.length'), 2);
assert.ok(run('enemies.every(e=>e.small&&e.hp===2)'));
run('player.x=120;player.y=540;player.inv=99');
steps(60 * 3.8);
assert.equal(run('wardFighters().filter(e=>e.small).length'), 2, 'still split before 4 s');
steps(60 * 3);
assert.equal(run('wardFighters().filter(e=>e.small).length'), 0, 'the halves are gone');
assert.equal(run('wardFighters().filter(e=>e.type===3&&!e.small&&e.hp===4).length'), 1, 'one 4-HP pea again');
run('player.inv=0');
console.log('PASS: splitting, and re-merging into a 4-HP pea after 4 s alone.');

// ---- Deflection and the hurler ----
run('enemies=[makeEnemy(1,700,420)];player.x=400;player.y=420;player.aimX=1;player.aimY=0;player.combo=0');
run('projectiles=[{x:470,y:388,vx:-190,vy:0,life:4,age:0,friendly:false,kind:"blob",from:enemies[0].id}];pillowHit()');
assert.equal(run('projectiles[0].kind'), 'returned', 'the pillow sends blobs back');
assert.ok(run('projectiles[0].vx') > 0);
assert.ok(run('!wardPlan(1,2,0,false).includes(4)&&!wardPlan(2,1,0,false).includes(4)'), 'no hurlers early');
assert.ok(run('wardPlan(2,2,0,false).includes(4)&&wardPlan(3,2,0,false).includes(4)'), 'hurlers from wave 2 in later rooms');
run('projectiles=[];enemies=[makeEnemy(4,700,420)];player.x=400;player.y=420;enemies[0].cool=0');
// A first clear winds up WARD.firstTell slower (and this is the teaching wave), so give it two seconds.
steps(120);
assert.ok(run('projectiles.some(p=>p.gunk&&!p.friendly)||puddles.some(p=>p.gunk)'), 'the hurler lobs gunk');
run('projectiles=[];puddles=[];combatFx=[]');
console.log('PASS: pillow deflection and the gunk-lobbing hurler.');

// ---- Damage, jumping and the forced IV ----
run('enemies=[];player.inv=0;player.shield=0;player.z=30;damage("blob",{x:600,y:420})');
assert.equal(run('state.hp'), 5, 'a high jump clears blobs');
run('player.z=0;damage("blob",{x:600,y:420})');
assert.equal(run('state.hp'), 4);
assert.ok(run('player.vomit>0'));
run('state.upgrades.push("thick");player.inv=0;state.hp=5;damage("blob",{x:600,y:420})');
assert.ok(run('player.inv') > 2, 'thick skin lengthens invulnerability');
run('state.upgrades=[];state.hp=5;player.vomit=0;player.jumpCd=0;player.inv=0;jump()');
assert.ok(run('player.vz') > 0);
steps(100, 0.01);
assert.equal(run('player.z'), 0);
console.log('PASS: jump dodge, damage, thick skin, and jump physics.');

// ---- Spawns: telegraphed, never close to Macy, varied per room ----
freshRoom(1);
assert.ok(run('enemies.length>0&&enemies.every(e=>e.emerge>0)'), 'a wave starts hidden');
assert.equal(run('wardFighters().length'), 0);
run('player.x=wardSpawns[1][4].x;player.y=wardSpawns[1][4].y+20');
steps(60 * 2.4);
assert.ok(run('wardFighters().length>0'), 'they pop out after the telegraph');
assert.ok(run('wardFighters().every(e=>e.popDist>=WARD.spawnMin)'), 'never within 220 px of Macy');
const allSpots = run('(()=>{const r0=state.room,bad=[];for(let i=0;i<5;i++){state.room=i;for(const s of wardSpawns[i])if(collides(s.x,s.y))bad.push(i)}state.room=r0;return bad.length})()');
assert.equal(allSpots, 0, 'every spawn spot is on open floor');
assert.notDeepEqual(run('wardSpawns[1].map(s=>s.x)'), run('wardSpawns[3].map(s=>s.x)'), 'spawn points vary per room');
const brickSpots = run('(()=>{const r0=state.room,bad=[];for(let i=0;i<5;i++){state.room=i;for(const [x,y] of WARD_BRICK_SPOTS[i])if(collides(x,y))bad.push(i+":"+x+","+y)}state.room=r0;return bad.join(" ")})()');
assert.equal(brickSpots, '', 'every hidden-brick spot is on open floor');
console.log('PASS: telegraphed spawns from furniture and vents, never within 220 px.');

// ---- Teaching wave, banners, waves, clears, the arcade lock and persistence ----
freshRoom(1);
assert.equal(run('encounter.teach'), true, 'the first visit opens with a teaching wave');
assert.equal(run('wardBanner.title'), 'WAVE 1');
assert.ok(run('wardPlan(1,1,0,true).length<wardPlan(1,1,0,false).length'), 'the teaching wave is smaller');
assert.equal(run('wardLocked(1)'), true, 'the arcade is locked before the first clear');
assert.equal(run('wardLocked(0)||wardLocked(5)'), false, 'home base never locks');
run('enemies=[];updateCombat(.01)');
assert.equal(run('encounter.wave'), 2);
assert.equal(run('wardBanner.title+" · "+wardBanner.sub'), 'WAVE 2 · they brought friends');
run('enemies=[];encounter.wave=3;const coins0=state.coins;globalThis.coins0=coins0;updateCombat(.01)');
assert.ok(run('encounter.complete'));
assert.equal(run('state.wardClears[1]'), 1, 'a clear raises the grudge');
assert.equal(run('state.coins-coins0'), run('wardPayout(0)'), 'the clear pays once');
run('updateCombat(.01)');
assert.equal(run('state.coins-coins0'), run('wardPayout(0)'));
assert.equal(run('JSON.parse(localStorage.getItem(STORE)).wardClears[1]'), 1, 'clears persist');
assert.equal(run('wardLocked(1)'), false, 'the arcade unlocks after the clear');
console.log('PASS: teaching wave, wave banners, single payout, persistent clears, and the arcade lock.');

// ---- Ralph's grudge: calm rooms, rematches that escalate and pay more ----
run('loadRoom(2);loadRoom(1)');
assert.ok(run('encounter.complete&&encounter.calm&&enemies.length===0'), 'a cleared room stays calm on entry');
assert.ok(run('$("wardStatus").textContent').includes("GRUDGE LV 1"), 'the ward strip shows the grudge level');
assert.ok(run('$("wardStatus").textContent').includes('+' + run('wardPayout(1)')), 'and the rematch payout');
run('loadRoom(1)');
assert.ok(run('encounter.complete&&enemies.length===0'), 'reloading a cleared room (map, prescription) stays calm');
run('wardRematch()');
assert.equal(run('encounter.complete'), false, 'the rematch button starts a grudge match');
assert.equal(run('encounter.grudge'), 1);
assert.equal(run('enemies.length'), run('wardPlan(1,1,1,false).length'));
assert.ok(run('wardPlan(1,1,1,false).length>wardPlan(1,1,0,false).length'), 'grudges add gremlins');
assert.ok(run('wardPayout(1)>wardPayout(0)&&wardPayout(3)>wardPayout(1)'), 'and pay more');
assert.ok(run('encounter.pace>1'), 'and speed them up');
run('state.upgrades=["repellent"]');
assert.ok(run('(()=>{const a=wardPlan(1,1,1,false).length;state.upgrades=[];return a<wardPlan(1,1,1,false).length})()'), 'repellent trims the first wave');
// Leaving mid-fight and coming back resumes the same wave instead of restarting...
run('encounter.wave=2;spawnWave(1);loadRoom(2);loadRoom(1)');
assert.equal(run('encounter.wave'), 2, 'fights persist across room changes');
// ...with exactly who was left: an evicted gremlin stays evicted, a split pea comes back as its two halves.
run('globalThis.left3=[makeEnemy(3,300,420),makeEnemy(0,600,420),makeEnemy(1,700,500)];for(const e of left3)e.cool=99;enemies=[...left3];player.x=280;player.y=420');
run('hitEnemy(left3[0],1,0,{kind:"pillow",from:player});left3[1].iframes=0;hitEnemy(left3[1],99,0,{kind:"brick",from:player})');
assert.equal(run('JSON.stringify(wardProgress[1].left)'), '[[1],[3,1],[3,1]]', 'every eviction and split is written down at once');
assert.equal(run('JSON.parse(localStorage.getItem(STORE)).wardFights[1].wave'), 2, 'and saved');
run('loadRoom(2);loadRoom(1)');
assert.equal(run('enemies.filter(e=>e.hp>0).map(e=>e.type+(e.small?"s":"")).sort().join()'), '1,3s,3s', 'the next visit brings back only who was left');
assert.equal(run('encounter.wave'), 2);
assert.ok(run('(()=>{const h=enemies.filter(e=>e.small);return h.length===2&&h[0].pod&&h[0].pod===h[1].pod})()'), 'the halves can still re-merge');
assert.match(run('wardBanner.sub'), /^3 left/, 'the banner says how many are left');
// A reload too: the save carries the fight.
const midFight = run('save();localStorage.getItem(STORE)');
freshPage(
  midFight,
  `run('begin();goRoom(1)');
assert.equal(run('encounter.complete'), false, 'after a reload the fight is still on');
assert.equal(run('encounter.wave'), 2, 'at the same wave');
assert.equal(run('enemies.filter(e=>e.hp>0).map(e=>e.type+(e.small?"s":"")).sort().join()'), '1,3s,3s', 'with the same three left');
assert.equal(run('encounter.teach'), false, 'and no teaching wave');
run('goRoom(3)');
assert.equal(run('encounter.wave'), 1, 'a room never started starts at the top');`
);
console.log('PASS: calm cleared rooms, escalating grudge rematches, repellent, and fights that remember who is left, across visits and reloads.');

// ---- Cleared means cleared: only REMATCH re-arms a room ----
// It used to take one tap on the strip's pill (it floats over the floor on phones), and the re-armed fight
// was then remembered: that is what brought the gremlins back. Now every way back in stays calm, the
// strip's REMATCH needs two presses, and the pause menu's needs one.
run('enemies=[];encounter.wave=3;updateCombat(.01)');
assert.ok(run('encounter.complete'), 'the rematch is cleared');
assert.equal(run('state.wardClears[1]'), 2);
assert.equal(run('1 in wardProgress'), false, 'a cleared fight is forgotten');
for (const way of [
  'loadRoom(2);loadRoom(1)',
  'hallwayEnter(1);goRoom(1)',
  'state.difficulty=2;loadRoom(state.room);state.difficulty=1;loadRoom(1)',
  'openMini(1);leaveMini()',
  'setWardPause(true);setWardPause(false)',
  'setControlScheme("stick");loadRoom(2);loadRoom(1);setControlScheme("tap");loadRoom(2);loadRoom(1)'
]) {
  run(way);
  steps(30);
  assert.ok(run('state.room===1&&encounter.complete&&enemies.length===0'), `still calm after ${way}`);
}
const clearedSave = run('save();localStorage.getItem(STORE)');
freshPage(clearedSave, `run('begin();goRoom(1)');assert.ok(run('encounter.complete&&enemies.length===0'), 'and after a reload');`);
assert.match(nodes.rematchBtn.textContent, /^Rematch ↻ · grudge LV 2 · \+\d+$/, 'REMATCH names the grudge level and the payout');
assert.match(nodes.pauseRematch.textContent, /grudge LV 2/, 'so does the pause menu');
const press = id => nodes[id].events.pointerdown({ pointerId: 91, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, preventDefault() {} });
press('rematchBtn');
assert.ok(run('encounter.complete&&enemies.length===0'), 'one press on the strip only arms it');
assert.match(nodes.rematchBtn.textContent, /^Sure\? Tap again/);
steps(60 * 3.2);
assert.match(nodes.rematchBtn.textContent, /^Rematch/, 'and it disarms after a few seconds');
press('rematchBtn');
steps(30);
press('rematchBtn');
assert.equal(run('encounter.complete'), false, 'two presses start the grudge match');
assert.equal(run('encounter.grudge'), 2);
run('enemies=[];encounter.wave=3;updateCombat(.01);setWardPause(true)');
nodes.pauseRematch.events.click();
assert.equal(run('state.paused'), false, 'the pause menu resumes');
assert.equal(run('encounter.complete'), false, 'and starts the rematch at once');
assert.equal(run('encounter.grudge'), 3);
run('enemies=[];encounter.wave=3;updateCombat(.01)');
console.log('PASS: a cleared room stays calm through the map, the hallway, a new prescription, an arcade, a pause, both schemes and a reload; REMATCH takes two presses in the strip, one in the pause menu.');

// ---- Evictions and chains ----
run('state.evictions=0;state.bestChain=0;wardChain=0;enemies=[makeEnemy(0,300,420),makeEnemy(0,330,440)];player.x=280;player.y=420');
run('for(const e of [...enemies]){e.iframes=0;hitEnemy(e,3,0,{kind:"brick",from:player})}');
assert.equal(run('state.evictions'), 2, 'each defeated gremlin counts as an eviction');
assert.ok(run('state.bestChain') >= 2, 'the best chain is tracked');
console.log('PASS: evictions and best chain.');

// ---- Ralph ----
close();
run('state.difficulty=1;state.hp=5;state.ralph=false;state.ralphReady=false;loadRoom(0)');
assert.equal(run('!!wardBoss'), false, 'no Ralph until he is ready');
run('globalThis.musicLog=[];music=n=>musicLog.push(n);state.ralphReady=true;loadRoom(1);loadRoom(0)');
assert.ok(run('!!wardBoss&&wardBoss.boss&&wardBoss.type===5'), 'Ralph waits in home base once ready');
assert.equal(run('musicLog.at(-1)'), 'boss');
assert.ok(run('wardBoss.emerge>0'), 'he squeezes out from under the bed first');
run('player.inv=99');
steps(60 * 3);
assert.equal(run('wardBoss.emerge'), 0);
assert.equal(run('wardBoss.phase'), 1);
steps(60 * 4);
assert.ok(run('projectiles.some(p=>!p.friendly&&p.from===wardBoss.id)'), 'phase 1 spits barrages');
run('wardBoss.iframes=0;wardBoss.hp=Math.floor(wardBoss.maxHp*2/3)+1;hitEnemy(wardBoss,2,0,{kind:"brick",from:player})');
assert.equal(run('wardBoss.phase'), 2, 'phase 2 below two thirds');
assert.ok(run('wardBoss.invuln') > 0);
assert.equal(run('wardBanner.title'), 'PHASE 2');
steps(60 * 3);
assert.ok(run('enemies.some(e=>e.minion)'), 'phase 2 brings nibbler minions');
run('wardBoss.iframes=0;wardBoss.invuln=0;wardBoss.hp=Math.floor(wardBoss.maxHp/3)+1;hitEnemy(wardBoss,2,0,{kind:"brick",from:player})');
assert.equal(run('wardBoss.phase'), 3, 'phase 3 below one third');
steps(60 * 12);
assert.ok(run('puddles.some(p=>p.gunk)'), 'phase 3 slams leave sticky gunk');
run('globalThis.calls=[];globalThis.realSave=save;globalThis.realDischarge=checkDischarge');
run('save=()=>{calls.push("save");realSave()};checkDischarge=()=>{calls.push("discharge");realDischarge()}');
run('wardBoss.iframes=0;wardBoss.invuln=0;wardBoss.z=0;wardBoss.slam=null;wardBoss.hp=1;hitEnemy(wardBoss,2,0,{kind:"brick",from:player})');
assert.equal(run('state.ralph'), true, 'beating Ralph sets state.ralph');
assert.ok(run('calls.includes("save")&&calls.lastIndexOf("discharge")>calls.indexOf("save")'), 'then saves and checks discharge');
run('save=realSave;checkDischarge=realDischarge');
assert.ok(run('encounter.complete'));
assert.equal(run('musicLog.at(-1)'), 'room:0');
close();
run('state.ralph=false;loadRoom(1);loadRoom(0);state.hp=1;player.inv=0;player.z=0;player.shield=0;damage("blob",{x:600,y:450})');
assert.ok(run('ralphRetreated&&wardBoss.retreating'), 'losing to Ralph sends him off');
run('updateWorld(1.31)');
assert.equal(run('mini.forced'), true, 'and Macy to the mandatory IV');
run('mini.open=false;mini.screen="lobby";for(const d of $$("dialog"))d.close();state.hp=5;deadDelay=0;loadRoom(0)');
assert.equal(run('!!wardBoss'), false, 'he stays away for the rest of that visit');
run('loadRoom(1);loadRoom(0)');
assert.equal(run('!!wardBoss'), true, 'and is back on the next visit');
run('state.ralphReady=false;state.ralph=false;loadRoom(1)');
close();
console.log('PASS: Ralph waits when ready, three phases, minions, gunk, defeat contract, and retreat on a loss.');

// ---- Tuning: mashing loses, dodging wins (normal prescription, room 1, first visit) ----
const MASHER = `(() => {
  keys.clear(); joy.x = 0; joy.y = 0; keys.add(' ');
  const fs = wardFighters();
  if (!fs.length) return;
  const e = fs.sort((a, b) => dist(a, player) - dist(b, player))[0], d = dist(e, player);
  if (d > 45) { joy.x = (e.x - player.x) / d; joy.y = (e.y - player.y) / d; }
})()`;
const KITER = `(() => {
  keys.clear(); joy.x = 0; joy.y = 0;
  const fs = wardFighters();
  if (!fs.length) return;
  const threats = fs.filter(e => (e.wind > 0 || e.charge > 0) && dist(e, player) < 320);
  const blobs = projectiles.filter(p => !p.friendly && p.kind === 'blob' && Math.hypot(p.x - player.x, p.y + 32 - player.y) < 150);
  let ax = 0, ay = 0;
  for (const e of threats) {
    const d = Math.max(1, dist(e, player));
    if (e.act === 'charge' || (e.type === 2 && e.charge > 0)) {
      // Sidestep a charge lane rather than running down it.
      const cx = e.charge > 0 ? e.chargeX : e.aimX - e.x, cy = e.charge > 0 ? e.chargeY : e.aimY - e.y, cl = Math.hypot(cx, cy) || 1;
      const side = Math.sign((player.x - e.x) * -cy + (player.y - e.y) * cx) || 1;
      ax += (-cy / cl) * side * 1.5; ay += (cx / cl) * side * 1.5;
      if (e.charge > 0 && d < 90 && player.dashCd > 0 && player.z === 0) jump();
    } else { ax += (player.x - e.x) / d; ay += (player.y - e.y) / d; }
  }
  for (const p of blobs) {
    const l = Math.max(1, Math.hypot(p.vx, p.vy)), side = Math.sign((player.x - p.x) * -p.vy + (player.y - 32 - p.y) * p.vx) || 1;
    ax += (-p.vy / l) * side; ay += (p.vx / l) * side;
  }
  if (threats.length || blobs.length) {
    if (player.x > 820 && player.y < 280) { ax -= 1.5; ay += 1.5; }
    if (player.x < 90 && ax < 0) ax = 0;
    if (player.x > 910 && ax > 0) ax = 0;
    if (player.y < 220 && ay < 0) ay = 0;
    if (player.y > 540 && ay > 0) ay = 0;
    if (Math.hypot(ax, ay) < 0.2) { ax = 500 - player.x; ay = 400 - player.y; }
    const l = Math.hypot(ax, ay) || 1;
    joy.x = ax / l; joy.y = ay / l;
    const close = threats.find(e => (e.charge > 0 || (e.wind > 0 && e.wind < 0.2)) && dist(e, player) < 130);
    if (close && player.dashCd <= 0) { player.lastDx = joy.x; player.lastDy = joy.y; dash(); }
    return;
  }
  const e = fs.sort((a, b) => dist(a, player) - dist(b, player))[0], d = dist(e, player);
  if (d > 70) { joy.x = (e.x - player.x) / d; joy.y = (e.y - player.y) / d; }
  if (d < 105) keys.add(' ');
})()`;

// refused is state.stats.ensureRefused for the run (Barb's Ensure gag; 0 is the plain ward).
function playBot(policy, seconds, seed, refused = 0) {
  run(`state.stats={ensureRefused:${refused}}`);
  freshRoom(1);
  reseed(seed);
  let t = 0;
  for (; t < seconds * 60; t++) {
    if (run('mini.open||deadDelay>0||encounter.complete')) break;
    if (run('isModal()')) run('for(const d of $$("dialog"))d.close()');
    run(policy);
    run('advanceSimulation(1/60)');
  }
  const out = run('({complete:encounter.complete,wave:encounter.wave,hp:state.hp,seconds:' + (t / 60).toFixed(1) + '})');
  run('keys.clear();joy.x=joy.y=0');
  close();
  run('deadDelay=0;state.hp=5');
  return out;
}

for (const seed of [1873, 4242, 90210]) {
  const masher = playBot(MASHER, 60, seed);
  assert.ok(!(masher.complete && masher.hp >= 3), `seed ${seed}: the masher must not clear with 3+ hearts (${JSON.stringify(masher)})`);
  const kiter = playBot(KITER, 150, seed);
  assert.ok(kiter.complete && kiter.hp > 0, `seed ${seed}: the kiter clears the ward (${JSON.stringify(kiter)})`);
  console.log(`  seed ${seed}: masher ${JSON.stringify(masher)} · kiter ${JSON.stringify(kiter)}`);
}
console.log('PASS: holding attack and walking in loses; reading wind-ups, dodging and dashing clears all three waves.');

// ---- Barb's Ensure: the gag escalates with state.stats.ensureRefused ----
const ensureAt = n => run(`state.stats={ensureRefused:${n}}`);
run('globalThis.sfxLog=[];globalThis.realSfx=sfx;sfx=(n,o)=>{sfxLog.push(n);return realSfx(n,o)}');
const uiBlips = () => run('sfxLog.filter(n=>n==="ui").length');
// Spawns every regular wave of every combat room at grudges 0 to 3, eight times over, and tallies carriers.
const ensureCensus = () =>
  run(`(() => {
    const out = { total: 0, carriers: 0, shields: 0, worst: 0, bruisers: 0, gluggers: 0, spitters: 0, beige: 0 };
    for (let room = 1; room <= 4; room++) {
      loadRoom(room);
      for (let grudge = 0; grudge <= 3; grudge++)
        for (let wave = 1; wave <= 3; wave++)
          for (let rep = 0; rep < 8; rep++) {
            enemies = [];
            encounter.teach = false;
            encounter.grudge = grudge;
            encounter.wave = wave;
            spawnWave(1);
            const held = enemies.filter(e => e.bottle);
            out.total += enemies.length;
            out.carriers += held.length;
            out.shields += held.filter(e => e.bottle.shield).length;
            out.worst = Math.max(out.worst, held.length / enemies.length);
            out.bruisers += enemies.filter(e => e.type === 2).length;
            out.gluggers += enemies.filter(e => e.glug).length;
            out.spitters += enemies.filter(e => e.type === 1).length;
            out.beige += enemies.filter(e => e.ensureBlob).length;
          }
    }
    for (const k in wardProgress) delete wardProgress[k];
    enemies = [];
    return out;
  })()`);

run('state.stats=undefined');
reseed(5150);
const plain = ensureCensus();
assert.equal(plain.carriers, 0, 'no bottles when Macy has never refused one');
assert.equal(plain.gluggers + plain.beige, 0, 'and no glugging bruisers or beige spitters');
// state.js always keeps a stats object now; the ward must not add Ensure keys to it at zero.
assert.equal(run('state.stats && state.stats.ensureSeen'), undefined, 'the ward leaves state.stats alone at zero');
ensureAt(9);
reseed(5150);
assert.equal(ensureCensus().carriers, 0, 'still none at 9');
freshRoom(1);
assert.ok(!run('$("wardStatus").textContent').includes('ENSURE'), 'no sponsor below 30');
assert.equal(run('wardBanner.tail'), undefined, 'and no banner disclaimer');

ensureAt(10);
reseed(5150);
const ten = ensureCensus();
const share = ten.carriers / ten.total;
assert.ok(share > 0.18 && share < 0.32, `about a quarter of spawns carry a bottle at 10 (${ten.carriers}/${ten.total})`);
assert.ok(ten.worst <= 1 / 3, 'never more than a third of a wave');
assert.equal(ten.shields, 0, 'bottles are only props at 10');
assert.equal(ten.gluggers + ten.beige, 0, 'no glugging or beige blobs yet');
reseed(5150);
assert.deepEqual(ensureCensus(), ten, 'the same seed hands out the same bottles');
run('globalThis.six=[0,1,2,3,4,5].map(i=>makeEnemy(0,300+i*70,420));ensureArm(six,10)');
assert.ok(run('six.filter(e=>e.bottle).length') >= 1 && run('six.filter(e=>e.bottle).length') <= 2, 'six gremlins share one or two bottles');
assert.equal(run('wardPose(six.find(e=>e.bottle)).bottle'), run('six.find(e=>e.bottle).bottle.flavor'), 'the carrier holds it');
run('const wv=six.find(e=>e.bottle);wv.wind=wv.windMax=0.5;wv.act="bite"');
assert.equal(run('wardPose(six.find(e=>e.bottle)).bottleWave'), true, 'and waves it at Macy during a wind-up');
console.log(`PASS: no bottles below 10; at 10 ${(share * 100).toFixed(1)}% of spawns carry one, never over a third of a wave.`);

// Kills drop the bottle as a 20 s prop; walking into it kicks it and counts.
ensureAt(10);
freshRoom(1);
run('encounter.complete=true;enemies=[];six=[0,1,2,3,4,5].map(i=>makeEnemy(0,300+i*70,420));ensureArm(six,10)');
run('globalThis.kc=six.find(e=>e.bottle);kc.x=420;kc.y=430;enemies=[kc];player.x=200;player.y=420;player.inv=99;floats=[]');
const kickFlavor = run('kc.bottle.flavor');
run('hitEnemy(kc,9,40,{kind:"brick",from:player})');
assert.equal(run('kc.hp'), 0);
assert.equal(run('kc.bottle'), null);
assert.equal(run('ensureProps.length'), 1, 'the carrier drops its bottle');
assert.equal(run('ensureProps[0].life'), 20, 'for 20 seconds');
assert.equal(run('ensureProps[0].flavor'), kickFlavor, 'the same flavor it was holding');
assert.ok(run('ensureProps[0].vx') > 0, 'knocked rolling');
steps(60);
assert.equal(run('ensureProps[0].vx'), 0, 'it rolls to a stop');
assert.equal(run('state.stats.ensureKicked'), undefined, 'nothing kicked yet');
run('player.x=ensureProps[0].x;player.y=ensureProps[0].y;player.moving=false');
steps(1);
assert.equal(run('state.stats.ensureKicked'), 1, 'walking into it kicks it');
assert.ok(run('floats.some(f=>f.text==="NOT YET.")'), 'NOT YET.');
assert.ok(run('Math.abs(ensureProps[0].vx)+Math.abs(ensureProps[0].vy)') > 0, 'and it slides off');
steps(60);
assert.equal(run('state.stats.ensureKicked'), 1, 'one kick per visit, not per frame');
run('player.x=ensureProps[0].x;player.y=ensureProps[0].y');
steps(1);
assert.equal(run('state.stats.ensureKicked'), 2, 'every kick counts');
run('player.x=900;player.y=540');
steps(60 * 19);
assert.equal(run('ensureProps.length'), 0, 'the prop is gone after 20 seconds');
run('drawWorld()');
console.log('PASS: kills drop a bottle prop for 20 s; each walk-in kicks it, says NOT YET. and counts.');

// From 20: the bottle is a one-hit shield, and bruisers glug between charges.
ensureAt(20);
reseed(5150);
const twenty = ensureCensus();
assert.equal(twenty.shields, twenty.carriers, 'every bottle is a shield at 20');
assert.ok(twenty.worst <= 1 / 3, 'shielded gremlins are never more than a third of a wave');
assert.equal(twenty.gluggers, twenty.bruisers, 'every bruiser glugs');
assert.equal(twenty.beige, 0, 'spitters are still green');
freshRoom(1);
run('encounter.complete=true;six=[0,1,2,3,4,5].map(i=>makeEnemy(0,300+i*70,420));ensureArm(six,20)');
run('globalThis.sh=six.find(e=>e.bottle);sh.x=560;sh.y=420;sh.cool=9;enemies=[sh];player.x=500;player.y=420;floats=[];combatFx=[];sfxLog=[]');
assert.equal(run('hitEnemy(sh,3,30,{kind:"brick",from:player})'), true, 'the hit lands on the bottle');
assert.equal(run('sh.hp'), 3, 'and does no damage');
assert.equal(run('sh.bottle'), null, 'the bottle pops');
assert.ok(run('sfxLog.includes("squelch")'), 'with a squelch');
assert.ok(run('floats.some(f=>f.text==="VANILLA. UGH.")'), 'and VANILLA. UGH.');
assert.ok(run('combatFx.some(f=>f.kind==="ensurePop")&&combatFx.some(f=>f.kind==="ensureStain")'), 'in a chocolate splash');
run('sh.iframes=0;hitEnemy(sh,1,0,{kind:"pillow"})');
assert.equal(run('sh.hp'), 2, 'the next hit lands: exactly one hit absorbed');
assert.equal(run('ensureProps.length'), 0, 'a popped bottle leaves nothing to kick');

run('globalThis.gb=makeEnemy(2,300,420);ensureArm([gb],20);enemies=[gb];gb.fx=1;gb.fy=0;gb.cool=9;player.x=800;player.y=540;player.inv=99;floats=[]');
assert.equal(run('gb.glug'), true);
run('gb.chargeX=1;gb.chargeY=0;gb.charge=0.2');
run('for(let i=0;i<40&&gb.charge>0;i++)updateCombat(1/60)');
assert.ok(run('gb.glugT') > 0.55, 'the charge ends in a glug');
assert.ok(run('floats.some(f=>f.text==="GLUG.")'), 'GLUG.');
assert.equal(run('wardPose(gb).glug'), true, 'in the glug pose');
steps(30);
assert.ok(run('gb.glugT') > 0, 'still drinking half a second in');
steps(8);
assert.equal(run('gb.glugT'), 0, 'done after 0.6 s');
assert.equal(run('gb.dizzy'), 0, 'an unbothered glug leaves it fine');
run('gb.recover=0;gb.x=300;gb.y=420;gb.chargeX=1;gb.chargeY=0;gb.charge=0.2;gb.cool=9');
run('for(let i=0;i<40&&gb.charge>0;i++)updateCombat(1/60)');
steps(6);
assert.ok(run('gb.glugT') > 0);
run('floats=[];gb.iframes=0;hitEnemy(gb,1,30,{kind:"pillow",from:{x:gb.x+60,y:gb.y}})');
assert.equal(run('gb.glugT'), 0, 'a hit interrupts the glug');
assert.ok(run('gb.dizzy') > 0.3 && run('gb.dizzy') <= 0.4, 'and leaves it dizzy for 0.4 s');
assert.equal(run('gb.hp'), 5, 'so even a front poke lands, with the dizzy bonus');
assert.ok(run('floats.some(f=>f.text==="SPIT TAKE!")'), 'SPIT TAKE!');
steps(30);
assert.equal(run('gb.dizzy'), 0, 'the dizzy wears off');
run('enemies=[];player.inv=0');
console.log('PASS: at 20 a bottle absorbs exactly one hit and pops in chocolate; bruisers glug for 0.6 s, and a hit mid-glug dizzies them for 0.4 s.');

// From 30: the sponsor strip, the banner disclaimer, and beige blobs that spell ENSURE on impact.
ensureAt(30);
reseed(5150);
const thirty = ensureCensus();
assert.equal(thirty.beige, thirty.spitters, 'every spitter spits beige at 30');
freshRoom(1);
assert.ok(run('$("wardStatus").textContent').endsWith(' · SPONSORED BY ENSURE'), 'the ward strip is sponsored');
assert.equal(run('wardBanner.title'), 'WAVE 1');
assert.equal(run('wardBanner.tail'), '(and Ensure)', 'the wave banner ends with a tiny disclaimer');
run('enemies=[];updateCombat(.01)');
assert.equal(run('wardBanner.title+" · "+wardBanner.sub+" "+wardBanner.tail'), 'WAVE 2 · they brought friends (and Ensure)');
run('drawWorld()');
run('loadRoom(2);loadRoom(1);encounter.complete=true;updateWardHUD()');
assert.ok(run('$("wardStatus").textContent').endsWith(' · SPONSORED BY ENSURE'), 'every combat-room line, fights or not');
run('state.ralphReady=false;loadRoom(0)');
assert.ok(!run('$("wardStatus").textContent').includes('ENSURE'), 'home base is not sponsored');
freshRoom(1);
run('encounter.complete=true;globalThis.sp=makeEnemy(1,700,420);ensureArm([sp],30);enemies=[sp];player.x=400;player.y=420;player.inv=0;player.shield=0;player.z=0;state.hp=5;projectiles=[];combatFx=[]');
run('wardSpit(sp,1,0,190)');
assert.equal(run('projectiles.at(-1).ensure'), true, 'the blob is Ensure');
run('drawWorld()');
run('const bp=projectiles.at(-1);bp.x=player.x+8;bp.y=player.y-32;bp.vx=-190;bp.vy=0;updateCombat(1/60)');
assert.equal(run('state.hp'), 4, 'it hurts exactly as much as a green blob');
assert.ok(run('combatFx.some(f=>f.kind==="ensureSplat"&&f.ground&&Math.abs(f.x-player.x)<1)'), 'and spells ENSURE around her feet');
run('drawWorld()');
console.log('PASS: at 30 the ward strip is sponsored, wave banners say (and Ensure), and spitters spit beige.');

// From 50: Ralph is in on it.
close();
ensureAt(49);
run('state.difficulty=1;state.hp=5;state.ralph=false;state.ralphReady=true;loadRoom(1);loadRoom(0)');
assert.equal(run('wardBoss.ensureCrown'), false, 'a plain crown at 49');
assert.equal(run('wardBoss.taunt.text'), "Hi. I'm Ralph. I live in your gut now.");
ensureAt(50);
run('loadRoom(1);loadRoom(0)');
assert.equal(run('wardBoss.ensureCrown'), true, 'a bottle stuck in his crown at 50');
assert.equal(run('wardBoss.taunt.text'), 'They got to me too.', 'and a new opening line');
run('player.inv=99');
steps(60 * 3);
run('drawWorld()');
run('wardBoss.iframes=0;wardBoss.invuln=0;wardBoss.hp=Math.floor(wardBoss.maxHp/3)+1;hitEnemy(wardBoss,2,0,{kind:"brick",from:player})');
assert.equal(run('wardBoss.phase'), 3);
run('puddles=[]');
steps(60 * 12);
assert.ok(run('puddles.some(p=>p.gunk)'), 'phase 3 slams still leave sticky puddles');
assert.ok(run('puddles.filter(p=>p.gunk).every(p=>p.ensure)'), 'but they are Ensure now');
run('drawWorld()');
run('wardBoss.iframes=0;wardBoss.invuln=0;wardBoss.z=0;wardBoss.slam=null;wardBoss.hp=1;hitEnemy(wardBoss,2,0,{kind:"brick",from:player})');
assert.ok(run('enemies.find(e=>e.boss).debris.some(d=>d.kind==="ensure")'), 'the bottle flies off when he goes');
run('drawWorld()');
run('state.ralphReady=false;state.ralph=false;player.inv=0;loadRoom(1)');
close();
console.log("PASS: at 50 Ralph's crown has a bottle in it, he opens with They got to me too., and his slams leave Ensure.");

// Each threshold blips once, on the room entry that first shows it, and ensureSeen tracks n.
run('state.stats={ensureRefused:0};sfxLog=[];loadRoom(2);loadRoom(1)');
assert.equal(uiBlips(), 0, 'no blip at zero');
assert.equal(run('state.stats.ensureSeen'), undefined, 'and nothing seen');
run('state.stats={ensureRefused:12};sfxLog=[];loadRoom(0)');
assert.equal(uiBlips(), 0, 'home base shows no Ensure, so no blip');
run('loadRoom(1)');
assert.equal(uiBlips(), 1, 'the first combat room at 12 blips once');
assert.equal(run('state.stats.ensureSeen'), 12);
run('sfxLog=[];loadRoom(2)');
assert.equal(uiBlips(), 0, 'not again for the same threshold');
run('state.stats.ensureRefused=17;loadRoom(3)');
assert.equal(uiBlips(), 0, 'or a higher count under the next one');
assert.equal(run('state.stats.ensureSeen'), 17, 'ensureSeen follows the count');
run('state.stats.ensureRefused=21;loadRoom(1)');
assert.equal(uiBlips(), 1, 'the shield threshold blips');
run('sfxLog=[];state.stats.ensureRefused=60;loadRoom(2)');
assert.equal(uiBlips(), 1, 'skipping thresholds still blips once per entry');
assert.equal(run('state.stats.ensureSeen'), 60);
run('sfxLog=[];state.stats.ensureRefused=61;state.ralphReady=true;state.ralph=false;loadRoom(0)');
assert.equal(uiBlips(), 0, "Ralph's entrance does not blip a threshold already seen");
assert.equal(run('state.stats.ensureSeen'), 61, 'but still records it');
run('state.ralphReady=false;loadRoom(1)');
close();
console.log('PASS: one UI blip per newly seen threshold per room entry; state.stats.ensureSeen tracks the count.');

// The full gag on screen: carriers, a glug, a prop, a beige blob and a splash all draw.
ensureAt(60);
freshRoom(1);
run('encounter.complete=true;six=[0,1,1,2,3,4].map((t,i)=>makeEnemy(t,250+i*110,380));ensureArm(six,60);enemies=six;for(const e of six)e.bottle={flavor:e.x%3,shield:true}');
run('six[1].wind=six[1].windMax=0.8;six[1].act="spit";six[3].glugT=0.4;six[3].recover=0.5;six[5].emerge=0.2;six[5].emergeMax=1;six[5].spot=wardSpawns[1][4]');
run('ensureProps=[{x:500,y:520,vx:0,vy:0,rot:1.57,spin:0,flavor:2,life:5,near:false}];ensureSplat(400,500);wardFx({kind:"ensurePop",x:300,y:400,life:.6,seed:1})');
run('wardSpit(six[1],3,0.16,190);drawWorld();for(const e of six)drawEnemy(c,e)');
console.log('PASS: every Ensure layer draws.');

// The difficulty is the same in practice: at 60 the masher still loses and the kiter still clears.
run('sfx=realSfx');
for (const seed of [1873, 4242, 90210]) {
  const masher = playBot(MASHER, 60, seed, 60);
  assert.ok(!(masher.complete && masher.hp >= 3), `seed ${seed} at 60: the masher must not clear with 3+ hearts (${JSON.stringify(masher)})`);
  const kiter = playBot(KITER, 150, seed, 60);
  assert.ok(kiter.complete && kiter.hp > 0, `seed ${seed} at 60: the kiter clears the ward (${JSON.stringify(kiter)})`);
  console.log(`  seed ${seed} at 60: masher ${JSON.stringify(masher)} · kiter ${JSON.stringify(kiter)}`);
}
run('state.stats=undefined');
console.log('PASS: with the ward full of Ensure, mashing still loses and dodging still clears.');

// ---- First clears: fewer gremlins up at once, longer tells; rematches stay mean ----
run('state.stats={}');
freshRoom(1);
run('enemies=[];encounter.teach=false;encounter.wave=3;spawnWave(1);player.x=500;player.y=560;player.inv=999');
const plan3 = run('wardPlan(1,3,0,false).length');
assert.ok(plan3 > 3);
assert.equal(run('enemies.length'), plan3, 'the whole wave is in the room');
assert.equal(run('enemies.filter(e=>e.queued).length'), plan3 - 3, 'but only three come out on a first clear');
steps(60 * 4);
assert.equal(run('wardFighters().length'), 3, 'three up');
assert.ok(run('enemies.filter(e=>e.queued).every(e=>e.emerge>WARD.telegraph)'), 'the rest wait in the dark, no telegraph yet');
// Gone, not split: a split pea would put two halves up.
run('const q0=wardFighters()[0];q0.hp=0;q0.gone=true');
steps(2);
assert.equal(run('enemies.filter(e=>e.queued&&e.hp>0).length'), plan3 - 4, 'one comes out when the room thins');
assert.ok(run('enemies.some(e=>!e.queued&&e.emerge>0&&e.emerge<=WARD.telegraph+0.5)'), 'with a fresh telegraph');
run('const q1=wardFighters()[0];q1.hp=0;q1.gone=true');
steps(2);
assert.equal(run('enemies.filter(e=>e.queued&&e.hp>0).length'), Math.max(0, plan3 - 4), 'the next one waits out WARD.queueGap');
steps(Math.ceil(60 * run('WARD.queueGap')));
assert.equal(run('enemies.filter(e=>e.queued&&e.hp>0).length'), Math.max(0, plan3 - 5));
// Tells: spit, charge and lob wind-ups run WARD.firstTell longer on a first clear; crouches keep their pace.
run('encounter.pace=1');
assert.ok(Math.abs(run('wardWindScale()/wardCoolScale()') - run('WARD.firstTell')) < 1e-9, 'first clear: longer tells');
run('globalThis.cr=makeEnemy(0,300,420);wardCrouch(cr)');
assert.ok(Math.abs(run('cr.windMax') - 0.55 * run('wardCoolScale()')) < 1e-9, 'a crouch is not slowed');
run('encounter.grudge=1');
assert.equal(run('wardWindScale()'), run('wardCoolScale()'), 'a rematch reads at full speed');
run('enemies=[];encounter.wave=3;spawnWave(1)');
assert.equal(run('enemies.filter(e=>e.queued).length'), 0, 'and puts the whole wave out at once');
run('player.inv=0');
console.log(`PASS: wave 3 of a first clear keeps three of ${plan3} up and feeds the rest in; tells run longer; rematches stay mean.`);

// ---- The combo: three pressed hits in a row charge a COMBO SLAM ----
freshRoom(1);
run('encounter.complete=true;enemies=[];projectiles=[];state.stats={};player.x=400;player.y=420;player.inv=999;equip(0);wardDrops=[]');
run('globalThis.dummy=makeEnemy(0,460,420);dummy.hp=dummy.maxHp=99;dummy.cool=99;enemies=[dummy]');
// One swing from a press, played out to its hit frame. far: the gremlin is out of reach (a whiff).
const swing = (pressed = true, far = false) =>
  run(
    `dummy.poise=0;dummy.poiseT=0;dummy.hopT=0;dummy.z=0;dummy.stun=0;dummy.stagger=0;dummy.iframes=0;dummy.kx=dummy.ky=0;` +
      `dummy.x=${far ? 900 : 460};dummy.y=420;player.x=400;player.y=420;player.attackCd=0;player.vomit=0;player.comboTime=0;player.combo=0;` +
      `player.pressAt=${pressed ? 'time' : -9};attack();for(let i=0;i<30;i++)updateWorld(1/60);wardCombo.n`
  );
assert.equal(swing(), 1);
assert.equal(swing(), 2);
assert.equal(run('wardCombo.ready'), false);
assert.equal(nodes.attackBtn.dataset.combo, '2', 'the attack button ring shows two thirds');
assert.equal(nodes.attackBtn.style['--combo'], String(2 / 3));
swing();
assert.equal(run('wardCombo.ready'), true, 'the third charges the combo');
assert.equal(nodes.attackBtn.dataset.combo, 'ready', 'and the button glows');
assert.ok(run('floats.some(f=>f.text==="COMBO READY")'));
run('wardCombo=wardComboFresh()');
swing();
swing(true, true);
assert.equal(run('wardCombo.n'), 0, 'a whiff starts the run over');
swing();
assert.equal(swing(false), 1, 'a held swing that lands does not count');
assert.equal(swing(false, true), 1, 'and a held whiff does not break the run');
run('dummy.x=460;dummy.y=420;player.x=400;player.y=420;dummy.stun=1;dummy.iframes=0;player.attackCd=0;player.pressAt=time;attack();for(let i=0;i<30;i++)updateWorld(1/60)');
assert.equal(run('wardCombo.n'), 1, 'hitting a stunned gremlin is free: it neither counts nor breaks');
swing();
run('player.inv=0;player.shield=0;player.z=0;damage("blob",{x:600,y:420});player.inv=999');
assert.equal(run('wardCombo.n'), 0, 'a hit on Macy breaks the run');
swing();
swing();
swing();
run('player.inv=0;player.shield=0;player.z=0;damage("blob",{x:600,y:420});player.inv=999');
assert.equal(run('wardCombo.ready'), true, 'a charged combo survives a hit');
// The slam: everything inside WARD.slamRadius is hit, shoved and stunned; a coin burst; the first one drops a nutrient.
run(
  'globalThis.ring=[makeEnemy(0,470,420),makeEnemy(2,400,500),makeEnemy(1,330,380)];globalThis.far=makeEnemy(0,700,420);' +
    'for(const e of [...ring,far]){e.cool=99}ring[1].fx=0;ring[1].fy=-1;ring[0].wind=ring[0].windMax=0.5;ring[0].act="bite";' +
    'enemies=[...ring,far];player.x=400;player.y=420;player.attackCd=0;player.vomit=0;player.z=0;globalThis.slamCoins0=state.coins;state.hp=5'
);
run('player.pressAt=time;attack()');
assert.equal(run('wardCombo.ready'), false, 'the next attack is the slam');
assert.ok(run('ring.every(e=>e.hp===e.maxHp-WARD.slamHit&&e.stun>=WARD.slamStun-0.01)'), 'everything close is hit and stunned');
assert.equal(run('ring[1].hp'), 6, 'bruiser armor or not');
assert.equal(run('ring[0].wind'), 0, 'a wind-up in progress is cancelled');
assert.ok(run('Math.hypot(ring[0].kx,ring[0].ky)') > 1000, 'and they fly back');
assert.equal(run('far.hp'), run('far.maxHp'), 'nothing past the radius');
assert.equal(run('state.coins-slamCoins0'), run('Math.max(1,Math.round(WARD.slamPay*cfg().coins))'), 'a coin burst');
assert.equal(run('state.stats.combos'), 1, 'state.stats.combos counts landed slams');
assert.equal(run('JSON.parse(localStorage.getItem(STORE)).stats.combos'), 1, 'and saves');
assert.equal(run('wardDrops.length'), 1, 'the first slam drops a nutrient');
run('for(let i=0;i<30;i++)updateWorld(1/60)');
assert.equal(run('wardCombo.n'), 0, 'the slam does not count toward the next one');
// No gremlin in reach: a normal attack, and the combo stays charged.
run('wardCombo.ready=true;enemies=[far];far.x=900;player.attackCd=0;player.pressAt=time;attack()');
assert.equal(run('wardCombo.ready'), true, 'the slam waits for a gremlin in reach');
assert.equal(run('player.attackKind'), 0);
// Later slams: coins every time, a nutrient on the first and every third after it.
run('wardDrops=[];for(let k=0;k<3;k++){wardCombo.ready=true;enemies=[makeEnemy(0,460,420)];player.attackCd=0;player.pressAt=time;attack()}');
assert.equal(run('state.stats.combos'), 4);
assert.equal(run('wardDrops.length'), 1, 'slams 2 and 3 pay coins only; slam 4 drops one');
run('drawWorld();wardCombo=wardComboFresh();wardDrops=[];enemies=[];player.inv=0');
console.log('PASS: three pressed hits charge a COMBO (whiffs and hits on Macy break it, held and free hits do not count); the slam stuns, shoves, pays and feeds.');

// ---- Health the ward hands out ----
freshRoom(1);
run('wardDrops=[];enemies=[];player.x=505;player.y=470;updateCombat(.01)');
assert.equal(run('encounter.wave'), 2);
assert.equal(run('wardDrops.length'), 1, 'a cleared wave leaves a nutrient');
assert.equal(run('collides(wardDrops[0].x,wardDrops[0].y)'), false, 'on open floor');
run('wardDrops=[];state.evictions=5;enemies=[makeEnemy(0,300,420)];hitEnemy(enemies[0],9,0,{kind:"brick",from:player})');
assert.equal(run('state.evictions'), 6);
assert.equal(run('wardDrops.length'), 1, 'every sixth eviction leaves one');
run('enemies=[makeEnemy(0,300,420)];hitEnemy(enemies[0],9,0,{kind:"brick",from:player})');
assert.equal(run('wardDrops.length'), 1, 'the seventh does not');
run('snackStock[1]=time+999;enemies=[];encounter.wave=3;updateCombat(.01)');
assert.ok(run('encounter.complete'));
assert.equal(run('snackReady(1)'), true, 'a ward clear restocks the room’s snack cart');
run('wardDrops=[]');
console.log('PASS: wave clears and every sixth eviction drop nutrients; a ward clear restocks the snack cart.');

// ---- Keyboard: one key per action ----
const keyDown = k => events.keydown({ key: k, target: {}, repeat: false, preventDefault: () => {} });
const keyUp = k => events.keyup({ key: k, target: {}, preventDefault: () => {} });
freshRoom(3);
run('enemies=[];projectiles=[];player.x=505;player.y=470;player.attackCd=0;player.vomit=0;player.brickCd=0;player.shieldMeter=wardShieldCap();player.shieldBroken=false');
keyDown(' ');
run('updateWorld(.01)');
assert.ok(run('player.attack>0&&player.attackKind===0'), 'Space swings the pillow');
keyUp(' ');
keyDown('b');
assert.equal(run('projectiles.at(-1).kind'), 'brick', 'B throws a brick');
keyUp('b');
run('player.brickCd=0;globalThis.bricksBefore=wardKit.bricks;globalThis.dashBefore=player.dash');
keyDown('e');
assert.ok(run('wardKit.bricks===bricksBefore&&player.dash===dashBefore&&player.shield===0'), 'E does nothing in the ward now');
keyUp('e');
keyDown('r');
run('updateWorld(1/60)');
assert.ok(run('player.shield') > 0, 'holding R holds the shield up');
keyUp('r');
run('for(let i=0;i<12;i++)updateWorld(1/60)');
assert.equal(run('player.shield'), 0, 'letting go of R drops it');
keyDown('2');
keyDown('c');
assert.equal(run('typeof state.item'), 'undefined', 'number keys and C no longer equip anything');
run('keys.clear();enemies=[];projectiles=[]');
assert.ok(nodes.rematchBtn, 'the ward strip exists');
console.log('PASS: Space swings, B throws a brick, hold R for the shield.');

// ---- Bricks to find ----
// One turns up a few seconds into each wave, somewhere from the room's list away from Macy; walking over it
// pockets it (five at most); a fight never hands out more than three of them at once.
freshRoom(2);
run('player.x=505;player.y=470;wardBrickDrops=[];wardKit.bricks=1');
assert.ok(run('wardBrickDue') > 0, 'a brick is due with the wave');
steps(Math.ceil(run('wardBrickDue') * 60) + 2, 1 / 60);
assert.equal(run('wardBrickDrops.length'), 1, 'it turns up');
const drop = JSON.parse(run('JSON.stringify(wardBrickDrops[0])'));
assert.ok(Math.hypot(drop.x - 505, drop.y - 470) >= run('WARD_KIT.brickAway'), 'away from Macy');
assert.ok(run(`WARD_BRICK_SPOTS[2].some(([x,y])=>x===${drop.x}&&y===${drop.y})`), 'at one of the room’s hiding spots');
run('drawWorld()');
run(`player.x=${drop.x};player.y=${drop.y};player.z=0;updateCombat(1/60)`);
assert.equal(run('wardKit.bricks'), 2, 'walking over it pockets it');
assert.equal(run('wardBrickDrops.length'), 0);
run('wardKit.bricks=WARD_KIT.brickMax;player.x=505;player.y=470;wardBrickPlace();player.x=wardBrickDrops[0].x;player.y=wardBrickDrops[0].y;updateCombat(1/60)');
assert.equal(run('wardKit.bricks'), run('WARD_KIT.brickMax'), 'five is a full pocket');
assert.equal(run('wardBrickDrops.length'), 1, 'so the brick waits');
run('player.x=505;player.y=470;wardBrickPlace();wardBrickPlace();wardBrickPlace()');
assert.equal(run('wardBrickDrops.length'), 3, 'three on the floor at most');
run('loadRoom(1)');
assert.equal(run('wardBrickDrops.length'), 0, 'they stay behind with the room');
console.log('PASS: a hidden brick turns up each wave away from Macy, glints until she walks over it, and five is a full pocket.');

// ---- Rooms with character ----
// Builds a live fight in a room with hand-placed gremlins and the twist awake.
const twistRoom = (room, list) =>
  run(
    `state.stats={};state.difficulty=1;state.hp=5;state.upgrades=[];state.wardClears=rooms.map(()=>0);` +
      `for(const k in wardProgress)delete wardProgress[k];loadRoom(${room});enemies=[${list}];` +
      `for(const e of enemies){e.cool=99;e.hp=e.maxHp=99}wardTwist.live=true;player.inv=0;player.z=0;state.hp=5`
  );
// The MRI: a telegraph, then the pull. The bruiser's helmet drags it face first into the scanner; a
// nibbler slides; a bedpan Macy kicked out flies back and bowls over whatever it crosses.
twistRoom(1, 'makeEnemy(2,481,420),makeEnemy(0,200,470),makeEnemy(0,300,560)');
run('player.x=860;player.y=520;wardTwist.t=WARD_TWIST.mri.first-0.01');
steps(2);
assert.equal(run('wardTwist.phase'), 'warn', 'the magnet warns first');
assert.equal(run('state.stats.twistTaught'), 2, 'and teaches itself once');
assert.match(run('wardHint.text'), /MAGNET/);
run('drawWorld()');
// The third gremlin stands on the line from a bedpan to the bore.
run('globalThis.pan0=wardTwist.pans[0];pan0.x=300;pan0.y=560;pan0.vx=pan0.vy=0;globalThis.boreAt=WARD_TWIST.mri.bore;globalThis.toBore=Math.hypot(boreAt.x-300,boreAt.y-560);enemies[2].x=300+(boreAt.x-300)/toBore*150;enemies[2].y=560+(boreAt.y-560)/toBore*150');
const nib0 = run('[enemies[1].x,enemies[1].y]');
steps(Math.ceil(run('WARD_TWIST.mri.warn') * 60) + 2);
assert.equal(run('wardTwist.phase'), 'pull');
run('drawWorld()');
steps(Math.ceil(run('WARD_TWIST.mri.pull') * 60));
assert.ok(run('enemies[0].hp') < 99, 'CLANG: the bruiser hits the scanner');
assert.ok(run('enemies[0].dizzy') > 0, 'and sees stars');
const nib1 = run('[enemies[1].x,enemies[1].y]');
const bore = run('[WARD_TWIST.mri.bore.x,WARD_TWIST.mri.bore.y]');
assert.ok(Math.hypot(bore[0] - nib1[0], bore[1] - nib1[1]) < Math.hypot(bore[0] - nib0[0], bore[1] - nib0[1]) - 60, 'a nibbler slides toward the MRI');
assert.ok(run('enemies[2].hp') < 99 && run('enemies[2].stun') > 0, 'a flying bedpan bowls one over');
assert.equal(run('wardTwist.phase'), 'idle');
run('player.x=wardTwist.pans[1].x-20;player.y=wardTwist.pans[1].y;player.moving=true;player.lastDx=1;player.lastDy=0;player.x+=0');
steps(1);
assert.ok(run('Math.hypot(wardTwist.pans[1].vx,wardTwist.pans[1].vy)') > 200, 'walking into a bedpan kicks it');
run('encounter.complete=true;wardTwist.t=99');
steps(60 * 3);
assert.equal(run('wardTwist.phase'), 'idle', 'a cleared room has no magnet');
// The lounge: the remote on the couch zones out whatever stands in front of the TV, then recharges.
twistRoom(2, 'makeEnemy(0,760,360),makeEnemy(1,700,440),makeEnemy(0,250,450)');
steps(1);
assert.equal(run('state.stats.twistTaught'), 4, 'the remote is taught when the fight starts');
run('drawWorld();player.x=826;player.y=300;player.attackCd=0;player.pressAt=time;attack();for(let i=0;i<20;i++)updateWorld(1/60)');
assert.ok(run('enemies[0].stun>1.5&&enemies[1].stun>1.5'), 'a swing at the couch zones out everything in front of the screen');
assert.equal(run('enemies[2].stun'), 0, 'not the one across the room');
assert.equal(run('tvChannel(2)'), 0, 'the TV jumps to the cat cam');
assert.ok(run('wardTwist.cool') > 10, 'then the remote recharges');
run('drawWorld();enemies[2].x=760;enemies[2].y=360;player.attackCd=0;attack();for(let i=0;i<20;i++)updateWorld(1/60)');
assert.equal(run('enemies[2].stun'), 0, 'nothing while it recharges');
run('wardTwist.cool=0;enemies[2].x=800;enemies[2].y=400;brickBurst({tx:830,ty:300,serial:0})');
assert.ok(run('enemies[2].stun') > 1.5, 'a brick on the couch works too');
// Tap the room: a tap on the remote is something to go and hit.
run('wardTwist.cool=0;enemies[2].stun=0;enemies[2].x=760;enemies[2].y=360;setControlScheme("tap");player.x=600;player.y=450');
run('wardTouchDown(77,0,0,{x:826,y:258});wardTouchUp(77,0,0)');
assert.equal(run('wardPrey&&wardPrey.e.twist'), true, 'a tap on the remote picks it');
run('for(let i=0;i<120;i++)advanceSimulation(1/60)');
assert.ok(run('enemies[2].stun') > 0.5, 'Macy walks over and whacks it');
// The CT: the lane nearest Macy lights up, then Donut II bowls over everything in it. Macy jumps it.
twistRoom(3, 'makeEnemy(0,300,425),makeEnemy(2,600,430),makeEnemy(0,500,560)');
run('player.x=820;player.y=432;wardTwist.t=WARD_TWIST.donut.first-0.01');
steps(2);
assert.equal(run('wardTwist.phase'), 'warn', 'the lane lights up first');
assert.equal(run('wardTwist.lane'), 425, 'the lane nearest Macy');
assert.equal(run('state.stats.twistTaught'), 8);
run('drawWorld()');
steps(Math.ceil(run('WARD_TWIST.donut.warn') * 60) + 1);
assert.ok(run('!!wardTwist.donut'), 'then the donut rolls');
run('drawWorld()');
run('for(let i=0;i<240&&wardTwist.donut;i++){if(Math.abs(wardTwist.donut.x-player.x)<120&&player.z===0&&player.jumpCd===0)jump();updateWorld(1/60)}');
assert.ok(run('enemies[0].hp<99&&enemies[1].hp<99'), 'both in the lane are bowled over');
assert.equal(run('enemies[2].hp'), 99, 'the one out of the lane is not');
assert.equal(run('state.hp'), 5, 'a jump clears the donut');
run('wardTwist.t=wardTwist.next;player.x=500;player.y=545;player.inv=0;player.z=0;player.jumpCd=0;wardTwist.dir=1');
run('for(let i=0;i<400&&state.hp===5;i++){player.inv=0;updateWorld(1/60)}');
assert.equal(run('state.hp'), 4, 'standing in the lane gets her DONUTTED');
// The ultrasound: gel. Macy slides past where she let go; a gremlin knocked across it skids into the wall.
twistRoom(4, 'makeEnemy(0,640,470),makeEnemy(0,300,300)');
steps(1);
assert.equal(run('state.stats.twistTaught'), 16);
run('drawWorld()');
const [gx, gy] = run('WARD_TWIST.gel.puddles[1]');
assert.ok(run(`wardGrip({x:${gx},y:${gy},z:0})`) > 0, 'the gel is slippery');
assert.equal(run('wardGrip({x:900,y:560,z:0})'), 0, 'the floor is not');
run(`player.x=${gx - 60};player.y=${gy};player.vx=player.vy=0;keys.clear();keys.add('d');for(let i=0;i<30;i++)updateWorld(1/60);keys.clear();globalThis.letGo=player.x`);
run('for(let i=0;i<30;i++)updateWorld(1/60)');
assert.ok(run('player.x-letGo') > 25, 'on gel Macy slides on after letting go');
run('player.x=200;player.y=500;player.vx=player.vy=0;keys.add("d");for(let i=0;i<30;i++)updateWorld(1/60);keys.clear();letGo=player.x;for(let i=0;i<30;i++)updateWorld(1/60)');
assert.ok(run('player.x-letGo') < 1, 'on the floor she stops');
run(`enemies[0].x=${gx - 40};enemies[0].y=${gy};enemies[0].hp=enemies[0].maxHp=3;enemies[0].cool=99;player.x=900;player.y=560;player.vx=player.vy=0`);
run(`enemies[0].iframes=0;hitEnemy(enemies[0],1,30,{kind:"pillow",from:{x:${gx - 80},y:${gy}}});globalThis.skid0=enemies[0].x`);
steps(40);
assert.ok(run('enemies[0].x-skid0') > 90, 'a poke on gel sends a gremlin skidding');
run('enemies[1].x=300;enemies[1].y=300;enemies[1].iframes=0;enemies[1].stun=0;enemies[1].stagger=0;globalThis.dry0=enemies[1].x;hitEnemy(enemies[1],1,30,{kind:"pillow",from:{x:260,y:300}})');
steps(40);
assert.ok(run('enemies[1].x-dry0') < 60, 'the same poke on the floor barely moves it');
run('state.stats={};enemies=[];loadRoom(1)');
console.log('PASS: the MRI pulls bedpans and bruisers into the scanner, the lounge remote zones out the TV crowd, Donut II bowls a lane, and the gel makes everyone slide.');
