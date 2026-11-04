// Bedside Blaster (your room, after dark). Macy sits up in bed with a toy blaster and a flashlight
// while gremlins crawl out from behind the furniture. Tap or click where the shot should land, slide
// the sight to an edge (or tap an edge arrow) to look around a three-layer room, and splat everything
// before it lands on your face.
// The room is always 600 × 600 and every rule works in its coordinates. On a touch screen the canvas is
// wider or taller than the room so the controls have somewhere to live: 1120 × 600 on its side (the room
// in the middle, a gutter either side) and 600 × 1040 upright (the room on top, the blanket below). The
// gutters hold the game's own controls, drawn on the canvas and read through touch(): the thumbstick
// bottom left with its show/hide chip above it, FIRE big at the bottom right, the flashlight stun above
// it and RELOAD beside them. With a mouse the canvas is just the room and the DOM buttons do the job.
const BLASTER_CANVAS = { square: { w: 600, h: 600 }, wide: { w: 1120, h: 600 }, tall: { w: 600, h: 1040 } };

const BLASTER = registerGame({
  id: 5,
  get canvas() {
    return blasterTouchScreen() ? BLASTER_CANVAS.wide : BLASTER_CANVAS.square;
  },
  get portraitCanvas() {
    return blasterTouchScreen() ? BLASTER_CANVAS.tall : undefined;
  },
  layout: 'gesture',
  info: {
    game: 'Bedside Blaster',
    genre: 'AIM · PUMP · RELOAD · SURVIVE',
    headline: 'Bed rest. Heavy resistance.',
    desc:
      'Lights out, gremlins in. Sweep a flashlight across your dark room, tap whatever moves and splat it before it lands on your face. Seven charges, one pump, zero chill.',
    goal: 'Survive three night watches and hit the eviction quota.',
    control:
      'Tap a gremlin to shoot it, or slide your finger and the sight rides along: let go to shoot. Or steer the sight with the thumbstick and hit FIRE. Tap an edge arrow, or push the sight to the edge, to look around. Hold before you let go for a piercing shot. Mouse: the sight follows the pointer, click fires, right-drag or Shift-drag looks around. Space fires, R reloads, arrows look.',
    avoid:
      'Glowing eyes mean company. An orange ring means it is about to jump at your face. Bedpan helmets pop off with a headshot, bruisers shrug off body shots, and pouncers barely wait. Reload in the green for a hot magazine.',
    cue: 'Tap or slide, let go to shoot · arrows and edges look · hold to pierce · R in the green · E stun'
  },
  tierNotes: [
    '105s · one at a time · hints on · slow crawlers',
    '120s · helmets, bruisers, pouncers · short fuses',
    '135s · the whole litter · Ralph Jr. on watch 3',
    '150s · every breed, short fuses · 6 charges · Ralph Jr. twice'
  ],
  // Level 4 is Legendary: level 3's whole litter from the first watch, shorter fuses, six charges a
  // magazine, a longer night and Ralph Jr. twice.
  legendary: true,
  shiftName: 'WATCH',
  init() {
    initArcadeRun(105 + mini.tier * 15);
    initShooter();
  },
  // A touch screen gets the canvas controls in the gutters, so the framework's own buttons go away (the
  // assist it always appends included). Mouse and keyboard keep the DOM row.
  controls() {
    mini.blasterOwnControls = blasterTouchScreen();
    if (mini.blasterOwnControls) {
      setControls([], { assist: false });
      return;
    }
    setControls([
      { id: 'fire', text: 'HOLD FIRE', key: 'Space', hot: true },
      { id: 'reload', text: 'RELOAD', key: 'R' }
    ]);
  },
  update(dt) {
    updateArcade(dt, updateShooter);
  },
  draw(g) {
    drawShooter(g);
  },
  // Every finger on the canvas, in canvas coordinates, several at once. In the room a tap fires where it
  // lands, a slide carries the sight and fires on release (the edges scroll the room), an edge arrow
  // turns to face its gremlin and a held finger charges. In the gutters: the stick steers, FIRE fires
  // (held, it charges), the flashlight stuns, RELOAD reloads and the chip shows or hides the stick.
  // Mouse: the left button aims and fires at the pointer, the right button or Shift drags the room.
  touch(kind, p, id) {
    const key = 'p' + id;
    if (kind === 'down') {
      const meta = blasterPointerMeta && blasterPointerMeta.id === id ? blasterPointerMeta : null;
      blasterPointerMeta = null;
      blasterPressStart(key, p, meta && meta.mouse ? (meta.pan ? 'pan' : 'aim') : 'touch');
    } else if (kind === 'move') blasterPressMove(key, p);
    else blasterPressEnd(key, kind === 'cancel');
  },
  action(a) {
    if (a === 'fire') blasterTriggerPress();
    if (a === 'reload') reloadBlaster();
  },
  assist() {
    mini.lightBurst = 0.7;
    for (const e of mini.targets) {
      if (!BLASTER_KINDS[e.kind] || e.mode === 'dying') continue;
      const p = shooterProjection(e);
      if (p.x < -60 || p.x > 660) continue;
      e.stun = 2.5;
      if (e.mode === 'leap') {
        e.mode = 'wind';
        e.wind = e.windMax;
        e.leap = 0;
      }
      if (e.mode === 'lunge') e.mode = 'return';
    }
    sfx('stun');
    mini.flash = 1;
    mini.flashText = 'FLASHLIGHT STUN · RELOAD NOW';
  },
  key(k, e) {
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      keys.add(k);
      e.preventDefault();
      return true;
    }
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) {
        mini.fireHeld = true;
        miniAction('fire');
      }
      return true;
    }
    if (k === 'r') {
      e.preventDefault();
      if (!e.repeat) miniAction('reload');
      return true;
    }
    return false;
  },
  shiftMessage(shift) {
    if (mini.tier === 3)
      return shift === 1
        ? 'WATCH 2 · Ralph Jr. is up past his bedtime.'
        : 'WATCH 3 · Ralph Jr. is back, and he brought the whole litter.';
    if (shift === 1) return 'WATCH 2 · both sides now. Pouncers have short fuses.';
    return mini.tier === 2
      ? 'WATCH 3 · everything, everywhere. Ralph Jr. wants a word.'
      : 'WATCH 3 · everything, everywhere. Check the bed rails.';
  },
  timeUp() {
    const met = mini.got >= mini.goal,
      why = 'Night over. Quota missed. Headshots end things faster, and a reload in the green keeps you shooting.';
    finishMini(met, met ? undefined : why);
  },
  lesson() {
    const i = BLASTER.info;
    return {
      title: i.game + ' · ' + mini.limit + ' second night',
      goal:
        i.goal +
        ' Evict ' +
        mini.goal +
        '.' +
        [
          ' Hints are on. Ralph is not.',
          '',
          ' Ralph Jr. crashes watch 3.',
          ' Legendary: every breed from the first second, shorter fuses, six charges a magazine, and Ralph Jr. on watches 2 and 3.'
        ][mini.tier],
      control: i.control,
      avoid: i.avoid,
      demo: 'aim',
      cue: i.cue
    };
  },
  statLabel: () => 'EVICTIONS / WATCH',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () =>
    `SCORE ${mini.score} · ${mini.ammo}/${mini.magazine} CHARGES${mini.hot ? ' · HOT ×' + mini.hot : ''} · ` +
    `${mini.headshots} HEADSHOTS · ${mini.cleanReloads} HOT RELOADS`,
  assistText: () => 'FLASH STUN · ' + mini.helps + ' (E)',
  // Accuracy, headshots and clean reloads drive the medal; oopses and assists cost it.
  quality() {
    const accuracy = mini.shotsHit / Math.max(1, mini.shotsFired),
      heads = Math.min(1, (mini.headshots / Math.max(1, mini.shotsHit)) * 2),
      reloads = mini.reloads ? mini.cleanReloads / mini.reloads : 0.5,
      over = clamp((mini.got / mini.goal - 1) * 40, 0, 14);
    return Math.round(
      clamp(
        50 +
          over +
          accuracy * 22 +
          heads * 10 +
          reloads * 6 +
          Math.min(8, mini.maxCombo * 0.4) -
          mini.miss * 7 -
          mini.helpUsed * 3,
        0,
        100
      )
    );
  },
  onWin() {
    const tail =
      mini.bossDowns >= 2
        ? ' Ralph Jr. got evicted twice. He is telling everyone it was a tie.'
        : mini.bossDown
          ? ' Ralph Jr. has been sent to his room. This is his room.'
          : ' The gremlins are leaving a one-star review.';
    return `Room secured. ${mini.headshots} headshots, ${mini.cleanReloads} hot reloads.` + tail;
  },
  onLose() {
    for (let i = 0; i < 120; i++)
      gore.push({
        x: 400,
        y: 95,
        vx: rand(-380, 380),
        vy: rand(-260, 40),
        size: rand(4, 11),
        col: ['#8fd14f', '#6cb33b', '#b6ee6a', '#4f8f2c'][i % 4]
      });
    const faced = mini.miss >= mini.rules.misses;
    return {
      gory: false,
      medal: '☹',
      heading: faced ? 'FACE: THOROUGHLY GOTTEN.' : 'THE NIGHT SHIFT WON.',
      text: 'Too many gremlins landed on your face. Shoot before the orange ring closes, and reload in the green.'
    };
  },
  // A lost night ends with a gremlin sitting on Macy's face and slime on the lens.
  resultArt(g) {
    if (mini.win) return false;
    for (let i = 0; i < 16; i++) {
      const x = (i * 149 + 31) % 790,
        y = (i * 67 + 13) % 200;
      ellipse(g, x, y, 9 + (i % 4) * 4, 7 + (i % 3) * 3, i % 2 ? '#8fd14fcc' : '#6cb33bcc');
      rr(g, x - 2, y, 4, 12 + (i % 3) * 7, 2, '#7cc244bb');
    }
    for (const p of gore) ellipse(g, p.x, p.y, p.size * 0.7, p.size * 0.8, p.col);
    gremlin(g, 396, 150, 1.6, 3, time);
    blasterBedpan(g, 396, 150 - 33 * 1.6, 1.6);
    label(g, 'GOT YOUR FACE', 400, 30, 14, '#d9ff9c', 'center');
    return true;
  },
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 0, 240, '#0b1730', '#16283d'));
    rr(g, 34, 24, 100, 78, 6, '#223a52');
    rect(g, 40, 30, 88, 66, gradient(g, 0, 30, 0, 66, '#071331', '#21406a'));
    glow(g, 106, 52, 34, '#d9e6ff40');
    ellipse(g, 106, 52, 9, 9, '#f3efd2');
    line(g, [[84, 30], [84, 96]], '#2a425a', 3);
    rect(g, 0, 156, 420, 84, gradient(g, 0, 156, 0, 84, '#172a3d', '#0b1622'));
    cabinet(g, 150, 160, 70);
    sofa(g, 300, 166, 110, '#3d566b');
    path(
      g,
      p => {
        p.moveTo(366, 240);
        p.lineTo(128, 62);
        p.lineTo(282, 58);
        p.lineTo(392, 240);
        p.closePath();
      },
      '#fff3c816'
    );
    glow(g, 205, 118, 96, '#fff2c430');
    rr(g, 112, 172, 190, 56, 14, gradient(g, 0, 172, 0, 56, '#5a7886', '#2b4351'), '#1b2f3a', 2);
    const crouch = 0.5 + 0.5 * Math.sin(time * 4);
    g.save();
    g.translate(205, 182);
    g.scale(1 + crouch * 0.06, 1 - crouch * 0.09);
    gremlin(g, 0, 0, 2.1, 0, time);
    g.restore();
    g.strokeStyle = '#f3a35c';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(205, 140, 58 - crouch * 14, 0, Math.PI * 2);
    g.stroke();
    for (const [x, y, n] of [[40, 146, 0], [362, 112, 1], [300, 70, 2]]) {
      const shut = (time + n * 0.9) % 3 < 0.14;
      for (const dx of [-5, 5]) {
        glow(g, x + dx, y, 9, '#eaff9e44');
        ellipse(g, x + dx, y, 2.6, shut ? 0.4 : 3, '#eaff9e');
      }
    }
    path(
      g,
      p => {
        p.moveTo(0, 240);
        p.lineTo(0, 222);
        p.quadraticCurveTo(210, 204, 420, 222);
        p.lineTo(420, 240);
        p.closePath();
      },
      '#2b5a60'
    );
    blasterGun(g, 372, 300, -0.42, { scale: 0.42, ammo: 5, mag: 7, charge: 0.5 + 0.5 * Math.sin(time * 3) });
    label(g, 'BEDSIDE BLASTER', 210, 22, 14, '#e2eccf', 'center');
    g.restore();
  }
});

// ---- Rules ----
const BLASTER_MAGAZINE = 7,
  BLASTER_MAGAZINES = [7, 7, 7, 6], // charges per magazine by level
  BLASTER_GOALS = [16, 26, 34, 40],
  BLASTER_RALPH = [[], [], [2], [1, 2]], // the watches Ralph Jr. visits, by level
  BLASTER_CHARGE = 0.6, // seconds held for a piercing shot
  BLASTER_SWEEP = 0.08, // the sight's travel time before a tap resolves
  BLASTER_SLOP = 12, // pixels a touch may wander and still count as a tap
  BLASTER_JAM = 0.7, // seconds a missed active reload adds
  BLASTER_BEAM = 12, // half-width of the piercing beam
  BLASTER_YAW = [300, 1500],
  BLASTER_PITCH = [190, 320],
  BLASTER_GUN = { x: 452, y: 662, reach: 224 },
  // Touch aiming: a sliding finger (or the stick) carries the sight, and inside this band the room
  // scrolls that way: slowly where the band starts, up to these rates on the very edge, so a look can
  // be feathered. An edge arrow is the quick turn.
  BLASTER_EDGE = 70,
  BLASTER_EDGE_RAMP = 1.8, // how gently the scroll builds across the band
  BLASTER_EDGE_YAW = 400, // yaw per second with the sight on the very edge
  BLASTER_EDGE_PITCH = 200,
  // The thumbstick: r is how far the knob travels, speed the sight's top speed, dead the slack in the
  // middle. It is on by default on touch; the chip above it hides it (state.stats.blasterStick 0).
  BLASTER_STICK = { r: 62, speed: 760, dead: 0.15 },
  BLASTER_ROOM = 600; // the room's size; the canvas around it is wider or taller

// Parallax layers: screen x = layer x - 600 + rate × (900 - yaw). Scale sizes what lives there.
const BLASTER_LAYERS = {
  far: { rate: 0.62, scale: 0.72, floor: 340 },
  mid: { rate: 1, scale: 1, floor: 404 },
  near: { rate: 1.55, scale: 1.45, floor: 520 }
};

const BLASTER_KINDS = {
  crawler: { hp: 1, size: 1.2, art: 0, creep: 1, wind: 1, leap: 1, points: 100, eye: '#eaff9e' },
  helmet: { hp: 2, size: 1.25, art: 3, creep: 1.08, wind: 1, leap: 1, points: 150, eye: '#a8f3ff' },
  bruiser: { hp: 3, size: 1.55, art: 2, creep: 1.4, wind: 1.2, leap: 1.15, points: 220, eye: '#ffc56b' },
  pouncer: { hp: 1, size: 1.1, art: 1, creep: 0.55, wind: 0.45, leap: 0.55, points: 160, eye: '#ff9ad5' },
  boss: { hp: 14, size: 2.5, art: 0, points: 600, eye: '#ff7a6b' }
};

