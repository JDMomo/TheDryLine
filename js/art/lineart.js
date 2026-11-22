/* Live procedural line art.

Every sprite frame that goes through G.art.drawFrame can be drawn as thousands of short generated strokes instead of the painted image.
The painted frame is read once (at its first draw) to learn the figure's shape, tone, colour and the direction of its forms; strokes are
then placed by a seeded generator and drawn live every frame, each one moving on its own (a slow sway and drift with its own phase), so
the line work is always alive.

  G.lineart.on       true to draw sprites as line art (F3 toggles; the pause menu can bind it later)
  G.lineart.motion   0 = still lines, 1 = default sway, higher = livelier
  G.lineart.blocked  true when the browser forbids reading image pixels (pages opened from file:// with images drawn): painted art is used

Cost: a frame's strokes are built once (a few ms) and cached; drawing batches strokes by colour into a handful of paths.
*/
(() => {
const G = window.G;
const TAU = Math.PI * 2;
const cache = new Map();            // key "strip:frame" -> built stroke set, or null when it could not be built

const L = G.lineart = {
  on: true,
  motion: 1,
  blocked: false,
  density: 1,
  stats: { built: 0, strokes: 0, buildMs: 0 },
  mode: 'ascii',                     // 'ascii' (dense characters) or 'lines' (fine strokes)
  asciiDensity: 0.6,
  asciiFps: 24,
  asciiCloth: 1.6,                   // source pixels of cloak and scarf ripple
  asciiBacking: 0.35,                // opacity of the dark painted backing under the characters (0 = none)                      // how many times a second the characters shift                   // characters per source pixel of a player frame (1 = one per pixel)
  clear() { cache.clear(); }
};
const GLYPHS = ' .,:;-=+*%#@';      // light to dark
const DIRS = ['-', '\\', '|', '/'];  // stroke direction glyphs (0, 45, 90, 135 degrees)

/* Seeded random numbers (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* Separable box blur on a Float32Array image (w x h), radius r, in place via a temp buffer. */
function blur(src, w, h, r) {
  const tmp = new Float32Array(src.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0; const row = y * w;
    for (let x = -r; x <= r; x++) s += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[row + x] = s / n; s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { src[y * w + x] = s / n; s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return src;
}

/* Build the stroke set of one frame. Returns null if the pixels cannot be read. */
function build(id, st, f) {
  const t0 = performance.now();
  const w = Math.round(st.fw), h = Math.round(st.fh);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(st.img, f * st.fw, 0, st.fw, st.fh, 0, 0, w, h);
  let px;
  try { px = c.getImageData(0, 0, w, h).data; } catch (e) { L.blocked = true; return null; }

  const N = w * h, lum = new Float32Array(N), alpha = new Uint8Array(N);
  const R = new Uint8Array(N), Gc = new Uint8Array(N), B = new Uint8Array(N);
  let opaque = 0;
  for (let i = 0; i < N; i++) {
    const a = px[i * 4 + 3]; alpha[i] = a > 128 ? 1 : 0;
    R[i] = px[i * 4]; Gc[i] = px[i * 4 + 1]; B[i] = px[i * 4 + 2];
    lum[i] = alpha[i] ? (0.2126 * R[i] + 0.7152 * Gc[i] + 0.0722 * B[i]) / 255 : 1;
    opaque += alpha[i];
  }
  if (opaque < 20) return { strokes: new Float32Array(0), buckets: [], n: 0 };

  /* Tone: rank of darkness within the figure, so every sprite uses the whole light-to-dark range. */
  const vals = []; for (let i = 0; i < N; i++) if (alpha[i]) vals.push(lum[i]);
  vals.sort((a, b) => a - b);
  const rank = v => { let lo = 0, hi = vals.length; while (lo < hi) { const m = (lo + hi) >> 1; if (vals[m] < v) lo = m + 1; else hi = m; } return lo / vals.length; };

  /* Direction of forms: structure tensor of the smoothed luminance; strokes run along edges (gradient + 90 degrees). */
  const sm = blur(Float32Array.from(lum), w, h, 1);
  const jxx = new Float32Array(N), jyy = new Float32Array(N), jxy = new Float32Array(N), gm = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = (sm[i - w + 1] + 2 * sm[i + 1] + sm[i + w + 1]) - (sm[i - w - 1] + 2 * sm[i - 1] + sm[i + w - 1]);
    const gy = (sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1]) - (sm[i - w - 1] + 2 * sm[i - w] + sm[i - w + 1]);
    jxx[i] = gx * gx; jyy[i] = gy * gy; jxy[i] = gx * gy; gm[i] = Math.hypot(gx, gy);
  }
  const rad = Math.max(2, Math.round(Math.min(w, h) / 40));
  blur(jxx, w, h, rad); blur(jyy, w, h, rad); blur(jxy, w, h, rad);
  const HATCH = -0.85;                                   /* engraver's angle where the painting has no clear direction */
  const ang = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = jxx[i] - jyy[i], b = 2 * jxy[i], tr = jxx[i] + jyy[i] + 1e-6;
    const coh = Math.min(1, Math.max(0, (Math.sqrt(a * a + b * b) / tr - 0.15) / 0.35));
    const th = 0.5 * Math.atan2(b, a) + Math.PI / 2;
    ang[i] = 0.5 * Math.atan2(coh * Math.sin(2 * th) + (1 - coh) * Math.sin(2 * HATCH), coh * Math.cos(2 * th) + (1 - coh) * Math.cos(2 * HATCH));
  }
  const gvals = []; for (let i = 0; i < N; i++) if (alpha[i]) gvals.push(gm[i]);
  gvals.sort((a, b) => a - b);
  const edgeCut = gvals[Math.floor(gvals.length * 0.88)] || 1;

  /* Strokes: [x, y, angle, halfLength, width, bucket, phase, speed] per stroke. */
  const rand = rng(hashStr(id + ':' + f));
  const out = [], bucketKey = new Map(), buckets = [];
  const bucketOf = (r, g, b) => {
    const k = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5);
    let i = bucketKey.get(k);
    if (i === undefined) { i = buckets.length; bucketKey.set(k, i); buckets.push('rgb(' + ((r >> 5) * 32 + 16) + ',' + ((g >> 5) * 32 + 16) + ',' + ((b >> 5) * 32 + 16) + ')'); }
    return i;
  };
  const INK = [20, 24, 28];
  const colour = (i, dark) => {
    let r = R[i], g = Gc[i], b = B[i];
    const m = (r + g + b) / 3;                              /* keep each area's own colour, a little richer, a step darker than the paint */
    r = Math.max(0, Math.min(255, m + (r - m) * 1.35)) * 0.68; g = Math.max(0, Math.min(255, m + (g - m) * 1.35)) * 0.68; b = Math.max(0, Math.min(255, m + (b - m) * 1.35)) * 0.68;
    if (dark) { r = r * 0.45 + INK[0] * 0.55; g = g * 0.45 + INK[1] * 0.55; b = b * 0.45 + INK[2] * 0.55; }
    const j = (rand() - 0.5) * 20;
    return bucketOf(Math.max(0, Math.min(255, r + j)) | 0, Math.max(0, Math.min(255, g + j)) | 0, Math.max(0, Math.min(255, b + j)) | 0);
  };
  const unit = Math.max(1, h / 68);                         /* stroke sizes scale with the frame (player frames are 2x game size) */
  const layers = [                                          /* [darkness threshold, attempts per opaque px, angle offset, length, width, dark] */
    [0.00, 1.10, 0.0, 1.6, 0.16, false],
    [0.30, 0.90, 0.0, 1.3, 0.16, false],
    [0.55, 0.80, 0.9, 1.1, 0.17, true],
    [0.75, 0.80, -0.8, 0.95, 0.18, true],
    [0.88, 0.60, 1.6, 0.8, 0.2, true]
  ];
  for (const [thr, dens, off, len, wid, dark] of layers) {
    const tries = Math.floor(opaque * dens * L.density * 1.5);
    for (let k = 0; k < tries; k++) {
      const x = Math.floor(rand() * w), y = Math.floor(rand() * h), i = y * w + x;
      if (!alpha[i]) continue;
      const dk = 1 - rank(lum[i]);
      if (dk < thr || rand() > Math.min(1, (dk - thr + 0.25) * 1.4)) continue;
      out.push(x + 0.5, y + 0.5, ang[i] + off + (rand() - 0.5) * 0.24, len * unit * (0.7 + rand() * 0.6), wid * unit * (0.8 + rand() * 0.4), colour(i, dark), rand() * TAU, 2 + rand() * 3);
    }
  }
  /* Interior form lines on the painting's strong edges. */
  for (let k = 0; k < opaque * 0.35; k++) {
    const x = Math.floor(rand() * w), y = Math.floor(rand() * h), i = y * w + x;
    if (!alpha[i] || gm[i] < edgeCut) continue;
    out.push(x + 0.5, y + 0.5, ang[i], 1.1 * unit, 0.22 * unit, colour(i, true), rand() * TAU, 2 + rand() * 2);
  }
  /* Silhouette contour: short ink strokes along the outline, heavier on the lower half. */
  const inkB = bucketOf(INK[0], INK[1], INK[2]);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!alpha[i] || (alpha[i - 1] && alpha[i + 1] && alpha[i - w] && alpha[i + w])) continue;
    if (rand() > 0.8) continue;
    out.push(x + 0.5, y + 0.5, ang[i], 1.2 * unit, (y > h * 0.5 ? 0.55 : 0.4) * unit, inkB, rand() * TAU, 1.5 + rand() * 2);
  }

  /* Sort by bucket so drawing is a handful of paths. */
  const n = out.length / 8, order = new Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => out[a * 8 + 5] - out[b * 8 + 5]);
  const strokes = new Float32Array(out.length);
  order.forEach((s, d) => { for (let q = 0; q < 8; q++) strokes[d * 8 + q] = out[s * 8 + q]; });
  const ms = performance.now() - t0;
  L.stats.built++; L.stats.strokes += n; L.stats.buildMs += ms;
  return { strokes, buckets, n };
}

