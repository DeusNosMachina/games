// Macy's room and her life in it: the saved contracts (stats, stickers, cards, jersey), idles and
// reactions, the room's hotspots (the E-Type, the TV, the get-well wall), TV channels and the cat cam,
// the cats' card, the wall at every size, the medal grin, the window by time of day, the ambience
// under reduced motion, and the title building.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, events, nodes, assert } = require('./harness.cjs');

const saved = () => JSON.parse(run('localStorage.getItem(STORE)'));
const key = (k, extra = {}) => events.keydown({ key: k, target: {}, repeat: false, preventDefault: () => {}, ...extra });
const keyUp = k => events.keyup({ key: k, target: {}, preventDefault: () => {} });
const step = (seconds, dt = 0.05) => run(`for (let i = 0; i < ${Math.round(seconds / dt)}; i++) advanceSimulation(${dt})`);

function freshPage(env, body) {
  const code = `const { run, nodes, events, close, assert } = require(${JSON.stringify(path.join(__dirname, 'harness.cjs'))});\n${body}`;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return r.stdout;
}

run('let rng = 2207; Math.random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; }');

// ---- Saved contracts ----
assert.deepEqual(run('JSON.stringify(state.stats)'), '{}', 'stats start empty');
assert.equal(run('Array.isArray(state.stickers) && state.stickers.length'), 0);
assert.equal(run('Array.isArray(state.cards) && state.cards.length'), 0);
assert.equal(run('state.jersey'), 22, 'jersey 22 by default');
assert.equal(run('player.pose'), '', 'no pose on load');
run(`(state.stats ||= {}).evictions = 4;
state.stats.idles = 2;
state.stickers.push('night-owl', 'cat-lady');
state.cards.push({ who: 'dad', name: 'Dad', text: 'Proud of you, kid.', day: '2026-11-02' });
state.jersey = 22;
save()`);
const blob = saved();
assert.deepEqual(blob.stats, { evictions: 4, idles: 2 });
assert.deepEqual(blob.stickers, ['night-owl', 'cat-lady']);
assert.deepEqual(blob.cards, [{ who: 'dad', name: 'Dad', text: 'Proud of you, kid.', day: '2026-11-02' }]);
assert.equal(blob.jersey, 22);
freshPage(
  { GF_PRELUDE: `localStorage.setItem('gut-feeling-v2', ${JSON.stringify(JSON.stringify({ ...blob, jersey: 7 }))})` },
  `assert.equal(run('JSON.stringify(state.stats)'), '{"evictions":4,"idles":2}');
assert.equal(run('state.stickers.join()'), 'night-owl,cat-lady');
assert.equal(run('state.cards.length'), 1);
assert.equal(run('state.cards[0].name'), 'Dad');
assert.equal(run('state.cards[0].day'), '2026-11-02');
assert.equal(run('state.jersey'), 7);`
);
// Junk in a save falls back to safe defaults.
const junk = {
  stats: { ok: 3, bad: 'x', nan: null, __proto__x: 1 },
  stickers: ['a', 5, null, 'b'],
  cards: [null, 'card', { who: 'mimi', name: 'Mimi', text: 'Cookies.', day: 3 }, { who: 'x' }],
  jersey: 'twenty-two'
};
freshPage(
  { GF_PRELUDE: `localStorage.setItem('gut-feeling-v2', ${JSON.stringify(JSON.stringify(junk))})` },
  `assert.equal(run('state.stats.ok'), 3);
assert.equal(run('"bad" in state.stats || "nan" in state.stats'), false);
assert.equal(run('state.stickers.join()'), 'a,b');
assert.equal(run('state.cards.length'), 1, 'only cards with a name or text survive');
assert.equal(run('state.cards[0].day'), '', 'a card day that is not a string is blanked');
assert.equal(run('state.jersey'), 22, 'a bad jersey falls back to 22');`
);
run('state.stats = {}; state.stickers = []; state.cards = []; save()');
console.log('PASS: stats, stickers, cards and jersey round-trip through save/load and survive junk.');

