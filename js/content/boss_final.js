/* CONTENT: the boss of region final (The Terminus), THE LONG CLOCK (id long_clock). The last boss: it never moves.
   Structure follows boss_r1.js. Everything the base class lacks is done inside this file:
   - Warden bonuses: at the start of the fight (b.start is wrapped) each Warden beaten (G.run.beaten r1..r4) takes 12% off
     the 760 hp and weakens one hazard (r1 floor rings slower, r2 steam hands slower, r3 spark rain thinner, r4 no summons).
     The result is in b.mods (read by the checks).
   - Armour: its shutters close while it attacks (slashes do 30%); recover, wind-up and transition windows take full damage.
   - Attacks: Floor Rings (shockwaves along the floor, jump them), Steam Hands (two jets sweep up from the floor like clock
     hands, slowly), Spark Rain (the bell chimes, marked columns of sparks), Wind Up (summons ballast crabs, at most 3 alive,
     the mainspring flares). At half health: a short harmless transition, then a pendulum swings across the floor for the rest
     of the fight (period 3.4 s).
   - Fare slots: Side Vent (pierce, alternates sides, shots must fly in horizontally at vent height: from the outer planks),
     Bell Housing (arc, only while the bell chimes, only on the way down: from the inner planks), Mainspring (burst, only while
     it flares, close range), Base Rail (ground, slide in along the floor from the right).
   Boss space: the clock always faces right (b.face stays 1); local y is up-negative, the origin is at the feet. */
