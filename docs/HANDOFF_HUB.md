# Hub hand-off (design team: roguelike layer)

For the Level team, who are rebuilding the Junction (rooms_hub.js and its wiring in worldgen `balance`).

The roguelike layer needs one new thing in the hub:

- **Timetable plate**: a prop of type `timetable` (defined in js/ui/ledger.js, about 176 x 82 px, drawn like the Route Board's wall plate; it names the run's Timetable card and prints its rule). It is added in `balance()` in js/game/worldgen.js, right after the Route Board:
  `hub.extras.push({ type: 'timetable', data: {}, c: 53, r: 13, x: 53 * T + T / 2, y: 13 * T + 16 })`
  It stands on the same row-13 balcony as the board, left of it. It must not overlap the board's box (`hub_layout` checks this) and must be reachable with a standing player. If the balcony moves, move this line with it; keep it within a few tiles of the board.
- The hub's gate labels, board and plate are read by checks `hub_layout` and `timetable` (the plate is found by `props.find(p => p.type === 'timetable')`).
- Nothing else in the hub is needed: the card also shows on the title-to-Junction transition (an 8 s card drawn by the HUD wrapper), the map and the run-over screen.
- Kiosk: the Scrip Boom card closes the kiosk (`rule.kioskClosed` strips its wares in `balance`); checks that expect the Junction's kiosk set `G.ledger.force = 'none'` first.
- Standpipes: the Dry Pipes card (`rule.noPipes`) strips every standpipe including authored service stops.
