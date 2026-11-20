// Real-content level design: Signal Reef owns a generated bottom->top shaft and region terrain appears only in its intended pools.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, seen = { shaft:0, linked:0, terrain:{} }, sides = ['left','right','top','bottom'];
    const countChars = ids => {
      const out = {};
      for (const id of ids) { const d = G.roomDefs[id]; if (!d) continue; for (const row of d.grid) for (const ch of row) if ('sm<>'.includes(ch)) out[ch] = (out[ch]||0)+1; }
      return out;
    };
    seen.terrain.r1 = countChars(Object.keys(G.roomDefs).filter(id => id.startsWith('r1_')));
    seen.terrain.r2 = countChars(Object.keys(G.roomDefs).filter(id => id.startsWith('r2_')));
    seen.terrain.r3 = countChars(Object.keys(G.roomDefs).filter(id => id.startsWith('r3_')));
    seen.terrain.r4 = countChars(Object.keys(G.roomDefs).filter(id => id.startsWith('r4_')));
    for (let seed=1; seed<=40; seed++) {
      D.newRun(seed);
      for (const n of Object.values(G.run.graph.nodes)) if (n.def === 'r2_shaft') {
        seen.shaft++;
        const d = G.roomDefs[n.def];
        if (d.route.join('>') === 'bottom>top' && n.exits.bottom && n.exits.top &&
            n.exits.bottom.entry && n.exits.top.entry && sides.includes(n.exits.bottom.entry.side) && sides.includes(n.exits.top.entry.side)) seen.linked++;
      }
    }
    const d = G.roomDefs.r2_shaft;
    return { seen, route:d.route, ports:d.ports, errors:G.errors.slice() };
  });
  const bad=[];
  if (!(r.seen.shaft > 0 && r.seen.linked === r.seen.shaft)) bad.push('generated vertical shaft links wrong: '+JSON.stringify(r.seen));
  if (r.route.join('>') !== 'bottom>top' || !r.ports.bottom || !r.ports.top) bad.push('shaft route/ports wrong: '+JSON.stringify(r));
  if (!(r.seen.terrain.r1.m > 0 && r.seen.terrain.r3.s > 0 && (r.seen.terrain.r4['>']||0) > 0 && (r.seen.terrain.r4['<']||0) > 0)) bad.push('regional terrain missing: '+JSON.stringify(r.seen.terrain));
  if (r.errors.length) bad.push('G.errors: '+r.errors.join(' | '));
  if (bad.length) throw new Error(bad.join(' ; '));
  return 'generated bottom/top shaft plus Wreck mud, Salt crust and Ticket conveyors';
};
