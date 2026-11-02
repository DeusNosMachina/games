// Drip or Die controller: taps the sweep at the target, picks lanes, pumps toward the band.
module.exports={id:0,policy:`
if(mini.phase===0&&Math.abs(mini.pos-mini.target)<.005)miniAction('tap');
if(mini.phase===1){const d=mini.drops.filter(o=>!o.done).sort((a,b)=>b.y-a.y)[0];if(d){if(d.bad&&mini.lane===d.lane)miniAction('lane'+((d.lane+1)%3));else if(!d.bad&&d.kind===mini.recipe)miniAction('lane'+d.lane)}}
if(mini.phase===2)mini.held=mini.pressure+mini.velocity*.16<mini.pressureTarget;
`};
