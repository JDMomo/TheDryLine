/* CONTENT: room templates for region r3, Salt Cutting. So far only the arena of the Switchman Idol (id r3_arena).
   Main rooms, trial and branch room are built below with a small grid helper (mk / fill / put / out).
   The arena follows r1_arena: a hall (columns 0 to 2), the boss door (column 3, solid down to row 11, open at rows 12 to 14),
   25 tiles of floor. Instead of perches it has one-way salt ledges: two at row 12 (96 px up, a plain jump reaches them,
   good for shooting the Top Lens straight) and one high ledge at row 9 (192 px up, reached from the low ledges). */
(() => {
'use strict';
const G = window.G;
const WALL = '#'.repeat(30), L = '####' + '.'.repeat(25) + '#';          // 4 + 25 + 1 = 30
const ledge = (s, c0, c1) => s.slice(0, c0) + '='.repeat(c1 - c0 + 1) + s.slice(c1 + 1);
const FLOOR = '.'.repeat(29) + '#';


// ---- grid helper: mk() gives a blank room, fill() paints a rectangle, put() sets one tile, out() makes the rows.
const mk = (w, closed) => {
  const cols = 30 * w, g = [];
  for (let r = 0; r < 17; r++) g.push(Array(cols).fill('.'));
  g[0].fill('#'); g[15].fill('#'); g[16].fill('#');
  for (let r = 0; r < 17; r++) if (closed || r < 12 || r > 14) { g[r][0] = '#'; g[r][cols - 1] = '#'; }
  return g;
};
const fill = (g, r0, r1, c0, c1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; };
const put = (g, r, c, ch) => { g[r][c] = ch; };
const out = g => g.map(r => r.join(''));

// Brine pools: a spiked pool to cross on stepping pillars, a lost trunk on a plank above it.
{
  const g = mk(1);
  fill(g, 15, 15, 9, 21, '^');
  fill(g, 14, 15, 11, 12, '#'); fill(g, 13, 15, 15, 16, '#'); fill(g, 14, 15, 19, 20, '#');
  fill(g, 10, 10, 13, 18, '=');
  put(g, 9, 15, 'C'); put(g, 14, 7, 'E'); put(g, 13, 20, 'E'); put(g, 14, 23, 'E'); put(g, 14, 26, 'D');
  G.defineRoom({ id: 'r3_brines', region: 'r3', kind: 'main', map: out(g) });
}

// Crystal terraces: two steps up, a drop, a short spiked trench, a trunk on the top terrace.
{
  const g = mk(1);
  fill(g, 13, 15, 8, 13, '#'); fill(g, 11, 15, 14, 19, '#');
  fill(g, 13, 13, 8, 13, 's'); fill(g, 11, 11, 14, 19, 's');       // exposed salt crust: fast but slippery; Wet erodes the top layer
  fill(g, 15, 15, 3, 7, 's'); fill(g, 15, 15, 24, 27, 's');       // low salt shelves bookend the safer stepped route
  fill(g, 15, 15, 22, 23, '^'); fill(g, 12, 12, 20, 22, '=');   // a step so the 4-tile terrace face can be climbed from the right
  put(g, 10, 15, 'C'); put(g, 12, 10, 'E'); put(g, 10, 18, 'E'); put(g, 14, 21, 'E'); put(g, 14, 27, 'D'); put(g, 2, 7, 'L');
  G.defineRoom({ id: 'r3_terraces', region: 'r3', kind: 'main', map: out(g) });
}

// Rail trestle, two screens wide: three-route Salt Cutting showcase.
// LOW / SAFE: raised salt-crust patches sit over the permanent floor; Wet can dissolve the crust without opening a death pit.
// HIGH / FAST: old rail planks plus crumble transfers skip most of the slippery floor.
// SECRET POCKET: a spring near the far cutting launches to a separate survey shelf with the lost trunk.
{
  const g = mk(2);

  // Safe low route. Salt sits one tile above the permanent floor so dissolving it only drops the player onto ordinary ground.
  fill(g, 14, 14, 5, 13, 's');
  fill(g, 14, 14, 18, 27, 's');
  fill(g, 14, 14, 33, 43, 's');

  // High rail line: readable one-way runs broken by two committed crumble transfers.
  fill(g, 11, 11, 8, 14, '=');
  fill(g, 9, 9, 17, 22, '=');
  fill(g, 10, 10, 24, 25, 'c');
  fill(g, 8, 8, 28, 34, '=');
  fill(g, 10, 10, 37, 38, 'c');
  fill(g, 11, 11, 41, 47, '=');

  // Independent survey pocket.
  put(g, 15, 52, 'j');
  fill(g, 9, 9, 50, 56, '=');
  put(g, 8, 53, 'C');

  // Encounters stay mostly on the low line.
  put(g, 13, 11, 'E'); put(g, 13, 24, 'E'); put(g, 13, 39, 'E'); put(g, 14, 56, 'D');
  G.defineRoom({ id: 'r3_trestle', region: 'r3', kind: 'main', w: 2, map: out(g) });
}

// A narrow cutting: spouts on the ledges, a spiked floor between, a trunk on the high plank.
{
  const g = mk(1);
  fill(g, 1, 4, 1, 8, '#'); fill(g, 1, 4, 21, 28, '#');
  fill(g, 15, 15, 13, 17, '^');
  fill(g, 12, 12, 6, 9, '='); fill(g, 9, 9, 10, 13, '='); fill(g, 6, 6, 14, 18, '='); fill(g, 12, 12, 21, 24, '=');
  put(g, 11, 8, 'E'); put(g, 11, 22, 'E'); put(g, 14, 11, 'E'); put(g, 5, 16, 'C'); put(g, 14, 27, 'D'); put(g, 5, 7, 'L');
  G.defineRoom({ id: 'r3_cutting', region: 'r3', kind: 'main', map: out(g) });
}

// A toad pond under a low ceiling: a shallow dip, a hanging crystal, a shelf with a trunk.
{
  const g = mk(1);
  fill(g, 1, 8, 1, 28, '#'); fill(g, 9, 10, 13, 16, '#');
  fill(g, 15, 15, 8, 19, '.');
  fill(g, 13, 15, 21, 24, '#');
  put(g, 14, 6, 'E'); put(g, 15, 11, 'E'); put(g, 15, 18, 'E'); put(g, 12, 23, 'C'); put(g, 14, 27, 'D'); put(g, 9, 20, 'L');
  G.defineRoom({ id: 'r3_pond', region: 'r3', kind: 'main', map: out(g) });
}

// A salt spire: climb the planks over a central column; the doorway is on its top, a trunk on a high plank.
{
  const g = mk(1);
  fill(g, 7, 15, 12, 17, '#');
  fill(g, 12, 12, 6, 9, '='); fill(g, 9, 9, 9, 11, '='); fill(g, 9, 9, 18, 20, '='); fill(g, 12, 12, 21, 24, '='); fill(g, 6, 6, 22, 25, '=');
  put(g, 6, 13, 'D'); put(g, 6, 16, 'E'); put(g, 14, 8, 'E'); put(g, 14, 22, 'E'); put(g, 5, 23, 'C');
  G.defineRoom({ id: 'r3_spire', region: 'r3', kind: 'main', map: out(g) });
}

// Trial: planks and a ledge up to the Double Jump signal post, then a nine-tile gap only a double jump crosses.
{
  const g = mk(1, true);
  fill(g, 12, 12, 6, 9, '='); fill(g, 9, 15, 11, 15, '#'); fill(g, 9, 9, 25, 28, '#'); fill(g, 14, 14, 25, 28, '#');
  fill(g, 10, 14, 25, 28, '#');
  put(g, 14, 3, 'D'); put(g, 8, 13, 'M');
  G.defineRoom({ id: 'r3_trial', region: 'r3', kind: 'trial', label: 'Switch tower', map: out(g) });
}

// Branch (needs Wall Grip): a three tile chimney, nine tiles tall and with no shelves, climbs to the ledge that holds the plinth. A crab guards
// the ledge, a pair guard the floor. Without Wall Grip the ledge is 9 tiles up: nothing reaches it.
{
  const g = mk(1, true);
  fill(g, 6, 14, 9, 11, '#'); fill(g, 6, 14, 15, 28, '#');          // the chimney is columns 12 to 14; the right ledge is its top
  put(g, 14, 3, 'D'); put(g, 14, 6, 'E'); put(g, 14, 12, 'E'); put(g, 7, 5, 'F'); put(g, 5, 21, 'E'); put(g, 5, 26, 'I');
  G.defineRoom({ id: 'r3_hold', region: 'r3', kind: 'branch', label: 'Brine-bound plinth', needs: ['grip'], map: out(g) });
}

G.defineRoom({
  id: 'r3_arena', region: 'r3', kind: 'arena',
  map: [
    WALL,
    L, L, L, L, L, L, L, L,
    ledge(L, 12, 17),
    L,
    '...#' + '.'.repeat(25) + '#',
    ledge(ledge(FLOOR, 4, 13), 21, 28),
    FLOOR,
    '.'.repeat(22) + 'B' + '.'.repeat(6) + '#',
    WALL, WALL
  ]
});
})();
