# Game bible: The Dry Line (working title)

Owner: CEO. Workers build to this. Where it is silent, pick the simplest thing that fits and say so in your report.

Theme note: research first recommended a pottery-and-kiln theme. A name check found Double Fine's "Kiln" (released April 2026), a pottery game set on a mountain, so that theme was dropped to keep this game clearly its own thing. The railway-on-a-dry-seabed theme below was the research desk's second option and fits the toll idea better.

## 1. What the game is
A 2D action platformer for 1 to 4 local players. It plays like a metroidvania in the hand (tight jump, slash, pogo, dash, wall jumps) and is structured as a run (a new line each time, about 25 to 35 minutes, death ends the run).

The hook: every boss is reachable from the first minute. You collect tokens on the way. Each boss has fare slots that open only for the right cut of token. Punching a slot is a huge swing in the fight, but a punched token is void. The party carries four tokens at most, and the last boss wants them too. So the game is the argument about which token goes where.

## 2. Premise and tone
The sea dried up long ago. During the nine-day withdrawal, the Dry Line was put under an emergency timetable to carry evacuees instead of freight. Everyone got out; the cancellation order did not reach the Terminus. Four Wardens still enforce that valid timetable, and the Long Clock still certifies it. They are not evil machines: they are public infrastructure that never received permission to stop. Fare slots and tokens are the old railway's authorization language, so punching the final cancellation is both the mechanical and narrative goal.

You are the Wanderer: a small hooded figure with a teal scarf, following the Last Timetable from the Junction toward the machine still keeping it alive. Every cleared Warden releases one obsolete local order and removes one attack the Long Clock would otherwise borrow. Tone: quiet, dry, a little melancholy; salt, rust, lamps and brass. No insects, no gothic castles, no undead. See `docs/STORY_BIBLE.md` for the reveal order and delivery rules.

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

Each Warden region: 4 main rooms picked from its pool, then the arena. One narrative landmark main room is guaranteed but shuffled into the chain; other rooms still vary by seed. Doorways along the way lead to branch rooms and the region's trial room, which holds the movement unlock. The final region: 3 main rooms, including its guaranteed Clockworks landmark, then the arena.

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
| ballast_crab | Strider | light rusher; patrol -> claw tell -> committed lunge -> recovery | all |
| brine_spout | Boiler | artillery/space denial; warned ranged brine lob or close pressure vent; lob leaves Wet | r1, r3, final |
| turnstile | Scrapper | armored lane holder; shielded advance -> warned charge -> open recovery; flank/downslash counters | r1, r4 |
| signal_gull | Rivet | aerial interceptor; hover -> tell -> damaging swoop -> harmless recovery | r2, final |
| lamp_wisp | Lamp Wisp | slow flyer that drifts at the player and bursts when killed | r2, r4 |
| brine_toad | Brine Toad | hops toward players; splashes on landing | r3 |
| handcar | Gearling | a small lamp-eyed machine; winds up, then dashes along the floor | r4, final |
| hanging_lamp | Hanging Lamp | hangs from ceilings; drops when a player passes under | r2, r3 |
| sapper | Sapper | explosive zoning; interruptible plant tell, cuttable delayed charge, recovery | r1, r4, final |
| harvester | Harvester | support; interruptible repair tell restores nearby damaged allies | r2, r4 |
| mirage | Mirage | phasing ambusher; fade/relocate, visible reappearance tell, committed dash, recovery | r3, final |

Ids stay as listed; the names changed when the watercolor art came in (Ballast Crab became Strider, Brine Spout Boiler, Turnstile Scrapper, Signal Gull Rivet, Handcar Gearling). The Scrapper's front guard blocks slashes and shows a "Blocked" float.

Every enemy must be readable: a wind-up before anything that hurts, and a clear silhouette.

