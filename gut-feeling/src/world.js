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

// Ward-side state that only this file touches.
const ROOM_IRIS_SECONDS = 0.25,
  THICK_SKIN_SECONDS = 2.6,
  ARCADE_LOCKED_TOAST = 'Clear the ward first. The gremlins are sitting on the arcade.',
  wardCoarsePointer = matchMedia('(pointer: coarse)').matches;

let toastSerial = 0,
  wardCameraY = 0,
  wardIris = 0,
  wardHpSeen = state.hp,
  wardPauseShown = false;

function toast(t, sec = 3) {
  toastSerial++;
  $('toast').textContent = t;
  $('toast').classList.add('show');
  toastTimer = sec;
}

function coins(n) {
  if (!Number.isFinite(n)) return;
  state.coins += n;
  if (n > 0) state.coinsEarned += n;
  save();
  hud();
}

// Combat owns wardLocked(); until it exists, every arcade is open.
function arcadeBlocked(id = state.room) {
  return typeof wardLocked === 'function' && !!wardLocked(id);
}

// Every way into a room's arcade (beacon, gamebar, map, Enter) goes through here.
function tryOpenArcade(id = state.room) {
  if (arcadeBlocked(id)) {
    toast(ARCADE_LOCKED_TOAST, 2.6);
    sfx('miss');
    return false;
  }
  openMini(id);
  return true;
}

function passportRalphLine() {
  if (state.ralph) return '✓ Ralph evicted. The exit is yours.';
  if (state.ralphReady) return '! Ralph is blocking the exit. Go to your room.';
  return '○ Then Ralph. He thinks he is the exit.';
}

function hud() {
  const max = maxHearts();
  $('hearts').innerHTML = Array.from(
    { length: max },
    (_, i) => `<svg class="${i < state.hp ? '' : 'empty'}" aria-hidden="true"><use href="#i-heart"/></svg>`
  ).join('');
  $('hearts').setAttribute('aria-label', `${state.hp} of ${max} hearts`);
  $('healthName').textContent = state.name ? `${state.name} / ${state.hp} hearts` : 'Queasiness resistance';
  $('score').textContent = String(state.coins).padStart(4, '0');
  $('foodCount').textContent = state.food + ' / ' + maxFood();
  $('eatBtn').disabled = state.food === 0 || state.hp >= max;
  $('hudEat').textContent = '+♥ ' + state.food;
  $('hudEat').disabled = state.food === 0 || state.hp >= max;
  $('hudEat').setAttribute('aria-label', `Eat a nutrient. ${state.food} carried.`);
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
    `${stamps()}/${rooms.length} arcades stamped · ${levelTwo() ? '✓' : '○'} Level 2 medal\n${passportRalphLine()}\nBronze 1★ · Silver 2★ · Gold 3★`;
  $('storageNote').style.display = storageOK ? 'none' : 'block';
  renderHall();
  renderDaily();
}

