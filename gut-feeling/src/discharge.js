// The send-off. Once Macy is discharged (state.won), the hallway exit plays this every time she uses it:
// thirteen beats, about three minutes, each with its own staging, sound and line of copy, then a final
// card with a Share button, and back to the hallway at the exit with a toast.
//
// Hooks (world.js and hallway.js guard every call; nothing here guards them):
//   dischargeStart()               the hallway exit, once state.won. True when the send-off starts.
//   updateDischarge(dt)            every ward step. True while the send-off owns the frame.
//   dischargeActive()              true from dischargeStart() until the fade back to the hallway ends.
//   drawDischarge(g, vw, vh)       after the room, in screen space (vw × vh, the ward viewport).
//   dischargeAction(kind, point)   every ward action. 'attack', 'enter', 'jump', 'dash', 'use' and 'tap'
//                                  (point in room coordinates) advance one beat; 'escape', 'skip' and
//                                  'hold' skip to the final card. True swallows it.
// Capture-phase listeners on document do the same for the keyboard and for presses on the ward canvas
// (mouse, pen or finger): Space, Enter or a tap moves on a beat, Escape or a long press skips to the final
// card, and S on the card shares it. A paused ward or an open dialog holds the send-off still and gets its
// input as usual.
//
// It never traps: every beat moves on by itself, a skip always lands on the final card, and the card ends
// by itself too. Under prefers-reduced-motion the holds are shorter, nothing shakes, lines appear whole and
// the confetti is sparse. Randomness comes from rand() and pick() in the update; drawing never draws it.
// Every global here starts with discharge or DISCHARGE (plus the hook names updateDischarge, drawDischarge).
//
// Reads: state.name, state.jersey, state.medals, state.evictions, state.wardClears, state.ralph, state.runs,
// state.coinsEarned, state.bestChain, state.stickers, state.cards and state.stats (dadJokes, ensureRefused,
// recovered, combos, dreams, catCam, days). Writes one counter: state.stats.sendoffs.

const DISCHARGE_IN = 0.9,
  DISCHARGE_OUT = 0.8,
  DISCHARGE_DIP = 0.32,
  DISCHARGE_LONG = 0.55,
  DISCHARGE_REDUCED = 0.7,
  DISCHARGE_CPS = 36,
  DISCHARGE_GAP = 0.22,
  DISCHARGE_MAX_FX = 220,
  DISCHARGE_FONT = '"Trebuchet MS", Arial, sans-serif',
  DISCHARGE_HAND = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
  DISCHARGE_PASS_KEYS = ['tab', 'shift', 'control', 'alt', 'meta', 'capslock', 'contextmenu', 'f5', 'f11', 'f12'],
  DISCHARGE_TOAST = 'Discharged. Again. The nurses are starting to suspect something.',
  DISCHARGE_SHARE_NAME = 'gut-feeling-discharged.png';

const DISCHARGE_COL = {
  ink: '#1d2d38',
  paper: '#fbf4e2',
  cream: '#fffaf0',
  coral: '#ffa48e',
  mint: '#b5e8c5',
  gold: '#ffda79',
  red: '#d4473f',
  pen: '#2457b8',
  muted: '#a8bdbe',
  shade: '#0b1820'
};

const DISCHARGE_CONFETTI = ['#ffda79', '#b5e8c5', '#ffa48e', '#7fb6f0', '#f3a6b8', '#fffaf0', '#1f67cb', '#f2c43f'],
  DISCHARGE_BALLOONS = ['#1f67cb', '#f2c43f', '#ef8f89', '#7fcbd6', '#b49acb', '#9fd38a'];

// ---- Who says what ----
// [name, voice id for sfx('talk'), pitch offset, name-tag colour]. {name} is Macy's name.
const DISCHARGE_WHO = {
  dad: ['Dad', 'dad', 0, '#f3d38b'],
  brother: ['Riley', 'brother', 0, '#f2bf8f'],
  mimi: ['Mimi', 'grandma', 0, '#ddc8ec'],
  dodo: ['Dodo', 'grandpa', 0, '#cfe0b4'],
  presley: ['Presley', 'cousin', 3, '#f6dd8c'],
  norah: ['Norah', 'cousin', 1, '#a9c6ef'],
  taylor: ['Taylor', 'cousin', -2, '#c9b8ef'],
  casey: ['Casey', 'cousin', -4, '#bfe0cf'],
  julez: ['Julez', 'nurse', -2, '#9fb6d6'],
  stephanie: ['Nurse Stephanie', 'nurse', 2, '#f5b9ae'],
  lori: ['Dr. Lori', 'doctor', 2, '#e4d4ee'],
  benedetto: ['Dr. Benedetto', 'doctor', -4, '#cfe3ee'],
  barb: ['Barb · Dietary', 'ensure', 0, '#f7c6d2'],
  rowdy: ['Rowdy the Ram', 'rowdy', 0, '#f2cf6b'],
  macy: ['{name}', 'macy', 0, '#a5e2c9'],
  friends: ['Presley, Norah & Taylor', 'cousin', 1, '#f6dd8c'],
  desk: ['The front desk', 'nurse', 4, '#f3a6b8'],
  ralph: ['Ralph', '', 0, '#cdb3f0']
};

// The ward's machines, one last opinion each: [id, name, line, sound, short label].
const DISCHARGE_MACHINES = [
  ['mri', 'BRRR 3000, the MRI', "GO. GO! I'M NOT CRYING. IT'S THE COOLANT.", 'stun', 'MRI'],
  ['ct', 'Donut II, the CT scanner', 'No brakes. No goodbyes. Fine. One goodbye.', 'dash', 'CT'],
  ['cuff', 'The blood pressure cuff', 'One last squeeze. For the road, champ.', 'pump', 'CUFF'],
  ['ultrasound', 'The ultrasound machine', "I saw this coming. Literally. It's my whole job.", 'squelch', 'ULTRASOUND'],
  ['vending', 'The vending machine', "Pretzels on the house. Don't tell the house.", 'coin', 'VENDING'],
  ['pump', 'The IV pump', 'And so she leaves the nest. Majestic. Hush now.', 'drip', 'IV PUMP'],
  ['monitor', 'Monitor 88', "88! 88! Can I come? I'll beep quietly!", 'select', 'MONITOR 88'],
  ['bed', 'The bed', 'Zzz... take the good pillow... zzz...', 'jump', 'THE BED'],
  ['etype', 'The E-Type', 'Vroom. See you downstairs. Bigger.', 'leap', 'E-TYPE']
];
const DISCHARGE_MACHINE_AT = 0.9,
  DISCHARGE_MACHINE_GAP = 2;

const DISCHARGE_CRAWL = [
  'WELCOME HOME, {NAME}',
  'ADDIE HAS BEEN BRIEFED',
  'STELLA IS PRETENDING NOT TO CARE',
  'PEPPER ATE A HAIR TIE TO CELEBRATE',
  'YOUR SPOT ON THE COUCH IS STILL WARM',
  'RILEY DID NOT GET YOUR ROOM'
];

// The corridor: everyone lined up along the seventh floor, [id, x, y] in hallway coordinates. The back
// row stands by the wall, the front row by the windows side; the chair rolls down the middle.
const DISCHARGE_LINEUP = [
  ['lori', 850, 258],
  ['benedetto', 985, 452],
  ['julez', 1160, 258],
  ['mimi', 1330, 262],
  ['dodo', 1405, 452],
  ['casey', 1640, 260],
  ['presley', 1836, 258],
  ['norah', 1972, 262],
  ['taylor', 1905, 456],
  ['brother', 2300, 258],
  ['dad', 2620, 452],
  ['barb', 2880, 258]
];
const DISCHARGE_FRIENDS = ['presley', 'norah', 'taylor'];

// The chair's ride, [time, x, y] keyframes per corridor beat: out of Room 5, down the hall, out the EXIT.
const DISCHARGE_RIDE = {
  hall1: [
    [0, 600, 232],
    [2.4, 700, 360],
    [17, 1495, 360]
  ],
  hall2: [
    [0, 1495, 360],
    [18.5, 2460, 360]
  ],
  hall3: [
    [0, 2460, 360],
    [7, 2720, 360],
    [11.5, 2905, 356],
    [13.6, 3030, 300],
    [16, 3100, 212]
  ]
};

// ---- State ----
let discharge = {
  active: false,
  beat: 0,
  t: 0,
  T: 0,
  clock: 0,
  out: -1,
  scale: 1,
  room: 6,
  plays: 0,
  numbers: [],
  cues: [],
  date: '',
  fx: [],
  spawn: 0,
  shake: 0,
  press: null,
  lastAdvance: -9,
  blipKey: '',
  blips: 0,
  pushLook: null,
  lobby: null,
  input: '',
  shareRect: null,
  shareCv: null,
  shareBlob: null,
  shareSaid: null,
  errors: 0,
  lastError: ''
};
let dischargeClickDebt = false;

// ---- Small helpers ----
const dischargeName = () => (typeof state.name === 'string' && state.name.trim()) || 'Macy',
  dischargeNum = () => (Number.isInteger(state.jersey) ? state.jersey : 22),
  dischargeFill = text =>
    String(text)
      .replace(/\{name\}/g, dischargeName())
      .replace(/\{NAME\}/g, dischargeName().toUpperCase())
      .replace(/\{num\}/g, String(dischargeNum())),
  dischargeLerp = (a, b, f) => a + (b - a) * f,
  dischargeCount = v => Math.max(0, Math.floor(Number(v) || 0));

function dischargeEase(x) {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
}

// 0 before a, 1 after b, smooth in between.
function dischargeSpan(t, a, b) {
  if (!(b > a)) return t >= b ? 1 : 0;
  return dischargeEase((t - a) / (b - a));
}

// A pop with a little overshoot: 0 at 0, past 1 near the end, 1 at 1.
function dischargePop(x) {
  const k = clamp(x, 0, 1);
  return 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
}

function dischargeAlpha(g) {
  const a = g.globalAlpha;
  return typeof a === 'number' && Number.isFinite(a) ? clamp(a, 0, 1) : 1;
}

function dischargeFont(size, weight = 700, hand = false) {
  return `${weight} ${Math.max(1, Math.round(size * 10) / 10)}px ${hand ? DISCHARGE_HAND : DISCHARGE_FONT}`;
}

function dischargeTextW(g, text, size, weight = 700, hand = false) {
  g.font = dischargeFont(size, weight, hand);
  const m = typeof g.measureText === 'function' ? g.measureText(String(text)) : null;
  return m && Number.isFinite(m.width) ? m.width : String(text).length * size * 0.56;
}

function dischargeWrap(g, text, width, size, weight = 700, hand = false) {
  const rows = [];
  let row = '';
  for (const word of String(text).split(' ')) {
    const next = row ? row + ' ' + word : word;
    if (row && dischargeTextW(g, next, size, weight, hand) > width) {
      rows.push(row);
      row = word;
    } else row = next;
  }
  if (row) rows.push(row);
  return rows.length ? rows : [''];
}

function dischargeText(g, text, x, y, size, color, align = 'center', weight = 700, hand = false) {
  g.font = dischargeFont(size, weight, hand);
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(String(text), x, y);
}

// The largest size, down to min, that keeps text inside maxW.
function dischargeFitSize(g, text, maxW, size, min, weight = 700, hand = false) {
  let s = size;
  for (let i = 0; i < 30 && s > min && dischargeTextW(g, text, s, weight, hand) > maxW; i++) s *= 0.93;
  return Math.max(min, s);
}

function dischargeVertical(g, W, H, a, b) {
  g.fillStyle = gradient(g, 0, 0, 0, H, a, b);
  g.fillRect(0, 0, W, H);
}

// Where a keyframed path is at time T (linear between keys).
function dischargePath(keys, T) {
  if (T <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1],
      b = keys[i];
    if (T <= b[0]) {
      const f = (T - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return { x: dischargeLerp(a[1], b[1], f), y: dischargeLerp(a[2], b[2], f) };
    }
  }
  const z = keys[keys.length - 1];
  return { x: z[1], y: z[2] };
}

function dischargeError(err) {
  discharge.errors++;
  discharge.lastError = String((err && err.stack) || err);
}

// ---- Her numbers ----
// A snapshot taken when the send-off starts: the discharge summary rolls these up like credits.
function dischargeNumbers() {
  const st = state,
    stats = (st.stats && typeof st.stats === 'object' && st.stats) || {},
    flat = Array.isArray(st.medals) ? st.medals.slice(0, ARCADE_COUNT).flat() : [],
    golds = flat.filter(m => m === 3).length,
    medals = flat.filter(m => m > 0).length,
    starCount = typeof stars === 'function' ? stars() : flat.reduce((a, b) => a + (Number(b) || 0), 0),
    need = typeof DISCHARGE_STARS === 'number' ? DISCHARGE_STARS : 21,
    total = typeof STICKERS !== 'undefined' && Array.isArray(STICKERS) ? STICKERS.length : 0,
    clears = Array.isArray(st.wardClears) ? st.wardClears.reduce((a, b) => a + dischargeCount(b), 0) : 0,
    stat = k => dischargeCount(stats[k]),
    rows = [
      {
        label: 'DISCHARGE STARS',
        value: starCount,
        note: starCount > need ? `${starCount - need} more than anyone asked for` : 'Exactly enough. Efficient.'
      },
      { label: 'MEDALS', value: medals, note: golds ? `${golds} of them gold. The fridge is full.` : 'The fridge has been notified.' },
      { label: 'GREMLINS EVICTED', value: dischargeCount(st.evictions), note: 'No forwarding addresses.' },
      { label: 'WARD CLEARS', value: clears, note: 'Radiology sends its thanks.' }
    ];
  if (st.ralph) rows.push({ label: 'RALPH', text: 'EVICTED', note: 'One-star review on file.' });
  rows.push(
    { label: 'ARCADE RUNS', value: dischargeCount(st.runs), note: 'The claw machine is jealous.' },
    { label: 'COINS EARNED', value: dischargeCount(st.coinsEarned), note: 'The gift shop will miss you.' },
    {
      label: 'STICKERS',
      value: Array.isArray(st.stickers) ? st.stickers.length : 0,
      suffix: total ? ` / ${total}` : '',
      note: 'None of them medical.'
    },
    { label: 'GET-WELL CARDS', value: Array.isArray(st.cards) ? st.cards.length : 0, note: 'The wall is full. The wall is proud.' },
    {
      label: 'DAD JOKES SURVIVED',
      value: stat('dadJokes'),
      note: stat('dadJokes') ? 'He has more. He always has more.' : 'He is saving them for the car.'
    },
    { label: 'ENSURES REFUSED', value: stat('ensureRefused'), note: 'Barb remains undefeated in spirit.' }
  );
  const extra = [
    { label: 'IV RECOVERIES', value: stat('recovered'), note: 'Back on your feet every time.' },
    { label: 'COMBO SLAMS', value: stat('combos'), note: 'The pillow remembers.' },
    { label: 'LONGEST CHAIN', value: dischargeCount(st.bestChain), note: 'Unbroken. Like your spirit.' },
    { label: 'WEIRD DREAMS', value: stat('dreams'), note: 'You were saying MINE.' },
    { label: 'CAT CAM CHECKS', value: stat('catCam'), note: 'Pepper knows.' }
  ].filter(r => r.value > 0);
  rows.push(...extra.slice(0, 3));
  rows.push({ label: 'DAYS ON THE SEVENTH FLOOR', value: Math.max(1, stat('days')), note: 'Every one of them brave.' });
  if (stat('sendoffs') > 1) rows.push({ label: 'TIMES DISCHARGED', value: stat('sendoffs'), note: 'The nurses are keeping count.' });
  return rows;
}

// Reveal times for the summary: the header, each row, the footer.
function dischargeNumberTimes(n, D) {
  const gap = (D - 4.8) / Math.max(1, n),
    times = [0.5];
  for (let i = 0; i < n; i++) times.push(1.4 + i * gap);
  times.push(1.4 + n * gap + 0.3);
  return times;
}

function dischargeDate() {
  try {
    if (typeof shareDateLabel === 'function') return shareDateLabel();
    return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  } catch {
    return 'TODAY';
  }
}

// ---- The cast ----
function dischargeNpc(id) {
  return typeof hallwayCast !== 'undefined' && Array.isArray(hallwayCast) ? hallwayCast.find(n => n && n.id === id) || null : null;
}

const dischargeUnit = () => (typeof MACY_SCALE === 'number' && MACY_SCALE > 0 ? MACY_SCALE : 1.36),
  dischargeNpcScale = () => (typeof hallwayNpcScale === 'function' ? hallwayNpcScale() : dischargeUnit());

// Nurse Stephanie pushes the chair, so her tablet goes in a pocket (an empty hand reaches forward).
function dischargeLook(id) {
  const npc = dischargeNpc(id);
  if (!npc || !npc.look) return null;
  if (id === 'stephanie') return (discharge.pushLook ||= { ...npc.look, item: 'push' });
  return npc.look;
}

function dischargeRowdyScale() {
  const npc = dischargeNpc('rowdy');
  return npc && npc.scale > 0 ? npc.scale : (1.075 * 88 * dischargeUnit()) / 86;
}

// Drawn height in world units at mult 1, feet to the top of the hair (or the horns).
function dischargeHeight(id) {
  if (id === 'rowdy') return 86 * dischargeRowdyScale();
  if (id === 'macy') return 92 * dischargeUnit();
  const look = dischargeLook(id);
  return look && typeof npcTop === 'function' ? npcTop(look) * dischargeNpcScale() : 120;
}

// One of the hallway cast, feet at (x, y). o: dir, walk (stride phase), t, hop (look units), speak, s
// (a size multiplier), and for Rowdy pose and prop.
function dischargePerson(g, id, x, y, o = {}) {
  const t = o.t || 0,
    mult = o.s || 1;
  if (id === 'rowdy') {
    if (typeof drawRowdy !== 'function') return;
    const sc = dischargeRowdyScale() * mult;
    drawRowdy(g, x, y - (o.hop || 0) * sc, sc, o.pose || 'cheer', t, { face: o.dir < 0 ? -1 : 1, prop: o.prop, shadow: o.shadow });
    return;
  }
  if (typeof npcFigure !== 'function') return;
  const look = o.look || dischargeLook(id);
  if (!look) return;
  npcFigure(g, x, y, dischargeNpcScale() * mult, look, o.walk || 0, o.dir || 1, t, {
    hop: o.hop || 0,
    speak: !!o.speak,
    shadow: o.shadow
  });
}