// ---- Idles ----
run('begin(); loadRoom(0); player.x = 505; player.y = 470; enemies = []');
const MACY_IDLES = JSON.parse(run('JSON.stringify(MACY_IDLES)'));
assert.deepEqual(MACY_IDLES, ['look', 'ball', 'scrunchie', 'dance', 'yawn', 'iv']);
let waited = 0;
while (!run('player.pose') && waited < 8) {
  step(0.05);
  waited += 0.05;
}
assert.ok(waited >= 3.99 && waited <= 7.06, `an idle starts after 4 to 7 s of stillness (took ${waited.toFixed(2)} s)`);
assert.ok(MACY_IDLES.includes(run('player.pose')), 'the pose is an idle');
assert.equal(run('state.stats.idles'), 1, 'idles are counted');
assert.equal(saved().stats.idles, 1, 'and saved');
run('drawWorld()');
key('d');
run('advanceSimulation(1/60)');
assert.equal(run('player.pose'), '', 'a key cancels the idle at once');
keyUp('d');
// The whole rotation plays, every idle draws, and each one ends on its own.
for (let i = 0; i < MACY_IDLES.length + 1; i++) {
  let t = 0;
  while (!run('player.pose') && t < 8) {
    step(0.1);
    t += 0.1;
  }
  assert.ok(run('macyIsIdle()'), 'another idle after another quiet spell');
  for (let k = 0; k < 6; k++) {
    run('drawWorld(); girl(c, 0, 0, 1, 0, -1, false, true, macyAct())');
    step(0.5);
  }
}
assert.ok(run('state.stats.idles') >= 8);
// Paused, a modal, or the arcade: idles stop.
run('macySetPose("dance"); setWardPause(true); advanceSimulation(1/60)');
assert.equal(run('player.pose'), '', 'pausing ends an idle');
run('setWardPause(false)');
console.log('PASS: an idle starts after 4 to 7 s without input, cycles through all six, and a key cancels it.');

// No idle while gremlins are up (Macy is made untouchable so the fight cannot end the test).
run('state.wardClears[1] = 0; loadRoom(1); player.inv = 1000; player.x = 160; player.y = 520');
assert.ok(run('enemies.length') > 0, 'room 1 starts a fight');
let idled = false;
for (let i = 0; i < 100; i++) {
  run('player.inv = 1000; advanceSimulation(0.1)');
  if (run('macyIsIdle()')) idled = true;
}
assert.equal(idled, false, 'no idle during live combat');
assert.equal(run('roomSpotsBlocked()'), true, 'hotspots wait out a fight');
console.log('PASS: no idles with live gremlins.');

// Reactions: a hit flinches, a cleared wave fist-pumps, a medal grins and then lets go.
run('loadRoom(1); advanceSimulation(1/60); player.inv = 0; player.shield = 0; player.z = 0; state.hp = 5; damage("blob")');
for (let i = 0; i < 12 && run('player.pose') !== 'flinch'; i++) run('advanceSimulation(1/60)');
assert.equal(run('player.pose'), 'flinch', 'a hit flinches');
step(0.6);
assert.notEqual(run('player.pose'), 'flinch', 'the flinch is short');
run('state.hp = 5; player.inv = 1000; enemies.forEach(e => { e.hp = 0; e.emerge = 0; })');
let pumped = false;
for (let i = 0; i < 30 && !pumped; i++) {
  run('player.inv = 1000; advanceSimulation(1/60)');
  if (run('player.pose') === 'pump') pumped = true;
}
assert.ok(pumped, 'clearing a wave fist-pumps');
run('drawWorld()');
run('loadRoom(0); enemies = []');
assert.equal(run('macyCelebrate()'), true);
assert.equal(run('player.pose'), 'grin', 'macyCelebrate() sets the medal grin');
run('openMini(1); drawResultArt(); miniBed(c, 100, 100, 1)');
run('for (let i = 0; i < 30; i++) updateWorld(0.05)');
assert.equal(run('player.pose'), 'grin', 'the grin plays on while the arcade is open');
run('for (let i = 0; i < 40; i++) updateWorld(0.05)');
assert.equal(run('player.pose'), '', 'and clears by itself');
run('mini.open = false; mini.screen = "lobby"; for (const d of $$("dialog")) d.close(); state.paused = false');
console.log('PASS: flinch on a hit, fist-pump on a cleared wave, macyCelebrate() grins and clears.');

