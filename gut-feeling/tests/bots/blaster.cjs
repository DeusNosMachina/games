// Bedside Blaster controller: taps the most urgent gremlin's head (leading crawlers a little), taps the
// edge arrow (or slides into the edge band) when the target is off-screen, hits the green on every
// reload, and shoots juice when low.
module.exports = {id: 5, policy: `
if (mini.reload > 0) {
  const w = blasterReloadWindow();
  if (!mini.reloadTry && mini.reloadT > w[0] + 0.02 && mini.reloadT < w[1] - 0.02) miniAction('reload');
  return;
}
if (mini.blasterQueue.length || mini.shotCd > 0 || (bot.wait || 0) > mini.total) return;
const urgency = e => e.kind === 'boss' ? (blasterBossOpen(e) ? 5 : -1)
  : e.mode === 'leap' ? 6 : e.mode === 'wind' ? 4 + (1 - e.wind / e.windMax)
  : e.mode === 'crawl' ? 2 + e.crawlT / e.creepDur : e.mode === 'hide' && e.peek > 0.9 ? 1 : -1;
const live = mini.targets.filter(e => BLASTER_KINDS[e.kind] && e.mode !== 'dying' && urgency(e) >= 0);
live.sort((a, b) => urgency(b) - urgency(a));
let e = live[0];
const bottle = mini.targets.find(b => b.kind === 'bottle');
if ((!e || urgency(e) < 3) && bottle && mini.ammo <= 4) e = bottle;
if (!e) {
  if (bot.look) {
    bot.look = false;
    arcadeUp();
  }
  if (mini.ammo < 4) miniAction('reload');
  return;
}
const p = shooterProjection(e), s = p.s, lead = e.mode === 'crawl' ? 0.1 : 0;
const ax = e.kind === 'bottle' ? p.x : e.kind === 'boss' ? p.x + 2 * s : p.x + s + (e.vx || 0) * lead;
const ay = e.kind === 'bottle' ? p.y : e.kind === 'boss' ? p.y + 17 * s : p.y + 2 * s + (e.vy || 0) * lead;
// Off-screen: slide a finger into the edge band and hold it there until the gremlin scrolls in, then
// lift (a lift while the room still scrolls is only a look).
const off = ax < 30 || ax > 570 || ay < 60 || ay > 540;
if (bot.look) {
  if (off) return;
  bot.look = false;
  arcadeUp();
  return;
}
// Past the edge: tap its arrow, which turns the room to face it.
if (ax < 0 || ax > 600) {
  const a = blasterArrows().find(q => q.side === (ax < 0 ? -1 : 1));
  if (a) {
    arcadeDown({x: a.x + 30, y: a.y});
    arcadeUp();
    bot.wait = mini.total + 0.15;
    return;
  }
}
if (off) {
  bot.look = true;
  arcadeDown({x: 300, y: 300});
  arcadeMove({x: ax < 30 ? 2 : ax > 570 ? 598 : 300, y: ay < 60 ? 2 : ay > 540 ? 598 : 300});
  return;
}
arcadeDown({x: ax, y: ay});
arcadeUp();
`};