const BLASTER_INTROS = {
  helmet: 'BEDPAN HELMET · A HEADSHOT POPS THE LID',
  bruiser: 'BRUISER · SHRUGS OFF BODY SHOTS · AIM HIGH OR HOLD TO CHARGE',
  pouncer: 'POUNCER · SHORT FUSE · SHOOT IT BEFORE IT CROUCHES'
};

// Spawn weights by level and watch.
const BLASTER_MIX = [
  [{ crawler: 1 }, { crawler: 6, helmet: 2, pouncer: 1 }, { crawler: 5, helmet: 2, pouncer: 2, bruiser: 1 }],
  [
    { crawler: 6, helmet: 3, bruiser: 1 },
    { crawler: 4, helmet: 3, bruiser: 2, pouncer: 2 },
    { crawler: 3, helmet: 3, bruiser: 2, pouncer: 3 }
  ],
  [
    { crawler: 5, helmet: 3, bruiser: 2 },
    { crawler: 3, helmet: 3, bruiser: 2, pouncer: 3 },
    { crawler: 3, helmet: 3, bruiser: 3, pouncer: 3 }
  ],
  [
    { crawler: 4, helmet: 3, bruiser: 1, pouncer: 2 },
    { crawler: 3, helmet: 3, bruiser: 2, pouncer: 3 },
    { crawler: 3, helmet: 3, bruiser: 3, pouncer: 3 }
  ]
];

// Where gremlins hide (x, y is the hidden eye point; px, py the peek) in each layer's coordinates.
// side: 0 window side, 1 middle, 2 door side.
const BLASTER_HIDES = [
  { id: 'curtainL', layer: 'far', side: 0, x: 463, y: 150, px: -44, py: 0 },
  { id: 'curtainR', layer: 'far', side: 0, x: 697, y: 150, px: 44, py: 0 },
  { id: 'dresserL', layer: 'mid', side: 0, x: 238, y: 322, px: 0, py: -52 },
  { id: 'dresserR', layer: 'mid', side: 0, x: 372, y: 322, px: 0, py: -52 },
  { id: 'bin', layer: 'mid', side: 0, x: 600, y: 330, px: 0, py: -52 },
  { id: 'bedside', layer: 'mid', side: 1, x: 728, y: 322, px: 0, py: -52 },
  { id: 'sofaL', layer: 'mid', side: 2, x: 1180, y: 314, px: 0, py: -50 },
  { id: 'sofaR', layer: 'mid', side: 2, x: 1385, y: 314, px: 0, py: -50 },
  { id: 'sideTable', layer: 'mid', side: 2, x: 1525, y: 345, px: 0, py: -44 },
  { id: 'cabinetR', layer: 'mid', side: 2, x: 1745, y: 322, px: 0, py: -52 },
  { id: 'door', layer: 'far', side: 2, x: 1262, y: 290, px: 40, py: 0 },
  { id: 'footboard', layer: 'near', side: 1, x: 900, y: 494, px: 0, py: -68 },
  { id: 'railL', layer: 'near', side: 0, x: 430, y: 590, px: 0, py: -68 },
  { id: 'railR', layer: 'near', side: 2, x: 1370, y: 590, px: 0, py: -68 }
];

// Surfaces a gremlin can wind up on (top is where its feet go).
const BLASTER_PERCHES = [
  { layer: 'far', side: 0, x: 528, top: 200 },
  { layer: 'far', side: 0, x: 634, top: 200 },
  { layer: 'far', side: 2, x: 1236, top: 338 },
  { layer: 'mid', side: 0, x: 150, top: 398 },
  { layer: 'mid', side: 0, x: 248, top: 278 },
  { layer: 'mid', side: 0, x: 362, top: 278 },
  { layer: 'mid', side: 0, x: 440, top: 402 },
  { layer: 'mid', side: 0, x: 600, top: 294 },
  { layer: 'mid', side: 1, x: 716, top: 278 },
  { layer: 'mid', side: 1, x: 852, top: 278 },
  { layer: 'mid', side: 1, x: 900, top: 404 },
  { layer: 'mid', side: 1, x: 965, top: 300 },
  { layer: 'mid', side: 1, x: 1040, top: 300 },
  { layer: 'mid', side: 2, x: 1165, top: 275 },
  { layer: 'mid', side: 2, x: 1300, top: 275 },
  { layer: 'mid', side: 2, x: 1405, top: 275 },
  { layer: 'mid', side: 2, x: 1240, top: 327 },
  { layer: 'mid', side: 2, x: 1355, top: 327 },
  { layer: 'mid', side: 2, x: 1525, top: 318 },
  { layer: 'mid', side: 2, x: 1600, top: 402 },
  { layer: 'mid', side: 2, x: 1718, top: 278 },
  { layer: 'mid', side: 2, x: 1776, top: 278 },
  { layer: 'near', side: 0, x: 470, top: 466 },
  { layer: 'near', side: 1, x: 812, top: 494 },
  { layer: 'near', side: 1, x: 905, top: 440 },
  { layer: 'near', side: 2, x: 1330, top: 466 }
];

// Level and watch pacing. Level 1 is slow and solitary; levels 2 and 3 crowd and hurry. Legendary
// (level 4) keeps level 3's crowd with shorter fuses; the litter, the smaller magazine and the second
// Ralph Jr. do the rest, so its spawns run a touch slower than level 3's.
function blasterTuning(tier = mini.tier, shift = mini.shift || 0) {
  const pace = (mini.rules && mini.rules.mini) || 1;
  return {
    interval: [[3.6, 3.1, 2.7], [2.8, 2.45, 2.15], [2.45, 2.15, 1.85], [2.6, 2.3, 2]][tier][shift] / pace,
    windup: [1.8, 1.25, 1, 0.92][tier] / pace,
    leap: [1.15, 0.92, 0.8, 0.76][tier] / Math.sqrt(pace),
    creep: [[6.2, 5.8, 5.4], [5, 4.6, 4.2], [4.4, 4, 3.6], [4.4, 4, 3.6]][tier][shift] / pace,
    peek: [1.6, 1.05, 0.8, 0.8][tier] / pace,
    cap: [[1, 2, 3], [2, 3, 3], [3, 3, 4], [3, 3, 4]][tier][shift],
    reload: [1.5, 1.4, 1.3, 1.3][tier],
    window: [[0.36, 0.7], [0.48, 0.67], [0.53, 0.66], [0.53, 0.66]][tier],
    shotCd: 0.13
  };
}

function initShooter() {
  Object.assign(mini, {
    goal: BLASTER_GOALS[mini.tier],
    look: { yaw: 700, pitch: 250 },
    lookTarget: { yaw: 700, pitch: 250 },
    sight: { x: 300, y: 285 },
    sweep: null,
    blasterQueue: [],
    blasterPresses: {},
    blasterTrigger: null,
    blasterTriggerEnd: -1,
    targets: [],
    spawn: 1.2,
    spawned: 0,
    spawnTimes: [],
    targetSerial: 0,
    lastSide: -1,
    rush: false,
    ammo: BLASTER_MAGAZINES[mini.tier],
    magazine: BLASTER_MAGAZINES[mini.tier],
    reload: 0,
    reloadT: 0,
    reloadDur: 0,
    reloadBase: 0,
    reloadTry: false,
    reloads: 0,
    cleanReloads: 0,
    jams: 0,
    hot: 0,
    shotCd: 0,
    fireHeld: false,
    gunKick: 0,
    muzzle: 0,
    pump: 0,
    aimFlash: 0,
    hitFlash: 0,
    lightBurst: 0,
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    chargedShots: 0,
    pierces: 0,
    bottleT: 9,
    bottlesShot: 0,
    bossSpawned: false,
    bossDown: false,
    bossVisits: 0,
    bossDowns: 0,
    bossWatches: {},
    splat: null,
    tracers: [],
    pops: [],
    debris: [],
    captions: [],
    blasterSeen: {},
    blasterFirstHit: false,
    blasterPanned: false,
    blasterMouse: false,
    blasterMouseIn: false,
    blasterOwnControls: false
  });
  blasterPointerMeta = null;
}

// ---- Camera and projection ----
function blasterOffset(rate) {
  return { x: -600 + rate * (900 - mini.look.yaw), y: 35 + rate * (250 - mini.look.pitch) };
}

function blasterProject(layer, x, y) {
  const o = blasterOffset(BLASTER_LAYERS[layer].rate);
  return { x: x + o.x, y: y + o.y };
}

function blasterPan(dyaw, dpitch) {
  mini.lookTarget.yaw = clamp(mini.lookTarget.yaw + dyaw, BLASTER_YAW[0], BLASTER_YAW[1]);
  mini.lookTarget.pitch = clamp(mini.lookTarget.pitch + dpitch, BLASTER_PITCH[0], BLASTER_PITCH[1]);
}

// Screen position (eye level) and scale. Leaps arc from the perch toward Macy's face and grow.
function shooterProjection(e) {
  if (e.deathP) return e.deathP;
  return blasterProjectAt(e, e.leap || 0);
}

function blasterProjectAt(e, leapT) {
  const o = blasterOffset(e.r || 1),
    s = e.s || 1.2;
  let x = e.x + o.x,
    y = e.y + o.y;
  if (e.mode === 'drop') y -= (1 - clamp(e.dropT / 0.7, 0, 1)) ** 2 * 420;
  if (e.mode !== 'leap' && e.mode !== 'lunge' && e.mode !== 'return') return { x, y, s, leap: 0 };
  const t = clamp(leapT / e.leapDuration, 0, 1),
    u = t * t,
    tx = 300 + (x - 300) * 0.15;
  return {
    x: x + (tx - x) * u,
    y: y + (300 - y) * u - Math.sin(t * Math.PI) * 90,
    s: s * (1 + (e.kind === 'boss' ? 2.6 : 6) * u),
    leap: t
  };
}

function blasterAlong(path, q) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    segs.push(d);
    total += d;
  }
  let left = q * total;
  for (let i = 0; i < segs.length; i++) {
    if (left <= segs[i] || i === segs.length - 1) {
      const u = segs[i] ? clamp(left / segs[i], 0, 1) : 1;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * u, y: path[i].y + (path[i + 1].y - path[i].y) * u };
    }
    left -= segs[i];
  }
  return { x: path[path.length - 1].x, y: path[path.length - 1].y };
}

function blasterGunPose() {
  const S = mini.sight,
    aim = clamp(Math.atan2(S.x - BLASTER_GUN.x, BLASTER_GUN.y - S.y) * 0.85, -0.8, 0.45),
    dip = mini.reload > 0 ? Math.min(1, mini.reloadT / 0.18, mini.reload / 0.18) : 0;
  return {
    x: BLASTER_GUN.x + dip * 30,
    y: BLASTER_GUN.y + mini.gunKick * 14 + dip * 70,
    a: aim - mini.gunKick * 0.05 + dip * 0.5
  };
}

function blasterMuzzle() {
  const p = blasterGunPose();
  return { x: p.x + Math.sin(p.a) * BLASTER_GUN.reach, y: p.y - Math.cos(p.a) * BLASTER_GUN.reach };
}

// ---- Spawning ----
function blasterSideAllowed(side) {
  return mini.shift > 0 || side !== 2;
}

// Watch 1 keeps to the window side, watch 2 opens both sides, watch 3 adds the door and the bed.
function blasterHideAllowed(h) {
  if (mini.shift === 0) return h.side === 0 || (h.side === 1 && h.layer === 'mid');
  if (mini.shift === 1) return h.layer !== 'near';
  return true;
}

function blasterHideOpen(h) {
  return blasterHideAllowed(h) && !mini.targets.some(e => e.hideId === h.id && e.mode === 'hide');
}

function blasterHideVisible(h) {
  const p = blasterProject(h.layer, h.x + h.px, h.y + h.py);
  return p.x > 70 && p.x < 530;
}

function blasterPerchBusy(p) {
  return mini.targets.some(e => e.perch === p && !e.dead && e.mode !== 'dying' && e.mode !== 'leap');
}

function blasterPickKind() {
  const mix = BLASTER_MIX[mini.tier][mini.shift],
    total = Object.values(mix).reduce((a, b) => a + b, 0);
  let roll = rand(0, total);
  for (const [kind, w] of Object.entries(mix)) {
    roll -= w;
    if (roll < 0) return kind;
  }
  return 'crawler';
}

// A fresh route every time: hide spot, a dip toward the floor, then a perch on nearby furniture.
function spawnCrawler(kind = blasterPickKind(), hideId = null) {
  const T = blasterTuning(),
    k = BLASTER_KINDS[kind];
  let pool = hideId ? BLASTER_HIDES.filter(h => h.id === hideId) : BLASTER_HIDES.filter(blasterHideOpen);
  // First Rodeo: the first two show up where Macy is already looking.
  if (!hideId && mini.tier === 0 && mini.spawned < 2) {
    const seen = pool.filter(blasterHideVisible);
    if (seen.length) pool = seen;
  }
  // Watch 2 swaps sides to keep you turning.
  if (!hideId && mini.shift === 1) {
    const swap = pool.filter(h => h.side !== 1 && h.side !== mini.lastSide);
    if (swap.length && rand(0, 1) < 0.7) pool = swap;
  }
  if (!pool.length) pool = BLASTER_HIDES.filter(blasterHideAllowed);
  const h = pick(pool),
    L = BLASTER_LAYERS[h.layer],
    s = k.size * L.scale,
    start = { x: h.x + h.px, y: h.y + h.py },
    reach = kind === 'pouncer' ? 300 : 560;
  let perches = BLASTER_PERCHES.filter(p => {
    const dx = Math.abs(p.x - start.x);
    return p.layer === h.layer && dx > 50 && dx < reach && !blasterPerchBusy(p);
  });
  if (!perches.length) perches = BLASTER_PERCHES.filter(p => p.layer === h.layer);
  const perch = pick(perches),
    end = { x: perch.x, y: perch.top - 30 * s },
    via = {
      x: start.x + (end.x - start.x) * rand(0.35, 0.65),
      y: Math.min(L.floor - 30 * s, Math.max(start.y, end.y) + rand(6, 34) * L.scale)
    },
    len = Math.hypot(via.x - start.x, via.y - start.y) + Math.hypot(end.x - via.x, end.y - via.y);
  const e = {
    id: mini.targetSerial++,
    kind,
    layer: h.layer,
    r: L.rate,
    s,
    hp: k.hp,
    maxHp: k.hp,
    helmet: kind === 'helmet',
    hideId: h.id,
    perch,
    home: { x: h.x, y: h.y },
    peekOff: { x: h.px, y: h.py },
    path: [start, via, end],
    len,
    crawlT: 0,
    creepDur: clamp(T.creep * (len / 420), T.creep * 0.45, T.creep * 1.3) * k.creep,
    mode: 'hide',
    hideT: 0,
    hideDur: T.peek * (kind === 'pouncer' ? 0.55 : 1) * rand(0.85, 1.2),
    peek: 0,
    x: h.x,
    y: h.y,
    bx: start.x,
    by: start.y,
    vx: 0,
    vy: 0,
    wind: 0,
    windMax: T.windup * k.wind,
    leap: 0,
    leapDuration: T.leap * k.leap,
    hit: 0,
    stun: 0,
    dying: 0,
    age: 0
  };
  mini.targets.push(e);
  mini.spawned++;
  mini.spawnTimes.push(mini.phaseTime);
  mini.lastSide = h.side;
  if (!mini.blasterSeen[kind]) {
    mini.blasterSeen[kind] = true;
    if (BLASTER_INTROS[kind]) {
      mini.flash = 1.8;
      mini.flashText = BLASTER_INTROS[kind];
    }
  }
  // Off-screen arrivals give themselves away with a scratch.
  const sp = blasterProject(h.layer, start.x, start.y);
  if (sp.x < 0 || sp.x > 600) {
    mini.captions.push({ side: sp.x < 0 ? -1 : 1, y: clamp(sp.y, 170, 440), t: 1.6 });
    sfx(typeof SFX !== 'undefined' && SFX.scratch ? 'scratch' : 'trap');
  }
  return e;
}

