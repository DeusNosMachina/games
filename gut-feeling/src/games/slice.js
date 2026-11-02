// Gel Yeah! (ultrasound). Swipe through airborne gel gremlins launched in spread-out formations.
// Three or more in one stroke builds combos and gel fever. Level 1 teaches one thing per wave.
// Levels 2 and 3 add arrow gremlins (slice along the arrow), numbered sets (slice in order),
// a gold gremlin that starts a bomb-free frenzy, and (level 3) lit bombs you can flick away.
// Helmets need a second stroke, blue gremlins split, pink bombs hurt. Canvas 600 × 600.
const SLICE_G = 650;
const SLICE_LAUNCH_Y = 640;
const SLICE_FEVER_AT = 12;
const SLICE_FRENZY = 5;
const SLICE_DIRS4 = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const SLICE_DIRS8 = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (-3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4];

// Per-level tuning. Arrays with three entries are per wave (shift).
const SLICE_TIERS = [
  {
    limit: 90,
    goal: 45,
    interval: 3,
    escapes: [10, 9, 8],
    size: [3, 3, 4],
    forms: [['line', 'scatter'], ['line', 'scatter', 'arc'], ['line', 'arc', 'v', 'scatter']],
    bombs: [0.35, 0.45, 0.5],
    bombFrom: 20,
    armor: [0, 0.22, 0.15],
    split: [0, 0, 0.2],
    arrows: null,
    arrowChance: [0, 0, 0],
    arrowTol: 0.9,
    numbered: [0, 0, 0],
    gold: [],
    flick: false,
    hints: ['first', 'bomb', 'armor', 'split']
  },
  {
    limit: 105,
    goal: 70,
    interval: 2.7,
    escapes: [9, 8, 7],
    size: [3, 4, 4],
    forms: [
      ['line', 'arc', 'v', 'fountain', 'scatter'],
      ['line', 'arc', 'v', 'fountain', 'scatter', 'drum'],
      ['line', 'arc', 'v', 'fountain', 'scatter', 'drum']
    ],
    bombs: [0.5, 0.6, 0.7],
    bombFrom: 0,
    armor: [0.08, 0.15, 0.15],
    split: [0, 0.1, 0.18],
    arrows: SLICE_DIRS4,
    arrowChance: [0.3, 0.3, 0.35],
    arrowTol: 0.9,
    numbered: [0, 0.3, 0.25],
    gold: [0.62, 0.86],
    flick: false,
    hints: ['arrow', 'num', 'gold']
  },
  {
    limit: 120,
    goal: 92,
    interval: 2.5,
    escapes: [8, 7, 6],
    size: [4, 4, 5],
    forms: [
      ['line', 'arc', 'v', 'fountain', 'criss', 'scatter'],
      ['line', 'arc', 'v', 'fountain', 'criss', 'scatter', 'drum'],
      ['line', 'arc', 'v', 'fountain', 'criss', 'scatter', 'drum']
    ],
    bombs: [0.75, 0.85, 0.95],
    bombFrom: 0,
    armor: [0.15, 0.18, 0.2],
    split: [0.1, 0.18, 0.2],
    arrows: SLICE_DIRS8,
    arrowChance: [0.3, 0.35, 0.4],
    arrowTol: 0.65,
    numbered: [0.15, 0.25, 0.25],
    gold: [0.38, 0.74],
    flick: true,
    hints: ['flick', 'arrow', 'num', 'gold']
  }
];

const SLICE_HINTS = {
  first: 'SWIPE THROUGH · 3+ IN ONE STROKE = BONUS',
  bomb: 'PINK BOMB · DO NOT TOUCH',
  armor: 'HELMET · SWIPE, LIFT, SWIPE',
  split: 'BLUE SPLITS · GET BOTH HALVES',
  arrow: 'SWIPE THE WAY IT POINTS',
  num: 'SLICE IN ORDER · 1, 2, 3',
  gold: 'GOLD · SLICE IT FOR A FRENZY',
  flick: 'LIT FUSE · FLICK IT UP AND AWAY'
};

