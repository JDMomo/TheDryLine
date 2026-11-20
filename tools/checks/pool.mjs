// The token pool: 16 tokens, four per cut, each with material tags, a card line and a code-drawn icon. A run draws only about 7 of the pool for its sources
// (4 guarded plinths, 2 lost trunks, 1 ticket machine; a card or a starting-token choice adds one in the party's hands), so which tokens exist differs every run.
// Each region's plinth holds a token of a cut that the run's lock chart makes useful on the next Warden in the ring. A token turns up once per run.
// The same run code gives the same draw on any save.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const CUTS = ['pierce', 'arc', 'burst', 'ground'], ALL = Object.keys(G.itemDefs), stats = {};
    // ---- 16 valid tokens
    ok(ALL.length === 16, 'expected 16 tokens, found ' + ALL.length);
    for (const cut of CUTS) ok(ALL.filter(id => G.itemDefs[id].cls === cut).length === 4, cut + ' does not have four tokens');
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const ctx = cv.getContext('2d');
    for (const id of ALL) {
      const d = G.itemDefs[id];
      ok(/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(d.name), id + ': name is not "Mineral Tool": ' + d.name);
      ok(Array.isArray(d.mat) && d.mat.length >= 1 && d.mat.length <= 2 && d.mat.every(t => G.MATERIALS[t]), id + ': material tags');
      ok(typeof d.inter === 'string' && d.inter.length > 12 && d.inter.length <= 170, id + ': card line');
      ok(d.desc && d.desc.length > 20, id + ': description (the twist)');
      ok(['common', 'rare', 'fixed', 'ledger'].includes(d.rarity), id + ': rarity ' + d.rarity);
      ok(typeof d.drawIcon === 'function', id + ': no code-drawn icon');
      try { ctx.clearRect(0, 0, 64, 64); G.items.icon(ctx, id, 32, 32, 1); } catch (e) { bad.push(id + ': icon threw ' + e.message); }
    }
    const names = ALL.map(id => G.itemDefs[id].name); ok(new Set(names).size === 16, 'token names are not unique');
    ok(ALL.filter(id => G.itemDefs[id].rarity === 'ledger').length === 4, 'four ledger tokens expected');
    // ---- pool by save state
    G.meta.cuts = []; G.meta.feats = {};
    ok(G.items.pool().length === 8, 'a new save should have 8 tokens in the pool, has ' + G.items.pool().length);
    G.meta.cuts = CUTS.slice(); ok(G.items.pool().length === 12, 'all cuts punched: 12 tokens, has ' + G.items.pool().length);
    for (const f of G.ledger.FEATS) G.meta.feats[f.id] = { run: 1 };
    ok(G.items.pool().length === 16, 'everything unlocked: 16 tokens, has ' + G.items.pool().length);
    // ---- per run: about 7 of the pool, unique, chart-useful
    const placed = g => {
      const out = [];
      for (const n of Object.values(g.nodes)) for (const c of G.worldgen.contents(n)) {
        const d = c.data || {};
        if ((c.type === 'plinth' || c.type === 'trunk') && d.item) out.push(d.item);
        else if (c.type === 'ticket') (d.choices || []).concat(d.next || []).forEach(o => { if (o.item) out.push(o.item); });
      }
      return out;
    };
    const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), ring = order.filter(r => r.plinth);
    const seen = new Set(), sets = new Set(), counts = {}, cutSpread = {};
    G.ledger.force = 'none';
    for (const [label, cuts, feats] of [['new save', [], false], ['everything unlocked', CUTS, true]]) {
      G.meta.cuts = cuts.slice(); G.meta.feats = {}; if (feats) for (const f of G.ledger.FEATS) G.meta.feats[f.id] = { run: 1 };
      for (let seed = 1; seed <= 80; seed++) {
        D.newRun(seed); const g = G.run.graph, ids = placed(g), tag = label + ' seed ' + seed;
        counts[ids.length] = (counts[ids.length] || 0) + 1;
        ok(ids.length === 7, tag + ': ' + ids.length + ' tokens placed (wanted 7)');
        ok(new Set(ids).size === ids.length, tag + ': a token is placed twice');
        ok(ids.every(id => G.items.pool().includes(id)), tag + ': a token outside the pool was placed');
        ok(ids.every(id => g.claimed.includes(id)), tag + ': a placed token is not claimed');
        ring.forEach((r, k) => {
          const id = g.draw.plinth[r.id], next = ring[(k + 1) % ring.length];
          ok(!!id && G.itemDefs[id], tag + ': no token drawn for the plinth of ' + r.id);
          if (id) ok(g.chart[next.id].includes(G.itemDefs[id].cls), tag + ': the plinth of ' + r.id + ' holds a ' + G.itemDefs[id].cls + ' token, which has no slot on ' + next.id + ' (' + g.chart[next.id] + ')');
        });
        const cutsOnPlinths = new Set(ring.map(r => G.itemDefs[g.draw.plinth[r.id]].cls)).size; cutSpread[cutsOnPlinths] = (cutSpread[cutsOnPlinths] || 0) + 1;
        ok(cutsOnPlinths >= 3, tag + ': the four plinths hold only ' + cutsOnPlinths + ' cuts');
        const c = G.worldgen.census(g); ok(Object.keys(c.fixed).length === 4 && ring.every(r => c.fixed[r.id] && c.fixed[r.id].item === g.draw.plinth[r.id]), tag + ': a plinth does not hold its drawn token');
        if (feats) { sets.add(ids.slice().sort().join()); ids.forEach(id => seen.add(id)); }
      }
    }
    ok(sets.size >= 40, 'with everything unlocked 80 seeds gave only ' + sets.size + ' different token sets');
    ok(seen.size === 16, 'over 80 seeds only ' + seen.size + ' of 16 tokens were ever drawn');
    // a new save: 7 of the 8 in the pool, which one is left out varies
    G.meta.cuts = []; G.meta.feats = {}; const left = new Set();
    for (let seed = 1; seed <= 60; seed++) { D.newRun(seed); const ids = placed(G.run.graph); left.add(G.items.pool().find(id => !ids.includes(id))); }
    ok(left.size >= 4, 'a new save always leaves out the same few tokens (' + [...left] + ')');
    // ---- reproducible: the same seed, and the same run code on another save
    G.meta.cuts = ['arc']; G.meta.feats = { clean_r1: { run: 1 }, clean_r3: { run: 1 } };
    D.newRun(31); const code = G.run.code, a = JSON.stringify([G.run.graph.draw, G.run.graph.rule, G.run.graph.chart, Object.values(G.run.graph.nodes).map(n => [n.def, n.content, n.extras])]);
    D.newRun(31); ok(a === JSON.stringify([G.run.graph.draw, G.run.graph.rule, G.run.graph.chart, Object.values(G.run.graph.nodes).map(n => [n.def, n.content, n.extras])]), 'the same seed drew a different world');
    G.meta.cuts = []; G.meta.feats = {}; G.meta.opts = { start: null, express: false };
    D.newRun(code); ok(G.run.code === code && a === JSON.stringify([G.run.graph.draw, G.run.graph.rule, G.run.graph.chart, Object.values(G.run.graph.nodes).map(n => [n.def, n.content, n.extras])]), 'the run code ' + code + ' did not replay on an empty save');
    ok(/\./.test(code), 'a code with ledger unlocks has no ledger part: ' + code);
    // a chosen starting token leaves the pool for that run and is in the party's hands
    G.meta.cuts = []; G.meta.feats = { punch_all: { run: 1 } }; G.meta.opts = { start: 'arc', express: false };
    D.newRun(8); const st = G.run.graph.draw.start, ids = placed(G.run.graph);
    ok(st.length === 1 && G.itemDefs[st[0]].cls === 'arc' && G.itemDefs[st[0]].rarity === 'common', 'starting token ' + st);
    ok(G.game.partyItems().join() === st.join(), 'the party does not hold the starting token: ' + G.game.partyItems());
    ok(!ids.includes(st[0]) && ids.length === 7, 'the starting token was also placed, or the count changed (' + ids.length + ')');
    return { bad, counts, cutSpread, sets: sets.size, left: left.size };
  });
  if (res.bad.length) throw new Error(res.bad.length + ' problems: ' + res.bad.slice(0, 4).join(' | '));
  return '16 tokens, 7 per run (' + JSON.stringify(res.counts) + '), ' + res.sets + ' different token sets in 80 seeds, plinths follow the chart, runs replay';
};
