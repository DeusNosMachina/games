// Gurney Grand Prix (CT scan). Steer a runaway gurney down three lanes: jump crates, slide under
// scan bars, dodge walls, and throw softballs at gremlins. Level 1 teaches one hazard at a time.
// Levels 2 and 3 add boost pads, ramps, nurse carts on a beat, rolling IV stands, curves, gunk
// throwers, double obstacles and (level 3) the donut tunnel. Needs a coin quota and a stunt quota.
// Canvas 600 × 600. Rows scroll down; objects meet the gurney at RACE_LINE.
const RACE_GAP = 140;
const RACE_LINE = 490;
const RACE_CART_Y = 530;
const RACE_SPAWN_Y = 30;
const RACE_SLIVER = 0.3;
const RACE_LATE = 0.22;
const RACE_JUMP_V = 355;
const RACE_RAMP_V = 470;
const RACE_GRAVITY = 880;
const RACE_SLIDE = 0.85;
const RACE_GUNK_V = 280;
const RACE_BOOST = 2.6;
const RACE_DOUBLE = [0, 95, 90];
const RACE_HAZARDS = ['crate', 'bar', 'wall', 'gremlin'];

// Per-level tuning. Speeds are px/s before the difficulty multiplier; ramp is the extra speed
// gained by the end of the run; gap is px between rows; curves and tunnel are fractions of the run.
const RACE_TIERS = [
  {
    limit: 105,
    goal: 42,
    stunts: 8,
    speed: 112,
    ramp: 0.14,
    gap: 255,
    gremlinHp: 1,
    curves: [],
    tunnel: null,
    beat: 0,
    throwFrom: 9,
    throwChance: 0
  },
  {
    limit: 120,
    goal: 72,
    stunts: 15,
    speed: 136,
    ramp: 0.28,
    gap: 228,
    gremlinHp: 2,
    curves: [0.3, 0.7],
    tunnel: null,
    beat: 1.2,
    throwFrom: 2,
    throwChance: 0.45
  },
  {
    limit: 135,
    goal: 90,
    stunts: 20,
    speed: 148,
    ramp: 0.36,
    gap: 214,
    gremlinHp: 2,
    curves: [0.2, 0.4, 0.84],
    tunnel: [0.53, 15],
    beat: 0.95,
    throwFrom: 0,
    throwChance: 0.55
  }
];

// Level 1 teaches one hazard per stage. The first row of a stage puts one hazard in your lane.
const RACE_LESSONS = [
  { kind: 'crate', rows: 7, hint: 'SWIPE UP or W · JUMP THE CRATE' },
  { kind: 'bar', rows: 7, hint: 'SWIPE DOWN or S · SLIDE UNDER' },
  { kind: 'wall', rows: 6, hint: 'SWIPE SIDEWAYS · DODGE THE WALL' },
  { kind: 'gremlin', rows: 7, hint: 'THROW or SPACE · BONK IT' }
];

// First sighting of each new thing on levels 2 and 3 gets a callout.
const RACE_HINTS = {
  boost: 'BOOST PAD · COINS ×2',
  ramp: 'RAMP · SWERVE MID-AIR',
  nurse: 'NURSE CART · MOVES ON THE BEAT',
  iv: 'RUNAWAY IV · THROW OR DODGE',
  thrower: 'IT THROWS GUNK · DODGE',
  barCrate: 'SLIDE, THEN JUMP',
  crateBar: 'JUMP, THEN SWIPE DOWN TO SLAM',
  crateWall: 'JUMP, THEN SWERVE',
  armor: 'HELMET · THREE THROWS'
};

// Pattern weights per level and the first sector each one shows up in.
const RACE_PATTERNS = {
  mixed: { weight: [0, 3, 2.4], from: [9, 0, 0] },
  fork: { weight: [0, 2, 1.5], from: [9, 0, 0] },
  boost: { weight: [0, 1.3, 1.3], from: [9, 0, 0] },
  double: { weight: [0, 1.4, 2], from: [9, 0, 0] },
  nurse: { weight: [0, 1.6, 2], from: [9, 1, 0] },
  roller: { weight: [0, 1.4, 1.8], from: [9, 1, 0] }
};