const SLICE = registerGame({
  id: 4,
  canvas: { w: 600, h: 600 },
  layout: 'gesture',
  info: {
    game: 'Gel Yeah!',
    genre: 'FLICK · SWIPE COMBOS · RISK / REWARD',
    headline: 'A very questionable fruit salad.',
    desc: 'Slice gel gremlins launched in lines, arcs, fountains and criss-crosses. Three or more in a stroke builds a combo. Arrows demand a direction, numbers demand an order, gold starts a frenzy. Helmets need two swipes, blue ones split, pink bombs ruin everything.',
    goal: 'Slice the gremlin quota and survive the full shift.',
    control:
      'Press and swipe through gremlins. Lift to bank a combo. Slice three or more in one stroke for bonus points and slow-motion fever.',
    avoid:
      'Avoid pink bombs. Helmets need a second stroke. Blue gremlins split. Escapes add up to an oops, and the allowance shrinks every wave.',
    cue: 'Swipe gremlins · lift to bank combos · avoid pink bombs · re-swipe helmets'
  },
  tierNotes: [
    '90s · learn one trick per wave',
    '105s · arrows · numbered sets · gold frenzy',
    '120s · criss-cross · lit bombs to flick · eight-way arrows'
  ],
  init() {
    const tier = SLICE_TIERS[mini.tier];
    initArcadeRun(tier.limit);
    mini.goal = tier.goal;
    mini.gels = [];
    mini.gelSerial = 0;
    mini.spawn = 0.6;
    mini.strokes = 0;
    mini.cutCount = 0;
    mini.escaped = 0;
    mini.fever = 0;
    mini.feverMeter = 0;
    mini.strokeHits = 0;
    mini.sliceQueue = [];
    mini.sliceEscapes = 0;
    mini.sliceSets = {};
    mini.sliceSetSerial = 0;
    mini.sliceGoldAt = tier.gold.map(f => f * tier.limit);
    mini.sliceFrenzy = 0;
    mini.sliceFrenzyClock = 0;
    mini.sliceFrenzies = 0;
    mini.sliceFlicks = 0;
    mini.sliceOrders = 0;
    mini.sliceWrong = 0;
    mini.sliceSeen = {};
    mini.sliceHalves = [];
    mini.sliceStains = [];
    mini.slicePops = [];
    mini.sliceOopsQueue = [];
  },
  controls() {
    setControls([]);
  },
  update(dt) {
    updateArcade(dt, updateSlice);
  },
  draw(g) {
    arcadeBackdrop(g, '#20534e', '#9bddb924', 'ULTRASOUND / GEL EVERYWHERE');
    drawSlice(g);
  },
  down(p) {
    mini.strokeHits = 0;
    mini.strokes++;
    sliceSegment(p, p);
  },
  move(p, prev) {
    sliceSegment(prev, p);
  },
  // Lifting the finger banks the stroke: 3+ hits score a combo and feed gel fever.
  up(cancel) {
    if (mini.pointer && !cancel && mini.screen === 'play' && !mini.paused) {
      const n = mini.strokeHits,
        bonus = n * 25 * (mini.sliceFrenzy > 0 ? 2 : 1);
      if (n >= 3) {
        mini.score += bonus;
        mini.feverMeter += n;
        mini.flash = 0.7;
        mini.flashText = n + ' IN ONE SWIPE · +' + bonus;
        mini.maxCombo = Math.max(mini.maxCombo, n);
        sfx('combo', { count: n });
      }
      if (mini.feverMeter >= SLICE_FEVER_AT) {
        mini.fever = 4;
        mini.feverMeter = 0;
        mini.flash = 1;
        mini.flashText = 'GEL FEVER · SLOW MOTION · DOUBLE POINTS';
        sfx('fever');
      }
    }
  },
  assist() {
    mini.slow = 5;
    mini.gels = mini.gels.filter(o => !o.bomb);
    mini.sliceQueue = mini.sliceQueue.filter(q => !q.gel.bomb);
    mini.flash = 1;
    mini.flashText = 'BOMBS CLEARED · SLOW MOTION';
  },
  shiftName: 'WAVE',
  shiftMessage: shift =>
    [
      ['WAVE 2 · helmets need TWO separate swipes.', 'FINAL WAVE · blue gremlins split. Slice the halves.'],
      ['WAVE 2 · numbered sets: slice 1, 2, 3 in order.', 'FINAL WAVE · gold gremlin incoming. Slice it for a frenzy.'],
      ['WAVE 2 · numbers and splitters join the party.', 'FINAL WAVE · six escapes is an oops. Make every swipe count.']
    ][mini.tier][shift - 1],
  lesson() {
    const i = SLICE.info,
      goal = ' Target: ' + mini.goal + '.';
    return [
      {
        title: i.game + ' · gel school',
        goal: 'One new trick per wave: basics, then helmets, then splitters. Bombs show up after 20 seconds.' + goal,
        control: i.control,
        avoid: i.avoid,
        demo: 'slice',
        cue: i.cue
      },
      {
        title: i.game + ' · ' + mini.limit + ' second shift',
        goal: 'Arrow gremlins only split along their arrow. Numbered sets pay +3 in order. Gold starts a five second frenzy.' + goal,
        control: i.control,
        avoid: i.avoid,
        demo: 'slice',
        cue: i.cue
      },
      {
        title: i.game + ' · ' + mini.limit + ' second shift',
        goal: 'Eight-way arrows, criss-cross launches, and lit bombs. A quick upward flick sends a lit bomb away for points.' + goal,
        control: i.control,
        avoid: 'Any other swipe through a bomb is an oops. Escapes add up fast: eight, then seven, then six per oops.',
        demo: 'slice',
        cue: i.cue
      }
    ][mini.tier];
  },
  statLabel: () => 'SLICES / WAVE',
  stat: () => mini.got + '/' + mini.goal + ' · ' + (mini.shift + 1) + '/3',
  tactics: () => 'SCORE ' + mini.score + ' · BEST CHAIN ' + mini.maxCombo + ' · ' + mini.helps + ' ASSISTS',
  assistText: () => 'GEL FREEZE · ' + mini.helps + ' (E)',
  onWin: () =>
    pick([
      'The ultrasound tech says the baby looks like gel. There is no baby.',
      'Sonar screen cleaned. Mostly. Some of it is load-bearing now.',
      'Fruit salad served. Nobody ordered it.'
    ]),
  scene(g, w, h) {
    g.save();
    g.scale(w / 420, h / 240);
    rect(g, 0, 0, 420, 240, gradient(g, 0, 0, 420, 240, '#316b61', '#193b4e'));
    ellipse(g, 210, 150, 150, 120, '#0b313d');
    for (const [x, y, c] of [[110, 140, '#9bd77f'], [300, 105, '#86cfee'], [250, 190, '#f3cf6e']])
      sliceStainArt(g, x, y, 22, c, 0.35, x);
    for (let i = 0; i < 4; i++)
      gremlin(g, 100 + i * 77, 125 + Math.sin(i) * 38, 1.3, i === 3 ? 3 : i === 2 ? 2 : 0, time + i);
    path(
      g,
      p => {
        p.moveTo(50, 170);
        p.quadraticCurveTo(170, 60, 355, 150);
      },
      null,
      '#f4edc7',
      5
    );
    spark(g, 355, 150, '#ffffff', 0.8);
    label(g, SLICE.info.game.toUpperCase(), 210, 24, 12, '#e5efd3', 'center');
    g.restore();
  }
});

