// Drip or Die, the recovery ritual: registered as 'recovery' and run in place of the room's arcade on a
// forced run; one gentle phase at one level that never climbs; three strikes and every strike source;
// shrinking windows that stay put; gold chains; the win (hearts back, nothing stamped on the arcade);
// retries that repeat the same recovery; the patch-up price; the explosion outro and its aftermath;
// the portrait (450 × 800) layout; and touch on the canvas itself in both canvas shapes.
const { run, nodes, close, assert } = require('./harness.cjs');
run('let ivSeed=4242;Math.random=()=>{ivSeed=(ivSeed*1664525+1013904223)>>>0;return ivSeed/4294967296}');

// A forced recovery at a level and prescription, through the countdown and into play.
function recover(tier = 0, difficulty = 1, fresh = true) {
  close();
  run(`${fresh ? 'ivRecovery=null;' : ''}state.difficulty=${difficulty};openMini(0,true);mini.tier=${tier};startMini();launchMini();updateMini(3.3)`);
  assert.equal(run('mini.screen'), 'play');
}
// Lines the marker up on the window and taps.
const landDrip = () => run('mini.beatLock=0;mini.ivFumble=0;mini.pos=mini.ivSweep.win.pos;ivTap()');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---- The registry ----
assert.equal(run('games.recovery.id'), 'recovery');
assert.equal(run('games.recovery.info.game'), 'Drip or Die');
assert.equal(run('games[0].info.game'), 'Fastpitch Fever', "the room's arcade is the throwing game");
assert.equal(run('Object.keys(games).includes("recovery")'), false, 'the recovery is not counted as an arcade');
assert.equal(run('games.recovery.music'), 'game:0', 'the recovery keeps the heart-monitor pulse');
assert.equal(run('typeof games.recovery.patchUp'), 'function');
assert.equal(run('typeof games.recovery.patchUpLabel'), 'function');
run('ivRecovery=null;openMini(0,true)');
assert.equal(run('miniGame()===games.recovery'), true, 'a forced run plays the recovery');
assert.equal(nodes.miniTitle.textContent, 'Drip or Die', 'the forced lobby is the recovery');
assert.equal(nodes.miniHeadline.textContent, 'One IV. Then back to the ward.');
for (const copy of [run('games.recovery.info.desc'), ...JSON.parse(run('JSON.stringify(games.recovery.tierNotes)'))])
  assert.doesNotMatch(copy, /—/, 'no em-dashes in the copy');
close();
console.log('PASS: IV recovery registry: its own slot, not an arcade, the heart-monitor music, a patch-up hook.');

// ---- One level, every time ----
// Three strikes on every prescription and level, the same drips, widths and speed at all of them.
const rules = [];
for (let d = 0; d < 3; d++)
  for (let tier = 0; tier < 3; tier++) {
    recover(tier, d);
    assert.equal(run('mini.rules.misses'), 3, `L${tier + 1}/P${d} has 3 strikes`);
    assert.equal(run('mini.tier'), 0, 'the recovery always plays level 1');
    rules.push(run('JSON.stringify([mini.required, mini.limit, ivWidthRange(), ivSpeed()])'));
  }
assert.equal(new Set(rules).size, 1, 'the same gentle phase at every level and prescription');
assert.deepEqual(JSON.parse(rules[0]).slice(0, 2), [8, 48], 'eight drips, 48 seconds');
// The plan never climbs, however many times she collapses.
for (let count = 0; count < 7; count++) {
  close();
  run(`ivRecovery=null;state.recoveries=${count};openMini(0,true)`);
  assert.equal(run('JSON.stringify(ivRecoveryPlan())'), JSON.stringify({ phase: 0, level: 0, count }), `plan for collapse ${count}`);
  assert.equal(run('mini.tier'), 0, 'the lobby offers level 1');
  run('startMini()');
  assert.equal(run('state.recoveries'), count + 1, 'starting a recovery counts the collapse');
  assert.equal(run('mini.required'), 8);
  assert.equal(run('mini.phase'), 0);
}
close();
console.log('PASS: IV recovery is one gentle level at every level, prescription and collapse.');

