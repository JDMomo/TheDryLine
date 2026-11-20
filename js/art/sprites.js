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
// Static watercolor props cut from the owner's canonical concept sheet. They use the same sprite-first/fallback-second path as items.
const loadStatic = (key, file) => {
  const img = new Image();
  G.spritesPending = (G.spritesPending || 0) + 1;
  const done = ok => { if (ok && img.naturalWidth > 0) G.sprites[key] = img; else delete G.sprites[key]; G.spritesPending--; };
  img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).then(() => done(true), () => done(true)); };
  img.onerror = () => done(false);
  img.src = 'assets/' + file;
};
loadStatic('prop_trunk', 'props/chest.webp');
loadStatic('prop_ticket', 'props/ticket_machine.webp');
loadStatic('prop_sign', 'props/signpost.webp');
loadStatic('prop_post', 'props/signpost.webp');
loadStatic('prop_lamp_decor', 'props/lamp.webp');
// needs re-export (file arrived truncated): loadStatic('prop_crate_decor', 'props/crate_barrel.webp');
loadStatic('prop_banner_decor', 'props/banner.webp');
loadStatic('prop_furnace_decor', 'props/furnace.webp');
// Canonical concept-sheet bodies for enemies whose full animation strips are still pending.
// These are intentionally static production placeholders; combat tells remain dynamic overlays in the enemy definitions.
loadStatic('enemy_sapper', 'enemies/sapper/static.webp');
loadStatic('enemy_harvester', 'enemies/harvester/static.webp');
loadStatic('enemy_mirage', 'enemies/mirage/static.webp');
loadStatic('portrait_guide', 'portraits/guide.webp');

// Strips: one image holding n frames side by side (frame width = width / n). A missing file leaves G.strips empty: the code-drawn art shows.
const loadStrip = (key, file, frames) => {
  const img = new Image();
  G.spritesPending = (G.spritesPending || 0) + 1;
  const done = ok => { if (ok && img.naturalWidth > 0) G.strips[key] = { img, frames, fw: img.naturalWidth / frames, fh: img.naturalHeight }; else delete G.strips[key]; G.spritesPending--; };
  img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).then(() => done(true), () => done(true)); };
  img.onerror = () => done(false);
  img.src = 'assets/' + file;
};
// The Wanderer: cut from the owner's watercolor sheets by tools/art (frames are 192 x 136 at twice game scale, feet 4 px above the bottom edge).
// First production Warden body: three clean concept-sheet states. Attack motion still comes from the boss pose system.
// needs re-export (file arrived truncated): loadStrip('boss_tollkeeper_states', 'bosses/tollkeeper/states.webp', 3);
const PLAYER_STRIPS = { arc: 6, burst: 6, dash: 4, doublejump: 4, ground: 4, heavy: 6, hurt: 4, idle: 4, interact: 4, jump: 4, ko: 4, land: 4, mend: 4, pierce: 6, revive: 4, run: 8, slash_down: 4, slash_side: 6, wallslide: 4 };
for (const name in PLAYER_STRIPS) loadStrip('player_' + name, 'player/' + name + '.png', PLAYER_STRIPS[name]);
// Enemy skins cut from the owner's sheets by tools/art/cut_set.py (cells at twice game scale, feet 4 px above the bottom edge). Each
// maps an enemy id to the art that stands in for it while the watercolor art is on: move (4 frames), attack (3 wind-up, 1 strike,
// 2 recovery) and defeat (4). h = the cell height in game pixels (sized so the figure fits the hitbox; see tools/art/README.md),
// fps = the move loop's speed, center + fig = a flyer: centred on its hitbox, fig = the figure's height in cell pixels.
// The state-to-frame mapping lives in each enemy's skinFrame (js/content/enemies.js).
G.enemySkins = { ballast_crab: { id: 'strider', h: 32, fps: 8 }, brine_spout: { id: 'boiler', h: 36, fps: 3 }, signal_gull: { id: 'rivet', h: 32, fps: 14, center: true, fig: 59 },
  handcar: { id: 'gearling', h: 40, fps: 6 }, turnstile: { id: 'scrapper', h: 52, fps: 5 } };
for (const k in G.enemySkins) {
  const id = G.enemySkins[k].id;
  loadStrip(id + '_move', 'enemies/' + id + '/move.png', 4); loadStrip(id + '_attack', 'enemies/' + id + '/attack.png', 6); loadStrip(id + '_defeat', 'enemies/' + id + '/defeat.png', 4);
}
})();
