// Frame cost: one step of the sim plus one draw, averaged over a fight with each Warden (4 players, god mode, keys pressed at random) and
// in the room with the most enemies. Average must stay under 6 ms (the page may be slower than a real browser; this is headless).
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, ctx = document.getElementById('game').getContext('2d'), out = {};
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(3);
    const run = (secs) => {
      let sum = 0, worst = 0, n = 0, ts = [];
      for (let i = 0; i < 60 * secs; i++) {
        if (i % 6 === 0) for (let k = 0; k < G.players.length; k++) D.setInput(k, { left: rng() < 0.2, right: rng() < 0.5, jump: rng() < 0.3, attack: rng() < 0.5, dash: rng() < 0.05 });
        const t0 = performance.now();
        D.step(2);                       // 2 sim steps = one 60 fps frame at 120 Hz
        G.rooms.draw(ctx, 1 / 60); G.hud.draw(ctx);
        const t = performance.now() - t0; ts.push(t); sum += t; n++; if (t > worst) worst = t;
      }
      ts.sort((a, b) => a - b); return { avg: +(sum / n).toFixed(2), worst: +worst.toFixed(2), p99: +ts[Math.floor(ts.length * 0.99)].toFixed(2), second: +ts[ts.length - 2].toFixed(2) };
    };
    G.players.length = 0; D.newRun(5); D.unlockAll(); D.god(true);
    while (G.players.length < 4) D.addPlayer();
    D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('cinder_bell'); D.give('basalt_roller');
    for (const id of ['r1', 'r2', 'r3', 'r4', 'final']) { D.startBoss(id); D.step(30); out[id] = run(20); }
    let busy = { n: -1 };
    for (const nid of Object.keys(G.run.graph.nodes)) {
      const nd = G.run.graph.nodes[nid]; if (!G.roomDefs[nd.def] || G.roomDefs[nd.def].kind === 'arena') continue;
      D.gotoRoom(nd.def); const n = G.rooms.current.enemies.length + G.rooms.current.props.length;
      if (n > busy.n) busy = { n, def: nd.def };
    }
    D.gotoRoom(busy.def); D.step(30); out.busy = Object.assign({ room: busy.def }, run(15));
    return out;
  });
  const bad = Object.entries(r).filter(([, v]) => v.avg >= 6).map(([k, v]) => k + ' ' + v.avg + ' ms');
  const msg = Object.entries(r).map(([k, v]) => k + " " + v.avg + "/p99 " + v.p99 + "/2nd " + v.second + "/max " + v.worst).join(', ');
  if (bad.length) throw new Error('over 6 ms: ' + bad.join(', ') + ' (' + msg + ')');
  return 'avg/worst ms: ' + msg;
};