## 6. Art direction (watercolor/ink source-of-truth; code art is fallback/placeholders)
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
| flint_tether | Flint Tether | pierce | signature | bolt on a cable | pulls you to where it lands |
| ochre_ladle | Ochre Ladle | arc | common | lobbed shot that bursts on landing | none: the baseline |
| sulphur_kettle | Sulphur Kettle | arc | rare | heavy, slow lob with a big burst | steer it left and right in flight |
| chalk_skipstone | Chalk Skipstone | arc | signature | bouncing throw | each bounce (up to 3) adds damage |
| cinder_bell | Cinder Bell | burst | common | pulse around you; clears enemy shots | none: the baseline |
| rust_censer | Rust Censer | burst | rare | pulse around you | a second pulse fires 1.2 s later where you stood |
| copper_drum | Copper Drum | burst | signature | pulse around you | launches you and nearby allies upward |
| basalt_roller | Basalt Roller | ground | common | slab that slides along the floor and drops off ledges | none: the baseline |
| quartz_wake | Quartz Wake | ground | rare | sliding wave | splits in two at each ledge |
| pumice_crawler | Pumice Crawler | ground | signature | slow floor flame that lasts a long time | waits at ledges; press the item button again to send it on |
| jet_gimlet | Jet Gimlet | pierce | ledger (feat) | bolt that turns after 0.35 s and flies home to you | strikes everything twice, out and back; tags metal, magnetic |
| amber_sling | Amber Sling | arc | ledger (feat) | short lob that bursts into two small bursts | tags flammable, brittle: the burst lights what it touches and shatters brittle things |
| mica_lantern | Mica Lantern | burst | ledger (feat) | pulse 90 px ahead of you, again 0.7 s later | tags brittle, spark: it lights clouds at a distance |
| gypsum_sledge | Gypsum Sledge | ground | ledger (feat) | slab that hugs the floor | grows from 5 to 15 damage as it slides; tags heavy, slick |

### Materials (decision "Materials", 2026-11-15)
Every token and trinket has one or two material tags and one card line naming the interactions they give it. The tags appear as small labelled chips on every card (plinth prompt, kiosk, map, HUD) and the line sits under the description. Interactions have fixed numbers, no dice, and a floating word names each one when it fires. Materials never change which fare slot a token opens: that stays its cut.

| Tag | Meaning |
|---|---|
| Heavy | breaks brittle shots; stops against a Lead Boot |
| Metal | conducts through wet things; a magnet pulls it |
| Flammable | a spark lights it |
| Wet | puts fire out; lets metal conduct |
| Slick | Ground shots slide |
| Brittle | shatters when a heavy shot touches it |
| Magnetic | pulls metal shots and scrip (trinket only) |
| Spark | lights flammable things |

| Token | Tags | Interactions on its card |
|---|---|---|
| Cobalt Awl, Tin Spindle, Cinder Bell, Copper Drum | metal | Conduct (Brine Flask or a brine puddle), Pull (Magnet Tooth) |
| Flint Tether | metal, spark | its bolt Ignites flammable shots and sets off clouds (Flare) |
| Ochre Ladle | wet | its burst leaves a brine puddle for 4 s: Douse, and enemies in it let metal Conduct |
| Sulphur Kettle | flammable, heavy | leaves a 3 s sulphur cloud (Flare when sparked); Shatters brittle shots |
| Chalk Skipstone, Quartz Wake | brittle | Shatter (3 fragments, 6 damage each); Crack |
| Rust Censer | metal, flammable | each pulse leaves a 2.5 s cinder cloud; Conduct |
| Basalt Roller | heavy | Shatter; with Lead Boot it Stops at you or a wall and a slash Kicks it for double damage |
| Pumice Crawler | flammable, spark | its flame Ignites and Flares things it touches |

