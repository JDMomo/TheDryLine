// Dynamic terrain: crumbling ledges warn/fall/rebuild safely, springs launch, and timed vents launch players and enemies.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D=G.debug, T=G.C.T, CW=30, CH=17;
    D.newRun(41); D.god(true);
    const g=Array.from({length:CH},()=>Array(CW).fill('.'));
    g[0].fill('#'); g[15].fill('#'); g[16].fill('#');
    for(let rr=0;rr<CH;rr++) if(rr<12||rr>14){g[rr][0]='#';g[rr][CW-1]='#';}
    g[15][6]='c'; g[15][12]='j'; g[15][18]='v';
    G.defineRoom({id:'qa_dynamic_terrain',region:'r2',kind:'main',map:g.map(row=>row.join(''))});
    const node={id:'qa_dynamic_terrain_node',def:'qa_dynamic_terrain',region:'r2',exits:{},content:[],seen:true};
    G.run.graph.nodes[node.id]=node; G.rooms.enter(node.id,{side:'left'});
    const p=G.players[0], floorY=15*T;

    // Crumble starts warning while stood on, then becomes non-solid.
    D.place(0,6.5*T,floorY,1); p.onGround=true; D.step(2);
    const warn=G.tiles.crumbleState(6,15) && G.tiles.crumbleState(6,15).phase;
    D.step(Math.ceil(0.55/G.C.STEP));
    const gone=G.tiles.crumbleGone(6,15), solidGone=G.tiles.solid(6,15);

    // Keep a dummy overlapping the tile when rebuild time expires; it must stay gone until clear.
    const dummy={x:6.5*T,y:15*T+18,w:20,h:28,dead:false,onGround:false,vy:0};
    G.rooms.current.enemies.push(dummy);
    D.step(Math.ceil(2.8/G.C.STEP));
    const heldGone=G.tiles.crumbleGone(6,15);
    G.rooms.current.enemies.length=0; D.step(2);
    const rebuilt=!G.tiles.crumbleState(6,15) && G.tiles.solid(6,15);

    // Spring: player launches above normal jump speed threshold.
    D.place(0,12.5*T,floorY,1); p.vy=0; p.onGround=true; D.step(2);
    const springVy=p.vy;

    // Vent: wait for its deterministic active pulse while standing over it.
    D.place(0,18.5*T,floorY,1); p.vy=0; p.onGround=true;
    let ventVy=0, active=false;
    for(let i=0;i<400;i++){D.step(1); if(G.tiles.ventActive(18,15)) active=true; if(p.vy<-500){ventVy=p.vy;break;}}
    
    // Same spring behavior applies to enemies.
    if(!G.enemyDefs.qa_launch_dummy) G.defineEnemy({id:'qa_launch_dummy',name:'Launch Dummy',hp:10,w:22,h:28,touch:0,shards:[0,0],update(e){e.vx=0;},draw(){}});
    const e=new G.Enemy(G.enemyDefs.qa_launch_dummy,12.5*T,floorY); e.onGround=true; G.rooms.current.enemies=[e]; D.step(2);
    const enemyVy=e.vy;

    delete G.run.graph.nodes[node.id]; delete G.run.rooms[node.id];
    return {warn,gone,solidGone,heldGone,rebuilt,springVy,ventVy,active,enemyVy,errors:G.errors.slice()};
  });
  const bad=[];
  if(r.warn!=='warn'||!r.gone||r.solidGone) bad.push('crumble warning/fall wrong: '+JSON.stringify(r));
  if(!r.heldGone||!r.rebuilt) bad.push('crumble safe rebuild wrong: '+JSON.stringify(r));
  if(!(r.springVy<-700&&r.enemyVy<-700)) bad.push('spring launch wrong: '+JSON.stringify({player:r.springVy,enemy:r.enemyVy}));
  if(!r.active||!(r.ventVy<-500)) bad.push('steam vent did not launch: '+JSON.stringify({active:r.active,vy:r.ventVy}));
  if(r.errors.length) bad.push('G.errors: '+r.errors.join(' | '));
  if(bad.length) throw new Error(bad.join(' ; '));
  return 'crumble warn/fall/safe rebuild, player+enemy springs, deterministic steam launch';
};
