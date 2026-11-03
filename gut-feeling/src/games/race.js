// Gurney Grand Prix (CT scan). A pseudo-3D arcade racer in the OutRun family. Macy rides a runaway
// gurney across the hospital campus against gremlin gurneys, med carts, a runaway IV pole and Barb's
// Ensure cart. The road curves and climbs, the CT scanner's donuts are the gates and the tunnels,
// donut gates add time, and the finish line hands out places. Top three wins.
// Canvas 800 × 500 wide or 450 × 800 tall. Everything lives in course coordinates: z in segments
// along the road, x in road half-widths (0 is the middle, ±1 the edges). The road is drawn segment
// by segment with perspective; cars and props are sprites scaled by the road under them.

// ---- Geometry ----
const RACE_SEG = 200, // world units per segment
  RACE_ROAD = 2000, // road half-width, world units
  RACE_CAM = 1000, // camera height over the road
  RACE_DEPTH = 0.84, // 1 / tan(half the field of view)
  RACE_EYE = RACE_CAM * RACE_DEPTH, // camera distance behind the gurney, world units
  RACE_DRAW = 150, // segments drawn ahead
  RACE_RUMBLE = 3, // segments per stripe
  RACE_ART = 220, // art pixels per road half-width at scale 1
  RACE_LANES = [-0.62, 0, 0.62];

// ---- Driving ----
const RACE_TOP = 50, // top speed in segments per second (Questionable Decisions)
  RACE_STEP = 1 / 120, // simulation sub-step
  RACE_STEER = 2.2, // sideways speed at full steer, half-widths per second
  RACE_CENT = 0.3, // outward push per unit of curve at top speed
  RACE_EDGE = 1.1, // past the rumble strip: grass
  RACE_WALL = 2.3, // nothing drives past this
  RACE_TUNNEL_WALL = 1.24, // inside a donut tunnel
  RACE_GRASS = 0.36, // top speed on the grass
  RACE_SCRAPE = 0.55, // top speed against a tunnel wall
  RACE_PW = 0.2, // the gurney's half-width
  RACE_LEN = 1.1, // how close (in segments) two gurneys must be to touch
  RACE_SPIN = 0.6, // a crash spins you this long
  RACE_GHOST = 0.9, // then you blink through traffic this long
  RACE_SPIN_CAP = 0.3, // top speed while spinning
  RACE_BOOST = 2.2, // seconds of boost
  RACE_BOOST_MUL = 1.3,
  RACE_NITRO = 3.2, // the assist
  RACE_NITRO_MUL = 1.42,
  RACE_BALL_RANGE = 75, // segments a softball flies
  RACE_BALL_SPEED = 95, // segments per second on top of yours
  RACE_BAND_AHEAD = 0.06, // a rival far up the road eases off by up to this share of its pace
  RACE_BAND_BEHIND = 0.03, // and one far behind pushes this much harder: the field bunches up
  RACE_WAKE = 230, // traffic starts moving this far ahead
  RACE_SLEEP = 70; // and retires this far behind

// ---- Off the road, pads and ramps ----
const RACE_RUMBLE_X = 0.84, // the outer caster is on the rumble strip: the gurney shakes, a warning
  RACE_GRAZE = [0.42, 0.34, 0.3, 0.28], // per level: seconds past the rumble strip (deeper counts faster) before a spin-out
  RACE_SPINOUT = 1.5, // a spin-out lasts this long: two full turns
  RACE_SPINOUT_V = 0.55, // only at speed: slower than this share of top speed, the grass just slows you
  RACE_SPINOUT_CAP = 0.2, // top speed while spinning out
  RACE_PAD_LEN = 4, // segments of orange arrows
  RACE_PAD_W = 0.24, // pad half-width; your middle has to be on it
  RACE_PAD_T = 1.1, // seconds of burst a pad gives
  RACE_PAD_KICK = 1.14, // and the speed it kicks you to at once
  RACE_RAMP_LEN = 5, // segments of slope up to the lip
  RACE_RAMP_W = 0.3, // a lane ramp's half-width; full-width crest ramps say so
  RACE_RAMP_H = 0.16, // lip height in road half-widths, for drawing
  RACE_LIFT = 320, // peak height of a jump at top speed above the lip line, world units
  RACE_CAM_LIFT = 0.2; // the camera rises this share of the jump

// Courses as a list of pieces. s: straight (length, hill), c: curve (in, hold, out, curve, hill),
// g: donut gate, t: tunnel on/off, n: night on/off, f: finish. Hill is a rise in segment lengths;
// curve is how hard the road bends (and how hard it pushes you outward). Placed by hand, dz segments
// on from where they sit in the list (negative reaches back): b: boost pad (x, dz), r: wheelchair
// ramp (x, dz, half-width; the lip is RACE_RAMP_LEN past dz), o: something parked (kind, lane, dz),
// i: a roadside sign (text, dz). Level 4 runs at night from the start (RACE_TIERS night).
const RACE_COURSES = [
  [
    ['b', 0, 45],
    ['s', 70],
    ['s', 160, 8],
    ['c', 40, 110, 40, 2.2, -8],
    ['b', 0.62, 30],
    ['r', 0, 95],
    ['o', 'wetfloor', 1, 118],
    ['o', 'wetfloor', 0, 118],
    ['s', 180],
    ['c', 40, 90, 40, 2.6, 6],
    ['b', -0.62, 140],
    ['s', 120, -6],
    ['s', 90],
    ['c', 35, 60, 35, 3, 0],
    ['c', 35, 60, 35, -3, 10],
    ['g'],
    ['b', 0, 30],
    ['r', 0.62, 110],
    ['o', 'parked', 2, 135],
    ['s', 230, -10],
    ['c', 50, 120, 50, 2.4, 0],
    ['b', 0.3, 0],
    ['s', 150, 6],
    ['c', 40, 80, 40, -2.2, -6],
    ['b', 0, 40],
    ['s', 170],
    ['f']
  ],
  [
    ['s', 60],
    ['b', 0.5, 45],
    ['c', 30, 70, 30, 3.5, 10],
    ['s', 90, -10],
    ['c', 30, 60, 30, -4.5, 0],
    ['c', 30, 60, 30, 4, 12],
    ['b', -0.62, 30],
    ['s', 130, -12],
    ['c', 30, 50, 30, -3.5, 6],
    ['r', -0.62, 30],
    ['o', 'parked', 0, 52],
    ['o', 'wetfloor', 1, 56],
    ['s', 100, -6],
    ['s', 70],
    ['t'],
    ['b', 0, 50],
    ['s', 150],
    ['c', 25, 70, 25, 2.5, 0],
    ['s', 70],
    ['t'],
    ['g'],
    ['s', 90, 14],
    ['c', 40, 90, 40, -5, -14],
    ['b', -0.62, 25],
    ['s', 120],
    ['c', 25, 50, 25, 4.5, 8],
    ['b', -0.5, 40],
    ['c', 25, 50, 25, -4.5, -8],
    ['s', 60],
    ['r', 0, 15],
    ['o', 'parked', 1, 40],
    ['o', 'parked', 0, 46],
    ['s', 100],
    ['c', 30, 70, 30, 5, 10],
    ['s', 120, -10],
    ['g'],
    ['s', 120, 16],
    ['r', 0.62, -5],
    ['s', 130, -16],
    ['c', 40, 100, 40, 4, 0],
    ['b', 0.62, 20],
    ['s', 100],
    ['c', 30, 60, 30, -3.5, 10],
    ['b', 0, 40],
    ['s', 170, -10],
    ['f']
  ],
  [
    ['s', 60],
    ['b', 0.55, 55],
    ['c', 30, 60, 30, 4, 20],
    ['s', 80, 25],
    ['c', 30, 50, 30, -5.5, 15],
    ['r', 0.62, -5],
    ['s', 70, -30],
    ['c', 30, 70, 30, 5, -10],
    ['b', -0.72, -20],
    ['s', 110, 30],
    ['r', -0.62, -5],
    ['s', 90, -35],
    ['c', 30, 60, 30, -6, 0],
    ['c', 30, 60, 30, 6, 20],
    ['b', 0, 30],
    ['s', 130, 30],
    ['c', 40, 80, 40, -4.5, 25],
    ['g'],
    ['s', 100, -40],
    ['n'],
    ['s', 90, -20],
    ['c', 30, 60, 30, 5, 15],
    ['b', 0.62, 30],
    ['s', 120, -15],
    ['c', 30, 60, 30, -5.5, 0],
    ['s', 80],
    ['g'],
    ['t'],
    ['b', -0.62, 40],
    ['s', 120],
    ['c', 30, 90, 30, -3.5, 0],
    ['s', 60],
    ['c', 30, 90, 30, 3.5, 0],
    ['b', 0.62, 20],
    ['s', 110],
    ['t'],
    ['s', 80, 15],
    ['c', 30, 60, 30, -6, -15],
    ['n'],
    ['s', 60],
    ['g'],
    ['s', 140, 20],
    ['c', 30, 60, 30, 5.5, -20],
    ['c', 30, 60, 30, -5.5, 0],
    ['b', 0, 30],
    ['r', -0.62, 90],
    ['o', 'parked', 0, 112],
    ['o', 'wetfloor', 1, 118],
    ['s', 200, 10],
    ['b', 0.62, 50],
    ['s', 150, -10],
    ['f']
  ],
  [
    ['b', 0, 30],
    ['s', 60],
    ['c', 30, 60, 30, 5, 15],
    ['i', 'JUMP 200 m', 0],
    ['s', 100, 30],
    ['r', 0, -5, 1.2],
    ['s', 120, -40],
    ['c', 30, 70, 30, -6, -5],
    ['b', 0.7, 20],
    ['c', 30, 70, 30, 6, 10],
    ['s', 140, 35],
    ['g'],
    ['s', 110, -45],
    ['c', 30, 60, 30, -6.5, 0],
    ['s', 90],
    ['t'],
    ['b', 0.62, 30],
    ['s', 100],
    ['c', 25, 80, 25, 4, 0],
    ['c', 25, 80, 25, -4, 0],
    ['b', -0.62, 30],
    ['s', 80],
    ['t'],
    ['s', 120, 30],
    ['r', 0.62, -5],
    ['c', 30, 50, 30, 5.5, -30],
    ['s', 100],
    ['g'],
    ['c', 30, 70, 30, -6, 20],
    ['b', 0, 40],
    ['i', 'KEEP LEFT 200 m', 60],
    ['s', 160, 40],
    ['r', -0.62, -5],
    ['o', 'parked', 1, 20],
    ['o', 'parked', 2, 24],
    ['s', 160, -45],
    ['c', 40, 80, 40, 6.5, 0],
    ['b', -0.75, 0],
    ['s', 100],
    ['c', 30, 60, 30, -5.5, 15],
    ['g'],
    ['s', 120, -15],
    ['t'],
    ['b', 0, 50],
    ['s', 140],
    ['c', 30, 100, 30, 3.5, 0],
    ['t'],
    ['i', 'JUMP 200 m', 20],
    ['s', 120, 35],
    ['r', 0, -5, 1.2],
    ['s', 140, -35],
    ['c', 30, 60, 30, -6, 0],
    ['c', 30, 60, 30, 6, 0],
    ['b', -0.62, 40],
    ['r', 0.62, 100],
    ['o', 'parked', 2, 125],
    ['o', 'wetfloor', 1, 130],
    ['b', 0, 160],
    ['s', 260],
    ['f']
  ]
];

// Rivals per level: kind, name, the average share of your top speed you need to beat them to the
// line, head start in segments, look, encores (Ralph only: how many times he comes back for another
// block). raceInit turns that into each rival's cruising pace. They line up ahead of you in the order
// given; the quick ones start furthest up the road.
const RACE_FIELDS = [
  [
    ['iv', 'Rolling IV', 0.68, 22],
    ['cart', 'Med Cart 4', 0.75, 40],
    ['gremlin', 'Gus', 0.8, 58, 0],
    ['gremlin', 'Pudding', 0.84, 76, 1],
    ['gremlin', 'Gloop', 0.88, 94, 2],
    ['gremlin', 'Sprocket', 0.97, 112, 3],
    ['barb', 'Barb', 1.03, 130]
  ],
  [
    ['iv', 'Rolling IV', 0.73, 20],
    ['cart', 'Med Cart 4', 0.79, 38],
    ['gremlin', 'Gus', 0.83, 56, 0],
    ['gremlin', 'Pudding', 0.86, 74, 1],
    ['cart', 'Crash Cart', 0.89, 92],
    ['gremlin', 'Gloop', 0.92, 110, 2],
    ['gremlin', 'Sprocket', 0.94, 128, 3],
    ['gremlin', 'Snot Rocket', 0.96, 146, 0],
    ['barb', 'Barb', 1, 164]
  ],
  [
    ['iv', 'Rolling IV', 0.73, 20],
    ['cart', 'Med Cart 4', 0.78, 36],
    ['gremlin', 'Gus', 0.81, 52, 0],
    ['gremlin', 'Pudding', 0.84, 68, 1],
    ['cart', 'Crash Cart', 0.87, 84],
    ['gremlin', 'Gloop', 0.9, 100, 2],
    ['gremlin', 'Sprocket', 0.93, 116, 3],
    ['gremlin', 'Snot Rocket', 0.97, 132, 0],
    ['gremlin', 'Bile Bandit', 0.99, 148, 1],
    ['barb', 'Barb', 1.03, 164],
    ['ralph', 'Ralph', 0.87, 700]
  ],
  [
    ['iv', 'Rolling IV', 0.8, 20],
    ['cart', 'Med Cart 4', 0.84, 36],
    ['gremlin', 'Gus', 0.87, 52, 0],
    ['cart', 'Crash Cart', 0.9, 68],
    ['gremlin', 'Pudding', 0.92, 84, 1],
    ['gremlin', 'Gloop', 0.93, 100, 2],
    ['gremlin', 'Sprocket', 0.95, 116, 3],
    ['gremlin', 'Snot Rocket', 0.96, 132, 0],
    ['gremlin', 'Bile Bandit', 0.99, 148, 1],
    ['barb', 'Barb', 1.03, 164],
    ['ralph', 'Ralph', 0.81, 300, 0, 1]
  ]
];

// Things on the road that are not racing. Pace is a share of your top speed.
const RACE_TRAFFIC = {
  laundry: { name: 'laundry cart', pace: 0.3, w: 0.24, h: 0.34 },
  wheelchair: { name: 'wheelchair', pace: 0.24, w: 0.18, h: 0.4 },
  wetfloor: { name: 'wet floor sign', pace: 0, w: 0.13, h: 0.3 },
  parked: { name: 'parked gurney', pace: 0, w: 0.24, h: 0.27 }
};

const RACE_KINDS = {
  gremlin: { w: 0.22, h: 0.4 },
  cart: { w: 0.23, h: 0.5 },
  iv: { w: 0.13, h: 0.92 },
  barb: { w: 0.25, h: 0.48 },
  ralph: { w: 0.34, h: 0.62 }
};

// Per level: time on the clock at the start and per donut gate (at top speed; prescriptions scale
// it), traffic, roadside props and the kit.
const RACE_TIERS = [
  {
    course: 'Lobby Sprint',
    time: 37,
    gates: [24],
    traffic: { from: 380, gap: [210, 290], mix: { laundry: 3, wheelchair: 2 }, pair: 0, weave: 0 },
    props: { vend: 2, bench: 2, plant: 2, chair: 1, lamp: 1 },
    boosts: 3,
    balls: 3
  },
  {
    course: 'Imaging Wing',
    time: 36,
    gates: [27, 24],
    traffic: {
      from: 220,
      gap: [115, 170],
      mix: { laundry: 3, wheelchair: 3, wetfloor: 2, parked: 1 },
      pair: 0.25,
      weave: 0
    },
    props: { vend: 2, bench: 1, plant: 1, chair: 2, ensure: 1, lamp: 1 },
    boosts: 3,
    balls: 4
  },
  {
    course: 'Night Shift Summit',
    time: 41,
    gates: [17, 23, 20],
    traffic: {
      from: 170,
      gap: [100, 150],
      mix: { laundry: 3, wheelchair: 3, wetfloor: 2, parked: 2 },
      pair: 0.3,
      weave: 0.3
    },
    props: { vend: 2, bench: 1, plant: 1, chair: 1, ensure: 2, lamp: 2 },
    boosts: 3,
    balls: 5
  },
  {
    course: 'Midnight Rounds',
    night: true,
    time: 35,
    gates: [22, 22, 28],
    traffic: {
      from: 160,
      gap: [115, 165],
      mix: { laundry: 3, wheelchair: 3, wetfloor: 2, parked: 2 },
      pair: 0.25,
      weave: 0.4
    },
    props: { vend: 2, bench: 1, plant: 1, chair: 1, ensure: 2, lamp: 3 },
    boosts: 3,
    balls: 5
  }
];

