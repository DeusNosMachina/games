// Not part of the suite. A human-speed yardstick for Drip or Die, both recovery phases. The player sees
// the bed a reaction time late and plays like a person.
// Prime the pump: they watch the line and the next mint window, judge when the two will meet (sliding
// windows and bounces off the bar ends included; a turn only once they have seen its arrows flicker) and
// tap then, with a timing error that grows with how far ahead they had to guess. They never aim at a red
// decoy, but a sloppy tap can land on one.
// Hold the pressure: they judge where the needle is heading from what they saw, pump toward the nearest
// band, never flip a finger faster than every 0.08 s, and take a moment longer to believe the controls
// flipped (or flipped back). Shoves are answered when they are seen, never before.
// The bot wins everything by design; this says whether a person can. Usage from the repository root
// (reaction s, trials per level, prescription 0-2):
//   node gut-feeling/tests/tools/iv-human.cjs 0.25 30 1
// Targets at 0.25 s: level 1 nearly always, level 2 most of the time, level 3 sometimes, Legendary about one
// in four; a 0.35 s player still clears level 1. Read each line: wins, strikes, seconds, and what caused
// the strikes. PHASE=0 runs only the pump, PHASE=1 only the pressure; ONLY=3 runs one level (0-3).
// PATCH='IV_LEVELS[3].pump.floor=0.07' runs code in the page first, for trying a tuning without a rebuild.
const { run, close } = require('../harness.cjs');
const REACT = +process.argv[2] || 0.25,
  TRIALS = +process.argv[3] || 30,
  DIFF = process.argv[4] === undefined ? 1 : +process.argv[4],
  ONLY = process.env.ONLY,
  PHASE = process.env.PHASE;
