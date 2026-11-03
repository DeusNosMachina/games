// Not part of the suite. A human-speed yardstick for Fastpitch Fever: a player who sees the room a
// reaction time late, takes a moment to pick a gremlin, leads movers by eye (a straight-line guess with
// a misjudged speed), and flicks like a person: the stroke heads roughly up the screen through the spot
// (angle error), ends near it (a fingertip's scatter), comes out a little too hard or too soft (power
// error) and a little long or short (arc error), and takes real time to swipe. Bedpan shields get the
// bank shot the level 2 guide shows, with a shakier hand once the guide is gone. Hidden peekers are
// left alone until they pop up. The bot wins everything by design; this says whether a person can.
// Usage from the repository root (reaction s, trials per level, prescription 0-2):
//   node gut-feeling/tests/tools/pitch-human.cjs 0.25 30 1
// Optional: ONLY=3 (one level), DEBUG=1 (every run), HAND=1.3 (scale every motor error),
// TUNE='{"3":{"goal":38}}' (try level dials without rebuilding).
// A 0.25 s player should clear level 1 nearly always, level 2 most of the time, level 3 sometimes and
// Legendary about one time in four; a 0.35 s player should still clear level 1. Read each line: wins,
// evictions against the quota, oopses, how many throws found something, and banks.
const { run, close } = require('../harness.cjs');
const REACT = +process.argv[2] || 0.25,
  TRIALS = +process.argv[3] || 30,
  DIFF = process.argv[4] === undefined ? 1 : +process.argv[4],
  ONLY = process.env.ONLY,
  HAND = +process.env.HAND || 1;
if (process.env.TUNE)
  for (const [t, dials] of Object.entries(JSON.parse(process.env.TUNE))) run(`Object.assign(PITCH_TIERS[${+t}], ${JSON.stringify(dials)})`);