const RACE_ORD = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH', '11TH', '12TH'];

const RACE = registerGame({
  id: 3,
  canvas: { w: 800, h: 500 },
  portraitCanvas: { w: 450, h: 800 },
  layout: 'gesture',
  info: {
    game: 'Gurney Grand Prix',
    genre: 'STEER · BOOST · JUMP · BONK',
    headline: 'No brakes. Real standings. Barb is not slowing down.',
    desc:
      'A proper race across the hospital campus. Steer a runaway gurney through curves, over hills and through the CT donut, hit the boost arrows, fly the wheelchair ramps, pass gremlin gurneys, med carts, a runaway IV and Barb from Dietary, and reach each donut gate before the clock runs dry. Finish top three.',
    goal: 'Finish in the top three before the clock runs out. Every donut gate adds time.',
    control:
      'Hold the left or right side of the screen to steer, or drag to steer gently. Swipe up to BOOST. Tap a gurney up the road to bonk it with a softball. Keyboard: arrows steer, Space throws, Shift boosts. The buttons work too.',
    avoid:
      'Curves push you wide, so steer in early. The rumble strip shakes before the edge: go past it at speed and you spin out. Rear-ending anything spins you too, never a heart. Save boosts for straights.',
    cue: 'Hold left or right to steer · swipe up to boost · tap a gurney to throw'
  },
  legendary: true,
  tierNotes: [
    'Lobby Sprint · 8 racers · long straights · boost pads · two ramps',
    'Imaging Wing · 10 racers · sharp curves · ramps · a donut tunnel',
    'Night Shift Summit · 12 racers · hills · crest jumps · night tunnel · Ralph',
    'Midnight Rounds · 12 racers · lights out · blind jumps · Ralph, twice'
  ],
  shiftName: 'LEG',
  init() {
    raceInit();
  },
  controls() {
    setControls([
      { id: 'boost', text: 'BOOST ⚡', key: 'Shift', hot: true },
      { id: 'throw', text: 'THROW ⚾', key: 'Space' }
    ]);
  },
  update(dt) {
    updateArcade(dt, raceUpdate);
  },
  draw(g) {
    drawRace(g);
  },
  overlay(g) {
    raceOverlay(g);
  },
  // Canvas presses: the newest finger steers by where it is; a tap on a gurney up the road throws at
  // it; a quick swipe up boosts. More fingers arrive through racePointerEvent.
  down(p) {
    raceTouchDown('main', p);
  },
  move(p) {
    raceTouchMove('main', p);
  },
  up(cancel) {
    raceTouchUp('main', cancel);
  },
  action(a) {
    if (a === 'boost') raceBoost();
    if (a === 'throw') raceThrow(null);
  },
  assist() {
    mini.raceNitroT = RACE_NITRO;
    mini.raceGhost = Math.max(mini.raceGhost, RACE_NITRO);
    mini.raceSpin = 0;
    mini.raceSpinOut = false;
    mini.raceOffT = 0;
    mini.raceBoostT = 0;
    mini.flash = 1.2;
    mini.flashText = 'NITRO · YOU ARE A GHOST FOR THREE SECONDS';
    sfx('powerup');
  },
  key(k, e) {
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
      keys.add(k);
      e.preventDefault();
      return true;
    }
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) miniAction('throw');
      return true;
    }
    if (k === 'shift' || k === 'arrowup' || k === 'w') {
      e.preventDefault();
      if (!e.repeat) miniAction('boost');
      return true;
    }
    return false;
  },
  shiftLevel() {
    return Math.min(2, Math.floor(raceProgress() * 3));
  },
  shiftMessage: shift =>
    [
      ['LEG 2 · An S-bend is coming. Steer into each half early.', 'FINAL LEG · Long straights. Spend your boosts.'],
      [
        'LEG 2 · Donut tunnel. The walls are close and very expensive.',
        'FINAL LEG · Curves both ways. Barb takes the inside line.'
      ],
      [
        'LEG 2 · Lights out soon. Tail lights mean traffic over the crest.',
        'FINAL LEG · Ralph is out of bed. Juke him or bonk him.'
      ],
      [
        'LEG 2 · Blind crest ahead. The sign says keep left. Believe the sign.',
        'FINAL LEG · One more jump, then the long straight. Ralph is not done.'
      ]
    ][mini.tier][shift - 1],
  timeUp() {
    if (mini.raceDone) return;
    mini.raceDone = true;
    mini.raceOut = 'time';
    finishMini(
      false,
      'Out of time. Each donut gate adds seconds and every spin-out eats some. Stay on the floor and steer into curves early.'
    );
  },
  lesson() {
    const i = RACE.info,
      T = RACE_TIERS[mini.tier],
      field = mini.raceRivals.length + 1,
      gates = T.gates.length;
    return {
      title: i.game + ' · ' + T.course,
      goal:
        `Finish top three out of ${field} before the clock runs out. ` +
        (gates === 1 ? 'One donut gate adds time.' : `${gates} donut gates add time.`) +
        [
          ' Drive over the orange arrows for a free burst. Line up the blue ramp and fly the wet floor signs.',
          ' Pads sit on the inside of curves, ramps clear the traffic jams, and the tunnel walls bite.',
          ' Hills hide traffic, crest ramps launch you blind, the tunnel is dark, and Ralph drives a motorized bed like he owns the place.',
          ' Lights out the whole way. Blind jumps, the fastest field in the building, and Ralph comes back for seconds.'
        ][mini.tier],
      control: i.control,
      avoid: i.avoid,
      demo: 'race',
      cue: i.cue
    };
  },
  statLabel: () => 'PLACE',
  stat: () => RACE_ORD[mini.raceShown] + ' / ' + (mini.raceRivals.length + 1),
  livesLabel: () => 'BOOSTS · BALLS',
  lives: () => '⚡ ' + mini.raceBoosts + ' · ⚾ ' + mini.raceBalls,
  tactics: () =>
    `${raceKph()} KPH · ${Math.round(raceProgress() * 100)}% · ${mini.racePasses} PASSES · ` +
    `${mini.raceCrashes} SPINS · ${mini.raceJumps} JUMPS · ${mini.raceHits} BONKS`,
  assistText: () => 'NITRO · ' + mini.helps + ' (E)',
  // First place with two spins or fewer is gold, second is silver, third is bronze unless it was clean.
  quality() {
    const place = mini.raceFinal || mini.racePlace,
      base = [0, 82, 74, 60][place] || 55,
      clean = Math.max(0, 8 - mini.raceCrashes * 3),
      spare = clamp((mini.limit - mini.phaseTime) / 5, 0, 4);
    return Math.round(clamp(base + clean + spare - mini.helpUsed * 4, 0, 100));
  },
  onWin() {
    const p = clamp(mini.raceFinal || mini.racePlace, 1, 3),
      quip = [
        '',
        pick([
          'First place. Barb has requested a rematch and a smaller gurney.',
          'First place. The CT tech has asked you to stop calling it the donut.',
          'First place. The gremlins are reviewing the tape.'
        ]),
        pick(['Second place. Silver gurney, golden attitude.', 'Second place. One gurney away from bragging rights.']),
        pick(['Third place. Podium is podium.', 'Third place. Bronze, and nobody got hurt. Much.'])
      ][p];
    return quip + ' ' + raceStandingsLine();
  },
  onLose(reason) {
    const time = mini.raceOut === 'time';
    for (let i = 0; i < 60; i++)
      gore.push({
        x: 600,
        y: 120,
        vx: rand(-260, 260),
        vy: rand(-240, 20),
        size: rand(3, 7),
        col: ['#f2e9cf', '#8fd0c4', '#f4b2b2', '#ffe1a0'][i % 4]
      });
    return {
      gory: false,
      medal: time ? '⏱' : '☹',
      heading: time ? 'OUT OF TIME.' : 'OFF THE PODIUM.',
      text: reason
    };
  },
  resultArt(g) {
    return raceResultArt(g);
  },
  scene(g, w, h) {
    raceScene(g, w, h);
  }
});

// ---- Course ----
// A stable hash for anything that must look random but stay put (props, skyline, sparkle).
function raceHash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const raceEaseIn = (a, b, p) => a + (b - a) * p * p,
  raceEaseInOut = (a, b, p) => a + (b - a) * (0.5 - Math.cos(p * Math.PI) / 2);

// Segments with curve, height (y1 at the near edge, y2 at the far edge), tunnel and night flags, props,
// gates, donut rings, boost pads and ramps (lip marks a ramp's last segment). The same level always
// builds the same course, so it can be learned.
function raceBuildCourse(tier) {
  const segs = [],
    gates = [],
    marks = [];
  let y = 0,
    tunnel = false,
    night = !!RACE_TIERS[tier].night,
    finish = 0;
  const push = (curve, y2) => {
    segs.push({ i: segs.length, curve, y1: y, y2, tunnel, night, props: [], gate: null, ring: false, pad: null, ramp: null, lip: null });
    y = y2;
  };
  const road = (enter, hold, leave, curve, hill = 0) => {
    const y0 = y,
      yEnd = y0 + hill * RACE_SEG,
      total = enter + hold + leave;
    for (let n = 0; n < enter; n++) push(raceEaseIn(0, curve, n / enter), raceEaseInOut(y0, yEnd, (n + 1) / total));
    for (let n = 0; n < hold; n++) push(curve, raceEaseInOut(y0, yEnd, (enter + n + 1) / total));
    for (let n = 0; n < leave; n++)
      push(raceEaseInOut(curve, 0, n / leave), raceEaseInOut(y0, yEnd, (enter + hold + n + 1) / total));
  };
  road(0, 14, 0, 0);
  const start = segs.length;
  for (const p of RACE_COURSES[tier]) {
    if (p[0] === 's') road(0, p[1], 0, 0, p[2] || 0);
    else if (p[0] === 'c') road(p[1], p[2], p[3], p[4], p[5] || 0);
    else if (p[0] === 'g') gates.push(segs.length);
    else if (p[0] === 't') tunnel = !tunnel;
    else if (p[0] === 'n') night = !night;
    else if (p[0] === 'f') finish = segs.length;
    else marks.push({ p, at: segs.length });
  }
  road(0, RACE_DRAW + 60, 0, 0);
  const course = { segs, start, finish, gates, tier, pads: [], ramps: [], parked: [], signs: [] };
  for (const { p, at } of marks) {
    if (p[0] === 'b') {
      const pad = { z: at + p[2], x: p[1], w: RACE_PAD_W, len: RACE_PAD_LEN };
      course.pads.push(pad);
      for (let i = 0; i < pad.len; i++) segs[pad.z + i].pad = pad;
    } else if (p[0] === 'r') {
      const r = { z: at + p[2], end: at + p[2] + RACE_RAMP_LEN, x: p[1], w: p[3] || RACE_RAMP_W };
      course.ramps.push(r);
      for (let i = r.z; i < r.end; i++) segs[i].ramp = r;
      segs[r.end - 1].lip = r;
    } else if (p[0] === 'o') course.parked.push({ kind: p[1], lane: p[2], z: at + p[3] });
    else if (p[0] === 'i') course.signs.push({ z: at + p[2], text: p[1] });
  }
  raceDecorate(course);
  return course;
}

const RACE_PROP_W = { vend: 0.13, bench: 0.17, plant: 0.07, chair: 0.1, lamp: 0.04, ensure: 0.12, chevron: 0.05, sign: 0.05, post: 0.1 },
  RACE_PROP_H = { vend: 0.5, bench: 0.22, plant: 0.3, chair: 0.32, lamp: 0.9, ensure: 0.25, chevron: 0.4, sign: 0.6, post: 0, tree: 0.9 };

function raceDecorate(course) {
  const { segs, start, finish, gates, tier } = course,
    mix = RACE_TIERS[tier].props,
    kinds = Object.keys(mix),
    total = kinds.reduce((a, k) => a + mix[k], 0),
    h = (i, k) => raceHash(i * 0.731 + k * 17.3 + tier * 41.9);
  segs[start + 8].gate = { kind: 'start' };
  gates.forEach((g, n) => (segs[g].gate = { kind: 'gate', n }));
  segs[finish].gate = { kind: 'finish' };
  for (let i = 4; i < Math.min(segs.length, finish + 90); i++) {
    const s = segs[i];
    if (s.tunnel) {
      s.ring = i % 3 === 0 || !segs[i - 1].tunnel;
      continue;
    }
    if (s.gate) {
      for (const side of [-1, 1]) s.props.push({ kind: 'post', x: side * 1.46, w: 0.1, solid: true });
      continue;
    }
    // Chevrons on the outside of every curve point the way it bends.
    if (Math.abs(s.curve) > 1 && i % 5 === 0) {
      s.props.push({ kind: 'chevron', x: -Math.sign(s.curve) * 1.56, dir: Math.sign(s.curve), w: 0.05, solid: true });
    } else if (i % 10 === 0 && i > start + 6) {
      const side = (i / 10) % 2 ? 1 : -1;
      let r = h(i, 1) * total,
        kind = kinds[0];
      for (const k of kinds) {
        r -= mix[k];
        if (r < 0) {
          kind = k;
          break;
        }
      }
      s.props.push({ kind, x: side * (1.62 + h(i, 2) * 0.35), w: RACE_PROP_W[kind], solid: true, v: h(i, 6) });
    }
    if (i % 7 === 3)
      s.props.push({ kind: 'tree', x: (h(i, 3) < 0.5 ? -1 : 1) * (2.5 + h(i, 4) * 1.8), w: 0, solid: false, v: h(i, 5) });
  }
  const sign = (i, text) => {
    const s = segs[i];
    if (!s || s.tunnel || s.gate) return;
    s.props = s.props.filter(p => p.kind === 'tree');
    s.props.push({ kind: 'sign', x: 1.62, w: RACE_PROP_W.sign, solid: true, text });
  };
  for (const g of gates) sign(g - 100, 'CT GATE 200 m');
  for (const s of course.signs) sign(s.z, s.text);
  sign(finish - 150, 'RADIOLOGY 300 m');
  sign(finish - 50, 'FINISH 100 m');
}

// A racer or a piece of traffic. x eases toward its lane (or tx when set).
function raceCar(o) {
  const spec = o.racer ? RACE_KINDS[o.kind] : RACE_TRAFFIC[o.kind];
  return Object.assign(
    {
      x: RACE_LANES[o.lane],
      v: 0,
      w: spec.w,
      h: spec.h,
      spin: 0,
      wob: 0,
      calm: 0,
      laneT: 0,
      blink: 0,
      air: 0,
      airT: 0,
      out: false,
      near: false,
      knocked: false,
      done: false,
      tx: undefined
    },
    o
  );
}

// Random traffic stays off the run-up and the landing of every ramp (those are set by hand), and
// nothing parks on a boost pad.
function raceSpawnTraffic(course, T) {
  const tr = T.traffic,
    kinds = Object.keys(tr.mix),
    total = kinds.reduce((a, k) => a + tr.mix[k], 0),
    cars = [];
  let z = course.start + tr.from,
    id = 100;
  while (z < course.finish - 40) {
    const ramp = course.ramps.find(r => z > r.z - 45 && z < r.end + 60);
    if (ramp) {
      z = ramp.end + 60 + rand(0, 20);
      continue;
    }
    const lanes = [0, 1, 2],
      n = rand(0, 1) < tr.pair ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const lane = lanes.splice(Math.floor(rand(0, lanes.length)), 1)[0];
      let r = rand(0, total),
        kind = kinds[0];
      for (const q of kinds) {
        r -= tr.mix[q];
        if (r < 0) {
          kind = q;
          break;
        }
      }
      if (!RACE_TRAFFIC[kind].pace && course.pads.some(p => Math.abs(p.z - z) < 14 && Math.abs(p.x - RACE_LANES[lane]) < 0.45))
        kind = 'laundry';
      const car = raceCar({ id: id++, kind, racer: false, z: z + k * rand(0, 5), lane, pace: RACE_TRAFFIC[kind].pace });
      if (kind === 'wheelchair' && rand(0, 1) < tr.weave) car.weave = true;
      cars.push(car);
    }
    z += rand(tr.gap[0], tr.gap[1]);
  }
  for (const o of course.parked) cars.push(raceCar({ id: id++, kind: o.kind, racer: false, z: o.z, lane: o.lane, pace: 0 }));
  return cars;
}

