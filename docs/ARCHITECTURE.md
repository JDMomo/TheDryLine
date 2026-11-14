# Engine architecture

This file describes the engine as built (2026-11-14). If this file and the code disagree, the code wins: tell the engine lead.
Names follow docs/GAME_BIBLE.md. The code keeps a few older words: **item** = token, **cls** = cut, **spot** = fare slot, **shards** = scrip.

## Ground rules
- Browser game, plain JavaScript, canvas 2D. No build step, no modules, no libraries, no network requests (no web fonts either).
- Every file is a classic `<script>` wrapped in an IIFE with `'use strict'` that attaches to one global, `window.G`.
- `index.html` loads a fixed list: `js/core/*`, `js/game/*`, then the content files in this order: `items, trinkets, enemies, boss_r1, boss_r2, boss_r3, boss_r4, boss_final, rooms_hub, rooms_shared, rooms_r1, rooms_r2, rooms_r3, rooms_r4, rooms_final, regions`, then `js/ui/*`, then `js/main.js`. Only the engine lead edits `index.html`. Content workers fill the existing files.
- Runs from `file://` and from a static host. Relative paths only.
- Fixed timestep `G.C.STEP = 1/120`. Gameplay runs in update/step functions; drawing never changes game state.
- Randomness that changes a run uses the seeded `G.run.rng` (a seed replays a run). `Math.random` and `G.util.rnd` are for cosmetics only.
- `localStorage` only inside try/catch (`G.game.saveMeta`). The game works without it.
- Content mistakes call `G.fail(msg)`, which logs and pushes to `G.errors`; the smoke test fails on any of them.

## Units
- Canvas 960 x 544, tile `T = 32`, one screen cell = 30 x 17 tiles. A room is `w x h` cells.
- x right, y down. An entity's `(x, y)` is its feet centre; its box is `x ± w/2`, `y - h .. y`.

## Files
```
index.html, css/page.css    page: canvas scaled to fit, "Click to play" overlay, notes in a collapsed <details>
js/core/util.js     G.C constants (C.MOVE = movement feel, identical to the prototype), G.util, G.title, G.errors, G.fail
js/core/input.js    G.input: keyboard + 4 gamepads -> per-player { held, pressed, forced }
js/core/fx.js       G.fx: spark, dust, ring, ghost, floatText, say (banner), jolt(hitstop, shake)
js/core/tiles.js    G.tiles: current grid, solid / spike / oneway / floorAt, moveBox(o, dx, dy), wallDir(o), blockers
js/core/camera.js   G.cam.follow(dt, x, y, snap)
js/core/art.js      G.art: draw(id, ctx, opts) sprite hook, define(id, painter), palette(regionId), cutShape, label, backdrop, tiles
js/game/player.js   G.Player, G.players, G.defineAbility, G.abilityDefs
js/game/combat.js   G.combat (shoot, strike, melee, hurtPlayers, clearHostile, dropShards), G.shots, G.pickups
js/game/items.js    G.CLASSES (the four cuts), G.defineItem, G.itemDefs, G.items (icon, pool, roll)
js/game/trinkets.js G.baseMods, G.defineTrinket, G.trinketDefs, G.trinkets (icon, roll)
js/game/enemies.js  G.defineEnemy, G.enemyDefs, G.Enemy
js/game/bosses.js   G.defineBoss, G.bossDefs, G.Boss
js/game/props.js    G.props (make, TYPES, drawPrompt)
js/game/rooms.js    G.defineRoom, G.roomDefs, G.rooms (current, go, enter, startFight, endFight, update, draw)
js/game/worldgen.js G.defineRegion, G.regionDefs, G.worldgen (build(seed), check(graph))
js/game/run.js      G.run (this run), G.meta (between runs), G.game (party, tokens, rewards, win / lose)
js/ui/hud.js, menus.js, map.js   HUD; title, pause, run over / won; map
js/main.js          loop, state machine (title, play, pause, map, over), G.debug
tools/smoke.mjs, tools/checks/*.mjs   headless test harness (not shipped)
```

