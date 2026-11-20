// The Timetable: every run rolls one rule card (at least eight in the deck). Each card is a small, deterministic, clearly worded rule. This check forces every
// card in turn (G.ledger.force) and proves its rule is applied, that its text is on the hub board, the map, the run-over screen and the first view of the Junction,
// that the same run code always rolls the same card, and that cards change nothing when none is in play.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, L = G.ledger, bad = [], ok = (c, m) => { if (!c) bad.push(m); }, C = G.C;
    const ALLFEATS = () => { G.meta.feats = {}; for (const f of L.FEATS) G.meta.feats[f.id] = { run: 1 }; };
    const sig = g => JSON.stringify([g.rule, g.chart, g.draw, Object.values(g.nodes).map(n => [n.def, n.content, n.extras]), Object.values(g.regions).map(r => r.delayed || 0)]);
    const census = g => G.worldgen.census(g);
    const hit = (b, sp, id, p) => { for (let i = 0; i < C.SPOT_HP; i++) b.hitSpot(sp, { cls: sp.cls, itemId: id, owner: p, dmg: 5 }); };
    const fresh = (card, seed = 5) => { L.force = card; D.newRun(seed); D.god(false); G.players.length = 1; return G.run; };
    const kill = region => { D.startBoss(region); const b = G.rooms.current.boss; D.step(130); return b; };
    const finish = b => { b.damage(1e6); D.step(3); };
    const spy = fn => { const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d'), texts = [];
      const ft = ctx.fillText.bind(ctx); ctx.fillText = (t, ...r) => { texts.push(String(t)); return ft(t, ...r); };
      const lb = G.art.label; G.art.label = function (c, t, ...r) { texts.push(String(t)); return lb.call(this, c, t, ...r); };
      try { fn(ctx); } finally { G.art.label = lb; } return texts.join(' | '); };

    // ---- the deck
    ok(L.CARDS.length >= 8, 'the deck has ' + L.CARDS.length + ' cards (at least 8)');
    for (const c of L.CARDS) { const r = L.makeRule(c.id, 9); ok(r && r.name && r.text && r.text.length > 25 && /[.]$/.test(r.text), c.id + ': no clear one-sentence text'); ok(!/undefined|NaN/.test(r.text), c.id + ': text has a hole: ' + r.text); }
    G.meta.feats = {};
    const base = new Set(), allc = new Set(), cardOf = {};
    for (let seed = 1; seed <= 300; seed++) {
      const a = L.rollRule(seed, []), b = L.rollRule(seed, []); base.add(a.id);
      ok(JSON.stringify(a) === JSON.stringify(b), 'seed ' + seed + ': the card is not repeatable');
      ok(!L.CARDS.find(c => c.id === a.id).locked, 'seed ' + seed + ': a locked card was rolled with nothing unlocked: ' + a.id);
      allc.add(L.rollRule(seed, L.LOCKED_CARDS).id); cardOf[a.id] = (cardOf[a.id] || 0) + 1;
    }
    ok(base.size === L.CARDS.filter(c => !c.locked).length, 'with nothing unlocked only ' + base.size + ' cards ever came up');
    ok(allc.size === L.CARDS.length, 'with everything unlocked only ' + allc.size + ' cards ever came up');
    // no hidden randomness: the run's rng and the clock do not move the card or the world
    L.force = null; G.meta.feats = {}; D.newRun(77); const c0 = G.run.rule.id, w0 = sig(G.run.graph);
    for (let i = 0; i < 50; i++) G.run.rng(); D.step(30); D.newRun(77); ok(G.run.rule.id === c0 && sig(G.run.graph) === w0, 'the card or world changed between two runs of one seed');

    // ---- every card applies its rule
    ALLFEATS();
    // Rebate Day: every token punched in a Clean fight comes back (the first only, without the card)
    for (const [card, want] of [['rebate_day', 3], ['none', 1]]) {
      fresh(card); const b = kill('r1'), p = G.players[0]; p.items = [];
      G.run.spent.push('cobalt_awl', 'ochre_ladle', 'cinder_bell'); b.spent0 = 0; b.hits0 = G.run.stats.hits; finish(b);
      const g = G.run.grades.r1; ok(g && g.clean && (g.refunds || []).length === want && p.items.length === want, card + ': ' + (g && (g.refunds || []).length) + ' tokens came back (wanted ' + want + ')');
      ok(card === 'none' ? G.run.spent.length === 2 : G.run.spent.length === 0, card + ': void list ' + G.run.spent);
    }
    // Scrip Boom: drops doubled, the Warden's scrip doubled, no kiosk
    fresh('scrip_boom'); G.combat.clear(); G.combat.dropShards(0, 0, 10); ok(Math.round(G.pickups.reduce((s, k) => s + k.value, 0)) === 20, 'Scrip Boom: a drop of 10 gave ' + G.pickups.reduce((s, k) => s + k.value, 0));
    { const s0 = G.run.shards; finish(kill('r1')); ok(G.run.shards - s0 >= 80, 'Scrip Boom: the Warden gave ' + (G.run.shards - s0)); }
    fresh('none'); G.combat.clear(); G.combat.dropShards(0, 0, 10); ok(Math.round(G.pickups.reduce((s, k) => s + k.value, 0)) === 10, 'no card: a drop of 10 gave ' + G.pickups.reduce((s, k) => s + k.value, 0));
    for (let seed = 1; seed <= 20; seed++) { fresh('scrip_boom', seed); ok(census(G.run.graph).kioskWares === 0, 'Scrip Boom seed ' + seed + ': the kiosk still sells'); fresh('none', seed); ok(census(G.run.graph).kioskWares === 3, 'no card seed ' + seed + ': the kiosk is not open'); }
    // Short Shift: the Long Clock borrows one attack fewer
    fresh('none'); const full = G.game.borrows().map(x => x.region); fresh('short_shift'); const less = G.game.borrows().map(x => x.region);
    ok(full.length === 4 && less.length === 3 && less.join() === full.slice(1).join(), 'Short Shift: borrows ' + less + ' against ' + full);
    G.run.beaten.r1 = G.run.beaten.r2 = G.run.beaten.r3 = G.run.beaten.r4 = true; ok(G.game.borrows().length === 0, 'Short Shift: borrows with all Wardens beaten');
    // Late Running: the named line is crowded (nothing thinned out: never fewer enemies than the same seed without the card); Wreck Quay is never chosen
    const mainFoes = (g, r) => g.regions[r].nodes.filter(id => !g.nodes[id].parent && G.roomDefs[g.nodes[id].def].kind === 'main').reduce((s, id) => s + g.nodes[id].content.filter(c => c && c.type === 'enemy').length, 0), lates = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      fresh('late_running', seed); const g = G.run.graph, r = g.rule.region; lates.add(r);
      ok(['r2', 'r3', 'r4'].includes(r), 'Late Running seed ' + seed + ': region ' + r);
      ok(g.regions[r].delayed && Object.keys(g.regions).filter(k => g.regions[k].delayed).length === 1, 'Late Running seed ' + seed + ': delayed flags');
      const late = mainFoes(g, r); fresh('none', seed); ok(late >= mainFoes(G.run.graph, r), 'Late Running seed ' + seed + ': ' + r + ' has ' + late + ' enemies against ' + mainFoes(G.run.graph, r) + ' without the card');
    }
    ok(lates.size === 3, 'Late Running only ever picked ' + [...lates]);
    // Dry Pipes: no standpipes; a Warden mends the whole party
    for (let seed = 1; seed <= 10; seed++) { fresh('dry_pipes', seed); ok(census(G.run.graph).standpipes.length === 0, 'Dry Pipes seed ' + seed + ': standpipes ' + census(G.run.graph).standpipes); }
    fresh('dry_pipes'); { const b = kill('r1'); G.players[0].hp = 1; finish(b); ok(G.players[0].hp === G.players[0].maxHp, 'Dry Pipes: a Warden left the party at ' + G.players[0].hp + ' of ' + G.players[0].maxHp); }
    fresh('none'); { const b = kill('r1'); G.players[0].hp = 1; finish(b); ok(G.players[0].hp < G.players[0].maxHp, 'no card: a Warden mended the party'); }
    // Packed Lunch: one extra token in the party's hands, drawn from the run
    fresh('packed_lunch'); ok(G.game.partyItems().length === 1 && G.run.graph.draw.start[0] === G.game.partyItems()[0], 'Packed Lunch: the party holds ' + G.game.partyItems());
    { const s = G.run.graph.draw.start[0], c = census(G.run.graph); ok(!Object.values(c.fixed).some(f => f.item === s), 'Packed Lunch: its token is also on a plinth'); }
    fresh('none'); ok(G.game.partyItems().length === 0, 'no card: the party starts with ' + G.game.partyItems());
    // Wide Plates: 4 hits, 15%; restored the next run
    fresh('wide_plates'); ok(C.SPOT_HP === 4 && Math.abs(C.BREAK_FRAC - 0.15) < 1e-9, 'Wide Plates: SPOT_HP ' + C.SPOT_HP + ' BREAK_FRAC ' + C.BREAK_FRAC);
    D.chart('r1', ['pierce', 'arc', 'burst']); D.give('cobalt_awl'); { const b = kill('r1'), sp = b.spots.find(s => s.cls === 'pierce'), hp0 = b.hp; ok(sp.hp === 4, 'Wide Plates: a slot has ' + sp.hp + ' hits');
      hit(b, sp, 'cobalt_awl', G.players[0]); ok(sp.broken && Math.abs((hp0 - b.hp) / b.maxHp - 0.15) < 1e-6, 'Wide Plates: the punch took ' + ((hp0 - b.hp) / b.maxHp)); }
    fresh('none'); ok(C.SPOT_HP === 3 && C.BREAK_FRAC === 0.1, 'the constants were not restored: ' + C.SPOT_HP + ' ' + C.BREAK_FRAC);
    // Stopwatch: Par gives a pip, Clean 20 scrip
    fresh('stopwatch'); { const b = kill('r1'), pips = G.players[0].maxHp, s0 = G.run.shards; b.clock = 10; b.hits0 = G.run.stats.hits; finish(b);
      ok(G.players[0].maxHp === pips + 2, 'Stopwatch: pips ' + (G.players[0].maxHp - pips) + ' (a Par Warden gives 1 + 1)'); ok(G.run.shards - s0 >= 60, 'Stopwatch: scrip ' + (G.run.shards - s0)); }
    fresh('stopwatch'); { const b = kill('r1'), pips = G.players[0].maxHp; b.clock = 500; G.run.stats.hits++; finish(b); ok(G.players[0].maxHp === pips + 1, 'Stopwatch: a slow fight with a hit gave ' + (G.players[0].maxHp - pips)); }
    // Brittle Stock: the named cut is worth double and its tokens crack after two uses
    for (const cut of ['pierce', 'arc', 'burst', 'ground']) {
      let seed = 1; for (; seed < 200; seed++) { L.force = 'brittle_stock'; if (L.makeRule('brittle_stock', seed).cut === cut) break; }
      fresh('brittle_stock', seed); const tok = Object.values(G.itemDefs).find(d => d.cls === cut && d.rarity === 'common').id, other = Object.values(G.itemDefs).find(d => d.cls !== cut && d.rarity === 'common').id;
      ok(G.run.rule.cut === cut, 'Brittle Stock: named cut ' + G.run.rule.cut + ' wanted ' + cut);
      const p = G.players[0]; p.items = [tok, other]; p.sel = 0; p.itemCd = 0; D.gotoRoom('junction'); G.rooms.current.enemies.length = 0;
      G.itemDefs[tok].use(p); ok(p.items.includes(tok), cut + ': cracked after one use'); G.itemDefs[tok].use(p); ok(!p.items.includes(tok) && G.run.cracked.includes(tok), cut + ': not cracked after two uses: ' + p.items);
      G.itemDefs[other].use(p); G.itemDefs[other].use(p); G.itemDefs[other].use(p); ok(p.items.includes(other), 'Brittle Stock: a token of another cut cracked');
      const chart = [cut, ...['pierce', 'arc', 'burst', 'ground'].filter(c => c !== cut).slice(0, 2)]; D.chart('r1', chart);
      p.items = [tok, other]; { const b = kill('r1'), sp = b.spots.find(s => s.cls === cut), sp2 = b.spots.find(s => s.cls === G.itemDefs[other].cls), hp0 = b.hp;
        if (sp) { hit(b, sp, tok, p); ok(Math.abs((hp0 - b.hp) / b.maxHp - 0.2) < 1e-6, cut + ': its punch took ' + ((hp0 - b.hp) / b.maxHp) + ' (wanted 0.2)'); }
        if (sp2) { const h1 = b.hp; D.step(1); hit(b, sp2, other, p); ok(Math.abs((h1 - b.hp) / b.maxHp - 0.1) < 1e-2, 'another cut\'s punch took ' + ((h1 - b.hp) / b.maxHp)); } }
    }
    // Long Haul: every Warden has 25% more health and gives two pips
    fresh('none'); const hp0 = kill('r1').maxHp; fresh('long_haul');
    { const b = kill('r1'), pips = G.players[0].maxHp; ok(Math.abs(b.maxHp / hp0 - 1.25) < 1e-6, 'Long Haul: Warden hp ' + b.maxHp + ' against ' + hp0); finish(b); ok(G.players[0].maxHp === pips + 2, 'Long Haul: a Warden gave ' + (G.players[0].maxHp - pips) + ' pips'); }

    // ---- the text is shown: the hub board, the map, the run-over screen and the first view of the Junction (all ten cards)
    for (const c of L.CARDS) {
      fresh(c.id, 3); const r = G.run.rule, first = r.text.split(' ').slice(0, 3).join(' ');
      const plate = G.rooms.current.props.find(p => p.type === 'timetable'); ok(!!plate, c.id + ': no card on the hub board');
      const t1 = spy(ctx => plate && plate.draw(ctx)); ok(t1.includes(r.name), c.id + ': the board does not name the card'); ok(t1.includes(first.split(' ')[0]), c.id + ': the board does not carry its text');
      const t2 = spy(ctx => G.map.draw(ctx)); ok(t2.includes('Timetable: ' + r.name) && t2.includes(r.text.slice(0, 20)), c.id + ': the map does not show the card');
      G.run.over = 'dead'; const t3 = spy(ctx => G.menus.over(ctx)); G.run.over = null; ok(t3.includes(r.name) && t3.includes(r.text.slice(0, 20)), c.id + ': the run-over screen does not show the card');
      // the first view: one message at a time. A story banner (or the room-name card) holds the card back; it shows once they are gone, and ends after 8 s of free screen.
      G.state = 'play'; const room = G.rooms.current; G.tips.shown = null; G.fx.banner = { a: 'The Last Timetable', b: 'x', t: 3, max: 3 }; room.enterAt = G.time - 10;
      G.ledgerIntro.run = null; const tb = spy(ctx => G.hud.draw(ctx)); ok(!tb.includes('TIMETABLE FOR THIS RUN'), c.id + ': the card is drawn over a story banner');
      G.fx.banner = null; const t4 = spy(ctx => G.hud.draw(ctx)); ok(t4.includes(r.name), c.id + ': the first view of the Junction does not show the card after the banner');
      room.enterAt = G.time - 0.5; ok(!spy(ctx => G.hud.draw(ctx)).includes('TIMETABLE FOR THIS RUN'), c.id + ': the card is drawn over the room-name card'); room.enterAt = G.time - 10;
      G.ledgerIntro.left = 0.01; G.time += 0.05; spy(ctx => G.hud.draw(ctx)); G.time += 0.05; ok(!spy(ctx => G.hud.draw(ctx)).includes('TIMETABLE FOR THIS RUN'), c.id + ': the intro card stays on screen');
      if (c.id === 'late_running') ok(t2.includes('Running late'), 'the map does not mark the late line');
    }
    // the hub board's card does not overlap the lock chart
    fresh('none'); { const ps = G.rooms.current.props, cv = document.createElement('canvas').getContext('2d'), bd = G.props.boxes(ps.find(p => p.type === 'board'), cv)[0], tt = G.props.boxes(ps.find(p => p.type === 'timetable'), cv)[0];
      ok(tt.x0 >= bd.x1 + 8 || tt.x1 <= bd.x0 - 8, 'the Timetable plate overlaps the lock chart'); }
    L.force = null; G.meta.feats = {};
    return { bad, cardOf };
  });
  if (res.bad.length) throw new Error(res.bad.length + ' problems: ' + res.bad.slice(0, 4).join(' | '));
  return '10 cards, each applies its rule and shows its text on the board, map, run-over screen and first view; deterministic (' + Object.keys(res.cardOf).length + ' cards seen with a new save)';
};
