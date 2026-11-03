// The seventh-floor hallway at Valley Hospital (room 6): names and signage, install, door placement,
// strolling visitors, conversations, Barb from Dietary and her Ensure, Rowdy, the get-well cards and
// sticker counters, door zones, the shop and the exit, drawing with a strict canvas, the talk voices,
// and the hallway and title tracks. The platform hooks in world.js may not be in this build yet, so the
// test drives the hooks itself and tolerates a goRoom(6) that cannot finish.
const fs = require('node:fs');
const path = require('node:path');
const { run, box, nodes, assert } = require('./harness.cjs');

run('let rng = 2026; Math.random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; }');

// ---- Source rules ----
const src = fs.readFileSync(path.join(__dirname, '../src/hallway.js'), 'utf8');
assert.ok(!/Math\.random/.test(src), 'hallway.js uses rand() and pick(), never Math.random');
assert.equal(run('JSON.stringify(HALLWAY_LINES).includes("\\u2014")'), false, 'no em dashes in the dialogue');
console.log('PASS: no Math.random in hallway.js and no em dashes in what anyone says.');

// ---- Names and signage: Mimi and Dodo, Valley Hospital, seventh floor, Room 10 ----
// The 'grandma' and 'grandpa' voice ids belong to audio.js; nothing anyone sees or reads says Grandma.
assert.ok(!/Grand(ma|pa)|grand(mother|father)/.test(src), 'no Grandma, Grandpa, grandmother or grandfather in hallway.js');
for (const old of ['412', '409', '4F', 'FLOOR 4', 'FOURTH', 'fourth', 'Fourth'])
  assert.ok(!src.includes(old), `hallway.js no longer says ${old}`);
run('hallwayInstall()');
const everything = run(`JSON.stringify([HALLWAY_LINES, HALLWAY_DAD_CHEERS, HALLWAY_DAD_JOKES, HALLWAY_DAD_GROANS,
  HALLWAY_DAD_REACTIVE.map(r => r.text), HALLWAY_CARDS, HALLWAY_DOORS, HALLWAY_ROOM, hallwayCast.map(n => n.name)])`);
assert.ok(!/grand/i.test(everything), 'no grandparent words anywhere on screen');
assert.equal(run('Object.keys(HALLWAY_LINES).filter(k => /grand/.test(k)).length'), 0);
assert.deepEqual(
  JSON.parse(run('JSON.stringify(["mimi", "dodo"].map(id => { const n = hallwayCast.find(x => x.id === id); return [n.name, n.lines, n.voice]; }))')),
  [
    ['Mimi', 'mimi', 'grandma'],
    ['Dodo', 'dodo', 'grandpa']
  ],
  'Mimi and Dodo are on set, with their own lines and their old voices'
);
assert.equal(run('HALLWAY_LOOKS.mimi().item'), 'tin', 'Mimi still has the cookie tin');
assert.equal(run('HALLWAY_LOOKS.dodo().hairStyle'), 'cap', 'Dodo still has the flat cap');
assert.ok(run('JSON.stringify(HALLWAY_LINES.mimi.talks).includes("Dodo")'), 'Mimi talks about Dodo');
assert.ok(run('JSON.stringify(HALLWAY_LINES.dodo.talks).includes("Mimi")'), 'Dodo talks about Mimi');
assert.ok(run('JSON.stringify(HALLWAY_LINES.norah.talks).includes("Mimi tried")'), 'Norah tells on Mimi');
assert.ok(run('HALLWAY_DAD_CHEERS.some(t => t.startsWith("Mimi has told"))'), 'Dad brags about Mimi bragging');
assert.ok(run('HALLWAY_DAD_GROANS.includes("Dodo told it better.")'), 'Macy says Dodo told it better');
assert.equal(run('HALLWAY_DOORS.find(d => d.room === 0).plate'), 'ROOM 10', "Macy's door is Room 10");
assert.match(run('rooms[6].sub'), /^SEVENTH FLOOR/);
// Any TV on the floor is the lounge's 75-inch.
const tvLines = JSON.parse(
  run(`JSON.stringify([HALLWAY_LINES, HALLWAY_DAD_CHEERS, HALLWAY_DAD_JOKES, HALLWAY_DAD_GROANS, HALLWAY_CARDS]
    .flatMap(function flat(x) {
      if (typeof x === 'string') return [x];
      if (Array.isArray(x)) return x.flatMap(flat);
      return x && typeof x === 'object' ? Object.values(x).flatMap(flat) : [];
    })
    .filter(t => /\\bTV\\b/.test(t)))`)
);
assert.ok(tvLines.length >= 1, 'the hallway still has its TV joke');
for (const t of tvLines) assert.match(t, /lounge TV is seventy-five inches/, `a TV on this floor is the lounge's 75-inch: ${t}`);
// What the corridor actually paints: the door plate, the elevator, the wall stripe and the station plaque.
run(`var signLog = [];
  var signCtx = new Proxy(
    { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
      measureText: t => ({ width: String(t).length * 6 }), fillText(t) { signLog.push(String(t)); } },
    { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) }
  );
  hallwayRoomBg(signCtx);
  roomProps[6].forEach(p => p.draw(signCtx));`);
const signs = JSON.parse(run('JSON.stringify(signLog)'));
for (const want of ['ROOM 10', '7', 'FLOOR', 'VALLEY · 7F · PEDIATRICS', 'VALLEY HOSPITAL', 'PARAMUS · 7TH FLOOR', "NURSES’ STATION"])
  assert.ok(signs.includes(want), `the corridor shows ${want}`);
assert.equal(signs.filter(t => t === 'VALLEY · 7F · PEDIATRICS').length, 3, 'the wall stripe repeats about once a screen');
for (const gone of ['ROOM 412', '4', '4F', 'FLOOR 4']) assert.ok(!signs.includes(gone), `no ${gone} on the walls`);
assert.ok(!signs.some(t => /412|4F|FLOOR 4|FOURTH/.test(t)));
console.log('PASS: Mimi and Dodo by name everywhere; ROOM 10, the 7 in the elevator, the Valley Hospital stripe and plaque.');

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
assert.match(nodes.wardStatus.textContent, /^SEVENTH FLOOR · NO GREMLINS\. JUST YOUR PEOPLE$/);
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
  return run('JSON.stringify(hallwayCast.map(n => [n.name, n.look ? n.look.topA : n.pose, n.x.toFixed(4), n.y.toFixed(4)]))');
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
    // The rest of her group stands just behind her, out of TALK range but part of the scene; anyone
    // else who wandered into the way steps aside.
    hallwayCast.filter(o => o !== n && n.group && o.group === n.group).forEach((o, k) => { o.x = n.x - 48 - 40 * k; o.y = 400 + (k ? 20 : -20); });
    hallwayCast.forEach(o => {
      if (o === n || (n.group && o.group === n.group) || Math.hypot(o.x - player.x, o.y - player.y) > 100) return;
      o.x = clamp(o.x + (o.x < player.x ? -170 : 170), 80, 3120);
    });
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

// Personal space: a visitor walking across Macy's spot stops short of her, and nobody picks a target
// on top of her, so a crowd never forms around her.
run(`(() => {
  hallwayResetCast(); state.room = 6; hallwayTalk = null;
  var n = hallwayCast.find(x => x.id === 'dad');
  player.x = 700; player.y = 400; n.x = 560; n.y = 400; n.mode = 'walk'; n.tx = 840; n.ty = 400; n.wait = 99;
  var closest = 1e9;
  for (var i = 0; i < 240; i++) { hallwayNpcStep(n, 1 / 60); closest = Math.min(closest, dist(n, player)); }
  globalThis.space = { closest: closest, picks: [] };
  for (var k = 0; k < 200; k++) { n.mode = 'idle'; hallwayPickTarget(n); if (n.mode === 'walk') space.picks.push(Math.hypot(n.tx - player.x, n.ty - player.y)); }
})()`);
const space = JSON.parse(run('JSON.stringify(space)'));
assert.ok(space.closest >= 44, `a walking visitor keeps clear of Macy (closest ${space.closest.toFixed(0)})`);
assert.ok(space.picks.length > 50 && Math.min(...space.picks) >= 90, `no wander target lands on her (nearest ${Math.min(...space.picks).toFixed(0)})`);
console.log('PASS: visitors keep their distance and never aim for her spot.');

