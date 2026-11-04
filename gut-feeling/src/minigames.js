// Arcade framework: lobby, run lifecycle, HUD, scoring, rewards, results, and the shared plumbing
// for gesture games. Rules and art for each game live in games/*.js; see ARCHITECTURE.md.
const mc = $('miniCanvas').getContext('2d');

// Each run owns its timers, score, limited assists, and escalating rounds.
const approaches = [
  { name: 'Steady hands', helps: 2, multiplier: 1, desc: 'Two emergency assists for the whole run.' },
  { name: 'Show-off shift', helps: 0, multiplier: 1.25, desc: 'No assists. 25% more coins.' }
];

// The Arcade pass adds one assist to Steady hands runs.
function approachHelps(i) {
  return approaches[i].helps + (i === 0 && state.upgrades.includes('pass') ? 1 : 0);
}

// ---- Daily Dose ----
// The local date picks one game and level. The run swaps in a seeded Math.random (seed from the
// date) around every game hook, so the day's spawns match for everyone. Draw code keeps the real one.
const DAILY_BONUS_BASE = 60,
  DAILY_BONUS_STEP = 10;

let dailyRng = null;

function dailyDateKey(d) {
  return (
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  );
}

function dailyToday() {
  return dailyDateKey(new Date());
}

function dailyShift(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return dailyDateKey(new Date(y, m - 1, d + days));
}

// FNV-1a: a stable 32-bit hash of the date string.
function dailyHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dailyPick(key = dailyToday()) {
  const h = dailyHash('gut-feeling/' + key);
  return { date: key, id: h % ARCADE_COUNT, tier: Math.floor(h / ARCADE_COUNT) % 3, seed: dailyHash(key + '/seed') };
}

// mulberry32: tiny, fast, and good enough for gremlin placement.
function dailyRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Runs a game hook with the daily RNG in place of Math.random, then restores the original.
function dailyScoped(fn) {
  if (!mini.daily || !dailyRng) return fn();
  const outer = Math.random;
  Math.random = dailyRng;
  try {
    return fn();
  } finally {
    Math.random = outer;
  }
}

// A streak survives until the end of the day after the last daily run.
function dailyStreak() {
  const today = dailyToday(),
    last = state.daily.last;
  return last === today || last === dailyShift(today, -1) ? state.daily.streak : 0;
}

function dailyBonus() {
  return DAILY_BONUS_BASE + DAILY_BONUS_STEP * Math.min(dailyStreak(), 4);
}

function dailyLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}

function renderDaily() {
  const pick = dailyPick(),
    played = state.daily.last === pick.date,
    html =
      `<div class="daily-top"><span>DAILY DOSE · ${dailyLabel(pick.date)}</span>` +
      `<span>STREAK ${dailyStreak()}</span></div>` +
      `<strong class="daily-game">${games[pick.id].info.game}</strong>` +
      `<small>Level ${pick.tier + 1} · Show-off rules · same run for everyone today</small>` +
      `<small>${played ? 'Today’s best: ' + state.daily.best : 'First run today pays +' + dailyBonus() + ' coins'}</small>` +
      `<button class="primary coral daily-go" data-daily>${played ? 'Beat your best' : 'Take today’s dose'} →</button>`;
  $('dailyCard').innerHTML = html;
  $('mapDaily').innerHTML = html;
}

function openDaily(key = dailyToday()) {
  const pick = dailyPick(key);
  if (arcadeBlocked(pick.id)) {
    // Toasts live on the stage, so close the map before saying no.
    if ($('mapDialog').open) $('mapDialog').close();
    toast('Today’s dose is in the ' + rooms[pick.id].name + '. ' + ARCADE_LOCKED_TOAST, 3.4);
    sfx('miss');
    return false;
  }
  openMini(pick.id);
  Object.assign(mini, { daily: true, dailyDate: pick.date, dailySeed: pick.seed, tier: pick.tier, approach: 1 });
  showLobby();
  return true;
}

// Records a finished daily run: first run of a new day extends the streak and pays the bonus.
function recordDaily(score) {
  const d = state.daily,
    day = mini.dailyDate;
  if (!day || day < d.last) return { bonus: 0, record: false };
  let bonus = 0;
  if (d.last !== day) {
    d.streak = d.last === dailyShift(day, -1) ? d.streak + 1 : 1;
    d.last = day;
    d.best = 0;
    bonus = DAILY_BONUS_BASE + DAILY_BONUS_STEP * Math.min(d.streak - 1, 4);
  }
  const record = score > d.best;
  d.best = Math.max(d.best, score);
  if (bonus) coins(bonus);
  else save();
  return { bonus, record };
}

// ---- Canvas shape ----
// A game may declare portraitCanvas {w, h} beside canvas. mini.portrait is true while an upright screen
// shows a game that has one, and can flip mid-run when the phone turns; activeCanvas() is the size the
// run draws at right now. Games should read it (or mini.portrait) when they lay out, not cache it.
function activeCanvas() {
  const def = miniGame();
  return mini.portrait && def.portraitCanvas ? def.portraitCanvas : def.canvas;
}

function miniPortraitWanted() {
  const def = miniGame(),
    upright = window.innerHeight > window.innerWidth;
  return !!(mini.open && $('miniDialog').open && def && def.portraitCanvas && upright);
}

// Sizes #miniCanvas to the active canvas, tells CSS its shape (data-portrait, --mini-a) and lays out
// the run screen around it.
function fitMiniCanvas() {
  const { w, h } = activeCanvas(),
    dialog = $('miniDialog');
  configureCanvas($('miniCanvas'), w, h);
  dialog.dataset.portrait = mini.portrait ? '1' : '';
  dialog.style.setProperty('--mini-a', (w / h).toFixed(4));
  applyMiniFrame();
}

// ---- The run screen ----
// A run is the canvas plus the minimum: three pills on its top edge and the control buttons. With a
// mouse the controls sit in one row under the canvas or a column beside it, whichever leaves the bigger
// canvas, and the dialog hugs the canvas inside 96% × 94% of the window (no empty panel around it). In
// arcade mode on a touch screen the canvas takes the whole screen less the safe areas and the buttons
// float over its bottom edge (miniOverlayFrame). Sizes are CSS pixels; CSS reads them as variables.
// Overlay sizes: btn is a strip button's height, main its widest, thumbW × thumbH a corner button in
// the 'sides' placement, assistW × assistH the small buttons between the corners, gap the margin.
const MINI_FRAME_SIZES = {
  phone: { row: 66, col: 140, hud: 44, btn: 52, main: 140, thumbW: 96, thumbH: 86, assistW: 118, assistH: 36, gap: 8 },
  tablet: { row: 84, col: 200, hud: 50, btn: 62, main: 230, thumbW: 132, thumbH: 112, assistW: 160, assistH: 46, gap: 12 },
  desktop: { row: 72, col: 190, hud: 46, btn: 48 }
};

function miniCoarse() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

function miniFrameSizes() {
  const w = window.innerWidth || 1280,
    h = window.innerHeight || 800;
  if (!miniCoarse()) return MINI_FRAME_SIZES.desktop;
  return Math.min(w, h) >= 600 ? MINI_FRAME_SIZES.tablet : MINI_FRAME_SIZES.phone;
}

