# Status (updated 2026-11-14)

## Done
- Engine, content and tools: see docs/ARCHITECTURE.md (matches the code).
- Rooms: every region has its own pool and is wired to its own Warden: r1 Wreck Quay, r2 Signal Reef, r3 Salt Cutting and r4 Ticket Hall (6 main rooms each, one doorway per main room, a trial room with the signal post, a branch room with the guarded plinth, an arena), the Terminus (4 main rooms, arena, `length: 2`), the shared rooms (2 ticket machine rooms, 2 kiosk rooms, 2 clipping booth rooms, a standpipe room used before the Terminus arena) and the Junction (5 gates, start, standpipe, 3 signs). 49 rooms, all pass `node tools/roomlint.mjs`.
- Engine change: `L` template marker and `ceiling: true` enemies (the Hanging Lamp), region field `ceiling`; 3 lamps in r2 rooms and 3 in r3 rooms.
- Worldgen: the Terminus's standpipe sits in a shared branch room off its last main room.
- Checks: `walk` crosses every region's chain on the real graph; `fullrun` plays a whole run (5 seeds) to the win screen; `tokens` and the boss checks no longer patch regions. `node tools/smoke.mjs` passes all checks.

## QA pass (2026-11-14)
- Rooms: `node tools/roomlint.mjs --strict` (and the `rooms` check) now requires every main room to be crossable both ways, reaching every D and C, by run and jump only, with a weakened player (run 94%, jump 98.5%). Fixed: r1_chain, r1_tunnel, r1_dock, r3_terraces, r4_balcony, final_tower (small ledge/plank changes), r4_baggage and r1_hold (enemy next to a wall), hub junction (platforms crossed the gate labels).
- Enemies: ground markers deal from a shuffled bag per kind (a room no longer rolls one enemy everywhere); main rooms capped at r1 2-3, r2/r3 3-4, r4 3-5, Terminus 4-5 (extras thinned, most repeated kind first).
- Bosses: new check `bosses_fair` (about 4 min; knobs BOSS, ATTACK, TRIALS, NOFIGHT, VERBOSE) with `tools/lib/fightbot.js`: each attack alone must be dodged 75% of trials by a move/jump/dash bot, tells at least 0.45 s (0.35 enraged), a slash-only human-like fight must win in 150 s or less and leave 1 s open per cycle. Tuned: r1 leap tell 0.5 s, spit recover 0.85 s; r2 hp 720 and peck lock at 0.5 s (0.4 enraged); r3 hp 720. Simulated slash-only fights: 59, 60, 60, 86, 77 s.
- Visuals: `node tools/sheets.mjs` writes contact sheets to tools/shots/ (rooms per region, screens.png, palettes.png; `--full <roomId>`, `--screens-full`). Removed amber and teal from scenery and fx (glob, sparks, boss death, motes, props); player 4 colour moved off the Ground pink; priced-ware tags hide while a prompt shows; prompts get a backing panel.
- Co-op: `coop_play` (2, 3 and 4 players cross three rooms, strand and revive a player, fight the r1 Warden): slot rule, pull-back and revive hold, no errors.
- Performance: `perf` check; average step+draw 2.6 to 3.5 ms in every boss fight with 4 players and in the busiest room (headless software canvas, about 700 canvas calls per frame). Headless shows a roughly 100 ms flush every 43 frames that trivial drawing does not, so it is probably the software rasteriser; unverified on a real GPU.

## Open
- Weak spots: a player cornered between boss and wall cannot hop a wide boss body (r1 charge, r4 spin); fight lengths are simulated, not played by a person; hub, r1 and r4 skies are close in hue; jobs 7 (prop reuse, soft locks) rely on the existing systems, tokens and fullrun checks only.
- Final arena and the Long Clock belong to the boss_final worker (js/content/boss_final.js, the arena in rooms_final.js, tools/checks/boss_final.mjs).
- Art pass (sprites through G.art), UI polish, independent play-through, publishing.
- Difficulty is untuned by hand: see the report notes (r4 and the Terminus have 4 to 5 enemies per room; r3 rolls toads at every ground marker).

