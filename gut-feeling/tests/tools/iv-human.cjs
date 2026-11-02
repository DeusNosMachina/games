// Not part of the suite. A human-speed yardstick for the Drip or Die catch phase: a player who sees the
// world a quarter second late, reads the order banner, commits to the next right sip and never steps
// under a skull or wrong flavor landing in the next 0.4 s. The bots win everything by design; this says
// whether a person can. Usage from the repository root (reaction s, trials, prescription 0-2):
//   node gut-feeling/tests/tools/iv-human.cjs 0.25 30 1
// Every level should finish its quota with few strikes at 0.25 s; a 0.35 s player should feel it on
// levels 2 and 3 and lose some. Read the per-level line: avg caught against the quota (10 / 12 / 14),
// and the strike causes.
const {run,close}=require('../harness.cjs');
function playAt(tier,phase,difficulty=1){close();run(`state.difficulty=${difficulty};openMini(0);mini.tier=${tier};startMini()`);if(phase)run(`ivPhase(${phase})`);run('launchMini();updateMini(3.3)');}
const REACT=+process.argv[2]||0.25, TRIALS=+process.argv[3]||30, DIFF=+process.argv[4]||1, TRACE=process.env.TRACE, ONLY=process.env.ONLY;
const log=[];
function classify(view){
  // Which drops are right, walking the order from the current step in landing order.
  const orders=view.orders; let oi=0, step=view.step;
  const sips=view.ds.filter(d=>!d.bad&&!d.scoop).sort((a,b)=>a.t-b.t);
  // Drops landing together are one wave: only one can be caught, the one the order wants now.
  for(let i=0;i<sips.length;){
    let j=i;while(j<sips.length&&sips[j].t-sips[i].t<0.08)j++;
    const wave=sips.slice(i,j),want=orders[oi][step],hit=wave.find(d=>d.kind===want);
    for(const d of wave){if(d===hit)d.good=true;else d.wrong=true;}
    if(hit){step++;if(step>=orders[oi].length){step=0;oi=Math.min(oi+1,orders.length-1);}}
    i=j;
  }
}
for (const tier of (ONLY?[+ONLY]:[0,1,2])) {
  const runs=[];const causes={};
  for (let trial=0;trial<TRIALS;trial++){
    playAt(tier,1,DIFF);
    run('mini.limit=1e9');
    let t=0;const views=[];let commit=null;
    while(run("mini.screen==='play'") && run('mini.phase')===1 && t<90){
      const view=run(`(()=>{const ds=mini.drops.filter(d=>!d.done).map(d=>({id:d.__id||(d.__id=Math.random()),lane:ivHopWarn(d)?d.hopTo:d.lane,t:(352-d.y)/d.speed,bad:d.bad,scoop:!!d.scoop,kind:d.kind}));return {ds,lane:mini.lane,cup:ivCupLane(),now:mini.phaseTime,step:mini.ivOrderStep,orders:[ivOrder(mini.ivOrderIdx),ivOrder(mini.ivOrderIdx+1),ivOrder(mini.ivOrderIdx+2)]}})()`);
      views.push(view);
      const old=views[Math.max(0,views.length-1-Math.round(REACT/0.048))];
      const ds=old.ds.map(d=>({...d,t:d.t-(view.now-old.now)})).filter(d=>d.t>-0.05);
      const seen={ds,step:old.step,orders:old.orders};classify(seen);
      const hazard=(l,within)=>ds.some(d=>(d.bad||d.wrong)&&d.lane===l&&d.t<within);
      if(commit){const c=ds.find(d=>d.id===commit.id);commit=c&&c.good?c:null;}
      if(!commit){const goods=ds.filter(d=>d.good&&d.t>0.12);commit=goods.length?goods[0]:null;}
      let target=view.lane;
      if(commit){
        // Go for it unless something lands in that lane first.
        const first=ds.filter(d=>d.lane===commit.lane&&d.t<commit.t-0.02&&(d.bad||d.wrong));
        target=first.length?view.cup:commit.lane;
      }
      // Safety: a hazard in the target lane within 0.4 s (and before the sip we want) means hold or flee.
      const dangerIn=l=>ds.some(d=>(d.bad||d.wrong)&&d.lane===l&&d.t<0.4&&!(commit&&commit.lane===l&&commit.t<d.t));
      if(dangerIn(target)){
        const safe=[0,1,2].filter(l=>!dangerIn(l)&&!hazard(l,0.6)).sort((a,b)=>Math.abs(a-view.cup)-Math.abs(b-view.cup));
        target=safe.length?safe[0]:[0,1,2].filter(l=>!dangerIn(l)).sort((a,b)=>Math.abs(a-view.cup)-Math.abs(b-view.cup))[0]??target;
      }
      if(target!==view.lane)run(`miniAction('lane${target}')`);
      if(TRACE)log.push({t:+t.toFixed(2),cup:view.cup,lane:view.lane,target,commit:commit?commit.lane+':'+commit.kind+'@'+commit.t.toFixed(2):'-',step:old.step,order:old.orders[0].join(''),seen:ds.map(d=>(d.bad?'K':d.good?'G':d.wrong?'W':'s')+d.lane+(d.bad?'':':'+d.kind)+'@'+d.t.toFixed(2)).join(' '),now:view.ds.map(d=>(d.bad?'K':'')+d.lane+(d.bad?'':':'+d.kind)+'@'+d.t.toFixed(2)).join(' ')});
      for(let k=0;k<3;k++){const before=run('mini.miss');run('updateMini(0.016)');const after=run('mini.miss');if(after>before){const c=run('mini.flashText').split('  ·')[0];const hopped=run('mini.drops.some(d=>d.caught&&d.bad&&d.hopped)');const key=c+(hopped?' [HOPPED]':'');causes[key]=(causes[key]||0)+1;if(TRACE&&trial===0){console.log('\n=== STRIKE',c,'t',t.toFixed(2));for(const l of log.slice(-16))console.log(JSON.stringify(l));}}}
      t+=0.048;
    }
    runs.push({t:+t.toFixed(1),caught:run('mini.caught'),miss:run('mini.miss'),won:run('mini.phase')!==1&&run("mini.screen==='play'")});
  }
  const won=runs.filter(r=>r.won).length;
  console.log('L'+(tier+1),'P'+DIFF,'react',REACT,'won',won,'/',runs.length,'avg caught',(runs.reduce((a,r)=>a+r.caught,0)/runs.length).toFixed(1),'avg s',(runs.reduce((a,r)=>a+r.t,0)/runs.length).toFixed(1),JSON.stringify(causes));
}
