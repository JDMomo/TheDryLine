// Authored watercolor decoration is visual-only: it must instantiate without prompts or collision/seed effects.
export default async ({page})=>{
  const r=await page.evaluate(()=>{
    const D=G.debug,bad=[],want={
      junction:['crate_decor','banner_decor'],
      r1_gangway:['crate_decor','banner_decor'],
      r1_dock:['crate_decor','banner_decor'],
      r1_wreck:['crate_decor','banner_decor'],
      r1_tunnel:['crate_decor'],
      r1_arena:['banner_decor']
    };
    D.newRun(616);D.god(true);
    for(const [defId,types] of Object.entries(want)){
      const node=Object.values(G.run.graph.nodes).find(n=>n.def===defId);
      if(!node){bad.push('missing authored node '+defId);continue;}
      G.rooms.enter(node.id,defId==='junction'?{start:true}:{side:'left'});
      const decor=G.rooms.current.props.filter(p=>p.data&&p.data.decor);
      for(const type of types)if(!decor.some(p=>p.type===type))bad.push(defId+' missing '+type);
      for(const p of decor){
        if(p.prompt(G.players[0]))bad.push(defId+' '+p.type+' has prompt');
        const boxes=G.props.boxes(p,document.getElementById('game').getContext('2d'));
        if(boxes.length)bad.push(defId+' '+p.type+' contributes layout/collision boxes');
      }
    }
    return {bad,errors:G.errors.slice()};
  });
  if(r.bad.length)throw new Error(r.bad.join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return 'watercolor freight/banner decor instantiates across Junction/Wreck without gameplay collision';
};