// Brick Rebellion: a pull-back launches a volley; a cancelled or paused aim never does.
const {run,close,assert}=require('./harness.cjs');
run('openMini(2);startMini();launchMini();updateMini(3.3);arcadeDown({x:300,y:548});arcadeMove({x:200,y:598});arcadeUp()');assert.equal(run('mini.shot'),1);assert.ok(run('mini.queue')>0);close();
run('openMini(2);startMini();launchMini();updateMini(3.3);arcadeDown({x:300,y:548});arcadeMove({x:200,y:598});arcadeUp(true)');assert.equal(run('mini.shot'),0);close();
console.log('PASS: volley launch and aim cancellation.');
