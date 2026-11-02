// Brick Rebellion (family lounge). Aim softball volleys at a descending brick rack before it crosses
// the red line. Shifts escalate by volley count, not time. Canvas 600 × 600.
// Level 1 teaches with a full aim guide. Levels 2 and 3 show only the path to the first bounce and add
// armored, gremlin and nurse-call bricks; level 3's last third brings Ralph's fortress.
const BRICKS_COLS = 6;
const BRICKS_X0 = 49.5;
const BRICKS_PITCH = 85;
const BRICKS_W = 76;
const BRICKS_H = 40;
const BRICKS_ROW = 46;
const BRICKS_TOP = 58;
const BRICKS_LINE = 505;
const BRICKS_CEIL = 52;
const BRICKS_FLOOR = 553;
const BRICKS_SLOWMO_RATE = 0.35;
const BRICKS_COMBO_GAP = 1.5;
// hp: starting range; bricks gain +1 every `grow` volleys thrown, up to `growCap`. kinds: chance per
// brick of each special type; anything left over is a plain brick.
const BRICKS_LEVELS = [
  {
    volleys: 12,
    goal: 24,
    limit: 240,
    rows: 3,
    per: [3, 4],
    hp: [1, 3],
    grow: 3,
    growCap: 3,
    heavy: 2,
    fan: 2,
    fullPreview: true,
    kinds: { blast: 0.13, extra: 0.08, rubber: 0.1, armor: 0, gremlin: 0 },
    nurseEvery: 0,
    fortress: false
  },
  {
    volleys: 15,
    goal: 36,
    limit: 270,
    rows: 3,
    per: [4, 5],
    hp: [2, 4],
    grow: 2,
    growCap: 5,
    heavy: 3,
    fan: 2,
    fullPreview: false,
    kinds: { blast: 0.11, extra: 0.07, rubber: 0.09, armor: 0.12, gremlin: 0.1 },
    nurseEvery: 4,
    fortress: false
  },
  {
    volleys: 18,
    goal: 48,
    limit: 300,
    rows: 4,
    per: [4, 5],
    hp: [2, 5],
    grow: 2,
    growCap: 5,
    heavy: 3,
    fan: 2,
    fullPreview: false,
    kinds: { blast: 0.11, extra: 0.07, rubber: 0.09, armor: 0.17, gremlin: 0.12 },
    nurseEvery: 3,
    fortress: true
  }
];