// Pure geometry. aspect is canvas width / height; inset is the safe area in arcade mode.
function miniFrame(viewW, viewH, aspect, arcade, sizes, inset = { t: 0, r: 0, b: 0, l: 0 }, prefer = null) {
  const boxW = arcade ? viewW - inset.l - inset.r : Math.floor(viewW * 0.96),
    boxH = arcade ? viewH - inset.t - inset.b : Math.floor(viewH * 0.94),
    fit = (w, h) => {
      const fw = Math.max(1, Math.min(w, h * aspect));
      return { w: fw, h: fw / aspect };
    },
    row = fit(boxW, boxH - sizes.row),
    col = fit(boxW - sizes.col, boxH),
    // A game with one or two buttons never earns a whole side column; it goes under the canvas.
    side = prefer === 'row' ? 'row' : col.w * col.h > row.w * row.h * 1.04 ? 'col' : 'row',
    f = side === 'col' ? col : row,
    frameW = arcade ? boxW : Math.ceil(f.w + (side === 'col' ? sizes.col : 0)),
    frameH = arcade ? boxH : Math.ceil(f.h + (side === 'row' ? sizes.row : 0)),
    areaW = side === 'col' ? frameW - sizes.col : frameW,
    areaH = side === 'row' ? frameH - sizes.row : frameH,
    slack = Math.max(0, areaH - f.h),
    band = Math.min(sizes.hud, slack),
    cvT = band + (slack - band) / 2,
    cvL = Math.max(0, (areaW - f.w) / 2);
  return {
    side,
    frameW,
    frameH,
    fitW: f.w,
    fitH: f.h,
    cvL,
    cvT,
    hudT: cvT - band,
    // Pause and close: on the canvas's top-right corner in a row layout, atop the column otherwise.
    topX: inset.r + (side === 'row' ? cvL + 6 : 8),
    topY: inset.t + (side === 'row' ? cvT - band + 6 : 6),
    hudPadR: side === 'row' ? 100 : 8,
    // Nothing sits on the canvas in these layouts.
    coverCss: { bottom: 0, left: 0, right: 0 }
  };
}

// Pure geometry for touch screens in arcade mode: the canvas fills the frame (aspect kept), the HUD
// band takes the top of any spare height and the buttons float over the canvas's bottom edge, using
// whatever spare height is left below it first. count is how many buttons there are, the assist
// included. Two ways to place them (ctl):
// - 'strip': one centered row along the bottom, over the canvas's bottom edge. place 'bottom' uses it.
// - 'corners': the first button in the bottom-left corner, the second in the bottom-right, thumb-tall,
//   and the rest small: centered along the bottom between them (mid 'center') or, when the canvas
//   leaves a gutter beside it wide enough for a thumb, stacked above the right corner (mid 'stack').
//   place 'sides' always uses it; place 'bottom' uses it whenever those gutters exist, because then
//   nothing has to sit on the canvas at all (a square game on a landscape phone).
// coverCss is what the buttons hide, in CSS pixels: bottom is the band along the canvas's bottom edge
// with buttons in it, left and right the corner blocks' widths over the canvas, 0 where nothing is.
function miniOverlayFrame(viewW, viewH, aspect, sizes, inset = { t: 0, r: 0, b: 0, l: 0 }, place = 'bottom', count = 1) {
  const boxW = viewW - inset.l - inset.r,
    boxH = viewH - inset.t - inset.b,
    fitW = Math.max(1, Math.min(boxW, boxH * aspect)),
    fitH = fitW / aspect,
    gap = sizes.gap,
    cvL = (boxW - fitW) / 2,
    gutter = cvL >= sizes.thumbW + gap * 2,
    corners = (place === 'sides' && count >= 2) || (gutter && count >= 1),
    mid = gutter ? 'stack' : 'center',
    slack = Math.max(0, boxH - fitH),
    band = Math.min(sizes.hud, slack),
    // Corner buttons stay clear of the HUD on the shortest screens.
    thumbH = Math.max(sizes.btn, Math.min(sizes.thumbH, (boxH - sizes.hud) * 0.4)),
    ctlH = count === 0 ? 0 : (corners ? thumbH : sizes.btn) + gap * 2,
    below = slack - band,
    // Spare height past the buttons is split above and below, so canvas and buttons stay together.
    extra = Math.max(0, below - ctlH),
    cvT = band + extra / 2,
    ctlB = below > ctlH ? cvT + fitH + ctlH : boxH,
    // A strip spans the canvas, never narrower than 300 px unless the frame is.
    span = Math.min(boxW, Math.max(fitW, 300)),
    canvasBottom = cvT + fitH,
    canvasRight = cvL + fitW,
    rects = [];
  if (corners) {
    // The assist is always the last button; anywhere it lands it keeps its small height.
    const tall = i => (i === count - 1 ? sizes.assistH : thumbH),
      base = ctlB - gap;
    rects.push({ x: gap, w: sizes.thumbW, top: base - tall(0), at: 'left' });
    if (count >= 2) rects.push({ x: boxW - gap - sizes.thumbW, w: sizes.thumbW, top: base - tall(1), at: 'right' });
    for (let i = 2; i < count; i++)
      rects.push(
        mid === 'stack'
          ? { x: boxW - gap - sizes.thumbW, w: sizes.thumbW, top: base - thumbH - (i - 1) * (gap + sizes.assistH), at: 'right' }
          : { x: (boxW - sizes.assistW) / 2, w: sizes.assistW, top: base - sizes.assistH, at: 'mid' }
      );
  } else rects.push({ x: (boxW - span) / 2, w: span, top: ctlB - gap - sizes.btn, at: 'mid' });
  const cover = { bottom: 0, left: 0, right: 0 };
  for (const r of rects) {
    if (r.top >= canvasBottom || r.x >= canvasRight || r.x + r.w <= cvL) continue;
    cover.bottom = Math.max(cover.bottom, canvasBottom - r.top);
    if (r.at === 'left') cover.left = Math.max(cover.left, r.x + r.w - cvL);
    if (r.at === 'right') cover.right = Math.max(cover.right, canvasRight - r.x);
  }
  if (count === 0) rects.length = 0;
  return {
    side: 'over',
    ctl: corners ? 'corners' : 'strip',
    mid,
    frameW: boxW,
    frameH: boxH,
    fitW,
    fitH,
    cvL,
    cvT,
    hudT: cvT - band,
    topX: inset.r + cvL + 6,
    topY: inset.t + cvT - band + 6,
    hudPadR: 100,
    ctlT: ctlB - ctlH,
    ctlH,
    ctlL: corners ? 0 : (boxW - span) / 2,
    ctlW: corners ? boxW : span,
    thumbH,
    coverCss: cover
  };
}

function miniSafeInsets(dialog) {
  if (!inArcade() || typeof getComputedStyle !== 'function') return { t: 0, r: 0, b: 0, l: 0 };
  const cs = getComputedStyle(dialog),
    px = v => parseFloat(v) || 0;
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}

// Arcade mode on a touch screen floats the buttons over the canvas.
function miniOverlayWanted() {
  return inArcade() && miniCoarse();
}

// setControls writes the count (the assist included) on the row.
function miniButtonCount() {
  const c = $('miniControls');
  if (c.dataset && c.dataset.count) return Number(c.dataset.count);
  return typeof c.querySelectorAll === 'function' ? c.querySelectorAll('button').length : 0;
}

// Writes the frame for the current run and window onto #miniDialog: data-side ('row', 'col' or 'over'),
// data-place (the game's controlsPlace), the CSS variables, and mini.frame. mini.frame.cover says what
// the buttons hide, in active-canvas pixels: {bottom, left, right}, all 0 when nothing sits on the canvas.
function applyMiniFrame() {
  const dialog = $('miniDialog'),
    def = miniGame(),
    { w, h } = activeCanvas(),
    sizes = miniFrameSizes(),
    place = def && def.controlsPlace === 'sides' ? 'sides' : 'bottom',
    buttons = miniButtonCount(),
    vw = window.innerWidth || 1280,
    vh = window.innerHeight || 800,
    inset = miniSafeInsets(dialog),
    over = miniOverlayWanted(),
    // With a mouse, 'sides' keeps one row (LEFT, the assist, RIGHT) so the corners read left and right.
    f = over
      ? miniOverlayFrame(vw, vh, w / h, sizes, inset, place, buttons)
      : miniFrame(vw, vh, w / h, inArcade(), sizes, inset, (buttons && buttons <= 2) || place === 'sides' ? 'row' : null),
    px = v => Math.round(v * 10) / 10 + 'px',
    vars = {
      '--frame-w': f.frameW,
      '--frame-h': f.frameH,
      '--fit-w': f.fitW,
      '--fit-h': f.fitH,
      '--cv-l': f.cvL,
      '--cv-t': f.cvT,
      '--hud-t': f.hudT,
      '--hud-h': sizes.hud,
      '--hud-pad-r': f.hudPadR,
      '--top-x': f.topX,
      '--top-y': f.topY,
      '--ctl': over ? f.ctlH : sizes.row,
      '--ctl-w': sizes.col,
      '--ctl-btn': sizes.btn
    };
  if (over)
    Object.assign(vars, {
      '--ctl-t': f.ctlT,
      '--ctl-l': f.ctlL,
      '--ctl-span': f.ctlW,
      '--ctl-gap': sizes.gap,
      '--ctl-main': sizes.main,
      '--thumb-w': sizes.thumbW,
      '--thumb-h': f.thumbH,
      '--assist-w': sizes.assistW,
      '--assist-h': sizes.assistH
    });
  for (const k in vars) dialog.style.setProperty(k, px(vars[k]));
  const k = w / f.fitW,
    c = f.coverCss;
  delete f.coverCss;
  f.place = place;
  f.cover = {
    bottom: Math.min(h, Math.round(c.bottom * k)),
    left: Math.min(w, Math.round(c.left * k)),
    right: Math.min(w, Math.round(c.right * k))
  };
  dialog.dataset.side = f.side;
  dialog.dataset.place = place;
  dialog.dataset.ctl = f.ctl || '';
  dialog.dataset.mid = f.mid || '';
  mini.frame = f;
  return f;
}

