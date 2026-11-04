// Macy's dream. Lie still long enough in room 5 (home base after dark) and the game tilts into a dream:
// five or six vignettes drawn in crayon, about 40 seconds in all, then a nurse wakes her up. The pick,
// the order, the lines and the timings change every time. Dream logic runs all through it (hallways
// that stretch, signs that read differently the second time, a number that will not stay 22), with
// small psychology jokes for the grown-ups: a Rorschach gremlin, Jung's shadow, a Freudian slip,
// Pavlov's bell, Maslow's pudding, a Stroop sign, Dali's clock, Escher's stairs, a dream within a
// dream, the hypnic jerk, and a dream analysis card at the end.
//
// Hooks for world.js (world.js guards the calls; nothing here guards them):
//   updateDream(dt)        every simulation step, before the ward logic. True while a dream is on; the
//                          ward then skips its own update for that step.
//   dreamActive()          true while a dream is on.
//   drawDream(g, vw, vh)   after drawWorld has drawn everything else, while a dream is on. Paints the
//                          whole frame: the room fades into the dream, and back out at the end.
//   dreamWake()            on any ward action: wakes a dream early (true), or restarts the idle clock.
//   dreamStart()           starts a dream now, in room 5 only and never under reduced motion (QA, tests).
//   dreamBegin()           starts a dream right now, no questions asked (the bed hotspot). updateDream
//                          still ends it at once outside room 5 or under reduced motion.
// Capture-phase keydown, pointerdown and click listeners on document wake a dream early (the nurse
// still gets her line) and swallow that event, so the press that wakes Macy never also walks, swings
// or opens anything.
//
// A dream starts once Macy has spent DREAM_IDLE seconds in room 5 with no gremlins up, no dialog open,
// and no move, key, tap or swing. Under prefers-reduced-motion there are no dreams at all. Content
// comes from rand() and pick() when a dream starts; every motion runs on the dream's own clock, so
// drawing never draws randomness. Every global here starts with dream or DREAM.

const DREAM_ROOM = 5,
  DREAM_IDLE = 14,
  DREAM_INTRO = 1.6,
  DREAM_WAKE = 4.4,
  DREAM_WAKE_EARLY = 3.4,
  DREAM_FADE = 1.1,
  DREAM_OUT = 0.7,
  DREAM_MIN = 5,
  DREAM_MAX = 8,
  DREAM_SHORTEST = 37.5,
  DREAM_LONGEST = 41.5,
  DREAM_NURSE_CPS = 40,
  DREAM_INSET = 0.88,
  DREAM_HAND = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
  DREAM_FONT = '"Trebuchet MS", Arial, sans-serif',
  DREAM_PASS_KEYS = ['tab', 'shift', 'control', 'alt', 'meta', 'capslock', 'contextmenu', 'f5', 'f11', 'f12'];

// ---- Copy ----
// {name} and {NAME} become Macy's name. House voice: no em dashes.

// The wake-up line. The first one is where all this started.
const DREAM_NURSE_LINES = [
  'You were saying MINE in your sleep.',
  'You spiked the pillow.',
  'You called MINE three times. The man in 409 says you had it.',
  'Just vitals, hon. You were serving in your sleep. Ace, by the way.',
  'You were rotating in your sleep. I think you won the point.'
];

const DREAM_DAD_JOKES = [
  "Perché il gremlin è andato in ospedale? Perché si sentiva un po' INTESTINALE.",
  "Cosa dice la gelatina all'infermiera? Tremo per te!",
  'La flebo e io siamo uguali. Pendiamo qui tutto il giorno. Gocciolissimo!',
  'Ho premuto il campanello per sbaglio. Adesso devo volere il ghiaccio. Per sempre.',
  "Il camice dell'ospedale: davanti, elegantissimo. Dietro, una sorpresa.",
  'Il monitor dice 88. O è il tuo cuore, o sono i budini che ho mangiato. Tutti e due, tesoro.'
];

const DREAM_ROWDY_WHISPERS = [
  "psst. you're doing great.",
  'psst. all of ramsey says hi. quietly.',
  "you've got this. don't tell anyone a ram told you.",
  "go rams. that's the whisper version.",
  'small steps. big horns. you have both.',
  'the gym misses you. it told me. gyms talk.',
  'brave looks like you. at night. in a hospital gown.'
];

const DREAM_SORRIES = [
  'sorry',
  'sry',
  'so sorry',
  'my bad',
  'oops',
  'forgive us',
  'sorry!!',
  'pardon',
  'our bad',
  'eep. sorry',
  'apologies',
  'sorry :('
];

const DREAM_HALL_SUBS = ['KEEP WALKING', 'ALMOST THERE (NOT REALLY)', 'YOU ARE HERE. ALSO HERE.', 'NO RUNNING. NO ARRIVING.', 'WALK FASTER, GET FARTHER', 'THE FASTER YOU GO, THE LONGER IT GETS'];

const DREAM_MAP_GOO = [['GOO ROOM'], ['COLD JELLY', 'ROOM'], ['THE BEEP', 'BEEP']],
  DREAM_MAP_SHOP = [['$$$'], ['BALLOONS', '!!!'], ['SHOP', '(NO $)']],
  DREAM_MAP_DESK = [['NICE', 'NURSES'], ['NURSES', '+ SNACKS'], ['THE DESK', '(NICE)']],
  DREAM_MAP_LIFT = ['BOX THAT GOES UP', 'ELEVATER', 'UP/DOWN BOX'];

const DREAM_MRI_SUBS = ['SET 5 OF ∞', 'SERVE: {NAME}', 'TIMEOUT: NEVER', 'SCAN TIME: ONE RALLY'];

const DREAM_BARB_LINES = ['Ensure delivery, hon!', 'Over the moon, hon!', 'Chocolate, incoming!', 'Thirty grams of protein, airborne!'],
  DREAM_BARB_REPLIES = ['Still not allowed.', "I'm on clear liquids!", 'Is that strawberry?'];

const DREAM_POLE_LINES = [
    "Heel, please. If it's convenient.",
    "Who's a good patient? You are. If I may.",
    'Shall we sit? No pressure.',
    'Lovely evening for a walk, Miss {name}.',
    'Pardon me. A squirrel. My apologies.'
  ],
  DREAM_POLE_REPLIES = ['...thanks?', 'This is so weird.', 'No treats. I mean it.'];

const DREAM_ETYPE_LINES = ['VROOM. Sorry. vroom.', 'beep beep', 'License? Never heard of her.', 'Buckle up. Hospital rules.'];

const DREAM_CAT_READINGS = ['BP: 3 FEET', 'BP: 2 MEOWS OVER 1 PURR', 'BP: 11 INCHES. NORMAL.', 'BP: ONE (1) TUNA'],
  DREAM_CAT_LINES = ['mrrp.', 'Hold still, please.', 'mrow. (that means good)'];

const DREAM_RALPH_LINES = [
  '...and ANOTHER thing...',
  'mmf mmff MMF',
  'is this jar BPA free?',
  'I want to speak to the manager.',
  'let me out. I have notes.',
  'knock knock. HELLO?'
];

const DREAM_COURT_LINES = ['We saved your spot!', 'Your serve, {name}!', 'Come up! The clouds are bouncy!', 'Practice is boring without you!'];

// The new vignettes' lines.
const DREAM_SCHOOL_LINES = ['Cute pajamas, {name}!', 'Wait. Is it pajama day?', 'Pajama day is every day now. You started it.', 'The bell rang. Also it never rang.'],
  DREAM_SCHOOL_REPLIES = ['I am running. This is me running.', 'Why is the floor syrup?', 'Late. In pajamas. Classic.'],
  DREAM_SCHOOL_POSTERS = [
    ['WELCOME BACK, {NAME}', 'WELCOME BACON, {NAME}'],
    ['PAJAMA DAY: TODAY', 'PAJAMA DAY: ALWAYS'],
    ['GO RAMS', 'GO LAMBS', 'GO RAMS (QUIETLY)'],
    ['NO RUNNING', 'NO SYRUP', 'NO RUNNING IN SYRUP']
  ],
  DREAM_CLOCK_ODD = ['22', '?', '99', '½', '∞', '7', '13', '0', 'Z', '!', '3', '10', '1'];

const DREAM_DOC_SLIPS = ['Your gall-volleyball looks excellent.', 'Excellent. A textbook gall-ballgame.', 'Look at that gall-softball. Excellent.', 'Ah. The gall-volley-bladder. Excellent.'],
  DREAM_DOC_FIX = 'I meant to say gallbladder.',
  DREAM_DOC_REPLIES = ['Nice horns, Doc.', 'Are those... horns?', 'Is that a net in there?'],
  DREAM_DOC_SCREENS = ['DEPTH: 22 CM', 'IMAGE: EXCELLENT', 'SCAN: VIBES ONLY'];

const DREAM_SNACK_LINES = ['Snack time. As foretold.', 'You heard the bell. We heard the bell.', 'Chocolate on the bottom. For stability.'],
  DREAM_SNACK_REPLIES = ['How did I know?', 'My mouth knew first.', 'Pudding. Obviously.'],
  DREAM_SNACK_THINKS = ['...pudding?', 'pudding.', 'PUDDING?'];

const DREAM_BLINK_LINES = ['Just the one, hon.', 'Only one bottle. Promise.', 'Try not to blink, sweetie.'],
  DREAM_BLINK_REPLIES = ['Barb. I blinked.', 'Barb. BARB.', 'There were two. Now look.'];

const DREAM_PEPPER_LINES = ['She was smaller this morning.', 'mrrp. she ate the couch.', 'We do not talk about it.', 'Still a baby. A large baby.'];

const DREAM_TRYOUT_LINES = ['You already made the team. Once more?', 'Same as last time. Perfect. Again, please.', 'We just like watching.'],
  DREAM_TRYOUT_REPLIES = ["Didn't I already take this?", 'Again? I made it. Twice.', 'Is this graded on a curve?'],
  DREAM_TRYOUT_CARDS = [['10', 'A+', '22'], ['9.9', 'YES', 'A'], ['A++', '10', 'WOW'], ['PASS', '11', '!']];

const DREAM_MIRROR_LINES = ['Oh. Tic Tacs.', 'Fresh breath, I guess.', 'Mimi would say share.', 'Minty. Okay.'];

const DREAM_FLY_LINES = ['Wait. How do I do this again?', 'Hold on. How was I doing this?', 'Okay, but how, though?'];

const DREAM_DOOR_LINES = ['Huh. Same room.', 'Is this... my room again?', 'I have been here. I am here.'];

const DREAM_LIFT_LINES = ['Going sideways.', 'Next stop: a little to the left.', 'Lateral floor. Mind the gap.'],
  DREAM_LIFT_REPLIES = ['Elevators do not do that.', 'That was sideways.', 'Is this the cafeteria?'],
  DREAM_LIFT_FLOORS = ['1', '2', '2½', 'B', 'LOBBY?', '22', 'SIDEWAYS', 'CAFETERIA (EAST)', 'NAP', 'THE GYM', 'MIMI + DODO'];

// Inkblots: 0 a gremlin, 1 Ralph in his crown, 2 a cat, 3 a gremlin waving. The answers follow.
const DREAM_BLOT_ANSWERS = ['A gremlin.', 'Ralph. In a crown.', '...Pepper?', 'A gremlin, waving.'],
  DREAM_BLOT_NOTES = ['Interesting.', 'Mm-hm.', 'And how does that make you feel?', 'Fascinating. Next.'];

const DREAM_STAIR_LINES = ['Morning!', 'Up is relative.', 'Lovely stairs. Go nowhere. Love that.'],
  DREAM_STAIR_REPLIES = ['How many floors IS this?', 'I have climbed these before.', 'My legs say floor nine.'];

const DREAM_FALSE_LINES = ['Morning, hon. Just vitals.', 'Rise and shine. Quick blood pressure.', 'Hey, sleepyhead. Vitals.'],
  DREAM_FALSE_TELLS = ['...still dreaming.', 'Nope. Still dreaming.', 'Since when do nurses have cat ears?'];

// The card at the end, for the grown-ups reading over her shoulder.
const DREAM_ANALYSIS_PS = ['P.S. The gremlins mean well.', 'P.S. More pudding.', 'P.S. 22 is a lucky number.', 'P.S. Call Mimi and Dodo.', 'P.S. Riley may borrow the E-Type. Briefly.'];

const DREAM_PJ = ['#f9c9dc', '#ee9cbd', '#c96b93', '#e78db1', '#fff3a8'];

// ---- Palette ----
const DREAM_INK = {
  black: '#2c2833',
  red: '#e2574c',
  royal: '#2457b8',
  gold: '#f6cf47',
  paper: '#fbf4e2',
  cream: '#fffaf0'
};

const DREAM_DOORS = ['#f4c27a', '#9fd0e8', '#f3a6b8', '#b7dfa0', '#c9b4ea'],
  DREAM_PETALS = ['#ef7f9e', '#f6cf47', '#f29a3d', '#c08ae0', '#7fb6f0', '#ffffff'],
  DREAM_FLAVORS = ['#7a4b33', '#e9d39a', '#ef9fb0'];

// Grown-ups in crayon, matched to the hallway cast: Dad in his zip-up with a coffee, Barb from Dietary.
const DREAM_DAD = {
    skin: '#f0c19c',
    skinDark: '#a36f52',
    hair: '#4b3022',
    hairDark: '#2f1d16',
    top: '#4e6175',
    topDark: '#2b3746',
    pants: '#6b737c',
    pantsDark: '#3e444b',
    shoes: '#9a6a45',
    style: 'wavy',
    zip: true,
    stubble: true,
    item: 'coffee',
    gesture: true,
    seed: 40
  },
  DREAM_BARB = {
    skin: '#f1c7a2',
    skinDark: '#b07e5f',
    hair: '#b8563a',
    hairDark: '#7c3422',
    top: '#f2a7b8',
    topDark: '#c56f86',
    pants: '#5c5470',
    pantsDark: '#3a3448',
    shoes: '#f6f3e6',
    style: 'net',
    apron: true,
    item: 'reach',
    seed: 60
  },
  // Dr. Benedetto: white coat, bow tie, the mustache, and tonight, for no reason, Rowdy's horns.
  DREAM_DOC = {
    skin: '#e2ae88',
    skinDark: '#c99068',
    hair: '#2a1f1c',
    hairDark: '#140e0c',
    top: '#f6f7f2',
    topDark: '#a9b3b8',
    pants: '#2f3540',
    pantsDark: '#1d2128',
    shoes: '#1f1a1a',
    style: 'slick',
    coat: true,
    mustache: '#1d1311',
    bow: '#8c2f3f',
    stetho: true,
    horns: true,
    item: 'probe',
    seed: 80
  };

// ---- State ----
// plan: [{id, def, start, dur, v}] for the dream in progress; last: the ids of the most recent plan.
let dream = {
  active: false,
  waking: false,
  t: 0,
  idle: 0,
  px: NaN,
  py: NaN,
  plan: [],
  last: [],
  wakeAt: 0,
  wakeLen: 0,
  nurse: '',
  ps: '',
  blipKey: '',
  blips: 0,
  count: 0
};

// The stage the vignettes draw on this frame: sw wide (600 to 1000) and 625 tall, plus the text scale.
let dreamView = { sw: 1000, w: 1000, h: 625, ui: 1 },
  dreamCv = null,
  dreamCvKey = '',
  dreamClickDebt = false;

const dreamGlyphs = new Map(),
  dreamMixes = new Map();

// ---- Small helpers ----
const dreamName = () => (typeof state.name === 'string' && state.name.trim()) || 'Macy',
  dreamFill = text =>
    String(text)
      .replace(/\{name\}/g, dreamName())
      .replace(/\{NAME\}/g, dreamName().toUpperCase()),
  dreamLerp = (a, b, f) => a + (b - a) * f,
  dreamBoil = t => Math.floor(t * 6);

function dreamEase(x) {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
}

function dreamSpan(a, b, x) {
  return dreamEase((x - a) / (b - a));
}

// Steady noise in [-1, 1]: the same inputs always give the same wobble.
function dreamHash(a, b = 0, c = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

function dreamAlpha(g) {
  const a = g.globalAlpha;
  return typeof a === 'number' && Number.isFinite(a) ? a : 1;
}

function dreamRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3 || h.length === 4)
    h = h
      .slice(0, 3)
      .split('')
      .map(ch => ch + ch)
      .join('');
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
}

// a blended toward b by f, as #rrggbb (alpha dropped).
function dreamMix(a, b, f) {
  const k = clamp(f, 0, 1),
    key = a + b + k.toFixed(2);
  let out = dreamMixes.get(key);
  if (!out) {
    const x = dreamRgb(a),
      y = dreamRgb(b);
    out = '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
    if (dreamMixes.size > 400) dreamMixes.clear();
    dreamMixes.set(key, out);
  }
  return out;
}

function dreamFont(size, hand = false) {
  return `700 ${Math.round(size * 10) / 10}px ${hand ? DREAM_HAND : DREAM_FONT}`;
}

function dreamTextW(g, text, size, hand = false) {
  g.font = dreamFont(size, hand);
  const m = typeof g.measureText === 'function' ? g.measureText(text) : null;
  return m && Number.isFinite(m.width) ? m.width : String(text).length * size * 0.56;
}

function dreamWrap(g, text, width, size, hand = false) {
  const rows = [];
  let row = '';
  for (const word of String(text).split(' ')) {
    const next = row ? row + ' ' + word : word;
    if (row && dreamTextW(g, next, size, hand) > width) {
      rows.push(row);
      row = word;
    } else row = next;
  }
  if (row) rows.push(row);
  return rows;
}

// Characters typed so far: nothing until delay, then cps a second, capped at the text.
function dreamTyped(t, delay, cps, length) {
  return clamp(Math.floor((t - delay) * cps), 0, length);
}

// ---- Crayon kit ----
// A crayon stroke: the path twice, a little off itself. The wobble boils six times a second, like a
// flip-book drawing.
function dreamCrayon(g, pts, col, w = 3, seed = 0, t = 0, closed = false) {
  if (!pts || pts.length < 2) return;
  const a0 = dreamAlpha(g),
    boil = dreamBoil(t),
    list = closed ? pts.concat([pts[0]]) : pts;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = col;
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    for (let i = 0; i < list.length - 1; i++) {
      const x0 = list[i][0],
        y0 = list[i][1],
        x1 = list[i + 1][0],
        y1 = list[i + 1][1],
        len = Math.hypot(x1 - x0, y1 - y0),
        n = Math.max(1, Math.ceil(len / 18)),
        nx = len > 0 ? -(y1 - y0) / len : 0,
        ny = len > 0 ? (x1 - x0) / len : 0;
      for (let j = i ? 1 : 0; j <= n; j++) {
        const f = j / n,
          off = dreamHash(seed + i * 7.3 + j * 1.7, boil, pass) * (0.7 + w * 0.2),
          x = x0 + (x1 - x0) * f + nx * off,
          y = y0 + (y1 - y0) * f + ny * off;
        if (i === 0 && j === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    }
    g.lineWidth = pass ? w * 0.5 : w;
    g.globalAlpha = a0 * (pass ? 0.55 : 0.92);
    g.stroke();
  }
  g.globalAlpha = a0;
}

function dreamPoly(g, pts) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
}

// A crayon shape: a waxy fill, a scribble of hatching clipped inside it, then a wobbly outline.
function dreamShape(g, pts, fill, edge, seed = 0, t = 0, w = 3) {
  const a0 = dreamAlpha(g);
  if (fill) {
    dreamPoly(g, pts);
    g.fillStyle = fill;
    g.fill();
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    const tall = y1 - y0,
      span = x1 - x0 + tall;
    if (span > 10 && span < 5000) {
      const gap = Math.max(6, span / 70),
        boil = dreamBoil(t);
      g.save();
      dreamPoly(g, pts);
      g.clip();
      g.strokeStyle = dreamMix(fill, '#1d1830', 0.22);
      g.lineWidth = 1.6;
      g.globalAlpha = a0 * 0.26;
      g.beginPath();
      for (let s = 0; s < span; s += gap) {
        const j = dreamHash(seed, s, boil) * 2;
        g.moveTo(x0 + s + j, y0 - 2);
        g.lineTo(x0 + s - tall - 2 + j, y1 + 2);
      }
      g.stroke();
      g.restore();
    }
    g.globalAlpha = a0;
  }
  if (edge) dreamCrayon(g, pts, edge, w, seed + 3, t, true);
}

function dreamOval(x, y, rx, ry, seed = 0, n = 20) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      k = 1 + dreamHash(seed, i) * 0.035;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  return pts;
}

function dreamBox(x, y, w, h) {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h]
  ];
}

function dreamRound(x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)),
    pts = [],
    corners = [
      [x + w - k, y + k, -Math.PI / 2],
      [x + w - k, y + h - k, 0],
      [x + k, y + h - k, Math.PI / 2],
      [x + k, y + k, Math.PI]
    ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]);
    }
  return pts;
}

function dreamGlyph(g, ch, size) {
  const key = size.toFixed(1) + ch;
  let w = dreamGlyphs.get(key);
  if (w === undefined) {
    w = dreamTextW(g, ch, size, true);
    if (dreamGlyphs.size > 600) dreamGlyphs.clear();
    dreamGlyphs.set(key, w);
  }
  return w;
}

// Kid handwriting: one letter at a time, each tipped a little and off the line. Returns the width.
function dreamScrawl(g, text, x, y, size, col, align = 'center', seed = 0, t = 0) {
  const sz = Math.max(4, size),
    chars = [...String(text)],
    widths = chars.map(ch => dreamGlyph(g, ch, sz)),
    total = widths.reduce((a, b) => a + b, 0),
    boil = dreamBoil(t) % 3;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  g.font = dreamFont(sz, true);
  g.fillStyle = col;
  g.textAlign = 'center';
  chars.forEach((ch, i) => {
    const cw = widths[i];
    if (ch !== ' ') {
      g.save();
      g.translate(cx + cw / 2, y + dreamHash(seed, i) * sz * 0.07);
      g.rotate(dreamHash(seed + 9, i, boil) * 0.08);
      g.fillText(ch, 0, 0);
      g.restore();
    }
    cx += cw;
  });
  g.textAlign = 'left';
  return total;
}

// Lines of scrawl centered on (x, y), sized to fit maxW by maxH.
function dreamScrawlLines(g, lines, x, y, maxW, maxH, col, seed, t, cap = 22) {
  const longest = Math.max(1, ...lines.map(l => l.length)),
    size = Math.max(7, Math.min(cap * dreamView.ui, maxW / (longest * 0.62), maxH / (lines.length * 1.2)));
  lines.forEach((l, i) =>
    dreamScrawl(g, l, x, y + (i - (lines.length - 1) / 2) * size * 1.15 + size * 0.35, size, col, 'center', seed + i * 5, t)
  );
}

// A speech bubble: cream, a crayon edge, a tail toward (tx, ty), text typed up to o.shown characters.
// Stays on the stage. Returns its box.
function dreamBubble(g, text, x, y, tx, ty, o = {}) {
  const ui = dreamView.ui,
    hand = !!o.hand,
    size = (o.size || 17) * ui,
    edge = 44,
    maxW = Math.min((o.maxW || 320) * ui, dreamView.sw - edge * 2 - size * 1.3),
    rows = dreamWrap(g, text, maxW, size, hand),
    lh = size * 1.22,
    tw = Math.max(size, ...rows.map(r => dreamTextW(g, r, size, hand))),
    pad = size * 0.62,
    w = tw + pad * 2,
    h = rows.length * lh + pad * 1.1,
    bx = clamp(x - w / 2, edge, Math.max(edge, dreamView.sw - w - edge)),
    by = clamp(y - h, 36, Math.max(36, 590 - h)),
    r = Math.min(16, h / 2),
    seed = o.seed || 0,
    t = o.t || 0,
    fill = o.fill || DREAM_INK.cream,
    ink = o.edge || DREAM_INK.black;
  rr(g, bx, by, w, h, r, fill);
  dreamCrayon(g, dreamRound(bx, by, w, h, r), ink, 2.2, seed, t, true);
  const below = ty > by + h,
    inside = ty >= by && ty <= by + h && tx >= bx && tx <= bx + w;
  if (!inside) {
    const ex = clamp(tx, bx + r + 8, bx + w - r - 8),
      ey = below ? by + h : by,
      dx = tx - ex,
      dy = ty - ey,
      len = Math.hypot(dx, dy) || 1,
      reach = Math.min(len, size * 1.5),
      tip = [ex + (dx / len) * reach, ey + (dy / len) * reach],
      lip = below ? -2.5 : 2.5;
    poly(g, [[ex - 9, ey + lip], [ex + 9, ey + lip], tip], fill);
    dreamCrayon(g, [[ex - 8, ey], tip, [ex + 8, ey]], ink, 2, seed + 5, t);
  }
  let left = o.shown === undefined ? Infinity : o.shown;
  g.font = dreamFont(size, hand);
  g.fillStyle = o.ink || DREAM_INK.black;
  g.textAlign = 'left';
  rows.forEach((row, i) => {
    if (left <= 0) return;
    g.fillText(row.slice(0, left), bx + pad, by + pad * 0.55 + lh * (i + 0.78));
    left -= row.length + 1;
  });
  return { x: bx, y: by, w, h };
}

