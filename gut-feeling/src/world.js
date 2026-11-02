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

// ---- Room extras (src/hallway.js, when it is present) ----
// Optional globals another file may define: hallwayInstall(), updateRoomExtras(dt),
// roomExtraRenderables(), drawRoomOverlay(g, vw, vh), roomExtrasAction(kind, point), hallwayEnter(id),
// hallwayRoomBg(g) and onRoomLoaded(id). Every call is guarded, so the ward runs the same without them.

// Gives an extra room the first say on an action ('attack', 'jump', 'dash', 'use', 'enter', 'tap').
// point is in room coordinates for taps. True means it handled the action.
function roomAction(kind, point) {
  return typeof roomExtrasAction === 'function' && !!roomExtrasAction(kind, point);
}

const NO_ARCADE_TOAST = 'No arcade out here. The games live in the departments.';

// Combat owns wardLocked(); until it exists, every arcade is open.
function arcadeBlocked(id = state.room) {
  return typeof wardLocked === 'function' && !!wardLocked(id);
}

// Every way into a room's arcade (beacon, gamebar, map, Enter) goes through here.
function tryOpenArcade(id = state.room) {
  if (!isArcadeRoom(id)) {
    toast(NO_ARCADE_TOAST, 2.4);
    return false;
  }
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
  // The touch EAT button: the badge counts nutrients; it greys out when empty or at full hearts.
  $('touchEat').disabled = state.food === 0 || state.hp >= max;
  $('touchEatCount').textContent = String(state.food);
  $('touchEat').setAttribute(
    'aria-label',
    state.hp >= max ? `Eat a nutrient. Hearts full. ${state.food} carried.` : `Eat a nutrient. ${state.food} carried.`
  );
  $('difficultyBtn').textContent = cfg().name + ' ⚙';
  $('heroName').value = state.name;
  $('passport').innerHTML = rooms
    .filter(r => isArcadeRoom(r.id))
    .map(
      r =>
        `<div class="passport-row">` +
        `<span>${state.medals[r.id].some(Boolean) ? '✓' : '○'} ${r.name}</span>` +
        `<span>${state.medals[r.id].map(m => (m ? '★'.repeat(m) : '·')).join(' ')}</span></div>`
    )
    .join('');
  $('progressLabel').textContent = stars() + ' / 12';
  $('progressBar').style.width = Math.min(100, (stars() / 12) * 100) + '%';
  $('dischargeRules').textContent =
    `${stamps()}/${ARCADE_COUNT} arcades stamped · ${levelTwo() ? '✓' : '○'} Level 2 medal\n${passportRalphLine()}\nBronze 1★ · Silver 2★ · Gold 3★`;
  // The map dialog repeats the progress line, since arcade mode hides the passport card.
  $('mapPassport').textContent =
    `★ ${stars()}/12 stars · ${stamps()}/${ARCADE_COUNT} arcades · ${levelTwo() ? '✓' : '○'} level 2 medal · ` +
    passportRalphLine().replace(/^[✓!○] /, '');
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
      ['Runs played', state.runs],
      ['Lifetime coins', state.coinsEarned],
      ['Gold · silver · bronze', `${count(3)} · ${count(2)} · ${count(1)}`],
      ['Daily streak', streak + (streak === 1 ? ' day' : ' days')]
    ],
    grudge = rooms
      .filter(r => isArcadeRoom(r.id) && r.id !== 0 && r.id !== 5)
      .map(r => {
        const n = state.wardClears[r.id] || 0;
        return `<span class="grudge-chip"><span>${r.name}</span><b>${n ? 'LV ' + n : 'calm'}</b></span>`;
      })
      .join(''),
    html =
      `<div class="hall-stats">` +
      stats.map(([k, v]) => `<div class="hall-row"><strong>${v}</strong><span>${k}</span></div>`).join('') +
      `</div><p class="hall-kicker">Ralph’s grudge · ward clears</p><div class="grudge-chips">${grudge}</div>`;
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
  wardTouchReset();
}

function modalOpen(d) {
  clearHeld();
  if (!d.open) d.showModal();
}

function isModal() {
  return $$('dialog').some(d => d.open);
}

