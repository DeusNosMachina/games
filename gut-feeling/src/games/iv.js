// Drip or Die (your room). Three timed phases: tap the drip, catch the recipe, hold the pressure.
// It doubles as mandatory recovery at zero hearts (mini.forced). Canvas 800 × 450.
const IV = registerGame({
  id: 0,
  canvas: { w: 800, h: 450 },
  layout: 'iv',
  info: {
    game: 'Drip or Die',
    genre: 'PRECISION · CATCHING · BALANCE',
    headline: 'A three-course IV.',
    desc: 'A three-stage endurance run: alternating timing sweeps, changing nutrient recipes, and pressure with momentum. Higher levels demand more precision and longer control.'
  },
  tierNotes: [
    '8 taps · 10 catches · moving pressure',
    '10 taps · faster recipes · narrower band',
    '12 taps · shifting timing targets · stronger drift'
  ],
  init() {
    mini.good = 0;
    mini.precision = [];
    ivPhase(0);
  },
  controls() {
    if (mini.phase === 0) setControls([{ id: 'tap', text: 'TAP THE DRIP', key: 'Space', hot: true }]);
    if (mini.phase === 1)
      setControls([
        { id: 'lane0', text: '← LEFT', key: 'A' },
        { id: 'lane1', text: 'MIDDLE', key: 'S' },
        { id: 'lane2', text: 'RIGHT →', key: 'D' }
      ]);
    if (mini.phase === 2) setControls([{ id: 'hold', text: 'HOLD TO PUMP', key: 'Space', hot: true }]);
  },
  update(dt) {
    updateIVGame(dt);
    if (mini.screen === 'play' && mini.phaseTime >= mini.limit)
      finishMini(false, 'The clock called. It wants its seconds back.');
  },
  draw(g) {
    g.save();
    // The intro zoom is motion only; reduced-motion keeps the frame still.
    if (mini.screen === 'intro' && !reduced) {
      let z = 0.97 + 0.03 * Math.min(1, mini.transition / INTRO_SECONDS);
      g.translate(400, 225);
      g.scale(z, z);
      g.translate(-400, -225);
    }
    miniBackdrop(g, '#295d65', '#6ad6aa3d', IV.info.game.toUpperCase());
    drawIVMini(g);
    g.restore();
  },
  overlay(g) {
    if (mini.flash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, mini.flash * 3);
      panel(g, 105, 42, 590, 34, mini.flashText.includes('DRIP') ? '#356e61' : '#75455b', '#d4b399');
      label(g, mini.flashText, 400, 65, 14, '#ffedd0', 'center');
      g.restore();
    }
    paintTransition(g);
  },
  action(a) {
    if (a === 'tap') ivTap();
    if (mini.phase === 1) {
      if (a.startsWith('lane')) mini.lane = clamp(+a.slice(-1), 0, 2);
      if (a === 'left') mini.lane = Math.max(0, mini.lane - 1);
      if (a === 'right') mini.lane = Math.min(2, mini.lane + 1);
    }
  },
  assist() {
    mini.helpTime = 4;
    if (mini.phase === 2) {
      mini.pressure = mini.pressureTarget;
      mini.velocity = 0;
    }
    mini.flash = 0.7;
    mini.flashText = 'EMERGENCY HELP. FIVE STYLE POINTS.';
    tone(500, 0.2, 'sine');
  },
  key(k, e) {
    if (k === ' ') {
      // The pressure phase is hold-to-pump; the other phases act once per press.
      if (mini.phase === 2) mini.held = true;
      else if (!e.repeat) miniAction('tap');
    }
    if (e.repeat) return true;
    if (mini.phase === 1) {
      if (k === 'a' || k === 'arrowleft') miniAction('lane0');
      if (k === 's' || k === 'arrowdown') miniAction('lane1');
      if (k === 'd' || k === 'arrowright') miniAction('lane2');
    }
    return true;
  },
  lesson() {
    return [
      {
        title: '1 / Prime the pump',
        goal: 'Land ' + mini.required + ' precise taps.',
        control: 'Tap TAP THE DRIP or Space in the mint window. The sweep changes direction after each tap.',
        avoid:
          'The gold center scores more. Missed taps and missed sweeps cost an oops. Higher levels move the window.',
        demo: 'timing',
        cue: 'Tap mint · center earns precision points'
      },
      {
        title: '2 / Follow the recipe',
        goal: 'Catch ' + mini.catchNeed + ' matching nutrients.',
        control:
          'Choose a lane with LEFT / MIDDLE / RIGHT or A / S / D. Match the requested gold or pink flavor.',
        avoid: 'The recipe changes every 4 catches. Green skulls hurt. The wrong flavor costs style points.',
        demo: 'catch',
        cue: 'Match the recipe · avoid green skulls'
      },
      {
        title: '3 / Steady hands',
        goal: 'Bank ' + mini.need + ' seconds inside the moving band.',
        control:
          'Hold PUMP or Space to raise pressure. Release to lower it. Anticipate the moving target and the pressure momentum.',
        avoid: 'Extreme pressure costs an oops. Use small corrections; an assist recenters the gauge.',
        demo: 'balance',
        cue: 'Hold = up · release = down · follow mint'
      }
    ][mini.phase];
  },
  statLabel: () => ['PRIME THE PUMP', 'FILTER THE GUNK', 'TRACK THE PRESSURE'][mini.phase],
  stat: () =>
    mini.phase === 0
      ? mini.good + '/' + mini.required + ' drips'
      : mini.phase === 1
        ? mini.caught + '/' + mini.catchNeed + ' catches'
        : mini.stable.toFixed(1) + '/' + mini.need + 's steady',
  lives: () =>
    '♥ '.repeat(Math.max(0, mini.rules.misses - mini.miss)) +
    '· '.repeat(Math.min(mini.miss, mini.rules.misses)),
  tactics: () =>
    'SCORE ' + mini.score + '   ·   CHAIN ' + mini.combo + '   ·   ' + mini.helps + ' ASSISTS LEFT',
  assistText: () =>
    ['WIDEN WINDOW', 'FILTER GUNK', 'RESET PRESSURE'][mini.phase] + ' · ' + mini.helps + ' left (E)',
  quality() {
    let q = mini.quality;
    const p = mini.precision;
    q -= Math.max(0, 0.8 - p.reduce((a, b) => a + b, 0) / Math.max(1, p.length)) * 32;
    q -= Math.max(0, mini.phaseTime - mini.need * 2.7) * 0.4;
    return Math.round(clamp(q, 0, 100));
  },
  // Recovery restores hearts by medal.
  onWin() {
    state.hp = Math.max(state.hp, 2 + mini.grade);
    player.vomit = 0;
    save();
    hud();
    return state.hp + ' hearts restored. The nutrients have entered the chat.';
  },
  // A failed recovery goes anatomical: splatter particles plus the gory result styling.
  onLose() {
    for (let i = 0; i < 190; i++)
      gore.push({
        x: 395,
        y: 100,
        vx: rand(-430, 430),
        vy: rand(-280, 50),
        size: rand(4, 12),
        col: ['#a72045', '#dd3b55', '#ef7a77', '#7d183b'][i % 4]
      });
    return {
      gory: true,
      medal: '✚',
      heading: 'SOME ASSEMBLY REQUIRED.',
      text: 'Your insides have become outsides. Housekeeping has been notified.'
    };
  },
  resultArt(g) {
    if (mini.win) return false;
    for (let i = 0; i < 24; i++) {
      let x = (i * 173 + 17) % 790,
        y = (i * 59 + 11) % 215;
      ellipse(g, x, y, 6 + (i % 4) * 3, 5 + (i % 3) * 3, i % 2 ? '#ac2444' : '#d24054');
      line(g, [[x + 2, y], [x + 2, y + 14 + (i % 3) * 5]], '#a62243', 3);
      ellipse(g, x + 2, y + 14 + (i % 3) * 5, 2, 3, '#b22947');
    }
    ellipse(g, 392, 185, 100, 20, '#9c2342');
    for (let p of gore) ellipse(g, p.x, p.y, p.size * 0.65, p.size * 0.85, p.col);
    for (let j = 0; j < 4; j++) {
      rect(g, 370, 105 + j * 7, 49 - j * 4, 4, '#f7d3b1');
      rect(g, 366, 108 + j * 7, 5, 5, '#f7d3b1');
      rect(g, 418 - j * 4, 108 + j * 7, 5, 5, '#f7d3b1');
    }
    rect(g, 392, 99, 5, 45, '#ffe1be');
    g.strokeStyle = '#f49698';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(397, 140);
    g.bezierCurveTo(335, 115, 349, 204, 388, 171);
    g.bezierCurveTo(425, 139, 459, 202, 407, 190);
    g.bezierCurveTo(372, 168, 447, 135, 461, 176);
    g.stroke();
    rect(g, 310, 178, 28, 10, '#f5e4bc');
    rect(g, 306, 187, 35, 6, '#385c6c');
    rect(g, 460, 114, 31, 5, '#efd5b4');
    rect(g, 456, 110, 8, 13, '#efd5b4');
    rect(g, 490, 110, 8, 13, '#efd5b4');
    ellipse(g, 457, 159, 9, 9, '#fbe4ca');
    ellipse(g, 459, 158, 4, 5, '#65412e');
    label(g, 'OH. THAT’S PROBABLY FINE.', 395, 32, 14, '#622b43', 'center');
    return true;
  },
  scene(g, w, h) {
    g.save();
    g.clearRect(0, 0, w, h);
    rect(g, 0, 0, w, h, rooms[0].theme);
    rect(g, 0, h * 0.58, w, h * 0.42, '#627c78');
    for (let x = 0; x < w; x += 28) rect(g, x, h * 0.6, 1, h, '#c1d0b633');
    const scale = h / 160;
    g.translate(w / 2, h * 0.82);
    g.scale(scale, scale);
    bed(g, -30, 8, 0.7);
    ivStand(g, 37, 9, 0.7);
    plant(g, 95, 13, 0.7);
    g.restore();
  }
});

