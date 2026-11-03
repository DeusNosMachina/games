// Loud Donut Pinball (MRI room): pinball inside the Loud Donut. The gremlins turned the bore into a pinball
// table: two flippers, a plunger, gremlin pop bumpers that take a few hits before they move out,
// M-R-I rollover lanes, a scan ramp, drop targets from level 2, and a boss bumper with multiball on
// level 3. Hold both flippers to fire the magnet and yank a doomed ball back up, until it overheats.
// Swipe up to nudge; nudge too much and it tilts. Three green targets on the donut's housing fill the
// Barf-o-meter (the ring around the donut); full, the table holds still while a gremlin climbs out of
// the bore, retches, sprays a slime wave down the table and coughs up an extra ball. Level 4,
// Legendary, is the skill test: a fast ball, wide outlanes, no kickbacks and no ball save.
// Physics run in table units (400 × 720) at fixed 1/600 s substeps: a circle against segments, arcs,
// round posts, bumpers and flippers (rotating capsules that hand the ball their surface speed), with a
// top speed. Drawing maps the table into the active canvas: 450 × 820 in portrait with a score strip
// on top, 800 × 600 in landscape with side panels. Every finger arrives through touch(): the left half
// of the canvas is the left flipper, the right half the right one, a swipe up nudges, and while the
// ball waits in the lane any press pulls the plunger and letting go fires it.
const MAGNET_W = 400,
  MAGNET_H = 720,
  MAGNET_CX = 182,
  MAGNET_BALL = 10,
  MAGNET_STEP = 1 / 600,
  MAGNET_VMAX = 1500,
  MAGNET_BORE = { x: 182, y: 286 },
  MAGNET_PULL = 4200, // magnet acceleration toward the bore, table units / s²
  MAGNET_BRAKE = 5, // eddy-current braking while the magnet is on, per second
  MAGNET_ARM = 0.1, // both flippers held this long fires the magnet
  MAGNET_FLIP = { len: 62, rp: 9, rt: 5, rest: 0.5, up: -0.44, wUp: 24, wDown: 13, e: 0.3 },
  MAGNET_PIVOTS = [
    { x: 110, y: 640 },
    { x: 254, y: 640 }
  ],
  MAGNET_LANE = { x0: 350, x1: 386, x: 368, y: 691 },
  MAGNET_ROLL_X = [131, 169, 207],
  MAGNET_ROLL_Y = 92,
  MAGNET_BUMPERS = [
    { x: 136, y: 308, type: 0 },
    { x: 228, y: 308, type: 1 },
    { x: 182, y: 248, type: 3 }
  ],
  MAGNET_BUMPER_R = 21,
  MAGNET_BOSS = { x: 182, y: 168, r: 28, swing: 62, period: 7 },
  MAGNET_DROP_X = 338,
  MAGNET_DROP_Y = [342, 372, 402],
  MAGNET_KICK_Y = 650,
  MAGNET_RAMP_MIN = 330, // inward speed the ramp mouth asks for
  MAGNET_RAMP_SPEED = 760,
  MAGNET_DRAIN_Y = 742,
  MAGNET_TAP_POWER = 0.35, // plunger power of a quick tap (0 to 1)
  // The Barf-o-meter bank: three standups on the donut's housing, upper right, facing the bumpers. Its
  // top end stays a ball's width clear of Clank's swing.
  MAGNET_BARF = [
    [302, 160, 318, 184],
    [322, 194, 334, 222],
    [338, 232, 343, 260]
  ],
  // The heave, in seconds: he climbs out, retches, sprays the slime wave and coughs up a ball while the
  // table holds still, then sinks back as play resumes.
  MAGNET_HEAVE = { climb: 0.8, retch: 0.9, spew: 1.4, spit: 0.45, sink: 0.6 },
  MAGNET_HEAVE_HOLD = 0.8 + 0.9 + 1.4 + 0.45,
  MAGNET_HEAVE_SIZE = 2, // his scale, fully out of the bore
  MAGNET_RAMP = magnetPath([
    [40, 320],
    [30, 250],
    [40, 170],
    [75, 105],
    [135, 62],
    [200, 52],
    [262, 72],
    [305, 120],
    [328, 190],
    [324, 290],
    [304, 390],
    [298, 466]
  ]);

// Per level. hp: hits a gremlin takes; save: seconds of ball save after each launch; kick: which
// outlanes carry a kickback (always relit, once per ball, never); divider: x of the post between
// outlane and inlane (further in = a wider, meaner outlane); heat: seconds of magnet before it
// overheats; cool: seconds to cool from full; par: the score a strong run reaches, for the medal;
// barf: green-target hits that fill the Barf-o-meter the first time (each heave after asks two more).
// Level 4 is Legendary: no ball save at any prescription, and the magnet is its only safety net, so it
// gets a full second of it.
const MAGNET_LEVELS = [
  {
    limit: 150, goal: 8, gravity: 700, hp: 3, save: 12, kick: 'always', divider: 42,
    drops: false, boss: false, multi: false, heat: 1.25, cool: 4, par: 30000, barf: 3
  },
  {
    limit: 180, goal: 15, gravity: 820, hp: 4, save: 7, kick: 'ball', divider: 48,
    drops: true, boss: false, multi: false, heat: 1, cool: 7, par: 45000, barf: 5
  },
  {
    limit: 210, goal: 22, gravity: 940, hp: 4, save: 5, kick: 'none', divider: 48,
    drops: true, boss: true, multi: true, heat: 0.9, cool: 9, par: 65000, barf: 8
  },
  {
    limit: 170, goal: 25, gravity: 1010, hp: 4, save: 0, kick: 'none', divider: 52,
    drops: true, boss: true, multi: true, heat: 1, cool: 9, par: 85000, barf: 10
  }
];

// The lobby note for Legendary. tests/smoke.cjs still expects exactly three tierNotes per game; once it
// counts miniTierCount(def) instead, this joins tierNotes as the fourth entry.
const MAGNET_LEGENDARY_NOTE = '170s · fastest ball · wide outlanes · no ball save · 25 evictions';

const MAGNET = registerGame({
  id: 1,
  canvas: { w: 800, h: 600 },
  portraitCanvas: { w: 450, h: 820 },
  layout: 'gesture',
  legendary: true,
  info: {
    game: 'Loud Donut Pinball',
    genre: 'PINBALL · FLIPPERS · MAGNET SAVES',
    headline: 'Flippers in the bore. Gremlins on the bumpers.',
    desc:
      'The gremlins moved into the MRI and turned it into a pinball table. Flip the steel softball into them until they move out. Hold both flippers to fire up the magnet and yank a doomed ball back up, until it overheats. Hit the green targets to fill the Barf-o-meter, and the gremlin living in the scanner throws up slime and a spare ball. Three balls. No metal allowed, except, apparently, this one.',
    goal: 'Evict the gremlin quota before your last ball drains.',
    control:
      'Left half of the screen is the left flipper, right half the right one: two thumbs. Hold both to fire the magnet. Swipe up to nudge. Tap to launch. Keys: Z or ← flips left, / or → flips right, Space launches, Shift or ↑ nudges. Mouse: click the left or right half.',
    avoid:
      'The gap between the flippers and the two outer lanes are drains. Nudge too often and it tilts. The magnet overheats after about a second, then needs a few to cool.',
    cue: 'Left half · right half · hold both = magnet · swipe up = nudge'
  },
  tierNotes: [
    '150s · three gremlin bumpers · kickbacks · long ball save',
    '180s · drop targets · faster ball · meaner outlanes',
    '210s · boss bumper · multiball · no kickbacks'
  ],
  shiftName: 'BALL',
  init() {
    initArcadeRun(MAGNET_LEVELS[mini.tier].limit);
    magnetInit();
  },
  controls() {
    setControls([
      { id: 'left', text: '◀ LEFT', key: 'Z' },
      { id: 'right', text: 'RIGHT ▶', key: '/' }
    ]);
  },
  update(dt) {
    updateArcade(dt, magnetUpdate);
  },
  draw(g) {
    magnetDraw(g);
  },
  overlay(g) {
    paintTransition(g);
  },
  // Every finger on the canvas, two at once included.
  touch(kind, p, id) {
    if (kind === 'down') magnetTouchDown(p, id);
    else if (kind === 'move') magnetTouchMove(p, id);
    else magnetTouchUp(id, kind === 'cancel');
  },
  action(a) {
    if (a !== 'left' && a !== 'right') return;
    const side = a === 'left' ? 0 : 1,
      last = mini.pinBtnLast;
    mini.pinBtnLast = null;
    const held = last && last.side === side && mini.pinButtons[last.id] === side ? last.id : null;
    if (magnetWaiting()) {
      // A held button pulls the plunger until it lifts; a click with no press to follow fires now.
      if (held !== null) magnetPullStart('button', held);
      else magnetLaunch(MAGNET_TAP_POWER);
      return;
    }
    mini.pinTapT[side] = 0.16;
  },
  assist() {
    mini.pinSave = Math.max(mini.pinSave, 12);
    mini.pinHeat = 0;
    mini.pinHot = false;
    mini.pinTilt = 0;
    mini.pinTilted = false;
    sfx('shield');
    magnetSay('BALL SAVE ARMED · 12 S · MAGNET COOLED', 2.2, '#a8f0ff');
    mini.flash = 1;
    mini.flashText = 'BALL SAVE ARMED · MAGNET COOLED';
  },
  key(k, e) {
    if (['arrowleft', 'z', 'arrowright', '/'].includes(k)) {
      e.preventDefault();
      keys.add(k);
      return true;
    }
    if (k === ' ') {
      e.preventDefault();
      keys.add(' ');
      if (!e.repeat && magnetWaiting()) magnetPullStart('key', ' ');
      return true;
    }
    if (k === 'shift' || k === 'arrowup') {
      e.preventDefault();
      if (!e.repeat) magnetNudge();
      return true;
    }
    return false;
  },
  shiftLevel: () => Math.min(2, mini.pinBallNo || 0),
  shiftMessage(shift) {
    return shift === 2
      ? 'FINAL BALL · make it count. Hold both flippers to save a drain.'
      : 'BALL 2 · tap to launch. Flip early, the ball is quicker than it looks.';
  },
  timeUp() {
    const met = mini.got >= mini.goal;
    if (met) magnetBankBonus();
    finishMini(
      met,
      met
        ? undefined
        : 'Scan time is up and the gremlins still have the lease. Keep the ball in the bore, and hold both flippers to save a drain.'
    );
  },
  lesson() {
    const i = MAGNET.info,
      lv = MAGNET_LEVELS[mini.tier],
      extra = [
        ' Kickbacks guard both outer lanes and every ball starts with a long ball save. Gremlins take 3 hits. Hit the green targets up top on the right 3 times to fill the Barf-o-meter, and the gremlin in the scanner throws up slime and a spare ball.',
        ' New: drop targets on the right. Knock all three down and every gremlin takes a hit. Gremlins take 4 hits, the ball is quicker, and the outer lanes are wider. The Barf-o-meter wants 5 green hits.',
        ' New: Clank, a boss gremlin in a metal bucket, slides across the top and counts for three. Clear the drop targets or ride the scan ramp three times for multiball. No kickbacks. The Barf-o-meter wants 8 green hits.',
        ' Legendary: the fastest ball, wide outer lanes, no kickbacks and no ball save, not even on Pillow Fort. Clank and multiball are back, the clock is shorter, and the Barf-o-meter wants 10 green hits. Most runs lose. That is the point.'
      ][mini.tier];
    return {
      title: i.game + ' · 3 balls · ' + lv.limit + ' s',
      goal: 'Evict ' + mini.goal + ' gremlins before your last ball drains.' + extra,
      control: i.control,
      avoid: i.avoid,
      demo: 'magnet',
      cue: i.cue
    };
  },
  statLabel: () => 'EVICTED / BALL',
  stat: () => mini.got + '/' + mini.goal + ' · ' + Math.min(3, (mini.pinBallNo || 0) + 1) + '/3',
  livesLabel: () => 'BALLS',
  lives: () => {
    const left = clamp((mini.pinSpare || 0) + (mini.pinOver ? 0 : 1), 0, 3);
    return ('● '.repeat(left) + '○ '.repeat(3 - left)).trim();
  },
  tactics: () =>
    `SCORE ${mini.score} · ×${mini.pinMult} · ${mini.pinRamps} SCANS · BARF ${mini.pinBarf}/${mini.pinBarfNeed} · MAGNET ${mini.pinHot ? 'HOT' : Math.round((1 - mini.pinHeat) * 100) + '%'}` +
    (mini.pinTilted ? ' · TILT' : ''),
  assistText: () => 'BALL SAVE · ' + mini.helps + ' (E)',
  // Quota overshoot, score against par and balls left drive the medal; drains, tilts and assists cost it.
  quality() {
    const lv = mini.pinLv,
      over = clamp((mini.got / mini.goal - 1) * 30, 0, 12),
      score = clamp(mini.score / lv.par, 0, 1.5) * 16;
    return Math.round(
      clamp(
        52 + over + score + mini.pinSpare * 6 + Math.min(6, mini.pinRamps * 2) + Math.min(6, mini.pinHeaves * 3) - mini.miss * 5 - mini.pinTilts * 8 - mini.helpUsed * 4,
        0,
        100
      )
    );
  },
  onWin() {
    const n = mini.pinEvicted,
      h = mini.pinHeaves,
      tail = mini.pinBossDown
        ? ' Clank and his bucket have been escorted out. Metal is not allowed in here.'
        : h
          ? ' The gremlin in the scanner threw up ' + (h === 1 ? 'once' : h === 2 ? 'twice' : h + ' times') + '. Housekeeping has filed a complaint.'
          : mini.pinMagSaves
            ? ' The magnet saved ' + mini.pinMagSaves + (mini.pinMagSaves === 1 ? ' ball.' : ' balls.') + ' Radiology wants it back.'
            : ' The MRI is legally a pinball machine now. Radiology is drafting a sign.';
    return `Lease terminated. ${n} gremlin${n === 1 ? '' : 's'} evicted, ${mini.pinRamps} scan${mini.pinRamps === 1 ? '' : 's'}.` + tail;
  },
  onLose(reason) {
    const tilted = mini.pinTilts > 0 && mini.pinTiltLost;
    for (let i = 0; i < 70; i++)
      gore.push({
        x: 400 + rand(-60, 60),
        y: 120,
        vx: rand(-300, 300),
        vy: rand(-240, 20),
        size: rand(3, 9),
        col: ['#8fd14f', '#6cb33b', '#b6ee6a', '#4f8f2c'][i % 4]
      });
    return {
      gory: false,
      medal: '☹',
      heading: tilted ? 'TILT. TILT. TILT.' : 'DRAINED.',
      text: tilted
        ? 'Nudged one time too many. Swipe up only when the ball is stuck or about to drain, and leave a couple of seconds between nudges.'
        : 'The gremlins renewed their lease. Flip when the ball reaches the fat end of the flipper, and hold both flippers to fire the magnet when it heads down the middle.'
    };
  },
  // A lost run: the gremlins throw a party on the scanner and the ball sits in the drain.
  resultArt(g) {
    if (mini.win) return false;
    for (const p of gore) ellipse(g, p.x, p.y, p.size * 0.7, p.size * 0.8, p.col);
    // The drain grate on the floor beside the bed, with the ball sitting in it.
    rr(g, 520, 172, 150, 38, 16, '#1d4252', '#7fb3c2', 2);
    for (let i = 0; i < 5; i++) line(g, [[542 + i * 26, 182], [542 + i * 26, 200]], '#0c2430', 5);
    magnetSteel(g, 595, 184, 14, 0.4);
    for (const [x, t] of [
      [250, 0],
      [480, 1],
      [720, 3]
    ])
      gremlin(g, x, 198, 1.1, t, time + x);
    rr(g, 36, 56, 156, 40, 10, '#fff2c4', '#2b2a1e', 2);
    label(g, 'LEASE RENEWED', 114, 82, 14, '#2b2a1e', 'center');
    label(g, 'GAME OVER', 400, 40, 22, '#ffb347', 'center');
    return true;
  },
  scene(g, w, h) {
    magnetScene(g, w, h);
  }
});