// Fill the whole view (full is the view in stage coordinates) and drag a few waxy streaks across it.
function dreamWash(g, full, top, bottom, seed, t) {
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, full.h, top, bottom));
  const a0 = dreamAlpha(g);
  g.globalAlpha = a0 * 0.07;
  for (let i = 0; i < 5; i++) {
    const y = full.y + ((i + 0.5) / 5) * full.h + dreamHash(seed, i) * 20;
    dreamCrayon(g, [[full.x - 10, y], [full.x + full.w + 10, y + dreamHash(seed, i, 2) * 30]], '#ffffff', 10, seed + i, t);
  }
  g.globalAlpha = a0;
}

function dreamStars(g, full, n, seed, t) {
  const a0 = dreamAlpha(g);
  for (let i = 0; i < n; i++) {
    const x = full.x + (dreamHash(seed, i) * 0.5 + 0.5) * full.w,
      y = full.y + (dreamHash(seed, i, 1) * 0.5 + 0.5) * full.h * 0.62;
    g.globalAlpha = a0 * (0.45 + 0.45 * Math.sin(t * 2.1 + i * 1.7));
    spark(g, x, y, '#fff6c8', 0.35 + (i % 3) * 0.15);
  }
  g.globalAlpha = a0;
}

// A cloud: overlapping puffs, outlined first and filled over, so only the outside edge shows.
function dreamCloud(g, x, y, s, fill, edge, seed, t, flat = 1) {
  const puffs = [
    [-0.5, 0.1, 0.42, 0.3],
    [-0.12, -0.18, 0.4, 0.38],
    [0.3, -0.05, 0.38, 0.32],
    [0.58, 0.12, 0.3, 0.24],
    [0, 0.18, 0.62, 0.22]
  ].map(([bx, by, rx, ry], i) => dreamOval(x + bx * s, y + by * s * flat, rx * s, ry * s * flat, seed + i, 16));
  for (const p of puffs) dreamCrayon(g, p, edge, 5, seed, t, true);
  g.fillStyle = fill;
  for (const p of puffs) {
    dreamPoly(g, p);
    g.fill();
  }
}

function dreamFlower(g, x, y, s, petal, seed, t) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  dreamCrayon(g, [[0, 0], [1.5, -10], [0, -21]], '#4f9a4a', 2.4, seed, t);
  ellipse(g, 5, -9, 4.5, 2, '#6dbb5f');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    ellipse(g, Math.cos(a) * 5, -26 + Math.sin(a) * 5, 4.4, 4.4, petal);
  }
  ellipse(g, 0, -26, 3.2, 3.2, '#f6cf47');
  g.restore();
}

function dreamBottle(g, x, y, s, flavor, rot, seed, t) {
  const col = DREAM_FLAVORS[((flavor % 3) + 3) % 3];
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  dreamShape(g, dreamRound(-9, -16, 18, 32, 6), '#f7f2e4', '#7d7468', seed, t, 1.6);
  dreamShape(g, dreamBox(-6, -23, 12, 8), col, '#5c4a3a', seed + 1, t, 1.2);
  rect(g, -9, -5, 18, 10, col);
  label(g, 'E', 0, 4, 8, '#fffaf0', 'center');
  g.restore();
}

function dreamVolleyball(g, x, y, r, rot, seed, t) {
  const rad = Math.max(1, r);
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  ellipse(g, 0, 0, rad, rad, '#fbf6e9');
  g.save();
  g.beginPath();
  g.ellipse(0, 0, rad, rad, 0, 0, Math.PI * 2);
  g.clip();
  // Three curved panels: blue up top, gold low on the left, white for the rest, seams between.
  ellipse(g, rad * 0.75, -rad * 0.95, rad * 1.05, rad * 1.05, '#3f7fd1');
  ellipse(g, -rad * 1.05, rad * 0.55, rad * 0.95, rad * 0.95, '#f6cf47');
  g.lineWidth = Math.max(1, rad * 0.07);
  g.strokeStyle = '#2c283399';
  g.beginPath();
  g.arc(rad * 0.75, -rad * 0.95, rad * 1.05, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(-rad * 1.05, rad * 0.55, rad * 0.95, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(rad * 0.9, rad * 1.1, rad * 1.05, Math.PI * 0.95, Math.PI * 1.55);
  g.stroke();
  g.restore();
  dreamCrayon(g, dreamOval(0, 0, rad, rad, seed, 18), DREAM_INK.black, Math.max(1, rad * 0.08), seed, t, true);
  g.restore();
}

// ---- People and other animals ----

// Macy asleep on her back, head to the left: feet at (x, y), lying along the x axis. Eyelids shut.
function dreamSleeper(g, x, y, s, t, blanket, open = false) {
  g.save();
  g.translate(x, y);
  g.rotate(-Math.PI / 2);
  g.scale(s, s);
  dreamShape(g, dreamOval(0, -72, 26, 15, 11, 16), DREAM_INK.cream, '#8f8c96', 11, t, 2);
  girl(g, 0, 0, 1, 0, 1, false, false);
  if (!open) dreamLids(g);
  if (blanket) dreamShape(g, dreamRound(-22, -50, 44, 58, 9), blanket, dreamMix(blanket, '#1d1830', 0.4), 12, t, 2.2);
  g.restore();
}

// Shut eyes, in girl() coordinates.
function dreamLids(g) {
  for (const ex of [-4.8, 6]) {
    ellipse(g, ex, -65, 3, 4, '#f6cba6');
    path(
      g,
      p => {
        p.moveTo(ex - 2.6, -65.2);
        p.quadraticCurveTo(ex, -63.4, ex + 2.6, -65.2);
      },
      null,
      '#6a4a3c',
      1.1
    );
  }
}

// A grown-up in crayon, feet at (x, y), about 140 units tall at s = 1. look: DREAM_DAD or DREAM_BARB.
function dreamAdult(g, x, y, s, t, L, talking) {
  const a0 = dreamAlpha(g);
  const sd = L.seed || 0;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 2, 22, 5);
  dreamShape(g, [[-14, -50], [-3, -50], [-4, -4], [-13, -4]], L.pants, L.pantsDark, sd + 1, t, 1.8);
  dreamShape(g, [[3, -50], [14, -50], [13, -4], [4, -4]], L.pants, L.pantsDark, sd + 2, t, 1.8);
  dreamShape(g, dreamOval(-10, -3, 9, 4.5, sd + 3, 12), L.shoes, '#3a2a22', sd + 3, t, 1.4);
  dreamShape(g, dreamOval(10, -3, 9, 4.5, sd + 4, 12), L.shoes, '#3a2a22', sd + 4, t, 1.4);
  g.translate(0, Math.sin(t * 2.4) * 1);
  dreamShape(g, [[-21, -100], [21, -100], [18, -48], [-18, -48]], L.top, L.topDark, sd + 5, t, 2.2);
  if (L.zip) dreamCrayon(g, [[0, -97], [0, -51]], '#d5dadc', 1.4, sd + 6, t);
  if (L.apron) {
    dreamShape(g, [[-14, -84], [14, -84], [16, -44], [-16, -44]], '#fbf8ef', '#c9c2b0', sd + 7, t, 1.4);
    dreamCrayon(g, [[-14, -84], [-9, -99]], '#c9c2b0', 1.4, sd + 8, t);
    dreamCrayon(g, [[14, -84], [9, -99]], '#c9c2b0', 1.4, sd + 9, t);
  }
  if (L.coat) {
    dreamCrayon(g, [[-9, -99], [-2, -78], [-3, -50]], '#c9d2d4', 1.6, sd + 26, t);
    dreamCrayon(g, [[9, -99], [2, -78], [3, -50]], '#c9d2d4', 1.6, sd + 27, t);
    dreamShape(g, dreamBox(7, -76, 9, 9), null, '#9fb0b6', sd + 28, t, 1.2);
  }
  // The near arm: a coffee for Dad, a hand on the hip for Barb.
  dreamCrayon(g, [[-19, -95], [-27, -74], [-20, -60]], L.top, 8, sd + 10, t);
  ellipse(g, -19, -58, 4.5, 4.5, L.skin);
  if (L.item === 'coffee') {
    dreamShape(g, dreamBox(-27, -74, 12, 15), DREAM_INK.cream, '#8f8c96', sd + 11, t, 1.3);
    rect(g, -27, -69, 12, 4, '#c9573f');
    const puff = (t * 0.8) % 1;
    g.globalAlpha = dreamAlpha(g) * (1 - puff) * 0.8;
    dreamCrayon(g, [[-22, -78 - puff * 8], [-19, -84 - puff * 8], [-23, -90 - puff * 8]], '#ffffff', 1.5, sd + 12, t);
    g.globalAlpha = a0;
  }
  // The far arm: the pinched-fingers wave (Dad, mid-joke), or reaching out for the lever (Barb).
  const wave = Math.sin(t * 4.2) * 7;
  if (L.gesture) {
    dreamCrayon(g, [[19, -95], [31, -80], [27, -103 + wave]], L.top, 8, sd + 13, t);
    dreamShape(g, dreamOval(27, -103 + wave, 5, 4.5, sd + 14, 10), L.skin, L.skinDark, sd + 14, t, 1.2);
    dreamShape(g, [[24, -106 + wave], [30, -106 + wave], [27.5, -113 + wave]], L.skin, L.skinDark, sd + 21, t, 1);
  } else if (L.item === 'probe') {
    // The ultrasound wand, held out like a microphone.
    dreamCrayon(g, [[19, -95], [33, -86], [44, -90]], L.top, 8, sd + 13, t);
    ellipse(g, 46, -90, 4.5, 4.5, L.skin);
    dreamShape(g, dreamRound(44, -104, 9, 18, 4), '#e9eef2', '#5a6f7c', sd + 29, t, 1.2);
    dreamCrayon(g, [[48, -86], [52, -70], [62, -66]], '#5a6f7c', 1.4, sd + 30, t);
  } else if (L.item === 'reach') {
    dreamCrayon(g, [[19, -95], [33, -84], [46, -82]], L.top, 8, sd + 13, t);
    ellipse(g, 48, -82, 4.5, 4.5, L.skin);
  } else {
    dreamCrayon(g, [[19, -95], [26, -74], [21, -58]], L.top, 8, sd + 13, t);
    ellipse(g, 21, -56, 4.5, 4.5, L.skin);
  }
  // Head.
  ellipse(g, -15, -116, 3.5, 5, L.skin);
  ellipse(g, 15, -116, 3.5, 5, L.skin);
  dreamShape(g, dreamOval(0, -118, 15, 17, sd + 15, 18), L.skin, L.skinDark, sd + 15, t, 1.8);
  if (L.style === 'wavy') {
    dreamShape(
      g,
      [[-16, -116], [-16, -129], [-9, -137], [0, -139], [9, -137], [16, -129], [16, -116], [11, -126], [5, -124], [-1, -128], [-6, -124], [-11, -127]],
      L.hair,
      L.hairDark,
      sd + 16,
      t,
      1.6
    );
  } else if (L.style === 'slick') {
    dreamShape(g, [[-16, -117], [-16, -130], [-9, -137], [1, -139], [10, -136], [16, -129], [16, -118], [9, -129], [-3, -131], [-11, -127]], L.hair, L.hairDark, sd + 16, t, 1.6);
    dreamCrayon(g, [[-8, -134], [4, -136], [12, -131]], '#5a4a44', 1, sd + 31, t);
  } else {
    dreamShape(g, dreamOval(0, -141, 8, 7, sd + 17, 12), L.hair, L.hairDark, sd + 17, t, 1.4);
    dreamShape(g, [[-16, -114], [-15, -130], [-6, -137], [6, -137], [15, -130], [16, -114], [10, -127], [-10, -127]], L.hair, L.hairDark, sd + 18, t, 1.6);
    g.globalAlpha = dreamAlpha(g) * 0.5;
    for (let i = -2; i <= 2; i++) dreamCrayon(g, [[i * 5, -136], [i * 6.5, -126]], '#ffffff', 0.8, sd + 19 + i, t);
    dreamCrayon(g, [[-13, -128], [0, -134], [13, -128]], '#ffffff', 0.8, sd + 25, t);
    g.globalAlpha = a0;
  }
  for (const ex of [-5.5, 5.5]) {
    ellipse(g, ex, -117, 1.8, 2.3, '#3b2a20');
    dreamCrayon(g, [[ex - 3.5, -123], [ex + 3, -124.5]], L.hairDark, 1.4, sd + 20 + ex, t);
  }
  if (L.stubble)
    for (let i = 0; i < 11; i++) {
      const a = 0.35 + (i / 10) * 2.45;
      ellipse(g, Math.cos(a) * 10, -112 + Math.sin(a) * 9, 0.6, 0.6, '#5c4636');
    }
  if (talking) ellipse(g, 0, -106, 4, 1 + Math.abs(Math.sin(t * 14)) * 3, '#7a3b3b');
  else
    path(
      g,
      p => {
        p.moveTo(-5, -107);
        p.quadraticCurveTo(0, -103, 5, -107);
      },
      null,
      '#7a3b3b',
      1.4
    );
  if (L.mustache) {
    // The handlebar. Load-bearing.
    dreamCrayon(g, [[-12, -107], [-9, -110], [-3, -110.5], [0, -109], [3, -110.5], [9, -110], [12, -107]], L.mustache, 3.4, sd + 32, t);
    dreamCrayon(g, [[-12, -107], [-14, -110]], L.mustache, 2, sd + 33, t);
    dreamCrayon(g, [[12, -107], [14, -110]], L.mustache, 2, sd + 34, t);
  }
  if (L.bow) {
    poly(g, [[0, -99], [-9, -104], [-9, -94]], L.bow);
    poly(g, [[0, -99], [9, -104], [9, -94]], L.bow);
    ellipse(g, 0, -99, 2.4, 2.4, dreamMix(L.bow, '#000000', 0.3));
  }
  if (L.stetho) {
    dreamCrayon(g, [[-9, -98], [-13, -84], [-5, -74]], '#4a5263', 1.6, sd + 35, t);
    dreamCrayon(g, [[9, -98], [12, -86]], '#4a5263', 1.6, sd + 36, t);
    ellipse(g, -5, -73, 3.4, 3.4, '#c9ced6');
  }
  if (L.horns) dreamHorns(g, 0, -128, 1, t, sd + 37);
  g.restore();
}

// The night nurse in the real room (clean art, not crayon): teal scrubs, penlight, clipboard.
function dreamNurse(g, x, y, s, t, talking) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 2, 20, 5);
  rr(g, -11, -46, 9, 44, 4, '#4f97a9');
  rr(g, 2, -46, 9, 44, 4, '#4f97a9');
  rr(g, -13, -5, 13, 7, 3, '#f6f3e6', '#9aa7ab', 1);
  rr(g, 0, -5, 13, 7, 3, '#f6f3e6', '#9aa7ab', 1);
  rr(g, -17, -94, 34, 52, 10, gradient(g, 0, -94, 0, 52, '#7fc7d6', '#5aa5b8'), '#3f8396', 1.2);
  line(g, [[-7, -93], [0, -83], [7, -93]], '#3f8396', 1.5);
  rr(g, 5, -78, 9, 11, 2, '#f6f3e6', '#3f8396', 0.8);
  path(
    g,
    p => {
      p.moveTo(-9, -92);
      p.quadraticCurveTo(-11, -70, -2, -66);
    },
    null,
    '#39434a',
    2
  );
  ellipse(g, -2, -65, 3, 3, '#9aa7ab');
  // Penlight toward the bed; the clipboard down by her side.
  line(g, [[-16, -89], [-30, -76], [-42, -80]], '#5aa5b8', 7);
  ellipse(g, -43, -80, 4, 4, '#e8b48f');
  line(g, [[-45, -81], [-56, -85]], '#d8dee0', 3);
  glow(g, -60, -86, 18, '#fff6c288');
  line(g, [[16, -89], [21, -66], [18, -52]], '#5aa5b8', 7);
  rr(g, 12, -68, 15, 19, 2, '#c99a5b');
  rr(g, 14, -66, 11, 15, 1, '#fffaf0');
  ellipse(g, 18, -50, 4, 4, '#e8b48f');
  rr(g, -3.5, -103, 7, 10, 3, '#d9a27f');
  ellipse(g, 0, -114, 13, 14.5, '#e8b48f');
  ellipse(g, 0, -122, 14, 8, '#2b1d1a');
  ellipse(g, 0, -133, 7, 6, '#2b1d1a');
  ellipse(g, -12, -115, 3, 7, '#2b1d1a');
  ellipse(g, -4.5, -113, 1.6, 2.2, '#2f2a30');
  ellipse(g, 4.5, -113, 1.6, 2.2, '#2f2a30');
  if (talking) ellipse(g, 0, -106, 3, 1 + Math.abs(Math.sin(t * 15)) * 2, '#8a4b4b');
  else
    path(
      g,
      p => {
        p.moveTo(-4, -107);
        p.quadraticCurveTo(0, -104, 4, -107);
      },
      null,
      '#8a4b4b',
      1.2
    );
  g.restore();
}

// A sitting cat in a nurse's cap, feet at (x, y), facing us.
function dreamCat(g, x, y, s, fur, dark, t, seed, chest = null, cap = true) {
  const sway = Math.sin(t * 2.2 + seed) * 5;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 1, 18, 4);
  dreamCrayon(g, [[13, -4], [27, -10 + sway * 0.3], [30, -24 + sway], [23, -33 + sway]], fur, 6, seed, t);
  dreamShape(g, [[-15, 0], [-18, -17], [-11, -35], [11, -35], [18, -17], [15, 0]], fur, dark, seed + 1, t, 2);
  if (chest) ellipse(g, 0, -18, 7, 12, chest);
  ellipse(g, -8, -1, 5, 3.5, chest || fur);
  ellipse(g, 8, -1, 5, 3.5, chest || fur);
  dreamShape(g, [[-14, -50], [-12, -64], [-4, -55]], fur, dark, seed + 2, t, 1.6);
  dreamShape(g, [[14, -50], [12, -64], [4, -55]], fur, dark, seed + 3, t, 1.6);
  dreamShape(g, dreamOval(0, -45, 16, 13, seed + 4, 16), fur, dark, seed + 4, t, 2);
  const blink = (t * 0.7 + seed * 0.37) % 4 > 3.82;
  for (const ex of [-6, 6]) {
    if (blink) line(g, [[ex - 3, -46], [ex + 3, -46]], '#2c2833', 1.3);
    else {
      ellipse(g, ex, -46, 3, 3.6, '#f5d94a');
      ellipse(g, ex, -46, 1, 3, '#2c2833');
    }
  }
  poly(g, [[-2, -41], [2, -41], [0, -39]], '#f08aa0');
  line(g, [[-3, -37], [0, -38.5], [3, -37]], '#2c2833', 1);
  for (const side of [-1, 1]) {
    line(g, [[side * 5, -40], [side * 17, -42]], '#2c283388', 0.8);
    line(g, [[side * 5, -39], [side * 17, -37]], '#2c283388', 0.8);
  }
  // The cap, with its red cross.
  if (!cap) {
    g.restore();
    return;
  }
  dreamShape(g, [[-10, -55], [10, -55], [7, -64], [-7, -64]], DREAM_INK.cream, '#8f8c96', seed + 5, t, 1.3);
  rect(g, -1.2, -63, 2.4, 7, DREAM_INK.red);
  rect(g, -3.5, -60.7, 7, 2.4, DREAM_INK.red);
  g.restore();
}

// A friend on the cloud court: feet at (x, y), facing us, a name across the jersey, one arm waving.
function dreamKid(g, x, y, s, hair, name, t, phase, top = DREAM_INK.royal) {
  const skin = '#f3c9a5',
    skinDark = '#b07e5f';
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  for (const side of [-1, 1]) {
    dreamCrayon(g, [[side * 6, -42], [side * 7, -2]], skin, 6, phase + side, t);
    ellipse(g, side * 7, -15, 4.5, 3.5, '#fffaf0');
    ellipse(g, side * 7.5, -1, 6, 3.2, '#2c2833');
  }
  dreamShape(g, dreamBox(-13, -50, 26, 12), '#1f3f8f', '#14275a', phase + 2, t, 1.4);
  dreamShape(g, [[-15, -86], [15, -86], [13, -48], [-13, -48]], top, dreamMix(top, '#14275a', 0.55), phase + 3, t, 1.6);
  const size = Math.min(7.2, 25 / Math.max(1, name.length * 0.62));
  label(g, name, 0, -70, size, DREAM_INK.gold, 'center');
  dreamCrayon(g, [[-14, -82], [-21, -64], [-19, -52]], skin, 5, phase + 4, t);
  const a = -1.25 + Math.sin(t * 6 + phase) * 0.45,
    hx = 14 + Math.cos(a) * 22,
    hy = -82 + Math.sin(a) * 22;
  dreamCrayon(g, [[14, -82], [hx, hy]], skin, 5, phase + 5, t);
  ellipse(g, hx, hy, 3.6, 3.6, skin);
  ellipse(g, Math.sin(phase) * 2 + 12, -104, 6, 9, hair);
  dreamShape(g, dreamOval(0, -100, 11, 12, phase + 6, 16), skin, skinDark, phase + 6, t, 1.4);
  dreamShape(g, [[-12, -100], [-11, -110], [-4, -114], [6, -114], [12, -108], [12, -100], [6, -107], [-6, -107]], hair, dreamMix(hair, '#000000', 0.35), phase + 7, t, 1.3);
  ellipse(g, -4, -99, 1.4, 1.8, '#2c2833');
  ellipse(g, 4, -99, 1.4, 1.8, '#2c2833');
  path(
    g,
    p => {
      p.moveTo(-4, -94);
      p.quadraticCurveTo(0, -90, 4, -94);
    },
    null,
    '#8a4b4b',
    1.2
  );
  g.restore();
}

// Ralph, the boss gremlin, shrunk and crowned.
function dreamRalph(g, x, y, s, t) {
  gremlin(g, x, y, s, 1, t);
  const top = y - 46 * s + Math.sin(t * 3.4) * 2.8 * s;
  dreamShape(
    g,
    [[x - 12 * s, top], [x - 13 * s, top - 13 * s], [x - 6 * s, top - 6 * s], [x, top - 15 * s], [x + 6 * s, top - 6 * s], [x + 13 * s, top - 13 * s], [x + 12 * s, top]],
    DREAM_INK.gold,
    '#a8761f',
    71,
    t,
    1.5
  );
}

// The LEGO E-Type, side on, nose to the right: wheels on the ground at (x, y), about 300 long at s = 1.
function dreamEtype(g, x, y, s, t, gType, seed, num = '22') {
  const a0 = dreamAlpha(g);
  const green = '#2f7a4c',
    dark = '#1c4a30',
    light = '#4fa36d',
    spin = t * 7;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 2, 150, 10);
  const beam = g.createLinearGradient(146, 0, 520, 0);
  beam.addColorStop(0, '#fff6c2aa');
  beam.addColorStop(1, '#fff6c200');
  poly(g, [[146, -62], [520, -130], [520, 14], [146, -50]], beam);
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.9 + i / 3) % 1;
    g.globalAlpha = dreamAlpha(g) * (1 - k) * 0.6;
    ellipse(g, -160 - k * 50, -28 - k * 14, 7 + k * 12, 6 + k * 10, '#c9ced6');
    g.globalAlpha = a0;
  }
  if (gType !== null && gType !== undefined) gremlin(g, -40, -78, 0.72, gType, t * 1.5);
  const top = [[-152, -58], [-140, -76], [-112, -88], [-76, -82], [-28, -80], [10, -82], [60, -90], [110, -82], [140, -68], [150, -56]],
    body = [[-150, -34], ...top, [152, -42], [146, -32]];
  dreamShape(g, body, green, dark, seed, t, 2.6);
  for (let sx = -138; sx <= 132; sx += 18) {
    let ty = -64;
    for (let i = 0; i < top.length - 1; i++)
      if (sx >= top[i][0] && sx <= top[i + 1][0])
        ty = dreamLerp(top[i][1], top[i + 1][1], (sx - top[i][0]) / (top[i + 1][0] - top[i][0]));
    if (sx > -70 && sx < -6) continue;
    rr(g, sx - 5, ty - 6, 10, 6, 2, light, dark, 1);
  }
  for (let sx = -114; sx < 140; sx += 36) line(g, [[sx, -40], [sx, -60]], '#1c4a3066', 1.2);
  dreamShape(g, [[0, -84], [8, -108], [14, -108], [12, -82]], '#cdeefa', '#6f9fb3', seed + 2, t, 1.5);
  dreamCrayon(g, dreamOval(-12, -92, 5, 8, seed + 3, 10), '#2c2833', 2, seed + 3, t, true);
  dreamShape(g, dreamOval(-46, -56, 14, 14, seed + 4, 16), DREAM_INK.cream, '#2c2833', seed + 4, t, 1.4);
  label(g, num, -46, -51, 13, '#2c2833', 'center');
  ellipse(g, 146, -56, 6, 7, '#fff4b0');
  glow(g, 150, -56, 30, '#fff4b088');
  rr(g, -153, -62, 5, 10, 2, DREAM_INK.red);
  for (const wx of [-95, 95]) {
    ellipse(g, wx, -26, 30, 30, dark);
    ellipse(g, wx, -26, 25, 25, '#1d1d22');
    ellipse(g, wx, -26, 12, 12, '#c9ced6');
    for (let k = 0; k < 4; k++) {
      const a = spin + (k * Math.PI) / 2;
      line(g, [[wx, -26], [wx + Math.cos(a) * 11, -26 + Math.sin(a) * 11]], '#7d8590', 2);
    }
  }
  g.restore();
}