function ivPhase(phase) {
  mini.phase = phase;
  mini.phaseTime = 0;
  mini.held = false;
  mini.helpTime = 0;
  mini.outside = 0;
  mini.inputLock = 0;
  if (phase === 0) {
    mini.limit = 48 + mini.tier * 8;
    mini.required = 8 + mini.tier * 2;
    mini.dir = 1;
    mini.pos = 0;
    mini.target = rand(0.35, 0.72);
    mini.targetBase = mini.target;
    mini.band = Math.max(0.05, mini.rules.window - mini.tier * 0.012);
    mini.beatLock = 0.3;
    setInstructions(
      'Tap the mint window. The sweep reverses after each tap. The gold center earns precision points.'
    );
  }
  if (phase === 1) {
    mini.limit = 55 + mini.tier * 7;
    mini.lane = 1;
    mini.cupX = 400;
    mini.drops = [];
    mini.spawn = 0.5;
    mini.spawned = 0;
    mini.caught = 0;
    mini.catchNeed = 10 + mini.tier * 2;
    mini.recipe = 0;
    setInstructions(
      'Catch the requested color. The recipe changes every 4 catches. Avoid green skulls; other colors do not count.'
    );
  }
  if (phase === 2) {
    mini.limit = 65 + mini.tier * 10;
    mini.pressure = 0.5;
    mini.velocity = 0;
    mini.stable = 0;
    mini.need = 14 + mini.tier * 3;
    mini.pressureTarget = 0.52;
    mini.pressureBand = 0.15 - mini.tier * 0.018;
    setInstructions(
      'Follow the moving mint band. Hold to pump, release to lower. Pressure has momentum: make small corrections.'
    );
  }
  IV.controls();
  if (mini.initialized) prepareBriefing();
}

