// Terminus escalation: sparse recognition -> mixed traversal -> densest clockworks, all locally staged.
export default async({page})=>{
 const res=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[],counts={};D.newRun(3838);D.god(true);
  for(const defId of ['final_buffers','final_vents','final_gearworks']){
    const node=Object.values(G.run.graph.nodes).find(n=>n.def===defId);
    if(!node){bad.push(defId+' missing');continue;}
    G.rooms.enter(node.id,{side:'left'});const room=G.rooms.current,staged=room.enemies.filter(e=>e.wakeRange);
    counts[defId]=room.enemies.length;
    if(staged.length!==room.enemies.length)bad.push(defId+' has unstaged final enemies '+staged.length+'/'+room.enemies.length);
    const far=staged.sort((a,b)=>b.x-a.x)[0]; if(!far)continue;
    const x0=far.x;D.place(0,2*T,15*T,1);D.step(70);
    if(far.awake)bad.push(defId+' far encounter woke at entrance');
    if(Math.abs(far.x-x0)>3)bad.push(defId+' dormant encounter wandered');
    D.place(0,far.x-Math.min(180,far.wakeRange-30),far.y,1);D.step(15);
    if(!far.awake)bad.push(defId+' encounter failed to wake in its chamber');
  }
  if(!(counts.final_buffers<=2&&counts.final_vents>=counts.final_buffers&&counts.final_gearworks>=counts.final_vents))
    bad.push('Terminus density does not escalate '+JSON.stringify(counts));
  return {bad,counts,errors:G.errors.slice()};
 });
 if(res.bad.length)throw new Error(res.bad.join(' | '));
 if(res.errors.length)throw new Error('G.errors: '+res.errors.join(' | '));
 return 'Terminus encounter density escalates '+JSON.stringify(res.counts)+' with local wake staging';
};