// ---- Spawning ----

// A gel aimed so its apex lands at (ax, ay): the launch speed comes from the apex height.
function sliceGel(x0, ax, ay, extra = {}) {
  const vy = -Math.sqrt(2 * SLICE_G * (SLICE_LAUNCH_Y - ay)),
    rise = -vy / SLICE_G;
  return {
    id: mini.gelSerial++,
    x: x0,
    y: SLICE_LAUNCH_Y,
    vx: (ax - x0) / rise,
    vy,
    r: 27,
    hp: 1,
    bomb: false,
    armor: false,
    split: false,
    stroke: -1,
    angle: rand(-0.6, 0.6),
    spin: rand(-1.6, 1.6),
    entered: false,
    ...extra
  };
}

// Where a gel will peak.
function sliceApex(o) {
  const rise = Math.max(0, -o.vy / SLICE_G);
  return { x: o.x + o.vx * rise, y: o.y + o.vy * rise + 0.5 * SLICE_G * rise * rise };
}

// Apex points for a formation of n gels, spread across the sonar screen.
function sliceFormation(kind, n) {
  const spots = [],
    span = Math.min(400, 100 * Math.max(1, n - 1)) * rand(0.85, 1),
    left = clamp(300 - span / 2 + rand(-35, 35), 95, 505 - span),
    order = [...Array(n).keys()],
    src = rand(220, 380),
    lineY = rand(195, 265);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < n; i++) {
    const ax = n > 1 ? left + (span * i) / (n - 1) : 300,
      u = n > 1 ? (2 * i) / (n - 1) - 1 : 0;
    if (kind === 'line') spots.push({ ax, ay: lineY, x0: ax + rand(-20, 20), delay: 0 });
    else if (kind === 'drum') spots.push({ ax, ay: lineY, x0: ax, delay: i * 0.16 });
    else if (kind === 'arc') spots.push({ ax, ay: 175 + 100 * u * u, x0: ax + u * 40, delay: 0 });
    else if (kind === 'v') spots.push({ ax, ay: 300 - 125 * Math.abs(u), x0: ax - u * 30, delay: 0 });
    else if (kind === 'fountain') spots.push({ ax, ay: 170 + rand(0, 90), x0: src, delay: i * 0.1 });
    else if (kind === 'criss') {
      const fromLeft = i % 2 === 0;
      spots.push({
        ax: fromLeft ? rand(360, 485) : rand(115, 240),
        ay: rand(185, 285),
        x0: fromLeft ? rand(70, 150) : rand(450, 530),
        delay: Math.floor(i / 2) * 0.22
      });
    } else {
      const sx = n > 1 ? left + (span * order[i]) / (n - 1) : 300;
      spots.push({ ax: sx + rand(-18, 18), ay: rand(170, 320), x0: sx + rand(-60, 60), delay: rand(0, 0.45) });
    }
  }
  for (const s of spots) {
    s.ax = clamp(s.ax, 70, 530);
    s.ay = clamp(s.ay, 140, 330);
    s.x0 = clamp(s.x0, 50, 550);
  }
  return spots;
}

