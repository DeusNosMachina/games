// Drip or Die, the recovery ritual, input only (miniAction). It reads what the canvas shows: one mint
// window per sweep, and the line crossing it. It taps when the line is at the window's center. The
// playthrough opens it as a forced run (openMini(0, true)) at every level; it is the same gentle phase
// at all of them.
module.exports = {
  id: 'recovery',
  room: 0,
  forced: true,
  policy: `
const s = mini.ivSweep;
if (!s || s.win.hit || mini.beatLock > 0) return;
// The line closes on the window by at most one tick of marker travel.
const step = ivSpeed() * 0.016;
if (Math.abs(mini.pos - s.win.pos) <= Math.max(0.003, step * 0.55)) miniAction('tap');
`
};