// Macy on her feet, at scale s. o: walk, dir, act (a MACY_POSES pose), bottle, hop.
function dischargeMacy(g, x, y, s, o = {}) {
  if (typeof girl !== 'function') return;
  const dir = o.dir || 1;
  girl(g, x, y - (o.hop || 0) * s, s, o.walk || 0, dir, false, o.shadow !== false, o.act || null);
  if (o.bottle && typeof roomBottle === 'function') roomBottle(g, x + 18 * s * dir, y - 19 * s - (o.hop || 0) * s, 0, s * 0.55);
}

function dischargeWheel(g, cx, cy, r, a, rim, spoke, w) {
  path(g, p => p.arc(cx, cy, r, 0, Math.PI * 2), null, rim, 2.4 * w);
  path(g, p => p.arc(cx, cy, r * 0.78, 0, Math.PI * 2), null, spoke, 0.9 * w);
  for (let i = 0; i < 4; i++) {
    const ang = a + (i * Math.PI) / 4,
      dx = Math.cos(ang) * r * 0.92,
      dy = Math.sin(ang) * r * 0.92;
    line(g, [[cx - dx, cy - dy], [cx + dx, cy + dy]], spoke, 0.8 * w);
  }
  ellipse(g, cx, cy, 2.2 * w, 2.2 * w, rim);
}

// Macy in a wheelchair, facing right, wheels on the floor at (x, y), at scale s. o: roll (wheel angle),
// grip (the world point the push handle reaches back to), act, bottle, empty (just the chair).
function dischargeChair(g, x, y, s, t, o = {}) {
  const roll = o.roll || 0;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (o.shadow !== false) shadow(g, 4, 1, 27, 5);
  dischargeWheel(g, -1, -14, 13.5, roll + 0.3, '#3b5560', '#6f878e', 0.9);
  line(g, [[-13, -15], [13, -15]], '#3b5560', 2.2);
  rr(g, -14, -19, 30, 5, 2.5, '#2f6f8f', '#244f66', 0.8);
  line(g, [[-13, -17], [-16, -37]], '#2f5f7a', 3.2);
  rr(g, -19.5, -37, 6, 19, 2.5, '#3f7f9f');
  line(g, [[13, -16], [17, -6], [25, -6]], '#4f6872', 2.4);
  dischargeWheel(g, 19, -3.2, 3.2, roll * 4, '#3c596e', '#9fb2b6', 0.6);
  if (!o.empty) dischargeSeated(g, o);
  dischargeWheel(g, -4, -14, 14.5, roll, '#4f6872', '#c3d2d4', 1);
  const gx = o.grip ? (o.grip[0] - x) / s : -27,
    gy = o.grip ? (o.grip[1] - y) / s : -35;
  line(g, [[-16, -37], [gx, gy]], '#4f6872', 3);
  rr(g, gx - 3, gy - 2.4, 6, 4.8, 2, '#2c3b44');
  g.restore();
}

function dischargeSeated(g, o) {
  for (const [col, dx] of [
    ['#28394d', -2.5],
    ['#33475e', 1.5]
  ]) {
    line(g, [[1 + dx * 0.3, -19], [13 + dx, -19], [14.5 + dx, -7]], col, 7);
    line(g, [[14.5 + dx, -8], [14.5 + dx, -4.5]], '#f3bb99', 5);
    rr(g, 10 + dx, -5, 14, 6, 3, '#f6f3de', '#61777f', 0.8);
  }
  // Her upper body, sat down: girl() clipped at the hips, so the hoodie meets the seat.
  g.save();
  g.beginPath();
  g.rect(-44, -130, 90, 115);
  g.clip();
  if (typeof girl === 'function') girl(g, 0, 9, 1, 0, 1, false, false, o.act || null);
  g.restore();
  if (o.bottle && typeof roomBottle === 'function') roomBottle(g, 18, -14, 0, 0.62);
}

// Where Stephanie stands to push, and where her hand is: the chair's handle reaches back to it. m scales
// the whole group (the close-up scenes draw everyone bigger).
function dischargePusher(rx, ry, m = 1) {
  const s = dischargeUnit() * m,
    sN = dischargeNpcScale() * m,
    look = dischargeLook('stephanie'),
    reach = ((look ? look.shoulder : 12.4) + 2.5) * sN,
    x = rx - 27 * s - reach,
    y = ry - 3,
    hand = look ? -(look.leg + look.torso) + look.torso * 0.55 : -30;
  return { x, y, grip: [x + reach, y + hand * sN] };
}

// A purple gremlin of some standing, in a tiny neck brace. Feet at (x, y).
function dischargeRalph(g, x, y, s, t, salute) {
  const body = '#a27ad2',
    dark = '#5d3d8c',
    bob = reduced ? 0 : Math.sin(t * 2.4) * 1.4;
  g.save();
  g.translate(x, y + bob);
  g.scale(s, s);
  for (const side of [-1, 1])
    path(
      g,
      p => {
        p.moveTo(side * 16, -44);
        p.quadraticCurveTo(side * 30, -62, side * 37, -52);
        p.quadraticCurveTo(side * 33, -34, side * 17, -32);
      },
      body,
      dark,
      1.4
    );
  path(
    g,
    p => {
      p.moveTo(-24, -4);
      p.bezierCurveTo(-30, -48, -12, -58, 0, -55);
      p.bezierCurveTo(14, -58, 31, -46, 24, -4);
      p.quadraticCurveTo(0, 6, -24, -4);
    },
    gradient(g, -20, -56, 40, 56, body, dark),
    dark,
    1.5
  );
  ellipse(g, 0, -10, 14, 8, '#c5a6ee');
  for (const ex of [-9, 9]) {
    ellipse(g, ex, -40, 7, 7.5, '#fff9e8');
    ellipse(g, ex + 1, -39, 3, 4, '#2b2338');
    ellipse(g, ex, -41, 1, 1.3, '#ffffff');
  }
  line(g, [[-15, -49], [-4, -47]], dark, 2.6);
  line(g, [[4, -47], [15, -49]], dark, 2.6);
  path(
    g,
    p => {
      p.moveTo(-5, -31);
      p.quadraticCurveTo(0, -28.5, 5, -31);
    },
    null,
    '#3d2350',
    1.6
  );
  // The tiny neck brace: a padded collar wider than he is, chin resting on it, one velcro strap.
  ellipse(g, 0, -24.5, 17, 2.6, '#3d235033');
  rr(g, -31, -25, 62, 13, 6.5, '#f1eadb', '#a99d86', 1.4);
  rr(g, -29, -24, 58, 4, 2, '#fffaf0');
  rr(g, -31, -15, 62, 3, 1.5, '#d8cdb6');
  rr(g, 13, -24.5, 10, 12, 2, '#cfc5ad', '#a99d86', 0.8);
  line(g, [[-20, -14], [-28, -4]], dark, 5);
  ellipse(g, -28, -3, 4, 3.4, body);
  if (salute) {
    line(g, [[20, -14], [29, -30], [20, -46]], dark, 5);
    ellipse(g, 20, -47, 4.2, 3.2, body);
  } else {
    line(g, [[20, -14], [28, -4]], dark, 5);
    ellipse(g, 28, -3, 4, 3.4, body);
  }
  g.restore();
}

// A white flag, pole top at (x, y), the cloth streaming right.
function dischargeFlag(g, x, y, s, t) {
  const w = 26 * s,
    h = 17 * s,
    k = reduced ? 0.3 : 1,
    a = Math.sin(t * 7) * k,
    b = Math.sin(t * 7 + 1) * k;
  path(
    g,
    p => {
      p.moveTo(x, y);
      p.quadraticCurveTo(x + w * 0.5, y - 3 * s * a, x + w, y + 2 * s * b);
      p.lineTo(x + w, y + h + 2 * s * b);
      p.quadraticCurveTo(x + w * 0.5, y + h - 3 * s * a, x, y + h);
      p.closePath();
    },
    '#fbfbf4',
    '#c9c4b5',
    Math.max(0.5, s)
  );
}

function dischargeBalloon(g, x, y, r, col, t) {
  const sway = Math.sin(t * 1.3) * r * 0.15;
  path(
    g,
    p => {
      p.moveTo(x, y + r * 1.12);
      p.quadraticCurveTo(x - r * 0.4 + sway, y + r * 2, x + sway, y + r * 3.1);
    },
    null,
    '#e9e2d0aa',
    Math.max(0.6, r * 0.05)
  );
  ellipse(g, x, y, r * 0.86, r, col);
  ellipse(g, x - r * 0.3, y - r * 0.35, r * 0.18, r * 0.28, '#ffffff66');
  poly(
    g,
    [
      [x - r * 0.13, y + r * 1.02],
      [x + r * 0.13, y + r * 1.02],
      [x, y + r * 1.17]
    ],
    col
  );
}

// A stamp: a ruled box with a word in it, a little patchy, slammed down (pop 0 to 1).
function dischargeStamp(g, x, y, w, h, rot, text, col, pop) {
  const p = clamp(pop, 0, 1),
    sc = 1 + (1 - p) * 0.9;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(sc, sc);
  g.globalAlpha = dischargeAlpha(g) * (0.3 + 0.62 * p);
  rr(g, -w / 2, -h / 2, w, h, h * 0.14, null, col, h * 0.08);
  rr(g, -w / 2 + h * 0.13, -h / 2 + h * 0.13, w - h * 0.26, h * 0.74, h * 0.08, null, col, h * 0.03);
  dischargeText(g, text, 0, h * 0.2, dischargeFitSize(g, text, w * 0.84, h * 0.52, h * 0.2, 900), col, 'center', 900);
  for (let i = 0; i < 9; i++) ellipse(g, -w * 0.42 + (i * w * 0.84) / 8, ((i % 3) - 1) * h * 0.2, h * 0.04 + (i % 2), h * 0.022, '#fbf4e2bb');
  g.restore();
}

// ---- Speech bubbles ----
function dischargeWho(who) {
  const key = String(who);
  if (key.startsWith('machine:')) {
    const m = DISCHARGE_MACHINES.find(r => r[0] === key.slice(8));
    return { name: m ? m[1] : 'A machine', voice: '', pitch: 0, tag: '#cfe3ee' };
  }
  if (key.startsWith('gremlin')) return { name: 'A gremlin', voice: '', pitch: 0, tag: '#cfe8a8', fill: '#f3ffe6' };
  const row = DISCHARGE_WHO[key] || ['Someone', '', 0, '#f3d38b'];
  return { name: dischargeFill(row[0]), voice: row[1], pitch: row[2], tag: row[3], fill: key === 'friends' ? '#fff3c4' : '' };
}

// Lays out a bubble whose tail points at (ax, ay), above the speaker if there is room, beside if not.
function dischargeBubbleBox(g, L, text, ax, ay, o = {}) {
  const size = o.size || L.fs(L.portrait ? 17 : 16),
    lh = size * 1.24,
    pad = size * 0.62,
    maxW = Math.min(L.w - L.m * 2, Math.max(size * 9, Math.min(L.w * (L.portrait ? 0.82 : 0.42), size * 19))),
    rows = dischargeWrap(g, text, maxW - pad * 2, size, 700),
    tw = Math.max(size * 1.5, ...rows.map(r => dischargeTextW(g, r, size, 700))),
    tagSize = size * 0.6,
    tag = o.name ? String(o.name).toUpperCase() : '',
    tagW = tag ? dischargeTextW(g, tag, tagSize, 800) + tagSize * 1.5 : 0,
    w = Math.max(tw + pad * 2, tagW + pad * 1.2),
    h = rows.length * lh + pad * 1.25 + (tag ? tagSize * 0.5 : 0),
    minY = (o.minY ?? L.top) + (tag ? tagSize * 0.8 : 0),
    maxY = Math.max(minY, (o.maxY ?? L.bottom) - h);
  let x = ax - w / 2,
    y = ay - size * 0.8 - h,
    side = 0;
  if (o.below && ay + size * 0.8 + tagSize + h <= (o.maxY ?? L.bottom)) {
    // Hanging under the speaker's feet (a front-row speaker on a tall screen), tail pointing up.
    y = ay + size * 0.8 + tagSize;
    side = 2;
  } else if (y < minY) {
    side = ax < L.w / 2 ? 1 : -1;
    x = side > 0 ? ax + size * 1.2 : ax - size * 1.2 - w;
    y = clamp(ay - h * 0.25, minY, maxY);
  }
  x = clamp(x, L.m, Math.max(L.m, L.w - L.m - w));
  if (side !== 2) y = clamp(y, minY, maxY);
  return { x, y, w, h, rows, size, lh, pad, tag, tagSize, tagW, side, ax, ay, noTail: false };
}

function dischargeOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y - a.tagSize < b.y + b.h && b.y - b.tagSize < a.y + a.h;
}

function dischargeBubblePaint(g, L, b, o = {}) {
  const a = clamp(o.alpha ?? 1, 0, 1);
  if (a <= 0.01) return;
  const fill = o.fill || '#fffaf0',
    edge = '#29434d',
    ink = '#1d2d38',
    r = b.size * 0.55,
    lw = Math.max(1, b.size * 0.1);
  g.save();
  g.globalAlpha = dischargeAlpha(g) * a;
  const pop = clamp(o.pop ?? 1, 0, 1.3);
  if (pop < 0.999 || pop > 1.001) {
    const px = clamp(b.ax, b.x, b.x + b.w),
      py = clamp(b.ay, b.y, b.y + b.h);
    g.translate(px, py);
    g.scale(Math.max(0.01, pop), Math.max(0.01, pop));
    g.translate(-px, -py);
  }
  rr(g, b.x, b.y, b.w, b.h, r, fill, edge, lw);
  if (!b.noTail) {
    const half = b.size * 0.42;
    if (b.side === 2) {
      const cx = clamp(b.ax, Math.min(b.x + r * 1.6 + b.tagW, b.x + b.w - r * 1.6), b.x + b.w - r * 1.6),
        base = b.y + lw * 0.5,
        tip = [b.ax, Math.min(base - b.size * 0.4, b.ay + b.size * 0.15)];
      poly(g, [[cx - half, base], tip, [cx + half, base]], fill);
      line(g, [[cx - half, base], tip, [cx + half, base]], edge, lw);
      rect(g, cx - half + lw, base - lw * 0.4, half * 2 - lw * 2, lw * 1.6, fill);
    } else if (b.side === 0) {
      const cx = clamp(b.ax, b.x + r * 1.6, b.x + b.w - r * 1.6),
        base = b.y + b.h - lw * 0.5,
        tip = [b.ax, Math.max(base + b.size * 0.4, b.ay - b.size * 0.15)];
      poly(g, [[cx - half, base], tip, [cx + half, base]], fill);
      line(g, [[cx - half, base], tip, [cx + half, base]], edge, lw);
      rect(g, cx - half + lw, base - lw * 1.2, half * 2 - lw * 2, lw * 1.6, fill);
    } else {
      const ex = b.side > 0 ? b.x + lw * 0.5 : b.x + b.w - lw * 0.5,
        cy = clamp(b.ay, b.y + r * 1.5, b.y + b.h - r * 1.5),
        tip = [b.ax - b.side * b.size * 0.3, b.ay];
      poly(g, [[ex, cy - half], tip, [ex, cy + half]], fill);
      line(g, [[ex, cy - half], tip, [ex, cy + half]], edge, lw);
      rect(g, (b.side > 0 ? b.x : b.x + b.w) - lw * 0.7, cy - half + lw, lw * 1.4, half * 2 - lw * 2, fill);
    }
  }
  if (b.tag) {
    rr(g, b.x + b.pad * 0.5, b.y - b.tagSize * 0.75, b.tagW, b.tagSize * 1.5, b.tagSize * 0.75, o.tag || '#f3d38b', edge, 1);
    dischargeText(g, b.tag, b.x + b.pad * 0.5 + b.tagW / 2, b.y + b.tagSize * 0.33, b.tagSize, ink, 'center', 800);
  }
  let left = o.chars ?? Infinity;
  const ty0 = b.y + b.pad * 0.62 + (b.tag ? b.tagSize * 0.5 : 0) + b.size * 0.9;
  b.rows.forEach((row, i) => {
    if (left <= 0) return;
    const shown = left >= row.length ? row : row.slice(0, left);
    left -= row.length + 1;
    dischargeText(g, shown, b.x + b.pad, ty0 + i * b.lh, b.size, ink, 'left', 700);
  });
  g.restore();
}

// The current line of a beat's script as a bubble (typed, with a pop), and the line before it, dimmed,
// for a moment, so a question and its answer read together. geo maps who to a screen point.
function dischargeLines(g, L, lines, T, geo, o = {}) {
  if (!lines || !lines.length) return;
  let cur = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i][0] <= T) cur = i;
  if (cur < 0) return;
  const linger = o.linger ?? 2.2,
    list = [];
  for (const i of [cur, cur - 1]) {
    if (i < 0) continue;
    const [at, who, raw, hold] = lines[i],
      anchor = geo[who];
    if (!anchor || !Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) continue;
    let alpha = 1;
    if (i < cur) {
      const since = T - lines[cur][0];
      if (since >= linger) continue;
      alpha = 0.62 * (1 - dischargeSpan(since, linger - 0.35, linger));
    }
    if (hold && T > at + hold) alpha *= 1 - dischargeSpan(T, at + hold, at + hold + 0.35);
    if (alpha <= 0.01) continue;
    const info = dischargeWho(who),
      box = dischargeBubbleBox(g, L, dischargeFill(raw), anchor[0], anchor[1], { name: info.name, size: o.size, below: anchor[2] === 'below' });
    list.push({
      box,
      alpha,
      info,
      chars: i === cur && !reduced ? Math.floor((T - at) * DISCHARGE_CPS) : Infinity,
      pop: i === cur && !reduced ? dischargePop((T - at) / 0.3) : 1
    });
  }
  if (list.length === 2 && dischargeOverlap(list[0].box, list[1].box)) {
    const a = list[0].box,
      b = list[1].box;
    b.noTail = true;
    b.y = a.y - b.h - a.tagSize * 2;
    if (b.y < L.top) b.y = a.y + a.h + a.tagSize * 2;
    if (b.y + b.h > L.bottom) list[1].alpha *= 0.3;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    dischargeBubblePaint(g, L, it.box, { alpha: it.alpha, tag: it.info.tag, chars: it.chars, pop: it.pop, fill: it.info.fill });
  }
}

