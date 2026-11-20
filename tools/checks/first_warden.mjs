// The first Warden for a fresh player. A new player must meet a token before the Tollkeeper and be told how to get one, the slots must say what they need,
// and a shut trunk must say what it waits for.
//  - every seed, every Timetable card: one lost trunk stands in a main room of Wreck Quay (before its arena) and holds a token of one of the Tollkeeper's three cuts
//  - the Station Keeper's first line points at that trunk; no token carried: the Warden's banner names the missing cuts and says slashes still work, its sealed slots
//    say which token they need, and it has 15% less health than with a token carried
//  - a shut trunk shows "clear the room ... (N left)" at the top; after 20 s the last enemies are ringed; the trunk's prompt counts the enemies; clearing removes both
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, L = G.ledger, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const spy = fn => { const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d'), texts = [];
      const ft = ctx.fillText.bind(ctx); ctx.fillText = (t, ...r) => { texts.push(String(t)); return ft(t, ...r); };
      const lb = G.art.label; G.art.label = function (c, t, ...r) { texts.push(String(t)); return lb.call(this, c, t, ...r); };
      try { fn(ctx); } finally { G.art.label = lb; } return texts.join(' | '); };
    const cards = ['none', ...L.CARDS.map(c => c.id)];
    for (let seed = 1; seed <= 24; seed++) {
      L.force = cards[seed % cards.length]; D.newRun(seed); const g = G.run.graph, r1 = g.regions.r1;
      const trunks = r1.nodes.flatMap(id => G.worldgen.contents(g.nodes[id]).filter(c => c.type === 'trunk').map(c => ({ id, c })));
      ok(trunks.length >= 1, 'seed ' + seed + ' (' + L.force + '): no lost trunk in Wreck Quay');
      const t = trunks[0]; if (!t) continue;
      ok(G.roomDefs[g.nodes[t.id].def].kind === 'main' && g.nodes[t.id].def !== g.nodes[r1.arena].def, 'seed ' + seed + ': the trunk is not in a main room');
      const item = t.c.data.item; ok(!!item, 'seed ' + seed + ': the Wreck Quay trunk holds ' + JSON.stringify(t.c.data));
      if (item) ok(g.chart.r1.includes(G.itemDefs[item].cls), 'seed ' + seed + ': trunk token ' + item + ' (' + G.itemDefs[item].cls + ') is not a cut of the Tollkeeper: ' + g.chart.r1);
      ok(G.worldgen.census(g).trunks === 2 && G.worldgen.census(g).trunksInMain === 2, 'seed ' + seed + ': trunk counts');
    }
    L.force = 'none'; D.newRun(3); D.god(false); G.players.length = 1;
    // the Station Keeper
    D.gotoRoom(G.run.graph.hub); const guide = G.rooms.current.props.find(p => p.type === 'guide');
    if (guide) { G.fx.banner = null; G.props.TYPES.guide.interact(guide, G.players[0]); ok(/trunk/i.test(G.fx.banner.b) && /token/i.test(G.fx.banner.b), 'the Station Keeper does not mention the trunk: ' + G.fx.banner.b); G.fx.banner = null; }
    else bad.push('no Station Keeper in the Junction');
    // the Warden's banner with and without a token; the sealed slot says what it needs
    const start = () => { D.startBoss('r1'); const b = G.rooms.current.boss; return b; };
    G.players[0].items = []; G.run.items = []; const b0 = start(), say0 = G.fx.banner && G.fx.banner.b || '';
    ok(/slash/i.test(say0) && /trunk|plinth|ticket/i.test(say0), 'no-token banner: ' + say0);
    for (const c of G.run.graph.chart.r1) ok(say0.includes(c), 'no-token banner does not name the cut ' + c + ': ' + say0);
    const full = G.bossDefs.tollkeeper.hp; ok(Math.abs(b0.maxHp - full * 0.85) < 1e-6, 'no token: max hp ' + b0.maxHp + ' of ' + full);
    const sp = b0.spots[0]; b0.sealedT = 0; b0.hitSpot(sp, { cls: sp.cls, dmg: 0 });
    ok((G.fx.floaters || []).some(f => /needs a/.test(f.text || f.t || '')), 'a sealed slot does not say which token it needs');
    const id = Object.values(G.itemDefs).find(d => d.cls === G.run.graph.chart.r1[0] && d.rarity === 'common').id; D.newRun(3); D.god(false); G.players.length = 1; D.give(id);
    const b1 = start(); ok(Math.abs(b1.maxHp - full) < 1e-6, 'a token carried: max hp ' + b1.maxHp + ' of ' + full);
    // the trunk objective
    L.force = 'none'; D.newRun(3); D.god(true); G.players.length = 1;
    const g = G.run.graph, node = g.regions.r1.nodes.find(nid => G.worldgen.contents(g.nodes[nid]).some(c => c.type === 'trunk'));
    D.gotoRoom(node); const room = G.rooms.current; G.fx.banner = null; G.tips.shown = null; room.enterAt = G.time - 5;
    const tr = room.props.find(p => p.type === 'trunk'); ok(!!tr, 'no trunk prop in the room');
    const foes = room.enemies.length; ok(foes > 0, 'the trunk room has no enemies');
    const t1 = spy(ctx => G.hud.draw(ctx)); ok(/clear the room to open it \(\d+ left\)/.test(t1), 'no objective line: ' + t1.slice(0, 80)); ok(G.objective.marks === 0, 'enemies ringed too early');
    ok(/left/.test(G.props.TYPES.trunk.prompt(tr)[2]), 'trunk prompt: ' + G.props.TYPES.trunk.prompt(tr)[2]);
    room.enterAt = G.time - 25; room.enemies.slice(2).forEach(e => { e.hp = 0; e.dead = true; }); room.enemies = room.enemies.filter(e => !e.dead);
    spy(ctx => G.hud.draw(ctx)); ok(G.objective.marks === Math.min(2, room.enemies.length) && G.objective.marks > 0, 'the last enemies are not marked after 20 s: ' + G.objective.marks);
    G.fx.banner = { a: 'x', b: 'y', t: 3, max: 3 }; ok(!/clear the room/.test(spy(ctx => G.hud.draw(ctx))), 'the objective line is drawn over a banner'); G.fx.banner = null;
    room.enemies.length = 0; room.cleared = true; ok(!/clear the room/.test(spy(ctx => G.hud.draw(ctx))), 'the objective line stays after the room is clear');
    return bad;
  });
  if (res.length) throw new Error(res.length + ' problems: ' + res.slice(0, 8).join(' | '));
  return 'every seed and card: a Wreck Quay trunk with a token for the Tollkeeper; Keeper, banner, slot text, hp and the trunk objective';
};