function roomToast(id) {
  if (!isArcadeRoom(id)) return rooms[id].toast || 'Hallway. Be nice to the nurses. They know where the pudding is.';
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
  wardTouchReset();
  wardHpSeen = state.hp;
  const toastsBefore = toastSerial;
  // The room track starts first so a boss intro inside startEncounter can take over the music.
  music('room:' + id);
  startEncounter();
  $('roomTitle').textContent = rooms[id].name;
  $('roomSub').textContent = rooms[id].sub;
  const arcade = isArcadeRoom(id);
  $('sceneTag').textContent = !arcade
    ? rooms[id].tag || 'HALLWAY / BE NICE TO THE NURSES'
    : id === 0 || id === 5
      ? 'SAFE ROOM / DANGEROUSLY COZY'
      : 'DODGE THE BLOBS / FIND THE ARCADE';
  // Rooms without an arcade (the hallway) hide the play button.
  $('arcadeBtn').classList.toggle('hidden', !arcade);
  if (arcade) {
    $('arcadeBtn').innerHTML =
      `<span aria-hidden="true">▶</span> <span class="launch-name">${games[id].info.game}</span>`;
    $('arcadeBtn').setAttribute('aria-label', 'Play ' + games[id].info.game);
  }
  renderMap();
  if ($('mapDialog').open && typeof hospitalMapInvalidate === 'function') hospitalMapInvalidate();
  if (state.started) {
    wardIris = reduced ? 0 : ROOM_IRIS_SECONDS;
    // Combat may announce its own wave or boss on entry; the room line only fills silence.
    // Rooms without an arcade (the hallway) do their own greeting.
    if (toastSerial === toastsBefore && !rooms[id].noArcade) toast(roomToast(id), 3);
  }
  if (typeof onRoomLoaded === 'function') onRoomLoaded(id);
}