// Whether who is mid-line, and the little hop a speaker does as a line starts (the friends' cheer bounces).
function dischargeSpeaking(lines, T, id) {
  if (!lines) return false;
  for (const [at, who, text] of lines)
    if ((who === id || (who === 'friends' && DISCHARGE_FRIENDS.includes(id))) && T >= at && T < at + text.length / DISCHARGE_CPS + 0.2)
      return true;
  return false;
}

function dischargeHop(lines, T, id) {
  if (!lines) return 0;
  const k = reduced ? 0.4 : 1;
  for (const [at, who, text] of lines) {
    if (!(who === id || (who === 'friends' && DISCHARGE_FRIENDS.includes(id)))) continue;
    const since = T - at;
    if (who === 'friends' && text.length > 6 && since >= 0 && since < 1.8) return Math.abs(Math.sin(since * 7)) * 9 * k;
    if (since >= 0 && since < 0.5) return Math.sin((since / 0.5) * Math.PI) * 6 * k;
  }
  return 0;
}

// ---- Layout ----
// Everything scales with how big a canvas unit is on screen, so the words stay big on a phone.
function dischargeLayout(g, W, H, beat) {
  let css = 1;
  try {
    const r = canvas.getBoundingClientRect();
    if (r && r.width > 0) css = r.width / Math.max(1, W);
  } catch {
    css = 1;
  }
  css = clamp(css, 0.2, 4);
  const fs = px => clamp(px / css, px, px * 2.4),
    portrait = H > W * 1.08,
    m = Math.max(fs(14), Math.min(W, H) * 0.035),
    L = { w: W, h: H, css, fs, portrait, m, cx: W / 2, cy: H / 2 };
  L.dotY = m * 0.75 + fs(5);
  L.top = beat && beat.chrome === false ? m : L.dotY + fs(16);
  L.cap = beat && beat.caption !== false ? dischargeCaptionBox(g, L, beat) : null;
  L.bottom = L.cap ? L.cap.y - fs(8) : H - m;
  return L;
}

function dischargeCaptionBox(g, L, beat) {
  const size = L.fs(L.portrait ? 18 : 17),
    lh = size * 1.3,
    kick = size * 0.64,
    maxW = Math.min(L.w - L.m * 2, size * 40),
    rows = dischargeWrap(g, dischargeFill(beat.copy), maxW - size * 1.4, size, 700),
    w = Math.min(maxW, Math.max(...rows.map(r => dischargeTextW(g, r, size, 700)), dischargeTextW(g, beat.title.toUpperCase(), kick, 800)) + size * 1.6),
    h = kick * 1.8 + rows.length * lh + size * 0.75;
  return { x: (L.w - w) / 2, y: L.h - L.m - h, w, h, rows, size, lh, kick };
}

// A design box dw × dh fit into the content area; x0..x1, y0..y1 is what is visible, for backdrops.
function dischargeStage(L, dw, dh) {
  const avH = L.bottom - L.top + L.fs(36),
    k = Math.min(L.w / dw, avH / dh),
    ox = (L.w - dw * k) / 2,
    oy = L.top + (avH - dh * k) / 2;
  return { k, ox, oy, x0: -ox / k, y0: -oy / k, x1: (L.w - ox) / k, y1: (L.h - oy) / k };
}

function dischargeRoomBack(g, L, id) {
  if (typeof roomBg !== 'function' || !rooms[id]) {
    rect(g, 0, 0, L.w, L.h, '#2d4c55');
    return;
  }
  const k = Math.max(L.w / 1000, L.h / 625);
  g.save();
  g.translate((L.w - 1000 * k) / 2, (L.h - 625 * k) / 2);
  g.scale(k, k);
  roomBg(g, id);
  g.restore();
}

// ---- Beat 1: the paperwork ----
function dischargeSignature(g, f) {
  if (f <= 0) return;
  const n = 64,
    pts = [];
  for (let i = 0; i <= Math.round(n * f); i++) {
    const u = i / n;
    pts.push([52 + u * 196 + Math.sin(u * Math.PI * 9) * 7, 494 - Math.abs(Math.sin(u * Math.PI * 4.5)) * 22 * (1 - u * 0.5) + Math.cos(u * Math.PI * 9) * 4]);
  }
  if (pts.length > 1) line(g, pts, '#1f3f8f', 2.4);
}

function dischargePapers(g, L, T) {
  const W = L.w,
    H = L.h,
    f = L.fs;
  dischargeVertical(g, W, H, '#1d4150', '#0f2630');
  glow(g, W * 0.5, L.top + (L.bottom - L.top) * 0.3, Math.max(W, H) * 0.6, '#fff2c42a');
  const avH = L.bottom - L.top,
    avW = W - L.m * 2,
    wide = !L.portrait && avW > avH * 1.3,
    k = Math.min(avH / 580, (wide ? avW * 0.5 : avW) / 430),
    bw = 420 * k,
    bh = 560 * k,
    bx = (W - bw) / 2,
    by = L.top + (avH - bh) / 2 + (1 - dischargeSpan(T, 0.05, 0.85)) * H * 0.75;
  if (wide) {
    const room = (W - bw) / 2,
      cs = Math.min((bh * 0.78) / 84, (room * 0.8) / 54),
      ground = by + bh;
    dischargeChair(g, bx - room * 0.5 + 4 * cs, ground, cs, T, {
      act: T > 7.6 ? { kind: 'pump', t: (T - 7.6) % 1.3 } : { kind: 'grin', t: 1 }
    });
    const ls = (bh * 0.86) / Math.max(40, dischargeHeight('lori'));
    dischargePerson(g, 'lori', bx + bw + room * 0.45, ground, {
      s: ls,
      dir: -1,
      t: T,
      speak: T > 5 && T < 6.8,
      hop: T > 7.4 && T < 7.9 ? Math.sin(((T - 7.4) / 0.5) * Math.PI) * 5 : 0
    });
  }
  g.save();
  g.translate(bx, by);
  g.scale(k, k);
  rr(g, 6, 10, 420, 560, 20, '#0a1a2255');
  rr(g, 0, 0, 420, 560, 20, '#b98a57', '#7a5a3a', 2);
  rr(g, 18, 36, 384, 506, 6, DISCHARGE_COL.paper, '#d8cfbf', 1);
  rr(g, 140, -16, 140, 44, 10, '#c9cfd3', '#7d878d', 1.5);
  rr(g, 175, -4, 70, 12, 6, '#8f999f');
  dischargeText(g, 'VALLEY HOSPITAL · PARAMUS', 210, 80, 15, '#3e8a7e', 'center', 800);
  dischargeText(g, 'DISCHARGE ORDER', 210, 122, 34, DISCHARGE_COL.ink, 'center', 800);
  line(g, [[44, 142], [376, 142]], '#c9bfa9', 2);
  const fields = [
    ['PATIENT', `${dischargeName()} · #${dischargeNum()}`],
    ['WHERE', '7th floor · Room 5'],
    ['DIAGNOSIS', 'One very dramatic gut'],
    ['GOING HOME?', 'Yes.']
  ];
  fields.forEach(([lab, val], i) => {
    const y = 180 + i * 72,
      at = 1 + i,
      shown = reduced ? val : val.slice(0, clamp(Math.floor((T - at) * 26), 0, val.length));
    dischargeText(g, lab, 44, y, 13, '#7b8a8e', 'left', 800);
    if (shown) dischargeText(g, shown, 44, y + 36, dischargeFitSize(g, val, 336, 30, 16, 700, true), DISCHARGE_COL.pen, 'left', 700, true);
    line(g, [[44, y + 44], [376, y + 44]], '#e6dcc7', 1);
  });
  const circle = dischargeSpan(T, 4.9, 5.4);
  if (circle > 0)
    path(g, p => p.ellipse(72, 422, 48, 25, -0.1, -0.4, -0.4 + circle * Math.PI * 2.1), null, DISCHARGE_COL.red, 3);
  line(g, [[44, 500], [262, 500]], '#9aa4a6', 1.5);
  dischargeText(g, 'ATTENDING · DR. LORI', 44, 522, 12, '#7b8a8e', 'left', 800);
  dischargeSignature(g, reduced ? (T > 5.2 ? 1 : 0) : dischargeSpan(T, 5.2, 6.6));
  if (T >= 7.2) dischargeStamp(g, 286, 430, 236, 74, -0.21, 'DISCHARGED', DISCHARGE_COL.red, reduced ? 1 : dischargeSpan(T, 7.2, 7.38));
  g.restore();
  // The title card, over the first moments.
  const ta = 1 - dischargeSpan(T, 1.3, 2);
  if (ta > 0) {
    const big = dischargeFitSize(g, 'THE SEND-OFF', W - L.m * 2, f(54), f(24), 900),
      cy = L.top + avH * 0.42;
    g.save();
    g.globalAlpha = dischargeAlpha(g) * ta;
    rect(g, 0, cy - big * 1.6, W, big * 2.5, '#0b1820cc');
    dischargeText(g, 'OPERATION: GUT FEELING', W / 2, cy - big * 0.75, f(15), DISCHARGE_COL.coral, 'center', 800);
    dischargeText(g, 'THE SEND-OFF', W / 2, cy + big * 0.4, big, DISCHARGE_COL.cream, 'center', 900);
    g.restore();
  }
}

// ---- Beat 2: the numbers, rolled up like credits ----
function dischargeScroll(times, tops, end, t) {
  const n = times.length;
  if (t <= times[0]) return tops[0] - (times[0] - t) * ((tops[1] - tops[0]) / Math.max(0.1, times[1] - times[0]));
  for (let i = 1; i < n; i++)
    if (t <= times[i]) return dischargeLerp(tops[i - 1], tops[i], (t - times[i - 1]) / Math.max(1e-6, times[i] - times[i - 1]));
  return dischargeLerp(tops[n - 1], end, dischargeSpan(t, times[n - 1], times[n - 1] + 1.4));
}

function dischargeNumbersBeat(g, L, T, D) {
  const W = L.w,
    H = L.h,
    f = L.fs,
    rows = discharge.numbers || [];
  dischargeVertical(g, W, H, '#14303d', '#0b1b24');
  glow(g, W / 2, H * 0.45, Math.max(W, H) * 0.55, '#ffe9b322');
  const sw = Math.min(W - L.m * 2, f(470)),
    x0 = (W - sw) / 2,
    cx = W / 2,
    head = f(13) * 1.7 + f(26) * 1.3 + f(14) * 1.9 + f(14),
    rowH = f(12) * 1.6 + f(34) * 1.15 + f(14) * 1.6 + f(12),
    foot = f(12) * 1.6 + f(36) * 1.3 + f(80),
    items = [{ kind: 'head', h: head }, ...rows.map(r => ({ kind: 'row', r, h: rowH })), { kind: 'foot', h: foot }],
    times = dischargeNumberTimes(rows.length, D);
  let acc = 0;
  const tops = items.map(it => {
      const y = acc;
      acc += it.h;
      return y;
    }),
    avH = L.bottom - L.top,
    reveal = L.top + avH * 0.6,
    last = items.length - 1,
    mid = (L.top + L.bottom) / 2,
    end = reveal + tops[last] + foot / 2 - mid,
    scroll = dischargeScroll(times, tops, end, T),
    stripTop = reveal + tops[0] - scroll - f(24),
    step = f(12);
  rr(g, x0 + 6, Math.max(-20, stripTop) + 8, sw, H + 40, 4, '#00000033');
  path(
    g,
    p => {
      p.moveTo(x0, H + 20);
      p.lineTo(x0, stripTop + step * 0.5);
      for (let x = x0, i = 0; x < x0 + sw; x += step, i++) p.lineTo(Math.min(x0 + sw, x + step), stripTop + (i % 2 ? step * 0.5 : 0));
      p.lineTo(x0 + sw, H + 20);
      p.closePath();
    },
    DISCHARGE_COL.paper
  );
  for (let y = Math.max(stripTop + step, ((stripTop % f(16)) + f(16)) % f(16)); y < H; y += f(16)) {
    ellipse(g, x0 + f(9), y, f(1.8), f(1.8), '#dccfb4');
    ellipse(g, x0 + sw - f(9), y, f(1.8), f(1.8), '#dccfb4');
  }
  items.forEach((it, i) => {
    const y = reveal + tops[i] - scroll;
    if (y > H + 10 || y + it.h < -10) return;
    const ti = times[i],
      fadeTop = clamp((y + it.h * 0.6 - L.top) / f(50), 0, 1),
      fadeIn = clamp(1 - (y - reveal) / (avH * 0.45), 0, 1),
      a = fadeTop * (0.2 + 0.8 * fadeIn);
    if (a <= 0.01) return;
    g.save();
    g.globalAlpha = dischargeAlpha(g) * a;
    if (it.kind === 'head') {
      dischargeText(g, 'VALLEY HOSPITAL · SEVENTH FLOOR', cx, y + f(13) * 1.2, f(13), '#3e8a7e', 'center', 800);
      dischargeText(g, 'DISCHARGE SUMMARY', cx, y + f(13) * 1.7 + f(26), dischargeFitSize(g, 'DISCHARGE SUMMARY', sw * 0.9, f(26), f(14), 900), DISCHARGE_COL.ink, 'center', 900);
      dischargeText(g, `${dischargeName().toUpperCase()} · #${dischargeNum()} · ROOM 5`, cx, y + f(13) * 1.7 + f(26) * 1.3 + f(14) * 1.3, f(14), '#6d7b80', 'center', 800);
      line(g, [[x0 + f(26), y + head - f(6)], [x0 + sw - f(26), y + head - f(6)]], '#d8cbb0', 1.5);
    } else if (it.kind === 'row') {
      const r = it.r,
        ly = y + f(12) * 1.25,
        vy = y + f(12) * 1.6 + f(34),
        ny = vy + f(14) * 1.45,
        k = reduced ? (T >= ti ? 1 : 0) : dischargeSpan(T, ti, ti + 0.8),
        value = r.text ? (T >= ti ? r.text : '...') : String(Math.round((r.value || 0) * k)) + (r.suffix || '');
      dischargeText(g, r.label, cx, ly, f(12), '#7b8a8e', 'center', 800);
      dischargeText(g, value, cx, vy, dischargeFitSize(g, value, sw * 0.86, f(34), f(16), 900), '#1f4f8f', 'center', 900);
      const na = dischargeSpan(T, ti + 0.3, ti + 0.7);
      if (na > 0) {
        g.globalAlpha = dischargeAlpha(g) * na;
        dischargeText(g, r.note, cx, ny, dischargeFitSize(g, r.note, sw * 0.9, f(14), f(10), 700, true), '#c0504d', 'center', 700, true);
      }
    } else {
      dischargeText(g, 'STATUS', cx, y + f(12) * 1.25, f(12), '#7b8a8e', 'center', 800);
      dischargeText(g, 'GOING HOME.', cx, y + f(12) * 1.6 + f(36), dischargeFitSize(g, 'GOING HOME.', sw * 0.86, f(36), f(18), 900), '#2f8f5b', 'center', 900);
      if (T >= ti + 0.7)
        dischargeStamp(g, cx + sw * 0.12, y + f(12) * 1.6 + f(36) * 1.3 + f(38), Math.min(sw * 0.62, f(250)), f(46), 0.12, 'VERIFIED BY DAD', DISCHARGE_COL.pen, reduced ? 1 : dischargeSpan(T, ti + 0.7, ti + 0.88));
    }
    g.restore();
  });
}

// ---- Beat 3: the machines ----
function dischargeMachines(g, L, T) {
  const W = L.w,
    f = L.fs,
    n = DISCHARGE_MACHINES.length,
    avH = L.bottom - L.top,
    avW = W - L.m * 2;
  dischargeRoomBack(g, L, 0);
  rect(g, 0, 0, W, L.h, '#0b1d28b8');
  let best = null;
  for (const cols of L.portrait ? [3] : [9, 5, 3]) {
    const rowsN = Math.ceil(n / cols),
      cell = Math.min(avW / cols, (avH * 0.62) / rowsN);
    if (!best || cell > best.cell) best = { cols, rowsN, cell };
  }
  const { cols, rowsN, cell } = best,
    top = L.top + avH * 0.38,
    s = (cell * 0.66) / 52,
    active = Math.floor((T - DISCHARGE_MACHINE_AT) / DISCHARGE_MACHINE_GAP),
    geo = {};
  DISCHARGE_MACHINES.forEach(([id, , , , short], i) => {
    const r = Math.floor(i / cols),
      c = i % cols,
      inRow = Math.min(cols, n - r * cols),
      x = W / 2 + (c - (inRow - 1) / 2) * (avW / cols),
      y = top + (r + 0.5) * ((avH * 0.62) / rowsN),
      spoken = i <= active,
      on = i === active,
      since = T - (DISCHARGE_MACHINE_AT + i * DISCHARGE_MACHINE_GAP),
      bounce = on && !reduced ? Math.sin(clamp(since / 0.4, 0, 1) * Math.PI) * 0.16 : 0;
    ellipse(g, x, y + cell * 0.32, cell * 0.36, cell * 0.07, on ? '#fff2c455' : '#ffffff14');
    if (on) glow(g, x, y, cell * 0.75, '#ffe9b340');
    g.save();
    g.globalAlpha = dischargeAlpha(g) * (spoken ? 1 : 0.4);
    if (typeof drawMachineIcon === 'function') drawMachineIcon(g, id, x, y - bounce * cell * 0.3, s * (1 + bounce));
    dischargeText(g, short, x, y + cell * 0.47, dischargeFitSize(g, short, avW / cols - 4, f(10.5), f(7), 800), spoken ? DISCHARGE_COL.cream : '#a8bdbe', 'center', 800);
    g.restore();
    geo['machine:' + id] = [x, y - cell * 0.36];
  });
  dischargeLines(g, L, DISCHARGE_BEAT_LINES.machines, T, geo, { linger: 0.5 });
}

