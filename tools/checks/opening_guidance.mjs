// Opening guidance recommends Wreck Quay without locking player choice.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[];G.debug.newRun(2727);G.debug.god(true);
  G.rooms.enter(G.run.graph.hub,{start:true});
  const gates=G.rooms.current.props.filter(p=>p.type==='gate');
  if(gates.length!==5)bad.push('expected five open gates, got '+gates.length);
  const r1=gates.find(g=>g.data.region==='r1'),r2=gates.find(g=>g.data.region==='r2');
  if(!r1||!r2)bad.push('opening gates missing r1/r2');
  else {
    const a=r1.prompt(G.players[0]).join(' '), b=r2.prompt(G.players[0]).join(' ');
    if(!/recommended first route/i.test(a))bad.push('Wreck Quay prompt has no first-route recommendation');
    if(/recommended first route/i.test(b))bad.push('non-Wreck gate incorrectly marked recommended');
  }
  if(!/Wreck Quay/i.test(G.story.objective()))bad.push('opening objective does not recommend Wreck Quay');
  if(!G.fx.banner||G.fx.banner.portrait!=='guide')bad.push('opening Last Timetable banner is not anchored to the Guide portrait');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'five routes remain open; Guide and Gate 1 recommend Wreck Quay as the gentlest start';
};