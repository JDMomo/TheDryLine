// Behaviour: mending, scrip, slashing, the kiosk. The player is driven only by setInput + step; the setup is the room, where to stand, and (for
// mending and buying) a starting hurt or purse.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const P = () => D.state().players[0], M = { MEND_COST: 33, MEND_T: 0.85 };       // the design numbers, written out: changing them in the game must be a decision
    const tap = a => { D.setInput(0, { [a]: true }); D.step(2); D.setInput(0, { [a]: false }); D.step(2); };
    const hold = (a, n) => { D.setInput(0, { [a]: true }); D.step(n); D.setInput(0, { [a]: false }); D.step(2); };
    // ---- mending: holding Mend on the ground heals one pip and spends the gauge; without gauge nothing happens
    D.newRun(5); D.god(false); D.step(30);
    const p = G.players[0], max = P().maxHp;
    p.hp = max - 2; p.glow = M.MEND_COST - 5; D.step(2);
    hold('heal', 260);
    ok(P().hp === max - 2, 'mended without enough gauge (hp ' + P().hp + ')');
    ok(Math.abs(P().glow - (M.MEND_COST - 5)) < 0.01, 'the gauge changed without a mend: ' + P().glow);
    p.glow = 99; D.step(2);
    hold('heal', Math.round(M.MEND_T / G.C.STEP) + 20);
    ok(P().hp === max - 1, 'a mend healed ' + (P().hp - (max - 2)) + ' pips, not 1');
    ok(Math.abs(P().glow - (99 - M.MEND_COST)) < 0.01, 'a mend spent ' + (99 - P().glow) + ' gauge, not ' + M.MEND_COST);
    // ---- scrip on the floor is picked up and counted
    const s0 = D.state().run.shards; G.combat.dropShards(P().x, P().y - 30, 14); ok(G.pickups.length > 0, 'no scrip dropped');
    D.step(150);
    ok(Math.abs(D.state().run.shards - s0 - 14) < 0.01 && G.pickups.length === 0, 'scrip on the floor was not counted: ' + (D.state().run.shards - s0) + ' of 14, ' + G.pickups.length + ' left');
    // ---- a slash does its damage, kills an enemy, and the enemy drops scrip
    D.newRun(5); D.god(true);
    let e = null;
    for (const id of Object.keys(G.run.graph.nodes)) {
      D.gotoRoom(id); D.step(2);
      e = G.rooms.current.enemies.find(x => !x.dead && !x.def.flying && !x.def.ceiling && !x.def.guard && x.def.id !== 'turnstile' && x.hp < 60);
      if (e) break;
    }
    ok(!!e, 'no ground enemy found');
    if (e) {
      const hp0 = e.hp; let dealt = 0, n = 0;
      const dmgs = [];
      while (!e.dead && n < 60) {
        D.place(0, e.x - 36, e.y, 1); D.step(2);
        const before = e.hp; tap('attack'); D.step(30); n++;
        if (e.hp < before) dmgs.push(before - e.hp);
      }
      ok(dmgs.length && Math.abs(dmgs[0] - 13 * G.run.mods.dmg) < 0.01, 'a light slash did ' + dmgs[0] + ' damage, not 13');
      ok(e.dead, 'slashing did not kill the enemy in ' + n + ' tries');
      ok(G.pickups.length > 0, 'a dead enemy dropped no scrip');
      const s1 = D.state().run.shards; D.place(0, e.x, e.y); D.step(200);
      ok(D.state().run.shards > s1, 'the scrip a dead enemy dropped could not be picked up');
    }
    // ---- the kiosk: a purchase with the Use input spends scrip and grants the ware; with no scrip nothing happens
    D.newRun(11); D.god(true); G.run.shards = 400;
    const node = Object.values(G.run.graph.nodes).find(n => G.worldgen.contents(n).filter(c => c.type === 'plinth' && c.data.price).length);
    D.gotoRoom(node.id); D.step(2);
    const wares = D.state().room.props.filter(q => q.type === 'plinth' && q.data.price);
    ok(wares.length === 3, 'kiosk shows ' + wares.length + ' wares');
    if (wares.length) {
      const w = wares[0], price = w.data.price, before = D.state().run.shards;
      G.run.shards = price - 1; D.place(0, w.x, w.y); D.step(3); tap('interact');
      ok(D.state().run.shards === price - 1 && !D.state().run.trinkets.includes(w.data.trinket), 'bought a ware without enough scrip');
      G.run.shards = before; tap('interact');
      ok(before - D.state().run.shards === price, 'the kiosk charged ' + (before - D.state().run.shards) + ', not ' + price);
      ok(D.state().run.trinkets.includes(w.data.trinket), 'the ware was not granted');
    }
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 5).join(' | '));
  return 'mend, scrip pickup, slash damage and kill drop, kiosk purchase';
};
