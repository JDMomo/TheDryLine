// Encounter-role QA for Sapper, Harvester and Mirage.
export default async ({ page }) => {
  const r=await page.evaluate(() => {
    const D=G.debug,T=G.C.T,bad=[],notes=[];
    D.newRun(818); D.god(true);
    const g=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.').join(''));
    G.defineRoom({id:'qa_enemy_roles',region:'r4',kind:'main',map:g});
    const id='qa_enemy_roles_node';
    G.run.graph.nodes[id]={id,def:'qa_enemy_roles',region:'r4',exits:{},content:[],seen:true,parent:null};
    G.rooms.enter(id,{side:'left'}); const room=G.rooms.current,p=G.players[0];
    room.enemies=[];room.props=[];room.boss=null;room.cleared=false;D.place(0,8*T,15*T,1);
    const mk=(eid,c)=>{const e=new G.Enemy(G.enemyDefs[eid],c*T+T/2,15*T);room.enemies.push(e);return e;};
    const stepUntil=(fn,n=1200)=>{for(let i=0;i<n;i++){D.step(1);if(fn())return i+1;}return 0;};
    const sane=(e,tag)=>{for(const v of [e.x,e.y,e.vx,e.vy,e.hp]) if(!Number.isFinite(v))bad.push(tag+' has non-finite state'); if(e.x<0||e.x>30*T||e.y<0||e.y>17*T+1)bad.push(tag+' left room');};

    // Sapper: reaches tell, can be interrupted, and when allowed to finish creates a cuttable hostile charge/explosion sequence.
    let e=mk('sapper',13);e.cool=0;D.place(0,e.x+80,15*T,-1);
    if(!stepUntil(()=>e.state==='wind',240)) bad.push('Sapper never entered plant wind-up');
    const shots0=G.shots.length;e.damage(1,p.x);D.step(2);
    if(e.state==='wind')bad.push('Sapper wind-up was not interruptible');
    e.cool=0;e.set('walk',0);if(!stepUntil(()=>e.state==='wind',240))bad.push('Sapper could not wind a second time');
    if(!stepUntil(()=>G.shots.length>shots0,240))bad.push('Sapper planted no charge');
    else {
      const mine=G.shots.find(s=>s.hostile&&s.cut&&s.life>0.5);
      if(!mine)bad.push('Sapper charge is not a cuttable hostile object');
    }
    sane(e,'Sapper');room.enemies=[];G.combat.clear();

    // Harvester: reacts to a wounded ally, visibly winds, heals, and can also be interrupted.
    const h=mk('harvester',15), ally=mk('ballast_crab',18);ally.hp=Math.max(1,ally.hp-12);h.cool=0;
    const hp0=ally.hp;
    if(!stepUntil(()=>h.state==='wind',360))bad.push('Harvester never started repair tell');
    if(!stepUntil(()=>ally.hp>hp0,360))bad.push('Harvester repair pulse healed nobody');
    h.cool=0;ally.hp=Math.max(1,ally.hp-8);h.set('walk',0);
    if(stepUntil(()=>h.state==='wind',360)){h.damage(1,p.x);D.step(2);if(h.state==='wind')bad.push('Harvester repair tell was not interruptible');}
    else bad.push('Harvester could not start second repair');
    sane(h,'Harvester');room.enemies=[];G.combat.clear();

    // Mirage: fade -> tell -> dash -> recovery; the visible tell is interruptible.
    const m=mk('mirage',17);m.cool=0;D.place(0,m.x-150,15*T,1);
    if(!stepUntil(()=>m.state==='fade',360))bad.push('Mirage never phased');
    if(!stepUntil(()=>m.state==='tell',360))bad.push('Mirage never gave reappearance tell');
    else {
      m.damage(1,p.x);D.step(2);if(m.state==='tell')bad.push('Mirage tell was not interruptible');
      m.cool=0;m.set('watch',0);
      if(!stepUntil(()=>m.state==='fade',360)||!stepUntil(()=>m.state==='tell',360)||!stepUntil(()=>m.state==='dash',360))bad.push('Mirage never completed fade/tell/dash chain');
      if(!stepUntil(()=>m.state==='recover',360))bad.push('Mirage dash had no recovery');
    }
    sane(m,'Mirage');

    // All three remain slash-killable and drop their normal scrip range.
    for(const eid of ['sapper','harvester','mirage']){
      room.enemies=[];G.combat.clear();G.run.shards=0;const q=mk(eid,15);q.harmless=true;
      q.damage(9999,q.x-20);D.step(2);
      const drop=G.pickups.reduce((n,k)=>n+k.value,0);
      if(!q.dead)bad.push(eid+' could not be killed');
      if(drop<G.enemyDefs[eid].shards[0]-0.01)bad.push(eid+' dropped too little scrip: '+drop);
      notes.push(eid+' '+q.def.hp+'hp drop '+Math.round(drop));
    }
    delete G.run.graph.nodes[id];delete G.run.rooms[id];
    return {bad,notes,errors:G.errors.slice()};
  });
  if(r.bad.length)throw new Error(r.bad.join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return r.notes.join('; ');
};