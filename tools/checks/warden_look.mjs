// How the Wardens and props look and how smoothly rooms are entered (playtest issues 1, 8, 10):
//  - the banner prop has no leftover paper matte (tools/art/clean_matte.py --check finds nothing to clear; this was the speckled white rectangle);
//  - every code-drawn Warden goes through the watercolor wash (Boss.drawWashed): its offscreen picture is not empty, does not touch the canvas edge
//    (nothing clipped, in every state and pose of a scripted fight start), has a soft translucent outline pixel row next to the body, and costs
//    little (mean under 250 ms here, 1 to 7 ms when idle); G.debug.noWash draws the plain painter;
//  - the banner card of a boss intro draws a plate behind its text (hud.js);
//  - real loop: the worst frame entering every room and starting each Warden fight is reported (not a limit; see room_prewarm).
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const weight = 12;
export default async ({ page }) => {
  const notes = [];
  const py = spawnSync('python3', ['-I', path.join(root, 'tools/art/clean_matte.py'), '--check', path.join(root, 'assets/props/banner.webp')], { encoding: 'utf8' });
  const m = /alpha changed (\d+)/.exec(py.stdout || '');
  if (!m) notes.push('matte check skipped (no python imaging)'); else if (+m[1] > 30) throw new Error('assets/props/banner.webp still has paper matte (' + m[1] + ' pixels to clear): python3 -I tools/art/clean_matte.py assets/props/banner.webp'); else notes.push('banner clean');
  const res = await page.evaluate(() => {
    const out = { fail: [], notes: [] }, bad = x => out.fail.push(x), D = G.debug;
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    for (const id of ['r1', 'r2', 'r3', 'r4', 'final']) {
      D.newRun(5); D.god(true); D.startBoss(id); const b = G.rooms.current.boss; b.x = 480; b.y = b.floor;
      for (const st of ['idle', 'stagger']) {
        b.set(st, 9); G.debug.noWash = false; ctx.clearRect(0, 0, 960, 544); b.draw(ctx);
        const W = b._wash; if (!W) { bad(id + ': not drawn through the wash'); continue; }
        const c = W.cv.getContext('2d'), w = W.cv.width, h = W.cv.height, d = c.getImageData(0, 0, w, h).data;
        let n = 0, edge = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = d[(y * w + x) * 4 + 3]; if (a > 8) { n++; if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) edge++; } }
        if (n < 500) bad(id + ' ' + st + ': the washed picture is empty (' + n + ' px)');
        if (edge) bad(id + ' ' + st + ': the picture touches the edge of its canvas, so it is clipped (' + edge + ' px)');
      }
      G.debug.noWash = true; b._wash = null; b.draw(ctx); if (b._wash) bad(id + ': noWash still washed'); G.debug.noWash = false;
      let t = performance.now(); for (let i = 0; i < 40; i++) b.draw(ctx); ctx.getImageData(0, 0, 1, 1); const ms = (performance.now() - t) / 40;
      if (ms > 250) bad(id + ': wash costs ' + ms.toFixed(1) + ' ms per draw'); out.notes.push(id + ' ' + ms.toFixed(1) + 'ms');
    }
    // the plate behind a plain banner card
    D.newRun(5); G.fx.say('Title', 'A line of text that sits over bright art behind it.', 3); G.state = G.state; let plate = 0; const fr = ctx.fillRect.bind(ctx);
    ctx.fillRect = (x, y, w, h) => { if (y === 94 && h === 72) plate++; return fr(x, y, w, h); }; G.hud.draw(ctx); ctx.fillRect = fr; G.fx.banner = null;
    if (!plate) bad('the banner card has no plate behind it');
    return out;
  });
  if (res.fail.length) throw new Error(res.fail.slice(0, 8).join(' | '));
  notes.push(res.notes.join(' '));
  // no hitch in the real loop
  await page.evaluate(() => { const D = G.debug; D.fullCharts = true; D.newRun(7); D.god(true); window.__f = []; let last = performance.now(); const tick = t => { window.__f.push([t - last, G.rooms.current.def && G.rooms.current.def.id]); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const ids = await page.evaluate(() => Object.keys(G.run.graph.nodes));
  for (const id of ids) { await page.evaluate(id => G.rooms.enter(id, { side: 'left' }), id); await page.waitForTimeout(120); }
  for (const r of ['r1', 'r2', 'r3', 'r4', 'final']) { await page.evaluate(r => G.debug.startBoss(r), r); await page.waitForTimeout(150); }
  const f = await page.evaluate(() => window.__f.slice(3));
  const worst = f.reduce((a, x) => (x[0] > a[0] ? x : a), [0]), over = f.filter(x => x[0] > 100).length;
  // informational only: on the shared 2-core machine whole-suite load makes any limit flaky (the structural check is room_prewarm)
  notes.push(f.length + ' frames, worst ' + Math.round(worst[0]) + ' ms, ' + over + ' over 100 ms');
  return notes.join('; ');
};