function raceInit() {
  const T = RACE_TIERS[mini.tier],
    course = raceBuildCourse(mini.tier),
    pace = (mini.rules && mini.rules.mini) || 1,
    top = RACE_TOP * (1 + (pace - 1) * 0.5),
    scale = RACE_TOP / top,
    shift = (pace - 1) * 0.12,
    order = [1, 0, 2, 2, 0, 1, 0, 2, 1, 2, 0, 1];
  initArcadeRun(Math.round(T.time * scale));
  const rivals = RACE_FIELDS[mini.tier].map((f, n) =>
    raceCar({
      id: n,
      kind: f[0],
      name: f[1],
      pace: (f[2] * (course.finish - course.start - f[3])) / (course.finish - course.start) + shift,
      z: course.start + f[3],
      lane: order[n],
      look: f[4] || 0,
      encore: f[5] || 0,
      racer: true
    })
  );
  const traffic = raceSpawnTraffic(course, T);
  Object.assign(mini, {
    raceCourse: course,
    raceTop: top,
    raceExt: T.gates.map(t => Math.round(t * scale)),
    raceZ: course.start,
    raceX: 0,
    raceVx: 0,
    raceV: 0,
    raceXLag: 0,
    raceSteer: 0,
    raceOff: false,
    raceSpin: 0,
    raceSpinLen: RACE_SPIN,
    raceSpinOut: false,
    raceSpinDir: 1,
    raceGhost: 0,
    raceShake: 0,
    raceBuzz: 0,
    raceScrape: 0,
    raceBoostT: 0,
    raceNitroT: 0,
    racePadT: 0,
    racePadLast: null,
    raceOffT: 0,
    raceRumble: false,
    raceAir: 0,
    raceAirT: 0,
    raceLift: 0,
    raceBounce: 0,
    raceBoosts: T.boosts,
    raceBalls: T.balls,
    raceRivals: rivals,
    raceCars: rivals.concat(traffic),
    raceShots: [],
    racePops: [],
    racePtrs: [],
    racePlace: rivals.length + 1,
    raceShown: rivals.length + 1,
    raceShownT: 0,
    raceBest: rivals.length + 1,
    raceGateIdx: 0,
    raceGateFlash: 0,
    raceDone: false,
    raceOut: '',
    raceFinal: 0,
    raceStandings: null,
    racePasses: 0,
    raceCrashes: 0,
    raceSpinOuts: 0,
    raceJumps: 0,
    racePads: 0,
    raceHits: 0,
    raceSkyX: 0,
    raceNightK: course.segs[course.start].night ? 1 : 0,
    raceTunnelK: 0,
    raceEngineT: 0,
    raceRumbleT: 0,
    raceBeep: 0
  });
  mini.goal = rivals.length - 2;
  mini.got = 0;
}

// ---- Input ----
// Where a finger sits steers: most of each half is full lock, the strip near the middle steers
// gently, so a drag across the screen steers proportionally.
function raceSteerAt(x, w = activeCanvas().w) {
  const d = (x - w / 2) / (w / 2);
  return Math.abs(d) < 0.03 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d) * 2.5);
}

// Keys win; otherwise the newest finger that is steering.
function raceSteerInput() {
  const l = keys.has('arrowleft') || keys.has('a'),
    r = keys.has('arrowright') || keys.has('d');
  if (l !== r) return l ? -1 : 1;
  const ptrs = mini.racePtrs || [];
  for (let i = ptrs.length - 1; i >= 0; i--) if (ptrs[i].steer) return raceSteerAt(ptrs[i].x);
  return 0;
}

// A press lands: on a gurney up the road it throws a softball at it, anywhere else it steers.
function raceTouchDown(id, p) {
  if (!mini.racePtrs) return;
  mini.racePtrs = mini.racePtrs.filter(q => q.id !== id);
  const car = raceCarAtPoint(p);
  mini.racePtrs.push({ id, x: p.x, y: p.y, steer: !car, trail: [{ y: p.y, t: mini.total }], flickT: -9 });
  if (car) raceThrow(car);
}

// A quick swipe up (45 px inside a quarter second) boosts, once per swipe.
function raceTouchMove(id, p) {
  const q = mini.racePtrs && mini.racePtrs.find(o => o.id === id);
  if (!q) return;
  q.x = p.x;
  q.y = p.y;
  q.trail.push({ y: p.y, t: mini.total });
  while (q.trail.length > 2 && mini.total - q.trail[0].t > 0.25) q.trail.shift();
  const low = Math.max(...q.trail.map(s => s.y));
  if (low - p.y > 45 && mini.total - q.flickT > 0.5) {
    q.flickT = mini.total;
    q.trail = [{ y: p.y, t: mini.total }];
    raceBoost();
  }
}

// A lost pointer (pause, a phone call) drops every finger, so nothing keeps steering on its own.
function raceTouchUp(id, cancel) {
  if (!mini.racePtrs) return;
  mini.racePtrs = cancel && id === 'main' ? [] : mini.racePtrs.filter(q => q.id !== id);
}

// The framework follows one canvas pointer. This capture-phase listener adds the others for this
// game only: a second thumb takes over steering while it is down, and can tap a gurney to throw.
function racePointerEvent(e) {
  if (!(mini.open && mini.id === RACE.id && mini.screen === 'play' && !mini.paused && mini.racePtrs)) return;
  const key = 'p' + e.pointerId,
    known = mini.racePtrs.some(q => q.id === key);
  if (e.type === 'pointerdown') {
    if (e.target === $('miniCanvas') && arcadePointer !== null && e.pointerId !== arcadePointer)
      raceTouchDown(key, miniPoint(e));
  } else if (e.type === 'pointermove') {
    if (known) raceTouchMove(key, miniPoint(e));
  } else if (known) raceTouchUp(key, e.type !== 'pointerup');
}

for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
  window.addEventListener(type, racePointerEvent, true);

function raceBoost() {
  if (mini.raceDone || !mini.raceCourse) return;
  if (mini.raceBoosts <= 0) {
    mini.flash = 0.8;
    mini.flashText = 'NO BOOSTS LEFT · NITRO IS THE ASSIST (E)';
    sfx('miss');
    return;
  }
  if (mini.raceBoostT > 0 || mini.raceSpin > 0) return;
  mini.raceBoosts--;
  mini.raceBoostT = RACE_BOOST;
  mini.raceShake = Math.max(mini.raceShake, 0.12);
  racePop('BOOST', 0.5, 0.6, '#ffd28a', 1);
  sfx('dash');
}

// THROW with no target picks the nearest thing ahead in your line.
function raceThrow(target) {
  if (mini.raceDone || !mini.raceCourse) return;
  if (mini.raceBalls <= 0) {
    mini.flash = 0.8;
    mini.flashText = 'OUT OF SOFTBALLS · STEER AROUND';
    sfx('miss');
    return;
  }
  mini.raceBalls--;
  mini.raceShots.push({ z: mini.raceZ + 0.6, x: mini.raceX, t: 0, target: target || raceThrowTarget(), v: mini.raceV + RACE_BALL_SPEED });
  sfx('throw');
}

function raceThrowTarget() {
  let best = null;
  for (const c of mini.raceCars) {
    if (c.out || c.knocked) continue;
    const dz = c.z - mini.raceZ;
    if (dz < 1 || dz > RACE_BALL_RANGE || Math.abs(c.x - mini.raceX) > 0.5) continue;
    if (!best || dz < best.z - mini.raceZ) best = c;
  }
  return best;
}

// The gurney under a press, if it is up the road and in softball range.
function raceCarAtPoint(p) {
  if (!mini.raceCourse) return null;
  const view = raceView();
  if (p.y > view.H * 0.7) return null;
  let best = null,
    bestDz = Infinity;
  for (const c of mini.raceCars) {
    if (c.out || c.knocked) continue;
    const dz = c.z - mini.raceZ;
    if (dz < 2 || dz > RACE_BALL_RANGE) continue;
    const s = raceSpot(view, c.z, c.x);
    if (!s || s.y > s.clip + 4) continue;
    const half = Math.max(26, c.w * s.w * 1.25 * view.sp),
      top = s.y - Math.max(40, c.h * s.w * 1.15 * view.sp);
    if (p.x > s.x - half && p.x < s.x + half && p.y > top && p.y < s.y + 16 && dz < bestDz) {
      best = c;
      bestDz = dz;
    }
  }
  return best;
}

// ---- Simulation ----
function raceSeg(z) {
  const segs = mini.raceCourse.segs;
  return segs[clamp(Math.floor(z), 0, segs.length - 1)];
}

function raceProgress() {
  const c = mini.raceCourse;
  return c ? clamp((mini.raceZ - c.start) / (c.finish - c.start), 0, 1) : 0;
}

function raceKph() {
  return Math.round(((mini.raceV || 0) / RACE_TOP) * 88);
}

function raceCarName(c) {
  return c.racer ? c.name : RACE_TRAFFIC[c.kind].name;
}

function racePop(text, x, y, col = '#ffe7b0', size = 1, life = 1.2) {
  mini.racePops.push({ text, x, y, col, size, life, max: life });
  if (mini.racePops.length > 7) mini.racePops.shift();
}

function raceUpdate(dt) {
  const n = Math.max(1, Math.ceil(dt / RACE_STEP - 1e-6));
  for (let i = 0; i < n && mini.screen === 'play' && !mini.raceDone; i++) raceStep(dt / n);
  raceEffects(dt);
}

function raceBoosting() {
  return mini.raceNitroT > 0 || mini.raceBoostT > 0 || mini.racePadT > 0;
}

function raceStep(h) {
  const top = mini.raceTop,
    z0 = mini.raceZ,
    seg = raceSeg(z0),
    air = mini.raceAir > 0;
  mini.raceSpin = Math.max(0, mini.raceSpin - h);
  if (mini.raceSpin <= 0) mini.raceSpinOut = false;
  mini.raceGhost = Math.max(0, mini.raceGhost - h);
  mini.raceBoostT = Math.max(0, mini.raceBoostT - h);
  mini.raceNitroT = Math.max(0, mini.raceNitroT - h);
  mini.racePadT = Math.max(0, mini.racePadT - h);
  mini.raceShake = Math.max(0, mini.raceShake - h);
  mini.raceBuzz = Math.max(0, mini.raceBuzz - h);
  mini.raceScrape = Math.max(0, mini.raceScrape - h);
  mini.raceBounce = Math.max(0, mini.raceBounce - h);
  // Steering eases in quickly; a curve pushes outward with the square of your speed. A spin takes
  // the wheel away and slides you sideways (a spin-out slides you back to the edge of the floor).
  // In the air the road bends away under you and the wheel has a third of its grip.
  const steer = mini.raceSpin > 0 ? 0 : raceSteerInput(),
    pct = mini.raceV / top;
  mini.raceSteer = steer;
  const want = steer * RACE_STEER * (0.3 + 0.7 * Math.min(1, pct)) * (air ? 0.35 : 1);
  mini.raceVx += (want - mini.raceVx) * Math.min(1, h * (air ? 5 : 14));
  const push = seg.curve * RACE_CENT * Math.min(1.44, pct * pct),
    slide =
      mini.raceSpin <= 0
        ? 0
        : mini.raceSpinOut
          ? clamp((Math.sign(mini.raceX) * 0.92 - mini.raceX) * 4, -1.3, 1.3) * (Math.abs(mini.raceX) > 0.92 ? 1 : 0)
          : mini.raceSpinDir * 0.2;
  mini.raceX += (mini.raceVx - push + slide) * h;
  const wall = seg.tunnel ? RACE_TUNNEL_WALL : RACE_WALL;
  if (Math.abs(mini.raceX) > wall) {
    mini.raceX = Math.sign(mini.raceX) * wall;
    mini.raceVx = 0;
    if (seg.tunnel && mini.raceV > top * RACE_SCRAPE) {
      mini.raceScrape = 0.15;
      mini.raceShake = Math.max(mini.raceShake, 0.1);
    }
  }
  mini.raceXLag += (mini.raceX - mini.raceXLag) * Math.min(1, h * 2);
  // Speed: the gurney always pushes toward its cap. Grass, walls and spins lower it; boosts and pads
  // raise it. In the air nothing touches the floor, so speed holds.
  const boosting = raceBoosting(),
    edge = Math.abs(mini.raceX) - RACE_EDGE,
    off = !air && edge > 0;
  let cap = top * (mini.raceNitroT > 0 ? RACE_NITRO_MUL : boosting ? RACE_BOOST_MUL : 1);
  if (off) cap = Math.min(cap, top * (seg.tunnel ? RACE_SCRAPE : RACE_GRASS) * (boosting ? 1.2 : 1));
  if (mini.raceSpin > 0) cap = Math.min(cap, top * (mini.raceSpinOut ? RACE_SPINOUT_CAP : RACE_SPIN_CAP));
  const v = mini.raceV;
  if (air) {
    if (boosting && v < cap) mini.raceV = Math.min(cap, v + top * 0.3 * h);
  } else if (v < cap) mini.raceV = Math.min(cap, v + (top * 0.12 + (cap - v) * (boosting ? 1.8 : 0.75)) * h);
  else mini.raceV = Math.max(cap, v - Math.max((v - cap) * 2.5, top * 0.4) * h);
  mini.raceOff = off;
  mini.raceRumble = !air && !seg.tunnel && !off && Math.abs(mini.raceX) > RACE_RUMBLE_X;
  mini.raceZ += mini.raceV * h;
  mini.raceSkyX += seg.curve * pct * h * 0.004;
  raceStepCars(h);
  if (air) {
    mini.raceAir = Math.max(0, mini.raceAir - h);
    if (mini.raceAir <= 0) raceLand();
  } else {
    raceEdge(h, seg, edge);
    racePadCheck();
    const lip = seg.lip;
    if (lip && Math.floor(mini.raceZ) > Math.floor(z0) && Math.abs(mini.raceX - lip.x) < lip.w) raceLaunch(lip);
    else {
      raceHitProps();
      raceHitCars();
    }
  }
  raceStepShots(h);
  raceCheckGates();
  raceCheckPlace(h);
  if (mini.raceZ >= mini.raceCourse.finish) raceFinish();
}

// The edge of the floor. The rumble strip buzzes; past it the gurney is on linoleum or grass and
// slows, and a few tenths of a second out there at speed (less the deeper you go) spins you out.
// A quick graze is only a slowdown. Nitro and a spin already under way are immune.
function raceEdge(h, seg, edge) {
  if (mini.raceRumble) mini.raceBuzz = Math.max(mini.raceBuzz, 0.06);
  if (seg.tunnel || mini.raceSpin > 0 || mini.raceNitroT > 0 || edge <= 0) {
    mini.raceOffT = Math.max(0, mini.raceOffT - h * 2);
    return;
  }
  mini.raceOffT += h * (1 + edge * 3);
  mini.raceBuzz = Math.max(mini.raceBuzz, 0.1 + mini.raceOffT * 0.5);
  if (mini.raceOffT >= RACE_GRAZE[mini.tier] && mini.raceV > mini.raceTop * RACE_SPINOUT_V) raceSpinOut(false);
}

const RACE_SPINOUT_LINES = {
  grass: ['GRASS STAINS ON THE SHEETS', 'THE LAWN SAYS HELLO', 'OFF-ROAD IS NOT COVERED'],
  floor: ['SKIDDED ON THE LINOLEUM', 'FRESHLY WAXED. OOPS.', 'SPIN CYCLE'],
  land: ['LANDED IN THE FLOWERBED', 'STUCK THE LANDING. IN THE GRASS.']
};

// Off the road at speed: two full turns, speed dumped, the wheel gone for a second and a half, then
// you are back on the edge of the floor to pick it up again. Never a heart.
function raceSpinOut(landing) {
  const top = mini.raceTop,
    C = activeCanvas(),
    grass = Math.abs(mini.raceX) > 1.42;
  mini.raceSpin = mini.raceSpinLen = RACE_SPINOUT;
  mini.raceSpinOut = true;
  mini.raceGhost = RACE_SPINOUT + 0.6;
  mini.raceSpinDir = mini.raceX > 0 ? -1 : 1;
  mini.raceV = Math.min(mini.raceV, top * 0.4);
  mini.raceVx = 0;
  mini.raceBoostT = 0;
  mini.racePadT = 0;
  mini.raceOffT = 0;
  mini.raceShake = 0.45;
  mini.raceCrashes++;
  mini.raceSpinOuts++;
  mini.combo = 0;
  racePop(pick(RACE_SPINOUT_LINES[landing ? 'land' : grass ? 'grass' : 'floor']), 0.5, 0.5, '#f8b8b0', 1, 1.4);
  arcadeBurst(C.w / 2, C.h * 0.84, grass || landing ? '#a8d08a' : '#e3dbc4', 18);
  sfx('stun');
}

// Orange arrows: drive over one with your middle on it for a burst. Each pad pays once.
function racePadCheck() {
  const p = raceSeg(mini.raceZ).pad;
  if (!p || mini.racePadLast === p || mini.raceSpin > 0 || Math.abs(mini.raceX - p.x) > p.w + 0.08) return;
  mini.racePadLast = p;
  mini.racePadT = RACE_PAD_T;
  mini.raceV = Math.max(mini.raceV, mini.raceTop * RACE_PAD_KICK);
  mini.racePads++;
  mini.raceShake = Math.max(mini.raceShake, 0.08);
  praise(60);
  racePop('BOOST PAD', 0.5, 0.62, '#ffc36a', 0.9, 0.8);
  sfx('dash');
}

