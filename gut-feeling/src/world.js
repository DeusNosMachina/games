// The ward is the connective adventure; department challenges carry progression.
// Rooms, movement, pickups, effects, ward rendering, the map, and the frame loop.
const supplies = [
  { id: 'home-shake', room: 0, x: 381, y: 463, type: 'shake' },
  { id: 'mri-juice', room: 1, x: 256, y: 346, type: 'juice' },
  { id: 'lounge-pudding', room: 2, x: 740, y: 396, type: 'pudding' },
  { id: 'ct-shake', room: 3, x: 718, y: 492, type: 'shake' },
  { id: 'us-juice', room: 4, x: 281, y: 407, type: 'juice' },
  { id: 'six-home', room: 0, x: 402, y: 492, type: 'pudding', unlock: 6 },
  { id: 'six-lounge', room: 2, x: 749, y: 520, type: 'juice', unlock: 6 },
  { id: 'twelve-mri', room: 1, x: 681, y: 445, type: 'shake', unlock: 12 },
  { id: 'twelve-us', room: 4, x: 520, y: 506, type: 'pudding', unlock: 12 }
];

const supplyAvailable = s =>
  s.room === state.room && !state.taken.includes(s.id) && stars() >= (s.unlock || 0);

// ---- Health you can find ----
// Besides the one-time supplies above: nutrients the ward drops on the floor (combat.js calls
// wardDropNutrient for a cleared wave, every sixth eviction and a combo slam), and a snack cart in every
// room (the lounge's is its vending machine) that hands out one nutrient, then restocks after a ward clear
// there (snackRestock) or SNACK_RESTOCK seconds. Everything goes in the pocket (maxFood); EAT turns it into
// a heart, as always. A drop waits WARD_DROP_SECONDS (blinking at the end) and leaves with the room.
const WARD_DROP_SECONDS = 30,
  WARD_DROP_MAX = 3,
  WARD_DROP_REACH = 32,
  WARD_DROP_TYPES = ['pudding', 'juice', 'shake'],
  SNACK_RESTOCK = 120,
  SNACK_REACH = 46,
  SNACK_CARTS = {
    0: { x: 640, y: 400 },
    1: { x: 360, y: 420 },
    2: { x: 95, y: 474, vending: true },
    3: { x: 420, y: 420 },
    4: { x: 430, y: 455 }
  },
  SNACK_LINES = {
    cart: 'Snack cart: one nutrient, no questions asked. Back in stock after a ward clear or two minutes.',
    vending: 'The vending machine owed you one. It restocks after a ward clear or two minutes.',
    full: 'POCKETS FULL'
  };

let wardDrops = [],
  wardDropSerial = 0,
  snackFullShown = false;

// Room key -> the ward time its cart restocks. Missing means stocked. Room 5 is room 0 after dark.
const snackStock = {},
  snackKey = (id = state.room) => (id === 5 ? 0 : id),
  snackCartHere = () => SNACK_CARTS[snackKey()] || null,
  snackReady = (id = state.room) => !!SNACK_CARTS[snackKey(id)] && !(snackStock[snackKey(id)] > time);

function snackRestock(id = state.room) {
  delete snackStock[snackKey(id)];
}

// A nutrient on open floor near (x, y). Past WARD_DROP_MAX on the floor, the oldest goes.
function wardDropNutrient(x, y) {
  let px = clamp(x, 60, roomWidth() - 60),
    py = clamp(y, 200, 560);
  if (px > roomWidth() - 140) py = Math.max(py, 240);
  for (let i = 0; i < 16 && collides(px, py); i++) {
    px += (500 - px) * 0.2;
    py += (440 - py) * 0.2;
  }
  if (wardDrops.length >= WARD_DROP_MAX) wardDrops.shift();
  const type = WARD_DROP_TYPES[wardDropSerial++ % WARD_DROP_TYPES.length],
    d = { x: px, y: py, type, life: WARD_DROP_SECONDS, t: 0, near: false };
  wardDrops.push(d);
  floating('NUTRIENT', px, py - 52, '#b7e9b9');
  emit(px, py - 16, '#e7f5b0', reduced ? 3 : 8, 70);
  sfx('powerup', { vol: 0.45 });
  return d;
}

function pocketNutrient(text, x, y) {
  state.food++;
  floating(text, x, y - 50, '#b7e6bd');
  save();
  hud();
  sfx('pickup');
}

// Walking into a drop or up to a stocked cart pockets a nutrient while there is room.
function wardPickups(dt) {
  for (const d of wardDrops) {
    d.life -= dt;
    d.t += dt;
    const near = d.life > 0 && player.z < 30 && dist(d, player) < WARD_DROP_REACH;
    if (near && state.food < maxFood()) {
      d.life = 0;
      pocketNutrient('+1 ' + d.type.toUpperCase(), d.x, d.y);
      if (!(state.stats && state.stats.dropTip)) {
        (state.stats ||= {}).dropTip = 1;
        toast(
          wardCoarsePointer ? 'Pocketed. Tap EAT when a heart runs low.' : 'Pocketed. F eats it when a heart runs low.',
          2.8
        );
      }
    } else if (near && !d.near) floating(SNACK_LINES.full, d.x, d.y - 50, '#ffe4ec');
    d.near = near;
  }
  wardDrops = wardDrops.filter(d => d.life > 0);
  const cart = snackCartHere();
  if (!cart || !snackReady() || deadDelay > 0) return;
  const near = Math.hypot(player.x - cart.x, (player.y - cart.y) * 1.3) < SNACK_REACH;
  if (!near) {
    snackFullShown = false;
    return;
  }
  if (state.food >= maxFood()) {
    if (!snackFullShown) floating(SNACK_LINES.full, cart.x, cart.y - 74, '#ffe4ec');
    snackFullShown = true;
    return;
  }
  snackStock[snackKey()] = time + SNACK_RESTOCK;
  pocketNutrient('+1 SNACK', cart.x, cart.y - 24);
  toast(cart.vending ? SNACK_LINES.vending : SNACK_LINES.cart, 3.2);
}

// Floor layer: the drops, popping in, bobbing, blinking through their last five seconds.
function drawWardDrops(g) {
  for (const d of wardDrops) {
    if (d.life < 5 && !reduced && Math.sin(d.t * 14) < -0.2) continue;
    const pop = reduced ? 1 : Math.min(1, d.t / 0.25),
      bob = reduced ? 0 : Math.sin(time * 3 + d.x) * 3;
    ellipse(g, d.x, d.y, 22, 8, '#e7eea866');
    nutrient(g, d.x, d.y + bob - (1 - pop) * 30, d.type, 1.15 * (0.6 + 0.4 * pop));
    spark(g, d.x + 15, d.y - 38, '#fff0ad', 0.45);
  }
}

// The room's snack cart (or the lounge's vending machine) as a depth-sorted piece.
function snackRenderable() {
  const cart = snackCartHere();
  if (!cart || !isArcadeRoom(state.room)) return null;
  const stocked = snackReady(),
    wait = stocked ? 0 : Math.ceil((snackStock[snackKey()] - time) / 60);
  return {
    y: cart.y + (cart.vending ? 1 : 0),
    draw: g => snackCartArt(g, cart.x, cart.y, stocked, time, cart.vending, wait)
  };
}

// Ward-side state that only this file touches.
// Macy is 5'10" and stands about 120 world units tall in the ward. Visual only: hitboxes, reach and
// collisions do not change. The hallway sizes its cast from MACY_SCALE.
const MACY_SCALE = 1.36,
  MACY_TALL = MACY_SCALE / 1.24;

const ROOM_IRIS_SECONDS = 0.25,
  THICK_SKIN_SECONDS = 2.6,
  ARCADE_LOCKED_TOAST = 'Clear the ward first. The gremlins are sitting on the arcade.',
  wardCoarsePointer = matchMedia('(pointer: coarse)').matches;

let toastSerial = 0,
  wardCameraY = 0,
  wardIris = 0,
  wardHpSeen = state.hp,
  wardPauseShown = false;

function toast(t, sec = 3) {
  toastSerial++;
  $('toast').textContent = t;
  $('toast').classList.add('show');
  toastTimer = sec;
}

function coins(n) {
  if (!Number.isFinite(n)) return;
  state.coins += n;
  if (n > 0) state.coinsEarned += n;
  save();
  hud();
}

// ---- Room extras (src/hallway.js, when it is present) ----
// Optional globals another file may define: hallwayInstall(), updateRoomExtras(dt),
// roomExtraRenderables(), drawRoomOverlay(g, vw, vh), roomExtrasAction(kind, point), hallwayEnter(id),
// hallwayRoomBg(g) and onRoomLoaded(id). Every call is guarded, so the ward runs the same without them.

// Gives an extra room the first say on an action ('attack', 'jump', 'dash', 'use', 'enter', 'tap').
// point is in room coordinates for taps. True means it handled the action.
function roomAction(kind, point) {
  // The send-off takes every action while it plays (advance, skip).
  if (typeof dischargeAction === 'function' && dischargeAction(kind, point)) return true;
  // Any action wakes Macy (from a dream, then from an idle); the room's hotspots go first.
  roomDreamWake();
  macyWake();
  if (roomSpotAction(kind, point)) return true;
  return typeof roomExtrasAction === 'function' && !!roomExtrasAction(kind, point);
}

const NO_ARCADE_TOAST = 'No arcade out here. The games live in the departments.';

// Combat owns wardLocked(); until it exists, every arcade is open.
function arcadeBlocked(id = state.room) {
  return typeof wardLocked === 'function' && !!wardLocked(id);
}

// Every way into a room's arcade (beacon, gamebar, map, Enter) goes through here.
function tryOpenArcade(id = state.room) {
  if (!isArcadeRoom(id)) {
    toast(NO_ARCADE_TOAST, 2.4);
    return false;
  }
  if (arcadeBlocked(id)) {
    toast(ARCADE_LOCKED_TOAST, 2.6);
    sfx('miss');
    return false;
  }
  openMini(id);
  return true;
}

function passportRalphLine() {
  if (state.ralph) return '✓ Ralph evicted. The exit is yours.';
  if (state.ralphReady) return '! Ralph is blocking the exit. Go to your room.';
  return '○ Then Ralph. He thinks he is the exit.';
}

function hud() {
  const max = maxHearts();
  $('hearts').innerHTML = Array.from(
    { length: max },
    (_, i) => `<svg class="${i < state.hp ? '' : 'empty'}" aria-hidden="true"><use href="#i-heart"/></svg>`
  ).join('');
  $('hearts').setAttribute('aria-label', `${state.hp} of ${max} hearts`);
  $('healthName').textContent = state.name ? `${state.name} / ${state.hp} hearts` : 'Queasiness resistance';
  $('score').textContent = String(state.coins).padStart(4, '0');
  $('foodCount').textContent = state.food + ' / ' + maxFood();
  $('eatBtn').disabled = state.food === 0 || state.hp >= max;
  $('hudEat').textContent = '+♥ ' + state.food;
  $('hudEat').disabled = state.food === 0 || state.hp >= max;
  $('hudEat').setAttribute('aria-label', `Eat a nutrient. ${state.food} carried.`);
  // The touch EAT button: the badge counts nutrients; it greys out when empty or at full hearts.
  $('touchEat').disabled = state.food === 0 || state.hp >= max;
  $('touchEatCount').textContent = String(state.food);
  $('touchEat').setAttribute(
    'aria-label',
    state.hp >= max ? `Eat a nutrient. Hearts full. ${state.food} carried.` : `Eat a nutrient. ${state.food} carried.`
  );
  $('difficultyBtn').textContent = cfg().name + ' ⚙';
  $('heroName').value = state.name;
  $('passport').innerHTML = rooms
    .filter(r => isArcadeRoom(r.id))
    .map(
      r =>
        `<div class="passport-row">` +
        `<span>${state.medals[r.id].some(Boolean) ? '✓' : '○'} ${r.name}</span>` +
        `<span>${state.medals[r.id].map(m => (m ? '★'.repeat(m) : '·')).join(' ')}</span></div>`
    )
    .join('');
  $('progressLabel').textContent = stars() + ' / 12';
  $('progressBar').style.width = Math.min(100, (stars() / 12) * 100) + '%';
  $('dischargeRules').textContent =
    `${stamps()}/${ARCADE_COUNT} arcades stamped · ${levelTwo() ? '✓' : '○'} Level 2 medal\n${passportRalphLine()}\nBronze 1★ · Silver 2★ · Gold 3★`;
  // The map dialog repeats the progress line, since arcade mode hides the passport card.
  $('mapPassport').textContent =
    `★ ${stars()}/${DISCHARGE_STARS} stars · ${stamps()}/${ARCADE_COUNT} arcades · ${levelTwo() ? '✓' : '○'} level 2 medal · ` +
    passportRalphLine().replace(/^[✓!○] /, '');
  $('storageNote').style.display = storageOK ? 'none' : 'block';
  renderHall();
  renderDaily();
}