// Walking away closes; Escape from the keyboard closes without pausing; taps open and advance.
standBy('mimi');
run("roomExtrasAction('attack')");
run('player.x += 400; updateRoomExtras(1 / 60)');
assert.equal(run('hallwayTalk'), null, 'walking away ends the conversation');
standBy('dodo');
run('updateRoomExtras(0.2)');
run("roomExtrasAction('attack')");
run('var escaped = { key: "Escape", stopped: 0, preventDefault() {}, stopPropagation() { this.stopped++; } }; hallwayKeydown(escaped)');
assert.equal(run('hallwayTalk'), null, 'the Escape key closes a conversation');
assert.equal(run('escaped.stopped'), 1, 'and keeps the pause menu out of it');
assert.equal(run('state.paused'), false);
standBy('presley');
assert.equal(run("roomExtrasAction('tap', { x: player.x - 40, y: player.y - 60 })"), true, 'tapping a visitor talks');
assert.equal(run('hallwayTalk.npc.id'), 'presley');
run('hallwayCloseTalk()');
// A visitor out of TALK range is scenery to a tap: the tap walks Macy instead of opening a talk.
run("(() => { var n = hallwayCast.find(x => x.id === 'presley'); player.x = n.x + 110; hallwayTarget = null; updateRoomExtras(0.2) })()");
assert.ok(!run('hallwayTarget && hallwayTarget.kind === "talk"'), 'no TALK prompt 110 px away');
assert.equal(run("roomExtrasAction('tap', { x: player.x - 110, y: player.y - 60 })"), false, 'tapping a visitor out of range is a move');
assert.equal(run('hallwayTalk'), null);
standBy('presley');
assert.equal(run("roomExtrasAction('tap', { x: player.x - 40, y: player.y - 60 })"), true, 'in range it talks');
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
standBy('benedetto', 10);
run('player.dash = 0.2; updateRoomExtras(1 / 60); player.dash = 0');
assert.equal(run('hallwayCast.find(n => n.id === "benedetto").bark.text'), 'Whoa! Excellent speed. Terrible idea.');
assert.ok(run('hallwayCast.find(n => n.id === "benedetto").whoa > 0'), 'with a little hop');
console.log('PASS: dashing through someone makes them say whoa.');

