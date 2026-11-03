// Gel Yeah rules: a press or a swipe cuts, bombs need a real swipe well inside them, a bomb is an oops
// that clears the screen (and no longer crashes a stroke that ends the run), helmets take two hits
// (a zig-zag counts), blue gremlins split into kids that never count as drops, strokes bank combos
// with slow motion and a zoom on the big ones, combos fill the party meter, gold or a full meter start
// a hazard-free frenzy, drops add up to an oops (gentler on level 1), the pacing breathes (bursts,
// lulls, a tempo that climbs through the round and after combos), tosses vary and stay sliceable,
// hazards by level (level 1: two lone warned bombs; level 2: bombs, first clear, later in the rows;
// level 3 and Legendary: laughing gas too, in the lineup), laughing gas fogs instead of costing a
// heart, four levels with a Legendary that idle play loses, every level ends on a jumbo gel, cuts land
// where the zoomed camera draws, and the portrait canvas lays out (and turns) cleanly.
const { run, close, assert } = require('./harness.cjs');
run('let rng=11;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');

// A clean run with no automatic tosses, gold, lone bombs or jumbo.
function fresh(tier = 1) {
  close();
  run(
    `state.difficulty=1;openMini(4);mini.tier=${tier};startMini();launchMini();updateMini(3.3);` +
      'mini.spawn=1e9;mini.sliceRestUntil=1e9;mini.sliceGoldAt=[];mini.sliceLoneAt=[];mini.sliceJumboDone=true;mini.gels=[];mini.sliceQueue=[];mini.got=0;mini.score=0'
  );
  assert.equal(run('mini.screen'), 'play');
}
const gel = (id, x, y, extra = '') =>
  `{id:${id},kind:'plain',x:${x},y:${y},r:31,hp:1,stroke:-1,lock:0,vx:0,vy:0,angle:0,spin:0,age:0,entered:true${extra}}`;
const bombAt = (id, x, y) => gel(id, x, y, ",kind:'bomb',r:29");
const gasAt = (id, x, y) => gel(id, x, y, ",kind:'gas',r:28");
const swipe = (x1, y1, x2, y2) => run(`arcadeDown({x:${x1},y:${y1}});arcadeMove({x:${x2},y:${y2}});arcadeUp()`);
const j = s => JSON.parse(run('JSON.stringify(' + s + ')'));

// A press on a gremlin cuts it (every touch acts on pointerdown); a swipe cuts everything it crosses.
fresh(0);
run(`mini.gels=[${gel(1, 300, 250)}];arcadeDown({x:305,y:255})`);
assert.equal(run('mini.got'), 1, 'a press on a gremlin slices it');
run('arcadeUp()');
run(`mini.gels=[${gel(2, 200, 250)},${gel(3, 300, 260)},${gel(4, 400, 250)}]`);
swipe(150, 250, 450, 255);
assert.equal(run('mini.got'), 4);
assert.equal(run('mini.sliceHalves.length'), 8, 'every cut leaves two halves');
assert.ok(run('mini.sliceDrops.length') >= 30, 'and a spray of gel');
assert.equal(run('mini.sliceStains.length'), 4, 'and a stain on the glass');
console.log('PASS: a press or a swipe cuts, with halves, droplets and stains.');

// Bombs: a press never sets one off, a near miss is free, a real swipe through one is an oops that
// shakes the screen and blows every other gremlin off it (no cut, no drop).
fresh(1);
run(`mini.gels=[${bombAt(5, 300, 250)}];arcadeDown({x:300,y:250});arcadeUp();updateSlice(1/60)`);
assert.equal(run('mini.miss'), 0, 'a press is not a swipe');
swipe(250, 250 - 29, 350, 250 - 29);
run('updateSlice(1/60)');
assert.equal(run('mini.miss'), 0, 'grazing the edge is free');
run(`mini.gels=[${bombAt(6, 300, 250)},${gel(7, 150, 300)},${gel(8, 480, 200)}]`);
swipe(250, 250, 350, 250);
assert.equal(run('mini.miss'), 0, 'the oops waits for the next update');
run('updateSlice(1/60)');
assert.equal(run('mini.miss'), 1);
assert.equal(run('mini.got'), 0, 'bombs never count as cuts');
assert.ok(run('mini.sliceShake') > 0, 'the screen shakes');
assert.equal(run('mini.gels.filter(o=>o.blown).length'), 2, 'the blast clears the screen');
run('for(let i=0;i<180;i++)updateMini(1/60)');
assert.equal(run('mini.sliceDropped'), 0, 'blown gremlins are not drops');
console.log('PASS: bombs need a real swipe, near misses are free, a hit shakes and clears the screen.');

// Bug fix: when a bomb is the oops that ends the run, the rest of the stroke must not crash.
fresh(1);
run(`mini.miss=mini.rules.misses-1;mini.gels=[${bombAt(9, 280, 250)},${gel(10, 380, 250)}]`);
assert.doesNotThrow(() => run('arcadeDown({x:240,y:250});arcadeMove({x:420,y:250});arcadeMove({x:440,y:260})'));
assert.equal(run('mini.got'), 0, 'the blast took the other gremlin');
assert.doesNotThrow(() => run('updateMini(1/60);arcadeMove({x:460,y:270});arcadeUp()'));
assert.equal(run('mini.screen'), 'outro');
assert.equal(run('mini.pointer'), null);
console.log('PASS: a run-ending bomb mid-stroke does not throw on a null pointer.');

