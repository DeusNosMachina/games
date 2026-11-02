// Ward combat: weapons, gremlin breeds, waves, Ralph's boss fight, damage, and every enemy and combat effect.
//
// Hooks other files use: updateCombat(dt) runs every ward step; drawEnemy(g, e) draws one entry of
// `enemies` (world.js depth-sorts them by e.y); drawPillowSwing(g, player) draws Macy's swing; wardLocked(id)
// says whether a department arcade is still locked behind its first ward clear.
// `enemies` holds fighters, gremlins still emerging (e.emerge > 0) and corpses playing their death pop
// (e.hp <= 0 with e.deadT set). wardFighters() returns only the ones that can fight or be hit.
// Optional world.js draw hooks, all world-space except the last: drawCombatGround(g) after floor puddles,
// drawCombatFx(g) after particles, drawCombatOverlay(g, viewportWidth) after the camera transform is
// restored. Until world.js calls them, drawEnemy draws those layers itself from the first and last gremlin.

// ---- Tables ----
const weapons = [
  { name: 'Pillow', verb: 'SWING', icon: 'pillow', cool: 0.42, ability: 'SPIN' },
  { name: 'Barf bag', verb: 'THROW', icon: 'bag', cool: 0.6, ability: 'SHIELD' },
  { name: 'Brick', verb: 'LOB', icon: 'brick', cool: 0.95, ability: 'TRAP' }
];

// speed is px/s on the normal prescription; size scales the art; pal is [body, shade, highlight].
const breeds = [
  { name: 'Nibbler', hp: 3, color: '#b5da81', speed: 92, size: 1.2, pal: ['#b5da81', '#61967c', '#e3efb9'] },
  { name: 'Spitter', hp: 4, color: '#dda9d1', speed: 64, size: 1.25, pal: ['#dda9d1', '#8b689e', '#ffe0e5'] },
  { name: 'Bruiser', hp: 7, color: '#efbe77', speed: 52, size: 1.6, pal: ['#efbe77', '#ba7b70', '#ffe9ae'] },
  { name: 'Split pea', hp: 4, color: '#80d5ec', speed: 68, size: 1.25, pal: ['#80d5ec', '#548cae', '#d9f6ff'] },
  { name: 'Hurler', hp: 5, color: '#f4a08c', speed: 46, size: 1.35, pal: ['#f6a68e', '#c25f72', '#ffe0cf'] },
  { name: 'Ralph', hp: 46, color: '#a27ad2', speed: 70, size: 2.7, pal: ['#a27ad2', '#5d3d8c', '#eadcff'] }
];

// Every combat number in one place. Times are seconds on the normal prescription.
const WARD = {
  stagger: 0.12,
  poiseWindow: 0.8,
  hopTime: 0.45,
  hopDist: 125,
  finisherStun: 0.7,
  spinStun: 0.9,
  brickStun: 1.3,
  bruiserBrickStun: 1.6,
  trapStun: 2,
  stompStun: 0.8,
  stompRadius: 105,
  landWindow: 0.16,
  dizzy: 1.2,
  brickRadius: 80,
  gunkRadius: 62,
  telegraph: 1,
  spawnClear: 260,
  spawnMin: 220,
  firstRest: 1.8,
  breather: 3,
  mergeTime: 4,
  corpse: 3,
  clearBonus: 45,
  grudgeBonus: 25,
  ralphPay: 150
};

const WARD_FLASH = ['#ffffff', '#f1f1f1', '#ffffff'],
  WARD_RAGE = ['#c070b4', '#6e2f6c', '#ffd8ef'];

// Where gremlins lurk before a wave: under/behind furniture (prop is its collision box) or in vents.
const wardSpawns = [
  [
    { x: 160, y: 296, prop: [95, 176, 131, 105] },
    { x: 313, y: 272, prop: [282, 210, 62, 48] },
    { x: 851, y: 299, prop: [771, 209, 160, 76] },
    { x: 854, y: 400, prop: [795, 326, 118, 59] },
    { x: 560, y: 190, vent: true },
    { x: 120, y: 545, vent: true },
    { x: 640, y: 560, vent: true }
  ],
  [
    { x: 169, y: 300, prop: [111, 236, 116, 50] },
    { x: 835, y: 288, prop: [776, 206, 118, 68] },
    { x: 481, y: 309, prop: [387, 166, 188, 129] },
    { x: 79, y: 457, prop: [52, 400, 54, 43] },
    { x: 300, y: 190, vent: true },
    { x: 680, y: 190, vent: true },
    { x: 900, y: 545, vent: true },
    { x: 260, y: 555, vent: true }
  ],
  [
    { x: 184, y: 294, prop: [89, 207, 190, 73] },
    { x: 826, y: 294, prop: [731, 207, 190, 73] },
    { x: 490, y: 392, prop: [405, 322, 170, 57] },
    { x: 95, y: 467, prop: [54, 396, 83, 58] },
    { x: 806, y: 528, prop: [831, 498, 90, 54] },
    { x: 560, y: 190, vent: true },
    { x: 330, y: 560, vent: true }
  ],
  [
    { x: 474, y: 310, prop: [380, 167, 188, 130] },
    { x: 157, y: 303, prop: [100, 230, 115, 60] },
    { x: 838, y: 303, prop: [783, 235, 110, 55] },
    { x: 110, y: 523, prop: [70, 450, 80, 60] },
    { x: 640, y: 190, vent: true },
    { x: 300, y: 190, vent: true },
    { x: 870, y: 545, vent: true }
  ],
  [
    { x: 175, y: 298, prop: [110, 160, 130, 125] },
    { x: 400, y: 313, prop: [340, 235, 120, 65] },
    { x: 841, y: 291, prop: [756, 205, 170, 73] },
    { x: 875, y: 493, prop: [835, 430, 80, 50] },
    { x: 620, y: 190, vent: true },
    { x: 560, y: 560, vent: true },
    { x: 80, y: 470, vent: true }
  ]
];

// Waves per combat room on the normal prescription: 0 nibbler, 1 spitter, 2 bruiser, 3 split pea, 4 hurler.
// Consecutive nibblers hunt as a flanking pair. Hurlers join from wave 2 in the later rooms.
const wardWaves = [
  null,
  [[0, 0, 1], [2, 1, 0, 0], [2, 3, 1, 0, 0]],
  [[0, 0, 3], [2, 4, 0, 0], [2, 4, 3, 0, 0]],
  [[0, 0, 1], [2, 4, 0, 0], [2, 2, 4, 1, 3]],
  [[1, 3, 0, 0], [4, 2, 1, 0, 0], [2, 4, 1, 3, 0, 0]]
];

// A room's first fight opens with a teaching wave: fewer, slower, with hints.
const wardTeachWaves = [null, [0, 0], [3, 0], [2], [1, 0]];

const wardWaveLines = [
  '',
  'uninvited guests',
  'they brought friends',
  'the whole digestive tract'
];

const RALPH_LINES = {
  intro: "Hi. I'm Ralph. I live in your gut now.",
  phase2: 'Fine. Cardio.',
  phase3: "THAT'S IT. I'M CALLING MY STOMACH.",
  deflect: ['Rude. That was MY blob.', 'Return policy? In THIS economy?', 'Who taught you manners? A pillow?'],
  dizzy: ['Who moved the bed?', 'Ow. Furniture.', 'I meant to do that.'],
  hit: ['Gut check!', 'Tummy says hi.', 'Stay hydrated, loser.', 'That one was personal.'],
  low: 'I regret nothing. Except this.',
  retreat: "Same time tomorrow? I'll bring snacks.",
  defeat: 'Tell the gremlins... I was gross.'
};

// ---- Combat state ----
let encounter = { room: -1, wave: 0, rest: 0, complete: true, calm: true, grudge: 0, pace: 1, boss: false },
  enemySerial = 0,
  wardAim = null,
  combatFx = [],
  wardChain = 0,
  wardChainT = 0,
  wardChainPop = 0,
  wardBanner = null,
  wardHint = null,
  wardBoss = null,
  wardBossMusic = false,
  ralphRetreated = false,
  wardPrev = null,
  wardDashSerial = 0,
  wardRematchAsked = false;

const wardProgress = {},
  wardHintsShown = new Set(),
  wardVel = { x: 0, y: 0 },
  wardHook = { ground: false, fx: false, overlay: false };

// ---- Small helpers ----
// Rooms 0 and 5 (home base) and 6 (the hallway) are safe: no encounter, no lock, no grudge.
const wardCombatRoom = id => id !== 0 && id !== 5 && id !== 6,
  wardHas = id => Array.isArray(state.upgrades) && state.upgrades.includes(id),
  wardSize = e => breeds[e.type].size * (e.small ? 0.68 : 1),
  wardPace = () => encounter.pace || 1,
  wardWindScale = () => 1 / (cfg().speed * wardPace()),
  wardShake = s => {
    if (!reduced) shake = Math.max(shake, s);
  },
  wardMusic = name => {
    if (typeof music === 'function') music(name);
  };

// The contract with the platform: a department arcade stays locked until its ward is cleared once.
function wardLocked(id = state.room) {
  return wardCombatRoom(id) && !(state.wardClears[id] > 0);
}

function wardGrudge(room = state.room) {
  return Math.max(0, Math.floor(Number(state.wardClears[room]) || 0));
}

function wardPayout(grudge) {
  return Math.round((WARD.clearBonus + WARD.grudgeBonus * Math.min(grudge, 6)) * cfg().coins);
}

function wardFighters() {
  return enemies.filter(e => e.hp > 0 && !(e.emerge > 0));
}

function wardRalphWaiting() {
  return !!state.ralphReady && !state.ralph && !ralphRetreated;
}

function wardSpeed(e) {
  return (
    breeds[e.type].speed *
    cfg().speed *
    wardPace() *
    (e.small ? 1.5 : 1) *
    (e.angry > 0 ? 1.2 : 1) *
    (e.boss && e.phase === 3 ? 1.35 : 1)
  );
}

function wardFace(e, dx, dy, rate = 0) {
  const l = Math.hypot(dx, dy);
  if (l < 0.001) return;
  if (!rate) {
    e.fx = dx / l;
    e.fy = dy / l;
    return;
  }
  // Heavy breeds turn slowly, which is what makes getting behind them possible.
  const want = Math.atan2(dy, dx),
    have = Math.atan2(e.fy, e.fx);
  let turn = want - have;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const a = have + clamp(turn, -rate, rate);
  e.fx = Math.cos(a);
  e.fy = Math.sin(a);
}

// Moves with collision; returns false when the move was mostly blocked.
function wardMove(e, dx, dy, speed, dt) {
  const l = Math.hypot(dx, dy) || 1,
    mx = (dx / l) * speed * dt,
    my = (dy / l) * speed * dt,
    ox = e.x,
    oy = e.y;
  moveEntity(e, mx, my);
  const moved = Math.hypot(e.x - ox, e.y - oy);
  e.vx = (e.x - ox) / Math.max(dt, 1e-4);
  e.vy = (e.y - oy) / Math.max(dt, 1e-4);
  e.walk = (e.walk || 0) + moved / 7;
  return moved > Math.hypot(mx, my) * 0.3;
}

// The furniture box a point would collide with, if any.
function wardBlocker(x, y) {
  for (const p of roomProps[state.room] || []) {
    const [bx, by, bw, bh] = p.box;
    if (x + 11 > bx && x - 11 < bx + bw && y + 4 > by && y - 7 < by + bh) return p.box;
  }
  return null;
}

// Furniture in the way: head for the box corner that makes the shortest trip to the target.
function wardDetour(e, box, tx, ty) {
  const [bx, by, bw, bh] = box,
    m = 26,
    trip = c => Math.hypot(c[0] - e.x, c[1] - e.y) + Math.hypot(c[0] - tx, c[1] - ty),
    corners = [
      [bx - m, by - m],
      [bx + bw + m, by - m],
      [bx - m, by + bh + m],
      [bx + bw + m, by + bh + m]
    ].filter(c => !collides(c[0], c[1]) && Math.hypot(c[0] - e.x, c[1] - e.y) > 14);
  if (!corners.length) return null;
  corners.sort((a, b) => trip(a) - trip(b));
  return { x: corners[0][0], y: corners[0][1], t: 2.5 };
}

// Heads for a point, routing around furniture and orbiting Macy instead of walking through her.
function wardSeek(e, tx, ty, speed, dt, orbit = true) {
  const goalX = tx,
    goalY = ty;
  if (e.detour) {
    e.detour.t -= dt;
    if (e.detour.t <= 0 || Math.hypot(e.detour.x - e.x, e.detour.y - e.y) < 12) e.detour = null;
    else {
      tx = e.detour.x;
      ty = e.detour.y;
    }
  }
  let dx = tx - e.x,
    dy = ty - e.y;
  const l = Math.hypot(dx, dy);
  if (l < 4) {
    e.vx = e.vy = 0;
    return true;
  }
  dx /= l;
  dy /= l;
  const rx = e.x - player.x,
    ry = e.y - player.y,
    rl = Math.max(1, Math.hypot(rx, ry));
  if (orbit && !e.detour && rl < 140 && (dx * -rx + dy * -ry) / rl > 0.25) {
    const side = rx * (ty - player.y) - ry * (tx - player.x) > 0 ? 1 : -1;
    dx = (-ry / rl) * side * 0.9 + (rx / rl) * 0.25;
    dy = (rx / rl) * side * 0.9 + (ry / rl) * 0.25;
  }
  const ok = wardMove(e, dx, dy, speed * Math.min(1, 0.35 + l / 40), dt);
  if (ok) return true;
  const box = wardBlocker(e.x + dx * 14, e.y + dy * 14);
  if (box && !e.detour) e.detour = wardDetour(e, box, goalX, goalY);
  if (!e.detour) moveEntity(e, Math.sin(time * 2 + e.anim) * speed * dt, Math.cos(time * 2 + e.anim) * speed * dt);
  return false;
}

function wardLead(lead) {
  return {
    x: clamp(player.x + wardVel.x * lead, 50, 950),
    y: clamp(player.y + wardVel.y * lead, 182, 565)
  };
}

function wardFx(f) {
  combatFx.push(Object.assign({ t: 0 }, f));
}

function wardSetBanner(title, sub, life = 2.6) {
  wardBanner = { title, sub, t: 0, life };
}

// One-time teaching hints: a pill at the bottom of the canvas plus a short in-world shout.
function wardTeach(key, text, shout, at) {
  if (wardHintsShown.has(key)) return;
  if (!(encounter.grudge === 0 || encounter.boss)) return;
  wardHintsShown.add(key);
  wardHint = { text, t: 0, life: 3.6 };
  if (shout) floating(shout, (at || player).x, (at || player).y - 120, '#ffe29b');
}

function wardTaunt(e, text) {
  if (!e) return;
  e.taunt = { text: Array.isArray(text) ? pick(text) : text, t: 2.6 };
}