| Interaction | Rule (all fixed) |
|---|---|
| Ignite | a spark (Flint Tether bolt, Pumice flame, Whetstone slash) within 38 px of a flammable shot of yours: x1.6 damage, x1.6 burst, bigger shot |
| Flare | a spark on a cloud: burst of radius 110, 20 damage |
| Douse | a puddle removes clouds and unlights shots; with Brine Flask a spark lights nothing |
| Conduct | a metal hit on an enemy standing in a puddle, or any metal hit with Brine Flask, chains to the nearest other enemy within 150 px for half damage |
| Pull | with Magnet Tooth a metal shot turns towards the nearest enemy or open fare slot of its cut within 240 px at 2.4 rad/s (never more than 70 degrees off its line) |
| Stop, Kick | with Lead Boot a heavy Ground shot stops against any player or a wall (not ending); a slash on it sends it at 820 px/s for double damage |
| Slide | Oiled Strap: Ground shots start 45% faster and last 50% longer |
| Shatter | a heavy shot touching a brittle one, or a Punch Glove slash on one: three fragments of 6 damage |
| Crack | a brittle shot of yours breaks the same way if you are hurt within 0.5 s of casting it |
| Punt | Punch Glove: a slash on your own shot launches it at 1.5x damage |
| Anchor | Lead Boot: being hurt neither pushes nor hops you |

Co-op jobs: one player sparks while another lobs a Kettle; one rolls a Basalt Roller into the other's Skipstone; a Lead Boot carrier is the wall a roller stops against; the Ladle player makes puddles for the other's metal shots. Every rule also works solo with two or three of your own tokens (Lead Boot lets a roller stop against a wall instead). Trinkets belong to the whole party, like the old stat trinkets.
Not built: a general wind-material rule. Boiler brine lobs now leave Wet puddles and can participate in the existing salt/Conduct/Douse material ecosystem; Anchor still covers knockback rather than wind.

- The run starts with the four commons and the four fixed tokens in the pool (fixed tokens are placed on their plinths; the rest of the pool feeds the trunks and the ticket machine). Each rare is locked until the player has punched one slot of that cut in any run (meta save).
- Picking up a token when the party is full swaps it with the selected slot; the old one stays on the plinth.

### Where tokens come from in one run (16 tokens in the pool, 7 on offer, 3 carried)
The pool has 16 tokens, four per cut: the common token, the rare one (needs its cut unlocked), the signature token (once fixed to one region, now ordinary), and one **ledger token** that a feat adds (see section 8c). Each run draws 7 from them, reproducibly from the seed (`G.worldgen` `drawTokens`; the draw is in `graph.draw`):
- 4 plinths, one per region (r1 to r4), each in a guarded branch room. Each holds a token of a cut that the **next** region's lock chart makes useful (the Wardens' fare slots differ per seed, so a cut locked on a Warden is not offered where you cannot use it next); the four prefer four different cuts. The map shows "Plinth: <token>" for each line you have seen.
- 2 lost trunks in main rooms; each opens when its room is cleared.
- 1 ticket machine: the first of its three tickets is the run's ticket token, then trinkets (30 scrip, then 45 for the second roll). It is usable twice.
- Optionally 1 start token (the Packed Lunch card, or a starting-token choice unlocked by the ledger): the party begins holding it.
- 1 kiosk: three trinkets, 40 scrip each. It sells no tokens.
- Tokens stay unique within a run, and the run's drawn tokens are placed first, so nothing else offers them twice. When the pool runs dry a source offers a trinket or scrip.
- Standpipes: one in the Junction, one at every authored service stop and one before the final arena. Full heal, once each per run.
- Scrip: enemies drop 2 to 5; a beaten Warden drops 40. Scrip left on the floor is collected when the party leaves the room.
- Run code: `SEED-CUTS` plus an optional `.HEX` part that records what the ledger had unlocked and which options were chosen, so a code replays the same run on any save. Old two-part codes still work.

## 8b. The Timetable (one rule per run)
The Last Timetable names a rule for the day's service. One card is rolled per run from the seed and the cards unlocked so far; it is announced on the title-to-Junction transition (a card for 8 s), kept on a plate in the Junction beside the Route Board, printed on the map and on the run-over screen. Each card is a flat, deterministic rule, never a random event during play.

