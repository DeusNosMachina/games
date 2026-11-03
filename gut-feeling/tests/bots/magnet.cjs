// Loud Donut Pinball controller: input only, through the same touch() hook a phone uses. It reads the
// balls' positions and velocities, taps to launch, follows each ball's flight under gravity and flips
// a side just as a ball reaches that flipper, and holds the flip briefly. It fires the magnet (both
// flippers) for a ball dropping into an outlane with no kickback lit (a beat early, since the magnet
// takes a tenth of a second to arm), or one headed between the flippers where neither can reach it. An
// outlane ball rides the magnet until it is clear of the lane (on the right, clear of the drop targets
// above it); a gap ball until it is climbing. It spends no heat in multiball or under a ball save, so the
// last ball has the magnet. While the heave holds the table still it lets go of everything, so the first
// flip after it is a fresh one. It never aims at the green targets: the Barf-o-meter fills on its own.
module.exports = {id: 1, policy: `
const W = activeCanvas().w, now = mini.total, at = s => ({x: s ? W * 0.75 : W * 0.25, y: 300});
bot.down = bot.down || [false, false];
bot.until = bot.until || [0, 0];
bot.cool = bot.cool || [0, 0];
const press = s => { if (!bot.down[s]) { MAGNET.touch('down', at(s), s + 1); bot.down[s] = true; } };
const lift = s => { if (bot.down[s]) { MAGNET.touch('up', at(s), s + 1); bot.down[s] = false; bot.cool[s] = now + 0.05; } };
if (bot.launch) { MAGNET.touch('up', {x: W / 2, y: 300}, 9); bot.launch = false; return; }
if (magnetWaiting()) { lift(0); lift(1); MAGNET.touch('down', {x: W / 2, y: 300}, 9); bot.launch = true; return; }
if (magnetHolding()) { lift(0); lift(1); bot.until = [0, 0]; bot.cool = [0, 0]; return; }
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
// A ball the magnet is lifting out of an outlane rides it until it is clear: above the divider post on
// the left, and on the right above the drop-target bank that sits over that lane (or out of its column).
const lifting = b => mini.pinMagOn && b.vy < 0 && (b.x < D + 14 ? b.y > 455 : b.x > 2 * MAGNET_CX - D - 14 && b.x < MAGNET_LANE.x0 && b.y > (mini.pinDrops ? 330 : 455));
// The heat is saved for the last ball: no magnet in multiball (a spare ball costs nothing) or while a
// ball save would throw it back anyway.
const spare = mini.pinBalls.filter(magnetLive).length > 1 || mini.pinSave > 0.3;
// The magnet takes a tenth of a second to arm, so it fires for a ball about to drop into a dark outlane.
const column = (x, y) => y > 470 && ((x < D + 4 && !mini.pinKick[0]) || (x > 2 * MAGNET_CX - D - 4 && x < MAGNET_LANE.x0 && !mini.pinKick[1]));
const entering = b => b.vy > 0 && b.y > 380 && !column(b.x, b.y) && (fly(b, column) ?? 1) < 0.12;
const danger = spare ? [] : live.filter(b => (outlane(b) && b.vy > -260) || lifting(b) || entering(b) || gap(b));
if (danger.length && !mini.pinHot) { bot.until[0] = Math.max(bot.until[0], now + 0.05); bot.until[1] = Math.max(bot.until[1], now + 0.05); }
for (const f of mini.pinFlips) {
  const s = f.side;
  if (bot.down[s] || now < bot.cool[s]) continue;
  for (const b of live) { const t = fly(b, (x, y) => over(f, x, y)); if (t !== null && t <= 0.02) { bot.until[s] = Math.max(bot.until[s], now + 0.16); break; } }
}
for (const s of [0, 1]) { if (bot.until[s] > now) press(s); else lift(s); }
`};
