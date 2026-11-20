/* THE ONE TABLE for painted world art. Plain data, no code, so tools/art/world_manifest.mjs can read it too.
   Every tile set, backdrop layer and prop the code paints in watercolor can be replaced by an image the owner paints: put the PNG in
   assets/world/ under the file name below (the names are the SHEET names of docs/art/SPRITE_PROMPT_PACK.md section 11, plus .png),
   then run `node tools/art/world_manifest.mjs` (it lists the files it finds in assets/world/manifest.js). Nothing else changes.
   A missing file simply leaves the code-drawn art in place, so images can arrive one at a time.
   Sheets are cut into EQUAL cells (cols across, rows down, in reading order = the order of `slots`); each cell is one picture.
   See tools/art/README.md, "World art". */
window.G = window.G || {};
(() => {
const REGIONS = { hub: 'junction', r1: 'quay', r2: 'reef', r3: 'cutting', r4: 'hall', final: 'terminus' };   // region id -> REGION in the file names
const hooks = {};
for (const id in REGIONS) {
  const n = REGIONS[id];
  // Tile sheets: each cell is exactly one 32 px tile (any size, scaled to 32), edge to edge. Used on the matching region's rooms.
  hooks['tiles_' + n + '_a_f6'] = { kind: 'tiles', region: id, cols: 3, rows: 2, slots: ['wall', 'floor', 'wallLeft', 'wallRight', 'ceiling', 'floor2'] };
  hooks['tiles_' + n + '_b_f6'] = { kind: 'tiles', region: id, cols: 3, rows: 2, slots: ['cornerTopLeft', 'cornerTopRight', 'innerTopLeft', 'innerTopRight', 'platform', 'platformEnd'] };
  // c: a one-tile row of spikes, then five decorations (each cell scaled to `decoH` game pixels tall, standing on a floor; hung ones are not used)
  hooks['tiles_' + n + '_c_f6'] = { kind: 'tiles', region: id, cols: 3, rows: 2, slots: ['spikes', 'deco1', 'deco2', 'deco3', 'deco4', 'deco5'], decoH: 56 };
  // Backgrounds: one picture each, scaled to the screen height (544) and repeated sideways; the left and right edges must match.
  // far is opaque (it includes the sky); mid and near need a transparent background. parallax = how far each moves with the camera.
  hooks['bg_' + n + '_far_f1'] = { kind: 'bg', region: id, layer: 'far', parallax: 0.12 };
  hooks['bg_' + n + '_mid_f1'] = { kind: 'bg', region: id, layer: 'mid', parallax: 0.3 };
  hooks['bg_' + n + '_near_f1'] = { kind: 'bg', region: id, layer: 'near', parallax: 0.55 };
}
// Props: sheets of six, one prop per cell standing on the cell's bottom edge, centred. h = how many game pixels tall one cell is drawn.
// `prop` names the prop type (js/game/props.js) and `state` which look of it. They apply to every region.
hooks.props_a_f6 = { kind: 'props', cols: 3, rows: 2, slots: [
  { name: 'plinth', prop: 'plinth', h: 56 }, { name: 'trunkClosed', prop: 'trunk', h: 52 }, { name: 'trunkOpen', prop: 'trunk', state: 'open', h: 52 },
  { name: 'ticketMachine', prop: 'ticket', h: 72 }, { name: 'kiosk', prop: 'plinth', state: 'priced', h: 96 }, { name: 'sign', prop: 'sign', h: 56 }] };
hooks.props_b_f6 = { kind: 'props', cols: 3, rows: 2, slots: [
  { name: 'signalPostUnlit', prop: 'post', state: 'got', h: 72 }, { name: 'signalPostLit', prop: 'post', h: 72 }, { name: 'standpipe', prop: 'standpipe', h: 64 },
  { name: 'doorway', prop: 'door', h: 72 }, { name: 'gate', prop: 'gate', h: 112 }, { name: 'portcullis', prop: 'bossdoor', h: 96 }] };
hooks.props_c_f6 = { kind: 'props', cols: 3, rows: 2, slots: [
  { name: 'timetableBoard', prop: 'board', h: 150 }, { name: 'hangingLamp', prop: null }, { name: 'crate', prop: null }, { name: 'barrel', prop: null },
  { name: 'scrip', prop: 'scrip', h: 28 }, { name: 'sparkle', prop: null }] };
// Interface: only the title lettering is wired so far (ui_title_f1, drawn centred at the title screen, scaled to about 520 x 130 px).
hooks.ui_title_f1 = { kind: 'ui', slot: 'title' };
hooks.ui_a_f6 = { kind: 'ui', wired: false, cols: 3, rows: 2, slots: ['pipFull', 'pipEmpty', 'gaugeFrame', 'emblem', 'slotFrame', 'slotFrameLit'] };
hooks.ui_b_f4 = { kind: 'ui', wired: false, cols: 4, rows: 1, slots: ['blankTriangle', 'blankCrescent', 'blankStar', 'blankSlab'] };
hooks.ui_c_f4 = { kind: 'ui', wired: false, cols: 4, rows: 1, slots: ['dash', 'grip', 'double', 'heavy'] };
G.worldHooks = { regions: REGIONS, hooks };
})();
