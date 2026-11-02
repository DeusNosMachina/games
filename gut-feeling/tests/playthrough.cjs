// Deterministic input-only controllers exercise full runs through the real physics.
const {run,close,assert}=require('./harness.cjs');
run(`let testSeed=2026;Math.random=()=>{testSeed=(testSeed*1664525+1013904223)>>>0;return testSeed/4294967296};
function playTest(id,tier,difficulty){
 state.difficulty=difficulty;openMini(id);mini.tier=tier;startMini();let n=0,chosen=-1,lastStroke=0;
 while(['briefing','intro','play','outro'].includes(mini.screen)&&n++<40000){
  if(mini.screen==='briefing')launchMini();
  if(mini.screen==='play'){
   if(id===0){if(mini.phase===0&&Math.abs(mini.pos-mini.target)<.005)miniAction('tap');
    if(mini.phase===1){const d=mini.drops.filter(o=>!o.done).sort((a,b)=>b.y-a.y)[0];if(d){if(d.bad&&mini.lane===d.lane)miniAction('lane'+((d.lane+1)%3));else if(!d.bad&&d.kind===mini.recipe)miniAction('lane'+d.lane)}}
    if(mini.phase===2)mini.held=mini.pressure+mini.velocity*.16<mini.pressureTarget;
   }
   if(id===1){
    let o=mini.orbs.find(o=>o.id===chosen&&!o.dead);
    if(!o){o=mini.orbs.filter(o=>o.bad).sort((a,b)=>a.y-b.y)[0]||mini.orbs.filter(o=>!o.bad).sort((a,b)=>a.y-b.y)[0];chosen=o?.id}
    if(o){const gx=o.bad?300:o.kind?465:135,dx=gx-o.x,dy=(o.bad?590:65)-o.y,d=Math.hypot(dx,dy)||1;
     const speed=Math.min(180,d*3),fx=dx/d*speed-o.vx,fy=dy/d*speed-o.vy,fd=Math.hypot(fx,fy)||1;
     const p={x:clamp(o.x+fx/fd*85,0,600),y:clamp(o.y+fy/fd*85,0,600)};
     if(!mini.pointer)arcadeDown(p);else arcadeMove(p);
    }
   }
   if(id===2&&!mini.balls.length&&!mini.queue&&!mini.boardWait){
    const target=mini.blocks.filter(b=>b.hp>0).sort((a,b)=>b.y-a.y||a.hp-b.hp)[0];
    if(target){const dx=target.x+target.w/2-mini.anchor.x,dy=target.y-mini.anchor.y,d=Math.hypot(dx,dy);arcadeDown({...mini.anchor});arcadeMove({x:mini.anchor.x-dx/d*145,y:mini.anchor.y-dy/d*145});arcadeUp()}
   }
   if(id===3){const row=mini.rows.find(r=>!r.done);if(row){const want=mini.stunts<mini.stuntGoal?(row.objects.find(o=>['crate','bar'].includes(o.kind))||row.objects.find(o=>o.kind==='coin')):row.objects.find(o=>o.kind==='coin');const lane=want.lane;if(mini.lane<lane)miniAction('right');if(mini.lane>lane)miniAction('left');const speed=(130+mini.tier*16+mini.shift*23)*mini.rules.mini;if((490-row.y)/speed<.35&&row.y<490){if(want.kind==='crate'&&mini.jump===0)miniAction('jump');if(want.kind==='bar'&&mini.slide===0)miniAction('slide')}}}
   if(id===5){
    const e=mini.targets.filter(e=>!e.dead).sort((a,b)=>(b.mode==='leap'?3:b.mode==='wind'?2:1)-(a.mode==='leap'?3:a.mode==='wind'?2:1)||b.age-a.age)[0];
    if(e){arcadeDown({x:300,y:300});arcadeMove({x:300+clamp((e.x-mini.lookTarget.yaw)/1.8,-280,280),y:300+clamp((e.y+2-mini.lookTarget.pitch)/1.1,-200,200)});arcadeUp(true);const p=shooterProjection(e);if(Math.hypot(p.x-300,p.y+2*p.s-285)<12*p.s)miniAction('fire')}
    if(mini.ammo===0)miniAction('reload');
   }
   if(id===4&&mini.total-lastStroke>.07){
    const good=mini.gels.filter(o=>!o.bomb&&!o.dead&&o.y>90&&o.y<550);
    const o=good.find(o=>!mini.gels.some(b=>b.bomb&&!b.dead&&dist(o,b)<o.r+b.r+10));
    if(o){arcadeDown({x:o.x-4,y:o.y});arcadeMove({x:o.x+4,y:o.y});arcadeUp();lastStroke=mini.total}
   }
  }
  updateMini(.016);
 }
 const result={id,tier,difficulty,win:mini.win,miss:mini.miss,got:mini.got,goal:mini.goal,seconds:Math.round(mini.total),score:mini.score,reason:mini.pendingFinish?.reason};mini.open=false;$('miniDialog').close();return result;
}`);
let results=[];
for(let difficulty=0;difficulty<3;difficulty++)for(let id=0;id<6;id++)for(let tier=0;tier<3;tier++){
 const r=run(`playTest(${id},${tier},${difficulty})`);results.push(r);
}
for(const r of results)assert.equal(r.win,true,JSON.stringify(r));
console.log('PASS: 54 input-driven complete runs across all games, tiers, and difficulty prescriptions.');
console.log('Active seconds by game (automated inputs; human aim/decision time adds to volley games):',JSON.stringify([0,1,2,3,4,5].map(id=>{const a=results.filter(r=>r.id===id);return {game:id,min:Math.min(...a.map(r=>r.seconds)),max:Math.max(...a.map(r=>r.seconds))}})));
