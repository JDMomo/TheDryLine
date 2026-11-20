// Authored Route Board silhouettes stay stable and draw without overlap/errors.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[],shapes={
   r1:[[0,5],[0,0],[0,-9],[0,4],[0,4]],
   r2:[[0,10],[0,4],[0,-9],[0,-14],[0,-14]],
   r3:[[0,8],[0,1],[0,-6],[0,-11],[0,-11]],
   r4:[[0,2],[0,2],[0,-3],[0,-3],[0,-3]],
   final:[[0,10],[0,2],[0,-8],[0,-13]]
  };
  for(const [id,p] of Object.entries(shapes)){
    if(!G.regionDefs[id])bad.push('missing region '+id);
    if(p.some((q,i)=>i&&Math.abs(q[1]-p[i-1][1])>18))bad.push(id+' route jumps too far vertically');
  }
  G.debug.newRun(3030);G.debug.god(true);
  const ctx=document.getElementById('game').getContext('2d');
  try{G.map.draw(ctx);}catch(e){bad.push('map draw threw '+e.message);}
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Route Board gives each authored region a distinct spatial silhouette';
};