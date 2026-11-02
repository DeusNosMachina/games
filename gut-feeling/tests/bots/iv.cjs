// Drip or Die controller, input only (miniAction / mini.held). It reads what the canvas shows:
// taps each live mint window when the line is at its center, tracking windows that slide (and never a
// decoy); catches the order by planning the cup's eased glide, taking the right flavor that lands first
// while dodging skulls, wrong flavors and hoppers (hop arrows show once a hopper is low enough); and
// pumps toward the nearest band, flipping its input while the controls are inverted.
module.exports = {
  id: 0,
  policy: `
if (mini.phase === 0 && mini.ivSweep) {
  const s = mini.ivSweep;
  // Line and window close at up to marker speed plus slide speed per tick.
  const step = ((mini.ivSpeed || 0.5) + Math.abs(s.drift || 0)) * 0.016;
  for (const w of s.wins) {
    if (w.decoy || w.hits >= w.need || w.lastPass === s.pass) continue;
    if (Math.abs(mini.pos - w.pos) <= Math.max(0.003, step * 0.55)) {
      miniAction('tap');
      break;
    }
  }
}
if (mini.phase === 1) {
  const rate = ivCupRate() * 0.9;
  const landLane = d => (d.hopTo !== undefined && !d.hopped && d.y >= 150 ? d.hopTo : d.lane);
  const wanted = d => !d.bad && (d.scoop || d.kind === mini.recipe);
  const drops = mini.drops
    .filter(d => !d.done)
    .map(d => ({ lane: landLane(d), t: Math.max(0, (352 - d.y) / d.speed), good: wanted(d) }))
    .filter(e => e.t < 1.6)
    .sort((a, b) => a.t - b.t);
  // Cup position after t seconds of heading for lane m, switching to lane l at time tau.
  const xAt = (m, tau, l, t) => {
    const xm = 240 + m * 160;
    if (t <= tau) return xm + (mini.cupX - xm) * Math.exp(-rate * t);
    const xs = xm + (mini.cupX - xm) * Math.exp(-rate * tau);
    const xl = 240 + l * 160;
    return xl + (xs - xl) * Math.exp(-rate * (t - tau));
  };
  const laneOf = x => Math.min(2, Math.max(0, Math.round((x - 240) / 160)));
  let best = mini.lane;
  let bestScore = -Infinity;
  for (const m of [0, 1, 2])
    for (const tau of [0, 0.08, 0.16, 0.24, 0.34, 0.46, 0.6])
      for (const l of [0, 1, 2]) {
        if (tau === 0 && m !== l) continue;
        let score = 0;
        let caughtAt = Infinity;
        for (const e of drops) {
          if (e.t > caughtAt + 0.25) break;
          const at = [e.t - 0.035, e.t, e.t + 0.035].map(t => laneOf(xAt(m, tau, l, Math.max(0, t))));
          if (!e.good) {
            if (at.includes(e.lane)) score -= 100;
          } else if (caughtAt === Infinity && at.every(v => v === e.lane)) {
            score += 50 - e.t * 10;
            caughtAt = e.t;
          }
        }
        const first = tau === 0 ? l : m;
        if (first === mini.lane) score += 0.5;
        if (first === 1) score += 0.2;
        if (score > bestScore) {
          bestScore = score;
          best = first;
        }
      }
  if (best !== mini.lane) miniAction('lane' + best);
}
if (mini.phase === 2) {
  const goal = mini.ivCentres.reduce((a, b) => (Math.abs(b - mini.pressure) < Math.abs(a - mini.pressure) ? b : a));
  const up = mini.pressure + mini.velocity * 0.16 < goal;
  mini.held = mini.ivInverted ? !up : up;
}
`
};
