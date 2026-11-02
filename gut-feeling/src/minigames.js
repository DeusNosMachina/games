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
  return { date: key, id: h % rooms.length, tier: Math.floor(h / rooms.length) % 3, seed: dailyHash(key + '/seed') };
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

// Department card and lobby preview art.
function miniScene(g, id, w, h) {
  games[id].scene(g, w, h);
}

function openMini(id, forced = false) {
  clearHeld();
  if ($('mapDialog').open) $('mapDialog').close();
  let next = state.medals[id].findIndex(m => !m),
    tier = forced ? 0 : next < 0 ? 2 : next;
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
  showLobby();
  modalOpen($('miniDialog'));
}

function showLobby() {
  const def = games[mini.id],
    info = def.info;
  mini.screen = 'lobby';
  mini.held = false;
  clearHeld();
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
  // One screen: level cards, approach, one big start. Level 1 teaches; 2 and 3 are the real deal.
  // A level unlocks once the previous one has any medal; forced recovery stays on level 1.
  // A Daily Dose fixes the level and Show-off rules.
  $('tierGrid').innerHTML = tiers
    .map((t, i) => {
      const medal = state.medals[mini.id][i],
        locked = mini.daily ? i !== mini.tier : i > 0 && (!state.medals[mini.id][i - 1] || mini.forced);
      return (
        `<button class="tier-card ${mini.tier === i ? 'selected' : ''}" data-tier="${i}" ${locked ? 'disabled' : ''}>` +
        `<small>LEVEL ${i + 1}</small><span class="tier-tag">${i === 0 ? 'Teaches you' : 'The real deal'}</span>` +
        `<strong>${t}</strong><small>${def.tierNotes[i]}</small>` +
        `<div class="medals">${'★'.repeat(medal)}${'☆'.repeat(3 - medal)}</div></button>`
      );
    })
    .join('');
  $('approachOptions').innerHTML = approaches
    .map((a, i) => {
      const helps = approachHelps(i),
        desc = i === 0 ? `${helps === 3 ? 'Three' : 'Two'} emergency assists for the whole run.` : a.desc,
        off = mini.daily && i === 0;
      return (
        `<button class="approach ${mini.approach === i ? 'selected' : ''}" data-approach="${i}" ` +
        `aria-pressed="${mini.approach === i}" ${off ? 'disabled' : ''}><strong>${a.name}</strong><small>${desc}</small></button>`
      );
    })
    .join('');
  $('dailyBanner').classList.toggle('hidden', !mini.daily);
  if (mini.daily)
    $('dailyBanner').textContent =
      `DAILY DOSE · ${dailyLabel(mini.dailyDate)} · Same gremlins for everyone today. ` +
      (state.daily.last === mini.dailyDate ? `Today’s best: ${state.daily.best}.` : `First run pays +${dailyBonus()} coins.`);
  $('miniStart').innerHTML = mini.daily
    ? 'Take today’s dose →'
    : mini.forced
      ? 'Start the recovery →'
      : 'Let’s make poor decisions →';
  $('miniRewardInfo').textContent = mini.forced
    ? 'Finish all three stages to get out of bed.'
    : 'Bronze 1★ · Silver 2★ · Gold 3★.';
  $('miniBest').textContent = 'Best here: ' + (state.records[mini.id][mini.tier] || 'nothing yet') + '.';
  $('miniDifficulty').textContent = 'Chaos prescription: ' + cfg().name + ' ↗';
  miniScene($('miniPreview').getContext('2d'), mini.id, 420, 240);
}

function startMini() {
  const { id, tier, forced, approach = 0, daily = false, dailyDate = '', dailySeed = 0 } = mini,
    def = games[id];
  clearHeld();
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
    rules: { ...cfg(), misses: cfg().misses + 2, coins: cfg().coins * approaches[approach].multiplier },
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
    inputLock: 0
  };
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
  configureCanvas($('miniCanvas'), def.canvas.w, def.canvas.h);
  $('miniDialog').dataset.arcade = def.layout;
  mini.initialized = true;
  prepareBriefing();
  updateMiniHUD();
  drawMini();
}

function setInstructions(t) {
  $('miniInstruction').textContent = t;
}

