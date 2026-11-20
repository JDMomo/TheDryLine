// Mechanical interactions: lever timer, gate blocker and co-op pressure plate.
export default async ({page})=>{
  const r=await page.evaluate(()=>{
    const D=G.debug,T=G.C.T,bad=[];
    let found=null;
    for(let seed=1;seed<=80&&!found;seed++){
      D.newRun(seed);const g=G.run.graph;
      found=Object.values(g.nodes).find(n=>n.def==='r4_switchyard');
    }
    if(!found)return {bad:['r4_switchyard never appeared in 80 seeded graphs'],errors:G.errors.slice()};
    D.gotoRoom(found.id,{side:'left'});D.god(true);const room=G.rooms.current;
    const lever=room.props.find(p=>p.type==='lever'),plate=room.props.find(p=>p.type==='plate'),gate=room.props.find(p=>p.type==='mech_gate');
    if(!lever||!plate||!gate)bad.push('markers did not instantiate lever/plate/gate');
    D.step(2);
    if(!gate.bl||!gate.bl.on)bad.push('mechanical gate did not start closed');
    const p=G.players[0];D.place(0,lever.x,lever.y,1);lever.interact(p);D.step(2);
    if(gate.bl.on)bad.push('lever did not open gate');
    const t0=room.mech&&room.mech.main&&room.mech.main.timer;if(!(t0>4&&t0<=4.5))bad.push('lever timer wrong '+t0);
    D.step(Math.ceil(4.7/G.C.STEP));if(!gate.bl.on)bad.push('gate did not close when lever timer ended');

    while(G.players.length>2)G.game.removePlayer(G.players[G.players.length-1]);
    while(G.players.length<2)G.debug.addPlayer();
    const p2=G.players[1];D.place(0,plate.x,plate.y,1);p.onGround=true;D.place(1,plate.x+80,plate.y,1);p2.onGround=true;D.step(3);
    if(gate.bl.on||!plate.data.active)bad.push('pressure plate did not hold gate open');
    D.setInput(0,{left:false,right:false,jump:false,down:false,attack:false,dash:false});
    D.setInput(1,{left:false,right:false,jump:false,down:false,attack:false,dash:false});
    D.place(0,plate.x-120,plate.y,1);p.onGround=true;
    D.place(1,plate.x+120,plate.y,-1);p2.onGround=true;
    D.step(8);
    if(!gate.bl.on||plate.data.active)bad.push('gate did not close when plate was released: '+JSON.stringify({
      gateOn:!!gate.bl.on,plateActive:!!plate.data.active,timer:room.mech&&room.mech.main&&room.mech.main.timer,
      players:G.players.map(q=>({x:Math.round(q.x),y:Math.round(q.y),ground:!!q.onGround,down:!!q.down})),
      plate:{x:Math.round(plate.x),y:Math.round(plate.y)},gate:{x:Math.round(gate.x),y:Math.round(gate.y)}
    }));

    return {bad,errors:G.errors.slice(),timer:t0};
  });
  if(r.bad.length)throw new Error(r.bad.join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return 'timed lever opens/closes gate; pressure plate holds it open for co-op';
};