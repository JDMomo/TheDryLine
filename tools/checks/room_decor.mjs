// Authored decoration: visual-only props instantiate, use watercolor art when available, and never enter room content/collision.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
   G.debug.newRun(1801);const room=G.rooms.current,bad=[];
   const lamps=room.props.filter(p=>p.type==='lamp_decor');
   if(lamps.length!==9)bad.push('Junction has '+lamps.length+' lamps, wanted 9');
   if(room.node.content.some(c=>c&&c.type==='lamp_decor'))bad.push('decor leaked into seeded content');
   if(location.protocol!=='file:'){
     for(let i=0;i<80&&!G.sprites.prop_lamp_decor;i++)await new Promise(r=>setTimeout(r,20));
     if(!G.sprites.prop_lamp_decor)bad.push('watercolor lamp sprite did not load');
   }
   if(lamps.some(l=>l.prompt(G.players[0])!==null))bad.push('decor lamp became interactive');
   const before=G.tiles.blockers.length;G.debug.step(4);
   if(G.tiles.blockers.length!==before)bad.push('decor lamp changed collision blockers');
   return {bad,errors:G.errors.slice(),count:lamps.length};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return r.count+' watercolor station lamps instantiated outside gameplay content';
};