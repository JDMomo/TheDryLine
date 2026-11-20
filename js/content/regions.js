/* CONTENT: the game's name and wording, and one G.defineRegion per region (fields: js/game/worldgen.js).
   Every region uses its own rooms (pool = its id) and its own Warden; enemy lists follow bible section 5
   (enemies = ground, flyers = F markers, ceiling = L markers).
   The default win is beating the boss of region 'final' (G.game.win in js/game/run.js). */
(() => {
'use strict';
const G = window.G;

Object.assign(G.title, { name: 'The Dry Line', tagline: 'Every Warden is open from the start. Every token is punched once.',
  winText: 'The Long Clock stops', loseText: 'The line goes quiet' });

G.defineRegion({ id: 'r1', name: 'Wreck Quay', blurb: 'Beached hulls, ribs and chains.', gate: 0, boss: 'tollkeeper', ability: 'dash',
  fixedItem: 'pumice_crawler',
  enemies: ['ballast_crab', 'brine_spout', 'turnstile', 'sapper'], pool: 'r1',
  scale: { hp: 0.8, aggro: 0.85 },                                     // a gentle first region: 20% less health, a 15% slower tempo
  intro: { maxEnemies: 2, calm: 8, avoid: ['turnstile', 'brine_spout', 'sapper'] }, // its first main room: at most 2 enemies, no turnstile or spout within 8 tiles of the entrance
  palette: { sky0: '#0c1a1b', sky1: '#13292a', sky2: '#0a1414', far: '#132527', near: '#0f1f20', side: '#2a2420', edge: '#7a4e36', edgeHi: '#a06a48', accent: '#c9a27a' } });
G.defineRegion({ id: 'r2', name: 'Signal Reef', blurb: 'Dead coral towers hung with signal lamps.', gate: 1, boss: 'lamp_heron', ability: 'grip',
  fixedItem: 'flint_tether',
  enemies: ['ballast_crab', 'harvester'], flyers: ['signal_gull', 'lamp_wisp'], ceiling: ['hanging_lamp'], pool: 'r2',
  palette: { sky0: '#1a1824', sky1: '#262236', sky2: '#121019', far: '#221e30', near: '#1c1928', side: '#2c2838', edge: '#6a6080', edgeHi: '#9894b8', accent: '#c8bce0' } });
G.defineRegion({ id: 'r3', name: 'Salt Cutting', blurb: 'A white canyon cut for the rails.', gate: 2, boss: 'switchman_idol', ability: 'double',
  fixedItem: 'chalk_skipstone',
  enemies: ['ballast_crab', 'brine_spout', 'brine_toad', 'mirage'], ceiling: ['hanging_lamp'], pool: 'r3',
  palette: { sky0: '#151b22', sky1: '#1f2833', sky2: '#10141a', far: '#1c242e', near: '#182029', tile: '#0b0f13', side: '#2a3440', edge: '#9fb4c4', edgeHi: '#dfe9f0', accent: '#e6eef4' } });
G.defineRegion({ id: 'r4', name: 'Ticket Hall', blurb: 'A buried station hall of booths and stopped clocks.', gate: 3, boss: 'gatewhale', ability: 'heavy',
  fixedItem: 'copper_drum',
  enemies: ['ballast_crab', 'turnstile', 'handcar', 'sapper', 'harvester'], flyers: ['lamp_wisp'], pool: 'r4',
  palette: { sky0: '#0e1a14', sky1: '#15261d', sky2: '#0a130e', far: '#13221a', near: '#101c15', side: '#22301f', edge: '#8a7a3c', edgeHi: '#c0aa5a', accent: '#d4bf6a' } });
G.defineRegion({ id: 'final', name: 'The Terminus', blurb: 'The buffers at the end of the line.', gate: 4, boss: 'long_clock', length: 2,
  enemies: ['handcar', 'brine_spout', 'ballast_crab', 'sapper', 'mirage'], flyers: ['signal_gull'], pool: 'final',
  palette: { sky0: '#0e1024', sky1: '#171a38', sky2: '#0a0b1a', far: '#141733', near: '#10132a', side: '#22264a', edge: '#5a62a0', edgeHi: '#c8ccf0', accent: '#f4f1e8' } });
})();