// Buttons: {id, text, key?, hot?, pad?}. Each click sends miniAction(id); the assist button is always appended.
function setControls(buttons) {
  $('miniControls').dataset.game = mini.id;
  const html = buttons.map(
    b =>
      `<button data-action="${b.id}" class="${b.hot ? 'hot ' : ''}${b.pad ? 'pad' : ''}" ${b.pad ? `style="--pad:${b.pad}"` : ''}` +
      ` aria-label="${b.text}">${b.text}${b.key ? ` <small>(${b.key})</small>` : ''}</button>`
  );
  $('miniControls').innerHTML =
    html.join('') +
    `<button class="assist muted" data-action="assist" aria-label="Use limited assist">ASSIST · ${mini.helps} left <small>(E)</small></button>`;
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
  dailyScoped(() => games[mini.id].assist());
  updateMiniHUD();
}

function miniAction(a) {
  if (mini.screen !== 'play' || mini.paused || mini.countdown > 0) return;
  if (a === 'assist') {
    useAssist();
    return;
  }
  const def = games[mini.id];
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
  if (updateTransition(dt)) return;
  if (mini.screen === 'result') {
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
  mini.flash = Math.max(0, mini.flash - dt);
  mini.inputLock = Math.max(0, mini.inputLock - dt);
  mini.helpTime = Math.max(0, mini.helpTime - dt);
  mini.t += dt;
  mini.total += dt;
  mini.phaseTime += dt;
  mini.hudClock -= dt;
  dailyScoped(() => games[mini.id].update(dt));
  if (mini.hudClock <= 0) {
    updateMiniHUD();
    mini.hudClock = 0.08;
  }
}

function updateMiniHUD() {
  if (!['play', 'briefing', 'intro'].includes(mini.screen)) return;
  const def = games[mini.id];
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
  const def = games[mini.id],
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
  const old = state.medals[id][tier],
    delta = Math.max(0, grade - old);
  state.medals[id][tier] = Math.max(old, grade);
  let pay =
    Math.round((18 + grade * 18 + tier * 12 + quality * 0.2 + Math.min(70, arcadeScore / 120)) * multiplier) +
    delta * 20;
  coins(pay);
  return { delta, pay, old };
}

function resolveMiniResult(win, reason) {
  if (mini.screen !== 'outro') return;
  const def = games[mini.id];
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
  $('miniBack').classList.toggle('hidden', mini.forced && !win);
  $('miniRetry').textContent = mini.daily ? 'Run it back' : win ? 'Improve / next level' : 'Reassemble. Try again.';
  if (win) {
    mini.qualityFinal = qualityScore();
    mini.grade = mini.qualityFinal >= 88 ? 3 : mini.qualityFinal >= 68 ? 2 : 1;
    const previousBest = state.records[mini.id][mini.tier];
    state.records[mini.id][mini.tier] = Math.max(previousBest, mini.score);
    const reward = grantReward(
      mini.id,
      mini.tier,
      mini.grade,
      mini.qualityFinal,
      mini.rules.coins,
      mini.score
    );
    mini.reward = reward;
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
    $('resultNumbers').innerHTML =
      `<div><strong>${mini.score}</strong>` +
      `<small>ARCADE SCORE · BEST ${state.records[mini.id][mini.tier]}</small></div><div>` +
      `<strong>${mini.qualityFinal}%</strong><small>PERFORMANCE</small></div><div>` +
      `<strong>+${reward.pay}</strong><small>COINS EARNED</small></div><div>` +
      `<strong>+${reward.delta} ★</strong><small>NEW DISCHARGE STARS</small></div>`;
    $('resultJourney').textContent =
      `${stars()}/12 stars · ${stamps()}/${rooms.length} arcades · ${levelTwo() ? 'Level 2 stamped' : 'Level 2 stamp still needed'}. ${reward.delta ? 'New personal best.' : 'Your best medal stays. Replay coins paid.'}`;
    sfx('win');
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
      ? 'Still in bed. Reassemble, then finish all three IV phases.'
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
  drawResultArt();
  // Show the result art in full under the sticky header instead of scrolling it half out of view.
  $('miniDialog').scrollTop = 0;
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
  const def = games[mini.id];
  // A game may paint its own foreground over the shared bedside scene.
  if (def.resultArt && def.resultArt(g)) return;
  if (mini.win) {
    for (let i = 0; i < mini.grade; i++) spark(g, 353 + i * 42, 44, '#fff0ab', 1.15);
    label(g, 'STATUS: STILL A TOTAL LEGEND', 400, 26, 11, '#426d62', 'center');
  } else {
    gremlin(g, 630, 190, 1.5, 1, time);
    label(g, 'THE GREMLINS ARE BEING VERY SMUG.', 400, 29, 12, '#dfe2b9', 'center');
  }
}

function leaveMini() {
  if (mini.screen === 'outro') return;
  if (mini.forced && !(mini.screen === 'result' && mini.win)) return;
  let recovered = mini.forced;
  mini.open = false;
  clearHeld();
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

// Discharge needs 12 stars, a medal in all six arcades, a level 2 medal, and Ralph out of the way.
// Until combat reports state.ralph, a complete passport only sends Ralph to Macy's room.
function checkDischarge() {
  if (state.won || !(stars() >= 12 && stamps() === rooms.length && levelTwo())) return;
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
  if (!['briefing', 'intro', 'play', 'outro'].includes(mini.screen)) return;
  const def = games[mini.id],
    g = mc;
  g.clearRect(0, 0, def.canvas.w, def.canvas.h);
  def.draw(g);
  if (def.overlay) def.overlay(g);
  else drawArcadeOverlays(g);
}

// ---- Shared plumbing for the gesture games (600 × 600) ----
let arcadePointer = null,
  strokeSerial = 0;

const ARCADE_QUOTA_MISSED =
  'Shift over. Quota missed. The gremlins are unbearable about it. A Steady hands assist buys a breather next time.';

// Common run state for a gesture game; call first from def.init().
function initArcadeRun(limit) {
  Object.assign(mini, { limit, got: 0, shift: 0, notice: 3, fx: [], trail: [], pointer: null, slow: 0 });
  mini.rules.misses = state.difficulty === 0 ? 8 : state.difficulty === 1 ? 6 : 5;
  setInstructions(games[mini.id].info.cue);
}

// Per-frame wrapper for gesture games: shift escalation, the game step, particles, and the clock.
function updateArcade(dt, step) {
  const def = games[mini.id];
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
    { w, h } = games[mini.id].canvas,
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
  const def = games[mini.id];
  if (def.down) dailyScoped(() => def.down(p));
}

function arcadeMove(p) {
  if (mini.screen !== 'play' || mini.paused || !mini.pointer) return;
  const prev = { x: mini.pointer.lastX, y: mini.pointer.lastY },
    def = games[mini.id];
  if (def.move) dailyScoped(() => def.move(p, prev));
  // A move hook can end the run (an oops that spends the last heart), which clears the pointer.
  if (!mini.pointer) return;
  mini.pointer.lastX = p.x;
  mini.pointer.lastY = p.y;
}

// cancel = true when the pointer was lost or the run was interrupted; games must not act on it.
function arcadeUp(cancel = false) {
  const def = games[mini.id];
  if (def.up) dailyScoped(() => def.up(cancel));
  mini.pointer = null;
}

function arcadeBurst(x, y, col, n = 12) {
  for (let i = 0; i < n; i++)
    mini.fx.push({ x, y, vx: rand(-120, 120), vy: rand(-170, 90), life: rand(0.3, 0.7), col });
}

// Particles, shift banner, flash banner, and the countdown / finish card.
function drawArcadeOverlays(g) {
  for (const p of mini.fx) {
    g.globalAlpha = Math.min(1, p.life * 3);
    ellipse(g, p.x, p.y, 4, 4, p.col);
  }
  g.globalAlpha = 1;
  if (mini.notice > 0 && mini.screen === 'play') {
    rr(g, 170, 48, 260, 48, 15, '#16374bdf', '#b6d9ca66', 1);
    label(
      g,
      (mini.shift === 2 ? 'FINAL ' : mini.shift === 1 ? 'SECOND ' : 'FIRST ') +
        (games[mini.id].shiftName || 'SHIFT'),
      300,
      79,
      18,
      '#f1e2b9',
      'center'
    );
  }
  if (mini.flash > 0) {
    g.globalAlpha = Math.min(1, mini.flash * 3);
    rr(g, 30, 115, 540, 37, 12, '#173349ed');
    label(g, mini.flashText, 300, 139, 13, '#ffe5b8', 'center');
    g.globalAlpha = 1;
  }
  if (mini.screen === 'intro' || mini.screen === 'outro') {
    const intro = mini.screen === 'intro';
    rect(g, 0, 0, 600, 600, '#102c4299');
    rr(g, 45, 225, 510, 145, 22, '#112e45ee', '#9dc7be66', 1);
    label(
      g,
      intro ? countdownLabel() : mini.pendingFinish.win ? 'SHIFT COMPLETE' : 'WELL. THAT HAPPENED.',
      300,
      295,
      intro ? 64 : 27,
      '#f4ebcf',
      'center'
    );
    label(
      g,
      intro ? 'The clock starts on GO.' : 'Score ' + mini.score + ' · Best chain ' + mini.maxCombo,
      300,
      334,
      15,
      '#bad8cc',
      'center'
    );
  }
}
