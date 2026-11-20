# Enemy Design Audit

This audit is the baseline for the enemy rework. It describes the current implementation, why encounters flatten out, and the minimum identity each enemy needs before new enemy types are added. Existing ids remain stable.

## Design standard

Every combat enemy should have:
- a readable pre-attack tell;
- a distinct attack pattern rather than contact damage as its main threat;
- a player counter (jump, reposition, flank, interrupt, bait, reflect/material interaction, or punish window);
- a visible hit reaction and a vulnerable/recovery state where appropriate;
- ledge/wall awareness so it does not walk or attack nonsensically into terrain;
- fair co-op targeting: enemies should not all collapse onto the same nearest player;
- one clear combat job in a mixed group;
- material hooks only when they are readable and useful, never as hidden bonus damage.

The intended feel is Hollow Knight-like readability: dangerous because the pattern demands a response, not because a body happens to overlap the player.

## Current enemies

### Strider (`ballast_crab`) — current role: basic walker

**What works:** It respects walls, ledges and spikes, and its small silhouette is readable.

**Why it is boring:** It has no attack state at all. It continuously walks at 60 px/s and its only threat is contact damage. It does not notice a player, telegraph anything, create a decision, or expose a punish window. Once the player understands that touching enemies hurts, every Strider encounter is functionally the same.

**Rework target:** light rusher / spacing check. Patrol normally; when a player enters a short lane, stop, raise the front claw, then make one committed scuttle/lunge. Jumping over it or stepping behind it should create a short punish window. It must still turn away from unsafe ledges.

### Boiler (`brine_spout`) — current role: stationary thrower

**What works:** It has a 0.6 s wind-up and a readable lob. The projectile aims at the nearest player and creates ranged pressure.

**Why it is boring:** It owns one loop: idle -> wind -> one lob -> spent. Because it never changes position or attack geometry, the answer is always the same once the arc is learned. It has no close-range response and does not create a material state despite visually throwing brine.

**Rework target:** artillery / space denial. Preserve the clear pressure-build tell, but alternate a targeted lob with a short-range steam/brine vent when crowded. Brine should create an explicitly wet/dousable/conductive patch through the existing materials system. After venting or over-pressurising, it should have a clear vulnerable recovery.

### Scrapper (`turnstile`) — current role: armoured blocker

**What works:** This is the strongest current regular-enemy concept. Front slashes are visibly blocked; attacks from behind, above, or with tokens work. Turning opens the shield briefly.

**Why it is still flat:** It has defence but no authored attack. Its pressure is still body contact while it slowly walks. Once a player gets behind it, the encounter is mostly solved.

**Rework target:** armoured lane holder. Keep the directional shield, add a clearly telegraphed shield shove/short charge when a player stays in front. The shove should commit it into a wall or recovery, creating the counter-window. Down-slashes and flanking remain valid counters.

### Rivet (`signal_gull`) — current role: swooper

**What works:** It has a 0.55 s rear-back warning, tracks a target, and follows a recognisable swoop arc. The attack already has more authored motion than most of the roster.

**Why it becomes repetitive:** It only alternates hover and one swoop. Its recovery is mostly a return to hover rather than a deliberate punish state, and groups can repeatedly attack the nearest player from the same geometry.

**Rework target:** aerial interceptor. Preserve the swoop as its signature. Add a brief post-swoop recovery/perch and vary the entry height or side in a deterministic, readable way. In co-op, distribute Rivets across available players instead of stacking every swoop on the nearest one.

### Lamp Wisp (`lamp_wisp`) — current role: drifting hazard / death bomb

**What works:** Its 0.45 s death-pop warning is clear and forces the player to move after a kill.

**Why it is boring:** While alive it simply steers slowly into the nearest player; the authored part happens only after it is already defeated. Its primary threat is another contact body.

**Rework target:** proximity controller. Give it a visible charge state before a pulse/dash so the player chooses whether to interrupt, retreat, or deliberately kill it and then escape the death burst. Its explosion must remain strongly telegraphed and should interact cleanly with flammable/wet states if a material hook is added.

### Brine Toad (`brine_toad`) — current role: hopper / ground splash

**What works:** It crouches for 0.4 s, checks the landing path, jumps, and fires two floor-hugging brine shots on landing. It already has terrain safety and a basic tell/counter loop.

**Why it flattens out:** Every cycle is the same 100 px hop and symmetrical splash. It does not predict or vary spacing, and the brine attack is mostly just damage rather than persistent terrain/material pressure.

**Rework target:** area-denial hopper. Keep the crouch tell and safe-hop logic. Choose between a short reposition hop and a committed target hop based on spacing, then leave a brief wet brine patch on the hard landing. The punish window is the crouch and landing recovery.

### Gearling (`handcar`) — current role: heavy rusher

**What works:** It has one of the best current loops: 0.65 s wind-up, committed floor dash, wall/ledge safety, then 0.9 s rest. The watercolor attack strip already maps to those phases.

**Why it still needs work:** It always solves the same lane in the same way and chooses only the nearest player. In open rooms it becomes a repeated horizontal dodge instead of a positioning problem.

