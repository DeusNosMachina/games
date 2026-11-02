// Brick Rebellion (family lounge). Aim softball volleys at descending bricks before they cross
// the red line. Shifts escalate by volley count, not time. Canvas 600 × 600.
const BRICKS = registerGame({
  id: 2,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Brick Rebellion',
    genre: 'AIM · RICOCHET · CHAIN REACTIONS',
    headline: 'One softball. Several bad decisions.',
    desc: 'Pull back from the ball and release a volley into the brick infestation. Bank shots off the walls, crack armor, and set off pink chain reactions. Choose heavy or fan shots carefully: supplies are limited.',
    goal: 'Break the block quota and survive every volley.',
    control:
      'PULL AIM: drag back from the glowing ball, then release. FLICK AIM: flick the ball upward; a faster flick throws harder. Bank off walls. Choose HEAVY or FAN before a shot.',
    avoid:
      'After each volley the bricks descend. Don’t let them cross the red line. Pink blocks explode; starred blocks add a ball.',
    cue: 'PULL = drag back · FLICK = swipe forward · bank shots clear more'
  },
  tierNotes: [
    '12 volleys · ricochets · explosive blocks',
    '15 volleys · armor · faster descent',
    '18 volleys · more armor · tighter ammo'
  ],
  init() {
    initArcadeRun(240);
    mini.goal = 35 + mini.tier * 13;
    mini.volleys = 12 + mini.tier * 3;
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
    mini.heavy = 2;
    mini.fan = 2;
    mini.blocks = [];
    mini.blockSerial = 0;
    mini.boardWait = 0;
    for (let r = 0; r < 3; r++) addBrickRow(86 + r * 53, r);
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
    drawVolley(g);
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
    }
    if (
      ['normal', 'heavy', 'fan'].includes(a) &&
      mini.balls.length === 0 &&
      mini.queue === 0 &&
      (a === 'normal' || mini[a] > 0)
    ) {
      mini.shotType = a;
      BRICKS.controls();
    }
    if (a === 'recall' && mini.shotClock > 1.2 && mini.balls.length) {
      mini.balls = [];
      mini.queue = 0;
      endVolley();
    }
  },
  assist() {
    mini.slow = 5;
    for (const b of mini.blocks) b.y = Math.max(78, b.y - 38);
    for (const b of mini.blocks) b.hp = Math.max(1, b.hp - 1);
    mini.flash = 1;
    mini.flashText = 'BRICKS PUSHED BACK';
  },
  key(k, e) {
    if (e.repeat) return true;
    const action = { 1: 'normal', 2: 'heavy', 3: 'fan', ' ': 'recall' }[k];
    if (action) miniAction(action);
    return true;
  },
  shiftName: 'RACK',
  shiftLevel: () => Math.min(2, Math.floor(mini.shot / (mini.volleys / 3))),
  // The clock is only a ceiling here: running out of time never wins.
  timeUp() {
    finishMini(false, mini.got >= mini.goal ? undefined : ARCADE_QUOTA_MISSED);
  },
  lesson() {
    const i = BRICKS.info;
    return {
      title: i.game + ' · ' + mini.volleys + ' volleys',
      goal: i.goal + ' Target: ' + mini.goal + '.',
      control: i.control,
      avoid: i.avoid,
      demo: 'aim',
      cue: i.cue
    };
  },
  statLabel: () => 'BLOCKS / VOLLEYS',
  stat: () => mini.got + '/' + mini.goal + ' · ' + mini.shot + '/' + mini.volleys,
  livesLabel: () => 'SPECIAL SHOTS',
  lives: () => mini.heavy + ' heavy · ' + mini.fan + ' fan',
  tactics: () => 'SCORE ' + mini.score + ' · BEST CHAIN ' + mini.maxCombo + ' · ' + mini.helps + ' ASSISTS',
  assistText: () => 'PUSH BACK · ' + mini.helps + ' (E)',
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#605274', '#193b4e'));
    for (let r = 0; r < 3; r++)
      for (let col = 0; col < 5; col++) {
        rr(g, 72 + col * 57, 42 + r * 33, 50, 27, 7, (r + col) % 4 === 0 ? '#d99db9' : '#aed1bf');
        label(g, String(((r + col) % 3) + 1), 97 + col * 57, 62 + r * 33, 13, '#315b66', 'center');
      }
    for (let i = 0; i < 8; i++) ellipse(g, 215 + i * 12, 195 - i * 12, 3, 3, '#f6dfaf');
    softball(g, 210, 200, 12);
    label(g, BRICKS.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

function addBrickRow(y, round) {
  const empty = Math.floor(rand(0, 6));
  for (let col = 0; col < 6; col++) {
    if (col === empty || (round === 0 && col === 5)) continue;
    const id = mini.blockSerial++,
      hp = 2 + Math.floor(rand(0, 3 + mini.tier)) + (mini.shot > 6 ? 1 : 0);
    mini.blocks.push({
      id,
      x: 46 + col * 85,
      y,
      w: 76,
      h: 43,
      hp,
      maxHp: hp,
      kind: id % 9 === 3 ? 'blast' : id % 11 === 5 ? 'extra' : 'plain',
      flash: 0
    });
  }
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
  mini.quality -= 0;
  mini.shotType = 'normal';
  BRICKS.controls();
  tone(300, 0.1);
}

function strikeBlock(b, power) {
  if (b.hp <= 0) return;
  b.hp -= power;
  b.flash = 0.15;
  if (b.hp <= 0) {
    mini.got++;
    praise(80);
    arcadeBurst(b.x + b.w / 2, b.y + b.h / 2, b.kind === 'blast' ? '#f3a4c6' : '#eed5a3', 8);
    if (b.kind === 'extra') {
      mini.ballCount = Math.min(18, mini.ballCount + 1);
      mini.flash = 0.7;
      mini.flashText = 'EXTRA BALL · ' + mini.ballCount + ' PER VOLLEY';
    }
    if (b.kind === 'blast') {
      for (const n of mini.blocks)
        if (n !== b && n.hp > 0 && Math.hypot(n.x - b.x, n.y - b.y) < 115) strikeBlock(n, 2);
    }
  }
  tone(240 + Math.min(10, mini.combo) * 25, 0.025, 'sine', 0.018);
}

function endVolley() {
  mini.blocks = mini.blocks.filter(b => b.hp > 0);
  if (mini.shot >= mini.volleys) {
    finishMini(
      mini.got >= mini.goal,
      mini.got >= mini.goal
        ? undefined
        : 'Volley budget spent. Bank shots and pink chain reactions clear more blocks.'
    );
    return;
  }
  for (const b of mini.blocks) b.y += 29 + mini.tier * 3;
  if (mini.blocks.some(b => b.y + b.h >= 505)) {
    finishMini(false, 'The bricks crossed the red line. Aim for the lowest blocks before they descend.');
    return;
  }
  addBrickRow(86, mini.shot);
  mini.anchor.x = clamp(mini.returnX ?? 300, 55, 545);
  mini.returnX = null;
  mini.boardWait = 0.65;
  BRICKS.controls();
}

function updateVolley(dt) {
  mini.boardWait = Math.max(0, mini.boardWait - dt);
  for (const b of mini.blocks) b.flash = Math.max(0, b.flash - dt);
  if (!mini.balls.length && !mini.queue) return;
  mini.shotClock += dt;
  mini.fireClock -= dt;
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
      age: 0,
      last: -1,
      cool: 0,
      power: mini.volleyType === 'heavy' ? 3 : 1
    });
    mini.queue--;
    mini.fireClock = 0.075;
  }
  for (const b of mini.balls) {
    b.age += dt;
    b.cool = Math.max(0, b.cool - dt);
    const ox = b.x,
      oy = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 25 || b.x > 575) {
      b.x = clamp(b.x, 25, 575);
      b.vx *= -1;
    }
    if (b.y < 52) {
      b.y = 52;
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
        strikeBlock(t, b.power);
        break;
      }
    }
    if (b.y > 553 && b.vy > 0) {
      b.dead = true;
      if (mini.returnX == null) mini.returnX = b.x;
    }
    if (b.age > 11) b.dead = true;
  }
  mini.balls = mini.balls.filter(b => !b.dead);
  if (!mini.balls.length && !mini.queue) endVolley();
}

