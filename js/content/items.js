/* CONTENT: tokens. One G.defineItem per token (fields: js/game/items.js; recipe: docs/ARCHITECTURE.md; list: bible section 8).
   Three per cut: a common (the baseline), a rare (unlocked by punching a slot of the cut) and a fixed one (one per region's guarded plinth).
   Shots may carry step(s, dt), free and seen (see js/game/combat.js); a token may carry tick(player, dt) while held.
   Per-player token state lives in p.tok. */
(() => {
'use strict';
const G = window.G, fx = G.fx, CL = G.CLASSES, T = G.C.T, tiles = G.tiles;

const tok = p => p.tok || (p.tok = {});
const cdOf = id => G.itemDefs[id].cd * G.run.mods.itemCd;
// An icon: the cut's shape in the cut's colour, plus a small detail in a second tone (drawn after the shape).
const icon = (cls, detail) => ctx => {
  ctx.fillStyle = CL[cls].color; G.art.cutShape(ctx, CL[cls].shape, 10.5);
  if (detail) { ctx.save(); ctx.fillStyle = ctx.strokeStyle = '#1b2a2f'; ctx.lineWidth = 2; ctx.lineCap = 'round'; detail(ctx); ctx.restore(); }
};
const shape = (ctx, cls, r, rot) => { ctx.save(); ctx.rotate(rot || 0); ctx.fillStyle = CL[cls].color; G.art.cutShape(ctx, CL[cls].shape, r); ctx.restore(); };
// A token's sprite as a projectile (centred on the current origin, rotated, size px). False if it has not loaded: draw the old shape.
const spr = (ctx, id, size, rot) => {
  const img = G.sprites['item_' + id]; if (!img) return false;
  ctx.save(); ctx.rotate(rot || 0); ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore(); return true;
};
const pulse = (x, y, r, big, col) => { fx.ring(x, y, 14, big, col, 0.26); fx.ring(x, y, 6, big * 0.65, col, 0.3); fx.spark(x, y, 10, col, 260, 0.3); };
/* Arc tokens are aimed by what is held when the token is used (like the Awl's Up): 'up' (hold Up), 'fwd' (hold the way you face),
   'down' (hold Down) or 'neutral'. Each arc token has a table of launch speeds per aim; px are on level ground. */
const aimOf = p => { const h = p.in.held; return h.up ? 'up' : (h.right && p.face > 0) || (h.left && p.face < 0) ? 'fwd' : h.down ? 'down' : 'neutral'; };
const floorAhead = (s, dir) => tiles.floorAt(Math.floor((s.x + dir * (s.r + 6)) / T), Math.floor((s.y + s.r + 2) / T));

// ---------------------------------------------------------------- pierce (triangle, #56B4E9)
G.defineItem({
  id: 'cobalt_awl', name: 'Cobalt Awl', cls: 'pierce', rarity: 'common', cd: 0.7,
  mat: ['metal'], inter: 'Metal: Conduct with the Brine Flask or a brine puddle; Pull with the Magnet Tooth.',
  desc: 'A fast straight shot. Hold Up to fire it upward.',
  use(p) {
    const up = p.in.held.up, col = CL.pierce.color;
    G.combat.shoot({ x: p.x + (up ? 0 : p.face * 14), y: p.y - (up ? 44 : 24), vx: up ? 0 : p.face * 900, vy: up ? -900 : 0, life: 1.1, r: 5,
      owner: p, cls: 'pierce', itemId: 'cobalt_awl', dmg: 6, color: col, trail: col,
      paint(ctx, s) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.fillStyle = '#d6ecf8'; ctx.fillRect(-18, -2, 30, 4);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.restore();
      } });
  },
  drawIcon: icon('pierce', c => { c.beginPath(); c.moveTo(-3, 6); c.lineTo(3, -1); c.stroke(); })
});

G.defineItem({
  id: 'tin_spindle', name: 'Tin Spindle', cls: 'pierce', rarity: 'rare', cd: 0.9,
  mat: ['metal'], inter: 'Metal: Conduct with the Brine Flask or a brine puddle; Pull with the Magnet Tooth.',
  desc: 'A thin needle that passes through enemies. Stand still for 0.6 s first and it flies twice as far and hits harder.',
  tick(p, dt) { const k = tok(p); k.still = p.onGround && Math.abs(p.vx) < 8 && !p.down ? (k.still || 0) + dt : 0; },
  use(p) {
    const col = CL.pierce.color, charged = (tok(p).still || 0) >= 0.6;
    if (charged) { fx.ring(p.x, p.cy, 6, 70, col, 0.2); fx.spark(p.x + p.face * 14, p.y - 24, 10, col, 260, 0.3); }
    G.combat.shoot({ x: p.x + p.face * 14, y: p.y - 24, vx: p.face * 1250, life: charged ? 1.0 : 0.5, r: 4, seen: new Set(), tile: 'die',
      owner: p, cls: 'pierce', itemId: 'tin_spindle', dmg: charged ? 10 : 5, color: col, trail: col,
      paint(ctx, s) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.scale(Math.sign(s.vx) || 1, 1); ctx.fillStyle = charged ? '#ffffff' : '#d6ecf8'; ctx.fillRect(-26, -1.2, 40, 2.4);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(12, -4); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill(); ctx.restore();
      } });
    tok(p).still = 0;
  },
  drawIcon: icon('pierce', c => { c.beginPath(); c.moveTo(0, 7); c.lineTo(0, -3); c.stroke(); })
});

