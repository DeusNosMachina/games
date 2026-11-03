// Not part of the suite. A human-speed yardstick for Gurney Grand Prix: a player who sees the world a
// beat late and drives with a thumb. Every decision uses what was on screen REACT seconds ago (cars,
// pads and ramps hidden behind a crest or too far to make out are not seen at all), moved on by how
// fast things were going. Steering is a held thumb on one half of the screen, pulsed for gentle
// corrections; curves are felt late and only partly anticipated, so the gurney runs wide before it
// comes back, and the rumble strip's shake (felt a beat late too) makes it steer back hard. Lane
// choices carry a misjudged gap now and then and a stubborn streak (it sticks with a line until it is
// clearly worse). Most boost pads and lane ramps it sees get a go, aimed a little off; some it lets
// pass. Boosts go on straights that look clear; softballs go at Ralph or at a wall of traffic.
// The bot wins everything by design; this says whether a person can. Usage from the repository root
// (reaction s, trials, prescription 0-2; ONLY=3 runs Legendary alone):
//   node gut-feeling/tests/tools/race-human.cjs 0.25 40 1
// Targets at the default prescription: a 0.25 s player wins level 1 nearly always (but a messy race
// with a few spin-outs can lose it), level 2 most of the time, level 3 sometimes and Legendary about
// one race in four; a 0.35 s player still clears level 1 nearly always and wins level 2 now and then.
// Losses should be about place, not the clock. Read the per-level line: wins, average place, pace
// (share of top speed), finish time and time to spare, spins (crashes plus spin-outs) and spin-outs
// per race, jumps and pads per race, what caused the spins, and why losses happened. NOCLOCK=1 removes
// the clock to read a player's natural pace.
const { run } = require('../harness.cjs');
const REACT = +process.argv[2] || 0.25,
  TRIALS = +process.argv[3] || 30,
  DIFF = process.argv[4] === undefined ? 1 : +process.argv[4],
  ONLY = process.env.ONLY,
  OFFSET = +process.env.OFFSET || 0; // first trial's seed index, to split a long run across processes

