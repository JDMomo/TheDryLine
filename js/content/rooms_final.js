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

// Last Buffers — two-screen Terminus arrival.
// The first half is almost empty: old platform, dead signal, long view. The second half quietly reprises salt/mud and one enemy.
// This is the breath before the final machine sequence, not another gauntlet.
G.defineRoom({ id: 'final_buffers', region: 'final', kind: 'main', w: 2,
  signs: ['TERMINUS. LAST SERVICE STILL POSTED. No arrivals recorded after the sea withdrew.'],
  map: paint(2, 1, [
      [9, 13, 11, 14, '#'], [18, 12, 20, 14, '#'],
      [7, 10, 14, 10, '='], [17, 8, 23, 8, '='],
      [31, 15, 38, 15, 's'], [42, 15, 49, 15, 'm'],
      [34, 11, 41, 11, '='], [46, 9, 53, 9, '='],
      [3, 1, 9, 3, '#'], [50, 1, 57, 3, '#']
    ],
    [[24, 14, '?'], [38, 14, 'E'], [50, 14, 'E'], [55, 14, 'D']]) });

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

/* ---------- Authored Terminus campaign spine ---------- */
(() => {
  const wide=(id,build,signs=[])=>{
    const W=60,H=17,g=Array.from({length:H},()=>Array(W).fill('.'));
    g[0].fill('#');g[15].fill('#');g[16].fill('#');
    for(let r=0;r<H;r++)if(r<12||r>14){g[r][0]='#';g[r][W-1]='#';}
    const fill=(r0,r1,c0,c1,ch)=>{for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)g[r][c]=ch;};
    const put=(r,c,ch)=>g[r][c]=ch;
    build({g,fill,put,W,H});
    G.defineRoom({id,region:'final',kind:'main',w:2,map:g.map(x=>x.join('')),signs});
  };

  // 1. Last Buffers — recognition room. Familiar materials appear in calm, non-lethal combinations.
  wide('final_buffers',({fill,put})=>{
    fill(14,14,5,11,'m'); fill(14,14,16,24,'s'); fill(15,15,30,38,'>'); fill(15,15,42,50,'<');
    fill(12,14,13,15,'#'); fill(12,14,25,27,'#'); fill(12,14,52,54,'#');
    fill(10,10,8,14,'='); fill(9,9,19,26,'='); fill(10,10,35,42,'='); fill(9,9,47,54,'=');
    // One familiar attacker from the old lines at a time; this room is about recognition, not attrition.
    put(13,9,'E'); put(14,47,'E');
    put(14,56,'D'); put(13,5,'?');
  },['TERMINUS BUFFER ROAD — all local services feed the final clock.']);

  // 2. Steam Gallery — movement payoff. Low route is always valid; spring/vent timing creates a faster upper transit line.
  wide('final_vents',({fill,put})=>{
    fill(13,14,13,15,'#'); fill(12,14,27,29,'#'); fill(13,14,43,45,'#');
    put(15,9,'j'); put(15,24,'v'); put(15,39,'j'); put(15,50,'v');
    fill(10,10,7,14,'='); fill(8,8,18,27,'='); fill(7,7,32,41,'='); fill(9,9,45,54,'=');
    // Overhead pipe masses define chambers without blocking the floor.
    fill(4,4,4,19,'#'); fill(3,3,25,40,'#'); fill(4,4,46,56,'#');
    put(14,17,'E'); put(14,34,'E'); put(8,23,'F'); put(8,49,'F');
    put(14,56,'D'); put(14,5,'?');
  },['Steam pressure remains scheduled even though no train has arrived in years.']);

  // 3. Clockworks — compression/payoff. All learned movement language appears, but the required route remains readable and fair.
  wide('final_gearworks',({fill,put})=>{
    fill(15,15,5,15,'>'); fill(15,15,21,31,'<'); fill(15,15,38,49,'>');
    fill(14,14,16,20,'s'); fill(14,14,32,36,'m');
    fill(12,14,18,20,'#'); fill(11,14,34,36,'#'); fill(12,14,51,53,'#');
    // High rail: stable -> crumble -> stable -> crumble -> final stable line.
    fill(10,10,7,14,'='); fill(9,9,16,22,'='); fill(10,10,24,25,'c');
    fill(8,8,28,35,'='); fill(10,10,38,39,'c'); fill(9,9,42,49,'='); fill(8,8,51,56,'=');
    put(15,27,'j'); put(15,46,'v');
    // Final optional cache uses tar as a material-memory check, never a key.
    fill(5,7,55,56,'t'); put(4,56,'C');
    // Encounters live on actual floor lanes; none are hidden inside the clock housings.
    put(14,10,'E'); put(14,25,'E'); put(14,41,'E'); put(14,50,'E'); put(7,33,'F');
    put(14,56,'D'); put(14,5,'?');
  },['The maintenance slate is explicit: a valid timetable can only be cancelled by final authority.']);
})();


Object.assign(G.roomDefs.final_buffers,{enemyPlan:['ballast_crab','mirage']});
Object.assign(G.roomDefs.final_vents,{enemyPlan:['handcar','harvester'],flyerPlan:['signal_gull','lamp_wisp']});
Object.assign(G.roomDefs.final_gearworks,{enemyPlan:['turnstile','sapper','mirage','harvester'],flyerPlan:['signal_gull']});
delete G.roomDefs.final_tower;

})();
