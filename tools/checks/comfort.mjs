// Comfort options on the pause menu, saved in the meta save: screen shake on or off, and reduced flashes (no blinking while hurt, no white body flash on a hit).
export default async ({ page }) => {
  const run = () => page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const hold = (a, on) => { G.input.any.forced[a] = on; G.input.sync(); };
    const press = a => { hold(a, true); D.step(1); hold(a, false); D.step(2); };
    const M = G.menus.menu;
    D.newRun(5); D.god(false); D.step(10);
    ok(G.meta.settings.shake === true && G.meta.settings.reduceFlashes === false, 'defaults: shake on, flashes normal');
    G.fx.shake = 0; G.fx.jolt(0, 20); ok(G.fx.shake === 20, 'screen shake does not shake by default');
    G.state = 'pause'; G.menus.open('kb'); press('down'); press('down'); press('jump'); ok(M.page === 'comfort', 'Comfort entry did not open its page');
    press('jump'); ok(G.meta.settings.shake === false, 'the first row did not switch the screen shake off');
    G.fx.shake = 0; G.fx.jolt(0.05, 20); ok(G.fx.shake === 0, 'screen shake still shakes: ' + G.fx.shake);
    press('down'); press('jump'); ok(G.meta.settings.reduceFlashes === true, 'the second row did not switch on reduced flashes');
    // a hit: no white flash on the enemy, no blinking on the player
    G.state = 'play'; let e = null;
    for (const id of Object.keys(G.run.graph.nodes)) { D.gotoRoom(id); D.step(2); e = G.rooms.current.enemies.find(x => !x.dead && !x.def.guard && x.def.id !== 'turnstile'); if (e) break; }
    e.damage(1, e.x - 10); ok(e.flash === 0, 'the enemy still flashes white with reduced flashes: ' + e.flash);
    G.players[0].inv = 0.5; const alphas = new Set(), ctx = document.createElement('canvas').getContext('2d');
    for (let t = 0; t < 12; t++) { G.time = t * 0.023; ctx.globalAlpha = 1; G.art.draw('player', ctx, { p: G.players[0], x: 100, y: 100 }); alphas.add(ctx.globalAlpha.toFixed(2)); }
    ok(alphas.size === 1, 'the player still blinks while hurt: ' + [...alphas]);
    G.meta.settings.reduceFlashes = false; e.flash = 0; e.damage(1, e.x - 10); ok(e.flash > 0, 'the enemy hit flash is gone with the option off');
    G.meta.settings.reduceFlashes = true;
    G.game.saveMeta();
    return bad;
  });
  const bad = await run();
  if (bad.length) throw new Error(bad.slice(0, 6).join(' | '));
  await page.reload(); await page.waitForFunction(() => window.G && window.G.debug);
  const s = await page.evaluate(() => Object.assign({}, G.meta.settings));
  if (s.shake !== false || s.reduceFlashes !== true) throw new Error('comfort options not saved: ' + JSON.stringify(s));
  return 'shake off, reduced flashes, both saved across a reload';
};
