// Original, gesture-driven department games. Coordinates are 600 × 600.
const arcadeInfo={
 1:{game:'Polarity Panic',genre:'MAGNETS · PUSH / PULL · PHYSICS',headline:'Opposites attract. Gremlins complain.',desc:'Steer drifting nutrients into matching collection ports with a movable magnet. Pull them toward your finger, switch polarity to push, then release to let them coast. Three escalating shifts add moving hazards.',goal:'Sort the nutrient quota before the shift ends.',control:'Drag anywhere to move the magnet. Hold to apply force; release to coast. Tap PULL / PUSH (Space) to change polarity.',avoid:'Mint circles go left; gold diamonds go right. Wrong colors bounce back and cost style. Push pink gunk into the bottom disposal vent. Momentum matters.',cue:'Drag magnet · hold = force · release = coast · Space flips polarity'},
 2:{game:'Brick Rebellion',genre:'AIM · RICOCHET · CHAIN REACTIONS',headline:'One softball. Several bad decisions.',desc:'Pull back from the ball and release a volley into the brick infestation. Bank shots off the walls, crack armor, and set off pink chain reactions. Choose heavy or fan shots carefully: supplies are limited.',goal:'Break the block quota and survive every volley.',control:'PULL AIM: drag back from the glowing ball, then release. FLICK AIM: flick the ball upward; a faster flick throws harder. Bank off walls. Choose HEAVY or FAN before a shot.',avoid:'After each volley the bricks descend. Don’t let them cross the red line. Pink blocks explode; starred blocks add a ball.',cue:'PULL = drag back · FLICK = swipe forward · bank shots clear more'},
 3:{game:'Gurney Grand Prix',genre:'SWIPE · JUMP · SLIDE · THROW',headline:'Zero brakes. Questionable steering.',desc:'Race a runaway gurney through three continuous sectors. Swipe to change lanes, jump low crates, slide under scan bars, and throw softballs at gremlins for bonus coins. Traffic gets faster and less polite.',goal:'Survive all three sectors, collect the coin quota, and land the stunt quota.',control:'Swipe left / right to steer, up to jump, down to slide. Or use A/D, W/S and the big buttons. THROW (Space) fires down your lane.',avoid:'Jump orange crates, slide beneath violet bars, steer around pink walls. Blue gremlins take two throws. Gold routes reward risk.',cue:'← → steer · ↑ jump crates · ↓ slide bars · tap THROW for gremlins'},
 4:{game:'Gel Yeah!',genre:'FLICK · SWIPE COMBOS · RISK / REWARD',headline:'A very questionable fruit salad.',desc:'Slice airborne gel gremlins in one clean swipe. Three or more in a stroke builds a combo. Silver helmets need two separate swipes; blue gremlins split. Pink gunk bombs ruin everything. Three escalating waves, one unbroken run.',goal:'Slice the gremlin quota and survive the full shift.',control:'Press and swipe through gremlins. Lift to bank a combo. Slice three or more in one stroke for bonus points and slow-motion fever.',avoid:'Avoid pink X bombs. Helmeted gremlins need a second stroke. Blue gremlins split into two. Six escaped gremlins cost an oops.',cue:'Swipe green · lift to bank combos · avoid pink X · re-swipe helmets'}
};
for(const [id,info] of Object.entries(arcadeInfo))Object.assign(rooms[id],info);
tierNotes[1]=['105s · two ports · magnet momentum','120s · moving field · more contamination','135s · cross-current · tighter ports'];
tierNotes[2]=['12 volleys · ricochets · explosive blocks','15 volleys · armor · faster descent','18 volleys · more armor · tighter ammo'];
tierNotes[3]=['105s · jump, slide, throw','120s · faster traffic · mixed hazards','135s · dense traffic · armored gremlins'];
tierNotes[4]=['90s · swipe combos · three waves','105s · earlier armor & splitting','120s · fast arcs · mixed formations'];
let arcadePointer=null,strokeSerial=0;
function arcadeLesson(){const i=arcadeInfo[mini.id];return {title:i.game+' · '+(mini.id===2?mini.volleys+' volleys':mini.limit+' second shift'),goal:i.goal+' Target: '+mini.goal+(mini.id===3?' coins + '+mini.stuntGoal+' stunts':'')+'.',control:i.control,avoid:i.avoid,demo:mini.id===2?'aim':mini.id===4?'slice':'magnet',cue:i.cue}}
function initArcade(){
 Object.assign(mini,{limit:mini.id===2?240:mini.id===4?90+mini.tier*15:105+mini.tier*15,got:0,shift:0,notice:3,fx:[],trail:[],pointer:null,slow:0});
 mini.rules.misses=(state.difficulty===0?8:state.difficulty===1?6:5);
 if(mini.id===1){
  mini.goal=12+mini.tier*4;mini.magnet={x:300,y:360,on:false,mode:1};mini.sortErrors=0;mini.orbs=[];mini.orbSerial=0;
  for(let i=0;i<7;i++)spawnOrb(false,i);arcadeControls();
 }
 if(mini.id===2){
  mini.goal=35+mini.tier*13;mini.volleys=12+mini.tier*3;mini.shot=0;mini.anchor={x:300,y:548};mini.aim=null;mini.balls=[];mini.queue=0;mini.fireClock=0;mini.shotClock=0;mini.ballCount=6+mini.tier+(state.difficulty===0?2:state.difficulty===2?-1:0);mini.shotType='normal';mini.throwStyle='pull';mini.heavy=2;mini.fan=2;mini.blocks=[];mini.blockSerial=0;mini.boardWait=0;
  for(let r=0;r<3;r++)addBrickRow(86+r*53,r);arcadeControls();
 }
 if(mini.id===3){
  mini.goal=36+mini.tier*10;mini.stunts=0;mini.stuntGoal=8+mini.tier*4;mini.lane=1;mini.cartX=300;mini.jump=0;mini.jumpV=0;mini.slide=0;mini.inv=0;mini.throwCd=0;mini.rows=[];mini.bullets=[];mini.spawn=.7;mini.rowSerial=0;arcadeControls();
 }
 if(mini.id===4){mini.goal=45+mini.tier*15;mini.gels=[];mini.gelSerial=0;mini.spawn=.5;mini.strokes=0;mini.cutCount=0;mini.escaped=0;mini.fever=0;mini.feverMeter=0;mini.strokeHits=0;arcadeControls()}
 if(mini.id===5)initShooter();
 setInstructions(arcadeInfo[mini.id].cue);
 configureCanvas($('miniCanvas'),600,600);$('miniDialog').dataset.arcade='gesture';
}
function arcadeControls(){
 if(mini.id===1)setControls([{id:'polarity',text:mini.magnet.mode===1?'PULL → switch to PUSH':'PUSH → switch to PULL',key:'Space',hot:true}]);
 if(mini.id===2)setControls([{id:'normal',text:'VOLLEY '+mini.ballCount,hot:mini.shotType==='normal'},{id:'heavy',text:'HEAVY · '+mini.heavy,hot:mini.shotType==='heavy'},{id:'fan',text:'FAN · '+mini.fan,hot:mini.shotType==='fan'},{id:'style',text:mini.throwStyle==='pull'?'PULL AIM ⇄':'FLICK AIM ⇄'},{id:'recall',text:'RECALL',key:'Space'}]);
 if(mini.id===3)setControls([{id:'left',text:'←',key:'A'},{id:'jump',text:'JUMP ↑',key:'W',hot:true},{id:'right',text:'→',key:'D'},{id:'slide',text:'SLIDE ↓',key:'S'},{id:'throw',text:'THROW',key:'Space'}]);
 if(mini.id===4)setControls([]);
}
function arcadeAction(a){
 if(a==='assist'){
  if(mini.helps<=0)return;mini.helps--;mini.helpUsed++;mini.slow=5;mini.combo=0;mini.quality-=5;
  if(mini.id===1)mini.orbs=mini.orbs.filter(o=>!o.bad);
  if(mini.id===2){for(const b of mini.blocks)b.y=Math.max(78,b.y-38);for(const b of mini.blocks)b.hp=Math.max(1,b.hp-1)}
  if(mini.id===3)mini.inv=5;
  if(mini.id===4)mini.gels=mini.gels.filter(o=>!o.bomb);
  if(mini.id===5){mini.lightBurst=.6;for(const e of mini.targets){const p=shooterProjection(e);if(p.x>-50&&p.x<650)e.stun=2.5}}
  mini.flash=1;mini.flashText=['','FIELD STABILIZED','BRICKS PUSHED BACK','FIVE SECONDS OF DIGNITY','BOMBS CLEARED · SLOW MOTION','FLASHLIGHT STUN · RELOAD NOW'][mini.id];updateArcadeHUD();return;
 }
 if(mini.id===5){if(a==='fire')fireBlaster();if(a==='reload')reloadBlaster()}
 if(mini.id===1&&a==='polarity'){mini.magnet.mode*=-1;arcadeControls();tone(mini.magnet.mode===1?380:570,.07)}
 if(mini.id===2){
  if(a==='style'&&!mini.balls.length&&!mini.queue){mini.throwStyle=mini.throwStyle==='pull'?'flick':'pull';arcadeControls()}
  if(['normal','heavy','fan'].includes(a)&&mini.balls.length===0&&mini.queue===0&&(a==='normal'||mini[a]>0)){mini.shotType=a;arcadeControls()}
  if(a==='recall'&&mini.shotClock>1.2&&mini.balls.length){mini.balls=[];mini.queue=0;endVolley()}
 }
 if(mini.id===3){
  if(a==='left')mini.lane=Math.max(0,mini.lane-1);if(a==='right')mini.lane=Math.min(2,mini.lane+1);
  if(a==='jump'&&mini.jump===0){mini.jumpV=355;mini.jump=1;mini.slide=0;tone(420,.05)}
  if(a==='slide'&&mini.jump===0&&mini.slide<=0)mini.slide=.85;
  if(a==='throw'&&mini.throwCd<=0){mini.throwCd=.38;mini.bullets.push({x:mini.cartX,y:485});tone(420,.05)}
 }
}
function miniPoint(e){const r=$('miniCanvas').getBoundingClientRect();return {x:clamp((e.clientX-r.left)*600/r.width,0,600),y:clamp((e.clientY-r.top)*600/r.height,0,600)}}
function arcadeDown(p){
 if(mini.screen!=='play'||mini.paused)return;
 mini.pointer={...p,lastX:p.x,lastY:p.y,startX:p.x,startY:p.y,startT:mini.total,stroke:++strokeSerial};
 if(mini.id===1)Object.assign(mini.magnet,{x:p.x,y:p.y,on:true});
 if(mini.id===2&&!mini.balls.length&&!mini.queue&&!mini.boardWait&&dist(p,mini.anchor)<100)mini.aim={...p};
 if(mini.id===4){mini.strokeHits=0;mini.strokes++;sliceSegment(p,p)}
}
function arcadeMove(p){
 if(mini.screen!=='play'||mini.paused||!mini.pointer)return;const prev={x:mini.pointer.lastX,y:mini.pointer.lastY};
 if(mini.id===1)Object.assign(mini.magnet,{x:p.x,y:p.y});
 if(mini.id===2&&mini.aim)mini.aim={...p};
 if(mini.id===3){const dx=p.x-mini.pointer.startX,dy=p.y-mini.pointer.startY;if(Math.max(Math.abs(dx),Math.abs(dy))>38){arcadeAction(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump');mini.pointer.startX=p.x;mini.pointer.startY=p.y}}
 if(mini.id===4)sliceSegment(prev,p);
 if(mini.id===5){mini.lookTarget.yaw=clamp(mini.lookTarget.yaw+(p.x-prev.x)*1.8,300,1500);mini.lookTarget.pitch=clamp(mini.lookTarget.pitch+(p.y-prev.y)*1.1,130,370);if(Math.hypot(p.x-mini.pointer.startX,p.y-mini.pointer.startY)>5)mini.pointer.moved=true}
 mini.pointer.lastX=p.x;mini.pointer.lastY=p.y;
}
function arcadeUp(cancel=false){
 if(mini.id===5&&!cancel&&mini.pointer&&!mini.pointer.moved&&mini.screen==='play'&&!mini.paused)fireBlaster();
 if(mini.id===1&&mini.magnet)mini.magnet.on=false;
 if(mini.id===2&&mini.aim){if(!cancel&&mini.screen==='play'&&!mini.paused)shootVolley();mini.aim=null}
 if(mini.id===4&&mini.pointer&&!cancel&&mini.screen==='play'&&!mini.paused){
  const n=mini.strokeHits;if(n>=3){mini.score+=n*25;mini.feverMeter+=n;mini.flash=.7;mini.flashText=n+' IN ONE SWIPE · +'+n*25;mini.maxCombo=Math.max(mini.maxCombo,n);tone(540+n*30,.12)}
  if(mini.feverMeter>=12){mini.fever=4;mini.feverMeter=0;mini.flash=1;mini.flashText='GEL FEVER · SLOW MOTION · DOUBLE POINTS'}
 }
 mini.pointer=null;
}
function arcadeBurst(x,y,col,n=12){for(let i=0;i<n;i++)mini.fx.push({x,y,vx:rand(-120,120),vy:rand(-170,90),life:rand(.3,.7),col})}
function spawnOrb(bad=false,offset=0){
 const id=mini.orbSerial++;mini.orbs.push({id,x:90+(id*83)%420,y:330+(offset%3)*75,vx:rand(-20,20),vy:rand(-15,15),kind:id%2,bad,touched:false,r:bad?20:19,cool:0});
}
function updateMagnet(dt){
 const m=mini.magnet,rate=mini.slow>0?.55:1,gate=mini.tier===2?53:68;
 for(const o of mini.orbs){
  const dx=m.x-o.x,dy=m.y-o.y,d=Math.hypot(dx,dy);o.cool=Math.max(0,o.cool-dt);
  if(m.on&&d<170&&d>8){const f=(1-d/180)*1150*m.mode; o.vx+=dx/d*f*dt;o.vy+=dy/d*f*dt;o.touched=true}
  // Moving scan currents arrive during later shifts; the force is visible on the board.
  if(mini.shift>0&&mini.slow<=0){o.vx+=Math.sin(mini.total*.7+o.y*.012)*mini.shift*(20+mini.tier*8)*dt}
  const speed=Math.hypot(o.vx,o.vy),cap=390;if(speed>cap){o.vx*=cap/speed;o.vy*=cap/speed}
  o.vx*=Math.exp(-1.15*dt);o.vy*=Math.exp(-1.15*dt);o.x+=o.vx*dt*rate;o.y+=o.vy*dt*rate;
  if(o.x<30||o.x>570){o.x=clamp(o.x,30,570);o.vx*=-.7}if(o.y>564){if(o.bad&&o.touched&&Math.abs(o.x-300)<65){o.dead=true;arcadeBurst(o.x,o.y,'#d0e8ca',8)}else{o.y=564;o.vy*=-.65}}
  if(o.y<96&&o.cool<=0){
   const port=Math.abs(o.x-135)<gate?0:Math.abs(o.x-465)<gate?1:-1;
   if(port>=0&&o.touched){
    if(!o.bad&&o.kind===port){mini.got++;praise(140,1);arcadeBurst(o.x,o.y,port?'#ffe09b':'#b5e8c5');tone(600+port*100,.08)}
    else if(o.bad){miniOops('GUNK IN THE COLLECTION PORT');o.dead=true}
    else{mini.sortErrors++;mini.combo=0;mini.flash=.8;mini.flashText='WRONG COLOR · BOUNCED BACK';o.y=112;o.vy=150;o.vx=(300-o.x)*.7;o.cool=1.2}
    if(!o.bad&&o.kind===port)o.dead=true;
   }else{o.y=96;o.vy=Math.abs(o.vy)*.65;o.cool=.3}
  }
 }
 // Soft collisions transfer momentum, so a push can move a whole cluster.
 for(let i=0;i<mini.orbs.length;i++)for(let j=i+1;j<mini.orbs.length;j++){const a=mini.orbs[i],b=mini.orbs[j],d=dist(a,b),r=a.r+b.r;if(d>0&&d<r){const nx=(b.x-a.x)/d,ny=(b.y-a.y)/d,q=(r-d)/2;a.x-=nx*q;a.y-=ny*q;b.x+=nx*q;b.y+=ny*q;const dot=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(dot>0){a.vx-=dot*nx*.75;a.vy-=dot*ny*.75;b.vx+=dot*nx*.75;b.vy+=dot*ny*.75}}}
 mini.orbs=mini.orbs.filter(o=>!o.dead);
 while(mini.orbs.length<7+mini.shift)spawnOrb(mini.shift>0&&mini.orbSerial%7===0&&mini.orbs.filter(o=>o.bad).length<2);
}
function addBrickRow(y,round){
 const empty=Math.floor(rand(0,6));for(let col=0;col<6;col++){
  if(col===empty||(round===0&&col===5))continue;
  const id=mini.blockSerial++,hp=2+Math.floor(rand(0,3+mini.tier))+(mini.shot>6?1:0);
  mini.blocks.push({id,x:46+col*85,y,w:76,h:43,hp,maxHp:hp,kind:id%9===3?'blast':id%11===5?'extra':'plain',flash:0});
 }
}
function volleyVector(){
 let dx=mini.anchor.x-mini.aim.x,dy=mini.anchor.y-mini.aim.y;
 if(mini.throwStyle==='flick'){dx*=-1;dy*=-1}
 if(Math.hypot(dx,dy)<12)return null;
 // A drag behind the ball launches upward, with a safe minimum vertical component.
 dy=Math.min(-25,dy);const d=Math.hypot(dx,dy),speed=mini.throwStyle==='flick'?clamp(d/Math.max(.08,mini.total-(mini.pointer?.startT??mini.total)),350,850):clamp(d*5,350,720);
 return {vx:dx/d*speed,vy:dy/d*speed,power:clamp(d/140,0,1)};
}
function shootVolley(){
 const v=volleyVector();if(!v)return;
 mini.volleyVelocity=v;mini.shotClock=0;mini.fireClock=0;mini.queue=mini.shotType==='fan'?mini.ballCount+4:mini.shotType==='heavy'?Math.max(4,Math.floor(mini.ballCount*.65)):mini.ballCount;
 mini.volleyType=mini.shotType;if(mini.shotType!=='normal')mini[mini.shotType]--;mini.shot++;mini.quality-=0;mini.shotType='normal';arcadeControls();tone(300,.1);
}
function strikeBlock(b,power){
 if(b.hp<=0)return;b.hp-=power;b.flash=.15;
 if(b.hp<=0){mini.got++;praise(80);arcadeBurst(b.x+b.w/2,b.y+b.h/2,b.kind==='blast'?'#f3a4c6':'#eed5a3',8);
  if(b.kind==='extra'){mini.ballCount=Math.min(18,mini.ballCount+1);mini.flash=.7;mini.flashText='EXTRA BALL · '+mini.ballCount+' PER VOLLEY'}
  if(b.kind==='blast'){for(const n of mini.blocks)if(n!==b&&n.hp>0&&Math.hypot(n.x-b.x,n.y-b.y)<115)strikeBlock(n,2)}
 }tone(240+Math.min(10,mini.combo)*25,.025,'sine',.018);
}
function endVolley(){
 mini.blocks=mini.blocks.filter(b=>b.hp>0);
 if(mini.shot>=mini.volleys){finishMini(mini.got>=mini.goal,mini.got>=mini.goal?undefined:'Volley budget spent. Bank shots and pink chain reactions clear more blocks.');return}
 for(const b of mini.blocks)b.y+=29+mini.tier*3;
 if(mini.blocks.some(b=>b.y+b.h>=505)){finishMini(false,'The bricks crossed the red line. Aim for the lowest blocks before they descend.');return}
 addBrickRow(86,mini.shot);mini.anchor.x=clamp(mini.returnX??300,55,545);mini.returnX=null;mini.boardWait=.65;arcadeControls();
}
function updateVolley(dt){
 mini.boardWait=Math.max(0,mini.boardWait-dt);for(const b of mini.blocks)b.flash=Math.max(0,b.flash-dt);
 if(!mini.balls.length&&!mini.queue)return;
 mini.shotClock+=dt;mini.fireClock-=dt;
 if(mini.queue>0&&mini.fireClock<=0){
  let {vx,vy}=mini.volleyVelocity;if(mini.volleyType==='fan'){const a=Math.atan2(vy,vx)+(mini.queue%3-1)*.095,s=Math.hypot(vx,vy);vx=Math.cos(a)*s;vy=Math.sin(a)*s}
  mini.balls.push({x:mini.anchor.x,y:mini.anchor.y,vx,vy,age:0,last:-1,cool:0,power:mini.volleyType==='heavy'?3:1});mini.queue--;mini.fireClock=.075;
 }
 for(const b of mini.balls){
  b.age+=dt;b.cool=Math.max(0,b.cool-dt);const ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.x<25||b.x>575){b.x=clamp(b.x,25,575);b.vx*=-1}if(b.y<52){b.y=52;b.vy=Math.abs(b.vy)}
  for(const t of mini.blocks){if(t.hp<=0||(b.last===t.id&&b.cool>0))continue;
   if(b.x>t.x-7&&b.x<t.x+t.w+7&&b.y>t.y-7&&b.y<t.y+t.h+7){
    if(oy<t.y-6||oy>t.y+t.h+6){b.vy*=-1;b.y=oy}else{b.vx*=-1;b.x=ox}b.last=t.id;b.cool=.06;strikeBlock(t,b.power);break;
   }
  }
  if(b.y>553&&b.vy>0){b.dead=true;if(mini.returnX==null)mini.returnX=b.x}
  if(b.age>11)b.dead=true;
 }
 mini.balls=mini.balls.filter(b=>!b.dead);
 if(!mini.balls.length&&!mini.queue)endVolley();
}
function spawnTraffic(){
 const id=mini.rowSerial++,safe=(id+Math.floor(rand(0,3)))%3,objects=[];
 for(let lane=0;lane<3;lane++){
  if(lane===safe){objects.push({lane,kind:'coin',hp:1});continue}
  const options=mini.shift===0?['crate','wall','gremlin']:mini.shift===1?['crate','bar','gremlin']:['crate','bar','wall','gremlin'];
  objects.push({lane,kind:options[(id+lane+mini.tier)%options.length],hp:2+(mini.tier===2?1:0)});
 }
 mini.rows.push({id,y:30,objects,done:false});
}
function updateRace(dt){
 mini.inv=Math.max(0,mini.inv-dt);mini.throwCd=Math.max(0,mini.throwCd-dt);mini.slide=Math.max(0,mini.slide-dt);
 mini.cartX+=(160+mini.lane*140-mini.cartX)*(1-Math.exp(-dt*19));
 if(mini.jump>0){mini.jumpV-=880*dt;mini.jump=Math.max(0,mini.jump+mini.jumpV*dt)}
 const speed=(130+mini.tier*16+mini.shift*23)*mini.rules.mini*(mini.slow>0?.7:1);
 mini.spawn-=dt;if(mini.spawn<=0&&mini.limit-mini.phaseTime>4){spawnTraffic();mini.spawn=(1.7-mini.shift*.17-mini.tier*.09)/mini.rules.mini}
 for(const b of mini.bullets){b.y-=750*dt;for(const r of mini.rows)for(const o of r.objects)if(o.kind==='gremlin'&&o.hp>0&&Math.abs(b.x-(160+o.lane*140))<45&&Math.abs(b.y-r.y)<30){o.hp--;b.dead=true;arcadeBurst(b.x,b.y,'#b8e7f0',5);if(o.hp===0){mini.got+=3;mini.stunts++;praise(180);mini.flash=.4;mini.flashText='SOFTBALL JUSTICE · +3'};break}}
 mini.bullets=mini.bullets.filter(b=>b.y>20&&!b.dead);
 for(const r of mini.rows){r.y+=speed*dt;if(r.y>=490&&!r.done){r.done=true;const lane=Math.round((mini.cartX-160)/140),o=r.objects.find(o=>o.lane===lane);if(!o)continue;
   if(o.kind==='coin'){mini.got+=2;praise(60);arcadeBurst(mini.cartX,480,'#ffe09c',6)}
   else if(o.kind==='crate'&&mini.jump>25||o.kind==='bar'&&mini.slide>0||o.kind==='gremlin'&&o.hp<=0){mini.got++;if(o.kind!=='gremlin')mini.stunts++;praise(100)}
   else if(mini.inv<=0){mini.inv=1;miniOops(o.kind==='crate'?'JUMP THE ORANGE CRATES':o.kind==='bar'?'SLIDE UNDER VIOLET BARS':o.kind==='wall'?'STEER AROUND PINK WALLS':'GREMLINS NEED TWO THROWS');}
  }}mini.rows=mini.rows.filter(r=>r.y<640);
}
function spawnGelWave(){
 const count=3+Math.floor(rand(0,3))+mini.shift;
 for(let i=0;i<count;i++){
  const x=rand(85,515),id=mini.gelSerial++,armor=(mini.shift+mini.tier)>1&&id%6===0,split=(mini.shift+mini.tier)>2&&id%7===0;
  mini.gels.push({id,x,y:620+rand(0,70),vx:(300-x)*rand(.25,.65),vy:-rand(580,740),r:armor?29:27,hp:armor?2:1,bomb:false,armor,split,stroke:-1,angle:rand(-1,1),spin:rand(-2,2),entered:false});
 }
 if(mini.gelSerial>6){mini.gels.push({id:mini.gelSerial++,x:rand(80,520),y:660,vx:rand(-45,45),vy:-rand(600,710),r:28,hp:1,bomb:true,stroke:-1,angle:0,spin:1,entered:false})}
}
function pointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function sliceSegment(a,b){
 if(!mini.pointer)return;mini.trail.push({...b,life:.23});
 for(const o of [...mini.gels]){
  if(o.dead||o.y>590||o.stroke===mini.pointer.stroke||pointSegment(o,a,b)>o.r+5)continue;
  o.stroke=mini.pointer.stroke;
  if(o.bomb){o.dead=true;mini.strokeHits=0;mini.feverMeter=0;miniOops('PINK GUNK BOMB · KEEP YOUR SWIPE CLEAN');arcadeBurst(o.x,o.y,'#ec86b0',25);continue}
  o.hp--;arcadeBurst(o.x,o.y,o.split?'#a3ddff':'#b5e8b0',10);
  if(o.hp>0){mini.flash=.5;mini.flashText='HELMET CRACKED · LIFT, THEN SWIPE AGAIN';o.armor=false;tone(280,.06);continue}
  o.dead=true;
  if(o.split){for(const sign of [-1,1])mini.gels.push({id:mini.gelSerial++,x:o.x+sign*18,y:o.y,vx:o.vx+sign*110,vy:-280,r:20,hp:1,bomb:false,armor:false,split:false,stroke:mini.pointer.stroke,angle:0,spin:sign*3,entered:true});mini.flash=.5;mini.flashText='BLUE SPLITS · GET BOTH HALVES'}
  mini.got++;mini.strokeHits++;mini.cutCount++;praise(mini.fever>0?70:35);tone(500+Math.min(mini.strokeHits,8)*60,.04);
 }
}
function updateSlice(dt){
 mini.fever=Math.max(0,mini.fever-dt);const step=dt*(mini.fever>0||mini.slow>0?.55:1);
 mini.spawn-=dt;if(mini.spawn<=0&&mini.limit-mini.phaseTime>2.6){spawnGelWave();mini.spawn=(2.65-mini.shift*.25-mini.tier*.12)/mini.rules.mini}
 for(const o of mini.gels){o.vy+=650*step;o.x+=o.vx*step;o.y+=o.vy*step;o.angle+=o.spin*step;if(o.y<580)o.entered=true;
  if(o.y>680&&o.entered){o.dead=true;if(!o.bomb){mini.escaped++;mini.combo=0;if(mini.escaped%6===0)miniOops('SIX ESCAPED · SMALLER, CLEANER SWIPES')}}
  if(o.x<25||o.x>575){o.x=clamp(o.x,25,575);o.vx*=-.8}
 }mini.gels=mini.gels.filter(o=>!o.dead);
}
function updateArcade(dt){
 mini.slow=Math.max(0,mini.slow-dt);mini.notice=Math.max(0,mini.notice-dt);
 const shift=mini.id===2?Math.min(2,Math.floor(mini.shot/(mini.volleys/3))):Math.min(2,Math.floor(mini.phaseTime/(mini.limit/3)));
 if(shift>mini.shift){mini.shift=shift;mini.notice=3.5;tone(520,.12);if(mini.id!==2)setInstructions(['','SHIFT '+(shift+1)+' · currents are stronger. Keep sorting.','',shift===1?'SECTOR 2 · violet bars incoming. Swipe DOWN to slide.':'FINAL SECTOR · mixed traffic. Keep a lane open.',shift===1?'WAVE 2 · helmets need TWO separate swipes.':'FINAL WAVE · blue gremlins split. Slice the halves.','NIGHT WATCH '+(shift+1)+' · check the edges. Reload before they leap.'][mini.id])}
 [null,updateMagnet,updateVolley,updateRace,updateSlice,updateShooter][mini.id](dt);
 for(const p of mini.fx){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt}mini.fx=mini.fx.filter(p=>p.life>0);
 for(const p of mini.trail)p.life-=dt;mini.trail=mini.trail.filter(p=>p.life>0);
 if(mini.screen==='play'&&mini.phaseTime>=mini.limit)finishMini(mini.id!==2&&mini.got>=mini.goal&&(mini.id!==3||mini.stunts>=mini.stuntGoal),(mini.got<mini.goal||mini.id===3&&mini.stunts<mini.stuntGoal)?'Shift over. Quota missed. In the race, jumping crates, sliding bars and defeating gremlins earn stunts. Try a Steady hands assist if needed.':undefined);
}
function updateArcadeHUD(){
 $('miniStatLabel').textContent=mini.id===2?'BLOCKS / VOLLEYS':mini.id===3?'COINS / SECTOR':mini.id===4?'SLICES / WAVE':mini.id===5?'EVICTIONS / WATCH':'SORTED / SHIFT';
 $('miniStat').textContent=mini.got+'/'+mini.goal+' · '+(mini.id===2?mini.shot+'/'+mini.volleys:mini.shift+1+'/3');
 const left=Math.max(0,Math.ceil(mini.limit-mini.phaseTime));$('miniTimer').textContent=mini.screen==='briefing'?'Paused':mini.screen==='intro'?'Get ready':Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
 $('miniLivesLabel').textContent=mini.id===2?'SPECIAL SHOTS':'OOPS ALLOWANCE';$('miniLives').textContent=mini.id===2?mini.heavy+' heavy · '+mini.fan+' fan':'♥ '.repeat(Math.max(0,mini.rules.misses-mini.miss));
 $('miniTactics').textContent='SCORE '+mini.score+' · '+(mini.id===3?'STUNTS '+mini.stunts+'/'+mini.stuntGoal:mini.id===5?'AMMO '+mini.ammo+'/'+mini.magazine+' · '+mini.headshots+' HEADSHOTS':'BEST CHAIN '+mini.maxCombo)+' · '+mini.helps+' ASSISTS';
 const a=$('miniControls').querySelector('[data-action="assist"]');if(a){a.disabled=mini.helps<=0;a.textContent=['','STABILIZE','PUSH BACK','SHIELD','GEL FREEZE','FLASH STUN'][mini.id]+' · '+mini.helps+' (E)';a.setAttribute('aria-label',a.textContent)}
}
