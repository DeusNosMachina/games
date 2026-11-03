// Stickers and share cards. A sticker is an achievement with a drawn badge: STICKERS is the table,
// stickerCheck() awards them (once a second from its own frame loop, and on every arcade result),
// a badge pop announces each new one, and #stickerDialog is the sheet. Share cards are 1080 × 1350
// PNGs of a result or a sticker, drawn with the art primitives so they render fully offline.
//
// Counters live in state.stats (other files keep most of them). This file writes five of its own,
// all plain numbers: days and lastDay (YYYYMMDD) here, and flawless, ivClutch and recovered from the
// arcade result in minigames.js.

state.stats ||= {};
state.stickers ||= [];

const STICKER_POP_SECONDS = 2.6,
  STICKER_POP_GAP = 0.3,
  STICKER_POP_BUNDLE = 3,
  STICKER_DAYS = 5,
  // Everyone Macy can talk to in the hallway. Nurses count as one (there are several, all named).
  STICKER_CAST = ['dad', 'brother', 'grandma', 'grandpa', 'kenzie', 'bri', 'doctor', 'nurse', 'barb', 'rowdy'];

const stickerStat = (st, key) => Math.max(0, Number(st && st.stats && st.stats[key]) || 0),
  stickerMedals = st => (Array.isArray(st && st.medals) ? st.medals.slice(0, ARCADE_COUNT) : []),
  stickerAllArcades = (st, ok) => {
    const m = stickerMedals(st);
    return m.length === ARCADE_COUNT && m.every(row => Array.isArray(row) && ok(row));
  },
  stickerAnyMedal = (st, ok) => stickerMedals(st).some(row => Array.isArray(row) && row.some(ok)),
  stickerClears = (st, id) => Math.max(0, Number(st && Array.isArray(st.wardClears) && st.wardClears[id]) || 0),
  stickerStars = st => stickerMedals(st).flat().reduce((a, b) => a + (Number(b) || 0), 0),
  stickerHas = (list, ids) => Array.isArray(list) && ids.every(id => list.includes(id));

// How many of the hallway cast Macy has talked to. Reads state.stats.talked (or talkedTo, or talks)
// as a list of ids or an {id: count} map; a plain number counts conversations instead.
function stickerTalkedCount(st) {
  const stats = (st && st.stats) || {},
    raw = stats.talked ?? stats.talkedTo ?? stats.talks;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  let ids = [];
  if (Array.isArray(raw)) ids = raw;
  else if (raw && typeof raw === 'object') ids = Object.keys(raw).filter(k => raw[k]);
  const seen = new Set(ids.map(id => (/^nurse/.test(String(id)) ? 'nurse' : String(id))));
  return STICKER_CAST.filter(id => seen.has(id)).length;
}

