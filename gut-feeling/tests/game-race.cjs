// Gurney Grand Prix: the right move is required; a jump is not invincibility.
const {run,close,assert}=require('./harness.cjs');
run('openMini(3);startMini();launchMini();updateMini(3.3);mini.rows=[{y:489,done:false,objects:[{lane:1,kind:"crate"}]}];mini.jump=35;updateRace(.02)');assert.equal(run('mini.miss'),0);
run('mini.rows=[{y:489,done:false,objects:[{lane:1,kind:"wall"}]}];updateRace(.02)');assert.equal(run('mini.miss'),1);close();
console.log('PASS: runner obstacle rules.');
