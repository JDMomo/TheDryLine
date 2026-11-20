// Tar: solid until spark/fire; burn persists in live room only.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];D.newRun(1414);D.god(true);
  const g=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.'));
  g[13][14]='t';g[14][14]='t';
  if(!G.roomDefs.qa_tar)G.defineRoom({id:'qa_tar',region:'r1',kind:'main',map:g.map(x=>x.join(''))});
  const add=id=>{G.run.graph.nodes[id]={id,def:'qa_tar',region:'r1',exits:{},content:[],seen:true,parent:null};G.rooms.enter(id,{side:'left'});};
  add('qa_tar_node');
  if(!G.tiles.solid(14,13))bad.push('tar not solid');
  const n=G.tiles.burnTar(14.5*T,13.5*T,30);
  if(n<1||G.tiles.at(14,13)!=='.'||G.tiles.solid(14,13))bad.push('direct burn failed');
  if(G.roomDefs.qa_tar.grid[13][14]!=='t')bad.push('template mutated');
  G.rooms.enter('qa_tar_node',{side:'left'});if(G.tiles.at(14,13)!=='.')bad.push('live burn did not persist');
  add('qa_tar_node2');G.materials.reset();
  G.combat.shoot({x:13.3*T,y:13.5*T,vx:220,life:.5,r:5,itemId:'flint_tether',cls:'ground',mat:['spark'],color:'#fff'});
  for(let i=0;i<100&&G.tiles.at(14,13)==='t';i++)D.step(1);
  if(G.tiles.at(14,13)==='t')bad.push('spark shot did not burn tar');
  if(!(G.materials.fired.Burn>0))bad.push('Burn feedback missing');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'tar burns to spark/fire and remains per-room state';
};