// Hall of Nonsense: lifetime stats for the sidebar and the map.
function renderHall() {
  const medals = state.medals.flat(),
    count = n => medals.filter(m => m === n).length,
    streak = dailyStreak(),
    stats = [
      ['Gremlins evicted', state.evictions],
      ['Best chain', state.bestChain],
      ['Runs played', state.runs],
      ['Lifetime coins', state.coinsEarned],
      ['Gold · silver · bronze', `${count(3)} · ${count(2)} · ${count(1)}`],
      ['Daily streak', streak + (streak === 1 ? ' day' : ' days')]
    ],
    grudge = rooms
      .filter(r => isArcadeRoom(r.id) && r.id !== 0 && r.id !== 5)
      .map(r => {
        const n = state.wardClears[r.id] || 0;
        return `<span class="grudge-chip"><span>${r.name}</span><b>${n ? 'LV ' + n : 'calm'}</b></span>`;
      })
      .join(''),
    html =
      `<div class="hall-stats">` +
      stats.map(([k, v]) => `<div class="hall-row"><strong>${v}</strong><span>${k}</span></div>`).join('') +
      `</div><p class="hall-kicker">Ralph’s grudge · ward clears</p><div class="grudge-chips">${grudge}</div>`;
  $('hallStats').innerHTML = html;
  $('mapHall').innerHTML = html;
}

function clearHeld() {
  if (mini.pointer) arcadeUp(true);
  arcadePointer = null;
  wardAim = null;
  attackPointer = null;
  attackOrigin = null;
  keys.clear();
  joy.x = joy.y = 0;
  heldAttack = false;
  // Nothing holds the bubble up through a pause or a dialog.
  player.shieldHeld = false;
  shieldPointer = null;
  mini.held = false;
  mini.fireHeld = false;
  joyPointer = null;
  $('stick').style.transform = 'translate(0,0)';
  wardTouchReset();
}

function modalOpen(d) {
  clearHeld();
  if (!d.open) d.showModal();
}

function isModal() {
  return $$('dialog').some(d => d.open);
}

function roomToast(id) {
  if (!isArcadeRoom(id)) return rooms[id].toast || 'Hallway. Be nice to the nurses. They know where the pudding is.';
  if (id === 0 && state.ralphReady && !state.ralph) return 'Ralph is in your room. He is not here to visit.';
  if (id === 5) return 'Lights out. Bedside Blaster is up. The switch by the bed brings the day back.';
  if (id === 0) return 'Home base. Fastpitch Fever from the bed. The light switch by the bed means Bedside Blaster.';
  return arcadeBlocked(id)
    ? 'Three waves stand between you and this arcade. Make them regret it.'
    : 'Grab supplies, then find the glowing arcade beacon.';
}

// at: where Macy stands once the room is loaded (the light switch leaves her where she is, with no iris).
// Without it she starts in the middle of the room.
function loadRoom(id, at = null) {
  hitStop = 0;
  state.room = id;
  player.x = at ? at.x : 505;
  player.y = at ? at.y : 470;
  player.inv = at ? player.inv : 1.5;
  player.shield = 0;
  player.shieldHeld = false;
  player.vx = player.vy = 0;
  player.vomit = 0;
  projectiles = [];
  particles = [];
  puddles = [];
  traps = [];
  floats = [];
  wardDrops = [];
  snackFullShown = false;
  deadDelay = 0;
  player.z = 0;
  player.vz = 0;
  player.attack = 0;
  player.attackCd = 0;
  wardTouchReset();
  wardHpSeen = state.hp;
  const toastsBefore = toastSerial;
  // The room track starts first so a boss intro inside startEncounter can take over the music.
  music('room:' + id);
  startEncounter();
  $('roomTitle').textContent = rooms[id].name;
  $('roomSub').textContent = rooms[id].sub;
  const arcade = isArcadeRoom(id);
  $('sceneTag').textContent = !arcade
    ? rooms[id].tag || 'HALLWAY / BE NICE TO THE NURSES'
    : id === 0 || id === 5
      ? 'SAFE ROOM / DANGEROUSLY COZY'
      : 'DODGE THE BLOBS / FIND THE ARCADE';
  // Rooms without an arcade (the hallway) hide the play button.
  $('arcadeBtn').classList.toggle('hidden', !arcade);
  if (arcade) {
    $('arcadeBtn').innerHTML =
      `<span aria-hidden="true">▶</span> <span class="launch-name">${games[id].info.game}</span>`;
    $('arcadeBtn').setAttribute('aria-label', 'Play ' + games[id].info.game);
  }
  renderMap();
  if ($('mapDialog').open && typeof hospitalMapInvalidate === 'function') hospitalMapInvalidate();
  if (state.started) {
    wardIris = reduced || at ? 0 : ROOM_IRIS_SECONDS;
    // Combat may announce its own wave or boss on entry; the room line only fills silence.
    // Rooms without an arcade (the hallway) do their own greeting.
    if (toastSerial === toastsBefore && !rooms[id].noArcade) toast(roomToast(id), 3);
  }
  macyRoomLoaded();
  if (typeof onRoomLoaded === 'function') onRoomLoaded(id);
}

function begin() {
  titleHide();
  if (state.started) return;
  state.started = true;
  if (!state.played) {
    state.played = true;
    save();
  }
  document.body.classList.add('playing');
  state.paused = false;
  $('playStatus').textContent = 'EXPLORE / PLAY / GET HOME';
  loadRoom(state.room);
  // First steps on a touch screen: the room is the controller, or the joystick and the big buttons.
  if (wardCoarsePointer && tapScheme())
    toast('Tap to walk. Tap a gremlin to bonk it. Flick to dash. Two fingers: jump.', 4.5);
  else if (wardCoarsePointer) toast('Left thumb walks. Smash SWING. Hold SHIELD, lob a BRICK, set a TRAP.', 4.5);
  turnHintCheck();
  canvas.focus({ preventScroll: true });
  sfx('ui');
}

// The ward pause menu. state.paused changes in several places; drawWorld keeps the overlay in sync.
function setWardPause(on) {
  if (!state.started) return;
  state.paused = !!on;
  clearHeld();
  syncWardPause();
  if (!on) canvas.focus({ preventScroll: true });
}

function syncWardPause() {
  const on = state.started && state.paused && !mini.open;
  if (on === wardPauseShown) return;
  wardPauseShown = on;
  document.body.classList.toggle('ward-paused', on);
  $('wardPaused').classList.toggle('hidden', !on);
  $('pauseBtn').setAttribute('aria-pressed', String(on));
  if (on) $('wardResume').focus({ preventScroll: true });
}

function collides(x, y) {
  return (
    x < 40 ||
    x > roomWidth() - 40 ||
    y < 170 ||
    y > 574 ||
    (roomProps[state.room] || []).some(p => {
      let [bx, by, bw, bh] = p.box;
      return x + 11 > bx && x - 11 < bx + bw && y + 4 > by && y - 7 < by + bh;
    })
  );
}

function moveEntity(e, dx, dy) {
  if (!collides(e.x + dx, e.y)) e.x += dx;
  if (!collides(e.x, e.y + dy)) e.y += dy;
}

function emit(x, y, col, n = 12, speed = 100) {
  for (let i = 0; i < n; i++)
    particles.push({
      x,
      y,
      vx: rand(-speed, speed),
      vy: rand(-speed, speed * 0.25),
      life: rand(0.3, 0.8),
      col,
      size: rand(3, 7)
    });
}

// life (optional) keeps a longer line up long enough to read; text may hold '\n' line breaks.
function floating(text, x, y, col = '#fff1c2', life = 1.1) {
  floats.push({ text, x, y, life, col });
}

function eat() {
  if (isModal() || state.paused || deadDelay > 0 || state.hp >= maxHearts() || !state.food) return;
  state.food--;
  state.hp++;
  player.eat = 0.9;
  player.inv = Math.max(player.inv, 0.5);
  sfx('eat');
  floating('+1 HEART', player.x, player.y - 95, '#b7e9b9');
  toast('Nutrients consumed. One heart. No Michelin stars.', 2);
  save();
  hud();
}

// ---- Macy's room life ----
// Idles when she stands still, reactions (a flinch, a fist-pump, the medal grin), the room's hotspots
// (the TV, the E-Type, the get-well wall), the TV and its channels, and the quiet stuff: dust in the
// sun, swaying curtains, a nurse passing the door glass, the MRI hum, nodding plants (art.js).
const MACY_IDLE_MIN = 4,
  MACY_IDLE_SPAN = 3,
  TV_WATCH_SECONDS = 3,
  ROOM_SWAY = 0.022,
  CAT_CARD = {
    who: 'cats',
    name: 'Addie, Stella and Pepper',
    text: 'We knocked your water glass off the table. For you.'
  },
  ETYPE_LINES = [
    'She built this. 1,000 pieces. Zero regrets.',
    'British racing green. Built in Bergen County.',
    'Wire wheels. Every spoke placed by hand. Hers.',
    'Zero to sixty in never. It is LEGO.',
    'The only E-Type that fits on a nightstand.',
    'Built one brick at a time. Like a comeback.'
  ],
  // zone: where Macy stands to use it; tap: what a finger or a click can hit; tip: the prompt; verb: its
  // word, or a function for a spot whose word changes (the light switch).
  ROOM_SPOTS = {
    0: [
      {
        // Macy stands in the gap between the bed and the nightstand, under the switch.
        id: 'switch',
        zone: [234, 196, 40, 100],
        at: [255, 250],
        tip: [LIGHT_SWITCH.x, LIGHT_SWITCH.y + 33],
        verb: () => (state.room === 5 ? 'LIGHTS ON' : 'LIGHTS OUT'),
        tap: [LIGHT_SWITCH.x - 18, LIGHT_SWITCH.y - 22, 36, 46]
      },
      { id: 'wall', zone: [40, 170, 200, 165], at: [160, 296], tip: [167, 140], verb: 'READ', tap: [86, 66, 162, 62] },
      { id: 'etype', zone: [240, 170, 130, 150], at: [307, 282], tip: [307, 130], verb: 'ADMIRE', tap: [266, 138, 82, 36] },
      { id: 'tv', zone: [596, 170, 228, 125], at: [705, 236], tip: [705, 142], verb: 'CHANNEL', tap: [620, 24, 170, 100] }
    ],
    2: [{ id: 'tv', zone: [630, 170, 245, 140], at: [750, 250], tip: [750, 150], verb: 'CHANNEL', tap: [660, 20, 180, 106] }]
  };

let macyIdleT = 0,
  macyIdleWait = 0,
  macyIdleSeq = 0,
  macyWaveSeen = null,
  roomSpotSeq = 0,
  tvWatch = 0,
  tvCounted = false,
  tvFlash = 0,
  tvOsd = 0;

const tvChannels = { 0: 0, 2: 0 },
  wallCache = { cv: null, n: -1, last: null, night: false },
  curtainSprites = new Map();

// ---- Poses ----
function macySetPose(kind) {
  if (!MACY_POSES[kind]) return false;
  player.pose = kind;
  player.poseT = 0;
  player.poseLen = MACY_POSES[kind];
  return true;
}

function macyClearPose() {
  player.pose = '';
  player.poseT = 0;
  player.poseLen = 0;
}

const macyIsIdle = () => MACY_IDLES.includes(player.pose);

// What girl() should play right now, or null.
function macyAct() {
  return player.pose ? { kind: player.pose, t: player.poseT } : null;
}

// The medal grin, straight at the camera. The result screen calls this; it clears on its own.
function macyCelebrate() {
  macyIdleT = 0;
  macyIdleWait = 0;
  return macySetPose('grin');
}

// The volleyball idle thumps the floor three times.
const MACY_BALL_THUMPS = [0.61, 1.23, 1.85];

function macyPoseTick(dt) {
  if (!player.pose) return;
  if (macyIsIdle() && (mini.open || isModal() || state.paused || !state.started)) {
    macyClearPose();
    return;
  }
  const before = player.poseT;
  player.poseT += dt;
  if (player.pose === 'ball')
    for (const at of MACY_BALL_THUMPS) if (before < at && player.poseT >= at) sfx('bounce', { vol: 0.3 });
  if (player.poseT >= player.poseLen) macyClearPose();
}

// Input of any kind, or anything happening to Macy, cancels an idle and restarts the wait.
function macyWake() {
  macyIdleT = 0;
  macyIdleWait = 0;
  if (macyIsIdle()) macyClearPose();
}

const macyGremlinsLive = () => enemies.some(e => e && e.hp > 0 && !e.gone),
  macyTalking = () => typeof hallwayTalk !== 'undefined' && !!hallwayTalk;

