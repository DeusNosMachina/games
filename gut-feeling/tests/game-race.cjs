// Gurney Grand Prix rules: obstacles need the right move, boosts double coins, nurse carts keep
// a beat, late dodges pay a close call, mid-air switches and slams work, stunts chain, gremlins
// throw gunk, IVs roll, curves skid, the tunnel alternates, and level 1 is gentler than level 3.
const { run, close, assert } = require('./harness.cjs');
run('let rng=7;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');

// A clean run with no spawns or curves, gurney in the middle lane.
function fresh(tier = 1) {
  close();
  run(
    `state.difficulty=1;openMini(3);mini.tier=${tier};startMini();launchMini();updateMini(3.3);` +
      'mini.raceGap=1e9;mini.raceCurveAt=[];mini.raceCurve=null;mini.rows=[];mini.lane=1;mini.cartX=300'
  );
  assert.equal(run('mini.screen'), 'play');
}
const step = s => run(`for(let i=0;i<${Math.round(s * 120)};i++)updateMini(1/120)`);
const row = (y, objects) => `mini.rows=[{id:1,y:${y},objects:${objects}}]`;

// Crates need a jump; a jump does not beat a wall.
fresh(0);
run(row(489, '[{lane:1,kind:"crate"}]') + ';mini.jump=35;updateRace(.02)');
assert.equal(run('mini.miss'), 0);
assert.equal(run('mini.stunts'), 1);
run('mini.jump=0;mini.jumpV=0;' + row(489, '[{lane:1,kind:"wall"}]') + ';updateRace(.02)');
assert.equal(run('mini.miss'), 1);
console.log('PASS: crates need a jump, walls need steering.');

// Level 1 teaches: the first row of a stage drops one hazard in your lane with a hint, and
// every level 1 row uses a single hazard type.
fresh(0);
run('spawnTraffic()');
assert.equal(run('mini.rows[0].objects.filter(o=>o.kind!=="coin").length'), 1);
assert.equal(run('mini.rows[0].objects.find(o=>o.kind==="crate").lane'), 1);
assert.match(run('mini.rows[0].objects.find(o=>o.kind==="crate").hint'), /JUMP/);
run('for(let i=0;i<60;i++)spawnTraffic()');
assert.ok(run('mini.rows.every(r=>new Set(r.objects.filter(o=>o.kind!=="coin").map(o=>o.kind)).size===1)'));
assert.equal(run('[...new Set(mini.rows.flatMap(r=>r.objects.map(o=>o.kind)))].sort().join()'), 'bar,coin,crate,gremlin,wall');
console.log('PASS: level 1 introduces one hazard type at a time with hints.');

// Level 1 is gentler than level 3: slower, wider gaps, ramping speed, simpler traffic.
fresh(0);
const slow = run('raceSpeed()');
run('mini.phaseTime=mini.limit');
assert.ok(run('raceSpeed()') > slow, 'speed ramps across the run');
fresh(2);
const fast = run('raceSpeed()');
assert.ok(slow < fast * 0.8, `level 1 ${slow} vs level 3 ${fast}`);
assert.ok(run('RACE_TIERS[0].gap>RACE_TIERS[2].gap'));
run('mini.shift=2;for(let i=0;i<160;i++)spawnTraffic()');
const kinds = run('[...new Set(mini.rows.flatMap(r=>r.objects.map(o=>o.kind)))].sort().join()');
for (const k of ['boost', 'ramp', 'nurse', 'iv']) assert.ok(kinds.includes(k), `level 3 spawns ${k}: ${kinds}`);
assert.ok(run('mini.rows.some(r=>r.objects.some(o=>o.thrower))'), 'level 3 spawns gunk throwers');
console.log('PASS: level 1 is slower and simpler than level 3; speed ramps.');

// Boost pads: faster track, and coins pay double while boosted.
fresh(1);
run(row(489, '[{lane:1,kind:"boost"}]') + ';updateRace(.02)');
assert.ok(run('mini.raceBoost') > 0);
const boosted = run('raceSpeed()');
run('mini.raceBoost=0');
assert.ok(boosted > run('raceSpeed()') * 1.4);
run('mini.raceBoost=2;mini.got=0;' + row(489, '[{lane:1,kind:"coin"}]') + ';updateRace(.02)');
assert.equal(run('mini.got'), 4);
run('mini.raceBoost=0;mini.got=0;' + row(489, '[{lane:1,kind:"coin"}]') + ';updateRace(.02)');
assert.equal(run('mini.got'), 2);
console.log('PASS: boost pads speed up the track and double coins.');

// Nurse carts hop one lane per beat (bouncing off the edge), and hit whoever shares their lane.
fresh(1);
run(row(100, '[{lane:0,pos:0,kind:"nurse",dir:1,period:1,clock:.5}]'));
assert.equal(run('raceNurseLaneAt(mini.rows[0].objects[0],.6)'), 1);
assert.equal(run('raceNurseLaneAt(mini.rows[0].objects[0],1.6)'), 2);
assert.equal(run('raceNurseLaneAt(mini.rows[0].objects[0],2.6)'), 1);
step(0.6);
assert.equal(run('mini.rows[0].objects[0].lane'), 1);
assert.equal(run('Math.round(mini.rows[0].objects[0].pos)'), 1);
run('mini.rows[0].y=489;mini.rows[0].objects[0].clock=0;updateRace(.02)');
assert.equal(run('mini.miss'), 1);
run('mini.inv=0;mini.lane=0;mini.cartX=160;' + row(489, '[{lane:1,pos:1,kind:"nurse",dir:1,period:1,clock:0}]') + ';updateRace(.02)');
assert.equal(run('mini.miss'), 1);
console.log('PASS: nurse carts move on a readable beat.');

