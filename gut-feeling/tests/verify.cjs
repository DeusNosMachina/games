// Cross-cutting rules: saves, nutrients, run lifecycle, frame-rate independence, idle failure, discharge,
// briefings and countdown, Daily Dose, the gift shop, hearts, and ward gating.
// Game-specific mechanics live in game-<name>.cjs; ward combat in combat.cjs.
const { run, nodes, events, close, assert } = require('./harness.cjs');
const saved = () => JSON.parse(run('localStorage.getItem(STORE)'));
const key = (k, extra = {}) => events.keydown({ key: k, target: {}, repeat: false, preventDefault: () => {}, ...extra });
// Combat defines wardLocked() after merge; keep the arcades open unless a test says otherwise.
run('var realWardLocked = typeof wardLocked === "function" ? wardLocked : undefined; wardLocked = () => false');
run('let rng=1873;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
assert.equal(run('rooms.length'), 6);
assert.equal(run('Object.keys(games).length'), 6);

run('begin();drawWorld();state.hp=5;player.x=381;player.y=463;updateWorld(.016)');
assert.equal(run('state.food'), 1);
run('loadRoom(0);player.x=381;player.y=463;updateWorld(.016);eat()');
assert.equal(run('state.food'), 1);
run('state.hp=3;eat()');
assert.equal(run('state.hp'), 4);
assert.equal(run('state.food'), 0);
console.log('PASS: nutrients and eating.');

// Simulation clocks cannot run through briefings, pause or results; rewards pay exactly once.
const INTRO = run('INTRO_SECONDS');
run('openMini(1);startMini()');
assert.equal(run('mini.screen'), 'briefing');
assert.equal(run('mini.quickBrief'), false);
run('updateMini(10)');
assert.equal(run('mini.screen'), 'briefing', 'a first briefing waits for the player');
assert.equal(run('mini.phaseTime'), 0);
run(`launchMini();updateMini(${INTRO - 0.1})`);
assert.equal(run('mini.screen'), 'intro');
run('updateMini(.11)');
assert.equal(run('mini.screen'), 'play');
run('updateMini(.1);pauseMini()');
const frozen = run('mini.phaseTime');
run('updateMini(30)');
assert.equal(run('mini.phaseTime'), frozen);
run('pauseMini()');
run('finishMini(true)');
const money = run('state.coins');
run('miniAction("assist");leaveMini();updateMini(2)');
assert.equal(run('mini.screen'), 'outro');
assert.equal(run('state.coins'), money);
run('updateMini(.21)');
assert.equal(run('mini.screen'), 'result');
const paid = run('state.coins');
run('resolveMiniResult(true)');
assert.equal(run('state.coins'), paid);
assert.equal(run('state.coinsEarned'), paid, 'arcade pay counts as lifetime coins');
assert.equal(run('state.runs'), 1);
close();
console.log('PASS: paused briefings/countdowns, single reward payout, lifetime coins and runs.');

// The countdown is 1.5 s (3, 2, 1, GO!); reduced-motion players keep 3.2 s.
assert.equal(INTRO, 1.5);
run('openMini(3);startMini();launchMini()');
assert.deepEqual(
  [0, 0.45, 0.85, 1.25].map(t => run(`countdownLabel(${t})`)),
  ['3', '2', '1', 'GO!']
);
run('updateMini(1.45)');
assert.equal(run('mini.screen'), 'intro');
run('updateMini(.06)');
assert.equal(run('mini.screen'), 'play');
close();
console.log('PASS: 1.5-second countdown.');

// Each game (and each IV phase) gets the full briefing once, then a 1.2 s GO card that can be skipped.
run('openMini(2);startMini()');
assert.equal(run('mini.quickBrief'), false);
run('launchMini()');
assert.ok(saved().briefed.includes('2:0'), 'briefing persisted');
close();
const QUICK = run('QUICK_BRIEF_SECONDS');
assert.equal(QUICK, 1.2);
run('openMini(2);startMini()');
assert.equal(run('mini.screen'), 'briefing');
assert.equal(run('mini.quickBrief'), true);
run(`updateMini(${QUICK - 0.05})`);
assert.equal(run('mini.screen'), 'briefing');
run('updateMini(.1)');
assert.equal(run('mini.screen'), 'intro', 'the GO card launches itself');
close();
run('openMini(2);startMini()');
nodes.miniGo.events.click();
assert.equal(run('mini.screen'), 'intro', 'tapping the GO card skips it');
close();
run(`openMini(0);startMini();launchMini();updateMini(${INTRO + 0.01});ivPhase(1)`);
assert.equal(run('mini.screen'), 'briefing');
assert.equal(run('mini.quickBrief'), false, 'a new IV phase gets its own full briefing');
run('launchMini()');
assert.ok(saved().briefed.includes('0:1'));
close();
console.log('PASS: briefings show in full once per game and IV phase, then a skippable GO card.');

// Every game, tier and prescription has finite physics and fails when idle.
for (let d = 0; d < 3; d++)
  for (let id = 0; id < 6; id++)
    for (let tier = 0; tier < 3; tier++) {
      run(`state.difficulty=${d};openMini(${id});mini.tier=${tier};startMini();drawMini();launchMini();updateMini(3.3)`);
      assert.ok(run('mini.limit') >= 30, `${id}/${tier}/${d} limit`);
      for (let n = 0; n < 4000 && run('mini.screen') === 'play'; n++) run('updateMini(.1)');
      if (run('mini.screen') === 'outro') run('updateMini(2.3)');
      assert.equal(run('mini.screen'), 'result', `${id}/${tier}/${d}`);
      assert.equal(run('mini.win'), false, `${id}/${tier}/${d} idle won`);
      close();
    }
console.log('PASS: all 54 game/tier/difficulty combinations reject idle play.');

// 30/60/120 Hz must produce the same movement distance.
let xs = [];
for (const hz of [30, 60, 120]) {
  run('state.started=true;loadRoom(0);player.x=430;player.y=480;player.vomit=0;player.dash=0;keys.clear();keys.add("d")');
  for (let i = 0; i < hz; i++) run(`advanceSimulation(${1 / hz})`);
  xs.push(run('player.x'));
}
assert.ok(Math.max(...xs) - Math.min(...xs) < 0.01);
run('keys.clear()');
console.log('PASS: frame-rate-independent movement.');

// Daily Dose: the date picks the game and level, and a seeded RNG makes the day's run identical.
const dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-12-25'];
let normalRunsDiffer = false;
for (const date of dates) {
  const pick = JSON.parse(run(`JSON.stringify(dailyPick('${date}'))`));
  assert.equal(run(`JSON.stringify(dailyPick('${date}'))`), JSON.stringify(pick));
  assert.ok(pick.id >= 0 && pick.id < 6 && pick.tier >= 0 && pick.tier < 3, date);
  const snapshot = daily => {
    if (daily) run(`openDaily('${date}')`);
    else run(`openMini(${pick.id});mini.tier=${pick.tier};mini.approach=1`);
    assert.equal(run('mini.daily'), daily);
    run('startMini();launchMini();updateMini(2)');
    assert.equal(run('mini.screen'), 'play', `${date} daily=${daily}`);
    if (daily) {
      assert.equal(run('mini.tier'), pick.tier);
      assert.equal(run('mini.helps'), 0, 'Show-off rules: no assists');
    }
    for (let i = 0; i < 60; i++) run('updateMini(.05)');
    const snap = run('JSON.stringify(mini)');
    close();
    return snap;
  };
  const first = snapshot(true);
  run('for(let i=0;i<17;i++)Math.random()');
  assert.equal(snapshot(true), first, `${date}: two daily runs must match`);
  const normal = snapshot(false);
  run('for(let i=0;i<5;i++)Math.random()');
  if (snapshot(false) !== normal) normalRunsDiffer = true;
}
assert.ok(normalRunsDiffer, 'ordinary runs still use the shared Math.random');
assert.equal(typeof run('Math.random()'), 'number', 'Math.random restored after daily hooks');
console.log('PASS: Daily Dose picks are deterministic and two runs of the same day spawn identically.');

// Daily bonus pays once per day; consecutive days build a streak.
run("state.daily={last:'',best:0,streak:0}");
// Returns the daily bonus a winning run paid on top of its normal reward.
const runDaily = date => {
  const before = run('state.coins');
  run(`openDaily('${date}');startMini();launchMini();updateMini(2);finishMini(true);updateMini(2.3)`);
  assert.equal(run('mini.screen'), 'result');
  const bonus = run('state.coins') - before - run('mini.reward.pay');
  close();
  return bonus;
};
assert.equal(runDaily('2026-11-01'), run('DAILY_BONUS_BASE'));
assert.equal(run('state.daily.last'), '2026-11-01');
assert.equal(run('state.daily.streak'), 1);
assert.equal(runDaily('2026-11-01'), 0, 'bonus only on the first run of a day');
assert.equal(runDaily('2026-11-02'), run('DAILY_BONUS_BASE+DAILY_BONUS_STEP'), 'streak raises the bonus');
assert.equal(run('state.daily.streak'), 2);
assert.equal(saved().daily.streak, 2);
assert.equal(saved().daily.last, '2026-11-02');
console.log('PASS: daily bonus once per day, streaks, and local best saved.');

// Gift shop: eight upgrades, three wardrobe items, all saved.
run("state.coins=5000;state.hp=5;state.upgrades=[];state.cosmetics={owned:[],worn:[]};hud()");
assert.equal(run('upgrades.length'), 8);
assert.equal(run('wardrobe.length'), 3);
assert.ok(run("['slippers','pillow','bag'].every(id=>upgrades.some(u=>u.id===id))"), 'original upgrades kept');
assert.equal((nodes.hearts.innerHTML.match(/<svg/g) || []).length, 5);
assert.equal(run("buyItem('scrunchie')"), true);
assert.equal(run('state.coins'), 5000 - 420);
assert.equal(run("buyItem('scrunchie')"), false, 'no double purchase');
assert.equal(run('maxHearts()'), 6);
assert.equal(run('state.hp'), 6, 'the sixth heart arrives full');
assert.equal((nodes.hearts.innerHTML.match(/<svg/g) || []).length, 6, 'six-heart HUD');
run('state.hp=5;hud()');
assert.equal((nodes.hearts.innerHTML.match(/class="empty"/g) || []).length, 1);
run('state.food=1;eat()');
assert.equal(run('state.hp'), 6, 'eating fills the sixth heart');
assert.equal(run("buyItem('snacks')"), true);
assert.equal(run('maxFood()'), 5);
assert.match(nodes.foodCount.textContent, /\/ 5$/);
assert.equal(run("buyItem('pass')"), true);
run('openMini(1);mini.approach=0;startMini()');
assert.equal(run('mini.helps'), 3, 'Arcade pass adds a Steady hands assist');
close();
assert.equal(run("buyItem('thick')"), true);
run('state.hp=4;loadRoom(0);player.inv=0;player.shield=0;player.z=0;damage("blob",{x:600,y:450});updateWorld(.01)');
assert.ok(run('player.inv') > 2.5, 'Thick skin lengthens invulnerability');
assert.equal(run("buyItem('look-hoodie')"), true);
assert.ok(run("state.cosmetics.worn.includes('look-hoodie')"));
assert.equal(run('macyLook().hoodie===MACY_VARSITY'), true);
run("toggleWear('look-hoodie')");
assert.equal(run('macyLook().hoodie===MACY_HOODIE'), true);
assert.equal(run("buyItem('look-socks')"), true);
assert.equal(run('macyLook().socks'), 'stitch');
run('showShop();drawPortrait()');
const shopSave = saved();
assert.deepEqual(shopSave.upgrades, ['scrunchie', 'snacks', 'pass', 'thick']);
assert.deepEqual(shopSave.cosmetics, { owned: ['look-hoodie', 'look-socks'], worn: ['look-socks'] });
close();
console.log('PASS: shop purchases, six-heart HUD, upgrade effects, and wardrobe saving.');

// The sixth passport stamp participates in discharge, Ralph guards the exit, and mandatory IV cannot be skipped.
run('state.won=false;state.ralph=false;state.ralphReady=false;state.medals=rooms.map((_,i)=>i<5?[3,i===0?1:0,0]:[0,0,0]);checkDischarge()');
assert.equal(run('state.won'), false);
assert.equal(run('state.ralphReady'), false);
run('state.medals[5][0]=1;checkDischarge()');
assert.equal(run('state.won'), false, 'Ralph still blocks the exit');
assert.equal(run('state.ralphReady'), true);
assert.equal(saved().ralphReady, true);
assert.match(nodes.dischargeRules.textContent, /Ralph is blocking the exit/);
run('state.ralph=true;checkDischarge()');
assert.equal(run('state.won'), true);
assert.equal(nodes.winDialog.open, true);
close();
run('loadRoom(0);state.hp=1;player.z=0;player.inv=0;player.shield=0;damage("blob",{x:600,y:450});updateWorld(1.31)');
assert.equal(run('mini.forced'), true);
run('leaveMini()');
assert.equal(nodes.miniDialog.open, true);
close();
console.log('PASS: six-game passport, Ralph before discharge, and mandatory recovery gates.');

// Ward gating: every arcade entry checks wardLocked() when combat provides it.
const LOCKED = 'Clear the ward first. The gremlins are sitting on the arcade.';
const seenText = () => run('var seenText=[];c.fillText=t=>seenText.push(t);drawWorld();c.fillText=undefined;seenText');
run('state.hp=5;state.paused=false;loadRoom(1);cameraX=0;wardCameraY=0;player.x=rooms[1].station[0];player.y=rooms[1].station[1]');
run('wardLocked=undefined');
assert.equal(run('arcadeBlocked()'), false);
assert.equal(run('tryOpenArcade()'), true);
assert.equal(run('mini.open'), true);
close();
key('Enter');
assert.equal(run('mini.open'), true, 'Enter near the beacon opens the arcade');
close();
nodes.game.events.click({ clientX: run('rooms[1].station[0]'), clientY: run('rooms[1].station[1]') });
assert.equal(run('mini.open'), true, 'tapping the beacon opens the arcade');
close();
assert.ok(!seenText().includes('LOCKED'));
run('wardLocked=()=>true');
assert.equal(run('tryOpenArcade()'), false);
assert.equal(run('mini.open'), false);
assert.equal(nodes.toast.textContent, LOCKED);
nodes.arcadeBtn.events.click();
assert.equal(run('mini.open'), false, 'gamebar button is gated');
key('Enter');
assert.equal(run('mini.open'), false, 'Enter is gated');
nodes.game.events.click({ clientX: run('rooms[1].station[0]'), clientY: run('rooms[1].station[1]') });
assert.equal(run('mini.open'), false, 'beacon tap is gated');
assert.equal(run("openDaily('2026-11-01')"), false, 'map and sidebar Daily Dose are gated');
assert.equal(run('mini.open'), false);
assert.ok(seenText().includes('LOCKED'), 'beacon reads LOCKED');
run('keys.clear();wardLocked=realWardLocked');
console.log('PASS: ward gating with wardLocked undefined and with a stub that returns true.');
