# Art tools: from generated sheets to an animated character

Goal: a new character (enemy, boss part or the player) goes from a zip of generated sprite sheets to moving in the game in a few minutes. The sheets are asked for with `docs/art/SPRITE_PROMPT_PACK.md`; this page is everything after that.

Needs Python 3 with `numpy`, `Pillow` and `scipy`. Run Python on downloaded files with `-I` and keep the zip contents in their own empty folder.

## 1. Unpack and look

```
mkdir -p /tmp/sheets/rivet && unzip -q rivet.zip -d /tmp/sheets/rivet
python3 -I tools/art/inspect.py /tmp/sheets/rivet /tmp/rivet_inspect.jpg
```

File names must be `<id>_<anim>_f<frames>.png` (`rivet_move_f4.png`, `rivet_attack_f6.png`, `rivet_defeat_f4.png`; `rivet_ref_f1.png` is ignored). `inspect.py` prints size, mode and the corner pixel of each file and makes a contact sheet: check there that the frame counts are right and the backgrounds are flat or transparent.

## 2. Cut the strips

```
python3 -I tools/art/cut_set.py <srcdir> <outdir> <id> <standing height> <preview.jpg> [anim=factor ...]
python3 -I tools/art/cut_set.py /tmp/sheets/rivet assets/enemies/rivet rivet 96 /tmp/rivet_cut.jpg
```

- Output: `<outdir>/<anim>.png` (frames side by side, every frame the same cell, feet 4 px above the bottom edge, figure centred) and `strips.json` (cell size, frames per anim). Delete `strips.json` if you do not want it in the repo; the game does not read it.
- `<standing height>` is the height in output pixels the tallest frame of the standing/move animation is scaled to. Cells are at twice game scale, so pick twice the height you want in game: for a figure about 30 px tall in game, 60. The sheets for one character are scaled by the same factor so frames never change size between animations.
- `anim=factor` shrinks an animation that was drawn larger than the others (for example `attack=1.15` when the strike frame reaches far out and the sheet was drawn bigger). Normally not needed.
- Look at `<preview.jpg>`: one row per animation. If the cut grabbed a stray piece of paint, or merged two frames, regenerate that sheet with a wider gap (fix phrases in the prompt pack) rather than editing by hand.
- The cutter handles transparent and flat-colour backgrounds (it detects a hazy matte and thresholds it).
- Enemy strips: `move` 4 frames, `attack` 6 frames (3 wind-up, 1 strike, 2 recovery), `defeat` 4 frames (flinch, breaking, collapsing, wreck). The loader expects exactly these counts.

## 3. Register the skin

At the end of `js/art/sprites.js`, add one line to `G.enemySkins`, keyed by the **game enemy id**:

```js
signal_gull: { id: 'rivet', h: 32, fps: 14, center: true, fig: 59 }
```

