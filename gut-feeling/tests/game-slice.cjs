// Gel Yeah rules: a press or a swipe cuts, bombs need a real swipe well inside them, a bomb is an oops
// that clears the screen (and no longer crashes a stroke that ends the run), helmets take two hits
// (a zig-zag counts), blue gremlins split into kids that never count as drops, strokes bank combos
// with slow motion and a zoom on the big ones, combos fill the party meter, gold or a full meter start
// a bomb-free frenzy, drops add up to an oops (gentler on level 1), formations spread out, level 1 meets
// one lone bomb, level 2 introduces one thing at a time with callouts, level 3 hides bombs in the
// lineup, every level ends on a jumbo gel, cuts land where the zoomed camera draws, and the portrait
// canvas lays out (and turns) cleanly.
const { run, close, assert } = require('./harness.cjs');
run('let rng=11;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');

// A clean run with no automatic waves, gold, lone bomb or jumbo.
function fresh(tier = 1) {
  close();
  run(
    `state.difficulty=1;openMini(4);mini.tier=${tier};startMini();launchMini();updateMini(3.3);` +
      'mini.spawn=1e9;mini.sliceRestUntil=1e9;mini.sliceGoldAt=[];mini.sliceLoneDone=true;mini.sliceJumboDone=true;mini.gels=[];mini.sliceQueue=[];mini.got=0;mini.score=0'
  );
  assert.equal(run('mini.screen'), 'play');
}
const gel = (id, x, y, extra = '') =>
  `{id:${id},kind:'plain',x:${x},y:${y},r:31,hp:1,stroke:-1,lock:0,vx:0,vy:0,angle:0,spin:0,age:0,entered:true${extra}}`;
const bombAt = (id, x, y) => gel(id, x, y, ",kind:'bomb',r:29");
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
assert.ok(run('mini.sliceZoom.s') > 0, 'and punches the camera in');
const clock = run('mini.phaseTime');
run('updateMini(0.1)');
assert.ok(Math.abs(run('mini.phaseTime') - clock - 0.1) < 1e-9, 'slow motion never slows the clock');
// A held stroke that pauses between cuts banks them as separate groups.
run(`mini.sliceCombos=0;mini.gels=[${gel(30, 150, 250)},${gel(31, 250, 250)},${gel(32, 350, 250)}]`);
run('arcadeDown({x:120,y:250});arcadeMove({x:270,y:250});for(let i=0;i<30;i++)updateMini(1/60);arcadeMove({x:380,y:250});arcadeUp()');
assert.equal(run('mini.sliceCombos'), 0, 'a long pause splits the stroke');
console.log('PASS: strokes bank combos, big ones slow the gremlins (never the clock) and zoom.');

// The party: a full meter or a gold gremlin starts a frenzy. Bombs fizzle, volleys are bomb-free,
// cuts pay double, and party gremlins that fall are never drops.
fresh(1);
run(`mini.sliceMeter=SLICE_TIERS[1].meter-1;mini.gels=[${gel(40, 150, 250)},${gel(41, 300, 250)},${gel(42, 450, 250)},${bombAt(43, 300, 450)}]`);
swipe(100, 250, 500, 250);
assert.ok(run('mini.sliceFrenzy') > 4, 'a full meter starts the party');
assert.equal(run("mini.gels.some(o=>o.kind==='bomb'&&!o.dead)"), false, 'bombs fizzle');
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
console.log('PASS: gold or a full meter start a bomb-free, double-points frenzy.');

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

// Formations spread out: no wave peaks inside one 60px column.
for (let tier = 0; tier < 3; tier++) {
  fresh(tier);
  for (let shift = 0; shift < 3; shift++) {
    for (let i = 0; i < 40; i++) {
      const apex = j(
        `(mini.shift=${shift},mini.phaseTime=30,mini.sliceQueue=[],mini.sliceWaves=1,spawnGelWave().filter(o=>o.kind!=='bomb'&&o.kind!=='gold').map(o=>sliceApex(o).x))`
      );
      assert.ok(apex.length >= 2, `wave size ${apex.length}`);
      assert.ok(Math.max(...apex) - Math.min(...apex) > 60, `tier ${tier} shift ${shift} clumped: ${apex}`);
    }
  }
}
console.log('PASS: formations spread their apexes across the screen.');