// Helmets take two hits: a second stroke, or the same stroke coming back after a beat.
fresh(1);
run(`mini.gels=[${gel(11, 300, 250, ",kind:'helmet',hp:2,r:32")}]`);
swipe(250, 250, 350, 250);
assert.equal(run('mini.gels[0].hp'), 1, 'the helmet pops off');
assert.equal(run('mini.got'), 0);
swipe(350, 250, 250, 250);
assert.equal(run('mini.got'), 1, 'the second stroke cuts');
run(`mini.gels=[${gel(12, 300, 250, ",kind:'helmet',hp:2,r:32")}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250})`);
assert.equal(run('mini.got'), 1);
run('for(let i=0;i<8;i++)updateSlice(1/60);mini.gels[0].x=300;mini.gels[0].y=250;arcadeMove({x:250,y:250});arcadeUp()');
assert.equal(run('mini.got'), 2, 'a zig-zag in one stroke counts as two hits');
console.log('PASS: helmets take two hits, zig-zags included.');

// Blue gremlins split into two kids; kids are a bonus and never count as drops.
fresh(1);
run(`mini.gels=[${gel(13, 300, 250, ",kind:'blue'")}]`);
swipe(250, 250, 350, 250);
assert.equal(run("mini.gels.filter(o=>o.kind==='kid'&&!o.dead).length"), 2);
run('for(let i=0;i<240;i++)updateMini(1/60)');
assert.equal(run('mini.sliceDropped'), 0, 'kids that fall are not drops');
console.log('PASS: blue gremlins split into kids that never count as drops.');

// Combos: three or more cut close together in one stroke bank a bonus, a banner and party points;
// four or more add slow motion and a zoom. Separate strokes never combo.
fresh(1);
run(`mini.gels=[${gel(20, 150, 250)},${gel(21, 300, 250)},${gel(22, 450, 250)}]`);
swipe(100, 250, 500, 250);
assert.equal(run('mini.sliceCombos'), 1);
assert.equal(run('mini.maxCombo'), 3);
assert.equal(run('mini.score'), 30 + 30, 'three cuts plus a 30 point combo');
assert.equal(run('mini.sliceMeter'), 1);
assert.match(run('mini.sliceBanner.text'), /3 GEL COMBO/);
assert.equal(run('mini.sliceSlowmo'), 0, 'three is not big enough for slow motion');
run(`mini.gels=[${gel(23, 150, 250)},${gel(24, 300, 250)}]`);
swipe(100, 250, 200, 250);
swipe(250, 250, 350, 250);
assert.equal(run('mini.sliceCombos'), 1, 'two strokes are not a combo');
run(`mini.gels=[${gel(25, 120, 250)},${gel(26, 240, 250)},${gel(27, 360, 250)},${gel(28, 480, 250)}]`);
run('arcadeDown({x:80,y:250});arcadeMove({x:520,y:250})');
assert.equal(run('mini.sliceRun.n'), 4, 'the stroke counts live');
run('arcadeUp()');
assert.equal(run('mini.sliceCombos'), 2);
assert.ok(run('mini.sliceSlowmo') > 0, 'four in a swipe slows the gremlins');
assert.ok(run('reduced || mini.sliceZoom.s > 0'), 'and punches the camera in (unless motion is reduced)');
const clock = run('mini.phaseTime');
run('updateMini(0.1)');
assert.ok(Math.abs(run('mini.phaseTime') - clock - 0.1) < 1e-9, 'slow motion never slows the clock');
// A held stroke that pauses between cuts banks them as separate groups.
run(`mini.sliceCombos=0;mini.gels=[${gel(30, 150, 250)},${gel(31, 250, 250)},${gel(32, 350, 250)}]`);
run('arcadeDown({x:120,y:250});arcadeMove({x:270,y:250});for(let i=0;i<30;i++)updateMini(1/60);arcadeMove({x:380,y:250});arcadeUp()');
assert.equal(run('mini.sliceCombos'), 0, 'a long pause splits the stroke');
console.log('PASS: strokes bank combos, big ones slow the gremlins (never the clock) and zoom.');

