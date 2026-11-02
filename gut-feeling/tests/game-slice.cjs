// Gel Yeah rules: helmets need two strokes, bombs never count as cuts, blue gremlins split, a
// run-ending bomb no longer crashes the stroke, formations spread out, arrows need the right
// direction, numbered sets pay in order, gold starts a bomb-free frenzy, lit bombs can be flicked
// on level 3, escape pressure rises per wave, cuts leave halves and stains, level 1 is gentler.
const { run, close, assert } = require('./harness.cjs');
run('let rng=11;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');

// A clean run with no automatic waves or gold.
function fresh(tier = 1) {
  close();
  run(
    `state.difficulty=1;openMini(4);mini.tier=${tier};startMini();launchMini();updateMini(3.3);` +
      'mini.spawn=1e9;mini.sliceGoldAt=[];mini.gels=[];mini.sliceQueue=[];mini.got=0'
  );
  assert.equal(run('mini.screen'), 'play');
}
const gel = (id, x, y, extra = '') => `{id:${id},x:${x},y:${y},r:27,hp:1,stroke:-1,bomb:false,vx:0,vy:0,angle:0,spin:0${extra}}`;
const swipe = (x1, y1, x2, y2) => run(`arcadeDown({x:${x1},y:${y1}});arcadeMove({x:${x2},y:${y2}});arcadeUp()`);

// Helmets need two separate strokes; blue gremlins split; bombs are an oops, never a cut.
fresh(1);
run(`mini.gels=[${gel(1, 300, 250, ',hp:2,armor:true')}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeMove({x:250,y:250})`);
assert.equal(run('mini.gels[0].hp'), 1);
run('arcadeUp()');
swipe(250, 250, 350, 250);
assert.equal(run('mini.got'), 1);
run(`mini.gels=[${gel(2, 300, 250, ',split:true')}]`);
swipe(250, 250, 350, 250);
assert.equal(run('mini.gels.filter(g=>!g.dead).length'), 2);
run(`mini.gels=[${gel(3, 300, 250, ',bomb:true,r:28')}]`);
swipe(250, 250, 350, 250);
run('updateSlice(1/60)');
assert.equal(run('mini.miss'), 1);
assert.equal(run('mini.got'), 2);
console.log('PASS: swipe armor, split and bomb rules.');

// Bug fix: when a bomb is the oops that ends the run, the rest of the stroke must not crash.
// The oops lands on the next update, after the stroke (and the pointer plumbing) finish.
fresh(1);
run(`mini.miss=mini.rules.misses-1;mini.gels=[${gel(4, 280, 250, ',bomb:true,r:28')},${gel(5, 340, 250)}]`);
assert.doesNotThrow(() => run('arcadeDown({x:240,y:250});arcadeMove({x:380,y:250});arcadeMove({x:400,y:260})'));
assert.equal(run('mini.got'), 1, 'the rest of the stroke still cuts');
assert.doesNotThrow(() => run('updateMini(1/60);arcadeMove({x:420,y:270});arcadeUp()'));
assert.equal(run('mini.screen'), 'outro');
assert.equal(run('mini.pointer'), null);
console.log('PASS: a run-ending bomb mid-stroke no longer throws on a null pointer.');

// Formations spread out: no wave peaks inside one 60px column.
for (let tier = 0; tier < 3; tier++) {
  fresh(tier);
  for (let shift = 0; shift < 3; shift++) {
    for (let i = 0; i < 40; i++) {
      const xs = run(
        `mini.shift=${shift};mini.phaseTime=30;mini.sliceQueue=[];JSON.stringify(spawnGelWave().filter(o=>!o.bomb&&!o.gold).map(o=>sliceApex(o).x))`
      );
      const apex = JSON.parse(xs);
      assert.ok(apex.length >= 3, `wave size ${apex.length}`);
      assert.ok(Math.max(...apex) - Math.min(...apex) > 60, `tier ${tier} shift ${shift} clumped: ${xs}`);
    }
  }
}
console.log('PASS: formations spread their apexes across the screen.');