// The sticker table. tone is mint, coral or yellow; shape is round or shield; icon names a painter in
// STICKER_ICONS (arg is passed to it). blurb is the earned line; hint says how to earn it.
const STICKERS = [
  {
    id: 'first-medal',
    group: 'Arcade',
    name: 'Fridge-Worthy',
    blurb: 'First medal. The fridge has been notified.',
    hint: 'Win any arcade run.',
    tone: 'mint',
    shape: 'round',
    icon: 'medal',
    arg: 1,
    test: st => stickerAnyMedal(st, m => m > 0)
  },
  {
    id: 'first-gold',
    group: 'Arcade',
    name: 'Solid Gold Patient',
    blurb: 'First gold. Ralph has requested a recount.',
    hint: 'Get a gold medal anywhere.',
    tone: 'yellow',
    shape: 'round',
    icon: 'medal',
    arg: 3,
    test: st => stickerAnyMedal(st, m => m === 3)
  },
  {
    id: 'gold-everywhere',
    group: 'Arcade',
    name: 'Midas Touch, Medically',
    blurb: 'Gold in all six arcades. The gift shop wants an autograph.',
    hint: 'Get gold in every arcade.',
    tone: 'yellow',
    shape: 'shield',
    icon: 'crown',
    test: st => stickerAllArcades(st, row => row.includes(3))
  },
  {
    id: 'code-brown',
    group: 'Arcade',
    name: 'Code Brown Survivor',
    blurb: 'A level 3 medal in every arcade. Nobody explains Code Brown. Nobody needs to.',
    hint: 'Earn a level 3 medal in all six arcades.',
    tone: 'coral',
    shape: 'shield',
    icon: 'three',
    test: st => stickerAllArcades(st, row => row[2] > 0)
  },
  {
    id: 'twelve-stars',
    group: 'Arcade',
    name: 'Twelve Star General',
    blurb: 'Twelve discharge stars. The passport is getting heavy.',
    hint: 'Earn 12 discharge stars.',
    tone: 'mint',
    shape: 'round',
    icon: 'star',
    arg: '12',
    test: st => stickerStars(st) >= 12
  },
  {
    id: 'chain-10',
    group: 'Arcade',
    name: 'Spike of the Week',
    blurb: 'A 10 chain. Pure volleyball energy, minus the net.',
    hint: 'Land a 10 chain in any arcade.',
    tone: 'mint',
    shape: 'round',
    icon: 'volleyball',
    test: st => (Number(st && st.bestChain) || 0) >= 10
  },
  {
    id: 'chain-25',
    group: 'Arcade',
    name: 'Grand Slam Chain',
    blurb: 'Twenty-five in a row. The dugout is losing its mind.',
    hint: 'Land a 25 chain in any arcade.',
    tone: 'coral',
    shape: 'round',
    icon: 'softball',
    test: st => (Number(st && st.bestChain) || 0) >= 25
  },
  {
    id: 'flawless',
    group: 'Arcade',
    name: 'Not a Scratch',
    blurb: 'A whole run with zero oops. Suspiciously competent.',
    hint: 'Win a run without a single oops or strike.',
    tone: 'mint',
    shape: 'shield',
    icon: 'sparkle',
    test: st => stickerStat(st, 'flawless') > 0
  },
  {
    id: 'iv-clutch',
    group: 'Arcade',
    name: 'Three-Strike Survivor',
    blurb: 'Climbed out of a recovery on two strikes. Heart rate: also two strikes.',
    hint: 'Win a mandatory IV recovery with two strikes on the board.',
    tone: 'coral',
    shape: 'shield',
    icon: 'ivbag',
    test: st => stickerStat(st, 'ivClutch') > 0
  },
  {
    id: 'frequent-flyer',
    group: 'Arcade',
    name: 'Frequent Flyer',
    blurb: 'Five IV recoveries. The bed has your shape memorized.',
    hint: 'Climb out of bed after five collapses.',
    tone: 'yellow',
    shape: 'round',
    icon: 'bed',
    test: st => stickerStat(st, 'recovered') >= 5 || (Number(st && st.recoveries) || 0) >= 5
  },
  {
    id: 'arcade-rat',
    group: 'Arcade',
    name: 'Arcade Rat',
    blurb: 'Fifty arcade runs. The machines know your footsteps.',
    hint: 'Play 50 arcade runs.',
    tone: 'mint',
    shape: 'round',
    icon: 'joystick',
    test: st => (Number(st && st.runs) || 0) >= 50
  },
  {
    id: 'evict-100',
    group: 'Ward',
    name: 'Eviction Notice',
    blurb: 'A hundred gremlins shown the door. Some of them took the door.',
    hint: 'Evict 100 gremlins in the wards.',
    tone: 'mint',
    shape: 'shield',
    icon: 'gremlin',
    arg: 0,
    test: st => (Number(st && st.evictions) || 0) >= 100
  },
  {
    id: 'evict-500',
    group: 'Ward',
    name: 'Landlord From Heck',
    blurb: 'Five hundred evicted. The security deposit is not coming back.',
    hint: 'Evict 500 gremlins.',
    tone: 'coral',
    shape: 'shield',
    icon: 'gremlin',
    arg: 1,
    test: st => (Number(st && st.evictions) || 0) >= 500
  },
  {
    id: 'ward-mri',
    group: 'Ward',
    name: 'Donut Whisperer',
    blurb: 'MRI room cleared. The loud donut is quiet now.',
    hint: 'Clear the MRI room ward.',
    tone: 'mint',
    shape: 'round',
    icon: 'donut',
    arg: 0,
    test: st => stickerClears(st, 1) > 0
  },
  {
    id: 'ward-lounge',
    group: 'Ward',
    name: 'Lounge Lizard',
    blurb: 'Family lounge cleared. The vending machine owes you one.',
    hint: 'Clear the Family lounge ward.',
    tone: 'coral',
    shape: 'round',
    icon: 'brick',
    test: st => stickerClears(st, 2) > 0
  },
  {
    id: 'ward-ct',
    group: 'Ward',
    name: 'Drift Queen of CT',
    blurb: 'CT scan cleared. Donut drifting may resume.',
    hint: 'Clear the CT scan ward.',
    tone: 'yellow',
    shape: 'round',
    icon: 'donut',
    arg: 1,
    test: st => stickerClears(st, 3) > 0
  },
  {
    id: 'ward-ultrasound',
    group: 'Ward',
    name: 'Sonogram Sheriff',
    blurb: 'Ultrasound cleared. It’s a... clean room!',
    hint: 'Clear the Ultrasound ward.',
    tone: 'mint',
    shape: 'round',
    icon: 'wave',
    test: st => stickerClears(st, 4) > 0
  },
  {
    id: 'grudge-3',
    group: 'Ward',
    name: 'Holds a Grudge',
    blurb: 'Grudge level 3 in one ward. The gremlins wrote your name down too.',
    hint: 'Clear any one ward three times.',
    tone: 'coral',
    shape: 'shield',
    icon: 'flame',
    test: st => [1, 2, 3, 4].some(id => stickerClears(st, id) >= 3)
  },
  {
    id: 'ralph-who',
    group: 'Ward',
    name: 'Ralph Who?',
    blurb: 'Ralph evicted. He left a one-star review on his way out.',
    hint: 'Beat Ralph.',
    tone: 'yellow',
    shape: 'shield',
    icon: 'ralph',
    test: st => !!(st && st.ralph)
  },
  {
    id: 'discharged',
    group: 'Ward',
    name: 'Discharged With Honors',
    blurb: 'Passport complete. Home is the next level.',
    hint: 'Get discharged.',
    tone: 'mint',
    shape: 'shield',
    icon: 'house',
    test: st => !!(st && st.won)
  },
  {
    id: 'dad-10',
    group: 'Hallway',
    name: 'Groan Tolerance',
    blurb: 'Survived ten Dad jokes. Barely.',
    hint: 'Hear 10 of Dad’s jokes in the hallway.',
    tone: 'yellow',
    shape: 'round',
    icon: 'haha',
    arg: 'HA',
    test: st => stickerStat(st, 'dadJokes') >= 10
  },
  {
    id: 'dad-50',
    group: 'Hallway',
    name: 'Dad Joke Immunity',
    blurb: 'Fifty Dad jokes and still standing. Science is baffled.',
    hint: 'Hear 50 Dad jokes.',
    tone: 'coral',
    shape: 'shield',
    icon: 'haha',
    arg: 'HA!',
    test: st => stickerStat(st, 'dadJokes') >= 50
  },
  {
    id: 'ensure-5',
    group: 'Hallway',
    name: 'Hard Pass',
    blurb: 'Turned down Ensure five times. Barb is taking it personally.',
    hint: 'Refuse Barb’s Ensure 5 times.',
    tone: 'mint',
    shape: 'round',
    icon: 'ensure',
    test: st => stickerStat(st, 'ensureRefused') >= 5
  },
  {
    id: 'ensure-20',
    group: 'Hallway',
    name: 'Ensure-ly Not',
    blurb: 'Twenty refusals. Barb has started a support group.',
    hint: 'Refuse 20 Ensures.',
    tone: 'coral',
    shape: 'shield',
    icon: 'ensure',
    test: st => stickerStat(st, 'ensureRefused') >= 20
  },
  {
    id: 'rowdy-fan',
    group: 'Hallway',
    name: 'Rowdy’s Number One Fan',
    blurb: 'Watched ten Rowdy cheers. We are... RAMSEY!',
    hint: 'Watch Rowdy cheer 10 times.',
    tone: 'yellow',
    shape: 'round',
    icon: 'rowdy',
    test: st => stickerStat(st, 'cheers') >= 10
  },
  {
    id: 'socialite',
    group: 'Hallway',
    name: 'Hallway Socialite',
    blurb: 'Talked to everyone in the hallway. Even the nurses know your name now.',
    hint: 'Talk to everyone in the hallway.',
    tone: 'mint',
    shape: 'round',
    icon: 'bubbles',
    // The hallway sets stats.metEveryone once every cast member has a get-well card.
    test: st => !!(st && st.stats && st.stats.metEveryone) || stickerTalkedCount(st) >= STICKER_CAST.length
  },
  {
    id: 'cat-cam',
    group: 'Hallway',
    name: 'Cat Cam Addict',
    blurb: 'Checked the cat cam five times. The cat did not check back.',
    hint: 'Watch the cat cam 5 times.',
    tone: 'coral',
    shape: 'round',
    icon: 'cat',
    test: st => stickerStat(st, 'catCam') >= 5
  },
  {
    id: 'pillow-fort',
    group: 'Hallway',
    name: 'Pillow Fort Champion',
    blurb: 'Let Macy chill ten times. Resting is a competitive sport.',
    hint: 'Leave Macy idle until she gets bored, 10 times.',
    tone: 'mint',
    shape: 'round',
    icon: 'pillow',
    test: st => stickerStat(st, 'idles') >= 10
  },
  {
    id: 'mogul',
    group: 'Life',
    name: 'Pocket Money Mogul',
    blurb: 'A thousand lifetime coins. None of it for medical bills.',
    hint: 'Earn 1,000 coins in all.',
    tone: 'yellow',
    shape: 'round',
    icon: 'coins',
    test: st => (Number(st && st.coinsEarned) || 0) >= 1000
  },
  {
    id: 'gift-shop-royalty',
    group: 'Life',
    name: 'Gift Shop Royalty',
    blurb: 'Bought every upgrade. The gift shop named a mug after you.',
    hint: 'Buy every upgrade in the gift shop.',
    tone: 'coral',
    shape: 'shield',
    icon: 'bag',
    test: st => stickerHas(st && st.upgrades, SHOP_UPGRADE_IDS)
  },
  {
    id: 'fit-check',
    group: 'Life',
    name: 'Full Fit Check',
    blurb: 'Every look at once. Fashion, but make it hospital.',
    hint: 'Wear all three looks at the same time.',
    tone: 'mint',
    shape: 'shield',
    icon: 'hoodie',
    test: st => stickerHas(st && st.cosmetics && st.cosmetics.worn, SHOP_LOOK_IDS)
  },
  {
    id: 'daily-3',
    group: 'Life',
    name: 'Daily Dose Regular',
    blurb: 'Three days in a row. That’s a habit now.',
    hint: 'Keep a 3-day Daily Dose streak.',
    tone: 'mint',
    shape: 'round',
    icon: 'calendar',
    arg: '3',
    test: st => (Number(st && st.daily && st.daily.streak) || 0) >= 3
  },
  {
    id: 'daily-7',
    group: 'Life',
    name: 'Prescription Strength',
    blurb: 'A seven-day streak. The pharmacist is impressed.',
    hint: 'Keep a 7-day Daily Dose streak.',
    tone: 'coral',
    shape: 'shield',
    icon: 'calendar',
    arg: '7',
    test: st => (Number(st && st.daily && st.daily.streak) || 0) >= 7
  },
  {
    id: 'regular',
    group: 'Life',
    name: 'Regular Patient',
    blurb: 'Played on five different days. The nurses saved your seat.',
    hint: 'Play on 5 different days.',
    tone: 'yellow',
    shape: 'round',
    icon: 'sun',
    arg: '5',
    test: st => stickerStat(st, 'days') >= STICKER_DAYS
  }
];

