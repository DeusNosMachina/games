// Arcade framework: lobby, run lifecycle, HUD, scoring, rewards, results, and the shared plumbing
// for gesture games. Rules and art for each game live in games/*.js; see ARCHITECTURE.md.
const mc = $('miniCanvas').getContext('2d');

// Each run owns its timers, score, limited assists, and escalating rounds.
const approaches = [
  { name: 'Steady hands', helps: 2, multiplier: 1, desc: 'Two emergency assists for the entire run.' },
  { name: 'Show-off shift', helps: 0, multiplier: 1.25, desc: 'No assists. Earn 25% more coins.' }
];

// Department card and lobby preview art.
function miniScene(g, id, w, h) {
  games[id].scene(g, w, h);
}

function openMini(id, forced = false) {
  clearHeld();
  if ($('mapDialog').open) $('mapDialog').close();
  let next = state.medals[id].findIndex(m => !m),
    tier = forced ? 0 : next < 0 ? 2 : next;
  mini = { open: true, screen: 'lobby', id, tier, forced, approach: 0, paused: false, held: false, t: 0 };
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
  // A level unlocks once the previous one has any medal; forced recovery stays on level 1.
  $('tierGrid').innerHTML = tiers
    .map((t, i) => {
      const medal = state.medals[mini.id][i];
      const locked = i > 0 && (!state.medals[mini.id][i - 1] || mini.forced);
      return (
        `<button class="tier-card ${mini.tier === i ? 'selected' : ''}" data-tier="${i}" ${locked ? 'disabled' : ''}>` +
        `<small>LEVEL ${i + 1}</small><strong>${t}</strong><small>${def.tierNotes[i]}</small>` +
        `<div class="medals">${'★'.repeat(medal)}${'☆'.repeat(3 - medal)}</div></button>`
      );
    })
    .join('');
  $('approachOptions').innerHTML = approaches
    .map(
      (a, i) =>
        `<button class="approach ${mini.approach === i ? 'selected' : ''}" data-approach="${i}" aria-pressed="${mini.approach === i}">` +
        `<strong>${a.name}</strong><small>${a.desc}</small></button>`
    )
    .join('');
  $('miniRewardInfo').textContent =
    (mini.forced ? 'Complete all three stages to recover. ' : 'Longer runs. New mechanics at each level. ') +
    'Bronze 1★ · Silver 2★ · Gold 3★. Precision, clean chains, and unused assists improve your result.';
  $('miniBest').textContent =
    'Best arcade score here: ' +
    (state.records[mini.id][mini.tier] || '—') +
    ' · Progress saves between runs.';
  $('miniDifficulty').textContent = 'Chaos prescription: ' + cfg().name + ' ↗';
  miniScene($('miniPreview').getContext('2d'), mini.id, 420, 240);
}

function startMini() {
  const { id, tier, forced, approach = 0 } = mini,
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
    helps: approaches[approach].helps,
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
  def.init();
  if (def.controls) def.controls();
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
  tone(120, 0.17, 'sawtooth');
  if (mini.miss >= mini.rules.misses) finishMini(false);
}

// Assists are limited per run and cost style points; the game supplies the effect.
function useAssist() {
  if (mini.helps <= 0) return;
  mini.helps--;
  mini.helpUsed++;
  mini.quality -= 5;
  mini.combo = 0;
  games[mini.id].assist();
  updateMiniHUD();
}

function miniAction(a) {
  if (mini.screen !== 'play' || mini.paused || mini.countdown > 0) return;
  if (a === 'assist') {
    useAssist();
    return;
  }
  const def = games[mini.id];
  if (def.action) def.action(a);
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
  games[mini.id].update(dt);
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
function qualityScore() {
  const def = games[mini.id];
  return def.quality ? def.quality() : arcadeQuality();
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
  state.coins += pay;
  save();
  hud();
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
  $('miniPlay').classList.add('hidden');
  $('miniLobby').classList.add('hidden');
  $('miniResult').classList.remove('hidden');
  $('miniPauseBtn').classList.add('hidden');
  $('miniBack').classList.toggle('hidden', mini.forced && !win);
  $('miniRetry').textContent = win ? 'Improve / next level' : 'Reassemble. Try again.';
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
      `${stars()}/12 stars · ${stamps()}/${rooms.length} arcades · ${levelTwo() ? 'Level 2 stamped' : 'Level 2 stamp still needed'}. ${reward.delta ? 'New personal best.' : 'Your best medal stays. Replay coins awarded.'}`;
    tone(784, 0.35);
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
      ? 'You’re still in bed. Reassemble, then complete all three IV phases.'
      : 'One heart lost (minimum one). Retry or explore another department.';
    tone(65, 0.4, 'sawtooth');
  }
  drawResultArt();
  $('miniResult').scrollIntoView({ block: 'nearest' });
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
  }
  checkDischarge();
  canvas.focus({ preventScroll: true });
}

function checkDischarge() {
  if (!state.won && stars() >= 12 && stamps() === rooms.length && levelTwo()) {
    state.won = true;
    save();
    $('winScore').textContent =
      `${state.name || 'Macy'} earned ${stars()} discharge stars across all six arcade challenges. Your arcade passport is complete.`;
    modalOpen($('winDialog'));
  }
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
  'Shift over. Quota missed. In the race, jumping crates, sliding bars and defeating gremlins earn stunts. Try a Steady hands assist if needed.';

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
    tone(520, 0.12);
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

// Client coordinates to canvas coordinates for the current game.
function miniPoint(e) {
  const r = $('miniCanvas').getBoundingClientRect(),
    { w, h } = games[mini.id].canvas;
  return {
    x: clamp(((e.clientX - r.left) * w) / r.width, 0, w),
    y: clamp(((e.clientY - r.top) * h) / r.height, 0, h)
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
  if (def.down) def.down(p);
}

function arcadeMove(p) {
  if (mini.screen !== 'play' || mini.paused || !mini.pointer) return;
  const prev = { x: mini.pointer.lastX, y: mini.pointer.lastY },
    def = games[mini.id];
  if (def.move) def.move(p, prev);
  mini.pointer.lastX = p.x;
  mini.pointer.lastY = p.y;
}

// cancel = true when the pointer was lost or the run was interrupted; games must not act on it.
function arcadeUp(cancel = false) {
  const def = games[mini.id];
  if (def.up) def.up(cancel);
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
      intro
        ? mini.transition < 3
          ? String(3 - Math.floor(mini.transition))
          : 'GO!'
        : mini.pendingFinish.win
          ? 'SHIFT COMPLETE'
          : 'WELL. THAT HAPPENED.',
      300,
      295,
      intro ? 64 : 27,
      '#f4ebcf',
      'center'
    );
    label(
      g,
      intro
        ? 'Find your grip. The clock is still paused.'
        : 'Score ' + mini.score + ' · Best chain ' + mini.maxCombo,
      300,
      334,
      15,
      '#bad8cc',
      'center'
    );
  }
}
