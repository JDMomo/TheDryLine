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

## Pause point: 2026-11-14, about 11:15 Pacific (usage limit, resets 2pm)
- Published build (all 19 checks passed at the time, before QA, art and fixes): https://claude.ai/artifact/95p16agX6vJmVZamusXNDf (slug 41750cd7-60e9-4932-8d05-f77cad4966a2, version 1794677217-e366). It does NOT yet include the QA pass, the item art, or the tester fixes.
- Done since then, in the working tree: QA and balance pass (strict room validator, enemy mix, boss fairness bot, visual sweep, co-op, perf); item art (assets/tokens, assets/trinkets, js/art/sprites.js, docs/ART_GUIDE.md); independent tester report (10 findings).
- The fix engineer (agent adcb51156e1875030) was cut off while fixing the tester's findings. Tree state: 23 of 31 checks pass. Failing: boss_final, boss_r3, punch, tokens (all on the arc cut after the Ochre Ladle retune: old checks stand at the old range, or the retune broke hits), boss_r4 (crabs left after the boss died), systems (ticket and booth expectations after the unique-token rule), page_fit and sprites (getImageData on a canvas tainted by file:// images: the checks must not read pixels, or must compare another way).
- Next: resume the fix engineer (SendMessage) to finish items 9 and 10 and repair those 8 checks; run the full suite; publish to the same artifact including assets/ and js/art/sprites.js; update the project handbook and bible; then the wider art pass (player, enemies, bosses, tiles) following docs/ART_GUIDE.md.
- Do not publish the working tree until the full suite passes.
