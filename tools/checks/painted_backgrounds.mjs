// Painted concept plates: assets load in-browser and only intended regions opt into them.
import fs from 'fs';
// A region expects its plate only when the file is in assets (wreck_quay.jpg and ticket_hall.jpg await a re-export: docs/art/ASSET_LIST.md).
const FILES={hub:'ticket_hall.jpg',r1:'wreck_quay.jpg',r2:'signal_reef.jpg',r4:'ticket_hall.jpg'};
export default async ({page})=>{
  const want=Object.keys(FILES).filter(x=>fs.existsSync(new URL('../../assets/backgrounds/'+FILES[x],import.meta.url)));
  const r=await page.evaluate(async(want)=>{
    const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
    const have=Object.fromEntries(['hub','r1','r2','r3','r4','final'].map(x=>[x,G.art.hasPaintedBackground(x)]));
    if(location.protocol!=='file:')for(let i=0;i<80&&!want.every(x=>G.art.paintedBackgroundReady(x));i++)await wait();
    const bad=[];
    for(const x of want)if(!have[x])bad.push(x+' painted background is not configured');
    for(const x of ['r3','final'])if(have[x])bad.push(x+' should remain on fallback until matching art exists');
    const cv=document.createElement('canvas');cv.width=G.C.W;cv.height=G.C.H;const ctx=cv.getContext('2d');
    for(const x of ['hub','r1','r2','r3','r4','final']){try{G.art.backdrop(ctx,G.art.palette(x),240,1.2,x);}catch(e){bad.push(x+' backdrop threw '+e.message);}}
    return {bad,have,errors:G.errors.slice()};
  },want);
  if(r.bad.length)throw new Error(r.bad.join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return 'painted plates for '+want.join(', ')+'; other regions use the code-drawn fallback';
};