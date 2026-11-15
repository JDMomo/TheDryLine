/* CONTENT: the Warden of region r1, The Tollkeeper. THE WORKED EXAMPLE: copy this file's structure for every other boss.
   Its movement, timings and numbers are ported unchanged from reference/prototype.html.

   How a boss file works
   - G.defineBoss registers the boss (all fields: js/game/bosses.js). The base class G.Boss already handles hp, the intro,
     fare-slot hits and punches, the 2.6 s stagger after a punch, contact damage, death and the Warden reward.
     This file only supplies the attacks (update), the poses (pose), the drawing (draw) and the fare slots (spots).
   - update(b, dt) is a small state machine. b.set(state, seconds) switches state; b.t counts down to zero.
     The base class puts the boss in 'idle' after the intro and after every stagger, so 'idle' must exist and must
     choose the next attack. The base class runs 'sleep', 'intro', 'stagger' and 'dead' itself; never set those.
   - Every attack has a tell (a pose the player can read, at least 12 frames), then the attack, then a 'recover'
     window where the boss can be hit.
   - Random choices that change the fight use G.run.rng (seeded, so a seed replays a run). Math.random and G.util.rnd
     are for dust and sparks only.
   - Hostile things are shots: b.shoot({ ... }) (fields: G.combat.shoot in js/game/combat.js).
   - Arena limits: b.minX and b.maxX are the furthest the boss's centre can go; b.floor is the floor y. The base class
     clamps b.x to them every step. The arena template decides them (see rooms_r1.js, r1_arena).
   - Boss space: x is forward (the way it faces), y is up-negative, the origin is at the feet. draw() is called in boss
     space, facing right; the base class flips it for b.face and applies pose(). b.toWorld(lx, ly) converts a boss-space
     point to the world, including facing and pose: use it for where shots come from.
   - b.flags is free-form state. onBreak sets flags; update reads them to drop or weaken an attack.

   Fare slots (spots), keyed by cut. Every boss has one per cut: pierce, arc, burst, ground.
   - name: what the player is told ("Eye punched"). local: [x, y] in boss space. r: radius. A strike reaches the slot
     when it comes within r + the strike's own radius.
   - exposed(b): optional. While false the slot cannot be hit (the Belly only shows when the boss rears or leaps).
   - accepts(b, strike): optional extra rule on how a strike must arrive (the Hump only from above, the Heel only
     from behind). strike has x, y, vx, vy, r, cls, itemId, owner.
   - onBreak(b): remove or weaken one attack. lost: one sentence telling the player what the boss lost.
   - A slot opens only if the party carries a token of its cut when the fight starts; sealed slots take no punches.
   - Keep the boss beatable with slashes alone. */
