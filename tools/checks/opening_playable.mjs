// Opening QA: player can leave the Keeper canopy immediately and the HTTP hub uses the painted plate prominently.
import fs from 'fs';
export default async ({page})=>{
  const hubArt=fs.existsSync(new URL('../../assets/backgrounds/ticket_hall.jpg',import.meta.url));
  const r=await page.evaluate(async(hubArt)=>{
    const bad=[],D=G.debug;
    D.newRun(4242);D.god(true);G.rooms.enter(G.run.graph.hub,{start:true});
    const p=G.players[0],x0=p.x;
    // The two lower cells of both shelter uprights must be open.
    const d=G.roomDefs.junction;
    for(const c of [57,58,71,72]) for(const rr of [30,31]) if(d.grid[rr][c]!==' .'.trim()) bad.push('sealed shelter at '+c+','+rr);
    // Simulate plain right movement long enough to leave the canopy.
    for(let i=0;i<180;i++){G.input._qa={right:true};D.setInput(0,{right:true});D.step(1);}
    D.setInput(0,{});
    if(p.x<=x0+180)bad.push('player could not walk out of start canopy: '+Math.round(x0)+' -> '+Math.round(p.x));
    // Verify the painted hub source exists/decodes in normal http play.
    if(hubArt){for(let i=0;i<80&&!G.art.paintedBackgroundReady('hub');i++)await new Promise(r=>setTimeout(r,20));
    if(!G.art.paintedBackgroundReady('hub'))bad.push('hub watercolor background did not load');}
    return {bad,errors:G.errors.slice(),x0,x1:p.x};
  },hubArt);
  if(r.bad.length)throw new Error(r.bad.join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return 'start canopy is walkable and Junction watercolor plate loads';
};