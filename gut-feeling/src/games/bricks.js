// Brick Rebellion (family lounge). A paddle breakout: slide a hospital lunch tray, keep the softball in
// the air and break three racks of rebel bricks. Falling pills change the tray and the ball, pink bricks
// chain-react, and the pillow cannon snipes stragglers. Level 2 adds steel, hopping gremlins and nurse
// calls that drop the rack; level 3 is faster, adds goo pills and ends at Ralph's fortress.
// Canvas 600 × 600, or 480 × 760 on an upright phone. Every rule runs in field coordinates (480 × 600);
// bricksFrame() places the field on whichever canvas is active, and the physics substeps at 240 Hz.
const BRICKS_FW = 480,
  BRICKS_FH = 600,
  BRICKS_WALL = 12,
  BRICKS_CEIL = 46,
  BRICKS_COLS = 8,
  BRICKS_PITCH = 57,
  BRICKS_BW = 53,
  BRICKS_ROWH = 27,
  BRICKS_BH = 23,
  BRICKS_TOP = 108,
  BRICKS_LINE = 446,
  BRICKS_TRAY_Y = 530,
  BRICKS_TRAY_H = 14,
  BRICKS_NET_Y = 584,
  BRICKS_R = 8,
  BRICKS_STEP = 1 / 240,
  BRICKS_PORTRAIT_TOP = 64,
  BRICKS_MAX_ANGLE = (60 * Math.PI) / 180,
  BRICKS_MIN_ANGLE = (12 * Math.PI) / 180,
  BRICKS_MIN_VY = 0.34,
  BRICKS_COMBO_GAP = 2.5,
  BRICKS_FINGER_SPEED = 2600,
  BRICKS_KEY_SPEED = 640,
  BRICKS_MAX_BALLS = 6;

// Rack legend: digits are plain bricks with that many hits, b blast, s star (always drops a pill),
// r rubber, a armor (three plates), g gremlin (hops sideways), n nurse call, w fortress weak point,
// F the fortress's top-left cell (f marks the rest of its 4 × 2 block), ? a roll on the level's mix.
const BRICKS_KEY = {
  1: ['plain', 1],
  2: ['plain', 2],
  3: ['plain', 3],
  b: ['blast', 1],
  s: ['star', 1],
  r: ['rubber', 2],
  a: ['armor', 3],
  g: ['gremlin', 1],
  n: ['nurse', 1],
  w: ['weak', 2]
};

// speed/cap: ball px/s before the difficulty pace; ramp: px/s added per tray hit. tray: width. serve:
// seconds before a held serve goes by itself. creep: seconds between the rack's one-row steps down (0:
// never). nurse: seconds a nurse call waits before it rings. hop: seconds between gremlin hops. spice:
// chance a plain one-hit brick turns pink or gold. limit: the clock, a ceiling the racks should beat.
// balls: softballs per prescription (Pillow Fort, Questionable Decisions, Absolute Gutastrophe). top:
// where a new rack’s first row sits; lower racks leave less time to read a ricochet. par: seconds for a
// strong clear, which the medal measures against.
const BRICKS_LEVELS = [
  {
    limit: 240,
    balls: [7, 6, 5],
    par: 60,
    top: 108,
    speed: 420,
    cap: 540,
    ramp: 4,
    tray: 120,
    serve: 2.2,
    creep: 0,
    pillChance: 0.12,
    pills: { wide: 3, multi: 3, catch: 2, pillow: 2, nap: 2 },
    pillows: 2,
    nurse: 0,
    hop: 0,
    spice: 0.06,
    mix: {},
    racks: [
      { name: 'WARM-UP', rows: ['11b11b11', '1s1111s1', '.111111.'] },
      { name: 'PILL BOTTLE', rows: ['..1111..', '.1bssb1.', '1b1111b1', '.1r11r1.'] },
      { name: 'HEART MONITOR', rows: ['.11..11.', '1b1ss1b1', '11b11b11', '..1111..', '...rr...'] }
    ]
  },
  {
    limit: 240,
    balls: [6, 4, 4],
    par: 100,
    top: 140,
    speed: 560,
    cap: 740,
    ramp: 5,
    tray: 92,
    serve: 1.8,
    creep: 8,
    pillChance: 0.11,
    pills: { wide: 3, multi: 3, catch: 2, pillow: 2, nap: 1, goo: 1 },
    pillows: 2,
    nurse: 11,
    hop: 2.6,
    spice: 0.05,
    mix: { 1: 3, 2: 2, b: 1, a: 1, g: 1 },
    racks: [
      { name: 'SHIFT CHANGE', rows: ['a22bb22a', '2b1ss1b2', '12111121', '.g.11.g.'] },
      { name: 'GREMLIN CONGA', rows: ['22222222', 'g..1g..1', 'a2bs2b2a', '1..g1..g', '12b11b21'] },
      { name: 'NURSE STATION', rows: ['.a2222a.', 'a2n22n2a', '1b2ss2b1', '22b22b22'] }
    ]
  },
  {
    limit: 270,
    balls: [5, 4, 4],
    par: 95,
    top: 146,
    speed: 620,
    cap: 820,
    ramp: 6,
    tray: 82,
    serve: 1.6,
    creep: 8,
    pillChance: 0.11,
    pills: { wide: 3, multi: 3, catch: 2, pillow: 2, nap: 1, goo: 2 },
    pillows: 3,
    nurse: 9,
    hop: 2.1,
    spice: 0.04,
    mix: { 1: 2, 2: 3, 3: 1, b: 1, a: 2, g: 1 },
    racks: [
      { name: 'NIGHT SHIFT', rows: ['2a2bb2a2', '1bs1n1b1', '22122122', '.g.??.g.'] },
      { name: 'CHECKUP', rows: ['a2a22a2a', '2b2ss2b2', 'g..n....', '1a1??1a1', '.21bb12.'] },
      { name: 'RALPH’S FORTRESS', rows: ['1.Ffff.1', '.wffffw.', '1b1ss1b1', 'a21bb12a'] }
    ]
  }
];

// Tips for the second and third racks of each level, shown as the rack changes.
const BRICKS_TIPS = [
  ['', 'RACK 2 · land the ball on a tray edge to reach the corners.', 'FINAL RACK · flatline the heart monitor.'],
  ['', 'RACK 2 · gremlin bricks hop. Aim where they are going.', 'FINAL RACK · nurse calls. Break the bells before they ring.'],
  ['', 'RACK 2 · steel everywhere. Pillows crack it from below.', 'FINAL RACK · Ralph’s fortress. Pink weak points first.']
];

const BRICKS_PILLS = {
  wide: { text: 'WIDE', a: '#bdf0d8', b: '#4fae8c', ink: '#123b33', flash: 'WIDE TRAY · MORE TRAY, FEWER EXCUSES' },
  multi: { text: 'MULTI', a: '#ffe6a6', b: '#d9a441', ink: '#4a3410', flash: 'MULTIBALL · THREE SOFTBALLS FOR EVERY ONE' },
  catch: { text: 'CATCH', a: '#bfe3ff', b: '#4f8fc6', ink: '#14324d', flash: 'STICKY TRAY · TAP TO LET GO' },
  pillow: { text: 'PILLOW', a: '#efd9ff', b: '#9a74c9', ink: '#33204d', flash: 'PILLOWS +4 · PILLOW BUTTON OR UP ARROW' },
  nap: { text: 'NAP', a: '#f4f0e2', b: '#a9a28a', ink: '#3b3828', flash: 'NAP TIME · THE SOFTBALL SLOWS DOWN' },
  goo: { text: 'GOO', a: '#c7f28a', b: '#5d9a2c', ink: '#1f3a0c', flash: 'GREMLIN GOO · TINY TRAY FOR A BIT' }
};