function sliceQueueGel(o, delay, wave) {
  mini.sliceQueue.push({ delay, gel: o });
  wave.push(o);
  return o;
}

function sliceHint(o, key) {
  if (mini.sliceSeen[key] || !SLICE_TIERS[mini.tier].hints.includes(key)) return o;
  mini.sliceSeen[key] = true;
  o.hint = SLICE_HINTS[key];
  return o;
}

// Launches the next wave (during a frenzy: a bomb-free volley). Returns every gel it created.
function spawnGelWave() {
  if (mini.sliceFrenzy > 0) return sliceFrenzyVolley();
  const tier = SLICE_TIERS[mini.tier],
    shift = mini.shift,
    wave = [],
    numbered = rand(0, 1) < tier.numbered[shift],
    form = numbered ? pick(['line', 'arc', 'scatter']) : pick(tier.forms[shift]),
    n = numbered ? (mini.tier === 2 ? 4 : 3) : tier.size[shift] + (rand(0, 1) < 0.35 ? 1 : 0),
    spots = sliceFormation(form, n),
    nums = [...Array(n).keys()].map(i => i + 1);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  const set = numbered ? ++mini.sliceSetSerial : 0;
  if (numbered) mini.sliceSets[set] = { next: 1, size: n, broken: false };
  spots.forEach((s, i) => {
    const o = sliceGel(s.x0, s.ax, s.ay);
    if (numbered) {
      Object.assign(o, { num: nums[i], set, spin: 0, angle: 0 });
      if (nums[i] === 1) sliceHint(o, 'num');
    } else {
      const roll = rand(0, 1);
      if (roll < tier.armor[shift]) {
        Object.assign(o, { armor: true, hp: 2, r: 29 });
        sliceHint(o, 'armor');
      } else if (roll < tier.armor[shift] + tier.split[shift]) {
        o.split = true;
        sliceHint(o, 'split');
      } else if (tier.arrows && rand(0, 1) < tier.arrowChance[shift]) {
        Object.assign(o, { dir: pick(tier.arrows), spin: 0, angle: 0 });
        sliceHint(o, 'arrow');
      }
    }
    if (i === Math.floor(n / 2)) sliceHint(o, 'first');
    sliceQueueGel(o, s.delay, wave);
  });
  if (mini.sliceGoldAt.length && mini.phaseTime >= mini.sliceGoldAt[0]) {
    mini.sliceGoldAt.shift();
    const fromLeft = rand(0, 1) < 0.5,
      o = sliceGel(fromLeft ? 70 : 530, fromLeft ? rand(330, 430) : rand(170, 270), rand(130, 170), {
        gold: true,
        r: 24,
        spin: 5
      });
    sliceQueueGel(sliceHint(o, 'gold'), 0.35, wave);
  }
  if (mini.phaseTime >= tier.bombFrom && rand(0, 1) < tier.bombs[shift]) {
    const count = mini.tier === 2 && shift === 2 && rand(0, 1) < 0.4 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const s = pick(spots),
        fuse = rand(1.9, 2.6),
        o = sliceGel(clamp(s.x0 + rand(-70, 70), 60, 540), clamp(s.ax + rand(-55, 55), 80, 520), clamp(s.ay + rand(-40, 40), 150, 320), {
          bomb: true,
          r: 28,
          spin: 1,
          angle: 0,
          lit: tier.flick,
          fuse,
          fuseLeft: fuse
        });
      sliceHint(o, tier.flick ? 'flick' : 'bomb');
      sliceQueueGel(o, rand(0, 0.3), wave);
    }
  }
  return wave;
}

// Frenzy volleys come from both lower corners, three at a time, never with bombs.
function sliceFrenzyVolley() {
  const wave = [];
  for (let i = 0; i < 3; i++) {
    const side = (mini.gelSerial + i) % 2 ? 1 : -1,
      o = sliceGel(300 + side * rand(150, 240), 300 - side * rand(20, 210), rand(150, 300), { frenzy: true });
    sliceQueueGel(o, i * 0.12, wave);
  }
  return wave;
}

function sliceStartFrenzy() {
  mini.sliceFrenzy = SLICE_FRENZY;
  mini.sliceFrenzyClock = 0;
  mini.sliceFrenzies++;
  for (const o of mini.gels)
    if (o.bomb && !o.flicked && !o.dead) {
      o.dead = true;
      arcadeBurst(o.x, o.y, '#c9c2cf', 8);
    }
  mini.sliceQueue = mini.sliceQueue.filter(q => !q.gel.bomb);
  mini.flash = 1.2;
  mini.flashText = 'GOLD FRENZY · NO BOMBS · DOUBLE POINTS';
  sfx('powerup');
}

// ---- Slicing ----

function pointSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function sliceAngleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