// Off the lip of a wheelchair ramp. Air time and height grow with speed; traffic passes underneath.
function raceLaunch(r) {
  const pct = clamp(mini.raceV / mini.raceTop, 0.3, 1.4);
  mini.raceAir = mini.raceAirT = 0.5 + 0.45 * pct;
  mini.raceLift = RACE_LIFT * pct;
  mini.raceOffT = 0;
  mini.raceJumps++;
  racePop(r.w >= 1 ? 'AIRBORNE' : 'RAMP!', 0.5, 0.38, '#bfe0ff', 1.1, 0.9);
  sfx('jump');
}

// How high a ramp's slope is at (z, x), in road half-widths: zero off the ramp.
function raceRampLift(z, x) {
  const r = raceSeg(z).ramp;
  return r && Math.abs(x - r.x) < r.w ? RACE_RAMP_H * clamp((z - r.z) / RACE_RAMP_LEN, 0, 1) : 0;
}

// Height above the road in world units: up the slope, then off the lip on an arc back down.
function raceLiftNow() {
  if (!mini.raceCourse) return 0;
  if (mini.raceAir <= 0) return raceRampLift(mini.raceZ, mini.raceX) * RACE_ROAD;
  const p = 1 - mini.raceAir / mini.raceAirT;
  return mini.raceLift * 4 * p * (1 - p) + RACE_RAMP_H * RACE_ROAD * (1 - p);
}

function raceCarLift(c) {
  if (c.air <= 0) return raceRampLift(c.z, c.x) * RACE_ROAD;
  const p = 1 - c.air / c.airT;
  return RACE_LIFT * 0.8 * 4 * p * (1 - p) + RACE_RAMP_H * RACE_ROAD * (1 - p);
}

// Touchdown. In the grass at speed it is a spin-out; on top of something, the something loses; on a
// clean floor you get a little kick for sticking it.
function raceLand() {
  const top = mini.raceTop,
    seg = raceSeg(mini.raceZ);
  mini.raceBounce = 0.35;
  mini.raceShake = Math.max(mini.raceShake, 0.16);
  sfx('bounce');
  if (!seg.tunnel && Math.abs(mini.raceX) > RACE_EDGE && mini.raceNitroT <= 0) {
    if (mini.raceV > top * RACE_SPINOUT_V) raceSpinOut(true);
    return;
  }
  let under = null;
  for (const c of mini.raceCars) {
    if (c.out || c.knocked || c.air > 0 || c.chase) continue;
    if (Math.abs(c.z - mini.raceZ) > RACE_LEN + 0.6 || Math.abs(c.x - mini.raceX) >= c.w + RACE_PW) continue;
    under = c;
    c.wob = 0.8;
    if (c.racer) {
      c.spin = Math.max(c.spin, 1.2);
      c.v *= 0.6;
      if (c.kind === 'ralph') c.calm = 6;
    } else {
      c.knocked = true;
      c.tx = (c.x >= mini.raceX ? 1 : -1) * 1.7;
      c.v = 0;
    }
  }
  if (under) {
    mini.raceGhost = Math.max(mini.raceGhost, 0.5);
    racePop('LANDED ON ' + raceCarName(under).toUpperCase() + '. SORRY.', 0.5, 0.46, '#ffe1a0', 0.9, 1.2);
    sfx('hit');
    return;
  }
  mini.raceV = Math.max(mini.raceV, top * 1.06);
  mini.racePadT = Math.max(mini.racePadT, 0.5);
  praise(80);
  racePop('STUCK THE LANDING', 0.5, 0.46, '#b5f0cf', 1, 1);
}

// Traffic sleeps until you are close and retires once you are well past. Rivals always drive; near
// you they follow, change lanes and keep out of your way.
function raceStepCars(h) {
  const z0 = mini.raceZ,
    near = [];
  for (const c of mini.raceCars) {
    if (c.out) continue;
    const dz = c.z - z0;
    if (!c.racer && dz < -RACE_SLEEP) {
      c.out = true;
      continue;
    }
    c.near = dz > -RACE_SLEEP && dz < RACE_WAKE;
    if (c.near) near.push(c);
  }
  for (const c of mini.raceCars) if (!c.out && (c.racer || c.near)) raceDriveCar(c, h, c.near ? near : null);
}

function raceDriveCar(c, h, near) {
  const top = mini.raceTop;
  c.spin = Math.max(0, c.spin - h);
  c.wob = Math.max(0, c.wob - h);
  c.calm = Math.max(0, c.calm - h);
  c.laneT = Math.max(0, c.laneT - h);
  let want = c.pace * top * (c.racer ? 1 + 0.025 * Math.sin(mini.total * 0.55 + c.id * 1.7) : 1) * raceBand(c),
    lat = c.racer ? 1 : 0.55;
  if (c.kind === 'ralph' && c.encore !== undefined) raceRalphEncore(c);
  if (c.knocked) {
    want = 0;
    lat = 2.6;
  } else if (c.spin > 0) want = Math.min(want, top * 0.25);
  else if (c.chase) {
    want = top * 1.2;
    lat = 1.4;
  } else if (near) {
    const ahead = raceAhead(c, near);
    if (ahead) {
      if (ahead.v < want - 0.5 && ahead.dz < 18 && c.laneT <= 0 && c.pace > 0) raceChangeLane(c, near);
      if (ahead.dz < 5) want = Math.min(want, ahead.v * (ahead.dz < 2.4 ? 0.85 : 1));
    }
    if (c.kind === 'ralph') lat = raceRalph(c);
    if (c.weave) raceWeave(c, h);
  }
  const tx = c.tx !== undefined ? c.tx : RACE_LANES[c.lane];
  c.x += clamp(tx - c.x, -lat * h, lat * h);
  if (c.v < want) c.v = Math.min(want, c.v + (top * 0.12 + (want - c.v) * 0.75) * h);
  else c.v = Math.max(want, c.v - Math.max((c.v - want) * 2.5, top * 0.25) * h);
  const z0 = c.z;
  c.z = Math.min(c.z + c.v * h, mini.raceCourse.segs.length - 3);
  // Rivals and traffic fly the ramps too.
  if (c.air > 0) c.air = Math.max(0, c.air - h);
  else {
    const lip = raceSeg(z0).lip;
    if (lip && Math.floor(c.z) > Math.floor(z0) && Math.abs(c.x - lip.x) < lip.w) c.air = c.airT = 0.45 + 0.45 * clamp(c.v / top, 0.3, 1.2);
  }
  if (c.racer && !c.done && c.z >= mini.raceCourse.finish) {
    c.done = true;
    c.doneT = mini.total;
  }
}

// Arcade bunching: a rival far ahead of Macy lifts off a little and one far behind leans on it, so
// the race stays a race whether she is struggling or flying. Ralph keeps his own pace.
function raceBand(c) {
  if (!c.racer || c.done || c.kind === 'ralph') return 1;
  const gap = c.z - mini.raceZ;
  if (gap > 40) return 1 - Math.min(RACE_BAND_AHEAD, (gap - 40) / 2400);
  if (gap < -60) return 1 + Math.min(RACE_BAND_BEHIND, (-gap - 60) / 3000);
  return 1;
}

// The nearest thing in a car's path, Macy included, so nobody drives through her.
function raceAhead(c, near) {
  let best = null;
  const reach = c.w + 0.06;
  for (const o of near) {
    if (o === c || o.knocked) continue;
    const dz = o.z - c.z;
    if (dz <= 0 || dz > 22 || Math.abs(o.x - c.x) > reach + o.w) continue;
    if (!best || dz < best.dz) best = { o, dz, v: o.v };
  }
  const dz = mini.raceZ - c.z;
  if (dz > 0 && dz < 22 && Math.abs(mini.raceX - c.x) < reach + RACE_PW && (!best || dz < best.dz))
    best = { o: null, dz, v: mini.raceV };
  return best;
}

// Move over to a neighboring lane with room ahead, and never into Macy's path when she is close.
function raceChangeLane(c, near) {
  let pickL = -1,
    pickRoom = 0;
  for (const L of [c.lane - 1, c.lane + 1]) {
    if (L < 0 || L > 2) continue;
    const x = RACE_LANES[L];
    let room = 40;
    for (const o of near) {
      if (o === c || o.knocked) continue;
      if (Math.abs(o.x - x) > 0.45 && Math.abs(RACE_LANES[o.lane] - x) > 0.45) continue;
      const dz = o.z - c.z;
      if (dz > -4 && dz < 3) {
        room = -1;
        break;
      }
      if (dz >= 3 && dz < room && o.v < c.pace * mini.raceTop) room = dz;
    }
    // Nobody swerves into Macy's line less than about a second before she would reach them.
    const pz = mini.raceZ - c.z,
      close = Math.max(0, mini.raceV - c.v);
    if (Math.abs(mini.raceX - x) < 0.5 && pz > -9 - close && pz < 4) room = -1;
    if (room > 14 && room > pickRoom) {
      pickRoom = room;
      pickL = L;
    }
  }
  if (pickL >= 0) {
    c.lane = pickL;
    c.laneT = 0.9;
  }
}

// Ralph sees you coming and parks his bed in your line, a beat late. Once you are past him, or he
// has knocked you into a spin, he has made his point and keeps to his lane. Returns his sideways speed.
function raceRalph(c) {
  const dz = c.z - mini.raceZ;
  if (dz < -1.5) c.passedT = mini.total;
  if (c.calm > 0 || c.spin > 0 || dz <= -1 || dz > 32 || mini.total - (c.passedT ?? -99) < 12) {
    c.blocking = false;
    c.tx = undefined;
    return 0.7;
  }
  if (!c.blocking) {
    c.blocking = true;
    if (!c.taunted) {
      c.taunted = true;
      racePop(c.round2 ? 'RALPH: ROUND TWO.' : 'RALPH: MY HALLWAY.', 0.5, 0.3, '#e3c8ff', 1.1, 1.8);
      sfx('boss');
    }
  }
  c.tx = clamp(mini.raceXLag, -0.72, 0.72);
  return 0.7;
}

// On Legendary Ralph does not stay passed. A few seconds after you get by him he finds the turbo
// button, ghosts up the far lane past you and gets back in front, then he is a slow bed again and
// blocks one more time.
function raceRalphEncore(c) {
  if (c.chase) {
    c.tx = Math.abs(mini.raceX - RACE_LANES[0]) > Math.abs(mini.raceX - RACE_LANES[2]) ? RACE_LANES[0] : RACE_LANES[2];
    if (c.z - mini.raceZ > 45 || c.z >= mini.raceCourse.finish - 60) {
      c.chase = false;
      c.tx = undefined;
      c.lane = 1;
      c.passedT = -99;
      c.taunted = false;
      c.round2 = true;
    }
    return;
  }
  if (c.encore <= 0 || c.done) return;
  if (c.passedAt === undefined) {
    if (c.z < mini.raceZ - 1.5) c.passedAt = mini.total;
    return;
  }
  if (mini.total - c.passedAt > 5 && mini.raceZ - c.z > 25 && mini.raceZ < mini.raceCourse.finish - 500) {
    c.encore--;
    c.chase = true;
    c.spin = 0;
    c.calm = 0;
    c.blocking = false;
    racePop('RALPH FOUND THE TURBO BUTTON', 0.5, 0.3, '#e3c8ff', 1, 1.8);
    sfx('boss');
  }
}

// Some wheelchairs on level 3 drift a lane over, after blinking for a second.
function raceWeave(c, h) {
  if (c.blink > 0) {
    c.blink -= h;
    if (c.blink <= 0) {
      c.lane = c.nextLane;
      c.weave = false;
    }
    return;
  }
  const dz = c.z - mini.raceZ;
  if (dz > 30 && dz < 100) {
    c.nextLane = c.lane === 1 ? (raceHash(c.id) < 0.5 ? 0 : 2) : 1;
    c.blink = 1.1;
  }
}

function raceHitCars() {
  if (mini.raceGhost > 0) return;
  for (const c of mini.raceCars) {
    if (c.out || c.knocked || c.air > 0 || c.chase || !(c.near || c.racer)) continue;
    const dz = c.z - mini.raceZ;
    if (dz > RACE_LEN || dz < -RACE_LEN || Math.abs(c.x - mini.raceX) >= c.w + RACE_PW) continue;
    if (dz > -0.3) {
      raceCrash(c, null);
      return;
    }
    c.v = Math.min(c.v, mini.raceV * 0.9);
  }
}

function raceHitProps() {
  if (mini.raceGhost > 0 || Math.abs(mini.raceX) < 1.25) return;
  for (const p of raceSeg(mini.raceZ).props)
    if (p.solid && Math.abs(p.x - mini.raceX) < p.w + RACE_PW) {
      raceCrash(null, p);
      return;
    }
}

const RACE_CRASH_LINES = {
  cart: 'MED CART: UNAMUSED',
  iv: 'IV POLE: STILL ROLLING',
  barb: 'BARB SAYS WATCH IT',
  ralph: 'RALPH SAYS NO',
  laundry: 'LAUNDRY EVERYWHERE',
  wheelchair: 'SORRY. SO SORRY.',
  wetfloor: 'WET FLOOR · CONFIRMED',
  parked: 'PARKED MEANS PARKED',
  vend: 'VENDING MACHINE 1 · MACY 0',
  bench: 'BENCH PRESSED',
  plant: 'THE FICUS STAYS',
  chair: 'WHEELCHAIR PILE-UP',
  lamp: 'LAMP POST · OOF',
  ensure: 'ENSURE EVERYWHERE',
  chevron: 'THE SIGN SAID CURVE',
  sign: 'READ THE SIGN, NOT THE SIGNPOST',
  post: 'DONUT 1 · GURNEY 0'
};

// A crash spins you out and costs speed. It never costs a heart.
function raceCrash(c, prop) {
  const top = mini.raceTop,
    C = activeCanvas();
  mini.raceSpin = mini.raceSpinLen = RACE_SPIN;
  mini.raceSpinOut = false;
  mini.raceGhost = RACE_SPIN + RACE_GHOST;
  mini.raceSpinDir = c ? (mini.raceX >= c.x ? 1 : -1) : mini.raceX > 0 ? -1 : 1;
  mini.raceV = Math.min(mini.raceV, top * 0.65);
  mini.raceVx = 0;
  mini.raceShake = 0.5;
  mini.raceCrashes++;
  mini.combo = 0;
  if (c) {
    c.wob = 0.7;
    if (c.kind === 'ralph') {
      c.calm = 6;
      c.blocking = false;
      c.tx = undefined;
      c.lane = mini.raceX > 0 ? 0 : 2;
    }
    if (!c.racer) {
      c.knocked = true;
      c.tx = (c.x >= mini.raceX ? 1 : -1) * 1.7;
      c.v = 0;
    } else {
      // A bumped rival lurches ahead and moves over a lane, so one bump does not become five.
      c.v = Math.max(c.v, mini.raceV + 2);
      if (c.kind !== 'ralph' && c.laneT <= 0) {
        const away = c.x >= mini.raceX ? 1 : -1,
          to = c.lane + away >= 0 && c.lane + away <= 2 ? c.lane + away : c.lane - away;
        c.lane = clamp(to, 0, 2);
        c.laneT = 1.2;
      }
    }
  }
  const line = c ? (c.kind === 'gremlin' ? 'BUMPED ' + c.name.toUpperCase() : RACE_CRASH_LINES[c.kind]) : RACE_CRASH_LINES[prop.kind];
  racePop(line || 'SPUN OUT', 0.5, 0.5, '#f8b8b0', 1, 1.3);
  arcadeBurst(C.w / 2, C.h * 0.84, '#f4d7b2', 14);
  sfx('hurt');
}

function raceStepShots(h) {
  for (const s of mini.raceShots) {
    s.t += h;
    s.z += s.v * h;
    const tg = s.target;
    if (tg && !tg.out && !tg.knocked) s.x += clamp(tg.x - s.x, -3 * h, 3 * h);
    for (const c of mini.raceCars) {
      if (c.out || c.knocked || c.z <= mini.raceZ) continue;
      if (Math.abs(c.z - s.z) < 1.5 && Math.abs(c.x - s.x) < c.w + 0.1) {
        raceBonk(c);
        s.t = 99;
        break;
      }
    }
    if (s.z - mini.raceZ > RACE_BALL_RANGE + 5) s.t = 99;
  }
  mini.raceShots = mini.raceShots.filter(s => s.t < 5);
}

