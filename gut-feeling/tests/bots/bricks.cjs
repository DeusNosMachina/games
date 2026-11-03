// Brick Rebellion controller: input only. Keeps a finger on the canvas and slides it so the soonest
// falling softball lands on the tray. Once that ball is below the rack, it traces every contact point
// through the live bricks and picks the one whose bounce reaches the most urgent brick soonest (a nurse
// call about to ring, a fortress weak point, then anything). Serves at once, chases good pills when no
// ball is due, steps around goo, and fires pillows at bricks overhead when the rack is nearly clear.
module.exports = {id: 2, policy: `
const B = mini.br, f = bricksFrame(), t = B.tray, R = BRICKS_R, lo = BRICKS_WALL + R, hi = BRICKS_FW - BRICKS_WALL - R;
const live = B.bricks.filter(b => b.hp > 0), boss = bricksFortress();
const fold = x => { const s = hi - lo; let u = (x - lo) % (2 * s); if (u < 0) u += 2 * s; return u <= s ? lo + u : lo + 2 * s - u; };
// Where and when a ball crosses the tray line, counting walls and the ceiling but not bricks.
const land = b => {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, time = 0;
  if (vy < 0) { const tc = (y - BRICKS_CEIL - R) / -vy; time += tc; x += vx * tc; y = BRICKS_CEIL + R; vy = -vy; }
  const td = Math.max(0, BRICKS_TRAY_Y - R - y) / vy; time += td; x += vx * td;
  return { x: fold(x), time };
};
const worth = b => b.kind === 'nurse' ? (b.ring < 6 ? 4 : 1.5) : b.kind === 'weak' ? 4 : b.kind === 'boss' ? (bricksGuarded(b) ? 0 : 3) : b.kind === 'blast' ? 1.6 : b.kind === 'star' ? 1.4 : 1;
// The first brick a bounce at angle a from (x, y) reaches, and how far it travels to get there.
const trace = (x, y, a) => {
  let vx = Math.sin(a), vy = -Math.cos(a), d = 0;
  for (let i = 0; i < 300; i++) {
    x += vx * 5; y += vy * 5; d += 5;
    if (x < lo) { x = 2 * lo - x; vx = -vx; } else if (x > hi) { x = 2 * hi - x; vx = -vx; }
    if (y < BRICKS_CEIL + R) { y = 2 * (BRICKS_CEIL + R) - y; vy = -vy; }
    if (vy > 0 && y > BRICKS_TRAY_Y - R) return null;
    for (const b of live) if (x > b.x - R && x < b.x + b.w + R && y > b.y - R && y < b.y + b.h + R) return { b, d };
  }
  return null;
};
// The game bends bounces toward the nearest brick in a dry spell or when two bricks are left; plan with it.
const home = B.dry >= 2 ? 0.6 : B.bricks.length <= 2 ? 0.5 : 0;
const plan = (o) => {
  const half = t.w / 2, minX = BRICKS_WALL + half, maxX = BRICKS_FW - BRICKS_WALL - half, y = BRICKS_TRAY_Y - R;
  const near = home ? bricksNearest(o.x, y) : null;
  let best = null;
  for (let u = -0.85; u <= 0.851; u += 0.05) {
    const tx = o.x - u * half;
    if (tx < minX || tx > maxX) continue;
    let a = u * BRICKS_MAX_ANGLE;
    if (Math.abs(a) < BRICKS_MIN_ANGLE) a = Math.sign(a || o.b.vx || 1) * BRICKS_MIN_ANGLE;
    if (near) {
      const w = clamp(Math.atan2(near.x + near.w / 2 - o.x, y - (near.y + near.h)), -BRICKS_MAX_ANGLE, BRICKS_MAX_ANGLE);
      a += (w - a) * home;
      if (Math.abs(a) < BRICKS_MIN_ANGLE) a = Math.abs(w) < BRICKS_MIN_ANGLE ? w : Math.sign(w) * BRICKS_MIN_ANGLE;
    }
    const hit = trace(o.x, BRICKS_TRAY_Y - R, a), score = hit ? worth(hit.b) * 1000 - hit.d : -1e9 + Math.abs(u);
    if (!best || score > best.score) best = { score, tx };
  }
  return best ? best.tx : o.x;
};
let want = t.x;
const flying = B.balls.filter(b => b.stuck === null).map(b => ({ b, ...land(b) }));
const falling = flying.filter(o => o.b.vy > 0).sort((a, b) => a.time - b.time);
const next = falling[0] || flying.sort((a, b) => a.time - b.time)[0];
if (next) {
  const low = live.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  if (next.b.vy > 0 && next.b.y > low + R && next.time < 0.7) {
    const key = next.b.id + ':' + Math.round(next.b.vx);
    if (bot.key !== key) { bot.key = key; bot.tx = plan(next); }
    want = bot.tx;
  } else want = next.x;
  // Chase a good pill when the ball is far away.
  const pill = B.pills.filter(p => p.kind !== 'goo').map(p => ({ p, time: (BRICKS_TRAY_Y - p.y) / p.vy }))
    .filter(o => o.time > 0 && o.time < next.time - 0.5).sort((a, b) => a.time - b.time)[0];
  if (pill && next.time > 0.9) want = pill.p.x;
}
// Step around goo when the ball can still land on the tray.
for (const o of [...B.goo, ...B.pills.filter(p => p.kind === 'goo')]) {
  const time = (BRICKS_TRAY_Y - o.y) / o.vy, gx = o.x + (o.vx || 0) * time;
  if (time < 0 || time > 0.45 || Math.abs(gx - want) > t.w / 2 + 14) continue;
  const side = gx < want ? 1 : -1, moved = gx + side * (t.w / 2 + 16);
  if (!next || Math.abs(next.x - moved) < t.w / 2 - 4) want = moved;
}
const x = clamp(want, 0, BRICKS_FW) + f.x, y = BRICKS_TRAY_Y + 40 + f.y;
if (!mini.pointer) arcadeDown({ x, y });
else arcadeMove({ x, y });
if (bricksHolding() && (bot.tap || 0) <= mini.total) {
  arcadeUp(); arcadeDown({ x, y }); bot.tap = mini.total + 0.3;
}
if (B.pillows > 0 && (live.length <= 6 || (boss && !bricksGuarded(boss)))) {
  if (live.some(b => t.x > b.x - 4 && t.x < b.x + b.w + 4 && !(b.kind === 'boss' && bricksGuarded(b)))) miniAction('pillow');
}
`};