const STICKER_GROUPS = ['Arcade', 'Ward', 'Hallway', 'Life'];

const stickerById = id => STICKERS.find(s => s.id === id) || null,
  stickerEarned = id => Array.isArray(state.stickers) && state.stickers.includes(id);

// ---- Awarding ----
// The local date as YYYYMMDD, a plain number so it saves as a counter.
function stickerDayNumber(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// Counts the day once, the first time a check runs on it while Macy is out of the title screen.
function stickerMarkDay() {
  if (!state.started) return false;
  const today = stickerDayNumber();
  if (state.stats.lastDay === today) return false;
  state.stats.lastDay = today;
  state.stats.days = stickerStat(state, 'days') + 1;
  return true;
}

// A won arcade run (minigames.js calls this from the result): flawless wins, IV wins on two
// strikes, and finished recoveries are lifetime counts the stickers read.
function stickerCountRun(run) {
  state.stats ||= {};
  const add = key => (state.stats[key] = stickerStat(state, key) + 1);
  if (!run.miss) add('flawless');
  if (run.forced && run.miss >= 2) add('ivClutch');
  if (run.forced) add('recovered');
}

// Awards every sticker whose test now passes. Idempotent: an earned sticker is never queued twice.
// Returns the ids earned by this call.
function stickerCheck() {
  state.stats ||= {};
  state.stickers ||= [];
  const dayChanged = stickerMarkDay(),
    fresh = [];
  for (const s of STICKERS) {
    if (state.stickers.includes(s.id)) continue;
    let ok = false;
    try {
      ok = s.test(state) === true;
    } catch {
      ok = false;
    }
    if (ok) fresh.push(s.id);
  }
  state.stickers.push(...fresh);
  if (fresh.length || dayChanged) save();
  if (fresh.length) {
    stickerQueueFresh(fresh);
    stickerRenderCard();
    if ($('stickerDialog').open) stickerRenderSheet();
  }
  return fresh;
}

// ---- The badge pop ----
// One pop at a time. A big haul (a returning player's first check) becomes a single pop.
let stickerQueue = [],
  stickerPopNow = null,
  stickerPopT = 0,
  stickerPopGap = 0;

function stickerQueueFresh(ids) {
  if (ids.length > STICKER_POP_BUNDLE) stickerQueue.push({ ids: ids.slice() });
  else for (const id of ids) stickerQueue.push({ ids: [id] });
}

// Pops wait while the title is up, during an arcade run, and while the medal ceremony plays.
function stickerPopHeld() {
  if (typeof titleUp !== 'undefined' && titleUp) return true;
  if (mini.open && ['briefing', 'intro', 'play', 'outro'].includes(mini.screen)) return true;
  return typeof ceremonyRunning === 'function' && ceremonyRunning();
}

function stickerPopText(pop) {
  if (pop.ids.length > 1) return pop.ids.length + ' new on your sheet';
  const s = stickerById(pop.ids[0]);
  return s ? s.name : 'Something shiny';
}

function stickerTick(dt) {
  if (stickerPopNow) {
    stickerPopT -= dt;
    if (stickerPopT <= 0) stickerPopHide();
    return;
  }
  stickerPopGap = Math.max(0, stickerPopGap - dt);
  if (stickerPopGap > 0 || !stickerQueue.length || stickerPopHeld()) return;
  stickerPopShow(stickerQueue.shift());
}

function stickerPopShow(pop) {
  stickerPopNow = pop;
  stickerPopT = STICKER_POP_SECONDS;
  const el = $('stickerPop'),
    many = pop.ids.length > 1;
  $('stickerPopKicker').textContent = many ? 'STICKERS' : 'STICKER';
  $('stickerPopName').textContent = stickerPopText(pop);
  el.setAttribute('aria-label', (many ? 'Stickers: ' : 'Sticker: ') + stickerPopText(pop));
  const g = configureCanvas($('stickerPopArt'), 48, 48);
  g.clearRect(0, 0, 48, 48);
  stickerBadge(g, 24, 24, 21, stickerById(pop.ids[0]), true);
  el.classList.add('show');
  // Top layer, above any open dialog. Older browsers keep the fixed-position element in the page.
  if (typeof el.showPopover === 'function') {
    try {
      if (typeof el.hidePopover === 'function' && el.matches && el.matches(':popover-open')) el.hidePopover();
      el.showPopover();
    } catch {}
  }
  sfx('daily');
}

function stickerPopHide() {
  const el = $('stickerPop');
  el.classList.remove('show');
  if (typeof el.hidePopover === 'function') {
    try {
      el.hidePopover();
    } catch {}
  }
  stickerPopNow = null;
  stickerPopGap = STICKER_POP_GAP;
}

function stickerPopClear() {
  stickerQueue = [];
  if (stickerPopNow) stickerPopHide();
  stickerPopGap = 0;
}

// Its own frame loop: the pop clock every frame, the sticker check once a second while playing.
let stickerLast = 0,
  stickerAcc = 0;

function stickerFrame(now) {
  const dt = stickerLast ? Math.min(0.25, Math.max(0, (now - stickerLast) / 1000)) : 0;
  stickerLast = now;
  stickerTick(dt);
  stickerAcc += dt;
  if (stickerAcc >= 1) {
    stickerAcc = 0;
    if (state.started) stickerCheck();
  }
  requestAnimationFrame(stickerFrame);
}

requestAnimationFrame(stickerFrame);

// ---- Badge art ----
const STICKER_TONES = {
  mint: { fill: '#b5e8c5', deep: '#5f9f86', light: '#e6f8ea' },
  coral: { fill: '#ffa48e', deep: '#c8664f', light: '#ffdcd2' },
  yellow: { fill: '#ffda79', deep: '#c49a35', light: '#fff2c9' }
};

const STICKER_INK = '#17313a';

function stickerShape(g, shape) {
  g.beginPath();
  if (shape === 'shield') {
    g.moveTo(-23, -27);
    g.quadraticCurveTo(0, -33, 23, -27);
    g.quadraticCurveTo(27, -26, 27, -21);
    g.lineTo(27, -2);
    g.bezierCurveTo(27, 16, 12, 26, 0, 32);
    g.bezierCurveTo(-12, 26, -27, 16, -27, -2);
    g.lineTo(-27, -21);
    g.quadraticCurveTo(-27, -26, -23, -27);
    g.closePath();
  } else g.arc(0, 0, 29, 0, Math.PI * 2);
}

// A five-point star centered at (x, y).
function stickerStar(g, x, y, r, fill, stroke = null, lw = 1) {
  path(
    g,
    p => {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          k = i % 2 ? r * 0.45 : r;
        if (i) p.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
        else p.moveTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
      }
      p.closePath();
    },
    fill,
    stroke,
    lw
  );
}

