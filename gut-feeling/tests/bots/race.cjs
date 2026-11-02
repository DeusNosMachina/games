// Gurney Grand Prix controller: reads the next slice of traffic, picks the best safe lane
// (stunts until the stunt quota is met, then coins), and times jumps, slides, slams, throws,
// gunk dodges and curve counter-steers. Input actions only; it reads state and pure helpers.
module.exports = {
  id: 3,
  policy: `
const sp = mini.raceSpeedNow || 150;
const lane = raceCartLane();
const ev = [];
for (const r of mini.rows)
  for (const o of r.objects) {
    if (o.done) continue;
    const t = raceEta(r, o, sp);
    if (t < -0.05) continue;
    const lanes = o.kind === 'nurse'
      ? [raceNurseLaneAt(o, Math.max(0, t - 0.15)), raceNurseLaneAt(o, t), raceNurseLaneAt(o, t + 0.12)]
      : [o.lane];
    ev.push({ o, r, t, lanes });
  }
const gunk = mini.raceGunk.filter(k => !k.done).map(k => ({ lane: k.lane, t: (RACE_LINE - k.y) / k.vy }));
const c = mini.raceCurve;
if (c && c.warn > 0) miniAction(c.dir > 0 ? 'right' : 'left');
if (ev.length) {
  const t0 = Math.min(...ev.map(e => e.t));
  const slice = ev.filter(e => e.t <= t0 + 0.15);
  const info = L => {
    let hazard = false, stunt = 0, reward = 0;
    for (const e of slice) {
      if (!e.lanes.includes(L)) continue;
      const k = e.o.kind;
      if (k === 'coin') reward += 2;
      else if (k === 'boost') reward += 3;
      else if (k === 'ramp') stunt += 2;
      else if (k === 'crate') { if (e.t < 0.1 && mini.jump < 25) hazard = true; else stunt += 1; }
      else if (k === 'bar') { if (e.t < 0.1 && mini.jump > 0) hazard = true; else stunt += 1; }
      else if (k === 'gremlin' || k === 'iv') {
        if (e.o.hp <= 0) continue;
        if (e.t > e.o.hp * 0.38 + (L === lane ? 0.2 : 0.35)) stunt += 1;
        else hazard = true;
      } else if (k === 'wall' || k === 'nurse') hazard = true;
    }
    for (const g of gunk) if (g.lane === L && (g.t < 0.45 || Math.abs(g.t - t0) < 0.35)) hazard = true;
    return { hazard, stunt, reward };
  };
  const wantStunts = mini.stunts < mini.stuntGoal;
  let best = mini.lane, bestScore = -1e9;
  for (const L of [0, 1, 2]) {
    const i = info(L);
    if (i.hazard) continue;
    let score = wantStunts ? i.stunt * 10 + i.reward : i.reward * 10 + i.stunt * 3;
    score -= Math.abs(L - mini.lane) * 0.5;
    if (Math.abs(L - lane) === 2 && t0 < 0.25) score -= 50;
    if (score > bestScore) { bestScore = score; best = L; }
  }
  // Gunk about to land in our lane: sidestep to a neighbour that is clear when it lands.
  const threat = gunk.find(g => g.lane === mini.lane && g.t < 0.45);
  const live = e => !['coin', 'boost', 'ramp'].includes(e.o.kind) && !(['gremlin', 'iv'].includes(e.o.kind) && e.o.hp <= 0);
  if (threat) {
    const busy = L => ev.some(e => live(e) && e.lanes.includes(L) && e.t > -0.05 && e.t < threat.t + 0.3);
    const side = [mini.lane - 1, mini.lane + 1].find(L => L >= 0 && L <= 2 && !busy(L));
    if (side !== undefined) miniAction(side < mini.lane ? 'left' : 'right');
  } else if (best !== mini.lane) {
    // Never step into (or through) a lane where gunk is about to land.
    const next = mini.lane + Math.sign(best - mini.lane);
    if (!gunk.some(g => g.lane === next && g.t < 0.5)) miniAction(best > mini.lane ? 'right' : 'left');
  }
  for (const e of slice) {
    if (!e.lanes.includes(lane) || mini.lane !== lane) continue;
    const k = e.o.kind;
    if (k === 'crate' && e.t <= 0.4 && e.t > 0.08 && mini.jump === 0) miniAction('jump');
    if (k === 'bar' && e.t <= 0.3 && (mini.jump > 0 || mini.slide < e.t + 0.05)) miniAction('slide');
  }
  const block = ev
    .filter(e => e.lanes.includes(lane) && ['gremlin', 'iv', 'wall', 'nurse'].includes(e.o.kind))
    .filter(e => !(['gremlin', 'iv'].includes(e.o.kind) && e.o.hp <= 0))
    .sort((a, b) => a.t - b.t)[0];
  if (block && ['gremlin', 'iv'].includes(block.o.kind) && block.t > 0.1 && block.r.y + (block.o.dy || 0) > 40)
    miniAction('throw');
}
`
};