(() => {
'use strict';
const G = window.G, U = G.util, fx = G.fx;

const HP = 1300, BODY_W = 190, BODY_H = 230;
const HUB_Y = -150, HAND_LEN = 270, HAND_A0 = 82 * Math.PI / 180, HAND_A1 = -6 * Math.PI / 180, HAND_LAG = 0.8;
const PEND_L = 410, PEND_R = 28, PEND_A = 0.7, PEND_P = 3.4, PEND_TOP = 40;
const ATTACKS = ['rings', 'hands', 'rain', 'wind'];
const ARMOURED = { ringTell: 1, ring: 1, handsTell: 1, hands: 1, rainTell: 1, rain: 1 };
const INK = '#0a0b1a', I0 = '#171a3e', I1 = '#232865', I2 = '#3a418f', I3 = '#7c84e0', WHITE = '#f4f1e8', LAMP = '#f4e6b8', WARN = '#b8482f';
const ventBroken = b => b.spots.some(s => s.cls === 'pierce' && s.broken);   // the vent slot may be locked out of this run's chart: then it is never broken
let cur = null;                                                      // the live boss (there is only ever one), for the vent slot's position

// ---------------------------------------------------------------- set-up that depends on the run
// Called when the boss is built and again when the fight starts (the arena may have been entered before a Warden fell).
function setup(b) {
  const be = (G.run && G.run.beaten) || {}, n = ['r1', 'r2', 'r3', 'r4'].filter(r => be[r]).length;
  b.maxHp = b.hp = HP * (1 - 0.12 * n);
  b.mods = { wardens: n, ringSpeed: be.r1 ? 215 : 330, handSpeed: be.r2 ? 0.31 : 0.45, rainGap: be.r3 ? 0.42 : 0.24, summons: !be.r4 };
}

// ---------------------------------------------------------------- helpers
const crabs = () => G.rooms.current.enemies.filter(e => e.id === 'ballast_crab' && !e.dead);

function summon(b) {
  if (!b.mods.summons || b.flags.noSummon) return;
  const room = G.rooms.current, free = 3 - crabs().length, want = Math.min(free, b.flags.p2 ? 3 : 2);
  for (let k = 0; k < want; k++) {
    const side = (k + (b.last === 'wind' ? 0 : 1)) % 2 ? 1 : -1, x = U.clamp(b.x + side * (150 + k * 36), b.minX - 60, b.maxX + 60);
    const e = new G.Enemy(G.enemyDefs.ballast_crab, x, b.floor);
    e.summoned = true;
    e.damage = function (d, fromX) {                                  // summoned crabs drop no scrip, so they cannot be farmed
      if (this.dead) return;
      this.hp -= d; this.flash = 0.1; this.kbT = 0.12; this.kbV = Math.sign(this.x - fromX || 1) * 220;
      if (this.hp <= 0) { this.dead = true; fx.spark(this.x, this.y - this.h / 2, 18, '#e9e2cf', 320, 0.5); }
    };
    room.enemies.push(e); fx.dust(x, b.floor, 10); fx.ring(x, b.floor - 10, 4, 120, LAMP, 0.3);
  }
}

// The Side Vent alternates sides: open 3.6 s, shut 0.5 s, then the other side.
function vents(b, dt) {
  b.ventT -= dt;
  if (b.ventT > 0) return;
  if (b.ventOpen) { b.ventOpen = false; b.ventT = 0.5; }
  else { b.ventOpen = true; b.ventSide = -b.ventSide; b.ventT = 3.6; fx.ring(b.x + b.ventSide * 100, b.y - 120, 6, 90, '#dfe6ff', 0.3); }
}

// Spark marks: a column is marked on the floor, then a spark falls down it 0.6 s later.
function marks(b, dt) {
  for (let i = b.marks.length - 1; i >= 0; i--) {
    const m = b.marks[i]; m.t -= dt;
    if (m.t > 0) continue;
    b.marks.splice(i, 1);
    b.shoot({ x: m.x, y: 50, vy: 640, life: 1.2, r: 8, paint: paintSpark });
  }
}

// The pendulum: pivot in the ceiling above the clock, swings across the floor. Danger only while armed.
function pendulum(b, dt, armed) {
  if (!b.flags.p2) return;
  b.pt += dt; b.pa = Math.min(1, b.pa + dt / 1.5);
  const phi = PEND_A * b.pa * Math.sin(b.pt * 6.283 / PEND_P);
  b.bob = { x: b.x + PEND_L * Math.sin(phi), y: PEND_TOP + PEND_L * Math.cos(phi), phi };
  if (!armed) return;
  for (const p of G.players) if (!p.down && U.circleRect(b.bob.x, b.bob.y, PEND_R - 2, p.rect())) p.hurt(b.bob.x);
}

const pickAttack = b => {
  const rng = G.run.rng;
  for (let guard = 0; guard < 12; guard++) {
    if (!b.bag.length) b.bag = rng.shuffle(ATTACKS);
    let a = b.bag.pop();
    if (a === b.last && b.bag.length) { const o = b.bag.pop(); b.bag.unshift(a); a = o; }
    if (a === 'rain' && b.flags.noRain) continue;
    return a;
  }
  return 'rings';
};

function chooseAttack(b) {
  const sp = b.flags.p2 ? 0.8 : 1, a = pickAttack(b);
  b.last = a;
  if (a === 'rings') b.set('ringTell', 0.7 * sp);
  else if (a === 'hands') b.set('handsTell', 0.9 * sp);
  else if (a === 'rain') b.set('rainTell', 0.7 * sp);
  else b.set('windTell', 0.9 * sp);
}

// ---------------------------------------------------------------- shot painters (world space)
const paintRing = (ctx, s) => {
  const d = Math.sign(s.vx) || 1;
  ctx.save(); ctx.translate(s.x, s.y); ctx.scale(d, 1);
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-8, -40, 12, -40); ctx.quadraticCurveTo(18, -20, 14, 0); ctx.closePath();
  ctx.fillStyle = '#e8ecff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
};
const paintSpark = (ctx, s) => {
  ctx.save(); ctx.translate(s.x, s.y);
  ctx.fillStyle = WARN; ctx.globalAlpha = 0.35; ctx.fillRect(-4, -60, 8, 54); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.283); ctx.fillStyle = WHITE; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = LAMP; ctx.beginPath(); ctx.arc(-2, -2, 3, 0, 6.283); ctx.fill();
  ctx.restore();
};

