// Fixed side destinations must read as authored places, not bare utility closets.
export default async({page})=>{
 const r=await page.evaluate(()=>{
   const bad=[],ids=['r1_trial','r1_hold','r2_trial','r2_hold','r3_trial','r3_hold','r4_trial','r4_vault','side_standpipe'];
   for(const id of ids){
     const d=G.roomDefs[id];if(!d){bad.push('missing '+id);continue;}
     const decor=d.decor||[];
     if(decor.length<2)bad.push(id+' has too little authored decor');
     if(decor.length>4)bad.push(id+' has too much authored decor');
     for(const x of decor)if(!['lamp_decor','crate_decor','banner_decor'].includes(x.type))bad.push(id+' bad decor '+x.type);
   }
   G.debug.newRun(2424);G.debug.god(true);
   for(const id of ids){
     const n=Object.values(G.run.graph.nodes).find(n=>n.def===id);if(!n)continue;
     G.rooms.enter(n.id,{mark:0});
     for(const p of G.rooms.current.props.filter(p=>p.data&&p.data.decor)){
       if(p.prompt(G.players[0]))bad.push(id+' '+p.type+' became interactive');
       if(G.props.boxes(p,document.createElement('canvas').getContext('2d')).length)bad.push(id+' '+p.type+' has collision/layout box');
     }
   }
   return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'trials, guarded rooms and final standpipe carry sparse region-authored watercolor decor';
};