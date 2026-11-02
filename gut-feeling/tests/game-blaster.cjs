// Bedside Blaster: the center sight is the hit test; ammo, headshots, reloads, leaps and the stun assist.
const {run,close,assert}=require('./harness.cjs');
run('openMini(5);startMini();launchMini();updateMini(3.3);mini.targets=[{id:1,x:850,y:268,hp:3,maxHp:3,kind:2,mode:"crawl",hit:0}];fireBlaster()');assert.equal(run('mini.targets[0].hp'),1);assert.equal(run('mini.ammo'),6);assert.equal(run('mini.headshots'),1);
run('mini.shotCd=0;mini.targets[0].x=1300;fireBlaster()');assert.equal(run('mini.targets[0].hp'),1);assert.equal(run('mini.ammo'),5);
run('reloadBlaster();mini.targets=[];updateMini(1.6)');assert.equal(run('mini.ammo'),7);
run('mini.targets=[{id:2,x:850,y:270,hp:1,kind:0,mode:"leap",leap:.95,leapDuration:1,stun:0,hit:0}];updateShooter(.1)');assert.equal(run('mini.miss'),1);
run('mini.targets=[{id:3,x:850,y:270,hp:1,kind:0,mode:"wind",wind:.2,stun:0,hit:0}];miniAction("assist");updateShooter(.3)');assert.equal(run('mini.targets[0].mode'),'wind');assert.ok(run('mini.targets[0].stun')>0);close();
console.log('PASS: sight hit testing, misses, headshots, magazines, reload, camera leaps and flashlight stun.');
