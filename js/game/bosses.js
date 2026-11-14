/* Bosses (Wardens): a registry plus a base class that owns hp, fare slots, the intro, stagger, contact damage and death.
   A boss file only describes what makes the boss itself: its attacks, its poses, its drawing and its fare slots. */
(() => {
'use strict';
const G = window.G, C = G.C, U = G.util, fx = G.fx;
G.bossDefs = {};

/* G.defineBoss({
     id, name, hp, w, h,            body box (its feet centre is b.x, b.y)
     spots: { <cut>: { name, local: [x, y], r, exposed(b), accepts(b, strike), onBreak(b), lost } },
                                    fare slots keyed by cut ('pierce' | 'arc' | 'burst' | 'ground'), at most one per cut.
                                    local is in boss space: x forward, y up negative, origin at the feet
     contact,                       false = touching the body does not hurt
     init(b), update(b, dt),        update runs in every state except sleep, intro, stagger and dead (the base class runs those)
     pose(b),                       optional: { rot, px, py, sx, sy, ox } rotation about local pivot (px, py), squash, x wobble
     draw(b, ctx),                  drawn in boss space, facing right; the base class applies position, facing and pose
     staggered(b, dt)               optional hook while staggered
   })
   Boss space helpers: b.toWorld(lx, ly), b.spotPos(spot). State helpers: b.set(state, t), b.state, b.t (counts down), b.rage (below half hp),
   b.target(), b.facePlayer(), b.flags (free-form, e.g. set by onBreak), b.minX / b.maxX / b.floor (arena limits), b.shoot(def). */
G.defineBoss = def => {
  if (!def.id || typeof def.update !== 'function') return G.fail('bad boss definition: ' + (def.id || '?'));
  for (const cls in def.spots || {}) if (!G.CLASSES[cls] || !def.spots[cls].local) G.fail('boss ' + def.id + ' has a bad fare slot: ' + cls);
  G.bossDefs[def.id] = Object.assign({ hp: 400, w: 120, h: 100, spots: {}, name: def.id }, def);
  if (def.draw) G.art.define('boss_' + def.id, (ctx, o) => def.draw(o.ent, ctx));
};

class Boss {
  // limits: { x0, x1 } the open floor of the arena in pixels (set by the room from its boss door and right wall)
  constructor(def, x, y, region, limits) {
    Object.assign(this, { def, id: def.id, region, x, y, floor: y, vx: 0, vy: 0, face: -1, hp: def.hp, maxHp: def.hp, w: def.w, h: def.h,
      state: 'sleep', t: 0, flash: 0, sealedT: 0, flags: {}, held: null,
      minX: limits.x0 + def.w / 2 + 13, maxX: limits.x1 - def.w / 2 - 13 });
    this.spots = Object.keys(def.spots).map(cls => ({ def: def.spots[cls], cls, hp: C.SPOT_HP, open: false, broken: false, flash: 0 }));
    if (def.init) def.init(this);
  }
  get rage() { return this.hp < this.maxHp / 2; }
  set(state, t = 0) { this.state = state; this.t = t; }
  active() { return this.state !== 'sleep' && this.state !== 'dead'; }
  rect() { return { x0: this.x - this.w / 2, x1: this.x + this.w / 2, y0: this.y - this.h, y1: this.y }; }
  target() {
    let best = null, bd = Infinity;
    for (const p of G.players) { if (p.down) continue; const d = Math.abs(p.x - this.x); if (d < bd) { bd = d; best = p; } }
    return best || G.players[0];
  }
  facePlayer() { this.face = this.target().x < this.x ? -1 : 1; }
  shoot(def) { return G.combat.shoot(Object.assign({ hostile: true }, def)); }

  toWorld(lx, ly) {
    const p = this.def.pose ? this.def.pose(this) : null;
    let x = lx, y = ly;
    if (p && p.rot) {
      const cs = Math.cos(p.rot), sn = Math.sin(p.rot), dx = lx - (p.px || 0), dy = ly - (p.py || 0);
      x = (p.px || 0) + dx * cs - dy * sn; y = (p.py || 0) + dx * sn + dy * cs;
    }
    return { x: this.x + this.face * x, y: this.y + y };
  }
  spotPos(sp) { return this.toWorld(sp.def.local[0], sp.def.local[1]); }
  isExposed(sp) { return !sp.def.exposed || sp.def.exposed(this); }
  // The unpunched fare slot of the strike's cut that the strike reaches, if any.
  spotAt(st) {
    for (const sp of this.spots) {
      if (sp.cls !== st.cls || sp.broken || !this.isExposed(sp)) continue;
      const q = this.spotPos(sp);
      if (Math.hypot(st.x - q.x, st.y - q.y) < st.r + sp.def.r && (!sp.def.accepts || sp.def.accepts(this, st))) return sp;
    }
    return null;
  }
  // A token hit on a fare slot. The third hit punches it: 20% of max hp, a stagger, onBreak, and the punching token is void.
  hitSpot(sp, st) {
    const q = this.spotPos(sp), col = G.CLASSES[sp.cls].color;
    if (!sp.open) {
      fx.spark(q.x, q.y, 6, '#8a938e', 200, 0.25); this.damage(st.dmg || 0);
      if (this.sealedT <= 0) { fx.floatText(q.x, q.y - 14, 'Sealed', '#9aa89f'); this.sealedT = 0.7; }
      return;
    }
    sp.hp--; sp.flash = 0.25; fx.jolt(0.08, 8); fx.spark(q.x, q.y, 22, col, 420, 0.5); fx.ring(q.x, q.y, 8, 300, col, 0.3);
    if (sp.hp > 0) { fx.floatText(q.x, q.y - 16, 'Punch ' + (C.SPOT_HP - sp.hp) + ' of ' + C.SPOT_HP, col); return; }
    sp.broken = true; this.hp -= this.maxHp * C.BREAK_FRAC; this.flash = 0.2; this.set('stagger', C.STAGGER); fx.jolt(0.16, 16);
    fx.spark(q.x, q.y, 46, col, 560, 0.9); fx.ring(q.x, q.y, 10, 520, '#fff3c4', 0.45);
    if (sp.def.onBreak) sp.def.onBreak(this);
    const item = G.game.spend(st.itemId, st.owner);
    G.game.punched(sp.cls);
    fx.say(sp.def.name + ' punched', (item ? item.name + ' is void. ' : '') + (sp.def.lost || ''), 4);
  }
  damage(d) { if (this.active()) { this.hp -= d; this.flash = Math.max(this.flash, 0.07); } }

  // The fight begins: a fare slot opens only if the party carries a token of its cut.
  start() {
    const have = G.game.partyClasses();
    for (const sp of this.spots) sp.open = have.has(sp.cls);
    const open = this.spots.filter(s => s.open).map(s => s.def.name);
    this.set('intro', 1.0); fx.jolt(0, 10);
    if (open.length) G.tips.fire('fare');
    fx.say(this.def.name, open.length ? 'Fare slots open: ' + open.join(', ') + '.' : 'No token carried. Every fare slot is sealed.', 3.5);
  }
  update(dt) {
    this.flash -= dt; this.sealedT -= dt;
    for (const sp of this.spots) sp.flash -= dt;
    if (this.state === 'sleep') return;
    this.t -= dt;
    if (this.state === 'dead') return;
    if (this.held) Object.assign(this, this.held);                 // test hook: G.debug.holdBoss
    else if (this.state === 'intro') { if (this.t <= 0) this.set('idle', C.BOSS_GRACE); }   // no attack for BOSS_GRACE seconds after the intro
    else if (this.state === 'stagger') {
      if (this.y < this.floor) { this.vy += 2000 * dt; this.y = Math.min(this.floor, this.y + this.vy * dt); }
      if (this.def.staggered) this.def.staggered(this, dt);
      if (this.t <= 0) this.set('idle', 0.4);
    } else this.def.update(this, dt);
    this.x = U.clamp(this.x, this.minX, this.maxX);
    if (this.state !== 'stagger' && this.def.contact !== false)
      G.combat.hurtPlayers({ x0: this.x - this.w / 2 + 4, x1: this.x + this.w / 2 - 4, y0: this.y - this.h + 6, y1: this.y }, this.x);
    if (this.hp <= 0) {
      this.hp = 0; this.set('dead', 0); fx.jolt(0.25, 18);
      fx.spark(this.x, this.y - this.h / 2, 80, '#f4e6b8', 620, 1.2); fx.ring(this.x, this.y - this.h / 2, 20, 700, '#fff3c4', 0.6);
      G.combat.clear();
      G.game.bossBeaten(this);
    }
  }
  applyPose(ctx) {
    const p = (this.def.pose && this.def.pose(this)) || {};
    ctx.translate(this.x + (p.ox || 0), this.y); ctx.scale(this.face * (p.sx || 1), p.sy || 1);
    if (p.rot) { ctx.translate(p.px || 0, p.py || 0); ctx.rotate(p.rot); ctx.translate(-(p.px || 0), -(p.py || 0)); }
  }
  draw(ctx) {
    if (this.state === 'dead' && this.t < -1.2) return;
    ctx.save();
    if (this.state === 'dead') ctx.globalAlpha = U.clamp(1 + this.t / 1.2, 0, 1);
    this.applyPose(ctx);
    G.art.draw('boss_' + this.id, ctx, { x: 0, y: 0, face: 1, ent: this });
    if (this.state === 'stagger') { ctx.fillStyle = '#fff3c4'; for (let i = 0; i < 3; i++) { const a = G.time * 5 + i * 2.1; ctx.fillRect(Math.cos(a) * 26, -this.h - 18 + Math.sin(a) * 7, 4, 4); } }
    for (const sp of this.spots) this.drawSpot(ctx, sp);
    ctx.restore();
  }
  // Fare slots look the same on every boss so players can read them: cut colour and shape = open, grey plate = sealed, dark = punched.
  drawSpot(ctx, sp) {
    const [lx, ly] = sp.def.local, r = sp.def.r, cut = G.CLASSES[sp.cls], exposed = this.isExposed(sp);
    ctx.save(); ctx.translate(lx, ly);
    if (sp.broken) {
      ctx.fillStyle = '#12100f'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#5c544b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.5); ctx.lineTo(0, 0); ctx.lineTo(r * 0.5, -r * 0.2); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.2, r * 0.7); ctx.stroke();
    } else if (!sp.open) {
      ctx.fillStyle = '#586068'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#2a3036'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 6), a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * (exposed ? 0.3 + 0.25 * pulse : 0.12); ctx.fillStyle = cut.color; ctx.beginPath(); ctx.arc(0, 0, r + 9 + pulse * 4, 0, 6.283); ctx.fill(); ctx.globalAlpha = a0;
      ctx.fillStyle = sp.flash > 0 ? '#ffffff' : cut.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#1a1410'; G.art.cutShape(ctx, cut.shape, r * 0.55);
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2;
      for (let i = 0; i < C.SPOT_HP - sp.hp; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 2.2 + 0.6) * r, Math.sin(i * 2.2 + 0.6) * r); ctx.stroke(); }
    }
    ctx.restore();
  }
}
G.Boss = Boss;
})();
