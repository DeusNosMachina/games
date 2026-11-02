// Gel Yeah controller: short strokes through safe gremlins, never near a bomb.
module.exports={id:4,policy:`
if(mini.total-(bot.lastStroke||0)>.07){
 const good=mini.gels.filter(o=>!o.bomb&&!o.dead&&o.y>90&&o.y<550);
 const o=good.find(o=>!mini.gels.some(b=>b.bomb&&!b.dead&&dist(o,b)<o.r+b.r+10));
 if(o){arcadeDown({x:o.x-4,y:o.y});arcadeMove({x:o.x+4,y:o.y});arcadeUp();bot.lastStroke=mini.total}
}
`};
