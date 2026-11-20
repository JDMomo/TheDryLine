// Movement unlocks open things. Each region's guarded room (its own branch room, holding the plinth token) needs the movement unlock of the previous
// region in the ring: r2 needs Dash (from r1), r3 Wall Grip (from r2), r4 Double Jump (from r3), r1 Heavy Cut (from r4).
//   - the room declares it in `needs` (the room validator, checks/rooms.mjs, proves both directions on every guarded room: reachable with
//     the ability, unreachable without it; this check covers the wiring around it)
//   - every doorway into a guarded room says which move it needs (tag over the door, prompt), and so does the map, before the player walks in
//   - the cracked barrier (template marker X, Heavy Cut) blocks a player, a plain slash only rings off it, a heavy cut breaks it for good
//   - 12 seeds: every guarded room is there, the world has no dead end and nothing unreachable
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const RING = { r1: 'heavy', r2: 'dash', r3: 'grip', r4: 'double' };           // region -> the ability its guarded room needs
    const regions = Object.values(G.regionDefs).filter(r => r.plinth).sort((a, b) => a.gate - b.gate);
    ok(regions.length === 4, 'four regions with a guarded plinth, found ' + regions.length);
    regions.forEach((r, i) => {
      const prev = regions[(i + regions.length - 1) % regions.length];
      ok(RING[r.id] === prev.ability, r.id + ': the ring wants ' + RING[r.id] + ' but the previous region (' + prev.id + ') grants ' + prev.ability);
    });
    const info = {};
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]) {
      D.newRun(seed); const g = G.run.graph, chk = G.worldgen.check(g);
      ok(!chk.unreachable.length && !chk.deadEnds.length, 'seed ' + seed + ': ' + JSON.stringify(chk));
      for (const r of regions) {
        const own = g.regions[r.id].own, node = own && g.nodes[own], def = node && G.roomDefs[node.def];
        ok(!!def, 'seed ' + seed + ' ' + r.id + ': no guarded room');
        if (!def) continue;
        ok((def.needs || []).join() === RING[r.id], 'seed ' + seed + ' ' + r.id + ': ' + def.id + ' needs ' + (def.needs || []) + ', want ' + RING[r.id]);
        const parent = g.nodes[node.parent], door = parent.content.find(c => c && c.type === 'door' && c.data.to === node.id);
        ok(door && (door.data.needs || []).join() === RING[r.id] && /^Needs /.test(door.data.tag), 'seed ' + seed + ' ' + r.id + ': the doorway does not name the move: ' + JSON.stringify(door && door.data));
        // no other room (main, trial, shared branch) declares a need
        for (const id of g.regions[r.id].nodes) { const d = G.roomDefs[g.nodes[id].def]; if (id !== own && (d.needs || []).length) bad.push('seed ' + seed + ': ' + d.id + ' declares needs but is not a guarded room'); }
      }
    }
    // the doorway prompt and the map name the move before the player walks in (seed 5)
    D.newRun(5); D.unlockAll && 0;
    const g = G.run.graph, cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    const texts = []; const ft = ctx.fillText.bind(ctx); ctx.fillText = (t, ...r) => { texts.push(String(t)); return ft(t, ...r); };
    const lb = G.art.label; G.art.label = (c, t, ...r) => { texts.push(String(t)); return lb.call(G.art, c, t, ...r); };
    for (const r of regions) {
      const node = g.nodes[g.regions[r.id].own], parent = g.nodes[node.parent];
      G.run.abil[RING[r.id]] = false; parent.seen = true;
      D.gotoRoom(parent.id);
      const pr = G.rooms.current.props.find(p => p.type === 'door' && p.data.to === node.id);
      ok(!!pr, r.id + ': no doorway prop');
      if (!pr) continue;
      const name = G.abilityDefs[RING[r.id]].name, p0 = pr.prompt(G.players[0]).join(' ');
      ok(p0.includes(name) && /found in/.test(p0), r.id + ': doorway prompt without the move: ' + p0);
      G.run.abil[RING[r.id]] = true;
      ok(/You have it/.test(pr.prompt(G.players[0]).join(' ')), r.id + ': doorway prompt does not notice the move was found');
      G.run.abil[RING[r.id]] = false;
      texts.length = 0; pr.draw(ctx); ok(texts.includes('Needs ' + name), r.id + ': the door does not wear its tag: ' + texts);
    }
    texts.length = 0; G.map.draw(ctx);
    const mt = texts.join(' | ');
    for (const r of regions) ok(mt.includes('needs ' + G.abilityDefs[RING[r.id]].name), 'the map does not say "needs ' + G.abilityDefs[RING[r.id]].name + '"');
    G.art.label = lb;
    // the cracked barrier, in the real r1 guarded room
    D.newRun(5); D.god(true);
    const own = G.run.graph.regions.r1.own; D.gotoRoom(own); G.run.abil.heavy = false;
    const room = G.rooms.current, crack = room.props.find(p => p.type === 'crack'), p = G.players[0];
    ok(!!crack, 'r1 guarded room has no cracked barrier prop');
    if (crack) {
      const T = 32, bx = crack.x;
      D.place(0, bx - 150, crack.y, 1); D.step(5);
      D.setInput(0, { right: true }); D.step(240); D.setInput(0, { right: false });
      ok(p.x < bx - 16, 'a player walked through the barrier: x ' + p.x + ' barrier ' + bx);
      ok(G.tiles.blockers.length === 1, 'the barrier should be one blocker: ' + G.tiles.blockers.length);
      // jump: the rock above leaves 3 tiles of headroom, so there is no way over
      D.setInput(0, { right: true, jump: true }); D.step(60); D.setInput(0, { right: false, jump: false }); D.step(30);
      ok(p.x < bx - 16, 'a jump got past the barrier');
      // a plain slash (and, even with Heavy Cut, a quick tap) does nothing
      D.place(0, bx - 40, crack.y, 1); D.step(3);
      G.meta.taught.tip_crack = false; G.tips.clear();
      D.setInput(0, { attack: true }); D.step(4); D.setInput(0, { attack: false }); D.step(40);
      ok(!crack.gone, 'a plain slash broke the barrier');
      ok(G.meta.taught.tip_crack === true, 'a plain slash did not teach the cracked-barrier tip');
      G.run.abil.heavy = true;
      D.setInput(0, { attack: true }); D.step(4); D.setInput(0, { attack: false }); D.step(40);
      ok(!crack.gone, 'a tap with Heavy Cut broke the barrier');
      // hold slash, release: it breaks, the blocker goes, and the player can walk through; it stays gone after leaving and coming back
      D.place(0, bx - 40, crack.y, 1); D.step(3);
      D.setInput(0, { attack: true }); D.step(Math.ceil(G.C.MOVE.HEAVY_T * 120) + 8); D.setInput(0, { attack: false }); D.step(40);
      ok(crack.gone && crack.data.broken, 'a heavy cut did not break the barrier');
      ok(G.tiles.blockers.length === 0, 'the blocker stayed after the barrier broke');
      D.setInput(0, { right: true }); D.step(120); D.setInput(0, { right: false });
      ok(p.x > bx + 16, 'could not walk through the broken barrier: x ' + p.x);
      const parent = G.run.graph.nodes[own].parent; D.gotoRoom(parent); D.gotoRoom(own);
      ok(!G.rooms.current.props.some(q => q.type === 'crack') && G.tiles.blockers.length === 0, 'the barrier came back after leaving the room');
    }
    return { bad, n: 12 };
  });
  if (res.bad.length) throw new Error(res.bad.slice(0, 8).join(' | '));
  return '4 guarded rooms x 12 seeds wired, barrier breaks only to a heavy cut';
};
