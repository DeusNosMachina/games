// Cross-cutting rules: saves, nutrients, run lifecycle, frame-rate independence, idle failure, discharge,
// briefings and countdown, Daily Dose, the gift shop, hearts, ward gating, both touch schemes (the joystick
// default, the swipe, tap the room), and the health the ward hands out (snack carts, floor drops).
// Game-specific mechanics live in game-<name>.cjs; ward combat in combat.cjs.
const { run, nodes, events, close, assert } = require('./harness.cjs');
const saved = () => JSON.parse(run('localStorage.getItem(STORE)'));
const key = (k, extra = {}) => events.keydown({ key: k, target: {}, repeat: false, preventDefault: () => {}, ...extra });
// Combat defines wardLocked() after merge; keep the arcades open unless a test says otherwise.
run('var realWardLocked = typeof wardLocked === "function" ? wardLocked : undefined; wardLocked = () => false');
run('let rng=1873;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
assert.equal(run('ARCADE_COUNT'), 6);
assert.equal(run('rooms.length'), 7, 'six arcade rooms plus the hallway');
assert.equal(run('Object.keys(games).length'), 6);

// The title owns the screen on load, and nothing in the ward runs until START.
assert.equal(run('titleUp'), true, 'the title is up after load');
assert.equal(nodes.titleScreen.dataset.state, 'up');
assert.equal(run('state.started'), false);
run('player.x=505;player.y=470;keys.add("d");for(let i=0;i<30;i++)updateWorld(1/60);keys.clear()');
assert.equal(run('player.x'), 505, 'the ward stands still under the title');
run('drawTitleArt(c, 1280, 820, 3, false);drawTitleArt(c, 390, 844, 3, true);drawTitleArt(c, 844, 390, 0, true)');
console.log('PASS: the title is up on load and the ward waits for START.');

run('begin();drawWorld();state.hp=5;player.x=381;player.y=463;updateWorld(.016)');
assert.equal(run('titleUp'), false, 'begin() clears the title');
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
// The recovery is one phase with its own briefing, not the briefing of the room's arcade.
run('ivRecovery=null;openMini(0,true);startMini()');
assert.equal(run('mini.screen'), 'briefing');
assert.equal(nodes.miniBriefTitle.textContent, 'Recovery / Drip or Die', 'a forced run briefs the recovery');
run(`launchMini();updateMini(${INTRO + 0.01})`);
assert.equal(run('mini.screen'), 'play');
assert.equal(run('mini.phase'), 0, 'the recovery never moves on to another phase');
run('mini.forced=false;ivRecovery=null');
close();
console.log('PASS: briefings show in full once per game, then a skippable GO card; the recovery briefs as itself.');

// Every game, tier and prescription has finite physics and fails when idle.
let idleCombos = 0;
for (let d = 0; d < 3; d++)
  for (let id = 0; id < 6; id++)
    for (let tier = 0, tiersHere = run(`miniTierCount(games[${id}])`); tier < tiersHere; tier++) {
      idleCombos++;
      run(`state.difficulty=${d};openMini(${id});mini.tier=${tier};startMini();drawMini();launchMini();updateMini(3.3)`);
      assert.ok(run('mini.limit') >= 30, `${id}/${tier}/${d} limit`);
      for (let n = 0; n < 4000 && run('mini.screen') === 'play'; n++) run('updateMini(.1)');
      if (run('mini.screen') === 'outro') run('updateMini(2.3)');
      assert.equal(run('mini.screen'), 'result', `${id}/${tier}/${d}`);
      assert.equal(run('mini.win'), false, `${id}/${tier}/${d} idle won`);
      close();
    }
console.log(`PASS: all ${idleCombos} game/tier/difficulty combinations reject idle play.`);

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
// 30 stars across five arcades (21 needed) but the sixth is unstamped, so the passport is short.
run('state.won=false;state.ralph=false;state.ralphReady=false;state.medals=rooms.map((_,i)=>i<5?[3,3,0,0]:[0,0,0,0]);checkDischarge()');
assert.deepEqual(JSON.parse(run('JSON.stringify(dischargeMissing())')), ['a medal in Bedside Blaster', 'Ralph evicted from your room'], 'the checklist names what is missing');
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

// ---- Touch buttons act on pointerdown ----
// Phones never turn a tap into a click while another finger is down, so a thumb on the joystick used
// to swallow JUMP. Every game button now acts on pointerdown; the click that may follow is ignored, and
// a click with no press before it (keyboard) still acts.
const touch = (id, x = 500, y = 312, extra = {}) => ({
  pointerId: id,
  pointerType: 'touch',
  button: 0,
  clientX: x,
  clientY: y,
  preventDefault: () => {},
  ...extra
});
const tapButton = (id, pointer) => nodes[id].events.pointerdown(touch(pointer));
close();
run('state.controls="stick";state.hp=3;state.food=0;state.paused=false;deadDelay=0;keys.clear();loadRoom(0)');
run('player.z=0;player.vz=0;player.jumpCd=0;player.dashCd=0;player.dash=0;player.itemCd=0;hitStop=0');
nodes.joystick.events.pointerdown(touch(1, 700, 312));
assert.equal(run('joyPointer'), 1);
assert.ok(run('joy.x') > 0.5, 'the joystick finger steers right');
tapButton('jumpBtn', 2);
assert.ok(run('player.z') > 0 && run('player.vz') > 0, 'JUMP jumps on pointerdown with the joystick held, no click needed');
assert.equal(run('joyPointer'), 1, 'the joystick keeps its finger');
tapButton('dashBtn', 3);
assert.ok(run('player.dash') > 0, 'DASH acts on pointerdown too');
run('player.dash=0;player.dashCd=0');
nodes.dashBtn.events.click({ detail: 1 });
assert.equal(run('player.dash'), 0, 'the click that follows a press is ignored');
nodes.dashBtn.events.click({ detail: 0 });
assert.ok(run('player.dash') > 0, 'Enter or Space on a focused button still acts');
tapButton('useBtn', 4);
assert.ok(run('player.itemCd') > 0, 'the ability button acts on pointerdown');
nodes.joystick.events.pointerup(touch(1, 700, 312));
assert.equal(run('joyPointer'), null);
run('player.attackCd=0;player.attack=0;player.z=0;player.vz=0;hitStop=0');
nodes.attackBtn.events.pointerdown(touch(5));
assert.ok(run('player.attack') > 0, 'the attack button swings on press');
assert.equal(run('heldAttack'), true, 'holding it keeps swinging');
nodes.attackBtn.events.pointerup(touch(5));
assert.equal(run('heldAttack'), false);
console.log('PASS: ward buttons act on pointerdown (JUMP with the joystick held), and the follow-up click is ignored.');

// The weapon strip equips on press and the highlight follows; the canvas names the new weapon.
run('equip(0);wardWeaponSync();wardWeaponFlash=0');
tapButton('wslot2', 6);
assert.equal(run('state.item'), 2);
assert.equal(nodes.weaponStrip.dataset.active, '2', 'the strip highlight moves to the brick');
assert.ok(run('wardWeaponFlash') > 0, 'the canvas flashes the new weapon');
const flashed = run('var seenFlash=[];c.fillText=t=>seenFlash.push(t);drawWorld();c.fillText=undefined;seenFlash');
assert.ok(flashed.includes('BRICK · LOB'), 'the flash names the weapon and its attack');
tapButton('wslot1', 7);
assert.equal(run('state.item'), 1);
assert.equal(nodes.weaponStrip.dataset.active, '1');
key('c');
assert.equal(run('state.item'), 2, 'C cycles to the next weapon');
run('drawWorld()');
assert.equal(nodes.weaponStrip.dataset.active, '2', 'keyboard swaps move the strip too');
run('equip(0);drawWorld()');
console.log('PASS: the weapon strip equips on press, the highlight moves, and the canvas flashes the weapon.');

// EAT: a count badge, off when empty or at full hearts, on after a pickup, eats on press.
run('state.food=0;state.hp=3;hud()');
assert.equal(nodes.touchEat.disabled, true, 'EAT is off with nothing to eat');
assert.equal(nodes.touchEatCount.textContent, '0');
run('state.food=2;state.hp=maxHearts();hud()');
assert.equal(nodes.touchEat.disabled, true, 'EAT is off at full hearts');
assert.equal(nodes.touchEatCount.textContent, '2');
run('state.food=0;state.hp=3;state.taken=state.taken.filter(id=>id!=="home-shake");loadRoom(0)');
run('player.x=381;player.y=463;updateWorld(.016)');
assert.equal(nodes.touchEatCount.textContent, '1', 'a pickup bumps the badge');
assert.equal(nodes.touchEat.disabled, false, 'EAT lights up after a pickup');
tapButton('touchEat', 8);
assert.equal(run('state.hp'), 4, 'EAT on press restores a heart');
assert.equal(run('state.food'), 0);
assert.equal(nodes.touchEat.disabled, true);
console.log('PASS: the EAT button tracks nutrients and hearts and eats on press.');

// Minigame buttons act on press too.
run('openMini(1);startMini();launchMini();updateMini(3)');
assert.equal(run('mini.screen'), 'play');
run('var seenActions=[];var realAction=games[1].action;games[1].action=a=>seenActions.push(a)');
const control = action => ({ closest: () => ({ dataset: { action }, classList: { add() {}, remove() {} }, setPointerCapture() {} }) });
nodes.miniControls.events.pointerdown({ ...touch(9), target: control('polarity') });
assert.deepEqual(JSON.parse(run('JSON.stringify(seenActions)')), ['polarity'], 'a minigame button acts on pointerdown');
nodes.miniControls.events.click({ detail: 1, target: control('polarity') });
assert.equal(run('seenActions.length'), 1, 'its follow-up click does not act twice');
run('games[1].action=realAction');
close();
console.log('PASS: minigame buttons act on pointerdown without a second action from the click.');

// ---- Portrait canvases ----
// A game may declare portraitCanvas. activeCanvas() follows mini.portrait, which follows the screen.
run('var realPortrait=games[0].portraitCanvas;games[0].portraitCanvas={w:450,h:800}');
run('openMini(0);startMini()');
assert.equal(run('mini.portrait'), false, 'a wide window keeps the wide canvas');
assert.equal(run('JSON.stringify(activeCanvas())'), '{"w":800,"h":450}', 'activeCanvas falls back to canvas');
assert.equal(nodes.miniDialog.dataset.portrait, '');
close();
run('window.innerWidth=390;window.innerHeight=844;openMini(0);startMini()');
assert.equal(run('mini.portrait'), true, 'an upright screen picks the portrait canvas');
assert.equal(run('JSON.stringify(activeCanvas())'), '{"w":450,"h":800}');
assert.equal(nodes.miniDialog.dataset.portrait, '1', 'CSS hears about it');
assert.equal(nodes.miniDialog.style['--mini-a'], '0.5625');
assert.equal(nodes.miniCanvas.width, 450, 'the canvas is sized for the portrait drawing');
run('window.innerWidth=844;window.innerHeight=390');
events.resize();
assert.equal(run('mini.portrait'), false, 'turning the phone mid-run flips back');
assert.equal(nodes.miniCanvas.width, 800);
assert.equal(nodes.miniDialog.dataset.portrait, '');
run('window.innerWidth=390;window.innerHeight=844;resize()');
assert.equal(run('mini.portrait'), true);
// miniPoint maps the portrait canvas, including a letterboxed box.
const realRect = nodes.miniCanvas.getBoundingClientRect;
nodes.miniCanvas.getBoundingClientRect = () => ({ left: 0, top: 100, width: 390, height: 800 * (390 / 450) });
const mid = JSON.parse(run('JSON.stringify(miniPoint({clientX:195,clientY:100+400*390/450}))'));
assert.ok(Math.abs(mid.x - 225) < 0.01 && Math.abs(mid.y - 400) < 0.01, 'the middle of the box is the middle of the canvas');
nodes.miniCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 800 });
const s = 390 / 450,
  pad = (800 - 800 * s) / 2;
