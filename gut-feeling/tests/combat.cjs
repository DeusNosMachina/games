// Ward combat rules: weapon dispatch, staggers and poise, breed behaviors, spawns, waves, Ralph's grudge,
// Ralph himself, and a tuning check that mashing loses while dodging wins.
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

run('let rng=1873;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296};begin();drawWorld();state.hp=5');

// ---- Weapons ----
freshRoom(1);
run('player.x=500;player.y=420;enemies=[makeEnemy(0,560,420)];attack()');
assert.equal(run('enemies[0].hp'), 3);
run('updateWorld(.17)');
assert.equal(run('enemies[0].hp'), 2, 'the pillow lands on its hit frame, not on the press');
run('player.attackCd=0;equip(1);attack()');
assert.equal(run('projectiles.at(-1).kind'), 'bag');
assert.equal(run('player.attackKind'), 1);
run('player.attackCd=0;equip(2);attack()');
assert.equal(run('projectiles.at(-1).kind'), 'brick');
assert.equal(run('player.attackKind'), 2);
run('equip(0);projectiles=[]');
console.log('PASS: equipped weapon dispatch and delayed pillow hits.');

// ---- Hits stagger; only finishers, spins, bricks, stomps and traps stun ----
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
steps(90);
assert.ok(run('projectiles.some(p=>p.gunk&&!p.friendly)||puddles.some(p=>p.gunk)'), 'the hurler lobs gunk');
run('projectiles=[];puddles=[];combatFx=[]');
console.log('PASS: pillow deflection and the gunk-lobbing hurler.');

// ---- Damage, jumping and the forced IV ----
run('enemies=[];player.inv=0;player.shield=0;player.z=30;damage("blob",{x:600,y:420})');
assert.equal(run('state.hp'), 5, 'a high jump clears blobs');
run('player.z=0;damage("blob",{x:600,y:420})');
assert.equal(run('state.hp'), 4);
assert.ok(run('player.vomit>0'));
run('state.upgrades.push("thickskin");player.inv=0;state.hp=5;damage("blob",{x:600,y:420})');
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
// Leaving mid-fight and coming back resumes the same wave instead of restarting.
run('encounter.wave=2;spawnWave(1);loadRoom(2);loadRoom(1)');
assert.equal(run('encounter.wave'), 2, 'fights persist across room changes');
console.log('PASS: calm cleared rooms, escalating grudge rematches with bigger payouts, repellent, and fight persistence.');

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

function playBot(policy, seconds, seed) {
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

// ---- Keyboard dispatch still reaches the ward ----
run('state.ralphReady=false;loadRoom(0);player.attackCd=0;player.vomit=0');
events.keydown({ key: '2', target: {}, repeat: false, preventDefault: () => {} });
assert.equal(run('state.item'), 1);
events.keydown({ key: ' ', target: {}, repeat: false, preventDefault: () => {} });
run('updateWorld(.01)');
assert.equal(run('projectiles.at(-1).kind'), 'bag');
run('keys.clear()');
assert.ok(nodes.rematchBtn, 'the ward strip exists');
console.log('PASS: number-key equipment and Space dispatch.');