// ---- Beat 4: terms of surrender ----
function dischargeVents(g, L, T) {
  const W = L.w,
    f = L.fs,
    avH = L.bottom - L.top;
  dischargeVertical(g, W, L.h, '#a9d3c4', '#7fb3a4');
  rect(g, 0, 0, W, L.top * 0.5, '#e9f0e2');
  rect(g, 0, L.top * 0.5, W, f(5), '#c9d8c8');
  const spots = L.portrait
      ? [[0.25, 0.22], [0.75, 0.22], [0.5, 0.52], [0.25, 0.82], [0.75, 0.82]]
      : [[0.1, 0.66], [0.29, 0.44], [0.5, 0.56], [0.71, 0.44], [0.9, 0.66]],
    base = L.portrait ? Math.min(W * 0.3, avH * 0.16) : Math.min(W * 0.13, avH * 0.28),
    geo = {};
  let gi = 0;
  spots.forEach(([sx, sy], i) => {
    const ralph = i === 2,
      w = base * (ralph ? 1.35 : 1),
      h = w * 0.62,
      vx = W * sx,
      vy = L.top + avH * sy,
      idx = ralph ? -1 : gi++,
      at = ralph ? 3.5 : 1 + idx * 0.6,
      rise = reduced ? (T >= at ? 1 : 0) : clamp(dischargePop((T - at) / 0.5), 0, 1.15),
      cs = ralph ? (w * 0.74) / 70 : (w * 0.72) / 62,
      feet = vy + (ralph ? 40 : 27) * cs - h * 0.04 + (1 - Math.min(1, rise)) * (h + 60 * cs) - (rise - Math.min(1, rise)) * h * 0.4;
    rr(g, vx - w / 2 - f(3), vy - h / 2 - f(3), w + f(6), h + f(6), w * 0.07, '#d7e6dc', '#8fb0a5', 1.5);
    g.save();
    g.beginPath();
    g.rect(vx - w / 2, vy - h / 2, w, h);
    g.clip();
    rect(g, vx - w / 2, vy - h / 2, w, h, '#1c2d33');
    rect(g, vx - w / 2, vy - h / 2, w, h * 0.3, '#0f1b20');
    if (rise > 0.01) {
      if (ralph) dischargeRalph(g, vx, feet, cs, T, T > 4.4);
      else if (typeof gremlin === 'function') gremlin(g, vx, feet, cs, idx % 4, T + idx);
    }
    g.restore();
    if (!ralph && rise > 0.6) {
      const px = vx + 24 * cs,
        py = feet - 9 * cs,
        top = vy - h / 2 - h * 0.65;
      line(g, [[px, py], [px + 4 * cs, top]], '#8a6a43', Math.max(1, 2.2 * cs));
      dischargeFlag(g, px + 4 * cs, top, cs * 0.9, T + idx);
    }
    // The grille swings open on its top-left screw as the creature comes up.
    const swing = Math.min(1, rise) * (ralph ? 1.25 : 1.05) + (reduced ? 0 : Math.sin(T * 1.7 + i) * 0.03 * Math.min(1, rise));
    g.save();
    g.translate(vx - w / 2, vy - h / 2);
    g.rotate(swing);
    rr(g, 0, 0, w, h, w * 0.05, '#eef3ec', '#9fb3ad', 1.5);
    for (let k = 1; k < 6; k++) line(g, [[w * 0.1, (h * k) / 6], [w * 0.9, (h * k) / 6]], '#a9bcb6', Math.max(1, h * 0.05));
    ellipse(g, w * 0.06, h * 0.12, w * 0.025, w * 0.025, '#8fa29c');
    g.restore();
    geo[ralph ? 'ralph' : 'gremlin:' + idx] = [vx, vy - h * 0.62];
  });
  dischargeLines(g, L, DISCHARGE_BEAT_LINES.vents, T, geo, { linger: 0.4, size: f(L.portrait ? 16 : 15) });
}

// ---- Beat 5: meanwhile, at home ----
function dischargeTv(g, L, T) {
  const W = L.w,
    f = L.fs,
    avH = L.bottom - L.top,
    avW = W - L.m * 2;
  dischargeVertical(g, W, L.h, '#2f4d58', '#1a313b');
  const tw = Math.min(avW, ((avH * 0.9) * 16) / 9),
    th = (tw * 9) / 16,
    tx = (W - tw) / 2,
    ty = L.top + (avH - th) / 2,
    b = f(10);
  glow(g, W / 2, ty + th / 2, Math.max(tw, th) * 0.9, '#9fd0e822');
  rr(g, tx - b + 4, ty - b + 6, tw + b * 2, th + b * 2, b, '#0b141a66');
  rr(g, tx - b, ty - b, tw + b * 2, th + b * 2, b, '#151c24', '#0b1016', 2);
  dischargeText(g, 'VALLEY VISION 75', W / 2, ty + th + b * 0.78, Math.max(5, b * 0.6), '#5b6b75', 'center', 800);
  const on = reduced ? 1 : dischargeSpan(T, 0.15, 0.6);
  g.save();
  g.beginPath();
  g.rect(tx, ty, tw, th);
  g.clip();
  rect(g, tx, ty, tw, th, '#05080c');
  if (on > 0) {
    g.save();
    g.translate(tx + tw / 2, ty + th / 2);
    g.scale(1, Math.max(0.02, on));
    g.translate(-tw / 2, -th / 2);
    if (typeof tvCatCam === 'function') tvCatCam(g, tw, th, T + 1.5);
    else rect(g, 0, 0, tw, th, '#e2c6a2');
    const u = th / 90,
      cy = 13 * u,
      ch = 11 * u,
      size = ch * 0.56,
      text = DISCHARGE_CRAWL.map(dischargeFill).join('   ·   ') + '   ·   ',
      textW = Math.max(1, dischargeTextW(g, text, size, 800)),
      tagW = dischargeTextW(g, 'WELCOME HOME', size * 0.9, 900) + ch * 0.8,
      off = (T * (reduced ? 0.5 : 1) * ch * 6) % textW;
    rect(g, 0, cy, tw, ch, '#0d2a4ee8');
    g.save();
    g.beginPath();
    g.rect(tagW, cy, tw - tagW, ch);
    g.clip();
    for (let x = tagW - off; x < tw; x += textW) dischargeText(g, text, x, cy + ch * 0.7, size, DISCHARGE_COL.cream, 'left', 800);
    g.restore();
    rect(g, 0, cy, tagW, ch, DISCHARGE_COL.red);
    dischargeText(g, 'WELCOME HOME', tagW / 2, cy + ch * 0.68, size * 0.9, DISCHARGE_COL.cream, 'center', 900);
    rr(g, tw - 30 * u, 3 * u, 27 * u, 8 * u, 2 * u, '#10131aa0');
    ellipse(g, tw - 26 * u, 7 * u, 1.6 * u, 1.6 * u, Math.sin(T * 4) > 0 ? '#ff4d4d' : '#ff4d4d66');
    dischargeText(g, 'LIVE', tw - 15 * u, 9 * u, 5.2 * u, '#ffffff', 'center', 900);
    g.restore();
  }
  if (!reduced && on > 0 && on < 1) rect(g, tx, ty + th / 2 - 2, tw, 4, '#ffffffcc');
  g.restore();
}

// ---- Beats 6 to 8: the hallway ----
// The corridor camera: follows the chair, keeps the back row's heads under the progress dots, and on a
// tall phone moves in closer (the corridor is narrow there, so the people stay big).
function dischargeHallView(L, ride) {
  const k = clamp(Math.min(L.w / (L.portrait ? 420 : 560), (L.bottom - L.top + L.fs(80)) / 400), 0.55, 1.4),
    viewW = L.w / k,
    camX = clamp(ride.x - viewW * 0.4, 0, Math.max(0, 3200 - viewW)),
    // From the back row's hair (y 128) to the front row's feet (y 470); spare height goes above, for bubbles.
    free = L.bottom - L.top - (470 - 128) * k,
    oy = free > 0 ? L.top + Math.min(free * 0.65, L.fs(130)) - 128 * k : Math.max((L.top + L.bottom) / 2 - 300 * k, L.top + 6 - 128 * k);
  return { k, viewW, camX, oy, sx: x => (x - camX) * k, sy: y => oy + y * k };
}

// Bunting along the corridor wall: pennants on a string that sags between nails 272 apart.
function dischargeBunting(g, x0, x1, y, from, to) {
  const span = 272,
    sag = 14,
    yAt = x => y + Math.sin((((x - x0) % span) / span) * Math.PI) * sag,
    a = Math.max(x0, Math.floor((from - x0) / 34) * 34 + x0),
    b = Math.min(x1, to),
    pts = [];
  if (b <= a) return;
  for (let x = a; x <= b; x += 17) pts.push([x, yAt(x)]);
  if (pts.length > 1) line(g, pts, '#f6f1df', 1.4);
  for (let x = a, i = Math.round((a - x0) / 34); x + 26 <= b; x += 34, i++)
    poly(g, [[x + 2, yAt(x + 2)], [x + 26, yAt(x + 26)], [x + 14, yAt(x + 14) + 24]], DISCHARGE_CONFETTI[i % DISCHARGE_CONFETTI.length]);
}

function dischargeExitOpen(g, o) {
  const x = 3025,
    w = 150;
  g.save();
  g.beginPath();
  g.rect(x, 28, w, 127);
  g.clip();
  g.fillStyle = gradient(g, 0, 28, 0, 127, '#fffbe8', '#ffe9b0');
  g.fillRect(x, 28, w, 127);
  const slide = o * (w / 2 - 6);
  rr(g, x + 2 - slide, 30, w / 2 - 4, 123, 2, '#9fd4e6aa', '#e9f2ea', 1.5);
  rr(g, x + w / 2 + 2 + slide, 30, w / 2 - 4, 123, 2, '#9fd4e6aa', '#e9f2ea', 1.5);
  g.restore();
  g.save();
  g.globalAlpha = dischargeAlpha(g) * o * 0.55;
  poly(g, [[x + 10, 156], [x + w - 10, 156], [x + w + 60, 330], [x - 70, 330]], '#fff6d0');
  g.restore();
}

function dischargeMacyAct(which, T) {
  if (which === 'hall1' && T < 2.4) return { kind: 'grin', t: 0.3 + T * 0.6 };
  if (which === 'hall2' && T > 4.5 && T < 8.2) return { kind: 'pump', t: (T - 4.5) % 1.3 };
  if (which === 'hall3' && T > 3 && T < 5.4) return { kind: 'grin', t: clamp((T - 3) * 0.9, 0, 2.3) };
  if (which === 'hall3' && T > 11.6 && T < 14) return { kind: 'pump', t: (T - 11.6) % 1.3 };
  return null;
}