const BRICKS = registerGame({
  id: 2,
  canvas: { w: 600, h: 600 },
  portraitCanvas: { w: 480, h: 760 },
  layout: 'gesture',
  info: {
    game: 'Brick Rebellion',
    genre: 'PADDLE · BOUNCE · BREAK',
    headline: 'The bricks unionized. You have a lunch tray.',
    desc:
      'Slide a hospital lunch tray, keep the softball bouncing and break the brick rebellion one rack at a time. Pink bricks blow up their neighbors, gold stars drop pills, and the pills do strange things to your tray.',
    goal: 'Clear all three racks before the lounge closes.',
    control:
      'Slide a finger anywhere on the game and the tray follows it sideways. Tap to serve. Where the ball lands on the tray sets its angle: the middle sends it up, the edges send it wide. PILLOW fires a pillow straight up. Mouse: the tray follows the pointer, click serves. Keys: arrows or A and D slide, Space serves, Up fires a pillow.',
    avoid:
      'Don’t let the softball fall past the tray. Catch the falling pills: WIDE tray, MULTI ball, CATCH (a sticky tray, tap to let go), PILLOW ammo and NAP (a slower ball).',
    cue: 'Slide to move · tap to serve · tray edges angle the ball · catch the pills'
  },
  tierNotes: [
    '3 racks · big tray · slow ball · pills and pink chain reactions',
    '3 racks · steel, hopping gremlins, nurse calls · faster ball',
    '3 racks · fastest ball · goo pills · Ralph’s fortress'
  ],
  shiftName: 'RACK',
  init() {
    bricksInit();
  },
  controls() {
    const B = mini.br;
    mini.bricksButtonKey = bricksButtonKey();
    setControls([
      { id: 'serve', text: 'SERVE', key: 'Space', hot: bricksHolding() },
      { id: 'pillow', text: 'PILLOW · ' + B.pillows, key: '↑', hot: B.pillows > 0 && !bricksHolding() }
    ]);
  },
  update(dt) {
    updateArcade(dt, bricksStep);
  },
  draw(g) {
    bricksDraw(g);
  },
  // Every press moves the tray to the finger and lets go of a held ball; a drag keeps the tray under it.
  down(p) {
    const B = mini.br;
    B.keyMode = false;
    bricksAimTray(p);
    if (bricksHolding()) {
      B.tray.x = bricksTrayClamp(B.tray.target);
      bricksRideTray();
    }
    bricksRelease();
  },
  move(p) {
    mini.br.keyMode = false;
    bricksAimTray(p);
  },
  up() {},
  action(a) {
    if (a === 'serve') bricksRelease();
    if (a === 'pillow') bricksFirePillow();
  },
  // A row of pillows along the floor: for ten seconds a falling softball bounces instead of dropping.
  assist() {
    mini.br.net = 10;
    sfx('shield');
    mini.flash = 1.1;
    mini.flashText = 'SAFETY NET · NO DROPS FOR 10 SECONDS';
  },
  key(k, e) {
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
      keys.add(k);
      mini.br.keyMode = true;
      return true;
    }
    if (k === ' ') {
      if (!e.repeat) bricksRelease();
      return true;
    }
    if (k === 'arrowup' || k === 'w') {
      if (!e.repeat) bricksFirePillow();
      return true;
    }
    return false;
  },
  shiftLevel: () => mini.br.rack,
  shiftMessage(shift) {
    return BRICKS_TIPS[mini.tier][shift] || undefined;
  },
  // Running out of time never wins: the racks are the goal.
  timeUp() {
    finishMini(
      false,
      'The lounge closed for the night. Pink chain reactions and MULTI pills clear racks fastest, and pillows finish off stragglers.'
    );
  },
  lesson() {
    const i = BRICKS.info,
      extra = [
        ' Level 1: a big tray, a slow ball, no surprises. Pink bricks explode. Gold stars always drop a pill.',
        ' New: steel bricks take three hits. Green gremlin bricks hop sideways. Nurse call bricks ring when their timer runs out and drop the whole rack a row, so break them first. A rack that crosses the red line costs a softball.',
        ' New: a faster ball, a smaller tray, and green GOO pills that shrink it. The last rack is Ralph’s fortress: break both pink weak points to drop its shield, dodge his goo, then knock it down.'
      ][mini.tier];
    return {
      title: i.game + ' · Level ' + (mini.tier + 1),
      goal: i.goal + ' You have ' + mini.rules.misses + ' softballs.',
      control: i.control,
      avoid: i.avoid + extra,
      demo: 'catch',
      cue: i.cue
    };
  },
  statLabel: () => 'RACK · BRICKS LEFT',
  stat: () => 'RACK ' + (mini.br.rack + 1) + '/' + mini.br.racks + ' · ' + bricksLeft() + ' LEFT',
  livesLabel: () => 'SOFTBALLS',
  lives: () => '● '.repeat(Math.max(0, mini.rules.misses - mini.miss)).trim() || 'none',
  tactics() {
    const B = mini.br,
      on = [];
    if (B.wide > 0) on.push('WIDE');
    if (B.catch > 0) on.push('CATCH');
    if (B.nap > 0) on.push('NAP');
    if (B.gooT > 0) on.push('GOOED');
    if (B.net > 0) on.push('NET');
    return (
      'SCORE ' + mini.score + ' · ×' + bricksMult().toFixed(1) + ' · BEST CHAIN ' + mini.maxCombo + ' · ' + B.pillows + ' PILLOWS' +
      (on.length ? ' · ' + on.join(' ') : '')
    );
  },
  assistText: () => 'SAFETY NET · ' + mini.helps + ' (E)',
  // Beating the level's par time is worth the most (the clock is far more generous); chains and a clean
  // tray add to it; drops, red-line crossings and assists cost it.
  quality() {
    const B = mini.br,
      speed = clamp(1.6 - mini.phaseTime / bricksLevel().par, 0, 1);
    return Math.round(
      clamp(
        50 +
          speed * 26 +
          Math.min(12, mini.maxCombo * 0.4) +
          Math.min(8, B.bestReaction * 1.5) -
          B.drops * 6 -
          B.lineHits * 3 -
          mini.helpUsed * 4,
        0,
        100
      )
    );
  },
  onWin() {
    const B = mini.br;
    if (B.fortressDown) return 'Ralph’s fortress is rubble. He is drafting a strongly worded memo to the lounge.';
    if (!B.drops) return 'Three racks, zero dropped softballs. The bricks are requesting a transfer.';
    return B.broken + ' bricks broken, best chain ' + mini.maxCombo + '. The bricks have filed a grievance.';
  },
  onLose(reason) {
    if (reason && reason.includes('lounge')) return { heading: 'THE LOUNGE CLOSED.' };
    return {
      heading: 'OUT OF SOFTBALLS.',
      text: 'Keep the tray under the ball, and catch it near an edge to send it wide. Pills help. Green goo does not.'
    };
  },
  // Win: rubble and a victorious tray. Loss: the bricks stacked up smugly with a gremlin on top.
  resultArt(g) {
    if (mini.win) {
      for (let i = 0; i < 14; i++) {
        const x = 150 + ((i * 97) % 520),
          y = 196 - (i % 3) * 7,
          col = ['#a4d5bf', '#e79bb8', '#e9cc86', '#8fd6e0', '#a8aecf'][i % 5];
        g.save();
        g.translate(x, y);
        g.rotate(((i % 5) - 2) * 0.25);
        rr(g, -11, -5, 22, 10, 3, col, '#16303d55', 1);
        g.restore();
      }
      bricksTrayArt(g, 400, 150, 150, {});
      softball(g, 400, 128, 13);
      for (let i = 0; i < 3; i++) spark(g, 330 + i * 70, 70 - (i % 2) * 18, '#fff0ab', 1.1);
      label(g, 'RACKS CLEARED · THE REBELLION IS ON BREAK', 400, 28, 12, '#26494a', 'center');
      return true;
    }
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6 - r; c++) {
        const col = ['#a4d5bf', '#a8aecf', '#e79bb8', '#c3c9d6'][(r + c) % 4];
        rr(g, 520 + c * 34 + r * 17, 188 - r * 18, 32, 16, 5, col, '#16303d55', 1);
      }
    gremlin(g, 640, 116, 1.1, 1, time);
    softball(g, 230 + Math.sin(time * 2) * 6, 196, 11);
    label(g, 'THE BRICKS ARE UNIONIZING', 400, 29, 12, '#dfe2b9', 'center');
    return true;
  },
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 0, 240, '#5a4a78', '#173349'));
    rr(g, 60, 34, 300, 206, 14, '#16293f', '#b7cbd533', 1.5);
    const cols = ['#a4d5bf', '#a8aecf', '#e79bb8', '#e9cc86', '#8fd6e0'];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++) {
        if ((r === 2 && c === 3) || (r === 3 && (c < 1 || c > 6))) continue;
        const k = (r * 3 + c * 7) % 11 === 0 ? 2 : (r + c) % 9 === 0 ? 3 : r % 2;
        rr(g, 70 + c * 35.5, 52 + r * 17, 32, 14, 4, cols[k]);
        ellipse(g, 78 + c * 35.5, 55 + r * 17, 4, 1.6, '#ffffff55');
      }
    glow(g, 192, 95, 40, '#f3a4c655');
    bricksPillArt(g, 268, 150, 'multi', 0.8);
    for (let i = 0; i < 6; i++) ellipse(g, 182 + i * 6, 186 - i * 13, 3 - i * 0.3, 3 - i * 0.3, '#f6dfaf66');
    softball(g, 218, 120, 7);
    bricksTrayArt(g, 182, 206, 70, {});
    label(g, BRICKS.info.game.toUpperCase(), 210, 22, 13, '#e5efd3', 'center');
    g.restore();
  }
});

// ---- Setup ----
function bricksLevel() {
  return BRICKS_LEVELS[mini.tier] || BRICKS_LEVELS[0];
}

function bricksPace() {
  return (mini.rules && mini.rules.mini) || 1;
}

function bricksColX(col) {
  return BRICKS_WALL + col * BRICKS_PITCH + (BRICKS_PITCH - BRICKS_BW) / 2;
}

function bricksRowY(row) {
  return (bricksLevel().top || BRICKS_TOP) + row * BRICKS_ROWH;
}

