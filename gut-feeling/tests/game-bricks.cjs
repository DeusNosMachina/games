// Brick Rebellion rules: launch and cancel, armor, rubber, gremlin slides, nurse calls, free volleys on
// row clears, combo multiplier, last-ball slow-mo, bank shots, Ralph's fortress, the red line, and
// level 1 being gentler than level 3.
const { run, close, assert } = require('./harness.cjs');
run('let rng=777;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
const begin = tier => {
  close();
  run(`openMini(2);mini.tier=${tier};startMini();launchMini();updateMini(3.3)`);
};
run('function brick(kind,col,y,hp,row=90){const b=bricksMakeBlock(kind,col,y,row,hp);if(kind==="nurse")b.ring=2;mini.blocks.push(b);return b}');
run('function ball(o){const b={x:300,y:400,vx:0,vy:-500,base:500,age:1,last:-1,cool:0,hits:0,banked:false,rubber:0,trail:[],power:1,...o};mini.balls.push(b);return b}');
run('function flyOut(){for(let i=0;i<3000&&(mini.balls.length||mini.queue);i++)updateMini(.016)}');

// A pull-back launches a volley; a cancelled aim never does.
begin(0);
run('arcadeDown({x:300,y:548});arcadeMove({x:200,y:598});arcadeUp()');
assert.equal(run('mini.shot'), 1);
assert.ok(run('mini.queue') > 0);
begin(0);
run('arcadeDown({x:300,y:548});arcadeMove({x:200,y:598});arcadeUp(true)');
assert.equal(run('mini.shot'), 0);
console.log('PASS: volley launch and aim cancellation.');

// Armor: three normal hits or one HEAVY; a pink blast only knocks off one plate.
begin(1);
run('mini.blocks=[];var a=brick("armor",2,200,3);bricksStrike(a,1)');
assert.equal(run('a.hp'), 2, 'one plate per normal hit');
run('bricksStrike(a,1);bricksStrike(a,1)');
assert.equal(run('a.hp'), 0, 'three normal hits break armor');
run('var h=brick("armor",3,200,3);bricksStrike(h,3)');
assert.equal(run('h.hp'), 0, 'HEAVY breaks armor in one hit');
run('var a3=brick("armor",1,250,3);var p=brick("blast",2,250,1);bricksStrike(p,1)');
assert.equal(run('a3.hp'), 2, 'blast removes one plate');
assert.equal(run('mini.got'), 3);
console.log('PASS: armored bricks.');

// Rubber flings the ball faster.
begin(0);
run('mini.blocks=[];var rb=brick("rubber",2,200,9);var fast=ball({x:257,y:247,vy:-500});bricksHit(fast,rb)');
assert.ok(Math.abs(run('Math.hypot(fast.vx,fast.vy)') - 640) < 1, 'rubber adds 28% speed');
assert.equal(run('rb.hp'), 8);
console.log('PASS: rubber bricks.');

// Gremlin bricks sidestep one column per volley and turn around at walls and neighbors.
begin(1);
run('mini.blocks=[];var gr=brick("gremlin",2,150,9);gr.dir=1;mini.shot=1;bricksEndVolley()');
assert.equal(run('gr.col'), 3);
assert.equal(run('gr.x'), run('bricksColX(3)'));
begin(1);
run('mini.blocks=[];var g2=brick("gremlin",4,150,9);g2.dir=1;brick("plain",5,150,9);mini.shot=1;bricksEndVolley()');
assert.equal(run('g2.col'), 3, 'blocked by a neighbor, it turns around');
begin(1);
run('mini.blocks=[];var g3=brick("gremlin",5,150,9);g3.dir=1;mini.shot=1;bricksEndVolley()');
assert.equal(run('g3.col'), 4, 'blocked by the wall, it turns around');
console.log('PASS: gremlin bricks slide.');

// Nurse call: alive after two volleys, the whole rack drops an extra row. Kill it and nothing happens.
begin(1);
run('mini.blocks=[];var nc=brick("nurse",0,150,1);var pl=brick("plain",5,150,9);mini.shot=1;bricksEndVolley()');
assert.equal(run('pl.y'), 150 + 46);
assert.equal(run('nc.ring'), 1);
run('mini.shot=2;bricksEndVolley()');
assert.equal(run('pl.y'), 150 + 46 * 3, 'second volley rang the bell: two rows');
assert.equal(run('mini.bricksNurseRings'), 1);
assert.equal(run('nc.ring'), 2, 'the bell resets');
begin(1);
run('mini.blocks=[];var nk=brick("nurse",0,150,1);nk.ring=1;var p2=brick("plain",5,150,9);bricksStrike(nk,1);mini.shot=1;bricksEndVolley()');
assert.equal(run('p2.y'), 150 + 46, 'a dead nurse never rings');
assert.equal(run('mini.bricksNurseRings'), 0);
console.log('PASS: nurse call bricks.');

// Clearing a whole row in one volley refunds the volley and holds the rack still.
begin(0);
run('mini.blocks=[];brick("plain",2,300,1,7);var keep=brick("plain",5,200,99,8);arcadeDown({x:300,y:548});arcadeMove({x:300,y:648});arcadeUp();flyOut()');
assert.equal(run('mini.bricksFreeVolleys'), 1);
assert.equal(run('mini.shot'), 0, 'the volley is refunded');
assert.equal(run('keep.y'), 200, 'no descent');
assert.ok(run('mini.flashText').includes('FREE VOLLEY'));
begin(0);
run('mini.blocks=[];brick("plain",2,300,99,7);var keep2=brick("plain",5,200,99,8);arcadeDown({x:300,y:548});arcadeMove({x:300,y:648});arcadeUp();flyOut()');
assert.equal(run('mini.bricksFreeVolleys'), 0);
assert.equal(run('mini.shot'), 1);
assert.equal(run('keep2.y'), 246, 'without a clear the rack descends');
console.log('PASS: free volley on a row clear.');

// Combo: every five hits in a volley adds 0.5× to scoring; it cools after 1.5 s and resets each volley.
begin(0);
run('mini.blocks=[];var big=brick("plain",2,200,99);var cb=ball({});mini.combo=0;for(let i=0;i<5;i++)bricksHit(cb,big)');
assert.equal(run('mini.combo'), 5);
assert.equal(run('bricksMult()'), 1.5);
run('var c0=mini.score;bricksHit(cb,big)');
assert.equal(run('mini.score-c0'), 15, 'hit points use the multiplier');
run('for(let i=0;i<30;i++)bricksHit(cb,big)');
assert.equal(run('bricksMult()'), 3, 'capped at 3×');
run('mini.balls=[ball({x:300,y:520,vy:-10})];mini.bricksComboT=.1;updateVolley(.2)');
assert.equal(run('mini.combo'), 0, 'combo cools without hits');
console.log('PASS: combo multiplier.');

// Last-ball slow-mo: the final ball near the rack runs at 35% speed for a moment, once per volley.
begin(0);
run('mini.blocks=[];brick("plain",2,300,99);mini.balls=[];mini.queue=0;var lb=ball({x:258,y:362,vy:-300,base:300});updateVolley(.016)');
assert.ok(run('mini.bricksSlowmo') > 0, 'slow-mo triggered');
run('var y1=lb.y;updateVolley(.016)');
assert.ok(run('y1-lb.y') > 1 && run('y1-lb.y') < 2.5, 'the ball crawls at 35%');
begin(0);
run('mini.blocks=[];brick("plain",2,300,99);mini.balls=[];mini.queue=0;ball({x:258,y:362,vy:-300,base:300});ball({x:400,y:500,vy:-300,base:300});updateVolley(.016)');
assert.equal(run('mini.bricksSlowmo'), 0, 'not while other balls fly');
console.log('PASS: last-ball slow-mo.');

// Bank shots: the first hit after a side-wall bounce counts 1.5×.
begin(0);
run('mini.blocks=[];var bk=brick("plain",0,300,3);var bb=ball({banked:true});bricksHit(bb,bk)');
assert.equal(run('bk.hp'), 1.5);
assert.ok(run('mini.bricksPops.some(p=>p.text.includes("BANK"))'));
run('bricksHit(bb,bk)');
assert.equal(run('bk.hp'), 0.5, 'only the first hit gets the bonus');
run('mini.balls=[];mini.queue=0;var wb=ball({x:30,y:450,vx:-500,vy:-100});ball({x:500,y:450});updateVolley(.016)');
assert.equal(run('wb.banked'), true, 'a side-wall bounce banks the ball');
console.log('PASS: bank shots.');

// Ralph's fortress arrives in level 3's last third; it is shielded until both weak points fall.
begin(2);
run('mini.blocks=[];mini.shot=12;bricksEndVolley();var boss=mini.blocks.find(b=>b.kind==="boss")');
assert.equal(run('mini.bricksFortress'), true);
assert.equal(run('mini.blocks.filter(b=>b.kind==="weak").length'), 2);
assert.equal(run('boss.span'), 4);
run('var bh=boss.hp;bricksStrike(boss,5)');
assert.equal(run('boss.hp'), run('bh'), 'shielded while weak points stand');
run('for(const w of mini.blocks.filter(b=>b.kind==="weak"))bricksStrike(w,99)');
assert.equal(run('bricksGuarded(boss)'), false);
run('bricksStrike(boss,3)');
assert.equal(run('boss.hp'), run('bh') - 3);
run('var gotBefore=mini.got;bricksStrike(boss,99)');
assert.equal(run('mini.got-gotBefore'), 5, 'the fortress counts as five blocks');
assert.equal(run('mini.bricksFortressDown'), true);
begin(1);
run('mini.blocks=[];mini.shot=10;bricksEndVolley()');
assert.equal(run('mini.bricksFortress'), false, 'no fortress on level 2');
console.log('PASS: Ralph’s fortress weak points.');

// Crossing the red line ends the run.
begin(0);
run('mini.blocks=[];brick("plain",2,430,9);mini.shot=1;bricksEndVolley()');
assert.equal(run('mini.screen'), 'outro');
assert.equal(run('mini.pendingFinish.win'), false);
assert.ok(run('mini.pendingFinish.reason').includes('red line'));
console.log('PASS: red line.');

// Level 1 is gentler: full aim guide, softer bricks, no armor, gremlins, nurses or fortress.
begin(0);
run('mini.blocks=[];brick("plain",2,300,9);brick("plain",1,150,9);mini.aim={x:340,y:640}');
assert.ok(run('bricksPreview(volleyVector()).filter(p=>p.hit).length') >= 2, 'level 1 traces past the first bounce');
begin(2);
run('mini.blocks=[];brick("plain",2,300,9);brick("plain",1,150,9);mini.aim={x:340,y:640};var pv=bricksPreview(volleyVector())');
assert.equal(run('pv.filter(p=>p.hit).length'), 1, 'level 3 stops at the first bounce');
assert.equal(run('pv.at(-1).hit'), true);
const L = run('BRICKS_LEVELS');
assert.ok(L[0].hp[1] < L[2].hp[1] && L[0].grow > L[2].grow, 'level 1 bricks are softer and toughen slower');
assert.ok(L[0].volleys < L[2].volleys && L[0].goal < L[2].goal);
assert.ok(!L[0].fortress && L[2].fortress && L[0].nurseEvery === 0 && L[2].nurseEvery > 0);
for (const tier of [0, 2]) {
  begin(tier);
  run('mini.blocks=[];for(let r=0;r<40;r++)addBrickRow(58,r+1)');
  const kinds = run('[...new Set(mini.blocks.map(b=>b.kind))]');
  if (tier === 0) assert.ok(!kinds.some(k => ['armor', 'gremlin', 'nurse'].includes(k)), 'level 1 kinds: ' + kinds);
  else assert.ok(['armor', 'gremlin', 'nurse', 'rubber', 'blast'].every(k => kinds.includes(k)), 'level 3 kinds: ' + kinds);
}
console.log('PASS: level 1 is gentler than level 3.');

// Every brick type, the fortress, aim guide, trails, flashes, combo counter and slow-mo draw.
begin(2);
run('mini.blocks=[];["plain","blast","extra","rubber","armor","gremlin"].forEach((k,i)=>brick(k,i,150,k==="armor"?2:3));brick("nurse",0,200,1).ring=1;bricksAddFortress(250);mini.blocks.at(-1).hp=0');
run('mini.aim={x:330,y:620};drawMini();mini.aim=null;ball({banked:true,trail:[{x:300,y:420},{x:300,y:410}]});ball({rubber:.3,power:3});mini.combo=7;bricksSpark(300,300,.3,40,"#fff");bricksPop(300,300,"BANK ×1.5","#fff");mini.bricksSlowmo=.5;mini.bricksShake=.3;drawMini()');
run('for(const b of mini.blocks)b.hp=0;bricksAddFortress(300);drawMini();BRICKS.scene(mc,420,240)');
close();
console.log('PASS: Brick Rebellion draws every state.');