const corner = JSON.parse(run(`JSON.stringify(miniPoint({clientX:390,clientY:${pad + 800 * s}}))`));
assert.ok(Math.abs(corner.x - 450) < 0.01 && Math.abs(corner.y - 800) < 0.01, 'a letterboxed corner maps to the canvas corner');
const top = JSON.parse(run(`JSON.stringify(miniPoint({clientX:0,clientY:${pad}}))`));
assert.ok(Math.abs(top.x) < 0.01 && Math.abs(top.y) < 0.01);
nodes.miniCanvas.getBoundingClientRect = realRect;
// The countdown card fills and centers on the active canvas.
const card = () =>
  JSON.parse(
    run(
      'var fills=[],moves=[];mc.fillRect=(x,y,w,h)=>fills.push([x,y,w,h]);mc.translate=(x,y)=>moves.push([x,y]);' +
        'paintTransition(mc);mc.fillRect=undefined;mc.translate=undefined;JSON.stringify({fills,moves})'
    )
  );
run('launchMini()');
assert.equal(run('mini.screen'), 'intro');
let painted = card();
assert.deepEqual(painted.fills[0], [0, 0, 450, 800], 'the intro card covers the portrait canvas');
assert.deepEqual(painted.moves[0], [225, 395], 'and centers on it');
run('mini.portrait=false');
painted = card();
assert.deepEqual(painted.fills[0], [0, 0, 800, 450], 'the wide card is unchanged');
assert.deepEqual(painted.moves[0], [400, 220]);
close();
run('delete window.innerWidth;delete window.innerHeight;resize()');
run('if(realPortrait)games[0].portraitCanvas=realPortrait;else delete games[0].portraitCanvas');
console.log('PASS: activeCanvas, mini.portrait flips, data-portrait, miniPoint and the intro card follow the portrait canvas.');