/* Draw frame f of strip id as live line art, placed exactly like G.art.drawFrame. Returns false if it can't (caller draws the image). */
L.draw = function (id, st, f, ctx, opts, rawN) {
  if (!L.on || L.blocked) return false;
  const key = id + ':' + f;
  let set = cache.get(key);
  if (set === undefined) { set = build(id, st, f); cache.set(key, set); }
  if (!set) return false;
  const k = opts.h ? opts.h / st.fh : 1;
  if (L.mode === 'ascii') return drawAscii(id, st, f, set, ctx, opts, k, rawN);
  const t = (G.time || performance.now() / 1000), m = L.motion;
  const S = set.strokes, n = set.n;
  const shown = k * st.fh;
  const step = shown < 30 ? 2 : 1;                           /* fewer strokes only when the sprite is tiny */
  ctx.save();
  ctx.translate(opts.x || 0, opts.y || 0); if (opts.face < 0) ctx.scale(-1, 1);
  ctx.translate(-st.fw * k / 2, -st.fh * k + (opts.foot || 0) * k);
  ctx.scale(k, k);
  /* paper underneath: the figure is a toned-paper cut-out the strokes are drawn on */
  if (!set.paper) {
    const pc = document.createElement('canvas'); pc.width = Math.round(st.fw); pc.height = Math.round(st.fh);
    const q = pc.getContext('2d'); q.drawImage(st.img, f * st.fw, 0, st.fw, st.fh, 0, 0, pc.width, pc.height);
    q.globalCompositeOperation = 'source-in'; q.fillStyle = '#e6dcc3'; q.fillRect(0, 0, pc.width, pc.height); set.paper = pc;
  }
  ctx.drawImage(set.paper, 0, 0);
  ctx.lineCap = 'round';
  let cur = -1, wsum = 0, wcount = 0;
  const flush = () => { if (cur >= 0) { ctx.strokeStyle = set.buckets[cur]; ctx.lineWidth = Math.max(0.45 / k, wsum / Math.max(1, wcount));   /* never thinner than half a screen pixel */ ctx.stroke(); } };
  for (let s = 0; s < n; s += step) {
    const o = s * 8, b = S[o + 5];
    if (b !== cur) { flush(); ctx.beginPath(); cur = b; wsum = 0; wcount = 0; }
    const ph = S[o + 6], sp = S[o + 7];
    const sway = Math.sin(t * sp + ph) * 0.16 * m;              /* each stroke turns a little on its own beat */
    const a = S[o + 2] + sway, hl = S[o + 3] * (1 + Math.sin(t * sp * 0.7 + ph * 1.3) * 0.12 * m);
    const dx = Math.sin(t * sp * 0.5 + ph * 2.1) * 0.35 * m, dy = Math.cos(t * sp * 0.6 + ph * 1.7) * 0.35 * m;
    const x = S[o] + dx, y = S[o + 1] + dy, cx = Math.cos(a) * hl, cy = Math.sin(a) * hl;
    const bend = Math.sin(t * sp * 0.8 + ph) * 0.25 * m * hl;   /* a slight live curve through the middle */
    ctx.moveTo(x - cx, y - cy);
    ctx.lineTo(x - cy * bend / hl * 0.5, y + cx * bend / hl * 0.5);
    ctx.lineTo(x + cx, y + cy);
    wsum += S[o + 4]; wcount++;
  }
  flush();
  ctx.restore();
  return true;
};

