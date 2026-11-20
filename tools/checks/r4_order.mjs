// Ticket Hall authored order follows station logic: public hall -> booths -> maintenance switchyard -> gate line -> Warden.
export default async({page})=>{
 const bad=await page.evaluate(()=>{
  const out=[];
  for(const seed of [1,7,22]){
    G.debug.newRun(seed);const g=G.run.graph.regions.r4;
    const defs=g.nodes.filter(id=>!G.run.graph.nodes[id].parent).map(id=>G.run.graph.nodes[id].def);
    const want=['r4_concourse','r4_booths','r4_switchyard','r4_gateline','r4_arena'];
    if(defs.join()!==want.join())out.push('seed '+seed+' '+defs.join(' > '));
    const trial=g.nodes.map(id=>G.run.graph.nodes[id]).find(n=>n.parent&&n.def==='r4_trial');
    if(!trial||G.run.graph.nodes[trial.parent].def!=='r4_switchyard')out.push('seed '+seed+' Heavy Cut trial not attached to switchyard');
  }
  return out;
 });
 if(bad.length)throw new Error(bad.join(' | '));
 return 'Ticket Hall follows public concourse, booths, maintenance switchyard, gate line, Gatewhale';
};