// ---- Phone toast for the instruction line ----
run('openMini(4);startMini();launchMini()');
assert.equal(nodes.miniInstruction.dataset.show, '1', 'the instruction shows through the countdown');
run('updateMini(1.6)');
assert.equal(run('mini.screen'), 'play');
assert.equal(nodes.miniInstruction.dataset.show, '1', 'and for the first seconds of play');
for (let i = 0; i < 40; i++) run('updateMini(.1)');
assert.equal(nodes.miniInstruction.dataset.show, '', 'then it gets out of the way');
run('setInstructions("Something new")');
assert.equal(nodes.miniInstruction.dataset.show, '1', 'a new line comes back');
run('setInstructions("Something new");updateMini(3.1)');
assert.equal(nodes.miniInstruction.dataset.show, '', 'the same line again does not');
close();
console.log('PASS: the instruction toast shows in the countdown, for 3 seconds of play, and on change.');

// ---- Tap the room ----
// On touch screens the floor is the controller. Mice never use it; state.controls 'stick' turns it off.
const finger = {
  down: (id, x, y) => nodes.game.events.pointerdown(touch(id, x, y)),
  move: (id, x, y) => nodes.game.events.pointermove(touch(id, x, y)),
  up: (id, x, y) => nodes.game.events.pointerup(touch(id, x, y)),
  tap(id, x, y) {
    this.down(id, x, y);
    this.up(id, x, y);
  }
};
const steps = (n, extra = '') => run(`for(let i=0;i<${n};i++){${extra}advanceSimulation(1/60)}`);
run('setControlScheme("tap");state.hp=5;keys.clear();loadRoom(0);player.x=505;player.y=470;cameraX=0;wardCameraY=0');
assert.equal(run('viewport.w'), 1000);
finger.tap(10, 300, 470);
assert.equal(run('JSON.stringify(wardGoal)'), '{"x":300,"y":470}', 'a tap on the floor sets a goal');
steps(120);
assert.ok(run('Math.hypot(player.x-300,player.y-470)') <= 12, 'Macy walks to the tapped spot');
assert.equal(run('wardGoal'), null, 'and stops there');
finger.down(11, 505, 300);
finger.move(11, 520, 520);
assert.equal(run('JSON.stringify(wardGoal)'), '{"x":520,"y":520}', 'a drag steers the goal');
finger.up(11, 520, 520);
// Tap a gremlin: walk into range and hit it, then stop after the swing.
run('loadRoom(1);enemies=[makeEnemy(0,700,450)];enemies[0].cool=9;player.x=505;player.y=450;player.attackCd=0;equip(0)');
finger.tap(12, 700, 420);
assert.ok(run('wardPrey && wardPrey.e === enemies[0]'), 'a tap on a gremlin picks it');
steps(90, 'enemies.length=1;');
assert.ok(run('enemies[0].hp') < 3, 'Macy walks over and hits it');
assert.equal(run('wardPrey'), null, 'a tap is one attack, then she stops');
// Hold on a gremlin: keep swinging.
run('enemies=[makeEnemy(0,560,450)];enemies[0].cool=9;enemies[0].hp=99;player.x=505;player.y=450;player.attackCd=0');
finger.down(13, 560, 420);
steps(150, 'enemies.length=1;enemies[0].x=560;enemies[0].y=450;');
assert.ok(run('wardPrey.swings') >= 3, 'holding keeps swinging');
finger.up(13, 560, 420);
steps(60, 'enemies.length=1;');
assert.equal(run('wardPrey'), null, 'letting go stops the swings');
// Flick: a quick swipe of 40+ px dashes that way.
run('enemies=[];player.x=505;player.y=450;player.dash=0;player.dashCd=0;wardGoal=null');
finger.down(14, 500, 300);
finger.move(14, 560, 300);
finger.up(14, 600, 300);
assert.ok(run('player.dash') > 0, 'a flick dashes');
assert.ok(run('player.lastDx') > 0.99, 'in the flick direction');
assert.equal(run('wardGoal'), null, 'and does not keep walking');
// Two-finger tap: jump, and the first finger's walk is taken back.
run('player.z=0;player.vz=0;player.jumpCd=0;player.dash=0;wardGoal=null');
finger.down(15, 300, 500);
finger.down(16, 360, 500);
assert.ok(run('player.z') > 0, 'two fingers jump');
assert.equal(run('wardGoal'), null, 'a two-finger tap is not a walk');
finger.up(15, 300, 500);
finger.up(16, 360, 500);
assert.equal(run('wardGoal'), null);
// Long-press on the floor: the ability.
run('player.itemCd=0;player.z=0;player.vz=0;equip(1)');
finger.down(17, 700, 520);
steps(20);
assert.equal(run('player.shield'), 0, 'not yet');
steps(10);
assert.ok(run('player.shield') > 0, 'a long-press raises the barf-bag shield');
assert.equal(run('wardGoal'), null, 'and stops the walk');
finger.up(17, 700, 520);
run('equip(0)');
// The beacon still opens its arcade, once; the click that follows is not a second tap.
run('var gateBefore=wardLocked;wardLocked=()=>false;loadRoom(1);enemies=[]');
finger.tap(18, run('rooms[1].station[0]'), run('rooms[1].station[1]'));
assert.equal(run('mini.open'), true, 'tapping the beacon opens the arcade');
close();
nodes.game.events.click({ detail: 1, clientX: run('rooms[1].station[0]'), clientY: run('rooms[1].station[1]') });
assert.equal(run('mini.open'), false, 'the follow-up click does not open it again');
run('wardLocked=gateBefore');
// The exit corner still works by walking into it: with the hallway installed it leads there.
run('loadRoom(2);enemies=[];player.x=505;player.y=470');
finger.tap(19, 955, 175);
steps(300, 'enemies=[];if(state.room===6||$("mapDialog").open)break;');
assert.equal(run('state.room'), 6, 'walking into the corner leads into the hallway');
run('loadRoom(2);enemies=[]');
close();
// Mice keep clicking; the joystick scheme switches the room off.
run('loadRoom(0);player.x=505;player.y=470');
nodes.game.events.pointerdown(touch(20, 300, 470, { pointerType: 'mouse' }));
assert.equal(run('wardGoal'), null, 'a mouse press does not walk');
nodes.game.events.pointerup(touch(20, 300, 470, { pointerType: 'mouse' }));
nodes.pauseControls.events.click();
assert.equal(run('state.controls'), 'stick', 'the pause menu switches to the joystick');
assert.equal(saved().controls, 'stick', 'and saves it');
assert.match(nodes.pauseControls.textContent, /Joystick/);
finger.tap(21, 300, 470);
assert.equal(run('wardGoal'), null, 'the joystick scheme ignores taps on the room');
nodes.pauseControls.events.click();
assert.equal(run('state.controls'), 'tap');
assert.equal(saved().controls, 'tap');
finger.tap(22, 300, 470);
assert.ok(run('wardGoal') !== null, 'tap the room is back');
run('wardTouchReset();enemies=[]');
console.log('PASS: tap the room walks, hits, holds, flicks, jumps, long-presses, keeps the beacon and map exit, and switches.');

