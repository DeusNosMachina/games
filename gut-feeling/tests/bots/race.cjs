// Gurney Grand Prix controller, input only: one finger held on the canvas steers by where it sits
// (raceSteerAt), BOOST and THROW go through miniAction. It reads the road and the traffic: for each
// line across the road it adds up who it would meet there and how soon, picks the cheapest line,
// steers for it with the curve's outward push fed forward, boosts on clear straights, and throws at
// Ralph or at anything boxing it in. Boost pads and lane ramps coming up are lines too, cheaper than
// a plain lane, and a ramp's line ignores whatever it would fly over. It never leaves the floor on
// purpose, so it never spins out.
module.exports = {
  id: 3,
  policy: `
const C = activeCanvas(), top = mini.raceTop, z = mini.raceZ, x = mini.raceX, v = Math.max(1, mini.raceV);
const pct = v / top, seg = raceSeg(z), course = mini.raceCourse;
const lines = [-0.88, -0.62, -0.31, 0, 0.31, 0.62, 0.88];
const live = mini.raceCars.filter(c => !c.out && !c.knocked && !c.chase && c.z - z > -2 && c.z - z < 120);
// Where a car will be in t seconds, and how soon we reach it.
const xAt = (c, t) => {
  let tx = c.tx !== undefined ? c.tx : RACE_LANES[c.blink > 0 ? c.nextLane : c.lane];
  if (c.kind === 'ralph' && c.blocking) tx = x;
  const lat = c.kind === 'ralph' ? 0.8 : c.racer ? 1 : 0.55;
  return c.x + Math.max(-lat * t, Math.min(lat * t, tx - c.x));
};
const meet = c => {
  const dz = c.z - z, close = v - c.v;
  if (dz < RACE_LEN + 0.4) return 0;
  return close > 0.3 ? (dz - RACE_LEN) / close : Infinity;
};
// flyFrom: a ramp lip on this line; whatever sits in the air time after it does not count.
const cost = (L, flyFrom) => {
  let k = Math.abs(L - x) * 2 + Math.abs(L) * 0.6 + (Math.abs(L) > 0.8 ? 3 : 0);
  const travel = Math.abs(L - x) / (RACE_STEER * 0.95), reach = flyFrom ? (0.5 + 0.45 * Math.min(1.4, pct)) * v : 0;
  for (const c of live) {
    if (mini.raceAir > 0 && c.z - z < mini.raceAir * v) continue;
    if (flyFrom && c.z > flyFrom + 1 && c.z < flyFrom + reach - 2) continue;
    if (c.air > 0) continue;
    const t = meet(c);
    if (t > 3.2) continue;
    const room = c.w + RACE_PW + 0.1;
    // On the way over: anything we pass while still crossing.
    if (t < travel + 0.15) {
      const f = t / Math.max(travel, 0.01), xm = x + (L - x) * Math.min(1, f);
      if (Math.abs(xAt(c, t) - xm) < room) k += 400 / (t + 0.2);
    }
    if (Math.abs(xAt(c, t) - L) < room || Math.abs(xAt(c, t + 0.25) - L) < room) k += 160 / (t + 0.25);
  }
  return k;
};
const cands = lines.concat([x]).map(L => ({ L, k: cost(L, 0) }));
// The next pad and the next lane ramp within reach are lines worth paying a little for.
const pad = course.pads.find(p => p.z + p.len > z + 2 && p.z - z < 70);
if (pad && !(mini.racePadLast === pad)) cands.push({ L: pad.x, k: cost(pad.x, 0) - 40 });
const ramp = course.ramps.find(r => r.w < 1 && r.end > z + 1 && r.end - z < 80);
if (ramp && mini.raceAir <= 0) cands.push({ L: ramp.x, k: cost(ramp.x, ramp.end) - 60 });
let best = x, bestK = Infinity;
for (const c of cands) if (c.k < bestK) { bestK = c.k; best = c.L; }
// Ralph, or a wall of traffic close ahead: throw.
const ralph = live.find(c => c.kind === 'ralph' && c.blocking && c.z - z < 26 && c.z - z > 3);
const ralphAhead = mini.raceRivals.some(c => c.kind === 'ralph' && (c.z > z || c.encore > 0));
if (mini.raceBalls > 0 && !mini.raceShots.length) {
  if (ralph && Math.abs(ralph.x - x) < 0.5) miniAction('throw');
  else if (bestK > 120 && mini.raceBalls > (ralphAhead ? 1 : 0)) {
    const t = live.filter(c => Math.abs(c.x - x) < 0.5 && c.z - z > 4 && c.z - z < 40).sort((a, b) => a.z - b.z)[0];
    if (t) miniAction('throw');
  }
}
// Steer: close the gap fast and cancel the curve's push (in the air the wheel has a third of its grip).
const push = seg.curve * RACE_CENT * Math.min(1.44, pct * pct);
const grip = mini.raceAir > 0 ? 0.35 : 1;
const vxWant = Math.max(-RACE_STEER, Math.min(RACE_STEER, (best - x) * 6)) + push;
const s = Math.max(-1, Math.min(1, vxWant / (RACE_STEER * grip * (0.3 + 0.7 * Math.min(1, pct)))));
const px = C.w / 2 + (Math.abs(s) < 0.02 ? 0 : (Math.sign(s) * (Math.abs(s) >= 1 ? 0.6 : Math.max(0.035, Math.abs(s) / 2.5))) * C.w / 2);
if (!bot.down || !mini.pointer) { arcadeDown({ x: px, y: C.h * 0.9 }); bot.down = true; }
else arcadeMove({ x: px, y: C.h * 0.9 });
// Boost on a clear, gentle stretch; spend whatever is left on the last leg.
if (mini.raceBoosts > 0 && mini.raceBoostT <= 0 && mini.raceSpin <= 0) {
  let bend = 0;
  for (let i = 0; i < 90; i++) bend = Math.max(bend, Math.abs(raceSeg(z + i).curve));
  const clear = !live.some(c => c.z - z < 90 && Math.abs(c.x - best) < 0.55 && c.v < v * 1.3);
  if (clear && (bend < 2.6 || (raceProgress() > 0.8 && bend < 4))) miniAction('boost');
}
`
};
