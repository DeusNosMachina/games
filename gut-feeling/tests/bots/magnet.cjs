// Polarity Panic controller: drags the magnet behind the chosen orb to push it toward its port.
module.exports={id:1,policy:`
let o=mini.orbs.find(o=>o.id===bot.chosen&&!o.dead);
if(!o){o=mini.orbs.filter(o=>o.bad).sort((a,b)=>a.y-b.y)[0]||mini.orbs.filter(o=>!o.bad).sort((a,b)=>a.y-b.y)[0];bot.chosen=o?.id}
if(o){const gx=o.bad?300:o.kind?465:135,dx=gx-o.x,dy=(o.bad?590:65)-o.y,d=Math.hypot(dx,dy)||1;
 const speed=Math.min(180,d*3),fx=dx/d*speed-o.vx,fy=dy/d*speed-o.vy,fd=Math.hypot(fx,fy)||1;
 const p={x:clamp(o.x+fx/fd*85,0,600),y:clamp(o.y+fy/fd*85,0,600)};
 if(!mini.pointer)arcadeDown(p);else arcadeMove(p)}
`};
