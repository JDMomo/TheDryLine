/* CONTENT: the hub, The Junction. One room of kind 'hub' with a P (party start), one G gate per region (left to right in gate order:
   r1, r2, r3, r4, then the Terminus), a standpipe H and three signs (?, read left to right, texts in signs[]). No enemies. */
(() => {
'use strict';
const G = window.G;
const WALL = '##############################', OPEN = '#............................#';

// A turntable platform: a calm floor with planks overhead (kept clear of the gate labels, which float at row 10). Gates at columns 3, 8, 13, 19, 24 (a run apart, all on the floor).
G.defineRoom({
  id: 'junction', region: 'hub', kind: 'hub',
  signs: ['Tokens open a Warden\'s fare slots. Match the shape. The board shows each Warden\'s three.',
    'The party carries three tokens. A punched token is void. Choose where each one goes.',
    'Every gate is open. The Long Clock is waiting too.'],
  map: [
    WALL, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
    '#.........==============.....#',
    OPEN,
    '#........===.............===.#',
    OPEN, OPEN,
    '#..G.?.G..?..G..P..G.?.G..H..#',
    WALL, WALL
  ]
});
})();
