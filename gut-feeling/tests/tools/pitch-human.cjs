// Not part of the suite. A human-speed yardstick for Fastpitch Fever: a player who sees the room a
// reaction time late, takes a moment to aim, leads movers by eye (a straight-line guess with a
// misjudged speed), taps with a fingertip's scatter, and banks shields off the wall by the mirror
// trick with a shakier hand. The bot wins everything by design; this says whether a person can.
// Usage from the repository root (reaction s, trials per level, prescription 0-2):
//   node gut-feeling/tests/tools/pitch-human.cjs 0.25 30 1
// A 0.25 s player should clear level 1 nearly always, level 2 most of the time and level 3 sometimes;
// a 0.35 s player should still clear level 1. Read each line: wins, evictions against the quota,
// oopses, and how many throws found something.
const { run, close } = require('../harness.cjs');
run('var process_tally=' + (process.env.TALLY ? 'true' : 'false'));
const REACT = +process.argv[2] || 0.25,
  TRIALS = +process.argv[3] || 30,
  DIFF = process.argv[4] === undefined ? 1 : +process.argv[4],
  ONLY = process.env.ONLY;
run(`var hu = {}, huRng = 1;
function huRand() { huRng = (huRng * 1103515245 + 12345) >>> 0; return huRng / 4294967296; }
function huGauss() { return Math.sqrt(-2 * Math.log(huRand() + 1e-9)) * Math.cos(6.2832 * huRand()); }
function huSnap() {
  return { t: mini.total, balls: mini.pitchBalls, list: mini.pitchTargets.filter(e => e.state === 'live').map(e => ({
    id: e.id, kind: e.kind, x: e.x, y: e.y, z: e.z, mode: e.mode, show: e.show, size: e.size || 1, cover: e.cover && e.cover.id })) };
}
function huTick(R) {
  const now = mini.total, H = PITCH_HAND;
  hu.hist.push(huSnap());
  while (hu.hist.length > 90) hu.hist.shift();
  // What the eye has caught up with: the room R seconds ago, and how things were moving then.
  const back = s => hu.hist[Math.max(0, hu.hist.length - 1 - Math.round(s / 0.016))];
  const seen = back(R), before = back(R + 0.15);
  if (hu.plan && now >= hu.plan.at) {
    arcadeDown({ x: hu.plan.sx, y: hu.plan.sy });
    if (hu.plan.drag) arcadeMove({ x: hu.plan.sx + 1, y: hu.plan.sy + 1 });
    arcadeUp();
    hu.sent[hu.plan.id] = now + hu.plan.flight + 0.25;
    if (hu.tally) { const e = mini.pitchTargets.find(t => t.id === hu.plan.id); const k = e ? e.kind + (e.spot ? '@' + e.spot : '') + (e.cover ? ':' + e.cover.id : '') : '?'; hu.tally[k] = (hu.tally[k] || 0) + 1; }
    hu.busy = now + 0.25;
    hu.plan = null;
    return;
  }
  if (hu.plan || now < (hu.busy || 0) || mini.pitchBalls <= 0) return;
  const old = id => before.list.find(o => o.id === id);
  const up = o => (o.kind === 'peek' || o.kind === 'ump') ? (o.mode === 'up' || (o.mode === 'rise' && o.show > 0.5)) : (o.kind !== 'hop' || o.mode === 'rest');
  const rank = o => (o.kind === 'charge' ? (o.z < 330 ? 300 - o.z / 4 : 70) : o.kind === 'ump' ? 150 : o.kind === 'timed' ? 140 : o.kind === 'peek' ? 120 : o.kind === 'shield' ? 10 : 80 - o.z / 20) + huRand() * 12;
  const cands = seen.list.filter(o => up(o) && !(hu.sent[o.id] > now) && mini.pitchTargets.some(e => e.id === o.id && e.state === 'live'));
  if (!cands.length) return;
  cands.sort((a, b) => rank(b) - rank(a));
  const o = cands[0], p0 = old(o.id) || o;
  const aim = o.kind === 'shield' ? 1 + huRand() * 0.4 : 0.45 + huRand() * 0.3;
  const cy = o.y + 24 * o.size;
  let q, sigma = 11;
  if (o.kind === 'shield') {
    // The mirror trick off the nearer side wall, by eye.
    const side = o.x < 0 ? -1 : 1, wx = side * (PITCH_WALL - PITCH_BALL), mx = 2 * wx - o.x, u = (wx - H.x) / (mx - H.x);
    q = { x: wx, y: H.y + (cy - H.y) * u, z: H.z + (o.z - H.z) * u };
    sigma = mini.tier === 1 && !mini.pitchBanks ? 10 : 14;
  } else {
    // A peeker that has popped out holds still; anything else is led by its seen speed.
    const still = o.kind === 'peek' || o.kind === 'ump', vx = still ? 0 : (o.x - p0.x) / 0.15, vz = still ? 0 : (o.z - p0.z) / 0.15, misjudge = 1 + huGauss() * 0.25;
    const flight = Math.hypot(o.x - H.x, cy - H.y, o.z - H.z) / PITCH_FAST, lead = (R + aim + flight) * misjudge;
    q = { x: o.x + vx * lead, y: cy, z: o.z + vz * lead };
  }
  const s = pitchProject(q.x, q.y, q.z);
  hu.plan = { id: o.id, at: now + aim, sx: s.x + huGauss() * sigma, sy: s.y + huGauss() * sigma, flight: 0.45 };
}`);
for (const tier of ONLY ? [+ONLY] : [0, 1, 2]) {
  const res = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    close();
    const r = JSON.parse(
      run(`(()=>{let s=${1000 + trial * 7919};Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};huRng=${trial + 11};
      state.difficulty=${DIFF};openMini(0);mini.tier=${tier};startMini();launchMini();updateMini(3.3);hu={hist:[],sent:{},plan:null,causes:{},tally:process_tally?{}:null};
      for(let n=0;n<20000&&mini.screen==='play';n++){huTick(${REACT});const m0=mini.miss;updateMini(0.016);if(mini.miss>m0){const k=mini.flashText.split(' ·')[0];hu.causes[k]=(hu.causes[k]||0)+1;}}
      return JSON.stringify({win:mini.pendingFinish&&mini.pendingFinish.win,got:mini.got,goal:mini.goal,miss:mini.miss,throws:mini.pitchThrows,hits:mini.pitchHits,banks:mini.pitchBanks,t:Math.round(mini.total),why:mini.pendingFinish&&mini.pendingFinish.reason?'quota':'oops',causes:hu.causes,tally:hu.tally,ump:mini.pitchUmpHits,umpDown:mini.pitchUmpDown});})()`)
    );
    res.push(r);
    if (process.env.DEBUG) console.log(JSON.stringify(r));
  }
  const avg = k => (res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(1);
  if (process.env.DIST) console.log('  evicted (sorted):', res.map(r => r.got + (r.miss >= (DIFF === 0 ? 8 : DIFF === 1 ? 6 : 5) ? 'x' : '')).sort((a, b) => parseInt(a) - parseInt(b)).join(' '));
  console.log(
    `L${tier + 1} P${DIFF} react ${REACT}: won ${res.filter(r => r.win).length}/${res.length} · evicted ${avg('got')}/${res[0].goal} · oops ${avg('miss')} · ${avg('hits')}/${avg('throws')} throws hit · banks ${avg('banks')}`
  );
}
