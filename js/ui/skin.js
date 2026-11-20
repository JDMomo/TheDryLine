/* INTERFACE SKIN: parchment and ink. Loaded after every screen file (hud, menus, map, ledger) and wraps their drawing functions once, so
   all of them (including the other teams' screens) get the same look without being rewritten:
     - while a screen draws (G.ui.mode > 0) every big dark plate it fills becomes a sheet of painted parchment (cached, wobbly ink border,
       paper grain, burnt edges), selection bars and borders turn ink-brown, and art.label maps its light text colours to ink colours;
     - token cut colours and shapes are untouched (they are the most vivid thing on any plate: see G.ui.PALETTE, checked by world_art);
     - the title lettering is brush script drawn in code (G.ui.title), or the owner's ui_title_f1.png when it exists.
   With G.artTest off (F2) nothing is wrapped in effect and the old dark screens show. Text colours are chosen for 4.5:1 or better on the parchment. */
(() => {
'use strict';
const G = window.G, C = G.C, art = G.art, W = C.W, H = C.H;
const ui = G.ui = { mode: 0 };
const WW = () => G.world;
ui.on = () => G.artTest !== false && !!G.world;
// Ink colours for text (on parchment) and parchment tones. Every non-cut colour here has a chroma below the least vivid cut colour (ground, 83).
ui.INK = { main: '#241b0f', dim: '#4b3d29', accent: '#5e3a28', green: '#2b4a34', red: '#6e2a1c', blue: '#2c4258' };
ui.PAPER = { page: '#ddd0ac', panel: '#d6c7a0', hud: '#cfc09a', slot: '#e0d4b0', tip: '#dacca6', bar: '#cbbb92', board: '#dccfa8', ribbon: '#d8c99f' };
ui.PALETTE = Object.values(ui.INK).concat(Object.values(ui.PAPER), ['#7a5c3c', '#8a7a58', '#b8a070']);
const lumOf = c => G.world.lum(c);
// Light UI text colours (as the screens ask for them) to their ink twins.
const TEXT = { '#e9e2cf': 'main', '#9aa89f': 'dim', '#e9a23b': 'accent', '#fff3c4': 'main', '#4d5a54': 'dim', '#5c6a63': 'dim', '#9fd3c7': 'green', '#c9d6cf': 'dim', '#ff9f8a': 'red', '#9fd6a8': 'green', '#e9663f': 'red', '#d9603a': 'red', '#8f8a78': 'dim', '#6d6a5c': 'dim', '#aab2a8': 'dim', '#e9a23b ': 'accent' };
ui.text = col => {
  if (!ui.mode || !ui.on() || typeof col !== 'string' || col[0] !== '#' || col.length !== 7) return col;
  const k = TEXT[col.toLowerCase()];
  if (k) return ui.INK[k];
  return lumOf(col) > 0.1 ? ui.INK.main : col;      // any other light colour (a cut colour used as text) becomes plain ink; the shape beside it keeps the cut colour
};
const STROKE = { '#3f6b5a': '#6a5636', '#2a3a35': '#8a7a58', '#5c6a63': '#8a7a58', '#e9a23b': '#5e3a28', '#fff3c4': '#241b0f', '#9aa89f': '#7a6a4c', '#3f6b5a ': '#6a5636' };
const FILL = { '#fff3c4': '#a8864a', '#8f8a78': '#9a8a66', '#e9a23b': '#8a5a34', '#d9603a': '#8a4a2c', '#9aa89f': '#8a7a58' };

/* ---------- parchment ---------- */
const cache = new Map();
function make(kind, w, h, s) {
  const M = 6, cv = G.world.mk((w + 2 * M) * s, (h + 2 * M) * s), x = cv.getContext('2d'), Wd = G.world, base = ui.PAPER[kind] || ui.PAPER.panel, R = Wd.mulberry(Wd.strHash(kind + w + 'x' + h));
  x.scale(s, s); x.translate(M, M);
  const edge = (x0, y0, x1, y1) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 10)), pts = []; for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + (R() - 0.5) * 1.6, y0 + (y1 - y0) * t + (R() - 0.5) * 1.6]); } return pts; };
  const pts = [].concat(edge(0, 0, w, 0), edge(w, 0, w, h), edge(w, h, 0, h), edge(0, h, 0, 0));
  const path = new Path2D(); path.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); path.closePath();
  x.save(); x.fillStyle = base; x.fill(path); x.clip(path);
  const tones = [Wd.mix(base, '#ffffff', 0.25), Wd.mix(base, '#8a6a3a', 0.25), Wd.mix(base, '#c8b078', 0.35)], n = Math.max(4, Math.round(w * h / 5000));
  for (let i = 0; i < n; i++) { const r = 20 + R() * 50; x.globalAlpha = 0.25 + R() * 0.2; x.drawImage(Wd.blob(tones[i % 3]), R() * w - r, R() * h - r, r * 2, r * 2); }
  x.globalAlpha = 0.32; x.strokeStyle = Wd.mix(base, '#6a4a28', 0.6); x.lineWidth = 14; x.lineJoin = 'round'; x.stroke(path);       // the burnt, pooled edge
  x.globalAlpha = 0.18; x.strokeStyle = Wd.mix(base, '#6a4a28', 0.6); x.lineWidth = 30; x.stroke(path);
  x.restore();
  Wd.applyGrain(x, 0.7);
  x.save(); x.lineJoin = 'round'; x.strokeStyle = '#2a2014'; x.globalAlpha = 0.9; x.lineWidth = 2; x.stroke(path);
  if (w > 40 && h > 26) { const q = Wd.rect(4, 4, w - 8, h - 8, R() * 999, 0.7); x.globalAlpha = 0.45; x.lineWidth = 0.9; x.stroke(q); }
  x.restore();
  cv.s = s; cv.M = M; return cv;
}
// Draw a sheet of parchment of the given kind over the rectangle.
ui.paper = (ctx, x, y, w, h, kind = 'panel') => {
  if (!ui.on()) { ctx.fillStyle = 'rgba(6,11,11,0.86)'; ctx.fillRect(x, y, w, h); return; }
  const t = ctx.getTransform && ctx.getTransform(), s = t ? Math.max(1, Math.min(2, Math.ceil(Math.max(Math.abs(t.a), Math.abs(t.b)) - 0.01))) : 1;
  const rw = Math.round(w), rh = Math.round(h), key = kind + ':' + rw + 'x' + rh + '@' + s; let cv = cache.get(key);
  if (!cv) { cv = make(kind, rw, rh, s); cache.set(key, cv); if (cache.size > 90) cache.delete(cache.keys().next().value); }
  ctx.drawImage(cv, x - cv.M, y - cv.M, rw + 2 * cv.M, rh + 2 * cv.M);
};

