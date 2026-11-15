/* Trinkets: passive modifiers kept for the whole run. They only change numbers in G.run.mods, which the engine reads. */
(() => {
'use strict';
const G = window.G;
G.trinketDefs = {};

// Every modifier the engine reads, at its neutral value. A trinket's apply(mods) edits these.
G.baseMods = () => ({
  maxHp: 0,         // extra health pips                               (Player.maxHp)
  dmg: 1,           // slash damage multiplier                         (combat.melee)
  speed: 1,         // run speed multiplier                            (Player.update)
  dashCd: 1,        // dash cooldown multiplier, lower is faster       (Player.update)
  knockback: 1,     // knockback taken when hurt, multiplier           (Player.hurt)
  itemCd: 1,        // token cooldown multiplier, lower is faster      (Player.useItem)
  mendTime: 1,      // time to mend one pip, multiplier                (Player.update)
  magnet: 1,        // scrip pickup range multiplier                   (combat.update)
  shopCost: 1,      // kiosk price multiplier                          (props kiosk wares)
  revealMap: false, // the map shows what every branch room holds      (G.map)
  // Material enablers (rules in js/game/combat.js, section Materials)
  anchor: false,    // Lead Boot: no knockback or hop; heavy Ground shots stop dead against the party or a wall
  conduct: false,   // Brine Flask: metal hits chain to a second enemy; sparks cannot light anything
  magnetic: false,  // Magnet Tooth: metal shots curve towards the nearest enemy or open fare slot
  slick: false,     // Oiled Strap: Ground shots start 45% faster and live 50% longer
  punt: false,      // Punch Glove: a slash launches your own shot; on a brittle one it shatters it
  spark: false      // Whetstone Chip: a slash lights flammable shots and sets off clouds
});

/* G.defineTrinket({ id, name, desc, color, mat, inter, apply(mods), drawIcon(ctx) })   mat: one or two tags, inter: the card line (see G.defineItem) */
G.defineTrinket = def => {
  if (!def.id || typeof def.apply !== 'function') return G.fail('bad trinket definition: ' + (def.id || '?'));
  if (!Array.isArray(def.mat) || def.mat.length < 1 || def.mat.length > 2 || def.mat.some(t => !G.MATERIALS[t]) || typeof def.inter !== 'string' || !def.inter) return G.fail('trinket needs 1 or 2 material tags and an inter line: ' + def.id);
  G.trinketDefs[def.id] = Object.assign({ color: '#e9e2cf', desc: '' }, def);
  if (def.drawIcon) G.art.define('trinket_' + def.id, (ctx, o) => { ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.scale, o.scale); def.drawIcon(ctx); ctx.restore(); });
};
G.trinkets = {
  icon(ctx, id, x, y, scale = 1) {
    if (G.art.draw('trinket_' + id, ctx, { x, y, scale, anchor: 'center', w: 24 * scale, h: 24 * scale })) return;
    const d = G.trinketDefs[id];
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = d ? d.color : '#888'; ctx.fillRect(-6 * scale, -6 * scale, 12 * scale, 12 * scale); ctx.restore();
  },
  // A trinket the party does not have and that is not in exclude, or null.
  roll(rng, exclude = []) {
    const ids = Object.keys(G.trinketDefs).filter(id => !G.run.trinkets.includes(id) && !exclude.includes(id));
    return ids.length ? rng.pick(ids) : null;
  }
};
})();
