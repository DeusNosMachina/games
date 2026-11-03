// Stickers, the medal ceremony and share cards: the sticker table and its tests, stickerCheck awarding
// once and saving, the badge pop queue, the ceremony's phases (and the tap, key and reduced-motion
// skips), the share card drawing at 1080 × 1350 and choosing share or save, the sticker sheet, and
// the department cards keeping their art's shape. Reduced motion runs in a child process.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, nodes, events, close, assert } = require('./harness.cjs');

const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));
const REDUCED = !!process.env.GF_REDUCED_MOTION;

run('wardLocked = () => false');
run('let rng = 5150; Math.random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; }');
run('begin()');
run('var sfxLog = []; var realSfx = sfx; sfx = (n, o) => { sfxLog.push(n); return realSfx(n, o); }');
run(`var macySpy = null;
  try {
    const prev = typeof macyCelebrate === 'function' ? macyCelebrate : null;
    macyCelebrate = g => { macySpy.push(g); if (prev) prev(g); };
    macySpy = [];
  } catch (e) { macySpy = null; }`);

// Wins a run of game id with the given performance (88+ is gold, 68+ silver, else bronze).
function winRun(id, quality, score = 1500, setup = '') {
  run(
    `openMini(${id}); startMini(); launchMini(); updateMini(INTRO_SECONDS + 0.1); mini.score = ${score}; ` +
      `games[${id}].quality = () => ${quality}; ${setup} finishMini(true); updateMini(2.3)`
  );
  assert.equal(run('mini.screen'), 'result');
}

if (REDUCED) {
  // ---- Reduced motion: the ceremony opens on its final state, with no confetti. ----
  assert.equal(run('reduced'), true);
  run('sfxLog = []; var rowdyPoses = []; var realRowdy = drawRowdy; drawRowdy = (...a) => { rowdyPoses.push(a[4]); return realRowdy(...a); }');
  winRun(1, 95, 2222);
  assert.equal(run('ceremony.phase'), 'done', 'reduced motion starts on the last phase');
  assert.equal(run('ceremony.t'), run('CEREMONY_SECONDS'));
  assert.equal(run('ceremonyRunning()'), false);
  assert.equal(run('ceremony.fx.length'), 0, 'no confetti');
  const log = json('sfxLog');
  assert.ok(log.indexOf('hit') >= 0 && log.indexOf('hit') < log.indexOf('win'), 'the thud, then the win sting');
  assert.deepEqual(json('ceremony.shown'), json('ceremony.tiles.map(t => t.to)'), 'tiles show their final numbers');
  assert.equal(nodes.resultNum0.textContent, '2222');
  assert.equal(nodes.resultMedalArt.style.transform, '', 'the medal is at rest');
  assert.equal(nodes.resultStamp.dataset.stamped, '1');
  run('drawMini(); updateMini(0.5); drawMini()');
  assert.equal(run('ceremony.fx.length'), 0, 'still no confetti after time passes');
  assert.ok(json('rowdyPoses').every(p => p === 'cheer') && json('rowdyPoses').length > 0, 'gold: Rowdy is already cheering');
  console.log('PASS (reduced motion): the ceremony opens finished, sounds intact, no confetti, Rowdy already cheering.');
  process.exit(0);
}

