// The lock chart: every run gives each of the five Wardens three of the four cuts (rolled from the seed), every cut is locked out on at least
// one Warden, no two of the four main Wardens share a chart, and a locked cut has no fare slot at all (not built, not listed, cannot be punched).
// Charted slots open only for a carried cut. The chart is shown on the board in the Junction, on the map and at each gate. A punched slot
// takes 10% of max hp. Co-op: +60% max hp per player beyond the first, decided when the fight starts.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); }, CUTS = ['pierce', 'arc', 'burst', 'ground'];
    const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate).map(r => r.id);
    const shapes = new Set();
    for (let seed = 1; seed <= 150; seed++) {
      const a = G.worldgen.rollChart(seed), b = G.worldgen.rollChart(seed);
      ok(JSON.stringify(a) === JSON.stringify(b), 'seed ' + seed + ': the chart is not repeatable');
      ok(order.every(r => a[r] && a[r].length === 3 && new Set(a[r]).size === 3 && a[r].every(c => CUTS.includes(c))), 'seed ' + seed + ': a chart is not three cuts: ' + JSON.stringify(a));
      ok(CUTS.every(c => order.some(r => !a[r].includes(c))), 'seed ' + seed + ': a cut is never locked out');
      const main = order.slice(0, 4).map(r => a[r].join());
      ok(new Set(main).size === 4, 'seed ' + seed + ': two Wardens share a chart');
      shapes.add(JSON.stringify(a));
    }
    ok(shapes.size > 40, 'the chart barely changes with the seed (' + shapes.size + ' of 150)');
    // a run carries its chart, and the Wardens are built from it
    D.newRun(5); D.god(true);
    ok(JSON.stringify(G.run.graph.chart) === JSON.stringify(G.worldgen.rollChart(5)) && D.state().run.chart.r1.length === 3, 'the run does not carry the seed\'s chart');
    const info = {};
    for (const r of order) {
      D.newRun(5); D.god(true);
      const chart = G.run.graph.chart[r], locked = CUTS.find(c => !chart.includes(c));
      D.give(CUTS.map(c => ({ pierce: 'cobalt_awl', arc: 'ochre_ladle', burst: 'cinder_bell', ground: 'basalt_roller' })[c]).find(id => G.itemDefs[id].cls === chart[0]));
      D.give({ pierce: 'cobalt_awl', arc: 'ochre_ladle', burst: 'cinder_bell', ground: 'basalt_roller' }[locked]);
      D.startBoss(r); D.step(5);
      const b = G.rooms.current.boss, st = D.state().room.boss;
      ok(st.spots.length === 3 && st.spots.every(s => chart.includes(s.cls)), r + ': slots ' + st.spots.map(s => s.cls) + ' for chart ' + chart);
      ok(!st.spots.some(s => s.cls === locked), r + ': a slot of the locked cut ' + locked + ' exists');
      ok(!st.spots.some(s => s.cls === locked && s.open), r + ': locked cut is open');
      ok(b.spotAt({ cls: locked, x: b.x, y: b.y - 50, r: 4000 }) === null, r + ': a locked-cut strike reached a slot');
      const open = st.spots.filter(s => s.open).map(s => s.cls);
      ok(open.length === 1 && open[0] === chart[0], r + ': open slots ' + open + ' with one charted token and one locked-cut token carried');
      info[r] = chart.join('/');
    }
    // 10% punch, co-op health
    D.newRun(5); D.god(true); D.startBoss('r1'); const b1 = G.rooms.current.boss, base = G.bossDefs.tollkeeper.hp;
    ok(b1.maxHp === base, 'one player: max hp ' + b1.maxHp + ' not ' + base);
    const sp = b1.spots[0]; D.holdBoss({}); sp.open = true; sp.hp = 1;
    const hp0 = b1.hp; b1.hitSpot(sp, { itemId: 'none', owner: null, dmg: 0 });
    ok(Math.abs((hp0 - b1.hp) - base * 0.1) < 0.01, 'a punch took ' + (hp0 - b1.hp) + ' of ' + base);
    for (const n of [2, 3, 4]) {
      G.players.length = 0; D.newRun(5);
      while (G.players.length < n) D.addPlayer();
      D.startBoss('r1'); const b = G.rooms.current.boss;
      ok(Math.abs(b.maxHp - base * (1 + 0.6 * (n - 1))) < 0.01 && b.hp === b.maxHp, n + ' players: max hp ' + b.maxHp);
    }
    G.players.length = 0;
    // where the chart is shown
    D.newRun(5);
    const ch = G.run.graph.chart, cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    const board = G.rooms.current.props.find(p => p.type === 'board'); ok(!!board, 'no lock chart board in the Junction');
    const gate = G.rooms.current.props.find(p => p.type === 'gate' && p.data.region === 'r2');
    const cutCalls = []; const cs = G.art.cutShape; G.art.cutShape = (c, shape, r) => { cutCalls.push(shape); return cs.call(G.art, c, shape, r); };
    const texts = []; const lb = G.art.label; G.art.label = (c, t, ...r) => { texts.push(String(t)); return lb.call(G.art, c, t, ...r); };
    board.draw(ctx); const boardShapes = cutCalls.length;
    ok(boardShapes === 5 * 3, 'the board draws ' + boardShapes + ' cut shapes, want 15');
    ok(texts.includes('Lock chart') && Object.values(G.regionDefs).every(r => texts.includes(r.name)), 'the board does not name every region');
    const gp = gate.prompt(G.players[0]).join(' ');
    ok(ch.r2.every(c => gp.includes(G.CLASSES[c].name)) && !gp.includes(G.CLASSES[CUTS.find(c => !ch.r2.includes(c))].name), 'the gate label lists ' + gp);
    texts.length = 0; cutCalls.length = 0; G.map.draw(ctx);
    ok(texts.length > 5 && cutCalls.length >= 15, 'the map draws ' + cutCalls.length + ' shapes');
    G.art.label = lb; G.art.cutShape = cs;
    return { bad, info };
  });
  if (res.bad.filter(Boolean).length) throw new Error(res.bad.filter(Boolean).slice(0, 5).join(' | '));
  return JSON.stringify(res.info);
};
