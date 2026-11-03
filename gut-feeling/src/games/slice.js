// Gel Yeah! (ultrasound). Gel gremlins get tossed up the sonar screen and you swipe through them.
// Several in one stroke is a combo: the big ones get slow motion and a zoom, and every combo fills the
// party meter. Gold starts a frenzy. The tosses come in bursts with a breath between them, and the
// tempo climbs through the round and after every combo. Level 1 is just slicing, slow to start, with
// two very obvious lone bombs; level 2 brings in splitters, helmets and bombs one at a time, each with a
// callout; level 3 adds laughing gas (no heart, two seconds of fog) and hides both in the lineup;
// Legendary is all of it, fast, on a short clock. Every level ends on a jumbo gel you swipe as often as
// you can. Canvas 600 × 600, or 450 × 800 on an upright screen. The arena is laid out in fractions of
// the active canvas, and everything in flight rescales if the phone turns mid-run.
const SLICE_G = 650; // gravity on a 600-tall canvas; scales with the canvas height
const SLICE_REACH = 8; // the blade cuts a gremlin within r + REACH: generous on purpose
const SLICE_BOMB_GRACE = 7; // a bomb only goes off within r - GRACE: near misses are free
const SLICE_TRAIL = 0.2; // seconds a trail point lives
const SLICE_COMBO_GAP = 0.32; // cuts this close together in one stroke are one combo
const SLICE_FRENZY = 4.5; // seconds of party
const SLICE_HOVER = 2.8; // seconds the jumbo gel hangs around
const SLICE_JUMBO_MAX = 16; // hits before the jumbo pops on its own
const SLICE_JUMBO_GAP = 0.09; // seconds between jumbo hits, so a scribble cannot empty it at once
const SLICE_FOG = 2; // seconds of laughing-gas fog
const SLICE_HOLD = 2.6; // a breath waits at most this long for the screen to clear
const SLICE_FINALE = 10.5; // seconds left when the jumbo is due

const SLICE_KINDS = {
  plain: { r: 31, art: 0, col: '#9bd77f', pts: 10 },
  blue: { r: 31, art: 3, col: '#86cfee', pts: 10 },
  kid: { r: 21, art: 3, col: '#86cfee', pts: 15 },
  helmet: { r: 32, art: 0, col: '#b8e08f', pts: 20 },
  gold: { r: 29, art: 2, col: '#f3cf6e', pts: 50 },
  bomb: { r: 29, art: -1, col: '#ec86b0', pts: 0, hazard: true },
  gas: { r: 28, art: -1, col: '#a98be8', pts: 0, hazard: true },
  jumbo: { r: 74, art: 0, col: '#9bd77f', pts: 15 }
};

// The toss catalogue. Small tosses carry one or two gremlins; formations carry the wave's size.
const SLICE_SMALL = ['single', 'pair', 'lob', 'floater', 'low', 'cross'];
// Formations a hazard can hide inside: one clean swipe along them would cross it.
const SLICE_LINEUPS = ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'criss'];

// Per-level tuning. Arrays of three are per wave (shift); pairs are [tempo 0, tempo 1].
// Pacing: the tempo climbs from ramp[0] to ramp[1] by the finale, plus combo heat. Tosses come in bursts
// of `burst` (a range at each end), `gap` apart; a burst ends on a breath: the screen clears, then
// `breath` seconds of nothing. `quick` caps the gap once the screen is clear mid-burst. `big` is the
// chance a toss is a formation (size from `size`) rather than a small toss.
// Content: blue, helmet and bombs are per-toss chances (bombs covers both hazards; gas is the share
// that is laughing gas from gasFrom on), inLine the chance a hazard hides in a formation. loneBombs
// are level 1's solo bombs, warned `warn` seconds ahead. escapes is drops per heart, meter the party
// points that start a frenzy (a combo of n is worth n - 2), combos the count that maxes the medal term.
const SLICE_TIERS = [
  // Level 1: just slicing. Slow to start, two lone bombs to meet, one gold party, the jumbo finale.
  {
    limit: 60,
    goal: 80,
    speed: 0.84,
    ramp: [0, 1],
    gap: [1.4, 0.45],
    breath: [1.4, 0.3],
    burst: [[1, 2], [4, 6]],
    quick: [1, 0.4],
    big: [0.08, 0.75],
    size: [[3], [3, 3, 4], [3, 4, 4]],
    small: [['single', 'pair', 'lob', 'floater'], ['single', 'pair', 'lob', 'floater', 'low', 'cross'], SLICE_SMALL],
    forms: [['line', 'arc', 'fan'], ['line', 'arc', 'v', 'diag', 'fan'], ['line', 'arc', 'v', 'diag', 'fan', 'drum']],
    blue: [0, 0, 0],
    helmet: [0, 0, 0],
    helmetFrom: 0,
    bombs: [0, 0, 0],
    inLine: [0, 0, 0],
    gas: [0, 0, 0],
    gasFrom: 1,
    loneBombs: [0.3, 0.64],
    warn: 0.9,
    gold: [0.55],
    escapes: 10,
    meter: 6,
    combos: 12,
    hints: ['first', 'bomb', 'gold', 'jumbo']
  },
  // Level 2: one new thing at a time, each with a callout: splitters, helmets, then bombs, which
  // start out clear of the rows and later hide in them.
  {
    limit: 75,
    goal: 200,
    speed: 1.05,
    ramp: [0.3, 1],
    gap: [1.15, 0.6],
    breath: [1.2, 0.5],
    burst: [[2, 3], [3, 5]],
    quick: [0.8, 0.35],
    big: [0.35, 0.8],
    size: [[3, 4, 4], [3, 4, 5], [4, 4, 5]],
    small: [SLICE_SMALL, SLICE_SMALL, SLICE_SMALL],
    forms: [
      ['line', 'arc', 'v', 'diag', 'drum', 'fan'],
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter'],
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter', 'criss']
    ],
    blue: [0.3, 0.12, 0.12],
    helmet: [0.25, 0.22, 0.18],
    helmetFrom: 0.18,
    bombs: [0, 0.4, 0.55],
    inLine: [0, 0.25, 0.45],
    gas: [0, 0, 0],
    gasFrom: 1,
    loneBombs: [],
    warn: 0,
    gold: [0.42],
    escapes: 3,
    meter: 10,
    combos: 24,
    hints: ['blue', 'helmet', 'bomb', 'gold', 'jumbo']
  },
  // Level 3: faster, both hazards, and they hide in the lineup. Laughing gas arrives early, alone.
  {
    limit: 90,
    goal: 220,
    speed: 1.1,
    ramp: [0.4, 1],
    gap: [1, 0.65],
    breath: [1, 0.55],
    burst: [[2, 3], [3, 5]],
    quick: [0.7, 0.35],
    big: [0.45, 0.85],
    size: [[3, 4, 4], [3, 4, 5], [4, 4, 5]],
    small: [SLICE_SMALL, SLICE_SMALL, SLICE_SMALL],
    forms: [
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter'],
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter', 'criss'],
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter', 'criss']
    ],
    blue: [0.15, 0.15, 0.15],
    helmet: [0.15, 0.2, 0.22],
    helmetFrom: 0,
    bombs: [0.38, 0.48, 0.58],
    inLine: [0.4, 0.5, 0.6],
    gas: [0.35, 0.4, 0.45],
    gasFrom: 0.1,
    loneBombs: [],
    warn: 0,
    gold: [0.3, 0.68],
    escapes: 3,
    meter: 10,
    combos: 30,
    hints: ['bomb', 'gas', 'gold', 'jumbo']
  },
  // Legendary: fast tosses from the first second, both hazards in the lineup, a high quota, a short clock.
  {
    limit: 60,
    goal: 180,
    speed: 1.15,
    ramp: [0.47, 1],
    gap: [0.85, 0.55],
    breath: [0.85, 0.45],
    burst: [[2, 4], [4, 5]],
    quick: [0.5, 0.3],
    big: [0.55, 0.85],
    size: [[3, 4, 4], [3, 4, 5], [4, 4, 5]],
    small: [SLICE_SMALL, SLICE_SMALL, SLICE_SMALL],
    forms: [
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter', 'criss'],
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter', 'criss'],
      ['line', 'arc', 'v', 'diag', 'drum', 'fan', 'scatter', 'criss']
    ],
    blue: [0.15, 0.15, 0.15],
    helmet: [0.2, 0.22, 0.25],
    helmetFrom: 0,
    bombs: [0.52, 0.6, 0.66],
    inLine: [0.55, 0.65, 0.75],
    gas: [0.4, 0.45, 0.5],
    gasFrom: 0,
    loneBombs: [],
    warn: 0,
    gold: [0.35],
    escapes: 3,
    meter: 10,
    combos: 30,
    hints: ['bomb', 'gas', 'jumbo']
  }
];

// Levels with laughing gas brief (and toast) the purple one too.
const SLICE_GAS_CUE = 'Swipe through gremlins · 3+ in one swipe = combo · never touch pink or purple';

const SLICE_HINTS = {
  first: 'SWIPE THROUGH ALL THREE',
  bomb: 'PINK BOMB · DO NOT TOUCH',
  gas: 'LAUGHING GAS · POPS INTO FOG',
  gold: 'GOLD · SLICE IT FOR A PARTY',
  blue: 'BLUE SPLITS · GET THE KIDS',
  helmet: 'HELMET · HIT IT TWICE',
  jumbo: 'SWIPE IT AGAIN AND AGAIN'
};

