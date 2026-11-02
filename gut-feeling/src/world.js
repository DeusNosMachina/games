// The ward is the connective adventure; department challenges carry progression.
// Rooms, movement, pickups, effects, ward rendering, the map, and the frame loop.
const supplies = [
  { id: 'home-shake', room: 0, x: 381, y: 463, type: 'shake' },
  { id: 'mri-juice', room: 1, x: 256, y: 346, type: 'juice' },
  { id: 'lounge-pudding', room: 2, x: 740, y: 396, type: 'pudding' },
  { id: 'ct-shake', room: 3, x: 718, y: 492, type: 'shake' },
  { id: 'us-juice', room: 4, x: 281, y: 407, type: 'juice' },
  { id: 'six-home', room: 0, x: 402, y: 492, type: 'pudding', unlock: 6 },
  { id: 'six-lounge', room: 2, x: 749, y: 520, type: 'juice', unlock: 6 },
  { id: 'twelve-mri', room: 1, x: 681, y: 445, type: 'shake', unlock: 12 },
  { id: 'twelve-us', room: 4, x: 520, y: 506, type: 'pudding', unlock: 12 }
];

const supplyAvailable = s =>
  s.room === state.room && !state.taken.includes(s.id) && stars() >= (s.unlock || 0);

function toast(t, sec = 3) {
  $('toast').textContent = t;
  $('toast').classList.add('show');
  toastTimer = sec;
}

function coins(n) {
  state.coins += n;
  save();
  hud();
}

function hud() {
  $('hearts').innerHTML = Array.from(
    { length: 5 },
    (_, i) => `<svg class="${i < state.hp ? '' : 'empty'}" aria-hidden="true"><use href="#i-heart"/></svg>`
  ).join('');
  $('hearts').setAttribute('aria-label', `${state.hp} of 5 hearts`);
  $('healthName').textContent = state.name ? `${state.name} / ${state.hp} hearts` : 'Queasiness resistance';
  $('score').textContent = String(state.coins).padStart(4, '0');
  $('foodCount').textContent = state.food + ' / 3';
  $('eatBtn').disabled = state.food === 0 || state.hp >= 5;
  $('difficultyBtn').textContent = cfg().name + ' ⚙';
  $('heroName').value = state.name;
  $('passport').innerHTML = rooms
    .map(
      (r, i) =>
        `<div class="passport-row">` +
        `<span>${state.medals[i].some(Boolean) ? '✓' : '○'} ${r.name}</span>` +
        `<span>${state.medals[i].map(m => (m ? '★'.repeat(m) : '·')).join(' ')}</span></div>`
    )
    .join('');
  $('progressLabel').textContent = stars() + ' / 12';
  $('progressBar').style.width = Math.min(100, (stars() / 12) * 100) + '%';
  $('dischargeRules').textContent =
    `${stamps()}/${rooms.length} arcades stamped · ${levelTwo() ? '✓' : '○'} Level 2 medal\nBronze 1★ · Silver 2★ · Gold 3★`;
  $('storageNote').style.display = storageOK ? 'none' : 'block';
}

function clearHeld() {
  if (mini.pointer) arcadeUp(true);
  arcadePointer = null;
  wardAim = null;
  attackPointer = null;
  attackOrigin = null;
  keys.clear();
  joy.x = joy.y = 0;
  heldAttack = false;
  mini.held = false;
  mini.fireHeld = false;
  joyPointer = null;
  $('stick').style.transform = 'translate(0,0)';
}

function modalOpen(d) {
  clearHeld();
  if (!d.open) d.showModal();
}

function isModal() {
  return $$('dialog').some(d => d.open);
}

