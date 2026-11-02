// Bedside Blaster controller: pans toward the most urgent crawler and fires when it sits in the sight.
module.exports={id:5,policy:`
const e=mini.targets.filter(e=>!e.dead).sort((a,b)=>(b.mode==='leap'?3:b.mode==='wind'?2:1)-(a.mode==='leap'?3:a.mode==='wind'?2:1)||b.age-a.age)[0];
if(e){arcadeDown({x:300,y:300});arcadeMove({x:300+clamp((e.x-mini.lookTarget.yaw)/1.8,-280,280),y:300+clamp((e.y+2-mini.lookTarget.pitch)/1.1,-200,200)});arcadeUp(true);const p=shooterProjection(e);if(Math.hypot(p.x-300,p.y+2*p.s-285)<12*p.s)miniAction('fire')}
if(mini.ammo===0)miniAction('reload');
`};
