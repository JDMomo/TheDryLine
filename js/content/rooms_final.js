/* CONTENT: room templates for region final (The Terminus): four main rooms, then the Long Clock's arena.
   Region final should list enemies ['handcar', 'brine_spout', 'ballast_crab'] and flyers ['signal_gull'] (regions.js).
   Main rooms here are built with paint() from rectangles and markers; each has one D and 3 to 6 enemies, none within 6 tiles of an entrance. */
(() => {
'use strict';
const G = window.G;

// A blank main room w x h cells: closed shell, side exits open at rows 12 to 14 of the bottom cell, then rects [c0, r0, c1, r1, ch] and marks [c, r, ch].
function paint(w, h, rects, marks) {
  const cols = 30 * w, rows = 17 * h, g = [];
  for (let r = 0; r < rows; r++) g.push([...(r === 0 || r >= rows - 2 ? '#'.repeat(cols) : '#' + '.'.repeat(cols - 2) + '#')]);
  for (let r = rows - 5; r <= rows - 3; r++) { g[r][0] = '.'; g[r][cols - 1] = '.'; }
  for (const [c0, r0, c1, r1, ch] of rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch;
  for (const [c, r, ch] of marks) g[r][c] = ch;
  return g.map(r => r.join(''));
}

// Buffers: two buffer stops (2 and 3 tiles high) to hop, a spout at the end. Planks above for a quicker line.
G.defineRoom({ id: 'final_buffers', region: 'final', kind: 'main',
  map: paint(1, 1, [[9, 13, 12, 14, '#'], [18, 12, 21, 14, '#'], [11, 9, 19, 9, '='], [4, 1, 8, 2, '#'], [22, 1, 27, 3, '#']],
    [[7, 14, 'E'], [15, 14, 'E'], [23, 14, 'E'], [27, 14, 'D'], [15, 6, 'F']]) });

// Steam pipes: a short spiked trench with a spout on a pipe stub, a handcar on the far run.
G.defineRoom({ id: 'final_vents', region: 'final', kind: 'main',
  map: paint(1, 1, [[10, 15, 13, 15, '^'], [16, 13, 18, 14, '#'], [10, 10, 14, 10, '='], [3, 1, 6, 2, '#'], [20, 1, 26, 4, '#']],
    [[7, 14, 'E'], [17, 12, 'E'], [22, 14, 'E'], [26, 14, 'D'], [12, 7, 'F']]) });

// The stopped clockwork, two screens wide: a spiked gap, a gear hill that climbs and falls, a second gap. Planks run over the top.
G.defineRoom({ id: 'final_gearworks', region: 'final', kind: 'main', w: 2,
  map: paint(2, 1, [[12, 15, 16, 15, '^'], [20, 12, 23, 14, '#'], [27, 14, 28, 14, '#'], [29, 13, 30, 14, '#'], [31, 12, 33, 14, '#'], [34, 13, 35, 14, '#'], [36, 14, 37, 14, '#'],
      [44, 15, 47, 15, '^'], [10, 11, 18, 11, '='], [36, 9, 46, 9, '='], [10, 1, 13, 3, '#'], [26, 1, 34, 4, '#']],
    [[8, 14, 'E'], [25, 14, 'E'], [40, 14, 'E'], [51, 14, 'E'], [55, 14, 'D'], [45, 7, 'F']]) });

// The tower of the great clock, one cell wide and two tall: planks climb to a doorway, a spiked pit below.
G.defineRoom({ id: 'final_tower', region: 'final', kind: 'main', h: 2,
  map: paint(1, 2, [[12, 32, 15, 32, '^'], [5, 29, 9, 29, '='], [12, 26, 16, 26, '='], [19, 23, 24, 23, '='], [11, 20, 18, 20, '='], [18, 8, 27, 9, '#'], [1, 1, 3, 12, '#']],
    [[9, 31, 'E'], [14, 25, 'E'], [22, 22, 'E'], [24, 31, 'E'], [8, 22, 'F'], [14, 19, 'D']]) });

// The Long Clock's arena (final_arena): the boss door at column 3, 25 tiles of floor, the clock in the centre (B, column 16).
// Outer planks (row 12, 96 px up) sit beyond the pendulum's reach: the Side Vent shows at their height. Inner planks (row 9,
// 192 px up) are where a lobbed token falls onto the Bell Housing from above.
G.defineRoom({
  id: 'final_arena', region: 'final', kind: 'arena',
  map: [
    '##############################',
    '####.........................#', '####.........................#', '####.........................#',
    '####.........................#', '####.........................#', '####.........................#',
    '####.........................#', '####.........................#',
    '####....==.............==....#',
    '####.........................#',
    '...#.........................#',
    '....===...................===#',
    '.............................#',
    '................B............#',
    '##############################', '##############################'
  ]
});
})();
