// Static watercolor bodies for Sapper/Harvester/Mirage: canonical sprite first, procedural body fallback, dynamic tells preserved.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
  const bad=[],ids=['sapper','harvester','mirage'];
  const wait=()=>new Promise(r=>setTimeout(r,20));
  for(let i=0;i<100&&G.spritesPending>0;i++)await wait();
  for(const id of ids){
    const d=G.enemyDefs[id],im=G.sprites['enemy_'+id];
    if(!d||!d.staticArt)bad.push(id+' missing staticArt contract');
    else if(!(d.staticArt.w>d.w&&d.staticArt.h>=d.h))bad.push(id+' visual box is not larger than hitbox');
    if(!im||!im.naturalWidth||!im.naturalHeight)bad.push(id+' static watercolor body did not decode');
  }
  G.debug.newRun(2323);G.debug.god(true);
  const flat=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.').join(''));
  if(!G.roomDefs.qa_static_enemy_art)G.defineRoom({id:'qa_static_enemy_art',region:'r3',kind:'main',map:flat});
  const nid='qa_static_enemy_art_node';G.run.graph.nodes[nid]={id:nid,def:'qa_static_enemy_art',region:'r3',exits:{},content:[],seen:true,parent:null};
  G.rooms.enter(nid,{side:'left'});const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=960;ctx.canvas.height=544;
  for(const [id,state,t] of [['sapper','wind',.35],['harvester','wind',.45],['mirage','tell',.25],['mirage','fade',.2],['mirage','dash',.2]]){
    const e=new G.Enemy(G.enemyDefs[id],300,480);e.set(state,t);e.t0=t*2;
    try{e.draw(ctx);}catch(err){bad.push(id+' '+state+' draw threw '+err.message);}
  }
  return {bad,errors:G.errors.slice(),sizes:Object.fromEntries(ids.map(id=>[id,G.enemyDefs[id].staticArt]))};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'canonical static watercolor bodies decode and preserve Sapper/Harvester/Mirage state overlays';
};