// The party: a full meter or a gold gremlin starts a frenzy. Bombs and gas fizzle, volleys are
// hazard-free, cuts pay double, and party gremlins that fall are never drops.
fresh(1);
run(`mini.sliceMeter=SLICE_TIERS[1].meter-1;mini.gels=[${gel(40, 150, 250)},${gel(41, 300, 250)},${gel(42, 450, 250)},${bombAt(43, 300, 450)},${gasAt(48, 120, 450)}]`);
swipe(100, 250, 500, 250);
assert.ok(run('mini.sliceFrenzy') > 4, 'a full meter starts the party');
assert.equal(run("mini.gels.some(o=>SLICE_KINDS[o.kind].hazard&&!o.dead)"), false, 'bombs and gas fizzle');
fresh(1);
run(`mini.gels=[${gel(44, 300, 250, ",kind:'gold',r:29")},${bombAt(45, 450, 250)}];mini.sliceQueue=[{delay:1,gel:${bombAt(46, 300, 640)}}]`);
swipe(280, 250, 320, 250);
assert.ok(run('mini.sliceFrenzy') > 4, 'gold starts the party');
assert.equal(run("mini.gels.some(o=>o.kind==='bomb'&&!o.dead)||mini.sliceQueue.some(q=>q.gel.kind==='bomb')"), false);
assert.equal(run("spawnGelWave().filter(o=>o.kind==='bomb').length"), 0);
run(`mini.score=0;mini.gels.push(${gel(47, 300, 400)})`);
swipe(280, 400, 320, 400);
assert.equal(run('mini.score'), 20, 'party cuts pay double');
let seen = 0;
for (let i = 0; i < 300 && run('mini.sliceFrenzy') > 0; i++) {
  run('updateMini(1/60)');
  assert.equal(run("mini.gels.some(o=>o.kind==='bomb')||mini.sliceQueue.some(q=>q.gel.kind==='bomb')"), false, 'bomb during frenzy');
  seen = Math.max(seen, run('mini.gels.length'));
}
assert.ok(seen >= 6, `the party streams gremlins (${seen} at once)`);
run('for(let i=0;i<240;i++)updateMini(1/60)');
assert.equal(run('mini.sliceDropped'), 0, 'party gremlins never count as drops');
console.log('PASS: gold or a full meter start a hazard-free, double-points frenzy.');

// Drops: an allowance per level adds up to an oops; level 1 is the most forgiving.
fresh(1);
const allowance = j('SLICE_TIERS.map(t=>t.escapes)');
assert.ok(allowance[0] > allowance[1] && allowance[1] >= allowance[2], `drops per heart: ${allowance}`);
run(`for(let i=0;i<${allowance[1] - 1};i++)sliceEscape({x:300})`);
assert.equal(run('mini.miss'), 0);
run('sliceEscape({x:300})');
assert.equal(run('mini.miss'), 1);
assert.match(run('mini.flashText'), /DROPPED/);
run(`mini.sliceDropped=0;mini.gels=[${gel(50, 300, 690, ',vy:10')}];updateSlice(1/60)`);
assert.equal(run('mini.sliceDropped'), 1, 'a gremlin that falls off the bottom is a drop');
run(`mini.gels=[${gel(51, 300, 690, ',vy:10,entered:false')}];updateSlice(1/60)`);
assert.equal(run('mini.sliceDropped'), 1, 'one that never made it on screen is not');
console.log('PASS: drops add up to an oops, gentlest on level 1.');

// Tosses spread out: no toss with two or more gremlins peaks inside one 60px column.
for (let tier = 0; tier < 4; tier++) {
  fresh(tier);
  for (let shift = 0; shift < 3; shift++) {
    for (let i = 0; i < 40; i++) {
      const apex = j(
        `(mini.shift=${shift},mini.phaseTime=30,mini.sliceQueue=[],mini.sliceWaves=1,spawnGelWave().filter(o=>!SLICE_KINDS[o.kind].hazard&&o.kind!=='gold').map(o=>sliceApex(o).x))`
      );
      assert.ok(apex.length >= 1, `toss size ${apex.length}`);
      if (apex.length >= 2) assert.ok(Math.max(...apex) - Math.min(...apex) > 60, `tier ${tier} shift ${shift} clumped: ${apex} ${run("mini.sliceLastToss")} ${run("JSON.stringify(mini.sliceQueue.map(q=>q.gel.kind))")}`);
    }
  }
}
console.log('PASS: tosses spread their apexes across the screen.');

// Toss variety: singles, pairs, lobs, low fast ones, floaters, crossing arcs and the formations, never
// the same toss twice in a row, launched from all along the bottom at many heights and spins.
fresh(1);
run('mini.sliceLastToss=null;var vlog={names:[],x0:[],ay:[],spin:{},grav:{},cross:0}');
for (let i = 0; i < 300; i++)
  run(`(()=>{mini.shift=${i % 3};mini.phaseTime=${(i % 3) * 25 + 5};mini.sliceHeat=${(i % 5) * 0.1};mini.sliceQueue=[];
    const before=mini.sliceLastToss,wave=spawnGelWave().filter(o=>!SLICE_KINDS[o.kind].hazard&&o.kind!=='gold'),name=mini.sliceLastToss,A=sliceArena();
    if(name===before)vlog.repeat=name;
    vlog.names.push(name);
    for(const o of wave){vlog.x0.push(o.x/A.W);vlog.ay.push(sliceApex(o).y/A.H);(vlog.spin[name]=vlog.spin[name]||[]).push(Math.abs(o.spin));(vlog.grav[name]=vlog.grav[name]||[]).push(o.grav||1)}
    if(name==='cross'&&wave.length===2){const [a,b]=wave;if(Math.sign(a.vx)!==Math.sign(b.vx)&&Math.sign(a.x-A.W/2)!==Math.sign(sliceApex(a).x-A.W/2))vlog.cross++}
  })()`);
const v = j('vlog');
assert.equal(v.repeat, undefined, `a toss repeated back to back: ${v.repeat}`);
const kinds = new Set(v.names);
for (const k of ['single', 'pair', 'lob', 'floater', 'low', 'cross', 'line', 'arc', 'v', 'diag', 'fan', 'drum'])
  assert.ok(kinds.has(k), `the ${k} toss shows up: ${[...kinds]}`);