function macyBusy() {
  return (
    keys.size > 0 ||
    Math.abs(joy.x) + Math.abs(joy.y) > 0.05 ||
    wardTouches.size > 0 ||
    !!wardGoal ||
    !!wardPrey ||
    heldAttack ||
    player.moving ||
    player.attack > 0 ||
    player.dash > 0 ||
    player.z > 0 ||
    player.eat > 0 ||
    player.vomit > 0 ||
    deadDelay > 0 ||
    macyGremlinsLive() ||
    macyTalking()
  );
}

// After 4 to 7 still seconds (a fixed, repeatable spread), one idle from the rotation.
function macyIdleStep(dt) {
  if (macyBusy()) {
    macyWake();
    return;
  }
  if (player.pose) return;
  if (!macyIdleWait) macyIdleWait = MACY_IDLE_MIN + MACY_IDLE_SPAN * titleHash(macyIdleSeq, 3.7);
  macyIdleT += dt;
  if (macyIdleT < macyIdleWait) return;
  macySetPose(MACY_IDLES[macyIdleSeq % MACY_IDLES.length]);
  macyIdleSeq++;
  macyIdleT = 0;
  macyIdleWait = 0;
  const stats = (state.stats ||= {});
  stats.idles = (stats.idles || 0) + 1;
  save();
}

// A hit flinches; a cleared wave (or the whole ward) gets a fist-pump.
function macyReactions() {
  if (state.hp < wardHpSeen) {
    macyIdleT = 0;
    macySetPose('flinch');
  }
  if (typeof encounter === 'undefined' || !encounter) return;
  const seen = macyWaveSeen,
    now = { ref: encounter, wave: encounter.wave || 0, complete: !!encounter.complete };
  macyWaveSeen = now;
  if (!seen || seen.ref !== now.ref || encounter.calm) return;
  if (now.wave > seen.wave || (now.complete && !seen.complete)) macySetPose('pump');
}

function macyRoomLoaded() {
  macyWake();
  roomBark = null;
  roomEnsureRead();
  if (player.pose !== 'grin') macyClearPose();
  macyWaveSeen = null;
  tvWatch = 0;
  tvCounted = false;
  tvFlash = 0;
  tvOsd = 0;
  macySeedCatCard(true);
}

// ---- The TV ----
const tvRoomKey = (id = state.room) => (id === 5 ? 0 : ROOM_TVS[id] ? id : -1);

function tvChannel(id = state.room) {
  const k = tvRoomKey(id);
  if (k < 0) return -1;
  const ch = tvChannels[k] || 0;
  return ch < tvChannelCount(id) ? ch : 0;
}

// The remote: next channel, a click, a blink of static and the channel name.
function tvChange(id = state.room) {
  const k = tvRoomKey(id);
  if (k < 0) return false;
  tvChannels[k] = (tvChannel(id) + 1) % tvChannelCount(id);
  tvFlash = reduced ? 0 : 0.22;
  tvOsd = 1.8;
  tvWatch = 0;
  tvCounted = false;
  sfx('ui');
  return true;
}

function tvVisible(id = state.room) {
  const k = tvRoomKey(id);
  if (k < 0) return false;
  const tv = ROOM_TVS[k];
  return (
    tv.x + tv.w > cameraX &&
    tv.x < cameraX + viewport.w &&
    tv.y + tv.h > wardCameraY &&
    tv.y < wardCameraY + viewport.h
  );
}

// Three seconds of the cat cam counts as watching it, once per sitting.
function tvTick(dt) {
  tvFlash = Math.max(0, tvFlash - dt);
  tvOsd = Math.max(0, tvOsd - dt);
  if (tvChannel() === 3 && typeof tvLateTick === 'function') tvLateTick(dt);
  if (tvChannel() !== 0 || !tvVisible()) {
    tvWatch = 0;
    tvCounted = false;
    return;
  }
  tvWatch += dt;
  if (tvCounted || tvWatch < TV_WATCH_SECONDS) return;
  tvCounted = true;
  const stats = (state.stats ||= {});
  stats.catCam = (stats.catCam || 0) + 1;
  macySeedCatCard();
  save();
}

const macyToday = () => (typeof dailyToday === 'function' ? dailyToday() : '');

// The cats send one card, ever, once Macy has watched them at least once. stats.catCard remembers
// it was sent even if the wall is ever cleared.
function macySeedCatCard(quiet = false) {
  const stats = (state.stats ||= {});
  if (!(stats.catCam >= 1) || stats.catCard >= 1) return false;
  if (!Array.isArray(state.cards)) state.cards = [];
  stats.catCard = 1;
  if (state.cards.some(card => card && card.who === 'cats')) return false;
  state.cards.push({ ...CAT_CARD, day: macyToday() });
  if (!quiet) toast('New card on the wall. Signed with paws.', 2.8);
  save();
  return true;
}

function tvDraw(g, id) {
  const k = tvRoomKey(id);
  if (k < 0 || !tvVisible(id)) return;
  const tv = ROOM_TVS[k],
    s = tvScreenRect(tv),
    ch = tvChannel(id),
    flick = reduced ? 0 : 0.08 * Math.sin(time * 7.3) * Math.sin(time * 2.9 + 1) + (k === 2 ? 0.07 * Math.sin(time * 13.7) : 0);
  // The screen lights the wall around it, a little unevenly.
  g.globalAlpha = clamp((id === 5 ? 0.9 : 0.62) + flick + tvFlash * 1.5, 0, 1);
  g.drawImage(tvGlowSprite(TV_GLOW_COLORS[ch]), tv.x - tv.w * 0.45, tv.y - tv.h * 0.45, tv.w * 1.9, tv.h * 1.9);
  g.globalAlpha = 1;
  g.save();
  g.beginPath();
  g.rect(s.x, s.y, s.w, s.h);
  g.clip();
  g.translate(s.x, s.y);
  if (ch === 0) tvCatCam(g, s.w, s.h, time);
  else if (ch === 1) tvRamsGame(g, s.w, s.h, time);
  else if (ch === 3 && tvLateHere(id)) tvLateDraw(g, s.w, s.h, time);
  else tvCardShow(g, s.w, s.h, time, state.cards, state.name, roomEnsureTrophy);
  if (tvFlash > 0) {
    g.globalAlpha = Math.min(1, tvFlash * 6);
    tvNoise(g, s.w, s.h, time);
    g.globalAlpha = 1;
  }
  if (tvOsd > 0) {
    const text = ch === 3 ? '3 AM · should not exist' : 'CH ' + (ch + 1) + ' · ' + TV_CHANNELS[ch];
    g.globalAlpha = Math.min(1, tvOsd * 3);
    rr(g, s.w - 8 - text.length * 4.6, 4, text.length * 4.6 + 4, 11, 3, '#0b1220cc');
    label(g, text, s.w - 6, 12.4, 7.5, '#a6f0b8', 'right');
    g.globalAlpha = 1;
  }
  g.restore();
  poly(g, [[s.x + s.w * 0.58, s.y], [s.x + s.w * 0.76, s.y], [s.x + s.w * 0.46, s.y + s.h], [s.x + s.w * 0.28, s.y + s.h]], '#ffffff0b');
  if (ch === 3) tvLateSubtitle(g, tv);
}

// ---- Hotspots ----
const roomSpotsHere = () => ROOM_SPOTS[state.room === 5 ? 0 : state.room] || [];

function roomSpotsBlocked() {
  return !state.started || state.paused || mini.open || isModal() || deadDelay > 0 || macyGremlinsLive() || macyTalking();
}

