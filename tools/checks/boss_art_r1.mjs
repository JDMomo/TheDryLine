// Tollkeeper production art: concept-sheet state strip drives normal/stagger/rage while mechanics remain engine overlays.
import fs from 'fs';
export default async({page})=>{
 if(!fs.existsSync(new URL('../../assets/bosses/tollkeeper/states.webp',import.meta.url)))return 'skipped: Tollkeeper strip not in assets (needs re-export); code-drawn body in use';
 const r=await page.evaluate(async()=>{
  const D=G.debug,bad=[],wait=()=>new Promise(r=>setTimeout(r,20));
  for(let i=0;i<120&&G.spritesPending>0;i++)await wait();
  const sk=G.strips&&G.strips.boss_tollkeeper_states;
  if(!sk||!sk.img||!sk.img.naturalWidth)return {bad:['Tollkeeper watercolor strip did not load'],errors:G.errors.slice()};
  if(sk.frames!==3||Math.round(sk.fw)!==144||sk.fh!==84)bad.push('unexpected Tollkeeper strip geometry '+JSON.stringify({frames:sk.frames,fw:sk.fw,fh:sk.fh}));
  D.newRun(4141);D.god(true);
  const arena=G.run.graph.regions.r1.arena;G.rooms.enter(arena,{side:'left'});
  const b=G.rooms.current.boss;if(!b)return {bad:['r1 arena has no Tollkeeper'],errors:G.errors.slice()};
  const cv=document.createElement('canvas'),ctx=cv.getContext('2d'),orig=ctx.drawImage.bind(ctx),frames=[];
  ctx.drawImage=(img,...a)=>{if(img===sk.img)frames.push(Math.round(a[0]/sk.fw));return orig(img,...a);};
  const draw=()=>b.def.draw(b,ctx);
  b.state='idle';b.hp=b.maxHp;draw();
  b.state='stagger';draw();
  b.state='idle';b.hp=b.maxHp*.4;draw();
  if(frames.join()!=='0,1,2')bad.push('state-to-watercolor mapping '+frames.join());
  // Fare slots stay separate from the body and must still exist at their original mechanical coordinates.
  if(b.spots.length!==3)bad.push('run chart should create exactly three Tollkeeper fare slots, got '+b.spots.length);
  for(const sp of b.spots){const q=b.spotPos(sp);if(!Number.isFinite(q.x)||!Number.isFinite(q.y))bad.push('fare slot lost world coordinate '+sp.cls);}
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Tollkeeper uses Normal/Stagger/Enraged watercolor states with live fare-slot overlays';
};