// resize() calls this while the dialog is open. Returns true when the run flipped canvases.
function orientMini() {
  const portrait = miniPortraitWanted(),
    flipped = portrait !== !!mini.portrait;
  mini.portrait = portrait;
  fitMiniCanvas();
  return flipped;
}

// Department card and lobby preview art.
function miniScene(g, id, w, h) {
  // The lobby of a forced run shows the recovery's picture, not the room's arcade.
  const def = mini.open && mini.forced && games.recovery && id === mini.id ? games.recovery : games[id];
  def.scene(g, w, h);
}

const MINI_RECOVERY_LINE = 'One IV gets you out of bed. Pop, and you can try again or get patched up for coins.';

// The definition the current run uses. A forced recovery runs the game registered as `recovery`
// (games/iv.js) in place of the room's own arcade, when one is registered.
function miniGame(id = mini.id) {
  return mini.forced && games.recovery ? games.recovery : games[id];
}

// The prescription a run plays on: the chosen one, except Legendary, which is always Questionable Decisions.
function legendaryCfg(tier) {
  return tier === 3 ? difficulties[1] : cfg();
}

// Levels the current run's game offers: three, or four when it registers `legendary: true`.
function miniTierCount(def = miniGame()) {
  return def && def.legendary ? TIER_COUNT : 3;
}

// What the exit still wants, as short phrases in order. Empty means discharge is ready or done.
function dischargeMissing() {
  const out = [],
    need = DISCHARGE_STARS - stars();
  if (need > 0) out.push(`${need} more ${need === 1 ? 'star' : 'stars'} (${stars()}/${DISCHARGE_STARS})`);
  const unstamped = [];
  for (let i = 0; i < ARCADE_COUNT; i++)
    if (!state.medals[i].some(Boolean)) unstamped.push(games[i] ? games[i].info.game : rooms[i].name);
  if (unstamped.length) out.push('a medal in ' + unstamped.join(', '));
  if (!levelTwo()) out.push('any level 2 medal');
  if (!state.ralph) out.push('Ralph evicted from your room');
  return out;
}

function openMini(id, forced = false) {
  clearHeld();
  if ($('mapDialog').open) $('mapDialog').close();
  // A forced recovery runs the phase and level games/iv.js plans for this collapse (the level of her last run).
  const plan = forced && typeof ivRecoveryPlan === 'function' ? ivRecoveryPlan() : null;
  let next = state.medals[id].findIndex(m => !m),
    tier = forced
      ? plan
        ? clamp(Math.floor(plan.level) || 0, 0, miniTierCount(games.recovery || games[id]) - 1)
        : 0
      : next < 0
        ? 2
        : next;
  ceremonyStop();
  mini = {
    open: true,
    screen: 'lobby',
    id,
    tier,
    forced,
    approach: 0,
    daily: false,
    paused: false,
    held: false,
    t: 0
  };
  $('miniDialog').classList.remove('gory');
  $('miniClose').classList.toggle('hidden', forced);
  // How to play starts open only where there is room for it: a mouse and a roomy window.
  $('lobbyHow').open = !miniCoarse() && (window.innerWidth || 1280) >= 900 && (window.innerHeight || 800) >= 640;
  showLobby();
  modalOpen($('miniDialog'));
}

// The lobby's own way out. leaveMini is defined below; the listener runs it at click time.
$('miniLobbyBack').addEventListener('click', () => leaveMini());

function showLobby() {
  const def = miniGame(),
    info = def.info;
  mini.screen = 'lobby';
  mini.held = false;
  clearHeld();
  ceremonyStop();
  $('miniDialog').dataset.screen = 'lobby';
  $('miniClose').disabled = false;
  $('miniLobby').classList.remove('hidden');
  $('miniPlay').classList.add('hidden');
  $('miniResult').classList.add('hidden');
  $('miniPauseBtn').classList.add('hidden');
  $('miniDepartment').textContent =
    rooms[mini.id].name.toUpperCase() + (mini.forced ? ' / MANDATORY REASSEMBLY' : ' / HOSPITAL ARCADE');
  $('miniTitle').textContent = info.game;
  $('miniGenre').textContent = info.genre;
  $('miniHeadline').textContent = info.headline;
  $('miniDescription').textContent = info.desc;
  $('miniDialog').dataset.daily = mini.daily ? 'yes' : '';
  $('miniDialog').dataset.forced = mini.forced ? 'yes' : '';
  // One screen, no scrolling: the hook, the levels as one segmented row (the chosen one's note under
  // it), the nerve as a two-way switch, then START and BACK. The long copy waits behind How to play.
  // A level unlocks once the previous one has any medal; a recovery or a Daily Dose fixes the level
  // (the others stay visible, disabled), and a Daily Dose fixes Show-off rules.
  const count = miniTierCount();
  $('tierGrid').dataset.count = String(count);
  $('tierGrid').innerHTML = tiers
    .slice(0, count)
    .map((t, i) => {
      const medal = state.medals[mini.id][i],
        locked = mini.daily || mini.forced ? i !== mini.tier : i > 0 && !state.medals[mini.id][i - 1];
      return (
        `<button class="${['tier-card', mini.tier === i ? 'selected' : '', i === 3 ? 'legendary' : ''].filter(Boolean).join(' ')}" data-tier="${i}" ${locked ? 'disabled' : ''}>` +
        `<small>LEVEL ${i + 1}</small><strong>${i === 3 ? 'LEGEND' : i + 1}</strong>` +
        `<span class="medals" aria-label="${medal} of 3 stars">${locked && !medal ? '🔒' : '★'.repeat(medal) + '☆'.repeat(3 - medal)}</span></button>`
      );
    })
    .join('');
  const tag = mini.tier === 0 ? 'Teaches you' : mini.tier === 3 ? 'One win in four' : 'The real deal';
  $('tierNote').innerHTML = `<strong>${tiers[mini.tier]}</strong> · ${tag}<small>${def.tierNotes[mini.tier] || ''}</small>`;
  $('approachOptions').innerHTML = approaches
    .map((a, i) => {
      const helps = approachHelps(i),
        desc = i === 0 ? `${helps === 3 ? 'Three' : 'Two'} assists` : 'No assists · +25% coins',
        off = mini.daily && i === 0;
      return (
        `<button class="approach ${mini.approach === i ? 'selected' : ''}" data-approach="${i}" ` +
        `aria-pressed="${mini.approach === i}" ${off ? 'disabled' : ''}><strong>${i === 0 ? 'Steady hands' : 'Show-off'}</strong><small>${desc}</small></button>`
      );
    })
    .join('');
  $('dailyBanner').classList.toggle('hidden', !mini.daily);
  if (mini.daily)
    $('dailyBanner').textContent =
      `DAILY DOSE · ${dailyLabel(mini.dailyDate)} · Same gremlins for everyone. ` +
      (state.daily.last === mini.dailyDate ? `Today’s best: ${state.daily.best}.` : `First run pays +${dailyBonus()} coins.`);
  $('miniStart').innerHTML = mini.daily ? 'Take today’s dose →' : mini.forced ? 'Start the recovery →' : 'Start →';
  // A recovery has no way out but through.
  $('miniLobbyBack').classList.toggle('hidden', !!mini.forced);
  $('miniRewardInfo').textContent = mini.forced ? MINI_RECOVERY_LINE : '';
  $('miniBest').textContent = mini.forced
    ? 'No medals in bed. Just get out of it.'
    : 'Best here: ' + (state.records[mini.id][mini.tier] || 'nothing yet') + '.';
  $('miniDifficulty').textContent = 'Chaos prescription: ' + cfg().name + ' ↗';
  miniScene($('miniPreview').getContext('2d'), mini.id, 420, 240);
}

