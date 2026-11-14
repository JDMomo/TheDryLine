/* Enemies: a registry plus a base class that handles physics, damage, knockback, contact damage and death. */
(() => {
'use strict';
const G = window.G, C = G.C, T = C.T, U = G.util, fx = G.fx, tiles = G.tiles;
G.enemyDefs = {};
let uid = 0;

/* G.defineEnemy({ id, name, hp, w, h, touch, shards: [min, max], flying, gravity, collide, heavy,
                   init(e), update(e, dt), draw(e, ctx) })
   touch    truthy = touching it hurts a player (one pip); 0 = harmless body.  shards: scrip dropped, min to max
   heavy    true = barely knocked back
   flying   true = spawned at 'F' markers instead of 'E'; usually with gravity: false
   gravity  default true.  collide: default true (stopped by tiles)
   update   set e.vx / e.vy and e.face; the base class moves the box. Helpers: e.set(state, t), e.state, e.t (counts down),
            e.onGround, e.hitWall (-1 | 0 | 1), e.edgeAhead(), e.target() (nearest standing player or null)
   draw     world space; the enemy's feet centre is e.x, e.y */
G.defineEnemy = def => {
  if (!def.id || typeof def.update !== 'function') return G.fail('bad enemy definition: ' + (def.id || '?'));
  G.enemyDefs[def.id] = Object.assign({ hp: 20, w: 28, h: 24, touch: 1, shards: [1, 3] }, def);
  if (def.draw) G.art.define('enemy_' + def.id, (ctx, o) => def.draw(o.ent, ctx));
};

class Enemy {
  constructor(def, x, y) {
    Object.assign(this, { def, id: def.id, uid: 'e' + (++uid), x, y, w: def.w, h: def.h, vx: 0, vy: 0, face: -1, hp: def.hp,
      flash: 0, kbT: 0, kbV: 0, onGround: false, hitWall: 0, dead: false, state: 'idle', t: 0 });
    this.aggro = 1;
    if (def.init) def.init(this);
  }
  // Per-region difficulty (G.defineRegion scale: { hp, aggro }): fewer hit points, a slower tempo (waits, wind-ups and walking are longer
  // by 1 / aggro). The enemy definitions themselves are never edited.
  applyScale(sc) { if (!sc) return; if (sc.hp) this.hp = Math.max(1, Math.round(this.hp * sc.hp)); if (sc.aggro) this.aggro = sc.aggro; }
  rect() { return { x0: this.x - this.w / 2, x1: this.x + this.w / 2, y0: this.y - this.h, y1: this.y }; }
  set(state, t = 0) { this.state = state; this.t = t; }
  target() {
    let best = null, bd = Infinity;
    for (const p of G.players) { if (p.down) continue; const d = Math.abs(p.x - this.x) + Math.abs(p.y - this.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  // No floor one step ahead in the facing direction.
  edgeAhead() { return !tiles.floorAt(Math.floor((this.x + this.face * (this.w / 2 + 6)) / T), Math.floor((this.y + 2) / T)); }
  damage(d, fromX) {
    if (this.dead) return;
    if (this.def.guard && this.def.guard(this, d, fromX) === false) return;   // guard(e, d, fromX): return false to block the hit
    this.hp -= d; this.flash = 0.1; this.kbT = 0.12; this.kbV = Math.sign(this.x - fromX || 1) * (this.def.heavy ? 60 : 220);
    if (this.hp <= 0) {
      this.dead = true;
      fx.spark(this.x, this.y - this.h / 2, 18, '#e9e2cf', 320, 0.5); fx.ring(this.x, this.y - this.h / 2, 6, 200, '#e9e2cf', 0.25);
      // careful play is rewarded: a kill puts a little into the nearest standing player's mend gauge
      let near = null, nd = 420; for (const p of G.players) { if (p.down) continue; const d = Math.hypot(p.x - this.x, p.cy - this.y); if (d < nd) { nd = d; near = p; } }
      if (near && near.glow < 99) { near.glow = Math.min(99, near.glow + C.KILL_MEND); fx.floatText(near.x, near.y - 56, '+mend', '#fff3c4'); }
      const [lo, hi] = this.def.shards;
      G.combat.dropShards(this.x, this.y - this.h / 2, lo + G.run.rng.int(hi - lo + 1));
    }
  }
  update(dt) {
    const def = this.def;
    this.flash -= dt; this.t -= dt * this.aggro; this.kbT -= dt;
    def.update(this, dt);
    if (def.gravity !== false) this.vy = Math.min(this.vy + 1800 * dt, 900);
    const mvx = this.vx * this.aggro + (this.kbT > 0 ? this.kbV : 0);
    if (def.collide !== false) {
      const res = tiles.moveBox(this, mvx * dt, this.vy * dt);
      this.onGround = res.hy === 1; this.hitWall = res.hx; if (res.hy) this.vy = 0;
    } else { this.x += mvx * dt; this.y += this.vy * dt; }
    this.x = U.clamp(this.x, this.w / 2 + 2, tiles.cols * T - this.w / 2 - 2);
    this.y = U.clamp(this.y, this.h + 2, tiles.rows * T);
    if (def.touch && !this.harmless) G.combat.hurtPlayers(this.rect(), this.x);
  }
  draw(ctx) { G.art.draw('enemy_' + this.id, ctx, { x: this.x, y: this.y, w: this.w, h: this.h, face: this.face, ent: this }); }
}
G.Enemy = Enemy;
})();