// A quick, mostly upward stroke segment counts as a flick.
function sliceIsFlick(a, b) {
  const up = a.y - b.y;
  return up >= 3 && Math.abs(b.x - a.x) <= up * 0.85 && mini.total - mini.pointer.startT <= 0.4;
}

function slicePop(text, x, y, col = '#ffe7b0') {
  mini.slicePops.push({ text, x, y, life: 1, col });
  if (mini.slicePops.length > 8) mini.slicePops.shift();
}

// One blade segment: cuts every gel it crosses (once per stroke), with each gel's own rules.
function sliceSegment(a, b) {
  if (!mini.pointer) return;
  const stroke = mini.pointer.stroke,
    tier = SLICE_TIERS[mini.tier],
    len = Math.hypot(b.x - a.x, b.y - a.y),
    ang = len > 0.5 ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
  mini.trail.push({ x: b.x, y: b.y, life: 0.23, stroke });
  for (const o of [...mini.gels]) {
    if (o.dead || o.flicked || o.y > 590 || o.stroke === stroke || pointSegment(o, a, b) > o.r + 5) continue;
    if (o.bomb) {
      // A press is not a swipe: bombs only go off when the blade moves through them.
      if (len < 3) continue;
      o.stroke = stroke;
      if (tier.flick && o.lit && sliceIsFlick(a, b)) {
        sliceFlick(o);
        continue;
      }
      sliceBoom(o);
      continue;
    }
    if (o.dir !== undefined) {
      if (len < 4) continue;
      if (Math.abs(sliceAngleDiff(ang, o.dir)) > tier.arrowTol) {
        o.stroke = stroke;
        o.wrong = 0.35;
        o.vy -= 40;
        mini.sliceWrong++;
        slicePop('WRONG WAY', o.x, o.y - 40, '#ffb0b0');
        sfx('ricochet');
        continue;
      }
    }
    o.stroke = stroke;
    o.hp--;
    if (o.hp > 0) {
      mini.flash = 0.5;
      mini.flashText = 'HELMET CRACKED · LIFT, THEN SWIPE AGAIN';
      o.armor = false;
      arcadeBurst(o.x, o.y - 20, '#dfe8e4', 6);
      sfx('ricochet');
      continue;
    }
    sliceCut(o, ang, stroke);
  }
}

function sliceCut(o, ang, stroke) {
  o.dead = true;
  const mult = (mini.fever > 0 ? 2 : 1) * (mini.sliceFrenzy > 0 ? 2 : 1);
  if (o.split) {
    for (const sign of [-1, 1])
      mini.gels.push({
        id: mini.gelSerial++,
        x: o.x + sign * 18,
        y: o.y,
        vx: (o.vx || 0) + sign * 110,
        vy: -280,
        r: 20,
        hp: 1,
        bomb: false,
        armor: false,
        split: false,
        stroke,
        angle: 0,
        spin: sign * 3,
        entered: true,
        child: true
      });
    mini.flash = 0.5;
    mini.flashText = 'BLUE SPLITS · GET BOTH HALVES';
    sfx('split');
  }
  if (o.num) sliceNumbered(o);
  if (o.gold) sliceStartFrenzy();
  mini.got++;
  mini.strokeHits++;
  mini.cutCount++;
  praise(35 * mult);
  const col = sliceColor(o);
  arcadeBurst(o.x, o.y, col, 10);
  sliceStain(o.x, o.y, o.r * rand(0.8, 1.1), col);
  sliceHalves(o, ang);
  sfx('slice', { combo: mini.strokeHits });
}

function sliceNumbered(o) {
  const set = mini.sliceSets[o.set];
  if (!set || set.broken) return;
  if (o.num !== set.next) {
    set.broken = true;
    slicePop('OUT OF ORDER', o.x, o.y - 40, '#ffb0b0');
    return;
  }
  set.next++;
  slicePop(o.num + '!', o.x, o.y - 40, '#ffe7b0');
  if (set.next > set.size) {
    mini.got += 3;
    mini.score += 200;
    mini.sliceOrders++;
    mini.flash = 0.9;
    mini.flashText = 'IN ORDER · +3 BONUS';
    sfx('clear');
  }
}

function sliceFlick(o) {
  o.flicked = true;
  o.vy = -950;
  o.vx *= 0.3;
  o.spin = 9;
  mini.sliceFlicks++;
  mini.feverMeter += 2;
  praise(60);
  slicePop('FLICKED', o.x, o.y - 40, '#ffe7b0');
  sfx('throw');
}

function sliceBoom(o) {
  o.dead = true;
  mini.strokeHits = 0;
  mini.feverMeter = 0;
  arcadeBurst(o.x, o.y, '#ec86b0', 25);
  sliceStain(o.x, o.y, 58, '#ec86b0');
  sfx('bomb');
  mini.flash = 0.9;
  mini.flashText = 'PINK GUNK BOMB · KEEP YOUR SWIPE CLEAN';
  // Applied on the next update: an oops that ends the run lifts the pointer, and the stroke
  // (and the framework's move handler) must finish first.
  mini.sliceOopsQueue.push(mini.flashText);
}