// ---- Geometry helpers ----
function magnetPath(pts) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(d);
    total += d;
  }
  return { pts, lens, total };
}

function magnetAlong(path, s) {
  let left = clamp(s, 0, path.total);
  for (let i = 0; i < path.lens.length; i++) {
    if (left <= path.lens[i] || i === path.lens.length - 1) {
      const u = path.lens[i] ? clamp(left / path.lens[i], 0, 1) : 1,
        a = path.pts[i],
        b = path.pts[i + 1];
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, dx: (b[0] - a[0]) / path.lens[i], dy: (b[1] - a[1]) / path.lens[i] };
    }
    left -= path.lens[i];
  }
  const n = path.pts.length - 1;
  return { x: path.pts[n][0], y: path.pts[n][1], dx: 0, dy: 1 };
}

function magnetSeg(ax, ay, bx, by, o = {}) {
  return { ax, ay, bx, by, r: 3, e: 0.45, kick: 0, tag: '', oneWay: null, ...o };
}

// The table for this level. Static colliders: segments (rails, walls, slingshots, drop targets, the
// one-way lane gate, the ramp mouth), the dome arc, and round posts. Bumpers and flippers move.
function magnetBuildTable(lv) {
  const segs = [],
    posts = [],
    arcs = [{ cx: 200, cy: 200, R: 186, a0: Math.PI, a1: Math.PI * 2, e: 0.3 }],
    D = lv.divider,
    wall = (pts, o) => {
      for (let i = 1; i < pts.length; i++) segs.push(magnetSeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], o));
    };
  // The ramp block on the upper left: its top deflects the left orbit back into play, its mouth
  // swallows a ball that arrives fast enough and bounces a slow one back out.
  wall([[14, 200], [14, 226], [68, 242], [66, 298]], { e: 0.4 });
  const mouth = magnetSeg(66, 298, 14, 342, { tag: 'ramp', e: 0.3 }),
    ml = Math.hypot(mouth.bx - mouth.ax, mouth.by - mouth.ay);
  // Outward normal (toward the playfield): down and to the right.
  mouth.nx = (mouth.by - mouth.ay) / ml;
  mouth.ny = -(mouth.bx - mouth.ax) / ml;
  segs.push(mouth);
  wall([[14, 342], [14, 762]]);
  // The plunger lane: outer wall, inner wall (the playfield's right wall), the one-way gate at the
  // top and the plunger tip at the bottom.
  wall([[386, 200], [386, 762]]);
  wall([[350, 300], [350, 762]]);
  segs.push(magnetSeg(386, 262, 350, 300, { oneWay: { nx: -0.726, ny: -0.688 }, e: 0.3, tag: 'gate' }));
  segs.push(magnetSeg(350, 702, 386, 702, { e: 0.05, tag: 'tip' }));
  // Outlane dividers, inlane guides and slingshots, mirrored about the playfield centre.
  for (const side of [0, 1]) {
    const X = x => (side ? 2 * MAGNET_CX - x : x);
    posts.push({ x: X(D), y: 470, R: 5, e: 0.55 });
    wall([[X(D), 470], [X(D), 572], [X(106), 622]], { e: 0.35 });
    const A = [X(84), 488],
      B = [X(84), 566],
      C = [X(118), 594];
    wall([A, B, C], { e: 0.5 });
    const face = magnetSeg(C[0], C[1], A[0], A[1], { tag: 'sling', side, kick: 290, e: 0.55 }),
      fl = Math.hypot(A[0] - C[0], A[1] - C[1]);
    // The kicking face points into the playfield (up and inward).
    face.nx = side ? -(A[1] - C[1]) / fl : (A[1] - C[1]) / fl;
    face.ny = side ? (A[0] - C[0]) / fl : -(A[0] - C[0]) / fl;
    if (face.nx * (MAGNET_CX - C[0]) < 0) {
      face.nx *= -1;
      face.ny *= -1;
    }
    segs.push(face);
    posts.push({ x: A[0], y: A[1], R: 4, e: 0.5 }, { x: C[0], y: C[1], R: 4, e: 0.5 });
  }
  // Top lane guides between M, R and I.
  for (const x of [112, 150, 188, 226]) wall([[x, 70], [x, 106]], { e: 0.5, r: 2.5 });
  // Drop targets (level 2 up): a bank of three on the right wall.
  if (lv.drops)
    MAGNET_DROP_Y.forEach((y, i) => segs.push(magnetSeg(MAGNET_DROP_X, y, MAGNET_DROP_X, y + 24, { r: 4, e: 0.4, tag: 'drop', drop: i })));
  // The Barf-o-meter standups. Only the face toward the bore counts a hit.
  MAGNET_BARF.forEach(([ax, ay, bx, by], i) => {
    const s = magnetSeg(ax, ay, bx, by, { r: 4, e: 0.5, tag: 'barf', barf: i }),
      l = Math.hypot(bx - ax, by - ay);
    s.nx = -(by - ay) / l;
    s.ny = (bx - ax) / l;
    if (s.nx * (MAGNET_BORE.x - ax) + s.ny * (MAGNET_BORE.y - ay) < 0) {
      s.nx *= -1;
      s.ny *= -1;
    }
    segs.push(s);
  });
  return { segs, posts, arcs };
}

// ---- Run setup ----
function magnetInit() {
  const base = MAGNET_LEVELS[mini.tier] || MAGNET_LEVELS[0],
    pace = (mini.rules && mini.rules.mini) || 1,
    lv = {
      ...base,
      gravity: base.gravity * Math.sqrt(pace),
      // Legendary has no ball save at any prescription.
      save: base.save ? base.save + (state.difficulty === 0 ? 4 : state.difficulty === 2 ? -1 : 0) : 0,
      heat: base.heat / Math.sqrt(pace)
    };
  mini.goal = lv.goal;
  Object.assign(mini, {
    pinLv: lv,
    pinT: magnetBuildTable(lv),
    pinBalls: [],
    pinBallSerial: 0,
    pinFlips: MAGNET_PIVOTS.map((p, side) => {
      const rest = side ? Math.PI - MAGNET_FLIP.rest : MAGNET_FLIP.rest,
        up = side ? Math.PI - MAGNET_FLIP.up : MAGNET_FLIP.up;
      return { side, x: p.x, y: p.y, a: rest, w: 0, rest, up, held: false, was: false, glow: 0 };
    }),
    pinAcc: 0,
    pinGrem: MAGNET_BUMPERS.map(b => ({ x: b.x, y: b.y, R: MAGNET_BUMPER_R, type: b.type, hp: lv.hp, max: lv.hp, cool: 0, flash: 0, gone: false, respawn: 0, pop: 0, boss: false })),
    pinBoss: lv.boss
      ? { x: MAGNET_BOSS.x, y: MAGNET_BOSS.y, vx: 0, vy: 0, R: MAGNET_BOSS.r, type: 2, hp: 10, max: 10, cool: 0, flash: 0, gone: false, respawn: 0, pop: 0, boss: true, phase: 0 }
      : null,
    pinLit: [false, false, false],
    pinLitFlash: 0,
    pinMult: 1,
    pinDrops: lv.drops ? [0, 1, 2].map(() => ({ up: true, flash: 0 })) : null,
    pinDropReset: 0,
    pinKick: [lv.kick !== 'none', lv.kick !== 'none'],
    pinKickT: [0, 0],
    pinKickFlash: [0, 0],
    pinSlingFlash: [0, 0],
    pinBallNo: 0,
    pinSpare: 2,
    pinOver: false,
    pinSave: 0,
    pinHeat: 0,
    pinHot: false,
    pinMagOn: false,
    pinBothT: 0,
    pinMagUses: 0,
    pinMagSaves: 0,
    pinTilt: 0,
    pinTilted: false,
    pinTilts: 0,
    pinTiltLost: false,
    pinNudgeCd: 0,
    pinNudges: 0,
    pinPull: null,
    pinTouches: {},
    pinButtons: {},
    pinBtnLast: null,
    pinTapT: [0, 0],
    pinUsedFlip: [false, false],
    pinRamps: 0,
    pinRampCount: 0,
    pinRampCombo: 0,
    pinBanks: 0,
    pinEvicted: 0,
    pinBossDown: false,
    pinMulti: false,
    pinAuto: 0,
    pinWait: 0,
    pinSkill: null,
    pinSkills: 0,
    pinCleared: false,
    pinLapT: 0,
    pinDrains: 0,
    pinShake: 0,
    pinPops: [],
    pinFx: [],
    pinSplats: [],
    pinMsg: null,
    pinBanked: false,
    // The Barf-o-meter: hits so far, hits it wants, each target's lamp and debounce, and the heave.
    pinBarf: 0,
    pinBarfNeed: lv.barf,
    pinBarfLamp: [0, 0, 0],
    pinBarfCd: [0, 0, 0],
    pinBarfFlash: 0,
    pinBarfHits: 0,
    pinHeave: null,
    pinHeaves: 0,
    pinHeaveFlash: 0
  });
  magnetServe(false);
}

// A new ball in the plunger lane. auto: launch it by itself (ball saves and multiball).
function magnetServe(auto) {
  const b = {
    id: mini.pinBallSerial++,
    x: MAGNET_LANE.x,
    y: MAGNET_LANE.y,
    vx: 0,
    vy: 0,
    state: 'plunger',
    spin: 0,
    rs: 0,
    still: 0,
    fresh: !auto,
    low: false
  };
  mini.pinBalls.push(b);
  mini.pinWait = 0;
  if (auto) mini.pinAuto = Math.max(mini.pinAuto, 0.6);
  else mini.pinSkill = { lane: Math.floor(rand(0, 3)), t: 0, armed: false };
  return b;
}

// ---- Input ----
// A ball in motion: on the playfield, riding the ramp, or hopping out of an outlane.
function magnetLive(b) {
  return b.state === 'play' || b.state === 'ramp' || b.state === 'hop';
}

function magnetWaiting() {
  return mini.screen === 'play' && mini.pinAuto <= 0 && mini.pinBalls.some(b => b.state === 'plunger') && !mini.pinBalls.some(magnetLive);
}

function magnetSide(p) {
  return p.x < activeCanvas().w / 2 ? 0 : 1;
}

function magnetTouchDown(p, id) {
  const t = { side: magnetSide(p), hist: [{ x: p.x, y: p.y, t: mini.total }], plunger: false, nudged: false };
  if (magnetWaiting()) {
    t.plunger = true;
    magnetPullStart('touch', id);
  }
  mini.pinTouches[id] = t;
}

// A quick upward swipe nudges, once per touch.
function magnetTouchMove(p, id) {
  const t = mini.pinTouches[id];
  if (!t) return;
  t.hist.push({ x: p.x, y: p.y, t: mini.total });
  while (t.hist.length > 2 && mini.total - t.hist[0].t > 0.22) t.hist.shift();
  const o = t.hist[0],
    dy = o.y - p.y,
    dx = Math.abs(p.x - o.x);
  if (!t.nudged && dy >= 40 && dy > dx * 1.2) {
    t.nudged = true;
    magnetNudge();
  }
}

function magnetTouchUp(id, cancel) {
  const t = mini.pinTouches[id];
  delete mini.pinTouches[id];
  if (!t || !t.plunger) return;
  const pull = mini.pinPull;
  if (!pull || pull.src !== 'touch' || pull.id !== id) return;
  if (cancel) mini.pinPull = null;
  else magnetPullRelease();
}

function magnetPullStart(src, id) {
  if (!magnetWaiting()) return;
  mini.pinPull = { src, id, t: 0 };
  sfx('pump');
}

// Power rises from a quick tap's to full over about two thirds of a second.
function magnetPullPower() {
  const p = mini.pinPull;
  return p ? clamp(MAGNET_TAP_POWER + (p.t / 0.65) * (1 - MAGNET_TAP_POWER), MAGNET_TAP_POWER, 1) : 0;
}

function magnetPullRelease() {
  const power = magnetPullPower();
  mini.pinPull = null;
  magnetLaunch(power);
}

function magnetLaunch(power) {
  const b = mini.pinBalls.find(b => b.state === 'plunger');
  if (!b) return false;
  b.state = 'play';
  b.x = MAGNET_LANE.x;
  b.y = MAGNET_LANE.y;
  b.vx = 0;
  b.vy = -(990 + 170 * clamp(power, 0, 1));
  b.still = 0;
  mini.pinWait = 0;
  if (b.fresh) {
    mini.pinSave = Math.max(mini.pinSave, mini.pinLv.save);
    b.fresh = false;
    if (mini.pinSkill) mini.pinSkill.armed = true;
  }
  sfx('shot', { pan: 0.7 });
  return true;
}

