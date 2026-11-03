// Fastpitch Fever (your room, daytime). Macy sits up in bed with a bucket of softballs and a gremlin
// problem. Flick to throw: swipe up through what you want to hit and let go. The flick's line is where
// the ball comes down, its speed is how far, and the swipe's length is the arc (a quick short flick is
// a fast low ball, a long slow swipe is a lob). A faint arc shows the throw only while the finger moves.
// Balls fly through the room in real 3D: gravity, an arc, bounces off the walls and the furniture, and
// every landing leaves a scuff. Walkers need a lead, peekers duck behind the furniture, bedpan shields
// only fall to a bank shot off a wall, chargers head for the bed, and the Ensure bottles on the tray
// table ring like carnival cans. Every hit puts a ball back in the bucket; misses empty it, and a slow
// refill means an empty bucket never stalls the run. Level 3 brings the Ump, golden two-for-one
// gremlins and a smaller bucket; Legendary brings all of it faster, with less arc to read. Canvas
// 800 × 450, or 450 × 800 upright: the rules live in room centimeters and only the camera changes.

// ---- The room, in centimeters ----
// x runs left to right (walls at ±PITCH_WALL), y is height off the floor, z runs from the head of
// Macy's bed (0) to the window wall (PITCH_BACK). The cameras sit behind the bed, above it.
const PITCH_G = 760, // gravity, cm/s²; a little floatier than Earth so the arc reads on a phone
  PITCH_BALL = 5.5, // softball radius
  PITCH_WALL = 220,
  PITCH_BACK = 520,
  PITCH_WALL_H = 260,
  PITCH_REACH = 205, // a charger this close to the bed climbs onto the footboard: an oops
  PITCH_SUB = 1 / 240, // physics substep
  PITCH_GREM = 50, // gremlin height
  PITCH_COOLDOWN = 0.15,
  PITCH_HAND = { x: 88, y: 168, z: 28 }; // her release point, overhand, above her head

// ---- The flick ----
// The finger's last PITCH_FLICK_WIN seconds make the throw. Its line, laid on the floor at gremlin
// height, is the line the ball comes down on; its speed is how far from her hand (PITCH_DIST, at
// PITCH_YREF); the swipe's length is the launch angle (PITCH_ARC). Nothing in it looks at a gremlin.
const PITCH_YREF = 30, // a throw's distance is where it comes down through this height: a gremlin's middle
  PITCH_FLICK_WIN = 0.12, // seconds of finger motion that make the flick
  PITCH_FLICK_MIN = 150, // canvas px/s: slower than this the finger was placing, not throwing
  PITCH_FLICK_SOFT = 260, // the flick speed of the shortest throw
  PITCH_FLICK_HARD = 2400, // and of the farthest; harder still changes nothing
  PITCH_DIST = [130, 620], // cm from her hand: the shortest and the farthest throw
  PITCH_SWIPE = [60, 280], // swipe length (canvas px) of a line drive and of a full lob
  PITCH_ARC = [-0.07, 1.12], // their launch angles, radians (about -4 and 64 degrees)
  PITCH_STEER = 0.15, // a flick must head this much up the screen (into the room) to throw
  PITCH_TAP = 14; // a press that never moved farther than this (px) was a tap

// One camera per canvas shape. tilt looks down at the room; f is canvas px per cm at one cm of depth.
const PITCH_CAMS = {
  wide: { cx: 400, cy: 206, f: 560, x: 0, y: 330, z: -240, tilt: 0.42 },
  tall: { cx: 225, cy: 380, f: 470, x: 0, y: 560, z: -160, tilt: 0.9 }
};

// Solid furniture (axis-aligned boxes). e is bounciness: cushions are dead, the cabinet is lively.
const PITCH_BOXES = [
  { id: 'bed', x0: 30, x1: 150, y0: 0, y1: 56, z0: -90, z1: 122, e: 0.15 },
  { id: 'footboard', x0: 30, x1: 150, y0: 0, y1: 72, z0: 122, z1: 132, e: 0.4 },
  { id: 'tray', x0: -150, x1: -72, y0: 74, y1: 80, z0: 212, z1: 250, e: 0.45 },
  { id: 'cabinet', x0: 150, x1: 220, y0: 0, y1: 96, z0: 290, z1: 350, e: 0.42 },
  { id: 'etype', x0: 162, x1: 210, y0: 96, y1: 110, z0: 318, z1: 336, e: 0.3 },
  { id: 'chairBack', x0: -132, x1: -60, y0: 0, y1: 90, z0: 404, z1: 416, e: 0.3 },
  { id: 'chairSeat', x0: -132, x1: -60, y0: 0, y1: 44, z0: 416, z1: 460, e: 0.25 },
  { id: 'sofa', x0: -220, x1: -150, y0: 0, y1: 44, z0: 296, z1: 470, e: 0.22 },
  { id: 'sofaBack', x0: -220, x1: -198, y0: 44, y1: 92, z0: 296, z1: 470, e: 0.22 },
  { id: 'sofaArm', x0: -220, x1: -150, y0: 44, y1: 62, z0: 296, z1: 310, e: 0.25 },
  // The snack bin is hollow: a lob can drop right in.
  { id: 'binFloor', x0: 146, x1: 190, y0: 0, y1: 4, z0: 474, z1: 510, e: 0.3 },
  { id: 'binFront', x0: 146, x1: 190, y0: 0, y1: 58, z0: 474, z1: 477, e: 0.4 },
  { id: 'binBack', x0: 146, x1: 190, y0: 0, y1: 58, z0: 507, z1: 510, e: 0.4 },
  { id: 'binLeft', x0: 146, x1: 149, y0: 0, y1: 58, z0: 474, z1: 510, e: 0.4 },
  { id: 'binRight', x0: 187, x1: 190, y0: 0, y1: 58, z0: 474, z1: 510, e: 0.4 },
  { id: 'tv', x0: 40, x1: 202, y0: 108, y1: 200, z0: 510, z1: 520, e: 0.35 },
  { id: 'sill', x0: -184, x1: 4, y0: 82, y1: 90, z0: 506, z1: 520, e: 0.5 }
];

// The bin as one box, for drawing.
const PITCH_BIN = { x0: 146, x1: 190, y0: 0, y1: 58, z0: 474, z1: 510 };

// Where gremlins stand (feet), walk, hide, hop from and charge from. high: level 2 and up. wall: too
// close to a wall to bank a shot past, so no bedpan shields there.
const PITCH_SITS = [
  { x: -40, y: 0, z: 268 },
  { x: -120, y: 0, z: 330 },
  { x: 60, y: 0, z: 330 },
  { x: -10, y: 0, z: 470 },
  { x: 100, y: 0, z: 430 },
  { x: -20, y: 0, z: 410 },
  { x: -186, y: 44, z: 360, wall: true },
  { x: -186, y: 44, z: 440, wall: true },
  { x: 170, y: 96, z: 304 },
  { x: 30, y: 0, z: 380 },
  { x: -60, y: 90, z: 512, high: true },
  { x: 121, y: 200, z: 514, high: true }
];

const PITCH_WALKS = [
  { a: [-110, 0, 290], b: [40, 0, 290] },
  { a: [-110, 0, 360], b: [110, 0, 360] },
  { a: [-40, 0, 482], b: [112, 0, 482] },
  { a: [-186, 44, 318], b: [-186, 44, 456] },
  { a: [-170, 90, 512], b: [-4, 90, 512], high: true },
  { a: [40, 0, 250], b: [40, 0, 490] }
];

// Peekers hide behind cover (hide) and pop out (up). Hiding, only their ear tips show, and only a lob
// that drops over the cover can reach them. key: draw order when z alone would be wrong.
const PITCH_PEEKS = [
  { id: 'footboard', hide: [96, 24, 154], up: [96, 58, 154] },
  { id: 'cabinet', hide: [188, 0, 392], up: [124, 0, 368] },
  { id: 'chair', hide: [-96, 0, 476], up: [-96, 76, 432], key: 466 },
  { id: 'bin', hide: [168, -6, 492], up: [168, 46, 492], key: 511 }
];

// The Ump is bigger, so his hiding spots sit lower and farther back.
const PITCH_UMP_SPOTS = [
  { id: 'cabinet', hide: [196, 0, 378], up: [112, 0, 378] },
  { id: 'chair', hide: [-96, -16, 436], up: [-96, 66, 436] },
  { id: 'bin', hide: [168, -66, 492], up: [168, 36, 492], key: 511 },
  { id: 'footboard', hide: [90, -60, 156], up: [90, 44, 156] }
];

const PITCH_HOPS = [
  [-60, 0, 300],
  [-186, 44, 380],
  [40, 0, 360],
  [-100, 0, 350],
  [110, 0, 460],
  [170, 96, 304],
  [-10, 0, 480]
];

const PITCH_CHARGES = [
  [206, 0, 440],
  [-40, 0, 506],
  [112, 0, 506],
  [-140, 0, 300],
  [-130, 0, 380]
];

// The Ensure pyramid on the tray table (3, 2, 1) and, from level 2, three on the cabinet in front of
// the E-Type. [x, y of the bottle's base, z].
const PITCH_BOTTLE_H = 21,
  PITCH_BOTTLE_W = 4.6;
const PITCH_PYRAMID = [
  [-126, 80, 231],
  [-111, 80, 231],
  [-96, 80, 231],
  [-118.5, 101, 231],
  [-103.5, 101, 231],
  [-111, 122, 231]
];
const PITCH_SHELF = [
  [186, 96, 300],
  [198, 96, 300],
  [210, 96, 300]
];

// Per level. Arrays of three are per inning. balls: [start, bucket size]; refill: seconds per ball back
// in the bucket, or empty: seconds when it is empty. walk: speed range (cm/s); peek: [seconds up, seconds
// down]; hop: [seconds resting, seconds in the air]; charge: approach speed (cm/s); sitLife: seconds before
// a sitting gremlin wanders off (0 = never); timed: a golden gremlin's window; umpAt: the inning the Ump
// arrives (-1 = never); arc: how much of a flick's flight the faint preview shows (contacts, seconds);
// hit: gremlin hit radius (cm). Speeds and windows scale with the prescription.
const PITCH_TIERS = [
  {
    limit: 80,
    goal: 30,
    balls: [10, 12],
    refill: 2.4,
    empty: 1.2,
    hit: 30,
    arc: [2, 2.4],
    cap: [2, 3, 3],
    interval: [1.0, 1.3, 1.3],
    mix: [{ sit: 1 }, { sit: 2, walk: 3 }, { walk: 3, sit: 1, peek: 1, charge: 1 }],
    walk: [24, 32],
    peek: [2.6, 1.6],
    hop: [1.6, 0.7],
    charge: 16,
    sitLife: 0,
    timed: 0,
    shelf: false,
    umpAt: -1,
    script: ['sit:0', 'sit:2', 'sit:9', 'sit:5']
  },
  {
    limit: 95,
    goal: 38,
    balls: [9, 10],
    refill: 2.8,
    empty: 1.3,
    hit: 25,
    arc: [1, 2.4],
    cap: [3, 3, 4],
    interval: [1.2, 1.1, 1.0],
    mix: [
      { walk: 3, sit: 1, peek: 2, hop: 1 },
      { walk: 2, peek: 2, shield: 2, charge: 1, hop: 1 },
      { walk: 2, peek: 2, shield: 2, charge: 2, hop: 2 }
    ],
    walk: [44, 60],
    peek: [1.6, 1.6],
    hop: [1.2, 0.65],
    charge: 28,
    sitLife: 8,
    timed: 0,
    shelf: true,
    umpAt: -1,
    script: []
  },
  {
    limit: 110,
    goal: 50,
    balls: [6, 8],
    refill: 3.2,
    empty: 1.5,
    hit: 23,
    arc: [1, 0.45],
    cap: [4, 4, 3],
    interval: [1.1, 1.0, 1.1],
    mix: [
      { walk: 3, peek: 2, shield: 1, hop: 2, charge: 1, timed: 1 },
      { walk: 2, peek: 2, shield: 2, charge: 2, hop: 2, timed: 2 },
      { walk: 2, peek: 1, shield: 1, charge: 2, timed: 1 }
    ],
    walk: [58, 80],
    peek: [1.2, 1.4],
    hop: [0.9, 0.6],
    charge: 36,
    sitLife: 7,
    timed: 2.6,
    umpUp: 2.4,
    shelf: true,
    umpAt: 2,
    script: []
  },
  {
    limit: 90,
    goal: 43,
    balls: [6, 7],
    refill: 3.2,
    empty: 1.6,
    hit: 21,
    arc: [1, 0.22],
    cap: [4, 4, 4],
    interval: [0.95, 0.9, 0.9],
    mix: [
      { walk: 3, shield: 2, peek: 2, hop: 2, charge: 1, timed: 1 },
      { walk: 3, shield: 3, peek: 1, charge: 2, hop: 1, timed: 1 },
      { walk: 3, shield: 2, peek: 1, charge: 3, timed: 1 }
    ],
    walk: [76, 98],
    peek: [0.95, 1.3],
    hop: [0.75, 0.55],
    charge: 46,
    sitLife: 6,
    timed: 2.2,
    umpUp: 2.4,
    shelf: true,
    umpAt: 1,
    script: []
  }
];

// Points, art and the first-sighting banner for each kind.
const PITCH_KINDS = {
  sit: { points: 100, art: 0 },
  walk: { points: 150, art: 0 },
  hop: { points: 170, art: 3 },
  peek: { points: 160, art: 1 },
  shield: { points: 250, art: 0 },
  charge: { points: 140, art: 1 },
  timed: { points: 300, art: 2 },
  ump: { points: 200, art: 3 }
};

const PITCH_INTROS = {
  walk: 'WALKER · FLICK WHERE IT IS GOING, NOT WHERE IT IS',
  peek: 'PEEKER · WAIT FOR THE HEAD, OR SWIPE LONG AND LOB ONE OVER THE TOP',
  hop: 'HOPPER · NAIL THE LANDING, OR MID-AIR FOR A BONUS',
  shield: 'BEDPAN SHIELD · BANK IT OFF A WALL',
  charge: 'BED RUSH · STOP IT BEFORE THE FOOTBOARD',
  timed: 'GOLDEN GREMLIN · TWO FOR ONE · IT WILL NOT WAIT',
  ump: 'THE UMP · HIT HIM WHILE HE PEEKS OR HE THROWS BACK'
};

const PITCH_QUOTA_MISSED =
  'Game over. Quota missed. Lead the walkers, bank the shields, and keep the bucket full: every hit puts a ball back.';

