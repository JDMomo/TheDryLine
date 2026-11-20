// Elite encounter QA: deterministic, never onboarding, max one per room, visible runtime stat/reward change.
export default async ({page})=>{
  const r=await page.evaluate(()=>{
    const D=G.debug,bad=[],counts={r1:0,r2:0,r3:0,r4:0,final:0};
    const sig=[];
    for(let seed=1;seed<=120;seed++){
      D.newRun(seed);const g=G.run.graph,ss=[];
      for(const [rid,rg] of Object.entries(g.regions)){
        const first=rg.first;
        for(const id of rg.nodes){
          const n=g.nodes[id], elites=n.content.filter(c=>c&&c.type==='enemy'&&c.elite);
          if(id===first&&elites.length)bad.push('seed '+seed+' '+rid+' first room has elite');
          if(elites.length>1)bad.push('seed '+seed+' '+n.def+' has '+elites.length+' elites');
          counts[rid]+=elites.length;
          if(elites.length)ss.push([rid,n.def,elites[0].id]);
        }
      }
      sig.push(JSON.stringify(ss));
    }
    if(counts.r4===0||counts.final===0)bad.push('no later-region elites across 120 seeds '+JSON.stringify(counts));
    D.newRun(77);const before=JSON.stringify(Object.values(G.run.graph.nodes).map(n=>n.content.map(c=>c&&[c.id,c.elite])));
    D.newRun(77);const after=JSON.stringify(Object.values(G.run.graph.nodes).map(n=>n.content.map(c=>c&&[c.id,c.elite])));
    if(before!==after)bad.push('elite rolls are not seed deterministic');

    // Runtime contract independent of a lucky graph roll.
    const flat=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.').join(''));
    if(!G.roomDefs.qa_elite_flat)G.defineRoom({id:'qa_elite_flat',region:'r4',kind:'main',map:flat});
    const qid='qa_elite_flat_node';G.run.graph.nodes[qid]={id:qid,def:'qa_elite_flat',region:'r4',exits:{},content:[],seen:true,parent:null};
    G.rooms.enter(qid,{side:'left'});const room=G.rooms.current;room.enemies=[];G.pickups.length=0;
    const d=G.enemyDefs.sapper, normal=new G.Enemy(d,300,15*G.C.T), elite=new G.Enemy(d,400,15*G.C.T);elite.makeElite();
    if(!(elite.hp>normal.hp&&elite.aggro>normal.aggro&&elite.elite))bad.push('makeElite did not strengthen/mark enemy');
    const min=d.shards[0];elite.damage(9999,elite.x-20);D.step(1);
    const drop=G.pickups.reduce((n,k)=>n+k.value,0);if(drop<min+2)bad.push('elite bonus scrip missing '+drop);
    return {bad,counts,drop,errors:G.errors.slice()};
  });
  if(r.bad.length)throw new Error(r.bad.slice(0,8).join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return 'elites deterministic; never onboarding; max one/room; later regions '+JSON.stringify(r.counts);
};