// ---- Dream logic: things that will not hold still ----

// Her number, which will not stay put: 22, 23, 2, then 22 again as if nothing happened.
const DREAM_JERSEY = ['22', '23', '2', '22'];

function dreamJersey(t, seed = 0) {
  return DREAM_JERSEY[Math.floor(Math.max(0, t + seed) / 1.3) % DREAM_JERSEY.length];
}

// Text that reads differently the second time: every period seconds a sign turns edge-on and comes
// back saying the next thing. i is which text, sx the squash for the turn.
function dreamFlip(t, period, n) {
  const p = Math.max(0, t) / period + 0.5,
    f = p - Math.floor(p);
  return { i: Math.floor(p) % Math.max(1, n), sx: clamp(Math.min(f, 1 - f) / 0.09, 0.04, 1) };
}

function dreamFlipLabel(g, texts, x, y, size, col, t, period, hand = false, seed = 0) {
  const f = dreamFlip(t, period, texts.length),
    text = dreamFill(texts[f.i]);
  g.save();
  g.translate(x, y);
  g.scale(f.sx, 1);
  if (hand) dreamScrawl(g, text, 0, 0, size, col, 'center', seed + f.i, t);
  else label(g, text, 0, 0, size, col, 'center');
  g.restore();
}

// The biggest size (up to cap) at which the longest of texts fits in width.
function dreamFit(texts, width, cap, k = 0.62) {
  const longest = Math.max(1, ...texts.map(s => dreamFill(s).length));
  return Math.max(6, Math.min(cap, width / (longest * k)));
}

// Dress her in pajamas for one drawing.
function dreamPajamas(fn) {
  const was = girlLookOverride;
  try {
    girlLookOverride = { hoodie: DREAM_PJ, scrunchie: '#fff3a8', socks: '' };
    fn();
  } finally {
    girlLookOverride = was;
  }
}

// Jung's shadow: a second Macy, all silhouette, doing what she does a beat late. Feet at (x, y); step
// is the walk phase; wave (0 to 1) lifts an arm to say hi.
function dreamShade(g, x, y, s, step, wave, t, seed) {
  const a0 = dreamAlpha(g),
    col = '#2a2350',
    k = Math.sin(step) * 7 * (1 - wave);
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.globalAlpha = a0 * 0.5;
  dreamCrayon(g, [[-5, -38], [-5 + k, 0]], col, 9, seed, t);
  dreamCrayon(g, [[5, -38], [5 - k, 0]], col, 9, seed + 1, t);
  dreamShape(g, [[-14, -76], [14, -76], [12, -36], [-12, -36]], col, col, seed + 2, t, 2);
  dreamCrayon(g, [[-13, -72], [-18 - k * 0.4, -46]], col, 7, seed + 3, t);
  const hx = dreamLerp(18 + k * 0.4, 30 + Math.sin(t * 9) * 7, wave),
    hy = dreamLerp(-46, -104, wave);
  dreamCrayon(g, [[13, -72], [dreamLerp(20, 24, wave), dreamLerp(-58, -84, wave)], [hx, hy]], col, 7, seed + 4, t);
  ellipse(g, hx, hy, 5, 5, col);
  dreamShape(g, dreamOval(-13, -94, 6, 12, seed + 5, 12), col, col, seed + 5, t, 1.4);
  dreamShape(g, dreamOval(0, -90, 12, 13, seed + 6, 16), col, col, seed + 6, t, 1.6);
  if (wave > 0.3) {
    g.globalAlpha = a0 * 0.8 * wave;
    ellipse(g, -4, -91, 1.6, 2.2, '#efe6ff');
    ellipse(g, 4, -91, 1.6, 2.2, '#efe6ff');
    line(g, [[-4, -85], [0, -83], [4, -85]], '#efe6ff', 1.2);
  }
  g.restore();
  g.globalAlpha = a0;
}

// A gremlin applauding, politely: small hands meeting in front, a soft clap every half second.
function dreamClapper(g, x, y, s, type, t, seed) {
  const cols = ['#b5da81', '#dda9d1', '#efbe77', '#80d5ec'],
    edges = ['#61967c', '#8b689e', '#ba7b70', '#548cae'],
    k = Math.abs(Math.sin(t * 6 + seed)),
    b = Math.sin((t * 1.3 + seed) * 3.4) * 2.8 * s;
  gremlin(g, x, y, s, type, t * 1.3 + seed);
  for (const side of [-1, 1]) {
    ellipse(g, x + side * (2 + k * 9) * s, y - 21 * s + b, 5.4 * s, 5.4 * s, edges[type % 4]);
    ellipse(g, x + side * (2 + k * 9) * s, y - 21 * s + b, 4.2 * s, 4.2 * s, cols[type % 4]);
  }
}

// The gallbladder, retired and not one bit bitter, waving hello from a cloud: a small green pear with a
// halo. (x, y) is the middle of the cloud it sits in.
function dreamGhost(g, x, y, s, t, seed) {
  const bob = Math.sin(t * 1.9) * 3,
    cy = -30 + bob,
    wave = Math.sin(t * 6.5) * 0.5,
    pear = [];
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  glow(g, 0, cy, 60, '#fffbea66');
  dreamCloud(g, 0, -4, 70, '#ffffff', '#c9d8e6', seed, t, 0.55);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2,
      up = Math.min(0, Math.sin(a));
    pear.push([Math.cos(a) * 18 * (1 + up * 0.45), cy + Math.sin(a) * (Math.sin(a) > 0 ? 16 : 26)]);
  }
  const hx = -30 + Math.sin(wave) * 6,
    hy = cy - 16 + Math.cos(wave) * 3;
  dreamCrayon(g, [[-15, cy + 2], [-24, cy - 4], [hx, hy]], '#5f9f61', 6, seed + 1, t);
  dreamCrayon(g, [[-15, cy + 2], [-24, cy - 4], [hx, hy]], '#a9db8f', 3.6, seed + 2, t);
  dreamShape(g, pear, '#a9db8f', '#5f9f61', seed + 3, t, 2);
  dreamCrayon(g, [[2, cy - 25], [5, cy - 32], [11, cy - 34]], '#5f9f61', 4, seed + 4, t);
  for (const ex of [-6, 6]) {
    ellipse(g, ex, cy - 2, 3, 3.6, '#ffffff');
    ellipse(g, ex - 0.6, cy - 1.4, 1.7, 2.2, '#24352b');
  }
  ellipse(g, -11, cy + 5, 3.4, 2, '#f39aa8');
  ellipse(g, 11, cy + 5, 3.4, 2, '#f39aa8');
  line(g, [[-4, cy + 6], [0, cy + 9], [4, cy + 6]], '#2c4a33', 1.4);
  path(g, p => p.ellipse(1, cy - 40, 12, 3.4, -0.22, 0, Math.PI * 2), null, '#f2c43f', 2.8);
  dreamCloud(g, 4, 16, 54, '#ffffff', '#c9d8e6', seed + 5, t, 0.45);
  g.restore();
}

// A pocket clock melting, slowly, like it read about it in an art book. Hung by its top at (x, y).
function dreamMeltClock(g, x, y, r, t, seed) {
  const droop = r * (0.4 + Math.min(1.3, Math.max(0, t) * 0.22)),
    at = (a, k) => {
      const c = Math.cos(a),
        s = Math.sin(a);
      return [x + c * r * k, y + r * 0.8 + s * r * 0.8 * k + Math.max(0, s) * droop * k * (0.65 + 0.35 * c)];
    },
    pts = [];
  for (let i = 0; i < 26; i++) pts.push(at((i / 26) * Math.PI * 2, 1));
  dreamShape(g, pts, '#f6e7a8', '#a8761f', seed, t, Math.max(1, r * 0.12));
  for (let i = 0; i < 12; i++) {
    const [px, py] = at((i / 12) * Math.PI * 2 - Math.PI / 2, 0.78);
    ellipse(g, px, py, Math.max(0.6, r * 0.06), Math.max(0.6, r * 0.06), '#5c4a3a');
  }
  const [cx, cy] = at(0, 0),
    [mx, my] = at(t * 0.7 - Math.PI / 2, 0.66),
    [hx, hy] = at(t * 0.06 + 1, 0.45);
  line(g, [[cx, cy], [mx, my]], '#2c2833', Math.max(0.8, r * 0.08));
  line(g, [[cx, cy], [hx, hy]], '#2c2833', Math.max(1, r * 0.12));
  ellipse(g, x, y - r * 0.1, r * 0.16, r * 0.2, '#a8761f');
}

// Rowdy's horns, on whoever is wearing them: a gold curl each side. (x, y) is the top of the head.
function dreamHorns(g, x, y, s, t, seed) {
  for (const side of [-1, 1]) {
    const cx = x + side * 17 * s,
      cy = y + 3 * s,
      pts = [];
    for (let i = 0; i <= 18; i++) {
      const f = i / 18,
        a = -Math.PI * 0.95 + f * Math.PI * 1.75,
        r = (15 - f * 9) * s;
      pts.push([cx + side * Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    dreamCrayon(g, pts, '#a8874c', 8 * s, seed + side, t);
    dreamCrayon(g, pts, '#efdcaa', 4.6 * s, seed + side + 2, t);
  }
}

// Eyelids closing over the whole view: k is 0 open to 1 shut.
function dreamBlinkLids(g, full, k) {
  if (k <= 0) return;
  const half = (full.h / 2 + 12) * clamp(k, 0, 1);
  rect(g, full.x, full.y, full.w, half, '#1d1830');
  rect(g, full.x, full.y + full.h - half, full.w, half, '#1d1830');
}

// A plain crayon room for the new vignettes: wall, skirting, floor from y on down.
function dreamRoomWash(g, full, wall, floor, y, seed, t) {
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, y, wall, dreamMix(wall, '#1d1830', 0.08)));
  rect(g, full.x, y, full.w, full.y + full.h - y, floor);
  dreamCrayon(g, [[full.x, y], [full.x + full.w, y]], dreamMix(floor, '#1d1830', 0.35), 4, seed, t);
}

// ---- Vignettes ----
// draw(g, sw, t, v, dur, full): the stage is sw wide (600 to 1000) and 625 tall; full is the whole
// view in stage coordinates, for backgrounds. t runs from 0 for dur seconds, plus the crossfade out.
// v holds what setup() picked when the dream started. A vignette with a voice has typed(t, v, dur):
// the characters shown so far, so the update can blip a syllable as they type.

function dreamHallway(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  const cx = sw / 2 + Math.sin(t * 0.6) * 16,
    cy = 300 + Math.cos(t * 0.45) * 8,
    hw = Math.max(full.w, 700) * 0.62,
    ht = (cy - full.y) * 1.08,
    hb = (full.y + full.h - cy) * 1.08,
    L = z => cx - hw * z,
    R = z => cx + hw * z,
    T = z => cy - ht * z,
    B = z => cy + hb * z,
    far = 0.025;
  poly(g, [[L(1.3), T(1.3)], [R(1.3), T(1.3)], [R(far), T(far)], [L(far), T(far)]], '#eef0dc');
  poly(g, [[L(1.3), T(1.3)], [L(far), T(far)], [L(far), B(far)], [L(1.3), B(1.3)]], '#bcd6c6');
  poly(g, [[R(1.3), T(1.3)], [R(far), T(far)], [R(far), B(far)], [R(1.3), B(1.3)]], '#a8cabb');
  poly(g, [[L(1.3), B(1.3)], [R(1.3), B(1.3)], [R(far), B(far)], [L(far), B(far)]], '#8fb5a6');
  rect(g, L(far), T(far), R(far) - L(far), B(far) - T(far), '#fff7d6');
  glow(g, cx, cy, 80, '#fff7d6aa');
  // Door frames recede toward the vanishing point, and the doors multiply.
  const u = t * 0.55 + t * t * 0.035,
    k0 = Math.ceil(-u),
    many = t > 2.2,
    twin = t > 4.2;
  for (let k = k0 + 12; k >= k0; k--) {
    const zn = 0.95 * Math.pow(0.72, k + u),
      zf = zn * 0.72,
      par = ((k % 2) + 2) % 2;
    if (zn < 0.03) continue;
    const la = dreamLerp(zn, zf, 0.3),
      lb = dreamLerp(zn, zf, 0.6);
    poly(g, [[cx - hw * 0.16 * la, T(la)], [cx + hw * 0.16 * la, T(la)], [cx + hw * 0.16 * lb, T(lb)], [cx - hw * 0.16 * lb, T(lb)]], '#fffbe0');
    for (const side of [-1, 1]) {
      if (!(many || (side < 0 ? par === 0 : par === 1))) continue;
      const spans = twin ? [[0.08, 0.42], [0.56, 0.9]] : [[0.22, 0.68]];
      spans.forEach(([a, b], j) => {
        const za = dreamLerp(zn, zf, a),
          zb = dreamLerp(zn, zf, b),
          X = z => cx + side * hw * z,
          top = z => B(z) - (B(z) - T(z)) * 0.7,
          col = DREAM_DOORS[(((k * 2 + j + (side > 0 ? 1 : 0) + v.shift) % 5) + 5) % 5];
        dreamShape(g, [[X(za), B(za)], [X(za), top(za)], [X(zb), top(zb)], [X(zb), B(zb)]], col, '#3d4b52', k * 5 + j + side, t, 0.6 + 2.4 * za);
        const size = 34 * za;
        if (size > 5) dreamScrawl(g, '5', (X(za) + X(zb)) / 2, (top(za) + B(za)) / 2 + size * 0.3, size, DREAM_INK.black, 'center', k + j, t);
      });
    }
    dreamCrayon(g, [[L(zn), T(zn)], [R(zn), T(zn)], [R(zn), B(zn)], [L(zn), B(zn)]], '#5f7d75', 0.6 + 3 * zn, k * 3, t, true);
    dreamCrayon(g, [[cx, B(zn)], [cx, B(dreamLerp(zn, zf, 0.5))]], '#f7f3dd', 1 + 4 * zn, k * 3 + 1, t);
  }
  for (const [x0, y0, x1, y1] of [
    [L(1.3), T(1.3), L(far), T(far)],
    [R(1.3), T(1.3), R(far), T(far)],
    [L(1.3), B(1.3), L(far), B(far)],
    [R(1.3), B(1.3), R(far), B(far)]
  ])
    dreamCrayon(g, [[x0, y0], [x1, y1]], '#4b6760', 4, x0 + y0, t);
  // The sign, swinging from the ceiling.
  const ui = Math.min(dreamView.ui, 1.4),
    title = 'ROOM 10 · ' + (10 + Math.floor(t * t * 0.5)) + ' MILES',
    size = Math.min(30 * ui, (sw - 80) / (title.length * 0.62)),
    subs = [v.sub, v.sub2 || v.sub],
    sub = subs[0].length >= subs[1].length ? subs[0] : subs[1],
    subSize = Math.min(13 * ui, (sw - 80) / (sub.length * 0.6)),
    bw = Math.max(dreamTextW(g, title, size), dreamTextW(g, sub, subSize)) + 46,
    bh = size + subSize + 34;
  g.save();
  g.translate(sw / 2, 46);
  g.rotate(Math.sin(t * 1.3) * 0.05);
  for (const side of [-1, 1]) dreamCrayon(g, [[side * (bw / 2 - 20), full.y - 60], [side * (bw / 2 - 20), 10]], '#8f8c96', 2, 90 + side, t);
  dreamShape(g, dreamRound(-bw / 2, 10, bw, bh, 12), '#2f6f5e', '#173d33', 91, t, 3);
  label(g, title, 0, 22 + size * 0.9, size, '#fff6dc', 'center');
  dreamFlipLabel(g, subs, 0, 22 + size + subSize * 1.15, subSize, '#cfe8d6', t, 2.4);
  g.restore();
  // The faster she walks, the farther it gets. Her shadow keeps up, a beat late, then says hi.
  const pace = t * 7.5 + t * t * 0.6,
    hi = dreamSpan(4.2, 4.8, t);
  dreamShade(g, sw / 2 + 130, 570, 1.3, Math.max(0, t - 0.5) * 7.5 + Math.max(0, t - 0.5) ** 2 * 0.6, hi, t, 95);
  if (hi > 0.5) dreamScrawl(g, 'hi.', sw / 2 + 170, 430, 18 * ui, '#efe6ff', 'left', 96, t);
  girl(g, sw / 2, 590, 1.45, pace, 1, false, true);
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.6 + i / 3) % 1;
    g.globalAlpha = dreamAlpha(g) * (1 - k) * 0.7;
    dreamCrayon(g, [[sw / 2 - 40 - k * 40, 530 + i * 18], [sw / 2 - 70 - k * 40, 530 + i * 18]], '#ffffff', 3, i, t);
    g.globalAlpha = a0;
  }
}

function dreamMap(g, sw, t, v, dur, full) {
  rect(g, full.x, full.y, full.w, full.h, DREAM_INK.paper);
  const first = full.y + ((((40 - full.y) % 32) + 32) % 32);
  for (let y = first; y < full.y + full.h; y += 32) line(g, [[full.x, y], [full.x + full.w, y]], '#9cc3e655', 1.2);
  line(g, [[34, full.y], [34, full.y + full.h]], '#e2574c66', 1.5);
  const pw = Math.min(sw - 76, 820),
    ph = Math.min(pw * 0.52, 380),
    px = (sw - pw) / 2 + 8,
    py = 150,
    X = f => px + f * pw,
    Y = f => py + f * ph,
    show = at => clamp((t - at) * 3, 0, 1),
    a0 = dreamAlpha(g),
    ui = Math.min(dreamView.ui, 1.4);
  dreamScrawl(g, 'MAP OF HERE', px + 24, 84, 34 * ui, DREAM_INK.royal, 'left', 1, t);
  dreamScrawl(g, 'BY ' + dreamName().toUpperCase(), px + 28, 120, 16 * ui, '#5a5566', 'left', 2, t);
  g.globalAlpha = a0 * show(0.1);
  dreamShape(g, dreamBox(X(0), Y(0.4), pw, ph * 0.16), '#fffdf4', null, 3, t);
  const rooms = [
    { r: [0, 0, 0.36, 0.4], fill: '#f9c3d2', label: ['MY ROOM'], at: 0.5 },
    { r: [0.36, 0, 0.32, 0.4], fill: '#bfe0f2', label: ['THE LOUD', 'DONUT'], at: 0.9 },
    { r: [0.68, 0, 0.32, 0.4], fill: '#d9c6ef', label: ["RALPH'S", 'HOUSE', '(DO NOT)'], at: 1.3, ink: '#b8322a' },
    { r: [0, 0.56, 0.32, 0.44], fill: '#fbe0a6', label: ['COOKIE ROOM', '(MIMI)'], at: 1.7 },
    { r: [0.32, 0.56, 0.2, 0.44], fill: '#c8ecc4', label: v.desk, at: 2.0 },
    { r: [0.52, 0.56, 0.3, 0.44], fill: '#bfeee3', label: v.goo, at: 2.3 },
    { r: [0.82, 0.56, 0.18, 0.44], fill: '#ffd0a8', label: v.shop, at: 2.6 }
  ];
  rooms.forEach((rm, i) => {
    const a = show(rm.at);
    if (a <= 0) return;
    const [fx, fy, fw, fh] = rm.r,
      x = X(fx),
      y = Y(fy),
      w = fw * pw,
      h = fh * ph;
    g.globalAlpha = a0 * a;
    dreamShape(g, dreamBox(x + 3, y + 3, w - 6, h - 6), rm.fill, DREAM_INK.black, 20 + i * 7, t, 3);
    dreamScrawlLines(g, rm.label, x + w / 2, y + h / 2 + (fy ? 8 : -6), w - 18, h - 30, rm.ink || DREAM_INK.black, 30 + i * 11, t);
  });
  g.globalAlpha = a0 * show(0.2);
  dreamCrayon(g, dreamBox(X(0), Y(0), pw, ph), DREAM_INK.black, 4, 4, t, true);
  dreamShape(g, dreamBox(X(0) + 4, Y(0.4) + 5, pw * 0.08, ph * 0.16 - 10), '#d7d2c8', DREAM_INK.black, 5, t, 2);
  dreamScrawl(g, v.lift, X(0.1), Y(0.48) + 6, Math.min(15 * ui, ph * 0.07), '#5a5566', 'left', 6, t);
  // Doodles, last: the stick-figure ME, Ralph's crown, a sun in shades, YOU ARE HERE, a gremlin, NO.
  g.globalAlpha = a0 * show(3.0);
  const mx = X(0.12),
    my = Y(0.3);
  dreamCrayon(g, dreamOval(mx, my - 26, 7, 7, 7, 12), DREAM_INK.black, 2, 7, t, true);
  dreamCrayon(g, [[mx, my - 19], [mx, my - 4]], DREAM_INK.black, 2, 8, t);
  dreamCrayon(g, [[mx - 9, my - 14], [mx, my - 12], [mx + 9, my - 16]], DREAM_INK.black, 2, 9, t);
  dreamCrayon(g, [[mx - 7, my + 6], [mx, my - 4], [mx + 7, my + 6]], DREAM_INK.black, 2, 10, t);
  dreamScrawl(g, 'ME', mx + 18, my - 6, 14 * ui, DREAM_INK.red, 'left', 11, t);
  heart(g, mx + 40 * ui, my - 22, 0.9, DREAM_INK.red);
  g.globalAlpha = a0 * show(3.2);
  const kx = X(0.94),
    ky = Y(0.08);
  dreamShape(g, [[kx - 14, ky + 10], [kx - 16, ky - 6], [kx - 7, ky + 2], [kx, ky - 9], [kx + 7, ky + 2], [kx + 16, ky - 6], [kx + 14, ky + 10]], DREAM_INK.gold, '#a8761f', 12, t, 2);
  g.globalAlpha = a0 * show(3.4);
  for (let i = 0; i < 3; i++) {
    const cxk = X(0.06 + i * 0.05),
      cyk = Y(0.94);
    dreamShape(g, dreamOval(cxk, cyk, 9, 9, 13 + i, 12), '#d39a5c', '#8a5a2c', 13 + i, t, 1.5);
    ellipse(g, cxk - 3, cyk - 2, 1.5, 1.5, '#4a2c18');
    ellipse(g, cxk + 3, cyk + 2, 1.5, 1.5, '#4a2c18');
  }
  g.globalAlpha = a0 * show(3.6);
  const sx = sw - 58,
    sy = 62;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.4;
    dreamCrayon(g, [[sx + Math.cos(a) * 30, sy + Math.sin(a) * 30], [sx + Math.cos(a) * 44, sy + Math.sin(a) * 44]], '#f29a3d', 3, 20 + i, t);
  }
  dreamShape(g, dreamOval(sx, sy, 24, 24, 21, 16), DREAM_INK.gold, '#e08a1e', 21, t, 2.5);
  rr(g, sx - 17, sy - 6, 14, 8, 3, '#2c2833');
  rr(g, sx + 3, sy - 6, 14, 8, 3, '#2c2833');
  line(g, [[sx - 3, sy - 3], [sx + 3, sy - 3]], '#2c2833', 2);
  g.globalAlpha = a0 * show(3.8);
  const ax = X(0.27),
    ay = Y(0.31),
    tx0 = X(0.34),
    ty0 = Y(0.5);
  const bend = [dreamLerp(tx0, ax, 0.5) + 10, dreamLerp(ty0, ay, 0.5)],
    adx = ax - bend[0],
    ady = ay - bend[1],
    alen = Math.hypot(adx, ady) || 1,
    ux = adx / alen,
    uy = ady / alen;
  dreamCrayon(g, [[tx0, ty0], bend, [ax, ay]], DREAM_INK.red, 3, 22, t);
  dreamCrayon(g, [[ax - ux * 14 - uy * 8, ay - uy * 14 + ux * 8], [ax, ay], [ax - ux * 14 + uy * 8, ay - uy * 14 - ux * 8]], DREAM_INK.red, 3, 23, t);
  dreamScrawl(g, 'YOU ARE HERE', tx0 + 8, ty0 + 6, 14 * ui, DREAM_INK.red, 'left', 24, t);
  g.globalAlpha = a0 * show(4.0);
  const gx = X(0.6),
    gy = Y(0.48);
  dreamShape(g, dreamOval(gx, gy, 14, 11, 25, 12), '#9fd36a', '#4f7a2e', 25, t, 2);
  ellipse(g, gx - 4, gy - 2, 2, 2.5, '#2c2833');
  ellipse(g, gx + 4, gy - 2, 2, 2.5, '#2c2833');
  dreamCrayon(g, dreamOval(gx, gy, 22, 20, 26, 16), DREAM_INK.red, 3, 26, t, true);
  dreamCrayon(g, [[gx - 15, gy + 14], [gx + 15, gy - 14]], DREAM_INK.red, 3, 27, t);
  dreamScrawl(g, 'NO', gx + 30, gy + 6, 15 * ui, DREAM_INK.red, 'left', 28, t);
  g.globalAlpha = a0;
  // The crayon still drawing, until the last doodle.
  if (t < 4.4) {
    const steps = [
        [X(0.5), Y(0.5)],
        [X(0.18), Y(0.2)],
        [X(0.52), Y(0.2)],
        [X(0.84), Y(0.2)],
        [X(0.16), Y(0.78)],
        [X(0.42), Y(0.78)],
        [X(0.67), Y(0.78)],
        [X(0.91), Y(0.78)],
        [mx, my],
        [kx, ky],
        [X(0.1), Y(0.94)],
        [sx, sy],
        [ax, ay],
        [gx, gy]
      ],
      times = [0.1, 0.5, 0.9, 1.3, 1.7, 2.0, 2.3, 2.6, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0];
    let i = 0;
    while (i < times.length - 1 && t >= times[i + 1]) i++;
    const [cxp, cyp] = steps[i],
      jx = cxp + Math.sin(t * 23) * 10,
      jy = cyp + Math.cos(t * 19) * 7;
    g.save();
    g.translate(jx, jy);
    g.rotate(-0.7);
    rr(g, 0, -6, 70, 12, 3, DREAM_INK.red);
    rr(g, 14, -6, 40, 12, 2, '#f6e9d3');
    poly(g, [[0, -6], [0, 6], [-14, 0]], '#c94337');
    g.restore();
  }
}

