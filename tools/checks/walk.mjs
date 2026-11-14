// Walk every region's chain, hub gate to arena, on the real graph of 5 seeds. Each main room is crossed left to right with the
// validator's route search (pageTraverse in rooms.mjs: a cheap run-and-jump pass, then a beam search, base moves only), then the
// bot keeps walking right and must arrive in the next node of the chain; the arena is crossed to the boss door and the fight must start.
import { pageTraverse } from './rooms.mjs';

export default async ({ page }) => {
  const bad = [], stats = { rooms: 0, regions: 0 };
  for (const seed of [1, 2, 3, 4, 5]) {
    const chains = await page.evaluate(seed => {
      G.debug.newRun(seed);
      const g = G.run.graph;
      return Object.entries(g.regions).map(([rid, reg]) => {
        const ids = []; let id = reg.first;
        while (id) { ids.push(id); const n = g.nodes[id]; id = G.roomDefs[n.def].kind === 'arena' ? null : n.exits.right && n.exits.right.to; }
        return { rid, ids: ids.map(i => ({ id: i, def: g.nodes[i].def, kind: G.roomDefs[g.nodes[i].def].kind, next: g.nodes[i].exits.right && g.nodes[i].exits.right.to })) };
      });
    }, seed);
    for (const ch of chains) {
      stats.regions++;
      if (ch.ids.length < 2 || ch.ids[ch.ids.length - 1].kind !== 'arena') { bad.push(`seed ${seed} ${ch.rid}: chain does not end in an arena`); continue; }
      // the hub gate leads to the first room
      const gate = await page.evaluate(({ rid }) => { const g = G.run.graph, hub = g.nodes[g.hub]; return hub.content.some(c => c && c.type === 'gate' && c.data.region === rid); }, ch);
      if (!gate) bad.push(`seed ${seed} ${ch.rid}: no gate in the hub`);
      for (const n of ch.ids) {
        stats.rooms++;
        // the search tries walking off both edges: with real exits that would change rooms mid-search, so close them while it runs
        await page.evaluate(id => { const n = G.run.graph.nodes[id]; n.savedExits = n.exits; n.exits = {}; }, n.id);
        const jobs = await page.evaluate(pageTraverse, { id: n.def, nodeId: n.id, abil: [], budget: 800000, only: n.kind === 'arena' ? 'boss door' : 'left to right' });
        await page.evaluate(id => { const n = G.run.graph.nodes[id]; n.exits = n.savedExits; delete n.savedExits; }, n.id);
        if (!jobs.length || !jobs.every(j => j.ok)) { bad.push(`seed ${seed} ${ch.rid} ${n.def}: ${jobs.map(j => j.msg || 'ok').join('; ') || 'no route job'}`); continue; }
        if (n.kind === 'arena') {   // two steps past the boss door the fight starts and the door closes
          const r = await page.evaluate(() => { const D = G.debug; D.step(240); const s = D.state().room; return { fight: s.fight, locked: s.locked, err: D.state().errors.length }; });
          if (!r.fight) bad.push(`seed ${seed} ${ch.rid}: the fight did not start after crossing the arena hall`);
          continue;
        }
        const r = await page.evaluate(() => { const D = G.debug; D.setInput(0, { right: true }); D.step(150); D.setInput(0, { right: false }); return D.state().room.id; });
        if (r !== n.next) bad.push(`seed ${seed} ${ch.rid} ${n.def}: walking off the right edge led to ${r}, wanted ${n.next}`);
      }
    }
  }
  if (bad.length) throw new Error('stuck: ' + JSON.stringify(bad.slice(0, 5)) + (bad.length > 5 ? ' (+' + (bad.length - 5) + ' more)' : ''));
  return stats.rooms + ' rooms in ' + stats.regions + ' regions over 5 seeds';
};
