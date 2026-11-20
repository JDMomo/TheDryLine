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

// Last Buffers: a quiet synthesis opener. Low floor alternates old salt and mud; a clean upper plank line bypasses both.
G.defineRoom({ id: 'final_buffers', region: 'final', kind: 'main',
  map: paint(1, 1, [[4, 15, 8, 15, 's'], [12, 15, 16, 15, 'm'], [20, 15, 24, 15, 's'],
      [9, 13, 11, 14, '#'], [18, 13, 20, 14, '#'], [7, 10, 12, 10, '='], [14, 8, 19, 8, '='], [21, 10, 25, 10, '='],
      [4, 1, 8, 2, '#'], [22, 1, 27, 3, '#']],
    [[6, 14, 'E'], [15, 14, 'E'], [23, 14, 'E'], [27, 14, 'D'], [16, 6, 'F']]) });

// Steam Gallery: the floor is always safe. A spring reaches the pipewalk; a timed vent can boost from there to the upper shortcut.
G.defineRoom({ id: 'final_vents', region: 'final', kind: 'main',
  map: paint(1, 1, [[8, 15, 8, 15, 'j'], [8, 10, 13, 10, '='], [14, 10, 14, 10, 'v'], [16, 6, 22, 6, '='],
      [17, 13, 19, 14, '#'], [3, 1, 6, 2, '#'], [22, 1, 26, 3, '#']],
    [[6, 14, 'E'], [18, 12, 'E'], [23, 14, 'E'], [26, 14, 'D'], [19, 5, 'F']]) });

// Clockworks, two screens wide: conveyors make the low route active but non-lethal; a crumble rail above is faster and riskier.
G.defineRoom({ id: 'final_gearworks', region: 'final', kind: 'main', w: 2,
  map: paint(2, 1, [[6, 15, 17, 15, '>'], [23, 15, 34, 15, '<'], [40, 15, 51, 15, '>'],
      [19, 13, 21, 14, '#'], [36, 13, 38, 14, '#'],
      [9, 11, 16, 11, '='], [19, 9, 24, 9, '='], [27, 10, 28, 10, 'c'], [31, 8, 37, 8, '='], [40, 10, 41, 10, 'c'], [44, 11, 50, 11, '='],
      [10, 1, 13, 3, '#'], [26, 1, 34, 4, '#']],
    [[8, 14, 'E'], [25, 14, 'E'], [40, 14, 'E'], [51, 14, 'E'], [55, 14, 'D'], [35, 6, 'F']]) });

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