function blasterSpawnBottle(perch = null) {
  const spots = BLASTER_PERCHES.filter(
    p =>
      p.layer === 'mid' &&
      p.top < 380 &&
      blasterSideAllowed(p.side) &&
      !blasterPerchBusy(p) &&
      !mini.targets.some(e => e.kind === 'bottle' && e.perch === p)
  );
  if (!perch && !spots.length) return null;
  const p = perch || pick(spots),
    e = {
      id: mini.targetSerial++,
      kind: 'bottle',
      layer: 'mid',
      r: 1,
      s: 1,
      perch: p,
      x: p.x,
      y: p.top - 17,
      life: 10,
      mode: 'bottle',
      hp: 1,
      hit: 0
    };
  mini.targets.push(e);
  if (!mini.blasterSeen.bottle) {
    mini.blasterSeen.bottle = true;
    mini.flash = 1.4;
    mini.flashText = 'JUICE BOTTLE · SHOOT IT FOR +3 CHARGES';
  }
  return e;
}

// Ralph Jr. drops in for level 3's last watch, and for Legendary's last two. His mouth only opens when he
// roars.
function blasterSpawnBoss() {
  mini.bossSpawned = true;
  mini.bossVisits = (mini.bossVisits || 0) + 1;
  const k = BLASTER_KINDS.boss,
    e = {
      id: mini.targetSerial++,
      kind: 'boss',
      layer: 'mid',
      r: 1,
      s: k.size,
      hp: k.hp,
      maxHp: k.hp,
      x: 900,
      y: 404 - 30 * k.size,
      mode: 'drop',
      dropT: 0,
      cycleT: 0,
      roarHits: 0,
      roars: 0,
      leap: 0,
      leapDuration: 0.85,
      hit: 0,
      stun: 0,
      dying: 0,
      age: 0
    };
  mini.targets.push(e);
  mini.flash = 2.2;
  mini.flashText =
    mini.bossVisits > 1
      ? 'RALPH JR. IS BACK · SAME MOUTH, SAME PLAN'
      : 'RALPH JR. HAS ENTERED THE CHAT · SHOOT THE MOUTH WHEN THE PACIFIER DROPS';
  sfx('explode');
  return e;
}

function blasterBossOpen(e) {
  return e.mode === 'roar' || e.mode === 'lunge';
}

// ---- Shooting ----
// The zone under a screen point: head, body, the boss's weak spot, or a juice bottle.
function blasterZone(e, x, y) {
  const p = shooterProjection(e),
    s = p.s,
    dx = x - p.x,
    dy = y - p.y;
  if (e.kind === 'bottle') return Math.hypot(dx, dy) < 18 ? 'bottle' : null;
  if (e.kind === 'boss') {
    if (blasterBossOpen(e) && Math.hypot(dx - 2 * s, dy - 17 * s) < 11 * s) return 'weak';
    return Math.abs(dx) < 27 * s && dy > -20 * s && dy < 34 * s ? 'body' : null;
  }
  const head = Math.hypot(dx - s, dy - 2 * s) < 13 * s;
  if (e.mode === 'hide') return e.peek > 0.45 && head ? 'head' : null;
  if (head) return 'head';
  return Math.abs(dx) < 25 * s && dy > -16 * s && dy < 32 * s ? 'body' : null;
}

function blasterHitsAt(x, y) {
  const out = [];
  for (const e of mini.targets) {
    if (e.dead || e.mode === 'dying') continue;
    const zone = blasterZone(e, x, y);
    if (zone) out.push({ e, p: shooterProjection(e), zone });
  }
  // Leapers first, then nearer layers, then gremlins over bottles.
  const rank = h => (h.e.kind === 'bottle' ? 0 : 10) + h.p.leap * 50 + (h.e.r || 1) * 5 + (h.zone === 'body' ? 0 : 1);
  return out.sort((a, b) => rank(b) - rank(a));
}

// A charged shot keeps going: everything along the ray from the muzzle through the sight. The target
// under the sight takes the zone that was aimed at; anything else on the line takes it in the body.
function blasterBeamHits(x, y) {
  const M = blasterMuzzle(),
    len = Math.hypot(x - M.x, y - M.y) || 1,
    ux = (x - M.x) / len,
    uy = (y - M.y) / len,
    near = (cx, cy, r) =>
      (cx - M.x) * ux + (cy - M.y) * uy > 0 && Math.abs((cx - M.x) * uy - (cy - M.y) * ux) < r + BLASTER_BEAM;
  const out = [];
  for (const e of mini.targets) {
    if (e.dead || e.mode === 'dying') continue;
    const p = shooterProjection(e),
      s = p.s;
    let zone = blasterZone(e, x, y);
    if (zone) out.push({ e, p, zone });
    else {
      if (e.kind === 'bottle') zone = near(p.x, p.y, 18) ? 'bottle' : null;
      else if (e.kind === 'boss') {
        const weak = blasterBossOpen(e) && near(p.x + 2 * s, p.y + 17 * s, 11 * s);
        zone = weak ? 'weak' : near(p.x, p.y + 8 * s, 24 * s) ? 'body' : null;
      } else if (e.mode === 'hide') zone = e.peek > 0.45 && near(p.x + s, p.y + 2 * s, 13 * s) ? 'head' : null;
      else zone = near(p.x, p.y + 8 * s, 22 * s) ? 'body' : null;
      if (zone) out.push({ e, p, zone });
    }
  }
  return out;
}

// Fires at (x, y), or at the sight when called without a point. Returns true if a shot left the barrel.
function fireBlaster(x, y, charged = false) {
  if (x !== undefined && y !== undefined) blasterAimAt(x, y, 0);
  return blasterShoot(mini.sight.x, mini.sight.y, charged);
}

function blasterShoot(x, y, charged = false) {
  if (mini.shotCd > 0 || mini.reload > 0) return false;
  if (mini.ammo <= 0) {
    sfx('miss');
    reloadBlaster();
    return false;
  }
  const M = blasterMuzzle(),
    hot = mini.hot > 0,
    hits = charged ? blasterBeamHits(x, y) : blasterHitsAt(x, y).slice(0, 1);
  mini.ammo--;
  mini.shotsFired++;
  mini.shotCd = blasterTuning().shotCd;
  mini.gunKick = charged ? 1.4 : 1;
  mini.muzzle = charged ? 0.12 : 0.075;
  mini.pump = 1;
  if (hot) mini.hot--;
  if (charged) mini.chargedShots++;
  const len = Math.hypot(x - M.x, y - M.y) || 1,
    end = charged ? { x: M.x + ((x - M.x) / len) * 900, y: M.y + ((y - M.y) / len) * 900 } : { x, y };
  mini.tracers.push({ x0: M.x, y0: M.y, x1: end.x, y1: end.y, t: charged ? 0.16 : 0.09, charged, hot });
  sfx(charged ? 'explode' : 'shot');
  if (!hits.length) {
    mini.combo = 0;
    blasterBurst(x, y, '#6f8797', 4);
  } else {
    mini.shotsHit++;
    mini.aimFlash = 0.16;
    for (const h of hits) blasterApplyHit(h, charged, hot);
    const pierced = hits.filter(h => h.e.kind !== 'bottle').length;
    if (charged && pierced >= 2) {
      mini.pierces++;
      mini.score += 60 * (pierced - 1);
      blasterPop(x, y - 46, 'PIERCED ×' + pierced, '#c9ffb0');
    }
  }
  if (mini.ammo === 0) reloadBlaster();
  return true;
}

function blasterApplyHit(h, charged, hot) {
  const { e, p, zone } = h;
  if (e.kind === 'bottle') {
    e.dead = true;
    mini.ammo = Math.min(mini.magazine + 3, mini.ammo + 3);
    mini.bottlesShot++;
    mini.score += 40;
    sfx('powerup');
    blasterBurst(p.x, p.y, '#ffb347', 14);
    blasterPop(p.x, p.y - 26, '+3 JUICE', '#ffd27a');
    return false;
  }
  const head = zone === 'head' || zone === 'weak';
  let dmg = 0,
    text = '';
  if (e.kind === 'boss') {
    if (zone === 'weak') {
      dmg = charged ? 3 : 2;
      e.roarHits++;
      text = 'WEAK SPOT';
    } else text = 'CLANG';
  } else if (zone === 'head' && e.helmet) {
    e.helmet = false;
    dmg = charged ? 2 : 1;
    text = 'LID POPPED';
    mini.debris.push({
      x: p.x,
      y: p.y - 6 * p.s,
      vx: rand(-160, 160),
      vy: -380,
      rot: 0,
      spin: rand(-12, 12),
      s: p.s,
      t: 1.2
    });
  } else if (zone === 'head') {
    dmg = charged ? 3 : 2;
    text = 'HEADSHOT';
  } else if (e.kind === 'bruiser' && !charged) text = 'SHRUGGED';
  else dmg = charged ? 2 : 1;
  if (hot && head) dmg *= 2;
  if (dmg === 0) {
    sfx('ricochet');
    blasterBurst(p.x, p.y - 4 * p.s, '#ffe6a6', 6);
    blasterPop(p.x, p.y - 30 * p.s, text, '#ffd7a0');
    return false;
  }
  if (head) mini.headshots++;
  mini.blasterFirstHit = true;
  e.hp -= dmg;
  e.hit = 0.13;
  blasterBurst(p.x, p.y, head ? '#ffe4a1' : '#b8e07a', head ? 14 : 10);
  sfx(head ? 'headshot' : 'hit');
  if (e.hp > 0) {
    blasterPop(p.x, p.y - 30 * p.s, text || 'HIT', '#ffe9b8');
    return false;
  }
  const midAir = e.mode === 'leap' || e.mode === 'lunge',
    peeking = e.mode === 'hide',
    k = BLASTER_KINDS[e.kind];
  if (midAir) e.deathP = { ...p };
  e.mode = 'dying';
  e.dying = e.kind === 'boss' ? 1 : 0.45;
  mini.got += e.kind === 'boss' ? 3 : 1;
  if (e.kind === 'boss') {
    mini.bossDown = true;
    mini.bossDowns = (mini.bossDowns || 0) + 1;
  }
  praise(k.points + (head ? 60 : 0) + (midAir ? 80 : 0) + (hot ? 40 : 0), head ? 1 : charged ? 0.85 : 0.72);
  sfx(e.kind === 'boss' ? 'clear' : 'squelch');
  blasterBurst(p.x, p.y + 8 * p.s, '#9be15d', e.kind === 'boss' ? 30 : 16);
  mini.flash = e.kind === 'boss' ? 1.8 : 0.6;
  mini.flashText =
    e.kind === 'boss'
      ? 'RALPH JR. GROUNDED · TELL YOUR DAD'
      : midAir
        ? 'MID-AIR EVICTION'
        : peeking
          ? 'PEEKABOO. NO.'
          : head
            ? (hot ? 'HOT HEADSHOT' : 'HEADSHOT') + ' · LIGHTS OUT'
            : 'GREMLIN EVICTED';
  return true;
}

function blasterPop(x, y, text, col) {
  if (mini.pops.some(p => p.text === text && p.t > 0.5)) return;
  mini.pops.push({ x, y, text, col, t: 0.8 });
}

// ---- Reloading: tap RELOAD again inside the green for an instant, hot magazine ----
function reloadBlaster() {
  if (mini.reload > 0) {
    blasterActiveReload();
    return;
  }
  if (mini.ammo >= mini.magazine) return;
  mini.reloadBase = blasterTuning().reload;
  mini.reload = mini.reloadDur = mini.reloadBase;
  mini.reloadT = 0;
  mini.reloadTry = false;
  mini.reloads++;
  mini.blasterQueue = [];
  sfx('reload');
}

// The marked window, in seconds since the reload began. Gentler prescriptions widen it.
function blasterReloadWindow() {
  const [a, b] = blasterTuning().window,
    mid = (a + b) / 2,
    half = (b - a) / 2 / ((mini.rules && mini.rules.mini) || 1);
  return [(mid - half) * mini.reloadBase, (mid + half) * mini.reloadBase];
}

function blasterActiveReload() {
  if (mini.reloadTry) return;
  mini.reloadTry = true;
  const [a, b] = blasterReloadWindow();
  if (mini.reloadT >= a && mini.reloadT <= b) {
    mini.reload = 0;
    mini.ammo = Math.max(mini.ammo, mini.magazine);
    mini.hot = 2;
    mini.cleanReloads++;
    mini.score += 50;
    sfx('powerup');
    mini.flash = 0.9;
    mini.flashText = 'HOT RELOAD · NEXT 2 HEADSHOTS HIT DOUBLE';
  } else {
    mini.reload += BLASTER_JAM;
    mini.reloadDur += BLASTER_JAM;
    mini.jams++;
    sfx('miss');
    mini.flash = 0.8;
    mini.flashText = 'JAMMED · THAT WAS NOT THE GREEN';
  }
}

// ---- Input ----
let blasterPointerMeta = null,
  blasterCursorHidden = false;

function blasterAimAt(x, y, dur) {
  x = clamp(x, 0, 600);
  y = clamp(y, 0, 600);
  if (dur <= 0) {
    mini.sight.x = x;
    mini.sight.y = y;
    mini.sweep = null;
    return;
  }
  mini.sweep = { fx: mini.sight.x, fy: mini.sight.y, tx: x, ty: y, t: 0, dur };
}

// ---- The canvas around the room ----
// Where the room sits on the active canvas: centred between the gutters when wide, on top when tall.
function blasterRoomBox() {
  const { w, h } = activeCanvas();
  return { x: Math.round((w - BLASTER_ROOM) / 2), y: w > h ? Math.round((h - BLASTER_ROOM) / 2) : 0 };
}

function blasterToRoom(p) {
  const B = blasterRoomBox();
  return { x: p.x - B.x, y: p.y - B.y };
}

function blasterInRoom(r) {
  return r.x >= 0 && r.x <= BLASTER_ROOM && r.y >= 0 && r.y <= BLASTER_ROOM;
}

// Particles go through the framework, which draws them in canvas coordinates.
function blasterBurst(x, y, col, n) {
  const B = blasterRoomBox();
  arcadeBurst(x + B.x, y + B.y, col, n);
}

// A touch screen (the framework's own test for floating its buttons) gets the canvas with gutters and
// the touch controls in them. Anything else gets the room alone and the DOM buttons.
function blasterTouchScreen() {
  return typeof miniCoarse === 'function' && miniCoarse();
}

function blasterTouchUI() {
  return blasterTouchScreen();
}

// The stick is on by default; the chip hides it and the choice is remembered.
function blasterStickOn() {
  return !(state.stats && state.stats.blasterStick === 0);
}

function blasterStickShown() {
  return blasterTouchUI() && blasterStickOn();
}

// What the framework's own buttons hide, in canvas pixels. When the blaster runs its own controls it has
// hidden the only one left (the assist), so nothing is covered.
function blasterCover() {
  const c = (mini.frame && mini.frame.cover) || {};
  if (mini.blasterOwnControls) return { bottom: 0, left: 0, right: 0 };
  return { bottom: c.bottom || 0, left: c.left || 0, right: c.right || 0 };
}