function bricksInit() {
  const lv = bricksLevel();
  initArcadeRun(lv.limit);
  mini.rules.misses = lv.balls[state.difficulty] || mini.rules.misses;
  mini.goal = lv.racks.reduce((n, r) => n + r.rows.join('').replace(/[.f]/g, '').length, 0);
  mini.br = {
    rack: 0,
    racks: lv.racks.length,
    bricks: [],
    balls: [],
    pills: [],
    shots: [],
    goo: [],
    fuses: [],
    sparks: [],
    pops: [],
    serial: 0,
    tray: { x: BRICKS_FW / 2, target: BRICKS_FW / 2, w: lv.tray, vx: 0, squash: 0 },
    keyMode: false,
    speed: lv.speed * bricksPace(),
    wide: 0,
    catch: 0,
    nap: 0,
    gooT: 0,
    net: 0,
    pillows: lv.pillows,
    pillowCool: 0,
    between: 0,
    banner: null,
    shake: 0,
    comboT: 0,
    sinceBreak: 0,
    reaction: 0,
    bestReaction: 0,
    broken: 0,
    drops: 0,
    rings: 0,
    lineHits: 0,
    pillsCaught: 0,
    trayHits: 0,
    dry: 0,
    fortress: null,
    fortressDown: false,
    ralphT: 3,
    creepT: lv.creep / bricksPace(),
    creeps: 0,
    trailT: 0,
    dirty: false
  };
  bricksBuildRack(0, false);
  bricksServe();
}

function bricksRollMix(mix) {
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  let roll = rand(0, total);
  for (const [ch, w] of Object.entries(mix)) {
    roll -= w;
    if (roll < 0) return ch;
  }
  return '1';
}

// Builds rack i from its pattern. Later racks drop in from above on springs.
function bricksBuildRack(i, slide = true) {
  const lv = bricksLevel(),
    B = mini.br;
  B.bricks = [];
  B.fortress = null;
  lv.racks[i].rows.forEach((row, r) => {
    for (let c = 0; c < BRICKS_COLS; c++) {
      let ch = row[c];
      if (ch === '.' || ch === 'f') continue;
      if (ch === 'F') {
        bricksAddFortress(c, r);
        continue;
      }
      if (ch === '?') ch = bricksRollMix(lv.mix);
      if (ch === '1' && rand(0, 1) < lv.spice) ch = rand(0, 1) < 0.5 ? 'b' : 's';
      const [kind, hp] = BRICKS_KEY[ch] || BRICKS_KEY[1];
      bricksAddBrick(kind, c, r, hp);
    }
  });
  for (const b of B.bricks) {
    if (b.kind === 'weak') b.boss = B.fortress;
    if (slide) b.oy = -330 - b.row * 22;
  }
}

function bricksAddBrick(kind, col, row, hp) {
  const B = mini.br,
    lv = bricksLevel(),
    pace = bricksPace(),
    b = {
      id: B.serial++,
      kind,
      col,
      row,
      span: 1,
      x: bricksColX(col),
      y: bricksRowY(row),
      w: BRICKS_BW,
      h: BRICKS_BH,
      hp,
      maxHp: hp,
      flash: 0,
      ox: 0,
      oy: 0,
      ovx: 0,
      ovy: 0,
      dir: 1,
      ring: 0,
      ringMax: 0,
      hopT: 0,
      boss: null
    };
  if (kind === 'nurse') b.ring = b.ringMax = (lv.nurse || 10) / pace;
  if (kind === 'gremlin') {
    b.dir = rand(0, 1) < 0.5 ? -1 : 1;
    b.hopT = ((lv.hop || 2.5) * rand(0.6, 1.1)) / pace;
  }
  B.bricks.push(b);
  return b;
}

// Ralph's fortress: a 4 × 2 block, shielded until both weak points beside it fall.
function bricksAddFortress(col, row) {
  const B = mini.br,
    b = bricksAddBrick('boss', col, row, 10 + 3 * state.difficulty);
  b.span = 4;
  b.w = BRICKS_PITCH * 3 + BRICKS_BW;
  b.h = BRICKS_ROWH + BRICKS_BH;
  B.fortress = b.id;
  B.ralphT = 3;
  return b;
}

function bricksFortress() {
  const B = mini.br;
  return B.fortress === null ? null : B.bricks.find(b => b.id === B.fortress && b.hp > 0) || null;
}

function bricksGuarded(boss) {
  return mini.br.bricks.some(b => b.kind === 'weak' && b.boss === boss.id && b.hp > 0);
}

function bricksLeft() {
  return mini.br.bricks.filter(b => b.hp > 0).length;
}

// ---- Tray, serve and controls ----
function bricksFrame() {
  const { w } = activeCanvas();
  return { x: (w - BRICKS_FW) / 2, y: mini.portrait ? BRICKS_PORTRAIT_TOP : 0 };
}

function bricksTrayWidth() {
  const B = mini.br;
  return bricksLevel().tray * (B.wide > 0 ? 1.5 : 1) * (B.gooT > 0 ? 0.62 : 1);
}

function bricksTrayClamp(x) {
  const half = mini.br.tray.w / 2;
  return clamp(x, BRICKS_WALL + half, BRICKS_FW - BRICKS_WALL - half);
}

function bricksAimTray(p) {
  mini.br.tray.target = p.x - bricksFrame().x;
}

function bricksHolding() {
  return !!mini.br && mini.br.balls.some(b => b.stuck !== null);
}

// Held balls sit on the tray where they were caught.
function bricksRideTray() {
  const t = mini.br.tray;
  for (const b of mini.br.balls)
    if (b.stuck !== null) {
      b.stuck = clamp(b.stuck, -t.w / 2 + 4, t.w / 2 - 4);
      b.x = t.x + b.stuck;
      b.y = BRICKS_TRAY_Y - BRICKS_R;
    }
}

// Rebuilds the buttons only when their labels change.
function bricksButtonKey() {
  return bricksHolding() + ':' + mini.br.pillows;
}

function bricksButtons() {
  if (mini.bricksButtonKey !== bricksButtonKey()) BRICKS.controls();
}

function bricksMakeBall(x, y, vx, vy, spd) {
  const B = mini.br;
  return { id: B.serial++, x, y, vx, vy, spd, fling: 0, stuck: null, stuckT: 0, serve: false, trail: [], dead: false };
}

function bricksServe() {
  const B = mini.br,
    ball = bricksMakeBall(B.tray.x, BRICKS_TRAY_Y - BRICKS_R, 0, 0, B.speed);
  ball.stuck = 0;
  ball.stuckT = bricksLevel().serve;
  ball.serve = true;
  B.balls = [ball];
  bricksButtons();
}

// Sends the ball off the tray: u is the contact point from -1 (left edge) to 1 (right edge). home (0-1)
// bends the bounce toward the nearest brick, after bounces that hit nothing and when two bricks are left.
function bricksAimFromTray(ball, u, home = 0) {
  u = clamp(u, -1, 1);
  let a = u * BRICKS_MAX_ANGLE;
  if (Math.abs(a) < BRICKS_MIN_ANGLE) {
    const side = a !== 0 ? Math.sign(a) : ball.vx !== 0 ? Math.sign(ball.vx) : rand(0, 1) < 0.5 ? -1 : 1;
    a = side * BRICKS_MIN_ANGLE;
  }
  const near = home > 0 ? bricksNearest(ball.x, ball.y) : null;
  if (near) {
    const want = clamp(Math.atan2(near.x + near.w / 2 - ball.x, ball.y - (near.y + near.h)), -BRICKS_MAX_ANGLE, BRICKS_MAX_ANGLE);
    a += (want - a) * home;
    // A bend that cancels the aim must not send the ball straight up past the brick: when the brick is
    // nearly overhead aim right at it, otherwise lean the minimum toward it.
    if (Math.abs(a) < BRICKS_MIN_ANGLE) a = Math.abs(want) < BRICKS_MIN_ANGLE ? want : Math.sign(want) * BRICKS_MIN_ANGLE;
  }
  ball.vx = Math.sin(a) * ball.spd;
  ball.vy = -Math.cos(a) * ball.spd;
}

