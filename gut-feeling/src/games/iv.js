// Drip or Die: the recovery ritual. Zero hearts sends Macy back to bed for ONE gentle phase: tap the
// drip while the line crosses the mint window. It is registered as 'recovery', so the framework runs it
// in place of the room's arcade whenever a run is forced (openMini(0, true)). Eight drips, three
// strikes, windows that shrink a little and never move. Every recovery is the same level; it never
// climbs. Three strikes end in the staged cartoon explosion, and a lost recovery can be retried or
// ended from the result screen with a patch-up that costs coins (never progress or medals).
// Canvas 800 × 450, or 450 × 800 when the framework sets mini.portrait on an upright phone: a scene
// strip on top and the bar below it. Rules never change with the shape; draw code asks every frame.

// Three strikes end the run, every time. The third one pops.
const IV_STRIKES = 3;

// The one level. Widths are shares of the bar, times are seconds.
//   required        drips to land
//   limit           seconds on the clock
//   width [lo, hi]  window width range for the first sweep; each landed drip multiplies it by shrink,
//                   never below floor. Every sweep draws its own width from the current range.
//   speed, ramp     marker speed in bar widths per second, and how much faster it ends (0.15 = 15%)
const IV_DRIP = { required: 8, limit: 48, width: [0.17, 0.21], shrink: 0.95, floor: 0.12, speed: 0.43, ramp: 0.15 };

// A lost recovery can end from the result screen for this share of her coins, rounded down.
const IV_PATCH_SHARE = 0.15;

// How long the ring at a touch point lasts, in seconds.
const IV_RIPPLE_SECONDS = 0.4;

const IV_WORDS = ['SPLORT!', 'KABLORT!', 'SPLOOSH!', 'BLAMMO!', 'GLORP!', 'KERSPLAT!'];
const IV_INK = '#3d0f1f';
const IV_CRATER = [400, 128];

// Wall spots for the aftermath. Every screen size shows x 120 to 680 and y 45 to 175 of the result canvas.
const IV_SLOTS = [
  [150, 62],
  [192, 104],
  [222, 58],
  [322, 54],
  [374, 50],
  [430, 52],
  [484, 94],
  [616, 66],
  [654, 112],
  [318, 112],
  [142, 134],
  [604, 140]
];

// Where the spine lands in each variant (angle from upright), and the wall spots it would cover.
const IV_SPINES = [
  { x: 204, y: 178, a0: -0.1, a1: -0.42, block: [1, 10] },
  { x: 628, y: 178, a0: 0.08, a1: 0.42, block: [8, 11] },
  { x: 350, y: 152, a0: 1.3, a1: 1.5, block: [] }
];

const IV_ORGAN_SCALE = { heart: 1.5, lung: 1.4, stomach: 1.45, liver: 1.35, kidney: 1.25, spleen: 1.3 };
const IV_STREAK = {
  heart: '#c8203fbb',
  lung: '#ee8aa2aa',
  stomach: '#f07a95aa',
  liver: '#7d1c34bb',
  kidney: '#a4233fbb',
  spleen: '#7c2752bb'
};

const IV_LOSS_COPY = [
  ['SOME ASSEMBLY REQUIRED.', 'Your insides have become outsides. Housekeeping has been notified.'],
  ['WELL. THAT’S EVERYWHERE NOW.', 'Good news: your heart is still beating. Bad news: it is on the wall.'],
  ['HOUSEKEEPING HAS QUESTIONS.', 'Every organ accounted for. Most of them are on the wall. The scrunchie made it.'],
  ['INSIDES: NOW OUTSIDES.', 'The IV pole is wearing your intestines like a scarf. Honestly? It works.']
];

// The recovery in progress ({count}), kept so a retry after an explosion is not another collapse.
// Cleared when the recovery is won or patched up; the next collapse starts a new one.
let ivRecovery = null;

// Explosion bookkeeping survives between runs so a second viewing lands differently.
let ivBoomCount = 0;
let ivLastWord = '';
let ivLastHeartSlot = -1;

const IV = registerGame({
  id: 'recovery',
  canvas: { w: 800, h: 450 },
  portraitCanvas: { w: 450, h: 800 },
  layout: 'iv',
  music: 'game:0',
  info: {
    game: 'Drip or Die',
    genre: 'RECOVERY · ONE IV · THREE STRIKES',
    headline: 'One IV. Then back to the ward.',
    desc:
      'Zero hearts means back to bed for one IV. Tap while the line crosses the mint window: eight good drips and you are up, hearts and all. Three strikes and things get anatomical. If it goes badly, the nurse can patch you up for a few coins.'
  },
  tierNotes: [
    'Eight drips. Three strikes. No surprises.',
    'Recovery never gets harder than level 1.',
    'Recovery never gets harder than level 1.'
  ],
  init() {
    // Every recovery is the same gentle level, whatever level the lobby passed in.
    ivRecoveryStart();
    mini.tier = 0;
    mini.rules.misses = IV_STRIKES;
    mini.good = 0;
    mini.precision = [];
    mini.ivChain = 0;
    mini.ivBestChain = 0;
    mini.ivMoodKind = 'calm';
    mini.ivMoodT = 0;
    mini.ivBpm = 88;
    mini.ivSeenMiss = 0;
    mini.ivDripFx = [];
    mini.ivDripClock = 0.6;
    mini.ivBoomBeep = 0;
    mini.ivAfter = null;
    mini.ivRipples = [];
    // What a won run would overwrite on the room's arcade (see onWin).
    mini.ivKeep = { medal: state.medals[mini.id][0], record: state.records[mini.id][0] };
    // The burst word never repeats back to back.
    const words = IV_WORDS.filter(w => w !== ivLastWord);
    mini.ivWord = pick(words);
    ivLastWord = mini.ivWord;
    ivSetup();
  },
  controls() {
    setControls([{ id: 'tap', text: 'TAP THE DRIP', key: 'Space', hot: true }]);
  },
  update(dt) {
    ivUpdateFx(dt);
    ivUpdateTap(dt);
    if (mini.screen === 'play' && mini.phaseTime >= mini.limit)
      finishMini(false, 'The clock called. It wants its seconds back. ' + ivPatchLine());
  },
  draw(g) {
    if (mini.screen === 'outro' && mini.pendingFinish && !mini.pendingFinish.win) {
      ivDrawBoom(g);
      return;
    }
    const { w, h } = ivCanvas();
    g.save();
    // The intro zoom is motion only; reduced-motion keeps the frame still.
    if (mini.screen === 'intro' && !reduced) {
      let z = 0.97 + 0.03 * Math.min(1, mini.transition / INTRO_SECONDS);
      g.translate(w / 2, h / 2);
      g.scale(z, z);
      g.translate(-w / 2, -h / 2);
    }
    ivDrawPlay(g);
    g.restore();
  },
  overlay(g) {
    // The losing outro is the explosion itself; draw() already painted it.
    if (mini.screen === 'outro' && mini.pendingFinish && !mini.pendingFinish.win) return;
    if (mini.flash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, mini.flash * 3);
      const good = !/MISS|AWAY|STRIKE/.test(mini.flashText);
      if (mini.portrait) {
        panel(g, 14, 656, 422, 36, good ? '#356e61' : '#75455b', '#d4b399');
        ivFitLabel(g, mini.flashText, 225, 680, 14, '#ffedd0', 400);
      } else {
        panel(g, 105, 42, 590, 34, good ? '#356e61' : '#75455b', '#d4b399');
        label(g, mini.flashText, 400, 65, 14, '#ffedd0', 'center');
      }
      g.restore();
    }
    // Ripples only age during play, so they only show during play.
    if (mini.screen === 'play') ivDrawRipples(g);
    paintTransition(g);
  },
  action(a) {
    if (a === 'tap') ivTap();
  },
  assist() {
    mini.helpTime = 4;
    mini.flash = 0.7;
    mini.flashText = 'WINDOWS WIDENED. FIVE STYLE POINTS.';
    sfx('shield');
  },
  key(k, e) {
    if (k !== ' ') return false;
    e.preventDefault();
    if (!e.repeat) miniAction('tap');
    return true;
  },
  // The finger is the button: a press anywhere on the canvas taps the drip.
  down(p) {
    ivRipple(p);
    miniAction('tap');
  },
  lesson() {
    return {
      title: 'Recovery / Drip or Die',
      goal: 'Land ' + mini.required + ' drips and you are out of bed with your hearts back.',
      control:
        'Tap the screen (or TAP THE DRIP, or Space) while the line crosses the mint window. Gold centers in a row build a chain multiplier.',
      avoid:
        'Tapping outside the mint, or letting a drip slip past, is a strike. Three strikes and you pop. If you pop, try again or let the nurse patch you up for a few coins.',
      demo: 'timing',
      cue: 'Tap on mint · 8 drips · 3 strikes'
    };
  },
  statLabel: () => 'PRIME THE PUMP',
  stat: () => mini.good + '/' + mini.required + ' drips',
  livesLabel: () => 'STRIKES',
  // Three marks; a ✕ fills in for every strike.
  lives: () => {
    const used = Math.min(mini.miss, mini.rules.misses);
    return ('✕ '.repeat(used) + '○ '.repeat(mini.rules.misses - used)).trim();
  },
  tactics: () => 'SCORE ' + mini.score + '   ·   GOLD CHAIN ×' + ivChainMult() + '   ·   ' + mini.helps + ' ASSISTS LEFT',
  assistText: () => 'WIDEN WINDOWS · ' + mini.helps + ' left (E)',
  // Precision and gold chains earn the medal; strikes and assists cost it.
  quality() {
    const p = mini.precision,
      accuracy = p.length ? p.reduce((a, b) => a + b, 0) / p.length : 0.6;
    return Math.round(clamp(56 + accuracy * 30 + Math.min(14, mini.ivBestChain * 2.8) - (100 - mini.quality), 0, 100));
  },
  // Out of bed: hearts back by medal, and the next collapse starts a new recovery.
  onWin() {
    ivRecovery = null;
    // The framework stamps a won run's medal and best score on the room's arcade (the throwing game,
    // id 0). A recovery is not that game, so put both back and show no new stars.
    if (mini.ivKeep) {
      state.medals[mini.id][mini.tier] = mini.reward ? mini.reward.old : mini.ivKeep.medal;
      state.records[mini.id][mini.tier] = mini.ivKeep.record;
      if (mini.reward) mini.reward.delta = 0;
    }
    state.hp = Math.max(state.hp, 2 + mini.grade);
    player.vomit = 0;
    save();
    hud();
    return state.hp + ' hearts restored. The nutrients have entered the chat.';
  },
  // A failed recovery goes anatomical. gore holds the aftermath, animated on the result canvas.
  onLose() {
    const after = ivBuildAftermath();
    return { gory: true, medal: '✚', heading: after.copy[0], text: after.copy[1] + ' ' + ivPatchLine() };
  },
  resultArt(g) {
    if (mini.win) return false;
    // Reduced motion opens on the settled scene; only the gentle loop keeps moving.
    const t = (mini.resultT || 0) + (reduced ? 5 : 0);
    ivGoreSync(t);
    ivDrawAftermath(g, t);
    return true;
  },
  // The way out of a lost recovery: coins, never progress. The framework then gives her at least one
  // heart and sends her back to the ward.
  patchUp() {
    const cost = ivPatchCost();
    if (cost > 0) coins(-cost);
    ivRecovery = null;
    toast(
      cost > 0 ? 'Patched up for ' + cost + ' coins. The nurse used a lot of tape.' : 'Patched up on the house. The nurse used a lot of tape.',
      3.4
    );
  },
  patchUpLabel: () => {
    const cost = ivPatchCost();
    return cost > 0 ? 'Get patched up · ' + cost + ' coins' : 'Get patched up · free';
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
    ivPatient(g, -30, 8, 0.7, { mood: 'smile' });
    ivStand(g, 37, 9, 0.7);
    plant(g, 95, 13, 0.7);
    g.restore();
  }
});

