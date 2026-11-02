// The fourth-floor hallway (room 6): install, door placement, strolling visitors, conversations, Barb
// from Dietary and her Ensure, door zones, the shop and the exit, drawing with a strict canvas, the
// talk voices, and the hallway and title tracks. The platform hooks in world.js may not be in this
// build yet, so the test drives the hooks itself and tolerates a goRoom(6) that cannot finish.
const fs = require('node:fs');
const path = require('node:path');
const { run, box, nodes, assert } = require('./harness.cjs');

run('let rng = 2026; Math.random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; }');

// ---- Source rules ----
const src = fs.readFileSync(path.join(__dirname, '../src/hallway.js'), 'utf8');
assert.ok(!/Math\.random/.test(src), 'hallway.js uses rand() and pick(), never Math.random');
assert.equal(run('JSON.stringify(HALLWAY_LINES).includes("\\u2014")'), false, 'no em dashes in the dialogue');
console.log('PASS: no Math.random in hallway.js and no em dashes in what anyone says.');

// ---- Install ----
run('hallwayInstall(); hallwayInstall()');
assert.equal(run('rooms.filter(r => r.id === 6).length'), 1, 'installing twice adds one room');
assert.equal(run('rooms[6].width'), 3200);
assert.equal(run('rooms[6].noArcade'), true);
assert.equal(run('rooms[6].station'), null);
assert.equal(run('roomProps[6] === HALLWAY_PROPS'), true);
assert.equal(run('roomProps.length'), 7);
assert.ok(
  run('roomProps[6].every(p => p.box[1] >= 168 && p.box[1] + p.box[3] <= 574 && typeof p.draw === "function")'),
  'hallway furniture sits on the floor band'
);
assert.ok(run('hallwayCast.length') >= 11, 'the cast is on set');
assert.equal(run('wardLocked(6)'), false, 'the hallway has no arcade lock');
console.log('PASS: hallwayInstall() is idempotent and adds room 6 with its furniture and cast.');

// ---- Entering from each room ----
let frameworkNote = '';
function enterFrom(from) {
  run(`state.room = ${from}`);
  const err = run(`(() => { try { hallwayEnter(${from}); return ''; } catch (e) { return String((e && e.message) || e); } })()`);
  if (err && !frameworkNote) frameworkNote = err;
  run('state.room = 6; onRoomLoaded(6)');
}
for (const [from, doorRoom] of [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 0]
]) {
  enterFrom(from);
  const doorX = run(`HALLWAY_DOORS.find(d => d.room === ${doorRoom}).x`);
  assert.equal(run('player.x'), doorX, `from room ${from}, Macy steps out of door ${doorRoom}`);
  assert.equal(run('player.y'), 246);
  assert.equal(run('player.dir'), doorX < 1600 ? 1 : -1, 'she faces down the long side of the corridor');
  run('onRoomLoaded(6)');
  assert.equal(run('player.x'), doorX, 'a second onRoomLoaded(6) keeps her at the same door');
  assert.equal(run('hallwayBlocked(player.x, player.y + 20, {})'), false, 'the arrival spot is clear');
}
assert.equal(run('enemies.length'), 0, 'no gremlins in the hallway');
assert.equal(run('encounter.calm'), true, 'startEncounter treats the hallway as a safe room');
run('updateWardHUD()');
assert.match(nodes.wardStatus.textContent, /FOURTH FLOOR/);
assert.match(nodes.toast.textContent, /long way round/i, 'first visit says hello');
assert.equal(run('hallwayEnter(1)'), false, 'already in the hallway: nothing to enter');
if (frameworkNote) console.log(`NOTE: goRoom(6) could not finish in this build (${frameworkNote}); drove onRoomLoaded(6) directly.`);
console.log('PASS: entering from rooms 0 to 5 puts Macy outside the right door; room 6 is calm.');

// ---- Visitors stroll for a minute ----
run(`(() => {
  hallwayResetCast();
  state.room = 6;
  state.paused = false;
  player.dash = 0;
  player.moving = false;
  var starts = hallwayCast.map(n => [n.x, n.y]);
  var bad = [];
  var moved = new Set();
  for (let i = 0; i < 3600; i++) {
    player.x = 300 + ((i * 0.9) % 2600);
    player.y = 300 + Math.sin(i / 90) * 200;
    if (player.y < 300) player.y = 600 - player.y;
    updateRoomExtras(1 / 60);
    for (const [k, n] of hallwayCast.entries()) {
      if (!n.present) continue;
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.vdir)) bad.push(n.id + ' NaN');
      if (n.x < 40 || n.x > 3160 || n.y < 170 || n.y > 574) bad.push(n.id + ' off the floor at ' + n.x + ',' + n.y);
      if (Math.hypot(n.x - starts[k][0], n.y - starts[k][1]) > 40) moved.add(n.id);
    }
  }
  globalThis.strollBad = bad.slice(0, 5);
  globalThis.strollMoved = [...moved];
})()`);
assert.deepEqual(run('JSON.stringify(strollBad)'), '[]');
assert.ok(run('strollMoved.length') >= 8, 'most visitors actually walk around: ' + run('strollMoved.join()'));
assert.ok(run('hallwayEnsure.trips') >= 1, 'Barb came up at least once in a minute of hallway time');
console.log('PASS: 60 seconds of strolling: no NaNs, everyone stays on the floor band, people move.');