function dischargeCorridor(g, L, which, T) {
  const W = L.w,
    H = L.h,
    lines = DISCHARGE_BEAT_LINES[which],
    ride = dischargePath(DISCHARGE_RIDE[which], T),
    prev = dischargePath(DISCHARGE_RIDE[which], Math.max(0, T - 0.05)),
    moving = Math.hypot(ride.x - prev.x, ride.y - prev.y) > 0.02,
    V = dischargeHallView(L, ride),
    s = dischargeUnit(),
    items = [],
    geo = {},
    // A front-row speaker on a tall screen talks from under their feet, so the bubble never covers the parade.
    head = (id, x, y) =>
      (geo[id] = L.portrait && y > 400 ? [V.sx(x), V.sy(y + 6), 'below'] : [V.sx(x), V.sy(y - dischargeHeight(id) - 4)]);
  rect(g, 0, 0, W, H, '#244856');
  if (V.sy(0) > 0) {
    rect(g, 0, 0, W, V.sy(0), '#b9ccc4');
    rect(g, 0, V.sy(0) - L.fs(5), W, L.fs(5), '#9fb8ae');
  }
  g.save();
  g.translate(-V.camX * V.k, V.oy);
  g.scale(V.k, V.k);
  if (typeof roomBg === 'function' && rooms[6] && rooms[6].width > 1000) roomBg(g, 6);
  else {
    rect(g, 0, 0, 3200, 625, '#a3c6bb');
    rect(g, 0, 0, 3200, 153, '#cfdcd6');
  }
  if (typeof hallwayDrawWall === 'function') hallwayDrawWall(g);
  dischargeBunting(g, 260, 3000, 58, V.camX - 40, V.camX + V.viewW + 40);
  if (which === 'hall3') {
    const o = dischargeSpan(T, 12.2, 13.2);
    if (o > 0) dischargeExitOpen(g, o);
  }
  const lo = V.camX - 200,
    hi = V.camX + V.viewW + 200;
  for (const p of (typeof roomProps !== 'undefined' && roomProps[6]) || [])
    if (p && p.box && p.box[0] + p.box[2] > lo && p.box[0] < hi) items.push({ y: p.y, draw: p.draw });
  // The lineup, facing the chair as it passes.
  for (const [id, x0, y0] of DISCHARGE_LINEUP) {
    let x = x0,
      y = y0,
      walk = 0;
    if (id === 'dad' && which === 'hall3') {
      const fo = dischargeSpan(T, 6.8, 8.6);
      x = dischargeLerp(x0, ride.x - 118, fo);
      y = dischargeLerp(y0, ride.y + 8, fo);
      if ((fo > 0 && fo < 1) || (fo >= 1 && moving)) walk = T * 9;
    }
    head(id, x, y);
    if (x < lo || x > hi) continue;
    const dir = ride.x >= x ? 1 : -1,
      hop = dischargeHop(lines, T, id),
      speak = dischargeSpeaking(lines, T, id);
    items.push({ y, draw: g2 => dischargePerson(g2, id, x, y, { dir, t: T + x0 * 0.01, hop, speak, walk }) });
  }
  const fp = DISCHARGE_LINEUP.find(r => r[0] === 'presley'),
    fn = DISCHARGE_LINEUP.find(r => r[0] === 'norah');
  geo.friends = [(V.sx(fp[1]) + V.sx(fn[1])) / 2, V.sy(fp[2] - dischargeHeight('presley') - 4)];
  if (which === 'hall2' && T >= 6 && T < 7.6) {
    const u = (T - 6) / 1.6,
      bx = fp[1] + 14 + u * 60,
      by = fp[2] - 70 - Math.sin(u * Math.PI) * 110;
    items.push({ y: fp[2] + 1, draw: g2 => typeof volleyball === 'function' && volleyball(g2, bx, by, 8, T * 6) });
  }
  // The parade: Stephanie pushing, Macy in the chair, Rowdy out front with the flag.
  const fade = which === 'hall3' ? 1 - dischargeSpan(T, 14.6, 15.9) : 1,
    pusher = dischargePusher(ride.x, ride.y),
    roll = ride.x / (14.5 * s);
  items.push({
    y: pusher.y,
    draw: g2 => {
      g2.save();
      g2.globalAlpha = dischargeAlpha(g2) * fade;
      dischargePerson(g2, 'stephanie', pusher.x, pusher.y, {
        dir: 1,
        t: T,
        walk: moving ? ride.x * 0.09 : 0,
        speak: dischargeSpeaking(lines, T, 'stephanie')
      });
      g2.restore();
    }
  });
  items.push({
    y: ride.y,
    draw: g2 => {
      g2.save();
      g2.globalAlpha = dischargeAlpha(g2) * fade;
      dischargeChair(g2, ride.x, ride.y, s, T, {
        roll,
        grip: pusher.grip,
        act: dischargeMacyAct(which, T),
        bottle: which === 'hall3' && T >= 11.5
      });
      g2.restore();
    }
  });
  geo.stephanie = [V.sx(pusher.x), V.sy(pusher.y - dischargeHeight('stephanie') - 4)];
  geo.macy = [V.sx(ride.x + 2 * s), V.sy(ride.y - 84 * s)];
  let rx = Math.min(ride.x + Math.min(235, V.viewW * 0.46) + Math.sin(T * 1.1) * 18, 3160),
    ry = 364,
    pose = 'cheer',
    face = 1,
    prop = 'flag',
    hop = (reduced ? 2 : 8) * Math.abs(Math.sin(T * 5.5));
  if (which === 'hall3') {
    const d = dischargeSpan(T, 10.6, 12.4);
    rx = dischargeLerp(rx, 3168, d);
    ry = dischargeLerp(ry, 222, d);
    if (d > 0) {
      pose = d < 1 ? 'gallop' : 'wave';
      face = d < 1 ? 1 : -1;
      prop = undefined;
      hop = 0;
    }
  }
  items.push({ y: ry, draw: g2 => dischargePerson(g2, 'rowdy', rx, ry, { pose, dir: face, prop, hop, t: T }) });
  geo.rowdy = [V.sx(rx), V.sy(ry - dischargeHeight('rowdy') - 4)];
  // Barb's Ensure, finally accepted, sails over.
  if (which === 'hall3' && T >= 10.9 && T < 11.5 && typeof roomBottle === 'function') {
    const u = (T - 10.9) / 0.6,
      bx = dischargeLerp(2894, ride.x + 18 * s, u),
      by = dischargeLerp(196, ride.y - 14 * s, u) - Math.sin(u * Math.PI) * 70;
    items.push({
      y: 999,
      draw: g2 => {
        g2.save();
        g2.translate(bx, by);
        g2.rotate(u * 7);
        roomBottle(g2, 0, 8, 0, 1.2);
        g2.restore();
      }
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw(g);
  g.restore();
  if (which === 'hall3') {
    const white = dischargeSpan(T, 14.4, 16);
    if (white > 0) {
      g.save();
      g.globalAlpha = dischargeAlpha(g) * white * 0.85;
      rect(g, 0, 0, W, H, '#fff8e6');
      g.restore();
    }
  }
  dischargeLines(g, L, lines, T, geo, { linger: 1.4 });
}

// ---- Beat 9: the elevator ----
function dischargeElevator(g, L, T) {
  const dw = L.portrait ? 720 : 1000,
    S = dischargeStage(L, dw, 560),
    cx = dw / 2,
    fy = 470,
    m = 1.55,
    s = dischargeUnit() * m,
    lines = DISCHARGE_BEAT_LINES.elevator,
    geo = {};
  rect(g, 0, 0, L.w, L.h, '#9fc1b6');
  g.save();
  g.translate(S.ox, S.oy);
  g.scale(S.k, S.k);
  g.fillStyle = gradient(g, 0, S.y0, 0, fy - S.y0, '#d6e2dc', '#bfd3c9');
  g.fillRect(S.x0, S.y0, S.x1 - S.x0, fy - S.y0);
  rect(g, S.x0, fy, S.x1 - S.x0, S.y1 - fy, '#8fb5a9');
  rect(g, S.x0, fy - 6, S.x1 - S.x0, 8, '#7fa596');
  for (let x = Math.floor(S.x0 / 80) * 80; x < S.x1; x += 80) line(g, [[x, fy + 2], [x - 30, S.y1]], '#7fa59655', 1);
  // The stairs.
  const sx = Math.min(cx + 345, dw - 62),
    stairsOpen = dischargeSpan(T, 6.3, 6.6) * (1 - dischargeSpan(T, 7.2, 7.5));
  rr(g, sx - 55, 170, 110, fy - 170, 3, '#5b4a3a');
  g.save();
  g.translate(sx - 55, 170);
  g.scale(1 - stairsOpen * 0.75, 1);
  rr(g, 0, 0, 110, fy - 170, 3, '#c9b48c', '#8c7556', 1.5);
  rr(g, 30, 30, 50, 46, 3, '#9fd0e8');
  rr(g, 84, 150, 14, 6, 3, '#8c7556');
  g.restore();
  rr(g, sx - 50, 132, 100, 28, 5, '#2f8f5b');
  dischargeText(g, 'STAIRS', sx, 152, 16, DISCHARGE_COL.cream, 'center', 900);
  // The elevator.
  const open = dischargeSpan(T, 0.2, 1.3) * (1 - dischargeSpan(T, 5.9, 7)),
    half = 150,
    top = 100,
    floors = ['7', '6', '5', '4', '3', '2', 'L'],
    fi = T < 7 ? 0 : Math.min(6, Math.floor((T - 7) / 0.36) + 1);
  rr(g, cx - half - 32, top - 16, (half + 32) * 2, fy - top + 16, 8, gradient(g, cx - half - 32, 0, (half + 32) * 2, 0, '#b9cccc', '#93acae'), '#6f8f96', 1.5);
  g.fillStyle = gradient(g, 0, top, 0, fy - top, '#fff1c9', '#e9d6a7');
  g.fillRect(cx - half, top, half * 2, fy - top);
  for (let x = cx - half + 50; x < cx + half; x += 50) line(g, [[x, top + 4], [x, fy - 4]], '#d9c391', 1);
  line(g, [[cx - half + 8, 300], [cx + half - 8, 300]], '#b9a06b', 5);
  rr(g, cx - 64, 26, 128, 44, 6, '#1d262c', '#59666d', 1.5);
  dischargeText(g, floors[fi], cx + 18, 61, 30, fi ? '#ffcf5a' : '#ff9a7a', 'center', 900);
  poly(g, [[cx - 40, 40], [cx - 22, 40], [cx - 31, 54]], fi > 0 && fi < 6 ? '#ffcf5a' : '#4d5a60');
  rr(g, cx + half + 44, 262, 16, 34, 4, '#c3d2d4', '#7d989e', 1);
  ellipse(g, cx + half + 52, 279, 4, 4, T > 0 && T < 1.4 ? '#ffcf5a' : '#e9eef0');
  // Dad, the chair and Stephanie roll in; the doors close in front of them.
  const dx = dischargeLerp(S.x0 - 80, cx - 108, dischargeSpan(T, 0.4, 2.4)),
    rx = dischargeLerp(S.x0 - 220, cx + 52, dischargeSpan(T, 1, 3.4)),
    ry = fy - 4,
    pusher = dischargePusher(rx, ry, m),
    rolling = T > 1 && T < 3.4;
  dischargePerson(g, 'dad', dx, fy - 6, { s: m, dir: 1, t: T, walk: T > 0.4 && T < 2.4 ? T * 9 : 0, speak: dischargeSpeaking(lines, T, 'dad') });
  dischargePerson(g, 'stephanie', pusher.x, pusher.y, { s: m, dir: 1, t: T, walk: rolling ? rx * 0.06 : 0 });
  dischargeChair(g, rx, ry, s, T, { roll: rx / (14.5 * s), grip: pusher.grip, bottle: true, act: { kind: 'grin', t: 1 } });
  geo.dad = [dx, fy - 6 - dischargeHeight('dad') * m - 4];
  if (half - open * half > 0.5) {
    const gap = open * half;
    rr(g, cx - half, top, half - gap, fy - top, 2, gradient(g, cx - half, 0, half, 0, '#d3e0e0', '#a3babd'), '#7d989e', 1);
    rr(g, cx + gap, top, half - gap, fy - top, 2, gradient(g, cx, 0, half, 0, '#a3babd', '#d3e0e0'), '#7d989e', 1);
  }
  // Rowdy: horns first, then the stairs.
  if (T > 2.9 && T < 7.2) {
    const bonk = cx - half - 32 - 52 * m,
      head = dischargeHeight('rowdy') * m;
    let x,
      pose,
      a = 1;
    if (T < 4) {
      x = dischargeLerp(S.x0 - 120, bonk, dischargeSpan(T, 2.9, 4));
      pose = 'gallop';
    } else if (T < 5.2) {
      x = bonk - dischargeSpan(T, 4, 4.4) * 30 * m;
      pose = 'sad';
    } else {
      x = dischargeLerp(bonk - 30 * m, sx, dischargeSpan(T, 5.2, 6.6));
      pose = 'gallop';
      a = 1 - dischargeSpan(T, 6.6, 7.1);
    }
    g.save();
    g.globalAlpha = dischargeAlpha(g) * a;
    dischargePerson(g, 'rowdy', x, fy + 8, { s: m, pose, dir: 1, t: T });
    g.restore();
    if (T > 4 && T < 5.4)
      for (let i = 0; i < 3; i++) {
        const ang = T * 5 + (i * Math.PI * 2) / 3;
        spark(g, x + Math.cos(ang) * 40, fy + 8 - head - 8 + Math.sin(ang) * 10, '#ffe29b', 0.7);
      }
    geo.rowdy = [x, fy + 8 - head - 4];
  }
  g.restore();
  for (const k of Object.keys(geo)) geo[k] = [S.ox + geo[k][0] * S.k, S.oy + geo[k][1] * S.k];
  dischargeLines(g, L, lines, T, geo);
}

// ---- Beat 10: the lobby ----
function dischargeLobbyCrowd() {
  if (discharge.lobby || typeof npcLook !== 'function') return discharge.lobby;
  const fit = (look, h) => (typeof hallwayFitLook === 'function' ? hallwayFitLook(look, h) : look);
  discharge.lobby = {
    desk: fit(npcLook({ top: 'tee', topA: '#f3a6b8', topB: '#fbe3ea', hair: '#c9c2bd', hairDark: '#9a938e', hairStyle: 'bun', glasses: '#6b5a4e', age: 1 }), 0.9),
    fan: fit(npcLook({ top: 'hoodie', topA: '#2f5fb3', hair: '#2f2622', hairStyle: 'short' }), 0.95),
    guard: fit(npcLook({ top: 'tee', topA: '#2b3f63', topB: '#2b3f63', pants: '#22324d', hair: '#3a2a22', hairStyle: 'short', badge: true }), 1.02)
  };
  return discharge.lobby;
}

function dischargeLobby(g, L, T) {
  const dw = L.portrait ? 660 : 1000,
    S = dischargeStage(L, dw, 560),
    fy = 450,
    m = 1.4,
    s = dischargeUnit() * m,
    lines = DISCHARGE_BEAT_LINES.lobby,
    crowd = discharge.lobby,
    geo = {},
    wx0 = L.portrait ? 210 : 250,
    wx1 = L.portrait ? 470 : 760,
    deskX = L.portrait ? 300 : 560,
    deskW = L.portrait ? 210 : 240,
    sx = dw - 70,
    npcH = look => (look && typeof npcTop === 'function' ? npcTop(look) * dischargeNpcScale() * m : 150);
  rect(g, 0, 0, L.w, L.h, '#cbb994');
  g.save();
  g.translate(S.ox, S.oy);
  g.scale(S.k, S.k);
  g.fillStyle = gradient(g, 0, S.y0, 0, fy - S.y0, '#f3ead7', '#e2d4b8');
  g.fillRect(S.x0, S.y0, S.x1 - S.x0, fy - S.y0);
  rect(g, S.x0, fy, S.x1 - S.x0, S.y1 - fy, '#cdbf9f');
  for (let x = Math.floor(S.x0 / 70) * 70; x < S.x1; x += 70) line(g, [[x, fy], [x - 40, S.y1]], '#b9a98455', 1);
  rect(g, S.x0, fy - 8, S.x1 - S.x0, 10, '#b59f78');
  dischargeText(g, 'VALLEY HOSPITAL', (wx0 + wx1) / 2, 46, L.portrait ? 26 : 32, '#3e8a7e', 'center', 900);
  dischargeText(g, 'PARAMUS · NEW JERSEY', (wx0 + wx1) / 2, 66, 12, '#7f8e86', 'center', 800);
  rr(g, wx0 - 8, 78, wx1 - wx0 + 16, 200, 6, '#e3e9d0', '#c6cfb3', 2);
  const panes = L.portrait ? 1 : 2,
    pw = (wx1 - wx0 - (panes - 1) * 14) / panes;
  for (let i = 0; i < panes; i++)
    if (typeof paramusView === 'function') paramusView(g, wx0 + i * (pw + 14), 84, pw, 188, 'afternoon');
    else rect(g, wx0 + i * (pw + 14), 84, pw, 188, '#9fd2e6');
  // The banner, hung in front of the windows.
  const bw = Math.min(wx1 - wx0 + 40, 420),
    bx = (wx0 + wx1) / 2 - bw / 2,
    by = 108 + (reduced ? 0 : Math.sin(T * 1.6) * 2);
  line(g, [[bx + 10, 78], [bx + 10, by]], '#8c7a5c', 1.5);
  line(g, [[bx + bw - 10, 78], [bx + bw - 10, by]], '#8c7a5c', 1.5);
  rr(g, bx, by, bw, 50, 6, DISCHARGE_COL.cream, DISCHARGE_COL.red, 3);
  const banner = dischargeFill('GO HOME, {NAME}!');
  dischargeText(g, banner, bx + bw / 2, by + 29, dischargeFitSize(g, banner, bw - 24, 26, 12, 900), DISCHARGE_COL.red, 'center', 900);
  dischargeText(g, 'love, the seventh floor', bx + bw / 2, by + 44, 11, '#6d7b80', 'center', 700, true);
  // The elevator, left; the stairs, right.
  const eOpen = dischargeSpan(T, 0.3, 1);
  rr(g, 18, 110, 184, fy - 110, 6, '#b9cccc', '#7d989e', 1.5);
  g.fillStyle = gradient(g, 0, 124, 0, fy - 124, '#fff1c9', '#e9d6a7');
  g.fillRect(30, 124, 160, fy - 124);
  if (eOpen < 1) {
    rr(g, 30, 124, 80 * (1 - eOpen), fy - 124, 2, '#c3d2d4', '#7d989e', 1);
    rr(g, 110 + 80 * eOpen, 124, 80 * (1 - eOpen), fy - 124, 2, '#c3d2d4', '#7d989e', 1);
  }
  const sOpen = dischargeSpan(T, 3.5, 3.7);
  rr(g, sx - 52, 170, 104, fy - 170, 3, '#5b4a3a');
  g.save();
  g.translate(sx - 52, 170);
  g.scale(1 - sOpen * 0.7, 1);
  rr(g, 0, 0, 104, fy - 170, 3, '#c9b48c', '#8c7556', 1.5);
  rr(g, 28, 30, 48, 44, 3, '#9fd0e8');
  g.restore();
  rr(g, sx - 46, 136, 92, 26, 5, '#2f8f5b');
  dischargeText(g, 'STAIRS', sx, 155, 15, DISCHARGE_COL.cream, 'center', 900);
  // The desk, the volunteer behind it and the balloons tied to it.
  const clap = T > 5.4 ? Math.abs(Math.sin((T - 5.4) * 9)) * 4 * (reduced ? 0.4 : 1) : 0,
    vx = deskX + deskW * 0.6;
  if (crowd) dischargePerson(g, 'desk', vx, fy - 10, { s: m, look: crowd.desk, dir: -1, t: T, hop: clap, speak: dischargeSpeaking(lines, T, 'desk') });
  geo.desk = [vx, fy - 10 - npcH(crowd && crowd.desk) - 4];
  for (let i = 0; i < 5; i++) {
    const ax = deskX + 14,
      bxl = ax - 30 + i * 15,
      byl = 196 + (i % 2) * 26 + (reduced ? 0 : Math.sin(T * 1.4 + i) * 4);
    line(g, [[ax, 340], [bxl, byl + 22]], '#e9e2d0', 1);
    dischargeBalloon(g, bxl, byl, 16, DISCHARGE_BALLOONS[i % DISCHARGE_BALLOONS.length], T + i);
  }
  rr(g, deskX - 8, 336, deskW + 16, 14, 5, '#d9c3a0', '#a98b62', 1);
  rr(g, deskX, 348, deskW, fy - 348, 6, '#b08d63', '#7a5f42', 1.5);
  rr(g, deskX + deskW / 2 - 56, 368, 112, 24, 4, '#2f8f5b');
  dischargeText(g, 'INFORMATION', deskX + deskW / 2, 385, 12, DISCHARGE_COL.cream, 'center', 900);
  if (crowd && !L.portrait) {
    dischargePerson(g, 'fan', 252, fy + 10, { s: m, look: crowd.fan, dir: 1, t: T + 2, hop: clap });
    dischargePerson(g, 'guard', 318, fy + 4, { s: m, look: crowd.guard, dir: 1, t: T + 3, hop: clap * 0.6 });
  }
  // Rowdy, seven floors later.
  if (T > 3.55) {
    const tired = T < 4.6;
    g.save();
    g.globalAlpha = dischargeAlpha(g) * dischargeSpan(T, 3.55, 3.9);
    dischargePerson(g, 'rowdy', sx - 6, fy + 20, {
      s: m,
      pose: tired ? 'sad' : 'cheer',
      prop: tired ? undefined : 'flag',
      dir: -1,
      t: T,
      hop: tired ? 0 : (reduced ? 2 : 6) * Math.abs(Math.sin(T * 5))
    });
    g.restore();
    geo.rowdy = [sx - 6, fy + 20 - dischargeHeight('rowdy') * m - 4];
  }
  // The parade crosses to the front doors, off to the right.
  const rx = 110 + Math.max(0, T - 0.6) * ((dw + 300 - 110) / 9.2),
    ry = fy + 30,
    pusher = dischargePusher(rx, ry, m),
    dadX = rx + 150;
  dischargePerson(g, 'dad', dadX, ry + 4, { s: m, dir: 1, t: T, walk: T > 0.6 ? T * 9 : 0 });
  dischargePerson(g, 'stephanie', pusher.x, pusher.y, { s: m, dir: 1, t: T, walk: T > 0.6 ? rx * 0.06 : 0 });
  dischargeChair(g, rx, ry, s, T, {
    roll: rx / (14.5 * s),
    grip: pusher.grip,
    bottle: true,
    act: T > 5.4 && T < 8 ? { kind: 'pump', t: (T - 5.4) % 1.3 } : null
  });
  g.restore();
  for (const k of Object.keys(geo)) geo[k] = [S.ox + geo[k][0] * S.k, S.oy + geo[k][1] * S.k];
  dischargeLines(g, L, lines, T, geo);
}

// ---- Beat 11: the doors ----
function dischargeOutside(g, x, y, w, h, T) {
  g.fillStyle = gradient(g, 0, y, 0, h * 0.62, '#7cc3dc', '#e8f1d2');
  g.fillRect(x, y, w, h);
  glow(g, x + w * 0.72, y + h * 0.2, h * 0.5, '#fff4c8aa');
  for (let i = 0; i < 6; i++) ellipse(g, x + (i + 0.5) * (w / 6), y + h * 0.6, w / 9, h * 0.08, i % 2 ? '#5d9a6c' : '#6aa277');
  rect(g, x, y + h * 0.64, w, h * 0.36, '#7c858a');
  for (let i = 0; i < 7; i++) line(g, [[x + i * (w / 6), y + h * 0.66], [x + i * (w / 6) - w * 0.1, y + h]], '#f4f4ea', 2);
}

function dischargeDoors(g, L, T) {
  const dw = L.portrait ? 640 : 900,
    S = dischargeStage(L, dw, 560),
    cx = dw / 2,
    fy = 470,
    m = 1.5,
    s = dischargeUnit() * m,
    lines = DISCHARGE_BEAT_LINES.doors,
    geo = {};
  rect(g, 0, 0, L.w, L.h, '#d9cdb4');
  g.save();
  g.translate(S.ox, S.oy);
  g.scale(S.k, S.k);
  g.fillStyle = gradient(g, 0, S.y0, 0, fy - S.y0, '#efe7d3', '#ddd0b3');
  g.fillRect(S.x0, S.y0, S.x1 - S.x0, fy - S.y0);
  rect(g, S.x0, fy, S.x1 - S.x0, S.y1 - fy, '#cdbf9f');
  rect(g, S.x0, fy - 8, S.x1 - S.x0, 10, '#b59f78');
  const open = reduced ? (T > 2.6 ? 1 : 0) : dischargeSpan(T, 2.6, 3.4);
  rr(g, cx - 178, 66, 356, fy - 66 + 4, 6, '#7c8f96', '#5c6e74', 2);
  g.save();
  g.beginPath();
  g.rect(cx - 166, 78, 332, fy - 78);
  g.clip();
  dischargeOutside(g, cx - 166, 78, 332, fy - 78, T);
  const slide = open * 160;
  for (const side of [-1, 1]) {
    const px = side < 0 ? cx - 166 - slide : cx + slide;
    rr(g, px, 80, 166, fy - 82, 2, '#c4e6f055', '#e9f2ea', 2);
    line(g, [[px + 30, 100], [px + 70, 220]], '#ffffff55', 3);
  }
  g.restore();
  rr(g, cx - 22, 52, 44, 10, 3, '#3c4a50');
  rr(g, cx - 46, 18, 92, 26, 5, '#2f8f5b', '#e9f6dc', 1.2);
  dischargeText(g, 'EXIT', cx, 37, 16, '#f2ffe8', 'center', 900);
  if (open > 0) {
    glow(g, cx, 300, 380 * open, '#fff4d0aa');
    g.save();
    g.globalAlpha = dischargeAlpha(g) * open * 0.5;
    poly(g, [[cx - 160, fy], [cx + 160, fy], [cx + 260, S.y1], [cx - 260, S.y1]], '#fff6d6');
    g.restore();
  }
  rr(g, cx - 120, fy + 6, 240, 30, 6, '#3e5a63');
  dischargeText(g, 'THANK YOU', cx, fy + 27, 13, '#cfe0da', 'center', 900);
  // The chair rolls up; she stands up out of it and walks out on her own.
  const rx = dischargeLerp(S.x0 - 160, cx - 128, dischargeSpan(T, 0, 1.2)),
    ry = fy + 2,
    pusher = dischargePusher(rx, ry, m),
    up = T >= 3.6,
    wave = T > 5.6 ? (reduced ? 2 : 5) * Math.abs(Math.sin(T * 6)) : 0;
  dischargePerson(g, 'stephanie', pusher.x, pusher.y, {
    s: m,
    dir: 1,
    t: T,
    walk: T < 1.2 ? rx * 0.06 : 0,
    hop: wave,
    speak: dischargeSpeaking(lines, T, 'stephanie')
  });
  dischargeChair(g, rx, ry, s, T, { roll: rx / (14.5 * s), grip: pusher.grip, empty: up, bottle: true, act: { kind: 'grin', t: 1 } });
  geo.stephanie = [pusher.x, pusher.y - dischargeHeight('stephanie') * m - 4];
  geo.macy = [rx + 2 * s, ry - 84 * s];
  if (up) {
    const walk = dischargeSpan(T, 5.2, 8),
      mx = dischargeLerp(rx + 30 * s, cx + 70, walk),
      fade = 1 - dischargeSpan(T, 6.8, 8.1),
      k = s * (1 - walk * 0.12);
    g.save();
    g.globalAlpha = dischargeAlpha(g) * fade;
    dischargeMacy(g, mx, ry - walk * 16, k, {
      dir: 1,
      walk: walk > 0 && walk < 1 ? T * 9 : 0,
      act: T < 5.2 ? { kind: 'pump', t: Math.min(1.29, T - 3.6) } : null,
      bottle: true
    });
    g.restore();
    geo.macy = [mx, ry - walk * 16 - 96 * k];
  }
  g.restore();
  for (const k of Object.keys(geo)) geo[k] = [S.ox + geo[k][0] * S.k, S.oy + geo[k][1] * S.k];
  const white = dischargeSpan(T, 7.9, 9);
  if (white > 0) {
    g.save();
    g.globalAlpha = dischargeAlpha(g) * white * 0.9;
    rect(g, 0, 0, L.w, L.h, '#fffaf0');
    g.restore();
  }
  dischargeLines(g, L, lines, T, geo);
}

// ---- Beat 12: the car ----
// The LEGO E-Type from Macy's cabinet, scaled up, studded display base and all. Base underside at (x, y).
function dischargeCarAt(T, x0) {
  return x0 + (T > 7 ? Math.pow(T - 7, 2) * 70 : 0);
}

function dischargeCar(g, L, T) {
  const dw = L.portrait ? 640 : 1000,
    S = dischargeStage(L, dw, 560),
    gy = 420,
    s = dischargeUnit(),
    lines = DISCHARGE_BEAT_LINES.car,
    geo = {},
    cs = L.portrait ? 3.1 : 4.2,
    x0 = dw * 0.64,
    cy = 488,
    carX = dischargeCarAt(T, x0),
    rear = carX - 34 * cs;
  rect(g, 0, 0, L.w, L.h, '#7cc3dc');
  g.save();
  g.translate(S.ox, S.oy);
  g.scale(S.k, S.k);
  g.fillStyle = gradient(g, 0, S.y0, 0, gy - S.y0, '#7cc3dc', '#e0ecca');
  g.fillRect(S.x0, S.y0, S.x1 - S.x0, gy - S.y0);
  glow(g, dw * 0.8, 90, 160, '#fff4c8aa');
  for (let i = 0; i < 3; i++) {
    const x = ((i * 380 + T * 8) % (dw + 300)) - 150,
      y = 70 + i * 34;
    ellipse(g, x, y, 46, 12, '#ffffffaa');
    ellipse(g, x + 24, y - 8, 30, 12, '#ffffffaa');
  }
  for (let i = -1; i < 10; i++) ellipse(g, i * 110 + 40, gy - 8, 70, 26, i % 2 ? '#5d9a6c' : '#6aa277');
  // The hospital behind them.
  const hx = L.portrait ? -40 : 20,
    hw = L.portrait ? 230 : 300;
  rr(g, hx, 60, hw, gy - 60, 4, '#ddd6c6', '#b9b09c', 2);
  rect(g, hx, 60, hw, 26, '#3e8a7e');
  dischargeText(g, 'VALLEY HOSPITAL', hx + hw / 2, 79, dischargeFitSize(g, 'VALLEY HOSPITAL', hw - 20, 18, 10, 900), DISCHARGE_COL.cream, 'center', 900);
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 6; c++) rr(g, hx + 16 + c * ((hw - 32) / 6), 98 + r * 40, (hw - 32) / 6 - 10, 24, 2, r === 0 && c === 3 ? '#ffe9a8' : '#9fc7d6');
  dischargeText(g, '7', hx + 6, 114, 12, '#7b8a8e', 'left', 900);
  rect(g, S.x0, gy, S.x1 - S.x0, 18, '#d4cbbb');
  rect(g, S.x0, gy + 16, S.x1 - S.x0, 4, '#a39a8a');
  rect(g, S.x0, gy + 20, S.x1 - S.x0, S.y1 - gy - 20, '#5f676b');
  for (let x = Math.floor(S.x0 / 150) * 150; x < S.x1; x += 150) line(g, [[x, gy + 24], [x - 50, S.y1]], '#f4f4ea', 3);
  // The curb crew: the empty wheelchair, Stephanie, Rowdy with the flag.
  const wave = t => (reduced ? 2 : 6) * Math.abs(Math.sin(t * 6));
  dischargeChair(g, dw * 0.26, gy + 14, s * 0.92, T, { empty: true });
  dischargePerson(g, 'stephanie', dw * 0.17, gy + 12, { dir: 1, t: T, hop: T > 6.4 ? wave(T) : 0 });
  dischargePerson(g, 'rowdy', dw * 0.07, gy + 16, { pose: 'cheer', prop: 'flag', dir: 1, t: T, hop: T > 6.4 ? wave(T + 0.3) : 0 });
  geo.rowdy = [dw * 0.07, gy + 16 - dischargeHeight('rowdy') - 4];
  // Dad by the car, Macy walking up.
  const dadX = x0 - 34 * cs - 40,
    dadIn = dischargeSpan(T, 6, 6.4),
    walkIn = dischargeSpan(T, 0, 2.6),
    toCar = dischargeSpan(T, 5.4, 5.9),
    mx = T < 5.4 ? dischargeLerp(dw * 0.3, dadX - 60, walkIn) : dischargeLerp(dadX - 60, x0 - 12 * cs, toCar),
    mIn = dischargeSpan(T, 5.7, 6);
  if (dadIn < 1) {
    g.save();
    g.globalAlpha = dischargeAlpha(g) * (1 - dadIn);
    dischargePerson(g, 'dad', dadX, gy + 34, { dir: -1, t: T, speak: dischargeSpeaking(lines, T, 'dad') });
    g.restore();
  }
  geo.dad = [dadX, gy + 34 - dischargeHeight('dad') - 4];
  if (mIn < 1) {
    g.save();
    g.globalAlpha = dischargeAlpha(g) * (1 - mIn);
    dischargeMacy(g, mx, gy + 30, s, {
      dir: 1,
      walk: (T < 2.6 || (T > 5.4 && T < 5.9)) ? T * 9 : 0,
      act: T > 4.3 && T < 5.4 ? { kind: 'grin', t: (T - 4.3) * 1.6 } : null,
      bottle: true
    });
    g.restore();
  }
  geo.macy = [mx, gy + 30 - 96 * s];
  // Exhaust, the Ensure "cans" on strings, the car, two heads, the sign, the balloons.
  if (T > 7)
    for (let i = 0; i < 8; i++) {
      const age = ((T - 7) * 1.6 + i / 8) % 1,
        te = T - age / 1.6;
      if (te < 7) continue;
      g.save();
      g.globalAlpha = dischargeAlpha(g) * (1 - age) * 0.5;
      ellipse(g, dischargeCarAt(te, x0) - 34 * cs - age * 30, cy - 4 * cs - age * 20, (4 + age * 14) * (cs / 4.2), (4 + age * 14) * (cs / 4.2), '#e9eef0');
      g.restore();
    }
  for (let i = 0; i < 3; i++) {
    const d = (50 + i * 32) * (cs / 4.2),
      bx = rear - d,
      drive = T > 7,
      by = cy + 2 - (drive ? Math.abs(Math.sin(T * 13 + i * 1.7)) * 10 : 0);
    line(g, [[rear + 2, cy - 8 * cs], [bx, by - 6]], '#e9e2d0', 1.2);
    if (typeof roomBottle === 'function') {
      g.save();
      g.translate(bx, by);
      g.rotate(drive ? Math.sin(T * 9 + i) * 0.6 : -1.45);
      roomBottle(g, 0, 8, i, 1.3 * (cs / 4.2));
      g.restore();
    }
  }
  for (let i = 0; i < 3; i++) {
    const ax = carX - 6 * cs,
      ay = cy - 24 * cs,
      bx = ax - 30 + i * 30,
      by = ay - 90 - (i % 2) * 26 + (reduced ? 0 : Math.sin(T * 1.6 + i) * 4);
    line(g, [[ax, ay], [bx, by + 18]], '#e9e2d0', 1);
    dischargeBalloon(g, bx, by, 16, DISCHARGE_BALLOONS[(i + 2) % DISCHARGE_BALLOONS.length], T + i);
  }
  g.save();
  g.translate(carX, cy);
  g.scale(cs, cs);
  if (typeof etypeArt === 'function') etypeArt(g);
  else rr(g, -34, -18, 68, 14, 5, '#2f8a57');
  g.restore();
  if (mIn > 0.5) {
    g.save();
    g.translate(carX, cy);
    g.scale(cs, cs);
    g.translate(0, -1.6);
    g.beginPath();
    g.moveTo(-22.5, -17.2);
    g.bezierCurveTo(-18.5, -21.4, -13, -22.6, -6, -22);
    g.lineTo(0.8, -16.9);
    g.closePath();
    g.clip();
    ellipse(g, -15, -17.5, 3.2, 3.4, '#493039');
    ellipse(g, -17.6, -19.6, 1.1, 1, '#f1abbd');
    if (dadIn > 0.5) ellipse(g, -6.5, -17.8, 3.2, 3.6, '#4b3022');
    g.restore();
  }
  g.save();
  g.translate(carX - 23 * cs, cy - 14.5 * cs);
  g.rotate(-0.08);
  const k = cs / 4.2;
  rr(g, -46 * k, -16 * k, 92 * k, 32 * k, 4 * k, DISCHARGE_COL.cream, '#f2c43f', 2);
  dischargeText(g, 'JUST', 0, -3 * k, 10 * k, DISCHARGE_COL.red, 'center', 900);
  dischargeText(g, 'DISCHARGED', 0, 10 * k, 12 * k, DISCHARGE_COL.red, 'center', 900);
  for (let i = 0; i < 10; i++) ellipse(g, (-40 + i * 9) * k, ((i % 3) - 1) * 12 * k, 1.2 * k, 1.2 * k, i % 2 ? '#f2c43f' : '#f3a6b8');
  g.restore();
  g.restore();
  for (const kk of Object.keys(geo)) geo[kk] = [S.ox + geo[kk][0] * S.k, S.oy + geo[kk][1] * S.k];
  dischargeLines(g, L, lines, T, geo);
}

// ---- Beat 13: the card ----
function dischargeCardStats() {
  const flat = Array.isArray(state.medals) ? state.medals.slice(0, ARCADE_COUNT).flat() : [],
    total = typeof STICKERS !== 'undefined' && Array.isArray(STICKERS) ? STICKERS.length : 0;
  return {
    stars: typeof stars === 'function' ? stars() : flat.reduce((a, b) => a + (Number(b) || 0), 0),
    medals: flat.filter(m => m > 0).length,
    golds: flat.filter(m => m === 3).length,
    stickers: Array.isArray(state.stickers) ? state.stickers.length : 0,
    stickerTotal: total
  };
}

function dischargeCard(g, L, T) {
  const W = L.w,
    H = L.h,
    st = dischargeCardStats();
  dischargeVertical(g, W, H, '#1b3a4a', '#0d1923');
  glow(g, W * 0.82, H * 0.12, Math.max(W, H) * 0.5, '#73ac9855');
  glow(g, W * 0.15, H * 0.88, Math.max(W, H) * 0.42, '#ffa48e22');
  const share = dischargeShareAvailable(),
    natural = 410,
    f0 = L.fs(1),
    z = Math.min(1, (H - L.m * 2) / (natural * f0)),
    u = f0 * Math.max(0.55, z),
    pw = Math.min(W - L.m * 2, 580 * u),
    ph = natural * u,
    side = !L.portrait && W - pw > 300 * u,
    px = (W - pw) / 2,
    py = (H - ph) / 2 + (reduced ? 0 : (1 - dischargeSpan(T, 0, 0.6)) * H * 0.2),
    cx = W / 2;
  if (side) {
    const fh = Math.min(ph * 0.75, (W - pw) * 0.4),
      ground = py + ph * 0.92;
    dischargeMacy(g, px / 2, ground, fh / 96, { dir: 1, act: { kind: 'pump', t: T % 1.3 }, bottle: true });
    dischargePerson(g, 'rowdy', px + pw + (W - px - pw) / 2, ground, { s: fh / dischargeHeight('rowdy'), pose: 'cheer', prop: 'flag', dir: -1, t: T });
  } else if (py > 150 * u) {
    const fh = Math.min(py - L.m, 140 * u);
    dischargeMacy(g, cx - 50 * u, py - u * 6, fh / 96, { dir: 1, act: { kind: 'pump', t: T % 1.3 }, bottle: true });
    dischargePerson(g, 'rowdy', cx + 60 * u, py - u * 6, { s: fh / dischargeHeight('rowdy'), pose: 'cheer', prop: 'flag', dir: -1, t: T });
  }
  rr(g, px + 6, py + 8, pw, ph, 22 * u, '#00000044');
  rr(g, px, py, pw, ph, 22 * u, '#16313f', '#b5e8c566', 2);
  let y = py + 30 * u;
  dischargeText(g, 'OPERATION: GUT FEELING', cx, y, 15 * u, DISCHARGE_COL.coral, 'center', 800);
  y += 64 * u * 1.08;
  const pop = reduced ? 1 : dischargePop(clamp((T - 0.2) / 0.5, 0, 1));
  g.save();
  g.translate(cx, y - 22 * u);
  g.scale(pop, pop);
  dischargeText(g, 'DISCHARGED', 0, 22 * u, dischargeFitSize(g, 'DISCHARGED', pw - 40 * u, 64 * u, 24 * u, 900), DISCHARGE_COL.cream, 'center', 900);
  g.restore();
  y += 18 * u * 1.6;
  dischargeText(g, `· ${discharge.date || dischargeDate()} ·`, cx, y, 18 * u, DISCHARGE_COL.mint, 'center', 800);
  y += 12 * u * 1.9;
  const place = `${dischargeName().toUpperCase()} · #${dischargeNum()} · ROOM 5 · VALLEY HOSPITAL, PARAMUS`;
  dischargeText(g, place, cx, y, dischargeFitSize(g, place, pw - 40 * u, 12 * u, 7 * u, 800), DISCHARGE_COL.muted, 'center', 800);
  y += 16 * u;
  const tiles = [
      [String(st.stars), 'STARS', DISCHARGE_COL.gold],
      [String(st.medals), st.golds ? `MEDALS · ${st.golds} GOLD` : 'MEDALS', DISCHARGE_COL.mint],
      [st.stickerTotal ? `${st.stickers}/${st.stickerTotal}` : String(st.stickers), 'STICKERS', DISCHARGE_COL.coral]
    ],
    gap = 10 * u,
    tw = (pw - 40 * u - gap * 2) / 3;
  tiles.forEach(([v, k, col], i) => {
    const tx = px + 20 * u + i * (tw + gap);
    rr(g, tx, y, tw, 66 * u, 12 * u, '#1f3f4d');
    dischargeText(g, v, tx + tw / 2, y + 36 * u, dischargeFitSize(g, v, tw - 12 * u, 28 * u, 12 * u, 900), col, 'center', 900);
    dischargeText(g, k, tx + tw / 2, y + 55 * u, dischargeFitSize(g, k, tw - 10 * u, 10 * u, 6 * u, 800), DISCHARGE_COL.muted, 'center', 800);
  });
  y += 66 * u + 36 * u;
  const lh = 19 * u * 1.4,
    sweet = dischargeWrap(g, dischargeFill(DISCHARGE_BEATS[DISCHARGE_BEATS.length - 1].copy), pw - 50 * u, 19 * u, 700, true).slice(0, 2);
  sweet.forEach((row, i) => dischargeText(g, row, cx, y + i * lh, 19 * u, DISCHARGE_COL.cream, 'center', 700, true));
  y += (sweet.length - 1) * lh + 28 * u;
  const bh = 46 * u,
    said = discharge.shareSaid && discharge.clock < discharge.shareSaid.until ? discharge.shareSaid.text : '',
    bw = share ? (pw - 50 * u) / 2 : Math.min(pw - 50 * u, 260 * u),
    back = share ? px + 25 * u + bw + 10 * u : cx - bw / 2;
  if (share) {
    const sx = px + 25 * u;
    rr(g, sx, y, bw - 10 * u, bh, bh / 2, DISCHARGE_COL.coral, '#e07f6a', 1.5);
    dischargeText(g, said || 'Share', sx + (bw - 10 * u) / 2, y + bh * 0.64, 17 * u, DISCHARGE_COL.ink, 'center', 900);
    discharge.shareRect = { x: sx, y, w: bw - 10 * u, h: bh };
  } else discharge.shareRect = null;
  rr(g, back, y, bw - (share ? 10 * u : 0), bh, bh / 2, DISCHARGE_COL.mint, '#86c9a0', 1.5);
  dischargeText(g, 'Head back', back + (bw - (share ? 10 * u : 0)) / 2, y + bh * 0.64, 17 * u, DISCHARGE_COL.ink, 'center', 900);
  const hint = discharge.input === 'key' ? (share ? 'S TO SHARE · ANY KEY TO HEAD BACK' : 'ANY KEY TO HEAD BACK') : 'TAP ANYWHERE TO HEAD BACK';
  dischargeText(g, hint, cx, y + bh + 22 * u, 10 * u, '#7f979c', 'center', 800);
}

// ---- The share card (1080 × 1350, the same PNG pipeline as stickers.js) ----
function dischargeShareAvailable() {
  return typeof shareDeliver === 'function' && typeof document !== 'undefined' && !!document && typeof document.createElement === 'function';
}

function dischargeShareDraw(g, spec = {}) {
  const W = typeof SHARE_W === 'number' ? SHARE_W : 1080,
    H = typeof SHARE_H === 'number' ? SHARE_H : 1350,
    st = { ...dischargeCardStats(), ...spec },
    name = String(spec.name || dischargeName()),
    date = String(spec.date || discharge.date || dischargeDate());
  g.save();
  rect(g, 0, 0, W, H, '#101e29');
  g.fillStyle = gradient(g, 0, 0, 0, H, '#1b3a4a', '#0d1923');
  g.fillRect(0, 0, W, H);
  glow(g, W * 0.85, 120, 520, '#73ac9855');
  glow(g, 120, H - 160, 420, '#ffa48e22');
  if (typeof shareWordmark === 'function') shareWordmark(g, 112);
  else {
    dischargeText(g, 'OPERATION:', W / 2, 112, 34, DISCHARGE_COL.coral, 'center', 800);
    dischargeText(g, 'GUT FEELING.', W / 2, 204, 92, DISCHARGE_COL.cream, 'center', 900);
  }
  const sx = 60,
    sy = 270,
    sw = W - 120,
    sh = 600;
  if (typeof shareScene === 'function') shareScene(g, sx, sy, sw, sh, '#73ac98');
  else rr(g, sx, sy, sw, sh, 44, '#73ac98');
  g.save();
  rr(g, sx, sy, sw, sh, 44, null);
  g.clip();
  g.save();
  g.translate(W * 0.6, sy + sh - 40);
  g.scale(6.4, 6.4);
  if (typeof etypeArt === 'function') etypeArt(g);
  g.restore();
  for (let i = 0; i < 4; i++) dischargeBalloon(g, 160 + i * 230, sy + 100 + (i % 2) * 50, 34, DISCHARGE_BALLOONS[i], i);
  g.restore();
  dischargeMacy(g, 250, sy + sh - 54, 4.4, { dir: 1, act: { kind: 'pump', t: 0.55 }, bottle: true });
  if (typeof drawRowdy === 'function') drawRowdy(g, 900, sy + sh - 44, 2.5, 'cheer', 0.6, { face: -1, prop: 'flag' });
  dischargeStamp(g, W * 0.62, sy + 120, 380, 110, -0.16, 'DISCHARGED', DISCHARGE_COL.red, 1);
  const ty = sy + sh + 92;
  dischargeText(g, 'DISCHARGED', W / 2, ty, dischargeFitSize(g, 'DISCHARGED', W - 140, 84, 40, 900), '#f8efd9', 'center', 900);
  dischargeText(g, `VALLEY HOSPITAL · 7TH FLOOR · ROOM 5 · ${date}`, W / 2, ty + 54, dischargeFitSize(g, `VALLEY HOSPITAL · 7TH FLOOR · ROOM 5 · ${date}`, W - 140, 26, 16, 800), '#b5e8c5', 'center', 800);
  const tw = (W - 120 - 40) / 3,
    tiles = [
      [String(st.stars), 'STARS', '#ffda79'],
      [String(st.medals), 'MEDALS', '#b5e8c5'],
      [st.stickerTotal ? `${st.stickers}/${st.stickerTotal}` : String(st.stickers), 'STICKERS', '#ffa48e']
    ];
  tiles.forEach(([v, k, col], i) => {
    const x = 60 + i * (tw + 20);
    if (typeof shareTile === 'function') shareTile(g, x, ty + 96, tw, v, k, col);
    else {
      rr(g, x, ty + 96, tw, 124, 26, '#1f3f4d');
      dischargeText(g, v, x + tw / 2, ty + 166, 54, col, 'center', 900);
      dischargeText(g, k, x + tw / 2, ty + 200, 20, '#a8bdbe', 'center', 800);
    }
  });
  dischargeText(g, 'Thank you for being so brave.', W / 2, ty + 268, 34, '#cfe0da', 'center', 700, true);
  dischargeText(g, `${name.toUpperCase()} · #${dischargeNum()}`, 70, H - 62, 26, '#f8efd9', 'left');
  dischargeText(g, date, W - 70, H - 62, 26, '#a8bdbe', 'right');
  rect(g, 0, H - 22, W / 3, 22, '#b5e8c5');
  rect(g, W / 3, H - 22, W / 3, 22, '#ffa48e');
  rect(g, (W / 3) * 2, H - 22, W / 3, 22, '#ffda79');
  g.restore();
  return { w: W, h: H, kind: 'discharge' };
}

// Draws the share card once per send-off and encodes it in the background, so a tap shares at once.
function dischargeShareRender() {
  if (discharge.shareCv) return discharge.shareCv;
  if (!dischargeShareAvailable()) return null;
  const cv = document.createElement('canvas');
  if (!cv || typeof cv.getContext !== 'function') return null;
  cv.width = typeof SHARE_W === 'number' ? SHARE_W : 1080;
  cv.height = typeof SHARE_H === 'number' ? SHARE_H : 1350;
  const g = cv.getContext('2d');
  if (!g) return null;
  dischargeShareDraw(g, { name: dischargeName(), date: discharge.date });
  discharge.shareCv = cv;
  const play = discharge.plays;
  if (typeof cv.toBlob === 'function')
    try {
      cv.toBlob(b => {
        if (discharge.plays === play) discharge.shareBlob = b;
      }, 'image/png');
    } catch {}
  return cv;
}

function dischargeShare() {
  if (!dischargeShareAvailable()) return 'none';
  let how = 'none';
  try {
    let blob = discharge.shareBlob;
    if (!blob) {
      const cv = dischargeShareRender();
      blob = cv && typeof shareBlobSync === 'function' ? shareBlobSync(cv) : null;
      discharge.shareBlob = blob;
    }
    how = shareDeliver(blob, DISCHARGE_SHARE_NAME, `${dischargeName()} got discharged from Valley Hospital. Operation: Gut Feeling.`, null);
  } catch (err) {
    dischargeError(err);
    how = 'none';
  }
  if (typeof sfx === 'function') sfx('select');
  discharge.shareSaid = {
    text: { share: 'Sharing...', download: 'Saved ✓', tab: 'Opened ✓' }[how] || "Can't share here",
    until: discharge.clock + 2.2
  };
  return how;
}

// ---- The beats ----
// lines: [time, who, text, hold?] in story seconds; cues: [time, sfx name or !shake / !burst / !balloons,
// options]. Every time is in story seconds; under reduced motion the whole clock runs DISCHARGE_REDUCED.
const DISCHARGE_BEAT_LINES = {
  machines: DISCHARGE_MACHINES.map((m, i) => [DISCHARGE_MACHINE_AT + i * DISCHARGE_MACHINE_GAP, 'machine:' + m[0], m[2]]),
  vents: [
    [1.1, 'gremlin:0', 'truce?'],
    [1.9, 'gremlin:1', 'sorry about the gut'],
    [2.7, 'gremlin:2', 'no hard feelings'],
    [3.4, 'gremlin:3', 'bye, {name}!'],
    [5, 'ralph', 'It was an honor. Mostly. Please leave a review.']
  ],
  hall1: [
    [0.5, 'rowdy', 'CLEAR THE HALLWAY! STAR FRESHMAN COMING THROUGH!'],
    [2.6, 'stephanie', 'Hands inside the chair, superstar. Last ride on seven.'],
    [4.9, 'lori', "Small bites, big life. Doctor's orders. Go home."],
    [7.1, 'benedetto', 'Excellent. All of it. The mustache is also emotional.'],
    [9.4, 'julez', "Thirty years on this floor. Bravest one yet. Don't come back. Love you."],
    [11.8, 'mimi', "The cookies are in the car. They've been very patient."],
    [14.2, 'dodo', 'Home by the weekend. Told you. Atta girl.']
  ],
  hall2: [
    [1.3, 'casey', 'The group chat is planning a party. Mimi thumbs-upped it nine times.'],
    [4, 'presley', 'Ready?'],
    [5, 'friends', 'OKAY!'],
    [6, 'friends', 'BUMP! SET! SEND HER HOME!'],
    [8.6, 'taylor', "Car's out front. Shotgun's yours, freshman."],
    [10.6, 'norah', 'Back seat. Forever. Worth it.'],
    [12.6, 'brother', 'So. Can I have your room now?'],
    [14.4, 'macy', 'No.'],
    [15.6, 'brother', 'Worth a shot. Missed you. Whatever.']
  ],
  hall3: [
    [0.6, 'dad', 'Why did the gut finally check out of the hospital?'],
    [3, 'dad', 'It had a GUT FEELING.'],
    [5, 'macy', 'Dad.'],
    [6.1, 'dad', 'Last one. Until the car.'],
    [8.2, 'barb', 'One Ensure for the road, hon? Just one?'],
    [10.4, 'macy', '...Fine. ONE.'],
    [11.6, 'barb', 'SHE SAID YES! Somebody write this down!'],
    [13.4, 'rowdy', "Hold the door! I'm holding the door! GO RAMS!"]
  ],
  elevator: [
    [1.8, 'dad', 'Going down. Next stop, home. Then pancakes.'],
    [4.3, 'rowdy', "Horns don't fit. Stairs it is. SEE YOU DOWNSTAIRS!"]
  ],
  lobby: [
    [3.9, 'rowdy', 'Seven floors! Worth it! Rams do not fit in elevators!'],
    [5.7, 'desk', "Everybody clap! We've got a going-home!"]
  ],
  doors: [
    [1, 'stephanie', 'Wheelchair to the door. Hospital rule.'],
    [3.9, 'macy', 'Feet from here. My rule.'],
    [6.2, 'stephanie', "Go get 'em, number {num}."]
  ],
  car: [
    [0.6, 'dad', 'Your chariot. Built it myself. Scaled it up a little.'],
    [2.7, 'macy', "Dad. It's still on the stand."],
    [4.3, 'dad', 'It came with the stand.'],
    [7.4, 'rowdy', 'GO RAMS! GO HOME! GO {NAME}!']
  ]
};

const DISCHARGE_BEATS = [
  {
    id: 'papers',
    title: 'The paperwork',
    dur: 12,
    copy: 'Dr. Lori signed the papers. She does not say soon unless she means it.',
    draw: dischargePapers,
    cues: [
      [0, 'go'],
      [0.4, 'ui', { vol: 0.5 }],
      [1, 'select', { vol: 0.4 }],
      [2, 'select', { vol: 0.4 }],
      [3, 'select', { vol: 0.4 }],
      [4, 'select', { vol: 0.4 }],
      [4.9, 'ui'],
      [5.2, 'slice', { vol: 0.45 }],
      [7.2, 'bossHit'],
      [7.2, '!shake', 0.35],
      [7.25, 'win'],
      [7.3, '!burst', { x: 0.5, y: 0.62, n: 46 }]
    ]
  },
  {
    id: 'numbers',
    title: 'The numbers',
    dur: 18,
    copy: 'Every number here is real. Dad is printing a copy for the fridge.',
    draw: dischargeNumbersBeat,
    makeCues: () => {
      const n = (discharge.numbers || []).length,
        times = dischargeNumberTimes(n, 18),
        foot = times[times.length - 1],
        cues = [[0.3, 'ui', { vol: 0.4 }]];
      for (let i = 0; i < n; i++) cues.push([times[i + 1], 'coin', { count: i, vol: 0.5 }]);
      cues.push([foot + 0.7, 'lock'], [foot + 0.7, '!shake', 0.25], [foot + 0.75, 'combo', { combo: 8 }]);
      return cues;
    }
  },
  {
    id: 'machines',
    title: 'Last words from the machines',
    dur: 19.5,
    copy: 'The machines of the seventh floor would each like a word.',
    draw: dischargeMachines,
    cues: DISCHARGE_MACHINES.map((m, i) => [DISCHARGE_MACHINE_AT + i * DISCHARGE_MACHINE_GAP, m[3], { vol: 0.6 }])
  },
  {
    id: 'vents',
    title: 'Terms of surrender',
    dur: 11,
    copy: 'The gremlins have agreed to terms. Ralph says the neck brace is unrelated.',
    draw: dischargeVents,
    cues: [
      [1, 'blob', { vol: 0.5 }],
      [1.6, 'blob', { vol: 0.5 }],
      [2.2, 'blob', { vol: 0.5 }],
      [2.8, 'blob', { vol: 0.5 }],
      [3.1, 'lose', { vol: 0.55 }],
      [3.5, 'squelch'],
      [4.4, 'shield', { vol: 0.6 }]
    ]
  },
  {
    id: 'tv',
    title: 'Meanwhile, at home',
    dur: 11,
    copy: "Room 5's 75-inch TV switched to the cat cam on its own. Pepper has questions.",
    draw: dischargeTv,
    cues: [
      [0.15, 'select'],
      [0.9, 'daily'],
      [3.4, 'catch', { vol: 0.4 }]
    ]
  },
  {
    id: 'hall1',
    title: 'The hallway',
    dur: 17,
    copy: 'Everyone came out to the hallway. Everyone.',
    draw: (g, L, T) => dischargeCorridor(g, L, 'hall1', T),
    confetti: 10,
    cues: [
      [0, 'clear'],
      [0.3, '!balloons', 4],
      [7, '!balloons', 3]
    ]
  },
  {
    id: 'hall2',
    title: 'The team',
    dur: 18.5,
    copy: 'The team showed up. The team always shows up.',
    draw: (g, L, T) => dischargeCorridor(g, L, 'hall2', T),
    confetti: 10,
    cues: [
      [6, 'combo', { combo: 6 }],
      [6.1, '!burst', { x: 0.5, y: 0.4, n: 40 }],
      [6.3, 'bounce', { vol: 0.5 }],
      [7.4, 'bounce', { vol: 0.5 }]
    ]
  },
  {
    id: 'hall3',
    title: 'The way out',
    dur: 16,
    copy: 'Last stretch. Dad has one more joke. Barb has one more Ensure.',
    draw: (g, L, T) => dischargeCorridor(g, L, 'hall3', T),
    confetti: 8,
    cues: [
      [3, 'miss', { vol: 0.5 }],
      [10.9, 'throw', { vol: 0.5 }],
      [11.5, 'catch'],
      [11.6, 'win'],
      [11.6, '!burst', { x: 0.55, y: 0.4, n: 50 }],
      [12.2, 'dash'],
      [14.5, 'powerup']
    ]
  },
  {
    id: 'elevator',
    title: 'The elevator',
    dur: 10,
    copy: "Going down. Rowdy's horns are not elevator-legal.",
    draw: dischargeElevator,
    cues: [
      [0.2, 'daily'],
      [4, 'stun'],
      [5.2, 'dash', { vol: 0.5 }],
      [6.6, 'hit', { vol: 0.5 }],
      ...[0, 1, 2, 3, 4, 5].map(i => [7 + i * 0.36, 'countdown', { vol: 0.4 }]),
      [9.3, 'daily']
    ]
  },
  {
    id: 'lobby',
    title: 'The lobby',
    dur: 10,
    copy: 'The lobby. Real daylight. Nobody here wants her blood pressure.',
    draw: dischargeLobby,
    confetti: 4,
    cues: [
      [0.3, 'daily'],
      [3.6, 'hit'],
      [5.4, 'explode', { vol: 0.35 }],
      [5.4, '!burst', { x: 0.62, y: 0.6, n: 70 }],
      [5.5, 'clear']
    ]
  },
  {
    id: 'doors',
    title: 'The doors',
    dur: 9,
    copy: 'Hospital rule: they wheel you to the door. Her rule: she walks out of it.',
    draw: dischargeDoors,
    cues: [
      [2.6, 'dash'],
      [3.6, 'powerup'],
      [8.1, 'go']
    ]
  },
  {
    id: 'car',
    title: 'The car',
    dur: 14,
    copy: 'The family car: the LEGO E-Type from her cabinet, scaled up. Dad kept the stand.',
    draw: dischargeCar,
    cues: [
      [5.6, 'lock', { vol: 0.5 }],
      [6.2, 'lock', { vol: 0.5 }],
      [7, 'dash'],
      [7.05, 'leap'],
      [7.6, 'bounce'],
      [8.3, 'bounce'],
      [9, 'bounce'],
      [10.4, '!balloons', 7],
      [10.5, 'clear']
    ]
  },
  {
    id: 'card',
    title: 'Discharged',
    dur: 14,
    copy: 'Thank you for being so brave. Love, everyone on seven.',
    draw: dischargeCard,
    caption: false,
    chrome: false,
    confetti: 6,
    enter: () => dischargeShareRender(),
    cues: [
      [0.2, 'win'],
      [0.3, '!burst', { x: 0.5, y: 0.35, n: 80 }]
    ]
  }
];

// ---- Flow ----
function dischargeActive() {
  return discharge.active;
}

// Seconds the whole send-off runs if nobody touches anything.
function dischargeTotal() {
  return DISCHARGE_BEATS.reduce((a, b) => a + b.dur, 0) * (reduced ? DISCHARGE_REDUCED : 1);
}

// Something else took over: the title, an arcade, another room.
function dischargeGone() {
  return (typeof titleUp !== 'undefined' && !!titleUp) || !state.started || mini.open || state.room !== discharge.room;
}

function dischargeStart() {
  if (discharge.active || (typeof titleUp !== 'undefined' && titleUp) || mini.open) return false;
  state.stats ||= {};
  state.stats.sendoffs = dischargeCount(state.stats.sendoffs) + 1;
  if (typeof save === 'function') save();
  discharge = {
    ...discharge,
    active: true,
    beat: 0,
    t: 0,
    T: 0,
    clock: 0,
    out: -1,
    scale: reduced ? DISCHARGE_REDUCED : 1,
    room: state.room,
    plays: discharge.plays + 1,
    numbers: dischargeNumbers(),
    cues: [],
    date: dischargeDate(),
    fx: [],
    spawn: 0,
    shake: 0,
    press: null,
    lastAdvance: -9,
    blipKey: '',
    blips: 0,
    pushLook: null,
    lobby: null,
    input: discharge.input || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'key'),
    shareRect: null,
    shareCv: null,
    shareBlob: null,
    shareSaid: null
  };
  dischargeClickDebt = false;
  // The lobby's extras get their looks now (npcLook draws randomness), so drawing never does.
  dischargeLobbyCrowd();
  if (typeof clearHeld === 'function')
    try {
      clearHeld();
    } catch {}
  if (typeof music === 'function') music('discharge');
  dischargeGo(0);
  return true;
}

function dischargeGo(i) {
  discharge.beat = clamp(i, 0, DISCHARGE_BEATS.length - 1);
  discharge.t = 0;
  discharge.T = 0;
  discharge.blipKey = '';
  discharge.blips = 0;
  discharge.shareRect = null;
  const beat = DISCHARGE_BEATS[discharge.beat];
  discharge.cues = (beat.cues || []).concat(typeof beat.makeCues === 'function' ? beat.makeCues() : []);
  if (typeof beat.enter === 'function')
    try {
      beat.enter();
    } catch (err) {
      dischargeError(err);
    }
  dischargeCues(-1, 0);
}

function dischargeCues(from, to) {
  for (const cue of discharge.cues) if (cue[0] > from && cue[0] <= to) dischargeCue(cue[1], cue[2]);
}

function dischargeCue(name, opts) {
  if (name === '!shake') {
    if (!reduced) discharge.shake = Math.max(discharge.shake, Number(opts) || 0.3);
  } else if (name === '!burst') dischargeBurst(opts || {});
  else if (name === '!balloons') dischargeBalloons(Number(opts) || 4);
  else if (typeof sfx === 'function') sfx(name, opts || {});
}

// A tap, Space, Enter: the next beat (or, on the card, home).
function dischargeAdvance() {
  if (!discharge.active || discharge.out >= 0) return false;
  if (discharge.clock - discharge.lastAdvance < DISCHARGE_GAP) return false;
  discharge.lastAdvance = discharge.clock;
  if (discharge.beat >= DISCHARGE_BEATS.length - 1) {
    dischargeEnd();
    return true;
  }
  dischargeGo(discharge.beat + 1);
  if (typeof sfx === 'function') sfx('ui', { vol: 0.35 });
  return true;
}

// A long press or Escape: straight to the card (on the card, home).
function dischargeSkip() {
  if (!discharge.active || discharge.out >= 0) return false;
  discharge.lastAdvance = discharge.clock;
  const last = DISCHARGE_BEATS.length - 1;
  if (discharge.beat >= last) {
    dischargeEnd();
    return true;
  }
  dischargeGo(last);
  if (typeof sfx === 'function') sfx('back', { vol: 0.5 });
  return true;
}

// The fade back to the hallway begins, with Macy standing just outside the exit.
function dischargeEnd() {
  if (discharge.out >= 0) return;
  discharge.out = 0;
  discharge.press = null;
  discharge.shareRect = null;
  dischargePlace();
}

function dischargePlace() {
  const hall = typeof HALLWAY_ID === 'number' ? HALLWAY_ID : 6;
  if (state.room !== hall || discharge.room !== hall) return;
  const ex = typeof HALLWAY_EXIT_X === 'number' ? HALLWAY_EXIT_X : 3100;
  player.x = ex - 70;
  player.y = 292;
  player.dir = -1;
  player.visualDir = -1;
  player.lastDx = -1;
  player.lastDy = 0;
  player.moving = false;
  player.z = 0;
  player.vz = 0;
  player.dash = 0;
  if (typeof viewport === 'object' && viewport && typeof roomWidth === 'function')
    cameraX = clamp(player.x - viewport.w / 2, 0, Math.max(0, roomWidth() - viewport.w));
}

function dischargeFinish() {
  discharge.active = false;
  discharge.out = -1;
  discharge.press = null;
  discharge.fx = [];
  discharge.shareRect = null;
  dischargeClickDebt = false;
  if (typeof music === 'function') music('room:' + state.room);
  if (typeof toast === 'function') toast(DISCHARGE_TOAST, 4.2);
  if (typeof sfx === 'function') sfx('ui');
}

// Quietly, when something else took over. Whatever moved her chose the music.
function dischargeStop() {
  if (!discharge.active) return;
  discharge.active = false;
  discharge.out = -1;
  discharge.press = null;
  discharge.fx = [];
  discharge.shareRect = null;
  dischargeClickDebt = false;
  if (typeof audio === 'object' && audio && audio.track === 'discharge' && !mini.open && typeof music === 'function')
    music('room:' + state.room);
}

function dischargeVoices(beat) {
  const lines = DISCHARGE_BEAT_LINES[beat.id];
  if (!lines) return;
  let cur = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i][0] <= discharge.T) cur = i;
  if (cur < 0) return;
  const [at, who, text] = lines[cur],
    key = beat.id + ':' + cur;
  if (key !== discharge.blipKey) {
    discharge.blipKey = key;
    discharge.blips = 0;
  }
  const info = dischargeWho(who);
  if (!info.voice) return;
  const typed = Math.min(text.length, Math.floor((discharge.T - at) * DISCHARGE_CPS)),
    n = Math.floor(typed / 3);
  if (n > discharge.blips) {
    discharge.blips = n;
    if (typeof sfx === 'function') sfx('talk', { voice: info.voice, count: n, combo: info.pitch, vol: 0.7 });
  }
}