// Arrow gremlins only split along their arrow; a wrong-way stroke bounces off.
fresh(1);
run(`mini.gels=[${gel(6, 300, 250, ',dir:0')}]`);
swipe(340, 250, 260, 250);
assert.equal(run('mini.gels[0].dead'), undefined);
assert.equal(run('mini.sliceWrong'), 1);
swipe(260, 250, 340, 250);
assert.equal(run('mini.got'), 1);
run(`mini.gels=[${gel(7, 300, 250, ',dir:Math.PI/2')}]`);
swipe(300, 210, 300, 290);
assert.equal(run('mini.got'), 2);
console.log('PASS: directional gremlins need a stroke along the arrow.');

// Numbered sets: 1, 2, 3 in order pays a +3 bonus; out of order pays nothing extra.
fresh(1);
run(`mini.sliceSets={7:{next:1,size:3,broken:false}};mini.gels=[1,2,3].map((n,i)=>(${gel('10+i', '150+i*150', 250, ',num:n,set:7')}))`);
for (const x of [150, 300, 450]) swipe(x - 20, 250, x + 20, 250);
assert.equal(run('mini.got'), 6);
assert.equal(run('mini.sliceOrders'), 1);
run(`mini.got=0;mini.sliceSets={8:{next:1,size:3,broken:false}};mini.gels=[1,2,3].map((n,i)=>(${gel('20+i', '150+i*150', 250, ',num:n,set:8')}))`);
for (const x of [300, 150, 450]) swipe(x - 20, 250, x + 20, 250);
assert.equal(run('mini.got'), 3);
assert.equal(run('mini.sliceOrders'), 1);
console.log('PASS: numbered sets pay a bonus only in order.');

// Gold gremlin: a five second frenzy with no bombs anywhere and double points.
fresh(1);
run(
  `mini.gels=[${gel(30, 300, 250, ',gold:true,r:24')},${gel(31, 450, 250, ',bomb:true,r:28')}];` +
    `mini.sliceQueue=[{delay:1,gel:${gel(32, 300, 640, ',bomb:true,r:28,vy:-700')}}]`
);
swipe(280, 250, 320, 250);
assert.ok(run('mini.sliceFrenzy') > 4);
assert.equal(run('mini.gels.some(o=>o.bomb&&!o.dead)||mini.sliceQueue.some(q=>q.gel.bomb)'), false);
assert.equal(run('spawnGelWave().filter(o=>o.bomb).length'), 0);
run(`mini.score=0;mini.combo=0;mini.gels.push(${gel(33, 300, 400)})`);
swipe(280, 400, 320, 400);
assert.equal(run('mini.score'), 70, 'frenzy cuts pay double');
let sawGels = 0;
for (let i = 0; i < 290 && run('mini.sliceFrenzy') > 0; i++) {
  run('updateMini(1/60)');
  assert.equal(run('mini.gels.some(o=>o.bomb)||mini.sliceQueue.some(q=>q.gel.bomb)'), false, 'bomb during frenzy');
  sawGels = Math.max(sawGels, run('mini.gels.length'));
}
assert.ok(sawGels >= 6, `frenzy launches many gels (${sawGels})`);
console.log('PASS: gold frenzy waves are bomb-free and pay double.');

// Level 3 lit bombs: a quick upward flick sends them away; any other stroke is an oops.
fresh(2);
const bomb = (id, extra = '') => gel(id, 300, 300, `,bomb:true,r:28,lit:true,fuse:2,fuseLeft:2${extra}`);
run(`mini.gels=[${bomb(40)}]`);
swipe(300, 345, 300, 255);
run('updateSlice(1/60)');
assert.equal(run('mini.miss'), 0);
assert.equal(run('mini.gels[0].flicked'), true);
assert.equal(run('mini.sliceFlicks'), 1);
run(`mini.gels=[${bomb(41)}]`);
swipe(250, 300, 350, 300);
run('updateSlice(1/60)');
assert.equal(run('mini.miss'), 1);
run(`mini.gels=[${bomb(42)}];arcadeDown({x:300,y:345});for(let i=0;i<30;i++)updateMini(1/60);mini.gels[0].x=300;mini.gels[0].y=300;arcadeMove({x:300,y:255});arcadeUp();updateSlice(1/60)`);
assert.equal(run('mini.miss'), 2, 'a slow upward drag is not a flick');
fresh(1);
run(`mini.gels=[${bomb(43)}]`);
swipe(300, 345, 300, 255);
run('updateSlice(1/60)');
assert.equal(run('mini.miss'), 1, 'no flicking below level 3');
console.log('PASS: lit bombs can be flicked away on level 3 only.');