// ---- Title screen: START, any key, any tap; Quit to title ----
run('var goCount=0;var realSfx=sfx;sfx=(n,o)=>{if(n==="go")goCount++;return realSfx(n,o)}');
close();
run('setWardPause(true)');
nodes.pauseQuit.events.click();
assert.equal(run('titleUp'), true, 'Quit to title shows the title again');
assert.equal(nodes.titleScreen.dataset.state, 'up');
assert.equal(run('state.started'), false, 'and the ward stops');
assert.equal(run('state.paused'), true);
run('player.x=505;keys.add("d");for(let i=0;i<30;i++)updateWorld(1/60);keys.clear()');
assert.equal(run('player.x'), 505, 'nothing moves behind the title');
key('x');
assert.equal(nodes.titleScreen.dataset.state, 'leaving', 'a key starts the iris');
assert.equal(run('state.started'), false, 'the game begins when the iris closes');
run('titleTick(.3)');
assert.equal(run('state.started'), true, 'a keydown starts the game');
assert.equal(run('state.paused'), false);
assert.equal(nodes.titleScreen.dataset.state, 'gone');
nodes.pauseQuit.events.click();
nodes.titleScreen.events.pointerdown(touch(40));
run('titleTick(.3)');
assert.equal(run('state.started'), true, 'a tap anywhere starts the game');
// START: its press reaches the screen and its click follows; the game starts once.
nodes.pauseQuit.events.click();
run('goCount=0');
nodes.titleScreen.events.pointerdown(touch(41));
nodes.titleStart.events.click({ detail: 1 });
run('titleTick(.1)');
nodes.titleStart.events.click({ detail: 1 });
run('titleTick(.3)');
nodes.titleStart.events.click({ detail: 1 });
assert.equal(run('goCount'), 1, 'START starts exactly once');
assert.equal(run('state.started'), true);
nodes.pauseQuit.events.click();
run('goCount=0');
nodes.titleStart.events.click({ detail: 0 });
run('titleTick(.3)');
assert.equal(run('goCount'), 1, 'Enter on the START button starts it');
assert.equal(run('state.started'), true);
run('sfx=realSfx');
console.log('PASS: START, any key and any tap start once after the iris; Quit to title brings it back.');