// Bold centered text with a dark outline: the badge numerals.
function stickerNumeral(g, text, x, y, size, fill = '#fffaf0', edge = STICKER_INK) {
  g.font = `900 ${size}px "Trebuchet MS", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, size * 0.2);
  g.strokeStyle = edge;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}

// Icon painters draw inside a 40-unit box around (0, 0).
const STICKER_ICONS = {
  medal: (g, grade) => ceremonyMedal(g, 0, 4, 15, grade),
  crown: g => {
    ceremonyMedal(g, 0, 8, 12, 3);
    poly(g, [[-15, -6], [-15, -20], [-8, -12], [0, -23], [8, -12], [15, -20], [15, -6]], '#f6c64a');
    path(g, p => p.rect(-15, -9, 30, 4), '#e2a92c');
    ellipse(g, 0, -15, 2.4, 2.4, '#ef8f89');
    ellipse(g, -9, -11, 1.8, 1.8, '#8fd3c2');
    ellipse(g, 9, -11, 1.8, 1.8, '#8fd3c2');
    line(g, [[-15, -6], [-15, -20], [-8, -12], [0, -23], [8, -12], [15, -20], [15, -6], [-15, -6]], STICKER_INK, 1.4);
  },
  three: g => {
    ellipse(g, 9, 12, 9, 5, '#8a5a3c');
    ellipse(g, 9, 8, 6, 4, '#a3704c');
    ellipse(g, 9, 4.5, 3, 2.5, '#b8845e');
    stickerNumeral(g, '3', -3, 0, 30);
  },
  star: (g, text) => {
    stickerStar(g, 0, 1, 19, '#fff3b8', STICKER_INK, 1.6);
    stickerNumeral(g, text, 0, 3, 13);
  },
  volleyball: g => {
    ellipse(g, 0, 0, 16, 16, '#fbf6ea');
    path(g, p => p.arc(0, 0, 16, 0, Math.PI * 2), null, STICKER_INK, 1.4);
    path(g, p => {
      p.moveTo(-15, -5);
      p.quadraticCurveTo(-2, -2, 4, -15);
    }, null, '#2f5f9e', 2.2);
    path(g, p => {
      p.moveTo(-2, 1);
      p.quadraticCurveTo(10, -2, 15, 6);
    }, null, '#e3a83a', 2.2);
    path(g, p => {
      p.moveTo(-2, 1);
      p.quadraticCurveTo(-6, 10, -1, 16);
    }, null, '#2f5f9e', 2.2);
    stickerNumeral(g, '10', 11, 13, 10);
  },
  softball: g => {
    softball(g, 0, 0, 16);
    stickerNumeral(g, '25', 11, 13, 10);
  },
  sparkle: g => {
    spark(g, -2, 0, '#fffaf0', 1.7);
    spark(g, 12, -11, '#fffaf0', 0.6);
    spark(g, -13, 11, '#fffaf0', 0.5);
    path(g, p => {
      p.moveTo(-2, -17);
      p.quadraticCurveTo(0, -3, 15, 0);
      p.quadraticCurveTo(0, 3, -2, 17);
      p.quadraticCurveTo(-4, 3, -19, 0);
      p.quadraticCurveTo(-4, -3, -2, -17);
    }, null, STICKER_INK, 1.2);
  },
  ivbag: g => {
    line(g, [[0, -21], [0, -16]], STICKER_INK, 2);
    rr(g, -10, -16, 20, 24, 6, '#eef7f6', STICKER_INK, 1.4);
    rr(g, -7, -5, 14, 10, 3, '#b8e3ef');
    line(g, [[0, 8], [0, 13], [6, 19]], '#5d8f9b', 2);
    stickerNumeral(g, '✕✕', 0, -10, 7, '#ef8f89', '#7a2c34');
  },
  bed: g => {
    rr(g, -18, -12, 5, 22, 2, '#7a9aa2', STICKER_INK, 1.2);
    rr(g, -15, 0, 33, 8, 3, '#eef6f2', STICKER_INK, 1.2);
    rr(g, -12, -5, 10, 6, 3, '#ffffff', STICKER_INK, 1);
    rr(g, -2, -4, 19, 6, 3, '#9ccfe0', STICKER_INK, 1);
    line(g, [[-15, 8], [-15, 13]], STICKER_INK, 2);
    line(g, [[16, 8], [16, 13]], STICKER_INK, 2);
    stickerNumeral(g, '5', 11, -12, 11);
  },
  joystick: g => {
    rr(g, -16, 4, 32, 12, 5, '#38515a', STICKER_INK, 1.4);
    line(g, [[0, 6], [-3, -10]], STICKER_INK, 4);
    ellipse(g, -3, -12, 7, 7, '#ef8f89');
    ellipse(g, -5, -14, 2.2, 2, '#ffffff99');
    ellipse(g, 10, 8, 2.6, 2.6, '#ffda79');
  },
  gremlin: (g, type) => {
    gremlin(g, 0, 14, 0.62, type, 0);
    stickerNumeral(g, type ? '500' : '100', 0, 16, 10);
  },
  donut: (g, drift) => {
    if (drift) {
      line(g, [[-19, -4], [-12, -4]], '#ffffffaa', 2);
      line(g, [[-20, 3], [-13, 3]], '#ffffffaa', 2);
    }
    ellipse(g, 2, 0, 17, 17, '#eef2ef');
    path(g, p => p.arc(2, 0, 17, 0, Math.PI * 2), null, STICKER_INK, 1.4);
    ellipse(g, 2, 0, 8, 8, '#4d6f78');
    path(g, p => p.arc(2, 0, 8, 0, Math.PI * 2), null, STICKER_INK, 1.2);
    rr(g, -6, 12, 16, 4, 2, drift ? '#dab180' : '#72aebc');
  },
  brick: g => {
    brick(g, 0, 4, '#e19a83', 1.25);
  },
  wave: g => {
    rr(g, -17, -13, 34, 24, 5, '#183a46', STICKER_INK, 1.4);
    path(g, p => {
      p.moveTo(-13, 0);
      for (let x = -13; x <= 13; x += 2) p.lineTo(x, Math.sin(x * 0.55) * 5 * Math.cos(x * 0.12));
    }, null, '#9ff0c8', 1.8);
    rr(g, -4, 11, 8, 6, 2, '#5d8f9b');
  },
  flame: g => {
    path(g, p => {
      p.moveTo(0, -20);
      p.bezierCurveTo(14, -6, 16, 4, 12, 11);
      p.quadraticCurveTo(0, 21, -12, 11);
      p.bezierCurveTo(-16, 3, -8, -4, -6, -10);
      p.quadraticCurveTo(-3, -4, -2, -2);
      p.quadraticCurveTo(2, -10, 0, -20);
    }, '#ff8a5b', STICKER_INK, 1.4);
    path(g, p => {
      p.moveTo(0, -4);
      p.bezierCurveTo(7, 3, 7, 9, 4, 12);
      p.quadraticCurveTo(0, 15, -4, 12);
      p.bezierCurveTo(-7, 8, -3, 3, 0, -4);
    }, '#ffe08a');
    stickerNumeral(g, '3', 0, 9, 11);
  },
  ralph: g => {
    gremlin(g, 0, 15, 0.6, 2, 0);
    line(g, [[-8, -7], [-3, -2]], STICKER_INK, 1.6);
    line(g, [[-3, -7], [-8, -2]], STICKER_INK, 1.6);
    line(g, [[3, -7], [8, -2]], STICKER_INK, 1.6);
    line(g, [[8, -7], [3, -2]], STICKER_INK, 1.6);
    g.save();
    g.translate(11, -16);
    g.rotate(0.5);
    poly(g, [[-6, 3], [-6, -4], [-2, 0], [0, -6], [2, 0], [6, -4], [6, 3]], '#f6c64a');
    g.restore();
  },
  house: g => {
    poly(g, [[-17, -2], [0, -18], [17, -2]], '#ef8f89');
    line(g, [[-17, -2], [0, -18], [17, -2]], STICKER_INK, 1.6);
    rr(g, -13, -3, 26, 20, 2, '#fbf3e3', STICKER_INK, 1.4);
    rr(g, -4, 5, 9, 12, 2, '#5b9f8e');
    ellipse(g, 3, 11, 1, 1, '#ffda79');
    rr(g, -11, 0, 6, 6, 1, '#b8e3ef');
    heart(g, 3, -13, 0.42, '#fffaf0');
  },
  haha: (g, text) => {
    path(g, p => {
      p.roundRect(-18, -15, 36, 24, 9);
      p.moveTo(-6, 9);
      p.lineTo(-10, 17);
      p.lineTo(2, 9);
    }, '#fffaf0', STICKER_INK, 1.4);
    stickerNumeral(g, text, 0, -3, 13, '#ef8f89', '#7a2c34');
  },
  ensure: g => {
    rr(g, -7, -19, 14, 6, 2, '#c9b18a', STICKER_INK, 1.2);
    rr(g, -9, -14, 18, 32, 6, '#efe2c4', STICKER_INK, 1.4);
    rr(g, -9, -4, 18, 10, 1, '#8f6a4a');
    label(g, 'ENS', -6.5, 4, 6, '#fff3d6');
    line(g, [[-17, -15], [17, 17]], '#d94a52', 4);
    line(g, [[-17, -15], [17, 17]], '#ffffffaa', 1.2);
  },
  rowdy: g => {
    g.save();
    g.beginPath();
    g.arc(0, 0, 22, 0, Math.PI * 2);
    g.clip();
    drawRowdyPortrait(g, 0, -1, 38, 1.3);
    g.restore();
  },
  bubbles: g => {
    rr(g, -18, -15, 24, 17, 7, '#fffaf0', STICKER_INK, 1.4);
    poly(g, [[-12, 1], [-15, 8], [-6, 1]], '#fffaf0');
    rr(g, -4, -3, 22, 16, 7, '#9ccfe0', STICKER_INK, 1.4);
    poly(g, [[11, 12], [15, 18], [6, 12]], '#9ccfe0');
    for (const x of [-12, -6, 0]) ellipse(g, x, -7, 1.6, 1.6, STICKER_INK);
    heart(g, 3, 1, 0.5, '#ef8f89');
  },
  cat: g => {
    poly(g, [[-14, -6], [-12, -19], [-4, -11]], '#f1b77a');
    poly(g, [[14, -6], [12, -19], [4, -11]], '#f1b77a');
    ellipse(g, 0, 1, 15, 13, '#f1b77a');
    path(g, p => p.ellipse(0, 1, 15, 13, 0, 0, Math.PI * 2), null, STICKER_INK, 1.4);
    ellipse(g, -5, -1, 2, 3, STICKER_INK);
    ellipse(g, 5, -1, 2, 3, STICKER_INK);
    poly(g, [[-2, 4], [2, 4], [0, 6]], '#ef8f89');
    line(g, [[-4, 6], [-13, 4]], STICKER_INK, 0.9);
    line(g, [[4, 6], [13, 4]], STICKER_INK, 0.9);
    ellipse(g, 13, -15, 3.5, 3.5, '#e2434f');
    label(g, 'REC', 2, -16, 5, STICKER_INK);
  },
  pillow: g => {
    path(g, p => {
      p.moveTo(-18, -6);
      p.quadraticCurveTo(0, -12, 18, -6);
      p.quadraticCurveTo(21, 4, 18, 12);
      p.quadraticCurveTo(0, 7, -18, 12);
      p.quadraticCurveTo(-21, 4, -18, -6);
    }, '#fbf6ea', STICKER_INK, 1.4);
    line(g, [[-10, 2], [8, 1]], '#d7cdb4', 1.2);
    label(g, 'z', 6, -12, 9, STICKER_INK);
    label(g, 'z', 12, -18, 7, STICKER_INK);
  },
  coins: g => {
    for (let i = 0; i < 4; i++) {
      ellipse(g, -3, 12 - i * 6, 13, 4.5, '#c49a35');
      ellipse(g, -3, 10 - i * 6, 13, 4.5, '#ffd86b');
      path(g, p => p.ellipse(-3, 10 - i * 6, 13, 4.5, 0, 0, Math.PI * 2), null, STICKER_INK, 1);
    }
    ellipse(g, 11, -9, 7, 7, '#ffd86b');
    path(g, p => p.arc(11, -9, 7, 0, Math.PI * 2), null, STICKER_INK, 1.2);
    label(g, '¢', 8.5, -5.5, 9, '#a5772a');
  },
  bag: g => {
    path(g, p => {
      p.moveTo(-7, -9);
      p.quadraticCurveTo(-7, -19, 0, -19);
      p.quadraticCurveTo(7, -19, 7, -9);
    }, null, STICKER_INK, 2);
    rr(g, -14, -10, 28, 27, 4, '#8fd3c2', STICKER_INK, 1.4);
    heart(g, 0, -2, 0.75, '#ef8f89');
  },
  hoodie: g => {
    path(g, p => {
      p.moveTo(-8, -17);
      p.lineTo(-18, -12);
      p.lineTo(-21, 6);
      p.lineTo(-14, 7);
      p.lineTo(-13, 17);
      p.lineTo(13, 17);
      p.lineTo(14, 7);
      p.lineTo(21, 6);
      p.lineTo(18, -12);
      p.lineTo(8, -17);
      p.quadraticCurveTo(0, -10, -8, -17);
    }, '#7d5bbd', STICKER_INK, 1.4);
    line(g, [[-13, 13], [13, 13]], '#e8c35a', 2);
    stickerNumeral(g, '22', 0, 2, 13, '#ffe7a0', '#3e2a6e');
  },
  calendar: (g, text) => {
    rr(g, -16, -14, 32, 30, 4, '#fffaf0', STICKER_INK, 1.4);
    rr(g, -16, -14, 32, 9, 4, '#ef8f89');
    line(g, [[-9, -18], [-9, -11]], STICKER_INK, 2);
    line(g, [[9, -18], [9, -11]], STICKER_INK, 2);
    stickerNumeral(g, text, 0, 5, 17, '#5b9f8e', STICKER_INK);
  },
  sun: (g, text) => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      line(g, [[Math.cos(a) * 13, Math.sin(a) * 13], [Math.cos(a) * 19, Math.sin(a) * 19]], '#f0a63a', 2.4);
    }
    ellipse(g, 0, 0, 11, 11, '#ffe08a');
    path(g, p => p.arc(0, 0, 11, 0, Math.PI * 2), null, STICKER_INK, 1.3);
    stickerNumeral(g, text, 0, 1, 13);
  }
};

// A sticker badge, centered at (x, y), r is roughly the radius. Locked badges are grey outlines.
function stickerBadge(g, x, y, r, s, earned) {
  if (!s) return;
  g.save();
  g.translate(x, y);
  g.scale(r / 30, r / 30);
  if (!earned) {
    g.setLineDash([5, 4]);
    stickerShape(g, s.shape);
    g.fillStyle = '#ffffff08';
    g.fill();
    g.strokeStyle = '#7f979c';
    g.lineWidth = 2;
    g.stroke();
    g.setLineDash([]);
    stickerNumeral(g, '?', 0, 1, 24, '#8fa5a8', '#203b44');
    g.restore();
    return;
  }
  const tone = STICKER_TONES[s.tone] || STICKER_TONES.mint;
  g.save();
  g.translate(0, 2.6);
  stickerShape(g, s.shape);
  g.fillStyle = '#081a2459';
  g.fill();
  g.restore();
  stickerShape(g, s.shape);
  g.fillStyle = gradient(g, -20, -28, 30, 56, tone.light, tone.fill);
  g.fill();
  g.strokeStyle = STICKER_INK;
  g.lineWidth = 2.4;
  g.stroke();
  // Stitched inner edge: a sticker, not a coin.
  g.save();
  g.scale(0.84, 0.84);
  g.setLineDash([3, 3]);
  stickerShape(g, s.shape);
  g.strokeStyle = tone.deep;
  g.lineWidth = 1.3;
  g.stroke();
  g.setLineDash([]);
  g.restore();
  const icon = STICKER_ICONS[s.icon];
  if (icon) {
    g.save();
    g.scale(0.9, 0.9);
    icon(g, s.arg);
    g.restore();
  }
  // A little shine.
  path(
    g,
    p => {
      p.moveTo(-20, -12);
      p.quadraticCurveTo(-17, -22, -6, -25);
    },
    null,
    '#ffffffb0',
    3
  );
  ellipse(g, -4, -25.5, 1.6, 1.6, '#ffffffc0');
  g.restore();
}

// ---- The sheet ----
let stickerSelected = '';

function stickerCount() {
  return STICKERS.filter(s => stickerEarned(s.id)).length;
}

// The most recent earned sticker, or '' when the sheet is empty.
function stickerLatest() {
  const list = (state.stickers || []).filter(id => stickerById(id));
  return list.length ? list[list.length - 1] : '';
}

function stickerTile(s) {
  const earned = stickerEarned(s.id);
  return (
    `<button class="sticker-tile${stickerSelected === s.id ? ' selected' : ''}" data-sticker="${s.id}" ` +
    `data-earned="${earned ? 1 : 0}" aria-pressed="${stickerSelected === s.id}" ` +
    `aria-label="${earned ? s.name + '. ' + s.blurb : 'Locked. ' + s.hint}">` +
    `<canvas data-sticker-art="${s.id}" width="72" height="72" aria-hidden="true"></canvas>` +
    `<strong>${earned ? s.name : 'Locked'}</strong><small>${earned ? s.blurb : s.hint}</small></button>`
  );
}

function stickerPaintAll(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-sticker-art]').forEach(cv => {
    const s = stickerById(cv.dataset.stickerArt),
      g = configureCanvas(cv, 64, 64);
    g.clearRect(0, 0, 64, 64);
    stickerBadge(g, 32, 33, 27, s, stickerEarned(s.id));
  });
}

function stickerRenderSpot() {
  const id = stickerSelected || stickerLatest(),
    s = stickerById(id),
    earned = !!s && stickerEarned(s.id),
    g = configureCanvas($('stickerSpotArt'), 120, 120);
  g.clearRect(0, 0, 120, 120);
  if (s) stickerBadge(g, 60, 61, 52, s, earned);
  else {
    const blank = { shape: 'round', tone: 'mint' };
    stickerBadge(g, 60, 61, 52, blank, false);
  }
  $('stickerSpotKicker').textContent = s ? (earned ? 'Earned · ' + s.group : 'Locked · ' + s.group) : 'Nothing yet';
  $('stickerSpotName').textContent = s ? (earned ? s.name : 'Still a mystery') : 'Your sheet is empty.';
  $('stickerSpotText').textContent = s ? (earned ? s.blurb : s.hint) : 'Win a run, clear a ward, or hear a Dad joke. Stickers find you.';
  $('stickerShare').disabled = !earned;
  $('stickerShare').textContent = 'Share this sticker ↗';
  $('stickerShare').dataset.sticker = earned ? s.id : '';
}

function stickerRenderSheet() {
  const n = stickerCount();
  $('stickerTitle').textContent = `${n} of ${STICKERS.length} stickers.`;
  $('stickerBar').style.width = Math.round((n / STICKERS.length) * 100) + '%';
  $('stickerGrid').innerHTML = STICKER_GROUPS.map(group => {
    const list = STICKERS.filter(s => s.group === group),
      got = list.filter(s => stickerEarned(s.id)).length;
    return (
      `<h3 class="card-kicker sticker-group">${group} · ${got}/${list.length}</h3>` +
      `<div class="sticker-tiles">${list.map(stickerTile).join('')}</div>`
    );
  }).join('');
  stickerPaintAll($('stickerGrid'));
  stickerRenderSpot();
}

function stickerOpenSheet() {
  stickerSelected = stickerLatest();
  stickerRenderSheet();
  modalOpen($('stickerDialog'));
  if (stickerSelected) sharePrepare(shareStickerSpec(stickerSelected));
  sfx('select');
}

function stickerSelect(id) {
  if (!stickerById(id)) return;
  stickerSelected = id;
  stickerRenderSheet();
  if (stickerEarned(id)) sharePrepare(shareStickerSpec(id));
  sfx('ui');
}

// The sidebar card: a count, a bar, and the four latest badges.
function stickerRenderCard() {
  const n = stickerCount(),
    recent = (state.stickers || []).filter(id => stickerById(id)).slice(-4).reverse();
  $('stickerCardCount').textContent = `${n} / ${STICKERS.length}`;
  $('stickerCardBar').style.width = Math.round((n / STICKERS.length) * 100) + '%';
  $('stickerCardStrip').innerHTML = [0, 1, 2, 3]
    .map(i =>
      recent[i]
        ? `<canvas data-sticker-art="${recent[i]}" width="48" height="48" aria-label="${stickerById(recent[i]).name}"></canvas>`
        : '<span class="sticker-slot" aria-hidden="true"></span>'
    )
    .join('');
  $('stickerCardNote').textContent = n
    ? 'Latest: ' + stickerById(recent[0]).name + '.'
    : 'Thirty-some ways to show off. None of them medical.';
  stickerPaintAll($('stickerCardStrip'));
}

// ---- Share cards ----
// 1080 × 1350 (4:5, the size phones and feeds like). Drawn with art.js, so no fonts or network.
const SHARE_W = 1080,
  SHARE_H = 1350;

let shareCache = null;

function shareDateLabel(d = new Date()) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

// A result card for the run on the result screen (or the given numbers).
function shareResultSpec(over = {}) {
  const id = mini.id,
    def = typeof miniGame === 'function' ? miniGame(id) : games[id];
  return {
    kind: 'result',
    id,
    game: def ? def.info.game : 'The arcade',
    room: rooms[id] ? rooms[id].name : 'The hospital',
    theme: rooms[id] ? rooms[id].theme : '#73ac98',
    tier: mini.tier || 0,
    grade: mini.grade || 1,
    score: mini.score || 0,
    quality: mini.qualityFinal || 0,
    name: state.name || 'Macy',
    date: shareDateLabel(),
    ...over
  };
}

function shareStickerSpec(id, over = {}) {
  const s = stickerById(id) || STICKERS[0];
  return {
    kind: 'sticker',
    sticker: s.id,
    theme: s.tone === 'coral' ? '#c98a8a' : s.tone === 'yellow' ? '#dab180' : '#73ac98',
    count: stickerCount(),
    name: state.name || 'Macy',
    date: shareDateLabel(),
    ...over
  };
}

function shareKey(spec) {
  return JSON.stringify(spec);
}

function shareSlug(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'card'
  );
}

function shareFileName(spec) {
  if (spec.kind === 'sticker') return `gut-feeling-sticker-${shareSlug(spec.sticker)}.png`;
  return `gut-feeling-${shareSlug(spec.game)}-${shareSlug(medalNames[spec.grade] || 'medal')}.png`;
}

function shareText(spec) {
  if (spec.kind === 'sticker') {
    const s = stickerById(spec.sticker);
    return `I earned the ${s ? s.name : 'mystery'} sticker in Operation: Gut Feeling.`;
  }
  return `${medalNames[spec.grade] || 'A'} medal in ${spec.game}. Score ${spec.score}. Operation: Gut Feeling.`;
}

// Text width, with an estimate for contexts that cannot measure.
function shareMeasure(g, text, size) {
  g.font = `700 ${size}px "Trebuchet MS", Arial, sans-serif`;
  const m = typeof g.measureText === 'function' ? g.measureText(text) : null;
  return m && Number.isFinite(m.width) ? m.width : String(text).length * size * 0.56;
}

// The largest size (down to min) that keeps text inside maxW.
function shareFit(g, text, maxW, size, min = 18) {
  let s = size;
  while (s > min && shareMeasure(g, text, s) > maxW) s -= 2;
  return s;
}

function shareWrap(g, text, x, y, maxW, size, color, lineH = size * 1.3, maxLines = 3) {
  const words = String(text).split(/\s+/),
    lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && shareMeasure(g, next, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  lines.slice(0, maxLines).forEach((l, i) => label(g, l, x, y + i * lineH, size, color, 'center'));
  return Math.min(lines.length, maxLines);
}

// Macy with her 22 on the hoodie, feet at (x, y).
function shareMacy(g, x, y, k) {
  girl(g, x, y, k, 0, 1, false, true);
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  rr(g, -8, -44, 17, 13, 4, '#ffffff22');
  stickerNumeral(g, '22', 0.5, -37, 11, '#fffaf0', '#2c4d58');
  g.restore();
}

// The wordmark across the top: OPERATION: over GUT FEELING.
function shareWordmark(g, y) {
  label(g, 'OPERATION:', SHARE_W / 2, y, 34, '#ffa48e', 'center');
  const size = 92,
    parts = [
      ['GUT ', '#f8efd9'],
      ['FEELING', '#b5e8c5'],
      ['.', '#ffa48e']
    ],
    total = parts.reduce((a, [t]) => a + shareMeasure(g, t, size), 0);
  let x = SHARE_W / 2 - total / 2;
  for (const [t, col] of parts) {
    label(g, t, x, y + 92, size, col);
    x += shareMeasure(g, t, size);
  }
}

// The room scene: wall, floor stripes and a window, in the room's palette.
function shareScene(g, x, y, w, h, theme) {
  g.save();
  rr(g, x, y, w, h, 44, null);
  g.clip();
  rect(g, x, y, w, h, theme);
  rect(g, x, y, w, h * 0.5, '#ffffff26');
  rect(g, x, y + h * 0.5, w, 10, '#3b6970');
  rect(g, x, y + h * 0.5 + 10, w, h * 0.5, '#5f8c86');
  for (let i = 0; i < w; i += 70) rect(g, x + i, y + h * 0.5 + 10, 2, h * 0.5, '#d1ddba30');
  windowArt(g, x + 70, y + 60, 230, 150);
  glow(g, x + w * 0.72, y + h * 0.3, 330, '#fff2c444');
  g.restore();
  rr(g, x, y, w, h, 44, null, '#ffffff30', 3);
}

// One stat tile: big value over a small kicker.
function shareTile(g, x, y, w, value, kicker, col = '#b5e8c5') {
  rr(g, x, y, w, 124, 26, '#1f3f4d');
  const size = shareFit(g, value, w - 30, 54, 26);
  label(g, value, x + w / 2, y + 70, size, col, 'center');
  label(g, kicker, x + w / 2, y + 104, 20, '#a8bdbe', 'center');
}

// Draws the whole card on g. Returns its size, so callers (and tests) can check it.
function shareCardDraw(g, spec) {
  const W = SHARE_W,
    H = SHARE_H,
    sticker = spec.kind === 'sticker' ? stickerById(spec.sticker) : null,
    grade = clamp(Math.round(spec.grade || 1), 1, 3);
  g.save();
  rect(g, 0, 0, W, H, '#101e29');
  g.fillStyle = gradient(g, 0, 0, 0, H, '#1b3a4a', '#0d1923');
  g.fillRect(0, 0, W, H);
  glow(g, W * 0.85, 120, 520, (spec.theme || '#73ac98') + '55');
  glow(g, 120, H - 160, 420, '#ffa48e22');
  shareWordmark(g, 112);
  // The scene: Macy on the left, the badge top right, Rowdy or a gremlin as the flourish.
  const sx = 60,
    sy = 270,
    sw = W - 120,
    sh = 600;
  shareScene(g, sx, sy, sw, sh, spec.theme || '#73ac98');
  shareMacy(g, 330, sy + sh - 54, 4.6);
  if (sticker || grade === 3) drawRowdy(g, 750, sy + sh - 44, 3, sticker ? 'flex' : 'cheer', 0.6, { face: -1 });
  else gremlin(g, 780, sy + sh - 60, 3, (spec.id || 0) % 4, 1.1);
  const bx = W - 230,
    by = sy + 140;
  glow(g, bx, by, 220, '#fff4c455');
  if (sticker) stickerBadge(g, bx, by, 124, sticker, true);
  else ceremonyMedal(g, bx, by - 8, 104, grade);
  // The words.
  const ty = sy + sh + 90;
  if (sticker) {
    label(g, 'I EARNED THE', W / 2, ty, 30, '#ffa48e', 'center');
    const size = shareFit(g, sticker.name, W - 140, 76, 40);
    label(g, sticker.name, W / 2, ty + 82, size, '#f8efd9', 'center');
    label(g, `STICKER · ${spec.count || 1} OF ${STICKERS.length} COLLECTED`, W / 2, ty + 130, 28, '#b5e8c5', 'center');
    shareWrap(g, sticker.blurb, W / 2, ty + 200, W - 200, 32, '#cfe0da', 42, 2);
  } else {
    const medal = (medalNames[grade] || 'Gold').toUpperCase(),
      size = shareFit(g, spec.game, W - 140, 74, 40);
    label(g, spec.game, W / 2, ty + 2, size, '#f8efd9', 'center');
    label(
      g,
      `${String(spec.room).toUpperCase()} · LEVEL ${(spec.tier || 0) + 1} · ${tiers[spec.tier || 0].toUpperCase()}`,
      W / 2,
      ty + 54,
      26,
      '#b5e8c5',
      'center'
    );
    const tw = (W - 120 - 40) / 3,
      cols = ['#ffda79', '#b5e8c5', grade === 3 ? '#ffda79' : grade === 2 ? '#dfe7ea' : '#f0b98a'];
    shareTile(g, 60, ty + 96, tw, String(spec.score), 'SCORE', cols[0]);
    shareTile(g, 60 + tw + 20, ty + 96, tw, spec.quality + '%', 'PERFORMANCE', cols[1]);
    shareTile(g, 60 + (tw + 20) * 2, ty + 96, tw, medal, 'MEDAL', cols[2]);
    label(g, '★'.repeat(grade) + '☆'.repeat(3 - grade), W / 2, ty + 268, 34, '#ffda79', 'center');
  }
  // Footer: name and number on the left, the date on the right, the tri-color bar under both.
  label(g, `${String(spec.name || 'Macy').toUpperCase()} · #22`, 70, H - 62, 26, '#f8efd9');
  label(g, spec.date || shareDateLabel(), W - 70, H - 62, 26, '#a8bdbe', 'right');
  rect(g, 0, H - 22, W / 3, 22, '#b5e8c5');
  rect(g, W / 3, H - 22, W / 3, 22, '#ffa48e');
  rect(g, (W / 3) * 2, H - 22, W / 3, 22, '#ffda79');
  g.restore();
  return { w: W, h: H, kind: spec.kind };
}

