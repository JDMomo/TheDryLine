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

const bgLine = (ctx,x0,y0,x1,y1,col,w=3,a=0.5) => { ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.globalAlpha=1; };
function regionScenery(ctx, region, pal, camX, time) {
  const drift = -((camX * 0.16) % 260);
  ctx.save();
  if (region === 'r1') { // Wreck Quay: distant hulls and ribs, kept as quiet silhouettes.
    ctx.globalAlpha=0.34; ctx.strokeStyle=pal.edge; ctx.lineWidth=5;
    for(let i=-1;i<6;i++){ const x=drift+i*210; ctx.beginPath(); ctx.arc(x+90,360,78,Math.PI,Math.PI*2); ctx.stroke(); bgLine(ctx,x+20,360,x+160,360,pal.side,8,0.35); }
    ctx.globalAlpha=0.18; ctx.fillStyle=pal.edgeHi; for(let i=0;i<8;i++) ctx.fillRect(((i*173-camX*0.08)%1100+1100)%1100-80,390+(i%3)*16,110,3);
  } else if (region === 'r2') { // Signal Reef: coral forks and suspended lamps.
    for(let i=-1;i<8;i++){ const x=drift+i*145, h=90+(i%4)*34; bgLine(ctx,x,430,x,430-h,pal.edge,5,0.32); bgLine(ctx,x,430-h*0.55,x-24,430-h*0.82,pal.edge,3,0.28); bgLine(ctx,x,430-h*0.7,x+30,430-h*0.95,pal.edge,3,0.28); }
    ctx.globalAlpha=0.38; ctx.fillStyle=pal.accent; for(let i=0;i<6;i++){ const x=((i*197-camX*0.12)%1040+1040)%1040-40, y=120+(i%3)*72; ctx.fillRect(x-2,y,4,24); ctx.beginPath(); ctx.arc(x,y+28,5,0,6.283); ctx.fill(); } ctx.globalAlpha=1;
  } else if (region === 'r3') { // Salt Cutting: layered white shelves and crystal teeth.
    ctx.globalAlpha=0.24; ctx.fillStyle=pal.edge; for(let i=-1;i<6;i++){ const x=drift+i*230, h=55+(i%3)*34; ctx.beginPath(); ctx.moveTo(x,430); ctx.lineTo(x+28,430-h); ctx.lineTo(x+155,430-h+10); ctx.lineTo(x+205,430); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha=0.28; ctx.fillStyle=pal.edgeHi; for(let i=0;i<10;i++){ const x=((i*121-camX*0.1)%1060+1060)%1060-40, y=360+(i%4)*13; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+7,y-22-(i%3)*8); ctx.lineTo(x+14,y); ctx.closePath(); ctx.fill(); } ctx.globalAlpha=1;
  } else if (region === 'r4') { // Ticket Hall: repeated station arches and stopped clocks.
    ctx.globalAlpha=0.28; ctx.strokeStyle=pal.edge; ctx.lineWidth=5;
    for(let i=-1;i<6;i++){ const x=drift+i*205; ctx.beginPath(); ctx.moveTo(x,430); ctx.lineTo(x,250); ctx.quadraticCurveTo(x+78,170,x+156,250); ctx.lineTo(x+156,430); ctx.stroke(); }
    ctx.globalAlpha=0.24; ctx.strokeStyle=pal.accent; ctx.lineWidth=2; for(let i=0;i<5;i++){ const x=((i*229-camX*0.09)%1100+1100)%1100, y=125+(i%2)*90; ctx.beginPath(); ctx.arc(x,y,20,0,6.283); ctx.stroke(); bgLine(ctx,x,y,x,y-12,pal.accent,2,0.24); bgLine(ctx,x,y,x+10,y+4,pal.accent,2,0.24); } ctx.globalAlpha=1;
  } else if (region === 'final') { // Terminus: rails converging on the great clock.
    ctx.globalAlpha=0.24; ctx.fillStyle=pal.near; ctx.fillRect(395,80,170,350);
    ctx.strokeStyle=pal.accent; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(480,170,58,0,6.283); ctx.stroke();
    bgLine(ctx,480,170,480,126,pal.accent,3,0.35); bgLine(ctx,480,170,520,184,pal.accent,3,0.35);
    for(const y of [410,432]){ bgLine(ctx,-40,y,480,320,pal.edge,3,0.28); bgLine(ctx,1000,y,480,320,pal.edge,3,0.28); }
    ctx.globalAlpha=1;
  } else { // Junction: quiet turntable geometry and platform lamps.
    ctx.globalAlpha=0.22; ctx.strokeStyle=pal.edge; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(480,430,280,Math.PI,Math.PI*2); ctx.stroke();
    for(let i=0;i<7;i++){ const x=100+i*125; bgLine(ctx,x,430,x,260,pal.side,4,0.24); ctx.globalAlpha=0.3; ctx.fillStyle=pal.accent; ctx.beginPath(); ctx.arc(x,250,5,0,6.283); ctx.fill(); }
    ctx.globalAlpha=1;
  }
  // Paper/wash grain: deterministic, faint and static in screen space so it reads like texture rather than particles.
  ctx.fillStyle='#f3ead6'; for(let i=0;i<72;i++){ const x=hash1(i,19.7)*C.W, y=hash1(i,41.2)*C.H; ctx.globalAlpha=0.018+hash1(i,7.3)*0.022; ctx.fillRect(x,y,1+hash1(i,3.4)*2,1); }
  ctx.globalAlpha=1; ctx.restore();
}

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
  backdrop(ctx, pal, camX, time, region = 'hub') {
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
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 46; i++) {
      const x = (((i * 211.7 + time * (6 + i % 5 * 3)) - camX * 0.8) % (C.W + 40) + C.W + 40) % (C.W + 40) - 20;
      const y = (i * 97.3 + Math.sin(time * 0.6 + i) * 18) % 440 + 30;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 1.3 + i * 2.1); ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    regionScenery(ctx, region, pal, camX, time);
    const vg=ctx.createLinearGradient(0,0,0,C.H); vg.addColorStop(0,'rgba(0,0,0,0.18)'); vg.addColorStop(0.18,'rgba(0,0,0,0)'); vg.addColorStop(0.82,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.28)'); ctx.fillStyle=vg; ctx.fillRect(0,0,C.W,C.H);
  },
  // World-space tiles of the current room.
  tiles(ctx, pal) {
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
          const reg=G.rooms&&G.rooms.current&&G.rooms.current.region;
          if(reg==='r1' && (c+r)%4===0){ ctx.fillStyle=pal.edgeHi; ctx.globalAlpha=.45; ctx.fillRect(x+8,y+7,3,3); ctx.fillRect(x+22,y+7,3,3); ctx.globalAlpha=1; }
          else if(reg==='r2' && (c+r)%3===0){ ctx.strokeStyle=pal.edgeHi; ctx.globalAlpha=.35; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x+9,y+4); ctx.lineTo(x+6,y-5); ctx.moveTo(x+22,y+4); ctx.lineTo(x+26,y-7); ctx.stroke(); ctx.globalAlpha=1; }
          else if(reg==='r3' && (c+r)%3===0){ ctx.fillStyle=pal.edgeHi; ctx.globalAlpha=.38; ctx.beginPath(); ctx.moveTo(x+7,y+4); ctx.lineTo(x+12,y-5); ctx.lineTo(x+16,y+4); ctx.fill(); ctx.globalAlpha=1; }
          else if(reg==='r4' && c%3===0){ ctx.fillStyle=pal.edgeHi; ctx.globalAlpha=.32; ctx.fillRect(x+4,y+7,24,2); ctx.globalAlpha=1; }
          else if(reg==='final' && (c+r)%4===0){ ctx.strokeStyle=pal.edgeHi; ctx.globalAlpha=.28; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(x+16,y+14,7,0,6.283); ctx.stroke(); ctx.globalAlpha=1; }
        }
        ctx.fillStyle = pal.side;
        if (c > 0 && grid[r][c - 1] !== '#') ctx.fillRect(x, y, 2, T);
        if (c < tl.cols - 1 && grid[r][c + 1] !== '#') ctx.fillRect(x + T - 2, y, 2, T);
        if (r < tl.rows - 1 && grid[r + 1][c] !== '#') ctx.fillRect(x, y + T - 2, T, 2);
      } else if (ch === '^') {
        ctx.fillStyle = pal.tile; ctx.fillRect(x, y + 26, T + 0.5, 6.5);
        ctx.fillStyle = pal.spike;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y + 28); ctx.lineTo(x + i * 8 + 4, y + 8); ctx.lineTo(x + i * 8 + 8, y + 28); ctx.closePath(); ctx.fill(); }
      } else if (ch === '=') {
        ctx.fillStyle = pal.edge; ctx.fillRect(x, y, T + 0.5, 5); ctx.fillStyle = pal.edgeHi; ctx.fillRect(x, y, T + 0.5, 1.5);
        ctx.fillStyle = pal.side; ctx.fillRect(x + 4, y + 5, 3, 5); ctx.fillRect(x + T - 7, y + 5, 3, 5);
      } else if (ch === 's') {
        ctx.fillStyle = '#e8e2cf'; ctx.fillRect(x, y, T + 0.5, T + 0.5);
        ctx.fillStyle = '#f7f3e6'; ctx.fillRect(x, y, T + 0.5, 4);
        ctx.strokeStyle = '#b9b39f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 5, y + 12); ctx.lineTo(x + 13, y + 17); ctx.lineTo(x + 9, y + 25); ctx.moveTo(x + 22, y + 8); ctx.lineTo(x + 18, y + 19); ctx.lineTo(x + 27, y + 24); ctx.stroke();
      } else if (ch === 'm') {
        ctx.fillStyle = '#4d4035'; ctx.fillRect(x, y, T + 0.5, T + 0.5);
        ctx.fillStyle = '#766253'; ctx.fillRect(x, y, T + 0.5, 5);
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#2f2925'; ctx.beginPath(); ctx.ellipse(x + 10, y + 12, 6, 2, 0, 0, 6.283); ctx.ellipse(x + 24, y + 22, 5, 2, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      } else if (ch === '>' || ch === '<') {
        ctx.fillStyle = '#394442'; ctx.fillRect(x, y, T + 0.5, T + 0.5);
        ctx.fillStyle = '#687672'; ctx.fillRect(x, y, T + 0.5, 5);
        ctx.strokeStyle = '#b6c0b9'; ctx.lineWidth = 2; const d = ch === '>' ? 1 : -1, cx = x + 16;
        ctx.beginPath(); ctx.moveTo(cx - d * 6, y + 12); ctx.lineTo(cx + d * 3, y + 17); ctx.lineTo(cx - d * 6, y + 22); ctx.stroke();
      } else if (ch === 'c') {
        const st = tl.crumbleState(c, r);
        if (!tl.crumbleGone(c, r)) {
          const blink = st && st.phase === 'warn' ? 0.48 + 0.38 * Math.abs(Math.sin(G.time * 24)) : 1;
          ctx.globalAlpha = blink; ctx.fillStyle = pal.tile; ctx.fillRect(x, y, T + 0.5, T + 0.5);
          ctx.fillStyle = pal.edge; ctx.fillRect(x, y, T + 0.5, 4);
          ctx.strokeStyle = pal.edgeHi; ctx.lineWidth = 1.5; ctx.beginPath();
          ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 13, y + 16); ctx.lineTo(x + 9, y + 27);
          ctx.moveTo(x + 28, y + 7); ctx.lineTo(x + 20, y + 15); ctx.lineTo(x + 25, y + 28); ctx.stroke(); ctx.globalAlpha = 1;
        }
      } else if (ch === 'j') {
        ctx.fillStyle = '#303b39'; ctx.fillRect(x, y, T + 0.5, T + 0.5);
        ctx.strokeStyle = '#d9b85b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 5, y + 23); ctx.lineTo(x + 11, y + 11); ctx.lineTo(x + 17, y + 23); ctx.lineTo(x + 23, y + 11); ctx.lineTo(x + 28, y + 23); ctx.stroke();
        ctx.fillStyle = '#d9b85b'; ctx.fillRect(x + 3, y + 3, T - 6, 4);
      } else if (ch === 'v') {
        ctx.fillStyle = '#3a4644'; ctx.fillRect(x, y, T + 0.5, T + 0.5);
        ctx.fillStyle = '#8d9b96'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 5 + k * 9, y + 5, 4, 12);
        if (tl.ventActive(c, r)) {
          ctx.globalAlpha = 0.42; ctx.fillStyle = '#d8e3de';
          for (let k = 0; k < 5; k++) { const yy = y - 12 - ((G.time * 95 + k * 23) % 105); ctx.beginPath(); ctx.arc(x + 7 + (k % 3) * 9, yy, 5 + (k % 2) * 2, 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.fillStyle = pal.accent;
    for (const b of tl.blockers) if (b.on) for (let i = 0; i < 4; i++) ctx.fillRect(b.c * T + 3 + i * 8, b.r0 * T, 3, (b.r1 - b.r0 + 1) * T);
  }
};
})();