// ---- Equipment and the ward strip ----
function equip(i) {
  state.item = clamp(i, 0, 2);
  const w = weapons[state.item];
  $$('[data-item]').forEach(b => {
    const on = +b.dataset.item === state.item;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('useIcon').innerHTML = '<use href="#i-' + w.icon + '"/>';
  $('attackBtn').innerHTML = '<svg><use href="#i-' + w.icon + '"/></svg><span>' + w.verb + '</span>';
  $('attackBtn').setAttribute(
    'aria-label',
    w.name + ' ' + w.verb.toLowerCase() + '. Drag to aim, release to attack.'
  );
  $('useBtn').querySelector('span').textContent = w.ability;
  $('weaponReadout').textContent =
    `${state.item + 1} / ${w.name} · Space / tap ${w.verb.toLowerCase()} · E ${w.ability.toLowerCase()}`;
}

function updateWardHUD() {
  const room = state.room,
    grudge = wardGrudge(room),
    fighters = wardFighters().length;
  let text;
  if (encounter.boss && wardBoss && !encounter.complete)
    text = `RALPH · PHASE ${wardBoss.phase || 1}/3 · ${Math.max(0, Math.ceil(wardBoss.hp))} HP OF NONSENSE`;
  else if (encounter.boss && ralphRetreated) text = "HOME BASE · RALPH RETREATED. HE'LL BE BACK";
  else if (room === 6) text = 'FOURTH FLOOR · NO GREMLINS. JUST YOUR PEOPLE';
  else if (!wardCombatRoom(room))
    text = room === 0 && state.ralph ? 'HOME BASE · RALPH EVICTED. ENJOY THE QUIET' : 'HOME BASE · SAFE TO BREATHE';
  else if (encounter.complete)
    text = `WARD CLEAR ×${grudge} · RALPH'S GRUDGE LV ${grudge} · REMATCH PAYS +${wardPayout(grudge)}`;
  else {
    const pay = wardPayout(encounter.grudge || 0),
      lv = encounter.grudge ? `GRUDGE LV ${encounter.grudge} · ` : '',
      lock = wardLocked(room) ? ' · ARCADE LOCKED' : '';
    text = fighters
      ? `WAVE ${encounter.wave}/3 · ${fighters} GREMLIN${fighters === 1 ? '' : 'S'} · ${lv}CLEAR +${pay}${lock}`
      : `WAVE ${encounter.wave}/3 INCOMING · ${lv}CATCH YOUR BREATH`;
  }
  $('wardStatus').textContent = text;
  const btn = $('rematchBtn');
  btn.classList.toggle('hidden', !wardCombatRoom(room) || !encounter.complete);
  btn.textContent = `Ralph's grudge LV ${grudge} · +${wardPayout(grudge)} ↻`;
}

// ---- Encounters and waves ----
// Called by loadRoom() on every room entry and by the rematch button. Cleared rooms stay calm until a
// rematch; a fight left half-way resumes at the same wave; home base hosts Ralph once he is ready.
function startEncounter() {
  const room = state.room,
    rematch =
      wardRematchAsked && wardCombatRoom(room) && encounter.room === room && encounter.complete && !encounter.boss;
  wardRematchAsked = false;
  enemies = [];
  combatFx = [];
  wardBanner = null;
  wardHint = null;
  wardChain = 0;
  wardBoss = null;
  wardPrev = null;
  if (room !== 0) ralphRetreated = false;
  if (wardBossMusic) {
    wardBossMusic = false;
    wardMusic('room:' + room);
  }
  const calm = grudge => ({
    room,
    wave: 0,
    rest: 0,
    complete: true,
    calm: true,
    grudge,
    pace: 1,
    boss: false
  });
  if (!wardCombatRoom(room)) {
    encounter = calm(0);
    if (room === 0 && wardRalphWaiting()) startRalph();
    updateWardHUD();
    return;
  }
  const grudge = wardGrudge(room),
    resume = rematch ? 0 : wardProgress[room] || 0;
  if (!rematch && !resume && grudge > 0) {
    encounter = calm(grudge);
    updateWardHUD();
    return;
  }
  const wave = resume || 1;
  encounter = {
    room,
    wave,
    rest: 0,
    complete: false,
    calm: false,
    grudge,
    teach: grudge === 0 && wave === 1,
    pace: 1,
    boss: false
  };
  spawnWave(WARD.firstRest);
  if (rematch) wardSetBanner(`RALPH'S GRUDGE · LV ${grudge}`, 'they remember you. vaguely', 2.8);
  else if (resume) wardSetBanner('WAVE ' + wave, 'round two. they kept your seat warm');
  else wardSetBanner('WAVE 1', encounter.teach ? 'a gentle warm-up. allegedly' : wardWaveLines[1]);
  sfx('wave');
  updateWardHUD();
}

// An explicit rematch ("Ralph's grudge") in a cleared room. Re-entering the room or changing the
// prescription goes through loadRoom() and keeps a cleared room calm.
function wardRematch() {
  wardRematchAsked = true;
  startEncounter();
}

// input.js starts the encounter from the rematch button; this listener runs first and marks it a rematch.
$('rematchBtn')?.addEventListener('click', () => {
  wardRematchAsked = true;
});

// The gremlin list for one wave, after prescription, grudge and upgrades.
function wardPlan(room, wave, grudge, teach) {
  if (!wardWaves[room]) return [];
  if (teach) {
    const list = [...wardTeachWaves[room]];
    if (wardHas('repellent') && list.length > 1) list.pop();
    return list;
  }
  const list = [...wardWaves[room][clamp(wave, 1, 3) - 1]],
    n = cfg().enemyCount;
  if (n <= 2 && list.length > 2) list.pop();
  if (n >= 4 && wave > 1) list.push(wave === 2 ? 0 : 3);
  const extra = [0, 3, 4, 1, 2];
  for (let i = 0; i < Math.min(3, grudge); i++) list.push(extra[(i + wave) % extra.length]);
  if (wave === 1 && wardHas('repellent') && list.length > 1) list.pop();
  return list;
}

// Puts the wave's gremlins in hiding. They watch from the dark, telegraph for a second, then pop out.
function spawnWave(popIn = WARD.breather) {
  const room = state.room,
    plan = wardPlan(room, encounter.wave, encounter.grudge || 0, encounter.teach);
  encounter.pace = encounter.teach ? 0.75 : 1 + 0.07 * Math.min(encounter.grudge || 0, 4);
  encounter.rest = popIn;
  wardProgress[room] = encounter.wave;
  const used = [];
  let lone = null;
  plan.forEach((type, i) => {
    const e = makeEnemy(type, 0, 0);
    wardLurk(e, popIn + i * 0.18, used);
    if (type === 0 && !encounter.teach) {
      if (lone) {
        lone.partner = e.id;
        e.partner = lone.id;
        lone.role = 'front';
        e.role = 'flank';
        lone = null;
      } else lone = e;
    }
    enemies.push(e);
  });
  updateWardHUD();
}

function wardPickSpot(used = [], min = WARD.spawnClear) {
  const spots = wardSpawns[state.room] || wardSpawns[1],
    free = spots.filter(s => !used.includes(s)),
    pool = free.length ? free : spots,
    far = pool.filter(s => dist(s, player) >= min);
  if (far.length) return pick(far);
  return pool.slice().sort((a, b) => dist(b, player) - dist(a, player))[0];
}

function wardLurk(e, popIn, used = []) {
  const spot = wardPickSpot(used);
  used.push(spot);
  e.spot = spot;
  e.x = spot.x;
  e.y = spot.y;
  e.emerge = popIn;
  e.emergeMax = popIn;
}

function makeEnemy(type, x, y, small = false) {
  const b = breeds[type],
    hp = small ? 2 : b.hp;
  return {
    id: 'ward-' + ++enemySerial,
    x,
    y,
    type,
    small,
    hp,
    maxHp: hp,
    trail: hp,
    anim: rand(0, 6),
    phase: 1,
    hit: 0,
    iframes: 0,
    squash: 0,
    stagger: 0,
    stun: 0,
    dizzy: 0,
    angry: 0,
    poise: 0,
    poiseT: 0,
    popT: 0,
    wind: 0,
    windMax: 1,
    act: null,
    cool: rand(0.8, 1.6),
    recover: 0,
    aimX: x,
    aimY: y,
    charge: 0,
    chargeX: 0,
    chargeY: 0,
    kx: 0,
    ky: 0,
    z: 0,
    hopT: 0,
    hopX: 0,
    hopY: 0,
    fx: -1,
    fy: 0,
    vx: 0,
    vy: 0,
    walk: 0,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeT: rand(1, 2),
    emerge: 0,
    emergeMax: 1,
    split: false
  };
}

function wardEncounter(dt) {
  if (encounter.complete || encounter.boss) return;
  encounter.rest = Math.max(0, (encounter.rest || 0) - dt);
  encounter.lull = Math.max(0, (encounter.lull || 0) - dt);
  if (enemies.some(e => e.hp > 0)) return;
  if (encounter.wave < 3) {
    encounter.wave++;
    encounter.teach = false;
    spawnWave(WARD.breather);
    wardSetBanner('WAVE ' + encounter.wave, wardWaveLines[encounter.wave], WARD.breather + 0.2);
    sfx('wave');
  } else wardClear();
  updateWardHUD();
}

function wardClear() {
  const room = state.room,
    pay = wardPayout(encounter.grudge || 0);
  encounter.complete = true;
  state.wardClears[room] = (Number(state.wardClears[room]) || 0) + 1;
  delete wardProgress[room];
  coins(pay);
  save();
  wardSetBanner('WARD CLEAR', '+' + pay + ' coins · Macy 1, digestive nonsense 0', 3.2);
  if (state.wardClears[room] === 1) wardHint = { text: 'Arcade unlocked. The beacon is all yours.', t: 0, life: 3.6 };
  sfx('clear');
  updateWardHUD();
}

// ---- Macy's moves ----
function jump() {
  if (isModal() || state.paused || deadDelay > 0 || player.jumpCd > 0 || player.z > 0) return;
  if (!state.started) begin();
  player.vz = 305;
  player.z = 1;
  player.jumpCd = 0.82;
  player.spike = false;
  sfx('jump');
  emit(player.x, player.y, '#e4edcd', 6, 40);
}

function dash() {
  if (isModal() || state.paused || deadDelay > 0) return;
  if (!state.started) begin();
  if (player.dashCd > 0) return;
  player.dash = 0.2;
  player.dashCd = wardHas('slippers') ? 1.25 : 2;
  player.inv = Math.max(player.inv, 0.3);
  wardDashSerial++;
  emit(player.x, player.y, '#d6e6ce', reduced ? 4 : 9, 65);
  sfx('dash');
}

function aimDirection() {
  if (wardAim) {
    const dx = wardAim.dx,
      dy = wardAim.dy,
      d = Math.hypot(dx, dy);
    if (d > 8) return { x: dx / d, y: dy / d };
  }
  const nearest = wardFighters()
    .filter(e => dist(player, e) < (state.item ? 440 : 130 + (e.boss ? 40 : 0)))
    .sort((a, b) => dist(a, player) - dist(b, player))[0];
  if (nearest) {
    const d = Math.max(1, dist(player, nearest));
    return { x: (nearest.x - player.x) / d, y: (nearest.y - player.y) / d };
  }
  const d = Math.hypot(player.lastDx, player.lastDy) || 1;
  return { x: player.lastDx / d, y: player.lastDy / d };
}

function attack() {
  if (isModal() || state.paused || deadDelay > 0 || player.vomit > 0.55 || player.attackCd > 0) return;
  if (!state.started) begin();
  const w = weapons[state.item],
    a = aimDirection();
  player.dir = a.x >= 0 ? 1 : -1;
  player.aimX = a.x;
  player.aimY = a.y;
  player.attackKind = state.item;
  if (state.item === 0) {
    // Airborne swings become a spike that lands as a stomp; a late press inside the landing window too.
    if (player.z > 0) {
      if (!player.spike) {
        player.spike = true;
        player.swingHit = true;
        player.attack = player.attackDuration = 0.6;
        player.attackCd = 0.2;
        sfx('swing', { combo: 2 });
      }
      return;
    }
    if (player.landT > 0) {
      wardStomp();
      return;
    }
    player.swingHit = false;
    player.combo = player.comboTime > 0 ? (player.combo + 1) % 3 : 0;
    player.comboTime = 1.1;
    const cool = player.combo === 2 ? 0.56 : w.cool;
    player.attackDuration = cool;
    player.attack = cool;
    player.attackCd = cool;
    sfx('swing', { combo: player.combo });
    return;
  }
  player.attackDuration = w.cool;
  player.attack = w.cool;
  player.attackCd = w.cool;
  const power = wardAim ? clamp(Math.hypot(wardAim.dx, wardAim.dy) / 65, 0.65, 1.35) : 1;
  if (state.item === 1) {
    projectiles.push({
      x: player.x + a.x * 25,
      y: player.y - 32 + a.y * 25,
      z: player.z,
      age: 0,
      vx: a.x * 430 * power,
      vy: a.y * 430 * power,
      life: 1.3,
      kind: 'bag',
      friendly: true,
      bounces: 0
    });
    sfx('throw');
    return;
  }
  // The brick lobs over furniture and lands where it was aimed, leading a target it auto-aimed at.
  let tx = player.x + a.x * 230 * power,
    ty = player.y + a.y * 230 * power;
  const target = !wardAim
    ? wardFighters()
        .filter(e => dist(player, e) < 440)
        .sort((p, q) => dist(p, player) - dist(q, player))[0]
    : null;
  if (target) {
    tx = target.x + (target.vx || 0) * 0.35;
    ty = target.y + (target.vy || 0) * 0.35;
    const d = Math.hypot(tx - player.x, ty - player.y);
    if (d > 330) {
      tx = player.x + ((tx - player.x) / d) * 330;
      ty = player.y + ((ty - player.y) / d) * 330;
    }
  }
  tx = clamp(tx, 50, 950);
  ty = clamp(ty, 182, 566);
  projectiles.push({
    x: player.x,
    y: player.y - 32,
    z: player.z,
    age: 0,
    vx: (tx - player.x) / 0.85,
    vy: (ty - player.y) / 0.85,
    life: 0.85,
    kind: 'brick',
    friendly: true,
    tx,
    ty
  });
  sfx('throw');
}

// The pillow's hit frame: a front arc, wider on the finisher, all the way round on the spin.
function pillowHit(spin = false) {
  const finisher = !spin && player.combo === 2,
    reach = (wardHas('pillow') ? 122 : 104) + (spin ? 25 : finisher ? 14 : 0),
    ax = player.aimX || player.dir,
    ay = player.aimY || 0,
    arc = spin ? -2 : finisher ? -0.35 : -0.05,
    kind = spin ? 'spin' : finisher ? 'finisher' : 'pillow';
  let landed = 0;
  for (const e of wardFighters()) {
    const d = dist(player, e),
      reachE = reach + (e.boss ? 45 : (wardSize(e) - 1.2) * 18),
      dot = ((e.x - player.x) * ax + (e.y - player.y) * ay) / Math.max(1, d);
    if (d < reachE && dot > arc) {
      const power = spin || finisher ? 2 : 1,
        knock = spin ? 60 : finisher ? 70 : 30,
        stun = spin ? WARD.spinStun : finisher ? WARD.finisherStun : 0;
      if (hitEnemy(e, power, knock, { kind, stun })) landed++;
    }
  }
  for (const p of projectiles) {
    if (p.friendly || p.kind !== 'blob' || p.life <= 0) continue;
    const dx = p.x - player.x,
      dy = p.y + 32 - player.y,
      d = Math.hypot(dx, dy),
      dot = (dx * ax + dy * ay) / Math.max(1, d);
    if (d < reach + 14 && (spin || dot > -0.1)) wardDeflect(p);
  }
  const fx = player.x + ax * 70,
    fy = player.y - 35 + ay * 60;
  if (!reduced)
    for (let i = 0; i < (finisher || spin ? 6 : 3); i++)
      wardFx({
        kind: 'feather',
        x: fx + rand(-14, 14),
        y: fy + 40,
        z: 40 + rand(-8, 12),
        vx: ax * rand(30, 90) + rand(-30, 30),
        vy: ay * rand(10, 40) + rand(-10, 10),
        vz: rand(30, 90),
        rot: rand(0, 6),
        life: rand(0.8, 1.3)
      });
  if (landed && finisher) wardShake(0.12);
}

function wardDeflect(p) {
  const target =
    (p.from && enemies.find(e => e.id === p.from && e.hp > 0 && !(e.emerge > 0))) ||
    wardFighters().sort((a, b) => dist(a, p) - dist(b, p))[0];
  p.friendly = true;
  p.kind = 'returned';
  p.life = 2.5;
  p.homing = target ? target.id : null;
  const tx = target ? target.x : p.x - p.vx,
    ty = target ? target.y - 30 * wardSize(target) : p.y - p.vy,
    d = Math.max(1, Math.hypot(tx - p.x, ty - p.y));
  p.vx = ((tx - p.x) / d) * 380;
  p.vy = ((ty - p.y) / d) * 380;
  floating('RETURN TO SENDER', player.x, player.y - 110);
  wardFx({ kind: 'spark', x: p.x, y: p.y, life: 0.3, col: '#fff2a8', n: 6 });
  sfx('bounce');
}

// A pillow spike on landing: everything close takes 2 and is stunned.
function wardStomp() {
  const r = WARD.stompRadius + (wardHas('pillow') ? 15 : 0);
  player.spike = false;
  player.landT = 0;
  player.attackKind = 0;
  player.swingHit = true;
  player.attack = player.attackDuration = 0.3;
  player.attackCd = 0.4;
  player.stompT = 0.3;
  for (const e of wardFighters())
    if (dist(player, e) < r + (e.boss ? 40 : 0)) hitEnemy(e, 2, 50, { kind: 'stomp', stun: WARD.stompStun });
  for (const p of projectiles)
    if (!p.friendly && p.kind === 'blob' && Math.hypot(p.x - player.x, p.y + 32 - player.y) < r) wardDeflect(p);
  wardFx({ kind: 'ring', ground: true, x: player.x, y: player.y, r0: 18, r1: r, life: 0.42, col: '#fff3cf', w: 7 });
  wardFx({ kind: 'puff', x: player.x, y: player.y, life: 0.5, n: 8, r: r * 0.7 });
  floating('SPIKE!', player.x, player.y - 100);
  wardShake(0.14);
  hitStop = Math.max(hitStop, 0.05);
  sfx('hit');
}

function useItem() {
  if (isModal() || state.paused || deadDelay > 0 || player.itemCd > 0) return;
  if (!state.started) begin();
  if (state.item === 0) {
    player.itemCd = 4;
    player.combo = 2;
    player.attackKind = 0;
    player.attack = player.attackDuration = 0.55;
    player.swingHit = true;
    player.spinT = 0.55;
    pillowHit(true);
    player.inv = Math.max(player.inv, 0.25);
    wardFx({ kind: 'ring', ground: true, x: player.x, y: player.y, r0: 30, r1: 130, life: 0.35, col: '#fff6de', w: 5 });
    sfx('swing', { combo: 3 });
  }
  if (state.item === 1) {
    player.shield = wardHas('bag') ? 3.4 : 2.5;
    player.itemCd = 7;
    floating('DIGNITY BUBBLE', player.x, player.y - 115, '#c1f2cc');
    sfx('shield');
  }
  if (state.item === 2) {
    traps.push({ x: player.x, y: player.y + 8, life: 12 });
    player.itemCd = 3;
    sfx('trap');
  }
}

// ---- Hits, kills and splits ----
// opt.kind: pillow | finisher | spin | stomp | bag | brick | trap | returned | dash. opt.from: hit origin.
function hitEnemy(e, power = 1, knock = 36, opt = {}) {
  if (!e || e.hp <= 0 || e.emerge > 0 || e.iframes > 0) return false;
  if (e.z > 16) return false;
  const kind = opt.kind || 'pillow',
    from = opt.from || player,
    size = wardSize(e);
  if (e.boss && e.invuln > 0) {
    floating('NOPE', e.x, e.y - 150, '#eadcff');
    e.iframes = 0.2;
    return false;
  }
  const away = dist(from, e) || 1,
    behind = ((from.x - e.x) * e.fx + (from.y - e.y) * e.fy) / away < -0.2,
    pillowish = kind === 'pillow' || kind === 'finisher' || kind === 'spin' || kind === 'stomp';
  let dmg = power,
    stun = opt.stun || 0;
  e.iframes = 0.06;
  // Bruisers shrug off pillow pokes from the front, and even a finisher only dents them without a stun.
  // Their back, a dizzy spell, a stomp from above or a brick gets through.
  if (e.type === 2 && pillowish && kind !== 'stomp' && !behind && !(e.dizzy > 0)) {
    if (kind === 'pillow') dmg = 0;
    else {
      dmg = 1;
      stun = 0;
    }
  }
  if (e.type === 2 && kind === 'brick') {
    dmg += 1;
    stun = Math.max(stun, WARD.bruiserBrickStun);
  }
  if (e.dizzy > 0 && (e.type === 2 || e.boss)) dmg += 1;
  if (e.boss) {
    knock = 0;
    stun = kind === 'brick' ? 0.5 : kind === 'trap' ? 1 : 0;
    if (kind === 'brick') dmg += 1;
  }
  if (dmg <= 0) {
    // The shrug: a clank, a little shove, and it still counts toward an angry response.
    e.squash = 0.1;
    e.shrugT = 0.3;
    e.kx += ((e.x - from.x) / away) * 90;
    e.ky += ((e.y - from.y) / away) * 90;
    floating('BONK', e.x, e.y - 70 * size, '#bfe3ff');
    wardFx({
      kind: 'spark',
      x: e.x + ((from.x - e.x) / away) * 22,
      y: e.y - 30 * size,
      life: 0.25,
      col: '#cfeaff',
      n: 5
    });
    wardTeach('shrug', 'Bruisers shrug off pokes. Hit the back, wait for dizzy, or LOB a brick.', 'SHRUGGED');
    sfx('shield');
    wardPoise(e);
    return true;
  }
  if (e.type === 3 && !e.small && !e.split) {
    wardSplit(e);
    wardChainHit();
    return true;
  }
  e.hp -= dmg;
  e.hit = reduced ? 0.06 : 0.11;
  e.squash = 0.2;
  if (knock > 0) {
    const heavy = e.type === 2 && kind !== 'brick' && !(e.dizzy > 0) ? 0.45 : 1;
    e.kx = ((e.x - from.x) / away) * knock * 14 * heavy;
    e.ky = ((e.y - from.y) / away) * knock * 14 * heavy;
  }
  if (e.pod)
    for (const o of enemies)
      if (o.pod === e.pod) {
        o.calm = 0;
        o.merging = false;
      }
  wardChainHit();
  const big = kind === 'finisher' || kind === 'brick' || kind === 'stomp' || kind === 'spin';
  wardFx({
    kind: 'impact',
    x: e.x,
    y: e.y - e.z - 26 * size,
    life: big ? 0.2 : 0.14,
    r: big ? 34 : 22,
    col: kind === 'finisher' ? '#ffe28a' : '#ffffff'
  });
  emit(e.x, e.y - 20, breeds[e.type].color, reduced ? 4 : big ? 14 : 8, big ? 170 : 120);
  hitStop = Math.max(hitStop, big ? 0.07 : e.boss ? 0.04 : 0.035);
  if (kind === 'finisher') wardShake(0.1);
  if (kind === 'brick') wardShake(0.2);
  if (e.hp <= 0) {
    wardKill(e);
    return true;
  }
  floating('-' + dmg, e.x + rand(-8, 8), e.y - 72 * size, breeds[e.type].color);
  sfx(e.boss ? 'bossHit' : 'hit');
  if (stun > 0) {
    e.stun = Math.max(e.stun, stun);
    e.wind = 0;
    e.charge = 0;
    e.volleys = 0;
    e.act = null;
    e.poise = 0;
    e.poiseT = 0;
    e.poisePending = false;
    sfx('stun');
    if (kind === 'finisher') floating('STUNNED', e.x, e.y - 90 * size, '#ffe2a1');
  } else {
    e.stagger = Math.max(e.stagger, WARD.stagger);
    wardPoise(e);
  }
  // Last, so a phase change clears whatever stun, stagger or belly bump this hit just set up.
  if (e.boss) {
    if (kind === 'returned') wardTaunt(e, RALPH_LINES.deflect);
    wardRalphPhase(e);
    updateWardHUD();
  }
  return true;
}

// Two hits in a row and a gremlin gets out of there. Bruisers get angry instead; Ralph belly-bumps.
function wardPoise(e) {
  if (e.dizzy > 0 || e.stun > 0) return;
  e.poise = e.poiseT > 0 ? e.poise + 1 : 1;
  e.poiseT = e.boss ? 1.2 : WARD.poiseWindow;
  if (e.poise < (e.boss ? 3 : 2)) return;
  e.poise = 0;
  e.poiseT = 0;
  if (e.boss) {
    if (!e.wind && !e.charge && !e.slam && !e.volleys) {
      e.act = 'bump';
      e.wind = e.windMax = 0.35;
    }
    return;
  }
  if (e.type === 2) {
    if (!e.charge && !e.wind) {
      e.angry = 2;
      e.recover = 0;
      wardWindCharge(e, wardWindScale() * 0.6);
      floating('ANGRY', e.x, e.y - 100, '#ff9b8a');
    }
    return;
  }
  if (e.wind > 0 || e.charge > 0) {
    e.poisePending = true;
    return;
  }
  wardHop(e);
}

function wardHop(e) {
  let dx = e.x - player.x,
    dy = e.y - player.y;
  const l = Math.hypot(dx, dy) || 1,
    turn = rand(-0.5, 0.5),
    c = Math.cos(turn),
    s = Math.sin(turn);
  dx /= l;
  dy /= l;
  let hx = dx * c - dy * s,
    hy = dx * s + dy * c;
  // Toward the open floor if a wall is right behind.
  if (collides(e.x + hx * 60, e.y + hy * 60)) {
    hx = -dy;
    hy = dx;
    if (collides(e.x + hx * 60, e.y + hy * 60)) {
      hx = dy;
      hy = -dx;
    }
  }
  e.hopT = WARD.hopTime;
  e.hopX = (hx * WARD.hopDist) / WARD.hopTime;
  e.hopY = (hy * WARD.hopDist) / WARD.hopTime;
  e.wind = 0;
  e.charge = 0;
  e.poisePending = false;
  sfx('leap');
  wardTeach('hop', 'Mash and they hop away. Hit, pause a beat, then hit-hit lands the stun.', 'HOP!', e);
}

function wardChainHit() {
  wardChain++;
  wardChainT = 3;
  wardChainPop = 0.18;
  if (wardChain > (state.bestChain || 0)) state.bestChain = wardChain;
}

function wardKill(e) {
  const size = wardSize(e),
    pay = e.boss
      ? Math.round(WARD.ralphPay * cfg().coins)
      : e.minion
        ? 4
        : Math.round(((e.small ? 7 : 12) + 3 * Math.min(encounter.grudge || 0, 4)) * cfg().coins);
  e.hp = 0;
  e.deadT = 0;
  e.pay = e.silent ? 0 : pay;
  e.wind = 0;
  e.charge = 0;
  e.debris = [];
  const kinds = e.boss
    ? ['crown', 'ear', 'ear', 'eye', 'eye', 'tooth', 'foot', 'foot', 'tuft', 'tooth']
    : ['ear', 'ear', 'eye', e.type === 2 ? 'helmet' : e.type === 4 ? 'brick' : 'tooth', 'foot'];
  for (const kind of kinds)
    e.debris.push({
      kind,
      x: e.x,
      y: e.y,
      z: (20 + rand(0, 20)) * size,
      vx: rand(-150, 150) * (e.boss ? 1.6 : 1),
      vy: rand(-70, 70),
      vz: rand(170, 330) * (e.boss ? 1.3 : 1),
      rot: rand(0, 6),
      vr: rand(-12, 12)
    });
  if (e.pay) coins(e.pay);
  state.evictions = (Number(state.evictions) || 0) + 1;
  emit(e.x, e.y - 20 * size, breeds[e.type].color, reduced ? 8 : e.boss ? 60 : 22, e.boss ? 260 : 180);
  emit(e.x, e.y - 20 * size, '#fffbe8', reduced ? 3 : e.boss ? 24 : 8, e.boss ? 200 : 140);
  hitStop = Math.max(hitStop, e.boss ? 0.25 : 0.06);
  wardShake(e.boss ? 0.6 : 0.1);
  sfx(e.boss ? 'bossDie' : 'enemyDie');
  if (e.boss) wardRalphDefeat(e);
  updateWardHUD();
}

function wardSplit(e) {
  e.split = true;
  e.hp = 0;
  e.gone = true;
  const pod = 'pod-' + e.id;
  for (const s of [-1, 1]) {
    const child = makeEnemy(3, clamp(e.x + s * 23, 45, 955), clamp(e.y + s * 15, 180, 565), true);
    if (collides(child.x, child.y)) {
      child.x = e.x;
      child.y = e.y;
    }
    child.pod = pod;
    child.calm = 0;
    child.kx = s * 300;
    child.ky = s * 120;
    child.stagger = 0.3;
    child.squash = 0.2;
    child.cool = rand(0.6, 1);
    enemies.push(child);
  }
  emit(e.x, e.y - 24, breeds[3].color, reduced ? 6 : 16, 160);
  wardFx({ kind: 'impact', x: e.x, y: e.y - 30, life: 0.18, r: 30, col: '#d9f6ff' });
  floating('MITOSIS. RUDE.', e.x, e.y - 70, '#b9edff');
  wardTeach('split', 'Finish both halves fast. Left alone for 4 seconds, they re-merge.', 'SPLIT!');
  sfx('split');
  updateWardHUD();
}

// Halves left alone for WARD.mergeTime seconds waddle together and re-merge into a 4-HP pea.
function wardMerge(dt) {
  const halves = enemies.filter(e => e.hp > 0 && e.small && e.pod && !(e.emerge > 0)),
    pods = {};
  for (const h of halves) (pods[h.pod] ??= []).push(h);
  for (const pod in pods) {
    const pair = pods[pod];
    for (const h of pair) h.calm = (h.calm || 0) + dt;
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    if (a.calm < WARD.mergeTime || b.calm < WARD.mergeTime) continue;
    a.merging = b.merging = true;
    if (dist(a, b) > 30 && a.calm < WARD.mergeTime + 2.5) continue;
    const pea = makeEnemy(3, (a.x + b.x) / 2, (a.y + b.y) / 2);
    if (collides(pea.x, pea.y)) {
      pea.x = a.x;
      pea.y = a.y;
    }
    pea.popT = 0.35;
    pea.cool = 1;
    a.hp = b.hp = 0;
    a.gone = b.gone = true;
    enemies.push(pea);
    emit(pea.x, pea.y - 24, breeds[3].color, reduced ? 6 : 14, 120);
    floating('RE-MERGED. GROSS.', pea.x, pea.y - 80, '#b9edff');
    sfx('squelch');
    updateWardHUD();
  }
}

function wardWallSplat(e) {
  e.kx = e.ky = 0;
  e.stun = Math.max(e.stun, 0.4);
  e.wind = 0;
  e.charge = 0;
  floating('WALL SPLAT', e.x, e.y - 80, '#ffd2b0');
  emit(e.x, e.y - 20, breeds[e.type].color, reduced ? 4 : 10, 120);
  wardShake(0.1);
  sfx('wallSplat');
  if (e.hp > 1 && !e.boss) {
    e.hp--;
    e.hit = 0.1;
  }
}

// ---- Getting hurt ----
function damage(source, from) {
  // A high enough jump clears ground hits and blobs.
  if (player.z > 22) return;
  if (player.inv > 0 || player.shield > 0 || deadDelay > 0 || isModal()) return;
  state.hp--;
  player.inv = wardHas('thick') ? 2.6 : 1.65;
  player.vomit = 1.15;
  wardShake(0.22);
  hitStop = Math.max(hitStop, 0.06);
  if (from) player.dir = from.x > player.x ? 1 : -1;
  puddles.push({ x: player.x + player.dir * 63, y: player.y + 8, life: 8 });
  const lines = {
    blob: 'DIRECT HIT. INDIRECT LUNCH.',
    bite: 'NIBBLED.',
    charge: 'FLATTENED.',
    gunk: 'GUNKED.',
    slam: 'RALPH-QUAKE.',
    bump: 'BELLY CHECK.'
  };
  floating(lines[source] || 'BLERGH!', player.x, player.y - 105, '#def281');
  sfx('hurt');
  wardChain = 0;
  if (wardBoss && wardBoss.hp > 0 && !encounter.complete) wardTaunt(wardBoss, RALPH_LINES.hit);
  hud();
  save();
  if (state.hp <= 0) {
    deadDelay = 1.3;
    if (encounter.boss && !encounter.complete) wardRalphRetreat();
  }
}

function brickBurst(p) {
  const x = p.tx ?? p.x,
    y = p.ty ?? p.y + 32;
  p.life = 0;
  wardFx({ kind: 'ring', ground: true, x, y, r0: 12, r1: WARD.brickRadius + 10, life: 0.45, col: '#ffd9b8', w: 8 });
  wardFx({ kind: 'puff', x, y, life: 0.55, n: 9, r: 50 });
  emit(x, y - 4, '#e8a091', reduced ? 6 : 20, 165);
  let hits = 0;
  for (const e of wardFighters())
    if (dist({ x, y }, e) < WARD.brickRadius + (e.boss ? 35 : 0))
      if (hitEnemy(e, 2, 40, { kind: 'brick', stun: WARD.brickStun, from: { x, y } })) hits++;
  if (hits > 1) floating('BRICK-SHAPED OPINION', x, y - 70, '#f5c5ab');
  wardShake(0.2);
  hitStop = Math.max(hitStop, 0.05);
  sfx('explode');
}

function gunkSplash(p) {
  const x = p.tx ?? p.x,
    y = p.ty ?? p.y + 32;
  p.life = 0;
  wardFx({ kind: 'ring', ground: true, x, y, r0: 10, r1: WARD.gunkRadius + 8, life: 0.4, col: '#c7e07a', w: 7 });
  emit(x, y - 6, '#a9c95b', reduced ? 6 : 18, 150);
  puddles.push({ x, y, life: 3.5, gunk: true, r: 42 });
  wardShake(0.08);
  sfx('squelch');
  if (Math.hypot(player.x - x, player.y - y) < WARD.gunkRadius && player.z <= 22) damage('gunk', { x, y });
}

// ---- The ward step ----
function updateCombat(dt) {
  wardRematchAsked = false;
  wardPlayer(dt);
  wardEncounter(dt);
  for (const e of [...enemies]) wardEnemy(e, dt);
  wardMerge(dt);
  wardProjectiles(dt);
  wardFxUpdate(dt);
  enemies = enemies.filter(
    e => e.hp > 0 || (!e.gone && e.deadT !== undefined && e.deadT < (e.boss ? 4.5 : WARD.corpse))
  );
  projectiles = projectiles.filter(p => p.life > 0);
  $('jumpBtn').style.opacity = player.jumpCd > 0 ? '.5' : '1';
}

function wardPlayer(dt) {
  player.jumpCd = Math.max(0, player.jumpCd - dt);
  player.landT = Math.max(0, (player.landT || 0) - dt);
  player.spinT = Math.max(0, (player.spinT || 0) - dt);
  player.stompT = Math.max(0, (player.stompT || 0) - dt);
  if (player.z > 0) {
    player.vz -= 780 * dt;
    player.z = Math.max(0, player.z + player.vz * dt);
    if (player.spike) player.attack = Math.max(player.attack, 0.2);
    if (player.z === 0) {
      player.landT = WARD.landWindow;
      emit(player.x, player.y, '#d6e3c8', reduced ? 4 : 10, 55);
      if (player.spike) wardStomp();
    }
  } else player.spike = false;
  if (
    player.attack > 0 &&
    player.attackKind === 0 &&
    !player.swingHit &&
    player.attack < player.attackDuration * 0.65
  ) {
    player.swingHit = true;
    pillowHit();
  }
  // Gunk is sticky: Macy keeps about half of each step's movement while standing in it.
  if (wardPrev) {
    const mx = player.x - wardPrev.x,
      my = player.y - wardPrev.y,
      step = Math.hypot(mx, my);
    if (
      step > 0 &&
      step < 20 &&
      player.z <= 0 &&
      puddles.some(p => p.gunk && p.life > 0 && Math.hypot(player.x - p.x, (player.y - p.y) * 1.6) < p.r)
    ) {
      const keep = player.dash > 0 ? 0.75 : 0.45,
        nx = wardPrev.x + mx * keep,
        ny = wardPrev.y + my * keep;
      if (!collides(nx, ny)) {
        player.x = nx;
        player.y = ny;
      }
      wardTeach('gunk', 'Gunk is sticky. Jump or dash out of it.');
    }
    const vx = (player.x - wardPrev.x) / Math.max(dt, 1e-4),
      vy = (player.y - wardPrev.y) / Math.max(dt, 1e-4);
    if (Math.hypot(vx, vy) < 700) {
      const k = Math.min(1, dt * 10);
      wardVel.x += (vx - wardVel.x) * k;
      wardVel.y += (vy - wardVel.y) * k;
    }
  }
  wardPrev = { x: player.x, y: player.y };
  // Dashing through a gremlin mid-wind-up cancels its attack.
  if (player.dash > 0)
    for (const e of wardFighters())
      if (e.wind > 0 && e.dashed !== wardDashSerial && dist(player, e) < 26 + 16 * wardSize(e)) {
        e.dashed = wardDashSerial;
        e.wind = 0;
        e.act = null;
        e.charge = 0;
        e.volleys = 0;
        e.poisePending = false;
        e.stagger = 0.45;
        e.squash = 0.15;
        e.cool = Math.max(e.cool, 0.8);
        floating('DENIED', e.x, e.y - 90, '#d6e6ce');
        wardFx({ kind: 'spark', x: e.x, y: e.y - 30, life: 0.3, col: '#e6f6d6', n: 6 });
        sfx('stun');
      }
  if (wardChainT > 0) {
    wardChainT -= dt;
    if (wardChainT <= 0) wardChain = 0;
  }
}

function wardEnemy(e, dt) {
  if (e.hp <= 0) {
    wardCorpse(e, dt);
    return;
  }
  if (e.emerge > 0) {
    wardEmerge(e, dt);
    return;
  }
  e.hit = Math.max(0, e.hit - dt);
  e.iframes = Math.max(0, e.iframes - dt);
  e.squash = Math.max(0, e.squash - dt);
  e.shrugT = Math.max(0, (e.shrugT || 0) - dt);
  e.popT = Math.max(0, e.popT - dt);
  e.angry = Math.max(0, e.angry - dt);
  e.poiseT = Math.max(0, e.poiseT - dt);
  if (e.poiseT <= 0) e.poise = 0;
  e.trail += (e.hp - e.trail) * Math.min(1, dt * 3);
  if (e.taunt) {
    e.taunt.t -= dt;
    if (e.taunt.t <= 0) e.taunt = null;
  }
  if (e.kx || e.ky) {
    const mx = e.kx * dt,
      my = e.ky * dt,
      ox = e.x,
      oy = e.y,
      fast = Math.hypot(e.kx, e.ky);
    moveEntity(e, mx, my);
    if (fast > 800 && Math.hypot(e.x - ox, e.y - oy) < Math.hypot(mx, my) * 0.4) wardWallSplat(e);
    const f = Math.exp(-dt * 14);
    e.kx *= f;
    e.ky *= f;
    if (Math.hypot(e.kx, e.ky) < 6) e.kx = e.ky = 0;
  }
  if (e.hopT > 0) {
    wardHopStep(e, dt);
    return;
  }
  if (e.stun > 0) {
    e.stun = Math.max(0, e.stun - dt);
    e.vx = e.vy = 0;
    return;
  }
  if (e.dizzy > 0) {
    e.dizzy = Math.max(0, e.dizzy - dt);
    e.vx = e.vy = 0;
    return;
  }
  if (e.stagger > 0) {
    e.stagger = Math.max(0, e.stagger - dt);
    return;
  }
  if (e.popT > 0) return;
  for (const t of traps)
    if (t.life > 0 && e.z < 10 && dist(e, t) < 32 + (e.boss ? 30 : 0)) {
      t.life = 0;
      e.iframes = 0;
      hitEnemy(e, 2, 20, { kind: 'trap', stun: WARD.trapStun, from: t });
      wardFx({ kind: 'ring', ground: true, x: t.x, y: t.y, r0: 8, r1: 46, life: 0.35, col: '#ffcfb0', w: 5 });
      sfx('trap');
      if (e.hp <= 0 || e.stun > 0) return;
    }
  if (e.boss) wardRalph(e, dt);
  else if (e.type === 0) wardNibbler(e, dt);
  else if (e.type === 1) wardSpitter(e, dt);
  else if (e.type === 2) wardBruiser(e, dt);
  else if (e.type === 3) wardPea(e, dt);
  else wardHurler(e, dt);
  if (!e.charge && !e.slam) wardSeparate(e, dt);
}

function wardEmerge(e, dt) {
  const before = e.emerge,
    tele = Math.min(WARD.telegraph, e.emergeMax);
  e.emerge -= dt;
  if (!e.boss) {
    // Lurkers shy away from Macy; a telegraph never starts within WARD.spawnClear of her.
    if (e.emerge > tele && dist(e, player) < WARD.spawnClear) wardRelocate(e, e.emerge);
    else if (before > tele && e.emerge <= tele && dist(e, player) < WARD.spawnClear) wardRelocate(e, tele);
  }
  if (e.emerge > 0) return;
  if (!e.boss && dist(e, player) < WARD.spawnMin) {
    wardRelocate(e, 0.6);
    return;
  }
  e.emerge = 0;
  e.popT = 0.35;
  e.popDist = dist(e, player);
  e.cool = e.boss ? 1.2 : rand(0.5, 1.1);
  wardFace(e, player.x - e.x, player.y - e.y);
  emit(e.x, e.y - 6, '#cfd8c4', reduced ? 4 : 10, 90);
  wardFx({ kind: 'puff', x: e.x, y: e.y, life: 0.45, n: e.boss ? 14 : 6, r: e.boss ? 70 : 26 });
  sfx(e.boss ? 'boss' : 'blob');
  if (e.boss) wardShake(0.3);
  if (encounter.teach) wardTeach('swing', 'Tap SWING or press Space. Every third swing in a row stuns.', 'tap SWING');
  updateWardHUD();
}

function wardRelocate(e, left) {
  const taken = enemies.filter(o => o !== e && o.emerge > 0 && o.spot).map(o => o.spot),
    spot = wardPickSpot(taken);
  e.spot = spot;
  e.x = spot.x;
  e.y = spot.y;
  e.emerge = left;
  if (left <= WARD.telegraph) e.emergeMax = left;
}

function wardCorpse(e, dt) {
  if (e.deadT === undefined) return;
  e.deadT += dt;
  for (const d of e.debris || []) {
    if (d.rest) continue;
    d.vz -= 900 * dt;
    d.z += d.vz * dt;
    d.x = clamp(d.x + d.vx * dt, 44, 956);
    d.y = clamp(d.y + d.vy * dt, 176, 572);
    d.rot += d.vr * dt;
    if (d.z <= 0) {
      d.z = 0;
      if (Math.abs(d.vz) < 80) d.rest = true;
      else {
        d.vz = -d.vz * 0.45;
        d.vx *= 0.6;
        d.vy *= 0.6;
        d.vr *= 0.5;
      }
    }
  }
}

function wardHopStep(e, dt) {
  e.hopT -= dt;
  const k = clamp(1 - e.hopT / WARD.hopTime, 0, 1);
  e.z = Math.sin(k * Math.PI) * 40;
  moveEntity(e, e.hopX * dt, e.hopY * dt);
  e.vx = e.hopX;
  e.vy = e.hopY;
  if (e.hopT > 0) return;
  e.hopT = 0;
  e.z = 0;
  e.angry = 1.6;
  e.cool = Math.min(e.cool, 0.1);
  e.huntT = 9;
  e.squash = 0.14;
  wardFx({ kind: 'puff', x: e.x, y: e.y, life: 0.35, n: 4, r: 20 });
}

function wardSeparate(e, dt) {
  for (const o of enemies) {
    if (o === e || o.hp <= 0 || o.emerge > 0) continue;
    const space = dist(e, o),
      want = o.boss || e.boss ? 70 : 32;
    if (space > 0 && space < want) moveEntity(e, ((e.x - o.x) / space) * 30 * dt, ((e.y - o.y) / space) * 30 * dt);
  }
}

// ---- Breeds ----
function wardCrouch(e, base = 0.55) {
  e.wind = e.windMax = base * wardWindScale() * (e.angry > 0 ? 0.65 : 1);
  e.act = 'bite';
  e.huntT = 0;
  e.ready = false;
  wardTeach('crouch', 'A crouch means a lunge. JUMP it, DASH through it, or step back.', 'CROUCH = INCOMING', e);
}

function wardStartLunge(e, dur, lead) {
  const aim = wardLead(lead),
    l = Math.max(1, Math.hypot(aim.x - e.x, aim.y - e.y));
  e.chargeX = (aim.x - e.x) / l;
  e.chargeY = (aim.y - e.y) / l;
  e.charge = dur;
  e.bit = false;
  e.jumped = false;
  wardFace(e, e.chargeX, e.chargeY);
  sfx('leap');
}

function wardLunge(e, dt, speed, reach) {
  const ox = e.x,
    oy = e.y;
  moveEntity(e, e.chargeX * speed * dt, e.chargeY * speed * dt);
  e.vx = (e.x - ox) / dt;
  e.vy = (e.y - oy) / dt;
  e.charge -= dt;
  if (!e.bit && dist(player, e) < reach) {
    if (player.z > 22) {
      if (!e.jumped) {
        e.jumped = true;
        floating('WHIFF', e.x, e.y - 60, '#e4edcd');
      }
    } else {
      const hp = state.hp;
      damage('bite', e);
      if (state.hp < hp) e.bit = true;
    }
  }
  if (e.charge > 0) return;
  e.charge = 0;
  // A biter that connects backs off to gloat; a miss recovers faster.
  e.cool = (e.bit ? 2.2 : 1) * wardWindScale();
  wardLull();
  if (e.poisePending) wardHop(e);
}

// A teaching wave leaves a breath between attacks so a new player can read what just happened.
function wardLull() {
  if (encounter.teach) encounter.lull = 2.2;
}

// Attack tokens: only so many gremlins (a flanking pair counts once) may wind up or lunge at a time.
function wardTokens() {
  if (encounter.teach || encounter.boss) return 1;
  return (state.difficulty ? 2 : 1) + ((encounter.grudge || 0) >= 2 ? 1 : 0);
}

// A shot still in the air counts as its shooter's attack.
function wardToken(e) {
  if (e.boss) return true;
  if (encounter.lull > 0) return false;
  const busy = new Set();
  for (const o of enemies)
    if (o !== e && o.id !== e.partner && o.hp > 0 && !o.boss && (o.wind > 0 || o.charge > 0))
      busy.add(o.partner && o.partner < o.id ? o.partner : o.id);
  for (const p of projectiles)
    if (!p.friendly && p.life > 0 && p.from && p.from !== e.id && !(wardBoss && p.from === wardBoss.id))
      busy.add(p.from);
  return busy.size < wardTokens();
}

// Nibblers hunt in pairs: one holds the near side, the other circles to Macy's far side, then both lunge.
function wardNibbler(e, dt) {
  const d = dist(player, e),
    sp = wardSpeed(e);
  wardFace(e, player.x - e.x, player.y - e.y);
  if (e.charge > 0) {
    wardLunge(e, dt, (e.angry > 0 ? 470 : 400) * Math.sqrt(cfg().speed), 34);
    return;
  }
  if (e.wind > 0) {
    e.wind -= dt;
    e.vx = e.vy = 0;
    if (e.wind <= 0) wardStartLunge(e, e.angry > 0 ? 0.28 : 0.24, 0.14);
    return;
  }
  if (e.cool > 0) {
    e.cool -= dt;
    if (d < 80) wardMove(e, e.x - player.x, e.y - player.y, sp * 0.5, dt);
    else e.vx = e.vy = 0;
    return;
  }
  const partner = e.partner ? enemies.find(o => o.id === e.partner && o.hp > 0 && !(o.emerge > 0)) : null;
  let tx, ty;
  if (partner && e.role === 'flank') {
    const a = Math.atan2(partner.y - player.y, partner.x - player.x) + Math.PI;
    tx = player.x + Math.cos(a) * 96;
    ty = player.y + Math.sin(a) * 96;
  } else {
    tx = player.x + ((e.x - player.x) / Math.max(1, d)) * 92;
    ty = player.y + ((e.y - player.y) / Math.max(1, d)) * 92;
  }
  tx = clamp(tx, 52, 948);
  ty = clamp(ty, 184, 564);
  wardSeek(e, tx, ty, sp, dt);
  e.huntT = (e.huntT || 0) + dt;
  e.ready = Math.hypot(tx - e.x, ty - e.y) < 36 && d < 150;
  const partnerSet = !partner || partner.ready || partner.wind > 0,
    go = (e.ready && partnerSet) || (e.huntT > (partner ? 3.4 : 2.2) && d < 170);
  if (!go || !wardToken(e)) return;
  wardCrouch(e);
  if (
    partner &&
    !partner.wind &&
    !partner.charge &&
    !(partner.cool > 0) &&
    !(partner.stun > 0) &&
    !(partner.dizzy > 0) &&
    !(partner.hopT > 0) &&
    dist(partner, player) < 200
  )
    wardCrouch(partner);
}

// Spitters strafe at range, back off when Macy closes in, and lead their shots.
function wardSpitter(e, dt) {
  const d = dist(player, e),
    nx = (player.x - e.x) / Math.max(1, d),
    ny = (player.y - e.y) / Math.max(1, d),
    sp = wardSpeed(e);
  wardFace(e, nx, ny);
  if (e.wind > 0) {
    e.wind -= dt;
    e.vx = e.vy = 0;
    if (e.wind <= 0) {
      const wide = encounter.wave >= 3 || (encounter.grudge || 0) >= 2;
      wardSpit(e, wide ? 3 : 1, 0.16, 190 * cfg().speed * wardPace());
      e.cool = 2.6 * wardWindScale();
      wardLull();
      if (e.poisePending) wardHop(e);
    }
    return;
  }
  e.cool -= dt;
  e.strafeT -= dt;
  if (e.strafeT <= 0) {
    e.strafe = -e.strafe || 1;
    e.strafeT = rand(1.3, 2.6);
  }
  let mx = -ny * e.strafe,
    my = nx * e.strafe,
    s = sp * 0.8;
  if (d < 175) {
    mx = -nx + mx * 0.4;
    my = -ny + my * 0.4;
    s = sp * 1.25;
  } else if (d > 320) {
    mx = nx;
    my = ny;
    s = sp;
  }
  if (!wardMove(e, mx, my, s, dt)) e.strafe = -e.strafe;
  if (e.cool <= 0 && d < 470 && d > 80 && wardToken(e)) {
    e.wind = e.windMax = 0.8 * wardWindScale() * (e.angry > 0 ? 0.6 : 1);
    e.act = 'spit';
    wardTeach('spit', 'SWING just as a blob arrives to send it back. Returned blobs hit hard.', 'SWING to deflect!', e);
  }
}

function wardSpit(e, count, fan, speed) {
  const d = dist(player, e),
    aim = wardLead((d / speed) * 0.5),
    base = Math.atan2(aim.y - e.y, aim.x - e.x);
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * fan;
    projectiles.push({
      x: e.x + Math.cos(a) * 14,
      y: e.y - 32 + Math.sin(a) * 14,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      age: 0,
      life: 4,
      friendly: false,
      kind: 'blob',
      from: e.id
    });
  }
  sfx('blob');
}

function wardWindCharge(e, ws) {
  e.wind = e.windMax = (e.boss ? 1 : 0.9) * ws;
  e.act = 'charge';
  e.aimX = player.x;
  e.aimY = player.y;
  if (!e.boss) wardTeach('charge', 'JUMP the charge! Or sidestep and let it eat the furniture.', 'JUMP the charge!', e);
}

// Shared by bruisers and Ralph: a straight run that ends dizzy against anything solid.
function wardCharge(e, dt, speed, reach) {
  const mx = e.chargeX * speed * dt,
    my = e.chargeY * speed * dt,
    ox = e.x,
    oy = e.y;
  moveEntity(e, mx, my);
  e.vx = (e.x - ox) / dt;
  e.vy = (e.y - oy) / dt;
  e.charge -= dt;
  if (!reduced && Math.random() < dt * 18) emit(e.x, e.y, '#d9cdb8', 1, 30);
  if (Math.hypot(e.x - ox, e.y - oy) < Math.hypot(mx, my) * 0.45) {
    wardCrash(e, ox + mx * 4, oy + my * 4);
    return;
  }
  if (!e.bit && dist(player, e) < reach) {
    if (player.z > 22) {
      if (!e.jumped) {
        e.jumped = true;
        floating('OLÉ!', player.x, player.y - 120, '#ffe29b');
      }
    } else {
      const hp = state.hp;
      damage('charge', e);
      if (state.hp < hp) {
        e.bit = true;
        e.charge = 0;
      }
    }
  }
  if (e.charge > 0) return;
  e.charge = 0;
  e.recover = Math.max(e.recover, e.boss ? 0.9 : 0.8);
  e.cool = (e.boss ? 0.6 : 1.8) * wardWindScale();
  e.bit = false;
  e.jumped = false;
  wardLull();
}

function wardCrash(e, wx, wy) {
  const prop = wx > 40 && wx < 960 && wy > 170 && wy < 574,
    size = wardSize(e);
  e.charge = 0;
  e.bit = false;
  e.jumped = false;
  e.recover = 0;
  e.dizzy = e.boss ? (prop ? 2.4 : 1.2) : WARD.dizzy * Math.sqrt(1 / cfg().speed);
  e.cool = Math.max(e.cool, e.boss ? 0.6 : 1.4);
  e.squash = 0.2;
  wardShake(e.boss ? 0.35 : 0.22);
  hitStop = Math.max(hitStop, 0.05);
  wardFx({
    kind: 'ring',
    ground: true,
    x: e.x + e.chargeX * 18,
    y: e.y,
    r0: 10,
    r1: 60 * size,
    life: 0.35,
    col: '#ffe6c4',
    w: 6
  });
  wardFx({ kind: 'puff', x: e.x + e.chargeX * 18, y: e.y, life: 0.5, n: 7, r: 30 * size });
  emit(e.x + e.chargeX * 20, e.y - 20, '#e8dcc4', reduced ? 4 : 12, 140);
  floating(prop ? 'CRUNCH. DIZZY!' : 'DIZZY!', e.x, e.y - 60 * size - 30, '#ffe2a1');
  sfx('wallSplat');
  if (e.boss) wardTaunt(e, RALPH_LINES.dizzy);
  wardTeach('dizzy', 'Dizzy! Free hits from any side until the stars stop.');
}

// Bruisers charge. They turn slowly, so their back is the soft spot.
function wardBruiser(e, dt) {
  const d = dist(player, e),
    sp = wardSpeed(e);
  if (e.charge > 0) {
    wardCharge(e, dt, 380 * cfg().speed * wardPace(), 46);
    return;
  }
  if (e.wind > 0) {
    e.wind -= dt;
    e.vx = e.vy = 0;
    if (e.wind > e.windMax * 0.4) {
      e.aimX = player.x;
      e.aimY = player.y;
      wardFace(e, player.x - e.x, player.y - e.y, dt * 6);
    }
    if (e.wind <= 0) {
      const l = Math.max(1, Math.hypot(e.aimX - e.x, e.aimY - e.y));
      e.chargeX = (e.aimX - e.x) / l;
      e.chargeY = (e.aimY - e.y) / l;
      e.fx = e.chargeX;
      e.fy = e.chargeY;
      e.charge = 1;
      sfx('dash');
    }
    return;
  }
  if (e.recover > 0) {
    e.recover -= dt;
    e.vx = e.vy = 0;
    return;
  }
  e.cool -= dt;
  wardFace(e, player.x - e.x, player.y - e.y, dt * 2.4);
  if (d > 140) wardSeek(e, player.x, player.y, sp, dt, false);
  else e.vx = e.vy = 0;
  if (e.cool <= 0 && d < 380 && wardToken(e)) wardWindCharge(e, wardWindScale() * (e.angry > 0 ? 0.6 : 1));
}

// Split peas: a plain biter until hit; its halves are fast and re-merge if ignored.
function wardPea(e, dt) {
  const d = dist(player, e),
    sp = wardSpeed(e);
  wardFace(e, player.x - e.x, player.y - e.y);
  if (e.merging) {
    const mate = enemies.find(o => o !== e && o.pod === e.pod && o.hp > 0);
    if (mate) {
      wardMove(e, mate.x - e.x, mate.y - e.y, sp * 1.3, dt);
      return;
    }
    e.merging = false;
  }
  if (e.charge > 0) {
    wardLunge(e, dt, 360 * Math.sqrt(cfg().speed), 32);
    return;
  }
  if (e.wind > 0) {
    e.wind -= dt;
    e.vx = e.vy = 0;
    if (e.wind <= 0) wardStartLunge(e, 0.2, 0.1);
    return;
  }
  if (e.cool > 0) {
    e.cool -= dt;
    if (d < 70) wardMove(e, e.x - player.x, e.y - player.y, sp * 0.5, dt);
    else e.vx = e.vy = 0;
    return;
  }
  wardSeek(
    e,
    player.x + ((e.x - player.x) / Math.max(1, d)) * 70,
    player.y + ((e.y - player.y) / Math.max(1, d)) * 70,
    sp,
    dt
  );
  if (d < 105 && wardToken(e)) wardCrouch(e, e.small ? 0.45 : 0.48);
}

// Hurlers lob gunk bricks at where Macy is going; a ring on the floor marks the splash.
function wardHurler(e, dt) {
  const d = dist(player, e),
    nx = (player.x - e.x) / Math.max(1, d),
    ny = (player.y - e.y) / Math.max(1, d),
    sp = wardSpeed(e);
  wardFace(e, nx, ny);
  if (e.wind > 0) {
    e.wind -= dt;
    e.vx = e.vy = 0;
    const t = wardLead(0.55);
    e.aimX = t.x;
    e.aimY = t.y;
    if (e.wind <= 0) {
      wardLob(e);
      if (e.poisePending) wardHop(e);
    }
    return;
  }
  e.cool -= dt;
  e.strafeT -= dt;
  if (e.strafeT <= 0) {
    e.strafe = -e.strafe || 1;
    e.strafeT = rand(1.6, 3);
  }
  let mx = -ny * e.strafe,
    my = nx * e.strafe;
  if (d < 220) {
    mx = -nx;
    my = -ny;
  } else if (d > 380) {
    mx = nx;
    my = ny;
  }
  if (!wardMove(e, mx, my, sp, dt)) e.strafe = -e.strafe;
  if (e.cool <= 0 && d < 540 && d > 110 && wardToken(e)) {
    e.wind = e.windMax = 0.95 * wardWindScale() * (e.angry > 0 ? 0.65 : 1);
    e.act = 'lob';
    const t = wardLead(0.55);
    e.aimX = t.x;
    e.aimY = t.y;
    wardTeach('lob', 'Hurlers lob gunk. Get out of the ring before it lands.', 'MIND THE RING', e);
  }
}

function wardLob(e) {
  let tx = e.aimX,
    ty = e.aimY;
  if (collides(tx, ty)) {
    tx = player.x;
    ty = player.y;
  }
  projectiles.push({
    x: e.x,
    y: e.y - 32,
    z: 0,
    age: 0,
    vx: (tx - e.x) / 0.85,
    vy: (ty - e.y) / 0.85,
    life: 0.85,
    kind: 'brick',
    friendly: false,
    gunk: true,
    from: e.id,
    tx,
    ty
  });
  wardFx({ kind: 'target', ground: true, x: tx, y: ty, r: WARD.gunkRadius, life: 0.85, col: '#f08a7a' });
  e.cool = 3.4 * wardWindScale();
  wardLull();
  sfx('throw');
}

// ---- Ralph ----
function startRalph() {
  const r = makeEnemy(5, 160, 296);
  r.maxHp = r.hp = r.trail = Math.round(breeds[5].hp * [0.8, 1, 1.25][state.difficulty]);
  r.boss = true;
  r.phase = 1;
  r.spot = wardSpawns[0][0];
  r.emerge = r.emergeMax = 2.4;
  r.minionT = 6;
  r.cool = 1.2;
  r.plan = 0;
  r.bumpCool = 2;
  enemies.push(r);
  wardBoss = r;
  encounter = {
    room: 0,
    wave: 1,
    rest: 2.4,
    complete: false,
    calm: false,
    grudge: 0,
    pace: 1,
    boss: true
  };
  wardSetBanner('RALPH', 'has entered the chat', 3);
  wardTaunt(r, RALPH_LINES.intro);
  r.taunt.t = 4.4;
  wardBossMusic = true;
  wardMusic('boss');
  sfx('boss');
}

function wardRalph(e, dt) {
  const d = dist(player, e),
    ws = wardWindScale() * (e.phase === 3 ? 0.75 : 1),
    sp = wardSpeed(e);
  if (e.retreating) {
    wardSeek(e, 160, 300, sp, dt);
    return;
  }
  if (e.invuln > 0) {
    e.invuln -= dt;
    e.vx = e.vy = 0;
    return;
  }
  e.bumpCool = Math.max(0, (e.bumpCool || 0) - dt);
  if (e.phase >= 2) {
    e.minionT -= dt;
    if (e.minionT <= 0) {
      if (enemies.filter(m => m.minion && m.hp > 0).length < 2) wardSummon(2);
      e.minionT = e.phase === 2 ? 9 : 13;
    }
  }
  if (e.slam) {
    wardSlamStep(e, dt);
    return;
  }
  if (e.charge > 0) {
    wardCharge(e, dt, 430 * cfg().speed * (e.phase === 3 ? 1.15 : 1), 66);
    return;
  }
  if (e.recover > 0) {
    e.recover -= dt;
    e.vx = e.vy = 0;
    return;
  }
  if (e.volleys > 0) {
    e.volleyT -= dt;
    e.vx = e.vy = 0;
    if (e.volleyT <= 0) {
      wardSpit(e, 3, 0.22, 200 * cfg().speed);
      e.volleys--;
      e.volleyT = 0.34;
      if (!e.volleys) e.cool = 2.2 * ws;
    }
    return;
  }
  if (e.wind > 0) {
    e.wind -= dt;
    e.vx = e.vy = 0;
    wardFace(e, player.x - e.x, player.y - e.y);
    if (e.act === 'charge' && e.wind > e.windMax * 0.4) {
      e.aimX = player.x;
      e.aimY = player.y;
    }
    if (e.act === 'slam') {
      const t = wardLead(0.3);
      e.aimX = t.x;
      e.aimY = t.y;
    }
    if (e.wind <= 0) wardRalphRelease(e, ws);
    return;
  }
  if (d < 150 && e.bumpCool <= 0) {
    e.act = 'bump';
    e.wind = e.windMax = 0.5 * ws;
    return;
  }
  e.cool -= dt;
  wardFace(e, player.x - e.x, player.y - e.y);
  const want = e.phase === 1 ? 290 : e.phase === 2 ? 210 : 170,
    l = Math.max(1, d);
  wardSeek(
    e,
    clamp(player.x + ((e.x - player.x) / l) * want, 90, 910),
    clamp(player.y + ((e.y - player.y) / l) * want, 200, 540),
    sp * 0.7,
    dt
  );
  if (e.cool > 0) return;
  const plan = [['barrage'], ['charge', 'spit'], ['slam', 'slam', 'spit5', 'charge']][e.phase - 1];
  e.act = plan[(e.plan || 0) % plan.length];
  e.plan = (e.plan || 0) + 1;
  e.wind = e.windMax = { barrage: 0.9, charge: 1, spit: 0.6, spit5: 0.7, slam: 0.55 }[e.act] * ws;
  e.aimX = player.x;
  e.aimY = player.y;
  if (e.act === 'barrage') wardTeach('ralphSpit', 'SWING as his blobs arrive. Returned blobs hurt him.', 'DEFLECT!');
  if (e.act === 'charge') wardTeach('ralphCharge', 'Stand by the bed or the cabinet and make him eat it.');
  if (e.act === 'slam') wardTeach('ralphSlam', 'JUMP as he lands. The goo he leaves is sticky.', 'JUMP the slam!');
}

function wardRalphRelease(e, ws) {
  const act = e.act;
  e.act = null;
  if (act === 'barrage') {
    e.volleys = 3;
    e.volleyT = 0;
  } else if (act === 'spit') {
    wardSpit(e, 3, 0.22, 200 * cfg().speed);
    e.cool = 1.1 * ws;
  } else if (act === 'spit5') {
    wardSpit(e, 5, 0.2, 215 * cfg().speed);
    e.cool = 1.1 * ws;
  } else if (act === 'charge') {
    const l = Math.max(1, Math.hypot(e.aimX - e.x, e.aimY - e.y));
    e.chargeX = (e.aimX - e.x) / l;
    e.chargeY = (e.aimY - e.y) / l;
    e.charge = 1.25;
    e.bit = false;
    sfx('dash');
  } else if (act === 'slam') {
    let tx = e.aimX,
      ty = e.aimY;
    if (collides(tx, ty)) {
      tx = player.x;
      ty = player.y;
    }
    e.slam = { t: 0, dur: 0.8, sx: e.x, sy: e.y, tx, ty };
    wardFx({ kind: 'target', ground: true, x: tx, y: ty, r: 125, life: 0.8, col: '#d58ef0' });
    sfx('leap');
  } else if (act === 'bump') wardBump(e);
}

function wardBump(e) {
  const r = 135;
  wardFx({ kind: 'ring', ground: true, x: e.x, y: e.y, r0: 30, r1: r, life: 0.4, col: '#eadcff', w: 9 });
  wardShake(0.2);
  sfx('explode');
  e.bumpCool = 2.4;
  e.cool = Math.max(e.cool, 0.6);
  if (dist(player, e) >= r || player.z > 22) return;
  damage('bump', e);
  const l = Math.max(1, dist(player, e));
  for (let i = 0; i < 6; i++) moveEntity(player, ((player.x - e.x) / l) * 15, ((player.y - e.y) / l) * 15);
}

function wardSlamStep(e, dt) {
  const s = e.slam;
  s.t += dt;
  const k = Math.min(1, s.t / s.dur);
  e.x = s.sx + (s.tx - s.sx) * k;
  e.y = s.sy + (s.ty - s.sy) * k;
  e.z = Math.sin(k * Math.PI) * 130;
  if (k < 1) return;
  e.z = 0;
  e.slam = null;
  const r = 125;
  wardFx({ kind: 'ring', ground: true, x: e.x, y: e.y, r0: 30, r1: r + 20, life: 0.5, col: '#f3d9ff', w: 10 });
  wardFx({ kind: 'crack', ground: true, x: e.x, y: e.y, life: 1.4, r, seed: rand(0, 6) });
  wardFx({ kind: 'puff', x: e.x, y: e.y, life: 0.6, n: 12, r: r * 0.8 });
  wardShake(0.4);
  hitStop = Math.max(hitStop, 0.08);
  sfx('explode');
  for (let i = 0; i < 3; i++) {
    const a = rand(0, Math.PI * 2),
      rr = rand(50, 95);
    puddles.push({
      x: clamp(e.x + Math.cos(a) * rr, 60, 940),
      y: clamp(e.y + Math.sin(a) * rr * 0.6, 190, 560),
      life: 7,
      gunk: true,
      r: 36
    });
  }
  if (dist(player, e) < r && player.z <= 22) damage('slam', e);
  e.recover = 1.1 * wardWindScale();
  e.cool = 0.5;
}

function wardSummon(n) {
  const used = [];
  let first = null;
  for (let i = 0; i < n; i++) {
    const m = makeEnemy(0, 0, 0);
    m.minion = true;
    wardLurk(m, 1.2 + i * 0.2, used);
    if (first) {
      first.partner = m.id;
      m.partner = first.id;
      first.role = 'front';
      m.role = 'flank';
    } else first = m;
    enemies.push(m);
  }
  if (wardBoss) floating('MINIONS!', wardBoss.x, wardBoss.y - 190, '#eadcff');
}

function wardRalphPhase(e) {
  if (!e.saidLow && e.hp > 0 && e.hp < e.maxHp * 0.18) {
    e.saidLow = true;
    wardTaunt(e, RALPH_LINES.low);
  }
  const next = e.hp <= e.maxHp / 3 ? 3 : e.hp <= (e.maxHp * 2) / 3 ? 2 : 1;
  if (next <= e.phase) return;
  e.phase = next;
  e.invuln = 1.6;
  e.wind = 0;
  e.charge = 0;
  e.volleys = 0;
  e.stun = 0;
  e.stagger = 0;
  e.dizzy = 0;
  e.recover = 0;
  e.plan = 0;
  e.cool = 0.4;
  e.act = null;
  e.minionT = next === 2 ? 0.2 : 8;
  wardSetBanner('PHASE ' + next, next === 2 ? 'Ralph discovers cardio' : 'Ralph is not okay', 2.6);
  wardTaunt(e, next === 2 ? RALPH_LINES.phase2 : RALPH_LINES.phase3);
  wardShake(0.5);
  hitStop = Math.max(hitStop, 0.12);
  emit(e.x, e.y - 80, next === 3 ? '#ff9ab0' : '#eadcff', reduced ? 8 : 30, 220);
  wardFx({ kind: 'ring', ground: true, x: e.x, y: e.y, r0: 40, r1: 190, life: 0.6, col: '#eadcff', w: 10 });
  sfx('boss');
  updateWardHUD();
}

function wardRalphDefeat(e) {
  encounter.complete = true;
  state.ralph = true;
  save();
  for (const m of enemies)
    if (m.minion && m.hp > 0) {
      m.silent = true;
      if (m.emerge > 0) {
        m.hp = 0;
        m.gone = true;
      } else wardKill(m);
    }
  wardTaunt(e, RALPH_LINES.defeat);
  wardSetBanner('RALPH EVICTED', 'your gut is under new management', 4);
  for (let i = 0; i < (reduced ? 2 : 5); i++)
    wardFx({
      kind: 'impact',
      x: e.x + rand(-60, 60),
      y: e.y - rand(30, 120),
      life: 0.3 + i * 0.08,
      r: 50,
      col: '#eadcff'
    });
  wardFx({ kind: 'ring', ground: true, x: e.x, y: e.y, r0: 40, r1: 260, life: 0.8, col: '#fff3d6', w: 12 });
  if (wardBossMusic) {
    wardBossMusic = false;
    wardMusic('room:0');
  }
  if (typeof checkDischarge === 'function') checkDischarge();
}

// Macy lost: Ralph gloats and leaves until her next visit to home base.
function wardRalphRetreat() {
  if (!wardBoss) return;
  ralphRetreated = true;
  wardBoss.retreating = true;
  wardBoss.wind = 0;
  wardBoss.charge = 0;
  wardBoss.volleys = 0;
  wardBoss.slam = null;
  wardBoss.z = 0;
  wardTaunt(wardBoss, RALPH_LINES.retreat);
  encounter.complete = true;
  if (wardBossMusic) {
    wardBossMusic = false;
    wardMusic('room:0');
  }
  updateWardHUD();
}

// ---- Projectiles and effects ----
function wardProjectiles(dt) {
  for (const p of projectiles) {
    if (p.life <= 0) continue;
    p.age = (p.age || 0) + dt;
    p.life -= dt;
    if (p.kind === 'brick') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        if (p.friendly) brickBurst(p);
        else gunkSplash(p);
      }
      continue;
    }
    if (p.kind === 'returned' && p.homing) {
      const t = enemies.find(e => e.id === p.homing && e.hp > 0 && !(e.emerge > 0));
      if (t) {
        const tx = t.x - p.x,
          ty = t.y - 30 * wardSize(t) - p.y,
          l = Math.max(1, Math.hypot(tx, ty)),
          sp = Math.max(380, Math.hypot(p.vx, p.vy)),
          k = Math.min(1, dt * 8);
        p.vx += ((tx / l) * sp - p.vx) * k;
        p.vy += ((ty / l) * sp - p.vy) * k;
      }
    }
    const nx = p.x + p.vx * dt,
      ny = p.y + p.vy * dt;
    if (collides(nx, ny + 32)) {
      if (p.kind === 'bag' && !p.bounces) {
        if (collides(nx, p.y + 32)) p.vx *= -1;
        if (collides(p.x, ny + 32)) p.vy *= -1;
        p.bounces = 1;
        wardFx({ kind: 'spark', x: p.x, y: p.y, life: 0.35, col: '#fff2a8', n: 7 });
        sfx('bounce');
      } else {
        p.life = 0;
        emit(p.x, p.y, p.kind === 'bag' ? '#f8d9a1' : '#b9d56b', reduced ? 2 : 6, 70);
        continue;
      }
    } else {
      p.x = nx;
      p.y = ny;
    }
    if (p.friendly) {
      const e = wardFighters().find(
        e => e.z <= 16 && Math.hypot(e.x - p.x, e.y - 30 * wardSize(e) - p.y) < (e.boss ? 58 : 22 + 6 * wardSize(e))
      );
      if (e) {
        const from = { x: e.x - p.vx, y: e.y - p.vy };
        if (p.kind === 'bag') hitEnemy(e, 1, 26, { kind: 'bag', from });
        else hitEnemy(e, 3, 40, { kind: 'returned', from });
        p.life = 0;
      }
    } else if (Math.hypot(player.x - p.x, player.y - 32 - p.y) < 25 && player.z < 25) {
      if (player.shield > 0) {
        emit(p.x, p.y, '#bce8c7', reduced ? 3 : 10);
        wardFx({ kind: 'spark', x: p.x, y: p.y, life: 0.3, col: '#c1f2cc', n: 6 });
        sfx('shield');
      } else damage('blob', p);
      p.life = 0;
    }
  }
}