// Hall of Nonsense: lifetime stats for the sidebar and the map.
function renderHall() {
  const medals = state.medals.flat(),
    count = n => medals.filter(m => m === n).length,
    streak = dailyStreak(),
    stats = [
      ['Gremlins evicted', state.evictions],
      ['Best chain', state.bestChain],
      ['Medals', `${count(3)} gold · ${count(2)} silver · ${count(1)} bronze`],
      ['Lifetime coins', state.coinsEarned],
      ['Runs played', state.runs],
      ['Daily streak', streak + (streak === 1 ? ' day' : ' days')]
    ],
    grudge = rooms
      .filter(r => r.id !== 0 && r.id !== 5)
      .map(r => {
        const n = state.wardClears[r.id] || 0;
        return (
          `<div class="hall-row"><span>${r.name}</span>` +
          `<strong>${n ? 'Grudge lvl ' + n : 'Not yet annoyed'}</strong></div>`
        );
      })
      .join(''),
    html =
      `<div class="hall-stats">` +
      stats.map(([k, v]) => `<div class="hall-row"><span>${k}</span><strong>${v}</strong></div>`).join('') +
      `</div><p class="hall-kicker">RALPH’S GRUDGE · WARD CLEARS</p><div class="hall-stats">${grudge}</div>`;
  $('hallStats').innerHTML = html;
  $('mapHall').innerHTML = html;
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

function roomToast(id) {
  if (id === 0 && state.ralphReady && !state.ralph) return 'Ralph is in your room. He is not here to visit.';
  if (id === 5) return 'After hours. Bedside Blaster is up. Ralph brought friends.';
  if (id === 0) return 'Home base. Snacks on the rug. IV game by the bed.';
  return arcadeBlocked(id)
    ? 'Three waves stand between you and this arcade. Make them regret it.'
    : 'Grab supplies, then find the glowing arcade beacon.';
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
  wardHpSeen = state.hp;
  const toastsBefore = toastSerial;
  // The room track starts first so a boss intro inside startEncounter can take over the music.
  music('room:' + id);
  startEncounter();
  $('roomTitle').textContent = rooms[id].name;
  $('roomSub').textContent = rooms[id].sub;
  $('sceneTag').textContent =
    id === 0 || id === 5 ? 'SAFE ROOM / DANGEROUSLY COZY' : 'DODGE THE BLOBS / FIND THE ARCADE';
  $('arcadeBtn').innerHTML =
    `<span aria-hidden="true">▶</span> <span class="launch-name">${games[id].info.game}</span>`;
  $('arcadeBtn').setAttribute('aria-label', 'Play ' + games[id].info.game);
  renderMap();
  if (state.started) {
    wardIris = reduced ? 0 : ROOM_IRIS_SECONDS;
    // Combat may announce its own wave or boss on entry; the room line only fills silence.
    if (toastSerial === toastsBefore) toast(roomToast(id), 3);
  }
}

function begin() {
  if (state.started) return;
  state.started = true;
  if (!state.played) {
    state.played = true;
    save();
  }
  document.body.classList.add('playing');
  state.paused = false;
  $('startCallout').classList.add('hidden');
  $('playStatus').textContent = 'EXPLORE / PLAY / GET HOME';
  loadRoom(state.room);
  canvas.focus({ preventScroll: true });
  sfx('ui');
}

// The ward pause menu. state.paused changes in several places; drawWorld keeps the overlay in sync.
function setWardPause(on) {
  if (!state.started) return;
  state.paused = !!on;
  clearHeld();
  syncWardPause();
  if (!on) canvas.focus({ preventScroll: true });
}

function syncWardPause() {
  const on = state.started && state.paused && !mini.open;
  if (on === wardPauseShown) return;
  wardPauseShown = on;
  document.body.classList.toggle('ward-paused', on);
  $('wardPaused').classList.toggle('hidden', !on);
  $('pauseBtn').setAttribute('aria-pressed', String(on));
  if (on) $('wardResume').focus({ preventScroll: true });
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
  if (isModal() || state.paused || deadDelay > 0 || state.hp >= maxHearts() || !state.food) return;
  state.food--;
  state.hp++;
  player.eat = 0.9;
  player.inv = Math.max(player.inv, 0.5);
  sfx('eat');
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
  wardHpSeen = state.hp;
  for (let s of supplies.filter(supplyAvailable))
    if (dist(s, player) < 27 && state.food < maxFood()) {
      state.taken.push(s.id);
      state.food++;
      floating('+1 ' + s.type.toUpperCase(), s.x, s.y - 50, '#b7e6bd');
      toast('Nutrient stashed. Drink / eat (F) when you need a heart.', 2.7);
      save();
      hud();
      sfx('pickup');
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
  const vw = viewport.w,
    vh = viewport.h,
    ease = 1 - Math.exp(-renderDelta * 12);
  syncWardPause();
  c.clearRect(0, 0, vw, vh);
  cameraX += (clamp(player.x - vw / 2, 0, Math.max(0, 1000 - vw)) - cameraX) * ease;
  // Screens wider than 1.6 show a horizontal slice of the room and follow Macy vertically.
  wardCameraY += (clamp(player.y - vh * 0.58, 0, Math.max(0, 625 - vh)) - wardCameraY) * ease;
  c.save();
  c.translate(-cameraX + (shake ? rand(-3, 3) : 0), -wardCameraY + (shake ? rand(-2, 2) : 0));
  roomBg(c, state.room);
  for (let p of puddles) {
    if (p.gunk) continue;
    c.globalAlpha = Math.min(1, p.life);
    ellipse(c, p.x, p.y, 30, 8, '#8da744');
    ellipse(c, p.x - 4, p.y - 2, 18, 4, '#b4c969');
  }
  c.globalAlpha = 1;
  if (typeof drawCombatGround === 'function') drawCombatGround(c);
  const station = rooms[state.room].station,
    near = dist(player, { x: station[0], y: station[1] }) < 65,
    locked = arcadeBlocked();
  ellipse(c, ...station, 48, 17, locked ? '#6a3a4a55' : '#285f6266');
  c.strokeStyle = locked ? '#f0a7a0' : '#b9ebbb';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(station[0], station[1], 43 + (locked ? 0 : Math.sin(time * 3) * 2), 14, 0, 0, Math.PI * 2);
  c.stroke();
  if (!locked) spark(c, station[0], station[1] - 50 + Math.sin(time * 3) * 4, '#ffe29b', 1);
  label(
    c,
    locked ? 'LOCKED' : near ? (wardCoarsePointer ? 'TAP TO PLAY' : 'ENTER / PLAY') : 'ARCADE',
    station[0],
    station[1] + 31,
    12,
    locked ? '#7a2f45' : '#244d53',
    'center'
  );
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
  if (typeof drawCombatFx === 'function') drawCombatFx(c);
  rect(c, 0, 603, 1000, 22, '#244856');
  rect(c, 24, 603, 952, 4, '#90b6a2');
  c.restore();
  if (typeof drawCombatOverlay === 'function') drawCombatOverlay(c, vw);
  if (state.paused) rect(c, 0, 0, vw, vh, '#102734aa');
  if (wardIris > 0) drawRoomIris(vw, vh);
}

// A 250 ms iris opens on Macy after each room change (skipped under reduced motion).
function drawRoomIris(vw, vh) {
  const t = 1 - wardIris / ROOM_IRIS_SECONDS,
    r = Math.max(1, t * t * Math.hypot(vw, vh));
  wardIris = Math.max(0, wardIris - renderDelta);
  c.save();
  c.beginPath();
  c.rect(0, 0, vw, vh);
  c.arc(player.x - cameraX, player.y - 45 - wardCameraY, r, 0, Math.PI * 2, true);
  c.fillStyle = '#0b1b25';
  c.fill('evenodd');
  c.restore();
}

// World coordinates of a pointer on the ward canvas.
function wardPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: cameraX + ((e.clientX - r.left) * viewport.w) / Math.max(1, r.width),
    y: wardCameraY + ((e.clientY - r.top) * viewport.h) / Math.max(1, r.height)
  };
}