// The hotspot Macy is standing at (the nearest, when zones overlap), or null.
function roomSpotNear() {
  let best = null,
    bestD = Infinity;
  for (const s of roomSpotsHere()) {
    const [x, y, w, h] = s.zone;
    if (player.x < x || player.x > x + w || player.y < y || player.y > y + h) continue;
    const d = Math.hypot(player.x - s.at[0], player.y - s.at[1]);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

function roomSpotAt(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return roomSpotsHere().find(s => p.x >= s.tap[0] && p.x <= s.tap[0] + s.tap[2] && p.y >= s.tap[1] && p.y <= s.tap[1] + s.tap[3]) || null;
}

function roomBeaconNear() {
  const station = isArcadeRoom(state.room) && rooms[state.room].station;
  return !!station && dist(player, { x: station[0], y: station[1] }) < 85;
}

// Space, E or Enter at a hotspot, or a tap on one. Enter by the arcade beacon stays the arcade's.
function roomSpotAction(kind, point) {
  if (roomSpotsBlocked()) return false;
  let spot = null;
  if (kind === 'tap') spot = roomSpotAt(point);
  else if (kind === 'attack' || kind === 'use' || kind === 'enter') {
    spot = roomSpotNear();
    if (spot && kind === 'enter' && roomBeaconNear()) spot = null;
  }
  return spot ? roomSpotUse(spot) : false;
}

// Wraps a line for a floating caption: about `max` characters a line.
function roomWrap(text, max = 30) {
  const lines = [];
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const lastLine = lines[lines.length - 1];
    if (lastLine !== undefined && (lastLine + ' ' + word).length <= max) lines[lines.length - 1] = lastLine + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

// A floating caption that stays readable: wrapped, held longer, kept inside the view.
function roomFloat(lines, x, y, col, life) {
  floats.push({ text: lines.join('\n'), lines, x, y, life, col });
}

function roomSpotUse(s) {
  macyWake();
  if (Math.abs(s.at[0] - player.x) > 8) player.dir = s.at[0] > player.x ? 1 : -1;
  if (s.id === 'switch') return roomLights();
  if (s.id === 'tv') return tvChange();
  if (s.id === 'etype') {
    if (roomBark && roomBark.id === 'etype') roomBark = null;
    const text = ETYPE_LINES[roomSpotSeq % ETYPE_LINES.length];
    roomSpotSeq++;
    roomFloat(roomWrap(text, 26), 307, 126, '#fff1c2', 2.8);
    sfx('ui');
    return true;
  }
  if (s.id === 'wall') {
    const cards = (Array.isArray(state.cards) ? state.cards : []).filter(card => card && typeof card === 'object'),
      card = cards[cards.length - 1],
      lines = card
        ? [...roomWrap('“' + String(card.text || '…') + '”', 30), '♥ ' + String(card.name || 'A friend')]
        : ['No cards yet.', 'The wall is saving room.'];
    roomFloat(lines, 167, 156, '#ffe4ec', 3.6);
    sfx('ui');
    return true;
  }
  return false;
}

// Multi-line floats, nudged sideways so no line runs off the edge of the view.
function floatLines(g, f) {
  const lines = f.lines || String(f.text).split('\n'),
    widest = Math.max(...lines.map(ln => ln.length)) * 6.4,
    x = clamp(f.x, cameraX + widest / 2 + 8, cameraX + viewport.w - widest / 2 - 8);
  lines.forEach((ln, i) => {
    const y = f.y - (lines.length - 1 - i) * 15;
    label(g, ln, x + 1, y + 1, 12, '#244656', 'center');
    label(g, ln, x, y, 12, f.col, 'center');
  });
}

function drawRoomSpotPrompt(g) {
  if (roomSpotsBlocked()) return;
  const s = roomSpotNear();
  if (!s) return;
  const text = (wardCoarsePointer ? 'TAP' : 'SPACE') + ' · ' + (typeof s.verb === 'function' ? s.verb() : s.verb),
    w = text.length * 6.4 + 18,
    // The 3 AM subtitle sits under the screen; the prompt steps down out of its way.
    late = s.id === 'tv' && tvChannel() === 3 && tvLateHere(),
    x = clamp(s.tip[0], w / 2 + 6, roomWidth() - w / 2 - 6),
    y = s.tip[1] + (late ? 24 : 0);
  rr(g, x - w / 2, y - 10, w, 20, 10, '#173847e6', '#ffe29b', 1.5);
  label(g, text, x, y + 4, 10, '#ffe29b', 'center');
}

// ---- The light switch ----
// Her room with the lights on is room 0 (Fastpitch Fever); with them out it is room 5 (Bedside Blaster,
// the night art). The switch on the wall by the bed flips between the two and leaves Macy standing where
// she is. The gamebar's play button and the map follow the room. A quick fade sells the click.
const ROOM_LIGHTS_FADE = 0.35;

let roomLightsFade = 0,
  roomLightsDark = false;

function roomLights() {
  const off = state.room !== 5;
  loadRoom(off ? 5 : 0, { x: player.x, y: player.y });
  roomLightsFade = reduced ? 0 : ROOM_LIGHTS_FADE;
  roomLightsDark = off;
  if (off) {
    const stats = (state.stats ||= {});
    stats.lightsOut = (Number(stats.lightsOut) || 0) + 1;
    save();
  }
  toast(off ? 'Lights out. Bedside Blaster is up.' : 'Lights on. Fastpitch Fever is back.', 2.6);
  sfx(off ? 'lock' : 'unlock', { vol: 0.7 });
  return true;
}

// The flip: dark settling in, or daylight flooding back, over the whole view.
function drawRoomLightsFade(vw, vh) {
  if (roomLightsFade <= 0) return;
  c.globalAlpha = (roomLightsFade / ROOM_LIGHTS_FADE) * (roomLightsDark ? 0.8 : 0.55);
  rect(c, 0, 0, vw, vh, roomLightsDark ? '#050b16' : '#fff6dc');
  c.globalAlpha = 1;
  roomLightsFade = Math.max(0, roomLightsFade - renderDelta);
}

// A mouse click on a hotspot (touches arrive through roomAction('tap') in input.js).
function roomSpotClick(e) {
  if (typeof pressClick === 'function' && pressClick(canvas, e)) return;
  if (!e || e.clientX === undefined) return;
  roomDreamWake();
  macyWake();
  roomSpotAction('tap', wardPoint(e));
}

if (canvas && typeof canvas.addEventListener === 'function') canvas.addEventListener('click', roomSpotClick);
// Any key or press anywhere wakes Macy at once (the ward step also notices held keys and fingers).
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', macyWake, true);
  document.addEventListener('pointerdown', macyWake, true);
}

// ---- The wall and the ambience ----
function roomCurtainSway(side, id = state.room) {
  if (!roomSwayCurtains(id)) return 0;
  return Math.sin(time * 0.8 + side * 1.3 + id) * ROOM_SWAY;
}

function curtainSprite(h) {
  let cv = curtainSprites.get(h);
  if (!cv) {
    cv = document.createElement('canvas');
    curtainArt(configureCanvas(cv, 20, h), 0, 0, h);
    curtainSprites.set(h, cv);
  }
  return cv;
}

// Curtains hang from the rail and the hems drift. Two sprites, two draws.
function roomCurtains(g, id) {
  if (!roomSwayCurtains(id)) return;
  const win = ROOM_WINDOWS[id],
    h = win.h + 12,
    sprite = curtainSprite(h);
  for (const side of [-1, 1]) {
    const x = side < 0 ? win.x - 24 : win.x + win.w + 5;
    g.save();
    g.translate(x + 10, win.y - 7);
    g.transform(1, 0, roomCurtainSway(side, id), 1, 0, 0);
    g.drawImage(sprite, -10, 0, 20, h);
    g.restore();
  }
}

// Dust motes drifting in the window light: one path, one fill.
function roomMotes(g, id) {
  if (reduced || id === 5 || !ROOM_WINDOWS[id] || roomDaypart() === 'night') return;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const v = (roomHash(i, 81) + time * 0.012 * (0.5 + roomHash(i, 82))) % 1,
      y = 165 + v * 285,
      k = (y - 155) / 307,
      left = 365 + k * 112,
      right = 590 + k * 140,
      x = left + (right - left) * roomHash(i, 83) + Math.sin(time * 0.6 + i * 1.7) * 7,
      r = 0.9 + roomHash(i, 84) * 1.1;
    g.moveTo(x + r, y);
    g.arc(x, y, r, 0, Math.PI * 2);
  }
  g.globalAlpha = 0.45 + 0.15 * Math.sin(time * 0.7);
  g.fillStyle = '#fff6d4';
  g.fill();
  g.globalAlpha = 1;
}

// Every so often a nurse walks past the glass in the door, one way or the other.
function roomNurse(g, id) {
  if (reduced) return;
  const loop = time + id * 3.1,
    c = loop % 15;
  if (c > 2.6) return;
  const pane = ROOM_DOOR_GLASS,
    dir = Math.floor(loop / 15) % 2 ? -1 : 1,
    k = c / 2.6,
    x = dir > 0 ? pane.x - 10 + k * (pane.w + 20) : pane.x + pane.w + 10 - k * (pane.w + 20),
    bob = Math.abs(Math.sin(c * 7)) * 1.2;
  g.save();
  g.beginPath();
  g.rect(pane.x, pane.y, pane.w, pane.h);
  g.clip();
  g.globalAlpha = id === 5 ? 0.4 : 0.55;
  rr(g, x - 9, pane.y + 21 - bob, 18, 22, 7, '#3f7f8a');
  ellipse(g, x, pane.y + 14 - bob, 4.4, 5, '#2f5a63');
  ellipse(g, x - dir * 3.4, pane.y + 10 - bob, 2.4, 2.4, '#2f5a63');
  g.restore();
}

// The MRI's hum, felt in the room light.
function roomHum(g, id) {
  if (reduced || id !== 1) return;
  g.globalAlpha = 0.045 * (0.5 + 0.5 * Math.sin(time * Math.PI * 1.8));
  rect(g, 0, 0, 1000, 625, '#d6f1ff');
  g.globalAlpha = 1;
}

// The cards on the board, from a cache that rebuilds only when a card arrives.
function roomWallCards(g, night) {
  const cards = Array.isArray(state.cards) ? state.cards : [],
    last = cards[cards.length - 1] || null,
    b = WALL_BOARD;
  if (!wallCache.cv || wallCache.n !== cards.length || wallCache.last !== last || wallCache.night !== night) {
    if (!wallCache.cv) wallCache.cv = document.createElement('canvas');
    const cg = configureCanvas(wallCache.cv, b.w + 24, b.h + 24);
    cg.save();
    cg.translate(12 - b.x, 12 - b.y);
    wallCardsArt(cg, cards);
    cg.restore();
    if (night) {
      cg.globalCompositeOperation = 'source-atop';
      rect(cg, 0, 0, b.w + 24, b.h + 24, '#162a5266');
      cg.globalCompositeOperation = 'source-over';
    }
    wallCache.n = cards.length;
    wallCache.last = last;
    wallCache.night = night;
  }
  g.drawImage(wallCache.cv, b.x - 12, b.y - 12, b.w + 24, b.h + 24);
}

// Everything on the walls that moves or changes, drawn right over the cached room.
function roomWallLayer(g) {
  const id = state.room;
  if (!(id >= 0 && id <= 5)) return;
  roomHum(g, id);
  roomMotes(g, id);
  roomCurtains(g, id);
  roomNurse(g, id);
  if (id === 0 || id === 5) {
    roomWallCards(g, id === 5);
    lightSwitchArt(g, LIGHT_SWITCH.x, LIGHT_SWITCH.y, id === 5, time);
  }
  roomCultWall(g, id);
  tvDraw(g, id);
}

// ---- The hospital has opinions ----
// Every machine is a character. Walk within ROOM_BARK_RANGE of one (not during a fight) and it says
// one line in a bubble, at most once every ROOM_BARK_COOLDOWN seconds. One bubble at a time.
const ROOM_BARK_RANGE = 60,
  ROOM_BARK_COOLDOWN = 20,
  MACHINE_ORDER = ['mri', 'ct', 'cuff', 'ultrasound', 'vending', 'pump', 'monitor', 'bed', 'etype'],
  MACHINES = {
    mri: {
      name: 'BRRR 3000, the MRI',
      lines: [
        "DON'T BRING KEYS. DON'T. I CAN FEEL THEM.",
        "IS THAT A HAIR CLIP? I'M FINE. I'M FINE.",
        "I'M NOT LOUD. I'M EXPRESSIVE.",
        "HOLD STILL. NOT YOU. ME. I'M HOLDING STILL.",
        'EVERY BANG IS A COMPLIMENT. BANG.'
      ],
      honor: 'EMPLOYEE OF THE MONTH? ME? I NEED TO LIE DOWN. I AM A TUBE.'
    },
    ct: {
      name: 'Donut II, the CT scanner',
      lines: [
        'No brakes. Never needed them. Never will.',
        'I spin faster than your bike ever dreamed.',
        'They call me Donut II. Donut I could not handle the pressure.',
        'Zero brakes. Zero regrets. One very good picture.',
        'Stand back. I do donuts professionally.'
      ],
      honor: 'Employee of the Month. Still no brakes. Still winning.'
    },
    cuff: {
      name: 'The blood pressure cuff',
      lines: [
        'You are under pressure. Good pressure. Diamond pressure.',
        'Squeeze the day!',
        'Every squeeze is a hug with numbers.',
        "Breathe in. Breathe out. I've got your arm, champ.",
        "Your numbers called. They said you're a legend."
      ],
      honor: "Employee of the Month. I'd like to thank everyone I've ever squeezed."
    },
    ultrasound: {
      name: 'The ultrasound machine',
      lines: [
        "My gel is room temperature. That's a lie. It's freezing.",
        'I once saw a kidney wave at me. We do not talk about it.',
        'I can see inside people. I try not to make it weird. It is weird.',
        'Fun fact: I am mostly vibes and a cold wand.',
        'I dated a fax machine once. Mixed signals.'
      ],
      honor: "Employee of the Month. I cried into the gel. You'll never know."
    },
    vending: {
      name: 'The vending machine',
      lines: [
        'Pretzels for a smile. Final offer. Fine, two smiles.',
        "I don't take cards. I take compliments.",
        'Chips are a dollar or one good joke. Your dad already tried.',
        "B4 is stuck. I could unstick it. What's in it for me?",
        "Free cookie if you tell the nurses I'm nice."
      ],
      honor: 'Employee of the Month. Autographs are a dollar. Negotiable.'
    },
    pump: {
      name: 'The IV pump',
      lines: [
        'The patient approaches the window. Majestic.',
        'Here we see the teenager in her natural habitat: the seventh floor.',
        'She pauses. She considers the pudding. Nature is beautiful.',
        'Observe the ponytail. It moves with purpose.',
        'A rare sighting: the patient, standing still. Do not startle her.'
      ],
      honor: 'And here, in the wild, the Employee of the Month. Me. Hush now.'
    },
    monitor: {
      name: 'Monitor 88',
      lines: [
        "88! That's you! I'm counting! Isn't this fun?",
        "I'm on the team! I'm the beeping part of the team!",
        'Just happy to be here. Beep.',
        'Still 88. Still proud. Still beeping.',
        "Can I come to the next game? I'll beep quietly."
      ],
      honor: "Employee of the Month?! I've never been this included!"
    },
    bed: {
      name: 'The bed',
      lines: [
        "Zzz... oh. You're up. I'll keep it warm.",
        'Zzz... five more minutes... zzz.',
        "Zzz... snrk... I wasn't asleep. I was resting my springs.",
        'Zzz... dreaming of pillows. The good kind.',
        'Zzz... come back... the blanket misses you.'
      ],
      honor: 'Zzz... Employee of the Month... zzz... tell my mattress.'
    },
    etype: {
      name: 'The E-Type',
      lines: [
        "Vroom. Vrrroom. That's British for hello.",
        "Rev rev. I'd take you for a spin but I'm pocket-sized.",
        'Brrm brrm. No engine. All spirit.',
        'Vrrrm. Every brick where you put it. Thank you.',
        'Vroom. British racing green and racing nowhere.'
      ],
      honor: 'VROOM. Employee of the Month. Somebody polish my wire wheels.'
    }
  },
  // near: the box Macy walks up to; at: where the bubble's tail points (and the badge sits).
  ROOM_MACHINES = {
    0: [
      { id: 'bed', near: [95, 176, 131, 105], at: [160, 128] },
      { id: 'pump', near: [50, 150, 40, 122], at: [69, 154] },
      { id: 'monitor', near: [266, 71, 72, 95], at: [302, 68] },
      { id: 'etype', near: [265, 140, 85, 120], at: [307, 138] }
    ],
    1: [{ id: 'mri', near: [387, 166, 188, 129], at: [486, 92] }],
    2: [{ id: 'vending', near: [50, 321, 90, 133], at: [95, 314] }],
    3: [{ id: 'ct', near: [380, 167, 188, 130], at: [481, 92] }],
    4: [
      { id: 'ultrasound', near: [339, 150, 123, 150], at: [400, 144] },
      { id: 'cuff', near: [739, 64, 32, 100], at: [755, 60] }
    ]
  };

let roomBark = null;

const roomBarkAt = {},
  roomBarkSeq = {};

const roomMachinesHere = () => ROOM_MACHINES[state.room === 5 ? 0 : state.room] || [];

// Distance from Macy's feet to the nearest point of a box.
function roomBoxDist(p, box) {
  const [x, y, w, h] = box,
    dx = Math.max(x - p.x, 0, p.x - (x + w)),
    dy = Math.max(y - p.y, 0, p.y - (y + h));
  return Math.hypot(dx, dy);
}

// The local date as YYYY-MM-DD (the Daily Dose's key when that file is loaded).
const roomDayKey = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// One machine a day gets the gold frame: the same pick all day, from the date alone.
// day: a Date or 'YYYY-MM-DD' (default today). Returns { id, name, line }.
function machineOfTheMonth(day) {
  const key = day instanceof Date ? roomDayKey(day) : typeof day === 'string' && day ? day : roomDayKey();
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  const id = MACHINE_ORDER[h % MACHINE_ORDER.length];
  return { id, name: MACHINES[id].name, line: MACHINES[id].honor };
}

// A machine's pool. The Employee of the Month opens with its honor line.
function machineLines(id) {
  const m = MACHINES[id];
  if (!m) return [];
  return machineOfTheMonth().id === id ? [m.honor, ...m.lines] : m.lines.slice();
}

function roomBlurt(m) {
  const lines = machineLines(m.id),
    n = roomBarkSeq[m.id] || 0,
    text = lines[n % lines.length];
  roomBarkSeq[m.id] = n + 1;
  roomBarkAt[m.id] = time;
  const life = Math.min(6, 3 + text.length * 0.035);
  roomBark = { id: m.id, text, lines: roomWrap(text, 30), x: m.at[0], y: m.at[1], life, max: life };
  return roomBark;
}

function roomOpinionsTick(dt) {
  if (roomBark) {
    roomBark.life -= dt;
    if (roomBark.life <= 0) roomBark = null;
  }
  if (roomBark || !(state.room >= 0 && state.room <= 5) || deadDelay > 0 || macyGremlinsLive()) return;
  let best = null,
    bestD = ROOM_BARK_RANGE;
  for (const m of roomMachinesHere()) {
    const d = roomBoxDist(player, m.near);
    if (d > bestD) continue;
    if (time - (roomBarkAt[m.id] ?? -Infinity) < ROOM_BARK_COOLDOWN) continue;
    best = m;
    bestD = d;
  }
  if (best) roomBlurt(best);
}

// Text size for world-space bubbles: the hallway's bark size, so both read the same on every screen.
function roomBarkSize() {
  let css = 1;
  try {
    const r = canvas.getBoundingClientRect();
    if (r && r.width > 0) css = r.width / Math.max(1, viewport.w);
  } catch {
    css = 1;
  }
  return clamp(Math.round(11 / clamp(css, 0.3, 2)), 12, 24);
}

function roomTextW(g, text, size) {
  g.font = `700 ${size}px "Trebuchet MS", Arial, sans-serif`;
  const m = typeof g.measureText === 'function' ? g.measureText(text) : null;
  return m && Number.isFinite(m.width) ? m.width : text.length * size * 0.56;
}

// The badge over today's Employee of the Month, then the bubble: the hallway barks' style, in the room.
function drawRoomOpinions(g) {
  if (!(state.room >= 0 && state.room <= 5)) return;
  const eom = machineOfTheMonth().id,
    bob = reduced ? 0 : Math.sin(time * 2) * 1.2;
  for (const m of roomMachinesHere()) if (m.id === eom) machineBadge(g, m.at[0], m.at[1] + bob);
  const b = roomBark;
  if (!b) return;
  const fs = roomBarkSize(),
    lh = fs + 3,
    w = Math.max(...b.lines.map(ln => roomTextW(g, ln, fs))) + 22,
    h = b.lines.length * lh + 9,
    ax = b.x,
    ay = b.y - (b.id === eom ? 15 : 0),
    x = clamp(ax - w / 2, cameraX + 6, cameraX + viewport.w - w - 6),
    y = Math.max(wardCameraY + 6, ay - 7 - h),
    tip = clamp(ax, x + 12, x + w - 12);
  g.save();
  g.globalAlpha = clamp(Math.min(b.life * 3, (b.max - b.life) * 8), 0, 1);
  rr(g, x, y, w, h, Math.min(h / 2, fs), '#fffaf0', '#244d53', 1.6);
  poly(g, [[tip - 6, y + h - 1], [tip + 6, y + h - 1], [tip, y + h + 7]], '#fffaf0');
  b.lines.forEach((ln, i) => label(g, ln, x + w / 2, y + 5 + lh * i + fs * 0.86, fs, '#244656', 'center'));
  g.restore();
}

// ---- The Ensure cult, room side ----
// Barb keeps offering. Every refusal (state.stats.ensureRefused, counted in the hallway) leaves a
// little more Ensure around Macy's rooms. Read at each room load.
const ROOM_PA = 'Attention: the cafeteria has been renamed The Ensure Experience.';

let roomEnsureN = 0,
  roomEnsureTrophy = false,
  roomPaDone = false;

function roomEnsureRead() {
  const stats = state.stats && typeof state.stats === 'object' ? state.stats : {},
    n = Number(stats.ensureRefused);
  roomEnsureN = Number.isFinite(n) ? n : 0;
  roomEnsureTrophy = roomEnsureN >= 50 && !!stats.ensureTrophy;
  // Thirty refusals in, the PA has news. Once per session.
  if (roomEnsureN >= 30 && !roomPaDone && state.started && state.room >= 0 && state.room <= 5) {
    roomPaDone = true;
    toast(ROOM_PA, 3.6);
    sfx('ui');
  }
}

// The Ensure that has piled up, as depth-sorted pieces for drawWorld.
function roomCultRenderables() {
  const n = roomEnsureN,
    id = state.room,
    out = [];
  if (n < 10) return out;
  if (id === 0 || id === 5) {
    if (n >= 20) out.push({ y: 281, draw: g => ensureSixPack(g, 246, 287, 0.9) });
    if (n >= 30)
      out.push({
        y: 266,
        draw: g => {
          rr(g, 274, 191, 67, 7, 2, '#4a3229');
          roomBottle(g, 290, 202, 1, 0.72);
          roomBottle(g, 306, 201, 0, 0.72);
          roomBottle(g, 322, 203, 2, 0.72);
          rr(g, 271, 197, 73, 28, 4, gradient(g, 271, 197, 73, 28, '#e3bd98', '#cda081'), '#a9806d88', 1);
          line(g, [[297, 207], [317, 207]], '#567a7c', 3);
          for (const [bx, by, f, r] of [[298, 287, 0, 1.45], [331, 293, 2, -1.5], [281, 296, 1, 1.6]]) {
            g.save();
            g.translate(bx, by);
            g.rotate(r);
            roomBottle(g, 0, 0, f, 0.72);
            g.restore();
          }
        }
      });
    if (roomEnsureTrophy) out.push({ y: 548, draw: g => ensureTrophyArt(g, 720, 548) });
  }
  if (id === 1 && n >= 20)
    out.push({
      y: 303,
      draw: g => {
        g.save();
        g.translate(520, 55);
        g.rotate(reduced ? 0.04 : Math.sin(time * 1.7) * 0.07);
        roomBottle(g, 0, 0, 2, 1.1);
        g.restore();
      }
    });
  if (id === 2) {
    out.push({ y: 389, draw: g => roomBottle(g, 556, 360, 0, 1) });
    if (n >= 20)
      out.push({
        y: 461,
        draw: g => {
          for (let i = 0; i < 3; i++) roomBottle(g, 74 + i * 19, 410, i, 0.62);
        }
      });
  }
  return out;
}

// Wall-layer Ensure: a bottle on her windowsill, and the trophy's spotlight.
function roomCultWall(g, id) {
  if (roomEnsureN < 10 || (id !== 0 && id !== 5)) return;
  roomBottle(g, 540, 123, 2, 0.9);
  if (!roomEnsureTrophy) return;
  g.globalAlpha = 0.5;
  poly(g, [[712, 0], [728, 0], [758, 540], [682, 540]], '#fff3c430');
  ellipse(g, 720, 546, 40, 9, '#fff3c455');
  g.globalAlpha = 1;
}

// ---- Optional neighbors: the dream (src/dream.js) and the 3 AM channel (src/tvlate.js) ----
// Every call is guarded; the room runs the same without them.
function roomDreamWake() {
  if (typeof dreamWake === 'function') dreamWake();
}

// The 3 AM channel exists in the room after dark, and only when tvlate.js is in the build.
const tvLateHere = (id = state.room) => id === 5 && typeof tvLateDraw === 'function';

function tvChannelCount(id = state.room) {
  return tvLateHere(id) ? 4 : 3;
}

function tvLateSubtitle(g, tv) {
  const caption = typeof tvLateCaption === 'function' ? String(tvLateCaption() || '') : '';
  if (!caption) return;
  const fs = 9,
    w = Math.min(roomTextW(g, caption, fs) + 16, 360),
    x = tv.x + tv.w / 2,
    y = tv.y + tv.h + 10;
  rr(g, x - w / 2, y, w, fs + 8, 4, '#0b1220d8');
  label(g, caption, x, y + fs + 2.5, fs, '#e6e0ff', 'center');
}

// ---- Title screen ----
// #titleScreen owns the viewport on load: the hospital at dusk drawn on #titleArt, the logo, and one
// START. Any key, any tap or the button starts; the screen irises out (instantly under reduced motion)
// and begin() runs. "Quit to title" in the pause menu brings it back. Under reduced motion the art
// holds still. After TITLE_ATTRACT_SECONDS idle, a gremlin runs past and Macy's window flickers.
const TITLE_IRIS_SECONDS = reduced ? 0 : 0.25,
  TITLE_ATTRACT_SECONDS = 25,
  TITLE_HOSPITAL = 'VALLEY HOSPITAL',
  TITLE_FLOORS = 8,
  TITLE_MACY_FLOOR = 7;

let titleUp = false,
  titleLeaving = 0,
  titleT = 0,
  titleIdle = 0,
  titleLook = { x: 0, y: 0 },
  titleSize = { w: 0, h: 0 };

function titleShow() {
  titleUp = true;
  titleLeaving = 0;
  titleIdle = 0;
  $('titleScreen').dataset.state = 'up';
  $('titleWelcome').textContent = titleWelcomeLine();
  document.body.classList.add('title-up');
  music('title');
  titleFit();
  $('titleStart').focus({ preventScroll: true });
}

function titleWelcomeLine() {
  if (!state.played) return '';
  if (state.ralphReady && !state.ralph) return `Welcome back, ${state.name || 'Macy'}. Ralph is waiting in your room.`;
  return `Welcome back, ${state.name || 'Macy'}. The gremlins ate your pudding.`;
}

// Gone at once: begin() calls this, so every other way into the game clears the title too.
function titleHide() {
  if (!titleUp) return;
  titleUp = false;
  titleLeaving = 0;
  $('titleScreen').dataset.state = 'gone';
  document.body.classList.remove('title-up');
}

// START, any key or any tap. Returns false when the title is not up or is already leaving.
function titleStart() {
  if (!titleUp || titleLeaving > 0) return false;
  sfx('go');
  if (TITLE_IRIS_SECONDS <= 0) {
    titleFinish();
    return true;
  }
  titleLeaving = TITLE_IRIS_SECONDS;
  $('titleScreen').dataset.state = 'leaving';
  return true;
}

// The frame loop (and tests) advance the iris; when it closes, the game begins.
function titleTick(dt) {
  if (!titleUp) return;
  titleT += reduced ? 0 : dt;
  titleIdle += dt;
  if (titleLeaving > 0) {
    titleLeaving -= dt;
    if (titleLeaving <= 0) titleFinish();
  }
}

function titleFinish() {
  titleHide();
  begin();
  // A save left at zero hearts goes straight to the recovery.
  if (state.hp === 0 && !mini.open) openMini(0, true);
  if (!document.body.classList.contains('arcade'))
    $('cabinet').scrollIntoView({ block: 'start', behavior: 'instant' });
}

// "Quit to title": save, stop the ward, show the title again.
function titleQuit() {
  save();
  $$('dialog[open]').forEach(d => d.close());
  setWardPause(false);
  clearHeld();
  state.started = false;
  state.paused = true;
  document.body.classList.remove('playing');
  syncWardPause();
  titleShow();
}

function titleNudge(x, y) {
  titleIdle = 0;
  if (reduced || !titleSize.w) return;
  titleLook = { x: clamp(x / titleSize.w - 0.5, -0.5, 0.5), y: clamp(y / titleSize.h - 0.5, -0.5, 0.5) };
}

function titleFit() {
  const w = window.innerWidth || 1280,
    h = window.innerHeight || 800;
  if (w === titleSize.w && h === titleSize.h) return;
  titleSize = { w, h };
  configureCanvas($('titleArt'), w, h);
}

function drawTitle() {
  if (!titleUp) return;
  titleFit();
  drawTitleArt($('titleArt').getContext('2d'), titleSize.w, titleSize.h, titleT, titleIdle > TITLE_ATTRACT_SECONDS);
}

// A cheap stable hash for window patterns.
function titleHash(i, j) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// The hospital at dusk. t is seconds (frozen under reduced motion); attract adds the runner and the flicker.
function drawTitleArt(g, w, h, t, attract) {
  const lx = titleLook.x * 16,
    ly = titleLook.y * 10,
    tall = h > w,
    groundY = h * 0.79,
    bh = Math.min(h * 0.43, w * (tall ? 0.95 : 0.48)),
    bw = Math.min(w * 0.86, bh * 2.25),
    bx = w / 2 - bw / 2 + lx,
    by = groundY - bh + ly * 0.4,
    s = bh / 300;
  // Sky, stars, moon, clouds.
  rect(g, 0, 0, w, h, gradient(g, 0, 0, 0, groundY, '#131c38', '#c47a7c'));
  rect(g, 0, groundY * 0.55, w, groundY * 0.45, gradient(g, 0, groundY * 0.55, 0, groundY * 0.45, '#6a4f7000', '#e9a07a66'));
  for (let i = 0; i < 46; i++) {
    const x = titleHash(i, 1) * w,
      y = titleHash(i, 2) * groundY * 0.5;
    g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + i);
    rect(g, x, y, 2, 2, '#fff6dd');
  }
  g.globalAlpha = 1;
  const mx = w * 0.82 + lx * 0.3,
    my = h * (tall ? 0.22 : 0.14) + ly * 0.3,
    mr = Math.max(18, Math.min(w, h) * 0.055);
  ellipse(g, mx, my, mr * 2.2, mr * 2.2, '#f8efd914');
  ellipse(g, mx, my, mr, mr, '#f8efd9');
  ellipse(g, mx - mr * 0.3, my - mr * 0.2, mr * 0.22, mr * 0.22, '#e3d6b8');
  ellipse(g, mx + mr * 0.25, my + mr * 0.3, mr * 0.15, mr * 0.15, '#e3d6b8');
  for (let i = 0; i < 3; i++) {
    const cx = ((((i * 0.37 + t * 0.012 * (i + 1)) % 1.4) + 1.4) % 1.4 - 0.2) * w + lx * 0.5,
      cy = h * (0.1 + i * 0.09) + ly * 0.5,
      cs = (0.7 + i * 0.25) * Math.max(1, w / 900);
    for (const [ox, oy, r] of [[-38, 4, 26], [0, -6, 34], [40, 4, 24]])
      ellipse(g, cx + ox * cs, cy + oy * cs, r * cs * 1.6, r * cs * 0.75, '#e6a3a240');
  }
  // Gremlins peeking over the roof, drawn first so the building hides their feet.
  for (const [fx, phase, type] of [[0.18, 0, 0], [0.71, 2.1, 3], [0.46, 4.4, 1]]) {
    const peek = reduced ? 0.6 : Math.max(0, Math.sin(t * 0.7 + phase)),
      gs = 0.8 * s;
    gremlin(g, bx + bw * fx, by + 52 * gs - peek * 38 * gs, gs, type, t + phase);
  }
  // The building: facade, side face, roof cap, cross sign.
  rr(g, bx + bw * 0.02, by + 6, bw, bh, 10 * s, '#132a33');
  rr(g, bx, by, bw, bh, 10 * s, gradient(g, bx, by, 0, bh, '#36606d', '#24434f'));
  rect(g, bx, by, bw, 14 * s, '#1d3742');
  rr(g, bx + bw / 2 - 34 * s, by - 46 * s, 68 * s, 46 * s, 8 * s, '#1d3742');
  rect(g, bx + bw / 2 - 7 * s, by - 40 * s, 14 * s, 34 * s, '#ffa48e');
  rect(g, bx + bw / 2 - 17 * s, by - 30 * s, 34 * s, 14 * s, '#ffa48e');
  // The name across the top of the facade, lit.
  const signY = by + 30 * s,
    signSize = Math.max(9, 13 * s);
  ellipse(g, bx + bw / 2, signY - signSize * 0.35, signSize * 6.4, signSize * 0.9, '#ffe7a81c');
  label(g, TITLE_HOSPITAL, bx + bw / 2, signY, signSize, '#f6edd0', 'center');
  // Windows: eight floors, counted from the ground. Macy's (7th floor, room 5) is lit and has
  // company; a few dark ones have eyes. The lobby keeps clear of the entrance.
  const cols = Math.max(4, Math.round(bw / (70 * s))),
    cw = bw / cols,
    rows = TITLE_FLOORS,
    top = by + 40 * s,
    rh = (groundY - 10 * s - top) / rows,
    ww = cw * 0.56,
    wh = rh * 0.62,
    macyCol = Math.floor(cols * 0.3),
    macyRow = rows - TITLE_MACY_FLOOR,
    entry = 70 * s,
    flicker = attract && !reduced ? 0.55 + 0.45 * Math.abs(Math.sin(t * 17) * Math.sin(t * 5.3)) : 1;
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++) {
      const x = bx + col * cw + (cw - ww) / 2,
        y = top + r * rh,
        macy = r === macyRow && col === macyCol,
        lit = macy || titleHash(col, r) > 0.42;
      if (y + wh > groundY - 92 * s && Math.abs(x + ww / 2 - (bx + bw / 2)) < entry * 0.5 + ww * 0.5) continue;
      if (macy) {
        g.globalAlpha = flicker;
        ellipse(g, x + ww / 2, y + wh / 2, ww * 1.1, wh * 1.1, '#ffe7a833');
        rr(g, x, y, ww, wh, 4 * s, '#ffe7a8');
        g.globalAlpha = 1;
        titleSilhouette(g, x, y, ww, wh);
      } else rr(g, x, y, ww, wh, 4 * s, lit ? '#f2c87ad0' : '#14252f');
      rect(g, x, y + wh * 0.48, ww, Math.max(1, 2 * s), '#24434f66');
      if (!lit && titleHash(col + 9, r + 3) > 0.45) titleEyes(g, x + ww / 2, y + wh / 2, ww, t + col * 1.7 + r);
    }
  // Entrance and the glowing EXIT sign.
  const dw = 70 * s,
    dx = bx + bw / 2 - dw / 2,
    glow = reduced ? 0.8 : 0.65 + 0.35 * Math.sin(t * 2.4);
  rr(g, dx, groundY - 62 * s + ly * 0.4, dw, 62 * s, 6 * s, '#0f1f27');
  rect(g, dx + dw / 2 - 1, groundY - 62 * s + ly * 0.4, 2, 62 * s, '#36606d');
  g.globalAlpha = glow;
  ellipse(g, bx + bw / 2, groundY - 76 * s + ly * 0.4, 46 * s, 18 * s, '#5dffa244');
  g.globalAlpha = 1;
  rr(g, bx + bw / 2 - 26 * s, groundY - 86 * s + ly * 0.4, 52 * s, 20 * s, 4 * s, '#1b8a5a');
  label(g, 'EXIT', bx + bw / 2, groundY - 71 * s + ly * 0.4, Math.max(9, 13 * s), '#d4ffe2', 'center');
  // Ground, path and two street lamps.
  rect(g, 0, groundY, w, h - groundY, gradient(g, 0, groundY, 0, h - groundY, '#1a3540', '#0c1a21'));
  rect(g, 0, groundY, w, 3, '#2f5560');
  poly(g, [[dx + 6 * s, groundY], [dx + dw - 6 * s, groundY], [dx + dw + 30 * s, h], [dx - 30 * s, h]], '#22414c');
  for (const fx of [0.08, 0.92]) {
    const x = w * fx + lx;
    rect(g, x - 2, groundY - 120 * s, 4, 120 * s, '#0e1c23');
    ellipse(g, x, groundY - 122 * s, 26 * s, 26 * s, '#ffdf9a33');
    ellipse(g, x, groundY - 122 * s, 7 * s, 7 * s, '#ffe9b8');
  }
  // Attract: a gremlin sprints along the sidewalk.
  if (attract) {
    const run = (((t * 150) % (w + 160)) + w + 160) % (w + 160),
      rx = run - 80;
    gremlin(g, rx, groundY + (h - groundY) * 0.42, 0.9 * s, 2, t * 3);
  }
}

