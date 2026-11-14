// Item 9: the page never scrolls at common window sizes (canvas plus header fit and scale down), and the HUD draws above everything in
// the room: a bright lamp-like shape painted under a token slot must not show through it.
export default async ({ page }) => {
  const bad = [], sizes = [[1100, 700], [1024, 768], [1280, 720], [1366, 768], [1920, 1080], [900, 600], [800, 600], [640, 480], [480, 800]];
  const orig = page.viewportSize();
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const d = document.documentElement, c = document.querySelector('canvas').getBoundingClientRect(), hd = document.querySelector('header').getBoundingClientRect();
      return { sh: d.scrollHeight, sw: d.scrollWidth, ih: innerHeight, iw: innerWidth, cb: c.bottom, cr: c.right, cl: c.left, ct: c.top, cw: c.width, ch: c.height, hb: hd.bottom };
    });
    if (m.sh > m.ih + 1) bad.push(`${w}x${h}: page scrolls vertically (${m.sh} > ${m.ih})`);
    if (m.sw > m.iw + 1) bad.push(`${w}x${h}: page scrolls sideways (${m.sw} > ${m.iw})`);
    if (m.cb > m.ih + 1 || m.cr > m.iw + 1 || m.cl < -1 || m.ct < -1) bad.push(`${w}x${h}: canvas outside the window ${JSON.stringify(m)}`);
    if (m.hb > m.ct + 1) bad.push(`${w}x${h}: header overlaps the canvas`);
    if (Math.abs(m.cw / m.ch - 960 / 544) > 0.03) bad.push(`${w}x${h}: canvas aspect ${(m.cw / m.ch).toFixed(3)}`);
    if (w >= 640 && m.cw < 300) bad.push(`${w}x${h}: canvas too small (${m.cw}px)`);
  }
  if (orig) await page.setViewportSize(orig);
  const hud = await page.evaluate(() => {
    const D = G.debug; D.newRun(5); D.give('cobalt_awl'); D.give('ochre_ladle'); D.step(2);
    const cv = document.querySelector('canvas'), ctx = cv.getContext('2d'), s = cv.width / G.C.W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    G.rooms.draw(ctx, 0);
    ctx.save(); ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, G.C.W, 140); ctx.restore();   // a lamp under the whole HUD band
    G.hud.draw(ctx);
    const px = ctx.getImageData(0, 0, cv.width, Math.round(140 * s)).data;
    let cells = 0, leak = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i] === 11 && px[i + 1] === 21 && px[i + 2] === 20) cells++; }
    // inside any slot cell (exact HUD_BG pixels with HUD_BG on all four sides at 6 px) no magenta may sit
    const W = cv.width, at = (x, y) => (y * W + x) * 4, isBg = (x, y) => px[at(x, y)] === 11 && px[at(x, y) + 1] === 21;
    for (let y = 6; y < Math.round(140 * s) - 6; y += 2) for (let x = 6; x < W - 6; x += 2) {
      if (isBg(x, y) && isBg(x - 6, y) && isBg(x + 6, y)) { const o = at(x + 3, y); if (px[o] === 255 && px[o + 1] === 0 && px[o + 2] === 255) leak++; }
    }
    return { cells, leak };
  });
  if (hud.cells < 800) bad.push('no opaque HUD slot cells found (' + hud.cells + ' px)');
  if (hud.leak) bad.push('room art shows through the HUD slots at ' + hud.leak + ' places');
  if (bad.length) throw new Error(bad.join('; '));
};