run(`var hSeed=1;Math.random=()=>{hSeed=(hSeed*1664525+1013904223)>>>0;return hSeed/4294967296};
var hRng=7;function hRand(){hRng=(hRng*1103515245+12345)>>>0;return hRng/4294967296}
var H=null,hCauses={};
var hRealCrash=raceCrash;raceCrash=function(c,p){const k=c?(c.racer?'rival '+c.kind:c.kind)+(c.blocking?' blocking':''):'prop '+p.kind;hCauses[k]=(hCauses[k]||0)+1;return hRealCrash(c,p);};
var hRealSpinOut=raceSpinOut;raceSpinOut=function(l){const k=l?'spin-out landing':'spin-out';hCauses[k]=(hCauses[k]||0)+1;return hRealSpinOut(l);};
function humanSee(){
  const view=raceView(activeCanvas(),mini.raceZ),cars=[],feats=[],course=mini.raceCourse;
  const seen=(z,x,h)=>{const s=raceSpot(view,z,x);return s&&s.w>=3&&s.y-h*s.w<=s.clip;};
  for(const c of mini.raceCars){
    if(c.out||c.knocked)continue;
    const dz=c.z-mini.raceZ;
    if(dz<-3||dz>110)continue;
    if(dz>3&&!seen(c.z,c.x,c.h))continue;
    cars.push({id:c.id,z:c.z,x:c.x,v:c.v,w:c.w,kind:c.kind,tx:c.tx,lane:c.lane,blink:c.blink,nextLane:c.nextLane,blocking:c.blocking,air:c.air,chase:c.chase});
  }
  for(const p of course.pads){const dz=p.z-mini.raceZ;if(dz>-2&&dz<80&&(dz<4||seen(p.z,p.x,0)))feats.push({id:'p'+p.z,kind:'pad',z:p.z,x:p.x,w:p.w});}
  for(const r of course.ramps){const dz=r.end-mini.raceZ;if(r.w<1&&dz>-1&&dz<80&&(dz<6||seen(r.z,r.x,RACE_RAMP_H)))feats.push({id:'r'+r.z,kind:'ramp',z:r.end,x:r.x,w:r.w});}
  return {t:mini.total,z:mini.raceZ,x:mini.raceX,v:mini.raceV,vx:mini.raceVx,edge:mini.raceRumble||mini.raceOff,cars,feats};
}
function humanStart(react){H={react,hist:[],target:0,phase:0,side:0,lastThrow:-9,lastBoostLook:-9,misjudge:{},plan:{}};}
function humanTick(){
  H.hist.push(humanSee());
  while(H.hist.length>2&&H.hist[1].t<=mini.total-H.react)H.hist.shift();
  const old=H.hist[0],dt=mini.total-old.t,top=mini.raceTop;
  const z=old.z+old.v*dt,x=old.x+old.vx*dt*0.5,pct=old.v/top,v=Math.max(old.v,top*0.8);
  const cars=old.cars.map(c=>({...c,z:c.z+c.v*dt}));
  // Lane choice: who would I meet in each lane, and how soon? A gap is sometimes misjudged.
  const xAt=(c,t)=>{let tx=c.tx!==undefined?c.tx:RACE_LANES[c.blink>0?c.nextLane:c.lane];if(c.kind==='ralph'&&c.blocking)tx=x;const lat=c.kind==='ralph'?0.8:c.kind in RACE_KINDS?1:0.55;return c.x+Math.max(-lat*t,Math.min(lat*t,tx-c.x));};
  // Heading for line L, would I touch car c while we are side by side? Returns when that starts.
  const myX=(L,t)=>x+Math.sign(L-x)*Math.min(Math.abs(L-x),1.5*t);
  const touch=(c,L,room)=>{
    if(c.air>0||c.chase)return Infinity;
    const dz=c.z-z,close=v-c.v;let t0,t1;
    if(Math.abs(dz)<RACE_LEN+0.2){t0=0;t1=close>0.3?(dz+RACE_LEN)/close:0.6;}
    else if(dz>0&&close>0.3){t0=(dz-RACE_LEN-0.2)/close;t1=(dz+RACE_LEN)/close;}
    else return Infinity;
    if(t0>2.6)return Infinity;
    for(let q=0;q<=4;q++){const t=t0+(t1-t0)*q/4;if(Math.abs(xAt(c,t)-myX(L,t))<room)return t0;}
    return Infinity;
  };
  // A ramp I am lining up flies me over whatever sits just past its lip.
  const jump=H.jumpZ!==undefined&&H.jumpZ>z-1?H.jumpZ:null;
  const cost=(L,skipFlown)=>{
    let k=Math.abs(L-x)*4+Math.abs(L)*0.5;
    for(const c of cars){
      if(skipFlown&&c.z>skipFlown&&c.z<skipFlown+v/top*45)continue;
      if(H.misjudge[c.id]===undefined)H.misjudge[c.id]=hRand()<0.18?0.7:1;
      const t=touch(c,L,c.w*H.misjudge[c.id]+RACE_PW+0.04);
      if(t<Infinity)k+=300/(t+0.25);
    }
    return k;
  };
  const opts=RACE_LANES.map(L=>({L,k:cost(L)}));
  // Pads and lane ramps: most get a go, aimed a little off; some I let pass.
  H.jumpZ=undefined;
  for(const f of old.feats.slice().sort((a,b)=>a.z-b.z)){
    if(f.z<z+3)continue;
    if(H.plan[f.id]===undefined)H.plan[f.id]=hRand()<(f.kind==='ramp'?0.8:0.7)?(hRand()-0.5)*2*(f.kind==='ramp'?0.16:0.2):null;
    if(H.plan[f.id]===null)continue;
    const L=Math.max(-0.9,Math.min(0.9,f.x+H.plan[f.id])),fly=f.kind==='ramp'&&Math.abs(L-f.x)<f.w?f.z:0;
    opts.push({L,k:cost(L,fly)-(f.kind==='ramp'?70:45),feat:f,fly});
    break;
  }
  opts.sort((a,b)=>a.k-b.k);
  const keep=cost(H.target,H.fly||0)-(H.feat&&H.feat.z>z+2?(H.feat.kind==='ramp'?70:45):0);
  let pickL=opts[0];
  if(opts[1]&&opts[1].k-opts[0].k<25&&hRand()<0.12)pickL=opts[1];
  if(pickL.k<keep-35||keep>220){H.target=pickL.L;H.feat=pickL.feat||null;H.fly=pickL.fly||0;}
  if(H.feat&&H.feat.z<z)H.feat=null,H.fly=0;
  // Ralph or a wall of traffic: throw.
  if(mini.raceBalls>0&&mini.total-H.lastThrow>1.2){
    const ralph=cars.find(c=>c.kind==='ralph'&&c.blocking&&c.z-z<22&&c.z-z>4&&Math.abs(c.x-x)<0.5);
    const spare=mini.raceBalls>(mini.raceRivals.some(c=>c.kind==='ralph'&&c.z>z)?1:0);
    const boxed=spare&&opts[0].k>200&&cars.some(c=>Math.abs(c.x-x)<0.45&&c.z-z>5&&c.z-z<35);
    if(ralph||boxed){miniAction('throw');H.lastThrow=mini.total;}
  }
  // Boost when the road ahead looks straight and clear; spend the rest late in the race.
  if(mini.raceBoosts>0&&mini.raceBoostT<=0&&mini.total-H.lastBoostLook>0.5){
    H.lastBoostLook=mini.total;
    let bend=0;for(let i=0;i<70;i++)bend=Math.max(bend,Math.abs(raceSeg(z+i).curve));
    const clear=!cars.some(c=>c.z-z<80&&Math.abs(c.x-H.target)<0.6&&c.v<v*1.2);
    if(clear&&(bend<2.4||raceProgress()>0.85)&&hRand()<0.6)miniAction('boost');
  }
  // Steering: feel the curve late (the push where I was), only partly anticipate it, then hold a
  // side of the screen, pulsing it for small corrections. The rumble strip, felt a beat late, adds a
  // pull back toward the middle.
  const push=raceSeg(old.z).curve*RACE_CENT*Math.min(1.44,pct*pct)*0.7;
  let want=Math.max(-1.8,Math.min(1.8,(H.target-x)*3.2))+push;
  if(old.edge&&Math.abs(old.x)>RACE_RUMBLE_X)want-=Math.sign(old.x)*0.9;
  const s=want/(RACE_STEER*(0.3+0.7*Math.min(1,pct)));
  H.phase=(H.phase+0.048/0.15)%1;
  let side=Math.abs(s)>0.55?Math.sign(s):Math.abs(s)>0.14?(H.phase<Math.abs(s)?Math.sign(s):0):0;
  if(side!==H.side){
    if(mini.pointer)arcadeUp();
    if(side)arcadeDown({x:activeCanvas().w*(side<0?0.1:0.9),y:activeCanvas().h*0.88});
    H.side=side;
  }
}`);

