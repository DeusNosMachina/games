// Motion preferences change animation, never the time provided to read or prepare.
const INTRO_SECONDS = 3.2,
  OUTRO_SECONDS = 2.2;

// Briefing copy for the current run or phase.
function lesson() {
  return games[mini.id].lesson();
}

function prepareBriefing() {
  mini.screen = 'briefing';
  mini.paused = false;
  mini.held = false;
  mini.transition = 0;
  mini.demoTime = 0;
  mini.countdown = 0;
  mini.flash = 0;
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
  $('miniBriefing').classList.remove('hidden');
  $('miniPaused').classList.add('hidden');
  $('miniPauseBtn').classList.add('hidden');
  $('miniDialog').dataset.screen = 'briefing';
  $('miniReadyBtn').textContent = mini.total > 0 ? 'Ready for the next challenge →' : 'Ready — count me in';
  $('miniReadyBtn').focus({ preventScroll: true });
  $('miniDialog').scrollTop = 0;
  updateMiniHUD();
}

function launchMini() {
  if (mini.screen !== 'briefing') return;
  mini.screen = 'intro';
  mini.transition = 0;
  mini.held = false;
  clearHeld();
  $('miniBriefing').classList.add('hidden');
  $('miniDialog').dataset.screen = 'intro';
  $('miniPauseBtn').classList.remove('hidden');
  $('miniPauseBtn').textContent = 'Ⅱ';
  $('miniCanvas').focus({ preventScroll: true });
  tone(440, 0.1, 'sine');
  updateMiniHUD();
}

function updateTransition(dt) {
  if (mini.screen === 'briefing') {
    mini.demoTime += dt;
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
      tone(660, 0.09, 'sine');
      updateMiniHUD();
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
  tone(win ? 690 : 135, win ? 0.2 : 0.3, win ? 'sine' : 'triangle');
}

// Countdown / finish card for the wide 800 × 450 canvas (the IV game).
function paintTransition(g) {
  const intro = mini.screen === 'intro',
    outro = mini.screen === 'outro';
  if (!intro && !outro) return;
  const duration = intro ? INTRO_SECONDS : OUTRO_SECONDS,
    t = clamp(mini.transition / duration, 0, 1);
  g.save();
  rect(g, 0, 0, 800, 450, outro && !mini.pendingFinish.win ? '#301f3eb5' : '#143849aa');
  g.translate(400, 220);
  if (!reduced) {
    const z = 0.97 + 0.03 * Math.min(1, t * 5);
    g.scale(z, z);
  }
  rr(g, -250, -70, 500, 155, 24, '#102c42f5', '#afdec277', 1.3);
  const title = intro
    ? mini.transition < 3
      ? String(3 - Math.floor(mini.transition))
      : 'GO!'
    : mini.pendingFinish.win
      ? 'Run complete!'
      : 'Well. That happened.';
  label(g, title, 0, 0, intro ? 64 : 35, outro && !mini.pendingFinish.win ? '#f5b6b2' : '#edf4d7', 'center');
  label(
    g,
    intro
      ? 'Find your controls. The clock has not started.'
      : 'Score ' + mini.score + ' · best chain ' + mini.maxCombo,
    0,
    43,
    16,
    '#b9d9cc',
    'center'
  );
  if (intro) rr(g, -190, 65, 380 * t, 4, 2, '#b5e8c5');
  g.restore();
}
