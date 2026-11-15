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