// ---------------------------------------------------------------- the boss
G.defineBoss({
  id: 'long_clock', name: 'The Long Clock', hp: HP, w: BODY_W, h: BODY_H, contact: false,

  spots: {
    pierce: { name: 'Side Vent', r: 16,
      get local() { return [(cur ? cur.ventSide : 1) * 100, -120]; },                  // alternates sides
      exposed: b => b.ventOpen,
      accepts: (b, st) => Math.abs(st.vx || 0) > Math.abs(st.vy || 0) && Math.sign(st.vx) === -b.ventSide,   // flying in from outside, level
      onBreak(b) { b.flags.oneHand = true; }, lost: 'Only one steam hand is left.' },
    arc: { name: 'Bell Housing', local: [0, -256], r: 20,
      exposed: b => b.state === 'rainTell' || b.state === 'rain',                      // only while it chimes
      accepts: (b, st) => st.vy > 0,                                                   // must fall onto it
      onBreak(b) { b.flags.noRain = true; b.marks.length = 0; }, lost: 'The bell is silent: no more spark rain.' },
    burst: { name: 'Mainspring', local: [0, -66], r: 18,
      exposed: b => b.state === 'windTell' || b.state === 'wind',                      // only while it flares
      onBreak(b) { b.flags.noSummon = true; }, lost: 'It can no longer summon.' },
    ground: { name: 'Base Rail', local: [98, -14], r: 14,
      accepts: (b, st) => st.vx < 0,                                                   // slides in from the right
      onBreak(b) { b.flags.railBroken = true; }, lost: 'Its floor rings come singly.' }
  },

  init(b) {
    cur = b; b.face = 1;
    b.bag = []; b.last = ''; b.marks = []; b.hands = []; b.bob = null;
    b.ventSide = G.run && G.run.rng.chance(0.5) ? 1 : -1; b.ventOpen = true; b.ventT = 3.6;
    b.ringN = 0; b.ringT = 0; b.hT = 0; b.rainLeft = 0; b.rainT = 0; b.pt = 0; b.pa = 0; b.sway = 0;
    setup(b);
    const baseStart = G.Boss.prototype.start, baseDamage = G.Boss.prototype.damage;
    b.start = function () { setup(this); this.scale = 1; cur = this; baseStart.call(this); };
    // Shutters: while it attacks, slashes and token body hits do 30%.
    b.damage = function (d) {
      baseDamage.call(this, ARMOURED[this.state] ? d * 0.3 : d);
      if (this.hp <= 0) for (const e of crabs()) if (e.summoned) e.damage(999, this.x);
    };
  },

  pose(b) { return { ox: b.state === 'stagger' ? Math.sin(G.time * 30) * 2 : (b.state === 'transition' ? Math.sin(G.time * 40) * 3 : 0) }; },

  // While staggered the base class owns the state; the world around it keeps running (the pendulum stays harmless).
  staggered(b, dt) { vents(b, dt); marks(b, dt); pendulum(b, dt, false); },

  update(b, dt) {
    const rng = G.run.rng, sp = b.flags.p2 ? 0.8 : 1;
    b.face = 1; b.x = b.minX + (b.maxX - b.minX) / 2;                  // never moves
    vents(b, dt); marks(b, dt);
    pendulum(b, dt, b.state !== 'transition');
    b.sway = U.approach(b.sway, b.state === 'rainTell' || b.state === 'rain' ? 1 : 0, dt * 5);
    switch (b.state) {
      case 'idle':
        if (b.t <= 0) {
          if (b.rage && !b.flags.p2) { b.flags.p2 = true; b.pt = 0; b.pa = 0; b.marks.length = 0; b.set('transition', 1.7); fx.jolt(0, 12); fx.say('The pendulum breaks loose', 'It swings across the floor. Jump it.', 3); }
          else chooseAttack(b);
        }
        break;
      case 'transition':                               // harmless: the clock shudders, the pendulum swings up to speed (drawn faint)
        if (Math.random() < 0.3) fx.spark(b.x + rng.range(-80, 80), b.y - 200, 1, '#dfe6ff', 120, 0.4);
        if (b.t <= 0) b.set('idle', 0.9);
        break;
      case 'ringTell':                                 // the base glows and the plinth shakes
        if (b.t <= 0) { b.ringN = b.flags.railBroken ? 1 : (b.flags.p2 ? 4 : 3); b.ringT = 0; b.set('ring', 12); }
        break;
      case 'ring':
        b.ringT -= dt;
        if (b.ringT <= 0) {
          fx.jolt(0, 8); fx.dust(b.x, b.floor, 12);
          for (const d of [-1, 1]) b.shoot({ x: b.x + d * 104, y: b.floor, vx: d * b.mods.ringSpeed, life: 4, rect: { w: 26, h: 40 }, tile: 'pass', paint: paintRing });
          b.ringN--; b.ringT = 0.85;
          if (b.ringN <= 0) b.set('recover', 1.5);
        }
        break;
      case 'handsTell':                                // both hands rise out of the hub, dashed, and show their sweep
        b.hands = [{ a: HAND_A0, ghost: true, s: 1 }].concat(b.flags.oneHand ? [] : [{ a: HAND_A0, ghost: true, s: -1 }]);
        if (b.t <= 0) { b.hT = 0; b.set('hands', 12); }
        break;
      case 'hands': {
        b.hT += dt;
        const w = b.mods.handSpeed, span = HAND_A0 - HAND_A1, hubY = b.floor + HUB_Y;
        b.hands = []; let live = false;
        [1, -1].forEach((s, i) => {
          if (s === -1 && b.flags.oneHand) return;
          const ti = b.hT - (i ? HAND_LAG : 0);
          if (ti < 0) { b.hands.push({ a: HAND_A0, ghost: true, s }); live = true; return; }
          const a = HAND_A0 - w * ti;
          if (a <= HAND_A1) return;
          live = true; b.hands.push({ a, s });
          for (let r = 40; r <= HAND_LEN; r += 12) {                       // the jet hurts along its length (not below the floor)
            const px = b.x + s * r * Math.cos(a), py = hubY + r * Math.sin(a);
            if (py > b.floor - 2) break;
            G.combat.hurtPlayers({ x0: px - 10, x1: px + 10, y0: py - 10, y1: py + 10 }, b.x);
          }
        });
        if (!live) { b.hands = []; b.set('recover', 1.6); }
        break;
      }
      case 'rainTell':                                 // the bell swings and chimes: the Bell Housing is open
        if (b.t <= 0) { b.rainLeft = 2.6; b.rainT = 0; b.set('rain', 12); }
        break;
      case 'rain':
        b.rainLeft -= dt; b.rainT -= dt;
        if (b.rainT <= 0) {
          const tgt = b.target(), near = rng.chance(0.55), lo = b.minX - BODY_W / 2 + 20, hi = b.maxX + BODY_W / 2 - 20;
          b.marks.push({ x: U.clamp(near ? tgt.x + rng.range(-50, 50) : rng.range(lo, hi), lo, hi), t: 0.65 });
          b.rainT = b.mods.rainGap * (b.flags.p2 ? 0.85 : 1);
        }
        if (b.rainLeft <= 0) b.set('recover', 1.4);
        break;
      case 'windTell':                                 // the mainspring begins to flare
        if (b.t <= 0) { summon(b); fx.jolt(0, 6); b.set('wind', 1.8); }
        break;
      case 'wind':                                     // flaring: the Mainspring stays open, the body is not armoured
        if (Math.random() < 0.4) fx.spark(b.x, b.y - 66, 1, LAMP, 200, 0.4);
        if (b.t <= 0) b.set('recover', 1.0);
        break;
      case 'recover':
        if (b.t <= 0) b.set('idle', rng.range(0.4, 0.8) * sp);
        break;
    }
  },

  // ------------------------------------------------------------ drawing (boss space, facing right)
  draw(b, ctx) {
    const rr = (x, y, w, h, r) => { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    const shape = (fill, path) => { ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke(); };
    const hit = b.flash > 0, armoured = !!ARMOURED[b.state], dead = b.state === 'dead', a0 = ctx.globalAlpha;
    const hx = 0, hy = HUB_Y, f = Math.max(0, Math.min(1, b.hp / b.maxHp));
    const tell = b.state === 'ringTell' ? 'ring' : b.state === 'handsTell' ? 'hands' : b.state === 'rainTell' ? 'rain' : b.state === 'windTell' ? 'wind' : '';
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 18);

    // 1 plinth, 2-3 buffers
    shape(hit ? WHITE : I2, () => rr(-112, -52, 224, 52, 14));
    shape(WHITE, () => rr(-134, -38, 26, 30, 8)); shape(WHITE, () => rr(108, -38, 26, 30, 8));
    if (tell === 'ring' || b.state === 'ring') {                       // warning: the plinth glows rust along the floor
      ctx.globalAlpha = a0 * (0.35 + 0.4 * pulse); ctx.fillStyle = WARN; ctx.fillRect(-150, -6, 300, 6); ctx.globalAlpha = a0;
    }
    // 5-6 vent pipes, 4 drum
    shape(I2, () => rr(-116, -138, 32, 36, 10)); shape(I2, () => rr(84, -138, 32, 36, 10));
    shape(hit ? WHITE : (armoured ? I0 : I1), () => rr(-92, -232, 184, 190, 26));
    ctx.strokeStyle = armoured ? I2 : I0; ctx.lineWidth = 3; ctx.beginPath();                      // shutter plates close while it attacks
    for (const y of [-212, -194, -64, -50]) { ctx.moveTo(-76, y); ctx.lineTo(armoured ? -50 : -68, y); ctx.moveTo(76, y); ctx.lineTo(armoured ? 50 : 68, y); }
    ctx.stroke();
    if (!ventBroken(b) && !b.ventOpen) { ctx.fillStyle = '#586068'; ctx.fillRect(b.ventSide * 100 - 12, -132, 24, 24); }   // shutter over the closed vent
    if (b.ventOpen && !ventBroken(b)) { ctx.globalAlpha = a0 * 0.6; ctx.fillStyle = '#dfe6ff'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(b.ventSide * (118 + k * 9 + (G.time * 40 + k * 15) % 14), -120 - k * 7, 6 + k, 0, 6.283); ctx.fill(); } ctx.globalAlpha = a0; }
    // 11 bell housing (swings while it chimes)
    ctx.save(); ctx.translate(0, -232); ctx.rotate(Math.sin(G.time * 14) * 0.12 * b.sway);
    shape(hit ? WHITE : '#d5d9f5', () => { ctx.moveTo(-42, 0); ctx.quadraticCurveTo(-42, -44, 0, -46); ctx.quadraticCurveTo(42, -44, 42, 0); ctx.closePath(); });
    ctx.restore();
    if (b.sway > 0.2) { ctx.strokeStyle = LAMP; ctx.lineWidth = 3; ctx.globalAlpha = a0 * 0.8; for (const k of [1, 2]) { ctx.beginPath(); ctx.arc(0, -256, 24 + k * 12 + pulse * 5, -2.4, -0.74); ctx.stroke(); } ctx.globalAlpha = a0; }
    // 7 bezel, 8 face, ticks
    shape(I2, () => ctx.arc(hx, hy, 82, 0, 6.283));
    shape(hit ? '#ffffff' : LAMP, () => ctx.arc(hx, hy, 68, 0, 6.283));
    ctx.strokeStyle = I1; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r0 = i % 3 ? 56 : 50; ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * 62, hy + Math.sin(a) * 62); }
    ctx.stroke();
    // 9-10 hands: remaining health (minute hand: full health points at 12, empty comes back round to it; hour hand follows like a real clock)
    const hand = (len, wid, ang) => shape(I0, () => {
      const c = Math.cos(ang), s = Math.sin(ang), nx = -s * wid, ny = c * wid;
      ctx.moveTo(hx - c * 10 + nx, hy - s * 10 + ny); ctx.lineTo(hx + c * len + nx * 0.3, hy + s * len + ny * 0.3); ctx.lineTo(hx + c * len - nx * 0.3, hy + s * len - ny * 0.3); ctx.lineTo(hx - c * 10 - nx, hy - s * 10 - ny); ctx.closePath();
    });
    const am = -Math.PI / 2 + (1 - f) * 6.283;
    hand(34, 5, -Math.PI / 2 + (1 - f) * 6.283 / 12); hand(54, 4, am);
    shape(I0, () => ctx.arc(hx, hy, 8, 0, 6.283));
    // 12 mainspring: flares while it winds
    const flare = b.state === 'windTell' || b.state === 'wind';
    if (flare) { ctx.globalAlpha = a0 * (0.35 + 0.35 * pulse); ctx.fillStyle = LAMP; ctx.beginPath(); ctx.arc(0, -66, 46 + pulse * 6, 0, 6.283); ctx.fill(); ctx.globalAlpha = a0; }
    shape(flare ? LAMP : '#cfd3f2', () => ctx.arc(0, -66, 30, 0, 6.283));
    ctx.strokeStyle = I1; ctx.lineWidth = 3; ctx.beginPath();
    for (let a = 0; a < 12.5; a += 0.3) { const r = 3 + a * 1.9, x = Math.cos(a + G.time * (flare ? 6 : 0)) * r, y = -66 + Math.sin(a + G.time * (flare ? 6 : 0)) * r; if (a) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();

    // warnings and hazards (drawn over the body)
    if (tell === 'hands' || b.state === 'hands') {
      ctx.save(); ctx.translate(hx, hy); ctx.lineWidth = 3; ctx.strokeStyle = WARN; ctx.globalAlpha = a0 * (tell ? 0.5 + 0.4 * pulse : 0.35);
      for (const s of [1, -1]) {                                       // the sweep's arc, floor to horizontal
        ctx.beginPath(); ctx.setLineDash([8, 10]); ctx.globalAlpha = a0 * 0.5;
        if (s > 0) ctx.arc(0, 0, HAND_LEN, HAND_A1, HAND_A0); else ctx.arc(0, 0, HAND_LEN, Math.PI - HAND_A0, Math.PI - HAND_A1);
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = a0;
      }
      ctx.restore();
      for (const h of b.hands) {
        const c = Math.cos(h.a) * h.s, s = Math.sin(h.a), rmax = s > 0.01 ? Math.min(HAND_LEN, -HUB_Y / s) : HAND_LEN;
        ctx.save(); ctx.lineCap = 'round';
        if (h.ghost) { ctx.strokeStyle = WARN; ctx.globalAlpha = a0 * (0.4 + 0.4 * pulse); ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + c * rmax, hy + s * rmax); ctx.stroke(); }
        else {
          ctx.strokeStyle = INK; ctx.globalAlpha = a0 * 0.7; ctx.lineWidth = 32; ctx.beginPath(); ctx.moveTo(hx + c * 30, hy + s * 30); ctx.lineTo(hx + c * rmax, hy + s * rmax); ctx.stroke();
          ctx.strokeStyle = '#e8ecff'; ctx.globalAlpha = a0 * 0.92; ctx.lineWidth = 26; ctx.stroke();
          ctx.fillStyle = WHITE; for (let r = 40; r < rmax; r += 34) { ctx.beginPath(); ctx.arc(hx + c * r + Math.sin(G.time * 9 + r) * 3, hy + s * r + Math.cos(G.time * 7 + r) * 3, 9 + (r % 3), 0, 6.283); ctx.fill(); }
        }
        ctx.restore();
      }
    }
    if (b.marks.length) {                                              // spark rain: rust marks on the floor, 0.65 s before the spark falls
      for (const m of b.marks) {
        const x = m.x - b.x, k = 1 - m.t / 0.65;
        ctx.save(); ctx.fillStyle = WARN; ctx.globalAlpha = a0 * (0.4 + 0.5 * pulse);
        ctx.beginPath(); ctx.moveTo(x - 16, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x, -14 - k * 8); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        ctx.globalAlpha = a0 * 0.18; ctx.fillRect(x - 3, -480, 6, 480); ctx.restore();
      }
    }
    if (b.flags.p2 && b.bob && !dead) {                                // 13-14 pendulum rod and bob (faint while it is still swinging up to speed)
      const px = 0, py = -(b.floor - PEND_TOP), bx = b.bob.x - b.x, by = b.bob.y - b.y;
      ctx.save(); ctx.globalAlpha = a0 * (b.state === 'transition' ? 0.5 : 1);
      shape(I3, () => { const a = Math.atan2(by - py, bx - px), nx = -Math.sin(a) * 4, ny = Math.cos(a) * 4; ctx.moveTo(px + nx, py + ny); ctx.lineTo(bx + nx, by + ny); ctx.lineTo(bx - nx, by - ny); ctx.lineTo(px - nx, py - ny); ctx.closePath(); });
      shape(WHITE, () => ctx.arc(bx, by, PEND_R, 0, 6.283));
      shape(I1, () => ctx.arc(bx, by, PEND_R - 11, 0, 6.283));
      ctx.restore();
    }
  }
});
})();
