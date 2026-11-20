/* WORLD ART, backdrops: three parallax layers for each of the six places (far, mid, near), painted once into repeating strips and drawn
   with a few drawImage calls. Darker and softer than the play layer (the tiles); far is the palest and hazy, near the darkest.
   Each place has its own composition so they cannot be mistaken for each other:
     Junction  vaulted arches and columns, brass wire and warm lamps      Wreck Quay  diagonals: ship ribs, hulls, masts and chains
     Signal Reef  organic coral towers, sagging cables and signal lamps    Salt Cutting  stepped canyon strata, crystal spires, a trestle
     Ticket Hall  tall windows, a clock, iron trusses and chandeliers       The Terminus  chimneys, pipe runs, gauges and steam
   A painted bg_<region>_<layer>_f1.png in assets/world replaces a layer (js/art/world_hooks.js). */
(() => {
'use strict';
const G = window.G, C = G.C, W = G.world, { mulberry, mix, rgba, mk, wob } = W;
const STRIPE = 100, WB = 1600, PAD = { far: 28, mid: 64, near: 110 }, FACT = { far: 0.1, mid: 0.28, near: 0.52 };
const LAYERS = ['far', 'mid', 'near'];
const layers = new Map();

// colours of each place: sky top/bottom, then the shape colours of far, mid, near, the lamp glow and the mote colour
const BG = {
  hub:   { sky: ['#1f3a3c', '#2f4c46'], far: '#3d5b55', mid: '#2c4842', near: '#172829', glow: '#e0a850', mote: '#e6d8a8' },
  r1:    { sky: ['#37444a', '#6b5844'], far: '#5f5448', mid: '#463a2f', near: '#251c16', glow: '#e8a860', mote: '#e8d2a0' },
  r2:    { sky: ['#392f50', '#54496b'], far: '#5b4f76', mid: '#40365b', near: '#231c36', glow: '#e8c878', mote: '#d6e6c8' },
  r3:    { sky: ['#2c4150', '#3a5262'], far: '#455b6b', mid: '#374c5c', near: '#1b2833', glow: '#b8ccd8', mote: '#e8f0f4' },
  r4:    { sky: ['#1e3229', '#2d473b'], far: '#3f5d4e', mid: '#2c4639', near: '#111d18', glow: '#e8c070', mote: '#d8d8a0' },
  final: { sky: ['#262c4c', '#3c4470'], far: '#464f7c', mid: '#323a6a', near: '#161a35', glow: '#c8d4f4', mote: '#dde4f6' }
};
W.BG = BG;

/* ---------- shape helpers ---------- */
const arch = (cx, baseY, w, h, th) => { const p = new Path2D(), r = w / 2, leg = h - r; p.moveTo(cx - r, baseY); p.lineTo(cx - r, baseY - leg); p.arc(cx, baseY - leg, r, Math.PI, 0); p.lineTo(cx + r, baseY); p.lineTo(cx + r - th, baseY); p.lineTo(cx + r - th, baseY - leg); p.arc(cx, baseY - leg, r - th, 0, Math.PI, true); p.lineTo(cx - r + th, baseY); p.closePath(); return p; };
const band = (x0, y0, cx, cy, x1, y1, w0, w1, n = 14) => {      // a curved stroke of tapering width, as a polygon
  const L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy), l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
    L.push([px - dy / l * w, py + dx / l * w]); Rr.push([px + dy / l * w, py - dx / l * w]);
  }
  const p = new Path2D(); p.moveTo(L[0][0], L[0][1]); for (const q of L) p.lineTo(q[0], q[1]); for (let i = Rr.length - 1; i >= 0; i--) p.lineTo(Rr[i][0], Rr[i][1]); p.closePath(); return p;
};
const rectP = (x, y, w, h) => { const p = new Path2D(); p.rect(x, y, w, h); return p; };
const polyP = pts => { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; };
const circP = (cx, cy, r) => { const p = new Path2D(); p.arc(cx, cy, r, 0, 6.2832); return p; };
// A backdrop shape: soft washes and a pooled edge; mid and near get a faint ink line so their forms still read.
function S(x, path, col, bb, seed, lv) {
  W.wc(x, path, col, { bb, seed, soft: 1, ink: false, edgeA: 0.5, edgeW: lv === 0 ? 14 : 9, blobs: Math.max(3, Math.min(9, Math.round(bb[2] * bb[3] / 3500))) });
  if (lv > 0) { x.strokeStyle = mix(col, '#000000', lv === 2 ? 0.4 : 0.32); x.globalAlpha = lv === 2 ? 0.35 : 0.42; x.lineWidth = 1.3; x.lineJoin = 'round'; x.stroke(path); x.globalAlpha = 1; }
}
let x;                                  // the context being painted (S uses it)
const lampGlow = (cx, cy, r, col, a) => { x.save(); x.globalAlpha = a; x.drawImage(W.glow(col), cx - r, cy - r, r * 2, r * 2); x.restore(); };
const cable = (x0, y0, x1, y1, sag, col, w, a = 0.85) => { x.save(); x.strokeStyle = col; x.lineWidth = w; x.globalAlpha = a; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1); x.stroke(); x.restore(); };
const stroke = (pts, col, w, a = 1) => { x.save(); x.strokeStyle = col; x.lineWidth = w; x.globalAlpha = a; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.restore(); };

