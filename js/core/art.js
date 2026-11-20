/* The one door all drawing goes through, so a later art pass can swap pictures in without touching gameplay.
   G.art.draw(id, ctx, opts) uses G.sprites[id] if it exists, otherwise the registered procedural painter. */
(() => {
'use strict';
const G = window.G, C = G.C, T = C.T;

G.sprites = {};
G.strips = {};                        // id -> { img, frames, fw, fh }: multi-frame strips (the player's watercolor test)
G.artTest = true;                     // F2 switches the watercolor player test on and off                       // id -> HTMLImageElement | HTMLCanvasElement (filled by the art pass)
const painters = {};
const BASE_PALETTE = {
  sky0: '#0d1a19', sky1: '#152825', sky2: '#0c1514', far: '#11201e', near: '#0e1a18',
  tile: '#060b0b', side: '#1c2c29', edge: '#3f6b5a', edgeHi: '#6fa08a', accent: '#d9c5a0', spike: '#c9c2ae'
};
addEventListener('keydown', e => { if (e.code === 'F2' && !e.repeat) { e.preventDefault(); G.artTest = !G.artTest; } });
const hash1 = (i, s) => Math.abs(Math.sin(i * 12.9898 + s) * 43758.5453) % 1;

const art = G.art = {
  define(id, painter) { painters[id] = painter; },
  // opts: { x, y, w, h, face, anchor: 'feet' | 'center', ... anything the painter wants }.
  // A sprite is drawn with its bottom centre (or centre) on x, y. Returns false if nothing is registered.
  draw(id, ctx, opts = {}) {
    const img = G.sprites[id];
    if (img) {
      const w = opts.w || img.width, h = opts.h || img.height;
      ctx.save(); ctx.translate(opts.x || 0, opts.y || 0); if (opts.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, opts.anchor === 'center' ? -h / 2 : -h, w, h);
      ctx.restore(); return true;
    }
    if (painters[id]) { painters[id](ctx, opts); return true; }
    return false;
  },
  // Multi-frame strips: G.strips[id] = { img, frames, fw, fh } (frames side by side, each facing right). The art pass fills it, see js/art/sprites.js.
  hasStrip(id) { return !!G.strips[id]; },
  // Draw frame n (wraps) of a strip with its bottom centre on opts.x, opts.y; opts.face < 0 flips it; opts.h scales it to that many pixels tall
  // (opts.foot: source pixels between the figure's feet and the frame bottom, so the feet land on y). Returns false if the strip is not loaded.
  drawFrame(id, ctx, n, opts = {}) {
    const st = G.strips[id];
    if (!st) return false;
    const k = opts.h ? opts.h / st.fh : 1, f = ((Math.floor(n) % st.frames) + st.frames) % st.frames;
    ctx.save(); ctx.translate(opts.x || 0, opts.y || 0); if (opts.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(st.img, f * st.fw, 0, st.fw, st.fh, -st.fw * k / 2, -st.fh * k + (opts.foot || 0) * k, st.fw * k, st.fh * k);
    ctx.restore(); return true;
  },
  // A frame of a strip as a one-colour silhouette (cached per strip, frame and colour), drawn like drawFrame; opts.color, opts.alpha.
  drawSilhouette(id, ctx, n, opts = {}) {
    const st = G.strips[id];
    if (!st) return false;
    const f = ((Math.floor(n) % st.frames) + st.frames) % st.frames, key = id + ':' + f + ':' + opts.color, cache = (G.art._sil = G.art._sil || {});
    let cv = cache[key];
    if (!cv) {
      cv = cache[key] = document.createElement('canvas'); cv.width = st.fw; cv.height = st.fh;
      const c = cv.getContext('2d'); c.drawImage(st.img, f * st.fw, 0, st.fw, st.fh, 0, 0, st.fw, st.fh);
      c.globalCompositeOperation = 'source-in'; c.fillStyle = opts.color || '#fff3c4'; c.fillRect(0, 0, st.fw, st.fh);
    }
    const k = opts.h ? opts.h / st.fh : 1;
    ctx.save(); ctx.globalAlpha = opts.alpha === undefined ? 0.4 : opts.alpha; ctx.translate(opts.x || 0, opts.y || 0); if (opts.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(cv, -st.fw * k / 2, -st.fh * k + (opts.foot || 0) * k, st.fw * k, st.fh * k);
    ctx.restore(); return true;
  },
  // Region colours: { sky0, sky1, sky2, far, near, tile, side, edge, edgeHi, accent, spike }; a region's palette overrides the base.
  palette(regionId) {
    const r = G.regionDefs && G.regionDefs[regionId];
    return Object.assign({}, BASE_PALETTE, r && r.palette);
  },
  // Region-specific silhouettes layered over the generic parallax. These are visual only: no room geometry or collision.
  regionBackdrop(ctx, regionId, pal, camX, time) {
    if (regionId !== 'r1') return;
    const wrap = (x, span, pad = 180) => ((x + pad) % span + span) % span - pad;
    ctx.save();

    // Beached hulls: broad, low silhouettes sunk into the dry seabed.
    ctx.globalAlpha = 0.58; ctx.fillStyle = pal.far; ctx.strokeStyle = pal.edge; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = wrap(i * 255 + hash1(i, 18.2) * 110 - camX * 0.16, 1650), y = 350 + hash1(i, 9.7) * 82;
      const w = 115 + hash1(i, 4.1) * 78, h = 42 + hash1(i, 27.3) * 34;
      ctx.beginPath(); ctx.moveTo(x - w * 0.55, y);
      ctx.quadraticCurveTo(x - w * 0.25, y + h * 0.9, x + w * 0.38, y + h * 0.55);
      ctx.quadraticCurveTo(x + w * 0.58, y + h * 0.28, x + w * 0.55, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Exposed ribs rising from the wreck.
      ctx.globalAlpha = 0.34;
      for (let r = -2; r <= 2; r++) {
        const rx = x + r * w * 0.12, top = y - 24 - (2 - Math.abs(r)) * 13;
        ctx.beginPath(); ctx.moveTo(rx, y + h * 0.34);
        ctx.bezierCurveTo(rx - 9, y - 2, rx - 7, top + 10, rx, top);
        ctx.bezierCurveTo(rx + 7, top + 10, rx + 9, y - 2, rx + 4, y + h * 0.34);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.58;
    }

    // Near chains, with sagging runs and a few oversized links. Slow parallax keeps them behind gameplay.
    ctx.strokeStyle = pal.edgeHi; ctx.lineWidth = 2; ctx.globalAlpha = 0.28;
    for (let i = 0; i < 4; i++) {
      const x = wrap(170 + i * 330 - camX * 0.42, 1450), y = 92 + (i % 2) * 58;
      ctx.beginPath(); ctx.moveTo(x - 145, y - 55); ctx.quadraticCurveTo(x, y + 105, x + 145, y - 30); ctx.stroke();
      for (let k = -2; k <= 2; k++) {
        const lx = x + k * 55, ly = y + 35 + (1 - Math.abs(k) * 0.22) * 34;
        ctx.beginPath(); ctx.ellipse(lx, ly, 7, 12, k % 2 ? 0.45 : -0.45, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // A faint dry-line horizon scratches across the basin.
    ctx.globalAlpha = 0.22; ctx.strokeStyle = pal.accent; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = 448 + i * 11;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(220, y - 5, 640, y + 7, C.W, y - 2); ctx.stroke();
    }
    ctx.restore();
  },
  // A cut's shape (see G.CLASSES[cls].shape) filled at 0,0 with radius r: 'triangle' | 'crescent' | 'star' | 'slab'.
  cutShape(ctx, shape, r) {
    ctx.beginPath();
    if (shape === 'triangle') { ctx.moveTo(0, -r); ctx.lineTo(r * 0.9, r * 0.7); ctx.lineTo(-r * 0.9, r * 0.7); ctx.closePath(); ctx.fill(); }
    else if (shape === 'crescent') { ctx.arc(0, 0, r, 0.5, Math.PI * 2 - 0.5); ctx.arc(r * 0.45, 0, r * 0.7, Math.PI * 2 - 0.9, 0.9, true); ctx.closePath(); ctx.fill(); }
    else if (shape === 'star') {
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, k = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k); }
      ctx.closePath(); ctx.fill();
    } else ctx.fillRect(-r, -r * 0.4, r * 2, r * 0.8);
  },
  label(ctx, text, x, y, size, color, align = 'center', font = C.FONT, weight = 500) {
    ctx.font = weight + ' ' + size + 'px ' + font; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(5,9,8,0.75)'; ctx.fillText(text, x + 1, y + 1.5);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  },
  // Screen-space background with two parallax layers and drifting motes.
  backdrop(ctx, pal, camX, time, regionId) {
    const g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, pal.sky0); g.addColorStop(0.6, pal.sky1); g.addColorStop(1, pal.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, C.W, C.H);
    for (const [f, col, n, seed] of [[0.25, pal.far, 26, 3.1], [0.5, pal.near, 22, 7.7]]) {
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const h1 = hash1(i, seed), h2 = hash1(i * 6.02, seed + 1.3);
        const x = i * 190 * (0.6 + f) + h1 * 120 - camX * f, w = 40 + h2 * 70;
        if (x > C.W + 100 || x < -160) continue;
        if (i % 2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 0.5, 120 + h1 * 200); ctx.closePath(); ctx.fill(); }
        else ctx.fillRect(x, 120 + h1 * 160, w, C.H);
      }
    }
    art.regionBackdrop(ctx, regionId, pal, camX, time);
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 46; i++) {
      const x = (((i * 211.7 + time * (6 + i % 5 * 3)) - camX * 0.8) % (C.W + 40) + C.W + 40) % (C.W + 40) - 20;
      const y = (i * 97.3 + Math.sin(time * 0.6 + i) * 18) % 440 + 30;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 1.3 + i * 2.1); ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  },
  // World-space tiles of the current room.
  tiles(ctx, pal, regionId) {
    const tl = G.tiles, grid = tl.grid;
    const c0 = Math.max(0, Math.floor(G.cam.x / T)), c1 = Math.min(tl.cols - 1, Math.floor((G.cam.x + C.W) / T));
    const r0 = Math.max(0, Math.floor(G.cam.y / T)), r1 = Math.min(tl.rows - 1, Math.floor((G.cam.y + C.H) / T));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = c * T, y = r * T, ch = grid[r][c];
      if (ch === '#') {
        ctx.fillStyle = pal.tile; ctx.fillRect(x, y, T + 0.5, T + 0.5);
        if (r > 0 && grid[r - 1][c] !== '#') {
          ctx.fillStyle = pal.edge; ctx.fillRect(x, y, T + 0.5, 4); ctx.fillStyle = pal.edgeHi; ctx.fillRect(x, y, T + 0.5, 1.5);
          if ((c * 7 + r) % 3 === 0) { ctx.fillStyle = pal.edge; ctx.fillRect(x + 6, y - 3, 2, 3); ctx.fillRect(x + 19, y - 4, 2, 4); }
        }
        ctx.fillStyle = pal.side;
        if (c > 0 && grid[r][c - 1] !== '#') ctx.fillRect(x, y, 2, T);
        if (c < tl.cols - 1 && grid[r][c + 1] !== '#') ctx.fillRect(x + T - 2, y, 2, T);
        if (r < tl.rows - 1 && grid[r + 1][c] !== '#') ctx.fillRect(x, y + T - 2, T, 2);
        if (regionId === 'r1' && ((c * 13 + r * 7) % 6 === 0)) {
          ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = pal.edge; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x + 7, y + 9); ctx.lineTo(x + T - 7, y + 9); ctx.stroke();
          ctx.fillStyle = pal.edgeHi; ctx.beginPath(); ctx.arc(x + 8, y + 8, 1.7, 0, 6.283); ctx.arc(x + T - 8, y + 8, 1.7, 0, 6.283); ctx.fill();
          ctx.restore();
        }
      } else if (ch === '^') {
        ctx.fillStyle = pal.tile; ctx.fillRect(x, y + 26, T + 0.5, 6.5);
        ctx.fillStyle = pal.spike;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y + 28); ctx.lineTo(x + i * 8 + 4, y + 8); ctx.lineTo(x + i * 8 + 8, y + 28); ctx.closePath(); ctx.fill(); }
      } else if (ch === '=') {
        ctx.fillStyle = pal.edge; ctx.fillRect(x, y, T + 0.5, 5); ctx.fillStyle = pal.edgeHi; ctx.fillRect(x, y, T + 0.5, 1.5);
        ctx.fillStyle = pal.side; ctx.fillRect(x + 4, y + 5, 3, 5); ctx.fillRect(x + T - 7, y + 5, 3, 5);
        if (regionId === 'r1') {
          ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = pal.edgeHi;
          ctx.fillRect(x + 6, y + 2, 2, 2); ctx.fillRect(x + T - 8, y + 2, 2, 2);
          ctx.restore();
        }
      }
    }
    ctx.fillStyle = pal.accent;
    for (const b of tl.blockers) if (b.on) for (let i = 0; i < 4; i++) ctx.fillRect(b.c * T + 3 + i * 8, b.r0 * T, 3, (b.r1 - b.r0 + 1) * T);
  }
};
})();