const results = [];
for (const tier of ONLY ? [+ONLY] : [0, 1, 2, 3]) {
  const runs = [];
  run('hCauses={}');
  for (let trial = 0; trial < TRIALS; trial++) {
    const k = trial + OFFSET;
    run(`hSeed=${9001 + k * 131};hRng=${77 + k * 17};state.difficulty=${DIFF};openMini(3);mini.tier=${tier};startMini();launchMini();updateMini(1.6);humanStart(${REACT})${process.env.NOCLOCK ? ';mini.limit=1e9' : ''}`);
    for (let i = 0; i < 20000 && run("mini.screen==='play'"); i++) {
      if (i % 3 === 0) run('humanTick()');
      run('updateMini(0.016)');
    }
    runs.push(
      run(
        `({win:mini.pendingFinish&&mini.pendingFinish.win,pace:(mini.raceCourse.finish-mini.raceCourse.start)/Math.max(1,mini.phaseTime)/mini.raceTop,place:mini.raceFinal||0,out:mini.raceOut,s:mini.phaseTime,left:mini.limit-mini.phaseTime,spins:mini.raceCrashes,outs:mini.raceSpinOuts,gate:mini.raceGateIdx<mini.raceCourse.gates.length?'gate '+(mini.raceGateIdx+1):'the finish',jumps:mini.raceJumps,pads:mini.racePads,bonks:mini.raceHits})`
      )
    );
    run('mini.open=false;$("miniDialog").close()');
  }
  const won = runs.filter(r => r.win).length,
    fin = runs.filter(r => r.place),
    avg = (a, f) => (a.length ? a.reduce((s, r) => s + f(r), 0) / a.length : 0),
    why = {};
  for (const r of runs) {
    if (r.win) continue;
    const k = r.out === 'time' ? 'out of time before ' + r.gate : 'place ' + r.place;
    why[k] = (why[k] || 0) + 1;
  }
  console.log(
    'L' + (tier + 1),
    'P' + DIFF,
    'react',
    REACT,
    'won',
    won,
    '/',
    runs.length,
    'avg place',
    avg(fin, r => r.place).toFixed(1),
    'avg s',
    avg(fin, r => r.s).toFixed(1),
    'pace',
    avg(fin, r => r.pace).toFixed(3),
    'p25/50/75',
    [0.25, 0.5, 0.75].map(q => (fin.map(r => r.pace).sort((a, b) => a - b)[Math.floor(q * (fin.length - 1))] || 0).toFixed(3)).join('/'),
    'spare s',
    avg(fin, r => r.left).toFixed(1),
    'spins',
    avg(runs, r => r.spins).toFixed(1),
    'spin-outs',
    avg(runs, r => r.outs).toFixed(1),
    'jumps',
    avg(runs, r => r.jumps).toFixed(1),
    'pads',
    avg(runs, r => r.pads).toFixed(1),
    'bonks',
    avg(runs, r => r.bonks).toFixed(1),
    JSON.stringify(why),
    'spins by:',
    JSON.stringify(run('hCauses'))
  );
  results.push({ tier, won, n: runs.length });
}
