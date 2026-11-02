// A seated first-person arcade: a wide room, a fixed sight, and crawling targets.
rooms.push({id:5,name:'Your room · after dark',sub:'HOME BASE / THE NIGHT SHIFT',theme:'#667b9d',game:'Bedside Blaster',genre:'LOOK · AIM · RELOAD · SURVIVE',headline:'Bed rest. Heavy resistance.',desc:'Sweep a flashlight and sighted blaster around your darkened room. Gremlins crawl over cabinets, the couch and the bed before launching at your face. Land headshots, manage seven-shot magazines, and reload between attacks.',station:[255,350]});
roomProps.push(roomProps[0]);
state.medals.push(Array.from({length:3},(_,j)=>clamp(Math.floor(Number(saved.medals?.[5]?.[j])||0),0,3)));
state.records.push(Array.from({length:3},(_,j)=>Math.max(0,Math.floor(Number(saved.records?.[5]?.[j])||0))));
state.wardClears.push(0);
arcadeInfo[5]={...rooms[5],goal:'Survive all three night watches and stop the gremlin quota.',control:'Drag the room to look around. Hold FIRE / Space to shoot through the center sight. Reload with R. Keyboard arrows / WASD also look around. Tap without dragging to fire once.',avoid:'Glowing eyes give away crawlers. Orange rings mean a jump is coming. Armored targets take more hits; precise headshots do double damage. Edge arrows point toward unseen threats.',cue:'Drag to look · hold FIRE / Space · R reload · E flashlight stun'};
tierNotes.push(['105s · seven-shot magazines · headshots','120s · armored crawlers · shorter warnings','135s · multiple attackers · faster leaps']);
function initShooter(){
 Object.assign(mini,{goal:14+mini.tier*4,look:{yaw:850,pitch:270},lookTarget:{yaw:850,pitch:270},targets:[],spawn:1.2,targetSerial:0,ammo:7,magazine:7,reload:0,shotCd:0,fireHeld:false,gunKick:0,muzzle:0,aimFlash:0,hitFlash:0,shotsFired:0,shotsHit:0,headshots:0,lightBurst:0});
 setControls([{id:'fire',text:'HOLD FIRE',key:'Space',hot:true},{id:'reload',text:'RELOAD',key:'R'}]);
}
function reloadBlaster(){if(mini.reload>0||mini.ammo===mini.magazine)return;mini.reload=1.35+mini.tier*.08;tone(190,.09)}
function shooterProjection(e){
 const leap=e.mode==='leap'?clamp(e.leap/e.leapDuration,0,1):0;
 return {x:(e.x-mini.look.yaw+300)*(1-leap)+300*leap,y:(e.y-mini.look.pitch+285)*(1-leap)+310*leap,s:(e.kind===2?1.2:1)*(1+leap*6),leap};
}
function fireBlaster(){
 if(mini.shotCd>0||mini.reload>0)return;if(mini.ammo<=0){reloadBlaster();return}
 mini.ammo--;mini.shotsFired++;mini.shotCd=.23;mini.gunKick=1;mini.muzzle=.075;
 const hits=mini.targets.filter(e=>!e.dead).map(e=>({e,p:shooterProjection(e)})).filter(({p})=>Math.abs(p.x-300)<29*p.s&&Math.abs(p.y+8*p.s-285)<35*p.s).sort((a,b)=>b.p.leap-a.p.leap);
 if(hits.length){const {e,p}=hits[0],head=Math.hypot(p.x-300,p.y+2*p.s-285)<13*p.s;
  mini.shotsHit++;e.hp-=head?2:1;e.hit=.13;mini.aimFlash=.18;arcadeBurst(p.x,p.y,head?'#ffe4a1':'#b8dbb0',12);if(head)mini.headshots++;
  if(e.hp<=0){e.dead=true;mini.got++;praise(head?200:110,head?1:.7);mini.flash=.55;mini.flashText=head?'HEADSHOT · NIGHTY NIGHT':'GREMLIN EVICTED'}
 }else mini.combo=0;
 tone(110,.045,'sawtooth',.025);tone(330,.04,'sine',.018);
}
const crawlPaths=[
 [[125,175],[290,240]],[[325,245],[470,245]],[[600,210],[785,210]],
 [[1060,267],[1240,260]],[[1530,220],[1400,290]],[[930,120],[1035,225]]
];
function spawnCrawler(){
 const id=mini.targetSerial++,path=crawlPaths[id===0?2:id===1?3:Math.floor(rand(0,crawlPaths.length))];
 const kind=mini.shift===0&&mini.tier===0?0:(id%5===3?2:id%3===1?1:0),hp=kind===2?3:kind===1?2:1;
 mini.targets.push({id,path,x:path[0][0],y:path[0][1],kind,hp,maxHp:hp,mode:'crawl',age:0,creep:(7-mini.shift*.7-mini.tier*.6)/mini.rules.mini,wind:0,leap:0,leapDuration:Math.max(.7,1.15-mini.tier*.12),hit:0,stun:0});
}
function updateShooter(dt){
 const keysSpeed=270,dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
 mini.lookTarget.yaw=clamp(mini.lookTarget.yaw+dx*keysSpeed*dt,300,1500);mini.lookTarget.pitch=clamp(mini.lookTarget.pitch+dy*keysSpeed*.6*dt,130,370);
 mini.look.yaw+=(mini.lookTarget.yaw-mini.look.yaw)*(1-Math.exp(-dt*22));mini.look.pitch+=(mini.lookTarget.pitch-mini.look.pitch)*(1-Math.exp(-dt*22));
 for(const k of ['shotCd','muzzle','aimFlash','hitFlash','lightBurst'])mini[k]=Math.max(0,mini[k]-dt);mini.gunKick=Math.max(0,mini.gunKick-dt*5);
 if(mini.reload>0){mini.reload-=dt;if(mini.reload<=0){mini.ammo=mini.magazine;tone(470,.06)}}
 if(mini.fireHeld)fireBlaster();
 mini.spawn-=dt;
 if(mini.spawn<=0&&mini.limit-mini.phaseTime>8){spawnCrawler();if(mini.shift===2&&mini.targetSerial%3===0)spawnCrawler();mini.spawn=(4.2-mini.shift*.35-mini.tier*.22)/mini.rules.mini}
 for(const e of mini.targets){
  e.hit=Math.max(0,e.hit-dt);e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;
  if(e.mode==='crawl'){
   e.age+=dt;const t=clamp(e.age/e.creep,0,1);e.x=e.path[0][0]+(e.path[1][0]-e.path[0][0])*t;e.y=e.path[0][1]+(e.path[1][1]-e.path[0][1])*t+Math.sin(t*Math.PI)*-16;
   if(t>=1){e.mode='wind';e.wind=(1.5-mini.tier*.16)/mini.rules.mini;tone(230,.08)}
  }else if(e.mode==='wind'){e.wind-=dt;if(e.wind<=0){e.mode='leap';e.leap=0;tone(130,.12)}}
  else{e.leap+=dt;if(e.leap>=e.leapDuration){e.dead=true;mini.hitFlash=.45;miniOops('PERSONAL SPACE VIOLATION · SHOOT BEFORE THE LEAP')}}
 }
 mini.targets=mini.targets.filter(e=>!e.dead);
}
function drawNightRoom(g){
 const ox=300-mini.look.yaw,oy=285-mini.look.pitch;
 g.save();g.translate(ox,oy);
 rect(g,0,35,1800,345,gradient(g,0,35,0,345,'#142c43','#355061'));
 rect(g,0,365,1800,400,gradient(g,0,365,0,400,'#2b424f','#132a3e'));
 line(g,[[0,365],[1800,365]],'#8aa4a25a',5);
 for(let x=0;x<1800;x+=110)line(g,[[x,365],[900+(x-900)*2,760]],'#a8b5ad14',2);
 for(let y=410;y<760;y+=65)line(g,[[0,y],[1800,y]],'#a8b5ad10',2);
 rr(g,725,52,240,124,8,'#081e34','#6a8b94',7);
 for(let i=0;i<18;i++)ellipse(g,740+(i*47)%205,62+(i*29)%98,1,1,'#e0e0b6');ellipse(g,904,84,13,13,'#e1ddbc');
 line(g,[[845,55],[845,173]],'#5f7f8c',5);line(g,[[728,118],[962,118]],'#5f7f8c',4);
 for(let x of [713,977]){rr(g,x-18,45,32,165,4,'#5b768a');for(let n=0;n<3;n++)line(g,[[x-12+n*9,53],[x-12+n*9,204]],'#a3b2ad20',2)}
 cabinet(g,290,328,205);monitor(g,388,246);plant(g,170,345,1.5);bed(g,680,370,1.2);ivStand(g,570,370,1.4);
 sofa(g,1045,365,285,'#557185');table(g,1370,315,190,55);plant(g,1510,309,1);cabinet(g,1575,340,135);
 rr(g,85,85,95,87,7,'#a7b4a750','#718f96',3);label(g,'MACY',132,121,18,'#b0c6b3','center');label(g,'HOME TEAM',132,145,10,'#95b1a9','center');
 rr(g,1415,110,95,70,5,'#617e8355','#8ba2a4',2);label(g,'QUIET',1462,139,14,'#bdc6b7','center');label(g,'ISH.',1462,159,12,'#bdc6b7','center');
 g.restore();
}
function drawCrawler(g,e){
 const p=shooterProjection(e);if(p.x<-160||p.x>760)return;
 g.save();g.translate(p.x,p.y);if(e.hit>0)g.globalAlpha=.55;
 if(e.mode==='crawl')g.rotate(Math.sin(e.age*7)*.16);
 gremlin(g,0,30*p.s,p.s,e.kind,mini.total*2+e.id);
 // Glowing eyes remain just visible outside the flashlight's brightest area.
 ellipse(g,-5*p.s,4*p.s,2.4*p.s,2.4*p.s,'#edf9ba');ellipse(g,7*p.s,4*p.s,2.4*p.s,2.4*p.s,'#edf9ba');
 if(e.kind>0){rr(g,-20*p.s,-13*p.s,40*p.s,12*p.s,5*p.s,e.kind===2?'#dea577':'#95b2ca');label(g,String(e.hp),0,-26*p.s,12*p.s,'#eff3cf','center')}
 if(e.mode==='wind'){g.strokeStyle='#f0bc86';g.lineWidth=2.5;g.beginPath();g.arc(0,8,44,0,Math.PI*2*clamp(e.wind/1.5,0,1));g.stroke();label(g,'JUMPING!',0,-48,12,'#f5c28e','center')}
 if(e.stun>0)label(g,'✦',0,-55,24,'#e7ecad','center');g.restore();
}
function drawShooter(g){
 drawNightRoom(g);for(const e of mini.targets.filter(e=>e.mode!=='leap'))drawCrawler(g,e);
 const dark=g.createRadialGradient(300,285,40,300,285,420);dark.addColorStop(0,'#08172900');dark.addColorStop(.42,'#07132125');dark.addColorStop(1,'#050f23d9');rect(g,0,40,600,560,dark);
 if(mini.lightBurst>0)rect(g,0,40,600,560,'#eff4c5'+(mini.lightBurst>.35?'66':'22'));
 // Macy's blanket, bed rails and toy-like blaster anchor the camera in bed.
 path(g,p=>{p.moveTo(95,600);p.quadraticCurveTo(145,472,225,508);p.quadraticCurveTo(300,536,375,508);p.quadraticCurveTo(455,472,505,600)},gradient(g,0,500,0,100,'#77b8aa','#315f6c'));
 line(g,[[38,600],[45,493],[93,486]],'#b1c5bd',10);line(g,[[562,600],[555,493],[507,486]],'#b1c5bd',10);
 g.save();g.translate(338,555+mini.gunKick*16+(mini.reload>0?45*Math.sin(mini.reload/1.5*Math.PI):0));g.rotate(-.12+mini.gunKick*.05);
 rr(g,-10,-85,84,144,24,gradient(g,0,-85,84,144,'#e1c791','#b37c75'),'#634e64',2);rr(g,-4,-139,58,103,16,gradient(g,0,-139,58,103,'#91bec8','#42778b'),'#bedacc',2);rr(g,4,-144,42,16,6,'#244456','#bdd8d0',2);rr(g,12,-117,26,30,6,'#d7eece');label(g,'M',25,-96,15,'#4b7e79','center');line(g,[[0,-150],[0,-162],[49,-162],[49,-150]],'#c7dfc6',3);rr(g,28,-39,27,30,8,'#273f58');g.restore();
 if(mini.muzzle>0){glow(g,344,385,115,'#ffecab99');spark(g,344,388,'#fff4c8',4)}
 for(const e of mini.targets.filter(e=>e.mode==='leap'))drawCrawler(g,e);
 // The fixed center sight is the actual hit-test position.
 const sight=mini.aimFlash>0?'#ffe5a1':'#c3ead5';g.strokeStyle=sight;g.lineWidth=1.5;g.beginPath();g.arc(300,285,21,0,Math.PI*2);g.stroke();
 for(const s of [-1,1]){line(g,[[300+s*12,285],[300+s*30,285]],sight,2);line(g,[[300,285+s*12],[300,285+s*30]],sight,2)}ellipse(g,300,285,2,2,'#f6e8bb');
 const left=mini.targets.filter(e=>shooterProjection(e).x<20).length,right=mini.targets.filter(e=>shooterProjection(e).x>580).length;
 if(left){rr(g,8,240,60,60,13,'#152f47cc');label(g,'◀ '+left,38,276,22,'#e9bd95','center')}if(right){rr(g,532,240,60,60,13,'#152f47cc');label(g,right+' ▶',562,276,22,'#e9bd95','center')}
 rr(g,20,549,173,35,12,'#102b43df');label(g,mini.reload>0?'RELOADING…':mini.ammo+' / '+mini.magazine+' CHARGES',106,573,14,mini.ammo?'#d4ead1':'#f2b3b7','center');
 if(mini.hitFlash>0){g.globalAlpha=mini.hitFlash;rect(g,0,40,600,560,'#b8567b');g.globalAlpha=1}
}
const roomBeforeNight=roomBg;
roomBg=function(g,id){roomBeforeNight(g,id===5?0:id);if(id===5){rect(g,0,0,1000,625,'#162a5266');label(g,'LIGHTS OUT. GREMLINS IN.',500,130,18,'#dee8c9','center')}};
const scenesBeforeNight=miniScene;
miniScene=function(g,id,w,h){if(id!==5){scenesBeforeNight(g,id,w,h);return}g.save();g.scale(w/420,h/240);rect(g,0,0,420,240,gradient(g,0,0,420,240,'#345269','#101e36'));sofa(g,220,205,170,'#526c84');cabinet(g,35,205,120);gremlin(g,89,125,1.4,1,time);gremlin(g,285,130,1.3,0,time);glow(g,210,120,150,'#d6e6bb22');g.strokeStyle='#c5ecd4';g.lineWidth=2;g.beginPath();g.arc(210,120,25,0,Math.PI*2);g.stroke();line(g,[[175,120],[245,120]],'#c5ecd4',1);line(g,[[210,85],[210,155]],'#c5ecd4',1);label(g,'BEDSIDE BLASTER',210,26,14,'#e2eccf','center');g.restore()};