// ---- Strikes ----
recover();
run('updateMiniHUD()');
assert.equal(nodes.miniLivesLabel.textContent, 'STRIKES');
assert.equal(nodes.miniLives.textContent, '○ ○ ○');
// Idle play: each escaped sweep is a strike, and the third one ends the run in the explosion outro.
const seen = [];
for (let i = 0; i < 3000 && run("mini.screen==='play'"); i++) {
  run('updateMini(.016)');
  const m = run('mini.miss');
  if (m !== seen[seen.length - 1]) seen.push(m);
  if (m === 1 && seen.length === 2) {
    run('updateMiniHUD()');
    assert.equal(nodes.miniLives.textContent, '✕ ○ ○');
    assert.ok(run('mini.flashText').includes('STRIKE 1 OF 3'));
    run('drawMini()');
  }
}
assert.deepEqual(seen, [0, 1, 2, 3], 'strikes count up to 3');
assert.equal(run('mini.screen'), 'outro', 'the third strike ends the run');
assert.equal(run('mini.pendingFinish.win'), false);
// A tap outside the window is a strike; the escape that follows in the same sweep is not a second one.
recover();
run('mini.dir=1;ivNewSweep();mini.beatLock=0;mini.ivFumble=0;mini.pos=mini.ivSweep.win.pos>0.5?0.02:0.98;ivTap()');
assert.equal(run('mini.miss'), 1, 'a tap outside the window is a strike');
assert.ok(run('mini.flashText').includes('MISSED THE DRIP'));
run('mini.pos=0.999;mini.dir=1;mini.ivFumble=0;updateMini(0.05)');
assert.equal(run('mini.miss'), 1, 'one strike per sweep');
console.log('PASS: IV three strikes, filled in on the HUD, and one strike per sweep.');

// ---- The bar ----
recover();
const widths = good => run(`(()=>{mini.good=${good};const w=[];for(let i=0;i<40;i++){ivNewSweep();w.push(mini.ivSweep.width);}return w})()`);
const w0 = widths(0);
assert.ok(w0.every(w => w >= 0.17 && w <= 0.21), 'the first sweep is 0.17 to 0.21 of the bar');
assert.ok(new Set(w0.map(w => w.toFixed(4))).size > 30, 'the width changes from sweep to sweep');
const k4 = Math.pow(0.95, 4);
assert.ok(widths(4).every(w => w >= 0.17 * k4 - 1e-9 && w <= 0.21 * k4 + 1e-9), 'each drip shrinks it a little');
assert.ok(widths(7).every(w => w >= 0.12), 'and never below the floor');
assert.ok(widths(40).every(w => near(w, 0.12)), 'the floor is honest: 12% of the bar');
// The window stays put while the line crosses it, and the line speeds up only a little.
run('mini.good=0;mini.dir=1;ivNewSweep();mini.beatLock=0');
const pos = run('mini.ivSweep.win.pos');
for (let i = 0; i < 20; i++) run('updateMini(1/60)');
assert.equal(run('mini.ivSweep.win.pos'), pos, 'windows never slide');
const v0 = run('mini.good=0;ivSpeed()'),
  v7 = run('mini.good=7;ivSpeed()');
assert.ok(near(v7 / v0, 1.15, 1e-6), 'the line ends 15% faster than it starts');
// Gold centers in a row build the chain; an off-center hit resets it.
recover();
run('mini.ivChain=0');
landDrip();
run('mini.beatLock=0;mini.pos=mini.ivSweep.win.pos+mini.band*0.12;ivTap()');
assert.equal(run('mini.ivChain'), 2);
assert.equal(run('ivChainMult()'), 1.5);
run('mini.beatLock=0;mini.pos=mini.ivSweep.win.pos+mini.band*0.45;ivTap()');
assert.equal(run('mini.ivChain'), 0, 'off-center hits break the chain');
assert.equal(run('mini.good'), 3);
// A tap during the pause between sweeps is ignored, never a strike.
run('mini.beatLock=0.3;mini.pos=0.01;ivTap()');
assert.equal(run('mini.miss'), 0);
// The assist widens the window.
const band = run('ivBand()');
run('miniAction("assist")');
assert.ok(near(run('ivBand()'), band * 1.7), 'WIDEN WINDOWS widens them');
console.log('PASS: IV bar: windows shrink a little, never slide, never get mean; chains and the assist.');

