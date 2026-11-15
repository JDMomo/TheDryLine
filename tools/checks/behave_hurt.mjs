// Behaviour: what hurts the player and what it costs, driven by player input (setInput + step). The only setup is choosing a room and where to stand.
//  - an enemy that overlaps the player costs exactly one health pip and grants invincibility: while the overlap goes on no second pip goes for about a second,
//    then the next one does;
//  - a Warden's body hurts on contact (one pip, then invincibility);
//  - spikes cost one pip and put the player back on safe ground (a run toward the pit from solid floor).
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const P = () => D.state().players[0], T = G.C.T, M = G.C.MOVE;
    D.newRun(5); D.god(false);
    // ---- enemy contact
    let e = null;
    for (const id of Object.keys(G.run.graph.nodes)) { D.gotoRoom(id); D.step(2); e = G.rooms.current.enemies.find(x => x.def.touch > 0 && !x.dead); if (e) break; }
    ok(!!e, 'no room with an enemy found');
    if (e) {
      const max = P().maxHp, at = () => { e.x = P().x; e.y = P().y; e.vx = 0; e.vy = 0; e.hitWall = 0; };   // keep the enemy on top of the player (the setup of the overlap)
      D.place(0, e.x, e.y); const hp0 = P().hp; D.step(1);
      ok(P().hp === hp0 - 1, 'touching an enemy cost ' + (hp0 - P().hp) + ' pips, not 1');
      ok(P().inv > 0.5, 'no invincibility after a hit: ' + P().inv);
      let steps = 1;
      for (; steps < 100; steps++) { G.players[0].x = e.x; G.players[0].y = e.y; D.step(1); }
      ok(P().hp === hp0 - 1, 'a second pip went during the invincibility (hp ' + P().hp + ' of ' + hp0 + ' after ' + steps + ' steps)');
      for (; steps < 260; steps++) { G.players[0].x = e.x; G.players[0].y = e.y; D.step(1); if (P().hp < hp0 - 1) break; }
      ok(P().hp === hp0 - 2, 'invincibility never ended: still overlapping after ' + steps + ' steps, hp ' + P().hp);
      ok(steps >= 100 && steps <= 200, 'invincibility ended after ' + steps + ' steps (expected about ' + Math.round(M.INV / G.C.STEP) + ')');
    }
    // ---- a Warden's body
    D.newRun(5); D.god(false); D.startBoss('r1'); D.step(200);
    { const b = D.state().room.boss, hp0 = P().hp; ok(!!b, 'no boss'); D.place(0, b.x, b.floor); D.step(30); ok(P().hp === hp0 - 1, 'touching the Warden cost ' + (hp0 - P().hp) + ' pips, not 1'); }
    // ---- spikes
    D.newRun(5); D.god(false);
    let hit = null, tried = 0;
    const defs = Object.values(G.roomDefs).filter(d => d.kind === 'main' && d.map.some(r => r.includes('^')));
    for (const d of defs) {
      if (hit) break;
      D.gotoRoom(d.id); D.step(2); G.rooms.current.enemies.length = 0;
      const tl = G.tiles;
      for (let r = 0; r < tl.rows && !hit; r++) for (let c = 0; c < tl.cols && !hit; c++) {
        if (!tl.spike(c, r)) continue;
        for (let cc = c - 1; cc >= Math.max(1, c - 7) && !hit; cc--) {
          for (let rg = Math.max(2, r - 3); rg <= r && !hit; rg++) {
            if (!tl.floorAt(cc, rg) || tl.solid(cc, rg - 1) || tl.solid(cc, rg - 2) || tl.spike(cc, rg)) continue;
            D.place(0, (cc + 0.5) * T, rg * T, 1); D.step(20);
            const s0 = P(); if (!s0.onGround) continue;
            if (tried >= 120) break;                                      // enough tries: a working spike is found within the first few
            tried++;
            D.setInput(0, { right: true });
            let lost = false;
            for (let i = 0; i < 160 && !lost; i++) {
              const pre = P(); D.step(1);
              if (P().hp < s0.hp) {                          // a pip went: count it only if the player had reached a spike tile (not some other hazard)
                const c = Math.floor(pre.x / T), r = Math.floor((pre.y + 14) / T);
                lost = [c - 1, c, c + 1].some(cx => [r - 1, r, r + 1].some(ry => tl.spike(cx, ry)));
                if (!lost) break;
              }
            }
            D.setInput(0, { right: false });
            if (lost) hit = { def: d.id, x0: s0.x, hp0: s0.hp };
          }
        }
      }
    }
    ok(!!hit, 'running into a spike pit never cost a pip (' + tried + ' runs tried in ' + defs.length + ' rooms)');
    if (hit) {
      D.step(80);
      const q = P();
      ok(q.hp === hit.hp0 - 1, 'spikes cost ' + (hit.hp0 - q.hp) + ' pips, not 1');
      ok(q.onGround && !G.tiles.spike(Math.floor(q.x / T), Math.floor((q.y - 2) / T)), 'the player was not returned to safe ground after the spikes (at ' + Math.round(q.x) + ',' + Math.round(q.y) + ')');
      ok(Math.abs(q.x - hit.x0) < 260, 'safe ground is far from the run start: ' + Math.round(q.x - hit.x0));
    }
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 5).join(' | '));
  return 'enemy contact: one pip and invincibility; spikes: one pip and back on safe ground';
};
