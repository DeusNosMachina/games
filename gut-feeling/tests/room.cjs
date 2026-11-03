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
  run('player.inv = 1000');
  step(0.1);
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
assert.equal(run('TV_CHANNELS.slice(0, 3).join()'), 'CAT CAM,RAMS GAME,GET WELL');
assert.equal(run('tvChannelCount(0)'), 3, 'three channels in her room by day');
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

// ---- The light switch: her room by day (0) and with the lights out (5) ----
const seenTexts = () => run('var seen=[];c.fillText=t=>seen.push(t);drawWorld();c.fillText=undefined;seen');
run('state.stats = {}; state.ralphReady = false; loadRoom(0); enemies = []; player.x = 255; player.y = 250; floats = []');
assert.equal(run('roomSpotNear().id'), 'switch', 'the switch by the bed is a hotspot');
assert.equal(run('collides(255, 250) || collides(255, 300)'), false, 'and Macy can walk up to it, between the bed and the nightstand');
assert.ok(seenTexts().some(t => /LIGHTS OUT$/.test(t)), 'its prompt says LIGHTS OUT');
key(' ');
assert.equal(run('state.room'), 5, 'Space at the switch turns the lights out');
assert.equal(run('player.x + "," + player.y'), '255,250', 'Macy stays where she stands');
assert.equal(nodes.roomTitle.textContent, 'Your room · lights out');
assert.match(nodes.arcadeBtn.innerHTML, /Bedside Blaster/, 'the gamebar now plays Bedside Blaster');
assert.match(nodes.toast.textContent, /Lights out/);
assert.equal(run('state.stats.lightsOut'), 1, 'lights out is counted');
assert.equal(run('roomImages.get(5) ? roomImages.get(5).daypart : "night"'), 'night');
assert.ok(seenTexts().some(t => /LIGHTS ON$/.test(t)), 'in the dark the prompt says LIGHTS ON');
run('roomAction("use")');
assert.equal(run('state.room'), 0, 'E flips it back');
assert.match(nodes.arcadeBtn.innerHTML, /Fastpitch Fever/, 'and Fastpitch Fever is back on the gamebar');
run('player.x = 600; player.y = 450');
assert.equal(run('roomAction("tap", { x: LIGHT_SWITCH.x, y: LIGHT_SWITCH.y })'), true, 'a tap on the switch works from anywhere');
assert.equal(run('state.room'), 5);
assert.equal(run('tryOpenArcade()'), true, 'the beacon opens Bedside Blaster after dark');
assert.equal(run('mini.id'), 5);
run('mini.open = false; mini.screen = "lobby"; for (const d of $$("dialog")) d.close(); state.paused = false');
run('roomSpotClick({ clientX: LIGHT_SWITCH.x, clientY: LIGHT_SWITCH.y, detail: 0 })');
assert.equal(run('state.room'), 0, 'and a mouse click on it');
run('goRoom(5)');
assert.equal(run('state.room'), 5, 'the map still goes straight to either one');
run('goRoom(0)');
// Ralph waiting in her room: hotspots (the switch too) wait out the fight.
run('state.ralphReady = true; state.ralph = false; loadRoom(1); loadRoom(0); player.x = 255; player.y = 250');
assert.equal(run('roomSpotAction("use")'), false, 'no switching the lights with Ralph in the room');
assert.equal(run('state.room'), 0);
run('state.ralphReady = false; loadRoom(1); loadRoom(0); enemies = []; state.stats = {}');
console.log('PASS: the light switch flips her room to lights out (Bedside Blaster) and back, from Space, E, a tap or a click; the map and the gamebar follow.');

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
assert.equal(run('ROOM_SIGN.title + " · " + ROOM_SIGN.floor'), 'MACY · ROOM 10 · 7TH FLOOR');
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

// ---- Macy at 5'10" ----
assert.equal(run('MACY_SCALE'), 1.36, 'MACY_SCALE is exposed for the hallway');
run(`var roomGirlScales = [];
var roomRealGirl = girl;
girl = function (...a) { roomGirlScales.push(a[3]); return roomRealGirl.apply(this, a); };
loadRoom(0); enemies = []; drawWorld();
girl = roomRealGirl`);
assert.ok(run('roomGirlScales.includes(MACY_SCALE)'), 'the player draws at MACY_SCALE');
assert.ok(run('!roomGirlScales.includes(1.24)'), 'nothing in the ward still draws her at the old scale');
console.log('PASS: Macy stands at MACY_SCALE (1.36) in the ward.');