function startMini() {
  const { id, tier, forced, approach = 0, daily = false, dailyDate = '', dailySeed = 0 } = mini,
    def = miniGame();
  // The recovery opens on the level of the last real run.
  if (!forced) state.lastTier = clamp(tier, 0, TIER_COUNT - 1);
  clearHeld();
  ceremonyStop();
  $('miniLivesLabel').textContent = 'OOPS ALLOWANCE';
  mini = {
    open: true,
    screen: 'play',
    id,
    tier,
    forced,
    approach,
    daily,
    dailyDate,
    dailySeed,
    // Legendary is one fixed test, one win in four: it always runs on Questionable Decisions rules.
    rules: { ...legendaryCfg(tier), misses: legendaryCfg(tier).misses + 2, coins: legendaryCfg(tier).coins * approaches[approach].multiplier },
    paused: false,
    held: false,
    t: 0,
    total: 0,
    phaseTime: 0,
    phase: 0,
    round: 0,
    miss: 0,
    quality: 100,
    flash: 0,
    flashText: '',
    countdown: 0,
    initialized: false,
    hudClock: 0,
    limit: 60,
    score: 0,
    combo: 0,
    maxCombo: 0,
    helps: approachHelps(approach),
    helpTime: 0,
    helpUsed: 0,
    precisions: [],
    inputLock: 0,
    portrait: false,
    tipT: 0,
    tipShown: false
  };
  // The game's init may lay out for the canvas it will draw on, so pick it first.
  mini.portrait = miniPortraitWanted();
  $('miniInstruction').dataset.show = '';
  $('miniLobby').classList.add('hidden');
  $('miniPlay').classList.remove('hidden');
  $('miniResult').classList.add('hidden');
  $('miniPaused').classList.add('hidden');
  $('miniDialog').classList.remove('gory');
  dailyRng = daily ? dailyRandom(dailySeed) : null;
  dailyScoped(() => {
    def.init();
    if (def.controls) def.controls();
  });
  fitMiniCanvas();
  $('miniDialog').dataset.arcade = def.layout;
  mini.initialized = true;
  prepareBriefing();
  updateMiniHUD();
  drawMini();
}

// Arcade mode on phones shows the instruction line as a toast over the canvas: through the countdown,
// for the first MINI_TIP_SECONDS of play, and again whenever the line changes. Wider layouts always show it.
const MINI_TIP_SECONDS = 3;

function setInstructions(t) {
  const changed = $('miniInstruction').textContent !== t;
  $('miniInstruction').textContent = t;
  if (changed && mini.initialized) showMiniTip();
}

function showMiniTip(sec = MINI_TIP_SECONDS) {
  mini.tipT = sec;
  syncMiniTip();
}

// data-show on #miniInstruction follows the screen and the tip clock; CSS decides what it means.
function syncMiniTip() {
  const on = mini.screen === 'intro' || (mini.screen === 'play' && mini.tipT > 0);
  if (on === !!mini.tipShown) return;
  mini.tipShown = on;
  $('miniInstruction').dataset.show = on ? '1' : '';
}

// Buttons: {id, text, key?, hot?, pad?}. Each click sends miniAction(id); the assist button is always appended.
// opts.assist === false leaves the assist button out too (a game that draws its own controls on the
// canvas), so the count is 0 and the overlay reserves nothing.
function setControls(buttons, opts = {}) {
  const before = miniButtonCount(),
    assist = opts.assist !== false;
  $('miniControls').dataset.game = mini.id;
  // Arcade mode lays out by button count (the assist included).
  $('miniControls').dataset.count = String(buttons.length + (assist ? 1 : 0));
  const html = buttons.map(
    b =>
      `<button data-action="${b.id}" class="${b.hot ? 'hot ' : ''}${b.pad ? 'pad' : ''}" ${b.pad ? `style="--pad:${b.pad}"` : ''}` +
      ` aria-label="${b.text}">${b.text}${b.key ? ` <small>(${b.key})</small>` : ''}</button>`
  );
  $('miniControls').innerHTML =
    html.join('') +
    (assist
      ? `<button class="assist muted" data-action="assist" aria-label="Use limited assist">ASSIST · ${mini.helps} left <small>(E)</small></button>`
      : '');
  // A relabel that changes the count mid-run moves the buttons, so the frame and its cover follow.
  if (mini.initialized && mini.open && miniButtonCount() !== before) applyMiniFrame();
}

function praise(points, precision = 1) {
  mini.combo++;
  mini.maxCombo = Math.max(mini.maxCombo, mini.combo);
  mini.score += Math.round(points * (1 + Math.min(2, Math.floor(mini.combo / 5)) * 0.5));
  mini.precisions.push(clamp(precision, 0, 1));
}

function miniOops(message, amount = 1) {
  if (mini.screen !== 'play') return;
  mini.miss += amount;
  mini.combo = 0;
  mini.flash = 0.9;
  mini.flashText = message;
  mini.quality = Math.max(0, mini.quality - 12 * amount);
  sfx('miss');
  if (mini.miss >= mini.rules.misses) finishMini(false);
}

// Assists are limited per run and cost style points; the game supplies the effect.
function useAssist() {
  if (mini.helps <= 0) return;
  mini.helps--;
  mini.helpUsed++;
  mini.quality -= 5;
  mini.combo = 0;
  dailyScoped(() => miniGame().assist());
  updateMiniHUD();
}

function miniAction(a) {
  if (mini.screen !== 'play' || mini.paused || mini.countdown > 0) return;
  if (a === 'assist') {
    useAssist();
    return;
  }
  const def = miniGame();
  if (def.action) dailyScoped(() => def.action(a));
}

function pauseMini() {
  if (!['play', 'intro'].includes(mini.screen)) return;
  mini.paused = !mini.paused;
  clearHeld();
  $('miniPaused').classList.toggle('hidden', !mini.paused);
  $('miniPauseBtn').textContent = mini.paused ? '▶' : 'Ⅱ';
}

function updateMini(dt) {
  if (!mini.open || document.hidden) return;
  syncMiniTip();
  if (updateTransition(dt)) return;
  if (mini.screen === 'result') {
    ceremonyUpdate(dt);
    // Result splatter (spawned by a game's onLose) keeps falling on the result art.
    if (gore.length) {
      mini.resultT += dt;
      for (let p of gore) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 230 * dt;
        if (p.y > 202) {
          p.y = 202;
          p.vy = -Math.abs(p.vy) * 0.1;
          p.vx *= 0.91;
        }
        p.x = clamp(p.x, 2, 790);
      }
    }
    return;
  }
  if (mini.screen !== 'play' || mini.paused) return;
  mini.tipT = Math.max(0, (mini.tipT || 0) - dt);
  syncMiniTip();
  mini.flash = Math.max(0, mini.flash - dt);
  mini.inputLock = Math.max(0, mini.inputLock - dt);
  mini.helpTime = Math.max(0, mini.helpTime - dt);
  mini.t += dt;
  mini.total += dt;
  mini.phaseTime += dt;
  mini.hudClock -= dt;
  dailyScoped(() => miniGame().update(dt));
  if (mini.hudClock <= 0) {
    updateMiniHUD();
    mini.hudClock = 0.08;
  }
}

