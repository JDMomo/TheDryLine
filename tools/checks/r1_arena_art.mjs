// Toll House presentation: painted framing stays on the fight edges and leaves the charge lane visually open.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[],d=G.roomDefs.r1_arena,decor=d.decor||[];
  if(!decor.some(x=>x.type==='furnace_decor'&&x.c<30))bad.push('Toll House lacks painted service machinery at its entry edge');
  if(decor.filter(x=>x.type==='lamp_decor').length<2)bad.push('Toll House lacks paired edge lamps');
  if(decor.some(x=>x.c>=30&&x.c<=52))bad.push('decor intrudes into central boss charge lane '+JSON.stringify(decor.filter(x=>x.c>=30&&x.c<=52)));
  const boss=d.marks.find(m=>m.ch==='B');
  if(!boss||boss.c<38)bad.push('Tollkeeper is not framed deep in the fight space');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Toll House uses painted edge framing while the central Warden lane stays clear';
};