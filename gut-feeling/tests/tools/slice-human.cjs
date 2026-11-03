// Not part of the suite. A human-speed yardstick for Gel Yeah!: a player who sees the sonar screen a
// quarter second late, swipes one stroke at a time along slightly bowed, shaky lines at finger speed,
// aims where a gremlin will be (with an error that grows with its speed), lifts and moves the finger
// between strokes, and only notices a hazard (pink bomb or purple gas) once it has been on screen for a
// beat. Under laughing-gas fog it aims two and a half times worse. It never reads text: helmets get
// swiped again because they are still there, and the jumbo gets scribbled on because it keeps counting.
// The bot wins everything by design; this says whether a person can.
// Targets: level 1 nearly always (and still at 0.35 s), level 2 most of the time, level 3 sometimes,
// Legendary about one time in four, all at 0.25 s on prescription 1.
// Usage from the repository root (reaction s, trials, prescription 0-2):
//   node gut-feeling/tests/tools/slice-human.cjs 0.25 40 1
// ONLY=0 runs one level (0-3). PORTRAIT=1 plays on the 450 × 800 canvas. NAIVE=1 ignores gold and
// swipes the jumbo like any other gremlin (no scribbling), to check the game still works for a player
// who never figured those out. Read the per-level line: wins, average sliced against the quota, oops
// causes, gas pops, best swipe, combos per run, and the medal split of the wins.
const { run, close } = require('../harness.cjs');
const REACT = +process.argv[2] || 0.25,
  TRIALS = +process.argv[3] || 40,
  DIFF = process.argv[4] === undefined ? 1 : +process.argv[4],
  ONLY = process.env.ONLY,
  NAIVE = !!process.env.NAIVE,
  PORTRAIT = !!process.env.PORTRAIT;
// TUNE='SLICE_TIERS[2].speed=1.1' runs page code before the trials, for trying numbers without a rebuild.
if (process.env.TUNE) run(process.env.TUNE);