// ---- Out of bed ----
run('state.medals[0]=[2,0,0];state.records[0]=[777,0,0]');
recover();
run('state.hp=0');
const recoveries = run('state.recoveries');
for (let i = 0; i < 8; i++) landDrip();
assert.equal(run('mini.screen'), 'outro', 'eight drips end the recovery');
assert.equal(run('mini.pendingFinish.win'), true);
run('updateMini(2.3)');
assert.equal(run('mini.win'), true);
assert.ok(run('state.hp') >= 3, 'hearts restored');
assert.ok(run('Number.isFinite(mini.qualityFinal)') && run('mini.qualityFinal') > 0, 'a real score');
assert.equal(run('JSON.stringify(state.medals[0])'), '[2,0,0]', "no medal stamped on the room's arcade");
assert.equal(run('JSON.stringify(state.records[0])'), '[777,0,0]', 'and no best score either');
assert.equal(run('ivRecovery'), null, 'the next collapse is a new recovery');
assert.equal(run('state.recoveries'), recoveries, 'a won recovery keeps the count');
run('mini.forced=false');
close();
// A retry after an explosion is the same recovery: no new collapse counted, the same gentle phase.
recover();
const counted = run('state.recoveries');
for (let retry = 0; retry < 2; retry++) {
  run('finishMini(false);updateMini(2.3)');
  assert.equal(run('mini.screen'), 'result');
  assert.equal(run('$("miniRetry").textContent'), 'Reassemble. Try again.');
  nodes.miniRetry.events.click();
  assert.equal(run('mini.forced'), true, 'Retry stays in the recovery');
  run('startMini();launchMini();updateMini(3.3)');
  assert.equal(run('mini.required'), 8);
  assert.equal(run('state.recoveries'), counted, 'retries do not count as collapses');
}
run('mini.forced=false');
close();
console.log('PASS: IV recovery wins restore hearts and stamp nothing; retries repeat the same recovery.');

// ---- The patch-up ----
// A lost recovery can end from the result screen for 15% of her coins, rounded down, never below zero.
for (const [coins, cost] of [[200, 30], [99, 14], [6, 0], [0, 0]]) {
  run(`state.coins=${coins}`);
  assert.equal(run('ivPatchCost()'), cost, `${coins} coins cost ${cost}`);
  assert.equal(run('games.recovery.patchUpLabel()'), cost ? `Get patched up · ${cost} coins` : 'Get patched up · free');
}
recover();
run('state.hp=0;state.coins=99;state.medals[0]=[1,0,0];finishMini(false);updateMini(2.3)');
assert.match(nodes.resultText.textContent, /14 coins/, 'the result says what it costs');
assert.equal(nodes.miniBack.textContent, 'Get patched up · 14 coins');
const medals = run('JSON.stringify(state.medals)'),
  earned = run('state.coinsEarned');
run('leaveMini()');
assert.equal(run('mini.open'), false, 'the patch-up ends the recovery');
assert.equal(run('state.coins'), 85, 'it costs 14 of 99 coins');
assert.ok(run('state.hp') >= 1, 'she gets at least one heart');
assert.equal(run('JSON.stringify(state.medals)'), medals, 'never progress or medals');
assert.equal(run('state.coinsEarned'), earned, 'lifetime earnings are untouched');
assert.match(nodes.toast.textContent, /14 coins/, 'the toast says what it cost');
// Broke: free, and the wallet stays at zero.
recover();
run('state.hp=0;state.coins=0;finishMini(false);updateMini(2.3);leaveMini()');
assert.equal(run('state.coins'), 0, 'never below zero');
assert.equal(run('mini.open'), false);
// Before the result screen there is no way out.
recover();
run('leaveMini()');
assert.equal(run('mini.open'), true, 'a recovery in progress cannot be skipped');
run('mini.forced=false');
close();
console.log('PASS: IV patch-up: 15% of coins rounded down, never below zero, never medals, said out loud.');

// ---- The explosion ----
function lose() {
  recover();
  run('finishMini(false)');
  // The outro draws every stage of the build-up and the burst.
  for (let t = 0; t <= 2.2; t += 0.05) run(`mini.transition=${t};drawMini()`);
  run('mini.transition=0;updateMini(2.3)');
  assert.equal(run('mini.screen'), 'result');
  assert.equal(run('mini.win'), false);
  return {
    word: run('mini.ivWord'),
    heading: run('$("resultHeading").textContent'),
    heart: run("(p=>[Math.round(p.lx),Math.round(p.ly)])(gore.find(p=>p.organ==='heart'))").join()
  };
}
const first = lose();
assert.ok(run('gore.length') > 30, 'the loss populates gore');
assert.ok(run('gore.every(p=>p.iv)'), 'only the new aftermath');
assert.equal(run("gore.filter(p=>p.kind==='organ').map(p=>p.organ).sort().join()"), 'heart,kidney,kidney,liver,lung,spleen,stomach');
for (const kind of ['guts', 'spine', 'brain', 'tooth', 'splat', 'pile', 'scrunchie', 'slipper', 'smoke'])
  assert.ok(run(`gore.some(p=>p.kind==='${kind}')`), 'aftermath has ' + kind);