const PITCH = registerGame({
  id: 0,
  canvas: { w: 800, h: 450 },
  portraitCanvas: { w: 450, h: 800 },
  layout: 'gesture',
  music: 'game:pitch',
  legendary: true,
  info: {
    game: 'Fastpitch Fever',
    genre: 'FLICK · ARC · BANK · LEAD',
    headline: 'Bed rest. Rocket arm.',
    desc:
      'Broad daylight in Room 5, a bucket of softballs and a gremlin problem. Flick to throw: harder goes farther, a longer swipe throws higher. The ball arcs, banks off the walls, rattles the furniture and splats whatever it finds. Lead the walkers, time the peekers, ring the Ensure bottles. Every hit puts a ball back in the bucket.',
    goal: 'Hit the eviction quota before the last inning ends, and keep the gremlins off the bed.',
    control:
      'Swipe up through a gremlin and let go. Flick harder to throw farther. A short flick is a fast low ball, a long slow swipe is a lob that drops behind the furniture. The faint arc shows the throw while your finger moves. Mouse: drag and let go the same way. Keys: left and right aim, up and down set the power, W and S the arc, Space throws.',
    avoid:
      'Walkers keep moving, so throw where they are going. Peekers duck behind the furniture. A bedpan shield means bank it off a wall. A gremlin that reaches the footboard is an oops. Misses empty the bucket; hits fill it.',
    cue: 'Swipe up through it · harder goes farther · longer swipe, higher arc · lead the walkers'
  },
  tierNotes: [
    '80s · big sitting ducks, then slow walkers · the arc shows every bounce',
    '95s · walkers, peekers, bedpan shields · bank shots',
    '110s · the Ump · golden gremlins · a smaller bucket · half an arc',
    '90s · fast walkers, shield walls, the Ump by inning 2 · six balls · feel it'
  ],
  shiftName: 'INNING',
  init() {
    initArcadeRun(PITCH_TIERS[mini.tier].limit);
    pitchInit();
  },
  controls() {
    setControls([{ id: 'throw', text: 'THROW', key: 'Space', hot: true }]);
  },
  update(dt) {
    updateArcade(dt, pitchUpdate);
  },
  draw(g) {
    if (mini.screen === 'outro' && mini.pendingFinish && !mini.pendingFinish.win) {
      pitchDrawLoss(g);
      return;
    }
    pitchDraw(g);
  },
  overlay(g) {
    if (mini.screen === 'outro' && mini.pendingFinish && !mini.pendingFinish.win) return;
    drawArcadeOverlays(g);
  },
  // Canvas presses are flicks. Every sample keeps its time; the release reads the last moments of it.
  down(p) {
    mini.pitchPress = { pts: [{ x: p.x, y: p.y, t: mini.total }], t0: mini.total, ax: p.x, ay: p.y, far: 0, movedT: mini.total, tall: !!mini.portrait };
    mini.pitchRipples.push({ x: p.x, y: p.y, t: 0, tall: !!mini.portrait });
    mini.pitchKeyAim = false;
    mini.pitchKeyShow = 0;
  },
  move(p) {
    const q = mini.pitchPress;
    if (q) pitchPressMove(q, p.x, p.y, mini.total);
  },
  up(cancel) {
    const q = mini.pitchPress;
    mini.pitchPress = null;
    if (!q || cancel || mini.screen !== 'play' || mini.paused || q.tall !== !!mini.portrait) return;
    const f = pitchFlickAim(q, mini.total);
    if (!f.ok) {
      pitchFlickRefused(q, f);
      return;
    }
    if (pitchThrow(pitchLaunch(f))) mini.pitchLastFlick = f;
  },
  // THROW (and Space) throws the keyboard aim, or repeats the last throw exactly.
  action(a) {
    if (a !== 'throw') return;
    pitchThrow(mini.pitchKeyAim || !mini.pitchLastV ? pitchLaunch(mini.pitchKeys) : mini.pitchLastV);
  },
  assist() {
    mini.pitchFreeze = 3;
    mini.pitchBalls = Math.max(mini.pitchBalls, mini.pitchCap);
    sfx('stun');
    mini.flash = 1;
    mini.flashText = 'TIMEOUT · BUCKET FULL · EVERYBODY FREEZE';
  },
  key(k, e) {
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k)) {
      keys.add(k);
      mini.pitchKeyAim = true;
      e.preventDefault();
      return true;
    }
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) miniAction('throw');
      return true;
    }
    return false;
  },
  shiftMessage(shift) {
    const T = PITCH_TIERS[mini.tier];
    if (shift === 1) {
      if (T.umpAt === 1) return 'INNING 2 · the Ump is early. Hit him while he peeks.';
      return mini.tier === 0 ? 'INNING 2 · walkers. Flick where they are going.' : 'INNING 2 · shields out. Bank it off a wall.';
    }
    if (T.umpAt === 2) return 'FINAL INNING · the Ump is in the building.';
    return mini.tier === 3 ? 'FINAL INNING · everybody is heading for the bed.' : 'FINAL INNING · they are heading for the bed.';
  },
  timeUp() {
    const met = mini.got >= mini.goal;
    finishMini(met, met ? undefined : PITCH_QUOTA_MISSED);
  },
  lesson() {
    const i = PITCH.info;
    return {
      title: i.game + ' · ' + mini.limit + ' second game',
      goal:
        i.goal +
        ' Evict ' +
        mini.goal +
        '.' +
        [' The arc shows every bounce while you swipe.', ' Shields come out in inning 2.', ' The Ump takes the final inning.', ' The Ump comes early and the arc barely shows. Feel it.'][mini.tier],
      control: i.control,
      avoid: i.avoid,
      demo: 'aim',
      cue: i.cue
    };
  },
  statLabel: () => 'EVICTIONS / INNING',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () =>
    `SCORE ${mini.score} · ${mini.pitchBalls}/${mini.pitchCap} BALLS · STREAK ${mini.combo}` +
    (mini.pitchBanks ? ` · ${mini.pitchBanks} BANKED` : ''),
  assistText: () => 'TIMEOUT · ' + mini.helps + ' (E)',
  // Accuracy, streaks and bank shots earn the medal; oopses and assists cost it.
  quality() {
    const acc = mini.pitchHits / Math.max(1, mini.pitchThrows),
      over = clamp((mini.got / mini.goal - 1) * 40, 0, 14);
    return Math.round(
      clamp(
        50 +
          over +
          acc * 24 +
          Math.min(8, mini.maxCombo * 0.7) +
          Math.min(6, mini.pitchBanks * 2) -
          mini.miss * 7 -
          mini.helpUsed * 3,
        0,
        100
      )
    );
  },
  onWin() {
    const tail = mini.pitchUmpDown
      ? ' The Ump has been ejected from his own game.'
      : mini.pitchBanks
        ? ` ${mini.pitchBanks} of them off the wall. Show-off.`
        : ' The Ensure is shaken, not stirred.';
    return `Room 5 is gremlin-free. ${mini.pitchHits} of ${mini.pitchThrows} throws found something.` + tail;
  },
  onLose(reason) {
    const stormed = reason !== PITCH_QUOTA_MISSED;
    return {
      gory: false,
      medal: '⚾',
      heading: stormed ? 'THE BED HAS BEEN STORMED.' : 'YER OUT.',
      text: stormed
        ? 'Gremlins on the blanket, gremlins on the pillow, one of them wearing your mitt. Stop the chargers before the footboard, and hit the Ump while he peeks.'
        : PITCH_QUOTA_MISSED
    };
  },
  // A lost game ends with the gremlins in Macy's bed and the Ump making the call.
  resultArt(g) {
    if (mini.win) return false;
    pitchResultLoss(g);
    return true;
  },
  scene(g, w, h) {
    pitchScene(g, w, h);
  }
});

// ---- Camera ----
function pitchCam() {
  const C = mini.portrait ? PITCH_CAMS.tall : PITCH_CAMS.wide;
  if (C.s === undefined) {
    C.s = Math.sin(C.tilt);
    C.c = Math.cos(C.tilt);
  }
  return C;
}

// Room cm to canvas px. k is canvas px per cm at that depth; d is the depth along the view.
function pitchProject(x, y, z, C = pitchCam()) {
  const vx = x - C.x,
    vy = y - C.y,
    vz = z - C.z,
    d = Math.max(1, -vy * C.s + vz * C.c),
    u = vy * C.c + vz * C.s,
    k = C.f / d;
  return { x: C.cx + vx * k, y: C.cy - u * k, k, d };
}

// The ray from the camera through canvas point (sx, sy): origin and unit direction.
function pitchRay(sx, sy, C = pitchCam()) {
  const rx = (sx - C.cx) / C.f,
    ru = (C.cy - sy) / C.f,
    dx = rx,
    dy = ru * C.c - C.s,
    dz = ru * C.s + C.c,
    n = Math.hypot(dx, dy, dz);
  return { o: { x: C.x, y: C.y, z: C.z }, d: { x: dx / n, y: dy / n, z: dz / n } };
}

// Where canvas point (sx, sy) lies on the gremlin-height plane, in room cm. Both cameras look down on
// the whole room, so every canvas point has one.
function pitchPlanePoint(sx, sy, C = pitchCam()) {
  const { o, d } = pitchRay(sx, sy, C),
    t = (PITCH_YREF - o.y) / Math.min(d.y, -1e-6);
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}

// ---- Flicks ----
// A press keeps every finger sample with its time (mini.total). The swipe's start (ax, ay) follows the
// finger while it winds down the screen or rests, so the swipe is the stroke that threw.
function pitchPressMove(q, x, y, t) {
  const last = q.pts[q.pts.length - 1],
    dy = y - last.y;
  if (Math.hypot(x - last.x, dy) > 1.5) {
    if (dy > 3) {
      q.ax = x;
      q.ay = y;
    } else if (t - q.movedT > 0.1) {
      q.ax = last.x;
      q.ay = last.y;
    }
    q.movedT = t;
  }
  q.far = Math.max(q.far, Math.hypot(x - q.pts[0].x, y - q.pts[0].y));
  q.pts.push({ x, y, t });
  // Half a second of history is plenty; keep at least two samples.
  while (q.pts.length > 2 && q.pts[1].t < t - 0.5) q.pts.shift();
}

// The finger at time t: the last sample at or before t, eased toward the next one.
function pitchPressAt(q, t) {
  const s = q.pts;
  let i = s.length - 1;
  while (i > 0 && s[i].t > t) i--;
  const a = s[i],
    b = s[i + 1];
  if (!b || b.t <= a.t || t <= a.t) return a;
  const u = (t - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, t };
}

function pitchFlickDist(speed) {
  const u = clamp((speed - PITCH_FLICK_SOFT) / (PITCH_FLICK_HARD - PITCH_FLICK_SOFT), 0, 1);
  return PITCH_DIST[0] + (PITCH_DIST[1] - PITCH_DIST[0]) * u;
}

function pitchFlickSpeedFor(dist) {
  return PITCH_FLICK_SOFT + ((PITCH_FLICK_HARD - PITCH_FLICK_SOFT) * (dist - PITCH_DIST[0])) / (PITCH_DIST[1] - PITCH_DIST[0]);
}

function pitchSwipeLoft(swipe) {
  return clamp((swipe - PITCH_SWIPE[0]) / (PITCH_SWIPE[1] - PITCH_SWIPE[0]), 0, 1);
}

function pitchLoftAngle(loft) {
  return PITCH_ARC[0] + (PITCH_ARC[1] - PITCH_ARC[0]) * loft;
}

// The point on a floor line (through P, heading wx, wz) that is dist from her hand: where the line
// leaves that circle, or, when it never reaches it, the circle's point nearest the line.
function pitchLineLanding(P, wx, wz, dist) {
  const H = PITCH_HAND,
    rx = P.x - H.x,
    rz = P.z - H.z,
    b = rx * wx + rz * wz,
    disc = b * b - (rx * rx + rz * rz - dist * dist);
  if (disc >= 0) {
    const k = -b + Math.sqrt(disc);
    return { x: P.x + wx * k, z: P.z + wz * k };
  }
  const cx = rx - b * wx,
    cz = rz - b * wz,
    n = Math.hypot(cx, cz) || 1;
  return { x: H.x + (cx / n) * dist, z: H.z + (cz / n) * dist };
}

// What a press throws if the finger lets go at time now. The flick is the motion over the last
// PITCH_FLICK_WIN seconds (the whole press, if it is younger). Its line, laid on the gremlin-height
// plane, is where the ball comes down; its speed picks how far along, measured from her hand; the swipe's
// length picks the arc. Returns { ok, speed, swipe, vx, vy, x, y } plus { yaw, dist, loft, land } when
// it throws, or why when it does not: 'tap', 'slow' or 'down'.
function pitchFlickAim(q, now = mini.total, C = pitchCam()) {
  const s = q.pts,
    end = s[s.length - 1],
    young = now - q.t0 < PITCH_FLICK_WIN,
    from = young ? q.t0 : now - PITCH_FLICK_WIN,
    a = young && end.t <= q.t0 ? s[0] : pitchPressAt(q, from),
    span = Math.max(now - from, 1 / 60),
    vx = (end.x - a.x) / span,
    vy = (end.y - a.y) / span,
    speed = Math.hypot(vx, vy),
    swipe = Math.hypot(end.x - q.ax, end.y - q.ay),
    out = { ok: false, speed, swipe, vx, vy, x: end.x, y: end.y };
  if (speed < PITCH_FLICK_MIN) return { ...out, why: q.far < PITCH_TAP ? 'tap' : 'slow' };
  if (vy > -PITCH_STEER * speed) return { ...out, why: 'down' };
  const P0 = pitchPlanePoint(a.x, a.y, C),
    P1 = pitchPlanePoint(end.x, end.y, C),
    wn = Math.hypot(P1.x - P0.x, P1.z - P0.z) || 1,
    dist = pitchFlickDist(speed),
    land = pitchLineLanding(P1, (P1.x - P0.x) / wn, (P1.z - P0.z) / wn, dist),
    yaw = clamp(Math.atan2(land.x - PITCH_HAND.x, land.z - PITCH_HAND.z), -1.5, 1.5);
  return { ...out, ok: true, yaw, dist, loft: pitchSwipeLoft(swipe), land };
}

// The launch for an aim: the speed that brings a ball at that arc down through PITCH_YREF exactly dist
// from her hand, gravity included.
function pitchLaunch(aim) {
  const a = pitchLoftAngle(aim.loft),
    c = Math.cos(a),
    v = Math.sqrt((PITCH_G * aim.dist * aim.dist) / (2 * c * c * Math.max(1, aim.dist * Math.tan(a) + PITCH_HAND.y - PITCH_YREF)));
  return { x: Math.sin(aim.yaw) * v * c, y: v * Math.sin(a), z: Math.cos(aim.yaw) * v * c };
}

// The aim (at a given arc) whose flight passes through room point Q, or null when no flick reaches it.
// Bots, the bank planner, guides and tests use it; the game never aims for the player.
function pitchAimAt(Q, loft) {
  const H = PITCH_HAND,
    a = pitchLoftAngle(loft),
    c = Math.cos(a),
    t = Math.tan(a),
    dx = Q.x - H.x,
    dz = Q.z - H.z,
    d = Math.hypot(dx, dz),
    den = 2 * c * c * (d * t + H.y - Q.y);
  if (den <= 0 || d < 1) return null;
  // The flight is y = H.y + x·t - k·x²; find where it comes down through PITCH_YREF.
  const k = den / (2 * c * c * d * d),
    dist = (t + Math.sqrt(t * t + 4 * k * (H.y - PITCH_YREF))) / (2 * k);
  if (!(dist >= PITCH_DIST[0] && dist <= PITCH_DIST[1])) return null;
  return { yaw: Math.atan2(dx, dz), dist, loft };
}

// A swipe on this canvas that throws an aim: a straight stroke along a line through the aim's landing
// point, heading away from her hand there, slid along that line until it fits on the canvas (clear of
// the HUD row). Tries the line from her hand's shadow first, then steeper ones. Returns the stroke's
// start and end (x0, y0, x1, y1), its direction and the speed and length to swipe it, or null.
function pitchSwipeFor(aim, C = pitchCam(), size = activeCanvas()) {
  const H = PITCH_HAND,
    P = { x: H.x + Math.sin(aim.yaw) * aim.dist, z: H.z + Math.cos(aim.yaw) * aim.dist },
    ps = pitchProject(P.x, PITCH_YREF, P.z, C),
    hs = pitchProject(H.x, PITCH_YREF, H.z, C),
    speed = pitchFlickSpeedFor(aim.dist),
    swipe = aim.loft > 0 ? PITCH_SWIPE[0] + (PITCH_SWIPE[1] - PITCH_SWIPE[0]) * aim.loft : PITCH_SWIPE[0] * 0.75,
    rn = Math.hypot(ps.x - hs.x, ps.y - hs.y) || 1;
  for (const mix of [1, 0.7, 0.4, 0]) {
    let ux = ((ps.x - hs.x) / rn) * mix,
      uy = ((ps.y - hs.y) / rn) * mix - (1 - mix);
    const un = Math.hypot(ux, uy) || 1;
    ux /= un;
    uy /= un;
    if (uy > -PITCH_STEER - 0.05) continue;
    const q0 = pitchPlanePoint(ps.x, ps.y, C),
      q1 = pitchPlanePoint(ps.x + ux * 20, ps.y + uy * 20, C);
    if ((q1.x - q0.x) * (P.x - H.x) + (q1.z - q0.z) * (P.z - H.z) <= 0) continue;
    const k = pitchFitSwipe(ps.x, ps.y, ux, uy, swipe, size);
    if (k === null) continue;
    const x1 = ps.x + ux * k,
      y1 = ps.y + uy * k;
    return { x0: x1 - ux * swipe, y0: y1 - uy * swipe, x1, y1, ux, uy, speed, swipe };
  }
  return null;
}

// How far to slide a stroke of length L (ending at p + u·k) along its line so both ends sit on the
// canvas: the k nearest 0, or null when no k fits.
function pitchFitSwipe(px, py, ux, uy, L, size) {
  let lo = -Infinity,
    hi = Infinity;
  for (const [p, u, min, max] of [
    [px, ux, 14, size.w - 14],
    [py, uy, 66, size.h - 14]
  ])
    for (const off of [0, -L]) {
      const at = p + u * off;
      if (Math.abs(u) < 1e-9) {
        if (at < min || at > max) return null;
        continue;
      }
      let a = (min - at) / u,
        b = (max - at) / u;
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
    }
  return lo > hi ? null : clamp(0, lo, hi);
}

// A press that threw nothing says why, where the finger was.
function pitchFlickRefused(q, f) {
  const text = f.why === 'tap' ? 'FLICK IT · SWIPE UP AND LET GO' : f.why === 'down' ? 'UP INTO THE ROOM' : 'QUICKER · FLICK IT';
  mini.pitchNote = { text, x: f.x, y: f.y - 30, t: 1.4, tall: !!mini.portrait };
  sfx('miss', { vol: 0.3 });
}

function pitchNewBall(v) {
  const H = PITCH_HAND;
  return {
    x: H.x,
    y: H.y,
    z: H.z,
    vx: v.x,
    vy: v.y,
    vz: v.z,
    age: 0,
    walls: 0,
    rest: 0,
    dead: false,
    hitIds: [],
    got: 0,
    bottles: 0,
    first: null,
    trail: []
  };
}

// Throws from Macy's hand. Returns true if a ball left the bucket.
function pitchThrow(v) {
  if (mini.screen !== 'play' || mini.paused || mini.pitchCd > 0) return false;
  if (mini.pitchBalls <= 0) {
    if (mini.pitchEmptyT <= 0) {
      pitchPopAt(PITCH_HAND.x - 40, PITCH_HAND.y + 30, PITCH_HAND.z + 40, 'BUCKET EMPTY · ONE IS COMING', '#ffd2b0');
      sfx('lock');
      mini.pitchEmptyT = 0.8;
    }
    return false;
  }
  const b = pitchNewBall(v);
  b.id = mini.pitchSerial++;
  b.yaw = Math.atan2(v.x, v.z);
  b.heat = mini.combo >= 5;
  mini.pitchBalls--;
  mini.pitchThrows++;
  mini.pitchCd = PITCH_COOLDOWN;
  mini.pitchLive.push(b);
  mini.pitchLastV = { x: v.x, y: v.y, z: v.z };
  mini.pitchArm = 1;
  mini.pitchThrewAt = mini.total;
  sfx('throw');
  return true;
}

