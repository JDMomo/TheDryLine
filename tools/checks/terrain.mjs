// Terrain foundation: salt slides, mud slows, conveyors push, wet dissolves salt, and live mutations preserve the room template.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, CW = 30, CH = 17;
    D.newRun(17); D.god(true);
    const g = Array.from({ length: CH }, () => Array(CW).fill('.'));
    g[0].fill('#'); g[15].fill('#'); g[16].fill('#');
    for (let rr = 0; rr < CH; rr++) if (rr < 12 || rr > 14) { g[rr][0] = '#'; g[rr][CW - 1] = '#'; }
    for (let c = 3; c <= 8; c++) g[15][c] = 's';
    for (let c = 10; c <= 15; c++) g[15][c] = 'm';
    for (let c = 17; c <= 21; c++) g[15][c] = '>';
    for (let c = 23; c <= 27; c++) g[15][c] = '<';
    G.defineRoom({ id: 'qa_terrain', region: 'r3', kind: 'main', map: g.map(row => row.join('')) });
    const node = { id: 'qa_terrain_node', def: 'qa_terrain', region: 'r3', exits: {}, content: [], seen: true };
    G.run.graph.nodes[node.id] = node; G.rooms.enter(node.id, { side: 'left' });
    const p = G.players[0], T = G.C.T, floorY = 15 * T;
    const stop = () => D.setInput(0, { left:false, right:false, up:false, down:false, jump:false, attack:false, dash:false, item:false, interact:false });

    const coast = c => {
      D.place(0, (c + 0.5) * T, floorY, 1); p.vx = 300; p.onGround = true; stop(); D.step(18);
      return p.vx;
    };
    const plain = coast(1), salt = coast(5);

    const runOn = c => {
      D.place(0, (c + 0.5) * T, floorY, 1); p.vx = 0; p.onGround = true; D.setInput(0, { right:true }); D.step(18); stop();
      return p.vx;
    };
    const plainRun = runOn(1), mudRun = runOn(12);

    const belt = c => {
      D.place(0, (c + 0.5) * T, floorY, 1); p.vx = 0; p.onGround = true; const x0 = p.x; stop(); D.step(24); return p.x - x0;
    };
    const right = belt(19), left = belt(25);

    const defBefore = G.roomDefs.qa_terrain.grid[15][5];
    D.place(0, 5.5 * T, floorY, 1); G.materials.puddle(p.x, floorY, p, 24, 1); D.step(1);
    const liveAfter = G.tiles.at(5, 15), defAfter = G.roomDefs.qa_terrain.grid[15][5], dissolved = G.materials.fired.Dissolve || 0;

    delete G.run.graph.nodes[node.id]; delete G.run.rooms[node.id];
    return { plain, salt, plainRun, mudRun, right, left, defBefore, liveAfter, defAfter, dissolved, errors: G.errors.slice() };
  });
  const bad = [];
  if (!(Math.abs(r.salt) > Math.abs(r.plain) * 1.8)) bad.push('salt is not slippery enough: ' + JSON.stringify({ plain:r.plain, salt:r.salt }));
  if (!(Math.abs(r.mudRun) < Math.abs(r.plainRun) * 0.75)) bad.push('mud did not slow movement: ' + JSON.stringify({ plain:r.plainRun, mud:r.mudRun }));
  if (!(r.right > 8 && r.left < -8)) bad.push('conveyors did not push both ways: ' + JSON.stringify({ right:r.right, left:r.left }));
  if (!(r.defBefore === 's' && r.liveAfter === '.' && r.defAfter === 's' && r.dissolved >= 1)) bad.push('wet salt mutation/template isolation wrong: ' + JSON.stringify(r));
  if (r.errors.length) bad.push('G.errors: ' + r.errors.join(' | '));
  if (bad.length) throw new Error(bad.join(' ; '));
  return 'salt slide, mud slow, conveyors, wet dissolves salt, template preserved';
};
