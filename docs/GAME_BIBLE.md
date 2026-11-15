# Game bible: The Dry Line (working title)

Owner: CEO. Workers build to this. Where it is silent, pick the simplest thing that fits and say so in your report.

Theme note: research first recommended a pottery-and-kiln theme. A name check found Double Fine's "Kiln" (released April 2026), a pottery game set on a mountain, so that theme was dropped to keep this game clearly its own thing. The railway-on-a-dry-seabed theme below was the research desk's second option and fits the toll idea better.

## 1. What the game is
A 2D action platformer for 1 to 4 local players. It plays like a metroidvania in the hand (tight jump, slash, pogo, dash, wall jumps) and is structured as a run (a new line each time, about 25 to 35 minutes, death ends the run).

The hook: every boss is reachable from the first minute. You collect tokens on the way. Each boss has fare slots that open only for the right cut of token. Punching a slot is a huge swing in the fight, but a punched token is void. The party carries four tokens at most, and the last boss wants them too. So the game is the argument about which token goes where.

## 2. Premise and tone
The sea dried up long ago. Across its bed runs the Dry Line, a toll railway that carries no one any more but is still guarded by its toll-engines, the Wardens: great machines, some of them half creature. Each Warden has fare slots, and a slot accepts only a token of the matching cut. A token punched in a slot is void. At the end of the line, the Long Clock is still counting down to a departure that must not happen.

You are a ticket-runner: a small hooded figure in an amber cloak with a teal scarf, carrying tokens down the line. Tone: quiet, dry, a little melancholy; salt, rust, lamps and brass. No insects, no gothic castles, no undead.

Win: stop the Long Clock. Lose: the whole party is down.

Vocabulary used in the game's text: token (the item you spend), cut (its class), fare slot (boss weak point), punched (a broken slot), void (a spent token), scrip (currency), Warden (region boss).

## 3. Decisions the CEO has made (Joseph can overrule any of them)
- The party carries three tokens in all (solo carries three; two players 2 and 1; three players one each; four players one each, four in all).
- A punched token is gone for the rest of the run.
- Every run rolls a lock chart from its seed: each Warden has fare slots for only three of the four cuts. Every cut is locked out on at least one Warden, and no two of the four main Wardens share a chart. A locked cut has no slot at all (not drawn, not listed, cannot be punched). The chart is shown on a board in the Junction, on the map and at each gate.
- A charted fare slot opens only if the party carries a token of its cut when the fight starts. With three tokens and three charted cuts, which Warden gets which token is the run's central decision.
- A Warden's health grows by 60% for each player beyond the first, decided when its fight starts.
- A run code (seed plus the set of unlocked cuts, shown on the pause and run-over screens) replays the same world, chart and rewards.
- Every boss can be beaten with slashes alone. Fare slots are the bonus.
- The Long Clock is open from the start. It never gets weaker: when its fight starts it borrows one extra attack for every Warden not yet beaten (see section 4). Going straight to it is possible and clearly the hardest road.
- Every boss fight is graded when it ends: Beaten; Par (faster than the boss's par time, about 1.2 times the slash-only bot time); Clean (no player took a hit). A Clean fight refunds one punched token (a free party slot, else a plinth on the arena floor). Grades show as a stamp, on the map and on the run-over and win screens.
- Each region's guarded room (the fixed token's plinth) needs the movement unlock of the previous region in the ring: Signal Reef's needs Dash (Wreck Quay), Salt Cutting's Wall Grip (Signal Reef), Ticket Hall's Double Jump (Salt Cutting), Wreck Quay's Heavy Cut (Ticket Hall). The doorway and the map name the move. Main and trial rooms still need base moves only.
- Rooms are hand-built and shuffled each run; what they hold is rolled each run.
- Movement unlocks are found again each run, always at the same region's signal post.
- Between runs, feats unlock new tokens into the pool.
- Local co-op on one screen first. Online later.
- Browser build (plain JavaScript) for now, so every build is testable and instantly playable.

## 4. Regions and bosses
Hub: **The Junction.** A turntable platform with five gates, each showing its boss's sigil. A standpipe (mend fountain). Signs explaining tokens, and the lock chart board (for each region, the three cuts its Warden has slots for this run).