// ---- Run setup ----
function pitchInit() {
  const T = PITCH_TIERS[mini.tier];
  Object.assign(mini, {
    goal: T.goal,
    pitchTargets: [],
    pitchLive: [],
    pitchBottles: [],
    pitchFlyers: [],
    pitchDecals: [],
    pitchPops: [],
    pitchRipples: [],
    pitchBalls: T.balls[0],
    pitchCap: T.balls[1],
    pitchRefillT: T.refill,
    pitchSerial: 0,
    pitchSpawnT: 0.6,
    pitchScript: T.script.slice(),
    pitchSeen: {},
    pitchThrows: 0,
    pitchHits: 0,
    pitchBanks: 0,
    pitchAirs: 0,
    pitchLobs: 0,
    pitchKinds: {},
    pitchUmpHits: 0,
    pitchDoubles: 0,
    pitchRings: 0,
    pitchSaves: 0,
    pitchCd: 0,
    pitchEmptyT: 0,
    pitchFreeze: 0,
    pitchShake: 0,
    pitchHitFlash: 0,
    pitchArm: 0,
    pitchThrewAt: -9,
    // The keyboard's aim: which way, how far (cm from her hand) and how high (0 to 1).
    pitchKeys: { yaw: -0.2, dist: 300, loft: 0.3 },
    pitchKeyAim: false,
    pitchKeyShow: 0,
    pitchLastV: null,
    pitchLastFlick: null,
    pitchPress: null,
    pitchNote: null,
    pitchSplats: [],
    pitchMisses: 0,
    pitchIncoming: null,
    pitchUmpSpawned: false,
    pitchUmpDown: false,
    pitchEtype: 0,
    pitchEtypeHits: 0,
    pitchRestock: { pyramid: 0, shelf: 0 },
    pitchBedFx: null,
    pitchLossFx: false,
    pitchLossCall: false,
    pitchWasTall: !!mini.portrait
  });
  pitchStock('pyramid');
  if (T.shelf) pitchStock('shelf');
}

function pitchTune() {
  return PITCH_TIERS[mini.tier];
}

function pitchPace() {
  return (mini.rules && mini.rules.mini) || 1;
}

// ---- Targets ----
function pitchCenter(e) {
  const s = e.size || 1;
  return { x: e.x, y: e.y + 24 * s, z: e.z };
}

// A hiding peeker is a smaller target, all of it tucked behind its cover: only a ball that drops
// over the top can reach it.
function pitchRadius(e) {
  if (e.kind === 'peek' && e.mode === 'hidden') return 14;
  return pitchTune().hit * (e.size || 1);
}

function pitchHittable(e) {
  if (e.state === 'dying' || e.state === 'gone') return false;
  if (e.kind === 'ump') return e.mode !== 'hidden';
  return true;
}

function pitchSpotFree(x, z, key) {
  for (const e of mini.pitchTargets) {
    if (e.state === 'dying') continue;
    if (key && e.spot === key) return false;
    if (Math.hypot(e.x - x, e.z - z) < 62) return false;
  }
  return true;
}

function pitchPickWeighted(mix) {
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  let roll = rand(0, total);
  for (const [k, w] of Object.entries(mix)) {
    roll -= w;
    if (roll < 0) return k;
  }
  return Object.keys(mix)[0];
}

function pitchMakeTarget(kind, x, y, z, extra = {}) {
  const e = {
    id: mini.pitchSerial++,
    kind,
    x,
    y,
    z,
    px: x,
    py: y,
    pz: z,
    vx: 0,
    vy: 0,
    vz: 0,
    t: 0,
    age: 0,
    state: 'live',
    inT: 0.3,
    art: PITCH_KINDS[kind].art,
    size: 1,
    ...extra
  };
  mini.pitchTargets.push(e);
  if (!mini.pitchSeen[kind]) {
    mini.pitchSeen[kind] = true;
    if (PITCH_INTROS[kind]) {
      mini.flash = 2;
      mini.flashText = PITCH_INTROS[kind];
    }
  }
  return e;
}

// Spawns one gremlin of a kind at a free spot. Returns it, or null when nowhere fits.
function pitchSpawn(kind, index = null) {
  const T = pitchTune(),
    pace = pitchPace(),
    high = mini.tier > 0;
  if (kind === 'sit' || kind === 'shield' || kind === 'timed') {
    const pool = PITCH_SITS.map((s, i) => ({ ...s, i })).filter(
      s => (index === null ? (high || !s.high) && (kind !== 'shield' || !(s.high || s.wall)) : s.i === index) && pitchSpotFree(s.x, s.z, 'sit:' + s.i)
    );
    if (!pool.length) return null;
    const s = pick(pool);
    return pitchMakeTarget(kind, s.x, s.y, s.z, {
      spot: 'sit:' + s.i,
      life: kind === 'timed' ? T.timed / Math.sqrt(pace) : T.sitLife,
      lifeMax: kind === 'timed' ? T.timed / Math.sqrt(pace) : T.sitLife,
      art: kind === 'sit' ? pick([0, 1, 3]) : PITCH_KINDS[kind].art
    });
  }
  if (kind === 'walk') {
    const pool = PITCH_WALKS.map((w, i) => ({ ...w, i })).filter(
      w => (index === null ? high || !w.high : w.i === index) && !mini.pitchTargets.some(e => e.spot === 'walk:' + w.i)
    );
    if (!pool.length) return null;
    const w = pick(pool),
      u = rand(0.1, 0.9),
      dir = rand(0, 1) < 0.5 ? 1 : -1,
      len = Math.hypot(w.b[0] - w.a[0], w.b[2] - w.a[2]),
      pos = pitchLerp3(w.a, w.b, u);
    if (!pitchSpotFree(pos[0], pos[2])) return null;
    return pitchMakeTarget('walk', pos[0], pos[1], pos[2], {
      spot: 'walk:' + w.i,
      path: w,
      u,
      dir,
      len,
      speed: rand(T.walk[0], T.walk[1]) * pace,
      wait: 0
    });
  }
  if (kind === 'peek') {
    const pool = PITCH_PEEKS.filter(
      p => (high || p.id !== 'footboard') && !mini.pitchTargets.some(e => e.spot === 'peek:' + p.id || (e.kind === 'ump' && e.cover.id === p.id))
    );
    if (!pool.length) return null;
    const p = pick(pool);
    return pitchMakeTarget('peek', p.hide[0], p.hide[1], p.hide[2], {
      spot: 'peek:' + p.id,
      cover: p,
      mode: 'hidden',
      modeT: rand(0.5, 1.1),
      cycles: 0,
      key: p.key,
      art: pick([1, 3])
    });
  }
  if (kind === 'hop') {
    const pool = PITCH_HOPS.map((h, i) => ({ h, i })).filter(o => pitchSpotFree(o.h[0], o.h[2], 'hop:' + o.i));
    if (!pool.length) return null;
    const o = pick(pool);
    return pitchMakeTarget('hop', o.h[0], o.h[1], o.h[2], {
      spot: 'hop:' + o.i,
      hopAt: o.i,
      mode: 'rest',
      modeT: T.hop[0] / pace
    });
  }
  if (kind === 'charge') {
    const pool = PITCH_CHARGES.filter(c => pitchSpotFree(c[0], c[2]));
    if (!pool.length) return null;
    const c = pick(pool),
      goal = [rand(40, 140), 0, PITCH_REACH - 8];
    return pitchMakeTarget('charge', c[0], c[1], c[2], {
      spot: 'charge',
      from: c,
      goal,
      u: 0,
      len: Math.hypot(goal[0] - c[0], goal[2] - c[2]),
      speed: T.charge * pace * rand(0.9, 1.1),
      sway: rand(0, 6)
    });
  }
  return null;
}

function pitchSpawnUmp() {
  mini.pitchUmpSpawned = true;
  const free = PITCH_UMP_SPOTS.filter(u => !mini.pitchTargets.some(o => o.kind === 'peek' && o.cover.id === u.id)),
    spot = pick(free.length ? free : PITCH_UMP_SPOTS);
  mini.pitchTargets.push({
    id: mini.pitchSerial++,
    kind: 'ump',
    x: spot.hide[0],
    y: spot.hide[1],
    z: spot.hide[2],
    px: spot.hide[0],
    py: spot.hide[1],
    pz: spot.hide[2],
    vx: 0,
    vy: 0,
    vz: 0,
    t: 0,
    age: 0,
    state: 'live',
    inT: 0,
    art: 3,
    size: 1.45,
    hp: 4,
    hpMax: 4,
    cover: spot,
    key: spot.key,
    mode: 'hidden',
    modeT: 1.2,
    spot: 'ump'
  });
  mini.flash = 2.4;
  mini.flashText = PITCH_INTROS.ump;
  sfx('boss');
}

function pitchUpdateSpawns(dt) {
  const T = pitchTune();
  if (T.umpAt >= 0 && mini.shift >= T.umpAt && !mini.pitchUmpSpawned) pitchSpawnUmp();
  mini.pitchSpawnT -= dt;
  if (mini.pitchSpawnT > 0) return;
  const alive = mini.pitchTargets.filter(e => e.kind !== 'ump' && e.state === 'live').length;
  if (alive >= T.cap[mini.shift]) {
    mini.pitchSpawnT = 0.25;
    return;
  }
  let made = null;
  if (mini.pitchScript.length) {
    const [kind, at] = mini.pitchScript[0].split(':');
    made = pitchSpawn(kind, at === undefined ? null : +at);
    if (made) mini.pitchScript.shift();
  } else made = pitchSpawn(pitchPickWeighted(T.mix[mini.shift]));
  mini.pitchSpawnT = made ? T.interval[mini.shift] * rand(0.8, 1.2) : 0.4;
}

function pitchLerp3(a, b, u) {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

// A gremlin that wanders off (sat too long, or a golden one that ran out of patience).
function pitchLeave(e, text) {
  e.state = 'dying';
  e.dyT = 0.35;
  e.left = true;
  if (text) pitchPopAt(e.x, e.y + 60, e.z, text, '#d8ecf2');
}

function pitchUpdateTargets(dt) {
  const T = pitchTune(),
    pace = pitchPace(),
    frozen = mini.pitchFreeze > 0;
  for (const e of mini.pitchTargets) {
    e.px = e.x;
    e.py = e.y;
    e.pz = e.z;
    e.inT = Math.max(0, e.inT - dt);
    e.hit = Math.max(0, (e.hit || 0) - dt);
    if (e.state === 'dying') {
      e.dyT -= dt;
      if (e.dyT <= 0) e.state = 'gone';
      continue;
    }
    if (frozen) {
      // Caught in the open: peekers and the Ump stand up and wait.
      if ((e.kind === 'peek' || e.kind === 'ump') && e.mode === 'hidden') pitchPeekMode(e, 'rise');
      if ((e.kind === 'peek' || e.kind === 'ump') && e.mode === 'rise') {
        e.modeT -= dt;
        pitchPeekPlace(e);
        if (e.modeT <= 0) pitchPeekMode(e, 'up');
      }
      continue;
    }
    e.t += dt;
    e.age += dt;
    if (e.kind === 'sit' || e.kind === 'shield' || e.kind === 'timed') {
      if (e.life) {
        e.life -= dt;
        if (e.life <= 0) pitchLeave(e, e.kind === 'timed' ? 'TOO SLOW' : 'BORED');
      }
    } else if (e.kind === 'walk') pitchUpdateWalk(e, dt);
    else if (e.kind === 'charge') pitchUpdateCharge(e, dt);
    else if (e.kind === 'hop') pitchUpdateHop(e, dt, T, pace);
    else if (e.kind === 'peek') pitchUpdatePeek(e, dt, T, pace);
    else if (e.kind === 'ump') pitchUpdateUmp(e, dt, pace);
  }
  for (const e of mini.pitchTargets) {
    if (dt > 0) {
      e.vx = (e.x - e.px) / dt;
      e.vy = (e.y - e.py) / dt;
      e.vz = (e.z - e.pz) / dt;
    }
  }
  mini.pitchTargets = mini.pitchTargets.filter(e => e.state !== 'gone');
}

// Walkers pace a path and pause a beat at each end before turning around.
function pitchUpdateWalk(e, dt) {
  if (e.wait > 0) {
    e.wait -= dt;
    return;
  }
  e.u += (e.dir * e.speed * dt) / e.len;
  if (e.u > 1 || e.u < 0) {
    e.u = clamp(e.u, 0, 1);
    e.dir *= -1;
    e.wait = 0.4;
  }
  const p = pitchLerp3(e.path.a, e.path.b, e.u);
  e.x = p[0];
  e.y = p[1];
  e.z = p[2];
}

// Chargers head for the bed with a little sway. The one that gets there is an oops.
function pitchUpdateCharge(e, dt) {
  e.u += (e.speed * dt) / e.len;
  const p = pitchLerp3(e.from, e.goal, Math.min(1, e.u)),
    dx = e.goal[0] - e.from[0],
    dz = e.goal[2] - e.from[2],
    n = Math.hypot(dx, dz) || 1,
    sway = Math.sin(e.age * 2.4 + e.sway) * 22 * Math.min(1, e.u * 4) * (1 - e.u);
  e.x = clamp(p[0] + (-dz / n) * sway, -PITCH_WALL + 20, PITCH_WALL - 20);
  e.y = 0;
  e.z = p[2] + (dx / n) * sway;
  if (e.z <= PITCH_REACH) pitchBedInvaded(e);
}

function pitchBedInvaded(e) {
  e.state = 'dying';
  e.dyT = 0.01;
  e.left = true;
  const p = pitchProject(e.x, 60, Math.max(e.z, 140));
  mini.pitchBedFx = { t: 0, x: p.x, y: p.y, art: e.art };
  mini.pitchHitFlash = 0.35;
  mini.pitchShake = 0.3;
  sfx('leap');
  miniOops('ON THE BED · STOP THEM BEFORE THE FOOTBOARD');
}

// Hoppers rest, crouch, then jump to another spot on a parabola.
function pitchUpdateHop(e, dt, T, pace) {
  e.modeT -= dt;
  if (e.mode === 'rest') {
    if (e.modeT <= 0) {
      e.mode = 'crouch';
      e.modeT = 0.25;
    }
  } else if (e.mode === 'crouch') {
    if (e.modeT <= 0) {
      const options = PITCH_HOPS.map((h, i) => ({ h, i })).filter(
        o => o.i !== e.hopAt && Math.hypot(o.h[0] - e.x, o.h[2] - e.z) < 280 && pitchSpotFree(o.h[0], o.h[2], 'hop:' + o.i)
      );
      if (!options.length) {
        e.mode = 'rest';
        e.modeT = 0.5;
        return;
      }
      const o = pick(options);
      e.mode = 'air';
      e.from = [e.x, e.y, e.z];
      e.to = o.h;
      e.hopAt = o.i;
      e.spot = 'hop:' + o.i;
      e.airT = 0;
      e.airDur = T.hop[1] / Math.sqrt(pace);
      sfx('jump', { vol: 0.5 });
    }
  } else if (e.mode === 'air') {
    e.airT += dt;
    const u = clamp(e.airT / e.airDur, 0, 1),
      p = pitchLerp3(e.from, e.to, u);
    e.x = p[0];
    e.z = p[2];
    e.y = p[1] + Math.sin(u * Math.PI) * 70;
    if (u >= 1) {
      e.y = e.to[1];
      e.mode = 'rest';
      e.modeT = (T.hop[0] / pace) * rand(0.8, 1.25);
    }
  }
}

// Peekers: hidden, rise, up, sink, hidden. After three peeks without a hit they find new cover.
function pitchPeekMode(e, mode) {
  e.mode = mode;
  const T = pitchTune(),
    pace = pitchPace();
  if (mode === 'rise' || mode === 'sink') e.modeT = 0.2;
  else if (mode === 'up') e.modeT = e.kind === 'ump' ? pitchUmpUp() : T.peek[0] / pace;
  else e.modeT = e.kind === 'ump' ? rand(0.9, 1.5) : T.peek[1] * rand(0.8, 1.3);
}

function pitchPeekPlace(e) {
  const c = e.cover,
    k = e.mode === 'rise' ? 1 - clamp(e.modeT / 0.2, 0, 1) : e.mode === 'sink' ? clamp(e.modeT / 0.2, 0, 1) : e.mode === 'up' ? 1 : 0,
    s = k * k * (3 - 2 * k),
    p = pitchLerp3(c.hide, c.up, s);
  e.x = p[0];
  e.y = p[1];
  e.z = p[2];
  e.show = s;
}

function pitchUpdatePeek(e, dt) {
  e.modeT -= dt;
  if (e.modeT <= 0) {
    if (e.mode === 'hidden') pitchPeekMode(e, 'rise');
    else if (e.mode === 'rise') pitchPeekMode(e, 'up');
    else if (e.mode === 'up') pitchPeekMode(e, 'sink');
    else {
      pitchPeekMode(e, 'hidden');
      e.cycles++;
      if (e.cycles >= 3) {
        const free = PITCH_PEEKS.filter(
          p => (mini.tier > 0 || p.id !== 'footboard') && p.id !== e.cover.id && !mini.pitchTargets.some(o => o.spot === 'peek:' + p.id)
        );
        if (free.length) {
          e.cover = pick(free);
          e.spot = 'peek:' + e.cover.id;
          e.key = e.cover.key;
          e.cycles = 0;
        }
      }
    }
  }
  pitchPeekPlace(e);
}

// The Ump peeks out like the rest, but stays up longer, and if nobody hits him he throws a bedpan.
function pitchUpdateUmp(e, dt) {
  e.modeT -= dt;
  if (e.modeT <= 0) {
    if (e.mode === 'hidden') {
      pitchPeekMode(e, 'rise');
      sfx('boss', { vol: 0.5 });
    } else if (e.mode === 'rise') pitchPeekMode(e, 'up');
    else if (e.mode === 'up') {
      // Nobody hit him: the brushback.
      const c = pitchCenter(e);
      mini.pitchIncoming = { x: c.x, y: c.y + 20, z: c.z, t: 0, dur: 0.6 };
      sfx('swing');
      pitchPeekMode(e, 'sink');
    } else if (e.mode === 'sink') {
      pitchPeekMode(e, 'hidden');
      pitchUmpMove(e);
    }
  }
  pitchPeekPlace(e);
}

// How long the Ump stays out before he throws. The prescription moves it less than everything else:
// it is the one window that costs an oops.
function pitchUmpUp() {
  return pitchTune().umpUp / Math.sqrt(pitchPace());
}

function pitchUmpMove(e) {
  const free = PITCH_UMP_SPOTS.filter(s => s.id !== e.cover.id && !mini.pitchTargets.some(o => o.kind === 'peek' && o.cover.id === s.id));
  e.cover = pick(free.length ? free : PITCH_UMP_SPOTS);
  e.key = e.cover.key;
}

function pitchUpdateIncoming(dt) {
  const b = mini.pitchIncoming;
  if (!b) return;
  b.t += dt;
  if (b.t >= b.dur) {
    mini.pitchIncoming = null;
    mini.pitchHitFlash = 0.4;
    mini.pitchShake = 0.35;
    sfx('squelch');
    miniOops('BRUSHBACK · HIT THE UMP WHILE HE PEEKS');
  }
}

// Where a gremlin's middle will be dt seconds from now if nobody hits it, or null when that is not
// knowable (a hopper about to pick its next spot, a peeker that will have ducked). Never touches the
// random sequence, so tests and bots can call it freely.
function pitchFuture(e, dt) {
  if (e.state !== 'live') return null;
  const s = (e.size || 1) * 24,
    at = (x, y, z) => ({ x, y: y + s, z });
  if (mini.pitchFreeze > dt) return pitchHittable(e) ? at(e.x, e.y, e.z) : null;
  if (e.kind === 'sit' || e.kind === 'shield' || e.kind === 'timed') return !e.life || e.life > dt ? at(e.x, e.y, e.z) : null;
  if (e.kind === 'walk') {
    let u = e.u,
      dir = e.dir,
      wait = e.wait,
      left = dt;
    for (let i = 0; i < 8 && left > 1e-9; i++) {
      if (wait > 0) {
        const w = Math.min(wait, left);
        wait -= w;
        left -= w;
        continue;
      }
      const room = dir > 0 ? 1 - u : u,
        need = (room * e.len) / e.speed;
      if (need >= left) {
        u += (dir * e.speed * left) / e.len;
        left = 0;
      } else {
        u = dir > 0 ? 1 : 0;
        left -= need;
        dir *= -1;
        wait = 0.4;
      }
    }
    const p = pitchLerp3(e.path.a, e.path.b, clamp(u, 0, 1));
    return at(p[0], p[1], p[2]);
  }
  if (e.kind === 'charge') {
    const u = e.u + (e.speed * dt) / e.len,
      age = e.age + dt,
      p = pitchLerp3(e.from, e.goal, Math.min(1, u)),
      dx = e.goal[0] - e.from[0],
      dz = e.goal[2] - e.from[2],
      n = Math.hypot(dx, dz) || 1,
      sway = Math.sin(age * 2.4 + e.sway) * 22 * Math.min(1, u * 4) * (1 - u),
      z = p[2] + (dx / n) * sway;
    return z <= PITCH_REACH ? null : at(clamp(p[0] + (-dz / n) * sway, -PITCH_WALL + 20, PITCH_WALL - 20), 0, z);
  }
  if (e.kind === 'hop') {
    if (e.mode === 'rest') return e.modeT + 0.25 > dt ? at(e.x, e.y, e.z) : null;
    if (e.mode === 'crouch') return e.modeT > dt ? at(e.x, e.y, e.z) : null;
    const u = clamp((e.airT + dt) / e.airDur, 0, 1),
      p = pitchLerp3(e.from, e.to, u);
    return at(p[0], u >= 1 ? e.to[1] : p[1] + Math.sin(u * Math.PI) * 70, p[2]);
  }
  // Peekers and the Ump: follow the timeline while it is fixed (rise, up, sink).
  let mode = e.mode,
    t = e.modeT,
    left = dt;
  const T = pitchTune(),
    up = e.kind === 'ump' ? pitchUmpUp() : T.peek[0] / pitchPace(),
    next = { rise: ['up', up], up: ['sink', 0.2], sink: ['hidden', 0] };
  while (left > t) {
    if (mode === 'hidden' || !next[mode]) return null;
    left -= t;
    [mode, t] = next[mode];
    if (mode === 'hidden') return null;
  }
  if (mode === 'hidden') return null;
  const rest = t - left,
    k = mode === 'rise' ? 1 - clamp(rest / 0.2, 0, 1) : mode === 'sink' ? clamp(rest / 0.2, 0, 1) : 1,
    sm = k * k * (3 - 2 * k),
    p = pitchLerp3(e.cover.hide, e.cover.up, sm);
  return sm < 0.5 ? null : at(p[0], p[1], p[2]);
}

// A bank shot that gets a bedpan shield: an aim, the swipe that throws it on this canvas, its flight
// and where it meets the wall. Searched with the real physics, seeded at the gremlin's mirror image in
// each wall (the nearer side wall, the far one, the back wall) at a few arcs, coarse to fine around the
// closest miss, then centred in the window of aims that work so a slightly-off flick still banks in.
// Only aims a swipe on this canvas can make count. Shields stand on fixed spots, so plans are cached per
// spot, canvas shape and gremlin size for the session; it never touches the random sequence.
const pitchBankCache = new Map(),
  pitchBankJobs = new Map();

// Bottles sit on the tray and the shelf; a planned bank never threads them.
const PITCH_BOTTLE_ZONES = [
  { x0: -132, x1: -90, y0: 78, y1: 145, z0: 225, z1: 237 },
  { x0: 180, x1: 216, y0: 94, y1: 119, z0: 294, z1: 306 }
];

// Flies an aim with no gremlins in the room: { miss: 0, bounce, path } when it comes off a wall into
// point c (radius R), else how close it came after a wall (a million when it never got that far, or
// went straight into the bedpan first).
function pitchBankFly(aim, c, R, Rclang) {
  const b = pitchNewBall(pitchLaunch(aim)),
    path = [];
  let bounce = null,
    miss = 1e6;
  for (let i = 0; i < 720 && !b.dead; i++) {
    const hit = pitchMoveBall(b, PITCH_SUB);
    if (i % 3 === 0) path.push([b.x, b.y, b.z]);
    if ((hit === 'wall' || hit === 'back') && !bounce) bounce = { x: b.x, y: b.y, z: b.z };
    const d = Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z);
    if (!b.walls) {
      if (d < Rclang) return { miss: 1e6 };
    } else {
      if (d < R) return { miss: 0, bounce, path };
      miss = Math.min(miss, d);
      if (b.age > 0.2 && (b.x - c.x) * b.vx + (b.z - c.z) * b.vz > 0 && Math.hypot(b.x - c.x, b.z - c.z) > R * 2) break;
    }
    if (hit && hit !== 'wall' && hit !== 'back' && hit !== 'floor') break;
    for (const z of PITCH_BOTTLE_ZONES)
      if (b.x > z.x0 && b.x < z.x1 && b.y > z.y0 && b.y < z.y1 && b.z > z.z0 && b.z < z.z1) return { miss };
  }
  return { miss };
}

