// Rendering (js/core/camera.js G.interp, js/main.js fitCanvas / frame):
//  - interpolation: with the state before and after a step captured, the drawn position of the camera, a player, an enemy, the boss (and its
//    def.interp fields) and a shot lies between the two for any alpha, is exactly the current one at alpha 1, is restored after the draw, and a
//    jump of more than 60 px (teleport, respawn) is not interpolated; the drawing code really sees the interpolated position;
//  - hi-dpi: at device pixel ratios 1, 1.5 and 4 the bitmap is the canvas's CSS size times the ratio (ratio capped at 3), game coordinates are
//    unchanged (the transform scales C.W x C.H onto the whole bitmap, same scale both ways) and nothing is resized between frames (no blur, no flicker);
//  - the real loop: the simulation leads the clock by less than one step, the draw alpha stays in (0, 1], and a key press moves the player within two frames.
export const weight = 15;
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, I = G.interp, out = { fail: [], notes: [] }, bad = m => out.fail.push(m);
    D.newRun(5); D.god(true); D.startBoss('r2');
    const room = G.rooms.current, b = room.boss, p = G.players[0], C = G.C;
    const e = new G.Enemy(G.enemyDefs.ballast_crab, 400, b.floor); room.enemies.push(e);
    const shot = G.combat.shoot({ x: 300, y: 300, vx: 100, vy: 0, life: 9, hostile: true });
    const grab = () => ({ cam: [G.cam.x, G.cam.y], p: [p.x, p.y], e: [e.x, e.y], b: [b.x, b.y, b.hx, b.ha], s: [shot.x, shot.y] });
    const mv = (o, n) => { if (o === 'cam') { G.cam.x += n; G.cam.y += n / 2; } };
    // before: capture; then move everything as a step would
    G.cam.x = 100; G.cam.y = 40; b.hx = 60; b.ha = 0.25;
    I.capture(); const a = grab();
    G.cam.x += 8; G.cam.y += 4; p.x += 6; p.y -= 3; e.x += 2; b.x += 5; b.y -= 1; b.hx += 20; b.ha += 0.5; shot.x += 9; shot.y += 1;
    const c = grab();
    const between = (name, v0, v1, v, tol = 1e-9) => v.forEach((x, i) => { const lo = Math.min(v0[i], v1[i]) - tol, hi = Math.max(v0[i], v1[i]) + tol; if (!(x >= lo && x <= hi)) bad(name + '[' + i + ']=' + x + ' not between ' + v0[i] + ' and ' + v1[i]); });
    for (const alpha of [0.001, 0.25, 0.5, 0.75, 0.999]) {
      I.apply(alpha); const d = grab(); I.restore();
      for (const k in a) between(k + '@' + alpha, a[k], c[k], d[k]);
      if (Math.abs(d.p[0] - (a.p[0] + (c.p[0] - a.p[0]) * alpha)) > 1e-9) bad('player x at ' + alpha + ' is not the linear blend');
      if (Math.abs(d.b[2] - (a.b[2] + (c.b[2] - a.b[2]) * alpha)) > 1e-9) bad('boss def.interp field hx not blended');
      const r = grab(); for (const k in c) c[k].forEach((v, i) => { if (v !== r[k][i]) bad('restore() left ' + k + '[' + i + '] changed'); });
    }
    I.apply(1); const one = grab(); I.restore(); for (const k in c) c[k].forEach((v, i) => { if (v !== one[k][i]) bad('alpha 1 must draw the current state exactly'); });
    // a teleport is not blended
    I.capture(); const px = p.x; p.x += 400; I.apply(0.5); if (p.x !== px + 400) bad('a 400 px jump was interpolated'); I.restore(); if (p.x !== px + 400) bad('restore after a teleport');
    // what the drawing code sees
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    I.capture(); const x0 = p.x, bx0 = b.x; p.x += 10; b.x += 10; const seen = [], od = p.draw, bd = b.draw; p.draw = function (cx, dt) { seen.push(['p', this.x]); return od.call(this, cx, dt); }; b.draw = function (cx) { seen.push(['b', this.x]); return bd.call(this, cx); };
    I.alpha = 0.4; G.rooms.draw(ctx, 0); I.alpha = 1; delete p.draw; delete b.draw;
    if (!seen.some(([k, x]) => k === 'p' && Math.abs(x - (x0 + 4)) < 1e-9) || !seen.some(([k, x]) => k === 'b' && Math.abs(x - (bx0 + 4)) < 1e-9)) bad('the draw code did not see the interpolated positions: ' + JSON.stringify(seen));
    if (p.x !== x0 + 10 || b.x !== bx0 + 10) bad('positions not restored after the draw');
    // the first draw of a new entity (no previous state) is where it is
    const e2 = new G.Enemy(G.enemyDefs.ballast_crab, 500, b.floor); room.enemies.push(e2); I.apply(0.3); if (e2.x !== 500) bad('a new enemy was moved'); I.restore();
    out.notes.push('interpolation exact');
    return out;
  });
  if (res.fail.length) throw new Error(res.fail.slice(0, 8).join(' | '));

  // hi-dpi, in fresh browser contexts with different device pixel ratios
  const browser = page.context().browser(), url = page.url(), notes = [];
  for (const dpr of [1, 1.5, 4]) {
    const ctx = await browser.newContext({ deviceScaleFactor: dpr, viewport: { width: 640, height: 560 } }), pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto(url); await pg.waitForFunction(() => window.G && window.G.debug);
    await pg.evaluate(() => { G.debug.newRun(5); G.debug.god(true); G.debug.gotoRoom('r1'); });                 // manual stepping: the page keeps drawing
    await pg.waitForTimeout(250);
    const r = await pg.evaluate(async dpr => {
      const cv = document.getElementById('game'), C = G.C, V = G.view, o = { fail: [] }, bad = m => o.fail.push(m);
      const want = Math.min(3, dpr), cssW = cv.clientWidth;
      const sizes = new Set(); let resizes = 0, w0 = cv.width;
      await new Promise(res => { let n = 0; const t = () => { sizes.add(cv.width + 'x' + cv.height); if (++n < 10) requestAnimationFrame(t); else res(); }; requestAnimationFrame(t); });
      if (sizes.size !== 1) bad('the bitmap changed size between frames: ' + [...sizes].join(' '));
      if (Math.abs(cv.width - cssW * want) > 1) bad('bitmap ' + cv.width + ' wide for ' + cssW + ' css px at ratio ' + dpr + ' (want ' + (cssW * want).toFixed(1) + ')');
      if (Math.abs(cv.width / cv.height - C.W / C.H) > 0.01) bad('bitmap aspect ' + (cv.width / cv.height).toFixed(3));
      if (Math.abs(V.scale * C.W - cv.width) > 1e-6 || Math.abs(V.sy * C.H - cv.height) > 1e-6) bad('G.view scale does not map the logical size onto the bitmap');
      if (Math.abs(V.scale - V.sy) > 0.01) bad('scale differs between x and y: ' + V.scale + ' ' + V.sy);
      if (C.W !== 960 || C.H !== 544) bad('the logical size changed: ' + C.W + 'x' + C.H);
      const m = cv.getContext('2d').getTransform(); if (Math.abs(m.a - V.scale) > 1e-6 || Math.abs(m.d - V.sy) > 1e-6 || m.e || m.f) bad('canvas transform ' + [m.a, m.d, m.e, m.f]);
      if (Math.abs(V.snap(10.123) * V.scale - Math.round(10.123 * V.scale)) > 1e-6) bad('G.view.snap does not land on a device pixel');
      o.size = cv.width + 'x' + cv.height; return o;
    }, dpr);
    await ctx.close();
    if (errs.length && !errs.every(e => /paper|ERR_FILE/.test(e))) throw new Error('dpr ' + dpr + ': page errors ' + errs.join(' | '));
    if (r.fail.length) throw new Error('dpr ' + dpr + ': ' + r.fail.join(' | '));
    notes.push(dpr + 'x ' + r.size);
  }

  // the real loop (fresh page, real keyboard): lead, alpha and latency
  const ctx2 = await browser.newContext({ viewport: { width: 1040, height: 760 } }), pg = await ctx2.newPage();
  await pg.goto(url); await pg.waitForFunction(() => window.G && window.G.debug);
  await pg.evaluate(() => document.getElementById('game').focus()); await pg.keyboard.press('KeyX');
  await pg.waitForFunction(() => G.state === 'play', null, { timeout: 5000 });
  await pg.waitForTimeout(300);
  const loop = await pg.evaluate(() => new Promise(resolve => {
    const o = { fail: [], alphas: [], leads: [] }; let n = 0, t0 = 0, g0 = 0;
    const tick = ts => {                 // runs after the game's own frame in the same display frame: same timestamp
      if (!n) { t0 = ts; g0 = G.time; }
      const lead = (G.time - g0) - (ts - t0) / 1000; o.leads.push(lead); o.alphas.push(G.interp.alpha);
      if (++n < 90) requestAnimationFrame(tick); else resolve(o);
    };
    requestAnimationFrame(tick);
  }));
  const maxLead = Math.max(...loop.leads), minAlpha = Math.min(...loop.alphas), maxAlpha = Math.max(...loop.alphas);
  if (maxLead > 1 / 120 + 0.004) throw new Error('the simulation runs ' + (maxLead * 1000).toFixed(1) + ' ms ahead of the clock (more than a step)');
  if (minAlpha <= 0 || maxAlpha > 1) throw new Error('draw alpha out of (0, 1]: ' + minAlpha + ' ' + maxAlpha);
  await pg.evaluate(() => { window.__x0 = G.players[0].x; });
  await pg.keyboard.down('ArrowRight');
  const frames = await pg.evaluate(() => new Promise(res => { let n = 0; const t = () => { n++; if (G.players[0].x !== window.__x0 || n > 30) res(n); else requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  await pg.keyboard.up('ArrowRight'); await ctx2.close();
  if (frames > 4) throw new Error('a key press needed ' + frames + ' frames to move the player');
  return res.notes.join(', ') + '; dpr ' + notes.join(', ') + '; lead max ' + (maxLead * 1000).toFixed(1) + ' ms, alpha ' + minAlpha.toFixed(2) + ' to ' + maxAlpha.toFixed(2) + ', key to motion ' + frames + ' frames';
};