// ---- Confetti and balloons (positions are fractions of the screen, so a resize never strands them) ----
function dischargeBit(x, y, vx, vy) {
  if (discharge.fx.length >= DISCHARGE_MAX_FX) return;
  discharge.fx.push({
    kind: 'bit',
    x,
    y,
    vx,
    vy,
    rot: rand(0, 6.28),
    vr: rand(-6, 6) * (reduced ? 0.3 : 1),
    col: pick(DISCHARGE_CONFETTI),
    size: rand(0.7, 1.3),
    life: rand(5, 9),
    sway: rand(0, 6.28)
  });
}

function dischargeBurst(o) {
  const n = Math.round((o.n || 40) * (reduced ? 0.3 : 1));
  for (let i = 0; i < n; i++) {
    const ang = rand(-Math.PI * 0.95, -Math.PI * 0.05),
      sp = rand(0.25, 0.7) * (reduced ? 0.5 : 1);
    dischargeBit(o.x ?? 0.5, o.y ?? 0.6, Math.cos(ang) * sp * 0.6, Math.sin(ang) * sp);
  }
}

function dischargeBalloons(n) {
  const count = reduced ? Math.min(2, n) : n;
  for (let i = 0; i < count && discharge.fx.length < DISCHARGE_MAX_FX; i++)
    discharge.fx.push({
      kind: 'balloon',
      x: rand(0.06, 0.94),
      y: rand(1.05, 1.25),
      vx: 0,
      vy: -rand(0.06, 0.1) * (reduced ? 0.6 : 1),
      rot: 0,
      vr: 0,
      col: pick(DISCHARGE_BALLOONS),
      size: rand(0.9, 1.3),
      life: 30,
      sway: rand(0, 6.28)
    });
}