## Fix pass (2026-11-14, ten tester findings)
1. Prompts: `G.props.wrap` and `layoutPrompt` wrap to 340 px and clamp the panel inside the screen (check `prompts`: every prop and tip).
2. Pause is a menu (Resume, Restart run, Quit to title) in js/ui/menus.js: selected row highlighted, confirm step for Restart and Quit, controls shown in the words of the last device; the window blur or a hidden tab pauses (js/main.js). Down+Slash no longer quits. Check `pause`.
3. Tokens are unique per run: `balance` draws trunks, ticket choices, booth stock and kiosk wares after trimming, from ids not held, void or claimed (`graph.claimed`); when the pool is dry a trinket or scrip is offered (`lootData`, `G.game.spareTokens`, `G.items.roll` returns null). The seed still reproduces the run. The pool is spent by the kiosk draw, so the booth usually has no stock and gives a trinket or scrip (by design, the prompt says so). Check `tokens_unique` (80 graphs).
4. Arc tokens are aimed by what is held (`aimOf` in js/content/items.js): the Ladle lands about 131 px ahead by default, Up lobs it high, the facing direction throws it far, Down drops it close; the Kettle and Skipstone have the same table. Every Warden's arc slot is reachable with each arc token (`arc_reach`). Old checks `tokens`, `punch`, `boss_r3`, `boss_final` now aim with a held direction.
5. r1 is gentle: region `scale {hp 0.8, aggro 0.85}` and `intro {maxEnemies 2, calm 8}` (regions.js), applied in `Enemy.applyScale` and worldgen; kills give `C.KILL_MEND`; bosses wait `C.BOSS_GRACE` (1.5 s) after the intro. r1_chain and r1_dock planks were widened. Check `r1_bot` (plain bot crosses r1's three rooms alive: 10 of 12 seeds in the check, 32 of 40 in a wider sweep).
6. Every arena has a perch 3 tiles up against both walls (r1 to r4 rows 12 and 10; the Terminus already had them). Check `arena_escape` (bot).
7. One-line tips shown once each (`G.tips` in js/ui/hud.js: token, mend, bounce, fare), wording by `G.input.last`; four hub signs say where tokens come from. Check `tips`.
8. The strict validator passes r2_tower, r3_brines and all 49 main rooms in both directions; none needed the bounce (the tester ran the non-strict mode, which finds bounce routes). Strict mode now also rejects slashes and tests the D/C jobs both ways.
9. Page: header holds the notes, `.frame` scales to the window, no scrolling (check `page_fit`: 9 window sizes from 1100x700 down to 480x800); the HUD draws after the room with opaque slot cells and corner plates.
10. Sprites: `sprites.js` adds an entry only after the image is decoded (`G.spritesPending`), so the code-drawn icon shows until then and there is no flicker; the map's "Tokens held" row now uses the sprites. Check `sprites` records draw calls (the canvas is tainted under file://, pixels cannot be read).
- Full suite: `node tools/smoke.mjs` passes all 31 checks.
- Old checks repaired: `systems` (tickets may hold trinkets or scrip, booth stock, pause menu), `boss_r4` (crabs are swept a step after the boss dies).

## Open
- Weak spots: a player cornered between boss and wall cannot hop a wide boss body (r1 charge, r4 spin); fight lengths are simulated, not played by a person; hub, r1 and r4 skies are close in hue; r1's plain bot loses about 1 run in 5.
- Art pass (player, enemies, bosses, tiles) following docs/ART_GUIDE.md; independent play-through; publishing (the published artifact predates all of this; do not publish until the suite passes).

## Paused by Joseph: 2026-11-14, 12:48 Pacific (usage high)
- Published build and GitHub (JDMomo/TheDryLine, main, commit 4d99bed) are current: 31 of 31 checks pass.
- Outside audit ("Second Rail") in /home/claude/audit/: design director done (design/AUDIT.md, bible/01_design.md); technical director done (tech/AUDIT.md, bible/02_tech.md); art, audio and market director (agent aa4d9270a3bedf2ba) was STOPPED part-way: resume it with SendMessage or restart it. Its targets: art/AUDIT.md and bible/03_art_audio_market.md.
- Not yet done: the CEO's accept / reject / defer decisions on the audits; nothing from the audits has been implemented.
- Usage rules from Joseph: stop at about 90% of the usage window, never 100%. One worker at a time. No polling loops: start a worker, end the turn, continue when it reports.

## 2026-11-14, design pass: lock chart, scarcity, smaller punches (design engineer)
Done after the outside design audit (/home/claude/audit/design/AUDIT.md: the token decision was never hard) and the confirmed bugs of the technical audit.
1. **Lock chart.** `G.worldgen.rollChart(seed)`: each of the five Wardens has fare slots for three of the four cuts. The four main Wardens lock a different cut each (so every cut is locked on at least one Warden and no two charts match); the Long Clock locks a random one. A locked cut has no slot (not built, not drawn, not in the boss bar, not punchable). Shown on a `board` prop in the Junction just right of the party start, on each region's map row ("Lock chart:") and in the gate prompt ("Slots: ...").
2. **Scarcity.** Party carries 3 tokens (`C.SLOTS`; 2 players 2+1, 3 players 1 each, 4 players 1 each). Sources: four fixed plinths, two lost trunks, one ticket machine (usable twice, 30 then 45; the stand clears and the machine comes back after a ticket is taken). Kiosk sells three trinkets (40 scrip) only. The clipping booth is out of worldgen and the two booth rooms are gone from rooms_shared.js; booth and clip prop code stays in props.js, unused.
3. **Punch** takes 10% of max hp (`C.BREAK_FRAC`). Stagger and the lost attack unchanged.
4. **Co-op.** Max hp x (1 + 0.6 per player beyond the first) in `Boss.start()`.
5. **Bugs.** (a) Scrip on the floor is collected when the party leaves a room (`G.combat.leave`), and a boss dying no longer wipes it. (b) Player 1 uses `pad: 'first'`: the first connected controller at any index; a second controller joins as player 2. (c) A run code (seed + unlocked cuts, e.g. `1K9Z-5`) is recorded at start (`run.cuts`, `run.code`), the world is built from those alone, shown on the pause and run-over screens, and `newRun(code)` / `index.html#CODE` replay the same graph, chart and Warden trinket choice (own stream per region). Not yet covered: enemy behaviour and kill scrip amounts still draw from the shared `run.rng`, so fights are not replays.
6. Wording: hub signs, tips, the notes under the game, README, bible sections 3, 4, 8, ARCHITECTURE.
- **Rebalance** (boss hp, fight bot of `bosses_fair`, new check `fight_len`; seconds with slashes alone / with all three charted slots punched at once): Tollkeeper 420 -> 720 (63 / 37), Lamp-Heron 720 -> 960 (87 / 33), Switchman Idol 720 -> 1050 (81 / 33), Gatewhale 500 -> 700 (99 / 58), Long Clock 760 -> 1300 (125 / 71; with all four Wardens beaten, 676 hp: 71 / 31); re-measured 2026-11-14 on seed 77 by `fight_len`. With the old hp the punched fights lasted 16 to 23 s because three punches now cost 30% hp plus 7.8 s of stagger and three lost attacks.
- New checks: `chart`, `run_code`, `pad_scrip`, `fight_len`. Old checks updated: `punch`, `coop`, `coop_play`, `systems`, `tips`, `tokens_unique`, and the boss checks (they set `G.debug.fullCharts`).
- Open: nobody has played this; the punched fight times are the bot's lower bound (real punches take time to line up). Ticket machine reuse and hub board placement are untested by a person.

## Paused by Joseph at 90% usage: 2026-11-14, 13:21 Pacific
- The design engineer (agent a4338200c2fc24bf2) was STOPPED part-way through the "lock chart and scarcity" batch (see the project doc claude/audit-decisions.md, "Accepted now"). The working tree has its uncommitted, unfinished edits: do not publish or push it until that batch is finished and the full suite passes. Resume it with SendMessage, or `git stash` / `git checkout .` to return to commit 4d99bed.
- Published build and GitHub main are still commit 4d99bed (31 of 31 checks passed).

## 2026-11-14, batch finished and art test (design engineer, second hand-over)
- The batch above was finished and verified: the full suite passes (see the final line of the run). Board moved to the right of the party start and made smaller so it no longer covers the gate labels.
- Art test: the owner's watercolor strips (assets/player/idle.png 4 frames, run.png 8 frames, 112 x 96, feet 2 px above the bottom) are drawn for player 1 through new `G.art.drawFrame` (js/core/art.js, loaded in js/art/sprites.js): idle 5 frames per second, run 12 per second, run frame 6 (most stretched) in the air or dashing, scaled to about 60 px tall. The code-drawn body and scarf are hidden while it is on; slash arcs and effects stay. F2 switches it off and on (one line in the notes under the game); missing files fall back to the code-drawn player. New check `art_test`; shot tools/shots/art_test_player.png. The fringe of the cut-out is slightly light on dark floors; otherwise it reads well at game size.
