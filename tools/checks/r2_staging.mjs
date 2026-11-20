// Signal Reef staging keeps aerial/ground encounters local to their authored sections.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];D.newRun(3434);D.god(true);
  const node=Object.values(G.run.graph.nodes).find(n=>n.def==='r2_spire');
  if(!node)return {bad:['r2_spire missing'],errors:G.errors.slice()};
  G.rooms.enter(node.id,{side:'left'});const room=G.rooms.current;
  const staged=room.enemies.filter(e=>e.wakeRange),fly=staged.find(e=>e.def.flying),ground=staged.filter(e=>!e.def.flying);
  if(staged.length!==3)bad.push('Coral Stair staged '+staged.length+' enemies, wanted 3');
  if(!fly)bad.push('first aerial read is not staged');
  D.place(0,2*T,15*T,1);const sx=staged.map(e=>e.x);D.step(90);
  staged.forEach((e,i)=>{if(e.awake)bad.push(e.id+' woke before its section');if(Math.abs(e.x-sx[i])>3)bad.push(e.id+' wandered while dormant');});
  if(fly){
    D.place(0,fly.x-Math.min(fly.wakeRange-25,180),fly.y+fly.h/2,1);D.step(15);
    if(!fly.awake)bad.push('gull did not wake when approached');
  }
  if(!ground.length)bad.push('ground jobs missing from Coral Stair');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Signal Reef ground and aerial encounters remain local until the party reads their section';
};