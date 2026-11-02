// Polarity Panic: polarity changes the force direction, and untouched drifting orbs cannot score.
const {run,close,assert}=require('./harness.cjs');
run('openMini(1);startMini();launchMini();updateMini(3.3);mini.orbs=[{id:1,x:300,y:300,vx:0,vy:0,kind:0,bad:false,touched:false,r:19,cool:0}];Object.assign(mini.magnet,{x:400,y:300,on:true,mode:1});updateMagnet(.02)');assert.ok(run('mini.orbs[0].vx')>0);
run('mini.orbs[0].vx=0;mini.magnet.mode=-1;updateMagnet(.02)');assert.ok(run('mini.orbs[0].vx')<0);close();
console.log('PASS: magnet polarity.');
