// Gel Yeah! (ultrasound). Swipe through airborne gel gremlins; three or more per stroke build
// combos and gel fever. Helmets need a second stroke, blue gremlins split, pink bombs hurt. Canvas 600 × 600.
const SLICE = registerGame({
  id: 4,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Gel Yeah!',
    genre: 'FLICK · SWIPE COMBOS · RISK / REWARD',
    headline: 'A very questionable fruit salad.',
    desc: 'Slice airborne gel gremlins in one clean swipe. Three or more in a stroke builds a combo. Silver helmets need two separate swipes; blue gremlins split. Pink gunk bombs ruin everything. Three escalating waves, one unbroken run.',
    goal: 'Slice the gremlin quota and survive the full shift.',
    control:
      'Press and swipe through gremlins. Lift to bank a combo. Slice three or more in one stroke for bonus points and slow-motion fever.',
    avoid:
      'Avoid pink X bombs. Helmeted gremlins need a second stroke. Blue gremlins split into two. Six escaped gremlins cost an oops.',
    cue: 'Swipe green · lift to bank combos · avoid pink X · re-swipe helmets'
  },
  tierNotes: [
    '90s · swipe combos · three waves',
    '105s · earlier armor & splitting',
    '120s · fast arcs · mixed formations'
  ],
  init() {
    initArcadeRun(90 + mini.tier * 15);
    mini.goal = 45 + mini.tier * 15;
    mini.gels = [];
    mini.gelSerial = 0;
    mini.spawn = 0.5;
    mini.strokes = 0;
    mini.cutCount = 0;
    mini.escaped = 0;
    mini.fever = 0;
    mini.feverMeter = 0;
    mini.strokeHits = 0;
  },
  controls() {
    setControls([]);
  },
  update(dt) {
    updateArcade(dt, updateSlice);
  },
  draw(g) {
    arcadeBackdrop(g, '#20534e', '#9bddb924', 'ULTRASOUND / GEL EVERYWHERE');
    drawSlice(g);
  },
  down(p) {
    mini.strokeHits = 0;
    mini.strokes++;
    sliceSegment(p, p);
  },
  move(p, prev) {
    sliceSegment(prev, p);
  },
  // Lifting the finger banks the stroke: 3+ hits score a combo and feed gel fever.
  up(cancel) {
    if (mini.pointer && !cancel && mini.screen === 'play' && !mini.paused) {
      const n = mini.strokeHits;
      if (n >= 3) {
        mini.score += n * 25;
        mini.feverMeter += n;
        mini.flash = 0.7;
        mini.flashText = n + ' IN ONE SWIPE · +' + n * 25;
        mini.maxCombo = Math.max(mini.maxCombo, n);
        tone(540 + n * 30, 0.12);
      }
      if (mini.feverMeter >= 12) {
        mini.fever = 4;
        mini.feverMeter = 0;
        mini.flash = 1;
        mini.flashText = 'GEL FEVER · SLOW MOTION · DOUBLE POINTS';
      }
    }
  },
  assist() {
    mini.slow = 5;
    mini.gels = mini.gels.filter(o => !o.bomb);
    mini.flash = 1;
    mini.flashText = 'BOMBS CLEARED · SLOW MOTION';
  },
  shiftMessage: shift =>
    shift === 1
      ? 'WAVE 2 · helmets need TWO separate swipes.'
      : 'FINAL WAVE · blue gremlins split. Slice the halves.',
  lesson() {
    const i = SLICE.info;
    return {
      title: i.game + ' · ' + mini.limit + ' second shift',
      goal: i.goal + ' Target: ' + mini.goal + '.',
      control: i.control,
      avoid: i.avoid,
      demo: 'slice',
      cue: i.cue
    };
  },
  statLabel: () => 'SLICES / WAVE',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () => 'SCORE ' + mini.score + ' · BEST CHAIN ' + mini.maxCombo + ' · ' + mini.helps + ' ASSISTS',
  assistText: () => 'GEL FREEZE · ' + mini.helps + ' (E)',
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#316b61', '#193b4e'));
    for (let i = 0; i < 4; i++)
      gremlin(g, 100 + i * 77, 125 + Math.sin(i) * 38, 1.3, i === 3 ? 3 : 0, time + i);
    path(
      g,
      p => {
        p.moveTo(50, 170);
        p.quadraticCurveTo(170, 60, 355, 150);
      },
      null,
      '#f4edc7',
      5
    );
    label(g, SLICE.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

function spawnGelWave() {
  const count = 3 + Math.floor(rand(0, 3)) + mini.shift;
  for (let i = 0; i < count; i++) {
    const x = rand(85, 515),
      id = mini.gelSerial++,
      armor = mini.shift + mini.tier > 1 && id % 6 === 0,
      split = mini.shift + mini.tier > 2 && id % 7 === 0;
    mini.gels.push({
      id,
      x,
      y: 620 + rand(0, 70),
      vx: (300 - x) * rand(0.25, 0.65),
      vy: -rand(580, 740),
      r: armor ? 29 : 27,
      hp: armor ? 2 : 1,
      bomb: false,
      armor,
      split,
      stroke: -1,
      angle: rand(-1, 1),
      spin: rand(-2, 2),
      entered: false
    });
  }
  if (mini.gelSerial > 6) {
    mini.gels.push({
      id: mini.gelSerial++,
      x: rand(80, 520),
      y: 660,
      vx: rand(-45, 45),
      vy: -rand(600, 710),
      r: 28,
      hp: 1,
      bomb: true,
      stroke: -1,
      angle: 0,
      spin: 1,
      entered: false
    });
  }
}

function pointSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function sliceSegment(a, b) {
  if (!mini.pointer) return;
  mini.trail.push({ ...b, life: 0.23 });
  for (const o of [...mini.gels]) {
    if (o.dead || o.y > 590 || o.stroke === mini.pointer.stroke || pointSegment(o, a, b) > o.r + 5) continue;
    o.stroke = mini.pointer.stroke;
    if (o.bomb) {
      o.dead = true;
      mini.strokeHits = 0;
      mini.feverMeter = 0;
      miniOops('PINK GUNK BOMB · KEEP YOUR SWIPE CLEAN');
      arcadeBurst(o.x, o.y, '#ec86b0', 25);
      continue;
    }
    o.hp--;
    arcadeBurst(o.x, o.y, o.split ? '#a3ddff' : '#b5e8b0', 10);
    if (o.hp > 0) {
      mini.flash = 0.5;
      mini.flashText = 'HELMET CRACKED · LIFT, THEN SWIPE AGAIN';
      o.armor = false;
      tone(280, 0.06);
      continue;
    }
    o.dead = true;
    if (o.split) {
      for (const sign of [-1, 1])
        mini.gels.push({
          id: mini.gelSerial++,
          x: o.x + sign * 18,
          y: o.y,
          vx: o.vx + sign * 110,
          vy: -280,
          r: 20,
          hp: 1,
          bomb: false,
          armor: false,
          split: false,
          stroke: mini.pointer.stroke,
          angle: 0,
          spin: sign * 3,
          entered: true
        });
      mini.flash = 0.5;
      mini.flashText = 'BLUE SPLITS · GET BOTH HALVES';
    }
    mini.got++;
    mini.strokeHits++;
    mini.cutCount++;
    praise(mini.fever > 0 ? 70 : 35);
    tone(500 + Math.min(mini.strokeHits, 8) * 60, 0.04);
  }
}

function updateSlice(dt) {
  mini.fever = Math.max(0, mini.fever - dt);
  const step = dt * (mini.fever > 0 || mini.slow > 0 ? 0.55 : 1);
  mini.spawn -= dt;
  if (mini.spawn <= 0 && mini.limit - mini.phaseTime > 2.6) {
    spawnGelWave();
    mini.spawn = (2.65 - mini.shift * 0.25 - mini.tier * 0.12) / mini.rules.mini;
  }
  for (const o of mini.gels) {
    o.vy += 650 * step;
    o.x += o.vx * step;
    o.y += o.vy * step;
    o.angle += o.spin * step;
    if (o.y < 580) o.entered = true;
    if (o.y > 680 && o.entered) {
      o.dead = true;
      if (!o.bomb) {
        mini.escaped++;
        mini.combo = 0;
        if (mini.escaped % 6 === 0) miniOops('SIX ESCAPED · SMALLER, CLEANER SWIPES');
      }
    }
    if (o.x < 25 || o.x > 575) {
      o.x = clamp(o.x, 25, 575);
      o.vx *= -0.8;
    }
  }
  mini.gels = mini.gels.filter(o => !o.dead);
}

function drawSlice(g) {
  ellipse(g, 300, 332, 257, 257, '#0b313d');
  for (let r = 1; r <= 4; r++) {
    g.strokeStyle = '#77bba527';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(300, 332, r * 60, 0, Math.PI * 2);
    g.stroke();
  }
  line(g, [[300, 65], [300, 590]], '#a6e0bf18', 1);
  line(g, [[30, 332], [570, 332]], '#a6e0bf18', 1);
  for (const o of mini.gels) {
    g.save();
    g.translate(o.x, o.y);
    g.rotate(o.angle);
    if (o.bomb) {
      glow(g, 0, 0, 43, '#ef7dba24');
      ellipse(g, 0, 0, o.r, o.r, gradient(g, -22, -22, 44, 44, '#f2b1cf', '#bd507e'));
      label(g, '×', 0, 13, 40, '#612443', 'center');
      line(g, [[13, -22], [20, -33]], '#d7c7a6', 3);
      spark(g, 21, -35, '#ffd39c', 0.5);
    } else {
      gremlin(g, 0, 24, o.r / 23, o.split ? 3 : 0, mini.total + o.id);
      if (o.armor) {
        rr(g, -25, -32, 50, 20, 9, gradient(g, -20, -32, 40, 20, '#e7ecdf', '#8eabbc'), '#d8ebdf', 2);
        line(g, [[-15, -25], [15, -25]], '#65848e', 2);
      }
    }
    g.restore();
  }
  if (mini.trail.length > 1) {
    g.lineCap = 'round';
    for (let i = 1; i < mini.trail.length; i++) {
      const a = mini.trail[i - 1],
        b = mini.trail[i];
      g.globalAlpha = Math.min(a.life / 0.23, 1);
      line(g, [[a.x, a.y], [b.x, b.y]], mini.fever > 0 ? '#ffe8a0' : '#b5edd8', 10);
      line(g, [[a.x, a.y], [b.x, b.y]], '#fffae8', 3);
    }
    g.globalAlpha = 1;
  }
  rr(g, 170, 567, 260, 9, 4, '#31575b');
  rr(
    g,
    170,
    567,
    260 * (mini.fever > 0 ? mini.fever / 4 : mini.feverMeter / 12),
    9,
    4,
    mini.fever > 0 ? '#f1ce7e' : '#9dd8b6'
  );
  label(
    g,
    mini.fever > 0 ? 'GEL FEVER · DOUBLE POINTS' : '3+ PER SWIPE BUILDS GEL FEVER',
    300,
    593,
    11,
    '#d7e6c9',
    'center'
  );
  label(g, 'ESCAPED ' + (mini.escaped % 6) + ' / 6', 576, 55, 11, '#b8d9c9', 'right');
}
