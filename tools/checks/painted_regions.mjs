// Every campaign region now remains in the watercolor medium; r3/final use clearly tinted temporary source plates.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
  const bad=[],wait=()=>new Promise(r=>setTimeout(r,20)),ids=['hub','r1','r2','r3','r4','final'];
  for(let i=0;i<120&&!ids.every(id=>G.art.paintedBackgroundReady(id));i++)await wait();
  for(const id of ids){
    if(!G.art.hasPaintedBackground(id))bad.push(id+' has no painted background mapping');
    if(!G.art.paintedBackgroundReady(id))bad.push(id+' painted background did not load');
  }
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'hub and all five campaign regions remain watercolor-backed';
};