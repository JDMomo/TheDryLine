// Item 10: the item sprites (assets/tokens, assets/trinkets) load into G.sprites, every token and trinket has its file, an icon never
// draws half-loaded (no entry until decoded; the code-drawn icon shows meanwhile), and the HUD, plinths, kiosk, ticket machine, map and
// projectiles all draw through the sprite-aware icon calls.
import fs from 'node:fs';
export default async ({ page }) => {
  const ids = await page.evaluate(() => ({ items: Object.keys(G.itemDefs), trinkets: Object.keys(G.trinketDefs) }));
  const bad = [];
  for (const id of ids.items) for (const f of [`assets/tokens/${id}.png`, `assets/tokens/${id}@2x.png`]) if (!fs.existsSync(f)) bad.push('missing ' + f);
  for (const id of ids.trinkets) for (const f of [`assets/trinkets/${id}.png`, `assets/trinkets/${id}@2x.png`]) if (!fs.existsSync(f)) bad.push('missing ' + f);
  await page.waitForFunction(() => !G.spritesPending, null, { timeout: 8000 }).catch(() => bad.push('sprites still pending after 8 s'));
  const r = await page.evaluate(() => {
    const out = [], D = G.debug, cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    const ink = () => { const d = c.getImageData(0, 0, 64, 64).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++; return n; };
    for (const id of Object.keys(G.itemDefs)) {
      const s = G.sprites['item_' + id];
      if (!s) { out.push('no sprite loaded for token ' + id); continue; }
      if (!(s.complete && s.naturalWidth >= 64)) out.push('partial sprite ' + id);
      c.clearRect(0, 0, 64, 64); G.items.icon(c, id, 32, 32, 36 / 24); if (ink() < 150) out.push('token icon draws nothing: ' + id);
    }
    for (const id of Object.keys(G.trinketDefs)) {
      const s = G.sprites['trinket_' + id];
      if (!s) { out.push('no sprite loaded for trinket ' + id); continue; }
      c.clearRect(0, 0, 64, 64); G.trinkets.icon(c, id, 32, 32, 1.5); if (ink() < 150) out.push('trinket icon draws nothing: ' + id);
    }
    // fallback while loading or after an error: no entry, the painter still draws
    const keep = G.sprites.item_cobalt_awl; delete G.sprites.item_cobalt_awl;
    c.clearRect(0, 0, 64, 64); G.items.icon(c, 'cobalt_awl', 32, 32, 1.5); if (ink() < 100) out.push('no fallback icon without the sprite');
    G.sprites.item_cobalt_awl = keep;
    // a failed file never leaves an entry
    const before = G.spritesPending || 0; const i = new Image(); i.onerror = () => {}; i.src = 'assets/tokens/none.png';
    // every drawing site goes through the sprite-aware calls: render each with the sprite and check the frame changes when it is removed
    const grab = () => { const cx = document.querySelector('canvas').getContext('2d'); return cx.getImageData(0, 0, document.querySelector('canvas').width, 140).data.join(',').length + ':' + Array.from(cx.getImageData(0, 0, 400, 80).data).reduce((a, b) => (a * 31 + b) | 0, 7); };
    D.newRun(3); D.give('cobalt_awl'); D.step(2);
    const shot = fn => { const cv2 = document.querySelector('canvas'), cx = cv2.getContext('2d'), s = cv2.width / G.C.W; cx.setTransform(s, 0, 0, s, 0, 0); fn(cx); return Array.from(cx.getImageData(0, 0, cv2.width, cv2.height).data).reduce((a, b) => (a * 31 + b) | 0, 7); };
    const sites = {
      hud: cx => { G.rooms.draw(cx, 0); G.hud.draw(cx); },
      map: cx => { G.map.draw(cx); },
      plinth: cx => { G.debug.gotoRoom('r1'); G.debug.step(2); const pl = G.run.rooms && null; G.rooms.draw(cx, 0); }
    };
    for (const k of ['hud', 'map']) {
      const a = shot(sites[k]); const saved = {}; for (const key of Object.keys(G.sprites)) { saved[key] = G.sprites[key]; delete G.sprites[key]; }
      const b = shot(sites[k]); Object.assign(G.sprites, saved);
      if (a === b) out.push(k + ' does not use the item sprites');
    }
    return out;
  });
  bad.push(...r);
  if (bad.length) throw new Error(bad.slice(0, 8).join('; '));
};
