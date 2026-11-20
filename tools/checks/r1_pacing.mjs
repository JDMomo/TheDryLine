// Wreck Quay pacing: the Beached Deck has one safe, authored service stop before its late encounter lane.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[],d=G.roomDefs.r1_wreck,hs=d.marks.filter(m=>m.ch==='H'),qs=d.marks.filter(m=>m.ch==='?'),es=d.marks.filter(m=>m.ch==='E');
  if(hs.length!==1||hs[0].c!==39||hs[0].r!==14)bad.push('service pipe placement '+JSON.stringify(hs));
  if(!qs.some(m=>m.c===40&&m.r===14))bad.push('service notice missing');
  if(es.some(m=>Math.abs(m.c-39)<8))bad.push('enemy crowds service stop '+JSON.stringify(es));
  G.debug.newRun(2728);G.debug.god(true);
  const node=Object.values(G.run.graph.nodes).find(n=>n.def==='r1_wreck');
  if(!node)bad.push('Beached Deck missing from campaign');
  else {
    G.rooms.enter(node.id,{side:'left'});const pipe=G.rooms.current.props.find(p=>p.type==='standpipe');
    if(!pipe)bad.push('standpipe did not instantiate');
    else { const p=G.players[0];p.hp=Math.max(1,p.maxHp-2);pipe.interact(p);if(p.hp!==p.maxHp||!pipe.data.used)bad.push('standpipe did not mend normally'); }
  }
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Beached Deck repair pocket separates exploration from the late encounter lane';
};