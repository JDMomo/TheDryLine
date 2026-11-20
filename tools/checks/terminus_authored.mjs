// Terminus authored rhythm: quiet two-screen arrival, then steam gallery, then two-screen clockworks.
import { pageTraverse } from './rooms.mjs';
export default async({page})=>{
  const shape=await page.evaluate(()=>{
    const a=G.roomDefs.final_buffers,v=G.roomDefs.final_vents,g=G.roomDefs.final_gearworks;
    const marks=id=>G.roomDefs[id].marks.map(m=>m.ch);
    return {
      buffers:{w:a.w,enemies:marks('final_buffers').filter(x=>x==='E'||x==='F'||x==='L').length,sign:marks('final_buffers').includes('?')},
      vents:{w:v.w,spring:v.grid.some(r=>r.includes('j')),vent:v.grid.some(r=>r.includes('v'))},
      gears:{w:g.w,crumble:g.grid.reduce((n,r)=>n+[...r].filter(x=>x==='c').length,0)},
      errors:G.errors.slice()
    };
  });
  const bad=[];
  if(shape.buffers.w!==2||shape.buffers.enemies>2||!shape.buffers.sign)bad.push('Last Buffers does not read as quiet 2-screen arrival '+JSON.stringify(shape.buffers));
  if(!shape.vents.spring||!shape.vents.vent)bad.push('Steam Gallery lost its spring/vent identity');
  if(shape.gears.w!==2||shape.gears.crumble<2)bad.push('Clockworks lost its long machine-core identity '+JSON.stringify(shape.gears));
  await page.evaluate(()=>{G.debug.newRun(1701);G.debug.god(true);});
  for(const id of ['final_buffers','final_vents','final_gearworks']){
    const jobs=await page.evaluate(pageTraverse,{id,abil:[],budget:1500000,strict:true});
    for(const j of jobs)if(!j.ok)bad.push(id+' '+j.name+': '+j.msg);
  }
  if(shape.errors.length)bad.push('G.errors '+shape.errors.join(' | '));
  if(bad.length)throw new Error(bad.slice(0,8).join(' | '));
  return 'Terminus rhythm: quiet arrival -> steam maintenance -> clockworks core';
};