// ---- The table ----
const table = json('STICKERS.map(s => ({ id: s.id, name: s.name, blurb: s.blurb, hint: s.hint, tone: s.tone, shape: s.shape, icon: s.icon, group: s.group }))');
assert.ok(table.length >= 30, `at least 30 stickers (${table.length})`);
for (const key of ['id', 'name', 'blurb', 'hint']) {
  const values = table.map(s => s[key]);
  assert.ok(values.every(v => typeof v === 'string' && v.length > 1), `every sticker has a ${key}`);
  assert.equal(new Set(values).size, values.length, `sticker ${key}s are unique`);
}
for (const s of table) {
  assert.ok(['mint', 'coral', 'yellow'].includes(s.tone), `${s.id} tone`);
  assert.ok(['round', 'shield'].includes(s.shape), `${s.id} shape`);
  assert.equal(run(`typeof STICKER_ICONS[${JSON.stringify(s.icon)}]`), 'function', `${s.id} icon painter`);
  assert.ok(json('STICKER_GROUPS').includes(s.group), `${s.id} group`);
  assert.ok(!/—/.test(s.name + s.blurb + s.hint), `${s.id}: no em-dashes in the house voice`);
}
for (const empty of ['{}', '{ stats: {} }', 'null']) {
  const kinds = json(`STICKERS.map(s => typeof s.test(${empty}))`);
  assert.ok(kinds.every(k => k === 'boolean'), `every test returns a boolean for ${empty}`);
  assert.deepEqual(json(`STICKERS.filter(s => s.test(${empty})).map(s => s.id)`), [], `${empty} earns nothing`);
}
console.log(`PASS: ${table.length} stickers with unique ids, names and blurbs; every test is boolean and quiet on an empty state.`);

// ---- Crafted states ----
run(`function stickerBase() {
  return { medals: Array.from({ length: 6 }, () => [0, 0, 0]), wardClears: [0, 0, 0, 0, 0, 0], stats: {},
    daily: { streak: 0 }, upgrades: [], cosmetics: { owned: [], worn: [] }, evictions: 0, bestChain: 0, coinsEarned: 0, runs: 0 };
}
function stickerTry(id, edit) {
  const st = stickerBase();
  edit(st);
  return stickerById(id).test(st);
}`);
const cases = [
  ['first-medal', 'st.medals[2][0] = 1', 'st.medals[2][0] = 0'],
  ['first-gold', 'st.medals[3][1] = 3', 'st.medals[3][1] = 2'],
  ['gold-everywhere', 'st.medals.forEach(m => (m[0] = 3))', 'st.medals.slice(1).forEach(m => (m[0] = 3))'],
  ['code-brown', 'st.medals.forEach(m => (m[2] = 1))', 'st.medals.forEach((m, i) => (m[2] = i ? 1 : 0))'],
  ['twelve-stars', 'st.medals[0] = [3, 3, 3]; st.medals[1] = [3, 0, 0]', 'st.medals[0] = [3, 3, 3]; st.medals[1] = [2, 0, 0]'],
  ['chain-10', 'st.bestChain = 10', 'st.bestChain = 9'],
  ['chain-25', 'st.bestChain = 25', 'st.bestChain = 24'],
  ['flawless', 'st.stats.flawless = 1', 'st.stats.flawless = 0'],
  ['iv-clutch', 'st.stats.ivClutch = 1', 'st.stats.ivClutch = 0'],
  ['frequent-flyer', 'st.stats.recovered = 5', 'st.stats.recovered = 4'],
  ['arcade-rat', 'st.runs = 50', 'st.runs = 49'],
  ['evict-100', 'st.evictions = 100', 'st.evictions = 99'],
  ['evict-500', 'st.evictions = 500', 'st.evictions = 499'],
  ['ward-mri', 'st.wardClears[1] = 1', 'st.wardClears[2] = 1'],
  ['ward-lounge', 'st.wardClears[2] = 1', 'st.wardClears[1] = 1'],
  ['ward-ct', 'st.wardClears[3] = 1', 'st.wardClears[4] = 1'],
  ['ward-ultrasound', 'st.wardClears[4] = 1', 'st.wardClears[3] = 1'],
  ['grudge-3', 'st.wardClears[4] = 3', 'st.wardClears = [0, 2, 2, 2, 2, 0]'],
  ['ralph-who', 'st.ralph = true', 'st.ralphReady = true'],
  ['discharged', 'st.won = true', 'st.ralph = true'],
  ['dad-10', 'st.stats.dadJokes = 10', 'st.stats.dadJokes = 9'],
  ['dad-50', 'st.stats.dadJokes = 50', 'st.stats.dadJokes = 49'],
  ['ensure-5', 'st.stats.ensureRefused = 5', 'st.stats.ensureRefused = 4'],
  ['ensure-20', 'st.stats.ensureRefused = 20', 'st.stats.ensureRefused = 19'],
  ['rowdy-fan', 'st.stats.cheers = 10', 'st.stats.cheers = 9'],
  ['socialite', 'st.stats.talked = STICKER_CAST.map(id => (id === "nurse" ? "nurse3" : id))', 'st.stats.talked = STICKER_CAST.slice(1)'],
  ['socialite', 'st.stats.talks = Object.fromEntries(STICKER_CAST.map(id => [id, 2]))', 'st.stats.talks = { dad: 3 }'],
  ['socialite', 'st.stats.talks = 10', 'st.stats.talks = 9'],
  ['cat-cam', 'st.stats.catCam = 5', 'st.stats.catCam = 4'],
  ['pillow-fort', 'st.stats.idles = 10', 'st.stats.idles = 9'],
  ['mogul', 'st.coinsEarned = 1000', 'st.coinsEarned = 999'],
  ['gift-shop-royalty', 'st.upgrades = SHOP_UPGRADE_IDS.slice()', 'st.upgrades = SHOP_UPGRADE_IDS.slice(1)'],
  ['fit-check', 'st.cosmetics.worn = SHOP_LOOK_IDS.slice()', 'st.cosmetics.owned = SHOP_LOOK_IDS.slice(); st.cosmetics.worn = SHOP_LOOK_IDS.slice(1)'],
  ['daily-3', 'st.daily.streak = 3', 'st.daily.streak = 2'],
  ['daily-7', 'st.daily.streak = 7', 'st.daily.streak = 6'],
  ['regular', 'st.stats.days = 5', 'st.stats.days = 4']
];
for (const [id, yes, no] of cases) {
  assert.equal(run(`stickerTry('${id}', st => { ${yes}; })`), true, `${id} earned by: ${yes}`);
  assert.equal(run(`stickerTry('${id}', st => { ${no}; })`), false, `${id} not earned by: ${no}`);
}
const covered = new Set(cases.map(c => c[0]));
assert.deepEqual(table.map(s => s.id).filter(id => !covered.has(id)), [], 'every sticker has a crafted case');
console.log(`PASS: ${cases.length} crafted states earn (and just miss) their stickers, every sticker covered.`);