// Button presses: the framework reports the press (action) but not the release, so this capture
// listener follows LEFT and RIGHT pointers until they lift. Two held buttons work at once.
function magnetButtonEvent(e) {
  if (!mini.open || mini.screen !== 'play' || miniGame() !== MAGNET || !mini.pinButtons) return;
  if (e.type === 'pointerdown') {
    const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-action]') : null;
    if (!b || !b.closest('#miniControls') || mini.paused) return;
    const a = b.dataset.action;
    if (a !== 'left' && a !== 'right') return;
    const side = a === 'left' ? 0 : 1;
    mini.pinButtons[e.pointerId] = side;
    mini.pinBtnLast = { side, id: e.pointerId };
    return;
  }
  if (!(e.pointerId in mini.pinButtons)) return;
  delete mini.pinButtons[e.pointerId];
  const pull = mini.pinPull;
  if (pull && pull.src === 'button' && pull.id === e.pointerId) {
    if (e.type === 'pointerup') magnetPullRelease();
    else mini.pinPull = null;
  }
}

for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture'])
  window.addEventListener(type, magnetButtonEvent, true);

// Held presses never survive a pause; resuming would otherwise flip for a finger that has lifted.
function magnetDropHeld() {
  mini.pinTouches = {};
  mini.pinButtons = {};
  mini.pinBtnLast = null;
  mini.pinPull = null;
  mini.pinTapT = [0, 0];
}

function magnetHeld(side) {
  if (mini.pinTilted) return false;
  const keyed = side ? keys.has('arrowright') || keys.has('/') : keys.has('arrowleft') || keys.has('z');
  if (keyed || mini.pinTapT[side] > 0) return true;
  for (const id in mini.pinTouches) if (mini.pinTouches[id].side === side && !mini.pinTouches[id].plunger) return true;
  for (const id in mini.pinButtons) if (mini.pinButtons[id] === side && !(mini.pinPull && mini.pinPull.id === +id)) return true;
  return false;
}

function magnetNudge() {
  if (mini.screen !== 'play' || mini.pinNudgeCd > 0 || magnetHolding()) return;
  mini.pinNudgeCd = 0.3;
  const live = mini.pinBalls.filter(b => b.state === 'play');
  if (!live.length || mini.pinTilted) return;
  mini.pinNudges++;
  mini.pinTilt += 0.4;
  for (const b of live) {
    b.vy -= 210;
    b.vx += rand(-50, 50);
  }
  mini.pinShake = Math.max(mini.pinShake, 0.7);
  sfx('jump', { vol: 0.8 });
  if (mini.pinTilt >= 1) {
    mini.pinTilted = true;
    mini.pinTilts++;
    mini.pinMagOn = false;
    sfx('hurt');
    magnetSay('TILT · FLIPPERS OFF UNTIL IT DRAINS', 3, '#ff8a7a');
  } else if (mini.pinTilt >= 0.66) magnetSay('DANGER · EASE OFF THE NUDGES', 1.4, '#ffb0a0');
}

// ---- Simulation ----
function magnetUpdate(dt) {
  const lv = mini.pinLv;
  if (mini.pinHeave) magnetHeaveStep(dt);
  // The heave holds the table still: no ball, flipper, magnet, timer or clock moves until he has
  // coughed up the ball. Presses still register and act the moment it lets go.
  if (magnetHolding()) {
    mini.limit += dt;
    mini.pinMagOn = false;
    mini.pinBothT = 0;
    magnetLooks(dt);
    return;
  }
  for (const side of [0, 1]) mini.pinTapT[side] = Math.max(0, mini.pinTapT[side] - dt);
  // The plunger: a held key pulls until Space lifts.
  const pull = mini.pinPull;
  if (pull) {
    if (!magnetWaiting()) mini.pinPull = null;
    else {
      pull.t += dt;
      if (pull.src === 'key' && !keys.has(' ')) magnetPullRelease();
    }
  }
  // Flippers follow their inputs; a fresh press rotates the lit M-R-I lanes like a real table.
  for (const f of mini.pinFlips) {
    f.held = magnetHeld(f.side);
    if (f.held && !f.was) {
      mini.pinUsedFlip[f.side] = true;
      sfx('swing', { vol: 0.45, pan: f.side ? 0.4 : -0.4 });
      if (!magnetWaiting()) magnetRotateLanes(f.side ? 1 : -1);
    }
    f.was = f.held;
    f.glow = f.held ? 1 : Math.max(0, f.glow - dt * 6);
  }
  magnetUpdateMagnet(dt);
  mini.pinAcc = Math.min(mini.pinAcc + dt, 0.25);
  while (mini.pinAcc >= MAGNET_STEP - 1e-9) {
    mini.pinAcc -= MAGNET_STEP;
    magnetStep(MAGNET_STEP);
    if (mini.screen !== 'play') return;
    // A green hit that filled the meter stops the table mid-frame.
    if (magnetHolding()) break;
  }
  magnetTimers(dt, lv);
}

function magnetUpdateMagnet(dt) {
  const lv = mini.pinLv,
    both = mini.pinFlips[0].held && mini.pinFlips[1].held,
    live = mini.pinBalls.some(b => b.state === 'play');
  mini.pinBothT = both ? mini.pinBothT + dt : 0;
  const want = mini.pinBothT >= MAGNET_ARM && live && !mini.pinTilted;
  if (want && !mini.pinHot) {
    if (!mini.pinMagOn) {
      mini.pinMagUses++;
      sfx('powerup', { vol: 0.8 });
      for (const b of mini.pinBalls) if (b.state === 'play') b.low = b.y > 560 && b.vy > 0;
    }
    mini.pinMagOn = true;
    mini.pinHeat += dt / lv.heat;
    if (mini.pinHeat >= 1) {
      mini.pinHeat = 1;
      mini.pinHot = true;
      mini.pinMagOn = false;
      sfx('stun');
      magnetSay('MAGNET OVERHEATED · LET GO TO COOL', 1.8, '#ffb0a0');
    }
  } else {
    mini.pinMagOn = false;
    if (!want) {
      mini.pinHeat = Math.max(0, mini.pinHeat - dt / lv.cool);
      if (mini.pinHot && mini.pinHeat <= 0.2) {
        mini.pinHot = false;
        magnetSay('MAGNET READY', 1, '#a8f0ff');
      }
    }
  }
}

function magnetStep(h) {
  for (const f of mini.pinFlips) magnetFlipStep(f, h);
  const boss = mini.pinBoss;
  if (boss) {
    boss.phase += h;
    const w = (Math.PI * 2) / MAGNET_BOSS.period,
      nx = MAGNET_BOSS.x + Math.sin(boss.phase * w) * MAGNET_BOSS.swing;
    boss.vx = (nx - boss.x) / h;
    boss.x = nx;
  }
  for (const b of mini.pinBalls.slice()) {
    if (b.state === 'play') magnetBallStep(b, h);
    else if (b.state === 'ramp') magnetRampStep(b, h);
    else if (b.state === 'hop') magnetHopStep(b, h);
    if (mini.screen !== 'play') return;
  }
  magnetBallPairs();
}

function magnetFlipStep(f, h) {
  const target = f.held ? f.up : f.rest,
    gap = target - f.a;
  if (!gap) {
    f.w = 0;
    return;
  }
  const speed = f.held ? MAGNET_FLIP.wUp : MAGNET_FLIP.wDown,
    step = speed * h;
  if (Math.abs(gap) <= step) {
    f.w = gap / h;
    f.a = target;
  } else {
    f.w = Math.sign(gap) * speed;
    f.a += Math.sign(gap) * step;
  }
}

function magnetTip(f) {
  return { x: f.x + Math.cos(f.a) * MAGNET_FLIP.len, y: f.y + Math.sin(f.a) * MAGNET_FLIP.len };
}

function magnetBallStep(b, h) {
  const lv = mini.pinLv;
  let ax = 0,
    ay = lv.gravity;
  if (mini.pinMagOn) {
    // Toward the bore, mostly straight up: a ball deep in an outlane rises up the lane instead of
    // pinning itself under the inlane rail.
    const dx = (MAGNET_BORE.x - b.x) * 0.35,
      dy = MAGNET_BORE.y - b.y,
      d = Math.hypot(dx, dy) || 1;
    if (Math.abs(dy) > 24) {
      ax += (dx / d) * MAGNET_PULL;
      ay += (dy / d) * MAGNET_PULL;
    }
    const damp = Math.exp(-MAGNET_BRAKE * h);
    b.vx *= damp;
    b.vy *= damp;
  }
  b.vx += ax * h;
  b.vy += ay * h;
  const drag = 1 - 0.05 * h;
  b.vx *= drag;
  b.vy *= drag;
  const px = b.x,
    py = b.y;
  b.x += b.vx * h;
  b.y += b.vy * h;
  const T = mini.pinT;
  for (const s of T.segs) {
    if (s.drop !== undefined && !mini.pinDrops[s.drop].up) continue;
    if (magnetHitSeg(b, s) && b.state !== 'play') return;
  }
  for (const a of T.arcs) magnetHitArc(b, a);
  for (const p of T.posts) magnetHitPost(b, p);
  for (const gr of mini.pinGrem) if (!gr.gone) magnetHitBumper(b, gr);
  if (mini.pinBoss && !mini.pinBoss.gone) magnetHitBumper(b, mini.pinBoss);
  for (const f of mini.pinFlips) magnetHitFlipper(b, f);
  let sp = Math.hypot(b.vx, b.vy);
  if (sp > MAGNET_VMAX) {
    b.vx *= MAGNET_VMAX / sp;
    b.vy *= MAGNET_VMAX / sp;
    sp = MAGNET_VMAX;
  }
  b.spin += (sp * h) / MAGNET_BALL;
  magnetSensors(b, px, py, h, sp);
}

// Moves the ball out of a contact and reflects its velocity relative to the surface (vcx, vcy is
// the surface's own velocity). Slow contacts neither bounce nor scrub speed, so a ball rolls along
// a rail or a flipper instead of sticking to it. Returns the impact speed.
function magnetResolve(b, nx, ny, pen, e, vcx = 0, vcy = 0, fr = 0.015) {
  b.x += nx * pen;
  b.y += ny * pen;
  const rvx = b.vx - vcx,
    rvy = b.vy - vcy,
    vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const hard = -vn >= 35,
    ee = hard ? e : 0,
    keep = hard ? 1 - fr : 1,
    tx = rvx - vn * nx,
    ty = rvy - vn * ny;
  b.vx = vcx + tx * keep - ee * vn * nx;
  b.vy = vcy + ty * keep - ee * vn * ny;
  return -vn;
}

function magnetHitSeg(b, s) {
  const dx = s.bx - s.ax,
    dy = s.by - s.ay,
    L2 = dx * dx + dy * dy,
    u = clamp(((b.x - s.ax) * dx + (b.y - s.ay) * dy) / L2, 0, 1),
    cx = s.ax + dx * u,
    cy = s.ay + dy * u,
    rad = MAGNET_BALL + s.r;
  let nx = b.x - cx,
    ny = b.y - cy;
  const d2 = nx * nx + ny * ny;
  if (d2 >= rad * rad) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    const L = Math.sqrt(L2);
    nx = -dy / L;
    ny = dx / L;
  } else {
    nx /= d;
    ny /= d;
  }
  if (s.oneWay) {
    const o = s.oneWay;
    if ((b.x - s.ax) * o.nx + (b.y - s.ay) * o.ny < 0 || b.vx * o.nx + b.vy * o.ny >= 0) return false;
  }
  if (s.tag === 'ramp' && nx * s.nx + ny * s.ny > 0) {
    const inward = -(b.vx * s.nx + b.vy * s.ny);
    if (inward >= MAGNET_RAMP_MIN && !mini.pinTilted) {
      magnetRampEnter(b);
      return true;
    }
  }
  const impact = magnetResolve(b, nx, ny, rad - d, s.e);
  if (s.tag === 'sling' && impact > 70 && nx * s.nx + ny * s.ny > 0.6) magnetSling(b, s);
  else if (s.tag === 'drop' && impact > 40) magnetDropHit(s.drop);
  else if (s.tag === 'barf' && impact > 50 && nx * s.nx + ny * s.ny > 0.3) magnetBarfHit(s.barf);
  return true;
}

// The dome: a concave arc the ball rides around the inside of.
function magnetHitArc(b, a) {
  if (b.y > a.cy) return false;
  const dx = b.x - a.cx,
    dy = b.y - a.cy,
    d = Math.hypot(dx, dy),
    lim = a.R - MAGNET_BALL;
  if (d <= lim) return false;
  magnetResolve(b, -dx / d, -dy / d, d - lim, a.e, 0, 0, 0.004);
  return true;
}

function magnetHitPost(b, p) {
  const dx = b.x - p.x,
    dy = b.y - p.y,
    rad = MAGNET_BALL + p.R,
    d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad) return false;
  const d = Math.sqrt(d2) || 1e-6;
  magnetResolve(b, dx / d, dy / d, rad - d, p.e);
  return true;
}

// Pop bumpers kick the ball away. Each gremlin takes a few hits, then moves out.
function magnetHitBumper(b, gr) {
  const dx = b.x - gr.x,
    dy = b.y - gr.y,
    rad = MAGNET_BALL + gr.R,
    d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad) return false;
  const d = Math.sqrt(d2) || 1e-6,
    nx = dx / d,
    ny = dy / d;
  magnetResolve(b, nx, ny, rad - d, 0.75, gr.vx || 0, 0);
  const out = b.vx * nx + b.vy * ny,
    kick = gr.boss ? 360 : 300;
  if (out < kick) {
    b.vx += nx * (kick - out);
    b.vy += ny * (kick - out);
  }
  if (gr.cool <= 0) {
    // A live bumper never kicks quite the same way twice.
    const j = rand(-40, 40);
    b.vx -= ny * j;
    b.vy += nx * j;
    magnetBumperHit(gr, 1, b);
  }
  return true;
}

