// Not part of the suite. A human-speed yardstick for Polarity Panic, the MRI pinball table: a player who sees the table
// REACT seconds late, follows the ball's fall the way a person tracks it (straight-line flight under
// gravity, blind to the bounces it has not seen yet), and flips when that guess says the ball has
// reached the flipper. Every approach carries a timing error (sigma 0.14 × REACT) and one in eight is
// mistimed by 80 to 160 ms. It holds a flip about a fifth of a second, taps to launch after a beat,
// fires the magnet (both flippers) when it sees the ball diving at the centre drain, never nudges and
// never aims. The bots win everything by design; this says whether a person can.
// Usage from the repository root (reaction s, trials, prescription 0-2):
//   node gut-feeling/tests/tools/magnet-human.cjs 0.25 30 1
// Target: at 0.25 s level 1 nearly always, level 2 most of the time, level 3 sometimes; a 0.35 s
// player still clears level 1. ONLY=0 runs one level.
const {run,close}=require('../harness.cjs');
const REACT=+process.argv[2]||0.25, TRIALS=+process.argv[3]||30, DIFF=process.argv[4]!==undefined?+process.argv[4]:1, ONLY=process.env.ONLY;
run('var rng=1;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`var H={};
function hrand(){H.rs=(H.rs*1103515245+12345)>>>0;return H.rs/4294967296}
function hnoise(){let u=0;for(let i=0;i<6;i++)u+=hrand();return (u-3)*Math.SQRT2}
function humanReset(seed){H={hist:[],rs:seed,down:[false,false],until:[0,0],cool:[0,0],plans:{},launchAt:null,launching:false,mag:0}}
function humanOver(f,x,y){
  const L=MAGNET_FLIP.len,ux=Math.cos(f.rest),uy=Math.sin(f.rest),rx=x-f.x,ry=y-f.y,along=rx*ux+ry*uy,across=-rx*uy+ry*ux,side=f.side?-across:across;
  return along>8&&along<L+6&&side<0&&side>-(MAGNET_BALL+26);
}
function humanStep(REACT){
  const now=mini.total,W=activeCanvas().w,at=s=>({x:s?W*0.75:W*0.25,y:300});
  const press=s=>{if(!H.down[s]){MAGNET.touch('down',at(s),11+s);H.down[s]=true}};
  const lift=s=>{if(H.down[s]){MAGNET.touch('up',at(s),11+s);H.down[s]=false;H.cool[s]=now+0.1}};
  H.hist.push({t:now,waiting:magnetWaiting(),balls:mini.pinBalls.filter(b=>b.state==='play').map(b=>({id:b.id,x:b.x,y:b.y,vx:b.vx,vy:b.vy}))});
  while(H.hist.length>2&&H.hist[1].t<=now-REACT)H.hist.shift();
  const view=H.hist[0],age=now-view.t;
  if(H.launching){MAGNET.touch('up',{x:W/2,y:300},13);H.launching=false;return}
  if(magnetWaiting()){
    lift(0);lift(1);
    if(view.waiting){if(H.launchAt===null)H.launchAt=now+0.25+hrand()*0.5;if(now>=H.launchAt){MAGNET.touch('down',{x:W/2,y:300},13);H.launching=true;H.launchAt=null}}
    return;
  }
  H.launchAt=null;
  const g=mini.pinLv.gravity;
  // The magnet: the late view shows a ball diving at the gap between the flippers, or sinking into an
  // outlane with its kickback dark. Hold both until the late view shows it climbing, at most 0.9 s.
  const D=mini.pinLv.divider,
    sinking=b=>b.vy>-150&&b.y>450&&((b.x<D+4&&!mini.pinKick[0])||(b.x>2*MAGNET_CX-D-4&&b.x<MAGNET_LANE.x0&&!mini.pinKick[1])),
    diving=b=>b.vy>0&&b.y>560&&Math.abs(b.x+b.vx*0.1-MAGNET_CX)<34;
  if(!mini.pinHot&&H.mag<=now&&view.balls.some(b=>sinking(b)||diving(b)))H.mag=now+0.9;
  if(H.mag>now&&!mini.pinHot&&view.balls.some(b=>sinking(b)||diving(b)||b.y>450)){press(0);press(1);return}
  H.mag=0;
  for(const f of mini.pinFlips){
    const s=f.side;
    if(H.down[s]){if(now>=H.until[s])lift(s);continue}
    if(now<H.cool[s])continue;
    for(const b of view.balls){
      let hit=null;
      for(let t=0;t<=0.8;t+=0.01){const x=b.x+b.vx*t,y=b.y+b.vy*t+0.5*g*t*t;if(humanOver(f,x,y)){hit=t;break}if(y>720)break}
      if(hit===null)continue;
      const key=b.id+':'+s;
      if(!H.plans[key]||H.plans[key].expire<now){let err=hnoise()*0.14*REACT;if(hrand()<0.125)err+=(hrand()<0.5?-1:1)*(0.08+0.08*hrand());H.plans[key]={err,expire:now+0.45}}
      if(hit-age+H.plans[key].err<=0.015){press(s);H.until[s]=now+0.17+hrand()*0.08;break}
    }
  }
}`);
for (const tier of (ONLY?[+ONLY]:[0,1,2])) {
  const runs=[];
  for (let trial=0;trial<TRIALS;trial++){
    close();
    run(`rng=${1000+trial*7919};humanReset(${77+trial*131});state.difficulty=${DIFF};openMini(1);mini.tier=${tier};startMini();launchMini();updateMini(3.3)`);
    const r=JSON.parse(run(`(()=>{let n=0;while(mini.screen==='play'&&n++<60000){humanStep(${REACT});updateMini(1/60)}
      return JSON.stringify({win:!!(mini.pendingFinish&&mini.pendingFinish.win),got:mini.got,goal:mini.goal,t:mini.total,drains:mini.pinDrains,score:mini.score,ramps:mini.pinRamps,saves:mini.pinMagSaves,uses:mini.pinMagUses})})()`));
    runs.push(r);
  }
  const won=runs.filter(r=>r.win).length,avg=k=>(runs.reduce((a,r)=>a+r[k],0)/runs.length).toFixed(1);
  console.log('L'+(tier+1),'P'+DIFF,'react',REACT,'won',won,'/',runs.length,'avg evicted',avg('got'),'of',runs[0].goal,'avg s',avg('t'),'drains',avg('drains'),'score',avg('score'),'scans',avg('ramps'),'magnet saves',avg('saves'));
}