// ---- Hotspots: the E-Type, the TV, the wall ----
run('loadRoom(0); enemies = []; player.x = 307; player.y = 290');
assert.equal(run('roomSpotNear() && roomSpotNear().id'), 'etype');
run('floats = []');
key(' ');
assert.equal(run('floats.length'), 1, 'Space at the E-Type shows a line');
assert.equal(run('floats[0].lines.join(" ")'), run('ETYPE_LINES[0]'));
assert.equal(run('ETYPE_LINES[0]'), 'She built this. 1,000 pieces. Zero regrets.');
assert.equal(run('roomAction("use")'), true, 'E works too');
assert.equal(run('floats[1].lines.join(" ")'), run('ETYPE_LINES[1]'), 'the lines rotate');
assert.equal(run('player.attack'), 0, 'no pillow swing at the cabinet');
assert.equal(run('roomSpotAction("enter")'), false, 'Enter next to the beacon still opens the arcade');
run('drawWorld()');
assert.ok(run('ETYPE_LINES.every(l => !l.includes("\\u2014"))'), 'no em dashes');

run('player.x = 705; player.y = 252');
assert.equal(run('roomSpotNear().id'), 'tv');
assert.equal(run('tvChannel()'), 0, 'the cat cam is on by default');
assert.equal(run('roomAction("attack")'), true);
assert.equal(run('tvChannel()'), 1, 'the action changes the channel');
assert.equal(run('roomSpotAction("enter")'), true, 'Enter works away from the beacon');
assert.equal(run('tvChannel()'), 2);
key(' ');
assert.equal(run('tvChannel()'), 0, 'channels cycle back to the cat cam');
assert.equal(run('TV_CHANNELS.join()'), 'CAT CAM,RAMS GAME,GET WELL');
for (let ch = 0; ch < 3; ch++) {
  run('drawWorld(); advanceSimulation(0.3); drawWorld()');
  run('roomAction("attack")');
}
// A tap (or click) on the screen changes the channel from anywhere; a tap on the floor does not.
run('player.x = 505; player.y = 470');
assert.equal(run('roomAction("tap", { x: 700, y: 70 })'), true, 'tapping the TV is the remote');
assert.equal(run('tvChannel()'), 1);
assert.equal(run('roomAction("tap", { x: 500, y: 400 })'), false, 'a tap on the floor is a walk');
run('roomSpotClick({ clientX: 700, clientY: 70, detail: 1 })');
assert.equal(run('tvChannel()'), 2, 'a mouse click on the TV changes it too');
run('tvChannels[0] = 0');
console.log('PASS: the E-Type and the TV answer Space, E, Enter, taps and clicks; channels cycle.');