function ivTap() {
  if (mini.screen !== 'play' || mini.paused || mini.phase !== 0 || mini.beatLock > 0 || mini.inputLock > 0)
    return;
  const band = mini.band * (mini.helpTime > 0 ? 1.7 : 1),
    off = Math.abs(mini.pos - mini.target);
  if (off <= band / 2) {
    const accuracy = 1 - off / (band / 2);
    mini.good++;
    mini.precision.push(accuracy);
    praise(75 + accuracy * 75, accuracy);
    mini.flash = 0.5;
    mini.flashText = accuracy > 0.7 ? 'CENTER HIT · BEAUTIFUL DRIP' : 'GOOD DRIP';
    tone(500 + mini.good * 25, 0.1);
    if (mini.good >= mini.required) {
      ivPhase(1);
      return;
    }
  } else miniOops('MISSED THE DRIP');
  mini.dir *= -1;
  mini.pos = mini.dir > 0 ? 0 : 1;
  mini.beatLock = 0.42;
  mini.target = mini.targetBase = rand(0.28, 0.75);
}

function updateIVGame(dt) {
  if (mini.phase === 0) {
    mini.beatLock = Math.max(0, mini.beatLock - dt);
    if (mini.tier === 2) mini.target = mini.targetBase + Math.sin(mini.phaseTime * 1.6) * 0.035;
    if (mini.beatLock <= 0) {
      mini.pos += mini.dir * dt * (0.43 * mini.rules.mini + mini.tier * 0.035);
      if (mini.pos > 1 || mini.pos < 0) {
        miniOops('A DRIP GOT AWAY');
        mini.pos = mini.dir > 0 ? 0 : 1;
        mini.beatLock = 0.4;
      }
    }
  } else if (mini.phase === 1) {
    mini.cupX += (240 + mini.lane * 160 - mini.cupX) * (1 - Math.exp(-dt * 17));
    mini.spawn -= dt;
    if (mini.spawn <= 0) {
      let lane = Math.floor(rand(0, 3)),
        bad = (lane + 1 + Math.floor(rand(0, 2))) % 3;
      mini.drops.push(
        { lane, y: 90, bad: false, kind: mini.recipe, done: false },
        { lane: bad, y: 76, bad: true, kind: -1, done: false }
      );
      mini.spawned++;
      mini.spawn = (1.45 - mini.tier * 0.13) / mini.rules.mini;
    }
    for (let d of mini.drops) {
      d.y += dt * (104 + mini.tier * 16) * mini.rules.mini;
      if (d.y >= 352 && !d.done) {
        d.done = true;
        const lane = Math.round((mini.cupX - 240) / 160);
        if (d.lane === lane) {
          if (d.bad) {
            if (mini.helpTime <= 0) miniOops('GREEN GUNK IS NOT LUNCH');
          } else if (d.kind === mini.recipe) {
            mini.caught++;
            praise(100);
            mini.recipe = Math.floor(mini.caught / 4) % 2;
            tone(660, 0.07);
            if (mini.caught >= mini.catchNeed) {
              ivPhase(2);
              return;
            }
          } else {
            mini.quality -= 2;
            mini.combo = 0;
            mini.flash = 0.6;
            mini.flashText = 'WRONG FLAVOR. CHECK THE RECIPE.';
          }
        }
      }
    }
    mini.drops = mini.drops.filter(d => d.y < 420);
  } else {
    mini.pressureTarget = 0.52 + Math.sin(mini.phaseTime * (0.25 + mini.tier * 0.035)) * 0.16;
    const desired = (mini.held ? 0.27 : -0.23) * mini.rules.mini;
    mini.velocity += (desired - mini.velocity) * (1 - Math.exp(-dt * 6));
    mini.pressure = clamp(
      mini.pressure + dt * (mini.velocity + Math.sin(mini.phaseTime * 1.7) * (0.012 + mini.tier * 0.009)),
      0,
      1
    );
    if (Math.abs(mini.pressure - mini.pressureTarget) < mini.pressureBand / 2) mini.stable += dt;
    if (mini.pressure < 0.06 || mini.pressure > 0.94) {
      mini.outside += dt;
      if (mini.outside > 0.85) {
        mini.outside = 0;
        mini.pressure = 0.5;
        mini.velocity = 0;
        miniOops('PRESSURE HAS LEFT THE CHAT');
      }
    } else mini.outside = 0;
    if (mini.stable >= mini.need) {
      praise(300);
      finishMini(true);
    }
  }
}