// The search, one flight per step, so the game can spread it over frames.
function* pitchBankSearch(e, C, size) {
  const H = PITCH_HAND,
    c = pitchCenter(e),
    R = pitchRadius(e) * 0.8 + PITCH_BALL,
    Rc = pitchRadius(e) + PITCH_BALL,
    near = c.x < 0 ? -1 : 1,
    mirrors = [
      { x: 2 * near * PITCH_WALL - c.x, y: c.y, z: c.z },
      { x: -2 * near * PITCH_WALL - c.x, y: c.y, z: c.z },
      { x: c.x, y: c.y, z: 2 * PITCH_BACK - c.z }
    ],
    span = d => clamp(d, PITCH_DIST[0], PITCH_DIST[1]);
  let plan = null;
  for (const m of mirrors)
    for (const loft of [0.1, 0.3]) {
      const seed = pitchAimAt(m, loft) || { yaw: Math.atan2(m.x - H.x, m.z - H.z), dist: PITCH_DIST[1] };
      let centre = { yaw: seed.yaw, dist: seed.dist },
        best = Infinity,
        found = null;
      for (const [sy, sd] of [
        [0.06, 48],
        [0.02, 16],
        [0.007, 6]
      ]) {
        let next = null;
        for (let i = -2; i <= 2 && !found; i++)
          for (let j = -2; j <= 2 && !found; j++) {
            const aim = { yaw: centre.yaw + i * sy, dist: span(centre.dist + j * sd), loft },
              f = pitchBankFly(aim, c, R, Rc);
            yield;
            if (!f.miss) found = aim;
            else if (f.miss < best) {
              best = f.miss;
              next = aim;
            }
          }
        if (found || !next) break;
        centre = next;
      }
      if (!found) continue;
      // Centre it in the aims around it that also bank in (yaw ±0.02, distance ±24 cm); the wider that
      // window, the more forgiving the shot. Keep the most forgiving plan a swipe can throw.
      let n = 0,
        sumY = 0,
        sumD = 0;
      for (let a = -2; a <= 2; a++)
        for (let b = -2; b <= 2; b++) {
          const t = { yaw: found.yaw + a * 0.01, dist: span(found.dist + b * 12), loft };
          if (!pitchBankFly(t, c, R, Rc).miss) {
            n++;
            sumY += t.yaw;
            sumD += t.dist;
          }
          yield;
        }
      const mid = { yaw: sumY / n, dist: sumD / n, loft },
        pick = pitchBankFly(mid, c, R, Rc).miss ? found : mid,
        swipe = pitchSwipeFor(pick, C, size);
      if (swipe && (!plan || n > plan.width)) {
        const fly = pitchBankFly(pick, c, R, Rc);
        plan = { aim: pick, swipe, bounce: fly.bounce, path: fly.path, width: n };
        if (n >= 15) return plan;
      }
    }
  return plan;
}

// The plan for a shield (null when there is none). With a budget (flights), it works at most that
// much and answers undefined while it is still thinking; the game uses that to spread the search over
// frames. Bots and tests call it without one.
function pitchBankPlan(e, budget = Infinity) {
  const C = pitchCam(),
    size = activeCanvas(),
    key = [Math.round(e.x), Math.round(e.y), Math.round(e.z), mini.portrait ? 'tall' : 'wide', pitchRadius(e)].join();
  if (pitchBankCache.has(key)) return pitchBankCache.get(key);
  let job = pitchBankJobs.get(key);
  if (!job) pitchBankJobs.set(key, (job = pitchBankSearch(e, C, size)));
  for (let n = 0; n < budget; n++) {
    const r = job.next();
    if (r.done) {
      pitchBankCache.set(key, r.value);
      pitchBankJobs.delete(key);
      return r.value;
    }
  }
  return undefined;
}

// ---- Bottles ----
function pitchStock(set) {
  const spots = set === 'pyramid' ? PITCH_PYRAMID : PITCH_SHELF;
  mini.pitchBottles = mini.pitchBottles.filter(b => b.set !== set);
  spots.forEach((s, i) => mini.pitchBottles.push({ set, i, x: s[0], y: s[1], z: s[2], flavor: i % 3, up: true }));
}

function pitchBottleBox(b) {
  return {
    x0: b.x - PITCH_BOTTLE_W,
    x1: b.x + PITCH_BOTTLE_W,
    y0: b.y,
    y1: b.y + PITCH_BOTTLE_H,
    z0: b.z - PITCH_BOTTLE_W,
    z1: b.z + PITCH_BOTTLE_W,
    e: 0.5
  };
}

// A bottle goes flying, and anything stacked on it follows.
function pitchKnock(bottle, vx, vy, vz, ball) {
  if (!bottle.up) return;
  bottle.up = false;
  mini.pitchFlyers.push({
    x: bottle.x,
    y: bottle.y + PITCH_BOTTLE_H / 2,
    z: bottle.z,
    vx,
    vy,
    vz,
    rot: 0,
    spin: rand(-14, 14),
    flavor: bottle.flavor,
    t: 2.2
  });
  mini.pitchRings++;
  mini.score += 40;
  mini.pitchBalls = Math.min(mini.pitchCap, mini.pitchBalls + 1);
  if (ball) ball.bottles++;
  sfx('ricochet', { vol: 0.7 });
  pitchPopAt(bottle.x, bottle.y + 34, bottle.z, 'DING · +1 BALL', '#ffe39a');
  for (const o of mini.pitchBottles)
    if (o.up && o.set === bottle.set && o.y > bottle.y && Math.abs(o.x - bottle.x) < 12)
      pitchKnock(o, vx * 0.5 + rand(-40, 40), 60, vz * 0.5, ball);
  const set = mini.pitchBottles.filter(o => o.set === bottle.set);
  if (set.every(o => !o.up) && !mini.pitchRestock[bottle.set]) {
    mini.pitchRestock[bottle.set] = 7;
    mini.pitchBalls = Math.min(mini.pitchCap, mini.pitchBalls + 2);
    mini.score += 250;
    sfx('powerup');
    pitchPopAt(bottle.x, bottle.y + 60, bottle.z, 'CARNIVAL RULES · +2 BALLS', '#fff1b8');
  }
}

function pitchUpdateBottles(dt) {
  for (const f of mini.pitchFlyers) {
    f.t -= dt;
    f.vy -= PITCH_G * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.z += f.vz * dt;
    f.rot += f.spin * dt;
    if (f.y < 5) {
      f.y = 5;
      f.vy = Math.abs(f.vy) * 0.35;
      f.vx *= 0.6;
      f.vz *= 0.6;
      f.spin *= 0.5;
    }
    f.x = clamp(f.x, -PITCH_WALL + 6, PITCH_WALL - 6);
    f.z = clamp(f.z, 140, PITCH_BACK - 6);
  }
  mini.pitchFlyers = mini.pitchFlyers.filter(f => f.t > 0);
  for (const set of ['pyramid', 'shelf']) {
    if (!mini.pitchRestock[set]) continue;
    mini.pitchRestock[set] -= dt;
    if (mini.pitchRestock[set] <= 0) {
      mini.pitchRestock[set] = 0;
      pitchStock(set);
      sfx('pickup', { vol: 0.5 });
      if (set === 'pyramid') pitchPopAt(-111, 160, 231, 'BARB FROM DIETARY RESTOCKED', '#d8ecf2');
    }
  }
}

// ---- Ball physics ----
// Moves a ball one substep: gravity, the floor, the walls, the furniture. Returns the contact that
// mattered ('floor', 'wall', 'back', or a box id), or null. Shared by live balls and the preview.
function pitchMoveBall(b, h) {
  const r = PITCH_BALL;
  let hit = null;
  b.vy -= PITCH_G * h;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
  b.age += h;
  if (b.y < r) {
    b.y = r;
    if (b.vy < 0) {
      if (b.vy < -80) hit = 'floor';
      b.vy = -b.vy * 0.5;
      b.vx *= 0.84;
      b.vz *= 0.84;
    }
  }
  if (b.x < -PITCH_WALL + r) {
    b.x = -PITCH_WALL + r;
    if (b.vx < 0) {
      b.vx = -b.vx * 0.7;
      b.walls++;
      hit = 'wall';
    }
  }
  if (b.x > PITCH_WALL - r) {
    b.x = PITCH_WALL - r;
    if (b.vx > 0) {
      b.vx = -b.vx * 0.7;
      b.walls++;
      hit = 'wall';
    }
  }
  if (b.z > PITCH_BACK - r) {
    b.z = PITCH_BACK - r;
    if (b.vz > 0) {
      b.vz = -b.vz * 0.62;
      b.walls++;
      hit = 'back';
    }
  }
  for (const box of PITCH_BOXES) {
    const c = pitchBoxContact(b, box);
    if (c && c > 80) hit = box.id;
  }
  // Resting: low bounce on a floor or a tabletop rolls to a stop.
  const support = b.y <= r + 0.01 || b.onTop;
  if (support && Math.abs(b.vy) < 55) {
    b.vy = 0;
    const sp = Math.hypot(b.vx, b.vz),
      left = Math.max(0, sp - 320 * h);
    if (sp > 0) {
      b.vx *= left / sp;
      b.vz *= left / sp;
    }
    if (left < 18) b.rest += h;
  }
  b.onTop = false;
  if (b.z < -120 || b.age > 6 || b.rest > 0.35) b.dead = true;
  return hit;
}

// Pushes a ball out of a box and bounces it. Returns the speed it hit with (0 for a graze), or 0
// when there is no contact.
function pitchBoxContact(b, box) {
  const r = PITCH_BALL,
    cx = clamp(b.x, box.x0, box.x1),
    cy = clamp(b.y, box.y0, box.y1),
    cz = clamp(b.z, box.z0, box.z1);
  let nx = b.x - cx,
    ny = b.y - cy,
    nz = b.z - cz;
  const d2 = nx * nx + ny * ny + nz * nz;
  if (d2 >= r * r) return 0;
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    // The center got inside: leave by the shallowest face.
    const faces = [
      [b.x - box.x0, -1, 0, 0],
      [box.x1 - b.x, 1, 0, 0],
      [b.y - box.y0, 0, -1, 0],
      [box.y1 - b.y, 0, 1, 0],
      [b.z - box.z0, 0, 0, -1],
      [box.z1 - b.z, 0, 0, 1]
    ].sort((a, c) => a[0] - c[0]);
    const [pen, ax, ay, az] = faces[0];
    nx = ax;
    ny = ay;
    nz = az;
    b.x += ax * (pen + r);
    b.y += ay * (pen + r);
    b.z += az * (pen + r);
  } else {
    nx /= d;
    ny /= d;
    nz /= d;
    b.x = cx + nx * r;
    b.y = cy + ny * r;
    b.z = cz + nz * r;
  }
  if (ny > 0.7) b.onTop = true;
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn >= 0) return 0.001;
  const e = box.e === undefined ? 0.4 : box.e,
    k = (1 + e) * vn;
  b.vx -= k * nx;
  b.vy -= k * ny;
  b.vz -= k * nz;
  // A little grip on the surface.
  const tx = b.vx - (b.vx * nx + b.vy * ny + b.vz * nz) * nx,
    tz = b.vz - (b.vx * nx + b.vy * ny + b.vz * nz) * nz;
  b.vx -= tx * 0.1;
  b.vz -= tz * 0.1;
  return -vn;
}

