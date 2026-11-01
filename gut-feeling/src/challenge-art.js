// Readable cues for the extra mechanics; all artwork remains in the single HTML.
function drawTimingBar(g,x,y,w,value,target,band){
 rr(g,x,y,w,37,16,'#0c2c3b','#6c969a',1);
 rr(g,x+(target-band/2)*w,y+2,band*w,33,6,'#96ceac');
 rr(g,x+(target-band*.14)*w,y+2,band*.28*w,33,3,'#f4e6ad');
 line(g,[[x+value*w,y-5],[x+value*w,y+43]],'#ffe0a1',4);
 ellipse(g,x+value*w,y-5,5,5,'#ffe0a1');
}
drawIVMini=function(g){
 if(mini.phase===0){
  miniBed(g,222,275,1.15);ivStand(g,111,275,1.2);cabinet(g,355,276,88);monitor(g,398,188);
  label(g,'PRIME THE PUMP',605,106,22,'#d8e8cc','center');
  for(let i=0;i<mini.required;i++){const x=512+(i%6)*36,y=142+Math.floor(i/6)*35;ellipse(g,x,y,11,11,i<mini.good?'#c4e8b5':'#365563');if(i<mini.good)spark(g,x,y,'#fff0b6',.55)}
  label(g,mini.good+' / '+mini.required+' accurate drips',605,232,17,'#e7d49c','center');
  label(g,mini.dir>0?'SWEEP →':'← SWEEP',605,262,14,'#b4d9cb','center');
  drawTimingBar(g,85,335,630,mini.pos,mini.target,mini.band*(mini.helpTime>0?1.7:1));
  label(g,'MINT = GOOD    ·    GOLD CENTER = PRECISION BONUS',400,411,14,'#dce8ca','center');
 }else if(mini.phase===1){
  const color=mini.recipe===0?'#f3ce84':'#eca8bc';
  rr(g,193,46,414,42,12,color);label(g,mini.recipe===0?'RECIPE: GOLD VANILLA':'RECIPE: PINK BERRY',400,74,19,'#294657','center');
  for(let lane=0;lane<3;lane++){
   const x=240+lane*160;panel(g,x-57,101,114,285,'#153641','#456b75');
   line(g,[[x-43,113],[x-43,330]],'#b7d8cb33',3);label(g,['LEFT','MIDDLE','RIGHT'][lane],x,425,12,'#bddbce','center');
  }
  for(const d of mini.drops){
   if(d.done)continue;let x=240+d.lane*160;
   ellipse(g,x,d.y,d.bad?17:14,d.bad?17:19,d.bad?'#9cbd59':d.kind===0?'#f3ce84':'#eca8bc');
   if(d.bad){ellipse(g,x-6,d.y-4,3,4,'#315240');ellipse(g,x+6,d.y-4,3,4,'#315240');line(g,[[x-6,d.y+6],[x+6,d.y+6]],'#315240',3)}
   else{line(g,[[x-4,d.y-9],[x-4,d.y-3]],'#fff2ce',3);label(g,d.kind===0?'V':'B',x,d.y+6,11,'#614d63','center')}
  }
  const x=mini.cupX;shadow(g,x,395,44,7);
  path(g,p=>{p.moveTo(x-42,344);p.lineTo(x+42,344);p.lineTo(x+32,384);p.quadraticCurveTo(x,400,x-32,384);p.closePath()},gradient(g,x,344,0,50,'#fff1c0','#8fb4a2'));
  ellipse(g,x,344,42,8,'#e9e1b9');ellipse(g,x,344,34,5,mini.helpTime>0?'#a8e7cf':'#456f7b');
 }else{
  miniBed(g,137,309,.95);ivStand(g,61,309,.85);
  label(g,'FOLLOW THE MOVING BAND',400,67,22,'#dce9cd','center');
  panel(g,319,92,162,272,'#173747','#82a9ad');rr(g,331,105,138,246,13,'#0b2839');
  const y=351-mini.pressure*246,b=mini.pressureBand*246,by=351-(mini.pressureTarget+mini.pressureBand/2)*246;
  rr(g,332,y,136,Math.max(1,351-y),8,gradient(g,330,y,0,351-y,'#9fd7c0','#4f9aa9'));
  rr(g,308,by,185,b,5,'#c3eaaa77','#d8efb7',2);
  line(g,[[487,y],[509,y]],'#ffda8c',3);
  label(g,Math.round(mini.pressure*100)+'%',555,y+5,20,'#ffe1a3');
  label(g,mini.stable.toFixed(1)+' / '+mini.need+'s',640,142,25,'#ffe0a1','center');
  label(g,'TIME IN THE BAND',640,169,12,'#a8d1c3','center');
  label(g,'Momentum '+(mini.velocity>0?'↑':'↓'),640,230,16,'#c4e0d4','center');
  label(g,mini.held?'PUMPING ↑':'RELEASING ↓',400,399,18,'#d3e5c5','center');
  rr(g,247,422,306,10,5,'#234959');rr(g,247,422,306*Math.min(1,mini.stable/mini.need),10,5,'#bde5b5');
 }
};
drawMRIMini=function(g){
 const color=mini.scan==='go'?'#b5e8b4':mini.scan==='warn'?'#ffd389':'#f49fb0';
 rect(g,0,278,800,172,gradient(g,0,278,0,172,'#87b2ae','#527f90'));scanner(g,665,270);
 for(let x=0;x<800;x+=65)line(g,[[x,278],[x,445]],'#d8e6cc33',1);
 const px=95+Math.min(1,mini.progress/mini.distance)*500;miniBed(g,px,354,.64);
 if(mini.velocity>10)for(let i=0;i<3;i++)line(g,[[px-75-i*15,325+i*9],[px-53-i*15,325+i*9]],'#d6edcd99',3);
 if(mini.flash>0)vomitArt(g,px,323,1,mini.flash,.7);
 panel(g,177,65,446,109,'#213c51','#8bacad');
 ellipse(g,216,118,17,17,color);glow(g,216,118,35,color+'55');
 label(g,mini.scan==='go'?'GREEN · BUILD SPEED':mini.scan==='warn'?'AMBER · STOP NOW':'PINK · STAY STILL',425,109,22,color,'center');
 label(g,mini.scan==='scan'?(mini.scanFault?'Blurry scan. No lock this cycle.':'Hold that pose. Earning a clean lock…'):'The bed coasts after you release.',425,145,14,'#bed9cc','center');
 label(g,'SPEED',91,205,11,'#bed9cc');rr(g,150,193,243,16,8,'#0b2c40');rr(g,150,193,243*Math.min(1,mini.velocity/73),16,8,color);
 label(g,mini.brakeCd>0?'BRAKE '+mini.brakeCd.toFixed(1)+'s':'BRAKE READY',575,207,13,mini.brakeCd>0?'#9cb8bc':'#c8e8b2','center');
 label(g,'CLEAN LOCKS  '+mini.locks+' / '+mini.lockNeed,400,244,17,'#e2dbb1','center');
 rr(g,72,404,656,12,6,'#214250');rr(g,72,404,656*Math.min(1,mini.progress/mini.distance),12,6,'#b7deae');
 label(g,'CHECKPOINT '+(mini.round+1)+' OF 3',400,440,12,'#cbdcca','center');
};
const runnerIllustration=drawCTMini;
drawCTMini=function(g){
 runnerIllustration(g);
 for(const r of [...mini.rows].sort((a,b)=>a.z-b.z)){
  const z=r.z,s=.2+z*.85,x=400+(r.foam-1)*(57+z*103),y=93+z*z*300;
  rr(g,x-34*s,y-31*s,68*s,33*s,8*s,gradient(g,x,y-31*s,0,33*s,'#8cd3e1','#4c91be'),'#d1ece1',s);
  label(g,'3×',x,y-9*s,18*s,'#ecf3d4','center');
 }
 if(mini.swat>0){g.save();g.translate(mini.cartX,345);g.rotate((.4-mini.swat)*-4);rr(g,-48,-20,96,36,12,'#fff1d9','#afcfc2',2);line(g,[[-32,-3],[32,-3]],'#a8c8b8',2);g.restore()}
 rr(g,17,61,171,50,12,'#123347dd');label(g,'SECTOR '+(mini.round+1)+' / 3',102,81,12,'#c5e4cf','center');label(g,mini.tokens+' / '+mini.quota+' TOKENS',102,101,14,'#f5d69f','center');
 rr(g,614,61,169,50,12,'#123347dd');label(g,mini.swatCd>0?'SWAT RECHARGING':'SWAT READY',699,84,12,'#d0e7cf','center');label(g,'BLUE = 3 TOKENS',699,102,11,'#98d6ed','center');
};
const echoGrid={x:220,y:24,cell:120};
drawEchoMini=function(g){
 const{x:x0,y:y0,cell}=echoGrid;
 for(let i=0;i<9;i++){
  const x=x0+i%3*cell,y=y0+Math.floor(i/3)*cell,found=mini.found.includes(i),wrong=mini.wrong.includes(i),selected=mini.probe===i;
  const revealed=mini.screen==='play'&&mini.reveal>0,real=mini.targets.includes(i),decoy=mini.decoys.includes(i);
  panel(g,x+3,y+3,114,114,selected?'#396d71':found?'#457763':wrong?'#653b55':'#153c49',selected?'#ffe2a0':found?'#bce4b1':'#588f89');
  label(g,String(i+1),x+14,y+24,12,'#a1cbbb');
  if(found||selected||(revealed&&(real||decoy))){
   gremlin(g,x+60,y+88,1.04,decoy?1:0,time+i);
   if(revealed&&decoy)label(g,'DECOY',x+60,y+107,10,'#f7adbd','center');
   if(found)label(g,'✓',x+86,y+28,20,'#deefb7');
  }
 }
 label(g,'SCAN '+(mini.round+1),113,131,16,'#c4e3cf','center');
 label(g,mini.reveal>0?'MEMORIZE':mini.probe>=0?'TIME THE TAG':'FIND GREEN',113,161,13,'#d9e6bb','center');
 label(g,mini.found.length+' / '+mini.targets.length,682,145,25,'#efdfac','center');
 label(g,'CAPTURED',682,172,12,'#b5d9c6','center');
 if(mini.reveal>0){const sy=y0+(mini.reveal%1)*360;line(g,[[x0,sy],[x0+360,sy]],'#d6efb9',3)}
 if(mini.probe>=0){drawTimingBar(g,181,399,438,mini.lockPos,mini.lockTarget,mini.lockBand);label(g,'TAG IN MINT',400,389,11,'#e5e9b9','center')}
 else{label(g,mini.reveal>0?'Watch green. Ignore pink.':'Tap a remembered cell to line up a tag.',400,421,17,'#d6e5c5','center')}
};
