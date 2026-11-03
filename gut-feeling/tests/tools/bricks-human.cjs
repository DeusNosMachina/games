// Not part of the suite. A human-speed yardstick for Brick Rebellion: a player who sees the world a
// quarter second late and slides a thumb toward where the falling softball will land. They read wall
// bounces but not brick bounces (those they only see once the delay catches up), miss by a few pixels
// more for every wall bounce they have to read, pause before serving, grab pills when nothing is
// falling, sidestep goo, and fire pillows at stragglers. They only center the tray under the ball, never
// aim with its edges, and use no assists unless ASSIST=1. The bot wins everything by design; this says
// whether a person can. Usage from the repository root (reaction s, trials, prescription 0-2):
//   node gut-feeling/tests/tools/bricks-human.cjs 0.25 30 1
// Targets: at 0.25 s, level 1 nearly always, level 2 most of the time, level 3 sometimes; a 0.35 s
// player still clears level 1. Read each level's line: wins, seconds per win, softballs dropped, how
// the losses happened (and with how many bricks left in which rack), and the medal spread of the wins.
// ONLY=2 runs one level (0-2). PATCH='BRICKS_LEVELS[0].speed=320' runs code in the page first, for
// trying a tuning without a rebuild.
const { run, close } = require('../harness.cjs');
const REACT = +process.argv[2] || 0.25,
  TRIALS = +process.argv[3] || 30,
  DIFF = +(process.argv[4] ?? 1),
  ONLY = process.env.ONLY,
  ASSIST = !!process.env.ASSIST;