// Macy at her window: the IV stand on the left, her silhouette with the ponytail.
function titleSilhouette(g, x, y, ww, wh) {
  const ink = '#2a2a35',
    u = wh / 40;
  rect(g, x + ww * 0.18, y + wh * 0.18, Math.max(1.5, u), wh * 0.82, ink);
  rect(g, x + ww * 0.1, y + wh * 0.16, ww * 0.18, Math.max(1.5, u), ink);
  rr(g, x + ww * 0.08, y + wh * 0.2, ww * 0.12, wh * 0.18, 2, ink);
  ellipse(g, x + ww * 0.6, y + wh * 0.48, wh * 0.14, wh * 0.15, ink);
  ellipse(g, x + ww * 0.6 - wh * 0.16, y + wh * 0.52, wh * 0.07, wh * 0.16, ink);
  rr(g, x + ww * 0.6 - wh * 0.22, y + wh * 0.66, wh * 0.44, wh * 0.36, wh * 0.12, ink);
  // Her number on the hoodie, when the window is big enough for it to read.
  const size = wh * 0.24;
  if (size >= 6) macyNumber(g, x + ww * 0.6, y + wh * 0.83, size, '#ffe7a8', ink);
}

// A pair of gremlin eyes in a dark window, blinking now and then.
function titleEyes(g, x, y, ww, t) {
  const r = Math.max(2, ww * 0.07),
    shut = !reduced && ((t * 0.9) % 4) > 3.82;
  for (const side of [-1, 1]) {
    if (shut) rect(g, x + side * r * 1.6 - r, y, r * 2, Math.max(1, r * 0.4), '#d7f27a');
    else {
      ellipse(g, x + side * r * 1.6, y, r, r * 1.2, '#d7f27a');
      ellipse(g, x + side * r * 1.6 + r * 0.25, y + r * 0.1, r * 0.4, r * 0.5, '#1b2a10');
    }
  }
}

