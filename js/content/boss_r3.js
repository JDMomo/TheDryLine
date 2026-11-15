/* CONTENT: the Warden of region r3 (Salt Cutting), The Switchman Idol. Structure copied from boss_r1.js.
   Three signal-heads stacked into a totem (lamps low, middle and top) that hops along the rail.

   Attacks (every one: tell of 0.45 s or more, the attack, then a 'recover' window where it can be slashed)
   - Signal Rings:   the lamp of one head lights for 0.45 s, then that head fires a ring. Low ring (bottom head): jump it.
                     Middle ring: stay on the floor. High ring (top head): stay low, or hop. A slash destroys any ring.
   - Brine Geysers:  rust marks on the floor under each player, 0.95 s later a column erupts. Walk out of it. Waves of marks.
   - Topple:         leans back, marks the floor in front of it, falls flat forward, lies there for about 3 s, then rises.
   - Lever Toss:     raises two levers (three in rage) and throws them at the player; they fly back to it (slash them).
   Rage (below half hp): tells and gaps are a quarter shorter (never under 0.35 s), one more ring, and the twist: every
   geyser wave also marks the floor 110 px either side of the player.

   Fare slots (one per cut; each needs a different approach)
   - Top Lens (pierce): the lit lens on the top head. Open only while it signals (tell and rings). Fly a shot straight at it:
                        from a ledge at row 12, from a jump, or up from beside it. Punched: fewer rings.
   - Open Crown (arc):  the open bowl on top of the head. Open when it stands. A lobbed shot must drop into it from above.
                        Punched: lever tosses no longer come back.
   - Split Seam (burst): a seam on the back of the totem, open only while it lies toppled. Stand close, ring the bell.
                        Punched: geysers show their marks longer.
   - Foot Plate (ground): the plate on the front foot, open while it stands on its feet. Slide the slab along the floor
                        at it from the front. Punched: it stays on the floor longer after a topple.
   Own fields (set in init): lie 0..1 (toppled), lean, crouch, arms, lamp[3], sig (signalling), marks, zone. b.rect is
   replaced in init so the lying body is slashable where it really lies (the base class has no hook for this). Contact damage
   is done here (contact: false) because the lying body must not hurt the player who slashes it. */