function bricksNearest(x, y) {
  let best = null,
    bd = Infinity;
  for (const b of mini.br.bricks) {
    if (b.hp <= 0 || (b.kind === 'boss' && bricksGuarded(b))) continue;
    const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

function bricksLaunch(ball) {
  const t = mini.br.tray;
  let u = ball.stuck / (t.w / 2);
  // A serve leans the way the tray is moving, or a little to either side when it is still.
  if (ball.serve) {
    u = clamp(t.vx / 1400, -0.6, 0.6);
    if (Math.abs(u) < 0.15) u = (rand(0, 1) < 0.5 ? -1 : 1) * rand(0.15, 0.35);
  }
  ball.stuck = null;
  ball.serve = false;
  ball.vx = 0;
  bricksAimFromTray(ball, u);
}

// Lets go of every held ball. Returns true when there was one.
function bricksRelease() {
  const B = mini.br;
  if (!B || B.between > 0) return false;
  let any = false;
  for (const b of B.balls)
    if (b.stuck !== null) {
      bricksLaunch(b);
      any = true;
    }
  if (any) {
    sfx('throw');
    bricksButtons();
  }
  return any;
}

function bricksFirePillow() {
  const B = mini.br;
  if (!B || B.pillows <= 0 || B.between > 0 || B.pillowCool > 0) return false;
  B.pillows--;
  B.pillowCool = 0.16;
  B.shots.push({ x: B.tray.x, y: BRICKS_TRAY_Y - 10, vy: -700 });
  B.tray.squash = 0.1;
  sfx('throw');
  bricksButtons();
  return true;
}

// ---- Simulation ----
function bricksStep(dt) {
  let left = dt;
  while (left > 1e-9 && mini.screen === 'play') {
    const h = Math.min(BRICKS_STEP, left);
    left -= h;
    bricksPhysics(h);
  }
}

function bricksSteer(h) {
  const B = mini.br,
    t = B.tray,
    goLeft = keys.has('arrowleft') || keys.has('a'),
    goRight = keys.has('arrowright') || keys.has('d'),
    old = t.x,
    want = bricksTrayWidth();
  t.w += clamp(want - t.w, -320 * h, 320 * h);
  if (goLeft !== goRight) {
    t.x += (goRight ? 1 : -1) * BRICKS_KEY_SPEED * h;
    t.target = t.x;
  } else if (!B.keyMode) t.x += clamp(t.target - t.x, -BRICKS_FINGER_SPEED * h, BRICKS_FINGER_SPEED * h);
  t.x = bricksTrayClamp(t.x);
  t.vx += ((t.x - old) / h - t.vx) * Math.min(1, h * 12);
  t.squash = Math.max(0, t.squash - h);
  bricksRideTray();
}

function bricksPhysics(h) {
  const B = mini.br;
  bricksSteer(h);
  bricksTimers(h);
  if (mini.screen !== 'play') return;
  if (B.between > 0) {
    B.between -= h;
    if (B.between <= 0) {
      B.between = 0;
      bricksServe();
    }
    bricksAnimate(h);
    return;
  }
  for (const ball of B.balls) bricksMoveBall(ball, h);
  bricksMoveShots(h);
  bricksMovePills(h);
  if (B.dirty) {
    B.bricks = B.bricks.filter(b => b.hp > 0);
    B.dirty = false;
  }
  bricksAnimate(h);
  if (mini.screen !== 'play') return;
  // An empty rack wins the moment, even if the last ball is falling or a chain is still rippling.
  if (!B.bricks.length) {
    if (B.fuses.length) {
      B.fuses = [];
      bricksReactionDone();
    }
    bricksRackCleared();
    return;
  }
  B.balls = B.balls.filter(b => !b.dead);
  if (!B.balls.length) bricksDrop();
}

// Power-up clocks, combo cooling, chain fuses, nurse calls, gremlin hops, Ralph's goo and stragglers.
function bricksTimers(h) {
  const B = mini.br,
    lv = bricksLevel(),
    pace = bricksPace();
  B.wide = Math.max(0, B.wide - h);
  B.nap = Math.max(0, B.nap - h);
  B.gooT = Math.max(0, B.gooT - h);
  B.net = Math.max(0, B.net - h);
  B.pillowCool = Math.max(0, B.pillowCool - h);
  if (B.catch > 0) {
    B.catch = Math.max(0, B.catch - h);
    if (!B.catch) for (const b of B.balls) if (b.stuck !== null && !b.serve) b.stuckT = Math.min(b.stuckT, 0.2);
  }
  if (B.comboT > 0) {
    B.comboT -= h;
    if (B.comboT <= 0) mini.combo = 0;
  }
  if (B.between > 0) return;
  B.sinceBreak += h;
  for (const b of B.balls)
    if (b.stuck !== null) {
      b.stuckT -= h;
      if (b.stuckT <= 0) {
        bricksLaunch(b);
        sfx('throw');
        bricksButtons();
      }
    }
  if (B.fuses.length) {
    for (const f of B.fuses) f.t -= h;
    const lit = B.fuses.filter(f => f.t <= 0);
    B.fuses = B.fuses.filter(f => f.t > 0);
    for (const f of lit) bricksDetonate(f);
    if (!B.fuses.length) bricksReactionDone();
  }
  for (const b of B.bricks) {
    if (b.hp <= 0) continue;
    if (b.kind === 'nurse') {
      b.ring -= h;
      if (b.ring <= 0) bricksNurseRing(b);
    } else if (b.kind === 'gremlin') {
      b.hopT -= h;
      if (b.hopT <= 0) {
        b.hopT = (lv.hop || 2.5) / pace;
        bricksHop(b);
      }
    }
    if (mini.screen !== 'play') return;
  }
  if (lv.creep) {
    B.creepT -= h;
    if (B.creepT <= 0) {
      B.creepT = lv.creep / pace;
      bricksCreep();
      if (mini.screen !== 'play') return;
    }
  }
  const boss = bricksFortress();
  if (boss) {
    B.ralphT -= h;
    if (B.ralphT <= 0) {
      B.ralphT = (3.3 * rand(0.85, 1.2)) / pace;
      bricksRalphThrow(boss);
    }
  }
  // Stragglers: a few bricks left and nothing broken for a while drops a pillow pill from the lowest one.
  const live = B.bricks.filter(b => b.hp > 0);
  if (live.length && live.length <= 3 && B.sinceBreak > 4 && !B.pillows && !B.pills.some(p => p.kind === 'pillow')) {
    const low = live.reduce((a, b) => (b.y > a.y ? b : a));
    bricksSpawnPill(low.x + low.w / 2, low.y + low.h, 'pillow');
    B.sinceBreak = 0;
    mini.flash = 1.2;
    mini.flashText = 'STRAGGLERS · A PILLOW PILL IS ON THE WAY';
  }
}

// Keeps a bounce from going flat: at least a third of the speed stays vertical.
function bricksTidy(ball) {
  const s = Math.hypot(ball.vx, ball.vy) || 1,
    min = BRICKS_MIN_VY * s;
  if (Math.abs(ball.vy) < min) {
    ball.vy = (ball.vy < 0 ? -1 : 1) * min;
    ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(s * s - min * min);
  }
}

function bricksMoveBall(ball, h) {
  const B = mini.br,
    R = BRICKS_R;
  if (ball.stuck !== null || ball.dead) return;
  ball.fling = Math.max(0, ball.fling - h);
  const sp = ball.spd * (B.nap > 0 ? 0.7 : 1) * (1 + 0.4 * Math.min(1, ball.fling)),
    m = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx = (ball.vx / m) * sp;
  ball.vy = (ball.vy / m) * sp;
  const py = ball.y;
  ball.x += ball.vx * h;
  ball.y += ball.vy * h;
  if (ball.x < BRICKS_WALL + R) {
    ball.x = BRICKS_WALL + R;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x > BRICKS_FW - BRICKS_WALL - R) {
    ball.x = BRICKS_FW - BRICKS_WALL - R;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y < BRICKS_CEIL + R) {
    ball.y = BRICKS_CEIL + R;
    ball.vy = Math.abs(ball.vy);
    bricksTidy(ball);
  }
  bricksCollide(ball);
  bricksTrayHit(ball, py);
  if (B.net > 0 && ball.vy > 0 && ball.y + R > BRICKS_NET_Y) {
    ball.y = BRICKS_NET_Y - R;
    ball.vy = -Math.abs(ball.vy);
    bricksTidy(ball);
    bricksSpark(ball.x, BRICKS_NET_Y, 0.25, 26, '#efd9ff');
    sfx('bounce');
  }
  if (ball.y - R > BRICKS_FH) ball.dead = true;
}

// Circle against every live brick; the deepest overlap wins and the ball reflects off its surface.
function bricksCollide(ball) {
  const B = mini.br,
    R = BRICKS_R;
  let best = null,
    bd = R * R,
    bx = 0,
    by = 0;
  for (const b of B.bricks) {
    if (b.hp <= 0) continue;
    const cx = clamp(ball.x, b.x, b.x + b.w),
      cy = clamp(ball.y, b.y, b.y + b.h),
      d2 = (ball.x - cx) ** 2 + (ball.y - cy) ** 2;
    if (d2 < bd) {
      bd = d2;
      best = b;
      bx = cx;
      by = cy;
    }
  }
  if (!best) return;
  let nx = ball.x - bx,
    ny = ball.y - by;
  const d = Math.hypot(nx, ny);
  if (d < 1e-6) {
    // The center is inside the brick (it hopped or dropped onto the ball): leave by the nearest face.
    const faces = [
      [ball.x - best.x, -1, 0],
      [best.x + best.w - ball.x, 1, 0],
      [ball.y - best.y, 0, -1],
      [best.y + best.h - ball.y, 0, 1]
    ].sort((a, b) => a[0] - b[0]);
    [, nx, ny] = faces[0];
    if (nx) ball.x = nx < 0 ? best.x - R : best.x + best.w + R;
    else ball.y = ny < 0 ? best.y - R : best.y + best.h + R;
  } else {
    nx /= d;
    ny /= d;
    ball.x = bx + nx * (R + 0.01);
    ball.y = by + ny * (R + 0.01);
  }
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
  }
  bricksTidy(ball);
  B.dry = 0;
  best.ovx -= nx * 40;
  best.ovy -= ny * 40;
  bricksHit(best, 1, ball);
}

function bricksTrayHit(ball, py) {
  const B = mini.br,
    t = B.tray,
    R = BRICKS_R,
    half = t.w / 2,
    lv = bricksLevel();
  if (ball.vy <= 0 || ball.y + R < BRICKS_TRAY_Y || py + R > BRICKS_TRAY_Y + 7) return;
  if (ball.x < t.x - half - R * 0.75 || ball.x > t.x + half + R * 0.75) return;
  ball.y = BRICKS_TRAY_Y - R;
  t.squash = 0.14;
  B.trayHits++;
  ball.spd = Math.min(lv.cap * bricksPace(), ball.spd + lv.ramp * bricksPace());
  if (B.catch > 0) {
    ball.stuck = clamp(ball.x - t.x, -half + 4, half - 4);
    ball.stuckT = 1.4;
    sfx('catch');
    bricksButtons();
    return;
  }
  // Dry spells and the last two bricks bend the bounce toward a brick, so the endgame is not a hunt.
  bricksAimFromTray(ball, (ball.x - t.x) / half, B.dry >= 2 ? 0.6 : B.bricks.length <= 2 ? 0.5 : 0);
  B.dry++;
  sfx('bounce', { pan: (ball.x / BRICKS_FW) * 1.2 - 0.6 });
}

// One hit on a brick. Steel only ever loses one plate; the fortress shrugs while a weak point stands.
function bricksHit(b, dmg, ball) {
  if (b.hp <= 0) return;
  b.flash = 0.12;
  if (b.kind === 'boss' && bricksGuarded(b)) {
    bricksPop(ball ? ball.x : b.x + b.w / 2, (ball ? ball.y : b.y + b.h) - 8, 'CLANK', '#c9d2e3');
    sfx('shield');
    return;
  }
  if (b.kind === 'rubber' && ball) {
    ball.fling = 1;
    sfx('ricochet');
  }
  b.hp -= b.kind === 'armor' ? 1 : dmg;
  if (b.hp > 0) {
    if (b.kind === 'armor') sfx('shield');
    else if (b.kind === 'boss') {
      sfx('bossHit');
      bricksKick(0.12);
    } else if (b.kind !== 'rubber') sfx('hit');
    bricksSpark(b.x + b.w / 2, b.y + b.h / 2, 0.16, 18, '#fff6dc');
    return;
  }
  b.hp = 0;
  bricksBreak(b);
}

// Combo multiplier: every six breaks in a row adds 0.5×, up to 3×.
function bricksMult() {
  return Math.min(3, 1 + Math.floor((mini.combo || 0) / 6) * 0.5);
}

function bricksBreak(b) {
  const B = mini.br,
    lv = bricksLevel(),
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  B.dirty = true;
  B.broken++;
  B.sinceBreak = 0;
  mini.got++;
  mini.combo++;
  mini.maxCombo = Math.max(mini.maxCombo, mini.combo);
  B.comboT = BRICKS_COMBO_GAP;
  const pts = Math.round((50 + 25 * (b.maxHp - 1)) * bricksMult()) + (b.kind === 'boss' ? 2500 : 0);
  mini.score += pts;
  bricksPop(cx, cy - 4, '+' + pts, bricksMult() > 1 ? '#ffe39a' : '#fff3d6');
  bricksSpark(cx, cy, 0.3, b.w * 0.55, '#fff3c8');
  bricksBurst(cx, cy, bricksPalette(b)[0], 7);
  bricksKick(0.07);
  sfx('drip', { count: Math.min(16, mini.combo) });
  if (b.kind === 'star') bricksSpawnPill(cx, cy);
  else if (b.kind !== 'boss' && rand(0, 1) < lv.pillChance) bricksSpawnPill(cx, cy);
  if (b.kind === 'blast') {
    B.fuses.push({ t: 0.08, x: cx, y: cy });
    bricksSpark(cx, cy, 0.4, 70, '#f3a4c6');
    sfx('explode', { vol: 0.6 });
  } else if (b.kind === 'nurse') bricksPop(cx, cy - 18, 'CALL CANCELLED', '#ffd2dc');
  else if (b.kind === 'weak') {
    const boss = bricksFortress();
    if (boss && !bricksGuarded(boss)) {
      mini.flash = 1.2;
      mini.flashText = 'SHIELD DOWN · KNOCK OVER THE FORTRESS';
      sfx('lock');
    }
  } else if (b.kind === 'boss') bricksFortressFalls(b);
}

// A pink brick damages everything around it after a beat, so chains ripple outward.
function bricksDetonate(f) {
  const B = mini.br,
    before = B.broken;
  for (const n of B.bricks) {
    if (n.hp <= 0) continue;
    const dx = Math.abs(n.x + n.w / 2 - f.x) - n.w / 2,
      dy = Math.abs(n.y + n.h / 2 - f.y) - n.h / 2;
    if (dx < BRICKS_PITCH * 0.75 && dy < BRICKS_ROWH * 0.75) {
      n.ovx += Math.sign(n.x + n.w / 2 - f.x) * 90;
      n.ovy += Math.sign(n.y + n.h / 2 - f.y) * 90;
      bricksHit(n, 1, null);
    }
  }
  B.reaction += B.broken - before;
  bricksKick(0.18);
}

function bricksReactionDone() {
  const B = mini.br,
    n = B.reaction;
  B.reaction = 0;
  if (n < 3) return;
  B.bestReaction = Math.max(B.bestReaction, n);
  const bonus = n * 40;
  mini.score += bonus;
  mini.flash = 0.9;
  mini.flashText = 'CHAIN REACTION · ' + n + ' BRICKS · +' + bonus;
  bricksKick(0.3);
  sfx('combo', { count: Math.min(12, n) });
}

function bricksFortressFalls(b) {
  const B = mini.br;
  B.fortressDown = true;
  B.goo = [];
  mini.flash = 1.6;
  mini.flashText = 'RALPH’S FORTRESS FELL · THE REST OF THE RACK SURRENDERS';
  bricksKick(0.6);
  bricksBurst(b.x + b.w / 2, b.y + b.h / 2, '#f6dfaf', 30);
  sfx('bossDie');
  // Everything left crumbles in a ripple from the fortress.
  let i = 0;
  for (const n of B.bricks) {
    if (n.hp <= 0 || n === b) continue;
    n.hp = 1;
    if (n.kind === 'armor' || n.kind === 'boss' || n.kind === 'weak') n.kind = 'plain';
    B.fuses.push({ t: 0.12 + i++ * 0.05, x: n.x + n.w / 2, y: n.y + n.h / 2 });
  }
}

function bricksLower() {
  for (const n of mini.br.bricks) {
    n.y += BRICKS_ROWH;
    n.oy -= BRICKS_ROWH;
  }
}

// Levels 2 and 3: the rack inches down a row every few seconds, so a slow rack gets dangerous.
function bricksCreep() {
  mini.br.creeps++;
  bricksLower();
  sfx('pump');
  bricksRedLine();
}

function bricksNurseRing(b) {
  const B = mini.br;
  b.ring = b.ringMax;
  B.rings++;
  bricksLower();
  bricksPop(b.x + b.w / 2, b.y + b.h + 12, 'RING RING', '#ffd2dc');
  mini.flash = 1.1;
  mini.flashText = 'NURSE CALL · THE WHOLE RACK DROPPED A ROW';
  bricksKick(0.25);
  sfx('trap');
  bricksRedLine();
}

// A rack that crosses the red line loses the bricks that crossed, and you lose a softball.
function bricksRedLine() {
  const B = mini.br,
    over = B.bricks.filter(b => b.hp > 0 && b.y + b.h > BRICKS_LINE);
  if (!over.length) return;
  for (const b of over) {
    b.hp = 0;
    bricksBurst(b.x + b.w / 2, b.y + b.h / 2, '#ff7fa3', 6);
  }
  B.dirty = true;
  B.lineHits++;
  bricksKick(0.45);
  miniOops('THE RACK CROSSED THE RED LINE · ' + bricksSoftballsAfterOops());
}

function bricksSoftballsAfterOops() {
  const left = mini.rules.misses - mini.miss - 1;
  return left > 0 ? left + (left === 1 ? ' SOFTBALL LEFT' : ' SOFTBALLS LEFT') : 'NO SOFTBALLS LEFT';
}

// Gremlin bricks hop one column toward their side, turning around at walls and neighbors.
function bricksHop(b) {
  for (const dir of [b.dir, -b.dir]) {
    const col = b.col + dir;
    if (col < 0 || col >= BRICKS_COLS) continue;
    const taken = mini.br.bricks.some(
      n => n !== b && n.hp > 0 && Math.abs(n.y - b.y) < BRICKS_ROWH * 1.5 && n.y < b.y + b.h && n.y + n.h > b.y && col >= n.col && col < n.col + n.span
    );
    if (taken) continue;
    b.col = col;
    b.x = bricksColX(col);
    b.ox -= dir * BRICKS_PITCH;
    b.dir = dir;
    return true;
  }
  return false;
}

// Ralph lobs a goo blob at where the tray is now.
function bricksRalphThrow(boss) {
  const B = mini.br,
    x0 = boss.x + boss.w / 2,
    y0 = boss.y + boss.h,
    vy = 210 * bricksPace(),
    tx = clamp(B.tray.x + rand(-24, 24), BRICKS_WALL + 10, BRICKS_FW - BRICKS_WALL - 10),
    T = (BRICKS_TRAY_Y - y0) / vy;
  B.goo.push({ x: x0, y: y0, vx: (tx - x0) / T, vy });
  bricksPop(x0, y0 - 6, pick(['INCOMING', 'GOO TIME', 'HEADS UP']), '#c7f28a');
  sfx('blob');
}

function bricksSpawnPill(x, y, kind) {
  const B = mini.br;
  if (!kind) {
    if (B.pills.length >= 3) return null;
    const mix = bricksLevel().pills,
      total = Object.values(mix).reduce((a, b) => a + b, 0);
    let roll = rand(0, total);
    kind = 'wide';
    for (const [k, w] of Object.entries(mix)) {
      roll -= w;
      if (roll < 0) {
        kind = k;
        break;
      }
    }
  }
  const p = { kind, x: clamp(x, BRICKS_WALL + 22, BRICKS_FW - BRICKS_WALL - 22), y, vy: 150 * Math.sqrt(bricksPace()) };
  B.pills.push(p);
  return p;
}

function bricksOnTray(x, y, pad) {
  const t = mini.br.tray;
  return y >= BRICKS_TRAY_Y - pad && y <= BRICKS_TRAY_Y + BRICKS_TRAY_H + pad && Math.abs(x - t.x) <= t.w / 2 + pad;
}

function bricksMovePills(h) {
  const B = mini.br;
  for (const p of B.pills) {
    p.y += p.vy * h;
    if (bricksOnTray(p.x, p.y, 9)) {
      p.done = true;
      bricksTakePill(p.kind);
    } else if (p.y > BRICKS_FH + 20) p.done = true;
  }
  B.pills = B.pills.filter(p => !p.done);
  for (const o of B.goo) {
    o.x += o.vx * h;
    o.y += o.vy * h;
    if (bricksOnTray(o.x, o.y, 8)) {
      o.done = true;
      B.gooT = Math.max(B.gooT, 4.5);
      bricksSpark(o.x, BRICKS_TRAY_Y, 0.3, 30, '#b6ee6a');
      bricksPop(o.x, BRICKS_TRAY_Y - 18, 'GOOED', '#c7f28a');
      sfx('squelch');
    } else if (o.y > BRICKS_FH + 20) o.done = true;
  }
  B.goo = B.goo.filter(o => !o.done);
}

function bricksTakePill(kind) {
  const B = mini.br,
    info = BRICKS_PILLS[kind];
  mini.flash = 1;
  mini.flashText = info.flash;
  bricksPop(B.tray.x, BRICKS_TRAY_Y - 22, info.text, info.a);
  if (kind === 'goo') {
    B.gooT = 6;
    sfx('squelch');
    return;
  }
  B.pillsCaught++;
  mini.score += 100;
  sfx('powerup');
  if (kind === 'wide') B.wide = 14;
  else if (kind === 'catch') B.catch = 14;
  else if (kind === 'nap') B.nap = 9;
  else if (kind === 'pillow') {
    B.pillows = Math.min(9, B.pillows + 4);
    bricksButtons();
  } else if (kind === 'multi') bricksSplit();
}

// Every ball in the air becomes three; a held ball launches first.
function bricksSplit() {
  const B = mini.br,
    born = [];
  for (const b of B.balls) if (b.stuck !== null) bricksLaunch(b);
  for (const b of B.balls) {
    for (const turn of [-0.42, 0.42]) {
      if (B.balls.length + born.length >= BRICKS_MAX_BALLS) break;
      const c = Math.cos(turn),
        s = Math.sin(turn),
        n = bricksMakeBall(b.x, b.y, b.vx * c - b.vy * s, b.vx * s + b.vy * c, b.spd);
      if (n.vy > 0 && b.vy < 0) n.vy = -n.vy;
      bricksTidy(n);
      born.push(n);
    }
  }
  B.balls.push(...born);
  sfx('split');
  bricksButtons();
}

function bricksMoveShots(h) {
  const B = mini.br;
  for (const s of B.shots) {
    s.y += s.vy * h;
    for (const b of B.bricks) {
      if (b.hp <= 0) continue;
      if (s.x > b.x - 5 && s.x < b.x + b.w + 5 && s.y > b.y && s.y < b.y + b.h + 6) {
        s.done = true;
        b.ovy -= 60;
        bricksHit(b, 1, null);
        bricksSpark(s.x, b.y + b.h, 0.22, 22, '#efd9ff');
        break;
      }
    }
    if (s.y < BRICKS_CEIL) {
      s.done = true;
      bricksSpark(s.x, BRICKS_CEIL, 0.2, 16, '#efd9ff');
    }
  }
  B.shots = B.shots.filter(s => !s.done);
}

function bricksDrop() {
  const B = mini.br,
    lv = bricksLevel();
  B.drops++;
  B.speed = (lv.speed + B.rack * 10) * bricksPace();
  B.comboT = 0;
  B.shots = [];
  bricksKick(0.3);
  miniOops('SOFTBALL DOWN · ' + bricksSoftballsAfterOops());
  if (mini.screen !== 'play') return;
  bricksServe();
}

function bricksRackCleared() {
  const B = mini.br,
    lv = bricksLevel(),
    bonus = 400 + 200 * B.rack;
  mini.score += bonus;
  B.balls = [];
  B.pills = [];
  B.shots = [];
  B.goo = [];
  bricksKick(0.35);
  sfx('clear');
  if (B.rack >= B.racks - 1) {
    finishMini(true);
    return;
  }
  B.banner = { text: lv.racks[B.rack].name + ' · CLEARED', sub: '+' + bonus, t: 1.5 };
  B.rack++;
  B.between = 1.5;
  B.creepT = lv.creep / bricksPace();
  B.speed = (lv.speed + B.rack * 10) * bricksPace();
  bricksBuildRack(B.rack, true);
  bricksButtons();
}

// Springs, sparks, pops, trails and the rack-clear banner.
function bricksAnimate(h) {
  const B = mini.br;
  B.shake = Math.max(0, B.shake - h);
  for (const b of B.bricks) {
    b.flash = Math.max(0, b.flash - h);
    b.ovx += (-170 * b.ox - 15 * b.ovx) * h;
    b.ovy += (-170 * b.oy - 15 * b.ovy) * h;
    b.ox += b.ovx * h;
    b.oy += b.ovy * h;
  }
  for (const s of B.sparks) s.life -= h;
  if (B.sparks.length) B.sparks = B.sparks.filter(s => s.life > 0);
  for (const p of B.pops) {
    p.life -= h;
    p.y -= 30 * h;
  }
  if (B.pops.length) B.pops = B.pops.filter(p => p.life > 0);
  if (B.banner) {
    B.banner.t -= h;
    if (B.banner.t <= 0) B.banner = null;
  }
  B.trailT += h;
  if (B.trailT >= 1 / 60) {
    B.trailT = 0;
    for (const b of B.balls) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 7) b.trail.shift();
    }
  }
}