// Flippers are tapered capsules from the pivot to the tip. A moving flipper hands the ball the
// surface speed at the contact point, which is what makes a flip a flip.
function magnetHitFlipper(b, f) {
  const t = magnetTip(f),
    dx = t.x - f.x,
    dy = t.y - f.y,
    L2 = dx * dx + dy * dy,
    u = clamp(((b.x - f.x) * dx + (b.y - f.y) * dy) / L2, 0, 1),
    cx = f.x + dx * u,
    cy = f.y + dy * u,
    rad = MAGNET_BALL + MAGNET_FLIP.rp + (MAGNET_FLIP.rt - MAGNET_FLIP.rp) * u;
  let nx = b.x - cx,
    ny = b.y - cy;
  const d2 = nx * nx + ny * ny;
  if (d2 >= rad * rad) return false;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d;
  ny /= d;
  const rx = cx - f.x,
    ry = cy - f.y;
  magnetResolve(b, nx, ny, rad - d, MAGNET_FLIP.e, -f.w * ry, f.w * rx, 0.02);
  return true;
}

function magnetBallPairs() {
  const live = mini.pinBalls.filter(b => b.state === 'play');
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i],
        c = live[j],
        dx = c.x - a.x,
        dy = c.y - a.y,
        d = Math.hypot(dx, dy),
        min = MAGNET_BALL * 2;
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d,
        ny = dy / d,
        pen = (min - d) / 2;
      a.x -= nx * pen;
      a.y -= ny * pen;
      c.x += nx * pen;
      c.y += ny * pen;
      const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rel >= 0) continue;
      const imp = (-(1 + 0.9) * rel) / 2;
      a.vx -= nx * imp;
      a.vy -= ny * imp;
      c.vx += nx * imp;
      c.vy += ny * imp;
      sfx('hit', { vol: 0.5 });
    }
}

function magnetSensors(b, px, py, h, sp) {
  // Rollover lanes at the top.
  if ((py - MAGNET_ROLL_Y) * (b.y - MAGNET_ROLL_Y) <= 0 && py !== b.y) {
    const i = MAGNET_ROLL_X.findIndex(x => Math.abs(b.x - x) < 18);
    if (i >= 0) magnetRollover(i);
  }
  // Kickbacks at the foot of each outlane. Below the inlane rails everything outside the flippers is
  // outlane, including a ball that drifted in under the rail.
  if (py < MAGNET_KICK_Y && b.y >= MAGNET_KICK_Y && b.vy > 0) {
    const side = b.x < 98 ? 0 : b.x > 2 * MAGNET_CX - 98 && b.x < MAGNET_LANE.x0 ? 1 : -1;
    if (side >= 0 && mini.pinKick[side] && !mini.pinTilted) magnetKickback(b, side);
  }
  // Magnet saves: a ball that was heading for the drain when the magnet fired and made it back up.
  if (b.low && b.y < 480) {
    b.low = false;
    mini.pinMagSaves++;
    mini.score += 500;
    magnetPop(b.x, b.y - 20, 'MAGNET SAVE', '#a8f0ff');
    magnetSay('SAVED BY SCIENCE', 1.2, '#a8f0ff');
  }
  // A ball that fell back down the lane waits for another launch.
  if (b.x > MAGNET_LANE.x0 && b.y > 640 && sp < 25) {
    b.state = 'plunger';
    b.x = MAGNET_LANE.x;
    b.y = MAGNET_LANE.y;
    b.vx = b.vy = 0;
    return;
  }
  // Anything stuck for five seconds gets a polite shove (a ball cradled on a raised flipper is fine).
  const cradled = mini.pinFlips.some(f => f.held && Math.abs(b.y - f.y) < 40 && Math.abs(b.x - f.x) < 80);
  b.still = sp < 12 && !cradled ? b.still + h : 0;
  if (b.still > 5) {
    b.still = 0;
    b.vx = rand(-160, 160);
    b.vy = -420;
  }
  if (b.y > MAGNET_DRAIN_Y || b.x < -20 || b.x > MAGNET_W + 20 || b.y < -40) magnetDrain(b);
}

function magnetRampEnter(b) {
  b.state = 'ramp';
  b.rs = 0;
  b.low = false;
  sfx('dash');
  magnetPop(40, 290, 'SCAN', '#a8f0ff');
}

function magnetRampStep(b, h) {
  b.rs += MAGNET_RAMP_SPEED * h;
  const p = magnetAlong(MAGNET_RAMP, b.rs);
  b.x = p.x;
  b.y = p.y;
  b.spin += (MAGNET_RAMP_SPEED * h) / MAGNET_BALL;
  if (b.rs < MAGNET_RAMP.total) return;
  b.state = 'play';
  b.vx = p.dx * 380;
  b.vy = p.dy * 380;
  b.still = 0;
  magnetRampDone(b);
}

// A kickback hop: a short arc from the outlane to the top of the inlane.
function magnetHopStep(b, h) {
  const k = b.hop;
  k.t += h;
  const u = clamp(k.t / k.dur, 0, 1);
  b.x = k.x0 + (k.x1 - k.x0) * u;
  b.y = k.y0 + (k.y1 - k.y0) * u - Math.sin(u * Math.PI) * 90;
  b.spin += h * 20;
  if (u < 1) return;
  b.state = 'play';
  b.hop = null;
  b.vx = 0;
  b.vy = 120;
  b.still = 0;
}

// ---- Scoring ----
function magnetPoints(n) {
  const v = Math.round(n * mini.pinMult * (mini.pinCleared ? 2 : 1));
  mini.score += v;
  return v;
}

function magnetBumperHit(gr, dmg, b) {
  if (mini.pinTilted) return;
  gr.cool = 0.1;
  gr.flash = 0.2;
  gr.hp -= dmg;
  const pan = clamp((gr.x - MAGNET_CX) / 180, -1, 1);
  if (gr.hp > 0) {
    // Multiball doubles bumper hits.
    const v = magnetPoints((gr.boss ? 250 : 100) * (mini.pinMulti ? 2 : 1));
    magnetPop(gr.x, gr.y - gr.R - 8, '+' + v, gr.boss ? '#ffcf8f' : '#fff2c4');
    sfx(gr.boss ? 'bossHit' : 'bounce', { pan });
    mini.pinShake = Math.max(mini.pinShake, gr.boss ? 0.5 : 0.25);
    return;
  }
  magnetEvict(gr, pan);
}

function magnetEvict(gr, pan = 0) {
  gr.gone = true;
  gr.hp = 0;
  gr.respawn = gr.boss ? 25 : 2.4;
  const count = gr.boss ? 3 : 1;
  mini.got += count;
  mini.pinEvicted += count;
  if (gr.boss) mini.pinBossDown = true;
  const before = mini.score;
  praise((gr.boss ? 5000 : 1000) * mini.pinMult * (mini.pinCleared ? 2 : 1), 1);
  magnetPop(gr.x, gr.y - 10, gr.boss ? 'CLANK EVICTED +' + (mini.score - before) : 'EVICTED +' + (mini.score - before), '#c9ffb0');
  mini.pinSplats.push({ x: gr.x, y: gr.y, t: 3, s: gr.boss ? 1.5 : 1 });
  magnetBurst(gr.x, gr.y, '#9be15d', gr.boss ? 40 : 22);
  mini.pinShake = Math.max(mini.pinShake, gr.boss ? 1.4 : 0.8);
  sfx(gr.boss ? 'bossDie' : 'squelch', { pan });
  const left = Math.max(0, mini.goal - mini.got);
  if (gr.boss) magnetSay('CLANK IS OUT · TELL RADIOLOGY', 2.2, '#c9ffb0');
  else magnetSay(left ? 'GREMLIN EVICTED · ' + left + ' TO GO' : 'GREMLIN EVICTED', 1.4, '#c9ffb0');
  mini.flash = 0.6;
  mini.flashText = gr.boss ? 'CLANK EVICTED' : 'GREMLIN EVICTED';
  magnetCheckQuota();
}

function magnetCheckQuota() {
  if (mini.pinCleared || mini.got < mini.goal) return;
  mini.pinCleared = true;
  mini.pinLapT = 30;
  sfx('clear');
  magnetSay('QUOTA MET · VICTORY LAP · SCORES DOUBLE', 3, '#ffe08a');
  setInstructions('Quota met. Victory lap: every point doubles until this ball drains or 30 seconds pass.');
}

function magnetSling(b, s) {
  b.vx += s.nx * s.kick;
  b.vy += s.ny * s.kick;
  mini.pinSlingFlash[s.side] = 0.14;
  mini.pinShake = Math.max(mini.pinShake, 0.2);
  if (!mini.pinTilted) magnetPoints(10);
  sfx('ricochet', { vol: 0.7, pan: s.side ? 0.5 : -0.5 });
}

function magnetRollover(i) {
  if (mini.pinTilted) return;
  const sk = mini.pinSkill;
  if (sk && sk.armed && sk.t < 3.5) {
    mini.pinSkill = null;
    if (sk.lane === i) {
      mini.pinSkills++;
      const v = magnetPoints(2500);
      magnetPop(MAGNET_ROLL_X[i], 70, 'SKILL SHOT +' + v, '#ffe08a');
      magnetSay('SKILL SHOT', 1.4, '#ffe08a');
      sfx('combo', { combo: 4 });
    }
  }
  if (mini.pinLit[i]) {
    magnetPoints(50);
    return;
  }
  mini.pinLit[i] = true;
  magnetPoints(200);
  sfx('coin', { count: mini.pinLit.filter(Boolean).length });
  if (mini.pinLit.every(Boolean)) {
    mini.pinMult = Math.min(5, mini.pinMult + 1);
    const v = magnetPoints(1000);
    magnetPop(169, 70, 'M · R · I  ×' + mini.pinMult, '#ffe08a');
    magnetSay('SCAN COMPLETE · BONUS ×' + mini.pinMult + ' · +' + v, 1.8, '#ffe08a');
    mini.pinLitFlash = 0.7;
    sfx('combo', { combo: mini.pinMult });
  }
}

function magnetRotateLanes(dir) {
  if (mini.pinLitFlash > 0) return;
  const L = mini.pinLit;
  mini.pinLit = dir > 0 ? [L[2], L[0], L[1]] : [L[1], L[2], L[0]];
}

function magnetRampDone(b) {
  if (mini.pinTilted) return;
  mini.pinRamps++;
  mini.pinRampCount++;
  const combo = mini.pinRampCombo > 0;
  mini.pinRampCombo = 5;
  const v = magnetPoints(combo ? 3000 : 1500);
  magnetPop(b.x, b.y - 26, (combo ? 'COMBO SCAN +' : 'SCAN +') + v, '#a8f0ff');
  sfx('combo', { combo: combo ? 3 : 1 });
  // The scan pulses through the bore: every gremlin takes a hit.
  magnetPulse('SCAN PULSE · EVERY GREMLIN TAKES A HIT');
  if (mini.pinLv.multi && mini.pinRampCount >= 3) {
    mini.pinRampCount = 0;
    magnetMultiball();
  }
}

function magnetPulse(text) {
  magnetSay(text, 1.6, '#a8f0ff');
  for (const gr of [...mini.pinGrem, mini.pinBoss]) {
    if (!gr || gr.gone || mini.screen !== 'play') continue;
    magnetBurst(gr.x, gr.y, '#a8f0ff', 6);
    magnetBumperHit(gr, 1, null);
  }
}

function magnetDropHit(i) {
  const d = mini.pinDrops && mini.pinDrops[i];
  if (!d || !d.up || mini.pinTilted) return;
  d.up = false;
  d.flash = 0.3;
  magnetPoints(300);
  magnetPop(MAGNET_DROP_X - 16, MAGNET_DROP_Y[i] + 12, '+' + 300 * mini.pinMult, '#ffd27a');
  sfx('lock');
  if (mini.pinDrops.some(t => t.up)) return;
  mini.pinBanks++;
  const v = magnetPoints(2000);
  magnetPop(MAGNET_DROP_X - 30, MAGNET_DROP_Y[1] - 20, 'BANK +' + v, '#ffd27a');
  sfx('unlock');
  mini.pinDropReset = 1.6;
  if (mini.pinLv.multi && !mini.pinMulti) magnetMultiball();
  else magnetPulse('CONTRAST DYE · EVERY GREMLIN TAKES A HIT');
}

function magnetMultiball() {
  if (mini.pinMulti) return;
  mini.pinMulti = true;
  mini.pinSave = Math.max(mini.pinSave, 8);
  magnetServe(true);
  sfx('fever');
  magnetSay('MULTIBALL · TWO BALLS · BUMPERS SCORE DOUBLE', 2.4, '#ffe08a');
  mini.flash = 1;
  mini.flashText = 'MULTIBALL';
}

// ---- The Barf-o-meter and the heave ----
// True while the heave holds the table still (he climbs, retches, spews, coughs up the ball).
function magnetHolding() {
  return !!mini.pinHeave && mini.pinHeave.t < MAGNET_HEAVE_HOLD;
}

// Where the heave is: {name, u} with u running 0 to 1 through the phase, or null with none on.
function magnetHeavePhase(h = mini.pinHeave) {
  if (!h) return null;
  let t = h.t;
  for (const name of ['climb', 'retch', 'spew', 'spit', 'sink']) {
    if (t < MAGNET_HEAVE[name]) return { name, u: t / MAGNET_HEAVE[name] };
    t -= MAGNET_HEAVE[name];
  }
  return { name: 'sink', u: 1 };
}

// A green target took a hit from the front: one notch on the Barf-o-meter. Full, he heaves.
function magnetBarfHit(i) {
  if (mini.pinTilted || mini.pinBarfCd[i] > 0) return;
  mini.pinBarfCd[i] = 0.3;
  mini.pinBarfLamp[i] = 0.5;
  mini.pinBarfFlash = 0.45;
  mini.pinBarfHits++;
  magnetPoints(250);
  mini.pinBarf = Math.min(mini.pinBarfNeed, mini.pinBarf + 1);
  const [ax, ay, bx, by] = MAGNET_BARF[i],
    left = mini.pinBarfNeed - mini.pinBarf;
  magnetPop((ax + bx) / 2 - 30, (ay + by) / 2, left ? mini.pinBarf + '/' + mini.pinBarfNeed : 'FULL', '#c9ffb0');
  sfx('blob', { pan: 0.5 });
  if (mini.pinHeave) return;
  if (!left) magnetHeaveStart();
  else if (left === 1) magnetSay('ONE MORE GREEN · HE IS GONNA BLOW', 1.6, '#c9ffb0');
  else magnetSay('BARF-O-METER ' + mini.pinBarf + '/' + mini.pinBarfNeed, 1, '#c9ffb0');
}