// The recovery is not an arcade: keep it out of anything that counts or lists the arcades (the map,
// the passport, the Daily Dose, the registry checks). games.recovery still finds it.
Object.defineProperty(games, 'recovery', { value: IV, enumerable: false, configurable: true, writable: true });

// ---------- Shared helpers ----------

// The canvas this frame draws on. The framework may flip mini.portrait mid-run, so ask every frame.
function ivCanvas() {
  const c = mini.portrait ? IV.portraitCanvas : IV.canvas;
  return { w: c.w, h: c.h };
}

function ivHash(n) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function ivEase(u) {
  u = clamp(u, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function ivEaseOut(u) {
  u = clamp(u, 0, 1);
  return 1 - Math.pow(1 - u, 3);
}

function ivBackOut(u) {
  u = clamp(u, 0, 1);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
}

function ivLerp(a, b, u) {
  return a + (b - a) * u;
}

// Mixes two #rrggbb colors.
function ivMix(a, b, t, alpha = 1) {
  const pa = parseInt(a.slice(1, 7), 16);
  const pb = parseInt(b.slice(1, 7), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return 'rgba(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ',' + alpha + ')';
}

function ivAt(g, x, y, rot, sx, sy, fn) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(sx, sy);
  fn();
  g.restore();
}

// Big comic lettering with a fat outline.
function ivShout(g, text, x, y, size, fill, stroke, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = '900 ' + size + 'px "Trebuchet MS", Arial, sans-serif';
  g.textAlign = 'center';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.18;
  g.strokeStyle = stroke;
  g.strokeText(text, 0, size * 0.35);
  g.fillStyle = fill;
  g.fillText(text, 0, size * 0.35);
  g.restore();
}

// A centered label that shrinks until it fits maxW. Portrait lines are narrow; the copy is not.
function ivFitLabel(g, text, x, y, size, color, maxW) {
  g.font = '700 ' + size + 'px "Trebuchet MS", Arial, sans-serif';
  const m = g.measureText ? g.measureText(text) : null;
  const w = m && m.width ? m.width : 0;
  const fit = w > maxW ? Math.max(9, Math.floor((size * maxW) / w)) : size;
  label(g, text, x, y, fit, color, 'center');
}

function ivMood(kind, time = 0.8) {
  mini.ivMoodKind = kind;
  mini.ivMoodT = time;
}

function ivDripFx(n) {
  for (let i = 0; i < n; i++) mini.ivDripFx.push({ dy: -i * 7, vy: 30 + i * 8, life: 1 });
}

// Macy's reactions, the heart monitor and the IV drips keep running under the bar.
function ivUpdateFx(dt) {
  mini.ivMoodT = Math.max(0, mini.ivMoodT - dt);
  if (mini.miss !== mini.ivSeenMiss) {
    mini.ivSeenMiss = mini.miss;
    mini.ivBpm += 16;
    ivMood('grimace', 1);
  }
  mini.ivBpm += (88 + mini.miss * 5 - mini.ivBpm) * (1 - Math.exp(-dt * 0.8));
  mini.ivDripClock -= dt;
  if (mini.ivDripClock <= 0) {
    mini.ivDripClock = 1.1;
    ivDripFx(1);
  }
  for (const d of mini.ivDripFx) {
    d.vy += 260 * dt;
    d.dy += d.vy * dt;
    d.life -= dt;
  }
  mini.ivDripFx = mini.ivDripFx.filter(d => d.life > 0 && d.dy < 30);
  for (const r of mini.ivRipples || []) r.t += dt;
  mini.ivRipples = (mini.ivRipples || []).filter(r => r.t < IV_RIPPLE_SECONDS);
}

// ---------- Touch ----------

// A brief ring where the finger landed, in the canvas shape it landed on.
function ivRipple(p) {
  mini.ivRipples = mini.ivRipples || [];
  mini.ivRipples.push({ x: p.x, y: p.y, t: 0, tall: !!mini.portrait });
}

function ivDrawRipples(g) {
  for (const r of mini.ivRipples || []) {
    if (r.tall !== !!mini.portrait) continue;
    const u = r.t / IV_RIPPLE_SECONDS;
    g.save();
    g.globalAlpha = Math.max(0, 1 - u);
    path(g, p => p.arc(r.x, r.y, 12 + u * 34, 0, Math.PI * 2), null, '#fff1b8', 3);
    ellipse(g, r.x, r.y, 7 * (1 - u), 7 * (1 - u), '#fff1b8');
    g.restore();
  }
}

// ---------- The recovery ----------
// Zero hearts sends Macy back to bed for this one phase, at this one level, every time. state.recoveries
// counts collapses (the stickers read it); the framework resets it on any medal outside a recovery.

// {phase, level, count}: always the drip phase at level 1. count is the collapses so far (during a
// recovery and its retries, the count it started from). minigames.js opens the lobby on .level.
function ivRecoveryPlan() {
  return { phase: 0, level: 0, count: ivRecovery ? ivRecovery.count : state.recoveries || 0 };
}

// A forced run starts. A new recovery counts the collapse; a retry after an explosion does not.
function ivRecoveryStart() {
  if (ivRecovery) return;
  ivRecovery = { count: state.recoveries || 0 };
  state.recoveries = ivRecovery.count + 1;
  save();
}

// What getting patched up costs right now: a share of her coins, rounded down, never below zero.
function ivPatchCost() {
  return Math.floor(Math.max(0, state.coins || 0) * IV_PATCH_SHARE);
}

function ivPatchLine() {
  const cost = ivPatchCost();
  return cost > 0
    ? 'Try again, or the nurse patches you up for ' + cost + ' coins.'
    : 'Try again, or the nurse patches you up for free. Your wallet is also in recovery.';
}

// ---------- Tap the drip ----------

// Every strike says how many are gone. The third one ends the run (miniOops calls finishMini).
function ivStrike(message) {
  miniOops(message + '  ·  STRIKE ' + (mini.miss + 1) + ' OF ' + mini.rules.misses);
}

function ivSetup() {
  mini.phase = 0;
  mini.phaseTime = 0;
  mini.held = false;
  mini.helpTime = 0;
  mini.inputLock = 0;
  mini.limit = IV_DRIP.limit;
  mini.required = IV_DRIP.required;
  mini.dir = 1;
  mini.pos = 0;
  mini.band = IV_DRIP.width[1];
  mini.beatLock = 0.3;
  mini.ivFumble = 0;
  mini.ivSweepCount = 0;
  ivNewSweep();
  setInstructions('Tap the screen when the line crosses mint. Eight drips and you are out of bed. Three strikes and you pop.');
}

function ivBand() {
  return mini.band * (mini.helpTime > 0 ? 1.7 : 1);
}

// The width range for the next sweep. It shrinks a little with every landed drip, down to the floor.
function ivWidthRange() {
  const k = Math.pow(IV_DRIP.shrink, mini.good || 0);
  return [Math.max(IV_DRIP.floor, IV_DRIP.width[0] * k), Math.max(IV_DRIP.floor, IV_DRIP.width[1] * k)];
}

// Marker speed, a little faster with every drip. The same on every level and prescription.
function ivSpeed() {
  return IV_DRIP.speed * (1 + IV_DRIP.ramp * Math.min(1, (mini.good || 0) / Math.max(1, (mini.required || IV_DRIP.required) - 1)));
}

function ivChainMult() {
  return 1 + 0.5 * Math.min(4, Math.max(0, (mini.ivChain || 0) - 1));
}

// Sweep coordinates (u from the start edge) to bar position for the current direction.
function ivSweepPos(u) {
  return mini.dir > 0 ? u : 1 - u;
}

// One pass of the marker with one mint window that stays put.
function ivNewSweep() {
  mini.ivSweepCount++;
  const range = ivWidthRange(),
    band = rand(range[0], range[1]),
    u = rand(0.3, 0.8);
  mini.band = band;
  mini.ivSweep = { width: band, win: { u, pos: ivSweepPos(u), hit: false }, oops: false };
  mini.pos = mini.dir > 0 ? 0 : 1;
}

function ivUpdateTap(dt) {
  mini.beatLock = Math.max(0, mini.beatLock - dt);
  mini.ivFumble = Math.max(0, mini.ivFumble - dt);
  if (mini.beatLock > 0) return;
  mini.pos += mini.dir * ivSpeed() * dt;
  if (mini.pos > 1 || mini.pos < 0) ivEndSweep();
}

function ivEndSweep() {
  if (!mini.ivSweep.win.hit) ivSweepError('A DRIP GOT AWAY');
  if (mini.screen !== 'play') return;
  ivNextSweep();
}

function ivNextSweep() {
  mini.dir *= -1;
  mini.beatLock = 0.42;
  ivNewSweep();
}

// A wild tap and an escaped drip in the same sweep are one mistake: one strike, then only style.
function ivSweepError(message) {
  const s = mini.ivSweep;
  mini.ivChain = 0;
  ivMood('grimace', 0.9);
  if (s.oops) {
    mini.combo = 0;
    mini.quality = Math.max(0, mini.quality - 3);
    mini.flash = 0.7;
    mini.flashText = message;
    sfx('miss');
    return;
  }
  s.oops = true;
  ivStrike(message);
}

function ivTap() {
  if (mini.screen !== 'play' || mini.paused || mini.beatLock > 0 || mini.inputLock > 0 || mini.ivFumble > 0) return;
  const win = mini.ivSweep.win,
    half = ivBand() / 2,
    off = Math.abs(mini.pos - win.pos);
  // A second tap on a window you already landed is harmless.
  if (win.hit) return;
  if (off > half) {
    mini.ivFumble = 0.3;
    ivSweepError('MISSED THE DRIP');
    return;
  }
  const accuracy = 1 - off / half,
    centre = accuracy >= 0.72;
  win.hit = true;
  mini.good++;
  mini.precision.push(accuracy);
  mini.ivChain = centre ? mini.ivChain + 1 : 0;
  mini.ivBestChain = Math.max(mini.ivBestChain, mini.ivChain);
  const mult = ivChainMult();
  praise((75 + accuracy * 75) * mult, accuracy);
  mini.flash = 0.5;
  mini.flashText = !centre ? 'GOOD DRIP' : mini.ivChain >= 2 ? 'GOLD CHAIN ×' + mult + '. SHOW-OFF.' : 'CENTER HIT. BEAUTIFUL DRIP.';
  ivMood(centre ? 'grin' : 'smile', 0.8);
  ivDripFx(centre ? 4 : 2);
  sfx('drip', { count: mini.good });
  if (mini.ivChain >= 2) sfx('combo', { count: mini.ivChain });
  if (mini.good >= mini.required) {
    // Out of bed.
    sfx('clear');
    praise(300);
    ivMood('grin', 3);
    finishMini(true);
    return;
  }
  ivNextSweep();
}

// ---------- In-game art ----------

// Macy's face on the pillow. Local units: the face is about 26 wide.
function ivFace(g, mood, puff, green, t) {
  const skin = ivMix('#ffd8b4', '#9fd468', green);
  const skin2 = ivMix('#eaa987', '#6fa743', green);
  const ink = '#3a2a2c';
  ellipse(g, 0, -2, 15.5, 16, '#493039');
  ellipse(g, -13 - puff * 3, 2, 2.8, 3.8, skin2);
  ellipse(g, 13 + puff * 3, 2, 2.8, 3.8, skin2);
  ellipse(g, 0, 1, 13 + puff * 3, 13.6 + puff * 1.5, skin);
  path(
    g,
    p => {
      p.moveTo(-13.5, -2);
      p.bezierCurveTo(-15, -20, 15, -21, 13.5, -2);
      p.bezierCurveTo(8, -4, 5, -11, 0, -11);
      p.bezierCurveTo(-2, -4, -8, -8, -10, 1);
      p.closePath();
    },
    '#5e3d36'
  );
  const cheek = 2.6 + puff * 8;
  ellipse(g, -8 - puff * 2, 6, cheek * 1.15, cheek, ivMix('#f29a8c', '#86c454', green, 0.75));
  ellipse(g, 8 + puff * 2, 6, cheek * 1.15, cheek, ivMix('#f29a8c', '#86c454', green, 0.75));
  const blink = mood === 'calm' && t % 4.3 > 4.15;
  for (const ex of [-5, 5]) {
    if (mood === 'grin' || mood === 'smile')
      path(
        g,
        p => {
          p.moveTo(ex - 2.6, 1);
          p.quadraticCurveTo(ex, -2.6, ex + 2.6, 1);
        },
        null,
        ink,
        1.6
      );
    else if (mood === 'grimace')
      line(
        g,
        [
          [ex - 2.4 * Math.sign(ex), -1.6],
          [ex + 1.6 * Math.sign(ex), 0.3],
          [ex - 2.4 * Math.sign(ex), 2]
        ],
        ink,
        1.6
      );
    else if (mood === 'dizzy') {
      g.save();
      g.translate(ex, 0.3);
      path(
        g,
        p => {
          for (let i = 0; i <= 16; i++) {
            const a = i * 0.75 + t * 6;
            const r = i * 0.17;
            if (i) p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            else p.moveTo(0, 0);
          }
        },
        null,
        ink,
        1
      );
      g.restore();
    } else if (blink) line(g, [[ex - 2.2, 0.4], [ex + 2.2, 0.4]], ink, 1.4);
    else {
      const wide = mood === 'cough' || mood === 'hiccup' || mood === 'sick' ? 1 + puff * 0.8 : 0;
      if (wide) {
        ellipse(g, ex, 0, 3.2 * wide, 3.6 * wide, '#ffffff');
        ellipse(g, ex, 0.4, 1.1, 1.3, ink);
      } else {
        ellipse(g, ex, 0.2, 1.8, 2.5, ink);
        ellipse(g, ex - 0.5, -0.6, 0.6, 0.7, '#ffffff');
      }
    }
  }
  if (mood === 'grimace') {
    rr(g, -5, 6.5, 10, 4.5, 1.5, '#ffffff', ink, 1.2);
    for (const x of [-2.5, 0, 2.5]) line(g, [[x, 6.6], [x, 10.9]], '#c9b9b4', 0.8);
  } else if (mood === 'grin') {
    path(
      g,
      p => {
        p.moveTo(-6, 5.5);
        p.quadraticCurveTo(0, 15, 6, 5.5);
        p.closePath();
      },
      '#8f2d3e',
      ink,
      1
    );
    rect(g, -4.6, 5.6, 9.2, 2, '#ffffff');
  } else if (mood === 'cough' || mood === 'hiccup' || mood === 'sick') {
    if (puff > 0.5)
      path(
        g,
        p => {
          p.moveTo(-4, 8);
          p.quadraticCurveTo(-2, 6, 0, 8);
          p.quadraticCurveTo(2, 10, 4, 8);
        },
        null,
        ink,
        1.4
      );
    else ellipse(g, 0, 8, 2.2, 2.6, '#a8445a');
  } else if (mood === 'dizzy')
    path(
      g,
      p => {
        p.moveTo(-4, 8);
        p.quadraticCurveTo(-2, 6, 0, 8);
        p.quadraticCurveTo(2, 10, 4, 8);
      },
      null,
      ink,
      1.2
    );
  else
    path(
      g,
      p => {
        p.moveTo(mood === 'smile' ? -4.5 : -3, 6.5);
        p.quadraticCurveTo(0, mood === 'smile' ? 10.5 : 9, mood === 'smile' ? 4.5 : 3, 6.5);
      },
      null,
      '#a7645d',
      1.4
    );
}

// The bed with Macy peeking over the covers. look = {mood, puff 0..1, green 0..1, t}.
function ivPatient(g, x, y, s, look = {}) {
  const puff = look.puff || 0;
  const green = look.green || 0;
  bed(g, x, y, s);
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // The ponytail spills across the pillow, scrunchie and all.
  path(
    g,
    p => {
      p.moveTo(8, -110);
      p.bezierCurveTo(30, -120, 50, -106, 42, -93);
      p.bezierCurveTo(36, -100, 24, -103, 10, -99);
      p.closePath();
    },
    '#5a3a33',
    '#352a31',
    1.2
  );
  ellipse(g, 20, -107, 4.2, 3.5, '#f1abbd');
  ellipse(g, 20, -107, 1.6, 1.3, '#c97d93');
  g.save();
  g.translate(0, -100 - puff * 14);
  g.scale(1 + puff * 0.6, 1 + puff * 0.6);
  ivFace(g, look.mood || 'calm', puff, green, look.t || 0);
  g.restore();
  // Covers. Inflation bulges them sideways and down.
  const wide = 55 + puff * 42;
  const belly = puff * 36;
  path(
    g,
    p => {
      p.moveTo(-wide, -77);
      p.quadraticCurveTo(0, -88 - puff * 8, wide, -76);
      p.quadraticCurveTo(wide + belly, -45, wide, -15 + belly * 0.4);
      p.quadraticCurveTo(0, -6 + belly, -wide, -15 + belly * 0.4);
      p.quadraticCurveTo(-wide - belly, -45, -wide, -77);
      p.closePath();
    },
    gradient(g, 0, -80, 0, 70, ivMix('#a5e1c7', '#c4e98a', green * 0.5), ivMix('#61afa9', '#7fb35c', green * 0.5))
  );
  path(
    g,
    p => {
      p.moveTo(-wide + 2, -76);
      p.quadraticCurveTo(0, -84 - puff * 8, wide - 2, -76);
    },
    null,
    '#d1edd7',
    11
  );
  path(
    g,
    p => {
      p.moveTo(-36, -64);
      p.quadraticCurveTo(-30, -44, -36, -19);
    },
    null,
    '#c3ead45c',
    2
  );
  g.restore();
}

// Heartbeat trace: a P bump, the spike and a T bump per beat.
function ivEcg(u) {
  if (u < 0.12) return Math.sin((u / 0.12) * Math.PI) * 2;
  if (u > 0.26 && u < 0.3) return -3;
  if (u >= 0.3 && u < 0.36) return 14 - Math.abs(u - 0.33) * 466;
  if (u >= 0.36 && u < 0.4) return -5;
  if (u > 0.5 && u < 0.66) return Math.sin(((u - 0.5) / 0.16) * Math.PI) * 3.4;
  return 0;
}

// Bedside monitor. o = {bpm, t, alarm, flat, smile, text}.
function ivMonitor(g, x, y, s, o) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  line(g, [[0, -18], [0, 7]], '#678d98', 6);
  rr(g, -23, 4, 46, 6, 3, '#9dbebd');
  rr(g, -38, -68, 76, 52, 7, gradient(g, 0, -68, 0, 52, '#82a6ac', '#4a7284'), '#c3d5cf', 1.5);
  rr(g, -33, -63, 66, 38, 4, o.alarm ? '#6a1832' : '#153b50');
  const col = o.alarm ? '#ff9aa8' : '#b5e7be';
  if (o.flat) {
    if (o.smile) {
      line(g, [[-29, -40], [-9, -40]], col, 1.8);
      line(g, [[9, -40], [29, -40]], col, 1.8);
      path(
        g,
        p => {
          p.moveTo(-9, -40);
          p.quadraticCurveTo(0, -31, 9, -40);
        },
        null,
        col,
        1.8
      );
      ellipse(g, -4, -46, 1.4, 1.6, col);
      ellipse(g, 4, -46, 1.4, 1.6, col);
    } else line(g, [[-29, -40], [29, -40]], col, 1.8);
  } else {
    const rate = (o.bpm || 88) / 60;
    path(
      g,
      p => {
        for (let i = 0; i <= 40; i++) {
          const px = -29 + i * 1.45;
          const u = (((i / 40) * 1.6 - (o.t || 0) * rate) % 1 + 1) % 1;
          const py = -40 - ivEcg(u);
          if (i) p.lineTo(px, py);
          else p.moveTo(px, py);
        }
      },
      null,
      col,
      1.6
    );
  }
  label(g, o.text ?? String(Math.round(o.bpm || 88)), 30, -29, 10, col, 'right');
  label(g, '♥', -30, -29, 8, col);
  g.restore();
}

