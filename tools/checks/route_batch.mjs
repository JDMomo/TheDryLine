// Batch route-design QA for the three post-Wreck regional showcase rooms.
import { pageTraverse } from './rooms.mjs';

async function traverse(page, id, seed) {
  await page.evaluate(seed => { G.debug.newRun(seed); G.debug.god(true); }, seed);
  return page.evaluate(pageTraverse, { id, abil: [], budget: 1500000, strict: true });
}

export default async ({ page }) => {
  const shape = await page.evaluate(() => {
    const count = (id, ch) => G.roomDefs[id].grid.reduce((n,row)=>n+[...row].filter(x=>x===ch).length,0);
    const mark = (id, ch) => {
      const m=G.roomDefs[id].marks.find(x=>x.ch===ch); return m && {c:m.c,r:m.r};
    };
    return {
      r2:{ vents:count('r2_shaft','v'), route:G.roomDefs.r2_shaft.route.join('>'), trunk:mark('r2_shaft','C') },
      r3:{ salt:count('r3_trestle','s'), crumble:count('r3_trestle','c'), spring:count('r3_trestle','j'), spikes:count('r3_trestle','^'), trunk:mark('r3_trestle','C') },
      r4:{ right:count('r4_concourse','>'), left:count('r4_concourse','<'), spring:count('r4_concourse','j'), spikes:count('r4_concourse','^'), trunk:mark('r4_concourse','C') },
      errors:G.errors.slice()
    };
  });
  const bad=[];
  if(shape.r2.route!=='bottom>top'||shape.r2.vents!==3||!shape.r2.trunk) bad.push('Signal Reef shaft shape wrong: '+JSON.stringify(shape.r2));
  if(!(shape.r3.salt>=25&&shape.r3.crumble>=4&&shape.r3.spring===1&&shape.r3.spikes===0&&shape.r3.trunk)) bad.push('Salt trestle shape wrong: '+JSON.stringify(shape.r3));
  if(!(shape.r4.right>=10&&shape.r4.left>=10&&shape.r4.spring===1&&shape.r4.spikes===0&&shape.r4.trunk)) bad.push('Ticket concourse shape wrong: '+JSON.stringify(shape.r4));
  if(shape.errors.length) bad.push('shape G.errors: '+shape.errors.join(' | '));

  for(const [id,seed] of [['r2_shaft',202],['r3_trestle',303],['r4_concourse',404]]) {
    const jobs=await traverse(page,id,seed), failed=jobs.filter(j=>!j.ok);
    if(!jobs.length) bad.push(id+' produced no traversal jobs');
    if(failed.length) bad.push(id+' traversal: '+failed.map(j=>j.name+': '+j.msg).join(' | '));
  }

  const motion=await page.evaluate(() => {
    const D=G.debug,T=G.C.T;
    const load=(defId,region,entry)=>{
      D.newRun(515); D.god(true);
      const id='qa_batch_'+defId, d=G.roomDefs[defId];
      G.run.graph.nodes[id]={id,def:defId,region,exits:{},content:d.marks.map(()=>null),seen:true};
      G.rooms.enter(id,entry); return G.players[0];
    };

    // Each authored Signal Reef vent must actually be able to launch a body from its CURRENT tile.
    const vents=[], d2=G.roomDefs.r2_shaft;
    let p=load('r2_shaft','r2',{side:'bottom'});
    const ventCells=[];d2.grid.forEach((row,r)=>{for(let c=0;c<row.length;c++)if(row[c]==='v')ventCells.push([r,c]);});
    for(const [r,c] of ventCells) {
      D.place(0,(c+0.5)*T,r*T,1); p=G.players[0]; p.onGround=true; p._ventCd=0; p.vy=0;
      let best=0, fired=false;
      for(let i=0;i<400;i++){D.step(1); best=Math.min(best,p.vy); if(p.vy<-500){fired=true;break;}}
      vents.push({r,c,fired,best});
    }

    const spring=(defId,region)=>{
      const d=G.roomDefs[defId],cell=[], trunk=d.marks.find(m=>m.ch==='C');
      d.grid.forEach((row,r)=>{for(let c=0;c<row.length;c++)if(row[c]==='j')cell.push([r,c]);});
      const [r,c]=cell[0]||[-1,-1], q=load(defId,region,{side:'left'});
      D.place(0,(c+0.5)*T,r*T,1); q.onGround=true; q.vy=0;
      let minY=q.y,best=0;
      for(let i=0;i<180;i++){D.step(1); minY=Math.min(minY,q.y); best=Math.min(best,q.vy);}
      const target=trunk?(trunk.r+1)*T+8:9*T+8;
      return {r,c,best,minY,target,reached:minY<=target};
    };
    const r3=spring('r3_trestle','r3'), r4=spring('r4_concourse','r4');
    return {vents,r3,r4,errors:G.errors.slice()};
  });
  if(motion.vents.some(v=>!v.fired)) bad.push('one or more Signal Reef vents never launched: '+JSON.stringify(motion.vents));
  if(!(motion.r3.best<-700&&motion.r3.reached)) bad.push('Salt survey spring pocket unreachable: '+JSON.stringify(motion.r3));
  if(!(motion.r4.best<-700&&motion.r4.reached)) bad.push('Ticket maintenance spring pocket unreachable: '+JSON.stringify(motion.r4));
  if(motion.errors.length) bad.push('motion G.errors: '+motion.errors.join(' | '));

  if(bad.length) throw new Error(bad.join(' ; '));
  return 'Signal steam shortcut, Salt safe/high/secret trestle, Ticket conveyor/canopy/secret concourse';
};
