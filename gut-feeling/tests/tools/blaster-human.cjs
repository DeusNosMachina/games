// Not part of the suite. A human-speed yardstick for Bedside Blaster: a player who sees the room a
// quarter second late and taps about a quarter second after something changes (a few hundredths more
// for a long reach). They pick the most urgent gremlin in view (a leaper, a closing orange ring, a
// crawler, pink eyes sooner, a peeking head, Ralph Jr.'s open mouth), lead crawlers by eye with a speed
// they misjudge by about a fifth (never past the furniture a gremlin is climbing onto), and tap at the
// head with a fingertip's scatter that grows with the reach. They do not see a shot land until the delay
// catches up, so a gremlin they just shot is left alone for a beat, except armor, which gets a quick
// double tap. They stay with what is in view and swipe toward an edge arrow when it turns red or the
// view goes quiet. They reload late: when the magazine runs dry, or with one charge left and nothing
// to shoot, and press for the green on a slightly late, shaky thumb. Juice gets shot when charges run
// low. No charged shots, and no assists unless ASSIST=1. The bot wins everything by design; this says
// whether a person can.
// Usage from the repository root (reaction s, trials per level, prescription 0-2):
//   node gut-feeling/tests/tools/blaster-human.cjs 0.25 40 1
// Targets: at 0.25 s, level 1 nearly always, level 2 most of the time, level 3 sometimes, Legendary
// about one time in four; a 0.35 s player still clears level 1. Read each level's line: wins,
// evictions against the quota, faces gotten against the allowance, accuracy, headshots, hot reloads,
// Ralph Jr. evictions, the medal spread of the wins, and how the losses went (evictions/faces).
// ONLY=3 runs one level (0-3). PATCH='BLASTER_GOALS[3]=40' runs code in the page first, for trying a
// tuning without a rebuild. DEBUG=1 prints every run.
const { run, close } = require('../harness.cjs');
const REACT = +process.argv[2] || 0.25,
  TRIALS = +process.argv[3] || 40,
  DIFF = process.argv[4] === undefined ? 1 : +process.argv[4],
  ONLY = process.env.ONLY,
  ASSIST = !!process.env.ASSIST;
