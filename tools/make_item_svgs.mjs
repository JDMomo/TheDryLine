// Authoring script for the item art: writes assets/tokens/<id>.svg and assets/trinkets/<id>.svg.
// The drawings are hand-written vector paths; this file only shares the blank (coin) and tag outlines between them.
// Re-run: node tools/make_item_svgs.mjs && node tools/render_art.mjs
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DK = '#14181c';

// ---- geometry helpers
const f = n => +n.toFixed(2);
// A closed polygon with every corner rounded by quadratic curves (r = distance along each edge).
const rpoly = (pts, r) => {
  const n = pts.length; let d = '';
  pts.forEach((v, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ra = Array.isArray(r) ? r[i] : r;
    const ta = Math.min(0.45, ra / la), tb = Math.min(0.45, ra / lb);
    const p1 = [v[0] + (a[0] - v[0]) * ta, v[1] + (a[1] - v[1]) * ta], p2 = [v[0] + (b[0] - v[0]) * tb, v[1] + (b[1] - v[1]) * tb];
    d += (i ? 'L' : 'M') + f(p1[0]) + ' ' + f(p1[1]) + 'Q' + f(v[0]) + ' ' + f(v[1]) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
  });
  return d + 'Z';
};
const starPts = (cx, cy, R, r) => Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8 - Math.PI / 2, k = i % 2 ? r : R; return [cx + Math.cos(a) * k, cy + Math.sin(a) * k]; });

// ---- cut tones: base, highlight, shadow (two-step only)
const CUT = {
  pierce: { base: '#56B4E9', hi: '#A9DDF8', sh: '#2C7FB4' },
  arc: { base: '#F0E442', hi: '#FBF6A3', sh: '#B9AC1C' },
  burst: { base: '#D55E00', hi: '#F7A055', sh: '#963F00' },
  ground: { base: '#CC79A7', hi: '#EAB6D1', sh: '#94527A' }
};

// ---- blanks. Each: { d: outline path, mode: 'poly' | 'fat', hole: [x,y], hi: highlight svg }
const BLANK = {
  pierce: { d: rpoly([[32, 2], [62, 59], [2, 59]], 9), hole: [32, 21], hi: '<path d="M13 51 L27 25" stroke-width="3.2"/>' },
  arc: { d: 'M42.5 6.9 A27.5 27.5 0 1 0 53.7 48.1 A21.5 21.5 0 0 1 42.5 6.9Z', fat: true, hole: [17, 20], hi: '<path d="M9 41 Q8 27 20 14" stroke-width="3.2" fill="none"/>' },
  burst: { d: rpoly(starPts(32, 32, 29.5, 17.5), [3.2, 4, 3.2, 4, 3.2, 4, 3.2, 4, 3.2, 4, 3.2, 4, 3.2, 4, 3.2, 4]), hole: [32, 15], hi: '<path d="M14 21 L21 14" stroke-width="3.2"/>' },
  ground: { d: rpoly([[2.5, 13], [61.5, 13], [61.5, 50], [2.5, 50]], 9), hole: [11, 31.5], hi: '<path d="M8 19 H55" stroke-width="3.4"/>' }
};

const holeParts = (h) => ({
  mask: `<mask id="hm"><rect width="64" height="64" fill="#fff"/><circle cx="${h[0]}" cy="${h[1]}" r="1.9" fill="#000"/></mask>`,
  ring: `<circle cx="${h[0]}" cy="${h[1]}" r="3.6" fill="none" stroke="${DK}" stroke-width="3.2"/>`
});