// ---- Determinism: same seed, same hallway ----
function hallwaySnapshot(seed) {
  run(`rng = ${seed}; hallwayResetCast(); state.room = 6; player.x = 1600; player.y = 450; player.dash = 0;
    for (let i = 0; i < 1800; i++) updateRoomExtras(1 / 60);`);
  return run('JSON.stringify(hallwayCast.map(n => [n.name, n.look.topA, n.x.toFixed(4), n.y.toFixed(4)]))');
}
assert.equal(hallwaySnapshot(77), hallwaySnapshot(77), 'the same seed walks the same hallway');
assert.notEqual(hallwaySnapshot(77), hallwaySnapshot(78), 'a different seed changes the nurses and the walks');
console.log('PASS: the hallway is deterministic under a seeded Math.random.');

// ---- Talking ----
run('var talkVoices = []; var realSfx = sfx; sfx = (name, o) => { if (name === "talk") talkVoices.push(o && o.voice); return realSfx(name, o); }');
function standBy(id, dx = 40) {
  run(`(() => {
    hallwayTalk = null;
    var n = hallwayCast.find(x => x.id === '${id}');
    n.present = true;
    n.x = clamp(n.x, 500, 3000);
    n.y = 400;
    player.x = n.x + ${dx};
    player.y = n.y;
    player.moving = false;
    player.dash = 0;
    hallwayArrival = 0;
    updateRoomExtras(0.2);
  })()`);
}
function talkOnce(id) {
  standBy(id);
  assert.equal(run('hallwayTarget && hallwayTarget.kind'), 'talk', `TALK prompt near ${id}`);
  assert.equal(run('hallwayTarget.npc.id'), id);
  assert.equal(run("roomExtrasAction('attack')"), true, 'Space opens the conversation');
  const lines = JSON.parse(run('JSON.stringify(hallwayTalk.lines)'));
  let presses = 0;
  while (run('hallwayTalk !== null') && presses < 20) {
    run('updateRoomExtras(0.2)');
    run("roomExtrasAction('attack')");
    presses++;
  }
  assert.equal(run('hallwayTalk'), null, `the ${id} conversation closes`);
  assert.ok(presses >= lines.length, 'every bubble needs its own press');
  run('updateRoomExtras(0.2)');
  return lines;
}
run('hallwayResetCast(); state.room = 6; state.won = false; state.ralphReady = false; state.ralph = false');
for (let i = 0; i < 4; i++) run('state.wardClears[' + (i + 1) + '] = 0');
run('state.medals = state.medals.map(m => m.map(() => 0))');

standBy('dad');
assert.equal(run("roomExtrasAction('attack')"), true);
assert.equal(run('hallwayTalk.npc.id'), 'dad');
assert.match(run('hallwayTalk.lines[0].text'), /dig a ball out of the floor/, 'Dad opens with the owner’s line');
assert.equal(run("roomExtrasAction('attack')"), true, 'a held Space is swallowed');
assert.equal(run('hallwayTalk.i'), 0, 'but it does not advance');
assert.equal(run('hallwayTalk.shown'), 0);
run('updateRoomExtras(0.3)');
assert.ok(run('hallwayTalk.shown > 0 && hallwayTalk.shown < hallwayTalk.lines[0].text.length'), 'text types out');
assert.ok(run('talkVoices.includes("dad")'), 'typing plays the dad voice');
run('updateRoomExtras(0.2)');
run("roomExtrasAction('attack')");
assert.equal(run('hallwayTalk.shown === hallwayTalk.lines[0].text.length'), true, 'a press finishes the line');
run('updateRoomExtras(0.2)');
run("roomExtrasAction('attack')");
assert.equal(run('hallwayTalk.i'), 1, 'the next press moves to the next bubble');
assert.equal(run('Number.isInteger(hallwayTalk.lines[1].joke)'), true, 'the joke follows the encouragement');
run('drawRoomOverlay(c, 1000, 625)');
assert.equal(run("roomExtrasAction('escape')"), true, 'Escape closes');
assert.equal(run('hallwayTalk'), null);
standBy('brother');
run("roomExtrasAction('attack')");
assert.match(run('hallwayTalk.lines[0].text'), /can I have your room/, 'the brother asks for the room');
assert.equal(run('hallwayTalk.lines[1].who'), 'macy', 'Macy answers');
run('updateRoomExtras(0.2); hallwayTalk.shown = hallwayTalk.lines[0].text.length; updateRoomExtras(0.2); roomExtrasAction("attack"); updateRoomExtras(0.4)');
assert.ok(run('talkVoices.includes("macy")'), 'Macy has her own voice');
assert.ok(run('talkVoices.includes("brother")'));
run('hallwayCloseTalk(); updateRoomExtras(0.2)');

