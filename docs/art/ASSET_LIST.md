---
title: "The Dry Line: asset list for hand-made art"
subtitle: "Every picture the game needs, with size, frames, colours and a description"
date: "14 November 2026"
---

# How to read this list

- **Sizes are in game pixels.** The game screen is 960 x 544 and one floor tile is 32 x 32. If you draw pixel art, draw at these sizes. If you draw smooth art, draw at double or four times these sizes and export a normal file and a double-size file (`name.png` and `name@2x.png`), the same way the token art is stored.
- **Hitbox** is the invisible box the game uses for collisions. **Frame** is the picture size to draw in, with room for limbs, weapons and motion.
- **Frames** means the number of drawings in that animation. Play them at 12 per second unless noted. "Loop" means it repeats.
- **Facing:** draw everything facing right. The game flips it for left.
- **Anchor:** put the feet on the bottom edge, centred left to right. Flying things are centred.
- **File format:** PNG with a transparent background. One animation per file, frames side by side in a strip, all frames the same size. Example: `player_run.png` is 8 frames of 48 x 56, so 384 x 56.
- **Names:** `player_<animation>`, `enemy_<id>_<animation>`, `boss_<id>_<part or animation>`, `prop_<type>`, `tile_<region>_<piece>`, `bg_<region>_<layer>`, `fx_<name>`, `ui_<name>`.
- The game currently draws everything except tokens and trinkets with code. It can already swap in a single picture per thing. Playing multi-frame strips for characters needs a small engine addition, which I will make when the first strips exist.

# Art style

**The world.** A toll railway across a dried-up seabed. Salt, rust, lamps and brass. Quiet and a little melancholy. Machines that are half creature. No insects, no castles, no skeletons.

**Shapes.** Chunky and rounded. Build each thing from a few big shapes; a boss is 6 to 12 shapes. Silhouettes must read as a solid black shape.