(() => {
'use strict';
const G = window.G, U = G.util, fx = G.fx;

const HEAD_Y = [-34, -82, -130];          // lamp heights of the three heads, boss space
const REACH = 194;                        // how far in front of the feet the toppled body reaches
const LIE_T = 2.8, FALL_T = 0.38, RISE_T = 0.7;
const INK = '#1b232c', PALE = '#d9e6ee', PALE2 = '#aebfcc', SLATE = '#4a5866', LAMP = '#f4e6b8', WARN = '#b8482f';

// 'idle' calls this. A shuffle bag: every attack comes round before any repeats.
function nextAttack(b) {
  if (!b.bag.length) {
    b.bag = G.run.rng.shuffle(['rings', 'geyser', 'topple', 'lever']);
    if (b.bag[b.bag.length - 1] === b.last) b.bag.unshift(b.bag.pop());     // the next pick is the end of the array
  }
  return b.bag.pop();
}
const wind = (b, t) => Math.max(0.35, t * (b.rage ? 0.75 : 1));
const hz = (b, lx0, lx1, ly0, ly1) => {                              // a world rect from boss-space x range and y range
  const xa = b.x + b.face * lx0, xb = b.x + b.face * lx1;
  return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: b.y + ly0, y1: b.y + ly1 };
};
const arenaL = b => b.minX - 45, arenaR = b => b.maxX + 45;
const fits = b => { const e = b.x + b.face * (REACH + 6); return e > arenaL(b) + 6 && e < arenaR(b) - 6; };

function choose(b) {
  b.facePlayer();
  const tgt = b.target(), dx = Math.abs(tgt.x - b.x);
  if (!b.next) b.next = nextAttack(b);
  const a = b.next;
  let dir = 0;                                                           // hop toward (+1) or away from (-1) the player first
  if ((a === 'rings' || a === 'lever') && dx < 230) dir = -1;
  else if (a === 'topple' && dx > 200) dir = 1;
  if (dir && b.hops < 2) {
    const nx = b.x + b.face * dir * 140;
    if (nx > b.minX && nx < b.maxX) { b.hops++; b.hopDir = dir; b.set('hop', 0.5); return; }
  }
  b.hops = 0; b.next = null; b.last = a;
  if (a === 'rings') b.set('ringTell', wind(b, 0.75));
  else if (a === 'geyser') b.set('geyserTell', wind(b, 0.7));
  else if (a === 'lever') b.set('leverTell', wind(b, 0.65));
  else {
    if (!fits(b)) b.face = -b.face;                                      // not enough room in front: fall the other way
    b.set('toppleTell', wind(b, 0.95)); startZone(b);
  }
}

// Floor warnings are harmless shots that only paint (r 0, one body-length under the floor line); the logic lives in b.marks / b.zone.
function addMark(b, x) {
  const dur = (b.flags.slowGeyser ? 1.3 : 0.95) * (b.rage ? 0.75 : 1), m = { x: U.clamp(x, arenaL(b) + 24, arenaR(b) - 24), t: dur, dur, live: true };
  b.marks.push(m);
  b.shoot({ x: m.x, y: b.floor + 12, r: 0, tile: 'pass', life: dur + 0.05, paint: (ctx) => {
    if (!m.live) return;
    const p = 1 - m.t / m.dur, h = 8 + 26 * p;
    ctx.save(); ctx.translate(m.x, b.floor); ctx.globalAlpha = 0.45 + 0.4 * p;
    ctx.fillStyle = WARN; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const x = -19 + i * 12.67; ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.lineTo(x, -h * (i % 2 ? 0.7 : 1)); ctx.lineTo(x + 6, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillRect(-24, -3, 48, 5); ctx.restore();
  } });
}
function startZone(b) {
  const z = b.zone = { x0: b.x + b.face * 30, x1: b.x + b.face * REACH, live: true, t: 0 };
  b.shoot({ x: b.x, y: b.floor + 12, r: 0, tile: 'pass', life: 3, paint: ctx => {
    if (!z.live) return;
    const x0 = Math.min(z.x0, z.x1), w = Math.abs(z.x1 - z.x0), blink = 0.35 + 0.25 * Math.sin(G.time * 18);
    ctx.save(); ctx.globalAlpha = blink + 0.15; ctx.fillStyle = WARN; ctx.fillRect(x0, b.floor - 5, w, 5);
    ctx.strokeStyle = WARN; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = x0; x < x0 + w; x += 24) { ctx.moveTo(x, b.floor - 5); ctx.lineTo(x + 12, b.floor - 30); }
    ctx.stroke(); ctx.restore();
  } });
}
function calm(b) {                                                       // an interrupted attack leaves nothing pending
  for (const m of b.marks) m.live = false;
  b.marks.length = 0; if (b.zone) b.zone.live = false; b.zone = null; b.lamp = [0, 0, 0]; b.sig = false; b.next = null; b.hops = 0;
}

const paintRing = (ctx, s) => {
  ctx.save(); ctx.translate(s.x, s.y);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.283); ctx.fill();
  ctx.fillStyle = LAMP; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.283); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.283); ctx.fill();
  ctx.restore();
};
const paintLever = (ctx, s) => {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(G.time * 14 + s.age * 3);
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.strokeStyle = PALE; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(12, 0, 8, 0, 6.283); ctx.fill();
  ctx.fillStyle = LAMP; ctx.beginPath(); ctx.arc(12, 0, 5, 0, 6.283); ctx.fill();
  ctx.restore();
};
const paintGeyser = (ctx, s) => {
  const g = Math.min(1, s.age / 0.09), H = s.rect.h * g, W = s.rect.w, x = s.x - W / 2, y = s.y - H;
  ctx.save(); ctx.fillStyle = '#e6eef4'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 5, s.y); ctx.lineTo(x + 3, y + 14); ctx.quadraticCurveTo(x + 3, y, s.x, y - 4); ctx.quadraticCurveTo(x + W - 3, y, x + W - 3, y + 14);
  ctx.lineTo(x + W + 5, s.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b9ccd9'; ctx.fillRect(s.x - 3, y + 16, 6, H - 20); ctx.restore();
};

// Rounded rectangle with the 3 px dark outline.
function blob(ctx, x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
}
function disc(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); }