function wardFxUpdate(dt) {
  for (const f of combatFx) {
    f.t += dt;
    if (f.kind !== 'feather') continue;
    f.vz = Math.max(-40, f.vz - 160 * dt);
    f.z = Math.max(0, f.z + f.vz * dt);
    f.x += (f.vx + Math.sin(f.t * 7 + f.rot) * 30) * dt;
    f.y += f.vy * dt;
    f.vx *= Math.exp(-dt * 2);
    f.rot += dt * 3;
  }
  combatFx = combatFx.filter(f => f.t < f.life);
  if (wardBanner) {
    wardBanner.t += dt;
    if (wardBanner.t >= wardBanner.life) wardBanner = null;
  }
  if (wardHint) {
    wardHint.t += dt;
    if (wardHint.t >= wardHint.life) wardHint = null;
  }
  wardChainPop = Math.max(0, wardChainPop - dt);
}

// ---- Drawing: Macy's pillow ----
function drawPillowSwing(g, p) {
  if (p.attackKind !== 0) return;
  if (p.spike) {
    wardDrawSpike(g, p);
    return;
  }
  if (p.stompT > 0) {
    wardDrawStompPose(g, p);
    return;
  }
  const spin = p.spinT > 0,
    finisher = p.combo === 2 && !spin,
    t = clamp(1 - p.attack / Math.max(0.01, p.attackDuration), 0, 1),
    angle = Math.atan2(p.aimY || 0, p.aimX || p.dir),
    windUp = 0.14,
    strike = clamp((t - windUp) / 0.36, 0, 1),
    ease = 1 - Math.pow(1 - strike, 3),
    span = spin ? Math.PI * 2.3 : finisher ? 3.5 : 2.9,
    start = spin ? -0.4 : -span / 2 - 0.3 * Math.min(1, t / windUp),
    sweep = start + span * ease,
    fade = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45),
    R = (finisher ? 100 : 88) + (spin ? 14 : 0) + (wardHas('pillow') ? 12 : 0);
  g.save();
  g.translate(p.x, p.y - 35 - p.z);
  g.rotate(angle);
  g.scale(1, 0.78);
  if (strike > 0 && fade > 0) {
    // The smear: stacked crescents trailing the pillow, brightest at the leading edge.
    const tail = Math.min(sweep - start, spin ? 6 : finisher ? 2.3 : 1.8),
      col = finisher ? '#ffe7a3' : '#fff7e2';
    for (let i = 0; i < 4; i++) {
      const a0 = sweep - tail * (1 - i * 0.2);
      g.globalAlpha = fade * (0.1 + i * 0.13);
      g.fillStyle = col;
      g.beginPath();
      g.arc(0, 0, R + 8 - i * 2, a0, sweep);
      g.arc(0, 0, R - 40 + i * 7, sweep, a0, true);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = fade;
    g.strokeStyle = finisher ? '#fff0b0' : '#ffffff';
    g.lineWidth = finisher ? 5 : 3;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 0, R + 4, Math.max(start, sweep - 0.6), sweep);
    g.stroke();
    if (!reduced && strike < 1)
      for (let i = 0; i < 3; i++) {
        const a = sweep - 0.15 - i * 0.22,
          r0 = R + 16,
          r1 = R + 30 + i * 6;
        line(g, [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], '#ffffffaa', 2);
      }
    g.globalAlpha = 1;
  }
  g.rotate(sweep);
  line(g, [[0, 0], [R - 30, 0]], '#d9a989', 9);
  g.translate(R - 8, 0);
  const squish = Math.sin(clamp(strike * 1.4, 0, 1) * Math.PI);
  g.rotate(0.3 + squish * 0.35);
  g.scale(1 + squish * 0.24, 1 - squish * 0.18);
  wardPillow(g, finisher);
  g.restore();
}