// ---- stickerCheck: awards once, saves, counts days ----
run('var saves = 0; var realSave = save; save = () => { saves++; return realSave(); }');
run('state.stickers = []; state.stats = { lastDay: 20200101, days: 4 }; state.bestChain = 12; state.medals[1][0] = 1; stickerPopClear()');
let fresh = json('stickerCheck()');
assert.ok(['first-medal', 'chain-10', 'regular'].every(id => fresh.includes(id)), `first check awards (${fresh})`);
assert.equal(run('state.stats.days'), 5, 'a new day counts once');
assert.equal(run('state.stats.lastDay'), run('stickerDayNumber()'));
assert.ok(run('saves') >= 1, 'awarding saves');
const savedOnce = run('saves');
assert.deepEqual(json('stickerCheck()'), [], 'a second check awards nothing');
assert.equal(run('saves'), savedOnce, 'and saves nothing');
assert.equal(run('state.stats.days'), 5, 'the same day never counts twice');
assert.equal(json('state.stickers').length, new Set(json('state.stickers')).size, 'no duplicates');
const stored = JSON.parse(run('localStorage.getItem(STORE)'));
if ('stickers' in stored) assert.deepEqual(stored.stickers, json('state.stickers'), 'the save carries the stickers');
if ('stats' in stored) assert.equal(stored.stats.days, 5, 'the save carries the day count');
run('state.started = false; state.stats.lastDay = 20200101'); // the title screen does not count as a day played
run('stickerCheck()');
assert.equal(run('state.stats.days'), 5);
run('state.started = true');
assert.equal(nodes.stickerCardCount.textContent, `${json('state.stickers').length} / ${table.length}`, 'the sidebar card counts');
console.log('PASS: stickerCheck awards once, saves, counts each day once, and updates the sidebar card.');