// ---- Tap the room ----
// On touch screens the floor is the controller: tap to walk there, tap a gremlin to go and hit it (hold
// to keep swinging), flick to dash, tap with two fingers to jump, long-press the floor to hold the
// barf-bag shield up until the finger lifts. TRAP, SHIELD, BRICK, JUMP and EAT stay on screen as buttons.
// state.controls === 'stick' swaps this for the joystick and the full button column. Mice never use it.
const TAP_ARRIVE = 12,
  TAP_SLOP = 12,
  TAP_GREMLIN_RADIUS = 40,
  FLICK_DISTANCE = 40,
  FLICK_SECONDS = 0.25,
  LONG_PRESS_SECONDS = 0.45,
  TWO_FINGER_SECONDS = 0.2,
  TAP_STUCK_SECONDS = 0.6,
  TAP_PREY_GIVE_UP = 3,
  TAP_RIPPLE_SECONDS = 0.45;

// wardTouches: pointerId -> finger. wardGoal: floor point Macy walks to. wardPrey: the gremlin she is after.
let wardTouches = new Map(),
  wardGoal = null,
  wardPrey = null,
  wardGoalBest = Infinity,
  wardStuck = 0,
  wardRipples = [];

function tapScheme() {
  return state.controls !== 'stick';
}

function wardTouchReset() {
  // A finger holding the shield up lets go of it with everything else.
  for (const f of wardTouches.values()) if (f.shield) shieldHold(false);
  wardTouches.clear();
  wardGoal = null;
  wardPrey = null;
}

