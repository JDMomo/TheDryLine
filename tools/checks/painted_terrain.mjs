// Painted terrain remains readable but uses translucent wash/ink rather than opaque debug blocks.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
  const bad=[],wait=()=>new Promise(r=>setTimeout(r,20));
  for(let i=0;i<100&&!G.art.paintedBackgroundReady('r2');i++)await wait();
  if(!G.art.hasPaintedBackground('r2'))bad.push('Signal Reef has no painted background');   // r2: the region whose plate is in assets
  G.debug.newRun(3131);G.debug.god(true);
  const n=Object.values(G.run.graph.nodes).find(n=>n.region==='r2'&&G.roomDefs[n.def].kind==='main');G.rooms.enter(n.id,{side:'left'});
  const cv=document.createElement('canvas');cv.width=960;cv.height=544;const ctx=cv.getContext('2d');
  const alphas=[],fills=[];const fr=ctx.fillRect.bind(ctx),st=ctx.stroke.bind(ctx);
  ctx.fillRect=(...a)=>{alphas.push(ctx.globalAlpha);fills.push(String(ctx.fillStyle));return fr(...a);};
  ctx.stroke=(...a)=>{alphas.push(ctx.globalAlpha);return st(...a);};
  try{G.art.tiles(ctx,G.art.palette('r2'));}catch(e){bad.push('painted terrain draw threw '+e.message);}
  if(!alphas.some(a=>a>0.45&&a<0.7))bad.push('no translucent solid wash recorded');
  if(!alphas.some(a=>a>0.8))bad.push('no strong exposed ink contour recorded');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'painted terrain uses translucent wash masses with strong exposed ink contours';
};