if (process.env.PATCH) run(process.env.PATCH);
run(`
var hu = null;
function huReset(seed) {
  let s = seed >>> 0;
  hu = { hist: [], tapped: {}, key: '', err: 0, held: false, changed: -9,
    rnd: () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
  hu.gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += hu.rnd(); return (u - 3) / Math.sqrt(0.5); };
}
// The screen as it is now.
function huSnap() {
  if (mini.ivPhase === IV_PRESSURE)
    return { now: mini.total, p: mini.pressure, centres: mini.ivCentres.slice(), inv: mini.ivInverted,
      ev: mini.ivEvent && !mini.ivEvent.fired ? { kind: mini.ivEvent.kind, left: mini.ivEvent.warn - mini.ivEvent.t, dir: mini.ivEvent.dir } : null };
  const s = mini.ivSweep;
  return { now: mini.total, id: mini.ivSweepCount, pos: mini.pos, dir: mini.dir, speed: ivSpeed(), lock: mini.beatLock,
    drift: s.drift, shift: s.shift, lo: s.shiftMin, hi: s.shiftMax, turnIn: ivTurning() ? s.flipAt - s.age : null,
    wins: s.wins.map((w, i) => ({ i, u: w.u, decoy: w.decoy, hit: w.hit })) };
}
// The screen as the eye has caught up with it: back seconds ago.
function huSeen(back) {
  let v = hu.hist[0];
  for (const h of hu.hist) if (h.now <= mini.total - back + 1e-9) v = h;
  return v;
}
// Seconds from the seen moment until the line reaches the window's center, by eye: the line runs at the
// sweep's speed once the pause between sweeps is over, the window slides and bounces off the bar ends,
// and turns where its arrows were seen flickering. Null if they never meet this sweep.
function huMeet(v, w) {
  let shift = v.shift, drift = v.drift, pos = v.pos, prev = null;
  const dt = 0.002;
  for (let t = 0; t < 3; t += dt) {
    const at = v.dir > 0 ? w.u + shift : 1 - (w.u + shift),
      d = (pos - at) * v.dir;
    if (prev !== null && prev < 0 && d >= 0) return t;
    prev = d;
    if (pos < -0.01 || pos > 1.01) return null;
    if (t >= v.lock) {
      pos += v.dir * v.speed * dt;
      if (drift) {
        if (v.turnIn !== null && t - v.lock < v.turnIn && t - v.lock + dt >= v.turnIn) drift = -drift;
        shift += drift * dt;
        if (shift > v.hi) { shift = 2 * v.hi - shift; drift = -Math.abs(drift); }
        if (shift < v.lo) { shift = 2 * v.lo - shift; drift = Math.abs(drift); }
      }
    }
  }
  return null;
}
function huPump(react) {
  const v = huSeen(react);
  if (v.id === undefined) return;
  // The next mint they have not tapped yet, in the order the line meets them.
  const live = v.wins.filter(w => !w.decoy && !w.hit && !hu.tapped[v.id + ':' + w.i]);
  let best = null;
  for (const w of live) {
    const t = huMeet(v, w);
    if (t !== null && (!best || t < best.t)) best = { w, t };
  }
  if (!best) return;
  const key = v.id + ':' + best.w.i;
  if (key !== hu.key) {
    hu.key = key;
    // Timing error: a finger on glass (20 ms), plus a guess that gets worse the further ahead they must
    // see (12% of it): 36 ms at 0.25 s, 46 ms at 0.35 s.
    hu.err = hu.gauss() * Math.hypot(0.02, 0.12 * react);
  }
  if (mini.total >= v.now + best.t + hu.err) {
    hu.tapped[key] = true;
    miniAction('tap');
  }
}
function huPressure(react) {
  const v = huSeen(react), before = huSeen(react + 0.1), flip = huSeen(react + 0.15);
  if (v.p === undefined || before.p === undefined) return;
  // A warning card they have read: when they expect it to land (a guess, off by about 0.12 s), and what
  // to do about it until they can see what it did.
  if (v.ev && v.ev.kind !== hu.evKind) {
    hu.evKind = v.ev.kind;
    hu.evAt = v.now + v.ev.left + hu.gauss() * 0.12;
    hu.evDir = v.ev.dir;
  }
  if (!v.ev) hu.evKind = null;
  // The eye reads the needle to within a couple of pixels, and its motion from the last tenth of a second.
  const seenP = v.p + hu.gauss() * 0.006,
    speed = (v.p - before.p) / Math.max(0.05, v.now - before.now) + hu.gauss() * 0.03;
  let goal = v.centres.reduce((a, b) => (Math.abs(b - seenP) < Math.abs(a - seenP) ? b : a));
  // Where the needle is heading, judged from what they saw.
  let up = seenP + speed * (0.16 + react * 0.6) < goal;
  const bracing = hu.evAt !== undefined && mini.total >= hu.evAt - 0.05 && mini.total < hu.evAt + react;
  if (bracing && hu.evShove === 'cough') up = false;
  if (bracing && hu.evShove === 'hiccup') up = true;
  if (bracing && hu.evShove === 'spike') up = seenP < goal + hu.evDir * 0.15;
  if (hu.evKind) hu.evShove = hu.evKind;
  else if (!bracing) hu.evAt = undefined;
  const want = (flip.inv === undefined ? v.inv : flip.inv) ? !up : up;
  if (want !== hu.held && mini.total - hu.changed >= 0.08) {
    hu.held = want;
    hu.changed = mini.total;
  }
  mini.held = hu.held;
}
function huTick(react) {
  hu.hist.push(huSnap());
  while (hu.hist.length > 2 && hu.hist[1].now <= mini.total - react - 0.4) hu.hist.shift();
  if (mini.ivPhase === IV_PRESSURE) huPressure(react);
  else huPump(react);
}
`);
const phases = PHASE === undefined ? [0, 1] : [+PHASE];
for (const phase of phases)
  for (const tier of ONLY ? [+ONLY] : [0, 1, 2, 3]) {
    const res = [];
    for (let trial = 0; trial < TRIALS; trial++) {
      close();
      res.push(
        JSON.parse(
          run(`(()=>{let s=${1000 + trial * 7919};Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};huReset(${trial + 11});
      ivRecovery=null;ivRecoveryNext=${phase};state.difficulty=${DIFF};openMini(0,true);mini.tier=${tier};startMini();launchMini();updateMini(3.3);const causes={};
      for(let n=0;n<20000&&mini.screen==='play';n++){const m0=mini.miss;huTick(${REACT});updateMini(0.016);if(mini.miss>m0){const k=mini.flashText.split('  ·')[0];causes[k]=(causes[k]||0)+1;}}
      const r={win:!!(mini.pendingFinish&&mini.pendingFinish.win),miss:mini.miss,t:mini.total,got:mini.ivPhase===IV_PRESSURE?mini.stable:mini.good,why:mini.miss>=3?'strikes':mini.pendingFinish&&mini.pendingFinish.win?'won':'clock',causes};
      mini.forced=false;return JSON.stringify(r);})()`)
        )
      );
    }
    const won = res.filter(r => r.win),
      causes = {},
      clock = res.filter(r => r.why === 'clock').length;
    for (const r of res) for (const [k, n] of Object.entries(r.causes)) causes[k] = (causes[k] || 0) + n;
    const avg = (a, k) => (a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : 0).toFixed(1);
    console.log(
      `${phase ? 'pressure' : 'pump    '} L${tier + 1} P${DIFF} react ${REACT}: won ${won.length}/${res.length} · strikes ${avg(res, 'miss')} · ${avg(won, 't')} s a win · ${clock} out of time · ${JSON.stringify(causes)}`
    );
  }
close();