function bricksKick(seconds) {
  if (!reduced) mini.br.shake = Math.max(mini.br.shake, seconds);
}

function bricksSpark(x, y, life, r, col) {
  if (mini.br.sparks.length < 60) mini.br.sparks.push({ x, y, life, max: life, r, col });
}

function bricksPop(x, y, text, col) {
  if (mini.br.pops.length > 14) mini.br.pops.shift();
  mini.br.pops.push({ x, y, text, col, life: 0.9 });
}

// Brick chunks fly in canvas coordinates through the shared particle layer.
function bricksBurst(x, y, col, n) {
  const f = bricksFrame();
  arcadeBurst(x + f.x, y + f.y, col, n);
}

// ---- Art ----
function bricksPalette(b) {
  const kinds = {
    blast: ['#e79bb8', '#a86192'],
    star: ['#f0d58f', '#a98a4f'],
    rubber: ['#8fd6e0', '#3f8fa3'],
    armor: ['#c3c9d6', '#6b7387'],
    gremlin: ['#b5da81', '#61967c'],
    nurse: ['#f6eef0', '#c9a3ad'],
    weak: ['#ff9dc8', '#b0457e']
  };
  if (kinds[b.kind]) return kinds[b.kind];
  if (b.maxHp >= 3) return ['#c7a6d8', '#6f5c97'];
  if (b.maxHp === 2) return ['#a8b8e0', '#5c6f97'];
  return [['#a4d5bf', '#5c8997'], ['#b6dca4', '#5f8f6e'], ['#9fd0dd', '#4f8399']][b.row % 3];
}