G.defineItem({
  id: 'flint_tether', name: 'Flint Tether', cls: 'pierce', rarity: 'fixed', cd: 1.2,
  mat: ['metal', 'spark'], inter: 'Spark: its bolt Ignites flammable shots and sets off clouds (Flare). Metal: Conduct, Pull.',
  desc: 'A bolt on a cable. Where it lands, it pulls you.',
  use(p) {
    const col = CL.pierce.color;
    G.combat.shoot({ x: p.x + p.face * 14, y: p.y - 24, vx: p.face * 780, life: 0.5, r: 5, owner: p, cls: 'pierce', itemId: 'flint_tether', dmg: 5, color: col,
      paint(ctx, s) {
        ctx.strokeStyle = '#9fb7c2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y - 24); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore();
      },
      onEnd(s) {
        fx.spark(s.x, s.y, 8, col, 220, 0.25);
        if (p.down) return;
        // Tow: carry the player along the line towards the bolt, stopping a little short of it.
        const dx = s.x - p.x, dy = (s.y + 24) - p.y, d = Math.hypot(dx, dy), go = Math.max(0, d - 52);
        if (go < 8) return;
        const ux = dx / d, uy = dy / d; let left = go;
        p.vx = p.vy = 0;
        G.combat.shoot({ x: s.x, y: s.y, life: 0.4, r: 0, free: true, tile: 'pass', color: col,
          step(t, dt) {
            if (p.down || left <= 0) { t.life = 0; return; }
            const m = Math.min(left, 1500 * dt); left -= m;
            tiles.moveBox(p, ux * m, uy * m); p.vx = p.vy = 0;
          },
          paint(ctx, t) { ctx.strokeStyle = '#9fb7c2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y - 24); ctx.lineTo(s.x, s.y); ctx.stroke(); },
          onEnd() { p.vx = p.vy = 0; } });
      } });
  },
  drawIcon: icon('pierce', c => { c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, 9); c.quadraticCurveTo(-4, 8, -1, 3); c.stroke(); })
});

