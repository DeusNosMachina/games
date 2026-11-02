// Brick Rebellion controller: pulls back from the ball toward the lowest, weakest block.
module.exports={id:2,policy:`
if(!mini.balls.length&&!mini.queue&&!mini.boardWait){
 const target=mini.blocks.filter(b=>b.hp>0).sort((a,b)=>b.y-a.y||a.hp-b.hp)[0];
 if(target){const dx=target.x+target.w/2-mini.anchor.x,dy=target.y-mini.anchor.y,d=Math.hypot(dx,dy);arcadeDown({...mini.anchor});arcadeMove({x:mini.anchor.x-dx/d*145,y:mini.anchor.y-dy/d*145});arcadeUp()}
}
`};