function bricksCracks(g, x, y, w, h, level, seed) {
  for (let n = 0; n < level; n++) {
    const sx = x + w / 2 + Math.sin(seed + n * 2.3) * w * 0.28,
      pts = [[sx, y + 2]];
    for (let k = 1; k <= 3; k++) pts.push([sx + Math.sin(seed * 3 + k * 1.9 + n) * 6, y + (h * k) / 3.1]);
    line(g, pts, '#16303d99', 1.6);
  }
}

function bricksDrawBoss(g, b, x, y) {
  const guarded = bricksGuarded(b);
  for (let i = 0; i < 7; i++) rr(g, x + 6 + i * 31, y - 7, 18, 9, 2, '#8d93a8');
  rr(g, x, y, b.w, b.h, 8, gradient(g, x, y, 0, b.h, '#a9adc0', '#5f6479'), '#e9efdc66', 1.5);
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 6 - r; i++) rr(g, x + 6 + i * 36 + (r ? 18 : 0), y + 6 + r * 20, 30, 14, 3, '#7e8398');
  rr(g, x + b.w / 2 - 26, y + 3, 52, b.h - 6, 8, '#2a2f43');
  gremlin(g, x + b.w / 2, y + b.h - 2, 0.55, 1, time);
  rr(g, x + 16, y - 3, b.w - 32, 4, 2, '#2a2f43');
  rr(g, x + 16, y - 3, (b.w - 32) * (b.hp / b.maxHp), 4, 2, '#f3a4c6');
  if (guarded) {
    g.globalAlpha = 0.35 + Math.sin(time * 6) * 0.15;
    rr(g, x - 3, y - 3, b.w + 6, b.h + 6, 10, null, '#bfe3f2', 3);
    g.globalAlpha = 1;
    label(g, 'SHIELD', x + 34, y + 30, 10, '#e8f6ff', 'center');
    label(g, 'SHIELD', x + b.w - 34, y + 30, 10, '#e8f6ff', 'center');
  } else label(g, 'RALPH · ' + Math.ceil(b.hp), x + b.w - 40, y + 30, 11, '#ffe3ef', 'center');
}