// ---------------------------------------------------------------- arc (crescent, #F0E442)
G.defineItem({
  id: 'ochre_ladle', name: 'Ochre Ladle', cls: 'arc', rarity: 'common', cd: 1.0,
  mat: ['wet'], inter: 'Wet: its burst leaves a brine puddle (4 s) that Douses fire and soaks enemies, so metal hits Conduct.',
  desc: 'A short, steep lob that bursts where it lands, about 130 px ahead. Hold Up to lob it high, hold the way you face to throw it far, hold Down to drop it close.',
  // [vx, vy] per aim. neutral lands about 130 px ahead, down about 70, fwd about 250, up about 120 (and high: 300 px above the hand)
  LOB: { neutral: [175, -480], down: [100, -300], fwd: [320, -540], up: [105, -900] },
  use(p) {
    const [vx, vy] = G.itemDefs.ochre_ladle.LOB[aimOf(p)];
    G.combat.shoot({ x: p.x + p.face * 10, y: p.y - 34, vx: p.face * vx + p.vx * 0.15, vy, grav: 1500, life: 3, r: 6, burst: 26,
      owner: p, cls: 'arc', itemId: 'ochre_ladle', dmg: 8,
      paint(ctx, s) { ctx.save(); ctx.translate(s.x, s.y); if (!spr(ctx, 'ochre_ladle', 24, G.time * 12)) shape(ctx, 'arc', 8, G.time * 12); ctx.restore(); },
      onEnd(s) { fx.spark(s.x, s.y, 18, CL.arc.color, 300, 0.4); fx.ring(s.x, s.y, 8, 240, CL.arc.color, 0.22); G.materials.puddle(s.x, s.y + 4, p); } });
  },
  drawIcon: icon('arc', c => { c.beginPath(); c.arc(0, 0, 2.4, 0, 6.283); c.fill(); })
});

G.defineItem({
  id: 'sulphur_kettle', name: 'Sulphur Kettle', cls: 'arc', rarity: 'rare', cd: 1.5,
  mat: ['flammable', 'heavy'], inter: 'Flammable: leaves a sulphur cloud (3 s); a spark makes it Flare. Heavy: Shatters brittle shots.',
  desc: 'A heavy, slow lob with a big burst. Hold Up to lob it high, hold the way you face to throw it far. Steer it left and right in flight.',
  LOB: { neutral: [150, -470], down: [90, -330], fwd: [250, -520], up: [95, -820] },
  use(p) {
    const [vx, vy] = G.itemDefs.sulphur_kettle.LOB[aimOf(p)];
    G.combat.shoot({ x: p.x + p.face * 10, y: p.y - 36, vx: p.face * vx, vy, grav: 1000, life: 4, r: 9, burst: 58,
      owner: p, cls: 'arc', itemId: 'sulphur_kettle', dmg: 14,
      step(s, dt) { const h = p.in.held; s.vx = G.util.clamp(s.vx + ((h.right ? 1 : 0) - (h.left ? 1 : 0)) * 700 * dt, -320, 320); },
      paint(ctx, s) { ctx.save(); ctx.translate(s.x, s.y); if (!spr(ctx, 'sulphur_kettle', 36, s.age * 5)) { shape(ctx, 'arc', 13, s.age * 5); ctx.fillStyle = '#5b4d10'; ctx.fillRect(-3, -3, 6, 6); } ctx.restore(); },
      onEnd(s) { fx.spark(s.x, s.y, 30, CL.arc.color, 380, 0.5); fx.ring(s.x, s.y, 10, 320, CL.arc.color, 0.28); fx.jolt(0, 3); if (!s.ignited) G.materials.cloud(s.x, s.y, p, 60, 3, 'arc', 'sulphur_kettle'); } });
  },
  drawIcon: icon('arc', c => { c.fillRect(-3.5, -3, 7, 6); })
});