## Players and input
- `G.players`: 1 to 4 `G.Player`. Player 1 has the keyboard and gamepad 0. Another gamepad joins by pressing A (Jump) while the party is in the hub.
- Actions: `left right up down jump attack dash item heal cycle interact map pause`. `p.in.held[a]`, `p.in.pressed[a]` (true for one step).
- Keyboard: arrows / WASD; Z, Space jump; X, J slash; C, K, Shift dash; V, L token; F mend; Q, E switch token; Up / W also interact; Tab map; Esc, P pause. Gamepad: stick / d-pad, A jump, X slash, B or RT dash, Y token, LB mend, RB switch, Back map, Start pause.
- Slot rule: 4 token slots for the party, `floor(4 / n)` each, remainder to player 1 (4; 2+2; 2+1+1; 1+1+1+1). `G.game.reslot()` deals tokens back out when a player joins.
- Abilities are shared run flags: `G.run.abil = { dash, grip, double, heavy }`. `G.defineAbility({ id, name, how })` adds one (it then shows on the HUD; the movement code that uses it goes in player.js).
- Health: `p.maxHp = 5 + G.run.bonusHp + G.run.mods.maxHp`. A player at 0 is `down`; downed players revive with 1 hp when the party enters a room; `G.game.lose` is a party wipe.
- `p.place(x, y, face)` moves a player and clears motion. `p.rect()`, `p.cy` (body centre y), `p.face`, `p.items`, `p.sel`, `p.slots`, `p.glow` (mend gauge).

## Combat
- `G.combat.shoot(def)` spawns a shot. Fields: `x, y` (required), `vx, vy, grav, life, r`, `hostile` (hurts players), `owner, cls, itemId, dmg` (player shots), `burst` (radius struck when the shot ends), `hug` (slides along the floor under gravity, drops off ledges, ends at walls), `tile: 'die' | 'pass'`, `rect: { w, h }` (hostile box, bottom centre on x, y, does not end on hit), `cut` (hostile, a slash destroys it), `paint(ctx, s)`, `onEnd(s)`, `color`, `trail`.
- `G.combat.strike({ x, y, r, cls, itemId, owner, dmg, vx, vy, all })`: one damaging event from a token. Tests the boss's fare slot of that cut first, then its body, then enemies (the first, or all with `all: true`). Returns `'spot' | 'body' | 'enemy' | null`.
- `G.combat.hurtPlayers(rect, fromX)`, `G.combat.clearHostile(x, y, r)`, `G.combat.dropShards(x, y, total)`.
- Slashes (in player.js) call `G.combat.melee`; damage 13 (heavy 32) x `mods.dmg`; landing a slash fills the mend gauge; a down slash on an enemy or spikes pogoes.

## Fare slots (boss weak points)
- Keyed by cut on the boss definition: `spots: { pierce: {...}, arc: {...}, burst: {...}, ground: {...} }`, at most one per cut.
- A slot opens when the fight starts only if the party carries a token of its cut; sealed slots show a grey plate and take no punches.
- 3 token hits punch a slot (`G.C.SPOT_HP`): the boss loses 20% of max hp, staggers 2.6 s, `onBreak(b)` runs, and the punching token is void (`G.run.spent`). The punched cut is added to `G.meta.cuts` (unlocks rare tokens of that cut).
- Every boss must be beatable with slashes alone.

## Template characters (G.defineRoom)
```
#  solid             .  empty             ^  spikes (hurt; a down slash bounces off)     =  one-way platform
E  ground enemy      F  flying enemy      L  ceiling enemy      I  plinth (a token)                             C  lost trunk (becomes a plinth when the room is clear)
R  ticket machine    S  kiosk ware        K  clipping booth                               M  signal post (region's ability)
H  standpipe         D  doorway           B  boss (arena)       G  region gate (hub)      ?  sign (text from signs[])    P  party start (hub)
```
- A marker stands on the tile below it: put it in the empty tile directly above a floor. The exception is L: it needs no floor, only a solid ceiling above it in the same column (the enemy climbs to the first solid tile above the marker, so put it in the empty tile just under the ceiling, within 6 tiles). L spawns an enemy defined with `ceiling: true` (the Hanging Lamp), taken from the region's `ceiling` list; it drops when a player passes under it. R needs 2 free tiles each side, K needs 3 (they spawn choices).
- Main rooms: open (`.`) on both side edges at rows 12 to 14 of the bottom cell (the floor is row 15); crossable left to right with run and jump only (a full jump rises about 4 tiles and carries about 6 across). About one D each.
- Arena: open on the left edge at rows 12 to 14, one B. The boss door is the first column from the left whose row 11 is solid and rows 12 to 14 are open; the fight starts when a player is 2 tiles past it, the door closes (a blocker) and reopens when the boss dies. The fight floor runs from the door to the first solid tile right of B on B's row: that sets `b.minX / b.maxX`.
- Branch and trial rooms: exactly one D (the way back), closed edges, a `label` naming the doorway that leads in (the map shows its first letter).
- Plinth contents: in a region's own branch room the plinth holds the region's `fixedItem` (random until that token exists) and is guarded (locked until the room is clear); elsewhere a random pool token. Kiosk ware: a token for 60 or a trinket for 40 scrip (x `mods.shopCost`). Ticket machine: three tokens, keep one; costs 30, 45, 60 ... per run. Clipping booth: choose a cut; the selected token becomes a random different token of that cut for one health pip for the run. Standpipe: full party heal, once.