// A softball spins a racer out of your line, knocks traffic to the curb, and calms Ralph down.
function raceBonk(c) {
  mini.raceHits++;
  praise(150);
  sfx('hit');
  c.wob = 0.8;
  if (c.racer) {
    c.spin = c.kind === 'ralph' ? 2.2 : 1.5;
    c.v *= 0.45;
    if (c.kind === 'ralph') {
      c.calm = 5;
      c.blocking = false;
      c.tx = undefined;
    }
    c.lane = c.x <= mini.raceX ? Math.max(0, Math.min(c.lane, 1) - (c.lane > 0 ? 1 : 0)) : Math.min(2, Math.max(c.lane, 1) + (c.lane < 2 ? 1 : 0));
    c.laneT = 1.5;
  } else {
    c.knocked = true;
    c.tx = (c.x >= mini.raceX ? 1 : -1) * 1.7;
    c.v = 0;
  }
  racePop('BONK · ' + raceCarName(c).toUpperCase(), 0.5, 0.34, '#ffe1a0', 1, 1);
}

function raceCheckGates() {
  const gates = mini.raceCourse.gates;
  while (mini.raceGateIdx < gates.length && mini.raceZ >= gates[mini.raceGateIdx]) {
    const add = mini.raceExt[mini.raceGateIdx++];
    mini.limit += add;
    mini.raceGateFlash = 1.6;
    praise(200);
    racePop('CHECKPOINT +' + add + ' s', 0.5, 0.28, '#b5f0cf', 1.25, 1.6);
    sfx('coin');
  }
}

function racePlaceNow() {
  let p = 1;
  for (const c of mini.raceRivals) if (c.done || c.z > mini.raceZ) p++;
  return p;
}

// Places change for real at once; the readout and the pop wait a moment so side-by-side jostling
// does not flicker.
function raceCheckPlace(h) {
  const p = racePlaceNow();
  mini.racePlace = p;
  mini.got = mini.raceRivals.length + 1 - p;
  if (p === mini.raceShown) {
    mini.raceShownT = 0;
    return;
  }
  mini.raceShownT += h;
  if (mini.raceShownT < 0.3) return;
  const before = mini.raceShown;
  mini.raceShown = p;
  mini.raceShownT = 0;
  if (p < before) {
    mini.racePasses += before - p;
    if (p < mini.raceBest) {
      praise(100 * (mini.raceBest - p));
      mini.raceBest = p;
    }
    sfx('combo', { count: Math.min(8, mini.raceRivals.length + 1 - p) });
    racePop(p <= 3 && before > 3 ? 'PODIUM · ' + RACE_ORD[p] : RACE_ORD[p], 0.5, 0.42, p <= 3 ? '#ffe1a0' : '#e8f4dc', 1.6);
  } else racePop(RACE_ORD[p], 0.5, 0.42, '#f8b8b0', 1, 0.9);
}

function raceStandings() {
  const ahead = mini.raceRivals
      .filter(c => c.done || c.z > mini.raceZ)
      .sort((a, b) => (a.done && b.done ? a.doneT - b.doneT : a.done ? -1 : b.done ? 1 : b.z - a.z)),
    behind = mini.raceRivals.filter(c => !ahead.includes(c)).sort((a, b) => b.z - a.z);
  return [...ahead.map(c => c.name), state.name || 'Macy', ...behind.map(c => c.name)];
}

function raceStandingsLine() {
  const s = mini.raceStandings || raceStandings();
  return 'Podium: ' + s.slice(0, 3).map((n, i) => i + 1 + '. ' + n).join(', ') + '.';
}

function raceFinish() {
  if (mini.raceDone) return;
  mini.raceDone = true;
  mini.raceAir = 0;
  const place = racePlaceNow(),
    field = mini.raceRivals.length + 1,
    win = place <= 3;
  mini.raceFinal = mini.racePlace = mini.raceShown = place;
  mini.raceStandings = raceStandings();
  mini.raceOut = win ? '' : 'place';
  praise([0, 1200, 800, 500][place] || 100);
  mini.score += Math.round(Math.max(0, mini.limit - mini.phaseTime) * 25);
  finishMini(
    win,
    win
      ? undefined
      : `Finished ${RACE_ORD[place]} of ${field}. The podium is three gurneys wide. Pass more, crash less, and save a boost for the last straight.`
  );
}

// Once a frame: pops age, night and tunnel light fade, the engine hums, the last seconds tick.
function raceEffects(dt) {
  for (const p of mini.racePops) p.life -= dt;
  mini.racePops = mini.racePops.filter(p => p.life > 0);
  mini.raceGateFlash = Math.max(0, mini.raceGateFlash - dt);
  const seg = raceSeg(mini.raceZ);
  mini.raceNightK += ((seg.night ? 1 : 0) - mini.raceNightK) * Math.min(1, dt * 1.2);
  mini.raceTunnelK += ((seg.tunnel ? 1 : 0) - mini.raceTunnelK) * Math.min(1, dt * 3);
  if (mini.screen !== 'play') return;
  mini.raceEngineT -= dt;
  if (mini.raceEngineT <= 0) {
    const pct = mini.raceV / mini.raceTop,
      boost = raceBoosting();
    tone(70 + 120 * Math.min(1.4, pct) + (boost ? 40 : 0) + (mini.raceAir > 0 ? 30 : 0), 0.07, 'sawtooth', 0.006 + 0.004 * Math.min(1, pct));
    mini.raceEngineT = 0.09 - 0.035 * Math.min(1, pct);
  }
  // The rumble strip and the edge growl, so the warning reaches you without looking.
  mini.raceRumbleT -= dt;
  if ((mini.raceRumble || mini.raceOff) && mini.raceSpin <= 0 && mini.raceRumbleT <= 0) {
    tone(mini.raceOff ? 38 : 52, 0.05, 'square', mini.raceOff ? 0.016 : 0.011);
    mini.raceRumbleT = 0.07;
  }
  const left = Math.ceil(mini.limit - mini.phaseTime);
  if (left <= 5 && left > 0 && left !== mini.raceBeep) {
    mini.raceBeep = left;
    sfx('countdown');
  }
}

// ---- Projection ----
// The camera rides RACE_EYE behind the gurney and RACE_CAM above the road. hy is the horizon; fx and
// fy turn projected world units into pixels. The tall canvas raises the horizon so the road fills it.
function raceFrame(C) {
  const W = C.w,
    H = C.h,
    tall = H > W,
    hy = H * (tall ? 0.3 : 0.4);
  // sp: sprites draw a little larger than the road on the narrow canvas, so a phone can read them.
  return { W, H, tall, hy, fy: H * 0.93 - hy, fx: W * (tall ? 0.33 : 0.27), u: tall ? W / 400 : H / 500, sp: tall ? 1.25 : 1 };
}

// Projects every segment from the camera forward. Each row keeps its clip: the highest point of the
// road drawn in front of it, which hides whatever sits behind a crest.
function raceView(C = activeCanvas(), z = mini.raceZ) {
  const F = raceFrame(C),
    segs = mini.raceCourse.segs,
    camZ = z * RACE_SEG - RACE_EYE,
    ps = raceSeg(z),
    pf = z - Math.floor(z),
    py = ps.y1 + (ps.y2 - ps.y1) * pf,
    camY = py + RACE_CAM + raceLiftNow() * RACE_CAM_LIFT,
    camX = mini.raceX * RACE_ROAD,
    base = clamp(Math.floor(camZ / RACE_SEG), 0, segs.length - 1),
    bf = camZ / RACE_SEG - base,
    rows = [];
  let x = 0,
    dx = -segs[base].curve * bf,
    maxy = F.H;
  for (let n = 0; n < RACE_DRAW && base + n < segs.length; n++) {
    const s = segs[base + n],
      z1 = (base + n) * RACE_SEG - camZ,
      r = { s, n, clip: maxy, vis: false, ok: z1 > 20 };
    if (r.ok) {
      const k1 = RACE_DEPTH / z1,
        k2 = RACE_DEPTH / (z1 + RACE_SEG);
      r.x1 = F.W / 2 + k1 * (x - camX) * F.fx;
      r.y1 = F.hy - k1 * (s.y1 - camY) * F.fy;
      r.w1 = k1 * RACE_ROAD * F.fx;
      r.x2 = F.W / 2 + k2 * (x + dx - camX) * F.fx;
      r.y2 = F.hy - k2 * (s.y2 - camY) * F.fy;
      r.w2 = k2 * RACE_ROAD * F.fx;
      if (r.y2 < r.y1 && r.y2 < maxy) {
        r.vis = true;
        maxy = r.y2;
      }
    }
    x += dx;
    dx += s.curve;
    rows.push(r);
  }
  return Object.assign(F, { rows, base, py, glows: [], tags: [] });
}

// Screen point of road position (z, ox): x, y, w (pixels per half-width) and the clip line there.
function raceSpot(view, z, ox) {
  const r = view.rows[Math.floor(z) - view.base];
  if (!r || !r.ok) return null;
  const f = z - Math.floor(z),
    w = r.w1 + (r.w2 - r.w1) * f;
  return { x: r.x1 + (r.x2 - r.x1) * f + ox * w, y: r.y1 + (r.y2 - r.y1) * f, w, clip: r.clip };
}

// ---- Drawing ----
function drawRace(g) {
  if (!mini.raceCourse) return;
  const outro = mini.screen === 'outro',
    v = raceView(activeCanvas(), outro ? mini.raceZ + raceCoast() : mini.raceZ);
  g.save();
  if (mini.raceShake > 0 && !reduced && !outro) {
    const a = mini.raceShake * 16 * v.u;
    g.translate(v.W / 2 + Math.sin(mini.total * 91) * a, v.H / 2 + Math.cos(mini.total * 77) * a * 0.6);
    g.scale(1.04, 1.04);
    g.translate(-v.W / 2, -v.H / 2);
  }
  // The rumble strip and the edge buzz the whole picture: small, fast, and growing the longer you stay out.
  if (mini.raceBuzz > 0 && !reduced && !outro) {
    const a = Math.min(0.3, mini.raceBuzz) * 26 * v.u;
    g.translate(Math.sin(mini.total * 131) * a, Math.cos(mini.total * 97) * a * 0.7);
  }
  raceDrawSky(g, v);
  raceDrawRoad(g, v);
  raceDrawSprites(g, v);
  raceDrawDark(g, v);
  raceDrawGurney(g, v);
  raceDrawSpeed(g, v);
  g.restore();
  raceDrawHud(g, v);
}

// After the line the gurney coasts on under the finish card.
function raceCoast() {
  const t = Math.min(mini.transition || 0, 2.2);
  return (mini.raceV || 0) * t * Math.max(0, 1 - t / 4.4);
}

function raceDrawSky(g, v) {
  const { W, H, hy, u } = v,
    off = mini.raceSkyX * W;
  rect(g, 0, 0, W, hy + 2, gradient(g, 0, 0, 0, hy, '#79bcc4', '#f2d6a6'));
  glow(g, W * 0.7 - ((off * 0.15) % W), hy * 0.66, hy * 0.75, '#fff3cc66');
  path(
    g,
    p => {
      p.moveTo(0, hy + 2);
      for (let x = 0; x <= W + 1; x += W / 32)
        p.lineTo(x, hy - (16 + 10 * Math.sin((x + off * 0.3) * 0.011 / u) + 7 * Math.sin((x + off * 0.3) * 0.029 / u + 1)) * u);
      p.lineTo(W, hy + 2);
      p.closePath();
    },
    '#93bdb3'
  );
  raceSkyline(g, v, off * 0.7);
  rect(g, 0, hy, W, H - hy, '#7aad78');
}

// The hospital campus on the horizon: blocks of wards with windows, an H on the tall one.
function raceSkyline(g, v, off) {
  const { W, hy, u } = v,
    bw = 64 * u,
    first = Math.floor(off / bw) - 1,
    night = mini.raceNightK;
  for (let k = first; k < first + W / bw + 3; k++) {
    const m = ((k % 41) + 41) % 41,
      a = raceHash(m),
      b = raceHash(m + 50);
    if (a < 0.18) continue;
    const x = k * bw - off,
      w = bw * (0.7 + 0.5 * b),
      h = (16 + 58 * a * a) * u,
      top = hy - 6 * u - h;
    rect(g, x, top, w, h + 8 * u, m % 2 ? '#6b98a0' : '#5d8c95');
    rect(g, x, top, w, 3 * u, '#84b0b4');
    for (let r = top + 8 * u; r < hy - 10 * u; r += 9 * u)
      for (let c = x + 5 * u; c < x + w - 6 * u; c += 9 * u)
        rect(g, c, r, 4 * u, 4 * u, night > 0.5 && raceHash(r * 0.37 + c * 0.11) > 0.55 ? '#ffe7a3' : '#d9ece6aa');
    if (m === 7) {
      rr(g, x + w / 2 - 9 * u, top - 22 * u, 18 * u, 18 * u, 3 * u, '#2f6fa8');
      label(g, 'H', x + w / 2, top - 8 * u, 13 * u, '#ffffff', 'center');
    }
  }
}

function raceQuad(g, x1, y1, w1, x2, y2, w2, col) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x1 - w1, y1);
  g.lineTo(x1 + w1, y1);
  g.lineTo(x2 + w2, y2);
  g.lineTo(x2 - w2, y2);
  g.closePath();
  g.fill();
}

// Far to near, each row a hair taller so no seams show. A row half behind a crest is trimmed to its
// clip, so nothing overdraws the hill.
function raceDrawRoad(g, v) {
  const { W } = v;
  for (let n = v.rows.length - 1; n >= 0; n--) {
    const r = v.rows[n];
    if (!r.vis) continue;
    let { x1, y1, w1 } = r;
    const { x2, y2, w2, s } = r;
    if (y1 > r.clip) {
      const t = (r.clip - y2) / (y1 - y2);
      x1 = x2 + (x1 - x2) * t;
      w1 = w2 + (w1 - w2) * t;
      y1 = r.clip;
    }
    const band = Math.floor(s.i / RACE_RUMBLE) % 2,
      h = y1 - y2 + 1;
    y1 += 0.6;
    rect(g, 0, y2, W, h, band ? '#87b983' : '#79ac77');
    if (s.tunnel) raceQuad(g, x1, y1, w1 * 1.6, x2, y2, w2 * 1.6, band ? '#8ea4a6' : '#7f9799');
    else raceQuad(g, x1, y1, w1 * 1.42, x2, y2, w2 * 1.42, band ? '#e3dbc4' : '#d2cab1');
    raceQuad(g, x1, y1, w1 * 1.1, x2, y2, w2 * 1.1, band ? '#f3ecd8' : '#de7a76');
    raceQuad(g, x1, y1, w1, x2, y2, w2, band ? '#647b8b' : '#5c7384');
    if (band) for (const L of [-1 / 3, 1 / 3]) raceQuad(g, x1 + L * w1, y1, w1 * 0.022, x2 + L * w2, y2, w2 * 0.022, '#f4edd4');
    if (s.pad) raceDrawPad(g, v, s, x1, y1, w1, x2, y2, w2);
    if (s.gate) raceDrawLine(g, s.gate.kind, x1, y1, w1, x2, y2, w2);
  }
}

// A boost pad: orange panel, one chevron per segment pointing up the road, lit in a wave that runs
// away from you.
function raceDrawPad(g, v, s, x1, y1, w1, x2, y2, w2) {
  const p = s.pad,
    a1 = x1 + p.x * w1,
    a2 = x2 + p.x * w2,
    h1 = p.w * w1,
    h2 = p.w * w2,
    k = s.i - p.z,
    lit = (((k - Math.floor(mini.total * 9)) % 4) + 4) % 4 === 0;
  raceQuad(g, a1, y1, h1, a2, y2, h2, '#d9662e');
  const ym = y1 - (y1 - y2) * 0.5,
    am = (a1 + a2) / 2;
  poly(g, [[a1 - h1 * 0.8, y1], [am, y2 + (y1 - y2) * 0.1], [a1 + h1 * 0.8, y1], [a1 + h1 * 0.4, y1], [am, ym], [a1 - h1 * 0.4, y1]], lit ? '#fff1b8' : '#ffc04a');
  if (raceDark() > 0.05 && h1 > 3) v.glows.push({ x: am, y: ym, r: h1 * 1.2, col: lit ? '#ffc86a66' : '#ff9a4a33' });
}

