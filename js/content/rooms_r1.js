/* CONTENT: room templates for region r1, Wreck Quay. THE WORKED EXAMPLE for rooms (characters: js/game/rooms.js).
   A region needs: at least three 'main' rooms (open at rows 12 to 14 on both edges, crossable left to right with run and
   jump only, about one doorway D each), one 'arena' (open on the left, a boss door, a B marker), one 'trial' (signal
   post M, reached by a short platforming test) and one 'branch' room of its own (a guarded plinth I: enemies must be
   cleared before it can be taken). Rows are 30 characters per screen cell wide and 17 per cell tall; G.defineRoom
   reports any row of the wrong length. Base moves: a full jump rises about 4 tiles and carries about 6 across. */
(() => {
'use strict';
const G = window.G;
const WALL = '##############################';



/* Painter: a room starts as a box with a solid floor (rows 15 and 16) and open side exits at rows 12 to 14; put(row, col, text)
   stamps text over it ('~' leaves a tile as it is). Rows are numbered from the top of the room. */
function paint(w, closed, edits) {
  const cols = 30 * w, g = [];
  for (let r = 0; r < 17; r++) {
    let s = '';
    for (let c = 0; c < cols; c++) {
      let ch = '.';
      if (r === 0 || r >= 15) ch = '#';
      else if ((c === 0 || c === cols - 1) && (closed || r < 12 || r > 14)) ch = '#';
      s += ch;
    }
    g.push(s.split(''));
  }
  const put = (r, c, t) => { for (let i = 0; i < t.length; i++) if (t[i] !== '~') g[r][c + i] = t[i]; };
  const fill = (r0, r1, c0, c1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; };
  edits({ put, fill });
  return g.map(r => r.join(''));
}

// 1. Hull ribs as stepped platforms, a lost trunk on a high plank, the doorway on the lee side.
G.defineRoom({
  id: 'r1_ribs', region: 'r1', kind: 'main',
  map: paint(1, false, ({ put, fill }) => {
    fill(12, 14, 8, 10, '#');                 // first rib, 3 high
    fill(10, 14, 13, 15, '#');                // second rib, 5 high (reached by the plank)
    put(11, 11, '==');                        // plank between the ribs
    put(8, 17, '=====');                      // high plank
    put(7, 19, 'C');
    fill(12, 14, 19, 21, '#');                // third rib, low again
    put(14, 24, 'E');     put(11, 20, 'E');                         // crab on the third rib
    put(14, 26, 'D');
    put(14, 23, 'E');
  })
});

// 2. A chain-hung crossing over a spike pit, trunk on a plank above the middle. The planks are six tiles long with two-tile gaps: a plain
//    running jump from the end of one plank lands in the middle of the next, so a new player can cross by just jumping at each edge.
G.defineRoom({
  id: 'r1_chain', region: 'r1', kind: 'main',
  map: paint(1, false, ({ put, fill }) => {
    put(15, 7, '^^^^^^^^^^^^^^^');            // pit, cols 7 to 21 (spikes visible, floor row 15)
    put(13, 8, '======');                     // chain plank 1, cols 8 to 13
    put(13, 16, '======');                    // chain plank 2, cols 16 to 21
    put(10, 12, '====');                      // upper plank over the pit (3 tiles above the chain planks)
    put(9, 13, 'C');
    put(14, 24, 'E');
    put(11, 14, '~');
    put(14, 27, 'D');
    put(14, 22, 'E');
  })
});

// 3. A turnstile corridor: low roof, a threshold block to jump, shields facing you.
G.defineRoom({
  id: 'r1_gangway', region: 'r1', kind: 'main',
  map: paint(1, false, ({ put, fill }) => {
    fill(1, 9, 1, 28, '#');                   // roof of the corridor (rows 10 to 14 stay open)
    fill(12, 14, 14, 15, '#');                // threshold block
    put(14, 10, 'E');
    put(14, 19, 'E');
    put(14, 23, 'E');
    put(14, 27, 'D');
    put(14, 10, '~');
  })
});

// 4. A climb over a wreck: up the stern, along the deck under a high plank, down the bow.
G.defineRoom({
  id: 'r1_wreck', region: 'r1', kind: 'main',
  map: paint(1, false, ({ put, fill }) => {
    fill(13, 14, 7, 9, '#');                  // stern step, 2 high
    fill(11, 14, 10, 19, '#');                // deck, 4 high (a jump from the stern step)
    put(8, 13, '====');                       // plank above the deck
    put(7, 15, 'C');
    put(10, 12, 'E');                         // crab on the deck
    fill(13, 14, 20, 22, '#');                // bow step, 2 high
    put(14, 15, '~');
    put(14, 25, 'E');
    put(12, 24, '~');
    put(14, 27, 'D');
  })
});

// 5. A low tunnel with brine spouts; a chimney in the roof holds a trunk.
G.defineRoom({
  id: 'r1_tunnel', region: 'r1', kind: 'main',
  map: paint(1, false, ({ put, fill }) => {
    fill(1, 10, 1, 28, '#');                  // roof (rows 11 to 14 open)
    fill(1, 10, 1, 28, '#');
    fill(6, 10, 14, 17, '.');                 // chimney
    fill(8, 10, 18, 19, 't');                 // optional tar pocket beside the chimney; fire opens it, main route ignores it
    fill(13, 14, 14, 17, '#');                // low step under the chimney
    put(10, 14, '====');                      // 3 tiles above the step
    put(9, 15, 'C');
    put(14, 10, 'E');
    put(14, 21, 'E');
    put(14, 24, 'E');
    put(14, 27, 'D');
  })
});

// 6. Dockyard split route, two screens wide.
//    LOW / SAFE: stay on the floor through sucking mud and small wreck steps. Slow, readable and always base-move safe.
//    HIGH / FAST: climb the first wreck and chain jumps across planks plus two crumbling ledges, bypassing most mud and ground enemies.
//    SECRET POCKET: a separate spring at the far quay launches into a high maintenance alcove holding the lost trunk; it is never required.
G.defineRoom({
  id: 'r1_dock', region: 'r1', kind: 'main', w: 2,
  map: paint(2, false, ({ put, fill }) => {
    // Safe low lane: no spikes, crumble or forced launch. Mud is the cost of taking the forgiving route.
    put(15, 4, 'mmmmmmmm');
    fill(13, 14, 14, 16, '#');                // low wreck step, only two tiles high
    put(15, 19, 'mmmmmmmmmm');
    fill(13, 14, 31, 33, '#');
    put(15, 36, 'mmmmmmmmmm');
    fill(13, 14, 48, 50, '#');

    // Fast upper lane. Every ordinary gap is within a base running jump; c tiles demand commitment but never block the low route.
    put(11, 12, '======');                    // climb from the first low wreck
    put(9, 20, '=====');
    put(10, 26, 'cc');                        // first collapsing transfer
    put(8, 29, '======');
    put(10, 36, 'cc');                        // second collapsing transfer
    put(11, 39, '======');                    // drops back beside the far quay

    // Independent secret/reward detour. Spring launch reaches the alcove; the player drops back to either route.
    put(15, 52, 'j');
    put(9, 49, '======');
    put(8, 52, 'C');

    // Encounters bias the slow lane; the high lane trades footing risk for fewer bodies and speed.
    put(14, 6, 'Q');                         // maintenance cart shuttles across the first mud stretch
    put(14, 9, 'E');
    put(14, 24, 'E');
    put(14, 42, 'E');
    put(14, 56, 'D');
  })
});

// The Tollkeeper's arena, the prototype's arena tile for tile: a hall (columns 0 to 2), the boss door (column 3,
// solid down to row 11 and open at rows 12 to 14), 25 tiles of floor and two perches at row 10.
G.defineRoom({
  id: 'r1_arena', region: 'r1', kind: 'arena',
  map: [
    WALL,
    '####.........................#', '####.........................#', '####.........................#',
    '####.........................#', '####.........................#', '####.........................#',
    '####.........................#', '####.........................#', '####.........................#',
    '####....###..........###.....#',                 // row 10: two high perches (5 up), shifted inward so the low perches below have headroom
    '...#.........................#',
    '....===...................===#',                  // row 12: escape perches (96 px up) against both walls: one jump from the corner
    '.............................#',
    '......................B......#',
    WALL, WALL
  ]
});

// Trial: climb the planks to the Dash signal post (base moves). Past the post an 8 tile gap leads to a slab that only a dash
// reaches; the way back is a drop to the floor, so skipping the gap costs nothing.
G.defineRoom({
  id: 'r1_trial', region: 'r1', kind: 'trial', label: 'Signal post',
  map: paint(1, true, ({ put, fill }) => {
    put(14, 3, 'D');
    put(12, 7, '====');
    put(9, 11, '====');
    put(6, 14, '======'); put(5, 17, 'M');
    fill(6, 7, 26, 28, '#');                  // far slab, 8 tiles of air from the post plank
    put(15, 22, '^^^^');                      // spikes under the drop, visible
    put(15, 22, '....');
  })
});

// The region's own branch room: the Sealed Cell. Its plinth lies at the end of a low tunnel (3 tiles of headroom, rock above) shut by a
// cracked barrier. Only a heavy cut (Heavy Cut, found in Ticket Hall's trial) breaks it; there is no way over, under or round.
G.defineRoom({
  id: 'r1_hold', region: 'r1', kind: 'branch', label: 'Sealed cell', needs: ['heavy'],
  signs: [],
  map: paint(1, true, ({ put, fill }) => {
    fill(1, 11, 12, 28, '#');                 // rock over the tunnel: rows 12 to 14 are all the headroom there is
    put(14, 3, 'D');
    put(14, 7, 'E'); put(14, 10, 'E'); put(6, 8, 'F');
    put(14, 17, 'X');                         // the cracked barrier, 3 tiles tall (rows 12 to 14)
    put(14, 22, 'E');                         // a crab inside, which the plinth's guard rule counts
    put(14, 26, 'I');
  })
});
})();