run(`var hu = {}, huRng = 1, HU_HAND = ${HAND};
function huRand() { huRng = (huRng * 1103515245 + 12345) >>> 0; return huRng / 4294967296; }
function huGauss() { return Math.sqrt(-2 * Math.log(huRand() + 1e-9)) * Math.cos(6.2832 * huRand()); }
function huSnap() {
  return { t: mini.total, list: mini.pitchTargets.filter(e => e.state === 'live').map(e => ({
    id: e.id, kind: e.kind, x: e.x, y: e.y, z: e.z, mode: e.mode, show: e.show, size: e.size || 1 })) };
}
// A stroke through the landing point of an aim: roughly up the screen (angle error), ending near the
// point (scatter), at a speed and length with their own errors. Falls back to the game's own stroke
// when the rough one would not throw that way.
function huStroke(aim, sAngle, sPos, sSpeed, sLen, base) {
  const C = pitchCam(), size = activeCanvas(), H = PITCH_HAND,
    P = { x: H.x + Math.sin(aim.yaw) * aim.dist, z: H.z + Math.cos(aim.yaw) * aim.dist },
    ps = pitchProject(P.x, PITCH_YREF, P.z),
    ref = base || pitchSwipeFor(aim);
  if (!ref) return null;
  // Her stroke: the game's own line when it is given (the bank guide), else roughly straight up.
  let ang = base ? Math.atan2(ref.ux, -ref.uy) : 0;
  ang += huGauss() * sAngle * HU_HAND;
  let ux = Math.sin(ang), uy = -Math.cos(ang);
  const q0 = pitchPlanePoint(ps.x, ps.y, C), q1 = pitchPlanePoint(ps.x + ux * 20, ps.y + uy * 20, C);
  if ((q1.x - q0.x) * (P.x - H.x) + (q1.z - q0.z) * (P.z - H.z) <= 0) { ux = ref.ux; uy = ref.uy; }
  const len = Math.max(30, ref.swipe * (1 + huGauss() * sLen * HU_HAND)),
    speed = ref.speed * (1 + huGauss() * sSpeed * HU_HAND),
    end = base ? { x: ref.x1, y: ref.y1 } : ps,
    ex = clamp(end.x + huGauss() * sPos * HU_HAND, 14, size.w - 14),
    ey = clamp(end.y + huGauss() * sPos * HU_HAND, 66, size.h - 14);
  // Slide it onto the canvas along its own line if it starts off the glass.
  let x0 = ex - ux * len, y0 = ey - uy * len;
  const k = pitchFitSwipe(ex, ey, ux, uy, len, size);
  if (k === null) return null;
  return { x0: x0 + ux * k, y0: y0 + uy * k, ux, uy, len, speed };
}
function huTick(R) {
  const now = mini.total, H = PITCH_HAND;
  hu.hist.push(huSnap());
  while (hu.hist.length > 90) hu.hist.shift();
  // A stroke in progress: keep swiping at its speed; let go once it is long enough.
  if (hu.stroke) {
    const s = hu.stroke;
    if (now < s.at) return;
    if (!s.down) { arcadeDown({ x: s.x0, y: s.y0 }); s.down = true; s.t0 = now; return; }
    const d = s.speed * (now - s.t0);
    arcadeMove({ x: s.x0 + s.ux * d, y: s.y0 + s.uy * d });
    if (d >= s.len) {
      arcadeUp(false);
      hu.sent[s.id] = now + s.flight + 0.25;
      hu.busy = now + 0.2;
      hu.stroke = null;
    }
    return;
  }
  if (now < (hu.busy || 0) || mini.pitchBalls <= 0) return;
  const back = s => hu.hist[Math.max(0, hu.hist.length - 1 - Math.round(s / 0.016))];
  const seen = back(R), before = back(R + 0.15);
  const old = id => before.list.find(o => o.id === id);
  const up = o => (o.kind === 'peek' || o.kind === 'ump') ? (o.mode === 'up' || (o.mode === 'rise' && o.show > 0.5)) : (o.kind !== 'hop' || o.mode === 'rest');
  const rank = o => (o.kind === 'charge' ? (o.z < 330 ? 300 - o.z / 4 : 70) : o.kind === 'ump' ? 150 : o.kind === 'timed' ? 140 : o.kind === 'peek' ? 120 : o.kind === 'shield' ? 10 : 80 - o.z / 20) + huRand() * 12;
  const cands = seen.list.filter(o => up(o) && !(hu.sent[o.id] > now) && mini.pitchTargets.some(e => e.id === o.id && e.state === 'live'));
  if (!cands.length) return;
  cands.sort((a, b) => rank(b) - rank(a));
  const o = cands[0], p0 = old(o.id) || o;
  const think = o.kind === 'shield' ? 0.9 + huRand() * 0.4 : 0.35 + huRand() * 0.3;
  let s;
  if (o.kind === 'shield') {
    // The bank shot the level 2 guide shows: steady while the guide is up, from memory after.
    const e = mini.pitchTargets.find(t => t.id === o.id), plan = e && pitchBankPlan(e);
    if (!plan) { hu.sent[o.id] = now + 1; return; }
    const guided = mini.tier === 1 && !mini.pitchBanks;
    s = huStroke(plan.aim, guided ? 0.05 : 0.08, guided ? 5 : 8, guided ? 0.07 : 0.1, 0.12, plan.swipe);
    if (s) s.flight = 0.9;
  } else {
    // Lead it by eye: where it seemed to be going, over her think time, the swipe and the flight.
    const still = o.kind === 'peek' || o.kind === 'ump', vx = still ? 0 : (o.x - p0.x) / 0.15, vz = still ? 0 : (o.z - p0.z) / 0.15,
      misjudge = 1 + huGauss() * 0.25, cy = o.y + 24 * o.size;
    // A quick flat flick at anything that moves or will not wait (less lead to guess), a medium arc
    // at a sitting duck or a peeker that has popped up.
    const flat = o.kind !== 'sit' && o.kind !== 'peek',
      loft = clamp((flat ? 0.12 : 0.3) + huGauss() * 0.08, 0, 0.6);
    let q = { x: o.x, y: cy, z: o.z }, aim = null, flight = 0.5;
    for (let i = 0; i < 3; i++) {
      const lead = (R + think + 0.12 + flight) * misjudge;
      q = { x: o.x + vx * lead, y: cy, z: o.z + vz * lead };
      aim = pitchAimAt(q, loft) || pitchAimAt(q, 0.6) || pitchAimAt(q, 1);
      if (!aim) break;
      const v = pitchLaunch(aim);
      flight = Math.hypot(q.x - H.x, q.z - H.z) / Math.max(1, Math.hypot(v.x, v.z));
    }
    if (!aim) { hu.sent[o.id] = now + 0.5; return; }
    s = huStroke(aim, 0.1, 8, 0.12, 0.15, null);
    if (s) s.flight = flight;
  }
  if (!s) { hu.sent[o.id] = now + 0.5; return; }
  hu.stroke = { ...s, id: o.id, at: now + think };
  hu.aimed[o.kind] = (hu.aimed[o.kind] || 0) + 1;
}`);
for (const tier of ONLY ? [+ONLY] : [0, 1, 2, 3]) {
  const res = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    close();
    const r = JSON.parse(
      run(`(()=>{let s=${1000 + trial * 7919};Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};huRng=${trial + 11};
      state.difficulty=${DIFF};openMini(0);mini.tier=${tier};startMini();launchMini();updateMini(3.3);hu={hist:[],sent:{},stroke:null,causes:{},aimed:{}};
      for(let n=0;n<20000&&mini.screen==='play';n++){huTick(${REACT});const m0=mini.miss;updateMini(0.016);if(mini.miss>m0){const k=mini.flashText.split(' ·')[0];hu.causes[k]=(hu.causes[k]||0)+1;}}
      return JSON.stringify({win:mini.pendingFinish&&mini.pendingFinish.win,got:mini.got,goal:mini.goal,miss:mini.miss,throws:mini.pitchThrows,hits:mini.pitchHits,banks:mini.pitchBanks,t:Math.round(mini.total),causes:hu.causes,ump:mini.pitchUmpHits,umpDown:mini.pitchUmpDown,aimed:hu.aimed,got:mini.got,kinds:mini.pitchKinds});})()`)
    );
    res.push(r);
    if (process.env.DEBUG) console.log(JSON.stringify(r));
  }
  const avg = k => (res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(1);
  // TALLY=1: throws aimed at each kind of gremlin, and evictions of that kind, over all the runs.
  if (process.env.TALLY) {
    const sum = k => res.reduce((a, r) => { for (const [n, v] of Object.entries(r[k] || {})) a[n] = (a[n] || 0) + v; return a; }, {});
    const aimed = sum('aimed'), kinds = sum('kinds');
    console.log('  aimed/evicted by kind:', Object.keys(aimed).map(k => `${k} ${kinds[k] || 0}/${aimed[k]}`).join(' · '));
  }
  console.log(
    `L${tier + 1} P${DIFF} react ${REACT}: won ${res.filter(r => r.win).length}/${res.length} · evicted ${avg('got')}/${res[0].goal} · oops ${avg('miss')} · ${avg('hits')}/${avg('throws')} throws hit · banks ${avg('banks')}`
  );
}
