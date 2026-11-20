// Safe arrivals: for every room and every way into it that the graph uses (edge exits, home-area portals, doorways, gate mouths), a player
// who arrives and touches nothing is still in that room 2 seconds later. Catches arrivals over a floor hole or onto a belt that carries
// the party straight back out (playtest issue 3: r2_shaft and the Signal Stair bounced an idle player back within 0.7 s).
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, bad = [], seen = new Set(); let n = 0;
    for (const seed of [1, 4, 9]) {
      D.newRun(seed); D.god(true);
      const g = G.run.graph, ways = [];
      for (const node of Object.values(g.nodes)) {
        for (const side of ['left', 'right', 'top', 'bottom']) if (node.exits[side]) ways.push([node.exits[side].to, node.exits[side].entry, node.id + ' ' + side]);
        for (const q of node.portals || []) ways.push([q.dest, q.entry, node.id + ' portal ' + q.id]);
        for (const c of node.content) if (c && c.type === 'door') ways.push([c.data.to, c.data.entry, node.id + ' door']);
      }
      for (const rg of Object.values(g.regions)) if (rg.mouth) ways.push([rg.mouth.node, rg.mouth.entry, 'gate']);
      for (const [to, entry, from] of ways) {
        const key = g.nodes[to].def + ' ' + JSON.stringify(entry);
        if (seen.has(key)) continue;
        seen.add(key); n++;
        D.setInput(0, { left: false, right: false, jump: false, down: false });
        G.rooms.trans = null; G.rooms.enter(to, entry);
        const room = G.rooms.current; room.enemies.length = 0;
        for (let i = 0; i < 240; i++) { D.step(1); if (G.rooms.trans || G.rooms.current !== room) break; }
        if (G.rooms.trans || G.rooms.current !== room) bad.push(g.nodes[to].def + ' entered by ' + JSON.stringify(entry) + ' (from ' + from + '): an idle player left within 2 s');
        else if (G.players[0].y > room.rows * 32 + 4 || G.players[0].y < 0) bad.push(g.nodes[to].def + ' entered by ' + JSON.stringify(entry) + ': the player is held outside the room');
      }
    }
    return { bad, n, errors: G.errors.slice() };
  });
  if (r.bad.length) throw new Error(r.bad.length + ' unsafe arrivals: ' + r.bad.slice(0, 6).join(' | '));
  if (r.errors.length) throw new Error('G.errors: ' + r.errors.join(' | '));
  return r.n + ' distinct arrivals (room x entry, 3 seeds) keep an idle player in the room for 2 s';
};
