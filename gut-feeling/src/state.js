'use strict';

// Shared helpers, persistent progress, ward globals, the arcade run object, and the game registry.
const $ = id => document.getElementById(id),
  $$ = s => [...document.querySelectorAll(s)],
  canvas = $('game'),
  c = canvas.getContext('2d');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  rand = (a, b) => a + Math.random() * (b - a),
  dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  pick = a => a[Math.floor(Math.random() * a.length)];

// Ward places. Each arcade's title and copy live with its game in games/*.js. Rooms 0 and 5 are the same
// room with the lights on and off: the light switch by her bed flips between them.
const rooms = [
  { id: 0, name: 'Your room', sub: 'HOME BASE / THE IV LEAGUE', theme: '#73ac98', station: [255, 350] },
  { id: 1, name: 'MRI room', sub: 'RADIOLOGY / THE LOUD DONUT', theme: '#72aebc', station: [650, 335] },
  { id: 2, name: 'Family lounge', sub: 'VISITORS / BRICK THERAPY', theme: '#b29ab9', station: [510, 430] },
  { id: 3, name: 'CT scan', sub: 'IMAGING / DONUT DRIFTING', theme: '#dab180', station: [650, 335] },
  { id: 4, name: 'Ultrasound', sub: 'SONOGRAPHY / HIDE & BLECH', theme: '#91ba99', station: [620, 385] },
  {
    id: 5,
    name: 'Your room · lights out',
    sub: 'HOME BASE / THE NIGHT SHIFT',
    theme: '#667b9d',
    station: [255, 350]
  }
];

// The six arcade rooms. Other places (the hallway, room 6) may be pushed into rooms later with
// noArcade: true and an optional width; medals, records, ward clears and the passport stay six long.
const ARCADE_COUNT = rooms.length;

const roomWidth = (id = state.room) => (rooms[id] && rooms[id].width) || 1000,
  isArcadeRoom = id => !!rooms[id] && !rooms[id].noArcade && id < ARCADE_COUNT;

const difficulties = [
  {
    name: 'Pillow Fort',
    speed: 0.75,
    enemyCount: 2,
    window: 0.12,
    mini: 0.86,
    misses: 4,
    coins: 0.8,
    desc: 'Slower gremlins, generous warnings, a little more room for mistakes. Still requires good timing.'
  },
  {
    name: 'Questionable Decisions',
    speed: 1,
    enemyCount: 3,
    window: 0.095,
    mini: 1,
    misses: 3,
    coins: 1,
    desc: 'Nimble gremlins, precise timing, and a sensible amount of nonsense.'
  },
  {
    name: 'Absolute Gutastrophe',
    speed: 1.28,
    enemyCount: 4,
    window: 0.072,
    mini: 1.15,
    misses: 3,
    coins: 1.4,
    desc: 'Faster blobs, smaller windows, shorter warnings. You did read the name.'
  }
];

// Level 4, Legendary, exists for a game that sets `legendary: true` on its registration (a ruleset a
// quarter-second player wins about one time in four). Everything else is sized by TIER_COUNT.
const tiers = ['First Rodeo', 'Uh-oh Protocol', 'Code Brown', 'Legendary'],
  TIER_COUNT = 4,
  // Discharge needs this many stars (bronze 1, silver 2, gold 3, summed over every level of every arcade).
  DISCHARGE_STARS = 21,
  medalNames = ['Unstamped', 'Bronze', 'Silver', 'Gold'];

const STORE = 'gut-feeling-v2';
let saved = {},
  old = {},
  storageOK = true;
try {
  saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
  old = JSON.parse(localStorage.getItem('gut-feeling-v1') || '{}') || {};
} catch {
  storageOK = false;
}

// Gift shop catalog ids. Copy and prices live in input.js; combat reads upgrades by id.
const SHOP_UPGRADE_IDS = ['slippers', 'pillow', 'bag', 'scrunchie', 'snacks', 'thick', 'repellent', 'pass'],
  SHOP_LOOK_IDS = ['look-hoodie', 'look-scrunchie', 'look-socks'];