// ---- The hospital has opinions ----
const machines = JSON.parse(run('JSON.stringify(MACHINES)'));
const order = JSON.parse(run('JSON.stringify(MACHINE_ORDER)'));
assert.deepEqual(Object.keys(machines).sort(), [...order].sort(), 'every machine is in the rotation');
const allLines = [];
for (const id of order) {
  const m = machines[id];
  assert.ok(m.lines.length >= 4 && m.lines.length <= 6, `${id} has 4 to 6 lines`);
  assert.ok(typeof m.honor === 'string' && m.honor.length > 0, `${id} has an Employee of the Month line`);
  assert.ok(typeof m.name === 'string' && m.name.length > 0, `${id} has a name`);
  allLines.push(...m.lines, m.honor);
}
assert.ok(allLines.length >= 30, `30+ lines (${allLines.length})`);
assert.equal(new Set(allLines).size, allLines.length, 'every line is unique');
assert.ok(allLines.every(l => !l.includes('\u2014') && !l.includes('\u2013')), 'no em or en dashes');
assert.equal(machines.mri.lines[0], "DON'T BRING KEYS. DON'T. I CAN FEEL THEM.");
assert.equal(machines.pump.lines[0], 'The patient approaches the window. Majestic.');
for (const id of [...order, 'nobody']) run(`drawMachineIcon(c, ${JSON.stringify(id)}, 50, 50, 1); drawMachineIcon(c, ${JSON.stringify(id)}, 0, 0, 0.5)`);

// A blurt within range, then nothing from that machine for 20 seconds.
run('state.wardClears[1] = 1; delete wardProgress[1]; loadRoom(1); enemies = []; roomBark = null');
run('player.x = 480; player.y = 560; advanceSimulation(0.05)');
assert.equal(run('roomBark'), null, 'out of range, the MRI keeps it together');
run('player.x = 480; player.y = 330; advanceSimulation(0.05)');
assert.equal(run('roomBark && roomBark.id'), 'mri', 'within range, the MRI blurts');
const first = run('roomBark.text');
assert.ok(run('machineLines("mri").includes(roomBark.text)'));
run('drawWorld()');
let again = null;
let waitedBark = 0.05;
while (waitedBark < 25 && !again) {
  run('player.x = 480; player.y = 330');
  step(0.25);
  waitedBark += 0.25;
  if (run('roomBark && roomBark.text') && run('roomBark.text') !== first) again = waitedBark;
}
assert.ok(again !== null && again >= 19.9, `the next line waits out the cooldown (${again} s)`);
console.log('PASS: machines blurt within 60 px, once per 20 s each, from unique dash-free pools.');

// No opinions during a fight.
run('state.wardClears[1] = 0; delete wardProgress[1]; loadRoom(1); player.inv = 1000; player.x = 480; player.y = 330');
assert.ok(run('enemies.length') > 0);
for (let i = 0; i < 60; i++) {
  run('player.inv = 1000; player.x = 480; player.y = 330');
  step(0.1);
}
assert.equal(run('roomBark'), null, 'machines stay quiet while gremlins are up');
run('state.wardClears[1] = 1; delete wardProgress[1]; loadRoom(0); enemies = []');
console.log('PASS: no blurts during live combat.');

// Employee of the Month: one pick per date, the same all day, with its honor line first.
const eom = JSON.parse(run('JSON.stringify(machineOfTheMonth("2026-11-02"))'));
assert.deepEqual(JSON.parse(run('JSON.stringify(machineOfTheMonth("2026-11-02"))')), eom, 'deterministic');
assert.deepEqual(JSON.parse(run('JSON.stringify(machineOfTheMonth(new Date(2026, 10, 2, 23, 59)))')), eom, 'same pick all day');
assert.ok(order.includes(eom.id));
assert.equal(eom.name, machines[eom.id].name);
assert.equal(eom.line, machines[eom.id].honor);
const picks = new Set();
for (let d = 1; d <= 60; d++) picks.add(run(`machineOfTheMonth(roomDayKey(new Date(2026, 0, ${d}))).id`));
assert.ok(picks.size >= 4, 'the honor gets around');
assert.equal(run('machineLines(machineOfTheMonth().id)[0]'), run('machineOfTheMonth().line'), 'the winner leads with the honor');
run('roomBark = null; drawWorld(); loadRoom(4); drawWorld(); loadRoom(0)');
console.log('PASS: machineOfTheMonth() is deterministic per date; icons and badges draw.');

// ---- The Ensure cult ----
const cult = (n, trophy = false, room = 0) =>
  run(`state.stats.ensureRefused = ${n}; state.stats.ensureTrophy = ${trophy}; loadRoom(${room}); enemies = []; roomCultRenderables().length`);
