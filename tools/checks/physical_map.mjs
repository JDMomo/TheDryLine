// The Junction's physical board teaches and opens the full Route Board/journal.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const D=G.debug,bad=[];D.newRun(3535);D.god(true);
  const room=G.rooms.current,board=room.props.find(p=>p.type==='board'),p=G.players[0];
  if(!board)return {bad:['Junction physical board missing'],errors:G.errors.slice()};
  // The hub template says where the board hangs (def.board = [c, r]): just over the clock balcony, the one-way floor of the row below it.
  const bd=room.def.board||[59,13],floorR=bd[1]+1;
  if(Math.round(board.x/G.C.T-.5)!==bd[0]||Math.abs(board.y-(bd[1]*G.C.T+16))>1||room.def.grid[floorR][bd[0]]!=='=')bad.push('Route Board is not on the high clock balcony: '+Math.round(board.x)+','+Math.round(board.y));
  D.place(0,board.x,floorR*G.C.T,1);p.onGround=true;D.step(2);
  const near=G.rooms.propNear(p),prompt=near&&near.prompt(p);
  if(near!==board)bad.push('physical board cannot be approached');
  if(!prompt||!/^Route Board$/.test(prompt[0]))bad.push('board prompt does not identify Route Board');
  G.map.note=0;board.interact(p);
  if(G.state!=='map')bad.push('interacting with physical board did not open map');
  if(G.story&&G.story.notes().length&&G.map.note!==G.story.notes().length-1)bad.push('physical board did not open journal at latest note');
  return {bad,errors:G.errors.slice(),x:board.x,y:board.y};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'Junction Route Board is a physical, usable navigation landmark';
};