/* Regions and the per-run room graph. Everything here is drawn from one seeded generator, so a seed reproduces a run. */
(() => {
'use strict';
const G = window.G, U = G.util;
G.regionDefs = {};

/* G.defineRegion({ id, name, blurb, gate, boss, ability, fixedItem, enemies, flyers, ceiling, length, pool, palette })
   gate       position of this region's gate in the hub, left to right (0, 1, 2 ...)
   boss       boss id fought in this region's arena
   ability    ability id granted by this region's signal post (same every run)
   fixedItem  token id that always sits on the plinth of this region's own branch room (same every run); if it is not
              defined yet, that plinth rolls a random token
   enemies    enemy ids spawned at E markers; flyers: ids spawned at F markers; ceiling: ids spawned at L markers (fallback: any enemy
              of the right kind; a ceiling enemy is one defined with ceiling: true)
   length     number of main rooms before the arena (default 3)
   pool       region id whose room templates this region uses (default: its own id)
   palette    colour overrides, see G.art.palette */
G.defineRegion = def => {
  if (!def.id || def.gate === undefined || !def.boss) return G.fail('bad region definition: ' + (def.id || '?'));
  G.regionDefs[def.id] = Object.assign({ name: def.id, length: 3, enemies: [], flyers: [], ceiling: [], pool: def.id }, def);
};

const defsOf = (kind, region) => Object.values(G.roomDefs).filter(d => d.kind === kind && d.region === region);
// Draw n templates without repeats until the pool runs out, then start over.
function draw(rng, pool, n) {
  const out = []; let bag = [];
  while (out.length < n && pool.length) { if (!bag.length) bag = rng.shuffle(pool); out.push(bag.pop()); }
  return out;
}

// What the hub's three signs say (the first teaching a new player: what tokens are, void, open gates).
const HUB_SIGNS = ['A token has a cut: pierce, arc, burst or ground. The party carries three.',
  'Tokens come from four guarded plinths, two lost trunks and one ticket machine. The kiosk sells trinkets.',
  'Each Warden has three fare slots, shown on the lock chart board. Punch one with a token of its cut; the token is void.',
  'Every gate is open. The Long Clock borrows an attack from each Warden still alive: the Terminus gate lists them. Beat the Wardens first, or go straight there and take the hardest road.'];
const CUTS = ['pierce', 'arc', 'burst', 'ground'];

// Roll what every marker of a node holds. content[i] belongs to roomDef.marks[i]; doors and gates are set before this runs.
// Sources the bible limits (trunks, machines, kiosk, booth, standpipes, loose plinths) are rolled here and then trimmed to the
// exact counts by balance(). ctx.own: node ids that are a region's own branch room (the guarded fixed plinth).
function fillContent(node, region, rng, used, ctx) {
  const def = G.roomDefs[node.def], signs = def.kind === 'hub' ? HUB_SIGNS : (def.signs || []);
  let signN = 0, plinthN = 0;
  const token = () => { const id = G.items.roll(rng, used); if (id) used.push(id); return id; };
  // Enemies: one shuffled bag per marker kind per room, so a room with several ground markers never rolls the same enemy at all of
  // them when the region has more than one (the bag is dealt in turn). The run's seeded rng decides the order.
  const poolFor = kind => {   // kind: 'ground' (E), 'fly' (F) or 'ceiling' (L)
    const want = ((kind === 'fly' ? region.flyers : kind === 'ceiling' ? region.ceiling : region.enemies) || []).filter(id => G.enemyDefs[id]);
    return want.length ? want : Object.values(G.enemyDefs).filter(d => kind === 'ceiling' ? d.ceiling : kind === 'fly' ? d.flying : !d.flying && !d.ceiling).map(d => d.id);
  };
  const bags = {};
  const enemy = kind => {
    const pool = poolFor(kind);
    if (!pool.length) return null;
    if (!bags[kind] || !bags[kind].length) bags[kind] = rng.shuffle(pool.slice());
    return { type: 'enemy', id: bags[kind].pop() };
  };
  def.marks.forEach((m, i) => {
    if (node.content[i] !== undefined) return;
    let c = null;
    if (m.ch === 'E' || m.ch === 'F' || m.ch === 'L') c = enemy(m.ch === 'F' ? 'fly' : m.ch === 'L' ? 'ceiling' : 'ground');
    else if (m.ch === 'B') c = { type: 'boss', id: region.boss };
    else if (m.ch === 'P') c = { type: 'start' };
    else if (m.ch === 'H') c = { type: 'standpipe', data: {} };
    // K (clipping booth) markers are left empty: the booth is no longer part of a run (its prop code stays in props.js, unused).
    else if (m.ch === 'M') c = region.ability ? { type: 'post', data: { abil: region.ability } } : null;
    else if (m.ch === '?') c = { type: 'sign', data: { text: signs[signN++] || '' } };
    else if (m.ch === 'X') c = { type: 'crack', data: {} };
    else if (m.ch === 'C') c = { type: 'trunk', data: {} };                 // what they hold is drawn by balance() once the counts are trimmed
    else if (m.ch === 'I') {
      // Only the region's own branch room holds a plinth (its first one): the region's fixed token, guarded. Others are trimmed.
      if (ctx.own.has(node.id) && !plinthN++) c = { type: 'plinth', data: Object.assign(fixedOrRandom(region, rng, used), { locked: true }) };
    } else if (m.ch === 'R') {
      c = { type: 'ticket', data: { choices: [] } };
    } else if (m.ch === 'S') c = { type: 'plinth', data: { ware: true } };
    node.content[i] = c;
  });
  if (def.kind === 'hub') node.signsPlaced = signN;
  // A region's first main room is an introduction (region.intro): at most maxEnemies enemies, and nothing from `avoid` (the turnstile and
  // the brine spout) within `calm` tiles of the entrance, where the party arrives (column 1). Those become crabs; extras are dropped
  // (the ones nearest the entrance first).
  if (region.intro && ctx.first === node.id) {
    const it = region.intro, idx = () => def.marks.map((m, i) => i).filter(i => node.content[i] && node.content[i].type === 'enemy');
    for (const i of idx()) if (def.marks[i].c - 1 <= it.calm && it.avoid.includes(node.content[i].id)) node.content[i] = { type: 'enemy', id: G.enemyDefs.ballast_crab ? 'ballast_crab' : null };
    while (idx().length > it.maxEnemies) { const list = idx().sort((a, b) => def.marks[a].c - def.marks[b].c); node.content[list[0]] = null; }
  }
  // Thin out a main room that holds more enemies than its region allows (drop the most repeated kinds first).
  const cap = ENEMY_CAP[region.id];
  if (cap && def.kind === 'main') {
    const idx = () => def.marks.map((m, i) => i).filter(i => node.content[i] && node.content[i].type === 'enemy');
    for (let n = idx().length; n > cap[1]; n--) {
      const list = idx(), count = {}; list.forEach(i => { const id = node.content[i].id; count[id] = (count[id] || 0) + 1; });
      const top = Math.max(...Object.values(count));
      node.content[rng.pick(list.filter(i => count[node.content[i].id] === top))] = null;
    }
  }
}
// Enemies per main room: [min, max] by region (the templates carry the minimum; fillContent trims to the maximum).
const ENEMY_CAP = { r1: [2, 3], r2: [3, 4], r3: [3, 4], r4: [3, 5], final: [4, 5] };
// What a guarded plinth holds: the region's fixed token, or (a region without one) whatever the run still has to offer.
const fixedOrRandom = (region, rng, used) => region.fixedItem && G.itemDefs[region.fixedItem] ? { item: region.fixedItem } : lootData(rng, used);
/* Token uniqueness. `used` holds every token (and trinket) id already placed or offered anywhere in this run, the guarded plinths' fixed
   tokens first; nothing draws an id in it, so a token turns up once per run. When the pool of tokens has run dry a source offers a
   trinket, or failing that scrip, instead. Everything draws from the run's seeded rng, so a seed gives the same world. */
const FILLER_SCRIP = 40;
const trinketFor = (rng, used) => { const t = G.trinkets.roll(rng, used); if (t) used.push(t); return t; };
// What a trunk or a ticket choice holds: { item } | { trinket } | { scrip }
function lootData(rng, used) {
  const id = G.items.roll(rng, used);
  if (id) { used.push(id); return { item: id }; }
  const t = trinketFor(rng, used);
  return t ? { trinket: t } : { scrip: FILLER_SCRIP };
}
// One kiosk ware: a trinket for 40 scrip (the price is adjusted by mods.shopCost when it is shown). The kiosk sells no tokens.
function ware(rng, used) {
  const t = trinketFor(rng, used);
  return t ? { type: 'plinth', data: { trinket: t, price: 40 } } : null;
}
/* The lock chart: for every region's Warden, the three cuts that have a fare slot this run (the fourth is locked out). Rolled from the
   seed alone. The first four regions lock a different cut each (so every cut is locked on at least one Warden and no two Wardens
   share a chart); the rest lock a random cut. Returns { regionId: [cut, cut, cut] }, cuts in CUTS order. */
function rollChart(seed, regions) {
  const rng = U.makeRng((seed ^ 0x4c0c4a27) >>> 0), perm = rng.shuffle(CUTS.slice()), chart = {};
  regions.forEach((r, i) => { const locked = i < CUTS.length ? perm[i] : rng.pick(CUTS); chart[r.id] = CUTS.filter(c => c !== locked); });
  return chart;
}

// ---- Placing extra props the templates did not provide (so every run has exactly the sources the bible lists) ----
// node.extras = [{ type, data, c, r, x, y }]; run.js turns them into props when the room is first entered.
const T = G.C.T;
function spotsFor(node, half, gap) {
  const def = G.roomDefs[node.def], g = def.grid, rows = def.rows, cols = def.cols, out = [], ex = node.extras || [];
  const margin = def.kind === 'hub' ? 1 : 4;
  const crowded = (c, r) => def.marks.some(m => Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= gap) || ex.some(e => Math.abs(e.r - r) <= 1 && Math.abs(e.c - c) <= gap);
  for (let r = 4; r < rows - 1; r++) for (let c = margin; c < cols - margin; c++) {
    let ok = true;
    for (let x = c - half; x <= c + half && ok; x++) ok = x >= 0 && x < cols && g[r][x] === '.' && g[r + 1][x] === '#' && g[r - 1][x] === '.' && g[r - 2][x] === '.' && g[r - 3][x] === '.';
    if (ok && !crowded(c, r)) out.push({ c, r, ground: r >= rows - 3 });
  }
  return out;
}
function addExtra(node, type, data, half, gap, rng, near) {
  let list = spotsFor(node, half, gap);
  const ground = list.filter(s => s.ground);
  if (ground.length) list = ground;
  if (!list.length) return false;
  const s = near !== undefined ? list.slice().sort((a, b) => Math.abs(a.c - near) - Math.abs(b.c - near))[0] : rng.pick(list);
  (node.extras || (node.extras = [])).push({ type, data, c: s.c, r: s.r, x: s.c * T + T / 2, y: (s.r + 1) * T });
  return true;
}

// Trim and top up the whole graph to the bible's section 8 counts. Returns warnings.
function balance(graph, rng, used, ctx) {
  const nodes = Object.values(graph.nodes), kind = n => G.roomDefs[n.def].kind, warn = [];
  const token = () => { const id = G.items.roll(rng, used); if (id) used.push(id); return id; };
  const entries = (ch, type) => nodes.flatMap(n => G.roomDefs[n.def].marks.flatMap((m, i) => m.ch === ch && n.content[i] && (!type || n.content[i].type === type) ? [{ n, i }] : []));
  // A source trimmed away gives back what it had drawn, so scarce tokens are not lost to rooms that never get built.
  const release = c => {
    const d = (c && c.data) || {}, ids = [d.item, d.trinket, ...(d.choices || []).flatMap(o => [o.item, o.trinket])].filter(Boolean);
    for (const id of ids) { const k = used.indexOf(id); if (k >= 0 && !(G.itemDefs[id] && G.itemDefs[id].rarity === 'fixed')) used.splice(k, 1); }
  };
  const strip = e => { release(e.n.content[e.i]); e.n.content[e.i] = null; };
  const keep = (list, count) => { const s = rng.shuffle(list); s.slice(count).forEach(strip); return s.slice(0, count); };
  const mains = () => { const m = rng.shuffle(nodes.filter(n => kind(n) === 'main')); return m.sort((a, b) => (a.extras || []).length - (b.extras || []).length); };
  const place = (type, mk, half, gap, count) => { let left = count; for (const n of mains()) { if (!left) break; if (addExtra(n, type, mk(), half, gap, rng)) left--; } if (left) warn.push('no room to place ' + left + ' ' + type); };

  // lost trunks: exactly 2, in main rooms
  entries('C', 'trunk').filter(e => kind(e.n) !== 'main').forEach(strip);
  const trunks = keep(entries('C', 'trunk'), 2);
  place('trunk', () => ({}), 1, 3, 2 - trunks.length);
  // ticket machine: exactly 1 (it can be used twice: 30 scrip, then 45)
  const machines = keep(entries('R', 'ticket'), 1);
  place('ticket', () => ({ choices: [] }), 2, 4, 1 - machines.length);
  // kiosk: exactly 1 room with exactly 3 wares
  const wares = entries('S', 'plinth'), rooms = [...new Set(wares.map(e => e.n))];
  if (rooms.length) {
    const kioskNode = rng.pick(rooms);
    wares.filter(e => e.n !== kioskNode).forEach(strip);
    const mine = wares.filter(e => e.n === kioskNode);
    mine.slice(3).forEach(strip);
    for (let k = mine.length; k < 3; k++) if (!addExtra(kioskNode, 'plinth', { ware: true }, 1, 2, rng)) warn.push('kiosk ware missing');
  } else {
    const home = mains().find(n => spotsFor(n, 1, 2).length >= 6);
    for (let k = 0; k < 3; k++) if (!home || !addExtra(home, 'plinth', { ware: true }, 1, 2, rng)) { warn.push('kiosk ware missing'); break; }
  }
  // standpipes: exactly 2, in the hub and in the last main room before the final arena
  const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), last = order.length && graph.regions[order[order.length - 1].id];
  const lastMain = last && graph.nodes[last.arena].exits.left && graph.nodes[last.arena].exits.left.to;
  const wanted = [graph.hub, last && last.pipe ? last.pipe : lastMain];
  entries('H', 'standpipe').filter(e => !wanted.includes(e.n.id)).forEach(strip);
  for (const id of wanted) {
    if (!id) continue;
    const n = graph.nodes[id];
    if (!entries('H', 'standpipe').some(e => e.n === n) && !addExtra(n, 'standpipe', {}, 1, 3, rng)) warn.push('no room for a standpipe in ' + id);
  }
  // each region's guarded fixed plinth (its own branch room)
  for (const id of ctx.own) {
    const n = graph.nodes[id];
    if (!entries('I', 'plinth').some(e => e.n === n) && !addExtra(n, 'plinth', Object.assign(fixedOrRandom(G.regionDefs[n.region], rng, used), { locked: true }), 1, 3, rng)) warn.push('no room for the plinth in ' + id);
  }
  // What the sources hold is drawn only now that the counts are final, so tokens are not wasted on sources that were trimmed away.
  // Order: the trunks, the ticket machine's first three, the kiosk (trinkets), then the machine's second three.
  const all = type => nodes.flatMap(n => G.worldgen.contents(n).filter(c => c.type === type));
  for (const c of all('trunk')) Object.assign(c.data, lootData(rng, used));
  const machinesNow = all('ticket');
  for (let k = 0; k < 3; k++) for (const c of machinesNow) c.data.choices.push(lootData(rng, used));
  for (const c of all('plinth').filter(c => c.data.ware)) {
    const w = ware(rng, used);
    if (w) { delete c.data.ware; Object.assign(c.data, w.data); } else warn.push('kiosk ware empty');
  }
  for (const c of machinesNow) { c.data.next = []; for (let k = 0; k < 3; k++) c.data.next.push(lootData(rng, used)); }
  // the hub's three signs
  const hub = graph.nodes[graph.hub], hubDef = G.roomDefs[hub.def], pc = (hubDef.marks.find(m => m.ch === 'P') || { c: 14 }).c;
  for (let k = hub.signsPlaced || 0; k < HUB_SIGNS.length; k++) if (!addExtra(hub, 'sign', { text: HUB_SIGNS[k] }, 0, 1, rng, pc)) warn.push('no room for hub sign ' + (k + 1));
  // the lock chart board stands behind the party's start, between the gates
  (hub.extras || (hub.extras = [])).push({ type: 'board', data: {}, c: 17, r: 7, x: 17 * T + T / 2, y: 7 * T + 16 });
  return warn;
}

// Every node a node leads to: side exits, doorways and hub gates.
function links(graph, node) {
  const out = [];
  if (node.exits.left) out.push(node.exits.left.to);
  if (node.exits.right) out.push(node.exits.right.to);
  for (const c of node.content) {
    if (c && c.type === 'door') out.push(c.data.to);
    if (c && c.type === 'gate') out.push(graph.regions[c.data.region].first);
  }
  return out;
}
function reach(graph, from) {
  const seen = new Set([from]), todo = [from];
  while (todo.length) for (const id of links(graph, graph.nodes[todo.pop()])) if (graph.nodes[id] && !seen.has(id)) { seen.add(id); todo.push(id); }
  return seen;
}

G.worldgen = {
  /* Returns { seed, hub, nodes: { id: node }, regions: { regionId: { first, arena, nodes: [ids] } }, warnings: [texts] }.
     node = { id, def (room template id), region, exits: { left, right }, content: [per marker], seen, parent (branch rooms) }
     exits.left / exits.right = { to: nodeId, entry }. Per region: `length` main rooms left to right, then the arena; the
     main rooms' doorways lead to the trial room, the region's own branch room (its guarded plinth) and shared branch rooms. */
  build(seed, cuts) {
    // The world is built from the seed and the unlocked cuts only (cuts: the cuts whose rare tokens are in the pool; default: the save's).
    G.items.cutsOverride = cuts || G.meta.cuts;
    try { return G.worldgen.build0(seed); } finally { G.items.cutsOverride = null; }
  },
  rollChart(seed) { return rollChart(seed, Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate)); },
  build0(seed) {
    const rng = U.makeRng(seed), nodes = {}, regions = {}, warnings = [], ctx = { own: new Set() };
    const used = Object.values(G.regionDefs).map(r => r.fixedItem).filter(id => id && G.itemDefs[id]);   // fixed tokens are placed first: nothing else draws them
    // Still needed across the whole run (bible section 8): used to prefer shared branch rooms that hold a source we lack.
    const need = { R: 1, S: 1 };
    const srcs = d => { const o = {}; for (const m of d.marks) if (need[m.ch] !== undefined) o[m.ch] = 1; return o; };
    const take = d => { for (const k in srcs(d)) need[k]--; };
    const tier = d => { const s = Object.keys(srcs(d)); return s.some(k => need[k] <= 0) ? 2 : s.length ? 0 : 1; };
    const pickShared = (pool, count) => {
      const out = [];
      for (let k = 0; k < count && pool.length; k++) {
        const lo = Math.min(...pool.map(tier)); let c = pool.filter(d => tier(d) === lo && !out.includes(d));
        if (!c.length) c = pool.filter(d => tier(d) === lo);
        const d = rng.pick(c); out.push(d); take(d);
      }
      return out;
    };
    let n = 0;
    const add = (def, region) => { const node = { id: 'n' + (n++), def: def.id, region, exits: {}, content: [], seen: false }; nodes[node.id] = node; return node; };
    const hubDef = Object.values(G.roomDefs).find(d => d.kind === 'hub');
    if (!hubDef) { G.fail('no hub room defined'); return null; }
    const hub = add(hubDef, 'hub');
    const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate);
    const gateMarks = hubDef.marks.map((m, i) => m.ch === 'G' ? i : -1).filter(i => i >= 0);
    if (gateMarks.length < order.length) G.fail('the hub has ' + gateMarks.length + ' gates for ' + order.length + ' regions');

    order.slice(0, gateMarks.length).forEach((region, ri) => {
      const mains = defsOf('main', region.pool), arenas = defsOf('arena', region.pool);
      if (!mains.length || !arenas.length) { G.fail('region ' + region.id + ' has no main rooms or no arena'); return; }
      // A shared branch room with a standpipe (H) is never drawn as an ordinary side room: it is the last region's pre-arena stop.
      const hasH = d => d.marks.some(m => m.ch === 'H'), isLast = ri === Math.min(order.length, gateMarks.length) - 1;
      const trials = region.ability ? defsOf('trial', region.pool).concat(defsOf('trial', 'shared')) : [], own = defsOf('branch', region.pool), shared = defsOf('branch', 'shared').filter(d => !hasH(d));
      const pipes = isLast ? defsOf('branch', 'shared').filter(hasH) : [], pipeDef = pipes.length ? rng.pick(pipes) : null;
      const want = [trials, own, shared].filter(p => p.length).length + (pipeDef ? 1 : 0);
      let chosen = draw(rng, mains, region.length);
      for (let tries = 0; tries < 30 && chosen.reduce((s, d) => s + d.doors, 0) < want; tries++) chosen = draw(rng, mains, region.length);

      chosen.forEach(take);
      const chain = chosen.map(d => add(d, region.id)), arena = add(rng.pick(arenas), region.id);
      chain.forEach((node, i) => {
        node.exits.left = i ? { to: chain[i - 1].id, entry: { side: 'right' } } : { to: hub.id, entry: { gate: region.id } };
        node.exits.right = { to: (chain[i + 1] || arena).id, entry: { side: 'left' } };
      });
      arena.exits.left = { to: chain[chain.length - 1].id, entry: { side: 'right' } };
      const g = regions[region.id] = { first: chain[0].id, arena: arena.id, nodes: chain.map(c => c.id).concat(arena.id) };
      hub.content[gateMarks[ri]] = { type: 'gate', data: { region: region.id } };

      // Doorways: the trial first, then the region's own branch room, then shared branch rooms (own rooms again if none).
      const slots = rng.shuffle(chain.flatMap(node => G.roomDefs[node.def].marks.map((m, i) => m.ch === 'D' ? { node, i } : null).filter(Boolean)));
      const required = [trials, own].filter(p => p.length).map(p => ({ def: rng.pick(p), own: p === own }));
      // The standpipe stop goes on a doorway of the last main room when it has one (the Terminus: a standpipe before the arena).
      if (pipeDef) { const at = slots.findIndex(sl => sl.node === chain[chain.length - 1]); required.unshift({ def: pipeDef, pipe: true }); if (at > 0) slots.unshift(slots.splice(at, 1)[0]); }
      if (slots.length < required.length) warnings.push('region ' + region.id + ' has too few doorways for its trial and branch rooms');
      required.forEach(r => take(r.def));
      const extras = shared.length ? pickShared(shared, Math.max(0, slots.length - required.length)) : draw(rng, own, Math.max(0, slots.length - required.length));
      slots.forEach((slot, k) => {
        const def = k < required.length ? required[k].def : extras[k - required.length];
        if (!def) { slot.node.content[slot.i] = null; return; }
        const b = add(def, region.id), back = def.marks.findIndex(m => m.ch === 'D');
        g.nodes.push(b.id); b.parent = slot.node.id;
        if (k < required.length && required[k].own) { ctx.own.add(b.id); g.own = b.id; }
        if (k < required.length && required[k].pipe) g.pipe = b.id;
        slot.node.content[slot.i] = { type: 'door', data: { to: b.id, entry: { mark: back }, tag: def.kind === 'trial' ? 'Trial' : G.worldgen.needsText(def.id) ? 'Needs ' + G.worldgen.needsText(def.id) : '', label: def.label || 'Side room', needs: (def.needs || []).slice() } };
        b.content[back] = { type: 'door', data: { to: slot.node.id, entry: { mark: slot.i }, label: 'Way back' } };
      });
      ctx.first = g.first;
      for (const id of g.nodes) fillContent(nodes[id], region, rng, used, ctx);
    });
    ctx.first = null;
    fillContent(hub, {}, rng, used, ctx);
    const graph = { seed, hub: hub.id, nodes, regions, warnings, claimed: used, chart: G.worldgen.rollChart(seed) };
    warnings.push(...balance(graph, rng, used, ctx));
    return graph;
  },
  /* Everything a node holds as plain { type, data } entries: the template's markers plus the extras placed by balance(). */
  // The movement unlocks a room declares in `needs` (a guarded branch room), as words: 'Dash', or '' for a room that needs nothing.
  needsText(defId) { const d = G.roomDefs[defId]; return d && d.needs && d.needs.length ? d.needs.map(a => (G.abilityDefs[a] || { name: a }).name).join(' and ') : ''; },
  contents(node) {
    return node.content.filter(c => c && c.type !== 'enemy' && c.type !== 'boss' && c.type !== 'start').concat((node.extras || []).map(e => ({ type: e.type, data: e.data })));
  },
  /* Counts of the token sources of one run (bible section 8), read from the graph:
     { fixed: { regionId: { node, item, locked } }, trunks, trunksInMain, tickets, kioskRooms, kioskWares, booths, standpipes: [nodeIds], loosePlinths, signs } */
  census(graph) {
    const out = { fixed: {}, trunks: 0, trunksInMain: 0, tickets: 0, kioskRooms: 0, kioskWares: 0, booths: 0, standpipes: [], loosePlinths: 0, signs: 0 };
    for (const node of Object.values(graph.nodes)) {
      let wares = 0;
      for (const c of G.worldgen.contents(node)) {
        const d = c.data || {};
        if (c.type === 'trunk') { out.trunks++; if (G.roomDefs[node.def].kind === 'main') out.trunksInMain++; }
        else if (c.type === 'ticket') out.tickets++;
        else if (c.type === 'booth') out.booths++;
        else if (c.type === 'standpipe') out.standpipes.push(node.id);
        else if (c.type === 'sign' && node.id === graph.hub) out.signs++;
        else if (c.type === 'plinth') {
          if (d.price) wares++;
          else if (d.locked) out.fixed[node.region] = { node: node.id, item: d.item, kind: G.roomDefs[node.def].kind, parent: node.parent };
          else out.loosePlinths++;
        }
      }
      if (wares) { out.kioskRooms++; out.kioskWares += wares; }
    }
    return out;
  },
  /* What a branch room holds, as short entries { text, cut? } for the map. Uses the live room once it has been entered. */
  describe(node) {
    const live = G.run && G.run.rooms[node.id], list = [];
    const src = live ? live.props.map(p => ({ type: p.type, data: p.data })) : G.worldgen.contents(node);
    const tok = id => G.itemDefs[id] && { text: G.itemDefs[id].name, cut: G.itemDefs[id].cls };
    for (const c of src) {
      const d = c.data || {};
      if (c.type === 'plinth' && d.item && tok(d.item)) { const t = tok(d.item); list.push({ text: t.text + (d.price ? ' ' + Math.round(d.price * G.run.mods.shopCost) : (d.locked ? ' (guarded)' : '')), cut: t.cut }); }
      else if (c.type === 'plinth' && d.trinket && G.trinketDefs[d.trinket]) list.push({ text: G.trinketDefs[d.trinket].name + (d.price ? ' ' + Math.round(d.price * G.run.mods.shopCost) : '') });
      else if (c.type === 'plinth' && d.scrip) list.push({ text: d.scrip + ' scrip' });
      else if (c.type === 'trunk') list.push(Object.assign({ text: 'Lost trunk' }, d.item && tok(d.item) ? { text: 'Lost trunk: ' + tok(d.item).text, cut: tok(d.item).cut } : {}));
      else if (c.type === 'ticket') list.push({ text: 'Ticket machine' });
      else if (c.type === 'booth') list.push({ text: 'Clipping booth' });
      else if (c.type === 'standpipe') list.push({ text: 'Standpipe' });
      else if (c.type === 'post') list.push({ text: (G.abilityDefs[d.abil] && G.abilityDefs[d.abil].name) || 'Signal post' });
    }
    return list;
  },
  // Soundness of a graph: nodes the hub cannot reach, and nodes from which the hub cannot be reached (dead ends).
  check(graph) {
    const fromHub = reach(graph, graph.hub), ids = Object.keys(graph.nodes);
    return { unreachable: ids.filter(id => !fromHub.has(id)), deadEnds: ids.filter(id => !reach(graph, id).has(graph.hub)) };
  }
};
})();