function sliceEscape(o) {
  mini.escaped++;
  mini.sliceEscapes++;
  mini.combo = 0;
  if (o.num && mini.sliceSets[o.set]) mini.sliceSets[o.set].broken = true;
  const limit = SLICE_TIERS[mini.tier].escapes[mini.shift];
  if (mini.sliceEscapes >= limit) {
    mini.sliceEscapes = 0;
    miniOops(limit + ' ESCAPED · SWIPE WIDER');
  }
}

function sliceColor(o) {
  return o.gold ? '#f3cf6e' : o.split || o.child ? '#86cfee' : o.num ? '#ffd28a' : '#9bd77f';
}

function sliceType(o) {
  return o.gold ? 2 : o.split || o.child ? 3 : 0;
}

function sliceStain(x, y, r, col) {
  mini.sliceStains.push({ x, y, r, col, life: 5, max: 5, seed: mini.gelSerial * 7 + mini.sliceStains.length });
  if (mini.sliceStains.length > 28) mini.sliceStains.shift();
}

// Two halves fly apart across the cut line, each keeping its half of the face.
function sliceHalves(o, ang) {
  const nx = -Math.sin(ang),
    ny = Math.cos(ang);
  for (const side of [-1, 1])
    mini.sliceHalves.push({
      x: o.x + nx * side * 4,
      y: o.y + ny * side * 4,
      vx: (o.vx || 0) * 0.5 + nx * side * 110,
      vy: Math.min(o.vy || 0, 0) * 0.3 + ny * side * 110 - 80,
      angle: o.angle || 0,
      spin: side * rand(2, 4),
      cut: ang - (o.angle || 0),
      side,
      r: o.r,
      type: sliceType(o),
      id: o.id,
      col: sliceColor(o),
      life: 1.3
    });
  if (mini.sliceHalves.length > 40) mini.sliceHalves.splice(0, 2);
}

// ---- Update ----

function updateSlice(dt) {
  const tier = SLICE_TIERS[mini.tier];
  while (mini.sliceOopsQueue.length) {
    miniOops(mini.sliceOopsQueue.shift());
    if (mini.screen !== 'play') return;
  }
  mini.fever = Math.max(0, mini.fever - dt);
  mini.sliceFrenzy = Math.max(0, mini.sliceFrenzy - dt);
  const step = dt * (mini.fever > 0 || mini.slow > 0 ? 0.55 : 1);
  if (mini.sliceFrenzy > 0) {
    mini.sliceFrenzyClock -= dt;
    if (mini.sliceFrenzyClock <= 0 && mini.limit - mini.phaseTime > 2.6) {
      spawnGelWave();
      mini.sliceFrenzyClock = 0.5;
    }
  } else {
    mini.spawn -= dt;
    if (mini.spawn <= 0 && mini.limit - mini.phaseTime > 2.6) {
      spawnGelWave();
      mini.spawn = (tier.interval - mini.shift * 0.2) / mini.rules.mini;
    }
  }
  for (const q of mini.sliceQueue) {
    q.delay -= step;
    if (q.delay <= 0) mini.gels.push(q.gel);
  }
  mini.sliceQueue = mini.sliceQueue.filter(q => q.delay > 0);
  for (const o of mini.gels) {
    o.vy += SLICE_G * step;
    o.x += o.vx * step;
    o.y += o.vy * step;
    o.angle += o.spin * step;
    if (o.wrong) o.wrong = Math.max(0, o.wrong - dt);
    if (o.y < 580) o.entered = true;
    if (o.flicked) {
      if (o.y < -50) o.dead = true;
      continue;
    }
    if (o.bomb && o.lit) {
      o.fuseLeft -= step;
      if (o.fuseLeft <= 0) {
        // Burnt-out fuses pop harmlessly but splatter the screen.
        o.dead = true;
        if (o.y < 590) {
          arcadeBurst(o.x, o.y, '#ec86b0', 14);
          sliceStain(o.x, o.y, 40, '#ec86b0');
          sfx('squelch');
        }
        continue;
      }
    }
    if (o.y > 680 && o.entered) {
      o.dead = true;
      if (o.gold) slicePop('GOLD GOT AWAY', clamp(o.x, 90, 510), 540, '#f3cf6e');
      else if (!o.bomb && !o.frenzy) sliceEscape(o);
    }
    if (o.x < 25 || o.x > 575) {
      o.x = clamp(o.x, 25, 575);
      o.vx *= -0.8;
    }
  }
  mini.gels = mini.gels.filter(o => !o.dead);
  for (const h of mini.sliceHalves) {
    h.vy += SLICE_G * step;
    h.x += h.vx * step;
    h.y += h.vy * step;
    h.angle += h.spin * step;
    h.life -= dt;
  }
  mini.sliceHalves = mini.sliceHalves.filter(h => h.life > 0 && h.y < 700);
  for (const s of mini.sliceStains) s.life -= dt;
  mini.sliceStains = mini.sliceStains.filter(s => s.life > 0);
  for (const p of mini.slicePops) {
    p.life -= dt;
    p.y -= 30 * dt;
  }
  mini.slicePops = mini.slicePops.filter(p => p.life > 0);
}

