/* Cut-out rig: draws a character from separate painted parts on a skeleton, posed in code every frame.
   One parts sheet replaces every animation strip: idle, run and jump are generated here, smoothly, at any frame rate.
   G.rig.draw(name, pose, ctx, opts) composes the pose onto a cached canvas; G.lineart turns that canvas into ASCII or strokes. */
(() => {
const G = window.G, TAU = Math.PI * 2;
const R = G.rig = { on: true, ready: {}, imgs: {} };

/* load each character's part images */
for (const name in G.rigData || {}) {
  const D = G.rigData[name]; let left = Object.keys(D.parts).length; R.imgs[name] = {};
  for (const part in D.parts) {
    const img = new Image();
    img.onload = () => { if (--left === 0) R.ready[name] = true; };
    img.onerror = () => { left = -1; };
    img.src = 'assets/rig/' + name + '/' + part + '.png';
    R.imgs[name][part] = img;
  }
}

/* Pose: angles in radians per bone, plus a root offset. kind: idle | run | jump | fall. ph: cycle phase. t: seconds. */
R.pose = function (kind, ph, t) {
  const s = Math.sin(ph), c = Math.cos(ph), a = {}; let dx = 0, dy = 0;
  if (kind === 'run') {
    dy = -Math.abs(Math.sin(ph)) * 3.5 + 1.5; dx = 1.5;
    a.torso = 0.16 + Math.sin(ph * 2) * 0.03;
    a.head = -0.1 + Math.sin(ph * 2 + 0.6) * 0.04; a.hat = Math.sin(ph * 2 + 1.2) * 0.06;
    a.thighF = -s * 0.9; a.shinF = Math.max(0, c) * 1.2 + 0.1;
    a.thighB = s * 0.9;  a.shinB = Math.max(0, -c) * 1.2 + 0.1;
    a.armF = s * 0.8 - 0.1; a.foreF = -0.6 - Math.max(0, s) * 0.4;
    a.armB = -s * 0.8 - 0.1; a.foreB = -0.6 - Math.max(0, -s) * 0.4;
    a.cloak = 0.35 + Math.sin(t * 9) * 0.07; a.scarf = 0.3 + Math.sin(t * 11) * 0.12; a.lute = Math.sin(ph * 2) * 0.08;
  } else if (kind === 'jump' || kind === 'fall') {
    const up = kind === 'jump';
    a.torso = up ? -0.05 : 0.08; a.head = up ? -0.1 : 0.05; a.hat = up ? -0.12 : 0.15;
    a.thighF = up ? -0.7 : -0.3; a.shinF = up ? 1.1 : 0.4; a.thighB = up ? 0.2 : 0.35; a.shinB = up ? 0.9 : 0.5;
    a.armF = up ? -1.1 : -0.5; a.foreF = up ? -0.5 : -0.3; a.armB = up ? 0.6 : -0.8; a.foreB = -0.4;
    a.cloak = (up ? -0.25 : 0.45) + Math.sin(t * 8) * 0.06; a.scarf = (up ? -0.2 : 0.4) + Math.sin(t * 10) * 0.1; a.lute = up ? -0.1 : 0.12;
  } else {                                                     /* idle: breathing, a slow look, cloth drifting */
    const br = Math.sin(t * 2.2);
    dy = br * 0.4;
    a.torso = br * 0.015; a.head = Math.sin(t * 0.9) * 0.05; a.hat = Math.sin(t * 0.9 + 0.5) * 0.04;
    a.armF = 0.05 + br * 0.03; a.foreF = -0.1; a.armB = 0.05 - br * 0.03; a.foreB = -0.1;
    a.cloak = Math.sin(t * 1.4) * 0.05; a.scarf = Math.sin(t * 1.9) * 0.09; a.lute = br * 0.02;
  }
  return { a, dx, dy };
};

/* Compose a pose onto a canvas (cached per character, redrawn when the pose stamp changes). Returns { canvas, k } or null. */
R.compose = function (name, pose, scale, stamp) {
  if (!R.ready[name]) return null;
  const D = G.rigData[name], key = name + ':' + scale;
  let rec = R['_c' + key];
  if (!rec) { const cv = document.createElement('canvas'); cv.width = Math.ceil(D.frame[0] * scale); cv.height = Math.ceil(D.frame[1] * scale); rec = R['_c' + key] = { cv, stamp: '' }; }
  if (rec.stamp === stamp) return rec.cv;
  rec.stamp = stamp;
  const q = rec.cv.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, rec.cv.width, rec.cv.height);
  const M = {};
  const mat = n => {
    if (M[n]) return M[n];
    const p = D.parts[n], ang = pose.a[n] || 0, c = Math.cos(ang), s = Math.sin(ang), x = p.at[0], y = p.at[1];
    let m = [c, s, -s, c, x - c * x + s * y, y - s * x - c * y];
    if (p.parent) { const A = mat(p.parent); m = [A[0] * m[0] + A[2] * m[1], A[1] * m[0] + A[3] * m[1], A[0] * m[2] + A[2] * m[3], A[1] * m[2] + A[3] * m[3], A[0] * m[4] + A[2] * m[5] + A[4], A[1] * m[4] + A[3] * m[5] + A[5]]; }
    else m[4] += pose.dx, m[5] += pose.dy;
    return (M[n] = m);
  };
  for (const n of D.order) {
    const p = D.parts[n], m = mat(n), img = R.imgs[name][n];
    q.setTransform(m[0] * scale, m[1] * scale, m[2] * scale, m[3] * scale, m[4] * scale, m[5] * scale);
    q.drawImage(img, p.at[0] - p.pivot[0] * p.scale, p.at[1] - p.pivot[1] * p.scale, p.w * p.scale, p.h * p.scale);
  }
  q.setTransform(1, 0, 0, 1, 0, 0);
  return rec.cv;
};
})();