function begin() {
  titleHide();
  if (state.started) return;
  state.started = true;
  if (!state.played) {
    state.played = true;
    save();
  }
  document.body.classList.add('playing');
  state.paused = false;
  $('playStatus').textContent = 'EXPLORE / PLAY / GET HOME';
  loadRoom(state.room);
  // First steps on a touch screen: the room is the controller.
  if (wardCoarsePointer && tapScheme())
    toast('Tap to walk. Tap a gremlin to bonk it. Flick to dash. Two fingers: jump.', 4.5);
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
    x > roomWidth() - 40 ||
    y < 170 ||
    y > 574 ||
    (roomProps[state.room] || []).some(p => {
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

// ---- Title screen ----
// #titleScreen owns the viewport on load: the hospital at dusk drawn on #titleArt, the logo, and one
// START. Any key, any tap or the button starts; the screen irises out (instantly under reduced motion)
// and begin() runs. "Quit to title" in the pause menu brings it back. Under reduced motion the art
// holds still. After TITLE_ATTRACT_SECONDS idle, a gremlin runs past and Macy's window flickers.
const TITLE_IRIS_SECONDS = reduced ? 0 : 0.25,
  TITLE_ATTRACT_SECONDS = 25;

let titleUp = false,
  titleLeaving = 0,
  titleT = 0,
  titleIdle = 0,
  titleLook = { x: 0, y: 0 },
  titleSize = { w: 0, h: 0 };

function titleShow() {
  titleUp = true;
  titleLeaving = 0;
  titleIdle = 0;
  $('titleScreen').dataset.state = 'up';
  $('titleWelcome').textContent = titleWelcomeLine();
  document.body.classList.add('title-up');
  music('title');
  titleFit();
  $('titleStart').focus({ preventScroll: true });
}

function titleWelcomeLine() {
  if (!state.played) return '';
  if (state.ralphReady && !state.ralph) return `Welcome back, ${state.name || 'Macy'}. Ralph is waiting in your room.`;
  return `Welcome back, ${state.name || 'Macy'}. The gremlins ate your pudding.`;
}

// Gone at once: begin() calls this, so every other way into the game clears the title too.
function titleHide() {
  if (!titleUp) return;
  titleUp = false;
  titleLeaving = 0;
  $('titleScreen').dataset.state = 'gone';
  document.body.classList.remove('title-up');
}

// START, any key or any tap. Returns false when the title is not up or is already leaving.
function titleStart() {
  if (!titleUp || titleLeaving > 0) return false;
  sfx('go');
  if (TITLE_IRIS_SECONDS <= 0) {
    titleFinish();
    return true;
  }
  titleLeaving = TITLE_IRIS_SECONDS;
  $('titleScreen').dataset.state = 'leaving';
  return true;
}

// The frame loop (and tests) advance the iris; when it closes, the game begins.
function titleTick(dt) {
  if (!titleUp) return;
  titleT += reduced ? 0 : dt;
  titleIdle += dt;
  if (titleLeaving > 0) {
    titleLeaving -= dt;
    if (titleLeaving <= 0) titleFinish();
  }
}

function titleFinish() {
  titleHide();
  begin();
  // A save left at zero hearts goes straight to the recovery.
  if (state.hp === 0 && !mini.open) openMini(0, true);
  if (!document.body.classList.contains('arcade'))
    $('cabinet').scrollIntoView({ block: 'start', behavior: 'instant' });
}

// "Quit to title": save, stop the ward, show the title again.
function titleQuit() {
  save();
  $$('dialog[open]').forEach(d => d.close());
  setWardPause(false);
  clearHeld();
  state.started = false;
  state.paused = true;
  document.body.classList.remove('playing');
  syncWardPause();
  titleShow();
}

function titleNudge(x, y) {
  titleIdle = 0;
  if (reduced || !titleSize.w) return;
  titleLook = { x: clamp(x / titleSize.w - 0.5, -0.5, 0.5), y: clamp(y / titleSize.h - 0.5, -0.5, 0.5) };
}

function titleFit() {
  const w = window.innerWidth || 1280,
    h = window.innerHeight || 800;
  if (w === titleSize.w && h === titleSize.h) return;
  titleSize = { w, h };
  configureCanvas($('titleArt'), w, h);
}

function drawTitle() {
  if (!titleUp) return;
  titleFit();
  drawTitleArt($('titleArt').getContext('2d'), titleSize.w, titleSize.h, titleT, titleIdle > TITLE_ATTRACT_SECONDS);
}

// A cheap stable hash for window patterns.
function titleHash(i, j) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// The hospital at dusk. t is seconds (frozen under reduced motion); attract adds the runner and the flicker.
function drawTitleArt(g, w, h, t, attract) {
  const lx = titleLook.x * 16,
    ly = titleLook.y * 10,
    tall = h > w,
    groundY = h * 0.79,
    bh = Math.min(h * 0.43, w * (tall ? 0.95 : 0.48)),
    bw = Math.min(w * 0.86, bh * 2.25),
    bx = w / 2 - bw / 2 + lx,
    by = groundY - bh + ly * 0.4,
    s = bh / 300;
  // Sky, stars, moon, clouds.
  rect(g, 0, 0, w, h, gradient(g, 0, 0, 0, groundY, '#131c38', '#c47a7c'));
  rect(g, 0, groundY * 0.55, w, groundY * 0.45, gradient(g, 0, groundY * 0.55, 0, groundY * 0.45, '#6a4f7000', '#e9a07a66'));
  for (let i = 0; i < 46; i++) {
    const x = titleHash(i, 1) * w,
      y = titleHash(i, 2) * groundY * 0.5;
    g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + i);
    rect(g, x, y, 2, 2, '#fff6dd');
  }
  g.globalAlpha = 1;
  const mx = w * 0.82 + lx * 0.3,
    my = h * (tall ? 0.22 : 0.14) + ly * 0.3,
    mr = Math.max(18, Math.min(w, h) * 0.055);
  ellipse(g, mx, my, mr * 2.2, mr * 2.2, '#f8efd914');
  ellipse(g, mx, my, mr, mr, '#f8efd9');
  ellipse(g, mx - mr * 0.3, my - mr * 0.2, mr * 0.22, mr * 0.22, '#e3d6b8');
  ellipse(g, mx + mr * 0.25, my + mr * 0.3, mr * 0.15, mr * 0.15, '#e3d6b8');
  for (let i = 0; i < 3; i++) {
    const cx = ((((i * 0.37 + t * 0.012 * (i + 1)) % 1.4) + 1.4) % 1.4 - 0.2) * w + lx * 0.5,
      cy = h * (0.1 + i * 0.09) + ly * 0.5,
      cs = (0.7 + i * 0.25) * Math.max(1, w / 900);
    for (const [ox, oy, r] of [[-38, 4, 26], [0, -6, 34], [40, 4, 24]])
      ellipse(g, cx + ox * cs, cy + oy * cs, r * cs * 1.6, r * cs * 0.75, '#e6a3a240');
  }
  // Gremlins peeking over the roof, drawn first so the building hides their feet.
  for (const [fx, phase, type] of [[0.18, 0, 0], [0.71, 2.1, 3], [0.46, 4.4, 1]]) {
    const peek = reduced ? 0.6 : Math.max(0, Math.sin(t * 0.7 + phase)),
      gs = 0.8 * s;
    gremlin(g, bx + bw * fx, by + 52 * gs - peek * 38 * gs, gs, type, t + phase);
  }
  // The building: facade, side face, roof cap, cross sign.
  rr(g, bx + bw * 0.02, by + 6, bw, bh, 10 * s, '#132a33');
  rr(g, bx, by, bw, bh, 10 * s, gradient(g, bx, by, 0, bh, '#36606d', '#24434f'));
  rect(g, bx, by, bw, 14 * s, '#1d3742');
  rr(g, bx + bw / 2 - 34 * s, by - 46 * s, 68 * s, 46 * s, 8 * s, '#1d3742');
  rect(g, bx + bw / 2 - 7 * s, by - 40 * s, 14 * s, 34 * s, '#ffa48e');
  rect(g, bx + bw / 2 - 17 * s, by - 30 * s, 34 * s, 14 * s, '#ffa48e');
  // Windows: four floors. Macy's is lit and has company; a few dark ones have eyes.
  const cols = Math.max(4, Math.round(bw / (70 * s))),
    cw = bw / cols,
    rows = Math.max(4, Math.round((bh - 70 * s) / (cw * 0.95))),
    rh = (bh - 70 * s) / rows,
    ww = cw * 0.56,
    wh = rh * 0.6,
    macyCol = Math.floor(cols * 0.3),
    macyRow = 1,
    flicker = attract && !reduced ? 0.55 + 0.45 * Math.abs(Math.sin(t * 17) * Math.sin(t * 5.3)) : 1;
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++) {
      const x = bx + col * cw + (cw - ww) / 2,
        y = by + 26 * s + r * rh,
        macy = r === macyRow && col === macyCol,
        lit = macy || titleHash(col, r) > 0.42;
      if (macy) {
        g.globalAlpha = flicker;
        ellipse(g, x + ww / 2, y + wh / 2, ww * 1.1, wh * 1.1, '#ffe7a833');
        rr(g, x, y, ww, wh, 4 * s, '#ffe7a8');
        g.globalAlpha = 1;
        titleSilhouette(g, x, y, ww, wh);
      } else rr(g, x, y, ww, wh, 4 * s, lit ? '#f2c87ad0' : '#14252f');
      rect(g, x, y + wh * 0.48, ww, Math.max(1, 2 * s), '#24434f66');
      if (!lit && titleHash(col + 9, r + 3) > 0.45) titleEyes(g, x + ww / 2, y + wh / 2, ww, t + col * 1.7 + r);
    }
  // Entrance and the glowing EXIT sign.
  const dw = 70 * s,
    dx = bx + bw / 2 - dw / 2,
    glow = reduced ? 0.8 : 0.65 + 0.35 * Math.sin(t * 2.4);
  rr(g, dx, groundY - 62 * s + ly * 0.4, dw, 62 * s, 6 * s, '#0f1f27');
  rect(g, dx + dw / 2 - 1, groundY - 62 * s + ly * 0.4, 2, 62 * s, '#36606d');
  g.globalAlpha = glow;
  ellipse(g, bx + bw / 2, groundY - 76 * s + ly * 0.4, 46 * s, 18 * s, '#5dffa244');
  g.globalAlpha = 1;
  rr(g, bx + bw / 2 - 26 * s, groundY - 86 * s + ly * 0.4, 52 * s, 20 * s, 4 * s, '#1b8a5a');
  label(g, 'EXIT', bx + bw / 2, groundY - 71 * s + ly * 0.4, Math.max(9, 13 * s), '#d4ffe2', 'center');
  // Ground, path and two street lamps.
  rect(g, 0, groundY, w, h - groundY, gradient(g, 0, groundY, 0, h - groundY, '#1a3540', '#0c1a21'));
  rect(g, 0, groundY, w, 3, '#2f5560');
  poly(g, [[dx + 6 * s, groundY], [dx + dw - 6 * s, groundY], [dx + dw + 30 * s, h], [dx - 30 * s, h]], '#22414c');
  for (const fx of [0.08, 0.92]) {
    const x = w * fx + lx;
    rect(g, x - 2, groundY - 120 * s, 4, 120 * s, '#0e1c23');
    ellipse(g, x, groundY - 122 * s, 26 * s, 26 * s, '#ffdf9a33');
    ellipse(g, x, groundY - 122 * s, 7 * s, 7 * s, '#ffe9b8');
  }
  // Attract: a gremlin sprints along the sidewalk.
  if (attract) {
    const run = (((t * 150) % (w + 160)) + w + 160) % (w + 160),
      rx = run - 80;
    gremlin(g, rx, groundY + (h - groundY) * 0.42, 0.9 * s, 2, t * 3);
  }
}

// Macy at her window: the IV stand on the left, her silhouette with the ponytail.
function titleSilhouette(g, x, y, ww, wh) {
  const ink = '#2a2a35',
    u = wh / 40;
  rect(g, x + ww * 0.18, y + wh * 0.18, Math.max(1.5, u), wh * 0.82, ink);
  rect(g, x + ww * 0.1, y + wh * 0.16, ww * 0.18, Math.max(1.5, u), ink);
  rr(g, x + ww * 0.08, y + wh * 0.2, ww * 0.12, wh * 0.18, 2, ink);
  ellipse(g, x + ww * 0.6, y + wh * 0.48, wh * 0.14, wh * 0.15, ink);
  ellipse(g, x + ww * 0.6 - wh * 0.16, y + wh * 0.52, wh * 0.07, wh * 0.16, ink);
  rr(g, x + ww * 0.6 - wh * 0.22, y + wh * 0.66, wh * 0.44, wh * 0.36, wh * 0.12, ink);
}

// A pair of gremlin eyes in a dark window, blinking now and then.
function titleEyes(g, x, y, ww, t) {
  const r = Math.max(2, ww * 0.07),
    shut = !reduced && ((t * 0.9) % 4) > 3.82;
  for (const side of [-1, 1]) {
    if (shut) rect(g, x + side * r * 1.6 - r, y, r * 2, Math.max(1, r * 0.4), '#d7f27a');
    else {
      ellipse(g, x + side * r * 1.6, y, r, r * 1.2, '#d7f27a');
      ellipse(g, x + side * r * 1.6 + r * 0.25, y + r * 0.1, r * 0.4, r * 0.5, '#1b2a10');
    }
  }
}

// ---- Weapon changes ----
// equip() (combat.js) swaps the buttons. This notices any change (strip, keys, sidebar), slides the
// strip highlight and flashes the weapon over Macy for a second, so a swap is never a surprise.
const WEAPON_FLASH_SECONDS = 1,
  WEAPON_ICON_PATHS = {
    pillow: 'm4 3 3 2h10l3-2 1 3-2 3v7l2 4-4-1H7l-4 2 1-5V8L2 4zM8 8h8m-9 7h9',
    bag: 'M7 3h10l-1 5 3 13H5L8 8zM7 6h10m-7 8h4m-2-2v4',
    brick: 'm3 10 9-5 9 5v8l-9 5-9-5zM3 10l9 5 9-5m-9 5v8M7 7V4l3-2 3 2v3m0-1V3l3-2 3 2v5'
  };

let wardWeaponSeen = state.item,
  wardWeaponFlash = 0;

// Returns true when the weapon changed since the last call.
function wardWeaponSync() {
  if (state.item === wardWeaponSeen) return false;
  wardWeaponSeen = state.item;
  wardWeaponFlash = WEAPON_FLASH_SECONDS;
  const strip = $('weaponStrip');
  strip.dataset.active = String(state.item);
  // Alternating names restart the CSS pop on every change.
  strip.dataset.pop = strip.dataset.pop === 'a' ? 'b' : 'a';
  sfx('select');
  return true;
}

function drawWeaponFlash(vw, vh) {
  if (wardWeaponFlash <= 0) return;
  const w = weapons[state.item],
    text = w.name.toUpperCase() + ' · ' + w.verb,
    boxW = 74 + text.length * 11.5,
    age = WEAPON_FLASH_SECONDS - wardWeaponFlash,
    fade = Math.min(1, wardWeaponFlash / 0.3),
    pop = reduced ? 1 : 1 + Math.max(0, 0.16 - age) * 1.6,
    x = clamp(player.x - cameraX, boxW / 2 + 8, vw - boxW / 2 - 8),
    y = clamp(player.y - wardCameraY - player.z - 150, 70, vh - 40);
  wardWeaponFlash = Math.max(0, wardWeaponFlash - renderDelta);
  c.save();
  c.globalAlpha = fade;
  c.translate(x, y);
  c.scale(pop, pop);
  rr(c, -boxW / 2, -25, boxW, 50, 25, '#173847ee', '#ffe29b', 2.5);
  c.save();
  c.translate(-boxW / 2 + 16, -16);
  c.scale(1.35, 1.35);
  c.strokeStyle = '#ffe29b';
  c.lineWidth = 1.9;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke(new Path2D(WEAPON_ICON_PATHS[w.icon]));
  c.restore();
  label(c, text, 22, 7, 20, '#ffe29b', 'center');
  c.restore();
}

// ---- Tap the room ----
// On touch screens the floor is the controller: tap to walk there, tap a gremlin to go and hit it (hold
// to keep swinging), flick to dash, tap with two fingers to jump, long-press the floor for the ability.
// state.controls === 'stick' swaps this for the joystick and the full button column. Mice never use it.
const TAP_ARRIVE = 12,
  TAP_SLOP = 12,
  TAP_GREMLIN_RADIUS = 40,
  FLICK_DISTANCE = 40,
  FLICK_SECONDS = 0.25,
  LONG_PRESS_SECONDS = 0.45,
  TWO_FINGER_SECONDS = 0.2,
  TAP_STUCK_SECONDS = 0.6,
  TAP_PREY_GIVE_UP = 3,
  TAP_RIPPLE_SECONDS = 0.45;

// wardTouches: pointerId -> finger. wardGoal: floor point Macy walks to. wardPrey: the gremlin she is after.
let wardTouches = new Map(),
  wardGoal = null,
  wardPrey = null,
  wardGoalBest = Infinity,
  wardStuck = 0,
  wardRipples = [];

function tapScheme() {
  return state.controls !== 'stick';
}

function wardTouchReset() {
  wardTouches.clear();
  wardGoal = null;
  wardPrey = null;
}

// The live gremlin nearest a tap, within TAP_GREMLIN_RADIUS of its feet or its body.
function wardGremlinAt(p) {
  let best = null,
    bestD = Infinity;
  for (const e of wardFighters()) {
    const d = Math.min(dist(p, e), dist(p, { x: e.x, y: e.y - (e.z || 0) - 32 }));
    if (d < TAP_GREMLIN_RADIUS && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function wardSetGoal(p) {
  wardGoal = { x: clamp(p.x, 40, roomWidth() - 40), y: clamp(p.y, 170, 574) };
  wardGoalBest = Infinity;
  wardStuck = 0;
}

// id: pointer id; cx, cy: client coordinates; p: the same point in room coordinates.
// Returns false when the ward is not taking input (the click handler then gets the tap).
function wardTouchDown(id, cx, cy, p) {
  if (!state.started || state.paused || isModal() || deadDelay > 0) return false;
  const finger = { id, x0: cx, y0: cy, t0: time, moved: false, long: false, kind: 'walk' };
  wardRipples.push({ x: p.x, y: p.y, t: 0 });
  if (wardTouches.size) {
    // Any second finger jumps. A first finger that landed a moment ago was half of the same tap,
    // so its walk is taken back.
    finger.kind = 'jump';
    for (const f of wardTouches.values())
      if (!f.moved && f.kind !== 'jump' && time - f.t0 < TWO_FINGER_SECONDS) {
        f.kind = 'jump';
        wardGoal = f.goalBefore;
        wardPrey = f.preyBefore;
      }
    wardTouches.set(id, finger);
    if (!roomAction('jump')) jump();
    return true;
  }
  finger.goalBefore = wardGoal;
  finger.preyBefore = wardPrey;
  wardTouches.set(id, finger);
  const e = wardGremlinAt(p);
  if (e) {
    finger.kind = 'prey';
    wardPrey = { e, held: true, swings: 0, idle: 0 };
    wardGoal = null;
  } else if (isArcadeRoom(state.room) && !arcadeBlocked() && beaconTapped(p)) finger.kind = 'beacon';
  else {
    wardPrey = null;
    wardSetGoal(p);
  }
  return true;
}

// Dragging steers: once a finger wanders past TAP_SLOP, the goal follows it.
function wardTouchMove(id, cx, cy, p) {
  const f = wardTouches.get(id);
  if (!f || f.kind === 'jump' || f.long) return;
  if (!f.moved && Math.hypot(cx - f.x0, cy - f.y0) > TAP_SLOP) f.moved = true;
  if (!f.moved) return;
  if (f.kind === 'prey' && wardPrey) wardPrey.held = false;
  f.kind = 'walk';
  wardPrey = null;
  wardSetGoal(p);
}

// cancel = true when the pointer was lost; a lost finger never acts.
function wardTouchUp(id, cx, cy, cancel = false) {
  const f = wardTouches.get(id);
  if (!f) return;
  wardTouches.delete(id);
  if (f.kind === 'prey' && wardPrey) wardPrey.held = false;
  if (cancel || f.kind === 'jump' || f.long) return;
  const dx = cx - f.x0,
    dy = cy - f.y0,
    d = Math.hypot(dx, dy);
  if (d >= FLICK_DISTANCE && time - f.t0 < FLICK_SECONDS) {
    // A flick dashes that way and then stands still.
    wardGoal = null;
    wardPrey = null;
    player.lastDx = dx / d;
    player.lastDy = dy / d;
    if (!roomAction('dash')) dash();
    return;
  }
  if (f.kind === 'beacon' && !f.moved) tryOpenArcade();
}

function wardAimAt(e, d) {
  // The brick lands where it is aimed, so its aim length sets the distance (attack() reads it as power).
  const k = state.item === 2 ? clamp(d / 230, 0.65, 1.35) : 1;
  wardAim = { dx: ((e.x - player.x) / d) * 65 * k, dy: ((e.y - player.y) / d) * 65 * k };
}

// One simulation step of the tap scheme. Returns the steering vector for this step.
function wardTouchStep(dt) {
  for (const f of wardTouches.values())
    if (f.kind === 'walk' && !f.moved && !f.long && wardTouches.size === 1 && time - f.t0 >= LONG_PRESS_SECONDS) {
      f.long = true;
      wardGoal = null;
      if (!roomAction('use')) useItem();
    }
  if (wardPrey) {
    const prey = wardPrey,
      e = prey.e;
    prey.idle += dt;
    if (e.hp <= 0 || e.gone || (!prey.held && (prey.swings > 0 || prey.idle > TAP_PREY_GIVE_UP))) wardPrey = null;
    else {
      const d = Math.max(1, dist(player, e)),
        range = state.item === 0 ? 86 : 300;
      if (d <= range) {
        const ready = player.attackCd <= 0;
        wardAimAt(e, d);
        attack();
        wardAim = null;
        if (ready && player.attackCd > 0) {
          prey.swings++;
          prey.idle = 0;
        }
        return { x: 0, y: 0 };
      }
      return { x: (e.x - player.x) / d, y: (e.y - player.y) / d };
    }
  }
  if (!wardGoal) return { x: 0, y: 0 };
  const d = dist(player, wardGoal);
  if (d <= TAP_ARRIVE) {
    wardGoal = null;
    return { x: 0, y: 0 };
  }
  // Furniture in the way: give up once Macy stops getting closer.
  if (d < wardGoalBest - 0.5) {
    wardGoalBest = d;
    wardStuck = 0;
  } else if ((wardStuck += dt) > TAP_STUCK_SECONDS) {
    wardGoal = null;
    return { x: 0, y: 0 };
  }
  return { x: (wardGoal.x - player.x) / d, y: (wardGoal.y - player.y) / d };
}

// Floor layer: the dashed walk line and the goal ring.
function drawWardGoal(g) {
  if (!wardGoal || !player.moving) return;
  g.setLineDash([7, 9]);
  line(g, [[player.x, player.y], [wardGoal.x, wardGoal.y]], '#fff4c8aa', 3);
  g.setLineDash([]);
  g.strokeStyle = '#fff4c8cc';
  g.lineWidth = 2.5;
  g.beginPath();
  g.ellipse(wardGoal.x, wardGoal.y, 14, 5, 0, 0, Math.PI * 2);
  g.stroke();
}

// Top layer: tap ripples and a ring on the gremlin Macy is after.
function drawWardTaps(g) {
  for (const r of wardRipples) {
    const k = r.t / TAP_RIPPLE_SECONDS;
    g.globalAlpha = Math.max(0, 1 - k);
    g.strokeStyle = '#fff4c8';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(r.x, r.y, 8 + k * 26, 0, Math.PI * 2);
    g.stroke();
    r.t += renderDelta;
  }
  g.globalAlpha = 1;
  wardRipples = wardRipples.filter(r => r.t < TAP_RIPPLE_SECONDS);
  if (!wardPrey) return;
  const e = wardPrey.e;
  g.strokeStyle = '#ffb19c';
  g.lineWidth = 2.5;
  g.setLineDash([5, 6]);
  g.lineDashOffset = reduced ? 0 : -time * 22;
  g.beginPath();
  g.ellipse(e.x, e.y, 30, 10, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.lineDashOffset = 0;
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
  const steer = wardTouchStep(dt);
  let dx =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0) +
      joy.x +
      steer.x,
    dy =
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0) +
      joy.y +
      steer.y;
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
  if (typeof updateRoomExtras === 'function') updateRoomExtras(dt);
  wardHpSeen = state.hp;
  for (let s of supplies.filter(supplyAvailable))
    if (dist(s, player) < 27 && state.food < maxFood()) {
      state.taken.push(s.id);
      state.food++;
      floating('+1 ' + s.type.toUpperCase(), s.x, s.y - 50, '#b7e6bd');
      toast(
        wardCoarsePointer
          ? 'Nutrient stashed. Tap EAT when you need a heart.'
          : 'Nutrient stashed. Drink / eat (F) when you need a heart.',
        2.7
      );
      save();
      hud();
      sfx('pickup');
    }
  // The "MAP →" corner: out to the hallway when it exists, else the map.
  if (player.x > roomWidth() - 105 && player.y < 202) {
    player.y = 225;
    if (typeof hallwayEnter === 'function') hallwayEnter(state.room);
    else openMap();
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

// The arcade beacon on the floor: LOCKED until the ward is cleared, then a pulsing ring.
function drawBeacon() {
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
}

function drawWorld() {
  const vw = viewport.w,
    vh = viewport.h,
    ease = 1 - Math.exp(-renderDelta * 12);
  syncWardPause();
  c.clearRect(0, 0, vw, vh);
  cameraX += (clamp(player.x - vw / 2, 0, Math.max(0, roomWidth() - vw)) - cameraX) * ease;
  // Screens wider than 1.6 show a horizontal slice of the room and follow Macy vertically. A tall
  // portrait view (taller than the room) centers it, with a band above and below.
  const camYGoal = vh > 625 ? -(vh - 625) / 2 : clamp(player.y - vh * 0.58, 0, 625 - vh);
  wardCameraY += (camYGoal - wardCameraY) * ease;
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
  if (isArcadeRoom(state.room) && rooms[state.room].station) drawBeacon();
  for (let s of supplies.filter(supplyAvailable)) {
    ellipse(c, s.x, s.y, 20, 7, '#e7eea855');
    nutrient(c, s.x, s.y + Math.sin(time * 3) * 3, s.type, 1.2);
    spark(c, s.x + 15, s.y - 35, '#fff0ad', 0.4);
  }
  for (let tr of traps) {
    brick(c, tr.x - 15, tr.y, '#e38878');
    brick(c, tr.x + 2, tr.y + 5, '#6faeab');
  }
  drawWardGoal(c);
  const renderables = (roomProps[state.room] || []).map(p => ({ y: p.y, draw: p.draw }));
  if (typeof roomExtraRenderables === 'function') renderables.push(...(roomExtraRenderables() || []));
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
  drawWardTaps(c);
  rect(c, 0, 603, roomWidth(), 22, '#244856');
  rect(c, 24, 603, roomWidth() - 48, 4, '#90b6a2');
  c.restore();
  if (typeof drawRoomOverlay === 'function') drawRoomOverlay(c, vw, vh);
  if (typeof drawCombatOverlay === 'function') drawCombatOverlay(c, vw);
  wardWeaponSync();
  drawWeaponFlash(vw, vh);
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
  if (!isArcadeRoom(state.room) || !rooms[state.room].station) return false;
  const [x, y] = rooms[state.room].station;
  return Math.abs(p.x - x) < 70 && p.y > y - 85 && p.y < y + 45;
}

// The map dialog's floor plan (src/map.js). Every caller keeps calling renderMap(); the plan mounts
// while the dialog is open (it measures the dialog), so openMap opens first.
function renderMap() {
  if ($('mapDialog').open && typeof mountHospitalMap === 'function') mountHospitalMap($('mapGrid'));
}

function openMap() {
  hud();
  modalOpen($('mapDialog'));
  renderMap();
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
    .filter(r => isArcadeRoom(r.id))
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

// A tall phone still sees at least this much of the room's 1000 px width.
const WARD_MIN_VIEW_W = 540;

function resize() {
  const r = $('stage').getBoundingClientRect();
  if (r.width > 0 && r.height > 0) {
    const aspect = r.width / r.height;
    viewport.w = clamp(625 * aspect, WARD_MIN_VIEW_W, 1000);
    viewport.h = viewport.w < 1000 ? Math.max(625, viewport.w / aspect) : clamp(1000 / aspect, 300, 625);
    // Cards end above the wall signs; a centered tall view moves the signs down by its top band.
    const band = Math.max(0, viewport.h - 625) / 2;
    $('stage').dataset.hud = hudBucket(((WALL_SIGN_TOP - 4 + band) * r.height) / viewport.h);
  }
  configureCanvas(canvas, viewport.w, viewport.h);
  // An open arcade re-reads the screen shape (a portrait canvas flips in and out as the phone turns).
  // A closed one keeps the 800 × 450 canvas it starts with.
  if (mini.open) orientMini();
  else configureCanvas($('miniCanvas'), 800, 450);
  if (titleUp) titleFit();
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
  titleTick(renderDelta);
  advanceSimulation(renderDelta);
  // The title covers the ward; the room only draws again once the iris starts opening.
  if (titleUp) drawTitle();
  if (!titleUp || titleLeaving > 0) drawWorld();
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