// ---- Art ----

function sliceHash(n) {
  const s = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
}

function sliceStainArt(g, x, y, r, col, alpha, seed) {
  g.globalAlpha = alpha;
  ellipse(g, x, y, r, r * 0.82, col);
  for (let k = 0; k < 6; k++) {
    const a = sliceHash(seed + k) * Math.PI * 2,
      d = r * (0.8 + sliceHash(seed + k + 9) * 0.9),
      s = r * (0.12 + sliceHash(seed + k + 20) * 0.22);
    ellipse(g, x + Math.cos(a) * d, y + Math.sin(a) * d, s, s, col);
  }
  g.globalAlpha = 1;
}

function drawSlice(g) {
  const hot = mini.fever > 0 || mini.sliceFrenzy > 0;
  ellipse(g, 300, 332, 257, 257, mini.sliceFrenzy > 0 ? '#2b3418' : '#0b313d');
  g.save();
  g.beginPath();
  g.arc(300, 332, 255, 0, Math.PI * 2);
  g.clip();
  for (const s of mini.sliceStains) sliceStainArt(g, s.x, s.y, s.r, s.col, (s.life / s.max) * 0.45, s.seed);
  // Sonar sweep.
  const sweep = mini.total * 1.4;
  path(
    g,
    p => {
      p.moveTo(300, 332);
      p.arc(300, 332, 260, sweep - 0.35, sweep);
      p.closePath();
    },
    '#8fe0c018'
  );
  g.restore();
  for (let r = 1; r <= 4; r++) {
    g.strokeStyle = '#77bba527';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(300, 332, r * 60, 0, Math.PI * 2);
    g.stroke();
  }
  line(g, [[300, 65], [300, 590]], '#a6e0bf18', 1);
  line(g, [[30, 332], [570, 332]], '#a6e0bf18', 1);
  for (const h of mini.sliceHalves) sliceDrawHalf(g, h);
  for (const o of mini.gels) sliceDrawGel(g, o);
  sliceDrawTrail(g);
  for (const o of mini.gels) if (o.hint && o.y < 560) sliceCallout(g, o.x, o.y - o.r - 34, o.hint);
  for (const p of mini.slicePops) {
    g.globalAlpha = clamp(p.life * 2, 0, 1);
    label(g, p.text, p.x, p.y, 15, p.col, 'center');
  }
  g.globalAlpha = 1;
  if (hot) {
    const v = g.createRadialGradient(300, 320, 190, 300, 320, 440);
    v.addColorStop(0, '#00000000');
    v.addColorStop(1, mini.sliceFrenzy > 0 ? '#f4c450aa' : '#e0a24a88');
    g.fillStyle = v;
    g.fillRect(0, 40, 600, 560);
  }
  rr(g, 170, 567, 260, 9, 4, '#31575b');
  rr(
    g,
    170,
    567,
    260 *
      (mini.sliceFrenzy > 0
        ? mini.sliceFrenzy / SLICE_FRENZY
        : mini.fever > 0
          ? mini.fever / 4
          : Math.min(1, mini.feverMeter / SLICE_FEVER_AT)),
    9,
    4,
    mini.sliceFrenzy > 0 ? '#ffd86a' : mini.fever > 0 ? '#f1ce7e' : '#9dd8b6'
  );
  label(
    g,
    mini.sliceFrenzy > 0
      ? 'GOLD FRENZY · NO BOMBS · DOUBLE POINTS'
      : mini.fever > 0
        ? 'GEL FEVER · DOUBLE POINTS'
        : '3+ PER SWIPE BUILDS GEL FEVER',
    300,
    593,
    11,
    '#d7e6c9',
    'center'
  );
  const limit = SLICE_TIERS[mini.tier].escapes[mini.shift];
  label(
    g,
    'ESCAPED ' + mini.sliceEscapes + ' / ' + limit,
    576,
    55,
    11,
    mini.sliceEscapes >= limit - 1 ? '#ffb0a8' : '#b8d9c9',
    'right'
  );
}

