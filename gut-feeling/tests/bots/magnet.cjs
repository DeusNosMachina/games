// Loud Donut Pinball controller: input only, through the same touch() hook a phone uses. It reads the
// balls' positions and velocities, taps to launch, follows each ball's flight under gravity and flips
// a side just as a ball reaches that flipper, and holds the flip briefly. It fires the magnet (both
// flippers) for a ball in an outlane with no kickback lit, or one headed between the flippers where
// neither can reach it, and lets go as soon as that ball is climbing back into play.
module.exports = {id: 1, policy: `
const W = activeCanvas().w, now = mini.total, at = s => ({x: s ? W * 0.75 : W * 0.25, y: 300});
bot.down = bot.down || [false, false];
bot.until = bot.until || [0, 0];
bot.cool = bot.cool || [0, 0];
const press = s => { if (!bot.down[s]) { MAGNET.touch('down', at(s), s + 1); bot.down[s] = true; } };
const lift = s => { if (bot.down[s]) { MAGNET.touch('up', at(s), s + 1); bot.down[s] = false; bot.cool[s] = now + 0.05; } };
if (bot.launch) { MAGNET.touch('up', {x: W / 2, y: 300}, 9); bot.launch = false; return; }
if (magnetWaiting()) { lift(0); lift(1); MAGNET.touch('down', {x: W / 2, y: 300}, 9); bot.launch = true; return; }
const live = mini.pinBalls.filter(b => b.state === 'play'), g = mini.pinLv.gravity, R = MAGNET_BALL, D = mini.pinLv.divider;
// Is (x, y) over flipper f's blade, within reach above it?
const over = (f, x, y) => {
  const ux = Math.cos(f.rest), uy = Math.sin(f.rest), rx = x - f.x, ry = y - f.y;
  const along = rx * ux + ry * uy, across = -rx * uy + ry * ux, side = f.side ? -across : across;
  return along > 8 && along < MAGNET_FLIP.len + 6 && side < 0 && side > -(R + 26);
};
const fly = (b, test) => { for (let t = 0; t <= 0.6; t += 0.005) { const x = b.x + b.vx * t, y = b.y + b.vy * t + 0.5 * g * t * t; if (test(x, y)) return t; if (y > 730) break; } return null; };
const outlane = b => b.y > 430 && ((b.x < D + 4 && !mini.pinKick[0]) || (b.x > 2 * MAGNET_CX - D - 4 && b.x < MAGNET_LANE.x0 && !mini.pinKick[1]));
const gap = b => b.vy > 0 && fly(b, (x, y) => y > 668 && Math.abs(x - MAGNET_CX) < 24) !== null && !mini.pinFlips.some(f => fly(b, (x, y) => over(f, x, y)) !== null);
const danger = live.filter(b => (outlane(b) && b.vy > -260) || gap(b));
if (danger.length && !mini.pinHot) { bot.until[0] = Math.max(bot.until[0], now + 0.05); bot.until[1] = Math.max(bot.until[1], now + 0.05); }
for (const f of mini.pinFlips) {
  const s = f.side;
  if (bot.down[s] || now < bot.cool[s]) continue;
  for (const b of live) { const t = fly(b, (x, y) => over(f, x, y)); if (t !== null && t <= 0.02) { bot.until[s] = Math.max(bot.until[s], now + 0.16); break; } }
}
for (const s of [0, 1]) { if (bot.until[s] > now) press(s); else lift(s); }
`};
