// Four-direction room ports: top/bottom openings can be entered and exited, tall-room camera follows vertically, and legacy routes remain left->right.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, CW = 30, CH = 17;
    D.newRun(1);
    const make = (id, route, topC, botC) => {
      const rows = CH * 2, g = Array.from({ length: rows }, (_, r) => Array(CW).fill('.'));
      for (let r = 0; r < rows; r++) for (let c = 0; c < CW; c++) if (r === 0 || r === rows - 1 || c === 0 || c === CW - 1) g[r][c] = '#';
      for (const side of route) if (side === 'left' || side === 'right') for (const rr of [rows - 5, rows - 4, rows - 3]) g[rr][side === 'left' ? 0 : CW - 1] = '.';
      for (let c = topC - 1; c <= topC + 1; c++) if (route.includes('top')) g[0][c] = '.';
      for (let c = botC - 1; c <= botC + 1; c++) if (route.includes('bottom')) g[rows - 1][c] = '.';
      for (let c = 1; c < CW - 1; c++) g[rows - 2][c] = route.includes('bottom') && Math.abs(c - botC) <= 1 ? '.' : '#';
      for (let rr = 6; rr < rows - 6; rr += 5) {
        const c0 = rr % 10 ? 7 : 14;
        for (let c = c0; c < Math.min(CW - 1, c0 + 9); c++) g[rr][c] = '=';
      }
      G.defineRoom({ id, region: 'r1', kind: 'main', h: 2, route, map: g.map(row => row.join('')) });
    };
    make('qa_vertical_a', ['left', 'top'], 15, 15);
    make('qa_vertical_b', ['top', 'bottom'], 10, 19);
    const a = { id: 'qa_va', def: 'qa_vertical_a', region: 'r1', exits: {}, content: [], seen: true };
    const b = { id: 'qa_vb', def: 'qa_vertical_b', region: 'r1', exits: {}, content: [], seen: true };
    G.run.graph.nodes[a.id] = a; G.run.graph.nodes[b.id] = b;
    a.exits.top = { to: b.id, entry: { side: 'top' } };
    b.exits.bottom = { to: a.id, entry: { side: 'top' } };

    G.rooms.enter(b.id, { side: 'bottom' });
    const bottomEntryVy = G.players[0].vy;
    G.rooms.enter(a.id, { side: 'left' }); D.step(2);
    const p = G.players[0], pa = G.roomDefs[a.def].ports.top;
    D.place(0, (pa.c + 0.5) * 32, p.h + 5, 1); p.vy = -520; p.onGround = false;
    for (let i = 0; i < 100 && G.rooms.current.id === a.id; i++) D.step(1);
    for (let i = 0; i < 100 && G.rooms.trans; i++) D.step(1);
    const up = G.rooms.current.id, topEntryVy = G.players[0].vy;

    D.place(0, 480, 900, 1); G.cam.follow(1, 480, 900, true); const camY = G.cam.y;
    const pb = G.roomDefs[b.def].ports.bottom; D.place(0, (pb.c + 0.5) * 32, G.rooms.current.rows * 32 - 4, 1);
    G.players[0].vy = 520; G.players[0].onGround = false;
    for (let i = 0; i < 100 && G.rooms.current.id === b.id; i++) D.step(1);
    for (let i = 0; i < 100 && G.rooms.trans; i++) D.step(1);
    const down = G.rooms.current.id;
    const legacy = G.roomDefs.r1_ribs.route.join('>');
    delete G.run.graph.nodes[a.id]; delete G.run.graph.nodes[b.id]; delete G.run.rooms[a.id]; delete G.run.rooms[b.id];
    return { up, down, topEntryVy, bottomEntryVy, camY, legacy, errors: G.errors.slice() };
  });
  const bad = [];
  if (r.up !== 'qa_vb') bad.push('top exit did not enter the next room: ' + r.up);
  if (r.down !== 'qa_va') bad.push('bottom exit did not return: ' + r.down);
  if (!(r.topEntryVy >= 0)) bad.push('top entry did not arrive falling into the room: ' + r.topEntryVy);
  if (!(r.bottomEntryVy < 0)) bad.push('bottom entry did not carry upward momentum: ' + r.bottomEntryVy);
  if (!(r.camY > 100)) bad.push('camera did not follow vertically: ' + r.camY);
  if (r.legacy !== 'left>right') bad.push('legacy main route changed: ' + r.legacy);
  if (r.errors.length) bad.push('G.errors: ' + r.errors.join(' | '));
  if (bad.length) throw new Error(bad.join(' ; '));
  return 'top/bottom transitions, vertical camera, bottom-entry momentum, legacy route compatibility';
};