// Reduced motion skips the iris (a fresh page with prefers-reduced-motion).
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function freshPage(env, body) {
  const code = `const { run, nodes, events, close, assert } = require(${JSON.stringify(path.join(__dirname, 'harness.cjs'))});\n${body}`;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return r.stdout;
}
freshPage(
  { GF_REDUCED_MOTION: '1' },
  `assert.equal(run('reduced'), true);
assert.equal(run('TITLE_IRIS_SECONDS'), 0);
assert.equal(run('titleUp'), true);
run('titleStart()');
assert.equal(run('state.started'), true, 'reduced motion starts at once');
assert.equal(nodes.titleScreen.dataset.state, 'gone');`
);
console.log('PASS: reduced motion skips the title iris.');

// ---- Recovery bookkeeping ----
// The recovery opens on the level of the last real arcade run and plays one of its two phases, drawn at
// random and kept for a retry. A won recovery still counts, a medal outside one resets the count, and a
// lost one can end from the result screen for coins.
const lastTierBefore = run('state.lastTier');
run("state.recoveries=2;state.hp=5;openMini(1);mini.forced=false;startMini();launchMini();updateMini(2);finishMini(true);updateMini(2.3)");
assert.equal(run('mini.win'), true);
assert.equal(run('state.recoveries'), 0, 'a medal outside a recovery resets the count');
assert.equal(saved().recoveries, 0, 'recoveries are saved');
assert.equal(saved().lastTier, run('mini.tier'), "the last run's level is saved");
close();
for (let last = 0; last < 4; last++) {
  run(`ivRecovery=null;state.recoveries=2;state.lastTier=${last};openMini(0,true)`);
  const plan = JSON.parse(run('JSON.stringify(ivRecoveryPlan())'));
  assert.equal(plan.level, last, `the recovery follows the last run: level ${last + 1}`);
  assert.ok([0, 1].includes(plan.phase), 'the pump or the pressure');
  assert.equal(plan.count, 2);
  assert.equal(run('mini.tier'), last, `the recovery lobby shows level ${last + 1}`);
  assert.match(nodes.tierGrid.innerHTML, new RegExp(`tier-card selected( legendary)?" data-tier="${last}" >`), 'that level is the one on offer');
  run('mini.forced=false');
  close();
}
run('ivRecovery=null;state.recoveries=2;state.lastTier=1;openMini(0,true)');
const plannedPhase = run('ivRecoveryPlan().phase');
assert.equal(nodes.miniRewardInfo.textContent, run('MINI_RECOVERY_LINE'));
run('state.medals[0]=[0,0,0,0];state.records[0]=[0,0,0,0];startMini()');
assert.equal(run('mini.ivPhase'), plannedPhase, 'the run plays the phase the lobby drew');
assert.equal(run('mini.tier'), 1);
run('launchMini();updateMini(2);finishMini(true);updateMini(2.3)');
assert.equal(run('mini.win'), true);
assert.equal(run('state.recoveries'), 3, 'a won recovery keeps counting');
assert.equal(run('state.lastTier'), 1, 'a recovery never moves the level');
assert.equal(run('JSON.stringify(state.medals[0])'), '[0,0,0,0]', "a won recovery stamps nothing on the room's arcade");
run('mini.forced=false');
close();
// A lost recovery keeps Retry (the same phase, not another collapse), and the patch-up ends it for 15%
// of her coins.
run('ivRecovery=null;state.recoveries=0;state.hp=0;state.coins=200;state.lastTier=0;openMini(0,true);startMini();launchMini();updateMini(2);finishMini(false);updateMini(2.3)');
assert.equal(run('mini.screen'), 'result');
assert.equal(run('mini.win'), false);
const lostPhase = run('mini.ivPhase');
nodes.miniRetry.events.click();
run('startMini();launchMini();updateMini(2)');
assert.equal(run('mini.ivPhase'), lostPhase, 'Retry replays the same phase');
assert.equal(run('state.recoveries'), 1, 'and is not another collapse');
run('finishMini(false);updateMini(2.3)');
assert.equal(run('mini.screen'), 'result');
assert.equal(nodes.miniBack.textContent, 'Get patched up · 30 coins', 'the button names the price');
assert.match(nodes.resultText.textContent, /30 coins/, 'and so does the result');
const medalsBeforePatch = run('JSON.stringify(state.medals)');
run('leaveMini()');
assert.equal(run('mini.open'), false, 'the patch-up ends the recovery');
assert.equal(run('state.coins'), 170, 'for 15% of her coins');
assert.ok(run('state.hp') >= 1, 'with at least one heart');
assert.equal(run('JSON.stringify(state.medals)'), medalsBeforePatch, 'never progress or medals');
assert.equal(run('ivRecovery'), null, 'the next collapse is a new recovery');
run(`state.recoveries=0;state.hp=5;state.lastTier=${lastTierBefore};save()`);
console.log("PASS: the recovery follows the last run's level, plays one of two phases, counts collapses, stamps nothing, and a lost one can be patched up for coins.");

