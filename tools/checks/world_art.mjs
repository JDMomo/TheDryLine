// The watercolor world pass (js/art/world.js, world_bg.js). Checks:
//  1. every room of every place draws its tiles and backdrop without error, art on and off; a platform's walkable top edge contrasts with the backdrop by 3:1, and so do spikes;
//  2. non-black-mass ratio: inside the deep rock of every room, almost no pixel is near black, the mean tone is lifted and the tone varies (stone, not void);
//  3. every terrain tile (mud, salt, tar, conveyor, crumble, spring, vent, one-way, spikes) draws, a burnt tar tile repaints, and a tall room pans vertically without errors;
//  4. draw-cost budget: tiles plus backdrop per frame (flushed, warm cache) and the worst single chunk build stay inside the budget, judged against a calibration loop;
//  5. the painted-image hooks (assets/world) take over a tile set and a backdrop layer when an image is present;
//  6. contact sheets tools/shots/world_<place>.png and world_terrain.png for a person to look at.
import fs from 'fs';
export const weight = 40;
const RATIO = 3.0, MAX_DARK = 0.03, MIN_MEAN = 0.04, MIN_SD = 0.006, COST_MS = 4.0, BUILD_MS = 45, CAL_QUIET = 29;
export default async ({ page, shots }) => {
  const R = await page.evaluate(() => {
    const out = { fail: [], notes: [], rooms: 0, samples: 0, worst: { plat: 99, spike: 99 }, mass: { on: [], off: [] } }, bad = m => { if (out.fail.length < 400) out.fail.push(m); };
    const W = G.world, D = G.debug, T = G.C.T, SW = G.C.W, SH = G.C.H;
    if (!W) { bad('no G.world'); return out; }
    D.newRun(5); D.god(true); D.unlockAll();
    const mk = () => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c; };
    const cvB = mk(), cvT = mk(), xB = cvB.getContext('2d', { willReadFrequently: true }), xT = cvT.getContext('2d', { willReadFrequently: true });
    const regions = Object.keys(G.regionDefs).concat('hub'), lumPx = (d, i) => W.lum([d[i], d[i + 1], d[i + 2]]);
    const base = G.rooms.current;
    // 1 and 2: every room template, in its own region (shared rooms in every region)
    for (const def of Object.values(G.roomDefs)) {
      const regs = def.region === 'shared' ? regions.filter(r => r !== 'hub') : [def.region];
      for (const reg of regs) for (const on of [true, false]) {
        G.artTest = on;
        base.region = reg; base.grid = def.grid; base.cols = def.cols; base.rows = def.rows; base.id = def.id; base.def = def; G.tiles.load(def.grid);
        const pal = G.art.palette(reg), maxX = Math.max(0, def.cols * T - SW), maxY = Math.max(0, def.rows * T - SH);
        const cells = [];
        for (let r = 1; r < def.rows - 1; r++) for (let c = 0; c < def.cols; c++) {
          const ch = def.grid[r][c];
          if ((ch === '#' && def.grid[r - 1][c] === '.') || ch === '=') cells.push({ c, r, k: 'plat' });
          else if (ch === '^') cells.push({ c, r, k: 'spike' });
        }
        const pick = [], plat = cells.filter(q => q.k === 'plat'), sp = cells.filter(q => q.k === 'spike');
        const step = Math.max(1, Math.floor(plat.length / 8)); for (let i = 0; i < plat.length; i += step) pick.push(plat[i]);
        const sstep = Math.max(1, Math.floor(sp.length / 3)); for (let i = 0; i < sp.length; i += sstep) pick.push(sp[i]);
        if (!pick.length) pick.push(null);
        for (const q of pick) {
          const cx = q ? q.c * T + T / 2 : def.cols * T / 2, cy = q ? q.r * T : def.rows * T / 2;
          G.cam.x = Math.max(0, Math.min(maxX, Math.round(cx - SW / 2))); G.cam.y = Math.max(0, Math.min(maxY, Math.round(cy - SH / 2)));
          xB.setTransform(1, 0, 0, 1, 0, 0); xB.clearRect(0, 0, SW, SH); xT.setTransform(1, 0, 0, 1, 0, 0); xT.clearRect(0, 0, SW, SH);
          try {
            G.art.backdrop(xB, pal, G.cam.x, G.time, reg);
            xT.save(); xT.translate(-G.cam.x, -G.cam.y); G.art.tiles(xT, pal); xT.restore();
          } catch (e) { bad(def.id + '/' + reg + ' art ' + on + ': ' + e.message); continue; }
          { // black-mass ratio: of the pixels inside solid rock (cells whose four neighbours are solid too), how many are near black, and how much the tone varies
            const full = xT.getImageData(0, 0, SW, SH).data, c0 = Math.floor(G.cam.x / T), r0 = Math.floor(G.cam.y / T); let n = 0, dark = 0, s1 = 0, s2 = 0;
            for (let rr = r0; rr <= r0 + SH / T; rr++) for (let cc = c0; cc <= c0 + SW / T; cc++) {
              if (rr < 1 || cc < 1 || rr >= def.rows - 1 || cc >= def.cols - 1) continue;
              if (!['#', '#', '#', '#', '#'].every((_, k) => { const dc = [0, 1, -1, 0, 0][k], dr = [0, 0, 0, 1, -1][k]; return def.grid[rr + dr][cc + dc] === '#'; })) continue;
              const px0 = Math.round(cc * T - G.cam.x), py0 = Math.round(rr * T - G.cam.y); if (px0 < 0 || py0 < 0 || px0 + T > SW || py0 + T > SH) continue;
              for (let y = 2; y < T - 2; y += 3) for (let x = 2; x < T - 2; x += 3) { const i = ((py0 + y) * SW + px0 + x) * 4; const L = full[i + 3] > 200 ? lumPx(full, i) : 0; n++; if (L < 0.018) dark++; s1 += L; s2 += L * L; }
            }
            if (n > 400) { const mean = s1 / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean)); out.mass[on ? 'on' : 'off'].push({ id: def.id + '/' + reg, n, dark: dark / n, mean, sd }); }
          }
          if (!on || !q) continue;
          out.samples++;
          const sx = Math.round(q.c * T - G.cam.x), sy = Math.round(q.r * T - G.cam.y);
          if (sx < 0 || sx + T > SW || sy < 14 || sy + T > SH) continue;
          const tile = xT.getImageData(sx + 6, sy, T - 12, T).data;
          let capL = 0, capN = 0;
          if (q.k === 'plat') {
            // the top edge: the lighter half of the opaque pixels in the first 5 rows below the surface line (the pale cap, not its ink line)
            const ls = [];
            for (let y = 1; y < 6; y++) for (let x = 0; x < T - 12; x++) { const i = (y * (T - 12) + x) * 4; if (tile[i + 3] > 200) ls.push(lumPx(tile, i)); }
            ls.sort((a, b) => a - b); const top = ls.slice(Math.floor(ls.length / 2)); capL = top.reduce((a, b) => a + b, 0) / Math.max(1, top.length); capN = ls.length;
          } else {
            const ls = [];
            for (let y = 6; y < 28; y++) for (let x = 0; x < T - 12; x++) { const i = (y * (T - 12) + x) * 4; if (tile[i + 3] > 200) ls.push(lumPx(tile, i)); }
            ls.sort((a, b) => a - b); const top = ls.slice(Math.floor(ls.length * 0.4)); capL = top.reduce((a, b) => a + b, 0) / Math.max(1, top.length); capN = ls.length;
          }
          if (capN < 20) { bad(def.id + '/' + reg + ': nothing drawn at ' + q.k + ' ' + q.c + ',' + q.r); continue; }
          const y0 = q.k === 'plat' ? sy - 14 : sy + 2, hgt = q.k === 'plat' ? 12 : 26, bd = xB.getImageData(sx, Math.max(0, y0), T, hgt).data, bl = [];
          for (let i = 0; i < bd.length; i += 4) bl.push(lumPx(bd, i));
          bl.sort((a, b) => a - b); const bgL = bl[Math.floor(bl.length * 0.95)];
          const ratio = (capL + 0.05) / (bgL + 0.05);
          if (ratio < out.worst[q.k]) out.worst[q.k] = +ratio.toFixed(2);
          if (ratio < 3.0) bad(def.id + '/' + reg + ' ' + q.k + ' at ' + q.c + ',' + q.r + ': contrast ' + ratio.toFixed(2) + ' (edge ' + capL.toFixed(2) + ' against backdrop ' + bgL.toFixed(2) + ')');
        }
        out.rooms++;
      }
    }
    G.artTest = true;
    return out;
  });
  if (R.fail.length) throw new Error(R.fail.slice(0, 14).join(' | ') + (R.fail.length > 14 ? ' ... +' + (R.fail.length - 14) : ''));
  // 2. black mass
  const agg = a => ({ rooms: a.length, dark: Math.max(0, ...a.map(q => q.dark)), mean: Math.min(...a.map(q => q.mean)), sd: Math.min(...a.map(q => q.sd)), avgDark: a.reduce((s, q) => s + q.dark, 0) / Math.max(1, a.length), avgMean: a.reduce((s, q) => s + q.mean, 0) / Math.max(1, a.length) });
  const on = agg(R.mass.on), off = agg(R.mass.off), badMass = [];
  for (const q of R.mass.on) { if (q.dark > MAX_DARK) badMass.push(q.id + ' near-black ' + (q.dark * 100).toFixed(1) + '%'); else if (q.mean < MIN_MEAN) badMass.push(q.id + ' mean tone ' + q.mean.toFixed(3)); else if (q.sd < MIN_SD) badMass.push(q.id + ' flat (sd ' + q.sd.toFixed(4) + ')'); }
  if (!R.mass.on.length) badMass.push('no deep rock sampled');
  if (badMass.length) throw new Error('black mass: ' + badMass.slice(0, 8).join(' | ') + ' (art off averaged ' + (off.avgDark * 100).toFixed(0) + '% near black)');

  // 3 + 4: terrain, tall rooms, the draw-cost budget
  const T3 = await page.evaluate(() => {
    const out = { fail: [], cost: {}, build: 0, tar: 0 }, bad = m => out.fail.push(m), D = G.debug, W = G.world, T = G.C.T, SW = G.C.W, SH = G.C.H;
    D.newRun(9); D.god(true); D.unlockAll();
    const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH; const x = cv.getContext('2d', { willReadFrequently: true });
    const cal = () => { const t0 = performance.now(); let s = 0; for (let i = 0; i < 3e6; i++) s += Math.sqrt(i) % 3; return performance.now() - t0 + (s < 0 ? 1 : 0); };
    const flush = () => x.getImageData(0, 0, 1, 1);
    const room = G.rooms.current, regions = ['hub', 'r1', 'r2', 'r3', 'r4', 'final'];
    // a synthetic room with every terrain char
    const rowsN = 17, colsN = 30, g = []; for (let r = 0; r < rowsN; r++) g.push(Array(colsN).fill('.'));
    for (let c = 0; c < colsN; c++) { g[rowsN - 1][c] = '#'; g[rowsN - 2][c] = '#'; g[rowsN - 3][c] = '#'; g[0][c] = '#'; }
    const put = (r, c, s) => { for (let i = 0; i < s.length; i++) g[r][c + i] = s[i]; };
    put(rowsN - 4, 2, '^^^^'); put(rowsN - 4, 8, 'mmmm'); put(rowsN - 4, 14, 'ssss'); put(rowsN - 4, 20, 'tttt'); put(rowsN - 4, 25, 'j'); put(rowsN - 4, 27, 'v');
    put(9, 2, '>>>>'); put(9, 8, '<<<<'); put(9, 14, 'cccc'); put(9, 20, '===='); put(5, 4, '####'); put(6, 4, '####'); put(7, 4, '####');
    const grid = g.map(r => r.join(''));
    const draws = (reg, camx, camy) => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, SW, SH); G.cam.x = camx; G.cam.y = camy; G.art.backdrop(x, G.art.palette(reg), camx, G.time, reg); x.save(); x.translate(-camx, -camy); G.art.tiles(x, G.art.palette(reg)); x.restore(); };
    for (const reg of regions) {
      room.region = reg; room.grid = grid.slice(); room.cols = colsN; room.rows = rowsN; room.id = 'wa_terrain_' + reg; room.def = { marks: [] }; G.tiles.load(room.grid);
      try { for (let i = 0; i < 40; i++) { G.time += 1 / 60; draws(reg, 0, 0); } } catch (e) { bad('terrain ' + reg + ': ' + e.message); }
      // a crumble ledge that is warning and one that is gone, a vent in its pulse
      try { G.tiles.terrain.crumble['14,9'] = { phase: 'warn', at: G.time + 1 }; G.tiles.terrain.crumble['15,9'] = { phase: 'gone', at: G.time + 5 }; for (let i = 0; i < 20; i++) { G.time += 1 / 60; draws(reg, 0, 0); } } catch (e) { bad('crumble ' + reg + ': ' + e.message); }
      G.tiles.terrain.crumble = {};
    }
    // burn a tar tile: the chunk must repaint (no stale tar, no error)
    room.region = 'r1'; room.grid = grid.slice(); room.id = 'wa_tar'; G.tiles.load(room.grid); draws('r1', 0, 0);
    const probe = () => { const d = x.getImageData(20 * T + 16, 13 * T + 3, 1, 1).data; return d[0] + d[1] + d[2]; };
    const before = probe(); G.tiles.burnTar(21 * T, 13 * T, 20); for (let i = 0; i < 12; i++) { G.time += 1 / 60; draws('r1', 0, 0); } out.tar = Math.abs(probe() - before); if (out.tar < 30) bad('a burnt tar tile did not repaint (' + out.tar + ')');
    // the draw-cost budget, tall rooms included: pan across a few real rooms, flush each frame, take the cheaper of two passes
    const tall = Object.values(G.roomDefs).filter(d => d.rows > 17).sort((a, b) => b.rows - a.rows).slice(0, 2), wide = Object.values(G.roomDefs).filter(d => d.rows <= 17).sort((a, b) => b.cols - a.cols).slice(0, 1);
    const hubDef = G.roomDefs.hub || Object.values(G.roomDefs).find(d => d.region === 'hub' && d.rows > 30);
    const picks = [...(hubDef ? [hubDef] : []), ...tall, ...wide];
    for (const def of picks) {
      const reg = def.region === 'shared' ? 'r1' : def.region;
      for (const on of [false, true]) {
        G.artTest = on; room.region = reg; room.grid = def.grid.slice(); room.cols = def.cols; room.rows = def.rows; room.id = def.id + (on ? '' : '_off'); room.def = def; G.tiles.load(room.grid);
        const maxX = Math.max(0, def.cols * T - SW), maxY = Math.max(0, def.rows * T - SH);
        let best = null;
        for (let pass = 0; pass < 2; pass++) {
          const calv = Math.min(cal(), cal()), ts = [];
          for (let i = 0; i < 360; i++) { const t = i / 359, camx = Math.round(maxX * (0.5 - 0.5 * Math.cos(t * 6.283))), camy = Math.round(maxY * t); G.time += 1 / 60; const t0 = performance.now(); draws(reg, camx, camy); flush(); ts.push(performance.now() - t0); }
          const warm = ts.slice(120).sort((a, b) => a - b), r = { avg: warm.reduce((s, v) => s + v, 0) / warm.length, p99: warm[Math.floor(warm.length * 0.99)], worst: warm[warm.length - 1], cal: calv };
          if (!best || r.avg < best.avg) best = r;
        }
        out.cost[def.id + (on ? ':on' : ':off')] = { avg: +best.avg.toFixed(2), p99: +best.p99.toFixed(2), worst: +best.worst.toFixed(2), cal: +best.cal.toFixed(1), rows: def.rows, cols: def.cols };
      }
    }
    G.artTest = true; out.build = +(W.stats.maxMs || 0).toFixed(1); out.chunks = W.stats.chunks;
    return out;
  });
  if (T3.fail.length) throw new Error(T3.fail.slice(0, 8).join(' | '));
  const costBad = [], rowsOut = [];
  for (const [k, v] of Object.entries(T3.cost)) {
    const f = Math.max(1, v.cal / CAL_QUIET); rowsOut.push(k + ' ' + v.avg + '/p99 ' + v.p99);
    if (k.endsWith(':on') && v.avg > COST_MS * f) costBad.push(k + ' ' + v.avg + ' ms (limit ' + (COST_MS * f).toFixed(1) + ')');
  }
  const calMax = Math.max(...Object.values(T3.cost).map(v => v.cal)), bf = Math.max(1, calMax / CAL_QUIET);
  if (T3.build > BUILD_MS * bf) costBad.push('one chunk build took ' + T3.build + ' ms (limit ' + (BUILD_MS * bf).toFixed(0) + ')');
  if (costBad.length) throw new Error('draw cost over budget: ' + costBad.join(', ') + ' (' + rowsOut.join(', ') + ')');

  // 5. hooks: an image for a tile sheet and a backdrop layer takes over
  const H = await page.evaluate(() => {
    const out = { fail: [] }, bad = m => out.fail.push(m), D = G.debug, W = G.world, T = G.C.T;
    D.newRun(7); D.god(true); D.gotoRoom('r1'); D.step(5);
    const solid = (w, h, col) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, w, h); return c; };
    const mkc = () => { const c = document.createElement('canvas'); c.width = 960; c.height = 544; return c; };
    const sheetName = W.tileSheet('r1', 'a');
    W.setImage(sheetName, solid(96, 64, '#ff00ff'));
    { const c = mkc(), x = c.getContext('2d'); G.cam.x = 0; G.cam.y = 0; G.artTest = true; x.save(); G.art.tiles(x, G.art.palette('r1')); x.restore();
      const d = x.getImageData(0, 17 * T - 40, 960, 1).data; let hit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 255) hit++; if (hit < 100) bad('tile sheet image not used (' + hit + ' magenta pixels)'); }
    W.setImage(sheetName, null);
    W.setImage(W.bgName('r1', 'far'), solid(256, 128, '#00ffff'));
    { const c = mkc(), x = c.getContext('2d'); G.art.backdrop(x, G.art.palette('r1'), 0, 0, 'r1'); const d = x.getImageData(400, 200, 1, 1).data; if (!(d[0] === 0 && d[1] === 255 && d[2] === 255)) bad('backdrop image not used: ' + Array.from(d)); }
    W.setImage(W.bgName('r1', 'far'), null);
    for (const id of Object.keys(G.worldHooks.hooks)) { const h = G.worldHooks.hooks[id]; if (!/^(tiles|bg|props|ui)_/.test(id)) bad('odd hook name ' + id); if (h.slots && h.cols * h.rows !== h.slots.length) bad('hook ' + id + ' cells do not match its slots'); }
    return out;
  });
  if (H.fail.length) throw new Error(H.fail.slice(0, 8).join(' | '));

  // 6. contact sheets
  const canvas = page.locator('#game'), places = ['hub', 'r1', 'r2', 'r3', 'r4', 'final'], names = { hub: 'junction', r1: 'quay', r2: 'reef', r3: 'cutting', r4: 'hall', final: 'terminus' };
  const sheet = async (file, frames, cols) => {
    const urls = frames.map(b => 'data:image/png;base64,' + b.toString('base64'));
    const dataUrl = await page.evaluate(async ({ urls, cols }) => {
      const imgs = await Promise.all(urls.map(u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; })));
      const w = imgs[0].width, h = imgs[0].height, rowsN = Math.ceil(imgs.length / cols), c = document.createElement('canvas'); c.width = w * cols; c.height = h * rowsN;
      const x = c.getContext('2d'); imgs.forEach((im, i) => x.drawImage(im, (i % cols) * w, Math.floor(i / cols) * h)); return c.toDataURL('image/png');
    }, { urls, cols });
    fs.writeFileSync(shots + '/' + file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  };
  await page.evaluate(() => { G.debug.newRun(7); G.debug.god(true); G.debug.unlockAll(); G.artTest = true; });
  await page.waitForFunction(() => !G.spritesPending);
  for (const reg of places) {
    const frames = [];
    for (const key of reg === 'hub' ? ['hub', 'hub', 'hub', 'hub'] : ['main:' + reg, 'trial:' + reg, 'branch:' + reg, 'arena:' + reg]) {
      await page.evaluate(({ key, reg, i }) => {
        const D = G.debug; if (!D.gotoRoom(key)) D.gotoRoom(reg === 'hub' ? 'hub' : reg); D.step(40);
        const ctx = document.getElementById('game').getContext('2d'), room = G.rooms.current;
        if (reg === 'hub' && i > 0) { const p = G.players[0], c = i === 1 ? 0.5 : i === 2 ? 0.8 : 0.15, rr = i === 3 ? 0.9 : 0.5; D.place(0, Math.round(room.cols * G.C.T * c), Math.round(room.rows * G.C.T * rr), 1); D.step(30); }
        G.rooms.draw(ctx, 1 / 60); G.hud.draw(ctx);
      }, { key, reg, i: frames.length });
      frames.push(await canvas.screenshot());
    }
    await sheet('world_' + names[reg] + '.png', frames, 2);
  }
  // the terrain showcase: every terrain tile in all six materials, one frame each
  const terr = [];
  for (const reg of places) {
    await page.evaluate(reg => {
      const D = G.debug, T = G.C.T, room = G.rooms.current, ctx = document.getElementById('game').getContext('2d'), rowsN = 17, colsN = 30, g = [];
      for (let r = 0; r < rowsN; r++) g.push(Array(colsN).fill('.'));
      for (let c = 0; c < colsN; c++) { g[rowsN - 1][c] = '#'; g[rowsN - 2][c] = '#'; g[rowsN - 3][c] = '#'; g[0][c] = '#'; g[1][c] = '#'; }
      const put = (r, c, s) => { for (let i = 0; i < s.length; i++) g[r][c + i] = s[i]; };
      for (let r = 2; r < 14; r++) { g[r][0] = '#'; g[r][1] = '#'; g[r][colsN - 1] = '#'; g[r][colsN - 2] = '#'; }
      put(rowsN - 4, 4, '^^^^'); put(rowsN - 4, 9, 'mmmm'); put(rowsN - 4, 14, 'ssss'); put(rowsN - 4, 19, 'tttt'); put(rowsN - 4, 24, 'j'); put(rowsN - 4, 26, 'v');
      put(10, 4, '>>>>'); put(10, 9, '<<<<'); put(10, 14, 'cccc'); put(10, 19, '===='); put(7, 5, '######'); put(8, 5, '######'); put(5, 20, '##'); put(6, 20, '##');
      room.region = reg; room.grid = g.map(r => r.join('')); room.cols = colsN; room.rows = rowsN; room.id = 'wa_show_' + reg; room.def = { marks: [] }; G.tiles.load(room.grid);
      G.cam.x = 0; G.cam.y = 0; G.time += 0.3; for (let i = 0; i < 40; i++) { G.time += 1 / 60; G.rooms.draw(ctx, 1 / 60); }
    }, reg);
    terr.push(await canvas.screenshot());
  }
  await sheet('world_terrain.png', terr, 2);
  await page.evaluate(() => { G.state = 'play'; G.run.over = null; });
  const fmt = v => (v * 100).toFixed(1) + '%';
  return R.rooms + ' room draws, ' + R.samples + ' edge samples (worst top edge ' + R.worst.plat + ':1, spikes ' + R.worst.spike + ':1); deep rock: near-black ' + fmt(on.avgDark) + ' avg / ' + fmt(on.dark) + ' worst against ' + fmt(off.avgDark) + ' with the flat art, mean tone ' + on.avgMean.toFixed(3) + ' against ' + off.avgMean.toFixed(3) + '; draw ms avg/p99: ' + rowsOut.join(', ') + '; slowest chunk build ' + T3.build + ' ms';
};