// Shared records other files write with guards: stats is a plain object of counters, stickers a list
// of sticker ids, cards the get-well wall ({ who, name, text, day }), jersey Macy's number.
const SAVED_CARD_LIMIT = 200;

function savedStats(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function savedCards(v) {
  if (!Array.isArray(v)) return [];
  const text = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
  return v
    .filter(card => card && typeof card === 'object')
    .map(card => ({
      who: text(card.who, 24),
      name: text(card.name, 48),
      text: text(card.text, 280),
      day: text(card.day, 24)
    }))
    .filter(card => card.name || card.text)
    .slice(-SAVED_CARD_LIMIT);
}

const savedJersey = v => (Number.isInteger(v) && v >= 0 && v <= 99 ? v : 22);

// Ward fights left half-way, by department (1 to 4): { wave, teach, left }. left lists who is still
// standing, [breed] or [3, 1] for a split-pea half (combat.js writes it as gremlins fall).
function savedFights(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const room of [1, 2, 3, 4]) {
    const f = v[room];
    if (!f || typeof f !== 'object' || !(f.wave >= 1 && f.wave <= 3)) continue;
    const left = Array.isArray(f.left)
      ? f.left
          .filter(r => Array.isArray(r) && Number.isInteger(r[0]) && r[0] >= 0 && r[0] <= 4)
          .slice(0, 12)
          .map(r => (r[0] === 3 && r[1] ? [3, 1] : [r[0]]))
      : null;
    out[room] = { wave: Math.floor(f.wave), teach: !!f.teach, left };
  }
  return out;
}

// A scheme the player chose stays chosen. Otherwise a finger as the main pointer gets the joystick.
function savedControls() {
  const chosen = saved.controlsChosen === true || saved.controls === 'stick';
  if (chosen && (saved.controls === 'tap' || saved.controls === 'stick')) return saved.controls;
  return matchMedia('(pointer: coarse)').matches ? 'stick' : 'tap';
}

const savedCount = v => Math.max(0, Math.floor(Number(v) || 0)),
  savedIds = (list, allowed) => (Array.isArray(list) ? list.filter(x => allowed.includes(x)) : []),
  savedUpgrades = savedIds(saved.upgrades, SHOP_UPGRADE_IDS),
  savedHearts = 5 + (savedUpgrades.includes('scrunchie') ? 1 : 0),
  savedFood = savedUpgrades.includes('snacks') ? 5 : 3,
  savedDaily = saved.daily && typeof saved.daily === 'object' ? saved.daily : {};

