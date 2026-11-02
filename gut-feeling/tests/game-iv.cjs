// Drip or Die: the HOLD button tracks its own pointer so a second finger cannot release it.
const {run,nodes,close,assert}=require('./harness.cjs');
run('openMini(0);startMini();launchMini();updateMini(3.3);mini.phase=2');
const holdButton={dataset:{action:'hold'},setPointerCapture:()=>{},classList:{add:()=>{}}};
nodes.miniControls.events.pointerdown({target:{closest:()=>holdButton},pointerId:3,preventDefault:()=>{}});nodes.miniControls.events.pointerup({pointerId:9});assert.equal(run('mini.held'),true);nodes.miniControls.events.pointerup({pointerId:3});assert.equal(run('mini.held'),false);close();
console.log('PASS: IV multi-touch hold release.');