| Card | Rule | In the deck |
|---|---|---|
| Rebate Day | every token punched in a Clean fight comes back (not only the first) | from the start |
| Fare Surge | scrip drops doubled; the kiosk is shuttered | from the start |
| Short Shift | the Long Clock borrows one attack fewer | from the start |
| Late Running | one of the last three lines (named by the seed) is crowded: none of its enemies are thinned out | from the start |
| Dry Pipes | no standpipes; releasing a Warden mends the whole party | from the start |
| Packed Lunch | the party starts holding one extra token from the draw | from the start |
| Wide Plates | slots take 4 hits but each punch takes 15% of a Warden's health | feat First Toll |
| Stopwatch | a Par grade gives one more health pip; Clean gives 20 scrip | feat Lamp Out |
| Brittle Stock | one named cut is worth double (20%) but its tokens crack after two uses | feat Idol Down |
| Long Haul | Wardens have 25% more health and release two pips | feat Beached |

## 8c. The feat ledger (options, not power)
Feats are things done in a run. They are stored in the meta save and shown on the Ledger screen (title: Map button; pause: Map button). A feat only ever unlocks an OPTION: a new token in the pool, a new Timetable card, a starting-token choice or Express mode. Nothing makes the Wanderer stronger.
- First Toll, Lamp Out, Idol Down, Beached: beat each of the four Wardens (unlock a card each: Wide Plates, Stopwatch, Brittle Stock, Long Haul).
- Clean Toll, Clean Lamp, Clean Idol, Clean Whale: beat each Warden without being hit (unlock Jet Gimlet, Amber Sling, Mica Lantern, Gypsum Sledge).
- The Clock Stops: beat the Long Clock (unlocks Express: Wardens +15% health, one pip fewer).
- Full Fare: punch all three fare slots of one Warden (unlocks the starting-token choice).
- Honours with no unlock: Straight to the Buffers (win with no Warden beaten), Under Par (win in under 30 minutes), Every Cut (punch a slot with each cut), Chemistry (all twelve material interactions).

## 9. Trinkets (passive, last the whole run, belong to the whole party)
Six enable a materials rule (section 8); two are plain. Each has tags and a card line like a token. Ids are unchanged.

| id | Name | Tags | Effect |
|---|---|---|---|
| brass_buckle | Brass Buckle | metal | plain: one more health pip |
| oiled_strap | Oiled Strap | slick | Slide: Ground shots start 45% faster and last 50% longer (no longer a dash bonus) |
| whetstone_chip | Whetstone Chip | metal, spark | Ignite and Flare: a slash lights your flammable shots and sets off clouds (no longer +25% damage) |
| lead_boot | Lead Boot | heavy, metal | Anchor: no knockback; Stop and Kick for heavy Ground shots; 8% slower running |
| magnet_tooth | Magnet Tooth | magnetic, metal | Pull: metal shots curve to enemies and open slots; scrip flies in from further (kiosk price rise removed) |
| punch_glove | Punch Glove | heavy | Punt: a slash launches your shot at 1.5x damage; Shatter on brittle ones (no longer faster recharge) |
| brine_flask | Brine Flask | wet | Conduct: metal hits chain; Douse: sparks light nothing, so it trades against fire builds (no longer faster mending) |
| surveyors_slate | Surveyor's Slate | brittle | plain: the map shows what every branch room holds |

## 10. Research sources behind this bible
Controls and feel: Hollow Knight and Silksong control references (hollowknight.wiki, Destructoid), Spelunky controls (StrategyWiki), Celeste feel write-ups (Gigazine, GameSpot), Spelunky 2 design analysis (Game Developer).
Items and bosses: Mega Man weakness analyses (Thrilling Tales of Old Video Games, The Mega Man Network), roguelike item design (Game Developer), Slay the Spire, Isaac, Spelunky 2, Dead Cells and Hades wikis and guides, Monster Hunter Wilds wound-system criticism (Automaton), co-op design (Game Wisdom).
Art and theme: The Making of Hollow Knight (Game Informer), ACMI on Team Cherry, GDC notes on Spelunky 2, Game Accessibility Guidelines on colour, Game Developer articles on telegraphing and visual confusion. Name check: Double Fine's "Kiln" (doublefine.com).