- `id`: the folder name under `assets/enemies/`. The loader reads `move.png`, `attack.png`, `defeat.png` for every skin listed.
- `h`: the cell height in game pixels. Pick it so the figure fits its hitbox: figure height (the move strip's standing figure, cell px) x `h` / cell height should be 0.95 to 1.3 times the hitbox height (`w`, `h` in `js/content/enemies.js`). The `enemy_art` check enforces this with a table of measured figure heights (`FIG` in `tools/checks/enemy_art.mjs`; add the new figure there). To measure a figure: `python3 -I -c "from PIL import Image; import numpy as np; a=np.asarray(Image.open('assets/enemies/ID/move.png'))[...,3]; ys=np.where(a[:, :a.shape[1]//4]>40)[0]; print(a.shape[0]-ys.min()-4)"`.
- `fps`: speed of the move loop.
- Walkers need nothing else: the feet land on the hitbox bottom. Flyers (`flying: true`) set `center: true` and `fig` (the figure's height in cell pixels) so the art is centred on the hitbox and falls to the floor in its defeat.
- Art faces right; the game flips it by `e.face`.

## 4. Map the states

The defeat strip is automatic: when a skinned enemy takes its killing blow `Enemy.damage` plays `<id>_defeat` at that spot (0.5 s, then a 0.3 s fade, `fx.anim` in `js/core/fx.js`) beside a smaller burst. Hurt is automatic too (lean and squash while knocked back, white flash) and so is the turn-around squeeze when `e.face` changes.

Attack and everything else goes in the enemy's definition in `js/content/enemies.js`, next to the behaviour it follows:

```js
skinFrame(e, sk) {                       // return [strip, frame, rotation?]
  if (e.state === 'wind') return ['attack', Math.min(2, Math.floor(e.prog() * 3))];   // 3 wind-up frames across the real wind-up time
  if (e.state === 'swoop') return ['attack', 3];                                       // strike frame while it hurts
  if (e.prev === 'swoop' && e.age() < 0.3) return ['attack', e.age() < 0.15 ? 4 : 5]; // recovery after
  return ['move', G.time * sk.fps];                                                    // loop
}
```

Helpers on the enemy: `e.state`, `e.prog()` (0 to 1 through the current state's timer, set by `e.set(state, t)`), `e.age()` (seconds since the state began), `e.prev` (the state before), `e.face`, `e.shieldHit` and so on. Frames wrap for `move`; the attack strip has 6 frames (0 to 2 wind-up, 3 strike, 4 and 5 recovery). An enemy with no `skinFrame` just loops `move`.

Read the real timers (`e.set('wind', 0.6)`) and never hard-code a duration that the behaviour does not have: with a region's `aggro` scale all waits stretch, and `prog()` stays right.

## 5. Look at it, then check it

- Show hitboxes in the running game: in the console `G.debugBoxes = true` (magenta box, foot or centre cross, state name above each enemy). F2 switches the watercolor art on and off.
- Add the new enemy to `SKINNED`, `STATES` and `FIG` in `tools/checks/enemy_art.mjs` (and to the shot) and run `node tools/smoke.mjs enemy_art`. It checks that every strip loads with the right frame count, every state maps to a valid frame, the defeat strip plays and ends, the guard (Scrapper) shows "Blocked", nothing errors with the art on or off, and saves `tools/shots/enemy_art.png` (idle, wind-up, strike per enemy, hitboxes drawn) and `enemy_art_game.png`. Look at them.
- Then `node tools/smoke.mjs --fast`.
- Update the names in `docs/GAME_BIBLE.md` and `docs/art/ASSET_LIST.md` if the character is renamed (ids stay).

## The player

`cut_wanderer.py <srcdir> <outdir>` cuts the Wanderer's sheets (`wanderer_<anim>_f<n>.png`); the strips are registered in `PLAYER_STRIPS` in `js/art/sprites.js` (name: frames) and picked in `js/game/player.js`.

## Bosses (one command)

A boss's sheets (`docs/art/SPRITE_PROMPT_PACK.md` sections 9 and 10) go from a zip to a skin in the game with `cut_boss.py`:

```
python3 -I tools/art/cut_boss.py ~/Downloads/tunnel_warden.zip tunnel_warden --boss tollkeeper --height 110 \
    --attack charge=vaultcharge --attack leap=groundslam --fx wave=0 --fx glob=1,2
```

- `<asset id>` (`tunnel_warden`) is the prefix of the sheet names; `--boss` is the **game** boss id (`tollkeeper`, `lamp_heron`, `switchman_idol`, `gatewhale`, `long_clock`); `--height` is the boss's standing height in game pixels (cells are cut at twice game scale).
- Sheets: `idle move turn hurt stagger enraged defeat fx arena`, `ref` (ignored) and any attack sheets. WIDE bosses: `<id>_move_a_f4.png` + `<id>_move_b_f4.png` are cut as one strip (a then b), so the table never mentions parts.
- Unlike `cut_set.py`, every sheet is scaled by **one** factor (the idle's tallest frame becomes 2 x height), so an attack's reach never changes the boss's size. Fix one oversized sheet with `--scale <sheet>=<factor>`.
- Writes `assets/bosses/<asset id>/<sheet>.png` (same cell for every frame, feet 4 px above the bottom), `fx.png` (items centred in their own cell), `arena.png` (at most 1920 px wide, for the world team), `strips.json`, a contact sheet (`--preview`, default `/tmp/<asset id>_cut.jpg`), and registers one line in `js/art/boss_skins.js` (`G.bossSkins`, keyed by the game boss id). Re-running replaces the strips and the line. `--no-register` only cuts.
- `--attack <attack id>=<sheet>`: the attack ids are in the boss's `G.defineAttacks` table (js/content/boss_*.js); a sheet named like an attack id (`leap`) needs no mapping. `--fx <shot kind>=<cell>[,<cell>...]`: the kinds are the `kind:` of the boss's `b.shoot` calls (`wave`, `glob`).
- Look at the contact sheet, then at the game: F2 switches the art on, `G.debugBoxes = true` draws the hit shapes (they never follow the art; adjust the hitbox in the boss file, not the art), `node tools/smoke.mjs boss_skin`. Any state with no strip is drawn by the code-drawn boss, so a partial set can ship.
- A skin per state and attack phase: idle, move (walking), turn, hurt (frames 0-1 light, 2-3 heavy), stagger, enraged (idle below half hp), defeat (plays once in 1 s), and every attack as wind-up / strike / recovery frames spread over the real timers (default split of n frames: 4 = 2/1/1, 6 = 3/1/2, 8 = 3/2/3; override with `"attacks": { "leap": { "sheet": "groundslam", "split": [2, 2, 2] } }` in the table line). Details at the top of `js/art/boss_skins.js`.

### Try the pipeline without art

`python3 -I tools/art/fixtures/make_testboss.py tools/art/fixtures/testboss/sheets` draws a throwaway boss (coloured shapes, every frame different) in the prompt pack's format, including a WIDE attack in parts a and b; then
`python3 -I tools/art/cut_boss.py tools/art/fixtures/testboss/sheets testboss --boss tollkeeper --height 110 --out tools/art/fixtures/testboss/strips --fixture --fx wave=0 --fx glob=1,2`
cuts it and registers it in `G.bossSkinFixtures`. In the game, `G.debug.bossSkinFixture = true` (console) puts it on the Tollkeeper regardless of F2; the check `boss_skin` does the same and saves `tools/shots/boss_skin_*.png`.

`cut_set.py` (enemies) and `cut_boss.py` share `cutlib.py`. Both load it by path: do not put `tools/art` on `sys.path` (`inspect.py` here would shadow the standard library module `inspect`).

## World art (tiles, backdrops, props, title)

Until the owner's painted tiles and backgrounds arrive, the world is painted in code (`js/art/world.js`, `world_bg.js`, `world_props.js`, `js/ui/skin.js`): paper grain, uneven washes, pooled edges and wobbly ink lines, all cached to offscreen canvases (tile chunks of 16 x 8 tiles per room, one strip per backdrop layer, one small canvas per prop), deterministic per room, so it costs almost nothing per frame. F2 switches it (and the player and enemy art) off for the old flat look. Palette and materials per place are the `REG` table in `world.js`; backdrop colours are `BG` in `world_bg.js`.

**Replacing a piece with a painted image: one table, `js/art/world_hooks.js`.**

1. Make the sheet exactly as `docs/art/SPRITE_PROMPT_PACK.md` section 11 asks, and save it under the sheet name from that section with `.png`, in `assets/world/` (for example `tiles_quay_a_f6.png`, `bg_reef_far_f1.png`, `props_b_f6.png`). REGION is one of `junction quay reef cutting hall terminus` (Junction, Wreck Quay, Signal Reef, Salt Cutting, Ticket Hall, the Terminus).
2. Run `node tools/art/world_manifest.mjs`. It writes `assets/world/manifest.js`, the list of sheets the game then loads (a missing file is never requested).
3. Reload. Nothing else changes: a sheet the table knows takes over, everything else stays code-drawn, so images can arrive one at a time.

What each sheet does:
- `tiles_REGION_a_f6` (3 across, 2 down, reading order): wall fill, floor top, wall left face, wall right face, ceiling underside, second floor top. Each cell is cut as an equal cell and drawn as one 32 px tile, so tile pictures must fill their cell edge to edge. With sheet `a` present every solid tile of that place comes from it (floor top on exposed tops, alternating the two floors; faces and ceilings on exposed sides).
- `tiles_REGION_b_f6`: outer corner top-left and top-right (used on exposed tops with an open left or right side), inner corner top-left and top-right (used on interior cells whose diagonal is open), platform middle, platform end cap. The platform pieces draw every one-way platform of that place; the corners need sheet `a` too.
- `tiles_REGION_c_f6`: a one-tile row of spikes, then five decorations (standing on floors, drawn `decoH` = 56 px tall, placed where the code places its own, never near props, doorways or spikes). Hanging decorations stay code-drawn.
- `bg_REGION_far_f1`, `_mid_f1`, `_near_f1`: one picture each, scaled to the screen height (544 px) and repeated sideways, so the left and right edges must match. Far is opaque (it holds the sky); mid and near need transparent backgrounds. Parallax 0.12, 0.3, 0.55 of the camera (change it in the table).
- `props_a_f6`, `props_b_f6`, `props_c_f6`: six props each, one per cell, standing on the bottom edge and centred, drawn `h` px tall per cell (the `h` of each slot in the table). Slots: plinth, closed trunk, open trunk (unused), ticket machine, kiosk (a priced plinth), sign; unlit and lit signal post (the code shows lit until the move is taken), standpipe, doorway, region gate, portcullis (the boss door, stretched over its three tiles); lock chart board, hanging lamp, crate, barrel (not used yet), scrip chit (HUD and purses), sparkle (not used yet). Labels, prices, glows and prompts stay live text on top.
- `ui_title_f1`: the title lettering, drawn centred about 440 px wide on the title page. `ui_a_f6`, `ui_b_f4`, `ui_c_f4` are listed in the table (`wired: false`) so the names are reserved; the interface itself is painted in code (parchment and ink, `js/ui/skin.js`).

Images are not read pixel by pixel (a file opened from disk would taint the canvas), which is why sheets are cut into equal cells.

Check it with `node tools/smoke.mjs world_art`: every room of every place draws with the art on and off, platform tops and spikes keep 3:1 against the backdrop behind them, every text on every screen keeps 4.5:1, no interface colour is as vivid as a token cut colour, the image hooks take over, the frame time stays in budget, and `tools/shots/world_<place>.png` and `world_screens.png` are written for a person to look at.
