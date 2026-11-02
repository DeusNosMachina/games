// Drip or Die controller, input only (miniAction / mini.held). It reads what the canvas shows:
// taps each live mint window at its center and never a decoy, catches the order while dodging skulls
// (hop arrows appear once a hopper is low enough), and pumps toward the nearest band, flipping its
// input while the controls are inverted.
module.exports = {
  id: 0,
  policy: `
if (mini.phase === 0 && mini.ivSweep) {
  const s = mini.ivSweep;
  const step = (mini.ivSpeed || 0.5) * 0.016;
  for (const w of s.wins) {
    if (w.decoy || w.hits >= w.need || w.lastPass === s.pass) continue;
    if (Math.abs(mini.pos - w.pos) <= Math.max(0.003, step * 0.55)) {
      miniAction('tap');
      break;
    }
  }
}
if (mini.phase === 1) {
  const live = mini.drops.filter(d => !d.done);
  const lane = d => (d.hopTo !== undefined && !d.hopped && d.y >= 150 ? d.hopTo : d.lane);
  const eta = d => (352 - d.y) / d.speed;
  const wanted = d => !d.bad && (d.scoop || d.kind === mini.recipe);
  const hazard = d => d.bad || (!d.scoop && d.kind !== mini.recipe);
  const hazardEta = l => Math.min(Infinity, ...live.filter(d => hazard(d) && lane(d) === l).map(eta));
  const want = live.filter(wanted).sort((a, b) => eta(a) - eta(b))[0];
  let target = want ? lane(want) : mini.lane;
  const he = hazardEta(target);
  if (he < 0.38 && (!want || he <= eta(want) + 0.03)) {
    const safe = [0, 1, 2].filter(l => hazardEta(l) >= 0.38);
    if (safe.length) target = safe.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
  }
  if (target !== mini.lane) miniAction('lane' + target);
}
if (mini.phase === 2) {
  const goal = mini.ivCentres.reduce((a, b) => (Math.abs(b - mini.pressure) < Math.abs(a - mini.pressure) ? b : a));
  const up = mini.pressure + mini.velocity * 0.16 < goal;
  mini.held = mini.ivInverted ? !up : up;
}
`
};
