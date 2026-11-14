// A token turns up once per run. Every source (guarded plinths, trunks, ticket machines, kiosk, clipping booth) draws only ids that are not
// held, not void and not already placed or offered elsewhere in the run; a dry pool offers a trinket or scrip, never a copy; seeds replay.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const stats = { seeds: 0, dry: 0, filler: 0 };
    // every token id a graph places or offers, with where
    const placed = g => {
      const out = [];
      for (const n of Object.values(g.nodes)) for (const c of G.worldgen.contents(n)) {
        const d = c.data || {};
        if (c.type === 'plinth' && d.item) out.push([d.item, n.id + ' ' + (d.price ? 'ware' : 'plinth')]);
        else if (c.type === 'trunk' && d.item) out.push([d.item, n.id + ' trunk']);
        else if (c.type === 'ticket') (d.choices || []).forEach(o => { if (o.item) out.push([o.item, n.id + ' ticket']); });
      }
      return out;
    };
    const trinketsOf = g => {
      const out = [];
      for (const n of Object.values(g.nodes)) for (const c of G.worldgen.contents(n)) {
        const d = c.data || {};
        if (c.type === 'plinth' && d.trinket) out.push([d.trinket, n.id]); else if (c.type === 'trunk' && d.trinket) out.push([d.trinket, n.id]);
        else if (c.type === 'ticket') (d.choices || []).forEach(o => { if (o.trinket) out.push([o.trinket, n.id]); });
      }
      return out;
    };
    const empty = g => {          // a source that holds nothing at all
      let n = 0;
      for (const node of Object.values(g.nodes)) for (const c of G.worldgen.contents(node)) {
        const d = c.data || {};
        if (c.type === 'trunk' && !(d.item || d.trinket || d.scrip)) n++;
        if (c.type === 'ticket' && (!d.choices || d.choices.length !== 3 || d.choices.some(o => !(o.item || o.trinket || o.scrip)))) n++;
        if (c.type === 'plinth' && !(d.item || d.trinket || d.scrip)) n++;
      }
      return n;
    };
    // 1. no repeated id in a whole graph, with the pool of a new player (commons only) and with every cut unlocked
    for (const cuts of [[], ['pierce', 'arc', 'burst', 'ground']]) {
      G.meta.cuts = cuts;
      for (let seed = 1; seed <= 40; seed++) {
        D.newRun(seed); const g = G.run.graph; stats.seeds++;
        const ids = placed(g), seen = {};
        for (const [id, where] of ids) { if (seen[id]) bad.push('cuts ' + cuts.length + ' seed ' + seed + ': ' + id + ' at ' + seen[id] + ' and ' + where); seen[id] = where; }
        const ts = trinketsOf(g), tseen = {};
        for (const [id, where] of ts) { if (tseen[id]) bad.push('cuts ' + cuts.length + ' seed ' + seed + ': trinket ' + id + ' at ' + tseen[id] + ' and ' + where); tseen[id] = where; }
        for (const id of g.claimed) if (!G.itemDefs[id] && !G.trinketDefs[id]) bad.push('claimed list holds ' + id);
        for (const id of ids.map(x => x[0])) if (!g.claimed.includes(id)) bad.push('seed ' + seed + ': ' + id + ' is placed but not claimed');
        for (const r of Object.values(G.regionDefs)) if (r.fixedItem && !seen[r.fixedItem]) bad.push('seed ' + seed + ': fixed token ' + r.fixedItem + ' is not placed');
        const rand = ids.filter(([id]) => G.itemDefs[id].rarity !== 'fixed').length;
        if (rand > G.items.pool().length) bad.push('seed ' + seed + ': more random tokens placed than the pool holds');
        if (empty(g)) bad.push('seed ' + seed + ': a source holds nothing');
        if (g.warnings.length) bad.push('seed ' + seed + ' warnings: ' + g.warnings.join('; '));
        if (!cuts.length && G.items.pool().length <= ids.filter(([id]) => G.itemDefs[id].rarity !== 'fixed').length) stats.dry++;
        stats.filler += Object.values(g.nodes).reduce((s, n) => s + G.worldgen.contents(n).filter(c => (c.data && (c.data.scrip || (c.type === 'ticket' && c.data.choices.some(o => o.trinket || o.scrip))))).length, 0);
      }
    }
    G.meta.cuts = [];
    ok(stats.dry > 20, 'a new player\'s pool should run dry in most runs (dry in ' + stats.dry + ')');
    ok(stats.filler > 0, 'a dry pool never offered a trinket or scrip');

    // 2. replayable: the same seed gives the same sources
    for (const seed of [3, 11, 29]) {
      D.newRun(seed); const a = JSON.stringify([...Object.values(G.run.graph.nodes).map(n => [n.content, n.extras]), G.run.graph.claimed]);
      D.newRun(seed); const b = JSON.stringify([...Object.values(G.run.graph.nodes).map(n => [n.content, n.extras]), G.run.graph.claimed]);
      ok(a === b, 'seed ' + seed + ' is not repeatable');
    }

    // 3. play the sources of a run in order: the party never holds two copies, and a void token never comes back
    const heldTwice = () => { const h = G.game.partyItems(); return h.length !== new Set(h).size; };
    G.meta.cuts = ['pierce', 'arc', 'burst', 'ground'];
    for (const seed of [2, 5, 9, 14, 21]) {
      D.newRun(seed); D.god(true); G.run.shards = 5000; const p = G.players[0];
      const tap = a => { D.setInput(0, { [a]: true }); D.step(2); D.setInput(0, { [a]: false }); D.step(2); };
      const useAt = pr => { D.place(0, pr.x, pr.y); D.step(3); tap('interact'); };
      const live = () => G.rooms.current.props;
      const offered = [], seenIds = new Set();
      for (const id of Object.keys(G.run.graph.nodes)) {
        D.gotoRoom(id); G.rooms.current.enemies.length = 0; G.rooms.current.cleared = true; D.step(3);
        for (const pr of live().filter(x => x.type === 'ticket').slice()) { useAt(pr); }
        for (const pr of live().filter(x => x.type === 'plinth' && x.data.item).slice()) {
          const it = pr.data.item; offered.push(it); if (seenIds.has(it)) bad.push('seed ' + seed + ': ' + it + ' offered twice while playing'); seenIds.add(it);
        }
        // take one token from this room if any, then void the oldest held one now and then (as a punch would)
        const take = live().find(x => x.type === 'plinth' && x.data.item && !x.data.locked);
        if (take) { useAt(take); D.step(2); }
        if (heldTwice()) bad.push('seed ' + seed + ' ' + id + ': the party holds a token twice: ' + G.game.partyItems());
        if (G.game.partyItems().length >= 3) { const v = G.game.partyItems()[0]; G.game.spend(v, null); if (G.run.spent.filter(x => x === v).length > 1) bad.push('seed ' + seed + ': ' + v + ' void twice'); }
        for (const b of live().filter(x => x.type === 'booth').slice()) {
          const before = new Set([...G.game.partyItems(), ...G.run.spent, ...G.run.graph.claimed]);
          for (const cls of Object.keys(G.CLASSES)) {
            const spare = G.game.spareTokens(cls);
            for (const o of spare) if (before.has(o)) bad.push('seed ' + seed + ': the booth would offer ' + o + ' which is held, void or placed');
          }
        }
      }
      for (const v of G.run.spent) if (G.game.partyItems().includes(v)) bad.push('seed ' + seed + ': void token ' + v + ' is held again');
    }

    // 4. the clipping booth: only spare tokens; dry, it gives a trinket or scrip for the same pip and keeps the token
    const booth = (seed, cutsOn, claimAll) => {
      G.meta.cuts = cutsOn; D.newRun(seed); D.god(true); const p = G.players[0];
      const node = Object.values(G.run.graph.nodes).find(n => G.worldgen.contents(n).some(c => c.type === 'booth'));
      D.gotoRoom(node.id); G.rooms.current.enemies.length = 0;
      const start = G.items.pool().find(id => !G.run.graph.claimed.includes(id)) || 'cobalt_awl';
      p.items = [start]; p.sel = 0;
      if (claimAll) for (const id of G.items.pool()) if (!G.run.graph.claimed.includes(id)) G.run.graph.claimed.push(id);
      const b = G.rooms.current.props.find(x => x.type === 'booth'); if (claimAll) b.data.stock = [];
      D.place(0, b.x, b.y); D.step(3);
      const tap = a => { D.setInput(0, { [a]: true }); D.step(2); D.setInput(0, { [a]: false }); D.step(2); };
      tap('interact');
      const clip = G.rooms.current.props.filter(x => x.type === 'clip'); ok(clip.length === 4, 'booth shows four cuts');
      return { p, clip, claimed0: G.run.graph.claimed.slice(), spent0: G.run.spent.slice(), start };
    };
    {
      // the booth's own stock: with every cut unlocked it was given tokens when the run was built
      const ALL = ['pierce', 'arc', 'burst', 'ground'];
      G.meta.cuts = ALL; D.newRun(12);
      const bn = Object.values(G.run.graph.nodes).find(n => G.worldgen.contents(n).some(c => c.type === 'booth')), stock = G.worldgen.contents(bn).find(c => c.type === 'booth').data.stock;
      ok(stock && stock.length === 2 && new Set(stock).size === 2, 'the booth has two tokens in stock: ' + JSON.stringify(stock));
      const cut = G.itemDefs[stock[0]].cls, ctxB = booth(12, ALL, false), { p, clip, claimed0 } = ctxB, pr = clip.find(c => c.data.cls === cut), pip = p.maxHp;
      p.items = [G.items.pool().find(id => G.itemDefs[id].cls !== cut && !stock.includes(id))]; p.sel = 0; const was = p.items[0];
      D.place(0, pr.x, pr.y); D.step(3); D.setInput(0, { interact: true }); D.step(2); D.setInput(0, { interact: false }); D.step(2);
      const neu = p.items[p.sel];
      ok(stock.includes(neu) && neu !== was && G.itemDefs[neu].cls === cut, 'the booth gave ' + neu + ', not from its stock ' + stock + ' (' + cut + ')');
      ok(p.maxHp === pip - 1, 'the booth costs a pip');
      ok(!heldTwice(), 'held twice after the booth');
    }
    {
      const ctxB = booth(12, ['pierce', 'arc', 'burst', 'ground'], true);       // nothing is spare
      const { p, clip } = ctxB, held0 = p.items.slice(), pip = p.maxHp, sh0 = G.run.shards, tr0 = G.run.trinkets.length;
      const pr = clip[1]; D.place(0, pr.x, pr.y); D.step(3); D.setInput(0, { interact: true }); D.step(2); D.setInput(0, { interact: false }); D.step(2);
      ok(p.items.join() === held0.join(), 'a dry booth changed the token: ' + p.items + ' from ' + held0);
      ok(G.run.trinkets.length === tr0 + 1 || G.run.shards > sh0, 'a dry booth gave neither a trinket nor scrip');
      ok(p.maxHp === pip - 1, 'a dry booth still costs the pip it was paid');
      ok(!heldTwice(), 'held twice after a dry booth');
    }
    G.meta.cuts = [];
    // 5. a plinth never hands out a second copy
    D.newRun(4); D.god(true); D.give('cobalt_awl'); G.rooms.current.props.push(G.props.make('plinth', G.players[0].x, G.players[0].y, { item: 'cobalt_awl' }));
    D.step(3); const pl = G.rooms.current.props[G.rooms.current.props.length - 1];
    D.setInput(0, { interact: true }); D.step(2); D.setInput(0, { interact: false }); D.step(2);
    ok(G.game.partyItems().filter(x => x === 'cobalt_awl').length === 1, 'the plinth gave a second Cobalt Awl');
    return { bad, stats };
  });
  if (res.bad.length) throw new Error(res.bad.length + ' problems: ' + res.bad.slice(0, 5).join(' | '));
  return '80 graphs, dry runs ' + res.stats.dry + ', no token twice, clipping booth, replays';
};
