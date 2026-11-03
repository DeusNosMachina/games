// Fastpitch Fever (your room, daytime). Macy sits up in bed with a bucket of softballs and a gremlin
// problem. Drag back anywhere and let go to throw (the dotted arc shows the flight), or tap a spot for a
// fastball straight at it. Balls fly through the room in real 3D: gravity, an arc, bounces off the walls
// and the furniture. Walkers need a lead, peekers duck behind the furniture, bedpan shields only fall to
// a bank shot off a wall, chargers head for the bed, and the Ensure bottles on the tray table ring like
// carnival cans. Every hit puts a ball back in the bucket; misses empty it, and a slow refill means an
// empty bucket never stalls the run. Level 3 brings the Ump, golden two-for-one gremlins and a smaller
// bucket. Canvas 800 × 450, or 450 × 800 upright: the rules live in room centimeters and only the
// camera changes with the shape.

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
  PITCH_SLOP = 12, // canvas px a press may wander and still count as a tap
  PITCH_PULL = 165, // canvas px of pull for a full-power throw
  PITCH_MIN_POWER = 0.12,
  PITCH_VMIN = 180, // throw speed at the softest pull, cm/s
  PITCH_VMAX = 640, // and at a full pull: a little past the far floor, up the window wall
  PITCH_LIFT = 0.56, // launch angle of a pulled throw, radians (about 32 degrees)
  PITCH_LOB = 1.08, // and of a lob, dragged upward (about 62 degrees): high enough to drop behind cover
  PITCH_FAST = 980, // a tap's fastball speed
  PITCH_SNAP = 70, // a tap within this many cm of a gremlin aims at its depth
  PITCH_GREM = 50, // gremlin height
  PITCH_COOLDOWN = 0.15,
  PITCH_HAND = { x: 88, y: 168, z: 28 }; // her release point, overhand, above her head

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
// in the bucket, or empty: seconds when it is empty. walk: speed range (cm/s); peek: [seconds up, seconds down];
// hop: [seconds resting, seconds in the air]; charge: approach speed (cm/s); sitLife: seconds before a
// sitting gremlin wanders off (0 = never); timed: a golden gremlin's window; preview: how many contacts
// the dotted arc shows; hit: gremlin hit radius (cm). Speeds and windows scale with the prescription.
const PITCH_TIERS = [
  {
    limit: 80,
    goal: 32,
    balls: [10, 12],
    refill: 2.4,
    empty: 1.2,
    hit: 27,
    preview: 2,
    cap: [2, 3, 3],
    interval: [1.1, 1.4, 1.4],
    mix: [{ sit: 1 }, { sit: 2, walk: 3 }, { walk: 3, sit: 1, peek: 1, charge: 1 }],
    walk: [28, 38],
    peek: [2.4, 1.8],
    hop: [1.6, 0.7],
    charge: 18,
    sitLife: 0,
    timed: 0,
    shelf: false,
    ump: false,
    script: ['sit:0', 'sit:9', 'sit:6', 'sit:2']
  },
  {
    limit: 95,
    goal: 42,
    balls: [9, 10],
    refill: 2.8,
    empty: 1.3,
    hit: 24,
    preview: 2,
    cap: [3, 3, 4],
    interval: [1.2, 1.1, 1.0],
    mix: [
      { walk: 3, sit: 1, peek: 2, hop: 1 },
      { walk: 2, peek: 2, shield: 2, charge: 1, hop: 1 },
      { walk: 2, peek: 2, shield: 2, charge: 2, hop: 2 }
    ],
    walk: [50, 68],
    peek: [1.4, 1.6],
    hop: [1.1, 0.65],
    charge: 30,
    sitLife: 8,
    timed: 0,
    shelf: true,
    ump: false,
    script: []
  },
  {
    limit: 110,
    goal: 58,
    balls: [6, 8],
    refill: 3.2,
    empty: 1.5,
    hit: 23,
    preview: 1,
    cap: [4, 4, 3],
    interval: [1.1, 1.0, 1.1],
    mix: [
      { walk: 3, peek: 2, shield: 1, hop: 2, charge: 1, timed: 1 },
      { walk: 2, peek: 2, shield: 2, charge: 2, hop: 2, timed: 2 },
      { walk: 2, peek: 1, shield: 1, charge: 2, timed: 1 }
    ],
    walk: [62, 86],
    peek: [1.1, 1.4],
    hop: [0.85, 0.6],
    charge: 38,
    sitLife: 7,
    timed: 2.6,
    umpUp: 1.8,
    shelf: true,
    ump: true,
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
  walk: 'WALKER · THROW WHERE IT IS GOING, NOT WHERE IT IS',
  peek: 'PEEKER · WAIT FOR THE HEAD, OR DRAG UP TO LOB ONE OVER THE TOP',
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
  info: {
    game: 'Fastpitch Fever',
    genre: 'AIM · ARC · BANK · LEAD',
    headline: 'Bed rest. Rocket arm.',
    desc:
      'Broad daylight in Room 5, a bucket of softballs and a gremlin problem. Drag back and let fly, or tap a spot for a fastball. The ball arcs, banks off the walls, rattles the furniture and splats whatever it finds. Lead the walkers, time the peekers, ring the Ensure bottles. Every hit puts a ball back in the bucket.',
    goal: 'Hit the eviction quota before the last inning ends, and keep the gremlins off the bed.',
    control:
      'Drag back anywhere and let go to throw: pull farther to throw farther, and the dotted arc shows the flight. Drag up instead for a high lob that drops behind the furniture. Tap a spot for a fastball straight at it. Mouse: drag, or click. Keys: arrows aim, Space throws.',
    avoid:
      'Walkers keep moving, so throw where they are going. Peekers duck behind the furniture. A bedpan shield means bank it off a wall. A gremlin that reaches the footboard is an oops. Misses empty the bucket; hits fill it.',
    cue: 'Drag back to throw · drag up to lob · tap for a fastball · lead the walkers'
  },
  tierNotes: [
    '80s · sitting ducks, then slow walkers · the arc shows the bounce',
    '95s · walkers, peekers, bedpan shields · bank shots',
    '110s · the Ump · golden gremlins · a smaller bucket'
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
  // Canvas presses. Release without moving: a fastball at that spot. Drag past the slop: a slingshot
  // throw on release, with the arc previewed while the finger is down.
  down(p) {
    mini.pitchPress = { sx: p.x, sy: p.y, x: p.x, y: p.y, armed: false, tall: !!mini.portrait };
    mini.pitchRipples.push({ x: p.x, y: p.y, t: 0, tall: !!mini.portrait });
    mini.pitchKeyAim = false;
  },
  move(p) {
    const q = mini.pitchPress;
    if (!q) return;
    q.x = p.x;
    q.y = p.y;
    if (!q.armed && Math.hypot(p.x - q.sx, p.y - q.sy) > PITCH_SLOP) q.armed = true;
    if (q.armed) mini.pitchAim = pitchPullAim(q);
  },
  up(cancel) {
    const q = mini.pitchPress;
    mini.pitchPress = null;
    if (!q || cancel || mini.screen !== 'play' || mini.paused || q.tall !== !!mini.portrait) return;
    if (!q.armed) {
      pitchTapThrow(q.sx, q.sy);
      return;
    }
    const aim = pitchPullAim(q);
    if (aim.power < PITCH_MIN_POWER) {
      pitchPopAt(PITCH_HAND.x, PITCH_HAND.y + 40, PITCH_HAND.z + 60, 'PULL BACK FARTHER', '#d8ecf2');
      return;
    }
    mini.pitchAim = aim;
    pitchThrow(pitchAimVelocity(aim));
  },
  // THROW (and Space) throws the keyboard aim, or repeats the last throw: same spot, same arc.
  action(a) {
    if (a !== 'throw') return;
    pitchThrow(mini.pitchKeyAim || !mini.pitchLastV ? pitchAimVelocity(mini.pitchAim) : mini.pitchLastV);
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
    if (shift === 1) return mini.tier === 0 ? 'INNING 2 · walkers. Throw where they are going.' : 'INNING 2 · shields out. Bank it off a wall.';
    return T.ump ? 'FINAL INNING · the Ump is in the building.' : 'FINAL INNING · they are heading for the bed.';
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
        (mini.tier === 0 ? ' The arc shows the whole flight.' : mini.tier === 2 ? ' The Ump takes the final inning.' : ''),
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

// Distance along the ray to a box, or Infinity (slab test).
function pitchRayBox(o, d, b) {
  let t0 = 0,
    t1 = Infinity;
  for (const [oa, da, lo, hi] of [
    [o.x, d.x, b.x0, b.x1],
    [o.y, d.y, b.y0, b.y1],
    [o.z, d.z, b.z0, b.z1]
  ]) {
    if (Math.abs(da) < 1e-9) {
      if (oa < lo || oa > hi) return Infinity;
      continue;
    }
    let a = (lo - oa) / da,
      c = (hi - oa) / da;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

// What a tap points at: the depth of a gremlin near the ray, or the first surface the ray meets.
function pitchRaycast(sx, sy) {
  const { o, d } = pitchRay(sx, sy);
  let best = Infinity;
  if (d.y < -1e-6) best = Math.min(best, -o.y / d.y);
  if (d.x > 1e-6) best = Math.min(best, (PITCH_WALL - o.x) / d.x);
  if (d.x < -1e-6) best = Math.min(best, (-PITCH_WALL - o.x) / d.x);
  if (d.z > 1e-6) best = Math.min(best, (PITCH_BACK - o.z) / d.z);
  for (const b of PITCH_BOXES) {
    if (b.id === 'bed') continue;
    const t = pitchRayBox(o, d, b);
    if (t > 0 && t < best) best = t;
  }
  let snap = null,
    near = PITCH_SNAP;
  for (const e of mini.pitchTargets) {
    if (!pitchHittable(e)) continue;
    const c = pitchCenter(e),
      t = (c.x - o.x) * d.x + (c.y - o.y) * d.y + (c.z - o.z) * d.z;
    if (t <= 0 || t > best + 60) continue;
    const off = Math.hypot(o.x + d.x * t - c.x, o.y + d.y * t - c.y, o.z + d.z * t - c.z);
    if (off < near) {
      near = off;
      snap = t;
    }
  }
  let t = snap !== null ? snap : best;
  if (!Number.isFinite(t)) t = 600;
  // Never aim behind the footboard.
  if (o.z + d.z * t < 140 && d.z > 1e-6) t = Math.max(t, (140 - o.z) / d.z);
  return { x: o.x + d.x * t, y: Math.max(0, o.y + d.y * t), z: o.z + d.z * t, snapped: snap !== null };
}

// ---- Throws ----
// A pull from the press point. Dragging down is a slingshot: the throw goes the other way, at a
// pitcher's angle. Dragging up is a lob: high, the way the finger went, to drop behind the furniture.
// Either way, the farther the pull, the farther the throw.
function pitchPullAim(q) {
  const fwd = q.y - q.sy,
    lat = fwd >= 0 ? q.sx - q.x : q.x - q.sx,
    len = Math.hypot(fwd, lat);
  return {
    yaw: clamp(Math.atan2(lat, Math.max(1e-3, Math.abs(fwd))), -1.2, 1.2),
    power: clamp(len / PITCH_PULL, 0, 1),
    lob: fwd < 0
  };
}

function pitchAimVelocity(aim) {
  const sp = Math.sqrt(PITCH_VMIN * PITCH_VMIN + (PITCH_VMAX * PITCH_VMAX - PITCH_VMIN * PITCH_VMIN) * aim.power),
    lift = aim.lob ? PITCH_LOB : PITCH_LIFT,
    flat = sp * Math.cos(lift);
  return { x: Math.sin(aim.yaw) * flat, y: sp * Math.sin(lift), z: Math.cos(aim.yaw) * flat };
}

// A fastball: a flat, quick throw that arrives at q, gravity included.
function pitchFastball(q) {
  const H = PITCH_HAND,
    dx = q.x - H.x,
    dy = q.y - H.y,
    dz = q.z - H.z,
    T = clamp(Math.hypot(dx, dy, dz) / PITCH_FAST, 0.14, 0.8);
  return { x: dx / T, y: dy / T + 0.5 * PITCH_G * T, z: dz / T };
}

function pitchTapThrow(sx, sy) {
  const q = pitchRaycast(sx, sy);
  mini.pitchMark = { x: q.x, y: q.y, z: q.z, t: 0.5 };
  pitchThrow(pitchFastball(q));
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
    pitchAim: { yaw: -0.14, power: 0.55 },
    pitchKeyAim: false,
    pitchLastV: null,
    pitchPress: null,
    pitchMark: null,
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
  if (T.ump && mini.shift === 2 && !mini.pitchUmpSpawned) pitchSpawnUmp();
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

// A bank shot that gets a bedpan shield: the spot on a wall to tap, the flight it starts, and where
// it bounces. Searched with the real physics around the mirror-trick spot on each wall (the nearer
// side wall first, then the back wall), and only spots a tap can actually pick (no snapping to the
// gremlin). Shields stand on fixed spots, so plans are cached per spot, canvas shape and gremlin size
// for the session; it never touches the random sequence.
const pitchBankCache = new Map();

function pitchBankPlan(e) {
  const key = [Math.round(e.x), Math.round(e.y), Math.round(e.z), mini.portrait ? 'tall' : 'wide', pitchRadius(e)].join();
  if (pitchBankCache.has(key)) return pitchBankCache.get(key);
  const H = PITCH_HAND,
    c = pitchCenter(e),
    R = pitchRadius(e) * 0.8 + PITCH_BALL,
    near = c.x < 0 ? -1 : 1,
    walls = [];
  // Points on the wall planes themselves: that is where a tap on a wall lands.
  for (const side of [near, -near]) {
    const wx = side * PITCH_WALL,
      u = (wx - H.x) / (2 * wx - c.x - H.x);
    walls.push(at => [wx, H.y + (c.y - H.y) * u + at[1], H.z + (c.z - H.z) * u + at[0]]);
  }
  const wz = PITCH_BACK,
    uz = (wz - H.z) / (2 * wz - c.z - H.z);
  walls.push(at => [H.x + (c.x - H.x) * uz + at[0], H.y + (c.y - H.y) * uz + at[1], wz]);
  // Flies the fastball a tap at wall point q throws. A hit returns the plan; a miss returns how close
  // it came after the wall; null when a tap there would pick something else.
  const fly = q => {
    if (q[1] < 8 || q[1] > PITCH_WALL_H || q[2] < 140 || q[2] > PITCH_BACK || Math.abs(q[0]) > PITCH_WALL) return null;
    const sp = pitchProject(q[0], q[1], q[2]),
      r = pitchRaycast(sp.x, sp.y);
    if (Math.hypot(r.x - q[0], r.y - q[1], r.z - q[2]) > 4) return null;
    const b = pitchNewBall(pitchFastball(r)),
      path = [];
    let bounce = null,
      miss = Infinity;
    for (let i = 0; i < 400 && !b.dead; i++) {
      const hit = pitchMoveBall(b, PITCH_SUB);
      if (i % 3 === 0) path.push([b.x, b.y, b.z]);
      if ((hit === 'wall' || hit === 'back') && !bounce) bounce = { x: b.x, y: b.y, z: b.z };
      if (b.walls) {
        const d = Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z);
        if (d < R) return { q: r, bounce, path };
        miss = Math.min(miss, d);
      }
      if ((hit && hit !== 'wall' && hit !== 'back' && hit !== 'floor') || (hit === 'floor' && !b.walls)) break;
      // Past the gremlin and heading away: a miss.
      if (b.walls && b.age > 0.25 && (b.x - c.x) * b.vx + (b.z - c.z) * b.vz > 0 && Math.hypot(b.x - c.x, b.z - c.z) > R * 2) break;
    }
    return { miss };
  };
  // Coarse to fine around the mirror spot on each wall: a 5 × 5 patch, then smaller patches around the
  // closest miss.
  let plan = null;
  for (const wall of walls) {
    let centre = [0, 0],
      best = Infinity;
    for (const step of [16, 6, 2]) {
      let next = null;
      for (let i = -2; i <= 2 && !plan; i++)
        for (let j = -2; j <= 2 && !plan; j++) {
          const at = [centre[0] + i * step, centre[1] + j * step],
            t = fly(wall(at));
          if (!t) continue;
          if (t.q) plan = t;
          else if (t.miss < best) {
            best = t.miss;
            next = at;
          }
        }
      if (plan || !next) break;
      centre = next;
    }
    if (plan) break;
  }
  pitchBankCache.set(key, plan);
  return plan;
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
    if (b.dead) pitchBallDone(b);
  }
  mini.pitchLive = mini.pitchLive.filter(b => !b.dead);
}

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
  if (b.got || b.bottles) mini.pitchHits++;
  else mini.combo = 0;
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
  if (mini.pitchMark) {
    mini.pitchMark.t -= dt;
    if (mini.pitchMark.t <= 0) mini.pitchMark = null;
  }
  if (mini.pitchBedFx) {
    mini.pitchBedFx.t += dt;
    if (mini.pitchBedFx.t > 1.2) mini.pitchBedFx = null;
  }
}

// ---- The run, per frame ----
function pitchUpdate(dt) {
  const T = pitchTune();
  // Turning the phone mid-drag drops the drag: its points belong to the other canvas.
  if (mini.pitchWasTall !== !!mini.portrait) {
    mini.pitchWasTall = !!mini.portrait;
    mini.pitchPress = null;
  }
  // Keyboard aim: left and right swing it, up and down set the distance.
  const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0),
    ky = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
  if (kx || ky) {
    mini.pitchKeyAim = true;
    mini.pitchAim = {
      yaw: clamp(mini.pitchAim.yaw + kx * 0.8 * dt, -1.2, 1.2),
      power: clamp(mini.pitchAim.power + ky * 0.6 * dt, 0, 1)
    };
  }
  for (const k of ['pitchCd', 'pitchEmptyT', 'pitchFreeze', 'pitchShake', 'pitchHitFlash', 'pitchEtype'])
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

// The aim the dotted arc previews: a drag in progress, or the keyboard's.
function pitchPreviewAim() {
  const q = mini.pitchPress;
  if (q && q.armed && q.tall === !!mini.portrait) return pitchPullAim(q);
  if (mini.pitchKeyAim) return mini.pitchAim;
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
  if (q && !q.armed) y += 6 * base.k;
  else if (q && q.armed && q.tall === !!mini.portrait) {
    const dx = q.x - q.sx,
      dy = q.y - q.sy,
      n = Math.hypot(dx, dy) || 1,
      pull = Math.min(n, PITCH_PULL) * 0.32;
    x += (dx / n) * pull;
    y += (dy / n) * pull;
  } else if (mini.pitchKeyAim && mini.pitchAim) {
    x -= Math.sin(mini.pitchAim.yaw) * 30 * mini.pitchAim.power;
    y += Math.cos(mini.pitchAim.yaw) * 30 * mini.pitchAim.power;
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

// ---- Aim preview: the dotted arc, and rings where it lands ----
function pitchDrawPreview(g) {
  const aim = pitchPreviewAim();
  if (!aim) return;
  const sim = pitchSimulate(pitchAimVelocity(aim), pitchTune().preview),
    weak = aim.power < PITCH_MIN_POWER;
  sim.pts.forEach((q, i) => {
    if (i === 0) return;
    const p = pitchProject(...q),
      fade = 1 - (i / sim.pts.length) * 0.55,
      r = Math.max(1.6, 2.6 * p.k);
    g.globalAlpha = (weak ? 0.25 : 0.9) * fade;
    ellipse(g, p.x, p.y, r, r, i % 2 ? '#ffffff' : '#fff1b8');
  });
  g.globalAlpha = 1;
  for (const hit of sim.hits) {
    const p = pitchProject(hit.x, hit.what === 'floor' ? 0.5 : hit.y, hit.z),
      flat = hit.what !== 'wall' && hit.what !== 'back';
    g.strokeStyle = weak ? '#ffffff55' : '#fff1b8';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(p.x, p.y, 14 * p.k, (flat ? 5 : 14) * p.k, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // The pull meter: a band from the press to the finger, warmer as it gets stronger.
  const q = mini.pitchPress;
  if (q && q.armed) {
    const col = aim.power > 0.85 ? '#ff9a6a' : aim.power > 0.5 ? '#ffd27a' : '#bdf0c8';
    g.globalAlpha = 0.8;
    line(g, [[q.sx, q.sy], [q.x, q.y]], col, 3);
    ellipse(g, q.sx, q.sy, 6, 6, '#ffffff');
    ellipse(g, q.x, q.y, 9, 9, col);
    g.globalAlpha = 1;
    label(g, Math.round(aim.power * 100) + '%', q.x, q.y - 16, 12, col, 'center');
  }
}

// Where a tap is sending the fastball.
function pitchDrawMark(g) {
  const m = mini.pitchMark;
  if (!m) return;
  const p = pitchProject(m.x, m.y, m.z),
    u = 1 - m.t / 0.5;
  g.globalAlpha = 1 - u;
  g.strokeStyle = '#fff1b8';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(p.x, p.y, 8 + u * 16, 0, Math.PI * 2);
  g.stroke();
  line(g, [[p.x - 6, p.y], [p.x + 6, p.y]], '#fff1b8', 2);
  line(g, [[p.x, p.y - 6], [p.x, p.y + 6]], '#fff1b8', 2);
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

// First-game coaching, drawn on the canvas where it applies.
function pitchTag(g, text, x, y, arrow) {
  const { w, h } = activeCanvas(),
    tw = text.length * 7.4 + 22;
  x = clamp(x, tw / 2 + 8, w - tw / 2 - 8);
  y = clamp(y, 70, h - 20);
  rr(g, x - tw / 2, y - 15, tw, 26, 9, '#fff2c4ee');
  label(g, text, x, y + 3, 11, '#2b2a1e', 'center');
  if (arrow) poly(g, [[x - 7, y + 11], [x + 7, y + 11], [x, y + 20]], '#fff2c4ee');
}

function pitchDrawHints(g, w, h) {
  pitchDrawEyes(g);
  if (mini.screen !== 'play') return;
  const live = mini.pitchTargets.filter(e => e.state === 'live' && pitchHittable(e)),
    over = e => pitchProject(e.x, e.y + PITCH_GREM * (e.size || 1) + 8, e.z);
  if (mini.tier === 0 && !mini.pitchThrows) {
    const hand = pitchHandScreen(),
      bob = Math.sin(mini.total * 5) * 6;
    pitchTag(g, 'DRAG BACK AND LET GO', hand.x - 40, hand.y - 70 + bob, true);
    if (live[0]) pitchTag(g, 'OR TAP IT', over(live[0]).x, over(live[0]).y - 18, true);
  } else if (mini.tier === 0 && !mini.pitchHits && mini.pitchThrows >= 3 && live[0])
    pitchTag(g, 'TAP RIGHT ON IT FOR A FASTBALL', over(live[0]).x, over(live[0]).y - 18, true);
  const walker = live.find(e => e.kind === 'walk');
  if (walker && mini.tier === 0 && mini.pitchHits < 8) pitchTag(g, 'LEAD IT: AIM AHEAD', over(walker).x, over(walker).y - 18, true);
  // Level 2: a bedpan shield shows the bank path off the nearest side wall until one goes in.
  const shield = live.find(e => e.kind === 'shield');
  if (shield && mini.tier === 1 && !mini.pitchBanks) pitchBankGuide(g, shield);
  if (!mini.pitchBalls && mini.tier < 2) pitchTag(g, 'HITS REFILL THE BUCKET', 80, h - 112, true);
}

// The bank shot for a shield, drawn: the real flight from her hand off the wall into the gremlin,
// and the spot on the wall to tap.
function pitchBankGuide(g, e) {
  const plan = pitchBankPlan(e);
  if (!plan) return;
  g.globalAlpha = 0.45 + 0.25 * Math.sin(mini.total * 4);
  plan.path.forEach((q, i) => {
    if (i % 2) return;
    const p = pitchProject(...q);
    ellipse(g, p.x, p.y, 2.2, 2.2, '#c9f0ff');
  });
  g.globalAlpha = 1;
  const bp = pitchProject(plan.q.x, plan.q.y, plan.q.z);
  pitchTag(g, 'TAP HERE TO BANK IT', bp.x, bp.y - 16, true);
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
  pitchDrawMark(g);
  pitchDrawIncoming(g);
  pitchDrawBedFx(g);
  pitchDrawHud(g, w, h);
  pitchDrawHints(g, w, h);
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
