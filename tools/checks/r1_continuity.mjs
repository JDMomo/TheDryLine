// Wreck Quay visual continuity: emergency signs and service machinery repeat across the authored route.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
  const bad=[],wait=()=>new Promise(r=>setTimeout(r,20));
  for(let i=0;i<100&&G.spritesPending>0;i++)await wait();
  const wreck=G.roomDefs.r1_wreck,tun=G.roomDefs.r1_tunnel,gang=G.roomDefs.r1_gangway;
  if(!G.sprites.prop_furnace_decor||!G.sprites.prop_furnace_decor.naturalWidth)bad.push('painted service machine missing');
  if(!(wreck.decor||[]).some(x=>x.type==='furnace_decor'&&x.c===37))bad.push('Beached Deck service bay lacks furnace landmark');
  if(!wreck.signs||!wreck.signs.length)bad.push('Beached Deck service notice missing');
  if(!tun.signs||!tun.signs.length||!tun.marks.some(m=>m.ch==='?'))bad.push('Brine Tunnel emergency notice missing');
  if(!gang.signs||!gang.signs.length)bad.push('Arrival Gangway has no district signage');
  const route=[gang,wreck,tun];
  if(route.some(d=>!(d.decor||[]).some(x=>x.type==='lamp_decor'||x.type==='banner_decor')))bad.push('route lost repeated railway motif');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Wreck Quay repeats painted machinery, lamps and emergency signage across its authored route';
};