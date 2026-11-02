// Gel Yeah controller: short strokes along each target's arrow (or sideways), gold first, numbered
// sets in order, never through a bomb. On level 3 it flicks lit bombs that block a target.
module.exports = {
  id: 4,
  policy: `
if (mini.total - (bot.last || 0) > 0.05) {
  const bombs = mini.gels.filter(k => k.bomb && !k.dead && !k.flicked);
  const live = mini.gels.filter(o => !o.bomb && !o.dead && o.y > 80 && o.y < 560 && o.x > 30 && o.x < 570);
  const rank = o => {
    if (o.gold) return 0;
    if (o.num) {
      const s = mini.sliceSets[o.set];
      if (s && !s.broken) return s.next === o.num ? 1 : 9;
    }
    return 2 + (600 - o.y) / 600 - (o.vy > 0 ? 0.5 : 0);
  };
  live.sort((a, b) => rank(a) - rank(b));
  for (const o of live) {
    const d = o.dir !== undefined ? o.dir : 0;
    const a = { x: o.x - Math.cos(d) * 12, y: o.y - Math.sin(d) * 12 };
    const b = { x: o.x + Math.cos(d) * 12, y: o.y + Math.sin(d) * 12 };
    const blocker = bombs.find(k => pointSegment(k, a, b) < k.r + 12);
    if (blocker) {
      const flickPath = [{ x: blocker.x, y: blocker.y + 14 }, { x: blocker.x, y: blocker.y - 14 }];
      const clear = !bombs.some(k => k !== blocker && pointSegment(k, flickPath[0], flickPath[1]) < k.r + 12);
      if (SLICE_TIERS[mini.tier].flick && blocker.lit && clear) {
        arcadeDown(flickPath[0]);
        arcadeMove(flickPath[1]);
        arcadeUp();
        bot.last = mini.total;
        break;
      }
      continue;
    }
    arcadeDown(a);
    arcadeMove(b);
    arcadeUp();
    bot.last = mini.total;
    break;
  }
}
`
};
