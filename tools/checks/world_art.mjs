// The watercolor world (js/art/world*.js, js/ui/skin.js). Checks:
//  1. every room of every place draws its tiles, backdrop layers and props without error, with the watercolor art on and off;
//  2. in every room (sampled cells), a platform's walkable top edge contrasts with the backdrop behind it by at least 3:1, and so do spikes;
//  3. the painted-image hooks (assets/world, js/art/world_hooks.js) take over a tile set, a backdrop layer and a prop when an image is present;
//  4. the interface: every text on every screen has 4.5:1 against the parchment under it, and no interface colour is as vivid as a token cut colour;
//  5. perf: step plus draw per frame with the art on stays inside the budget, and what it costs over the flat art is reported;
//  6. contact sheets: tools/shots/world_<place>.png (four rooms each) and world_screens.png (the screens) for a person to look at.
import fs from 'fs';
export const slow = true;
export const weight = 40;
const RATIO = 3.0, TEXT_RATIO = 4.5;
export default async ({ page, shots }) => {
  const R = await page.evaluate(() => {
    const out = { fail: [], notes: [], rooms: 0, samples: 0, worst: { plat: 99, spike: 99 } }, bad = m => { if (out.fail.length < 400) out.fail.push(m); };
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
            G.art.backdrop(xB, pal, G.cam.x, G.time);
            xT.save(); xT.translate(-G.cam.x, -G.cam.y); G.art.tiles(xT, pal); xT.restore();
          } catch (e) { bad(def.id + '/' + reg + ' art ' + on + ': ' + e.message); continue; }
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

  // props with the art on and off, and the image hooks
  const P = await page.evaluate(() => {
    const out = { fail: [] }, bad = m => out.fail.push(m), D = G.debug, W = G.world, cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    D.newRun(7); D.god(true); D.unlockAll(); D.gotoRoom('hub'); D.step(10);
    const room = G.rooms.current, T = G.C.T;
    const make = (type, x, y, data) => G.props.make(type, x, y, data || {});
    const types = [['plinth', { item: 'cobalt_awl' }], ['plinth', { item: 'cobalt_awl', price: 30 }], ['plinth', { scrip: 20 }], ['trunk', { item: 'cobalt_awl' }], ['ticket', { choices: [], next: null }], ['post', { abil: 'dash' }], ['standpipe', {}],
      ['door', { to: room.id, entry: { side: 'left' }, label: 'x', tag: 'tag' }], ['gate', { region: 'r1' }], ['gate', { region: 'final' }], ['board', {}], ['sign', { text: 'hello' }], ['crack', {}]];
    G.cam.x = 0; G.cam.y = 0;
    for (const on of [true, false]) {
      G.artTest = on;
      for (const [t, d] of types) {
        if (!G.props.TYPES[t]) { bad('no prop type ' + t); continue; }
        try { const pr = make(t, 300, 400, JSON.parse(JSON.stringify(d))); ctx.save(); pr.draw(ctx); ctx.restore(); if (G.props.TYPES[t].boxes) G.props.boxes(pr, ctx); W.scrip(ctx, 100, 100, 1); }
        catch (e) { bad('prop ' + t + ' art ' + on + ': ' + e.message); }
      }
    }
    G.artTest = true;
    // hooks: inject a plain image for a tile sheet, a bg layer and a prop sheet; each must show up
    const solid = (w, h, col) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, w, h); return c; };
    D.gotoRoom('r1'); D.step(5); const E = G.rooms.current;
    const px = (c, x, y) => c.getContext('2d').getImageData(x, y, 1, 1).data;
    const mkc = () => { const c = document.createElement('canvas'); c.width = 960; c.height = 544; return c; };
    const sheetName = W.tileSheet('r1', 'a');
    W.setImage(sheetName, solid(96, 64, '#ff00ff'));                      // every cell magenta: floors and walls must come from the image
    { const c = mkc(), x = c.getContext('2d'); G.cam.x = 0; G.cam.y = 0; x.save(); G.art.tiles(x, G.art.palette('r1')); x.restore();
      const d = x.getImageData(0, 17 * T - 40, 960, 1).data; let hit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 255) hit++; if (hit < 100) bad('tile sheet image not used (' + hit + ' magenta pixels)'); }
    W.setImage(sheetName, null);
    W.setImage(W.bgName('r1', 'far'), solid(256, 128, '#00ffff'));
    { const c = mkc(), x = c.getContext('2d'); G.art.backdrop(x, G.art.palette('r1'), 0, 0); const d = px(c, 400, 200); if (!(d[0] === 0 && d[1] === 255 && d[2] === 255)) bad('backdrop image not used: ' + Array.from(d)); }
    W.setImage(W.bgName('r1', 'far'), null);
    W.setImage('props_a_f6', solid(96, 64, '#ffff00'));
    { const c = mkc(), x = c.getContext('2d'); const pr = make('sign', 480, 300, { text: 't' }); pr.draw(x); const d = px(c, 480, 280); if (!(d[0] === 255 && d[1] === 255 && d[2] === 0)) bad('prop image not used: ' + Array.from(d)); }
    W.setImage('props_a_f6', null);
    { const c = mkc(), x = c.getContext('2d'); const pr = make('sign', 480, 300, { text: 't' }); pr.draw(x); const d = px(c, 480, 280); if (d[3] === 0) bad('code-drawn sign missing after the image is removed'); }
    for (const id of Object.keys(G.worldHooks.hooks)) { const h = G.worldHooks.hooks[id]; if (!/^(tiles|bg|props|ui)_/.test(id)) bad('odd hook name ' + id); if (h.slots && h.cols * h.rows !== h.slots.length) bad('hook ' + id + ' cells do not match its slots'); }
    out.hooks = Object.keys(G.worldHooks.hooks).length;
    return out;
  });
  if (P.fail.length) throw new Error(P.fail.slice(0, 8).join(' | '));

  // interface: text contrast on every screen, and the palette
  const U = await page.evaluate(() => {
    const out = { fail: [], texts: 0, worst: 99 }, bad = m => { if (out.fail.length < 30) out.fail.push(m); }, D = G.debug, W = G.world;
    D.newRun(7); D.god(true); D.unlockAll(); D.give('cobalt_awl'); D.give('ochre_ladle'); const keep = [G.sprites, G.strips]; G.sprites = {}; G.strips = {};        // file images would taint the scratch canvas
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d', { willReadFrequently: true });
    // the tints of every colour pair: no interface colour may be as vivid as the least vivid cut colour
    const chroma = h => { const p = W.rgb(h); return Math.max(...p) - Math.min(...p); };
    const cuts = Object.values(G.CLASSES).map(c => chroma(c.color)), minCut = Math.min(...cuts);
    for (const col of G.ui.PALETTE) if (chroma(col) >= minCut) bad('interface colour ' + col + ' (chroma ' + chroma(col) + ') is as vivid as a cut colour (' + minCut + ')');
    for (const [id, col] of Object.entries({ pierce: '#56b4e9', arc: '#f0e442', burst: '#d55e00', ground: '#cc79a7' })) if (!G.CLASSES[id] || G.CLASSES[id].color.toLowerCase() !== col) bad('cut colour of ' + id + ' changed: ' + (G.CLASSES[id] && G.CLASSES[id].color));
    // record every text with the ink and the parchment under it
    const ft = CanvasRenderingContext2D.prototype.fillText; let cur = '';
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) {
      const st = this.fillStyle;
      if (this === ctx && typeof st === 'string' && st[0] === '#' && st.length === 7 && String(t).trim()) {
        const w = this.measureText(t).width, sz = parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)[1]), x0 = this.textAlign === 'center' ? x - w / 2 : this.textAlign === 'right' ? x - w : x, tr = this.getTransform();
        const bx = Math.max(0, Math.floor(x0 * tr.a + tr.e)), by = Math.max(0, Math.floor((y - sz / 2) * tr.d + tr.f)), bw = Math.min(960 - bx, Math.ceil(w * tr.a) + 1), bh = Math.min(544 - by, Math.ceil(sz * tr.d));
        if (bw > 2 && bh > 2) {
          const d = this.getImageData(bx, by, bw, bh).data, ls = []; for (let i = 0; i < d.length; i += 4) ls.push(W.lum([d[i], d[i + 1], d[i + 2]]));
          ls.sort((a, b) => a - b); const L = ls[Math.floor(ls.length / 2)], tl = W.lum(st), ratio = (Math.max(L, tl) + 0.05) / (Math.min(L, tl) + 0.05);
          out.texts++; if (ratio < out.worst) out.worst = +ratio.toFixed(2);
          if (ratio < 4.5) bad(cur + ': "' + String(t).slice(0, 36) + '" ' + st + ' on a ground of luminance ' + L.toFixed(2) + ' = ' + ratio.toFixed(2));
        }
      }
      return ft.call(this, t, x, y, mw);
    };
    const screens = {
      title: () => { G.state = 'title'; G.menus.title(ctx); },
      hud: () => { G.rooms.draw(ctx, 1 / 60); G.hud.draw(ctx); },
      boss: () => { D.startBoss('r1'); D.step(200); G.rooms.draw(ctx, 1 / 60); G.hud.draw(ctx); },
      pause: () => { G.state = 'pause'; G.menus.open('kb'); G.menus.menu.page = 'main'; G.menus.pause(ctx); },
      controls: () => { G.menus.menu.page = 'controls'; G.menus.pause(ctx); },
      comfort: () => { G.menus.menu.page = 'comfort'; G.menus.pause(ctx); },
      map: () => { G.state = 'map'; G.map.draw(ctx); },
      lose: () => { G.run.over = 'lose'; G.menus.over(ctx); },
      win: () => { G.run.over = 'win'; G.menus.over(ctx); }
    };
    D.gotoRoom('hub'); D.step(1500);
    for (const [name, f] of Object.entries(screens)) {
      cur = name; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 960, 544); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 960, 544);
      try { G.ui.mode = 0; f(); } catch (e) { bad(name + ': ' + e.message); }
      G.state = 'play';
    }
    // prompts: a plinth, a gate, a door, a sign, with the player standing at it
    D.gotoRoom('hub'); D.step(10); G.run.over = null;
    cur = 'prompt'; for (const pr of G.rooms.current.props) { const L = pr.prompt(G.players[0]); if (!L) continue; G.cam.x = 0; G.cam.y = 0; ctx.clearRect(0, 0, 960, 544); ctx.fillStyle = '#10201e'; ctx.fillRect(0, 0, 960, 544); G.props.drawPrompt(ctx, pr, L); }
    CanvasRenderingContext2D.prototype.fillText = ft; G.sprites = keep[0]; G.strips = keep[1];
    return out;
  });
  if (U.fail.length) throw new Error(U.fail.slice(0, 10).join(' | ') + (U.fail.length > 10 ? ' ... +' + (U.fail.length - 10) : ''));

  // perf: step + draw, art on against off, in the same page and order, busy room and every Warden fight
  const F = await page.evaluate(() => {
    const D = G.debug, ctx = document.getElementById('game').getContext('2d'), out = {};
    const cal = () => { const t0 = performance.now(); let s = 0; for (let i = 0; i < 3e6; i++) s += Math.sqrt(i) % 3; return performance.now() - t0 + (s < 0 ? 1 : 0); };
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(3);
    const run = secs => { let sum = 0, n = 0, worst = 0, calMax = 0; for (let i = 0; i < 60 * secs; i++) { if (i % 120 === 0) calMax = Math.max(calMax, Math.min(cal(), cal())); if (i % 6 === 0) for (let k = 0; k < G.players.length; k++) D.setInput(k, { left: rng() < 0.2, right: rng() < 0.5, jump: rng() < 0.3, attack: rng() < 0.5, dash: rng() < 0.05 }); const t0 = performance.now(); D.step(2); G.rooms.draw(ctx, 1 / 60); G.hud.draw(ctx); const t = performance.now() - t0; sum += t; n++; if (t > worst) worst = t; } return { avg: +(sum / n).toFixed(2), worst: +worst.toFixed(1), cal: +calMax.toFixed(1) }; };
    G.players.length = 0; D.newRun(5); D.unlockAll(); D.god(true); while (G.players.length < 4) D.addPlayer();
    D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('cinder_bell'); D.give('basalt_roller');
    const spots = [['hub', null], ['r1', 'boss'], ['r2', 'boss'], ['r3', 'boss'], ['r4', 'boss'], ['final', 'boss']];
    for (const [id, kind] of spots) {
      for (const on of [false, true, false, true]) {
        G.artTest = on; if (kind) { D.startBoss(id); D.step(30); } else { D.gotoRoom(id); D.step(30); }
        const r = run(5); const k = id + (on ? ':on' : ':off'); if (!out[k] || r.avg < out[k].avg) out[k] = r;
      }
    }
    G.artTest = true; return out;
  });
  const CAL_QUIET = 29, lim = v => 6 * Math.max(1, v.cal / CAL_QUIET), rows = [], badPerf = [];
  let sumOn = 0, sumOff = 0, n = 0;
  for (const id of ['hub', 'r1', 'r2', 'r3', 'r4', 'final']) {
    const a = F[id + ':on'], b = F[id + ':off']; sumOn += a.avg; sumOff += b.avg; n++;
    rows.push(id + ' ' + b.avg + '->' + a.avg); if (a.avg >= lim(a)) badPerf.push(id + ' ' + a.avg + ' ms (limit ' + lim(a).toFixed(1) + ')');
  }
  if (badPerf.length) throw new Error('over the frame budget with the art on: ' + badPerf.join(', ') + ' (' + rows.join(', ') + ')');

  // contact sheets: four rooms per place, then the screens (page screenshots of the real canvas)
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
  await page.evaluate(() => { G.debug.newRun(7); G.debug.god(true); G.debug.unlockAll(); G.debug.give('cobalt_awl'); G.debug.give('ochre_ladle'); G.artTest = true; });
  await page.waitForFunction(() => !G.spritesPending);
  for (const reg of places) {
    const frames = [];
    for (const key of reg === 'hub' ? ['hub', 'hub', 'hub', 'hub'] : ['main:' + reg, 'trial:' + reg, 'branch:' + reg, 'arena:' + reg]) {
      await page.evaluate(({ key, reg, i }) => {
        const D = G.debug; if (!D.gotoRoom(key)) D.gotoRoom(reg === 'hub' ? 'hub' : reg); D.step(40);
        const ctx = document.getElementById('game').getContext('2d'), room = G.rooms.current, p = G.players[0];
        if (reg === 'hub' && i > 0) { const defs = Object.values(G.roomDefs).filter(d => d.region === 'shared'), def = defs[i * 3 % defs.length]; room.region = 'hub'; room.grid = def.grid; room.cols = def.cols; room.rows = def.rows; room.id = def.id; room.def = def; room.props = []; room.enemies = []; G.tiles.load(def.grid); p.place(4 * G.C.T, (def.rows - 2) * G.C.T, 1); G.cam.follow(0, p.x, p.y, true); }
        G.rooms.draw(ctx, 1 / 60); G.hud.draw(ctx);
      }, { key, reg, i: frames.length });
      frames.push(await canvas.screenshot());
    }
    await sheet('world_' + names[reg] + '.png', frames, 2);
  }
  const sc = [];
  const shot = async js => { await page.evaluate(js); sc.push(await canvas.screenshot()); };
  await shot(() => { G.state = 'title'; G.menus.title(document.getElementById('game').getContext('2d')); });
  await shot(() => { G.state = 'play'; G.debug.gotoRoom('hub'); G.debug.step(1500); const c = document.getElementById('game').getContext('2d'); G.rooms.draw(c, 1 / 60); G.hud.draw(c); });
  await shot(() => { G.debug.startBoss('r1'); G.debug.step(240); const c = document.getElementById('game').getContext('2d'); G.rooms.draw(c, 1 / 60); G.hud.draw(c); });
  await shot(() => { G.state = 'pause'; G.menus.open('kb'); G.menus.menu.page = 'main'; const c = document.getElementById('game').getContext('2d'); G.rooms.draw(c, 1 / 60); G.menus.pause(c); });
  await shot(() => { G.state = 'map'; G.map.draw(document.getElementById('game').getContext('2d')); });
  await shot(() => { G.state = 'play'; G.run.over = 'win'; G.menus.over(document.getElementById('game').getContext('2d')); });
  await shot(() => { G.run.over = 'lose'; G.menus.over(document.getElementById('game').getContext('2d')); });
  await shot(() => { G.run.over = null; G.state = 'play'; G.debug.gotoRoom('hub'); G.debug.step(1500); G.debug.place(0, G.rooms.current.props.find(p => p.type === 'gate').x, G.rooms.current.props.find(p => p.type === 'gate').y, 1); G.debug.step(3); const c = document.getElementById('game').getContext('2d'); G.rooms.draw(c, 1 / 60); G.hud.draw(c); });
  await sheet('world_screens.png', sc, 2);
  await page.evaluate(() => { G.state = 'play'; G.run.over = null; });
  return R.rooms + ' room draws, ' + R.samples + ' edge samples (worst top edge ' + R.worst.plat + ':1, spikes ' + R.worst.spike + ':1, need ' + RATIO + '), ' + U.texts + ' texts (worst ' + U.worst + ':1, need ' + TEXT_RATIO + '), perf ms flat->watercolor ' + rows.join(', ');
};