// IV drip droplets falling from the bag outlet at (x, y).
function ivDrawDrips(g, x, y) {
  rr(g, x - 4, y - 2, 8, 26, 3, '#e8f3e455', '#cfe3d6', 1);
  for (const d of mini.ivDripFx || [])
    if (d.dy >= 0) ellipse(g, x, y + d.dy, 2, 2.6, ivMix('#f3ce84', '#ffffff', 0.2, Math.min(1, d.life * 2)));
}

function ivLook() {
  return { mood: mini.ivMoodT > 0 ? mini.ivMoodKind : 'calm', puff: 0, green: 0, t: mini.total };
}

// Backdrop, the bar and the strike marks, on whichever canvas shape is up.
function ivDrawPlay(g) {
  if (mini.portrait) {
    ivBackdropTall(g);
    ivDrawStrip(g);
    ivDrawStrikes(g);
    drawIVMini(g);
    return;
  }
  miniBackdrop(g, '#295d65', '#6ad6aa3d', IV.info.game.toUpperCase());
  drawIVMini(g);
  ivDrawStrikes(g);
}

function drawIVMini(g) {
  if (mini.portrait) ivDrawTapTall(g);
  else ivDrawTapScene(g);
}

// Three strike marks beside the level tag: empty rings fill with red crosses. Portrait makes them a bit bigger.
function ivDrawStrikes(g) {
  const n = mini.rules ? mini.rules.misses : IV_STRIKES;
  const o = mini.portrait
    ? { lx: 300, ly: 28, size: 12, x0: 316, dx: 22, y: 23, k: 1.2 }
    : { lx: 668, ly: 29, size: 11, x0: 682, dx: 18, y: 25, k: 1 };
  const k = o.k;
  label(g, 'STRIKES', o.lx, o.ly, o.size, '#a2cacb', 'right');
  for (let i = 0; i < n; i++) {
    const x = o.x0 + i * o.dx;
    const y = o.y;
    if (i < mini.miss) {
      ellipse(g, x, y, 7.5 * k, 7.5 * k, '#8a2a40');
      line(g, [[x - 3.5 * k, y - 3.5 * k], [x + 3.5 * k, y + 3.5 * k]], '#ffd6dc', 2.2 * k);
      line(g, [[x + 3.5 * k, y - 3.5 * k], [x - 3.5 * k, y + 3.5 * k]], '#ffd6dc', 2.2 * k);
    } else {
      ellipse(g, x, y, 7.5 * k, 7.5 * k, '#a2cacb');
      ellipse(g, x, y, 5.5 * k, 5.5 * k, '#1f4a55');
    }
  }
}

// ---------- Portrait (450 × 800): a scene strip on top, the bar below ----------

// The same teal room as miniBackdrop, stood upright, with the title and level tag on one header row.
function ivBackdropTall(g) {
  rect(g, 0, 0, 450, 800, gradient(g, 0, 0, 450, 800, '#295d65', '#142e46'));
  glow(g, 225, 470, 400, '#6ad6aa3d');
  for (let i = 0; i < 8; i++) {
    const x = 60 + (i % 3) * 165;
    const y = 300 + i * 62;
    ellipse(g, x, y, 43, 43, '#d5ede306');
  }
  label(g, IV.info.game.toUpperCase(), 18, 28, 13, '#a2cacb');
  label(g, 'LEVEL ' + (mini.tier + 1), 432, 28, 13, '#b8d8cf', 'right');
}

// The top 30% of the portrait canvas: the IV stand dripping, Macy in bed with
// her reactions, and the monitor on the cabinet.
function ivDrawStrip(g) {
  rr(g, 10, 40, 430, 198, 16, gradient(g, 0, 40, 0, 198, '#2f6a70', '#1d4655'), '#6c969a66', 1.2);
  g.save();
  g.beginPath();
  g.roundRect(10, 40, 430, 198, 16);
  g.clip();
  rect(g, 10, 200, 430, 38, '#24505a');
  for (let x = 30; x < 440; x += 40) rect(g, x, 200, 1, 38, '#ffffff10');
  glow(g, 364, 92, 96, mini.ivBpm > 108 ? 'rgba(255,70,100,0.2)' : 'rgba(120,220,200,0.08)');
  ivStand(g, 64, 222, 1.05);
  ivDrawDrips(g, 64 + 18 * 1.05, 222 - 82.5 * 1.05);
  ivPatient(g, 198, 212, 1.2, ivLook());
  cabinet(g, 318, 224, 92);
  ivMonitor(g, 364, 137, 1.15, { bpm: mini.ivBpm, t: mini.total, alarm: mini.ivBpm > 108 });
  g.restore();
}

