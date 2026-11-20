// Painted concept plates: assets load in-browser and only intended regions opt into them.
export default async ({page})=>{
  const r=await page.evaluate(async()=>{
    const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
    const have=Object.fromEntries(['hub','r1','r2','r3','r4','final'].map(x=>[x,G.art.hasPaintedBackground(x)]));
    if(location.protocol!=='file:')for(let i=0;i<80&&!['hub','r1','r2','r4'].every(x=>G.art.paintedBackgroundReady(x));i++)await wait();
    const bad=[];
    for(const x of ['hub','r1','r2','r4'])if(!have[x])bad.push(x+' painted background is not configured');
    for(const x of ['r3','final'])if(have[x])bad.push(x+' should remain on fallback until matching art exists');
    const cv=document.createElement('canvas');cv.width=G.C.W;cv.height=G.C.H;const ctx=cv.getContext('2d');
    for(const x of ['hub','r1','r2','r3','r4','final']){try{G.art.backdrop(ctx,G.art.palette(x),240,1.2,x);}catch(e){bad.push(x+' backdrop threw '+e.message);}}
    return {bad,have,errors:G.errors.slice()};
  });
  if(r.bad.length)throw new Error(r.bad.join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return 'watercolor concept plates configured for Junction/Wreck/Signal/Ticket; Salt/Terminus keep fallback';
};