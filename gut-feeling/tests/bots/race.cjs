// Gurney Grand Prix controller: steers to the wanted lane and jumps or slides just before contact.
module.exports={id:3,policy:`
const row=mini.rows.find(r=>!r.done);
if(row){const want=mini.stunts<mini.stuntGoal?(row.objects.find(o=>['crate','bar'].includes(o.kind))||row.objects.find(o=>o.kind==='coin')):row.objects.find(o=>o.kind==='coin');const lane=want.lane;
 if(mini.lane<lane)miniAction('right');if(mini.lane>lane)miniAction('left');
 const speed=(130+mini.tier*16+mini.shift*23)*mini.rules.mini;
 if((490-row.y)/speed<.35&&row.y<490){if(want.kind==='crate'&&mini.jump===0)miniAction('jump');if(want.kind==='bar'&&mini.slide===0)miniAction('slide')}}
`};