// Stamp: group drawn once, embossed (light copy offset down-right) then in dark ink. Use fill/stroke="currentColor" inside.
const token = (cls, stamp, extra = '') => {
  const T = CUT[cls], B = BLANK[cls], H = holeParts(B.hole);
  const fatStroke = B.fat ? ' stroke-width="3" stroke-linejoin="round"' : '';
  const outline = B.fat
    ? `<path d="${B.d}" fill="${DK}" stroke="${DK}" stroke-width="6.4" stroke-linejoin="round"/>`
    : `<path d="${B.d}" fill="${DK}" stroke="${DK}" stroke-width="3.2" stroke-linejoin="round"/>`;
  const inner = B.fat ? `<path d="${B.d}" fill="#fff" stroke="#fff"${fatStroke}/>` : `<path d="${B.d}" fill="#fff"/>`;
  const shape = B.fat ? `<path d="${B.d}" stroke-width="3" stroke-linejoin="round"` : `<path d="${B.d}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs>${H.mask}<mask id="bm">${inner}</mask>
<g id="st" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${stamp}</g></defs>
<g mask="url(#hm)">
${outline}
<g mask="url(#bm)">
${shape} fill="${T.sh}" stroke="${T.sh}"/>
${shape} fill="${T.base}" stroke="${T.base}" transform="translate(-2.4 -3)"/>
<g fill="none" stroke="${T.hi}" stroke-linecap="round">${B.hi}</g>
</g>
<use href="#st" color="${T.hi}" transform="translate(0.9 1.3)"/>
<use href="#st" color="${DK}"/>
${extra.replace(/BASE/g, T.base)}
</g>
${H.ring}
</svg>
`;
};

// ---- TOKEN STAMPS (drawn in dark ink; strokes use currentColor)
const S = {};
// pierce (triangle): stamp area about x 19..45, y 32..53
S.cobalt_awl = ['pierce', `<g transform="translate(32 43) scale(1.1) translate(-32 -43)"><path d="M17 43 a6 6 0 0 1 6-6 h4 v12 h-4 a6 6 0 0 1-6-6z" stroke="none"/><path d="M29 40 L48 43 L29 46Z" stroke-width="2"/><rect x="27" y="36.5" width="3.2" height="13" rx="1.2" stroke="none"/></g>`];
S.tin_spindle = ['pierce', `<path d="M32 30 L35.5 35 L35.5 49 L32 55 L28.5 49 L28.5 35Z" stroke-width="1.5"/><ellipse cx="32" cy="46" rx="9.5" ry="3.6" stroke="none"/><path d="M21 40.5 V36 M43 40.5 V36" fill="none" stroke-width="2.8"/>`];
S.flint_tether = ['pierce', `<path d="M39 35.5 L53 43 L39 50.5 L42.5 43Z" stroke-width="1.8"/><path d="M17 51 C13 41 24 55 29 46 S35 40 41 43" fill="none" stroke-width="3.6"/><circle cx="16.5" cy="50.5" r="3.4" fill="none" stroke-width="3"/>`];
// arc (crescent): stamp area x 12..32, y 28..54
S.ochre_ladle = ['arc', `<path d="M22 30 V42" fill="none" stroke-width="4.6"/><circle cx="22" cy="29.5" r="3.6" stroke="none"/><path d="M11.5 41 H32.5 A10.5 10.5 0 0 1 11.5 41Z" stroke-width="2"/>`];
S.sulphur_kettle = ['arc', `<path d="M15 45.5 Q15 37.5 24 37.5 Q33 37.5 33 45.5 Q33 53 24 53 Q15 53 15 45.5Z" stroke-width="1.5"/><path d="M31 42.5 L37 36.5" fill="none" stroke-width="4.8"/><circle cx="24" cy="34" r="3.2" stroke="none"/><circle cx="11" cy="44" r="3.8" fill="none" stroke-width="2.8"/>`,
  `<path d="M17.5 44 H30.5" stroke="BASE" stroke-width="2" stroke-linecap="round" fill="none"/>`];
S.chalk_skipstone = ['arc', `<ellipse cx="22.5" cy="29" rx="9.5" ry="5.4" transform="rotate(-14 22.5 29)" stroke="none"/><path d="M11 50 Q15.5 38 20 50 Q23.5 42 27 50 Q29 46 31 50" fill="none" stroke-width="3.4"/>`];
// burst (star): stamp area centre (32,36), about 22 wide, y 26..50
S.cinder_bell = ['burst', `<path d="M23.5 46 Q25 41 26.5 36.5 Q27.5 28.5 32 28.5 Q36.5 28.5 37.5 36.5 Q39 41 40.5 46Z" stroke-width="1.5"/><rect x="22" y="44" width="20" height="4.4" rx="2.2" stroke="none"/><circle cx="32" cy="50.6" r="2.8" stroke="none"/><circle cx="32" cy="26.2" r="2.2" stroke="none"/>`];
S.rust_censer = ['burst', `<circle cx="32" cy="37.5" r="12.4" fill="none" stroke-width="2.8" stroke-dasharray="6.4 4"/><circle cx="32" cy="38" r="6.4" stroke="none"/><path d="M32 32 V27" fill="none" stroke-width="2.6"/>`,
  `<path d="M28 38.5 H36 M32 34.5 V42.5" stroke="BASE" stroke-width="1.8" stroke-linecap="round" fill="none"/>`];