if (process.env.PATCH) run(process.env.PATCH);
run('let rng=12345;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`
var human = null;
function humanReset(seed) {
  let s = seed >>> 0;
  human = { hist: [], finger: null, err: 0, key: '', tapAt: 0, fireAt: 0,
    rnd: () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
  human.gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += human.rnd(); return (u - 3) / Math.sqrt(0.5); };
}
// One tick of a person: look at the world as it was REACT seconds ago, then move the thumb.
function humanTick(react, dt, assist) {
  const B = mini.br, f = bricksFrame(), t = B.tray, R = BRICKS_R, lo = BRICKS_WALL + R, hi = BRICKS_FW - BRICKS_WALL - R, now = mini.total;
  human.hist.push({ now, balls: B.balls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, stuck: b.stuck !== null })),
    pills: B.pills.map(p => ({ kind: p.kind, x: p.x, y: p.y, vy: p.vy })), goo: B.goo.map(o => ({ x: o.x, y: o.y, vx: o.vx, vy: o.vy })),
    bricks: B.bricks.filter(b => b.hp > 0).map(b => ({ x: b.x, w: b.w, kind: b.kind, guarded: b.kind === 'boss' && bricksGuarded(b) })) });
  while (human.hist.length > 2 && human.hist[1].now <= now - react) human.hist.shift();
  const v = human.hist[0], age = now - v.now;
  if (human.finger === null) human.finger = t.x;
  const span = hi - lo, fold = x => { let u = (x - lo) % (2 * span); if (u < 0) u += 2 * span; return u <= span ? lo + u : lo + 2 * span - u; };
  // Landing x and time (from now) of a ball seen 'age' seconds ago; walls and ceiling only.
  const land = b => {
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy, time = -age, walls = 0;
    if (vy < 0) { const tc = (y - BRICKS_CEIL - R) / -vy; time += tc; x += vx * tc; y = BRICKS_CEIL + R; vy = -vy; }
    const td = Math.max(0, BRICKS_TRAY_Y - R - y) / (vy || 1); time += td; x += vx * td;
    walls = Math.floor(Math.abs((x - lo) / span));
    return { x: fold(x), time, walls, key: b.id + ':' + Math.sign(b.vx) + ':' + Math.sign(b.vy) };
  };
  const seen = v.balls.filter(b => !b.stuck).map(b => ({ b, ...land(b) }));
  const down = seen.filter(o => o.b.vy > 0 && o.time > -0.1).sort((a, b) => a.time - b.time);
  const next = down[0] || seen.sort((a, b) => a.time - b.time)[0];
  let target = human.finger;
  if (next) {
    if (human.key !== next.key) { human.key = next.key; human.err = human.gauss() * (8 + 7 * next.walls); }
    target = next.x + human.err;
    const pill = v.pills.filter(p => p.kind !== 'goo').map(p => ({ p, time: (BRICKS_TRAY_Y - p.y) / p.vy - age }))
      .filter(o => o.time > 0.15 && o.time < next.time - 0.4).sort((a, b) => a.time - b.time)[0];
    if (pill && next.time > 1) target = pill.p.x;
  }
  for (const o of [...v.goo, ...v.pills.filter(p => p.kind === 'goo')]) {
    const time = (BRICKS_TRAY_Y - o.y) / o.vy - age, gx = o.x + (o.vx || 0) * (time + age);
    if (time < 0 || time > 0.5 || Math.abs(gx - target) > t.w / 2 + 12) continue;
    const moved = gx + (gx < target ? 1 : -1) * (t.w / 2 + 16);
    if (!next || next.time > 0.6 || Math.abs(next.x - moved) < t.w / 2 - 6) target = moved;
  }
  // The thumb chases the target with a short lag and a top speed.
  const want = human.finger + (target - human.finger) * Math.min(1, dt / 0.06);
  human.finger += clamp(want - human.finger, -1700 * dt, 1700 * dt);
  const p = { x: clamp(human.finger, 0, BRICKS_FW) + f.x, y: BRICKS_TRAY_Y + 40 + f.y };
  if (!mini.pointer) { arcadeDown(p); human.tapAt = now + 0.45; }
  else arcadeMove(p);
  if (bricksHolding()) {
    if (!human.tapAt) human.tapAt = now + 0.45;
    if (now >= human.tapAt) { arcadeUp(); arcadeDown(p); human.tapAt = 0; }
  } else human.tapAt = 0;
  if (B.pillows > 0 && now >= human.fireAt && v.bricks.length <= 6 && v.bricks.some(b => t.x > b.x && t.x < b.x + b.w && !b.guarded)) {
    miniAction('pillow'); human.fireAt = now + 0.4;
  }
  if (assist && mini.helps > 0 && B.net <= 0 && mini.rules.misses - mini.miss <= 1) miniAction('assist');
}
function humanRun(tier, diff, react, seed, assist) {
  state.difficulty = diff; openMini(2); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  humanReset(seed);
  let n = 0;
  while (mini.screen === 'play' && n++ < 60000) { humanTick(react, 0.016, assist); updateMini(0.016); }
  const B = mini.br, win = !!(mini.pendingFinish && mini.pendingFinish.win), reason = mini.pendingFinish && mini.pendingFinish.reason;
  const q = win ? BRICKS.quality() : 0;
  return { win, t: mini.phaseTime, drops: B.drops, line: B.lineHits, rack: B.rack, left: bricksLeft(), cause: win ? 'win' : reason && reason.includes('lounge') ? 'time' : 'softballs', q, combo: mini.maxCombo };
}`);
for (const tier of ONLY ? [+ONLY] : [0, 1, 2]) {
  const runs = [];
  for (let i = 0; i < TRIALS; i++) {
    close();
    runs.push(run(`humanRun(${tier}, ${DIFF}, ${REACT}, ${1000 + i * 7919}, ${ASSIST})`));
  }
  const won = runs.filter(r => r.win),
    causes = {},
    medals = [0, 0, 0];
  for (const r of runs) causes[r.cause] = (causes[r.cause] || 0) + 1;
  for (const r of won) medals[r.q >= 88 ? 2 : r.q >= 68 ? 1 : 0]++;
  const avg = (a, k) => (a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : 0);
  console.log(
    'L' + (tier + 1), 'P' + DIFF, 'react', REACT, 'won', won.length, '/', runs.length,
    'win s', avg(won, 't').toFixed(0), 'drops', avg(runs, 'drops').toFixed(1), 'line', avg(runs, 'line').toFixed(1),
    'best chain', avg(runs, 'combo').toFixed(0), 'medals b/s/g', medals.join('/'), JSON.stringify(causes),
    'lost at rack', JSON.stringify(runs.filter(r => !r.win).map(r => r.rack + 1 + ':' + r.left))
  );
}