## World generation
`G.worldgen.build(seed)` returns `{ seed, hub, nodes, regions, warnings }`:
- node: `{ id, def, region, exits: { left, right }, content: [one per marker], seen, parent }`; an exit is `{ to: nodeId, entry }` and entry is `{ side }`, `{ mark }`, `{ gate }` or `{ start }`.
- hub gates go to regions in order of `gate`. Per region: `length` main rooms drawn from the pool region's main templates (no repeats until the pool runs out; redrawn up to 30 times to get enough doorways), then one arena. The doorways lead to: the trial (only if the region has an ability), the pool region's own branch room, then shared branch rooms (or own branch rooms again). Unused doorways are empty. A shared branch room that holds a standpipe (H) is never drawn as an ordinary side room: the last region (the Terminus) reserves one for a doorway of its last main room when that room has one, and `graph.regions.final.pipe` names it. That room holds the run's second standpipe; with no such room the standpipe is placed in the last main room itself.
- Every room has a way back: main rooms link left and right, branch rooms have their doorway, the arena links left, and a beaten boss adds a doorway to the hub. `G.worldgen.check(graph)` returns `{ unreachable, deadEnds }`.
- Rewards are rolled with the run's rng at build time, except the ticket machine price and the Warden's trinket choice.

## Run
- `G.game.newRun(seed?)` builds the graph and enters the hub. `G.run`: `seed, rng, time, shards, abil, trinkets, spent, beaten, mods, bonusHp, tickets, rooms, over, stats, graph`.
- `G.game.win(run)` (default: `run.beaten.final`) and `G.game.lose(run)` (default: party wipe) are the replaceable rules.
- Beating a Warden (`G.game.bossBeaten`): `run.beaten[region]`, +1 health pip, +40 scrip, the door opens, a doorway back to the Junction, and three trinket plinths (take one).
- `G.meta` (localStorage `dryline-meta-v1`): `runs, wins, best, cuts`.
- Other helpers: `takeItem(p, id)` (returns the swapped-out token when the party is full), `spend(id, owner)`, `addTrinket(id)`, `addMaxPips(n)`, `partyItems()`, `partyClasses()`, `freeSlots()`, `addPlayer(pad)`.

## Recipes

### Add a token (js/content/items.js)
```js
G.defineItem({ id: 'tin_spindle', name: 'Tin Spindle', cls: 'pierce', rarity: 'rare', cd: 0.8,
  desc: 'A thin needle that passes through enemies.',
  use(p) { G.combat.shoot({ x: p.x + p.face * 14, y: p.y - 24, vx: p.face * 1000, life: 1, r: 4,
    owner: p, cls: 'pierce', itemId: 'tin_spindle', dmg: 5, color: G.CLASSES.pierce.color }); },
  drawIcon(ctx) { /* ~24 px at 0,0; optional, the cut's shape is drawn without it */ } });
```
Always pass `cls`, `itemId` and `owner` so hits reach fare slots and the right token is voided. `rarity: 'fixed'` tokens never roll; name one as a region's `fixedItem`. Colour comes from the cut unless `color` is set; keep it the cut's colour.

### Add a trinket (js/content/trinkets.js)
`G.defineTrinket({ id, name, desc, color, apply(mods) { mods.dashCd *= 0.7; }, drawIcon(ctx) })`. Mods: `maxHp, dmg, speed, dashCd, knockback, itemCd, mendTime, magnet, shopCost, revealMap` (see `G.baseMods`). A new kind of effect needs a new mod field in trinkets.js and the engine code that reads it: ask the engine lead.

### Add an enemy (js/content/enemies.js)
```js
G.defineEnemy({ id: 'brine_toad', name: 'Brine Toad', hp: 30, w: 30, h: 24, touch: 1, shards: [2, 5],
  init(e) {}, update(e, dt) { /* set e.vx, e.vy, e.face; use e.set(state, t), e.state, e.t, e.onGround, e.hitWall, e.edgeAhead(), e.target() */ },
  draw(e, ctx) { /* world space, feet at e.x, e.y; e.flash > 0 = just hit */ } });
```
Options: `flying: true` (spawns at F; add `gravity: false`), `ceiling: true` (spawns at L; its `init` finds the ceiling above its spawn point), `collide: false`, `heavy: true`. Hostile shots: `G.combat.shoot({ hostile: true, ... })`. Then list the id in a region's `enemies` (E), `flyers` (F) or `ceiling` (L). Seeded choices use `G.run.rng`.

