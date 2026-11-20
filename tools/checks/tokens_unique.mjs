// A token turns up once per run. Every source (guarded plinths, trunks, the ticket machine, kiosk) draws only ids that are not
// held, not void and not already placed or offered elsewhere in the run; a source whose drawn token is missing offers a trinket or scrip, never a copy; seeds replay.
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
        else if (c.type === 'ticket') (d.choices || []).concat(d.next || []).forEach(o => { if (o.item) out.push([o.item, n.id + ' ticket']); });
      }
      return out;
    };
    const trinketsOf = g => {
      const out = [];
      for (const n of Object.values(g.nodes)) for (const c of G.worldgen.contents(n)) {
        const d = c.data || {};
        if (c.type === 'plinth' && d.trinket) out.push([d.trinket, n.id]); else if (c.type === 'trunk' && d.trinket) out.push([d.trinket, n.id]);
        else if (c.type === 'ticket') (d.choices || []).concat(d.next || []).forEach(o => { if (o.trinket) out.push([o.trinket, n.id]); });
      }
      return out;
    };
    const empty = g => {          // a source that holds nothing at all
      let n = 0;
      for (const node of Object.values(g.nodes)) for (const c of G.worldgen.contents(node)) {
        const d = c.data || {};
        if (c.type === 'trunk' && !(d.item || d.trinket || d.scrip)) n++;
        if (c.type === 'ticket' && (!d.choices || d.choices.length !== 3 || !d.next || d.next.length !== 3 || d.choices.concat(d.next).some(o => !(o.item || o.trinket || o.scrip)))) n++;
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
        const drawn = g.draw.all.filter(id => !g.draw.start.includes(id));
        for (const id of drawn) if (!seen[id]) bad.push('seed ' + seed + ': drawn token ' + id + ' is not placed');
        if (ids.length > G.items.pool().length) bad.push('seed ' + seed + ': more tokens placed than the pool holds');
        if (empty(g)) bad.push('seed ' + seed + ': a source holds nothing');
        if (g.warnings.length) bad.push('seed ' + seed + ' warnings: ' + g.warnings.join('; '));
        stats.filler += Object.values(g.nodes).reduce((s, n) => s + G.worldgen.contents(n).filter(c => (c.data && (c.data.scrip || (c.type === 'ticket' && c.data.choices.concat(c.data.next).some(o => o.trinket || o.scrip))))).length, 0);
      }
    }
    G.meta.cuts = [];
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
      }
      for (const v of G.run.spent) if (G.game.partyItems().includes(v)) bad.push('seed ' + seed + ': void token ' + v + ' is held again');
    }

    G.meta.cuts = [];
    // 4. a plinth never hands out a second copy
    D.newRun(4); D.god(true); D.give('cobalt_awl'); G.rooms.current.props.push(G.props.make('plinth', G.players[0].x, G.players[0].y, { item: 'cobalt_awl' }));
    D.step(3); const pl = G.rooms.current.props[G.rooms.current.props.length - 1];
    D.setInput(0, { interact: true }); D.step(2); D.setInput(0, { interact: false }); D.step(2);
    ok(G.game.partyItems().filter(x => x === 'cobalt_awl').length === 1, 'the plinth gave a second Cobalt Awl');
    return { bad, stats };
  });
  if (res.bad.length) throw new Error(res.bad.length + ' problems: ' + res.bad.slice(0, 5).join(' | '));
  return '80 graphs, dry runs ' + res.stats.dry + ', no token twice, replays';
};
