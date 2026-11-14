// For 20 seeds: every room is reachable from the hub, the hub is reachable from every room, and each region has its rooms.
export default async ({ page }) => {
  const bad = await page.evaluate(() => {
    const out = [];
    for (let seed = 1; seed <= 20; seed++) {
      G.debug.newRun(seed);
      const g = G.debug.state().graph, kinds = id => G.roomDefs[G.run.graph.nodes[id].def].kind;
      if (g.unreachable.length || g.deadEnds.length || g.warnings.length) out.push({ seed, unreachable: g.unreachable, deadEnds: g.deadEnds, warnings: g.warnings });
      for (const [rid, reg] of Object.entries(g.regions)) {
        const k = reg.nodes.map(kinds), mains = k.filter(x => x === 'main').length, want = G.regionDefs[rid].length;
        if (mains !== want || !k.includes('arena') || !k.includes('branch') || (G.regionDefs[rid].ability && !k.includes('trial')))
          out.push({ seed, region: rid, kinds: k });
      }
    }
    return out;
  });
  if (bad.length) throw new Error(JSON.stringify(bad.slice(0, 3)));
  return '20 seeds';
};
