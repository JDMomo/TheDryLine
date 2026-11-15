// A run code (seed + unlocked cuts, e.g. 1K9Z-5) reproduces a run: the same graph, lock chart and rewards whatever the save file says and
// whichever route is taken. The code is shown on the pause and run-over screens. Also: a run never reads the save again after it starts.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const world = () => JSON.stringify([Object.values(G.run.graph.nodes).map(n => [n.def, n.exits, n.content, n.extras]), G.run.graph.claimed, G.run.graph.chart, G.run.cuts]);
    // codes
    const c0 = G.game.codeOf(123456789, ['pierce', 'ground']), p0 = G.game.parseCode(c0);
    ok(p0 && p0.seed === 123456789 && p0.cuts.join() === 'pierce,ground', 'code round trip: ' + c0 + ' -> ' + JSON.stringify(p0));
    ok(G.game.parseCode('nonsense') === null && G.game.parseCode('ZZZZZZZZ-1') === null, 'bad codes are refused');
    // the same code on different saves
    G.meta.cuts = []; D.newRun(77); const code = G.run.code, a = world(), cutsA = G.run.cuts.slice();
    G.meta.cuts = ['arc', 'burst']; D.newRun(code); const b = world();
    ok(a === b && G.run.code === code, 'the same code built another world on a different save');
    ok(cutsA.length === 0 && G.run.cuts.length === 0, 'the run did not record the code\'s unlock set');
    G.meta.cuts = []; D.newRun(77, ['arc', 'burst']); ok(world() !== a, 'the unlocked set does not change the world');
    ok(/-6$/.test(G.run.code), 'the code does not carry the set: ' + G.run.code);
    const codeAB = G.run.code, wAB = world(); G.meta.cuts = ['pierce', 'arc', 'burst', 'ground']; D.newRun(codeAB); ok(world() === wAB, 'a save with more unlocks changed a coded world');
    // a run does not read the save after it started: punching mid-run unlocks for the next run only
    G.meta.cuts = []; D.newRun(77); const poolBefore = G.items.pool().join(); G.meta.cuts = ['pierce', 'arc', 'burst', 'ground'];
    ok(G.items.pool().join() === poolBefore, 'the token pool followed the save during a run');
    // rewards by any route: the Tollkeeper's three trinkets
    const rewards = route => {
      G.meta.cuts = []; D.newRun(code); D.god(true);
      if (route === 'other') { D.gotoRoom('r2'); D.step(200); D.gotoRoom('r3'); D.step(200); D.gotoRoom('r1_bilge'); D.step(300); G.run.rng(); G.run.rng(); }
      D.startBoss('r1'); const b = G.rooms.current.boss; b.hp = 1; b.damage(50); D.step(5);
      return D.state().room.props.filter(p => p.type === 'plinth' && p.data.trinket).map(p => p.data.trinket).join();
    };
    const r1 = rewards('direct'), r2 = rewards('other');
    ok(r1.split(',').length === 3 && r1 === r2, 'rewards differ by route: ' + r1 + ' / ' + r2);
    // the screens show the code
    D.newRun(code); const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d'), lb = G.art.label, texts = [];
    G.art.label = (c, t, ...r) => { texts.push(String(t)); return lb.call(G.art, c, t, ...r); };
    G.menus.open(); G.menus.pause(ctx); ok(texts.some(t => t.includes(code)), 'the pause screen does not show the code');
    texts.length = 0; G.run.over = 'dead'; G.menus.over(ctx); G.run.over = null; ok(texts.some(t => t.includes(code)), 'the run-over screen does not show the code');
    G.art.label = lb;
    // restart from the pause menu keeps the world
    const w = world(); G.game.newRun(G.run.code); ok(world() === w, 'restart changed the world');
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 5).join(' | '));
  return 'codes, saves, routes, screens';
};
