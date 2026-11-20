// Co-op enemy target distribution: locks prevent jitter and pressure balancing avoids whole-room dogpiles.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,bad=[];D.newRun(606);D.god(true);while(G.players.length<2)D.addPlayer();
  D.gotoRoom('r4_concourse');const room=G.rooms.current;room.enemies=[];
  D.place(0,350,480,1);D.place(1,610,480,-1);
  const ids=['ballast_crab','sapper','turnstile','harvester','handcar','mirage'], picks=[];
  ids.forEach((id,i)=>{const e=new G.Enemy(G.enemyDefs[id],480+(i%2?8:-8),480);room.enemies.push(e);const p=e.target();picks.push(p&&p.index);});
  const a=picks.filter(x=>x===0).length,b=picks.filter(x=>x===1).length;
  if(!a||!b||Math.max(a,b)>4)bad.push('pressure did not distribute '+JSON.stringify(picks));
  const e=room.enemies[0],p0=e.target(),uid=e.targetUid;
  G.players[uid===0?0:1].x+=500;const p1=e.target();
  if(p1!==p0)bad.push('target lock changed immediately');
  D.step(Math.ceil(0.9/G.C.STEP));const p2=e.target();
  if(!p2||e.targetUntil<=G.time)bad.push('target did not relock after expiry');
  G.players[p2.index].down=true;const p3=e.target();
  if(!p3||p3.index===p2.index)bad.push('enemy kept targeting downed player');
  return {bad,picks,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'six enemies split '+JSON.stringify(r.picks)+' with 0.8 s locks and downed-player retarget';
};