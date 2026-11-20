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

// Coral Stair — two-screen arrival along the reef face.
// First screen is broad and quiet enough to read the painted cavern; the second screen introduces a single elevated flyer
// and a rising lamp-stair. The upper line is optional and reconnects to the floor before the exit.
(() => {
  const g=exits(blank(2,1),true,true);
  // calm reef shelf / old signal landing
  fill(g,13,14,8,11,'#');
  put(g,11,15,20,'=');
  mark(g,14,22,'E');

  // second-screen stair: alternating coral shelves with safe floor beneath
  put(g,12,32,38,'=');
  put(g,9,40,46,'=');
  put(g,6,48,54,'=');
  put(g,11,51,57,'=');
  mark(g,8,43,'F');
  mark(g,5,51,'C');
  mark(g,14,56,'D');
  G.defineRoom({id:'r2_spire',region:'r2',kind:'main',w:2,map:done(g)});
})();

// Signal Shelves — a deliberate rise to the old relay terrace.
// Low route stays on solid coral steps; the high route uses broad one-way shelves and sees the branch doorway early.
// Enemies are separated by elevation so ranged/flying jobs do not stack on the entrance.
(() => {
  const g=exits(blank(2,1),true,true);
  fill(g,13,14,7,11,'#');
  fill(g,11,14,12,18,'#');
  fill(g,13,14,19,23,'#');
  put(g,10,12,20,'=');
  put(g,8,24,31,'=');
  fill(g,12,14,33,37,'#');
  put(g,9,39,46,'=');
  fill(g,13,14,48,52,'#');
  mark(g,7,27,'D');
  mark(g,14,25,'E');
  mark(g,7,42,'F');
  mark(g,12,50,'E');
  G.defineRoom({id:'r2_shelves',region:'r2',kind:'main',w:2,map:done(g)});
})();

