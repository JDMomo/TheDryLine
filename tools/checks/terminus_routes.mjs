// Terminus terrain remix: final rooms use learned mechanics without making the required route lethal.
import { pageTraverse } from './rooms.mjs';
export default async ({page})=>{
  const shape=await page.evaluate(()=>{
    const count=(id,ch)=>G.roomDefs[id].grid.reduce((n,row)=>n+[...row].filter(x=>x===ch).length,0);
    return {
      buffers:{salt:count('final_buffers','s'),mud:count('final_buffers','m'),spikes:count('final_buffers','^')},
      vents:{spring:count('final_vents','j'),vent:count('final_vents','v'),spikes:count('final_vents','^')},
      gears:{right:count('final_gearworks','>'),left:count('final_gearworks','<'),crumble:count('final_gearworks','c'),spikes:count('final_gearworks','^')},
      errors:G.errors.slice()
    };
  });
  const bad=[];
  if(!(shape.buffers.salt>=8&&shape.buffers.mud>=4&&shape.buffers.spikes===0))bad.push('buffers remix wrong '+JSON.stringify(shape.buffers));
  if(!(shape.vents.spring===1&&shape.vents.vent===1&&shape.vents.spikes===0))bad.push('steam gallery wrong '+JSON.stringify(shape.vents));
  if(!(shape.gears.right>=20&&shape.gears.left>=10&&shape.gears.crumble>=4&&shape.gears.spikes===0))bad.push('clockworks remix wrong '+JSON.stringify(shape.gears));
  if(shape.errors.length)bad.push('G.errors '+shape.errors.join(' | '));
  for(const [id,seed] of [['final_buffers',901],['final_vents',902],['final_gearworks',903]]){
    await page.evaluate(seed=>{G.debug.newRun(seed);G.debug.god(true);},seed);
    const jobs=await page.evaluate(pageTraverse,{id,abil:[],budget:1400000,strict:true});
    const fail=jobs.filter(j=>!j.ok);if(fail.length)bad.push(id+': '+fail.map(j=>j.name+' '+j.msg).join(' | '));
  }
  if(bad.length)throw new Error(bad.join(' ; '));
  return 'Terminus remixes salt/mud, spring/steam, and conveyor/crumble with base-safe routes';
};