assert.ok(Math.min(...v.x0) < 0.12 && Math.max(...v.x0) > 0.88, 'launches come from all along the bottom, corners included');
assert.ok(Math.min(...v.ay) < 0.21 && Math.max(...v.ay) > 0.5, 'apexes run from a high lob to a low skim');
assert.ok(Math.max(...v.spin.lob) <= 0.5 && Math.min(...v.spin.low) >= 3, 'lobs barely spin, low ones spin hard');
assert.ok(v.grav.floater.every(g => g < 1) && v.grav.low.every(g => g > 1), 'floaters drift, low ones zip');
assert.ok(v.cross > 5, `crossing arcs come from both sides and cross over (${v.cross})`);
console.log('PASS: tosses vary in launch point, height, spin and path, never the same twice in a row.');

// Every toss stays sliceable: each gremlin spends at least a second inside the reachable glass, even
// at the fastest flight there is (Legendary on Absolute Gutastrophe), on both canvases.
for (const portrait of [false, true]) {
  close();
  if (portrait) run('window.innerWidth=390;window.innerHeight=844');
  run('state.difficulty=2;openMini(4);mini.tier=3;startMini();launchMini();updateMini(3.3)');
  assert.equal(run('mini.portrait'), portrait);
  const worst = run(`(()=>{const A=sliceArena(),k=sliceRate();let worst=9;
    for(let i=0;i<400;i++){mini.shift=i%3;mini.phaseTime=5+(i%3)*18;mini.sliceQueue=[];
      for(const o0 of spawnGelWave()){if(SLICE_KINDS[o0.kind].hazard)continue;
        const o={...o0};let t=0,inside=0;const dt=1/120;
        while(t<8&&!(o.y>A.H+o.r+24&&o.vy>0)){o.vy+=A.G*(o.grav||1)*dt*k;o.x+=o.vx*dt*k;o.y+=o.vy*dt*k;
          if((o.x<o.r*0.7&&o.vx<0)||(o.x>A.W-o.r*0.7&&o.vx>0))o.vx*=-0.7;
          if(o.x>15&&o.x<A.W-15&&o.y>60&&o.y<A.H-15)inside+=dt;t+=dt}
        worst=Math.min(worst,inside)}}
    return worst})()`);
  assert.ok(worst >= 1, `${portrait ? 'portrait' : 'square'}: a toss is on the glass only ${worst.toFixed(2)} s`);
  close();
  run('delete window.innerWidth;delete window.innerHeight;resize()');
}
console.log('PASS: every toss stays on the reachable glass for at least a second at the fastest pace.');

