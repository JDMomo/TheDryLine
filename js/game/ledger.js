/* The roguelike half: Timetable cards (one rule per run) and the feat ledger (options unlocked between runs).
   Loaded after js/game/bosses.js and before js/game/run.js (run.js reads G.ledger while it loads the save).
   Nothing here is random at play time: a card is rolled from the seed and the unlocked cards, and its rule is a plain set of flags that
   run.js, worldgen.js and combat.js read from G.run.rule (or graph.rule while the world is built). The run code carries what the ledger
   had unlocked (see G.ledger.maskOf), so a code replays on any save.
   Feats unlock OPTIONS, never power: ledger tokens that enter the pool, new Timetable cards, a starting-token choice, an Express mode. */
(() => {
'use strict';
const G = window.G, C = G.C, U = G.util;
const CUTS = ['pierce', 'arc', 'burst', 'ground'], WARDENS = ['r1', 'r2', 'r3', 'r4'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const regionName = id => (G.regionDefs[id] && G.regionDefs[id].name) || id;
const BASE = { SPOT_HP: C.SPOT_HP, BREAK_FRAC: C.BREAK_FRAC };          // restored at the start of every run, then a card may change them
const PAR_RUN = 30 * 60;                                                  // "win under par": a full clear in under 30 minutes
const EXPRESS_HP = 1.15;                                                  // Express mode: every Warden has 15% more health, and the party starts with one pip fewer
const WORDS = ['Ignite', 'Flare', 'Douse', 'Conduct', 'Pull', 'Stop', 'Kick', 'Slide', 'Shatter', 'Crack', 'Punt', 'Anchor'];   // the material interactions

// ---------------------------------------------------------------- Timetable cards
// locked: true = a feat unlocks it (see FEATS); the others are in the deck from the first run. make(rng) returns the card's own numbers
// (a named cut, a named region); flags are what the engine reads. text(rule) is the one clear sentence shown on every screen.
const CARDS = [
  { id: 'rebate_day', name: 'Rebate Day', make: () => ({ refundAll: true }),
    text: () => 'Every token you punch in a Clean fight comes back to you (not only the first).' },
  { id: 'scrip_boom', name: 'Scrip Boom', make: () => ({ scrip: 2, kioskClosed: true }),
    text: () => 'Scrip drops are doubled, and the kiosk is closed.' },
  { id: 'short_shift', name: 'Short Shift', make: () => ({ borrowLess: 1 }),
    text: () => 'The Long Clock borrows one attack fewer: the first on its list is struck off.' },
  { id: 'late_running', name: 'Late Running', make: rng => ({ region: WARDENS[1 + rng.int(WARDENS.length - 1)] }),
    about: 'One of the last three lines (named by the seed; the Wreck Quay stays gentle) is running late: its rooms come hardest first, and none of their enemies are thinned out.',
    text: r => regionName(r.region) + ' is running late: its rooms come hardest first, and none of their enemies are thinned out.' },
  { id: 'dry_pipes', name: 'Dry Pipes', make: () => ({ noPipes: true }),
    text: () => 'No standpipes this run. Beating a Warden mends the whole party instead.' },
  { id: 'packed_lunch', name: 'Packed Lunch', make: () => ({ startToken: true }),
    text: () => 'The party starts with one extra token, drawn from the run code.' },
  { id: 'wide_plates', name: 'Wide Plates', locked: true, make: () => ({ spotHp: 4, breakFrac: 0.15 }),
    text: () => 'Fare slots take 4 token hits to punch, but each punch takes 15% of a Warden\'s health.' },
  { id: 'stopwatch', name: 'Stopwatch', locked: true, make: () => ({ parPips: 1, cleanScrip: 20 }),
    text: () => 'A Par grade gives one more health pip. A Clean grade gives 20 scrip.' },
  { id: 'brittle_stock', name: 'Brittle Stock', locked: true,
    about: 'One cut (named by the seed) is worth double: its punches take 20% of a Warden\'s health, but its tokens crack after two uses.', make: rng => ({ cut: CUTS[rng.int(CUTS.length)], cutLife: 2 }),
    text: r => cap(r.cut) + ' is worth double: its punches take 20% of a Warden\'s health, but its tokens crack after two uses.' },
  { id: 'long_haul', name: 'Long Haul', locked: true, make: () => ({ longer: 1, wardenPips: 2 }),
    text: () => 'Every line has one more main room, and every Warden gives two health pips.' }
];
const LOCKED_CARDS = CARDS.filter(c => c.locked).map(c => c.id);
const LEDGER_TOKENS = ['jet_gimlet', 'amber_sling', 'mica_lantern', 'gypsum_sledge'];

// ---------------------------------------------------------------- feats
// unlock: { kind: 'token' | 'card' | 'option', id, text } or null (a mark of honour only). Order is the order on the ledger screen.
const feat = (id, name, text, unlock) => ({ id, name, text, unlock: unlock || null });
const tokName = id => (G.itemDefs[id] && G.itemDefs[id].name) || id;
const cardName = id => (CARDS.find(c => c.id === id) || {}).name || id;
const FEATS = [
  feat('beat_r1', 'First Toll', 'Beat the Tollkeeper.', { kind: 'card', id: 'wide_plates' }),
  feat('beat_r2', 'Lamp Out', 'Beat the Lamp-Heron.', { kind: 'card', id: 'stopwatch' }),
  feat('beat_r3', 'Idol Down', 'Beat the Switchman Idol.', { kind: 'card', id: 'brittle_stock' }),
  feat('beat_r4', 'Beached', 'Beat the Gatewhale.', { kind: 'card', id: 'long_haul' }),
  feat('clean_r1', 'Clean Toll', 'Beat the Tollkeeper without being hit.', { kind: 'token', id: 'jet_gimlet' }),
  feat('clean_r2', 'Clean Lamp', 'Beat the Lamp-Heron without being hit.', { kind: 'token', id: 'amber_sling' }),
  feat('clean_r3', 'Clean Idol', 'Beat the Switchman Idol without being hit.', { kind: 'token', id: 'mica_lantern' }),
  feat('clean_r4', 'Clean Whale', 'Beat the Gatewhale without being hit.', { kind: 'token', id: 'gypsum_sledge' }),
  feat('win', 'The Clock Stops', 'Beat the Long Clock.', { kind: 'option', id: 'express' }),
  feat('win_nobeat', 'Straight to the Buffers', 'Beat the Long Clock having beaten no Warden.'),
  feat('win_par', 'Under Par', 'Beat the Long Clock in under 30 minutes.'),
  feat('punch_all', 'Full Fare', 'Punch all three fare slots of one Warden.', { kind: 'option', id: 'start' }),
  feat('punch_cuts', 'Every Cut', 'Punch a fare slot with each of the four cuts.'),
  feat('materials', 'Chemistry', 'Trigger each of the twelve material interactions at least once.')
];
const featById = id => FEATS.find(f => f.id === id);
const unlockText = u => !u ? 'A mark of honour. It unlocks nothing.'
  : u.kind === 'token' ? 'Adds the ' + tokName(u.id) + ' to the token pool.'
  : u.kind === 'card' ? 'Adds the Timetable card ' + cardName(u.id) + '.'
  : u.id === 'express' ? 'Unlocks Express mode: Wardens have 15% more health and the party starts with one pip fewer.'
  : 'Unlocks a starting-token choice: begin a run holding the common token of one cut.';

// ---------------------------------------------------------------- the module
const ledger = G.ledger = {
  CARDS, FEATS, LEDGER_TOKENS, LOCKED_CARDS, WORDS, PAR_RUN, EXPRESS_HP, featById, unlockText, cardName,
  // What the done feats unlock: { tokens, cards (the locked ones), start, express }. `feats` is a save's feat map (default: the live one).
  unlocked(feats = G.meta.feats) {
    const out = { tokens: [], cards: [], start: false, express: false };
    for (const f of FEATS) {
      if (!feats || !feats[f.id] || !f.unlock) continue;
      const u = f.unlock;
      if (u.kind === 'token') out.tokens.push(u.id); else if (u.kind === 'card') out.cards.push(u.id); else if (u.id === 'start') out.start = true; else out.express = true;
    }
    out.tokens = LEDGER_TOKENS.filter(t => out.tokens.includes(t)); out.cards = LOCKED_CARDS.filter(c => out.cards.includes(c));
    return out;
  },
  // The options the player has chosen for the next run, kept to what is unlocked: { start: cut | null, express: bool }.
  options(unl = ledger.unlocked()) {
    const o = G.meta.opts || {};
    return { start: unl.start && CUTS.includes(o.start) ? o.start : null, express: !!(unl.express && o.express) };
  },
  setOption(key, value) { G.meta.opts = Object.assign({ start: null, express: false }, G.meta.opts); G.meta.opts[key] = value; G.game.saveMeta(); },
  // The deck a run draws its card from: the base cards and the unlocked locked ones, in CARDS order.
  deck(unlCards) { return CARDS.filter(c => !c.locked || (unlCards || []).includes(c.id)); },
  // The run's card, rolled from the seed alone (its own stream) and the deck: { id, name, text, ...flags }. Same inputs, same card.
  // `force` (tests and tools): a card id to use whatever the seed says, or 'none' for a run with no card (an inert rule).
  force: null,
  rollRule(seed, unlCards) {
    if (ledger.force === 'none') return { id: 'none', name: 'No card', text: 'No rule this run.' };
    if (ledger.force) return ledger.makeRule(ledger.force, seed);
    const rng = U.makeRng((seed ^ 0x2c1b3c6d) >>> 0), deck = ledger.deck(unlCards), card = deck[rng.int(deck.length)];
    return ledger.makeRule(card.id, seed);
  },
  makeRule(id, seed) {
    const card = CARDS.find(c => c.id === id); if (!card) return null;
    const rule = Object.assign({ id, name: card.name }, card.make(U.makeRng((seed ^ 0x1d872b41) >>> 0)));
    rule.text = card.text(rule);
    return rule;
  },
  // ---- the run code's ledger part: bits 0-3 ledger tokens, 4-7 locked cards, bit 8 Express chosen, bits 9-11 starting cut (0 none, else cut index + 1)
  maskOf(unl, opts) {
    let m = 0;
    LEDGER_TOKENS.forEach((id, i) => { if (unl.tokens.includes(id)) m |= 1 << i; });
    LOCKED_CARDS.forEach((id, i) => { if (unl.cards.includes(id)) m |= 1 << (4 + i); });
    if (opts && opts.express) m |= 1 << 8;
    if (opts && opts.start) m |= (CUTS.indexOf(opts.start) + 1) << 9;
    return m;
  },
  fromMask(m) {
    m = m | 0;
    const st = (m >> 9) & 7;
    return { unl: { tokens: LEDGER_TOKENS.filter((id, i) => m & (1 << i)), cards: LOCKED_CARDS.filter((id, i) => m & (1 << (4 + i))), start: false, express: false },
      opts: { express: !!(m & (1 << 8)), start: st >= 1 && st <= 4 ? CUTS[st - 1] : null } };
  },
  // The common token of a cut (the starting-token choice and its icon on the ledger screen).
  commonOf(cut) { return Object.values(G.itemDefs).find(d => d.cls === cut && d.rarity === 'common'); },

  // ---- feats earned during a run (run.featsNew lists the new ones for the end screens)
  earn(id) {
    const f = featById(id), run = G.run;
    if (!f || (G.meta.feats && G.meta.feats[id])) return false;
    G.meta.feats = G.meta.feats || {}; G.meta.feats[id] = { run: G.meta.runs };
    if (run) (run.featsNew || (run.featsNew = [])).push(id);
    try { G.fx.say('Feat: ' + f.name, unlockText(f.unlock), 4); } catch (e) { /* no fx yet */ }
    G.game.saveMeta();
    return true;
  },
  // Game events. kind: 'beaten' { region, grade }, 'punch' { boss }, 'win', 'material' { word }.
  event(kind, d = {}) {
    const run = G.run; if (!run) return;
    if (kind === 'beaten') {
      if (WARDENS.includes(d.region)) { ledger.earn('beat_' + d.region); if (d.grade && d.grade.clean) ledger.earn('clean_' + d.region); }
    } else if (kind === 'punch') {
      const b = d.boss;
      if (b && b.spots.length >= 3 && b.spots.every(s => s.broken)) ledger.earn('punch_all');
      if (CUTS.every(c => G.meta.cuts.includes(c))) ledger.earn('punch_cuts');
    } else if (kind === 'win') {
      ledger.earn('win');
      if (!WARDENS.some(r => run.beaten[r])) ledger.earn('win_nobeat');
      if (run.time <= PAR_RUN) ledger.earn('win_par');
    } else if (kind === 'material') {
      if (!Array.isArray(G.meta.mats)) G.meta.mats = [];
      if (WORDS.includes(d.word) && !G.meta.mats.includes(d.word)) { G.meta.mats.push(d.word); G.game.saveMeta(); }
      if (WORDS.every(w => G.meta.mats.includes(w))) ledger.earn('materials');
    }
  },

  // ---- card effects that live in no other file
  // Called after every token use (js/game/items.js wraps use): Brittle Stock cracks a token of its cut after two uses.
  onUse(p, id) {
    const run = G.run, r = run && run.rule;
    if (!r || !r.cut || G.itemDefs[id].cls !== r.cut) return;
    run.uses[id] = (run.uses[id] || 0) + 1;
    if (run.uses[id] < r.cutLife) return;
    const i = p.items.indexOf(id);
    if (i < 0) return;
    p.items.splice(i, 1); p.sel = Math.max(0, Math.min(p.sel, p.items.length - 1)); run.cracked.push(id);
    G.fx.say(G.itemDefs[id].name + ' cracks', 'Brittle Stock: a ' + r.cut + ' token cracks after two uses.', 2.6);
  },
  // Wardens' health factor: Express mode only (the co-op factor is the boss's own).
  bossScale() { return G.run && G.run.opts && G.run.opts.express ? EXPRESS_HP : 1; },
  // Restore the shared constants a card may change; apply the run's card. Called by G.game.newRun.
  applyRule(rule) {
    C.SPOT_HP = BASE.SPOT_HP; C.BREAK_FRAC = BASE.BREAK_FRAC;
    if (rule && rule.spotHp) { C.SPOT_HP = rule.spotHp; C.BREAK_FRAC = rule.breakFrac; }
  }
};

// The Boss class (js/game/bosses.js) is wrapped once, here, so the cards need no edit in that file:
// start(): Express mode's health factor; hitSpot(): Brittle Stock's double punch for its named cut.
if (G.Boss) {
  const P = G.Boss.prototype, start = P.start, hit = P.hitSpot;
  P.start = function () {
    start.apply(this, arguments);
    const k = ledger.bossScale();
    if (k !== 1) { this.maxHp *= k; this.hp = this.maxHp; this.scale = (this.scale || 1) * k; }
  };
  P.hitSpot = function (sp) {
    const was = sp && sp.broken, r = G.run && G.run.rule;
    hit.apply(this, arguments);
    if (sp && sp.broken && !was && r && r.cut && sp.cls === r.cut) this.hp -= this.maxHp * C.BREAK_FRAC;     // double value: a second share of its health
  };
} else G.fail('ledger.js must load after js/game/bosses.js');
})();