// Lines react to state: won, Ralph waiting, cleared wards, medals.
run('hallwayResetCast(); state.room = 6; state.won = true');
assert.match(talkOnce('brother')[0].text, /coming home/);
assert.match(talkOnce('dad')[0].text, /Discharge papers/);
run('state.won = false; state.ralphReady = true; state.ralph = false; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('dodo')[0].text, /Ralph/);
run('state.ralphReady = false; state.wardClears[3] = 1; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('norah')[0].text, /triple play/);
run('state.medals[2][0] = 3; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('dad')[0].text, /gold medal/);
assert.match(talkOnce('presley')[0].text, /medals/);
run('state.wardClears[3] = 0; state.medals[2][0] = 0; state.ralphReady = true; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('taylor')[0].text, /Ralph/);
run('state.ralphReady = false; state.won = true; hallwayResetCast(); state.room = 6');
assert.match(talkOnce('taylor').map(l => l.text).join(' '), /pull the car around/);
run('state.won = false');
console.log('PASS: lines react to the win, Ralph, cleared wards and medals.');

// ---- The friends: Presley, Norah and Taylor ----
run('hallwayResetCast(); state.room = 6; state.won = false; state.ralphReady = false; state.ralph = false');
for (const old of ['Kenzie', 'kenzie', 'Cousin Bri', "'bri'", 'teammate'])
  assert.ok(!src.includes(old), `hallway.js no longer has ${old}`);
assert.ok(!/Kenzie|\bBri\b|teammate/i.test(run('JSON.stringify([HALLWAY_LINES, HALLWAY_CARDS, HALLWAY_DAD_CHEERS, HALLWAY_DAD_JOKES, hallwayCast.map(n => n.name)])')),
  'nobody on screen is Kenzie or Bri');
const friends = JSON.parse(run(`JSON.stringify(['presley', 'norah', 'taylor'].map(id => {
  const n = hallwayCast.find(x => x.id === id);
  return { id, name: n.name, group: n.group, lead: n.lead, voice: n.voice, pitch: n.pitch, look: n.look };
}))`));
assert.deepEqual(friends.map(f => f.name), ['Presley', 'Norah', 'Taylor']);
assert.ok(friends.every(f => f.group === 'friends' && f.voice === 'cousin'), 'one group, one voice');
assert.deepEqual(friends.map(f => f.lead), [false, false, true], 'Taylor leads: she drove');
assert.equal(new Set(friends.map(f => f.pitch)).size, 3, 'each girl at her own pitch');
assert.ok(friends[2].pitch < friends[1].pitch && friends[1].pitch < friends[0].pitch, 'Taylor lowest, Presley highest');
const [pres, nor, tay] = friends.map(f => f.look);
assert.equal(pres.hairStyle, 'pony', "Presley's ponytail");
assert.ok(parseInt(pres.hair.slice(1, 3), 16) > 0xd0, 'Presley is blond');
assert.ok(pres.bounce > 0, 'and the ponytail never stops moving');
assert.equal(pres.item, 'volleyball');
assert.ok(pres.kneepads, 'volleyball kneepads');
assert.equal(nor.hairStyle, 'braid');
assert.equal(nor.top, 'softball');
assert.equal(nor.item, 'glove');
assert.equal(tay.hairStyle, 'long');
assert.deepEqual([tay.top, tay.letter, tay.number, tay.item], ['letter', 'R', '27', 'keys'], "Taylor's senior varsity jacket, class of '27, the car keys");
assert.ok(tay.shades, 'sunglasses on her head');
for (const look of [nor, tay]) assert.ok(parseInt(look.hair.slice(1, 3), 16) < 0x70, 'Norah and Taylor are brunettes');
assert.equal(nor.skin, tay.skin, 'sisters');
assert.ok(friends.every(f => f.look.topA === '#2f5fb3' || f.look.topA === '#22427f'), 'Rams blue');
// Lines: each her own, the others chime in, and the specifics the owner asked for.
const friendTalks = JSON.parse(run('JSON.stringify(["presley", "norah", "taylor"].map(id => HALLWAY_LINES[id].talks.map(t => t.say)))'));
friendTalks.forEach((talks, i) => {
  assert.ok(talks.length >= 6, `${friends[i].name} has at least six conversations`);
  assert.ok(talks.some(say => say.some(([who]) => ['presley', 'norah', 'taylor'].includes(who))), `someone chimes in on ${friends[i].name}`);
  for (const say of talks) for (const [who] of say) assert.ok(['npc', 'macy', 'presley', 'norah', 'taylor'].includes(who), who);
});
const friendText = JSON.stringify(friendTalks);
assert.match(JSON.stringify(friendTalks[0]), /ponytail/, "Presley's ponytail");
assert.match(JSON.stringify(friendTalks[2]), /drove|driving|car/, 'Taylor drives');
assert.match(JSON.stringify(friendTalks[2]), /[Ss]enior/, 'Taylor is a senior');
assert.ok(friendTalks[1].some(say => say.some(([who]) => who === 'taylor')) && friendTalks[2].some(say => say.some(([who]) => who === 'norah')), 'sister banter both ways');
assert.match(friendText, /softball|batting|glove/i, 'spring softball');
assert.match(friendText, /serve|MINE|open gym|ref/, 'fall volleyball');

// Talking to one pulls the others in: a chime-in bubble is spoken, voiced and drawn by that girl.
run('var friendBlips = []; var spyFriendSfx = sfx; sfx = (name, o) => { if (name === "talk") friendBlips.push([o.voice, o.combo]); return spyFriendSfx(name, o); }');
standBy('norah');
run(`(() => {
  const n = hallwayCast.find(x => x.id === 'norah');
  n.heard = HALLWAY_LINES.norah.talks.map((t, i) => i).filter(i => !HALLWAY_LINES.norah.talks[i].say.some(([w]) => w === 'taylor'));
  n.last = -1;
})()`);
run("updateRoomExtras(0.2); roomExtrasAction('attack')");
const chime = JSON.parse(run('JSON.stringify(hallwayTalk.lines)'));
const tIdx = chime.findIndex(l => l.who === 'taylor');
assert.ok(tIdx > 0, 'the conversation with Norah pulls Taylor in');
assert.equal(run('hallwaySpeaker(hallwayTalk, hallwayTalk.lines[0]).id'), 'norah');
run(`hallwayTalk.i = ${tIdx}; hallwayTalk.shown = 0; friendBlips = []; for (let i = 0; i < 30; i++) updateRoomExtras(1 / 60)`);
assert.equal(run('hallwaySpeaker(hallwayTalk, hallwayTalk.lines[hallwayTalk.i]).id'), 'taylor', 'that bubble is Taylor’s');
const taylorBlips = JSON.parse(run('JSON.stringify(friendBlips.filter(([v]) => v !== "rowdy"))'));
assert.ok(taylorBlips.length > 0 && taylorBlips.every(([v, p]) => v === 'cousin' && p === -2), 'in Taylor’s voice');
assert.equal(run('hallwayTalk.npc.id'), 'norah', 'the talk is still with Norah');
run(`var portraitWho = []; var realPortrait = hallwayPortrait; hallwayPortrait = (g, x, y, w, h, npc, speak) => { portraitWho.push(npc && npc.name); return realPortrait(g, x, y, w, h, npc, speak); };
  drawRoomOverlay(c, 1000, 625); hallwayPortrait = realPortrait;`);
assert.deepEqual(JSON.parse(run('JSON.stringify(portraitWho)')), ['Taylor'], 'with her portrait');
run('sfx = spyFriendSfx; hallwayCloseTalk()');
// Moving together: a minute of strolling, the cluster stays a cluster; they stop and turn to Macy together.
run(`(() => {
  hallwayResetCast(); state.room = 6;
  const crew = hallwayCast.filter(n => n.group === 'friends'), lead = crew.find(n => n.lead);
  const start = crew.map(n => [n.x, n.y]);
  let far = 0, frames = 0, gapSum = 0;
  for (let i = 0; i < 60 * 90; i++) {
    player.x = 300; player.y = 520;
    updateRoomExtras(1 / 60);
    for (const n of crew) if (!n.lead) {
      const gap = Math.hypot(n.x - lead.x - n.slot[0], n.y - lead.y - n.slot[1]);
      frames++; gapSum += gap; if (gap > 80) far++;
    }
  }
  globalThis.trio = { moved: crew.map((n, k) => Math.round(Math.hypot(n.x - start[k][0], n.y - start[k][1]))), far: far / frames, mean: gapSum / frames,
    spread: Math.round(Math.max(...crew.map(n => dist(n, lead)))) };
})()`);
const trio = JSON.parse(run('JSON.stringify(trio)'));
assert.ok(trio.moved.every(m => m > 40), `all three stroll (${trio.moved})`);
assert.ok(trio.mean < 30 && trio.far < 0.05, `and stay together (mean gap ${trio.mean.toFixed(1)}, far ${(trio.far * 100).toFixed(1)}%)`);
assert.ok(trio.spread < 110, 'a loose cluster, not a parade');
run(`(() => {
  const crew = hallwayCast.filter(n => n.group === 'friends');
  const lead = crew.find(n => n.lead);
  lead.mode = 'walk'; lead.tx = lead.x - 300; lead.ty = lead.y;
  player.x = lead.x + 100; player.y = lead.y;
  for (let i = 0; i < 20; i++) updateRoomExtras(1 / 60);
  globalThis.trioFace = crew.map(n => [n.moving, n.dir === (player.x >= n.x ? 1 : -1)]);
})()`);
assert.deepEqual(JSON.parse(run('JSON.stringify(trioFace)')), [[false, true], [false, true], [false, true]], 'Macy walks up: all three stop and turn to her');
run(`(() => {
  player.x = 300; player.y = 520;
  const crew = hallwayCast.filter(n => n.group === 'friends'),
    lead = crew.find(n => n.lead),
    from = [lead.x, lead.y];
  let walked = 0;
  for (let i = 0; i < 60 * 12; i++) {
    updateRoomExtras(1 / 60);
    if (crew.every(n => n.moving)) walked++;
  }
  globalThis.trioMoving = walked > 30 && Math.hypot(lead.x - from[0], lead.y - from[1]) > 20;
})()`);
assert.equal(run('trioMoving'), true, 'and wander off together when she goes');
console.log(`PASS: Presley, Norah and Taylor: their looks, lines, chime-ins with the right voice and portrait, and a cluster that moves together.`);

// ---- The rest of the cast: Stephanie and Julez, Dr. Lori and Dr. Benedetto, Cousin Casey, Riley ----
run('hallwayResetCast(); state.room = 6');
const CAST_IDS = ['dad', 'stephanie', 'lori', 'mimi', 'dodo', 'taylor', 'presley', 'norah', 'julez', 'brother', 'casey', 'benedetto', 'barb', 'rowdy'];
assert.deepEqual(JSON.parse(run('JSON.stringify(hallwayCast.map(n => n.id))')).sort(), [...CAST_IDS].sort(), 'the whole cast, no extras');
const tags = JSON.parse(run('JSON.stringify(Object.fromEntries(hallwayCast.map(n => [n.id, [n.name, n.voice, n.pitch]])))'));
assert.deepEqual(tags.stephanie, ['Nurse Stephanie', 'nurse', 2]);
assert.deepEqual(tags.julez, ['Julez', 'nurse', -2], 'Julez does not use the title');
assert.deepEqual(tags.lori, ['Dr. Lori', 'doctor', 2]);
assert.deepEqual(tags.benedetto, ['Dr. Benedetto', 'doctor', -4]);
assert.deepEqual(tags.casey, ['Casey', 'cousin', -4]);
assert.equal(tags.brother[0], 'Riley');
for (const old of ['Reyes', 'Little Bro', 'your brother', 'Your brother', 'nurse0', 'HALLWAY_NURSE_NAMES'])
  assert.ok(!src.includes(old), `hallway.js no longer has ${old}`);
const L = id => JSON.stringify(run(`JSON.stringify(HALLWAY_LINES.${id})`));
assert.match(L('julez'), /biker cry at a shot/, 'Julez has seen a biker cry at a shot');
assert.ok(!/biker/.test(L('stephanie')));
assert.ok(
  run('HALLWAY_LINES.benedetto.talks.filter(t => t.say.some(([w, s]) => w === "npc" && /[Ee]xcellent/.test(s))).length') >= 5,
  'Dr. Benedetto finds most things excellent'
);
assert.ok(run('HALLWAY_LINES.benedetto.talks.filter(t => JSON.stringify(t.say).includes("mustache")).length') >= 2, 'the mustache gets its own lines');
assert.match(L('lori'), /skeleton/, "Dr. Lori's deadpan");
assert.match(L('lori'), /gut/, 'and a real one');
for (const want of [/group chat/, /wiffle ball/, /blanket/, /drove/, /gossip/i]) assert.match(L('casey'), want, `Casey: ${want}`);
assert.match(run('JSON.stringify([HALLWAY_LINES.casey, HALLWAY_DAD_CHEERS, HALLWAY_DAD_JOKES])'), /Riley/, 'Riley by name');
const looks = JSON.parse(run('JSON.stringify(Object.fromEntries(hallwayCast.filter(n => n.look).map(n => [n.id, n.look])))'));
assert.deepEqual([looks.benedetto.mustache !== '', looks.benedetto.handlebar, looks.benedetto.tie], [true, true, 'bow'], 'a thick dark mustache and a bow tie');
assert.equal(looks.casey.hairStyle, 'pigtails', 'braided pigtails');
assert.ok(parseInt(looks.casey.hair.slice(1, 3), 16) < 0x70, 'brunette');
assert.equal(looks.casey.item, 'blanket', 'the Rams blanket');
assert.equal(looks.julez.hairStyle, 'short');
assert.ok(parseInt(looks.julez.hair.slice(1, 3), 16) > 0xd0, 'Julez is blond');
assert.equal(looks.julez.age, 1);
assert.deepEqual([looks.stephanie.top, looks.julez.top], ['scrubs', 'scrubs']);
assert.deepEqual([looks.lori.top, looks.lori.tie], ['coat', ''], 'Dr. Lori: a white coat, no tie');

// Heights, as multiples of Macy (5'10"): Dad > Rowdy > Macy > Dodo = Taylor > Benedetto > Casey > the rest,
// Mimi shortest. Bodies stretch; heads keep their size.
const tops = JSON.parse(run('JSON.stringify(Object.fromEntries(hallwayCast.map(n => [n.id, hallwayNpcTop(n)])))')),
  macyH = run('hallwayMacyHeight()'),
  heights = JSON.parse(run('JSON.stringify(HALLWAY_HEIGHTS)'));
assert.equal(run('hallwayMacyScale()'), run('typeof MACY_SCALE === "number" ? MACY_SCALE : 1.36'), 'MACY_SCALE, or 1.36 without it');
assert.ok(Math.abs(macyH - 88 * run('hallwayMacyScale()')) < 1e-6, 'Macy is 88 units tall at her scale (about 120 at 1.36)');
for (const id of CAST_IDS) assert.ok(Math.abs(tops[id] / macyH - heights[id]) < 0.012, `${id} is ${heights[id]} x Macy (${(tops[id] / macyH).toFixed(3)})`);
assert.ok(tops.dad > tops.rowdy && tops.rowdy > macyH && macyH > tops.dodo, 'Dad, then Rowdy, then Macy, then Dodo');
assert.ok(Math.abs(tops.dodo - tops.taylor) < 1.5, 'Dodo and Taylor see eye to eye');
assert.ok(tops.taylor > tops.benedetto && tops.benedetto > tops.casey, 'then Dr. Benedetto, then Casey');
const rest = CAST_IDS.filter(id => !['dad', 'rowdy', 'dodo', 'taylor', 'benedetto', 'casey'].includes(id));
assert.ok(rest.every(id => tops[id] < tops.casey), 'everyone else is shorter than Casey');
assert.equal(rest.reduce((a, b) => (tops[a] < tops[b] ? a : b)), 'mimi', 'Mimi is the shortest');
assert.ok(CAST_IDS.filter(id => looks[id]).every(id => looks[id].head >= 12), 'nobody gets a smaller head to be shorter');
run('globalThis.MACY_SCALE = 1.5; hallwayResetCast()');
assert.ok(Math.abs(run('hallwayNpcTop(hallwayCast.find(n => n.id === "dad"))') / run('hallwayMacyHeight()') - 1.086) < 0.012, 'and they follow MACY_SCALE');
run('delete globalThis.MACY_SCALE; hallwayResetCast(); state.room = 6');
console.log('PASS: Nurse Stephanie, Julez, Dr. Lori, Dr. Benedetto, Casey and Riley, and a lineup sized against Macy.');

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

// ---- Rowdy the Ram ----
const rowdyPoses = JSON.parse(run('JSON.stringify(ROWDY_POSES)'));
const R = expr => run(`(() => { var r = hallwayCast.find(n => n.id === 'rowdy'); return ${expr}; })()`);
const RJ = expr => JSON.parse(R(`JSON.stringify(${expr})`));
function rowdyStage() {
  run(`state.won = false; state.ralph = false; state.name = 'Macy';
    hallwayResetCast(); state.room = 6; state.paused = false; player.dash = 0; player.moving = false; hallwayTalk = null;
    hallwayCast.forEach(n => { if (!n.rowdy) n.present = false; }); hallwayEnsure.due = 9999;
    var r0 = hallwayCast.find(n => n.rowdy);`);
}
run('state.ralphReady = false');
rowdyStage();
assert.equal(run('hallwayCast.filter(n => n.id === "rowdy").length'), 1, 'Rowdy is in the hallway cast');
assert.equal(R('r.present'), true);
assert.equal(R('r.name'), 'Rowdy the Ram');
assert.equal(R('r.voice'), 'rowdy');
assert.deepEqual(RJ('[r.x, r.y]'), [812, 270], "he lives by the nurses' station");
assert.ok(R('r.nextCheer >= 40 && r.nextCheer <= 70'), 'his first cheer is due in 40 to 70 s');
assert.ok(R('roomExtraRenderables(true).some(o => o.y === r.y)'), 'he depth-sorts with everyone else');
assert.equal(R('hallwayNpcTop(r)'), R('Math.round(rowdyNpcSpec().baseHeight * r.scale)'), 'bubbles hang from his own (costumed) height');

// Home: bouncing in place while nobody's around.
run(`player.x = 3000; player.y = 520; r0.nextCheer = 100; var rowdySeen = new Set();
  for (let i = 0; i < 1200; i++) { updateRoomExtras(1 / 60); rowdySeen.add(r0.pose); }`);
assert.deepEqual(JSON.parse(run('JSON.stringify([...rowdySeen])')), ['idle'], 'idle bounce at home');
assert.deepEqual(RJ('[r.x, r.y, r.mode]'), [812, 270, 'idle']);

// A cheer on his timer, with nobody watching: one bark and one pose per bubble, babbling about 14 a second.
run(`var rowdyBlips = []; var spySfx = sfx;
  sfx = (name, o) => { if (name === 'talk' && o && o.voice === 'rowdy') rowdyBlips.push(hallwayClock); return spySfx(name, o); };`);
run(`r0.nextCheer = 0.5; var rowdyBubbles = []; var lastBark = null;
  for (let i = 0; i < 60 * 25 && !(rowdyBubbles.length && r0.mode === 'idle'); i++) {
    updateRoomExtras(1 / 60);
    if (r0.bark && r0.bark !== lastBark) {
      lastBark = r0.bark;
      rowdyBubbles.push({ text: r0.bark.text, pose: r0.pose, mode: r0.mode, cheer: r0.cheer && r0.cheer.id });
    }
  }`);
const autoCheer = JSON.parse(run('JSON.stringify(rowdyBubbles)'));
assert.ok(autoCheer.length >= 3 && autoCheer.length <= 5, `a cheer is 3 to 5 bubbles (${autoCheer.length})`);
for (const b of autoCheer) {
  assert.equal(b.mode, 'cheer');
  assert.ok(rowdyPoses.includes(b.pose), `pose ${b.pose}`);
  assert.ok(!b.text.includes('{name}'));
}
assert.deepEqual(
  autoCheer.map(b => b.pose),
  JSON.parse(run(`JSON.stringify(ROWDY_CHEERS.find(c => c.id === '${autoCheer[0].cheer}').bubbles.map(b => b.pose))`)),
  'the pose changes with every bubble, in order'
);
assert.equal(R('r.mode'), 'idle', 'and back to bouncing');
assert.ok(R('r.nextCheer >= 39 && r.nextCheer <= 70'), 'next cheer in 40 to 70 s');
// Rate from the gaps between syllables inside a bubble (a gap over 0.2 s is the next bubble).
const blipTimes = JSON.parse(run('JSON.stringify(rowdyBlips)')),
  gaps = blipTimes.slice(1).map((t, i) => t - blipTimes[i]).filter(g => g < 0.2),
  babbleRate = gaps.length / gaps.reduce((a, b) => a + b, 0);
assert.ok(gaps.length > 20, 'he babbles through every bubble');
assert.ok(babbleRate > 13 && babbleRate < 15, `about 14 syllables a second (${babbleRate.toFixed(1)})`);
console.log(`PASS: Rowdy bounces at home and cheers on his timer to nobody: ${autoCheer.length} posed bubbles, ${babbleRate.toFixed(1)} blips/s.`);

// Each visit: a gallop over and a wave, once.
run(`r0.nextCheer = 100; hallwayFrom = 4; state.room = 6; onRoomLoaded(6); var galloped = false;
  for (let i = 0; i < 60 * 20 && r0.mode !== 'greet'; i++) { updateRoomExtras(1 / 60); if (r0.pose === 'gallop') galloped = true; }`);
assert.equal(R('r.mode'), 'greet', 'he greets Macy when she walks in');
assert.equal(run('galloped'), true, 'at a gallop');
assert.equal(R('r.pose'), 'wave');
assert.ok(R('Math.abs(Math.abs(r.x - player.x) - 64) < 1'), 'stopping a polite distance away');
assert.ok(
  JSON.parse(run('JSON.stringify(ROWDY_GREETS.map(t => rowdyFormat(t, state)))')).includes(R('r.bark.text')),
  'with a greeting'
);
run(`var greetsAgain = 0, prevMode = r0.mode;
  for (let i = 0; i < 60 * 6; i++) { updateRoomExtras(1 / 60); if (r0.mode === 'greet' && prevMode !== 'greet') greetsAgain++; prevMode = r0.mode; }`);
assert.ok(R('dist(r, player) < 100'), 'he hangs around while she stays close');
run(`player.x = 3050; player.y = 540;
  for (let i = 0; i < 60 * 25; i++) { updateRoomExtras(1 / 60); if (r0.mode === 'greet' && prevMode !== 'greet') greetsAgain++; prevMode = r0.mode; }`);
assert.equal(run('greetsAgain'), 0, 'once per visit');
assert.deepEqual(RJ('[Math.round(r.x), Math.round(r.y), r.mode]'), [812, 270, 'idle'], 'and trots home when she moves on');
run(`state.room = 2; onRoomLoaded(2); state.room = 6; hallwayFrom = 0; onRoomLoaded(6);
  for (let i = 0; i < 60 * 20 && r0.mode !== 'greet'; i++) updateRoomExtras(1 / 60);`);
assert.equal(R('r.mode'), 'greet', 'and again on the next visit');
console.log('PASS: Rowdy gallops over and waves once per visit, then goes home.');

// Talking to him: a cheer or a line, a pose per bubble, his voice about 14 blips a second.
run(`for (let i = 0; i < 600 && r0.mode !== 'idle'; i++) updateRoomExtras(1 / 60);
  r0.nextCheer = 100; player.x = r0.x - 40; player.y = r0.y; hallwayArrival = 0; updateRoomExtras(0.2);`);
assert.equal(run('hallwayTarget && hallwayTarget.npc && hallwayTarget.npc.id'), 'rowdy', 'TALK prompt at Rowdy');
assert.equal(run("roomExtrasAction('attack')"), true);
const talk1 = JSON.parse(run('JSON.stringify(hallwayTalk.lines)'));
assert.ok(talk1.length >= 3 && talk1.length <= 5, 'the first talk is a cheer');
for (const l of talk1) {
  assert.equal(l.who, 'npc');
  assert.ok(rowdyPoses.includes(l.pose));
  assert.ok(!l.text.includes('{name}'));
}
assert.equal(R('r.mode'), 'talk', 'his own brain waits while he talks');
run('updateRoomExtras(1 / 60)');
assert.equal(R('r.pose'), talk1[0].pose);
run(`rowdyBlips = []; hallwayTalk.lines[0].text = 'Go Rams go Rams go Rams go Rams go Rams go Rams go Rams go Rams go Rams go Rams';
  hallwayTalk.shown = 0; hallwayTalk.acc = 0; for (let i = 0; i < 120; i++) updateRoomExtras(1 / 120);`);
const typedBlips = run('rowdyBlips.length');
assert.ok(typedBlips >= 12 && typedBlips <= 16, `about 14 blips a second while he talks (${typedBlips})`);
for (let i = 1; i < talk1.length; i++) {
  run('hallwayTalk.shown = 999; updateRoomExtras(0.2); roomExtrasAction("attack"); updateRoomExtras(1 / 60)');
  assert.equal(run('hallwayTalk.i'), i);
  assert.equal(R('r.pose'), talk1[i].pose, `bubble ${i} has its pose`);
}
run('drawRoomOverlay(c, 1000, 625)');
run('hallwayTalk.shown = 999; updateRoomExtras(0.2); roomExtrasAction("attack")');
assert.equal(run('hallwayTalk'), null);
assert.equal(R('r.mode'), 'idle', 'finished: back to bouncing');
run('updateRoomExtras(0.2); roomExtrasAction("attack")');
const talk2 = JSON.parse(run('JSON.stringify(hallwayTalk.lines)'));
assert.equal(talk2.length, 1, 'the next talk is one of his lines');
assert.ok(rowdyPoses.includes(talk2[0].pose));
run('hallwayCloseTalk()');
assert.equal(R('r.mode'), 'idle', 'Escape is not walking out on him');
console.log('PASS: talking to Rowdy runs a cheer or a line with a pose per bubble and his own voice.');

// Walk out mid-cheer: a second of sad, then a farewell and a wave. Both in the speech box and in an auto cheer.
const farewells = JSON.parse(run('JSON.stringify(ROWDY_FAREWELLS.map(t => rowdyFormat(t, state)))'));
run('updateRoomExtras(0.2); r0.talks = 0; roomExtrasAction("attack")');
assert.ok(run('hallwayTalk.lines.length') >= 3);
run('player.x = r0.x - 400; updateRoomExtras(1 / 60)');
assert.equal(run('hallwayTalk'), null, 'walking off ends the talk');
assert.deepEqual(RJ('[r.mode, r.pose]'), ['sad', 'sad']);
run('for (let i = 0; i < 54; i++) updateRoomExtras(1 / 60)');
assert.equal(R('r.mode'), 'sad', 'for about a second');
run('for (let i = 0; i < 12; i++) updateRoomExtras(1 / 60)');
assert.deepEqual(RJ('[r.mode, r.pose]'), ['recover', 'wave']);
assert.ok(farewells.includes(R('r.bark.text')), 'then a farewell');
run('for (let i = 0; i < 150; i++) updateRoomExtras(1 / 60)');
assert.ok(['idle', 'home'].includes(R('r.mode')), 'and back to his day');
run(`for (let i = 0; i < 60 * 30 && r0.mode !== 'idle'; i++) updateRoomExtras(1 / 60);
  player.x = r0.x - 100; player.y = r0.y; r0.nextCheer = 0.05; for (let i = 0; i < 10; i++) updateRoomExtras(1 / 60);`);
assert.equal(R('r.mode'), 'cheer', 'an auto cheer with Macy watching');
run(`for (let i = 0; i < 60 && r0.mode === 'cheer'; i++) { player.x -= 12; updateRoomExtras(1 / 60); }`);
assert.deepEqual(RJ('[r.mode, r.pose]'), ['sad', 'sad'], 'walk out on it: sad');
run('for (let i = 0; i < 66; i++) updateRoomExtras(1 / 60)');
assert.equal(R('r.mode'), 'recover');
assert.ok(farewells.includes(R('r.bark.text')));
console.log('PASS: walking out mid-cheer gets a second of sad, then a farewell and a wave.');

// The first cheer after Ralph turns up at the exit is the Ralph cheer, on his timer or when Macy asks.
run('state.ralphReady = true; state.ralph = false');
rowdyStage();
run(`player.x = 3000; player.y = 520; r0.nextCheer = 0.05; for (let i = 0; i < 10; i++) updateRoomExtras(1 / 60);`);
assert.equal(R('r.cheer && r.cheer.id'), 'ralph', 'auto cheer: Ralph first');
assert.match(R('r.bark.text'), /exit guard/);
rowdyStage();
run(`player.x = r0.x - 40; player.y = r0.y; updateRoomExtras(0.2); roomExtrasAction('attack');`);
assert.equal(run('hallwayTalk.lines[0].cheer'), 'ralph', 'talk: Ralph first');
assert.match(run('hallwayTalk.lines.map(l => l.text).join(" ")'), /RALPH, you're going DOWN/);
assert.equal(R('r.ralphCheered'), true);
run('hallwayCloseTalk(); state.ralphReady = false');
console.log('PASS: once Ralph guards the exit, the first cheer is the Ralph cheer.');

// {name} is Macy's name.
rowdyStage();
run(`state.name = 'Mace'; var nameTexts = [];
  for (let i = 0; i < 40; i++) nameTexts.push(...hallwayRowdyConvo(r0).map(l => l.text));
  state.name = 'Macy';`);
assert.ok(run('nameTexts.some(t => t.includes("Mace"))'), "{name} becomes Macy's name");
assert.equal(run('nameTexts.some(t => t.includes("{name}"))'), false);
run('sfx = spySfx');
console.log("PASS: Rowdy's {name} is state.name.");

// ---- Get-well cards and sticker counters ----
// The room draws state.cards over Macy's bed; the stickers read state.stats. This file only adds to them.
const CARD_WHO = ['dad', 'brother', 'mimi', 'dodo', 'presley', 'norah', 'taylor', 'casey', 'stephanie', 'julez', 'lori', 'benedetto', 'barb', 'rowdy'];
const cardLists = JSON.parse(run('JSON.stringify(HALLWAY_CARDS)'));
assert.deepEqual(Object.keys(cardLists).sort(), [...CARD_WHO].sort(), 'a card list for every visitor');
for (const [who, list] of Object.entries(cardLists)) {
  assert.ok(list.length >= 2 && list.length <= 3, `${who} has 2 or 3 cards`);
  assert.equal(new Set(list).size, list.length, `${who} cards are all different`);
  for (const t of list) {
    assert.ok(t.length >= 20 && t.length <= 80, `${who} card is short enough for the wall: ${t}`);
    assert.ok(!t.includes('—'), 'no em dashes on the cards');
  }
}
assert.deepEqual(cardLists.dad, JSON.parse(run('JSON.stringify(HALLWAY_DAD_CHEERS.slice(0, 3))')), "Dad's card is his own encouragement");
assert.ok(!run('HALLWAY_DAD_JOKES.flat().some(j => HALLWAY_CARDS.dad.includes(j))'), 'never a joke');
assert.ok(cardLists.barb.every(t => /Ensure/.test(t) && /COUPON|Good for|Redeem/.test(t)), "Barb's card is an Ensure coupon");
assert.ok(cardLists.rowdy.every(t => t.includes('{name}') && /!$/.test(t)), "Rowdy's card is a cheer with Macy's name in it");
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
assert.equal(run('hallwayDay()'), today, 'the card day is today, YYYY-MM-DD');
assert.equal(run('hallwayDay(new Date(2026, 0, 5))'), '2026-01-05');
assert.equal(run('hallwayCardText("mimi", "2026-11-02")'), run('hallwayCardText("mimi", "2026-11-02")'), 'the pick is a function of who and day');
const nurseDays = JSON.parse(run('JSON.stringify(Array.from({ length: 12 }, (_, d) => hallwayCardText("julez", "2026-11-" + String(d + 1).padStart(2, "0"))))'));
assert.ok(new Set(nurseDays).size >= 2, 'different days can pick different cards');

run(`state.won = false; state.ralphReady = false; state.ralph = false; state.name = 'Macy';
  state.wardClears = state.wardClears.map(() => 0); state.medals = state.medals.map(m => m.map(() => 0));
  delete state.cards; delete state.stats;
  hallwayResetCast(); state.room = 6; state.paused = false; player.dash = 0; hallwayTalk = null;
  hallwayEnsure.due = 9999; hallwayCast.find(n => n.rowdy).nextCheer = 9999;
  var saves = 0, realSave = save; save = () => { saves++; return realSave(); };`);
const stats = () => JSON.parse(run('JSON.stringify(state.stats || {})'));
const cards = () => JSON.parse(run('JSON.stringify(state.cards || [])'));
const count = key => stats()[key] || 0;

// Closed before the first bubble finishes: nothing. One whole bubble, then Escape: a card and a save.
standBy('presley');
run("roomExtrasAction('attack'); roomExtrasAction('escape')");
assert.equal(run('hallwayTalk'), null);
assert.deepEqual(cards(), [], 'opened and shut straight away: no card');
assert.equal(count('talks'), 0, 'and no talk');
run("updateRoomExtras(0.2); roomExtrasAction('attack'); hallwayTalk.shown = hallwayTalk.lines[0].text.length; var savesBefore = saves; roomExtrasAction('escape')");
let cs = cards();
assert.equal(cs.length, 1, 'closed after one whole bubble: a card');
assert.deepEqual(Object.keys(cs[0]).sort(), ['day', 'name', 'text', 'who']);
assert.deepEqual([cs[0].who, cs[0].name, cs[0].day], ['presley', 'Presley', today]);
assert.equal(cs[0].text, run(`hallwayCardText('presley', '${today}')`));
assert.ok(cardLists.presley.includes(cs[0].text));
assert.equal(count('talks'), 1);
assert.ok(run('saves > savesBefore'), 'saved after the card went up');

// Dad: the encouragement alone is a talk but not a joke; reaching the joke counts it, even walking off.
standBy('dad');
run("roomExtrasAction('attack'); hallwayTalk.shown = hallwayTalk.lines[0].text.length; roomExtrasAction('escape')");
assert.equal(count('talks'), 2);
assert.equal(count('dadJokes'), 0, 'no joke told yet');
assert.equal(cards().filter(c => c.who === 'dad').length, 1, "Dad's card");
assert.ok(cardLists.dad.includes(cards().find(c => c.who === 'dad').text));
standBy('dad');
run("roomExtrasAction('attack'); hallwayTalk.shown = hallwayTalk.lines[0].text.length; updateRoomExtras(0.2); roomExtrasAction('attack')");
assert.equal(run('Number.isInteger(hallwayTalk.lines[hallwayTalk.i].joke)'), true, 'the joke is up');
assert.equal(count('dadJokes'), 1, 'a joke told is a joke counted');
run('player.x += 400; updateRoomExtras(1 / 60)');
assert.equal(run('hallwayTalk'), null);
assert.equal(count('talks'), 3, 'walking off after a whole bubble still counts');
assert.equal(count('dadJokes'), 1);
assert.equal(cards().filter(c => c.who === 'dad').length, 1, 'still one card from Dad');

// Barb: an offer Macy never answered is not a refusal; one she says no to is.
run(`var barbNpc = hallwayCast.find(n => n.ensure); barbNpc.present = true; hallwayEnsure.phase = 'out'; hallwayEnsure.patience = 9999;`);
standBy('barb');
run("roomExtrasAction('attack'); hallwayTalk.shown = hallwayTalk.lines[0].text.length; roomExtrasAction('escape')");
assert.equal(count('talks'), 4);
assert.equal(count('ensureRefused'), 0, 'no answer, no refusal');
const barbLines = talkOnce('barb');
assert.equal(barbLines[1].who, 'macy');
assert.equal(count('ensureRefused'), 1, 'Macy said no: one refusal');
assert.equal(count('talks'), 5);
const barbCard = cards().find(c => c.who === 'barb');
assert.ok(barbCard && /Ensure/.test(barbCard.text), 'Barb leaves an Ensure coupon');
assert.equal(barbCard.name, 'Barb · Dietary');
run("barbNpc.present = false; hallwayEnsure.phase = 'away'; hallwayEnsure.due = 9999");

// Everyone else once. metEveryone waits for the last of them.
let talks = 5;
for (const id of ['brother', 'mimi', 'dodo', 'norah', 'taylor', 'casey', 'stephanie', 'julez', 'lori', 'benedetto']) {
  talkOnce(id);
  talks++;
  assert.equal(count('talks'), talks, `a finished talk with ${id} counts`);
  assert.ok(!count('metEveryone'), 'not everyone yet');
}
assert.equal(count('cheers'), 0);
const rowdyTalk = talkOnce('rowdy');
assert.ok(rowdyTalk.length >= 3 && rowdyTalk[0].cheer, 'the first Rowdy talk is a cheer');
assert.equal(count('cheers'), 1, 'a cheer Macy watched to the end, up close');
assert.equal(count('talks'), ++talks);
assert.equal(count('metEveryone'), 1, 'every cast member has been talked to');
cs = cards();
assert.equal(cs.length, CARD_WHO.length, 'one card per visitor');
assert.deepEqual(cs.map(c => c.who).sort(), [...CARD_WHO].sort());
const castNames = JSON.parse(run('JSON.stringify(Object.fromEntries(hallwayCast.map(n => [n.id, n.name])))'));
for (const card of cs) {
  assert.deepEqual(Object.keys(card).sort(), ['day', 'name', 'text', 'who'], `${card.who} card fields`);
  assert.equal(card.day, today);
  assert.equal(card.name, castNames[card.who], `${card.who} card is signed by name`);
  assert.equal(card.text, run(`hallwayCardText(${JSON.stringify(card.who)}, ${JSON.stringify(today)})`));
  assert.ok(!card.text.includes('{name}'));
}
assert.deepEqual(
  ['stephanie', 'julez', 'lori', 'benedetto', 'brother', 'casey'].map(w => cs.find(c => c.who === w).name),
  ['Nurse Stephanie', 'Julez', 'Dr. Lori', 'Dr. Benedetto', 'Riley', 'Casey'],
  'signed the way they sign'
);
assert.ok(cs.find(c => c.who === 'rowdy').text.includes('Macy'), "Rowdy's card cheers for Macy by name");
assert.ok(cardLists.dad.includes(cs.find(c => c.who === 'dad').text));

// Second talks never duplicate a card.
talkOnce('dad');
talkOnce('julez');
talkOnce('benedetto');
talks += 3;
assert.equal(cards().length, CARD_WHO.length, 'no duplicate cards');
assert.equal(cards().filter(c => c.who === 'julez').length, 1, 'one card from Julez');
assert.equal(count('talks'), talks);
assert.equal(count('dadJokes'), 2, 'each Dad joke told counts once');
assert.equal(count('metEveryone'), 1);

// Rowdy's own timer cheers: watched to the end counts; to nobody, or walked out on, does not.
run(`var rc = hallwayCast.find(n => n.rowdy); hallwayTalk = null;
  for (let i = 0; i < 60 * 30 && rc.mode !== 'idle'; i++) updateRoomExtras(1 / 60);
  function rowdyTimerCheer(px, walkOff) {
    player.x = px; player.y = rc.y; rc.nextCheer = 0.05;
    let started = false;
    for (let i = 0; i < 60 * 30; i++) {
      updateRoomExtras(1 / 60);
      if (rc.mode === 'cheer') started = true;
      if (walkOff && started && rc.mode === 'cheer') player.x = Math.max(80, player.x - 12);
      if (started && rc.mode !== 'cheer') break;
    }
    for (let i = 0; i < 60 * 5 && rc.mode !== 'idle' && rc.mode !== 'home'; i++) updateRoomExtras(1 / 60);
    rc.nextCheer = 9999;
    return started;
  }`);
assert.equal(run('rowdyTimerCheer(rc.x - 100, false)'), true);
assert.equal(count('cheers'), 2, 'a timer cheer Macy stood and watched');
assert.equal(run('rowdyTimerCheer(3000, false)'), true);
assert.equal(count('cheers'), 2, 'a timer cheer to nobody');
run('for (let i = 0; i < 60 * 30 && !(rc.mode === "idle" && Math.abs(rc.x - rc.homeX) < 5); i++) updateRoomExtras(1 / 60)');
assert.equal(run('rowdyTimerCheer(rc.x - 100, true)'), true);
assert.equal(count('cheers'), 2, 'a timer cheer she walked out on');
assert.equal(count('talks'), talks, 'timer cheers are not conversations');
run('save = realSave');
console.log(`PASS: ${CARD_WHO.length} get-well cards, one per visitor, no duplicates; talks, dadJokes, ensureRefused, cheers and metEveryone count.`);

// ---- The Ensure situation: the longer Macy refuses, the more the floor fills with Ensure ----
// n = state.stats.ensureRefused, read once per hallway entry.
function enterWith(n, keep = false) {
  run(`${keep ? '' : 'hallwayResetCast();'} state.won = false; state.ralphReady = false; state.ralph = false;
    state.stats = Object.assign(state.stats || {}, { ensureRefused: ${n} });
    hallwayTalk = null; state.room = 2; onRoomLoaded(2); state.room = 6; onRoomLoaded(6);
    hallwayEnsure.due = 9999; hallwayCast.find(n => n.rowdy).nextCheer = 9999; player.dash = 0;`);
}
// A strict canvas of its own: every number finite, no negative radii.
const ensureErrors = [];
box.ensureCtx = new Proxy(
  {},
  {
    get(t, k) {
      if (typeof k === 'symbol') return undefined;
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return s => ({ width: String(s).length * 7 });
      return (...a) => {
        a.forEach((v, i) => {
          if (typeof v === 'number' && !Number.isFinite(v)) ensureErrors.push(`${k} arg ${i} = ${v}`);
        });
        if ((k === 'arc' && a[2] < 0) || (k === 'ellipse' && (a[2] < 0 || a[3] < 0))) ensureErrors.push(`${k} with a negative radius`);
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    }
  }
);
run(`var bottleCalls = 0, realBottle = hallwayBottle;
  hallwayBottle = (...a) => { bottleCalls++; return realBottle(...a); };
  var vendingEnsure = () => { bottleCalls = 0; hallwayVending(ensureCtx, 2520); return bottleCalls; };
  var crateCalls = 0, realCrate = hallwayCrateArt;
  hallwayCrateArt = (...a) => { crateCalls++; return realCrate(...a); };
  var drawAll = () => { crateCalls = 0; roomExtraRenderables(true).forEach(r => r.draw(ensureCtx)); return crateCalls; };
  var wallText = () => { signLog = []; hallwayDrawWall(signCtx); return signLog; };`);
const nurseItems = () => JSON.parse(run('JSON.stringify(hallwayCast.filter(n => n.voice === "nurse").map(n => n.look.item))'));

// Under five: the old ways. Bottles cap at nine at Barb's feet; the vending machine sells gift shop things.
enterWith(4);
assert.equal(run('hallwayCult.n'), 4);
run('for (let i = 0; i < 12; i++) hallwayEnsureDrop(hallwayCast.find(n => n.ensure), false)');
assert.equal(run('hallwayBottles.length'), 9, 'four no\'s: still capped at nine');
assert.equal(run('hallwayBottles.some(b => b.row)'), false);
assert.equal(run('vendingEnsure()'), 0);
assert.equal(run('drawAll()'), 0, 'no crate');
assert.deepEqual(nurseItems(), ['tablet', 'cup']);
// Five: neat rows, no cap at nine, two Ensure slots in the vending machine.
enterWith(7);
assert.equal(run('hallwayBottles.length'), 7, 'one bottle on the floor for every no');
run('for (let i = 0; i < 12; i++) hallwayEnsureDrop(hallwayCast.find(n => n.ensure), false)');
assert.equal(run('hallwayBottles.length'), 19, 'past five, no cap at nine');
assert.ok(run('hallwayBottles.every(b => b.row)'), 'neat rows');
assert.deepEqual(
  JSON.parse(run('JSON.stringify(hallwayBottles.slice(0, 13).map(b => [b.x, b.y]))')),
  Array.from({ length: 13 }, (_, i) => [92 + (i % 12) * 16, 550 - Math.floor(i / 12) * 13]),
  'twelve to a row, by the elevator, a row at a time'
);
assert.equal(run('vendingEnsure()'), 2, 'two vending slots are Ensure');
assert.equal(run('drawAll()'), 0, 'no crate yet');
run('for (let i = 0; i < 80; i++) hallwayEnsureDrop(hallwayCast.find(n => n.ensure), false)');
assert.equal(run('hallwayBottles.length'), 60, 'sixty is a full pallet');
// Ten: the crate by the elevator.
enterWith(10);
assert.equal(run('drawAll()'), 1, 'a crate of Ensure by the elevator');
assert.ok(run('Math.abs(HALLWAY_CRATE[0] - HALLWAY_ELEVATOR_X) < 100'));
assert.deepEqual(nurseItems(), ['tablet', 'cup'], 'the nurses are holding out');
// Twenty: every nurse has a bottle, the vending machine is all Ensure, and Rowdy spells it out.
enterWith(20);
assert.deepEqual(nurseItems(), ['ensure', 'ensure'], 'every nurse carries one bottle');
assert.equal(run('vendingEnsure()'), 12, 'the vending machine is all Ensure');
const rowdyEnsure = (() => {
  run('var r20 = hallwayCast.find(n => n.rowdy); r20.talks = 0;');
  return talkOnce('rowdy');
})();
assert.equal(rowdyEnsure.map(l => l.text).join(' ').includes('E-N-S-U-R-E! ...wait.'), true, 'the Ensure cheer');
assert.ok(rowdyEnsure.every(l => l.cheer === 'ensure'));
run('r20.talks = 0; hallwayOpenTalk(r20); var poms = 0; bottleCalls = 0; hallwayTalk.i = 0; updateRoomExtras(1 / 60); hallwayDrawNpc(ensureCtx, r20); poms = bottleCalls;');
assert.notEqual(run('hallwayTalk.lines[0].cheer'), 'ensure', 'once a visit');
run('hallwayCloseTalk()');
run(`hallwayTalk = null; hallwayOpenTalk(r20); hallwayTalk.lines = HALLWAY_ROWDY_ENSURE.bubbles.map(b => ({ who: 'npc', text: b.text, pose: b.pose, cheer: 'ensure' }));
  updateRoomExtras(1 / 60); bottleCalls = 0; hallwayDrawNpc(ensureCtx, r20); hallwayDrawNpc(c, r20); poms = bottleCalls; hallwayCloseTalk();`);
assert.equal(run('poms'), 4, 'Ensure bottles where the pom-poms go (two per draw)');
enterWith(20);
run(`var r21 = hallwayCast.find(n => n.rowdy); player.x = r21.x - 100; player.y = r21.y;
  updateRoomExtras(1 / 60);
  for (let i = 0; i < 60 * 30 && r21.mode !== 'idle'; i++) updateRoomExtras(1 / 60);
  r21.nextCheer = 0.05; for (let i = 0; i < 10; i++) updateRoomExtras(1 / 60);`);
assert.deepEqual(JSON.parse(run('JSON.stringify([r21.mode, r21.cheer && r21.cheer.id, r21.ensurePoms])')), ['cheer', 'ensure', true], 'his first timer cheer of a visit is the Ensure one');
run('for (let i = 0; i < 60 * 20 && r21.mode === "cheer"; i++) updateRoomExtras(1 / 60); r21.nextCheer = 0.05; for (let i = 0; i < 10; i++) updateRoomExtras(1 / 60);');
assert.notEqual(run('r21.cheer && r21.cheer.id'), 'ensure', 'and only the first');
run('r21.nextCheer = 9999');
enterWith(3);
assert.deepEqual(nurseItems(), ['tablet', 'cup'], 'their own things back once the count is low again');
// Thirty: the PA, once per entry, and a sticker on the nurses' station sign.
run('var uiSfx = 0, paSfx = sfx; sfx = (name, o) => { if (name === "ui") uiSfx++; return paSfx(name, o); }');
enterWith(30);
assert.equal(run('hallwayCult.pa'), null, 'not the second she walks in');
run('for (let i = 0; i < 60 * 2; i++) updateRoomExtras(1 / 60)');
assert.equal(run('hallwayCult.pa && hallwayCult.pa.text'), 'Attention: the cafeteria has been renamed The Ensure Experience.');
assert.equal(run('uiSfx'), 1, 'with a chime');
run(`signLog = []; drawRoomOverlay(signCtx, 1000, 625); drawRoomOverlay(ensureCtx, 1000, 625); drawRoomOverlay(ensureCtx, 360, 300);`);
assert.ok(run('signLog.some(t => /Ensure Experience/.test(t))'), 'a caption across the top');
run('onRoomLoaded(6); for (let i = 0; i < 60 * 12; i++) updateRoomExtras(1 / 60)');
assert.deepEqual(JSON.parse(run('JSON.stringify([hallwayCult.paCount, uiSfx, hallwayCult.pa])')), [1, 1, null], 'once per entry, even if the same visit loads twice');
enterWith(30, true);
run('for (let i = 0; i < 60 * 2; i++) updateRoomExtras(1 / 60)');
assert.equal(run('hallwayCult.paCount'), 2, 'and again on the next entry');
run('sfx = paSfx');
assert.ok(JSON.parse(run('JSON.stringify(wallText())')).includes('PROUDLY STOCKED'), 'a Proudly stocked sticker on the sign');
enterWith(29);
assert.ok(!JSON.parse(run('JSON.stringify(wallText())')).includes('PROUDLY STOCKED'));
assert.equal(run('hallwayCult.paDue'), 0, 'no PA under thirty');
// Barb's lines escalate with n; every offer still gets a no.
// barbN is whichever Barb is on set now (enterWith resets the cast).
run("Object.defineProperty(globalThis, 'barbN', { get: () => hallwayCast.find(n => n.ensure), configurable: true })");
const offersAt = n => {
  enterWith(n);
  return JSON.parse(run('JSON.stringify(HALLWAY_LINES.ensure.talks.filter(t => !t.when || t.when()).map(t => t.say[0][1]))'));
};
const o0 = offersAt(0),
  o30 = offersAt(30);
assert.ok(o30.length >= o0.length + 6, `more ways to offer at thirty (${o0.length} -> ${o30.length})`);
assert.ok(['butter pecan', 'loyalty card', 'quota', 'Ensure Experience'].every(w => o30.join(' ').toLowerCase().includes(w.toLowerCase())), 'flavors nobody asked for, a loyalty card, a quota');
assert.ok(!o0.join(' ').includes('quota'));
// Fifty: the trophy. One bottle, FINE. YOU WIN., three bubbles, a flag, a save, and then she is sheepish.
run('var trophySaves = 0, trophySave = save; save = () => { trophySaves++; return trophySave(); };');
enterWith(50);
run('delete state.stats.ensureTrophy; hallwayEnsureArrive(barbN); hallwayEnsure.patience = 9999;');
assert.equal(run('barbN.look.item'), 'trophy', 'one bottle, with a bow');
assert.equal(run('barbN.bark.text'), 'Special delivery, hon. The last one. I mean it this time.');
const refusedBefore = run('state.stats.ensureRefused'),
  bottlesBefore = run('hallwayBottles.length'),
  trophy = talkOnce('barb');
assert.equal(trophy.length, 3, 'a three-bubble scene');
assert.match(trophy[2].text, /FINE\. YOU WIN\./);
assert.equal(run('state.stats.ensureTrophy'), 1, 'the trophy flag');
assert.ok(run('trophySaves') > 0, 'saved');
assert.equal(run('state.stats.ensureRefused'), refusedBefore, 'the trophy scene is not a refusal');
assert.equal(run('hallwayBottles.length'), bottlesBefore, 'handed over, not left on the floor');
assert.equal(run('barbN.look.item'), '', 'her hands are empty');
assert.equal(run('hallwayEnsure.phase'), 'leaving');
run('for (let i = 0; i < 60 * 30 && hallwayEnsure.phase !== "away"; i++) updateRoomExtras(1 / 60)');
// After the trophy: one sheepish offer per visit.
enterWith(51, true);
run('hallwayEnsure.due = 1; for (let i = 0; i < 120; i++) updateRoomExtras(1 / 60)');
assert.equal(run('hallwayEnsure.phase'), 'out', 'she comes up once this visit');
assert.ok(JSON.parse(run('JSON.stringify(HALLWAY_ENSURE_SHEEPISH.barks)')).includes(run('barbN.bark.text')), 'sheepishly');
assert.equal(run('barbN.look.item'), 'tray');
run('hallwayEnsure.patience = 9999');
const sheep = talkOnce('barb');
assert.ok(JSON.parse(run('JSON.stringify(HALLWAY_ENSURE_SHEEPISH.talks)')).some(t => t[0][1] === sheep[0].text), 'a sheepish talk');
run('var tripsAfter = hallwayEnsure.trips; for (let i = 0; i < 4000; i++) updateRoomExtras(0.1)');
assert.equal(run('hallwayEnsure.trips'), run('tripsAfter'), 'and not again until the next visit');
enterWith(52, true);
run('hallwayEnsure.due = 1; for (let i = 0; i < 120; i++) updateRoomExtras(1 / 60)');
assert.equal(run('hallwayEnsure.trips'), run('tripsAfter') + 1, 'next visit, once more');
run('save = trophySave; hallwayBottle = realBottle; hallwayCrateArt = realCrate');
assert.deepEqual(ensureErrors.slice(0, 5), [], 'all of it draws on the strict canvas');
console.log('PASS: the Ensure situation: rows, the crate, the vending machine, nurses, Rowdy, the PA, the sticker, Barb escalating, and the trophy.');

// ---- Employee of the Month ----
run(`var realMotm = typeof machineOfTheMonth === 'function' ? machineOfTheMonth : undefined,
  realIcon = typeof drawMachineIcon === 'function' ? drawMachineIcon : undefined, motmStub = true;
  try { machineOfTheMonth = undefined; drawMachineIcon = undefined; } catch { motmStub = false; }`);
if (run('motmStub')) {
  enterWith(0);
  assert.equal(run('hallwayMachine()'), null);
  assert.ok(JSON.parse(run('JSON.stringify(wallText())')).includes('VOTING OPEN'), 'no machine yet: voting is open');
  assert.ok(JSON.parse(run('JSON.stringify(wallText())')).includes('EMPLOYEE'), 'the frame still hangs');
  run(`var iconCalls = []; machineOfTheMonth = () => ({ id: 'mri', name: 'The MRI', line: 'It hums with pride.' });
    drawMachineIcon = (g, id, x, y, s) => iconCalls.push([id, s]);`);
  const wall = JSON.parse(run('JSON.stringify(wallText())'));
  assert.ok(wall.includes('THE MRI') && wall.includes('EMPLOYEE') && wall.includes('OF THE MONTH'), 'the frame names the machine');
  assert.deepEqual(JSON.parse(run('JSON.stringify(iconCalls)')), [['mri', 0.42]], 'with its portrait, scaled into the frame');
  run('hallwayDrawWall(ensureCtx)');
  run('hallwayResetCast(); state.room = 6');
  const eotm = talkOnce('stephanie');
  assert.equal(eotm[0].text, 'Employee of the Month went to the MRI. Again. It cried.', 'a nurse has a line about it');
  run(`machineOfTheMonth = () => ({ id: 'mri', name: 'BRRR 3000, the MRI', line: '' }); drawMachineIcon = realIcon;`);
  assert.ok(JSON.parse(run('JSON.stringify(wallText())')).includes('BRRR 3000, THE MRI'), 'a long name still fits the frame');
  run('drawMachineIcon = () => { throw new Error("nope"); }; hallwayDrawWall(ensureCtx); hallwayDrawWall(c)');
  assert.deepEqual(ensureErrors.slice(0, 5), [], 'the frame draws cleanly');
  run('machineOfTheMonth = () => null');
  assert.equal(run('hallwayMachine()'), null, 'a machine that is not there is no machine');
  run('machineOfTheMonth = realMotm; drawMachineIcon = realIcon');
  // The room's own pick, when this build has it.
  if (run('typeof realMotm === "function"')) {
    const real = JSON.parse(run('JSON.stringify(hallwayMachine())'));
    assert.ok(real && real.id && real.name, `the room's machine of the month: ${real && real.name}`);
    run('signLog = []; hallwayDrawWall(signCtx); hallwayDrawWall(ensureCtx)');
    const label = JSON.parse(run('JSON.stringify(signLog)')).find(t => real.name.toUpperCase().startsWith(t.replace(/\.$/, '')) && t.length > 2);
    assert.ok(label && label.length <= 18, `its name on the frame: ${label}`);
    assert.deepEqual(ensureErrors.slice(0, 5), [], 'the real portrait draws cleanly');
  }
} else console.log('NOTE: machineOfTheMonth is a const in this build; skipped the stubbed frame checks.');
console.log('PASS: Employee of the Month hangs at the nurses\' station, with or without the room\'s machine, and a nurse has a line about it.');

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
run(`(() => {
  var r = hallwayCast.find(n => n.rowdy);
  for (const pose of ROWDY_POSES) {
    for (const face of [1, -1]) {
      r.pose = pose;
      r.face = face;
      hallwayDrawNpc(strictCtx, r);
      hallwayDrawNpc(c, r);
    }
  }
  r.pose = 'idle';
  hallwayPortrait(strictCtx, 10, 10, 120, 120, r, true);
})()`);
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
  setPeriodicWave(w) {
    this.wave = w;
  }
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
assert.ok(pitch.grandpa < pitch.dad && pitch.dad < pitch.doctor && pitch.doctor < pitch.brother, "low to high: Dodo's voice, dad, doctor, brother");
assert.ok(pitch.brother < pitch.nurse && pitch.nurse < pitch.ensure && pitch.ensure < pitch.cousin, 'then nurse, Barb, the cousins');
assert.ok(run('AUDIO_TALK_VOICES.ensure.loud') > 1, 'Barb is a little too loud');

// Rowdy: muffled pulse blips that hop up, a wide random spread, a touch lower than the kids on average.
function voiceMean(v, n = 48) {
  const out = [];
  for (let i = 0; i < n; i++) {
    actx.currentTime += 0.3;
    const at = actx.nodes.length;
    run(`audio.voices = 0; sfx('talk', { voice: '${v}', count: ${i}, combo: 0 })`);
    out.push(actx.nodes.slice(at).filter(x => x.kind === 'oscillator'));
  }
  return out;
}
const rowdyVoice = voiceMean('rowdy'),
  rowdyHz = rowdyVoice.map(o => o[0].frequency.first),
  meanHz = list => list.reduce((a, b) => a + b, 0) / list.length;
for (const osc of rowdyVoice) {
  assert.ok(osc[0].wave && osc[0].wave.real, 'a pulse wave');
  assert.ok(osc[0].frequency.value > osc[0].frequency.first * 1.1, 'every syllable hops up');
  assert.ok(osc.length >= 2, 'with a vibrato layer');
}
assert.ok(actx.nodes.some(n => n.kind === 'biquad' && n.frequency.first === 1800), 'low-passed at 1.8 kHz, inside the foam head');
assert.ok(meanHz(rowdyHz) > 250 && meanHz(rowdyHz) < 310, `around 260 to 330 Hz (${meanHz(rowdyHz).toFixed(0)})`);
assert.ok(Math.max(...rowdyHz) / Math.min(...rowdyHz) > 1.3, 'about 20 percent jitter either way');
for (const kid of ['macy', 'brother', 'cousin'])
  assert.ok(meanHz(rowdyHz) < meanHz(voiceMean(kid).map(o => o[0].frequency.first)), `a touch lower than ${kid}`);
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