// The touch controls, in canvas coordinates, for the active canvas: thumbstick bottom left with its chip
// above it, FIRE big at the bottom right, the flashlight stun above FIRE and RELOAD beside them. Anything
// the framework's buttons would hide lifts the lot clear of them. Circles have x, y, r; the chip is a box.
function blasterLayout(cover = blasterCover()) {
  const { w, h } = activeCanvas(),
    B = blasterRoomBox(),
    lift = cover.bottom || 0;
  if (w > h) {
    const lx = B.x / 2,
      rx = w - B.x / 2,
      base = h - 18 - lift,
      stick = { x: lx, y: base - 92, r: BLASTER_STICK.r },
      fire = { x: rx + 5, y: base - 100, r: 92 };
    return {
      wide: true,
      stick,
      // A thumb anywhere in the gutter below the chip grabs the stick.
      stickZone: { x: 0, y: stick.y - 120, w: B.x, h: h - stick.y + 120 },
      chip: { x: lx - 52, y: stick.y - 168, w: 104, h: 44 },
      fire,
      flash: { x: rx + 25, y: fire.y - 170, r: 52 },
      reload: { x: B.x + BLASTER_ROOM + 46, y: fire.y - 132, r: 40 }
    };
  }
  // Upright: the band under the room. When something lifts the controls the stun keeps off the room
  // and FIRE shrinks a little to make room for it.
  const top = B.y + BLASTER_ROOM,
    base = h - 24 - lift,
    stick = { x: 140, y: base - 110, r: BLASTER_STICK.r },
    fire = { x: w - 132, y: base - 112, r: 96 },
    flash = { x: fire.x + 20, y: Math.max(top + 66, fire.y - 178), r: 54 };
  fire.r = Math.min(fire.r, Math.hypot(fire.x - flash.x, fire.y - flash.y) - flash.r - 12);
  return {
    wide: false,
    stick,
    stickZone: { x: 0, y: stick.y - 112, w: w * 0.45, h: h - stick.y + 112 },
    chip: { x: stick.x - 52, y: Math.max(top + 14, stick.y - 160), w: 104, h: 44 },
    fire,
    flash,
    reload: { x: w * 0.53, y: Math.max(top + 54, fire.y - 150), r: 42 }
  };
}

// The touch control under a canvas point, if any. Circles get a forgiving margin around them.
function blasterControlAt(p) {
  if (!blasterTouchUI()) return null;
  const L = blasterLayout(),
    near = (c, pad) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + pad,
    inBox = (b, pad) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
  if (inBox(L.chip, 10)) return 'chip';
  if (near(L.flash, 12)) return 'flash';
  if (near(L.reload, 12)) return 'reload';
  if (near(L.fire, 28)) return 'fire';
  if (blasterStickOn() && inBox(L.stickZone, 0)) return 'stick';
  return null;
}

function blasterToggleStick() {
  const on = !blasterStickOn();
  (state.stats ||= {}).blasterStick = on ? 1 : 0;
  save();
  sfx('ui');
  mini.flash = 1;
  mini.flashText = on ? 'THUMBSTICK ON · STEER, THEN FIRE' : 'THUMBSTICK OFF · YOUR FINGER IS THE SIGHT';
}

// How deep a point sits in the scroll band on each axis, -1 (left or top) to 1 (right or bottom). It
// builds gently from the band's inner edge to full at the room's edge.
function blasterEdge(x, y) {
  const E = BLASTER_EDGE,
    R = BLASTER_ROOM,
    d = v => (v <= 0 ? 0 : Math.min(1, v) ** BLASTER_EDGE_RAMP);
  return { x: d((x - (R - E)) / E) - d((E - x) / E), y: d((y - (R - E)) / E) - d((E - y) / E) };
}

// The edge arrows: one per side with gremlins past it, at their average height.
function blasterArrows() {
  const out = [];
  for (const side of [-1, 1]) {
    const off = mini.targets.filter(e => {
      if (!BLASTER_KINDS[e.kind] || e.mode === 'dying') return false;
      const x = shooterProjection(e).x;
      return side < 0 ? x < 0 : x > 600;
    });
    if (!off.length) continue;
    out.push({
      side,
      off,
      danger: off.some(e => e.mode === 'wind' || e.mode === 'leap' || e.kind === 'boss'),
      x: side < 0 ? 8 : 532,
      y: clamp(off.reduce((a, e) => a + shooterProjection(e).y, 0) / off.length, 150, 440)
    });
  }
  return out;
}

// A finger on an edge arrow turns to face what it points at: the jumpiest first, then the nearest.
function blasterArrowAt(p) {
  return blasterArrows().find(a => p.x >= a.x - 8 && p.x <= a.x + 68 && p.y >= a.y - 38 && p.y <= a.y + 38);
}

function blasterFollowArrow(a) {
  const rank = e =>
      (e.mode === 'leap' ? 3 : e.mode === 'wind' || e.kind === 'boss' ? 2 : 0) -
      Math.abs(shooterProjection(e).x - 300) / 2000,
    e = a.off.slice().sort((u, v) => rank(v) - rank(u))[0],
    p = shooterProjection(e),
    r = e.r || 1;
  blasterPan((p.x - (a.side < 0 ? 170 : 430)) / r, p.y < 60 || p.y > 560 ? (p.y - 300) / r : 0);
  mini.blasterPanned = true;
}

// p is in canvas coordinates. Presses on the touch controls never aim or shoot; anything else outside
// the room is ignored, except a mouse drag that looks around.
function blasterPressStart(id, p, how) {
  // The touch controls answer a mouse click too (a tablet with a trackpad).
  mini.blasterMouse = how !== 'touch';
  const r = blasterToRoom(p),
    control = how !== 'pan' ? blasterControlAt(p) : null;
  if (control) how = control;
  else if (!blasterInRoom(r) && how !== 'pan') return;
  else if (how === 'touch') {
    // An edge arrow gives way to a gremlin in view right under the finger.
    const arrow = blasterArrowAt(r);
    if (arrow && !blasterHitsAt(r.x, r.y).some(h => h.e.kind !== 'bottle')) {
      blasterFollowArrow(arrow);
      how = 'arrow';
    }
  }
  const b = { sx: r.x, sy: r.y, lastX: r.x, lastY: r.y, t: 0, how, moved: false, hold: false, scrolled: false };
  b.kx = b.ky = 0;
  mini.blasterPresses[id] = b;
  if (how === 'aim') blasterAimAt(r.x, r.y, 0);
  else if (how === 'stick') {
    // The stick centres where the thumb lands, unless it lands on the stick itself.
    const S = blasterLayout().stick,
      on = Math.hypot(p.x - S.x, p.y - S.y) <= S.r;
    b.cx = on ? S.x : p.x;
    b.cy = on ? S.y : p.y;
    blasterStickAt(b, p);
  } else if (how === 'fire') {
    if (!mini.blasterTrigger) mini.blasterTrigger = { t: 0 };
  } else if (how === 'flash') miniAction('assist');
  else if (how === 'reload') reloadBlaster();
  else if (how === 'chip') blasterToggleStick();
}

function blasterStickAt(b, p) {
  const R = BLASTER_STICK.r,
    dx = p.x - b.cx,
    dy = p.y - b.cy,
    d = Math.hypot(dx, dy),
    k = d > R ? R / d : 1;
  b.kx = (dx * k) / R;
  b.ky = (dy * k) / R;
}

function blasterFireFinger() {
  return Object.values(mini.blasterPresses || {}).some(b => b.how === 'fire');
}

function blasterPressMove(id, p) {
  const b = mini.blasterPresses && mini.blasterPresses[id];
  if (!b) return;
  const r = blasterToRoom(p),
    dx = r.x - b.lastX,
    dy = r.y - b.lastY;
  b.lastX = r.x;
  b.lastY = r.y;
  if (b.how === 'aim') {
    blasterAimAt(r.x, r.y, 0);
    return;
  }
  if (b.how === 'stick') {
    blasterStickAt(b, p);
    return;
  }
  if (b.how === 'pan') {
    blasterPan(dx * 1.8, dy * 1.1);
    mini.blasterPanned = true;
    return;
  }
  if (b.how !== 'touch') return;
  // A finger that slides carries the sight with it, anywhere in the room (past its edge the sight stays
  // on the edge), and keeps its charge.
  if (!b.moved) {
    if (Math.hypot(r.x - b.sx, r.y - b.sy) <= BLASTER_SLOP) return;
    b.moved = true;
  }
  blasterAimAt(r.x, r.y, 0);
}

function blasterPressEnd(id, cancel) {
  const b = mini.blasterPresses && mini.blasterPresses[id];
  if (!b) return;
  delete mini.blasterPresses[id];
  // FIRE shoots when the last finger on it lifts (charged if it was held), unless the press was lost.
  if (b.how === 'fire') {
    if (!mini.blasterTrigger || mini.fireHeld || blasterFireFinger()) return;
    if (cancel || mini.screen !== 'play' || mini.paused) mini.blasterTrigger = null;
    else blasterTriggerRelease();
    return;
  }
  if (cancel || (b.how !== 'touch' && b.how !== 'aim')) return;
  if (mini.screen !== 'play' || mini.paused) return;
  const charged = b.t >= BLASTER_CHARGE;
  if (b.how === 'aim') blasterQueueShot(mini.sight.x, mini.sight.y, charged);
  // Let go of a slide to shoot where the sight sits. Letting go in the edge band after it scrolled the
  // room was a look, not a shot.
  else if (b.moved) {
    const edge = blasterEdge(b.lastX, b.lastY);
    if (!(b.scrolled && (edge.x || edge.y))) blasterQueueShot(b.lastX, b.lastY, charged);
  } else blasterQueueShot(b.sx, b.sy, charged);
}

// A tap sweeps the sight to the spot, then the shot resolves against whatever is under it.
function blasterQueueShot(x, y, charged) {
  x = clamp(x, 0, BLASTER_ROOM);
  y = clamp(y, 0, BLASTER_ROOM);
  const d = Math.hypot(x - mini.sight.x, y - mini.sight.y),
    wait = d > 4 ? BLASTER_SWEEP : 0;
  blasterAimAt(x, y, wait);
  if (mini.blasterQueue.length >= 2) mini.blasterQueue.pop();
  mini.blasterQueue.push({ x, y, charged, wait });
  blasterDrainQueue(0);
}

function blasterDrainQueue(dt) {
  const q = mini.blasterQueue[0];
  if (!q) return;
  q.wait -= dt;
  if (q.wait > 0 || mini.shotCd > 0) return;
  mini.blasterQueue.shift();
  if (mini.reload > 0) {
    blasterPop(q.x, q.y - 28, 'RELOADING', '#9fb4c8');
    return;
  }
  blasterShoot(q.x, q.y, q.charged);
}

// FIRE button and Space: press to start, release to shoot. Held past BLASTER_CHARGE, it pierces.
function blasterTriggerPress() {
  if (mini.blasterTrigger) {
    if (!mini.fireHeld) blasterTriggerRelease();
    return;
  }
  if (mini.fireHeld) {
    mini.blasterTrigger = { t: 0 };
    return;
  }
  // The click that follows a held button's release already fired.
  if (mini.total - mini.blasterTriggerEnd < 0.3) return;
  fireBlaster();
}

function blasterTriggerRelease() {
  const charged = mini.blasterTrigger.t >= BLASTER_CHARGE;
  mini.blasterTrigger = null;
  mini.blasterTriggerEnd = mini.total;
  fireBlaster(undefined, undefined, charged);
}

function blasterHover(p) {
  mini.blasterMouse = true;
  mini.blasterMouseIn = true;
  blasterAimAt(p.x, p.y, 0);
}

function blasterChargeLevel() {
  let t = mini.blasterTrigger ? mini.blasterTrigger.t : 0;
  for (const b of Object.values(mini.blasterPresses || {}))
    if (b.how === 'aim' || (b.how === 'touch' && (b.hold || b.moved))) t = Math.max(t, b.t);
  return t < 0.15 ? 0 : clamp(t / BLASTER_CHARGE, 0, 1);
}

function blasterDropHeld() {
  mini.blasterPresses = {};
  mini.blasterTrigger = null;
  mini.blasterQueue = [];
}

// Every press arrives through touch(), which does not say what kind of pointer it was or which mouse
// button, and nothing reports a mouse that only hovers. This capture-phase listener fills both in for
// this game: it notes the pointer kind and button before touch() hears of the press, and mouse hover
// moves the sight (the cursor hides over the room).
function blasterPointerEvent(e) {
  const cv = $('miniCanvas'),
    active = mini.open && mini.id === BLASTER.id && mini.screen === 'play' && !mini.paused && !!mini.blasterPresses,
    onCanvas = e.target === cv,
    cursor = hide => {
      if (hide === blasterCursorHidden) return;
      cv.style.cursor = hide ? 'none' : '';
      blasterCursorHidden = hide;
    };
  if (!active) {
    cursor(false);
    return;
  }
  if (e.type === 'pointerdown') {
    if (!onCanvas) return;
    blasterPointerMeta = {
      id: e.pointerId,
      mouse: e.pointerType === 'mouse',
      pan: e.button === 1 || e.button === 2 || !!e.shiftKey
    };
  } else if (e.type === 'pointermove') {
    if (e.pointerType !== 'mouse' || mini.blasterPresses['p' + e.pointerId]) return;
    mini.blasterMouseIn = onCanvas;
    if (!onCanvas) {
      cursor(false);
      return;
    }
    const r = blasterToRoom(miniPoint(e));
    blasterHover(r);
    cursor(blasterInRoom(r));
  } else if (e.type === 'pointerout' && onCanvas && e.pointerType === 'mouse') mini.blasterMouseIn = false;
}

for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout'])
  window.addEventListener(type, blasterPointerEvent, true);

$('miniCanvas').addEventListener('contextmenu', e => {
  if (mini.open && mini.id === BLASTER.id) e.preventDefault();
});

// ---- Simulation ----
function updateShooter(dt) {
  blasterUpdateLook(dt);
  for (const k of ['shotCd', 'muzzle', 'aimFlash', 'hitFlash', 'lightBurst']) mini[k] = Math.max(0, mini[k] - dt);
  mini.gunKick = Math.max(0, mini.gunKick - dt * 6);
  mini.pump = Math.max(0, mini.pump - dt * 5);
  blasterUpdateInput(dt);
  blasterUpdateReload(dt);
  blasterUpdateSpawns(dt);
  blasterUpdateTargets(dt);
  blasterUpdateEffects(dt);
}

