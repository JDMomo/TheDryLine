/* CONTENT: branch rooms any region may use (region: 'shared', kind: 'branch'). Each has exactly one D (the way back),
   closed edges, no enemies, and a label that names it on the doorway leading in.
   Two ticket-machine rooms and two kiosks (three wares each; a run uses one of each), and one quiet standpipe room for the Terminus.
   (The clipping-booth rooms were removed: the booth is no longer part of a run.) */
(() => {
'use strict';
const G = window.G;
// Build a 1 x 1 branch room from a blank hall: rects of a character, then single markers.
function hall(rects, marks) {
  const g = [];
  for (let r = 0; r < 17; r++) g.push([...(r === 0 || r >= 15 ? '#'.repeat(30) : '#' + '.'.repeat(28) + '#')]);
  for (const [c0, r0, c1, r1, ch] of rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch;
  for (const [c, r, ch] of marks) g[r][c] = ch;
  return g.map(r => r.join(''));
}

// Ticket machine, the booking office: a low ceiling slab over the machine and a bench of planks.
G.defineRoom({ id: 'side_ticket_office', region: 'shared', kind: 'branch', label: 'Ticket machine',
  map: hall([[6, 1, 24, 9, '#'], [10, 11, 13, 11, '=']], [[3, 14, 'D'], [15, 14, 'R']]) });
// Ticket machine on a brass dais, planks above like a luggage rack.
G.defineRoom({ id: 'side_ticket_dais', region: 'shared', kind: 'branch', label: 'Ticket machine',
  map: hall([[16, 14, 24, 14, '#'], [6, 10, 13, 10, '='], [4, 1, 6, 5, '#']], [[3, 14, 'D'], [20, 13, 'R']]) });
// Kiosk on a long counter.
G.defineRoom({ id: 'side_kiosk_counter', region: 'shared', kind: 'branch', label: 'Kiosk',
  map: hall([[9, 14, 21, 14, '#'], [10, 9, 20, 9, '=']], [[3, 14, 'D'], [12, 13, 'S'], [15, 13, 'S'], [18, 13, 'S']]) });
// Kiosk under a hung awning, door on the right.
G.defineRoom({ id: 'side_kiosk_awning', region: 'shared', kind: 'branch', label: 'Kiosk',
  map: hall([[7, 1, 18, 3, '#'], [8, 10, 18, 10, '='], [24, 12, 27, 14, '#']], [[22, 14, 'D'], [9, 14, 'S'], [13, 14, 'S'], [17, 14, 'S']]) });
// A quiet stop for the Terminus: the standpipe under a run of pipes.
G.defineRoom({ id: 'side_standpipe', region: 'shared', kind: 'branch', label: 'Standpipe',
  map: hall([[1, 1, 28, 2, '#'], [14, 3, 15, 5, '#'], [9, 11, 13, 11, '=']], [[3, 14, 'D'], [24, 14, 'H']]) });
})();
