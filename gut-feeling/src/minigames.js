// Each run owns its timers, score, limited assists, and escalating rounds.
const approaches=[
 {name:'Steady hands',helps:2,multiplier:1,desc:'Two emergency assists for the entire run.'},
 {name:'Show-off shift',helps:0,multiplier:1.25,desc:'No assists. Earn 25% more coins.'}
];
function openMini(id,forced=false){
 clearHeld();if($('mapDialog').open)$('mapDialog').close();
 let next=state.medals[id].findIndex(m=>!m),tier=forced?0:next<0?2:next;
 mini={open:true,screen:'lobby',id,tier,forced,approach:0,paused:false,held:false,t:0};
 $('miniDialog').classList.remove('gory');$('miniClose').classList.toggle('hidden',forced);
 showLobby();modalOpen($('miniDialog'));
}
const tierNotes=[
 ['8 taps · 10 catches · moving pressure','10 taps · faster recipes · narrower band','12 taps · shifting timing targets · stronger drift'],
 ['3 checkpoints · momentum & brakes','Shorter warnings · longer scans','Fast starts · tight stops · 4 clean locks'],
 ['6 builds · growing fresh patterns','7 builds · reverse-order rounds','8 builds · reverse & mirrored shapes'],
 ['3 sectors · dodge or swat for bonuses','Faster traffic · higher token quotas','Dense traffic · narrow swat timing'],
 ['6 scans · remember, then time the tag','7 scans · decoys & tighter tag windows','8 scans · more targets & moving tag windows']
];
function showLobby(){
 mini.screen='lobby';mini.held=false;clearHeld();$('miniDialog').dataset.screen='lobby';$('miniClose').disabled=false;
 $('miniLobby').classList.remove('hidden');$('miniPlay').classList.add('hidden');$('miniResult').classList.add('hidden');
 $('miniPauseBtn').classList.add('hidden');
 $('miniDepartment').textContent=rooms[mini.id].name.toUpperCase()+(mini.forced?' / MANDATORY REASSEMBLY':' / HOSPITAL ARCADE');
 $('miniTitle').textContent=rooms[mini.id].game;$('miniGenre').textContent=rooms[mini.id].genre;
 $('miniHeadline').textContent=rooms[mini.id].headline;$('miniDescription').textContent=rooms[mini.id].desc;
 $('tierGrid').innerHTML=tiers.map((t,i)=>'<button class="tier-card '+(mini.tier===i?'selected':'')+'" data-tier="'+i+'" '+(i>0&&(!state.medals[mini.id][i-1]||mini.forced)?'disabled':'')+'><small>LEVEL '+(i+1)+'</small><strong>'+t+'</strong><small>'+tierNotes[mini.id][i]+'</small><div class="medals">'+'★'.repeat(state.medals[mini.id][i])+'☆'.repeat(3-state.medals[mini.id][i])+'</div></button>').join('');
 $('approachOptions').innerHTML=approaches.map((a,i)=>'<button class="approach '+(mini.approach===i?'selected':'')+'" data-approach="'+i+'" aria-pressed="'+(mini.approach===i)+'"><strong>'+a.name+'</strong><small>'+a.desc+'</small></button>').join('');
 $('miniRewardInfo').textContent=(mini.forced?'Complete all three stages to recover. ':'Longer runs. New mechanics at each level. ')+'Bronze 1★ · Silver 2★ · Gold 3★. Precision, clean chains, and unused assists improve your result.';
 $('miniBest').textContent='Best arcade score here: '+(state.records[mini.id][mini.tier]||'—')+' · Progress saves between runs.';
 $('miniDifficulty').textContent='Chaos prescription: '+cfg().name+' ↗';
 miniScene($('miniPreview').getContext('2d'),mini.id,420,240);
}
function startMini(){
 const{id,tier,forced,approach=0}=mini;clearHeld();$('miniLivesLabel').textContent='OOPS ALLOWANCE';
 mini={open:true,screen:'play',id,tier,forced,approach,rules:{...cfg(),misses:cfg().misses+2,coins:cfg().coins*approaches[approach].multiplier},
 paused:false,held:false,t:0,total:0,phaseTime:0,phase:0,round:0,miss:0,quality:100,flash:0,flashText:'',
 countdown:0,initialized:false,hudClock:0,limit:60,score:0,combo:0,maxCombo:0,helps:approaches[approach].helps,helpTime:0,helpUsed:0,precisions:[],inputLock:0};
 $('miniLobby').classList.add('hidden');$('miniPlay').classList.remove('hidden');$('miniResult').classList.add('hidden');
 $('miniPaused').classList.add('hidden');$('miniDialog').classList.remove('gory');
 if(id===0){mini.good=0;mini.precision=[];ivPhase(0)}
 if(id>0)initArcade();else{configureCanvas($('miniCanvas'),800,450);$('miniDialog').dataset.arcade='iv'}
 mini.initialized=true;prepareBriefing();updateMiniHUD();drawMini();
}
function setInstructions(t){$('miniInstruction').textContent=t}
function setControls(buttons){
 $('miniControls').dataset.game=mini.id;
 $('miniControls').innerHTML=buttons.map(b=>'<button data-action="'+b.id+'" class="'+(b.hot?'hot ':'')+(b.pad?'pad':'')+'" '+(b.pad?'style="--pad:'+b.pad+'"':'')+' aria-label="'+b.text+'">'+b.text+(b.key?' <small>('+b.key+')</small>':'')+'</button>').join('')+
 '<button class="assist muted" data-action="assist" aria-label="Use limited assist">ASSIST · '+mini.helps+' left <small>(E)</small></button>';
}
function praise(points,precision=1){
 mini.combo++;mini.maxCombo=Math.max(mini.maxCombo,mini.combo);
 mini.score+=Math.round(points*(1+Math.min(2,Math.floor(mini.combo/5))*.5));
 mini.precisions.push(clamp(precision,0,1));
}
function miniOops(message,amount=1){
 if(mini.screen!=='play')return;
 mini.miss+=amount;mini.combo=0;mini.flash=.9;mini.flashText=message;mini.quality=Math.max(0,mini.quality-12*amount);
 tone(120,.17,'sawtooth');if(mini.miss>=mini.rules.misses)finishMini(false);
}
function useAssist(){
 if(mini.helps<=0)return;
 if(mini.id===2&&mini.mode!=='input')return;
 if(mini.id===4&&(mini.reveal>0||mini.probe>=0))return;
 mini.helps--;mini.helpUsed++;mini.quality-=5;mini.combo=0;mini.helpTime=4;
 if(mini.id===0&&mini.phase===2){mini.pressure=mini.pressureTarget;mini.velocity=0}
 if(mini.id===1){mini.velocity=0;mini.brakeCd=0}
 if(mini.id===2){mini.mode='show';mini.input=0;mini.revealTime=0;mini.activePad=-1}
 if(mini.id===3)mini.inv=4;
 if(mini.id===4){mini.reveal=2;mini.pings++}
 mini.flash=.7;mini.flashText=['EMERGENCY HELP. FIVE STYLE POINTS.','EMERGENCY BRAKE. DIGNITY SAVED.','ONE MORE LOOK. MAKE IT COUNT.','DIGNITY BUBBLE: FOUR SECONDS.','SONAR REPLAY. EYES OPEN.'][mini.id];
 updateMiniHUD();tone(500,.2,'sine');
}
function ivPhase(phase){
 mini.phase=phase;mini.phaseTime=0;mini.held=false;mini.helpTime=0;mini.outside=0;mini.inputLock=0;
 if(phase===0){
  mini.limit=48+mini.tier*8;mini.required=8+mini.tier*2;mini.dir=1;mini.pos=0;mini.target=rand(.35,.72);mini.targetBase=mini.target;
  mini.band=Math.max(.05,mini.rules.window-mini.tier*.012);mini.beatLock=.3;
  setInstructions('Tap the mint window. The sweep reverses after each tap. The gold center earns precision points.');
  setControls([{id:'tap',text:'TAP THE DRIP',key:'Space',hot:true}]);
 }
 if(phase===1){
  mini.limit=55+mini.tier*7;mini.lane=1;mini.cupX=400;mini.drops=[];mini.spawn=.5;mini.spawned=0;mini.caught=0;mini.catchNeed=10+mini.tier*2;mini.recipe=0;
  setInstructions('Catch the requested color. The recipe changes every 4 catches. Avoid green skulls; other colors do not count.');
  setControls([{id:'lane0',text:'← LEFT',key:'A'},{id:'lane1',text:'MIDDLE',key:'S'},{id:'lane2',text:'RIGHT →',key:'D'}]);
 }
 if(phase===2){
  mini.limit=65+mini.tier*10;mini.pressure=.5;mini.velocity=0;mini.stable=0;mini.need=14+mini.tier*3;mini.pressureTarget=.52;mini.pressureBand=.15-mini.tier*.018;
  setInstructions('Follow the moving mint band. Hold to pump, release to lower. Pressure has momentum: make small corrections.');
  setControls([{id:'hold',text:'HOLD TO PUMP',key:'Space',hot:true}]);
 }
 if(mini.initialized)prepareBriefing();
}
function ivTap(){
 if(mini.screen!=='play'||mini.paused||mini.phase!==0||mini.beatLock>0||mini.inputLock>0)return;
 const band=mini.band*(mini.helpTime>0?1.7:1),off=Math.abs(mini.pos-mini.target);
 if(off<=band/2){
  const accuracy=1-off/(band/2);mini.good++;mini.precision.push(accuracy);praise(75+accuracy*75,accuracy);
  mini.flash=.5;mini.flashText=accuracy>.7?'CENTER HIT · BEAUTIFUL DRIP':'GOOD DRIP';tone(500+mini.good*25,.1);
  if(mini.good>=mini.required){ivPhase(1);return}
 }else miniOops('MISSED THE DRIP');
 mini.dir*=-1;mini.pos=mini.dir>0?0:1;mini.beatLock=.42;mini.target=mini.targetBase=rand(.28,.75);
}
function mriRound(){
 mini.progress=0;mini.distance=430+mini.tier*90+mini.round*65;mini.limit=50+mini.tier*8+mini.round*7;
 mini.phaseTime=0;mini.velocity=0;mini.cycle=0;mini.green=2.6;mini.warning=.95/mini.rules.mini-mini.tier*.09;
 mini.red=1.5+mini.round*.2;mini.scan='go';mini.scanFault=false;mini.locks=0;mini.lockNeed=2+mini.round;mini.brakeCd=0;mini.held=false;
 setInstructions('Hold MOVE on green. Coast to a stop on amber or tap BRAKE. A clean pink scan earns a lock.');
 setControls([{id:'hold',text:'HOLD TO MOVE',key:'Space',hot:true},{id:'brake',text:'BRAKE',key:'B'}]);
}
function memoryRound(fresh=false){
 mini.phaseTime=0;mini.limit=28+mini.tier*4+mini.round*2;mini.mode='show';mini.input=0;mini.revealTime=0;mini.activePad=-1;mini.padFlash=0;
 if(fresh){
  const n=5+Math.floor(mini.round/2)+(mini.tier===2?1:0);
  mini.sequence=Array.from({length:n},()=>Math.floor(rand(0,4)));
  mini.transform=mini.tier===2&&mini.round%3===2?'mirror':mini.tier>0&&mini.round%2===1?'reverse':'forward';
  mini.answer=mini.transform==='reverse'?[...mini.sequence].reverse():mini.transform==='mirror'?mini.sequence.map(i=>3-i):[...mini.sequence];
 }
 setInstructions(memoryRule());
 setControls(padShapes.map((text,i)=>({id:'pad'+i,text,key:String(i+1),pad:padColors[i]})));
}
function memoryRule(){return mini.transform==='reverse'?'REVERSE: repeat the pattern from last to first.':mini.transform==='mirror'?'MIRROR: keep the order; swap ▲ ↔ ◆ and ● ↔ ■.':'FORWARD: repeat the pattern in the order shown.'}
function memoryTap(index){
 if(mini.screen!=='play'||mini.paused||mini.mode!=='input'||mini.inputLock>0)return;
 mini.inputLock=.12;mini.activePad=index;mini.padFlash=.22;tone([330,440,550,660][index],.12);
 if(index===mini.answer[mini.input]){
  mini.input++;praise(70);
  if(mini.input===mini.answer.length){
   praise(140);mini.round++;
   if(mini.round>=mini.rounds){finishMini(true);return}
   memoryRound(true);prepareBriefing();
  }
 }else{miniOops('WRONG BRICK. TRY THAT BUILD AGAIN.');if(mini.screen==='play'){memoryRound(false);prepareBriefing()}}
}
function runnerRound(){
 mini.phaseTime=0;mini.limit=25+mini.tier*5+mini.round*4;mini.lane=1;mini.cartX=400;mini.rows=[];mini.spawn=1;
 mini.tokens=0;mini.quota=7+mini.tier*2+mini.round;mini.rowsSeen=0;mini.inv=0;mini.swat=0;mini.swatCd=0;mini.lastSafe=1;
 setInstructions('Gold route = safe tokens. Blue foam = swat just before contact for 3 tokens. Pink barriers cannot be swatted.');
 setControls([{id:'left',text:'← LEFT',key:'A'},{id:'swat',text:'SWAT',key:'Space',hot:true},{id:'right',text:'RIGHT →',key:'D'}]);
}
function echoRound(){
 mini.phaseTime=0;mini.limit=36+mini.tier*7;mini.targets=[];
 const n=3+mini.tier+(mini.round>=4&&mini.tier===0?1:0);
 while(mini.targets.length<n){let cell=Math.floor(rand(0,9));if(!mini.targets.includes(cell))mini.targets.push(cell)}
 mini.decoys=mini.tier>0?[pick([0,1,2,3,4,5,6,7,8].filter(n=>!mini.targets.includes(n)))]:[];
 mini.found=[];mini.wrong=[];mini.reveal=(3.2-mini.tier*.3)/mini.rules.mini;
 mini.probe=-1;mini.lockPos=0;mini.lockTarget=.5;mini.lockBand=(.22-mini.tier*.025)/mini.rules.mini;
 setInstructions('Memorize GREEN gremlins. Tap a hidden cell, then TAG when the marker reaches mint. Pink decoys are traps.');
 setControls([{id:'tag',text:'TAG GREMLIN',key:'Space',hot:true}]);
}
function echoTap(index){
 if(mini.screen!=='play'||mini.paused||mini.reveal>0||mini.probe>=0||mini.found.includes(index)||mini.wrong.includes(index))return;
 if(mini.targets.includes(index)){mini.probe=index;mini.lockPos=0;mini.lockTarget=.35+(index%3)*.15;mini.lockBase=mini.lockTarget;mini.inputLock=.25;setInstructions('Target found. Tap TAG in the mint window to capture it. A missed sweep costs an oops.')}
 else{mini.wrong.push(index);miniOops('DECOY. THE GREMLIN IS ELSEWHERE.')}
}
function echoTag(){
 if(mini.screen!=='play'||mini.paused||mini.probe<0||mini.inputLock>0||mini.reveal>0)return;
 const error=Math.abs(mini.lockPos-mini.lockTarget);
 if(error<=mini.lockBand/2){
  praise(130,1-error/(mini.lockBand/2));mini.found.push(mini.probe);mini.correct++;mini.probe=-1;tone(740,.1);
  setInstructions('Captured. Find the remaining green gremlins from memory.');
  if(mini.found.length===mini.targets.length){mini.round++;if(mini.round>=mini.rounds){finishMini(true);return}echoRound();prepareBriefing()}
 }else{miniOops('TAG MISSED. LINE IT UP AGAIN.');mini.lockPos=0;mini.inputLock=.25}
}
function miniAction(a){
 if(mini.screen!=='play'||mini.paused||mini.countdown>0)return;
 if(mini.id>0){arcadeAction(a);return}
 if(a==='assist'){useAssist();return}
 if(mini.id===0){
  if(a==='tap')ivTap();
  if(mini.phase===1){if(a.startsWith('lane'))mini.lane=clamp(+a.slice(-1),0,2);if(a==='left')mini.lane=Math.max(0,mini.lane-1);if(a==='right')mini.lane=Math.min(2,mini.lane+1)}
 }
 if(mini.id===1&&a==='brake'&&mini.brakeCd<=0){mini.velocity=0;mini.brakeCd=2.6;tone(250,.08)}
 if(mini.id===2&&a.startsWith('pad'))memoryTap(+a.slice(-1));
 if(mini.id===3){
  if(a==='left')mini.lane=Math.max(0,mini.lane-1);if(a==='right')mini.lane=Math.min(2,mini.lane+1);
  if(a==='swat'&&mini.swatCd<=0){mini.swat=.4-mini.tier*.04;mini.swatCd=1.1;tone(350,.08)}
 }
 if(mini.id===4){if(a==='tag')echoTag();if(a.startsWith('cell'))echoTap(+a.slice(4))}
}
function pauseMini(){
 if(!['play','intro'].includes(mini.screen))return;mini.paused=!mini.paused;clearHeld();
 $('miniPaused').classList.toggle('hidden',!mini.paused);$('miniPauseBtn').textContent=mini.paused?'▶':'Ⅱ';
}
function updateMini(dt){
 if(!mini.open||document.hidden)return;if(updateTransition(dt))return;
 if(mini.screen==='result'){
  if(gore.length){mini.resultT+=dt;for(let p of gore){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=230*dt;if(p.y>202){p.y=202;p.vy=-Math.abs(p.vy)*.1;p.vx*=.91}p.x=clamp(p.x,2,790)}}return;
 }
 if(mini.screen!=='play'||mini.paused)return;
 mini.flash=Math.max(0,mini.flash-dt);mini.inputLock=Math.max(0,mini.inputLock-dt);mini.helpTime=Math.max(0,mini.helpTime-dt);
 mini.t+=dt;mini.total+=dt;mini.phaseTime+=dt;mini.hudClock-=dt;
 if(mini.id===0)updateIVGame(dt);
 if(mini.id>0)updateArcade(dt);
 if(mini.id===0&&mini.screen==='play'&&mini.phaseTime>=mini.limit)finishMini(false,'The clock called. It wants its seconds back.');
 if(mini.hudClock<=0){updateMiniHUD();mini.hudClock=.08}
}
function updateIVGame(dt){
 if(mini.phase===0){
  mini.beatLock=Math.max(0,mini.beatLock-dt);
  if(mini.tier===2)mini.target=mini.targetBase+Math.sin(mini.phaseTime*1.6)*.035;
  if(mini.beatLock<=0){
   mini.pos+=mini.dir*dt*(.43*mini.rules.mini+mini.tier*.035);
   if(mini.pos>1||mini.pos<0){miniOops('A DRIP GOT AWAY');mini.pos=mini.dir>0?0:1;mini.beatLock=.4}
  }
 }else if(mini.phase===1){
  mini.cupX+=(240+mini.lane*160-mini.cupX)*(1-Math.exp(-dt*17));mini.spawn-=dt;
  if(mini.spawn<=0){
   let lane=Math.floor(rand(0,3)),bad=(lane+1+Math.floor(rand(0,2)))%3;
   mini.drops.push({lane,y:90,bad:false,kind:mini.recipe,done:false},{lane:bad,y:76,bad:true,kind:-1,done:false});
   mini.spawned++;mini.spawn=(1.45-mini.tier*.13)/mini.rules.mini;
  }
  for(let d of mini.drops){
   d.y+=dt*(104+mini.tier*16)*mini.rules.mini;
   if(d.y>=352&&!d.done){
    d.done=true;const lane=Math.round((mini.cupX-240)/160);
    if(d.lane===lane){
     if(d.bad){if(mini.helpTime<=0)miniOops('GREEN GUNK IS NOT LUNCH')}
     else if(d.kind===mini.recipe){mini.caught++;praise(100);mini.recipe=Math.floor(mini.caught/4)%2;tone(660,.07);if(mini.caught>=mini.catchNeed){ivPhase(2);return}}
     else{mini.quality-=2;mini.combo=0;mini.flash=.6;mini.flashText='WRONG FLAVOR. CHECK THE RECIPE.'}
    }
   }
  }
  mini.drops=mini.drops.filter(d=>d.y<420);
 }else{
  mini.pressureTarget=.52+Math.sin(mini.phaseTime*(.25+mini.tier*.035))*.16;
  const desired=(mini.held?.27:-.23)*mini.rules.mini;
  mini.velocity+=(desired-mini.velocity)*(1-Math.exp(-dt*6));
  mini.pressure=clamp(mini.pressure+dt*(mini.velocity+Math.sin(mini.phaseTime*1.7)*(.012+mini.tier*.009)),0,1);
  if(Math.abs(mini.pressure-mini.pressureTarget)<mini.pressureBand/2)mini.stable+=dt;
  if(mini.pressure<.06||mini.pressure>.94){mini.outside+=dt;if(mini.outside>.85){mini.outside=0;mini.pressure=.5;mini.velocity=0;miniOops('PRESSURE HAS LEFT THE CHAT')}}else mini.outside=0;
  if(mini.stable>=mini.need){praise(300);finishMini(true)}
 }
}
function updateMRI(dt){
 mini.brakeCd=Math.max(0,mini.brakeCd-dt);mini.cycle+=dt;
 const end=mini.green+mini.warning+mini.red;
 mini.scan=mini.cycle<mini.green?'go':mini.cycle<mini.green+mini.warning?'warn':'scan';
 const wanted=mini.held?67+mini.tier*3:0,rate=mini.held?100:110;
 mini.velocity+=clamp(wanted-mini.velocity,-rate*dt,rate*dt);
 if(mini.scan==='scan'){
  if(mini.velocity>5&&!mini.scanFault){mini.scanFault=true;mini.progress=Math.max(0,mini.progress-45);miniOops('STILL ROLLING. BRAKE BEFORE PINK.')}
 }else mini.progress=Math.min(mini.distance,mini.progress+mini.velocity*dt);
 if(mini.cycle>=end){
  if(!mini.scanFault){mini.locks++;mini.cleanTotal++;praise(170)}
  mini.cycle=0;mini.scanFault=false;mini.green=rand(1.5,2.8)/mini.rules.mini-mini.tier*.10;mini.red=rand(1.3,2.1)+mini.round*.2;
 }
 if(mini.screen==='play'&&mini.progress>=mini.distance&&mini.locks>=mini.lockNeed){
  mini.round++;if(mini.round>=3)finishMini(true);else{mriRound();prepareBriefing()}
 }
}
function updateRunner(dt){
 mini.inv=Math.max(0,mini.inv-dt);mini.swat=Math.max(0,mini.swat-dt);mini.swatCd=Math.max(0,mini.swatCd-dt);
 mini.cartX+=(240+mini.lane*160-mini.cartX)*(1-Math.exp(-dt*17));mini.spawn-=dt;
 const speed=(.31+mini.tier*.035+mini.round*.018)*mini.rules.mini;
 if(mini.spawn<=0&&mini.phaseTime<mini.limit-1/speed){
  const choices=[0,1,2].filter(n=>Math.abs(n-mini.lastSafe)<=1),safe=pick(choices);
  const blocked=[0,1,2].filter(n=>n!==safe),foam=blocked[mini.rowsSeen%2];
  mini.rows.push({z:0,safe,blocked,foam,done:false});mini.lastSafe=safe;mini.rowsSeen++;
  mini.spawn=(1.45-mini.tier*.1-mini.round*.08)/mini.rules.mini;
 }
 for(let r of mini.rows){
  r.z+=dt*speed;
  if(r.z>.91&&!r.done){
   r.done=true;mini.rowsResolved++;const lane=Math.round((mini.cartX-240)/160);
   if(lane===r.foam&&mini.swat>0){mini.tokens+=3;mini.allTokens+=3;mini.swats++;praise(240);mini.flash=.45;mini.flashText='FOAM SMASH · +3 TOKENS';tone(740,.08)}
   else if(r.blocked.includes(lane)){if(mini.inv<=0){mini.inv=.7;miniOops('TRAFFIC INCIDENT. SMALL WITNESSES.')}else mini.combo=0}
   else{mini.tokens++;mini.allTokens++;praise(70);tone(640,.05)}
  }
 }
 mini.rows=mini.rows.filter(r=>r.z<1.15);
}
function updateMiniHUD(){
 if(mini.id>0&&mini.initialized&&['play','briefing','intro'].includes(mini.screen)){updateArcadeHUD();return}
 if(!['play','briefing','intro'].includes(mini.screen))return;
 let str='';
 if(mini.id===0)str=mini.phase===0?mini.good+'/'+mini.required+' drips':mini.phase===1?mini.caught+'/'+mini.catchNeed+' catches':mini.stable.toFixed(1)+'/'+mini.need+'s steady';
 if(mini.id===1)str='Checkpoint '+(mini.round+1)+'/3 · '+mini.locks+'/'+mini.lockNeed+' locks';
 if(mini.id===2)str='Build '+(mini.round+1)+'/'+mini.rounds+' · '+mini.input+'/'+mini.sequence.length;
 if(mini.id===3)str='Sector '+(mini.round+1)+'/3 · '+mini.tokens+'/'+mini.quota+' tokens';
 if(mini.id===4)str='Scan '+(mini.round+1)+'/'+mini.rounds+' · '+mini.found.length+'/'+mini.targets.length;
 $('miniStatLabel').textContent=mini.id===0?['PRIME THE PUMP','FILTER THE GUNK','TRACK THE PRESSURE'][mini.phase]:'PROGRESS';$('miniStat').textContent=str;
 const left=Math.max(0,Math.ceil(mini.limit-mini.phaseTime));
 $('miniTimer').textContent=mini.screen==='briefing'?'Paused':mini.screen==='intro'?'Get ready':Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
 $('miniLives').textContent='♥ '.repeat(Math.max(0,mini.rules.misses-mini.miss))+'· '.repeat(Math.min(mini.miss,mini.rules.misses));
 $('miniTactics').textContent='SCORE '+mini.score+'   ·   CHAIN '+mini.combo+'   ·   '+mini.helps+' ASSISTS LEFT';
 const a=$('miniControls').querySelector('[data-action="assist"]');
 if(a){a.disabled=mini.helps<=0||(mini.id===2&&mini.mode!=='input')||(mini.id===4&&(mini.reveal>0||mini.probe>=0));a.textContent=assistLabel()+' · '+mini.helps+' left (E)';a.setAttribute('aria-label',a.textContent)}
}
function assistLabel(){return mini.id===0?['WIDEN WINDOW','FILTER GUNK','RESET PRESSURE'][mini.phase]:['','EMERGENCY STOP','REPLAY PATTERN','SHIELD','REPLAY SCAN'][mini.id]}
function qualityScore(){
 if(mini.id>0)return Math.round(clamp(65+Math.min(35,Math.max(0,mini.got/mini.goal-1)*40+mini.maxCombo*.65)-mini.miss*7-mini.helpUsed*3-(mini.sortErrors||0)*1.2-(mini.id===5?Math.max(0,.65-mini.shotsHit/Math.max(1,mini.shotsFired))*40:0),0,100));
 let q=mini.quality;
 if(mini.id===0||mini.id===4){
  const p=mini.id===0?mini.precision:mini.precisions;
  q-=Math.max(0,.8-p.reduce((a,b)=>a+b,0)/Math.max(1,p.length))*32;
 }
 if(mini.id===0)q-=Math.max(0,mini.phaseTime-mini.need*2.7)*.4;
 if(mini.id===3)q-=Math.max(0,.85-mini.allTokens/Math.max(1,mini.rowsResolved))*35;
 return Math.round(clamp(q,0,100));
}

