// Authored campaign scenery: every canonical main room has visual-only watercolor decor, but never enough to obscure play.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[],counts={};
  for(const reg of Object.values(G.regionDefs)){
   const seq=reg.sequence||[];counts[reg.id]=[];
   for(const id of seq){
    const d=G.roomDefs[id],decor=d&&d.decor||[];counts[reg.id].push([id,decor.length]);
    if(!d){bad.push('missing '+id);continue;}
    if(decor.length<2)bad.push(id+' has too little authored decor '+decor.length);
    if(decor.length>6)bad.push(id+' has too much foreground decor '+decor.length);
    for(const x of decor)if(!['lamp_decor','crate_decor','banner_decor','furnace_decor'].includes(x.type))bad.push(id+' unknown decor '+x.type);
   }
  }
  G.debug.newRun(2020);G.debug.god(true);
  for(const rid of Object.keys(counts))for(const [id] of counts[rid]){
    const n=Object.values(G.run.graph.nodes).find(n=>n.def===id);if(!n)continue;
    G.rooms.enter(n.id,{side:'left'});
    for(const p of G.rooms.current.props.filter(p=>p.data&&p.data.decor)){
      if(p.prompt(G.players[0]))bad.push(id+' '+p.type+' became interactive');
      if(G.props.boxes(p,document.createElement('canvas').getContext('2d')).length)bad.push(id+' '+p.type+' has layout box');
    }
  }
  return {bad,counts,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'canonical main rooms carry sparse non-interactive watercolor foreground compositions';
};