// The drip counter: one dot per drip, lit as they land, eight to a row.
function ivDrawDripDots(g, cx, y0, gap, r) {
  const per = 8;
  for (let i = 0; i < mini.required; i++) {
    const x = cx - ((Math.min(per, mini.required) - 1) / 2) * gap + (i % per) * gap,
      y = y0 + Math.floor(i / per) * gap;
    ellipse(g, x, y, r, r, i < mini.good ? '#c4e8b5' : '#365563');
    if (i < mini.good) spark(g, x, y, '#fff0b6', r / 20);
  }
}

function ivDrawChain(g, x, y, big, small) {
  if (mini.ivChain >= 1)
    label(
      g,
      mini.ivChain >= 2 ? 'GOLD CHAIN ×' + ivChainMult() : 'GOLD! ONE MORE FOR A CHAIN',
      x,
      y,
      mini.ivChain >= 2 ? big : small,
      '#ffe39a',
      'center'
    );
}

// Portrait: the drip counter and chain up top, a big timing bar in the lower third, the legend below.
function ivDrawTapTall(g) {
  label(g, 'PRIME THE PUMP', 225, 284, 24, '#d8e8cc', 'center');
  ivDrawDripDots(g, 225, 322, 40, 13);
  label(g, mini.good + ' / ' + mini.required + ' drips', 225, 404, 20, '#e7d49c', 'center');
  ivDrawChain(g, 225, 434, 19, 14);
  ivFitLabel(g, mini.dir > 0 ? 'SWEEP →' : '← SWEEP', 225, 464, 14, '#b4d9cb', 410);
  ivDrawSweepBar(g, 22, 548, 406, 70);
  ivFitLabel(g, 'MINT = TAP', 225, 728, 15, '#dce8ca', 410);
  ivFitLabel(g, 'GOLD CENTER = CHAIN BONUS', 225, 752, 15, '#dce8ca', 410);
  if (mini.screen !== 'outro') ivTapHint(g, 22, 548, 406, 1.4);
}

// Landscape: Macy in bed on the left, the counter on the right, the bar across the bottom.
function ivDrawTapScene(g) {
  ivPatient(g, 222, 275, 1.15, ivLook());
  ivStand(g, 111, 275, 1.2);
  ivDrawDrips(g, 132.6, 176);
  cabinet(g, 355, 276, 88);
  ivMonitor(g, 398, 188, 1, { bpm: mini.ivBpm, t: mini.total, alarm: mini.ivBpm > 108 });
  label(g, 'PRIME THE PUMP', 605, 100, 22, '#d8e8cc', 'center');
  ivDrawDripDots(g, 605, 134, 34, 11);
  label(g, mini.good + ' / ' + mini.required + ' drips', 605, 218, 17, '#e7d49c', 'center');
  ivDrawChain(g, 605, 246, 17, 12);
  label(g, mini.dir > 0 ? 'SWEEP →' : '← SWEEP', 605, 274, 13, '#b4d9cb', 'center');
  ivDrawSweepBar(g, 85, 335, 630);
  label(g, 'MINT = TAP    ·    GOLD CENTER = CHAIN BONUS', 400, 411, 14, '#dce8ca', 'center');
  if (mini.screen !== 'outro') ivTapHint(g, 85, 335, 630);
}

// The sweep bar and its one window. Landscape draws it 37 tall; portrait passes a taller h, and b
// scales the marks around it (b is 1 at h 37, so the landscape bar is unchanged).
function ivDrawSweepBar(g, x, y, w, h = 37) {
  const win = mini.ivSweep.win,
    band = ivBand(),
    b = Math.min(1.5, h / 37),
    wx = x + (win.pos - band / 2) * w,
    ww = band * w;
  rr(g, x, y, w, h, 16 * Math.min(1.25, b), '#0c2c3b', '#6c969a', 1);
  // The tall bar lights up the window so the target reads at a glance.
  if (h > 37 && !win.hit) glow(g, x + win.pos * w, y + h / 2, 70, '#a8f0c440');
  if (win.hit) {
    rr(g, wx, y + 2, ww, h - 4, 6, '#d8f5c766');
    label(g, '✓', x + win.pos * w, y + h / 2 + 6.5 * b, 15 * b, '#e9ffd8', 'center');
  } else {
    rr(g, wx, y + 2, ww, h - 4, 6, '#96ceac');
    rr(g, x + (win.pos - band * 0.14) * w, y + 2, band * 0.28 * w, h - 4, 3, '#f4e6ad');
  }
  const mx = x + mini.pos * w,
    thick = Math.min(1.4, b);
  line(g, [[mx, y - 5], [mx, y + h + 6]], mini.ivFumble > 0 ? '#ff9aa8' : '#ffe0a1', 4 * thick);
  ellipse(g, mx, y - 5, 5 * thick, 5 * thick, mini.ivFumble > 0 ? '#ff9aa8' : '#ffe0a1');
}

// Point at the window and shout when it is time. Portrait passes a bigger s.
function ivTapHint(g, x, y, w, s = 1) {
  const win = mini.ivSweep.win;
  if (win.hit) return;
  const wx = x + win.pos * w,
    inside = Math.abs(mini.pos - win.pos) <= ivBand() / 2,
    bob = Math.sin(mini.t * 6) * 3 * s;
  if (inside) ivShout(g, 'NOW!', wx, y - 26 * s, 22 * s, '#fff1b8', '#29434d');
  else {
    label(g, 'TAP HERE', wx, y - 22 * s + bob, 12 * s, '#fff1b8', 'center');
    poly(
      g,
      [
        [wx - 6 * s, y - 15 * s + bob],
        [wx + 6 * s, y - 15 * s + bob],
        [wx, y - 7 * s + bob]
      ],
      '#fff1b8'
    );
  }
}

// ---------- The losing outro: rumble, inflate, flash, burst ----------

const IV_BEEPS = [0.3, 0.62, 0.88, 1.08, 1.24, 1.37, 1.47, 1.55, 1.61];

// Where the explosion's pieces sit. Landscape is the original wide shot. Portrait is its own upright
// composition, nothing cropped or stretched: the shout up top, the monitor on the wall, Macy and her bed
// big at the bottom, and a taller burst. Points are [x, y]; a third number is a scale.
function ivBoomStage() {
  if (!mini.portrait)
    return {
      w: 800,
      h: 450,
      floor: 404,
      tile: 50,
      alarm: [400, 70, 360],
      wall: [60, 680, 50, 300],
      stand: [170, 440, 2.1],
      bed: [400, 445, 2.3],
      monitor: [650, 290, 1.9],
      face: [400, 200, 1],
      smoke: [380, 300, 1],
      bubble: [545, 150],
      shout: [400, 62, 1],
      swell: [400, 210],
      burst: [400, 220, 250, 1],
      fly: 1,
      word: [400, 210, 86]
    };
  return {
    w: 450,
    h: 800,
    floor: 640,
    tile: 45,
    alarm: [225, 110, 340],
    wall: [40, 370, 70, 520],
    stand: [62, 688, 1.7],
    bed: [225, 690, 1.8],
    monitor: [330, 330, 1.6],
    face: [225, 498, 0.78],
    smoke: [209, 577, 0.78],
    bubble: [305, 395],
    shout: [225, 130, 1.2],
    swell: [225, 480],
    burst: [225, 470, 195, 1.5],
    fly: 0.75,
    word: [225, 470, 58]
  };
}

function ivDrawBoom(g) {
  const t = mini.transition || 0;
  const st = ivBoomStage();
  // Warning beeps quicken; the bang itself plays once.
  while (mini.ivBoomBeep < IV_BEEPS.length && t >= IV_BEEPS[mini.ivBoomBeep]) {
    sfx('countdown');
    mini.ivBoomBeep++;
  }
  if (mini.ivBoomBeep === IV_BEEPS.length && t >= 1.68) {
    sfx('explode');
    sfx('squelch');
    mini.ivBoomBeep++;
  }
  const inflate = ivEase(clamp((t - 0.2) / 1.4, 0, 1));
  const post = t >= 1.68;
  let amp = post ? 14 * Math.max(0, 1 - (t - 1.68) / 0.4) : 7 * Math.pow(clamp((t - 0.15) / 1.5, 0, 1), 1.6);
  if (reduced) amp = 0;
  const sx = Math.sin(t * 73) * amp;
  const sy = Math.cos(t * 91) * amp * 0.6;
  // A short crossfade from the bar that was playing.
  if (t < 0.25) {
    if (mini.portrait) ivDrawPlay(g);
    else {
      miniBackdrop(g, '#295d65', '#6ad6aa3d', IV.info.game.toUpperCase());
      drawIVMini(g);
    }
  }
  g.save();
  g.globalAlpha = clamp(t / 0.25, 0, 1);
  g.translate(sx, sy);
  ivBoomRoom(g, t, inflate, post, st);
  g.restore();
  if (!post) {
    const bubble = t < 0.75 ? 'mmf?' : t < 1.25 ? 'MMMF!' : 'MMMMMFFF!!';
    if (t > 0.3) {
      const bx = st.bubble[0] + sx;
      const by = st.bubble[1] + sy;
      const bw = t < 0.75 ? 120 : t < 1.25 ? 150 : 200;
      rr(g, bx - bw / 2, by - 28, bw, 40, 16, '#fff6e4', IV_INK, 2.5);
      poly(
        g,
        [
          [bx - bw / 2 + 24, by + 10],
          [bx - bw / 2 + 40, by + 10],
          [bx - bw / 2 + 4, by + 34]
        ],
        '#fff6e4'
      );
      ivShout(g, bubble, bx, by - 8, t < 1.25 ? 20 : 22, '#d23b5a', '#fff6e4');
    }
    if (t > 0.9) {
      const [hx, hy, hs] = st.shout;
      const words = t < 1.35 ? 'UH OH.' : 'STAND BACK!';
      ivShout(g, words, hx, hy, (t < 1.35 ? 34 : 42) * hs, '#ffe066', IV_INK, -0.04);
    }
    // A pink glow swells just before the pop.
    if (t > 1.5) {
      const a = clamp((t - 1.5) * 5, 0, 0.9);
      glow(g, st.swell[0] + sx, st.swell[1] + sy, 60 + (t - 1.5) * 900, 'rgba(255,190,210,' + a + ')');
    }
    return;
  }
  ivBoomBurst(g, t, st);
  const flash = clamp(1 - (t - 1.68) / 0.28, 0, 1) * (reduced ? 0.6 : 1);
  if (flash > 0) rect(g, 0, 0, st.w, st.h, 'rgba(255,255,255,' + flash + ')');
}