// ---- The badge pop ----
run('sfxLog = []');
assert.ok(run('stickerQueue.length') >= 1, 'new stickers queue pops');
run('stickerPopClear(); state.stickers = state.stickers.filter(id => id !== "chain-10" && id !== "regular"); stickerCheck()');
assert.equal(run('stickerQueue.length'), 2, 'two new stickers, two pops');
run('stickerTick(0.01)');
assert.ok(run('!!stickerPopNow'), 'the first pop shows');
assert.equal(nodes.stickerPopName.textContent, run('stickerById(stickerPopNow.ids[0]).name'));
assert.equal(nodes.stickerPopKicker.textContent, 'STICKER');
assert.ok(json('sfxLog').includes('daily'), 'with the daily chime');
run('stickerTick(STICKER_POP_SECONDS)');
assert.equal(run('stickerPopNow'), null, 'it clears after its time');
run('stickerTick(STICKER_POP_GAP + 0.01); stickerTick(0.01)');
assert.ok(run('!!stickerPopNow'), 'the next one follows after a short gap');
run('stickerTick(STICKER_POP_SECONDS); for (let i = 0; i < 10; i++) stickerTick(0.5)');
assert.equal(run('stickerPopNow'), null);
assert.equal(run('stickerQueue.length'), 0, 'the queue drains');
run('stickerQueueFresh(["mogul", "cat-cam", "dad-10", "dad-50", "fit-check"])');
assert.equal(run('stickerQueue.length'), 1, 'a big haul is one pop');
run('stickerTick(0.01)');
assert.equal(nodes.stickerPopName.textContent, '5 new on your sheet');
assert.equal(nodes.stickerPopKicker.textContent, 'STICKERS');
run('stickerPopClear(); stickerQueueFresh(["mogul"]); openMini(2); startMini(); launchMini(); updateMini(2); stickerTick(0.5)');
assert.equal(run('stickerPopNow'), null, 'pops wait while an arcade run plays');
close();
run('stickerTick(0.01)');
assert.ok(run('!!stickerPopNow'), 'and show once it is over');
run('stickerPopClear()');
console.log('PASS: the badge pop queues, shows one at a time with a chime, clears, bundles a big haul, and waits out runs.');

// ---- Run counters from the result ----
run('state.stats.flawless = 0; state.stats.ivClutch = 0; state.stats.recovered = 0; state.stickers = state.stickers.filter(id => id !== "flawless" && id !== "iv-clutch")');
winRun(0, 70, 900, 'mini.miss = 2;');
assert.equal(run('state.stats.ivClutch'), 1, 'an IV win on two strikes counts');
assert.equal(run('state.stats.flawless'), 0, 'and is not flawless');
assert.ok(json('state.stickers').includes('iv-clutch'), 'the result checks stickers');
close();
winRun(3, 70, 900, 'mini.miss = 0;');
assert.equal(run('state.stats.flawless'), 1, 'a win with no oops counts as flawless');
assert.equal(run('state.stats.ivClutch'), 1);
close();
console.log('PASS: results count flawless wins and two-strike IV wins, then award their stickers.');