// The start and finish are checkered; a donut gate paints a mint band across the road.
function raceDrawLine(g, kind, x1, y1, w1, x2, y2, w2) {
  if (kind === 'gate') {
    raceQuad(g, x1, y1, w1, x2, y2, w2, '#8fe3c4');
    return;
  }
  const cols = 10,
    ym = (y1 + y2) / 2,
    xm = (x1 + x2) / 2,
    wm = (w1 + w2) / 2;
  for (let row = 0; row < 2; row++) {
    const [ya, xa, wa, yb, xb, wb] = row ? [ym, xm, wm, y2, x2, w2] : [y1, x1, w1, ym, xm, wm];
    for (let c = 0; c < cols; c++) {
      if ((c + row) % 2) continue;
      const u0 = -1 + (2 * c) / cols,
        u1 = u0 + 2 / cols;
      g.fillStyle = '#f7f3e8';
      g.beginPath();
      g.moveTo(xa + u0 * wa, ya);
      g.lineTo(xa + u1 * wa, ya);
      g.lineTo(xb + u1 * wb, yb);
      g.lineTo(xb + u0 * wb, yb);
      g.closePath();
      g.fill();
    }
  }
}

// Far to near: props, donut rings, cars and softballs, each clipped by the road in front of it.
function raceDrawSprites(g, v) {
  const byRow = new Map();
  for (const c of mini.raceCars) {
    if (c.out) continue;
    const n = Math.floor(c.z) - v.base;
    if (n < 1 || n >= v.rows.length) continue;
    if (!byRow.has(n)) byRow.set(n, []);
    byRow.get(n).push(c);
  }
  for (let n = v.rows.length - 1; n >= 1; n--) {
    const r = v.rows[n];
    if (!r.ok) continue;
    const cars = byRow.get(n);
    if (cars) {
      cars.sort((a, b) => b.z - a.z);
      for (const c of cars) raceDrawCar(g, v, c);
    }
    for (const sh of mini.raceShots) if (Math.floor(sh.z) - v.base === n) raceDrawShot(g, v, sh);
    if (r.s.lip) raceDrawRamp(g, v, r.s.lip);
    if (n < 115) for (const p of r.s.props) raceDrawProp(g, v, r, p);
    if (r.s.gate || r.s.ring) raceDrawDonut(g, v, r);
  }
}

function raceClip(g, v, y, clip, draw) {
  if (y <= clip + 0.5) {
    draw();
    return;
  }
  g.save();
  g.beginPath();
  g.rect(0, 0, v.W, clip);
  g.clip();
  draw();
  g.restore();
}

function raceDark() {
  return Math.max(mini.raceNightK, mini.raceTunnelK * 0.6);
}

function raceDrawCar(g, v, c) {
  const s = raceSpot(v, c.z, c.x);
  if (!s || s.w < 1.2) return;
  const lift = (raceCarLift(c) * s.w * v.fy) / (RACE_ROAD * v.fx),
    k = (s.w / RACE_ART) * v.sp,
    top = s.y - lift - c.h * s.w * v.sp;
  if (s.x < -s.w || s.x > v.W + s.w || top >= s.clip) return;
  raceClip(g, v, s.y, s.clip, () => {
    if (c.air > 0) ellipse(g, s.x, s.y, c.w * s.w * 1.1, Math.max(1, s.w * 0.05), '#10303f40');
    raceCarArt(g, c, s.x, s.y - lift, k);
  });
  if (raceDark() > 0.05 && !c.knocked && s.y < s.clip + 2)
    for (const d of [-1, 1])
      v.glows.push({ x: s.x + d * c.w * s.w * 0.75, y: s.y - lift - s.w * 0.12, r: Math.max(3, s.w * 0.13), col: '#ff5a4acc' });
  const dz = c.z - mini.raceZ;
  if (c.racer && dz > 0 && dz < 45 && s.y < s.clip + 2) v.tags.push({ x: s.x, y: top - 4 * v.u, c, dz });
}

const RACE_TINTS = ['#e3f3cd', '#f6dcee', '#fbe5c6', '#d9f1f8'];

function raceCarArt(g, c, x, y, k) {
  const t = mini.total + c.id * 0.7;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  if (c.knocked) {
    g.rotate(Math.sign(c.tx || 1) * 1.1);
    g.translate(0, -10);
  } else if (c.spin > 0) g.scale(Math.cos(c.spin * 9) || 0.05, 1);
  else if (c.wob > 0) g.rotate(Math.sin(c.wob * 30) * 0.15 * c.wob);
  if (c.kind === 'gremlin') raceGurneyArt(g, 0, 0, 1, { rider: c.look, tint: RACE_TINTS[c.look], t });
  else if (c.kind === 'cart') raceCartArt(g, c, t);
  else if (c.kind === 'iv') {
    ivStand(g, 0, 0, 1.45);
    gremlin(g, 14, -50, 0.55, 0, t);
  } else if (c.kind === 'barb') raceBarbArt(g, t);
  else if (c.kind === 'ralph') raceRalphArt(g, c, t);
  else if (c.kind === 'laundry') raceLaundryArt(g);
  else if (c.kind === 'wheelchair') raceChairArt(g, t, true);
  else if (c.kind === 'wetfloor') raceWetArt(g);
  else raceGurneyArt(g, 0, 0, 1, { sheet: true, t });
  if (c.blink > 0 && Math.sin(mini.total * 18) > 0) {
    const d = c.nextLane > c.lane ? 1 : -1;
    poly(g, [[d * 40, -70], [d * 40, -40], [d * 64, -55]], '#ffc04a');
  }
  g.restore();
}

function raceDrawShot(g, v, sh) {
  const s = raceSpot(v, sh.z, sh.x);
  if (!s || s.y > s.clip) return;
  const arc = Math.sin(clamp(sh.t / 0.7, 0, 1) * Math.PI) * 0.3 + 0.2;
  softball(g, s.x, s.y - arc * s.w, Math.max(3, s.w * 0.07 * v.sp));
}

function raceDrawProp(g, v, r, p) {
  if (p.kind === 'post') return;
  const w = r.w1,
    x = r.x1 + p.x * w,
    y = r.y1,
    k = (w / RACE_ART) * (v.tall ? 1.12 : 1);
  if (k < 0.02 || x < -w * 1.3 || x > v.W + w * 1.3) return;
  if (y - (RACE_PROP_H[p.kind] || 0.4) * w * 1.4 >= r.clip) return;
  raceClip(g, v, y, r.clip, () => racePropArt(g, p, x, y, k));
  const dark = raceDark();
  if (dark > 0.05 && y < r.clip) {
    if (p.kind === 'lamp') v.glows.push({ x: x + 22 * k, y: y - 196 * k, r: Math.max(6, 60 * k), col: '#ffe9a6aa' });
    if (p.kind === 'vend') v.glows.push({ x, y: y - 70 * k, r: Math.max(5, 50 * k), col: '#9fe9ff88' });
  }
}

// A wheelchair ramp seen from behind: blue slope rising to a yellow lip, an arrow up the middle,
// reflectors on the corners after dark. Drawn once, at its far row, so nearer sprites cover it.
function raceDrawRamp(g, v, rp) {
  let i0 = Math.max(rp.z, v.base + 1);
  while (i0 < rp.end && !(v.rows[i0 - v.base] && v.rows[i0 - v.base].ok)) i0++;
  const near = v.rows[i0 - v.base],
    far = v.rows[rp.end - 1 - v.base];
  if (i0 >= rp.end || !near || !far || !far.ok || near.w1 < 2) return;
  const ratio = v.fy / v.fx,
    f0 = (i0 - rp.z) / RACE_RAMP_LEN,
    L = rp.x - rp.w,
    R = rp.x + rp.w,
    hn = RACE_RAMP_H * f0 * near.w1 * ratio,
    hf = RACE_RAMP_H * far.w2 * ratio,
    gl = [near.x1 + L * near.w1, near.y1],
    gr = [near.x1 + R * near.w1, near.y1],
    nl = [gl[0], gl[1] - hn],
    nr = [gr[0], gr[1] - hn],
    bl = [far.x2 + L * far.w2, far.y2],
    br = [far.x2 + R * far.w2, far.y2],
    fl = [bl[0], bl[1] - hf],
    fr = [br[0], br[1] - hf];
  if (Math.max(gr[0], br[0]) < 0 || Math.min(gl[0], bl[0]) > v.W || Math.min(fl[1], fr[1]) >= near.clip) return;
  // A point on the slope: u across (0 left, 1 right), t up it (0 near, 1 the lip).
  const P = (u, t) => [nl[0] + (nr[0] - nl[0]) * u + (fl[0] + (fr[0] - fl[0]) * u - nl[0] - (nr[0] - nl[0]) * u) * t, nl[1] + (nr[1] - nl[1]) * u + (fl[1] + (fr[1] - fl[1]) * u - nl[1] - (nr[1] - nl[1]) * u) * t];
  raceClip(g, v, near.y1, near.clip, () => {
    poly(g, [gl, nl, fl, bl], '#2a5688');
    poly(g, [gr, nr, fr, br], '#2a5688');
    poly(g, [nl, nr, fr, fl], '#4682cc');
    const e = Math.min(0.08, 0.05 / rp.w);
    poly(g, [P(0, 0), P(e, 0), P(e, 1), P(0, 1)], '#ffd23a');
    poly(g, [P(1 - e, 0), P(1, 0), P(1, 1), P(1 - e, 1)], '#ffd23a');
    const arrows = rp.w >= 1 ? [0.22, 0.5, 0.78] : [0.5],
      aw = rp.w >= 1 ? 0.07 : 0.16;
    for (const u of arrows) {
      poly(g, [P(u - aw * 0.35, 0.12), P(u + aw * 0.35, 0.12), P(u + aw * 0.35, 0.58), P(u - aw * 0.35, 0.58)], '#eef4ff');
      poly(g, [P(u - aw, 0.52), P(u, 0.94), P(u + aw, 0.52)], '#eef4ff');
    }
    line(g, [fl, fr], '#ffe680', Math.max(1, far.w2 * 0.03));
  });
  if (raceDark() > 0.05 && far.w2 > 4)
    for (const q of [fl, fr]) v.glows.push({ x: q[0], y: q[1], r: Math.max(4, far.w2 * 0.12), col: '#ffcf5a88' });
}

// A CT donut stands over the road: gates carry a banner, tunnels are rows of them.
function raceDrawDonut(g, v, r) {
  const s = r.s,
    w = r.w1,
    x = r.x1,
    y = r.y1,
    R = w * 1.6,
    ri = w * 1.3,
    cy = y - w * 0.22,
    top = cy - R,
    floor = Math.min(r.clip, y);
  if (R < 3 || x + R < 0 || x - R > v.W || top >= floor) return;
  const gate = s.gate,
    alt = Math.floor(s.i / 3) % 2;
  g.save();
  g.beginPath();
  g.rect(0, 0, v.W, floor);
  g.clip();
  g.beginPath();
  g.arc(x, cy, R, 0, Math.PI * 2);
  g.arc(x, cy, ri, 0, Math.PI * 2, true);
  g.fillStyle = gate ? '#f1f2e3' : alt ? '#dfe9e1' : '#c9dad6';
  g.fill();
  g.lineWidth = Math.max(1, w * 0.035);
  g.strokeStyle = '#6f97a3';
  g.beginPath();
  g.arc(x, cy, R, Math.PI, 0);
  g.stroke();
  g.strokeStyle = gate && gate.kind === 'gate' ? '#56c9a6' : '#9bc1c6';
  g.lineWidth = Math.max(1, w * 0.06);
  g.beginPath();
  g.arc(x, cy, (R + ri) / 2, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  g.restore();
  if (raceDark() > 0.05 && top < r.clip && w > 14)
    for (const a of [Math.PI * 1.15, Math.PI * 1.85])
      v.glows.push({ x: x + Math.cos(a) * (R + ri) * 0.5, y: cy + Math.sin(a) * (R + ri) * 0.5, r: w * 0.22, col: '#8ff0e455' });
  const first = s.tunnel && !mini.raceCourse.segs[s.i - 1].tunnel;
  if ((!gate && !first) || w < 6 || top - w * 0.1 >= r.clip) return;
  const text = !gate ? 'BRRR 3000' : gate.kind === 'start' ? 'START' : gate.kind === 'finish' ? 'FINISH · RADIOLOGY' : 'CHECKPOINT +' + (mini.raceExt[gate.n] || 0) + ' s',
    bw = w * (text.length > 12 ? 1.9 : 1.3),
    bh = w * 0.26;
  raceClip(g, v, top + bh, r.clip, () => {
    rr(g, x - bw / 2, top - bh * 0.45, bw, bh, bh * 0.3, gate && gate.kind === 'finish' ? '#20313a' : '#18464f', '#f4edd4', Math.max(1, w * 0.02));
    label(g, text, x, top + bh * 0.28, bh * 0.62, gate && gate.kind === 'gate' ? '#a9f5d6' : '#f7f1dc', 'center');
  });
}

// Night and tunnels: darken the world, then light it with the headlight, tail lights, lamps and
// the donut rings' LEDs.
function raceDrawDark(g, v) {
  const night = mini.raceNightK,
    dark = Math.max(night * 0.62, mini.raceTunnelK * 0.32);
  if (dark < 0.02) return;
  const { W, H, hy, fy, fx } = v;
  g.fillStyle = `rgba(9,15,40,${dark.toFixed(3)})`;
  g.fillRect(0, 0, W, H);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const by = hy + fy * 0.9;
  g.globalAlpha = Math.min(1, dark * 1.4);
  path(
    g,
    p => {
      p.moveTo(W / 2 - fx * 0.35, by);
      p.lineTo(W / 2 + fx * 0.35, by);
      p.lineTo(W / 2 + fx * 1.1, hy + fy * 0.2);
      p.lineTo(W / 2 - fx * 1.1, hy + fy * 0.2);
      p.closePath();
    },
    gradient(g, 0, by, 0, hy + fy * 0.2 - by, '#ffeeb03a', '#ffeeb000')
  );
  g.globalAlpha = 1;
  for (const q of v.glows) glow(g, q.x, q.y, q.r, q.col);
  g.restore();
}

// How far round the gurney has turned: one turn for a crash, two easing out for a spin-out.
function raceSpinAngle() {
  if (mini.raceSpin <= 0) return 0;
  const p = 1 - mini.raceSpin / (mini.raceSpinLen || RACE_SPIN);
  return mini.raceSpinOut ? (1 - (1 - p) * (1 - p)) * Math.PI * 4 : p * Math.PI * 2;
}

// Macy's gurney. Up a ramp and in the air it rides above its shadow (the camera rises a little with
// it); a landing squashes it; a spin-out is two full turns with dust flying.
function raceDrawGurney(g, v) {
  const { W, hy, fy, fx } = v,
    k = ((2 * fx) / RACE_ART) * (v.tall ? 1 : 0.82),
    seg = raceSeg(mini.raceZ),
    unit = (RACE_DEPTH / RACE_EYE) * fy,
    lift = raceLiftNow(),
    air = mini.raceAir > 0,
    ground = hy + fy + lift * RACE_CAM_LIFT * unit,
    y = hy + fy - lift * (1 - RACE_CAM_LIFT) * unit,
    shaky = !air && (mini.raceOff || mini.raceRumble || mini.raceScrape > 0),
    rough = shaky ? Math.sin(mini.total * 47) * (mini.raceRumble ? 1.5 : 2.5) * v.u : 0,
    out = mini.raceSpin > 0 && mini.raceSpinOut,
    p = mini.raceSpin > 0 ? 1 - mini.raceSpin / (mini.raceSpinLen || RACE_SPIN) : 0,
    spin = raceSpinAngle(),
    boost = mini.raceNitroT > 0 ? 1.3 : raceBoosting() ? 1 : 0,
    squash = mini.raceBounce > 0 ? Math.sin((1 - mini.raceBounce / 0.35) * Math.PI) * 0.14 : 0;
  if (air) {
    const a = clamp(1 - lift / (RACE_LIFT * 3), 0.4, 1);
    ellipse(g, W / 2, ground + 1, 58 * k * a, 9 * k * a, '#10303f40');
  }
  if (out)
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + mini.total * 3,
        r = (7 + 4 * Math.sin(mini.total * 9 + i)) * k * (1 - p * 0.5);
      ellipse(g, W / 2 + Math.cos(ang) * 62 * k, ground - 8 * k + Math.sin(ang) * 12 * k, r, r * 0.8, Math.abs(mini.raceX) > 1.42 ? '#b9d79acc' : '#ece3cccc');
    }
  g.save();
  if (squash) {
    g.translate(W / 2, y);
    g.scale(1 + squash, 1 - squash);
    g.translate(-W / 2, -y);
  }
  raceGurneyArt(g, W / 2, y + rough, k, {
    macy: true,
    t: mini.total,
    lean: clamp(mini.raceVx / RACE_STEER, -1, 1) * 0.09 + clamp(seg.curve * 0.012, -0.08, 0.08),
    spin,
    tilt: out ? 0.22 : 0,
    boost,
    air,
    ghost: mini.raceGhost > 0 && mini.raceSpin <= 0
  });
  g.restore();
  if (!air && (mini.raceScrape > 0 || (mini.raceOff && mini.raceV > mini.raceTop * 0.3)))
    for (let i = 0; i < 4; i++) {
      const side = mini.raceX > 0 ? 1 : -1,
        a = raceHash(i + Math.floor(mini.total * 30));
      ellipse(g, W / 2 + side * 46 * k + a * 20 * k, y - a * 16 * k, 3 * k, 3 * k, mini.raceScrape > 0 ? '#ffd27a' : '#cfe6a8');
    }
}

