/* The run (G.run), the party, tokens changing hands, Warden rewards, win and lose, and the save kept between runs (G.meta). */
(() => {
'use strict';
const G = window.G, C = G.C, U = G.util, fx = G.fx;
const SAVE_KEY = 'dryline-meta-v1';
const CUT_ORDER = ['pierce', 'arc', 'burst', 'ground'];
// The attack the Long Clock borrows from each Warden that is still alive when its fight starts.
const BORROWS = {
  r1: { attack: 'toll', warden: 'Tollkeeper', short: 'shockwaves', text: 'a pair of floor shockwaves' },
  r2: { attack: 'beam', warden: 'Lamp-Heron', short: 'lamp beam', text: 'a lamp beam along the floor' },
  r3: { attack: 'sig', warden: 'Switchman Idol', short: 'signal rings', text: 'signal rings at one of three heights' },
  r4: { attack: 'crates', warden: 'Gatewhale', short: 'crates', text: 'dropped crates that stand as pillars' }
};

// Between runs: runs played, wins, best winning time (s), cuts punched at least once (unlocks rare tokens of that cut),
// taught (which first-time prop tips have been shown). Reads and writes never throw: without storage the game plays on in memory.
// bindings: { keyboard: { action: [codes] }, gamepad: { action: [buttons] } }, only what differs from the defaults (see js/core/input.js).
// settings: comfort options { shake: screen shake on, reduceFlashes: fewer and softer flashes }.
G.meta = { runs: 0, wins: 0, best: null, cuts: [], taught: {}, bindings: { keyboard: {}, gamepad: {} }, settings: { shake: true, reduceFlashes: false } };
function loadMeta() {
  const m = G.meta;
  let saved = null;
  try { const raw = localStorage.getItem(SAVE_KEY); saved = raw ? JSON.parse(raw) : null; } catch (e) { saved = null; }   // storage missing or save damaged
  if (saved && typeof saved === 'object') {
    const num = v => typeof v === 'number' && isFinite(v) && v >= 0;
    if (num(saved.runs)) m.runs = saved.runs;
    if (num(saved.wins)) m.wins = saved.wins;
    if (num(saved.best)) m.best = saved.best;
    if (Array.isArray(saved.cuts)) m.cuts = saved.cuts.filter(c => typeof c === 'string' && G.CLASSES[c]);
    if (saved.taught && typeof saved.taught === 'object' && !Array.isArray(saved.taught)) m.taught = Object.assign({}, saved.taught);
    const plain = v => v && typeof v === 'object' && !Array.isArray(v);
    if (plain(saved.bindings)) for (const type of ['keyboard', 'gamepad']) {
      const src = saved.bindings[type], out = {};
      if (plain(src)) for (const a of G.input.REBINDABLE) if (Array.isArray(src[a]) && src[a].length && src[a].every(c => type === 'keyboard' ? typeof c === 'string' : Number.isInteger(c) && c >= 0 && c < 32)) out[a] = src[a].slice(0, 4);
      m.bindings[type] = out;
    }
    if (plain(saved.settings)) { if (typeof saved.settings.shake === 'boolean') m.settings.shake = saved.settings.shake; if (typeof saved.settings.reduceFlashes === 'boolean') m.settings.reduceFlashes = saved.settings.reduceFlashes; }
  }
  G.input.refresh();
  return m;
}
loadMeta();

const game = G.game = {
  loadMeta,
  saveMeta() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.meta)); } catch (e) { /* storage unavailable */ } },

  // The win and lose rules. Replace these functions to change them (each gets the run and returns true when it applies).
  win: run => !!run.beaten.final,
  lose: () => G.players.every(p => p.down),

  // A run code is the whole recipe for a world: the seed (base 36) and the unlocked cuts (one hex digit, a bit per cut in CUT_ORDER),
  // e.g. '1K9Z-5'. The same code gives the same graph, lock chart and token and trinket rewards on any save and by any route.
  codeOf(seed, cuts) { return (seed >>> 0).toString(36).toUpperCase() + '-' + CUT_ORDER.reduce((m, c, i) => m | (cuts.includes(c) ? 1 << i : 0), 0).toString(16).toUpperCase(); },
  parseCode(text) {
    const m = /^\s*#?([0-9A-Z]{1,7})-([0-9A-F])\s*$/i.exec(String(text));
    if (!m) return null;
    const seed = parseInt(m[1], 36) >>> 0, mask = parseInt(m[2], 16);
    return { seed, cuts: CUT_ORDER.filter((c, i) => mask & (1 << i)) };
  },
  // newRun(), newRun(seed) (the unlocked cuts are taken from the save now), newRun(seed, cuts) or newRun('1K9Z-5').
  newRun(seed, cuts) {
    if (typeof seed === 'string') { const c = game.parseCode(seed); if (c) ({ seed, cuts } = c); else { G.fail('bad run code: ' + seed); seed = null; } }
    if (seed === undefined || seed === null) seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    seed = seed >>> 0;
    cuts = CUT_ORDER.filter(c => (cuts || G.meta.cuts).includes(c));       // recorded now: the world never reads the save again
    const run = G.run = { seed, cuts, code: game.codeOf(seed, cuts), rng: U.makeRng((seed ^ 0x9e3779b9) >>> 0), time: 0, shards: 0, abil: {}, trinkets: [], spent: [], beaten: {},
      mods: G.baseMods(), bonusHp: 0, tickets: 0, rooms: {}, over: null, overT: 0, stats: { hits: 0, breaks: 0, kills: 0 }, graph: null,
      punchLog: [], unlocked: [], grades: {} };
    for (const id in G.abilityDefs) run.abil[id] = false;
    run.graph = G.worldgen.build(seed, cuts);
    run.chart = run.graph.chart;
    G.combat.clear(); G.rooms.current = null;                       // nothing of the last run (shots, scrip) comes along
    if (!G.players.length) game.addPlayer(G.input.claimed || 'kb');
    for (const p of G.players) { p.items = []; p.sel = 0; p.hp = p.maxHp; p.glow = 0; p.down = false; }
    game.reslot();
    G.rooms.trans = null;
    G.rooms.enter(run.graph.hub, { start: true });
    G.meta.runs++; game.saveMeta();
    return run;
  },
  // A player joins on a device: 'kb' (the keyboard), 'pad:N' (a gamepad), or null (none: only forced input, for tests). Returns the new player, or null if the party is full.
  addPlayer(dev = null) {
    if (G.players.length >= 4) return null;
    const p = new G.Player(G.players.length, G.input.makeState({ dev }));
    G.players.push(p); game.reslot();
    const lead = G.players[0];
    if (p !== lead && G.rooms.current) { p.hp = p.maxHp; p.place(lead.x, lead.y, lead.face); fx.say('Player ' + (p.index + 1) + ' joined', 'The party carries three tokens in all.', 2.4); }
    return p;
  },
  // A player leaves the party (never the last one). Their tokens go back to the others as far as the slots allow.
  removePlayer(p) {
    const i = G.players.indexOf(p);
    if (i < 0 || G.players.length < 2) return false;
    G.input.release(p.in); G.players.splice(i, 1);
    G.players.forEach((q, k) => { q.index = k; q.color = C.PLAYER_COLORS[k % C.PLAYER_COLORS.length]; });
    game.reslot();
    fx.say('Player ' + (i + 1) + ' left', G.players.length + ' player' + (G.players.length > 1 ? 's' : '') + ' in the party.', 2.4);
    return true;
  },
  // Back to the title: nobody is in the party until a device presses a button there.
  resetParty() { for (const p of G.players) G.input.release(p.in); G.players.length = 0; },
  // Three slots in total (1 player: 3, 2: 2 and 1, 3: 1 each); a fourth player brings a slot of their own (1 each, 4 in all).
  // Tokens are dealt back out in order.
  reslot() {
    const n = G.players.length, each = Math.max(1, Math.floor(C.SLOTS / n)), all = G.players.flatMap(p => p.items);
    G.players.forEach((p, i) => { p.slots = each + (i === 0 ? Math.max(0, C.SLOTS - each * n) : 0); p.items = []; p.sel = 0; });
    for (const id of all) { const p = G.players.find(q => q.items.length < q.slots); if (p) p.items.push(id); }
  },
  // What the Long Clock borrows in this run: one attack for every Warden not yet beaten (shown on the Terminus gate and the map).
  // `short` is the word on the gate label, `text` the longer line, `attack` the state prefix used in boss_final.js.
  borrows(run = G.run) {
    const be = (run && run.beaten) || {};
    return ['r1', 'r2', 'r3', 'r4'].filter(r => !be[r]).map(r => Object.assign({ region: r }, BORROWS[r]));
  },
  partyItems() { return G.players.flatMap(p => p.items); },
  partyClasses() { return new Set(game.partyItems().map(id => G.itemDefs[id].cls)); },
  freeSlots() { return G.players.reduce((s, p) => s + p.slots - p.items.length, 0); },
  // Tokens of a cut (or any cut) that the run can still hand out at random: in the pool, and not held, not void and not already placed or
  // offered by a source of this run (graph.claimed). Empty when the pool has run dry.
  // `stock`: the tokens the clipping booth was given when the run was built (they are in graph.claimed, but are the booth's to hand out).
  spareTokens(cls, stock = []) {
    const gone = new Set([...game.partyItems(), ...G.run.spent]), taken = new Set([...gone, ...G.run.graph.claimed]);
    const mine = stock.filter(id => G.itemDefs[id] && (!cls || G.itemDefs[id].cls === cls) && !gone.has(id));
    return G.items.pool(cls).filter(id => !taken.has(id)).concat(mine.filter(id => !G.items.pool(cls).includes(id) || taken.has(id)));
  },
  // A player picks a token up. If the whole party is full it replaces that player's selected token, which is returned (else null).
  takeItem(p, id) {
    const holder = p.items.length < p.slots ? p : G.players.find(q => q.items.length < q.slots);
    G.tips.fire('token');
    if (holder) { holder.items.push(id); holder.sel = holder.items.length - 1; return null; }
    const old = p.items[p.sel]; p.items[p.sel] = id; return old;
  },
  // A token lands the punching hit on a fare slot and is void. Returns its definition, or null if nobody holds it any more.
  spend(itemId, owner) {
    const holder = owner && owner.items.includes(itemId) ? owner : G.players.find(q => q.items.includes(itemId));
    if (!holder) return null;
    holder.items.splice(holder.items.indexOf(itemId), 1); G.run.spent.push(itemId);
    return G.itemDefs[itemId];
  },
  // A fare slot of this cut was punched (called by the boss right after spend). Logs which token, which slot and where, and
  // unlocks the rare tokens of that cut for every later run. Newly unlocked ones are listed in run.unlocked for the end screens.
  punched(cls) {
    const run = G.run, boss = G.rooms.current && G.rooms.current.boss, spot = boss && boss.spots.find(s => s.cls === cls && s.broken);
    run.stats.breaks++;
    const itemId = run.spent.length > run.punchLog.filter(l => l.item).length ? run.spent[run.spent.length - 1] : null, region = G.rooms.current ? G.rooms.current.region : null;
    run.punchLog.push({ cut: cls, item: itemId, slot: spot ? spot.def.name : '', boss: boss ? boss.def.name : '', region });
    if (!G.meta.cuts.includes(cls)) {
      G.meta.cuts.push(cls);
      for (const d of Object.values(G.itemDefs)) if (d.rarity === 'rare' && d.cls === cls && !run.unlocked.includes(d.id)) run.unlocked.push(d.id);
    }
    game.saveMeta();
  },
  addTrinket(id) {
    const before = G.players.map(p => p.maxHp);
    G.run.trinkets.push(id); G.run.mods = G.baseMods();
    for (const t of G.run.trinkets) G.trinketDefs[t].apply(G.run.mods);
    G.players.forEach((p, i) => { if (!p.down) p.hp = U.clamp(p.hp + Math.max(0, p.maxHp - before[i]), 1, p.maxHp); });
  },
  // Health pips for the rest of the run: +1 per Warden, -1 per clipping. New pips arrive full.
  addMaxPips(n) {
    G.run.bonusHp += n;
    for (const p of G.players) if (!p.down) p.hp = U.clamp(p.hp + Math.max(0, n), 1, p.maxHp);
  },
  // Every boss fight is graded when it ends: Beaten (always), Par (faster than the boss's par time, scaled by the co-op health factor),
  // Clean (no player took a hit during the fight). A Clean fight refunds one token that was punched in it: back into a free party
  // slot, or onto the arena floor as a plinth when the party is full. Returns the grade { time, parTime, par, clean, refund, where }.
  gradeFight(boss, room) {
    const run = G.run, parTime = (boss.def.par || 0) * (boss.scale || 1);
    const g = { time: boss.clock, parTime, par: parTime > 0 && boss.clock < parTime, clean: run.stats.hits === boss.hits0, refund: null, where: null };
    if (g.clean) {
      const id = run.spent.slice(boss.spent0)[0];
      if (id) {
        run.spent.splice(run.spent.indexOf(id), 1); g.refund = id;
        if (game.freeSlots() > 0) { game.takeItem(G.players.find(p => !p.down) || G.players[0], id); g.where = 'party'; }
        else {
          const mid = (room.def.floorX[0] + room.def.floorX[1]) / 2;
          room.props.push(G.props.make('plinth', mid + 116, boss.floor, { item: id, refund: true })); g.where = 'floor';
        }
      }
    }
    run.grades[boss.region] = g;
    fx.stamp(game.gradeText(g).toUpperCase().split(' · '), g.refund ? G.itemDefs[g.refund].name + (g.where === 'party' ? ' comes back to the party' : ' is on the floor') : '');
    G.tips.fire('grade');
    return g;
  },
  gradeText(g) { return g ? ['Beaten'].concat(g.par ? ['Par'] : [], g.clean ? ['Clean'] : []).join(' · ') : ''; },
  // A Warden falls: one more health pip, 40 scrip, and a choice of one trinket from three.
  bossBeaten(boss) {
    const room = G.rooms.current, run = G.run;
    run.beaten[boss.region] = true;
    G.rooms.endFight(room);
    game.gradeFight(boss, room);
    game.addMaxPips(1);
    run.shards += C.WARDEN_SCRIP;
    fx.floatText(boss.x, boss.y - boss.h - 20, '+' + C.WARDEN_SCRIP + ' scrip', '#fff3c4');
    const mid = (room.def.floorX[0] + room.def.floorX[1]) / 2, picks = [];
    // The choice comes from its own stream (seed + region), so a seed offers the same three whatever else happened in the run.
    const loot = U.makeRng((run.seed ^ 0x5bd1e995 ^ [...boss.region].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) >>> 0);
    for (let i = 0; i < 3; i++) { const t = G.trinkets.roll(loot, picks); if (t) picks.push(t); }
    picks.forEach((t, i) => room.props.push(G.props.make('plinth', mid + (i - 1) * 58, boss.floor, { trinket: t, group: 'reward' })));
    if (G.story) G.story.wardenFell(boss.region);
  },
  // Token slots (cut and name) the party holds, for the map and screens.
  heldTokens() { return game.partyItems().map(id => ({ id, name: G.itemDefs[id].name, cls: G.itemDefs[id].cls, color: G.CLASSES[G.itemDefs[id].cls].color, shape: G.CLASSES[G.itemDefs[id].cls].shape })); },
  // Called every step while playing.
  checkEnd() {
    const run = G.run;
    if (run.over) return;
    const result = game.win(run) ? 'win' : game.lose(run) ? 'dead' : null;
    if (!result) return;
    run.over = result;
    if (result === 'win') { G.meta.wins++; if (G.meta.best === null || run.time < G.meta.best) G.meta.best = run.time; game.saveMeta(); }
  }
};

// Props that worldgen placed on top of a template (node.extras) join the room the first time it is entered.
const enterRoom = G.rooms.enter;
G.rooms.enter = function (nodeId, entry) {
  const fresh = !G.run.rooms[nodeId];
  enterRoom.call(this, nodeId, entry);
  const room = G.rooms.current, node = room && room.node;
  if (fresh && node && node.extras) for (const e of node.extras) room.props.push(G.props.make(e.type, e.x, e.y, Object.assign({}, e.data)));
};
})();