// ---- The ceremony ----
run('sfxLog = []; var rowdyPoses = []; var realRowdy = drawRowdy; drawRowdy = (...a) => { rowdyPoses.push(a[4]); return realRowdy(...a); }');
run('state.records[1] = [500, 500, 500]; state.medals[1] = [0, 0, 0]; if (macySpy) macySpy.length = 0');
winRun(1, 95, 2468);
assert.ok(run('CEREMONY_SECONDS') <= 2.5, 'the ceremony fits in 2.5 seconds');
assert.equal(run('ceremony.grade'), 3);
assert.equal(run('ceremony.phase'), 'drop');
assert.ok(!json('sfxLog').includes('win'), 'the win sting waits for the medal to land');
assert.equal(nodes.miniResult.dataset.medal, '3', 'the gold wash');
if (run('macySpy !== null')) assert.deepEqual(json('macySpy'), [3], 'macyCelebrate hears about the gold');
const phases = ['drop'];
let maxFx = 0;
for (let i = 0; i < 400 && run('ceremony.phase') !== 'done'; i++) {
  run('updateMini(1 / 60); drawMini()');
  const p = run('ceremony.phase');
  if (p !== phases[phases.length - 1]) phases.push(p);
  maxFx = Math.max(maxFx, run('ceremony.fx.length'));
}
assert.deepEqual(phases, ['drop', 'stamp', 'count', 'pop', 'done'], 'every phase, in order');
assert.deepEqual(json('ceremony.seen'), phases);
assert.ok(maxFx > 40, `confetti burst (${maxFx} pieces)`);
const log = json('sfxLog');
assert.ok(log.indexOf('hit') >= 0 && log.indexOf('hit') < log.indexOf('win'), 'thud, then win');
assert.equal(log.filter(n => n === 'hit').length, 1);
assert.equal(log.filter(n => n === 'win').length, 1);
assert.equal(log.filter(n => n === 'combo').length, 2, 'NEW BEST and NEW STARS each pop with a combo');
assert.equal(run('ceremony.t'), run('CEREMONY_SECONDS'));
assert.equal(run('ceremony.fx.length'), 0, 'the confetti has landed');
assert.deepEqual(json('ceremony.shown'), json('ceremony.tiles.map(t => t.to)'), 'the tiles counted all the way up');
assert.equal(nodes.resultNum0.textContent, '2468');
assert.equal(nodes.resultNum3.textContent, '+3 ★');
assert.equal(nodes.resultPop0.dataset.on, '1', 'NEW BEST');
assert.equal(nodes.resultPop3.dataset.on, '1', 'NEW STARS');
assert.equal(nodes.resultMedalArt.style.transform, '', 'the medal at rest');
assert.equal(nodes.resultStamp.dataset.stamped, '1', 'the ink ring stamped');
const poses = json('rowdyPoses');
assert.ok(poses.includes('gallop') && poses[poses.length - 1] === 'cheer', 'gold: Rowdy gallops in and cheers');
run('rowdyPoses = []; updateMini(1); drawMini()');
assert.deepEqual(json('rowdyPoses'), ['cheer'], 'and keeps cheering');
close();
console.log('PASS: a gold ceremony runs drop, stamp, count, pop, done in under 2.5 s with thud, sting, confetti, pops and Rowdy.');

// Bronze: no Rowdy, no pops when nothing is new, the bronze wash.
run('rowdyPoses = []; sfxLog = []; state.medals[1] = [3, 3, 3]');
winRun(1, 40, 10);
assert.equal(run('ceremony.grade'), 1);
assert.equal(nodes.miniResult.dataset.medal, '1');
assert.equal(run('ceremony.pops.length'), 0, 'no NEW BEST or NEW STARS when neither is true');
for (let i = 0; i < 200; i++) run('updateMini(1 / 60); drawMini()');
assert.equal(run('ceremony.phase'), 'done');
assert.deepEqual(json('rowdyPoses'), [], 'Rowdy saves himself for gold');
assert.equal(json('sfxLog').filter(n => n === 'combo').length, 0);
close();
console.log('PASS: a bronze ceremony keeps the bronze wash and skips Rowdy and the pops.');

// Tap and key skips; leaving stops the ceremony.
winRun(2, 80, 700);
run('updateMini(0.1); sfxLog = []');
assert.equal(run('ceremonyRunning()'), true);
nodes.miniResult.events.pointerdown({ target: { closest: () => ({ id: 'miniRetry' }) } });
assert.equal(run('ceremonyRunning()'), true, 'a tap on a button is not a skip');
nodes.miniResult.events.pointerdown({ target: { closest: () => null } });
assert.equal(run('ceremony.phase'), 'done', 'a tap skips to the end');
assert.deepEqual(json('sfxLog').filter(n => n === 'hit' || n === 'win'), ['hit', 'win'], 'the skip still lands the thud and sting');
assert.equal(run('ceremony.fx.length'), 0);
assert.deepEqual(json('ceremony.shown'), json('ceremony.tiles.map(t => t.to)'));
assert.equal(run('ceremonySkip()'), false, 'nothing left to skip');
close();
winRun(2, 80, 700);
run('updateMini(0.8)');
events.keydown({ key: 'x', target: {}, repeat: false, preventDefault() {} });
assert.equal(run('ceremony.phase'), 'done', 'a key skips to the end');
run('leaveMini()');
assert.equal(run('ceremony'), null, 'leaving stops the ceremony');
close();
run('openMini(4); startMini(); launchMini(); updateMini(2); finishMini(false); updateMini(2.3)');
assert.equal(run('ceremony'), null, 'a loss has no ceremony');
assert.equal(nodes.miniResult.dataset.medal, '0');
close();
console.log('PASS: a tap off the buttons or any key skips the ceremony; leaving or losing has none.');