function raceDrawSpeed(g, v) {
  const pct = mini.raceV / mini.raceTop,
    k = clamp((pct - 0.97) * 4, 0, 1);
  if (k <= 0 || reduced) return;
  const { W, H, hy } = v;
  g.save();
  g.globalAlpha = 0.45 * k;
  g.strokeStyle = '#f6fbff';
  g.lineWidth = 2 * v.u;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1,
      a = raceHash(i + 3),
      ph = (mini.raceZ * 0.04 * (0.8 + a) + a) % 1,
      x = W / 2 + side * W * (0.28 + 0.2 * a + ph * 0.3),
      y = hy + (H - hy) * (0.1 * a + ph * 0.8),
      len = (0.03 + 0.06 * ph) * W;
    g.moveTo(x, y);
    g.lineTo(x + side * len, y + len * 0.6);
  }
  g.stroke();
  g.restore();
}

// ---- HUD ----
function raceText(g, text, x, y, size, col, align = 'center') {
  g.font = `800 ${size}px "Trebuchet MS", Arial, sans-serif`;
  g.textAlign = align;
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, size * 0.16);
  g.strokeStyle = '#0b1c27';
  g.strokeText(text, x, y);
  g.fillStyle = col;
  g.fillText(text, x, y);
  g.textAlign = 'left';
}

// Everyone's current place: finishers in finishing order, then whoever is furthest along.
function raceRanks() {
  const all = [...mini.raceRivals, null],
    zOf = c => (c ? c.z : mini.raceZ);
  all.sort((a, b) => {
    const ad = a && a.done,
      bd = b && b.done;
    if (ad && bd) return a.doneT - b.doneT;
    if (ad) return -1;
    if (bd) return 1;
    return zOf(b) - zOf(a);
  });
  const m = new Map();
  all.forEach((c, i) => m.set(c, i + 1));
  return m;
}

function raceDrawHud(g, v) {
  const { W, H, u } = v,
    T = RACE_TIERS[mini.tier],
    field = mini.raceRivals.length + 1;
  raceDrawTags(g, v);
  raceDrawStrip(g, v);
  // Place and speed, bottom left.
  const lx = 12 * u,
    by = H - 12 * u;
  rr(g, lx, by - 66 * u, 112 * u, 66 * u, 14 * u, '#0b1c27b8', '#ffffff2a', 1);
  raceText(g, RACE_ORD[mini.raceShown], lx + 10 * u, by - 30 * u, 32 * u, mini.raceShown <= 3 ? '#ffe1a0' : '#f6eed6', 'left');
  label(g, 'OF ' + field + ' · ' + raceKph() + ' KPH', lx + 10 * u, by - 10 * u, 12 * u, raceBoosting() ? '#ffd28a' : '#bfe3d6');
  // Kit, bottom right: boosts and softballs.
  const rx = W - 12 * u - 112 * u;
  rr(g, rx, by - 66 * u, 112 * u, 66 * u, 14 * u, '#0b1c27b8', '#ffffff2a', 1);
  for (let i = 0; i < T.boosts; i++) raceBolt(g, rx + 18 * u + i * 22 * u, by - 46 * u, 8 * u, i < mini.raceBoosts);
  for (let i = 0; i < T.balls; i++) {
    const bx = rx + 16 * u + i * 19 * u,
      byy = by - 19 * u;
    if (i < mini.raceBalls) softball(g, bx, byy, 7 * u);
    else ellipse(g, bx, byy, 7 * u, 7 * u, '#ffffff1a');
  }
  if (mini.raceBoostT > 0 || mini.raceNitroT > 0) {
    const f = mini.raceNitroT > 0 ? mini.raceNitroT / RACE_NITRO : mini.raceBoostT / RACE_BOOST;
    rr(g, rx + 10 * u, by - 6 * u, 92 * u * f, 3 * u, 1.5 * u, '#ffb86a');
  }
  // The last ten seconds, big.
  const left = mini.limit - mini.phaseTime;
  if (mini.screen === 'play' && left < 10 && !mini.raceDone) {
    const pulse = 1 + 0.1 * Math.max(0, Math.cos((left % 1) * Math.PI * 2)),
      gates = mini.raceCourse.gates,
      nextZ = mini.raceGateIdx < gates.length ? gates[mini.raceGateIdx] : mini.raceCourse.finish,
      m = Math.max(0, Math.round((nextZ - mini.raceZ) * 2));
    raceText(g, String(Math.ceil(left)), W / 2, 136 * u, 46 * u * pulse, '#ff9a90');
    label(g, (mini.raceGateIdx < gates.length ? 'DONUT GATE IN ' : 'FINISH IN ') + m + ' m', W / 2, 158 * u, 13 * u, '#ffd9d2', 'center');
  }
  // The edge warning: chevrons on the side you are drifting off, pointing back to the floor. Amber on
  // the rumble strip, red once you are past it.
  if (mini.screen === 'play' && (mini.raceRumble || mini.raceOff) && mini.raceSpin <= 0 && mini.raceAir <= 0 && !raceSeg(mini.raceZ).tunnel) {
    const side = mini.raceX > 0 ? 1 : -1,
      col = mini.raceOff ? '#ff6a52' : '#ffc06a',
      ex = side > 0 ? W - 22 * u : 22 * u,
      ey = H * 0.56;
    g.globalAlpha = (mini.raceOff ? 0.75 : 0.5) + 0.25 * Math.sin(mini.total * 24);
    rect(g, side > 0 ? W - 10 * u : 0, H * 0.3, 10 * u, H * 0.5, gradient(g, 0, H * 0.3, 0, H * 0.5, col + '00', col));
    for (let i = 0; i < 3; i++) {
      const cx = ex - side * i * 15 * u,
        pts = [[cx + side * 7 * u, ey - 13 * u], [cx - side * 6 * u, ey], [cx + side * 7 * u, ey + 13 * u]];
      line(g, pts, '#0b1c27aa', 8 * u);
      line(g, pts, col, 5 * u);
    }
    g.globalAlpha = 1;
  }
  // A rival on your tail.
  let tail = null;
  for (const c of mini.raceRivals) {
    const dz = c.z - mini.raceZ;
    if (dz < -0.8 && dz > -9 && (!tail || dz > tail.z - mini.raceZ)) tail = c;
  }
  if (tail && mini.screen === 'play') {
    const tx = clamp(W / 2 + (tail.x - mini.raceX) * v.fx * 1.4, W / 2 - 50 * u, W / 2 + 50 * u),
      tw = tail.name.length * 7 * u + 30 * u;
    rr(g, tx - tw / 2, H - 22 * u, tw, 19 * u, 8 * u, '#0b1c27c8', '#ffb8a066', 1);
    label(g, '▼ ' + tail.name.toUpperCase(), tx, H - 8 * u, 11 * u, '#ffd0c4', 'center');
  }
}

function raceBolt(g, x, y, s, on) {
  poly(
    g,
    [[x + s * 0.2, y - s * 1.2], [x - s * 0.7, y + s * 0.15], [x - s * 0.05, y + s * 0.15], [x - s * 0.3, y + s * 1.2], [x + s * 0.75, y - s * 0.25], [x + s * 0.1, y - s * 0.25]],
    on ? '#ffd27a' : '#ffffff22'
  );
}

function raceDrawTags(g, v) {
  if (!v.tags.length) return;
  const ranks = raceRanks(),
    u = v.u;
  v.tags.sort((a, b) => a.dz - b.dz);
  for (const t of v.tags.slice(0, 3).reverse()) {
    const ralph = t.c.kind === 'ralph',
      text = t.c.name.toUpperCase() + ' · ' + RACE_ORD[ranks.get(t.c)],
      size = 11 * u,
      wdt = text.length * size * 0.62 + 12 * u,
      y = Math.max(92 * u, t.y);
    rr(g, t.x - wdt / 2, y - size - 6 * u, wdt, size + 9 * u, 7 * u, '#0b1c27c8', ralph ? '#d6b5ff' : '#ffffff30', 1);
    label(g, text, t.x, y - 3 * u, size, ralph ? '#e6d2ff' : '#f6eed6', 'center');
  }
}

// The whole course in one line: donut gates, every racer, you.
function raceDrawStrip(g, v) {
  const { W, u } = v,
    c = mini.raceCourse,
    x0 = W * 0.2,
    x1 = W * 0.8,
    y = 70 * u,
    span = c.finish - c.start,
    at = z => x0 + (x1 - x0) * clamp((z - c.start) / span, 0, 1);
  rr(g, x0 - 10 * u, y - 9 * u, x1 - x0 + 20 * u, 18 * u, 9 * u, '#0b1c27a8', '#ffffff22', 1);
  line(g, [[x0, y], [x1, y]], '#5d7f88', 3 * u);
  for (const gz of c.gates) {
    g.strokeStyle = '#8fe3c4';
    g.lineWidth = 2 * u;
    g.beginPath();
    g.arc(at(gz), y, 5 * u, Math.PI, 0);
    g.stroke();
  }
  for (let i = 0; i < 4; i++) rect(g, x1 + 4 * u + (i % 2) * 4 * u, y - 8 * u + Math.floor(i / 2) * 4 * u, 4 * u, 4 * u, '#f7f3e8');
  for (const r of mini.raceRivals)
    ellipse(g, at(r.z), y, 3.4 * u, 3.4 * u, r.kind === 'ralph' ? '#c89cff' : r.kind === 'barb' ? '#ffd27a' : '#f6b8b0');
  ellipse(g, at(mini.raceZ), y, 6.5 * u, 6.5 * u, '#0b1c27');
  ellipse(g, at(mini.raceZ), y, 5 * u, 5 * u, '#8ff0c8');
}

// Pops, banners, the start lights and the finish card. Pops store fractions of the canvas, so they
// survive the phone turning mid-run.
function raceOverlay(g) {
  if (!mini.raceCourse) return;
  const F = raceFrame(activeCanvas()),
    { W, H, u } = F;
  for (const p of mini.fx || []) {
    g.globalAlpha = Math.min(1, p.life * 3);
    ellipse(g, p.x, p.y, 4 * u, 4 * u, p.col);
  }
  g.globalAlpha = 1;
  for (const p of mini.screen === 'play' ? mini.racePops : []) {
    const a = p.life / p.max,
      pop = a > 0.85 ? 1 + (a - 0.85) * 2.4 : 1;
    g.globalAlpha = Math.min(1, a * 2.5);
    raceText(g, p.text, p.x * W, p.y * H - (1 - a) * 36 * u, 24 * u * p.size * pop, p.col);
  }
  g.globalAlpha = 1;
  if (mini.screen === 'play' && mini.notice > 0) {
    g.globalAlpha = Math.min(1, mini.notice * 2);
    const text = mini.shift === 0 ? RACE_TIERS[mini.tier].course.toUpperCase() : mini.shift === 1 ? 'LEG 2 OF 3' : 'FINAL LEG';
    rr(g, W / 2 - 130 * u, 96 * u, 260 * u, 40 * u, 14 * u, '#0b1c27d8', '#b6d9ca66', 1);
    label(g, text, W / 2, 122 * u, 17 * u, '#f1e2b9', 'center');
    g.globalAlpha = 1;
  }
  if (mini.screen === 'play' && mini.flash > 0) {
    g.globalAlpha = Math.min(1, mini.flash * 3);
    rr(g, 20 * u, H * 0.27, W - 40 * u, 34 * u, 12 * u, '#173349ed');
    label(g, mini.flashText, W / 2, H * 0.27 + 22 * u, 12 * u, '#ffe5b8', 'center');
    g.globalAlpha = 1;
  }
  if (mini.screen === 'intro') raceStartLights(g, F);
  if (mini.screen === 'outro') raceFinishCard(g, F);
}

function raceStartLights(g, F) {
  const { W, H, u } = F,
    lab = countdownLabel(),
    go = lab === 'GO!',
    lit = go ? 3 : 4 - Number(lab),
    y = H * 0.27;
  rr(g, W / 2 - 96 * u, y - 32 * u, 192 * u, 64 * u, 18 * u, '#0b1c27ee', '#ffffff40', 1.5);
  for (let i = 0; i < 3; i++) {
    const x = W / 2 + (i - 1) * 56 * u,
      on = go || i < lit;
    if (on) glow(g, x, y, 34 * u, go ? '#7dffa680' : '#ff6a5a80');
    ellipse(g, x, y, 19 * u, 19 * u, on ? (go ? '#7dffa6' : '#ff6a5a') : '#33464f');
  }
  raceText(g, go ? 'GO' : lab, W / 2, y + 82 * u, 46 * u, go ? '#b5f5c8' : '#f4ebcf');
  raceText(g, 'The clock starts on GO.', W / 2, y + 110 * u, 15 * u, '#e3f0e8');
}

function raceFinishCard(g, F) {
  const { W, H, u } = F,
    win = !!(mini.pendingFinish && mini.pendingFinish.win),
    time = mini.raceOut === 'time',
    cw = Math.min(W - 30 * u, 460 * u),
    cy = H * 0.34;
  g.globalAlpha = clamp((mini.transition || 0) / 0.35, 0, 1);
  rr(g, W / 2 - cw / 2, cy - 64 * u, cw, 128 * u, 22 * u, '#0b1c27ee', win ? '#ffe1a0' : '#f4b2b2', 2);
  raceText(g, time ? 'OUT OF TIME' : 'FINISHED ' + RACE_ORD[mini.raceFinal || mini.racePlace], W / 2, cy + 2 * u, 38 * u, win ? '#ffe1a0' : '#f8c0b8');
  const st = mini.raceStandings || raceStandings(),
    sub = time
      ? 'The clock ran out before the finish line.'
      : win
        ? st.slice(0, 3).map((n, i) => i + 1 + '. ' + n).join('  ·  ')
        : 'Top three wins. Pass more, spin less.';
  label(g, sub, W / 2, cy + 38 * u, 14 * u, '#d7ece2', 'center');
  g.globalAlpha = 1;
}

// ---- Art ----
// Everything is drawn from behind, standing on (0, 0), at RACE_ART pixels per road half-width.

// A gurney seen from behind: casters, frame, mattress, rails, and whoever rides it.
function raceGurneyArt(g, x, y, k, o = {}) {
  const t = o.t || 0;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  if (!o.air) ellipse(g, 0, 1, 58, 9, '#10303f38');
  if (o.boost) raceExhaust(g, t, o.boost);
  if (o.spin) {
    if (o.tilt) g.rotate(Math.sin(o.spin) * o.tilt);
    const c = Math.cos(o.spin);
    g.scale(Math.abs(c) < 0.12 ? (c < 0 ? -0.12 : 0.12) : c, 1);
  }
  if (o.lean) g.rotate(o.lean);
  if (o.ghost) g.globalAlpha = 0.55 + 0.3 * Math.sin(t * 22);
  for (const s of [-1, 1]) ellipse(g, s * 30, -17, 5, 4, '#2c4350');
  rr(g, -46, -27, 92, 8, 3, '#9db6bb', '#6e8a92', 1);
  for (const s of [-1, 1]) {
    line(g, [[s * 40, -22], [s * 40, -8]], '#88a2a9', 4);
    ellipse(g, s * 40, -5, 7, 6, '#2c4350');
    ellipse(g, s * 40, -5, 2.6, 2.6, '#a7c5c9');
  }
  rr(g, -50, -40, 100, 15, 6, gradient(g, 0, -40, 0, 15, o.tint || '#f7f2df', '#c9d8cf'), '#7d9aa3', 1);
  for (const s of [-1, 1]) line(g, [[s * 49, -34], [s * 49, -54], [s * 36, -54]], '#cbdcd8', 3);
  if (o.macy) raceMacyBack(g, t, o.lean || 0);
  else if (o.rider !== undefined) gremlin(g, 0, -38, 0.95, o.rider, t);
  else if (o.sheet) {
    path(
      g,
      p => {
        p.moveTo(-40, -40);
        p.quadraticCurveTo(-20, -56, 0, -46);
        p.quadraticCurveTo(22, -60, 42, -40);
        p.closePath();
      },
      '#eef2e4',
      '#b9cbc6',
      1
    );
  }
  if (o.macy) {
    const sway = Math.sin(t * 3.1) * 3;
    line(g, [[-44, -38], [-44, -118]], '#c9dde0', 3);
    line(g, [[-52, -116], [-36, -116]], '#d6e6df', 3);
    rr(g, -52 + sway, -112, 14, 20, 4, '#e7f1dccc', '#bbd5c9', 1);
    rr(g, -50 + sway, -104, 10, 10, 2, '#edcb80');
  }
  g.restore();
}