function wardPillow(g, gold) {
  rr(
    g,
    -31,
    -25,
    62,
    50,
    15,
    gradient(g, 0, -25, 0, 50, gold ? '#fff8dc' : '#fffdf1', gold ? '#f2d79a' : '#d3e4d4'),
    gold ? '#d9b46a' : '#a8c7ba',
    2
  );
  path(
    g,
    q => {
      q.moveTo(-23, -15);
      q.quadraticCurveTo(0, -8, 22, -15);
      q.moveTo(-23, 15);
      q.quadraticCurveTo(0, 8, 22, 15);
    },
    null,
    gold ? '#e2c27f' : '#b4cdbf',
    1.5
  );
}

// Airborne with the pillow up: the dashed ring on the floor is where the stomp will land.
function wardDrawSpike(g, p) {
  const r = WARD.stompRadius + (wardHas('pillow') ? 15 : 0),
    pulse = 0.5 + 0.5 * Math.sin(time * 18);
  g.save();
  g.globalAlpha = 0.35 + 0.3 * pulse;
  g.strokeStyle = '#fff3cf';
  g.lineWidth = 3;
  g.setLineDash([8, 7]);
  g.beginPath();
  g.ellipse(p.x, p.y, r, r * 0.36, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
  line(g, [[p.x + p.dir * 4, p.y - p.z - 58], [p.x + p.dir * 7, p.y - p.z - 92]], '#d9a989', 8);
  g.translate(p.x + p.dir * 8, p.y - p.z - 112);
  g.rotate(p.dir * -0.25 + (reduced ? 0 : Math.sin(time * 30) * 0.05));
  wardPillow(g, true);
  g.restore();
}

function wardDrawStompPose(g, p) {
  const k = p.stompT / 0.3;
  g.save();
  line(g, [[p.x + p.dir * 6, p.y - p.z - 50], [p.x + p.dir * 40, p.y - 16]], '#d9a989', 8);
  g.translate(p.x + p.dir * 52, p.y - 10);
  g.scale(1.25 + 0.2 * k, 0.55 - 0.15 * k);
  wardPillow(g, true);
  g.restore();
}

// ---- Drawing: gremlin art ----
// One posable gremlin at the origin, feet at y = 0, facing +x. pal is [body, shade, highlight].
// Pose o: eyes open|squint|wide|shut|spiral|x, mouth grin|open|puff|teeth|wobble, brow -1..1, arms
// down|up|reach|wide, lookX/lookY -1..1, cheek 0..1, hold (gunk brick overhead), crown, crownTilt, redEyes.
function wardGremlinArt(g, type, pal, t, o = {}) {
  const [main, dark, light] = pal,
    eyes = o.eyes || 'open',
    mouth = o.mouth || (type === 1 ? 'snout' : 'grin'),
    brow = o.brow || 0,
    lx = clamp(o.lookX ?? 1, -1, 1) * 1.8,
    ly = clamp(o.lookY || 0, -1, 1) * 1.4,
    flap = reduced ? 0 : Math.sin(t * 5) * 2,
    arms = o.arms || 'down',
    heavy = type === 2 || type === 5,
    reach = type === 4 ? 1.3 : 1;
  for (const side of [-1, 1]) {
    const f = flap * (side > 0 ? 1 : 0.7);
    path(
      g,
      p => {
        p.moveTo(side * 13, -29);
        p.quadraticCurveTo(side * 24, -45 + f, side * 31, -37 + f);
        p.quadraticCurveTo(side * 28, -19, side * 13, -16);
      },
      main,
      dark,
      1.3
    );
    path(
      g,
      p => {
        p.moveTo(side * 18, -28);
        p.lineTo(side * 26, -35 + f * 0.6);
        p.quadraticCurveTo(side * 25, -24, side * 18, -23);
      },
      '#eeb5b188'
    );
  }
  for (const side of [-1, 1]) {
    let hx = side * 24,
      hy = -9 + Math.sin(t * 4 + side) * 2;
    if (arms === 'up') {
      hx = side * 10;
      hy = -52;
    } else if (arms === 'reach') {
      hx = 24 + side * 2;
      hy = -22 + side * 4;
    } else if (arms === 'wide') {
      hx = side * 31;
      hy = -30 + Math.sin(t * 9 + side) * 3;
    }
    hx = side * 15 + (hx - side * 15) * reach;
    hy = -17 + (hy + 17) * reach;
    line(g, [[side * 15, -17], [hx, hy]], dark, heavy ? 6.5 : 5);
    ellipse(g, hx, hy, heavy ? 4.2 : 3.4, heavy ? 4.2 : 3.4, dark);
  }
  if (o.hold) {
    brick(g, -11, -53 * reach + 4, '#ed9d87', 1.05);
    ellipse(g, -3, -46 * reach + 6, 2, 3, '#a9c95b');
  }
  for (const side of [-1, 1]) ellipse(g, side * 10, -1, heavy ? 8.5 : 7, 4.5, dark);
  path(
    g,
    p => {
      p.moveTo(-18, -9);
      p.bezierCurveTo(-23, -38, -10, -43, 0, -39);
      p.bezierCurveTo(17, -45, 25, -22, 18, -6);
      p.quadraticCurveTo(0, 2, -18, -9);
    },
    gradient(g, -13, -40, 30, 37, main, dark),
    '#355a6022',
    1.5
  );
  ellipse(g, 2, -10, type === 5 ? 12 : 9, 5, light + '55');
  if (type === 3)
    path(
      g,
      p => {
        p.moveTo(-14, -31);
        p.quadraticCurveTo(-19, -19, -12, -8);
        p.moveTo(15, -32);
        p.quadraticCurveTo(20, -20, 13, -8);
      },
      null,
      light + 'aa',
      1.6
    );
  if (type === 5) path(g, p => p.arc(2, -8, 2.2, 0.2, Math.PI - 0.2), null, dark, 1.2);
  // Eyes
  if (eyes === 'spiral') {
    for (const ex of [-7, 8]) {
      ellipse(g, ex, -27, 8, 9, '#fff9e8');
      path(
        g,
        p => {
          p.moveTo(ex, -27);
          for (let i = 1; i <= 14; i++) {
            const a = i * 0.7 + t * 6,
              r = i * 0.45;
            p.lineTo(ex + Math.cos(a) * r, -27 + Math.sin(a) * r);
          }
        },
        null,
        '#324452',
        1.3
      );
    }
  } else if (eyes === 'shut') {
    line(g, [[-12, -31], [-5, -27], [-12, -23]], '#324452', 2.2);
    line(g, [[13, -31], [6, -27], [13, -23]], '#324452', 2.2);
  } else if (eyes === 'x') {
    for (const ex of [-7, 8]) {
      line(g, [[ex - 4, -31], [ex + 4, -23]], '#324452', 2.2);
      line(g, [[ex + 4, -31], [ex - 4, -23]], '#324452', 2.2);
    }
  } else {
    const h = eyes === 'squint' ? 5.5 : eyes === 'wide' ? 10 : 9,
      w = eyes === 'wide' ? 9 : 8,
      ey = eyes === 'squint' ? -26 : -27,
      pw = eyes === 'wide' ? 2.3 : 3.4,
      ph = eyes === 'wide' ? 2.8 : eyes === 'squint' ? 3.4 : 5,
      pc = o.redEyes ? '#c2273f' : '#324452';
    ellipse(g, -7, ey, w, h, '#fff9e8');
    ellipse(g, 8, ey, w, h, '#fff9e8');
    ellipse(g, -5.5 + lx, ey + 2 + ly, pw, ph, pc);
    ellipse(g, 6 + lx, ey + 2 + ly, pw, ph, pc);
    ellipse(g, -6.5 + lx, ey + ly, 1.1, 1.5, '#fff');
    ellipse(g, 5 + lx, ey + ly, 1.1, 1.5, '#fff');
  }
  const bw = heavy ? 3.8 : 3;
  line(g, [[-15, -34 - brow * 1.6], [-2, -31 + brow * 2.6]], dark, bw);
  line(g, [[2, -31 + brow * 2.6], [16, -35 - brow * 1.6]], dark, bw);
  // Mouth
  if (mouth === 'open') {
    ellipse(g, 2, -11, 7.5, 6, '#65394e');
    rr(g, -1, -9, 7, 3.5, 1.7, '#ef929d');
    poly(g, [[-3, -15.5], [0, -15.5], [-1.5, -12]], '#fff3cd');
    poly(g, [[5, -15.5], [8, -15.5], [6.5, -12]], '#fff3cd');
  } else if (mouth === 'puff') {
    const c = o.cheek || 0;
    ellipse(g, -11, -16, 5 + 4 * c, 4 + 3 * c, light);
    ellipse(g, 15, -16, 5 + 4 * c, 4 + 3 * c, light);
    ellipse(g, 3, -13, 2.6 + c * 1.5, 2.6 + c * 1.5, '#65394e');
  } else if (mouth === 'snout') {
    ellipse(g, 6, -13, 7, 4.6, main);
    path(g, p => p.ellipse(6, -13, 7, 4.6, 0, 0, Math.PI * 2), null, dark, 1.2);
    ellipse(g, 11, -13, 2.4, 2.4, '#65394e');
    ellipse(g, 12, -9 + ((t * 0.8) % 1) * 4, 1.4, 2, '#c7e07a');
  } else if (mouth === 'teeth') {
    rr(g, -7, -17, 18, 8, 3, '#fff3cd', '#65394e', 1.4);
    for (const x of [-2, 3, 8]) line(g, [[x, -16.5], [x, -9.5]], '#65394e', 1);
    line(g, [[-6, -13], [10, -13]], '#65394e', 1);
  } else if (mouth === 'wobble') {
    path(
      g,
      p => {
        p.moveTo(-6, -12);
        for (let i = 1; i <= 6; i++) p.lineTo(-6 + i * 2.8, -12 + (i % 2 ? -2 : 2));
      },
      null,
      '#65394e',
      1.8
    );
  } else {
    path(
      g,
      p => {
        p.moveTo(-8, -14);
        p.quadraticCurveTo(2, -6, 12, -16);
        p.quadraticCurveTo(4, -2, -8, -14);
      },
      '#65394e'
    );
    rr(g, 3, -11, 9, 5, 2, '#ef929d');
    if (type === 0) {
      rr(g, -3, -14.5, 3.6, 5, 1.2, '#fffbe8');
      rr(g, 1.2, -15, 3.6, 5.5, 1.2, '#fffbe8');
    } else poly(g, [[-5, -14], [-1, -13], [-2, -9]], '#fff3cd');
  }
  if (mouth !== 'puff') {
    ellipse(g, -9, -18, 3.8, 1.5, '#e6ac8e55');
    ellipse(g, 9, -18, 3.8, 1.5, '#e6ac8e55');
  }
  // Breed details
  if (type === 2) {
    // The bedpan helmet: armored front, handle at the back.
    path(
      g,
      p => {
        p.moveTo(-20, -33);
        p.quadraticCurveTo(-18, -52, 1, -52);
        p.quadraticCurveTo(20, -52, 21, -35);
        p.closePath();
      },
      gradient(g, -20, -52, 30, 20, '#e6eef0', '#9fb1b9'),
      '#6d828c',
      1.4
    );
    rr(g, -34, -45, 16, 5, 2.5, '#9fb1b9', '#6d828c', 1);
    line(g, [[-12, -48], [12, -49]], '#ffffff88', 1.5);
  } else if (type === 3) {
    line(g, [[0, -40], [2, -49]], '#4e9d82', 2);
    path(
      g,
      p => {
        p.moveTo(2, -48);
        p.quadraticCurveTo(10, -54, 13, -47);
        p.quadraticCurveTo(7, -44, 2, -48);
      },
      '#82be91'
    );
  } else if (type === 5) {
    if (o.crown !== false) wardCrown(g, 1, -38, 1, o.crownTilt || 0);
    path(
      g,
      p => {
        p.moveTo(-5, -9);
        p.quadraticCurveTo(-6, -3, -4, -1);
      },
      null,
      '#c7e07acc',
      1.6
    );
  } else {
    path(
      g,
      p => {
        p.moveTo(-5, -38);
        p.quadraticCurveTo(1, -50, 5, -38);
      },
      main,
      dark,
      1
    );
    if (type === 4) {
      rr(g, -17, -38, 35, 5, 2, '#ffd26e');
      line(g, [[-17, -36], [-25, -30]], '#ffd26e', 2);
      line(g, [[-17, -35], [-23, -27]], '#ffd26e', 2);
    }
  }
}

function wardCrown(g, x, y, s = 1, tilt = 0) {
  const pts = [[-15, 2], [-16, -11], [-9, -5], [-3, -14], [3, -5], [9, -13], [16, -4], [15, 2]];
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.scale(s, s);
  poly(g, pts, '#f7dc6f');
  path(
    g,
    p => {
      pts.forEach((q, i) => (i ? p.lineTo(...q) : p.moveTo(...q)));
      p.closePath();
    },
    null,
    '#c79a2e',
    1.2
  );
  rr(g, -15, -1, 30, 4, 1.5, '#f0c94d');
  ellipse(g, 0, -4, 2.2, 2.2, '#e46a7a');
  ellipse(g, -9, -1, 1.4, 1.4, '#7cc4d8');
  ellipse(g, 9, -1, 1.4, 1.4, '#7cc4d8');
  g.restore();
}

function wardDrawPart(g, kind, pal) {
  if (kind === 'ear')
    path(
      g,
      p => {
        p.moveTo(-6, 4);
        p.quadraticCurveTo(-2, -8, 7, -6);
        p.quadraticCurveTo(5, 3, -6, 4);
      },
      pal[0],
      pal[1],
      1.2
    );
  else if (kind === 'eye') {
    ellipse(g, 0, 0, 5, 5.5, '#fff9e8');
    ellipse(g, 1, 1, 2.2, 3, '#324452');
  } else if (kind === 'tooth') rr(g, -2.5, -3.5, 5, 7, 1.5, '#fffbe8', '#c9bfa2', 0.8);
  else if (kind === 'foot') ellipse(g, 0, 0, 6, 4, pal[1]);
  else if (kind === 'tuft')
    path(
      g,
      p => {
        p.moveTo(-4, 3);
        p.quadraticCurveTo(0, -9, 4, 3);
      },
      pal[0],
      pal[1],
      1
    );
  else if (kind === 'helmet')
    path(
      g,
      p => {
        p.moveTo(-14, 4);
        p.quadraticCurveTo(0, -16, 14, 4);
        p.closePath();
      },
      '#c9d6dc',
      '#7d9099',
      1.5
    );
  else if (kind === 'brick') brick(g, -10, 4, '#ed9d87');
  else if (kind === 'crown') wardCrown(g, 0, 0, 1.1);
}

function wardPose(e) {
  const o = { lookX: 1, lookY: clamp((player.y - e.y) / 200, -1, 1), arms: 'down' },
    k = e.wind > 0 ? clamp(1 - e.wind / e.windMax, 0, 1) : 0;
  if (e.hit > 0) return Object.assign(o, { eyes: 'shut', mouth: 'open', arms: 'wide' });
  if (e.stun > 0 || e.dizzy > 0) return Object.assign(o, { eyes: 'spiral', mouth: 'wobble', arms: 'wide' });
  if (e.charge > 0 || e.slam) return Object.assign(o, { eyes: 'wide', mouth: 'open', arms: 'reach', brow: 1 });
  if (e.hopT > 0) return Object.assign(o, { eyes: 'squint', mouth: 'teeth', arms: 'up', brow: 1 });
  if (e.volleys > 0) return Object.assign(o, { eyes: 'squint', mouth: 'open', brow: 1 });
  if (e.wind > 0) {
    o.brow = 1;
    if (e.act === 'spit' || e.act === 'barrage' || e.act === 'spit5' || e.act === 'bump')
      return Object.assign(o, { mouth: 'puff', cheek: k, eyes: 'squint', arms: e.act === 'bump' ? 'wide' : 'down' });
    if (e.act === 'lob') return Object.assign(o, { arms: 'up', hold: true, mouth: 'teeth', eyes: 'squint' });
    if (e.act === 'slam') return Object.assign(o, { arms: 'up', mouth: 'teeth', eyes: 'squint' });
    return Object.assign(o, { mouth: 'teeth', eyes: 'squint' });
  }
  if (e.merging) return Object.assign(o, { eyes: 'wide', mouth: 'open', arms: 'reach' });
  if (e.recover > 0) return Object.assign(o, { brow: -1, mouth: 'wobble', lookX: -1 });
  if (e.angry > 0) Object.assign(o, { brow: 1, eyes: 'squint', mouth: 'teeth' });
  return o;
}

// Squash, stretch and lean for every state. Returns the body transform around the feet.
function wardBodyTransform(e) {
  const t = time + e.anim,
    face = e.fx >= 0 ? 1 : -1,
    breathe = Math.sin(t * (e.boss ? 2.2 : 3.1)) * (e.boss ? 0.03 : 0.04);
  let sx = 1 - breathe * 0.7,
    sy = 1 + breathe,
    lean = 0,
    jx = 0,
    oy = 0;
  if (Math.hypot(e.vx || 0, e.vy || 0) > 8 && !(e.charge > 0)) {
    oy -= Math.abs(Math.sin((e.walk || 0) * 0.9)) * 3.5;
    lean -= clamp((e.vx || 0) / 300, -0.22, 0.22);
  }
  if (e.wind > 0) {
    const k = clamp(1 - e.wind / e.windMax, 0, 1);
    if (e.act === 'bite') {
      sy *= 1 - 0.24 * k;
      sx *= 1 + 0.18 * k;
      lean += face * 0.18 * k;
    } else if (e.act === 'charge') {
      sy *= 1 - 0.2 * k;
      sx *= 1 + 0.16 * k;
      lean -= face * 0.32 * k;
    } else if (e.act === 'slam') {
      sy *= 1 - 0.25 * k;
      sx *= 1 + 0.15 * k;
    } else if (e.act === 'lob') {
      sy *= 1 + 0.1 * k;
      lean += face * 0.2 * k;
    } else {
      sx *= 1 + 0.1 * k;
      sy *= 1 + 0.06 * k;
      lean += face * 0.1 * k;
    }
    if (!reduced) jx = Math.sin(time * 60) * 1.6 * k;
  }
  if (e.charge > 0) {
    sx *= 1.18;
    sy *= 0.88;
    lean -= e.chargeX * 0.32;
  }
  if (e.squash > 0) {
    const k = e.squash / 0.2;
    sx *= 1 + 0.3 * k;
    sy *= 1 - 0.26 * k;
  }
  if (e.popT > 0) {
    const k = e.popT / 0.35;
    sy *= 1 + 0.28 * k;
    sx *= 1 - 0.14 * k;
  }
  if (e.hopT > 0) {
    const k = 1 - e.hopT / WARD.hopTime;
    sy *= k < 0.5 ? 1.16 : 0.96;
    sx *= k < 0.5 ? 0.9 : 1.04;
  }
  if (e.stun > 0 || e.dizzy > 0) lean += Math.sin(time * 8 + e.anim) * 0.14;
  if (Math.hypot(e.kx || 0, e.ky || 0) > 40) lean += clamp((e.kx || 0) / 1000, -0.3, 0.3);
  return { sx, sy, lean, jx, oy };
}

// ---- Drawing: enemies ----
// world.js calls this once per entry of `enemies`, depth-sorted. Until world.js calls the combat draw
// hooks itself, the first gremlin drawn brings the floor effects and the last brings effects and overlay.
function drawEnemy(g, e) {
  let first = null,
    last = null;
  for (const o of enemies) {
    if (!first || o.y < first.y) first = o;
    if (!last || o.y >= last.y) last = o;
  }
  if (e === first && !wardHook.ground) wardDrawGround(g);
  if (e.hp <= 0) wardDrawCorpse(g, e);
  else if (e.emerge > 0) wardDrawEmerge(g, e);
  else if (e.boss) wardDrawRalph(g, e);
  else wardDrawGremlin(g, e);
  if (e !== last) return;
  if (!wardHook.fx) wardDrawFx(g);
  if (!wardHook.overlay) {
    g.save();
    g.translate(cameraX, 0);
    wardDrawOverlay(g, viewport.w);
    g.restore();
  }
}

function drawCombatGround(g) {
  wardHook.ground = true;
  wardDrawGround(g);
}

function drawCombatFx(g) {
  wardHook.fx = true;
  wardDrawFx(g);
}

function drawCombatOverlay(g, w = viewport.w) {
  wardHook.overlay = true;
  wardDrawOverlay(g, w);
}

function wardDrawGremlin(g, e) {
  const b = breeds[e.type],
    size = wardSize(e),
    face = e.fx >= 0 ? 1 : -1,
    air = clamp(e.z / 80, 0, 0.6),
    tf = wardBodyTransform(e),
    kv = Math.hypot(e.kx || 0, e.ky || 0);
  wardDrawTelegraph(g, e, size);
  shadow(g, e.x, e.y + 1, 20 * size * (1 - air * 0.5), 6 * size * (1 - air * 0.5));
  if (kv > 220 && !reduced) {
    // Knockback streaks trail behind the shove.
    g.globalAlpha = Math.min(0.7, kv / 900);
    for (let i = -1; i <= 1; i++)
      line(
        g,
        [
          [e.x - (e.kx / kv) * 18, e.y - 22 * size + i * 9],
          [e.x - (e.kx / kv) * 44, e.y - 22 * size + i * 9 - (e.ky / kv) * 10]
        ],
        '#ffffff',
        2
      );
    g.globalAlpha = 1;
  }
  g.save();
  g.translate(e.x + tf.jx, e.y - e.z + tf.oy);
  g.transform(tf.sx, 0, tf.lean, tf.sy, 0, 0);
  g.scale(size * face, size);
  wardGremlinArt(g, e.type, e.hit > 0 ? WARD_FLASH : b.pal, time + e.anim, wardPose(e));
  g.restore();
  wardDrawHead(g, e, size);
}

function wardDrawHead(g, e, size) {
  const top = e.y - e.z - 50 * size,
    b = breeds[e.type];
  if (e.stun > 0 || e.dizzy > 0)
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + i * 2.09;
      spark(g, e.x + Math.cos(a) * 15 * size, top - 4 + Math.sin(a) * 4, e.dizzy > 0 ? '#ffd36e' : '#ffe2a1', 0.5);
    }
  if (e.angry > 0 && !e.boss) wardAngerMark(g, e.x + 13 * size, top + 4, 0.9);
  if (e.shrugT > 0) {
    g.globalAlpha = e.shrugT / 0.3;
    g.strokeStyle = '#cfeaff';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(e.x + e.fx * 16 * size, e.y - 26 * size, 12 * size, 24 * size, 0, -1.2, 1.2);
    g.stroke();
    g.globalAlpha = 1;
  }
  if (e.boss || (e.hp >= e.maxHp && !(e.poise > 0))) return;
  const w = 36 * Math.min(1.3, size),
    x = e.x - w / 2,
    y = top - 14;
  rr(g, x - 1, y - 1, w + 2, 7, 3.5, '#1e3a44');
  rr(g, x, y, (w * clamp(e.trail, 0, e.maxHp)) / e.maxHp, 5, 2.5, '#fff3d6');
  if (e.hp > 0) rr(g, x, y, (w * e.hp) / e.maxHp, 5, 2.5, b.color);
  // One more quick hit and it hops.
  if (e.poise > 0) ellipse(g, x + w + 7, y + 2.5, 3.5, 3.5, '#ffb35c');
}