// ---- The cat cam and the cats' card ----
run('state.stats = {}; state.cards = []; loadRoom(0); enemies = []; player.x = 505; player.y = 470');
step(2.5);
assert.equal(run('state.stats.catCam || 0'), 0, 'not yet three seconds');
step(0.7);
assert.equal(run('state.stats.catCam'), 1, 'three seconds of cat cam counts');
assert.equal(run('state.cards.filter(c => c.who === "cats").length'), 1, 'the cats send a card');
assert.deepEqual(run('JSON.stringify(state.cards[0])'), JSON.stringify({
  who: 'cats',
  name: 'Addie, Stella and Pepper',
  text: 'We knocked your water glass off the table. For you.',
  day: run('dailyToday()')
}));
assert.match(nodes.toast.textContent, /paws/);
step(6);
assert.equal(run('state.stats.catCam'), 1, 'one count per sitting');
run('tvChange(); tvChange(); tvChange()');
step(3.2);
assert.equal(run('state.stats.catCam'), 2, 'coming back to the channel is a new sitting');
run('loadRoom(5)');
step(3.2);
assert.equal(run('state.stats.catCam'), 3, 'the TV in the room after dark counts too');
assert.equal(run('state.cards.filter(c => c.who === "cats").length'), 1, 'the cats only send one card');
assert.equal(saved().stats.catCam, 3, 'catCam is saved');
run('macySeedCatCard(); loadRoom(0)');
assert.equal(run('state.cards.length'), 1, 'seeding twice changes nothing');
assert.equal(run('state.stats.catCard'), 1, 'the card is remembered as sent');
run('state.cards = []; loadRoom(0); macySeedCatCard()');
assert.equal(run('state.cards.length'), 0, 'a cleared wall does not get a second cat card');
run('tvChange(); loadRoom(2); advanceSimulation(1/60)');
assert.equal(run('tvChannel()'), 0, 'the lounge TV keeps its own channel');
run('tvChannels[0] = 0');
console.log('PASS: three seconds on the cat cam counts catCam, and the cats send their card exactly once.');

// ---- The wall ----
// The cast's ids, plus two retired ones (kenzie, nurse) that fall back to the star.
const WHO = ['dad', 'brother', 'mimi', 'dodo', 'presley', 'norah', 'taylor', 'casey', 'stephanie', 'julez', 'lori', 'benedetto', 'barb', 'rowdy', 'cats', 'kenzie', 'nurse'];
const card = i => `{ who: ${JSON.stringify(WHO[i % WHO.length])}, name: 'Friend ${i}', text: 'Card ${i}', day: '' }`;
for (const who of [...WHO, 'someone-new', '']) run(`cardDoodle(c, ${JSON.stringify(who)}, 0, 0, 1); getWellCard(c, { who: ${JSON.stringify(who)}, name: 'X', text: 'Y' })`);
for (const n of [0, 1, 12, 20]) {
  run(`state.cards = [${Array.from({ length: n }, (_, i) => card(i)).join(',')}]`);
  const lay = JSON.parse(run('(() => { const l = wallCardsArt(c, state.cards); return JSON.stringify({ slots: l.slots.length, stack: l.stack }); })()'));
  assert.deepEqual(lay, n > 12 ? { slots: 11, stack: n - 11 } : { slots: n, stack: 0 }, `${n} cards lay out`);
  run('loadRoom(0); drawWorld(); loadRoom(5); drawWorld()');
}
assert.equal(run('wallCardLayout(state.cards).slots[10].card.name'), 'Friend 19', 'the newest card is drawn last, on top');
run('state.cards = [null, "x", { who: "julez", name: "Julez", text: "Drink water." }]; loadRoom(0); drawWorld()');
assert.equal(run('cardShortName("Addie, Stella and Pepper")'), 'Addie +2');
run('player.x = 160; player.y = 300; floats = []');
assert.equal(run('roomSpotNear().id'), 'wall');
assert.equal(run('roomAction("attack")'), true);
assert.match(run('floats[0].lines.join(" ")'), /Drink water\..*Julez/, 'the wall reads the newest card');
run('state.cards = []; floats = []; roomAction("attack")');
assert.match(run('floats[0].text'), /No cards yet/);
run('drawWorld()');
console.log('PASS: the wall draws 0, 1, 12 and 20 cards (a +N stack past twelve) and reads the newest.');

