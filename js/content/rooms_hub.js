/* CONTENT: The Junction. This is an authored place, not a menu with five doors.
   Three screens wide: arrival platform -> turntable concourse -> Terminus annex. No enemies. */
(() => {
'use strict';
const G=window.G;
const W=90,H=17,g=Array.from({length:H},()=>Array(W).fill('.'));
for(let c=0;c<W;c++){g[0][c]='#';g[15][c]='#';g[16][c]='#';}
for(let r=0;r<H;r++){g[r][0]='#';g[r][W-1]='#';}
const fill=(r0,r1,c0,c1,ch)=>{for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)g[r][c]=ch;};
const put=(r,c,t)=>{for(let i=0;i<t.length;i++)g[r][c+i]=t[i];};

// WEST — arrival shelter. Low roof, warm standpipe, first story sign, view into the larger station.
fill(2,8,2,20,'#');
fill(9,9,5,17,'=');
fill(12,14,21,23,'#');
put(14,7,'P'); put(14,12,'?'); put(14,17,'H');

// CENTRAL — broad turntable floor with an upper catwalk. Gates are spaced as landmarks, not adjacent menu buttons.
put(10,27,'==========');
put(8,40,'============');
put(10,55,'==========');
fill(13,14,37,39,'#'); fill(12,14,50,52,'#');
put(14,29,'G'); put(14,40,'G'); put(14,51,'G');
put(14,34,'?'); put(14,46,'?');

// EAST — old departures annex. Ticket Hall and Terminus stand apart under a taller clock canopy.
fill(3,7,64,87,'#');
put(8,66,'====================');
fill(12,14,71,73,'#');
put(14,67,'G'); put(14,82,'G'); put(14,76,'?');

G.defineRoom({
 id:'junction',region:'hub',kind:'hub',w:3,
 signs:[
  'The Last Timetable names one service that was never cancelled. The five lit gates still obey it.',
  'Each Warden holds one local order. Releasing them makes the Long Clock less dangerous.',
  'The lines are places, not stages. Follow the lamps, machinery and old public signs when the route forks.',
  'The Terminus is open now. It is also strongest now.'
 ],
 map:g.map(row=>row.join(''))
});
})();