// Authored encounter staging: enemies wait visibly in their section, then wake permanently when approached.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];D.newRun(3232);D.god(true);
  const node=Object.values(G.run.graph.nodes).find(n=>n.def==='r1_dock');
  if(!node)return {bad:['r1_dock missing'],errors:G.errors.slice()};
  G.rooms.enter(node.id,{side:'left'});const room=G.rooms.current;
  const staged=room.enemies.filter(e=>e.wakeRange);
  if(staged.length!==3)bad.push('expected 3 staged Dock enemies, got '+staged.length);
  const far=staged.sort((a,b)=>b.x-a.x)[0],x0=far&&far.x;
  D.place(0,2*T,15*T,1);D.step(120);
  if(far&&(far.awake||Math.abs(far.x-x0)>3))bad.push('far encounter moved/woke before being approached');
  if(far){
    D.place(0,far.x-far.wakeRange+35,far.y,1);D.step(12);
    if(!far.awake)bad.push('enemy did not wake when party entered its read range');
    const awakeX=far.x;D.place(0,2*T,15*T,1);D.step(60);
    if(!far.awake)bad.push('enemy returned to dormant after retreat');
    if(!Number.isFinite(awakeX))bad.push('awake enemy state invalid');
  }
  const content=node.content.filter(c=>c&&c.type==='enemy');
  if(content.some(c=>!c.wakeRange))bad.push('runtime content lost authored wake ranges');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Wreck Quay enemies remain visible/dormant until approached, then wake permanently';
};