function dreamSorry(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  dreamWash(g, full, '#3a3470', '#8a76b8', 31, t);
  dreamStars(g, full, 26, 32, t);
  const cx = sw / 2,
    cy = 370,
    ex = cx,
    ey = cy + 40,
    walk = dur * 0.45;
  dreamCloud(g, cx, cy + 50, 380, '#f4f0ff', '#8f86b8', 33, t, 0.55);
  dreamSleeper(g, cx + 84, cy + 8, 1.95, t, '#f39fb9');
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.45 + i / 3) % 1;
    g.globalAlpha = dreamAlpha(g) * Math.sin(k * Math.PI);
    dreamScrawl(g, i % 2 ? 'z' : 'Z', cx - 70 - k * 20 + i * 14, cy - 40 - k * 90, 18 + i * 6, '#efe6ff', 'center', 34 + i, t);
    g.globalAlpha = a0;
  }
  // Twelve tiny gremlins, each with a flower: in a line from the right, each to its spot around her.
  const crew = [];
  for (let i = 0; i < 12; i++) {
    const th = Math.PI * (1.08 - (1.16 * i) / 11),
      tx = ex + Math.cos(th) * Math.min(330, sw * 0.42),
      ty = ey + Math.sin(th) * 84,
      sx = sw + 70 + i * 50,
      sy = 560,
      d = i * 0.22,
      p = dreamEase((t - d) / walk),
      place = clamp((t - d - walk) / 0.5, 0, 1),
      back = dreamEase((t - d - walk - 0.5) / 0.6),
      out = Math.atan2(ty - ey, tx - ex),
      gx = dreamLerp(sx, tx, p) + Math.cos(out) * 26 * back,
      gy = dreamLerp(sy, ty, p) + Math.sin(out) * 12 * back + 10 * back;
    crew.push({ i, tx, ty, gx, gy, p, place, back });
  }
  crew.sort((a, b) => a.ty - b.ty);
  for (const m of crew)
    if (m.place > 0) dreamFlower(g, m.tx, m.ty, 0.95, v.petals[m.i], 40 + m.i, t);
  const word = Math.floor(t * 1.2) % 3;
  for (const m of crew.slice().sort((a, b) => a.gy - b.gy)) {
    const s = 0.5;
    g.save();
    g.translate(m.gx, m.gy);
    g.rotate(m.back > 0 ? -Math.sin(m.back * Math.PI) * 0.35 : 0);
    gremlin(g, 0, 0, s, m.i % 4, t * 1.4 + m.i);
    if (m.place < 1) dreamFlower(g, 8, -24 * s * 2 + m.place * 24, 0.95, v.petals[m.i], 40 + m.i, t);
    g.restore();
    const walking = m.p > 0 && m.p < 1,
      bowing = m.back > 0 && m.back < 1;
    if ((walking || bowing) && m.i % 3 === word)
      dreamBubble(g, v.words[m.i], m.gx, m.gy - 56, m.gx, m.gy - 48, { size: 11, maxW: 120, seed: 50 + m.i, t });
  }
}

function dreamItalian(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, full.h, '#f3e3c9', '#e2c49f'));
  rect(g, full.x, 500, full.w, full.y + full.h - 500, '#c99a6b');
  dreamCrayon(g, [[full.x, 500], [full.x + full.w, 500]], '#8a5a3c', 4, 1, t);
  for (let x = Math.floor(full.x / 60) * 60; x < full.x + full.w; x += 60) line(g, [[x, 500], [x - 40, full.y + full.h]], '#8a5a3c44', 1.5);
  // Little Italian flags strung across the top.
  const flags = Math.ceil(sw / 46) + 1;
  for (let i = 0; i < flags; i++) {
    const x = 6 + i * 46,
      f = x / sw,
      y = 28 + Math.sin(f * Math.PI) * 34;
    for (let j = 0; j < 3; j++) poly(g, [[x + j * 6, y], [x + j * 6 + 6, y], [x + 9, y + 22]], ['#3f9d52', '#fbf8ef', '#d9473c'][j]);
  }
  dreamCrayon(g, Array.from({ length: 12 }, (_, i) => [(i / 11) * sw, 28 + Math.sin((i / 11) * Math.PI) * 34]), '#5a5566', 1.5, 2, t);
  // The window and its moon.
  const wx = sw * 0.08,
    wy = 110;
  dreamShape(g, dreamBox(wx, wy, 120, 100), '#27315e', '#6b5a48', 3, t, 4);
  ellipse(g, wx + 82, wy + 34, 16, 16, '#f8e9a6');
  dreamCrayon(g, [[wx + 60, wy], [wx + 60, wy + 100]], '#6b5a48', 3, 4, t);
  // The bed, side on, with Macy asleep in it.
  const bx = sw * 0.3,
    by = 440;
  dreamShape(g, dreamBox(bx - 170, by - 90, 16, 160), '#a7c3c9', '#56727a', 5, t, 2.5);
  for (const lx of [bx - 150, bx + 140]) dreamCrayon(g, [[lx, by + 40], [lx, by + 80]], '#56727a', 5, lx, t);
  dreamShape(g, dreamRound(bx - 160, by - 6, 310, 50, 12), '#f2f5ea', '#56727a', 6, t, 2.5);
  dreamSleeper(g, bx + 40, by - 8, 1.35, t, '#9ddac7');
  // Spaghetti on the bedside table.
  const tx = bx + 190;
  dreamShape(g, dreamBox(tx - 34, by - 10, 68, 12), '#b98a5f', '#6b4a32', 7, t, 2);
  for (const lx of [tx - 26, tx + 26]) dreamCrayon(g, [[lx, by + 2], [lx, by + 58]], '#6b4a32', 4, lx + 1, t);
  dreamShape(g, dreamOval(tx, by - 16, 26, 8, 8, 16), DREAM_INK.cream, '#8f8c96', 8, t, 1.5);
  for (let i = 0; i < 4; i++)
    dreamCrayon(g, dreamOval(tx + Math.sin(i * 2.1) * 6, by - 20 - i * 2, 14 - i * 2, 4, 9 + i, 10), '#efcf6e', 2, 9 + i, t, true);
  ellipse(g, tx - 4, by - 26, 3.5, 3.5, '#c2402f');
  ellipse(g, tx + 6, by - 25, 3, 3, '#c2402f');
  // Dad, mid-joke.
  const dadX = sw * 0.74,
    cps = Math.max(22, v.joke.length / (dur * 0.5)),
    shown = dreamTyped(t, 0.7, cps, v.joke.length),
    done = 0.7 + v.joke.length / cps;
  dreamAdult(g, dadX, 520, 2.1, t, DREAM_DAD, shown < v.joke.length);
  const box = dreamBubble(g, v.joke, Math.min(dadX - 30, sw - 230), 196, dadX - 4, 520 - 108 * 2.1, {
    size: 18,
    maxW: Math.min(420, sw - 80),
    seed: 60,
    t,
    shown
  });
  const cap = clamp((t - done - 0.4) * 2, 0, 1);
  if (cap > 0) {
    g.globalAlpha = dreamAlpha(g) * cap;
    label(g, '(translation unavailable)', box.x + box.w / 2, box.y - 9, 12 * dreamView.ui, '#6d6378', 'center');
    g.globalAlpha = a0;
  }
  if (t > done + 1.1) dreamBubble(g, 'Papà.', bx - 70, by - 52, bx - 52, by - 30, { size: 18, seed: 61, t });
}

function dreamMri(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  dreamWash(g, full, '#cfe6ee', '#9cc3cf', 51, t);
  rect(g, full.x, 520, full.w, full.y + full.h - 520, '#7aa2ae');
  dreamCrayon(g, [[full.x, 520], [full.x + full.w, 520]], '#4d7380', 4, 2, t);
  const cx = sw / 2,
    cy = 350,
    R = Math.min(sw * 0.3, 210);
  dreamShape(g, dreamRound(cx - R * 1.22, cy - R * 1.08, R * 2.44, R * 2.08 + 60, R * 0.4), '#eef1e8', '#5a6f7c', 1, t, 3);
  label(g, 'BRRR 3000', cx, cy - R * 1.08 + 26, 15, '#597f8e', 'center');
  dreamShape(g, dreamOval(cx, cy, R * 0.92, R * 0.92, 2, 26), '#b9d3dc', '#5a6f7c', 2, t, 3);
  const bore = dreamOval(cx, cy, R * 0.62, R * 0.62, 3, 26);
  dreamShape(g, bore, '#1f3a52', '#13263a', 3, t, 3);
  // The ball floats out of the bore toward us in slow motion, over the net and into the room.
  const period = 3.8,
    z = ((t + 0.4) % period) / period,
    ballAt = q => ({
      x: cx + (q - 0.4) * R * 1.1,
      y: cy + R * 0.18 - Math.sin(q * Math.PI) * R * 0.85,
      r: dreamLerp(6, R * 0.34, dreamEase(q))
    }),
    ball = ballAt(z),
    drawBall = () => {
      for (let j = 4; j >= 1; j--) {
        const q = z - j * 0.035;
        if (q < 0) continue;
        const b = ballAt(q);
        g.globalAlpha = dreamAlpha(g) * 0.12 * (5 - j);
        ellipse(g, b.x, b.y, b.r, b.r, '#fbf6e9');
        g.globalAlpha = a0;
      }
      dreamVolleyball(g, ball.x, ball.y, ball.r, t * 1.1, 4, t);
    };
  if (z < 0.42) drawBall();
  g.save();
  dreamPoly(g, bore);
  g.clip();
  const netTop = cy - R * 0.12,
    netBot = cy + R * 0.3;
  g.globalAlpha = dreamAlpha(g) * 0.8;
  for (let x = cx - R * 0.62; x <= cx + R * 0.62; x += 12) line(g, [[x, netTop], [x + 2, netBot]], '#e9eef2', 1.3);
  for (let y = netTop; y <= netBot; y += 12) line(g, [[cx - R * 0.62, y], [cx + R * 0.62, y]], '#e9eef2', 1.3);
  g.globalAlpha = a0;
  rect(g, cx - R * 0.62, netTop - 4, R * 1.24, 7, '#fbf8ef');
  g.restore();
  for (const side of [-1, 1]) {
    const x = cx + side * R * 0.6;
    for (let k = 0; k < 6; k++) rect(g, x - 2, netTop - 26 + k * 6, 4, 6, k % 2 ? '#fbf8ef' : DREAM_INK.red);
  }
  dreamShape(g, dreamBox(cx - R * 0.5, cy + R * 0.42, R, R * 0.14), DREAM_INK.cream, '#5a6f7c', 5, t, 2);
  dreamShape(g, dreamBox(cx - R * 0.3, cy + R * 0.56, R * 0.6, 520 - cy - R * 0.56), '#c9d6db', '#5a6f7c', 6, t, 2);
  if (z >= 0.42) drawBall();
  if (z > 0.55 && z < 0.97) {
    g.globalAlpha = dreamAlpha(g) * Math.sin(((z - 0.55) / 0.42) * Math.PI);
    dreamScrawl(g, v.mine, ball.x + ball.r + 10, ball.y - ball.r * 0.6, 30 * Math.min(dreamView.ui, 1.4), DREAM_INK.red, 'left', 7, t);
    g.globalAlpha = a0;
  }
  // The scoreboard.
  const ui = Math.min(dreamView.ui, 1.4),
    bw = Math.min(sw - 40, 560),
    fs = Math.min(26 * ui, bw / 22),
    sub = dreamFill(v.sub);
  rr(g, cx - bw / 2, 18, bw, fs * 2.6, 10, '#1f2430', '#4a5263', 3);
  label(g, 'RAMSEY ' + dreamJersey(t, 0.7), cx - bw / 4, 18 + fs * 1.35, fs, '#ffd75e', 'center');
  label(g, 'GREMLINS ∞', cx + bw / 4, 18 + fs * 1.35, fs, '#ff8f7a', 'center');
  label(g, sub, cx, 18 + fs * 2.2, fs * 0.5, '#aeb7c6', 'center');
}

function dreamRowdy(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, full.h, '#2b3466', '#46508a'));
  rect(g, full.x, full.y, full.w, 70 - full.y, '#3a4478');
  for (let x = Math.floor(full.x / 80) * 80; x < full.x + full.w; x += 80) line(g, [[x, full.y], [x, 70]], '#2b346688', 2);
  dreamCrayon(g, [[full.x, 70], [full.x + full.w, 70]], '#1f2650', 4, 1, t);
  rect(g, full.x, 590, full.w, full.y + full.h - 590, '#2c3561');
  const s = 9.9,
    px = sw * 0.62,
    lean = -0.14 + Math.sin(t * 0.7) * 0.035;
  // Twelve feet of ram does not fit under a hospital ceiling.
  for (const side of [-1, 1]) {
    const hx = px + side * 64 - 40;
    dreamCrayon(g, [[hx - 20, 70], [hx - 8, 82], [hx + 2, 72], [hx + 14, 88], [hx + 26, 70]], '#1f2650', 2.5, 5 + side, t);
  }
  g.save();
  g.translate(px, 640);
  g.rotate(lean);
  drawRowdy(g, 0, 27 * s, s, 'idle', t, { face: -1, shadow: false });
  g.restore();
  // Tiny Macy, looking up.
  girl(g, sw * 0.17, 590, 1.05, 0, 1, false, true);
  const mouth = { x: -10 * s, y: -33 * s },
    mx = px + mouth.x * Math.cos(lean) - mouth.y * Math.sin(lean),
    my = 640 + mouth.x * Math.sin(lean) + mouth.y * Math.cos(lean),
    shown = dreamTyped(t, 1.2, 14, v.line.length);
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.5 + i / 3) % 1;
    g.globalAlpha = dreamAlpha(g) * Math.sin(k * Math.PI) * 0.7;
    dreamScrawl(g, 'shh', mx - 30 - k * 60, my + 24 - k * 30 + i * 6, 12, '#d9d2ff', 'center', 8 + i, t);
    g.globalAlpha = a0;
  }
  if (shown > 0)
    dreamBubble(g, v.line, mx - 150, my - 20, mx - 8, my - 4, { size: 12, maxW: 200, seed: 70, t, shown, ink: '#4a4560' });
}

function dreamBarb(g, sw, t, v, dur, full) {
  dreamWash(g, full, '#1f2456', '#4b3f86', 71, t);
  dreamStars(g, full, 34, 72, t);
  const mx = sw / 2,
    my = 190,
    mr = 64;
  glow(g, mx, my, mr * 2.2, '#fff6c233');
  dreamShape(g, dreamOval(mx, my, mr, mr, 73, 24), '#f8e9a6', '#c9a94a', 73, t, 3);
  ellipse(g, mx - 22, my - 18, 10, 8, '#e8d58c');
  ellipse(g, mx + 24, my + 20, 13, 10, '#e8d58c');
  for (const ex of [-18, 18])
    path(
      g,
      p => {
        p.moveTo(mx + ex - 8, my - 2);
        p.quadraticCurveTo(mx + ex, my + 4, mx + ex + 8, my - 2);
      },
      null,
      '#8a7432',
      2.5
    );
  path(
    g,
    p => {
      p.moveTo(mx - 10, my + 22);
      p.quadraticCurveTo(mx, my + 28, mx + 10, my + 22);
    },
    null,
    '#8a7432',
    2.5
  );
  const ground = [[full.x - 10, full.y + full.h + 10], [full.x - 10, 520]];
  for (let i = 0; i <= 10; i++) ground.push([full.x + (i / 10) * full.w, 512 + Math.sin(i * 1.7) * 14]);
  ground.push([full.x + full.w + 10, full.y + full.h + 10]);
  dreamShape(g, ground, '#2f5d4a', '#1d3b2f', 74, t, 3);
  // The window where Macy is waiting.
  const wx = sw * 0.84,
    wy = 360;
  dreamShape(g, dreamBox(wx - 70, wy - 60, 140, 240), '#d9d0c4', '#6d6359', 75, t, 3);
  dreamShape(g, dreamBox(wx - 46, wy - 36, 92, 76), '#ffe9a6', '#6d6359', 76, t, 2.5);
  g.save();
  dreamPoly(g, dreamBox(wx - 46, wy - 36, 92, 76));
  g.clip();
  girl(g, wx, wy + 92, 1.15, 0, -1, false, false);
  g.restore();
  dreamShape(g, dreamBox(wx - 56, wy + 40, 112, 14), '#bfb3a5', '#6d6359', 77, t, 2);
  // Barb and her catapult.
  const cxp = sw * 0.17,
    period = 1.7,
    first = 0.6,
    flight = 2.4,
    launches = Math.max(0, Math.floor((t - first) / period) + 1),
    since = launches ? t - (first + (launches - 1) * period) : 99,
    arm = since < 0.15 ? dreamLerp(-0.3, -1.45, since / 0.15) : -1.45 + dreamEase((since - 0.15) / 0.8) * 1.15,
    tipX = cxp + 30 + Math.cos(arm) * 70,
    tipY = 452 + Math.sin(arm) * 70;
  dreamShape(g, [[cxp - 36, 512], [cxp + 66, 512], [cxp + 30, 452]], '#a0673f', '#5c3a22', 78, t, 3);
  dreamCrayon(g, [[cxp + 30, 452], [tipX, tipY]], '#8a5a3c', 7, 79, t);
  dreamShape(g, dreamOval(tipX, tipY, 13, 7, 80, 12), '#6b4a32', '#3d2a1c', 80, t, 2);
  dreamAdult(g, cxp - 70, 520, 1.25, t, DREAM_BARB, since < 1.2);
  let landed = 0;
  for (let k = 0; k < launches; k++) {
    const f = (t - (first + k * period)) / flight;
    if (f >= 1) {
      landed++;
      continue;
    }
    const sx = cxp + 30 + Math.cos(-1.45) * 70,
      sy = 452 + Math.sin(-1.45) * 70,
      ex = wx - 30 + (k % 3) * 22,
      ey = wy + 30,
      x = dreamLerp(sx, ex, f),
      y = dreamLerp(sy, ey, f) - 4 * 300 * f * (1 - f);
    dreamBottle(g, x, y, 1.1, k + v.flavor, f * 9, 81 + k, t);
  }
  for (let k = 0; k < Math.min(landed, 5); k++) dreamBottle(g, wx - 40 + k * 20, wy + 30, 0.9, k + v.flavor, 0, 90 + k, t);
  const shown = dreamTyped(t, 0.4, 24, v.line.length);
  dreamBubble(g, v.line, cxp - 40, 330, cxp - 70, 520 - 140 * 1.25, { size: 16, maxW: 220, seed: 82, t, shown });
  if (t > 3.6) dreamBubble(g, v.reply, wx - 40, wy - 72, wx, wy - 20, { size: 15, maxW: 200, seed: 83, t });
}

function dreamIvDog(g, sw, t, v, dur, full) {
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, 470, '#d7e6dc', '#c3d9cd'));
  rect(g, full.x, 470, full.w, full.y + full.h - 470, '#a9c7b9');
  dreamCrayon(g, [[full.x, 470], [full.x + full.w, 470]], '#6f8f86', 4, 1, t);
  const shift = t * 80;
  for (let j = Math.floor((full.x + shift) / 260) - 1; j * 260 - shift < full.x + full.w; j++) {
    const dx = j * 260 - shift;
    dreamShape(g, dreamBox(dx, 210, 110, 260), '#e9d2a8', '#7d6a4f', j, t, 2.5);
    dreamScrawl(g, '5', dx + 55, 270, 28, '#5a4a3a', 'center', 3, t);
  }
  dreamCrayon(g, [[full.x, 330], [full.x + full.w, 330]], '#b7c6c0', 6, 2, t);
  for (let j = Math.floor((full.x + shift) / 60) - 1; j * 60 - shift < full.x + full.w + 60; j++)
    line(g, [[j * 60 - shift, 470], [j * 60 - shift - 50, full.y + full.h]], '#6f8f8644', 1.5);
  // The IV pole leads, politely, in its top hat. Macy follows on the leash.
  const px = sw * 0.66,
    py = 548,
    ps = 1.75,
    bob = Math.abs(Math.sin(t * 7)) * 3,
    mx = sw * 0.3,
    my = 552,
    ms = 1.55;
  ivStand(g, px, py - bob, ps);
  // A small clock, melting over the pole's arm. Nobody mentions it.
  dreamMeltClock(g, px - 20 * ps, py - bob - 132 * ps, 10 * ps, t, 97);
  g.save();
  g.translate(px, py - bob);
  g.scale(ps, ps);
  const tip = Math.max(0, Math.sin(t * 1.6)) * 0.35;
  g.save();
  g.translate(0, -140);
  g.rotate(-tip);
  dreamShape(g, dreamBox(-12, -32, 24, 30), '#2c2833', '#111111', 92, t, 1.2);
  dreamShape(g, dreamBox(-19, -4, 38, 5), '#2c2833', '#111111', 93, t, 1.2);
  rect(g, -12, -10, 24, 4, DREAM_INK.red);
  g.restore();
  for (const ex of [14, 23]) {
    ellipse(g, ex, -108, 4, 4, '#ffffff');
    ellipse(g, ex - 1.6, -107.5, 1.8, 1.8, '#2c2833');
  }
  g.restore();
  girl(g, mx, my, ms, t * 7, 1, false, true);
  const hx = mx + 17 * ms,
    hy = my - 26 * ms,
    ax = px - 2 * ps,
    ay = py - bob - 76 * ps,
    sag = 40 + Math.sin(t * 3) * 6;
  const leash = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10;
    leash.push([dreamLerp(ax, hx, f), dreamLerp(ay, hy, f) + Math.sin(f * Math.PI) * sag]);
  }
  dreamCrayon(g, leash, DREAM_INK.red, 3, 94, t);
  const shown = dreamTyped(t, 0.5, 26, dreamFill(v.line).length);
  dreamBubble(g, dreamFill(v.line), px + 20, py - 140 * ps - 70, px + 6, py - 158 * ps, { size: 16, maxW: 260, seed: 95, t, shown });
  if (t > 3.4) dreamBubble(g, v.reply, mx - 10, my - 150, mx, my - 132, { size: 15, maxW: 180, seed: 96, t });
}

function dreamEtypeScene(g, sw, t, v, dur, full) {
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, 470, '#2c3a55', '#3b4b6b'));
  rect(g, full.x, 470, full.w, full.y + full.h - 470, '#27324a');
  dreamCrayon(g, [[full.x, 470], [full.x + full.w, 470]], '#5a6a8a', 4, 1, t);
  for (let x = Math.floor(full.x / 240) * 240 + 60; x < full.x + full.w; x += 240) {
    dreamShape(g, dreamBox(x, 230, 100, 240), '#3e4c6e', '#1c2438', x, t, 2.5);
    dreamShape(g, dreamBox(x + 30, 260, 40, 36), '#ffe9a655', '#1c2438', x + 1, t, 1.5);
  }
  const sx = sw * 0.5;
  dreamShape(g, dreamBox(sx - 54, 110, 108, 76), DREAM_INK.cream, '#2c2833', 2, t, 2.5);
  label(g, 'SPEED', sx, 136, 13, '#2c2833', 'center');
  label(g, 'LIMIT', sx, 152, 13, '#2c2833', 'center');
  label(g, '3 MPH', sx, 176, 20, '#2c2833', 'center');
  const s = sw < 800 ? 1 : 1.25,
    x = -260 * s + (sw + 520 * s) * clamp(t / dur, 0, 1.2),
    y = 540;
  dreamEtype(g, x, y, s, t, v.type, 3, dreamJersey(t, 0.4));
  if (x > sw * 0.15 && x < sw * 0.85) dreamBubble(g, v.line, x - 40 * s, y - 160 * s, x - 38 * s, y - 110 * s, { size: 16, maxW: 220, seed: 4, t });
}