// Pacing with breath. The tempo climbs through the round; a combo adds heat and brings the next toss
// sooner; a burst ends on a breath that waits for the screen to clear, then holds a beat of nothing.
fresh(0);
run('mini.sliceHeat=0;mini.phaseTime=3');
const t0 = run('sliceTempo()');
run('mini.phaseTime=45');
const t1 = run('sliceTempo()');
assert.ok(t0 < 0.1 && t1 > 0.85, `level 1 tempo climbs from ${t0} to ${t1}`);
fresh(1);
run('mini.phaseTime=10;mini.sliceHeat=0;mini.sliceLull=null;mini.spawn=5');
const cold = run('sliceTempo()');
run(`mini.gels=[${gel(80, 150, 250)},${gel(81, 300, 250)},${gel(82, 450, 250)}]`);
swipe(100, 250, 500, 250);
assert.ok(run('mini.sliceHeat') > 0 && run('sliceTempo()') > cold, 'a combo heats the tempo up');
assert.ok(run('mini.spawn') < 1, 'and the next toss comes sooner');
run(`mini.sliceLull={held:3,beat:1};mini.gels=[${gel(83, 150, 250)},${gel(84, 300, 250)},${gel(85, 450, 250)}]`);
swipe(100, 250, 500, 250);
assert.ok(run('mini.sliceLull.beat') < 0.7, 'a combo cuts a breath short');
run('for(let i=0;i<600;i++)updateMini(1/60)');
assert.ok(run('mini.sliceHeat') < 0.15, 'heat cools off');
// The breath: one toss ends the burst, nothing new launches while it is up, then a beat of nothing.
fresh(0);
run('mini.sliceRestUntil=0;mini.phaseTime=8;mini.sliceWaves=1;mini.sliceHeat=0;mini.sliceLull=null;mini.sliceBurst=1;mini.spawn=0;sliceSpawns(1/60)');
assert.equal(run('mini.sliceWaves'), 2, 'the toss launches');
assert.ok(run('mini.sliceLull!==null'), 'and the burst ends on a breath');
const beat = run('mini.sliceLull.beat');
assert.ok(beat >= 1, `an early level 1 breath is a real beat (${beat.toFixed(2)} s)`);
run('for(let i=0;i<120;i++)updateMini(1/60)');
assert.equal(run('mini.sliceWaves'), 2, 'nothing new while the toss is still up');
run('mini.gels=[];mini.sliceQueue=[]');
let quiet = 0;
while (run('mini.sliceWaves') === 2 && quiet < 300) {
  run('updateMini(1/60)');
  quiet++;
}
assert.ok(quiet / 60 >= beat - 0.05 && quiet / 60 <= beat + 0.1, `a clear screen holds the beat (${(quiet / 60).toFixed(2)} s vs ${beat.toFixed(2)} s)`);
// Over whole runs: level 1 opens slow, with real lulls, and every level ends faster than it starts.
// Rates count launched gremlins per second outside the party (frenzy volleys are their own thing).
function paceRun(tier) {
  close();
  run(`state.difficulty=1;openMini(4);mini.tier=${tier};startMini();launchMini();updateMini(3.3);var plog={t:[],seen:{},party:[]}`);
  run(`for(let i=0;i<mini.limit*60&&mini.screen==='play';i++){
    if(mini.sliceFrenzy>0)plog.party.push(mini.phaseTime);
    for(const o of mini.gels)if(plog.seen[o.id]===undefined){plog.seen[o.id]=1;if(!SLICE_KINDS[o.kind].hazard&&o.kind!=='kid'&&!o.frenzy&&o.kind!=='jumbo')plog.t.push(mini.phaseTime)}
    for(const o of mini.gels)if(!SLICE_KINDS[o.kind].hazard&&!o.dead&&o.y<sliceArena().H-10&&o.y>60){arcadeDown({x:o.x-8,y:o.y});arcadeMove({x:o.x+8,y:o.y});arcadeUp();break}
    updateMini(1/60);
  }`);
  const t = j('plog.t'),
    party = j('plog.party'),
    L = run('mini.limit'),
    rate = (a, b) => t.filter(x => x >= a && x < b).length / (b - a - party.filter(x => x >= a && x < b).length / 60);
  let gap = 0;
  for (let i = 1; i < t.length && t[i] < 20; i++) gap = Math.max(gap, t[i] - t[i - 1]);
  return { early: rate(5, 20), late: rate(L - 28, L - 13), gap, tosses: j('mini.sliceTosses') };
}
const p1 = paceRun(0);
assert.ok(p1.early <= 1.6, `level 1 opens slow: ${p1.early.toFixed(2)} gremlins a second`);
assert.ok(p1.late >= 1.4 && p1.late >= 1.4 * p1.early, `and picks up: ${p1.late.toFixed(2)} a second late in the round`);
assert.ok(p1.gap >= 1.4, `with lulls between bursts (${p1.gap.toFixed(2)} s)`);
assert.ok(p1.tosses.slice(1, 6).filter(k => ['single', 'pair', 'lob', 'floater'].includes(k)).length >= 3, `its first tosses are mostly small: ${p1.tosses.slice(0, 6)}`);
for (let i = 1; i < p1.tosses.length; i++) assert.notEqual(p1.tosses[i], p1.tosses[i - 1], 'never the same toss twice in a row');
for (let tier = 1; tier < 4; tier++) {
  const p = paceRun(tier);
  assert.ok(p.late > p.early, `level ${tier + 1} ends faster than it starts (${p.early.toFixed(2)} → ${p.late.toFixed(2)})`);
}
console.log(`PASS: the pace breathes: level 1 opens at ${p1.early.toFixed(2)} gremlins a second and ends at ${p1.late.toFixed(2)}, with ${p1.gap.toFixed(1)} s lulls; tempo climbs with the round and with combos.`);

// Level 1: just slicing. The first wave is a guided line of three; two bombs arrive alone, each warned
// at the bottom edge first; no helmets, splitters or gas; one gold party; the jumbo finale.
function runLevel(tier, cut) {
  close();
  run(
    `state.difficulty=1;openMini(4);mini.tier=${tier};startMini();launchMini();updateMini(3.3);` +
      'var log={kinds:{},firstAt:{},count:{},lone:true,warned:0,unwarned:0,hint:{}},warnAge=new Map(),prevWarns=[],prevT=0'
  );
  run(`for(let i=0;i<mini.limit*60&&mini.screen==='play';i++){
    for(const o of mini.gels){
      if(!o.seenByLog){o.seenByLog=true;log.count[o.kind]=(log.count[o.kind]||0)+1;
        if(SLICE_KINDS[o.kind].hazard){const w=prevWarns.find(w=>Math.abs(w.x-o.x)<20&&w.kind===o.kind);
          if(w&&prevT-warnAge.get(w)>=0.5)log.warned++;else log.unwarned++}}
      if(!log.kinds[o.kind]){log.kinds[o.kind]=1;log.firstAt[o.kind]=mini.phaseTime;log.hint[o.kind]=!!o.hint}
      if(o.kind==='bomb'&&mini.tier===0&&mini.gels.some(e=>!SLICE_KINDS[e.kind].hazard&&!e.dead&&e.y<sliceArena().H))log.lone=false;
    }
    for(const w of mini.sliceWarns)if(!warnAge.has(w))warnAge.set(w,mini.phaseTime);
    prevWarns=mini.sliceWarns.slice();prevT=mini.phaseTime;
    ${cut ? "for(const o of mini.gels)if(!SLICE_KINDS[o.kind].hazard&&!o.dead&&o.y<sliceArena().H-10&&o.y>60){arcadeDown({x:o.x-8,y:o.y});arcadeMove({x:o.x+8,y:o.y});arcadeUp();break}" : ''}
    updateMini(1/60);
  }`);
  return j('log');
}
fresh(0);
assert.equal(run('mini.gels.length+mini.sliceQueue.length'), 0);
close();
run('state.difficulty=1;openMini(4);mini.tier=0;startMini();launchMini();updateMini(3.3);for(let i=0;i<60;i++)updateMini(1/60)');
assert.equal(run("mini.gels.filter(o=>o.kind==='plain').length"), 3, 'level 1 opens with a line of three');
assert.equal(run('mini.sliceGuide.length'), 3, 'with a swipe guide through it');
const l1 = runLevel(0, true);
assert.deepEqual(Object.keys(l1.kinds).sort(), ['bomb', 'gold', 'jumbo', 'plain'], JSON.stringify(l1));
assert.equal(l1.count.bomb, 2, 'two bombs on level 1');
assert.equal(l1.lone, true, 'each level 1 bomb flies alone');
assert.equal(l1.warned, 2, 'each one warned at the bottom edge before it rises');
assert.equal(run('mini.sliceBombs'), 0);
assert.ok(l1.hint.bomb && l1.hint.gold && l1.hint.jumbo, 'each new thing gets a callout');
console.log('PASS: level 1 is guided, has two lone warned bombs, one gold party and the jumbo.');

