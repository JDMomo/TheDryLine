// Item 10: the item sprites (assets/tokens, assets/trinkets) load into G.sprites, every token and trinket has its file, an icon never
// draws half-loaded (no entry until decoded; the code-drawn icon shows meanwhile), and the HUD, plinths, kiosk, ticket machine, map and
// projectiles all draw the sprites. The canvas is tainted by file:// images, so draw calls are recorded instead of pixels.
import fs from 'node:fs';
export default async ({ page }) => {
  const ids = await page.evaluate(() => ({ items: Object.keys(G.itemDefs), trinkets: Object.keys(G.trinketDefs) }));
  const bad = [];
  for (const id of ids.items) for (const f of [`assets/tokens/${id}.png`, `assets/tokens/${id}@2x.png`]) if (!fs.existsSync(f)) bad.push('missing ' + f);
  for (const id of ids.trinkets) for (const f of [`assets/trinkets/${id}.png`, `assets/trinkets/${id}@2x.png`]) if (!fs.existsSync(f)) bad.push('missing ' + f);
  await page.waitForFunction(() => !G.spritesPending, null, { timeout: 8000 }).catch(() => bad.push('sprites still pending after 8 s'));
  const r = await page.evaluate(() => {
    const out = [], D = G.debug, cv = document.querySelector('canvas'), ctx = cv.getContext('2d');
    const spy = fn => { // returns { imgs: [sprites drawn], other: count of other fills }
      const rec = { imgs: [], other: 0 }, di = ctx.drawImage.bind(ctx), fr = ctx.fillRect.bind(ctx), fl = ctx.fill.bind(ctx);
      ctx.drawImage = (im, ...a) => { rec.imgs.push(im); di(im, ...a); }; ctx.fillRect = (...a) => { rec.other++; fr(...a); }; ctx.fill = (...a) => { rec.other++; fl(...a); };
      try { fn(); } finally { delete ctx.drawImage; delete ctx.fillRect; delete ctx.fill; }
      return rec;
    };
    const s = cv.width / G.C.W; ctx.setTransform(s, 0, 0, s, 0, 0);
    for (const id of Object.keys(G.itemDefs)) {
      const sp = G.sprites['item_' + id];
      if (!sp) { out.push('no sprite loaded for token ' + id); continue; }
      if (!(sp.complete && sp.naturalWidth >= 64)) out.push('partial sprite ' + id);
      const rec = spy(() => G.items.icon(ctx, id, 100, 100, 1.5)); if (rec.imgs[0] !== sp) out.push('token icon does not draw its sprite: ' + id);
      const saved = G.sprites['item_' + id]; delete G.sprites['item_' + id];
      const fb = spy(() => G.items.icon(ctx, id, 100, 100, 1.5)); G.sprites['item_' + id] = saved;
      if (fb.imgs.length || !fb.other) out.push('no code-drawn fallback while loading: ' + id);
    }
    for (const id of Object.keys(G.trinketDefs)) {
      const sp = G.sprites['trinket_' + id];
      if (!sp) { out.push('no sprite loaded for trinket ' + id); continue; }
      const rec = spy(() => G.trinkets.icon(ctx, id, 100, 100, 1.5)); if (rec.imgs[0] !== sp) out.push('trinket icon does not draw its sprite: ' + id);
    }
    // sites: each must draw sprites (and the HUD only sprites of what is held)
    D.newRun(3); D.give('cobalt_awl'); D.give('ochre_ladle'); D.step(2);
    const hud = spy(() => { G.rooms.draw(ctx, 0); G.hud.draw(ctx); });
    if (!hud.imgs.includes(G.sprites.item_cobalt_awl)) out.push('HUD does not draw the held token sprite');
    const map = spy(() => G.map.draw(ctx)); if (!map.imgs.includes(G.sprites.item_cobalt_awl)) out.push('map does not draw held token sprites');
    // plinth, kiosk ware, ticket machine choices, trunk via props.drawGood
    const pl = spy(() => { const d = { item: 'chalk_skipstone' }; G.props.drawGoodForTest ? G.props.drawGoodForTest(ctx, d, 100, 100, 1) : G.items.icon(ctx, d.item, 100, 100, 1); });
    if (!pl.imgs.includes(G.sprites.item_chalk_skipstone)) out.push('plinth good does not use the sprite');
    // projectiles: the arc tokens draw their sprite while in flight
    D.give('chalk_skipstone');
    for (const id of ['ochre_ladle', 'sulphur_kettle', 'chalk_skipstone']) {
      D.newRun(4); D.give(id); const p = G.players[0]; p.sel = p.items.indexOf(id);
      D.setInput(0, { item: true }); D.step(2); D.setInput(0, { item: false }); D.step(6);
      const sh = G.run && G.shots ? G.shots : null;
      const rec = spy(() => G.rooms.draw(ctx, 0));
      if (!rec.imgs.includes(G.sprites['item_' + id])) out.push('projectile of ' + id + ' does not draw its sprite');
    }
    return out;
  });
  bad.push(...r);
  if (bad.length) throw new Error(bad.slice(0, 8).join('; '));
};