// The close-up: bed, Macy inflating, monitor climbing. After the bang: scorched and empty.
function ivBoomRoom(g, t, inflate, post, st = ivBoomStage()) {
  const { w, h } = st;
  rect(g, 0, 0, w, h, gradient(g, 0, 0, 0, h, post ? '#3d4a55' : '#2f6a70', post ? '#1c2230' : '#173447'));
  const alarm = !post && t > 0.85 && Math.sin(t * 22) > 0;
  glow(g, st.alarm[0], st.alarm[1], st.alarm[2], alarm ? 'rgba(255,70,100,0.35)' : 'rgba(120,220,200,0.12)');
  rect(g, 0, st.floor, w, h - st.floor, post ? '#252b33' : '#2e5459');
  for (let x = 0; x < w; x += st.tile) rect(g, x, st.floor, 1, h - st.floor, '#ffffff12');
  const [standX, standY, standS] = st.stand;
  const [bedX, bedY, bedS] = st.bed;
  const [monX, monY, monS] = st.monitor;
  if (post) {
    // Instant cartoon wallpaper.
    const [wx, wxSpan, wy, wySpan] = st.wall;
    for (let i = 0; i < 14; i++) {
      // The wallpaper changes with every explosion, so a second viewing does not look like the first.
      const seed = ivBoomCount * 17;
      const x = wx + ivHash(i + seed) * wxSpan;
      const y = wy + ivHash(i + seed + 40) * wySpan;
      const r = 14 + ivHash(i + seed + 80) * 26;
      ellipse(g, x, y, r * 1.1, r * 0.9, '#a3183a');
      ellipse(g, x, y, r, r * 0.8, '#d6304f');
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3 + i;
        ellipse(g, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.2, r * 0.22, r * 0.22, '#d6304f');
      }
    }
    ivStand(g, standX, standY, standS);
    ivScorchedBed(g, bedX, bedY, bedS, 1);
    const [mx, my, mk] = st.smoke;
    for (let i = 0; i < 5; i++) {
      const u = clamp((t - 1.68) / 0.5, 0, 1);
      glow(g, mx + i * 12 * mk, my - (u * 120 + i * 18) * mk, (50 + u * 60) * mk, 'rgba(60,50,60,' + (0.5 - u * 0.3) + ')');
    }
    ivMonitor(g, monX, monY, monS, { flat: true, alarm: true, text: '--' });
    return;
  }
  ivStand(g, standX, standY, standS);
  ivMonitor(g, monX, monY, monS, {
    bpm: 88 + inflate * inflate * 212,
    t: t * (1 + inflate * 3),
    alarm: t > 0.85,
    text: t > 1.45 ? '!!!' : String(Math.round(88 + inflate * inflate * 212))
  });
  // Steam from the ears once she is properly cooking.
  const [fx, fy, fk] = st.face;
  if (inflate > 0.5)
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const u = (t * 2.4 + i * 0.5) % 1;
      const steam = 'rgba(255,255,255,' + (0.6 - u * 0.6) + ')';
      ellipse(g, fx + side * (60 + u * 30) * fk, fy - u * 50 * fk, (8 + u * 10) * fk, (6 + u * 8) * fk, steam);
    }
  ivPatient(g, bedX, bedY, bedS, { mood: 'sick', puff: inflate, green: inflate, t });
  // Sweat drops fly off.
  if (inflate > 0.3)
    for (let i = 0; i < 3; i++) {
      const u = (t * 1.8 + i * 0.33) % 1;
      const side = i % 2 ? 1 : -1;
      const dx = side * (50 + u * 60) * fk;
      const dy = (10 + Math.sin(u * Math.PI) * 30) * fk;
      ellipse(g, fx + dx, fy - dy, 3 * fk, 4.5 * fk, '#bfe8ff');
    }
}

function ivBoomBurst(g, t, st = ivBoomStage()) {
  const u = clamp((t - 1.7) / 0.2, 0, 1);
  const [cx, cy, size, tall] = st.burst;
  const r = size * ivBackOut(u) * (1 + Math.sin(t * 18) * 0.015);
  if (u <= 0) return;
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.06 + Math.sin(t * 4) * 0.02);
  // Portrait stretches the star upright to fill the tall canvas; landscape keeps it as drawn.
  if (tall !== 1) g.scale(1, tall);
  ivBurstShape(g, r, 15, 3, '#ffe14d', IV_INK, 7);
  ivBurstShape(g, r * 0.7, 13, 9, '#ff8a3d', null, 0);
  ivBurstShape(g, r * 0.42, 11, 21, '#fff3b0', null, 0);
  g.restore();
  // Bits fly out in every direction.
  const v = t - 1.68;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + ivHash(i) * 0.4;
    const speed = (320 + ivHash(i + 50) * 480) * st.fly;
    const x = cx + Math.cos(a) * speed * v;
    const y = cy + Math.sin(a) * speed * v * 0.8 + 420 * v * v;
    const s = 0.55 + ivHash(i + 9) * 0.6;
    ivAt(g, x, y, v * (ivHash(i + 3) - 0.5) * 22, s, s, () => ivChunk(g, i % 6));
  }
  const w = clamp((t - 1.74) / 0.18, 0, 1);
  const [wx, wy, wsize] = st.word;
  if (w > 0) ivShout(g, mini.ivWord || 'SPLORT!', wx, wy, wsize * ivBackOut(w), '#ff3d6e', IV_INK, -0.09);
}

function ivBurstShape(g, r, n, seed, fill, stroke, lw) {
  path(
    g,
    p => {
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const rad = i % 2 ? r * (0.56 + ivHash(seed + i) * 0.14) : r * (0.9 + ivHash(seed + i) * 0.18);
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad * 0.74;
        if (i) p.lineTo(px, py);
        else p.moveTo(px, py);
      }
      p.closePath();
    },
    fill,
    stroke,
    lw
  );
}

function ivChunk(g, kind) {
  if (kind === 0) ivOrganHeart(g, 0);
  else if (kind === 1) ivEyeball(g, 9, 0.5, 0);
  else if (kind === 2) ivTooth(g);
  else if (kind === 3) ivOrganKidney(g);
  else if (kind === 4) {
    path(
      g,
      p => {
        p.moveTo(-14, 0);
        p.bezierCurveTo(-8, -10, 0, 8, 6, -2);
        p.bezierCurveTo(10, -8, 14, 0, 16, 2);
      },
      null,
      IV_INK,
      10
    );
    path(
      g,
      p => {
        p.moveTo(-14, 0);
        p.bezierCurveTo(-8, -10, 0, 8, 6, -2);
        p.bezierCurveTo(10, -8, 14, 0, 16, 2);
      },
      null,
      '#f49ab0',
      6.5
    );
  } else {
    ellipse(g, 0, 0, 10, 8, IV_INK);
    ellipse(g, 0, 0, 8, 6, '#d6304f');
    ellipse(g, -2, -2, 2.5, 1.6, '#ff8fa3');
  }
}

// ---------- Organs (cartoon; local coordinates, about 30 to 45 wide) ----------

function ivOrganHeart(g, beat) {
  const k = 1 + beat * 0.14;
  g.save();
  g.scale(k, k);
  line(g, [[-6, -10], [-10, -22]], IV_INK, 8);
  line(g, [[-6, -10], [-10, -22]], '#7fa7e0', 4.5);
  path(
    g,
    p => {
      p.moveTo(0, -10);
      p.bezierCurveTo(-2, -26, 16, -28, 15, -12);
    },
    null,
    IV_INK,
    10
  );
  path(
    g,
    p => {
      p.moveTo(0, -10);
      p.bezierCurveTo(-2, -26, 16, -28, 15, -12);
    },
    null,
    '#d8344f',
    6
  );
  path(
    g,
    p => {
      p.moveTo(0, 20);
      p.bezierCurveTo(-20, 8, -21, -12, -7, -13);
      p.bezierCurveTo(-1, -14, 3, -10, 6, -8);
      p.bezierCurveTo(14, -15, 25, -4, 17, 8);
      p.bezierCurveTo(12, 14, 6, 17, 0, 20);
      p.closePath();
    },
    '#e3344f',
    IV_INK,
    2.6
  );
  path(
    g,
    p => {
      p.moveTo(3, -6);
      p.quadraticCurveTo(7, 4, 2, 14);
    },
    null,
    '#a8213b',
    1.8
  );
  ellipse(g, -9, -4, 3.5, 6, '#ffa3b3aa');
  g.restore();
  if (beat > 0.45)
    for (const side of [-1, 1]) {
      path(
        g,
        p => {
          p.moveTo(side * 23, -10);
          p.quadraticCurveTo(side * 28, 0, side * 23, 10);
        },
        null,
        '#ffffffcc',
        2
      );
    }
}

function ivOrganStomach(g) {
  line(g, [[-12, -13], [-16, -24]], IV_INK, 8);
  line(g, [[-12, -13], [-16, -24]], '#f7a9b9', 4.5);
  path(
    g,
    p => {
      p.moveTo(-15, -12);
      p.bezierCurveTo(-22, 6, -8, 21, 9, 17);
      p.bezierCurveTo(24, 13, 23, -6, 10, -8);
      p.bezierCurveTo(4, -9, 2, -4, -2, -8);
      p.bezierCurveTo(-4, -14, -9, -18, -15, -12);
      p.closePath();
    },
    '#f48aa2',
    IV_INK,
    2.5
  );
  path(
    g,
    p => {
      p.moveTo(-8, 3);
      p.quadraticCurveTo(2, 10, 14, 4);
    },
    null,
    '#c9566f',
    1.6
  );
  path(
    g,
    p => {
      p.moveTo(-10, 9);
      p.quadraticCurveTo(0, 15, 10, 11);
    },
    null,
    '#c9566f',
    1.4
  );
  ellipse(g, -8, -3, 3, 5, '#ffd0dbaa');
}

function ivOrganKidney(g) {
  line(g, [[-5, 2], [-13, 9]], IV_INK, 5);
  line(g, [[-5, 2], [-13, 9]], '#f0d27a', 2.6);
  path(
    g,
    p => {
      p.moveTo(0, -14);
      p.bezierCurveTo(13, -16, 17, 1, 10, 12);
      p.bezierCurveTo(6, 18, -7, 16, -4, 8);
      p.bezierCurveTo(-2, 4, -9, 2, -6, -4);
      p.bezierCurveTo(-10, -10, -6, -14, 0, -14);
      p.closePath();
    },
    '#b52a45',
    IV_INK,
    2.4
  );
  ellipse(g, 6, -6, 2.6, 4.4, '#ee8a9daa');
}

function ivOrganLiver(g) {
  path(
    g,
    p => {
      p.moveTo(-25, -5);
      p.bezierCurveTo(-21, -17, 8, -17, 23, -10);
      p.bezierCurveTo(30, -5, 21, 5, 8, 9);
      p.bezierCurveTo(-4, 13, -19, 11, -25, -5);
      p.closePath();
    },
    '#8f2340',
    IV_INK,
    2.6
  );
  path(
    g,
    p => {
      p.moveTo(2, -14);
      p.quadraticCurveTo(-2, -2, 4, 9);
    },
    null,
    '#5e1428',
    1.8
  );
  ellipse(g, -12, -6, 6, 3, '#c9506daa');
  ellipse(g, 14, -7, 4, 2.4, '#c9506daa');
}

function ivOrganLung(g) {
  path(
    g,
    p => {
      p.moveTo(3, -21);
      p.bezierCurveTo(-11, -19, -17, 4, -15, 17);
      p.bezierCurveTo(-8, 21, 7, 19, 11, 15);
      p.bezierCurveTo(13, 4, 11, -15, 3, -21);
      p.closePath();
    },
    '#f6a1b6',
    IV_INK,
    2.4
  );
  line(g, [[5, -27], [4, -12], [-2, -1]], IV_INK, 6);
  line(g, [[5, -27], [4, -12], [-2, -1]], '#ecdccf', 3.2);
  line(g, [[4, -10], [8, 2]], '#ecdccf', 2);
  for (let i = 0; i < 5; i++) ellipse(g, -8 + (i % 3) * 7, 2 + Math.floor(i / 3) * 8, 1.6, 1.6, '#d9617d99');
}

function ivOrganSpleen(g) {
  path(
    g,
    p => {
      p.moveTo(-15, -3);
      p.bezierCurveTo(-8, -15, 11, -15, 17, -2);
      p.bezierCurveTo(10, -6, -4, -6, -6, 7);
      p.bezierCurveTo(-13, 7, -17, 3, -15, -3);
      p.closePath();
    },
    '#8e2f63',
    IV_INK,
    2.2
  );
  ellipse(g, 2, -8, 4, 1.6, '#c86b9caa');
}

function ivBrain(g) {
  path(
    g,
    p => {
      p.moveTo(-19, 6);
      p.bezierCurveTo(-24, -10, -8, -18, 0, -13);
      p.bezierCurveTo(8, -19, 25, -11, 19, 6);
      p.closePath();
    },
    '#f5a9c0',
    IV_INK,
    2.4
  );
  line(g, [[0, -13], [0, 6]], '#c9567a', 1.6);
  for (const side of [-1, 1]) {
    path(
      g,
      p => {
        p.moveTo(side * 4, -8);
        p.bezierCurveTo(side * 12, -10, side * 8, -2, side * 14, -2);
        p.moveTo(side * 5, 0);
        p.quadraticCurveTo(side * 10, 4, side * 16, 2);
      },
      null,
      '#c9567a',
      1.4
    );
  }
}

