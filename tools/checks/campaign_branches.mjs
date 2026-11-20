// Campaign branches are stable places, not seeded utility closets.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[],seen={};
  for(let seed=1;seed<=40;seed++){
    G.debug.newRun(seed);const g=G.run.graph;
    for(const reg of Object.values(G.regionDefs)){
      const rg=g.regions[reg.id], branches=rg.nodes.map(id=>g.nodes[id]).filter(n=>n.parent);
      const defs=branches.map(n=>n.def).sort();(seen[reg.id]||(seen[reg.id]=new Set())).add(defs.join(','));
      const shared=defs.filter(id=>/^side_(ticket|kiosk)/.test(id));
      if(shared.length)bad.push('seed '+seed+' '+reg.id+' random service branch '+shared.join(','));
      if(reg.ability&&!branches.some(n=>G.roomDefs[n.def].kind==='trial'))bad.push('seed '+seed+' '+reg.id+' missing trial');
      if(reg.fixedItem&&!branches.some(n=>G.roomDefs[n.def].kind==='branch'&&G.roomDefs[n.def].region===reg.pool))bad.push('seed '+seed+' '+reg.id+' missing own hold');
      if(reg.id==='final'&&!branches.some(n=>n.def==='side_standpipe'))bad.push('seed '+seed+' final missing standpipe stop');
    }
    const c=G.worldgen.census(g);
    if(c.tickets!==1||c.kioskRooms!==1||c.kioskWares!==3)bad.push('seed '+seed+' Junction services census '+JSON.stringify({tickets:c.tickets,kioskRooms:c.kioskRooms,kioskWares:c.kioskWares}));
  }
  for(const [rid,sets] of Object.entries(seen))if(sets.size!==1)bad.push(rid+' branch set changes by seed: '+[...sets].join(' / '));
  return {bad,sets:Object.fromEntries(Object.entries(seen).map(([k,v])=>[k,[...v]])),errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.slice(0,10).join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'campaign trials/holds are fixed; ticket and kiosk services stay in the Junction';
};