function dreamCats(g, sw, t, v, dur, full) {
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, full.h, '#f2dcc8', '#e6c7ae'));
  rect(g, full.x, 520, full.w, full.y + full.h - 520, '#b9876a');
  dreamCrayon(g, [[full.x, 520], [full.x + full.w, 520]], '#7d5640', 4, 1, t);
  // The bed, side on, Macy sitting up.
  const bx = sw * 0.38,
    by = 430,
    ms = 1.5,
    mx = bx - 40;
  dreamShape(g, dreamBox(bx - 210, by - 120, 16, 200), '#a7c3c9', '#56727a', 2, t, 2.5);
  for (const lx of [bx - 190, bx + 170]) dreamCrayon(g, [[lx, by + 40], [lx, by + 90]], '#56727a', 5, lx, t);
  dreamShape(g, dreamOval(mx - 34, by - 52, 30, 18, 3, 16), DREAM_INK.cream, '#8f8c96', 3, t, 2);
  girl(g, mx, by + 30, ms, 0, 1, false, false);
  dreamShape(g, dreamRound(bx - 200, by - 6, 390, 50, 12), '#9ddac7', '#4f8f8a', 4, t, 2.5);
  // The tape measure, around her arm.
  const armX = mx + 17 * ms,
    armY = by + 30 - 40 * ms,
    c1x = bx + 110,
    c1y = by - 6,
    pull = Math.sin(t * 1.7) * 10,
    tape = [[armX + 4, armY], [dreamLerp(armX, c1x - 20, 0.5), armY - 18 + pull * 0.4], [c1x - 22, c1y - 30 + pull]];
  rr(g, armX - 6, armY - 5, 12, 10, 3, DREAM_INK.gold, '#a8761f', 1.2);
  dreamCrayon(g, tape, DREAM_INK.gold, 7, 5, t);
  for (let i = 1; i < 8; i++) {
    const f = i / 8,
      x = dreamLerp(tape[0][0], tape[2][0], f),
      y = dreamLerp(tape[0][1], tape[2][1], f) - Math.sin(f * Math.PI) * 9;
    line(g, [[x, y - 3], [x, y + 3]], '#6b4a12', 1);
  }
  dreamCat(g, c1x, c1y, 1.6, '#f0a24e', '#a8641f', t, 1);
  // Cat two reads the clipboard; cat three is knocking a cup off the table.
  const c2x = sw * 0.84,
    c2y = 520,
    ui = Math.min(dreamView.ui, 1.5),
    fs = Math.min(15 * ui, (sw * 0.3) / (v.reading.length * 0.58)),
    cw = Math.max(fs * v.reading.length * 0.6 + 26, 110),
    cbx = clamp(c2x - cw / 2, 10, sw - cw - 10),
    cby = 392 - (fs * 2.6 + 18);
  dreamCat(g, c2x, c2y, 1.8, '#3a3640', '#151318', t, 2, '#e9e4ec');
  dreamShape(g, dreamBox(cbx, cby, cw, fs * 2.6 + 18), '#c99a5b', '#7d5a30', 6, t, 2);
  rr(g, cbx + 8, cby + 8, cw - 16, fs * 2.6 + 2, 3, DREAM_INK.cream);
  label(g, 'VITALS', cbx + cw / 2, cby + 8 + fs, fs * 0.7, '#8f8c96', 'center');
  label(g, v.reading, cbx + cw / 2, cby + 8 + fs * 2.15, fs, '#2c2833', 'center');
  for (const side of [-1, 1]) {
    dreamCrayon(g, [[c2x + side * 12, c2y - 50], [c2x + side * 22, 396]], '#3a3640', 7, 10 + side, t);
    ellipse(g, c2x + side * 22, 394, 6, 5, '#3a3640');
  }
  const tx = sw * 0.08,
    fall = clamp((t - 3) / 0.7, 0, 1);
  dreamShape(g, dreamBox(tx - 40, 410, 80, 12), '#b98a5f', '#6b4a32', 7, t, 2);
  for (const lx of [tx - 30, tx + 30]) dreamCrayon(g, [[lx, 422], [lx, 520]], '#6b4a32', 4, lx, t);
  g.save();
  g.translate(tx + 26 + fall * 24, 410 + fall * fall * 104);
  g.rotate(fall * 2.4);
  dreamShape(g, dreamBox(-8, -20, 16, 20), '#ffffff', '#8f8c96', 8, t, 1.5);
  g.restore();
  dreamCat(g, tx - 6, 410, 1.2, '#9aa0a8', '#5d636b', t, 3, '#f4f2ee');
  dreamBubble(g, v.mrrp, c1x + 10, c1y - 120, c1x, c1y - 100, { size: 14, maxW: 180, seed: 9, t });
}

function dreamJar(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, full.h, '#1d2440', '#2c355e'));
  poly(g, [[full.x, full.y], [full.x + 260, full.y], [sw * 0.62, 560], [sw * 0.3, 560]], '#fff6c214');
  rect(g, full.x, 520, full.w, 26, '#8a5a3c');
  dreamCrayon(g, [[full.x, 520], [full.x + full.w, 520]], '#5c3a22', 4, 1, t);
  rect(g, full.x, 546, full.w, full.y + full.h - 546, '#141a30');
  const cx = sw / 2,
    walk = Math.sin(t * 0.9),
    bump = Math.abs(walk) > 0.93 ? Math.sin(t * 40) * 0.025 : 0,
    rx = cx + walk * 62;
  g.save();
  g.translate(cx, 520);
  g.rotate(bump);
  g.translate(-cx, -520);
  const jar = dreamRound(cx - 110, 226, 220, 294, 40);
  dreamPoly(g, jar);
  g.fillStyle = '#bfe3f033';
  g.fill();
  dreamRalph(g, rx, 512, 1.1, t);
  if (Math.abs(walk) > 0.9) {
    const side = walk > 0 ? 1 : -1;
    ellipse(g, cx + side * 104, 470, 5, 7, '#cdb3e0');
    ellipse(g, cx + side * 104, 488, 5, 7, '#cdb3e0');
  }
  const line_ = v.lines[Math.floor(t / 2.2) % v.lines.length];
  dreamBubble(g, line_, rx, 440, rx, 456, { size: 11, maxW: 150, seed: 100, t, fill: '#f4ecff' });
  g.globalAlpha = dreamAlpha(g) * 0.55;
  dreamCrayon(g, [[cx - 82, 270], [cx - 86, 470]], '#ffffff', 5, 101, t);
  dreamCrayon(g, [[cx + 84, 300], [cx + 80, 360]], '#ffffff', 3, 102, t);
  g.globalAlpha = a0;
  dreamCrayon(g, jar, '#8fbfd4', 3, 103, t, true);
  dreamShape(g, dreamRound(cx - 96, 196, 192, 34, 8), '#c9ced6', '#6d7480', 104, t, 2.5);
  for (let i = 0; i < 5; i++) ellipse(g, cx - 48 + i * 24, 206, 3, 2, '#3a3f4a');
  // The label, taped on by someone who has met Ralph.
  const lw = 196,
    lh = 92,
    ly = 246;
  g.save();
  g.translate(cx, ly + lh / 2);
  g.rotate(-0.04);
  dreamShape(g, dreamBox(-lw / 2, -lh / 2, lw, lh), '#fdf6dc', '#b8a98a', 105, t, 2);
  rect(g, -lw / 2 - 8, -lh / 2 - 6, 30, 12, '#f1e9a8aa');
  rect(g, lw / 2 - 22, lh / 2 - 6, 30, 12, '#f1e9a8aa');
  dreamScrawl(g, 'DO NOT OPEN.', 0, -8, Math.min(24, (lw - 20) / 7.6), '#b8322a', 'center', 106, t);
  dreamScrawl(g, "HE'LL TALK.", 0, 26, Math.min(22, (lw - 20) / 7), DREAM_INK.black, 'center', 107, t);
  g.restore();
  g.restore();
}

function dreamClouds(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  dreamWash(g, full, '#8fd0f2', '#f6d6e6', 121, t);
  for (let i = 0; i < 4; i++) {
    const x = full.x + ((((i * 0.31 + t * 0.02) % 1) + 1) % 1) * (full.w + 300) - 150;
    dreamCloud(g, x, 90 + (i % 2) * 70, 120 + i * 20, '#ffffff', '#c3d8ea', 122 + i, t, 0.7);
  }
  const sunX = sw - 70,
    sunY = 80;
  dreamShape(g, dreamOval(sunX, sunY, 30, 30, 126, 16), DREAM_INK.gold, '#e08a1e', 126, t, 2.5);
  for (let i = 0; i < 4; i++) {
    const bx = sw * 0.2 + i * 70 + Math.sin(t + i) * 10,
      by = 150 + Math.sin(t * 1.3 + i) * 8 + i * 6;
    dreamCrayon(g, [[bx - 9, by - 4], [bx, by + 2], [bx + 9, by - 4]], '#4a4560', 2, 127 + i, t);
  }
  dreamGhost(g, sw * 0.1 + 20, 110, 0.75, t, 138);
  dreamCloud(g, sw / 2, 540, sw * 0.62, '#ffffff', '#a9c4dd', 130, t, 0.5);
  const court = [[sw * 0.12, 560], [sw * 0.88, 560], [sw * 0.74, 420], [sw * 0.26, 420]];
  dreamShape(g, court, '#f2b06b', '#ffffff', 131, t, 4);
  dreamCrayon(g, [[sw * 0.19, 490], [sw * 0.81, 490]], '#ffffff', 3, 132, t);
  dreamScrawl(g, dreamJersey(t), sw / 2, 548, 26, '#ffffff', 'center', 133, t);
  dreamVolleyball(g, sw * 0.32, 538, 13, 0.4, 134, t);
  const names = ['PRESLEY', 'NORAH', 'TAYLOR'],
    hairs = ['#c9944f', '#3a2620', '#e6c36d'],
    ks = sw < 800 ? 1.7 : 2.05;
  names.forEach((name, i) => {
    const x = sw * (0.34 + i * 0.16),
      y = 470 + Math.abs(Math.sin(t * 3 + i)) * -4;
    dreamKid(g, x, y, ks, hairs[i], name, t, i * 1.9);
  });
  for (const side of [-1, 1]) dreamCrayon(g, [[sw / 2 + side * sw * 0.33, 490], [sw / 2 + side * sw * 0.33, 400]], '#6d6378', 4, 135 + side, t);
  g.globalAlpha = dreamAlpha(g) * 0.75;
  for (let x = sw * 0.17; x <= sw * 0.83; x += 12) line(g, [[x, 412], [x, 462]], '#fbf8ef', 1.2);
  for (let y = 412; y <= 462; y += 10) line(g, [[sw * 0.17, y], [sw * 0.83, y]], '#fbf8ef', 1.2);
  g.globalAlpha = a0;
  rect(g, sw * 0.17, 404, sw * 0.66, 8, '#fbf8ef');
  const shown = dreamTyped(t, 0.8, 22, dreamFill(v.line).length);
  dreamBubble(g, dreamFill(v.line), sw / 2, 236, sw / 2, 266, { size: 17, maxW: 260, seed: 136, t, shown });
}

// Late for class at Ramsey, in pajamas, running through syrup. The clock's numbers change whenever she
// looks away, and the poster reads differently the second time.
function dreamSchool(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g),
    ui = Math.min(dreamView.ui, 1.4),
    floor = 470;
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, floor, '#efe7cf', '#e2d6b6'));
  for (let x = Math.floor(full.x / 56) * 56; x < full.x + full.w; x += 56) {
    dreamShape(g, dreamBox(x + 3, 250, 50, floor - 250), '#2f5fb8', '#1c3a78', 200 + x / 56, t, 2);
    for (let k = 0; k < 3; k++) rect(g, x + 12, 268 + k * 9, 32, 3, '#1c3a78');
    ellipse(g, x + 44, 360, 3, 6, DREAM_INK.gold);
  }
  rect(g, full.x, 236, full.w, 14, DREAM_INK.gold);
  rect(g, full.x, floor, full.w, full.y + full.h - floor, gradient(g, 0, floor, 0, full.y + full.h - floor, '#e8a83e', '#b8741f'));
  g.globalAlpha = a0 * 0.5;
  for (let i = 0; i < 6; i++) {
    const y = floor + 24 + i * 26,
      x = full.x + ((i * 0.37 + 0.1) % 1) * full.w;
    dreamCrayon(g, [[x - 80, y], [x + 80, y + 4]], '#ffe2a0', 4, 210 + i, t);
  }
  g.globalAlpha = a0;
  // The poster, which says one thing and then, on second look, something else.
  const pw = Math.min(320, sw * 0.44),
    px = sw * 0.06,
    psize = dreamFit(v.poster, pw - 24, 24 * ui);
  dreamShape(g, dreamBox(px, 92, pw, 70), DREAM_INK.cream, DREAM_INK.red, 211, t, 3);
  dreamFlipLabel(g, v.poster, px + pw / 2, 127 + psize * 0.35, psize, DREAM_INK.red, t, 2.6, true, 212);
  // The clock. Every time she glances back, the numbers are different.
  const glance = t >= 1.2 && (t - 1.2) % 2.2 < 0.7,
    looks = t < 1.2 ? 0 : Math.floor((t - 1.2) / 2.2) + 1,
    nums = v.clock[looks % v.clock.length],
    cx = sw * 0.8,
    cy = 128,
    r = 54;
  dreamShape(g, dreamOval(cx, cy, r, r, 213, 24), DREAM_INK.cream, DREAM_INK.black, 213, t, 3);
  nums.forEach((n, i) => {
    const a = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
    label(g, n, cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74 + 4, Math.min(12, (r * 0.5) / Math.max(1, n.length * 0.6)), DREAM_INK.black, 'center');
  });
  line(g, [[cx, cy], [cx + Math.cos(-t * 1.8) * r * 0.6, cy + Math.sin(-t * 1.8) * r * 0.6]], DREAM_INK.black, 2.5);
  line(g, [[cx, cy], [cx + Math.cos(t * 0.3) * r * 0.4, cy + Math.sin(t * 0.3) * r * 0.4]], DREAM_INK.black, 4);
  // Two friends at the lockers, also in pajamas.
  const kids = [
    ['NORAH', '#3a2620', '#9ec5f0'],
    ['PRESLEY', '#c9944f', '#c8ecc4']
  ];
  kids.forEach(([name, hair, top], i) => dreamKid(g, sw * (0.66 + i * 0.2), 566, 1.55, hair, name, t, 3 + i * 2, top));
  // Macy, running as hard as she can, which is barely at all.
  const mx = sw * 0.3 + t * 5,
    my = 566,
    step = t * 2.2;
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.5 + i / 3) % 1;
    g.globalAlpha = a0 * (1 - k) * 0.6;
    dreamCrayon(g, [[mx - 46 - k * 20, 470 + i * 22], [mx - 70 - k * 20, 470 + i * 22]], '#ffffff', 3, 214 + i, t);
    g.globalAlpha = a0;
  }
  dreamPajamas(() => girl(g, mx, my, 1.5, step, glance ? -1 : 1, false, false));
  for (const side of [-1, 1]) dreamCrayon(g, [[mx + side * 9, my + 2], [mx + side * 8 + Math.sin(step + side) * 5, my - 24]], '#e8a83e', 4, 215 + side, t);
  ellipse(g, mx, my + 2, 36, 9, '#d8952f');
  ellipse(g, mx - 8, my - 1, 14, 3, '#f4c66e');
  const said = dreamFill(v.line),
    shown = dreamTyped(t, 0.6, 24, said.length);
  dreamBubble(g, said, sw * 0.7, 340, sw * 0.68, 380, { size: 15, maxW: 240, seed: 216, t, shown });
  if (t > 3.4) dreamBubble(g, v.reply, mx, 400, mx, 430, { size: 15, maxW: 220, seed: 217, t });
}

// Dr. Benedetto, wearing Rowdy's horns, runs the ultrasound. There is a volleyball net in the gel.
function dreamDoctor(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  dreamRoomWash(g, full, '#dbe9f0', '#b8ccd6', 520, 220, t);
  const mw = Math.min(250, sw * 0.34),
    mh = mw * 0.72,
    mx = sw * 0.6,
    my = 140;
  dreamShape(g, dreamBox(mx - mw * 0.28, my + mh + 10, mw * 0.56, 520 - my - mh - 10), '#c9d6db', '#5a6f7c', 221, t, 2.5);
  for (const wx of [mx - mw * 0.24, mx + mw * 0.24]) ellipse(g, wx, 522, 9, 9, '#4a5263');
  dreamShape(g, dreamRound(mx - mw / 2 - 10, my - 10, mw + 20, mh + 20, 10), '#4a5263', '#2c2833', 222, t, 2.5);
  rect(g, mx - mw / 2, my, mw, mh, '#14161c');
  // The fan of the scan, grainy, and in it a net and a very small rally.
  const ax = mx,
    ay = my + 8,
    rad = mh * 0.88,
    fan = [[ax, ay]];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 - 0.62 + (i / 12) * 1.24;
    fan.push([ax + Math.cos(a) * rad, ay + Math.sin(a) * rad]);
  }
  dreamPoly(g, fan);
  g.fillStyle = '#3a3e45';
  g.fill();
  g.save();
  dreamPoly(g, fan);
  g.clip();
  for (let i = 0; i < 70; i++) {
    const px = ax + dreamHash(223, i) * rad * 0.6,
      py = ay + (dreamHash(224, i) * 0.5 + 0.5) * rad;
    ellipse(g, px, py, 1.6, 1, i % 3 ? '#6b7079' : '#9aa0a8');
  }
  const netY = ay + rad * 0.62;
  g.globalAlpha = a0 * 0.85;
  for (let x = ax - rad * 0.5; x <= ax + rad * 0.5; x += 8) line(g, [[x, netY - rad * 0.2], [x, netY]], '#d9dde2', 1);
  for (let y = netY - rad * 0.2; y <= netY; y += 7) line(g, [[ax - rad * 0.5, y], [ax + rad * 0.5, y]], '#d9dde2', 1);
  g.globalAlpha = a0;
  const rally = Math.sin(t * 2.4),
    bx = ax + rally * rad * 0.32,
    by = netY - rad * 0.28 - Math.abs(Math.cos(t * 2.4)) * rad * 0.2;
  ellipse(g, bx, by, 5, 5, '#f2f2f2');
  for (const side of [-1, 1]) ellipse(g, ax + side * rad * 0.36, netY - 4, 3, 7, '#c9ced6');
  g.restore();
  label(g, v.screen, mx, my + mh - 8, Math.min(12, mw / 14), '#9fe0b8', 'center');
  // The gel, labeled honestly.
  const gx = mx + mw * 0.36;
  dreamShape(g, dreamRound(gx - 12, my + mh + 22, 24, 40, 6), '#7fc4f0', '#2f6f9a', 225, t, 1.6);
  dreamShape(g, dreamBox(gx - 4, my + mh + 12, 8, 11), DREAM_INK.cream, '#2f6f9a', 226, t, 1.2);
  label(g, 'COLD', gx, my + mh + 46, 8, '#14335a', 'center');
  // The doctor, the horns, and the slip.
  const dx = sw * 0.24,
    ds = sw < 760 ? 1.75 : 2.05,
    fixAt = 0.5 + v.slip.length / 24 + 0.9,
    s1 = dreamTyped(t, 0.5, 24, v.slip.length),
    s2 = dreamTyped(t, fixAt, 24, DREAM_DOC_FIX.length);
  dreamAdult(g, dx, 540, ds, t, DREAM_DOC, s1 < v.slip.length || (s2 > 0 && s2 < DREAM_DOC_FIX.length));
  const headY = 540 - 118 * ds;
  if (s2 <= 0) dreamBubble(g, v.slip, dx + 60, headY - 72, dx + 10, headY - 36, { size: 16, maxW: 250, seed: 227, t, shown: s1 });
  else dreamBubble(g, '*' + DREAM_DOC_FIX, dx + 60, headY - 72, dx + 10, headY - 36, { size: 16, maxW: 250, seed: 228, t, shown: s2 + 1 });
  girl(g, sw * 0.88, 566, 1.35, 0, -1, false, true);
  if (t > fixAt + DREAM_DOC_FIX.length / 24 + 0.5) dreamBubble(g, v.reply, sw * 0.86, 400, sw * 0.88, 432, { size: 15, maxW: 180, seed: 229, t });
}

// Ding. Pavlov's bell rings, her mouth waters, and only then does the snack cart roll in, carrying
// Maslow's hierarchy of pudding.
function dreamSnack(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g),
    ui = Math.min(dreamView.ui, 1.4);
  dreamRoomWash(g, full, '#f4e6d0', '#c9a888', 520, 230, t);
  // The bell, on its own little table.
  const bx = sw * 0.27,
    by = 420,
    rings = [0.5, 1.05],
    ring = rings.reduce((a, r) => a + (t >= r ? Math.exp(-(t - r) * 4) * Math.sin((t - r) * 40) : 0), 0);
  dreamShape(g, dreamBox(bx - 34, by, 68, 10), '#b98a5f', '#6b4a32', 231, t, 2);
  for (const lx of [bx - 26, bx + 26]) dreamCrayon(g, [[lx, by + 10], [lx, 520]], '#6b4a32', 4, 232 + lx / 100, t);
  g.save();
  g.translate(bx, by);
  g.rotate(ring * 0.12);
  const dome = [];
  for (let i = 0; i <= 12; i++) dome.push([Math.cos(Math.PI + (i / 12) * Math.PI) * 24, Math.sin(Math.PI + (i / 12) * Math.PI) * 22 - 2]);
  dreamShape(g, dome, '#e8b84a', '#a8761f', 233, t, 2);
  ellipse(g, 0, -27, 4, 4, '#a8761f');
  rect(g, -26, -3, 52, 4, '#c99a3a');
  g.restore();
  label(g, 'PAVLOV & SONS', bx, by + 26, 8, '#6b4a32', 'center');
  for (const r of rings)
    if (t > r && t < r + 0.6) {
      g.globalAlpha = a0 * (1 - (t - r) / 0.6);
      dreamScrawl(g, 'DING!', bx + 30, by - 40 - (t - r) * 30, 22 * ui, DREAM_INK.red, 'left', 234, t);
      g.globalAlpha = a0;
    }
  // Macy, who knew before she knew.
  const mx = sw * 0.11;
  girl(g, mx, 566, 1.4, 0, 1, false, true);
  if (t > 1.2 && t < 2.6) dreamBubble(g, v.think, mx + 20, 400, mx + 6, 430, { size: 15, maxW: 160, seed: 235, t, hand: true });
  // The cart, two gremlins pushing, and the pyramid of pudding cups.
  const cx = dreamLerp(sw + 260, sw * 0.62, dreamEase((t - 1.5) / 1.7)),
    moving = t > 1.5 && t < 3.2,
    cs = Math.min(30, sw * 0.04),
    top = 448;
  dreamShape(g, dreamBox(cx - 110, top, 220, 48), '#c9d6db', '#5a6f7c', 236, t, 2.5);
  dreamCrayon(g, [[cx + 110, top + 6], [cx + 140, top - 20]], '#5a6f7c', 4, 237, t);
  for (const wx of [cx - 84, cx + 84]) {
    ellipse(g, wx, 508, 12, 12, '#4a5263');
    const a = -(cx - sw) / 12;
    line(g, [[wx, 508], [wx + Math.cos(a) * 9, 508 + Math.sin(a) * 9]], '#c9ced6', 2);
  }
  for (let row = 0; row < 5; row++)
    for (let i = 0; i < 5 - row; i++) {
      const x = cx + (i - (4 - row) / 2) * cs * 1.08,
        y = top - row * cs * 0.92;
      dreamShape(g, [[x - cs * 0.45, y - cs * 0.82], [x + cs * 0.45, y - cs * 0.82], [x + cs * 0.36, y], [x - cs * 0.36, y]], '#f7f2e4', '#8f8c96', 238 + row * 5 + i, t, 1.2);
      ellipse(g, x, y - cs * 0.8, cs * 0.44, cs * 0.12, row % 2 ? '#e9d39a' : '#7a4b33');
    }
  // The sign on a stick, for the grown-ups.
  const sy = top - 5 * cs * 0.92 - 20,
    sgw = Math.min(200, sw * 0.3),
    ss = Math.min(13 * ui, sgw / 11);
  dreamCrayon(g, [[cx, top - 4 * cs * 0.92 - cs * 0.6], [cx, sy]], '#8a5a3c', 3, 243, t);
  dreamShape(g, dreamBox(cx - sgw / 2, sy - ss * 2.8, sgw, ss * 2.8), DREAM_INK.cream, DREAM_INK.black, 244, t, 2);
  label(g, "MASLOW'S HIERARCHY", cx, sy - ss * 1.6, ss * 0.85, DREAM_INK.black, 'center');
  label(g, 'OF PUDDING', cx, sy - ss * 0.45, ss, DREAM_INK.red, 'center');
  const gs = 0.62;
  for (let i = 0; i < 2; i++) {
    const gx = cx + 150 + i * 44;
    if (t > 3.4) dreamClapper(g, gx, 520, gs, i + 1, t, i * 1.7);
    else gremlin(g, gx, 520, gs, i + 1, t * (moving ? 3 : 1.3) + i);
  }
  if (t > 3.4) {
    const k = Math.floor(t * 2) % 2;
    g.globalAlpha = a0 * 0.7;
    dreamScrawl(g, k ? 'clap.' : 'clap', cx + 172, 452, 13 * ui, '#6d6378', 'center', 245, t);
    g.globalAlpha = a0;
    dreamBubble(g, v.line, cx + 150, 400, cx + 150, 470, { size: 14, maxW: 190, seed: 246, t, shown: dreamTyped(t, 3.5, 24, v.line.length) });
  }
  if (t > 4.4) dreamBubble(g, v.reply, mx + 10, 380, mx + 6, 430, { size: 15, maxW: 170, seed: 247, t });
}

