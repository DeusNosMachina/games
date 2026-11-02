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

// Ward places. Each arcade's title and copy live with its game in games/*.js.
const rooms = [
  { id: 0, name: 'Your room', sub: 'HOME BASE / THE IV LEAGUE', theme: '#73ac98', station: [255, 350] },
  { id: 1, name: 'MRI room', sub: 'RADIOLOGY / THE LOUD DONUT', theme: '#72aebc', station: [650, 335] },
  { id: 2, name: 'Family lounge', sub: 'VISITORS / BRICK THERAPY', theme: '#b29ab9', station: [510, 430] },
  { id: 3, name: 'CT scan', sub: 'IMAGING / DONUT DRIFTING', theme: '#dab180', station: [650, 335] },
  { id: 4, name: 'Ultrasound', sub: 'SONOGRAPHY / HIDE & BLECH', theme: '#91ba99', station: [620, 385] },
  {
    id: 5,
    name: 'Your room · after dark',
    sub: 'HOME BASE / THE NIGHT SHIFT',
    theme: '#667b9d',
    station: [255, 350]
  }
];

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

const tiers = ['First Rodeo', 'Uh-oh Protocol', 'Code Brown'],
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
  item: 0,
  // Sound preference. audio.js reads it at init and writes it on toggle; save() persists it.
  sound: saved.sound === undefined ? true : !!saved.sound,
  medals: Array.from({ length: rooms.length }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => clamp(Math.floor(Number(saved.medals?.[i]?.[j]) || 0), 0, 3))
  ),
  records: Array.from({ length: rooms.length }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => savedCount(saved.records?.[i]?.[j]))
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
  wardClears: Array.from({ length: rooms.length }, (_, i) => savedCount(saved.wardClears?.[i])),
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
  // Daily Dose: last day played (YYYY-MM-DD), that day's best score, consecutive-day streak.
  daily: {
    last: typeof savedDaily.last === 'string' ? savedDaily.last : '',
    best: savedCount(savedDaily.best),
    streak: savedCount(savedDaily.streak)
  }
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

// Macy in the ward. z/vz are jump height and velocity.
let player = {
  x: 505,
  y: 420,
  dir: 1,
  walk: 0,
  moving: false,
  inv: 0,
  shield: 0,
  attack: 0,
  attackCd: 0,
  itemCd: 0,
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
  attackKind: 0,
  attackDuration: 0.42
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
  traps = [],
  projectiles = [],
  puddles = [],
  cameraX = 0,
  heldAttack = false,
  joyPointer = null,
  attackPointer = null,
  attackOrigin = null;

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
        daily: state.daily
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