// Tapping the beacon is the touch version of Enter.
function beaconTapped(p) {
  const [x, y] = rooms[state.room].station;
  return Math.abs(p.x - x) < 70 && p.y > y - 85 && p.y < y + 45;
}

function renderMap() {
  const exit = state.won
    ? 'Discharged!'
    : state.ralphReady && !state.ralph
      ? 'Ralph is in the way.'
      : 'Homeward bound.';
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
    `<strong>${exit}</strong>` +
    `<small>${stars()}/12 stars · ${stamps()}/${rooms.length} arcades · ` +
    `${state.ralph ? 'Ralph evicted' : 'Ralph pending'}</small></div>`;
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

// HUD card size bucket: the cards must end above WALL_SIGN_TOP at the current canvas scale.
function hudBucket(px) {
  return px >= 52 ? 'l' : px >= 36 ? 'm' : px >= 28 ? 's' : 'xs';
}

function resize() {
  const r = $('stage').getBoundingClientRect();
  if (r.width > 0 && r.height > 0) {
    const aspect = r.width / r.height;
    viewport.w = Math.min(1000, 625 * aspect);
    viewport.h = viewport.w < 1000 ? 625 : clamp(1000 / aspect, 300, 625);
    $('stage').dataset.hud = hudBucket(((WALL_SIGN_TOP - 4) * r.height) / viewport.h);
  }
  configureCanvas(canvas, viewport.w, viewport.h);
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