// Close call: leaving a hazard's lane inside the sliver pays +2; dodging early pays nothing.
fresh(1);
run('mini.got=0;' + row('490-raceSpeed()*.2', '[{lane:1,kind:"wall"}]') + ';miniAction("right")');
step(0.25);
assert.equal(run('mini.miss'), 0);
assert.equal(run('mini.got'), 2);
assert.equal(run('mini.raceCloseCalls'), 1);
assert.equal(run('mini.flashText'), 'CLOSE CALL +2');
run('mini.got=0;' + row('490-raceSpeed()*.9', '[{lane:2,kind:"wall"}]') + ';miniAction("left")');
step(0.95);
assert.equal(run('mini.miss'), 0);
assert.equal(run('mini.got'), 0);
console.log('PASS: near misses pay CLOSE CALL +2 only inside the sliver.');

// Mid-air lane change: works while airborne; after clearing a crate it is a stunt on landing.
fresh(1);
run('miniAction("jump")');
step(0.1);
run('miniAction("right")');
step(0.2);
assert.ok(run('mini.jump') > 0);
assert.equal(run('raceCartLane()'), 2);
step(1);
assert.equal(run('mini.jump'), 0);
assert.equal(run('mini.stunts'), 0, 'a plain hop and swerve is not a stunt');
run(row('490-raceSpeed()*.3', '[{lane:2,kind:"crate"}]') + ';miniAction("jump")');
step(0.35);
assert.equal(run('mini.stunts'), 1);
run('miniAction("left")');
step(1);
assert.equal(run('mini.stunts'), 2);
assert.equal(run('mini.miss'), 0);
console.log('PASS: mid-air lane changes, with AIR SWITCH stunts after a crate.');

// Slide-cancel into a jump, and a mid-air swipe down slams into a slide.
fresh(1);
run('miniAction("slide")');
assert.ok(run('mini.slide') > 0);
run('miniAction("jump")');
assert.equal(run('mini.slide'), 0);
assert.ok(run('mini.jump') > 0);
step(0.15);
run('miniAction("slide")');
step(0.12);
assert.equal(run('mini.jump'), 0);
assert.ok(run('mini.slide') > 0);
console.log('PASS: slide-cancel into jump, and slam into slide.');

// Stunt chain: four clean stunts reach ×2 coins; a crash resets it.
fresh(1);
run('mini.got=0;for(let i=0;i<4;i++)raceStunt("TEST")');
assert.equal(run('raceMult()'), 2);
assert.equal(run('mini.got'), 5);
run('mini.inv=0;raceCrash("TEST")');
assert.equal(run('raceMult()'), 1);
console.log('PASS: stunt chain multiplier builds and resets on a crash.');

// Gunk throwers wind up, then lob at your lane. Stay and get gunked; dodge and you are fine.
fresh(2);
run(row(130, '[{lane:0,kind:"gremlin",hp:2,thrower:true}]'));
step(0.5);
assert.ok(run('mini.rows[0].objects[0].wind') > 0, 'telegraphs a wind-up');
step(0.2);
assert.equal(run('mini.raceGunk.length'), 1);
assert.equal(run('mini.raceGunk[0].lane'), 1);
step(1.2);
assert.equal(run('mini.miss'), 1);
run('mini.inv=0;' + row(130, '[{lane:0,kind:"gremlin",hp:2,thrower:true}]'));
step(0.7);
run('miniAction("right")');
step(1.2);
assert.equal(run('mini.miss'), 1);
console.log('PASS: gremlins telegraph and throw gunk at your lane; dodging works.');

// Runaway IV stands roll ahead of their row; one softball knocks them over for a stunt.
fresh(1);
run(row(200, '[{lane:1,kind:"iv",hp:1,dy:0,roll:.5},{lane:0,kind:"coin"}]'));
step(0.5);
assert.ok(run('mini.rows[0].objects[0].dy') > 20);
run('miniAction("throw")');
step(0.4);
assert.equal(run('mini.rows[0].objects[0].hp'), 0);
assert.equal(run('mini.stunts'), 1);
console.log('PASS: rolling IV stands outrun traffic and fall to one throw.');

// Curves: the skid warning shoves you outward unless you swipe toward the inside.
fresh(1);
run('mini.raceCurve={dir:1,t:2.2,dur:7,skidAt:2.2,warn:0,skidDone:false}');
step(0.05);
assert.ok(run('mini.raceCurve.warn') > 0);
assert.ok(run('Math.abs(raceBend(100))>Math.abs(raceBend(500))'), 'lanes drift more further up the track');
run('miniAction("right")');
assert.equal(run('mini.lane'), 1);
assert.equal(run('mini.stunts'), 1);
run('mini.raceCurve={dir:1,t:2.2,dur:7,skidAt:2.2,warn:0,skidDone:false}');
step(1);
assert.equal(run('mini.lane'), 0);
console.log('PASS: curves bend the lanes, skid outward, and reward counter-steering.');

// Level 3 donut tunnel: all-lane low bars, then walls with a single gap, alternating.
fresh(2);
run('mini.phaseTime=mini.raceTunnelAt+1;mini.rows=[];for(let i=0;i<5;i++)spawnTraffic()');
assert.equal(run('mini.rows.length'), 4);
assert.ok(run('mini.rows.every(r=>r.tunnel)'));
assert.equal(run('mini.rows[0].objects.filter(o=>o.kind==="bar").length'), 3);
assert.equal(run('mini.rows[1].objects.filter(o=>o.kind==="wall").length'), 2);
assert.equal(run('mini.rows[2].objects.filter(o=>o.kind==="bar").length'), 3);
close();
console.log('PASS: the donut tunnel alternates low bars and walls.');