// Level 2 brings its new things in one at a time, each with a callout: splitters, helmets, bombs.
// More bombs than level 1, no gas, and the first bomb flies clear with a warning.
const l2 = runLevel(1, true);
assert.ok(l2.firstAt.blue < l2.firstAt.helmet && l2.firstAt.helmet < l2.firstAt.bomb, JSON.stringify(l2.firstAt));
assert.ok(l2.firstAt.helmet >= 0.18 * 75 && l2.firstAt.bomb >= 25, JSON.stringify(l2.firstAt));
for (const k of ['blue', 'helmet', 'bomb', 'gold', 'jumbo']) assert.ok(l2.hint[k], `level 2 callout for ${k}`);
assert.ok(l2.count.bomb > 4, `level 2 has more bombs (${l2.count.bomb})`);
assert.equal(l2.count.gas, undefined, 'no gas on level 2');
assert.ok(l2.warned >= 1, 'the first bomb is warned');
console.log('PASS: level 2 introduces splitters, helmets and bombs one at a time, each with a callout.');

// Where the hazards fly, toss by toss: in the lineup (between the gremlins of a formation) or clear of
// every gremlin's apex by a fifth of the screen.
function hazardSpots(tier, shift, n) {
  fresh(tier);
  run(`mini.shift=${shift};mini.phaseTime=${[10, 35, 60][shift] * (tier === 3 ? 0.66 : 1)};mini.sliceWaves=1;mini.sliceMet={bomb:true,gas:true}`);
  const out = { inLine: 0, clear: 0, crowded: 0, bomb: 0, gas: 0 };
  for (let i = 0; i < n; i++) {
    const wave = j("(mini.sliceQueue=[],spawnGelWave().map(o=>({k:o.kind,x:sliceApex(o).x})))"),
      gx = wave.filter(o => !['bomb', 'gas', 'gold'].includes(o.k)).map(o => o.x).sort((a, b) => a - b);
    for (const h of wave.filter(o => o.k === 'bomb' || o.k === 'gas')) {
      out[h.k]++;
      if (gx.length >= 2 && h.x > gx[0] + 1 && h.x < gx[gx.length - 1] - 1) out.inLine++;
      else if (gx.every(x => Math.abs(x - h.x) >= 0.2 * 600 - 1)) out.clear++;
      else out.crowded++;
    }
  }
  return out;
}
const l2w2 = hazardSpots(1, 1, 120),
  l2w3 = hazardSpots(1, 2, 120);
assert.ok(l2w2.inLine + l2w3.inLine > 5, `level 2 bombs sometimes hide in the rows: ${JSON.stringify([l2w2, l2w3])}`);
assert.ok(l2w2.clear > l2w2.inLine, `but mostly fly clear in wave 2: ${JSON.stringify(l2w2)}`);
assert.equal(l2w2.gas + l2w3.gas, 0);
const l3 = hazardSpots(2, 2, 120),
  l4 = hazardSpots(3, 1, 120);
assert.ok(l3.inLine > 10 && l3.gas > 5 && l3.bomb > 5, `level 3 hides both hazards in the lineup: ${JSON.stringify(l3)}`);
assert.ok(l4.inLine > l3.inLine * 0.8 && l4.gas > 10 && l4.bomb > 10, `Legendary is full of both: ${JSON.stringify(l4)}`);
for (const o of [l2w2, l2w3, l3, l4]) assert.equal(o.crowded, 0, `a hazard is either in a lineup or clear: ${JSON.stringify(o)}`);
// Level 3 adds splitters, helmets and both hazards; the first gas is warned and called out.
fresh(2);
run('mini.shift=2;mini.phaseTime=60;mini.sliceQueue=[];mini.sliceWaves=1;for(let i=0;i<60;i++)spawnGelWave()');
const mix = j(
  "{bombs:mini.sliceQueue.filter(q=>q.gel.kind==='bomb').length,gas:mini.sliceQueue.filter(q=>q.gel.kind==='gas').length,helmets:mini.sliceQueue.filter(q=>q.gel.kind==='helmet').length,blue:mini.sliceQueue.filter(q=>q.gel.kind==='blue').length}"
);
for (const [k, n] of Object.entries(mix)) assert.ok(n > 0, `level 3 spawns ${k}: ${JSON.stringify(mix)}`);
const l3run = runLevel(2, true);
assert.ok(l3run.hint.gas && l3run.hint.bomb, 'level 3 calls out the pink bomb and the laughing gas');
assert.ok(l3run.firstAt.gas < 30, `laughing gas shows up early on level 3 (${l3run.firstAt.gas})`);
assert.ok(l3run.warned >= 2, 'the first of each hazard is warned');
console.log('PASS: hazards by level: lone bombs, then clear, then in the rows; gas from level 3; Legendary has both.');