function wardAngerMark(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    path(
      g,
      p => {
        p.moveTo(2, -7);
        p.quadraticCurveTo(2, -2, 7, -2);
      },
      null,
      '#e2475c',
      2.4
    );
  }
  g.restore();
}

function wardArrow(g, x0, y0, x1, y1, col, w) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  line(g, [[x0, y0], [x1, y1]], col, w);
  poly(
    g,
    [
      [x1 + Math.cos(a) * 10, y1 + Math.sin(a) * 10],
      [x1 + Math.cos(a + 2.4) * 10, y1 + Math.sin(a + 2.4) * 10],
      [x1 + Math.cos(a - 2.4) * 10, y1 + Math.sin(a - 2.4) * 10]
    ],
    col
  );
}

// Wind-up tells on the floor: bite rings and arrows, spit lines, charge lanes, landing rings.
function wardDrawTelegraph(g, e, size) {
  if (!(e.wind > 0)) return;
  const k = clamp(1 - e.wind / e.windMax, 0, 1),
    pulse = 0.5 + 0.5 * Math.sin(time * 26),
    d = Math.max(1, dist(player, e)),
    ux = (player.x - e.x) / d,
    uy = (player.y - e.y) / d;
  g.save();
  if (e.act === 'bite') {
    g.globalAlpha = 0.25 + 0.35 * k;
    ellipse(g, e.x, e.y + 1, (24 + 12 * (1 - k)) * size, (8 + 4 * (1 - k)) * size, '#e8556a');
    g.globalAlpha = 0.35 + 0.5 * k;
    wardArrow(g, e.x + ux * 22, e.y + uy * 10, e.x + ux * (34 + 60 * k), e.y + uy * (30 + 54 * k), '#e8556a', 4);
  } else if (e.act === 'charge') {
    const l = Math.max(1, Math.hypot(e.aimX - e.x, e.aimY - e.y)),
      cx = (e.aimX - e.x) / l,
      cy = (e.aimY - e.y) / l,
      locked = e.wind <= e.windMax * 0.4,
      len = e.boss ? 520 : 380,
      w = e.boss ? 46 : 26;
    g.globalAlpha = locked ? 0.28 + 0.2 * pulse : 0.1 + 0.12 * k;
    poly(
      g,
      [
        [e.x - cy * w, e.y + cx * w],
        [e.x + cx * len - cy * w, e.y + cy * len + cx * w],
        [e.x + cx * len + cy * w, e.y + cy * len - cx * w],
        [e.x + cy * w, e.y - cx * w]
      ],
      '#e8556a'
    );
    if (locked) {
      g.globalAlpha = 0.8;
      wardArrow(g, e.x + cx * 40, e.y + cy * 40, e.x + cx * 120, e.y + cy * 120, '#ff7b8c', 5);
    }
  } else if (e.act === 'lob' || e.act === 'slam') {
    const r = e.act === 'slam' ? 125 : WARD.gunkRadius;
    g.globalAlpha = 0.3 + 0.4 * k;
    g.strokeStyle = e.act === 'slam' ? '#d58ef0' : '#f08a7a';
    g.lineWidth = 3;
    g.setLineDash([9, 7]);
    g.beginPath();
    g.ellipse(e.aimX, e.aimY, r, r * 0.38, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  } else if (e.act === 'bump') {
    g.globalAlpha = 0.2 + 0.4 * k;
    g.strokeStyle = '#eadcff';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(e.x, e.y, 135 * (0.4 + 0.6 * k), 135 * 0.38 * (0.4 + 0.6 * k), 0, 0, Math.PI * 2);
    g.stroke();
  } else {
    // Spit, barrage and spray: dashed lines to where the shots are headed, leading Macy.
    const speed = (e.boss ? 200 : 190 * wardPace()) * cfg().speed,
      aim = wardLead((d / speed) * 0.5),
      base = Math.atan2(aim.y - e.y, aim.x - e.x),
      n = e.act === 'spit5' ? 5 : e.act === 'spit' && !e.boss && encounter.wave < 3 ? 1 : 3,
      fan = e.act === 'spit5' ? 0.2 : e.boss ? 0.22 : 0.16,
      len = 120 + 140 * k,
      y0 = e.y - 32;
    g.globalAlpha = 0.25 + 0.45 * k;
    g.strokeStyle = '#b9d56b';
    g.lineWidth = 2.5;
    g.setLineDash([6, 8]);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * fan;
      g.beginPath();
      g.moveTo(e.x, y0);
      g.lineTo(e.x + Math.cos(a) * len, y0 + Math.sin(a) * len);
      g.stroke();
    }
    g.setLineDash([]);
  }
  g.restore();
}