const firstLines = [];
for (let i = 0; i < 5; i++) firstLines.push(talkOnce('dad')[0].text);
assert.equal(new Set(firstLines).size, 5, 'five talks with Dad, five different openers');
assert.ok(!firstLines.some(t => /dig a ball out of the floor/.test(t)), 'no repeat until the rotation comes round');
const bro = [];
for (let i = 0; i < 4; i++) bro.push(talkOnce('brother').map(l => l.text).join(' / '));
assert.equal(new Set(bro).size, 4, 'four more talks with the brother, four new ones');
assert.ok(bro.some(t => /fed your fish/.test(t)));
console.log('PASS: TALK prompt, Space opens, types with voice blips, advances, Macy answers, Escape and rotation.');

// Walking away closes; Escape from the keyboard closes without pausing; taps open and advance.
standBy('grandma');
run("roomExtrasAction('attack')");
run('player.x += 400; updateRoomExtras(1 / 60)');
assert.equal(run('hallwayTalk'), null, 'walking away ends the conversation');
standBy('grandpa');
run('updateRoomExtras(0.2)');
run("roomExtrasAction('attack')");
run('var escaped = { key: "Escape", stopped: 0, preventDefault() {}, stopPropagation() { this.stopped++; } }; hallwayKeydown(escaped)');
assert.equal(run('hallwayTalk'), null, 'the Escape key closes a conversation');
assert.equal(run('escaped.stopped'), 1, 'and keeps the pause menu out of it');
assert.equal(run('state.paused'), false);
standBy('kenzie');
assert.equal(run("roomExtrasAction('tap', { x: player.x - 40, y: player.y - 60 })"), true, 'tapping a visitor talks');
assert.equal(run('hallwayTalk.npc.id'), 'kenzie');
run('updateRoomExtras(0.1)');
assert.equal(run("roomExtrasAction('tap', { x: 5, y: 5 })"), true, 'any tap advances an open conversation');
run('hallwayCloseTalk()');
assert.equal(run("roomExtrasAction('jump')"), false, 'jump stays Macy’s');
assert.equal(run("roomExtrasAction('dash')"), false, 'dash stays Macy’s');
run('player.x = 60; player.y = 560; hallwayTarget = null');
run('updateRoomExtras(0.2)');
assert.equal(run("roomExtrasAction('attack')"), false, 'with nobody near, Space swings the pillow as usual');
run('updateRoomExtras(0.2)');
assert.equal(run("roomExtrasAction('enter')"), true, 'Enter is handled in the hallway (there is no arcade beacon)');
console.log('PASS: walking away, the Escape key, taps, and jump/dash/attack pass-through.');

// A dash through someone gets a whoa.
standBy('doctor', 10);
run('player.dash = 0.2; updateRoomExtras(1 / 60); player.dash = 0');
assert.equal(run('hallwayCast.find(n => n.id === "doctor").bark.text'), 'Whoa. No running in the... okay.');
assert.ok(run('hallwayCast.find(n => n.id === "doctor").whoa > 0'), 'with a little hop');
console.log('PASS: dashing through someone makes them say whoa.');

