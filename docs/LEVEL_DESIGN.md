# Authored Level Design Contract

The campaign is built as a memorable place first and a replay system second.

## Macro structure

The default campaign uses fixed regional spines. A player should be able to remember “the mud dock, then the beached ship, then the tar tunnel” instead of seeing four interchangeable generated rooms. Seeds still vary enemies, elites, loot, charts and optional shared branch contents.

Procedural main-room selection remains an engine capability for a later remix/expedition mode. It is not the default presentation.

## Room rhythm

A regional spine should usually move through four functions:

1. **Arrival / read.** Establish the region’s scale, material, landmark and one basic encounter. Do not stack hazards.
2. **Signature traversal landmark.** A larger room with a safe route, a faster/riskier route and one optional pocket.
3. **Focused complication.** Combine the region’s terrain with a stronger enemy job or movement trial.
4. **Compression / anticipation.** Shorter or quieter space before the Warden; use story evidence, a guarded reward or one final material idea instead of another maximal gauntlet.

A room needs an identity sentence that refers to a place or purpose, not just an obstacle: “beached deck with an open hold,” not “jump room.”

## Local exploration

Use stable landmarks, vertical reveals, ledges that reconnect, one-way drops that create return shortcuts, optional upper/lower routes and side rooms placed where they make spatial sense. The required route should remain readable without a map; secrets may require curiosity or later abilities.

Avoid procedural-looking patterns: evenly spaced boxes, repeated same-height platforms, hazard strips with no world explanation, or rooms whose only identity is the enemy count.

## Combat placement

Place enemies to create jobs:
- first contact alone, with space to read its tell;
- ranged enemies where cover/height creates a choice;
- armored enemies in lanes with a flank/drop route;
- support enemies where prioritization matters;
- ambushers after the player has a safe read of the room, never directly on an entrance.

Do not use enemy contact as invisible ambient damage. The damaging action should be the telegraphed attack.

## Visual hierarchy

The watercolor/ink art sheet is source-of-truth. Backgrounds establish place and mood; collision terrain stays darker and simpler; lamps, interactables, enemies and the Wanderer carry the brightest values. Code geometry is fallback/readability scaffolding, not final environment art.
