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
js/core/input.js    G.input: devices (keyboard, gamepads) + bindings -> per-player { held, pressed, forced, dev }; join, leave, remap, names
js/core/fx.js       G.fx: spark, dust, ring, ghost, floatText, say (banner), jolt(hitstop, shake)
js/core/tiles.js    G.tiles: current grid, solid / spike / oneway / floorAt, moveBox(o, dx, dy), wallDir(o), blockers
js/core/camera.js   G.cam.follow(dt, x, y, snap)
js/core/art.js      G.art: draw(id, ctx, opts) sprite hook, hasStrip(id) and drawFrame(id, ctx, n, opts) for multi-frame strips (G.strips; js/art/sprites.js loads assets/player/idle.png 4 frames and run.png 8 frames; F2 toggles G.artTest), define(id, painter), palette(regionId), cutShape, label, backdrop, tiles
js/game/player.js   G.Player, G.players, G.defineAbility, G.abilityDefs
js/game/combat.js   G.combat (shoot, strike, melee, hurtPlayers, clearHostile, dropShards), G.shots, G.pickups, G.MATERIALS (the tags), G.materials (the rules, chips, clouds and puddles)
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
- `G.players`: 1 to 4 `G.Player`. Each player owns exactly one device (`p.in.dev`): `'kb'` (the keyboard counts as one device), `'pad:N'` (gamepad index N, any index) or `null` (tests: forced input only). On the title screen the first device to press a button (`G.input.claim()`) is player 1. In the Junction any other device joins as the next player by pressing Jump (`G.input.takeJoin(devicesInUse)`, up to four). Holding Pause for one second in the Junction removes that player (`G.game.removePlayer`; a shorter press opens the pause menu on release; the last player cannot leave). Quitting to the title empties the party (`G.game.resetParty`).
- Hot-plug and focus: if a joined controller is no longer connected (`G.input.lost()`), the game pauses with the player named (`G.menus.lost`); it resumes when that controller is back, or when a device nobody uses presses a button (it becomes that player's device). Losing window focus or hiding the tab releases every key; a key still held is picked up again by the browser's auto-repeat (repeat events are accepted).
- Actions: `left right up down jump attack dash item heal cycle interact map pause`. `p.in.held[a]`, `p.in.pressed[a]` (true for one step), `p.in.forced[a]` (set by `G.debug.setInput`). `interact` is not bound on its own: it is whatever Up is.
- Defaults. Keyboard: arrows / WASD; Z, Space jump; X, J slash; C, Shift, K dash; V, L token; F mend; Q, E switch token; Up / W also interact; Tab map; Esc, P pause. Gamepad: stick / d-pad, A jump, X slash, B or RT dash, Y token, LB mend, RB switch, Back map, Start pause.
- Bindings (js/core/input.js is the only file that knows key codes and `navigator.getGamepads`): `G.input.bindings(type)` ('keyboard' or 'gamepad') = defaults plus the overrides in `G.meta.bindings[type]` (`{ action: [codes] }`, key codes or button indices). `G.input.bind(type, action, code)` returns `{ ok, msg }`, refuses a code another action uses (and Esc / Start, which always pause and cancel a rebind), saves in the meta save (inside try/catch like the rest). `G.input.resetBindings(type)`. `G.input.label(type, action)` and `G.input.name(action, player | type)` give the wording ("Z or Space", "LB") from the live bindings and, where the browser has `navigator.keyboard.getLayoutMap()`, the key's printed letter. Prompts and tips use the device type of that player (`name(a, p)`) or of the device used last (`G.input.last`, for tips).
- Pause menu (js/ui/menus.js): Resume, Controls, Comfort, Restart run, Quit to title. Controls lists every action for the kind of device that opened the menu (`G.menus.menu.type`), Jump on a row listens for the next key or button (`G.input.capture`), `reset` restores that type's defaults. Comfort: `G.meta.settings = { shake, reduceFlashes }` (screen shake off: `G.fx.jolt` never shakes; reduced flashes: no blinking while hurt, no white body flash on a hit, `G.fx.flashT`).
- `G.input.makeState({ dev })` registers a state; `G.input.any` (dev `'*'`) is the union of every device, used by menus. `G.input.poll()` reads the pads once per frame; tests that stub `navigator.getGamepads` call it themselves.
- Slot rule: `C.SLOTS = 3` token slots for the party: 1 player 3; 2 players 2 + 1; 3 players 1 each; 4 players 1 each (4 in all). `G.game.reslot()` deals tokens back out when a player joins.
- Abilities are shared run flags: `G.run.abil = { dash, grip, double, heavy }`. `G.defineAbility({ id, name, how })` adds one (it then shows on the HUD; the movement code that uses it goes in player.js).
- Health: `p.maxHp = 5 + G.run.bonusHp + G.run.mods.maxHp`. A player at 0 is `down`; downed players revive with 1 hp when the party enters a room; `G.game.lose` is a party wipe.
- `p.place(x, y, face)` moves a player and clears motion. `p.rect()`, `p.cy` (body centre y), `p.face`, `p.items`, `p.sel`, `p.slots`, `p.glow` (mend gauge).

## Combat
- `G.combat.shoot(def)` spawns a shot. Fields: `x, y` (required), `vx, vy, grav, life, r`, `hostile` (hurts players), `owner, cls, itemId, dmg` (player shots), `burst` (radius struck when the shot ends), `hug` (slides along the floor under gravity, drops off ledges, ends at walls), `tile: 'die' | 'pass'`, `rect: { w, h }` (hostile box, bottom centre on x, y, does not end on hit), `cut` (hostile, a slash destroys it), `paint(ctx, s)`, `onEnd(s)`, `color`, `trail`.
- `G.combat.strike({ x, y, r, cls, itemId, owner, dmg, vx, vy, all })`: one damaging event from a token. Tests the boss's fare slot of that cut first, then its body, then enemies (the first, or all with `all: true`). Returns `'spot' | 'body' | 'enemy' | null`.
- `G.combat.hurtPlayers(rect, fromX)`, `G.combat.clearHostile(x, y, r)`, `G.combat.dropShards(x, y, total)`.
- Slashes (in player.js) call `G.combat.melee`; damage 13 (heavy 32) x `mods.dmg`; landing a slash fills the mend gauge; a down slash on an enemy or spikes pogoes.

## Materials (js/game/combat.js, bible section 8)
- `G.MATERIALS`: heavy, metal, flammable, wet, slick, brittle, magnetic, spark (name, chip colour, hint). `def.mat` on items and trinkets, `def.inter` the card line. `G.materials.drawChips(ctx, tags, x, y, align)` draws the small labelled chips (used by the plinth and kiosk prompt through a fourth prompt element `{ tags, line }`, the HUD's selected token, the map's token row); `chipsWidth`, `tagsOf(id)`, `line(id)`.
- Rules (all fixed, no randomness): `G.materials.ignite, flare, spark(x, y, r, src), douse, shatter, park, conduct, slash, pullTarget`, with clouds (`cloud(x, y, owner, r, life, cls, itemId)`) and brine puddles (`puddle(x, y, owner, r, life)`). They run from `G.combat.update` (shots meeting shots, Pull, Stop, hurt detection for Anchor and Crack by watching `p.hp`), `G.combat.strike` (Conduct) and `G.combat.melee` (Kick, Punt, Shatter, a slash's spark). Each firing calls `G.materials.word` (floating word) and counts in `G.materials.fired`; `G.materials.frags` counts fragments, `counts()` clouds, puddles, bolts; `reset()` clears all of it (tests).
- Run flags read: `G.run.mods.anchor, conduct, magnetic, slick, punt, spark` (set by trinkets). Clouds, puddles and bolts clear when the party leaves a room. Fragments are shots with `frag: true`; a shot with `parked` is a Stopped roller, `ignited` a lit one.
- Test: `node tools/smoke.mjs materials` (tags and cards, 12 interactions triggered with G.debug, each scenario twice for equal results, cuts unchanged).

## Fare slots (boss weak points)
- Keyed by cut on the boss definition: `spots: { pierce: {...}, arc: {...}, burst: {...}, ground: {...} }`, at most one per cut. A definition still holds all four, but a boss built in a run keeps only the three cuts on its lock chart (`G.run.graph.chart[region]`, also `b.chart`); the fourth has no entry in `b.spots` (never drawn, listed or punchable). Boss code must not index `b.spots` by position (use `b.spots.find(s => s.cls === ...)`) and must not assume a cut's slot exists.
- **Lock chart**: `G.worldgen.rollChart(seed)` (called by `build`, stored as `graph.chart`) gives every region `[cut, cut, cut]`. The first four regions (by gate) each lock a different cut (so every cut is locked on at least one Warden and no two share a chart); the rest lock a random cut. Shown by the hub prop `board`, the map's row per region and the gate prompt.
- A slot opens when the fight starts only if the party carries a token of its cut; sealed slots show a grey plate and take no punches.
- 3 token hits punch a slot (`G.C.SPOT_HP`): the boss loses 10% of max hp (`C.BREAK_FRAC`), staggers 2.6 s, `onBreak(b)` runs, and the punching token is void (`G.run.spent`). The punched cut is added to `G.meta.cuts` (unlocks rare tokens of that cut).
- Co-op: `Boss.start()` multiplies max hp by `1 + C.COOP_HP * (players - 1)` (0.6 per extra player). A boss that sets its own hp when the fight starts (the Long Clock; its health no longer depends on Wardens beaten, it borrows attacks instead: `b.borrowed`, `G.game.borrows()`) must reset `this.scale = 1` after doing so.
- Every boss must be beatable with slashes alone. Boss health is balanced with `tools/checks/fight_len.mjs` (slashes alone win in 150 s or less; all three charted slots punched takes at least 30 s).

## Template characters (G.defineRoom)
```
#  solid             .  empty             ^  spikes (hurt; a down slash bounces off)     =  one-way platform
s  slippery salt crust (solid; Wet dissolves it)    m  mud (solid; slows movement)    >/<  conveyors (solid; push grounded bodies)
t  hardened tar (solid; spark/fire burns it away for that live room)
c  crumbling ledge (0.45 s warning, then gone until its 2.6 s rebuild timer has elapsed and the tile volume is clear)
j  launch spring (launches players/enemies upward)   v  timed steam vent (deterministic pulse, launches bodies in the column above)
E  ground enemy      F  flying enemy      L  ceiling enemy      I  plinth (a token)                             C  lost trunk (becomes a plinth when the room is clear)
R  ticket machine    S  kiosk ware        K  clipping booth (unused: worldgen leaves it empty, no template has one)                              M  signal post (region's ability)
H  standpipe         D  doorway           B  boss (arena)       G  region gate (hub)      ?  sign (text from signs[])    P  party start (hub)
X  cracked barrier (guarded branch rooms): a wall 3 tiles tall on the marker's tile; only a heavy cut breaks it (prop `crack`, content type `crack`)
Y  timed lever (4.5 s)     A  pressure plate (held while a player stands on it)     Z  mechanical gate paired to Y/A in that room
Q  short-span rail cart; rides over a safe floor and carries grounded players/enemies on its deck
```
- Terrain mutations are per live room instance: Wet puddles can dissolve `s` into empty space without changing the reusable room template. Grounded regular enemies share mud/conveyor motion with players, so terrain can shape encounters as well as traversal.
- A marker stands on the tile below it: put it in the empty tile directly above a floor. The exception is L: it needs no floor, only a solid ceiling above it in the same column (the enemy climbs to the first solid tile above the marker, so put it in the empty tile just under the ceiling, within 6 tiles). L spawns an enemy defined with `ceiling: true` (the Hanging Lamp), taken from the region's `ceiling` list; it drops when a player passes under it. R needs 2 free tiles each side, K needs 3 (they spawn choices).
- Main rooms: `route: [entrySide, exitSide]` declares two route ports (`left`, `right`, `top`, `bottom`); omitted means `['left','right']`. Left/right use rows 12 to 14 of the bottom cell. A top/bottom port is one contiguous opening of at least 3 `.` tiles in that edge row. Required routes stay crossable both ways with base movement; Wall Grip/Double Jump may provide faster or reward routes without gating a Warden. About one D each.
- Arena: open on the left edge at rows 12 to 14, one B. The boss door is the first column from the left whose row 11 is solid and rows 12 to 14 are open; the fight starts when a player is 2 tiles past it, the door closes (a blocker) and reopens when the boss dies. The fight floor runs from the door to the first solid tile right of B on B's row: that sets `b.minX / b.maxX`.
- Branch and trial rooms: exactly one D (the way back), closed edges, a `label` naming the doorway that leads in (the map shows its first letter).
- **Guarded rooms** (a region's own branch room, the fixed token's plinth) declare `needs: ['<ability>']` in `G.defineRoom`: r2 `dash`, r3 `grip`, r4 `double`, r1 `heavy` (the unlock of the previous region in the ring). The validator proves both directions: the plinth is reachable with the ability and not reachable with base moves only (a room with `needs` must hold an I; one `needs` entry; heavy rooms need an X and vice versa). Rooms of other kinds must stay finishable with base moves. Keep a real barrier real: no spike pit (a down-slash bounce chain crosses any width) unless its far wall is too tall to leave, and give the bot a route it can find (the beam search has a scripted dash opening, section Room validator). Worldgen puts `needs` and a `Needs <move>` tag on the doorway into the room; `G.worldgen.needsText(defId)` words it for the map and the door prompt.
- Plinth contents: in a region's own branch room the plinth holds the region's `fixedItem` (random until that token exists) and is guarded (locked until the room is clear); elsewhere a random pool token. Kiosk ware: a trinket for 40 scrip (x `mods.shopCost`); the kiosk sells no tokens. Ticket machine: three tickets (tokens first), keep one; one machine per run, usable twice (`data.choices`, then `data.next`): 30 scrip, then 45. It hides while its tickets stand and returns when one is taken. Clipping booth (and its `clip` prop): code kept in props.js, no longer placed in any run. Standpipe: full party heal, once.

### Route-design contract
- Rebuilt main rooms should expose three readable choices where space permits: a **safe low/base route**, a **harder high/fast route**, and an **optional reward/secret pocket**.
- The safe route is the validator contract: reversible with base movement, no required damage, no required crumble timing, no mandatory spring/vent, and no unlock ability.
- High routes may use tighter jumps, one-way shelves, conveyors, springs, steam or crumble, but must rejoin the main route and must not become the only Warden path.
- Reward pockets may contain a lost trunk/other optional source but must always allow escape back to the main room. They must not be required for worldgen connectivity.

### Regional terrain direction
- Wreck Quay: mud/low hazards, hardened tar pockets, and short-span maintenance rail carts; safer low paths trade speed for footing. `r1_dock` is the worked split-route example: slow mud floor, crumble high line, separate spring reward alcove.
- Signal Reef: vertical shafts and one-way shelves; `r2_shaft` keeps a base-move zig-zag while timed steam vents create a faster risky center line and Wall Grip remains the cleanest expert shortcut.
- Salt Cutting: slippery/dissolvable salt and exposed ledges; `r3_trestle` uses salt-over-solid for the safe floor, a crumble rail line above, and a separate spring survey pocket.
- Ticket Hall: conveyors and mechanical gates; `r4_concourse` uses opposing belts on the safe floor, a fast canopy route above them, and a separate maintenance reward pocket. `r4_switchyard` keeps the low route permanently open while a timed lever and co-op pressure plate control an optional upper shortcut.

## World generation
`G.worldgen.build(seed)` returns `{ seed, hub, nodes, regions, warnings }`:
- node: `{ id, def, region, exits: { left?, right?, top?, bottom? }, content: [one per marker], seen, parent }`; an edge exit is `{ to: nodeId, entry: { side } }`. Main templates declare `route: [entrySide, exitSide]`; old rooms default left -> right. Other entries remain `{ mark }`, `{ gate }` or `{ start }`.
- hub gates go to regions in order of `gate`. Per region: `length` main rooms drawn from the pool region's main templates (no repeats until the pool runs out; redrawn up to 30 times to get enough doorways), then one arena. A region may declare an `introRoom` pinned first for onboarding and a `landmark` guaranteed into the remaining chain. Wreck Quay uses `r1_gangway` as its stable keyboard-friendly opener while `r1_dock` remains its guaranteed story/terrain landmark. The four Warden lines currently use four mains; the Terminus uses three. The doorways lead to: the trial (only if the region has an ability), the pool region's own branch room, then shared branch rooms (or own branch rooms again). Unused doorways are empty. A shared branch room that holds a standpipe (H) is never drawn as an ordinary side room: the last region (the Terminus) reserves one for a doorway of its last main room when that room has one, and `graph.regions.final.pipe` names it. That room holds the run's second standpipe; with no such room the standpipe is placed in the last main room itself.
- Every room has a way back: main rooms link their declared route ports in both directions, branch rooms have their doorway, the arena links left, and a beaten boss adds a doorway to the hub. `G.worldgen.check(graph)` returns `{ unreachable, deadEnds }`.
- Rewards are rolled at build time from the seed and the unlock set; the ticket machine price and the Warden's trinket choice come from a stream of their own (`seed` + region), so they do not depend on the route taken. Token sources per run: four fixed plinths, two lost trunks, one ticket machine (the booth is gone); `graph.chart` is rolled from the seed alone.

## Run
- `G.game.newRun(seed?, cuts?)` builds the graph and enters the hub; `newRun('1K9Z-5')` takes a run code. **Run code** = seed (base 36) + `-` + one hex digit for the unlocked cuts (bit per cut in pierce, arc, burst, ground order): `G.game.codeOf`, `parseCode`. `newRun` records the unlocked cuts in `run.cuts` (from the save only when none are given) and `G.worldgen.build(seed, cuts)` builds from those alone (`G.items.cutsOverride`; during play `G.items.pool` reads `run.cuts`, never the save). `index.html#CODE` starts that run from the title. `G.run`: `seed, cuts, code, chart, rng, time, shards, abil, trinkets, spent, beaten, mods, bonusHp, tickets, rooms, over, stats, graph`.
- `G.game.win(run)` (default: `run.beaten.final`) and `G.game.lose(run)` (default: party wipe) are the replaceable rules.
- Scrip on the floor is collected for the party by `G.combat.leave()` when it leaves a room (`G.rooms.enter`); a new run clears it.
- Beating a Warden (`G.game.bossBeaten`): `run.beaten[region]`, the fight is graded (`G.game.gradeFight` -> `run.grades[region] = { time, parTime, par, clean, refund, where }`; a boss definition has `par` in seconds; `Boss.clock`, `hits0` and `spent0` are taken when the fight starts; a Clean fight refunds the first token punched in it to a free slot (`where: 'party'`) or as a plinth on the arena floor (`'floor'`); `G.fx.stamp` shows it; `G.game.gradeText`), +1 health pip, +40 scrip, the door opens, a doorway back to the Junction, and three trinket plinths (take one).
- The Long Clock borrows an attack per Warden not beaten when its fight starts: `G.game.borrows(run)` lists `{ region, attack, warden, short, text }` (used by the Terminus gate label, its prompt and the map); `b.borrowed`, `b.attacks` (the attack bag) and the states `toll`, `beam`, `sig`, `crates` live in boss_final.js.
- `G.meta` (localStorage `dryline-meta-v1`): `runs, wins, best, cuts, taught, bindings, settings`.
- Other helpers: `takeItem(p, id)` (returns the swapped-out token when the party is full), `spend(id, owner)`, `addTrinket(id)`, `addMaxPips(n)`, `partyItems()`, `partyClasses()`, `freeSlots()`, `addPlayer(dev)`, `removePlayer(p)`, `resetParty()`.

## Recipes

### Add a token (js/content/items.js)
```js
G.defineItem({ id: 'tin_spindle', name: 'Tin Spindle', cls: 'pierce', rarity: 'rare', cd: 0.8,
  desc: 'A thin needle that passes through enemies.',
  use(p) { G.combat.shoot({ x: p.x + p.face * 14, y: p.y - 24, vx: p.face * 1000, life: 1, r: 4,
    owner: p, cls: 'pierce', itemId: 'tin_spindle', dmg: 5, color: G.CLASSES.pierce.color }); },
  drawIcon(ctx) { /* ~24 px at 0,0; optional, the cut's shape is drawn without it */ } });
```
Always pass `cls`, `itemId` and `owner` so hits reach fare slots and the right token is voided. Every token also needs `mat: [one or two tags]` and `inter: 'card line'` (G.defineItem refuses it without); `combat.shoot` copies the token's tags onto the shot (`s.mat`), which is how the rules below find it. `rarity: 'fixed'` tokens never roll; name one as a region's `fixedItem`. Colour comes from the cut unless `color` is set; keep it the cut's colour.

### Add a trinket (js/content/trinkets.js)
`G.defineTrinket({ id, name, desc, color, mat: ['slick'], inter: 'Slide: ...', apply(mods) { mods.slick = true; }, drawIcon(ctx) })`. `mat` (one or two tags) and `inter` (the card line) are required. Mods: `maxHp, dmg, speed, dashCd, knockback, itemCd, mendTime, magnet, shopCost, revealMap` and the material flags `anchor, conduct, magnetic, slick, punt, spark` (see `G.baseMods`). A new kind of effect needs a new mod field in trinkets.js and the engine code that reads it: ask the engine lead.

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
`G.defineRoom({ id, region, kind, w, h, route, label, signs, map })`, `kind` one of `hub, main, branch, trial, arena`; `map` is `17 * h` strings of `30 * w` characters. G.defineRoom reports wrong widths, unknown characters, closed exits, a missing B or a wrong D count. Each region pool needs at least: 3 main rooms, 1 arena, 1 trial (if the region has an ability), 1 branch room with a guarded plinth. Main rooms have exactly one D. Run `node tools/roomlint.mjs <region>_`, then `node tools/smoke.mjs graph`, `walk` (crosses every region's chain on 5 seeds) and `fullrun`.

### Add or finish a region (js/content/regions.js)
`G.defineRegion({ id, name, blurb, gate, boss, ability, fixedItem, enemies, flyers, ceiling, length, pool, palette })`. Every region now uses its own pool (`pool` = its id) and its own Warden (r1 tollkeeper, r2 lamp_heron, r3 switchman_idol, r4 gatewhale, final long_clock). Enemy lists follow bible section 5: `enemies` (ground, E), `flyers` (F), `ceiling` (L). The Terminus has `length: 2` (its pool holds four main rooms) and no `fixedItem`: only r1 to r4 have a guarded plinth. `palette` overrides `{ sky0, sky1, sky2, far, near, tile, side, edge, edgeHi, accent, spike }`. The hub needs one G per region.

### Add a prop type
`G.props.TYPES.<name> = { draw(pr, ctx), update(pr, dt), interact(pr, player), prompt(pr, player) }` (only draw is required; a prop can be used with Up only while `prompt` returns `[title, line, hint]`). Placing it from a template needs a new character in rooms.js and worldgen.js: ask the engine lead.

## Art hook
`G.art.draw(id, ctx, opts)` draws `G.sprites[id]` (an image or canvas) if present, otherwise the painter registered with `G.art.define(id, painter)`. Ids: `player`, `item_<id>`, `trinket_<id>`, `enemy_<id>`, `boss_<id>`, `prop_<type>`. `G.art.cutShape(ctx, shape, r)` draws a cut's shape (`G.CLASSES[cls].shape`).

## Tests
- `node tools/smoke.mjs` runs every check in `tools/checks/` in headless Chrome against `file://.../index.html` and exits 1 on any failure. By default four browser processes run checks side by side (`--serial` for one, `--jobs=N`); a check that exports `shards` runs once per shard in parallel (`bosses_fair:r2:fight`, `fight_len:final4`). `node tools/smoke.mjs <name>` or `<name>:<shard>` runs one; `--fast` skips checks that export `slow = true` (`bosses_fair`, `fight_len`, `perf`); `--bail` stops after the first failure. The whole suite takes about 4.5 minutes on a two-core machine (it was over 12 minutes serial).
- `node tools/mutate.mjs` (not part of the suite): the 20 deliberate breakages of the outside audit, re-made as source patches. Each is applied to a temporary copy of the game, the fast checks run against it and a breakage counts as caught when any check fails. A control run on the untouched copy must pass first. When a bug is fixed, add its mutation to the list at the top of that file.
- Behaviour checks (they drive the game with player input only: `G.debug.setInput` and `step`, or real keyboard events and a stubbed `navigator.getGamepads`; the only setup is the room, where to stand, a starting hurt or purse): `behave_hurt` (enemy touch costs one pip and gives invincibility, a Warden's body, spikes cost a pip and return to safe ground), `behave_economy` (mend, scrip pickup, slash damage and kill drop, kiosk), `behave_feel` (coyote time, dash cooldown, co-op leash), `behave_loop` (real loop: a key starts the run, the loop advances, a hit stop ends, pause stops time), `behave_keyboard` (a keyboard-only player crosses the first room of r1). Input: `input_pad` (every button on a pad at index 0 and a lone pad at index 1), `input_party` (join, four players, leave), `input_remap` (Controls page, duplicates, reset, save, prompts), `input_robust` (focus, unplug, reconnect, takeover), `comfort`.
- `bosses_fair` is split into shards (`rN:dodge`, `rN:fight`, `final:dodge1`, `final:dodge2`, `final:fight`); each `:fight` shard also runs the three-punch fight and holds the fight length rules (it replaces most of `fight_len`; `fight_len` keeps the Long Clock with two and four Wardens beaten). `perf` judges its frame times against a calibration loop timed beside them, so it holds when several browsers share the cores.
- Added 2026-11-14 (second design pass): `unlocks`, `hub_layout`, `grades`; `art_test` covers players 2 to 4, the revive and interact strips and the dash silhouette; the room validator also runs the negative direction of every guarded room.
- Checks: `load, graph, rooms, walk, fullrun, punch, tokens, beaten, death, soak, coop, systems, enemies, feel, boss_r2, boss_r3, boss_r4, boss_final, screenshots` (the last writes `tools/shots/hub.png` and `boss_r1.png`), `chart`, `run_code`, `pad_scrip`, `fight_len`, plus the behaviour and input checks above. Checks that need every cut on every Warden set `G.debug.fullCharts = true` first.
- `walk`: for 5 seeds, every region's chain from its first room to the arena on the real graph: each main room is crossed from its declared route entry to its route exit with the room validator's search (`pageTraverse` in tools/checks/rooms.mjs, run on the real node with its exits shut during the search), then it crosses that edge and must land in the next node; the arena is crossed to the boss door and the fight must start.
- `fullrun`: for 5 seeds, a whole run on the real graph in god mode: gate from the hub, every main room left by its exit, every doorway entered once and left by its way back, the signal posts taken, each Warden woken and beaten (pip, 40 scrip, three trinket plinths, way back), the Long Clock's health = its base whatever Wardens fell, and one borrowed attack per Warden alive, each fight graded, the win screen with stats. Every room entered draws one frame (`G.rooms.draw`, `G.hud.draw`) without error, and the same seed twice gives the same graph.
- A check is `export default async ({ page, shots }) => { ... }`; throw to fail, return a short note to print. It drives the game only through `G.debug` and reads `G.debug.state()` (and public registries such as `G.itemDefs`). Page errors, console errors and `G.errors` fail it.
- `G.debug`: `newRun(seed, cuts?)` (a code string works too), `chart(region, cuts)` (replace a region's chart before its fight), `fullCharts` (flag: every region gets all four cuts), `gotoRoom(key)` (node id, template id, region id, or `'kind:region'` such as `'arena:r1'`), `give(itemId, playerIndex)`, `unlockAll()`, `setInput(playerIndex, { action: bool })` (held until changed), `step(n)`, `startBoss(regionOrBossId)` (party placed inside, door shut), `state()`, `god(bool)`, `addPlayer()` (a player with no device: only forced input), plus `place(i, x, y, face)`, `holdBoss(fields | null)` (pins the boss and stops its attacks) and `probe(i)` (`{ wall, gap, onGround }` for bots). Any call that changes the game switches to manual stepping: afterwards only `step(n)` advances it.

## Room validator
Run it on your own rooms before handing them over: `node tools/roomlint.mjs <substring>` (every room whose id contains the substring; no argument = all). One line per room; a failure prints what is wrong and where. `--lint` skips the bot; `--file draft.js` loads an extra script of `G.defineRoom` calls first. It also runs inside `node tools/smoke.mjs rooms` (all rooms, about a second for 15, well under a minute for 50).
- **Lint** (tools/checks/rooms.mjs): 30 x 17 per cell; known characters only; closed borders except declared main-route ports (left/right at rows 12 to 14 of the bottom cell, top/bottom as one contiguous opening of at least 3 cells; arena: left, the hall row above may be open; branch, trial, hub: none); the right D count, label and markers per kind (arena: one B and a boss door; trial: one M; B, G, P, M only where they belong); every ground marker has solid or one-way ground under it, headroom, and R / K have their free floor; a floating F is not wedged in a wall; an L has a solid ceiling above it (warning if more than 6 tiles up); a floor and headroom at each entrance; no spikes within 2 columns of an entrance or doorway; `needs` names real abilities. Warnings (do not fail): a main room with no D or more than 2, missing sign texts, a boss floor under 10 tiles.
- **Traversal bot**: runs the real engine through `G.debug` with enemies and props removed and the room's `needs` abilities on (`needs: ['double']` on a branch room; main, trial and arena rooms must be base moves only). Main: declared route entry to exit and back. Branch and trial: doorway to every plinth, trunk, machine, kiosk, booth, standpipe and signal post, and back. Arena: entrance to past the boss door. First a cheap run-and-jump pass, then a seeded beam search over 8-step input segments (direction x jump x down-slash, plus dash when allowed) scored by tile-path distance to the goal. A found route is replayed from a fresh start to prove it. On failure it prints the furthest point reached, the path left, and the wall height or gap width in the way.
- Blind spots: Heavy Cut is modelled as "cracked barriers X are already broken" in the with-ability run (the `unlocks` check drives a real heavy cut); it does not use wall tricks beyond what the search finds; it does not interact (reaching a prop's spot counts); a down-slash bounce on spikes is a base move, so a spiked pit of any width can be crossed by chaining bounces (the output says "uses a down-slash bounce"; if you want a real barrier make it a wall or a drop that cannot be climbed); the search is not a proof, so a "stuck" room may still be passable by a very precise route (make the room easier or ask QA); enemies and hazards other than spikes are ignored.

## Fix pass notes (2026-11-14)
- Tokens: `worldgen.balance` claims ids in `graph.claimed`; `G.game.spareTokens(cls, stock)` lists what may still be offered; sources fall back to a trinket, then 40 scrip (`lootData`).
- Aim: arc tokens read `aimOf(p)` (up, fwd, down, neutral) and a `LOB` table per token.
- Regions: `scale {hp, aggro}` is applied to enemies at room instance; `intro {maxEnemies, calm, avoid}` shapes the first main room. `C.BOSS_GRACE`, `C.KILL_MEND` in util.js.
- UI: `G.menus.pauseStep` (pause menu), `G.tips` (one-line tips, device wording via `G.input.name`), `G.props.layoutPrompt` (wrapped, clamped prompts). Blur and hidden tab call the auto-pause in main.js.
- Checks: new `prompts`, `pause`, `tips`, `tokens_unique`, `arc_reach`, `arena_escape`, `r1_bot`, `page_fit`, `sprites`. Under file:// the game canvas is tainted: checks must record draw calls, not read pixels.