// A fresh canvas with the card drawn on it.
function shareRender(spec) {
  const cv = document.createElement('canvas');
  cv.width = SHARE_W;
  cv.height = SHARE_H;
  const g = cv.getContext('2d');
  shareCardDraw(g, spec);
  return cv;
}

// A PNG blob without waiting: the fallback when a tap arrives before toBlob has finished.
function shareBlobSync(cv) {
  if (typeof cv.toDataURL !== 'function' || typeof Blob !== 'function' || typeof atob !== 'function') return null;
  const data = cv.toDataURL('image/png'),
    bin = atob(data.split(',')[1] || ''),
    bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

// Draws the card and encodes it with toBlob in the background, so a later tap can share at once
// (iOS only opens the share sheet inside the tap itself).
function sharePrepare(spec) {
  const key = shareKey(spec);
  if (shareCache && shareCache.key === key) return shareCache;
  const entry = { key, spec, blob: null };
  shareCache = entry;
  const cv = shareRender(spec);
  if (typeof cv.toBlob === 'function') cv.toBlob(b => (entry.blob = b), 'image/png');
  else entry.blob = shareBlobSync(cv);
  return entry;
}

// Briefly relabels the button that asked, then puts its label back.
function shareSay(btn, text) {
  if (!btn) return;
  const before = btn.dataset.label || btn.textContent;
  btn.dataset.label = before;
  btn.textContent = text;
  if (typeof setTimeout !== 'function') return;
  setTimeout(() => {
    btn.textContent = btn.dataset.label;
    delete btn.dataset.label;
  }, 1800);
}

// Saves the PNG: a download on laptops, a new tab on touch screens (long-press to save), and a
// download again if the new tab was blocked.
function shareSave(blob, name, btn) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    shareSay(btn, 'Cannot save here');
    return 'none';
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  if (typeof setTimeout === 'function') setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (matchMedia('(pointer: coarse)').matches || !('download' in a)) {
    const tab = typeof window.open === 'function' ? window.open(url, '_blank') : null;
    if (tab) {
      shareSay(btn, 'Opened ✓');
      return 'tab';
    }
  }
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  if (typeof document.body.appendChild === 'function') document.body.appendChild(a);
  if (typeof a.click === 'function') a.click();
  if (typeof a.remove === 'function') a.remove();
  shareSay(btn, 'Saved ✓');
  return 'download';
}

