/* CONTENT: the Warden of region r2, The Lamp-Heron (Signal Reef). Structure copied from boss_r1.js.
   A tall wading machine-bird on stilt legs with a signal lamp for a head. Violet-grey dusk, lamp-white light.

   Attacks (bible section 4). Every tell is at least 0.45 s (0.35 s in rage), with a held pose and a flash:
   - Peck:       the head rises, a white mark appears on the floor, then the head stabs down onto it and sticks in the floor. Open to slashes.
   - Lamp Sweep: the head lowers and the lamp swells; then a pool of light slides along the floor away from the lamp. Jump or dash it.
   - Wing Gust:  the wings flare and the head leans back; wind pushes players sideways and sparks stream low or high across the floor.
   - Spark Fall: it rises; white columns are marked on the floor; sparks drop down the columns.
   Rage (below half hp): every tell is a quarter shorter, the sweep is faster, and a peck sends two sparks skittering along the floor.

   Fare slots, each reached a different way:
   - Lamp (pierce): the lit head. Exposed while it sweeps or gusts. Fire a pierce straight at it (from a jump) or upward from beneath it.
   - Back Hatch (arc): on top of the body. A lobbed shot must fall onto it, so lob from a shelf or the top of a jump.
   - Throat (burst): behind the head. Exposed only while the head is stuck in the floor; stand beside the head and pulse.
   - Ankle (ground): the front leg's joint. Exposed while it stands still to peck; slide a slab in from the front.
   Punched: no lamp sweep / weaker gust / fewer sparks / longer stuck time.

   Hooks (js/game/bosses.js): shapes(b) gives the narrow body, or the stuck head while it is stuck; contact is a function that hurts only
   through the stilts (and not at all while the boss is frozen or in its intro); the stab, the pool of light, sparks and wind are hurt
   by the attacks themselves. Fare slot positions follow the head, so their `local` is a function of the boss. */