const SLICE = registerGame({
  id: 4,
  canvas: { w: 600, h: 600 },
  portraitCanvas: { w: 450, h: 800 },
  layout: 'gesture',
  info: {
    game: 'Gel Yeah!',
    genre: 'SWIPE · COMBO · DODGE THE PINK',
    headline: 'A very questionable fruit salad.',
    desc:
      'Gel gremlins hop up the ultrasound screen. Swipe through them, line up three or more in one stroke for a combo, and keep your blade off the pink bombs. Gold starts a frenzy. The jumbo one at the end wants to be swiped a lot.',
    goal: 'Slice the quota before the scan ends.',
    control:
      'Press and swipe through gremlins. Mouse: hold the button and drag. Three or more in one swipe is a combo, and combos fill the party meter.',
    avoid:
      'Pink bombs cost a heart and blow the screen clear. Purple laughing gas fogs the screen. Gremlins that drop off the bottom add up to an oops.',
    cue: 'Swipe through gremlins · 3+ in one swipe = combo · never touch pink'
  },
  legendary: true,
  tierNotes: [
    '60s · just slicing · starts slow · two very obvious bombs',
    '75s · splitters, helmets, bombs · one at a time',
    '90s · faster · laughing gas · bombs in the lineup',
    '60s · fast tosses · both bombs in the rows · big quota'
  ],
  shiftName: 'WAVE',
  init() {
    const tier = SLICE_TIERS[mini.tier];
    initArcadeRun(tier.limit);
    if (tier.gas.some(Boolean)) setInstructions(SLICE_GAS_CUE);
    const { w, h } = activeCanvas();
    Object.assign(mini, {
      // A gentler prescription throws fewer gremlins, so it asks for fewer.
      goal: Math.round(tier.goal * Math.min(1, Math.sqrt(mini.rules.mini))),
      gels: [],
      gelSerial: 0,
      sliceQueue: [],
      spawn: 0.7,
      sliceW: w,
      sliceH: h,
      sliceWaves: 0,
      sliceCuts: 0,
      sliceStrokes: 0,
      sliceRun: null,
      sliceCombos: 0,
      sliceMeter: 0,
      sliceFrenzy: 0,
      sliceFrenzyClock: 0,
      sliceFrenzySide: 1,
      sliceFrenzies: 0,
      sliceParty: false,
      sliceGoldAt: tier.gold.map(f => f * tier.limit),
      sliceLoneAt: tier.loneBombs.map(f => f * tier.limit),
      sliceLoneId: null,
      sliceRestUntil: 0,
      // The director: tosses left in this burst, the breath after it, the last toss, combo heat.
      sliceBurst: 1,
      sliceLull: null,
      sliceLastToss: null,
      sliceTosses: [],
      sliceHeat: 0,
      sliceMet: {},
      sliceWarns: [],
      sliceFog: 0,
      sliceGas: 0,
      sliceJumboDue: false,
      sliceJumboDone: false,
      sliceJumboWait: 0,
      sliceJumboHits: 0,
      sliceEscapes: 0,
      sliceDropped: 0,
      sliceDropOops: 0,
      sliceBombs: 0,
      sliceSeen: {},
      sliceGuide: null,
      sliceOopsQueue: [],
      sliceTrail: [],
      sliceHalves: [],
      sliceDrops: [],
      sliceStains: [],
      slicePops: [],
      sliceSlashes: [],
      sliceConfetti: [],
      sliceBanner: null,
      sliceBoomFx: null,
      sliceZoom: null,
      sliceSlowmo: 0,
      sliceShake: 0,
      sliceWhoosh: 0,
      sliceLastAng: 0
    });
  },
  controls() {
    setControls([]);
  },
  update(dt) {
    updateArcade(dt, updateSlice);
  },
  draw(g) {
    drawSlice(g);
  },
  // Every press slices on contact: a tap on a gremlin cuts it, a drag cuts everything it crosses.
  down(p) {
    mini.sliceStrokes++;
    mini.sliceWhoosh = 0;
    sliceTrailPoint(p);
    sliceSegment(p, p);
  },
  move(p, prev) {
    sliceTrailPoint(p);
    const len = Math.hypot(p.x - prev.x, p.y - prev.y);
    mini.sliceWhoosh += len;
    if (mini.sliceWhoosh > 260) {
      mini.sliceWhoosh = 0;
      sfx('throw', { vol: 0.45, pan: sliceToPan(p.x) });
    }
    sliceSegment(prev, p);
  },
  // Lifting the finger banks the stroke's combo. A lost pointer banks nothing.
  up(cancel) {
    if (cancel) {
      mini.sliceRun = null;
      return;
    }
    if (mini.screen === 'play' && !mini.paused) sliceBank();
  },
  assist() {
    mini.slow = 5;
    sliceDefuse();
    mini.sliceFog = Math.min(mini.sliceFog, 0.3);
    mini.flash = 1;
    mini.flashText = 'GEL FREEZE · BOMBS FIZZLED · SLOW MOTION';
    sfx('stun');
  },
  shiftMessage: shift =>
    [
      ['WAVE 2 · it speeds up. Three in a row is one swipe, not three.', 'FINAL WAVE · the jumbo one is coming. Save some swipes.'],
      ['WAVE 2 · pink bombs join in. Swipe around them.', 'FINAL WAVE · bombs hide in the rows now. Three drops is a heart.'],
      ['WAVE 2 · bombs hide in the lineup. Two short swipes beat one long one.', 'FINAL WAVE · gas and bombs together. Make every swipe count.'],
      ['WAVE 2 · faster. Short swipes, clean lines.', 'FINAL WAVE · everything at once. The jumbo is your bonus round.']
    ][mini.tier][shift - 1],
  timeUp() {
    const met = mini.got >= mini.goal;
    finishMini(
      met,
      met
        ? undefined
        : 'Scan over. Quota missed. Wait for the top of their hop, where they slow down, and take a whole row in one swipe.'
    );
  },
  lesson() {
    const i = SLICE.info,
      t = SLICE_TIERS[mini.tier],
      quota = 'Slice ' + mini.goal + ' in ' + mini.limit + ' seconds. ';
    return [
      {
        title: i.game + ' · gel school',
        goal: quota + 'Just slicing. It starts slow and picks up. Two pink bombs show up alone, with a warning, so you can meet them from a safe distance.',
        control: i.control,
        avoid: 'The pink bombs. Gremlins that drop off the bottom count, but slowly: ' + t.escapes + ' drops is one heart.',
        demo: 'slice',
        cue: i.cue
      },
      {
        title: i.game + ' · ' + mini.limit + ' second scan',
        goal: quota + 'New things arrive one at a time: blue ones split, helmets need two hits, then the pink bombs join in.',
        control: i.control,
        avoid: 'Pink bombs cost a heart and blow the screen clear. Later they hide in the rows. ' + t.escapes + ' drops is one heart.',
        demo: 'slice',
        cue: i.cue
      },
      {
        title: i.game + ' · ' + mini.limit + ' second scan',
        goal: quota + 'Everything at once, faster, and bombs hide in the lineup. Two short swipes beat one long one.',
        control: i.control,
        avoid: 'Pink bombs cost a heart. Purple laughing gas costs no heart, but it fogs the screen for two seconds. ' + t.escapes + ' drops is one heart.',
        demo: 'slice',
        cue: SLICE_GAS_CUE
      },
      {
        title: i.game + ' · Legendary',
        goal: quota + 'Fast tosses from the first second, both bombs hiding in the rows, and a short clock. Legends win this about one time in four.',
        control: i.control,
        avoid: 'Pink costs a heart, purple fogs the screen, ' + t.escapes + ' drops is a heart. The jumbo is your bonus round, so save some swipes.',
        demo: 'slice',
        cue: SLICE_GAS_CUE
      }
    ][mini.tier];
  },
  statLabel: () => 'SLICED / WAVE',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () =>
    'SCORE ' + mini.score + ' · BEST SWIPE ' + mini.maxCombo + ' · ' + mini.sliceCombos + ' COMBOS · ' + mini.helps + ' ASSISTS',
  assistText: () => 'GEL FREEZE · ' + mini.helps + ' (E)',
  // Quota overshoot, the best single swipe and the combo count drive the medal.
  quality() {
    const t = SLICE_TIERS[mini.tier],
      over = clamp((mini.got / mini.goal - 1) / 0.8, 0, 1),
      swipe = clamp((mini.maxCombo - 2) / 4, 0, 1),
      combos = clamp(mini.sliceCombos / t.combos, 0, 1);
    return Math.round(clamp(52 + over * 22 + swipe * 14 + combos * 12 - mini.miss * 6 - mini.helpUsed * 3, 0, 100));
  },
  onWin() {
    const best = mini.maxCombo >= 3 ? ' Best swipe: ' + mini.maxCombo + ' at once.' : '';
    return (
      'Scan complete. ' +
      mini.got +
      ' gremlins sliced.' +
      best +
      ' ' +
      pick([
        'The tech says the baby looks like gel. There is no baby.',
        'Sonar screen cleaned. Mostly. Some of it is load-bearing now.',
        'Fruit salad served. Nobody ordered it.',
        'Radiology would like its gel back. Radiology cannot have it.'
      ])
    );
  },
  onLose() {
    const hearts = mini.miss >= mini.rules.misses,
      bombs = mini.sliceBombs > 0 && mini.sliceBombs >= mini.sliceDropOops,
      gassed = !bombs && mini.sliceGas >= 2;
    for (let i = 0; i < 70; i++)
      gore.push({
        x: 400 + rand(-50, 50),
        y: 95,
        vx: rand(-360, 360),
        vy: rand(-250, 30),
        size: rand(4, 10),
        col: (bombs ? ['#ec86b0', '#f4b0cc', '#c55c8a'] : ['#9bd77f', '#86cfee', '#c7ee9a'])[i % 3]
      });
    return {
      gory: false,
      medal: '☹',
      heading: !hearts ? 'SCAN INCONCLUSIVE.' : bombs ? 'GEL NO.' : 'THEY GOT AWAY.',
      text: bombs
        ? 'The pink ones are bombs. Swipe around them, not through them, and wait for a clear line.'
        : gassed
          ? 'Too much laughing gas. The purple canisters are not gel. Two short swipes around them beat one long one through.'
          : 'Too many slid off the bottom. Catch them at the top of their hop, where they hang for a moment.'
    };
  },
  // The result art: gel halves on a win, a gloating, sticky gremlin on a loss.
  resultArt(g) {
    for (const p of gore) ellipse(g, p.x, p.y, p.size * 0.8, p.size * 0.7, p.col);
    if (mini.win) {
      for (let i = 0; i < mini.grade; i++) spark(g, 353 + i * 42, 44, '#fff0ab', 1.15);
      sliceStainArt(g, 600, 206, 34, '#9bd77f', 0.55, 3);
      for (const side of [-1, 1])
        sliceDrawHalf(g, { x: 600 + side * 26, y: 186, angle: side * 0.5, cut: 0.2, side, r: 31, art: 0, id: 4, col: '#9bd77f', life: 1 });
      label(g, 'SCAN RESULTS: EXTREMELY GEL', 400, 26, 11, '#426d62', 'center');
      return true;
    }
    for (let i = 0; i < 9; i++)
      sliceStainArt(g, (i * 173 + 60) % 780, 40 + ((i * 71) % 150), 16 + (i % 3) * 7, i % 2 ? '#9bd77f' : '#86cfee', 0.5, i * 5);
    gremlin(g, 630, 190, 1.5, 0, time);
    for (let k = 0; k < 4; k++) rr(g, 612 + k * 11, 128 + (k % 2) * 6, 6, 14 + k * 4, 3, '#86cfeecc');
    label(g, 'THE GREMLINS ARE GLOATING. STICKILY.', 400, 29, 12, '#dfe2b9', 'center');
    return true;
  },
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 0, 240, '#1c4645', '#0e2231'));
    path(
      g,
      p => {
        p.moveTo(210, 14);
        p.arc(210, 14, 250, Math.PI / 2 - 0.75, Math.PI / 2 + 0.75);
        p.closePath();
      },
      '#0d3a44'
    );
    for (const [x, y, c] of [[110, 150, '#9bd77f'], [300, 105, '#86cfee'], [250, 196, '#f3cf6e']])
      sliceStainArt(g, x, y, 20, c, 0.35, x);
    gremlin(g, 92, 150, 1.25, 0, time);
    gremlin(g, 300, 116, 1.25, 3, time + 2);
    for (const side of [-1, 1])
      sliceDrawHalf(g, { x: 196 + side * 14, y: 112 + side * 6, angle: side * 0.3, cut: -0.35, side, r: 30, art: 0, id: 7, col: '#9bd77f', life: 1 });
    sliceDrawBomb(g, { x: 365, y: 170, r: 24, angle: 0, id: 1 }, time);
    path(
      g,
      p => {
        p.moveTo(40, 180);
        p.quadraticCurveTo(190, 50, 340, 96);
      },
      null,
      '#ffffff55',
      12
    );
    path(
      g,
      p => {
        p.moveTo(40, 180);
        p.quadraticCurveTo(190, 50, 340, 96);
      },
      null,
      '#f8fff0',
      4
    );
    spark(g, 340, 96, '#ffffff', 0.8);
    label(g, '3 GEL COMBO', 196, 64, 15, '#ffe6a6', 'center');
    label(g, SLICE.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

// ---- The arena ----

// Canvas size, gravity and launch line for the active canvas. Gravity scales with the height, so a
// flight takes the same time on the square and the tall canvas.
function sliceArena() {
  const { w, h } = activeCanvas();
  return { W: w, H: h, G: (SLICE_G * h) / 600, launchY: h + 40, kx: w / 600, ky: h / 600 };
}

// The phone turned: stretch everything in flight onto the new canvas. Positions and velocities scale
// together (gravity scales with the height), so every flight keeps its timing.
function sliceFit() {
  const { w, h } = activeCanvas();
  if (!mini.sliceW || (mini.sliceW === w && mini.sliceH === h)) return;
  const kx = w / mini.sliceW,
    ky = h / mini.sliceH,
    fit = o => {
      if (!o) return;
      o.x *= kx;
      o.y *= ky;
      if (o.vx !== undefined) o.vx *= kx;
      if (o.vy !== undefined) o.vy *= ky;
      if (o.homeX !== undefined) o.homeX *= kx;
      if (o.homeY !== undefined) o.homeY *= ky;
    };
  for (const list of ['gels', 'sliceHalves', 'sliceDrops', 'sliceStains', 'slicePops', 'sliceSlashes', 'sliceTrail', 'sliceConfetti'])
    for (const o of mini[list]) fit(o);
  for (const q of mini.sliceQueue) fit(q.gel);
  for (const o of [mini.sliceRun, mini.sliceBanner, mini.sliceBoomFx, mini.sliceZoom]) fit(o);
  for (const o of mini.sliceWarns) o.x *= kx;
  mini.sliceW = w;
  mini.sliceH = h;
}

function sliceToPan(x) {
  return clamp((x / sliceArena().W) * 2 - 1, -1, 1) * 0.6;
}

// The camera: a bomb shakes it, a big combo punches in. Screen = zoom about (zx, zy), then shake.
function sliceCamera() {
  const z = mini.sliceZoom,
    k = z && !reduced ? z.s * Math.sin(Math.min(1, z.t) * Math.PI * 0.5) : 0,
    shake = !reduced && mini.sliceShake > 0 ? (mini.sliceShake / 0.5) * 13 : 0;
  return {
    s: 1 + k,
    zx: z ? z.x : 0,
    zy: z ? z.y : 0,
    sx: shake * Math.sin(mini.total * 97),
    sy: shake * Math.cos(mini.total * 83)
  };
}

// A finger point on screen to the arena under it, so cuts land on what the zoomed camera shows.
function sliceWorld(p) {
  const c = sliceCamera();
  return { x: c.zx + (p.x - c.sx - c.zx) / c.s, y: c.zy + (p.y - c.sy - c.zy) / c.s };
}

// ---- Spawning ----

// A gel aimed so its apex lands at (ax, ay): the launch speed comes from the apex height. A gel may
// carry its own gravity (`grav`, a share of the arena's): floaters drift, low tosses zip.
function sliceGel(kind, x0, ax, ay, extra = {}) {
  const A = sliceArena(),
    G = A.G * (extra.grav || 1),
    vy = -Math.sqrt(2 * G * Math.max(40, A.launchY - ay)),
    rise = -vy / G;
  return {
    id: mini.gelSerial++,
    kind,
    x: x0,
    y: A.launchY,
    vx: (ax - x0) / rise,
    vy,
    r: SLICE_KINDS[kind].r,
    hp: kind === 'helmet' ? 2 : 1,
    stroke: -1,
    lock: 0,
    angle: rand(-0.5, 0.5),
    spin: SLICE_KINDS[kind].hazard ? rand(-0.8, 0.8) : rand(-1.6, 1.6),
    entered: false,
    age: 0,
    ...extra
  };
}

// Where a gel will peak.
function sliceApex(o) {
  const G = sliceArena().G * (o.grav || 1),
    rise = Math.max(0, -o.vy / G);
  return { x: o.x + o.vx * rise, y: o.y + o.vy * rise + 0.5 * G * rise * rise };
}

// Apex points for a toss of n gels: {x0 launch x, ax/ay apex, delay, and optional grav and spin}.
// Small tosses: a single, a pair (split from one spot or side by side), a high lazy lob, a low fast
// one from the side, a slow floater, two arcs crossing from opposite corners. Formations: a row, an
// arc, a V, a diagonal, a drum roll, a fan from one spot, a criss-cross, a scatter.
function sliceFormation(kind, n) {
  const { W, H } = sliceArena(),
    gap = Math.max(84, W * rand(0.15, 0.19)),
    span = Math.min(W * 0.74, gap * Math.max(1, n - 1)),
    left = clamp(W / 2 - span / 2 + rand(-0.07, 0.07) * W, W * 0.13, W * 0.87 - span),
    flip = rand(0, 1) < 0.5 ? 1 : -1,
    baseY = H * rand(0.27, 0.4),
    src = W * rand(0.38, 0.62),
    order = [...Array(n).keys()],
    spots = [];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (kind === 'single') {
    const x0 = W * rand(0.14, 0.86);
    spots.push({ x0, ax: x0 + W * rand(-0.22, 0.22), ay: H * rand(0.22, 0.46), delay: 0 });
  } else if (kind === 'pair') {
    const ay = H * rand(0.24, 0.42);
    if (rand(0, 1) < 0.5) {
      // Two from one spot, splitting apart on the way up.
      const x0 = W * rand(0.32, 0.68),
        d = Math.max(70, W * rand(0.13, 0.19));
      for (const s of [-1, 1]) spots.push({ x0, ax: x0 + s * d, ay: ay + H * rand(-0.05, 0.05), delay: s > 0 ? rand(0, 0.15) : 0 });
    } else {
      // Side by side, one a beat behind the other.
      const c = W * rand(0.3, 0.7),
        d = Math.max(64, W * rand(0.12, 0.16));
      for (const s of [-1, 1])
        spots.push({ x0: c + s * d + rand(-20, 20), ax: c + s * d, ay: ay + H * rand(-0.04, 0.04), delay: s === flip ? 0.24 : 0 });
    }
  } else if (kind === 'lob') {
    // High and lazy: it hangs near the top of the glass and barely spins.
    for (let i = 0; i < n; i++) {
      const ax = n > 1 ? W * ((i ? flip > 0 : flip < 0) ? rand(0.62, 0.8) : rand(0.2, 0.38)) : W * rand(0.25, 0.75);
      spots.push({ x0: ax + W * rand(-0.14, 0.14), ax, ay: H * rand(0.16, 0.21), delay: i * 0.4, spin: rand(-0.5, 0.5) });
    }
  } else if (kind === 'low') {
    // Low and fast, from one side most of the way across, spinning hard. A second one trails it and
    // falls a little short.
    const reach = rand(0.56, 0.72);
    for (let i = 0; i < n; i++)
      spots.push({
        x0: flip < 0 ? W * rand(0.04, 0.12) : W * rand(0.88, 0.96),
        ax: flip < 0 ? W * (reach - i * 0.18) : W * (1 - reach + i * 0.18),
        ay: H * (rand(0.5, 0.58) - i * 0.07),
        delay: i * 0.3,
        grav: 1.3,
        spin: -flip * rand(3, 5)
      });
  } else if (kind === 'floater') {
    // A slow floater: half the gravity, so it drifts up and hangs.
    const x0 = W * rand(0.24, 0.76);
    spots.push({ x0, ax: x0 + W * rand(-0.12, 0.12), ay: H * rand(0.26, 0.4), delay: 0, grav: 0.5, spin: rand(-0.4, 0.4) });
  } else if (kind === 'cross') {
    // Two arcs from opposite corners that cross mid-screen.
    for (const s of [-1, 1])
      spots.push({
        x0: s < 0 ? W * rand(0.04, 0.14) : W * rand(0.86, 0.96),
        ax: s < 0 ? W * rand(0.6, 0.8) : W * rand(0.2, 0.4),
        ay: H * rand(0.24, 0.42),
        delay: s === flip ? 0 : rand(0.08, 0.22),
        spin: -s * rand(1.5, 3)
      });
  } else
    for (let i = 0; i < n; i++) {
      const ax = n > 1 ? left + (span * i) / (n - 1) : W / 2,
        u = n > 1 ? (2 * i) / (n - 1) - 1 : 0;
      if (kind === 'line') spots.push({ ax, ay: baseY, x0: ax + rand(-20, 20), delay: 0 });
      else if (kind === 'drum') spots.push({ ax, ay: baseY, x0: ax, delay: (flip > 0 ? i : n - 1 - i) * 0.16 });
      else if (kind === 'arc') spots.push({ ax, ay: baseY + flip * H * 0.1 * (u * u - 0.5), x0: ax + u * 30, delay: 0 });
      else if (kind === 'v') spots.push({ ax, ay: baseY + flip * H * 0.13 * (Math.abs(u) - 0.5), x0: ax - u * 25, delay: 0 });
      else if (kind === 'diag') spots.push({ ax, ay: baseY + flip * H * 0.11 * u, x0: ax + rand(-15, 15), delay: 0 });
      else if (kind === 'fan') spots.push({ ax, ay: baseY + H * rand(-0.06, 0.08), x0: src, delay: i * 0.1 });
      else if (kind === 'criss') {
        // Pairs from opposite corners; each side alternates a near and a far apex.
        const fromLeft = i % 2 === 0,
          reach = 0.18 * (Math.floor(i / 2) % 2) + rand(-0.025, 0.025);
        spots.push({
          ax: fromLeft ? W * (0.6 + reach) : W * (0.4 - reach),
          ay: H * rand(0.25, 0.45),
          x0: fromLeft ? W * rand(0.04, 0.16) : W * rand(0.84, 0.96),
          delay: Math.floor(i / 2) * 0.22,
          spin: fromLeft ? rand(1.5, 3) : -rand(1.5, 3)
        });
      } else {
        const sx = n > 1 ? left + (span * order[i]) / (n - 1) : W / 2;
        spots.push({ ax: sx + rand(-18, 18), ay: H * rand(0.24, 0.5), x0: sx + rand(-60, 60), delay: rand(0, 0.4) });
      }
    }
  for (const s of spots) {
    s.ax = clamp(s.ax, W * 0.1, W * 0.9);
    s.ay = clamp(s.ay, H * 0.16, H * 0.6);
    s.x0 = clamp(s.x0, W * 0.04, W * 0.96);
  }
  return spots;
}

function sliceQueueGel(o, delay, wave) {
  mini.sliceQueue.push({ delay, gel: o });
  wave.push(o);
  return o;
}

// The first gel of each kind on a level that teaches it carries a one-line callout.
function sliceHint(o, key) {
  if (mini.sliceSeen[key] || !SLICE_TIERS[mini.tier].hints.includes(key)) return o;
  mini.sliceSeen[key] = true;
  o.hint = SLICE_HINTS[key];
  return o;
}

const sliceLerp = (pair, k) => pair[0] + (pair[1] - pair[0]) * k;

// How hot the round is, 0 to 1: the level's ramp eased over the run up to the finale, plus combo heat.
function sliceTempo() {
  const t = SLICE_TIERS[mini.tier],
    u = clamp(mini.phaseTime / Math.max(1, mini.limit - SLICE_FINALE - 1.5), 0, 1);
  return clamp(sliceLerp(t.ramp, Math.pow(u, 1.15)) + mini.sliceHeat, 0, 1);
}

// The next toss: a formation or a small toss by the tempo, never the same one twice in a row.
function slicePickToss() {
  const tier = SLICE_TIERS[mini.tier],
    shift = mini.shift,
    big = rand(0, 1) < sliceLerp(tier.big, sliceTempo()),
    fresh = list => list.filter(k => k !== mini.sliceLastToss);
  let pool = fresh(big ? tier.forms[shift] : tier.small[shift]);
  if (!pool.length) pool = fresh(big ? tier.small[shift] : tier.forms[shift]);
  return pick(pool);
}

// How many gremlins a toss carries. Lobs and low ones come in twos once the round heats up.
function sliceTossSize(kind) {
  const k = sliceTempo();
  if (kind === 'single' || kind === 'floater') return 1;
  if (kind === 'pair' || kind === 'cross') return 2;
  if (kind === 'lob' || kind === 'low') return rand(0, 1) < k * 0.6 ? 2 : 1;
  return pick(SLICE_TIERS[mini.tier].size[mini.shift]);
}

// Which hazard: laughing gas from gasFrom on, at the level's share, else a pink bomb.
function sliceHazardKind() {
  const t = SLICE_TIERS[mini.tier];
  return mini.phaseTime >= t.gasFrom * mini.limit && rand(0, 1) < t.gas[mini.shift] ? 'gas' : 'bomb';
}

// A hazard on its way: a blinking marker at the bottom edge where it will rise, then the launch.
// The marker runs on the gremlins' clock, so slow motion stretches both together.
function sliceWarned(o, delay, wave) {
  mini.sliceWarns.push({ x: o.x, t: delay, max: delay, kind: o.kind });
  sfx('lock', { vol: 0.7, pan: sliceToPan(o.x) });
  return sliceQueueGel(o, delay, wave);
}

// Launches the next toss (during a frenzy: one party gel). Returns every gel it created.
function spawnGelWave() {
  if (mini.sliceFrenzy > 0) return sliceFrenzyVolley();
  const tier = SLICE_TIERS[mini.tier],
    shift = mini.shift,
    { W, H } = sliceArena(),
    wave = [],
    first = mini.sliceWaves === 0 && tier.hints.includes('first'),
    toss = first ? 'line' : slicePickToss(),
    n = first ? 3 : sliceTossSize(toss),
    spots = sliceFormation(toss, n);
  mini.sliceWaves++;
  mini.sliceLastToss = toss;
  mini.sliceTosses.push(toss);
  if (mini.sliceTosses.length > 200) mini.sliceTosses.shift();
  // A hazard rides along on some tosses. The first of each kind always flies clear, with a warning;
  // after that, some hide in a formation, where one long swipe along the row would cross them.
  const hazard = !first && mini.limit - mini.phaseTime > 3 && rand(0, 1) < tier.bombs[shift] ? sliceHazardKind() : null,
    teach = hazard && !mini.sliceMet[hazard],
    inLine = hazard && !teach && SLICE_LINEUPS.includes(toss) && n >= 3 && rand(0, 1) < tier.inLine[shift],
    // It takes a spot inside the row, never an end, so one swipe along the whole row crosses it.
    hazSpot = inLine ? pick([...spots.keys()].sort((a, b) => spots[a].ax - spots[b].ax).slice(1, -1)) : -1;
  spots.forEach((s, i) => {
    const extra = {};
    if (s.grav) extra.grav = s.grav;
    if (s.spin !== undefined) extra.spin = s.spin;
    if (i === hazSpot) {
      mini.sliceMet[hazard] = true;
      sliceQueueGel(sliceHint(sliceGel(hazard, s.x0, s.ax, s.ay), hazard), s.delay, wave);
      return;
    }
    const roll = rand(0, 1),
      helmet = mini.phaseTime >= tier.helmetFrom * mini.limit ? tier.helmet[shift] : 0,
      kind = roll < tier.blue[shift] ? 'blue' : roll < tier.blue[shift] + helmet ? 'helmet' : 'plain',
      o = sliceGel(kind, s.x0, s.ax, s.ay, extra);
    if (kind !== 'plain') sliceHint(o, kind);
    sliceQueueGel(o, s.delay, wave);
  });
  if (first) mini.sliceGuide = wave.map(o => o.id);
  if (mini.sliceGoldAt.length && mini.phaseTime >= mini.sliceGoldAt[0]) {
    mini.sliceGoldAt.shift();
    const fromLeft = rand(0, 1) < 0.5,
      o = sliceGel('gold', fromLeft ? W * 0.08 : W * 0.92, W * (fromLeft ? rand(0.55, 0.72) : rand(0.28, 0.45)), H * rand(0.2, 0.28), {
        spin: 5
      });
    sliceQueueGel(sliceHint(o, 'gold'), 0.35, wave);
  }
  // Hazards that are not in the lineup keep well clear of every gremlin's apex.
  if (hazard && !inLine) {
    const count = mini.tier >= 2 && shift === 2 && !teach && rand(0, 1) < (mini.tier === 3 ? 0.45 : 0.35) ? 2 : 1,
      taken = spots.map(s => s.ax);
    for (let k = 0; k < count; k++) {
      let best = null;
      for (let c = 0; c < 13; c++) {
        const x = W * (0.12 + (0.76 * c) / 12),
          d = Math.min(...taken.map(t => Math.abs(t - x)));
        if (!best || d > best.d) best = { x, d };
      }
      if (best.d < Math.max(W * 0.2, 105)) break;
      taken.push(best.x);
      const kind = k ? sliceHazardKind() : hazard,
        ay = clamp(spots[0].ay + H * (rand(0, 1) < 0.5 ? -0.1 : 0.1), H * 0.2, H * 0.55),
        o = sliceGel(kind, clamp(best.x + rand(-30, 30), W * 0.06, W * 0.94), best.x, ay),
        warned = !mini.sliceMet[kind];
      mini.sliceMet[kind] = true;
      sliceHint(o, kind);
      if (warned) sliceWarned(o, 0.75 * sliceRate(), wave);
      else sliceQueueGel(o, rand(0.25, 0.45), wave);
    }
  }
  return wave;
}

// Level 1 meets its bombs alone, center stage, with nothing else in the air and a warning first.
function sliceLoneBomb() {
  const { W, H } = sliceArena(),
    wave = [];
  mini.sliceLoneAt.shift();
  mini.sliceMet.bomb = true;
  const o = sliceGel('bomb', W * rand(0.38, 0.62), W * rand(0.42, 0.58), H * rand(0.3, 0.38));
  mini.sliceLoneId = o.id;
  sliceWarned(sliceHint(o, 'bomb'), SLICE_TIERS[mini.tier].warn * sliceRate(), wave);
  return wave;
}

// Frenzy: one party gel at a time from alternating lower corners, never a bomb, never a drop.
function sliceFrenzyVolley() {
  const { W, H } = sliceArena(),
    wave = [],
    side = (mini.sliceFrenzySide = -mini.sliceFrenzySide || 1),
    x0 = side < 0 ? W * rand(0.04, 0.14) : W * rand(0.86, 0.96),
    o = sliceGel('plain', x0, W / 2 - side * W * rand(0.02, 0.32), H * rand(0.2, 0.48), { frenzy: true });
  sliceQueueGel(o, 0, wave);
  return wave;
}

// The finale: the jumbo gel rises to the middle and hangs there to be swiped.
function sliceJumbo() {
  const { W, H } = sliceArena(),
    wave = [];
  mini.sliceJumboDue = false;
  mini.sliceJumboWait = 0;
  sliceQueueGel(sliceHint(sliceGel('jumbo', W / 2, W / 2, H * 0.4, { spin: 0, angle: 0, hits: 0 }), 'jumbo'), 0, wave);
  return wave;
}

// Every hazard in the air or on its way fizzles: the frenzy and the freeze.
function sliceDefuse() {
  for (const o of mini.gels) if (SLICE_KINDS[o.kind].hazard && !o.dead) slicePoof(o);
  mini.sliceQueue = mini.sliceQueue.filter(q => !SLICE_KINDS[q.gel.kind].hazard);
  mini.sliceWarns = [];
}

function sliceStartFrenzy(gold) {
  mini.sliceFrenzy = SLICE_FRENZY;
  mini.sliceFrenzyClock = 0.25;
  mini.sliceFrenzies++;
  mini.sliceParty = true;
  mini.sliceMeter = 0;
  sliceDefuse();
  mini.flash = 1.4;
  mini.flashText = gold ? 'GOLD · GEL FRENZY · DOUBLE POINTS' : 'PARTY METER FULL · GEL FRENZY · DOUBLE POINTS';
  sfx('fever');
  sfx('powerup');
}

// ---- Slicing ----

function pointSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function sliceTrailPoint(p) {
  mini.sliceTrail.push({ x: p.x, y: p.y, life: SLICE_TRAIL, stroke: mini.pointer ? mini.pointer.stroke : 0 });
  if (mini.sliceTrail.length > 48) mini.sliceTrail.shift();
}

// One blade segment: cuts every gel it crosses (once per stroke), each by its own rules.
function sliceSegment(a, b) {
  if (!mini.pointer) return;
  const stroke = mini.pointer.stroke,
    A = sliceWorld(a),
    B = sliceWorld(b),
    { H } = sliceArena(),
    len = Math.hypot(B.x - A.x, B.y - A.y);
  if (len > 0.5) mini.sliceLastAng = Math.atan2(B.y - A.y, B.x - A.x);
  const ang = mini.sliceLastAng;
  for (const o of [...mini.gels]) {
    if (o.dead || o.blown || o.y - o.r > H) continue;
    const d = pointSegment(o, A, B);
    if (o.kind === 'jumbo') {
      sliceJumboPass(o, d, len, stroke, ang, B);
      continue;
    }
    if (SLICE_KINDS[o.kind].hazard) {
      // A press is not a swipe, and a near miss is free: hazards only go off well inside.
      if (len >= 3 && d <= o.r - SLICE_BOMB_GRACE) {
        if (o.kind === 'gas') sliceGasPop(o);
        else sliceBoom(o);
      }
      continue;
    }
    if (d > o.r + SLICE_REACH || o.stroke === stroke) continue;
    o.stroke = stroke;
    if (o.hp > 1) {
      sliceCrack(o, ang);
      continue;
    }
    sliceCut(o, ang, stroke);
  }
}

// A helmet pops off; the gremlin under it can be cut a moment later, even by the same stroke.
function sliceCrack(o, ang) {
  o.hp = 1;
  o.lock = 0.1;
  o.vy = Math.min(o.vy, 0) - 60 * sliceArena().ky;
  mini.sliceHalves.push({
    helmet: true,
    x: o.x,
    y: o.y - o.r * 0.6,
    vx: Math.cos(ang) * 160,
    vy: -380 * sliceArena().ky,
    angle: 0,
    spin: rand(-9, 9),
    r: o.r,
    life: 1
  });
  slicePop('CLANG', o.x, o.y - o.r - 10, '#dfe8e4', 16);
  sliceSplash(o.x, o.y - o.r * 0.5, ang, '#dfe8e4', 5, 0.7);
  sfx('ricochet', { pan: sliceToPan(o.x) });
}

function sliceCut(o, ang, stroke) {
  o.dead = true;
  const k = SLICE_KINDS[o.kind],
    mult = mini.sliceFrenzy > 0 ? 2 : 1,
    pts = k.pts * mult;
  mini.got++;
  mini.sliceCuts++;
  mini.score += pts;
  // Cuts close together in one stroke build a combo; the stroke banks it.
  const run = mini.sliceRun;
  if (run && run.stroke === stroke && mini.total - run.last <= SLICE_COMBO_GAP) {
    run.n++;
    run.last = mini.total;
    run.x += (o.x - run.x) / run.n;
    run.y += (o.y - run.y) / run.n;
    run.tx = o.x;
    run.ty = o.y;
  } else {
    sliceBank();
    mini.sliceRun = { stroke, n: 1, last: mini.total, x: o.x, y: o.y, tx: o.x, ty: o.y };
  }
  const n = mini.sliceRun.n;
  slicePop('+' + pts, o.x, o.y - o.r - 8, mult > 1 ? '#ffe08a' : '#f4ffe6', 15 + Math.min(4, n));
  sliceHalves(o, ang);
  sliceSplash(o.x, o.y, ang, k.col, o.kind === 'kid' ? 7 : 12, 1);
  sliceStain(o.x, o.y, o.r * rand(0.85, 1.15), k.col);
  mini.sliceSlashes.push({ x: o.x, y: o.y, ang, r: o.r * 1.5, t: 0.14 });
  sfx('slice', { combo: n - 1, pan: sliceToPan(o.x) });
  sfx('squelch', { vol: 0.45, pan: sliceToPan(o.x) });
  if (o.kind === 'blue') sliceKids(o, stroke);
  if (o.kind === 'gold') sliceStartFrenzy(true);
}

// Blue gremlins split into two kids that hop out of the cut. They are a bonus, never a drop.
function sliceKids(o, stroke) {
  const { kx, ky } = sliceArena();
  for (const side of [-1, 1])
    mini.gels.push({
      id: mini.gelSerial++,
      kind: 'kid',
      x: o.x + side * 16,
      y: o.y,
      vx: (o.vx || 0) * 0.3 + side * 120 * kx,
      vy: -430 * ky,
      r: SLICE_KINDS.kid.r,
      hp: 1,
      stroke,
      lock: 0.15,
      angle: 0,
      spin: side * 3,
      entered: true,
      age: 0
    });
  sfx('split', { pan: sliceToPan(o.x) });
}

// The jumbo counts a hit each time the blade enters it, and again for every long scribble inside it,
// at most one hit per SLICE_JUMBO_GAP.
function sliceJumboPass(o, d, len, stroke, ang, at) {
  if (o.passStroke !== stroke) {
    o.passStroke = stroke;
    o.bladeIn = false;
  }
  if (d > o.r + 10) {
    o.bladeIn = false;
    return;
  }
  if (d > o.r) return;
  const ready = mini.total - (o.lastHit === undefined ? -1 : o.lastHit) >= SLICE_JUMBO_GAP;
  if (!o.bladeIn) {
    o.bladeIn = true;
    o.travel = 0;
    if (ready) sliceJumboHit(o, ang, at);
    return;
  }
  o.travel = (o.travel || 0) + len;
  if (o.travel >= o.r * 1.6 && ready) {
    o.travel = 0;
    sliceJumboHit(o, ang, at);
  }
}

function sliceJumboHit(o, ang, at) {
  if (o.dead) return;
  const mult = mini.sliceFrenzy > 0 ? 2 : 1;
  o.hits++;
  o.lastHit = mini.total;
  o.jiggle = 1;
  mini.got++;
  mini.sliceJumboHits++;
  mini.score += SLICE_KINDS.jumbo.pts * mult;
  sliceSplash(at.x, at.y, ang, SLICE_KINDS.jumbo.col, 8, 1.1);
  sliceStain(at.x + rand(-30, 30), at.y + rand(-30, 30), rand(16, 28), SLICE_KINDS.jumbo.col);
  mini.sliceSlashes.push({ x: at.x, y: at.y, ang, r: 46, t: 0.12 });
  sfx('slice', { combo: Math.min(12, o.hits), pan: sliceToPan(o.x) });
  sfx('squelch', { vol: 0.5 });
  if (o.hits >= SLICE_JUMBO_MAX) sliceJumboEnd(o);
}

// The hover ends (or the jumbo maxes out): it bursts for a bonus if it was swiped at all.
function sliceJumboEnd(o) {
  mini.sliceJumboDone = true;
  mini.sliceLull = null;
  mini.spawn = Math.min(mini.spawn, 0.5);
  if (!o.hits) {
    o.hover = 0;
    slicePop('IT GOT BORED', o.x, o.y - o.r - 14, '#cfe3d6', 16);
    return;
  }
  o.dead = true;
  const mult = mini.sliceFrenzy > 0 ? 2 : 1,
    bonus = o.hits * 20 * mult;
  mini.score += bonus;
  mini.sliceBanner = { text: 'JUMBO ×' + o.hits, sub: '+' + bonus, x: o.x, y: o.y, t: 1.3, max: 1.3 };
  sliceSplash(o.x, o.y, 0, SLICE_KINDS.jumbo.col, 30, 1.8);
  sliceSplash(o.x, o.y, Math.PI / 2, '#c7ee9a', 20, 1.5);
  sliceStain(o.x, o.y, o.r * 1.1, SLICE_KINDS.jumbo.col);
  mini.sliceSlowmo = 0.35;
  if (!reduced) mini.sliceZoom = { x: o.x, y: o.y, t: 1, s: 0.06 };
  sfx('clear');
}

// Bank the stroke's combo: three or more pays a bonus, fills the party meter and gets a banner;
// four or more adds a beat of slow motion and a zoom.
function sliceBank() {
  const run = mini.sliceRun;
  mini.sliceRun = null;
  if (!run || run.n < 2) return;
  const n = run.n;
  mini.maxCombo = Math.max(mini.maxCombo, n);
  if (n < 3) {
    slicePop('DOUBLE', run.tx, run.ty - 44, '#d9f7c8', 15);
    return;
  }
  const mult = mini.sliceFrenzy > 0 ? 2 : 1,
    bonus = 5 * n * (n - 1) * mult;
  mini.score += bonus;
  mini.sliceCombos++;
  mini.sliceBanner = { text: n + ' GEL COMBO', sub: '+' + bonus, x: run.x, y: run.y, t: 1.1, max: 1.1 };
  sfx('combo', { count: n });
  if (n >= 4) {
    mini.sliceSlowmo = Math.min(0.9, 0.45 + 0.12 * (n - 4));
    if (!reduced) mini.sliceZoom = { x: run.x, y: run.y, t: 1, s: Math.min(0.1, 0.05 + 0.015 * (n - 4)) };
  }
  if (mini.sliceFrenzy <= 0) {
    mini.sliceMeter += n - 2;
    // A combo heats the round up: the tempo rises for a while and the next toss comes sooner.
    mini.sliceHeat = Math.min(0.3, mini.sliceHeat + 0.05 * (n - 1));
    if (mini.sliceLull) mini.sliceLull.beat *= 0.6;
    else mini.spawn = Math.min(mini.spawn, sliceLerp(SLICE_TIERS[mini.tier].quick, sliceTempo()));
    if (mini.sliceMeter >= SLICE_TIERS[mini.tier].meter) sliceStartFrenzy(false);
  }
}

function sliceBoom(o) {
  o.dead = true;
  mini.sliceBombs++;
  mini.sliceRun = null;
  mini.sliceMeter = 0;
  const { W, H, kx, ky } = sliceArena();
  mini.sliceShake = 0.5;
  mini.sliceBoomFx = { x: o.x, y: o.y, t: 0.6 };
  // The blast clears the screen: everything still up flies off, no cuts, no drops.
  for (const e of mini.gels) {
    if (e.dead || e.kind === 'bomb' || e.kind === 'jumbo' || e.y > H) continue;
    const dx = e.x - o.x,
      dy = e.y - o.y,
      d = Math.hypot(dx, dy) || 1;
    e.blown = true;
    e.vx = (dx / d) * 650 * kx;
    e.vy = (dy / d) * 400 * ky - 300 * ky;
    e.spin = (dx < 0 ? -1 : 1) * 12;
  }
  sliceStain(o.x, o.y, 70, '#ec86b0');
  sliceSplash(o.x, o.y, 0, '#ec86b0', 24, 2);
  sfx('bomb');
  mini.flash = 1;
  mini.flashText = 'PINK BOMB · THAT ONE WAS NOT GEL';
  // Applied on the next update: an oops that ends the run lifts the pointer, and the stroke (and the
  // framework's move handler) must finish first.
  mini.sliceOopsQueue.push(mini.flashText);
  if (o.x < 0 || o.x > W) mini.sliceBoomFx.x = clamp(o.x, 0, W);
}

// Laughing gas: no heart and no blast, but the stroke's combo is gone and a giggly fog rolls over the
// screen for two seconds. Everything keeps flying under it, faintly; the bombs still glow through.
function sliceGasPop(o) {
  o.dead = true;
  mini.sliceGas++;
  mini.sliceRun = null;
  mini.sliceFog = SLICE_FOG;
  sliceSplash(o.x, o.y, 0, '#c9b6ff', 18, 1.4);
  slicePop('HEE HEE HEE', o.x, o.y - o.r - 10, '#e3d8ff', 18);
  mini.flash = 1;
  mini.flashText = 'LAUGHING GAS · NO HEART · JUST GIGGLES AND FOG';
  sfx('pump', { pan: sliceToPan(o.x) });
  sfx('stun', { vol: 0.8 });
}

// A hazard defused by a frenzy or the freeze: a harmless puff.
function slicePoof(o) {
  o.dead = true;
  sliceSplash(o.x, o.y, 0, '#c9c2cf', 10, 0.8);
  slicePop('FIZZ', o.x, o.y - o.r - 8, '#e5dbe9', 14);
}

function sliceEscape(o) {
  const tier = SLICE_TIERS[mini.tier],
    { W, H } = sliceArena();
  mini.sliceEscapes++;
  mini.sliceDropped++;
  slicePop('DROPPED', clamp(o.x, 60, W - 60), H - 52, '#ffb3a8', 14);
  sfx('blob', { vol: 0.35, pan: sliceToPan(o.x) });
  if (mini.sliceEscapes >= tier.escapes) {
    mini.sliceEscapes = 0;
    mini.sliceDropOops++;
    miniOops(tier.escapes + ' DROPPED · CATCH THEM AT THE TOP OF THE HOP');
  }
}

// ---- Juice ----

function slicePop(text, x, y, col = '#f4ffe6', size = 15) {
  const { W } = sliceArena();
  mini.slicePops.push({ text, x: clamp(x, 40, W - 40), y: Math.max(70, y), life: 0.8, max: 0.8, col, size });
  if (mini.slicePops.length > 14) mini.slicePops.shift();
}

function sliceStain(x, y, r, col) {
  mini.sliceStains.push({ x, y, r, col, life: 2.6, max: 2.6, seed: mini.gelSerial * 7 + mini.sliceStains.length, drip: rand(0.5, 1.4) });
  if (mini.sliceStains.length > 26) mini.sliceStains.shift();
}

// Gel droplets spray out on both sides of the cut and a little along it.
function sliceSplash(x, y, ang, col, n, power = 1) {
  const { kx, ky } = sliceArena();
  for (let i = 0; i < n; i++) {
    const side = i % 3 === 2 ? 0 : i % 3 ? 1 : -1,
      a = side ? ang + side * (Math.PI / 2) + rand(-0.8, 0.8) : ang + rand(-0.35, 0.35),
      sp = rand(90, 330) * power;
    mini.sliceDrops.push({
      x,
      y,
      vx: Math.cos(a) * sp * kx,
      vy: Math.sin(a) * sp * ky - 70 * ky,
      r: rand(2.5, 6.5),
      col,
      life: rand(0.45, 0.85)
    });
  }
  if (mini.sliceDrops.length > 160) mini.sliceDrops.splice(0, mini.sliceDrops.length - 160);
}

// Two halves fly apart across the cut line, each keeping its half of the face.
function sliceHalves(o, ang) {
  const { kx, ky } = sliceArena(),
    k = SLICE_KINDS[o.kind],
    nx = -Math.sin(ang),
    ny = Math.cos(ang);
  for (const side of [-1, 1])
    mini.sliceHalves.push({
      x: o.x + nx * side * 5,
      y: o.y + ny * side * 5,
      vx: (o.vx || 0) * 0.4 + nx * side * 150 * kx,
      vy: Math.min(o.vy || 0, 0) * 0.25 + ny * side * 150 * ky - 120 * ky,
      angle: o.angle || 0,
      spin: side * rand(2.5, 4.5),
      cut: ang - (o.angle || 0),
      side,
      r: o.r,
      art: k.art,
      id: o.id,
      col: k.col,
      life: 1.2
    });
  if (mini.sliceHalves.length > 40) mini.sliceHalves.splice(0, mini.sliceHalves.length - 40);
}

// ---- Update ----

function updateSlice(dt) {
  sliceFit();
  while (mini.sliceOopsQueue.length) {
    miniOops(mini.sliceOopsQueue.shift());
    if (mini.screen !== 'play') return;
  }
  const A = sliceArena();
  mini.sliceFrenzy = Math.max(0, mini.sliceFrenzy - dt);
  mini.sliceSlowmo = Math.max(0, mini.sliceSlowmo - dt);
  mini.sliceShake = Math.max(0, mini.sliceShake - dt);
  mini.sliceFog = Math.max(0, mini.sliceFog - dt);
  mini.sliceHeat = Math.max(0, mini.sliceHeat - dt * 0.03);
  if (mini.sliceZoom) {
    mini.sliceZoom.t -= dt * 1.8;
    if (mini.sliceZoom.t <= 0) mini.sliceZoom = null;
  }
  // Slow motion slows the gremlins, never the clock.
  const slow = mini.sliceSlowmo > 0 ? 0.3 : mini.slow > 0 ? 0.5 : 1,
    step = dt * sliceRate();
  if (mini.sliceRun && mini.total - mini.sliceRun.last > SLICE_COMBO_GAP) sliceBank();
  sliceSpawns(dt * slow);
  for (const q of mini.sliceQueue) {
    q.delay -= step;
    if (q.delay <= 0) mini.gels.push(q.gel);
  }
  mini.sliceQueue = mini.sliceQueue.filter(q => q.delay > 0);
  for (const w of mini.sliceWarns) w.t -= step;
  mini.sliceWarns = mini.sliceWarns.filter(w => w.t > 0);
  for (const o of mini.gels) {
    if (o.dead) continue;
    o.age += step;
    if (o.lock > 0) {
      o.lock -= dt;
      if (o.lock <= 0) o.stroke = -1;
    }
    if (o.kind === 'jumbo') {
      sliceUpdateJumbo(o, dt * slow, step, A);
      continue;
    }
    o.vy += A.G * (o.grav || 1) * step;
    o.x += o.vx * step;
    o.y += o.vy * step;
    o.angle += o.spin * step;
    if (!o.entered && o.y < A.H - o.r) o.entered = true;
    if (o.blown) {
      if (o.y > A.H + 90 || o.x < -90 || o.x > A.W + 90) o.dead = true;
      continue;
    }
    if (o.y > A.H + o.r + 24 && o.vy > 0) {
      o.dead = true;
      if (!o.entered || o.frenzy) continue;
      if (o.kind === 'gold') slicePop('GOLD GOT AWAY', o.x, A.H - 52, '#f3cf6e', 15);
      else if (o.kind === 'plain' || o.kind === 'blue' || o.kind === 'helmet') sliceEscape(o);
      if (mini.screen !== 'play') return;
    }
    if ((o.x < o.r * 0.7 && o.vx < 0) || (o.x > A.W - o.r * 0.7 && o.vx > 0)) o.vx *= -0.7;
  }
  mini.gels = mini.gels.filter(o => !o.dead);
  sliceUpdateEffects(dt, step, A);
}

// How fast the gremlins fly right now: the level's speed, the prescription (softened, since flight
// speed is the steepest lever there is), slow motion and the freeze. The tall canvas runs a touch
// slower: its flights cover more of the glass in the same time.
function sliceRate() {
  const slow = mini.sliceSlowmo > 0 ? 0.3 : mini.slow > 0 ? 0.5 : 1,
    tall = mini.portrait ? 0.97 : 1;
  return SLICE_TIERS[mini.tier].speed * Math.sqrt(mini.rules.mini) * slow * tall;
}

// The director. Tosses come in bursts and every burst ends on a breath: the screen clears, then a beat
// of nothing. The tempo (the level's ramp plus combo heat) shortens the gaps and the breaths and makes
// the bursts longer and the tosses bigger. A frenzy streams party gels instead and ends on a breath;
// the finale clears the decks for the jumbo.
function sliceSpawns(dt) {
  const tier = SLICE_TIERS[mini.tier],
    left = mini.limit - mini.phaseTime,
    alive = mini.gels.some(o => !o.dead && !o.blown && !SLICE_KINDS[o.kind].hazard) || mini.sliceQueue.length > 0;
  if (!mini.sliceJumboDone && !mini.sliceJumboDue && left <= SLICE_FINALE && !mini.gels.some(o => o.kind === 'jumbo')) {
    mini.sliceJumboDue = true;
    mini.sliceJumboWait = 0;
  }
  if (mini.sliceJumboDue) {
    mini.sliceJumboWait += dt;
    if ((!alive && mini.sliceFrenzy <= 0) || mini.sliceJumboWait > 1.8) sliceJumbo();
    return;
  }
  if (mini.gels.some(o => o.kind === 'jumbo' && !o.dead && o.hover !== 0)) return;
  if (mini.sliceFrenzy > 0) {
    mini.sliceFrenzyClock -= dt;
    if (mini.sliceFrenzyClock <= 0 && left > 2.6) {
      sliceFrenzyVolley();
      mini.sliceFrenzyClock = 0.2;
    }
    return;
  }
  if (mini.sliceParty) {
    // The party is over: catch your breath.
    mini.sliceParty = false;
    sliceBreathe(0.7);
  }
  // Level 1's bombs wait for a clear screen and fly alone; the tosses wait until each one is gone.
  if (mini.sliceLoneAt.length && mini.phaseTime >= mini.sliceLoneAt[0]) {
    if (left <= 6) mini.sliceLoneAt = [];
    else if (!alive) sliceLoneBomb();
    return;
  }
  if (mini.sliceLoneId !== null) {
    if (mini.gels.some(o => o.id === mini.sliceLoneId) || mini.sliceQueue.some(q => q.gel.id === mini.sliceLoneId)) return;
    mini.sliceLoneId = null;
    mini.sliceLull = { held: SLICE_HOLD, beat: 0.5 };
  }
  if (mini.phaseTime < mini.sliceRestUntil) return;
  if (mini.sliceLull) {
    const l = mini.sliceLull;
    l.held += dt;
    if (alive && l.held < SLICE_HOLD) return;
    l.beat -= dt;
    if (l.beat > 0) return;
    mini.sliceLull = null;
    mini.spawn = 0;
  }
  mini.spawn -= dt;
  const k = sliceTempo(),
    quick = sliceLerp(tier.quick, k);
  if (!alive && mini.spawn > quick) mini.spawn = quick;
  if (mini.spawn > 0 || left <= 2.6) return;
  spawnGelWave();
  if (--mini.sliceBurst > 0) mini.spawn = (sliceLerp(tier.gap, k) * rand(0.85, 1.2)) / mini.rules.mini;
  else sliceBreathe(1);
}

// End the burst: roll the next one's length and hold a breath (scaled by `share`) once the screen clears.
function sliceBreathe(share) {
  const tier = SLICE_TIERS[mini.tier],
    k = sliceTempo(),
    lo = sliceLerp([tier.burst[0][0], tier.burst[1][0]], k),
    hi = sliceLerp([tier.burst[0][1], tier.burst[1][1]], k);
  mini.sliceBurst = Math.max(1, Math.round(rand(lo, hi)));
  mini.sliceLull = { held: 0, beat: (sliceLerp(tier.breath, k) * rand(0.85, 1.25) * share) / mini.rules.mini };
}

function sliceUpdateJumbo(o, dt, step, A) {
  o.jiggle = Math.max(0, (o.jiggle || 0) - dt * 3);
  if (o.hover === undefined) {
    o.vy += A.G * step;
    o.x += o.vx * step;
    o.y += o.vy * step;
    if (o.y < A.H - o.r) o.entered = true;
    if (o.vy >= 0) {
      o.hover = SLICE_HOVER;
      o.vy = 0;
      o.homeX = o.x;
      o.homeY = o.y;
    }
    return;
  }
  if (o.hover > 0) {
    o.hover = Math.max(0, o.hover - dt);
    o.x = o.homeX + Math.sin(o.age * 2.2) * 14 * A.kx;
    o.y = o.homeY + Math.sin(o.age * 3.1) * 8 * A.ky;
    if (o.hover === 0) sliceJumboEnd(o);
    return;
  }
  o.vy += A.G * step;
  o.y += o.vy * step;
  if (o.y > A.H + o.r + 30) o.dead = true;
}

function sliceUpdateEffects(dt, step, A) {
  for (const h of mini.sliceHalves) {
    h.vy += A.G * step;
    h.x += h.vx * step;
    h.y += h.vy * step;
    h.angle += h.spin * step;
    h.life -= dt;
  }
  mini.sliceHalves = mini.sliceHalves.filter(h => h.life > 0 && h.y < A.H + 120);
  for (const d of mini.sliceDrops) {
    d.vy += A.G * 0.8 * step;
    d.x += d.vx * step;
    d.y += d.vy * step;
    d.life -= dt;
  }
  mini.sliceDrops = mini.sliceDrops.filter(d => d.life > 0);
  for (const s of mini.sliceStains) s.life -= dt;
  mini.sliceStains = mini.sliceStains.filter(s => s.life > 0);
  for (const p of mini.slicePops) {
    p.life -= dt;
    p.y -= 34 * dt;
  }
  mini.slicePops = mini.slicePops.filter(p => p.life > 0);
  for (const s of mini.sliceSlashes) s.t -= dt;
  mini.sliceSlashes = mini.sliceSlashes.filter(s => s.t > 0);
  for (const p of mini.sliceTrail) p.life -= dt;
  mini.sliceTrail = mini.sliceTrail.filter(p => p.life > 0);
  if (mini.sliceBanner) {
    mini.sliceBanner.t -= dt;
    if (mini.sliceBanner.t <= 0) mini.sliceBanner = null;
  }
  if (mini.sliceBoomFx) {
    mini.sliceBoomFx.t -= dt;
    if (mini.sliceBoomFx.t <= 0) mini.sliceBoomFx = null;
  }
  // Frenzy confetti drifts down from the top.
  if (mini.sliceFrenzy > 0 && !reduced && mini.sliceConfetti.length < 70)
    for (let i = 0; i < 2; i++)
      mini.sliceConfetti.push({
        x: rand(0, A.W),
        y: rand(-20, 30),
        vx: rand(-40, 40),
        vy: rand(80, 170),
        a: rand(0, 6),
        spin: rand(-8, 8),
        col: pick(['#ffe08a', '#ff9fc4', '#9fe3ff', '#b9f28a', '#ffffff']),
        life: rand(1.6, 2.6)
      });
  for (const c of mini.sliceConfetti) {
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.a += c.spin * dt;
    c.life -= dt;
  }
  mini.sliceConfetti = mini.sliceConfetti.filter(c => c.life > 0 && c.y < A.H + 20);
  if (mini.sliceGuide && (mini.sliceCuts > 0 || (!mini.gels.some(o => mini.sliceGuide.includes(o.id)) && !mini.sliceQueue.length)))
    mini.sliceGuide = null;
}

// ---- Art ----

function sliceHash(n) {
  const s = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
}

function sliceStainArt(g, x, y, r, col, alpha, seed, drip = 0) {
  g.globalAlpha = alpha;
  ellipse(g, x, y, r, r * 0.82, col);
  for (let k = 0; k < 6; k++) {
    const a = sliceHash(seed + k) * Math.PI * 2,
      d = r * (0.8 + sliceHash(seed + k + 9) * 0.9),
      s = r * (0.12 + sliceHash(seed + k + 20) * 0.22);
    ellipse(g, x + Math.cos(a) * d, y + Math.sin(a) * d, s, s, col);
  }
  if (drip > 0) {
    const dx = x + (sliceHash(seed + 31) - 0.5) * r;
    rr(g, dx - 3, y, 6, drip, 3, col);
    ellipse(g, dx, y + drip, 4.5, 5.5, col);
  }
  // A wet shine, so it reads as gel on glass rather than a puddle.
  g.globalAlpha = alpha * 0.9;
  ellipse(g, x - r * 0.3, y - r * 0.3, r * 0.32, r * 0.16, '#ffffff');
  g.globalAlpha = 1;
}

function drawSlice(g) {
  sliceFit();
  const { W, H } = sliceArena(),
    cam = sliceCamera();
  sliceBackdrop(g, W, H);
  g.save();
  g.translate(cam.sx, cam.sy);
  g.translate(cam.zx, cam.zy);
  g.scale(cam.s, cam.s);
  g.translate(-cam.zx, -cam.zy);
  for (const s of mini.sliceStains)
    sliceStainArt(g, s.x, s.y, s.r, s.col, (s.life / s.max) * 0.5, s.seed, (1 - s.life / s.max) * 40 * s.drip);
  for (const h of mini.sliceHalves) sliceDrawHalf(g, h);
  for (const o of mini.gels) sliceDrawGel(g, o);
  for (const d of mini.sliceDrops) {
    g.globalAlpha = clamp(d.life * 2.5, 0, 1);
    ellipse(g, d.x, d.y, d.r, d.r * 1.1, d.col);
    ellipse(g, d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.35, d.r * 0.3, '#ffffffaa');
  }
  g.globalAlpha = 1;
  for (const s of mini.sliceSlashes) {
    g.globalAlpha = clamp(s.t / 0.14, 0, 1);
    const dx = Math.cos(s.ang) * s.r,
      dy = Math.sin(s.ang) * s.r;
    line(g, [[s.x - dx, s.y - dy], [s.x + dx, s.y + dy]], '#ffffff', 5);
  }
  g.globalAlpha = 1;
  for (const w of mini.sliceWarns) sliceDrawWarn(g, w, H);
  sliceDrawFog(g, W, H);
  sliceDrawGuide(g);
  for (const o of mini.gels) if (o.hint && !o.dead && o.y < H - 40 && o.y > 50) sliceCallout(g, o.x, o.y - o.r - 30, o.hint, W);
  for (const p of mini.slicePops) {
    g.globalAlpha = clamp((p.life / p.max) * 2.2, 0, 1);
    label(g, p.text, p.x + 1.5, p.y + 1.5, p.size, '#0b2430', 'center');
    label(g, p.text, p.x, p.y, p.size, p.col, 'center');
  }
  g.globalAlpha = 1;
  sliceDrawBanner(g, W, H);
  g.restore();
  for (const c of mini.sliceConfetti) {
    g.save();
    g.translate(c.x, c.y);
    g.rotate(c.a);
    g.globalAlpha = clamp(c.life, 0, 1);
    rect(g, -4, -2, 8, 4, c.col);
    g.restore();
  }
  g.globalAlpha = 1;
  if (mini.screen === 'play') sliceDrawTrail(g);
  sliceHud(g, W, H);
  if (mini.sliceBoomFx) {
    const b = mini.sliceBoomFx,
      k = clamp(b.t / 0.6, 0, 1);
    g.globalAlpha = k * 0.45;
    rect(g, 0, 0, W, H, '#ffd0e2');
    g.globalAlpha = k;
    g.strokeStyle = '#ff8fbd';
    g.lineWidth = 10 * k + 2;
    g.beginPath();
    g.arc(b.x, b.y, 40 + (1 - k) * 260, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
}

// The ultrasound monitor: a scan fan from the top, range rings, a sweeping beam and soft speckle.
function sliceBackdrop(g, W, H) {
  const party = mini.sliceFrenzy > 0,
    cold = mini.slow > 0,
    t = mini.total || 0,
    cx = W / 2,
    top = 30,
    R = H * 1.02,
    half = Math.atan2(W * 0.66, H);
  rect(g, 0, 0, W, H, gradient(g, 0, 0, 0, H, party ? '#45391a' : cold ? '#1d4357' : '#1c4645', '#0e2231'));
  path(
    g,
    p => {
      p.moveTo(cx, top);
      p.arc(cx, top, R, Math.PI / 2 - half, Math.PI / 2 + half);
      p.closePath();
    },
    party ? '#4c4220' : '#0d3a44'
  );
  g.strokeStyle = party ? '#ffe08a22' : '#86d8c022';
  g.lineWidth = 1.5;
  for (let k = 1; k <= 5; k++) {
    g.beginPath();
    g.arc(cx, top, (R * k) / 5.3, Math.PI / 2 - half, Math.PI / 2 + half);
    g.stroke();
  }
  const sweep = Math.PI / 2 - half + ((t * 0.42) % 1) * 2 * half;
  path(
    g,
    p => {
      p.moveTo(cx, top);
      p.arc(cx, top, R, sweep - 0.16, sweep);
      p.closePath();
    },
    party ? '#ffe08a14' : '#8fe0c016'
  );
  for (let i = 0; i < 26; i++) {
    const a = Math.PI / 2 - half + sliceHash(i) * 2 * half,
      d = 60 + sliceHash(i + 50) * (R - 80),
      flick = 0.5 + 0.5 * Math.sin(t * 3 + i);
    ellipse(g, cx + Math.cos(a) * d, top + Math.sin(a) * d, 2 + flick * 2, 1.4, '#a6e0bf18');
  }
  if (party) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    glow(g, cx, H * 0.45, Math.max(W, H) * 0.6, `rgba(255, 210, 120, ${0.08 + pulse * 0.08})`);
  }
}

function sliceDrawGel(g, o) {
  if (o.kind === 'bomb') {
    sliceDrawBomb(g, o, mini.total);
    return;
  }
  if (o.kind === 'gas') {
    sliceDrawGas(g, o, mini.total);
    return;
  }
  const k = SLICE_KINDS[o.kind],
    s = o.r / 26;
  g.save();
  g.translate(o.x, o.y);
  // A floater rides up in a gel bubble.
  if (o.grav && o.grav < 1 && !o.blown) {
    g.globalAlpha = 0.5;
    g.strokeStyle = '#d9fff0';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, o.r + 9 + Math.sin(mini.total * 3 + o.id) * 2, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.18;
    ellipse(g, 0, 0, o.r + 9, o.r + 9, '#bff5e0');
    g.globalAlpha = 0.6;
    ellipse(g, -o.r * 0.55, -o.r * 0.6, o.r * 0.28, o.r * 0.15, '#ffffff');
    g.globalAlpha = 1;
  }
  if (o.kind === 'gold') {
    glow(g, 0, 0, o.r + 30, '#ffe29a66');
    for (let i = 0; i < 3; i++) {
      const a = mini.total * 3 + (i * Math.PI * 2) / 3;
      spark(g, Math.cos(a) * (o.r + 10), Math.sin(a) * (o.r + 10), '#fff3c0', 0.5);
    }
  }
  if (o.kind === 'jumbo') {
    const j = (o.jiggle || 0) * Math.sin(mini.total * 34),
      breathe = Math.sin(mini.total * 4) * 0.03;
    glow(g, 0, 0, o.r + 34, '#c7ee9a33');
    g.scale(1 + j * 0.12 + breathe, 1 - j * 0.12 - breathe);
  }
  if (o.blown) g.globalAlpha = 0.75;
  g.rotate(o.angle);
  gremlin(g, 0, 20 * s, s, k.art, mini.total + o.id);
  if (o.kind === 'helmet' && o.hp > 1) sliceHelmet(g, s);
  g.restore();
  g.globalAlpha = 1;
  if (o.kind === 'jumbo' && o.hits) {
    label(g, '×' + o.hits, o.x + 1.5, o.y - o.r - 12 + 1.5, 26, '#0b2430', 'center');
    label(g, '×' + o.hits, o.x, o.y - o.r - 12, 26, '#ffe6a6', 'center');
  }
}

function sliceHelmet(g, s) {
  path(
    g,
    p => {
      p.moveTo(-23 * s, -13 * s);
      p.quadraticCurveTo(-24 * s, -44 * s, 0, -44 * s);
      p.quadraticCurveTo(24 * s, -44 * s, 23 * s, -13 * s);
      p.closePath();
    },
    gradient(g, -20 * s, -44 * s, 40 * s, 30 * s, '#f1f4ea', '#8ea9b6'),
    '#5e7c87',
    2
  );
  rr(g, -27 * s, -16 * s, 54 * s, 7 * s, 3 * s, '#9db6bf', '#5e7c87', 1.5);
  for (const x of [-12, 0, 12]) ellipse(g, x * s, -31 * s + Math.abs(x) * 0.25 * s, 2 * s, 2 * s, '#6f8f99');
}

// A pink bomb with X eyes, a sparking fuse and a pulsing keep-out ring. Shared with the lobby scene.
function sliceDrawBomb(g, o, t) {
  const r = o.r,
    pulse = 0.5 + 0.5 * Math.sin(t * 10 + o.id);
  g.save();
  g.translate(o.x, o.y);
  glow(g, 0, 0, r + 26, '#ff5a8a40');
  g.globalAlpha = 0.35 + pulse * 0.45;
  g.strokeStyle = '#ff6f9f';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, r + 7 + pulse * 4, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
  g.rotate((o.angle || 0) * 0.4);
  ellipse(g, 0, 0, r, r, gradient(g, -r, -r, r * 2, r * 2, '#f8bad5', '#a92c63'));
  ellipse(g, -r * 0.35, -r * 0.4, r * 0.32, r * 0.2, '#ffffff66');
  for (const x of [-r * 0.32, r * 0.32]) {
    line(g, [[x - 5, -r * 0.18 - 5], [x + 5, -r * 0.18 + 5]], '#4e1631', 3.5);
    line(g, [[x - 5, -r * 0.18 + 5], [x + 5, -r * 0.18 - 5]], '#4e1631', 3.5);
  }
  path(
    g,
    p => {
      p.moveTo(-r * 0.3, r * 0.45);
      p.quadraticCurveTo(0, r * 0.22, r * 0.3, r * 0.45);
    },
    null,
    '#4e1631',
    3
  );
  rr(g, -5, -r - 5, 10, 8, 3, '#6b4b57');
  path(
    g,
    p => {
      p.moveTo(0, -r - 4);
      p.quadraticCurveTo(6, -r - 16, 14, -r - 14);
    },
    null,
    '#d7c7a6',
    3
  );
  glow(g, 14, -r - 14, 14, '#ffd39caa');
  spark(g, 14, -r - 14, '#ffe9b0', 0.45 + 0.2 * Math.sin(t * 30));
  g.restore();
}

// Laughing gas: a violet cylinder with a white shoulder, a valve and a big grin, inside a dashed
// keep-out ring. A different shape and color from the pink bomb, readable at a glance.
function sliceDrawGas(g, o, t) {
  const r = o.r,
    pulse = 0.5 + 0.5 * Math.sin(t * 8 + o.id);
  g.save();
  g.translate(o.x, o.y);
  glow(g, 0, 0, r + 26, '#9b78ff44');
  g.globalAlpha = 0.35 + pulse * 0.45;
  g.strokeStyle = '#b896ff';
  g.lineWidth = 3;
  g.setLineDash([7, 6]);
  g.beginPath();
  g.arc(0, 0, r + 7 + pulse * 3, t * 1.5, t * 1.5 + Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
  g.rotate((o.angle || 0) * 0.5);
  rr(g, -r * 0.62, -r * 0.6, r * 1.24, r * 1.5, r * 0.5, gradient(g, -r * 0.62, 0, r * 1.24, 0, '#ddd2ff', '#6a4cc6'), '#3d2a78', 2);
  path(
    g,
    p => {
      p.moveTo(-r * 0.62, -r * 0.18);
      p.quadraticCurveTo(-r * 0.62, -r * 0.62, 0, -r * 0.62);
      p.quadraticCurveTo(r * 0.62, -r * 0.62, r * 0.62, -r * 0.18);
      p.closePath();
    },
    '#f6f2ff',
    '#3d2a78',
    2
  );
  rr(g, -4, -r * 0.98, 8, r * 0.4, 2, '#a9b2bc', '#56616b', 1.5);
  rr(g, -9, -r * 1.06, 18, 6, 3, '#d2d8de', '#56616b', 1.5);
  // Happy squinty eyes and a big grin.
  for (const x of [-r * 0.24, r * 0.24])
    path(
      g,
      p => {
        p.moveTo(x - 5, r * 0.08);
        p.quadraticCurveTo(x, r * 0.08 - 6, x + 5, r * 0.08);
      },
      null,
      '#2a1a55',
      3
    );
  path(
    g,
    p => {
      p.moveTo(-r * 0.36, r * 0.32);
      p.quadraticCurveTo(0, r * 0.78, r * 0.36, r * 0.32);
      p.closePath();
    },
    '#2a1a55'
  );
  ellipse(g, 0, r * 0.5, r * 0.16, r * 0.07, '#ff9fc4');
  ellipse(g, -r * 0.34, -r * 0.05, r * 0.1, r * 0.5, '#ffffff44');
  // A giggly wisp leaking from the valve.
  g.globalAlpha = 0.45 + 0.25 * pulse;
  ellipse(g, 7 + pulse * 4, -r * 1.12 - pulse * 6, 5 + pulse * 2, 4, '#e3d8ff');
  g.globalAlpha = 1;
  g.restore();
}

// A hazard about to rise: a blinking chevron and bang at the bottom edge, in its color.
function sliceDrawWarn(g, w, H) {
  const col = w.kind === 'gas' ? '#c4a8ff' : '#ff7fae',
    blink = 0.55 + 0.45 * Math.sin((w.max - w.t) * 18),
    y = H - 34;
  g.globalAlpha = blink;
  glow(g, w.x, y, 34, w.kind === 'gas' ? '#a07cff66' : '#ff5a8a66');
  poly(g, [[w.x - 16, y + 14], [w.x, y - 6], [w.x + 16, y + 14], [w.x, y + 6]], col);
  label(g, '!', w.x, y - 12, 22, col, 'center');
  g.globalAlpha = 1;
}

// The laughing-gas fog: a lavender haze with drifting puffs over everything in the arena. Gremlins show
// through faintly and the hazards glow through, so you can still dodge what you cannot quite see.
function sliceDrawFog(g, W, H) {
  const f = mini.sliceFog;
  if (f <= 0) return;
  const a = clamp(Math.min((SLICE_FOG - f) / 0.2, f / 0.6), 0, 1),
    t = mini.total;
  g.globalAlpha = a * 0.8;
  rect(g, -40, -40, W + 80, H + 80, '#c9b9ee');
  for (let i = 0; i < 10; i++) {
    const drift = reduced ? 0 : t * (14 + i * 4),
      x = ((sliceHash(i + 3) * (W + 240) + drift) % (W + 240)) - 120,
      y = sliceHash(i + 40) * H,
      r = 70 + sliceHash(i + 70) * 90;
    g.globalAlpha = a * 0.35;
    ellipse(g, x, y, r, r * 0.7, i % 2 ? '#efe8ff' : '#ae98e6');
  }
  for (const o of mini.gels) {
    if (!SLICE_KINDS[o.kind].hazard || o.dead) continue;
    g.globalAlpha = a * 0.75;
    g.strokeStyle = o.kind === 'gas' ? '#7a52e0' : '#ff4f8a';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(o.x, o.y, o.r + 6, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = a * 0.6;
  for (let i = 0; i < 3; i++)
    label(g, 'HEE', W * (0.22 + i * 0.28) + Math.sin(t * 2 + i) * 12, H * (0.3 + 0.18 * (i % 2)) - (SLICE_FOG - f) * 20, 20, '#6f55b8', 'center');
  g.globalAlpha = 1;
}

function sliceDrawHalf(g, h) {
  g.globalAlpha = clamp(h.life / 0.5, 0, 1);
  g.save();
  g.translate(h.x, h.y);
  g.rotate(h.angle);
  if (h.helmet) {
    const s = h.r / 26;
    g.translate(0, 26 * s);
    sliceHelmet(g, s);
    g.restore();
    g.globalAlpha = 1;
    return;
  }
  const s = h.r / 26;
  g.save();
  g.rotate(h.cut);
  g.beginPath();
  g.rect(-h.r * 2.4, h.side > 0 ? 0 : -h.r * 2.4, h.r * 4.8, h.r * 2.4);
  g.clip();
  g.rotate(-h.cut);
  gremlin(g, 0, 20 * s, s, h.art, h.id);
  g.restore();
  // The wet inside of the cut.
  g.rotate(h.cut);
  ellipse(g, 0, h.side * 2, h.r * 0.78, 4.5, h.col);
  ellipse(g, 0, h.side * 2, h.r * 0.5, 2, '#ffffffaa');
  g.restore();
  g.globalAlpha = 1;
}

// The blade: a tapered ribbon, widest at the fingertip, with a glow and a white-hot core.
function sliceDrawTrail(g) {
  const pts = mini.sliceTrail;
  if (!pts.length) return;
  let start = 0;
  for (let i = 1; i <= pts.length; i++)
    if (i === pts.length || pts[i].stroke !== pts[start].stroke) {
      sliceRibbon(g, pts.slice(start, i));
      start = i;
    }
  const tip = pts[pts.length - 1],
    run = mini.sliceRun;
  if (mini.pointer && tip.stroke === mini.pointer.stroke) {
    glow(g, tip.x, tip.y, 30, '#ffffff77');
    if (run && run.n >= 2 && run.stroke === tip.stroke) {
      const size = 18 + Math.min(5, run.n) * 3;
      label(g, '×' + run.n, tip.x + 26 + 2, tip.y - 24 + 2, size, '#0b2430', 'center');
      label(g, '×' + run.n, tip.x + 26, tip.y - 24, size, run.n >= 3 ? '#ffe08a' : '#f4ffe6', 'center');
    }
  }
}

function sliceRibbon(g, pts) {
  const n = pts.length,
    party = mini.sliceFrenzy > 0;
  if (n < 2) {
    const p = pts[0];
    ellipse(g, p.x, p.y, 7 * (p.life / SLICE_TRAIL), 7 * (p.life / SLICE_TRAIL), '#ffffffcc');
    return;
  }
  const width = pts.map((p, i) => 27 * clamp(p.life / SLICE_TRAIL, 0, 1) * (0.25 + 0.75 * (i / (n - 1)))),
    shape = k => {
      g.beginPath();
      const side = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)],
          b = pts[Math.min(n - 1, i + 1)],
          L = Math.hypot(b.x - a.x, b.y - a.y) || 1,
          nx = -(b.y - a.y) / L,
          ny = (b.x - a.x) / L,
          w = (width[i] * k) / 2;
        side.push([pts[i].x - nx * w, pts[i].y - ny * w]);
        if (i) g.lineTo(pts[i].x + nx * w, pts[i].y + ny * w);
        else g.moveTo(pts[i].x + nx * w, pts[i].y + ny * w);
      }
      for (let i = n - 1; i >= 0; i--) g.lineTo(side[i][0], side[i][1]);
      g.closePath();
      g.fill();
      const tip = pts[n - 1];
      g.beginPath();
      g.arc(tip.x, tip.y, (width[n - 1] * k) / 2, 0, Math.PI * 2);
      g.fill();
    },
    a = pts[0],
    b = pts[n - 1];
  let edge = party ? '#ffd166' : mini.slow > 0 ? '#9fdcff' : '#8ff0d0';
  if (party) {
    edge = g.createLinearGradient(a.x, a.y, b.x, b.y);
    edge.addColorStop(0, '#ff9fc4');
    edge.addColorStop(0.5, '#ffe08a');
    edge.addColorStop(1, '#9fe3ff');
  }
  g.globalAlpha = 0.35;
  g.fillStyle = edge;
  shape(2.1);
  g.globalAlpha = 0.95;
  g.fillStyle = edge;
  shape(1);
  g.globalAlpha = 1;
  g.fillStyle = '#ffffff';
  shape(0.42);
}

// Level 1's first wave: a dashed swipe line through it and a fingertip gliding along, until a cut.
function sliceDrawGuide(g) {
  if (!mini.sliceGuide) return;
  const gels = mini.gels.filter(o => mini.sliceGuide.includes(o.id) && !o.dead && o.y < sliceArena().H - 20);
  if (gels.length < 2) return;
  gels.sort((a, b) => a.x - b.x);
  const a = gels[0],
    b = gels[gels.length - 1],
    L = Math.hypot(b.x - a.x, b.y - a.y) || 1,
    ux = (b.x - a.x) / L,
    uy = (b.y - a.y) / L,
    p0 = [a.x - ux * 60, a.y - uy * 60],
    p1 = [b.x + ux * 60, b.y + uy * 60],
    u = (mini.total * 0.9) % 1;
  g.setLineDash([10, 9]);
  line(g, [p0, p1], '#fff6d088', 4);
  g.setLineDash([]);
  const fx = p0[0] + (p1[0] - p0[0]) * u,
    fy = p0[1] + (p1[1] - p0[1]) * u;
  glow(g, fx, fy, 30, '#ffffffbb');
  ellipse(g, fx, fy, 12, 12, '#ffffffee');
  g.strokeStyle = '#2b2a1e88';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(fx, fy, 12, 0, Math.PI * 2);
  g.stroke();
  sliceCallout(g, (a.x + b.x) / 2, Math.min(a.y, b.y) - 70, SLICE_HINTS.first, sliceArena().W);
}

// Combo and jumbo banners pop in big near where they happened, then float and fade.
function sliceDrawBanner(g, W, H) {
  const b = mini.sliceBanner;
  if (!b) return;
  const age = b.max - b.t,
    pop = 1 + 0.45 * clamp(1 - age / 0.14, 0, 1),
    x = clamp(b.x, 120, W - 120),
    y = clamp(b.y - 70 - age * 22, 90, H - 120);
  g.save();
  g.globalAlpha = clamp(b.t / 0.3, 0, 1);
  g.translate(x, y);
  g.scale(pop, pop);
  label(g, b.text, 2, 2, 27, '#0b2430', 'center');
  label(g, b.text, 0, 0, 27, '#fff3c4', 'center');
  label(g, b.sub, 2, 28, 21, '#0b2430', 'center');
  label(g, b.sub, 0, 26, 21, '#ffd36b', 'center');
  g.restore();
  g.globalAlpha = 1;
}

// Bottom strip: the party meter in the middle, drops on the left. The top corners stay clear.
function sliceHud(g, W, H) {
  const tier = SLICE_TIERS[mini.tier],
    party = mini.sliceFrenzy > 0,
    mw = Math.min(260, W * 0.46),
    mx = W / 2 - mw / 2,
    my = H - 22,
    full = tier.meter,
    fill = party ? mini.sliceFrenzy / SLICE_FRENZY : Math.min(1, mini.sliceMeter / full);
  rr(g, mx - 3, my - 3, mw + 6, 15, 7, '#0b1f2bcc');
  rr(g, mx, my, mw, 9, 5, '#2c5157');
  if (fill > 0) rr(g, mx, my, mw * fill, 9, 5, party ? '#ffd86a' : mini.sliceMeter >= full - 2 ? '#ffe9a6' : '#9dd8b6');
  label(
    g,
    party
      ? 'GEL FRENZY · DOUBLE POINTS'
      : mini.slow > 0
        ? 'GEL FREEZE · SLOW MOTION'
        : mini.sliceFog > 0
          ? 'LAUGHING GAS · IT CLEARS IN A SEC'
          : 'COMBOS FILL THE PARTY METER',
    W / 2,
    my - 8,
    11,
    party ? '#ffe9a6' : '#d7e6c9',
    'center'
  );
  const near = mini.sliceEscapes >= tier.escapes - 2;
  label(g, 'DROPS ' + mini.sliceEscapes + '/' + tier.escapes, 14, H - 12, 11, near ? '#ffb0a8' : '#9fc4b8');
}

function sliceCallout(g, x, y, text, W) {
  const w = Math.max(120, text.length * 7.6 + 20),
    cx = clamp(x, 8 + w / 2, W - 8 - w / 2),
    top = Math.max(58, y - 18);
  rr(g, cx - w / 2, top, w, 26, 10, '#fff2c4f2');
  poly(g, [[clamp(x, cx - w / 2 + 14, cx + w / 2 - 14) - 7, top + 25], [clamp(x, cx - w / 2 + 14, cx + w / 2 - 14) + 7, top + 25], [clamp(x, cx - w / 2 + 14, cx + w / 2 - 14), top + 34]], '#fff2c4f2');
  label(g, text, cx, top + 18, 12, '#2b2a1e', 'center');
}