// The live gremlin nearest a tap, within TAP_GREMLIN_RADIUS of its feet or its body. In the lounge a tap
// on the TV remote counts too: Macy goes over and whacks it.
function wardGremlinAt(p) {
  let best = null,
    bestD = Infinity;
  for (const e of wardFighters()) {
    const d = Math.min(dist(p, e), dist(p, { x: e.x, y: e.y - (e.z || 0) - 32 }));
    if (d < TAP_GREMLIN_RADIUS && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best || wardTvTargetAt(p);
}

function wardSetGoal(p) {
  wardGoal = { x: clamp(p.x, 40, roomWidth() - 40), y: clamp(p.y, 170, 574) };
  wardGoalBest = Infinity;
  wardStuck = 0;
}

// id: pointer id; cx, cy: client coordinates; p: the same point in room coordinates.
// Returns false when the ward is not taking input (the click handler then gets the tap).
function wardTouchDown(id, cx, cy, p) {
  roomDreamWake();
  if (!state.started || state.paused || isModal() || deadDelay > 0) return false;
  const finger = { id, x0: cx, y0: cy, t0: time, moved: false, long: false, kind: 'walk' };
  wardRipples.push({ x: p.x, y: p.y, t: 0 });
  if (wardTouches.size) {
    // Any second finger jumps. A first finger that landed a moment ago was half of the same tap,
    // so its walk is taken back.
    finger.kind = 'jump';
    for (const f of wardTouches.values())
      if (!f.moved && f.kind !== 'jump' && time - f.t0 < TWO_FINGER_SECONDS) {
        f.kind = 'jump';
        wardGoal = f.goalBefore;
        wardPrey = f.preyBefore;
      }
    wardTouches.set(id, finger);
    if (!roomAction('jump')) jump();
    return true;
  }
  finger.goalBefore = wardGoal;
  finger.preyBefore = wardPrey;
  wardTouches.set(id, finger);
  const e = wardGremlinAt(p);
  if (e) {
    finger.kind = 'prey';
    wardPrey = { e, held: true, swings: 0, idle: 0 };
    wardGoal = null;
  } else if (isArcadeRoom(state.room) && !arcadeBlocked() && beaconTapped(p)) finger.kind = 'beacon';
  else {
    wardPrey = null;
    wardSetGoal(p);
  }
  return true;
}

// Dragging steers: once a finger wanders past TAP_SLOP, the goal follows it.
function wardTouchMove(id, cx, cy, p) {
  const f = wardTouches.get(id);
  if (!f || f.kind === 'jump' || f.long) return;
  if (!f.moved && Math.hypot(cx - f.x0, cy - f.y0) > TAP_SLOP) f.moved = true;
  if (!f.moved) return;
  if (f.kind === 'prey' && wardPrey) wardPrey.held = false;
  f.kind = 'walk';
  wardPrey = null;
  wardSetGoal(p);
}

// cancel = true when the pointer was lost; a lost finger never acts.
function wardTouchUp(id, cx, cy, cancel = false) {
  const f = wardTouches.get(id);
  if (!f) return;
  wardTouches.delete(id);
  if (f.kind === 'prey' && wardPrey) wardPrey.held = false;
  if (f.shield) shieldHold(false);
  if (cancel || f.kind === 'jump' || f.long) return;
  const dx = cx - f.x0,
    dy = cy - f.y0,
    d = Math.hypot(dx, dy);
  if (d >= FLICK_DISTANCE && time - f.t0 < FLICK_SECONDS) {
    // A flick dashes that way and then stands still.
    wardGoal = null;
    wardPrey = null;
    player.lastDx = dx / d;
    player.lastDy = dy / d;
    if (!roomAction('dash')) dash();
    return;
  }
  if (f.kind === 'beacon' && !f.moved) tryOpenArcade();
}

function wardAimAt(e, d) {
  wardAim = { dx: ((e.x - player.x) / d) * 65, dy: ((e.y - player.y) / d) * 65 };
}

// One simulation step of the tap scheme. Returns the steering vector for this step.
function wardTouchStep(dt) {
  // A still finger on the floor for LONG_PRESS_SECONDS raises the shield (or uses a hotspot) and holds it.
  for (const f of wardTouches.values())
    if (f.kind === 'walk' && !f.moved && !f.long && wardTouches.size === 1 && time - f.t0 >= LONG_PRESS_SECONDS) {
      f.long = true;
      wardGoal = null;
      if (!roomAction('use')) f.shield = shieldHold(true);
    }
  if (wardPrey) {
    const prey = wardPrey,
      e = prey.e;
    prey.idle += dt;
    if (e.hp <= 0 || e.gone || (!prey.held && (prey.swings > 0 || prey.idle > TAP_PREY_GIVE_UP))) wardPrey = null;
    else {
      // A twist target (the lounge remote) wants her right at the couch, not at arm's length.
      const d = Math.max(1, dist(player, e)),
        range = e.twist ? 40 : 86;
      if (d <= range) {
        const ready = player.attackCd <= 0;
        // The first swing of a tap is a press (the combo counts it); a held finger's repeats are not.
        if (ready && prey.swings === 0) player.pressAt = time;
        wardAimAt(e, d);
        attack();
        wardAim = null;
        if (ready && player.attackCd > 0) {
          prey.swings++;
          prey.idle = 0;
        }
        return { x: 0, y: 0 };
      }
      return { x: (e.x - player.x) / d, y: (e.y - player.y) / d };
    }
  }
  if (!wardGoal) return { x: 0, y: 0 };
  const d = dist(player, wardGoal);
  if (d <= TAP_ARRIVE) {
    wardGoal = null;
    return { x: 0, y: 0 };
  }
  // Furniture in the way: give up once Macy stops getting closer.
  if (d < wardGoalBest - 0.5) {
    wardGoalBest = d;
    wardStuck = 0;
  } else if ((wardStuck += dt) > TAP_STUCK_SECONDS) {
    wardGoal = null;
    return { x: 0, y: 0 };
  }
  return { x: (wardGoal.x - player.x) / d, y: (wardGoal.y - player.y) / d };
}

// Floor layer: the dashed walk line and the goal ring.
function drawWardGoal(g) {
  if (!wardGoal || !player.moving) return;
  g.setLineDash([7, 9]);
  line(g, [[player.x, player.y], [wardGoal.x, wardGoal.y]], '#fff4c8aa', 3);
  g.setLineDash([]);
  g.strokeStyle = '#fff4c8cc';
  g.lineWidth = 2.5;
  g.beginPath();
  g.ellipse(wardGoal.x, wardGoal.y, 14, 5, 0, 0, Math.PI * 2);
  g.stroke();
}

// Top layer: tap ripples and a ring on the gremlin Macy is after.
function drawWardTaps(g) {
  for (const r of wardRipples) {
    const k = r.t / TAP_RIPPLE_SECONDS;
    g.globalAlpha = Math.max(0, 1 - k);
    g.strokeStyle = '#fff4c8';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(r.x, r.y, 8 + k * 26, 0, Math.PI * 2);
    g.stroke();
    r.t += renderDelta;
  }
  g.globalAlpha = 1;
  wardRipples = wardRipples.filter(r => r.t < TAP_RIPPLE_SECONDS);
  if (!wardPrey) return;
  const e = wardPrey.e;
  g.strokeStyle = '#ffb19c';
  g.lineWidth = 2.5;
  g.setLineDash([5, 6]);
  g.lineDashOffset = reduced ? 0 : -time * 22;
  g.beginPath();
  g.ellipse(e.x, e.y, 30, 10, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.lineDashOffset = 0;
}

function updateWorld(dt) {
  time += dt;
  player.visualDir =
    (player.visualDir ?? player.dir) +
    (player.dir - (player.visualDir ?? player.dir)) * (1 - Math.exp(-dt * 16));
  // Poses run on their own clock, so the medal grin plays out on the result screen too.
  macyPoseTick(dt);
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
  if (mini.open) {
    updateMini(dt);
    return;
  }
  if (isModal() || state.paused) return;
  if (typeof updateDream === 'function' && updateDream(dt)) return;
  // The send-off (src/discharge.js) owns the frame while it plays.
  if (typeof updateDischarge === 'function' && updateDischarge(dt)) return;
  for (let k of [
    'inv',
    'shield',
    'attack',
    'attackCd',
    'dash',
    'dashCd',
    'vomit',
    'eat',
    'comboTime'
  ])
    player[k] = Math.max(0, player[k] - dt);
  shake = Math.max(0, shake - dt);
  if (deadDelay > 0) {
    deadDelay -= dt;
    updateEffects(dt);
    if (deadDelay <= 0) {
      state.hp = 0;
      openMini(0, true);
    }
    return;
  }
  if (!state.started) return;
  if (hitStop > 0) {
    hitStop -= dt;
    return;
  }
  const steer = wardTouchStep(dt);
  let dx =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0) +
      joy.x +
      steer.x,
    dy =
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0) +
      joy.y +
      steer.y;
  let len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  player.moving = len > 0.05;
  if (player.moving) {
    player.lastDx = dx;
    player.lastDy = dy;
    if (Math.abs(dx) > 0.1) player.dir = dx > 0 ? 1 : -1;
    player.walk += dt * 13;
  } else player.walk = 0;
  let speed = player.vomit > 0.5 ? 95 : 205;
  if (player.dash > 0) {
    dx = player.lastDx;
    dy = player.lastDy;
    speed = 530;
  }
  // Her footing follows the stick at once, except on slippery floor (the ultrasound gel), where it only
  // catches up at the floor's grip per second: she slides past where she meant to stop. A dash always bites.
  const grip = player.dash > 0 ? 0 : wardGrip(player);
  if (grip > 0) {
    const k = 1 - Math.exp(-dt * grip);
    player.vx += (dx * speed - player.vx) * k;
    player.vy += (dy * speed - player.vy) * k;
  } else {
    player.vx = dx * speed;
    player.vy = dy * speed;
  }
  moveEntity(player, player.vx * dt, player.vy * dt);
  if (keys.has(' ') || heldAttack) attack();
  updateCombat(dt);
  if (typeof updateRoomExtras === 'function') updateRoomExtras(dt);
  macyReactions();
  wardHpSeen = state.hp;
  for (let s of supplies.filter(supplyAvailable))
    if (dist(s, player) < 27 && state.food < maxFood()) {
      state.taken.push(s.id);
      state.food++;
      floating('+1 ' + s.type.toUpperCase(), s.x, s.y - 50, '#b7e6bd');
      toast(
        wardCoarsePointer
          ? 'Nutrient stashed. Tap EAT when you need a heart.'
          : 'Nutrient stashed. Drink / eat (F) when you need a heart.',
        2.7
      );
      save();
      hud();
      sfx('pickup');
    }
  wardPickups(dt);
  // The "MAP →" corner: out to the hallway when it exists, else the map.
  if (player.x > roomWidth() - 105 && player.y < 202) {
    player.y = 225;
    if (typeof hallwayEnter === 'function') hallwayEnter(state.room);
    else openMap();
  }
  updateEffects(dt);
  macyIdleStep(dt);
  tvTick(dt);
  roomOpinionsTick(dt);
  turnHintTick();
  $('dashBtn').style.opacity = player.dashCd > 0 ? '.45' : '1';
}

function updateEffects(dt) {
  for (let p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (let f of floats) {
    f.life -= dt;
    f.y -= dt * 30;
  }
  floats = floats.filter(f => f.life > 0);
  for (let p of puddles) p.life -= dt;
  puddles = puddles.filter(p => p.life > 0);
  for (let t of traps) t.life -= dt;
  traps = traps.filter(t => t.life > 0);
}

// The arcade beacon on the floor: LOCKED until the ward is cleared, then a pulsing ring.
function drawBeacon() {
  const station = rooms[state.room].station,
    near = dist(player, { x: station[0], y: station[1] }) < 65,
    locked = arcadeBlocked();
  ellipse(c, ...station, 48, 17, locked ? '#6a3a4a55' : '#285f6266');
  c.strokeStyle = locked ? '#f0a7a0' : '#b9ebbb';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(station[0], station[1], 43 + (locked ? 0 : Math.sin(time * 3) * 2), 14, 0, 0, Math.PI * 2);
  c.stroke();
  if (!locked) spark(c, station[0], station[1] - 50 + Math.sin(time * 3) * 4, '#ffe29b', 1);
  label(
    c,
    locked ? 'LOCKED' : near ? (wardCoarsePointer ? 'TAP TO PLAY' : 'ENTER / PLAY') : 'ARCADE',
    station[0],
    station[1] + 31,
    12,
    locked ? '#7a2f45' : '#244d53',
    'center'
  );
}

function drawWorld() {
  const vw = viewport.w,
    vh = viewport.h,
    ease = 1 - Math.exp(-renderDelta * 12);
  syncWardPause();
  c.clearRect(0, 0, vw, vh);
  cameraX += (clamp(player.x - vw / 2, 0, Math.max(0, roomWidth() - vw)) - cameraX) * ease;
  // Screens wider than 1.6 show a horizontal slice of the room and follow Macy vertically. A tall
  // portrait view (taller than the room) centers it, with a band above and below.
  const camYGoal = vh > 625 ? -(vh - 625) / 2 : clamp(player.y - vh * 0.58, 0, 625 - vh);
  wardCameraY += (camYGoal - wardCameraY) * ease;
  c.save();
  c.translate(-cameraX + (shake ? rand(-3, 3) : 0), -wardCameraY + (shake ? rand(-2, 2) : 0));
  roomBg(c, state.room);
  roomWallLayer(c);
  for (let p of puddles) {
    if (p.gunk) continue;
    c.globalAlpha = Math.min(1, p.life);
    ellipse(c, p.x, p.y, 30, 8, '#8da744');
    ellipse(c, p.x - 4, p.y - 2, 18, 4, '#b4c969');
  }
  c.globalAlpha = 1;
  if (typeof drawCombatGround === 'function') drawCombatGround(c);
  if (isArcadeRoom(state.room) && rooms[state.room].station) drawBeacon();
  for (let s of supplies.filter(supplyAvailable)) {
    ellipse(c, s.x, s.y, 20, 7, '#e7eea855');
    nutrient(c, s.x, s.y + Math.sin(time * 3) * 3, s.type, 1.2);
    spark(c, s.x + 15, s.y - 35, '#fff0ad', 0.4);
  }
  drawWardDrops(c);
  for (let tr of traps) {
    brick(c, tr.x - 15, tr.y, '#e38878');
    brick(c, tr.x + 2, tr.y + 5, '#6faeab');
  }
  drawWardGoal(c);
  const renderables = (roomProps[state.room] || []).map(p => ({ y: p.y, draw: p.draw }));
  renderables.push(...roomCultRenderables());
  const snack = snackRenderable();
  if (snack) renderables.push(snack);
  // Combat's floor pieces: bricks to find, the MRI's bedpans, the CT donut, the lounge remote.
  renderables.push(...wardRenderables());
  if (typeof roomExtraRenderables === 'function') renderables.push(...(roomExtraRenderables() || []));
  renderables.push({
    y: player.y,
    draw: g => {
      if (player.z > 0) shadow(g, player.x, player.y, 22, 6);
      if (player.shield > 0) {
        // The bubble thins out as its meter runs down.
        const left = clamp((player.shieldMeter || 0) / wardShieldCap(), 0, 1);
        ellipse(g, player.x, player.y - 37 * MACY_TALL, 43 * MACY_TALL, 56 * MACY_TALL, '#ace8b047');
        g.strokeStyle = left < 0.3 && !reduced && Math.sin(time * 30) > 0 ? '#ffffff' : '#c1f2cc';
        g.lineWidth = 1.5 + 3 * left;
        g.beginPath();
        g.ellipse(player.x, player.y - 37 * MACY_TALL, 43 * MACY_TALL, 56 * MACY_TALL, 0, 0, Math.PI * 2);
        g.stroke();
      }
      if (player.dash > 0) {
        g.globalAlpha = 0.2;
        girl(g, player.x - player.lastDx * 26, player.y - player.lastDy * 26, MACY_SCALE, player.walk, player.dir);
        g.globalAlpha = 1;
      }
      g.save();
      g.translate(player.x, player.y - player.z);
      if (player.z > 0) g.rotate(player.dir * -0.12);
      if (player.vomit > 0.3) g.rotate(player.dir * 0.12);
      girl(
        g,
        0,
        0,
        MACY_SCALE,
        player.walk,
        player.visualDir ?? player.dir,
        player.inv > 0 && player.vomit <= 0,
        player.z <= 0,
        macyAct()
      );
      g.restore();
      vomitArt(g, player.x, player.y - player.z, player.dir, player.vomit, MACY_SCALE);
      if (player.eat > 0) {
        nutrient(g, player.x + player.dir * 15 * MACY_TALL, player.y - 48 * MACY_TALL, 'shake', 0.9 * MACY_TALL);
        heart(g, player.x - 10, player.y - 110 * MACY_TALL, 1.3, '#f3a08f');
      }
      if (player.attack > 0) {
        drawPillowSwing(g, player);
      }
      if (state.name) label(g, state.name, player.x, player.y - 106 * MACY_TALL - player.z, 10, '#325a58', 'center');
    }
  });
  enemies.forEach(e => renderables.push({ y: e.y, draw: g => drawEnemy(g, e) }));
  renderables.sort((a, b) => a.y - b.y).forEach(o => o.draw(c));
  for (let p of projectiles) {
    let z = p.kind === 'brick' ? Math.sin(Math.min(1, p.age / 0.85) * Math.PI) * 70 : 0;
    shadow(c, p.x, p.y + 32, 9, 3);
    if (p.kind === 'brick') {
      c.save();
      c.translate(p.x, p.y - z);
      c.rotate(p.age * 9);
      brick(c, -14, 5, '#ed9d87');
      c.restore();
    } else {
      ellipse(c, p.x - p.vx * 0.035, p.y - p.vy * 0.035, 12, 6, p.friendly ? '#ffe7a488' : '#b2c65f88');
      ellipse(c, p.x, p.y, 9, 8, p.friendly ? '#ffe394' : '#b9d56b');
    }
  }
  if (wardAim && Math.hypot(wardAim.dx, wardAim.dy) > 8) {
    const a = aimDirection();
    c.setLineDash([7, 8]);
    line(c, [[player.x, player.y - 32], [player.x + a.x * 180, player.y - 32 + a.y * 180]], '#fff4c8bb', 3);
    c.setLineDash([]);
  }
  for (let p of particles) {
    c.globalAlpha = Math.min(1, p.life * 2);
    rect(c, p.x, p.y, p.size, p.size, p.col);
  }
  c.globalAlpha = 1;
  for (let f of floats) {
    c.globalAlpha = Math.min(1, f.life * 2);
    if (f.lines || String(f.text).includes('\n')) floatLines(c, f);
    else {
      label(c, f.text, f.x + 1, f.y + 1, 12, '#244656', 'center');
      label(c, f.text, f.x, f.y, 12, f.col, 'center');
    }
  }
  c.globalAlpha = 1;
  // The machines' bubbles first, so a hotspot's prompt is never hidden under one.
  drawRoomOpinions(c);
  drawRoomSpotPrompt(c);
  if (typeof drawCombatFx === 'function') drawCombatFx(c);
  drawWardTaps(c);
  rect(c, 0, 603, roomWidth(), 22, '#244856');
  rect(c, 24, 603, roomWidth() - 48, 4, '#90b6a2');
  c.restore();
  if (typeof drawRoomOverlay === 'function') drawRoomOverlay(c, vw, vh);
  if (typeof drawCombatOverlay === 'function') drawCombatOverlay(c, vw);
  drawRoomLightsFade(vw, vh);
  if (state.paused) rect(c, 0, 0, vw, vh, '#102734aa');
  if (wardIris > 0) drawRoomIris(vw, vh);
  const dreaming = typeof dreamActive === 'function' && dreamActive();
  // DOM overlays (hearts, coins, toasts) step out of the way while she dreams.
  if (document.body && document.body.classList) document.body.classList.toggle('dreaming', dreaming);
  if (dreaming) drawDream(c, vw, vh);
  const discharging = typeof dischargeActive === 'function' && dischargeActive();
  if (document.body && document.body.classList) document.body.classList.toggle('discharging', discharging);
  if (discharging) drawDischarge(c, vw, vh);
}

// A 250 ms iris opens on Macy after each room change (skipped under reduced motion).
function drawRoomIris(vw, vh) {
  const t = 1 - wardIris / ROOM_IRIS_SECONDS,
    r = Math.max(1, t * t * Math.hypot(vw, vh));
  wardIris = Math.max(0, wardIris - renderDelta);
  c.save();
  c.beginPath();
  c.rect(0, 0, vw, vh);
  c.arc(player.x - cameraX, player.y - 45 * MACY_TALL - wardCameraY, r, 0, Math.PI * 2, true);
  c.fillStyle = '#0b1b25';
  c.fill('evenodd');
  c.restore();
}

// World coordinates of a pointer on the ward canvas.
function wardPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: cameraX + ((e.clientX - r.left) * viewport.w) / Math.max(1, r.width),
    y: wardCameraY + ((e.clientY - r.top) * viewport.h) / Math.max(1, r.height)
  };
}