// ---- Share cards ----
run(`var shareProbe = { depth: 0, bad: [], calls: 0 };
var shareCtx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'save') return () => { shareProbe.depth++; };
    if (k === 'restore') return () => { shareProbe.depth--; };
    if (k === 'measureText') return s => ({ width: String(s).length * 20 });
    return (...args) => {
      shareProbe.calls++;
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) shareProbe.bad.push(String(k));
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop() {} };
    };
  },
  set(t, k, v) { t[k] = v; return true; }
});`);
run('mini.id = 1; mini.tier = 1; mini.grade = 3; mini.score = 2468; mini.qualityFinal = 93');
assert.deepEqual(json('shareCardDraw(shareCtx, shareResultSpec())'), { w: 1080, h: 1350, kind: 'result' });
for (let id = 0; id < 6; id++)
  for (let grade = 1; grade <= 3; grade++)
    run(`shareCardDraw(shareCtx, shareResultSpec({ id: ${id}, game: games[${id}].info.game, room: rooms[${id}].name, theme: rooms[${id}].theme, grade: ${grade}, tier: ${grade - 1} }))`);
run('for (const s of STICKERS) shareCardDraw(shareCtx, shareStickerSpec(s.id))');
run('for (const s of STICKERS) { stickerBadge(shareCtx, 40, 40, 30, s, true); stickerBadge(shareCtx, 40, 40, 30, s, false); }');
assert.ok(run('shareProbe.calls') > 5000, 'the probe saw the drawing');
assert.equal(run('shareProbe.depth'), 0, 'every save() has its restore()');
assert.deepEqual(json('shareProbe.bad'), [], 'no NaN or Infinity coordinates');
const card = json('(() => { const cv = shareRender(shareStickerSpec("chain-10")); return [cv.width, cv.height]; })()');
assert.deepEqual(card, [1080, 1350], 'shareRender makes a 1080 × 1350 canvas');
assert.equal(run('shareFileName(shareResultSpec())'), 'gut-feeling-loud-donut-pinball-gold.png');
assert.equal(run('shareFileName(shareStickerSpec("chain-10"))'), 'gut-feeling-sticker-chain-10.png');
assert.match(run('shareText(shareStickerSpec("chain-10"))'), /^I earned the Spike of the Week sticker/);
assert.ok(!/—/.test(run('shareText(shareResultSpec()) + shareText(shareStickerSpec("mogul"))')), 'share copy keeps the house voice');
// Share sheet where files can be shared; a tab on touch screens; a download on laptops.
run(`var shared = []; var opened = [];
  globalThis.File = class { constructor(parts, name, o) { this.name = name; this.type = o.type; } };
  globalThis.URL = { createObjectURL: () => 'blob:card', revokeObjectURL() {} };
  globalThis.navigator = { canShare: o => !!(o.files && o.files[0] && o.files[0].type === 'image/png'), share: o => { shared.push(o); return Promise.resolve(); } };`);
