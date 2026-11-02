// Polarity Panic (MRI room). Drag a magnet to push and pull drifting nutrients into matching
// ports, flush pink gunk down the floor vent, and keep gremlin thieves off the merchandise.
// Canvas 600 × 600. Level 1 teaches on a gentle grid with on-canvas hints. Levels 2 and 3 send
// orbs in from the edges and add thieves, overheat, surge pickups, repulsor walls, a patrolling
// barrier and splitting gunk. Level 3 also swaps the ports mid-shift.
const MAGNET_PORT_X = [135, 465];
const MAGNET_PORT_Y = 96;
const MAGNET_VENT_X = 300;
const MAGNET_VENT_HALF = 65;
const MAGNET_RADIUS = 170;
const MAGNET_CHAIN_WINDOW = 2;
const MAGNET_BARRIER_Y = 345;
const MAGNET_BARRIER_HALF = 62;
// Repulsor walls guard the approach under each port during shifts 2 and 3 of levels 2 and 3.
const MAGNET_WALLS = [
  [[36, 254], [126, 216]],
  [[564, 254], [474, 216]]
];
// mix per shift: [share of good orbs that are mint, chance that a new orb is gunk].
const MAGNET_LEVELS = [
  {
    limit: 105,
    goal: 12,
    gate: 68,
    start: 4,
    cap: [7, 7, 8],
    entry: false,
    thieves: [0, 0, 0],
    thiefSpeed: 0,
    heat: 0,
    surge: false,
    walls: false,
    swap: false,
    split: false,
    hints: true,
    mix: [
      [0.5, 0],
      [0.5, 0.13],
      [0.5, 0.15]
    ]
  },
  {
    limit: 120,
    goal: 15,
    gate: 68,
    start: 6,
    cap: [8, 9, 10],
    entry: true,
    thieves: [1, 1, 2],
    thiefSpeed: 58,
    heat: 3.4,
    surge: true,
    walls: true,
    swap: false,
    split: true,
    hints: false,
    mix: [
      [0.62, 0.1],
      [0.32, 0.15],
      [0.5, 0.2]
    ]
  },
  {
    limit: 135,
    goal: 18,
    gate: 58,
    start: 7,
    cap: [9, 10, 11],
    entry: true,
    thieves: [1, 2, 2],
    thiefSpeed: 66,
    heat: 3,
    surge: true,
    walls: true,
    swap: true,
    split: true,
    hints: false,
    mix: [
      [0.38, 0.13],
      [0.66, 0.17],
      [0.5, 0.22]
    ]
  }
];