// Barb's Ensure, which doubles every time Macy blinks.
function dreamBlink(g, sw, t, v, dur, full) {
  dreamRoomWash(g, full, '#f1e2ef', '#c4b3c9', 540, 250, t);
  const blinks = v.blinks.filter(b => t >= b).length,
    n = Math.min(64, Math.pow(2, blinks)),
    x0 = sw * 0.42,
    x1 = sw - 26,
    cols = 8,
    step = (x1 - x0) / cols;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols),
      col = i % cols,
      born = i < 1 ? 0 : v.blinks[Math.ceil(Math.log2(i + 1)) - 1] || 0,
      pop = clamp((t - born) / 0.25, 0, 1),
      x = x0 + (col + 0.5) * step + dreamHash(251, i) * 4,
      y = 548 - row * 40;
    dreamBottle(g, x, y - 16, 0.55 + 0.45 * pop, i + v.flavor, dreamHash(252, i) * 0.15, 253 + i, t);
  }
  const bx = sw * 0.13,
    shown = dreamTyped(t, 0.3, 24, v.line.length);
  dreamAdult(g, bx, 556, 1.45, t, DREAM_BARB, shown < v.line.length);
  dreamBubble(g, v.line, bx + 40, 300, bx + 6, 556 - 140 * 1.45, { size: 15, maxW: 200, seed: 254, t, shown });
  const mx = sw * 0.3;
  girl(g, mx, 566, 1.35, 0, 1, false, true);
  label(g, 'ENSURE: ' + n, sw - 30, 48, 18 * Math.min(dreamView.ui, 1.4), '#7a4b33', 'right');
  if (t > 3.1) dreamBubble(g, v.reply, mx + 20, 400, mx + 4, 434, { size: 15, maxW: 170, seed: 255, t });
  dreamBlinkLids(g, full, Math.max(0, ...v.blinks.map(b => 1 - Math.abs(t - b) / 0.14)));
}

// Home: Pepper the kitten, the size of a sofa. The E-Type drives itself around the floor.
function dreamBedroom(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g),
    purr = t > 0.8 ? 0.5 + 0.5 * Math.sin(t * 2) : 0;
  g.save();
  g.translate(Math.sin(t * 47) * 1.4 * purr, 0);
  dreamRoomWash(g, full, '#d8cdee', '#b98a5f', 470, 260, t);
  for (let y = 500; y < full.y + full.h; y += 34) line(g, [[full.x, y], [full.x + full.w, y]], '#8a5a3c55', 1.5);
  // The window, the pennant, and the LEGO water lilies on the shelf.
  dreamShape(g, dreamBox(sw * 0.06, 110, 130, 110), '#27315e', '#6b5a48', 261, t, 4);
  ellipse(g, sw * 0.06 + 92, 146, 14, 14, '#f8e9a6');
  dreamShape(g, [[sw * 0.3, 120], [sw * 0.3 + 150, 140], [sw * 0.3, 162]], DREAM_INK.royal, '#14275a', 262, t, 2);
  label(g, 'RAMS', sw * 0.3 + 46, 146, 15, DREAM_INK.gold, 'center');
  const shx = sw * 0.62,
    shw = sw * 0.32;
  dreamShape(g, dreamBox(shx, 210, shw, 10), '#a0673f', '#5c3a22', 263, t, 2);
  for (let i = 0; i < 3; i++) {
    const lx = shx + shw * (0.2 + i * 0.3);
    ellipse(g, lx, 204, 26, 7, '#3f8f4a');
    for (let k = -2; k <= 2; k++) ellipse(g, lx + k * 8, 202, 2, 1.4, '#6dbb5f');
    for (let p = 0; p < 5; p++) {
      const a = Math.PI + (p / 4) * Math.PI;
      poly(g, [[lx, 198], [lx + Math.cos(a) * 12 - 4, 198 + Math.sin(a) * 12], [lx + Math.cos(a) * 12 + 4, 198 + Math.sin(a) * 12]], i === 1 ? '#f6e7a8' : '#f3a6b8');
    }
    ellipse(g, lx, 194, 3, 3, DREAM_INK.gold);
  }
  // The E-Type's loop around the floor: behind Pepper on the far side, in front on the near side.
  const a = t * 1.15 + v.phase,
    ex = sw * 0.5 + Math.cos(a) * sw * 0.4,
    ey = 545 + Math.sin(a) * 26,
    face = -Math.sin(a) >= 0 ? 1 : -1,
    car = () => {
      g.save();
      g.translate(ex, ey);
      g.scale(face, 1);
      dreamEtype(g, 0, 0, 0.3, t, null, 264, dreamJersey(t, 1.1));
      g.restore();
    };
  if (Math.sin(a) < 0) car();
  // Pepper.
  const k = clamp(sw / 1000, 0.62, 1),
    px = sw * 0.42,
    fur = '#9aa0a8',
    dark = '#5d636b';
  g.save();
  g.translate(px, 470);
  g.scale(k, k);
  shadow(g, 0, 36, 220, 22);
  const tail = Math.sin(t * 1.6) * 20;
  dreamCrayon(g, [[-170, 10], [-230, -10 + tail * 0.4], [-250, -60 + tail], [-226, -96 + tail]], fur, 26, 265, t);
  dreamShape(g, dreamOval(0, -20, 200, 74, 266, 24), fur, dark, 266, t, 3);
  for (let i = 0; i < 14; i++) ellipse(g, dreamHash(267, i) * 160, -30 + dreamHash(268, i) * 40, 6, 4, '#7d838b');
  ellipse(g, 120, 44, 40, 20, '#f4f2ee');
  ellipse(g, 200, 44, 40, 20, '#f4f2ee');
  const hx = 200,
    hy = -110;
  dreamShape(g, [[hx - 58, hy - 30], [hx - 50, hy - 104], [hx - 10, hy - 50]], fur, dark, 269, t, 3);
  dreamShape(g, [[hx + 58, hy - 30], [hx + 50, hy - 104], [hx + 10, hy - 50]], fur, dark, 270, t, 3);
  dreamShape(g, dreamOval(hx, hy, 80, 66, 271, 22), fur, dark, 271, t, 3);
  ellipse(g, hx, hy + 22, 30, 22, '#f4f2ee');
  const blink = (t * 0.6) % 3 > 2.85;
  for (const sx of [-28, 28]) {
    if (blink) line(g, [[hx + sx - 14, hy - 8], [hx + sx + 14, hy - 8]], '#2c2833', 3);
    else {
      ellipse(g, hx + sx, hy - 8, 17, 20, '#8fd0a2');
      ellipse(g, hx + sx, hy - 6, 11, 16, '#2c2833');
      ellipse(g, hx + sx - 5, hy - 13, 4, 5, '#ffffff');
    }
  }
  poly(g, [[hx - 7, hy + 14], [hx + 7, hy + 14], [hx, hy + 22]], '#f08aa0');
  for (const side of [-1, 1]) {
    line(g, [[hx + side * 20, hy + 20], [hx + side * 76, hy + 12]], '#2c283388', 1.6);
    line(g, [[hx + side * 20, hy + 26], [hx + side * 74, hy + 32]], '#2c283388', 1.6);
  }
  rect(g, hx - 56, hy + 48, 112, 10, DREAM_INK.red);
  dreamShape(g, dreamOval(hx, hy + 70, 18, 14, 272, 14), DREAM_INK.gold, '#a8761f', 272, t, 2);
  label(g, 'PEPPER', hx, hy + 73, 8, '#5c3a22', 'center');
  g.restore();
  // Macy, lounging on her like a couch.
  dreamSleeper(g, px - 40 * k, 470 - 92 * k, 1.3 * k + 0.2, t, null, true);
  if (purr > 0) {
    g.globalAlpha = a0 * purr;
    dreamScrawl(g, 'PRRRRR', px + 140 * k, 470 - 230 * k + Math.sin(t * 30) * 2, 24 * Math.min(dreamView.ui, 1.4), '#5d636b', 'center', 273, t);
    g.globalAlpha = a0;
  }
  // Addie and Stella, regular-sized, unimpressed.
  dreamCat(g, sw * 0.82, 590, 0.9, '#f0a24e', '#a8641f', t, 4, null, false);
  dreamCat(g, sw * 0.93, 590, 0.85, '#3a3640', '#151318', t, 5, '#e9e4ec', false);
  if (Math.sin(a) >= 0) car();
  if (t > 1.6) dreamBubble(g, v.line, sw * 0.85, 470, sw * 0.88, 520, { size: 14, maxW: 190, seed: 274, t });
  g.restore();
}

// A softball tryout she already took, graded by gremlins, who applaud politely. Her number drifts.
function dreamTryout(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g),
    ui = Math.min(dreamView.ui, 1.4);
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, 330, '#a9d8f2', '#e4f3fb'));
  rect(g, full.x, 330, full.w, full.y + full.h - 330, '#7cc06a');
  for (let x = Math.floor(full.x / 70) * 70; x < full.x + full.w; x += 70) rect(g, x, 330, 35, full.y + full.h - 330, '#86c973');
  poly(g, [[sw * 0.42, 600], [sw * 0.2, 470], [sw * 0.42, 400], [sw * 0.64, 470]], '#d9a46a');
  ellipse(g, sw * 0.42, 440, 16, 6, '#e9c08a');
  // The backstop, and her jersey hanging on it.
  for (let x = full.x; x < sw * 0.2; x += 16) line(g, [[x, 280], [x, 520]], '#8f8c9688', 1.2);
  for (let y = 280; y <= 520; y += 16) line(g, [[full.x, y], [sw * 0.2, y]], '#8f8c9688', 1.2);
  const jx = sw * 0.1,
    jy = 330;
  dreamShape(g, [[jx - 30, jy], [jx - 12, jy - 8], [jx + 12, jy - 8], [jx + 30, jy], [jx + 24, jy + 16], [jx + 18, jy + 12], [jx + 18, jy + 56], [jx - 18, jy + 56], [jx - 18, jy + 12], [jx - 24, jy + 16]], DREAM_INK.royal, '#14275a', 280, t, 2);
  label(g, dreamJersey(t), jx, jy + 38, 20, DREAM_INK.gold, 'center');
  // The judges' table.
  const tx = sw * 0.62,
    tw = sw * 0.36,
    cheer = t > 3.8;
  for (let i = 0; i < 3; i++) {
    const gx = tx + tw * (0.17 + i * 0.33),
      gy = 438;
    if (cheer) dreamClapper(g, gx, gy, 0.75, i, t, i * 1.3);
    else {
      gremlin(g, gx, gy, 0.75, i, t * 1.3 + i);
      dreamCrayon(g, [[gx, gy - 30], [gx, gy - 58]], '#8a5a3c', 2, 281 + i, t);
      dreamShape(g, dreamBox(gx - 23, gy - 88, 46, 32), DREAM_INK.cream, DREAM_INK.black, 284 + i, t, 1.5);
      dreamFlipLabel(g, v.cards[i], gx, gy - 66, 16, DREAM_INK.red, t + i * 0.4, 1.6, false);
    }
  }
  dreamShape(g, dreamBox(tx, 440, tw, 54), '#fbf8ef', '#8f8c96', 287, t, 2);
  label(g, 'TRYOUTS (AGAIN)', tx + tw / 2, 474, Math.min(15, tw / 11), DREAM_INK.red, 'center');
  // The pitch, the swing, the tink.
  const mx = sw * 0.34,
    my = 566,
    ms = 1.45,
    swing = dreamSpan(1.85, 2.0, t),
    hit = t > 1.95;
  girl(g, mx, my, ms, 0, 1, false, true);
  const hx = mx + 10 * ms,
    hy = my - 42 * ms,
    ba = dreamLerp(-2.3, 0.5, swing);
  dreamCrayon(g, [[hx, hy], [hx + Math.cos(ba) * 62, hy + Math.sin(ba) * 62]], '#c9a26b', 6, 288, t);
  if (t > 1.2 && !hit) {
    const f = (t - 1.2) / 0.75;
    ellipse(g, dreamLerp(sw * 0.46, hx + 30, f), 470 - Math.sin(f * Math.PI) * 50, 5, 5, '#f6f04a');
  }
  if (hit && t < 3.4) {
    const f = (t - 1.95) / 1.4;
    ellipse(g, hx + 30 + f * sw * 0.5, hy - f * 360 + f * f * 120, 5, 5, '#f6f04a');
    if (t < 2.5) dreamScrawl(g, 'TINK!', hx + 70, hy - 30, 24 * ui, DREAM_INK.red, 'left', 289, t);
  }
  gremlin(g, sw * 0.46, 470, 0.55, 3, t * 1.4);
  if (cheer) {
    const said = v.line;
    dreamBubble(g, said, tx + tw / 2, 330, tx + tw / 2, 400, { size: 14, maxW: 230, seed: 290, t, shown: dreamTyped(t, 3.9, 24, said.length) });
    g.globalAlpha = a0 * 0.7;
    dreamScrawl(g, Math.floor(t * 2) % 2 ? 'clap. clap.' : 'clap.', tx + tw / 2, 520, 13 * ui, '#4f7a2e', 'center', 291, t);
    g.globalAlpha = a0;
  } else if (t > 2.4) dreamBubble(g, v.reply, mx, 380, mx, 420, { size: 15, maxW: 200, seed: 292, t });
}

// Her teeth wiggle out and turn into Tic Tacs. A new one grows right back, with a sparkle.
function dreamMirror(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  rect(g, full.x, full.y, full.w, full.h, '#cfe8e4');
  for (let x = Math.floor(full.x / 40) * 40; x < full.x + full.w; x += 40) line(g, [[x, full.y], [x, full.y + full.h]], '#b3d4cf', 1.5);
  for (let y = Math.floor(full.y / 40) * 40; y < full.y + full.h; y += 40) line(g, [[full.x, y], [full.x + full.w, y]], '#b3d4cf', 1.5);
  const cx = sw / 2,
    mw = Math.min(340, sw * 0.56),
    mtop = 50,
    mh = 380;
  dreamShape(g, dreamRound(cx - mw / 2 - 12, mtop - 12, mw + 24, mh + 24, 30), '#c9ced6', '#6d7480', 300, t, 3);
  rect(g, cx - mw / 2, mtop, mw, mh, gradient(g, 0, mtop, 0, mh, '#eef6f8', '#d8e8ee'));
  g.globalAlpha = a0 * 0.5;
  poly(g, [[cx - mw / 2 + 20, mtop], [cx - mw / 2 + 70, mtop], [cx - mw / 2, mtop + 90], [cx - mw / 2, mtop + 40]], '#ffffff');
  g.globalAlpha = a0;
  // Her face in the mirror, big.
  const fx = cx,
    fy = 250;
  dreamShape(g, dreamOval(fx - 98, fy - 30, 34, 70, 301, 16), '#5a3e30', '#3a281e', 301, t, 2);
  ellipse(g, fx - 92, fy - 70, 12, 9, '#f1abbd');
  dreamShape(g, dreamOval(fx, fy, 92, 108, 302, 24), '#f3c9a5', '#b07e5f', 302, t, 2.5);
  dreamShape(g, [[fx - 94, fy - 20], [fx - 90, fy - 80], [fx - 50, fy - 112], [fx + 10, fy - 118], [fx + 70, fy - 100], [fx + 96, fy - 40], [fx + 92, fy - 20], [fx + 60, fy - 74], [fx - 20, fy - 82], [fx - 70, fy - 60]], '#5a3e30', '#3a281e', 303, t, 2);
  for (const ex of [-34, 34]) {
    ellipse(g, fx + ex, fy - 16, 13, 15, '#ffffff');
    ellipse(g, fx + ex + 2, fy - 14, 7, 9, '#5a3e30');
    ellipse(g, fx + ex, fy - 18, 2.5, 3, '#ffffff');
    dreamCrayon(g, [[fx + ex - 14, fy - 40], [fx + ex + 12, fy - 44]], '#3a281e', 3, 304 + ex, t);
  }
  ellipse(g, fx - 54, fy + 22, 14, 8, '#f39aa888');
  ellipse(g, fx + 54, fy + 22, 14, 8, '#f39aa888');
  path(
    g,
    p => {
      p.moveTo(fx - 46, fy + 34);
      p.quadraticCurveTo(fx, fy + 96, fx + 46, fy + 34);
      p.closePath();
    },
    '#b8505a',
    '#7a3b3f',
    2
  );
  // The teeth: one wiggles, pops, and becomes a Tic Tac on its way to the box.
  const teeth = 6,
    tw = 13,
    pops = [1.0, 2.0, 3.0, 3.9],
    boxX = cx + mw / 2 + 40 > sw - 40 ? sw - 50 : cx + mw / 2 + 40,
    boxY = 470;
  let landed = 0;
  for (let i = 0; i < teeth; i++) {
    const x = fx - (teeth * tw) / 2 + (i + 0.5) * tw,
      y = fy + 36 + Math.abs(i - 2.5) * 1.6,
      k = pops.findIndex((p, j) => v.order[j] === i),
      at = k >= 0 ? pops[k] : 99,
      wig = t > at - 0.5 && t < at ? Math.sin(t * 40) * 2 : 0,
      grow = t >= at ? clamp((t - at - 0.3) / 0.3, 0, 1) : 1;
    if (grow > 0) {
      g.save();
      g.translate(x + wig, y);
      g.scale(grow, grow);
      rr(g, -tw / 2 + 1, 0, tw - 2, 12, 3, '#fffdf6', '#d9d2c4', 1);
      g.restore();
    }
    if (t >= at && t < at + 0.3) spark(g, x, y + 6, '#ffffff', 0.5);
    if (t >= at) {
      const f = clamp((t - at) / 0.8, 0, 1);
      if (f < 1) {
        const px = dreamLerp(x, boxX, f),
          py = dreamLerp(y, boxY - 30, f) - Math.sin(f * Math.PI) * 80,
          m = dreamEase(f * 1.6);
        rr(g, px - 6, py - 5 + m * 2, 12, 10 - m * 4, 3 + m * 2, m > 0.5 ? '#eafbf3' : '#fffdf6', '#9cc9b4', 1);
      } else landed++;
    }
  }
  // The counter, the sink, and the box.
  rect(g, full.x, 490, full.w, full.y + full.h - 490, '#e9e2d6');
  dreamCrayon(g, [[full.x, 490], [full.x + full.w, 490]], '#a8a092', 4, 305, t);
  dreamShape(g, dreamOval(cx, 520, 90, 18, 306, 18), '#f7f9fa', '#8f8c96', 306, t, 2);
  dreamShape(g, dreamRound(boxX - 24, boxY - 50, 48, 70, 8), '#d8f3eacc', '#3fae74', 307, t, 2);
  rect(g, boxX - 24, boxY - 56, 48, 10, '#3fae74');
  label(g, 'MINT', boxX, boxY - 26, 11, '#1f6e45', 'center');
  for (let i = 0; i < 3 + landed; i++) rr(g, boxX - 16 + (i % 3) * 11, boxY + 8 - Math.floor(i / 3) * 7, 9, 6, 3, '#ffffff', '#9cc9b4', 0.8);
  dreamScrawl(g, '(FORMERLY TEETH)', boxX, boxY + 44, 11 * Math.min(dreamView.ui, 1.4), '#5a5566', 'center', 308, t);
  if (t > 2.4) dreamBubble(g, v.line, fx - 120, fy - 140, fx - 60, fy - 100, { size: 16, maxW: 200, seed: 309, t });
}

// Flying over Ramsey High, then forgetting how. A cloud catches her. Nobody minds.
function dreamFlying(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g),
    ui = Math.min(dreamView.ui, 1.4);
  dreamWash(g, full, '#9fd3f5', '#fde3c8', 320, t);
  for (let i = 0; i < 3; i++) {
    const x = full.x + ((((i * 0.37 - t * 0.03) % 1) + 1) % 1) * (full.w + 300) - 150;
    dreamCloud(g, x, 110 + i * 40, 90 + i * 20, '#ffffff', '#c3d8ea', 321 + i, t, 0.6);
  }
  // Ramsey, far below.
  rect(g, full.x, 540, full.w, full.y + full.h - 540, '#7cc06a');
  const sx = sw * 0.68;
  dreamShape(g, dreamBox(sx - 110, 470, 220, 80), '#c9705a', '#7a3b2a', 322, t, 2.5);
  poly(g, [[sx - 120, 472], [sx, 430], [sx + 120, 472]], '#8a4b3a');
  for (let i = 0; i < 5; i++) rect(g, sx - 90 + i * 38, 492, 18, 16, '#f6e7a8');
  dreamShape(g, dreamBox(sx - 60, 446, 120, 22), DREAM_INK.royal, '#14275a', 323, t, 1.6);
  label(g, 'RAMSEY', sx, 462, 14, DREAM_INK.gold, 'center');
  for (let i = 0; i < 4; i++) dreamShape(g, dreamOval(sw * 0.1 + i * 70, 548, 22, 18, 324 + i, 12), '#4f9a4a', '#2f6a3a', 324 + i, t, 1.6);
  if (v.ghost) dreamGhost(g, sw * 0.86, 120, 0.85, t, 330);
  // The landing cloud, big and soft.
  const lx = sw * 0.38,
    ly = 470;
  dreamCloud(g, lx, ly + 20, 170, '#ffffff', '#b9cfe2', 335, t, 0.55);
  // Her flight: across, a pause to think about it, then down, gently.
  let x, y, rot;
  if (t < 2.4) {
    x = sw * 0.08 + (t / 2.4) * (lx - sw * 0.08);
    y = 230 + Math.sin(t * 2) * 10;
    rot = Math.PI / 2;
  } else if (t < 3.3) {
    x = lx;
    y = 230 + Math.sin(t * 2) * 6;
    rot = dreamLerp(Math.PI / 2, 0, dreamSpan(2.4, 3.1, t));
  } else {
    const f = clamp((t - 3.3) / 1.2, 0, 1);
    x = lx;
    y = dreamLerp(230, ly - 8, f * f);
    rot = f < 1 ? Math.sin(t * 14) * 0.12 : 0;
    if (f >= 1) y -= Math.abs(Math.sin((t - 4.5) * 7)) * 22 * Math.exp(-(t - 4.5) * 2.5);
  }
  if (t < 2.4)
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.8 + i / 3) % 1;
      g.globalAlpha = a0 * (1 - k) * 0.7;
      dreamCrayon(g, [[x - 60 - k * 50, y - 20 + i * 14], [x - 100 - k * 50, y - 20 + i * 14]], '#ffffff', 3, 336 + i, t);
      g.globalAlpha = a0;
    }
  g.save();
  g.translate(x, y - 52);
  g.rotate(rot);
  girl(g, 0, 52, 1.3, 0, 1, false, false);
  g.restore();
  if (t > 2.5 && t < 3.6) dreamBubble(g, v.line, x + 40, y - 100, x + 6, y - 80, { size: 15, maxW: 220, seed: 337, t, hand: true });
  if (t > 4.5 && t < 5.4) dreamScrawl(g, 'boing', x + 60, ly - 70, 22 * ui, '#6d6378', 'left', 338, t);
}