// ---- Time of day, rooms and the title ----
const hours = { 8: 'morning', 14: 'afternoon', 18: 'dusk', 23: 'night', 3: 'night' };
for (const [h, part] of Object.entries(hours)) {
  run(`Date.prototype.getHours = function () { return ${h}; }`);
  assert.equal(run('roomDaypart()'), part, `${h}:00 is ${part}`);
  for (const room of [0, 1, 2, 3, 4, 5]) {
    run(`loadRoom(${room}); enemies = []; drawWorld(); advanceSimulation(0.1); drawWorld()`);
    assert.equal(run(`roomImages.get(${room}).daypart`), room === 5 ? 'night' : part, `room ${room} paints ${part}`);
  }
}
run('drawTitleArt(c, 1280, 820, 3, false); drawTitleArt(c, 390, 844, 3, true); drawTitleArt(c, 1920, 1080, 1, false)');
assert.equal(run('TITLE_HOSPITAL'), 'VALLEY HOSPITAL');
assert.equal(run('TITLE_FLOORS - TITLE_MACY_FLOOR'), 1, 'Macy is on the 7th of 8 floors');
assert.equal(run('ROOM_SIGN.title + " · " + ROOM_SIGN.floor'), 'MACY · ROOM 5 · 7TH FLOOR');
assert.equal(run('ROOM_SIGN.sub'), 'GREMLINS NOT FOUND');
for (const n of [22, 7, 10, 99, 0]) run(`state.jersey = ${n}; girl(c, 0, 0); titleSilhouette(c, 0, 0, 60, 40)`);
run('state.jersey = 22');
console.log('PASS: every room paints morning, afternoon, dusk and night; room 5 stays night; the title draws.');

// ---- Reduced motion: no sway, no motes, no nurse ----
const recorder = `
  var rec = {};
  var recCtx = calls => new Proxy({ createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (t, k) => t[k] || ((...a) => { calls[k] = (calls[k] || 0) + 1; }),
    set: (t, k, v) => { t[k] = v; return true; }
  });
  Date.prototype.getHours = function () { return 14; };
  time = 1;
  for (const [name, draw] of [['curtains', g => roomCurtains(g, 0)], ['motes', g => roomMotes(g, 0)], ['nurse', g => roomNurse(g, 0)], ['hum', g => roomHum(g, 1)]]) {
    rec[name] = {};
    draw(recCtx(rec[name]));
  }
`;
run(recorder);
assert.equal(run('roomSwayCurtains(0)'), true);
assert.ok(Math.abs(run('roomCurtainSway(-1, 0)')) > 0, 'curtains sway');
assert.equal(run('rec.curtains.drawImage'), 2, 'two curtain sprites, two draws');
assert.equal(run('rec.motes.arc'), 16, 'sixteen dust motes in one path');
assert.equal(run('rec.motes.fill'), 1, 'one fill for all of them');
assert.equal(run('rec.nurse.clip'), 1, 'a nurse walks past the door glass');
assert.equal(run('rec.hum.fillRect'), 1, 'the MRI hum is one translucent wash');
freshPage(
  { GF_REDUCED_MOTION: '1' },
  `assert.equal(run('reduced'), true);
run(${JSON.stringify(recorder)});
assert.equal(run('roomSwayCurtains(0)'), false, 'curtains hold still');
assert.equal(run('roomCurtainSway(-1, 0)'), 0);
assert.equal(run('Object.keys(rec.curtains).length'), 0, 'curtains are part of the cached room instead');
assert.equal(run('Object.keys(rec.motes).length'), 0, 'no motes');
assert.equal(run('Object.keys(rec.nurse).length'), 0, 'no nurse');
assert.equal(run('Object.keys(rec.hum).length'), 0, 'no hum');
run('begin(); loadRoom(0); drawWorld(); loadRoom(2); drawWorld()');`
);
console.log('PASS: curtains sway, motes drift and a nurse passes; reduced motion stills all of it.');