const MAGNET = registerGame({
  id: 1,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Polarity Panic',
    genre: 'MAGNETS · PUSH / PULL · PHYSICS',
    headline: 'Opposites attract. Gremlins steal.',
    desc: 'Steer drifting nutrients into matching ports with a movable magnet. Pull them toward your finger, flip polarity to push, then let go and let them coast. Gremlin thieves want your nutrients down the drain. Your magnet has opinions about that, until it overheats.',
    goal: 'Sort the nutrient quota before the shift ends.',
    control:
      'Drag anywhere to move the magnet. Hold to apply force; release to coast. Tap PULL / PUSH (Space) to flip polarity.',
    avoid:
      'Mint circles go left; gold diamonds go right. Wrong colors bounce back and break your chain. Push pink gunk into the bottom vent. Momentum matters.',
    cue: 'Drag magnet · hold = force · release = coast · Space flips polarity'
  },
  tierNotes: [
    '105s · two ports · gentle drift · hints on',
    '120s · thieves · overheat · repulsor walls',
    '135s · port swaps · splitting gunk · tight ports'
  ],
  init() {
    const lv = MAGNET_LEVELS[mini.tier];
    initArcadeRun(lv.limit);
    mini.goal = lv.goal;
    mini.magnet = { x: 300, y: 360, on: false, mode: 1 };
    mini.sortErrors = 0;
    mini.orbs = [];
    mini.orbSerial = 0;
    mini.magnetThieves = [];
    mini.magnetPickups = [];
    mini.magnetPops = [];
    mini.magnetHeat = 0;
    mini.magnetHot = false;
    mini.magnetSurge = 0;
    mini.magnetChain = 0;
    mini.magnetChainT = 0;
    mini.magnetBestChain = 0;
    mini.magnetSwap = false;
    mini.magnetSwapAt = lv.swap ? 45 : Infinity;
    mini.magnetSwapWarned = false;
    mini.magnetBarrierPhase = 0;
    mini.magnetThiefT = 7;
    mini.magnetPickT = 13;
    mini.magnetPulse = [0, 0];
    mini.magnetVentPulse = 0;
    mini.magnetStolen = 0;
    mini.magnetFlushed = 0;
    mini.magnetGunkVented = 0;
    mini.magnetSplits = 0;
    mini.magnetEverOn = false;
    mini.magnetLastTouched = null;
    mini.magnetWallCool = 0;
    for (let i = 0; i < lv.start; i++) spawnOrb(false, i);
  },
  controls() {
    setControls([
      {
        id: 'polarity',
        text: mini.magnet.mode === 1 ? 'PULL → switch to PUSH' : 'PUSH → switch to PULL',
        key: 'Space',
        hot: true
      }
    ]);
  },
  update(dt) {
    updateArcade(dt, updateMagnet);
  },
  draw(g) {
    arcadeBackdrop(g, '#214a63', '#7dbddb22', 'MRI / MAGNETIC SORTER');
    magnetDraw(g);
  },
  down(p) {
    Object.assign(mini.magnet, { x: p.x, y: p.y, on: true });
    mini.magnetEverOn = true;
  },
  move(p) {
    Object.assign(mini.magnet, { x: p.x, y: p.y });
  },
  up() {
    if (mini.magnet) mini.magnet.on = false;
  },
  action(a) {
    if (a === 'polarity') {
      mini.magnet.mode *= -1;
      MAGNET.controls();
      sfx(mini.magnet.mode === 1 ? 'pump' : 'shield');
    }
  },
  assist() {
    mini.slow = 5;
    mini.orbs = mini.orbs.filter(o => !o.bad);
    for (const th of mini.magnetThieves) magnetStun(th, 3);
    mini.magnetHeat = 0;
    mini.magnetHot = false;
    mini.flash = 1;
    mini.flashText = 'FIELD STABILIZED · GUNK GONE · GREMLINS DAZED';
  },
  key(k, e) {
    if (e.repeat) return true;
    if (k === ' ') miniAction('polarity');
    return true;
  },
  shiftMessage(shift) {
    const lv = MAGNET_LEVELS[mini.tier];
    if (!lv.walls)
      return shift === 1
        ? 'SHIFT 2 · currents kick in and pink gunk arrives. Vent it.'
        : 'SHIFT 3 · stronger currents. Keep sorting.';
    const share = lv.mix[shift][0],
      mix = share > 0.55 ? 'Mostly mint now.' : share < 0.45 ? 'Gold rush incoming.' : 'Even mix, extra gunk.';
    return shift === 1
      ? 'SHIFT 2 · repulsor walls on, barrier patrolling. ' + mix
      : 'FINAL SHIFT · barrier sped up. ' + mix + (lv.swap ? ' Ports keep swapping.' : '');
  },
  lesson() {
    const i = MAGNET.info,
      extra = [
        ' Level 1 shows hints on the board. Take your time.',
        ' New: gremlin thieves drag nutrients to the vent. Hold the field on one until it drops the goods, then shove it down the vent for a bonus. Holding force over 3 seconds overheats the magnet, so let go to cool. Grab a surge bolt for double reach. Sort within 2 seconds of the last one to chain points.',
        ' New: the ports swap sides with a 2 second warning. Shove gunk too hard and it splits in two. Thieves travel in pairs.'
      ][mini.tier];
    return {
      title: i.game + ' · ' + mini.limit + ' second shift',
      goal: i.goal + ' Target: ' + mini.goal + '.',
      control: i.control,
      avoid: i.avoid + extra,
      demo: 'magnet',
      cue: i.cue
    };
  },
  statLabel: () => 'SORTED / SHIFT',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () =>
    'SCORE ' +
    mini.score +
    ' · BEST CHAIN ×' +
    mini.magnetBestChain +
    (mini.tier ? ' · FLUSHED ' + mini.magnetFlushed : '') +
    ' · ' +
    mini.helps +
    ' ASSISTS',
  assistText: () => 'STABILIZE · ' + mini.helps + ' (E)',
  // Wrong-port bounces cost a little style; long chains and flushed thieves earn some back.
  quality: () =>
    arcadeQuality(
      (mini.sortErrors || 0) * 1.2 - Math.min(6, mini.magnetBestChain || 0) - Math.min(4, mini.magnetFlushed || 0)
    ),
  onWin() {
    if (mini.magnetFlushed > 1) return mini.magnetFlushed + ' gremlins went down the vent. Facilities has questions.';
    if (mini.magnetBestChain >= 4) return 'Chain of ' + mini.magnetBestChain + '. The MRI is legally a sorting machine now.';
    return undefined;
  },
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#336a7c', '#193b4e'));
    for (let i = 0; i < 6; i++) {
      const y = 88 + i * 22;
      line(g, [[20, y], [140, y + 6], [210, y + 18 - i * 4], [280, y + 6], [400, y]], '#a7e5dd22', 2);
    }
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 61,
        y = 92 + Math.sin(i) * 32;
      ellipse(g, x, y, 15, 15, i % 2 ? '#eaca8b' : '#a8dec0');
    }
    gremlin(g, 340, 205, 0.7, 2, 0.4);
    ellipse(g, 322, 182, 10, 10, '#eaca8b');
    line(g, [[173, 150], [173, 181], [247, 181], [247, 150]], '#b9dfd4', 16);
    line(g, [[173, 135], [173, 151]], '#eda7b1', 16);
    line(g, [[247, 135], [247, 151]], '#eccb89', 16);
    label(g, MAGNET.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

function magnetLevel() {
  return MAGNET_LEVELS[mini.tier] || MAGNET_LEVELS[0];
}

// Which orb kind a port accepts right now: 0 mint, 1 gold. Level 3 swaps them mid-shift.
function magnetPortKind(port) {
  return mini.magnetSwap ? 1 - port : port;
}

function magnetPower() {
  return !!(mini.magnet && mini.magnet.on && !mini.magnetHot);
}

function magnetRadius() {
  return MAGNET_RADIUS * (mini.magnetSurge > 0 ? 2 : 1);
}

function magnetBarrierX() {
  return MAGNET_VENT_X + Math.sin(mini.magnetBarrierPhase) * 165;
}

function magnetBarrierOn() {
  return magnetLevel().walls && mini.shift > 0;
}

// Level 1 lays orbs out on a gentle grid; later levels throw them in from the sides and bottom.
function spawnOrb(bad = false, offset = 0) {
  const lv = magnetLevel(),
    id = mini.orbSerial++,
    share = lv.mix[mini.shift || 0][0],
    o = {
      id,
      x: 90 + ((id * 83) % 420),
      y: 330 + (offset % 3) * 75,
      vx: rand(-20, 20),
      vy: rand(-15, 15),
      kind: lv.entry ? (rand(0, 1) < share ? 0 : 1) : id % 2,
      bad,
      touched: false,
      r: bad ? 20 : 19,
      cool: 0,
      small: false,
      entering: false,
      held: null,
      trail: [],
      trailT: 0
    };
  if (lv.entry) {
    const side = Math.floor(rand(0, 3)),
      kick = mini.rules.mini;
    o.entering = true;
    if (side === 2) {
      // From the floor, either side of the vent.
      o.x = rand(0, 1) < 0.5 ? rand(70, 215) : rand(385, 530);
      o.y = 624;
      o.vx = rand(-35, 35);
      o.vy = -rand(150, 205) * kick;
    } else {
      o.x = side ? 626 : -26;
      o.y = rand(270, 520);
      o.vx = (side ? -1 : 1) * rand(125, 175) * kick;
      o.vy = rand(-45, 30);
    }
  }
  mini.orbs.push(o);
  return o;
}

function magnetSpawnThief() {
  const left = rand(0, 1) < 0.5;
  mini.magnetThieves.push({
    id: mini.orbSerial++,
    x: left ? -28 : 628,
    y: rand(380, 520),
    vx: 0,
    vy: 0,
    dir: left ? 1 : -1,
    state: 'seek',
    t: 0,
    target: null,
    zap: 0,
    entering: true,
    bob: rand(0, 6)
  });
  sfx('trap');
}

// Any held field jolts a gremlin. A dragging thief drops what it was carrying.
function magnetStun(th, seconds = 1.6) {
  if (th.state === 'drag') {
    const o = mini.orbs.find(o => o.held === th.id);
    if (o) {
      o.held = null;
      o.vx = th.vx * 0.6;
      o.vy = th.vy * 0.6 - 70;
      o.cool = 0;
    }
    mini.flash = 0.7;
    mini.flashText = 'GREMLIN DROPPED IT · NOW SHOVE IT IN THE VENT';
  }
  if (th.state !== 'stun') sfx('stun');
  th.state = 'stun';
  th.t = Math.max(th.t, seconds);
  th.zap = 0;
  th.target = null;
}

function magnetPop(x, y, text, col) {
  mini.magnetPops.push({ x, y, text, col, life: 1 });
}

// Pushes a circle out of a capsule-shaped segment and reflects it. Returns true on contact.
function magnetSegmentHit(o, a, b, bounce, kick, wallVx = 0) {
  const ex = b[0] - a[0],
    ey = b[1] - a[1],
    t = clamp(((o.x - a[0]) * ex + (o.y - a[1]) * ey) / (ex * ex + ey * ey), 0, 1),
    px = a[0] + ex * t,
    py = a[1] + ey * t,
    dx = o.x - px,
    dy = o.y - py,
    d = Math.hypot(dx, dy) || 0.001,
    reach = o.r + 7;
  if (d >= reach) return false;
  const nx = dx / d,
    ny = dy / d;
  o.x = px + nx * reach;
  o.y = py + ny * reach;
  const vn = (o.vx - wallVx) * nx + o.vy * ny;
  if (vn < 0) {
    o.vx -= (1 + bounce) * vn * nx;
    o.vy -= (1 + bounce) * vn * ny;
  }
  o.vx += nx * kick;
  o.vy += ny * kick;
  return true;
}

// Soft outward field near a repulsor, so orbs feel the wall before they hit it.
function magnetRepel(o, a, b, dt) {
  const ex = b[0] - a[0],
    ey = b[1] - a[1],
    t = clamp(((o.x - a[0]) * ex + (o.y - a[1]) * ey) / (ex * ex + ey * ey), 0, 1),
    dx = o.x - (a[0] + ex * t),
    dy = o.y - (a[1] + ey * t),
    d = Math.hypot(dx, dy) || 0.001,
    edge = o.r + 7;
  if (d > edge + 30 || d < edge) return;
  const f = (1 - (d - edge) / 30) * 420;
  o.vx += (dx / d) * f * dt;
  o.vy += (dy / d) * f * dt;
}

function magnetSorted(o, port) {
  o.dead = true;
  mini.got++;
  mini.magnetChain = mini.magnetChainT > 0 ? mini.magnetChain + 1 : 1;
  mini.magnetChainT = MAGNET_CHAIN_WINDOW;
  mini.magnetBestChain = Math.max(mini.magnetBestChain, mini.magnetChain);
  const mult = Math.min(5, mini.magnetChain);
  praise(140 * mult, 1);
  mini.magnetPulse[port] = 0.6;
  arcadeBurst(o.x, o.y, magnetPortKind(port) ? '#ffe09b' : '#b5e8c5');
  if (mult > 1) {
    magnetPop(o.x, 130, 'CHAIN ×' + mult, '#ffe5a8');
    sfx('combo', { count: mult });
  } else sfx('catch');
}

function magnetWrongPort(o) {
  mini.sortErrors++;
  mini.combo = 0;
  mini.magnetChain = 0;
  mini.magnetChainT = 0;
  mini.flash = 0.8;
  mini.flashText = 'WRONG COLOR · BOUNCED BACK · CHAIN BROKEN';
  o.y = 112;
  o.vy = 150;
  o.vx = (300 - o.x) * 0.7;
  o.cool = 1.2;
  sfx('bounce');
}

function magnetSplit(o, born) {
  o.dead = true;
  mini.magnetSplits++;
  const a = Math.atan2(o.vy, o.vx),
    s = Math.hypot(o.vx, o.vy) * 0.75;
  for (const side of [-1, 1]) {
    const b = a + side * 0.6;
    born.push({
      id: mini.orbSerial++,
      x: o.x - Math.sin(a) * side * 11,
      y: o.y + Math.cos(a) * side * 11,
      vx: Math.cos(b) * s,
      vy: Math.sin(b) * s,
      kind: 0,
      bad: true,
      touched: true,
      r: 13,
      cool: 0,
      small: true,
      entering: false,
      held: null,
      trail: [],
      trailT: 0
    });
  }
  arcadeBurst(o.x, o.y, '#ed8daf', 6);
  mini.flash = 0.7;
  mini.flashText = 'GUNK SPLIT. CONGRATULATIONS, THERE ARE TWO.';
  sfx('split');
}

function updateMagnet(dt) {
  const m = mini.magnet,
    lv = magnetLevel(),
    rate = mini.slow > 0 ? 0.55 : 1,
    gate = lv.gate;
  // Timers.
  mini.magnetChainT = Math.max(0, mini.magnetChainT - dt);
  if (mini.magnetChainT <= 0) mini.magnetChain = 0;
  mini.magnetSurge = Math.max(0, mini.magnetSurge - dt);
  mini.magnetVentPulse = Math.max(0, mini.magnetVentPulse - dt);
  mini.magnetWallCool = Math.max(0, mini.magnetWallCool - dt);
  for (let i = 0; i < 2; i++) mini.magnetPulse[i] = Math.max(0, mini.magnetPulse[i] - dt);
  for (const p of mini.magnetPops) {
    p.life -= dt;
    p.y -= 30 * dt;
  }
  mini.magnetPops = mini.magnetPops.filter(p => p.life > 0);
  // Overheat: about three seconds of continuous force. Only letting go cools the coil.
  if (lv.heat) {
    if (m.on && !mini.magnetHot) mini.magnetHeat += dt / lv.heat;
    else if (!m.on) mini.magnetHeat = Math.max(0, mini.magnetHeat - dt / 1.5);
    if (!mini.magnetHot && mini.magnetHeat >= 1) {
      mini.magnetHeat = 1;
      mini.magnetHot = true;
      mini.flash = 0.9;
      mini.flashText = 'MAGNET OVERHEATED · LET GO TO COOL IT';
      sfx('stun');
    }
    if (mini.magnetHot && mini.magnetHeat <= 0.3) {
      mini.magnetHot = false;
      sfx('reload');
    }
  }
  // Level 3 port swap, telegraphed two seconds ahead.
  if (lv.swap) {
    if (!mini.magnetSwapWarned && mini.phaseTime >= mini.magnetSwapAt - 2) {
      mini.magnetSwapWarned = true;
      mini.flash = 1.2;
      mini.flashText = 'PORTS SWAP IN 2 SECONDS';
      sfx('wave');
    }
    if (mini.phaseTime >= mini.magnetSwapAt) {
      mini.magnetSwap = !mini.magnetSwap;
      mini.magnetSwapAt += 30;
      mini.magnetSwapWarned = false;
      mini.magnetPulse = [0.6, 0.6];
      mini.flash = 1;
      mini.flashText = mini.magnetSwap ? 'SWAPPED · MINT RIGHT, GOLD LEFT' : 'SWAPPED BACK · MINT LEFT, GOLD RIGHT';
      sfx('lock');
    }
  }
  const barrier = magnetBarrierOn(),
    omega = barrier ? (mini.shift === 2 ? 0.85 : 0.55) * mini.rules.speed : 0;
  mini.magnetBarrierPhase += omega * dt * rate;
  const bx = magnetBarrierX(),
    bvx = Math.cos(mini.magnetBarrierPhase) * 165 * omega,
    power = magnetPower(),
    radius = magnetRadius();
  // Surge pickups.
  if (lv.surge) {
    mini.magnetPickT -= dt;
    if (mini.magnetPickT <= 0 && !mini.magnetPickups.length) {
      mini.magnetPickups.push({ x: rand(150, 450), y: rand(240, 450), life: 9 });
      mini.magnetPickT = rand(15, 21);
    }
    for (const p of mini.magnetPickups) {
      p.life -= dt;
      if (m.on && dist(m, p) < 38) {
        p.life = 0;
        mini.magnetSurge = 5;
        mini.flash = 0.9;
        mini.flashText = 'SURGE · DOUBLE REACH FOR 5 SECONDS';
        sfx('powerup');
      }
    }
    mini.magnetPickups = mini.magnetPickups.filter(p => p.life > 0);
  }
  // Thief arrivals.
  const thiefCap = lv.thieves[mini.shift];
  if (thiefCap) {
    mini.magnetThiefT -= dt;
    if (mini.magnetThiefT <= 0) {
      if (mini.magnetThieves.length < thiefCap) magnetSpawnThief();
      mini.magnetThiefT = rand(9, 13) / mini.rules.speed;
    }
  }
  const born = [];
  for (const o of mini.orbs) {
    o.cool = Math.max(0, o.cool - dt);
    o.trail ??= [];
    o.trailT = (o.trailT || 0) - dt;
    if (o.trailT <= 0) {
      o.trail.push({ x: o.x, y: o.y });
      if (o.trail.length > 6) o.trail.shift();
      o.trailT = 0.035;
    }
    if (o.held != null) continue;
    const dx = m.x - o.x,
      dy = m.y - o.y,
      d = Math.hypot(dx, dy);
    if (power && d < radius && d > 8) {
      const f = (1 - d / (radius + 10)) * 1150 * m.mode;
      o.vx += (dx / d) * f * dt;
      o.vy += (dy / d) * f * dt;
      o.touched = true;
      mini.magnetLastTouched = o.id;
    }
    // Moving scan currents arrive during later shifts; the force is visible on the board.
    if (mini.shift > 0 && mini.slow <= 0) {
      o.vx += Math.sin(mini.total * 0.7 + o.y * 0.012) * mini.shift * (20 + mini.tier * 8) * dt;
    }
    // Entering orbs are pulled on board so a collision can never strand them off screen.
    if (o.entering) {
      if (o.x < 40) o.vx += 160 * dt;
      if (o.x > 560) o.vx -= 160 * dt;
      if (o.y > 550) o.vy -= 160 * dt;
    }
    const speed = Math.hypot(o.vx, o.vy),
      cap = 390;
    if (speed > cap) {
      o.vx *= cap / speed;
      o.vy *= cap / speed;
    }
    // Shoving big gunk too hard at close range splits it.
    if (lv.split && o.bad && !o.small && power && m.mode === -1 && d < 100 && speed > 320) {
      magnetSplit(o, born);
      continue;
    }
    o.vx *= Math.exp(-1.15 * dt);
    o.vy *= Math.exp(-1.15 * dt);
    o.x += o.vx * dt * rate;
    o.y += o.vy * dt * rate;
    if (o.entering) {
      if (o.x > 30 && o.x < 570 && o.y < 560) o.entering = false;
      continue;
    }
    if (barrier) {
      for (const w of MAGNET_WALLS) {
        magnetRepel(o, w[0], w[1], dt);
        if (magnetSegmentHit(o, w[0], w[1], 0.55, 45) && mini.magnetWallCool <= 0) {
          sfx('ricochet');
          mini.magnetWallCool = 0.25;
        }
      }
      magnetSegmentHit(
        o,
        [bx - MAGNET_BARRIER_HALF, MAGNET_BARRIER_Y],
        [bx + MAGNET_BARRIER_HALF, MAGNET_BARRIER_Y],
        0.5,
        20,
        bvx
      );
    }
    if (o.x < 30 || o.x > 570) {
      o.x = clamp(o.x, 30, 570);
      o.vx *= -0.7;
    }
    if (o.y > 564) {
      if (o.bad && o.touched && Math.abs(o.x - MAGNET_VENT_X) < MAGNET_VENT_HALF) {
        o.dead = true;
        mini.magnetGunkVented++;
        mini.magnetVentPulse = 0.5;
        praise(o.small ? 50 : 80, 1);
        arcadeBurst(o.x, o.y, '#d0e8ca', 8);
        magnetPop(o.x, 540, 'FLUSHED', '#d0e8ca');
        sfx('blob');
      } else {
        o.y = 564;
        o.vy *= -0.65;
        // The vent burps anything that is not gunk off to the side, so it can never clog.
        if (!o.bad && Math.abs(o.x - MAGNET_VENT_X) < MAGNET_VENT_HALF + 10) {
          o.vx += (o.x < MAGNET_VENT_X ? -1 : 1) * 170;
          o.vy -= 60;
        }
      }
    }
    if (o.y < MAGNET_PORT_Y && o.cool <= 0) {
      const port =
        Math.abs(o.x - MAGNET_PORT_X[0]) < gate ? 0 : Math.abs(o.x - MAGNET_PORT_X[1]) < gate ? 1 : -1;
      if (port >= 0 && o.touched) {
        if (o.bad) {
          o.dead = true;
          miniOops('GUNK IN THE COLLECTION PORT');
        } else if (o.kind === magnetPortKind(port)) magnetSorted(o, port);
        else magnetWrongPort(o);
      } else {
        o.y = MAGNET_PORT_Y;
        o.vy = Math.abs(o.vy) * 0.65;
        o.cool = 0.3;
      }
    }
  }
  mini.orbs.push(...born);
  magnetUpdateThieves(dt, power, radius, rate);
  // Soft collisions transfer momentum, so a push can move a whole cluster.
  for (let i = 0; i < mini.orbs.length; i++)
    for (let j = i + 1; j < mini.orbs.length; j++) {
      const a = mini.orbs[i],
        b = mini.orbs[j];
      if (a.dead || b.dead || a.held != null || b.held != null) continue;
      const d = dist(a, b),
        r = a.r + b.r;
      if (d > 0 && d < r) {
        const nx = (b.x - a.x) / d,
          ny = (b.y - a.y) / d,
          q = (r - d) / 2;
        a.x -= nx * q;
        a.y -= ny * q;
        b.x += nx * q;
        b.y += ny * q;
        const dot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (dot > 0) {
          a.vx -= dot * nx * 0.75;
          a.vy -= dot * ny * 0.75;
          b.vx += dot * nx * 0.75;
          b.vy += dot * ny * 0.75;
        }
      }
    }
  mini.orbs = mini.orbs.filter(o => !o.dead);
  // Level 1 eases in; later levels keep a fuller board. The mix shifts with each shift.
  const cap = lv.hints
    ? Math.min(lv.cap[mini.shift], lv.start + Math.floor(mini.phaseTime / 5))
    : lv.cap[mini.shift];
  while (mini.orbs.length < cap) {
    const gunk = mini.orbs.filter(o => o.bad).length,
      bad = gunk < (mini.tier === 2 ? 3 : 2) && rand(0, 1) < lv.mix[mini.shift][1];
    spawnOrb(bad);
  }
}

function magnetUpdateThieves(dt, power, radius, rate) {
  const m = mini.magnet,
    lv = magnetLevel(),
    pace = lv.thiefSpeed * mini.rules.speed * (mini.slow > 0 ? 0.5 : 1);
  for (const th of mini.magnetThieves) {
    th.t = Math.max(0, th.t - dt);
    th.bob += dt;
    const dx = m.x - th.x,
      dy = m.y - th.y,
      d = Math.hypot(dx, dy);
    if (power && d < radius && d > 6) {
      const f = ((1 - d / (radius + 10)) * 1150 * m.mode) / 1.5;
      th.vx += (dx / d) * f * dt;
      th.vy += (dy / d) * f * dt;
      th.zap += dt;
      if (th.zap >= 0.35) magnetStun(th);
    } else th.zap = Math.max(0, th.zap - dt * 0.5);
    let goal = null;
    if (th.state === 'seek') {
      let o = mini.orbs.find(o => o.id === th.target && !o.dead && o.held == null);
      if (!o) {
        const free = mini.orbs.filter(o => !o.bad && !o.dead && o.held == null && !o.entering && o.y > 150);
        o = free.sort((a, b) => dist(a, th) - dist(b, th))[0];
        th.target = o ? o.id : null;
      }
      goal = o || { x: 300, y: 430 };
      if (o && dist(th, o) < o.r + 20) {
        th.state = 'grab';
        th.t = 0.45;
        sfx('trap');
      }
    } else if (th.state === 'grab') {
      const o = mini.orbs.find(o => o.id === th.target && !o.dead && o.held == null);
      if (!o || dist(th, o) > o.r + 46) th.state = 'seek';
      else if (th.t <= 0) {
        th.state = 'drag';
        o.held = th.id;
        o.vx = 0;
        o.vy = 0;
      }
    } else if (th.state === 'drag') goal = { x: MAGNET_VENT_X, y: 600 };
    else if (th.state === 'stun' && th.t <= 0) th.state = 'seek';
    if (goal) {
      const gx = goal.x - th.x,
        gy = goal.y - th.y,
        gd = Math.hypot(gx, gy) || 1,
        s = th.state === 'drag' ? pace * 0.8 : pace,
        k = Math.min(1, 3 * dt);
      th.vx += ((gx / gd) * s - th.vx) * k;
      th.vy += ((gy / gd) * s - th.vy) * k;
    } else {
      const drag = Math.exp(-(th.state === 'stun' ? 1.3 : 6) * dt);
      th.vx *= drag;
      th.vy *= drag;
    }
    const speed = Math.hypot(th.vx, th.vy);
    if (speed > 420) {
      th.vx *= 420 / speed;
      th.vy *= 420 / speed;
    }
    th.x += th.vx * dt * rate;
    th.y += th.vy * dt * rate;
    if (Math.abs(th.vx) > 4) th.dir = th.vx > 0 ? 1 : -1;
    if (th.entering) {
      if (th.x > 26 && th.x < 574) th.entering = false;
    } else {
      th.x = clamp(th.x, 26, 574);
      th.y = clamp(th.y, 130, 574);
    }
    const carried = th.state === 'drag' ? mini.orbs.find(o => o.held === th.id) : null;
    if (carried) {
      carried.x = th.x + th.dir * 15;
      carried.y = th.y - 20;
    }
    if (th.y > 548 && Math.abs(th.x - MAGNET_VENT_X) < MAGNET_VENT_HALF + 4) {
      if (th.state === 'stun') {
        th.dead = true;
        mini.magnetFlushed++;
        mini.magnetVentPulse = 0.6;
        praise(300, 1);
        arcadeBurst(th.x, th.y, '#efbe77', 14);
        magnetPop(th.x, 530, 'GREMLIN FLUSHED +300', '#ffe5a8');
        sfx('enemyDie');
      } else if (carried) {
        th.dead = true;
        carried.dead = true;
        mini.magnetStolen++;
        mini.magnetVentPulse = 0.6;
        mini.magnetChain = 0;
        mini.magnetChainT = 0;
        miniOops('A GREMLIN YOINKED A NUTRIENT DOWN THE VENT');
      }
    }
  }
  mini.magnetThieves = mini.magnetThieves.filter(th => !th.dead);
  mini.orbs = mini.orbs.filter(o => !o.dead);
}

// ---- Art ----

function magnetHint() {
  const m = mini.magnet;
  if (mini.magnetHot) return 'OVERHEATED · LET GO TO COOL';
  if (magnetLevel().hints) {
    if (!mini.magnetEverOn) return 'PRESS AND HOLD NEAR AN ORB';
    if (!mini.got) return 'DRAG IT UP · MINT LEFT, GOLD RIGHT';
    if (mini.orbs.some(o => o.bad) && !mini.magnetGunkVented) return 'PINK GUNK GOES DOWN THE VENT';
    if (mini.got < 4) return 'LET GO TO COAST · SPACE FLIPS PUSH / PULL';
  }
  if (mini.magnetThieves.some(t => t.state === 'drag')) return 'THIEF! HOLD THE FIELD ON IT';
  if (!m.on) return 'DRAG & HOLD TO APPLY FORCE';
  return (m.mode === 1 ? 'PULLING' : 'PUSHING') + (mini.magnetSurge > 0 ? ' · SURGE' : ' · RELEASE TO COAST');
}

function magnetDrawField(g) {
  const m = mini.magnet,
    power = magnetPower(),
    reach = magnetRadius() * 0.6;
  for (let i = 0; i < 8; i++) {
    const y0 = 140 + i * 56,
      pts = [];
    for (let x = 20; x <= 580; x += 28) {
      let px = x,
        py = y0 + (mini.shift ? Math.sin(mini.total * 0.7 + y0 * 0.012 + x * 0.01) * 5 : 0);
      if (power) {
        const dx = m.x - px,
          dy = m.y - py,
          w = Math.exp(-(dx * dx + dy * dy) / (2 * reach * reach)) * 0.45 * m.mode;
        px += dx * w;
        py += dy * w;
      }
      pts.push([px, py]);
    }
    line(g, pts, power ? (m.mode === 1 ? '#a7e5dd2a' : '#f4b1c02a') : '#b8d9c90f', 1.5);
  }
}

function magnetDrawPorts(g) {
  const gate = magnetLevel().gate,
    warn = mini.magnetSwapWarned && mini.phaseTime < mini.magnetSwapAt;
  for (let i = 0; i < 2; i++) {
    const x = MAGNET_PORT_X[i],
      kind = magnetPortKind(i),
      col = kind ? '#f1cf85' : '#b2e5c2',
      pulse = mini.magnetPulse[i],
      blink = warn && Math.sin(mini.total * 18) > 0;
    rr(g, x - gate, 48, gate * 2, 62, 17, gradient(g, x, 48, 0, 62, '#163846', '#102934'), blink ? '#ff9db5' : col, 2);
    glow(g, x, 76, 65 + pulse * 60, col + (pulse > 0 ? '55' : '25'));
    // Intake chevrons crawl upward into the port.
    for (let k = 0; k < 3; k++) {
      const yy = 134 - ((mini.total * 26 + k * 9) % 27);
      line(g, [[x - 9, yy + 5], [x, yy], [x + 9, yy + 5]], col + '66', 2);
    }
    if (pulse > 0) {
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.globalAlpha = pulse / 0.6;
      g.beginPath();
      g.arc(x, 76, 30 + (0.6 - pulse) * 90, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    if (kind) poly(g, [[x, 56], [x + 12, 72], [x, 88], [x - 12, 72]], col);
    else ellipse(g, x, 72, 12, 12, col);
    label(g, kind ? 'GOLD DIAMONDS' : 'MINT CIRCLES', x, 101, 10, col, 'center');
  }
  if (warn) {
    const left = Math.max(0, mini.magnetSwapAt - mini.phaseTime);
    rr(g, 236, 58, 128, 38, 12, '#3b1d38dd', '#ff9db5', 2);
    label(g, 'SWAP IN ' + left.toFixed(1), 300, 82, 13, '#ffd2dc', 'center');
    line(g, [[215, 70], [385, 70]], '#ff9db566', 2);
    poly(g, [[385, 64], [395, 70], [385, 76]], '#ff9db5aa');
    poly(g, [[215, 64], [205, 70], [215, 76]], '#ff9db5aa');
  }
}

function magnetDrawVent(g) {
  const p = mini.magnetVentPulse;
  rr(g, 235, 555, 130, 43, 12, '#153c40', p > 0 ? '#ffe5a8' : '#c6d4b0', 2);
  for (let i = 0; i < 5; i++) line(g, [[250 + i * 25, 562], [250 + i * 25, 576]], '#0c2328', 4);
  // Suction ripples.
  for (let k = 0; k < 2; k++) {
    const a = (mini.total * 0.8 + k * 0.5) % 1;
    g.strokeStyle = '#c6d4b0' + (a < 0.5 ? '33' : '18');
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(300, 560, 70 * (1 - a), 18 * (1 - a), 0, Math.PI, Math.PI * 2);
    g.stroke();
  }
  if (p > 0) glow(g, 300, 570, 90, '#ffe5a844');
  label(g, 'GUNK DISPOSAL ↓', 300, 590, 10, '#d7e4ba', 'center');
}

function magnetDrawWalls(g) {
  if (!magnetBarrierOn()) return;
  const pulse = 0.5 + Math.sin(mini.total * 5) * 0.5;
  for (const w of MAGNET_WALLS) {
    line(g, w, '#f4b1c033', 26);
    line(g, w, '#f4b1c0', 10);
    line(g, w, '#fff0f4', 3);
    const mx = (w[0][0] + w[1][0]) / 2,
      my = (w[0][1] + w[1][1]) / 2;
    glow(g, mx, my, 50 + pulse * 10, '#f4b1c022');
  }
  const bx = magnetBarrierX(),
    y = MAGNET_BARRIER_Y;
  line(g, [[bx - MAGNET_BARRIER_HALF, y], [bx + MAGNET_BARRIER_HALF, y]], '#9fc8e844', 24);
  rr(g, bx - MAGNET_BARRIER_HALF - 6, y - 7, MAGNET_BARRIER_HALF * 2 + 12, 14, 7, '#26506b', '#bfe3f2', 2);
  for (let i = -2; i <= 2; i++) rect(g, bx + i * 22 - 5, y - 3, 10, 6, (i + Math.floor(mini.total * 4)) % 2 ? '#f1cf85' : '#1c3446');
}

function magnetDrawPickups(g) {
  for (const p of mini.magnetPickups) {
    const fade = Math.min(1, p.life / 1.5),
      bob = Math.sin(mini.total * 4 + p.x) * 4;
    g.globalAlpha = fade;
    glow(g, p.x, p.y + bob, 40, '#fff2a855');
    rr(g, p.x - 16, p.y - 20 + bob, 32, 40, 10, '#2f4f6a', '#fff2a8', 2);
    poly(g, [[p.x + 3, p.y - 15 + bob], [p.x - 8, p.y + 2 + bob], [p.x - 1, p.y + 2 + bob], [p.x - 4, p.y + 15 + bob], [p.x + 8, p.y - 3 + bob], [p.x + 1, p.y - 3 + bob]], '#fff2a8');
    label(g, 'SURGE', p.x, p.y + 34 + bob, 9, '#fff2a8', 'center');
    g.globalAlpha = 1;
  }
}

function magnetDrawOrb(g, o) {
  const color = o.bad ? '#ed8daf' : o.kind ? '#f2cc7d' : '#a8dfc1';
  for (let i = 0; i < o.trail.length; i++) {
    const p = o.trail[i];
    g.globalAlpha = ((i + 1) / o.trail.length) * 0.22;
    ellipse(g, p.x, p.y, o.r * (0.45 + i * 0.08), o.r * (0.45 + i * 0.08), color);
  }
  g.globalAlpha = 1;
  shadow(g, o.x, o.y + 8, o.r, 6);
  glow(g, o.x, o.y, o.r * 1.8, color + '18');
  ellipse(
    g,
    o.x,
    o.y,
    o.r,
    o.r,
    gradient(g, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2, color, o.bad ? '#b75182' : o.kind ? '#bd8e55' : '#519e96')
  );
  ellipse(g, o.x - o.r * 0.3, o.y - o.r * 0.37, o.r * 0.26, o.r * 0.16, '#fff7dc99');
  if (o.bad) label(g, '×', o.x, o.y + o.r * 0.4, o.r * 1.35, '#5d294c', 'center');
  else if (o.kind) poly(g, [[o.x, o.y - 9], [o.x + 7, o.y], [o.x, o.y + 9], [o.x - 7, o.y]], '#fff0bd');
  else ellipse(g, o.x, o.y, 6, 6, '#eaffd9');
}

function magnetDrawThief(g, th) {
  const stun = th.state === 'stun',
    grab = th.state === 'grab',
    target = grab ? mini.orbs.find(o => o.id === th.target) : null;
  g.save();
  if (stun) {
    g.translate(th.x, th.y);
    g.rotate(Math.sin(th.bob * 9) * 0.25);
    g.translate(-th.x, -th.y);
  }
  gremlin(g, th.x, th.y + 16, 0.66, 2, th.bob);
  g.restore();
  if (target) {
    // Grabby arms stretch toward the orb as the grab winds up.
    const k = 1 - th.t / 0.45;
    for (const side of [-1, 1]) {
      const sx = th.x + side * 8,
        sy = th.y - 6,
        ex = sx + (target.x - sx) * k,
        ey = sy + (target.y + side * 6 - sy) * k;
      line(g, [[sx, sy], [ex, ey]], '#ba7b70', 4);
      ellipse(g, ex, ey, 4, 4, '#efbe77');
    }
  }
  if (th.state === 'drag') {
    line(g, [[th.x - 8, th.y - 8], [th.x + th.dir * 10, th.y - 18]], '#ba7b70', 4);
    line(g, [[th.x + 8, th.y - 8], [th.x + th.dir * 20, th.y - 18]], '#ba7b70', 4);
    label(g, 'MINE', th.x, th.y - 44, 10, '#ffd2dc', 'center');
  }
  if (stun)
    for (let i = 0; i < 3; i++) {
      const a = th.bob * 5 + i * 2.1;
      spark(g, th.x + Math.cos(a) * 15, th.y - 34 + Math.sin(a) * 5, '#fff0ab', 0.45);
    }
  if (th.zap > 0 && !stun) {
    g.strokeStyle = '#a7e5ddaa';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(th.x, th.y - 10, 26, -Math.PI / 2, -Math.PI / 2 + (th.zap / 0.35) * Math.PI * 2);
    g.stroke();
  }
}

function magnetDrawMagnet(g) {
  const m = mini.magnet,
    power = magnetPower(),
    heat = mini.magnetHeat,
    hot = mini.magnetHot,
    radius = magnetRadius();
  if (power) {
    for (let r = 1; r <= 3; r++) {
      let a = (r / 3 + (m.mode === 1 ? -1 : 1) * mini.total * 0.35) % 1;
      if (a < 0) a++;
      g.strokeStyle = m.mode === 1 ? '#a7e5dd38' : '#f4b1c038';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(m.x, m.y, a * radius, 0, Math.PI * 2);
      g.stroke();
    }
    if (mini.magnetSurge > 0) {
      g.setLineDash([6, 8]);
      g.strokeStyle = '#fff2a866';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(m.x, m.y, radius, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
  }
  if (heat > 0.35) glow(g, m.x, m.y, 30 + heat * 32, hot ? '#ff6b4a66' : '#ff9a5c' + (heat > 0.7 ? '44' : '22'));
  if (hot)
    for (let i = 0; i < 3; i++) {
      const a = (mini.total * 0.9 + i / 3) % 1;
      g.globalAlpha = 1 - a;
      ellipse(g, m.x - 10 + i * 10, m.y - 26 - a * 34, 6 + a * 8, 6 + a * 8, '#c9c3c4');
    }
  g.globalAlpha = 1;
  const body = hot ? '#ff8a6a' : heat > 0.7 ? '#f6c7a4' : m.mode === 1 ? '#c6f5df' : '#f6bccb';
  g.save();
  g.translate(m.x, m.y);
  g.strokeStyle = body;
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, 0, 21, 0, Math.PI);
  g.lineTo(-21, -12);
  g.stroke();
  line(g, [[21, 0], [21, -12]], m.mode === 1 ? '#f3a4a0' : '#b8e6d6', 10);
  line(g, [[-21, 0], [-21, -12]], hot ? '#ff8a6a' : m.mode === 1 ? '#b8e6d6' : '#f3a4a0', 10);
  g.restore();
  // Heat gauge wraps the magnet once overheat is in play.
  if (magnetLevel().heat) {
    g.strokeStyle = '#0f283766';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(m.x, m.y, 33, Math.PI * 0.75, Math.PI * 2.25);
    g.stroke();
    g.strokeStyle = hot ? '#ff6b4a' : heat > 0.7 ? '#ffb36b' : '#a7e5dd';
    g.beginPath();
    g.arc(m.x, m.y, 33, Math.PI * 0.75, Math.PI * 0.75 + heat * Math.PI * 1.5);
    g.stroke();
    if (hot) label(g, 'HOT', m.x, m.y + 48, 11, '#ffb39c', 'center');
  }
}

function magnetDrawGuide(g) {
  if (!magnetLevel().hints || !mini.magnet.on) return;
  const o = mini.orbs.find(o => o.id === mini.magnetLastTouched);
  if (!o) return;
  const tx = o.bad ? MAGNET_VENT_X : MAGNET_PORT_X[o.kind],
    ty = o.bad ? 566 : 104;
  g.setLineDash([5, 9]);
  line(g, [[o.x, o.y], [tx, ty]], o.bad ? '#ed8daf88' : o.kind ? '#f2cc7d88' : '#a8dfc188', 2);
  g.setLineDash([]);
}

function magnetDraw(g) {
  magnetDrawField(g);
  for (let i = 0; i < 7 && mini.shift; i++) {
    const y = 145 + i * 57,
      x = 300 + Math.sin(mini.total * 0.7 + y * 0.012) * 80;
    line(g, [[x - 28, y], [x + 28, y]], '#b8d9c92d', 2);
    poly(g, [[x + 22, y - 5], [x + 30, y], [x + 22, y + 5]], '#b8d9c944');
  }
  magnetDrawPorts(g);
  magnetDrawVent(g);
  magnetDrawWalls(g);
  magnetDrawPickups(g);
  magnetDrawGuide(g);
  for (const o of mini.orbs) magnetDrawOrb(g, o);
  for (const th of mini.magnetThieves) magnetDrawThief(g, th);
  magnetDrawMagnet(g);
  for (const p of mini.magnetPops) {
    g.globalAlpha = Math.min(1, p.life * 2);
    label(g, p.text, p.x, p.y, 16, p.col, 'center');
  }
  g.globalAlpha = 1;
  if (mini.magnetChain > 1 && mini.magnetChainT > 0) {
    rr(g, 486, 128, 92, 30, 10, '#102b40cc', '#ffe5a866', 1);
    label(g, 'CHAIN ×' + Math.min(5, mini.magnetChain), 532, 148, 13, '#ffe5a8', 'center');
    rect(g, 494, 152, 76 * (mini.magnetChainT / MAGNET_CHAIN_WINDOW), 3, '#ffe5a8');
  }
  rr(g, 158, 512, 284, 28, 14, '#102b40bb');
  label(g, magnetHint(), 300, 531, 12, mini.magnetHot ? '#ffb39c' : '#d5e7d4', 'center');
}
