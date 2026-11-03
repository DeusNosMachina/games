// Deterministic input-only controllers (tests/bots/*.cjs) exercise full runs through the real physics.
// Each bot file exports {id, policy}; the policy runs every tick during play with a persistent `bot` object.
const {run,assert}=require('./harness.cjs');
const fs=require('node:fs'),path=require('node:path');
// A bot exports {id, policy} for the arcade registered under that room id, or {id: 'recovery', room: 0,
// forced: true, policy} for the mandatory recovery run (opened with openMini(room, true)).
const bots=fs.readdirSync(path.join(__dirname,'bots')).filter(f=>f.endsWith('.cjs')).map(f=>require('./bots/'+f)).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
run(`let testSeed=2026;Math.random=()=>{testSeed=(testSeed*1664525+1013904223)>>>0;return testSeed/4294967296};var bot={},botPolicies={};`);
for(const b of bots)run(`botPolicies[${JSON.stringify(b.id)}]=function(){${b.policy}}`);
run(`function playTest(key,room,forced,tier,difficulty){
 state.difficulty=difficulty;openMini(room,forced);mini.tier=tier;startMini();bot={};let n=0;
 while(['briefing','intro','play','outro'].includes(mini.screen)&&n++<40000){
  if(mini.screen==='briefing')launchMini();
  if(mini.screen==='play')botPolicies[key]();
  updateMini(.016);
 }
 const result={id:key,tier,difficulty,win:mini.win,miss:mini.miss,got:mini.got,goal:mini.goal,seconds:Math.round(mini.total),score:mini.score,reason:mini.pendingFinish?.reason};mini.open=false;$('miniDialog').close();return result;
}`);
let results=[];
for(let difficulty=0;difficulty<3;difficulty++)for(const b of bots)for(let tier=0;tier<3;tier++)results.push(run(`playTest(${JSON.stringify(b.id)},${b.room??b.id},${!!b.forced},${tier},${difficulty})`));
for(const r of results)assert.equal(r.win,true,JSON.stringify(r));
console.log(`PASS: ${results.length} input-driven complete runs across all games, tiers, and difficulty prescriptions.`);
console.log('Active seconds by game (automated inputs; human aim and decision time add to every game):',JSON.stringify(bots.map(b=>{const a=results.filter(r=>r.id===b.id);return {game:b.id,min:Math.min(...a.map(r=>r.seconds)),max:Math.max(...a.map(r=>r.seconds))}})));