function wardDrawEmerge(g, e) {
  const s = e.spot || e,
    tele = Math.min(WARD.telegraph, e.emergeMax),
    k = e.emerge <= tele ? 1 - e.emerge / tele : 0,
    size = wardSize(e),
    jig = k > 0 && !reduced ? Math.sin(time * 50) * 2.5 * k : 0;
  if (s.vent) {
    g.save();
    g.translate(s.x + jig, s.y);
    rr(g, -24, -9, 48, 16, 5, '#1d3540', '#6f8f97', 1.5);
    for (let i = -2; i <= 2; i++) line(g, [[i * 8, -6], [i * 8, 4]], '#55747d', 2);
    g.restore();
  } else ellipse(g, s.x, s.y - 4, e.boss ? 60 : 30, e.boss ? 14 : 9, '#0c1c26aa');
  if (k > 0 && s.prop) {
    // The furniture rattles: motion strokes on both sides.
    const [bx, by, bw, bh] = s.prop,
      j = reduced ? 0 : Math.sin(time * 45) * 3 * k;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? bx - 6 : bx + bw + 6,
        cy = by + bh - 22;
      for (let i = 0; i < 3; i++)
        line(
          g,
          [
            [cx + side * i * 5, cy - 10 + j - i * 3],
            [cx + side * (i * 5 + 3), cy + j],
            [cx + side * i * 5, cy + 10 + j + i * 3]
          ],
          '#2b4a55aa',
          2
        );
    }
  }
  const blink = (time * 1.3 + e.anim) % 3 > 2.82;
  if (!blink && k < 0.7) {
    const ex = e.boss ? 14 : 6,
      glowCol = e.boss ? '#ffd36e' : '#f5f08a';
    ellipse(g, s.x - ex + jig, s.y - 6, e.boss ? 5 : 3, e.boss ? 3.4 : 2.2, glowCol);
    ellipse(g, s.x + ex + jig, s.y - 6, e.boss ? 5 : 3, e.boss ? 3.4 : 2.2, glowCol);
  }
  if (k <= 0) return;
  const pop = Math.min(1, k * 5),
    bounce = reduced ? 0 : Math.abs(Math.sin(time * 10)) * 4 * (1 - k);
  g.save();
  g.translate(s.x, s.y - 58 - (e.boss ? 70 : 0) - bounce);
  g.scale(pop * (e.boss ? 1.5 : 1), pop * (e.boss ? 1.5 : 1));
  ellipse(g, 0, -7, 13, 15, '#2b1d33cc');
  label(g, '!', 0, 2, 22, '#ffd36e', 'center');
  g.restore();
  if (!reduced)
    for (let i = 0; i < 3; i++) {
      const a = (time * 3 + i * 0.33) % 1;
      g.globalAlpha = 0.5 * (1 - a);
      ellipse(g, s.x + (i - 1) * 18 * (e.boss ? 2 : 1) + jig, s.y - a * 10, 6 + a * 6, 4 + a * 3, '#e8e4d4');
    }
  g.globalAlpha = 1;
  if (k > 0.62) {
    const r = (k - 0.62) / 0.38;
    g.save();
    g.translate(s.x, s.y);
    g.scale(size * (0.7 + 0.3 * r) * (player.x < s.x ? -1 : 1), size * r);
    wardGremlinArt(g, e.type, breeds[e.type].pal, time + e.anim, { eyes: 'wide', mouth: 'open' });
    g.restore();
  }
}