G.defineBoss({
  id: 'switchman_idol', name: 'The Switchman Idol', hp: 1050, par: 97, w: 64, h: 152, contact: false,

  spots: {
    pierce: { name: 'Top Lens', local: [22, -130], r: 18, exposed: b => b.sig && b.lie < 0.02,
      onBreak(b) { b.flags.fewRings = true; }, lost: 'It fires fewer rings.' },
    arc: { name: 'Open Crown', local: [-4, -152], r: 20, exposed: b => b.lie < 0.02, accepts: (b, st) => st.vy > 0,
      onBreak(b) { b.flags.noReturn = true; }, lost: 'Its levers no longer fly back.' },
    burst: { name: 'Split Seam', local: [-30, -76], r: 16, exposed: b => b.lie > 0.95,
      onBreak(b) { b.flags.slowGeyser = true; }, lost: 'Its geysers give a longer warning.' },
    ground: { name: 'Foot Plate', local: [30, -8], r: 14, exposed: b => b.lie < 0.02 && b.y >= b.floor - 2,
      onBreak(b) { b.flags.stiff = true; }, lost: 'It lies longer after a topple.' }
  },

  init(b) {
    Object.assign(b, { lie: 0, lie0: 0, lean: 0, crouch: 0, arms: 0, lamp: [0, 0, 0], sig: false, marks: [], zone: null, bag: [], next: null, last: '', hops: 0, hopDir: 1,
      ri: 0, ph: 0, pt: 0, seq: [], wave: 0, wt: 0, ln: 0, lt: 0 });
    b.rect = function () {                                               // the lying body is where it really lies
      if (this.lie > 0.5) return Object.assign({ y0: this.y - 64, y1: this.y }, (a => ({ x0: Math.min(...a), x1: Math.max(...a) }))([this.x + this.face * 28, this.x + this.face * (REACH - 10)]));
      return { x0: this.x - this.w / 2, x1: this.x + this.w / 2, y0: this.y - this.h, y1: this.y };
    };
  },

  pose(b) {
    const sh = b.state === 'stagger' ? Math.sin(G.time * 30) * 2 : (b.state === 'toppleTell' ? Math.sin(G.time * 40) * 1.5 : 0);
    if (b.lie > 0.001) return { rot: b.lie * Math.PI / 2, px: 30, py: 0, ox: sh };
    const sq = b.crouch * 0.1;
    return { rot: -b.lean, px: -30, py: 0, sx: 1 + sq, sy: 1 - sq, ox: sh };
  },
  staggered(b, dt) {
    calm(b); b.arms = U.approach(b.arms, 0, dt * 5); b.lean = U.approach(b.lean, 0, dt * 2); b.crouch = U.approach(b.crouch, 0, dt * 6);
    b.lie = b.lie > 0.5 ? U.approach(b.lie, 1, dt * 4) : U.approach(b.lie, 0, dt * 4);
    for (let i = 0; i < 3; i++) b.lamp[i] = U.approach(b.lamp[i], 0, dt * 4);
  },

  update(b, dt) {
    const rng = G.run.rng, tgt = b.target(), f = b.rage ? 0.75 : 1;
    b.sig = b.state === 'ringTell' || b.state === 'ring';
    b.crouch = U.approach(b.crouch, b.state === 'geyserTell' || b.state === 'hop' ? 1 : 0, dt * 8);
    b.lean = U.approach(b.lean, b.state === 'toppleTell' ? 0.14 : 0, dt * 2);
    b.arms = U.approach(b.arms, b.state === 'leverTell' || b.state === 'lever' || b.state === 'ringTell' ? 1 : 0, dt * 5);
    for (let i = 0; i < 3; i++) b.lamp[i] = Math.max(0, b.lamp[i] - dt * 3);
    // pending geyser eruptions
    for (let i = b.marks.length - 1; i >= 0; i--) {
      const m = b.marks[i]; m.t -= dt;
      if (m.t <= 0) {
        m.live = false; b.marks.splice(i, 1);
        b.shoot({ x: m.x, y: b.floor, rect: { w: 40, h: 150 }, life: 0.5, tile: 'pass', paint: paintGeyser });
        fx.dust(m.x, b.floor, 12); fx.spark(m.x, b.floor - 10, 10, '#e6eef4', 380, 0.45); fx.jolt(0, 5);
      }
    }
    // contact damage: only while it stands (the fallen body is safe to slash; the fall itself is a hit zone)
    if (b.lie < 0.02 && b.state !== 'rise') G.combat.hurtPlayers(hz(b, -28, 28, -146, 0), b.x);
    switch (b.state) {
      case 'idle':
        b.facePlayer();
        if (b.lie > 0.3) { b.lie0 = b.lie; b.set('rise', RISE_T); break; }
        if (b.t <= 0) choose(b);
        break;
      case 'hop': {                                                      // a short hop along the rail, toward or away from the player
        const u = 1 - b.t / 0.5;
        b.x += b.face * b.hopDir * 280 * dt; b.y = b.floor - 52 * Math.sin(Math.PI * U.clamp(u, 0, 1));
        if (b.t <= 0) { b.y = b.floor; b.vy = 0; fx.dust(b.x, b.floor, 8); fx.jolt(0, 3); b.set('idle', 0.25); }
        break;
      }
      case 'ringTell':                                                   // arms up, all three lamps pulse, the lens glows
        for (let i = 0; i < 3; i++) b.lamp[i] = Math.max(b.lamp[i], 0.4 + 0.3 * Math.sin(G.time * 16 + i));
        if (b.t <= 0) {
          const n = (b.flags.fewRings ? 2 : 4) + (b.rage ? 1 : 0); b.seq = []; let prev = -1;
          for (let i = 0; i < n; i++) { let h; do h = rng.int(3); while (h === prev); b.seq.push(h); prev = h; }
          b.ri = 0; b.ph = 0; b.pt = b.rage ? 0.35 : 0.45; b.set('ring', 99);
        }
        break;
      case 'ring': {
        const h = b.seq[b.ri]; b.pt -= dt;
        if (b.ph === 0) {                                                // the head's lamp is lit: that is the height of the next ring
          b.lamp[h] = 1;
          if (b.pt <= 0) {
            const o = b.toWorld(34, HEAD_Y[h]);
            b.shoot({ x: o.x, y: o.y, vx: b.face * (b.rage ? 340 : 300), life: 4, r: 11, cut: true, paint: paintRing });
            fx.spark(o.x, o.y, 8, LAMP, 220, 0.3); fx.ring(o.x, o.y, 6, 120, LAMP, 0.2);
            b.ph = 1; b.pt = (b.rage ? 0.4 : 0.5);
          }
        } else if (b.pt <= 0) {
          b.ri++;
          if (b.ri >= b.seq.length) b.set('recover', 1.0 * f);
          else { b.ph = 0; b.pt = b.rage ? 0.35 : 0.45; }
        }
        break;
      }
      case 'geyserTell':
        if (b.t <= 0) { b.wave = 0; b.wt = 0; b.set('geyser', 99); }
        break;
      case 'geyser':
        b.wt -= dt;
        if (b.wave < 3 && b.wt <= 0) {
          for (const p of G.players) if (!p.down) {
            addMark(b, p.x);
            if (b.rage) { addMark(b, p.x - 110); addMark(b, p.x + 110); }   // rage twist: a column either side as well
          }
          b.wave++; b.wt = 0.7;
        }
        if (b.wave >= 3 && !b.marks.length) b.set('recover', 1.1 * f);
        break;
      case 'toppleTell':
        if (b.t <= 0) b.set('topple', FALL_T);
        break;
      case 'topple': {
        const u = 1 - b.t / FALL_T; b.lie = U.clamp(u * u, 0, 1);
        const a = b.lie * Math.PI / 2;
        G.combat.hurtPlayers(hz(b, -32, 34 + 152 * Math.sin(a), -(152 * Math.cos(a) + 64 * Math.sin(a)), 0), b.x);
        if (b.t <= 0) {
          b.lie = 1; if (b.zone) b.zone.live = false; b.zone = null;
          G.combat.hurtPlayers(hz(b, 28, REACH, -64, 0), b.x);
          fx.jolt(0.1, 16); fx.dust(b.x + b.face * 100, b.floor, 18); fx.ring(b.x + b.face * 100, b.floor - 6, 10, 360, '#e6eef4', 0.35);
          b.set('lying', LIE_T + (b.flags.stiff ? 1.5 : 0) - (b.rage ? 0.4 : 0));
        }
        break;
      }
      case 'lying':
        b.lie = 1;
        if (b.t <= 0) { b.lie0 = 1; b.set('rise', RISE_T); }
        break;
      case 'rise':
        b.lie = b.lie0 * Math.max(0, b.t / RISE_T);
        if (b.t <= 0) { b.lie = 0; b.set('recover', 0.5); }
        break;
      case 'leverTell':
        if (b.t <= 0) { b.ln = 0; b.lt = 0; b.set('lever', 99); }
        break;
      case 'lever':
        b.lt -= dt;
        if (b.lt <= 0) {
          if (b.ln >= (b.rage ? 3 : 2)) { b.set('recover', 1.0 * f); break; }
          const o = b.toWorld(30, -90), ang = Math.atan2(tgt.cy - o.y, tgt.x - o.x), v = 470;
          b.shoot({ x: o.x, y: o.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0.65, r: 10, cut: true, paint: paintLever,
            onEnd(s) {
              fx.spark(s.x, s.y, 8, PALE, 240, 0.3);
              const cur = G.rooms.current && G.rooms.current.boss;
              if (b.flags.noReturn || cur !== b || b.state === 'dead') return;       // the punched Crown: it drops and stays down
              const h = b.toWorld(0, -90), d = Math.hypot(h.x - s.x, h.y - s.y), sp = 340;
              b.shoot({ x: s.x, y: s.y, vx: (h.x - s.x) / d * sp, vy: (h.y - s.y) / d * sp, life: d / sp + 0.05, r: 10, cut: true, tile: 'pass', paint: paintLever });
            } });
          fx.spark(o.x, o.y, 6, PALE, 200, 0.25);
          b.ln++; b.lt = b.rage ? 0.4 : 0.5;
        }
        break;
      case 'recover':
        b.sig = false;
        if (b.t <= 0) b.set('idle', rng.range(0.4, 0.8) * f);
        break;
    }
  },

  draw(b, ctx) {
    const flash = b.flash > 0, rage = b.rage && b.state !== 'dead';
    const A = flash ? '#ffffff' : (rage ? '#e8dcd6' : PALE), B = flash ? '#ffffff' : (rage ? '#bba9a6' : PALE2);
    // 1 and 2: the two lever arms (behind the heads), raised by b.arms
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * 30, -86); ctx.rotate(side * (0.9 - b.arms * 2.0));
      blob(ctx, -3, side > 0 ? -2 : -34, 6, 36, 3, SLATE); disc(ctx, 0, side > 0 ? 36 : -36, 6, LAMP); ctx.restore();
    }
    blob(ctx, -35, -14, 70, 14, 5, SLATE);                                // 3: foot rail plate
    blob(ctx, -30, -58, 60, 44, 12, B);                                    // 4: bottom head
    blob(ctx, -28, -106, 56, 44, 12, A);                                   // 5: middle head
    blob(ctx, -26, -152, 52, 44, 12, B);                                   // 6: top head
    blob(ctx, -24, -64, 48, 7, 3, SLATE); blob(ctx, -22, -112, 44, 7, 3, SLATE);   // 7, 8: neck bands
    // 9 and 10: the lamps of the bottom and middle heads, lit before they fire a ring
    for (let i = 0; i < 2; i++) { const l = b.lamp[i]; disc(ctx, 18, HEAD_Y[i], 9, l > 0.05 ? (l > 0.6 ? '#fff6d0' : LAMP) : '#5a6672'); if (l > 0.6) { ctx.globalAlpha *= 0.4; disc(ctx, 18, HEAD_Y[i], 14, LAMP); ctx.globalAlpha /= 0.4; } }
    // 11: the lens of the top head (the Top Lens slot is drawn on it); 12: the open crown bowl
    const lit = Math.max(b.lamp[2], b.sig ? 0.6 + 0.4 * Math.sin(G.time * 18) : 0);
    disc(ctx, 20, HEAD_Y[2], 12, lit > 0.05 ? (lit > 0.6 ? '#fff6d0' : LAMP) : '#5a6672');
    ctx.beginPath(); ctx.moveTo(-22, -150); ctx.quadraticCurveTo(-4, -134, 14, -150); ctx.lineTo(10, -154); ctx.quadraticCurveTo(-4, -142, -18, -154); ctx.closePath();
    ctx.fillStyle = SLATE; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  }
});
})();
