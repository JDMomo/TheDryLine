// Wreck Quay boss approach: Brine Tunnel combat ends before a quiet warning stretch into the Toll House.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[],d=G.roomDefs.r1_tunnel,es=d.marks.filter(m=>m.ch==='E'),qs=d.marks.filter(m=>m.ch==='?');
  if(es.length!==3)bad.push('Brine Tunnel enemy marker count '+es.length);
  if(es.some(m=>m.c>21))bad.push('enemy remains in quiet boss-approach stretch '+JSON.stringify(es));
  if(!qs.some(m=>m.c===25&&m.r===14))bad.push('Toll House warning sign missing at c25');
  if(!d.signs||d.signs.length<2||!/TOLL HOUSE/i.test(d.signs[1]))bad.push('boss-approach notice text missing');
  const arena=G.roomDefs.r1_arena;
  if(!arena||arena.w!==2||!arena.marks.some(m=>m.ch==='B'&&m.c>35))bad.push('Toll House no longer has authored vestibule/fight depth');
  G.debug.newRun(4242);const node=Object.values(G.run.graph.nodes).find(n=>n.def==='r1_tunnel');
  if(!node)bad.push('Brine Tunnel missing from campaign');
  else{
    G.rooms.enter(node.id,{side:'left'});
    const live=G.rooms.current.enemies;
    const rightmost=live.reduce((m,e)=>Math.max(m,e.x),0);
    if(rightmost>22*G.C.T)bad.push('live enemy spawned inside quiet boss approach at x '+Math.round(rightmost));
  }
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Brine Tunnel ends with a quiet signed approach into the Toll House vestibule';
};