**Line.** A dark outline (#14181C) about 3 game pixels thick on anything the player touches, fights or picks up. Thinner or no outline on scenery. No outline on far backgrounds.

**Shading.** Flat colour, plus one lighter tone and one darker tone. No soft gradients. Light comes from lamps and from above left.

**Value.** Backgrounds stay dark and close together in brightness. Only the player, enemies, shots and pickups reach bright, saturated colour.

**Motion.** Every attack has a wind-up pose held for at least 12 frames at 60 per second (about 0.2 s, longer for bosses), then a white flash frame, then the strike. Squash and stretch only on the player and bosses.

# Colour coding (these colours have meanings; do not use them for anything else)

| Colour | Hex | Meaning |
|---|---|---|
| Amber | #E2A03F | Player 1's cloak. Players 2 to 4: sand #D9C5A0, pale blue #9FB8C8, lavender #A79BE0 |
| Teal | #3FB8AF | The player's scarf. Nothing else in the game is teal |
| Sky blue | #56B4E9 | Pierce cut. Shape: triangle |
| Yellow | #F0E442 | Arc cut. Shape: crescent |
| Vermilion | #D55E00 | Burst cut. Shape: eight-point star |
| Pink | #CC79A7 | Ground cut. Shape: flat slab |
| Rust red | #B8482F | Enemy warnings only: the glow or outline during a wind-up |
| Lamp white | #F4E6B8 | Light sources, scrip, things you can use |
| Bone | #C9C2AE | Spikes and other things that always hurt |
| Outline | #14181C | All gameplay outlines |
| Sealed grey | #586068 | A fare slot the party cannot open |

Scenery never uses the four cut colours, the amber or the teal.

**Region colours** (floor edge, highlight, accent; backgrounds are dark versions of the same family):

| Region | Feel | Edge | Highlight | Accent | Sky, top to bottom |
|---|---|---|---|---|---|
| The Junction (hub) | calm turntable platform, lamps | #3F6B5A | #6FA08A | #D9C5A0 | #0D1A19, #152825, #0C1514 |
| Wreck Quay | beached hulls, ribs, chains; rust brown on deep sea-green | #7A4E36 | #A06A48 | #C9A27A | #0C1A1B, #13292A, #0A1414 |
| Signal Reef | dead coral towers, signal lamps; violet-grey dusk | #6A6080 | #9894B8 | #C8BCE0 | #1A1824, #262236, #121019 |
| Salt Cutting | white canyon, brine pools, crystal; pale blue-white on slate | #9FB4C4 | #DFE9F0 | #E6EEF4 | #151B22, #1F2833, #10141A |
| Ticket Hall | buried station, booths, stopped clocks; dark green and brass | #8A7A3C | #C0AA5A | #D4BF6A | #0E1A14, #15261D, #0A130E |
| The Terminus | buffers, steam, the great clock; night indigo and white | #5A62A0 | #C8CCF0 | #F4F1E8 | #0E1024, #171A38, #0A0B1A |

# 1. The player (the ticket-runner)

A small hooded figure. Amber cloak shaped like a rounded bell, a dark face opening with two small bright eyes, stubby dark legs, a short pale blade carried on the back, and a long teal scarf that trails behind. Hitbox 22 x 42. Frame 48 x 56.

Draw the cloak in flat amber with one shadow tone, so the game can recolour it for players 2 to 4 (or supply four colour versions). The scarf can be left out of the frames: the game draws it as a moving ribbon.

| Animation | Frames | Notes |
|---|---|---|
| Idle | 4, loop | Slow breathing, cloak hem sways |
| Run | 8, loop | Legs scissor, body leans forward |
| Jump rise | 2 | Stretched tall, cloak pulled down |
| Jump peak | 1 | Cloak flares |
| Fall | 2, loop | Cloak lifts, arms up |
| Land | 2 | Squash low |
| Dash | 2 | Stretched flat and long, cloak streaming |
| Wall slide | 2, loop | One hand on the wall, facing away from it |
| Double jump | 3 | Tight tuck and spin |
| Slash side | 4 | Blade swings in front; body only, the arc is a separate effect |
| Slash up | 4 | Blade overhead |
| Slash down | 4 | Blade pointing down, used in the air |
| Heavy charge | 2, loop | Crouched, blade drawn back, glowing edge |
| Heavy cut | 5 | Big lunging swing |
| Use token | 3 | Throwing or raising a hand |
| Mend | 4, loop | Standing still, hand to chest, soft light |
| Hurt | 2 | Knocked back, eyes wide |
| Down | 3 | Collapses; last frame holds |
| Revive | 3 | Stands back up |
| Interact | 2 | Reaching up or forward |

# 2. Enemies

Display names changed with the art (ids unchanged); the first five are now cut and in the game (assets/enemies/, see tools/art/README.md); the descriptions below are the original briefs. Each needs a hurt frame (can be the idle frame in white) and a death burst (shared, see effects). Wind-ups glow rust red.

| Enemy | Hitbox | Frame | Animations and frames | Description and colours |
|---|---|---|---|---|
| Strider (ballast_crab) | 30 x 22 | 40 x 32 | Walk 4 loop, turn 2 | Low, flat crab whose shell is a lump of railway ballast stone. Grey stone shell, rust-brown legs, two small lamp-white eyes. The simplest enemy: it just patrols |
| Boiler (brine_spout) | 26 x 30 | 32 x 40 | Idle 2 loop, swell (wind-up) 3, spit 2 | A barnacle-like vent fixed to the floor. Salt-crusted pale grey cone, dark wet mouth. Swells and glows rust before lobbing brine |
| Scrapper (turnstile) | 34 x 40 | 48 x 48 | Walk 4 loop, brace (wind-up) 2, shove 2 | A three-armed station turnstile walking on two stubby legs, holding a flat shield plate in front. Brass arms, dark green post, steel shield. The shield must be obvious: it blocks slashes from the front |
| Rivet (signal_gull) | 30 x 22 | 48 x 40 | Hover flap 4 loop, rear back (wind-up) 2, swoop 2 loop | A gull with a small signal lamp where its head should be. Grey-violet wings, lamp-white head lens that flashes rust before the dive |
| Lamp Wisp | 24 x 24 | 32 x 32 | Drift 4 loop, swell (warning) 3, burst 4 at 48 x 48 | A loose lamp flame inside a bent wire cage. Lamp-white flame with a violet core. Bursts when killed, so the swell must read clearly |
| Brine Toad | 32 x 24 | 48 x 40 | Sit 2 loop, crouch (wind-up) 2, leap 2, land 2 | A squat toad crusted with salt crystals. Slate blue-grey skin, white crystal lumps on its back, pale belly |
| Gearling (handcar) | 46 x 30 | 64 x 40 | Idle 2 loop, pump (wind-up) 3, dash 2 loop, skid 2 | A railway pump trolley: flat deck, two wheels, a see-saw lever, one lamp eye at the front. Dark green deck, brass lever, lamp-white eye. Sparks from the wheels when it pumps |
| Hanging Lamp | 24 x 30 | 32 x 48 | Hang 2 loop, shake (warning) 3, fall 1, shatter 4, floor fire 3 loop at 32 x 24 | A heavy signal lamp on a chain (chain link tile 8 x 16, repeats upward). Dark iron frame, lamp-white glass. Drops when someone walks under |
| Sapper | 30 x 28 | 48 x 40 | Move 4 loop, plant wind-up 3, plant/retreat 3, defeat 4 | **Use the canonical watercolor concept silhouette:** round bomb-like rail machine, fuse/hat detail, compact legs. The attack must clearly show it setting a charge on the ground; wind-up carries the rust warning. Files: `assets/enemies/sapper/move.png`, `attack.png`, `defeat.png`. |
| Harvester | 38 x 42 | 56 x 56 | Move 4 loop, repair wind-up 3, pulse/recovery 3, defeat 4 | **Use the canonical watercolor concept silhouette:** tripod/tank support machine with tubes and glowing canisters. Attack frames gather light into the canisters before the repair pulse. Files: `assets/enemies/harvester/move.png`, `attack.png`, `defeat.png`. |
| Mirage | 28 x 40 | 48 x 56 | Move 4 loop, phase wind-up 3, reappear/dash 3, defeat 4 | **Use the canonical watercolor concept silhouette:** shadowy hooded cloth figure with trailing ribbons. Move/attack art must preserve the same right-facing side profile; phase is handled partly by engine alpha. Files: `assets/enemies/mirage/move.png`, `attack.png`, `defeat.png`. |

Enemy shots: brine glob 16 x 16, 2 frames, pale grey-green #B8C9A8 with a white highlight; toad splash 64 x 24, 3 frames.

# 3. Bosses

Bosses are posed by the game, so draw them as separate parts where noted, or as full frames if you prefer. Every boss also needs a stagger pose (slumped, 2 frames, loop), an enraged version (same art, hotter accent colour) and a death sequence.

**The Tollkeeper (Wreck Quay).** Hitbox 124 x 100. Frame 176 x 128. A dome-backed toll-engine on four short legs, plated like a turtle in overlapping shell plates, with a pale wooden face plate at the front and a furnace glow under its belly. Slate grey shell, bone face plate, rust-orange belly glow.

- Animations: idle 2, walk 4, rear up 3 (front lifts, belly shows), charge 2 loop, crouch 2, leap 2, land 2, spit 3, stagger 2, death 6.
- Fare slot positions: Eye (on the face, pierce), Hump (top of the back, arc), Belly (underside, only visible when reared or leaping, burst), Heel (back foot, ground).
- Shots: spit glob 20 x 20, 2 frames; floor shockwave 32 x 40, 3 frames, bone white.

**The Lamp-Heron (Signal Reef).** Body about 70 wide, very tall. Frame 200 x 260. A wading machine-bird on two stilt legs with a lit signal lamp for a head on a long jointed neck, a boxy body with a hatch on its back, and folding wings of slatted metal. Violet-grey metal, lamp-white lens, brass joints.

- Parts: head lamp, neck (4 segments), body, back hatch, two wings (folded and spread), two legs with ankle joints.
- Animations: stalk 6 loop, peck wind-up 3, peck strike 2, head stuck in floor 2 loop, lamp sweep 3, wing gust 4, rise 2, spark drop 2, stagger 2, death 6.
- Fare slots: Lamp (the head, pierce), Back Hatch (top of body, arc), Throat (neck base, shown while the head is stuck, burst), Ankle (foot joint, ground).
- Shots: sweep beam 480 x 24 strip, 2 frames, lamp white; spark 12 x 12, 2 frames; floor target mark 32 x 8, 2 frames, rust; wind streaks 96 x 16, 3 frames.

**The Switchman Idol (Salt Cutting).** Hitbox 64 x 152. Frame 112 x 184 standing, 184 x 96 lying down. Three railway signal heads stacked into a totem, each with one round lens, on a wide foot plate. It hops. Pale blue-white enamel, slate housing, lamp-white lenses.

- Animations: idle bob 2, hop 3, signalling 2 for each of three heights (the matching lens lights), topple wind-up 3, fall 2, lying 2 loop, get up 3, lever toss 3, stagger 2, death 6.
- Fare slots: Top Lens (pierce), Open Crown (top rim, arc), Split Seam (the middle, shown while lying down, burst), Foot Plate (ground).
- Shots: signal ring 40 x 40, 3 frames, lamp-white hoop; switch lever 32 x 12, 4 frames spinning; brine geyser 32 x 128, 5 frames, with floor mark 32 x 8.

**The Gatewhale (Ticket Hall).** Hitbox 150 x 84. Frame 208 x 128. A whale-shaped engine that rides the floor on wheels: blunt riveted head with one headlamp, a hinged jaw, a blowhole valve on top, wheel trucks underneath, a buffer for a tail. Dark green boiler plate, brass bands and valve, lamp-white headlamp.

- Parts: body, jaw, three wheels (24 x 24, 4 frames spinning), blowhole valve, headlamp.
- Animations: rumble idle 2, roll 4 loop, brake 2, jaw open 3, crate drop 2, spin up 3, venting 2 loop, stagger 2, death 6.
- Fare slots: Blowhole Valve (arc), Headlamp (pierce), Jaw Hinge (burst), Wheel Truck (ground).
- Shots: crate 64 x 64 plus a 4-frame break; steam puff 32 x 32, 4 frames, white.

**The Long Clock (The Terminus).** Fixed in place. Frame 256 x 288. A giant clock-faced engine: a tall riveted cabinet, a cream clock face whose two hands show its remaining health (hands are separate parts), a bell housing on top, a vent on each side, a round mainspring window low in the middle, a rail along the base, and a long pendulum that breaks loose in the second half of the fight. Night indigo cabinet, lamp-white face, white steam.

- Parts: cabinet, face, hour hand, minute hand, bell housing, left and right vents (shut and open), mainspring window (dim and flaring), base rail, pendulum rod and bob, shutters (3 frames closing).
- Animations: tick 2 loop, chime 3, vent open 2, flare 3, phase change 6, stagger 2, death 8.
- Fare slots: Side Vent (pierce, swaps sides), Bell Housing (arc), Mainspring (burst), Base Rail (ground).
- Shots: steam hand 320 x 32, 3 frames, with a thin rust warning line; spark 12 x 12; floor ring 32 x 40, 3 frames.

**Fare slot badges (shared by all bosses).** 32 x 32 each, one set per cut, in the cut's shape and colour: sealed (grey plate), open (2 frames, pulsing), cracked once, cracked twice, punched (dark hole with cracks). That is 6 frames x 4 cuts.

# 4. Tokens and trinkets (already drawn; redo by hand if you like)

64 x 64, with a 128 x 128 version. A token is a punched fare token: a coin-like blank whose outline is its cut's shape, in its cut's colour, stamped in dark outline with its tool, with a small punch hole. A trinket is a small object on a neutral brass luggage tag.

| Token | Cut | Stamp |
|---|---|---|
| Cobalt Awl | pierce | a pointed awl |
| Tin Spindle | pierce | a thin spindle with speed marks |
| Flint Tether | pierce | an arrowhead trailing a wavy cable |
| Ochre Ladle | arc | a ladle |
| Sulphur Kettle | arc | a round kettle |
| Chalk Skipstone | arc | a flat stone with bounce marks |
| Cinder Bell | burst | a hand bell |
| Rust Censer | burst | a ring with a second echo ring |
| Copper Drum | burst | a drum with an up arrow |
| Basalt Roller | ground | a six-sided roller with motion lines |
| Quartz Wake | ground | a wave that forks in two |
| Pumice Crawler | ground | a small flame with dots |

Trinkets: Brass Buckle, Oiled Strap, Whetstone Chip, Lead Boot, Magnet Tooth, Punch Glove, Brine Flask, Surveyor's Slate.

**Token shots** (what flies out when a token is used):

| Shot | Size | Frames | Look |
|---|---|---|---|
| Awl bolt | 36 x 8 | 1 | sky-blue dart with a pale trail |
| Spindle needle | 48 x 4 | 1 | very thin sky-blue line |
| Tether bolt and cable | 16 x 16 head, 8 x 4 cable piece | 1 each | arrowhead; the cable repeats back to the player |
| Ladle, Kettle, Skipstone | 20, 28, 16 square | 4, spinning | the token itself, tumbling; yellow burst on landing 48 x 48, 4 frames |
| Bell, Censer, Drum pulse | 256 x 256 | 5 | a vermilion ring that expands and fades |
| Roller slab | 32 x 14 | 2 | pink slab sliding flat on the floor |
| Wake wave | 28 x 24 | 3 loop | pink cresting wave |
| Crawler flame | 20 x 20 | 3 loop | small pink flame hugging the floor |

# 5. Props

> **Watercolor props now in the build.** Clean concept-sheet cuts are used directly for lost trunks, ticket machines, world signs and movement signal posts (`assets/props/*.webp`). Code painters remain as load-failure fallbacks. Other interactables still need dedicated production sprites before their placeholders should be considered final.

| Prop | Size | Frames | Description |
|---|---|---|---|
| Plinth | 38 x 18 | 1 | low stone stand a token floats above |
| Lost trunk | 48 x 32 | closed, opening 3 | battered travel trunk with brass corners; opens when the room is clear |
| Ticket machine | 48 x 64 | idle 2, dispensing 4 | brass and green vending cabinet with a slot and a lamp-white window |
| Kiosk | 96 x 64 | 1, plus a striped awning piece | small newspaper-stand stall with three shelves for wares |
| Signal post | 32 x 64 | unlit, lighting 3, lit 2 loop | railway signal on a pole; grants a movement unlock |
| Standpipe | 32 x 64 | idle, flowing 4 loop, dry | water tower tap; heals the party once |
| Doorway | 48 x 64 | 1 per region tint | arched side door to a branch room |
| Region gate | 48 x 80 | 1 per region | tall arch in the hub, outlined in the region's edge colour |
| Boss sigils | 24 x 24 | 5 | one emblem per boss: plated dome, lamp bird, three stacked lenses, whale, clock face |
| Chart board | 128 x 80 | 1 | timetable board in the hub showing each boss's three cut shapes |
| Sign | 32 x 40 | 1 | wooden notice on a post |
| Boss door | 32 x 96 | closing 4 | bars that drop when a fight starts |
| Scrip | 12 x 12 | 4, spinning | small lamp-white diamond chit |

# 6. Tiles (one set for each of the six places)

Each set is 32 x 32 pieces in the region's colours (see the region table). Fill is near black; the top edge carries the region's edge colour with a highlight line.

| Piece | Count | Notes |
|---|---|---|
| Solid fill | 3 variants | dark, barely textured |
| Top edge | 3 variants | the walkable surface; the most-seen tile |
| Left side, right side, underside | 1 each | thin lighter rim |
| Outer and inner corners | 8 | four of each |
| One-way platform | left cap, middle, right cap | a thin plank or girder you can jump up through |
| Spikes | 2 variants | bone-coloured, clearly sharp, sitting in a shallow pit |
| Decoration | 4 to 6 per region | not solid. Wreck Quay: chains, hull ribs, portholes. Signal Reef: coral fans, hanging lamps, cable. Salt Cutting: crystals, rail sleepers, drips. Ticket Hall: booth fronts, clocks, benches. The Terminus: pipes, buffers, gauges. Junction: lamp posts, turntable rail |

# 7. Backgrounds (three layers for each of the six places)
> **Current temporary production plates.** The canonical watercolor concept sheet contains three painted background studies now cropped into the build as `assets/backgrounds/wreck_quay.jpg`, `signal_reef.jpg`, and `ticket_hall.jpg`. They establish the intended ink/wash value structure immediately. They are concept-study crops, not final environment deliverables. Junction currently shares the Ticket Hall plate; Salt Cutting and Terminus intentionally remain on fallback scenery until matching watercolor plates are authored.


Each layer is 960 x 544 and must repeat seamlessly left to right. Draw them as flat silhouettes in the region's dark background tones, lighter in the distance, with no outlines.

| Layer | Moves | Content |
|---|---|---|
| Far | slowest | the biggest shapes: hulls on the horizon, coral towers, canyon walls, hall arches, the clock tower |
| Middle | medium | mid-size shapes: masts, lamp strings, salt pillars, booths, steam stacks |
| Near | fastest | dark foreground silhouettes framing the play area: chains, cables, railings |

The sky behind them is a three-colour vertical gradient the game draws from the region table.

# 8. Effects

| Effect | Size | Frames | Look |
|---|---|---|---|
| Slash arc, side | 96 x 72 | 4 | cream crescent sweeping forward |
| Slash arc, up and down | 72 x 96 | 4 each | same crescent, vertical |
| Heavy cut arc | 128 x 96 | 5 | larger, warm gold |
| Dust puff | 16 x 16 | 4 | grey-green, for jumps, landings, dashes |
| Dash afterimage | 48 x 56 | 1 | the dash frame as a flat pale silhouette |
| Double jump ring | 48 x 16 | 4 | pale ring under the feet |
| Hit spark | 24 x 24 | 3 | lamp-white star |
| Hurt flash | 48 x 48 | 3 | white burst on the player |
| Mend ring | 64 x 64 | 5 | soft lamp-white ring closing in |
| Slot punch burst | 96 x 96 | 6 | shards flying out; draw in white so the game can tint it to the cut's colour |
| Death burst (enemies) | 48 x 48 | 5 | puff with a few fragments |
| Stagger stars | 32 x 16 | 4 loop | small lamp-white marks circling a boss's head |
| Pickup sparkle | 24 x 24 | 4 | for tokens, trinkets and scrip |

# 9. Interface

| Item | Size | States |
|---|---|---|
| Health pip | 20 x 20 | full, empty. A diamond: lamp-white fill, amber rim |
| Mend gauge | 128 x 10 | frame and fill, with marks at each third |
| Ability icons | 20 x 20 | Dash, Wall Grip, Double Jump, Heavy Cut; lit and unlit |
| Token slot frame | 44 x 44 | empty, filled, selected, cooling down |
| Cut shapes | 16 x 16 and 32 x 32 | triangle, crescent, star, slab, in their colours and in sealed grey |
| Boss bar | 520 x 12 | frame, fill, enraged fill |
| Map pieces | 24 x 16 | room seen, room current, room unseen, doorway mark, boss beaten mark |
| Prompt panel | 24 x 24, stretchable | dark panel with a thin lamp-white rim |
| Button pictures | 20 x 20 | about 14 keyboard keys and 10 controller buttons |
| Title | about 480 x 120 | "The Dry Line" lettering: small capitals with a serif, like an old railway timetable |
| Menu cursor | 16 x 16 | a small ticket-punch notch |

# Suggested order

1. The player's idle, run, jump, fall and side slash. This sets the style for everything.
2. Wreck Quay tiles and its three background layers.
3. The Strider (was Ballast Crab).
4. The Tollkeeper.
5. Stop and look at those four together in the game before drawing anything else.

# Rough totals

About 60 player frames, 90 enemy frames, 200 boss frames or 60 boss parts, 6 tile sets of about 25 pieces, 18 background layers, 50 effect frames, 40 interface pieces, and 20 props. The tokens and trinkets (20) exist already.
