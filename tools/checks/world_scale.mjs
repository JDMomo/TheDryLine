// Run scale and story landmarks: longer lines, guaranteed narrative room, still seeded and graph-sound.
export default async ({page})=>{
 const bad=await page.evaluate(()=>{
  const out=[],want={r1:['r1_dock',4],r2:['r2_shaft',4],r3:['r3_trestle',4],r4:['r4_concourse',4],final:['final_gearworks',3]};
  for(let seed=1;seed<=40;seed++){
   G.debug.newRun(seed);const g=G.run.graph,chk=G.worldgen.check(g);
   if(chk.unreachable.length||chk.deadEnds.length||g.warnings.length)out.push('seed '+seed+' graph '+JSON.stringify({u:chk.unreachable,d:chk.deadEnds,w:g.warnings}));
   for(const [rid,[landmark,len]] of Object.entries(want)){
    const rg=g.regions[rid],mains=rg.nodes.filter(id=>G.roomDefs[g.nodes[id].def].kind==='main'),defs=mains.map(id=>g.nodes[id].def);
    if(mains.length!==len)out.push('seed '+seed+' '+rid+' length '+mains.length+' wanted '+len);
    if(!defs.includes(landmark))out.push('seed '+seed+' '+rid+' missing '+landmark);
    if(new Set(defs).size!==defs.length)out.push('seed '+seed+' '+rid+' repeated main '+defs.join(','));
   }
  }
  return out;
 });
 if(bad.length)throw new Error(bad.slice(0,8).join(' | '));
 return '40 seeds: four-room Warden lines, three-room Terminus, all story landmarks guaranteed';
};