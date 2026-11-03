// Smoke checks for the game registry: every game opens, starts, launches, plays, finishes and draws
// at every stage without throwing, and the ward draws in every room.
const { run, nodes, close, assert } = require('./harness.cjs');

const REQUIRED = ['init', 'update', 'draw', 'assist', 'lesson', 'scene', 'statLabel', 'stat', 'tactics', 'assistText'];
assert.equal(run('Object.keys(games).join()'), '0,1,2,3,4,5');
for (let id = 0; id < 6; id++) {
  assert.equal(run(`games[${id}].id`), id);
  assert.ok(run(`games[${id}].canvas.w>0&&games[${id}].canvas.h>0`), `game ${id} canvas`);
  assert.equal(run(`games[${id}].tierNotes.length`), run(`miniTierCount(games[${id}])`), `game ${id} tier notes`);
  for (const key of ['game', 'genre', 'headline', 'desc']) assert.equal(run(`typeof games[${id}].info.${key}`), 'string', `game ${id} info.${key}`);
  for (const hook of REQUIRED) assert.equal(run(`typeof games[${id}].${hook}`), 'function', `game ${id} is missing ${hook}()`);
}
console.log('PASS: six registered games with the required hooks and copy.');

for (let id = 0; id < 6; id++) {
  for (const outcome of [false, true]) {
    run(`state.difficulty=1;openMini(${id})`);
    assert.equal(run('mini.screen'), 'lobby');
    run('startMini();drawMini()');
    assert.equal(run('mini.screen'), 'briefing', `game ${id} briefing`);
    run('launchMini();drawMini()');
    assert.equal(run('mini.screen'), 'intro', `game ${id} intro`);
    run('updateMini(3.3);drawMini()');
    assert.equal(run('mini.screen'), 'play', `game ${id} play`);
    for (let i = 0; i < 90; i++) run('updateMini(.05);drawMini()');
    run("miniAction('assist');drawMini();pauseMini();drawMini();pauseMini()");
    if (run("mini.screen==='play'")) run(`finishMini(${outcome});drawMini()`);
    run('updateMini(2.3)');
    assert.equal(run('mini.screen'), 'result', `game ${id} result`);
    run('updateMini(.5);drawResultArt()');
    close();
  }
}
console.log('PASS: every game opens, starts, launches, plays, finishes, and draws (win and loss).');

run('begin()');
for (let room = 0; room < 6; room++) {
  run(`goRoom(${room})`);
  assert.equal(run('state.room'), room);
  run('drawWorld()');
  for (let i = 0; i < 30; i++) run('advanceSimulation(1/60);drawWorld()');
}
console.log('PASS: the ward draws in all six rooms.');

// Wide screens (arcade landscape, fullscreen desktop) follow Macy vertically; a room change plays the iris.
run('viewport.w=1000;viewport.h=462;loadRoom(2);player.y=560');
assert.ok(run('wardIris') > 0, 'room change starts the iris');
for (let i = 0; i < 40; i++) run('advanceSimulation(1/60);drawWorld()');
assert.ok(run('wardCameraY') > 50, 'camera follows Macy down a short viewport');
assert.equal(run('wardIris'), 0, 'iris finishes');
run('viewport.w=640;viewport.h=625;drawWorld();resize();drawWorld()');
assert.equal(run('viewport.h'), 625);
// A tall portrait stage still shows 540 px of the room and centers it between two bands.
const stageRect = nodes.stage.getBoundingClientRect;
nodes.stage.getBoundingClientRect = () => ({ width: 390, height: 700, left: 0, top: 0 });
run('resize()');
assert.equal(run('viewport.w'), 540);
assert.ok(Math.abs(run('viewport.h') - (540 * 700) / 390) < 0.01);
for (let i = 0; i < 60; i++) run('advanceSimulation(1/60);drawWorld()');
assert.ok(run('wardCameraY') < -150, 'the room sits in the middle of a tall view');
nodes.stage.getBoundingClientRect = stageRect;
run('resize()');
console.log('PASS: vertical camera, narrow and tall viewports, and the room iris draw.');

