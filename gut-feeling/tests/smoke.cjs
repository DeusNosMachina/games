// Smoke checks for the game registry: every game opens, starts, launches, plays, finishes and draws
// at every stage without throwing, and the ward draws in every room.
const { run, close, assert } = require('./harness.cjs');

const REQUIRED = ['init', 'update', 'draw', 'assist', 'lesson', 'scene', 'statLabel', 'stat', 'tactics', 'assistText'];
assert.equal(run('Object.keys(games).join()'), '0,1,2,3,4,5');
for (let id = 0; id < 6; id++) {
  assert.equal(run(`games[${id}].id`), id);
  assert.ok(run(`games[${id}].canvas.w>0&&games[${id}].canvas.h>0`), `game ${id} canvas`);
  assert.equal(run(`games[${id}].tierNotes.length`), 3, `game ${id} tier notes`);
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
