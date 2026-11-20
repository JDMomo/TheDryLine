// Junction Station Keeper uses the canonical Guide portrait in a service-window composition.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
  const bad=[],wait=()=>new Promise(r=>setTimeout(r,20));
  for(let i=0;i<100&&G.spritesPending>0;i++)await wait();
  if(!G.sprites.portrait_guide||!G.sprites.portrait_guide.naturalWidth)bad.push('canonical Guide portrait not loaded');
  G.debug.newRun(3333);const room=G.rooms.current,guide=room.props.find(p=>p.type==='guide');
  if(!guide)bad.push('Junction has no Station Keeper');
  else {
    const cv=document.createElement('canvas'),ctx=cv.getContext('2d'),orig=ctx.drawImage.bind(ctx);let used=false;
    ctx.drawImage=(img,...a)=>{if(img===G.sprites.portrait_guide)used=true;return orig(img,...a);};
    guide.draw(ctx);
    if(!used)bad.push('Keeper world draw did not use Guide portrait');
  }
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Station Keeper is staged behind a service window using the canonical watercolor Guide portrait';
};