### Add a boss (js/content/boss_<region>.js)
Copy the structure of `boss_r1.js` (it is commented line by line):
`G.defineBoss({ id, name, hp, w, h, spots: { <cut>: { name, local: [x, y], r, exposed(b), accepts(b, st), onBreak(b), lost } }, contact, init(b), pose(b), staggered(b, dt), update(b, dt), draw(b, ctx) })`.
`update` must handle `'idle'` (pick the next attack) and every state it sets; the base class owns `sleep, intro, stagger, dead`. Helpers: `b.set(state, t)`, `b.t`, `b.rage`, `b.target()`, `b.facePlayer()`, `b.toWorld(lx, ly)`, `b.shoot(def)`, `b.flags`, `b.minX, b.maxX, b.floor`. Then set the region's `boss` in regions.js. Test it with `G.debug.startBoss('<boss id>')`.

### Add a room (js/content/rooms_<region>.js or rooms_shared.js)
`G.defineRoom({ id, region, kind, w, h, label, signs, map })`, `kind` one of `hub, main, branch, trial, arena`; `map` is `17 * h` strings of `30 * w` characters. G.defineRoom reports wrong widths, unknown characters, closed exits, a missing B or a wrong D count. Each region pool needs at least: 3 main rooms, 1 arena, 1 trial (if the region has an ability), 1 branch room with a guarded plinth. Main rooms have exactly one D. Run `node tools/roomlint.mjs <region>_`, then `node tools/smoke.mjs graph`, `walk` (crosses every region's chain on 5 seeds) and `fullrun`.

### Add or finish a region (js/content/regions.js)
`G.defineRegion({ id, name, blurb, gate, boss, ability, fixedItem, enemies, flyers, ceiling, length, pool, palette })`. Every region now uses its own pool (`pool` = its id) and its own Warden (r1 tollkeeper, r2 lamp_heron, r3 switchman_idol, r4 gatewhale, final long_clock). Enemy lists follow bible section 5: `enemies` (ground, E), `flyers` (F), `ceiling` (L). The Terminus has `length: 2` (its pool holds four main rooms) and no `fixedItem`: only r1 to r4 have a guarded plinth. `palette` overrides `{ sky0, sky1, sky2, far, near, tile, side, edge, edgeHi, accent, spike }`. The hub needs one G per region.

### Add a prop type
`G.props.TYPES.<name> = { draw(pr, ctx), update(pr, dt), interact(pr, player), prompt(pr, player) }` (only draw is required; a prop can be used with Up only while `prompt` returns `[title, line, hint]`). Placing it from a template needs a new character in rooms.js and worldgen.js: ask the engine lead.

## Art hook
`G.art.draw(id, ctx, opts)` draws `G.sprites[id]` (an image or canvas) if present, otherwise the painter registered with `G.art.define(id, painter)`. Ids: `player`, `item_<id>`, `trinket_<id>`, `enemy_<id>`, `boss_<id>`, `prop_<type>`. `G.art.cutShape(ctx, shape, r)` draws a cut's shape (`G.CLASSES[cls].shape`).

## Tests
- `node tools/smoke.mjs` runs every check in `tools/checks/` in headless Chrome against `file://.../index.html` and exits 1 on any failure. `node tools/smoke.mjs <name>` runs one, e.g. `node tools/smoke.mjs punch`.
- Checks: `load, graph, rooms, walk, fullrun, punch, tokens, beaten, death, soak, coop, systems, enemies, feel, boss_r2, boss_r3, boss_r4, boss_final, screenshots` (the last writes `tools/shots/hub.png` and `boss_r1.png`).
- `walk`: for 5 seeds, every region's chain from its first room to the arena on the real graph: each main room is crossed left to right with the room validator's route search (`pageTraverse` in tools/checks/rooms.mjs, run on the real node with its exits shut during the search), the bot then leaves through the right edge and must land in the next node; the arena is crossed to the boss door and the fight must start.
- `fullrun`: for 5 seeds, a whole run on the real graph in god mode: gate from the hub, every main room left by its exit, every doorway entered once and left by its way back, the signal posts taken, each Warden woken and beaten (pip, 40 scrip, three trinket plinths, way back), the Long Clock's health = base less 12% per Warden beaten, the win screen with stats. Every room entered draws one frame (`G.rooms.draw`, `G.hud.draw`) without error, and the same seed twice gives the same graph.
- A check is `export default async ({ page, shots }) => { ... }`; throw to fail, return a short note to print. It drives the game only through `G.debug` and reads `G.debug.state()` (and public registries such as `G.itemDefs`). Page errors, console errors and `G.errors` fail it.
- `G.debug`: `newRun(seed)`, `gotoRoom(key)` (node id, template id, region id, or `'kind:region'` such as `'arena:r1'`), `give(itemId, playerIndex)`, `unlockAll()`, `setInput(playerIndex, { action: bool })` (held until changed), `step(n)`, `startBoss(regionOrBossId)` (party placed inside, door shut), `state()`, `god(bool)`, `addPlayer()`, plus `place(i, x, y, face)`, `holdBoss(fields | null)` (pins the boss and stops its attacks) and `probe(i)` (`{ wall, gap, onGround }` for bots). Any call that changes the game switches to manual stepping: afterwards only `step(n)` advances it.

## Room validator
Run it on your own rooms before handing them over: `node tools/roomlint.mjs <substring>` (every room whose id contains the substring; no argument = all). One line per room; a failure prints what is wrong and where. `--lint` skips the bot; `--file draft.js` loads an extra script of `G.defineRoom` calls first. It also runs inside `node tools/smoke.mjs rooms` (all rooms, about a second for 15, well under a minute for 50).
- **Lint** (tools/checks/rooms.mjs): 30 x 17 per cell; known characters only; closed borders except the standard exits (main: left and right at rows 12 to 14 of the bottom cell, arena: left, the hall row above may be open; branch, trial, hub: none); the right D count, label and markers per kind (arena: one B and a boss door; trial: one M; B, G, P, M only where they belong); every ground marker has solid or one-way ground under it, headroom, and R / K have their free floor; a floating F is not wedged in a wall; an L has a solid ceiling above it (warning if more than 6 tiles up); a floor and headroom at each entrance; no spikes within 2 columns of an entrance or doorway; `needs` names real abilities. Warnings (do not fail): a main room with no D or more than 2, missing sign texts, a boss floor under 10 tiles.
- **Traversal bot**: runs the real engine through `G.debug` with enemies and props removed and the room's `needs` abilities on (`needs: ['double']` on a branch room; main, trial and arena rooms must be base moves only). Main: left entrance to right exit and back. Branch and trial: doorway to every plinth, trunk, machine, kiosk, booth, standpipe and signal post, and back. Arena: entrance to past the boss door. First a cheap run-and-jump pass, then a seeded beam search over 8-step input segments (direction x jump x down-slash, plus dash when allowed) scored by tile-path distance to the goal. A found route is replayed from a fresh start to prove it. On failure it prints the furthest point reached, the path left, and the wall height or gap width in the way.
- Blind spots: it does not use Heavy Cut or wall tricks beyond what the search finds; it does not interact (reaching a prop's spot counts); a down-slash bounce on spikes is a base move, so a spiked pit of any width can be crossed by chaining bounces (the output says "uses a down-slash bounce"; if you want a real barrier make it a wall or a drop that cannot be climbed); the search is not a proof, so a "stuck" room may still be passable by a very precise route (make the room easier or ask QA); enemies and hazards other than spikes are ignored.

## Fix pass notes (2026-11-14)
- Tokens: `worldgen.balance` claims ids in `graph.claimed`; `G.game.spareTokens(cls, stock)` lists what may still be offered; sources fall back to a trinket, then 40 scrip (`lootData`).
- Aim: arc tokens read `aimOf(p)` (up, fwd, down, neutral) and a `LOB` table per token.
- Regions: `scale {hp, aggro}` is applied to enemies at room instance; `intro {maxEnemies, calm, avoid}` shapes the first main room. `C.BOSS_GRACE`, `C.KILL_MEND` in util.js.
- UI: `G.menus.pauseStep` (pause menu), `G.tips` (one-line tips, device wording via `G.input.name`), `G.props.layoutPrompt` (wrapped, clamped prompts). Blur and hidden tab call the auto-pause in main.js.
- Checks: new `prompts`, `pause`, `tips`, `tokens_unique`, `arc_reach`, `arena_escape`, `r1_bot`, `page_fit`, `sprites`. Under file:// the game canvas is tainted: checks must record draw calls, not read pixels.