function blasterUpdateLook(dt) {
  const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0),
    ky = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  let dyaw = kx * 420 * dt,
    dpitch = ky * 220 * dt;
  if (kx || ky) mini.blasterPanned = true;
  // Mouse play: the room drifts when the sight nears an edge.
  if (mini.blasterMouse && mini.blasterMouseIn) {
    const { x, y } = mini.sight;
    if (x < 70) dyaw -= ((70 - x) / 70) * 560 * dt;
    if (x > 530) dyaw += ((x - 530) / 70) * 560 * dt;
    if (y < 90) dpitch -= ((90 - y) / 90) * 220 * dt;
    if (y > 540) dpitch += ((y - 540) / 60) * 220 * dt;
  }
  // Touch play: a sliding finger or the stick scrolls the room while the sight is in the edge band. A
  // slide scrolls by how deep the sight sits in the band; the stick also by how hard it pushes that way,
  // so easing off the stick eases off the turn.
  const drivers = Object.values(mini.blasterPresses).filter(
    b => (b.how === 'touch' && b.moved) || (b.how === 'stick' && Math.hypot(b.kx, b.ky) > BLASTER_STICK.dead)
  );
  if (drivers.length) {
    const edge = blasterEdge(mini.sight.x, mini.sight.y),
      yaw = mini.lookTarget.yaw,
      pitch = mini.lookTarget.pitch,
      slide = drivers.some(b => b.how === 'touch'),
      push = (axis, sign) =>
        slide ? 1 : Math.max(0, ...drivers.map(b => clamp((axis === 'x' ? b.kx : b.ky) * sign, 0, 1)));
    blasterPan(
      edge.x * push('x', Math.sign(edge.x)) * BLASTER_EDGE_YAW * dt,
      edge.y * push('y', Math.sign(edge.y)) * BLASTER_EDGE_PITCH * dt
    );
    if (Math.abs(mini.lookTarget.yaw - yaw) + Math.abs(mini.lookTarget.pitch - pitch) > 1e-6) {
      mini.blasterPanned = true;
      for (const b of drivers) b.scrolled = true;
    }
  }
  if (dyaw || dpitch) blasterPan(dyaw, dpitch);
  const ease = 1 - Math.exp(-dt * 22);
  mini.look.yaw += (mini.lookTarget.yaw - mini.look.yaw) * ease;
  mini.look.pitch += (mini.lookTarget.pitch - mini.look.pitch) * ease;
}

function blasterUpdateInput(dt) {
  if (mini.sweep) {
    const s = mini.sweep;
    s.t += dt;
    const u = clamp(s.t / s.dur, 0, 1),
      k = 1 - (1 - u) * (1 - u);
    mini.sight.x = s.fx + (s.tx - s.fx) * k;
    mini.sight.y = s.fy + (s.ty - s.fy) * k;
    if (u >= 1) mini.sweep = null;
  }
  if (mini.blasterTrigger) {
    if (mini.fireHeld || blasterFireFinger()) mini.blasterTrigger.t += dt;
    else blasterTriggerRelease();
  }
  for (const b of Object.values(mini.blasterPresses)) {
    b.t += dt;
    // The stick steers the sight: gentle near the middle, quick at the rim.
    const k = Math.hypot(b.kx, b.ky);
    if (b.how === 'stick' && k > BLASTER_STICK.dead) {
      const v = BLASTER_STICK.speed * k ** 1.6 * dt;
      blasterAimAt(mini.sight.x + (b.kx / k) * v, mini.sight.y + (b.ky / k) * v, 0);
    }
    if (b.how === 'touch' && !b.moved && !b.hold && b.t > 0.18) {
      b.hold = true;
      blasterAimAt(b.sx, b.sy, BLASTER_SWEEP);
    }
  }
  blasterDrainQueue(dt);
}

function blasterUpdateReload(dt) {
  if (mini.reload <= 0) return;
  mini.reloadT += dt;
  mini.reload -= dt;
  if (mini.reload <= 0) {
    mini.reload = 0;
    mini.ammo = Math.max(mini.ammo, mini.magazine);
    sfx('pump');
  }
}

// Spawns run to the final second; the last ten seconds of every watch are a rush.
function blasterUpdateSpawns(dt) {
  const T = blasterTuning(),
    watch = mini.limit / 3,
    rush = mini.phaseTime - mini.shift * watch > watch - 10;
  if (rush && !mini.rush) {
    mini.flash = 1.1;
    mini.flashText = 'RUSH · TEN SECONDS · EVERYTHING WANTS YOUR FACE';
    sfx('wave');
  }
  mini.rush = rush;
  blasterBossSchedule();
  mini.spawn -= dt;
  if (mini.spawn <= 0) {
    const alive = mini.targets.filter(e => BLASTER_KINDS[e.kind] && e.kind !== 'boss' && e.mode !== 'dying').length;
    if (alive < T.cap + (rush ? 1 : 0)) {
      spawnCrawler();
      mini.spawn = T.interval * (rush ? 0.6 : 1) * rand(0.85, 1.15);
    } else mini.spawn = 0.3;
  }
  mini.bottleT -= dt;
  if (mini.bottleT <= 0) {
    mini.bottleT = mini.targets.some(e => e.kind === 'bottle') ? 3 : rand(12, 18);
    if (mini.bottleT > 3) blasterSpawnBottle();
  }
}

// Ralph Jr. visits on the watches his level lists, once each. A visit that comes due while he is still
// in the room waits until he is gone, so there is never more than one of him.
function blasterBossSchedule() {
  const visits = BLASTER_RALPH[mini.tier] || [];
  if (!visits.includes(mini.shift) || mini.bossWatches[mini.shift]) return;
  if (mini.targets.some(e => e.kind === 'boss' && e.mode !== 'dying')) return;
  mini.bossWatches[mini.shift] = true;
  blasterSpawnBoss();
}

// Peek, duck, peek again, then go.
function blasterPeekCurve(u) {
  const ease = v => v * v * (3 - 2 * v);
  if (u < 0.22) return ease(u / 0.22);
  if (u < 0.42) return 1;
  if (u < 0.55) return 1 - 0.65 * ease((u - 0.42) / 0.13);
  if (u < 0.7) return 0.35 + 0.65 * ease((u - 0.55) / 0.15);
  return 1;
}

function blasterUpdateTargets(dt) {
  for (const e of mini.targets) {
    e.hit = Math.max(0, (e.hit || 0) - dt);
    if (e.kind === 'bottle') {
      e.life -= dt;
      if (e.life <= 0) e.dead = true;
      continue;
    }
    if (e.mode === 'dying') {
      e.dying -= dt;
      if (e.dying <= 0) e.dead = true;
      continue;
    }
    if (e.kind === 'boss') {
      blasterUpdateBoss(e, dt);
      continue;
    }
    e.stun = Math.max(0, (e.stun || 0) - dt);
    if (e.stun > 0) continue;
    e.age = (e.age || 0) + dt;
    if (e.mode === 'hide') {
      e.hideT += dt;
      const u = e.hideT / e.hideDur;
      e.peek = blasterPeekCurve(Math.min(1, u));
      e.x = e.home.x + e.peekOff.x * e.peek;
      e.y = e.home.y + e.peekOff.y * e.peek;
      if (u >= 1) {
        e.mode = 'crawl';
        e.crawlT = 0;
      }
    } else if (e.mode === 'crawl') {
      e.crawlT += dt;
      const q = clamp(e.crawlT / e.creepDur, 0, 1),
        pos = blasterAlong(e.path, q),
        hop = Math.abs(Math.sin(((q * e.len) / 30) * Math.PI)) * 6 * e.s;
      if (dt > 0) {
        e.vx = (pos.x - e.bx) / dt;
        e.vy = (pos.y - e.by) / dt;
      }
      e.bx = pos.x;
      e.by = pos.y;
      e.x = pos.x;
      e.y = pos.y - hop;
      if (q >= 1) {
        e.mode = 'wind';
        e.wind = e.windMax;
        e.vx = e.vy = 0;
        e.y = pos.y;
        sfx('stun');
      }
    } else if (e.mode === 'wind') {
      e.wind -= dt;
      if (e.wind <= 0) {
        e.mode = 'leap';
        e.leap = 0;
        sfx('leap');
      }
    } else if (e.mode === 'leap') {
      e.leap += dt;
      if (e.leap >= e.leapDuration) {
        e.dead = true;
        blasterFaceHit(e);
      }
    }
  }
  mini.targets = mini.targets.filter(e => !e.dead);
}

function blasterUpdateBoss(e, dt) {
  const pace = mini.rules.mini;
  e.stun = Math.max(0, e.stun - dt);
  if (e.mode === 'drop') {
    e.dropT += dt;
    if (e.dropT >= 0.7) {
      e.mode = 'idle';
      e.cycleT = 1.6 / pace;
      sfx('explode');
    }
    return;
  }
  if (e.stun > 0) return;
  if (e.mode === 'idle' || e.mode === 'stagger') {
    e.cycleT -= dt;
    if (e.cycleT > 0) return;
    e.mode = 'roar';
    e.cycleT = 1.6 / pace;
    e.roarHits = 0;
    e.roars++;
    sfx('bomb');
    if (e.roars === 1) {
      mini.flash = 1.4;
      mini.flashText = 'PACIFIER OUT · SHOOT THE MOUTH';
    }
    // Every other roar shakes a kid loose.
    if (e.roars % 2 === 0) spawnCrawler('crawler');
  } else if (e.mode === 'roar') {
    e.cycleT -= dt;
    if (e.cycleT > 0) return;
    if (e.roarHits >= 2) {
      e.mode = 'stagger';
      e.cycleT = 2.4 / pace;
      blasterPop(shooterProjection(e).x, 150, 'FLINCHED', '#ffd7a0');
    } else {
      e.mode = 'lunge';
      e.leap = 0;
      e.leapDuration = 0.85 / Math.sqrt(pace);
      sfx('leap');
    }
  } else if (e.mode === 'lunge') {
    e.leap += dt;
    if (e.leap >= e.leapDuration) {
      blasterFaceHit(e);
      e.mode = 'return';
    }
  } else if (e.mode === 'return') {
    e.leap -= dt * 2;
    if (e.leap <= 0) {
      e.leap = 0;
      e.mode = 'idle';
      e.cycleT = 2.4 / pace;
    }
  }
}

function blasterFaceHit(e) {
  const p = shooterProjection(e);
  mini.splat = { t: 0, x: clamp(p.x, 200, 400), y: clamp(p.y, 230, 370) };
  mini.hitFlash = 0.45;
  sfx('squelch');
  miniOops(
    e.kind === 'boss'
      ? 'RALPH JR. GOT YOUR FACE · SHOOT THE MOUTH WHEN HE ROARS'
      : 'GOT YOUR FACE · SHOOT BEFORE THE ORANGE RING CLOSES'
  );
}

function blasterUpdateEffects(dt) {
  for (const list of ['tracers', 'pops', 'captions']) {
    for (const p of mini[list]) p.t -= dt;
    mini[list] = mini[list].filter(p => p.t > 0);
  }
  for (const d of mini.debris) {
    d.t -= dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 900 * dt;
    d.rot += d.spin * dt;
  }
  mini.debris = mini.debris.filter(d => d.t > 0);
  if (mini.splat) {
    mini.splat.t += dt;
    if (mini.splat.t > 1.35) mini.splat = null;
  }
}

// ---- Drawing ----
const blasterHash = n => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

let blasterMaskCanvas = null;

// The canvas: the blanket around the room, the room itself (clipped to its 600 × 600, in room
// coordinates), then the touch controls (or, for a mouse, the key legend) in canvas coordinates.
function drawShooter(g) {
  // Held presses never survive a pause; otherwise resuming would fire a shot nobody asked for.
  if (mini.paused) blasterDropHeld();
  const B = blasterRoomBox();
  blasterGutters(g, B);
  g.save();
  g.translate(B.x, B.y);
  g.beginPath();
  g.rect(0, 0, BLASTER_ROOM, BLASTER_ROOM);
  g.clip();
  blasterRoom(g);
  g.restore();
  blasterControlsArt(g);
}

function blasterRoom(g) {
  rect(g, 0, 0, 600, 600, '#081324');
  blasterLayer(g, 'far', blasterFarBack);
  blasterTargets(g, 'far', true);
  blasterLayer(g, 'far', blasterFarFront);
  blasterTargets(g, 'far', false);
  blasterTargets(g, 'mid', true);
  blasterLayer(g, 'mid', blasterMid);
  blasterBottles(g);
  blasterTargets(g, 'mid', false);
  blasterMoonbeam(g);
  blasterTargets(g, 'near', true);
  blasterLayer(g, 'near', blasterNear);
  blasterTargets(g, 'near', false);
  blasterDarkness(g);
  blasterBeamGlow(g);
  blasterEyes(g);
  blasterRings(g);
  blasterLeapers(g);
  blasterDebris(g);
  blasterGunLayer(g);
  blasterSightMark(g);
  blasterHud(g);
  blasterHints(g);
  if (mini.splat) blasterSplat(g);
  if (mini.hitFlash > 0) {
    g.globalAlpha = mini.hitFlash;
    rect(g, 0, 0, 600, 600, '#b8567b');
    g.globalAlpha = 1;
  }
}

function blasterLayer(g, layer, art) {
  const o = blasterOffset(BLASTER_LAYERS[layer].rate);
  g.save();
  g.translate(o.x, o.y);
  art(g);
  g.restore();
}

function blasterFlying(e) {
  return e.mode === 'leap' || e.mode === 'lunge' || e.mode === 'return' || !!e.deathP;
}

function blasterTargets(g, layer, hidden) {
  const list = mini.targets.filter(
    e => BLASTER_KINDS[e.kind] && e.layer === layer && !blasterFlying(e) && (e.mode === 'hide') === hidden
  );
  list.sort((a, b) => a.y - b.y);
  for (const e of list) blasterDrawGremlin(g, e, shooterProjection(e), 1);
}

function blasterDrawGremlin(g, e, p, alpha) {
  const s = p.s,
    k = BLASTER_KINDS[e.kind],
    t = mini.total * 2 + e.id;
  let a = alpha * (e.hit > 0 ? 0.55 : 1),
    crouch = 0;
  g.save();
  g.translate(p.x, p.y);
  if (e.mode === 'dying') {
    const d = 1 - clamp(e.dying / (e.kind === 'boss' ? 1 : 0.45), 0, 1);
    g.rotate(d * 2.4 * (e.id % 2 ? 1 : -1));
    g.scale(1 - d * 0.55, 1 - d * 0.55);
    a *= 1 - d;
  } else if (e.mode === 'crawl') g.rotate(Math.sin(e.age * 9) * 0.12);
  else if (e.mode === 'wind') {
    crouch = 1 - clamp(e.wind / e.windMax, 0, 1);
    g.translate(Math.sin(mini.total * 55) * 1.6 * crouch, 6 * crouch * s);
    g.scale(1 + 0.08 * crouch, 1 - 0.14 * crouch);
  }
  g.globalAlpha = a;
  if (e.kind === 'pouncer') blasterPouncerLegs(g, s, crouch);
  if (e.kind === 'boss') blasterRalphJr(g, e, s, t);
  else gremlin(g, 0, 30 * s, s, k.art, t);
  if (e.kind === 'helmet' && e.helmet) blasterBedpan(g, 0, -3 * s, s);
  if (e.kind === 'bruiser') blasterBruiserGear(g, s);
  g.restore();
  g.globalAlpha = 1;
}

// A steel bedpan worn as a helmet, handle and all.
function blasterBedpan(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  path(
    g,
    p => {
      p.moveTo(-21, 2);
      p.quadraticCurveTo(-21, -21, 0, -22);
      p.quadraticCurveTo(21, -21, 21, 2);
      p.closePath();
    },
    gradient(g, -21, -22, 30, 24, '#e6eff2', '#7f97a3'),
    '#40535c',
    1.4
  );
  rr(g, -24, -1, 48, 6, 3, '#9fb2bb');
  rr(g, 19, -8, 16, 6, 3, '#9fb2bb');
  ellipse(g, -8, -12, 4, 2.5, '#ffffff88');
  g.restore();
}

function blasterBruiserGear(g, s) {
  line(g, [[-15 * s, -9 * s], [-3 * s, -4 * s]], '#5b2b1e', 3.5 * s);
  line(g, [[3 * s, -4 * s], [16 * s, -10 * s]], '#5b2b1e', 3.5 * s);
  g.save();
  g.translate(-11 * s, -12 * s);
  g.rotate(0.5);
  rr(g, -7 * s, -2 * s, 14 * s, 4 * s, 1.5 * s, '#f3dcb5');
  rr(g, -2 * s, -7 * s, 4 * s, 14 * s, 1.5 * s, '#f3dcb5');
  g.restore();
  rr(g, -17 * s, 24 * s, 34 * s, 5 * s, 2 * s, '#e9e1c8');
}

