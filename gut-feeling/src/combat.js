// All ward attacks share one equipped-weapon dispatch, for keyboard and touch.
const weapons = [
 {name:'Pillow',verb:'SWING',icon:'pillow',cool:.42,ability:'SPIN'},
 {name:'Barf bag',verb:'THROW',icon:'bag',cool:.62,ability:'SHIELD'},
 {name:'Brick',verb:'LOB',icon:'brick',cool:.9,ability:'TRAP'}
];
const breeds = [
 {name:'Nibbler',hp:3,color:'#b5da81',speed:78},
 {name:'Spitter',hp:4,color:'#dda9d1',speed:52},
 {name:'Bruiser',hp:7,color:'#efbe77',speed:46},
 {name:'Split pea',hp:4,color:'#80d5ec',speed:65}
];
let encounter={wave:0,rest:0,complete:false},enemySerial=0,wardAim=null;
Object.assign(player,{z:0,vz:0,jumpCd:0,swingHit:false,attackKind:0,attackDuration:.42});
state.wardClears=Array.from({length:5},(_,i)=>Math.max(0,Number(saved.wardClears?.[i])||0));
equip=function(i){
 state.item=clamp(i,0,2);const w=weapons[state.item];
 $$('[data-item]').forEach(b=>{const on=+b.dataset.item===state.item;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 $('useIcon').innerHTML='<use href="#i-'+w.icon+'"/>';
 $('attackBtn').innerHTML='<svg><use href="#i-'+w.icon+'"/></svg><span>'+w.verb+'</span>';
 $('attackBtn').setAttribute('aria-label',w.name+' '+w.verb.toLowerCase()+'. Drag to aim, release to attack.');
 $('useBtn').querySelector('span').textContent=w.ability;
 $('weaponReadout').textContent=(state.item+1)+' / '+w.name+' · Space / tap '+w.verb.toLowerCase()+' · E '+w.ability.toLowerCase();
};
function startEncounter(){encounter={wave:1,rest:1.8,complete:false};enemies=[];if(state.room===0||state.room===5)encounter.complete=true;updateWardHUD()}
function spawnWave(){
 const level=encounter.wave-1,types=level===0?[0,1,3]:level===1?[2,0,1,3]:[2,3,1,0,3];
 const spots=[{x:267,y:400},{x:768,y:465},{x:610,y:548},{x:325,y:530},{x:820,y:355}];
 const n=cfg().enemyCount===2?types.length-1:types.length;
 enemies=types.slice(0,n).map((type,i)=>makeEnemy(type,spots[i].x,spots[i].y));
 encounter.rest=0;toast('Wave '+encounter.wave+' / 3 · '+(level===0?'Blue splits. Purple spits.':level===1?'Orange charges. Jump the rush.':'Mixed company. Extremely rude.'),3);updateWardHUD();
}
function makeEnemy(type,x,y,small=false){const b=breeds[type];return {id:'ward-'+(++enemySerial),x,y,type,small,hp:small?2:b.hp,maxHp:small?2:b.hp,hit:0,stun:0,phase:rand(0,6),wind:0,cool:rand(1,2),aimX:0,aimY:0,charge:0,split:false}}
function updateWardHUD(){
 $('wardStatus').textContent=(state.room===0||state.room===5)?'HOME BASE · SAFE TO BREATHE':encounter.complete?'WARD CLEAR · +45 COINS':encounter.rest>0?'NEXT WAVE · CATCH YOUR BREATH':'WAVE '+encounter.wave+'/3 · '+enemies.length+' GREMLINS';
 $('rematchBtn').classList.toggle('hidden',state.room===0||state.room===5||!encounter.complete);
}
function jump(){if(isModal()||state.paused||deadDelay>0||player.jumpCd>0||player.z>0)return;if(!state.started)begin();player.vz=305;player.z=1;player.jumpCd=.82;tone(410,.08);emit(player.x,player.y,'#e4edcd',6,40)}
function aimDirection(){
 if(wardAim){const dx=wardAim.dx,dy=wardAim.dy,d=Math.hypot(dx,dy);if(d>8)return {x:dx/d,y:dy/d}}
 const nearest=enemies.filter(e=>e.hp>0&&dist(player,e)<(state.item?440:130)).sort((a,b)=>dist(a,player)-dist(b,player))[0];
 if(nearest){const d=Math.max(1,dist(player,nearest));return {x:(nearest.x-player.x)/d,y:(nearest.y-player.y)/d}}
 const d=Math.hypot(player.lastDx,player.lastDy)||1;return {x:player.lastDx/d,y:player.lastDy/d};
}
attack=function(){
 if(isModal()||state.paused||deadDelay>0||player.vomit>.55||player.attackCd>0)return;
 if(!state.started)begin();const w=weapons[state.item],a=aimDirection();
 player.dir=a.x>=0?1:-1;player.aimX=a.x;player.aimY=a.y;player.attackKind=state.item;player.swingHit=false;
 player.combo=player.comboTime>0?(player.combo+1)%3:0;player.comboTime=1.1;
 player.attackDuration=w.cool;player.attack=w.cool;player.attackCd=w.cool;
 if(state.item===0){tone(180+player.combo*90,.1);return}
 const power=wardAim?clamp(Math.hypot(wardAim.dx,wardAim.dy)/65,.65,1.35):1;
 projectiles.push({x:player.x+a.x*25,y:player.y-32+a.y*25,z:player.z,age:0,vx:a.x*(state.item===1?420:300)*power,vy:a.y*(state.item===1?420:300)*power,life:state.item===1?1.4:.85,kind:state.item===1?'bag':'brick',friendly:true,bounces:0});
 tone(state.item===1?310:180,.12);
};
function pillowHit(spin=false){
 const reach=(state.upgrades.includes('pillow')?122:104)+(spin?25:0),power=spin||player.combo===2?2:1;
 for(const e of [...enemies]){
  const d=dist(player,e),dot=((e.x-player.x)*(player.aimX||player.dir)+(e.y-player.y)*(player.aimY||0))/Math.max(1,d);
  if(d<reach&&(spin||dot>-.15))hitEnemy(e,power,spin?55:35);
 }
 for(const p of projectiles)if(!p.friendly&&dist({x:p.x,y:p.y+32},player)<reach){p.friendly=true;p.vx*=-1.7;p.vy*=-1.7;p.kind='returned';floating('RETURN TO SENDER',player.x,player.y-110)}
 emit(player.x+(player.aimX||player.dir)*65,player.y-35+(player.aimY||0)*65,'#fff5dc',spin?20:9,120);
}
hitEnemy=function(e,power=1,knock=36){
 if(e.hit>0||e.hp<=0)return;e.hp-=power;e.hit=.18;e.stun=.35;e.wind=0;e.charge=0;
 let d=Math.max(1,dist(player,e));moveEntity(e,(e.x-player.x)/d*knock,(e.y-player.y)/d*knock);
 emit(e.x,e.y-20,breeds[e.type].color,12,130);hitStop=.035;
 if(e.type===3&&!e.small&&!e.split){
  e.split=true;e.hp=0;for(const s of [-1,1]){const child=makeEnemy(3,clamp(e.x+s*23,45,955),clamp(e.y+s*15,180,565),true);if(collides(child.x,child.y)){child.x=e.x;child.y=e.y}enemies.push(child)}
  floating('MITOSIS. RUDE.',e.x,e.y-70,'#b9edff');tone(470,.12);updateWardHUD();return;
 }
 if(e.hp<=0){coins(e.small?7:12);floating(e.small?'+7':'+12',e.x,e.y-60);tone(650,.1);updateWardHUD()}
 else{floating('-'+power,e.x,e.y-65,breeds[e.type].color);tone(230,.07)}
};
useItem=function(){
 if(isModal()||state.paused||deadDelay>0||player.itemCd>0)return;if(!state.started)begin();
 if(state.item===0){player.itemCd=4;player.combo=2;player.attackKind=0;player.attack=player.attackDuration=.55;player.swingHit=true;pillowHit(true);player.inv=Math.max(player.inv,.25)}
 if(state.item===1){player.shield=state.upgrades.includes('bag')?3.4:2.5;player.itemCd=7;toast('Dignity bubble. Incoming blobs blocked.',1.8)}
 if(state.item===2){traps.push({x:player.x,y:player.y+8,life:12});player.itemCd=3}
 tone(440,.14);
};
const receiveHit=damage;
damage=function(source,from){if(player.z>22)return;receiveHit(source,from)};
function brickBurst(p){
 emit(p.x,p.y+28,'#e8a091',20,165);floating('BRICK-SHAPED OPINION',p.x,p.y-42,'#f5c5ab');
 for(const e of [...enemies])if(dist({x:p.x,y:p.y+32},e)<74){hitEnemy(e,2,22);e.stun=1.3}
 p.life=0;
}
function updateCombat(dt){
 player.jumpCd=Math.max(0,player.jumpCd-dt);
 if(player.z>0){player.vz-=780*dt;player.z=Math.max(0,player.z+player.vz*dt);if(player.z===0){emit(player.x,player.y,'#d6e3c8',10,55);if(player.attack>0&&player.attackKind===0){pillowHit(true);floating('SPIKE!',player.x,player.y-100)}}}
 if(player.attack>0&&player.attackKind===0&&!player.swingHit&&player.attack<player.attackDuration*.65){player.swingHit=true;pillowHit()}
 if(state.room!==0&&state.room!==5&&!encounter.complete){
  if(encounter.rest>0){encounter.rest-=dt;if(encounter.rest<=0)spawnWave()}
  else if(enemies.every(e=>e.hp<=0)){
   if(encounter.wave<3){encounter.wave++;encounter.rest=3.5;toast('Wave clear. Next guests arriving in 3 seconds.',3)}
   else{encounter.complete=true;state.wardClears[state.room]++;coins(45);toast('WARD CLEAR · +45 coins. Macy 1, digestive nonsense 0.',4)}updateWardHUD();
  }
 }
 for(const e of [...enemies]){
  if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.stun=Math.max(0,e.stun-dt);e.cool-=dt;if(e.stun>0)continue;
  const d=dist(player,e),nx=(player.x-e.x)/Math.max(1,d),ny=(player.y-e.y)/Math.max(1,d),speed=breeds[e.type].speed*cfg().speed*(e.small?1.6:1);
  if(e.charge>0){e.charge-=dt;moveEntity(e,e.chargeX*370*dt*cfg().speed,e.chargeY*370*dt*cfg().speed);if(d<43)damage('gremlin',e);continue}
  if(e.wind>0){
   e.wind-=dt;if(e.wind<=0){
    if(e.type===1){const dx=e.aimX-e.x,dy=e.aimY-(e.y-32),a=Math.atan2(dy,dx),spread=encounter.wave===3?[-.16,0,.16]:[0];for(const turn of spread)projectiles.push({x:e.x,y:e.y-32,vx:Math.cos(a+turn)*190*cfg().speed,vy:Math.sin(a+turn)*190*cfg().speed,life:4,friendly:false,kind:'blob'})}
    else if(e.type===2){const z=Math.hypot(e.aimX-e.x,e.aimY-e.y)||1;e.chargeX=(e.aimX-e.x)/z;e.chargeY=(e.aimY-e.y)/z;e.charge=.65}
    else if(d<60)damage('gremlin',e);
    e.cool=(e.type===1?2.5:e.type===2?2.8:1.2)/cfg().speed;
   }continue;
  }
  if((e.type===1&&d<450||e.type===2&&d<350||d<49)&&e.cool<=0){e.wind=(e.type===2?.9:e.type===1?.8:.5)/cfg().speed;e.aimX=player.x;e.aimY=player.y-(e.type===1?32:0);continue}
  let mx=nx,my=ny;if(e.type===1){mx=d<185?-nx:d>280?nx:ny*.6;my=d<185?-ny:d>280?ny:-nx*.6}
  const ox=e.x,oy=e.y;moveEntity(e,mx*speed*dt,my*speed*dt);
  if(Math.hypot(e.x-ox,e.y-oy)<dt*4)moveEntity(e,Math.sin(time+e.phase)*speed*dt,Math.cos(time+e.phase)*speed*dt);
  for(const other of enemies)if(other!==e&&other.hp>0){const space=dist(e,other);if(space>0&&space<32)moveEntity(e,(e.x-other.x)/space*25*dt,(e.y-other.y)/space*25*dt)}
  for(const t of traps)if(t.life>0&&dist(e,t)<32){e.hit=0;hitEnemy(e,2);e.stun=2;t.life=0}
 }
 for(const p of projectiles){
  p.age=(p.age||0)+dt;p.life-=dt;
  const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;
  if(collides(nx,ny+32)){
   if(p.kind==='brick'){p.x=nx;p.y=ny;brickBurst(p);continue}
   if(p.kind==='bag'&&!p.bounces){if(collides(nx,p.y+32))p.vx*=-1;if(collides(p.x,ny+32))p.vy*=-1;p.bounces=1;tone(420,.05)}else p.life=0;
  }else{p.x=nx;p.y=ny}
  if(p.kind==='brick'&&p.life<=0){brickBurst(p);continue}
  if(p.friendly){const e=enemies.find(e=>e.hp>0&&dist({x:e.x,y:e.y-30},p)<28);if(e){if(p.kind==='brick')brickBurst(p);else{hitEnemy(e,p.kind==='returned'?3:2);p.life=0}}}
  else if(dist({x:player.x,y:player.y-32},p)<25&&player.z<25){if(player.shield>0){emit(p.x,p.y,'#bce8c7',10);tone(650,.05)}else damage('blob',p);p.life=0}
 }
 enemies=enemies.filter(e=>e.hp>0);projectiles=projectiles.filter(p=>p.life>0);
 $('jumpBtn').style.opacity=player.jumpCd>0?'.5':'1';
}
drawPillowSwing=function(g,p){
 if(p.attackKind!==0)return;const t=1-p.attack/p.attackDuration,angle=Math.atan2(p.aimY||0,p.aimX||p.dir),sweep=-1.5+3.3*(1-Math.pow(1-t,3));
 g.save();g.translate(p.x,p.y-35-p.z);g.rotate(angle);g.scale(1,.8);
 for(let i=0;i<5;i++){g.strokeStyle='#fff4d9'+['12','20','30','45','65'][i];g.lineWidth=3+i*3;g.beginPath();g.arc(0,0,70+i*4,sweep-.7-i*.1,sweep);g.stroke()}
 g.rotate(sweep);line(g,[[0,0],[62,0]],'#d9a989',9);g.translate(83,0);g.rotate(.3+Math.sin(t*Math.PI)*.3);g.scale(1+Math.sin(t*Math.PI)*.16,1-Math.sin(t*Math.PI)*.12);
 rr(g,-31,-25,62,50,15,gradient(g,0,-25,0,50,'#fffdf1','#d3e4d4'),'#a8c7ba',2);path(g,q=>{q.moveTo(-23,-15);q.quadraticCurveTo(0,-8,22,-15);q.moveTo(-23,15);q.quadraticCurveTo(0,8,22,15)},null,'#b4cdbf',1.5);g.restore();
};
