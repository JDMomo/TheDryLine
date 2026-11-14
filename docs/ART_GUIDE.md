# Art guide: items (tokens and trinkets)

Later artists (enemies, bosses, tiles) should match this. Theme: salt, rust, lamps, brass on a dry seabed.

## Rules
- One original vector drawing per thing, written as SVG, `viewBox="0 0 64 64"`, no text, no gradients, no external files.
- Outline `#14181c`, 3 px, round joins and caps. Flat fills with exactly two extra tones per colour: one highlight (a thin stripe along the top-left inside edge) and one shadow (a band along the bottom-right edge, made by drawing the base fill shifted 2.4 px left and 3 px up over a shadow fill).
- Chunky, rounded shapes; keep 2 px clear of the 64 box. Must read at 24 px: silhouette first, one bold idea per picture, no detail thinner than 2 px.
- Tokens: a coin-like blank whose outline is its cut's shape (triangle, crescent, eight-point star, flat slab), in the cut's colour, a small punch hole (a real transparent hole with a dark ring), and a bold stamp of the tool in dark ink with a light copy offset 0.9, 1.3 px for the embossed look. The stamp hints at behaviour (cable, bounce marks, echo ring, split wave). Tokens of one cut share the blank and differ by stamp; stamps must differ in silhouette.
- Trinkets: a neutral brass tag with a hole, no cut shape, with a small coloured object on it.
- Tokens never lose their cut colour; no scenery or enemy uses the four cut colours.

## Palette
Outline `#14181c`. Cuts (base / highlight / shadow): pierce `#56B4E9 / #A9DDF8 / #2C7FB4`; arc `#F0E442 / #FBF6A3 / #B9AC1C`; burst `#D55E00 / #F7A055 / #963F00`; ground `#CC79A7 / #EAB6D1 / #94527A`. Brass tag `#CDB57A / #EADBA9 / #9A8452`. Salt `#F4F1E8`. Player teal and amber stay reserved for the player.

## Files and tools
- `assets/tokens/<id>.svg` and `assets/trinkets/<id>.svg` are the sources. `tools/make_item_svgs.mjs` is the authoring script that wrote them (shared blanks and tag; the stamps and objects are hand-written paths in it). Either edit the script and re-run it, or edit an SVG by hand and skip the script.
- `node tools/render_art.mjs` rasterises every SVG to `<id>.png` (64 px) and `<id>@2x.png` (128 px), transparent, with headless Chrome.
- `node tools/art_shots.mjs` writes the contact sheet `tools/shots/art_items.png` (24, 48, 128 px) and the in-game shots `art_hud.png`, `art_plinth.png`. Look at them before handing over.
- `js/art/sprites.js` loads PNGs into `G.sprites` as `item_<id>` and `trinket_<id>` by relative path, and falls back to the code-drawn `drawIcon` while loading or when a file is missing. Token sprites are also the spinning projectile for the Ladle, Kettle, Skipstone and the Censer's echo (`spr` in `js/content/items.js`).

## Add a new token sprite
1. Add the token with `G.defineItem` (its `drawIcon` stays as the fallback).
2. Add a stamp entry `S.<id> = [cut, svgStamp, optionalKnockouts]` in `tools/make_item_svgs.mjs`: dark-ink shapes inside the blank's stamp area (triangle x 19..45, y 32..53; crescent x 10..32, y 26..54; star centre 32,36, about 22 wide; slab x 21..57, y 21..43). Use `BASE` in the third field for details cut back to the blank colour.
3. `node tools/make_item_svgs.mjs && node tools/render_art.mjs && node tools/art_shots.mjs --sheet`; check the sheet at 24 px against its cut mates.
4. `sprites.js` picks it up automatically from `G.itemDefs`. For other kinds (enemy, boss, prop) add a loader line with the id prefix the art hook already uses (`enemy_<id>`, `boss_<id>`, `prop_<type>`).
