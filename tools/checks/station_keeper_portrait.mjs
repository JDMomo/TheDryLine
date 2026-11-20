// Station Keeper dialogue uses the canonical watercolor Guide portrait without changing ordinary banners.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
  const bad=[],wait=()=>new Promise(r=>setTimeout(r,20));
  for(let i=0;i<100&&G.spritesPending>0;i++)await wait();
  if(!G.sprites.portrait_guide||!G.sprites.portrait_guide.naturalWidth)bad.push('Guide portrait did not decode');
  G.debug.newRun(2525);G.debug.god(true);
  const hub=G.run.graph.hub;G.rooms.enter(hub,{start:true});
  const keeper=G.rooms.current.props.find(p=>p.type==='guide');
  if(!keeper)bad.push('Station Keeper missing');
  else {
    keeper.interact(G.players[0]);
    if(!G.fx.banner||G.fx.banner.portrait!=='guide')bad.push('Keeper dialogue did not request Guide portrait');
    try{G.hud.draw(document.getElementById('game').getContext('2d'));}catch(e){bad.push('portrait dialogue draw threw '+e.message);}
  }
  G.fx.say('TEST','ordinary banner',1);
  if(G.fx.banner.portrait)bad.push('ordinary banner inherited portrait');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Station Keeper conversations use the canonical watercolor Guide portrait; ordinary banners stay text-only';
};