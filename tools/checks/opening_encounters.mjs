// Opening encounter choreography: teach one job at a time before Wreck Quay begins mixing jobs.
export default async({page})=>{
 const r=await page.evaluate(()=>{
   const bad=[],marks=id=>G.roomDefs[id].marks.filter(m=>m.ch==='E').map(m=>({c:m.c,r:m.r}));
   const gang=marks('r1_gangway'),wreck=marks('r1_wreck'),tun=marks('r1_tunnel');
   if(gang.length!==1||gang[0].c!==23)bad.push('Arrival Gangway should contain one Strider marker at c23: '+JSON.stringify(gang));
   const space=list=>list.slice().sort((a,b)=>a.c-b.c).some((m,i,a)=>i&&m.c-a[i-1].c<5);
   if(space(wreck))bad.push('Beached Deck ground encounters are clustered '+JSON.stringify(wreck));
   if(space(tun))bad.push('Brine Tunnel ground encounters are clustered '+JSON.stringify(tun));
   G.debug.newRun(2626);const g=G.run.graph,first=g.regions.r1.nodes.find(id=>!g.nodes[id].parent&&G.roomDefs[g.nodes[id].def].kind==='main');
   const n=g.nodes[first],en=n.content.filter(c=>c&&c.type==='enemy');
   if(n.def!=='r1_gangway')bad.push('Wreck opener changed to '+n.def);
   if(en.length!==1||en[0].id!=='ballast_crab')bad.push('Wreck opener runtime encounter '+JSON.stringify(en.map(e=>e.id)));
   const wreckNode=Object.values(g.nodes).find(n=>n.def==='r1_wreck');
   const jobs=wreckNode&&wreckNode.content.filter(c=>c&&c.type==='enemy').map(c=>c.id);
   for(const id of ['turnstile','ballast_crab','sapper'])if(!jobs||!jobs.includes(id))bad.push('Beached Deck missing job '+id);
   return {bad,gang,wreck,tun,jobs,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'opening teaches one Strider; later Wreck rooms separate armored, rusher, explosive and artillery beats';
};