function blasterPouncerLegs(g, s, crouch) {
  for (const side of [-1, 1])
    line(
      g,
      [
        [side * 12 * s, 22 * s],
        [side * (27 + 6 * crouch) * s, (33 - 9 * crouch) * s],
        [side * 15 * s, (45 - 6 * crouch) * s]
      ],
      '#7a5a8e',
      4 * s
    );
}

// Ralph Jr.: party crown, bib, and a pacifier that pops out when he roars.
function blasterRalphJr(g, e, s, t) {
  gremlin(g, 0, 30 * s, s, 0, t);
  poly(
    g,
    [
      [-12 * s, -16 * s],
      [-8 * s, -30 * s],
      [-2 * s, -20 * s],
      [3 * s, -32 * s],
      [8 * s, -20 * s],
      [13 * s, -29 * s],
      [14 * s, -15 * s]
    ],
    '#ffd447'
  );
  label(g, 'JR', 1 * s, -18 * s, 5 * s, '#8a5a12', 'center');
  rr(g, -12 * s, 24 * s, 24 * s, 8 * s, 3 * s, '#f6f1df');
  label(g, 'LIL R', 0, 30 * s, 4 * s, '#c25b6e', 'center');
  if (blasterBossOpen(e)) {
    ellipse(g, 2 * s, 17 * s, 12 * s, 9 * s, '#2b0b18');
    for (let i = -2; i <= 2; i++) {
      const tx = (2 + i * 4) * s;
      poly(g, [[tx - 1.6 * s, 9 * s], [tx + 1.6 * s, 9 * s], [tx, 12 * s]], '#fff3cd');
    }
    const pulse = 0.6 + 0.4 * Math.sin(mini.total * 14);
    glow(g, 2 * s, 18 * s, 16 * s, '#ff5d7a66');
    ellipse(g, 2 * s, 18 * s, (2 + 3 * pulse) * s, 5 * s, '#ff5d7a');
    line(g, [[13 * s, 11 * s], [18 * s, 27 * s]], '#f6f1df', 1.2 * s);
    ellipse(g, 18 * s, 29 * s, 4 * s, 4 * s, '#8fd3ff');
  } else {
    ellipse(g, 2 * s, 16 * s, 8 * s, 5 * s, '#8fd3ff');
    ellipse(g, 2 * s, 16 * s, 3.4 * s, 3.4 * s, '#f6f1df');
    g.strokeStyle = '#f6f1df';
    g.lineWidth = 1.4 * s;
    g.beginPath();
    g.arc(2 * s, 20 * s, 3 * s, 0, Math.PI);
    g.stroke();
  }
}

// Far wall: moonlit window, the 3:07 clock, a whiteboard, and a door open just a crack.
function blasterFarBack(g) {
  rect(g, -200, -260, 2200, 600, gradient(g, 0, -260, 0, 600, '#0b1730', '#1c3249'));
  rect(g, -200, 248, 2200, 84, '#15283d');
  line(g, [[-200, 248], [2000, 248]], '#2b4862', 3);
  rect(g, -200, 330, 2200, 200, gradient(g, 0, 330, 0, 200, '#172a3d', '#0e1b2a'));
  line(g, [[-200, 331], [2000, 331]], '#2f4c66', 4);
  rr(g, 470, 30, 220, 180, 8, '#223a52');
  rect(g, 480, 40, 200, 160, gradient(g, 0, 40, 0, 160, '#071331', '#21406a'));
  for (let i = 0; i < 16; i++) {
    const tw = 0.5 + 0.5 * Math.sin(time * 2 + i * 1.7);
    g.globalAlpha = 0.3 + tw * 0.6;
    ellipse(g, 488 + ((i * 53) % 185), 48 + ((i * 37) % 90), 1.2, 1.2, '#e8ecc8');
  }
  g.globalAlpha = 1;
  glow(g, 632, 82, 70, '#d9e6ff30');
  ellipse(g, 632, 82, 18, 18, '#f3efd2');
  ellipse(g, 626, 78, 4, 3, '#d8d3b4');
  ellipse(g, 638, 88, 3, 2.5, '#d8d3b4');
  for (let i = 0; i < 7; i++) {
    const bx = 480 + i * 29,
      bh = 28 + ((i * 17) % 34);
    rect(g, bx, 200 - bh, 26, bh, '#0d1a30');
    for (let j = 0; j < 3; j++) {
      if ((i + j) % 3 !== 1) rect(g, bx + 5 + (j % 2) * 10, 206 - bh + j * 8, 4, 4, '#f3d98a88');
    }
  }
  line(g, [[580, 40], [580, 200]], '#2a425a', 6);
  line(g, [[480, 120], [680, 120]], '#2a425a', 5);
  rr(g, 456, 200, 248, 11, 4, '#2c4660');
  ellipse(g, 800, 110, 27, 27, '#3b5a74');
  ellipse(g, 800, 110, 23, 23, '#122338');
  line(g, [[800, 110], [800, 92]], '#9fd8b8', 3);
  line(g, [[800, 110], [811, 117]], '#9fd8b8', 3);
  label(g, 'AM', 800, 128, 7, '#6e9a8c', 'center');
  rr(g, 870, 110, 140, 86, 5, '#c9d3cb', '#5d7383', 3);
  label(g, 'NURSE: BEV', 882, 132, 10, '#3f6d8a');
  label(g, 'GOAL: SLEEP', 882, 152, 10, '#3f6d8a');
  line(g, [[880, 148], [962, 148]], '#c0504d', 2);
  label(g, 'SURVIVE', 882, 174, 12, '#c0504d');
  poster(g, 1050, 108, 1);
  rr(g, 1168, 62, 154, 276, 6, '#203a51');
  rect(g, 1180, 74, 130, 260, gradient(g, 0, 74, 0, 260, '#1f3d47', '#3b6b68'));
  rect(g, 1180, 300, 130, 34, '#5d8f84');
  rr(g, 1130, 188, 14, 22, 3, '#3c566c');
}

function blasterFarFront(g) {
  line(g, [[428, 26], [732, 26]], '#3e5a6e', 4);
  for (const x0 of [436, 670]) {
    rr(g, x0, 28, 54, 196, 10, gradient(g, x0, 0, 54, 0, '#24525a', '#173b45'));
    for (let i = 1; i < 4; i++) line(g, [[x0 + i * 13.5, 34], [x0 + i * 13.5 + 3, 220]], '#0d262e88', 2);
  }
  path(
    g,
    p => {
      p.moveTo(1180, 74);
      p.lineTo(1290, 82);
      p.lineTo(1290, 328);
      p.lineTo(1180, 334);
      p.closePath();
    },
    gradient(g, 1180, 0, 110, 0, '#33536b', '#253f55'),
    '#152a3b',
    2
  );
  rr(g, 1205, 110, 60, 46, 4, '#16303f');
  label(g, 'ROOM 10', 1235, 182, 10, '#9bb7c4', 'center');
  ellipse(g, 1278, 210, 5, 5, '#c7d3c0');
  rect(g, 1180, 333, 130, 3, '#bfe7d866');
}

// Middle of the room: dresser, IV stand, snack bin, bedside monitor, tray table, sofa, cabinets.
function blasterMid(g) {
  rect(g, -400, 362, 2600, 460, gradient(g, 0, 362, 0, 300, '#1b2e40', '#0c1825'));
  line(g, [[-400, 363], [2200, 363]], '#3f5f73', 4);
  for (let x = -400; x < 2200; x += 120) line(g, [[x, 366], [900 + (x - 900) * 2.2, 820]], '#9fb4c010', 2);
  for (let y = 410; y < 820; y += 60) line(g, [[-400, y], [2200, y]], '#9fb4c00c', 2);
  plant(g, 110, 368, 1.6);
  line(g, [[396, 278], [404, 236], [430, 168]], '#cfd8dc66', 1.5);
  ellipse(g, 432, 140, 24, 29, '#d86a8a');
  ellipse(g, 424, 130, 6, 9, '#ffffff44');
  label(g, 'GET', 432, 136, 9, '#ffe9ef', 'center');
  label(g, 'WELL', 432, 147, 9, '#ffe9ef', 'center');
  label(g, '-ISH', 432, 158, 8, '#ffe9ef', 'center');
  cabinet(g, 190, 365, 230);
  rr(g, 272, 240, 64, 38, 5, '#2c4a55', '#7f9a8c', 2);
  label(g, 'MACY', 304, 257, 11, '#c6dcc0', 'center');
  label(g, 'HOME TEAM', 304, 270, 7, '#9fbfb2', 'center');
  ivStand(g, 490, 372, 1.45);
  blasterBin(g, 600, 368);
  cabinet(g, 688, 365, 184);
  monitor(g, 785, 268);
  table(g, 925, 300, 150, 50);
  blasterPudding(g, 1003, 300);
  sofa(g, 1120, 368, 320, '#4d6880');
  table(g, 1480, 318, 90, 40);
  plant(g, 1625, 368, 1.3);
  cabinet(g, 1680, 365, 130);
}

function blasterBin(g, x, y) {
  shadow(g, x, y + 2, 44, 8);
  path(
    g,
    p => {
      p.moveTo(x - 38, y - 66);
      p.lineTo(x + 38, y - 66);
      p.lineTo(x + 32, y);
      p.lineTo(x - 32, y);
      p.closePath();
    },
    gradient(g, x - 38, 0, 76, 0, '#b8434f', '#7d2633')
  );
  rr(g, x - 42, y - 74, 84, 12, 4, '#d0596a');
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 - 1.571;
    ellipse(g, x + Math.cos(a) * 7, y - 40 + Math.sin(a) * 7, 6, 6, '#f6d36a');
  }
  ellipse(g, x, y - 40, 3, 3, '#7d2633');
  label(g, 'MOSTLY', x, y - 17, 8, '#f6d36a', 'center');
  label(g, 'SNACKS', x, y - 7, 8, '#f6d36a', 'center');
}

function blasterPudding(g, x, y) {
  path(
    g,
    p => {
      p.moveTo(x - 11, y - 18);
      p.lineTo(x + 11, y - 18);
      p.lineTo(x + 8, y);
      p.lineTo(x - 8, y);
      p.closePath();
    },
    '#e9dfc4'
  );
  ellipse(g, x, y - 18, 11, 3, '#8a5a3c');
  line(g, [[x + 4, y - 18], [x + 16, y - 34]], '#c9d3d6', 3);
}

// Near the camera: Macy's footboard, the bed rails, the blanket, and her volleyball.
function blasterNear(g) {
  rr(g, 752, 440, 296, 96, 18, gradient(g, 0, 440, 0, 96, '#5a7886', '#2b4351'), '#1b2f3a', 2);
  rr(g, 868, 452, 64, 54, 5, '#d8c79c', '#8a7552', 1.5);
  rect(g, 890, 446, 20, 10, '#9aa7ad');
  label(g, 'MACY', 900, 474, 10, '#5a4a32', 'center');
  label(g, 'VIBES:', 900, 487, 8, '#5a4a32', 'center');
  label(g, 'FERAL', 900, 499, 9, '#a3473f', 'center');
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -380 : 1160,
      x1 = side < 0 ? 640 : 2180;
    line(g, [[x0, 468], [x1, 468]], '#8aa2ad', 9);
    line(g, [[x0, 492], [x1, 492]], '#6b8590', 6);
    for (let x = x0 + 60; x < x1; x += 240) line(g, [[x, 466], [x, 560]], '#7e97a2', 8);
  }
  path(
    g,
    p => {
      p.moveTo(-420, 820);
      p.lineTo(-420, 560);
      p.bezierCurveTo(200, 540, 560, 528, 760, 520);
      p.quadraticCurveTo(820, 488, 870, 512);
      p.quadraticCurveTo(905, 520, 940, 510);
      p.quadraticCurveTo(985, 484, 1040, 518);
      p.bezierCurveTo(1300, 528, 1700, 540, 2220, 560);
      p.lineTo(2220, 820);
      p.closePath();
    },
    gradient(g, 0, 490, 0, 330, '#3d7376', '#14303a')
  );
  for (const [x, y] of [[300, 600], [640, 572], [1180, 580], [1520, 610]])
    path(
      g,
      p => {
        p.moveTo(x - 70, y);
        p.quadraticCurveTo(x, y - 18, x + 80, y + 6);
      },
      null,
      '#0f262f77',
      3
    );
  ellipse(g, 1110, 520, 24, 24, '#f4efdc');
  for (const a of [-0.6, 0.4, 1.4])
    path(
      g,
      p => {
        p.moveTo(1110 + Math.cos(a) * 24, 520 + Math.sin(a) * 24);
        p.quadraticCurveTo(1110, 520, 1110 + Math.cos(a + 2.4) * 24, 520 + Math.sin(a + 2.4) * 24);
      },
      null,
      '#4f8fb3',
      2.5
    );
}

function blasterBottles(g) {
  for (const e of mini.targets) {
    if (e.kind !== 'bottle') continue;
    const p = shooterProjection(e),
      fade = Math.min(1, e.life / 2),
      bob = Math.sin(time * 4 + e.id) * 2;
    g.globalAlpha = fade;
    glow(g, p.x, p.y + bob, 30, '#ffb34766');
    rr(g, p.x - 7, p.y - 14 + bob, 14, 26, 5, '#ff9f3a', '#7a3d0e', 1.2);
    rr(g, p.x - 4, p.y - 20 + bob, 8, 7, 2, '#f6f1df');
    rr(g, p.x - 5, p.y - 4 + bob, 10, 9, 2, '#fff2c4');
    label(g, 'J', p.x, p.y + 4 + bob, 8, '#c25b1e', 'center');
  }
  g.globalAlpha = 1;
}

// Light from the window falls across the floor.
function blasterMoonbeam(g) {
  const a = blasterProject('far', 482, 204),
    b = blasterProject('far', 678, 204),
    c = blasterProject('mid', 980, 470),
    d = blasterProject('mid', 700, 470);
  path(
    g,
    p => {
      p.moveTo(a.x, a.y);
      p.lineTo(b.x, b.y);
      p.lineTo(c.x, c.y);
      p.lineTo(d.x, d.y);
      p.closePath();
    },
    '#c9dcff10'
  );
}

function blasterRoomLights() {
  const w = blasterProject('far', 580, 120),
    d = blasterProject('far', 1300, 220),
    m = blasterProject('mid', 785, 228),
    c = blasterProject('far', 800, 110);
  return [
    { x: w.x, y: w.y, r: 150, a: 0.45 },
    { x: d.x, y: d.y, r: 95, a: 0.32 },
    { x: m.x, y: m.y, r: 62, a: 0.35 },
    { x: c.x, y: c.y, r: 32, a: 0.3 }
  ];
}