// Boost flames come out the back, toward the camera.
function raceExhaust(g, t, k) {
  for (const s of [-1, 1]) {
    const f = 1 + Math.sin(t * 40 + s) * 0.22,
      x = s * 26;
    glow(g, x, -12, 38 * k, '#ffb86a99');
    path(
      g,
      p => {
        p.moveTo(x - 10, -14);
        p.quadraticCurveTo(x + s * 4, 4, x + s * 7, (18 + 10 * k) * f);
        p.quadraticCurveTo(x + s * 2, 2, x + 10, -14);
        p.closePath();
      },
      '#ff9b54'
    );
    ellipse(g, x, -13, 6, 5, '#fff2b8');
  }
}

// Macy from behind: hoodie, jersey number, arms on the rails, ponytail swinging into the wind.
function raceMacyBack(g, t, lean) {
  const look = macyLook(),
    hood = look.hoodie,
    sw = Math.sin(t * 5) * 4 - lean * 50;
  for (const s of [-1, 1]) {
    line(g, [[s * 17, -66], [s * 33, -56], [s * 45, -52]], hood[1], 8);
    ellipse(g, s * 46, -52, 5, 4.5, '#f3bb99');
  }
  path(
    g,
    p => {
      p.moveTo(-22, -38);
      p.quadraticCurveTo(-27, -66, -14, -78);
      p.lineTo(14, -78);
      p.quadraticCurveTo(27, -66, 22, -38);
      p.closePath();
    },
    gradient(g, 0, -78, 0, 40, hood[1], hood[2]),
    hood[2],
    1.2
  );
  ellipse(g, 0, -76, 15, 6, hood[0]);
  macyNumber(g, 0, -56, 14, '#f6f3de', hood[2]);
  path(
    g,
    p => {
      p.moveTo(-4, -100);
      p.quadraticCurveTo(sw - 7, -86, sw, -70);
      p.quadraticCurveTo(sw + 7, -86, 4, -100);
      p.closePath();
    },
    '#4d3530'
  );
  ellipse(g, 0, -91, 15, 16, gradient(g, 0, -107, 0, 32, '#704c3e', '#3c2830'));
  ellipse(g, 0, -100, 6.5, 3.5, look.scrunchie);
}

function raceCartArt(g, c, t) {
  const crash = c.name === 'Crash Cart';
  ellipse(g, 0, 1, 46, 7, '#10303f38');
  for (const s of [-1, 1]) ellipse(g, s * 32, -5, 6, 5, '#2c4350');
  rr(
    g,
    -40,
    -78,
    80,
    70,
    7,
    gradient(g, 0, -78, 0, 70, crash ? '#f2a49c' : '#f2f5ee', crash ? '#c45a58' : '#aac0c8'),
    crash ? '#8a3a3c' : '#6d8f9c',
    2
  );
  for (let i = 0; i < 4; i++)
    rr(g, -33, -70 + i * 15, 66, 11, 3, crash ? (i % 2 ? '#e7c0b5' : '#f6d9cf') : i % 2 ? '#d27b8a' : '#7fb4c9');
  gremlin(g, 0, -78, 0.6, 3, t);
  label(g, crash ? 'CRASH' : 'MED 4', 0, -10, 11, crash ? '#5a1f22' : '#38515c', 'center');
}

// Barb rides the back step of the Dietary cart, hairnet first, Ensure stacked up front.
function raceBarbArt(g, t) {
  const bob = Math.sin(t * 6) * 1.5;
  ellipse(g, 0, 1, 52, 8, '#10303f38');
  rr(g, -46, -100, 92, 60, 5, '#cdd7d8', '#7f9396', 1.5);
  line(g, [[-44, -72], [44, -72]], '#8fa3a6', 2);
  for (const [bx, by] of [[-26, -73], [0, -73], [26, -73], [-13, -100], [13, -100]]) ensureSixPack(g, bx, by, 0.95);
  for (const s of [-1, 1]) ellipse(g, s * 38, -6, 6, 5, '#2c4350');
  rr(g, -32, -16, 64, 9, 3, '#8fa3a6');
  label(g, 'DIETARY', 0, -2, 9, '#38515c', 'center');
  for (const s of [-1, 1]) line(g, [[s * 16, -58 + bob], [s * 30, -72], [s * 36, -82]], '#35577f', 7);
  path(
    g,
    p => {
      p.moveTo(-20, -16);
      p.quadraticCurveTo(-24, -52 + bob, -14, -62 + bob);
      p.lineTo(14, -62 + bob);
      p.quadraticCurveTo(24, -52 + bob, 20, -16);
      p.closePath();
    },
    '#35577f'
  );
  ellipse(g, 0, -72 + bob, 12, 12, '#b98468');
  ellipse(g, 0, -77 + bob, 15, 12, '#eef3f6e0');
  for (const d of [-8, 0, 8]) line(g, [[d - 4, -86 + bob], [d + 4, -68 + bob]], '#c4d0d6', 0.8);
}

// Ralph on a motorized bed, beacon spinning, arms wide, taking up two lanes on principle.
function raceRalphArt(g, c, t) {
  raceGurneyArt(g, 0, 0, 1.3, { tint: '#e6d6f8', t });
  const on = Math.sin(t * 10) > 0;
  glow(g, -56, -80, 26, on ? '#ffc04a99' : '#ffc04a33');
  rr(g, -62, -86, 12, 11, 3, on ? '#ffd27a' : '#c08a3a');
  g.save();
  g.translate(0, -50);
  g.scale(1.5, 1.5);
  if (typeof wardGremlinArt === 'function' && typeof breeds !== 'undefined' && breeds[5])
    wardGremlinArt(g, 5, breeds[5].pal, t, { arms: c.blocking ? 'wide' : 'down', mouth: c.blocking ? 'open' : 'grin', brow: 1 });
  else gremlin(g, 0, 0, 1, 1, t);
  g.restore();
  rr(g, -26, -22, 52, 12, 3, '#5d3d8c');
  label(g, 'RALPH', 0, -12, 10, '#eadcff', 'center');
}

function raceLaundryArt(g) {
  ellipse(g, 0, 1, 50, 8, '#10303f38');
  for (const s of [-1, 1]) ellipse(g, s * 34, -5, 6, 5, '#2c4350');
  rr(g, -44, -66, 88, 58, 12, gradient(g, 0, -66, 0, 58, '#9cc0d4', '#5f879e'), '#46697d', 2);
  for (const [x, y, r] of [[-22, -66, 16], [4, -71, 18], [26, -64, 14]]) ellipse(g, x, y, r, r * 0.7, '#f4f1e6');
  label(g, 'LINEN', 0, -30, 13, '#e8f2f6', 'center');
}

function raceChairArt(g, t, rider) {
  ellipse(g, 0, 1, 42, 7, '#10303f38');
  if (rider) gremlin(g, 0, -56, 0.62, 2, t);
  rr(g, -24, -76, 48, 46, 6, '#3d6f86', '#2b5163', 1.5);
  for (const s of [-1, 1]) {
    line(g, [[s * 21, -76], [s * 25, -86]], '#9fb5bb', 4);
    ellipse(g, s * 32, -30, 6, 30, '#2c4350');
    ellipse(g, s * 32, -30, 2.5, 23, '#8aa4ad');
  }
}

function raceWetArt(g) {
  ellipse(g, 0, 1, 26, 5, '#10303f38');
  poly(g, [[-20, 0], [-8, -66], [8, -66], [20, 0]], '#f3cf4a');
  poly(g, [[-14, -6], [-6, -58], [6, -58], [14, -6]], '#f7dc6c');
  label(g, 'WET', 0, -22, 12, '#3b3320', 'center');
  ellipse(g, -2, -50, 3, 3, '#3b3320');
  line(g, [[-2, -47], [2, -38], [-6, -34]], '#3b3320', 2);
  line(g, [[2, -38], [9, -33]], '#3b3320', 2);
}

function racePropArt(g, p, x, y, k) {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  if (p.kind === 'vend') {
    ellipse(g, 0, 1, 34, 6, '#10303f30');
    rr(g, -28, -112, 56, 112, 5, gradient(g, 0, -112, 0, 112, '#e2625e', '#a8403f'), '#7c2f2f', 1.5);
    rr(g, -22, -104, 32, 76, 3, '#23404e');
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) ellipse(g, -16 + c * 10, -94 + r * 18, 3.5, 3, ['#f3cf4a', '#8fd0c4', '#f4b2b2'][(r + c) % 3]);
    rr(g, 14, -100, 8, 30, 2, '#f1e5c8');
    rr(g, -22, -22, 32, 10, 2, '#1b2f38');
  } else if (p.kind === 'bench') {
    ellipse(g, 0, 1, 44, 6, '#10303f30');
    for (const s of [-1, 1]) line(g, [[s * 32, 0], [s * 32, -26]], '#5d6f75', 4);
    rr(g, -40, -30, 80, 8, 3, '#b98a5a');
    rr(g, -40, -52, 80, 10, 3, '#c99a68');
  } else if (p.kind === 'plant') plant(g, 0, 0, 1.15);
  else if (p.kind === 'chair') {
    g.scale(0.85, 0.85);
    raceChairArt(g, 0, false);
  } else if (p.kind === 'lamp') {
    line(g, [[0, 0], [0, -196]], '#5d7178', 5);
    line(g, [[0, -192], [22, -196]], '#5d7178', 4);
    ellipse(g, 24, -194, 10, 5, '#fff2c4');
  } else if (p.kind === 'ensure') {
    for (const [ex, ey] of [[-17, 0], [17, 0], [0, -24]]) ensureSixPack(g, ex, ey, 1.6);
  } else if (p.kind === 'chevron') {
    line(g, [[0, 0], [0, -52]], '#5d7178', 4);
    rr(g, -34, -90, 68, 40, 6, '#f3cf4a', '#8a6a1a', 1.5);
    for (const o of [-14, 6]) {
      const d = p.dir;
      poly(g, [[o * d - 6 * d, -82], [o * d + 6 * d, -70], [o * d - 6 * d, -58], [o * d - 1 * d, -58], [o * d + 11 * d, -70], [o * d - 1 * d, -82]], '#3b3320');
    }
  } else if (p.kind === 'sign') {
    const [a, b] = p.text.split(/ (?=\d)/);
    for (const s of [-1, 1]) line(g, [[s * 46, 0], [s * 46, -84]], '#5d7178', 5);
    rr(g, -76, -136, 152, 58, 8, '#2f7a5f', '#f4edd4', 3);
    label(g, a, 0, -112, 17, '#f4edd4', 'center');
    label(g, b || '', 0, -89, 16, '#ffe1a0', 'center');
  } else if (p.kind === 'tree') {
    const s = 0.8 + p.v * 0.5;
    g.scale(s, s);
    ellipse(g, 0, 1, 40, 7, '#10303f30');
    rr(g, -6, -70, 12, 70, 4, '#7a5a40');
    ellipse(g, 0, -112, 48, 44, '#5f9a5c');
    ellipse(g, -26, -88, 30, 26, '#6aa864');
    ellipse(g, 24, -90, 32, 27, '#579155');
    ellipse(g, -8, -126, 22, 16, '#7dbb72');
  }
  g.restore();
}

// Lobby preview and department card: the road bending toward a donut, a gremlin ahead, Macy boosting.
function raceScene(g, w, h) {
  g.save();
  g.scale(w / 420, h / 240);
  rect(g, 0, 0, 420, 112, gradient(g, 0, 0, 0, 112, '#79bcc4', '#f2d6a6'));
  glow(g, 300, 70, 80, '#fff3cc66');
  for (let i = 0; i < 10; i++) {
    const bh = 14 + raceHash(i + 9) * 34;
    rect(g, i * 44 - 6, 108 - bh, 40, bh + 4, i % 2 ? '#6b98a0' : '#5d8c95');
    for (let r = 108 - bh + 6; r < 104; r += 8) for (let c = i * 44; c < i * 44 + 30; c += 8) rect(g, c, r, 3, 3, '#d9ece6aa');
  }
  rect(g, 0, 108, 420, 132, '#7aad78');
  const roll = (time * 3) % 1,
    at = z => {
      const s = 1 / z;
      return { y: 106 + 128 * s, w: 210 * s, x: 210 + 5 * (z - 1) * (z - 1) * s };
    };
  for (let i = 40; i >= 0; i--) {
    const za = 1 + (i + roll) * 0.32,
      zb = za + 0.32,
      a = at(za),
      b = at(zb),
      band = i % 2;
    rect(g, 0, b.y, 420, a.y - b.y + 0.5, band ? '#87b983' : '#79ac77');
    raceQuad(g, a.x, a.y, a.w * 1.1, b.x, b.y, b.w * 1.1, band ? '#f3ecd8' : '#de7a76');
    raceQuad(g, a.x, a.y, a.w, b.x, b.y, b.w, band ? '#647b8b' : '#5c7384');
    if (band) for (const L of [-1 / 3, 1 / 3]) raceQuad(g, a.x + L * a.w, a.y, a.w * 0.022, b.x + L * b.w, b.y, b.w * 0.022, '#f4edd4');
  }
  const d = at(6.5);
  g.lineWidth = d.w * 0.3;
  g.strokeStyle = '#eef2e2';
  g.beginPath();
  g.arc(d.x, d.y - d.w * 0.22, d.w * 1.45, Math.PI * 1.02, Math.PI * 1.98);
  g.stroke();
  for (const s of [-1, 1]) rect(g, d.x + s * d.w * 1.45 - d.w * 0.15, d.y - d.w * 0.6, d.w * 0.3, d.w * 0.6, '#eef2e2');
  const r = at(3.6);
  raceGurneyArt(g, r.x + r.w * 0.4, r.y, (r.w / RACE_ART) * 1.1, { rider: 1, tint: RACE_TINTS[1], t: time });
  raceGurneyArt(g, 210, 234, 0.92, { macy: true, t: time, boost: 0.8, lean: Math.sin(time * 1.3) * 0.05 });
  label(g, RACE.info.game.toUpperCase(), 210, 22, 12, '#21414f', 'center');
  g.restore();
}

// Result screen foreground: the podium after a win, a spun-out gurney after a loss.
function raceResultArt(g) {
  for (const p of gore) rect(g, p.x - p.size / 2, p.y - p.size / 3, p.size, p.size * 0.6, p.col);
  const st = mini.raceStandings || [],
    fin = mini.raceFinal || mini.racePlace;
  if (mini.win) {
    const steps = [
      [650, 2, 50],
      [710, 1, 72],
      [770, 3, 36]
    ];
    for (const [x, place, hgt] of steps) {
      rr(g, x - 28, 206 - hgt, 56, hgt, 4, ['', '#f3d27a', '#d7dee2', '#e0a877'][place], '#5d4a2e', 1.5);
      label(g, String(place), x, 206 - hgt + 24, 18, '#3a3020', 'center');
      if (place === fin) raceGurneyArt(g, x, 206 - hgt, 0.42, { macy: true, t: time });
      else if ((st[place - 1] || '') === 'Barb') ensureSixPack(g, x, 206 - hgt, 1.4);
      else gremlin(g, x, 206 - hgt, 0.75, place % 4, time);
    }
    for (let i = 0; i < 12; i++) rect(g, 600 + (i % 4) * 9, 30 + Math.floor(i / 4) * 9, 9, 9, (i + Math.floor(i / 4)) % 2 ? '#f7f3e8' : '#20313a');
    line(g, [[600, 30], [600, 120]], '#5d7178', 3);
    label(g, 'PODIUM · ' + RACE_ORD[fin], 400, 26, 12, '#426d62', 'center');
  } else {
    path(g, p => p.ellipse(612, 200, 50, 10, 0, Math.PI * 0.1, Math.PI * 1.4), null, '#3a3a3a55', 4);
    g.save();
    g.translate(612, 198);
    g.rotate(-0.5);
    raceGurneyArt(g, 0, 0, 0.6, { sheet: true, t: time });
    g.restore();
    gremlin(g, 712, 196, 1.15, 2, time);
    for (let i = 0; i < 6; i++) rect(g, 728 + (i % 3) * 8, 120 + Math.floor(i / 3) * 8, 8, 8, i % 2 ? '#f7f3e8' : '#20313a');
    line(g, [[728, 120], [728, 170]], '#5d7178', 3);
    label(
      g,
      mini.raceOut === 'time' ? 'THE CLOCK WON THIS ONE.' : ((st[0] || 'Barb') + ' wins. The gremlins are smug.').toUpperCase(),
      400,
      29,
      12,
      '#dfe2b9',
      'center'
    );
  }
  return true;
}