**Rework target:** rail-line bruiser. Preserve wind -> dash -> rest. Let it prefer long clear lanes, crash/stagger harder against walls or heavy obstacles, and make that crash the intended punish. In co-op, lock a target for the wind-up rather than retargeting mid-commit.

### Hanging Lamp (`hanging_lamp`) — current role: ceiling ambusher

**What works:** It checks for a player below, shakes for 0.45 s, drops, lands, and burns out. Its state sequence is readable and terrain-specific.

**Why it is limited:** It is a one-shot trap rather than a reusable combat enemy. The trigger lane is extremely narrow and after landing it mostly waits to disappear. It cannot combine meaningfully with other enemies beyond surprise contact.

**Rework target:** ambusher / temporary terrain hazard. Keep the ceiling shake tell. Broaden the readable trigger, make the landing create a short-lived hazard or blocking pool of light/heat, then expose the broken lamp for a punish/cleanup window. It should remain a support threat, not a high-HP duel enemy.

## Designed roster additions not yet wired into runtime

The eight enemies above are the **current runtime roster**, but they are not the full designed roster. Existing Dry Line watercolor asset work already establishes three additional enemies. Their visual identity and combat job are source-of-truth design constraints even though no runtime ids/definitions exist for them yet:

- **Sapper — Explosive.** Existing watercolor design: a compact round bomb/pressure-machine silhouette with fuse/hat language and animation concepts. Runtime implementation should make it the explosive/area-denial role rather than inventing a replacement concept.
- **Harvester — Support.** Existing watercolor design: tripod/tank-like support machine with tubes and glowing canisters. Runtime implementation should preserve the support identity and use those canisters/tubes as readable gameplay language.
- **Mirage — Phasing.** Existing watercolor design: shadowy hooded/cloth figure with trailing ribbons and phase/shimmer animation concepts. Runtime implementation should preserve phasing as its defining role.

These are **existing designed enemies, not blank concepts**. The remaining work is to recover/use their established art and behavior intent, assign stable runtime ids, implement them with placeholder/code rendering only where a production strip is unavailable, and add their final sprite-sheet filenames to the asset manifest. Do not redesign their silhouettes or roles from scratch.

After these three are integrated, add only the minimum additional enemy types needed to reach the requested 3–4 complementary roles per region; total new runtime additions should remain within the requested 4–6.

## Cross-roster systems to add

1. **Attack contract:** named wind-up, active and recovery states with deterministic timings.
2. **Target locks:** an enemy chooses/locks a player for a committed attack; co-op target selection distributes pressure instead of every enemy recomputing the nearest target each frame.
3. **Terrain probes:** reusable helpers for wall, ledge, landing and clear-lane checks.
4. **Hit reactions:** the base knockback/flash remains, but armoured/heavy enemies should expose authored stagger/recovery when their counter is performed.
5. **Material hooks:** enemies may be wet, flammable, brittle, metal, heavy or slick where visually obvious. Terrain/material interactions should be shared with the same material vocabulary used by tokens and trinkets.
6. **Elites:** rare variants come only after the base enemy is readable. An elite changes one pattern/timing/property, not just HP and damage.

## Region encounter goals

- **Wreck Quay:** readable introductory pressure — Strider plus Boiler/Scrapper; lane control, armour and simple hazards.
- **Signal Reef:** aerial/vertical pressure — Rivet, Lamp Wisp, Hanging Lamp and future complementary flyers/ambushers.
- **Salt Cutting:** terrain and area denial — Brine Toad, Boiler, Strider plus a new role that exploits shafts/ledges.
- **Ticket Hall:** mechanical lane control — Scrapper, Gearling, Lamp Wisp plus a new support/ambush role.
- **Terminus:** mixed exam of learned roles; no unique regular-enemy mechanic should debut here.

## Acceptance gate for the rework

A reworked enemy is not considered done until automated checks prove:
- its tell lasts at least the authored minimum;
- its attack can hit but can also be avoided with intended base movement/counterplay;
- it respects walls/ledges relevant to its movement;
- its target remains stable through a committed attack;
- a four-player test distributes targets across more than one player when multiple enemies are active;
- material interactions are deterministic;
- its old stable id still works in room generation and saves/run codes;
- placeholder/code art and final sprite art use the same state names so art can be swapped without gameplay changes.


## Added encounter jobs — vertical-slice pass

The canonical watercolor concept sheet also defines three later-roster jobs now represented by code placeholders until their strips are cut:

- **Sapper — explosive zoning.** A 0.7 s plant tell precedes a cuttable delayed charge. Hitting the Sapper during the tell cancels the plant. Counterplay: interrupt, cut the mine, or move out of the marked space.
- **Harvester — support / repair.** It only begins its 0.85 s repair tell when a nearby ally is damaged. Hitting it during the tell cancels the pulse. Counterplay: prioritize the support unit or deliberately separate it from wounded enemies.
- **Mirage — phasing ambusher.** It visibly fades, relocates to safe footing near the target, then gives a 0.5 s reappearance tell before a committed dash. Counterplay: wait for the tell and punish the recovery rather than chasing the fade.

These keep the existing attack contract: **wind-up → committed active move → recovery**, with a readable interruption or positional answer. Their final silhouettes must follow `The Dry Line Watercolor Sprite Sheet.png`, not the procedural placeholders.
