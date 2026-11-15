// Behaviour of the feel numbers a player notices, from inputs alone: a jump pressed a moment after walking off a ledge still works (coyote time) and one pressed
// long after does not; a dash cannot be repeated until its cooldown is over; a co-op partner left far behind is pulled to the leader.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const P = i => D.state().players[i || 0], T = G.C.T, S = G.C.STEP;
    const tap = a => { D.setInput(0, { [a]: true }); D.step(2); D.setInput(0, { [a]: false }); };
    // ---- coyote time: walk off a ledge, press Jump `late` steps after leaving the ground; returns how high the player got in the next 0.1 s
    const ledgeJump = late => {
      D.newRun(5); D.god(true); let found = null;
      for (const id of Object.keys(G.run.graph.nodes)) {
        D.gotoRoom(id); D.step(2); G.rooms.current.enemies.length = 0; const tl = G.tiles;
        for (let r = 3; r < tl.rows - 4 && !found; r++) for (let c = 2; c < tl.cols - 4 && !found; c++)
          if (tl.floorAt(c, r) && !tl.floorAt(c + 1, r) && !tl.floorAt(c + 1, r + 1) && !tl.floorAt(c + 1, r + 2) && !tl.floorAt(c + 1, r + 3) && !tl.solid(c, r - 1) && !tl.solid(c + 1, r - 1) && !tl.solid(c, r - 2) && !tl.solid(c + 1, r - 2) && !tl.spike(c + 1, r + 1)) found = { c, r };
        if (found) break;
      }
      if (!found) return null;
      D.place(0, (found.c + 0.5) * T, found.r * T, 1); D.step(30);
      D.setInput(0, { right: true });
      let n = 0; while (P().onGround && n++ < 200) D.step(1);
      if (P().onGround) { D.setInput(0, { right: false }); return null; }
      const y0 = P().y; D.step(late); tap('jump'); D.step(10); D.setInput(0, { right: false });
      return y0 - P().y;                                  // positive: it rose above where it left the ledge
    };
    // the design numbers are written out here on purpose: a change to them in the game must be a decision, not an accident
    const early = ledgeJump(5), late = ledgeJump(40);                       // 0.04 s and 0.33 s after leaving the ledge (coyote time is 0.09 s)
    ok(early !== null, 'no ledge found for the coyote-time test');
    if (early !== null) {
      ok(early > 4, 'a jump pressed 40 ms after leaving a ledge did not jump (rose ' + early.toFixed(1) + ' px)');
      ok(late < 4, 'a jump pressed 330 ms after leaving a ledge still jumped (rose ' + late.toFixed(1) + ' px)');
    }
    // ---- the dash cooldown
    D.newRun(5); D.god(true); D.unlockAll(); D.step(40);
    D.place(0, 200, P().y, 1); D.step(10);
    // keep tapping Dash and note when each dash starts (speed over 600 px/s): the second one may not start before the cooldown is over
    const starts = []; let fast = false;
    for (let i = 0; i < 150; i++) {
      D.setInput(0, { dash: i % 6 < 2 }); D.step(1);
      const v = Math.abs(P().vx) > 600; if (v && !fast) starts.push(i * S); fast = v;
      if (P().x > 800) D.place(0, 200, P().y, 1);
    }
    D.setInput(0, { dash: false });
    ok(starts.length >= 2, 'only ' + starts.length + ' dashes in 1.25 s of tapping');
    if (starts.length >= 2) ok(starts[1] - starts[0] > 0.28, 'the second dash started ' + (starts[1] - starts[0]).toFixed(2) + ' s after the first (the cooldown is 0.35 s)');
    // ---- the co-op leash
    D.newRun(5); D.god(true); D.addPlayer();
    const wide = Object.keys(G.run.graph.nodes).find(id => { D.gotoRoom(id); return G.rooms.current.kind === 'main' && G.rooms.current.cols >= 60; });
    ok(!!wide, 'no wide room for the leash test');
    if (wide) {
      const cols = G.rooms.current.cols, y = P(0).y;
      D.place(0, (cols - 6) * T, y); D.place(1, 3 * T, y); D.step(30);
      ok(Math.abs(P(1).x - P(0).x) < 700, 'a partner left ' + Math.round(Math.abs(P(1).x - P(0).x)) + ' px behind was not pulled to the leader');
    }
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 6).join(' | '));
  return 'coyote time, dash cooldown, co-op leash';
};