function dischargeSpawn(beat, step) {
  const rate = (beat.confetti || 0) * (reduced ? 0.25 : 1);
  if (rate <= 0) return;
  discharge.spawn += rate * step;
  while (discharge.spawn >= 1) {
    discharge.spawn -= 1;
    dischargeBit(rand(0, 1), -0.04, rand(-0.03, 0.03), rand(0.06, 0.14) * (reduced ? 0.5 : 1));
  }
}

function dischargeFxStep(step) {
  const c = discharge.clock;
  for (const p of discharge.fx) {
    p.life -= step;
    if (p.kind === 'balloon') {
      p.y += p.vy * step;
      p.x += Math.sin(c * 0.9 + p.sway) * 0.004 * step;
      continue;
    }
    p.vx *= 1 - Math.min(1, 1.4 * step);
    p.vy = Math.min(p.vy + 0.5 * step, 0.16);
    p.x += (p.vx + Math.sin(c * 2.2 + p.sway) * 0.02) * step;
    p.y += p.vy * step;
    p.rot += p.vr * step;
  }
  discharge.fx = discharge.fx.filter(p => p.life > 0 && p.y < 1.3 && p.y > -0.35 && p.x > -0.2 && p.x < 1.2);
}

function dischargeDrawFx(g, L) {
  for (const p of discharge.fx) {
    const x = p.x * L.w,
      y = p.y * L.h,
      s = L.fs(6) * p.size;
    if (p.kind === 'balloon') {
      dischargeBalloon(g, x, y, s * 3.2, p.col, discharge.clock + p.sway);
      continue;
    }
    g.save();
    g.translate(x, y);
    g.rotate(p.rot);
    g.scale(1, Math.max(0.15, Math.abs(Math.cos(p.rot * 1.7))));
    g.fillStyle = p.col;
    g.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6);
    g.restore();
  }
}