function magnetHeaveStart() {
  mini.pinHeaves++;
  mini.pinBarf = 0;
  // Each heave after the first asks two more hits.
  mini.pinBarfNeed = mini.pinLv.barf + mini.pinHeaves * 2;
  mini.pinHeave = { t: 0, n: mini.pinHeaves, wave: MAGNET_BORE.y, slimed: [] };
  mini.pinMagOn = false;
  mini.pinHeaveFlash = 0.8;
  mini.pinShake = Math.max(mini.pinShake, 0.7);
  sfx('clear');
  sfx('blob', { vol: 1.2 });
  magnetSay('SLIME TIME · HE IS COMING OUT', 2.2, '#c9ffb0');
  mini.flash = 1;
  mini.flashText = 'SLIME TIME';
}

// The heave's clock: retches, the slime wave (it pays, and every gremlin it reaches takes a hit), the
// cough, then the extra ball as the table lets go, and the sink back into the bore.
function magnetHeaveStep(dt) {
  const h = mini.pinHeave,
    H = MAGNET_HEAVE,
    B = MAGNET_BORE,
    was = h.t,
    retch = H.climb,
    spew = retch + H.retch,
    spit = spew + H.spew,
    cross = s => was < s && h.t >= s;
  h.t += dt;
  for (const [at, text] of [
    [retch + 0.1, 'HURK'],
    [retch + 0.55, 'HUUURK']
  ])
    if (cross(at)) {
      sfx('organ', { vol: 1.3 });
      mini.pinShake = Math.max(mini.pinShake, 0.45);
      magnetPop(B.x, B.y - 74, text, '#c9ffb0');
    }
  if (cross(spew)) {
    sfx('wallSplat');
    sfx('wave');
    mini.pinShake = Math.max(mini.pinShake, 1.5);
    mini.pinHeaveFlash = 1;
    const v = magnetPoints(5000 * h.n);
    sfx('coin');
    magnetPop(B.x, B.y + 70, 'SLIME +' + v, '#c9ffb0');
    magnetSay('SLIME TIME · +' + magnetComma(v), 2, '#c9ffb0');
  }
  if (h.t >= spew && was < spit) {
    h.wave = B.y + clamp((h.t - spew) / H.spew, 0, 1) * (MAGNET_H + 20 - B.y);
    for (const gr of [...mini.pinGrem, mini.pinBoss]) {
      if (!gr || gr.gone || h.slimed.includes(gr) || gr.y - gr.R > h.wave) continue;
      h.slimed.push(gr);
      magnetBurst(gr.x, gr.y, '#9be15d', 10);
      magnetBumperHit(gr, 1, null);
    }
  }
  if (cross(spit)) {
    sfx('squelch');
    magnetPop(B.x, B.y - 80, 'HACK', '#fff2c4');
    for (let i = 0; i < 6; i++) mini.pinSplats.push({ x: rand(60, 320), y: rand(330, 600), t: 2.6, s: rand(0.8, 1.4) });
  }
  if (cross(MAGNET_HEAVE_HOLD)) magnetHeaveBall(h);
  if (h.t >= MAGNET_HEAVE_HOLD + H.sink) {
    mini.pinHeave = null;
    if (mini.pinBarf >= mini.pinBarfNeed) magnetHeaveStart();
  }
}

// His mouth on the table at size s (where the stream starts and the ball comes out).
function magnetHeaveMouth(s) {
  return { x: MAGNET_BORE.x + 2 * s, y: MAGNET_BORE.y + 12 * s };
}

// He coughs up a ball: it hops out of the bore to the top of an inlane (the sides take turns) and rolls
// down to a flipper. With three balls already out he pays again instead.
function magnetHeaveBall(h) {
  if (mini.pinBalls.length >= 3) {
    const v = magnetPoints(5000 * h.n);
    magnetPop(MAGNET_BORE.x, MAGNET_BORE.y - 40, 'NO ROOM · +' + v, '#c9ffb0');
    sfx('coin');
    return null;
  }
  const D = mini.pinLv.divider,
    inlane = h.n % 2 ? (D + 84) / 2 : 2 * MAGNET_CX - (D + 84) / 2,
    m = magnetHeaveMouth(MAGNET_HEAVE_SIZE),
    b = {
      id: mini.pinBallSerial++,
      x: m.x,
      y: m.y,
      vx: 0,
      vy: 0,
      state: 'hop',
      spin: 0,
      rs: 0,
      still: 0,
      fresh: false,
      low: false,
      hop: { x0: m.x, y0: m.y, x1: inlane, y1: 492, t: 0, dur: 0.75 }
    };
  mini.pinBalls.push(b);
  mini.pinMulti = true;
  if (mini.pinLv.save) mini.pinSave = Math.max(mini.pinSave, 6);
  sfx('fever');
  magnetSay('EXTRA BALL · MULTIBALL', 2.2, '#ffe08a');
  mini.flash = 1;
  mini.flashText = 'EXTRA BALL';
  return b;
}

// The kickback hops the ball out of the outlane, over the divider post, and drops it at the top of the
// inlane on the same side, where it rolls down onto the flipper.
function magnetKickback(b, side) {
  const D = mini.pinLv.divider,
    inlane = side ? 2 * MAGNET_CX - (D + 84) / 2 : (D + 84) / 2;
  b.state = 'hop';
  b.hop = { x0: b.x, y0: b.y, x1: inlane, y1: 492, t: 0, dur: 0.42 };
  b.vx = b.vy = 0;
  mini.pinKick[side] = false;
  mini.pinKickFlash[side] = 0.5;
  if (mini.pinLv.kick === 'always') mini.pinKickT[side] = 6;
  magnetPoints(200);
  sfx('leap', { pan: side ? 0.7 : -0.7 });
  magnetSay('KICKBACK', 1, '#ffd27a');
}

function magnetDrain(b) {
  b.state = 'gone';
  mini.pinBalls = mini.pinBalls.filter(x => x !== b);
  const others = mini.pinBalls.some(x => magnetLive(x) || x.state === 'plunger');
  if (mini.pinSave > 0 && !mini.pinTilted) {
    sfx('shield');
    magnetSay('BALL SAVED · THE TECH THREW IT BACK', 1.6, '#a8f0ff');
    magnetServe(true);
    return;
  }
  if (others) {
    sfx('miss', { vol: 0.6 });
    if (mini.pinBalls.filter(x => x.state !== 'gone').length < 2) mini.pinMulti = false;
    return;
  }
  // The last ball in play is gone.
  mini.pinMulti = false;
  mini.pinDrains++;
  mini.combo = 0;
  if (mini.pinCleared) {
    magnetBankBonus();
    finishMini(true);
    return;
  }
  mini.miss++;
  mini.quality = Math.max(0, mini.quality - 12);
  if (mini.pinTilted) mini.pinTiltLost = true;
  sfx('miss');
  mini.pinShake = Math.max(mini.pinShake, 0.6);
  if (mini.pinSpare <= 0) {
    mini.pinOver = true;
    finishMini(
      false,
      mini.pinTilted
        ? 'Tilted out on the last ball. Nudge only when the ball is stuck or diving, a couple of seconds apart.'
        : 'Last ball down the drain with ' + Math.max(0, mini.goal - mini.got) + ' gremlins still on the lease. Flip early, aim for the bumpers, and hold both flippers to fire the magnet when it heads down the middle.'
    );
    return;
  }
  mini.pinSpare--;
  mini.pinBallNo++;
  mini.pinTilted = false;
  mini.pinTilt = 0;
  mini.pinSave = 0;
  mini.pinMult = 1;
  if (mini.pinLv.kick !== 'none') mini.pinKick = [true, true];
  magnetSay(mini.pinSpare ? 'BALL ' + (mini.pinBallNo + 1) + ' · TAP TO LAUNCH' : 'FINAL BALL · TAP TO LAUNCH', 2.2, '#ffb347');
  magnetServe(false);
}

// Unused balls pay out when the quota is met.
function magnetBankBonus() {
  if (mini.pinBanked) return;
  mini.pinBanked = true;
  if (mini.pinSpare > 0) mini.score += mini.pinSpare * 2500;
}