S.copper_drum = ['burst', `<path d="M21 37.5 L21 47 Q32 53.5 43 47 L43 37.5Z" stroke-width="1.5"/><ellipse cx="32" cy="37.5" rx="11" ry="4.4" stroke="none"/><path d="M24.5 30 L32 23.5 L39.5 30" fill="none" stroke-width="3.8"/>`,
  `<ellipse cx="32" cy="37.5" rx="7" ry="2.2" fill="BASE"/><path d="M24 42 L28 48.5 L32 42 L36 48.5 L40 42" stroke="BASE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`];
// ground (slab): stamp area x 21..57, y 21..43
S.basalt_roller = ['ground', `<path d="M53.5 32 L48 41.5 L37 41.5 L31.5 32 L37 22.5 L48 22.5Z" stroke-width="2"/><path d="M20 27.5 H27 M20 37 H27" fill="none" stroke-width="3.4"/>`,
  `<circle cx="42.5" cy="32" r="3" fill="BASE"/>`];
S.quartz_wake = ['ground', `<path d="M20 32 Q23.5 26 27 32 T34 32" fill="none" stroke-width="3.8"/><path d="M34 32 C41 32 42 24 55 24" fill="none" stroke-width="3.8"/><path d="M34 32 C41 32 42 40 55 40" fill="none" stroke-width="3.8"/>`];
S.pumice_crawler = ['ground', `<path d="M34 44 Q26 44 27.5 36 Q29 29 36 21.5 Q36.5 28.5 41 30 Q43.5 27 42.5 23.5 Q52 29 51 38 Q50 44 41.5 44Z" stroke-width="1.8"/>`,
  `<circle cx="36" cy="38.5" r="2.1" fill="BASE"/><circle cx="43.5" cy="36" r="1.8" fill="BASE"/><circle cx="40.5" cy="41" r="1.5" fill="BASE"/><circle cx="38.5" cy="32.5" r="1.4" fill="BASE"/>`];

// ledger tokens (one per cut, unlocked by feats; js/game/ledger.js)
S.jet_gimlet = ['pierce', `<path d="M21 49 Q19 37 33 36.5 Q42 36 44.5 43" fill="none" stroke-width="3.4"/><path d="M39.5 39.5 L47.5 44.5 L39 48Z" stroke-width="1.6"/><circle cx="21.5" cy="49.5" r="2.4" stroke="none"/>`];
S.amber_sling = ['arc', `<path d="M15 30 L22 40 L29 30" fill="none" stroke-width="3"/><path d="M22 40 V52" fill="none" stroke-width="3.6"/><circle cx="22" cy="45" r="4.2" stroke="none"/>`,
  `<circle cx="20.6" cy="43.6" r="1.3" fill="BASE"/>`];
S.mica_lantern = ['burst', `<path d="M25.5 29 H38.5 L40.5 35 V47 H23.5 V35Z" stroke-width="1.8"/><path d="M28.5 29 V24.5 H35.5 V29" fill="none" stroke-width="2.8"/>`,
  `<rect x="28" y="34.5" width="8" height="8" rx="1" fill="BASE"/><path d="M32 34.5 V42.5" stroke="#14181c" stroke-width="1.2"/>`];
S.gypsum_sledge = ['ground', `<path d="M23.5 40 H54.5 V35 Q54.5 31 50.5 31 H29 Q25 31 23.5 35Z" stroke-width="1.8"/><path d="M26 43.5 H52" fill="none" stroke-width="3.2"/><path d="M31 31 L36 22.5 H44 L48 31" fill="none" stroke-width="2.6"/>`,
  `<path d="M28 35.5 H50" stroke="BASE" stroke-width="1.8" stroke-linecap="round" fill="none"/>`];