function drawIVMini(g) {
  if (mini.phase === 0) {
    miniBed(g, 222, 275, 1.15);
    ivStand(g, 111, 275, 1.2);
    cabinet(g, 355, 276, 88);
    monitor(g, 398, 188);
    label(g, 'PRIME THE PUMP', 605, 106, 22, '#d8e8cc', 'center');
    for (let i = 0; i < mini.required; i++) {
      const x = 512 + (i % 6) * 36,
        y = 142 + Math.floor(i / 6) * 35;
      ellipse(g, x, y, 11, 11, i < mini.good ? '#c4e8b5' : '#365563');
      if (i < mini.good) spark(g, x, y, '#fff0b6', 0.55);
    }
    label(g, mini.good + ' / ' + mini.required + ' accurate drips', 605, 232, 17, '#e7d49c', 'center');
    label(g, mini.dir > 0 ? 'SWEEP →' : '← SWEEP', 605, 262, 14, '#b4d9cb', 'center');
    drawTimingBar(g, 85, 335, 630, mini.pos, mini.target, mini.band * (mini.helpTime > 0 ? 1.7 : 1));
    label(g, 'MINT = GOOD    ·    GOLD CENTER = PRECISION BONUS', 400, 411, 14, '#dce8ca', 'center');
  } else if (mini.phase === 1) {
    const color = mini.recipe === 0 ? '#f3ce84' : '#eca8bc';
    rr(g, 193, 46, 414, 42, 12, color);
    label(
      g,
      mini.recipe === 0 ? 'RECIPE: GOLD VANILLA' : 'RECIPE: PINK BERRY',
      400,
      74,
      19,
      '#294657',
      'center'
    );
    for (let lane = 0; lane < 3; lane++) {
      const x = 240 + lane * 160;
      panel(g, x - 57, 101, 114, 285, '#153641', '#456b75');
      line(g, [[x - 43, 113], [x - 43, 330]], '#b7d8cb33', 3);
      label(g, ['LEFT', 'MIDDLE', 'RIGHT'][lane], x, 425, 12, '#bddbce', 'center');
    }
    for (const d of mini.drops) {
      if (d.done) continue;
      let x = 240 + d.lane * 160;
      ellipse(
        g,
        x,
        d.y,
        d.bad ? 17 : 14,
        d.bad ? 17 : 19,
        d.bad ? '#9cbd59' : d.kind === 0 ? '#f3ce84' : '#eca8bc'
      );
      if (d.bad) {
        ellipse(g, x - 6, d.y - 4, 3, 4, '#315240');
        ellipse(g, x + 6, d.y - 4, 3, 4, '#315240');
        line(g, [[x - 6, d.y + 6], [x + 6, d.y + 6]], '#315240', 3);
      } else {
        line(g, [[x - 4, d.y - 9], [x - 4, d.y - 3]], '#fff2ce', 3);
        label(g, d.kind === 0 ? 'V' : 'B', x, d.y + 6, 11, '#614d63', 'center');
      }
    }
    const x = mini.cupX;
    shadow(g, x, 395, 44, 7);
    path(
      g,
      p => {
        p.moveTo(x - 42, 344);
        p.lineTo(x + 42, 344);
        p.lineTo(x + 32, 384);
        p.quadraticCurveTo(x, 400, x - 32, 384);
        p.closePath();
      },
      gradient(g, x, 344, 0, 50, '#fff1c0', '#8fb4a2')
    );
    ellipse(g, x, 344, 42, 8, '#e9e1b9');
    ellipse(g, x, 344, 34, 5, mini.helpTime > 0 ? '#a8e7cf' : '#456f7b');
  } else {
    miniBed(g, 137, 309, 0.95);
    ivStand(g, 61, 309, 0.85);
    label(g, 'FOLLOW THE MOVING BAND', 400, 67, 22, '#dce9cd', 'center');
    panel(g, 319, 92, 162, 272, '#173747', '#82a9ad');
    rr(g, 331, 105, 138, 246, 13, '#0b2839');
    const y = 351 - mini.pressure * 246,
      b = mini.pressureBand * 246,
      by = 351 - (mini.pressureTarget + mini.pressureBand / 2) * 246;
    rr(g, 332, y, 136, Math.max(1, 351 - y), 8, gradient(g, 330, y, 0, 351 - y, '#9fd7c0', '#4f9aa9'));
    rr(g, 308, by, 185, b, 5, '#c3eaaa77', '#d8efb7', 2);
    line(g, [[487, y], [509, y]], '#ffda8c', 3);
    label(g, Math.round(mini.pressure * 100) + '%', 555, y + 5, 20, '#ffe1a3');
    label(g, mini.stable.toFixed(1) + ' / ' + mini.need + 's', 640, 142, 25, '#ffe0a1', 'center');
    label(g, 'TIME IN THE BAND', 640, 169, 12, '#a8d1c3', 'center');
    label(g, 'Momentum ' + (mini.velocity > 0 ? '↑' : '↓'), 640, 230, 16, '#c4e0d4', 'center');
    label(g, mini.held ? 'PUMPING ↑' : 'RELEASING ↓', 400, 399, 18, '#d3e5c5', 'center');
    rr(g, 247, 422, 306, 10, 5, '#234959');
    rr(g, 247, 422, 306 * Math.min(1, mini.stable / mini.need), 10, 5, '#bde5b5');
  }
}
