// Gel Yeah: helmets need two strokes, bombs never count as cuts, blue gremlins split.
const {run,close,assert}=require('./harness.cjs');
run('openMini(4);startMini();launchMini();updateMini(3.3);mini.gels=[{id:1,x:300,y:250,r:27,hp:2,armor:true,stroke:-1,bomb:false}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeMove({x:250,y:250})');assert.equal(run('mini.gels[0].hp'),1);
run('arcadeUp();arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeUp()');assert.equal(run('mini.got'),1);
run('mini.gels=[{id:2,x:300,y:250,r:27,hp:1,split:true,stroke:-1,bomb:false,vx:0}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeUp()');assert.equal(run('mini.gels.filter(g=>!g.dead).length'),2);
run('mini.gels=[{id:3,x:300,y:250,r:28,hp:1,bomb:true,stroke:-1}];arcadeDown({x:250,y:250});arcadeMove({x:350,y:250});arcadeUp()');assert.equal(run('mini.miss'),1);close();
console.log('PASS: swipe armor, split and bomb rules.');