// Where a throw goes, ignoring gremlins and bottles: points every 1/40 s and the first contacts.
function pitchSimulate(v, contacts = 2, maxT = 2.4) {
  const b = pitchNewBall(v),
    pts = [[b.x, b.y, b.z]],
    hits = [];
  for (let step = 1; b.age < maxT && !b.dead; step++) {
    const c = pitchMoveBall(b, PITCH_SUB);
    if (step % 6 === 0) pts.push([b.x, b.y, b.z]);
    if (c) {
      pts.push([b.x, b.y, b.z]);
      hits.push({ x: b.x, y: b.y, z: b.z, what: c, t: b.age });
      if (hits.length >= contacts) break;
    }
  }
  return { pts, hits, ball: b };
}

function pitchUpdateBalls(dt) {
  const steps = Math.max(1, Math.round(dt / PITCH_SUB)),
    h = dt / steps;
  for (const b of mini.pitchLive) {
    for (let i = 0; i < steps && !b.dead; i++) {
      const c = pitchMoveBall(b, h);
      if (c) pitchContactFx(b, c);
      pitchBallHits(b);
      if (mini.screen !== 'play') return;
    }
    b.trail.push([b.x, b.y, b.z]);
    if (b.trail.length > 9) b.trail.shift();
    // Half a second after a miss lands (and has not rolled into anything), say what went wrong.
    if (b.note && b.first && !b.got && !b.bottles && b.age - b.first.age > 0.5) {
      pitchShowNote(b);
      b.note = null;
    }
    if (b.dead) pitchBallDone(b);
  }
  mini.pitchLive = mini.pitchLive.filter(b => !b.dead);
}

// Every landing leaves a scuff where it hit, so a miss shows where it went: a ring on the floor or a
// tabletop, a puff on a wall or the furniture. The first is bigger, and it judges a miss.
function pitchContactFx(b, c) {
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  if (c === 'etype') {
    mini.pitchEtype = 1;
    mini.pitchEtypeHits++;
    mini.combo = 0;
    mini.flash = 1.2;
    mini.flashText = 'THE E-TYPE IS FINE. EVERYONE RELAX.';
    sfx('ricochet');
    return;
  }
  if (sp > 120) sfx('bounce', { vol: clamp(sp / 900, 0.2, 0.8), pan: clamp(b.x / PITCH_WALL, -1, 1) * 0.6 });
  const first = !b.first,
    gy = pitchGroundAt(b.x, b.z, b.y + 1),
    flat = c !== 'wall' && c !== 'back' && b.y - PITCH_BALL - gy < 4;
  if (first) {
    b.first = { x: b.x, y: b.y, z: b.z, what: c, age: b.age };
    if (!b.got && !b.bottles) b.note = pitchMissNote(b, c);
  }
  if (mini.pitchSplats.length >= 10) mini.pitchSplats.shift();
  mini.pitchSplats.push({ x: b.x, y: flat ? gy : b.y, z: b.z, flat, t: first ? 1.8 : 1, big: first });
}

// What a ball that has hit nothing did wrong, judged at its first landing against the gremlin it was
// most likely thrown at (the one nearest its line): wide, short, long, or stopped by the furniture.
function pitchMissNote(b, c) {
  const H = PITCH_HAND;
  let best = null,
    bestA = 0.4;
  for (const e of mini.pitchTargets) {
    if (e.state !== 'live' || !pitchHittable(e)) continue;
    const a = Math.atan2(e.x - H.x, e.z - H.z) - b.yaw;
    if (Math.abs(a) < bestA) {
      bestA = Math.abs(a);
      best = { e, a };
    }
  }
  if (!best) return null;
  const e = best.e,
    far = Math.hypot(e.x - H.x, e.z - H.z),
    landed = Math.hypot(b.x - H.x, b.z - H.z),
    side = Math.sin(best.a) * far,
    R = pitchRadius(e);
  if (c === 'wall') return b.x < 0 ? 'WIDE LEFT' : 'WIDE RIGHT';
  if (e.kind === 'peek' && e.mode === 'hidden' && c !== 'floor' && c !== 'back') return 'BLOCKED · SWIPE LONGER TO LOB IT';
  if (Math.abs(side) > R + 6) return side > 0 ? 'WIDE LEFT' : 'WIDE RIGHT';
  // A short one usually rolls in; one that came down on it or past it and missed went over the top.
  return landed < far - R && c !== 'back' ? 'SHORT · FLICK HARDER' : 'LONG · FLICK SOFTER';
}

// The coaching note for a miss: level 1 always, level 2 for its first few misses.
function pitchShowNote(b) {
  if (!(mini.tier === 0 || (mini.tier === 1 && mini.pitchMisses < 6))) return;
  const p = pitchProject(b.first.x, b.first.y, b.first.z);
  mini.pitchNote = { text: b.note, x: p.x, y: p.y - 28, t: 1.8, tall: !!mini.portrait, ball: b.id };
}

// Gremlins, the Ump and the bottles, checked every substep for a live ball.
function pitchBallHits(b) {
  const r = PITCH_BALL;
  for (const e of mini.pitchTargets) {
    if (!pitchHittable(e) || b.hitIds.includes(e.id)) continue;
    const c = pitchCenter(e),
      R = pitchRadius(e) + r,
      dx = b.x - c.x,
      dy = b.y - c.y,
      dz = b.z - c.z,
      d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > R * R) continue;
    pitchStrike(b, e, c, Math.sqrt(d2), R);
    if (b.dead) return;
  }
  for (const o of mini.pitchBottles) {
    if (!o.up) continue;
    const box = pitchBottleBox(o),
      cx = clamp(b.x, box.x0, box.x1),
      cy = clamp(b.y, box.y0, box.y1),
      cz = clamp(b.z, box.z0, box.z1);
    if ((b.x - cx) ** 2 + (b.y - cy) ** 2 + (b.z - cz) ** 2 > r * r) continue;
    pitchKnock(o, b.vx * 0.7 + rand(-50, 50), Math.abs(b.vy) * 0.3 + 140, b.vz * 0.7, b);
    b.vx *= 0.7;
    b.vy *= 0.7;
    b.vz *= 0.7;
  }
}

// Bounces the ball off a sphere (a gremlin or a shield) with bounciness e.
function pitchDeflect(b, c, e) {
  let nx = b.x - c.x,
    ny = b.y - c.y,
    nz = b.z - c.z;
  const n = Math.hypot(nx, ny, nz) || 1;
  nx /= n;
  ny /= n;
  nz /= n;
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
    b.vz -= (1 + e) * vn * nz;
  }
}

// A ball meets a gremlin. Shields clang unless the ball came off a wall; the Ump takes four.
function pitchStrike(b, e, c, dist, R) {
  // How close to dead center the ball's path ran: 1 is a bullseye.
  const sp = Math.hypot(b.vx, b.vy, b.vz) || 1,
    wx = c.x - b.x,
    wy = c.y - b.y,
    wz = c.z - b.z,
    along = (wx * b.vx + wy * b.vy + wz * b.vz) / sp,
    perp = Math.sqrt(Math.max(0, wx * wx + wy * wy + wz * wz - along * along)),
    precision = clamp(1 - perp / R, 0, 1),
    p = pitchProject(c.x, c.y, c.z);
  if (e.kind === 'shield' && !b.walls) {
    pitchDeflect(b, c, 0.55);
    e.hit = 0.15;
    sfx('ricochet');
    arcadeBurst(p.x, p.y, '#e6eff2', 6);
    pitchPopAt(c.x, c.y + 40, c.z, 'CLANG · BANK IT OFF A WALL', '#ffd7a0');
    return;
  }
  b.hitIds.push(e.id);
  b.note = null;
  if (mini.pitchNote && mini.pitchNote.ball === b.id) mini.pitchNote = null;
  if (e.kind === 'ump') {
    e.hp--;
    e.hit = 0.25;
    mini.pitchUmpHits++;
    b.got++;
    mini.got++;
    mini.pitchBalls = Math.min(mini.pitchCap, mini.pitchBalls + 1);
    pitchDeflect(b, c, 0.3);
    mini.pitchShake = 0.25;
    arcadeBurst(p.x, p.y, '#b8e07a', 18);
    if (e.hp <= 0) {
      e.state = 'dying';
      e.dyT = 1;
      mini.pitchUmpDown = true;
      mini.got += 3;
      praise(900, precision);
      sfx('bossDie');
      mini.flash = 2;
      mini.flashText = 'THE UMP HAS BEEN EJECTED · +3';
      pitchPopAt(c.x, c.y + 70, c.z, 'EJECTED', '#fff1b8');
    } else {
      praise(PITCH_KINDS.ump.points, precision);
      sfx('bossHit');
      pitchPopAt(c.x, c.y + 60, c.z, ['OW. BALK.', 'THAT IS A STRIKE ON ME', 'APPEAL DENIED'][e.hp % 3], '#ffe9b8');
      if (e.mode !== 'sink' && e.mode !== 'hidden') pitchPeekMode(e, 'sink');
    }
    return;
  }
  // An eviction.
  e.state = 'dying';
  e.dyT = 0.45;
  b.got++;
  const worth = e.kind === 'timed' ? 2 : 1,
    banked = b.walls > 0,
    air = e.kind === 'hop' && e.mode === 'air',
    lob = e.kind === 'peek' && e.mode === 'hidden',
    close = e.kind === 'charge' && e.z < 260,
    two = b.got >= 2;
  mini.got += worth;
  mini.pitchKinds[e.kind] = (mini.pitchKinds[e.kind] || 0) + 1;
  mini.pitchBalls = Math.min(mini.pitchCap, mini.pitchBalls + 1);
  if (banked) mini.pitchBanks++;
  if (air) mini.pitchAirs++;
  if (lob) mini.pitchLobs++;
  if (two) mini.pitchDoubles++;
  if (close) mini.pitchSaves++;
  const points =
    PITCH_KINDS[e.kind].points +
    Math.max(0, Math.round((e.z - 220) / 4)) +
    (banked ? 80 : 0) +
    (air ? 100 : 0) +
    (lob ? 120 : 0) +
    (two ? 200 : 0) +
    (close ? 60 : 0);
  praise(points, precision);
  pitchDeflect(b, c, 0.25);
  b.vx *= 0.6;
  b.vz *= 0.6;
  mini.pitchShake = Math.max(mini.pitchShake, 0.14);
  sfx(banked || air || two || lob ? 'headshot' : 'hit');
  sfx('squelch', { vol: 0.7 });
  if (mini.combo >= 3) sfx('combo', { combo: mini.combo });
  arcadeBurst(p.x, p.y, '#9be15d', 16);
  arcadeBurst(p.x, p.y, '#e3f7b0', 6);
  mini.pitchDecals.push({ x: e.x, y: pitchGroundAt(e.x, e.z, e.y + 1), z: e.z, r: 16 + rand(0, 10), t: 4, seed: rand(0, 6) });
  if (mini.pitchDecals.length > 18) mini.pitchDecals.shift();
  const label = two
    ? 'TWO FOR ONE'
    : banked
      ? e.kind === 'shield'
        ? 'BANK SHOT · SHIELD DOWN'
        : 'OFF THE WALL'
      : lob
        ? 'OVER THE TOP'
        : air
          ? 'MID-AIR'
        : close
          ? 'SAVED THE BED'
          : e.kind === 'timed'
            ? 'GOLDEN · +2'
            : mini.combo >= 5
              ? 'HEATER ×' + mini.combo
              : '+' + points;
  pitchPopAt(c.x, c.y + 44, c.z, label, banked || air || two || lob ? '#fff1b8' : '#e9ffd2');
}

// A ball is done (it stopped, or flew back past the bed). One that touched nothing breaks the streak.
function pitchBallDone(b) {
  if (b.got || b.bottles) {
    mini.pitchHits++;
    return;
  }
  mini.combo = 0;
  // A miss that stopped dead before its note came up still gets one.
  if (b.note && b.first) pitchShowNote(b);
  mini.pitchMisses++;
}

// The surface height under a point: the floor or the top of whatever furniture is there.
function pitchGroundAt(x, z, below = 999) {
  let gy = 0;
  for (const b of PITCH_BOXES)
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= below && b.y1 > gy) gy = b.y1;
  return gy;
}

// ---- Effects ----
function pitchPopAt(x, y, z, text, col) {
  if (mini.pitchPops.some(p => p.text === text && p.t > 0.6)) return;
  mini.pitchPops.push({ x, y, z, text, col, t: 1 });
}

function pitchUpdateFx(dt) {
  for (const p of mini.pitchPops) p.t -= dt;
  mini.pitchPops = mini.pitchPops.filter(p => p.t > 0);
  for (const r of mini.pitchRipples) r.t += dt;
  mini.pitchRipples = mini.pitchRipples.filter(r => r.t < 0.4);
  for (const d of mini.pitchDecals) d.t -= dt;
  mini.pitchDecals = mini.pitchDecals.filter(d => d.t > 0);
  for (const s of mini.pitchSplats) s.t -= dt;
  mini.pitchSplats = mini.pitchSplats.filter(s => s.t > 0);
  if (mini.pitchNote) {
    mini.pitchNote.t -= dt;
    if (mini.pitchNote.t <= 0) mini.pitchNote = null;
  }
  if (mini.pitchBedFx) {
    mini.pitchBedFx.t += dt;
    if (mini.pitchBedFx.t > 1.2) mini.pitchBedFx = null;
  }
}

// ---- The run, per frame ----
function pitchUpdate(dt) {
  const T = pitchTune();
  // Turning the phone mid-flick drops the flick: its points belong to the other canvas.
  if (mini.pitchWasTall !== !!mini.portrait) {
    mini.pitchWasTall = !!mini.portrait;
    mini.pitchPress = null;
  }
  // Keyboard aim: left and right swing it, up and down set how far, W and S how high.
  const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0),
    ky = (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0),
    kl = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  if (kx || ky || kl) {
    const K = mini.pitchKeys;
    mini.pitchKeyAim = true;
    mini.pitchKeyShow = 0.9;
    mini.pitchKeys = {
      yaw: clamp(K.yaw + kx * 0.8 * dt, -1.3, 1.3),
      dist: clamp(K.dist + ky * 240 * dt, PITCH_DIST[0], PITCH_DIST[1]),
      loft: clamp(K.loft + kl * 0.9 * dt, 0, 1)
    };
  }
  for (const k of ['pitchCd', 'pitchEmptyT', 'pitchFreeze', 'pitchShake', 'pitchHitFlash', 'pitchEtype', 'pitchKeyShow'])
    mini[k] = Math.max(0, mini[k] - dt);
  mini.pitchArm = Math.max(0, mini.pitchArm - dt * 4);
  if (mini.pitchBalls < mini.pitchCap) {
    // An empty bucket never stalls the game: the next ball is on its way at once.
    if (mini.pitchBalls <= 0) mini.pitchRefillT = Math.min(mini.pitchRefillT, T.empty);
    mini.pitchRefillT -= dt;
    if (mini.pitchRefillT <= 0) {
      mini.pitchBalls++;
      mini.pitchRefillT = T.refill;
      sfx('pickup', { vol: 0.25 });
    }
  } else mini.pitchRefillT = T.refill;
  pitchWarmBanks();
  // The world moves in short steps so a long frame never tunnels a ball through a gremlin.
  for (let left = dt; left > 1e-9 && mini.screen === 'play'; ) {
    const h = Math.min(left, 1 / 60);
    left -= h;
    pitchUpdateSpawns(h);
    pitchUpdateTargets(h);
    pitchUpdateIncoming(h);
    if (mini.screen !== 'play') break;
    pitchUpdateBalls(h);
    pitchUpdateBottles(h);
    pitchUpdateFx(h);
  }
}

// Level 2 coaches its first bank shot, so it plans one for every shield spot in the background from
// the first pitch, a couple of flights a frame, long before the shields come out.
function pitchWarmBanks() {
  if (mini.tier !== 1 || mini.pitchBanks) return;
  for (const s of PITCH_SITS) {
    if (s.high || s.wall) continue;
    if (pitchBankPlan({ x: s.x, y: s.y, z: s.z, size: 1, kind: 'shield' }, 2) === undefined) return;
  }
}

// The throw the faint arc previews: a flick while the finger is moving (what letting go now would
// throw), or the keyboard's aim while it is being set. Nothing while the finger rests.
function pitchPreviewAim() {
  const q = mini.pitchPress;
  if (q && q.tall === !!mini.portrait) {
    const f = pitchFlickAim(q, mini.total);
    return f.ok ? f : null;
  }
  if (mini.pitchKeyAim && (mini.pitchKeyShow > 0 || mini.screen !== 'play')) return mini.pitchKeys;
  return null;
}

// ---- Drawing ----
function pitchP(x, y, z) {
  const p = pitchProject(x, y, z);
  return [p.x, p.y];
}

function pitchQuad(g, pts, fill, edge = null, lw = 1.2) {
  path(
    g,
    p => {
      pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      p.closePath();
    },
    fill,
    edge,
    lw
  );
}

// Draws a box's visible faces: the side that faces the camera, the top, then the front.
function pitchBoxArt(g, b, top, front, side, edge = '#2f4f5a40') {
  const C = pitchCam(),
    P = pitchP;
  if (C.x < b.x0)
    pitchQuad(g, [P(b.x0, b.y0, b.z0), P(b.x0, b.y0, b.z1), P(b.x0, b.y1, b.z1), P(b.x0, b.y1, b.z0)], side, edge);
  if (C.x > b.x1)
    pitchQuad(g, [P(b.x1, b.y0, b.z0), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x1, b.y1, b.z0)], side, edge);
  if (C.y > b.y1)
    pitchQuad(g, [P(b.x0, b.y1, b.z0), P(b.x1, b.y1, b.z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)], top, edge);
  pitchQuad(g, [P(b.x0, b.y0, b.z0), P(b.x1, b.y0, b.z0), P(b.x1, b.y1, b.z0), P(b.x0, b.y1, b.z0)], front, edge);
}

