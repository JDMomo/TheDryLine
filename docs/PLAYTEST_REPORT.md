# Playtest report, main 963366b (ChatGPT batch)

Tool: `node tools/playtest.mjs` (brain in `tools/lib/ptbrain.js`). Headless Chrome over http (a temp copy of the game, so painted art loads), real key events only (Playwright keyboard), 960x560 viewport, `--autoplay-policy=no-user-gesture-required`, `--disable-frame-rate-limit --disable-gpu-vsync`, game clock scaled x3. It reads `G.debug.state()` and the tile grid; it never acts through `G.debug`. `--assist` turns a lethal hit into a recorded continue. `--region=r2` makes it prefer a region's portal.

Runs: 1 + 6 assisted runs in Wreck Quay (r1, seeds 1-7), 2 + 1 assisted runs aimed at Signal Reef (r2, seeds 11-12, 11 again), 1 audio session (seed 5). Raw data: `tools/playtest_out/{dev,a1,a2,a3,aud}/` (`tables.md`, `run_*.json`).
Not 25 runs: the bot is slow on this tree (about 1 game-second per real second on 2 cores) and the hub is a big puzzle level it only solves with help. Treat the numbers as coverage, not statistics.

## Top 10 issues, ranked

1. **Warden art is not clean (visible, every Tollkeeper fight).** The Tollkeeper and the waystone banners in the arena sit on a speckled white/grey rectangle (an un-removed background), and the boss is a flat vector blob next to painted art. `tools/shots/playtest_s1_death3.png`, `playtest_s5_death12.png`, `playtest_s1_room_r1_arena.png`.
2. **Two banners at once on the first screen (text overlap).** In the Junction the "Timetable for this run / Fare Surge" card is drawn over the "The Last Timetable" story card and over the HUD ability labels ("Doubl..." is cut). Both unreadable until one fades. `playtest_s1_room_junction.png`. (STATUS says "one message at a time"; the run-start card is not covered by it.)
3. **Arriving over a floor hole bounces you back (possible softlock loop for a slow player).** Entering `r2_shaft` (n9) from n8's right exit, and `junction_signal_stair` (n13) from the roof hatch, places you over an open bottom port. With no input you fall back out within about 0.7 s; only an immediate Left/Jump keeps you. Hold Left+Jump stays in; Right or no input leaves. Reproduced by script (`G.rooms.enter('n9', {side:'bottom'})`); the bot ping-ponged n8/n9 about 190 game-seconds in `a3` even with its sidestep fix. Needs a safe spawn (the hub grates already do this).
4. **Hub to Signal Reef is a long puzzle with no guidance a bot could follow.** The r2 portal is a roof hatch at the top edge (cols 38-41); the bot needed about 740 game-seconds (assisted, two runs never got there) and sat "stuck" 23 times under it (`playtest_s11_stuck23.png`). A full jump from the row-4 platform clears it (rise 118 px vs 94 needed; a 12-tick tap does not, 76 px), so it is possible, but pressing Up on the "gate" prop does nothing and the sign hint is the only clue. Likely confusing for a new player.
5. **Tollkeeper is very hard without tokens, and the game does not say how to get them.** 7 of 7 r1 Warden fights: bot took 43-67 hits per fight (about one per 3 s), 6 lost to assist, only seed 5 won. The "No token of its three cuts carried. Every fare slot is sealed" line is the only hint. Hit sources: charge 46, leap 25, shots 57, idle contact 19, chargeTell 8. Telegraph for `charge` hits shows as too short to read at 90 fps game speed; bot hits during `idle` suggest body contact is punishing.
6. **Bot dwelled 120 s in r1_chain (n2) hunting a turnstile** (seed 1): the elite never lets a melee approach finish. Pacing risk: a player who wants to clear the room may do the same. Seeds 1, 3 `stuck` logs (r1_tunnel "clear room for trunk").
7. **Heavy dark masses.** Large black wall voids fill much of r1/hub screens, and the story banner sits on one (`playtest_s1_room_r1_gangway.png`). Reads as unfinished, hides the sky art.
8. **Story and area cards over the Long Clock.** "Fare slots open: Side Vent." and "The Terminus" cards overlap the clock-face halo (`playtest_s12_room_final_arena.png`, `..._gearworks.png`); room-name plate "Steam Gallery" overlaps a lamp. Cosmetic.
9. **Limiter peak above full scale once** (audio, 1.09 in one 1 s sample, RMS fine). Possible digital clip. Cosmetic/low.
10. **Draw spikes.** Mean draw cost 0.76 ms/frame, but max 518 ms (hub) and 281 ms (r2); 37 + 31 frames over 16 ms and 15 + 12 over 33 ms of about 39,000. Probably room-entry hitches (first-draw of painted art). Low.

## Softlocks
No hard softlock found. Loops seen: n8/n9 shaft ping-pong (issue 3, bot) and hub-roof hesitation (issue 4, bot). The hub to n13 to hub loop earlier was a bot misreading portals as "gate" props; fixed in the bot, not a game bug.

## Unfair hits / telegraphs
Boss hits listed in issue 5. Mud, tar, spring, crumble, mend, token and fare tips all fired once each (`G.tips`); none overlapped a banner in captured frames. Wreck Quay enemies (ballast crab, sapper, turnstile) landed 1-3 hits per run each, none looked unfair in screenshots.

## Story / UI
Story cards fire on first entry (Wreck Quay, Freight chalk, Tollkeeper, Signal Reef, Maintenance slate, Long Clock). Text is readable except for the overlaps above. "No tokens. Slashes always work." and the greyed ability labels have no explanation on the first screen.

## Frame rate
Chrome headless with vsync off ran 90+ fps on the logged machine; real-time fps was not measured on target hardware. Draw cost in issue 10. No errors: 0 console/page errors, 0 `G.errors`, 0 failed requests, 0 frames with the player undrawn, 0 empty-crop pixel checks (about 1,900 checks).

## Audio watch (real AudioContext, analyser on `G.audio.engine.limiter`, once a second)
| session | seconds sampled | max RMS | NaN | RMS above 0.3 for 3 samples | `G.audio.rebuilds` |
|---|---|---|---|---|---|
| audio, seed 5 (hub, r1 rooms, 2 standpipes, 3 doors incl. trial, trinket pickup, Tollkeeper beaten, back to hub) | 186 | 0.221 | 0 | none | 0 |
| a1 seeds 2-7, a2, a3 (all runs sampled too) | all | 0.207-0.262 | 0 | none | 0 |
Context stayed `running`. Peak 1.09 once (issue 9). No flag raised.

**Music vs rooms (same region):** transition log from the audio run: hub to r1 (title, hub, r1), n1 to n2 to n3 to trial n6 to n3 to n4 all stay on `r1` both 0.8 s and 3 s after entry. It changes only on the Warden arena (`boss_warden:r1`) and on returning to the hub. Region-2 rooms n8/n9 stayed on `r2` (200+ transitions). Confirmed: music no longer changes between rooms of one region.

## Gaps
Only r1 and r2 were walked; r2 had no full playthrough (bot stuck in hub for 740 s, then the shaft loop), so the Signal Reef Warden was not fought. The Long Clock was reached by seeds 11-12 (lost, 632 and 708 of 1000 HP left). Token pickups were seen in seeds 2-3 (take-token events) and a trinket in the audio run.

## Files
`tools/playtest.mjs`, `tools/lib/ptbrain.js` (new tool), this report. Screenshots (kept to 11): `tools/shots/playtest_*.png`.
