// Junction quality floor: it is a real two-storey authored place with five gates, a Keeper and an upper loop.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
   const D=G.debug,bad=[],def=G.roomDefs.junction;
   if(!def)return {bad:['junction room missing'],errors:G.errors.slice()};
   if(def.cols<120||def.rows<51)bad.push('junction is not a home area of at least 4x3 screens: '+def.cols+'x'+def.rows);
   const marks=ch=>def.marks.filter(m=>m.ch===ch);
   if(marks('G').length!==5)bad.push('junction needs five region gates, got '+marks('G').length);
   for(const ch of ['P','N','R','S'])if(!marks(ch).length)bad.push('junction missing marker '+ch);
   if(marks('K').length)bad.push('retired clipping-booth marker K returned to the authored Junction');
   const chars=def.grid.join('');
   if(chars.includes('^'))bad.push('junction contains damaging spikes');
   if(!chars.includes('='))bad.push('junction has no upper footbridge');
   const upper=def.grid.slice(0,34).reduce((n,row)=>n+[...row].filter(c=>c==='=').length,0);
   if(upper<50)bad.push('upper district too small: '+upper+' one-way tiles');

   D.newRun(4040);D.god(true);const room=G.rooms.current;
   if(room.def.id!=='junction')bad.push('new run did not begin in Junction');
   const types=room.props.map(p=>p.type);
   if(types.filter(x=>x==='gate').length!==5)bad.push('live Junction did not instantiate five gates: '+types.filter(x=>x==='gate').length);
   if(types.filter(x=>x==='guide').length!==1)bad.push('live Junction did not instantiate one Station Keeper');
   const keeper=room.props.find(p=>p.type==='guide');
   if(keeper){
     const pr=keeper.prompt(G.players[0]);
     if(!pr||!/Station Keeper/.test(pr[0]))bad.push('Keeper prompt missing');
     try{keeper.interact(G.players[0]);}catch(e){bad.push('Keeper interaction threw '+e.message);}
   }
   return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Junction is a '+'home area with five gates, upper walks, service bays and Station Keeper';
};