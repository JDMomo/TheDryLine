// Salt Cutting encounter pacing: enemies stay tied to the terrace/trestle section the player can currently read.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];D.newRun(3636);D.god(true);
  for(const defId of ['r3_brines','r3_trestle','r3_terraces','r3_spire']){
    const node=Object.values(G.run.graph.nodes).find(n=>n.def===defId);
    if(!node){bad.push(defId+' missing');continue;}
    G.rooms.enter(node.id,{side:'left'});const room=G.rooms.current,staged=room.enemies.filter(e=>e.wakeRange);
    if(staged.length!==room.enemies.length)bad.push(defId+' has unstaged enemies '+staged.length+'/'+room.enemies.length);
    const far=staged.sort((a,b)=>b.x-a.x)[0];if(!far)continue;
    const x0=far.x,y0=far.y;D.place(0,2*T,15*T,1);D.step(80);
    if(far.awake)bad.push(defId+' far enemy woke from entrance');
    if(Math.abs(far.x-x0)>3||Math.abs(far.y-y0)>90)bad.push(defId+' dormant enemy wandered');
    D.place(0,far.x-Math.min(180,far.wakeRange-30),far.y,1);D.step(15);
    if(!far.awake)bad.push(defId+' far encounter failed to wake locally');
  }
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Salt Cutting enemies wake by authored section rather than collapsing into one room-wide fight';
};