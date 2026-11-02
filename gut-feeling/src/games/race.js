// Gurney Grand Prix (CT scan). Steer a runaway gurney: jump crates, slide under bars, throw
// softballs at gremlins. Needs both a coin quota and a stunt quota. Canvas 600 × 600.
const RACE = registerGame({
  id: 3,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Gurney Grand Prix',
    genre: 'SWIPE · JUMP · SLIDE · THROW',
    headline: 'Zero brakes. Questionable steering.',
    desc: 'Race a runaway gurney through three continuous sectors. Swipe to change lanes, jump low crates, slide under scan bars, and throw softballs at gremlins for bonus coins. Traffic gets faster and less polite.',
    goal: 'Survive all three sectors, collect the coin quota, and land the stunt quota.',
    control:
      'Swipe left / right to steer, up to jump, down to slide. Or use A/D, W/S and the big buttons. THROW (Space) fires down your lane.',
    avoid:
      'Jump orange crates, slide beneath violet bars, steer around pink walls. Blue gremlins take two throws. Gold routes reward risk.',
    cue: '← → steer · ↑ jump crates · ↓ slide bars · tap THROW for gremlins'
  },
  tierNotes: [
    '105s · jump, slide, throw',
    '120s · faster traffic · mixed hazards',
    '135s · dense traffic · armored gremlins'
  ],
  init() {
    initArcadeRun(105 + mini.tier * 15);
    mini.goal = 36 + mini.tier * 10;
    mini.stunts = 0;
    mini.stuntGoal = 8 + mini.tier * 4;
    mini.lane = 1;
    mini.cartX = 300;
    mini.jump = 0;
    mini.jumpV = 0;
    mini.slide = 0;
    mini.inv = 0;
    mini.throwCd = 0;
    mini.rows = [];
    mini.bullets = [];
    mini.spawn = 0.7;
    mini.rowSerial = 0;
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
      mini.pointer.startX = p.x;
      mini.pointer.startY = p.y;
    }
  },
  action(a) {
    if (a === 'left') mini.lane = Math.max(0, mini.lane - 1);
    if (a === 'right') mini.lane = Math.min(2, mini.lane + 1);
    if (a === 'jump' && mini.jump === 0) {
      mini.jumpV = 355;
      mini.jump = 1;
      mini.slide = 0;
      tone(420, 0.05);
    }
    if (a === 'slide' && mini.jump === 0 && mini.slide <= 0) mini.slide = 0.85;
    if (a === 'throw' && mini.throwCd <= 0) {
      mini.throwCd = 0.38;
      mini.bullets.push({ x: mini.cartX, y: 485 });
      tone(420, 0.05);
    }
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
    shift === 1
      ? 'SECTOR 2 · violet bars incoming. Swipe DOWN to slide.'
      : 'FINAL SECTOR · mixed traffic. Keep a lane open.',
  timeUp() {
    const met = mini.got >= mini.goal && mini.stunts >= mini.stuntGoal;
    finishMini(met, met ? undefined : ARCADE_QUOTA_MISSED);
  },
  lesson() {
    const i = RACE.info;
    return {
      title: i.game + ' · ' + mini.limit + ' second shift',
      goal: i.goal + ' Target: ' + mini.goal + ' coins + ' + mini.stuntGoal + ' stunts' + '.',
      control: i.control,
      avoid: i.avoid,
      demo: 'magnet',
      cue: i.cue
    };
  },
  statLabel: () => 'COINS / SECTOR',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () => `SCORE ${mini.score} · STUNTS ${mini.stunts}/${mini.stuntGoal} · ${mini.helps} ASSISTS`,
  assistText: () => 'SHIELD · ' + mini.helps + ' (E)',
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#3a6b7e', '#193b4e'));
    for (const x of [120, 210, 300]) line(g, [[x, 20], [x, 240]], '#b7dec65a', 2);
    miniBed(g, 210, 230, 0.7);
    gremlin(g, 120, 100, 1.1, 3, time);
    rr(g, 270, 110, 60, 28, 6, '#eabb89');
    label(g, RACE.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

function spawnTraffic() {
  const id = mini.rowSerial++,
    safe = (id + Math.floor(rand(0, 3))) % 3,
    objects = [];
  for (let lane = 0; lane < 3; lane++) {
    if (lane === safe) {
      objects.push({ lane, kind: 'coin', hp: 1 });
      continue;
    }
    const options =
      mini.shift === 0
        ? ['crate', 'wall', 'gremlin']
        : mini.shift === 1
          ? ['crate', 'bar', 'gremlin']
          : ['crate', 'bar', 'wall', 'gremlin'];
    objects.push({
      lane,
      kind: options[(id + lane + mini.tier) % options.length],
      hp: 2 + (mini.tier === 2 ? 1 : 0)
    });
  }
  mini.rows.push({ id, y: 30, objects, done: false });
}

function updateRace(dt) {
  mini.inv = Math.max(0, mini.inv - dt);
  mini.throwCd = Math.max(0, mini.throwCd - dt);
  mini.slide = Math.max(0, mini.slide - dt);
  mini.cartX += (160 + mini.lane * 140 - mini.cartX) * (1 - Math.exp(-dt * 19));
  if (mini.jump > 0) {
    mini.jumpV -= 880 * dt;
    mini.jump = Math.max(0, mini.jump + mini.jumpV * dt);
  }
  const speed = (130 + mini.tier * 16 + mini.shift * 23) * mini.rules.mini * (mini.slow > 0 ? 0.7 : 1);
  mini.spawn -= dt;
  if (mini.spawn <= 0 && mini.limit - mini.phaseTime > 4) {
    spawnTraffic();
    mini.spawn = (1.7 - mini.shift * 0.17 - mini.tier * 0.09) / mini.rules.mini;
  }
  for (const b of mini.bullets) {
    b.y -= 750 * dt;
    for (const r of mini.rows)
      for (const o of r.objects)
        if (
          o.kind === 'gremlin' &&
          o.hp > 0 &&
          Math.abs(b.x - (160 + o.lane * 140)) < 45 &&
          Math.abs(b.y - r.y) < 30
        ) {
          o.hp--;
          b.dead = true;
          arcadeBurst(b.x, b.y, '#b8e7f0', 5);
          if (o.hp === 0) {
            mini.got += 3;
            mini.stunts++;
            praise(180);
            mini.flash = 0.4;
            mini.flashText = 'SOFTBALL JUSTICE · +3';
          }
          break;
        }
  }
  mini.bullets = mini.bullets.filter(b => b.y > 20 && !b.dead);
  for (const r of mini.rows) {
    r.y += speed * dt;
    if (r.y >= 490 && !r.done) {
      r.done = true;
      const lane = Math.round((mini.cartX - 160) / 140),
        o = r.objects.find(o => o.lane === lane);
      if (!o) continue;
      if (o.kind === 'coin') {
        mini.got += 2;
        praise(60);
        arcadeBurst(mini.cartX, 480, '#ffe09c', 6);
      } else if (
        (o.kind === 'crate' && mini.jump > 25) ||
        (o.kind === 'bar' && mini.slide > 0) ||
        (o.kind === 'gremlin' && o.hp <= 0)
      ) {
        mini.got++;
        if (o.kind !== 'gremlin') mini.stunts++;
        praise(100);
      } else if (mini.inv <= 0) {
        mini.inv = 1;
        miniOops(
          o.kind === 'crate'
            ? 'JUMP THE ORANGE CRATES'
            : o.kind === 'bar'
              ? 'SLIDE UNDER VIOLET BARS'
              : o.kind === 'wall'
                ? 'STEER AROUND PINK WALLS'
                : 'GREMLINS NEED TWO THROWS'
        );
      }
    }
  }
  mini.rows = mini.rows.filter(r => r.y < 640);
}

function drawRace(g) {
  rr(g, 80, 45, 440, 555, 24, gradient(g, 80, 45, 440, 555, '#3c6e7e', '#305264'));
  for (const x of [89, 511]) line(g, [[x, 55], [x, 600]], '#bfe6d2', 4);
  for (const x of [230, 370]) {
    g.setLineDash([24, 26]);
    g.lineDashOffset = -mini.total * 150;
    line(g, [[x, 50], [x, 600]], '#c7e1ca44', 3);
    g.setLineDash([]);
  }
  for (let i = 0; i < 7; i++) {
    const y = ((i * 100 + mini.total * 130) % 670) - 35;
    rr(g, 16, y, 48, 60, 6, '#46747e');
    rr(g, 537, y, 48, 60, 6, '#46747e');
    line(g, [[23, y + 8], [56, y + 8]], '#9cdbca', 3);
    line(g, [[545, y + 8], [578, y + 8]], '#9cdbca', 3);
  }
  for (const r of mini.rows)
    for (const o of r.objects) {
      const x = 160 + o.lane * 140,
        y = r.y;
      if (o.kind === 'coin') {
        if (!r.done) {
          for (const d of [-12, 12]) {
            ellipse(g, x + d, y, 9, 12, '#f3ce7b');
            ellipse(g, x + d, y, 5, 8, '#ffe8a9');
          }
        }
      } else if (o.kind === 'gremlin') {
        if (o.hp > 0) {
          gremlin(g, x, y + 22, 1.15, 3, mini.total);
          label(g, String(o.hp) + ' HIT' + (o.hp > 1 ? 'S' : ''), x, y - 40, 11, '#dbf0dc', 'center');
        }
      } else if (o.kind === 'crate') {
        rr(g, x - 43, y - 20, 86, 40, 8, gradient(g, x, y - 20, 0, 40, '#f0c18a', '#b57a70'), '#f6d1a5', 2);
        label(g, '↑ JUMP', x, y + 5, 14, '#4b4051', 'center');
      } else if (o.kind === 'bar') {
        line(g, [[x - 49, y + 26], [x - 49, y - 24], [x + 49, y - 24], [x + 49, y + 26]], '#b39bd7', 7);
        rr(g, x - 47, y - 29, 94, 16, 6, '#dbb9e9');
        label(g, '↓ SLIDE', x, y + 7, 14, '#e2d7ef', 'center');
      } else {
        rr(g, x - 46, y - 35, 92, 65, 9, gradient(g, x, y - 35, 0, 65, '#eeadc0', '#a35e86'));
        line(g, [[x - 26, y - 20], [x + 26, y + 15]], '#f4d1cf', 5);
        line(g, [[x + 26, y - 20], [x - 26, y + 15]], '#f4d1cf', 5);
      }
    }
  for (const b of mini.bullets) softball(g, b.x, b.y, 9);
  shadow(g, mini.cartX, 530, 43, 10);
  g.save();
  g.translate(mini.cartX, 530 - mini.jump);
  if (mini.inv > 0) g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 14);
  if (mini.slide > 0) {
    g.rotate(-0.13);
    g.scale(1, 0.64);
  }
  miniBed(g, 0, 0, 0.62);
  if (mini.jump > 0) label(g, 'AIR MACY', 0, -105, 11, '#ffebb7', 'center');
  g.restore();
}