function wardDrawRalph(g, e) {
  const size = breeds[5].size,
    face = e.fx >= 0 ? 1 : -1,
    air = clamp(e.z / 200, 0, 0.6),
    tf = wardBodyTransform(e),
    rage = e.phase === 3;
  wardDrawTelegraph(g, e, size);
  shadow(g, e.x, e.y + 2, 54 * (1 - air * 0.6), 15 * (1 - air * 0.6));
  let pose = wardPose(e);
  if (e.invuln > 0) {
    pose = { eyes: 'squint', mouth: 'open', arms: 'wide', brow: 1 };
    if (!reduced) tf.jx += Math.sin(time * 70) * 3;
  }
  if (e.retreating) pose = { eyes: 'open', mouth: 'grin', arms: 'down', brow: -1, lookX: -1 };
  pose.crownTilt = e.dizzy > 0 || e.stun > 0 ? 0.5 * Math.sin(time * 6) : rage ? -0.15 : 0;
  pose.redEyes = rage;
  g.save();
  g.translate(e.x + tf.jx, e.y - e.z + tf.oy);
  g.transform(tf.sx, 0, tf.lean, tf.sy, 0, 0);
  g.scale(size * face, size);
  wardGremlinArt(g, 5, e.hit > 0 ? WARD_FLASH : rage ? WARD_RAGE : breeds[5].pal, time + e.anim, pose);
  g.restore();
  const top = e.y - e.z - 140;
  if (rage && !reduced)
    for (let i = 0; i < 2; i++) {
      const a = (time * 1.4 + i * 0.5) % 1;
      g.globalAlpha = 0.5 * (1 - a);
      ellipse(g, e.x + (i ? 1 : -1) * (30 + a * 10), top - a * 30, 10 + a * 10, 7 + a * 6, '#f3e6ff');
    }
  g.globalAlpha = 1;
  if (e.stun > 0 || e.dizzy > 0)
    for (let i = 0; i < 4; i++) {
      const a = time * 4 + i * 1.57;
      spark(g, e.x + Math.cos(a) * 40, top - 10 + Math.sin(a) * 9, '#ffd36e', 0.8);
    }
  if (e.taunt) wardDrawTaunt(g, e);
}