// ---- The run screen: canvas plus the minimum, sized to the window ----
run('window.innerWidth=1280;window.innerHeight=820;openMini(4);startMini()');
let frame = JSON.parse(run('JSON.stringify(mini.frame)'));
assert.equal(frame.side, 'col', 'a square game on a wide window gets a control column');
assert.equal(Math.round(frame.fitH), Math.floor(820 * 0.94), 'the canvas takes the full dialog height');
assert.equal(frame.frameW, Math.ceil(frame.fitW + 190), 'the dialog hugs canvas plus column');
assert.ok(frame.frameW <= 1280 * 0.96 && frame.frameH <= 820 * 0.94, 'inside 96vw × 94vh');
assert.equal(nodes.miniDialog.dataset.side, 'col');
assert.equal(nodes.miniDialog.style['--fit-h'], Math.floor(820 * 0.94) + 'px');
close();
run('openMini(0);startMini()');
frame = JSON.parse(run('JSON.stringify(mini.frame)'));
assert.equal(frame.side, 'row', 'the wide IV canvas gets a control row');
assert.equal(Math.round(frame.fitW), Math.floor(1280 * 0.96), 'and the full dialog width');
assert.equal(frame.frameH, Math.ceil(frame.fitH + 72));
run('window.innerWidth=1440;window.innerHeight=900;resize()');
frame = JSON.parse(run('JSON.stringify(mini.frame)'));
assert.ok(
  Math.abs(frame.fitW - Math.min(Math.floor(1440 * 0.96), (Math.floor(900 * 0.94) - 72) * (800 / 450))) < 0.01,
  'resizing the window re-fits the frame'
);
close();
const phone = JSON.parse(run('JSON.stringify(miniFrame(390, 844, 450 / 800, true, MINI_FRAME_SIZES.phone))'));
assert.equal(phone.side, 'row');
assert.equal(phone.fitW, 390, 'a portrait canvas fills a phone');
assert.ok(Math.abs(phone.fitH - 693.33) < 0.1);
assert.ok(phone.cvT >= 0 && phone.cvT + phone.fitH <= 844 - 66 + 0.01, 'clear of the control row');
const flat = JSON.parse(run('JSON.stringify(miniFrame(844, 390, 1, true, MINI_FRAME_SIZES.phone))'));
assert.equal(flat.side, 'col', 'a landscape phone puts the controls in a column');
assert.equal(flat.fitH, 390);
run('delete window.innerWidth;delete window.innerHeight;resize()');
console.log('PASS: run screens size the canvas to the window, row or column, with no dead panels.');