| Slot | Region | Look | Boss | Movement unlock |
|---|---|---|---|---|
| r1 | Wreck Quay | beached hulls, ribs and chains; rust brown on deep teal | The Tollkeeper | Dash |
| r2 | Signal Reef | dead coral towers hung with signal lamps; tall rooms; violet-grey dusk | The Lamp-Heron | Wall Grip |
| r3 | Salt Cutting | a white canyon cut for the rails, brine pools, crystal; pale blue-white on slate | The Switchman Idol | Double Jump |
| r4 | Ticket Hall | a buried station hall, booths, turnstiles, stopped clocks; dark green and brass | The Gatewhale | Heavy Cut |
| final | The Terminus | the buffers at the end of the line, steam and a great clock; night indigo and white | The Long Clock | none |

Each region's guarded room needs the movement unlock of the previous region in the ring (r2: Dash, r3: Wall Grip, r4: Double Jump, r1: Heavy Cut). Rooms: Signal Reef's roost has two coral heads nine tiles apart over a spiked drop (a dash in mid-air crosses); Salt Cutting's plinth stands atop a three-tile chimney nine tiles tall (Wall Grip climbs it); Ticket Hall's stands on a five-tile block (Double Jump clears it); Wreck Quay's lies behind a cracked barrier in a low tunnel that only a heavy cut breaks.

Each region: 3 main rooms picked from its pool, then the arena. Two doorways along the way lead to branch rooms (rolled from the shared pool), and one leads to the region's trial room, which holds the movement unlock. The final region: 2 main rooms, then the arena.

### Fare slots (weak points)
Every boss is built with four possible fare slots, one per cut, but in a run only the three cuts on its lock chart exist. Three token hits punch a slot: the boss loses 10% of its max health (three punches: 30%), staggers for 2.6 s, loses or weakens one attack, and the punching token is void. Boss health (set in each boss file) is multiplied by 1 + 0.6 for each player beyond the first when the fight starts. The slot descriptions below list all four; a run uses three.

### Boss briefs
**The Tollkeeper (r1).** Exists as the reference boss. A dome-backed, plated toll-engine on legs. Charge, leap with floor shockwaves, spit volley. Slots: Eye (pierce, at eye height on the face; ends the spit), Hump (arc, from above; ends the shockwaves), Belly (burst, only when it rears or leaps; slows the charge), Heel (ground; weakens the leap).

**The Lamp-Heron (r2).** A tall wading machine-bird on stilt legs with a signal lamp for a head. It stalks the arena, mostly above the players. Attacks: Peck (the head stabs down at a marked spot, then sticks in the floor for a moment, open to slashes), Lamp Sweep (a beam sweeps along the floor; jump it), Wing Gust (wind pushes players sideways while sparks stream across), Spark Fall (it rises and drops sparks in marked columns). Slots: Lamp (pierce; the lit head, high up, only while it sweeps or gusts), Back Hatch (arc; on top of the body), Throat (burst; only while the head is stuck in the floor), Ankle (ground; a foot joint, exposed while it stands still to peck). Punching them: no lamp sweep, weaker gust, fewer sparks, longer stuck time.

**The Switchman Idol (r3).** Three signal-heads stacked into a tall totem that hops along the rail. Attacks: Signal Rings (ring projectiles fired sideways at low, middle or high height, with gaps to jump through), Brine Geysers (marked eruptions under players), Topple (falls flat forward, big hit, then lies there exposed), Lever Toss (switch levers that fly out and return). Slots: Top Lens (pierce; high up, open only while signalling), Open Crown (arc; drop it into the top head), Split Seam (burst; only while toppled), Foot Plate (ground; while standing). Punching them: fewer rings, levers no longer return, slower geysers, longer time lying down.

**The Gatewhale (r4).** A whale-shaped engine that rides the arena floor on rails. It rolls across the arena (its wheels hurt), drops crates that stay as short-lived pillars, spins up and vents steam in a spiral, and releases up to two small enemies. Slots: Blowhole Valve (arc; on top, from above), Headlamp (pierce; only when it has stopped), Jaw Hinge (burst; when it opens its mouth to release crates or enemies), Wheel Truck (ground; when it has stopped). Punching them: no crates, slower roll, no summons, thinner steam spiral.