function loadRoom(id) {
  hitStop = 0;
  state.room = id;
  player.x = 505;
  player.y = 470;
  player.inv = 1.5;
  player.shield = 0;
  player.vomit = 0;
  projectiles = [];
  particles = [];
  puddles = [];
  traps = [];
  floats = [];
  deadDelay = 0;
  player.z = 0;
  player.vz = 0;
  player.attack = 0;
  player.attackCd = 0;
  startEncounter();
  $('roomTitle').textContent = rooms[id].name;
  $('roomSub').textContent = rooms[id].sub;
  $('sceneTag').textContent =
    id === 0 || id === 5 ? 'SAFE ROOM / DANGEROUSLY COZY' : 'DODGE THE BLOBS / FIND THE ARCADE';
  $('arcadeBtn').textContent = '▶ ' + games[id].info.game;
  renderMap();
  if (state.started)
    toast(
      id === 5
        ? 'After hours. Bedside Blaster is waiting. Ralph brought friends.'
        : id === 0
          ? 'Home base. Nutrients on the rug. IV game by the bed.'
          : 'Explore, grab supplies, and find the glowing arcade beacon.',
      3
    );
}

function begin() {
  if (state.started) return;
  state.started = true;
  document.body.classList.add('playing');
  state.paused = false;
  $('startCallout').classList.add('hidden');
  $('playStatus').textContent = 'EXPLORE / PLAY / GET HOME';
  loadRoom(state.room);
  canvas.focus({ preventScroll: true });
  tone(523, 0.13);
}

function collides(x, y) {
  return (
    x < 40 ||
    x > 960 ||
    y < 170 ||
    y > 574 ||
    roomProps[state.room].some(p => {
      let [bx, by, bw, bh] = p.box;
      return x + 11 > bx && x - 11 < bx + bw && y + 4 > by && y - 7 < by + bh;
    })
  );
}

function moveEntity(e, dx, dy) {
  if (!collides(e.x + dx, e.y)) e.x += dx;
  if (!collides(e.x, e.y + dy)) e.y += dy;
}

function emit(x, y, col, n = 12, speed = 100) {
  for (let i = 0; i < n; i++)
    particles.push({
      x,
      y,
      vx: rand(-speed, speed),
      vy: rand(-speed, speed * 0.25),
      life: rand(0.3, 0.8),
      col,
      size: rand(3, 7)
    });
}

function floating(text, x, y, col = '#fff1c2') {
  floats.push({ text, x, y, life: 1.1, col });
}

function eat() {
  if (isModal() || state.paused || deadDelay > 0 || state.hp >= 5 || !state.food) return;
  state.food--;
  state.hp++;
  player.eat = 0.9;
  player.inv = Math.max(player.inv, 0.5);
  tone(590, 0.15);
  floating('+1 HEART', player.x, player.y - 95, '#b7e9b9');
  toast('Nutrients consumed. One heart. No Michelin stars.', 2);
  save();
  hud();
}

function updateWorld(dt) {
  time += dt;
  player.visualDir =
    (player.visualDir ?? player.dir) +
    (player.dir - (player.visualDir ?? player.dir)) * (1 - Math.exp(-dt * 16));
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
  if (mini.open) {
    updateMini(dt);
    return;
  }
  if (isModal() || state.paused) return;
  for (let k of [
    'inv',
    'shield',
    'attack',
    'attackCd',
    'itemCd',
    'dash',
    'dashCd',
    'vomit',
    'eat',
    'comboTime'
  ])
    player[k] = Math.max(0, player[k] - dt);
  shake = Math.max(0, shake - dt);
  if (deadDelay > 0) {
    deadDelay -= dt;
    updateEffects(dt);
    if (deadDelay <= 0) {
      state.hp = 0;
      openMini(0, true);
    }
    return;
  }
  if (!state.started) return;
  if (hitStop > 0) {
    hitStop -= dt;
    return;
  }
  let dx =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0) +
      joy.x,
    dy =
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0) +
      joy.y;
  let len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  player.moving = len > 0.05;
  if (player.moving) {
    player.lastDx = dx;
    player.lastDy = dy;
    if (Math.abs(dx) > 0.1) player.dir = dx > 0 ? 1 : -1;
    player.walk += dt * 13;
  } else player.walk = 0;
  let speed = player.vomit > 0.5 ? 95 : 205;
  if (player.dash > 0) {
    dx = player.lastDx;
    dy = player.lastDy;
    speed = 530;
  }
  moveEntity(player, dx * speed * dt, dy * speed * dt);
  if (keys.has(' ') || heldAttack) attack();
  updateCombat(dt);
  for (let s of supplies.filter(supplyAvailable))
    if (dist(s, player) < 27 && state.food < 3) {
      state.taken.push(s.id);
      state.food++;
      floating('+1 ' + s.type.toUpperCase(), s.x, s.y - 50, '#b7e6bd');
      toast('Nutrient stashed. Drink / eat (F) when you need a heart.', 2.7);
      save();
      hud();
      tone(800, 0.1);
    }
  if (player.x > 895 && player.y < 202) {
    player.y = 225;
    openMap();
  }
  updateEffects(dt);
  $('dashBtn').style.opacity = player.dashCd > 0 ? '.45' : '1';
  $('useBtn').style.opacity = state.item && player.itemCd > 0 ? '.45' : '1';
}