const RACE = registerGame({
  id: 3,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Gurney Grand Prix',
    genre: 'SWIPE · JUMP · SLIDE · THROW',
    headline: 'Zero brakes. Questionable steering.',
    desc: 'Race a runaway gurney through three continuous sectors. Swipe to change lanes, jump crates, slide under scan bars, and bonk gremlins with softballs. Later levels add boost pads, ramps, nurse carts on a beat, runaway IV stands, curves, and a donut tunnel. Speed only goes up.',
    goal: 'Survive all three sectors, collect the coin quota, and land the stunt quota.',
    control:
      'Swipe left / right to steer, up to jump, down to slide. Or A/D, W/S and the big buttons. THROW (Space) fires down your lane. Swerve mid-air, slide into a jump, or swipe down mid-air to slam.',
    avoid:
      'Jump orange crates. Slide under violet bars. Steer around pink walls, nurse carts and runaway IVs. Bonk gremlins before they reach you, and dodge the gunk they throw back.',
    cue: '← → steer · ↑ jump crates · ↓ slide bars · THROW for gremlins'
  },
  tierNotes: [
    '105s · learn one hazard at a time',
    '120s · boosts · ramps · nurse carts · curves',
    '135s · gunk throwers · donut tunnel · top speed'
  ],
  init() {
    const tier = RACE_TIERS[mini.tier];
    initArcadeRun(tier.limit);
    mini.goal = tier.goal;
    mini.stunts = 0;
    mini.stuntGoal = tier.stunts;
    mini.lane = 1;
    mini.cartX = raceLaneBase(1);
    mini.jump = 0;
    mini.jumpV = 0;
    mini.slide = 0;
    mini.inv = 0;
    mini.throwCd = 0;
    mini.rows = [];
    mini.bullets = [];
    mini.rowSerial = 0;
    mini.raceGap = 60;
    mini.raceNext = 'mixed';
    mini.raceLessonRow = 0;
    mini.raceSeen = {};
    mini.raceSpeedNow = raceSpeed();
    mini.raceDist = 0;
    mini.raceBoost = 0;
    mini.raceChain = 0;
    mini.raceBestChain = 0;
    mini.raceCloseCalls = 0;
    mini.raceLeft = null;
    mini.raceJumpT = -9;
    mini.raceSlideT = -9;
    mini.raceSlam = false;
    mini.raceAirSwitched = false;
    mini.raceAirEarned = false;
    mini.raceCurveAt = tier.curves.map(f => f * tier.limit);
    mini.raceCurveDir = 1;
    mini.raceCurve = null;
    mini.raceTunnelAt = tier.tunnel ? tier.tunnel[0] * tier.limit : Infinity;
    mini.raceTunnelEnd = tier.tunnel ? mini.raceTunnelAt + tier.tunnel[1] : Infinity;
    mini.raceTunnelLane = 1;
    mini.raceTunnelRow = 0;
    mini.raceTunnelDone = false;
    mini.raceGunk = [];
    mini.raceThrows = 0;
    mini.raceSplats = [];
    mini.raceMarks = [];
    mini.racePops = [];
    mini.raceShake = 0;
    mini.raceLatV = 0;
    mini.raceLean = 0;
  },
  controls() {
    setControls([
      { id: 'left', text: '←', key: 'A' },
      { id: 'jump', text: 'JUMP ↑', key: 'W', hot: true },
      { id: 'right', text: '→', key: 'D' },
      { id: 'slide', text: 'SLIDE ↓', key: 'S' },
      { id: 'throw', text: 'THROW', key: 'Space' }
    ]);
  },
  update(dt) {
    updateArcade(dt, updateRace);
  },
  draw(g) {
    arcadeBackdrop(g, '#23495b', '#79d8ca20', 'CT / ABSOLUTELY NO BRAKES');
    drawRace(g);
  },
  // A swipe longer than 38px steers, jumps, or slides, then restarts from the current point.
  move(p) {
    const dx = p.x - mini.pointer.startX,
      dy = p.y - mini.pointer.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 38) {
      RACE.action(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'slide' : 'jump');
      if (!mini.pointer) return;
      mini.pointer.startX = p.x;
      mini.pointer.startY = p.y;
    }
  },
  action(a) {
    if (a === 'left' || a === 'right') raceSteer(a === 'left' ? -1 : 1);
    if (a === 'jump') raceJump();
    if (a === 'slide') raceSlide();
    if (a === 'throw') raceThrow();
  },
  assist() {
    mini.slow = 5;
    mini.inv = 5;
    mini.flash = 1;
    mini.flashText = 'FIVE SECONDS OF DIGNITY';
  },
  key(k, e) {
    if (e.repeat) return true;
    const action = {
      a: 'left',
      arrowleft: 'left',
      d: 'right',
      arrowright: 'right',
      w: 'jump',
      arrowup: 'jump',
      s: 'slide',
      arrowdown: 'slide',
      ' ': 'throw'
    }[k];
    if (action) miniAction(action);
    return true;
  },
  shiftName: 'SECTOR',
  shiftMessage: shift =>
    [
      [
        'SECTOR 2 · a bit faster. Keep reading the hints.',
        'FINAL SECTOR · everything you learned, one at a time.'
      ],
      [
        'SECTOR 2 · nurse carts move on a beat. Watch the arrow.',
        'FINAL SECTOR · gremlins throw gunk back. Dodge the wind-up.'
      ],
      [
        'SECTOR 2 · the donut tunnel is coming. Slide, steer, repeat.',
        'FINAL SECTOR · top speed. Chain stunts for bail money.'
      ]
    ][mini.tier][shift - 1],
  timeUp() {
    const met = mini.got >= mini.goal && mini.stunts >= mini.stuntGoal;
    finishMini(met, met ? undefined : ARCADE_QUOTA_MISSED);
  },
  lesson() {
    const i = RACE.info,
      goal = ' Target: ' + mini.goal + ' coins + ' + mini.stuntGoal + ' stunts.';
    return [
      {
        title: i.game + ' · driving school',
        goal: 'Crates, then bars, then walls, then gremlins. One at a time, with hints.' + goal,
        control: i.control,
        avoid: 'Stunts are jumped crates, slid bars and bonked gremlins. Coins sit in the safe lane.',
        demo: 'race',
        cue: i.cue
      },
      {
        title: i.game + ' · ' + mini.limit + ' second shift',
        goal: 'Boost pads double your coins. Ramps launch you: swerve mid-air for a bonus stunt.' + goal,
        control: i.control,
        avoid:
          'Nurse carts change lanes on a beat. Runaway IVs roll faster than traffic. In curves, swipe toward the inside to hold the line.',
        demo: 'race',
        cue: i.cue
      },
      {
        title: i.game + ' · ' + mini.limit + ' second shift',
        goal: 'Chain stunts without crashing for up to ×3 coins. Late dodges score CLOSE CALL +2.' + goal,
        control: i.control,
        avoid:
          'Gremlins wind up and throw gunk at your lane. Helmets take three throws. The donut tunnel alternates low bars and walls, fast.',
        demo: 'race',
        cue: i.cue
      }
    ][mini.tier];
  },
  statLabel: () => 'COINS / SECTOR',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () =>
    `STUNTS ${mini.stunts}/${mini.stuntGoal} · CHAIN ×${raceMult()} · SCORE ${mini.score} · ${mini.helps} ASSISTS`,
  assistText: () => 'SHIELD · ' + mini.helps + ' (E)',
  onWin: () =>
    pick([
      'The CT tech has asked you to stop calling it the donut.',
      'Gurney returned with minor scorch marks and one new fan.',
      'Speed limit in the hallway is a suggestion. You suggested otherwise.'
    ]),
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#3a6b7e', '#193b4e'));
    poly(g, [[70, 240], [150, 20], [270, 20], [350, 240]], '#2f5868');
    for (const x of [-1, 1]) line(g, [[210 + x * 43, 240], [210 + x * 20, 20]], '#b7dec65a', 2);
    for (let i = 0; i < 5; i++) line(g, [[30 + i * 9, 60 + i * 34], [10 + i * 9, 80 + i * 34]], '#d8f2e344', 2);
    raceCrateArt(g, 260, 120, 0.7);
    gremlin(g, 160, 110, 1, 3, time);
    raceFlame(g, 210, 238, 0.8, time);
    miniBed(g, 210, 230, 0.66);
    label(g, RACE.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

// ---- Rules ----

function raceLaneBase(lane) {
  return 160 + lane * RACE_GAP;
}

function raceCartLane() {
  return clamp(Math.round((mini.cartX - 160) / RACE_GAP), 0, 2);
}

// Track speed in px/s: level base, ramp across the run, difficulty, boost and the slow assist.
function raceSpeed() {
  const tier = RACE_TIERS[mini.tier],
    ramp = 1 + tier.ramp * clamp(mini.phaseTime / mini.limit, 0, 1);
  return (
    tier.speed * ramp * mini.rules.mini * (mini.raceBoost > 0 ? 1.45 : 1) * (mini.slow > 0 ? 0.7 : 1)
  );
}

// Stunt multiplier: ×1, then ×2 after four clean stunts, ×3 after eight.
function raceMult() {
  return 1 + Math.min(2, Math.floor((mini.raceChain || 0) / 4));
}

function racePop(text, x, y, col = '#ffe7b0') {
  mini.racePops.push({ text, x, y, life: 1.1, col });
  if (mini.racePops.length > 8) mini.racePops.shift();
}

function raceStunt(text) {
  mini.stunts++;
  mini.raceChain++;
  mini.raceBestChain = Math.max(mini.raceBestChain, mini.raceChain);
  const mult = raceMult();
  mini.got += mult;
  praise(100 * mult);
  racePop(text + (mult > 1 ? ' ×' + mult : ''), mini.cartX, RACE_CART_Y - 120, '#ffe7b0');
  sfx('combo', { count: Math.min(8, mini.raceChain) });
}

function raceCloseCall() {
  mini.got += 2;
  mini.raceCloseCalls++;
  praise(80);
  mini.flash = 0.55;
  mini.flashText = 'CLOSE CALL +2';
  racePop('CLOSE CALL +2', mini.cartX, RACE_CART_Y - 92, '#b6f2ff');
  sfx('pickup');
}

function raceCrash(message) {
  if (mini.inv > 0) return;
  mini.inv = 1;
  mini.raceChain = 0;
  mini.raceBoost = 0;
  mini.raceShake = 0.3;
  arcadeBurst(mini.cartX, RACE_CART_Y - 20, '#f4b2b2', 12);
  sfx('hurt');
  miniOops(message);
}

function raceSteer(dir) {
  const c = mini.raceCurve;
  // During a skid warning, steering toward the inside of the curve holds the line instead.
  if (c && c.warn > 0 && dir === c.dir) {
    c.warn = 0;
    c.skidDone = true;
    raceStunt('COUNTER-STEER');
    return;
  }
  const next = clamp(mini.lane + dir, 0, 2);
  if (next === mini.lane) return;
  mini.raceLeft = { lane: raceCartLane(), t: mini.total };
  mini.lane = next;
  if (mini.jump > 0) mini.raceAirSwitched = true;
}

function raceJump() {
  if (mini.jump > 0) return;
  mini.jumpV = RACE_JUMP_V;
  mini.jump = 1;
  mini.slide = 0;
  mini.raceJumpT = mini.total;
  mini.raceAirSwitched = false;
  mini.raceAirEarned = false;
  sfx('jump');
}

// Grounded: slide (or extend a slide). Airborne: slam down and slide on landing.
function raceSlide() {
  if (mini.jump > 0) {
    if (mini.raceSlam) return;
    mini.raceSlam = true;
    mini.jumpV = -950;
    sfx('dash');
    return;
  }
  mini.slide = RACE_SLIDE;
  mini.raceSlideT = mini.total;
}

function raceThrow() {
  if (mini.throwCd > 0) return;
  mini.throwCd = 0.38;
  mini.bullets.push({ lane: raceCartLane(), y: RACE_CART_Y - 45 });
  sfx('throw');
}

// Every update: timers, the gurney, curves, spawning, softballs, rows, gunk.
function updateRace(dt) {
  const speed = raceSpeed();
  mini.raceSpeedNow = speed;
  mini.raceDist += speed * dt;
  mini.inv = Math.max(0, mini.inv - dt);
  mini.throwCd = Math.max(0, mini.throwCd - dt);
  mini.slide = Math.max(0, mini.slide - dt);
  mini.raceBoost = Math.max(0, mini.raceBoost - dt);
  mini.raceShake = Math.max(0, mini.raceShake - dt);
  raceMoveCart(dt);
  raceUpdateCurve(dt);
  mini.raceGap -= speed * dt;
  if (mini.raceGap <= 0 && mini.limit - mini.phaseTime > 4) mini.raceGap += spawnTraffic();
  raceUpdateBullets(dt);
  for (const r of mini.rows) {
    r.y += speed * dt;
    for (const o of r.objects) {
      if (o.kind === 'iv' && o.hp > 0) o.dy = (o.dy || 0) + speed * o.roll * dt;
      if (o.kind === 'iv' && o.hp <= 0) o.fall = Math.min(1, (o.fall || 0) + dt * 4);
      if (o.kind === 'nurse') raceNurseStep(o, dt);
      if (o.kind === 'gremlin') raceGremlinStep(o, r, dt, speed);
      if (!o.done && r.y + (o.dy || 0) >= RACE_LINE) {
        o.done = true;
        raceResolve(o);
      }
    }
  }
  mini.rows = mini.rows.filter(r => r.y < 660);
  raceUpdateGunk(dt, speed);
  for (const s of mini.raceSplats) s.y += speed * dt;
  mini.raceSplats = mini.raceSplats.filter(s => s.y < 640);
  for (const m of mini.raceMarks) {
    m.y += speed * dt;
    m.life -= dt;
  }
  mini.raceMarks = mini.raceMarks.filter(m => m.life > 0 && m.y < 620);
  for (const p of mini.racePops) {
    p.life -= dt;
    p.y -= 34 * dt;
  }
  mini.racePops = mini.racePops.filter(p => p.life > 0);
}

function raceMoveCart(dt) {
  const prevX = mini.cartX;
  mini.cartX += (raceLaneBase(mini.lane) - mini.cartX) * (1 - Math.exp(-dt * 19));
  mini.raceLatV = (mini.cartX - prevX) / Math.max(dt, 1e-4);
  const c = mini.raceCurve,
    curveLean = c ? -c.dir * Math.sin(Math.PI * clamp(c.t / c.dur, 0, 1)) * 0.12 : 0;
  mini.raceLean += (clamp(mini.raceLatV / 2600, -0.28, 0.28) + curveLean - mini.raceLean) * (1 - Math.exp(-dt * 12));
  // Hard steers on the ground leave rubber on the floor.
  if (Math.abs(mini.raceLatV) > 420 && mini.jump === 0) {
    for (const side of [-1, 1]) mini.raceMarks.push({ x: mini.cartX + side * 26, y: RACE_CART_Y + 12, life: 0.7 });
    if (mini.raceMarks.length > 90) mini.raceMarks.splice(0, 2);
  }
  if (mini.jump > 0) {
    mini.jumpV -= RACE_GRAVITY * dt;
    mini.jump = Math.max(0, mini.jump + mini.jumpV * dt);
    if (mini.jump === 0) raceLand();
  }
}

function raceLand() {
  mini.jumpV = 0;
  if (mini.raceAirSwitched && mini.raceAirEarned) raceStunt('AIR SWITCH');
  mini.raceAirSwitched = false;
  mini.raceAirEarned = false;
  if (mini.raceSlam) {
    mini.raceSlam = false;
    mini.slide = RACE_SLIDE * 0.8;
    mini.raceSlideT = mini.total;
    arcadeBurst(mini.cartX, RACE_CART_Y + 8, '#cfe8e0', 6);
    sfx('bounce');
  }
}

// What happens when an object reaches the gurney.
function raceResolve(o) {
  const lane = raceCartLane(),
    at = o.kind === 'nurse' ? Math.round(o.pos) : o.lane,
    live =
      ['crate', 'bar', 'wall', 'nurse'].includes(o.kind) || (['gremlin', 'iv'].includes(o.kind) && o.hp > 0);
  if (at !== lane) {
    if (live && mini.raceLeft && mini.raceLeft.lane === at && mini.total - mini.raceLeft.t <= RACE_SLIVER)
      raceCloseCall();
    return;
  }
  if (o.kind === 'coin') {
    const boosted = mini.raceBoost > 0;
    mini.got += boosted ? 4 : 2;
    praise(boosted ? 120 : 60);
    arcadeBurst(mini.cartX, RACE_LINE, '#ffe09c', boosted ? 10 : 6);
    if (boosted) racePop('+4', mini.cartX + 40, RACE_LINE - 30, '#ffe09c');
    sfx('coin');
  } else if (o.kind === 'boost') {
    if (mini.jump > 0) return;
    mini.raceBoost = RACE_BOOST;
    mini.flash = 0.8;
    mini.flashText = 'BOOST · COINS ×2';
    sfx('powerup');
  } else if (o.kind === 'ramp') {
    if (mini.jump > 0) return;
    mini.jump = 1;
    mini.jumpV = RACE_RAMP_V;
    mini.slide = 0;
    mini.raceJumpT = mini.total;
    mini.raceSlam = false;
    mini.raceAirSwitched = false;
    mini.raceAirEarned = true;
    raceStunt('RAMP');
    sfx('jump');
  } else if (o.kind === 'crate' && mini.jump > 25) {
    mini.raceAirEarned = true;
    raceStunt('CRATE HOP');
    if (mini.total - mini.raceJumpT <= RACE_LATE) raceCloseCall();
  } else if (o.kind === 'bar' && mini.slide > 0 && mini.jump === 0) {
    raceStunt('LIMBO');
    if (mini.total - mini.raceSlideT <= RACE_LATE) raceCloseCall();
  } else if (live) {
    raceCrash(
      {
        crate: 'JUMP THE ORANGE CRATES',
        bar: 'SLIDE UNDER VIOLET BARS',
        wall: 'STEER AROUND PINK WALLS',
        gremlin: o.hp > 1 ? 'GREMLINS NEED MORE SOFTBALL' : 'BONK GREMLINS BEFORE THEY ARRIVE',
        nurse: 'NURSE CART · WATCH ITS BEAT',
        iv: 'RUNAWAY IV · THROW OR DODGE'
      }[o.kind]
    );
  }
}

// Nurse carts hop one lane every beat, bouncing off the walls; an arrow warns before each hop.
function raceNurseStep(o, dt) {
  o.clock += dt;
  if (o.clock >= o.period) {
    o.clock -= o.period;
    let next = o.lane + o.dir;
    if (next < 0 || next > 2) {
      o.dir = -o.dir;
      next = o.lane + o.dir;
    }
    o.lane = next;
  }
  o.pos += (o.lane - o.pos) * (1 - Math.exp(-dt * 16));
}

// Lane a nurse cart will occupy t seconds from now (used by the telegraph and the bot).
function raceNurseLaneAt(o, t) {
  let lane = o.lane,
    dir = o.dir,
    clock = o.clock + t;
  while (clock >= o.period) {
    clock -= o.period;
    let next = lane + dir;
    if (next < 0 || next > 2) {
      dir = -dir;
      next = lane + dir;
    }
    lane = next;
  }
  return lane;
}

// Seconds until an object meets the gurney at the current speed.
function raceEta(r, o, speed = mini.raceSpeedNow) {
  const v = speed * (1 + (o.kind === 'iv' && o.hp > 0 ? o.roll : 0));
  return (RACE_LINE - (r.y + (o.dy || 0))) / v;
}

// True when no live hazard (or gunk) reaches the gurney between a and b seconds from now.
function raceQuiet(a, b, skipRow) {
  for (const r of mini.rows) {
    if (r === skipRow) continue;
    for (const o of r.objects) {
      if (o.done || ['coin', 'boost', 'ramp'].includes(o.kind)) continue;
      if (['gremlin', 'iv'].includes(o.kind) && o.hp <= 0) continue;
      const t = raceEta(r, o);
      if (t >= a && t <= b) return false;
    }
  }
  return !mini.raceGunk.some(k => {
    const t = (RACE_LINE - k.y) / k.vy;
    return !k.done && t >= a - 0.5 && t <= b + 0.5;
  });
}

// Throwers wind up for 0.65s, then lob gunk at the lane you are in. A throw only leaves the
// hand when another lane is clear of blockers as it lands (crates and bars count as clear);
// otherwise the gremlin holds it, and gives up once it is too close for a fair throw.
function raceGremlinStep(o, r, dt, speed) {
  if (o.hp <= 0 || !o.thrower || o.thrown) return;
  if (r.y < 70) return;
  const flight = (RACE_LINE - (r.y - 20)) / (speed + RACE_GUNK_V);
  if (!(o.wind > 0) && o.wind !== 0) {
    // Flight time left after a full wind-up, measured from where the throw will happen.
    if ((RACE_LINE - (r.y + speed * 0.65 - 20)) / (speed + RACE_GUNK_V) < 0.5) {
      o.thrown = true;
      return;
    }
    o.wind = 0.65;
    return;
  }
  o.wind = Math.max(0, o.wind - dt);
  if (o.wind > 0) return;
  if (flight < 0.45) {
    o.thrown = true;
    o.wind = undefined;
    racePop('PFFT', raceLaneX(o.lane, r.y), r.y - 50, '#c9f59a');
    return;
  }
  const target = raceCartLane();
  if (raceDodgeable(target, flight)) raceThrowGunk(o, r, speed, target);
}

// True when some lane other than target has no blocker reaching the gurney near time t.
function raceDodgeable(target, t) {
  const blocked = [false, false, false];
  blocked[target] = true;
  for (const r of mini.rows)
    for (const o of r.objects) {
      if (o.done || ['coin', 'boost', 'ramp', 'crate', 'bar'].includes(o.kind)) continue;
      if (['gremlin', 'iv'].includes(o.kind) && o.hp <= 0) continue;
      const eta = raceEta(r, o);
      if (eta < t - 0.4 || eta > t + 0.4) continue;
      if (o.kind === 'nurse') for (const dt of [-0.4, 0, 0.4]) blocked[raceNurseLaneAt(o, Math.max(0, eta + dt))] = true;
      else blocked[o.lane] = true;
    }
  for (const k of mini.raceGunk) if (!k.done && Math.abs((RACE_LINE - k.y) / k.vy - t) < 0.5) blocked[k.lane] = true;
  return blocked.includes(false);
}

function raceThrowGunk(o, r, speed, lane = raceCartLane()) {
  o.thrown = true;
  o.wind = undefined;
  mini.raceThrows++;
  mini.raceGunk.push({ lane, y: r.y - 20, vy: speed + RACE_GUNK_V, done: false, spin: 0 });
  racePop('INCOMING', raceLaneX(o.lane, r.y), r.y - 60, '#c9f59a');
  sfx('throw');
}

function raceUpdateGunk(dt, speed) {
  for (const k of mini.raceGunk) {
    k.vy = Math.max(k.vy, speed + RACE_GUNK_V);
    k.y += k.vy * dt;
    k.spin += dt * 8;
    if (!k.done && k.y >= RACE_LINE) {
      k.done = true;
      const lane = raceCartLane();
      mini.raceSplats.push({ x: raceLaneBase(k.lane), y: RACE_LINE + 10, s: 1 });
      sfx('squelch');
      if (lane === k.lane) raceCrash('GUNKED · DODGE THE WIND-UP');
      else if (mini.raceLeft && mini.raceLeft.lane === k.lane && mini.total - mini.raceLeft.t <= RACE_SLIVER)
        raceCloseCall();
    }
  }
  mini.raceGunk = mini.raceGunk.filter(k => !k.done && !k.dead);
}

// Softballs fly up their lane. Gremlins and IVs take hits, gunk gets swatted, walls and carts stop them.
function raceUpdateBullets(dt) {
  for (const b of mini.bullets) {
    b.y -= 750 * dt;
    for (const k of mini.raceGunk)
      if (!b.dead && !k.dead && k.lane === b.lane && Math.abs(k.y - b.y) < 26) {
        k.dead = true;
        b.dead = true;
        praise(60);
        racePop('RETURN TO SENDER', raceLaneBase(k.lane), k.y - 20, '#c9f59a');
        arcadeBurst(raceLaneX(k.lane, k.y), k.y, '#a8d86f', 8);
        sfx('squelch');
      }
    if (b.dead) continue;
    let best = null,
      bestY = -Infinity;
    for (const r of mini.rows)
      for (const o of r.objects) {
        const y = r.y + (o.dy || 0),
          at = o.kind === 'nurse' ? Math.round(o.pos) : o.lane;
        if (o.done || at !== b.lane || y > b.y + 30 || y < bestY) continue;
        if (!['gremlin', 'iv', 'wall', 'nurse'].includes(o.kind)) continue;
        if (['gremlin', 'iv'].includes(o.kind) && o.hp <= 0) continue;
        if (Math.abs(b.y - y) < 30) {
          best = o;
          bestY = y;
        }
      }
    if (!best) continue;
    b.dead = true;
    const x = raceLaneX(b.lane, b.y);
    if (best.kind === 'wall' || best.kind === 'nurse') {
      arcadeBurst(x, b.y, '#e6eef0', 4);
      sfx('ricochet');
      continue;
    }
    best.hp--;
    arcadeBurst(x, b.y, best.kind === 'iv' ? '#e8f3ff' : '#b8e7f0', 6);
    if (best.hp > 0) {
      sfx(best.armor && best.hp === 2 ? 'ricochet' : 'hit');
      if (best.armor && best.hp === 2) best.armor = false;
      continue;
    }
    if (best.kind === 'gremlin') {
      mini.got += 2;
      raceStunt('SOFTBALL JUSTICE');
      sfx('enemyDie');
    } else {
      raceStunt('IV DOWN');
      sfx('bounce');
    }
  }
  mini.bullets = mini.bullets.filter(b => b.y > 20 && !b.dead);
}

// Curves bend the lanes sideways for a stretch. Midway, the gurney skids toward the outside
// unless you swipe toward the inside during the warning.
function raceUpdateCurve(dt) {
  if (!mini.raceCurve && mini.raceCurveAt.length && mini.phaseTime >= mini.raceCurveAt[0]) {
    mini.raceCurveAt.shift();
    mini.raceCurve = { dir: mini.raceCurveDir, t: 0, dur: 7, skidAt: 2.2, warn: 0, skidDone: false };
    mini.raceCurveDir = -mini.raceCurveDir;
    mini.flash = 1.1;
    mini.flashText = 'CURVE · SWIPE ' + (mini.raceCurve.dir > 0 ? 'RIGHT →' : '← LEFT') + ' TO HOLD THE LINE';
  }
  const c = mini.raceCurve;
  if (!c) return;
  c.t += dt;
  if (!c.skidDone) {
    if (c.warn > 0) {
      c.warn -= dt;
      if (c.warn <= 0) raceSkid(c);
    } else if (c.t >= c.skidAt) {
      if (raceQuiet(0.7, 1.55)) c.warn = 0.9;
      else if (c.t > c.dur - 2) c.skidDone = true;
    }
  }
  if (c.t >= c.dur) mini.raceCurve = null;
}

function raceSkid(c) {
  c.skidDone = true;
  const next = clamp(mini.lane - c.dir, 0, 2);
  sfx('dash');
  if (next === mini.lane) {
    arcadeBurst(mini.cartX - c.dir * 40, RACE_CART_Y, '#ffe1a0', 8);
    racePop('SCRAPE', mini.cartX, RACE_CART_Y - 100, '#ffd3a0');
    return;
  }
  mini.lane = next;
  racePop('SKID!', mini.cartX, RACE_CART_Y - 100, '#ffd3a0');
}

// ---- Spawning ----

function raceRow(objects, y = RACE_SPAWN_Y, extra = {}) {
  for (const o of objects) {
    o.done = false;
    if (o.hp === undefined) o.hp = 1;
    if (o.kind === 'gremlin' && o.armor && !mini.raceSeen.armor) {
      mini.raceSeen.armor = true;
      o.hint = RACE_HINTS.armor;
    }
  }
  const row = { id: mini.rowSerial++, y, objects, done: false, ...extra };
  mini.rows.push(row);
  return row;
}

function raceHint(o, key) {
  if (mini.tier === 0 || mini.raceSeen[key]) return o;
  mini.raceSeen[key] = true;
  o.hint = RACE_HINTS[key];
  return o;
}

function raceGremlin() {
  const tier = RACE_TIERS[mini.tier],
    armor = mini.tier === 2 && rand(0, 1) < 0.3,
    o = { kind: 'gremlin', hp: tier.gremlinHp + (armor ? 1 : 0), armor };
  if (mini.shift >= tier.throwFrom && rand(0, 1) < tier.throwChance) {
    o.thrower = true;
    raceHint(o, 'thrower');
  }
  return o;
}

function raceHazard(kind = pick(RACE_HAZARDS)) {
  return kind === 'gremlin' ? raceGremlin() : { kind };
}

function raceLanes() {
  const lanes = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes;
}

// Spawns the next row (or rows) and returns the distance in px until the next spawn.
function spawnTraffic() {
  const tier = RACE_TIERS[mini.tier];
  if (mini.phaseTime >= mini.raceTunnelAt - 2 && mini.phaseTime < mini.raceTunnelEnd) return raceSpawnTunnel();
  if (mini.raceTunnelRow > 0 && mini.phaseTime >= mini.raceTunnelEnd && !mini.raceTunnelDone) {
    mini.raceTunnelDone = true;
    return 160;
  }
  if (mini.tier === 0) return raceSpawnLesson();
  const kind = mini.raceNext,
    [a, b, c] = raceLanes();
  let extra = 0;
  if (kind === 'fork') {
    raceRow([
      { lane: a, kind: 'coin' },
      raceHint({ lane: b, kind: 'ramp' }, 'ramp'),
      { lane: c, ...raceHazard(pick(['wall', 'gremlin'])) }
    ]);
  } else if (kind === 'boost') {
    raceRow([
      raceHint({ lane: a, kind: 'boost' }, 'boost'),
      { lane: b, kind: 'coin' },
      { lane: c, ...raceHazard() }
    ]);
    mini.raceNext = 'coinrun';
  } else if (kind === 'coinrun') {
    raceRow([{ lane: a, kind: 'coin' }, { lane: b, kind: 'coin' }, { lane: c, ...raceHazard() }]);
  } else if (kind === 'double') {
    const style = pick(mini.tier === 1 ? ['barCrate', 'crateWall'] : ['barCrate', 'crateBar', 'crateWall']),
      gap = RACE_DOUBLE[mini.tier],
      first = { barCrate: 'bar', crateBar: 'crate', crateWall: 'crate' }[style],
      second = { barCrate: 'crate', crateBar: 'bar', crateWall: 'wall' }[style];
    raceRow([raceHint({ lane: a, kind: first }, style), { lane: b, kind: 'coin' }, { lane: c, kind: 'wall' }]);
    raceRow(
      [{ lane: a, kind: second }, { lane: b, kind: 'coin' }, { lane: c, kind: style === 'crateWall' ? 'coin' : 'wall' }],
      RACE_SPAWN_Y - gap
    );
    extra = gap;
  } else if (kind === 'nurse') {
    const beat = tier.beat;
    raceRow([
      { lane: 0, kind: 'coin' },
      { lane: 1, kind: 'coin' },
      { lane: 2, kind: 'coin' },
      raceHint(
        { lane: a, pos: a, kind: 'nurse', dir: a === 2 ? -1 : a === 0 ? 1 : pick([-1, 1]), period: beat, clock: rand(0, beat * 0.6) },
        'nurse'
      )
    ]);
  } else if (kind === 'roller') {
    raceRow([
      raceHint({ lane: a, kind: 'iv', hp: 1, dy: 0, roll: 0.5 }, 'iv'),
      { lane: b, kind: 'coin' },
      { lane: c, ...raceHazard(pick(['crate', 'bar'])) }
    ]);
  } else {
    raceRow([{ lane: a, kind: 'coin' }, { lane: b, ...raceHazard() }, { lane: c, ...raceHazard() }]);
  }
  if (kind !== 'boost') mini.raceNext = racePickPattern(kind);
  return tier.gap + extra + (mini.raceNext === 'roller' ? 20 : 0);
}

function racePickPattern(last) {
  const options = Object.keys(RACE_PATTERNS).filter(
    k =>
      RACE_PATTERNS[k].weight[mini.tier] > 0 &&
      mini.shift >= RACE_PATTERNS[k].from[mini.tier] &&
      !(k === last && ['nurse', 'roller', 'double'].includes(k))
  );
  let total = options.reduce((s, k) => s + RACE_PATTERNS[k].weight[mini.tier], 0),
    roll = rand(0, total);
  for (const k of options) {
    roll -= RACE_PATTERNS[k].weight[mini.tier];
    if (roll <= 0) return k;
  }
  return 'mixed';
}

// Level 1: crates, then bars, then walls, then gremlins, then one random type per row.
function raceSpawnLesson() {
  const tier = RACE_TIERS[0];
  let n = mini.raceLessonRow++,
    stage = 0;
  while (stage < RACE_LESSONS.length && n >= RACE_LESSONS[stage].rows) {
    n -= RACE_LESSONS[stage].rows;
    stage++;
  }
  const lesson = RACE_LESSONS[stage],
    kind = lesson ? lesson.kind : pick(RACE_HAZARDS),
    hazard = () => raceHazard(kind),
    [a, b, c] = raceLanes();
  let objects;
  if (lesson && n === 0) {
    // One hazard, right in your lane. Everything else is coins.
    const lane = mini.lane;
    objects = [0, 1, 2].map(l => (l === lane ? { lane: l, ...hazard() } : { lane: l, kind: 'coin' }));
  } else {
    objects = [{ lane: a, kind: 'coin' }, { lane: b, ...hazard() }, { lane: c, ...hazard() }];
  }
  if (lesson && n < 3) for (const o of objects) if (o.kind !== 'coin') o.hint = lesson.hint;
  raceRow(objects);
  return tier.gap + (lesson && n === lesson.rows - 1 ? 140 : 0);
}

// Level 3 donut tunnel: low bars across every lane, then walls with one gap, alternating fast.
function raceSpawnTunnel() {
  const n = mini.raceTunnelRow++;
  if (n === 0) {
    mini.flash = 1.2;
    mini.flashText = 'DONUT TUNNEL · SLIDE, STEER, REPEAT';
    return 300;
  }
  if (n % 2 === 1) {
    raceRow([0, 1, 2].map(lane => ({ lane, kind: 'bar' })), RACE_SPAWN_Y, { tunnel: true });
  } else {
    const move = pick([-1, 0, 1]);
    mini.raceTunnelLane = clamp(mini.raceTunnelLane + move, 0, 2);
    raceRow(
      [0, 1, 2].map(lane => (lane === mini.raceTunnelLane ? { lane, kind: 'coin' } : { lane, kind: 'wall' })),
      RACE_SPAWN_Y,
      { tunnel: true }
    );
  }
  return 155;
}

// ---- Art ----

// Horizontal offset of the track at a given y while a curve is active (bigger further away).
function raceBend(y) {
  const c = mini.raceCurve;
  if (!c) return 0;
  const k = Math.sin(Math.PI * clamp(c.t / c.dur, 0, 1)),
    far = clamp((RACE_CART_Y - y) / 500, -0.2, 1.1);
  return c.dir * k * (34 + 120 * far * far);
}

function raceLaneX(lane, y) {
  return 160 + lane * RACE_GAP + raceBend(y);
}

function raceHash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function drawRace(g) {
  const shake = mini.raceShake > 0 && !reduced ? Math.sin(mini.total * 95) * 16 * mini.raceShake : 0;
  g.save();
  // Everything below the title band; the shake never smears the title.
  g.beginPath();
  g.rect(0, 40, 600, 560);
  g.clip();
  g.translate(shake, 0);
  raceDrawCorridor(g);
  raceDrawTrack(g);
  for (const s of mini.raceSplats) raceGunkArt(g, s.x + raceBend(s.y), s.y, 1.4, 0, true);
  for (const m of mini.raceMarks) {
    g.globalAlpha = clamp(m.life, 0, 1) * 0.55;
    rr(g, m.x - 3 + raceBend(m.y), m.y, 6, 16, 3, '#102a33');
  }
  g.globalAlpha = 1;
  const rows = [...mini.rows].sort((a, b) => a.y - b.y);
  for (const r of rows) for (const o of r.objects) raceDrawObject(g, r, o);
  for (const k of mini.raceGunk) raceGunkArt(g, raceLaneX(k.lane, k.y), k.y, 1, k.spin, false);
  for (const b of mini.bullets) softball(g, raceLaneX(b.lane, b.y), b.y, 9);
  raceDrawCart(g);
  // Landing zone for incoming gunk, drawn over the gurney so it is never hidden.
  for (const k of mini.raceGunk) {
    const x = raceLaneX(k.lane, RACE_LINE);
    g.globalAlpha = 0.55 + 0.4 * Math.sin(mini.total * 14);
    g.strokeStyle = '#c9f59a';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(x, RACE_LINE + 4, 52, 17, 0, 0, Math.PI * 2);
    g.stroke();
    label(g, 'GUNK!', x, RACE_LINE - 20, 14, '#e9ffbf', 'center');
    g.globalAlpha = 1;
  }
  raceDrawSpeedLines(g);
  for (const p of mini.racePops) {
    g.globalAlpha = clamp(p.life * 2, 0, 1);
    label(g, p.text, p.x + raceBend(p.y), p.y, 15, p.col, 'center');
  }
  g.globalAlpha = 1;
  raceDrawHud(g);
  g.restore();
}

function raceDrawCorridor(g) {
  rect(g, 0, 40, 600, 560, gradient(g, 0, 40, 0, 560, '#1d3c4c', '#183243'));
  // Far layer: dim windows scrolling at half speed.
  for (let i = 0; i < 6; i++) {
    const y = ((i * 120 + mini.raceDist * 0.5) % 720) - 60;
    for (const side of [0, 1]) {
      const x = side ? 540 : 14,
        b = raceBend(y) * 0.6;
      rr(g, x + b, y, 46, 80, 6, '#23495899');
      rr(g, x + 5 + b, y + 6, 36, 30, 4, '#3d6f7c55');
    }
  }
  // Near layer: door frames and handrails at track speed.
  for (let i = 0; i < 5; i++) {
    const y = ((i * 160 + mini.raceDist) % 800) - 80;
    for (const side of [-1, 1]) {
      const edge = (side < 0 ? 80 : 520) + raceBend(y);
      rr(g, edge + side * 18 - 9, y, 18, 70, 4, '#4d7b84');
      line(g, [[edge + side * 8, y - 30], [edge + side * 8, y + 100]], '#9cdbca55', 3);
      if (i % 2 === 0) rr(g, edge + side * 40 - 12, y + 18, 24, 32, 4, '#e6b38a55');
    }
  }
}

function raceDrawTrack(g) {
  const ys = [];
  for (let y = 40; y <= 600; y += 28) ys.push(y);
  path(
    g,
    p => {
      ys.forEach((y, i) => (i ? p.lineTo(80 + raceBend(y), y) : p.moveTo(80 + raceBend(y), y)));
      for (let i = ys.length - 1; i >= 0; i--) p.lineTo(520 + raceBend(ys[i]), ys[i]);
      p.closePath();
    },
    gradient(g, 80, 40, 0, 560, '#3c6e7e', '#305264')
  );
  for (const x of [80, 520]) line(g, ys.map(y => [x + raceBend(y), y]), '#bfe6d2', 4);
  g.setLineDash([24, 26]);
  g.lineDashOffset = -mini.raceDist;
  for (const x of [230, 370]) line(g, ys.map(y => [x + raceBend(y), y]), '#c7e1ca44', 3);
  g.setLineDash([]);
  // Tunnel rows sit inside the CT donut: dark band and a scanner ring.
  for (const r of mini.rows) {
    if (!r.tunnel) continue;
    const x = 300 + raceBend(r.y);
    rect(g, 0, r.y - 78, 600, 156, '#0b1c2a99');
    g.strokeStyle = '#d9e7ef';
    g.lineWidth = 14;
    g.beginPath();
    g.ellipse(x, r.y - 40, 265, 70, 0, Math.PI, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#7fd2e4';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x, r.y - 40, 258, 64, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }
}

function raceDrawObject(g, r, o) {
  const y = r.y + (o.dy || 0);
  if (y < -60 || y > 640) return;
  const x = o.kind === 'nurse' ? 160 + o.pos * RACE_GAP + raceBend(y) : raceLaneX(o.lane, y);
  if (o.kind === 'coin') {
    if (o.done) return;
    for (const d of [-12, 12]) {
      ellipse(g, x + d, y, 9, 12, '#f3ce7b');
      ellipse(g, x + d, y, 5, 8, '#ffe8a9');
    }
  } else if (o.kind === 'gremlin') {
    if (o.hp <= 0) return;
    const winding = o.wind !== undefined && !o.thrown;
    gremlin(g, x, y + 22, 1.15, o.thrower ? 0 : 3, mini.total + r.id);
    if (o.armor) {
      rr(g, x - 25, y - 33, 50, 18, 9, gradient(g, x - 20, y - 33, 40, 18, '#e7ecdf', '#8eabbc'), '#d8ebdf', 2);
    }
    if (winding) {
      raceGunkArt(g, x + 26, y - 40 - (0.65 - o.wind) * 30, 0.8, mini.total * 6, false);
      label(g, '!', x - 24, y - 34, 22, '#e9ffbf', 'center');
    }
    label(g, o.hp + (o.hp > 1 ? ' HITS' : ' HIT'), x, y - 44, 11, '#dbf0dc', 'center');
  } else if (o.kind === 'crate') {
    raceCrateArt(g, x, y, 1);
  } else if (o.kind === 'bar') {
    line(g, [[x - 49, y + 26], [x - 49, y - 24], [x + 49, y - 24], [x + 49, y + 26]], '#b39bd7', 7);
    rr(g, x - 47, y - 29, 94, 16, 6, '#dbb9e9');
    label(g, '↓ SLIDE', x, y + 7, 14, '#e2d7ef', 'center');
  } else if (o.kind === 'wall') {
    rr(g, x - 46, y - 35, 92, 65, 9, gradient(g, x, y - 35, 0, 65, '#eeadc0', '#a35e86'));
    line(g, [[x - 26, y - 20], [x + 26, y + 15]], '#f4d1cf', 5);
    line(g, [[x + 26, y - 20], [x - 26, y + 15]], '#f4d1cf', 5);
  } else if (o.kind === 'boost') {
    if (o.done) return;
    rr(g, x - 44, y - 30, 88, 60, 10, '#2c5b45', '#9df0b5', 2);
    for (let i = 0; i < 3; i++) {
      const glowA = 0.4 + 0.6 * ((Math.sin(mini.total * 9 - i) + 1) / 2),
        cy = y + 14 - i * 16;
      g.globalAlpha = glowA;
      line(g, [[x - 22, cy + 8], [x, cy - 4], [x + 22, cy + 8]], '#c8ff9a', 6);
    }
    g.globalAlpha = 1;
  } else if (o.kind === 'ramp') {
    poly(g, [[x - 44, y + 28], [x + 44, y + 28], [x + 36, y - 30], [x - 36, y - 30]], gradient(g, x, y - 30, 0, 58, '#f6dc8a', '#b98a4e'));
    for (let i = 0; i < 3; i++) line(g, [[x - 30, y + 16 - i * 16], [x + 30, y + 16 - i * 16]], '#8a5f3d', 3);
    label(g, 'RAMP', x, y + 6, 12, '#4a3326', 'center');
  } else if (o.kind === 'nurse') {
    raceNurseArt(g, x, y, o);
  } else if (o.kind === 'iv') {
    raceIvArt(g, x, y, o);
  }
  if (o.hint && !o.done && y > 70) raceCallout(g, x, y - (o.kind === 'iv' ? 104 : 62), o.hint);
}

function raceCallout(g, x, y, text) {
  const w = Math.max(120, text.length * 8.2),
    cx = clamp(x, 20 + w / 2, 580 - w / 2),
    bob = Math.sin(mini.total * 6) * 3;
  rr(g, cx - w / 2, y - 22 + bob, w, 28, 10, '#102c42ee', '#ffe1a0', 1.5);
  poly(g, [[x - 8, y + 6 + bob], [x + 8, y + 6 + bob], [x, y + 16 + bob]], '#ffe1a0');
  label(g, text, cx, y - 3 + bob, 13, '#ffe7b8', 'center');
}

function raceCrateArt(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  rr(g, -43, -20, 86, 40, 8, gradient(g, 0, -20, 0, 40, '#f0c18a', '#b57a70'), '#f6d1a5', 2);
  line(g, [[-40, -17], [40, 17]], '#c48e6d', 3);
  label(g, '↑ JUMP', 0, 5, 14, '#4b4051', 'center');
  g.restore();
}

function raceNurseArt(g, x, y, o) {
  const left = o.period - o.clock,
    next = raceNurseLaneAt(o, left + 0.01),
    warn = left < 0.45;
  shadow(g, x, y + 30, 46, 9);
  rr(g, x - 44, y - 36, 88, 66, 8, gradient(g, x, y - 36, 0, 66, '#f2f5ee', '#aac0c8'), '#6d8f9c', 2);
  rr(g, x - 36, y - 26, 72, 12, 4, '#d27b8a');
  rr(g, x - 36, y - 6, 72, 12, 4, '#7fb4c9');
  for (const d of [-22, 0, 22]) ellipse(g, x + d, y + 18, 5, 5, '#f0c96c');
  for (const d of [-34, 34]) ellipse(g, x + d, y + 32, 7, 5, '#3a5560');
  // Beat ring: fills up until the next hop.
  g.strokeStyle = warn ? '#ffd28a' : '#9fdcd2';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x, y - 52, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (o.clock / o.period));
  g.stroke();
  if (warn && Math.sin(mini.total * 30) > -0.3) {
    const dx = next > o.lane ? 1 : -1;
    poly(g, [[x + dx * 52, y - 14], [x + dx * 52, y + 14], [x + dx * 72, y]], '#ffd28a');
  }
}

function raceIvArt(g, x, y, o) {
  g.save();
  g.translate(x, y + 24);
  g.rotate(o.hp > 0 ? Math.sin(mini.total * 11 + o.lane) * 0.08 : (o.fall || 0) * 1.45);
  shadow(g, 0, 2, 24, 6);
  line(g, [[-20, 0], [0, -6], [20, 0]], '#b6cfcb', 4);
  for (const d of [-20, 20]) ellipse(g, d, 2, 5, 4, '#456775');
  line(g, [[0, -6], [0, -86]], '#c9dde0', 4);
  line(g, [[-16, -80], [16, -80]], '#d6e6df', 3);
  rr(g, 4, -78, 20, 30, 5, '#e7f1dccc', '#bbd5c9', 1);
  rr(g, 7, -68, 14, 17, 3, '#edcb80');
  rr(g, -12, -48, 24, 18, 4, '#386e7b');
  g.restore();
  if (o.hp > 0) label(g, '1 HIT', x, y - 72, 11, '#dbf0dc', 'center');
}

function raceGunkArt(g, x, y, s, spin, flat) {
  g.save();
  g.translate(x, y);
  g.scale(s, flat ? s * 0.45 : s);
  g.rotate(spin);
  ellipse(g, 0, 0, 13, 11, '#9fd36a');
  ellipse(g, 8, 6, 6, 5, '#7fb54e');
  ellipse(g, -9, 4, 5, 4, '#c7ef8e');
  ellipse(g, -3, -4, 4, 3, '#e3ffc0');
  g.restore();
}

function raceFlame(g, x, y, s, t) {
  const f = 1 + Math.sin(t * 40) * 0.18;
  g.save();
  g.translate(x, y);
  g.scale(s, s * f);
  path(
    g,
    p => {
      p.moveTo(-18, 0);
      p.quadraticCurveTo(-10, 30, 0, 52);
      p.quadraticCurveTo(10, 30, 18, 0);
      p.closePath();
    },
    '#ff9b54'
  );
  path(
    g,
    p => {
      p.moveTo(-9, 0);
      p.quadraticCurveTo(-4, 18, 0, 32);
      p.quadraticCurveTo(4, 18, 9, 0);
      p.closePath();
    },
    '#ffe9a0'
  );
  g.restore();
}

function raceDrawCart(g) {
  const x = mini.cartX + raceBend(RACE_CART_Y),
    lift = 1 + mini.jump / 420;
  shadow(g, x, RACE_CART_Y + 6, 43 / lift, 10 / lift);
  if (mini.raceBoost > 0) {
    for (const side of [-1, 1]) raceFlame(g, x + side * 24, RACE_CART_Y + 14 - mini.jump, 0.7 + mini.raceBoost * 0.1, mini.total + side);
    glow(g, x, RACE_CART_Y + 30 - mini.jump, 70, '#ffb86a33');
  }
  g.save();
  g.translate(x, RACE_CART_Y - mini.jump);
  g.rotate(mini.raceLean);
  g.scale(lift, lift);
  if (mini.inv > 0) g.globalAlpha = 0.6 + 0.4 * Math.sin(mini.total * 14);
  if (mini.slide > 0) {
    g.rotate(-0.13);
    g.scale(1, 0.64);
  }
  miniBed(g, 0, 0, 0.62);
  g.restore();
  g.globalAlpha = 1;
  if (mini.jump > 0) label(g, 'AIR MACY', x, RACE_CART_Y - 105 - mini.jump, 11, '#ffebb7', 'center');
  const c = mini.raceCurve;
  if (c && c.warn > 0) {
    const dx = c.dir;
    g.globalAlpha = 0.6 + 0.4 * Math.sin(mini.total * 24);
    poly(g, [[x + dx * 60, RACE_CART_Y - 70], [x + dx * 60, RACE_CART_Y - 30], [x + dx * 92, RACE_CART_Y - 50]], '#ffd28a');
    g.globalAlpha = 1;
    label(g, 'HOLD', x + dx * 74, RACE_CART_Y - 78, 13, '#ffd28a', 'center');
  }
}

function raceDrawSpeedLines(g) {
  const fast = mini.raceSpeedNow / 160 - 0.75 + (mini.raceBoost > 0 ? 0.7 : 0);
  if (fast <= 0) return;
  g.globalAlpha = clamp(fast, 0, 1) * 0.5;
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1,
      x = side < 0 ? 10 + raceHash(i) * 70 : 520 + raceHash(i) * 70,
      len = 40 + raceHash(i + 50) * 70,
      y = ((raceHash(i + 99) * 700 + mini.raceDist * 2.4) % 720) - 60;
    line(g, [[x, y], [x, y + len]], '#e8fbff', 2);
  }
  g.globalAlpha = 1;
}

function raceDrawHud(g) {
  const mult = raceMult();
  rr(g, 18, 556, 128, 30, 10, '#102c42d8', mult > 1 ? '#ffe1a0' : '#6d939c', 1);
  label(g, 'STUNT CHAIN ×' + mult, 82, 576, 12, mult > 1 ? '#ffe1a0' : '#cfe6dc', 'center');
  rr(g, 454, 556, 128, 30, 10, '#102c42d8', '#6d939c', 1);
  label(g, 'STUNTS ' + mini.stunts + '/' + mini.stuntGoal, 518, 576, 12, '#cfe6dc', 'center');
  if (mini.raceBoost > 0) {
    rr(g, 160, 590, 280, 6, 3, '#31575b');
    rr(g, 160, 590, 280 * (mini.raceBoost / RACE_BOOST), 6, 3, '#ffb86a');
  }
}