// Eyeball with Macy's brown iris. look -1..1 slides the iris; lid 0..1 closes it.
function ivEyeball(g, r, look, lid) {
  line(g, [[-r * 0.9, r * 0.5], [-r * 1.6, r * 1.1]], IV_INK, 4);
  line(g, [[-r * 0.9, r * 0.5], [-r * 1.6, r * 1.1]], '#e98fa4', 2.2);
  ellipse(g, 0, 0, r + 1.8, r + 1.8, IV_INK);
  ellipse(g, 0, 0, r, r, '#fdf7ee');
  line(g, [[r * 0.9, -r * 0.2], [r * 0.5, -r * 0.1], [r * 0.4, -r * 0.35]], '#e0465e', 1);
  line(g, [[-r * 0.85, r * 0.35], [-r * 0.5, r * 0.25]], '#e0465e', 1);
  ellipse(g, look * r * 0.38, 0, r * 0.5, r * 0.52, '#7a5233');
  ellipse(g, look * r * 0.42, 0, r * 0.25, r * 0.27, '#1d1416');
  ellipse(g, look * r * 0.38 - r * 0.2, -r * 0.2, r * 0.13, r * 0.13, '#ffffff');
  if (lid > 0.02)
    path(
      g,
      p => {
        p.moveTo(-r - 1, 0);
        p.ellipse(0, 0, r + 1, r + 1, 0, Math.PI, Math.PI * 2);
        p.quadraticCurveTo(0, -r + lid * r * 2.4, -r - 1, 0);
        p.closePath();
      },
      '#f2a7a2',
      IV_INK,
      1.5
    );
}

function ivTooth(g) {
  path(
    g,
    p => {
      p.moveTo(-5, -6);
      p.quadraticCurveTo(0, -9, 5, -6);
      p.lineTo(5, 2);
      p.lineTo(3, 8);
      p.lineTo(1, 3);
      p.lineTo(-1, 3);
      p.lineTo(-3, 8);
      p.lineTo(-5, 2);
      p.closePath();
    },
    '#fffbe8',
    IV_INK,
    1.6
  );
}

function ivSlipper(g, x, y) {
  ellipse(g, x, y + 2, 17, 7, '#00000033');
  path(
    g,
    p => {
      p.moveTo(x - 16, y);
      p.bezierCurveTo(x - 16, y - 9, x + 14, y - 9, x + 16, y);
      p.bezierCurveTo(x + 12, y + 6, x - 12, y + 6, x - 16, y);
      p.closePath();
    },
    '#f3a3bd',
    IV_INK,
    2
  );
  path(
    g,
    p => {
      p.moveTo(x - 2, y - 5);
      p.bezierCurveTo(x - 1, y - 14, x + 15, y - 10, x + 14, y - 1);
      p.closePath();
    },
    '#ffc7d8',
    IV_INK,
    2
  );
  ellipse(g, x + 8, y - 11, 5, 4.5, '#ffffff');
  ellipse(g, x + 6, y - 12, 1.6, 1.4, '#ffe6ee');
}

// The bed after the incident: charred frame, shredded covers, a crater, glowing embers.
function ivScorchedBed(g, x, y, s, ember) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 11, 77, 16);
  for (const xx of [-57, 57]) {
    ellipse(g, xx, 12, 7, 7, '#2b2a30');
    ellipse(g, xx, 12, 3, 3, '#6b6f74');
  }
  rr(g, -69, -133, 138, 139, 12, gradient(g, -60, -140, 110, 140, '#6a5a5c', '#2c2328'), '#1c1418', 2.4);
  rr(g, -61, -125, 122, 119, 10, '#cfc0aa');
  rr(g, -55, -121, 110, 34, 11, '#e6dccb');
  ellipse(g, 18, -104, 30, 10, '#7a6a6a55');
  path(
    g,
    p => {
      p.moveTo(-59, -70);
      for (let i = 0; i <= 12; i++) p.lineTo(-59 + i * 9.8, -70 - (i % 2 ? 10 : 0) - ivHash(i) * 6);
      p.lineTo(59, -15);
      p.quadraticCurveTo(0, -6, -59, -16);
      p.closePath();
    },
    gradient(g, 0, -80, 0, 70, '#5d8f8b', '#2f5652'),
    IV_INK,
    1.5
  );
  for (let i = 0; i < 5; i++) ellipse(g, -40 + i * 21, -36 + (i % 2) * 14, 5 + (i % 3), 3.5, '#20171c');
  ellipse(g, 0, -56, 32, 15, '#24161c');
  ellipse(g, 0, -56, 22, 9, 'rgba(255,110,60,' + 0.35 * ember + ')');
  ellipse(g, 0, -58, 12, 4, 'rgba(255,200,120,' + 0.4 * ember + ')');
  line(g, [[-64, -128], [64, -128]], 'rgba(255,130,60,' + 0.35 * ember + ')', 2);
  rr(g, -71, -12, 142, 17, 7, gradient(g, 0, -15, 0, 20, '#5b5458', '#2b262b'), '#1c1418', 1.4);
  g.restore();
}

// ---------- The aftermath (result canvas, 800 × 220) ----------

// Every item remembers a home position; ivPose rewrites x and y from it each frame.
function ivGoreItem(kind, props) {
  const p = { iv: true, kind, x: IV_CRATER[0], y: IV_CRATER[1], vx: 0, vy: 0, ...props };
  p.hx = p.x;
  p.hy = p.y;
  gore.push(p);
  return p;
}

function ivSplat(x, y, r, t0, col) {
  const bits = [];
  for (let i = 0; i < 7; i++) bits.push({ a: rand(0, 6.28), d: rand(1.15, 1.9), r: rand(0.12, 0.3) });
  const drips = [];
  const n = 1 + Math.floor(rand(0, 3));
  for (let i = 0; i < n; i++)
    drips.push({
      dx: rand(-0.6, 0.6),
      len: rand(10, 34),
      w: rand(3, 5.5),
      dur: rand(1.4, 2.6),
      period: rand(1.6, 3.2),
      ph: rand(0, 3)
    });
  const shade = col || pick(['#c8203f', '#d93a57', '#b0183a', '#e25476']);
  return ivGoreItem('splat', { x, y, r, t0, bits, drips, col: shade });
}

// Lays out one explosion. Spots, timings and the late gags come from rand(), so runs are reproducible
// for a seed but two explosions in a row land differently.
function ivBuildAftermath() {
  const variant = ivBoomCount % IV_SPINES.length;
  const spine = IV_SPINES[variant];
  const copy = IV_LOSS_COPY[ivBoomCount % IV_LOSS_COPY.length];
  ivBoomCount++;
  const A = { word: mini.ivWord || IV_WORDS[0], variant, copy, sounds: [], soundAt: 0 };
  mini.ivAfter = A;
  const slots = IV_SLOTS.map((_, i) => i).filter(i => !spine.block.includes(i));
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    const s = slots[i];
    slots[i] = slots[j];
    slots[j] = s;
  }
  if (slots[0] === ivLastHeartSlot) slots.push(slots.shift());
  ivLastHeartSlot = slots[0];
  for (let i = 0; i < 8; i++) ivSplat(rand(125, 675), rand(48, 150), rand(9, 20), rand(0.05, 0.3));
  for (let i = 0; i < 4; i++) {
    const x = i % 2 ? rand(700, 780) : rand(20, 100);
    ivSplat(x, rand(30, 150), rand(8, 16), rand(0.1, 0.35));
  }
  ivSplat(400, 70, 30, 0.02, '#c8203f');
  // Macy has two eyes and both end up in the pile, so none goes on the wall.
  const organs = ['heart', 'lung', 'stomach', 'liver', 'kidney', 'spleen', 'kidney'];
  // The spleen and the second kidney always give up; one more organ sometimes joins them.
  const extra = Math.floor(rand(0, 5));
  organs.forEach((organ, i) => {
    const [sx, sy] = IV_SLOTS[slots[i]];
    const lx = sx + rand(-8, 8);
    const ly = sy + rand(-5, 5);
    const overBed = lx > 335 && lx < 465;
    const t0 = 0.02 + i * 0.03 + rand(0, 0.05);
    const tf = rand(0.24, 0.42);
    const falls = !overBed && (organ === 'spleen' || i === 6 || (i === extra && organ !== 'heart'));
    const room = overBed ? Math.max(0, 66 - ly) : Math.max(0, 150 - ly);
    const stick = rand(0.3, 1.2);
    const slideDur = rand(1.1, 2.2);
    const p = ivGoreItem('organ', {
      organ,
      lx,
      ly,
      t0,
      tf,
      arc: rand(30, 80),
      spin: rand(-7, 7),
      rot0: rand(-0.45, 0.45),
      stick,
      slide: falls ? room * rand(0.3, 0.6) : Math.min(room, rand(8, 40)),
      slideDur,
      falls,
      floorY: rand(168, 175),
      drift: rand(-40, 40),
      scale: IV_ORGAN_SCALE[organ]
    });
    if (i < 4) A.sounds.push([t0 + tf, 'wallSplat']);
    if (falls) {
      const te = t0 + tf + stick + slideDur;
      A.sounds.push([te, 'organ']);
      A.sounds.push([te + Math.sqrt((2 * Math.max(4, p.floorY - (ly + p.slide))) / 900), 'squelch']);
    }
    ivSplat(lx, ly, rand(15, 24), t0 + tf);
  });
  for (let i = 0; i < 8; i++) {
    const wall = i % 2 === 0;
    ivGoreItem('tooth', {
      wall,
      t0: rand(0.02, 0.3),
      tf: rand(0.25, 0.45),
      lx: wall ? rand(135, 665) : rand(330, 470),
      ly: wall ? rand(52, 150) : rand(170, 178),
      rot0: rand(-1, 1),
      spin: rand(-12, 12),
      arc: rand(20, 60)
    });
  }
  ivGoreItem('guts', { x: 275, y: 66, t0: 0.04, tl: 0.42 });
  A.sounds.push([0.42, 'squelch']);
  ivGoreItem('spine', {
    x: spine.x,
    y: spine.y,
    x0: spine.x,
    y0: spine.y,
    a0: spine.a0,
    a1: spine.a1,
    t0: 0.06,
    tl: 0.4,
    topple: rand(2.5, 2.9)
  });
  A.sounds.push([2.8, 'bounce']);
  ivGoreItem('brain', { x: 540, y: 64, t0: 0.08, tl: 0.5 });
  ivGoreItem('pile', { x: 400, y: 177, t0: 0.12 });
  // Two eyes watch from the pile; one pops out late and rolls.
  ivGoreItem('eye', { x: 383, y: 166, x0: 383, y0: 166, ph: rand(0, 2), period: rand(2.4, 3.1) });
  ivGoreItem('eye', {
    x: 416,
    y: 169,
    x0: 416,
    y0: 169,
    ph: rand(0, 2),
    period: rand(2.4, 3.1),
    pop: rand(2.9, 3.3),
    roll: pick([-1, 1]) * rand(14, 24)
  });
  ivGoreItem('slipper', { x: 434, y: 152 });
  ivGoreItem('scrunchie', { x: 412, y: 92, t0: 3.35, x0: 412 + rand(-40, 40) });
  A.sounds.push([3.76, 'bounce']);
  for (let i = 0; i < 6; i++) ivGoreItem('smoke', { x0: 400 + rand(-16, 16), ph: i * 0.45, period: 2.7 });
  ivGoreItem('sign', { t0: 3.7 });
  A.sounds.sort((a, b) => a[0] - b[0]);
  if (reduced) A.soundAt = A.sounds.length;
  return A;
}