(() => {
'use strict';
const G = window.G, U = G.util, fx = G.fx;

// 'idle' calls this to pick the next attack. Rage (below half hp) shortens every tell by a quarter.
function chooseAttack(b) {
  const rng = G.run.rng, sp = b.rage ? 0.75 : 1;
  b.facePlayer();
  let opts = ['charge'];
  if (b.x >= b.minX + 133 && b.x <= b.maxX - 133) opts.push('leap');      // only leap when clear of the side perches
  if (!b.flags.blind) opts.push('spit');                                   // the punched Eye ends the spit
  if (opts.length > 1) opts = opts.filter(o => o !== b.last);              // never the same attack twice in a row
  const pick = rng.pick(opts); b.last = pick;
  if (pick === 'charge') b.set('chargeTell', 0.75 * sp);
  else if (pick === 'leap') b.set('leapTell', 0.5 * sp);
  else b.set('spitTell', 0.5 * sp);
}

// Shot painters: called in world space with the shot (s.x, s.y are its centre, or its bottom centre for a rect shot).
const paintGlob = (ctx, s) => {
  ctx.fillStyle = '#cfe3c0'; ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#f4fbe8'; ctx.beginPath(); ctx.arc(s.x - 2, s.y - 3, 3, 0, 6.283); ctx.fill();
};
const paintWave = (ctx, s) => {
  const d = Math.sign(s.vx), y = s.y;
  ctx.fillStyle = '#d8ceb4'; ctx.beginPath(); ctx.moveTo(s.x - d * 16, y); ctx.quadraticCurveTo(s.x - d * 4, y - 30, s.x + d * 12, y - 36);
  ctx.quadraticCurveTo(s.x + d * 16, y - 14, s.x + d * 12, y); ctx.closePath(); ctx.fill();
};

G.defineBoss({
  id: 'tollkeeper', name: 'The Tollkeeper', hp: 720, par: 76, w: 124, h: 100,

  spots: {
    pierce: { name: 'Eye', local: [66, -68], r: 15,
      onBreak(b) { b.flags.blind = true; }, lost: 'It can no longer spit.' },
    arc: { name: 'Hump', local: [-28, -104], r: 19,
      accepts: (b, st) => st.vy > 0,                                   // the lobbed shot must be falling onto it
      onBreak(b) { b.flags.noWaves = true; }, lost: 'Its landings no longer send shockwaves.' },
    burst: { name: 'Belly', local: [18, -8], r: 19,
      exposed: b => b.rear > 0.5 || b.y < b.floor - 20,                 // only when it rears up or is in the air
      onBreak(b) { b.flags.winded = true; }, lost: 'Its charge is slower.' },
    ground: { name: 'Heel', local: [-52, -12], r: 14,
      accepts: (b, st) => Math.sign(st.vx) === b.face,                  // must slide in from behind
      onBreak(b) { b.flags.lame = true; }, lost: 'Its leaps fall short.' }
  },

  // Own fields: rear 0..1 (rearing up), crouch 0..1 (squashed before a leap or spit), the last attack, charge distance, spit counters.
  init(b) { b.rear = 0; b.crouch = 0; b.last = ''; b.dist = 0; b.spitN = 0; b.spitT = 0; },

  // Rearing rotates the body about the back foot (-50, 0); crouching squashes it; a stagger makes it tremble.
  // Fare slots ride along: their world positions go through the same pose.
  pose(b) {
    const sq = b.crouch * 0.12;
    return { rot: -b.rear * 0.55, px: -50, py: 0, sx: 1 + sq, sy: 1 - sq, ox: b.state === 'stagger' ? Math.sin(G.time * 30) * 2 : 0 };
  },
  // While staggered the base class owns the state; this hook only lets the pose settle.
  staggered(b, dt) { b.rear = Math.max(0, b.rear - dt * 6); b.crouch = U.approach(b.crouch, 0, dt * 7); },

  update(b, dt) {
    const rng = G.run.rng, tgt = b.target(), sp = b.rage ? 0.75 : 1, dx = tgt.x - b.x;
    b.crouch = U.approach(b.crouch, b.state === 'leapTell' || b.state === 'spitTell' ? 1 : 0, dt * 7);
    switch (b.state) {
      case 'idle':                                   // shuffle toward the nearest player, then pick an attack
        b.facePlayer(); if (Math.abs(dx) > 110) b.x += b.face * 55 * dt;
        if (b.t <= 0) chooseAttack(b);
        break;
      case 'chargeTell':                             // rears up: the Belly is exposed
        b.rear = Math.min(1, b.rear + dt * 5);
        if (b.t <= 0) { b.set('charge', 1.7); b.dist = 0; }
        break;
      case 'charge': {
        b.rear = Math.max(0, b.rear - dt * 8);
        const v = (b.flags.winded ? 360 : 540) * (b.rage ? 1.12 : 1);
        b.x += b.face * v * dt; b.dist += v * dt;
        if (Math.random() < 0.5) fx.dust(b.x - b.face * 60, b.y, 1, -b.face);
        if (b.x <= b.minX || b.x >= b.maxX) { fx.jolt(0, 9); fx.dust(b.x + b.face * 70, b.y - 30, 10); b.set('recover', 1.0); }   // hit the wall: a long opening
        else if (b.t <= 0 || b.dist > 620) b.set('recover', 0.6);
        break;
      }
      case 'leapTell':                               // crouches, then jumps at where the target stands
        if (b.t <= 0) {
          const air = b.flags.lame ? 0.6 : 0.9, reach = b.flags.lame ? 260 : 480;
          b.vy = -1000 * air; b.vx = U.clamp((U.clamp(tgt.x, b.minX + 137, b.maxX - 137) - b.x) / air, -reach, reach);
          b.y -= 1; b.set('leap', 9); fx.dust(b.x, b.floor, 10);
        }
        break;
      case 'leap':                                   // in the air the Belly is exposed; landing sends two floor shockwaves
        b.vy += 2000 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y >= b.floor) {
          b.y = b.floor; b.vy = 0; fx.jolt(0, 12); fx.dust(b.x, b.floor, 16);
          if (!b.flags.noWaves) for (const d of [-1, 1])
            b.shoot({ x: b.x + d * 70, y: b.floor, vx: d * 430, life: 3, rect: { w: 26, h: 34 }, tile: 'pass', paint: paintWave });
          b.set('recover', 0.8);
        }
        break;
      case 'spitTell':
        if (b.t <= 0) { b.spitN = b.rage ? 5 : 3; b.spitT = 0; b.set('spit', 9); }
        break;
      case 'spit':                                   // a volley of lobbed globs aimed to land on the target
        b.spitT -= dt;
        if (b.spitT <= 0) {
          const m = b.toWorld(62, -38), tf = 0.72 + 0.09 * b.spitN, g = 1400;
          b.shoot({ x: m.x, y: m.y, vx: (tgt.x - m.x) / tf + rng.range(-40, 40), vy: (tgt.y - 24 - m.y) / tf - g * tf / 2, grav: g, life: 3, r: 9, paint: paintGlob });
          fx.spark(m.x, m.y, 5, '#cfe3c0', 160, 0.25);
          b.spitN--; b.spitT = 0.2; if (b.spitN <= 0) b.set('recover', 0.85);
        }
        break;
      case 'recover':                                // the opening after every attack
        b.rear = Math.max(0, b.rear - dt * 6);
        if (b.t <= 0) b.set('idle', rng.range(0.5, 1.0) * sp);
        break;
    }
  },

  // Boss space, facing right. The fare slots are drawn on top by the base class.
  draw(b, ctx) {
    const body = b.flash > 0 ? '#f4efe2' : (b.rage && b.state !== 'dead' ? '#4a3a3c' : '#39444a'), a0 = ctx.globalAlpha;
    ctx.fillStyle = '#1d2428'; for (const lx of [-52, -22, 14, 44]) ctx.fillRect(lx - 7, -16, 14, 16);                      // feet
    ctx.globalAlpha = a0 * 0.85; ctx.fillStyle = '#c9783a'; ctx.beginPath(); ctx.ellipse(8, -10, 46, 12, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = a0;   // furnace belly
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-72, -8); ctx.bezierCurveTo(-86, -70, -52, -108, -6, -108);
    ctx.bezierCurveTo(44, -108, 74, -80, 72, -34); ctx.lineTo(66, -8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#232b30'; ctx.lineWidth = 3;                                                                          // shell plates
    for (const o of [-40, -8, 24]) { ctx.beginPath(); ctx.moveTo(o, -104 + Math.abs(o + 8) * 0.2); ctx.quadraticCurveTo(o + 10, -60, o - 4, -12); ctx.stroke(); }
    ctx.fillStyle = '#d8ceb4'; ctx.beginPath(); ctx.moveTo(46, -92); ctx.quadraticCurveTo(80, -84, 78, -40); ctx.quadraticCurveTo(66, -22, 50, -30); ctx.closePath(); ctx.fill();   // face plate
    ctx.fillStyle = '#1a1410'; ctx.fillRect(58, -40, 16, 5);                                                                 // mouth slit
  }
});
})();
