/* Shots (friendly and hostile), strikes against enemies and boss fare slots, slash hit tests, scrip pickups (code: shards). */
(() => {
'use strict';
const G = window.G, C = G.C, T = C.T, U = G.util, fx = G.fx, tiles = G.tiles;
const shots = G.shots = [], pickups = G.pickups = [];
const alive = () => G.players.filter(p => !p.down);

const combat = G.combat = {
  /* Spawn a shot. Fields (all optional except x, y):
     vx, vy, grav, life, r            motion and size (circle)
     hostile                          true = hurts players; false = a player's shot
     owner, cls, itemId, dmg          for player shots: who fired it, cut (class id), token id, damage to bodies and enemies
     burst                            radius; the shot does nothing in flight and strikes this radius when it ends
     hug                              true = slides along the floor under gravity (drops off ledges); ends at walls
     tile                             'die' (default) ends on solid tiles, 'pass' ignores them
     rect: { w, h }                   hostile only: a box (bottom centre on x, y) instead of a circle; does not end on hit
     cut                              hostile only: true = a slash destroys it
     paint(ctx, s), onEnd(s)          drawing in world space; callback when it ends
     color, trail                     fallback dot colour; trail = colour of a particle trail
     step(s, dt)                      called every step before the shot moves (steer, bounce, split, wait)
     free                             true = the shot does no hit test of its own (its step does the striking)
     seen                             a Set: things already struck by this shot are skipped and the shot flies on (piercing) */
  shoot(def) {
    const s = Object.assign({ vx: 0, vy: 0, grav: 0, life: 1.5, r: 6, hostile: false, dmg: 6, tile: 'die', burst: 0, age: 0 }, def);
    shots.push(s); return s;
  },
  /* One damaging event from a token: { x, y, r, cls, itemId, owner, dmg, vx, vy, all }.
     Tests the active boss (its fare slot of that cut first, then its body) and enemies (the first one, or all in range with all: true).
     Returns 'spot', 'body', 'enemy' or null. */
  strike(st) {
    const room = G.rooms.current, b = room.boss;
    let res = null;
    if (b && b.active()) {
      const sp = st.cls ? b.spotAt(st) : null;
      if (sp) { if (!(st.seen && st.seen.has(sp))) { if (st.seen) st.seen.add(sp); b.hitSpot(sp, st); res = 'spot'; } }
      else if (U.circleRect(st.x, st.y, st.r, b.rect()) && !(st.seen && st.seen.has(b))) { if (st.seen) st.seen.add(b); b.damage(st.dmg || 0); res = 'body'; }
    }
    for (const e of room.enemies) {
      if (e.dead || (st.seen && st.seen.has(e)) || !U.circleRect(st.x, st.y, st.r, e.rect())) continue;
      if (st.seen) st.seen.add(e);
      e.damage(st.dmg || 0, st.owner ? st.owner.x : st.x); res = res || 'enemy';
      if (!st.all) break;
    }
    return res;
  },
  // True if a shot is in contact with the boss, its fare slot of the shot's cut, or an enemy.
  touching(s) {
    const room = G.rooms.current, b = room.boss;
    if (b && b.active() && (U.circleRect(s.x, s.y, s.r, b.rect()) || (s.cls && b.spotAt(s)))) return true;
    return room.enemies.some(e => !e.dead && U.circleRect(s.x, s.y, s.r, e.rect()));
  },
  // A slash: test the boss body, enemies, cuttable hostile shots and (for a down slash) spikes.
  melee(p, s, rect) {
    const room = G.rooms.current, b = room.boss, dmg = (s.heavy ? 32 : 13) * G.run.mods.dmg;
    if (b && b.active() && !s.hit.boss && U.overlap(rect, b.rect())) {
      const q = b.rect();
      s.hit.boss = true; b.damage(dmg);
      p.slashLanded(s, U.clamp((rect.x0 + rect.x1) / 2, q.x0, q.x1), U.clamp((rect.y0 + rect.y1) / 2, q.y0, q.y1), true);
    }
    for (const e of room.enemies) {
      if (e.dead || s.hit[e.uid] || !U.overlap(rect, e.rect())) continue;
      s.hit[e.uid] = true; e.damage(dmg, p.x); p.slashLanded(s, e.x, e.y - e.h / 2, true);
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const h = shots[i];
      if (h.hostile && h.cut && U.circleRect(h.x, h.y, h.r, rect)) { fx.spark(h.x, h.y, 6, '#fff3c4'); shots.splice(i, 1); }
    }
    if (s.dir === 'down' && !s.hit.spike) {
      const rr = Math.floor(rect.y1 / T);
      for (let c = Math.floor(rect.x0 / T); c <= Math.floor(rect.x1 / T); c++)
        if (tiles.spike(c, rr) && rect.y1 > rr * T + 8) { s.hit.spike = true; p.slashLanded(s, p.x, rr * T + 10, false); break; }
    }
  },
  // Hurt every standing player whose box overlaps the rect. Returns true if anyone was hurt.
  hurtPlayers(rect, fromX) {
    let any = false;
    for (const p of alive()) if (U.overlap(p.rect(), rect) && p.hurt(fromX)) any = true;
    return any;
  },
  clearHostile(x, y, r) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (s.hostile && !s.rect && Math.hypot(s.x - x, s.y - y) < r) { fx.spark(s.x, s.y, 6, '#b79cff'); shots.splice(i, 1); }
    }
  },
  dropShards(x, y, total) {
    const n = Math.min(12, total), each = total / Math.max(1, n);
    for (let i = 0; i < n; i++) pickups.push({ x, y: y - 8, w: 8, h: 8, vx: U.rnd(-160, 160), vy: U.rnd(-380, -160), value: each, life: 14 });
  },
  // keepPickups: leave scrip on the floor (a boss dying wipes shots only).
  clear(keepPickups) { shots.length = 0; if (!keepPickups) pickups.length = 0; },
  // The party leaves a room: scrip still on the floor is collected for it, so nothing is lost by walking out.
  leave() { let n = 0; for (const k of pickups) n += k.value; pickups.length = 0; shots.length = 0; if (n && G.run) G.run.shards += n; return n; },

  update(dt) {
    // Tokens a player carries may have tick(player, dt) for a timer that runs while held (e.g. standing still).
    for (const p of G.players) for (const id of p.items) { const d = G.itemDefs[id]; if (d && d.tick) d.tick(p, dt); }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; let end = false;
      s.age += dt; s.life -= dt; if (s.life <= 0) end = true;
      if (s.step && !end) s.step(s, dt);
      if (s.hug) {
        const box = { x: s.x, y: s.y + s.r, w: s.r * 2, h: s.r * 2 };
        s.vy = Math.min(s.vy + 1800 * dt, 900);
        const res = tiles.moveBox(box, s.vx * dt, s.vy * dt);
        s.x = box.x; s.y = box.y - s.r; if (res.hy === 1) s.vy = 0; if (res.hx) end = true;
      } else {
        s.vy += s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        const lead = s.rect ? s.x + Math.sign(s.vx) * s.rect.w / 2 : s.x;
        if ((s.tile === 'die' || s.rect) && tiles.solid(Math.floor(lead / T), Math.floor((s.y - (s.rect ? 8 : 0)) / T))) end = true;
      }
      if (s.trail && Math.random() < 0.6) fx.parts.push({ x: s.x, y: s.y, vx: U.rnd(-20, 20), vy: U.rnd(-20, 20), life: 0.2, max: 0.2, color: s.trail, grav: 0, size: 3 });
      if (s.x < -60 || s.x > tiles.cols * T + 60 || s.y > tiles.rows * T + 60 || s.y < -400) end = true;
      if (s.hostile) {
        for (const p of alive()) {
          const q = p.rect();
          if (s.rect) { if (U.overlap(q, { x0: s.x - s.rect.w / 2, x1: s.x + s.rect.w / 2, y0: s.y - s.rect.h, y1: s.y })) p.hurt(s.x - Math.sign(s.vx) * 20); }
          else if (U.circleRect(s.x, s.y, s.r, q) && p.hurt(s.x)) end = true;
        }
      } else if (!end) {
        if (s.burst) { if (combat.touching(s)) end = true; }
        else if (!s.free && combat.strike(s) && !s.seen) end = true;
      }
      if (end) {
        if (!s.hostile && s.burst) combat.strike(Object.assign({}, s, { r: s.burst, all: true }));
        if (s.onEnd) s.onEnd(s); else fx.spark(s.x, s.y, 6, s.color || '#fff3c4', 200, 0.25);
        shots.splice(i, 1);
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const k = pickups[i]; k.life -= dt;
      let best = null, bd = 120 * G.run.mods.magnet;
      for (const p of alive()) { const d = Math.hypot(p.x - k.x, p.cy - k.y); if (d < bd) { bd = d; best = p; } }
      if (best && k.life < 13.6) {
        if (bd < 22) { G.run.shards += k.value; fx.spark(k.x, k.y, 3, '#fff3c4', 90, 0.2, 0, 2); pickups.splice(i, 1); continue; }
        k.vx += (best.x - k.x) / bd * 2600 * dt; k.vy += (best.cy - k.y) / bd * 2600 * dt;
      } else k.vy = Math.min(k.vy + 1500 * dt, 700);
      const res = tiles.moveBox(k, k.vx * dt, k.vy * dt);
      if (res.hy === 1) { k.vy = 0; k.vx *= Math.pow(0.02, dt); }
      if (res.hx) k.vx = -k.vx * 0.4;
      if (k.life <= 0) pickups.splice(i, 1);
    }
  },
  draw(ctx) {
    for (const s of shots) {
      if (s.paint) s.paint(ctx, s);
      else { ctx.fillStyle = s.color || (s.hostile ? '#cfe3c0' : '#fff3c4'); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill(); }
    }
    for (const k of pickups) {
      ctx.save(); ctx.translate(k.x, k.y - 5); ctx.rotate(Math.PI / 4 + G.time * 2 + k.x);
      ctx.globalAlpha = k.life < 2 ? 0.4 + 0.6 * (Math.floor(G.time * 10) % 2) : 1;
      ctx.fillStyle = '#fff3c4'; ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
};
})();