// Lines react to state: won, Ralph waiting, cleared wards, medals.
run('hallwayResetCast(); state.room = 6; state.won = true');
assert.match(talkOnce('brother')[0].text, /coming home/);
assert.match(talkOnce('dad')[0].text, /Discharge papers/);
run('state.won = false; state.ralphReady = true; state.ralph = false; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('grandpa')[0].text, /Ralph/);
run('state.ralphReady = false; state.wardClears[3] = 1; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('bri')[0].text, /triple play/);
run('state.medals[2][0] = 3; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('dad')[0].text, /gold medal/);
run('state.wardClears[3] = 0; state.medals[2][0] = 0');
console.log('PASS: lines react to the win, Ralph, cleared wards and medals.');

// ---- Dad: an encouragement and a joke, every single time ----
const dadSizes = JSON.parse(run('JSON.stringify([HALLWAY_DAD_JOKES.length, HALLWAY_DAD_CHEERS.length, HALLWAY_DAD_GROANS.length])'));
const [jokeCount, cheerCount, groanCount] = dadSizes;
assert.ok(jokeCount >= 120, `at least 120 dad jokes (${jokeCount})`);
assert.ok(cheerCount >= 40, `at least 40 encouragements (${cheerCount})`);
assert.ok(groanCount >= 15, `at least 15 groans (${groanCount})`);
assert.equal(run('new Set(HALLWAY_DAD_JOKES.map(j => [].concat(j).join(" "))).size'), jokeCount, 'no duplicate jokes');
assert.equal(run('new Set(HALLWAY_DAD_CHEERS).size'), cheerCount, 'no duplicate encouragements');
assert.equal(run('new Set(HALLWAY_DAD_GROANS).size'), groanCount, 'no duplicate groans');
assert.ok(run('HALLWAY_DAD_JOKES.every(j => typeof j === "string" || (Array.isArray(j) && j.length === 2))'));
assert.equal(
  run('JSON.stringify([HALLWAY_DAD_JOKES, HALLWAY_DAD_CHEERS, HALLWAY_DAD_GROANS, HALLWAY_DAD_REACTIVE.map(r => r.text)]).includes("\\u2014")'),
  false,
  'no em dashes in the Dad library'
);

// A fresh deck: Dad talks 2N times straight. Every talk has an encouragement and a joke; no joke repeats
// inside a deck, and the reshuffle never opens with the joke just told.
run(`state.won = false; state.ralphReady = false; state.ralph = false;
  state.wardClears = state.wardClears.map(() => 0); state.medals = state.medals.map(m => m.map(() => 0));
  hallwayResetCast(); state.room = 6; hallwayDad = null; localStorage.setItem('gut-feeling-dad', '')`);
function dadTalks(n, page = run) {
  return JSON.parse(
    page(`(() => {
      var dad = hallwayCast.find(x => x.id === 'dad');
      var out = [];
      for (let i = 0; i < ${n}; i++) {
        hallwayTalk = null;
        hallwayOpenTalk(dad);
        out.push(hallwayTalk.lines);
        hallwayCloseTalk();
      }
      return JSON.stringify(out);
    })()`)
  );
}
const cheers = JSON.parse(run('JSON.stringify(HALLWAY_DAD_CHEERS)'));
const groans = JSON.parse(run('JSON.stringify(HALLWAY_DAD_GROANS)'));
const allDad = dadTalks(jokeCount * 2 + 3);
const ids = [];
let groaned = 0;
allDad.forEach((lines, t) => {
  assert.equal(lines[0].who, 'npc');
  assert.equal(lines[0].cheer, true, `talk ${t} opens with an encouragement`);
  assert.ok(cheers.includes(lines[0].text), `talk ${t} encouragement comes from the library`);
  const jokeLines = lines.filter(l => Number.isInteger(l.joke));
  assert.ok(jokeLines.length === 1 || jokeLines.length === 2, `talk ${t} has a joke`);
  assert.ok(jokeLines.every(l => l.who === 'npc' && l.joke === jokeLines[0].joke));
  const groan = lines.filter(l => l.groan);
  assert.ok(groan.length <= 1);
  if (groan.length) {
    assert.equal(lines[lines.length - 1], groan[0], 'the groan comes last');
    assert.equal(groan[0].who, 'macy');
    assert.ok(groans.includes(groan[0].text));
    groaned++;
  }
  assert.equal(lines.length, 1 + jokeLines.length + groan.length);
  ids.push(jokeLines[0].joke);
});
assert.equal(new Set(ids.slice(0, 130)).size, Math.min(130, jokeCount), '130 Dad talks: no repeated joke until the deck runs out');
assert.equal(new Set(ids.slice(0, jokeCount)).size, jokeCount, 'the whole deck before any repeat');
assert.equal(new Set(ids.slice(jokeCount, jokeCount * 2)).size, jokeCount, 'the second deck has no repeats either');
assert.notEqual(ids[jokeCount], ids[jokeCount - 1], 'a reshuffle never opens with the joke just told');
assert.notEqual(ids[jokeCount * 2], ids[jokeCount * 2 - 1]);
assert.notDeepEqual(ids.slice(0, jokeCount), ids.slice(jokeCount, jokeCount * 2), 'and it is a real reshuffle');
assert.ok(groaned > allDad.length * 0.35 && groaned < allDad.length * 0.65, `Macy groans about half the time (${groaned}/${allDad.length})`);
for (let t = 1; t < cheerCount; t++) assert.notEqual(allDad[t][0].text, allDad[t - 1][0].text, 'encouragements rotate');
assert.equal(new Set(allDad.slice(0, cheerCount).map(l => l[0].text)).size, cheerCount, 'every encouragement before a repeat');
const groanTexts = allDad.flatMap(l => l.filter(x => x.groan).map(x => x.text));
for (let t = 1; t < Math.min(groanCount, groanTexts.length); t++) assert.notEqual(groanTexts[t], groanTexts[t - 1], 'groans rotate');
console.log(`PASS: ${allDad.length} Dad talks: an encouragement and a joke every time, no repeats inside a deck, clean reshuffles.`);

// Survives a reload: a brand-new page with the same stored key picks up exactly where Dad left off.
dadTalks(17);
const stored = run('localStorage.getItem("gut-feeling-dad")');
const deck = JSON.parse(stored);
assert.equal(deck.n, jokeCount);
assert.ok(deck.pos > 0 && deck.pos < jokeCount);
const expectJoke = deck.order[deck.pos];
const expectCheer = cheers[deck.cheer];
delete require.cache[require.resolve('./harness.cjs')];
const page2 = require('./harness.cjs');
assert.notEqual(page2.box, box, 'a second, fresh page');
page2.run(`localStorage.setItem('gut-feeling-dad', ${JSON.stringify(stored)})`);
page2.run('hallwayInstall(); state.room = 6');
const afterReload = dadTalks(1, page2.run)[0];
assert.equal(afterReload.find(l => Number.isInteger(l.joke)).joke, expectJoke, 'the next joke after a reload is the next card in the deck');
assert.equal(afterReload[0].text, expectCheer, 'and the encouragement rotation carries on too');
assert.equal(JSON.parse(page2.run('localStorage.getItem("gut-feeling-dad")')).pos, deck.pos + 1);
// A stored deck that is used up reshuffles on the new page without repeating the last joke.
const spent = { ...deck, pos: jokeCount, last: deck.order[jokeCount - 1] };
page2.run(`hallwayDad = null; localStorage.setItem('gut-feeling-dad', ${JSON.stringify(JSON.stringify(spent))})`);
assert.notEqual(dadTalks(1, page2.run)[0].find(l => Number.isInteger(l.joke)).joke, spent.last);
// Garbage or a library of a different size starts a clean deck.
page2.run(`hallwayDad = null; localStorage.setItem('gut-feeling-dad', '{"n": 3, "order": [0, 1, 2], "pos": 1, "last": 0}')`);
assert.equal(dadTalks(1, page2.run).length, 1);
assert.equal(JSON.parse(page2.run('localStorage.getItem("gut-feeling-dad")')).n, jokeCount);
page2.run(`hallwayDad = null; localStorage.setItem('gut-feeling-dad', 'not json')`);
assert.equal(dadTalks(1, page2.run).length, 1);
// Storage that throws: Dad keeps talking.
page2.run(`hallwayDad = null; localStorage.getItem = () => { throw new Error('denied'); }; localStorage.setItem = () => { throw new Error('quota'); }`);
const noStorage = dadTalks(5, page2.run);
assert.equal(new Set(noStorage.map(l => l.find(x => Number.isInteger(x.joke)).joke)).size, 5, 'no storage, still no repeats');
console.log('PASS: the deck position persists through a reload; bad or missing storage never stops the jokes.');

// ---- Barb from Dietary ----
run('hallwayResetCast(); state.room = 6; player.x = 250; player.y = 480; player.dash = 0; hallwayEnsure.due = 3');
assert.equal(run('hallwayCast.find(n => n.ensure).present'), false, 'Barb starts downstairs');
run('for (let i = 0; i < 240; i++) updateRoomExtras(1 / 60)');
assert.equal(run('hallwayEnsure.phase'), 'out', 'she arrives on her timer');
assert.ok(run('hallwayElevator.open') > 0.3, 'out of the elevator');
assert.match(run('hallwayCast.find(n => n.ensure).bark.text'), /Ensure|Shake/);
run('for (let i = 0; i < 900; i++) updateRoomExtras(1 / 60)');
assert.ok(run('dist(hallwayCast.find(n => n.ensure), player)') < 70, 'she brings the tray to Macy');
run('updateRoomExtras(0.2)');
assert.equal(run('hallwayTarget && hallwayTarget.npc && hallwayTarget.npc.ensure'), true);
run("roomExtrasAction('attack')");
const offer = JSON.parse(run('JSON.stringify(hallwayTalk.lines)'));
assert.equal(offer[0].text, 'Room service! I brought you an Ensure.');
assert.equal(offer[1].text, "I'm not allowed to have those yet.");
assert.equal(offer[2].text, 'The kitchen says otherwise.');
run('hallwayCloseTalk(); updateRoomExtras(0.2)');
assert.equal(run('hallwayEnsure.phase'), 'out', 'walking off mid-offer does not get rid of her');
run('for (let i = 0; i < 30 && hallwayTalk === null; i++) { updateRoomExtras(0.2); roomExtrasAction("attack"); }');
run('for (let i = 0; i < 30 && hallwayTalk !== null; i++) { updateRoomExtras(0.2); roomExtrasAction("attack"); }');
assert.equal(run('hallwayBottles.length'), 1, 'she leaves one on the floor anyway');
assert.equal(run('hallwayEnsure.phase'), 'leaving');
run('for (let i = 0; i < 2400 && hallwayEnsure.phase !== "away"; i++) updateRoomExtras(1 / 60)');
assert.equal(run('hallwayEnsure.phase'), 'away', 'and rides the elevator back down');
assert.equal(run('hallwayCast.find(n => n.ensure).present'), false);
assert.ok(run('hallwayEnsure.due') > 90 && run('hallwayEnsure.due') <= 160, 'back in a couple of minutes');
run('for (let i = 0; i < 2000 && hallwayEnsure.phase === "away"; i++) updateRoomExtras(0.1)');
assert.equal(run('hallwayEnsure.trips'), 2, 'she comes back');
run('var barb = hallwayCast.find(n => n.ensure); barb.x = player.x + 40; barb.y = player.y; updateRoomExtras(0.2)');
run("roomExtrasAction('attack')");
assert.match(run('hallwayTalk.lines.map(l => l.text).join(" ")'), /not allowed/, 'and offers again');
run('hallwayCloseTalk()');
// Ignored, she still leaves one.
run('hallwayEnsure.patience = 0.3; player.x = 3000; for (let i = 0; i < 60; i++) updateRoomExtras(1 / 60)');
assert.equal(run('hallwayBottles.length'), 2, 'ignored, she leaves it here anyway');
const ensureText = run('JSON.stringify(HALLWAY_LINES.ensure.talks.map(t => t.say))');
assert.ok(ensureText.includes("I'll leave it here. For later. For never."));
assert.ok(ensureText.includes('Chocolate or vanilla?'));
assert.ok(
  run('HALLWAY_LINES.ensure.talks.every(t => t.say.length === 3 && t.say[1][0] === "macy")'),
  'every offer gets a no from Macy'
);
for (let i = 0; i < 12; i++) run('hallwayEnsureDrop(hallwayCast.find(n => n.ensure), false)');
assert.equal(run('hallwayBottles.length'), 9, 'the pile of untouched Ensure is capped');
console.log('PASS: Barb arrives on her timer, offers, gets told no, leaves an Ensure anyway, and comes back.');

// ---- Doors, the gift shop and the exit ----
run('var goCalls = []; var realGoRoom = goRoom; goRoom = id => { goCalls.push(id); }');
run('var shopCalls = 0; var realShowShop = showShop; showShop = () => { shopCalls++; }');
run('hallwayResetCast(); state.room = 6; hallwayCast.forEach(n => { n.present = false; })');
for (const room of [0, 1, 2, 3, 4]) {
  const x = run(`HALLWAY_DOORS.find(d => d.room === ${room}).x`);
  run(`hallwayArrival = 0; player.x = ${x}; player.y = 240; player.moving = false; updateRoomExtras(0.2)`);
  assert.equal(run('hallwayTarget'), null, 'standing in front of a door is not yet at it');
  run(`player.y = 205; updateRoomExtras(0.2)`);
  assert.equal(run('hallwayTarget && hallwayTarget.kind'), 'door', `ENTER prompt at door ${room}`);
  run('drawRoomOverlay(c, 1000, 625)');
  assert.equal(run("roomExtrasAction('enter')"), true);
  assert.equal(run('goCalls[goCalls.length - 1]'), room, `Enter opens room ${room}`);
  run('updateRoomExtras(0.2)');
  assert.equal(run("roomExtrasAction('attack')"), true);
  assert.equal(run('goCalls.length % 2'), 0, 'Space at a door goes in too');
  run(`hallwayArrival = 0; player.y = 178; player.moving = true; player.lastDy = -1; updateRoomExtras(1 / 60); player.moving = false`);
  assert.equal(run('goCalls[goCalls.length - 1]'), room, `walking fully into door ${room} goes through`);
  run(`player.y = 300; hallwayArrival = 0; updateRoomExtras(0.2)`);
  assert.equal(run(`roomExtrasAction('tap', { x: ${x}, y: 100 })`), true, 'tapping a nearby door goes in');
  assert.equal(run('goCalls[goCalls.length - 1]'), room);
}
run('hallwayArrival = 0.5; player.x = 1080; player.y = 178; player.moving = true; player.lastDy = -1; var before = goCalls.length; updateRoomExtras(1 / 60); player.moving = false');
assert.equal(run('goCalls.length'), run('before'), 'no bounce straight back through a door on arrival');
run(`hallwayArrival = 0; player.x = HALLWAY_SHOP_X; player.y = 230; updateRoomExtras(0.2)`);
assert.equal(run('hallwayTarget.kind'), 'shop');
run("roomExtrasAction('attack')");
assert.equal(run('shopCalls'), 1, 'the vending machine opens the gift shop');
run(`player.x = 3090; player.y = 240; updateRoomExtras(0.2)`);
assert.equal(run('hallwayTarget.kind'), 'exit');
run("roomExtrasAction('attack')");
assert.match(nodes.toast.textContent, /stars|Ralph|Discharged/);
run('goRoom = realGoRoom; showShop = realShowShop');
console.log('PASS: door zones, Enter, Space, walking in and taps call goRoom; the shop and the exit answer.');

// ---- Drawing ----
// A strict canvas: every number finite, no negative radii. The harness canvas is a no-op proxy.
const strictErrors = [];
function strictCheck(name, args) {
  args.forEach((a, i) => {
    if (typeof a === 'number' && !Number.isFinite(a)) strictErrors.push(`${name} arg ${i} = ${a}`);
  });
  if (name === 'arc' && args[2] < 0) strictErrors.push('arc with a negative radius');
  if (name === 'ellipse' && (args[2] < 0 || args[3] < 0)) strictErrors.push('ellipse with a negative radius');
  if (name === 'roundRect' && typeof args[4] === 'number' && args[4] < 0) strictErrors.push('roundRect with a negative radius');
}
box.strictCtx = new Proxy(
  {},
  {
    get(t, k) {
      if (typeof k === 'symbol') return undefined;
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient')
        return (...a) => {
          strictCheck(k, a);
          return { addColorStop: () => {} };
        };
      if (k === 'measureText') return s => ({ width: String(s).length * 7 });
      return (...a) => strictCheck(k, a);
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    }
  }
);
run('hallwayResetCast(); state.room = 6; cameraX = 0; wardCameraY = 0');
for (const ctx of ['c', 'strictCtx']) {
  run(`hallwayRoomBg(${ctx}); roomProps[6].forEach(p => p.draw(${ctx}))`);
  run(`hallwayEnsureArrive(hallwayCast.find(n => n.ensure)); hallwayEnsureDrop(hallwayCast.find(n => n.ensure), true)`);
  run(`hallwayCast.forEach((n, i) => { n.walk = i; n.moving = i % 2 === 0; n.vdir = i % 3 ? 1 : -0.05; n.whoa = 0.2; })`);
  assert.ok(run(`roomExtraRenderables(true).length`) >= 13, 'wall, bottles and the whole cast');
  run(`roomExtraRenderables(true).forEach(r => r.draw(${ctx}))`);
  run(`hallwayCast.forEach(n => { n.bark = { text: 'Whoa! Watch the tray!', life: 1, max: 2 }; }); drawRoomOverlay(${ctx}, 1000, 625)`);
  run(`hallwayCast.forEach(n => { n.bark = null; })`);
  for (const [vw, vh] of [
    [1000, 625],
    [1000, 462],
    [640, 625],
    [360, 300]
  ]) {
    for (const id of JSON.parse(run('JSON.stringify(hallwayCast.map(n => n.id))'))) {
      run(`(() => {
        var n = hallwayCast.find(x => x.id === '${id}');
        n.present = true;
        player.x = n.x + 30;
        player.y = n.y;
        hallwayTalk = null;
        hallwayOpenTalk(n);
        hallwayTalk.shown = 7;
        hallwayTalk.age = 1;
        drawRoomOverlay(${ctx}, ${vw}, ${vh});
        hallwayTalk.i = hallwayTalk.lines.length - 1;
        hallwayTalk.shown = 999;
        drawRoomOverlay(${ctx}, ${vw}, ${vh});
        hallwayCloseTalk();
      })()`);
    }
    for (const [x, y] of [
      [600, 205],
      [1560, 205],
      [2570, 230],
      [3090, 240]
    ]) {
      run(`player.x = ${x}; player.y = ${y}; hallwayTarget = hallwayFindTarget(); drawRoomOverlay(${ctx}, ${vw}, ${vh})`);
    }
  }
}
assert.deepEqual(strictErrors.slice(0, 5), [], 'the strict canvas saw no NaNs or negative radii');
const frameworkDraw = run(`(() => {
  try {
    viewport.w = 1000; viewport.h = 625; state.room = 6; player.x = 1600; player.y = 400; drawWorld(); return '';
  } catch (e) { return String((e && e.message) || e); }
})()`);
if (frameworkDraw) console.log(`NOTE: drawWorld() in room 6 needs the platform hooks (${frameworkDraw}).`);
console.log('PASS: the corridor, furniture, every visitor, barks, prompts and speech boxes draw on a strict canvas.');

// Not in the hallway: the hooks stay out of the way.
run('state.room = 2; hallwayTalk = null');
assert.equal(run("roomExtrasAction('attack')"), false);
assert.equal(run('roomExtraRenderables().length'), 0);
run('drawRoomOverlay(c, 1000, 625); updateRoomExtras(1 / 60); onRoomLoaded(2)');
run('state.room = 6; state.paused = true');
assert.equal(run("roomExtrasAction('attack')"), false, 'paused: hands off');
run('state.paused = false');
console.log('PASS: outside the hallway (or paused) the hooks do nothing.');

// ---- Voices and tracks ----
const voices = JSON.parse(run('JSON.stringify(HALLWAY_VOICES)'));
assert.deepEqual(JSON.parse(run('JSON.stringify(Object.keys(AUDIO_TALK_VOICES).sort())')), [...voices].sort(), 'audio.js has every voice');
assert.ok(run('audio.sounds.includes("talk")'));
for (const t of ['room:6', 'title']) assert.ok(run(`audio.tracks.includes('${t}')`), `music has ${t}`);
assert.equal(run('JSON.stringify(audio.checkTracks())'), '[]', 'song data lint');
for (const v of voices) run(`sfx('talk', { voice: '${v}', count: 3, combo: 2 })`);
run("sfx('talk'); sfx('talk', { voice: 'nobody' }); music('room:6'); music('title'); music(null)");
console.log(`PASS: ${voices.length} talk voices and the room:6 and title tracks are silent no-ops without Web Audio.`);

// A small fake Web Audio context proves each voice and both tracks really make sound.
class FakeParam {
  constructor(v) {
    this.value = v;
    this.first = null;
  }
  setValueAtTime(v, t) {
    if (!Number.isFinite(v) || !Number.isFinite(t) || t < 0) throw new RangeError('bad setValueAtTime');
    if (this.first === null) this.first = v;
    this.value = v;
  }
  linearRampToValueAtTime(v, t) {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new RangeError('bad linearRamp');
    this.value = v;
  }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0) || !Number.isFinite(t)) throw new RangeError('bad exponentialRamp');
    this.value = v;
  }
  setTargetAtTime(v, t, c) {
    if (!Number.isFinite(v) || !Number.isFinite(t) || !(c >= 0)) throw new RangeError('bad setTarget');
    this.value = v;
  }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
}
class FakeNode {
  constructor(ctx, kind) {
    this.kind = kind;
    for (const p of ['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release'])
      this[p] = new FakeParam(p === 'gain' ? 1 : 0);
    ctx.nodes.push(this);
  }
  connect(d) {
    return d;
  }
  disconnect() {}
  setPeriodicWave() {}
  start(t = 0) {
    if (!Number.isFinite(t)) throw new RangeError('bad start');
  }
  stop(t = 0) {
    if (!Number.isFinite(t)) throw new RangeError('bad stop');
  }
}
class FakeAudioContext {
  constructor() {
    this.currentTime = 1;
    this.state = 'suspended';
    this.sampleRate = 8000;
    this.nodes = [];
    this.destination = new FakeNode(this, 'destination');
    box.fakeAudio = this;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    return new FakeNode(this, 'gain');
  }
  createOscillator() {
    return new FakeNode(this, 'oscillator');
  }
  createBufferSource() {
    return new FakeNode(this, 'buffer');
  }
  createBiquadFilter() {
    return new FakeNode(this, 'biquad');
  }
  createDynamicsCompressor() {
    return new FakeNode(this, 'compressor');
  }
  createStereoPanner() {
    return new FakeNode(this, 'panner');
  }
  createDelay() {
    return new FakeNode(this, 'delay');
  }
  createBuffer(channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createPeriodicWave(real, imag) {
    return { real, imag };
  }
}
box.window.AudioContext = FakeAudioContext;
run('var audioDraws = 0; var gameRandom = Math.random; Math.random = () => { audioDraws++; return gameRandom(); }');
assert.equal(run('audio.unlock()'), true);
const actx = box.fakeAudio;
const pitch = {};
for (const v of voices) {
  actx.currentTime += 0.3;
  const before = actx.nodes.length;
  run(`sfx('talk', { voice: '${v}', count: 0, combo: 0 })`);
  const made = actx.nodes.slice(before);
  assert.ok(made.some(n => n.kind === 'oscillator'), `${v} voice has a pitched layer`);
  assert.ok(made.some(n => n.kind === 'buffer'), `${v} voice has a consonant tick`);
  pitch[v] = made.find(n => n.kind === 'oscillator').frequency.first;
}
assert.ok(pitch.grandpa < pitch.dad && pitch.dad < pitch.doctor && pitch.doctor < pitch.brother, 'low to high: grandpa, dad, doctor, brother');
assert.ok(pitch.brother < pitch.nurse && pitch.nurse < pitch.ensure && pitch.ensure < pitch.cousin, 'then nurse, Barb, the cousins');
assert.ok(run('AUDIO_TALK_VOICES.ensure.loud') > 1, 'Barb is a little too loud');
actx.currentTime += 0.3;
let before = actx.nodes.length;
run("sfx('talk', { voice: 'nurse', count: 1 })");
run("sfx('talk', { voice: 'nurse', count: 2 })");
const twice = actx.nodes.length - before;
actx.currentTime += 0.3;
before = actx.nodes.length;
run("sfx('talk', { voice: 'nurse', count: 1 })");
assert.equal(twice, actx.nodes.length - before, 'syllables inside the retrigger gap are skipped');
for (const track of ['room:6', 'title']) {
  actx.currentTime += 2;
  before = actx.nodes.length;
  run(`music('${track}')`);
  assert.equal(run('audio.track'), track);
  assert.ok(actx.nodes.filter((n, i) => i >= before && n.kind === 'oscillator').length > 8, `${track} schedules notes`);
  const count = actx.nodes.length;
  run(`music('${track}')`);
  assert.equal(actx.nodes.length, count, `${track} again is a no-op`);
  assert.equal(run('audio.snapshot().players.filter(p => !p.stopping).length'), 1);
}
assert.equal(run('AUDIO_SONGS.title.compiled.total'), 256, 'the title theme is sixteen bars');
assert.equal(run('AUDIO_SONGS.hallway.compiled.total'), 256);
assert.equal(run('AUDIO_SONGS.title.inst.arp'), 'bell');
assert.ok(
  run('AUDIO_SONGS.title.compiled.steps[0].some(e => e.part === "arp") && AUDIO_SONGS.title.compiled.steps[4].some(e => e.part === "arp")'),
  'the PA chime opens the loop'
);
run('music(null)');
assert.equal(run('audioDraws'), 0, 'voices and tracks never draw from the game’s Math.random');
console.log('PASS: every voice is a layered, distinct syllable; room:6 and title play once and repeat as no-ops.');
