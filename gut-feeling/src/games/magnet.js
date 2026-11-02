// Polarity Panic (MRI room). Drag a magnet to push and pull drifting nutrients into matching
// ports and sweep pink gunk into the floor vent. Canvas 600 × 600.
const MAGNET = registerGame({
  id: 1,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Polarity Panic',
    genre: 'MAGNETS · PUSH / PULL · PHYSICS',
    headline: 'Opposites attract. Gremlins complain.',
    desc: 'Steer drifting nutrients into matching collection ports with a movable magnet. Pull them toward your finger, switch polarity to push, then release to let them coast. Three escalating shifts add moving hazards.',
    goal: 'Sort the nutrient quota before the shift ends.',
    control:
      'Drag anywhere to move the magnet. Hold to apply force; release to coast. Tap PULL / PUSH (Space) to change polarity.',
    avoid:
      'Mint circles go left; gold diamonds go right. Wrong colors bounce back and cost style. Push pink gunk into the bottom disposal vent. Momentum matters.',
    cue: 'Drag magnet · hold = force · release = coast · Space flips polarity'
  },
  tierNotes: [
    '105s · two ports · magnet momentum',
    '120s · moving field · more contamination',
    '135s · cross-current · tighter ports'
  ],
  init() {
    initArcadeRun(105 + mini.tier * 15);
    mini.goal = 12 + mini.tier * 4;
    mini.magnet = { x: 300, y: 360, on: false, mode: 1 };
    mini.sortErrors = 0;
    mini.orbs = [];
    mini.orbSerial = 0;
    for (let i = 0; i < 7; i++) spawnOrb(false, i);
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
    drawMagnet(g);
  },
  down(p) {
    Object.assign(mini.magnet, { x: p.x, y: p.y, on: true });
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
      tone(mini.magnet.mode === 1 ? 380 : 570, 0.07);
    }
  },
  assist() {
    mini.slow = 5;
    mini.orbs = mini.orbs.filter(o => !o.bad);
    mini.flash = 1;
    mini.flashText = 'FIELD STABILIZED';
  },
  key(k, e) {
    if (e.repeat) return true;
    if (k === ' ') miniAction('polarity');
    return true;
  },
  shiftMessage: shift => 'SHIFT ' + (shift + 1) + ' · currents are stronger. Keep sorting.',
  lesson() {
    const i = MAGNET.info;
    return {
      title: i.game + ' · ' + mini.limit + ' second shift',
      goal: i.goal + ' Target: ' + mini.goal + '.',
      control: i.control,
      avoid: i.avoid,
      demo: 'magnet',
      cue: i.cue
    };
  },
  statLabel: () => 'SORTED / SHIFT',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () => 'SCORE ' + mini.score + ' · BEST CHAIN ' + mini.maxCombo + ' · ' + mini.helps + ' ASSISTS',
  assistText: () => 'STABILIZE · ' + mini.helps + ' (E)',
  // Wrong-port bounces cost a little style.
  quality: () => arcadeQuality((mini.sortErrors || 0) * 1.2),
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#336a7c', '#193b4e'));
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 61,
        y = 92 + Math.sin(i) * 32;
      ellipse(g, x, y, 15, 15, i % 2 ? '#eaca8b' : '#a8dec0');
    }
    line(g, [[173, 150], [173, 181], [247, 181], [247, 150]], '#b9dfd4', 16);
    line(g, [[173, 135], [173, 151]], '#eda7b1', 16);
    line(g, [[247, 135], [247, 151]], '#eccb89', 16);
    label(g, MAGNET.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

function spawnOrb(bad = false, offset = 0) {
  const id = mini.orbSerial++;
  mini.orbs.push({
    id,
    x: 90 + ((id * 83) % 420),
    y: 330 + (offset % 3) * 75,
    vx: rand(-20, 20),
    vy: rand(-15, 15),
    kind: id % 2,
    bad,
    touched: false,
    r: bad ? 20 : 19,
    cool: 0
  });
}

function updateMagnet(dt) {
  const m = mini.magnet,
    rate = mini.slow > 0 ? 0.55 : 1,
    gate = mini.tier === 2 ? 53 : 68;
  for (const o of mini.orbs) {
    const dx = m.x - o.x,
      dy = m.y - o.y,
      d = Math.hypot(dx, dy);
    o.cool = Math.max(0, o.cool - dt);
    if (m.on && d < 170 && d > 8) {
      const f = (1 - d / 180) * 1150 * m.mode;
      o.vx += (dx / d) * f * dt;
      o.vy += (dy / d) * f * dt;
      o.touched = true;
    }
    // Moving scan currents arrive during later shifts; the force is visible on the board.
    if (mini.shift > 0 && mini.slow <= 0) {
      o.vx += Math.sin(mini.total * 0.7 + o.y * 0.012) * mini.shift * (20 + mini.tier * 8) * dt;
    }
    const speed = Math.hypot(o.vx, o.vy),
      cap = 390;
    if (speed > cap) {
      o.vx *= cap / speed;
      o.vy *= cap / speed;
    }
    o.vx *= Math.exp(-1.15 * dt);
    o.vy *= Math.exp(-1.15 * dt);
    o.x += o.vx * dt * rate;
    o.y += o.vy * dt * rate;
    if (o.x < 30 || o.x > 570) {
      o.x = clamp(o.x, 30, 570);
      o.vx *= -0.7;
    }
    if (o.y > 564) {
      if (o.bad && o.touched && Math.abs(o.x - 300) < 65) {
        o.dead = true;
        arcadeBurst(o.x, o.y, '#d0e8ca', 8);
      } else {
        o.y = 564;
        o.vy *= -0.65;
      }
    }
    if (o.y < 96 && o.cool <= 0) {
      const port = Math.abs(o.x - 135) < gate ? 0 : Math.abs(o.x - 465) < gate ? 1 : -1;
      if (port >= 0 && o.touched) {
        if (!o.bad && o.kind === port) {
          mini.got++;
          praise(140, 1);
          arcadeBurst(o.x, o.y, port ? '#ffe09b' : '#b5e8c5');
          tone(600 + port * 100, 0.08);
        } else if (o.bad) {
          miniOops('GUNK IN THE COLLECTION PORT');
          o.dead = true;
        } else {
          mini.sortErrors++;
          mini.combo = 0;
          mini.flash = 0.8;
          mini.flashText = 'WRONG COLOR · BOUNCED BACK';
          o.y = 112;
          o.vy = 150;
          o.vx = (300 - o.x) * 0.7;
          o.cool = 1.2;
        }
        if (!o.bad && o.kind === port) o.dead = true;
      } else {
        o.y = 96;
        o.vy = Math.abs(o.vy) * 0.65;
        o.cool = 0.3;
      }
    }
  }
  // Soft collisions transfer momentum, so a push can move a whole cluster.
  for (let i = 0; i < mini.orbs.length; i++)
    for (let j = i + 1; j < mini.orbs.length; j++) {
      const a = mini.orbs[i],
        b = mini.orbs[j],
        d = dist(a, b),
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
  while (mini.orbs.length < 7 + mini.shift)
    spawnOrb(mini.shift > 0 && mini.orbSerial % 7 === 0 && mini.orbs.filter(o => o.bad).length < 2);
}

function drawMagnet(g) {
  const gate = mini.tier === 2 ? 53 : 68;
  for (let i = 0; i < 2; i++) {
    const x = i ? 465 : 135,
      col = i ? '#f1cf85' : '#b2e5c2';
    rr(g, x - gate, 48, gate * 2, 62, 17, gradient(g, x, 48, 0, 62, '#163846', '#102934'), col, 2);
    glow(g, x, 76, 65, col + '25');
    if (i)
      poly(g, [[x, 56], [x + 12, 72], [x, 88], [x - 12, 72]], col);
    else ellipse(g, x, 72, 12, 12, col);
    label(g, i ? 'GOLD DIAMONDS' : 'MINT CIRCLES', x, 101, 10, col, 'center');
  }
  for (let i = 0; i < 7; i++) {
    const y = 145 + i * 57,
      x = 300 + Math.sin(mini.total * 0.7 + y * 0.012) * 80;
    line(g, [[x - 28, y], [x + 28, y]], mini.shift ? '#b8d9c92d' : '#b8d9c90b', 2);
    if (mini.shift) poly(g, [[x + 22, y - 5], [x + 30, y], [x + 22, y + 5]], '#b8d9c944');
  }
  const m = mini.magnet;
  if (m.on) {
    for (let r = 1; r <= 3; r++) {
      let a = (r / 3 + (m.mode === 1 ? -1 : 1) * mini.total * 0.35) % 1;
      if (a < 0) a++;
      g.strokeStyle = m.mode === 1 ? '#a7e5dd38' : '#f4b1c038';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(m.x, m.y, a * 170, 0, Math.PI * 2);
      g.stroke();
    }
  }
  for (const o of mini.orbs) {
    shadow(g, o.x, o.y + 8, o.r, 6);
    const color = o.bad ? '#ed8daf' : o.kind ? '#f2cc7d' : '#a8dfc1';
    glow(g, o.x, o.y, o.r * 1.8, color + '18');
    ellipse(
      g,
      o.x,
      o.y,
      o.r,
      o.r,
      gradient(
        g,
        o.x - o.r,
        o.y - o.r,
        o.r * 2,
        o.r * 2,
        color,
        o.bad ? '#b75182' : o.kind ? '#bd8e55' : '#519e96'
      )
    );
    ellipse(g, o.x - 6, o.y - 7, 5, 3, '#fff7dc99');
    if (o.bad) label(g, '×', o.x, o.y + 8, 27, '#5d294c', 'center');
    else if (o.kind)
      poly(g, [[o.x, o.y - 9], [o.x + 7, o.y], [o.x, o.y + 9], [o.x - 7, o.y]], '#fff0bd');
    else ellipse(g, o.x, o.y, 6, 6, '#eaffd9');
  }
  g.save();
  g.translate(m.x, m.y);
  g.strokeStyle = m.mode === 1 ? '#c6f5df' : '#f6bccb';
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, 0, 21, 0, Math.PI);
  g.lineTo(-21, -12);
  g.stroke();
  line(g, [[21, 0], [21, -12]], m.mode === 1 ? '#f3a4a0' : '#b8e6d6', 10);
  g.restore();
  rr(g, 235, 555, 130, 43, 12, '#153c40', '#c6d4b0', 2);
  label(g, 'GUNK DISPOSAL ↓', 300, 582, 10, '#d7e4ba', 'center');
  rr(g, 158, 512, 284, 28, 14, '#102b40bb');
  label(
    g,
    m.on
      ? m.mode === 1
        ? 'PULLING · RELEASE TO COAST'
        : 'PUSHING · RELEASE TO COAST'
      : 'DRAG & HOLD TO APPLY FORCE',
    300,
    531,
    12,
    '#d5e7d4',
    'center'
  );
}
