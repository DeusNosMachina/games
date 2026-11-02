// Brick Rebellion controller: input only. Works the bottom row first: braces with an assist when the
// next descent would cross the line, picks HEAVY for armor and FAN when the rack is close, kills
// nurse calls about to ring, then pulls back from the ball toward the weakest brick it targets.
module.exports={id:2,policy:`
if(!mini.balls.length&&!mini.queue&&!mini.boardWait){
 const live=mini.blocks.filter(b=>b.hp>0&&!(b.kind==='boss'&&bricksGuarded(b)));
 const nurse=live.filter(b=>b.kind==='nurse'&&b.ring<=1).sort((a,b)=>b.y-a.y)[0],drop=nurse?2:1;
 const low=live.reduce((m,b)=>Math.max(m,b.y+b.h),0),critical=low+BRICKS_ROW*drop>=BRICKS_LINE,danger=low+BRICKS_ROW*(drop+1)>=BRICKS_LINE;
 const bottom=live.filter(b=>b.y+b.h>=low-5).sort((a,b)=>a.hp-b.hp);
 const target=(!danger&&nurse)||bottom[0]||{x:mini.anchor.x-38,y:BRICKS_TOP,w:76,h:40,kind:'plain'};
 if(critical&&mini.helps>0&&!mini.bricksBrace)miniAction('assist');
 if(danger&&bottom.some(b=>b.kind==='armor')&&mini.heavy>0)miniAction('heavy');
 else if(danger&&mini.fan>0)miniAction('fan');
 else if(danger&&mini.heavy>0)miniAction('heavy');
 else if(target.kind==='armor'&&mini.heavy>0)miniAction('heavy');
 const dx=target.x+target.w/2-mini.anchor.x,dy=target.y+target.h-mini.anchor.y,d=Math.hypot(dx,dy);
 arcadeDown({...mini.anchor});arcadeMove({x:mini.anchor.x-dx/d*145,y:mini.anchor.y-dy/d*145});arcadeUp();
}
`};