// Laughing gas: a press never pops it and a near miss is free; a real swipe through it costs no heart
// and blows nothing away, but it fogs the screen for two seconds and ends that stroke's combo.
// Gas that falls is not a drop, and the frenzy and the freeze fizzle it.
fresh(2);
run(`mini.gels=[${gasAt(90, 300, 250)}];arcadeDown({x:300,y:250});arcadeUp();updateSlice(1/60)`);
assert.equal(run('mini.sliceFog'), 0, 'a press is not a swipe');
swipe(250, 250 - 28, 350, 250 - 28);
assert.equal(run('mini.sliceFog'), 0, 'grazing the edge is free');
run(`mini.gels=[${gasAt(91, 300, 250)},${gel(92, 150, 250)},${gel(93, 480, 200)}]`);
run('arcadeDown({x:120,y:250});arcadeMove({x:180,y:250});arcadeMove({x:350,y:250})');
assert.equal(run('mini.sliceRun'), null, 'the gas ends the combo');
run('arcadeUp();updateSlice(1/60)');
assert.equal(run('mini.miss'), 0, 'no heart');
assert.ok(Math.abs(run('mini.sliceFog') - 2) < 0.05, 'two seconds of fog');
assert.equal(run('mini.gels.filter(o=>o.blown).length'), 0, 'nothing blown away');
assert.equal(run('mini.sliceGas'), 1);
assert.match(run('mini.flashText'), /LAUGHING GAS/);
assert.doesNotThrow(() => run('drawMini()'), 'the fog draws');
run('for(let i=0;i<125;i++)updateMini(1/60)');
assert.equal(run('mini.sliceFog'), 0, 'the fog clears');
run(`mini.sliceDropped=0;mini.gels=[${gasAt(94, 300, 690)}];mini.gels[0].vy=10;updateSlice(1/60)`);
assert.equal(run('mini.sliceDropped'), 0, 'gas that falls is not a drop');
run(`mini.gels=[${gasAt(95, 300, 250)}];mini.sliceFog=2;miniAction('assist')`);
assert.equal(run("mini.gels.some(o=>o.kind==='gas'&&!o.dead)"), false, 'the freeze fizzles gas');
assert.ok(run('mini.sliceFog') < 0.5, 'and blows the fog away');
console.log('PASS: laughing gas fogs the screen for two seconds instead of costing a heart.');

// Four levels: Legendary registers, briefs, draws, and idle play loses it on every prescription.
assert.equal(run('SLICE.legendary'), true);
assert.equal(run('miniTierCount(SLICE)'), 4);
assert.equal(run('SLICE.tierNotes.length'), 4);
for (let d = 0; d < 3; d++) {
  close();
  run(`state.difficulty=${d};openMini(4);mini.tier=3;startMini();drawMini()`);
  assert.match(run('SLICE.lesson().title'), /Legendary/);
  run('launchMini();updateMini(3.3);drawMini()');
  assert.equal(run('mini.screen'), 'play');
  for (let n = 0; n < 4000 && run('mini.screen') === 'play'; n++) run('updateMini(.1);if(mini.screen==="play"&&mini.phaseTime%5<.1)drawMini()');
  assert.equal(run('mini.pendingFinish.win'), false, `idle Legendary on prescription ${d} loses`);
}
for (let tier = 0; tier < 4; tier++) {
  close();
  run(`state.difficulty=1;openMini(4);mini.tier=${tier};startMini();launchMini();updateMini(3.3)`);
  assert.equal(run('SLICE_TIERS[mini.tier].limit'), run('mini.limit'));
  assert.ok(run('typeof SLICE.shiftMessage(2)') === 'string', `level ${tier + 1} has wave messages`);
}
const goals = j('SLICE_TIERS.map(t=>t.goal/t.limit)'),
  speeds = j('SLICE_TIERS.map(t=>t.speed)');
assert.ok(goals[3] > goals[2] && goals[3] > goals[1] && speeds[3] >= speeds[2], `Legendary has the highest quota rate and the fastest tosses: ${goals} ${speeds}`);
assert.ok(j('SLICE_TIERS[3].limit') < j('SLICE_TIERS[2].limit'), 'on a shorter clock');
console.log('PASS: four levels; Legendary briefs, draws and rejects idle play on every prescription.');