const snap = () => run('JSON.stringify(gore.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2)]))');
run('drawResultArt()');
const a = JSON.parse(snap());
run('updateMini(0.1);drawResultArt()');
const b = JSON.parse(snap());
assert.ok(a.filter((v, i) => v[0] !== b[i][0] || v[1] !== b[i][1]).length > 10, 'particles move between frames');
for (let i = 0; i < 480; i++) run('updateMini(1/60);drawResultArt()');
const still = "['organ','tooth','spine','pile','scrunchie','splat','brain','guts','eye','slipper']";
const settled = () => run(`JSON.stringify(gore.filter(p=>${still}.includes(p.kind)).map(p=>[p.x.toFixed(2),p.y.toFixed(2)]))`);
const s1 = settled();
for (let i = 0; i < 60; i++) run('updateMini(1/60);drawResultArt()');
assert.equal(settled(), s1, 'the aftermath settles; only the loop keeps moving');
assert.equal(run("gore.filter(p=>p.kind==='eye').length"), 2, 'exactly two eyeballs');
assert.ok(run('gore.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=800&&p.y>=0&&p.y<=220)'), 'bounded');
assert.equal(run('games.recovery.resultArt(mc)'), true);
// The second viewing lands differently.
const second = lose();
assert.notEqual(second.word, first.word, 'new burst word');
assert.notEqual(second.heart, first.heart, 'organs land elsewhere');
assert.notEqual(second.heading, first.heading, 'new result copy');
run('mini.forced=false');
close();
// A win never draws the aftermath.
recover();
for (let i = 0; i < 8; i++) landDrip();
run('updateMini(2.3)');
assert.equal(run('games.recovery.resultArt(mc)'), false);
run('mini.forced=false');
close();
console.log('PASS: IV explosion outro, aftermath animation, settling, two eyeballs, and a different second viewing.');

// ---- Portrait ----
// On an upright phone the framework sets mini.portrait and sizes the canvas 450 × 800; the game draws its
// own tall layout and asks every frame, since a rotation can flip it mid-run. A recording context follows
// translate/scale/rotate so every word drawn can be checked against the canvas that is up.
recover();
assert.equal(run('JSON.stringify(ivCanvas())'), '{"w":800,"h":450}', 'landscape until the framework says otherwise');
assert.equal(run('JSON.stringify(games.recovery.portraitCanvas)'), '{"w":450,"h":800}');
run(`globalThis.ivRec = { on: false, texts: [], m: [1, 0, 0, 1, 0, 0], stack: [] };
mc.save = () => ivRec.stack.push(ivRec.m.slice());
mc.restore = () => { if (ivRec.stack.length) ivRec.m = ivRec.stack.pop(); };
mc.translate = (x, y) => { const m = ivRec.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; };
mc.scale = (x, y) => { const m = ivRec.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; };
mc.rotate = a => {
  const [a0, b0, c0, d0] = ivRec.m, c = Math.cos(a), s = Math.sin(a);
  ivRec.m = [a0 * c + c0 * s, b0 * c + d0 * s, c0 * c - a0 * s, d0 * c - b0 * s, ivRec.m[4], ivRec.m[5]];
};
mc.setTransform = () => { ivRec.m = [1, 0, 0, 1, 0, 0]; ivRec.stack = []; };
mc.fillText = (t, x, y) => {
  if (!ivRec.on) return;
  const m = ivRec.m;
  ivRec.texts.push([String(t), m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
};`);
function frameTexts() {
  run('ivRec.on=true;ivRec.texts=[];ivRec.m=[1,0,0,1,0,0];ivRec.stack=[];drawMini();ivRec.on=false');
  const { w, h } = JSON.parse(run('JSON.stringify(ivCanvas())'));
  const texts = JSON.parse(run('JSON.stringify(ivRec.texts)'));
  return { texts, off: texts.filter(([, x, y]) => x < 0 || x > w || y < -40 || y > h) };
}
function upright(on) {
  if (on) run('mini.portrait=true;configureCanvas($("miniCanvas"),450,800)');
  else run('mini.portrait=false;configureCanvas($("miniCanvas"),800,450)');
}
function onCanvas(what) {
  const { texts, off } = frameTexts();
  assert.deepEqual(off, [], what + ': every word lands on the canvas');
  return texts;
}
run(`globalThis.ivBotTick = function () {${require('./bots/iv.cjs').policy}}`);
// Briefing to play, with the bot playing and the phone turning every so often.
close();
run('ivRecovery=null;state.difficulty=1;openMini(0,true);startMini()');
upright(true);
onCanvas('portrait briefing');
run('launchMini();updateMini(0.5)');
onCanvas('portrait intro');
run('updateMini(3)');
let low = false;
for (let i = 0; i < 600 && run("mini.screen==='play'"); i++) {
  run('ivBotTick();updateMini(1/60)');
  if (i % 150 === 149) upright(!run('mini.portrait'));
  if (i % 9) continue;
  const tall = run('!!mini.portrait');
  const texts = onCanvas(`${tall ? 'portrait' : 'landscape'} frame ${i}`);
  if (tall && texts.some(([, x, y]) => y > 600 && x < 450)) low = true;
}
assert.ok(low, 'the tall layout uses the bottom of the canvas');
recover();
upright(true);
run('mini.beatLock=0;mini.pos=mini.ivSweep.win.pos;mini.ivChain=2');
assert.ok(onCanvas('portrait hint').some(([t]) => t === 'NOW!'), 'the hint shouts NOW! on the tall bar');
run("mini.flash=0.5;mini.flashText='MISSED THE DRIP  ·  STRIKE 1 OF 3'");
onCanvas('portrait flash');
// The explosion has its own upright composition, from the build-up through the burst.
for (const tall of [true, false]) {
  recover();
  upright(tall);
  run('finishMini(false)');
  const words = new Set();
  for (let t = 0; t <= 2.2; t += 0.05) {
    run(`mini.transition=${t}`);
    for (const [word] of onCanvas(`${tall ? 'portrait' : 'landscape'} outro at ${t.toFixed(2)} s`)) words.add(word);
  }
  for (const word of ['MMMF!', 'STAND BACK!', run('mini.ivWord')]) assert.ok(words.has(word), `the outro says ${word}`);
  assert.equal(run('ivBoomStage().w'), tall ? 450 : 800);
}
run('mini.forced=false');
close();
console.log('PASS: IV portrait: both shapes, rotation mid-run, the hint, and the explosion.');