run(`
function humanTrial(tier, diff, react, seed, naive, portrait) {
  let s = seed >>> 0;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let hs = (seed * 7919 + 17) >>> 0;
  const hr = () => { hs = (hs * 22695477 + 1) >>> 0; return hs / 4294967296; };
  const gauss = () => { let a = 0; for (let i = 0; i < 4; i++) a += hr(); return (a - 2) * 1.73; };
  mini.open = false; mini.screen = 'lobby';
  if (portrait) { window.innerWidth = 390; window.innerHeight = 844; } else { delete window.innerWidth; delete window.innerHeight; }
  state.difficulty = diff; openMini(4); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  const DT = 1 / 60, BOMB_NOTICE = 0.2, hist = [], firstSeen = {}, causes = {};
  let H = { mode: 'rest', until: 0.15, fx: activeCanvas().w / 2, fy: activeCanvas().h * 0.8 }, strokes = 0, n = 0;
  while (mini.screen === 'play' && n++ < 30000) {
    const now = mini.total, A = sliceArena();
    const rate = sliceRate();
    hist.push({ t: now, rate, G: A.G, fog: mini.sliceFog > 0, gels: mini.gels.filter(o => !o.dead && !o.blown).map(o => ({ id: o.id, kind: o.kind,
      x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, r: o.r, hover: o.hover, grav: o.grav || 1, hazard: !!SLICE_KINDS[o.kind].hazard })) });
    while (hist.length > 2 && hist[1].t <= now - react - 0.6) hist.shift();
    for (const o of hist[hist.length - 1].gels) if (firstSeen[o.id] === undefined && o.y < A.H) firstSeen[o.id] = now;
    if (H.mode === 'stroke') {
      H.d += H.v * DT;
      const u = Math.min(1, H.d / H.len), p = H.at(u);
      arcadeMove(p);
      H.fx = p.x; H.fy = p.y;
      if (u >= 1) {
        arcadeUp();
        H.mode = 'rest';
        H.until = now + 0.08 + hr() * 0.08;
      }
    } else if (H.mode === 'rest' && now >= H.until) {
      let view = null;
      for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= now - react) { view = hist[i]; break; }
      const plan = view && humanPlan(view, now, H, naive, firstSeen, hr, gauss, BOMB_NOTICE, A);
      if (plan) H = { ...H, ...plan, mode: 'approach', until: now + plan.approach };
      else H.until = now + 0.05;
    }
    if (H.mode === 'approach' && now >= H.until) {
      H.mode = 'stroke'; H.d = 0; strokes++;
      arcadeDown(H.at(0));
    }
    const before = mini.miss;
    updateMini(DT);
    if (mini.miss > before) {
      const why = /BOMB/.test(mini.flashText) ? 'bomb' : /DROPPED/.test(mini.flashText) ? 'drops' : mini.flashText;
      causes[why] = (causes[why] || 0) + 1;
    }
  }
  if (mini.pointer) arcadeUp(true);
  const won = mini.screen === 'outro' ? !!mini.pendingFinish.win : false;
  const quality = won ? SLICE.quality() : 0;
  delete window.innerWidth; delete window.innerHeight;
  return { won, got: mini.got, goal: mini.goal, miss: mini.miss, misses: mini.rules.misses, t: +mini.phaseTime.toFixed(1),
    causes, strokes, gas: mini.sliceGas, best: mini.maxCombo, combos: mini.sliceCombos, frenzies: mini.sliceFrenzies, jumbo: mini.sliceJumboHits,
    dropped: mini.sliceDropped, score: mini.score, medal: won ? (quality >= 88 ? 3 : quality >= 68 ? 2 : 1) : 0 };
}

// One stroke: the line through the most gremlins the player can see, timed to where they will be.
function humanPlan(view, now, H, naive, firstSeen, hr, gauss, notice, A) {
  const lag = now - view.t, V = 1700 * (0.85 + hr() * 0.3), k = view.rate, G = view.G;
  const gels = view.gels.filter(o => o.y < A.H - 15 && o.y > 40 && o.x > 15 && o.x < A.W - 15);
  const bombs = gels.filter(o => o.hazard && firstSeen[o.id] !== undefined && view.t - firstSeen[o.id] >= notice);
  const targets = gels.filter(o => !o.hazard);
  if (!targets.length) return null;
  const at = (o, t) => (o.hover > 0 ? { x: o.x, y: o.y } : { x: o.x + o.vx * k * t, y: o.y + o.vy * k * t + 0.5 * G * o.grav * k * k * t * t });
  // Perception noise per gremlin for this plan, bigger for fast movers and in the fog.
  const err = {}, fog = view.fog ? 2.5 : 1;
  for (const o of gels) {
    const sp = Math.hypot(o.vx, o.vy) * k, e = (4 + sp * 0.03) * fog;
    err[o.id] = { x: gauss() * e, y: gauss() * e };
  }
  const guess = (o, t) => { const p = at(o, t); return { x: p.x + err[o.id].x, y: p.y + err[o.id].y }; };
  const shaky = (pts, approach) => {
    // A slightly bowed, shaky polyline, walked at finger speed.
    const segs = [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); len += d; }
    const bow = gauss() * 9, ph = hr() * 6, a = pts[0], b = pts[pts.length - 1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
    return { approach, v: V, len, at: u => {
      let left = u * len, i = 0;
      while (i < segs.length - 1 && left > segs[i]) { left -= segs[i]; i++; }
      const f = segs[i] ? clamp(left / segs[i], 0, 1) : 1, off = bow * Math.sin(Math.PI * u) + 2.5 * Math.sin(ph + u * 9);
      return { x: clamp(pts[i].x + (pts[i + 1].x - pts[i].x) * f + nx * off, 0, A.W), y: clamp(pts[i].y + (pts[i + 1].y - pts[i].y) * f + ny * off, 0, A.H) };
    } };
  };
  // The jumbo: scribble across it while it hangs there.
  const jumbo = targets.find(o => o.kind === 'jumbo' && (o.hover > 0.3 || (o.hover === undefined && o.y < A.H * 0.6 && Math.abs(o.vy * k) < 260)));
  if (jumbo && !naive) {
    const c = guess(jumbo, lag + 0.15), w = jumbo.r * 0.85, pts = [];
    for (let i = 0; i < 7; i++) pts.push({ x: c.x + (i % 2 ? w : -w), y: c.y - 30 + i * 10 });
    return shaky(pts, 0.05 + Math.hypot(pts[0].x - H.fx, pts[0].y - H.fy) / 3200);
  }
  const lead = 0.16, cands = [];
  const add = (ax, ay, bx, by) => {
    const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
    cands.push({ ax: ax - ux * 45, ay: ay - uy * 45, bx: bx + ux * 45, by: by + uy * 45 });
  };
  for (const a of targets) {
    const pa = guess(a, lag + lead);
    for (const th of [0, Math.PI, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4, Math.PI / 2, -Math.PI / 2])
      add(pa.x - Math.cos(th) * 30, pa.y - Math.sin(th) * 30, pa.x + Math.cos(th) * 30, pa.y + Math.sin(th) * 30);
    for (const b of targets) {
      if (b === a) continue;
      const pb = guess(b, lag + lead);
      if (Math.hypot(pb.x - pa.x, pb.y - pa.y) < 340) add(pa.x, pa.y, pb.x, pb.y);
    }
  }
  let best = null;
  for (const c of cands) {
    c.ax = clamp(c.ax, 2, A.W - 2); c.bx = clamp(c.bx, 2, A.W - 2); c.ay = clamp(c.ay, 45, A.H - 2); c.by = clamp(c.by, 45, A.H - 2);
    const len = Math.hypot(c.bx - c.ax, c.by - c.ay);
    if (len < 40) continue;
    const approach = 0.05 + Math.hypot(c.ax - H.fx, c.ay - H.fy) / 3200;
    // Where the finger is when it passes each gremlin (two passes refine the timing).
    const pass = o => {
      let t = lag + approach + 0.1;
      for (let i = 0; i < 2; i++) {
        const p = guess(o, t), u = clamp(((p.x - c.ax) * (c.bx - c.ax) + (p.y - c.ay) * (c.by - c.ay)) / (len * len), 0, 1);
        t = lag + approach + (u * len) / V;
      }
      return pointSegment(guess(o, t), { x: c.ax, y: c.ay }, { x: c.bx, y: c.by });
    };
    if (bombs.some(b => pass(b) < b.r + 26)) continue;
    let score = 0, hits = 0;
    for (const o of targets) {
      if (pass(o) > Math.min(o.r, 31) * 0.75) continue;
      hits++;
      const p = at(o, lag + approach);
      score += 10 + (o.kind === 'gold' && !naive ? 12 : 0) + (p.y > A.H * 0.72 && o.vy > 0 ? 5 : 0) + (Math.abs(o.vy * k) < 300 ? 2 : 0);
    }
    if (!hits) continue;
    score -= len * 0.004 + approach * 4;
    if (!best || score > best.score) best = { ...c, score, approach };
  }
  if (!best) return null;
  return shaky([{ x: best.ax, y: best.ay }, { x: best.bx, y: best.by }], best.approach);
}
`);