// ---- TRINKETS: a neutral brass tag with a small object
const TAG = { base: '#CDB57A', hi: '#EADBA9', sh: '#9A8452' };
const tagPath = rpoly([[22, 3], [42, 3], [55, 16], [55, 59], [9, 59], [9, 16]], 7);
const tag = obj => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs><mask id="hm"><rect width="64" height="64" fill="#fff"/><circle cx="32" cy="13" r="1.9" fill="#000"/></mask><mask id="bm"><path d="${tagPath}" fill="#fff"/></mask></defs>
<g mask="url(#hm)">
<path d="${tagPath}" fill="${DK}" stroke="${DK}" stroke-width="3.2" stroke-linejoin="round"/>
<g mask="url(#bm)"><path d="${tagPath}" fill="${TAG.sh}"/><path d="${tagPath}" fill="${TAG.base}" transform="translate(-2.4 -3)"/>
<path d="M12.5 50 V24 L22 8" fill="none" stroke="${TAG.hi}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15.5 55.5 H48.5" fill="none" stroke="${TAG.sh}" stroke-width="1.6" stroke-linecap="round" opacity="0"/></g>
</g>
<circle cx="32" cy="13" r="3.6" fill="none" stroke="${DK}" stroke-width="3.2"/>
<g stroke-linejoin="round" stroke-linecap="round">${obj}</g>
</svg>
`;
const O = (d, fill, extra = '', sw = 3) => `<path d="${d}" fill="${fill}" stroke="${DK}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
const L = (d, col, w = 2.4) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const TR = {};
TR.brass_buckle = (() => { const g = '#F2C94C', hi = '#FFEFA8', sh = '#B88A1E';
  return O('M17.5 33 Q17.5 26.5 24 26.5 H40 Q46.5 26.5 46.5 33 V43 Q46.5 49.5 40 49.5 H24 Q17.5 49.5 17.5 43Z M24 32.5 V43.5 H40 V32.5Z', g, 'fill-rule="evenodd"') +
    L('M21 44 Q20.5 34 25.5 30', hi, 2.4) + O('M29.8 27 H34.2 V41 Q34.2 42.5 32 42.5 Q29.8 42.5 29.8 41Z', g, '', 2.6); })();
TR.oiled_strap = (() => { const b = '#9A5F2C', hi = '#CE8C4E', sh = '#6A3E1B';
  return O('M32 24 A14 14 0 1 1 31.9 24Z M32 31 A7 7 0 1 0 32.1 31Z', b, 'fill-rule="evenodd"') +
    L('M21.5 41 Q22 30 31 27.5', hi, 2.8) + L('M44 41 Q40 49 32 49.5', sh, 2.8) +
    `<circle cx="32" cy="20.5" r="0" /><path d="M32 17 Q36.5 24 36.5 27 A4.5 4.5 0 0 1 27.5 27 Q27.5 24 32 17Z" transform="translate(11 -2) scale(0.78)" fill="#F4C25B" stroke="${DK}" stroke-width="3.2" stroke-linejoin="round"/>` +
    L('M45 27 Q46.5 28.5 46 31', '#FFF0B0', 1.8); })();
TR.whetstone_chip = (() => { const b = '#B9B5A6';
  return O('M15 37 L32 24 L47 28.5 L50 37 L32 49.5 L19 46Z', b) + `<path d="M32 24 L47 28.5 L50 37 L36 37Z" fill="#DAD7CA" stroke="${DK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M19 46 L15 37 L36 37 L32 49.5Z" fill="#8F8B7E" opacity="0"/>` + L('M20 44 L34 46', '#8C8878', 2.2) + `<circle cx="26" cy="40" r="1.3" fill="#8C8878"/><circle cx="41" cy="42" r="1.3" fill="#8C8878"/>` +
    `<path d="M44 17 L45.6 21 L49.5 22.5 L45.6 24 L44 28 L42.4 24 L38.5 22.5 L42.4 21Z" fill="#F4F1E8" stroke="${DK}" stroke-width="1.8" stroke-linejoin="round"/>`; })();
