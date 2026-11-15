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
   rarity: 'common' | 'rare' | 'fixed'. Fixed tokens never roll at random; a region names one as its fixedItem.
           A rare token joins the random pool once any run has punched a fare slot of its cut (G.meta.cuts).
   use(player): spawn shots with G.combat.shoot or call G.combat.strike, always passing cls, itemId and owner.
   drawIcon(ctx): about 24 px, centred on 0,0. Without one the cut's shape is drawn. */
G.defineItem = def => {
  if (!def.id || !G.CLASSES[def.cls] || typeof def.use !== 'function') return G.fail('bad item definition: ' + (def.id || '?'));
  G.itemDefs[def.id] = Object.assign({ rarity: 'common', cd: 1, color: G.CLASSES[def.cls].color, desc: '' }, def);
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
  // Ids that may turn up at random this run, optionally only of one cut.
  pool(cls) {
    const cuts = G.items.unlockedCuts();
    return Object.values(G.itemDefs).filter(d => d.rarity !== 'fixed' && (d.rarity !== 'rare' || cuts.includes(d.cls)) && (!cls || d.cls === cls)).map(d => d.id);
  },
  // Weighted draw (rares come up a third as often) of a pool token that is not in exclude. Returns an id, or null when the pool has run
  // dry: it never repeats an excluded token (callers then offer a trinket or scrip instead, see G.worldgen).
  cutsOverride: null,
  roll(rng, exclude = []) {
    const ids = G.items.pool().filter(id => !exclude.includes(id));
    const bag = ids.flatMap(id => G.itemDefs[id].rarity === 'rare' ? [id] : [id, id, id]);
    return bag.length ? rng.pick(bag) : null;
  }
};
})();
