// Ticket Hall staging: each architectural bay stays quiet until approached; public flow remains retreatable.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];D.newRun(3737);D.god(true);
  for(const defId of ['r4_concourse','r4_booths','r4_switchyard','r4_gateline']){
    const node=Object.values(G.run.graph.nodes).find(n=>n.def===defId);
    if(!node){bad.push(defId+' missing');continue;}
    G.rooms.enter(node.id,{side:'left'});const room=G.rooms.current,staged=room.enemies.filter(e=>e.wakeRange);
    if(staged.length!==room.enemies.length)bad.push(defId+' has unstaged enemies '+staged.length+'/'+room.enemies.length);
    const far=staged.sort((a,b)=>b.x-a.x)[0];if(!far)continue;
    const x0=far.x;D.place(0,2*T,15*T,1);D.step(80);
    if(far.awake)bad.push(defId+' far bay woke from entrance');
    if(Math.abs(far.x-x0)>3)bad.push(defId+' dormant enemy crossed its bay');
    D.place(0,far.x-Math.min(180,far.wakeRange-30),far.y,1);D.step(15);
    if(!far.awake)bad.push(defId+' encounter failed to wake locally');
    D.place(0,2*T,15*T,1);D.step(30);
    if(!far.awake)bad.push(defId+' enemy returned dormant after retreat');
  }
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Ticket Hall encounters wake bay-by-bay without locking retreat';
};