// A door that opens onto the same room, which has a door that opens onto the same room. The sign says
// GREEN in pink (and PINK in green, on second look).
function dreamDoorRoom(g, t, depth, v) {
  const open = dreamSpan(0.7 + depth * 0.6, 1.4 + depth * 0.6, t),
    dx = 150,
    dy = 240,
    dw = 100,
    dh = 180;
  rect(g, 0, 0, 400, 420, '#cfe3d8');
  rect(g, 0, 420, 400, 100, '#a9c7b9');
  dreamCrayon(g, [[0, 420], [400, 420]], '#6f8f86', 3, 340, t);
  dreamShape(g, dreamBox(16, 340, 110, 50), '#f2f5ea', '#56727a', 341, t, 2);
  dreamShape(g, dreamBox(16, 300, 12, 100), '#a7c3c9', '#56727a', 342, t, 2);
  ellipse(g, 46, 336, 18, 8, DREAM_INK.cream);
  // The Stroop sign.
  const f = dreamFlip(t + depth * 0.3, 2.4, 2),
    word = f.i ? 'PINK' : 'GREEN',
    ink = f.i ? '#4f9a4a' : '#ef7fb0';
  dreamShape(g, dreamRound(dx - 20, dy - 56, dw + 40, 40, 8), '#2c2833', '#111111', 343, t, 2);
  g.save();
  g.translate(dx + dw / 2, dy - 27);
  g.scale(f.sx, 1);
  label(g, word, 0, 0, 22, ink, 'center');
  g.restore();
  // The doorway: the next room down if open, else the door.
  if (open > 0) {
    if (depth < 4) {
      g.save();
      g.beginPath();
      g.rect(dx, dy, dw, dh);
      g.clip();
      const k = dh / 520;
      g.translate(dx + dw / 2 - 200 * k, dy);
      g.scale(k, k);
      dreamDoorRoom(g, t, depth + 1, v);
      g.restore();
    } else rect(g, dx, dy, dw, dh, '#2c2833');
    const w = dw * (1 - open);
    dreamShape(g, [[dx, dy], [dx + w, dy + 10 * open], [dx + w, dy + dh - 10 * open], [dx, dy + dh]], '#f4c27a', '#7d5a30', 344, t, 2);
  } else {
    dreamShape(g, dreamBox(dx, dy, dw, dh), '#f4c27a', '#7d5a30', 344, t, 2);
    label(g, '10', dx + dw / 2, dy + 60, 22, '#5a4a3a', 'center');
    ellipse(g, dx + dw - 14, dy + dh / 2, 5, 5, DREAM_INK.gold);
  }
  dreamCrayon(g, dreamBox(dx, dy, dw, dh), '#5c3a22', 4, 345, t, true);
  // Macy, at every size, opening her door.
  girl(g, 300, 470, 1.25, 0, -1, false, true);
}

function dreamDoor(g, sw, t, v, dur, full) {
  rect(g, full.x, full.y, full.w, full.h, '#cfe3d8');
  const k = Math.min(sw / 400, 600 / 520),
    ox = sw / 2 - 200 * k,
    oy = 10;
  rect(g, full.x, oy + 420 * k, full.w, full.y + full.h - oy - 420 * k, '#a9c7b9');
  g.save();
  g.translate(ox, oy);
  g.scale(k, k);
  dreamDoorRoom(g, t, 0, v);
  g.restore();
  if (t > 2.6) dreamBubble(g, v.line, ox + 300 * k, oy + 330 * k, ox + 300 * k, oy + 360 * k, { size: 16, maxW: 220, seed: 346, t });
}

// An elevator that goes sideways, run by a gremlin in a little cap.
function dreamElevator(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g);
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, full.h, '#efe3c8', '#d9c7a4'));
  const top = 250,
    bot = 480,
    travel = 1150 * dreamEase(clamp(t / 4.6, 0, 1)),
    moving = t < 4.6;
  rect(g, full.x, top, full.w, bot - top, '#c9b79c');
  dreamCrayon(g, [[full.x, top], [full.x + full.w, top]], '#6b5a48', 5, 350, t);
  dreamCrayon(g, [[full.x, bot], [full.x + full.w, bot]], '#6b5a48', 5, 351, t);
  // Floor markers, sliding past the wrong way.
  const gap = 260,
    first = Math.floor((full.x - sw / 2 + travel) / gap) - 1;
  let here = v.floors[0];
  for (let i = first; i * gap - travel + sw / 2 < full.x + full.w + gap; i++) {
    const x = i * gap - travel + sw / 2,
      name = v.floors[((i % v.floors.length) + v.floors.length) % v.floors.length];
    dreamCrayon(g, [[x, top - 40], [x, bot + 40]], '#8a7a62', 3, 352 + i, t);
    label(g, name, x + 10, bot + 30, Math.min(16, 150 / Math.max(1, name.length * 0.6)), '#5a4a3a', 'left');
    if (Math.abs(x - sw / 2) < gap / 2) here = name;
  }
  // The car.
  const cx = sw / 2 + (moving ? Math.sin(t * 30) * 1.2 : 0),
    cw = 200,
    ch = 200,
    cy = bot - ch;
  if (moving)
    for (let i = 0; i < 4; i++) {
      const k = (t * 2 + i / 4) % 1;
      g.globalAlpha = a0 * (1 - k) * 0.6;
      dreamCrayon(g, [[cx - cw / 2 - 20 - k * 60, cy + 30 + i * 40], [cx - cw / 2 - 70 - k * 60, cy + 30 + i * 40]], '#ffffff', 3, 360 + i, t);
      g.globalAlpha = a0;
    }
  dreamShape(g, dreamBox(cx - cw / 2, cy, cw, ch), '#f6e7c4', '#8a6a2a', 361, t, 3);
  girl(g, cx - 40, bot - 4, 1.15, 0, 1, false, false);
  gremlin(g, cx + 50, bot - 4, 0.75, 2, t * 1.3);
  dreamShape(g, [[cx + 36, bot - 46], [cx + 64, bot - 46], [cx + 60, bot - 58], [cx + 40, bot - 58]], '#b8322a', '#7a1e18', 362, t, 1.4);
  const gate = moving ? 0 : dreamSpan(4.9, 5.6, t);
  g.globalAlpha = a0 * 0.75;
  for (let x = cx - cw / 2 + 10; x < cx + cw / 2 - 4; x += 16) {
    const gx = dreamLerp(x, cx - cw / 2 + 6 + (x - cx + cw / 2) * 0.08, gate);
    line(g, [[gx, cy + 6], [gx, bot - 4]], '#8a6a2a', 2);
  }
  g.globalAlpha = a0;
  // The dial, pointing sideways, and the floor it thinks it is on.
  const dyy = cy - 34;
  dreamShape(g, dreamRound(cx - 90, dyy - 40, 180, 56, 10), '#d9b45a', '#8a6a2a', 363, t, 2);
  const na = moving ? -0.08 + Math.sin(t * 9) * 0.06 : 0;
  line(g, [[cx - 50, dyy - 12], [cx - 50 + Math.cos(na) * 34, dyy - 12 + Math.sin(na) * 34]], '#2c2833', 3);
  poly(g, [[cx - 12, dyy - 18], [cx - 12, dyy - 6], [cx - 4, dyy - 12]], '#2c2833');
  label(g, here, cx + 30, dyy - 6, Math.min(16, 100 / Math.max(1, here.length * 0.6)), '#2c2833', 'center');
  if (!moving && t < 5.4) dreamScrawl(g, 'DING', cx + 110, cy + 10, 22, DREAM_INK.red, 'left', 364, t);
  dreamBubble(g, v.line, cx + 80, cy - 80, cx + 50, bot - 60, { size: 14, maxW: 200, seed: 365, t, shown: dreamTyped(t, 0.6, 24, v.line.length) });
  if (t > 5) dreamBubble(g, v.reply, cx - 60, cy + 40, cx - 40, bot - 100, { size: 14, maxW: 180, seed: 366, t });
}

// An inkblot: one half drawn, then the mirror of it. kind: 0 gremlin, 1 Ralph, 2 cat, 3 gremlin waving.
function dreamBlot(g, x, y, s, kind, t, seed) {
  const ink = '#2c2833',
    paper = '#fbf4e2';
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  for (const side of [-1, 1]) {
    g.save();
    g.scale(side, 1);
    if (kind === 2) {
      ellipse(g, 0, -6, 40, 34, ink);
      poly(g, [[14, -30], [36, -66], [40, -18]], ink);
      ellipse(g, 0, 40, 30, 24, ink);
      dreamCrayon(g, [[26, 50], [60, 30], [56, 0]], ink, 9, seed, t);
      line(g, [[20, 2], [56, -4]], ink, 2);
      line(g, [[20, 8], [54, 14]], ink, 2);
    } else {
      ellipse(g, 0, -8, 36, 28, ink);
      poly(g, [[22, -18], [64, -48], [46, -2]], ink);
      ellipse(g, 0, 36, 24, 26, ink);
      if (kind === 3 && side > 0) dreamCrayon(g, [[20, 26], [40, 0], [44, -30 + Math.sin(t * 8) * 6]], ink, 10, seed + 1, t);
      else ellipse(g, 30, 32, 13, 8, ink);
      ellipse(g, 16, 64, 12, 7, ink);
      if (kind === 1) poly(g, [[0, -34], [0, -56], [10, -44], [20, -60], [26, -36]], ink);
    }
    for (let i = 0; i < 5; i++) ellipse(g, 30 + dreamHash(seed, i) * 40, dreamHash(seed + 1, i) * 70, 2 + (i % 3), 2 + (i % 3), ink);
    // Negative space for the eyes and grin.
    ellipse(g, 14, kind === 2 ? -8 : -10, 6, 8, paper);
    if (kind !== 2) path(g, p => p.arc(0, 4, 12, 0.2, Math.PI / 2), null, paper, 3);
    g.restore();
  }
  g.restore();
}

// The inkblot test. Every card is a gremlin, more or less.
function dreamInkblot(g, sw, t, v, dur, full) {
  dreamRoomWash(g, full, '#efe3cf', '#a0673f', 520, 370, t);
  // The bookshelf and the diploma.
  dreamShape(g, dreamBox(sw * 0.03, 150, 120, 220), '#8a5a3c', '#5c3a22', 371, t, 2.5);
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 6; i++) rect(g, sw * 0.03 + 10 + i * 17, 162 + r * 70, 13, 54, DREAM_DOORS[(i + r) % 5]);
  dreamShape(g, dreamBox(sw * 0.76, 90, 130, 80), DREAM_INK.cream, '#a8761f', 372, t, 3);
  label(g, 'PH.D.', sw * 0.76 + 65, 122, 14, '#5a4a3a', 'center');
  label(g, 'GREMLINS', sw * 0.76 + 65, 144, 13, '#5a4a3a', 'center');
  // The hand from off-stage, and the card it holds.
  const cx = sw / 2,
    cy = 250,
    cw = 300,
    chh = 220,
    f = dreamFlip(t, 1.9, 99),
    kind = v.cards[f.i % v.cards.length];
  dreamCrayon(g, [[sw + 80, 340], [cx + cw / 2 + 30, cy + 40]], '#7b8fa6', 26, 373, t);
  ellipse(g, cx + cw / 2 + 14, cy + 36, 16, 13, '#e2ae88');
  g.save();
  g.translate(cx, cy);
  g.scale(f.sx, 1);
  dreamShape(g, dreamBox(-cw / 2, -chh / 2, cw, chh), '#fbf4e2', '#8f8c96', 374, t, 2);
  dreamBlot(g, 0, -6, 1.15, kind, t, 375 + kind);
  g.restore();
  const mx = sw * 0.15;
  girl(g, mx, 590, 1.35, 0, 1, false, true);
  dreamBubble(g, f.i === 0 ? 'What do you see?' : v.notes[(f.i - 1) % v.notes.length], cx + cw / 2 + 40, 110, cx + cw / 2 + 20, 140, { size: 14, maxW: 180, seed: 376, t });
  if (t > 0.5) dreamBubble(g, DREAM_BLOT_ANSWERS[kind], mx + 30, 430, mx + 6, 460, { size: 15, maxW: 170, seed: 377, t });
}

// Stairs in the hallway that only go up. Both ways. Some of the gremlins are on the ceiling.
function dreamStairFlight(g, n, off, t, seed, tread, riser) {
  for (let i = -1; i < n; i++) {
    const k = i - off,
      x = k * 46,
      y = -k * 30;
    poly(g, [[x, y], [x + 46, y], [x + 70, y - 16], [x + 24, y - 16]], tread);
    poly(g, [[x + 46, y], [x + 46, y + 30], [x, y + 30], [x, y]], riser);
    dreamCrayon(g, [[x, y], [x + 46, y], [x + 46, y + 30]], '#4a4560', 1.6, seed + i, t);
  }
}

function dreamStairs(g, sw, t, v, dur, full) {
  rect(g, full.x, full.y, full.w, full.h, gradient(g, 0, full.y, 0, full.h, '#e1ddef', '#bdb6d6'));
  const off = (t * 1.4) % 1,
    bx = sw * 0.18,
    by = 560;
  // The main flight. She climbs and climbs and stays exactly where she is.
  g.save();
  g.translate(bx, by);
  dreamStairFlight(g, 11, off, t, 380, '#f3efe4', '#cfc8e0');
  g.restore();
  const step = 4.5;
  girl(g, bx + step * 46 + 24, by - step * 30 - 8, 1.2, t * 6, 1, false, false);
  // On the ceiling, upside down: a flight and a cheerful gremlin.
  g.save();
  g.translate(sw * 0.3, 70);
  g.scale(1, -1);
  dreamStairFlight(g, 8, (t * 0.9) % 1, t, 400, '#f3efe4', '#cfc8e0');
  gremlin(g, 3 * 46 + 30, -3 * 30 - 16, 0.6, 1, t * 1.6);
  g.restore();
  // On the wall, sideways.
  g.save();
  g.translate(sw - 40, 520);
  g.rotate(-Math.PI / 2);
  dreamStairFlight(g, 6, (t * 1.1) % 1, t, 420, '#f3efe4', '#cfc8e0');
  gremlin(g, 2 * 46 + 30, -2 * 30 - 16, 0.55, 3, t * 1.6);
  g.restore();
  // UP, both ways.
  for (const [x, y, dir] of [[bx - 20, by - 70, -1], [sw * 0.3 + 30, 150, 1]]) {
    dreamShape(g, dreamBox(x - 30, y - 18, 60, 36), DREAM_INK.cream, '#4a4560', 430 + dir, t, 2);
    label(g, 'UP', x - 6, y + 7, 16, DREAM_INK.red, 'center');
    poly(g, [[x + 16, y - dir * 12], [x + 24, y + dir * 6], [x + 8, y + dir * 6]], DREAM_INK.red);
  }
  dreamFlipLabel(g, ['FLOOR 1', 'FLOOR 1', 'FLOOR 1 (STILL)'], sw / 2 + 40, 300, 18, '#5a5566', t, 2.2, true, 432);
  dreamBubble(g, v.line, sw * 0.3 + 330, 230, sw * 0.3 + 196, 200, { size: 14, maxW: 180, seed: 433, t });
  if (t > 3.2) dreamBubble(g, v.reply, bx + step * 46, by - step * 30 - 140, bx + step * 46 + 24, by - step * 30 - 112, { size: 14, maxW: 190, seed: 434, t });
}

// A dream within a dream: the nurse wakes her, everything looks right, and for three seconds it is.
// Then the clock on the IV pole starts melting and the nurse has cat ears.
const DREAM_FALSE_AT = 3;

function dreamFalseWake(g, sw, t, v, dur, full) {
  const a0 = dreamAlpha(g),
    reveal = dreamSpan(DREAM_FALSE_AT, DREAM_FALSE_AT + 0.9, t);
  dreamBedside(g, sw, t, full, true, {
    line: v.line,
    jerkAt: 0.9,
    card: false,
    inside: gg => {
      if (t > 1.6) dreamMeltClock(gg, 50, 164, 9 + reveal * 4, t - 1.6, 440);
      if (reveal > 0) {
        gg.globalAlpha = a0 * reveal;
        for (const side of [-1, 1])
          dreamShape(gg, [[300 + side * 5, 174], [300 + side * 15, 148], [300 + side * 18, 178]], '#2b1d1a', '#2b1d1a', 441 + side, t, 1);
        gg.globalAlpha = a0;
      }
    }
  });
  if (reveal <= 0) return;
  g.globalAlpha = a0 * reveal * 0.3;
  dreamWash(g, full, '#3a3470', '#8a76b8', 442, t);
  g.globalAlpha = a0 * reveal;
  dreamStars(g, full, 14, 443, t);
  dreamScrawl(g, v.tell, sw / 2, 96, 30 * Math.min(dreamView.ui, 1.4), '#efe6ff', 'center', 444, t);
  g.globalAlpha = a0;
}

// A fresh order of list, from rand().
function dreamShuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Four clock faces, each a little more wrong than the last.
function dreamClockSets() {
  return Array.from({ length: 4 }, (_, k) => {
    const nums = Array.from({ length: 12 }, (_, i) => String(i + 1));
    for (let j = 0; j < 2 + k * 2; j++) nums[Math.floor(rand(0, 12))] = pick(DREAM_CLOCK_ODD);
    return nums;
  });
}

