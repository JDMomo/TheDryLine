// Behaviour: what hurts the player and what it costs, driven by player input (setInput + step). The only setup is choosing a room and where to stand.
//  - an active hostile contact body costs exactly one health pip and grants invincibility: while the overlap goes on no second pip goes for about a second,
//    then the next one does. Patrol/recovery bodies may deliberately be harmless under the attack-contract rules;
//  - a Warden's body hurts on contact (one pip, then invincibility);
//  - spikes cost one pip and put the player back on safe ground (a run toward the pit from solid floor).
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const P = () => D.state().players[0], T = G.C.T, M = G.C.MOVE;
    D.newRun(5); D.god(false);
    // ---- hostile contact layer. Use a dedicated QA body so readability reworks may make patrol/recovery states harmless.
    D.gotoRoom('r1'); D.step(2); G.rooms.current.enemies.length = 0;
    if (!G.enemyDefs.qa_contact_hazard) G.defineEnemy({ id:'qa_contact_hazard', name:'QA contact', hp:999, w:28, h:30, touch:1, shards:[0,0], update(e){ e.vx=0; }, draw(){} });
    const base=P(), e=new G.Enemy(G.enemyDefs.qa_contact_hazard, base.x+70, base.y); G.rooms.current.enemies=[e]; e.onGround=true;
    {
      const at = () => { e.x = G.players[0].x; e.y = G.players[0].y; e.vx = 0; e.vy = 0; e.hitWall = 0; e.onGround=true; };
      D.place(0, e.x, e.y); at(); const hp0 = P().hp; D.step(1);
      ok(P().hp === hp0 - 1, 'active hostile contact cost ' + (hp0 - P().hp) + ' pips, not 1');
      ok(P().inv > 0.5, 'no invincibility after a hostile contact hit: ' + P().inv);
      let steps = 1;
      for (; steps < 100; steps++) { at(); G.players[0].x=e.x; G.players[0].y=e.y; D.step(1); }
      ok(P().hp === hp0 - 1, 'a second pip went during the invincibility (hp ' + P().hp + ' of ' + hp0 + ' after ' + steps + ' steps)');
      for (; steps < 260; steps++) { at(); G.players[0].x=e.x; G.players[0].y=e.y; D.step(1); if (P().hp < hp0 - 1) break; }
      ok(P().hp === hp0 - 2, 'invincibility never ended: still overlapping after ' + steps + ' steps, hp ' + P().hp);
      ok(steps >= 100 && steps <= 200, 'invincibility ended after ' + steps + ' steps (expected about ' + Math.round(M.INV / G.C.STEP) + ')');
    }
    // ---- a Warden's body
    D.newRun(5); D.god(false); D.startBoss('r1'); D.step(200);
    { const b = D.state().room.boss, hp0 = P().hp; ok(!!b, 'no boss'); D.place(0, b.x, b.floor); D.step(30); ok(P().hp === hp0 - 1, 'touching the Warden cost ' + (hp0 - P().hp) + ' pips, not 1'); }
    // ---- spikes. Use a tiny deterministic QA room: campaign rooms are free to omit spike pits entirely.
    D.newRun(5); D.god(false);
    {
      const g=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.'));
      for(let c=12;c<=15;c++)g[15][c]='^';
      if(!G.roomDefs.qa_spike_hurt)G.defineRoom({id:'qa_spike_hurt',region:'r1',kind:'main',map:g.map(row=>row.join(''))});
      const id='qa_spike_hurt_node';G.run.graph.nodes[id]={id,def:'qa_spike_hurt',region:'r1',exits:{},content:[],seen:true,parent:null};
      G.rooms.enter(id,{side:'left'});G.rooms.current.enemies.length=0;
      D.place(0,8.5*T,15*T,1);D.step(3);
      const s0=P(), hp0=s0.hp, x0=s0.x;
      D.setInput(0,{right:true});
      let lost=false,steps=0;
      for(;steps<220&&!lost;steps++){D.step(1);lost=P().hp<hp0;}
      D.setInput(0,{right:false});
      ok(lost,'running into the deterministic spike bed never cost a pip');
      if(lost){
        D.step(80);const q=P();
        ok(q.hp===hp0-1,'spikes cost '+(hp0-q.hp)+' pips, not 1');
        ok(q.onGround&&!G.tiles.spike(Math.floor(q.x/T),Math.floor((q.y-2)/T)),'the player was not returned to safe ground after spikes');
        ok(Math.abs(q.x-x0)<300,'safe ground is far from the run start: '+Math.round(q.x-x0));
      }
    }
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 5).join(' | '));
  return 'hostile contact: one pip and invincibility; spikes: one pip and back on safe ground';
};