// Pause menu, arcade mode, sound, shop, Hall of Nonsense and the Daily Dose card run without a browser.
run('setWardPause(true);drawWorld()');
assert.equal(run('state.paused'), true);
run('setWardPause(false);drawWorld()');
assert.equal(run('state.paused'), false);
run('enterArcade(true);exitArcade();uiToggleSound();uiToggleSound();showShop();renderHall();renderDaily();openMap()');
assert.match(run('$("hallStats").innerHTML'), /Gremlins evicted/);
assert.match(run('$("dailyCard").innerHTML'), /DAILY DOSE/);
close();
console.log('PASS: pause menu, arcade toggle, sound toggle, shop, hall and daily cards render.');

// Every game runs as a Daily Dose with its GO card. Combat may lock uncleared wards; open them here.
run('var realWardLocked = typeof wardLocked === "function" ? wardLocked : undefined; wardLocked = () => false');
const covered = new Set();
for (let day = 1; covered.size < 6 && day < 200; day++) {
  const date = new Date(Date.UTC(2026, 10, day)).toISOString().slice(0, 10);
  const id = run(`dailyPick('${date}').id`);
  if (covered.has(id)) continue;
  covered.add(id);
  run(`openDaily('${date}');startMini();drawMini()`);
  assert.equal(run('mini.daily'), true);
  run('updateMini(5);drawMini()');
  assert.equal(run('mini.screen'), 'intro', `daily ${id} GO card`);
  for (let i = 0; i < 40; i++) run('updateMini(.05);drawMini()');
  assert.equal(run('mini.screen'), 'play', `daily ${id} play`);
  run('finishMini(true);updateMini(2.3);drawResultArt()');
  assert.equal(run('mini.screen'), 'result');
  close();
}
run('wardLocked = realWardLocked');
assert.equal(covered.size, 6, 'daily picks reach every game');
console.log('PASS: every game runs as a Daily Dose.');

// Portrait canvases are optional. A game that declares one must be taller than wide and must run on it.
let portraitGames = 0;
for (let id = 0; id < 6; id++) {
  if (!run(`!!games[${id}].portraitCanvas`)) continue;
  portraitGames++;
  const tall = `games[${id}].portraitCanvas.w>0&&games[${id}].portraitCanvas.h>games[${id}].portraitCanvas.w`;
  assert.ok(run(tall), `game ${id} portraitCanvas is taller than wide`);
  run(`window.innerWidth=390;window.innerHeight=844;state.difficulty=1;openMini(${id});startMini();drawMini()`);
  assert.equal(run('mini.portrait'), true, `game ${id} picks its portrait canvas`);
  run('launchMini();drawMini();updateMini(3.3);drawMini()');
  for (let i = 0; i < 90; i++) run('updateMini(.05);drawMini()');
  run('if(mini.screen==="play")finishMini(false);drawMini();updateMini(2.3)');
  assert.equal(run('mini.screen'), 'result', `game ${id} finishes in portrait`);
  close();
  run('delete window.innerWidth;delete window.innerHeight;resize()');
}
console.log(`PASS: ${portraitGames} game(s) with a portrait canvas run on it.`);

// The ward draws tap-the-room marks (ripple, walk line, prey ring) and the weapon flash, in both schemes.
run('begin();setControlScheme("tap");loadRoom(1);enemies=[makeEnemy(0,700,450)];wardRipples.push({x:500,y:400,t:0})');
run('wardSetGoal({x:300,y:450});wardPrey={e:enemies[0],held:true,swings:0,idle:0};advanceSimulation(1/60);drawWorld()');
run('wardWeaponFlash=1;equip(2);drawWorld();setControlScheme("stick");drawWorld();setControlScheme("tap");equip(0)');
console.log('PASS: the ward draws touch marks and the weapon flash under both control schemes.');