// Escape pressure rises each wave, and an off-screen gremlin counts as escaped.
fresh(1);
const limits = run('JSON.stringify(SLICE_TIERS[1].escapes)');
const [first, , last] = JSON.parse(limits);
assert.ok(first > last, `escape allowance shrinks per wave: ${limits}`);
run(`mini.shift=0;for(let i=0;i<${first - 1};i++)sliceEscape({})`);
assert.equal(run('mini.miss'), 0);
run('sliceEscape({})');
assert.equal(run('mini.miss'), 1);
run(`mini.shift=2;for(let i=0;i<${last};i++)sliceEscape({})`);
assert.equal(run('mini.miss'), 2);
run(`mini.escaped=0;mini.gels=[${gel(50, 300, 690, ',entered:true,vy:10')}];updateSlice(1/60)`);
assert.equal(run('mini.escaped'), 1);
console.log('PASS: escape pressure rises per wave.');

// Cuts leave two halves flying apart with a sonar stain that fades.
fresh(1);
run(`mini.sliceHalves=[];mini.sliceStains=[];mini.gels=[${gel(60, 300, 250)}]`);
swipe(260, 250, 340, 250);
assert.equal(run('mini.sliceHalves.length'), 2);
assert.equal(run('mini.sliceHalves[0].side+mini.sliceHalves[1].side'), 0);
assert.equal(run('mini.sliceStains.length'), 1);
const gap0 = run('Math.hypot(mini.sliceHalves[0].x-mini.sliceHalves[1].x,mini.sliceHalves[0].y-mini.sliceHalves[1].y)');
run('for(let i=0;i<20;i++)updateMini(1/60)');
assert.ok(run('Math.hypot(mini.sliceHalves[0].x-mini.sliceHalves[1].x,mini.sliceHalves[0].y-mini.sliceHalves[1].y)') > gap0 + 20);
run('for(let i=0;i<400;i++)updateMini(1/60)');
assert.equal(run('mini.sliceStains.length'), 0);
console.log('PASS: cut gremlins fall apart in halves and stains fade.');

// Level 1 is gentler than level 3: slower waves, smaller waves, more escapes allowed, no early bombs.
assert.ok(run('SLICE_TIERS[0].interval>SLICE_TIERS[2].interval'));
assert.ok(run('SLICE_TIERS[0].size.every((n,i)=>n<=SLICE_TIERS[2].size[i])&&SLICE_TIERS[0].size[0]<SLICE_TIERS[2].size[0]'));
assert.ok(run('SLICE_TIERS[0].escapes.every((n,i)=>n>SLICE_TIERS[2].escapes[i])'));
fresh(0);
run('mini.phaseTime=5');
for (let i = 0; i < 20; i++) assert.equal(run('spawnGelWave().filter(o=>o.bomb||o.dir!==undefined||o.num).length'), 0);
fresh(2);
run('mini.shift=2;mini.phaseTime=60;mini.sliceQueue=[];for(let i=0;i<40;i++)spawnGelWave()');
const mix = run('JSON.stringify({b:mini.sliceQueue.filter(q=>q.gel.bomb&&q.gel.lit).length,d:mini.sliceQueue.filter(q=>q.gel.dir!==undefined).length,n:mini.sliceQueue.filter(q=>q.gel.num).length})');
for (const [k, v] of Object.entries(JSON.parse(mix))) assert.ok(v > 0, `level 3 spawns ${k}: ${mix}`);
close();
console.log('PASS: level 1 is gentler than level 3.');