/* ---------- the six places, layer by layer. Each gen draws one WB-wide period at x 0..WB (shapes may cross the edges: they are drawn at -WB, 0, +WB). ---------- */
const GEN = {
  hub: {
    far(K, R) {
      for (let i = 0; i < 4; i++) { const cx = i * 400 + 200, h = 300 + (i % 2) * 70; S(x, arch(cx, 500, 330, h, 40), K.far, [cx - 165, 500 - h, 330, h], 10 + i, 0); S(x, arch(cx, 500, 190, h - 100, 24), mix(K.far, K.sky[1], 0.3), [cx - 95, 500 - h + 100, 190, h - 100], 20 + i, 0); }
      for (let i = 0; i < 4; i++) { const cx = i * 400 + 200; x.fillStyle = rgba('#14221f', 0.55); x.beginPath(); x.ellipse(cx, 470, 54, 70, 0, Math.PI, 0); x.fill(); lampGlow(cx, 462, 34, K.glow, 0.2); }
    },
    mid(K, R) {
      const N = 6, sp = WB / N;
      for (let i = 0; i < N; i++) {
        const cx = i * sp + sp / 2, top = 60 + (i % 2) * 24;
        S(x, rectP(cx - 17, top, 34, 470 - top), K.mid, [cx - 17, top, 34, 470 - top], 40 + i, 1);
        S(x, rectP(cx - 27, top - 12, 54, 16), mix(K.mid, '#b8a066', 0.2), [cx - 27, top - 12, 54, 16], 50 + i, 1);
        S(x, rectP(cx - 24, 456, 48, 20), mix(K.mid, '#000000', 0.15), [cx - 24, 456, 48, 20], 60 + i, 1);
        S(x, arch(cx + sp / 2, top + 2, sp - 54, 110, 16), K.mid, [cx + 27, top - 108, sp - 54, 110], 70 + i, 1);
        cable(cx + 17, top + 40, cx + sp - 17, top + 40 + (i % 2 ? -24 : 24), 40, '#c8a660', 1.5, 0.55);
        if (i % 2 === 0) { const lx = cx + sp / 2; stroke([[lx, top + 10], [lx, top + 90]], '#1c2a26', 1.8, 0.9); S(x, polyP([[lx - 8, top + 90], [lx + 8, top + 90], [lx + 6, top + 106], [lx - 6, top + 106]]), mix(K.glow, K.mid, 0.4), [lx - 8, top + 90, 16, 16], 80 + i, 1); lampGlow(lx, top + 98, 70, K.glow, 0.16); }
      }
    },
    near(K, R) {
      for (let k = 0; k < 2; k++) { const cx = 230 + k * 800; S(x, arch(cx, 700, 640, 700, 54), K.near, [cx - 320, 0, 640, 700], 100 + k, 2); }
      for (let k = 0; k < 7; k++) { const px = 60 + k * 230 + (k % 3) * 20; stroke([[px, 0], [px + (k % 2 ? 6 : -6), 30 + (k * 37) % 60]], K.near, 2.4, 0.9); }
    }
  },
  r1: {
    far(K, R) {
      const base = 480;
      for (const [cx0, n] of [[80, 7], [640, 6], [1160, 5]]) for (let i = 0; i < n; i++) { const bx = cx0 + i * 34, h = 150 + Math.sin(i / (n - 1) * Math.PI) * 150, lean = 40 + i * 4; S(x, band(bx, base, bx + lean * 0.2, base - h * 1.1, bx + lean, base - h, 16, 6), K.far, [bx, base - h * 1.1, lean, h * 1.1], 200 + i + cx0, 0); }
      stroke([[1500, base], [1540, base - 190], [1590, base]], K.far, 6, 0.9); stroke([[1540, base - 190], [1600, base - 160]], K.far, 5, 0.9);
      S(x, rectP(0, base - 6, WB, 80), mix(K.far, K.sky[1], 0.3), [0, base - 6, WB, 80], 210, 0);
    },
    mid(K, R) {
      for (let k = 0; k < 2; k++) {
        const ox = k * 800 + 40, by = 470;
        S(x, polyP([[ox, by - 150], [ox + 60, by - 180], [ox + 440, by - 150], [ox + 520, by - 70], [ox + 470, by], [ox + 30, by]]), K.mid, [ox, by - 180, 520, 180], 220 + k, 1);
        for (let i = 1; i < 5; i++) stroke([[ox + 20, by - 150 + i * 28], [ox + 480 - i * 6, by - 142 + i * 28]], mix(K.mid, '#000000', 0.35), 2, 0.5);
        for (let i = 0; i < 3; i++) { const px = ox + 120 + i * 110, py = by - 100; S(x, circP(px, py, 11), mix(K.mid, '#000000', 0.3), [px - 11, py - 11, 22, 22], 230 + i, 1); lampGlow(px, py, 26, K.glow, 0.28); }
        const mx = ox + 300; stroke([[mx, by - 150], [mx + 24, by - 420]], K.mid, 9, 1); stroke([[mx + 12, by - 330], [mx + 130, by - 160]], K.mid, 1.6, 0.6); stroke([[mx + 12, by - 330], [mx - 100, by - 156]], K.mid, 1.6, 0.6); stroke([[mx + 4, by - 250], [mx + 90, by - 266]], K.mid, 5, 0.9);
      }
    },
    near(K, R) {
      for (let k = 0; k < 5; k++) { const cx = 140 + k * 320 + (k % 2) * 40, L = 120 + (k * 53) % 180; for (let y = -4, i = 0; y < L; y += 11, i++) { x.strokeStyle = K.near; x.lineWidth = 4.4; x.beginPath(); if (i % 2) x.ellipse(cx, y + 5, 1.6, 5, 0, 0, 6.3); else x.ellipse(cx, y + 5, 4.4, 5, 0, 0, 6.3); x.stroke(); } }
      S(x, band(-60, -20, 140, 20, 380, 190, 26, 18), K.near, [-60, -20, 440, 210], 250, 2); S(x, band(900, -20, 1100, 40, 1280, 170, 22, 14), K.near, [900, -20, 380, 190], 251, 2);
      for (let k = 0; k < 6; k++) { const bx = 400 + k * 22; cable(bx, 0, bx + 14, 0, 70 + (k % 3) * 22, K.near, 1.4, 0.8); }
    }
  },
  r2: {
    far(K, R) {
      for (let i = 0; i < 7; i++) {
        const cx = i * 230 + 80 + (i % 3) * 20, h = 190 + ((i * 71) % 170), w = 50 + (i % 3) * 14, base = 520;
        S(x, polyP([[cx - w, base], [cx - w * 0.4, base - h * 0.55], [cx - w * 0.55, base - h * 0.8], [cx, base - h], [cx + w * 0.55, base - h * 0.8], [cx + w * 0.4, base - h * 0.55], [cx + w, base]]), K.far, [cx - w, base - h, w * 2, h], 300 + i, 0);
        S(x, circP(cx - w * 0.9, base - h * 0.5, w * 0.34), K.far, [cx - w * 1.2, base - h * 0.6, w * 0.7, w * 0.7], 320 + i, 0); S(x, circP(cx + w * 0.85, base - h * 0.62, w * 0.28), K.far, [cx + w * 0.6, base - h * 0.7, w * 0.6, w * 0.6], 330 + i, 0);
      }
    },
    mid(K, R) {
      const stalks = [];
      for (let i = 0; i < 9; i++) {
        const bx = i * 178 + 30 + (i % 3) * 15, h = 220 + ((i * 53) % 200), lean = (i % 2 ? 1 : -1) * (24 + (i * 7) % 30), tx = bx + lean, ty = 520 - h;
        S(x, band(bx, 520, bx + lean * 1.6, 520 - h * 0.5, tx, ty, 20, 7), K.mid, [Math.min(bx, tx) - 10, ty, Math.abs(lean) + 24, h], 340 + i, 1);
        for (const [f, dir] of [[0.45, 1], [0.62, -1], [0.78, 1]]) { const yy = 520 - h * f, xx = bx + lean * (f * 1.1), ex = xx + dir * (26 + (i % 3) * 8), ey = yy - 36; S(x, band(xx, yy, xx + dir * 6, yy - 18, ex, ey, 9, 4, 8), K.mid, [Math.min(xx, ex) - 6, ey, 40, 40], 360 + i, 1); stalks.push([ex, ey, i]); }
        stalks.push([tx, ty - 4, i]);
      }
      for (let i = 0; i < stalks.length; i++) { const [sx, sy, k] = stalks[i]; if (i % 3 === 0) { const [ex, ey] = stalks[(i + 3) % stalks.length]; if (Math.abs(ex - sx) < 360 && ex > sx) cable(sx, sy + 4, ex, ey + 4, 30, '#1c1630', 1.4, 0.7); }
        if (i % 2 === 0) { lampGlow(sx, sy, 18, i % 4 === 0 ? '#b8d0a0' : K.glow, 0.1); S(x, circP(sx, sy, 3), '#85795a', [sx - 3, sy - 3, 6, 6], 380 + i, 1); } }
    },
    near(K, R) {
      for (let k = 0; k < 7; k++) { const px = 90 + k * 225 + (k % 3) * 30, L = 90 + (k * 67) % 200; stroke([[px, 0], [px + (k % 2 ? 8 : -8), L]], K.near, 2.6, 0.95); lampGlow(px + (k % 2 ? 8 : -8), L + 6, 44, '#cfe8c0', 0.15); S(x, polyP([[px - 6, L - 2], [px + 6, L - 2], [px + 8, L + 12], [px - 8, L + 12]]), mix(K.near, '#d8f0c0', 0.25), [px - 8, L - 2, 16, 14], 400 + k, 2); }
      for (let k = 0; k < 4; k++) { const cx = 220 + k * 400; for (let i = -3; i <= 3; i++) S(x, band(cx, -10, cx + i * 22, 50, cx + i * 40, 110 + Math.abs(i) * 8, 12, 4, 8), K.near, [cx + i * 40 - 20, -10, 40, 130], 420 + i + k * 9, 2); }
    }
  },
  r3: {
    far(K, R) {
      const steps = (seed, y0, amp) => { const pts = [[-20, 560]]; for (let i = 0; i <= 16; i++) { const px = i * 100, hh = y0 - Math.floor(W.vnoise(i * 0.9 + seed, seed, 5) * amp / 28) * 28; pts.push([px, hh], [px + 100, hh]); } pts.push([WB + 20, 560]); return pts; };
      for (const [seed, y0, amp, col] of [[1, 330, 150, mix(K.far, K.sky[0], 0.4)], [7, 400, 130, K.far]]) { const pts = steps(seed, y0, amp); pts[pts.length - 2][1] = pts[1][1]; pts[pts.length - 3][1] = pts[1][1]; S(x, polyP(pts), col, [0, y0 - amp, WB, amp + 200], seed * 31, 0); for (let i = 0; i < 6; i++) stroke([[0, y0 + 14 + i * 22], [WB, y0 + 14 + i * 22]], mix(col, '#ffffff', 0.12), 1.6, 0.3); }
    },
    mid(K, R) {
      for (let i = 0; i < 8; i++) {
        const cx = i * 200 + 60 + (i % 3) * 24;
        for (let j = 0; j < 3; j++) { const h = 90 + ((i * 53 + j * 71) % 150), w = 22 + (j * 9) % 18, bx = cx + j * 22 - 20, lean = (j - 1) * 6; S(x, polyP([[bx - w, 480], [bx - w * 0.5 + lean, 480 - h * 0.8], [bx + lean, 480 - h], [bx + w * 0.5 + lean, 480 - h * 0.78], [bx + w, 480]]), j === 1 ? K.mid : mix(K.mid, '#ffffff', 0.08), [bx - w, 480 - h, w * 2, h], 440 + i * 3 + j, 1); }
      }
      const ty = 392; S(x, rectP(0, ty, WB, 9), mix(K.mid, '#000000', 0.25), [0, ty, WB, 9], 460, 1);
      for (let px = 20; px < WB; px += 140) { stroke([[px, ty + 9], [px - 12, 482]], mix(K.mid, '#000000', 0.3), 5, 0.8); stroke([[px + 24, ty + 9], [px + 12, 482]], mix(K.mid, '#000000', 0.3), 3, 0.5); }
      for (let px = 6; px < WB; px += 36) S(x, rectP(px, ty - 5, 14, 6), mix(K.mid, '#9aa8b4', 0.15), [px, ty - 5, 14, 6], 470, 1);
    },
    near(K, R) {
      for (let k = 0; k < 8; k++) { const cx = 90 + k * 200 + (k % 3) * 26, L = 110 + (k * 61) % 190, w = 34 + (k * 17) % 44; S(x, polyP([[cx - w, -10], [cx + w, -10], [cx + w * 0.3, L * 0.7], [cx, L], [cx - w * 0.2, L * 0.6]]), K.near, [cx - w, -10, w * 2, L + 10], 480 + k, 2); if (k % 2 === 0) stroke([[cx + 2, L + 4], [cx + 2, L + 40]], '#bcd4e0', 1.6, 0.35); }
    }
  },
  r4: {
    far(K, R) {
      for (let i = 0; i < 4; i++) {
        const cx = i * 400 + 200, w = 130, h = 280;
        S(x, arch(cx, 450, w + 34, h + 18, 17), mix(K.far, '#000000', 0.1), [cx - w / 2 - 17, 450 - h, w + 34, h + 18], 500 + i, 0);
        S(x, (() => { const p = new Path2D(), r = w / 2 - 8, leg = h - w / 2; p.moveTo(cx - r, 450); p.lineTo(cx - r, 450 - leg); p.arc(cx, 450 - leg, r, Math.PI, 0); p.lineTo(cx + r, 450); p.closePath(); return p; })(), mix(K.far, '#c8dcc0', 0.1), [cx - w / 2, 450 - h, w, h], 520 + i, 0);
        for (let k = -1; k <= 1; k++) stroke([[cx + k * 28, 450], [cx + k * 28, 450 - h + 30]], mix(K.far, '#000000', 0.2), 3, 0.5);
        for (let k = 1; k < 5; k++) stroke([[cx - w / 2 + 8, 450 - k * 52], [cx + w / 2 - 8, 450 - k * 52]], mix(K.far, '#000000', 0.2), 3, 0.45);
      }
      for (let i = 0; i < 8; i++) stroke([[i * 200, 0], [i * 200 + 100, 70], [i * 200 + 200, 0]], mix(K.far, '#000000', 0.18), 4, 0.6);
    },
    mid(K, R) {
      for (let i = 0; i < 5; i++) { const cx = i * 320 + 40; S(x, rectP(cx - 20, 60, 40, 420), K.mid, [cx - 20, 60, 40, 420], 540 + i, 1); S(x, rectP(cx - 26, 200, 52, 12), '#756a38', [cx - 26, 200, 52, 12], 550 + i, 1); S(x, rectP(cx - 26, 420, 52, 12), '#756a38', [cx - 26, 420, 52, 12], 560 + i, 1); }
      for (let i = 0; i < 3; i++) { const bx = 130 + i * 500 + (i === 2 ? 120 : 0); S(x, rectP(bx, 380, 100, 100), K.mid, [bx, 380, 100, 100], 570 + i, 1); S(x, polyP([[bx - 10, 380], [bx + 110, 380], [bx + 100, 362], [bx, 362]]), mix(K.mid, '#756a38', 0.4), [bx - 10, 362, 120, 18], 580 + i, 1); S(x, rectP(bx + 14, 396, 72, 34), mix(K.mid, '#e8c070', 0.18), [bx + 14, 396, 72, 34], 590 + i, 1); lampGlow(bx + 50, 413, 50, K.glow, 0.16); }
      const cx = 800, cy = 168; S(x, circP(cx, cy, 58), mix(K.mid, '#a8996a', 0.28), [cx - 58, cy - 58, 116, 116], 600, 1); S(x, circP(cx, cy, 46), mix(K.mid, '#d8cc9c', 0.22), [cx - 46, cy - 46, 92, 92], 601, 1);
      for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832; stroke([[cx + Math.cos(a) * 38, cy + Math.sin(a) * 38], [cx + Math.cos(a) * 43, cy + Math.sin(a) * 43]], '#1a2a22', 2, 0.7); }
      stroke([[cx, cy], [cx + 8, cy - 32]], '#1a2a22', 3, 0.8); stroke([[cx, cy], [cx + 24, cy + 14]], '#1a2a22', 3, 0.8);
    },
    near(K, R) {
      for (let i = 0; i < 9; i++) { const px = i * 178; stroke([[px, 0], [px + 89, 84], [px + 178, 0]], K.near, 9, 0.95); stroke([[px + 89, 84], [px + 89, 0]], K.near, 5, 0.8); }
      stroke([[0, 4], [WB, 4]], K.near, 14, 1);
      for (let k = 0; k < 4; k++) { const cx = 180 + k * 400, L = 70 + (k * 29) % 70; stroke([[cx, 4], [cx, 4 + L]], K.near, 2.2, 0.95); S(x, polyP([[cx - 26, 4 + L + 14], [cx, 4 + L], [cx + 26, 4 + L + 14], [cx + 18, 4 + L + 20], [cx - 18, 4 + L + 20]]), mix(K.near, '#e8c070', 0.18), [cx - 26, 4 + L, 52, 20], 620 + k, 2); lampGlow(cx, 4 + L + 20, 56, K.glow, 0.3); }
    }
  },
  final: {
    far(K, R) {
      for (let i = 0; i < 5; i++) {
        const cx = i * 320 + 90, h = 250 + ((i * 83) % 150), w = 38 + (i % 2) * 14;
        S(x, polyP([[cx - w, 500], [cx - w * 0.7, 500 - h], [cx + w * 0.7, 500 - h], [cx + w, 500]]), K.far, [cx - w, 500 - h, w * 2, h], 640 + i, 0); S(x, rectP(cx - w * 0.85, 500 - h - 8, w * 1.7, 10), mix(K.far, '#ffffff', 0.1), [cx - w, 500 - h - 8, w * 2, 10], 650 + i, 0);
        for (let k = 0; k < 4; k++) { x.save(); x.globalAlpha = 0.2 - k * 0.03; x.drawImage(W.blob('#aab4dc'), cx - 40 + k * 26, 500 - h - 70 - k * 40, 110 + k * 24, 110 + k * 24); x.restore(); }
      }
      for (let i = 0; i < 3; i++) { const cx = 200 + i * 520 + 90; S(x, (() => { const p = new Path2D(); p.arc(cx, 500, 120, Math.PI, 0); p.closePath(); return p; })(), mix(K.far, K.sky[1], 0.25), [cx - 120, 380, 240, 120], 660 + i, 0); }
    },
    mid(K, R) {
      for (const [y, th] of [[210, 22], [310, 18], [400, 26]]) { S(x, rectP(0, y, WB, th), K.mid, [0, y, WB, th], 680 + y, 1); stroke([[0, y + 5], [WB, y + 5]], mix(K.mid, '#ffffff', 0.12), 2, 0.5); for (let px = 40 + (y % 100); px < WB; px += 200) S(x, rectP(px, y - 4, 12, th + 8), mix(K.mid, '#b8aa66', 0.16), [px, y - 4, 12, th + 8], 690 + px, 1); }
      for (let i = 0; i < 7; i++) { const px = i * 229 + 60; S(x, rectP(px - 6, 210, 12, 270), K.mid, [px - 6, 210, 12, 270], 700 + i, 1); if (i % 2) { S(x, circP(px, 250, 16), mix(K.mid, '#d8dcf0', 0.3), [px - 16, 234, 32, 32], 710 + i, 1); stroke([[px, 250], [px + 8, 240]], '#14183a', 2, 0.8); } }
      for (let i = 0; i < 4; i++) { const px = 200 + i * 400; stroke([[px, 210], [px + 120, 400]], K.mid, 4, 0.6); stroke([[px + 120, 210], [px, 400]], K.mid, 4, 0.6); }
      for (let i = 0; i < 3; i++) { const bx = 330 + i * 520; S(x, rectP(bx, 430, 30, 50), mix(K.mid, '#000000', 0.15), [bx, 430, 30, 50], 720 + i, 1); S(x, rectP(bx - 8, 420, 46, 14), mix(K.mid, '#b8aa66', 0.22), [bx - 8, 420, 46, 14], 730 + i, 1); }
    },
    near(K, R) {
      S(x, rectP(0, 0, WB, 52), K.near, [0, 0, WB, 52], 740, 2); for (let px = 70; px < WB; px += 230) { S(x, rectP(px - 8, -2, 16, 62), mix(K.near, '#8b98c4', 0.2), [px - 8, -2, 16, 62], 741 + px, 2); }
      for (let k = 0; k < 4; k++) { const cx = 150 + k * 400, L = 70 + (k * 41) % 80; S(x, rectP(cx - 6, 50, 12, L), K.near, [cx - 6, 50, 12, L], 760 + k, 2); S(x, circP(cx, 50 + L + 14, 15), mix(K.near, '#c9b878', 0.2), [cx - 15, 50 + L, 30, 30], 770 + k, 2); stroke([[cx - 15, 50 + L + 14], [cx + 15, 50 + L + 14]], K.near, 2.6, 0.9); stroke([[cx, 50 + L - 1], [cx, 50 + L + 29]], K.near, 2.6, 0.9); }
      for (let k = 0; k < 6; k++) { x.save(); x.globalAlpha = 0.16; x.drawImage(W.blob('#aab4dc'), 80 + k * 270, 40 + (k % 2) * 30, 90, 150); x.restore(); }
    }
  }
};

