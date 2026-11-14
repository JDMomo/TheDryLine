// Prop prompts and tips: every prop of every room of several seeds (and the way-back door of every arena, the plinths at both edges of the
// guarded rooms) shows its prompt wrapped to at most G.props.PROMPT_W and wholly inside the screen, with the first-time tips switched on.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], cv = document.createElement('canvas'); cv.width = 960; cv.height = 544;
    const ctx = cv.getContext('2d'), M = 4;
    let shown = 0;
    const probe = (label, pr) => {
      const p = G.players[0];
      D.place(0, pr.x, pr.y); D.step(3); G.cam.follow(0, p.x, p.y, true);
      const near = G.rooms.propNear(p);
      if (!near) return;
      G.props.lastPrompt = null;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 960, 544);
      G.rooms.draw(ctx, 0);
      const L = G.props.lastPrompt;
      if (!L) return;
      shown++;
      const cx = G.cam.x, cy = G.cam.y;
      if (L.x0 < cx + M || L.x1 > cx + 960 - M || L.y0 < cy + M || L.y1 > cy + 544 - M) bad.push(label + ': panel (' + Math.round(L.x0 - cx) + ',' + Math.round(L.y0 - cy) + ')-(' + Math.round(L.x1 - cx) + ',' + Math.round(L.y1 - cy) + ') leaves the screen');
      for (const r of L.rows) { ctx.font = r.weight + ' ' + r.size + 'px ' + G.C.FONT; const w = ctx.measureText(r.t).width; if (w > G.props.PROMPT_W + 1) bad.push(label + ': line "' + r.t + '" is ' + Math.round(w) + ' px wide'); }
    };
    for (const seed of [1, 2, 3, 4]) {
      D.newRun(seed); D.god(true); G.meta.taught = {};
      for (const id of Object.keys(G.run.graph.nodes)) {
        D.gotoRoom(id); G.rooms.current.enemies.length = 0; G.rooms.current.cleared = true;
        const room = G.rooms.current;
        for (const pr of room.props.slice()) {
          G.meta.taught = {};                                            // every first-time tip shows
          probe('seed ' + seed + ' ' + room.def.id + ' ' + pr.type + ' at ' + Math.round(pr.x), pr);
        }
        if (room.kind === 'arena') {                                      // the way back door the boss leaves behind
          D.startBoss(room.region); room.boss.hp = 0; D.step(2); G.meta.taught = {};
          const door = G.rooms.current.props.find(p => p.type === 'door');
          if (door) probe('seed ' + seed + ' ' + room.def.id + ' arena door', door); else bad.push(room.def.id + ': no door after the fight');
        }
      }
    }
    // a made-up long prompt is wrapped and clamped at both edges
    D.newRun(1); D.gotoRoom('r1_hold');
    const room = G.rooms.current;
    for (const x of [40, 960 - 40, 480]) {
      const fake = G.props.make('sign', x, 480, { text: 'x' });
      fake.prompt = () => ['A very long title that keeps going and going', 'A line of text that is much too long for one row of the screen and has to be wrapped over several rows by the panel code', 'Up to do something rather long with a hint that is also far too long to fit in one line'];
      room.props.push(fake); G.cam.x = Math.max(0, x - 480); probe('fake long prompt at ' + x, fake);
      const L = G.props.lastPrompt;
      if (L && L.rows.length < 6) bad.push('the long prompt was not wrapped (' + L.rows.length + ' rows)');
    }
    return { bad, shown };
  });
  if (res.bad.length) throw new Error(res.bad.length + ' prompts: ' + res.bad.slice(0, 4).join(' | '));
  if (res.shown < 100) throw new Error('only ' + res.shown + ' prompts were drawn');
  return res.shown + ' prompts on screen, wrapped and clamped';
};