run('roomPaDone = false');
assert.equal(cult(0), 0, 'no refusals, no Ensure');
assert.equal(cult(9), 0);
assert.equal(cult(10), 0, 'at 10 the bottle is on the sill (wall layer)');
assert.equal(run('roomEnsureN'), 10);
assert.equal(cult(10, false, 2), 1, 'and one on the lounge table');
assert.equal(cult(10, false, 1), 0);
assert.equal(cult(20), 1, 'at 20 a six-pack under the bed');
assert.equal(cult(20, false, 1), 1, 'one balanced on the MRI');
assert.equal(cult(20, false, 2), 2, 'and the vending machine stocks them');
assert.equal(nodes.toast.textContent === run('ROOM_PA'), false, 'no announcement yet');
assert.equal(cult(30), 2, 'at 30 the drawer is ajar and spilling');
assert.equal(nodes.toast.textContent, 'Attention: the cafeteria has been renamed The Ensure Experience.');
run('toast("something else")');
cult(30, false, 2);
assert.notEqual(nodes.toast.textContent, run('ROOM_PA'), 'the PA speaks once per session');
assert.equal(cult(50), 2, 'fifty without the trophy flag: no trophy');
assert.equal(run('roomEnsureTrophy'), false);
assert.equal(cult(50, true), 3, 'fifty with the trophy flag: the trophy case');
assert.equal(run('roomEnsureTrophy'), true);
run('tvChannels[0] = 2; drawWorld(); loadRoom(5); drawWorld(); tvCardShow(c, 160, 90, 0, [], "Macy", true); tvCardShow(c, 160, 90, 4, state.cards, "Macy", true)');
run('ensureTrophyArt(c, 0, 0); ensureSixPack(c, 0, 0); for (let f = 0; f < 3; f++) roomBottle(c, 0, 0, f, 1, true)');
run('state.stats = {}; state.stats.catCard = 1; tvChannels[0] = 0; loadRoom(0)');
assert.equal(cult(0), 0);
run('delete state.stats; loadRoom(0); drawWorld(); state.stats = { catCard: 1 }');
console.log('PASS: Ensure piles up at 10, 20, 30 and 50 (with the trophy), and the PA speaks once.');

// ---- The dream (src/dream.js) hooks, stubbed ----
run(`var dreamLog = [];
globalThis.updateDream = dt => { dreamLog.push('update'); return dreamOn; };
globalThis.dreamActive = () => dreamOn;
globalThis.drawDream = (g, w, h) => dreamLog.push('draw:' + Math.round(w) + 'x' + Math.round(h));
globalThis.dreamWake = () => dreamLog.push('wake');
var dreamOn = true;
loadRoom(5); enemies = []; player.x = 505; player.y = 470`);
key('d');
run('for (let i = 0; i < 10; i++) updateWorld(1/60)');
keyUp('d');
assert.equal(run('player.x'), 505, 'a dream freezes the ward');
assert.ok(run('dreamLog.filter(e => e === "update").length') >= 10, 'updateDream runs each step');
run('dreamLog = []; setWardPause(true); updateWorld(1/60); setWardPause(false)');
assert.equal(run('dreamLog.includes("update")'), false, 'not while paused');
run('dreamLog = []; drawWorld()');
assert.equal(run('dreamLog.join()'), 'draw:' + run('Math.round(viewport.w)') + 'x' + run('Math.round(viewport.h)'), 'drawDream paints last, at the view size');
run('dreamLog = []; roomAction("attack")');
assert.equal(run('dreamLog[0]'), 'wake', 'an action wakes the dream first');
run('dreamLog = []; wardTouchDown(7, 10, 10, { x: 500, y: 400 }); wardTouchUp(7, 10, 10, true)');
assert.equal(run('dreamLog[0]'), 'wake', 'so does a tap on the room');
run('dreamLog = []; dreamOn = false; drawWorld(); updateWorld(1/60)');
assert.equal(run('dreamLog.join()'), 'update', 'no dream, no drawDream');
// Any of them missing is fine.
run('globalThis.dreamActive = undefined; globalThis.drawDream = undefined; globalThis.dreamWake = undefined; drawWorld(); roomAction("attack"); advanceSimulation(0.1)');
run('globalThis.updateDream = undefined; advanceSimulation(0.1); drawWorld()');
console.log('PASS: dream hooks run in order when stubbed, and a missing one is tolerated.');