// Level 1: just slicing. The first wave is a guided line of three; the only bomb arrives alone; no
// helmets or splitters; one gold party; the jumbo finale.
function runLevel(tier, cut) {
  close();
  run(`state.difficulty=1;openMini(4);mini.tier=${tier};startMini();launchMini();updateMini(3.3);var log={kinds:{},firstAt:{},lone:true,lineup:0,hint:{}}`);
  run(`for(let i=0;i<mini.limit*60&&mini.screen==='play';i++){
    for(const o of mini.gels){
      if(!log.kinds[o.kind]){log.kinds[o.kind]=1;log.firstAt[o.kind]=mini.phaseTime;log.hint[o.kind]=!!o.hint}
      if(o.kind==='bomb'&&mini.tier===0&&mini.gels.some(e=>e.kind!=='bomb'&&!e.dead&&e.y<sliceArena().H))log.lone=false;
    }
    ${cut ? "for(const o of mini.gels)if(o.kind!=='bomb'&&!o.dead&&o.y<sliceArena().H-10&&o.y>60){arcadeDown({x:o.x-8,y:o.y});arcadeMove({x:o.x+8,y:o.y});arcadeUp();break}" : ''}
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
assert.equal(l1.lone, true, 'the level 1 bomb flies alone');
assert.equal(run('mini.sliceBombs'), 0);
assert.ok(l1.hint.bomb && l1.hint.gold && l1.hint.jumbo, 'each new thing gets a callout');
console.log('PASS: level 1 is guided, has one lone bomb, one gold party and the jumbo.');

// Level 2 brings its new things in one at a time, each with a callout: splitters, helmets, bombs.
const l2 = runLevel(1, true);
assert.ok(l2.firstAt.blue < l2.firstAt.helmet && l2.firstAt.helmet < l2.firstAt.bomb, JSON.stringify(l2.firstAt));
assert.ok(l2.firstAt.helmet >= 0.18 * 75 && l2.firstAt.bomb >= 25, JSON.stringify(l2.firstAt));
for (const k of ['blue', 'helmet', 'bomb', 'gold', 'jumbo']) assert.ok(l2.hint[k], `level 2 callout for ${k}`);
console.log('PASS: level 2 introduces splitters, helmets and bombs one at a time, each with a callout.');

// Level 3 hides bombs in the lineup and launches criss-crosses.
fresh(2);
run('mini.shift=2;mini.phaseTime=60;mini.sliceQueue=[];mini.sliceWaves=1;for(let i=0;i<60;i++)spawnGelWave()');
const mix = j(
  "{bombs:mini.sliceQueue.filter(q=>q.gel.kind==='bomb').length,helmets:mini.sliceQueue.filter(q=>q.gel.kind==='helmet').length,blue:mini.sliceQueue.filter(q=>q.gel.kind==='blue').length}"
);
for (const [k, v] of Object.entries(mix)) assert.ok(v > 0, `level 3 spawns ${k}: ${JSON.stringify(mix)}`);
let lineup = 0;
for (let i = 0; i < 80; i++) {
  const wave = j("spawnGelWave().map(o=>({k:o.kind,x:sliceApex(o).x}))");
  const xs = wave.filter(o => o.k !== 'gold').map(o => o.x).sort((a, b) => a - b),
    bx = wave.filter(o => o.k === 'bomb').map(o => o.x);
  if (bx.some(x => x > xs[0] + 1 && x < xs[xs.length - 1] - 1)) lineup++;
}
assert.ok(lineup > 10, `bombs hide in the lineup on level 3 (${lineup}/80)`);
fresh(1);
run('mini.shift=2;mini.phaseTime=60;mini.sliceWaves=1');
let apart = 0,
  waves = 0;
for (let i = 0; i < 80; i++) {
  const wave = j("(mini.shift=1,spawnGelWave().map(o=>({k:o.kind,x:sliceApex(o).x})))");
  const bx = wave.filter(o => o.k === 'bomb').map(o => o.x),
    gx = wave.filter(o => o.k !== 'bomb' && o.k !== 'gold').map(o => o.x);
  if (!bx.length) continue;
  waves++;
  if (bx.every(b => gx.every(x => Math.abs(x - b) >= 0.2 * 600 - 1))) apart++;
}
assert.equal(apart, waves, 'level 2 wave 2 keeps its bombs clear of the gremlins');
console.log('PASS: level 3 hides bombs in the lineup; level 2 keeps them clear at first.');

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

// Cuts land where the camera draws: during a zoom, a swipe over the drawn gremlin cuts it.
fresh(1);
run(`mini.gels=[${gel(60, 400, 250)}];mini.sliceZoom={x:300,y:300,t:1,s:0.1}`);
const drawn = j('(c=>({x:c.zx+(400-c.zx)*c.s+c.sx,y:c.zy+(250-c.zy)*c.s+c.sy}))(sliceCamera())');
assert.ok(Math.abs(drawn.x - 400) > 8, 'the zoom moves the drawing');
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
run(`mini.gels=[${bombAt(70, 300, 250)}];miniAction('assist')`);
assert.equal(run("mini.gels.some(o=>o.kind==='bomb'&&!o.dead)"), false);
assert.ok(run('mini.slow') > 4);
close();
console.log('PASS: the gel freeze fizzles bombs and slows everything down.');