assert.equal(run('shareDeliver({ size: 9 }, "card.png", "hi", null)'), 'share');
assert.equal(run('shared[0].files[0].name'), 'card.png', 'navigator.share gets the PNG as a file');
run('navigator.canShare = () => false; window.open = url => (opened.push(url), {})');
run('matchMedia = q => ({ matches: /coarse/.test(q) })');
assert.equal(run('shareDeliver({ size: 9 }, "card.png", "hi", null)'), 'tab', 'no file sharing on a phone: a new tab');
run('matchMedia = q => ({ matches: false }); window.open = () => null');
assert.equal(run('shareDeliver({ size: 9 }, "card.png", "hi", null)'), 'download', 'on a laptop: a download');
assert.equal(run('shareDeliver(null, "card.png", "hi", null)'), 'none');
assert.equal(run('sharePrepare(shareStickerSpec("mogul")) === sharePrepare(shareStickerSpec("mogul"))'), true, 'a prepared card is reused');
assert.equal(run('mini.screen = "lobby"; shareResult()'), 'none', 'the result share only works on a result');
console.log('PASS: share cards draw cleanly at 1080 × 1350 for every game, grade and sticker, and share, open or download.');

// ---- The sheet ----
run('state.stickers = ["first-medal", "chain-10", "mogul"]; stickerOpenSheet()');
assert.equal(nodes.stickerDialog.open, true);
const grid = nodes.stickerGrid.innerHTML;
assert.equal((grid.match(/data-earned="1"/g) || []).length, 3, 'earned tiles');
assert.equal((grid.match(/data-earned="0"/g) || []).length, table.length - 3, 'locked tiles');
assert.equal((grid.match(/class="card-kicker sticker-group"/g) || []).length, 4, 'four groups');
assert.match(grid, /Pocket Money Mogul/);
assert.match(grid, /Locked/);
assert.match(grid, new RegExp(json('stickerById("dad-50").hint').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'locked tiles show a hint');
assert.equal(nodes.stickerTitle.textContent, `3 of ${table.length} stickers.`);
assert.equal(nodes.stickerSpotName.textContent, 'Pocket Money Mogul', 'the spotlight opens on the latest');
assert.equal(nodes.stickerShare.disabled, false);
nodes.stickerGrid.events.click({ target: { closest: () => ({ dataset: { sticker: 'dad-50' } }) } });
assert.equal(nodes.stickerSpotName.textContent, 'Still a mystery', 'a locked sticker keeps its secret');
assert.equal(nodes.stickerShare.disabled, true, 'and cannot be shared');
nodes.stickerGrid.events.click({ target: { closest: () => ({ dataset: { sticker: 'chain-10' } }) } });
assert.equal(nodes.stickerShare.dataset.sticker, 'chain-10');
assert.match(nodes.stickerGrid.innerHTML, /class="sticker-tile selected" data-sticker="chain-10"/);
close();
nodes.pauseStickers.events.click();
assert.equal(nodes.stickerDialog.open, true, 'the pause menu opens the sheet');
close();
nodes.stickerBtn.events.click();
assert.equal(nodes.stickerDialog.open, true, 'the sidebar card opens the sheet');
close();
console.log('PASS: the sheet shows earned badges and locked hints by group, spotlights and shares the earned ones.');

// ---- Department cards keep the shape their art is drawn at ----
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const deptRules = [...css.matchAll(/([^{}]*\.dept-card canvas[^{}]*)\{([^}]*)\}/g)].map(m => m[2]);
assert.ok(deptRules.length > 0, 'dept card canvas rules exist');
assert.ok(deptRules.every(r => !/height:\s*\d+px/.test(r)), 'no fixed pixel height on the dept card art');
assert.ok(deptRules.some(r => /aspect-ratio:\s*260\s*\/\s*135/.test(r)), 'the art keeps 260 / 135');
console.log('PASS: department card art keeps its 260 × 135 aspect ratio.');

// ---- A fresh adventure clears the sheet ----
nodes.resetBtn.events.click();
nodes.resetBtn.events.click();
assert.deepEqual(json('state.stickers'), []);
assert.deepEqual(json('state.stats'), {});
console.log('PASS: starting a fresh adventure clears stickers and counters.');

// ---- Reduced motion, in its own page ----
const child = spawnSync(process.execPath, [__filename], { env: { ...process.env, GF_REDUCED_MOTION: '1' }, encoding: 'utf8' });
process.stdout.write(child.stdout);
if (child.status !== 0) {
  process.stderr.write(child.stderr);
  process.exit(child.status || 1);
}