if (process.env.PATCH) run(process.env.PATCH);
run(`
var hu = null;
function huReset(seed) {
  let s = seed >>> 0;
  hu = { hist: [], plan: null, busy: 0, sent: {}, taps: {}, finger: { x: 300, y: 430 }, reloadAt: -1,
    rnd: () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
  hu.gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += hu.rnd(); return (u - 3) / Math.sqrt(0.5); };
}
// What the eye holds: every live target's state at one moment. Projection uses the camera of now (the
// player knows where they have looked; they only see the gremlins late).
function huSnap() {
  return { t: mini.total, list: mini.targets.filter(e => !e.dead && e.mode !== 'dying').map(e => ({
    id: e.id, kind: e.kind, mode: e.mode, x: e.x, y: e.y, r: e.r, s: e.s, leap: e.leap || 0, leapDuration: e.leapDuration,
    dropT: e.dropT, wind: e.wind, windMax: e.windMax, peek: e.peek, crawlT: e.crawlT, creepDur: e.creepDur, hp: e.hp,
    top: e.home ? { x: e.home.x + e.peekOff.x, y: e.home.y + e.peekOff.y } : null })) };
}
function huUrgency(o) {
  if (o.kind === 'boss') return o.mode === 'roar' || o.mode === 'lunge' ? 5 : -1;
  if (o.mode === 'leap') return 6 + o.leap / o.leapDuration;
  if (o.mode === 'wind') return 4 + (1 - o.wind / o.windMax);
  if (o.mode === 'crawl') return 2 + o.crawlT / o.creepDur + (o.kind === 'pouncer' ? 0.6 : 0);
  if (o.mode === 'hide' && o.peek > 0.8) return 1;
  return -1;
}
function huTick(R, assist) {
  const now = mini.total;
  hu.hist.push(huSnap());
  while (hu.hist.length > 2 && hu.hist[1].t <= now - R - 0.12) hu.hist.shift();
  let i = hu.hist.length - 1;
  while (i > 0 && hu.hist[i].t > now - R) i--;
  const seen = hu.hist[i], before = hu.hist[0], span = Math.max(0.016, seen.t - before.t);
  // The reload: a predictable bar, so no reaction delay, just a late and shaky thumb.
  if (mini.reload > 0) {
    if (hu.reloadAt < 0) {
      const [a, b] = blasterReloadWindow();
      hu.reloadAt = now - mini.reloadT + (a + b) / 2 + 0.04 + hu.gauss() * 0.07;
      hu.plan = null;
    }
    if (!mini.reloadTry && now >= hu.reloadAt) miniAction('reload');
    return;
  }
  hu.reloadAt = -1;
  if (hu.plan) {
    if (now < hu.plan.at) return;
    const P = hu.plan;
    hu.plan = null;
    if (P.drag) {
      arcadeDown({ x: 300, y: 300 });
      arcadeMove({ x: 300 + P.dx, y: 300 + P.dy });
      arcadeUp();
      hu.busy = now + 0.08 + Math.abs(P.dx) / 2400;
      return;
    }
    arcadeDown({ x: P.x, y: P.y });
    arcadeUp();
    hu.finger = { x: P.x, y: P.y };
    // Armor gets a quick double tap; otherwise wait to see the shot land before going again.
    hu.taps[P.id] = (hu.taps[P.id] || 0) + 1;
    hu.sent[P.id] = P.hp >= 2 && hu.taps[P.id] % 2 ? now + 0.02 : now + R + 0.15;
    hu.busy = now + 0.04;
    return;
  }
  if (now < hu.busy) return;
  const on = p => p.x > 12 && p.x < 588 && p.y > 40 && p.y < 588;
  const cands = [];
  for (const o of seen.list) {
    if ((hu.sent[o.id] || 0) > now) continue;
    const p = blasterProjectAt(o, o.leap);
    if (o.kind === 'bottle') {
      if (on(p) && mini.ammo <= 3) cands.push({ o, p, u: mini.ammo <= 1 ? 2.9 : 1.5, on: true });
      continue;
    }
    let u = huUrgency(o);
    if (u < 0) continue;
    const vis = on(p);
    // Off screen: an edge arrow, red when something is about to jump. A person stays with what is in
    // view and turns for a red arrow, or for any arrow once the view is quiet.
    if (!vis) u = o.mode === 'wind' || o.mode === 'leap' ? u - 1.2 : o.mode === 'crawl' ? 0.5 : 0.2;
    cands.push({ o, p, u, on: vis });
  }
  cands.sort((a, b) => b.u - a.u);
  if (assist && mini.helps > 0 && mini.rules.misses - mini.miss <= 2 && cands.some(c => c.on && c.u >= 4.5)) {
    miniAction('assist');
    hu.busy = now + 0.3;
    return;
  }
  const c = cands[0];
  if (!c || (!c.on && mini.ammo <= 1)) {
    if (mini.ammo <= 1) {
      miniAction('reload');
      hu.busy = now + 0.25;
    }
    return;
  }
  const o = c.o, p = c.p, s = p.s;
  if (!c.on) {
    // Swipe toward the arrow, enough to bring the gremlin in from that edge.
    const r = o.r || 1, k = 1 + hu.gauss() * 0.2, goal = p.x < 0 ? 170 : p.x > 600 ? 430 : 300;
    let dx = clamp(((p.x - goal) / r / 1.8) * k, -280, 280),
      dy = p.y < 40 || p.y > 588 ? clamp(((p.y - 300) / r / 1.1) * k, -200, 200) : 0;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) dx = p.x < 300 ? -20 : 20;
    hu.plan = { drag: true, at: now + 0.1, dx, dy };
    return;
  }
  // A peeking head gets a tap where it pops up and a crouched one where it sits; a crawler gets led by
  // its seen speed, but not past the furniture it is climbing onto.
  const old = before.list.find(q => q.id === o.id), peeking = o.mode === 'hide',
    still = peeking || o.mode === 'wind' || !old,
    p0 = still ? p : blasterProjectAt(old, old.leap),
    vx = (p.x - p0.x) / span, vy = (p.y - p0.y) / span,
    left = o.mode === 'crawl' ? Math.max(0, o.creepDur - o.crawlT) : 9;
  if (peeking) Object.assign(p, blasterProjectAt({ ...o, x: o.top.x, y: o.top.y }, 0));
  const head = o.kind === 'bottle' ? { x: p.x, y: p.y } : o.kind === 'boss' ? { x: p.x + 2 * s, y: p.y + 17 * s } : { x: p.x + s, y: p.y + 2 * s },
    d = Math.hypot(head.x - hu.finger.x, head.y - hu.finger.y),
    reach = 0.01 + 0.012 * Math.log2(1 + d / 30),
    lead = Math.min(left, R + reach + BLASTER_SWEEP) * (1 + hu.gauss() * 0.25),
    sigma = 7 + d * 0.02;
  hu.plan = { id: o.id, hp: o.hp, at: now + reach,
    x: clamp(head.x + vx * lead + hu.gauss() * sigma, 0, 600), y: clamp(head.y + vy * lead + hu.gauss() * sigma, 0, 600) };
}
function huRun(tier, diff, react, seed, assist) {
  let s = (seed * 2654435761) >>> 0;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  state.difficulty = diff; openMini(5); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  huReset(seed);
  let n = 0;
  while (mini.screen === 'play' && n++ < 60000) { huTick(react, assist); updateMini(0.016); }
  const win = !!(mini.pendingFinish && mini.pendingFinish.win);
  return { win, got: mini.got, goal: mini.goal, miss: mini.miss, allow: mini.rules.misses, t: Math.round(mini.phaseTime),
    cause: win ? 'win' : mini.miss >= mini.rules.misses ? 'faces' : 'quota', fired: mini.shotsFired, hit: mini.shotsHit,
    heads: mini.headshots, reloads: mini.reloads, hot: mini.cleanReloads, boss: mini.bossDown || false, q: win ? BLASTER.quality() : 0 };
}`);
for (const tier of ONLY ? [+ONLY] : [0, 1, 2, 3]) {
  if (tier >= run('miniTierCount(games[5])')) continue;
  const runs = [];
  for (let i = 0; i < TRIALS; i++) {
    close();
    const r = run(`huRun(${tier}, ${DIFF}, ${REACT}, ${1000 + i * 7919}, ${ASSIST})`);
    if (process.env.DEBUG) console.log(JSON.stringify(r));
    runs.push(r);
  }
  const won = runs.filter(r => r.win),
    medals = [0, 0, 0];
  for (const r of won) medals[r.q >= 88 ? 2 : r.q >= 68 ? 1 : 0]++;
  const avg = (a, k) => (a.length ? a.reduce((t, r) => t + r[k], 0) / a.length : 0),
    pct = (a, b) => ((100 * avg(runs, a)) / Math.max(1, avg(runs, b))).toFixed(0) + '%';
  console.log(
    `L${tier + 1} P${DIFF} react ${REACT}: won ${won.length}/${runs.length} · evicted ${avg(runs, 'got').toFixed(1)}/${runs[0].goal}` +
      ` · faces ${avg(runs, 'miss').toFixed(1)}/${runs[0].allow} · hit ${pct('hit', 'fired')} · heads ${pct('heads', 'hit')}` +
      ` · hot reloads ${pct('hot', 'reloads')}${tier >= 2 ? ' · Ralph down ' + runs.filter(r => r.boss).length : ''}` +
      ` · medals b/s/g ${medals.join('/')}` +
      ` · lost at ${JSON.stringify(runs.filter(r => !r.win).map(r => r.got + '/' + r.miss))}`
  );
}
