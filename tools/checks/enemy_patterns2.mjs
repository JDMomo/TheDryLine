// Boiler and Rivet attack contract: close/ranged Boiler options, Wet impact, Rivet damage only in swoop with recovery.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];
  D.newRun(919);D.god(true);
  const flat=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.').join(''));
  if(!G.roomDefs.qa_patterns2)G.defineRoom({id:'qa_patterns2',region:'r2',kind:'main',map:flat});
  const qid='qa_patterns2_node';G.run.graph.nodes[qid]={id:qid,def:'qa_patterns2',region:'r2',exits:{},content:[],seen:true,parent:null};
  G.rooms.enter(qid,{side:'left'});const room=G.rooms.current,p=G.players[0];

  const boiler=new G.Enemy(G.enemyDefs.brine_spout,480,15*T);room.enemies=[boiler];D.place(0,545,15*T,-1);boiler.t=0;
  let sawVent=false,sawSpent=false;
  for(let i=0;i<240;i++){D.step(1);if(boiler.state==='ventwind')sawVent=true;if(boiler.state==='spent'){sawSpent=true;break;}}
  if(!sawVent||!sawSpent)bad.push('Boiler close vent chain missing '+boiler.state);
  if(!boiler.harmless)bad.push('Boiler recovery still has contact damage');

  G.combat.clear();room.enemies=[];const b2=new G.Enemy(G.enemyDefs.brine_spout,360,15*T);room.enemies=[b2];D.place(0,650,15*T,-1);b2.t=0;
  let lob=false;
  for(let i=0;i<400;i++){D.step(1);if(G.shots.some(s=>s.hostile&&s.grav>0)){lob=true;break;}}
  if(!lob)bad.push('Boiler did not use ranged lob');
  if(lob){const sh=G.shots.find(s=>s.hostile&&s.grav>0);sh.life=0;D.step(2);if(G.materials.counts().puddles<1)bad.push('Boiler lob left no Wet puddle');}

  G.combat.clear();room.enemies=[];const riv=new G.Enemy(G.enemyDefs.signal_gull,480,260);room.enemies=[riv];D.place(0,480,15*T,1);riv.t=0;
  let hoverSafe=!!riv.harmless,windSafe=false,swoopDanger=false,recovery=false,recoverSafe=false;
  for(let i=0;i<900;i++){D.step(1);if(riv.state==='hover')hoverSafe=hoverSafe||riv.harmless;if(riv.state==='wind')windSafe=windSafe||riv.harmless;if(riv.state==='swoop')swoopDanger=swoopDanger||!riv.harmless;if(riv.state==='recover'){recovery=true;recoverSafe=recoverSafe||riv.harmless;break;}}
  if(!hoverSafe||!windSafe||!swoopDanger||!recovery||!recoverSafe)bad.push('Rivet phases wrong '+JSON.stringify({hoverSafe,windSafe,swoopDanger,recovery,recoverSafe,state:riv.state}));
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Boiler chooses vent/lob and leaves Wet; Rivet only hurts during swoop then recovers';
};