function drawVolley(g) {
  rr(g, 20, 45, 560, 466, 20, '#172e43', '#b7cbd533', 2);
  for (let x = 45; x < 580; x += 85)
    line(g, [[x, 53], [x, 500]], '#cad9db0c', 1);
  g.setLineDash([8, 8]);
  line(g, [[28, 505], [572, 505]], '#e49bb2', 2);
  g.setLineDash([]);
  label(g, 'DO NOT CROSS', 300, 500, 10, '#f3a8bf', 'center');
  for (const b of mini.blocks) {
    if (b.hp <= 0) continue;
    const color =
      b.kind === 'blast' ? '#e79bb8' : b.kind === 'extra' ? '#e9cc86' : b.maxHp > 2 ? '#a8aecf' : '#a4d5bf';
    shadow(g, b.x + b.w / 2, b.y + b.h + 3, b.w * 0.45, 5);
    rr(
      g,
      b.x,
      b.y,
      b.w,
      b.h,
      9,
      gradient(g, b.x, b.y, 0, b.h, color, b.kind === 'blast' ? '#a86192' : '#5c8997'),
      '#e9efdc44',
      1
    );
    for (let n = 0; n < 2; n++) ellipse(g, b.x + 21 + n * 34, b.y + 5, 9, 4, color);
    if (b.flash > 0) rr(g, b.x, b.y, b.w, b.h, 9, '#ffffdc88');
    label(
      g,
      b.kind === 'blast' ? '✹ ' + b.hp : b.kind === 'extra' ? '★ ' + b.hp : String(b.hp),
      b.x + b.w / 2,
      b.y + 29,
      20,
      '#163b4c',
      'center'
    );
  }
  if (mini.aim) {
    const v = volleyVector();
    if (v) {
      let x = mini.anchor.x,
        y = mini.anchor.y,
        dx = v.vx * 0.055,
        dy = v.vy * 0.055;
      for (let i = 0; i < 27; i++) {
        x += dx;
        y += dy;
        if (x < 25 || x > 575) {
          x = clamp(x, 25, 575);
          dx *= -1;
        }
        if (y < 50) {
          y = 50;
          dy *= -1;
        }
        if (y > 555) break;
        ellipse(g, x, y, 3, 3, '#fff1bd' + (i < 12 ? 'cc' : '66'));
      }
      line(g, [[mini.anchor.x, mini.anchor.y], [mini.aim.x, mini.aim.y]], '#e5c395', 3);
      rr(g, 35, 561, 110, 7, 3, '#26495a');
      rr(g, 35, 561, 110 * v.power, 7, 3, '#e8c98a');
      label(g, 'THROW POWER', 35, 588, 10, '#c1d3cf');
    }
  }
  for (const b of mini.balls) {
    ellipse(g, b.x - b.vx * 0.012, b.y - b.vy * 0.012, b.power > 1 ? 9 : 7, b.power > 1 ? 9 : 7, '#f9e6ac33');
    softball(g, b.x, b.y, b.power > 1 ? 9 : 7);
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