// ---- The joystick scheme: the default on phones, a swipe for weapons ----
// A finger as the main pointer starts on the joystick and the big buttons; a scheme the player picked
// stays picked. Older saves wrote 'tap' without anyone choosing it, so those move to the joystick too.
const COARSE = 'matchMedia = q => ({ matches: /coarse/.test(q) });';
const withSave = blob => `localStorage.setItem('gut-feeling-v2', ${JSON.stringify(JSON.stringify(blob))});`;
freshPage(
  { GF_PRELUDE: COARSE + 'window.innerWidth = 390; window.innerHeight = 844;' },
  `assert.equal(run('state.controls'), 'stick', 'a phone starts on the joystick');
assert.equal(run('state.controlsChosen'), false);
run('begin()');
assert.match(nodes.toast.textContent, /Swipe it sideways/, 'the first toast teaches the stick and the swipe');
assert.equal(run('state.stats.turnHint'), 1, 'a phone held upright gets the turn-sideways hint');
assert.ok(run('turnHintUntil') > 0);
assert.match(nodes.turnHintchild.textContent, /sideways/);
assert.equal(JSON.parse(run('localStorage.getItem(STORE)')).stats.turnHint, 1, 'once per save');
run('turnHintHide()');
assert.equal(run('turnHintCheck()'), false, 'and never again');
run('state.stats.turnHint=0;turnHintCheck();window.innerWidth=844;window.innerHeight=390;turnHintTick()');
assert.equal(run('turnHintUntil'), 0, 'turning the phone clears it');
run('setControlScheme("tap")');
assert.equal(JSON.parse(run('localStorage.getItem(STORE)')).controlsChosen, true, 'a pick is remembered as a pick');`
);
freshPage(
  { GF_PRELUDE: COARSE + withSave({ controls: 'tap', hp: 4 }) },
  `assert.equal(run('state.controls'), 'stick', 'an old save that never chose moves to the joystick');`
);
freshPage(
  { GF_PRELUDE: COARSE + withSave({ controls: 'tap', controlsChosen: true }) },
  `assert.equal(run('state.controls'), 'tap', 'a chosen tap-the-room stays');`
);
freshPage({ GF_PRELUDE: withSave({ controls: 'stick' }) }, `assert.equal(run('state.controls'), 'stick', 'an old joystick pick stays');`);
freshPage({}, `assert.equal(run('state.controls'), 'tap', 'a mouse keeps tap the room as the touch scheme');`);
// A quick sideways swipe across the attack button changes weapons: right for the next, left for the one
// before. It swung on the press, as always; a slow drag aims instead.
close();
run('setControlScheme("stick");state.hp=5;keys.clear();loadRoom(0);enemies=[];equip(0);wardWeaponSync();wardWeaponFlash=0;player.attackCd=0;heldAttack=false;attackPointer=null');
nodes.attackBtn.events.pointerdown(touch(40, 600, 300));
assert.equal(run('player.pressAt'), run('time'), 'a press of the attack button is a press for the combo');
assert.equal(run('heldAttack'), true);
nodes.attackBtn.events.pointermove(touch(40, 650, 306));
assert.equal(run('state.item'), 1, 'swipe right: the next weapon');
assert.equal(nodes.weaponStrip.dataset.active, '1', 'the strip follows');
assert.ok(run('wardWeaponFlash') > 0, 'and the canvas flashes it');
assert.equal(run('heldAttack'), false, 'a swipe stops the held swings');
nodes.attackBtn.events.pointermove(touch(40, 720, 306));
assert.equal(run('state.item'), 1, 'one swipe, one weapon');
nodes.attackBtn.events.pointerup(touch(40, 720, 306));
nodes.attackBtn.events.pointerdown(touch(41, 600, 300));
nodes.attackBtn.events.pointermove(touch(41, 550, 290));
assert.equal(run('state.item'), 0, 'swipe left: back one');
nodes.attackBtn.events.pointerup(touch(41, 550, 290));
nodes.attackBtn.events.pointerdown(touch(42, 600, 300));
nodes.attackBtn.events.pointermove(touch(42, 548, 300));
assert.equal(run('state.item'), 2, 'left from the pillow wraps to the brick');
nodes.attackBtn.events.pointerup(touch(42, 548, 300));
run('equip(1);wardWeaponSync();player.attackCd=0');
nodes.attackBtn.events.pointerdown(touch(43, 600, 300));
run('time += 0.5');
nodes.attackBtn.events.pointermove(touch(43, 660, 300));
assert.equal(run('state.item'), 1, 'a slow drag does not swipe');
assert.equal(run('wardAim.dx'), 120, 'it aims');
nodes.attackBtn.events.pointerdown(touch(44, 600, 300));
assert.equal(run('attackPointer'), 43, 'a second finger does not steal the button');
nodes.attackBtn.events.pointerup(touch(43, 660, 300));
nodes.attackBtn.events.pointerdown(touch(45, 600, 300));
nodes.attackBtn.events.pointermove(touch(45, 610, 380));
assert.equal(run('state.item'), 1, 'a vertical drag is an aim, not a swipe');
nodes.attackBtn.events.pointerup(touch(45, 610, 380));
assert.equal(run('wardAim'), null);
run('equip(0);wardWeaponSync();projectiles=[]');
// The pause menu names the scheme in use.
run('renderControls()');
assert.equal(nodes.pauseControls.textContent, 'Controls: Joystick');
// Tap the room: the first swing of a tap on a gremlin is a press for the combo; a held finger's repeats are not.
run('setControlScheme("tap");loadRoom(1);encounter.complete=true;enemies=[makeEnemy(0,560,450)];enemies[0].cool=99;enemies[0].hp=99;player.x=505;player.y=450;player.attackCd=0;player.pressAt=-9;cameraX=0;wardCameraY=0');
finger.down(50, 560, 420);
steps(2, 'enemies.length=1;');
assert.ok(run('time-player.pressAt') < 0.1, 'the first swing of a tap is a press');
steps(90, 'enemies.length=1;enemies[0].x=560;enemies[0].y=450;');
assert.ok(run('wardPrey.swings') >= 2 && run('time-player.pressAt') > 1, 'the swings a held finger repeats are not');
finger.up(50, 560, 420);
run('wardTouchReset();enemies=[];setControlScheme("stick")');
console.log('PASS: phones start on the joystick (a pick stays picked), a one-time turn-sideways hint, a swipe across SWING changes weapons, and presses (not held repeats) feed the combo.');

