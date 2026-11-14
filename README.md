# The Dry Line (working title)

A 2D action platformer for 1 to 4 local players, written in plain JavaScript for the browser. No build step and no dependencies.

## Play
Open `index.html` in a browser. Keyboard: arrows or WASD to move, Z or Space to jump, X or J to slash, C, K or Shift to dash, V or L to use a token, Q or E to switch token, F to mend, Up at doors and props, Tab for the map, Esc to pause. Controllers work too; players 2 to 4 join with a controller.

## State of this snapshot (14 November 2026)
This is the working copy, mid-fix. It is ahead of the published build but not fully passing:
- 23 of 31 automated checks pass. The 8 failing checks and the reasons are listed at the end of `docs/STATUS.md`.
- It includes the QA and balance pass, the original item art, and about half of the fixes for the independent tester's findings.
- No person has play-tested it yet.

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