function magnetTimers(dt, lv) {
  for (const gr of [...mini.pinGrem, mini.pinBoss]) {
    if (!gr) continue;
    gr.cool = Math.max(0, gr.cool - dt);
    if (!gr.gone) continue;
    gr.respawn -= dt;
    const blocked = mini.pinBalls.some(b => b.state === 'play' && Math.hypot(b.x - gr.x, b.y - gr.y) < gr.R + MAGNET_BALL + 6);
    if (gr.respawn <= 0 && !blocked) {
      gr.gone = false;
      if (gr.boss) gr.max += 2;
      gr.hp = gr.max;
      gr.pop = 0.35;
      gr.type = gr.boss ? 2 : (gr.type + 1) % 4 === 2 ? (gr.type + 2) % 4 : (gr.type + 1) % 4;
      sfx(gr.boss ? 'boss' : 'blob', { vol: 0.6 });
      if (gr.boss) magnetSay('CLANK IS BACK · AND ANGRIER', 1.6, '#ffcf8f');
    }
  }
  const inPlay = mini.pinBalls.some(magnetLive);
  if (inPlay) mini.pinSave = Math.max(0, mini.pinSave - dt);
  mini.pinNudgeCd = Math.max(0, mini.pinNudgeCd - dt);
  mini.pinTilt = Math.max(0, mini.pinTilt - dt * 0.22);
  mini.pinRampCombo = Math.max(0, mini.pinRampCombo - dt);
  mini.pinLitFlash = Math.max(0, mini.pinLitFlash - dt);
  if (mini.pinLitFlash <= 0 && mini.pinLit.every(Boolean)) mini.pinLit = [false, false, false];
  for (let i = 0; i < 3; i++) mini.pinBarfCd[i] = Math.max(0, mini.pinBarfCd[i] - dt);
  for (const side of [0, 1]) {
    if (mini.pinKickT[side] > 0) {
      mini.pinKickT[side] -= dt;
      if (mini.pinKickT[side] <= 0) mini.pinKick[side] = true;
    }
  }
  if (mini.pinDrops) {
    if (mini.pinDropReset > 0) {
      mini.pinDropReset -= dt;
      if (mini.pinDropReset <= 0) {
        for (const d of mini.pinDrops) d.up = true;
        sfx('reload', { vol: 0.6 });
      }
    }
  }
  if (mini.pinSkill && mini.pinSkill.armed) mini.pinSkill.t += dt;
  if (mini.pinAuto > 0) {
    mini.pinAuto -= dt;
    if (mini.pinAuto <= 0) magnetLaunch(0.55);
  }
  if (mini.pinBalls.some(b => b.state === 'plunger') && !inPlay) mini.pinWait += dt;
  magnetLooks(dt);
  // Ball trails for the art.
  for (const b of mini.pinBalls) {
    if (!magnetLive(b)) {
      b.trail = [];
      continue;
    }
    (b.trail ||= []).push({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.shift();
  }
  if (mini.pinCleared) {
    mini.pinLapT -= dt;
    if (mini.pinLapT <= 0 && mini.screen === 'play') {
      magnetBankBonus();
      finishMini(true);
    }
  }
}

// Clocks that only drive the art: they keep running while the heave holds the table.
function magnetLooks(dt) {
  for (const gr of [...mini.pinGrem, mini.pinBoss]) {
    if (!gr) continue;
    gr.flash = Math.max(0, gr.flash - dt);
    gr.pop = Math.max(0, gr.pop - dt);
  }
  mini.pinShake = Math.max(0, mini.pinShake - dt * 3);
  mini.pinBarfFlash = Math.max(0, mini.pinBarfFlash - dt);
  mini.pinHeaveFlash = Math.max(0, mini.pinHeaveFlash - dt * 2.2);
  for (let i = 0; i < 3; i++) mini.pinBarfLamp[i] = Math.max(0, mini.pinBarfLamp[i] - dt);
  for (const side of [0, 1]) {
    mini.pinSlingFlash[side] = Math.max(0, mini.pinSlingFlash[side] - dt);
    mini.pinKickFlash[side] = Math.max(0, mini.pinKickFlash[side] - dt);
  }
  if (mini.pinDrops) for (const d of mini.pinDrops) d.flash = Math.max(0, d.flash - dt);
  for (const p of mini.pinPops) p.t -= dt;
  mini.pinPops = mini.pinPops.filter(p => p.t > 0);
  for (const p of mini.pinFx) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
  }
  mini.pinFx = mini.pinFx.filter(p => p.life > 0);
  for (const s of mini.pinSplats) s.t -= dt;
  mini.pinSplats = mini.pinSplats.filter(s => s.t > 0);
  if (mini.pinMsg) {
    mini.pinMsg.t -= dt;
    if (mini.pinMsg.t <= 0) mini.pinMsg = null;
  }
}

function magnetPop(x, y, text, col) {
  if (mini.pinPops.some(p => p.text === text && p.t > 0.6)) return;
  mini.pinPops.push({ x, y, text, col, t: 0.9 });
}

function magnetSay(text, t = 1.5, col = '#ffb347') {
  mini.pinMsg = { text, t, col };
}

function magnetBurst(x, y, col, n) {
  for (let i = 0; i < n; i++)
    mini.pinFx.push({ x, y, vx: rand(-160, 160), vy: rand(-220, 80), life: rand(0.3, 0.7), col, r: rand(2, 4.5) });
}

// ---- Drawing ----
// Where the table sits in the active canvas: under a score strip in portrait, between two panels
// in landscape. The top 50 px stay decorative for the HUD pills.
function magnetView() {
  const { w, h } = activeCanvas();
  if (h > w) {
    const top = 98,
      s = Math.min((w - 20) / MAGNET_W, (h - top - 4) / MAGNET_H);
    return { s, ox: (w - MAGNET_W * s) / 2, oy: h - 4 - MAGNET_H * s, w, h, tall: true };
  }
  const s = (h - 54) / MAGNET_H;
  return { s, ox: (w - MAGNET_W * s) / 2, oy: 50, w, h, tall: false };
}

function magnetDraw(g) {
  if (mini.paused) magnetDropHeld();
  if (!mini.pinT) return;
  const V = magnetView(),
    shake = reduced ? 0 : mini.pinShake;
  magnetRoom(g, V);
  g.save();
  g.translate(V.ox + Math.sin(mini.total * 83) * shake * 5, V.oy + Math.cos(mini.total * 71) * shake * 4);
  g.scale(V.s, V.s);
  magnetTable(g);
  // The heave's table-wide flash (softer under reduced motion).
  if (mini.pinHeaveFlash > 0) {
    g.globalAlpha = Math.min(1, mini.pinHeaveFlash) * (reduced ? 0.15 : 0.42);
    rr(g, 0, 0, MAGNET_W, MAGNET_H + 30, 20, '#e4ffc4');
    g.globalAlpha = 1;
  }
  g.restore();
  if (V.tall) magnetStrip(g, V);
  else magnetPanels(g, V);
  magnetHints(g, V);
}

// The radiology room and the scanner's housing around the table.
function magnetRoom(g, V) {
  rect(g, 0, 0, V.w, V.h, gradient(g, 0, 0, 0, V.h, '#10283a', '#07141f'));
  if (!V.tall) {
    for (let y = 70; y < V.h; y += 34) line(g, [[0, y], [V.w, y]], '#d1ecdc08', 1);
    glow(g, V.w / 2, V.h * 0.45, V.h * 0.75, mini.pinMagOn ? '#7fe3ff2a' : '#7dbddb14');
  }
  const x = V.ox - 12 * V.s,
    w = MAGNET_W * V.s + 24 * V.s,
    y = V.tall ? 6 : V.oy - 16 * V.s,
    h = V.h - y - 2;
  rr(g, x, y, w, h, 26, gradient(g, x, y, w, h, '#e9efe0', '#8fb1b7'), '#5f8c9d', 2);
  rr(g, x + 5, y + 5, w - 10, h - 10, 22, null, '#ffffff55', 1.5);
  if (V.tall) label(g, 'BRRR 3000', V.w / 2, 40, 10, '#597f8e', 'center');
}

function magnetTable(g) {
  const lv = mini.pinLv,
    magOn = mini.pinMagOn,
    D = lv.divider;
  // Playfield.
  path(
    g,
    p => {
      p.moveTo(14, 722);
      p.lineTo(14, 200);
      p.arc(200, 200, 186, Math.PI, Math.PI * 2);
      p.lineTo(386, 722);
      p.closePath();
    },
    gradient(g, 0, 0, 0, 720, '#1d5068', '#0d2533')
  );
  // The donut: coils around the bore, lit when the magnet fires.
  const B = MAGNET_BORE;
  g.beginPath();
  g.arc(B.x, B.y, 140, 0, Math.PI * 2);
  g.arc(B.x, B.y, 92, 0, Math.PI * 2, true);
  g.fillStyle = magOn ? '#2f7f99' : '#245a6e';
  g.fill();
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2 + (magOn ? mini.total * 3 : 0),
      c = Math.cos(a),
      s = Math.sin(a);
    line(g, [[B.x + c * 98, B.y + s * 98], [B.x + c * 134, B.y + s * 134]], magOn ? (k % 2 ? '#a8f0ff' : '#5fc3dd') : k % 2 ? '#3a7b90' : '#2c6679', 5);
  }
  ellipse(g, B.x, B.y, 92, 92, gradient(g, B.x - 92, B.y - 92, 184, 184, '#0f3346', '#06161f'));
  for (let r = 30; r < 92; r += 20) {
    g.strokeStyle = '#7fd0e012';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(B.x, B.y, r, 0, Math.PI * 2);
    g.stroke();
  }
  if (magOn) glow(g, B.x, B.y, 170, '#7fe3ff40');
  label(g, 'NO METAL · NO CHILL', B.x, B.y + 125, 9, '#a9d6dc88', 'center');
  magnetBarfRing(g);
  // Lower inserts: up arrows toward the bore and the SAVE light between the flippers.
  for (let k = 0; k < 3; k++) {
    const y = 470 + k * 26,
      lit = (mini.total * 2 - k * 0.3 + 3) % 1.5 < 0.5;
    poly(g, [[MAGNET_CX, y - 10], [MAGNET_CX + 12, y + 4], [MAGNET_CX - 12, y + 4]], lit ? '#ffd27a88' : '#ffd27a22');
  }
  const save = mini.pinSave > 0 && (mini.pinSave > 2 || Math.sin(mini.total * 16) > 0);
  ellipse(g, MAGNET_CX, 604, 15, 11, save ? '#7fe08a' : '#16343f');
  if (save) glow(g, MAGNET_CX, 604, 34, '#7fe08a55');
  label(g, 'SAVE', MAGNET_CX, 607, 8, save ? '#123222' : '#4c6f78', 'center');
  // Rollover lane letters.
  MAGNET_ROLL_X.forEach((x, i) => {
    const lit = mini.pinLit[i] && (mini.pinLitFlash <= 0 || Math.sin(mini.total * 30) > 0),
      skill = mini.pinSkill && !mini.pinSkill.armed && mini.pinSkill.lane === i && Math.sin(mini.total * 10) > 0;
    if (lit) glow(g, x, 124, 26, '#ffe08a66');
    ellipse(g, x, 124, 10, 10, lit ? '#ffe08a' : '#163a4b');
    if (skill) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, 124, 13, 0, Math.PI * 2);
      g.stroke();
    }
    label(g, 'MRI'[i], x, 128, 11, lit ? '#3a2a10' : '#8fb8c4', 'center');
  });
  if (mini.pinMult > 1) label(g, '×' + mini.pinMult, 248, 128, 12, '#ffe08a', 'center');
  // Ramp block and mouth.
  poly(g, [[14, 200], [14, 226], [68, 242], [66, 298], [14, 342]], '#123a4c');
  const hot = mini.pinRampCombo > 0 && Math.sin(mini.total * 12) > 0;
  for (let k = 0; k < 3; k++) {
    const x = 46 - k * 9,
      y = 306 - k * 15;
    poly(g, [[x - 12, y + 4], [x, y - 10], [x + 6, y + 8]], hot ? '#a8f0ff' : '#a8f0ff44');
  }
  label(g, 'SCAN', 40, 262, 10, '#a8f0ffaa', 'center');
  // Splats from evictions.
  for (const s of mini.pinSplats) magnetSplatArt(g, s);
  // Rails, walls, slingshots.
  magnetRails(g);
  for (const side of [0, 1]) {
    const X = x => (side ? 2 * MAGNET_CX - x : x),
      fl = mini.pinSlingFlash[side] > 0;
    poly(g, [[X(84), 488], [X(84), 566], [X(118), 594]], '#2c5d6e');
    line(g, [[X(118), 594], [X(84), 488]], fl ? '#fff3cd' : '#ef929d', 7);
    rr(g, X(94) - 3, 538, 6, 18, 2, '#d9e6d0aa');
    rr(g, X(94) - 9, 544, 18, 6, 2, '#d9e6d0aa');
    // Kickback lights in the outlanes.
    if (lv.kick !== 'none') {
      const x = side ? (2 * MAGNET_CX - D + MAGNET_LANE.x0) / 2 : (14 + D) / 2,
        lit = mini.pinKick[side],
        f = mini.pinKickFlash[side] > 0;
      if (lit || f) glow(g, x, 600, 22, '#ffd27a55');
      poly(g, [[x, 588], [x + 8, 602], [x - 8, 602]], f ? '#fff3cd' : lit ? '#ffd27a' : '#2b4a55');
      rr(g, x - 3, 602, 6, 9, 2, f ? '#fff3cd' : lit ? '#ffd27a' : '#2b4a55');
    }
  }
  for (const p of mini.pinT.posts) {
    ellipse(g, p.x, p.y, p.R + 1.5, p.R + 1.5, '#ef929d');
    ellipse(g, p.x, p.y, p.R * 0.5, p.R * 0.5, '#fff3cd');
  }
  // Drop targets.
  if (mini.pinDrops)
    mini.pinDrops.forEach((d, i) => {
      const y = MAGNET_DROP_Y[i];
      if (d.up) {
        rr(g, MAGNET_DROP_X - 5, y, 10, 24, 3, d.flash > 0 ? '#ffffff' : '#f1cf85', '#6b4a1e', 1.2);
        rr(g, MAGNET_DROP_X - 5, y - 2, 10, 5, 2, '#e8eef0');
      } else rr(g, MAGNET_DROP_X - 5, y + 18, 10, 6, 2, d.flash > 0 ? '#ffffff' : '#0d2533', '#3c5d68', 1);
    });
  magnetBarfBankArt(g);
  // Bumpers.
  for (const gr of mini.pinGrem) magnetBumperArt(g, gr);
  if (mini.pinBoss) magnetBumperArt(g, mini.pinBoss);
  // Plunger lane.
  rect(g, MAGNET_LANE.x0 + 2, 300, MAGNET_LANE.x1 - MAGNET_LANE.x0 - 4, 420, '#0b202c');
  const waiting = magnetWaiting();
  for (let k = 0; k < 4; k++) {
    const y = 640 - k * 34,
      lit = waiting && (mini.total * 3 - k * 0.25 + 2) % 1 < 0.4;
    poly(g, [[MAGNET_LANE.x, y - 9], [MAGNET_LANE.x + 9, y + 3], [MAGNET_LANE.x - 9, y + 3]], lit ? '#ffb347' : '#ffb3472a');
  }
  const py = 703 + (mini.pinPull ? magnetPullPower() * 13 : 0);
  for (let k = 0; k < 4; k++) line(g, [[MAGNET_LANE.x - 7, py + 3 + k * 4], [MAGNET_LANE.x + 7, py + 5 + k * 4]], '#9fb7bd', 1.5);
  rr(g, MAGNET_LANE.x - 8, py - 2, 16, 6, 2, '#e3ecd6');
  // Ramp track (elevated, translucent) and the gate.
  const riding = mini.pinBalls.some(b => b.state === 'ramp');
  line(g, MAGNET_RAMP.pts, '#06141c55', 30);
  line(g, MAGNET_RAMP.pts, riding ? '#7fd0e055' : '#7fd0e026', 24);
  line(g, MAGNET_RAMP.pts, '#d9f3ff40', 2);
  line(g, [[386, 262], [350, 300]], '#9fc8e8', 3);
  // Flippers.
  for (const f of mini.pinFlips) magnetFlipperArt(g, f);
  // Balls on the playfield, the magnet's pull, then balls on the ramp above everything.
  for (const b of mini.pinBalls) {
    if (b.state === 'ramp' || b.state === 'hop') continue;
    if (b.trail)
      b.trail.forEach((p, i) => {
        g.globalAlpha = ((i + 1) / b.trail.length) * 0.16;
        ellipse(g, p.x, p.y, MAGNET_BALL * 0.8, MAGNET_BALL * 0.8, magOn ? '#a8f0ff' : '#e9f2ef');
      });
    g.globalAlpha = 1;
    if (magOn && b.state === 'play') magnetFieldArt(g, b);
    magnetSteel(g, b.x, b.y, MAGNET_BALL, b.spin);
  }
  // The heave: the slime wave and the gremlin over the table, then anything in the air above him.
  magnetHeaveArt(g);
  for (const b of mini.pinBalls) {
    if (b.state !== 'ramp' && b.state !== 'hop') continue;
    ellipse(g, b.x + 7, b.y + 9, MAGNET_BALL, MAGNET_BALL * 0.8, '#04121b66');
    magnetSteel(g, b.x, b.y, MAGNET_BALL * 1.15, b.spin);
  }
  // Particles and score pops.
  for (const p of mini.pinFx) {
    g.globalAlpha = Math.min(1, p.life * 3);
    ellipse(g, p.x, p.y, p.r, p.r, p.col);
  }
  g.globalAlpha = 1;
  for (const p of mini.pinPops) {
    g.globalAlpha = Math.min(1, p.t * 3);
    const y = p.y - (0.9 - p.t) * 34;
    label(g, p.text, p.x + 1, y + 1, 12, '#06141c', 'center');
    label(g, p.text, p.x, y, 12, p.col, 'center');
  }
  g.globalAlpha = 1;
  magnetApron(g);
}

function magnetRails(g) {
  const T = mini.pinT,
    skip = s => s.tag === 'drop' || s.tag === 'ramp' || s.tag === 'gate' || s.tag === 'tip' || s.tag === 'sling';
  for (const s of T.segs) if (!skip(s)) line(g, [[s.ax, s.ay], [s.bx, s.by]], '#08202b', s.r * 2 + 4);
  for (const s of T.segs) if (!skip(s)) line(g, [[s.ax, s.ay], [s.bx, s.by]], '#d9e6d0', s.r * 2 + 0.5);
  for (const a of T.arcs) {
    path(g, p => p.arc(a.cx, a.cy, a.R + 2, a.a0, a.a1), null, '#08202b', 8);
    path(g, p => p.arc(a.cx, a.cy, a.R + 2, a.a0, a.a1), null, '#d9e6d0', 4);
  }
  line(g, [[14, 342], [66, 298]], '#a8f0ff', 3);
}