// ---- The 3 AM channel (src/tvlate.js), stubbed ----
// tvlate.js is in the build now; hide it first to prove the room copes without it.
run('var realTvLate = [tvLateDraw, tvLateTick, tvLateCaption]; globalThis.tvLateDraw = undefined; globalThis.tvLateTick = undefined; globalThis.tvLateCaption = undefined');
run('loadRoom(5); tvChannels[0] = 0; player.x = 705; player.y = 252');
assert.equal(run('tvChannelCount(5)'), 3, 'no tvlate.js, no 3 AM');
for (let i = 0; i < 3; i++) run('roomAction("attack")');
assert.equal(run('tvChannel()'), 0, 'three channels cycle');
run(`var lateLog = [];
globalThis.tvLateDraw = (g, w, h, t) => lateLog.push('draw');
globalThis.tvLateTick = dt => lateLog.push('tick');
globalThis.tvLateCaption = () => 'the static is breathing';`);
assert.equal(run('tvChannelCount(5)'), 4, 'room 5 gets the fourth channel');
assert.equal(run('tvChannelCount(0)'), 3, 'her room by day does not');
assert.equal(run('tvChannelCount(2)'), 3, 'the lounge does not');
const seen = [];
for (let i = 0; i < 4; i++) {
  run('roomAction("attack")');
  seen.push(run('tvChannel()'));
}
assert.deepEqual(seen, [1, 2, 3, 0], 'cat cam, Rams, get-well, 3 AM, cat cam');
run('roomAction("attack"); roomAction("attack"); roomAction("attack")');
assert.equal(run('tvChannel()'), 3);
run('lateLog = []; advanceSimulation(1/60); drawWorld()');
assert.ok(run('lateLog.includes("tick")'), 'tvLateTick runs while the channel is on');
assert.ok(run('lateLog.includes("draw")'), 'tvLateDraw paints the screen');
run('loadRoom(0); enemies = []; advanceSimulation(1/60)');
assert.equal(run('tvChannel()'), 0, 'by day the same TV is back on the cat cam');
run('loadRoom(5); lateLog = []; tvChannels[0] = 3; advanceSimulation(1/60); drawWorld()');
run('globalThis.tvLateDraw = undefined; globalThis.tvLateTick = undefined; globalThis.tvLateCaption = undefined');
assert.equal(run('tvChannel()'), 0, 'without the module the channel quietly falls back');
run('advanceSimulation(0.1); drawWorld(); tvChannels[0] = 0');
console.log('PASS: the 3 AM channel exists only in room 5 and only with tvlate.js; it ticks, draws and captions.');

// ---- Safe rooms slim the touch cluster to the joystick, EAT and one TALK / USE button ----
run('loadRoom(6)');
assert.equal(run('wardActLabel(6)'), 'TALK', 'the hallway button talks');
assert.equal(nodes.attackBtnchild.textContent, 'TALK', 'and the big button says so');
run('loadRoom(0)');
assert.equal(run('wardActLabel(0)'), 'USE', 'her room: use the TV, the switch, the car');
assert.equal(run('wardActLabel(5)'), 'USE', 'lights out too');
assert.equal(nodes.attackBtnchild.textContent, 'USE');
run('loadRoom(1)');
assert.equal(run('wardActLabel(1)'), 'SWING', 'a ward with gremlins swings');
assert.equal(nodes.attackBtnchild.textContent, 'SWING');
console.log('PASS: safe rooms relabel the big button TALK or USE; wards keep SWING.');

// ---- The touch cluster: no DASH, no TRAP; EAT sits by the stick ----
// The left thumb has the joystick (double-tap to dash, marked with a » on the stick) and EAT; the right
// has SWING, JUMP, SHIELD and BRICK. Safe rooms still hide every round button but EAT.
{
  const html = require('node:fs').readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const cluster = html.match(/<div class="touch-actions" id="touchActions">([\s\S]*?)<\/div><\/div>/)[1];
  const ids = [...cluster.matchAll(/<button[^>]*id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids.sort(), ['attackBtn', 'brickBtn', 'jumpBtn', 'shieldBtn', 'touchEat'], 'five buttons: SWING, JUMP, SHIELD, BRICK, EAT');
  assert.match(html, /<div class="stick" id="stick"><span class="joy-dash" id="joyDash" aria-hidden="true">»<\/span><\/div>/, 'the stick wears the dash mark');
  assert.match(html, /aria-label="Movement joystick\. Double-tap it to dash\."/);
  assert.doesNotMatch(html, /id="(dashBtn|trapBtn|trapCount)"|i-trap/, 'no DASH or TRAP button left behind');
  assert.match(html, /body\.safe-room \.touch-controls \.act:not\(\.eat\)\{display:none!important\}/, 'safe rooms keep EAT');
  assert.match(html, /double-tap it \(the » on the stick\) to dash/i, 'How to play says how to dash');
}
console.log('PASS: the touch cluster has no DASH or TRAP; the stick wears the dash mark; safe rooms keep EAT.');