// Height above the ground for a dropped object: fall, then two smaller bounces.
function ivBounceY(y0, floorY, tt, e = 0.38) {
  const grav = 900;
  const h = Math.max(0, floorY - y0);
  const t1 = Math.sqrt((2 * h) / grav);
  if (tt < t1) return y0 + 0.5 * grav * tt * tt;
  let v = grav * t1 * e;
  let tc = tt - t1;
  for (let n = 0; n < 2; n++) {
    const dur = (2 * v) / grav;
    if (tc < dur) return floorY - (v * tc - 0.5 * grav * tc * tc);
    tc -= dur;
    v *= e;
  }
  return floorY;
}

// Writes every aftermath particle's position for time t. Positions are pure functions of t, so
// the framework's own gravity step (which moves every gore entry) never gets a say.
function ivGoreSync(t) {
  const A = mini.ivAfter;
  if (A) {
    while (A.soundAt < A.sounds.length && A.sounds[A.soundAt][0] <= t) {
      sfx(A.sounds[A.soundAt][1]);
      A.soundAt++;
    }
  }
  for (const p of gore) {
    if (!p.iv) continue;
    ivPose(p, t);
    p.vx = 0;
    p.vy = 0;
  }
}

function ivFlight(p, t, x1, y1) {
  const u = clamp((t - p.t0) / p.tf, 0, 1);
  p.x = ivLerp(IV_CRATER[0], x1, u);
  p.y = ivLerp(IV_CRATER[1], y1, u) - (p.arc || 50) * 4 * u * (1 - u);
  return u;
}

function ivPose(p, t) {
  p.show = t >= (p.t0 || 0);
  p.x = p.hx;
  p.y = p.hy;
  if (p.kind === 'splat') {
    p.s = ivBackOut(clamp((t - p.t0) / 0.12, 0, 1));
    return;
  }
  if (p.kind === 'organ') {
    const tl = p.t0 + p.tf;
    p.flying = t < tl;
    p.sx = 1;
    p.sy = 1;
    p.floor = false;
    if (p.flying) {
      const u = ivFlight(p, t, p.lx, p.ly);
      p.rot = p.rot0 + p.spin * (1 - u);
      p.sx = p.sy = 1.5 - 0.5 * u;
      p.top = p.ly;
      p.streakEnd = p.ly;
      return;
    }
    const ts = tl + p.stick;
    const te = ts + p.slideDur;
    const k = t < ts ? 0 : ivEase((t - ts) / p.slideDur);
    const v = t - tl;
    const sq = 1 + 0.42 * Math.exp(-v * 7) * Math.cos(v * 22);
    p.sx = sq;
    p.sy = 1 / sq;
    p.rot = p.rot0;
    p.top = p.ly;
    p.x = p.lx + Math.sin(k * 3) * 2;
    p.y = p.ly + p.slide * k;
    p.streakEnd = p.y;
    if (p.falls && t >= te) {
      const y0 = p.ly + p.slide;
      const tt = t - te;
      const tFall = Math.sqrt((2 * Math.max(0, p.floorY - y0)) / 900);
      p.streakEnd = y0;
      p.y = ivBounceY(y0, p.floorY, tt);
      p.x = p.lx + p.drift * Math.min(tt, tFall + 0.5);
      p.rot = p.rot0 + Math.min(tt, tFall) * p.spin * 0.6;
      p.floor = true;
      const w = tt - tFall;
      const land = w > 0 ? 1 + 0.3 * Math.exp(-w * 8) * Math.cos(w * 24) : 1;
      p.sx = land;
      p.sy = 1 / land;
    }
    if (p.organ === 'heart') {
      const a = t * 7.2;
      p.beat = Math.pow(Math.max(0, Math.sin(a)), 6) + 0.6 * Math.pow(Math.max(0, Math.sin(a - 0.9)), 6);
    }
    return;
  }
  if (p.kind === 'tooth') {
    const tl = p.t0 + p.tf;
    p.flying = t < tl;
    if (p.flying) {
      const u = ivFlight(p, t, p.lx, p.ly);
      p.rot = p.rot0 + p.spin * (1 - u);
      return;
    }
    p.rot = p.rot0;
    p.x = p.lx;
    p.y = p.ly;
    if (!p.wall) {
      const v = t - tl;
      p.y = p.ly - Math.max(0, Math.sin(Math.min(v, 0.5) * Math.PI * 2) * 12 * Math.exp(-v * 4));
    }
    return;
  }
  if (p.kind === 'guts') {
    p.landed = t >= p.tl;
    if (!p.landed) {
      const u = clamp((t - p.t0) / (p.tl - p.t0), 0, 1);
      p.x = ivLerp(IV_CRATER[0], 275, u);
      p.y = ivLerp(IV_CRATER[1], 66, u) - 70 * 4 * u * (1 - u);
      p.rot = u * 8;
      return;
    }
    p.x = 275;
    p.y = 66;
    const v = t - p.tl;
    p.unfurl = ivBackOut(clamp(v / 0.35, 0, 1));
    p.sway = Math.sin(t * 2.6) * (2 + 13 * Math.exp(-v * 1.3));
    return;
  }
  if (p.kind === 'spine') {
    p.landed = t >= p.tl;
    if (!p.landed) {
      const u = clamp((t - p.t0) / (p.tl - p.t0), 0, 1);
      p.x = ivLerp(IV_CRATER[0], p.x0, u);
      p.y = ivLerp(IV_CRATER[1], p.y0, u) - 60 * 4 * u * (1 - u);
      p.a = p.a0 + (1 - u) * 5;
      return;
    }
    p.x = p.x0;
    p.y = p.y0;
    const v = t - p.tl;
    const wob = 0.12 * Math.exp(-v * 6) * Math.sin(v * 26);
    const u = clamp((t - p.topple) / 0.35, 0, 1);
    p.a = ivLerp(p.a0, p.a1, ivBackOut(u)) + wob;
    return;
  }
  if (p.kind === 'brain') {
    p.landed = t >= p.tl;
    if (!p.landed) {
      const u = clamp((t - p.t0) / (p.tl - p.t0), 0, 1);
      p.x = ivLerp(IV_CRATER[0], 540, u);
      p.y = ivLerp(IV_CRATER[1], 64, u) - 90 * 4 * u * (1 - u);
      p.rot = (1 - u) * 6;
      p.sq = 1;
      return;
    }
    p.x = 540;
    p.y = 64;
    p.rot = 0;
    const v = t - p.tl;
    p.sq = 1 + 0.35 * Math.exp(-v * 4) * Math.cos(v * 16);
    return;
  }
  if (p.kind === 'pile') {
    p.s = ivBackOut(clamp((t - p.t0) / 0.3, 0, 1));
    return;
  }
  if (p.kind === 'eye') {
    p.lid = (t + p.ph) % p.period < 0.15 ? 1 : 0;
    p.gaze = Math.sin(t * 0.9 + p.ph * 3) * 0.8;
    // Once the scrunchie lands, both eyes turn to look at it.
    if (t >= 3.8) p.gaze = clamp((412 - p.x0) / 20, -0.9, 0.9);
    p.dx = 0;
    p.dy = 0;
    if (p.pop && t >= p.pop) {
      // Pop out of the pile, bounce twice, roll to a stop.
      const v = t - p.pop;
      const hop = Math.max(0, 260 * v - 0.5 * 900 * v * v);
      const v2 = v - 0.578;
      const hop2 = v2 > 0 ? Math.max(0, 90 * v2 - 0.5 * 900 * v2 * v2) : 0;
      p.dy = -(hop + hop2);
      p.dx = p.roll * ivEaseOut(v / 1);
      p.spin = v < 1 ? v * 9 * Math.sign(p.roll) : 9 * Math.sign(p.roll);
    }
    p.x = p.x0 + p.dx;
    p.y = p.y0 + p.dy;
    return;
  }
  if (p.kind === 'scrunchie') {
    if (t < p.t0) {
      p.x = p.x0;
      p.y = 20;
      return;
    }
    const tt = t - p.t0;
    p.y = ivBounceY(20, 92, tt, 0.42);
    p.x = ivLerp(p.x0, 412, ivEaseOut(tt / 0.45));
    p.rot = Math.min(tt, 0.4) * 14;
    return;
  }
  if (p.kind === 'smoke') {
    const u = ((t + p.ph) % p.period) / p.period;
    p.u = u;
    p.x = p.x0 + Math.sin((t + p.ph) * 1.3) * 8 + u * 12;
    p.y = 136 - u * 92;
    return;
  }
  if (p.kind === 'sign') {
    const u = ivEaseOut((t - p.t0) / 0.45);
    p.x = ivLerp(760, 652, u);
    p.y = 182;
    const w = clamp((t - p.t0) / 0.6, 0, 1);
    p.rot = Math.sin(w * Math.PI * 3) * 0.1 * (1 - w);
    return;
  }
  // The slipper never moved. It is very loyal.
}

function ivEach(kind, fn) {
  for (const p of gore) if (p.iv && p.kind === kind && p.show !== false) fn(p);
}

function ivDrawSplat(g, p, t) {
  if (p.s <= 0) return;
  const r = p.r * p.s;
  for (const d of p.drips) {
    const grow = ivEaseOut((t - p.t0 - 0.1) / d.dur);
    if (grow <= 0) continue;
    const x = p.x + d.dx * p.r;
    const y0 = p.y + p.r * 0.3;
    const len = d.len * grow;
    rr(g, x - d.w / 2, y0, d.w, len, d.w / 2, p.col);
    ellipse(g, x, y0 + len, d.w * 0.75, d.w * 0.9, p.col);
    // Settled drips keep dropping.
    if (grow >= 1) {
      const ph = ((t + d.ph) % d.period) / d.period;
      if (ph > 0.6) {
        const u = (ph - 0.6) / 0.4;
        const fy = y0 + len + 5 + u * u * Math.max(0, 168 - y0 - len);
        if (fy < 168) ellipse(g, x, fy, d.w * 0.42, d.w * 0.6, p.col);
      } else ellipse(g, x, y0 + len + 2 + ph * 4, d.w * 0.3 * (ph / 0.6), d.w * 0.4 * (ph / 0.6), p.col);
    }
  }
  ellipse(g, p.x, p.y, r * 1.08, r * 0.92, '#8e1530');
  ellipse(g, p.x, p.y, r, r * 0.84, p.col);
  for (const b of p.bits)
    ellipse(g, p.x + Math.cos(b.a) * b.d * r, p.y + Math.sin(b.a) * b.d * r * 0.8, b.r * r, b.r * r, p.col);
  ellipse(g, p.x - r * 0.32, p.y - r * 0.3, r * 0.26, r * 0.15, '#ff8fa3aa');
}

function ivDrawOrgan(g, p, t) {
  const s = p.scale;
  if (p.floor) ellipse(g, p.x, p.floorY + 9, 16 * s, 4, '#00000033');
  ivAt(g, p.x, p.y, p.rot, p.sx * s, p.sy * s, () => {
    if (p.organ === 'heart') ivOrganHeart(g, p.beat || 0);
    if (p.organ === 'lung') ivOrganLung(g);
    if (p.organ === 'stomach') ivOrganStomach(g);
    if (p.organ === 'liver') ivOrganLiver(g);
    if (p.organ === 'kidney') ivOrganKidney(g);
    if (p.organ === 'spleen') ivOrganSpleen(g);
  });
}

function ivDrawStreak(g, p) {
  if (p.flying || p.top === undefined) return;
  const bottom = p.streakEnd;
  if (bottom - p.top < 2) return;
  const w = 13 * p.scale;
  rr(g, p.lx - w / 2, p.top, w, bottom - p.top, w / 2, IV_STREAK[p.organ]);
  ellipse(g, p.lx - w * 0.3, bottom - 2, 2.2, 3.4, IV_STREAK[p.organ]);
}

