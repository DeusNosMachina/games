// Polarity Panic controller: input only. Lets go to cool the magnet, mugs thieves first (zap from
// above, then drag the dazed gremlin into the vent), clears good orbs out of the vent lane before
// flushing gunk, then steers one orb at a time toward the port that accepts it right now, routing
// around the repulsor walls. An orb that makes no progress for 3 seconds of steering is skipped
// for a while (cooling and thief duty pause that clock).
module.exports={id:1,policy:`
const lv=MAGNET_LEVELS[mini.tier],press=p=>{if(!mini.pointer)arcadeDown(p);else arcadeMove(p)},let_go=()=>{if(mini.pointer)arcadeUp()};
bot.skip=bot.skip||{};
if(mini.magnetHot||(bot.cooling&&mini.magnetHeat>0.15)){bot.cooling=true;let_go();return}
bot.cooling=false;
if(lv.heat&&mini.magnetHeat>0.9){bot.cooling=true;let_go();return}
const th=mini.magnetThieves.filter(t=>!t.entering).sort((a,b)=>(b.state==='drag')-(a.state==='drag')||b.y-a.y)[0];
if(th){
 if(th.state==='stun'){const dx=300-th.x,dy=600-th.y,d=Math.hypot(dx,dy)||1;press({x:clamp(th.x+dx/d*55,0,600),y:clamp(th.y+dy/d*55,0,600)})}
 else press({x:th.x,y:clamp(th.y-48,0,600)});
 return;
}
const goalOf=o=>{
 if(o.bad)return {x:300,y:595};
 const port=magnetPortKind(0)===o.kind?0:1;
 if(magnetBarrierOn()&&o.y>205){if(port===0&&o.x<165)return {x:180,y:195};if(port===1&&o.x>435)return {x:420,y:195}}
 return {x:MAGNET_PORT_X[port],y:60};
};
let o=mini.orbs.find(o=>o.id===bot.chosen&&!o.dead&&o.held==null&&!o.entering);
const urgent=mini.orbs.filter(o=>o.bad&&o.held==null&&!o.entering&&o.y<250&&!((bot.skip[o.id]||0)>mini.total)).sort((a,b)=>a.y-b.y)[0];
if(urgent&&(!o||!o.bad)&&o!==urgent){o=urgent;bot.chosen=o.id;bot.best=Infinity;bot.stuck=0}
if(o){const g=goalOf(o),dd=Math.hypot(g.x-o.x,g.y-o.y);bot.stuck=(bot.stuck||0)+.016;if(dd<bot.best-20){bot.best=dd;bot.stuck=0}else if(bot.stuck>3){bot.skip[o.id]=mini.total+6;o=null}}
if(!o){
 const live=mini.orbs.filter(o=>o.held==null&&!o.entering&&!((bot.skip[o.id]||0)>mini.total)),gunk=live.filter(o=>o.bad);
 const lane=gunk.length?live.filter(o=>!o.bad&&o.y>470&&Math.abs(o.x-300)<170).sort((a,b)=>b.y-a.y)[0]:null;
 o=lane||gunk.sort((a,b)=>a.y-b.y)[0]||live.filter(o=>!o.bad).sort((a,b)=>a.y-b.y)[0];
 bot.chosen=o?.id;bot.best=Infinity;bot.stuck=0;
}
if(!o){let_go();return}
const g=goalOf(o),dx=g.x-o.x,dy=g.y-o.y,d=Math.hypot(dx,dy)||1,speed=Math.min(180,d*3),fx=dx/d*speed-o.vx,fy=dy/d*speed-o.vy,fd=Math.hypot(fx,fy)||1;
if(mini.magnet.mode!==1)miniAction('polarity');
press({x:clamp(o.x+fx/fd*85,0,600),y:clamp(o.y+fy/fd*85,0,600)});
`};
