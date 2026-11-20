/* CONTENT: the Warden of region r4 (Ticket Hall), The Gatewhale. Structure copied from boss_r1.js.
   A whale-shaped engine that rides the arena floor on rails. Attacks (each: tell, attack, recover window):
     roll   rocks back, lamp flashing, floor chevrons mark the lane; then rolls to the far wall (jump it, dash, or stand on a platform or crate)
     crates opens its jaw; brackets mark three floor spots; crates drop there and stay as short-lived pillars (the way over its body)
     spawn  opens its jaw wide and coughs out Ballast Crabs (at most two alive at once)
     spin   shakes, then vents a spiral of steam from the blowhole (move through the gaps)
   Fare slots and what a punch removes (set in onBreak, read in update):
     arc    Blowhole Valve (top, lobbed shots falling onto it)  -> thinner steam spiral
     pierce Headlamp (front, only when it has stopped)           -> no crates (the lamp marks the drop spots)
     burst  Jaw Hinge (only while the jaw is open)               -> no summons
     ground Wheel Truck (front wheel, only when it has stopped)  -> slower roll
   Below half health: every tell is a quarter shorter (never under 0.35 s) and the spiral reverses direction half way through.
   When it dies the onDeath hook clears the crates; the crabs it summoned with b.summon() are killed by the base class. */
