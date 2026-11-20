# The home area (the Junction)

The start is an area, not a room of doors: a dry-dock rail yard on the old seabed, 5 screens wide and 3 storeys tall (150 x 51 tiles,
`js/content/rooms_hub.js`, room `junction`), plus two connector rooms that carry its vertical routes on to the lines.

## Map (columns are tile columns, rows count down from the roof)

| Storey | Row of floor | West (cols 2-47) | Centre (48-111) | East (112-147) |
|---|---|---|---|---|
| Roof | - | roof hatch, cols 38-41: **Signal Reef** | | |
| Upper | 16 (one-way) | top of the Signal Mast | high west walk (freight gate, col 58), clock balcony with the Route Board (col 79) and Timetable plate (col 72), the clock (Lost Property office inside, freight gate col 86; clock top over crumbling ledges) | high east walk (freight gate col 110), Salt Cutting landing: **Salt Cutting**, right edge rows 13-15 |
| Middle | 31 | Drill Yard floor C, mast bridge (freight gate col 50) | dispatch gallery (one-way, two fall-through gaps), clock tower stair | viaduct: **The Terminus**, right edge rows 28-30; east ladder up to the Salt Cutting landing |
| Ground | 47 | Drill Yard (mud, salt, conveyor, spring), floor B (crumbling bridge, steam vent, rail cart, tar pocket), the Signal Mast's foot | kiosk (3 wares), standpipe, the Keeper's canopy (start P, Station Keeper N), ticket machine, east stairs | grating over the well, cols 121-124: **Ticket Hall** (Down + Jump); low arch: **Wreck Quay**, right edge rows 44-46 |

- Routes out are edge openings declared in `def.portals` (`{ id, side, from, to, via, hint }`). A portal whose region's first room cannot meet
  its edge (the roof and the well) goes through a connector room, `via`: `junction_signal_stair` (bottom -> right) and `junction_hall_stair`
  (top -> right, two screens tall). Connectors are `kind: 'main'` with `region: 'hub'`; worldgen links them (`node.portals` on the hub node,
  `graph.regions[id].mouth`). A gate (G) stands at each mouth (`def.gateFor`); Up there takes the same route as walking out.
- Freight gates: Z markers on channels `def.channels['c,r'] = 'beaten:<region>'` (props.js `mech_gate`, `G.props.channelOpen`). Tollkeeper:
  mast bridge; Lamp-Heron: high west walk; Switchman Idol: high east walk; Gatewhale: the Lost Property office. None is on a required route.
- Loop-back shortcuts: `def.shortcuts` + `shortcut` fixtures (home ends: Wreck Quay col 54 ground, Ticket Hall col 132 ground, Signal Reef
  col 66 upper, Salt Cutting col 126 upper). Worldgen puts each far end in the region's last main room near its way on to the Warden
  (`graph.shortcuts`); using the far end unbolts both (`G.run.shortcuts`).
- Secrets: scrip stashes (`cache` fixtures, 6 to 20 scrip): Drill Yard spring shelf, tar-sealed pocket (fire or spark), drill closet (lever or
  plate gate), signal loft (Double Jump or Wall Grip), clock top (crumbling ledges), Lost Property (after the Gatewhale), plus one in each
  connector.
- Every gate and every portal is reachable from the start with run and jump only, and back (rooms check, strict); `home_area` checks the
  links, the openings, the connectors, the shortcuts, the freight gates and co-op join.

## For world-art
New props drawn in code in `js/game/props.js`: `shortcut` (bolted / open hatch with the region's accent colour and name), `cache` (tin box,
glints until taken), and the `mech_gate` prompt for freight gates. Restyle them through `G.art.draw('prop_shortcut' | 'prop_cache', ...)` as
for other props. The Route Board and Timetable plate draw hanging cords from y = 32 (the room's roof); in a 51-row room those cords are long.