function magnetBumperArt(g, gr) {
  const { x, y, R } = gr;
  if (gr.gone) {
    ellipse(g, x, y, R - 2, R - 2, '#0a1d27');
    g.strokeStyle = '#3c5d68';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, R - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - clamp(gr.respawn / (gr.boss ? 25 : 2.4), 0, 1)));
    g.stroke();
    label(g, 'VACANT', x, y + 3, 7, '#6f8f98', 'center');
    return;
  }
  const grow = gr.pop > 0 ? 1 - gr.pop / 0.35 : 1,
    hit = gr.flash > 0;
  ellipse(g, x + 2, y + 5, R + 1, R * 0.75, '#04121b66');
  if (hit) glow(g, x, y, R * 2.2, gr.boss ? '#ffcf8f77' : '#fff2c477');
  ellipse(g, x, y, R, R, hit ? '#fff6d8' : gr.boss ? '#f3a35c' : '#ef929d');
  ellipse(g, x, y, R - 4, R - 4, hit ? '#ffe9b8' : '#24485a');
  const s = (R / 42) * grow;
  g.save();
  g.translate(x, y + R * 0.52 * grow);
  if (hit) g.scale(1.12, 0.86);
  gremlin(g, 0, 0, s, gr.type, time * (gr.boss ? 0.7 : 1) + x * 0.01);
  if (gr.boss) {
    // Clank's bucket: metal, in an MRI. Bold.
    poly(g, [[-17 * s, -40 * s], [17 * s, -40 * s], [13 * s, -60 * s], [-13 * s, -60 * s]], '#b9c6cc');
    rr(g, -19 * s, -43 * s, 38 * s, 5 * s, 2, '#8a9aa1');
    line(g, [[-8 * s, -56 * s], [8 * s, -56 * s]], '#e8eef0', 1.5);
  }
  g.restore();
  if (gr.boss) {
    // A health pill under Clank, clear of the lane letters above him.
    const w = 56,
      top = y + R + 3;
    rr(g, x - w / 2, top, w, 12, 6, '#0b202c', '#ffcf8f', 1);
    rr(g, x - w / 2 + 1.5, top + 1.5, (w - 3) * clamp(gr.hp / gr.max, 0, 1), 9, 4.5, '#f3a35c');
    label(g, 'CLANK', x, top + 9.5, 8, '#fff2c4', 'center');
    return;
  }
  // Hits left.
  const w = gr.max * 7;
  for (let k = 0; k < gr.max; k++) ellipse(g, x - w / 2 + 3.5 + k * 7, y + R + 6, 2.6, 2.6, k < gr.hp ? '#fff2c4' : '#2b4a55');
}

function magnetSplatArt(g, s) {
  g.globalAlpha = Math.min(1, s.t / 1.2) * 0.85;
  for (let i = 0; i < 7; i++) {
    const ang = i * 2.4,
      d = i ? 12 + (i % 3) * 8 : 0,
      r = (i ? 6 + (i % 2) * 4 : 14) * s.s;
    ellipse(g, s.x + Math.cos(ang) * d * s.s, s.y + Math.sin(ang) * d * s.s * 0.8, r, r * 0.8, i % 2 ? '#7cc244' : '#8fd14f');
  }
  g.globalAlpha = 1;
}

// The Barf-o-meter: a segmented ring around the donut, one notch per green hit, lit clockwise from the
// upper left and skipping the arc the ramp block hides. As it fills, the bore turns green and his eyes
// show in the dark. While he heaves, every notch strobes.
function magnetBarfRing(g) {
  const B = MAGNET_BORE,
    need = mini.pinBarfNeed,
    holding = magnetHolding(),
    have = holding ? need : mini.pinBarf,
    frac = have / need,
    a0 = (-155 * Math.PI) / 180,
    span = (318 * Math.PI) / 180,
    step = span / need,
    gap = Math.min(0.06, step * 0.3),
    strobe = holding && Math.sin(mini.total * 22) > 0;
  if (frac > 0 && !mini.pinHeave) ellipse(g, B.x, B.y, 92, 92, `rgba(143, 209, 79, ${0.05 + 0.13 * frac})`);
  for (let k = 0; k < need; k++) {
    const lit = k < have,
      fresh = lit && k === have - 1 && mini.pinBarfFlash > 0 && !holding,
      a = a0 + k * step + gap / 2,
      b = a0 + (k + 1) * step - gap / 2;
    path(g, p => p.arc(B.x, B.y, 147, a, b), null, '#071a10', 12);
    path(g, p => p.arc(B.x, B.y, 147, a, b), null, fresh || strobe ? '#f2ffd8' : lit ? '#8fd14f' : '#1d3b2a', 7);
  }
  if (have && !holding) {
    const k = have - 1,
      a = a0 + (k + 0.5) * step;
    glow(g, B.x + Math.cos(a) * 147, B.y + Math.sin(a) * 147, mini.pinBarfFlash > 0 ? 34 : 18, '#9be15d66');
  }
  // Two eyes in the dark once the meter is half full; one hit away they glow and blink faster.
  if (!mini.pinHeave && frac >= 0.5) {
    const close = need - have <= 1,
      blink = Math.sin(mini.total * (close ? 5 : 2.2)) > 0.93,
      y = B.y - 2 + Math.sin(mini.total * 3) * 2;
    if (close) glow(g, B.x, y, 34, '#9be15d44');
    for (const side of [-1, 1]) {
      ellipse(g, B.x + side * 8, y, 5.5, blink ? 0.8 : 4.5, close ? '#f2ffd8' : '#c9e8b0aa');
      if (!blink) ellipse(g, B.x + side * 8 + 1, y + 1, 2, 2.4, '#2c5a1e');
    }
  }
}

// The green standups, their lamps (a slow chase, bright on a hit or when one hit is left) and the name.
function magnetBarfBankArt(g) {
  const close = !mini.pinHeave && mini.pinBarfNeed - mini.pinBarf <= 1;
  mini.pinT.segs.forEach(s => {
    if (s.tag !== 'barf') return;
    const i = s.barf,
      hit = mini.pinBarfLamp[i] > 0,
      chase = (mini.total * (close ? 4 : 1.2) - i * 0.33 + 3) % 1 < 0.33,
      mx = (s.ax + s.bx) / 2,
      my = (s.ay + s.by) / 2;
    line(g, [[s.ax - s.nx * 5, s.ay - s.ny * 5], [s.bx - s.nx * 5, s.by - s.ny * 5]], '#0b2a14', 12);
    line(g, [[s.ax, s.ay], [s.bx, s.by]], '#2c5a1e', 11);
    line(g, [[s.ax, s.ay], [s.bx, s.by]], hit ? '#f2ffd8' : '#8fd14f', 7);
    line(g, [[s.ax + s.nx * 2, s.ay + s.ny * 2], [mx + s.nx * 2, my + s.ny * 2]], '#ffffff66', 1.5);
    const lx = mx + s.nx * 20,
      ly = my + s.ny * 20,
      on = hit || chase;
    if (on) glow(g, lx, ly, hit ? 22 : 13, '#9be15d55');
    ellipse(g, lx, ly, 5, 5, hit ? '#f2ffd8' : on ? '#9be15d' : '#1d3b2a');
  });
  rr(g, 264, 126, 90, 21, 8, '#0f2a17', '#8fd14f', 1.5);
  label(g, 'BARF-O-METER', 309, 141, 10, '#c9ffb0', 'center');
}

function magnetEaseBack(u) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
}

// The heave on the table: the slime wave washing down, the gremlin out of the bore with his claws on
// the rim, his retching, the stream, and the ball he coughs up.
function magnetHeaveArt(g) {
  const h = mini.pinHeave,
    p = magnetHeavePhase(h);
  if (!p) return;
  const B = MAGNET_BORE,
    S = MAGNET_HEAVE_SIZE;
  let s = S,
    sx = 1,
    sy = 1,
    t = 0;
  if (p.name === 'climb') {
    s = S * (0.12 + 0.88 * magnetEaseBack(p.u));
    t = mini.total * 2;
  } else if (p.name === 'sink') s = S * (1 - p.u);
  if (p.name === 'retch') {
    const k = Math.sin(p.u * Math.PI * 4);
    sx = 1 + 0.1 * k;
    sy = 1 - 0.12 * k;
  } else if (p.name === 'spew') {
    sx = 1.05;
    sy = 0.96 + 0.03 * Math.sin(mini.total * 30);
  } else if (p.name === 'spit') {
    const k = Math.sin(p.u * Math.PI);
    sx = 1 + 0.12 * k;
    sy = 1 - 0.1 * k;
  }
  if (p.name === 'spew' || p.name === 'spit' || p.name === 'sink') magnetSlimeArt(g, h.wave, p.name === 'sink' ? 1 - p.u : 1);
  if (s < 0.05) return;
  const grow = s / S;
  glow(g, B.x, B.y, 130 * grow, '#9be15d44');
  ellipse(g, B.x, B.y + 6, 70 * grow, 22 * grow, '#04121b88');
  // Claws on the rim of the bore.
  for (const side of [-1, 1]) {
    const cx = B.x + side * 84 * grow,
      cy = B.y - 6;
    ellipse(g, cx, cy, 11 * grow, 7 * grow, '#b5da81');
    for (let k = -1; k <= 1; k++) line(g, [[cx + k * 5 * grow, cy - 3 * grow], [cx + k * 6 * grow, cy - 11 * grow]], '#61967c', 2.5 * grow);
  }
  g.save();
  g.translate(B.x, B.y + 24 * s);
  g.scale(sx, sy);
  gremlin(g, 0, 0, s, 0, t);
  if (p.name === 'retch' || p.name === 'spit') {
    // Green around the gills.
    ellipse(g, -10 * s, -18 * s, 6 * s, 3.5 * s, '#6cb33bbb');
    ellipse(g, 10 * s, -18 * s, 6 * s, 3.5 * s, '#6cb33bbb');
  }
  if (p.name === 'spew') ellipse(g, 2 * s, -12 * s, 9 * s, 7 * s, '#3a2030');
  if (p.name === 'spit') {
    ellipse(g, -13 * s, -15 * s, 7 * s, 6 * s, '#b5da81');
    ellipse(g, 15 * s, -15 * s, 7 * s, 6 * s, '#b5da81');
    if (p.u > 0.35) magnetSteel(g, 2 * s, -12 * s, MAGNET_BALL, p.u * 6);
  }
  g.restore();
  if (p.name === 'spew') {
    // The stream from his mouth down to the wave front.
    const m = magnetHeaveMouth(s),
      end = Math.max(m.y + 30, h.wave),
      wob = Math.sin(mini.total * 24) * 10;
    path(g, q => {
      q.moveTo(m.x, m.y);
      q.bezierCurveTo(m.x + wob, m.y + 50, B.x - wob, end - 60, B.x, end);
    }, null, '#6cb33b', 22);
    path(g, q => {
      q.moveTo(m.x, m.y);
      q.bezierCurveTo(m.x + wob, m.y + 50, B.x - wob, end - 60, B.x, end);
    }, null, '#b6ee6a', 9);
    for (let k = 0; k < 8; k++) {
      const u = (k / 8 + mini.total * 2.4) % 1,
        y = m.y + (end - m.y) * u,
        x = B.x + Math.sin(u * 9 + mini.total * 14) * 16;
      ellipse(g, x, y, 4 + (k % 3), 4 + (k % 3), k % 2 ? '#d3df7e' : '#8fd14f');
    }
  }
}

// The slime wave: a green wash from the bore down to its wobbling front, bubbles along the edge.
function magnetSlimeArt(g, front, fade) {
  const top = MAGNET_BORE.y - 20,
    edge = x => front + Math.sin(x * 0.09 + mini.total * 10) * 7;
  if (front <= top || fade <= 0) return;
  g.globalAlpha = 0.55 * fade;
  path(
    g,
    q => {
      q.moveTo(14, top);
      q.lineTo(350, top);
      for (let x = 350; x >= 14; x -= 14) q.lineTo(x, edge(x));
      q.closePath();
    },
    gradient(g, 0, top, 0, front - top, '#8fd14f22', '#8fd14fcc')
  );
  g.globalAlpha = 0.9 * fade;
  for (let k = 0; k < 14; k++) {
    const x = 24 + k * 24 + Math.sin(k * 3.1) * 6;
    ellipse(g, x, edge(x) - 2, 3.5 + (k % 3), 3.5 + (k % 3), k % 2 ? '#b6ee6a' : '#d3df7e');
  }
  g.globalAlpha = 1;
}

function magnetFlipperArt(g, f) {
  const t = magnetTip(f),
    nx = -Math.sin(f.a),
    ny = Math.cos(f.a),
    { rp, rt } = MAGNET_FLIP,
    shape = (grow, col) => {
      poly(
        g,
        [
          [f.x + nx * (rp + grow), f.y + ny * (rp + grow)],
          [t.x + nx * (rt + grow), t.y + ny * (rt + grow)],
          [t.x - nx * (rt + grow), t.y - ny * (rt + grow)],
          [f.x - nx * (rp + grow), f.y - ny * (rp + grow)]
        ],
        col
      );
      ellipse(g, f.x, f.y, rp + grow, rp + grow, col);
      ellipse(g, t.x, t.y, rt + grow, rt + grow, col);
    };
  if (f.glow > 0) glow(g, (f.x + t.x) / 2, (f.y + t.y) / 2, 52, `rgba(165, 226, 201, ${0.35 * f.glow})`);
  shape(2, '#123c3a');
  shape(0, mini.pinTilted ? '#6f8790' : f.held ? '#c6f3df' : '#a5e2c9');
  line(g, [[f.x - nx * 3, f.y - ny * 3], [t.x - nx * 1.5, t.y - ny * 1.5]], '#ffffff88', 2);
  ellipse(g, f.x, f.y, 3, 3, '#2b6a64');
}

