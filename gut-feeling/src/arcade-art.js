// Soft vector art stays sharp at phone and laptop pixel densities.
function arcadeBackdrop(g){
 rect(g,0,0,600,600,gradient(g,0,0,600,600,['','#214a63','#483b61','#23495b','#20534e','#24334e'][mini.id],'#122c40'));
 glow(g,300,220,370,['','#7dbddb22','#daaddd22','#79d8ca20','#9bddb924','#8ba1ce22'][mini.id]);
 for(let y=65;y<600;y+=32)line(g,[[20,y],[580,y]],'#d1ecdc08',1);
 label(g,['','MRI / MAGNETIC SORTER','LOUNGE / SOFTBALL THERAPY','CT / ABSOLUTELY NO BRAKES','ULTRASOUND / GEL EVERYWHERE','YOUR ROOM / LIGHTS OUT'][mini.id],24,28,12,'#b5d4cf');
 label(g,'L'+(mini.tier+1),576,28,12,'#efdab0','right');
}
function drawMagnet(g){
 const gate=mini.tier===2?53:68;
 for(let i=0;i<2;i++){
  const x=i?465:135,col=i?'#f1cf85':'#b2e5c2';
  rr(g,x-gate,48,gate*2,62,17,gradient(g,x,48,0,62,'#163846','#102934'),col,2);
  glow(g,x,76,65,col+'25');if(i)poly(g,[[x,56],[x+12,72],[x,88],[x-12,72]],col);else ellipse(g,x,72,12,12,col);
  label(g,i?'GOLD DIAMONDS':'MINT CIRCLES',x,101,10,col,'center');
 }
 for(let i=0;i<7;i++){const y=145+i*57,x=300+Math.sin(mini.total*.7+y*.012)*80;line(g,[[x-28,y],[x+28,y]],mini.shift?'#b8d9c92d':'#b8d9c90b',2);if(mini.shift)poly(g,[[x+22,y-5],[x+30,y],[x+22,y+5]],'#b8d9c944')}
 const m=mini.magnet;
 if(m.on){for(let r=1;r<=3;r++){let a=(r/3+(m.mode===1?-1:1)*mini.total*.35)%1;if(a<0)a++;g.strokeStyle=m.mode===1?'#a7e5dd38':'#f4b1c038';g.lineWidth=2;g.beginPath();g.arc(m.x,m.y,a*170,0,Math.PI*2);g.stroke()}}
 for(const o of mini.orbs){
  shadow(g,o.x,o.y+8,o.r,6);const color=o.bad?'#ed8daf':o.kind?'#f2cc7d':'#a8dfc1';glow(g,o.x,o.y,o.r*1.8,color+'18');
  ellipse(g,o.x,o.y,o.r,o.r,gradient(g,o.x-o.r,o.y-o.r,o.r*2,o.r*2,color,o.bad?'#b75182':o.kind?'#bd8e55':'#519e96'));
  ellipse(g,o.x-6,o.y-7,5,3,'#fff7dc99');
  if(o.bad)label(g,'×',o.x,o.y+8,27,'#5d294c','center');else if(o.kind)poly(g,[[o.x,o.y-9],[o.x+7,o.y],[o.x,o.y+9],[o.x-7,o.y]],'#fff0bd');else ellipse(g,o.x,o.y,6,6,'#eaffd9');
 }
 g.save();g.translate(m.x,m.y);g.strokeStyle=m.mode===1?'#c6f5df':'#f6bccb';g.lineWidth=10;g.lineCap='round';g.beginPath();g.arc(0,0,21,0,Math.PI);g.lineTo(-21,-12);g.stroke();line(g,[[21,0],[21,-12]],m.mode===1?'#f3a4a0':'#b8e6d6',10);g.restore();
 rr(g,235,555,130,43,12,'#153c40','#c6d4b0',2);label(g,'GUNK DISPOSAL ↓',300,582,10,'#d7e4ba','center');rr(g,158,512,284,28,14,'#102b40bb');label(g,m.on?(m.mode===1?'PULLING · RELEASE TO COAST':'PUSHING · RELEASE TO COAST'):'DRAG & HOLD TO APPLY FORCE',300,531,12,'#d5e7d4','center');
}
function drawVolley(g){
 rr(g,20,45,560,466,20,'#172e43','#b7cbd533',2);
 for(let x=45;x<580;x+=85)line(g,[[x,53],[x,500]],'#cad9db0c',1);
 g.setLineDash([8,8]);line(g,[[28,505],[572,505]],'#e49bb2',2);g.setLineDash([]);
 label(g,'DO NOT CROSS',300,500,10,'#f3a8bf','center');
 for(const b of mini.blocks){if(b.hp<=0)continue;const color=b.kind==='blast'?'#e79bb8':b.kind==='extra'?'#e9cc86':b.maxHp>2?'#a8aecf':'#a4d5bf';
  shadow(g,b.x+b.w/2,b.y+b.h+3,b.w*.45,5);rr(g,b.x,b.y,b.w,b.h,9,gradient(g,b.x,b.y,0,b.h,color,b.kind==='blast'?'#a86192':'#5c8997'),'#e9efdc44',1);
  for(let n=0;n<2;n++)ellipse(g,b.x+21+n*34,b.y+5,9,4,color);
  if(b.flash>0)rr(g,b.x,b.y,b.w,b.h,9,'#ffffdc88');
  label(g,b.kind==='blast'?'✹ '+b.hp:b.kind==='extra'?'★ '+b.hp:String(b.hp),b.x+b.w/2,b.y+29,20,'#163b4c','center');
 }
 if(mini.aim){const v=volleyVector();if(v){let x=mini.anchor.x,y=mini.anchor.y,dx=v.vx*.055,dy=v.vy*.055;for(let i=0;i<27;i++){x+=dx;y+=dy;if(x<25||x>575){x=clamp(x,25,575);dx*=-1}if(y<50){y=50;dy*=-1}if(y>555)break;ellipse(g,x,y,3,3,'#fff1bd'+(i<12?'cc':'66'))}
  line(g,[[mini.anchor.x,mini.anchor.y],[mini.aim.x,mini.aim.y]],'#e5c395',3);rr(g,35,561,110,7,3,'#26495a');rr(g,35,561,110*v.power,7,3,'#e8c98a');label(g,'THROW POWER',35,588,10,'#c1d3cf')}
 }
 for(const b of mini.balls){ellipse(g,b.x-b.vx*.012,b.y-b.vy*.012,b.power>1?9:7,b.power>1?9:7,'#f9e6ac33');softball(g,b.x,b.y,b.power>1?9:7)}
 if(!mini.balls.length&&!mini.queue){glow(g,mini.anchor.x,mini.anchor.y,35,'#ffe4aa30');softball(g,mini.anchor.x,mini.anchor.y,13);label(g,mini.aim?'RELEASE TO THROW':mini.throwStyle==='flick'?'FLICK UPWARD FROM THE BALL':'PULL BACK FROM THE BALL',300,588,12,'#f2dba7','center')}
 else{label(g,'VOLLEY '+mini.shot+' / '+mini.volleys,300,585,13,'#d3e4d9','center');if(mini.shotClock>1.2)label(g,'RECALL skips the remaining bounces',300,562,10,'#a9c6ca','center')}
}
function softball(g,x,y,r=10){ellipse(g,x,y,r,r,'#fff1bf');g.save();g.translate(x,y);g.rotate(time*3);path(g,p=>{p.moveTo(-r*.6,-r*.7);p.quadraticCurveTo(r*.1,0,-r*.6,r*.7);p.moveTo(r*.6,-r*.7);p.quadraticCurveTo(-r*.1,0,r*.6,r*.7)},null,'#d98180',1.3);g.restore()}
function drawRace(g){
 rr(g,80,45,440,555,24,gradient(g,80,45,440,555,'#3c6e7e','#305264'));
 for(const x of [89,511])line(g,[[x,55],[x,600]],'#bfe6d2',4);
 for(const x of [230,370]){g.setLineDash([24,26]);g.lineDashOffset=-mini.total*150;line(g,[[x,50],[x,600]],'#c7e1ca44',3);g.setLineDash([])}
 for(let i=0;i<7;i++){const y=(i*100+mini.total*130)%670-35;rr(g,16,y,48,60,6,'#46747e');rr(g,537,y,48,60,6,'#46747e');line(g,[[23,y+8],[56,y+8]],'#9cdbca',3);line(g,[[545,y+8],[578,y+8]],'#9cdbca',3)}
 for(const r of mini.rows)for(const o of r.objects){const x=160+o.lane*140,y=r.y;
  if(o.kind==='coin'){if(!r.done){for(const d of [-12,12]){ellipse(g,x+d,y,9,12,'#f3ce7b');ellipse(g,x+d,y,5,8,'#ffe8a9')}}}
  else if(o.kind==='gremlin'){if(o.hp>0){gremlin(g,x,y+22,1.15,3,mini.total);label(g,String(o.hp)+' HIT'+(o.hp>1?'S':''),x,y-40,11,'#dbf0dc','center')}}
  else if(o.kind==='crate'){rr(g,x-43,y-20,86,40,8,gradient(g,x,y-20,0,40,'#f0c18a','#b57a70'),'#f6d1a5',2);label(g,'↑ JUMP',x,y+5,14,'#4b4051','center')}
  else if(o.kind==='bar'){line(g,[[x-49,y+26],[x-49,y-24],[x+49,y-24],[x+49,y+26]],'#b39bd7',7);rr(g,x-47,y-29,94,16,6,'#dbb9e9');label(g,'↓ SLIDE',x,y+7,14,'#e2d7ef','center')}
  else{rr(g,x-46,y-35,92,65,9,gradient(g,x,y-35,0,65,'#eeadc0','#a35e86'));line(g,[[x-26,y-20],[x+26,y+15]],'#f4d1cf',5);line(g,[[x+26,y-20],[x-26,y+15]],'#f4d1cf',5)}
 }
 for(const b of mini.bullets)softball(g,b.x,b.y,9);
 shadow(g,mini.cartX,530,43,10);g.save();g.translate(mini.cartX,530-mini.jump);if(mini.inv>0)g.globalAlpha=.6+.4*Math.sin(time*14);if(mini.slide>0){g.rotate(-.13);g.scale(1,.64)}miniBed(g,0,0,.62);if(mini.jump>0)label(g,'AIR MACY',0,-105,11,'#ffebb7','center');g.restore();
}
function drawSlice(g){
 ellipse(g,300,332,257,257,'#0b313d');for(let r=1;r<=4;r++){g.strokeStyle='#77bba527';g.lineWidth=1.5;g.beginPath();g.arc(300,332,r*60,0,Math.PI*2);g.stroke()}
 line(g,[[300,65],[300,590]],'#a6e0bf18',1);line(g,[[30,332],[570,332]],'#a6e0bf18',1);
 for(const o of mini.gels){g.save();g.translate(o.x,o.y);g.rotate(o.angle);
  if(o.bomb){glow(g,0,0,43,'#ef7dba24');ellipse(g,0,0,o.r,o.r,gradient(g,-22,-22,44,44,'#f2b1cf','#bd507e'));label(g,'×',0,13,40,'#612443','center');line(g,[[13,-22],[20,-33]],'#d7c7a6',3);spark(g,21,-35,'#ffd39c',.5)}
  else{gremlin(g,0,24,o.r/23,o.split?3:0,mini.total+o.id);if(o.armor){rr(g,-25,-32,50,20,9,gradient(g,-20,-32,40,20,'#e7ecdf','#8eabbc'),'#d8ebdf',2);line(g,[[-15,-25],[15,-25]],'#65848e',2)}}g.restore();
 }
 if(mini.trail.length>1){g.lineCap='round';for(let i=1;i<mini.trail.length;i++){const a=mini.trail[i-1],b=mini.trail[i];g.globalAlpha=Math.min(a.life/.23,1);line(g,[[a.x,a.y],[b.x,b.y]],mini.fever>0?'#ffe8a0':'#b5edd8',10);line(g,[[a.x,a.y],[b.x,b.y]],'#fffae8',3)}g.globalAlpha=1}
 rr(g,170,567,260,9,4,'#31575b');rr(g,170,567,260*(mini.fever>0?mini.fever/4:mini.feverMeter/12),9,4,mini.fever>0?'#f1ce7e':'#9dd8b6');
 label(g,mini.fever>0?'GEL FEVER · DOUBLE POINTS':'3+ PER SWIPE BUILDS GEL FEVER',300,593,11,'#d7e6c9','center');
 label(g,'ESCAPED '+mini.escaped%6+' / 6',576,55,11,'#b8d9c9','right');
}
const drawIVOnly=drawMini;
drawMini=function(){
 if(mini.id===0){drawIVOnly();return}if(!['briefing','intro','play','outro'].includes(mini.screen))return;
 const g=mc;g.clearRect(0,0,600,600);arcadeBackdrop(g);[null,drawMagnet,drawVolley,drawRace,drawSlice,drawShooter][mini.id](g);
 for(const p of mini.fx){g.globalAlpha=Math.min(1,p.life*3);ellipse(g,p.x,p.y,4,4,p.col)}g.globalAlpha=1;
 if(mini.notice>0&&mini.screen==='play'){rr(g,170,48,260,48,15,'#16374bdf','#b6d9ca66',1);label(g,(mini.shift===2?'FINAL ':mini.shift===1?'SECOND ':'FIRST ')+(mini.id===2?'RACK':mini.id===3?'SECTOR':mini.id===5?'WATCH':'SHIFT'),300,79,18,'#f1e2b9','center')}
 if(mini.flash>0){g.globalAlpha=Math.min(1,mini.flash*3);rr(g,30,115,540,37,12,'#173349ed');label(g,mini.flashText,300,139,13,'#ffe5b8','center');g.globalAlpha=1}
 if(mini.screen==='intro'||mini.screen==='outro'){
  const intro=mini.screen==='intro';rect(g,0,0,600,600,'#102c4299');rr(g,45,225,510,145,22,'#112e45ee','#9dc7be66',1);
  label(g,intro?(mini.transition<3?String(3-Math.floor(mini.transition)):'GO!'):mini.pendingFinish.win?'SHIFT COMPLETE':'WELL. THAT HAPPENED.',300,295,intro?64:27,'#f4ebcf','center');
  label(g,intro?'Find your grip. The clock is still paused.':'Score '+mini.score+' · Best chain '+mini.maxCombo,300,334,15,'#bad8cc','center');
 }
};
const sceneBeforeGestures=miniScene;
miniScene=function(g,id,w,h){
 if(id===0){sceneBeforeGestures(g,id,w,h);return}g.save();g.scale(w/420,h/240);rect(g,0,0,420,240,gradient(g,0,0,420,240,['','#336a7c','#605274','#3a6b7e','#316b61'][id],'#193b4e'));
 if(id===1){for(let i=0;i<6;i++){const x=60+i*61,y=92+Math.sin(i)*32;ellipse(g,x,y,15,15,i%2?'#eaca8b':'#a8dec0')}line(g,[[173,150],[173,181],[247,181],[247,150]],'#b9dfd4',16);line(g,[[173,135],[173,151]],'#eda7b1',16);line(g,[[247,135],[247,151]],'#eccb89',16)}
 if(id===2){for(let r=0;r<3;r++)for(let col=0;col<5;col++){rr(g,72+col*57,42+r*33,50,27,7,(r+col)%4===0?'#d99db9':'#aed1bf');label(g,String((r+col)%3+1),97+col*57,62+r*33,13,'#315b66','center')}for(let i=0;i<8;i++)ellipse(g,215+i*12,195-i*12,3,3,'#f6dfaf');softball(g,210,200,12)}
 if(id===3){for(const x of [120,210,300])line(g,[[x,20],[x,240]],'#b7dec65a',2);miniBed(g,210,230,.7);gremlin(g,120,100,1.1,3,time);rr(g,270,110,60,28,6,'#eabb89')}
 if(id===4){for(let i=0;i<4;i++)gremlin(g,100+i*77,125+Math.sin(i)*38,1.3,i===3?3:0,time+i);path(g,p=>{p.moveTo(50,170);p.quadraticCurveTo(170,60,355,150)},null,'#f4edc7',5)}
 label(g,rooms[id].game.toUpperCase(),210,24,12,'#e5efd3','center');g.restore();
};