// Tapping the beacon is the touch version of Enter.
function beaconTapped(p) {
  if (!isArcadeRoom(state.room) || !rooms[state.room].station) return false;
  const [x, y] = rooms[state.room].station;
  return Math.abs(p.x - x) < 70 && p.y > y - 85 && p.y < y + 45;
}

// The map dialog's floor plan (src/map.js). Every caller keeps calling renderMap(); the plan mounts
// while the dialog is open (it measures the dialog), so openMap opens first.
function renderMap() {
  if ($('mapDialog').open && typeof mountHospitalMap === 'function') mountHospitalMap($('mapGrid'));
}

function openMap() {
  hud();
  modalOpen($('mapDialog'));
  renderMap();
}

function goRoom(id) {
  if (mini.open) return;
  $$('dialog[open]').forEach(d => d.close());
  state.paused = false;
  if (!state.started) begin();
  loadRoom(id);
  canvas.focus({ preventScroll: true });
  $('stage').scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' });
}

function buildDepartments() {
  $('departmentGrid').innerHTML = rooms
    .filter(r => isArcadeRoom(r.id))
    .map(
      r =>
        `<button class="dept-card" data-room="${r.id}" aria-label="Explore ${r.name}">` +
        `<canvas width="260" height="135" data-mini="${r.id}"></canvas><div class="dept-copy"><div>` +
        `<span>0${r.id + 1} / 3 LEVELS</span><span>PLAY ↗</span></div>` +
        `<h3>${games[r.id].info.game}</h3>` +
        `<p>${r.name} · ${games[r.id].info.genre.toLowerCase()}</p></div></button>`
    )
    .join('');
  $$('[data-mini]').forEach(cv => miniScene(cv.getContext('2d'), +cv.dataset.mini, 260, 135));
}

// Frame loop and canvas sizing.
const viewport = { w: 1000, h: 625, dpr: Math.min(2, window.devicePixelRatio || 1) };

let renderDelta = 1 / 60,
  frameCount = 0,
  fpsStart = 0;

function configureCanvas(cv, w, h) {
  const d = viewport.dpr;
  cv.width = Math.ceil(w * d);
  cv.height = Math.ceil(h * d);
  const ctx = cv.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function setupIllustrations() {
  configureCanvas($('miniPreview'), 420, 240);
  configureCanvas($('resultArt'), 800, 220);
  $$('[data-mini]').forEach(cv => {
    configureCanvas(cv, 260, 135);
    miniScene(cv.getContext('2d'), +cv.dataset.mini, 260, 135);
  });
}

// HUD card size bucket: the cards must end above WALL_SIGN_TOP at the current canvas scale.
function hudBucket(px) {
  return px >= 52 ? 'l' : px >= 36 ? 'm' : px >= 28 ? 's' : 'xs';
}

// ---- Turn your phone ----
// A phone held upright gets one gentle hint, once per save (state.stats.turnHint): the ward plays best
// sideways. It is a pill over the room for a few seconds, never a block; turning the phone or ✕ clears it.
const TURN_HINT_SECONDS = 8,
  TURN_HINT_TEXT = 'Turn your phone sideways for the ward. Bigger room, bigger buttons.';

let turnHintUntil = 0;

function turnHintCheck() {
  if (!wardCoarsePointer || !state.started || mini.open || (state.stats && state.stats.turnHint)) return false;
  const w = window.innerWidth || 0,
    h = window.innerHeight || 0;
  if (!(w > 0 && h > w && w < 600)) return false;
  (state.stats ||= {}).turnHint = 1;
  save();
  turnHintUntil = time + TURN_HINT_SECONDS;
  const text = $('turnHint').querySelector('span');
  if (text) text.textContent = TURN_HINT_TEXT;
  document.body.classList.add('turn-hint-on');
  return true;
}

function turnHintHide() {
  turnHintUntil = 0;
  document.body.classList.remove('turn-hint-on');
}

function turnHintTick() {
  if (!turnHintUntil) return;
  const w = window.innerWidth || 0,
    h = window.innerHeight || 0;
  if (time >= turnHintUntil || (w > 0 && w > h)) turnHintHide();
}

// A tall phone still sees at least this much of the room's 1000 px width.
const WARD_MIN_VIEW_W = 540;

function resize() {
  const r = $('stage').getBoundingClientRect();
  if (r.width > 0 && r.height > 0) {
    const aspect = r.width / r.height;
    viewport.w = clamp(625 * aspect, WARD_MIN_VIEW_W, 1000);
    viewport.h = viewport.w < 1000 ? Math.max(625, viewport.w / aspect) : clamp(1000 / aspect, 300, 625);
    // Cards end above the wall signs; a centered tall view moves the signs down by its top band.
    const band = Math.max(0, viewport.h - 625) / 2;
    $('stage').dataset.hud = hudBucket(((WALL_SIGN_TOP - 4 + band) * r.height) / viewport.h);
  }
  configureCanvas(canvas, viewport.w, viewport.h);
  // An open arcade re-reads the screen shape (a portrait canvas flips in and out as the phone turns).
  // A closed one keeps the 800 × 450 canvas it starts with.
  if (mini.open) orientMini();
  else configureCanvas($('miniCanvas'), 800, 450);
  if (titleUp) titleFit();
  turnHintCheck();
}

// Fixed small simulation steps keep 30, 60 and 120 Hz displays moving identically.
function advanceSimulation(dt) {
  dt = clamp(dt, 0, 0.05);
  const n = Math.max(1, Math.ceil(dt * 120));
  for (let i = 0; i < n; i++) updateWorld(dt / n);
}

function animateFrame(now) {
  renderDelta = Math.min(0.05, (now - last) / 1000 || 1 / 60);
  last = now;
  titleTick(renderDelta);
  advanceSimulation(renderDelta);
  // The title covers the ward; the room only draws again once the iris starts opening.
  if (titleUp) drawTitle();
  if (!titleUp || titleLeaving > 0) drawWorld();
  if (mini.open) {
    drawMini();
    if (mini.screen === 'result' && gore.length) drawResultArt();
  }
  frameCount++;
  if (!fpsStart) fpsStart = now;
  if (now - fpsStart >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - fpsStart));
    canvas.dataset.fps = String(fps);
    $('playStatus').textContent =
      fps + ' fps · ' + (state.started ? 'EXPLORE / PLAY / GET HOME' : 'READY WHEN YOU ARE');
    frameCount = 0;
    fpsStart = now;
  }
  requestAnimationFrame(animateFrame);
}
