# The Dry Line (working title)

A 2D action platformer for 1 to 4 local players, written in plain JavaScript for the browser. No build step and no dependencies.

## Play
Open `index.html` in a browser. Keyboard: arrows or WASD to move, Z or Space to jump, X or J to slash, C, K or Shift to dash, V or L to use a token, Q or E to switch token, F to mend, Up at doors and props, Tab for the map, Esc to pause. Controllers work too (player 1 uses the first connected controller, whatever its number); players 2 to 4 join with a controller. F2 switches the watercolor player test (all players; 2 to 4 wear a coloured marker).

Rules in short: the party carries three tokens (four with four players). Each Warden has three fare slots, chosen per run by a lock chart (board in the Junction, map, gates); the fourth cut has none. A slot opens only if you carry a token of its cut when the fight starts; three hits punch it (10% of the Warden's health, a stagger, one attack lost, token void). Each extra player adds 60% to a Warden's health. Every fight is graded when it ends: Beaten, Par (faster than the Warden's par time) and Clean (nobody was hit); a Clean fight gives one punched token back (a free slot, or a plinth on the arena floor), and grades show on the map and the end screens. The Long Clock does not weaken as Wardens fall: it borrows one attack from each Warden still alive (the Terminus gate and the map say which), so going straight to it is the hardest road. Each line's guarded plinth needs the move from the previous line (Wreck Quay: Heavy Cut, Signal Reef: Dash, Salt Cutting: Wall Grip, Ticket Hall: Double Jump); the doorway and the map say so before you walk in. Tokens come from four guarded plinths, two lost trunks and one ticket machine (30, then 45 scrip); the kiosk sells trinkets only. The pause and run-over screens show a run code; opening the page as `index.html#CODE` replays that world, chart and rewards.

## State of this snapshot (14 November 2026)
- All 39 automated checks pass, including a scripted full run from the hub to the last boss, a room validator, boss fairness bots, co-op and performance checks.
- It includes the QA and balance pass, the original item art, and the fixes for an independent tester's findings.
- No person has play-tested it yet. Difficulty and feel are tuned by bots only.
- Known weak spots are listed in `docs/STATUS.md`.

## Where things are
- `index.html`, `css/`, `js/`: the game. `js/core` and `js/game` are the engine, `js/content` is bosses, enemies, tokens, rooms and regions, `js/ui` is the HUD and screens, `js/art` loads sprites.
- `assets/`: original token and trinket art (SVG sources and PNG exports).
- `docs/GAME_BIBLE.md`: theme, regions, bosses, enemies, tokens, economy, feel targets.
- `docs/ARCHITECTURE.md`: how the engine works and how to add a boss, enemy, token, room or region.
- `docs/ART_GUIDE.md`: the art style rules.
- `docs/STATUS.md`: what is done, what is broken, what is next.
- `tools/`: the test harness. `node tools/smoke.mjs` runs every check in headless Chrome (needs Node and Playwright; paths are set for the machine it was built on and may need changing).
- `reference/prototype.html`: the first single-file prototype.

## Credits
Design direction: Joseph Moure. Code, art and documents were produced by Claude (Anthropic) and worker agents under his direction. All names and art are original. If this is published on a store, its AI-use disclosure rules apply.
