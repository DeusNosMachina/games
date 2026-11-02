// Ward combat rules: weapon dispatch, wind-up timing, splitting, jumping, damage and wave completion.
const {run,events,close,assert}=require('./harness.cjs');
run('let rng=1873;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296};begin();drawWorld();state.hp=5');
run('loadRoom(1);encounter.rest=0;player.x=500;player.y=420;player.attackCd=0;enemies=[makeEnemy(0,560,420)];equip(0);attack()');
assert.equal(run('enemies[0].hp'),3);run('updateWorld(.17)');assert.equal(run('enemies[0].hp'),2);
run('player.attackCd=0;equip(1);attack()');assert.equal(run('projectiles.at(-1).kind'),'bag');assert.equal(run('player.attackKind'),1);
run('player.attackCd=0;equip(2);attack()');assert.equal(run('projectiles.at(-1).kind'),'brick');assert.equal(run('player.attackKind'),2);
run('enemies=[makeEnemy(3,570,430)];hitEnemy(enemies[0]);enemies=enemies.filter(e=>e.hp>0)');assert.equal(run('enemies.length'),2);assert.ok(run('enemies.every(e=>e.small&&e.hp===2)'));
run('player.inv=0;player.shield=0;player.z=30;damage("blob",{x:600,y:420})');assert.equal(run('state.hp'),5);
run('player.z=0;damage("blob",{x:600,y:420})');assert.equal(run('state.hp'),4);assert.ok(run('player.vomit>0'));
run('player.vomit=0;player.jumpCd=0;jump()');assert.ok(run('player.vz')>0);for(let i=0;i<100;i++)run('updateCombat(.01)');assert.equal(run('player.z'),0);
run('enemies=[];encounter={wave:3,rest:0,complete:false};state.room=1;updateCombat(.01)');assert.ok(run('encounter.complete'));const paidWard=run('state.coins');run('updateCombat(.01)');assert.equal(run('state.coins'),paidWard);
run('loadRoom(0);player.attackCd=0;player.vomit=0');events.keydown({key:'2',target:{},repeat:false,preventDefault:()=>{}});assert.equal(run('state.item'),1);events.keydown({key:' ',target:{},repeat:false,preventDefault:()=>{}});run('updateWorld(.01)');assert.equal(run('projectiles.at(-1).kind'),'bag');run('keys.clear()');
console.log('PASS: equipped weapon dispatch, delayed swings, splitting, jump dodge, jump physics, single ward payout, number-key equipment and Space dispatch.');