// Darkness with a flashlight-shaped hole, built on a half-resolution canvas (the edges are soft anyway).
function blasterDarkness(g) {
  if (!blasterMaskCanvas) {
    blasterMaskCanvas = document.createElement('canvas');
    blasterMaskCanvas.width = 300;
    blasterMaskCanvas.height = 300;
  }
  const m = blasterMaskCanvas.getContext('2d'),
    S = mini.sight,
    M = blasterMuzzle(),
    burst = mini.lightBurst > 0 ? Math.min(1, mini.lightBurst * 2) : 0,
    len = Math.hypot(S.x - M.x, S.y - M.y) || 1,
    ux = (S.x - M.x) / len,
    uy = (S.y - M.y) / len,
    far = len + 80;
  m.setTransform(0.5, 0, 0, 0.5, 0, 0);
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, 600, 600);
  m.globalAlpha = 1;
  rect(m, 0, 0, 600, 600, `rgba(3, 9, 22, ${0.86 - burst * 0.6})`);
  m.globalCompositeOperation = 'destination-out';
  // Three widening passes give the cone a soft edge.
  for (const [w, a] of [[1.35, 0.22], [1, 0.3], [0.62, 0.38]]) {
    const w0 = 12 * w,
      w1 = 112 * w;
    path(
      m,
      p => {
        p.moveTo(M.x - uy * w0, M.y + ux * w0);
        p.lineTo(M.x + ux * far - uy * w1, M.y + uy * far + ux * w1);
        p.lineTo(M.x + ux * far + uy * w1, M.y + uy * far - ux * w1);
        p.lineTo(M.x + uy * w0, M.y - ux * w0);
        p.closePath();
      },
      `rgba(0, 0, 0, ${a})`
    );
  }
  const spot = m.createRadialGradient(S.x, S.y, 0, S.x, S.y, 135);
  spot.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
  spot.addColorStop(0.45, 'rgba(0, 0, 0, 0.7)');
  spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
  m.fillStyle = spot;
  m.fillRect(S.x - 135, S.y - 135, 270, 270);
  // Spill from the flashlight keeps the blanket and bed rail readable.
  const lights = [...blasterRoomLights(), { x: M.x - 40, y: 600, r: 230, a: 0.42 }];
  if (mini.muzzle > 0) lights.push({ x: M.x, y: M.y + 40, r: 300, a: 0.85 });
  for (const l of lights) {
    const z = m.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    z.addColorStop(0, `rgba(0, 0, 0, ${l.a})`);
    z.addColorStop(1, 'rgba(0, 0, 0, 0)');
    m.fillStyle = z;
    m.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  m.globalCompositeOperation = 'source-over';
  g.drawImage(blasterMaskCanvas, 0, 0, 600, 600);
  // The muzzle flash warms the bed rail and blanket.
  if (mini.muzzle > 0) {
    g.globalCompositeOperation = 'lighter';
    glow(g, M.x, M.y + 60, 260, '#ffcf7a30');
    g.globalCompositeOperation = 'source-over';
  }
}

// The visible cone, the hot spot, and dust drifting through the beam.
function blasterBeamGlow(g) {
  const M = blasterMuzzle(),
    S = mini.sight,
    len = Math.hypot(S.x - M.x, S.y - M.y) || 1,
    ux = (S.x - M.x) / len,
    uy = (S.y - M.y) / len,
    far = len + 70;
  path(
    g,
    p => {
      p.moveTo(M.x - uy * 10, M.y + ux * 10);
      p.lineTo(M.x + ux * far - uy * 100, M.y + uy * far + ux * 100);
      p.lineTo(M.x + ux * far + uy * 100, M.y + uy * far - ux * 100);
      p.lineTo(M.x + uy * 10, M.y - ux * 10);
      p.closePath();
    },
    '#fff3c80c'
  );
  glow(g, S.x, S.y, 95, '#fff2c41c');
  for (let i = 0; i < 26; i++) {
    const u = 0.12 + ((blasterHash(i) + time * (0.015 + blasterHash(i + 40) * 0.03)) % 1) * 1.05,
      v = Math.sin(time * (0.3 + blasterHash(i + 9) * 0.5) + i * 1.7) * 0.85,
      w = 10 + 92 * Math.min(1, u),
      r = 0.9 + blasterHash(i + 5) * 1.4,
      twinkle = 0.6 + 0.4 * Math.sin(time * 3 + i);
    g.globalAlpha = clamp((1 - Math.abs(v)) * (0.25 + 0.35 * blasterHash(i + 3)) * twinkle, 0, 1);
    ellipse(g, M.x + ux * len * u - uy * v * w, M.y + uy * len * u + ux * v * w, r, r, '#fff6d8');
  }
  g.globalAlpha = 1;
}

function blasterLight(x, y) {
  const S = mini.sight;
  let lit = clamp(1 - (Math.hypot(x - S.x, y - S.y) - 55) / 90, 0, 1);
  if (mini.lightBurst > 0) lit = Math.max(lit, 0.8);
  if (mini.muzzle > 0) lit = Math.max(lit, 0.6);
  return lit;
}

function blasterBlink(e) {
  const period = 2.4 + (e.id % 5) * 0.37,
    ph = (time + e.id * 0.71) % period;
  return ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
}

// Out of the beam, a gremlin is a pair of glowing, blinking eyes.
function blasterEyes(g) {
  for (const e of mini.targets) {
    if (!BLASTER_KINDS[e.kind] || e.mode === 'dying' || e.mode === 'drop' || blasterFlying(e)) continue;
    if (e.mode === 'hide' && e.peek < 0.4) continue;
    const p = shooterProjection(e),
      s = p.s,
      lit = blasterLight(p.x, p.y);
    if (lit > 0.85 || p.x < -40 || p.x > 640) continue;
    const shut = blasterBlink(e),
      col = BLASTER_KINDS[e.kind].eye;
    g.globalAlpha = 1 - lit;
    for (const ex of [-7, 8]) {
      const x = p.x + ex * s,
        y = p.y + 3 * s;
      glow(g, x, y, 11 * s, col + '44');
      ellipse(g, x, y, 3.4 * s, Math.max(0.5, 4 * s * (1 - shut)), col);
      if (shut < 0.5) ellipse(g, x + 0.6 * s, y + 0.4 * s, 1 * s, 2.6 * s, '#1d2a24');
    }
  }
  g.globalAlpha = 1;
}

// Wind-up rings close on the gremlin; helmets and bruisers show what they have left.
function blasterRings(g) {
  for (const e of mini.targets) {
    if (!BLASTER_KINDS[e.kind] || e.mode === 'dying' || blasterFlying(e)) continue;
    const p = shooterProjection(e),
      s = p.s;
    if (e.mode === 'wind') {
      const left = clamp(e.wind / e.windMax, 0, 1),
        col = e.kind === 'pouncer' ? '#ff7fb6' : '#f3a35c';
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x, p.y + 8 * s, 22 * s + 26 * left, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      g.stroke();
      if (mini.tier === 0 || left < 0.5) label(g, 'JUMPING!', p.x, p.y - 26 * s - 6, 12, col, 'center');
    }
    if (e.stun > 0) label(g, '✦ ✦', p.x, p.y - 24 * s, 16, '#e7ecad', 'center');
    if (e.kind === 'boss' && e.mode !== 'drop') {
      rr(g, p.x - 48, p.y - 36 * s - 12, 96, 9, 4, '#2a0f1acc');
      rr(g, p.x - 46, p.y - 36 * s - 10, 92 * clamp(e.hp / e.maxHp, 0, 1), 5, 2, '#ff6b7f');
      if (blasterBossOpen(e)) label(g, 'MOUTH!', p.x + 2 * s, p.y + 36 * s + 14, 13, '#ff9aa8', 'center');
    } else if (e.maxHp > 1 && e.mode !== 'hide' && blasterLight(p.x, p.y) > 0.3) {
      for (let i = 0; i < e.maxHp; i++) {
        ellipse(g, p.x - (e.maxHp - 1) * 5 + i * 10, p.y - 22 * s, 3.5, 3.5, i < e.hp ? '#ffe7a8' : '#40505a');
      }
    }
  }
}

// Leapers fly at the lens with a short smear of motion blur.
function blasterLeapers(g) {
  const fly = mini.targets.filter(e => BLASTER_KINDS[e.kind] && blasterFlying(e));
  fly.sort((a, b) => shooterProjection(a).s - shooterProjection(b).s);
  for (const e of fly) {
    if (!e.deathP && e.mode !== 'return') {
      for (const back of [0.14, 0.07]) {
        const ghost = blasterProjectAt(e, Math.max(0, e.leap - back * e.leapDuration));
        blasterDrawGremlin(g, e, ghost, 0.16);
      }
    }
    blasterDrawGremlin(g, e, shooterProjection(e), 1);
  }
}

function blasterDebris(g) {
  for (const d of mini.debris) {
    g.save();
    g.translate(d.x, d.y);
    g.rotate(d.rot);
    g.globalAlpha = Math.min(1, d.t * 2);
    blasterBedpan(g, 0, 0, d.s);
    g.restore();
  }
  g.globalAlpha = 1;
}

function blasterGunLayer(g) {
  for (const tr of mini.tracers) {
    const a = tr.t / (tr.charged ? 0.16 : 0.09);
    g.globalAlpha = clamp(a, 0, 1);
    if (tr.charged) {
      line(g, [[tr.x0, tr.y0], [tr.x1, tr.y1]], '#b9ff9a', 14);
      line(g, [[tr.x0, tr.y0], [tr.x1, tr.y1]], '#ffffff', 4);
    } else {
      const k = 1 - a,
        hx = tr.x0 + (tr.x1 - tr.x0) * k,
        hy = tr.y0 + (tr.y1 - tr.y0) * k,
        tail = [tr.x0 + (tr.x1 - tr.x0) * k * 0.6, tr.y0 + (tr.y1 - tr.y0) * k * 0.6];
      line(g, [tail, [hx, hy]], tr.hot ? '#ffc47a' : '#d9ffb0', 4);
      ellipse(g, hx, hy, 5, 5, tr.hot ? '#ffb347' : '#a6ff8f');
    }
  }
  g.globalAlpha = 1;
  const pose = blasterGunPose(),
    reloading = mini.reload > 0;
  blasterGun(g, pose.x, pose.y, pose.a, {
    scale: 0.8,
    ammo: mini.ammo,
    mag: mini.magazine,
    charge: blasterChargeLevel(),
    hot: mini.hot > 0,
    pump: reloading ? Math.abs(Math.sin(mini.reloadT * 9)) : Math.sin(mini.pump * Math.PI)
  });
  if (mini.muzzle > 0) {
    const M = blasterMuzzle();
    glow(g, M.x, M.y, 80, '#fff1b088');
    spark(g, M.x, M.y, '#fff4c8', 1.8);
  }
}

// The toy blaster: pump grip, flashlight, ammo pips and a charge window that glows.
function blasterGun(g, x, y, ang, o) {
  const pump = (o.pump || 0) * 24,
    mag = o.mag || BLASTER_MAGAZINE,
    ammo = o.ammo ?? mag,
    juice = o.hot ? '#ffb347' : '#a6ff8f',
    charge = o.charge || 0,
    level = charge > 0 ? charge : ammo / Math.max(mag, ammo);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(o.scale || 1, o.scale || 1);
  path(
    g,
    p => {
      p.moveTo(-26, 160);
      p.quadraticCurveTo(-6, 40, -8, -6);
      p.lineTo(36, -2);
      p.quadraticCurveTo(52, 60, 70, 160);
      p.closePath();
    },
    gradient(g, -26, 0, 96, 0, '#9cc4d2', '#55849a')
  );
  for (const [dx, dy] of [[4, 30], [30, 52], [12, 88], [44, 104], [22, 130]]) {
    ellipse(g, dx, dy, 3.4, 3.4, '#e8f6f855');
  }
  rr(g, -2, -74, 32, 80, 12, gradient(g, -2, 0, 32, 0, '#e0703a', '#a84a22'), '#5c2610', 1.5);
  ellipse(g, 14, -18, 21, 17, '#f0c3a0');
  for (let i = 0; i < 3; i++) line(g, [[2, -28 + i * 9], [18, -26 + i * 9]], '#c99272', 1.5);
  rr(g, -36, -176, 74, 116, 22, gradient(g, -36, -176, 74, 116, '#ffbb57', '#e2672f'), '#6e2f13', 2);
  rr(g, -36, -118, 74, 13, 4, '#2fa59a');
  rr(g, -24, -166, 48, 36, 10, '#0d262d', '#2a5a5e', 2);
  if (level > 0) rr(g, -20, -134 - 28 * level, 40, 28 * level, 7, juice + (charge > 0 ? 'ee' : '77'));
  if (charge >= 1 || o.hot) glow(g, 0, -148, 50, juice + '66');
  for (let i = 0; i < Math.max(mag, ammo); i++)
    rr(g, -48, -168 + i * 12, 9, 8, 3, i < ammo ? (i >= mag ? '#ffe27a' : juice) : '#23383f');
  rr(g, -15, -268, 30, 100, 10, gradient(g, -15, 0, 30, 0, '#56cbbb', '#21756c'), '#123f3a', 1.5);
  for (const yy of [-250, -190]) rr(g, -17, yy, 34, 6, 3, '#1b5e57');
  rr(g, -22, -238 + pump, 44, 36, 10, gradient(g, -22, 0, 44, 0, '#2f9a90', '#1a5f59'), '#0f3a36', 1.5);
  for (let i = 0; i < 4; i++) line(g, [[-18, -230 + pump + i * 8], [18, -230 + pump + i * 8]], '#0f3a3688', 2);
  ellipse(g, -28, -220 + pump, 14, 18, '#f0c3a0');
  rr(g, 16, -258, 18, 44, 6, '#3c4f59', '#1d2a30', 1);
  ellipse(g, 25, -258, 9, 4, '#fff6c8');
  rr(g, -19, -280, 38, 15, 6, '#ffd447', '#8a6a12', 1.5);
  ellipse(g, 0, -280, 9, 3, '#3a2a08');
  heart(g, -11, -100, 0.85, '#ff8fb1');
  g.restore();
}