**The Long Clock (final).** A giant clock-faced engine fixed in the centre of the arena. Two phases; in the second the pendulum breaks loose and swings across the floor. Attacks: Steam Hands (two sweeping jets, like clock hands, with a clear warning), Spark Rain, Floor Rings (shockwaves along the ground), Wind Up (summons enemies). Slots: Side Vent (pierce; alternates sides), Bell Housing (arc; on top, only while it chimes), Mainspring (burst; when it flares, close range), Base Rail (ground). **Borrowed attacks:** when the fight starts it borrows one extra attack for every Warden not yet beaten, mixed into its normal cycle with the same fairness rules (a wind-up of at least 0.45 s, avoidable with base moves plus dash): Tollkeeper alive, a pair of floor shockwaves; Lamp-Heron alive, a lamp beam sweeping along the floor; Switchman Idol alive, signal rings at one of three heights; Gatewhale alive, dropped crates that stand as short-lived pillars. Its health (1100) does not depend on the Wardens beaten. With all four beaten a slash-only bot needs about 103 s; with two alive about 114 s; straight from the hub about 120 s, with every hazard in play. The Terminus gate label in the Junction and the map say what it will borrow ("Borrows: ...") before the party commits.

Beating a Warden gives the party: one more health pip, a choice of one trinket from three, and 40 scrip.

## 5. Enemies (none are insects)
| id | Name | Behaviour | Regions |
|---|---|---|---|
| ballast_crab | Ballast Crab | small walker; patrols, turns at edges | all |
| brine_spout | Brine Spout | stationary vent; lobs brine at the nearest player | r1, r3, final |
| turnstile | Turnstile | walks slowly behind a front shield; hit it from behind, from above, or with a token | r1, r4 |
| signal_gull | Signal Gull | flyer; hovers, then swoops in an arc | r2, final |
| lamp_wisp | Lamp Wisp | slow flyer that drifts at the player and bursts when killed | r2, r4 |
| brine_toad | Brine Toad | hops toward players; splashes on landing | r3 |
| handcar | Handcar | a pump trolley; winds up, then dashes along the floor | r4, final |
| hanging_lamp | Hanging Lamp | hangs from ceilings; drops when a player passes under | r2, r3 |

Every enemy must be readable: a wind-up before anything that hurts, and a clear silhouette.

## 6. Art direction (drawn in code for now, sprites later)
- Chunky rounded shapes. Bosses are built from 6 to 12 shapes.
- Outlines: 3 px on gameplay things, thinner on mid-ground, none on backgrounds.
- The player is the brightest thing on screen. Nothing else uses the player's teal (#3FB8AF) or amber cloak (#E2A03F).
- Backgrounds stay in a narrow dark value band. Only the gameplay layer reaches full contrast.
- Each region uses one hue family (see the table above). Token colours never appear in scenery.
- Fare slots pulse in their cut's colour and show their cut's shape.
- Three parallax layers. Light comes from the player, lamps and steam.
- Wind-ups last at least 12 frames, then a flash and a held pose.
- Base palette: #1B2A2F deep, #3C6E71 sea-grey, #D9C5A0 sand, #B8482F rust (enemy warnings only), #F4E6B8 lamp white, #F4F1E8 salt.

### Token cuts (colour-blind safe, shape always shown)
| Cut (class id) | Shape | Colour | How it travels |
|---|---|---|---|
| pierce | triangle | #56B4E9 | straight line |
| arc | crescent | #F0E442 | lobbed |
| burst | eight-point star | #D55E00 | short pulse around the player |
| ground | flat slab | #CC79A7 | along the floor |

### Naming
Tokens are "Mineral + Tool" (Cobalt Awl). Bosses are "The + railway role or creature". Regions are a place on the line. All names original.

### In-world names for props
Pedestal: plinth. Chest: lost trunk. Roll shrine: ticket machine. Shop: kiosk. Mend fountain: standpipe. Movement shrine: signal post. Currency: scrip (the code calls it shards).

## 7. Feel targets (from research)
Change from the prototype: jump buffer 0.10 s; dash cooldown 0.35 s; double jump 600; pogo 590; slash every 0.27 s; invincibility 1.0 s; hit-stop 0.06 s on a landed hit and 0.10 s when hurt. Add: corner correction on jumps and dashes (nudge past a clipped corner by up to 10 px), dash cancels slash recovery, camera look-ahead, hold up or down to pan the camera, quick stop on reversing.
Deliberately not copied from the references: double-damage hits, healing gated behind a full gauge, automatic ledge grabs, dark unreadable rooms, a shared scarce bomb or rope supply.

## 8. Tokens (the items you spend on bosses)
Rules, from research: slots are few so each pick costs another; every token is useful against ordinary enemies and off its slot; which slot a token answers is always guessable from its cut's shape and colour; risky sources show their price up front.