// The front face of a box as a screen rectangle, for details painted flat on it.
function pitchFront(b) {
  const tl = pitchProject(b.x0, b.y1, b.z0),
    tr = pitchProject(b.x1, b.y1, b.z0),
    bl = pitchProject(b.x0, b.y0, b.z0),
    br = pitchProject(b.x1, b.y0, b.z0),
    x = (tl.x + bl.x) / 2,
    y = (tl.y + tr.y) / 2;
  return { x, y, w: (tr.x + br.x) / 2 - x, h: (bl.y + br.y) / 2 - y, k: (tl.k + br.k) / 2 };
}

// A local frame on a wall: draw in cm, u along the wall and v downward.
function pitchWallFrame(g, origin, uEnd, vEnd, uLen, vLen) {
  const o = pitchProject(...origin),
    u = pitchProject(...uEnd),
    v = pitchProject(...vEnd);
  g.transform((u.x - o.x) / uLen, (u.y - o.y) / uLen, (v.x - o.x) / vLen, (v.y - o.y) / vLen, o.x, o.y);
}

function pitchBox(id) {
  return PITCH_BOXES.find(b => b.id === id);
}

// ---- The room shell (walls, floor, window), cached per canvas shape and time of day ----
const pitchShellCache = { key: '', cv: null };

function pitchShell(g, w, h) {
  const part = roomDaypart() === 'morning' ? 'morning' : 'afternoon',
    key = w + 'x' + h + ':' + part + ':' + viewport.dpr;
  if (pitchShellCache.key !== key) {
    if (!pitchShellCache.cv) pitchShellCache.cv = document.createElement('canvas');
    const cg = configureCanvas(pitchShellCache.cv, w, h);
    pitchPaintShell(cg, w, h, part);
    pitchShellCache.key = key;
  }
  g.drawImage(pitchShellCache.cv, 0, 0, w, h);
}

function pitchPaintShell(g, w, h, part) {
  const P = pitchP,
    X = PITCH_WALL,
    B = PITCH_BACK,
    H = PITCH_WALL_H,
    near = -60;
  rect(g, 0, 0, w, h, gradient(g, 0, 0, w, h, '#2a5d68', '#142e46'));
  glow(g, w / 2, h * 0.35, Math.max(w, h) * 0.5, '#6ad6aa22');
  // Floor, tiles, and the light through the window.
  const fl = P(0, 0, B),
    fn = P(0, 0, 120),
    top = P(0, H, B);
  pitchQuad(g, [P(-X, 0, near), P(X, 0, near), P(X, 0, B), P(-X, 0, B)], gradient(g, 0, fl[1], 0, fn[1] - fl[1], '#b9d2c2', '#93bcae'));
  for (let z = 100; z < B; z += 52) line(g, [P(-X, 0, z), P(X, 0, z)], '#3f6f6c1c', 1);
  for (let x = -X + 55; x < X; x += 55) line(g, [P(x, 0, near), P(x, 0, B)], '#3f6f6c1c', 1);
  pitchQuad(g, [P(-168, 0, B - 2), P(-12, 0, B - 2), P(60, 0, 300), P(-120, 0, 300)], part === 'morning' ? '#fff1c624' : '#fff5be22');
  // Back wall, the side walls, the baseboards, then their cut tops (the dollhouse view).
  pitchQuad(g, [P(-X, 0, B), P(X, 0, B), P(X, H, B), P(-X, H, B)], gradient(g, 0, top[1], 0, fl[1] - top[1], '#d9eadb', '#bcd6c6'));
  pitchQuad(g, [P(-X, 0, near), P(-X, 0, B), P(-X, H, B), P(-X, H, near)], '#b4cfbf');
  pitchQuad(g, [P(X, 0, near), P(X, 0, B), P(X, H, B), P(X, H, near)], '#a8c8ba');
  for (const side of [-1, 1]) pitchQuad(g, [P(side * X, 0, near), P(side * X, 0, B), P(side * X, 10, B), P(side * X, 10, near)], '#edf1d8');
  pitchQuad(g, [P(-X, 0, B), P(X, 0, B), P(X, 10, B), P(-X, 10, B)], '#edf1d8');
  const capK = pitchProject(0, H, B).k;
  line(g, [P(-X, H, near), P(-X, H, B), P(X, H, B), P(X, H, near)], '#eef3df', 9 * capK);
  line(g, [P(-X, H, near), P(-X, H, B), P(X, H, B), P(X, H, near)], '#7da59e', 1.5);
  // The window on Paramus, with the LEGO water lilies on the sill.
  const wk = pitchProject(-90, 145, B).k,
    wo = pitchProject(-170, 200, B);
  g.save();
  g.translate(wo.x, wo.y);
  g.scale(wk, wk);
  windowArt(g, 0, 0, 160, 110, { daypart: part });
  legoLily(g, 22, 110, 0.95);
  legoLily(g, 44, 110.5, 0.75, '#f7f4ee', '#ffd6e4');
  legoLily(g, 140, 110, 0.85, '#f08db5', '#ffd3e5', true);
  g.restore();
  // A clock between the window and the TV.
  const ck = pitchProject(16, 222, B);
  ellipse(g, ck.x, ck.y, 12 * ck.k, 12 * ck.k, '#5d7f88');
  ellipse(g, ck.x, ck.y, 10 * ck.k, 10 * ck.k, '#f6f3e4');
  line(g, [[ck.x, ck.y], [ck.x, ck.y - 7 * ck.k]], '#33474f', 1.6);
  line(g, [[ck.x, ck.y], [ck.x + 5 * ck.k, ck.y + 2 * ck.k]], '#33474f', 1.6);
  // The whiteboard on the left wall, above the sofa.
  g.save();
  pitchWallFrame(g, [-X, 200, 330], [-X, 200, 450], [-X, 130, 330], 120, 70);
  rr(g, 0, 0, 120, 70, 4, '#f4f6ee', '#7e9ea6', 2);
  label(g, 'NURSE: STEPHANIE', 8, 18, 11, '#3f6d8a');
  label(g, 'TODAY: SOFTBALL', 8, 38, 11, '#3f6d8a');
  label(g, 'GOAL: 3 LAPS', 8, 58, 11, '#c0504d');
  g.restore();
  // The door on the right wall, and the room sign beside it.
  g.save();
  pitchWallFrame(g, [X, 205, 380], [X, 205, 470], [X, 0, 380], 90, 205);
  rr(g, -4, -4, 98, 209, 4, '#d9e6d6');
  rr(g, 0, 0, 90, 205, 3, gradient(g, 0, 0, 90, 0, '#7fa6ae', '#5f8c96'));
  rr(g, 14, 22, 18, 60, 3, '#cfe6e8');
  ellipse(g, 76, 108, 5, 5, '#f8d38f');
  g.restore();
  g.save();
  pitchWallFrame(g, [X, 200, 290], [X, 200, 368], [X, 150, 290], 78, 50);
  rr(g, 0, 0, 78, 50, 6, '#e9eed3', '#6f9c94', 1.5);
  rr(g, 4, 4, 70, 18, 4, '#476c66');
  label(g, 'MACY · ROOM 5', 39, 17, 10, '#f3f6e4', 'center');
  label(g, 'VALLEY · 7 WEST', 39, 36, 8, '#476c66', 'center');
  label(g, 'PEDIATRICS', 39, 46, 7, '#6d8b7a', 'center');
  g.restore();
}

