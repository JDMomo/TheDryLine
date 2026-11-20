/* ART: boss skins. The boss equivalent of G.enemySkins: when the owner supplies sheets for a boss they drop in with one table entry (written for you
   by tools/art/cut_boss.py), no code changes. A skin maps every state and attack phase of a boss to a strip and a frame, drawn in place of the
   code-drawn boss while the watercolor art is on (F2, G.artTest). Anything a skin lacks falls back to the code-drawn boss for that moment, so a
   half-finished set never hides a wind-up: a missing strip shows the old art with its readable pose, never a stale frame.

   Table entry (G.bossSkins, keyed by the GAME boss id):
     { id: 'tunnel_warden',                 the asset id: strips are assets/bosses/<id>/<sheet>.png unless base says otherwise
       base: 'assets/bosses/tunnel_warden/', h: 150,   h = the cell height in game pixels (cells are cut at twice game scale; cut_boss.py writes it)
       strips: { idle: 4, move: 6, turn: 4, hurt: 4, stagger: 4, enraged: 4, defeat: 6, fx: 6, <attack sheets>: n },     frames per sheet
       attacks: { <attack id>: '<sheet>' | { sheet, split: [wind, strike, recover] } },   attack id = the boss's attack registry (G.defineAttacks)
       fx: { <shot kind>: cell | [cells] },  fps: { idle: 6, move: 10, stagger: 8, enraged: 6 },  ox, oy: nudge in game pixels, badges: false }
   WIDE bosses: the prompt pack splits their sheets into parts a and b; cut_boss.py cuts them as one strip (a then b), so a table entry never
   mentions parts: strips.move is just 8 where a normal boss has 6.

   What is shown when (first match wins)
     dead      defeat strip, played once over 1 s (the boss fades out after it);   sleep, intro   idle
     stagger   the stagger loop;   attack phases (b.phase(), from the attack registry): the attack's sheet, frames spread over the REAL timers:
               wind-up frames over the tell state's own timer (b.t0), the strike frame(s) while the strike states last (over the attack's strikeT),
               recovery frames over the recovery state's own timer. Default split of n frames: strike 1 (2 when n >= 8), wind-up (n - strike) / 2 rounded
               up, the rest recovery (6 frames: 3 / 1 / 2; 4: 2 / 1 / 1; 8: 3 / 2 / 3). A skin never plays hurt over a wind-up or a strike.
     else      hurt (frames 0-1 light, 2-3 heavy; 0.3 s after a hit) > turn (0.3 s when the facing flips) > enraged loop (below half hp) >
               move loop (walking) > idle loop
   Fare-slot badges are drawn on top at the real anchors (b.spotPos, which includes the code pose and the moving anchors), exactly as for the
   code-drawn boss: the hit tests never read the art. Shots with a `kind` (b.shoot({ kind: 'wave', ... })) are drawn from the fx strip when the skin
   lists that kind: cell(s) of the fx sheet, tinted with the shot's own colour (fx art is pale cream and gold).
   G.debug.bossSkinFixture = true puts the throwaway test skin (G.bossSkinFixtures, tools/art/fixtures) on the Tollkeeper. */