// The jumbo finale: it rises, hangs, counts every swipe through it, then bursts for a bonus.
// It never counts as a drop, and regular waves wait while it is up.
fresh(0);
run('mini.sliceJumboDone=false;mini.phaseTime=mini.limit-10;mini.spawn=0');
for (let i = 0; i < 200 && !run("mini.gels.some(o=>o.kind==='jumbo'&&o.hover>0)"); i++) run('updateMini(1/60)');
assert.ok(run("mini.gels.some(o=>o.kind==='jumbo'&&o.hover>0)"), 'the jumbo rises and hangs');
const jumbo = j("(o=>({x:o.x,y:o.y,r:o.r}))(mini.gels.find(o=>o.kind==='jumbo'))");
run('mini.got=0;mini.score=0');
run(`arcadeDown({x:${jumbo.x - 130},y:${jumbo.y}});for(let i=1;i<=13;i++){updateMini(0.02);arcadeMove({x:${jumbo.x - 130}+i*20,y:${jumbo.y}})}arcadeUp()`);
assert.ok(run('mini.got') >= 2, 'a long swipe through it counts more than once');
run(`arcadeDown({x:${jumbo.x - 50},y:${jumbo.y}});for(let i=0;i<8;i++){updateMini(0.05);arcadeMove({x:${jumbo.x} + (i%2?-50:50),y:${jumbo.y}})}arcadeUp()`);
const hits = run('mini.got');
assert.ok(hits >= 6, `scribbling inside it keeps counting (${hits})`);
run(`arcadeDown({x:${jumbo.x - 50},y:${jumbo.y}});for(let i=0;i<8;i++)arcadeMove({x:${jumbo.x} + (i%2?-50:50),y:${jumbo.y}});arcadeUp()`);
assert.ok(run('mini.got') <= hits + 1, 'but a scribble cannot empty it in an instant');
assert.equal(run('mini.gels.filter(o=>o.kind!=="jumbo").length+mini.sliceQueue.length'), 0, 'nothing else launches while it hangs');
run('for(let i=0;i<240&&mini.gels.some(o=>o.kind==="jumbo");i++)updateMini(1/60)');
assert.equal(run("mini.gels.some(o=>o.kind==='jumbo')"), false, 'it bursts at the end of the hover');
assert.ok(run('mini.score') > hits * 15, 'the burst pays a bonus');
assert.match(run('mini.sliceBanner.text'), /JUMBO/);
assert.equal(run('mini.sliceDropped'), 0);
console.log('PASS: the jumbo finale hangs, counts every swipe and bursts for a bonus.');

// Cuts land where the camera draws: during a zoom, a swipe over the drawn gremlin cuts it. (Reduced
// motion never zooms, so there it just cuts where the gremlin is.)
fresh(1);
run(`mini.gels=[${gel(60, 400, 250)}];mini.sliceZoom={x:300,y:300,t:1,s:0.1}`);
const drawn = j('(c=>({x:c.zx+(400-c.zx)*c.s+c.sx,y:c.zy+(250-c.zy)*c.s+c.sy}))(sliceCamera())');
assert.ok(run('reduced') || Math.abs(drawn.x - 400) > 8, 'the zoom moves the drawing');
swipe(drawn.x - 20, drawn.y, drawn.x + 20, drawn.y);
assert.equal(run('mini.got'), 1);
console.log('PASS: cuts follow the zoomed camera.');

// Portrait: the 450 × 800 canvas lays out waves inside it, and turning the phone mid-run rescales
// everything in flight so nothing jumps off the glass.
close();
run('window.innerWidth=390;window.innerHeight=844;state.difficulty=1;openMini(4);mini.tier=1;startMini();launchMini();updateMini(3.3)');
assert.equal(run('mini.portrait'), true);
assert.deepEqual(j('sliceArena()').W, 450);
for (let i = 0; i < 40; i++) {
  const spots = j("(mini.sliceQueue=[],mini.shift=i%3,spawnGelWave().map(o=>sliceApex(o)))".replace('i%3', String(i % 3)));
  for (const p of spots) assert.ok(p.x > 20 && p.x < 430 && p.y > 100 && p.y < 520, `portrait apex ${JSON.stringify(p)}`);
}
run('mini.sliceQueue=[];mini.gels=[];spawnGelWave();for(let i=0;i<50;i++)updateMini(1/60)');
const before = j("mini.gels.map(o=>[o.x/450,o.y/800])");
run('window.innerWidth=1280;window.innerHeight=820;orientMini()');
assert.equal(run('mini.portrait'), false);
run('drawMini()');
const after = j("mini.gels.map(o=>[o.x/600,o.y/600])");
assert.ok(before.length > 0);
before.forEach((p, i) => assert.ok(Math.abs(p[0] - after[i][0]) < 1e-9 && Math.abs(p[1] - after[i][1]) < 1e-9, 'gels keep their place'));
run('for(let i=0;i<300;i++)updateMini(1/60);drawMini()');
assert.equal(run('mini.screen'), 'play');
close();
run('delete window.innerWidth;delete window.innerHeight;resize()');
console.log('PASS: the portrait canvas lays out waves inside it and turning the phone keeps every gel in place.');

// Assist: slow motion and fizzled bombs.
fresh(1);
run(`mini.gels=[${bombAt(70, 300, 250)},${gasAt(71, 450, 250)}];miniAction('assist')`);
assert.equal(run("mini.gels.some(o=>SLICE_KINDS[o.kind].hazard&&!o.dead)"), false);
assert.ok(run('mini.slow') > 4);
close();
console.log('PASS: the gel freeze fizzles bombs and gas and slows everything down.');
