/* CONTENT SLOT: room templates for region r2 (Signal Reef). Empty for now: regions.js points r2 at r1's rooms (pool: 'r1').
   Add main rooms, one arena, one trial and one branch room here with G.defineRoom({ region: 'r2', ... }) (see rooms_r1.js),
   then set pool: 'r2' for r2 in regions.js. */
(() => {
'use strict';
const G = window.G;

// ---- Signal Reef rooms: small grid helpers keep the tall maps readable. Every map is still a plain ASCII template. ----
const CW = 30, CH = 17;
// A blank room w x h cells: solid border and floor, open inside.
function blank(w, h) {
  const g = [];
  for (let r = 0; r < CH * h; r++) g.push(Array.from({ length: CW * w }, (_, c) => (r === 0 || r >= CH * h - 2 || c === 0 || c === CW * w - 1) ? '#' : '.'));
  return g;
}
const put = (g, r, c0, c1, ch) => { for (let c = c0; c <= c1; c++) g[r][c] = ch; };
const fill = (g, r0, r1, c0, c1, ch) => { for (let r = r0; r <= r1; r++) put(g, r, c0, c1, ch); };
const mark = (g, r, c, ch) => { g[r][c] = ch; };
const done = g => g.map(row => row.join(''));
// Open the side exits of a main room (rows 12 to 14 of the bottom cell) and give it a floor two tiles thick.
function exits(g, left, right) {
  const b = g.length - CH;
  for (const r of [12, 13, 14]) { if (left) g[b + r][0] = '.'; if (right) g[b + r][g[0].length - 1] = '.'; }
  return g;
}

// The Coral Stair: a lopsided spire climbed by zigzag one-way shelves; a lost trunk sits on the crown.
(() => {
  const g = exits(blank(1, 1), true, true);
  put(g, 12, 13, 18, '='); put(g, 9, 6, 11, '='); put(g, 6, 13, 18, '='); put(g, 3, 7, 12, '=');
  mark(g, 2, 10, 'C'); mark(g, 14, 27, 'D'); mark(g, 2, 16, 'L');
  mark(g, 14, 20, 'E'); mark(g, 11, 16, 'E'); mark(g, 8, 8, 'F'); mark(g, 5, 22, 'F');
  G.defineRoom({ id: 'r2_spire', region: 'r2', kind: 'main', map: done(g) });
})();

// Stepped coral shelves: a broad hill of coral to climb and drop down; the doorway sits on the crest, a trunk on the far shelf.
(() => {
  const g = exits(blank(1, 1), true, true);
  fill(g, 13, 14, 5, 8, '#'); fill(g, 10, 14, 9, 12, '#'); fill(g, 8, 14, 13, 18, '#'); fill(g, 10, 14, 19, 22, '#'); fill(g, 13, 14, 23, 25, '#');
  mark(g, 7, 17, 'D'); mark(g, 9, 20, 'C'); mark(g, 2, 15, 'L');
  mark(g, 9, 11, 'E'); mark(g, 7, 14, 'E'); mark(g, 12, 24, 'E'); mark(g, 6, 22, 'F');
  G.defineRoom({ id: 'r2_shelves', region: 'r2', kind: 'main', map: done(g) });
})();

// The Lamp Shaft: a narrow lit chimney, two cells tall. Climb the alternating shelves to the doorway at the top (the exits are in the bottom hall).
(() => {
  const g = blank(1, 2), b = 17;
  fill(g, 1, 27, 1, 9, '#'); fill(g, 1, 27, 20, 28, '#');           // shaft walls above the hall
  for (const r of [12, 13, 14]) { g[b + r][0] = '.'; g[b + r][29] = '.'; }
  put(g, 29, 10, 13, '='); put(g, 26, 16, 19, '='); put(g, 23, 10, 13, '='); put(g, 20, 16, 19, '=');
  put(g, 17, 10, 13, '='); put(g, 14, 16, 19, '='); put(g, 11, 10, 13, '='); put(g, 8, 16, 19, '='); put(g, 5, 10, 13, '=');
  mark(g, 4, 11, 'D'); mark(g, 4, 13, 'C');
  mark(g, 22, 11, 'E'); mark(g, 25, 17, 'F'); mark(g, 13, 17, 'F'); mark(g, 31, 24, 'E');
  G.defineRoom({ id: 'r2_shaft', region: 'r2', kind: 'main', h: 2, map: done(g) });
})();

// The Gull Roost: a bed of spikes under a coral roost where gulls perch; hop the shelves over it. A trunk lies on the roost.
(() => {
  const g = exits(blank(1, 1), true, true);
  put(g, 15, 8, 21, '^');
  put(g, 12, 9, 11, '='); put(g, 10, 13, 16, '='); put(g, 12, 18, 20, '=');
  mark(g, 9, 14, 'C'); mark(g, 14, 27, 'D'); mark(g, 2, 24, 'L');
  mark(g, 6, 10, 'F'); mark(g, 7, 19, 'F'); mark(g, 4, 15, 'F'); mark(g, 14, 23, 'E');
  G.defineRoom({ id: 'r2_roost', region: 'r2', kind: 'main', map: done(g) });
})();

// Ledge Row: stacked one-way coral ledges to hop up; the doorway is on the top ledge.
(() => {
  const g = exits(blank(1, 1), true, true);
  put(g, 12, 5, 10, '='); put(g, 12, 19, 25, '='); put(g, 9, 9, 14, '='); put(g, 9, 17, 22, '='); put(g, 6, 12, 18, '=');
  mark(g, 5, 15, 'D'); mark(g, 14, 14, 'E'); mark(g, 8, 11, 'E'); mark(g, 4, 21, 'F');
  G.defineRoom({ id: 'r2_ledges', region: 'r2', kind: 'main', map: done(g) });
})();

// The Beacon Tower: a thick coral tower, two cells tall, with one-way shelves up both faces. Up the left, over the crest (doorway), down the right.
(() => {
  const g = blank(1, 2), b = 17;
  fill(g, 10, 31, 11, 18, '#');
  for (const r of [12, 13, 14]) { g[b + r][0] = '.'; g[b + r][29] = '.'; }
  const L = [[29, 5, 8], [26, 8, 10], [23, 4, 7], [20, 8, 10], [17, 4, 7], [14, 8, 10], [11, 6, 10]];
  for (const [r, c0, c1] of L) { put(g, r, c0, c1, '='); put(g, r, 29 - c1, 29 - c0, '='); }
  mark(g, 9, 14, 'D'); mark(g, 16, 23, 'C');
  mark(g, 9, 17, 'E'); mark(g, 22, 5, 'E'); mark(g, 28, 24, 'E'); mark(g, 5, 7, 'F');
  G.defineRoom({ id: 'r2_tower', region: 'r2', kind: 'main', h: 2, map: done(g) });
})();

// Lamp Mast (trial): hop two shelves to the signal post, then a sheer chimney with no ledges: only Wall Grip climbs it, to a sign on top.
(() => {
  const g = blank(1, 1);
  put(g, 12, 8, 11, '='); put(g, 9, 14, 18, '=');
  mark(g, 8, 16, 'M'); mark(g, 14, 3, 'D');
  fill(g, 4, 14, 22, 23, '#'); fill(g, 4, 14, 27, 28, '#');          // the chimney walls, cols 24 to 26 between them
  mark(g, 3, 27, '?'); mark(g, 14, 21, '?');
  G.defineRoom({ id: 'r2_trial', region: 'r2', kind: 'trial', label: 'Lamp mast', map: done(g),
    signs: ['Mind the chimney: it has no shelves.', 'Hold toward the wall to cling, press Jump to climb.'] });
})();

// Gull Roost (branch, needs Dash): two coral heads stand seven tiles above a spiked drop, nine tiles apart. The party arrives on the left head,
// the plinth is on the right one. A plain jump carries about six tiles, so only a jump with a dash in mid-air makes it. A fall costs a pip and
// returns the player to the edge; the far wall is far too tall to bounce or climb out of.
(() => {
  const g = blank(1, 1);
  fill(g, 8, 14, 1, 11, '#'); fill(g, 8, 14, 21, 28, '#');                    // the two heads: tops at row 8, gap in columns 12 to 20
  put(g, 14, 12, 20, '^');
  mark(g, 7, 6, 'D'); mark(g, 7, 26, 'I');
  mark(g, 7, 3, 'E'); mark(g, 7, 24, 'E');
  G.defineRoom({ id: 'r2_hold', region: 'r2', kind: 'branch', label: 'Gull roost', needs: ['dash'], map: done(g) });
})();

// The Lamp-Heron's arena: one screen. A hall (columns 0 to 2), the boss door (column 3, solid down to row 11, open at rows 12 to 14),
// then 25 tiles of floor. Three one-way coral shelves: two low ones (row 12, 3 tiles up) to stand on and lob shots down onto the
// bird's back, and a higher one in the middle (row 9, 6 tiles up, reached from a low shelf) for the Back Hatch and for dodging sweeps.
// The Heron (B) stands at column 18.
G.defineRoom({
  id: 'r2_arena', region: 'r2', kind: 'arena',
  map: [
    '##############################',
    '####.........................#', '####.........................#', '####.........................#',
    '####.........................#', '####.........................#', '####.........................#',
    '####.........................#', '####.........................#',
    '####.........====............#',
    '####.........................#',
    '...#.........................#',
    '....=====.............=======#',                  // low shelves reach both walls: one jump from the corner
    '.............................#',
    '..................B..........#',
    '##############################', '##############################'
  ]
});
})();
