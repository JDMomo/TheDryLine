// Front-line readability: Strider and Scrapper use wind-up -> damaging active -> recovery, not passive contact.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];D.newRun(707);D.god(true);
  const flat=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.').join(''));
  if(!G.roomDefs.qa_pattern_flat)G.defineRoom({id:'qa_pattern_flat',region:'r1',kind:'main',map:flat});
  const qid='qa_pattern_flat_node';G.run.graph.nodes[qid]={id:qid,def:'qa_pattern_flat',region:'r1',exits:{},content:[],seen:true,parent:null};
  G.rooms.enter(qid,{side:'left'});const room=G.rooms.current,p=G.players[0];
  const run=(id,x)=>{
    room.enemies=[];const e=new G.Enemy(G.enemyDefs[id],x,15*T);room.enemies=[e];D.place(0,x+125,15*T,-1);p.onGround=true;e.onGround=true;e.cool=0;
    const seen={};for(let i=0;i<900;i++){D.step(1);seen[e.state]=(seen[e.state]||0)+1;if(e.state==='lunge'||e.state==='charge')seen.activeHarmless=!!e.harmless;if((e.state==='recover')&&i>60)break;}
    return {e,seen};
  };
  let q=run('ballast_crab',400);
  if(!q.seen.wind||!q.seen.lunge||!q.seen.recover)bad.push('Strider missing attack phases '+JSON.stringify(q.seen));
  if(q.seen.activeHarmless!==false)bad.push('Strider lunge was harmless');
  if(!q.e.harmless)bad.push('Strider recovery still deals contact damage');
  q=run('turnstile',500);
  if(!q.seen.wind||!q.seen.charge||!q.seen.recover)bad.push('Scrapper missing attack phases '+JSON.stringify(q.seen));
  if(q.seen.activeHarmless!==false)bad.push('Scrapper charge was harmless');
  if(!q.e.harmless)bad.push('Scrapper recovery still deals contact damage');
  q.e.set('recover',0.5);q.e.face=1;G.combat.slashBy={p,s:{dir:'side'}};const hp=q.e.hp;q.e.damage(1,p.x);G.combat.slashBy=null;
  if(q.e.hp!==hp-1)bad.push('Scrapper recovery did not expose shield');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Strider claw-lunge and Scrapper shield-charge both telegraph, commit and recover';
};