function magnetFieldArt(g, b) {
  const B = MAGNET_BORE,
    k = (mini.total * 2.5) % 1;
  line(g, [[b.x, b.y], [(b.x + B.x) / 2 + Math.sin(mini.total * 20) * 6, (b.y + B.y) / 2], [B.x, B.y]], '#a8f0ff55', 2);
  for (const r of [k, (k + 0.5) % 1]) {
    g.strokeStyle = `rgba(168, 240, 255, ${0.7 * (1 - r)})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(b.x, b.y, MAGNET_BALL + 4 + r * 22, 0, Math.PI * 2);
    g.stroke();
  }
  glow(g, b.x, b.y, 30, '#a8f0ff55');
}

// The steel softball: chrome with red stitches. Metal in an MRI, which nobody is mentioning.
function magnetSteel(g, x, y, r, spin) {
  ellipse(g, x + 2, y + 3, r, r * 0.9, '#04121b55');
  ellipse(g, x, y, r, r, gradient(g, x - r, y - r, r * 2, r * 2, '#f7fbf8', '#6f8790'));
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  path(
    g,
    p => {
      p.moveTo(-r * 0.55, -r * 0.75);
      p.quadraticCurveTo(r * 0.05, 0, -r * 0.55, r * 0.75);
      p.moveTo(r * 0.55, -r * 0.75);
      p.quadraticCurveTo(-r * 0.05, 0, r * 0.55, r * 0.75);
    },
    null,
    '#d9534f',
    Math.max(1, r * 0.15)
  );
  g.restore();
  ellipse(g, x - r * 0.35, y - r * 0.4, r * 0.32, r * 0.22, '#ffffffcc');
}

// Apron plates under the flippers: the magnet's heat on the right, the ball or the tilt on the left.
function magnetApron(g) {
  poly(g, [[14, 664], [148, 700], [148, 722], [14, 722]], '#d6e2d4');
  poly(g, [[350, 664], [216, 700], [216, 722], [350, 722]], '#d6e2d4');
  line(g, [[14, 664], [148, 700]], '#7fa3ac', 2);
  line(g, [[350, 664], [216, 700]], '#7fa3ac', 2);
  const heat = mini.pinHeat,
    col = mini.pinHot ? '#ff8a7a' : mini.pinMagOn ? '#7fe3ff' : '#3fa8c4';
  label(g, mini.pinHot ? 'MAGNET HOT' : mini.pinMagOn ? 'MAGNET ON' : 'MAGNET', 336, 694, 10, mini.pinHot ? '#b8404a' : '#2c5b6b', 'right');
  rr(g, 228, 700, 110, 12, 5, '#0b202c');
  rr(g, 229, 701, 108 * (1 - heat), 10, 4, col);
  if (mini.pinTilt > 0.05 || mini.pinTilted) {
    label(g, mini.pinTilted ? 'TILT' : 'NUDGE', 28, 694, 10, mini.pinTilted ? '#b8404a' : '#7a5a20');
    rr(g, 28, 700, 100, 12, 5, '#0b202c');
    rr(g, 29, 701, 98 * clamp(mini.pinTilt, 0, 1), 10, 4, mini.pinTilted ? '#ff8a7a' : '#ffb347');
  } else {
    label(g, 'LOUD DONUT', 28, 694, 10, '#2c5b6b');
    label(g, 'BALL ' + Math.min(3, mini.pinBallNo + 1) + ' OF 3', 28, 710, 10, '#2c5b6b');
  }
}

function magnetComma(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Portrait: a dot-matrix strip on the scanner, under the HUD pills.
function magnetStrip(g, V) {
  const x = 14,
    y = 52,
    w = V.w - 28,
    h = 42;
  rr(g, x, y, w, h, 10, '#170f08', '#6b4a1e', 1.5);
  for (let k = x + 8; k < x + w - 4; k += 6) line(g, [[k, y + 4], [k, y + h - 4]], '#ffffff05', 1);
  const m = mini.pinMsg;
  if (m) {
    label(g, m.text, V.w / 2, y + 27, m.text.length > 30 ? 13 : 16, m.col, 'center');
    return;
  }
  label(g, magnetComma(mini.score), x + 12, y + 29, 22, '#ffb347');
  label(g, 'BALL ' + Math.min(3, mini.pinBallNo + 1) + (mini.pinMult > 1 ? ' · ×' + mini.pinMult : ''), x + w - 12, y + 18, 11, '#ffcf8f', 'right');
  label(g, 'EVICTED ' + mini.got + '/' + mini.goal, x + w - 12, y + 34, 11, '#c9ffb0', 'right');
  magnetBarfBar(g, V.w / 2 - 6, y + 9, 112, 'center');
}

// The Barf-o-meter as a labelled bar of notches, for the score strip and the side panel.
function magnetBarfBar(g, x, y, w, align = 'left') {
  const need = mini.pinBarfNeed,
    holding = magnetHolding(),
    have = holding ? need : mini.pinBarf,
    left = align === 'center' ? x - w / 2 : x,
    cell = w / need;
  label(g, 'BARF-O-METER', align === 'center' ? x : left, y + 8, 9, '#9be15d', align);
  for (let k = 0; k < need; k++) {
    const lit = k < have,
      on = holding ? Math.sin(mini.total * 22) > 0 : lit;
    rr(g, left + k * cell + 1, y + 13, cell - 2, 9, 3, on ? (holding ? '#f2ffd8' : '#8fd14f') : '#1d3b2a');
  }
}

// Landscape: score on the left, the magnet and the controls on the right.
function magnetPanels(g, V) {
  const lw = V.ox - 36,
    lx = 18,
    rx = V.ox + MAGNET_W * V.s + 18,
    rw = V.w - rx - 18;
  if (lw < 120) return;
  panel(g, lx, 60, lw, V.h - 78);
  label(g, 'POLARITY PANIC', lx + 16, 92, 17, '#f1e2b9');
  label(g, 'THE LOUD DONUT · LEVEL ' + (mini.tier + 1), lx + 16, 112, 11, '#a9c9c3');
  label(g, 'SCORE', lx + 16, 150, 10, '#a9c9c3');
  label(g, magnetComma(mini.score), lx + 16, 184, 30, '#ffb347');
  label(g, 'EVICTED', lx + 16, 220, 10, '#a9c9c3');
  label(g, mini.got + ' / ' + mini.goal, lx + 16, 248, 22, mini.got >= mini.goal ? '#c9ffb0' : '#e8f1dc');
  rr(g, lx + 16, 258, lw - 32, 8, 4, '#0b202c');
  rr(g, lx + 16, 258, (lw - 32) * clamp(mini.got / mini.goal, 0, 1), 8, 4, '#8fd14f');
  label(g, 'BALLS', lx + 16, 294, 10, '#a9c9c3');
  const left = (mini.pinSpare || 0) + (mini.pinOver ? 0 : 1);
  for (let k = 0; k < 3; k++) {
    magnetSteel(g, lx + 28 + k * 28, 316, 9, k);
    if (k >= left) ellipse(g, lx + 28 + k * 28, 316, 10, 10, '#0b202ccc');
  }
  label(g, 'BONUS ×' + mini.pinMult + ' · ' + mini.pinRamps + ' SCANS', lx + 16, 354, 11, '#ffe08a');
  magnetBarfBar(g, lx + 16, 372, lw - 32);
  // Message window.
  const my = V.h - 140,
    m = mini.pinMsg,
    text = m ? m.text : mini.pinCleared ? 'VICTORY LAP · ' + Math.ceil(mini.pinLapT) + ' S LEFT' : magnetWaiting() ? 'CLICK OR SPACE · TO LAUNCH' : 'KEEP IT · IN THE BORE';
  rr(g, lx + 10, my, lw - 20, 104, 10, '#170f08', '#6b4a1e', 1.5);
  text
    .split(' · ')
    .slice(0, 3)
    .forEach((wd, i) => label(g, wd, lx + lw / 2, my + 32 + i * 26, wd.length > 16 ? 12 : 15, m ? m.col : '#ffb347', 'center'));
  if (rw < 120) return;
  panel(g, rx, 60, rw, V.h - 78);
  label(g, 'MAGNET', rx + 16, 92, 15, '#f1e2b9');
  const heat = mini.pinHeat,
    bx = rx + 16,
    by = 108,
    bh = 170,
    col = mini.pinHot ? '#ff8a7a' : mini.pinMagOn ? '#7fe3ff' : '#3fa8c4',
    cw = rw - 78;
  rr(g, bx, by, 34, bh, 10, '#0b202c', '#5f8a9a', 1);
  rr(g, bx + 3, by + 3 + (bh - 6) * heat, 28, (bh - 6) * (1 - heat), 8, col);
  label(g, mini.pinHot ? 'HOT' : mini.pinMagOn ? 'ON' : 'READY', bx + 46, by + 22, 14, col);
  label(g, 'HOLD BOTH', bx + 46, by + 48, 10, '#a9c9c3');
  label(g, 'FLIPPERS', bx + 46, by + 62, 10, '#a9c9c3');
  const sv = mini.pinSave > 0;
  rr(g, bx + 46, by + 84, cw, 26, 9, sv ? '#7fe08a' : '#16343f');
  label(g, sv ? 'SAVE ' + Math.ceil(mini.pinSave) + 's' : 'NO SAVE', bx + 46 + cw / 2, by + 102, 11, sv ? '#123222' : '#6f8f98', 'center');
  rr(g, bx + 46, by + 122, cw, 26, 9, mini.pinTilted ? '#ff8a7a' : '#16343f');
  rr(g, bx + 46, by + 122, cw * clamp(mini.pinTilt, 0, 1), 26, 9, mini.pinTilted ? '#ff8a7a' : '#ffb34788');
  label(g, mini.pinTilted ? 'TILT' : 'NUDGE', bx + 46 + cw / 2, by + 140, 11, '#f6eed6', 'center');
  [
    ['LEFT HALF', 'left flipper'],
    ['RIGHT HALF', 'right flipper'],
    ['BOTH', 'magnet'],
    ['SWIPE UP · SHIFT', 'nudge'],
    ['Z · /  or  ← · →', 'flippers'],
    ['SPACE', 'launch']
  ].forEach(([a, b], i) => {
    const y = 316 + i * 30;
    if (y > V.h - 40) return;
    label(g, a, rx + 16, y, 11, '#ffe9b8');
    label(g, b, rx + 16, y + 13, 10, '#a9c9c3');
  });
}

function magnetTag(g, text, x, y, arrow) {
  const tw = text.length * 7.4 + 22;
  x = clamp(x, tw / 2 + 6, activeCanvas().w - tw / 2 - 6);
  rr(g, x - tw / 2, y - 15, tw, 26, 9, '#fff2c4ee');
  label(g, text, x, y + 3, 11, '#2b2a1e', 'center');
  if (arrow) poly(g, [[x - 7, y + 11], [x + 7, y + 11], [x, y + 20]], '#fff2c4ee');
}

// Teaching on the canvas: how to launch, which half is which flipper, and the magnet.
function magnetHints(g, V) {
  if (mini.screen !== 'play') return;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    T = (x, y) => ({ x: V.ox + x * V.s, y: V.oy + y * V.s }),
    pulse = 0.75 + 0.25 * Math.sin(mini.total * 6);
  if (magnetWaiting()) {
    const p = T(MAGNET_LANE.x, 560);
    g.globalAlpha = mini.pinWait > 3 ? pulse : 1;
    if (mini.pinPull) magnetTag(g, 'LET GO TO LAUNCH · HOLD = HARDER', p.x - 70, p.y, false);
    else magnetTag(g, coarse ? 'TAP ANYWHERE TO LAUNCH' : 'CLICK OR SPACE TO LAUNCH', p.x - 70, p.y, false);
    g.globalAlpha = 1;
    return;
  }
  const live = mini.pinBalls.filter(b => b.state === 'play');
  if (!live.length || mini.pinHeave) return;
  if (mini.pinBallNo === 0 && mini.tier === 0 && mini.total < 40)
    for (const side of [0, 1]) {
      if (mini.pinUsedFlip[side]) continue;
      const p = T(side ? 300 : 64, 600);
      magnetTag(g, coarse ? (side ? 'RIGHT HALF ▶' : '◀ LEFT HALF') : side ? 'CLICK RIGHT · / ▶' : '◀ Z · CLICK LEFT', p.x, p.y, false);
    }
  // Level 1, once both flippers are found: point at the Barf-o-meter until its first hit.
  if (mini.tier === 0 && !mini.pinHeaves && !mini.pinBarf && mini.pinUsedFlip[0] && mini.pinUsedFlip[1] && mini.total < 60) {
    const p = T(312, 102);
    magnetTag(g, 'HIT THE GREEN', p.x, p.y, true);
  }
  const diving = live.some(b => b.y > 540 && b.vy > 0 && Math.abs(b.x - MAGNET_CX) < 70);
  if (mini.pinHot) {
    const p = T(282, 660);
    magnetTag(g, 'LET GO TO COOL', p.x, p.y, false);
  } else if (diving && !mini.pinMagUses && mini.tier < 2) {
    const p = T(MAGNET_CX, 560);
    magnetTag(g, coarse ? 'HOLD BOTH SIDES = MAGNET' : 'HOLD BOTH FLIPPERS = MAGNET', p.x, p.y, false);
  }
}

// Department card and lobby preview: the donut, three gremlin bumpers, flippers and the ball.
function magnetScene(g, w, h) {
  g.save();
  g.scale(w / 420, h / 240);
  rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 0, 240, '#1b4a5e', '#0b2230'));
  rr(g, 60, 10, 300, 236, 30, gradient(g, 60, 10, 300, 236, '#e9efe0', '#8fb1b7'), '#5f8c9d', 2);
  rr(g, 80, 26, 260, 220, 22, gradient(g, 0, 26, 0, 220, '#1d5068', '#0d2533'));
  g.beginPath();
  g.arc(210, 112, 82, 0, Math.PI * 2);
  g.arc(210, 112, 54, 0, Math.PI * 2, true);
  g.fillStyle = '#2f7f99';
  g.fill();
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2 + time * 0.6;
    line(g, [[210 + Math.cos(a) * 58, 112 + Math.sin(a) * 58], [210 + Math.cos(a) * 78, 112 + Math.sin(a) * 78]], k % 2 ? '#a8f0ff' : '#5fc3dd', 4);
  }
  ellipse(g, 210, 112, 54, 54, '#081b26');
  glow(g, 210, 112, 110, '#7fe3ff30');
  for (const [x, y, t] of [
    [186, 104, 0],
    [234, 104, 1],
    [210, 136, 3]
  ]) {
    ellipse(g, x, y, 14, 14, '#ef929d');
    ellipse(g, x, y, 11, 11, '#24485a');
    gremlin(g, x, y + 8, 0.34, t, time + x);
  }
  const flap = Math.sin(time * 5) > 0.6 ? -0.4 : 0.45;
  for (const side of [0, 1]) {
    g.save();
    g.translate(side ? 268 : 152, 214);
    g.rotate(side ? Math.PI - flap : flap);
    rr(g, -7, -7, 52, 14, 7, '#a5e2c9', '#123c3a', 2);
    g.restore();
  }
  const bx = 290 + Math.sin(time * 1.3) * 30,
    by = 60 + Math.cos(time * 1.3) * 18;
  for (let i = 1; i < 6; i++) ellipse(g, bx - i * 7, by + i * 3, 7 - i, 7 - i, '#e9f2ef22');
  magnetSteel(g, bx, by, 8, time * 4);
  rr(g, 120, 14, 180, 22, 8, '#170f08', '#6b4a1e', 1);
  label(g, 'POLARITY PANIC', 210, 30, 12, '#ffb347', 'center');
  g.restore();
}