function updateMiniHUD() {
  if (!['play', 'briefing', 'intro'].includes(mini.screen)) return;
  const def = miniGame();
  $('miniStatLabel').textContent = def.statLabel();
  $('miniStat').textContent = def.stat();
  const left = Math.max(0, Math.ceil(mini.limit - mini.phaseTime));
  $('miniTimer').textContent =
    mini.screen === 'briefing'
      ? 'Paused'
      : mini.screen === 'intro'
        ? 'Get ready'
        : Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  $('miniLivesLabel').textContent = def.livesLabel ? def.livesLabel() : 'OOPS ALLOWANCE';
  $('miniLives').textContent = def.lives
    ? def.lives()
    : '♥ '.repeat(Math.max(0, mini.rules.misses - mini.miss));
  $('miniTactics').textContent = def.tactics();
  const a = $('miniControls').querySelector('[data-action="assist"]');
  if (a) {
    a.disabled = mini.helps <= 0;
    a.textContent = def.assistText();
    a.setAttribute('aria-label', a.textContent);
  }
}

// 0–100 performance score that sets the medal. Games may replace it with def.quality().
// A non-number (say, an average of no samples) counts as 0 so it can never reach the coin total.
function qualityScore() {
  const def = miniGame(),
    q = def.quality ? def.quality() : arcadeQuality();
  return Number.isFinite(q) ? clamp(Math.round(q), 0, 100) : 0;
}

// Standard arcade score: quota overshoot and best chain, minus oopses, assists, and any game penalty.
function arcadeQuality(penalty = 0) {
  return Math.round(
    clamp(
      65 +
        Math.min(35, Math.max(0, mini.got / mini.goal - 1) * 40 + mini.maxCombo * 0.65) -
        mini.miss * 7 -
        mini.helpUsed * 3 -
        penalty,
      0,
      100
    )
  );
}

function grantReward(id, tier, grade, quality, multiplier, arcadeScore = 0) {
  // A medal outside a recovery resets the recovery escalation; a won recovery keeps counting.
  if (!mini.forced) state.recoveries = 0;
  const old = state.medals[id][tier],
    delta = Math.max(0, grade - old);
  state.medals[id][tier] = Math.max(old, grade);
  let pay =
    Math.round((18 + grade * 18 + tier * 12 + quality * 0.2 + Math.min(70, arcadeScore / 120)) * multiplier) +
    delta * 20;
  coins(pay);
  return { delta, pay, old };
}

// A won recovery pays a few coins and nothing else.
function recoveryReward() {
  const pay = Math.round(12 * mini.rules.coins);
  coins(pay);
  return { delta: 0, pay, old: 0 };
}

function resolveMiniResult(win, reason) {
  if (mini.screen !== 'outro') return;
  const def = miniGame();
  mini.screen = 'result';
  $('miniDialog').dataset.screen = 'result';
  $('miniClose').disabled = false;
  mini.held = false;
  clearHeld();
  mini.resultT = 0;
  mini.win = win;
  gore = [];
  state.runs++;
  state.bestChain = Math.max(state.bestChain, mini.maxCombo || 0);
  $('miniPlay').classList.add('hidden');
  $('miniLobby').classList.add('hidden');
  $('miniResult').classList.remove('hidden');
  $('miniPauseBtn').classList.add('hidden');
  $('miniBack').classList.toggle('hidden', mini.forced && !win && typeof def.patchUp !== 'function');
  $('miniBack').textContent =
    mini.forced && !win ? (typeof def.patchUpLabel === 'function' ? def.patchUpLabel() : 'Get patched up') : 'Back to the hospital';
  $('miniRetry').textContent = mini.daily ? 'Run it back' : win ? 'Improve / next level' : 'Reassemble. Try again.';
  // Out of bed is out of bed: a won recovery offers no second helping.
  $('miniRetry').classList.toggle('hidden', mini.forced && win);
  $('miniResult').dataset.medal = '0';
  $('resultStamp').classList.add('hidden');
  let tiles = null;
  if (win) {
    mini.qualityFinal = qualityScore();
    mini.grade = mini.qualityFinal >= 88 ? 3 : mini.qualityFinal >= 68 ? 2 : 1;
    // A recovery stamps nothing on the room's arcade: no medal, no record, a small fixed payout.
    const forced = mini.forced,
      previousBest = forced ? 0 : state.records[mini.id][mini.tier];
    if (!forced) state.records[mini.id][mini.tier] = Math.max(previousBest, mini.score);
    const reward = forced
      ? recoveryReward()
      : grantReward(mini.id, mini.tier, mini.grade, mini.qualityFinal, mini.rules.coins, mini.score);
    mini.reward = reward;
    stickerCountRun(mini);
    const winText = def.onWin ? def.onWin() : undefined;
    $('resultMedal').textContent = '★'.repeat(mini.grade);
    $('resultHeading').textContent = medalNames[mini.grade].toUpperCase() + '. LEGENDARY NONSENSE.';
    $('resultText').textContent =
      winText ||
      pick([
        'Ralph is disputing this result. His appeal has been eaten.',
        'The hospital applauds. The gremlins are filing a complaint.',
        'Excellent work. Terrible bedside manner.',
        'That pillow swat had a little volleyball energy.'
      ]);
    // The ceremony counts these up from zero; NEW BEST and NEW STARS pop on their tiles.
    tiles = [
      {
        to: mini.score,
        pre: '',
        post: '',
        label: forced ? 'RECOVERY SCORE' : `ARCADE SCORE · BEST ${state.records[mini.id][mini.tier]}`,
        pop: previousBest > 0 && mini.score > previousBest ? 'NEW BEST' : ''
      },
      { to: mini.qualityFinal, pre: '', post: '%', label: 'PERFORMANCE', pop: '' },
      { to: reward.pay, pre: '+', post: '', label: 'COINS EARNED', pop: '' },
      { to: reward.delta, pre: '+', post: ' ★', label: 'NEW DISCHARGE STARS', pop: reward.delta > 0 ? 'NEW STARS' : '' }
    ];
    $('resultNumbers').innerHTML = tiles
      .map(
        (t, i) =>
          `<div><strong id="resultNum${i}">${t.pre}${t.to}${t.post}</strong><small>${t.label}</small>` +
          (t.pop ? `<em class="tile-pop" id="resultPop${i}">${t.pop}</em>` : '') +
          '</div>'
      )
      .join('');
    if (!forced) {
      $('resultStamp').classList.remove('hidden');
      $('stampRoom').textContent = rooms[mini.id].name;
      $('stampLevel').textContent = `Level ${mini.tier + 1} · ${tiers[mini.tier]}`;
      $('stampStars').textContent = '★'.repeat(mini.grade) + '☆'.repeat(3 - mini.grade);
    }
    $('miniResult').dataset.medal = forced ? '0' : String(mini.grade);
    $('resultJourney').textContent = forced
      ? 'Out of bed. Hearts back, nothing stamped. The ward is waiting.'
      : `${stars()}/${DISCHARGE_STARS} stars · ${stamps()}/${ARCADE_COUNT} arcades · ${levelTwo() ? 'Level 2 stamped' : 'Level 2 stamp still needed'}. ${reward.delta ? 'New personal best.' : 'Your best medal stays. Replay coins paid.'}`;
    // The ceremony plays the thud and the win sting when the medal lands.
    $('miniDialog').classList.remove('gory');
  } else {
    mini.grade = 0;
    if (!mini.forced) {
      state.hp = Math.max(1, state.hp - 1);
      save();
      hud();
    }
    const loss = def.onLose ? def.onLose(reason) : {},
      splat = !!loss.gory;
    $('miniDialog').classList.toggle('gory', splat);
    $('resultMedal').textContent = loss.medal || '…';
    $('resultHeading').textContent = loss.heading || 'A MEDICALLY IMPRESSIVE MESS.';
    $('resultText').textContent =
      reason || loss.text || 'The gremlins won this round. Your best medals remain intact.';
    $('resultNumbers').innerHTML =
      `<div><strong>${mini.miss}</strong><small>OOPS RECORDED</small></div><div><strong>0</strong>` +
      `<small>COINS THIS RUN</small></div><div><strong>${stars()} ★</strong>` +
      `<small>STARS PRESERVED</small></div>`;
    $('resultJourney').textContent = mini.forced
      ? 'Still in bed. ' + MINI_RECOVERY_LINE
      : 'One heart lost (you keep at least one). Retry or go bother another department.';
    sfx('lose');
  }
  if (mini.daily) {
    const d = recordDaily(mini.score || 0);
    $('resultJourney').textContent +=
      ` Daily Dose: ${d.bonus ? '+' + d.bonus + ' bonus coins, streak ' + state.daily.streak + '. ' : ''}` +
      `${d.record ? 'New best for today.' : 'Today’s best: ' + state.daily.best + '.'}`;
  }
  save();
  music('result:' + (win ? 'win' : 'lose'));
  if (win) ceremonyStart(mini.grade, tiles);
  drawResultArt();
  // Show the result art in full under the sticky header instead of scrolling it half out of view.
  $('miniDialog').scrollTop = 0;
  stickerCheck();
}