function blasterSightMark(g) {
  const S = mini.sight,
    charge = blasterChargeLevel(),
    col = mini.hot > 0 ? '#ffb35c' : mini.aimFlash > 0 ? '#ffe5a1' : '#c8f0da';
  g.globalAlpha = mini.reload > 0 ? 0.5 : 1;
  g.strokeStyle = col;
  g.lineWidth = 1.8;
  g.beginPath();
  g.arc(S.x, S.y, 19, 0, Math.PI * 2);
  g.stroke();
  for (const s of [-1, 1]) {
    line(g, [[S.x + s * 11, S.y], [S.x + s * 28, S.y]], col, 2);
    line(g, [[S.x, S.y + s * 11], [S.x, S.y + s * 28]], col, 2);
  }
  ellipse(g, S.x, S.y, 2, 2, '#fff6d8');
  g.globalAlpha = 1;
  if (charge > 0) {
    g.strokeStyle = charge >= 1 ? '#d6ffb8' : '#a6ff8f';
    g.lineWidth = charge >= 1 ? 4 + Math.sin(time * 20) * 1.5 : 3;
    g.beginPath();
    g.arc(S.x, S.y, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
    g.stroke();
    // Fully charged: preview the line the beam will take.
    if (charge >= 1) {
      const M = blasterMuzzle(),
        len = Math.hypot(S.x - M.x, S.y - M.y) || 1;
      g.setLineDash([7, 9]);
      line(g, [[M.x, M.y], [M.x + ((S.x - M.x) / len) * 900, M.y + ((S.y - M.y) / len) * 900]], '#c9ffb088', 2);
      g.setLineDash([]);
    }
  }
  if (mini.reload > 0) {
    const [a, b] = blasterReloadWindow(),
      D = mini.reloadDur,
      start = -Math.PI / 2;
    g.lineWidth = 4;
    g.strokeStyle = '#7fe08a';
    g.beginPath();
    g.arc(S.x, S.y, 31, start + (a / D) * Math.PI * 2, start + (b / D) * Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#ffe0a1';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(S.x, S.y, 31, start, start + clamp(mini.reloadT / D, 0, 1) * Math.PI * 2);
    g.stroke();
  }
}

function blasterHud(g) {
  label(g, 'YOUR ROOM · 3:07 AM', 20, 28, 12, '#a9c4cf');
  label(g, 'L' + (mini.tier + 1), 578, 28, 12, '#efdab0', 'right');
  if (mini.rush && mini.screen === 'play') {
    const pulse = 0.5 + 0.5 * Math.sin(time * 10);
    g.globalAlpha = 0.35 + pulse * 0.4;
    rr(g, 3, 3, 594, 594, 18, null, '#ff6b6b', 5);
    g.globalAlpha = 1;
    label(g, 'RUSH', 300, 28, 15, '#ffb0a0', 'center');
  }
  // Edge arrows point at whatever is off-screen, red when it is about to jump.
  for (const a of blasterArrows()) {
    const pulse = a.danger ? 0.5 + 0.5 * Math.sin(time * 14) : 0,
      fill = a.danger ? `rgba(120, 30, 40, ${0.7 + pulse * 0.25})` : '#122a40cc',
      text = a.side < 0 ? '◀ ' + a.off.length : a.off.length + ' ▶';
    rr(g, a.x, a.y - 30, 60, 60, 14, fill, a.danger ? '#ff9a7a' : '#7fa3b066', 1.5);
    label(g, text, a.x + 30, a.y + 7, 20, a.danger ? '#ffd2b0' : '#e9bd95', 'center');
  }
  for (const c of mini.captions) {
    const left = c.side < 0,
      text = left ? '‹ scritch scritch' : 'scritch scritch ›';
    g.globalAlpha = Math.min(1, c.t) * 0.75;
    label(g, text, left ? 16 : 584, c.y - 44, 12, '#b9cbd8', left ? 'left' : 'right');
  }
  g.globalAlpha = 1;
  for (const p of mini.pops) {
    g.globalAlpha = Math.min(1, p.t * 2.5);
    label(g, p.text, p.x, p.y - (0.8 - p.t) * 40, 13, p.col, 'center');
  }
  g.globalAlpha = 1;
  // Charges: pips, then the reload bar with its green window.
  const total = Math.max(mini.magazine, mini.ammo);
  rr(g, 14, 540, 200, 46, 13, '#0b1d30dd', '#5f8a9a55', 1);
  for (let i = 0; i < total; i++) {
    const lit = i >= mini.magazine ? '#ffe27a' : mini.hot ? '#ffb35c' : '#c8ff8a';
    rr(g, 26 + i * 17, 548, 10, 16, 4, i < mini.ammo ? lit : '#26414b');
  }
  label(
    g,
    mini.reload > 0 ? 'RELOADING' : mini.ammo + ' CHARGES' + (mini.hot ? ' · HOT ×' + mini.hot : ''),
    26,
    580,
    11,
    mini.ammo ? (mini.hot ? '#ffcf8f' : '#d4ead1') : '#f2b3b7'
  );
  if (mini.reload > 0) {
    const [a, b] = blasterReloadWindow(),
      D = mini.reloadDur,
      x = 14,
      y = 506,
      w = 200;
    rr(g, x, y, w, 24, 9, '#0b1d30ee', '#6c969a', 1);
    rr(g, x + (a / D) * w, y + 3, ((b - a) / D) * w, 18, 5, mini.reloadTry ? '#5d7f6a' : '#7fe08a');
    // A jam stretches the bar; the extra time shows in red.
    if (D > mini.reloadBase) {
      rr(g, x + (mini.reloadBase / D) * w, y + 3, ((D - mini.reloadBase) / D) * w - 3, 18, 5, '#b8505a');
    }
    const m = x + clamp(mini.reloadT / D, 0, 1) * w;
    line(g, [[m, y - 4], [m, y + 28]], '#ffe0a1', 3);
  }
}

// ---- Around the room (canvas coordinates) ----
// Macy's blanket fills the gutters (or the band under the room), a quilt in the dark, with the bed rail
// framing the room.
function blasterGutters(g, B) {
  const { w, h } = activeCanvas(),
    S = 64;
  if (w <= BLASTER_ROOM && h <= BLASTER_ROOM) return;
  rect(g, 0, 0, w, h, gradient(g, 0, 0, 0, h, '#0d1a2c', '#08111f'));
  for (let y = 0; y < h; y += S)
    for (let x = 0; x < w; x += S) {
      if (x >= B.x - S && x < B.x + BLASTER_ROOM && y >= B.y - S && y < B.y + BLASTER_ROOM) continue;
      const odd = (x / S + y / S) % 2;
      rr(g, x + 3, y + 3, S - 6, S - 6, 10, odd ? '#14263b' : '#101f33');
      g.setLineDash([4, 5]);
      rr(g, x + 9, y + 9, S - 18, S - 18, 7, null, odd ? '#2a4660' : '#233b54', 1);
      g.setLineDash([]);
    }
  rr(g, B.x - 4, B.y - 4, BLASTER_ROOM + 8, BLASTER_ROOM + 8, 8, null, '#3d5f73', 4);
}

// The touch controls on the blanket.
function blasterControlsArt(g) {
  if (!blasterTouchUI()) return;
  const L = blasterLayout(),
    presses = Object.values(mini.blasterPresses || {}),
    held = how => presses.find(b => b.how === how);
  // The chip that shows or hides the stick.
  const C = L.chip,
    on = blasterStickOn();
  rr(g, C.x, C.y, C.w, C.h, 14, on ? '#2c5a55dd' : '#0b1d30dd', on ? '#9fe0c4aa' : '#5f8a9a88', 1.5);
  label(g, on ? 'HIDE STICK' : 'SHOW STICK', C.x + C.w / 2, C.y + 27, 12, on ? '#d8f5e6' : '#b9d3dc', 'center');
  if (on) {
    const b = held('stick'),
      S = b ? { x: b.cx, y: b.cy, r: L.stick.r } : L.stick,
      kx = b ? b.kx * S.r : 0,
      ky = b ? b.ky * S.r : 0;
    g.globalAlpha = b ? 0.95 : 0.75;
    ellipse(g, S.x, S.y, S.r + 12, S.r + 12, '#0b1d30cc');
    g.strokeStyle = '#9fd8c8aa';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(S.x, S.y, S.r + 12, 0, Math.PI * 2);
    g.stroke();
    for (const [ax, ay] of [[0, -1], [1, 0], [0, 1], [-1, 0]])
      poly(
        g,
        [
          [S.x + ax * (S.r - 4) - ay * 7, S.y + ay * (S.r - 4) + ax * 7],
          [S.x + ax * (S.r - 4) + ay * 7, S.y + ay * (S.r - 4) - ax * 7],
          [S.x + ax * (S.r + 5), S.y + ay * (S.r + 5)]
        ],
        '#9fd8c899'
      );
    ellipse(g, S.x + kx, S.y + ky, 30, 30, b ? '#c8f0da' : '#7fa9a6');
    ellipse(g, S.x + kx - 8, S.y + ky - 9, 10, 7, '#ffffff55');
    g.globalAlpha = 1;
    label(g, 'AIM', L.stick.x, L.stick.y + L.stick.r + 30, 11, '#7fa3b0', 'center');
  }
  // FIRE: the blaster's orange, with the charge filling its rim while it is held.
  const F = L.fire,
    down = !!held('fire'),
    charge = mini.blasterTrigger ? clamp(mini.blasterTrigger.t / BLASTER_CHARGE, 0, 1) : 0,
    dry = mini.reload > 0 || mini.ammo <= 0,
    fy = F.y + (down ? 4 : 0);
  ellipse(g, F.x, F.y + 7, F.r, F.r, '#3a1a0c');
  ellipse(g, F.x, fy, F.r, F.r, gradient(g, F.x - F.r, fy - F.r, F.r * 2, F.r * 2, '#ffbb57', '#c9561f'));
  ellipse(g, F.x, fy, F.r - 14, F.r - 14, down ? '#e2672f' : '#f0823d');
  ellipse(g, F.x - F.r * 0.3, fy - F.r * 0.38, F.r * 0.3, F.r * 0.16, '#ffffff44');
  if (charge > 0) {
    g.strokeStyle = charge >= 1 ? '#d6ffb8' : '#a6ff8f';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(F.x, fy, F.r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
    g.stroke();
  }
  g.globalAlpha = dry ? 0.55 : 1;
  label(g, 'FIRE', F.x, fy + 8, 30, '#3a1405', 'center');
  label(g, dry ? 'RELOADING' : 'HOLD TO PIERCE', F.x, fy + 32, 10, '#5c2610', 'center');
  g.globalAlpha = 1;
  // The flashlight stun, above FIRE: a lens that goes dark once the stuns are spent.
  const A = L.flash,
    left = mini.helps,
    ay = A.y + (held('flash') ? 3 : 0);
  ellipse(g, A.x, A.y + 5, A.r, A.r, '#11202a');
  ellipse(g, A.x, ay, A.r, A.r, '#3c4f59');
  ellipse(g, A.x, ay, A.r - 9, A.r - 9, left > 0 ? '#fff6c8' : '#5b6a70');
  if (left > 0) glow(g, A.x, ay, A.r + 14, '#fff2c444');
  label(g, 'STUN', A.x, ay + 2, 15, left > 0 ? '#5a4a12' : '#2b363b', 'center');
  label(g, left + ' LEFT', A.x, ay + 19, 10, left > 0 ? '#7a6418' : '#2b363b', 'center');
  // RELOAD, beside them: teal like the pump, green while the hot-reload window is open.
  const R = L.reload,
    [wa, wb] = mini.reload > 0 ? blasterReloadWindow() : [0, 0],
    green = mini.reload > 0 && !mini.reloadTry && mini.reloadT >= wa && mini.reloadT <= wb,
    ry = R.y + (held('reload') ? 3 : 0);
  ellipse(g, R.x, R.y + 5, R.r, R.r, '#0f3a36');
  ellipse(g, R.x, ry, R.r, R.r, green ? '#7fe08a' : gradient(g, R.x - R.r, ry, R.r * 2, 0, '#2f9a90', '#1a5f59'));
  for (let i = -1; i <= 1; i++) line(g, [[R.x - 18, ry - 15 + i * 6], [R.x + 18, ry - 15 + i * 6]], '#0f3a3688', 2);
  label(g, 'RELOAD', R.x, ry + 9, 12, green ? '#123b18' : '#d8f5e6', 'center');
  label(g, mini.ammo + '/' + mini.magazine, R.x, ry + 24, 10, green ? '#123b18' : '#9fd8c8', 'center');
}

function blasterTag(g, text, x, y, arrow) {
  const w = text.length * 7.6 + 22;
  x = clamp(x, w / 2 + 8, 592 - w / 2);
  y = clamp(y, 70, 560);
  rr(g, x - w / 2, y - 15, w, 26, 9, '#fff2c4ee');
  label(g, text, x, y + 3, 11, '#2b2a1e', 'center');
  if (arrow) poly(g, [[x - 7, y + 11], [x + 7, y + 11], [x, y + 20]], '#fff2c4ee');
}

function blasterOnScreen(e) {
  const p = shooterProjection(e);
  return p.x > 20 && p.x < 580 && p.y > 50 && p.y < 560;
}

// First Rodeo teaches on the canvas itself.
function blasterHints(g) {
  if (mini.tier !== 0 || mini.screen !== 'play') return;
  const gremlins = mini.targets.filter(e => BLASTER_KINDS[e.kind] && e.mode !== 'dying'),
    seen = gremlins.filter(e => (e.mode !== 'hide' || e.peek > 0.5) && blasterOnScreen(e));
  if (!mini.blasterFirstHit && seen.length) {
    const p = shooterProjection(seen[0]);
    blasterTag(g, (mini.blasterMouse ? 'CLICK' : 'TAP') + ' THE GREMLIN', p.x, p.y - 34 * p.s - 22, true);
  } else if (!mini.blasterPanned && gremlins.length && !seen.length) {
    const how = mini.blasterMouse ? 'PUSH THE SIGHT TO THE EDGE TO LOOK' : 'TAP THE ARROW · OR SLIDE TO THE EDGE';
    blasterTag(g, how, 300, 330, false);
  }
  if (mini.reload > 0 && !mini.reloadTry)
    blasterTag(
      g,
      mini.blasterMouse ? 'R IN THE GREEN = HOT RELOAD' : 'RELOAD: TAP IN THE GREEN',
      114,
      486,
      true
    );
  const bruiser = seen.find(e => e.kind === 'bruiser');
  if (bruiser && !mini.chargedShots) {
    const p = shooterProjection(bruiser);
    blasterTag(g, 'BIG GUY: HEADSHOT, OR HOLD AND LET GO', p.x, p.y - 34 * p.s - 22, true);
  }
  const bottle = mini.targets.find(e => e.kind === 'bottle' && blasterOnScreen(e));
  if (bottle && !mini.bottlesShot) {
    const p = shooterProjection(bottle);
    blasterTag(g, 'SHOOT THE JUICE · +3', p.x, p.y - 44, true);
  }
}

// GOT YOUR FACE: slime on the lens, then a wiper clears it over a second.
function blasterSplat(g) {
  const sp = mini.splat,
    wipe = clamp((sp.t - 0.35) / 1, 0, 1),
    wx = -100 + wipe * 860;
  g.save();
  if (wipe > 0) {
    g.beginPath();
    g.moveTo(wx, -10);
    g.lineTo(720, -10);
    g.lineTo(720, 610);
    g.lineTo(wx - 160, 610);
    g.closePath();
    g.clip();
  }
  g.globalAlpha = 0.93;
  for (let i = 0; i < 11; i++) {
    const a = blasterHash(i + 70) * Math.PI * 2,
      d = i ? 40 + blasterHash(i + 80) * 170 : 0,
      r = i ? 14 + blasterHash(i + 90) * 30 : 100,
      x = sp.x + Math.cos(a) * d,
      y = sp.y + Math.sin(a) * d * 0.8,
      col = i % 3 ? '#7cc244' : '#8fd14f';
    // Each glob is a lumpy cluster with a drip that keeps sliding while it sits there.
    ellipse(g, x, y, r, r * 0.82, col);
    for (let k = 0; k < 4; k++) {
      const b = a + k * 1.7 + blasterHash(i * 7 + k);
      ellipse(g, x + Math.cos(b) * r * 0.8, y + Math.sin(b) * r * 0.7, r * 0.42, r * 0.36, col);
    }
    ellipse(g, x - r * 0.3, y - r * 0.35, r * 0.28, r * 0.16, '#d9ff9c88');
    rr(g, x - 4, y, 8, r * 0.7 + sp.t * 70 * blasterHash(i + 100), 4, col);
    ellipse(g, x, y + r * 0.7 + sp.t * 70 * blasterHash(i + 100), 6, 7, col);
  }
  label(g, 'GOT YOUR', sp.x + 3, sp.y - 6, 30, '#2c4a1a', 'center');
  label(g, 'GOT YOUR', sp.x, sp.y - 9, 30, '#f4ffd6', 'center');
  label(g, 'FACE', sp.x + 3, sp.y + 31, 40, '#2c4a1a', 'center');
  label(g, 'FACE', sp.x, sp.y + 28, 40, '#f4ffd6', 'center');
  g.restore();
  g.globalAlpha = 1;
  if (wipe > 0 && wipe < 1) {
    line(g, [[wx, -10], [wx - 160, 610]], '#22323b', 11);
    line(g, [[wx + 3, -10], [wx - 157, 610]], '#5d7480', 3);
  }
}
