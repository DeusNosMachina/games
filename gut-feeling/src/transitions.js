// Motion preferences change animation, never the time provided to read or prepare: reduced-motion
// players keep the long countdown and a longer GO card.
const INTRO_SECONDS = reduced ? 3.2 : 1.5,
  INTRO_GO_SECONDS = reduced ? 0.2 : 0.3,
  QUICK_BRIEF_SECONDS = reduced ? 3.2 : 1.2,
  OUTRO_SECONDS = 2.2;

// Briefing copy for the current run or phase.
function lesson() {
  return miniGame().lesson();
}

// Each game (and each IV phase) gets the full briefing once; after that a short GO card.
// The recovery has its own briefing, apart from the room's arcade.
// A game may name its own briefing key (the recovery keys on which of its two phases is playing).
function briefKey() {
  const def = miniGame();
  if (def && typeof def.briefKey === 'function') return def.briefKey();
  return (mini.forced && games.recovery ? 'recovery' : mini.id) + ':' + (mini.phase || 0);
}

function prepareBriefing() {
  mini.screen = 'briefing';
  mini.paused = false;
  mini.held = false;
  mini.transition = 0;
  mini.demoTime = 0;
  mini.countdown = 0;
  mini.flash = 0;
  mini.quickBrief = state.briefed.includes(briefKey());
  clearHeld();
  const l = lesson();
  $('miniBriefKicker').textContent =
    mini.total > 0 ? 'TAKE A BREATHER · THE CLOCK IS PAUSED' : 'GET YOUR BEARINGS · THE CLOCK IS PAUSED';
  $('miniBriefTitle').textContent = l.title;
  $('miniBriefGoal').textContent = l.goal;
  $('miniBriefControl').textContent = l.control;
  $('miniBriefAvoid').textContent = l.avoid;
  $('miniDemo').className = 'control-demo ' + l.demo;
  $('miniRuleGoal').textContent = l.goal;
  $('miniRuleControl').textContent = l.cue;
  $('miniGoTitle').textContent = l.title;
  $('miniGoCue').textContent = l.cue;
  $('miniBriefing').classList.remove('hidden');
  $('miniBriefing').classList.toggle('quick', mini.quickBrief);
  $('miniBriefCard').classList.toggle('hidden', mini.quickBrief);
  $('miniGo').classList.toggle('hidden', !mini.quickBrief);
  $('miniPaused').classList.add('hidden');
  $('miniPauseBtn').classList.add('hidden');
  $('miniDialog').dataset.screen = 'briefing';
  $('miniReadyBtn').textContent = mini.total > 0 ? 'Next challenge →' : 'Ready. Count me in →';
  (mini.quickBrief ? $('miniGo') : $('miniReadyBtn')).focus({ preventScroll: true });
  $('miniDialog').scrollTop = 0;
  updateMiniHUD();
}

function launchMini() {
  if (mini.screen !== 'briefing') return;
  if (!state.briefed.includes(briefKey())) {
    state.briefed.push(briefKey());
    save();
  }
  mini.screen = 'intro';
  mini.transition = 0;
  mini.countTick = countdownLabel(0);
  mini.held = false;
  clearHeld();
  $('miniBriefing').classList.add('hidden');
  $('miniDialog').dataset.screen = 'intro';
  $('miniPauseBtn').classList.remove('hidden');
  $('miniPauseBtn').textContent = 'Ⅱ';
  $('miniCanvas').focus({ preventScroll: true });
  syncMiniTip();
  sfx('countdown');
  music(miniGame().music || 'game:' + mini.id);
  updateMiniHUD();
}

// 3, 2, 1 evenly across the countdown, then GO! for its last moment.
function countdownLabel(t = mini.transition) {
  const count = INTRO_SECONDS - INTRO_GO_SECONDS;
  return t < count ? String(3 - Math.floor(t / (count / 3))) : 'GO!';
}

function updateTransition(dt) {
  if (mini.screen === 'briefing') {
    mini.demoTime += dt;
    if (mini.quickBrief) {
      $('miniGoBar').style.width = Math.min(100, (mini.demoTime / QUICK_BRIEF_SECONDS) * 100) + '%';
      if (mini.demoTime >= QUICK_BRIEF_SECONDS) launchMini();
    }
    return true;
  }
  if (mini.screen === 'intro') {
    if (mini.paused) return true;
    mini.transition += dt;
    if (mini.transition >= INTRO_SECONDS) {
      mini.screen = 'play';
      mini.transition = 0;
      clearHeld();
      $('miniDialog').dataset.screen = 'play';
      showMiniTip();
      sfx('go');
      updateMiniHUD();
    } else if (countdownLabel() !== mini.countTick) {
      mini.countTick = countdownLabel();
      if (mini.countTick !== 'GO!') sfx('countdown');
    }
    return true;
  }
  if (mini.screen === 'outro') {
    mini.transition += dt;
    if (mini.transition >= OUTRO_SECONDS)
      resolveMiniResult(mini.pendingFinish.win, mini.pendingFinish.reason);
    return true;
  }
  return false;
}

function finishMini(win, reason) {
  if (mini.screen !== 'play') return;
  mini.screen = 'outro';
  mini.transition = 0;
  mini.pendingFinish = { win, reason };
  mini.held = false;
  clearHeld();
  $('miniDialog').dataset.screen = 'outro';
  $('miniPauseBtn').classList.add('hidden');
  $('miniClose').disabled = true;
  $('miniTimer').textContent = 'Finished';
  sfx(win ? 'clear' : 'miss');
}

// Countdown / finish card for games with their own overlay (the IV game). It fills the active canvas,
// wide or portrait, and shrinks the 500 px card to fit a narrow one.
function paintTransition(g) {
  const intro = mini.screen === 'intro',
    outro = mini.screen === 'outro';
  if (!intro && !outro) return;
  const duration = intro ? INTRO_SECONDS : OUTRO_SECONDS,
    t = clamp(mini.transition / duration, 0, 1),
    { w, h } = activeCanvas(),
    fit = Math.min(1, (w - 40) / 500);
  g.save();
  rect(g, 0, 0, w, h, outro && !mini.pendingFinish.win ? '#301f3eb5' : '#143849aa');
  g.translate(w / 2, h / 2 - 5);
  g.scale(fit, fit);
  if (!reduced) {
    const z = 0.97 + 0.03 * Math.min(1, t * 5);
    g.scale(z, z);
  }
  rr(g, -250, -70, 500, 155, 24, '#102c42f5', '#afdec277', 1.3);
  const title = intro ? countdownLabel() : mini.pendingFinish.win ? 'Run complete!' : 'Well. That happened.';
  label(g, title, 0, 0, intro ? 64 : 35, outro && !mini.pendingFinish.win ? '#f5b6b2' : '#edf4d7', 'center');
  label(
    g,
    intro ? 'The clock starts on GO.' : 'Score ' + mini.score + ' · best chain ' + mini.maxCombo,
    0,
    43,
    16,
    '#b9d9cc',
    'center'
  );
  if (intro) rr(g, -190, 65, 380 * t, 4, 2, '#b5e8c5');
  g.restore();
}