function drawResultArt() {
  const g = $('resultArt').getContext('2d');
  rect(g, 0, 0, 800, 220, mini.win ? '#85b4a1' : '#557c83');
  rect(g, 0, 0, 800, 80, mini.win ? '#a9c9ae' : '#83a69b');
  rect(g, 0, 80, 800, 6, '#3b6970');
  for (let x = 0; x < 800; x += 45) rect(g, x, 86, 1, 135, '#d1ddba26');
  miniBed(g, 395, 193, 1.15);
  ivStand(g, 275, 193, 1.2);
  cabinet(g, 488, 191, 92);
  monitor(g, 533, 107);
  poster(g, 654, 12, 1);
  plant(g, 113, 201, 1.2);
  const def = miniGame();
  // A game may paint its own foreground over the shared bedside scene; the ceremony goes on top.
  if (!(def.resultArt && def.resultArt(g))) {
    if (mini.win) {
      for (let i = 0; i < mini.grade; i++) spark(g, 353 + i * 42, 44, '#fff0ab', 1.15);
      label(g, 'STATUS: STILL A TOTAL LEGEND', 400, 26, 11, '#426d62', 'center');
    } else {
      gremlin(g, 630, 190, 1.5, 1, time);
      label(g, 'THE GREMLINS ARE BEING VERY SMUG.', 400, 29, 12, '#dfe2b9', 'center');
    }
  }
  ceremonyArt(g);
}

// ---- Medal ceremony ----
// After a win the medal drops onto the passport card (squash, thud, win sting), confetti bursts from
// it over the result art, the number tiles count up, NEW BEST and NEW STARS pop on their tiles, and a
// gold sends Rowdy galloping across the art to cheer. It all fits in CEREMONY_SECONDS. A tap skips to
// the end; reduced motion starts there, with no confetti and Rowdy already cheering. updateMini moves
// the clock, drawMini paints it, and #miniResult[data-medal] keeps the bronze, silver or gold wash.
const CEREMONY_DROP = 0.36,
  CEREMONY_WIN_SFX = 0.46,
  CEREMONY_SQUASH = 0.62,
  CEREMONY_COUNT = 1.5,
  CEREMONY_POP_AT = [1.58, 1.8],
  CEREMONY_RUN = [0.2, 1.85],
  CEREMONY_ROWDY_X = 700,
  CEREMONY_WASH = 0.8,
  CEREMONY_SECONDS = 2.4;

const CEREMONY_PHASES = [
  ['drop', 0],
  ['stamp', CEREMONY_DROP],
  ['count', CEREMONY_SQUASH],
  ['pop', CEREMONY_COUNT],
  ['done', CEREMONY_SECONDS]
];

// Bronze, silver, gold: the disc's light, mid and deep tones, and the color of the wash.
const CEREMONY_METALS = [
  null,
  { light: '#ffe0c2', mid: '#d38d55', deep: '#8a5230', wash: '#e59a5c' },
  { light: '#ffffff', mid: '#c3cfd5', deep: '#6b7f88', wash: '#d9e6ea' },
  { light: '#fff6bd', mid: '#f2c14e', deep: '#a8771f', wash: '#ffd760' }
];

const CEREMONY_CONFETTI = ['#b5e8c5', '#ffa48e', '#ffda79', '#f8efd9', '#8fd3c2', '#ef8f89'];

let ceremony = null;

// A medal with ribbon tails, centered on its disc at (x, y); r is the disc radius.
function ceremonyMedal(g, x, y, r, grade) {
  const m = CEREMONY_METALS[clamp(Math.round(grade) || 1, 1, 3)],
    k = r / 40;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  for (const [side, col] of [
    [-1, '#8fd3c2'],
    [1, '#ffa48e']
  ]) {
    const tail = [
      [side * 4, 20],
      [side * 23, 12],
      [side * 27, 52],
      [side * 18, 45],
      [side * 9, 55]
    ];
    poly(g, tail, col);
    line(g, [...tail, tail[0]], '#17313a', 2.2);
  }
  ellipse(g, 0, 4, 41, 41, '#08192459');
  path(g, p => p.arc(0, 0, 40, 0, Math.PI * 2), gradient(g, -30, -40, 50, 80, m.light, m.deep), '#17313a', 3);
  path(g, p => p.arc(0, 0, 31, 0, Math.PI * 2), gradient(g, 25, 30, -45, -60, m.light, m.mid), m.deep, 2.5);
  stickerStar(g, 0, 1, 20, m.light, m.deep, 2.4);
  path(g, p => p.arc(0, 0, 35, Math.PI * 1.08, Math.PI * 1.42), null, '#ffffffb0', 4);
  ellipse(g, -21, -25, 2.6, 2.6, '#ffffffd0');
  g.restore();
}

function ceremonyRunning() {
  return !!ceremony && ceremony.t < CEREMONY_SECONDS;
}

function ceremonyPhaseAt(t) {
  let name = CEREMONY_PHASES[0][0];
  for (const [n, at] of CEREMONY_PHASES) if (t >= at) name = n;
  return name;
}

// The medal's drop, then a squash and stretch that settles to rest.
function ceremonyStampAt(t) {
  if (t >= CEREMONY_SQUASH) return { y: 0, sx: 1, sy: 1, rot: 0, o: 1 };
  if (t < CEREMONY_DROP) {
    const k = t / CEREMONY_DROP,
      e = k * k,
      s = 2.3 - 1.3 * e;
    return { y: -110 * (1 - e), sx: s, sy: s, rot: -14 * (1 - k), o: Math.min(1, k * 3) };
  }
  const u = (t - CEREMONY_DROP) / (CEREMONY_SQUASH - CEREMONY_DROP),
    w = (1 - u) * Math.cos(u * 7);
  return { y: 0, sx: 1 + 0.32 * w, sy: 1 - 0.28 * w, rot: 0, o: 1 };
}

// 0 to 1 across the count-up, easing out.
function ceremonyCountAt(t) {
  const k = clamp((t - CEREMONY_SQUASH) / (CEREMONY_COUNT - CEREMONY_SQUASH), 0, 1);
  return 1 - Math.pow(1 - k, 3);
}

// grade is 1 to 3; tiles are the result tiles {to, pre, post, pop}.
function ceremonyStart(grade, tiles) {
  const pops = [];
  tiles.forEach((t, i) => {
    if (t.pop) pops.push({ i, at: CEREMONY_POP_AT[pops.length], on: false });
  });
  ceremony = {
    grade,
    tiles,
    pops,
    t: 0,
    clock: 0,
    phase: CEREMONY_PHASES[0][0],
    seen: [CEREMONY_PHASES[0][0]],
    sounds: { hit: false, win: false, coin: false },
    fx: [],
    rng: dailyRandom((Math.imul(state.runs + 1, 2654435761) ^ grade) >>> 0),
    fxW: 0,
    fxH: 0,
    ox: 0,
    oy: 0,
    shown: tiles.map(() => 0),
    appliedT: -1,
    artDirty: true,
    fxDirty: false
  };
  // Drawn at the drop's peak scale, so the medal stays crisp while it is big.
  const cv = $('resultMedalArt'),
    hi = viewport.dpr * 2.3,
    g = cv.getContext('2d');
  cv.width = Math.ceil(88 * hi);
  cv.height = Math.ceil(88 * hi);
  g.setTransform(hi, 0, 0, hi, 0, 0);
  g.clearRect(0, 0, 88, 88);
  ceremonyMedal(g, 44, 37, 33, grade);
  try {
    if (typeof macyCelebrate === 'function') macyCelebrate(grade);
  } catch {}
  if (reduced) ceremonyFinish();
  else ceremonyApply();
}