(() => {
'use strict';
const G = window.G, U = G.util, fx = G.fx;

const OUT = '#1c1829', HIDE = '#8d85b0', HIDE2 = '#665e8a', LEG = '#5f587e', WING = '#aaa2c8', LAMP = '#f4e6b8', FLASH = '#fffbe8';
const REST_X = 60, REST_Y = -188, HALF_W = 30, BODY_H = 150;
const stuck = b => b.state === 'peckStuck';
const headWorld = b => b.toWorld(b.hx, b.hy);

// A hostile spark shot (cut by a slash).
const paintSpark = (ctx, s) => {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(G.time * 6);
  ctx.fillStyle = LAMP; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -s.r - 3); ctx.lineTo(s.r + 3, 0); ctx.lineTo(0, s.r + 3); ctx.lineTo(-s.r - 3, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
};
const paintBolt = (ctx, s) => {
  const x = s.x, y = s.y;
  ctx.fillStyle = 'rgba(244,230,184,0.35)'; ctx.fillRect(x - 20, y - 90, 40, 90);
  ctx.fillStyle = LAMP; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 9, y - 52); ctx.lineTo(x + 9, y - 52); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.stroke();
};

// 'idle' calls this to pick the next attack. Never the same attack twice in a row; a peck only when a player is within reach.
function chooseAttack(b) {
  const rng = G.run.rng, dx = Math.abs(b.target().x - b.x);
  b.facePlayer();
  let opts = ['gust', 'fall'];
  if (!b.flags.noSweep) opts.push('sweep');
  if (dx <= 230) opts.push('peck', 'peck');
  opts = opts.filter(o => o !== b.last);
  const pick = rng.pick(opts); b.last = pick;
  if (pick === 'peck') b.pkx = b.target().x;
  if (pick === 'fall') b.pickColumns();
  b.begin(pick);                                                           // tell and wind-up come from the registry below
}

// The attack registry (js/game/bosses.js documents the fields). Wind-ups are scaled by 0.75 when enraged.
G.defineAttacks('lamp_heron', {
  peck: { name: 'Peck', tell: 'peckTell', wind: 0.7, strike: ['peckStab'], strikeT: 0.14, recover: 1.6, recoverStates: ['peckStuck', 'peckOut'], dodge: 'move',
    fair: 'The head rises over a white floor mark that locks 0.5 s before the stab (0.4 enraged); step off it. The stuck head is open to slashes.',
    slots: [{ cut: 'ground', flag: 'longStuck', mode: 'weaken', note: 'the head stays stuck in the floor longer' }] },
  sweep: { name: 'Lamp Sweep', tell: 'sweepTell', wind: 0.8, strike: ['sweep'], strikeT: 4, recover: 1.0, dodge: 'jump',
    fair: 'The head lowers and the lamp swells, a faint line shows the path; then a pool of light slides along the floor. Jump or dash it.',
    slots: [{ cut: 'pierce', flag: 'noSweep', mode: 'disable', note: 'it can no longer sweep its lamp' }] },
  gust: { name: 'Wing Gust', tell: 'gustTell', wind: 0.75, strike: ['gust'], strikeT: 2.7, recover: 1.0, dodge: 'jump',
    fair: 'The wings flare and the lamp flashes; wind pushes sideways while sparks stream low (jump) and high (stay down).',
    slots: [{ cut: 'arc', flag: 'softGust', mode: 'weaken', note: 'weaker wind, slower sparks, a shorter gust' }] },
  fall: { name: 'Spark Fall', tell: 'fallTell', wind: 0.85, strike: ['fall'], strikeT: 0.7, recover: 0.9, dodge: 'move',
    fair: 'It rises while white columns glow on the floor; sparks drop down those columns 0.85 s later. Leave the columns.',
    slots: [{ cut: 'burst', flag: 'fewSparks', mode: 'weaken', note: 'one column fewer' }] }
});

G.defineBoss({
  id: 'lamp_heron', name: 'The Lamp-Heron', hp: 1180, par: 104, w: 70, h: BODY_H,
  interp: ['hx', 'hy', 'ha'],
  shapes(b) {
    if (stuck(b)) { const h = headWorld(b); return { x0: h.x - 26, x1: h.x + 26, y0: b.floor - 76, y1: b.floor }; }
    return { x0: b.x - HALF_W, x1: b.x + HALF_W, y0: b.y - BODY_H, y1: b.y };
  },
  // Only the stilts hurt on touch (the body is too high to walk into).
  contact: b => b.acting() && { x0: b.x - HALF_W + 4, x1: b.x + HALF_W - 4, y0: b.y - 100, y1: b.y },

  spots: {
    pierce: { name: 'Lamp', local: b => [b.hx + 4, b.hy], r: 17,
      exposed: b => b.state === 'sweep' || b.state === 'gust',
      onBreak(b) { b.flags.noSweep = true; }, lost: 'It can no longer sweep its lamp.' },
    arc: { name: 'Back Hatch', local: [-6, -BODY_H + 4], r: 20,
      accepts: (b, st) => st.vy > 0,                                       // the lobbed shot must be falling onto it
      onBreak(b) { b.flags.softGust = true; }, lost: 'Its gusts are weaker.' },
    burst: { name: 'Throat', local: b => [b.hx - 26, b.hy - 22], r: 16,
      exposed: stuck,                                                      // only while the head is stuck in the floor
      onBreak(b) { b.flags.fewSparks = true; }, lost: 'It drops fewer sparks.' },
    ground: { name: 'Ankle', local: [24, -20], r: 17,
      exposed: b => b.state === 'peckTell' || b.state === 'peckStab' || b.state === 'peckStuck',   // while it stands still to peck
      onBreak(b) { b.flags.longStuck = true; }, lost: 'Its head stays stuck in the floor longer.' }
  },

  // Own fields: head position in boss space (hx, hy) and angle ha, lamp glow lit, wing spread 0..1, lift off the floor, the peck floor
  // mark pkx (world x), spark fall column xs, the beam's world x, the wind spark timer and lane.
  init(b) {
    Object.assign(b, { hx: REST_X, hy: REST_Y, ha: 0.25, lit: 0.3, wing: 0, last: '', pkx: 0, cols: [], beamX: 0, sparkT: 0, lane: 0, walk: 0 });
    b.headWorld = () => headWorld(b);
    b.pickColumns = () => {
      const rng = G.run.rng, n = (b.rage ? 4 : 3) - (b.flags.fewSparks ? 1 : 0), x0 = b.minX - 48 + 40, x1 = b.maxX + 48 - 40, xs = [b.target().x];
      for (let i = 1; i < n; i++) xs.push(b.target().x + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * rng.range(115, 160));
      b.cols = xs.map(x => U.clamp(x, x0, x1));
    };
  },

  pose(b) { return { ox: b.state === 'stagger' ? Math.sin(G.time * 30) * 2 : 0 }; },

  // While staggered the base class owns the state: the hazards stop and the head droops.
  staggered(b, dt) {
    b.cols = []; b.beamX = 0; b.wing = U.approach(b.wing, 0, dt * 4); b.lit = U.approach(b.lit, 0.9, dt * 3);
    b.hx = U.approach(b.hx, 70, dt * 400); b.hy = U.approach(b.hy, -90, dt * 400); b.ha = U.approach(b.ha, 0.9, dt * 4);
  },

  update(b, dt) {
    const rng = G.run.rng, tgt = b.target(), sp = b.rage ? 0.75 : 1, dx = tgt.x - b.x, st = b.state, floor = b.floor;
    const x0 = b.minX - 48, x1 = b.maxX + 48, relFloor = floor - b.y;
    const head = (x, y, ha, v) => { b.hx = U.approach(b.hx, x, v * dt); b.hy = U.approach(b.hy, y, v * dt); b.ha = U.approach(b.ha, ha, 6 * dt); };
    const wingUp = st === 'gustTell' || st === 'gust' || st === 'fallTell' || st === 'fall';
    b.wing = U.approach(b.wing, wingUp ? 1 : 0, dt * 5);
    b.lit = U.approach(b.lit, st === 'sweepTell' || st === 'sweep' || st === 'gustTell' || st === 'gust' || st === 'peckStab' ? 1 : (st === 'peckTell' ? 0.3 + 0.7 * U.clamp(1 - b.t / 0.25, 0, 1) : 0.3), dt * 4);
    if (st !== 'fallTell' && st !== 'fall' && b.y < floor) b.y = Math.min(floor, b.y + 150 * dt);   // settle back to the floor
    switch (st) {
      case 'idle':                                   // stalk toward the nearest player on stilts, head bobbing, then pick an attack
        b.facePlayer(); head(REST_X, REST_Y + Math.sin(G.time * 3) * 4, 0.25, 500);
        if (Math.abs(dx) > 150) { b.x += b.face * 85 * dt; b.walk += dt; }
        if (b.t <= 0) chooseAttack(b);
        break;

      // ---- Peck: the Ankle is exposed while it stands still; the Throat once the head is stuck.
      case 'peckTell': {                             // head cocked high over a white floor mark; the mark locks 0.5 s before the stab
        if (b.t > (b.rage ? 0.4 : 0.5)) b.pkx = tgt.x;      // the mark locks 0.5 s (0.4 enraged) before the stab; the stab itself takes 0.14 s more
        const d = U.clamp((b.pkx - b.x) * b.face, 50, 215); b.pkx = b.x + b.face * d;
        head(d, -234, -0.6, 900);
        if (b.t <= 0) b.set('peckStab', 0.14);
        break;
      }
      case 'peckStab': {                             // the head drops onto the mark
        const d = (b.pkx - b.x) * b.face;
        head(d, relFloor - 46, 1.4, 3000);
        const h = headWorld(b);
        G.combat.hurtPlayers({ x0: h.x - 24, x1: h.x + 24, y0: floor - 90, y1: floor }, h.x);
        if (b.t <= 0) {
          const w = headWorld(b); fx.jolt(0, 9); fx.dust(w.x, floor, 14); fx.ring(w.x, floor - 4, 6, 220, LAMP, 0.3);
          if (b.rage) for (const s of [-1, 1])        // rage twist: two sparks skitter out along the floor
            b.shoot({ x: w.x + s * 30, y: floor - 8, vx: s * 320, hug: true, life: 1.1, r: 8, cut: true, kind: 'spark', paint: paintSpark });
          b.set('peckStuck', b.flags.longStuck ? 2.0 : 1.25);
        }
        break;
      }
      case 'peckStuck':                              // stuck in the floor: slash the head, pulse the Throat
        b.ha = 1.4; if (b.t <= 0) b.set('peckOut', 0.35);
        break;
      case 'peckOut':
        head(REST_X, REST_Y, 0.25, 700);
        if (b.t <= 0) b.set('idle', rng.range(0.5, 0.9) * sp);
        break;

      // ---- Lamp Sweep: the Lamp is exposed while it sweeps.
      case 'sweepTell':                              // head lowers, the lamp swells, a faint line on the floor shows the path
        head(72, -150, 0.35, 500);
        if (b.t <= 0) { b.beamX = headWorld(b).x; b.set('sweep', 6); fx.jolt(0, 5); }
        break;
      case 'sweep': {                                // a pool of light slides along the floor away from the lamp
        head(72, -150, 0.35, 500);
        const v = b.rage ? 380 : 300;
        b.beamX += b.face * v * dt;
        G.combat.hurtPlayers({ x0: b.beamX - 20, x1: b.beamX + 20, y0: floor - 52, y1: floor }, b.beamX - b.face * 30);
        if (Math.random() < 0.5) fx.spark(b.beamX, floor - 6, 1, LAMP, 120, 0.3);
        if (b.beamX < x0 + 6 || b.beamX > x1 - 6 || b.t <= 0) { b.beamX = 0; b.set('recover', 1.0); }
        break;
      }

      // ---- Wing Gust: the Lamp is exposed while it gusts.
      case 'gustTell':                               // wings flare, head leans back, lamp flashes
        head(44, -198, -0.3, 500);
        if (Math.random() < 0.4) fx.dust(b.x - b.face * 50, floor, 1, -b.face);
        if (b.t <= 0) { b.set('gust', b.flags.softGust ? 1.9 : 2.7); b.sparkT = 0.2; b.lane = 0; fx.jolt(0, 5); }
        break;
      case 'gust': {
        head(44, -198, -0.3, 500);
        const wind = b.flags.softGust ? 85 : 170;
        for (const p of G.players) if (!p.down) G.tiles.moveBox(p, b.face * wind * dt, 0);
        if (Math.random() < 0.6) fx.dust(b.x + b.face * U.rnd(60, 500), floor, 1, b.face);
        b.sparkT -= dt;
        if (b.sparkT <= 0) {                         // alternate a low spark (jump it) and a high one (stay down); weaker gusts send them slower
          const m = b.toWorld(70, b.lane % 2 ? -100 : -20); b.lane++;
          b.shoot({ x: m.x, y: m.y, vx: b.face * 330, life: 3.5, r: 8, cut: true, kind: 'spark', paint: paintSpark });
          fx.spark(m.x, m.y, 4, LAMP, 160, 0.25);
          b.sparkT = (b.flags.softGust ? 0.8 : 0.55) * (b.rage ? 0.85 : 1);
        }
        if (b.t <= 0) b.set('recover', 1.0);
        break;
      }

      // ---- Spark Fall: nothing is exposed; the Heron hangs in the air.
      case 'fallTell':                               // rises while white columns glow on the floor
        b.y = Math.max(floor - 70, b.y - 160 * dt); head(30, -205, -0.4, 500);
        if (b.t <= 0) {
          for (const x of b.cols) b.shoot({ x, y: 50, vy: 900, life: 1.2, rect: { w: 40, h: 90 }, tile: 'die', kind: 'bolt', paint: paintBolt });
          b.set('fall', 0.7); fx.jolt(0, 6);
        }
        break;
      case 'fall':
        b.y = Math.max(floor - 70, b.y - 160 * dt); head(30, -205, -0.4, 500);
        if (b.t <= 0) { b.cols = []; b.set('recover', 0.9); }
        break;

      case 'recover':                                // the opening after every attack
        head(REST_X, REST_Y, 0.25, 350);
        if (b.t <= 0) b.set('idle', rng.range(0.5, 0.9) * sp);
        break;
    }
  },

  // Boss space, facing right. Shapes: two legs, two feet, tail, wing, body, neck, beak, lamp head, lamp cap (11). Fare slots are drawn by the base class.
  draw(b, ctx) {
    const a0 = ctx.globalAlpha, hit = b.flash > 0, rage = b.rage && b.state !== 'dead';
    const hide = hit ? '#e9e4f5' : (rage ? '#7b5f86' : HIDE), hide2 = rage ? '#5a4468' : HIDE2;
    const bob = b.state === 'idle' ? Math.sin(b.walk * 7) * 2 : 0;
    const fill = (c, lw = 3) => { ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // Marks on the floor (drawn first, under the bird). World x -> boss space: (x - b.x) * face.
    const fl = b.floor - b.y, lx = wx => (wx - b.x) * b.face, flash = 0.55 + 0.45 * Math.sin(G.time * 22);
    const mark = (x, w) => {
      ctx.save(); ctx.globalAlpha = a0 * flash; ctx.fillStyle = LAMP; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, fl - 3, w, 8, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x + k * w * 0.5 - 8, fl - 34); ctx.lineTo(x + k * w * 0.5 + 8, fl - 34); ctx.lineTo(x + k * w * 0.5, fl - 18); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    };
    if (b.state === 'peckTell' || b.state === 'peckStab') mark(lx(b.pkx), 30);
    if (b.state === 'fallTell') for (const x of b.cols) {
      ctx.save(); ctx.globalAlpha = a0 * 0.25; ctx.fillStyle = LAMP; ctx.fillRect(lx(x) - 20, fl - 330, 40, 330); ctx.restore(); mark(lx(x), 24);
    }
    if (b.state === 'sweepTell') {                                  // the path of the light, a dashed line on the floor
      const h = b.headWorld(), from = lx(h.x), to = lx(b.face > 0 ? b.maxX + 48 : b.minX - 48);
      ctx.save(); ctx.globalAlpha = a0 * flash; ctx.strokeStyle = LAMP; ctx.lineWidth = 4; ctx.setLineDash([14, 12]);
      ctx.beginPath(); ctx.moveTo(from, fl - 4); ctx.lineTo(to, fl - 4); ctx.stroke(); ctx.restore();
    }
    if (b.state === 'sweep' && b.beamX) {                           // the pool of light itself
      const x = lx(b.beamX);
      ctx.save(); ctx.fillStyle = 'rgba(244,230,184,0.4)'; ctx.fillRect(x - 24, fl - 60, 48, 60);
      ctx.fillStyle = LAMP; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 24, fl); ctx.lineTo(x - 10, fl - 52); ctx.lineTo(x + 10, fl - 52); ctx.lineTo(x + 24, fl); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    const leg = (hx, kx, ax, c) => {                                // a stilt: hip, a backward knee, ankle
      ctx.strokeStyle = OUT; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(hx, -112 + bob); ctx.lineTo(kx, -62); ctx.lineTo(ax, -16); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = 9; ctx.stroke();
    };
    const foot = (x, c) => { ctx.beginPath(); ctx.roundRect(x - 15, -11, 34, 11, 4); fill(c); };
    leg(-14, -8, -18, LEG); foot(-18, LEG);                                                        // far leg and foot (1, 2)
    ctx.beginPath(); ctx.moveTo(-26, -122 + bob); ctx.lineTo(-62, -92); ctx.lineTo(-30, -108); ctx.closePath(); fill(hide2);              // tail (3)
    ctx.save(); ctx.translate(-8, -138 + bob); ctx.rotate(-b.wing * 1.15); ctx.scale(1 + b.wing * 0.55, 1 + b.wing * 0.3);              // wing (4)
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-40, -6, -52, 34); ctx.quadraticCurveTo(-20, 28, 6, 14); ctx.closePath(); fill(WING); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, -128 + bob, 40, 25, -0.08, 0, 6.283); fill(hide);                                                     // body (5)
    ctx.fillStyle = hide2; ctx.beginPath(); ctx.ellipse(-6, -118 + bob, 28, 10, 0, 0, 6.283); ctx.globalAlpha = a0 * 0.6; ctx.fill(); ctx.globalAlpha = a0;
    leg(16, 26, 24, LEG); foot(26, LEG);                                                           // near leg and foot (6, 7)

    // Neck (8): from the shoulder to the head, arching over.
    const hx = b.hx, hy = b.hy, sx = 32, sy = -140 + bob;
    const cx = (sx + hx) / 2 - 12, cy = Math.min(sy, hy) - 34;
    ctx.strokeStyle = OUT; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, hx - 6, hy + 4); ctx.stroke();
    ctx.strokeStyle = hide; ctx.lineWidth = 10; ctx.stroke();

    // Beak (9) and lamp head (10) and lamp cap (11), turned by ha.
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(b.ha);
    ctx.beginPath(); ctx.moveTo(12, -7); ctx.lineTo(46, 0); ctx.lineTo(12, 8); ctx.closePath(); fill('#c9b98e');
    const glow = b.lit, rr = 19 + glow * 3 + (b.state === 'peckTell' && b.t < 0.2 ? 4 : 0);
    ctx.save(); ctx.globalAlpha = a0 * (0.18 + 0.3 * glow); ctx.fillStyle = LAMP; ctx.beginPath(); ctx.arc(0, 0, rr + 12 + glow * 12, 0, 6.283); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.283); fill(hit ? '#ffffff' : (glow > 0.7 ? FLASH : LAMP));
    ctx.beginPath(); ctx.roundRect(-14, -rr - 8, 28, 11, 5); fill(hide2);
    ctx.restore();
    ctx.globalAlpha = a0;
  }
});
})();