(() => {
'use strict';
const G = window.G, U = G.util;

G.bossSkins = {
/* <boss-skins> one line per boss, written by tools/art/cut_boss.py (do not reorder by hand) */
/* </boss-skins> */
};
// The throwaway test boss (tools/art/fixtures): shapes in the prompt pack's format, used only with G.debug.bossSkinFixture = true.
G.bossSkinFixtures = {
/* <boss-skin-fixtures> written by tools/art/cut_boss.py --fixture */
  tollkeeper: {"id": "testboss", "base": "tools/art/fixtures/testboss/strips/", "h": 116.0, "strips": {"charge": 8, "defeat": 6, "enraged": 4, "hurt": 4, "idle": 4, "leap": 6, "move": 6, "spit": 4, "stagger": 4, "turn": 4, "fx": 6}, "fx": {"wave": 0, "glob": [1, 2]}}
/* </boss-skin-fixtures> */
};

const STANDARD = { idle: 6, move: 9, stagger: 8, enraged: 6, hurt: 0, turn: 0, defeat: 0 };
const DEFEAT_T = 1.0, HURT_T = 0.3, TURN_T = 0.3, WALK = 12;
const loaded = new WeakSet(), memo = new WeakMap(), tintCache = {};

// ---------------------------------------------------------------- loading
const strip = (e, name) => G.strips['boss_' + e.id + '_' + name];
const loadEntry = e => {
  if (loaded.has(e)) return;
  loaded.add(e);
  for (const name in e.strips) {
    const img = new Image(), key = 'boss_' + e.id + '_' + name, frames = e.strips[name];
    G.spritesPending = (G.spritesPending || 0) + 1;
    const done = ok => { if (ok && img.naturalWidth > 0) G.strips[key] = { img, frames, fw: img.naturalWidth / frames, fh: img.naturalHeight }; else delete G.strips[key]; G.spritesPending--; };
    img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).then(() => done(true), () => done(true)); };
    img.onerror = () => done(false);
    img.src = (e.base || 'assets/bosses/' + e.id + '/') + name + '.png';
  }
};

// The entry in use for this boss right now, or null (art off, no entry, the idle strip not loaded).
const entryOf = b => {
  const fix = G.debug && G.debug.bossSkinFixture && G.bossSkinFixtures[b.id];
  const e = fix || (G.artTest && G.bossSkins[b.id]);
  if (!e) return null;
  loadEntry(e);
  return strip(e, 'idle') ? e : null;
};

// ---------------------------------------------------------------- the state-to-frame mapping
const split = (n, over) => {
  if (over) return over;
  const s = n >= 8 ? 2 : 1, w = Math.ceil((n - s) / 2);
  return [w, s, Math.max(0, n - s - w)];
};
const loop = (e, name) => G.time * ((e.fps && e.fps[name]) || STANDARD[name] || 8);
const frac = (b) => (b.t0 > 0 && b.t0 < 50 ? U.clamp(1 - b.t / b.t0, 0, 0.9999) : 0);        // how far through the state's own timer (open-ended states have t0 >= 50)

function attackPick(b, e) {
  const ph = b.phase();
  if (!ph) return undefined;
  const a = b.attackDef(b.attack), m = e.attacks && e.attacks[b.attack], sheet = (m && (m.sheet || m)) || b.attack, st = strip(e, sheet);
  if (!st) return null;                                                // the attack has no sheet: the code-drawn boss shows its own wind-up
  const [w, s, r] = split(st.frames, m && m.split);
  if (ph === 'wind') return { name: sheet, frame: Math.min(w - 1, Math.floor(frac(b) * w)) };
  if (ph === 'strike') {
    const over = a.strikeT > 0 ? a.strikeT : 0.3, i = s <= 1 ? 0 : Math.min(s - 1, Math.floor(b.sAge / (over / s)));
    return { name: sheet, frame: Math.min(st.frames - 1, w + i) };
  }
  if (!r) return { name: sheet, frame: st.frames - 1 };
  const k = a.recoverStates.length, idx = Math.max(0, a.recoverStates.indexOf(b.state)), p = (idx + frac(b)) / k;
  return { name: sheet, frame: Math.min(st.frames - 1, w + s + Math.min(r - 1, Math.floor(p * r))) };
}