G.defineItem({
  id: 'chalk_skipstone', name: 'Chalk Skipstone', cls: 'arc', rarity: 'fixed', cd: 1.1,
  mat: ['brittle'], inter: 'Brittle: a heavy shot Shatters it into 3 hits; Crack if you are hurt just after casting.',
  desc: 'A bouncing throw. Each bounce (up to 3) adds damage. Hold Up to lob it high instead.',
  LOB: { neutral: [380, -120], down: [380, -120], fwd: [380, -120], up: [130, -1000] },
  use(p) {
    const aim = aimOf(p), [vx, vy] = G.itemDefs.chalk_skipstone.LOB[aim];
    G.combat.shoot({ x: p.x + p.face * 10, y: p.y - 30, vx: p.face * vx, vy, grav: 1500, life: 2.5, r: 6, tile: 'pass', bounces: 0, lob: aim === 'up',
      owner: p, cls: 'arc', itemId: 'chalk_skipstone', dmg: 6,
      step(s) {
        const lead = s.x + Math.sign(s.vx) * s.r;
        if (tiles.solid(Math.floor(lead / T), Math.floor(s.y / T))) { s.life = 0; return; }
        if (s.vy > 0 && (s.lob ? tiles.solid : tiles.floorAt)(Math.floor(s.x / T), Math.floor((s.y + s.r) / T))) {   // a high lob falls through one-way ledges
          if (s.bounces >= 3) { s.life = 0; return; }
          s.bounces++; s.dmg += 4; s.y = Math.floor((s.y + s.r) / T) * T - s.r; s.vy = -Math.max(340, Math.abs(s.vy) * 0.8);
          fx.spark(s.x, s.y + s.r, 6 + s.bounces * 3, '#fff6a8', 200, 0.25); fx.ring(s.x, s.y + s.r, 4, 40 + s.bounces * 14, CL.arc.color, 0.18);
        }
      },
      paint(ctx, s) { ctx.save(); ctx.translate(s.x, s.y); if (!spr(ctx, 'chalk_skipstone', 20 + 2 * s.bounces, s.age * 14)) shape(ctx, 'arc', 7 + s.bounces, s.age * 14); ctx.restore(); } });
  },
  drawIcon: icon('arc', c => { c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, 8); c.lineTo(-2, 3); c.lineTo(1, 8); c.lineTo(5, 3); c.stroke(); })
});

// ---------------------------------------------------------------- burst (eight-point star, #D55E00)
G.defineItem({
  id: 'cinder_bell', name: 'Cinder Bell', cls: 'burst', rarity: 'common', cd: 1.2,
  mat: ['metal'], inter: 'Metal: Conduct with the Brine Flask or a brine puddle, so its pulse chains past its ring.',
  desc: 'A pulse around you that snuffs out shots in the air.',
  use(p) {
    const x = p.x, y = p.cy, col = CL.burst.color;
    fx.ring(x, y, 14, 460, col, 0.26); fx.ring(x, y, 6, 300, col, 0.3); fx.jolt(0, 3);
    G.combat.clearHostile(x, y, 130);
    G.combat.strike({ x, y, r: 113, cls: 'burst', itemId: 'cinder_bell', owner: p, dmg: 5, all: true });
  },
  drawIcon: icon('burst', c => { c.beginPath(); c.arc(0, 0, 3, 0, 6.283); c.fill(); })
});