function bricksDrawBrick(g, b) {
  const x = b.x + b.ox,
    y = b.y + b.oy,
    cx = x + b.w / 2,
    cy = y + b.h / 2;
  if (b.kind === 'boss') {
    bricksDrawBoss(g, b, x, y);
    if (b.flash > 0) rr(g, x, y, b.w, b.h, 8, '#ffffdc66');
    return;
  }
  const col = bricksPalette(b),
    squash = b.kind === 'rubber' && b.flash > 0 ? 2 : 0;
  rr(g, x - squash, y + squash, b.w + squash * 2, b.h - squash * 2, 6, gradient(g, x, y, 0, b.h, col[0], col[1]), '#e9efdc44', 1);
  rr(g, x + 5, y + 3, b.w - 10, 4, 2, '#ffffff38');
  const hp = Math.ceil(b.hp);
  if (b.kind === 'armor') {
    for (const [rx, ry] of [[5, 5], [b.w - 5, 5], [5, b.h - 5], [b.w - 5, b.h - 5]]) ellipse(g, x + rx, y + ry, 1.8, 1.8, '#eef2f8');
    for (let i = 0; i < 3; i++) rr(g, cx - 15 + i * 11, y + 8, 8, 9, 2, i < b.hp ? '#eef2f8' : '#4a5164');
    bricksCracks(g, x, y, b.w, b.h, 3 - b.hp, b.id * 1.7);
  } else if (b.kind === 'gremlin') {
    gremlin(g, cx - 8, y + b.h + 1, 0.3, 0, time + b.id);
    poly(g, b.dir > 0 ? [[x + b.w - 9, y + 7], [x + b.w - 3, y + 11.5], [x + b.w - 9, y + 16]] : [[x + 9, y + 7], [x + 3, y + 11.5], [x + 9, y + 16]], '#2d4f3f');
  } else if (b.kind === 'nurse') {
    const k = clamp(b.ring / (b.ringMax || 1), 0, 1),
      urgent = b.ring < 3,
      wob = urgent ? Math.sin(time * 22) * 0.35 : 0;
    if (urgent) glow(g, cx, cy, 44, '#ef6f8640');
    g.save();
    g.translate(x + 14, cy + 1);
    g.rotate(wob);
    path(
      g,
      p => {
        p.moveTo(-6, 5);
        p.quadraticCurveTo(-6, -8, 0, -8);
        p.quadraticCurveTo(6, -8, 6, 5);
        p.closePath();
      },
      urgent ? '#ef6f86' : '#e59aa9'
    );
    ellipse(g, 0, 6.5, 2, 2, '#7c3a4b');
    g.restore();
    rr(g, x + 25, y + 9, b.w - 31, 5, 2, '#d8c5ca');
    rr(g, x + 25, y + 9, (b.w - 31) * k, 5, 2, urgent ? '#e05a6e' : '#c48394');
  } else if (b.kind === 'weak') {
    const pulse = 1 + Math.sin(time * 7) * 0.12;
    glow(g, cx, cy, 34 * pulse, '#ff9dc844');
    ellipse(g, cx, cy, 8 * pulse, 8 * pulse, '#fff0f6');
    ellipse(g, cx, cy, 5 * pulse, 5 * pulse, '#d6337a');
  } else {
    if (b.kind === 'rubber')
      for (let i = 0; i < 2; i++) line(g, [[x + 6, y + 9 + i * 7], [x + 14, y + 7 + i * 7], [x + 22, y + 9 + i * 7]], '#e6fbff88', 1.6);
    const mark = b.kind === 'blast' ? '✹' : b.kind === 'star' ? '★' : '';
    if (mark) label(g, mark, cx, y + 17, 15, b.kind === 'blast' ? '#6e2350' : '#6b4f17', 'center');
    else if (hp > 1) label(g, String(hp), cx + (b.kind === 'rubber' ? 8 : 0), y + 17, 13, '#163b4c', 'center');
    bricksCracks(g, x, y, b.w, b.h, b.maxHp > 1 && b.hp < b.maxHp ? 1 + (b.hp / b.maxHp < 0.5 ? 1 : 0) : 0, b.id * 1.7);
  }
  if (b.flash > 0) rr(g, x, y, b.w, b.h, 6, '#ffffdc88');
}

// A capsule pill: two halves, its name across the middle.
function bricksPillArt(g, x, y, kind, s = 1) {
  const p = BRICKS_PILLS[kind] || BRICKS_PILLS.wide;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 12, 18, 3);
  rr(g, -23, -8, 46, 16, 8, p.b, '#10233355', 1);
  rr(g, -23, -8, 23, 16, 8, p.a);
  rr(g, -17, -6, 34, 3, 2, '#ffffff66');
  label(g, p.text, 0, 4, 9, p.ink, 'center');
  if (kind === 'goo') for (const dx of [-12, 4, 15]) ellipse(g, dx, 9 + (dx % 3), 2.2, 3.5, p.b);
  g.restore();
}

// The hospital lunch tray: rim, compartments, and whatever the pills did to it.
function bricksTrayArt(g, x, y, w, o) {
  const sq = o.squash ? Math.min(1, o.squash / 0.14) * 3 : 0,
    h = BRICKS_TRAY_H - sq,
    top = y + sq,
    goo = o.goo,
    face = goo ? ['#c7f28a', '#6aa83a'] : o.sticky ? ['#ffe2a8', '#c99a4a'] : ['#e0f2ec', '#86b3ad'];
  shadow(g, x, top + h + 6, w * 0.45, 5);
  rr(g, x - w / 2, top, w, h, 7, gradient(g, x, top, 0, h, face[0], face[1]), '#f4fff9aa', 1.5);
  for (let i = 1; i < 3; i++) line(g, [[x - w / 2 + (w * i) / 3, top + 4], [x - w / 2 + (w * i) / 3, top + h - 3]], '#5e8c8755', 1.4);
  rr(g, x - w / 2 + 6, top + 2, w - 12, 2.5, 1, '#ffffff77');
  if (goo) for (const dx of [-0.3, 0.05, 0.32]) ellipse(g, x + dx * w, top + h + 3, 2.4, 4.5, '#6aa83a');
  if (o.pillow) {
    rr(g, x - 9, top - 8, 18, 9, 4, '#efd9ff', '#9a74c9', 1);
    line(g, [[x - 5, top - 4], [x + 5, top - 4]], '#9a74c977', 1);
  }
}

function bricksDrawBall(g, b, B) {
  const tint = b.fling > 0 ? '#8fd6e0' : B.nap > 0 ? '#e9e4d0' : '#f9e6ac';
  for (let i = 0; i < b.trail.length; i++) {
    const p = b.trail[i],
      k = (i + 1) / b.trail.length;
    g.globalAlpha = k * 0.32;
    ellipse(g, p.x, p.y, BRICKS_R * k, BRICKS_R * k, tint);
  }
  g.globalAlpha = 1;
  if (b.fling > 0) glow(g, b.x, b.y, 22, '#8fd6e055');
  softball(g, b.x, b.y, BRICKS_R);
}

