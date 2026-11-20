// Canonical watercolor furnace decor is visual-only and used only in mechanical authored rooms.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
  const bad=[],wait=()=>new Promise(r=>setTimeout(r,20));
  for(let i=0;i<100&&G.spritesPending>0;i++)await wait();
  if(!G.sprites.prop_furnace_decor||!G.sprites.prop_furnace_decor.naturalWidth)bad.push('furnace watercolor asset did not decode');
  const want=['r2_shaft','r2_tower','r4_switchyard','final_vents','final_gearworks'];
  for(const id of want){
    const d=G.roomDefs[id],xs=d&&d.decor||[];
    if(!xs.some(x=>x.type==='furnace_decor'))bad.push(id+' missing furnace landmark');
  }
  G.debug.newRun(2828);G.debug.god(true);
  const n=Object.values(G.run.graph.nodes).find(n=>n.def==='r2_shaft');G.rooms.enter(n.id,{side:'bottom'});
  const p=G.rooms.current.props.find(p=>p.type==='furnace_decor');
  if(!p)bad.push('live furnace missing');
  else {
    if(p.prompt(G.players[0]))bad.push('furnace became interactive');
    if(G.props.boxes(p,document.createElement('canvas').getContext('2d')).length)bad.push('furnace has gameplay box');
  }
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'watercolor furnace landmarks decode and remain visual-only';
};