// Sizes the confetti canvas to the result hero and finds the medal's center on it.
function ceremonyFit() {
  const c = ceremony,
    cv = $('ceremonyFx'),
    medal = $('resultMedalArt'),
    flight = medal.style.transform;
  // Measure where the medal rests, not where its drop has it this frame.
  medal.style.transform = '';
  const r = cv.getBoundingClientRect(),
    m = medal.getBoundingClientRect();
  medal.style.transform = flight;
  c.fxW = Math.max(1, Math.round(r.width));
  c.fxH = Math.max(1, Math.round(r.height));
  configureCanvas(cv, c.fxW, c.fxH);
  c.ox = m.left + m.width / 2 - r.left;
  c.oy = m.top + m.height / 2 - r.top;
}

// Confetti in the game palette with a few flecks of the medal's metal, from the medal outward.
function ceremonyBurst() {
  ceremonyFit();
  const c = ceremony,
    rng = c.rng,
    n = 46 + c.grade * 14,
    metal = CEREMONY_METALS[c.grade].wash;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 2.6,
      sp = 240 + rng() * 520;
    c.fx.push({
      x: c.ox,
      y: c.oy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      rot: rng() * Math.PI * 2,
      vr: (rng() - 0.5) * 16,
      w: 5 + rng() * 6,
      h: 3 + rng() * 4,
      col: i % 4 === 3 ? metal : CEREMONY_CONFETTI[i % CEREMONY_CONFETTI.length],
      life: 1.1 + rng() * 0.85,
      round: i % 6 === 0
    });
  }
}

function ceremonyUpdate(dt) {
  const c = ceremony;
  if (!c) return;
  c.clock += dt;
  for (const p of c.fx) {
    p.vy += 900 * dt;
    p.vx *= 1 - Math.min(1, 1.6 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.life -= dt;
  }
  if (c.fx.length) c.fx = c.fx.filter(p => p.life > 0);
  if (c.t >= CEREMONY_SECONDS) return;
  c.t = Math.min(CEREMONY_SECONDS, c.t + dt);
  if (!c.sounds.hit && c.t >= CEREMONY_DROP) {
    c.sounds.hit = true;
    sfx('hit');
    ceremonyBurst();
  }
  if (!c.sounds.win && c.t >= CEREMONY_WIN_SFX) {
    c.sounds.win = true;
    sfx('win');
  }
  if (!c.sounds.coin && c.t >= CEREMONY_COUNT) {
    c.sounds.coin = true;
    sfx('coin', { vol: 0.6 });
  }
  c.pops.forEach((pop, i) => {
    if (pop.on || c.t < pop.at) return;
    pop.on = true;
    sfx('combo', { combo: 3 + i * 2 });
  });
  ceremonyPhase();
}

// Moves to the phase the clock is in; the last one shows the final state and readies the share card.
function ceremonyPhase() {
  const c = ceremony,
    phase = ceremonyPhaseAt(c.t);
  if (phase === c.phase) return;
  c.phase = phase;
  c.seen.push(phase);
  ceremonyApply();
  if (phase === 'done') sharePrepare(shareResultSpec());
}

// Jumps to the end: each sound not yet played plays once, the pops show, the confetti goes.
function ceremonyFinish() {
  const c = ceremony;
  if (!c || c.t >= CEREMONY_SECONDS) return;
  if (!c.sounds.hit) sfx('hit');
  if (!c.sounds.win) sfx('win');
  c.sounds = { hit: true, win: true, coin: true };
  const late = c.pops.filter(p => !p.on);
  late.forEach(p => (p.on = true));
  if (late.length) sfx('combo', { combo: 3 });
  c.fx = [];
  c.t = CEREMONY_SECONDS;
  c.clock = Math.max(c.clock, CEREMONY_SECONDS);
  c.artDirty = true;
  c.fxDirty = true;
  ceremonyPhase();
}

// A tap or key on the result screen: true when it cut the ceremony short.
function ceremonySkip() {
  if (!ceremonyRunning()) return false;
  ceremonyFinish();
  ceremonyDraw();
  return true;
}

function ceremonyStop() {
  if (!ceremony) return;
  ceremony = null;
  const cv = $('ceremonyFx'),
    medal = $('resultMedalArt');
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  medal.style.transform = '';
  medal.style.opacity = '';
  $('resultStamp').dataset.stamped = '';
}

// Writes the clock's moment into the DOM: the stamp, the tiles, the pops.
function ceremonyApply() {
  const c = ceremony;
  if (!c || c.appliedT === c.t) return;
  c.appliedT = c.t;
  const s = ceremonyStampAt(c.t),
    medal = $('resultMedalArt'),
    k = ceremonyCountAt(c.t);
  medal.style.transform =
    c.t >= CEREMONY_SQUASH
      ? ''
      : `translateY(${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(2)}deg) scale(${s.sx.toFixed(3)}, ${s.sy.toFixed(3)})`;
  medal.style.opacity = s.o >= 1 ? '' : s.o.toFixed(2);
  $('resultStamp').dataset.stamped = c.t >= CEREMONY_DROP ? '1' : '';
  c.shown = c.tiles.map((tile, i) => {
    const v = k >= 1 ? tile.to : Math.round(tile.to * k);
    $('resultNum' + i).textContent = tile.pre + v + tile.post;
    return v;
  });
  for (const pop of c.pops) $('resultPop' + pop.i).dataset.on = pop.on ? '1' : '';
}

// Gold only: Rowdy gallops in from the left, then turns to cheer at the foot of the bed.
function ceremonyArt(g) {
  const c = ceremony;
  if (!c || c.grade !== 3) return;
  const [a, b] = CEREMONY_RUN;
  if (c.t < a) return;
  if (c.t < b) {
    const k = (c.t - a) / (b - a);
    drawRowdy(g, -70 + (CEREMONY_ROWDY_X + 70) * k, 212, 1.5, 'gallop', c.t, { face: 1 });
    return;
  }
  drawRowdy(g, CEREMONY_ROWDY_X, 212, 1.5, 'cheer', reduced ? 0.5 : c.clock - b, { face: -1 });
}

// Paints one frame: the DOM moment, the result art while anything on it moves, then the confetti.
function ceremonyDraw() {
  const c = ceremony;
  if (!c) return;
  ceremonyApply();
  const live = c.t < CEREMONY_SECONDS || (c.grade === 3 && !reduced);
  if ((live || c.artDirty) && !gore.length) {
    c.artDirty = false;
    drawResultArt();
  }
  ceremonyPaintFx();
}

function ceremonyPaintFx() {
  const c = ceremony,
    since = c.t - CEREMONY_DROP,
    wash = !reduced && since >= 0 && since < CEREMONY_WASH ? 1 - since / CEREMONY_WASH : 0,
    g = $('ceremonyFx').getContext('2d');
  if (!c.fx.length && !wash) {
    if (c.fxDirty) g.clearRect(0, 0, c.fxW, c.fxH);
    c.fxDirty = false;
    return;
  }
  c.fxDirty = true;
  g.clearRect(0, 0, c.fxW, c.fxH);
  if (wash) {
    g.globalAlpha = 0.6 * wash;
    glow(g, c.ox, c.oy, Math.max(c.fxW, c.fxH) * 0.85, CEREMONY_METALS[c.grade].wash);
    g.globalAlpha = 1;
  }
  for (const p of c.fx) {
    g.save();
    g.globalAlpha = Math.min(1, p.life * 2.5);
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    if (p.round) ellipse(g, 0, 0, p.w * 0.45, p.w * 0.45, p.col);
    else rect(g, -p.w / 2, -p.h / 2, p.w, p.h, p.col);
    g.restore();
  }
}

function leaveMini() {
  if (mini.screen === 'outro') return;
  if (mini.forced && !(mini.screen === 'result' && mini.win)) {
    // A lost recovery still ends when the recovery game offers a patch-up: it names the price (coins,
    // never progress) and applies it; the ward resumes with at least one heart. No run is a dead end.
    const def = miniGame();
    if (mini.screen !== 'result' || typeof def.patchUp !== 'function') return;
    def.patchUp();
    state.hp = Math.max(1, state.hp);
    save();
  }
  let recovered = mini.forced;
  mini.open = false;
  clearHeld();
  ceremonyStop();
  $('miniDialog').close();
  state.paused = false;
  if (recovered) {
    loadRoom(0);
    player.inv = 2;
    hud();
  } else music('room:' + state.room);
  checkDischarge();
  canvas.focus({ preventScroll: true });
}

// Discharge needs DISCHARGE_STARS (21) stars, a medal in all six arcades, a level 2 medal, and Ralph out of the way.
// Until combat reports state.ralph, a complete passport only sends Ralph to Macy's room.
function checkDischarge() {
  if (state.won || !(stars() >= DISCHARGE_STARS && stamps() === ARCADE_COUNT && levelTwo())) return;
  if (!state.ralph) {
    if (!state.ralphReady) {
      state.ralphReady = true;
      save();
      hud();
      renderMap();
      toast('Passport complete. Ralph is blocking the exit. Go to your room.', 5);
    }
    return;
  }
  state.won = true;
  save();
  hud();
  $('winScore').textContent =
    `${state.name || 'Macy'} earned ${stars()} discharge stars across all six arcade games and evicted Ralph. The passport is complete.`;
  modalOpen($('winDialog'));
}

// Paints the current game, then either its own overlay or the shared arcade overlays.
function drawMini() {
  if (mini.screen === 'result') {
    ceremonyDraw();
    return;
  }
  if (!['briefing', 'intro', 'play', 'outro'].includes(mini.screen)) return;
  const def = miniGame(),
    size = activeCanvas(),
    g = mc;
  g.clearRect(0, 0, size.w, size.h);
  def.draw(g);
  if (def.overlay) def.overlay(g);
  else drawArcadeOverlays(g);
}

// ---- Shared plumbing for the gesture games (600 × 600 unless they declare otherwise) ----
let arcadePointer = null,
  strokeSerial = 0;

const ARCADE_QUOTA_MISSED =
  'Shift over. Quota missed. The gremlins are unbearable about it. A Steady hands assist buys a breather next time.';

// Common run state for a gesture game; call first from def.init().
function initArcadeRun(limit) {
  Object.assign(mini, { limit, got: 0, shift: 0, notice: 3, fx: [], trail: [], pointer: null, slow: 0 });
  mini.rules.misses = state.difficulty === 0 ? 8 : state.difficulty === 1 ? 6 : 5;
  setInstructions(miniGame().info.cue);
}

// Per-frame wrapper for gesture games: shift escalation, the game step, particles, and the clock.
function updateArcade(dt, step) {
  const def = miniGame();
  mini.slow = Math.max(0, mini.slow - dt);
  mini.notice = Math.max(0, mini.notice - dt);
  // Runs escalate through three shifts: by time by default, or by def.shiftLevel().
  const shift = def.shiftLevel
    ? def.shiftLevel()
    : Math.min(2, Math.floor(mini.phaseTime / (mini.limit / 3)));
  if (shift > mini.shift) {
    mini.shift = shift;
    mini.notice = 3.5;
    sfx('wave');
    if (def.shiftMessage) setInstructions(def.shiftMessage(shift));
  }
  step(dt);
  for (const p of mini.fx) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 220 * dt;
  }
  mini.fx = mini.fx.filter(p => p.life > 0);
  for (const p of mini.trail) p.life -= dt;
  mini.trail = mini.trail.filter(p => p.life > 0);
  if (mini.screen === 'play' && mini.phaseTime >= mini.limit) {
    if (def.timeUp) def.timeUp();
    else arcadeTimeUp();
  }
}