TR.lead_boot = (() => { const b = '#7D8590';
  return O('M21 21.5 H36 V35 Q36 39 41 40.5 L47.5 42.5 Q51.5 44 51.5 48 V52 H21Z', b) + `<path d="M21 47 H51.5 V52.5 H21Z" fill="#454B53" stroke="${DK}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<path d="M21 21.5 H36 V27 H21Z" fill="#A9B1BA" stroke="${DK}" stroke-width="2.6" stroke-linejoin="round"/>` + L('M25 31 V42', '#A9B1BA', 2.4) + `<circle cx="42" cy="44.5" r="1.4" fill="#454B53"/><circle cx="46.5" cy="45.5" r="1.4" fill="#454B53"/>`; })();
TR.magnet_tooth = (() => {
  const d = 'M21 51 V38 A11 11 0 0 1 43 38 V51';
  return `<path d="${d}" fill="none" stroke="${DK}" stroke-width="12.6" stroke-linecap="butt" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#C94A3A" stroke-width="6.6" stroke-linecap="butt"/>` + L('M24 44 V38 A8 8 0 0 1 32 29.5', '#EE8B79', 2.2) +
    `<path d="M21 44.5 V51 M43 44.5 V51" fill="none" stroke="${DK}" stroke-width="12.6" stroke-linecap="butt"/><path d="M21 44.5 V51 M43 44.5 V51" fill="none" stroke="#F4F1E8" stroke-width="6.6" stroke-linecap="butt"/>` +
    `<path d="M26.5 22 V18 M32 20 V16 M37.5 22 V18" stroke="#F0E442" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0"/>`; })();
TR.punch_glove = (() => { const b = '#C98F5F';
  return O('M18 37 Q18 22.5 32 22.5 Q46 22.5 46 33.5 Q46 41 42 44.5 H25 Q18 44 18 37Z', b) + L('M24 28.5 Q30 25 38 27', '#E8BB8C', 2.8) +
    O('M21.5 36 Q29 33.5 38 39 Q39.5 43.5 34 44 H25 Q20 43 21.5 36Z', '#A8704A', '', 2.6) + L('M44.5 30 V36', '#8E5E3A', 2) +
    O('M22.5 44.5 H41.5 V52 Q41.5 54 39.5 54 H24.5 Q22.5 54 22.5 52Z', '#EDE3C8', '', 2.6) + L('M26 49.2 H38', '#B9AE8E', 1.8); })();
TR.brine_flask = (() => { const b = '#5F9AC4';
  return O('M27.5 20 H36.5 V30 L45 49 Q46.5 54 41 54 H23 Q17.5 54 19 49 L27.5 30Z', b) +
    `<path d="M23.5 43 H40.5 L44.5 51 Q45.5 53.5 41.5 53.5 H22.5 Q18.5 53.5 19.5 51Z" fill="#DDEBF4" stroke="none"/>` +
    O('M27.5 20 H36.5 V30 L45 49 Q46.5 54 41 54 H23 Q17.5 54 19 49 L27.5 30Z', 'none') + O('M26.5 14.5 H37.5 V20.5 H26.5Z', '#C9A66B', '', 2.6) +
    L('M30 24 V30.5 L23.5 44', '#A6CCE6', 2.4) + `<rect x="28" y="46" width="3.4" height="3.4" fill="#F4F1E8"/><rect x="35" y="47.5" width="3" height="3" fill="#F4F1E8"/>`; })();
TR.surveyors_slate = (() => {
  return O('M16.5 22 H47.5 V50 H16.5Z', '#A88A55', 'rx="3"') + `<path d="M21.5 27 H42.5 V45 H21.5Z" fill="#6F7F78" stroke="${DK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    L('M24.5 41 L30 34 L34 38 L40 30.5', '#F4F1E8', 2.6) + `<circle cx="40" cy="30.5" r="1.8" fill="#F4F1E8"/>` + L('M19 25 H35', '#D8BE86', 1.8) + L('M45 30 V47.5 H29', '#7E6638', 2); })();

const out = (dir, id, svg) => { mkdirSync(path.join(root, 'assets', dir), { recursive: true }); writeFileSync(path.join(root, 'assets', dir, id + '.svg'), svg); };
for (const id in S) out('tokens', id, token(S[id][0], S[id][1], S[id][2] || ''));
for (const id in TR) out('trinkets', id, tag(TR[id]));
console.log('wrote', Object.keys(S).length, 'tokens and', Object.keys(TR).length, 'trinkets');