/* ASCII mode: the figure as a grid of coloured characters. Tone picks the density glyph; strong form direction picks a slash. */
function asciiCells(id, st, f) {
  const key = id + ':' + f + ':ascii:' + L.asciiDensity;
  let g = cache.get(key);
  if (!g) {
    const w = Math.round(st.fw), h = Math.round(st.fh);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(st.img, f * st.fw, 0, st.fw, st.fh, 0, 0, w, h);
    const px = c.getImageData(0, 0, w, h).data;
    const cell = Math.max(1, h / (136 * L.asciiDensity));      /* 1 = one character per source pixel of a player frame */
    const cells = [], at = (x, y) => (Math.min(h - 1, Math.max(0, y | 0)) * w + Math.min(w - 1, Math.max(0, x | 0))) * 4;
    const lumAt = i => (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    let id2 = 0;
    for (let y = cell / 2; y < h; y += cell) for (let x = cell / 2; x < w; x += cell) {
      const i = at(x, y); if (px[i + 3] < 128) continue;
      const l = lumAt(i), gx = lumAt(at(x + cell, y)) - lumAt(at(x - cell, y)), gy = lumAt(at(x, y + cell)) - lumAt(at(x, y - cell));
      const edge = Math.hypot(gx, gy);
      let gi;
      if (edge > 0.22) { const a2 = (Math.atan2(gy, gx) + Math.PI / 2 + TAU) % Math.PI; gi = GLYPHS.length + (Math.round(a2 / (Math.PI / 4)) % 4); }
      else gi = Math.min(GLYPHS.length - 1, 1 + Math.floor((1 - l) * (GLYPHS.length - 1)));
      const m = (px[i] + px[i + 1] + px[i + 2]) / 3, sat = 1.6, v = 1.4;                 /* bright, saturated characters so they don't read faint */
      const q = ch => Math.max(0, Math.min(255, (m + (ch - m) * sat) * v)) >> 4;      /* 16 levels per channel, for the glyph atlas */
      cells.push(x, y, gi, (q(px[i]) << 8) | (q(px[i + 1]) << 4) | q(px[i + 2]), (id2++ * 2.399) % TAU);
    }
    g = { cells, cell, w, h }; cache.set(key, g);
  }
  return g;
}

const atlases = new Map();
function drawAscii(id, st, f, set, ctx, opts, k, rawN) {
  const g = asciiCells(id, st, f);
  /* In-betweening: between painted frame f and the next, each character hands over at its own moment (frac of the way through). */
  const loop = typeof rawN === 'number' && Math.abs(rawN - Math.round(rawN)) > 1e-6;
  const frac = loop ? rawN - Math.floor(rawN) : 0, f2 = (f + 1) % st.frames;
  const g2 = frac > 0.02 ? asciiCells(id, st, f2) : null;
  const t = G.time || performance.now() / 1000, m = L.motion, C = g.cells;
  const fs = Math.max(4, Math.ceil(g.cell * k * 1.75)), CH = GLYPHS + DIRS.join('');
  /* glyph atlas per colour, rendered at the on-screen font size so letters stay crisp */
  const atlasFor = col => {
    const ak = col + ':' + fs; let A = atlases.get(ak);
    if (!A) {
      A = document.createElement('canvas'); A.width = fs * CH.length; A.height = fs;
      const q = A.getContext('2d'); q.font = 'bold ' + fs + 'px monospace'; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillStyle = 'rgb(' + ((col >> 8) & 15) * 17 + ',' + ((col >> 4) & 15) * 17 + ',' + (col & 15) * 17 + ')';
      for (let j = 0; j < CH.length; j++) q.fillText(CH[j], j * fs + fs / 2, fs / 2);
      atlases.set(ak, A);
    }
    return A;
  };
  /* The characters step at L.asciiFps; between steps the finished figure is reused from a cached canvas (one per strip). */
  const tick = m > 0 ? Math.floor(t * L.asciiFps) : 0, fq = Math.round(frac * 12), W = Math.ceil(st.fw * k + fs * 2), H = Math.ceil(st.fh * k + fs * 2);
  const ik = id + ':img', stamp = f + ':' + fq + ':' + tick;
  let rec = cache.get(ik);
  if (!rec || rec.img.width !== W || rec.img.height !== H) { const img = document.createElement('canvas'); img.width = W; img.height = H; rec = { img, stamp: '' }; cache.set(ik, rec); }
  if (rec.stamp !== stamp) {
    rec.stamp = stamp;
    const q = rec.img.getContext('2d'); q.clearRect(0, 0, W, H);
    q.globalAlpha = L.asciiBacking * (1 - frac); q.filter = 'brightness(0.45) saturate(1.3)';
    q.drawImage(st.img, f * st.fw, 0, st.fw, st.fh, fs, fs, st.fw * k, st.fh * k);
    if (g2) { q.globalAlpha = L.asciiBacking * frac; q.drawImage(st.img, f2 * st.fw, 0, st.fw, st.fh, fs, fs, st.fw * k, st.fh * k); }
    q.globalAlpha = 1; q.filter = 'none';
    const tt = tick / L.asciiFps, amp = g.cell * k * 0.3 * m, hh = st.fh, ww = st.fw;
    const breathe = Math.sin(tt * 2.2) * 0.012 * m;          /* idle breathing: the figure rises and settles a little */
    const paint = (CC, keep) => {
      for (let i = 0; i < CC.length; i += 5) {
        const ph = CC[i + 4], th = (ph / TAU * 7.31) % 1;      /* this character's hand-over moment */
        if (keep ? th < frac : th >= frac) continue;
        let gi = CC[i + 2];
        if (m > 0 && gi < GLYPHS.length && gi > 1 && Math.sin(tt * 1.7 + ph * 3) > 0.94) gi--;
        const sx = CC[i], sy = CC[i + 1], up = (hh - sy) / hh;
        /* cloth ripple: travels down the figure, stronger low and at the trailing (left) side where the cloak and scarf hang */
        const cloth = Math.sin(tt * 4.2 - sy * 0.09) * L.asciiCloth * m * Math.pow(sy / hh, 1.5) * (1 - sx / ww) * 2.2;
        const x = fs + (sx + cloth) * k + Math.sin(tt * 3 + ph) * amp;
        const y = fs + (sy - up * hh * breathe) * k + Math.cos(tt * 2.3 + ph) * amp;
        q.drawImage(atlasFor(CC[i + 3]), gi * fs, 0, fs, fs, x - fs / 2, y - fs / 2, fs, fs);
      }
    };
    paint(C, true);
    if (g2) paint(g2.cells, false);
  }
  const img = rec.img;
  ctx.save(); ctx.translate(opts.x || 0, opts.y || 0); if (opts.face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, -st.fw * k / 2 - fs, -st.fh * k + (opts.foot || 0) * k - fs);
  ctx.restore(); return true;
}
/* F3 toggles line art and painted art; F4 switches between fine lines and ASCII. */
addEventListener('keydown', e => { if (e.code === 'F4') { L.mode = L.mode === 'ascii' ? 'lines' : 'ascii'; e.preventDefault(); } });
addEventListener('keydown', e => { if (e.code === 'F3') { L.on = !L.on; e.preventDefault(); } });
})();