const BRICKS = registerGame({
  id: 2,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Brick Rebellion',
    genre: 'AIM · RICOCHET · CHAIN REACTIONS',
    headline: 'One softball. Several bad decisions.',
    desc: 'Pull back from the ball and release a volley into the brick infestation. Bank shots off the walls, crack armor, and set off pink chain reactions. Choose heavy or fan shots carefully: supplies are limited, and the bricks have a union rep.',
    goal: 'Break the block quota and survive every volley.',
    control:
      'PULL AIM: drag back from the glowing ball, then release. FLICK AIM: flick the ball upward; a faster flick throws harder. Bank off walls. Choose HEAVY or FAN before a shot.',
    avoid:
      'After each volley the rack drops a row. Don’t let it cross the red line. Pink blocks explode, stars add a ball, rubber flings balls faster. Clear a whole row in one volley for a free volley. A wall bank scores 1.5× on its first hit.',
    cue: 'PULL = drag back · FLICK = swipe forward · bank shots hit harder'
  },
  tierNotes: [
    '12 volleys · full aim guide · rubber and pink',
    '15 volleys · armor · gremlin and nurse bricks',
    '18 volleys · Ralph’s fortress · first-bounce aim'
  ],
  init() {
    const lv = BRICKS_LEVELS[mini.tier];
    initArcadeRun(lv.limit);
    mini.goal = lv.goal;
    mini.volleys = lv.volleys;
    mini.shot = 0;
    mini.anchor = { x: 300, y: 548 };
    mini.aim = null;
    mini.balls = [];
    mini.queue = 0;
    mini.fireClock = 0;
    mini.shotClock = 0;
    mini.ballCount = 6 + mini.tier + (state.difficulty === 0 ? 2 : state.difficulty === 2 ? -1 : 0);
    mini.shotType = 'normal';
    mini.throwStyle = 'pull';
    mini.heavy = lv.heavy;
    mini.fan = lv.fan;
    mini.blocks = [];
    mini.blockSerial = 0;
    mini.boardWait = 0;
    mini.bricksRowSerial = 0;
    mini.bricksThrown = 0;
    mini.bricksRowsAtStart = [];
    mini.bricksRowClears = 0;
    mini.bricksFreeVolleys = 0;
    mini.bricksComboT = 0;
    mini.bricksSlowmo = 0;
    mini.bricksSlowUsed = false;
    mini.bricksChainRun = 0;
    mini.bricksShake = 0;
    mini.bricksBrace = false;
    mini.bricksNurseRings = 0;
    mini.bricksFortress = false;
    mini.bricksFortressDown = false;
    mini.bricksSparks = [];
    mini.bricksPops = [];
    mini.bricksLurch = 0;
    for (let r = lv.rows - 1; r >= 0; r--) addBrickRow(BRICKS_TOP + r * BRICKS_ROW, 0);
  },
  controls() {
    setControls([
      { id: 'normal', text: 'VOLLEY ' + mini.ballCount, hot: mini.shotType === 'normal' },
      { id: 'heavy', text: 'HEAVY · ' + mini.heavy, hot: mini.shotType === 'heavy' },
      { id: 'fan', text: 'FAN · ' + mini.fan, hot: mini.shotType === 'fan' },
      { id: 'style', text: mini.throwStyle === 'pull' ? 'PULL AIM ⇄' : 'FLICK AIM ⇄' },
      { id: 'recall', text: 'RECALL', key: 'Space' }
    ]);
  },
  update(dt) {
    updateArcade(dt, updateVolley);
  },
  draw(g) {
    arcadeBackdrop(g, '#483b61', '#daaddd22', 'LOUNGE / SOFTBALL THERAPY');
    bricksDraw(g);
  },
  down(p) {
    if (!mini.balls.length && !mini.queue && !mini.boardWait && dist(p, mini.anchor) < 100)
      mini.aim = { ...p };
  },
  move(p) {
    if (mini.aim) mini.aim = { ...p };
  },
  up(cancel) {
    if (mini.aim) {
      if (!cancel && mini.screen === 'play' && !mini.paused) shootVolley();
      mini.aim = null;
    }
  },
  action(a) {
    if (a === 'style' && !mini.balls.length && !mini.queue) {
      mini.throwStyle = mini.throwStyle === 'pull' ? 'flick' : 'pull';
      BRICKS.controls();
      sfx('ui');
    }
    if (
      ['normal', 'heavy', 'fan'].includes(a) &&
      mini.balls.length === 0 &&
      mini.queue === 0 &&
      (a === 'normal' || mini[a] > 0)
    ) {
      mini.shotType = a;
      BRICKS.controls();
      sfx('reload');
    }
    if (a === 'recall' && mini.shotClock > 1.2 && mini.balls.length) {
      mini.balls = [];
      mini.queue = 0;
      sfx('catch');
      bricksEndVolley();
    }
  },
  // Braces the rack against its next descent and softens every brick by one hit.
  assist() {
    mini.bricksBrace = true;
    for (const b of mini.blocks) {
      b.hp = Math.max(1, b.hp - (b.kind === 'boss' ? 3 : 1));
      if (b.kind === 'nurse') b.ring = 2;
    }
    mini.flash = 1;
    mini.flashText = 'PUSH BACK · RACK BRACED, EVERY BRICK SOFTENED';
  },
  key(k, e) {
    if (e.repeat) return true;
    const action = { 1: 'normal', 2: 'heavy', 3: 'fan', ' ': 'recall' }[k];
    if (action) miniAction(action);
    return true;
  },
  shiftName: 'RACK',
  shiftLevel: () => bricksShift(),
  shiftMessage(shift) {
    if (shift === 2 && BRICKS_LEVELS[mini.tier].fortress) return 'FINAL RACK · Ralph is building a fortress. Weak points first.';
    return shift === 1 ? 'SECOND RACK · tougher bricks. Bank shots hit harder.' : 'FINAL RACK · empty the volley budget, clear the quota.';
  },
  // The clock is only a ceiling here: running out of time never wins.
  timeUp() {
    finishMini(false, 'The lounge closed for the night. RECALL skips slow bounces when a volley drags on.');
  },
  lesson() {
    const i = BRICKS.info,
      extra = [
        ' Level 1 draws the whole flight path while you aim.',
        ' New: armored bricks need HEAVY or three hits. Gremlin bricks sidestep a column every volley. Nurse call bricks drag the whole rack down a row if they survive two volleys, so kill them first. The aim guide now stops at the first bounce.',
        ' New: in the last third, Ralph builds a fortress across the rack. It shrugs off everything until both glowing weak points are gone.'
      ][mini.tier];
    return {
      title: i.game + ' · ' + mini.volleys + ' volleys',
      goal: i.goal + ' Target: ' + mini.goal + '.',
      control: i.control,
      avoid: i.avoid + extra,
      demo: 'aim',
      cue: i.cue
    };
  },
  statLabel: () => 'BLOCKS / VOLLEYS',
  stat: () => mini.got + '/' + mini.goal + ' · ' + mini.shot + '/' + mini.volleys,
  livesLabel: () => 'SPECIAL SHOTS',
  lives: () => mini.heavy + ' heavy · ' + mini.fan + ' fan',
  tactics: () =>
    'SCORE ' +
    mini.score +
    ' · BEST COMBO ' +
    mini.maxCombo +
    ' · ROWS ' +
    mini.bricksRowClears +
    ' · ' +
    mini.helps +
    ' ASSISTS',
  assistText: () => 'PUSH BACK · ' + mini.helps + ' (E)',
  quality() {
    const over = Math.max(0, mini.got / mini.goal - 1);
    return Math.round(
      clamp(
        62 +
          Math.min(14, over * 40) +
          Math.min(14, mini.maxCombo * 0.35) +
          Math.min(10, mini.bricksRowClears * 2.5) +
          (mini.bricksFortressDown ? 4 : 0) -
          mini.helpUsed * 4 -
          mini.bricksNurseRings * 3,
        0,
        100
      )
    );
  },
  onWin() {
    if (mini.bricksFortressDown) return 'Ralph’s fortress is rubble. He is drafting a strongly worded memo.';
    if (mini.bricksRowClears >= 4) return mini.bricksRowClears + ' rows cleared. The bricks are requesting a transfer.';
    return undefined;
  },
  onLose(reason) {
    if (reason && reason.includes('red line')) return { heading: 'THE BRICKS UNIONIZED.' };
    return {};
  },
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#605274', '#193b4e'));
    for (let r = 0; r < 3; r++)
      for (let col = 0; col < 5; col++) {
        const kind = (r + col) % 4 === 0 ? '#d99db9' : r === 1 && col === 2 ? '#9aa3b4' : '#aed1bf';
        rr(g, 72 + col * 57, 42 + r * 33, 50, 27, 7, kind);
        label(g, String(((r + col) % 3) + 1), 97 + col * 57, 62 + r * 33, 13, '#315b66', 'center');
      }
    gremlin(g, 155, 101, 0.45, 0, 0.3);
    for (let i = 0; i < 8; i++) ellipse(g, 215 + i * 12, 195 - i * 12, 3, 3, '#f6dfaf');
    softball(g, 210, 200, 12);
    label(g, BRICKS.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

function bricksLevel() {
  return BRICKS_LEVELS[mini.tier] || BRICKS_LEVELS[0];
}

function bricksShift() {
  return Math.min(2, Math.floor(mini.shot / (mini.volleys / 3)));
}

function bricksColX(col) {
  return BRICKS_X0 + col * BRICKS_PITCH;
}

function bricksMakeBlock(kind, col, y, rowId, hp) {
  return {
    id: mini.blockSerial++,
    rowId,
    kind,
    col,
    span: 1,
    x: bricksColX(col),
    y,
    w: BRICKS_W,
    h: BRICKS_H,
    hp,
    maxHp: hp,
    flash: 0,
    ox: 0,
    oy: 0,
    ovx: 0,
    ovy: 0,
    dir: 1,
    ring: 0,
    boss: null
  };
}

// One new row at the top of the rack. Level settings pick the count, toughness and special bricks.
function addBrickRow(y = BRICKS_TOP, round = mini.bricksThrown) {
  const lv = bricksLevel(),
    rowId = mini.bricksRowSerial++,
    count = clamp(Math.floor(rand(lv.per[0], lv.per[1] + 1)), lv.per[0], lv.per[1]),
    open = [0, 1, 2, 3, 4, 5],
    cols = [];
  while (cols.length < count) cols.push(open.splice(Math.floor(rand(0, open.length)), 1)[0]);
  cols.sort((a, b) => a - b);
  const nurseCol = lv.nurseEvery && round > 0 && rowId % lv.nurseEvery === 0 ? pick(cols) : -1;
  let extras = 0;
  for (const col of cols) {
    let hp = Math.floor(rand(lv.hp[0], lv.hp[1] + 1)) + Math.min(lv.growCap, Math.floor(round / lv.grow)),
      kind = 'plain';
    const roll = rand(0, 1),
      k = lv.kinds;
    if (col === nurseCol) kind = 'nurse';
    else if (roll < k.blast) kind = 'blast';
    else if (roll < k.blast + k.extra && !extras++) kind = 'extra';
    else if (roll < k.blast + k.extra + k.rubber) kind = 'rubber';
    else if (roll < k.blast + k.extra + k.rubber + k.armor) kind = 'armor';
    else if (roll < k.blast + k.extra + k.rubber + k.armor + k.gremlin) kind = 'gremlin';
    if (kind === 'armor') hp = 3;
    if (kind === 'nurse') hp = mini.tier === 2 ? 2 : 1;
    const b = bricksMakeBlock(kind, col, y, rowId, hp);
    if (kind === 'nurse') b.ring = 2;
    if (kind === 'gremlin') b.dir = rand(0, 1) < 0.5 ? -1 : 1;
    mini.blocks.push(b);
  }
}

// Ralph's fortress: a four-column wall flanked by two weak points that must fall first.
function bricksAddFortress(y = BRICKS_TOP) {
  const rowId = mini.bricksRowSerial++,
    boss = bricksMakeBlock('boss', 1, y, rowId, 16 + state.difficulty * 3);
  boss.span = 4;
  boss.w = BRICKS_PITCH * 3 + BRICKS_W;
  mini.blocks.push(boss);
  for (const col of [0, 5]) {
    const weak = bricksMakeBlock('weak', col, y, rowId, 4);
    weak.boss = boss.id;
    mini.blocks.push(weak);
  }
  mini.bricksFortress = true;
  mini.flash = 1.4;
  mini.flashText = 'RALPH’S FORTRESS · BREAK BOTH WEAK POINTS FIRST';
  bricksKick(0.35);
  sfx('wave');
}

function bricksGuarded(boss) {
  return mini.blocks.some(b => b.kind === 'weak' && b.boss === boss.id && b.hp > 0);
}

function bricksKick(seconds) {
  if (!reduced) mini.bricksShake = Math.max(mini.bricksShake, seconds);
}

// Impact flash: a ring that grows from the contact point as it fades.
function bricksSpark(x, y, life, r, col) {
  mini.bricksSparks.push({ x, y, life, max: life, r, col });
}

function bricksPop(x, y, text, col) {
  mini.bricksPops.push({ x, y, text, col, life: 0.9 });
}

// Combo multiplier: every five hits in a volley adds 0.5×, up to 3×.
function bricksMult() {
  return Math.min(3, 1 + Math.floor(mini.combo / 5) * 0.5);
}

function volleyVector() {
  let dx = mini.anchor.x - mini.aim.x,
    dy = mini.anchor.y - mini.aim.y;
  if (mini.throwStyle === 'flick') {
    dx *= -1;
    dy *= -1;
  }
  if (Math.hypot(dx, dy) < 12) return null;
  // A drag behind the ball launches upward, with a safe minimum vertical component.
  dy = Math.min(-25, dy);
  const d = Math.hypot(dx, dy),
    speed =
      mini.throwStyle === 'flick'
        ? clamp(d / Math.max(0.08, mini.total - (mini.pointer?.startT ?? mini.total)), 350, 850)
        : clamp(d * 5, 350, 720);
  return { vx: (dx / d) * speed, vy: (dy / d) * speed, power: clamp(d / 140, 0, 1) };
}

function shootVolley() {
  const v = volleyVector();
  if (!v) return;
  mini.volleyVelocity = v;
  mini.shotClock = 0;
  mini.fireClock = 0;
  mini.queue =
    mini.shotType === 'fan'
      ? mini.ballCount + 4
      : mini.shotType === 'heavy'
        ? Math.max(4, Math.floor(mini.ballCount * 0.65))
        : mini.ballCount;
  mini.volleyType = mini.shotType;
  if (mini.shotType !== 'normal') mini[mini.shotType]--;
  mini.shot++;
  mini.bricksThrown++;
  mini.combo = 0;
  mini.bricksComboT = 0;
  mini.bricksSlowUsed = false;
  mini.bricksSlowmo = 0;
  mini.bricksRowsAtStart = [...new Set(mini.blocks.filter(b => b.hp > 0).map(b => b.rowId))];
  mini.shotType = 'normal';
  BRICKS.controls();
  sfx('throw');
}

// Damage one brick. Armor ignores anything lighter than HEAVY beyond one plate; the fortress
// ignores everything while a weak point stands.
function bricksStrike(b, power, bonus = 1) {
  if (b.hp <= 0) return;
  b.flash = 0.15;
  if (b.kind === 'boss' && bricksGuarded(b)) return;
  b.hp -= b.kind === 'armor' ? (power >= 3 ? b.hp : 1) : power;
  if (b.hp > 0) return;
  b.hp = 0;
  bricksBreak(b, bonus);
}

function bricksBreak(b, bonus) {
  const mult = bricksMult(),
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  mini.got += b.kind === 'boss' ? 5 : 1;
  mini.bricksChainRun++;
  mini.score += Math.round(80 * mult * bonus) + (b.kind === 'boss' ? 1500 : 0);
  mini.precisions.push(1);
  arcadeBurst(cx, cy, b.kind === 'blast' ? '#f3a4c6' : b.kind === 'armor' ? '#c9d2e3' : '#eed5a3', 8);
  bricksSpark(cx, cy, 0.3, b.w * 0.6, '#fff3c8');
  if (b.kind === 'extra') {
    mini.ballCount = Math.min(18, mini.ballCount + 1);
    mini.flash = 0.7;
    mini.flashText = 'EXTRA BALL · ' + mini.ballCount + ' PER VOLLEY';
    sfx('powerup');
  } else if (b.kind === 'nurse') bricksPop(cx, cy, 'CALL CANCELLED', '#ffd2dc');
  else if (b.kind === 'weak') {
    const boss = mini.blocks.find(n => n.id === b.boss);
    if (boss && !bricksGuarded(boss)) {
      mini.flash = 1;
      mini.flashText = 'FORTRESS EXPOSED · SMASH IT';
      sfx('lock');
    }
  } else if (b.kind === 'boss') {
    mini.bricksFortressDown = true;
    mini.flash = 1.4;
    mini.flashText = 'RALPH’S FORTRESS FELL · +5 BLOCKS';
    bricksKick(0.6);
    arcadeBurst(cx, cy, '#f6dfaf', 30);
    sfx('clear');
  } else sfx(b.kind === 'blast' ? 'explode' : 'hit');
  if (b.kind === 'blast') {
    bricksSpark(cx, cy, 0.4, 115, '#f3a4c6');
    for (const n of mini.blocks)
      if (n !== b && n.hp > 0 && Math.hypot(n.x + n.w / 2 - cx, n.y + n.h / 2 - cy) < 115) bricksStrike(n, 2);
  }
}

// A ball meets a brick: combo, bank bonus, rubber fling, then damage and chain bookkeeping.
function bricksHit(ball, t) {
  const bank = ball.banked && ball.hits === 0;
  ball.hits++;
  mini.combo++;
  mini.maxCombo = Math.max(mini.maxCombo, mini.combo);
  mini.bricksComboT = BRICKS_COMBO_GAP;
  mini.score += Math.round(10 * bricksMult());
  bricksSpark(ball.x, ball.y, 0.18, 22, bank ? '#ffe39a' : '#fff6dc');
  if (bank) bricksPop(ball.x, ball.y - 14, 'BANK ×1.5', '#ffe39a');
  if (t.kind === 'rubber') {
    const s = Math.hypot(ball.vx, ball.vy),
      k = Math.min(950, s * 1.28) / s;
    ball.vx *= k;
    ball.vy *= k;
    ball.rubber = 0.6;
    sfx('ricochet');
  } else if (t.kind === 'boss' && bricksGuarded(t)) {
    bricksPop(ball.x, ball.y, 'CLANK', '#c9d2e3');
    sfx('shield');
  } else sfx('bounce');
  mini.bricksChainRun = 0;
  bricksStrike(t, bank ? ball.power * 1.5 : ball.power, bank ? 1.5 : 1);
  if (mini.bricksChainRun >= 4) {
    bricksKick(0.4);
    mini.flash = 0.9;
    mini.flashText = 'CHAIN REACTION · ' + mini.bricksChainRun + ' BRICKS';
    sfx('combo', { count: mini.bricksChainRun });
  }
}

function bricksDescend(rows) {
  for (const b of mini.blocks) {
    b.y += BRICKS_ROW * rows;
    b.oy -= BRICKS_ROW * rows;
  }
  mini.bricksLurch = 0.45;
}

// Gremlin bricks sidestep one column per volley, turning around at walls and neighbors.
function bricksSlideGremlins() {
  for (const b of mini.blocks) {
    if (b.kind !== 'gremlin' || b.hp <= 0) continue;
    for (const dir of [b.dir, -b.dir]) {
      const col = b.col + dir;
      if (col < 0 || col >= BRICKS_COLS) continue;
      const taken = mini.blocks.some(
        n => n !== b && n.hp > 0 && Math.abs(n.y - b.y) < 5 && col >= n.col && col < n.col + n.span
      );
      if (taken) continue;
      b.col = col;
      b.x = bricksColX(col);
      b.ox -= dir * BRICKS_PITCH;
      b.dir = dir;
      break;
    }
  }
}

function bricksEndVolley() {
  mini.blocks = mini.blocks.filter(b => b.hp > 0);
  mini.balls = [];
  mini.queue = 0;
  mini.bricksSlowmo = 0;
  mini.combo = 0;
  mini.anchor.x = clamp(mini.returnX ?? mini.anchor.x, 55, 545);
  mini.returnX = null;
  mini.boardWait = 0.65;
  // Clearing a whole row that stood at launch refunds the volley and holds the rack still.
  const cleared = mini.bricksRowsAtStart.filter(r => !mini.blocks.some(b => b.rowId === r));
  mini.bricksRowsAtStart = [];
  if (cleared.length) {
    mini.bricksRowClears += cleared.length;
    mini.bricksFreeVolleys++;
    mini.shot--;
    mini.limit += 10;
    mini.flash = 1;
    mini.flashText = (cleared.length > 1 ? cleared.length + ' ROWS CLEARED' : 'ROW CLEARED') + ' · FREE VOLLEY';
    sfx('clear');
    // The rack holds still, but an empty top row still gets restocked.
    if (!mini.blocks.some(b => b.y < BRICKS_TOP + BRICKS_ROW / 2)) addBrickRow(BRICKS_TOP, mini.bricksThrown);
    BRICKS.controls();
    return;
  }
  if (mini.shot >= mini.volleys) {
    finishMini(
      mini.got >= mini.goal,
      mini.got >= mini.goal ? undefined : 'Volley budget spent. Bank shots, pink chain reactions and row clears break more blocks.'
    );
    return;
  }
  if (mini.bricksBrace) {
    mini.bricksBrace = false;
    mini.flash = 0.8;
    mini.flashText = 'RACK BRACED · NO DESCENT THIS TIME';
    BRICKS.controls();
    return;
  }
  bricksDescend(1);
  let rang = false;
  for (const b of mini.blocks)
    if (b.kind === 'nurse' && --b.ring <= 0) {
      b.ring = 2;
      rang = true;
    }
  if (rang) {
    bricksDescend(1);
    mini.bricksNurseRings++;
    mini.flash = 1;
    mini.flashText = 'NURSE CALL · THE WHOLE RACK DROPS A ROW';
    bricksKick(0.3);
    sfx('wave');
  }
  bricksSlideGremlins();
  if (mini.blocks.some(b => b.y + b.h >= BRICKS_LINE)) {
    finishMini(false, 'The bricks crossed the red line. Aim for the lowest blocks, and kill nurse calls early.');
    return;
  }
  if (bricksLevel().fortress && !mini.bricksFortress && bricksShift() === 2) bricksAddFortress(BRICKS_TOP);
  else addBrickRow(BRICKS_TOP, mini.bricksThrown);
  sfx('trap');
  BRICKS.controls();
}

// Springs, sparks and pops run on real time so they keep animating between volleys.
function bricksAnimate(dt) {
  mini.bricksShake = Math.max(0, mini.bricksShake - dt);
  mini.bricksLurch = Math.max(0, mini.bricksLurch - dt);
  for (const b of mini.blocks) {
    b.flash = Math.max(0, b.flash - dt);
    b.ovx += (-170 * b.ox - 15 * b.ovx) * dt;
    b.ovy += (-170 * b.oy - 15 * b.ovy) * dt;
    b.ox += b.ovx * dt;
    b.oy += b.ovy * dt;
    if (Math.abs(b.ox) < 0.05 && Math.abs(b.ovx) < 0.05) b.ox = b.ovx = 0;
    if (Math.abs(b.oy) < 0.05 && Math.abs(b.ovy) < 0.05) b.oy = b.ovy = 0;
  }
  for (const s of mini.bricksSparks) s.life -= dt;
  mini.bricksSparks = mini.bricksSparks.filter(s => s.life > 0);
  for (const p of mini.bricksPops) {
    p.life -= dt;
    p.y -= 26 * dt;
  }
  mini.bricksPops = mini.bricksPops.filter(p => p.life > 0);
}

// Nearest edge distance from a point to any live brick.
function bricksGap(x, y) {
  let best = Infinity;
  for (const t of mini.blocks) {
    if (t.hp <= 0) continue;
    const dx = Math.max(t.x - x, 0, x - t.x - t.w),
      dy = Math.max(t.y - y, 0, y - t.y - t.h);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

function updateVolley(dt) {
  mini.boardWait = Math.max(0, mini.boardWait - dt);
  bricksAnimate(dt);
  if (!mini.balls.length && !mini.queue) return;
  // Last-ball slow motion stretches the moment the final ball closes on the rack.
  let step = dt;
  if (mini.bricksSlowmo > 0) {
    mini.bricksSlowmo = Math.max(0, mini.bricksSlowmo - dt);
    step = dt * BRICKS_SLOWMO_RATE;
  }
  mini.shotClock += dt;
  mini.fireClock -= step;
  if (mini.combo > 0) {
    mini.bricksComboT -= step;
    if (mini.bricksComboT <= 0) mini.combo = 0;
  }
  if (mini.queue > 0 && mini.fireClock <= 0) {
    let { vx, vy } = mini.volleyVelocity;
    if (mini.volleyType === 'fan') {
      const a = Math.atan2(vy, vx) + ((mini.queue % 3) - 1) * 0.095,
        s = Math.hypot(vx, vy);
      vx = Math.cos(a) * s;
      vy = Math.sin(a) * s;
    }
    mini.balls.push({
      x: mini.anchor.x,
      y: mini.anchor.y,
      vx,
      vy,
      base: Math.hypot(vx, vy),
      age: 0,
      last: -1,
      cool: 0,
      hits: 0,
      banked: false,
      rubber: 0,
      trail: [],
      power: mini.volleyType === 'heavy' ? 3 : 1
    });
    mini.queue--;
    mini.fireClock = 0.075;
  }
  for (const b of mini.balls) {
    b.age += step;
    b.cool = Math.max(0, b.cool - step);
    b.rubber = Math.max(0, b.rubber - step);
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 8) b.trail.shift();
    // Rubber flings fade back toward the throw speed.
    const s = Math.hypot(b.vx, b.vy);
    if (s > b.base + 1) {
      const k = Math.max(b.base / s, Math.exp(-0.6 * step));
      b.vx *= k;
      b.vy *= k;
    }
    const ox = b.x,
      oy = b.y;
    b.x += b.vx * step;
    b.y += b.vy * step;
    if (b.x < 25 || b.x > 575) {
      b.x = clamp(b.x, 25, 575);
      b.vx *= -1;
      if (!b.hits) b.banked = true;
    }
    if (b.y < BRICKS_CEIL) {
      b.y = BRICKS_CEIL;
      b.vy = Math.abs(b.vy);
    }
    for (const t of mini.blocks) {
      if (t.hp <= 0 || (b.last === t.id && b.cool > 0)) continue;
      if (b.x > t.x - 7 && b.x < t.x + t.w + 7 && b.y > t.y - 7 && b.y < t.y + t.h + 7) {
        if (oy < t.y - 6 || oy > t.y + t.h + 6) {
          b.vy *= -1;
          b.y = oy;
        } else {
          b.vx *= -1;
          b.x = ox;
        }
        b.last = t.id;
        b.cool = 0.06;
        bricksHit(b, t);
        break;
      }
    }
    if (b.y > BRICKS_FLOOR && b.vy > 0) {
      b.dead = true;
      if (mini.returnX == null) mini.returnX = b.x;
    }
    if (b.age > 11) b.dead = true;
  }
  mini.balls = mini.balls.filter(b => !b.dead);
  const lastBall = !mini.queue && mini.balls.length === 1 ? mini.balls[0] : null;
  if (lastBall && !mini.bricksSlowUsed && lastBall.age > 0.3 && bricksGap(lastBall.x, lastBall.y) < 45) {
    mini.bricksSlowUsed = true;
    mini.bricksSlowmo = 0.8;
  }
  if (!mini.balls.length && !mini.queue) bricksEndVolley();
}

// Aim guide: level 1 traces the whole flight through the rack; later levels stop at the first bounce.
function bricksPreview(v) {
  const full = bricksLevel().fullPreview,
    pts = [],
    h = 1 / 60;
  let x = mini.anchor.x,
    y = mini.anchor.y,
    vx = v.vx,
    vy = v.vy,
    bounces = 0;
  for (let i = 0; i < 160; i++) {
    const ox = x,
      oy = y;
    let hit = false;
    x += vx * h;
    y += vy * h;
    if (x < 25 || x > 575) {
      x = clamp(x, 25, 575);
      vx *= -1;
      hit = true;
    }
    if (y < BRICKS_CEIL) {
      y = BRICKS_CEIL;
      vy = Math.abs(vy);
      hit = true;
    }
    for (const t of mini.blocks) {
      if (t.hp <= 0) continue;
      if (x > t.x - 7 && x < t.x + t.w + 7 && y > t.y - 7 && y < t.y + t.h + 7) {
        if (oy < t.y - 6 || oy > t.y + t.h + 6) {
          vy *= -1;
          y = oy;
        } else {
          vx *= -1;
          x = ox;
        }
        hit = true;
        break;
      }
    }
    if (y > BRICKS_FLOOR && vy > 0) break;
    if (hit) {
      bounces++;
      pts.push({ x, y, hit: true });
      if (!full || bounces >= 4) break;
    } else if (i % 3 === 0) pts.push({ x, y, hit: false });
  }
  return pts;
}

// ---- Art ----

function bricksCracks(g, b, level) {
  if (level <= 0) return;
  const cx = b.x + b.w / 2,
    s = b.id * 1.7;
  for (let n = 0; n < level; n++) {
    const sx = cx + Math.sin(s + n * 2.3) * b.w * 0.3,
      pts = [[sx, b.y + 2]];
    for (let k = 1; k <= 3; k++)
      pts.push([sx + Math.sin(s * 3 + k * 1.9 + n) * 9, b.y + (b.h * k) / 3.2]);
    line(g, pts, '#16303d99', 2);
    line(g, [pts[1], [pts[1][0] + 10 * (n ? -1 : 1), pts[1][1] + 6]], '#16303d77', 1.5);
  }
}

function bricksDrawBoss(g, b, x, y) {
  const guarded = bricksGuarded(b);
  for (let i = 0; i < 9; i++) rr(g, x + 6 + i * 36, y - 9, 22, 12, 3, '#8d93a8');
  rr(g, x, y, b.w, b.h, 8, gradient(g, x, y, 0, b.h, '#a9adc0', '#5f6479'), '#e9efdc66', 1.5);
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 8 - r; i++) rr(g, x + 6 + i * 41 + (r ? 20 : 0), y + 5 + r * 17, 34, 13, 3, '#7e8398');
  // Ralph peeks over the parapet; his health bar runs along the top of the wall.
  rr(g, x + b.w / 2 - 30, y + 2, 60, b.h - 4, 8, '#2a2f43');
  gremlin(g, x + b.w / 2, y + b.h - 1, 0.62, 1, time);
  rr(g, x + 20, y - 3, b.w - 40, 4, 2, '#2a2f43');
  rr(g, x + 20, y - 3, (b.w - 40) * (b.hp / b.maxHp), 4, 2, '#f3a4c6');
  if (guarded) {
    g.globalAlpha = 0.35 + Math.sin(time * 6) * 0.15;
    rr(g, x - 3, y - 3, b.w + 6, b.h + 6, 10, null, '#bfe3f2', 3);
    g.globalAlpha = 1;
    label(g, 'SHIELDED', x + 40, y + 26, 11, '#e8f6ff', 'center');
    label(g, 'SHIELDED', x + b.w - 40, y + 26, 11, '#e8f6ff', 'center');
  } else label(g, 'RALPH · ' + Math.ceil(b.hp), x + b.w - 52, y + 26, 13, '#ffe3ef', 'center');
}

function bricksDrawBlock(g, b) {
  const x = b.x + b.ox,
    y = b.y + b.oy,
    cx = x + b.w / 2;
  shadow(g, cx, y + b.h + 3, b.w * 0.45, 5);
  if (b.kind === 'boss') {
    bricksDrawBoss(g, b, x, y);
    if (b.flash > 0) rr(g, x, y, b.w, b.h, 8, '#ffffdc66');
    return;
  }
  const palette = {
      blast: ['#e79bb8', '#a86192'],
      extra: ['#e9cc86', '#a98a4f'],
      rubber: ['#8fd6e0', '#3f8fa3'],
      armor: ['#c3c9d6', '#6b7387'],
      gremlin: ['#b5da81', '#61967c'],
      nurse: ['#f6eef0', '#c9a3ad'],
      weak: ['#ff9dc8', '#b0457e']
    },
    col = palette[b.kind] || (b.maxHp > 2 ? ['#a8aecf', '#5c8997'] : ['#a4d5bf', '#5c8997']),
    squash = b.kind === 'rubber' && b.flash > 0 ? 3 : 0;
  rr(g, x - squash, y + squash, b.w + squash * 2, b.h - squash * 2, 9, gradient(g, x, y, 0, b.h, col[0], col[1]), '#e9efdc44', 1);
  for (let n = 0; n < 2; n++) ellipse(g, x + 21 + n * 34, y + 5, 9, 4, col[0]);
  const hp = String(Math.ceil(b.hp));
  if (b.kind === 'armor') {
    for (const [rx, ry] of [[7, 7], [b.w - 7, 7], [7, b.h - 7], [b.w - 7, b.h - 7]]) ellipse(g, x + rx, y + ry, 2.5, 2.5, '#eef2f8');
    for (let i = 0; i < 3; i++) rr(g, cx - 22 + i * 16, y + 15, 12, 13, 3, i < b.hp ? '#eef2f8' : '#4a5164');
    bricksCracks(g, { ...b, x, y }, 3 - b.hp);
  } else {
    bricksCracks(g, { ...b, x, y }, b.hp / b.maxHp < 0.34 ? 2 : b.hp / b.maxHp < 0.67 ? 1 : 0);
    if (b.kind === 'gremlin') {
      gremlin(g, cx - 12, y + b.h + 1, 0.5, 0, time + b.id);
      poly(g, b.dir > 0 ? [[x + b.w - 14, y + 13], [x + b.w - 5, y + 20], [x + b.w - 14, y + 27]] : [[x + 14, y + 13], [x + 5, y + 20], [x + 14, y + 27]], '#2d4f3f');
      label(g, hp, cx + 18, y + 28, 18, '#163b4c', 'center');
    } else if (b.kind === 'nurse') {
      const urgent = b.ring <= 1,
        ring = urgent ? Math.sin(time * 20) * 0.3 : 0;
      g.save();
      g.translate(cx - 16, y + 20);
      g.rotate(ring);
      path(
        g,
        p => {
          p.moveTo(-9, 7);
          p.quadraticCurveTo(-9, -11, 0, -11);
          p.quadraticCurveTo(9, -11, 9, 7);
          p.closePath();
        },
        urgent ? '#ef6f86' : '#e59aa9'
      );
      ellipse(g, 0, 9, 3, 3, '#7c3a4b');
      g.restore();
      rect(g, cx + 6, y + 9, 4, 14, '#e05a6e');
      rect(g, cx + 1, y + 14, 14, 4, '#e05a6e');
      for (let i = 0; i < 2; i++) ellipse(g, cx + 4 + i * 10, y + 32, 3, 3, i < b.ring ? '#e05a6e' : '#d8c5ca');
      label(g, hp, x + b.w - 12, y + 18, 13, '#7c3a4b', 'center');
      if (urgent) glow(g, cx, y + b.h / 2, 55, '#ef6f8633');
    } else if (b.kind === 'weak') {
      const pulse = 1 + Math.sin(time * 7) * 0.12;
      glow(g, cx, y + b.h / 2, 45 * pulse, '#ff9dc844');
      ellipse(g, cx, y + b.h / 2, 13 * pulse, 13 * pulse, '#fff0f6');
      ellipse(g, cx, y + b.h / 2, 8 * pulse, 8 * pulse, '#d6337a');
      label(g, hp, cx, y + b.h / 2 + 5, 13, '#fff0f6', 'center');
    } else {
      if (b.kind === 'rubber')
        for (let i = 0; i < 3; i++) line(g, [[x + 8, y + 12 + i * 9], [x + 22, y + 9 + i * 9], [x + 36, y + 12 + i * 9]], '#e6fbff66', 2);
      label(
        g,
        b.kind === 'blast' ? '✹ ' + hp : b.kind === 'extra' ? '★ ' + hp : hp,
        cx + (b.kind === 'rubber' ? 12 : 0),
        y + 28,
        20,
        '#163b4c',
        'center'
      );
    }
  }
  if (b.flash > 0) rr(g, x, y, b.w, b.h, 9, '#ffffdc88');
}

function bricksDrawAim(g) {
  if (!mini.aim) return;
  const v = volleyVector();
  if (!v) return;
  const pts = bricksPreview(v);
  pts.forEach((p, i) => {
    if (p.hit) {
      g.strokeStyle = '#fff1bd';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, 7, 0, Math.PI * 2);
      g.stroke();
    } else ellipse(g, p.x, p.y, 3, 3, '#fff1bd' + (i < 14 ? 'cc' : '66'));
  });
  line(g, [[mini.anchor.x, mini.anchor.y], [mini.aim.x, mini.aim.y]], '#e5c395', 3);
  rr(g, 35, 561, 110, 7, 3, '#26495a');
  rr(g, 35, 561, 110 * v.power, 7, 3, '#e8c98a');
  label(g, 'THROW POWER', 35, 588, 10, '#c1d3cf');
}

function bricksDrawBalls(g) {
  for (const b of mini.balls) {
    const big = b.power > 1 ? 9 : 7,
      tint = b.rubber > 0 ? '#8fd6e0' : b.banked && !b.hits ? '#ffe39a' : '#f9e6ac';
    for (let i = 0; i < b.trail.length; i++) {
      const p = b.trail[i],
        k = (i + 1) / b.trail.length;
      g.globalAlpha = k * 0.35;
      ellipse(g, p.x, p.y, big * k, big * k, tint);
    }
    g.globalAlpha = 1;
    softball(g, b.x, b.y, big);
  }
}

function bricksDraw(g) {
  const shake = mini.bricksShake > 0 ? mini.bricksShake * 14 : 0;
  g.save();
  if (shake) g.translate(Math.sin(mini.total * 83) * shake, Math.cos(mini.total * 71) * shake * 0.6);
  rr(g, 20, 45, 560, 466, 20, '#172e43', '#b7cbd533', 2);
  for (let i = 0; i <= BRICKS_COLS; i++) {
    const x = BRICKS_X0 - 4.5 + i * BRICKS_PITCH;
    line(g, [[x, 53], [x, 500]], '#cad9db0c', 1);
  }
  const lurch = mini.bricksLurch > 0;
  g.setLineDash([8, 8]);
  line(g, [[28, BRICKS_LINE], [572, BRICKS_LINE]], lurch ? '#ff7fa3' : '#e49bb2', lurch ? 3 : 2);
  g.setLineDash([]);
  label(g, 'DO NOT CROSS', 300, 500, 10, '#f3a8bf', 'center');
  // Danger glow when the lowest brick is one row from the line.
  const low = mini.blocks.reduce((m, b) => (b.hp > 0 ? Math.max(m, b.y + b.h) : m), 0);
  if (low + BRICKS_ROW >= BRICKS_LINE) glow(g, 300, BRICKS_LINE, 230, '#ff7fa322');
  for (const b of mini.blocks) if (b.hp > 0) bricksDrawBlock(g, b);
  bricksDrawAim(g);
  bricksDrawBalls(g);
  for (const s of mini.bricksSparks) {
    const k = s.life / s.max;
    g.globalAlpha = k;
    g.strokeStyle = s.col;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(s.x, s.y, 4 + s.r * (1 - k), 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  for (const p of mini.bricksPops) {
    g.globalAlpha = Math.min(1, p.life * 2.5);
    label(g, p.text, p.x, p.y, 13, p.col, 'center');
  }
  g.globalAlpha = 1;
  g.restore();
  if (mini.bricksSlowmo > 0) {
    g.globalAlpha = Math.min(1, mini.bricksSlowmo * 3);
    rect(g, 0, 0, 600, 600, '#0b1a2a44');
    label(g, 'SLOW-MO', 560, 540, 14, '#bfe3f2', 'right');
    g.globalAlpha = 1;
  }
  if (mini.combo > 1 && (mini.balls.length || mini.queue)) {
    const mult = bricksMult();
    rr(g, 26, 518, 128, 40, 12, '#102b40dd', mult > 1 ? '#ffe39a88' : '#b7cbd544', 1);
    label(g, 'COMBO ' + mini.combo, 38, 535, 12, '#d3e4d9');
    label(g, '×' + mult.toFixed(1), 144, 550, 16, mult > 1 ? '#ffe39a' : '#d3e4d9', 'right');
    rect(g, 38, 545, 60 * clamp(mini.bricksComboT / BRICKS_COMBO_GAP, 0, 1), 3, '#ffe39a');
  }
  if (!mini.balls.length && !mini.queue) {
    glow(g, mini.anchor.x, mini.anchor.y, 35, '#ffe4aa30');
    softball(g, mini.anchor.x, mini.anchor.y, 13);
    label(
      g,
      mini.aim
        ? 'RELEASE TO THROW'
        : mini.throwStyle === 'flick'
          ? 'FLICK UPWARD FROM THE BALL'
          : 'PULL BACK FROM THE BALL',
      300,
      588,
      12,
      '#f2dba7',
      'center'
    );
  } else {
    label(g, 'VOLLEY ' + mini.shot + ' / ' + mini.volleys, 300, 585, 13, '#d3e4d9', 'center');
    if (mini.shotClock > 1.2)
      label(g, 'RECALL skips the remaining bounces', 300, 562, 10, '#a9c6ca', 'center');
  }
}