// Shares the PNG with the system sheet where files can be shared (iOS, Android, Safari on a Mac),
// else saves it. Returns which path it took.
function shareDeliver(blob, name, text, btn) {
  if (!blob) {
    shareSay(btn, 'Could not draw it');
    return 'none';
  }
  let file = null;
  try {
    file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
  } catch {
    file = null;
  }
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  let canFiles = false;
  try {
    canFiles =
      !!file && !!nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });
  } catch {
    canFiles = false;
  }
  if (canFiles) {
    nav
      .share({ files: [file], title: 'Operation: Gut Feeling', text })
      .then(() => shareSay(btn, 'Shared ✓'))
      .catch(err => {
        if (!err || err.name !== 'AbortError') shareSave(blob, name, btn);
      });
    return 'share';
  }
  return shareSave(blob, name, btn);
}

// The Share buttons: the prepared PNG if it is ready, else one drawn and encoded right now.
function shareCard(spec, btn) {
  const key = shareKey(spec);
  let blob = shareCache && shareCache.key === key ? shareCache.blob : null;
  if (!blob) {
    const cv = shareRender(spec);
    blob = shareBlobSync(cv);
    shareCache = { key, spec, blob };
  }
  sfx('select');
  return shareDeliver(blob, shareFileName(spec), shareText(spec), btn);
}

function shareResult() {
  if (mini.screen !== 'result' || !mini.win) return 'none';
  return shareCard(shareResultSpec(), $('resultShare'));
}

function shareSticker(id = $('stickerShare').dataset.sticker) {
  if (!id || !stickerEarned(id)) return 'none';
  return shareCard(shareStickerSpec(id), $('stickerShare'));
}