(() => {
'use strict';
const G = window.G, U = G.util, fx = G.fx, T = G.C.T;

const OUT = '#0d1610', HULL = '#2d5a3f', HULL2 = '#1f4030', HULL3 = '#3b7050', BRASS = '#b8913c', BRASS2 = '#c8b678', DARK = '#14201a', WARN = '#B8482F';
const TELLS = { rollTell: 1, crateTell: 1, spawnTell: 1, spinTell: 1 };

function chooseAttack(b) {
  const rng = G.run.rng, f = b.flags;
  b.facePlayer();
  let opts = ['roll', 'spin'];
  if (b.available('crates')) opts.push('crates');
  if (b.available('spawn') && (b.ownedAlive('ballast_crab').length < 2 || f.noCrates)) opts.push('spawn');   // keeps the Jaw Hinge reachable once crates are gone
  opts = opts.filter(o => o !== b.last);
  const pick = rng.pick(opts); b.last = pick;
  if (pick === 'crates') markCrates(b);
  b.begin(pick);                                                           // tell and wind-up come from the registry below
}

// The attack registry (js/game/bosses.js documents the fields). Wind-ups are scaled by 0.75 when enraged.
G.defineAttacks('gatewhale', {
  roll: { name: 'Roll', tell: 'rollTell', wind: 0.7, strike: ['roll'], strikeT: 3.2, recover: 0.9, dodge: 'jump',
    fair: 'It rocks back with the lamp flashing and chevrons mark the lane for 0.7 s; then it rolls to the far wall. Jump it, dash it, or stand on a platform or crate.',
    slots: [{ cut: 'ground', flag: 'slowRoll', mode: 'weaken', note: 'the roll is slower (235 instead of 335 px/s)' }] },
  crates: { name: 'Crate Drop', tell: 'crateTell', wind: 0.8, strike: ['crates'], strikeT: 1.0, recover: 0.9, dodge: 'move',
    fair: 'The jaw opens and brackets mark three floor spots for 0.8 s; crates drop there and stay as short-lived pillars.',
    slots: [{ cut: 'pierce', flag: 'noCrates', mode: 'disable', note: 'it can no longer mark and drop crates' }] },
  spawn: { name: 'Cough Up Crabs', tell: 'spawnTell', wind: 0.6, strike: ['spawn'], strikeT: 0.5, recover: 1.1, dodge: 'cut',
    fair: 'The jaw opens wide for 0.6 s, then it coughs out Ballast Crabs (at most two alive). The open jaw shows the Jaw Hinge.',
    slots: [{ cut: 'burst', flag: 'noSummons', mode: 'disable', note: 'it can no longer release crabs' }] },
  spin: { name: 'Steam Spiral', tell: 'spinTell', wind: 0.75, strike: ['spin'], strikeT: 2.3, recover: 1.2, dodge: 'move',
    fair: 'It shakes and glows at the valve for 0.75 s, then vents a spiral of steam from the blowhole. Move through the gaps.',
    slots: [{ cut: 'arc', flag: 'thin', mode: 'weaken', note: 'one arm of steam instead of two, wider gaps' }] }
});

// Pick up to three floor columns: one under each player, the rest scattered near them. Shown as brackets during the tell.
function markCrates(b) {
  const rng = G.run.rng, c0 = Math.ceil((b.minX - 40) / T) + 1, c1 = Math.floor((b.maxX + 40) / T) - 1, cols = [];
  const add = c => { c = U.clamp(c, c0, c1); if (!cols.includes(c) && cols.length < 3) cols.push(c); };
  for (const p of G.players) if (!p.down) add(Math.floor(p.x / T));
  const t = b.target();
  for (let i = 0; i < 12 && cols.length < 3; i++) add(Math.floor(t.x / T) + rng.int(11) - 5);
  b.marks = cols;
}

// Shot painter for steam: a pale puff with a dark rim.
const paintSteam = (ctx, s) => {
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#e4efe0'; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 6.283); ctx.fill();
};

// Crates: { c column, x, y bottom, vy, st 'fall' | 'land' | 'stand', life, bl blocker }. They fall hurting, then become a 1 x 2 tile pillar.
function updateCrates(b, dt) {
  const fr = Math.round(b.floor / T);
  for (let i = b.crates.length - 1; i >= 0; i--) {
    const k = b.crates[i]; let gone = false;
    if (k.st === 'fall') {
      k.vy += 1800 * dt; k.y += k.vy * dt;
      G.combat.hurtPlayers({ x0: k.x - 15, x1: k.x + 15, y0: k.y - 64, y1: k.y }, k.x);
      if (k.y >= b.floor) { k.y = b.floor; k.st = 'land'; k.wait = 0; fx.jolt(0, 7); fx.dust(k.x, b.floor, 10); }
    } else if (k.st === 'land') {                 // become solid only once nobody stands in the column
      k.wait += dt;
      const r = { x0: k.x - 16, x1: k.x + 16, y0: b.floor - 64, y1: b.floor };
      if (k.wait > 2 || !G.players.some(p => !p.down && U.overlap(p.rect(), r))) {
        k.bl = { c: k.c, r0: fr - 2, r1: fr - 1, on: true }; G.tiles.blockers.push(k.bl); k.st = 'stand'; k.life = 7;
      }
    } else {
      k.life -= dt;
      const rolling = b.state === 'roll' && Math.abs(k.x - b.x) < b.w / 2 + 16;
      if (k.life <= 0 || rolling) { gone = true; fx.spark(k.x, b.floor - 32, 14, '#9a7b3a', 260, 0.5); fx.dust(k.x, b.floor, 8); }
    }
    if (gone) { if (k.bl) { const j = G.tiles.blockers.indexOf(k.bl); if (j >= 0) G.tiles.blockers.splice(j, 1); } b.crates.splice(i, 1); }
  }
}
function clearCrates(b) {
  for (const k of b.crates) if (k.bl) { const j = G.tiles.blockers.indexOf(k.bl); if (j >= 0) G.tiles.blockers.splice(j, 1); }
  b.crates.length = 0;
}

G.defineBoss({
  id: 'gatewhale', name: 'The Gatewhale', hp: 780, par: 119, w: 150, h: 84,
  interp: ['spin', 'jaw'],
  onDeath(b) { clearCrates(b); },                  // the crabs it summoned are killed by the base class

  spots: {
    arc: { name: 'Blowhole Valve', local: [-10, -108], r: 17,
      accepts: (b, st) => st.vy > 0,                                       // the lobbed shot must be falling onto it
      onBreak(b) { b.flags.thin = true; }, lost: 'Its steam spiral is thinner.' },
    pierce: { name: 'Headlamp', local: [76, -38], r: 14,
      exposed: b => b.state !== 'roll',                                    // only when it has stopped
      onBreak(b) { b.flags.noCrates = true; b.marks = []; }, lost: 'It can no longer mark and drop crates.' },
    burst: { name: 'Jaw Hinge', local: [28, -52], r: 17,
      exposed: b => b.jaw > 0.6,                                           // only while the mouth is open
      onBreak(b) { b.flags.noSummons = true; }, lost: 'It can no longer release crabs.' },
    ground: { name: 'Wheel Truck', local: [68, -12], r: 16,
      exposed: b => b.state !== 'roll',
      onBreak(b) { b.flags.slowRoll = true; }, lost: 'Its roll is slower.' }
  },

  // Own fields: jaw 0..1 (mouth open), spin (wheel angle), crates, marks (columns marked for the next drop), steam counters, roll distance.
  init(b) {
    b.jaw = 0; b.spin = 0; b.last = ''; b.crates = []; b.marks = []; b.steamT = 0; b.steamA = 0; b.steamD = 1; b.lampOn = 1; b.flipped = false; b.dist = 0;
  },

  pose(b) { return { ox: TELLS[b.state] ? Math.sin(G.time * 70) * 1.6 : (b.state === 'stagger' ? Math.sin(G.time * 30) * 2 : 0), sy: 1 - (b.state === 'rollTell' ? 0.05 : 0) }; },
  staggered(b, dt) { b.jaw = U.approach(b.jaw, 0, dt * 3); b.marks = []; b.lampOn = 0; updateCrates(b, dt); },

  update(b, dt) {
    const rng = G.run.rng, tgt = b.target(), sp = b.rage ? 0.75 : 1, dx = tgt.x - b.x, f = b.flags;
    b.lampOn = b.state === 'roll' ? 0 : 1;
    b.jaw = U.approach(b.jaw, (b.state === 'crateTell' || b.state === 'crates' || b.state === 'spawnTell' || b.state === 'spawn') ? 1 : 0, dt * 4);
    updateCrates(b, dt);
    switch (b.state) {
      case 'idle':                                   // creep toward the nearest player, then pick an attack
        b.facePlayer(); if (Math.abs(dx) > 220) { b.x += b.face * 60 * dt; b.spin += b.face * 60 * dt / 20; }
        if (b.t <= 0) chooseAttack(b);
        break;
      case 'rollTell':                               // rocks back, lamp flashing; chevrons on the floor show the lane
        if (b.t <= 0) { b.set('roll', 3.2); b.dist = 0; fx.jolt(0, 5); }
        break;
      case 'roll': {
        const v = (f.slowRoll ? 235 : 335) * (b.rage ? 1.15 : 1);
        b.x += b.face * v * dt; b.spin += b.face * v * dt / 20;
        if (Math.random() < 0.4) fx.dust(b.x - b.face * 70, b.y, 1, -b.face);
        if (b.x <= b.minX || b.x >= b.maxX) { fx.jolt(0, 9); fx.dust(b.x + b.face * 80, b.y - 30, 10); b.set('recover', 1.3 * sp); }   // hits the wall: a long opening
        else if (b.t <= 0) b.set('recover', 0.9 * sp);
        break;
      }
      case 'crateTell':                              // jaw open, brackets on the floor
        if (b.t <= 0) {
          const top = b.floor - 330;
          for (const c of b.marks) b.crates.push({ c, x: c * T + T / 2, y: top, vy: 0, st: 'fall', life: 0, bl: null });
          while (b.crates.length > 5) { const k = b.crates.shift(); if (k.bl) { const j = G.tiles.blockers.indexOf(k.bl); if (j >= 0) G.tiles.blockers.splice(j, 1); } }
          b.marks = []; b.set('crates', 1.0);
        }
        break;
      case 'crates':
        if (b.t <= 0 || !b.crates.some(k => k.st === 'fall')) b.set('recover', 1.0 * sp);
        break;
      case 'spawnTell':
        if (b.t <= 0) {
          const n = f.noSummons ? 0 : Math.max(0, 2 - b.ownedAlive('ballast_crab').length), m = b.toWorld(70, -14);
          for (let i = 0; i < n; i++) b.summon('ballast_crab', U.clamp(m.x + b.face * i * 18, 40, G.tiles.cols * T - 40), b.floor, { face: b.face, kb: [0.35, b.face * 240] });
          fx.spark(m.x, m.y, 14, '#dfe8d6', 240, 0.5); fx.jolt(0, 5); b.set('spawn', 0.5);
        }
        break;
      case 'spawn':
        if (b.t <= 0) b.set('recover', 1.1 * sp);
        break;
      case 'spinTell':                               // shakes and glows at the valve
        if (b.t <= 0) { b.set('spin', 2.3); b.steamT = 0; b.steamA = rng.range(0, 6.283); b.steamD = rng.chance(0.5) ? 1 : -1; }
        break;
      case 'spin': {                                 // vents a steam spiral from the blowhole
        const arms = f.thin ? 1 : 2, gap = f.thin ? 0.17 : 0.12, w = b.rage ? 2.0 : 1.6;
        if (b.rage && !b.flipped && b.t < 1.15) { b.steamD = -b.steamD; b.flipped = true; }
        b.steamT -= dt;
        while (b.steamT <= 0) {
          b.steamT += gap; b.steamA += b.steamD * w * gap;
          const m = b.toWorld(-10, -106);
          for (let i = 0; i < arms; i++) {
            const a = b.steamA + i * 6.283 / arms;
            b.shoot({ x: m.x, y: m.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 3, r: 7, kind: 'steam', paint: paintSteam });
          }
        }
        if (b.t <= 0) { b.flipped = false; b.set('recover', 1.2 * sp); }
        break;
      }
      case 'recover':                                // the opening after every attack
        if (b.t <= 0) b.set('idle', rng.range(0.5, 0.9) * sp);
        break;
    }
  },

  // Boss space, facing right, feet at the origin. Fare slots are drawn on top by the base class.
  draw(b, ctx) {
    const flash = b.flash > 0, tell = TELLS[b.state] && b.t < 0.18, lampOn = b.lampOn && b.state !== 'dead', a0 = ctx.globalAlpha;
    const hull = flash ? '#f4efe2' : (b.rage && b.state !== 'dead' ? '#3a5a34' : HULL), line = (w = 3) => { ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); };
    const fill = (c, w) => { ctx.fillStyle = c; ctx.fill(); line(w); };
    const wy = b.face, floorLocal = (wx) => (wx - b.x) * wy;                // world x -> boss space x

    // floor warnings, drawn first (under the body)
    if (b.state === 'rollTell' || (b.state === 'roll' && b.t > 2.9)) {
      ctx.fillStyle = WARN; ctx.globalAlpha = a0 * (0.45 + 0.35 * Math.sin(G.time * 22));
      const reach = (b.face > 0 ? b.maxX - b.x : b.x - b.minX);
      for (let x = 110; x < reach + 80; x += 44) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x + 18, -14); ctx.lineTo(x + 18, -2); ctx.lineTo(x, 0); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, -26); ctx.lineTo(x + 18, -14); ctx.lineTo(x + 8, -14); ctx.lineTo(x, -22); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = a0;
    }
    for (const c of b.marks) {                                               // crate brackets: grow and pulse until the drop
      const lx = floorLocal(c * T + T / 2), k = 1 - U.clamp(b.t / (b.rage ? 0.6 : 0.8), 0, 1);
      ctx.fillStyle = '#ff7a4a'; ctx.globalAlpha = a0 * 0.25; ctx.fillRect(lx - 16, -4 - 62 * k, 32, 62 * k);
      ctx.globalAlpha = a0 * (0.6 + 0.35 * Math.sin(G.time * 18)); ctx.fillStyle = '#ffb27a';
      ctx.fillRect(lx - 17, -4, 34, 4); ctx.fillRect(lx - 17, -4 - 66 * k, 4, 66 * k); ctx.fillRect(lx + 13, -4 - 66 * k, 4, 66 * k); ctx.globalAlpha = a0;
    }
    for (const k of b.crates) {                                              // crates (world position, drawn in boss space)
      const lx = floorLocal(k.x), flick = k.st === 'stand' && k.life < 1.2 && Math.floor(G.time * 12) % 2;
      if (flick) continue;
      const top = k.y - b.y - 64;
      ctx.beginPath(); ctx.rect(lx - 15, top, 30, 64); fill('#5b4a28', 3);
      ctx.fillStyle = BRASS; ctx.fillRect(lx - 15, top + 4, 30, 5); ctx.fillRect(lx - 15, top + 31, 30, 5); ctx.fillRect(lx - 3, top + 4, 6, 56);
      ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(lx - 15, top + 32, 30, 32);
    }

    // 1 tail fluke
    ctx.beginPath(); ctx.moveTo(-62, -42); ctx.quadraticCurveTo(-96, -50, -110, -88); ctx.quadraticCurveTo(-92, -66, -84, -62); ctx.quadraticCurveTo(-100, -44, -118, -40); ctx.quadraticCurveTo(-90, -28, -62, -26); ctx.closePath(); fill(HULL2);
    // 2 hull
    ctx.beginPath(); ctx.moveTo(-72, -30); ctx.bezierCurveTo(-78, -66, -42, -84, 0, -84); ctx.bezierCurveTo(46, -84, 84, -72, 82, -40); ctx.lineTo(78, -18); ctx.quadraticCurveTo(0, -8, -62, -14); ctx.closePath(); fill(hull);
    // 3 brass belly band
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-62, -30, 134, 13, 6) : ctx.rect(-62, -30, 134, 13); fill(BRASS);
    // 4 dorsal plate
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-46, -90, 74, 14, 7) : ctx.rect(-46, -90, 74, 14); fill(tell ? '#f4e6b8' : HULL3);
    // 5 mouth interior and lower jaw (hinge at the Jaw Hinge)
    const j = b.jaw;
    if (j > 0.02) { ctx.beginPath(); ctx.moveTo(28, -50); ctx.lineTo(86, -52); ctx.lineTo(80, -50 + j * 44); ctx.closePath(); fill('#1a0c08', 2); }
    ctx.save(); ctx.translate(28, -50); ctx.rotate(j * 0.5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(54, -2); ctx.quadraticCurveTo(64, 6, 54, 18); ctx.lineTo(4, 16); ctx.closePath(); fill(HULL2); ctx.restore();
    // 6, 7 wheels
    for (const wx of [62, -46]) {
      ctx.save(); ctx.translate(wx, -20); ctx.beginPath(); ctx.arc(0, 0, 20, 0, 6.283); fill(DARK);
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.283); fill(BRASS); ctx.rotate(b.spin);
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke(); ctx.restore();
    }
    // 8 blowhole stack (glows and puffs while it winds up or vents)
    const vent = b.state === 'spinTell' || b.state === 'spin';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-24, -104, 28, 20, 5) : ctx.rect(-24, -104, 28, 20); fill(vent ? BRASS2 : BRASS);
    if (vent) { ctx.fillStyle = '#e4efe0'; ctx.globalAlpha = a0 * 0.8; ctx.beginPath(); ctx.arc(-10 + Math.sin(G.time * 30) * 2, -112 - (G.time * 40 % 14), 7, 0, 6.283); ctx.fill(); ctx.globalAlpha = a0; }
    // 9 headlamp housing and lens
    ctx.beginPath(); ctx.arc(76, -38, 13, 0, 6.283); fill(BRASS);
    const blink = (b.state === 'rollTell' || b.state === 'crateTell') && Math.floor(G.time * 12) % 2;
    ctx.fillStyle = lampOn || tell ? (tell || blink ? '#ffffff' : '#f4e6b8') : '#4a4426'; ctx.beginPath(); ctx.arc(76, -38, 7, 0, 6.283); ctx.fill();
    if (tell || (lampOn && b.state === 'rollTell')) { ctx.globalAlpha = a0 * 0.35; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(76, -38, 26, 0, 6.283); ctx.fill(); ctx.globalAlpha = a0; }
    // 10 eye
    ctx.beginPath(); ctx.arc(58, -68, 6, 0, 6.283); fill('#f4e6b8', 2); ctx.fillStyle = OUT; ctx.fillRect(59, -70, 4, 5);
  }
});
})();