function sliceDrawGel(g, o) {
  g.save();
  g.translate(o.x, o.y);
  if (o.gold) {
    glow(g, 0, -4, 52, '#ffe29a55');
    for (let k = 0; k < 3; k++) {
      const a = mini.total * 3 + (k * Math.PI * 2) / 3;
      spark(g, Math.cos(a) * 34, Math.sin(a) * 34 - 6, '#fff3c0', 0.45);
    }
  }
  g.rotate(o.angle);
  if (o.bomb) {
    glow(g, 0, 0, 43, '#ef7dba24');
    ellipse(g, 0, 0, o.r, o.r, gradient(g, -22, -22, 44, 44, '#f2b1cf', '#bd507e'));
    label(g, '×', 0, 13, 40, '#612443', 'center');
    const k = o.lit ? clamp(o.fuseLeft / o.fuse, 0, 1) : 0.45,
      tipX = 13 + 12 * k,
      tipY = -22 - 16 * k;
    line(g, [[10, -20], [tipX, tipY]], '#d7c7a6', 3);
    if (o.lit && !o.flicked) {
      glow(g, tipX, tipY, 14, '#ffd39caa');
      spark(g, tipX, tipY, '#ffe9b0', 0.45 + 0.2 * Math.sin(mini.total * 30));
    }
  } else {
    if (o.wrong) g.globalAlpha = 0.55 + 0.45 * Math.sin(mini.total * 40);
    gremlin(g, 0, 24, o.r / 23, sliceType(o), mini.total + o.id);
    g.globalAlpha = 1;
    if (o.armor) {
      rr(g, -25, -32, 50, 20, 9, gradient(g, -20, -32, 40, 20, '#e7ecdf', '#8eabbc'), '#d8ebdf', 2);
      line(g, [[-15, -25], [15, -25]], '#65848e', 2);
    }
  }
  g.restore();
  // Arrow gremlins: a dashed cut guide through the body, arrowhead outside it.
  if (o.dir !== undefined) {
    const col = o.wrong ? '#ff9a9a' : '#fff1c0',
      reach = o.r + 16;
    g.save();
    g.translate(o.x, o.y - 8);
    g.rotate(o.dir);
    g.setLineDash([7, 6]);
    line(g, [[-reach, 0], [reach - 6, 0]], '#103a44', 6);
    line(g, [[-reach, 0], [reach - 6, 0]], col, 3);
    g.setLineDash([]);
    poly(g, [[reach + 12, 0], [reach - 4, -11], [reach - 4, 11]], '#103a44');
    poly(g, [[reach + 8, 0], [reach - 2, -7], [reach - 2, 7]], col);
    g.restore();
  }
  if (o.num) {
    const set = mini.sliceSets[o.set],
      next = set && !set.broken && set.next === o.num;
    ellipse(g, o.x, o.y - o.r - 12, 13, 13, next ? '#ffd28a' : '#e9e2c8');
    label(g, String(o.num), o.x, o.y - o.r - 6, 17, '#3b2f3f', 'center');
  }
}

function sliceDrawHalf(g, h) {
  g.globalAlpha = clamp(h.life / 0.5, 0, 1);
  g.save();
  g.translate(h.x, h.y);
  g.rotate(h.angle);
  g.save();
  g.rotate(h.cut);
  g.beginPath();
  g.rect(-70, h.side > 0 ? 0 : -70, 140, 70);
  g.clip();
  g.rotate(-h.cut);
  gremlin(g, 0, 24, h.r / 23, h.type, h.id);
  g.restore();
  g.rotate(h.cut);
  line(g, [[-h.r * 0.75, 0], [h.r * 0.75, 0]], h.col, 4);
  g.restore();
  g.globalAlpha = 1;
}

function sliceDrawTrail(g) {
  const pts = mini.trail,
    hot = mini.fever > 0 || mini.sliceFrenzy > 0;
  if (pts.length < 2) return;
  g.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if (a.stroke !== b.stroke) continue;
    const k = clamp(b.life / 0.23, 0, 1);
    g.globalAlpha = k;
    line(g, [[a.x, a.y], [b.x, b.y]], hot ? '#ffe8a0' : '#b5edd8', 3 + 11 * k);
    line(g, [[a.x, a.y], [b.x, b.y]], '#fffae8', 1 + 3 * k);
  }
  g.globalAlpha = 1;
  const tip = pts[pts.length - 1];
  if (mini.pointer && tip.stroke === mini.pointer.stroke) {
    glow(g, tip.x, tip.y, 26, '#ffffff88');
    g.save();
    g.translate(tip.x, tip.y);
    g.rotate(mini.total * 9);
    spark(g, 0, 0, '#ffffff', 0.9);
    g.restore();
  }
}

function sliceCallout(g, x, y, text) {
  const w = Math.max(120, text.length * 7.6),
    cx = clamp(x, 20 + w / 2, 580 - w / 2),
    top = Math.max(62, y - 20);
  rr(g, cx - w / 2, top, w, 26, 10, '#102c42ee', '#ffe1a0', 1.5);
  label(g, text, cx, top + 18, 12, '#ffe7b8', 'center');
}
