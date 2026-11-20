// Wreck Quay vertical-slice arena: approach vestibule, authored threshold and unchanged escape geometry.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
   const D=G.debug,bad=[],d=G.roomDefs.r1_arena,T=G.C.T;
   if(!d) return {bad:['r1_arena missing'],errors:G.errors.slice()};
   if(d.w!==2||d.cols!==60)bad.push('Toll House is not two screens wide');
   if(d.doorCol!==20)bad.push('boss threshold col '+d.doorCol+' wanted 20');
   if(d.floorX[0]!==21*T||d.floorX[1]!==59*T)bad.push('fight floor '+JSON.stringify(d.floorX));
   for(const [c0,c1] of [[21,24],[55,58]])for(let c=c0;c<=c1;c++)if(d.grid[12][c]!=='=')bad.push('escape shelf missing at '+c);
   if(!d.marks.some(m=>m.ch==='?'&&m.c<20))bad.push('vestibule has no pre-fight notice');
   D.newRun(1717);D.god(true);
   if(!D.startBoss('r1'))bad.push('Tollkeeper failed to start');
   else {
     const room=G.rooms.current,b=room.boss;
     if(!b)bad.push('Tollkeeper absent in live Toll House');
     else if(!(b.maxX-b.minX>700&&b.maxX-b.minX<1300))bad.push('fight lane wrong width '+Math.round(b.maxX-b.minX));
   }
   return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Toll House has a quiet vestibule, authored closing threshold and tested fight lane';
};