// -> { name, frame, face } or null (draw the code-drawn boss). face: -1 or 1 as the art should face; frames of the art face right.
function pick(b, e) {
  let m = memo.get(b); if (!m) memo.set(b, m = { face: b.face, turnAt: -9, from: b.face });
  const has = n => !!strip(e, n), out = (name, frame, face, lp) => (has(name) ? { name, frame, face: face || b.face, loop: !!lp } : null);
  const st = b.state;
  if (b.face !== m.face) { if (st !== 'dead') { m.from = m.face; m.turnAt = G.time; } m.face = b.face; }
  if (st === 'dead') { const n = e.strips.defeat || 1; return out('defeat', Math.min(n - 1, Math.floor(-b.t / (DEFEAT_T / n)))); }
  if (st === 'sleep' || st === 'intro') return out('idle', loop(e, 'idle'), 0, true);
  if (st === 'stagger') return out('stagger', loop(e, 'stagger'), 0, true);
  const atk = attackPick(b, e);
  if (atk === null) return null;
  if (atk) return out(atk.name, atk.frame);
  if (G.time - b.hurtAt < HURT_T && has('hurt')) { const i = Math.min(1, Math.floor((G.time - b.hurtAt) / (HURT_T / 2))); return out('hurt', (b.hurtHeavy ? 2 : 0) + i); }
  if (G.time - m.turnAt < TURN_T && has('turn')) {
    const i = Math.min(3, Math.floor((G.time - m.turnAt) / TURN_T * 4));
    return m.from > 0 ? out('turn', i, 1) : out('turn', 3 - i, -1);   // right to left: the strip as drawn; left to right: the strip backwards, mirrored
  }
  if (b.rage && has('enraged')) return out('enraged', loop(e, 'enraged'), 0, true);
  if (b.speed > WALK && has('move')) return out('move', loop(e, 'move'), 0, true);
  return out('idle', loop(e, 'idle'), 0, true);
}

// ---------------------------------------------------------------- drawing
const draw = (b, ctx) => {
  const e = entryOf(b);
  if (!e) return false;
  const p = pick(b, e);
  if (!p) return false;
  const k = e.h / strip(e, p.name).fh, o = { x: 0, y: 0, face: 1, h: e.h, foot: 4 };
  ctx.save(); ctx.translate(b.x + (e.ox || 0) * p.face, b.y + (e.oy || 0)); ctx.scale(p.face, 1);
  G.art.drawFrame('boss_' + e.id + '_' + p.name, ctx, p.frame, o);
  if (b.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.7; G.art.drawFrame('boss_' + e.id + '_' + p.name, ctx, p.frame, o); }
  ctx.restore();
  b.skinNote = p.name + ':' + (Math.floor(p.frame) % strip(e, p.name).frames);          // for checks and the debug overlay (a plain string)
  return true;
};
const badge = (b, ctx, sp) => {
  const e = entryOf(b);
  if (e && e.badges === false) return;
  const q = b.spotPos(sp);
  ctx.save(); ctx.translate(q.x, q.y); b.paintSpot(ctx, sp); ctx.restore();
};
// A shot with a kind that the skin's fx strip has: its picture replaces the code-drawn one. fx: { kind: cell | [cells] }; cells play at 12 per second by the shot's age.
const paintShot = (b, kind, ctx, s) => {
  const e = entryOf(b), cells = e && e.fx && e.fx[kind], st = e && strip(e, 'fx');
  if (cells === undefined || !st) return false;
  const cell = Array.isArray(cells) ? cells[Math.floor((s.age || 0) * 12) % cells.length] : cells, k = 0.5;
  const rh = s.rect ? s.rect.h : 0, face = Math.sign(s.vx) || 1;
  const color = s.color || (e.tint && e.tint[kind]) || '#fff3c4', key = e.id + ':' + cell + ':' + color;
  let cv = tintCache[key];
  if (!cv) {
    cv = tintCache[key] = document.createElement('canvas'); cv.width = st.fw; cv.height = st.fh;
    const c = cv.getContext('2d'); c.drawImage(st.img, cell * st.fw, 0, st.fw, st.fh, 0, 0, st.fw, st.fh);
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.45; c.fillStyle = color; c.fillRect(0, 0, st.fw, st.fh);
  }
  ctx.save(); ctx.translate(s.x, s.y - rh / 2); ctx.scale(face, 1);
  ctx.drawImage(cv, -st.fw * k / 2, -st.fh * k / 2, st.fw * k, st.fh * k);
  ctx.restore(); return true;
};

G.bossSkin = { entryOf, pick, split, draw, badge, paintShot, strip, loadEntry, constants: { DEFEAT_T, HURT_T, TURN_T, WALK } };
})();