| id | Name | Cut | Source | Behaviour | Twist |
|---|---|---|---|---|---|
| cobalt_awl | Cobalt Awl | pierce | common | fast straight shot; hold Up to fire upward | none: the baseline |
| tin_spindle | Tin Spindle | pierce | rare | thin needle that passes through enemies | stand still 0.6 s first and it flies twice as far and hits harder |
| flint_tether | Flint Tether | pierce | fixed, r2 | bolt on a cable | pulls you to where it lands |
| ochre_ladle | Ochre Ladle | arc | common | lobbed shot that bursts on landing | none: the baseline |
| sulphur_kettle | Sulphur Kettle | arc | rare | heavy, slow lob with a big burst | steer it left and right in flight |
| chalk_skipstone | Chalk Skipstone | arc | fixed, r3 | bouncing throw | each bounce (up to 3) adds damage |
| cinder_bell | Cinder Bell | burst | common | pulse around you; clears enemy shots | none: the baseline |
| rust_censer | Rust Censer | burst | rare | pulse around you | a second pulse fires 1.2 s later where you stood |
| copper_drum | Copper Drum | burst | fixed, r4 | pulse around you | launches you and nearby allies upward |
| basalt_roller | Basalt Roller | ground | common | slab that slides along the floor and drops off ledges | none: the baseline |
| quartz_wake | Quartz Wake | ground | rare | sliding wave | splits in two at each ledge |
| pumice_crawler | Pumice Crawler | ground | fixed, r1 | slow floor flame that lasts a long time | waits at ledges; press the item button again to send it on |

- The run starts with the four commons and the four fixed tokens in the pool (fixed tokens are placed on their plinths; the rest of the pool feeds the trunks and the ticket machine). Each rare is locked until the player has punched one slot of that cut in any run (meta save).
- Picking up a token when the party is full swaps it with the selected slot; the old one stays on the plinth.

### Where tokens come from in one run (7 tokens on offer, 3 carried)
- 4 fixed plinths, one per region (r1 to r4), each in a guarded branch room (a short platforming or combat test). Always the same token in the same region.
- 2 lost trunks in main rooms; each opens when its room is cleared and holds a random pool token.
- 1 ticket machine: pay scrip to see three tickets (tokens first) and keep one. It can be used twice: the first roll costs 30 scrip, the second 45.
- 1 kiosk: three wares, trinkets only, 40 scrip each. It sells no tokens.
- No clipping booth (removed; its prop code remains in the engine, unused).
- Tokens stay unique within a run: a token is on offer in one place only. When the pool runs dry a source offers a trinket or scrip.
- Standpipes: one in the hub, one before the final arena. Full heal, once each per run.
- Scrip: enemies drop 2 to 5; a beaten Warden drops 40. Scrip left on the floor is collected when the party leaves the room.

## 9. Trinkets (passive, last the whole run)
| id | Name | Effect |
|---|---|---|
| brass_buckle | Brass Buckle | one more health pip |
| oiled_strap | Oiled Strap | dash recovers 30% faster |
| whetstone_chip | Whetstone Chip | slashes hit 25% harder |
| lead_boot | Lead Boot | half the knockback, 8% slower running |
| magnet_tooth | Magnet Tooth | scrip flies to you from further away; kiosk prices up 10% |
| punch_glove | Punch Glove | tokens recharge 25% faster |
| brine_flask | Brine Flask | mending is 30% faster |
| surveyors_slate | Surveyor's Slate | the map shows what every branch room holds |

## 10. Research sources behind this bible
Controls and feel: Hollow Knight and Silksong control references (hollowknight.wiki, Destructoid), Spelunky controls (StrategyWiki), Celeste feel write-ups (Gigazine, GameSpot), Spelunky 2 design analysis (Game Developer).
Items and bosses: Mega Man weakness analyses (Thrilling Tales of Old Video Games, The Mega Man Network), roguelike item design (Game Developer), Slay the Spire, Isaac, Spelunky 2, Dead Cells and Hades wikis and guides, Monster Hunter Wilds wound-system criticism (Automaton), co-op design (Game Wisdom).
Art and theme: The Making of Hollow Knight (Game Informer), ACMI on Team Cherry, GDC notes on Spelunky 2, Game Accessibility Guidelines on colour, Game Developer articles on telegraphing and visual confusion. Name check: Double Fine's "Kiln" (doublefine.com).
