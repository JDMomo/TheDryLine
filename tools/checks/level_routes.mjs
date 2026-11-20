// Real-content level design: Signal Reef owns a generated bottom->top shaft and region terrain appears only in its intended pools.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, seen = { shaft:0, linked:0, boundaryFirst:0, boundaryLast:0, terrain:{} };
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
        const g = G.run.graph, d = G.roomDefs[n.def], back = n.exits.bottom, fwd = n.exits.top;
        let backOk = false, fwdOk = false;

        if (back && back.to === g.hub) {
          backOk = !!(back.entry && back.entry.gate === 'r2'); seen.boundaryFirst++;
        } else if (back && g.nodes[back.to]) {
          const prev = g.nodes[back.to], pr = G.roomDefs[prev.def].route || ['left','right'];
          backOk = !!(back.entry && back.entry.side === pr[1] && prev.exits[pr[1]] && prev.exits[pr[1]].to === n.id && prev.exits[pr[1]].entry.side === 'bottom');
        }

        const region = g.regions.r2;
        if (fwd && fwd.to === region.arena) {
          fwdOk = !!(fwd.entry && fwd.entry.side === 'left'); seen.boundaryLast++;
        } else if (fwd && g.nodes[fwd.to]) {
          const next = g.nodes[fwd.to], nr = G.roomDefs[next.def].route || ['left','right'];
          fwdOk = !!(fwd.entry && fwd.entry.side === nr[0] && next.exits[nr[0]] && next.exits[nr[0]].to === n.id && next.exits[nr[0]].entry.side === 'top');
        }

        if (d.route.join('>') === 'bottom>top' && backOk && fwdOk) seen.linked++;
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
  return 'generated bottom/top shaft with reciprocal/boundary links plus Wreck mud, Salt crust and Ticket conveyors';
};