G.defineItem({
  id: 'rust_censer', name: 'Rust Censer', cls: 'burst', rarity: 'rare', cd: 1.5,
  mat: ['metal', 'flammable'], inter: 'Flammable: each pulse leaves a cinder cloud (2.5 s); a spark makes it Flare. Metal: Conduct.',
  desc: 'A pulse around you. A second pulse fires 1.2 s later where you stood.',
  use(p) {
    const x = p.x, y = p.cy, col = CL.burst.color, hit = (px, py) => {
      pulse(px, py, 100, 400, col); fx.jolt(0, 3); G.combat.clearHostile(px, py, 115);
      G.materials.cloud(px, py, p, 50, 2.5, 'burst', 'rust_censer');
      G.combat.strike({ x: px, y: py, r: 100, cls: 'burst', itemId: 'rust_censer', owner: p, dmg: 5, all: true });
    };
    hit(x, y);
    G.combat.shoot({ x, y, life: 1.2, r: 0, free: true, tile: 'pass', owner: p, color: col,
      paint(ctx, s) { const k = s.age / 1.2; ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = 0.35 + 0.4 * k; if (!spr(ctx, 'rust_censer', 18 + 18 * k, s.age * 4)) shape(ctx, 'burst', 8 + 8 * k, s.age * 4); ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 100 * k, 0, 6.283); ctx.stroke(); ctx.restore(); },
      onEnd(s) { hit(s.x, s.y); } });
  },
  drawIcon: icon('burst', c => { c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 4.5, 0, 6.283); c.stroke(); })
});

G.defineItem({
  id: 'copper_drum', name: 'Copper Drum', cls: 'burst', rarity: 'fixed', cd: 1.4,
  mat: ['metal'], inter: 'Metal: Conduct with the Brine Flask or a brine puddle. Launches allies, but Lead Boot carriers are Anchored.',
  desc: 'A pulse around you that launches you and nearby allies upward.',
  use(p) {
    const x = p.x, y = p.cy, col = CL.burst.color;
    pulse(x, y, 96, 380, col); fx.jolt(0.03, 5);
    G.combat.clearHostile(x, y, 105);
    G.combat.strike({ x, y, r: 96, cls: 'burst', itemId: 'copper_drum', owner: p, dmg: 4, all: true });
    for (const q of G.players) if (!q.down && Math.hypot(q.x - x, q.cy - y) < 140) { q.vy = -640; q.onGround = false; q.jumping = false; fx.spark(q.x, q.y, 8, col, 200, 0.3, 100); }
  },
  drawIcon: icon('burst', c => { c.fillRect(-4, -3, 8, 6); })
});

// ---------------------------------------------------------------- ground (flat slab, #CC79A7)
const slab = col => (ctx, s) => { ctx.fillStyle = col; ctx.fillRect(s.x - 10, s.y - 5, 20, 12); ctx.fillStyle = '#3a2433'; ctx.fillRect(s.x - 10, s.y + 4, 20, 3); };

G.defineItem({
  id: 'basalt_roller', name: 'Basalt Roller', cls: 'ground', rarity: 'common', cd: 0.9,
  mat: ['heavy'], inter: 'Heavy: Shatters brittle shots. With Lead Boot it Stops at you or a wall; a slash Kicks it on at double damage.',
  desc: 'A slab that slides along the floor and drops off ledges.',
  use(p) {
    const col = CL.ground.color;
    G.combat.shoot({ x: p.x + p.face * 14, y: p.y - 8, vx: p.face * 460, hug: true, life: 1.6, r: 7,
      owner: p, cls: 'ground', itemId: 'basalt_roller', dmg: 7, color: col, trail: col, paint: slab(col) });
  },
  drawIcon: icon('ground', c => { c.fillRect(-7, 0.5, 14, 2); })
});

G.defineItem({
  id: 'quartz_wake', name: 'Quartz Wake', cls: 'ground', rarity: 'rare', cd: 1.1,
  mat: ['brittle'], inter: 'Brittle: a heavy shot Shatters it into 3 hits; Crack if you are hurt just after casting.',
  desc: 'A sliding wave that splits in two at each ledge.',
  use(p) {
    const col = CL.ground.color;
    const wave = (x, y, vx, gen) => G.combat.shoot({ x, y, vx, hug: true, life: 1.5, r: 7, gen, owner: p, cls: 'ground', itemId: 'quartz_wake', dmg: 5, color: col, trail: col,
      step(s) {
        const air = s.vy > 60;
        if (air && !s.air && s.age > 0.05 && s.gen < 2) { const d = Math.sign(s.vx); wave(s.x - d * 18, s.y - 4, -s.vx, s.gen + 1); fx.spark(s.x, s.y, 8, col, 200, 0.25); }
        s.air = air;
      },
      paint(ctx, s) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(s.x - Math.sign(s.vx) * 12, s.y + 7); ctx.quadraticCurveTo(s.x - Math.sign(s.vx) * 4, s.y - 12, s.x + Math.sign(s.vx) * 10, s.y + 7); ctx.closePath(); ctx.fill(); } });
    wave(p.x + p.face * 14, p.y - 8, p.face * 400, 0);
  },
  drawIcon: icon('ground', c => { c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, 4); c.quadraticCurveTo(-3, -1, 0, 4); c.quadraticCurveTo(3, -1, 6, 4); c.stroke(); })
});

