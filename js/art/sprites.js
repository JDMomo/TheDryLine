/* ART: item sprites. Loads assets/tokens/<id>.png and assets/trinkets/<id>.png (made by tools/render_art.mjs) into G.sprites as
   item_<id> and trinket_<id>. Until an image has loaded, or if its file is missing, G.sprites has no entry and G.art.draw falls back
   to the code-drawn icon. Paths are relative to index.html, so this works from file:// and from a static host.
   Uses the 128 px file (@2x) on high-density screens, the 64 px file otherwise. */
(() => {
'use strict';
const G = window.G;
const hd = (window.devicePixelRatio || 1) >= 1.5;
const load = (key, dir, id) => {
  const img = new Image();
  G.spritesPending = (G.spritesPending || 0) + 1;
  const done = ok => { if (ok && img.naturalWidth > 0) G.sprites[key] = img; else delete G.sprites[key]; G.spritesPending--; };
  // an entry appears only once the image is decoded, so there is never a blank or half-drawn frame: the code-drawn icon shows until then
  img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).then(() => done(true), () => done(true)); };
  img.onerror = () => done(false);                      // keep the code-drawn icon
  img.src = 'assets/' + dir + '/' + id + (hd ? '@2x' : '') + '.png';
};
for (const id of Object.keys(G.itemDefs || {})) load('item_' + id, 'tokens', id);
for (const id of Object.keys(G.trinketDefs || {})) load('trinket_' + id, 'trinkets', id);
// Strips: one image holding n frames side by side (frame width = width / n). A missing file leaves G.strips empty: the code-drawn art shows.
const loadStrip = (key, file, frames) => {
  const img = new Image();
  G.spritesPending = (G.spritesPending || 0) + 1;
  const done = ok => { if (ok && img.naturalWidth > 0) G.strips[key] = { img, frames, fw: img.naturalWidth / frames, fh: img.naturalHeight }; else delete G.strips[key]; G.spritesPending--; };
  img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).then(() => done(true), () => done(true)); };
  img.onerror = () => done(false);
  img.src = 'assets/' + file;
};
loadStrip('player_idle', 'player/idle.png', 4);
loadStrip('player_run', 'player/run.png', 8);
})();