function updateEffects(dt) {
  for (let p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (let f of floats) {
    f.life -= dt;
    f.y -= dt * 30;
  }
  floats = floats.filter(f => f.life > 0);
  for (let p of puddles) p.life -= dt;
  puddles = puddles.filter(p => p.life > 0);
  for (let t of traps) t.life -= dt;
  traps = traps.filter(t => t.life > 0);
}

function drawWorld() {
  let vw = viewport.w;
  c.clearRect(0, 0, vw, 625);
  cameraX +=
    (clamp(player.x - vw / 2, 0, Math.max(0, 1000 - vw)) - cameraX) * (1 - Math.exp(-renderDelta * 12));
  c.save();
  c.translate(-cameraX + (shake ? rand(-3, 3) : 0), shake ? rand(-2, 2) : 0);
  roomBg(c, state.room);
  for (let p of puddles) {
    c.globalAlpha = Math.min(1, p.life);
    ellipse(c, p.x, p.y, 30, 8, '#8da744');
    ellipse(c, p.x - 4, p.y - 2, 18, 4, '#b4c969');
  }
  c.globalAlpha = 1;
  const station = rooms[state.room].station;
  let near = dist(player, { x: station[0], y: station[1] }) < 65;
  ellipse(c, ...station, 48, 17, '#285f6266');
  c.strokeStyle = '#b9ebbb';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(station[0], station[1], 43 + Math.sin(time * 3) * 2, 14, 0, 0, Math.PI * 2);
  c.stroke();
  spark(c, station[0], station[1] - 50 + Math.sin(time * 3) * 4, '#ffe29b', 1);
  label(c, near ? 'ENTER / PLAY' : 'ARCADE', station[0], station[1] + 31, 12, '#244d53', 'center');
  for (let s of supplies.filter(supplyAvailable)) {
    ellipse(c, s.x, s.y, 20, 7, '#e7eea855');
    nutrient(c, s.x, s.y + Math.sin(time * 3) * 3, s.type, 1.2);
    spark(c, s.x + 15, s.y - 35, '#fff0ad', 0.4);
  }
  for (let tr of traps) {
    brick(c, tr.x - 15, tr.y, '#e38878');
    brick(c, tr.x + 2, tr.y + 5, '#6faeab');
  }
  const renderables = roomProps[state.room].map(p => ({ y: p.y, draw: p.draw }));
  renderables.push({
    y: player.y,
    draw: g => {
      if (player.z > 0) shadow(g, player.x, player.y, 22, 6);
      if (player.shield > 0) {
        ellipse(g, player.x, player.y - 37, 43, 56, '#ace8b047');
        g.strokeStyle = '#c1f2cc';
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(player.x, player.y - 37, 43, 56, 0, 0, Math.PI * 2);
        g.stroke();
      }
      if (player.dash > 0) {
        g.globalAlpha = 0.2;
        girl(g, player.x - player.lastDx * 26, player.y - player.lastDy * 26, 1.24, player.walk, player.dir);
        g.globalAlpha = 1;
      }
      g.save();
      g.translate(player.x, player.y - player.z);
      if (player.z > 0) g.rotate(player.dir * -0.12);
      if (player.vomit > 0.3) g.rotate(player.dir * 0.12);
      girl(
        g,
        0,
        0,
        1.24,
        player.walk,
        player.visualDir ?? player.dir,
        player.inv > 0 && player.vomit <= 0,
        player.z <= 0
      );
      g.restore();
      vomitArt(g, player.x, player.y - player.z, player.dir, player.vomit, 1.24);
      if (player.eat > 0) {
        nutrient(g, player.x + player.dir * 15, player.y - 48, 'shake', 0.9);
        heart(g, player.x - 10, player.y - 110, 1.3, '#f3a08f');
      }
      if (player.attack > 0) {
        drawPillowSwing(g, player);
      }
      if (state.name) label(g, state.name, player.x, player.y - 106 - player.z, 10, '#325a58', 'center');
    }
  });
  enemies.forEach(e => renderables.push({ y: e.y, draw: g => drawEnemy(g, e) }));
  renderables.sort((a, b) => a.y - b.y).forEach(o => o.draw(c));
  for (let p of projectiles) {
    let z = p.kind === 'brick' ? Math.sin(Math.min(1, p.age / 0.85) * Math.PI) * 70 : 0;
    shadow(c, p.x, p.y + 32, 9, 3);
    if (p.kind === 'brick') {
      c.save();
      c.translate(p.x, p.y - z);
      c.rotate(p.age * 9);
      brick(c, -14, 5, '#ed9d87');
      c.restore();
    } else if (p.kind === 'bag') {
      rr(c, p.x - 10, p.y - 12, 20, 24, 5, '#f8d9a1', '#9d8578', 1);
      label(c, '!', p.x, p.y + 5, 16, '#729a68', 'center');
    } else {
      ellipse(c, p.x - p.vx * 0.035, p.y - p.vy * 0.035, 12, 6, p.friendly ? '#ffe7a488' : '#b2c65f88');
      ellipse(c, p.x, p.y, 9, 8, p.friendly ? '#ffe394' : '#b9d56b');
    }
  }
  if (wardAim && Math.hypot(wardAim.dx, wardAim.dy) > 8) {
    const a = aimDirection();
    c.setLineDash([7, 8]);
    line(c, [[player.x, player.y - 32], [player.x + a.x * 180, player.y - 32 + a.y * 180]], '#fff4c8bb', 3);
    c.setLineDash([]);
  }
  for (let p of particles) {
    c.globalAlpha = Math.min(1, p.life * 2);
    rect(c, p.x, p.y, p.size, p.size, p.col);
  }
  c.globalAlpha = 1;
  for (let f of floats) {
    c.globalAlpha = Math.min(1, f.life * 2);
    label(c, f.text, f.x + 1, f.y + 1, 12, '#244656', 'center');
    label(c, f.text, f.x, f.y, 12, f.col, 'center');
  }
  c.globalAlpha = 1;
  rect(c, 0, 603, 1000, 22, '#244856');
  rect(c, 24, 603, 952, 4, '#90b6a2');
  c.restore();
  if (state.paused) {
    rect(c, 0, 0, vw, 625, '#102734da');
    label(c, 'TAKE A BREATHER.', vw / 2, 295, 23, '#f5e6c5', 'center');
    label(c, 'Esc or tap the room to resume.', vw / 2, 328, 12, '#b5d3bd', 'center');
  }
}

function renderMap() {
  $('mapGrid').innerHTML =
    rooms
      .map(
        r =>
          `<button class="map-room ${state.room === r.id ? 'active' : ''}" data-room="${r.id}">` +
          `<span class="map-n">0${r.id + 1} / ${games[r.id].info.genre.split(' · ')[0]}</span>` +
          `<strong>${r.name}</strong><small>${games[r.id].info.game}</small>` +
          `<span class="medals">${state.medals[r.id].map(m => (m ? '★'.repeat(m) : '○')).join(' / ')}</span></button>`
      )
      .join('') +
    `<div class="map-room"><span class="map-n">07 / THE EXIT</span>` +
    `<strong>${state.won ? 'Discharged!' : 'Homeward bound.'}</strong>` +
    `<small>${stars()}/12 stars · ${stamps()}/${rooms.length} arcades</small></div>`;
}

function openMap() {
  renderMap();
  modalOpen($('mapDialog'));
}

function goRoom(id) {
  if (mini.open) return;
  $$('dialog[open]').forEach(d => d.close());
  state.paused = false;
  if (!state.started) begin();
  loadRoom(id);
  canvas.focus({ preventScroll: true });
  $('stage').scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' });
}

function buildDepartments() {
  $('departmentGrid').innerHTML = rooms
    .map(
      r =>
        `<button class="dept-card" data-room="${r.id}" aria-label="Explore ${r.name}">` +
        `<canvas width="260" height="135" data-mini="${r.id}"></canvas><div class="dept-copy"><div>` +
        `<span>0${r.id + 1} / 3 LEVELS</span><span>PLAY ↗</span></div>` +
        `<h3>${games[r.id].info.game}</h3>` +
        `<p>${r.name} · ${games[r.id].info.genre.toLowerCase()}</p></div></button>`
    )
    .join('');
  $$('[data-mini]').forEach(cv => miniScene(cv.getContext('2d'), +cv.dataset.mini, 260, 135));
}

// Frame loop and canvas sizing.
const viewport = { w: 1000, h: 625, dpr: Math.min(2, window.devicePixelRatio || 1) };

let renderDelta = 1 / 60,
  frameCount = 0,
  fpsStart = 0;

function configureCanvas(cv, w, h) {
  const d = viewport.dpr;
  cv.width = Math.ceil(w * d);
  cv.height = Math.ceil(h * d);
  const ctx = cv.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function setupIllustrations() {
  configureCanvas($('portrait'), 80, 112);
  configureCanvas($('miniPreview'), 420, 240);
  configureCanvas($('resultArt'), 800, 220);
  $$('[data-mini]').forEach(cv => {
    configureCanvas(cv, 260, 135);
    miniScene(cv.getContext('2d'), +cv.dataset.mini, 260, 135);
  });
}

function resize() {
  const r = $('stage').getBoundingClientRect();
  viewport.w = Math.min(1000, (625 * r.width) / r.height);
  configureCanvas(canvas, viewport.w, 625);
  // A closed arcade keeps the 800 × 450 canvas it starts with.
  const size = mini.open ? games[mini.id].canvas : { w: 800, h: 450 };
  configureCanvas($('miniCanvas'), size.w, size.h);
}

// Fixed small simulation steps keep 30, 60 and 120 Hz displays moving identically.
function advanceSimulation(dt) {
  dt = clamp(dt, 0, 0.05);
  const n = Math.max(1, Math.ceil(dt * 120));
  for (let i = 0; i < n; i++) updateWorld(dt / n);
}

function animateFrame(now) {
  renderDelta = Math.min(0.05, (now - last) / 1000 || 1 / 60);
  last = now;
  advanceSimulation(renderDelta);
  drawWorld();
  if (mini.open) {
    drawMini();
    if (mini.screen === 'result' && gore.length) drawResultArt();
  }
  frameCount++;
  if (!fpsStart) fpsStart = now;
  if (now - fpsStart >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - fpsStart));
    canvas.dataset.fps = String(fps);
    $('playStatus').textContent =
      fps + ' fps · ' + (state.started ? 'EXPLORE / PLAY / GET HOME' : 'READY WHEN YOU ARE');
    frameCount = 0;
    fpsStart = now;
  }
  requestAnimationFrame(animateFrame);
}