// The pool: twenty-five, five or six a night.
const DREAM_POOL = [
  {
    id: 'hallway',
    title: 'The hallway gets longer the faster she walks',
    setup: () => {
      const subs = dreamShuffle(DREAM_HALL_SUBS);
      return { sub: subs[0], sub2: subs[1], shift: Math.floor(rand(0, 5)) };
    },
    draw: dreamHallway
  },
  {
    id: 'map',
    title: 'The floor plan in crayon',
    setup: () => ({ goo: pick(DREAM_MAP_GOO), shop: pick(DREAM_MAP_SHOP), desk: pick(DREAM_MAP_DESK), lift: pick(DREAM_MAP_LIFT) }),
    draw: dreamMap
  },
  {
    id: 'sorry',
    title: 'Tiny apologetic gremlins',
    setup: () => ({
      words: Array.from({ length: 12 }, () => pick(DREAM_SORRIES)),
      petals: Array.from({ length: 12 }, () => pick(DREAM_PETALS))
    }),
    draw: dreamSorry
  },
  {
    id: 'italian',
    title: "Dad's jokes in Italian",
    voice: 'dad',
    typed: (t, v, dur) => dreamTyped(t, 0.7, Math.max(22, v.joke.length / (dur * 0.5)), v.joke.length),
    setup: () => ({ joke: pick(DREAM_DAD_JOKES) }),
    draw: dreamItalian
  },
  {
    id: 'mri',
    title: 'The volleyball net in the MRI',
    setup: () => ({ sub: pick(DREAM_MRI_SUBS), mine: pick(['MINE!', 'MINE!!', 'MIIINE!']) }),
    draw: dreamMri
  },
  {
    id: 'rowdy',
    title: 'Rowdy, twelve feet tall, whispering',
    voice: 'rowdy',
    voiceVol: 0.25,
    typed: (t, v) => dreamTyped(t, 1.2, 14, v.line.length),
    setup: () => ({ line: pick(DREAM_ROWDY_WHISPERS) }),
    draw: dreamRowdy
  },
  {
    id: 'barb',
    title: 'Barb delivers Ensure by catapult, over the moon',
    voice: 'ensure',
    typed: (t, v) => dreamTyped(t, 0.4, 24, v.line.length),
    setup: () => ({ line: pick(DREAM_BARB_LINES), reply: pick(DREAM_BARB_REPLIES), flavor: Math.floor(rand(0, 3)) }),
    draw: dreamBarb
  },
  {
    id: 'ivdog',
    title: 'The IV pole walks her like a dog, politely',
    setup: () => ({ line: pick(DREAM_POLE_LINES), reply: pick(DREAM_POLE_REPLIES) }),
    draw: dreamIvDog
  },
  {
    id: 'etype',
    title: 'Her LEGO E-Type, a gremlin at the wheel',
    setup: () => ({ line: pick(DREAM_ETYPE_LINES), type: Math.floor(rand(0, 4)) }),
    draw: dreamEtypeScene
  },
  {
    id: 'cats',
    title: 'Three cats in nurse hats take her blood pressure',
    setup: () => ({ reading: pick(DREAM_CAT_READINGS), mrrp: pick(DREAM_CAT_LINES) }),
    draw: dreamCats
  },
  {
    id: 'ralph',
    title: 'Ralph, tiny, in a jar',
    setup: () => {
      const lines = DREAM_RALPH_LINES.slice();
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(rand(0, i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      return { lines: lines.slice(0, 3) };
    },
    draw: dreamJar
  },
  {
    id: 'clouds',
    title: 'A volleyball court in the clouds',
    setup: () => ({ line: pick(DREAM_COURT_LINES) }),
    draw: dreamClouds
  },
  {
    id: 'school',
    title: 'Late for class in pajamas, running through syrup',
    voice: 'cousin',
    typed: (t, v) => dreamTyped(t, 0.6, 24, dreamFill(v.line).length),
    setup: () => ({ line: pick(DREAM_SCHOOL_LINES), reply: pick(DREAM_SCHOOL_REPLIES), poster: pick(DREAM_SCHOOL_POSTERS), clock: dreamClockSets() }),
    draw: dreamSchool
  },
  {
    id: 'doctor',
    title: "Dr. Benedetto in Rowdy's horns, and a net in the ultrasound",
    voice: 'doctor',
    typed: (t, v) => dreamTyped(t, 0.5, 24, v.slip.length) + dreamTyped(t, 0.5 + v.slip.length / 24 + 0.9, 24, DREAM_DOC_FIX.length),
    setup: () => ({ slip: pick(DREAM_DOC_SLIPS), reply: pick(DREAM_DOC_REPLIES), screen: pick(DREAM_DOC_SCREENS) }),
    draw: dreamDoctor
  },
  {
    id: 'snack',
    title: "Pavlov's bell, then Maslow's hierarchy of pudding",
    setup: () => ({ line: pick(DREAM_SNACK_LINES), reply: pick(DREAM_SNACK_REPLIES), think: pick(DREAM_SNACK_THINKS) }),
    draw: dreamSnack
  },
  {
    id: 'blink',
    title: "Barb's Ensure doubles every time she blinks",
    voice: 'ensure',
    typed: (t, v) => dreamTyped(t, 0.3, 24, v.line.length),
    setup: () => ({
      line: pick(DREAM_BLINK_LINES),
      reply: pick(DREAM_BLINK_REPLIES),
      flavor: Math.floor(rand(0, 3)),
      blinks: [0.9, 1.75, 2.5, 3.15, 3.7, 4.2].map(b => b + rand(-0.08, 0.08))
    }),
    draw: dreamBlink
  },
  {
    id: 'bedroom',
    title: 'Pepper, the size of a sofa; the E-Type drives itself',
    setup: () => ({ line: pick(DREAM_PEPPER_LINES), phase: rand(0, Math.PI * 2) }),
    draw: dreamBedroom
  },
  {
    id: 'tryout',
    title: 'A tryout she already took, graded by gremlins',
    setup: () => ({ line: pick(DREAM_TRYOUT_LINES), reply: pick(DREAM_TRYOUT_REPLIES), cards: dreamShuffle(DREAM_TRYOUT_CARDS).slice(0, 3) }),
    draw: dreamTryout
  },
  {
    id: 'mirror',
    title: 'Her teeth turn into Tic Tacs',
    setup: () => ({ line: pick(DREAM_MIRROR_LINES), order: dreamShuffle([0, 1, 2, 3, 4, 5]).slice(0, 4) }),
    draw: dreamMirror
  },
  {
    id: 'flying',
    title: 'Flying over Ramsey, then forgetting how',
    setup: () => ({ line: pick(DREAM_FLY_LINES), ghost: rand(0, 1) < 0.6 }),
    draw: dreamFlying
  },
  {
    id: 'door',
    title: 'A door that opens onto the same room',
    setup: () => ({ line: pick(DREAM_DOOR_LINES) }),
    draw: dreamDoor
  },
  {
    id: 'elevator',
    title: 'An elevator that goes sideways',
    setup: () => ({ line: pick(DREAM_LIFT_LINES), reply: pick(DREAM_LIFT_REPLIES), floors: dreamShuffle(DREAM_LIFT_FLOORS).slice(0, 7) }),
    draw: dreamElevator
  },
  {
    id: 'inkblot',
    title: 'The inkblot test. Every card is a gremlin',
    setup: () => ({ cards: [0, ...dreamShuffle([1, 2, 3])], notes: dreamShuffle(DREAM_BLOT_NOTES) }),
    draw: dreamInkblot
  },
  {
    id: 'stairs',
    title: 'Stairs that only go up, both ways',
    setup: () => ({ line: pick(DREAM_STAIR_LINES), reply: pick(DREAM_STAIR_REPLIES) }),
    draw: dreamStairs
  },
  {
    id: 'falsewake',
    title: 'A dream within a dream: awake for three seconds',
    voice: 'nurse',
    typed: (t, v) => dreamTyped(t, 0.35, DREAM_NURSE_CPS, v.line.length),
    // Full color and a steady frame while it passes for real, then the dream seeps back in.
    sat: t => 1 - 0.55 * dreamSpan(DREAM_FALSE_AT, DREAM_FALSE_AT + 0.9, t),
    calm: t => dreamSpan(0, 0.8, t) * (1 - dreamSpan(DREAM_FALSE_AT, DREAM_FALSE_AT + 0.9, t)),
    setup: () => ({ line: pick(DREAM_FALSE_LINES), tell: pick(DREAM_FALSE_TELLS) }),
    draw: dreamFalseWake
  }
];

const DREAM_BY_ID = Object.fromEntries(DREAM_POOL.map(d => [d.id, d]));

// ---- The bedside: falling asleep and waking up ----
// Home base after dark, close on the bed. Asleep, the frame tilts and drifts; awake, Macy sits up and
// the nurse on rounds gets her line.
// o (optional): line, the nurse's words (default dream.nurse); jerkAt, when the hypnic jerk hits;
// card, false to skip the dream analysis; inside(g), more drawing in the room's own coordinates.
function dreamBedside(g, sw, t, full, awake, o = {}) {
  const a0 = dreamAlpha(g),
    said = o.line || dream.nurse,
    jerkAt = Number.isFinite(o.jerkAt) ? o.jerkAt : 0.45,
    jk = awake ? clamp((t - jerkAt) / 0.35, 0, 1) : 0,
    hop = jk > 0 && jk < 1 ? Math.sin(jk * Math.PI) * 9 : 0,
    shake = hop ? Math.sin(t * 70) * 2.5 * (1 - jk) : 0;
  rect(g, full.x, full.y, full.w, full.h, '#0e1a2b');
  const tilt = awake ? (1 - dreamEase(t / 0.7)) * 0.07 : dreamEase(t / DREAM_INTRO) * 0.09,
    zoom = awake ? 1.06 - 0.06 * dreamEase(t / 0.7) : 1 + 0.12 * dreamEase(t / DREAM_INTRO),
    z = Math.max(clamp(sw / 520, 1.15, 1.6), full.w / 1000, full.h / 625) * zoom,
    ccx = full.x + full.w / 2,
    ccy = full.y + full.h / 2,
    halfW = full.w / 2 / z,
    halfH = full.h / 2 / z,
    fx = clamp(236, halfW, Math.max(halfW, 1000 - halfW)),
    fy = clamp(228, halfH, Math.max(halfH, 625 - halfH)),
    toStage = (x, y) => {
      const dx = (x - fx) * z,
        dy = (y - fy) * z;
      return [ccx + dx * Math.cos(tilt) - dy * Math.sin(tilt), ccy + dx * Math.sin(tilt) + dy * Math.cos(tilt)];
    };
  g.save();
  g.translate(ccx + shake, ccy);
  g.rotate(tilt);
  g.scale(z, z);
  g.translate(-fx, -fy);
  roomBg(g, DREAM_ROOM);
  ivStand(g, 69, 278, 0.86);
  bed(g, 162, 270, 1.05);
  const s = 1.05,
    feet = 270 - 104 * s + 68 * s - (awake ? 26 : 0) - hop;
  girl(g, 162, feet, s, 0, 1, false, false);
  if (!awake) {
    g.save();
    g.translate(162, feet);
    g.scale(s, s);
    dreamLids(g);
    g.restore();
  }
  dreamBlanket(g, 162, 270, s);
  if (awake) dreamNurse(g, 300, 336, 1.2, t, t < 0.35 + said.length / DREAM_NURSE_CPS);
  if (typeof o.inside === 'function') o.inside(g);
  rect(g, 0, 0, 1000, 625, '#162a5226');
  g.restore();
  if (!awake) {
    const [hx, hy] = toStage(150, 150);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      g.globalAlpha = dreamAlpha(g) * Math.sin(k * Math.PI);
      dreamScrawl(g, i % 2 ? 'z' : 'Z', hx + 10 + k * 40 + i * 10, hy - 10 - k * 70, 16 + i * 6, '#efe6ff', 'center', 140 + i, t);
      g.globalAlpha = a0;
    }
    return;
  }
  const [mx, my] = toStage(162, 130);
  // The hypnic jerk: a tiny jump, and a startled mark over her head.
  if (t >= jerkAt && t < jerkAt + 1) dreamScrawl(g, '!', mx + 18, my - 10 - hop * z, 30, '#ffe29b', 'center', 141, t);
  const [nx, ny] = toStage(300, 336 - 140 * 1.2),
    shown = dreamTyped(t, 0.35, DREAM_NURSE_CPS, said.length);
  if (shown > 0) dreamBubble(g, said, nx + 30, ny - 12, nx - 4, ny + 4, { size: 17, maxW: 300, seed: 142, t, shown });
  if (o.card !== false) dreamCard(g, sw, t);
}

// The cameo card as she wakes, for the grown-ups reading over her shoulder.
function dreamCard(g, sw, t) {
  const k = dreamEase((t - 1.3) / 0.5);
  if (k <= 0) return;
  const ui = Math.min(dreamView.ui, 1.5),
    hs = 11 * ui,
    bs = 18 * ui,
    ps = 11 * ui,
    head = 'DREAM ANALYSIS',
    body = 'She misses her cats.',
    tail = dream.ps || '',
    w = Math.min(sw - 60, Math.max(dreamTextW(g, head, hs), dreamTextW(g, body, bs, true), tail ? dreamTextW(g, tail, ps, true) : 0) + 40),
    h = hs + bs * 1.3 + (tail ? ps * 1.6 : 0) + 26,
    x = 28,
    y = 625 - h - 22 + (1 - k) * (h + 80);
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate(-0.035);
  dreamShape(g, dreamBox(-w / 2, -h / 2, w, h), '#fffdf4', '#b8a98a', 150, t, 1.6);
  line(g, [[-w / 2 + 14, -h / 2], [-w / 2 + 14, h / 2]], '#e2574c88', 1);
  for (let ly = -h / 2 + hs + 14; ly < h / 2 - 3; ly += bs * 0.9) line(g, [[-w / 2, ly], [w / 2, ly]], '#9cc3e688', 1);
  label(g, head, -w / 2 + 22, -h / 2 + hs + 8, hs, DREAM_INK.red, 'left');
  dreamScrawl(g, body, -w / 2 + 22, -h / 2 + hs + bs * 1.2 + 10, bs, DREAM_INK.royal, 'left', 151, t);
  if (tail) dreamScrawl(g, tail, -w / 2 + 22, -h / 2 + hs + bs * 1.3 + ps * 1.4 + 12, ps, '#5a5566', 'left', 152, t);
  dreamCrayon(g, [[w / 2 - 30, -h / 2 + 14], [w / 2 - 30, -h / 2 - 10], [w / 2 - 22, -h / 2 - 10], [w / 2 - 22, -h / 2 + 8]], '#8f8c96', 2, 153, t);
  g.restore();
}

// The bed's blanket again, drawn over Macy so she is tucked in.
function dreamBlanket(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  path(
    g,
    p => {
      p.moveTo(-59, -85);
      p.quadraticCurveTo(0, -94, 59, -84);
      p.lineTo(59, -15);
      p.quadraticCurveTo(0, -6, -59, -16);
      p.closePath();
    },
    gradient(g, -59, -90, 115, 80, '#9ddac7', '#5daaa9')
  );
  path(
    g,
    p => {
      p.moveTo(-57, -84);
      p.quadraticCurveTo(0, -89, 57, -83);
      p.lineTo(57, -70);
      p.quadraticCurveTo(0, -76, -57, -69);
      p.closePath();
    },
    '#c2e6cf'
  );
  g.restore();
}

// ---- Timeline ----

// Durations for n vignettes that add up to sum, each between DREAM_MIN and DREAM_MAX: random weights,
// then whatever a capped vignette cannot take is poured into the others.
function dreamDurations(n, sum) {
  const w = Array.from({ length: n }, () => rand(0.6, 1.4)),
    d = new Array(n).fill(DREAM_MIN);
  let extra = sum - DREAM_MIN * n,
    open = w.map((_, i) => i);
  for (let pass = 0; pass <= n && extra > 1e-9 && open.length; pass++) {
    const weight = open.reduce((a, i) => a + w[i], 0),
      next = [];
    let used = 0;
    for (const i of open) {
      const add = (extra * w[i]) / weight,
        room = DREAM_MAX - d[i];
      if (add >= room) {
        d[i] = DREAM_MAX;
        used += room;
      } else {
        d[i] += add;
        used += add;
        next.push(i);
      }
    }
    extra -= used;
    open = next;
  }
  return d;
}

// Tonight's dream: five or six vignettes from the pool in a fresh order, each with its own picks.
function dreamPlan() {
  const ids = DREAM_POOL.map(d => d.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const n = rand(0, 1) < 0.5 ? 5 : 6,
    total = rand(DREAM_SHORTEST, DREAM_LONGEST),
    durs = dreamDurations(n, total - DREAM_INTRO - DREAM_WAKE),
    fw = ids.indexOf('falsewake');
  // The false awakening only works with dream on both sides of it: never first, never last.
  if (fw === 0) [ids[0], ids[1]] = [ids[1], ids[0]];
  else if (fw === n - 1) [ids[n - 1], ids[n - 2]] = [ids[n - 2], ids[n - 1]];
  let at = DREAM_INTRO;
  return ids.slice(0, n).map((id, i) => {
    const def = DREAM_BY_ID[id],
      p = { id, def, start: at, dur: durs[i], v: def.setup ? def.setup() : {} };
    at += durs[i];
    return p;
  });
}

// What is on screen at dream time T: the intro, a vignette, or the wake-up.
function dreamSegmentAt(T) {
  if (T >= dream.wakeAt) return { kind: 'wake', start: dream.wakeAt, local: T - dream.wakeAt, p: null };
  if (T < DREAM_INTRO) return { kind: 'intro', start: 0, local: T, p: null };
  for (const p of dream.plan) if (T < p.start + p.dur) return { kind: 'vignette', start: p.start, local: T - p.start, p };
  return { kind: 'wake', start: dream.wakeAt, local: T - dream.wakeAt, p: null };
}

// Saturation: the room drains as she drifts off, each vignette blooms from grey into crayon, and the
// room comes back in full color when she wakes.
function dreamSat(seg) {
  if (seg.kind === 'intro') return 1 - 0.65 * dreamEase(seg.local / DREAM_INTRO);
  if (seg.kind === 'wake') return 0.4 + 0.6 * dreamEase(seg.local / 0.9);
  const d = seg.p.dur;
  if (typeof seg.p.def.sat === 'function') return seg.p.def.sat(seg.local, d);
  return 0.18 + 0.82 * dreamSpan(d * 0.1, d * 0.5, seg.local);
}

// How seasick the frame is: none at the start, full in the dream, settling as she wakes.
function dreamWobble(T) {
  const into = dreamEase(T / DREAM_INTRO),
    out = T >= dream.wakeAt ? 1 - dreamEase((T - dream.wakeAt) / 0.9) : 1,
    seg = dreamSegmentAt(T),
    calm = seg.p && typeof seg.p.def.calm === 'function' ? clamp(seg.p.def.calm(seg.local), 0, 1) : 0;
  return Math.min(into, out) * (1 - calm);
}

// How much of the frame the dream covers: it fades in over the room and back out to it at the end.
function dreamCover(T) {
  const end = dream.wakeAt + dream.wakeLen;
  return Math.min(dreamEase(T / (DREAM_INTRO * 0.6)), clamp((end - T) / DREAM_OUT, 0, 1));
}

// ---- Update ----

function dreamActive() {
  return dream.active;
}

function dreamTitleUp() {
  return typeof titleUp !== 'undefined' && !!titleUp;
}

// Paused, or a dialog over the ward: the dream holds still and lets the dialog have the input.
function dreamHeld() {
  return !!state.paused || (typeof isModal === 'function' && isModal());
}

// Every condition for drifting off, checked each step. Any movement or input restarts the clock.
function dreamCanDrift() {
  const moved = player.x !== dream.px || player.y !== dream.py;
  dream.px = player.x;
  dream.py = player.y;
  if (reduced || !state.started || state.paused || state.room !== DREAM_ROOM || mini.open || dreamTitleUp()) return false;
  if (typeof isModal === 'function' && isModal()) return false;
  if (deadDelay > 0 || enemies.some(e => e && e.hp > 0)) return false;
  if (typeof encounter === 'object' && encounter && encounter.room === DREAM_ROOM && !encounter.complete) return false;
  if (moved || keys.size > 0 || heldAttack || joy.x || joy.y) return false;
  if (typeof wardTouches === 'object' && wardTouches && wardTouches.size > 0) return false;
  return !(player.moving || player.attack > 0 || player.dash > 0 || player.z > 0 || player.eat > 0 || player.vomit > 0);
}

function dreamBegin() {
  const plan = dreamPlan(),
    tail = plan[plan.length - 1];
  dream.plan = plan;
  dream.last = plan.map(p => p.id);
  dream.active = true;
  dream.waking = false;
  dream.t = 0;
  dream.idle = 0;
  dream.wakeAt = tail ? tail.start + tail.dur : DREAM_INTRO;
  dream.wakeLen = DREAM_WAKE;
  dream.nurse = pick(DREAM_NURSE_LINES);
  dream.ps = pick(DREAM_ANALYSIS_PS);
  dream.blipKey = '';
  dream.blips = 0;
  dream.count++;
  sfx('dreamIn');
  music('dream');
}

// QA and tests: drift off right now. Room 5 only, never on the title or under reduced motion.
function dreamStart() {
  if (reduced || dream.active || state.room !== DREAM_ROOM || dreamTitleUp()) return false;
  dreamBegin();
  return true;
}

// The wake-up beat begins: the nurse's line, and one more dream on the books.
function dreamWakeUp(early) {
  if (dream.waking) return;
  dream.waking = true;
  if (early) {
    dream.wakeAt = dream.t;
    dream.wakeLen = DREAM_WAKE_EARLY;
  }
  state.stats ||= {};
  state.stats.dreams = (Number(state.stats.dreams) || 0) + 1;
}

// Any input. During a dream: wake her up (true); a second press once the nurse has spoken skips to the
// fade. Otherwise it only restarts the idle clock.
function dreamWake() {
  if (!dream.active) {
    dream.idle = 0;
    return false;
  }
  if (!dream.waking) {
    dreamWakeUp(true);
    return true;
  }
  const soon = dream.t + DREAM_OUT * 0.5;
  if (dream.t - dream.wakeAt > 0.6 && dream.wakeAt + dream.wakeLen > soon) dream.wakeLen = soon - dream.wakeAt;
  return true;
}

function dreamFinish() {
  dream.active = false;
  dream.waking = false;
  dream.idle = 0;
  music('room:' + DREAM_ROOM);
  sfx('dreamOut');
}

// Out of the room or into an arcade mid-dream: stop quietly. Whatever moved her chose the music.
function dreamStop() {
  if (!dream.active) return;
  dream.active = false;
  dream.waking = false;
  dream.idle = 0;
  if (typeof audio === 'object' && audio && audio.track === 'dream' && !mini.open) music('room:' + state.room);
}

// Syllable blips while a line types: Dad, Barb, a whispering ram, and the nurse.
function dreamVoices() {
  const seg = dreamSegmentAt(dream.t);
  let voice = '',
    typed = 0,
    vol = 0.6;
  if (seg.kind === 'wake') {
    voice = 'nurse';
    typed = dreamTyped(seg.local, 0.35, DREAM_NURSE_CPS, dream.nurse.length);
  } else if (seg.p && seg.p.def.voice) {
    voice = seg.p.def.voice;
    typed = seg.p.def.typed(seg.local, seg.p.v, seg.p.dur);
    vol = seg.p.def.voiceVol || vol;
  }
  const key = seg.kind + ':' + seg.start;
  if (key !== dream.blipKey) {
    dream.blipKey = key;
    dream.blips = 0;
  }
  const n = Math.floor(typed / 3);
  if (voice && n > dream.blips) {
    dream.blips = n;
    sfx('talk', { voice, count: n, vol });
  }
}

// Every simulation step, before the ward. True while a dream is on (the ward skips its update).
function updateDream(dt) {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  if (!dream.active) {
    if (dreamCanDrift()) {
      dream.idle += step;
      if (dream.idle >= DREAM_IDLE) dreamBegin();
    } else dream.idle = 0;
    return dream.active;
  }
  if (reduced || state.room !== DREAM_ROOM || mini.open || !state.started || dreamTitleUp()) {
    dreamStop();
    return false;
  }
  if (dreamHeld()) return true;
  dream.t += step;
  if (!dream.waking && dream.t >= dream.wakeAt) dreamWakeUp(false);
  dreamVoices();
  if (dream.waking && dream.t >= dream.wakeAt + dream.wakeLen) {
    dreamFinish();
    return false;
  }
  return true;
}

// ---- Drawing ----

// Text size multiplier, so the words stay readable on a phone-sized canvas.
function dreamUiScale(W, k) {
  let css = 1;
  try {
    const r = canvas.getBoundingClientRect();
    if (r && r.width > 0) css = r.width / Math.max(1, W);
  } catch {
    css = 1;
  }
  return clamp(1 / Math.max(0.2, k * css), 1, 1.8);
}

// One segment on the stage. During a crossfade the outgoing one swirls away, growing, while the
// incoming one turns into place.
function dreamLayer(g, seg, w, h, sw, f, incoming) {
  const ox = (w - sw) / 2,
    oy = (h - 625) / 2;
  g.save();
  if (f < 1) {
    g.translate(w / 2, h / 2);
    if (incoming) {
      g.globalAlpha = dreamAlpha(g) * f;
      g.rotate(-(1 - f) * 0.16);
      g.scale(0.84 + 0.16 * f, 0.84 + 0.16 * f);
    } else {
      g.rotate(f * 0.2);
      g.scale(1 + f * 0.22, 1 + f * 0.22);
    }
    g.translate(-w / 2, -h / 2);
  }
  g.translate(ox, oy);
  const full = { x: -ox, y: -oy, w, h };
  if (seg.kind === 'vignette') seg.p.def.draw(g, sw, seg.local, seg.p.v, seg.p.dur, full);
  else dreamBedside(g, sw, seg.local, full, seg.kind === 'wake');
  g.restore();
}

// The dream frame at full strength into g (vw × vh): the current segment, the crossfade from the last
// one, and the slow wobble. Returns the saturation and the wave strength for drawDream to apply.
function dreamPaint(g, vw, vh) {
  const k = Math.min(vw / 600, vh / 625) * DREAM_INSET,
    w = vw / k,
    h = vh / k,
    sw = clamp(w, 600, 1000),
    T = dream.t,
    seg = dreamSegmentAt(T),
    prev = seg.start > 0 ? dreamSegmentAt(seg.start - 1e-6) : null,
    f = prev ? dreamEase(seg.local / DREAM_FADE) : 1,
    wob = dreamWobble(T),
    zoom = 1 + (0.035 + Math.sin(T * 0.33) * 0.012) * wob;
  dreamView.sw = sw;
  dreamView.w = w;
  dreamView.h = h;
  dreamView.ui = dreamUiScale(vw, k);
  g.save();
  rect(g, 0, 0, vw, vh, '#16152c');
  g.scale(k, k);
  g.translate(w / 2, h / 2);
  g.rotate(Math.sin(T * 0.41) * 0.022 * wob);
  g.scale(zoom, zoom);
  g.translate(-w / 2, -h / 2);
  if (prev && f < 1) {
    dreamLayer(g, prev, w, h, sw, f, false);
    dreamLayer(g, seg, w, h, sw, f, true);
  } else dreamLayer(g, seg, w, h, sw, 1, true);
  g.restore();
  return { sat: prev && f < 1 ? dreamLerp(dreamSat(prev), dreamSat(seg), f) : dreamSat(seg), wave: wob };
}

// Pull the color out with a grey 'saturation' blend: at sat 0 the frame is pencil grey.
function dreamDesaturate(g, W, H, sat) {
  if (sat >= 0.99) return;
  g.save();
  g.globalCompositeOperation = 'saturation';
  g.globalAlpha = clamp(1 - sat, 0, 1);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, W, H);
  g.restore();
}

// The offscreen frame, sized like the ward canvas.
function dreamCanvas(W, H) {
  if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return null;
  const dpr = typeof viewport === 'object' && viewport && viewport.dpr > 0 ? viewport.dpr : 1,
    key = `${W}x${H}x${dpr}`;
  if (!dreamCv || dreamCvKey !== key) {
    const cv = dreamCv || document.createElement('canvas');
    if (!cv || typeof cv.getContext !== 'function') return null;
    if (typeof configureCanvas === 'function') configureCanvas(cv, W, H);
    else {
      cv.width = Math.ceil(W * dpr);
      cv.height = Math.ceil(H * dpr);
      const cx = cv.getContext('2d');
      if (cx && typeof cx.setTransform === 'function') cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    dreamCv = cv;
    dreamCvKey = key;
  }
  const ctx = dreamCv.getContext('2d');
  return ctx ? { cv: dreamCv, ctx } : null;
}

// Copy the frame across in thin bands, each nudged sideways on a slow sine: the heat-haze sway.
function dreamStrips(g, cv, W, H, amp, T) {
  const r = cv && cv.width > 0 ? cv.width / W : 0;
  if (!(r > 0)) return;
  if (amp < 0.3) {
    g.drawImage(cv, 0, 0, W, H);
    return;
  }
  const band = 10;
  for (let y = 0; y < H; y += band) {
    const sh = Math.min(band + 1, H - y),
      dx = Math.sin(y * 0.024 + T * 1.6) * amp;
    g.drawImage(cv, 0, y * r, W * r, sh * r, dx, y, W, sh);
  }
}

// The woozy border: a dusk-purple frame with a wavy inner edge, a soft glow, and z's drifting up.
function dreamBorder(g, W, H, a, T) {
  if (a <= 0.01) return;
  const m = Math.min(W, H),
    edge = m * 0.06,
    cx = W / 2,
    cy = H / 2,
    ax = W / 2 - edge,
    ay = H / 2 - edge,
    pts = [];
  for (let i = 0; i < 72; i++) {
    const th = (i / 72) * Math.PI * 2,
      c = Math.cos(th),
      s = Math.sin(th),
      x = Math.sign(c) * Math.pow(Math.abs(c), 0.32) * ax,
      y = Math.sign(s) * Math.pow(Math.abs(s), 0.32) * ay,
      len = Math.hypot(x, y) || 1,
      wave = (Math.sin(th * 9 + T * 1.3) * 0.22 + Math.sin(th * 4 - T * 0.8) * 0.16) * edge;
    pts.push([cx + x + (x / len) * wave, cy + y + (y / len) * wave]);
  }
  g.save();
  g.globalAlpha = a;
  const shade = g.createRadialGradient(cx, cy, m * 0.3, cx, cy, Math.hypot(W, H) * 0.55);
  shade.addColorStop(0, 'rgba(20,16,48,0)');
  shade.addColorStop(1, 'rgba(20,16,48,0.55)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  g.beginPath();
  g.rect(-4, -4, W + 8, H + 8);
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  g.fillStyle = '#1b1640';
  g.fill('evenodd');
  dreamPoly(g, pts);
  g.strokeStyle = '#b9a6ff';
  g.lineWidth = 7;
  g.globalAlpha = a * 0.3;
  g.stroke();
  g.strokeStyle = '#efe6ff';
  g.lineWidth = 2;
  g.globalAlpha = a * 0.7;
  g.stroke();
  g.fillStyle = '#e9e0ff';
  g.textAlign = 'center';
  for (let i = 0; i < 6; i++) {
    const k = (T * 0.18 + i / 6) % 1,
      side = i % 2 ? 1 : -1,
      x = cx + side * (W / 2 - edge * 0.5) + Math.sin(T + i) * 4,
      y = H - k * H;
    g.globalAlpha = a * Math.sin(k * Math.PI) * 0.8;
    g.font = dreamFont(14 + (i % 3) * 5, true);
    g.fillText(i % 3 ? 'z' : 'Z', x, y);
  }
  g.restore();
}

// After drawWorld, while a dream is on: the whole frame.
function drawDream(g, vw, vh) {
  if (!dream.active || !g) return;
  const W = Number.isFinite(vw) && vw > 0 ? vw : 1000,
    H = Number.isFinite(vh) && vh > 0 ? vh : 625,
    T = dream.t,
    cover = dreamCover(T),
    off = dreamCanvas(W, H);
  let look;
  g.save();
  if (off) {
    off.ctx.save();
    look = dreamPaint(off.ctx, W, H);
    dreamDesaturate(off.ctx, W, H, look.sat);
    off.ctx.restore();
    g.globalAlpha = cover;
    dreamStrips(g, off.cv, W, H, look.wave * 4.5, T);
  } else {
    g.globalAlpha = cover;
    look = dreamPaint(g, W, H);
    dreamDesaturate(g, W, H, look.sat);
  }
  g.restore();
  dreamBorder(g, W, H, cover * look.wave, T);
  if (state.paused) rect(g, 0, 0, W, H, '#102734aa');
}

// ---- Input ----
// Capture phase on document, ahead of every other listener: during a dream, a key or a press wakes
// Macy and goes no further. The click that follows a swallowed press is swallowed too. Browser
// shortcuts and lone modifier keys pass. Outside a dream, any key or press restarts the idle clock.
function dreamSwallow(e) {
  if (typeof e.preventDefault === 'function' && e.cancelable !== false) e.preventDefault();
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  else if (typeof e.stopPropagation === 'function') e.stopPropagation();
  // audio.js unlocks on this same gesture from a later listener; do it here instead.
  if (typeof audio === 'object' && audio && typeof audio.unlock === 'function') audio.unlock();
}

function dreamOnInput(e) {
  if (!e || typeof e !== 'object') return false;
  const type = e.type,
    live = dream.active && !dreamHeld();
  if (type === 'click') {
    if (!dreamClickDebt && !live) return false;
    dreamClickDebt = false;
    dreamSwallow(e);
    return true;
  }
  if (type === 'pointerdown') dreamClickDebt = false;
  if (!live) {
    dream.idle = 0;
    return false;
  }
  if (type === 'keydown') {
    const k = String(e.key || '').toLowerCase();
    if (e.metaKey || e.ctrlKey || e.altKey || DREAM_PASS_KEYS.includes(k)) return false;
  }
  dreamSwallow(e);
  if (type === 'pointerdown') dreamClickDebt = true;
  if (!e.repeat) dreamWake();
  return true;
}

if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function')
  for (const type of ['keydown', 'pointerdown', 'click']) document.addEventListener(type, dreamOnInput, true);