// The Lamp Shaft: a true two-screen vertical route. It enters from below and leaves through the roof.
// Alternating shelves make the required climb possible with base movement in either direction; Wall Grip is a faster straight-line option.
// A branch doorway sits on the left shelf, while the lost trunk is an optional jump into the right-hand maintenance pocket.
(() => {
  const g = blank(1, 2);
  fill(g, 1, 31, 1, 5, '#'); fill(g, 1, 31, 24, 28, '#');          // coral walls: broad enough to read as a shaft, room in the middle to cross
  for (let c = 14; c <= 16; c++) { g[0][c] = '.'; for (let r = 30; r < 34; r++) g[r][c] = '.'; }  // top and bottom route ports

  // Safe stair: every rise is <= 3 tiles. One-way shelves make the downward trip a controlled drop rather than a dead end.
  for (const [r, c0, c1] of [[29,8,12],[27,15,19],[24,8,12],[21,15,19],[18,8,12],[15,15,19],[12,7,12],[9,15,19],[6,8,12],[3,13,17]])
    put(g, r, c0, c1, '=');

  // Fast/risky route: three timed vents sit just off the safe stair. Catching their pulses skips multiple shelf changes.
  // Missing one only drops the player back onto the ordinary stair, so the shortcut is never required.
  mark(g, 29, 13, 'v'); mark(g, 21, 13, 'v'); mark(g, 12, 13, 'v');

  // Optional reward pocket: a lateral jump off the safe stair, visually away from the central vent line.
  put(g, 19, 19, 23, '='); mark(g, 18, 21, 'C');
  mark(g, 11, 9, 'D');
  mark(g, 28, 10, 'E'); mark(g, 23, 17, 'F'); mark(g, 14, 11, 'F'); mark(g, 8, 17, 'F');

  G.defineRoom({ id: 'r2_shaft', region: 'r2', kind: 'main', h: 2, route: ['bottom', 'top'], map: done(g) });
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
  mark(g, 22, 5, 'E'); mark(g, 28, 24, 'E');
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

/* ---------- Authored Signal Reef campaign spine ---------- */
(() => {
  const wide=(id,build,signs=[])=>{
    const W=60,H=17,g=Array.from({length:H},()=>Array(W).fill('.'));
    g[0].fill('#');g[15].fill('#');g[16].fill('#');
    for(let r=0;r<H;r++)if(r<12||r>14){g[r][0]='#';g[r][W-1]='#';}
    const fill=(r0,r1,c0,c1,ch)=>{for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)g[r][c]=ch;};
    const put=(r,c,ch)=>g[r][c]=ch;
    build({g,fill,put,W,H});
    G.defineRoom({id,region:'r2',kind:'main',w:2,map:g.map(x=>x.join('')),signs});
  };

  // 1. Coral Stair — introduction: mostly ground movement, then an optional elevated lamp route.
  wide('r2_spire',({fill,put})=>{
    fill(13,14,12,14,'#'); fill(12,14,28,30,'#'); fill(13,14,45,47,'#');
    fill(11,11,16,22,'='); fill(9,9,25,31,'='); fill(10,10,35,41,'='); fill(8,8,46,52,'=');
    // Signal-mast silhouettes are represented by narrow solid pylons that never block the low route.
    fill(4,10,7,7,'#'); fill(3,10,54,54,'#');
    put(14,18,'E'); put(14,40,'E'); put(9,38,'F');
    put(14,56,'D'); put(14,5,'?');
  },['SIGNAL REEF — lamps repeat until acknowledged.']);

  // 2. Lamp Shaft — the region's identity room: a real two-screen vertical climb.
  {
    const W=30,H=34,g=Array.from({length:H},()=>Array(W).fill('.'));
    for(let r=0;r<H;r++){g[r][0]='#';g[r][W-1]='#';}
    g[0].fill('#');g[H-1].fill('#');
    for(let c=13;c<=16;c++){g[0][c]='.';g[H-1][c]='.';}
    const fill=(r,c0,c1,ch)=>{for(let c=c0;c<=c1;c++)g[r][c]=ch;};
    const put=(r,c,ch)=>g[r][c]=ch;
    // Safe zig-zag shelves. Every rise is base-jump reachable and every miss lands lower in the shaft.
    [[30,6,11],[27,15,20],[24,7,12],[21,16,21],[18,6,11],[15,15,20],[12,7,12],[9,16,21],[6,8,13],[3,13,18]]
      .forEach(([r,a,b])=>fill(r,a,b,'='));
    // Fast center line: timed vents skip several shelf changes, but are never required.
    put(30,14,'v');put(22,14,'v');put(14,14,'v');
    // Reward alcove and branch doorway are off the safe line rather than on it.
    fill(19,20,26,'='); put(18,23,'C');
    fill(22,4,8,'='); put(21,6,'D');
    put(29,9,'E'); put(20,18,'F'); put(11,10,'F'); put(5,18,'F');
    G.defineRoom({id:'r2_shaft',region:'r2',kind:'main',h:2,route:['bottom','top'],map:g.map(x=>x.join('')),
      signs:['The lamps above are repeating the same departure code.']});
  }

  // 3. Gull Roost — teaches aerial space: broad safe floor, high perches, spring as an optional intercept tool.
  wide('r2_roost',({fill,put})=>{
    fill(13,14,10,13,'#'); fill(12,14,25,28,'#'); fill(13,14,43,46,'#');
    fill(9,9,7,14,'='); fill(7,7,19,27,'='); fill(9,9,32,40,'='); fill(6,6,45,53,'=');
    put(15,17,'j'); put(15,41,'j');
    put(8,11,'F'); put(6,23,'F'); put(8,36,'F'); put(5,49,'F');
    // Harvester/support anchor on the ground creates a target-priority lesson beneath the flyers.
    put(14,31,'E'); put(14,52,'E');
    put(14,56,'D'); put(14,4,'?');
  },['The roost was built around the signal masts, not the other way around.']);

  // 4. Beacon Tower — combines vertical route choice, steam timing and aerial pressure before Lamp-Heron.
  wide('r2_tower',({fill,put})=>{
    fill(13,14,8,10,'#'); fill(11,14,20,22,'#'); fill(9,14,32,34,'#'); fill(12,14,46,48,'#');
    fill(10,10,11,18,'='); fill(8,8,23,30,'='); fill(7,7,35,42,'='); fill(9,9,48,54,'=');
    // Steam can boost from low route to high route; ordinary jumps/stairs still clear the room.
    put(15,16,'v'); put(15,39,'v');
    fill(3,10,56,56,'#'); // overhead beacon mast silhouette; floor route remains open
    put(14,14,'E'); put(14,37,'E'); put(9,27,'F'); put(6,39,'F');
    put(14,53,'D'); put(14,5,'?');
  },['BEACON 4 — cancellation relay never acknowledged.']);
})();


Object.assign(G.roomDefs.r2_spire,{enemyPlan:['ballast_crab','harvester'],flyerPlan:['signal_gull']});
Object.assign(G.roomDefs.r2_shaft,{enemyPlan:['ballast_crab'],flyerPlan:['signal_gull','lamp_wisp','signal_gull']});
Object.assign(G.roomDefs.r2_roost,{enemyPlan:['harvester','ballast_crab'],flyerPlan:['signal_gull','signal_gull','lamp_wisp','signal_gull']});
Object.assign(G.roomDefs.r2_tower,{enemyPlan:['harvester','ballast_crab'],flyerPlan:['signal_gull','lamp_wisp']});
// Superseded procedural-era mains are deliberately not part of the authored campaign/fallback pool.
delete G.roomDefs.r2_shelves; delete G.roomDefs.r2_ledges;

})();
