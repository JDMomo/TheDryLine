// Rail cart: instantiates from Q, reverses on fixed span, carries grounded player and enemy without gating route.
export default async ({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,T=G.C.T,bad=[];D.newRun(1515);D.god(true);
  const g=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.'));
  g[14][15]='Q';
  if(!G.roomDefs.qa_cart)G.defineRoom({id:'qa_cart',region:'r1',kind:'main',map:g.map(x=>x.join(''))});
  const id='qa_cart_node';G.run.graph.nodes[id]={id,def:'qa_cart',region:'r1',exits:{},content:[{type:'rail_cart',data:{span:3}}],seen:true,parent:null};
  G.rooms.enter(id,{side:'left'});const room=G.rooms.current,cart=room.props.find(p=>p.type==='rail_cart');
  if(!cart)return {bad:['Q did not instantiate cart'],errors:G.errors.slice()};
  const p=G.players[0];D.place(0,cart.x,cart.y,1);p.onGround=true;const x0=p.x,c0=cart.x;D.step(45);
  if(!(cart.x>c0+10&&p.x>x0+8))bad.push('cart did not carry player '+JSON.stringify({c0,c:cart.x,x0,x:p.x}));
  const e=new G.Enemy(G.enemyDefs.ballast_crab,cart.x,cart.y);e.onGround=true;e.harmless=true;room.enemies=[e];const ex=e.x;D.step(20);
  if(Math.abs(e.x-ex)<3)bad.push('cart did not carry enemy');
  const home=cart.data.home,span=cart.data.span*T;D.step(900);
  if(cart.x<home-span-1||cart.x>home+span+1)bad.push('cart left fixed span');
  return {bad,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'rail cart reverses on fixed safe-floor span and carries players/enemies';
};