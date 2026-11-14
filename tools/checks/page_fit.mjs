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
  // The game canvas is tainted by file:// images, so pixels cannot be read: record the draw calls instead.
  const hud = await page.evaluate(() => {
    const D = G.debug; D.newRun(5); D.give('cobalt_awl'); D.give('ochre_ladle'); D.step(2);
    const cv = document.querySelector('canvas'), ctx = cv.getContext('2d'), s = cv.width / G.C.W; ctx.setTransform(s, 0, 0, s, 0, 0);
    const log = [], orig = ctx.fillRect.bind(ctx);
    ctx.fillRect = (x, y, w, h) => { log.push({ x, y, w, h, fs: ctx.fillStyle, a: ctx.globalAlpha, t: ctx.getTransform().a }); orig(x, y, w, h); };
    let hudStart = -1; const rd = G.rooms.draw, hd = G.hud.draw;
    G.rooms.draw(ctx, 0); const roomEnd = log.length; hudStart = roomEnd; G.hud.draw(ctx);
    ctx.fillRect = orig;
    const hudCalls = log.slice(hudStart), slots = hudCalls.filter(c => c.fs === '#0b1514' && c.w >= 28 && c.w === c.h);
    return { slots: slots.length, alpha: slots.every(c => c.a === 1), room: roomEnd, hudCalls: hudCalls.length,
      order: document.querySelector('script[src="js/main.js"]') != null };
  });
  const main = (await import('node:fs')).readFileSync('js/main.js', 'utf8');
  if (!/G\.rooms\.draw\(ctx, dt\); G\.hud\.draw\(ctx\)/.test(main)) bad.push('main.js no longer draws the HUD right after the room, above everything');
  if (hud.slots < 2) bad.push('fewer than 2 opaque HUD slot cells drawn (' + hud.slots + ')');
  if (!hud.alpha) bad.push('a HUD slot cell is drawn translucent');
  if (bad.length) throw new Error(bad.join('; '));
};