let state = {
  started: false,
  paused: false,
  room: 0,
  hp: clamp(Number.isFinite(saved.hp) ? saved.hp : 5, 0, savedHearts),
  coins: savedCount(saved.coins),
  name:
    (typeof (saved.name ?? old.name) === 'string' ? (saved.name ?? old.name).trim().slice(0, 18) : '') ||
    'Macy',
  difficulty: clamp(Math.floor(Number(saved.difficulty) || 0), 0, 2),
  food: clamp(Math.floor(Number(saved.food) || 0), 0, savedFood),
  // Sound preference. audio.js reads it at init and writes it on toggle; save() persists it.
  sound: saved.sound === undefined ? true : !!saved.sound,
  medals: Array.from({ length: ARCADE_COUNT }, (_, i) =>
    Array.from({ length: TIER_COUNT }, (_, j) => clamp(Math.floor(Number(saved.medals?.[i]?.[j]) || 0), 0, 3))
  ),
  records: Array.from({ length: ARCADE_COUNT }, (_, i) =>
    Array.from({ length: TIER_COUNT }, (_, j) => savedCount(saved.records?.[i]?.[j]))
  ),
  taken: Array.isArray(saved.taken) ? saved.taken : [],
  defeated: Array.isArray(saved.defeated) ? saved.defeated : [],
  upgrades: savedUpgrades,
  // Wardrobe: owned and worn look ids. girl() reads worn through macyLook().
  cosmetics: {
    owned: savedIds(saved.cosmetics?.owned, SHOP_LOOK_IDS),
    worn: savedIds(saved.cosmetics?.worn, SHOP_LOOK_IDS)
  },
  won: !!saved.won,
  wardClears: Array.from({ length: ARCADE_COUNT }, (_, i) => savedCount(saved.wardClears?.[i])),
  // Fights left half-way (savedFights). One object for the whole session: combat.js keeps it as
  // wardProgress, so clear its keys rather than replacing it.
  wardFights: savedFights(saved.wardFights),
  // Hall of Nonsense counters. Combat adds to evictions and bestChain; the arcade adds runs.
  evictions: savedCount(saved.evictions),
  bestChain: savedCount(saved.bestChain),
  coinsEarned: savedCount(saved.coinsEarned),
  runs: savedCount(saved.runs),
  // Ralph guards the exit once the passport is complete. Combat sets ralph when he is beaten.
  ralphReady: !!saved.ralphReady,
  ralph: !!saved.ralph,
  // Faster to fun: returning players skip the hero; each briefing (game:phase) shows in full once.
  played: !!saved.played,
  briefed: Array.isArray(saved.briefed) ? saved.briefed.filter(x => typeof x === 'string') : [],
  // Arcade (fullscreen) preference: null until chosen, then true or false.
  arcade: typeof saved.arcade === 'boolean' ? saved.arcade : null,
  // Touch scheme: 'stick' (the joystick and the big buttons, the default on phones and tablets) or 'tap'
  // (the room is the controller, the default for a mouse). controlsChosen: the player picked one in the
  // settings or the pause menu. Older saves wrote 'tap' without choosing, so only a chosen one is kept.
  controls: savedControls(),
  controlsChosen: saved.controlsChosen === true || saved.controls === 'stick',
  // Mandatory recoveries since the last medal outside one (the Frequent Flyer sticker reads it).
  recoveries: savedCount(saved.recoveries),
  // The level of the last arcade run she started (not a recovery): the recovery opens on it.
  lastTier: clamp(savedCount(saved.lastTier), 0, TIER_COUNT - 1),
  // Daily Dose: last day played (YYYY-MM-DD), that day's best score, consecutive-day streak.
  daily: {
    last: typeof savedDaily.last === 'string' ? savedDaily.last : '',
    best: savedCount(savedDaily.best),
    streak: savedCount(savedDaily.streak)
  },
  // Counters anyone may bump: (state.stats ||= {}).x = ... world.js counts catCam and idles.
  stats: savedStats(saved.stats),
  // Sticker ids earned so far (the stickers module owns the catalog).
  stickers: Array.isArray(saved.stickers) ? saved.stickers.filter(x => typeof x === 'string').slice(0, 200) : [],
  // Get-well cards, oldest first: { who, name, text, day }. The wall in Macy's room draws them.
  cards: savedCards(saved.cards),
  // Macy's jersey number, on her hoodie.
  jersey: savedJersey(saved.jersey)
};
if (saved.difficulty === undefined) state.difficulty = 1;

// cfg() is the active difficulty; stars/stamps/levelTwo feed the discharge rules.
const cfg = () => difficulties[state.difficulty],
  stars = () => state.medals.flat().reduce((a, b) => a + b, 0),
  stamps = () => state.medals.filter(m => m.some(Boolean)).length,
  levelTwo = () => state.medals.some(m => m[1] > 0);

// Shop-driven caps: the Lucky scrunchie adds a sixth heart, Pocket snacks carry five nutrients.
const maxHearts = () => 5 + (state.upgrades.includes('scrunchie') ? 1 : 0),
  maxFood = () => (state.upgrades.includes('snacks') ? 5 : 3);

