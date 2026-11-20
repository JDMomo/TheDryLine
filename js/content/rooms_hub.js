/* Authored Junction: a two-screen-tall station district, not a flat gate menu. */
(() => {
'use strict';
const G=window.G, W=120, H=34;
const g=Array.from({length:H},()=>Array(W).fill('.'));
const fill=(r0,r1,c0,c1,ch)=>{for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)if(r>=0&&r<H&&c>=0&&c<W)g[r][c]=ch;};
const put=(r,c,ch)=>{g[r][c]=ch;};

// World shell. The lower concourse is always safe and continuously walkable.
fill(0,1,0,W-1,'#'); fill(32,33,0,W-1,'#');
fill(0,H-1,0,1,'#'); fill(0,H-1,W-2,W-1,'#');

// LOWER DISTRICT — five gate platforms separated by architectural bays, not hazards.
for(const c of [8,36,52,84,112]){
  fill(29,31,c-4,c-3,'#'); fill(29,31,c+3,c+4,'#'); // arch feet
  fill(27,28,c-4,c+4,'#');                           // lintel
}
// ARRIVAL SHELTER / KEEPER bay.
// The uprights stop above walking height: this must read as a canopy, never as a sealed starting box.
fill(26,26,57,72,'#'); fill(27,29,57,58,'#'); fill(27,29,71,72,'#');
put(31,61,'P'); put(31,65,'N');
put(31,46,'?'); put(31,75,'?');

// Service objects are spaced into their own readable bays.
put(31,43,'R');                        // ticket machine: its own clear service bay
put(31,77,'S');                        // kiosk stock: readable between shelter and Gate 4

// LOWER LANDMARKS — low luggage / machinery masses break the 4-screen run into recognizable chunks.
fill(30,31,17,20,'#'); fill(29,31,21,22,'#');
fill(30,31,37,39,'#');
fill(30,31,98,101,'#'); fill(29,31,102,103,'#');

// UPPER FOOTBRIDGE — optional traversal loop across most of the Junction.
// It is intentionally one-way flooring so jumps pass through cleanly from below.
fill(20,20,13,106,'=');
fill(17,17,28,42,'=');   // old dispatch balcony
fill(16,16,76,91,'=');   // maintenance overlook
fill(13,13,52,67,'=');   // high clock balcony

// Two broad stair-like climbs make the upper district base-movement accessible.
fill(30,31,12,15,'#'); fill(28,31,16,19,'#'); fill(26,31,20,23,'#'); fill(24,31,24,27,'#'); fill(22,31,28,31,'#');
fill(30,31,105,108,'#'); fill(28,31,101,104,'#'); fill(26,31,97,100,'#'); fill(24,31,93,96,'#'); fill(22,31,89,92,'#');

// Intermediate shelves make climbing/down-climbing forgiving.
fill(25,25,33,42,'='); fill(23,23,47,56,'='); fill(25,25,64,73,'='); fill(23,23,78,87,'=');

// Upper station architecture: a clock plinth and two roof fragments create silhouettes without closing routes.
fill(10,12,58,61,'#'); fill(8,9,55,64,'#');
fill(11,11,18,32,'#'); fill(11,11,87,101,'#');

// A quiet maintenance nook above the shelter. It has no reward dependency; it exists to make the hub feel inhabited.
fill(15,15,44,49,'='); fill(14,14,46,47,'#');
put(14,45,'?');

// Gates are stamped LAST so stair/roof architecture can never erase an exit marker.
put(31,8,'G'); put(31,36,'G'); put(31,52,'G'); put(31,84,'G'); put(31,112,'G');

G.defineRoom({
  id:'junction', region:'hub', kind:'hub', w:4, h:2,
  map:g.map(row=>row.join('')),
  decor:[
    {type:'crate_decor',c:18,r:31},{type:'crate_decor',c:38,r:31},{type:'crate_decor',c:99,r:31},
    {type:'banner_decor',c:7,r:27},{type:'banner_decor',c:51,r:27},{type:'banner_decor',c:111,r:27},{type:'banner_decor',c:59,r:13},
    {type:'lamp_decor',c:12,r:31},{type:'lamp_decor',c:24,r:31},{type:'lamp_decor',c:43,r:31},
    {type:'lamp_decor',c:61,r:31},{type:'lamp_decor',c:79,r:31},{type:'lamp_decor',c:96,r:31},{type:'lamp_decor',c:115,r:31},
    {type:'lamp_decor',c:34,r:20},{type:'lamp_decor',c:85,r:20}
  ],
  signs:[
    'Five region gates remain open under the emergency timetable.',
    'Tokens carry four cuts. Match a cut to a Warden fare slot to punch its order.',
    'A punched token is void. The final cancellation still waits at TERMINUS.'
  ]
});
})();