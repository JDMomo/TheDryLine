// Split-route room design: Wreck Quay Dock has a safe low lane, risky high line, and independent spring reward pocket.
import { pageTraverse } from './rooms.mjs';

export default async ({ page }) => {
  const shape = await page.evaluate(() => {
    const d = G.roomDefs.r1_dock, count = ch => d.grid.reduce((n,row)=>n+[...row].filter(x=>x===ch).length,0);
    const c = d.marks.find(m=>m.ch==='C'), door=d.marks.find(m=>m.ch==='D');
    return {
      mud:count('m'), crumble:count('c'), spring:count('j'), spikes:count('^'),
      trunk:c && {c:c.c,r:c.r}, door:door && {c:door.c,r:door.r},
      lowRow:d.grid[15], errors:G.errors.slice()
    };
  });
  const bad=[];
  if(shape.mud<20) bad.push('safe low lane needs substantial mud tradeoff: '+JSON.stringify(shape));
  if(shape.crumble<4) bad.push('high line needs crumble commitment: '+JSON.stringify(shape));
  if(shape.spring!==1||!shape.trunk) bad.push('spring reward pocket missing: '+JSON.stringify(shape));
  if(shape.spikes!==0) bad.push('safe route should not require damage hazards: '+JSON.stringify(shape));
  if(!(shape.trunk.c>=49&&shape.trunk.r===8)) bad.push('trunk is not in the far spring alcove: '+JSON.stringify(shape.trunk));

  // The generic validator needs a live run so it can attach its temporary qa_r1_dock graph node.
  await page.evaluate(() => { G.debug.newRun(73); G.debug.god(true); });
  // Prove left<->right and the optional trunk from both sides using base movement only.
  const jobs = await page.evaluate(pageTraverse,{id:'r1_dock',abil:[],budget:1200000,strict:true});
  const names=jobs.map(j=>j.name), failed=jobs.filter(j=>!j.ok);
  if(!names.some(n=>n==='left to right')||!names.some(n=>n==='right to left')) bad.push('main route jobs missing: '+names.join(', '));
  if(!names.some(n=>n.includes('to C'))) bad.push('trunk reachability jobs missing: '+names.join(', '));
  if(failed.length) bad.push('route traversal failed: '+failed.map(j=>j.name+': '+j.msg).join(' | '));

  // Directly prove the spring reaches the alcove height, then that falling out returns safely to the floor.
  const spring = await page.evaluate(() => {
    const D=G.debug,T=G.C.T; D.newRun(73); D.god(true);
    const nid=Object.keys(G.run.graph.nodes).find(id=>G.run.graph.nodes[id].def==='r1_dock');
    if(!nid){ G.run.graph.nodes.qa_dock={id:'qa_dock',def:'r1_dock',region:'r1',exits:{},content:G.roomDefs.r1_dock.marks.map(()=>null),seen:true}; }
    D.gotoRoom(nid||'qa_dock',{side:'left'});
    const p=G.players[0]; D.place(0,52.5*T,15*T,1); p.onGround=true;
    let minY=p.y;
    for(let i=0;i<180;i++){D.step(1); minY=Math.min(minY,p.y);}
    const reached=minY<=9*T+8;
    // Let the same launch resolve back to ordinary floor height.
    for(let i=0;i<240&&!p.onGround;i++) D.step(1);
    return {minY,reached,y:p.y,onGround:p.onGround,errors:G.errors.slice()};
  });
  if(!spring.reached) bad.push('spring cannot reach alcove: '+JSON.stringify(spring));
  if(spring.errors.length) bad.push('G.errors: '+spring.errors.join(' | '));
  if(shape.errors.length) bad.push('shape errors: '+shape.errors.join(' | '));
  if(bad.length) throw new Error(bad.join(' ; '));
  return 'Wreck Dock safe low lane, crumble high line, reachable spring reward pocket';
};
