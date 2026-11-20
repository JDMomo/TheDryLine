// Authored campaign contract: stable macro spaces, seeded encounters/loot, intentional trial/fixed-token side-room parents.
import { pageTraverse } from './rooms.mjs';

const PLAN={
  r1:{seq:['r1_gangway','r1_dock','r1_wreck','r1_tunnel'],trial:'r1_wreck',own:'r1_tunnel'},
  r2:{seq:['r2_spire','r2_shelves','r2_shaft','r2_tower'],trial:'r2_shaft',own:'r2_tower'},
  r3:{seq:['r3_brines','r3_terraces','r3_trestle','r3_cutting'],trial:'r3_trestle',own:'r3_cutting'},
  r4:{seq:['r4_concourse','r4_booths','r4_switchyard','r4_clocks'],trial:'r4_switchyard',own:'r4_clocks'},
  final:{seq:['final_buffers','final_vents','final_gearworks']}
};
export default async({page})=>{
  const r=await page.evaluate(PLAN=>{
    const D=G.debug,bad=[],samples=[];
    for(const seed of [1,2,5,9,33,77,121]){
      D.newRun(seed);const g=G.run.graph,signature={};
      const hub=G.roomDefs[G.run.graph.nodes[g.hub].def];
      if(hub.id!=='junction'||hub.w!==3||hub.cols!==90)bad.push('seed '+seed+' Junction is not 3 screens / 90 cols');
      const gates=G.run.rooms[g.hub].props.filter(p=>p.type==='gate').map(p=>Math.round(p.x/G.C.T));
      if(gates.length!==5)bad.push('seed '+seed+' Junction gate count '+gates.length);
      for(const [rid,p] of Object.entries(PLAN)){
        const rg=g.regions[rid],mainIds=rg.nodes.filter(id=>G.roomDefs[g.nodes[id].def].kind==='main');
        const defs=mainIds.map(id=>g.nodes[id].def);signature[rid]=defs;
        if(JSON.stringify(defs)!==JSON.stringify(p.seq))bad.push('seed '+seed+' '+rid+' spine '+defs.join('>'));
        if(p.trial){
          const trial=rg.nodes.map(id=>g.nodes[id]).find(n=>G.roomDefs[n.def].kind==='trial');
          if(!trial||!trial.parent||g.nodes[trial.parent].def!==p.trial)bad.push('seed '+seed+' '+rid+' trial parent '+(trial&&trial.parent&&g.nodes[trial.parent].def));
        }
        if(p.own){
          const own=rg.own&&g.nodes[rg.own];
          if(!own||!own.parent||g.nodes[own.parent].def!==p.own)bad.push('seed '+seed+' '+rid+' guarded branch parent '+(own&&own.parent&&g.nodes[own.parent].def));
        }
      }
      samples.push(signature);
    }
    // The spaces stay fixed, but encounter content must still vary by seed.
    D.newRun(1);const a=JSON.stringify(Object.values(G.run.graph.nodes).map(n=>n.content.map(c=>c&&[c.type,c.id,c.elite])));
    D.newRun(2);const b=JSON.stringify(Object.values(G.run.graph.nodes).map(n=>n.content.map(c=>c&&[c.type,c.id,c.elite])));
    if(a===b)bad.push('seed no longer changes encounter/content rolls');
    return {bad,samples,errors:G.errors.slice()};
  },PLAN);
  const bad=r.bad.slice();
  if(r.errors.length)bad.push('G.errors: '+r.errors.join(' | '));

  // The two rebuilt Wreck spaces must be reversible with base movement, with their sign/trial door reachable.
  for(const id of ['r1_gangway','r1_wreck']){
    await page.evaluate(()=>{G.debug.newRun(909);G.debug.god(true);});
    const jobs=await page.evaluate(pageTraverse,{id,abil:[],budget:1400000,strict:true});
    for(const j of jobs)if(!j.ok)bad.push(id+' '+j.name+': '+j.msg);
  }
  if(bad.length)throw new Error(bad.slice(0,10).join(' | '));
  return '7 seeds keep authored spines/branch parents; Wreck opening traverses both ways; encounters still vary';
};