// Default end of the clock: win if the quota is met.
function arcadeTimeUp() {
  const met = mini.got >= mini.goal;
  finishMini(met, met ? undefined : ARCADE_QUOTA_MISSED);
}

// Client coordinates to canvas coordinates for the current game. The canvas uses
// object-fit: contain, so a letterboxed arcade (fullscreen) still maps exactly.
function miniPoint(e) {
  const r = $('miniCanvas').getBoundingClientRect(),
    { w, h } = activeCanvas(),
    s = Math.min(r.width / w, r.height / h) || 1,
    left = r.left + (r.width - w * s) / 2,
    top = r.top + (r.height - h * s) / 2;
  return {
    x: clamp((e.clientX - left) / s, 0, w),
    y: clamp((e.clientY - top) / s, 0, h)
  };
}

function arcadeDown(p) {
  if (mini.screen !== 'play' || mini.paused) return;
  mini.pointer = {
    ...p,
    lastX: p.x,
    lastY: p.y,
    startX: p.x,
    startY: p.y,
    startT: mini.total,
    stroke: ++strokeSerial
  };
  const def = miniGame();
  if (def.down) dailyScoped(() => def.down(p));
}

function arcadeMove(p) {
  if (mini.screen !== 'play' || mini.paused || !mini.pointer) return;
  const prev = { x: mini.pointer.lastX, y: mini.pointer.lastY },
    def = miniGame();
  if (def.move) dailyScoped(() => def.move(p, prev));
  // A move hook can end the run (an oops that spends the last heart), which clears the pointer.
  if (!mini.pointer) return;
  mini.pointer.lastX = p.x;
  mini.pointer.lastY = p.y;
}

// cancel = true when the pointer was lost or the run was interrupted; games must not act on it.
function arcadeUp(cancel = false) {
  const def = miniGame();
  if (def.up) dailyScoped(() => def.up(cancel));
  mini.pointer = null;
}

function arcadeBurst(x, y, col, n = 12) {
  for (let i = 0; i < n; i++)
    mini.fx.push({ x, y, vx: rand(-120, 120), vy: rand(-170, 90), life: rand(0.3, 0.7), col });
}

// Particles, shift banner, flash banner, and the countdown / finish card.
function drawArcadeOverlays(g) {
  const { w, h } = activeCanvas(),
    cx = w / 2,
    cy = h / 2,
    cardW = Math.min(510, w - 30);
  for (const p of mini.fx) {
    g.globalAlpha = Math.min(1, p.life * 3);
    ellipse(g, p.x, p.y, 4, 4, p.col);
  }
  g.globalAlpha = 1;
  if (mini.notice > 0 && mini.screen === 'play') {
    rr(g, cx - 130, 48, 260, 48, 15, '#16374bdf', '#b6d9ca66', 1);
    label(
      g,
      (mini.shift === 2 ? 'FINAL ' : mini.shift === 1 ? 'SECOND ' : 'FIRST ') +
        (miniGame().shiftName || 'SHIFT'),
      cx,
      79,
      18,
      '#f1e2b9',
      'center'
    );
  }
  if (mini.flash > 0) {
    g.globalAlpha = Math.min(1, mini.flash * 3);
    rr(g, 30, 115, w - 60, 37, 12, '#173349ed');
    label(g, mini.flashText, cx, 139, 13, '#ffe5b8', 'center');
    g.globalAlpha = 1;
  }
  if (mini.screen === 'intro' || mini.screen === 'outro') {
    const intro = mini.screen === 'intro';
    rect(g, 0, 0, w, h, '#102c4299');
    rr(g, cx - cardW / 2, cy - 75, cardW, 145, 22, '#112e45ee', '#9dc7be66', 1);
    label(
      g,
      intro ? countdownLabel() : mini.pendingFinish.win ? 'SHIFT COMPLETE' : 'WELL. THAT HAPPENED.',
      cx,
      cy - 5,
      intro ? 64 : 27,
      '#f4ebcf',
      'center'
    );
    label(
      g,
      intro ? 'The clock starts on GO.' : 'Score ' + mini.score + ' · Best chain ' + mini.maxCombo,
      cx,
      cy + 34,
      15,
      '#bad8cc',
      'center'
    );
  }
}