// Wallpaper outside the field: the softballs and pillows you have left.
function bricksDrawSurround(g, w, h, f) {
  const B = mini.br,
    left = Math.max(0, mini.rules.misses - mini.miss);
  rect(g, 0, 0, w, h, gradient(g, 0, 0, 0, h, '#4a3d63', '#122c40'));
  for (let x = 10; x < w; x += 26) rect(g, x, 0, 9, h, '#ffffff05');
  if (mini.portrait) {
    const by = f.y + BRICKS_FH;
    rr(g, 24, by + 22, w - 48, 30, 15, '#0f2233aa', '#b7cbd522', 1);
    label(g, '◀  SLIDE ANYWHERE  ▶', w / 2, by + 42, 11, '#b9d3d2', 'center');
    for (let i = 0; i < left; i++) softball(g, 36 + i * 17, by + 72, 6);
    for (let i = 0; i < Math.min(9, B.pillows); i++) rr(g, w - 44 - i * 15, by + 66, 12, 9, 4, '#efd9ff', '#9a74c9', 1);
    return;
  }
  // Landscape gutters: softballs stack on the left, pillows on the right.
  for (let i = 0; i < left; i++) softball(g, f.x / 2, h - 30 - i * 20, 7);
  for (let i = 0; i < Math.min(9, B.pillows); i++) rr(g, w - f.x / 2 - 8, h - 34 - i * 14, 16, 10, 4, '#efd9ff', '#9a74c9', 1);
  label(g, 'BALLS', f.x / 2, h - 8, 8, '#b9d3d2', 'center');
  label(g, 'PILLOWS', w - f.x / 2, h - 8, 8, '#b9d3d2', 'center');
}

function bricksDraw(g) {
  const B = mini.br,
    { w, h } = activeCanvas(),
    f = bricksFrame(),
    lv = bricksLevel(),
    t = B.tray,
    shake = B.shake > 0 ? Math.min(1, B.shake) * 9 : 0;
  bricksDrawSurround(g, w, h, f);
  g.save();
  g.translate(f.x + (shake ? Math.sin(mini.total * 83) * shake : 0), f.y + (shake ? Math.cos(mini.total * 71) * shake * 0.6 : 0));
  rr(g, 0, 0, BRICKS_FW, BRICKS_FH, 16, gradient(g, 0, 0, 0, BRICKS_FH, '#1a2f47', '#132538'), '#b7cbd533', 2);
  rect(g, BRICKS_WALL, BRICKS_CEIL - 4, BRICKS_FW - BRICKS_WALL * 2, 4, '#b7cbd522');
  for (let i = 0; i <= BRICKS_COLS; i++) {
    const x = BRICKS_WALL + i * BRICKS_PITCH;
    line(g, [[x, BRICKS_CEIL], [x, BRICKS_LINE]], '#cad9db08', 1);
  }
  label(g, 'LEVEL ' + (mini.tier + 1) + ' · ' + lv.racks[B.rack].name, BRICKS_FW / 2, BRICKS_CEIL + 22, 10, '#efdab077', 'center');
  if (lv.nurse) {
    const low = B.bricks.reduce((m, b) => (b.hp > 0 ? Math.max(m, b.y + b.h) : m), 0),
      near = low + BRICKS_ROWH > BRICKS_LINE;
    g.setLineDash([8, 8]);
    line(g, [[BRICKS_WALL + 4, BRICKS_LINE], [BRICKS_FW - BRICKS_WALL - 4, BRICKS_LINE]], near ? '#ff7fa3' : '#e49bb288', near ? 3 : 2);
    g.setLineDash([]);
    label(g, 'DO NOT CROSS', BRICKS_FW / 2, BRICKS_LINE - 6, 9, '#f3a8bf99', 'center');
    if (near) glow(g, BRICKS_FW / 2, BRICKS_LINE, 200, '#ff7fa322');
  }
  for (const b of B.bricks) if (b.hp > 0) bricksDrawBrick(g, b);
  for (const p of B.pills) bricksPillArt(g, p.x, p.y, p.kind);
  for (const o of B.goo) {
    ellipse(g, o.x, o.y, 8, 9, '#8fd14f');
    ellipse(g, o.x - 2, o.y - 3, 3, 2.5, '#d9ff9c');
  }
  for (const s of B.shots) {
    rr(g, s.x - 8, s.y - 6, 16, 12, 5, '#efd9ff', '#9a74c9', 1.2);
    line(g, [[s.x - 4, s.y], [s.x + 4, s.y]], '#9a74c977', 1);
  }
  if (B.net > 0 && (B.net > 2 || Math.sin(mini.total * 18) > 0))
    for (let x = BRICKS_WALL + 14; x < BRICKS_FW - BRICKS_WALL; x += 30) rr(g, x - 13, BRICKS_NET_Y, 26, 11, 5, '#efd9ffcc', '#9a74c9', 1);
  bricksTrayArt(g, t.x, BRICKS_TRAY_Y, t.w, { squash: t.squash, goo: B.gooT > 0, sticky: B.catch > 0, pillow: B.pillows > 0 });
  for (const b of B.balls) bricksDrawBall(g, b, B);
  for (const s of B.sparks) {
    const k = s.life / s.max;
    g.globalAlpha = k;
    g.strokeStyle = s.col;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(s.x, s.y, 3 + s.r * (1 - k), 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  for (const p of B.pops) {
    g.globalAlpha = Math.min(1, p.life * 2.5);
    label(g, p.text, p.x, p.y, 12, p.col, 'center');
  }
  g.globalAlpha = 1;
  bricksDrawStatus(g, B, t);
  g.restore();
  if (B.nap > 0) {
    g.globalAlpha = Math.min(1, B.nap) * 0.6;
    rect(g, 0, 0, w, h, '#0b1a2a44');
    g.globalAlpha = 1;
  }
}

// Serve prompt, combo chip, power-up clocks and the rack-clear banner, all in field space.
function bricksDrawStatus(g, B, t) {
  const held = B.balls.find(b => b.stuck !== null);
  if (held && !B.between) {
    const k = clamp(held.stuckT / (held.serve ? bricksLevel().serve : 1.4), 0, 1);
    g.strokeStyle = '#ffe4aa';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(held.x, held.y, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    g.stroke();
    label(g, held.serve ? 'TAP TO SERVE' : 'TAP TO LET GO', t.x, BRICKS_TRAY_Y - 34, 12, '#f2dba7', 'center');
  }
  if (mini.combo >= 3) {
    const mult = bricksMult();
    rr(g, BRICKS_WALL + 6, BRICKS_FH - 46, 104, 32, 11, '#102b40dd', mult > 1 ? '#ffe39a88' : '#b7cbd544', 1);
    label(g, 'COMBO ' + mini.combo, BRICKS_WALL + 16, BRICKS_FH - 31, 11, '#d3e4d9');
    label(g, '×' + mult.toFixed(1), BRICKS_WALL + 102, BRICKS_FH - 25, 14, mult > 1 ? '#ffe39a' : '#d3e4d9', 'right');
    rect(g, BRICKS_WALL + 16, BRICKS_FH - 24, 50 * clamp(B.comboT / BRICKS_COMBO_GAP, 0, 1), 3, '#ffe39a');
  }
  const clocks = [
    ['WIDE', B.wide, 14, '#bdf0d8'],
    ['CATCH', B.catch, 14, '#bfe3ff'],
    ['NAP', B.nap, 9, '#f4f0e2'],
    ['GOO', B.gooT, 6, '#c7f28a'],
    ['NET', B.net, 10, '#efd9ff']
  ].filter(c => c[1] > 0);
  clocks.forEach(([name, left, max, col], i) => {
    const x = BRICKS_FW - BRICKS_WALL - 66,
      y = BRICKS_FH - 26 - i * 16;
    label(g, name, x - 4, y + 5, 9, col, 'right');
    rr(g, x, y, 56, 5, 2, '#26495a');
    rr(g, x, y, 56 * clamp(left / max, 0, 1), 5, 2, col);
  });
  if (B.banner) {
    const a = Math.min(1, B.banner.t * 3);
    g.globalAlpha = a;
    rr(g, 50, 250, BRICKS_FW - 100, 74, 18, '#112e45ee', '#ffe39a88', 1.5);
    label(g, B.banner.text, BRICKS_FW / 2, 284, 17, '#f4ebcf', 'center');
    label(g, B.banner.sub, BRICKS_FW / 2, 308, 14, '#ffe39a', 'center');
    g.globalAlpha = 1;
  }
}

// A mouse moves the tray without a button held: the pointer is the tray.
function bricksHover(e) {
  if (!mini.open || mini.id !== BRICKS.id || mini.screen !== 'play' || mini.paused || !mini.br) return;
  if (e.pointerType !== 'mouse' || arcadePointer !== null) return;
  mini.br.keyMode = false;
  bricksAimTray(miniPoint(e));
}

$('miniCanvas').addEventListener('pointermove', bricksHover);