// ---- Health you can find: snack carts and nutrients on the floor ----
run('setControlScheme("tap");state.food=0;state.hp=3;loadRoom(1);enemies=[];encounter.complete=true;for(const k in snackStock)delete snackStock[k]');
assert.equal(run('snackReady()'), true, 'a stocked cart in every combat room');
run('player.x=SNACK_CARTS[1].x;player.y=SNACK_CARTS[1].y;updateWorld(1/60)');
assert.equal(run('state.food'), 1, 'walking up to it pockets one nutrient');
assert.match(nodes.toast.textContent, /Snack cart/);
assert.equal(run('snackReady()'), false, 'then it is out');
run('updateWorld(1/60)');
assert.equal(run('state.food'), 1, 'one per stock');
run('time += SNACK_RESTOCK + 1;updateWorld(1/60)');
assert.equal(run('state.food'), 2, 'two minutes later it has restocked');
run('state.food=maxFood();time += SNACK_RESTOCK + 1;updateWorld(1/60)');
assert.equal(run('state.food'), run('maxFood()'), 'a full pocket leaves it on the cart');
assert.equal(run('snackReady()'), true);
run('snackStock[1]=time+999;snackRestock(1)');
assert.equal(run('snackReady()'), true, 'snackRestock (a ward clear) restocks it');
assert.equal(run('snackKey(5)'), 0, 'after dark, her room keeps the same cart');
assert.equal(run('SNACK_CARTS[2].vending'), true, 'the lounge’s cart is its vending machine');
const cartsOnFloor = run(
  '(()=>{const r0=state.room,bad=[];for(const k of Object.keys(SNACK_CARTS)){state.room=+k;const c=SNACK_CARTS[k];if(!c.vending&&collides(c.x,c.y))bad.push(k)}state.room=r0;return bad.join()})()'
);
assert.equal(cartsOnFloor, '', 'every cart stands on open floor');
run('for(const id of [0,1,2,3,4,5]){loadRoom(id);enemies=[];drawWorld();snackStock[snackKey(id)]=time+90;drawWorld()}');
// Floor drops: walking over one pockets it; a full pocket leaves it; it blinks out after 30 s; three at most.
run('loadRoom(1);enemies=[];encounter.complete=true;state.food=0;wardDrops=[];player.x=200;player.y=500;wardDropNutrient(600,450)');
assert.equal(run('wardDrops.length'), 1);
run('drawWorld();player.x=600;player.y=450;updateWorld(1/60)');
assert.equal(run('state.food'), 1, 'walking over a drop pockets it');
assert.equal(run('wardDrops.length'), 0);
assert.equal(nodes.touchEatCount.textContent, '1', 'and EAT counts it');
run('state.food=maxFood();floats=[];wardDropNutrient(600,450);updateWorld(1/60)');
assert.equal(run('wardDrops.length'), 1, 'a full pocket leaves the drop on the floor');
assert.ok(run('floats.some(f=>f.text==="POCKETS FULL")'));
run('player.x=200;player.y=500;for(let i=0;i<31*20;i++)wardPickups(0.05)');
assert.equal(run('wardDrops.length'), 0, 'it is gone after 30 seconds');
run('for(let i=0;i<5;i++)wardDropNutrient(300+i*80,450)');
assert.equal(run('wardDrops.length'), 3, 'three on the floor at most');
run('loadRoom(2)');
assert.equal(run('wardDrops.length'), 0, 'they stay behind when Macy leaves');
run('wardDropNutrient(70,420)');
assert.equal(run('collides(wardDrops[0].x,wardDrops[0].y)'), false, 'a drop in the furniture slides out onto the floor');
run('wardDrops=[];state.food=0;loadRoom(0)');
console.log('PASS: a snack cart in every room (one nutrient, back after a ward clear or two minutes), and floor drops that pocket, wait and leave.');

// ---- Hallway hooks and rooms without an arcade ----
// The real hallway module is in the build now: the hooks exist and run in order.
assert.equal(run('typeof hallwayInstall'), 'function');
assert.equal(run('rooms.length'), 7);
assert.equal(run('ARCADE_COUNT'), 6);
// An earlier section rebuilt medals from rooms.map; reset to the real shape first.
run('state.medals=Array.from({length:ARCADE_COUNT},(_, i)=>state.medals[i]||[0,0,0])');
assert.equal(run('state.medals.length'), 6);
assert.equal(run('isArcadeRoom(6)'), false);
assert.equal((nodes.departmentGrid.innerHTML.match(/data-room=/g) || []).length, 6, 'no department card for the hallway');
run('loadRoom(1);enemies=[];hud();renderMap();renderHall();renderDaily()');
assert.equal((nodes.passport.innerHTML.match(/passport-row/g) || []).length, 6, 'the passport lists six arcades');
assert.ok(!/Hallway/.test(nodes.hallStats.innerHTML), 'no grudge for the hallway');
for (let d = 1; d < 120; d++) assert.ok(run('dailyPick("2027-01-" + ' + d + ').id') < 6);
run(`var hookLog = [];
var realBg = hallwayRoomBg, realRend = roomExtraRenderables, realOverlay = drawRoomOverlay, realUpdate = updateRoomExtras;
hallwayRoomBg = function (g) { hookLog.push('bg'); return realBg(g); };
roomExtraRenderables = function (all) { hookLog.push('renderables'); return realRend(all).map(r => ({ y: r.y, draw(g) { hookLog.push('extraDraw'); r.draw(g); } })); };
drawRoomOverlay = function (g, w, h) { hookLog.push('overlay'); return realOverlay(g, w, h); };
updateRoomExtras = function (dt) { hookLog.push('update'); return realUpdate(dt); };
roomImages.delete(6);
loadRoom(6);`);
assert.match(nodes.sceneTag.textContent, /HALLWAY/);
assert.equal(run('tryOpenArcade(6)'), false, 'no arcade in the hallway');
assert.equal(run('mini.open'), false);
assert.equal(run('enemies.length'), 0, 'no gremlins in the hallway');
run('hookLog=[];drawWorld()');
const draw = run('hookLog.filter((h, i, a) => h !== "extraDraw" || a[i - 1] !== "extraDraw").join(",")');
assert.equal(draw, 'bg,renderables,extraDraw,overlay', 'background, depth-sorted extras, then the overlay: ' + draw);
run('hookLog=[];advanceSimulation(1/60)');
assert.ok(run('hookLog.includes("update")'), 'updateRoomExtras runs each step');
// A wide room: the camera scrolls past 1000 and the right wall is the room width.
run('player.x=3000;player.y=400;cameraX=0;for(let i=0;i<180;i++)drawWorld()');
assert.ok(run('cameraX') > 1000, 'the camera follows into the wide room: ' + run('cameraX'));
assert.ok(run('Array.from({ length: 100 }, (_, i) => 2000 + i * 12).some(x => !collides(x, 400))'), 'the floor extends well past 1000');
assert.equal(run('collides(3250, 400)'), true, 'and stops at the far wall');
// Actions go to the hallway first: Enter in the hallway is claimed (there is no arcade station).
assert.equal(run('roomExtrasAction("enter")'), true);
run('hallwayRoomBg=realBg;roomExtraRenderables=realRend;drawRoomOverlay=realOverlay;updateRoomExtras=realUpdate;loadRoom(1);enemies=[]');
console.log('PASS: hallway hooks run in order, a room without an arcade is tolerated, and a wide room scrolls.');