function wardDrawTaunt(g, e) {
  const txt = e.taunt.text,
    w = Math.min(340, txt.length * 6.6 + 26),
    left = cameraX + 8,
    right = Math.max(left, cameraX + viewport.w - w - 8),
    x = clamp(e.x - w / 2, left, right),
    y = Math.max(64, e.y - e.z - 186),
    tail = clamp(e.x, x + 14, x + w - 14);
  g.globalAlpha = clamp(e.taunt.t / 0.25, 0, 1);
  poly(g, [[tail - 8, y + 26], [tail + 6, y + 26], [tail - 3, y + 38]], '#fff8e8');
  rr(g, x, y, w, 28, 12, '#fff8e8', '#5d3d8c', 2);
  label(g, txt, x + w / 2, y + 19, 12, '#3b2557', 'center');
  g.globalAlpha = 1;
}

function wardDrawCorpse(g, e) {
  if (e.gone) return;
  const b = breeds[e.type],
    size = wardSize(e),
    t = e.deadT || 0,
    life = e.boss ? 4.5 : WARD.corpse,
    fade = clamp((life - t) / 0.8, 0, 1),
    pal = b.pal;
  g.globalAlpha = 0.8 * fade * clamp(t / 0.12, 0, 1);
  ellipse(g, e.x, e.y + 2, 26 * size, 8 * size, pal[1]);
  ellipse(g, e.x - 15 * size, e.y + 5, 8 * size, 3 * size, pal[0]);
  ellipse(g, e.x + 17 * size, e.y, 6 * size, 2.5 * size, pal[0]);
  ellipse(g, e.x + 4 * size, e.y - 1, 12 * size, 3.5 * size, pal[2] + '66');
  g.globalAlpha = 1;
  if (t < 0.1 && !reduced) {
    // The body inflates for a beat, flashes white, and pops.
    const k = t / 0.1;
    g.save();
    g.translate(e.x, e.y);
    g.scale(size * (1 + k * 0.4) * (e.fx >= 0 ? 1 : -1), size * (1 + k * 0.25));
    wardGremlinArt(g, e.type, WARD_FLASH, time, { eyes: 'x', mouth: 'open', arms: 'wide' });
    g.restore();
  }
  if (t < 0.32) {
    const k = t / 0.32;
    g.globalAlpha = 1 - k;
    g.strokeStyle = '#fffbe8';
    g.lineWidth = 7 * (1 - k) + 1;
    g.beginPath();
    g.ellipse(e.x, e.y - 24 * size, (14 + 60 * k) * size, (12 + 44 * k) * size, 0, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
  const ds = e.boss ? 1.7 : 1;
  for (const d of e.debris || []) {
    g.globalAlpha = fade;
    shadow(g, d.x, d.y, 5 * ds, 2 * ds);
    g.save();
    g.translate(d.x, d.y - d.z);
    g.rotate(d.rot);
    g.scale(ds, ds);
    wardDrawPart(g, d.kind, pal);
    g.restore();
  }
  g.globalAlpha = 1;
  if (e.pay > 0 && t < 1.4) {
    const pop = t < 0.08 ? (t / 0.08) * 1.7 : t < 0.24 ? 1.7 - ((t - 0.08) / 0.16) * 0.7 : 1,
      y = e.y - 64 * size - Math.min(t, 1) * 26,
      sizeText = e.boss ? 30 : 20;
    g.globalAlpha = clamp((1.4 - t) / 0.4, 0, 1);
    g.save();
    g.translate(e.x, y);
    g.scale(pop, pop);
    label(g, '+' + e.pay, 1.5, 1.5, sizeText, '#2a3f2c', 'center');
    label(g, '+' + e.pay, 0, 0, sizeText, '#ffe066', 'center');
    g.restore();
    g.globalAlpha = 1;
  }
}

// ---- Drawing: effects and overlay ----
function wardDrawGround(g) {
  for (const p of puddles) {
    if (!p.gunk) continue;
    const r = p.r;
    g.globalAlpha = Math.min(1, p.life / 0.8) * 0.85;
    ellipse(g, p.x, p.y, r, r * 0.38, '#7f9a3c');
    ellipse(g, p.x - r * 0.2, p.y - 2, r * 0.6, r * 0.2, '#a7c45a');
    for (let i = 0; i < 3; i++) {
      const bt = (time * 0.9 + i * 0.37 + p.x * 0.01) % 1;
      ellipse(g, p.x + (i - 1) * r * 0.45, p.y - 2 - bt * 3, 3 * (1 - bt) + 1, 2.4 * (1 - bt) + 0.8, '#d4e58e');
    }
  }
  g.globalAlpha = 1;
  for (const f of combatFx) if (f.ground) wardDrawEffect(g, f);
}

function wardDrawFx(g) {
  for (const f of combatFx) if (!f.ground) wardDrawEffect(g, f);
}

function wardDrawEffect(g, f) {
  const k = clamp(f.t / f.life, 0, 1);
  if (f.kind === 'ring') {
    const r = f.r0 + (f.r1 - f.r0) * (1 - Math.pow(1 - k, 3));
    g.globalAlpha = 1 - k;
    g.strokeStyle = f.col;
    g.lineWidth = (f.w || 4) * (1 - k) + 1;
    g.beginPath();
    g.ellipse(f.x, f.y, r, r * 0.38, 0, 0, Math.PI * 2);
    g.stroke();
  } else if (f.kind === 'target') {
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 22),
      inner = f.r * (1 - k) + 4;
    g.globalAlpha = 0.16 + 0.12 * pulse;
    ellipse(g, f.x, f.y, f.r, f.r * 0.38, f.col);
    g.globalAlpha = 0.9;
    g.strokeStyle = f.col;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(f.x, f.y, f.r, f.r * 0.38, 0, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(f.x, f.y, inner, inner * 0.38, 0, 0, Math.PI * 2);
    g.stroke();
  } else if (f.kind === 'crack') {
    g.globalAlpha = 1 - k;
    for (let i = 0; i < 7; i++) {
      const a = f.seed + i * 0.9,
        l = f.r * (0.5 + ((i * 37) % 10) / 20);
      line(
        g,
        [
          [f.x, f.y],
          [f.x + Math.cos(a) * l * 0.5, f.y + Math.sin(a) * l * 0.18 + 2],
          [f.x + Math.cos(a + 0.2) * l, f.y + Math.sin(a + 0.2) * l * 0.36]
        ],
        '#5d3d8c',
        3
      );
    }
  } else if (f.kind === 'impact') {
    const r = f.r * (0.5 + k * 0.8);
    g.globalAlpha = 1 - k;
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785 + 0.3;
      line(
        g,
        [
          [f.x + Math.cos(a) * r * 0.45, f.y + Math.sin(a) * r * 0.45],
          [f.x + Math.cos(a) * r, f.y + Math.sin(a) * r]
        ],
        f.col,
        3 * (1 - k) + 1
      );
    }
    ellipse(g, f.x, f.y, r * 0.35 * (1 - k), r * 0.35 * (1 - k), f.col);
  } else if (f.kind === 'spark') {
    g.globalAlpha = 1 - k;
    for (let i = 0; i < (f.n || 5); i++) {
      const a = i * 2.4 + f.x * 0.01,
        d = 6 + k * 26;
      spark(g, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7, f.col, 0.5 * (1 - k) + 0.15);
    }
  } else if (f.kind === 'puff') {
    const n = f.n || 6;
    g.globalAlpha = 0.55 * (1 - k);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + f.x,
        d = f.r * (0.3 + k * 0.9);
      ellipse(g, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.35 - k * 12, 9 - k * 4, 6 - k * 3, '#e8e4d4');
    }
  } else if (f.kind === 'feather') {
    g.globalAlpha = Math.min(1, (f.life - f.t) * 3);
    ellipse(g, f.x, f.y, 4, 1.5, '#14374d22');
    g.save();
    g.translate(f.x, f.y - f.z);
    g.rotate(f.rot);
    ellipse(g, 0, 0, 6, 2.2, '#fffdf3');
    line(g, [[-6, 0], [6, 0]], '#d8e2d4', 0.8);
    g.restore();
  }
  g.globalAlpha = 1;
}

// Screen-space layer: Ralph's health bar, wave banners, the hit chain and teaching hints. Narrow canvases
// push the boss bar below the DOM hearts and coin boxes; hints sit under the banner, clear of the scene tag.
function wardDrawOverlay(g, vw) {
  wardDrawBossBar(g, vw);
  if (wardBanner) wardDrawBanner(g, vw);
  if (wardChain >= 3) wardDrawChain(g, vw);
  if (wardHint) wardDrawHint(g, vw);
}

function wardDrawBanner(g, vw) {
  const b = wardBanner,
    inT = Math.min(1, b.t / 0.25),
    a = Math.min(inT, Math.max(0, (b.life - b.t) / 0.4)),
    w0 = Math.max(b.title.length * 19.5, b.sub.length * 7.4) + 70,
    fit = Math.min(1, (vw - 32) / w0),
    pop = reduced ? 1 : 1 + (1 - Math.min(1, b.t / 0.18)) * 0.25,
    slide = reduced ? 0 : (1 - inT) * -26,
    y = 200;
  g.save();
  g.globalAlpha = a;
  g.translate(vw / 2, y + slide);
  g.scale(pop * fit, pop * fit);
  rr(g, -w0 / 2, -38, w0, 66, 20, '#173847ee', '#ffe29b', 2.5);
  rr(g, -w0 / 2 + 10, -32, w0 - 20, 3, 1.5, '#ffffff1c');
  label(g, b.title, 1.5, 1.5, 30, '#0d222c', 'center');
  label(g, b.title, 0, 0, 30, '#ffe29b', 'center');
  label(g, b.sub, 0, 19, 13, '#d9f0dc', 'center');
  g.restore();
}

function wardDrawBossBar(g, vw) {
  const r = wardBoss;
  if (!r || r.emerge > 0 || r.retreating || (r.hp <= 0 && (r.deadT || 0) > 1.2)) return;
  const w = Math.min(540, vw - 48),
    x = (vw - w) / 2,
    y = vw < 820 ? 130 : 30,
    rage = r.phase === 3,
    hp = Math.max(0, r.hp) / r.maxHp,
    trail = clamp(r.trail, 0, r.maxHp) / r.maxHp;
  rr(g, x - 12, y - 22, w + 24, 50, 14, '#211533e8', rage ? '#e07aa0' : '#a27ad2', 2);
  wardCrown(g, x + 7, y - 6, 0.7);
  label(g, 'RALPH · KING OF THE GUT', x + 24, y - 3, 12, '#eadcff');
  label(g, 'PHASE ' + ['I', 'II', 'III'][r.phase - 1], x + w, y - 3, 12, rage ? '#ff9ab0' : '#ffe29b', 'right');
  rr(g, x, y + 4, w, 13, 6.5, '#120b1d');
  if (trail > 0) rr(g, x, y + 4, w * trail, 13, 6.5, '#fff3d6');
  if (hp > 0)
    rr(
      g,
      x,
      y + 4,
      w * hp,
      13,
      6.5,
      gradient(g, x, 0, w, 0, rage ? '#ff8fb1' : '#c99cf4', rage ? '#a2306a' : '#6e45b0')
    );
  for (const f of [1 / 3, 2 / 3]) rect(g, x + w * f - 1, y + 3, 2, 15, '#211533');
  if (r.invuln > 0) {
    g.globalAlpha = 0.25 + 0.25 * Math.sin(time * 20);
    rr(g, x, y + 4, w, 13, 6.5, '#ffffff');
    g.globalAlpha = 1;
  }
}

function wardDrawChain(g, vw) {
  const s = 1 + wardChainPop * 2,
    x = vw - 26,
    y = vw < 820 && wardBoss && wardBoss.hp > 0 ? 204 : 126;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  label(g, 'CHAIN', 0, -14, 10, '#d9f0dc', 'right');
  label(g, '×' + wardChain, 1.5, 9.5, 24, '#0d222c', 'right');
  label(g, '×' + wardChain, 0, 8, 24, wardChain >= 10 ? '#ffd36e' : '#fff3d6', 'right');
  g.restore();
}

function wardDrawHint(g, vw) {
  const h = wardHint,
    a = Math.min(1, h.t / 0.2, Math.max(0, (h.life - h.t) / 0.4)),
    size = Math.min(13, (vw - 44) / (h.text.length * 0.56)),
    w = Math.min(vw - 20, h.text.length * size * 0.56 + 34),
    x = (vw - w) / 2,
    y = 238;
  g.globalAlpha = a;
  rr(g, x, y, w, 30, 15, '#102b36e6', '#9ed4b2', 1.5);
  label(g, h.text, vw / 2, y + 19.5, size, '#f2f7e4', 'center');
  g.globalAlpha = 1;
}