// ---- Update ----
function updateDischarge(dt) {
  if (!discharge.active) return false;
  if (dischargeGone()) {
    dischargeStop();
    return false;
  }
  if (state.paused || (typeof isModal === 'function' && isModal())) return true;
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  discharge.clock += step;
  discharge.shake = Math.max(0, discharge.shake - step);
  dischargeFxStep(step);
  const press = discharge.press;
  if (press && !press.done) {
    press.held += step;
    if (press.held >= DISCHARGE_LONG) {
      press.done = true;
      dischargeSkip();
    }
  }
  if (discharge.out >= 0) {
    discharge.out += step;
    if (discharge.out >= DISCHARGE_OUT) {
      dischargeFinish();
      return false;
    }
    return true;
  }
  const beat = DISCHARGE_BEATS[discharge.beat],
    from = discharge.T;
  discharge.t += step;
  discharge.T = discharge.t / discharge.scale;
  dischargeCues(from, discharge.T);
  dischargeVoices(beat);
  dischargeSpawn(beat, step);
  if (discharge.T >= beat.dur) {
    // The part of this step past the end of the beat carries into the next, so any frame rate keeps time.
    const spill = Math.max(0, discharge.t - beat.dur * discharge.scale);
    if (discharge.beat < DISCHARGE_BEATS.length - 1) {
      dischargeGo(discharge.beat + 1);
      if (spill > 0) {
        discharge.t = spill;
        discharge.T = spill / discharge.scale;
        dischargeCues(0, discharge.T);
      }
    } else dischargeEnd();
  }
  return true;
}

// ---- Drawing ----
function dischargeCaption(g, L, beat, T) {
  const c = L.cap;
  if (!c) return;
  const a = dischargeSpan(T, 0.15, 0.6);
  if (a <= 0.01) return;
  g.save();
  g.globalAlpha = dischargeAlpha(g) * a;
  rr(g, c.x, c.y, c.w, c.h, c.size * 0.7, '#0a161ecc', '#b5e8c533', 1);
  dischargeText(g, beat.title.toUpperCase(), L.w / 2, c.y + c.kick * 1.55, c.kick, DISCHARGE_COL.coral, 'center', 800);
  c.rows.forEach((row, i) => dischargeText(g, row, L.w / 2, c.y + c.kick * 1.8 + c.size * 0.95 + i * c.lh, c.size, DISCHARGE_COL.cream, 'center', 700));
  g.restore();
}

function dischargeChrome(g, L) {
  const n = DISCHARGE_BEATS.length,
    f = L.fs,
    gap = f(13),
    w = gap * (n - 1) + f(14),
    x0 = L.w / 2 - w / 2 + f(3),
    y = L.dotY;
  rr(g, x0 - f(10), y - f(8), w + f(14), f(16), f(8), '#0b1820aa');
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap + (i > discharge.beat ? f(9) : 0),
      col = i < discharge.beat ? DISCHARGE_COL.mint : i === discharge.beat ? DISCHARGE_COL.gold : '#ffffff55';
    if (i === discharge.beat) rr(g, x - f(3), y - f(3), f(15), f(6), f(3), col);
    else ellipse(g, x, y, f(3), f(3), col);
  }
  if (discharge.clock < 9) {
    const a = 1 - dischargeSpan(discharge.clock, 7.5, 9),
      text =
        discharge.input === 'key'
          ? 'SPACE: NEXT · ESC: SKIP TO THE END'
          : discharge.input === 'mouse'
            ? 'CLICK: NEXT · HOLD: SKIP TO THE END'
            : 'TAP: NEXT · HOLD: SKIP TO THE END';
    g.save();
    g.globalAlpha = dischargeAlpha(g) * a;
    dischargeText(g, text, L.w / 2, y + f(22), f(11), DISCHARGE_COL.cream, 'center', 800);
    g.restore();
  }
}

function drawDischarge(g, vw, vh) {
  if (!discharge.active || !g) return;
  const W = Number.isFinite(vw) && vw > 0 ? vw : 1000,
    H = Number.isFinite(vh) && vh > 0 ? vh : 625,
    beat = DISCHARGE_BEATS[discharge.beat],
    T = discharge.T,
    D = beat.dur,
    last = discharge.beat === DISCHARGE_BEATS.length - 1,
    a = Math.min(clamp(discharge.clock / DISCHARGE_IN, 0, 1), discharge.out >= 0 ? 1 - clamp(discharge.out / DISCHARGE_OUT, 0, 1) : 1);
  g.save();
  g.globalAlpha = a;
  const L = dischargeLayout(g, W, H, beat);
  g.save();
  if (discharge.shake > 0 && !reduced) {
    const k = discharge.shake / 0.35;
    g.translate(Math.sin(discharge.clock * 90) * 6 * k, Math.cos(discharge.clock * 77) * 4 * k);
  }
  try {
    beat.draw(g, L, T, D);
  } catch (err) {
    dischargeError(err);
  }
  g.restore();
  const dip = Math.max(discharge.beat > 0 ? 1 - dischargeSpan(T, 0, DISCHARGE_DIP) : 0, last ? 0 : dischargeSpan(T, D - DISCHARGE_DIP * 0.8, D));
  if (dip > 0.01) {
    g.save();
    g.globalAlpha = a * dip;
    rect(g, 0, 0, W, H, DISCHARGE_COL.shade);
    g.restore();
  }
  dischargeDrawFx(g, L);
  dischargeCaption(g, L, beat, T);
  if (beat.chrome !== false) dischargeChrome(g, L);
  if (state.paused) rect(g, 0, 0, W, H, '#102734aa');
  g.restore();
}

// ---- Input ----
function dischargeLive() {
  return discharge.active && discharge.out < 0 && !state.paused && !(typeof isModal === 'function' && isModal());
}

function dischargeOnCard() {
  return discharge.active && discharge.beat === DISCHARGE_BEATS.length - 1;
}

// p in screen units (the ward viewport).
function dischargeOnShare(p) {
  const r = discharge.shareRect;
  return !!(p && r && dischargeOnCard() && p.x >= r.x - 6 && p.x <= r.x + r.w + 6 && p.y >= r.y - 6 && p.y <= r.y + r.h + 6);
}

function dischargeAction(kind, point) {
  if (!discharge.active) return false;
  if (discharge.out >= 0) return true;
  if (kind === 'escape' || kind === 'skip' || kind === 'hold') {
    dischargeSkip();
    return true;
  }
  if (kind === 'tap' && point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const p = { x: point.x - cameraX, y: point.y - (typeof wardCameraY === 'number' ? wardCameraY : 0) };
    if (dischargeOnShare(p)) {
      dischargeShare();
      return true;
    }
  }
  dischargeAdvance();
  return true;
}

// A press on the canvas: on the Share button it shares now (inside the gesture, as iOS wants); anywhere
// else it waits to see whether it is a tap (advance on release) or a long press (skip, in the update).
function dischargePressDown(p, id) {
  if (dischargeOnShare(p)) {
    discharge.press = { id, held: 0, done: true };
    dischargeShare();
    return;
  }
  discharge.press = { id, held: 0, done: false };
}

function dischargeRelease(cancel) {
  const press = discharge.press;
  discharge.press = null;
  if (!press || press.done || cancel || !dischargeLive()) return;
  dischargeAdvance();
}

function dischargeScreenPoint(e) {
  try {
    const r = canvas.getBoundingClientRect(),
      vw = typeof viewport === 'object' && viewport ? viewport.w : 1000,
      vh = typeof viewport === 'object' && viewport ? viewport.h : 625;
    return {
      x: ((e.clientX - r.left) * vw) / Math.max(1, r.width),
      y: ((e.clientY - r.top) * vh) / Math.max(1, r.height)
    };
  } catch {
    return null;
  }
}

function dischargeOnCanvas(e) {
  const t = e && e.target;
  if (!t) return false;
  if (t === canvas) return true;
  const stage = typeof $ === 'function' ? $('stage') : null;
  return !!stage && t === stage;
}

function dischargeSwallow(e) {
  if (typeof e.preventDefault === 'function' && e.cancelable !== false) e.preventDefault();
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  else if (typeof e.stopPropagation === 'function') e.stopPropagation();
  // audio.js unlocks on this same gesture from a later listener; do it here instead.
  if (typeof audio === 'object' && audio && typeof audio.unlock === 'function') audio.unlock();
}

function dischargeOnInput(e) {
  if (!e || typeof e !== 'object') return false;
  const type = e.type;
  if (type === 'click') {
    if (!dischargeClickDebt) return false;
    dischargeClickDebt = false;
    dischargeSwallow(e);
    return true;
  }
  if (type === 'pointerup' || type === 'pointercancel') {
    const press = discharge.press;
    if (!press || (e.pointerId !== undefined && press.id !== undefined && press.id !== e.pointerId)) return false;
    dischargeRelease(type === 'pointercancel');
    return false;
  }
  if (!dischargeLive()) return false;
  if (type === 'contextmenu') {
    if (!dischargeOnCanvas(e)) return false;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    return true;
  }
  if (type === 'pointerdown') {
    if (!dischargeOnCanvas(e) || (Number.isFinite(e.button) && e.button > 0)) return false;
    dischargeSwallow(e);
    dischargeClickDebt = true;
    discharge.input = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    dischargePressDown(dischargeScreenPoint(e), e.pointerId);
    return true;
  }
  if (type === 'keydown') {
    const k = String(e.key || '').toLowerCase();
    if (e.metaKey || e.ctrlKey || e.altKey || DISCHARGE_PASS_KEYS.includes(k)) return false;
    dischargeSwallow(e);
    if (e.repeat) return true;
    discharge.input = 'key';
    if (k === 'escape') dischargeSkip();
    else if (k === 's' && dischargeOnCard() && dischargeShareAvailable()) dischargeShare();
    else dischargeAdvance();
    return true;
  }
  return false;
}

if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function')
  for (const type of ['keydown', 'pointerdown', 'pointerup', 'pointercancel', 'click', 'contextmenu'])
    document.addEventListener(type, dischargeOnInput, true);
