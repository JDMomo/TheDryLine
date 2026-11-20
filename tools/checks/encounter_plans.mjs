// Authored encounter plans: main campaign rooms keep intentional enemy jobs across seeds.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
   const bad=[], expected={
    r1_gangway:['ballast_crab'],
    r1_dock:['ballast_crab','sapper','turnstile'],
    r2_roost:['harvester','ballast_crab'],
    r3_terraces:['mirage','brine_toad','mirage','ballast_crab'],
    r4_booths:['harvester','turnstile','sapper','harvester'],
    final_gearworks:['turnstile','sapper','mirage','harvester']
   };
   for(const seed of [2,9,27]){
     G.debug.newRun(seed);
     for(const [defId,want] of Object.entries(expected)){
       const n=Object.values(G.run.graph.nodes).find(x=>x.def===defId);
       if(!n){bad.push('seed '+seed+' missing '+defId);continue;}
       const def=G.roomDefs[defId], got=[];
       def.marks.forEach((m,i)=>{const c=n.content[i];if(m.ch==='E'&&c&&c.type==='enemy')got.push(c.id);});
       if(JSON.stringify(got)!==JSON.stringify(want))bad.push('seed '+seed+' '+defId+' '+got.join(',')+' wanted '+want.join(','));
     }
   }
   return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.slice(0,10).join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'authored campaign encounter jobs remain stable across seeds';
};