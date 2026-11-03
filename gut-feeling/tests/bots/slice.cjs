// Gel Yeah controller: every 0.04 s, one short stroke through the most urgent gremlin (the jumbo, then
// gold, then whatever is lowest and falling), turned until it clears every bomb by a margin. A helmet
// or the jumbo just gets the next stroke too.
module.exports = {
  id: 4,
  policy: `
if (mini.total - (bot.last || 0) > 0.04) {
  const A = sliceArena();
  const bombs = mini.gels.filter(k => k.kind === 'bomb' && !k.dead);
  const live = mini.gels.filter(o => o.kind !== 'bomb' && !o.dead && !o.blown && o.y > 60 && o.y < A.H - 10 && o.x > 10 && o.x < A.W - 10);
  const rank = o => (o.kind === 'jumbo' ? -2 : o.kind === 'gold' ? -1 : -o.y / A.H - (o.vy > 0 ? 0.5 : 0));
  live.sort((a, b) => rank(a) - rank(b));
  search: for (const o of live) {
    for (const d of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      const a = { x: o.x - Math.cos(d) * 10, y: o.y - Math.sin(d) * 10 };
      const b = { x: o.x + Math.cos(d) * 10, y: o.y + Math.sin(d) * 10 };
      if (bombs.some(k => pointSegment(k, a, b) < k.r + 10)) continue;
      arcadeDown(a);
      arcadeMove(b);
      arcadeUp();
      bot.last = mini.total;
      break search;
    }
  }
}
`
};
