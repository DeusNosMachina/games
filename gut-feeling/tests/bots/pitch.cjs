// Fastpitch Fever controller, input only: every throw is a flick through arcadeDown / arcadeMove /
// arcadeUp. It picks the most urgent gremlin (chargers first, then the Ump, golden ones, peekers),
// leads it with the game's own predictor, finds an arc whose real flight gets there first without
// touching the furniture, and swipes the stroke pitchSwipeFor lays out for that throw. Bedpan shields
// get the game's own bank plan. A flick takes two ticks: down and the start of the stroke, then the
// rest of it at the right speed and let go.
module.exports = {
  id: 0,
  policy: `
const now = mini.total;
bot.claimed = bot.claimed || {};
bot.bank = bot.bank || {};
// A flick in progress: finish the stroke at its speed (whatever the tick was) and let go.
if (bot.flick) {
  const f = bot.flick, k = f.speed * Math.max(1 / 240, now - f.t);
  bot.flick = null;
  if (!mini.pitchPress) return;
  arcadeMove({ x: f.bx + f.ux * k, y: f.by + f.uy * k });
  arcadeUp(false);
  bot.wait = now + 0.03;
  return;
}
if (mini.pitchCd > 0.02 || mini.pitchBalls <= 0 || (bot.wait || 0) > now) return;
const H = PITCH_HAND, LEAD = 0.017;
// Flies a throw with the real physics against the predicted gremlin; true if it gets there first.
function lands(v, e, needWall) {
  const b = pitchNewBall(v), R = pitchRadius(e) * 0.8 + PITCH_BALL;
  for (let i = 0; i < 400 && !b.dead; i++) {
    const c = pitchMoveBall(b, PITCH_SUB);
    if (c && c !== 'wall' && c !== 'back' && c !== 'floor') return false;
    if (c === 'floor' && !needWall && !b.walls) return false;
    if (i % 2) continue;
    const q = pitchFuture(e, b.age + LEAD);
    if (!q) continue;
    if (Math.hypot(b.x - q.x, b.y - q.y, b.z - q.z) < R) return !needWall || b.walls > 0;
  }
  return false;
}
// A direct throw: lead the gremlin by the flight time, at the flattest arc that works.
function direct(e) {
  for (const loft of [0.15, 0.3, 0, 0.5, 0.75, 1]) {
    let T = 0.4, q = null, aim = null;
    for (let i = 0; i < 4; i++) {
      q = pitchFuture(e, T + LEAD);
      if (!q) break;
      aim = pitchAimAt(q, loft);
      if (!aim) break;
      const v = pitchLaunch(aim);
      T =Math.hypot(q.x - H.x, q.z - H.z) / Math.max(1, Math.hypot(v.x, v.z));
    }
    if (!q || !aim) continue;
    const sw = pitchSwipeFor(aim);
    if (sw && lands(pitchLaunch(aim), e, false)) return { sw, T };
  }
  return null;
}
function bank(e) {
  const plan = pitchBankPlan(e);
  return plan && { sw: plan.swipe, T: 0.9 };
}
const rank = e => e.kind === 'charge' ? 200 - e.z / 5 : e.kind === 'ump' ? 120 : e.kind === 'timed' ? 110 : e.kind === 'peek' ? 90 : e.kind === 'shield' ? 40 : 60;
const live = mini.pitchTargets.filter(e => e.state === 'live' && !(bot.claimed[e.id] > now)).sort((a, b) => rank(b) - rank(a));
for (const e of live) {
  // Nothing to throw at this one right now (ducked, mid-hop, out of reach): look again shortly.
  if ((bot.bank[e.id] || 0) > now) continue;
  const plan = e.kind === 'shield' ? bank(e) : direct(e);
  if (!plan) {
    bot.bank[e.id] = now + (e.kind === 'shield' ? 0.5 : 0.08);
    continue;
  }
  // The stroke: down at its start, already moving; the next tick runs the last stretch at speed.
  const s = plan.sw, step = s.speed / 60, bx = s.x1 - s.ux * step, by = s.y1 - s.uy * step;
  arcadeDown({ x: s.x0, y: s.y0 });
  arcadeMove({ x: bx, y: by });
  bot.flick = { t: now, bx, by, ux: s.ux, uy: s.uy, speed: s.speed };
  bot.claimed[e.id] = now + plan.T + 0.15;
  return;
}
`
};