// The 75-inch TV on the back wall, live: the score of the game you are in.
function pitchDrawTv(g) {
  const b = pitchBox('tv'),
    o = pitchProject(b.x0, b.y1, b.z0),
    k = pitchProject((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z0).k,
    w = b.x1 - b.x0,
    h = b.y1 - b.y0;
  g.save();
  g.translate(o.x, o.y);
  g.scale(k, k);
  tvBezel(g, { x: 0, y: 0, w, h });
  rect(g, 5, 5, w - 10, h - 10, gradient(g, 0, 5, 0, h - 10, '#1e5a3a', '#153a2a'));
  line(g, [[w / 2, 5], [w / 2, h - 5]], '#ffffff22', 2);
  path(g, p => p.arc(w / 2, h - 5, 30, Math.PI, 0), null, '#ffffff22', 2);
  rr(g, 12, 12, w - 24, 24, 4, '#0b1220dd');
  label(g, 'FASTPITCH FEVER · INNING ' + ((mini.shift || 0) + 1), w / 2, 29, 11, '#ffe39a', 'center');
  label(g, (mini.got || 0) + ' / ' + (mini.goal || 0), w / 2, 66, 26, '#f4f1ea', 'center');
  label(g, 'EVICTED', w / 2, 80, 9, '#bfe7cf', 'center');
  if (mini.pitchUmpSpawned && !mini.pitchUmpDown) label(g, 'UMP: AT LARGE', w / 2, 46, 8, '#ff9aa8', 'center');
  g.restore();
}

// Goo on the floor and the furniture tops where gremlins got evicted.
function pitchDrawDecals(g) {
  for (const d of mini.pitchDecals || []) {
    const p = pitchProject(d.x, d.y + 0.5, d.z);
    g.globalAlpha = Math.min(1, d.t) * 0.85;
    ellipse(g, p.x, p.y, d.r * p.k, d.r * p.k * 0.38, '#7cc244');
    for (let i = 0; i < 5; i++) {
      const ang = d.seed + i * 1.3,
        out = d.r * (0.9 + (i % 2) * 0.5);
      ellipse(g, p.x + Math.cos(ang) * out * p.k, p.y + Math.sin(ang) * out * p.k * 0.38, 4 * p.k, 2 * p.k, '#8fd14f');
    }
  }
  g.globalAlpha = 1;
}

// ---- Furniture ----
function pitchArtCabinet(g) {
  const b = pitchBox('cabinet'),
    f = pitchFront(b);
  pitchBoxArt(g, b, '#f2d4ad', gradient(g, 0, f.y, 0, f.h, '#d9b08c', '#b98d78'), '#b88c75');
  for (const v of [0.12, 0.55]) {
    rr(g, f.x + f.w * 0.1, f.y + f.h * v, f.w * 0.8, f.h * 0.36, 4 * f.k, '#e3bd98', '#a9806d66', 1);
    line(g, [[f.x + f.w * 0.42, f.y + f.h * (v + 0.12)], [f.x + f.w * 0.58, f.y + f.h * (v + 0.12)]], '#567a7c', 3 * f.k);
  }
}

function pitchArtEtype(g) {
  const p = pitchProject(186, 96, 327),
    s = (p.k * 48) / 76,
    wob = mini.pitchEtype > 0 ? Math.sin(mini.total * 40) * 0.18 * mini.pitchEtype : 0;
  g.save();
  g.translate(p.x, p.y);
  g.rotate(wob);
  etype(g, 0, 0, s);
  g.restore();
}

function pitchArtSofa(g) {
  const seat = pitchBox('sofa'),
    back = pitchBox('sofaBack');
  pitchBoxArt(g, back, '#d3a9b7', '#a77d8d', '#b58897');
  pitchBoxArt(g, seat, '#cfa2b1', '#a07484', '#b0889a');
  // Cushions, and the pillows Grandma brought.
  for (const [z0, z1] of [
    [312, 388],
    [392, 466]
  ])
    pitchQuad(g, [pitchP(-196, 45, z0), pitchP(-154, 45, z0), pitchP(-154, 45, z1), pitchP(-196, 45, z1)], '#d9b0be', '#9b72824d');
  for (const [z, c] of [
    [330, '#f5d2ae'],
    [450, '#b7d7ad']
  ]) {
    const p = pitchProject(-204, 62, z);
    rr(g, p.x - 12 * p.k, p.y - 14 * p.k, 24 * p.k, 26 * p.k, 6 * p.k, c, '#fff1cf55', 1);
  }
}

function pitchArtSofaArm(g) {
  pitchBoxArt(g, pitchBox('sofaArm'), '#d6abb9', '#a87b8c', '#b68b9b');
}

// The visitor armchair faces the TV, so we see its back: a seat, two arms, a tufted back.
function pitchArtChairSeat(g) {
  const s = pitchBox('chairSeat');
  pitchBoxArt(g, s, '#86c3bb', '#4f8a85', '#5f9a94');
  for (const x0 of [s.x0, s.x1 - 11])
    pitchBoxArt(g, { x0, x1: x0 + 11, y0: 0, y1: 64, z0: s.z0 - 12, z1: s.z1 }, '#9ad2ca', '#5a958f', '#4f8a85');
}

function pitchArtChairBack(g) {
  const b = pitchBox('chairBack'),
    f = pitchFront(b);
  pitchBoxArt(g, b, '#8fcac2', gradient(g, 0, f.y, 0, f.h, '#6aaaa3', '#467f7a'), '#5a948e');
  rr(g, f.x - 2 * f.k, f.y - 6 * f.k, f.w + 4 * f.k, 14 * f.k, 7 * f.k, '#7cbcb5', '#467f7a55', 1);
  for (const u of [0.25, 0.5, 0.75]) ellipse(g, f.x + f.w * u, f.y + f.h * 0.35, 2 * f.k, 2 * f.k, '#3e716c');
  for (const x of [f.x + 6 * f.k, f.x + f.w - 6 * f.k]) line(g, [[x, f.y + f.h], [x, f.y + f.h + 5 * f.k]], '#5a666c', 3 * f.k);
}

function pitchArtTray(g) {
  const b = pitchBox('tray'),
    mid = pitchProject((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2),
    foot = pitchProject((b.x0 + b.x1) / 2 + 30, 0, (b.z0 + b.z1) / 2);
  // The overbed table's base: one bar on the floor and two wheels, then its pole.
  const b0 = pitchProject(b.x0 + 10, 0, (b.z0 + b.z1) / 2),
    b1 = pitchProject(b.x1 + 36, 0, (b.z0 + b.z1) / 2);
  line(g, [[b0.x, b0.y], [b1.x, b1.y]], '#7f9196', 5 * b0.k);
  for (const w of [b0, b1]) ellipse(g, w.x, w.y + 2 * w.k, 4 * w.k, 3 * w.k, '#3c4f59');
  line(g, [[mid.x, mid.y], [foot.x, foot.y]], '#8f9fa3', 4 * mid.k);
  pitchBoxArt(g, b, '#efd6a8', '#d1a77f', '#c49a74');
}

function pitchArtBin(g) {
  const b = PITCH_BIN,
    f = pitchFront(b);
  pitchBoxArt(g, b, '#5a1f28', gradient(g, 0, f.y, 0, f.h, '#c44d5a', '#8a2b38'), '#a43a47');
  label(g, 'MOSTLY', f.x + f.w / 2, f.y + f.h * 0.45, 7 * f.k, '#f6d36a', 'center');
  label(g, 'SNACKS', f.x + f.w / 2, f.y + f.h * 0.7, 7 * f.k, '#f6d36a', 'center');
}

// Macy's bed: the blanket runs from the pillows to the footboard.
function pitchArtBed(g) {
  const b = pitchBox('bed');
  pitchBoxArt(g, b, gradient(g, 0, pitchP(0, 62, 122)[1], 0, 200, '#a5e1c7', '#61afa9'), '#5aa3a0', '#4e9693');
  for (const z of [10, 60, 104]) {
    const a = pitchP(b.x0 + 6, 63, z),
      c = pitchP(b.x1 - 6, 63, z + 8);
    path(
      g,
      p => {
        p.moveTo(a[0], a[1]);
        p.quadraticCurveTo((a[0] + c[0]) / 2, a[1] - 6, c[0], c[1]);
      },
      null,
      '#d1edd755',
      2
    );
  }
}

// The footboard, with the pitch count on the chart. The nurses keep track.
function pitchArtFootboard(g) {
  const b = pitchBox('footboard'),
    f = pitchFront(b);
  pitchBoxArt(g, b, '#eef3e2', gradient(g, 0, f.y, 0, f.h, '#dfecdf', '#9fbcb8'), '#b6cfc8');
  const p = pitchProject(64, 80, b.z0 - 1),
    k = p.k;
  rr(g, p.x - 15 * k, p.y - 2 * k, 30 * k, 26 * k, 3 * k, '#d8c79c', '#8a7552', 1);
  rect(g, p.x - 5 * k, p.y - 4 * k, 10 * k, 4 * k, '#9aa7ad');
  label(g, 'PITCHES', p.x, p.y + 8 * k, 5 * k, '#5a4a32', 'center');
  label(g, String(mini.pitchThrows || 0), p.x, p.y + 19 * k, 10 * k, '#a3473f', 'center');
}

// ---- Gremlins ----
function pitchArtTarget(g, e) {
  if (e.kind === 'ump' && e.mode === 'hidden') return;
  const p = pitchProject(e.x, e.y, e.z),
    s = ((p.k * PITCH_GREM) / 47) * (e.size || 1),
    t = mini.total * 2 + e.id;
  let a = e.kind === 'ump' ? clamp((e.show || 0) * 1.4, 0, 1) : 1,
    sc = 1,
    rot = 0;
  if (e.inT > 0) sc = 1 - (e.inT / 0.3) * 0.75;
  if (e.state === 'dying') {
    const d = 1 - clamp(e.dyT / (e.kind === 'ump' ? 1 : e.left ? 0.35 : 0.45), 0, 1);
    if (e.left) {
      a *= 1 - d;
      sc *= 1 + d * 0.3;
    } else {
      rot = d * 2.6 * (e.id % 2 ? 1 : -1);
      sc *= 1 - d * 0.55;
      a *= 1 - d;
    }
  }
  if (e.hit > 0 && Math.sin(mini.total * 60) > 0) a *= 0.55;
  // A hopper in the air leaves its shadow on the ground.
  if (e.kind === 'hop' && e.mode === 'air') {
    const gp = pitchProject(e.x, pitchGroundAt(e.x, e.z, e.y), e.z);
    shadow(g, gp.x, gp.y, 20 * gp.k, 6 * gp.k);
  }
  if (e.kind === 'charge' && e.state === 'live') pitchChargeMarks(g, e, p);
  if (e.kind === 'walk' && e.state === 'live' && (mini.tier === 0 || !mini.pitchHits)) pitchLeadMarks(g, e);
  g.save();
  g.globalAlpha = a;
  g.translate(p.x, p.y);
  g.rotate(rot);
  g.scale(sc, sc);
  if (e.kind === 'hop' && e.mode === 'crouch') g.scale(1.08, 0.86);
  gremlin(g, 0, 0, s, e.art, t);
  if (e.kind === 'shield') pitchShieldArt(g, s, e.hit > 0);
  if (e.kind === 'timed') pitchTimedArt(g, e, s);
  if (e.kind === 'ump') pitchUmpGear(g, s);
  g.restore();
  g.globalAlpha = 1;
  if (e.kind === 'ump' && e.state === 'live') pitchUmpRing(g, e, p, s);
  if (e.kind === 'sit' && e.life && e.life < 1.5 && e.state === 'live') label(g, '...', p.x, p.y - 52 * s, 14, '#fff1b8', 'center');
}

// A white enamel bedpan with the navy rim, held up like a riot shield, handle and all.
function pitchShieldArt(g, s, flash) {
  g.save();
  g.scale(s, s);
  rr(g, 17, -19, 17, 7, 3.5, '#2c3e6b');
  path(g, p => p.ellipse(0, -14, 21, 17, 0, 0, Math.PI * 2), flash ? '#ffffff' : gradient(g, -21, -30, 42, 32, '#fbfdfd', '#c9d6dc'), '#2c3e6b', 3);
  path(g, p => p.ellipse(1, -12, 12, 8, 0, 0, Math.PI * 2), flash ? '#ffffff' : '#dfe7ea', '#9fb0b8', 1);
  ellipse(g, -9, -23, 5, 2.6, '#ffffffcc');
  g.restore();
}

// The golden gremlin's stopwatch: a ring that empties, and the ×2.
function pitchTimedArt(g, e, s) {
  const left = clamp(e.life / (e.lifeMax || 1), 0, 1);
  glow(g, 0, -24 * s, 40 * s, '#ffd76066');
  g.strokeStyle = left < 0.35 ? '#ff7a6b' : '#ffe39a';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, -60 * s, 9 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  g.stroke();
  label(g, '×2', 0, -56 * s, 9 * s, '#fff1b8', 'center');
}

// The Ump: a catcher's mask, a chest protector, and a cap on backwards.
function pitchUmpGear(g, s) {
  g.save();
  g.scale(s, s);
  rr(g, -12, -13, 24, 12, 4, '#24324acc', '#10182a', 1);
  line(g, [[-10, -7], [10, -7]], '#10182a', 1.2);
  rr(g, -17, -36, 34, 22, 8, null, '#1d2638', 2.6);
  line(g, [[-15, -28], [15, -28]], '#1d2638', 2);
  line(g, [[-15, -21], [15, -21]], '#1d2638', 2);
  line(g, [[0, -36], [0, -14]], '#1d2638', 2);
  path(
    g,
    p => {
      p.moveTo(-16, -38);
      p.quadraticCurveTo(0, -52, 16, -38);
      p.closePath();
    },
    '#1d2638'
  );
  rr(g, -22, -40, 12, 4, 2, '#1d2638');
  g.restore();
}

// The Ump's wind-up: a ring that closes while he is out. When it closes, he throws.
function pitchUmpRing(g, e, p, s) {
  for (let i = 0; i < e.hpMax; i++) ellipse(g, p.x - (e.hpMax - 1) * 6 + i * 12, p.y - 62 * s, 4, 4, i < e.hp ? '#ff9aa8' : '#40505a');
  if (e.mode !== 'up') return;
  const T = pitchUmpUp(),
    left = clamp(e.modeT / T, 0, 1);
  g.strokeStyle = left < 0.35 ? '#ff6b6b' : '#f3a35c';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(p.x, p.y - 26 * s, 26 * s + 26 * left, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  g.stroke();
  if (left < 0.5) label(g, 'WINDING UP', p.x, p.y - 72 * s, 12, '#ffd2b0', 'center');
}

// Chargers: red chevrons point at the bed, and a pulse once they are close.
function pitchChargeMarks(g, e, p) {
  const close = e.z < 280;
  for (let i = 0; i < 3; i++) {
    const q = pitchProject(e.x + (90 - e.x) * 0.06 * i, 0.5, e.z - 18 - i * 14),
      k = q.k;
    g.globalAlpha = (0.7 - i * 0.18) * (close ? 0.6 + 0.4 * Math.sin(mini.total * 12) : 0.7);
    poly(g, [[q.x - 8 * k, q.y - 3 * k], [q.x + 8 * k, q.y - 3 * k], [q.x, q.y + 4 * k]], '#ff6b6b');
  }
  g.globalAlpha = 1;
  if (close) {
    g.strokeStyle = '#ff6b6b';
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(p.x, p.y, 30 * p.k, 10 * p.k, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

// Walkers show where they are heading: three chevrons on the floor ahead of them.
function pitchLeadMarks(g, e) {
  if (e.wait > 0) return;
  const dx = (e.path.b[0] - e.path.a[0]) * e.dir,
    dz = (e.path.b[2] - e.path.a[2]) * e.dir,
    n = Math.hypot(dx, dz) || 1;
  for (let i = 1; i <= 3; i++) {
    const d = 22 + i * 18,
      q = pitchProject(e.x + (dx / n) * d, e.y + 0.5, e.z + (dz / n) * d),
      tip = pitchProject(e.x + (dx / n) * (d + 8), e.y + 0.5, e.z + (dz / n) * (d + 8)),
      ox = (tip.x - q.x) * 0.9,
      oy = (tip.y - q.y) * 0.9;
    g.globalAlpha = 0.75 - i * 0.18;
    poly(g, [[q.x - oy, q.y + ox], [q.x + oy, q.y - ox], [tip.x, tip.y]], '#fff1b8');
  }
  g.globalAlpha = 1;
}

// Peekers about to pop up give themselves away: eyes over the edge.
const PITCH_EYES = {
  footboard: [93, 76, 154],
  cabinet: [146, 32, 380],
  chair: [-96, 94, 432],
  bin: [168, 62, 492]
};

function pitchDrawEyes(g) {
  for (const e of mini.pitchTargets || []) {
    if ((e.kind !== 'peek' && e.kind !== 'ump') || e.mode !== 'hidden' || e.modeT > 0.45 || e.state !== 'live') continue;
    const p = pitchProject(...PITCH_EYES[e.cover.id]),
      k = p.k * (e.size || 1),
      col = e.kind === 'ump' ? '#ff9aa8' : '#eaff9e';
    for (const dx of [-5, 5]) {
      glow(g, p.x + dx * k, p.y, 8 * k, col + '55');
      ellipse(g, p.x + dx * k, p.y, 2.6 * k, 3.2 * k, col);
    }
  }
}

// ---- Bottles, balls ----
function pitchArtBottle(g, o) {
  const p = pitchProject(o.x, o.y, o.z);
  roomBottle(g, p.x, p.y, o.flavor, p.k, false);
}

function pitchArtFlyer(g, f) {
  const p = pitchProject(f.x, f.y, f.z);
  g.save();
  g.globalAlpha = Math.min(1, f.t * 2);
  g.translate(p.x, p.y);
  g.rotate(f.rot);
  roomBottle(g, 0, 10 * p.k, f.flavor, p.k, false);
  g.restore();
  g.globalAlpha = 1;
}

function pitchArtShadow(g, b) {
  const gy = pitchGroundAt(b.x, b.z, b.y),
    p = pitchProject(b.x, gy, b.z),
    up = clamp((b.y - gy) / 220, 0, 1);
  g.globalAlpha = 0.5 - up * 0.3;
  ellipse(g, p.x, p.y, PITCH_BALL * 1.6 * p.k * (1 + up * 0.6), PITCH_BALL * 0.6 * p.k * (1 + up * 0.6), '#14374d');
  g.globalAlpha = 1;
}

function pitchArtBall(g, b) {
  const p = pitchProject(b.x, b.y, b.z),
    r = Math.max(3, PITCH_BALL * 1.4 * p.k);
  b.trail.forEach((q, i) => {
    const t = pitchProject(...q),
      k = 0.4 + (0.5 * i) / b.trail.length;
    g.globalAlpha = ((i + 1) / b.trail.length) * 0.35;
    ellipse(g, t.x, t.y, r * k, r * k, b.heat ? '#ffb347' : '#fff1bf');
  });
  g.globalAlpha = 1;
  if (b.heat) glow(g, p.x, p.y, r * 3, '#ff9a3c88');
  softball(g, p.x, p.y, r);
}

// ---- Macy, from behind ----
function pitchHandScreen() {
  const base = pitchProject(PITCH_HAND.x, PITCH_HAND.y, PITCH_HAND.z),
    q = mini.pitchPress;
  let x = base.x,
    y = base.y;
  // A finger on the glass cocks her arm back; the keyboard swings it toward the aim.
  if (q && q.tall === !!mini.portrait) {
    x += 6 * base.k;
    y += 12 * base.k;
  } else if (mini.pitchKeyAim) {
    x -= Math.sin(mini.pitchKeys.yaw) * 16 * base.k;
    y += 8 * base.k;
  }
  if (mini.pitchArm > 0) y -= Math.sin(mini.pitchArm * Math.PI) * 26 * base.k;
  return { x, y, k: base.k };
}

function pitchArtMacy(g) {
  const look = macyLook(),
    hood = look.hoodie,
    neck = pitchProject(64, 112, 0),
    k = neck.k,
    sh = pitchProject(86, 110, 6),
    hand = pitchHandScreen(),
    swing = mini.pitchArm > 0 ? Math.sin(mini.pitchArm * Math.PI) : 0;
  // The left arm rests on the blanket.
  line(g, [[neck.x - 22 * k, neck.y + 6 * k], [neck.x - 30 * k, neck.y + 40 * k]], hood[3], 10 * k);
  g.save();
  g.translate(neck.x, neck.y);
  g.scale(k, k);
  rr(g, -26, -2, 52, 90, 18, gradient(g, -26, 0, 52, 0, hood[0], hood[2]));
  ellipse(g, 0, 0, 17, 7, hood[2]);
  macyNumber(g, 0, 32, 20, '#f6f1df', hood[2]);
  // Head from behind: ears, hair, and a ponytail that swings when she throws.
  ellipse(g, -11, -14, 2.6, 3.6, '#eaa987');
  ellipse(g, 11, -14, 2.6, 3.6, '#eaa987');
  ellipse(g, 0, -16, 12, 13, '#5e3d36');
  line(g, [[0, -28], [0, -4]], '#4a2f2a', 1);
  g.save();
  g.translate(0, -18);
  g.rotate(-0.25 - swing * 0.5 + Math.sin(mini.total * 2) * 0.04);
  path(
    g,
    p => {
      p.moveTo(-4, 0);
      p.bezierCurveTo(-10, 12, -6, 26, -12, 36);
      p.bezierCurveTo(-2, 30, 6, 16, 4, 0);
      p.closePath();
    },
    '#5a3a33',
    '#352a31',
    1
  );
  ellipse(g, 0, 1, 5, 3.6, look.scrunchie);
  g.restore();
  g.restore();
  // The throwing arm: shoulder, elbow, hand, and the next ball in it.
  const ex = (sh.x + hand.x) / 2 + 10 * k,
    ey = (sh.y + hand.y) / 2 + 8 * k;
  line(g, [[sh.x, sh.y], [ex, ey], [hand.x, hand.y + 4 * k]], hood[3], 9 * k);
  line(g, [[sh.x, sh.y], [ex, ey]], hood[1], 5 * k);
  ellipse(g, hand.x, hand.y + 3 * k, 4.6 * k, 4.6 * k, '#f0c3a0');
  if (mini.pitchBalls > 0 && mini.total - mini.pitchThrewAt > 0.12) softball(g, hand.x, hand.y - 2 * k, PITCH_BALL * 1.4 * k);
}

// ---- The faint arc: what letting go right now would throw ----
// Only while the finger moves, or while the keys set an aim. Level 1 shows the flight to its second
// bounce; later levels show less of it, down to a stub on Legendary.
function pitchDrawPreview(g) {
  const aim = pitchPreviewAim();
  if (!aim) return;
  const [contacts, maxT] = pitchTune().arc,
    sim = pitchSimulate(pitchLaunch(aim), contacts, maxT);
  sim.pts.forEach((q, i) => {
    if (i === 0) return;
    const p = pitchProject(...q),
      r = Math.max(1.4, 2.3 * p.k);
    g.globalAlpha = 0.5 * (1 - (i / sim.pts.length) * 0.6);
    ellipse(g, p.x, p.y, r, r, '#ffffff');
  });
  g.strokeStyle = '#fff1b8';
  g.lineWidth = 1.6;
  for (const hit of sim.hits) {
    const p = pitchProject(hit.x, hit.what === 'floor' ? 0.5 : hit.y, hit.z),
      flat = hit.what !== 'wall' && hit.what !== 'back';
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(p.x, p.y, 13 * p.k, (flat ? 4.5 : 13) * p.k, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}

// Where a ball came down: a scuffed ring of chalk dust on the floor or a tabletop, a puff on a wall or
// the side of the furniture. The first landing of each throw is the big one.
function pitchArtSplat(g, s) {
  const p = pitchProject(s.x, s.y + 0.6, s.z),
    r = (s.big ? 12 : 7) * p.k;
  g.globalAlpha = Math.min(1, s.t * 1.2) * (s.big ? 0.8 : 0.5);
  if (s.flat) {
    ellipse(g, p.x, p.y, r * 1.5, r * 0.5, '#eef3e6');
    g.strokeStyle = '#6f8a7d';
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(p.x, p.y, r * 1.1, r * 0.36, 0, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const ang = s.x * 0.37 + i * 1.7;
      ellipse(g, p.x + Math.cos(ang) * r * 1.9, p.y + Math.sin(ang) * r * 0.6, 1.6 * p.k, 1 * p.k, '#f6f8ef');
    }
  } else {
    g.strokeStyle = '#f6f8ef';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x, p.y, r * (1.4 - Math.min(1, s.t) * 0.4), 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}

// The Ump's brushback: a bedpan spinning at the camera.
function pitchDrawIncoming(g) {
  const b = mini.pitchIncoming;
  if (!b) return;
  const u = clamp(b.t / b.dur, 0, 1),
    a = pitchProject(b.x, b.y, b.z),
    { w, h } = activeCanvas(),
    x = a.x + (w * 0.62 - a.x) * u * u,
    y = a.y + (h * 0.72 - a.y) * u * u - Math.sin(u * Math.PI) * 40,
    s = (a.k + u * u * 3) * 1.1;
  g.save();
  g.translate(x, y);
  g.rotate(b.t * 14);
  g.scale(s, s);
  path(g, p => p.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2), gradient(g, -18, -11, 36, 22, '#eef5f7', '#8ea6b1'), '#40535c', 1);
  rr(g, 14, -3, 12, 6, 3, '#9fb2bb');
  g.restore();
}

// A charger that made it: a pounce over the footboard.
function pitchDrawBedFx(g) {
  const f = mini.pitchBedFx;
  if (!f) return;
  const u = clamp(f.t / 1.2, 0, 1),
    { h } = activeCanvas(),
    y = f.y + (h * 0.92 - f.y) * u - Math.sin(u * Math.PI) * 60;
  g.globalAlpha = 1 - u * 0.6;
  gremlin(g, f.x + u * 40, y, 1.2 + u * 1.4, f.art, mini.total * 6);
  g.globalAlpha = 1;
  if (u < 0.6) pitchShout(g, 'ON THE BED!', f.x, f.y - 40, 26, '#ffd2b0', '#5a1f28');
}

// Big outlined lettering.
function pitchShout(g, text, x, y, size, fill, stroke, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = '900 ' + size + 'px "Trebuchet MS", Arial, sans-serif';
  g.textAlign = 'center';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.18;
  g.strokeStyle = stroke;
  g.strokeText(text, 0, size * 0.35);
  g.fillStyle = fill;
  g.fillText(text, 0, size * 0.35);
  g.restore();
}

// ---- HUD: the bucket, the streak, the level ----
function pitchDrawHud(g, w, h) {
  const x = 16,
    y = h - (mini.portrait ? 96 : 78),
    full = mini.pitchCap,
    n = mini.pitchBalls,
    tall = mini.portrait;
  rr(g, x - 6, y - 8, 150, tall ? 88 : 72, 14, '#0b1d30cc', '#5f8a9a55', 1);
  // The bucket and what is left in it, with the refill clock around it.

  // A heap of balls in the bucket: three across the rim, then two, then one on top.
  const heap = [[17, 12], [28, 12], [39, 12], [22, 5], [34, 5], [28, -2]];
  for (let i = 0; i < Math.min(n, heap.length); i++) softball(g, x + heap[i][0], y + heap[i][1], 5.5);
  path(g, p => p.arc(x + 28, y + 12, 22, Math.PI, 0), null, '#9fb2bb', 2);
  path(
    g,
    p => {
      p.moveTo(x + 6, y + 14);
      p.lineTo(x + 50, y + 14);
      p.lineTo(x + 45, y + 46);
      p.lineTo(x + 11, y + 46);
      p.closePath();
    },
    gradient(g, x, y, 56, 0, '#5d9ad0', '#2f6aa0'),
    '#1d3f60',
    1.2
  );
  rr(g, x + 4, y + 12, 48, 5, 2.5, '#7fb4e0', '#1d3f60', 1);
  if (n < full) {
    const k = 1 - clamp(mini.pitchRefillT / pitchTune().refill, 0, 1);
    g.strokeStyle = '#bdf0c8';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x + 28, y + 30, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    g.stroke();
  }
  label(g, n + '/' + full, x + 62, y + 24, 18, n ? '#f4f1ea' : '#ffb0a0');
  label(g, 'BALLS', x + 62, y + 40, 10, '#a9c4cf');
  const heat = mini.combo >= 5,
    ly = y + (tall ? 70 : 60);
  label(g, mini.combo > 1 ? 'STREAK ×' + mini.combo : 'L' + (mini.tier + 1) + ' · ' + tiers[mini.tier], x, ly, heat ? 13 : 11, heat ? '#ffb347' : '#efdab0');
  if (heat) label(g, 'HEATER', x + 98, ly, 13, '#ff9a6a');
  if (mini.pitchFreeze > 0) pitchShout(g, 'TIMEOUT ' + Math.ceil(mini.pitchFreeze), w / 2, tall ? 170 : 74, 20, '#d8f4ff', '#1d3f60');
}

// Coaching, drawn on the canvas where it applies.
function pitchTag(g, text, x, y, arrow) {
  const { w, h } = activeCanvas(),
    tw = text.length * 7.4 + 22;
  x = clamp(x, tw / 2 + 8, w - tw / 2 - 8);
  y = clamp(y, 70, h - 20);
  rr(g, x - tw / 2, y - 15, tw, 26, 9, '#fff2c4ee');
  label(g, text, x, y + 3, 11, '#2b2a1e', 'center');
  if (arrow) poly(g, [[x - 7, y + 11], [x + 7, y + 11], [x, y + 20]], '#fff2c4ee');
}

// One coaching line at a time. A note about the last press or the last miss comes first, then the
// level's own coaching.
function pitchDrawHints(g) {
  pitchDrawEyes(g);
  if (mini.screen !== 'play') return;
  const note = mini.pitchNote;
  if (note && note.tall === !!mini.portrait) {
    pitchTag(g, note.text, note.x, note.y, false);
    return;
  }
  const c = pitchCoach();
  if (!c) return;
  if (c.path) {
    g.globalAlpha = 0.4 + 0.2 * Math.sin(mini.total * 4);
    c.path.forEach((q, i) => {
      if (i % 2) return;
      const p = pitchProject(...q);
      ellipse(g, p.x, p.y, 2.2, 2.2, '#c9f0ff');
    });
    g.globalAlpha = 1;
  }
  if (c.ghost) pitchDrawGhost(g, c.ghost);
  pitchTag(g, c.text, c.x, c.y, c.arrow);
}

// How hard a stroke is, in words.
function pitchPowerWord(speed) {
  return speed < 800 ? 'EASY' : speed < 1500 ? 'FIRM' : 'HARD';
}

// The stroke that would throw a medium arc into a gremlin standing still, for the first-flick coaching.
function pitchGhostFor(e) {
  const aim = pitchAimAt(pitchCenter(e), 0.3);
  return aim && pitchSwipeFor(aim);
}

// The coaching line for right now, or null: { text, x, y, arrow, ghost, path }. Level 1 walks through
// the flick, the lead and the lob; level 2 shows its first bank shot, stroke and flight.
function pitchCoach() {
  const live = mini.pitchTargets.filter(e => e.state === 'live' && pitchHittable(e)),
    seen = live.filter(e => !(e.kind === 'peek' && e.mode === 'hidden')),
    over = e => pitchProject(e.x, e.y + PITCH_GREM * (e.size || 1) + 8, e.z),
    tag = (text, e, extra) => ({ text, x: over(e).x, y: over(e).y - 18, arrow: true, ...extra }),
    done = k => mini.pitchKinds[k] || 0;
  if (mini.tier === 0) {
    const sit = seen.find(e => e.kind === 'sit');
    if (sit && !mini.pitchThrows) return tag('SWIPE UP THROUGH IT AND LET GO', sit, { ghost: pitchGhostFor(sit) });
    if (sit && !mini.pitchHits && mini.pitchThrows >= 2) return tag('FLICK HARDER TO THROW FARTHER', sit, { ghost: pitchGhostFor(sit) });
    const walker = seen.find(e => e.kind === 'walk');
    if (walker && done('walk') < 4) return tag('LEAD IT: FLICK WHERE IT IS GOING', walker);
    const peek = live.find(e => e.kind === 'peek');
    if (peek && !done('peek')) return tag(peek.mode === 'hidden' ? 'WAIT FOR IT, OR SWIPE LONG TO LOB IT' : 'NOW', peek);
    const charge = seen.find(e => e.kind === 'charge');
    if (charge && !done('charge')) return tag('STOP IT BEFORE THE BED', charge);
  }
  if (mini.tier === 1 && !mini.pitchBanks) {
    const shield = seen.find(e => e.kind === 'shield'),
      plan = shield && pitchBankPlan(shield, 2);
    if (plan) {
      const s = plan.swipe;
      return { text: 'FLICK ALONG THE ARROW · ' + pitchPowerWord(s.speed), x: s.x1, y: s.y1 - 26, arrow: false, ghost: s, path: plan.path };
    }
  }
  if (!mini.pitchBalls && mini.tier < 2) return { text: 'HITS REFILL THE BUCKET', x: 80, y: activeCanvas().h - 112, arrow: true };
  return null;
}

// A ghost flick: the stroke to make, a faint arrow with a fingertip that runs along it.
function pitchDrawGhost(g, s) {
  const cyc = (mini.total % 1.6) / 1.6,
    u = clamp(cyc / 0.35, 0, 1),
    ease = u * u * (3 - 2 * u);
  g.globalAlpha = 0.4;
  line(g, [[s.x0, s.y0], [s.x1, s.y1]], '#fff2c4', 5);
  poly(g, [[s.x1 + s.ux * 12, s.y1 + s.uy * 12], [s.x1 - s.uy * 8, s.y1 + s.ux * 8], [s.x1 + s.uy * 8, s.y1 - s.ux * 8]], '#fff2c4');
  g.globalAlpha = cyc < 0.5 ? 0.85 * (1 - clamp((cyc - 0.35) / 0.15, 0, 1)) : 0;
  ellipse(g, s.x0 + (s.x1 - s.x0) * ease, s.y0 + (s.y1 - s.y0) * ease, 11, 11, '#ffffff');
  g.globalAlpha = 1;
}

function pitchDrawPops(g) {
  for (const p of mini.pitchPops) {
    const q = pitchProject(p.x, p.y, p.z);
    g.globalAlpha = Math.min(1, p.t * 2.5);
    label(g, p.text, q.x, q.y - (1 - p.t) * 34, 13, p.col, 'center');
  }
  g.globalAlpha = 1;
}

function pitchDrawRipples(g) {
  for (const r of mini.pitchRipples) {
    if (r.tall !== !!mini.portrait) continue;
    const u = r.t / 0.4;
    g.globalAlpha = Math.max(0, 1 - u);
    path(g, p => p.arc(r.x, r.y, 10 + u * 26, 0, Math.PI * 2), null, '#fff1b8', 2.5);
  }
  // The finger's last flick-window of motion, as a fading streak: the part of the swipe that throws.
  const q = mini.pitchPress;
  if (q && q.tall === !!mini.portrait && q.pts.length > 1) {
    const pts = q.pts.filter(s => s.t >= mini.total - PITCH_FLICK_WIN - 1e-9);
    for (let i = 1; i < pts.length; i++) {
      g.globalAlpha = 0.15 + (0.35 * i) / pts.length;
      line(g, [[pts[i - 1].x, pts[i - 1].y], [pts[i].x, pts[i].y]], '#ffffff', 2 + (4 * i) / pts.length);
    }
  }
  g.globalAlpha = 1;
}

// The whole frame: shell, live TV, decals, then everything in the room far to near, then the overlays.
function pitchDraw(g) {
  const { w, h } = activeCanvas();
  // A press never survives a pause; resuming must not throw a ball nobody asked for.
  if (mini.paused) mini.pitchPress = null;
  g.save();
  if (mini.pitchShake > 0 && !reduced) {
    const a = mini.pitchShake * 12;
    g.translate(Math.sin(mini.total * 90) * a, Math.cos(mini.total * 77) * a * 0.6);
  }
  pitchShell(g, w, h);
  pitchDrawTv(g);
  pitchDrawDecals(g);
  const items = [
    { z: 510, d: () => pitchArtBin(g) },
    { z: 470, d: () => pitchArtSofa(g) },
    { z: 444, d: () => pitchArtChairSeat(g) },
    { z: 396, d: () => pitchArtChairBack(g) },
    { z: 346, d: () => pitchArtCabinet(g) },
    { z: 321, d: () => pitchArtEtype(g) },
    { z: 310, d: () => pitchArtSofaArm(g) },
    { z: 250, d: () => pitchArtTray(g) },
    { z: 132, d: () => pitchArtFootboard(g) },
    { z: 122, d: () => pitchArtBed(g) },
    { z: -10, d: () => pitchArtMacy(g) }
  ];
  for (const e of mini.pitchTargets || []) items.push({ z: e.key !== undefined ? e.key : e.z, d: () => pitchArtTarget(g, e) });
  for (const o of mini.pitchBottles || []) if (o.up) items.push({ z: o.z - 0.1, d: () => pitchArtBottle(g, o) });
  for (const f of mini.pitchFlyers || []) items.push({ z: f.z, d: () => pitchArtFlyer(g, f) });
  for (const s of mini.pitchSplats || []) items.push({ z: s.z + 0.3, d: () => pitchArtSplat(g, s) });
  for (const b of mini.pitchLive || []) {
    // A ball that dropped into the bin stays inside it.
    const inBin = b.x > PITCH_BIN.x0 && b.x < PITCH_BIN.x1 && b.z > PITCH_BIN.z0 && b.z < PITCH_BIN.z1 && b.y < PITCH_BIN.y1,
      key = inBin ? 511 : b.z;
    items.push({ z: key + 0.05, d: () => pitchArtShadow(g, b) });
    items.push({ z: key, d: () => pitchArtBall(g, b) });
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.d();
  pitchDrawPreview(g);
  pitchDrawIncoming(g);
  pitchDrawBedFx(g);
  pitchDrawHud(g, w, h);
  pitchDrawHints(g);
  pitchDrawPops(g);
  pitchDrawRipples(g);
  if (mini.pitchHitFlash > 0) {
    g.globalAlpha = mini.pitchHitFlash;
    rect(g, 0, 0, w, h, '#ff7a8a');
    g.globalAlpha = 1;
  }
  g.restore();
}

// ---- Losing: the call ----
// The Ump in full gear. punch 0 to 1 swings the right arm up into the out call.
function pitchUmpFigure(g, x, y, s, t, punch) {
  gremlin(g, x, y, s, 3, t);
  g.save();
  g.translate(x, y);
  pitchUmpGear(g, s);
  // The right arm: wound down, then up and out with the thumb jerked over the shoulder.
  g.translate(15 * s, -16 * s);
  g.rotate(0.35 - punch * 1.45);
  line(g, [[0, 0], [26 * s, 0]], '#548cae', 7 * s);
  ellipse(g, 28 * s, 0, 6 * s, 6 * s, '#80d5ec');
  line(g, [[28 * s, -2 * s], [20 * s, -9 * s]], '#80d5ec', 3.4 * s);
  g.restore();
}

// A missed quota brings out the Ump for the punch-out; a stormed bed is a dogpile.
function pitchDrawLoss(g) {
  const t = mini.transition || 0,
    { w, h } = activeCanvas(),
    tall = mini.portrait,
    stormed = mini.pendingFinish.reason !== PITCH_QUOTA_MISSED;
  pitchDraw(g);
  g.globalAlpha = Math.min(0.55, t * 0.7);
  rect(g, 0, 0, w, h, '#1d1630');
  g.globalAlpha = 1;
  if (!mini.pitchLossFx) {
    mini.pitchLossFx = true;
    sfx(stormed ? 'boss' : 'bomb');
  }
  if (stormed) {
    const bed = pitchProject(90, 70, 60);
    for (let i = 0; i < 6; i++) {
      const start = (i % 2 ? -1 : 1) * (w * 0.6),
        u = clamp((t - i * 0.12) / 0.7, 0, 1),
        x = bed.x + start * (1 - u) + (i - 2.5) * 22 * u,
        y = bed.y - Math.sin(u * Math.PI) * 80 - (u >= 1 ? (i % 3) * 26 + Math.abs(Math.sin(t * 9 + i)) * 8 : 0);
      if (u > 0) gremlin(g, x, y, 1.3 + bed.k * 0.4, i % 4, t * 5 + i);
    }
    if (t > 0.5) pitchShout(g, 'DOGPILE!', w / 2, h * 0.28, tall ? 54 : 64, '#ffd2b0', '#3d0f1f', -0.05);
  } else {
    const rise = clamp(t / 0.5, 0, 1),
      punch = clamp((t - 0.7) / 0.15, 0, 1);
    pitchUmpFigure(g, w / 2, h + 40 - rise * (tall ? 380 : 300), tall ? 3.6 : 3.4, t * 3, punch);
    if (punch > 0) {
      if (!mini.pitchLossCall) {
        mini.pitchLossCall = true;
        sfx('explode');
      }
      pitchShout(g, 'YER OUT!', w / 2, h * (tall ? 0.26 : 0.22), (tall ? 58 : 70) * (0.8 + 0.2 * punch), '#ffe066', '#3d0f1f', -0.06);
    }
  }
  label(g, 'Evicted ' + mini.got + ' of ' + mini.goal + ' · best streak ' + mini.maxCombo, w / 2, h - 24, 15, '#f4ebcf', 'center');
}

// The result canvas (800 × 220) after a loss: gremlins in Macy's bed, the Ump making the call.
function pitchResultLoss(g) {
  const stormed = mini.pendingFinish && mini.pendingFinish.reason !== PITCH_QUOTA_MISSED;
  rr(g, 24, 26, 176, 70, 10, '#16374bee', '#9dc7be88', 1.5);
  label(g, 'MACY', 40, 54, 14, '#bde5b5');
  label(g, String(mini.got), 184, 54, 18, '#f4ebcf', 'right');
  label(g, stormed ? 'GREMLINS IN BED' : 'QUOTA', 40, 82, 12, '#ffb0a0');
  label(g, stormed ? String(mini.miss) : String(mini.goal), 184, 82, 16, '#ffd2b0', 'right');
  for (let i = 0; i < 4; i++) gremlin(g, 340 + i * 36, 128 + (i % 2) * 8, 0.95, i % 4, time * 2 + i);
  // One wears her cap, one holds her ball.
  path(
    g,
    p => {
      p.moveTo(394, 92);
      p.quadraticCurveTo(410, 74, 426, 92);
      p.closePath();
    },
    '#c0392b'
  );
  rr(g, 420, 89, 16, 4, 2, '#c0392b');
  softball(g, 470, 118, 7);
  pitchUmpFigure(g, 640, 200, 1.7, time * 2, 1);
  rr(g, 676, 60, 104, 34, 12, '#fff6e4', '#3d0f1f', 2);
  label(g, 'YER OUT', 728, 83, 15, '#c0392b', 'center');
  label(g, stormed ? 'THE BED HAS BEEN STORMED.' : 'THE UMP HAS SPOKEN.', 400, 24, 12, '#dfe2b9', 'center');
}

// ---- Department card and lobby preview (260 × 135 and 420 × 240) ----
function pitchScene(g, w, h) {
  g.save();
  g.scale(w / 420, h / 240);
  rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 0, 240, '#d9eadb', '#bcd6c6'));
  windowArt(g, 34, 22, 132, 82, { daypart: 'afternoon' });
  legoLily(g, 52, 104, 0.8);
  legoLily(g, 150, 104, 0.7, '#f08db5', '#ffd3e5', true);
  tvBezel(g, { x: 246, y: 26, w: 136, h: 78 });
  rect(g, 251, 31, 126, 68, '#1e5a3a');
  label(g, 'FASTPITCH FEVER', 314, 52, 9, '#ffe39a', 'center');
  label(g, '12 / 32', 314, 80, 18, '#f4f1ea', 'center');
  rect(g, 0, 150, 420, 90, gradient(g, 0, 150, 0, 90, '#b9d2c2', '#93bcae'));
  rr(g, 0, 146, 420, 6, 2, '#edf1d8');
  sofa(g, 6, 214, 110, '#bc8f9e');
  // The Ensure pyramid on the tray table.
  rr(g, 150, 176, 70, 6, 3, '#efd6a8');
  line(g, [[185, 182], [185, 222]], '#8f9fa3', 3);
  [[163, 176], [177, 176], [191, 176], [170, 159], [184, 159], [177, 142]].forEach(([x, y], i) => roomBottle(g, x, y, i % 3, 0.85));
  gremlin(g, 262, 206, 1.3, 0, time * 2);
  // A peeker behind the cabinet, and the E-Type on top of it.
  gremlin(g, 326, 178 + Math.sin(time * 2) * 6, 0.9, 1, time * 2 + 1);
  cabinet(g, 330, 214, 80);
  etype(g, 370, 128, 0.7);
  // The throw: a dotted arc from the bottom right, and the ball riding it.
  const arc = u => [400 - u * 138, 236 - Math.sin(u * Math.PI * 0.92) * 120 - u * 20];
  for (let i = 0; i < 14; i++) {
    const [x, y] = arc(i / 14);
    ellipse(g, x, y, 2.2, 2.2, '#ffffffcc');
  }
  const [bx, by] = arc((time * 0.6) % 1);
  softball(g, bx, by, 7);
  label(g, 'FASTPITCH FEVER', 210, 20, 14, '#2f5a55', 'center');
  g.restore();
}
