// Fastpitch Fever controller, input only (canvas taps through arcadeDown / arcadeUp). It picks the most
// urgent gremlin (chargers first, then the Ump, golden ones, peekers), leads it with the game's own
// predictor, taps where the fastball meets it, and checks the flight first so it never throws into
// the furniture. Bedpan shields get a bank shot: it taps the wall spot the level 2 guide shows.
module.exports = {
  id: 0,
  policy: `
if (mini.pitchCd > 0 || mini.pitchBalls <= 0 || (bot.wait || 0) > mini.total) return;
bot.claimed = bot.claimed || {};
bot.bank = bot.bank || {};
const now = mini.total, H = PITCH_HAND;
// Flies a throw with the real physics and the predicted gremlin; true if it gets there first.
function lands(v, e, needWall) {
  const b = pitchNewBall(v), R = pitchRadius(e) * 0.8 + PITCH_BALL;
  for (let i = 0; i < 300 && !b.dead; i++) {
    const c = pitchMoveBall(b, PITCH_SUB);
    if (c && c !== 'wall' && c !== 'back' && c !== 'floor') return false;
    if (c === 'floor' && !needWall) return false;
    if (i % 2) continue;
    const q = pitchFuture(e, b.age);
    if (!q) continue;
    if (Math.hypot(b.x - q.x, b.y - q.y, b.z - q.z) < R) return !needWall || b.walls > 0;
  }
  return false;
}
function tapFor(q) {
  const p = pitchProject(q.x, q.y, q.z);
  if (p.x < 2 || p.y < 2) return null;
  const r = pitchRaycast(p.x, p.y);
  return { sx: p.x, sy: p.y, v: pitchFastball(r), r };
}
function direct(e) {
  let T = 0.3, q = null;
  for (let i = 0; i < 5; i++) {
    q = pitchFuture(e, T + 0.02);
    if (!q) return null;
    T = clamp(Math.hypot(q.x - H.x, q.y - H.y, q.z - H.z) / PITCH_FAST, 0.14, 0.8);
  }
  for (const lift of [0, 6, -6, 12]) {
    const t = tapFor({ ...q, y: q.y + lift });
    if (t && lands(t.v, e, false)) return { ...t, T };
  }
  return null;
}
// The game's own bank planner: the wall spot whose fastball comes off the wall into the shield.
function bank(e) {
  const plan = pitchBankPlan(e);
  if (!plan) return null;
  const p = pitchProject(plan.q.x, plan.q.y, plan.q.z);
  return { sx: p.x, sy: p.y, T: 0.8 };
}
const rank = e => e.kind === 'charge' ? 200 - e.z / 5 : e.kind === 'ump' ? 120 : e.kind === 'timed' ? 110 : e.kind === 'peek' ? 90 : e.kind === 'shield' ? 40 : 60;
const live = mini.pitchTargets.filter(e => e.state === 'live' && !(bot.claimed[e.id] > now)).sort((a, b) => rank(b) - rank(a));
for (const e of live) {
  if (e.kind === 'shield' && (bot.bank[e.id] || 0) > now) continue;
  const plan = e.kind === 'shield' ? bank(e) : direct(e);
  if (!plan) {
    if (e.kind === 'shield') bot.bank[e.id] = now + 0.5;
    continue;
  }
  arcadeDown({ x: plan.sx, y: plan.sy });
  arcadeUp();
  bot.claimed[e.id] = now + plan.T + 0.12;
  bot.wait = now + 0.05;
  return;
}
`
};