// ---- Touch: the finger is the button ----
const down = (x, y) => run(`arcadeDown({x:${x},y:${y}})`);
const up = cancel => run(`arcadeUp(${cancel})`);
for (const tall of [false, true]) {
  const [W, H] = tall ? [450, 800] : [800, 450];
  const shape = tall ? 'portrait' : 'landscape';
  recover();
  upright(tall);
  run('mini.beatLock=0;mini.pos=mini.ivSweep.win.pos');
  down(W * 0.1, H * 0.9);
  assert.equal(run('mini.good'), 1, shape + ': a tap anywhere lands the drip');
  assert.equal(run('JSON.stringify(mini.ivRipples.map(r=>[r.x,r.y,r.tall]))'), JSON.stringify([[W * 0.1, H * 0.9, tall]]), shape + ': a ripple marks it');
  onCanvas(shape + ' ripple');
  up(false);
  assert.equal(run('mini.good'), 1, shape + ': lifting the finger does nothing');
  run('mini.beatLock=0;mini.ivFumble=0;mini.pos=mini.ivSweep.win.pos>0.5?0.02:0.98');
  down(W / 2, H / 2);
  assert.equal(run('mini.miss'), 1, shape + ': a bad tap is a strike, same as the button');
  up(true);
  assert.equal(run('mini.miss') + run('mini.good'), 2, shape + ': a cancelled touch never acts');
  for (let i = 0; i < 30; i++) run('updateMini(1/60)');
  assert.equal(run('mini.ivRipples.length'), 0, shape + ': ripples fade');
}
assert.match(run('games.recovery.lesson().control'), /screen/, 'the briefing says the screen is the button');
assert.match(nodes.miniInstruction.textContent, /screen/, 'so does the hint');
run('mini.forced=false');
close();
for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'setTransform', 'fillText']) run(`delete mc.${k}`);
console.log('PASS: IV touch: tap anywhere, ripples, cancels never act.');

// ---- The bot gets out of bed on every prescription and level ----
for (let d = 0; d < 3; d++)
  for (let tier = 0; tier < 3; tier++) {
    recover(tier, d);
    const r = JSON.parse(
      run(`(()=>{for(let n=0;n<20000&&mini.screen!=='result';n++){if(mini.screen==='play')ivBotTick();updateMini(1/60);}return JSON.stringify({win:mini.win,miss:mini.miss});})()`)
    );
    assert.equal(r.win, true, `P${d} L${tier + 1}: the bot wins the recovery (${r.miss} strikes)`);
    run('mini.forced=false');
  }
close();
run('ivRecovery=null;state.recoveries=0');
console.log('PASS: IV recovery bot wins every prescription and level.');
