/* WORLD ART, props: plinth, lost trunk, ticket machine, kiosk stall, signal post, standpipe, doorway, region gate, lock chart board, sign,
   cracked barrier, scrip. Each is painted once into a small cached canvas (feet at the bottom centre) and drawn with one drawImage; only the
   animated parts (glow, drips, the sliding ticket, labels) are drawn live. Registered through G.art.define('prop_<type>'), which props.js already
   calls first; with G.artTest off, or when the owner's painted image is present (props_a/b/c sheets, js/art/world_hooks.js), the right thing is drawn. */
(() => {
'use strict';
const G = window.G, C = G.C, W = G.world, art = G.art, { mulberry, mix, rect, poly, ell, wc } = W;
const cache = new Map();
W.propFlush = () => cache.clear();
// A cached picture: fn paints with the feet centre at (ax, ay) of a w x h canvas, in game pixels.
function sprite(key, w, h, ax, ay, fn, s) {
  const k = key + '@' + s; let cv = cache.get(k);
  if (!cv) { cv = W.mk(w * s, h * s); const x = cv.getContext('2d'); x.scale(s, s); x.translate(ax, ay); fn(x); cache.set(k, cv); cv.ax = ax; cv.ay = ay; cv.w = w; cv.h = h; }
  return cv;
}
const scaleOf = ctx => { const t = ctx.getTransform && ctx.getTransform(); return t ? Math.max(1, Math.min(2, Math.ceil(Math.max(Math.abs(t.a), Math.abs(t.b)) - 0.01))) : 1; };
const INK = '#1d1810', WOOD = '#8a6a44', WOODD = '#5a4630', BRASS = '#d0b068', STONE = '#8d9484';
const P = {};
// def: { w, h, ax, ay, key(pr), paint(x, pr), dyn(ctx, pr), image: [sheet, slot] }
function reg(type, def) {
  P[type] = def;
  art.define('prop_' + type, (ctx, o) => {
    const pr = o.prop, T = G.props.TYPES[type];
    if (!W.on()) return T.draw(pr, ctx);
    const spec = typeof def.image === 'function' ? def.image(pr) : def.image, im = spec && W.cell(spec[0], spec[1]);
    if (im) { const h = im.slot.h || 64, w = h * im.sw / im.sh; ctx.drawImage(im.img, im.sx, im.sy, im.sw, im.sh, pr.x - w / 2, pr.y - h + 2, w, h); }
    else { const cv = sprite(type + ':' + (def.key ? def.key(pr) : ''), def.w, def.h, def.ax, def.ay, x => def.paint(x, pr), scaleOf(ctx)); ctx.drawImage(cv, pr.x - cv.ax, pr.y - cv.ay, cv.w, cv.h); }
    if (def.dyn) def.dyn(ctx, pr, !!im);
  });
}
const shade = (c, t) => mix(c, '#000000', t), tint = (c, t) => mix(c, '#ffffff', t);
const box = (x, X, Y, w, h, col, seed, o = {}) => wc(x, rect(X, Y, w, h, seed, o.jit || 0.5), col, Object.assign({ bb: [X, Y, w, h], wash: [tint(col, 0.25), shade(col, 0.25)], edge: shade(col, 0.5), ink: INK, lw: 1.6, blobs: 3, seed }, o));
const glowAt = (ctx, x, y, r, col, a) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(W.glow(col), x - r, y - r, r * 2, r * 2); ctx.restore(); };
const lbl = (ctx, t, x, y, size, col) => art.label(ctx, t, x, y, size, col || '#efe6cc', 'center', C.FONT, 600);

/* stone plinth; with a price it becomes a kiosk stall: timber posts, a striped awning, a shelf */
reg('plinth', {
  w: 80, h: 110, ax: 40, ay: 104,
  key: pr => pr.data.price ? 'kiosk' : 'plinth',
  paint(x, pr) {
    if (pr.data.price) {
      box(x, -22, -74, 4, 74, WOODD, 3, { lw: 1.2 }); box(x, 18, -74, 4, 74, WOODD, 4, { lw: 1.2 });
      box(x, -20, -14, 40, 14, '#6a5a44', 5); box(x, -24, -18, 48, 5, WOOD, 6);
      for (let i = 0; i < 5; i++) { const X = -24 + i * 9.6; wc(x, poly([[X, -78], [X + 9.6, -78], [X + 9.6, -66], [X + 4.8, -62], [X, -66]], 0.3, 10 + i), i % 2 ? '#d8cdb0' : '#7a8a6e', { bb: [X, -78, 9.6, 16], edge: '#3a3a2a', ink: INK, lw: 1.2, blobs: 1, seed: i }); }
    } else {
      box(x, -17, -14, 34, 14, '#7e8878', 7, { wash: ['#a8b2a0', '#566052'] }); box(x, -20, -18, 40, 5, '#9aa48c', 8, { wash: ['#c8d0b8', '#667058'] });
      x.strokeStyle = INK; x.globalAlpha = 0.35; x.lineWidth = 1; x.beginPath(); x.moveTo(-6, -13); x.lineTo(-7, -1); x.moveTo(8, -13); x.lineTo(9, -1); x.stroke(); x.globalAlpha = 1;
    }
  },
  image: pr => ['props_a_f6', pr.data.price ? 'kiosk' : 'plinth']
});
/* lost trunk */
reg('trunk', {
  w: 56, h: 50, ax: 28, ay: 44,
  paint(x) {
    box(x, -17, -22, 34, 22, '#7a5a3a', 21, { wash: ['#a07a4c', '#4a3220'] });
    wc(x, poly([[-18, -22], [-14, -33], [14, -33], [18, -22]], 0.5, 22, true), '#946c42', { bb: [-18, -33, 36, 11], wash: ['#c09460', '#5a3c22'], edge: '#3a2412', ink: INK, lw: 1.6, blobs: 3, seed: 5 });
    x.fillStyle = '#b8a070'; for (const dx of [-12, 8]) { x.fillRect(dx, -33, 4, 33); x.strokeStyle = INK; x.lineWidth = 1; x.strokeRect(dx, -33, 4, 33); }
    x.fillStyle = BRASS; x.fillRect(-3, -25, 6, 7); x.strokeStyle = INK; x.lineWidth = 1.2; x.strokeRect(-3, -25, 6, 7);
    for (const dx of [-16, 14]) { x.fillStyle = BRASS; x.fillRect(dx, -4, 3.4, 4); x.fillRect(dx, -22, 3.4, 4); }
  },
  image: ['props_a_f6', 'trunkClosed']
});
/* ticket machine */
reg('ticket', {
  w: 64, h: 74, ax: 32, ay: 68,
  paint(x) {
    box(x, -14, -52, 28, 52, '#2f4a3c', 31, { wash: ['#4a6e58', '#1d3026'] }); box(x, -19, -57, 38, 6, '#d4b25c', 32, { wash: ['#fbe9a2', '#97813c'] });
    box(x, -9, -45, 18, 12, '#e8dcb0', 33, { wash: ['#fff6d0', '#b8a870'], lw: 1.3 });
    x.fillStyle = INK; x.fillRect(-6, -24, 12, 3); for (const dy of [-8, -4]) { x.fillStyle = BRASS; x.beginPath(); x.arc(-8, dy - 14, 1.5, 0, 6.3); x.arc(8, dy - 14, 1.5, 0, 6.3); x.fill(); }
    x.fillStyle = '#d4b25c'; x.fillRect(-10, -4, 20, 3);
  },
  dyn(ctx, pr) { if (pr.data.wait) return; const x = pr.x, y = pr.y; ctx.fillStyle = '#f2ead0'; ctx.fillRect(x - 4, y - 21 + Math.sin(G.time * 3) * 1.5, 8, 6); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x - 4, y - 21 + Math.sin(G.time * 3) * 1.5, 8, 6); },
  image: ['props_a_f6', 'ticketMachine']
});
/* signal post: a timber pole, a semaphore arm and a lamp that glows warm until the move is taken */
reg('post', {
  w: 70, h: 100, ax: 35, ay: 94,
  paint(x) { box(x, -2.6, -64, 5.2, 64, '#5e5a4c', 41, { lw: 1.4 }); box(x, -9, -12, 18, 12, '#6a6a5c', 42); box(x, 2, -58, 20, 4.4, '#8a4e34', 43, { lw: 1.2 }); box(x, -14, -48, 12, 3.4, '#8a4e34', 44, { lw: 1.1 }); },
  dyn(ctx, pr) {
    const got = G.run.abil[pr.data.abil], a = G.abilityDefs[pr.data.abil], bob = got ? 0 : Math.sin(G.time * 2 + pr.x) * 3, X = pr.x, Y = pr.y - 36 + bob;
    if (!got) glowAt(ctx, X, Y, 46, '#f6d58a', 0.55 + 0.12 * Math.sin(G.time * 3));
    ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.PI / 4); ctx.fillStyle = got ? '#7a7868' : '#f2dc98'; ctx.fillRect(-8, -8, 16, 16); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-8, -8, 16, 16);
    if (!got) { ctx.fillStyle = '#fff8dc'; ctx.fillRect(-3.5, -3.5, 7, 7); } ctx.restore();
    if (!got && a) lbl(ctx, a.name, pr.x, pr.y - 76, 13);
  },
  image: pr => ['props_b_f6', G.run.abil[pr.data.abil] ? 'signalPostUnlit' : 'signalPostLit']
});
/* standpipe */
reg('standpipe', {
  w: 70, h: 70, ax: 35, ay: 66,
  paint(x) { box(x, -22, -12, 44, 12, '#6e7868', 51, { wash: ['#98a290', '#46504a'] }); box(x, -25, -16, 50, 5, '#8a9482', 52); box(x, -3.4, -48, 6.8, 36, '#5e6a60', 53); box(x, -3.4, -48, 18, 6, '#5e6a60', 54); box(x, 10, -45, 5, 9, '#c0a060', 55, { lw: 1.2 }); x.fillStyle = '#b8a060'; x.beginPath(); x.arc(0, -30, 6, 0, 6.3); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke(); },
  dyn(ctx, pr) { if (pr.data.used) return; ctx.fillStyle = '#d6ecf6'; for (let i = 0; i < 3; i++) { const k = (G.time * 1.2 + i / 3) % 1; ctx.globalAlpha = 1 - k * 0.5; ctx.beginPath(); ctx.ellipse(pr.x + 12.5, pr.y - 36 + k * 22, 1.6, 2.6, 0, 0, 6.3); ctx.fill(); } ctx.globalAlpha = 1; },
  image: ['props_b_f6', 'standpipe']
});
/* doorway */
reg('door', {
  w: 70, h: 90, ax: 35, ay: 84,
  paint(x, pr) {
    const p = new Path2D(); p.moveTo(-17, 0); p.lineTo(-17, -40); p.quadraticCurveTo(0, -64, 17, -40); p.lineTo(17, 0); p.closePath();
    const fr = new Path2D(); fr.moveTo(-23, 0); fr.lineTo(-23, -42); fr.quadraticCurveTo(0, -72, 23, -42); fr.lineTo(23, 0); fr.closePath();
    wc(x, fr, '#8a9482', { bb: [-23, -66, 46, 66], wash: ['#b0baa4', '#566052'], edge: '#2c342c', ink: INK, lw: 1.8, blobs: 4, seed: 61 });
    x.fillStyle = '#0c0f0c'; x.fill(p); x.strokeStyle = INK; x.lineWidth = 1.6; x.stroke();
    x.fillStyle = '#1c2a22'; x.globalAlpha = 0.6; x.fillRect(-14, -30, 28, 30); x.globalAlpha = 1;
    x.fillStyle = BRASS; x.fillRect(-4, -66, 8, 5); x.strokeStyle = INK; x.lineWidth = 1; x.strokeRect(-4, -66, 8, 5);
  },
  dyn(ctx, pr) { if (pr.data.tag) lbl(ctx, pr.data.tag, pr.x, pr.y - 78, 12, '#d8d0b8'); },
  image: ['props_b_f6', 'doorway']
});
/* region gate: arched in the region's colour with the Warden's diamond over it (the label and borrow lines stay live) */
reg('gate', {
  w: 80, h: 130, ax: 40, ay: 124,
  key: pr => pr.data.region + (G.run.beaten[pr.data.region] ? ':done' : ''),
  paint(x, pr) {
    const pal = art.palette(pr.data.region), done = G.run.beaten[pr.data.region], fr = new Path2D(); fr.moveTo(-31, 0); fr.lineTo(-31, -58); fr.quadraticCurveTo(0, -100, 31, -58); fr.lineTo(31, 0); fr.closePath();
    const p = new Path2D(); p.moveTo(-24, 0); p.lineTo(-24, -56); p.quadraticCurveTo(0, -90, 24, -56); p.lineTo(24, 0); p.closePath();
    const rim = done ? '#7a7c74' : W.region(pr.data.region).cap;
    wc(x, fr, rim, { bb: [-31, -90, 62, 90], wash: [tint(rim, 0.3), shade(rim, 0.25)], edge: shade(rim, 0.5), ink: INK, lw: 2, blobs: 4, seed: 71 });
    wc(x, p, mix(pal.sky1, '#000000', 0.25), { bb: [-24, -86, 48, 86], wash: [pal.far, '#06080a'], edge: '#000000', ink: INK, lw: 1.5, blobs: 3, seed: 72 });
    x.save(); x.translate(0, -104); x.rotate(Math.PI / 4); x.fillStyle = done ? '#5a5c54' : rim; x.fillRect(-8, -8, 16, 16); x.strokeStyle = INK; x.lineWidth = 2; x.strokeRect(-8, -8, 16, 16); x.fillStyle = done ? '#7a7c74' : INK; x.fillRect(-3, -3, 6, 6); x.restore();
  },
  dyn(ctx, pr) {
    const r = G.regionDefs[pr.data.region], done = G.run.beaten[pr.data.region], x = pr.x, y = pr.y;
    art.label(ctx, r.name, x, y - 126, 12.5, done ? '#aab2a8' : '#f2ead2', 'center', C.FONT, 600);
    G.props.TYPES.gate.borrowLines(pr, ctx).forEach((t, k, ls) => art.label(ctx, t, x, y - 143 - (ls.length - 1 - k) * 13, 10.5, '#f0b24a'));
  },
  image: ['props_b_f6', 'gate']
});
/* lock chart board: a parchment sheet pinned to a timber frame. Layout comes from props.js boardLayout through boxes(). */
P.board = {};
art.define('prop_board', (ctx, o) => {
  const pr = o.prop, T = G.props.TYPES.board;
  if (!W.on()) return T.draw(pr, ctx);
  const B = T.boxes(pr, ctx)[0], x = pr.x, w = B.x1 - B.x0, h = B.y1 - B.y0, s = scaleOf(ctx);
  ctx.fillStyle = '#4a3c2c'; ctx.fillRect(x - 54, 32, 2.6, B.y0 - 32); ctx.fillRect(x + 51.4, 32, 2.6, B.y0 - 32);
  const cv = sprite('board' + w + 'x' + h, w + 12, h + 12, 6, 6, xx => { xx.translate(0, 0); box(xx, -4, -4, w + 8, h + 8, '#7a5c3c', 81, { wash: ['#a07a4c', '#4a3220'] }); }, s);
  ctx.drawImage(cv, B.x0 - 6 - cv.ax + 6, B.y0 - 6 - cv.ay + 6, cv.w, cv.h);
  G.ui.paper(ctx, B.x0 + 1, B.y0 + 1, w - 2, h - 2, 'board');
  const L = T.boxes(pr, ctx);
  art.label(ctx, 'Lock chart', x, B.y0 + 12, 11, G.ui.INK.main, 'center', C.FONT, 700);
  for (const r of L.filter(b => b.kind === 'label' && b.text !== 'cut')) {
    const reg = Object.values(G.regionDefs).find(q => q.name === r.text), gone = reg && G.run.beaten[reg.id], chart = reg ? (G.run.graph.chart || {})[reg.id] || [] : [];
    art.label(ctx, r.text, r.x0, (r.y0 + r.y1) / 2, 10, gone ? G.ui.INK.dim : G.ui.INK.main, 'left', C.FONT, 600);
    const cuts = L.filter(b => b.kind === 'label' && b.text === 'cut' && b.y0 === r.y0);
    chart.forEach((cut, k) => { const c = cuts[k]; if (!c) return; ctx.save(); ctx.translate(c.x0 + 6, (c.y0 + c.y1) / 2); ctx.fillStyle = gone ? '#8a8878' : G.CLASSES[cut].color; art.cutShape(ctx, G.CLASSES[cut].shape, 5); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.globalAlpha = 0.8; ctx.restore(); });
  }
});
/* cracked barrier */
art.define('prop_crack', (ctx, o) => {
  const pr = o.prop, T = G.props.TYPES.crack;
  if (!W.on()) return T.draw(pr, ctx);
  const w = C.T, h = 3 * C.T, cv = sprite('crack', w + 8, h + 8, 4 + w / 2, h + 4, x => {
    wc(x, rect(-w / 2, -h, w, h, 91, 0.9), '#7e7a6c', { bb: [-w / 2, -h, w, h], wash: ['#a8a290', '#524e44'], edge: '#2a2820', ink: INK, lw: 2.2, blobs: 7, seed: 92 });
    x.strokeStyle = INK; x.globalAlpha = 0.35; x.lineWidth = 1.1; for (const k of [-70, -38, -8]) { x.beginPath(); x.moveTo(-w / 2, k); x.lineTo(w / 2, k + 1); x.stroke(); } x.globalAlpha = 1;
    x.strokeStyle = INK; x.lineWidth = 3; x.lineJoin = 'round'; x.beginPath(); x.moveTo(-3, -h); x.lineTo(5, -h + 24); x.lineTo(-6, -h + 44); x.lineTo(4, -h + 66); x.lineTo(-2, 0); x.stroke();
  }, scaleOf(ctx));
  ctx.drawImage(cv, pr.x - cv.ax, pr.y - cv.ay, cv.w, cv.h);
  ctx.strokeStyle = '#fff0c0'; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.5 + 0.25 * Math.sin(G.time * 3); ctx.beginPath(); ctx.moveTo(pr.x - 3, pr.y - h); ctx.lineTo(pr.x + 5, pr.y - h + 24); ctx.lineTo(pr.x - 6, pr.y - h + 44); ctx.lineTo(pr.x + 4, pr.y - h + 66); ctx.lineTo(pr.x - 2, pr.y); ctx.stroke(); ctx.globalAlpha = 1;
});
/* sign: a timber post and a board with ruled ink lines */
reg('sign', {
  w: 50, h: 56, ax: 25, ay: 52,
  paint(x) { box(x, -2.4, -26, 4.8, 26, '#5e4a34', 101, { lw: 1.2 }); box(x, -16, -42, 32, 18, '#a98a5c', 102, { wash: ['#cfb080', '#6a4e2c'] }); x.strokeStyle = INK; x.globalAlpha = 0.7; x.lineWidth = 1.3; x.lineCap = 'round'; for (const [a, b, y] of [[-10, 9, -36], [-10, 4, -31]]) { x.beginPath(); x.moveTo(a, y); x.lineTo(b, y + 0.4); x.stroke(); } x.globalAlpha = 1; },
  image: ['props_a_f6', 'sign']
});
// Scrip: a brass chit, a diamond with a punched hole. Used by props.js (plinth purses) and the HUD.
W.scrip = (ctx, x, y, s = 1) => {
  if (!W.on()) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#fff3c4'; ctx.fillRect(-7 * s, -7 * s, 14 * s, 14 * s); ctx.fillStyle = '#7a531c'; ctx.fillRect(-3 * s, -3 * s, 6 * s, 6 * s); ctx.restore(); return; }
  const q = W.cell('props_c_f6', 'scrip');
  if (q) { const h = 28 * s, w = h * q.sw / q.sh; ctx.drawImage(q.img, q.sx, q.sy, q.sw, q.sh, x - w / 2, y - h / 2, w, h); return; }
  const k = scaleOf(ctx), cv = sprite('scrip', 34, 34, 17, 17, c => {
    const p = poly([[0, -12], [12, 0], [0, 12], [-12, 0]], 0.5, 111);
    wc(c, p, '#d8bc6a', { bb: [-12, -12, 24, 24], wash: ['#f6e4a0', '#98782c'], edge: '#6a4c1c', ink: INK, lw: 1.6, blobs: 3, seed: 112 });
    c.fillStyle = '#4a3410'; c.beginPath(); c.arc(0, 0, 3.4, 0, 6.3); c.fill(); c.strokeStyle = '#fff2c0'; c.lineWidth = 0.9; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(-8, -1); c.lineTo(-1, -8); c.stroke();
  }, k);
  ctx.drawImage(cv, x - 17 * s, y - 17 * s, 34 * s, 34 * s);
};
})();