for (const tier of ONLY !== undefined ? [+ONLY] : [0, 1, 2, 3]) {
  const runs = [],
    causes = {};
  for (let trial = 0; trial < TRIALS; trial++) {
    close();
    const r = run(`humanTrial(${tier}, ${DIFF}, ${REACT}, ${1000 + trial * 7919 + tier * 104729}, ${NAIVE}, ${PORTRAIT})`);
    runs.push(r);
    for (const [k, v] of Object.entries(r.causes)) causes[k] = (causes[k] || 0) + v;
  }
  const avg = f => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1),
    won = runs.filter(r => r.won),
    medals = [1, 2, 3].map(m => won.filter(r => r.medal === m).length).join('/');
  console.log(
    `L${tier + 1} P${DIFF} react ${REACT}${NAIVE ? ' naive' : ''}${PORTRAIT ? ' portrait' : ''}: won ${won.length}/${runs.length}` +
      ` · sliced ${avg(r => r.got)}/${runs[0].goal} (min ${Math.min(...runs.map(r => r.got))})` +
      ` · oops ${avg(r => r.miss)}/${runs[0].misses} ${JSON.stringify(causes)} · gas ${avg(r => r.gas)} · dropped ${avg(r => r.dropped)}` +
      ` · best swipe ${avg(r => r.best)} · combos ${avg(r => r.combos)} · frenzies ${avg(r => r.frenzies)} · jumbo ${avg(r => r.jumbo)}` +
      ` · medals b/s/g ${medals}`
  );
}