/* ---------- the skin layer: wrap the screens' drawing ---------- */
const own = ['fillRect', 'strokeRect', 'clearRect'];
function patch(ctx) {
  const fr = CanvasRenderingContext2D.prototype.fillRect, sr = CanvasRenderingContext2D.prototype.strokeRect;
  ctx.fillRect = function (x, y, w, h) {
    const st = this.fillStyle;
    if (typeof st === 'string') {
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(st), hx = /^#[0-9a-f]{6}$/i.test(st);
      let r, g, b, a = 1;
      if (m) { r = +m[1]; g = +m[2]; b = +m[3]; a = m[4] === undefined ? 1 : +m[4]; } else if (hx) { const n = parseInt(st.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
      if (r !== undefined) {
        const dark = r + g + b <= 140, area = w * h;
        if (dark && area >= 36000 && w >= W - 2 && h >= H - 2) { if (a >= 0.95) { ui.paper(this, x, y, w, h, 'page'); return; } this.save(); this.fillStyle = 'rgba(214,200,160,' + Math.min(0.95, 0.65 + a * 0.5) + ')'; fr.call(this, x, y, w, h); this.restore(); return; }   // full-screen: a page, or a wash of paper over the world (so ink reads anywhere on it)
        if (dark && area >= 1500 && a >= 0.55) { ui.paper(this, x, y, w, h, area > 90000 ? 'panel' : h > 60 && w < 200 ? 'hud' : 'panel'); return; }
        if (dark && a < 0.55 && area < 20000) { this.save(); this.fillStyle = 'rgba(130,100,56,' + Math.max(0.16, a * 0.55) + ')'; fr.call(this, x, y, w, h); this.restore(); return; }
        if (dark && a >= 0.55 && area < 1500 && area >= 400) { ui.paper(this, x, y, w, h, 'slot'); return; }
        if (FILL[st.toLowerCase()]) { this.save(); this.fillStyle = FILL[st.toLowerCase()]; fr.call(this, x, y, w, h); this.restore(); return; }
        if (r === 233 && g === 162 && b === 59) { this.save(); this.fillStyle = 'rgba(94,58,40,' + (a * 0.9) + ')'; fr.call(this, x, y, w, h); this.restore(); return; }
      }
    }
    fr.call(this, x, y, w, h);
  };
  const ft = CanvasRenderingContext2D.prototype.fillText;
  ctx.fillText = function (t, x, y, mw) {                    // text drawn straight with fillText (the map's lines): same ink mapping as art.label
    const st = this.fillStyle, m = ui.text(st);
    if (m !== st) { this.save(); this.fillStyle = m; ft.call(this, t, x, y, mw); this.restore(); } else ft.call(this, t, x, y, mw);
  };
  ctx.strokeRect = function (x, y, w, h) {
    const st = this.strokeStyle;
    if (typeof st === 'string' && STROKE[st.toLowerCase()]) { this.save(); this.strokeStyle = STROKE[st.toLowerCase()]; sr.call(this, x, y, w, h); this.restore(); return; }
    sr.call(this, x, y, w, h);
  };
}
function unpatch(ctx) { delete ctx.fillRect; delete ctx.strokeRect; delete ctx.fillText; }
const enter = ctx => { if (!ui.on()) return false; if (!ui.mode++) patch(ctx); return true; };
const leave = (ctx, on) => { if (on && !--ui.mode) unpatch(ctx); };
ui.wrap = (obj, name) => { const f = obj[name]; if (typeof f !== 'function' || f.skinned) return; const w = function (ctx, ...a) { const on = enter(ctx); try { return f.call(this, ctx, ...a); } finally { leave(ctx, on); } }; w.skinned = true; w.raw = f; obj[name] = w; };
const wrapAll = () => {
ui.wrap(G.hud, 'draw'); ui.wrap(G.map, 'draw'); ui.wrap(G.menus, 'title'); ui.wrap(G.menus, 'pause'); ui.wrap(G.menus, 'over');
if (G.tips) ui.wrap(G.tips, 'draw');
if (G.props && G.props.drawPrompt) ui.wrap(G.props, 'drawPrompt');
if (G.props && G.props.TYPES.timetable && !G.props.TYPES.timetable.draw.skinned) { const f = G.props.TYPES.timetable.draw, w = function (pr, ctx) { const on = enter(ctx); try { return f.call(this, pr, ctx); } finally { leave(ctx, on); } }; w.skinned = true; G.props.TYPES.timetable.draw = w; }
if (G.ledgerUI) for (const k of ['draw', 'drawLedger']) ui.wrap(G.ledgerUI, k);
};
ui.wrapAll = wrapAll;
// after every script has loaded, so that screens added by later files (audio options on the Comfort page, ...) are wrapped from outside
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapAll); else wrapAll();

/* ---------- brush script title ---------- */
// Glyphs on a 100-unit em: baseline y 60, x-height 30, ascender 0, descender 90. Each stroke is a list of points of a smooth curve.
const GL = {
  T: { a: 58, s: [[[2, 8], [20, 2], [40, 3], [58, 8]], [[30, 4], [28, 30], [31, 62], [38, 62]]] },
  h: { a: 36, s: [[[8, -2], [6, 30], [5, 62]], [[5, 44], [13, 33], [24, 34], [27, 46], [26, 62], [34, 56]]] },
  e: { a: 32, s: [[[6, 46], [26, 46], [24, 34], [12, 31], [3, 44], [8, 60], [20, 62], [30, 54]]] },
  D: { a: 56, s: [[[12, 2], [8, 30], [7, 62]], [[3, 8], [30, 2], [48, 18], [46, 44], [28, 62], [2, 60]], [[-4, 6], [8, 4]]] },
  r: { a: 28, s: [[[6, 34], [6, 62]], [[6, 46], [12, 35], [22, 31], [28, 35]]] },
  y: { a: 34, s: [[[4, 33], [10, 56], [22, 60]], [[30, 33], [26, 62], [20, 82], [8, 92], [0, 84]]] },
  L: { a: 46, s: [[[16, 0], [10, 28], [8, 60]], [[8, 62], [26, 66], [44, 56]], [[6, 2], [20, -2]]] },
  i: { a: 16, s: [[[6, 34], [5, 62], [12, 58]], [[6, 18], [7, 21]]] },
  n: { a: 34, s: [[[6, 34], [5, 62]], [[5, 46], [14, 34], [25, 35], [28, 48], [27, 62], [35, 56]]] }
};
const WORD = 'The Dry Line';
function spline(pts, n = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  out.push(pts[pts.length - 1]); return out;
}
let titleCv = null;
function paintTitle(col) {
  const s = 3, slant = 0.2, adv = [];
  let tw = 0; for (const ch of WORD) tw += ch === ' ' ? 22 : GL[ch].a;
  const cv = G.world.mk((tw + 50) * s, 140 * s), x = cv.getContext('2d'); x.scale(s, s); x.translate(16, 28);
  const R = G.world.mulberry(41); let ox = 0;
  for (const ch of WORD) {
    if (ch === ' ') { ox += 22; continue; }
    const g = GL[ch];
    for (const st of g.s) {
      const pts = spline(st.map(p => [ox + p[0] - p[1] * slant, p[1]]), 12);
      for (let i = 0; i < pts.length - 1; i++) {                       // a broad nib held at 40 degrees: thick on the downstroke, hairline on the up
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], ang = Math.atan2(dy, dx), w = 1.6 + 5.2 * Math.abs(Math.sin(ang - 0.7)), steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.6));
        for (let k = 0; k < steps; k++) { const t = k / steps; x.save(); x.translate(a[0] + dx * t, a[1] + dy * t); x.rotate(-0.7); x.globalAlpha = 0.85 + R() * 0.15; x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, w / 2, 1.1 + w * 0.14, 0, 0, 6.3); x.fill(); x.restore(); }
      }
    }
    ox += g.a;
  }
  // dry-brush texture: knock paper-coloured flecks out of the strokes, then add a few ink spatters
  x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 260; i++) { x.globalAlpha = 0.25 + R() * 0.4; x.fillRect(R() * (tw + 40), R() * 130 - 20, 0.8 + R() * 2.2, 0.5); }
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 0.7; x.fillStyle = col; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(R() * (tw + 30), R() * 110 - 10, 0.5 + R() * 1.2, 0, 6.3); x.fill(); }
  cv.tw = tw + 50; return cv;
}
// The title lettering centred on cx, cy, about `width` px wide. Uses ui_title_f1.png when the owner has painted it.
ui.title = (ctx, cx, cy, width = 520) => {
  const im = G.world && G.world.images && G.world.images['ui_title_f1'];
  if (im && ui.on()) { const w = width, h = w * (im.naturalHeight || im.height) / (im.naturalWidth || im.width); ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); return; }
  if (!titleCv) titleCv = paintTitle('#1f3a2c');
  const k = width / titleCv.tw * 3 / 3, w = titleCv.width / 3 * k, h = titleCv.height / 3 * k;
  ctx.drawImage(titleCv, cx - w / 2, cy - h / 2, w, h);
};
})();