/* ---------- build, cache and draw ---------- */
function build(region, layer) {
  const K = BG[region] || BG.hub, pad = PAD[layer], cv = mk(WB, C.H + pad), c = cv.getContext('2d'), gen = (GEN[region] || GEN.hub)[layer];
  x = c;
  if (layer === 'far') {
    const g = c.createLinearGradient(0, 0, 0, C.H + pad); g.addColorStop(0, K.sky[0]); g.addColorStop(1, K.sky[1]); c.fillStyle = g; c.fillRect(0, 0, WB, C.H + pad);
    const R = mulberry(W.strHash(region) | 0);
    for (let i = 0; i < 16; i++) { const bx = R() * WB, by = R() * (C.H + pad), r = 90 + R() * 160, col = R() < 0.5 ? mix(K.sky[0], '#ffffff', 0.08) : mix(K.sky[1], '#000000', 0.12); for (const ox of [-WB, 0, WB]) { c.globalAlpha = 0.3; c.drawImage(W.blob(col), bx + ox - r, by - r, r * 2, r * 2); } }
    c.globalAlpha = 1;
  }
  for (const ox of [-WB, 0, WB]) { c.save(); c.translate(ox, 0); gen(K, mulberry(5)); c.restore(); }
  c.save(); c.globalCompositeOperation = layer === 'far' ? 'source-over' : 'source-atop'; c.globalAlpha = layer === 'far' ? 0.55 : 0.5; c.fillStyle = c.createPattern(W.grain(), 'repeat'); c.fillRect(0, 0, WB, C.H + pad); c.restore();
  // which rows of each 100 px stripe hold any paint: mid and near are sparse, and drawing only what is there saves most of their fill cost
  if (layer !== 'far') {
    const d = c.getImageData(0, 0, WB, C.H + pad).data, ext = [];
    for (let sx = 0; sx < WB; sx += STRIPE) {
      let y0 = -1, y1 = -1;
      for (let y = 0; y < C.H + pad; y++) { let hit = false; for (let x = sx; x < sx + STRIPE; x += 3) if (d[(y * WB + x) * 4 + 3] > 6) { hit = true; break; } if (hit) { if (y0 < 0) y0 = y; y1 = y; } }
      ext.push(y0 < 0 ? null : [Math.max(0, y0 - 1), Math.min(C.H + pad, y1 + 2)]);
    }
    cv.ext = ext;
  }
  return cv;
}
const get = (region, layer) => {
  const key = region + ':' + layer; let cv = layers.get(key);
  if (!cv) { cv = build(region, layer); layers.set(key, cv); while (layers.size > 9) layers.delete(layers.keys().next().value); }
  return cv;
};
W.bgFlush = () => layers.clear();
W.bgLayer = get;
const motes = Array.from({ length: 20 }, (_, i) => ({ x: W.h2(i, 1, 3) * 1000, y: W.h2(i, 2, 3) * 440 + 30, v: 5 + (i % 5) * 3, f: 0.6 + (i % 4) * 0.12 }));
// The whole backdrop: far (with the sky), mid, near and a few drifting motes. camY gives the layers a little vertical parallax in tall rooms.
W.backdrop = (ctx, region, camX, camY, time) => {
  const K = BG[region] || BG.hub, room = G.rooms && G.rooms.current, maxY = Math.max(1, (room ? room.rows * C.T : C.H) - C.H), t = Math.max(0, Math.min(1, (camY || 0) / maxY));
  for (const layer of LAYERS) {
    const sheet = W.cell && W.images[W.bgName(region, layer)], hk = G.worldHooks && G.worldHooks.hooks[W.bgName(region, layer)], f = hk ? hk.parallax : FACT[layer];
    if (sheet) { const h = C.H, w = (sheet.naturalWidth || sheet.width) * h / (sheet.naturalHeight || sheet.height); let ox = -(((camX * f) % w) + w) % w; for (let px = ox; px < C.W; px += w) ctx.drawImage(sheet, px, 0, w, h); continue; }
    const cv = get(region, layer), ox = -Math.round((((camX * f) % WB) + WB) % WB), oy = -Math.round(PAD[layer] * t);       // whole pixels: a fractional offset makes every blit a filtered resample
    if (!cv.ext) { ctx.drawImage(cv, ox, oy); if (ox + WB < C.W) ctx.drawImage(cv, ox + WB, oy); continue; }
    for (let i = 0; i < cv.ext.length; i++) {
      const e = cv.ext[i]; if (!e) continue;
      for (let dx = ox + i * STRIPE; dx < C.W; dx += WB) if (dx > -STRIPE) ctx.drawImage(cv, i * STRIPE, e[0], STRIPE, e[1] - e[0], dx, oy + e[0], STRIPE, e[1] - e[0]);
    }
  }
  ctx.fillStyle = K.mote;
  for (const m of motes) {
    const mx = (((m.x + time * m.v) - camX * 0.7) % (C.W + 40) + C.W + 40) % (C.W + 40) - 20, my = (m.y + Math.sin(time * 0.6 * m.f + m.x) * 16);
    ctx.globalAlpha = 0.16 + 0.12 * Math.sin(time * 1.3 + m.x); ctx.fillRect(mx, my, 2, 2);
  }
  ctx.globalAlpha = 1;
};
})();