function grantReward(id,tier,grade,quality,multiplier,arcadeScore=0){const old=state.medals[id][tier],delta=Math.max(0,grade-old);state.medals[id][tier]=Math.max(old,grade);let pay=Math.round((18+grade*18+tier*12+quality*.2+Math.min(70,arcadeScore/120))*multiplier)+delta*20;state.coins+=pay;save();hud();return{delta,pay,old}}
function resolveMiniResult(win,reason){if(mini.screen!=='outro')return;mini.screen='result';$('miniDialog').dataset.screen='result';$('miniClose').disabled=false;mini.held=false;clearHeld();mini.resultT=0;mini.win=win;gore=[];$('miniPlay').classList.add('hidden');$('miniLobby').classList.add('hidden');$('miniResult').classList.remove('hidden');$('miniPauseBtn').classList.add('hidden');$('miniBack').classList.toggle('hidden',mini.forced&&!win);$('miniRetry').textContent=win?'Improve / next level':'Reassemble. Try again.';
if(win){mini.qualityFinal=qualityScore();mini.grade=mini.qualityFinal>=88?3:mini.qualityFinal>=68?2:1;const previousBest=state.records[mini.id][mini.tier];state.records[mini.id][mini.tier]=Math.max(previousBest,mini.score);const reward=grantReward(mini.id,mini.tier,mini.grade,mini.qualityFinal,mini.rules.coins,mini.score);mini.reward=reward;if(mini.id===0){state.hp=Math.max(state.hp,2+mini.grade);player.vomit=0;save();hud()}$('resultMedal').textContent='★'.repeat(mini.grade);$('resultHeading').textContent=medalNames[mini.grade].toUpperCase()+'. LEGENDARY NONSENSE.';$('resultText').textContent=mini.id===0?`${state.hp} hearts restored. The nutrients have entered the chat.`:pick(['Ralph is disputing this result. His appeal has been eaten.','The hospital applauds. The gremlins are filing a complaint.','Excellent work. Terrible bedside manner.','That pillow swat had a little volleyball energy.']);$('resultNumbers').innerHTML=`<div><strong>${mini.score}</strong><small>ARCADE SCORE · BEST ${state.records[mini.id][mini.tier]}</small></div><div><strong>${mini.qualityFinal}%</strong><small>PERFORMANCE</small></div><div><strong>+${reward.pay}</strong><small>COINS EARNED</small></div><div><strong>+${reward.delta} ★</strong><small>NEW DISCHARGE STARS</small></div>`;$('resultJourney').textContent=`${stars()}/12 stars · ${stamps()}/${rooms.length} arcades · ${levelTwo()?'Level 2 stamped':'Level 2 stamp still needed'}. ${reward.delta?'New personal best.':'Your best medal stays. Replay coins awarded.'}`;tone(784,.35);$('miniDialog').classList.remove('gory')}
else{mini.grade=0;if(!mini.forced){state.hp=Math.max(1,state.hp-1);save();hud()}const splat=mini.id===0;$('miniDialog').classList.toggle('gory',splat);$('resultMedal').textContent=splat?'✚':'…';$('resultHeading').textContent=splat?'SOME ASSEMBLY REQUIRED.':'A MEDICALLY IMPRESSIVE MESS.';$('resultText').textContent=reason||(splat?'Your insides have become outsides. Housekeeping has been notified.':'The gremlins won this round. Your best medals remain intact.');$('resultNumbers').innerHTML=`<div><strong>${mini.miss}</strong><small>OOPS RECORDED</small></div><div><strong>0</strong><small>COINS THIS RUN</small></div><div><strong>${stars()} ★</strong><small>STARS PRESERVED</small></div>`;$('resultJourney').textContent=mini.forced?'You’re still in bed. Reassemble, then complete all three IV phases.':'One heart lost (minimum one). Retry or explore another department.';if(splat)for(let i=0;i<190;i++)gore.push({x:395,y:100,vx:rand(-430,430),vy:rand(-280,50),size:rand(4,12),col:['#a72045','#dd3b55','#ef7a77','#7d183b'][i%4]});tone(65,.4,'sawtooth')}
drawResultArt();$('miniResult').scrollIntoView({block:'nearest'});}
function leaveMini(){if(mini.screen==='outro')return;if(mini.forced&&!(mini.screen==='result'&&mini.win))return;let recovered=mini.forced;mini.open=false;clearHeld();$('miniDialog').close();state.paused=false;if(recovered){loadRoom(0);player.inv=2;hud()}checkDischarge();canvas.focus({preventScroll:true})}
function checkDischarge(){if(!state.won&&stars()>=12&&stamps()===rooms.length&&levelTwo()){state.won=true;save();$('winScore').textContent=`${state.name||'Macy'} earned ${stars()} discharge stars across all six arcade challenges. Your arcade passport is complete.`;modalOpen($('winDialog'))}}
