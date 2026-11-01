// Motion preferences change animation, never the time provided to read or prepare.
const INTRO_SECONDS=3.2,OUTRO_SECONDS=2.2;
function lesson(){
 if(mini.id===0)return [
 {title:'1 / Prime the pump',goal:'Land '+mini.required+' precise taps.',control:'Tap TAP THE DRIP or Space in the mint window. The sweep changes direction after each tap.',avoid:'The gold center scores more. Missed taps and missed sweeps cost an oops. Higher levels move the window.',demo:'timing',cue:'Tap mint · center earns precision points'},
 {title:'2 / Follow the recipe',goal:'Catch '+mini.catchNeed+' matching nutrients.',control:'Choose a lane with LEFT / MIDDLE / RIGHT or A / S / D. Match the requested gold or pink flavor.',avoid:'The recipe changes every 4 catches. Green skulls hurt. The wrong flavor costs style points.',demo:'catch',cue:'Match the recipe · avoid green skulls'},
 {title:'3 / Steady hands',goal:'Bank '+mini.need+' seconds inside the moving band.',control:'Hold PUMP or Space to raise pressure. Release to lower it. Anticipate the moving target and the pressure momentum.',avoid:'Extreme pressure costs an oops. Use small corrections; an assist recenters the gauge.',demo:'balance',cue:'Hold = up · release = down · follow mint'}
 ][mini.phase];
 if(mini.id===1)return {title:'Checkpoint '+(mini.round+1)+' / 3',goal:'Reach the scanner and earn '+mini.lockNeed+' clean scan locks.',control:'Hold MOVE / Space on green. Release on amber to coast. BRAKE / B stops instantly, then needs 2.6 seconds to recharge.',avoid:'The bed keeps rolling after release. Be stopped before pink. A blurry scan costs an oops and distance.',demo:'freeze',cue:'Green: accelerate · amber: coast / brake · pink: still'};
 if(mini.id===2)return {title:'Build '+(mini.round+1)+' / '+mini.rounds+' · '+mini.transform.toUpperCase(),goal:'Remember '+mini.sequence.length+' bricks. '+memoryRule(),control:'Watch first. On YOUR TURN, tap the four shapes or keys 1–4. Each build has a new pattern.',avoid:'A wrong brick restarts this build and costs an oops. A limited replay costs 5 style points.',demo:'memory',cue:memoryRule()};
 if(mini.id===3)return {title:'Sector '+(mini.round+1)+' / 3',goal:'Collect '+mini.quota+' tokens in '+mini.limit+' seconds. Stay in one piece.',control:'LEFT / RIGHT or A / D steer. SWAT / Space just before hitting BLUE foam for 3 tokens. Gold gives 1 safe token.',avoid:'Pink barriers cannot be swatted. Swatting too early leaves you exposed. Meet the quota before time runs out.',demo:'race',cue:'Gold = safe · blue = timed swat · pink = dodge'};
 return {title:'Scan '+(mini.round+1)+' / '+mini.rounds,goal:'Remember and capture '+mini.targets.length+' GREEN gremlins.',control:'After the reveal, tap a remembered cell (or 1–9). Then tap TAG / Space when the marker enters mint.',avoid:'Pink decoys are traps. Each target needs a timed tag. Missing a sweep or tagging outside mint costs an oops.',demo:'echo',cue:'Remember green → select cell → time the tag'};
}
function prepareBriefing(){
 mini.screen='briefing';mini.paused=false;mini.held=false;mini.transition=0;mini.demoTime=0;mini.countdown=0;mini.flash=0;clearHeld();
 const l=lesson();$('miniBriefKicker').textContent=mini.total>0?'TAKE A BREATHER · THE CLOCK IS PAUSED':'GET YOUR BEARINGS · THE CLOCK IS PAUSED';
 $('miniBriefTitle').textContent=l.title;$('miniBriefGoal').textContent=l.goal;$('miniBriefControl').textContent=l.control;$('miniBriefAvoid').textContent=l.avoid;
 $('miniDemo').className='control-demo '+l.demo;$('miniRuleGoal').textContent=l.goal;$('miniRuleControl').textContent=l.cue;
 $('miniBriefing').classList.remove('hidden');$('miniPaused').classList.add('hidden');$('miniPauseBtn').classList.add('hidden');$('miniDialog').dataset.screen='briefing';
 $('miniReadyBtn').textContent=mini.total>0?'Ready for the next challenge →':'Ready — count me in';$('miniReadyBtn').focus({preventScroll:true});$('miniDialog').scrollTop=0;updateMiniHUD();
}
function launchMini(){
 if(mini.screen!=='briefing')return;mini.screen='intro';mini.transition=0;mini.held=false;clearHeld();
 $('miniBriefing').classList.add('hidden');$('miniDialog').dataset.screen='intro';$('miniPauseBtn').classList.remove('hidden');$('miniPauseBtn').textContent='Ⅱ';$('miniCanvas').focus({preventScroll:true});tone(440,.1,'sine');updateMiniHUD();
}
function updateTransition(dt){
 if(mini.screen==='briefing'){mini.demoTime+=dt;return true}
 if(mini.screen==='intro'){
  if(mini.paused)return true;mini.transition+=dt;
  if(mini.transition>=INTRO_SECONDS){mini.screen='play';mini.transition=0;clearHeld();$('miniDialog').dataset.screen='play';tone(660,.09,'sine');updateMiniHUD()}return true;
 }
 if(mini.screen==='outro'){mini.transition+=dt;if(mini.transition>=OUTRO_SECONDS)resolveMiniResult(mini.pendingFinish.win,mini.pendingFinish.reason);return true}
 return false;
}
function finishMini(win,reason){
 if(mini.screen!=='play')return;mini.screen='outro';mini.transition=0;mini.pendingFinish={win,reason};mini.held=false;clearHeld();$('miniDialog').dataset.screen='outro';$('miniPauseBtn').classList.add('hidden');$('miniClose').disabled=true;$('miniTimer').textContent='Finished';tone(win?690:135,win?.2:.3,win?'sine':'triangle');
}
function paintTransition(g){
 const intro=mini.screen==='intro',outro=mini.screen==='outro';if(!intro&&!outro)return;
 const duration=intro?INTRO_SECONDS:OUTRO_SECONDS,t=clamp(mini.transition/duration,0,1);
 g.save();rect(g,0,0,800,450,outro&&!mini.pendingFinish.win?'#301f3eb5':'#143849aa');g.translate(400,220);
 if(!reduced){const z=.97+.03*Math.min(1,t*5);g.scale(z,z)}
 rr(g,-250,-70,500,155,24,'#102c42f5','#afdec277',1.3);
 const title=intro?(mini.transition<3?String(3-Math.floor(mini.transition)):'GO!'):mini.pendingFinish.win?'Run complete!':'Well. That happened.';
 label(g,title,0,0,intro?64:35,outro&&!mini.pendingFinish.win?'#f5b6b2':'#edf4d7','center');
 label(g,intro?'Find your controls. The clock has not started.':'Score '+mini.score+' · best chain '+mini.maxCombo,0,43,16,'#b9d9cc','center');
 if(intro)rr(g,-190,65,380*t,4,2,'#b5e8c5');g.restore();
}