G.defineItem({
  id: 'pumice_crawler', name: 'Pumice Crawler', cls: 'ground', rarity: 'fixed', cd: 1.0,
  mat: ['flammable', 'spark'], inter: 'Spark: its flame Ignites flammable shots and sets off clouds. Flammable: another spark makes it burn bigger.',
  desc: 'A slow floor flame that lasts a long time. It waits at ledges: press the item button again to send it on.',
  use(p) {
    const k = tok(p), col = CL.ground.color, live = k.crawler && G.shots.includes(k.crawler) ? k.crawler : null;
    if (live) {                                     // second press: send it on
      if (live.waiting) { live.waiting = false; live.go = true; live.vx = live.dir * 150; fx.ring(live.x, live.y, 4, 60, col, 0.2); }
      p.itemCd = p.itemCdMax = 0.2; return;
    }
    p.itemCd = p.itemCdMax = 0.25;                  // short for now so the second press can come; the full cooldown starts when the flame ends
    const dir = p.face;
    k.crawler = G.combat.shoot({ x: p.x + dir * 14, y: p.y - 8, vx: dir * 150, hug: true, life: 8, r: 8, dir, go: false, waiting: false, hitT: 0, free: true,
      owner: p, cls: 'ground', itemId: 'pumice_crawler', dmg: 4, color: col, trail: '#e9b4d0',
      step(s, dt) {
        if (s.vy === 0 && !s.go) {
          const edge = !floorAhead(s, s.dir);
          if (edge) { s.waiting = true; s.vx = 0; } else if (s.waiting) { s.waiting = false; s.vx = s.dir * 150; }
        }
        if (s.go && s.vy === 0 && s.vx === 0) s.vx = s.dir * 150;
        s.hitT -= dt;
        if (s.hitT <= 0) {
          s.hitT = 0.4;
          G.combat.strike({ x: s.x, y: s.y, r: s.r + 8, cls: 'ground', itemId: 'pumice_crawler', owner: p, dmg: s.dmg, vx: s.vx || s.dir, all: true });
        }
      },
      paint(ctx, s) {
        const f = Math.sin(s.age * 18) * 2;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(s.x - 11, s.y + 8); ctx.quadraticCurveTo(s.x - 9, s.y - 8 + f, s.x, s.y - 14 - f); ctx.quadraticCurveTo(s.x + 9, s.y - 8 - f, s.x + 11, s.y + 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.moveTo(s.x - 5, s.y + 8); ctx.quadraticCurveTo(s.x, s.y - 6 - f, s.x + 5, s.y + 8); ctx.closePath(); ctx.fill();
        if (s.waiting) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(s.age * 8); ctx.beginPath(); ctx.arc(s.x, s.y, 20, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
      },
      onEnd(s) { fx.spark(s.x, s.y, 8, col, 160, 0.3); k.crawler = null; p.itemCd = p.itemCdMax = cdOf('pumice_crawler'); } });
  },
  drawIcon: icon('ground', c => { c.beginPath(); c.moveTo(-3, 2.5); c.quadraticCurveTo(0, -6, 3, 2.5); c.closePath(); c.fill(); })
});
})();
