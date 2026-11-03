// Drip or Die, the recovery ritual, input only (miniAction / mini.held). It reads what the canvas shows
// and plays whichever phase the recovery drew. Prime the pump: tap each live mint window when the line
// is at its center, tracking windows that slide, and never a red decoy. Hold the pressure: pump toward
// the nearest band, leading the needle's momentum a little, and flip the input while the controls are.
// The playthrough opens it as a forced run (openMini(0, true)) at every level, Legendary included, and
// every prescription; the phase is the plan's random pick.
module.exports = {
  id: 'recovery',
  room: 0,
  forced: true,
  policy: `
if (mini.ivPhase === IV_PRESSURE) {
  const goal = mini.ivCentres.reduce((a, b) => (Math.abs(b - mini.pressure) < Math.abs(a - mini.pressure) ? b : a));
  const up = mini.pressure + mini.velocity * 0.16 < goal;
  mini.held = mini.ivInverted ? !up : up;
} else if (mini.ivSweep && mini.beatLock <= 0) {
  const s = mini.ivSweep;
  // Line and window close at up to marker speed plus slide speed per tick.
  const step = ((mini.ivSpeed || 0.5) + Math.abs(s.drift || 0)) * 0.016;
  for (const w of s.wins) {
    if (w.decoy || w.hit) continue;
    if (Math.abs(mini.pos - w.pos) <= Math.max(0.003, step * 0.55)) {
      miniAction('tap');
      break;
    }
  }
}
`
};