// Macy in the ward. z/vz are jump height and velocity; vx/vy is her footing's velocity (it only lags the
// stick on slippery floor, see wardGrip).
let player = {
  x: 505,
  y: 420,
  vx: 0,
  vy: 0,
  dir: 1,
  walk: 0,
  moving: false,
  inv: 0,
  // The barf-bag bubble: shield > 0 while it is up, shieldHeld while SHIELD is held, shieldMeter its
  // seconds left, shieldBroken after it popped until it has refilled a little (combat.js).
  shield: 0,
  shieldHeld: false,
  shieldMeter: 2.5,
  shieldBroken: false,
  attack: 0,
  attackCd: 0,
  spinCd: 0,
  brickCd: 0,
  dash: 0,
  dashCd: 0,
  vomit: 0,
  eat: 0,
  combo: 0,
  comboTime: 0,
  lastDx: 1,
  lastDy: 0,
  z: 0,
  vz: 0,
  jumpCd: 0,
  swingHit: false,
  // Ward time of the last attack press (a tap of SWING, Space, a tap on a gremlin). The combo counts
  // swings that start right after a press, not the ones a held button repeats.
  pressAt: -9,
  attackKind: 0,
  attackDuration: 0.42,
  // A pose girl() plays over the walk: an idle or a reaction (see MACY_POSES in art.js).
  // poseT counts up from 0; the pose clears at poseLen. macyCelebrate() sets the medal grin.
  pose: '',
  poseT: 0,
  poseLen: 0
};

// Ward globals: clock, effects, enemies, and live pointer/keyboard input.
let time = 0,
  last = 0,
  toastTimer = 0,
  shake = 0,
  deadDelay = 0,
  hitStop = 0,
  enemies = [],
  particles = [],
  floats = [],
  projectiles = [],
  puddles = [],
  cameraX = 0,
  heldAttack = false,
  joyPointer = null,
  attackPointer = null,
  attackOrigin = null,
  // The finger holding SHIELD down (the bubble drops when that finger lifts).
  shieldPointer = null;

const keys = new Set(),
  joy = { x: 0, y: 0 },
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The current arcade run. openMini()/startMini() replace it wholesale; see ARCHITECTURE.md for
// which fields the framework owns. gore holds the result-screen splatter particles.
let mini = {
    open: false,
    screen: 'lobby',
    id: 0,
    tier: 0,
    forced: false,
    paused: false,
    held: false,
    t: 0,
    phaseTime: 0,
    total: 0,
    miss: 0,
    quality: 100,
    flash: 0,
    message: '',
    countdown: 0,
    hudClock: 0
  },
  gore = [];

function save() {
  try {
    localStorage.setItem(
      STORE,
      JSON.stringify({
        hp: state.hp,
        coins: state.coins,
        name: state.name,
        difficulty: state.difficulty,
        food: state.food,
        medals: state.medals,
        records: state.records,
        taken: state.taken,
        defeated: state.defeated,
        upgrades: state.upgrades,
        cosmetics: state.cosmetics,
        won: state.won,
        wardClears: state.wardClears,
        wardFights: state.wardFights,
        evictions: state.evictions,
        bestChain: state.bestChain,
        coinsEarned: state.coinsEarned,
        runs: state.runs,
        ralphReady: state.ralphReady,
        ralph: state.ralph,
        sound: state.sound,
        played: state.played,
        briefed: state.briefed,
        arcade: state.arcade,
        controls: state.controls,
        controlsChosen: state.controlsChosen,
        recoveries: state.recoveries,
        lastTier: state.lastTier,
        daily: state.daily,
        stats: state.stats,
        stickers: state.stickers,
        cards: state.cards,
        jersey: state.jersey
      })
    );
    storageOK = true;
  } catch {
    storageOK = false;
    $('storageNote').style.display = 'block';
  }
}

// Arcade registry. Each games/<name>.js file registers one definition; see ARCHITECTURE.md for the hooks.
const games = {};

function registerGame(def) {
  games[def.id] = def;
  return def;
}
