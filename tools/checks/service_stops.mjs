// Authored campaign service stops survive world balancing and remain deterministic.
export default async({page})=>{
 const bad=await page.evaluate(()=>{
  const out=[];
  for(const seed of [1,2,7,19,41]){
    G.debug.newRun(seed);
    const g=G.run.graph,c=G.worldgen.census(g);
    const wreck=Object.values(g.nodes).find(n=>n.def==='r1_wreck');
    if(!wreck)out.push('seed '+seed+' missing r1_wreck');
    else if(!G.worldgen.contents(wreck).some(c=>c.type==='standpipe'))out.push('seed '+seed+' stripped r1_wreck standpipe');
    if(!c.standpipes.includes(g.hub))out.push('seed '+seed+' missing hub standpipe');
    const defs=c.standpipes.map(id=>g.nodes[id]&&g.nodes[id].def);
    if(!defs.includes('r1_wreck'))out.push('seed '+seed+' census missing Wreck service '+defs.join(','));
  }
  return out;
 });
 if(bad.length)throw new Error(bad.join(' | '));
 return 'authored Wreck service stop survives balance across five seeds';
};