// Intestines draped over the IV stand's crossbar, unfurling and swinging.
function ivDrawGuts(g, p) {
  const strand = (dir, len, loops, phase) => {
    const pts = [];
    for (let i = 0; i <= 26; i++) {
      const u = (i / 26) * p.unfurl;
      const x = p.x + dir * (6 + u * 10) + Math.sin(u * Math.PI * loops + phase) * 9 * u + p.sway * u * u;
      const y = p.y - 2 + u * len;
      pts.push([x, y]);
    }
    return pts;
  };
  const left = strand(-1, 74, 3, 0);
  const right = strand(1, 50, 2, 1);
  const draw = (pts, col, w) => line(g, pts, col, w);
  for (const pts of [left, right]) {
    draw(pts, IV_INK, 12);
    draw(pts, '#f49ab0', 8.5);
    draw(pts, '#ffd0dc', 2);
  }
  // A coil at the end of the long strand.
  const end = left[left.length - 1];
  const coil = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 3.4;
    const r = 9 - i * 0.3;
    coil.push([end[0] + Math.cos(a) * r - 4, end[1] + 6 + Math.sin(a) * r * 0.8]);
  }
  if (p.unfurl > 0.8) {
    draw(coil, IV_INK, 11);
    draw(coil, '#f49ab0', 7.5);
  }
  draw(
    [
      [p.x - 12, p.y - 3],
      [p.x, p.y - 7],
      [p.x + 12, p.y - 3]
    ],
    IV_INK,
    12
  );
  draw(
    [
      [p.x - 12, p.y - 3],
      [p.x, p.y - 7],
      [p.x + 12, p.y - 3]
    ],
    '#f49ab0',
    8.5
  );
}

function ivDrawGutsBall(g, p) {
  ivAt(g, p.x, p.y, p.rot, 1, 1, () => {
    ellipse(g, 0, 0, 15, 13, IV_INK);
    ellipse(g, 0, 0, 13, 11, '#f49ab0');
    path(
      g,
      q => {
        q.moveTo(-8, -2);
        q.bezierCurveTo(-4, -9, 6, -6, 4, 0);
        q.bezierCurveTo(2, 6, -6, 6, -4, 2);
      },
      null,
      '#c45c7a',
      1.8
    );
  });
}

// Vertebrae stacked along a gentle S, from the base up.
function ivDrawSpine(g, p) {
  const n = 9;
  for (let i = n - 1; i >= 0; i--) {
    const d = i * 11;
    const bend = Math.sin(i * 0.55) * 5;
    const x = p.x + Math.sin(p.a) * d + Math.cos(p.a) * bend;
    const y = p.y - Math.cos(p.a) * d + Math.sin(p.a) * bend;
    ivAt(g, x, y, p.a, 1 - i * 0.03, 1, () => {
      rr(g, -9, -4, 18, 8, 3, '#f3e8d0', '#5a4636', 1.8);
      line(g, [[9, 0], [14, 2]], '#5a4636', 4);
      line(g, [[9, 0], [14, 2]], '#f3e8d0', 2);
      if (i) rr(g, -7, 4, 14, 3, 1.5, '#e98fa4');
    });
  }
  ivAt(g, p.x + Math.sin(p.a) * 3, p.y + 4, p.a, 1, 1, () => {
    path(
      g,
      q => {
        q.moveTo(-12, -2);
        q.quadraticCurveTo(0, 10, 12, -2);
        q.lineTo(8, -5);
        q.lineTo(-8, -5);
        q.closePath();
      },
      '#f3e8d0',
      '#5a4636',
      1.8
    );
  });
}

function ivDrawPile(g, p) {
  if (p.s <= 0) return;
  ivAt(g, p.x, p.y, 0, p.s, p.s, () => {
    ellipse(g, 0, 4, 64, 9, '#00000033');
    const blobs = [
      [-40, -2, 16, 9, '#a3183a'],
      [38, -1, 15, 8, '#b52a45'],
      [-18, -8, 20, 12, '#d6304f'],
      [16, -9, 19, 12, '#c8203f'],
      [0, -15, 16, 11, '#e25476'],
      [-30, -10, 9, 7, '#f49ab0'],
      [30, -12, 10, 6, '#8f2340']
    ];
    for (const [x, y, rx, ry, col] of blobs) {
      ellipse(g, x, y, rx + 2, ry + 2, IV_INK);
      ellipse(g, x, y, rx, ry, col);
      ellipse(g, x - rx * 0.3, y - ry * 0.35, rx * 0.3, ry * 0.2, '#ff9fb3aa');
    }
    line(g, [[-8, -20], [-2, -26], [6, -22], [10, -28]], IV_INK, 7);
    line(g, [[-8, -20], [-2, -26], [6, -22], [10, -28]], '#f49ab0', 4);
  });
}

function ivDrawSign(g, p, t) {
  if (t < p.t0) return;
  ivAt(g, p.x, p.y, p.rot, 1, 1, () => {
    ellipse(g, 0, 2, 18, 3.5, '#00000033');
    poly(
      g,
      [
        [-14, 0],
        [-5, -38],
        [5, -38],
        [14, 0]
      ],
      IV_INK
    );
    poly(
      g,
      [
        [-11, -2],
        [-3, -35],
        [3, -35],
        [11, -2]
      ],
      '#ffd84a'
    );
    label(g, '!', 0, -16, 16, IV_INK, 'center');
    label(g, 'WET', 0, -5, 7, IV_INK, 'center');
  });
}

function ivAfterRoom(g, t) {
  rect(g, 0, 0, 800, 220, gradient(g, 0, 0, 0, 170, '#86b6ab', '#5d8f8a'));
  rect(g, 0, 110, 800, 4, '#4b7a76');
  for (let x = 0; x < 800; x += 45) rect(g, x, 114, 1, 54, '#d1ddba22');
  // Blast marks fanning out from the bed.
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI;
    poly(
      g,
      [
        [400, 128],
        [400 + Math.cos(a - 0.08) * 300, 128 + Math.sin(a - 0.08) * 150],
        [400 + Math.cos(a + 0.08) * 300, 128 + Math.sin(a + 0.08) * 150]
      ],
      '#2b1d2618'
    );
  }
  glow(g, 400, 118, 190, 'rgba(40,24,34,0.55)');
  rect(g, 0, 168, 800, 52, '#46666a');
  rect(g, 0, 168, 800, 3, '#365457');
  for (let x = 20; x < 800; x += 60) rect(g, x, 171, 1, 49, '#ffffff10');
  // The poster took a hit too.
  ivAt(g, 632, 80, 0.12, 0.8, 0.8, () => poster(g, -27, -35, 0));
  plant(g, 64, 180, 1.05);
  // A GET WELL balloon, now mostly a GET WELL suggestion.
  const sway = Math.sin(t * 1.4) * 3;
  line(g, [[742, 182], [745 + sway * 0.5, 120], [748 + sway, 78]], '#e9e3cf', 1.5);
  ellipse(g, 748 + sway, 58, 25, 22, IV_INK);
  ellipse(g, 748 + sway, 58, 23, 20, '#ffcf5a');
  ellipse(g, 740 + sway, 50, 6, 4, '#fff1b8');
  label(g, 'GET', 748 + sway, 56, 9, '#7a5410', 'center');
  label(g, 'WELL', 748 + sway, 67, 9, '#7a5410', 'center');
  poly(
    g,
    [
      [744 + sway, 79],
      [752 + sway, 79],
      [748 + sway, 84]
    ],
    '#e0a93a'
  );
}

function ivAfterCabinet(g, t) {
  shadow(g, 540, 186, 48, 7);
  rr(g, 502, 128, 76, 56, 5, gradient(g, 500, 128, 76, 56, '#d5ab88', '#a87d73'), '#7c5a52', 1);
  rr(g, 498, 124, 84, 9, 4, '#f0d0a8');
  rr(g, 510, 141, 60, 16, 3, '#e3bd98');
  rr(g, 510, 161, 60, 16, 3, '#e3bd98');
  const smile = t >= 3.3;
  const pop = smile ? ivBackOut(clamp((t - 3.3) / 0.25, 0, 1)) : 1;
  ivMonitor(g, 540, 122, 0.78 * (smile ? 0.92 + pop * 0.08 : 1), {
    flat: true,
    smile,
    alarm: !smile && Math.sin(t * 9) > 0,
    text: smile ? '88' : '--'
  });
}

function ivDrawAftermath(g, t) {
  ivAfterRoom(g, t);
  ivEach('splat', p => ivDrawSplat(g, p, t));
  ivEach('organ', p => ivDrawStreak(g, p));
  ivAfterCabinet(g, t);
  ivEach('brain', p => {
    if (!p.landed) return;
    ivAt(g, p.x, p.y + 6, 0, 1 / p.sq, p.sq, () => ivAt(g, 0, -6, 0, 0.8, 0.8, () => ivBrain(g)));
  });
  ivEach('tooth', p => {
    if (p.wall && !p.flying) ivAt(g, p.x, p.y, p.rot, 0.9, 0.9, () => ivTooth(g));
  });
  ivEach('organ', p => {
    if (!p.flying && !p.floor) ivDrawOrgan(g, p, t);
  });
  ivStand(g, 275, 182, 0.88);
  ivEach('guts', p => {
    if (p.landed) ivDrawGuts(g, p);
  });
  const spine = gore.find(p => p.iv && p.kind === 'spine');
  const spineOnBed = mini.ivAfter && mini.ivAfter.variant === 2;
  if (spine && spine.landed && !spineOnBed) ivDrawSpine(g, spine);
  ivScorchedBed(g, 400, 176, 0.76, 0.7 + Math.sin(t * 3) * 0.3);
  ivEach('slipper', p => ivSlipper(g, p.x, p.y));
  if (spine && spine.landed && spineOnBed) ivDrawSpine(g, spine);
  ivEach('smoke', p => {
    const a = Math.sin(p.u * Math.PI) * 0.32 + Math.max(0, 1 - t) * 0.4;
    ellipse(g, p.x, p.y, 8 + p.u * 16, 6 + p.u * 12, 'rgba(70,64,74,' + a.toFixed(3) + ')');
  });
  ivEach('scrunchie', p => {
    if (t < p.t0) return;
    ivAt(g, p.x, p.y, p.rot, 1.5, 1.15, () => {
      ellipse(g, 0, 0, 8.5, 7.5, IV_INK);
      ellipse(g, 0, 0, 7, 6, '#f1abbd');
      for (let i = 0; i < 6; i++) ellipse(g, Math.cos(i) * 5, Math.sin(i) * 4.2, 1.6, 1.4, '#ffd0de');
      ellipse(g, 0, 0, 2.6, 2, '#9e5a70');
    });
    // A little twinkle so nobody misses the last survivor.
    const since = t - 3.78;
    if (since > 0 && since < 1.2) spark(g, p.x + 14, p.y - 10, '#fff4c2', 0.9 * Math.sin((since / 1.2) * Math.PI));
  });
  ivEach('pile', p => ivDrawPile(g, p));
  ivEach('eye', p => {
    if (t < 0.12) return;
    ivAt(g, p.x, p.y, p.spin || 0, 1, 1, () => ivEyeball(g, 8, p.gaze, p.lid));
  });
  ivEach('tooth', p => {
    if (!p.wall && !p.flying) ivAt(g, p.x, p.y, p.rot, 0.9, 0.9, () => ivTooth(g));
  });
  ivEach('organ', p => {
    if (!p.flying && p.floor) ivDrawOrgan(g, p, t);
  });
  // Anything still airborne flies in front of everything.
  ivEach('organ', p => {
    if (p.flying) ivDrawOrgan(g, p, t);
  });
  ivEach('tooth', p => {
    if (p.flying) ivAt(g, p.x, p.y, p.rot, 1.2, 1.2, () => ivTooth(g));
  });
  ivEach('guts', p => {
    if (!p.landed) ivDrawGutsBall(g, p);
  });
  if (spine && !spine.landed) ivDrawSpine(g, spine);
  ivEach('brain', p => {
    if (!p.landed) ivAt(g, p.x, p.y, p.rot, 1, 1, () => ivBrain(g));
  });
  ivEach('sign', p => ivDrawSign(g, p, t));
  // The bang is still ringing for a moment.
  if (t < 0.35) rect(g, 0, 0, 800, 220, 'rgba(255,255,255,' + (0.6 * (1 - t / 0.35)).toFixed(3) + ')');
}

