/* Tokens: what the party carries and punches into a boss's fare slots. Code calls them items.
   Each token has one cut (class id); a boss has at most one fare slot per cut. */
(() => {
'use strict';
const G = window.G;

// The four cuts. Colour and shape are fixed by the bible (colour-blind safe; the shape is always shown).
G.CLASSES = {
  pierce: { name: 'Pierce', color: '#56B4E9', shape: 'triangle', hint: 'flies straight' },
  arc:    { name: 'Arc',    color: '#F0E442', shape: 'crescent', hint: 'lobbed, lands from above' },
  burst:  { name: 'Burst',  color: '#D55E00', shape: 'star',     hint: 'pulses around you' },
  ground: { name: 'Ground', color: '#CC79A7', shape: 'slab',     hint: 'slides along the floor' }
};
G.itemDefs = {};

/* G.defineItem({ id, name, cls, rarity, color, cd, desc, use(player), drawIcon(ctx) })
   rarity: 'common' | 'rare' | 'fixed' | 'ledger'. Common and fixed (signature) tokens are in the pool from the first run.
           A rare token joins the pool once any run has punched a fare slot of its cut (G.meta.cuts).
           A ledger token joins the pool when the feat that unlocks it is done (G.ledger.unlocked().tokens, js/game/ledger.js).
   Every run then draws about 7 of the pool for its sources (G.worldgen.drawTokens); the rest do not exist in that run.
   use(player): spawn shots with G.combat.shoot or call G.combat.strike, always passing cls, itemId and owner.
   drawIcon(ctx): about 24 px, centred on 0,0. Without one the cut's shape is drawn.
   mat: one or two material tags (G.MATERIALS in js/game/combat.js); inter: one card line naming the interactions the tags give it. Both are
   required and shown on every card (plinth, kiosk, map, HUD). Materials never change which fare slot a token opens: that stays its cut. */
G.defineItem = def => {
  if (!def.id || !G.CLASSES[def.cls] || typeof def.use !== 'function') return G.fail('bad item definition: ' + (def.id || '?'));
  if (!Array.isArray(def.mat) || def.mat.length < 1 || def.mat.length > 2 || def.mat.some(t => !G.MATERIALS[t]) || typeof def.inter !== 'string' || !def.inter) return G.fail('item needs 1 or 2 material tags and an inter line: ' + def.id);
  G.itemDefs[def.id] = Object.assign({ rarity: 'common', cd: 1, color: G.CLASSES[def.cls].color, desc: '' }, def);
  // Every use goes through here once, so a Timetable card can count uses (G.ledger.onUse: Brittle Stock cracks a token after two).
  const use = def.use, id = def.id;
  G.itemDefs[id].use = function (p) { const r = use.apply(this, arguments); if (G.ledger && G.ledger.onUse) G.ledger.onUse(p, id); return r; };
  if (def.drawIcon) G.art.define('item_' + def.id, (ctx, o) => { ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.scale, o.scale); def.drawIcon(ctx); ctx.restore(); });
};

G.items = {
  icon(ctx, id, x, y, scale = 1) {
    if (G.art.draw('item_' + id, ctx, { x, y, scale, anchor: 'center', w: 24 * scale, h: 24 * scale })) return;
    const d = G.itemDefs[id];
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = d ? d.color : '#888'; G.art.cutShape(ctx, d ? G.CLASSES[d.cls].shape : 'slab', 9 * scale); ctx.restore();
  },
  // The cuts whose rare tokens are unlocked for the world being built or played: G.items.cutsOverride (set while worldgen builds), else the
  // set the run recorded when it started (G.run.cuts), else the save file. A run never reads the save after it has started.
  unlockedCuts() { return G.items.cutsOverride || (G.run && G.run.cuts) || G.meta.cuts; },
  // The ledger tokens in the pool, the same way: ledgerOverride (worldgen), else the run's record (G.run.unl.tokens), else the feats of the save.
  unlockedLedger() { return G.items.ledgerOverride || (G.run && G.run.unl && G.run.unl.tokens) || (G.ledger ? G.ledger.unlocked().tokens : []); },
  // Ids that may enter a run (before the run draws about 7 of them), optionally only of one cut.
  pool(cls) {
    const cuts = G.items.unlockedCuts(), led = G.items.unlockedLedger();
    return Object.values(G.itemDefs).filter(d => (d.rarity !== 'rare' || cuts.includes(d.cls)) && (d.rarity !== 'ledger' || led.includes(d.id)) && (!cls || d.cls === cls)).map(d => d.id);
  },
  // Weighted draw (rares come up a third as often) of a pool token that is not in exclude. Returns an id, or null when the pool has run
  // dry: it never repeats an excluded token (callers then offer a trinket or scrip instead, see G.worldgen).
  cutsOverride: null, ledgerOverride: null,
  // Rares and ledger tokens come up a third as often as commons and signature tokens.
  weight(id) { const r = G.itemDefs[id].rarity; return r === 'rare' || r === 'ledger' ? 1 : 3; },
  roll(rng, exclude = []) {
    const ids = G.items.pool().filter(id => !exclude.includes(id));
    const bag = ids.flatMap(id => G.items.weight(id) === 1 ? [id] : [id, id, id]);
    return bag.length ? rng.pick(bag) : null;
  }
};
})();
