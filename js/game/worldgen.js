/* Regions and the per-run room graph. Everything here is drawn from one seeded generator, so a seed reproduces a run. */
(() => {
'use strict';
const G = window.G, U = G.util;
G.regionDefs = {};

/* G.defineRegion({ id, name, blurb, gate, boss, ability, plinth, enemies, flyers, ceiling, length, pool, palette })
   gate       position of this region's gate in the hub, left to right (0, 1, 2 ...)
   boss       boss id fought in this region's arena
   ability    ability id granted by this region's signal post (same every run)
   plinth     true: this region's own branch room holds a guarded plinth. Which token sits on it is drawn per run (G.worldgen.drawTokens): a
              token of a cut that opens a fare slot on the next region's Warden in the ring, shown on the map before the player commits
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
  // Mechanism channel of a Y / A / Z marker: 'main' unless the template names one at that tile (def.channels['c,r']), e.g. the home
  // area's 'beaten:r1' gates, which open once that Warden has fallen (props.js mech_gate).
  const chan = m => (def.channels && def.channels[m.c + ',' + m.r]) || 'main';
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
    else if (m.ch === 'Y') c = { type: 'lever', data: { channel: chan(m) } };
    else if (m.ch === 'A') c = { type: 'plate', data: { channel: chan(m) } };
    else if (m.ch === 'Z') c = { type: 'mech_gate', data: { channel: chan(m) } };
    else if (m.ch === 'Q') c = { type: 'rail_cart', data: { span: 3 } };
    else if (m.ch === 'N') c = { type: 'guide', data: {} };
    else if (m.ch === 'C') c = { type: 'trunk', data: {} };                 // what they hold is drawn by balance() once the counts are trimmed
    else if (m.ch === 'I') {
      // Only the region's own branch room holds a plinth (its first one): the region's fixed token, guarded. Others are trimmed.
      if (ctx.own.has(node.id) && !plinthN++) c = { type: 'plinth', data: Object.assign(plinthOf(region, ctx, rng, used), { locked: true }) };
    } else if (m.ch === 'R') {
      c = { type: 'ticket', data: { choices: [] } };
    } else if (m.ch === 'S') c = { type: 'plinth', data: { ware: true } };
    node.content[i] = c;
  });
  if (def.kind === 'hub') node.signsPlaced = signN;
  // A region's first main room is an introduction (region.intro): at most maxEnemies enemies, and nothing from `avoid` (the turnstile and
  // the brine spout) within `calm` tiles of the entrance, where the party arrives (column 1). Those become crabs; extras are dropped
  // (the ones nearest the entrance first).
  const late = !!(ctx.rule && ctx.rule.region === region.id);                // Timetable card Late Running: no softening, no thinning
  if (region.intro && ctx.first === node.id && !late) {
    const it = region.intro, idx = () => def.marks.map((m, i) => i).filter(i => node.content[i] && node.content[i].type === 'enemy');
    for (const i of idx()) if (def.marks[i].c - 1 <= it.calm && it.avoid.includes(node.content[i].id)) node.content[i] = { type: 'enemy', id: G.enemyDefs.ballast_crab ? 'ballast_crab' : null };
    while (idx().length > it.maxEnemies) { const list = idx().sort((a, b) => def.marks[a].c - def.marks[b].c); node.content[list[0]] = null; }
  }
  // Thin out a main room that holds more enemies than its region allows (drop the most repeated kinds first).
  const cap = late ? null : ENEMY_CAP[region.id];
  if (cap && def.kind === 'main') {
    const idx = () => def.marks.map((m, i) => i).filter(i => node.content[i] && node.content[i].type === 'enemy');
    for (let n = idx().length; n > cap[1]; n--) {
      const list = idx(), count = {}; list.forEach(i => { const id = node.content[i].id; count[id] = (count[id] || 0) + 1; });
      const top = Math.max(...Object.values(count));
      node.content[rng.pick(list.filter(i => count[node.content[i].id] === top))] = null;
    }
  }
  // Authored rooms may pin encounter jobs to their E/F/L marker order.
  // This preserves deliberate combat lessons while elite rolls and other seeded content remain variable.
  const applyPlan = (markCh, plan) => {
    if (!Array.isArray(plan) || !plan.length) return;
    let n = 0;
    def.marks.forEach((m, i) => {
      if (m.ch !== markCh) return;
      const want = plan[n++], c = node.content[i];
      if (!want || !c || c.type !== 'enemy') return;
      const choices = (Array.isArray(want) ? want : [want]).filter(id => G.enemyDefs[id]);
      if (choices.length) c.id = choices.length === 1 ? choices[0] : rng.pick(choices);
    });
  };
  applyPlan('E', def.enemyPlan);
  applyPlan('F', def.flyerPlan);
  applyPlan('L', def.ceilingPlan);
  // Optional proximity staging follows authored marker order. It changes only when AI wakes, never what spawns.
  const applyWake=(markCh,plan)=>{
    if(!Array.isArray(plan))return;
    let n=0;
    def.marks.forEach((m,i)=>{
      if(m.ch!==markCh)return;
      const c=node.content[i],range=plan[n++];
      if(c&&c.type==='enemy'&&Number.isFinite(range)&&range>0)c.wakeRange=range;
    });
  };
  applyWake('E',def.wakePlan);
  applyWake('F',def.flyerWakePlan);
  applyWake('L',def.ceilingWakePlan);

  // One visibly overstamped machine may appear in later main rooms. Never put an elite in the region's onboarding room.
  if (def.kind === 'main' && node.id !== ctx.first) {
    const chance = ({ r1:0.06, r2:0.10, r3:0.14, r4:0.18, final:0.24 })[region.id] || 0;
    const candidates = def.marks.map((m,i)=>i).filter(i=>node.content[i]&&node.content[i].type==='enemy'&&!G.enemyDefs[node.content[i].id].ceiling);
    if (candidates.length && rng.chance(chance)) node.content[rng.pick(candidates)].elite = true;
  }
}
// Enemies per main room: [min, max] by region (the templates carry the minimum; fillContent trims to the maximum).
const ENEMY_CAP = { r1: [2, 3], r2: [3, 4], r3: [3, 4], r4: [3, 5], final: [4, 5] };
// What a guarded plinth holds: the token the run drew for this region (ctx.draw.plinth), or (none left) a trinket or scrip.
const plinthOf = (region, ctx, rng, used) => lootData(rng, used, ctx.draw && ctx.draw.plinth[region.id]);
/* Token uniqueness. `used` holds every token (and trinket) id already placed or offered anywhere in this run, the run's drawn tokens
   first; nothing draws an id in it, so a token turns up once per run. A source whose drawn token is missing offers a trinket, or
   failing that scrip, instead. Everything draws from the run's seeded rngs, so a run code gives the same world. */
const FILLER_SCRIP = 40;
const trinketFor = (rng, used) => { const t = G.trinkets.roll(rng, used); if (t) used.push(t); return t; };
// What a trunk, plinth or ticket choice holds: { item } (the drawn token, if there is one) | { trinket } | { scrip }
function lootData(rng, used, token) {
  if (token) return { item: token };
  const t = trinketFor(rng, used);
  return t ? { trinket: t } : { scrip: FILLER_SCRIP };
}
// One kiosk ware: a trinket for 40 scrip (the price is adjusted by mods.shopCost when it is shown). The kiosk sells no tokens.
function ware(rng, used) {
  const t = trinketFor(rng, used);
  return t ? { type: 'plinth', data: { trinket: t, price: 40 } } : null;
}
/* The run's token draw (rolled from the seed alone, its own stream): about 7 of the pool, so which tokens exist differs every run.
   - each region with a guarded plinth gets a token of a cut that the lock chart makes useful on the NEXT Warden in the ring (r1 -> r2 -> r3 -> r4 -> r1),
     and the four plinths hold four different cuts when the pool allows (rares and ledger tokens come up a third as often)
   - then two lost trunks, one ticket machine token, and (Timetable card Packed Lunch) one starting token; a chosen starting token comes out of the pool first
   Returns { plinth: { regionId: id }, trunks: [id, id], ticket: id, start: [id], all: [every id drawn] }; a missing id is null (the pool ran dry). */
function drawTokens(seed, chart, order, rule, startCut) {
  const rng = U.makeRng((seed ^ 0x7a3c91d5) >>> 0), startTok = startCut && G.ledger.commonOf(startCut) ? G.ledger.commonOf(startCut).id : null;
  let left = G.items.pool().filter(id => id !== startTok);
  const take = cands => {
    const bag = cands.flatMap(id => G.items.weight(id) === 1 ? [id] : [id, id, id]);
    if (!bag.length) return null;
    const id = rng.pick(bag); left = left.filter(x => x !== id); return id;
  };
  const ring = order.filter(r => r.plinth), out = { plinth: {}, trunks: [], ticket: null, start: startTok ? [startTok] : [], all: [] }, cuts = [];
  ring.forEach((r, k) => {
    const next = ring[(k + 1) % ring.length], ok = left.filter(id => (chart[next.id] || []).includes(G.itemDefs[id].cls));
    const fresh = ok.filter(id => !cuts.includes(G.itemDefs[id].cls));
    const id = take(fresh.length ? fresh : ok.length ? ok : left);
    out.plinth[r.id] = id; if (id) cuts.push(G.itemDefs[id].cls);
  });
  // The first trunk (placed in the first region's main rooms, see balance) must help against the FIRST Warden: a plain token of one of its three charted cuts
  const first = order[0] && chart[order[0].id] || [], onFirst = left.filter(id => first.includes(G.itemDefs[id].cls)), plain = onFirst.filter(id => G.itemDefs[id].rarity === 'common');
  out.trunks = [take(plain.length ? plain : onFirst.length ? onFirst : left)];
  out.trunks.push(take(left));
  out.ticket = take(left);
  if (rule && rule.startToken) out.start.push(take(left));
  out.all = [...Object.values(out.plinth), ...out.trunks, out.ticket, ...out.start].filter(Boolean);
  return out;
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
  // One trunk is always in the first region's main rooms (before its arena): a fresh player meets a token before the first Warden.
  const firstId = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate)[0].id, allTr = rng.shuffle(entries('C', 'trunk')), early = allTr.find(e => e.n.region === firstId);
  const keptTr = (early ? [early] : []).concat(allTr.filter(e => e !== early)).slice(0, 2); allTr.filter(e => !keptTr.includes(e)).forEach(strip);
  const trunks = keptTr, rule = graph.rule || {};
  const queue = (graph.draw && graph.draw.trunks.slice()) || [];
  place('trunk', () => ({}), 1, 3, 2 - trunks.length);
  // ticket machine: exactly 1 (it can be used twice: 30 scrip, then 45)
  const machines = keep(entries('R', 'ticket'), 1);
  place('ticket', () => ({ choices: [] }), 2, 4, 1 - machines.length);
  // kiosk: exactly 1 room with exactly 3 wares
  const wares = entries('S', 'plinth'), rooms = [...new Set(wares.map(e => e.n))];
  if (rule.kioskClosed) wares.forEach(strip);                                  // Timetable card Scrip Boom: the kiosk is closed (no wares)
  else if (rooms.length) {
    const kioskNode = rng.pick(rooms);
    wares.filter(e => e.n !== kioskNode).forEach(strip);
    const mine = wares.filter(e => e.n === kioskNode);
    mine.slice(3).forEach(strip);
    for (let k = mine.length; k < 3; k++) if (!addExtra(kioskNode, 'plinth', { ware: true }, 1, 2, rng)) warn.push('kiosk ware missing');
  } else {
    const home = mains().find(n => spotsFor(n, 1, 2).length >= 6);
    for (let k = 0; k < 3; k++) if (!home || !addExtra(home, 'plinth', { ware: true }, 1, 2, rng)) { warn.push('kiosk ware missing'); break; }
  }
  // Campaign service stops are authored pacing beats, not random economy sources.
  // Keep the Junction, every declared region.serviceAt room, and the existing pre-Terminus stop.
  // Regions without an authored sequence still fall back to the old generated-layout behaviour.
  const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), last = order.length && graph.regions[order[order.length - 1].id];
  const lastMain = last && graph.nodes[last.arena].exits.left && graph.nodes[last.arena].exits.left.to;
  const serviceNodes = order.flatMap(region => {
    if (!region.serviceAt || !graph.regions[region.id]) return [];
    const id = graph.regions[region.id].nodes.find(id => graph.nodes[id] && graph.nodes[id].def === region.serviceAt);
    return id ? [id] : [];
  });
  const wanted = rule.noPipes ? [] : [...new Set([graph.hub, ...serviceNodes, last && last.pipe ? last.pipe : lastMain].filter(Boolean))];   // Timetable card Dry Pipes: no standpipes
  entries('H', 'standpipe').filter(e => !wanted.includes(e.n.id)).forEach(strip);
  for (const id of wanted) {
    const n = graph.nodes[id];
    if (!entries('H', 'standpipe').some(e => e.n === n) && !addExtra(n, 'standpipe', {}, 1, 3, rng)) warn.push('no room for a standpipe in ' + id);
  }
  // each region's guarded fixed plinth (its own branch room)
  for (const id of ctx.own) {
    const n = graph.nodes[id];
    if (!entries('I', 'plinth').some(e => e.n === n) && !addExtra(n, 'plinth', Object.assign(plinthOf(G.regionDefs[n.region], ctx, rng, used), { locked: true }), 1, 3, rng)) warn.push('no room for the plinth in ' + id);
  }
  // What the sources hold is drawn only now that the counts are final, so tokens are not wasted on sources that were trimmed away.
  // Order: the trunks, the ticket machine's first three, the kiosk (trinkets), then the machine's second three.
  const all = type => nodes.flatMap(n => G.worldgen.contents(n).filter(c => c.type === type));
  for (const c of all('trunk')) Object.assign(c.data, lootData(rng, used, queue.shift()));
  const machinesNow = all('ticket');
  // the machine's first three: the run's ticket token first, then trinkets (the second roll offers trinkets and scrip only)
  for (const c of machinesNow) { c.data.choices.push(lootData(rng, used, graph.draw && graph.draw.ticket)); for (let k = 1; k < 3; k++) c.data.choices.push(lootData(rng, used)); }
  for (const c of all('plinth').filter(c => c.data.ware)) {
    const w = ware(rng, used);
    if (w) { delete c.data.ware; Object.assign(c.data, w.data); } else warn.push('kiosk ware empty');
  }
  for (const c of machinesNow) { c.data.next = []; for (let k = 0; k < 3; k++) c.data.next.push(lootData(rng, used)); }
  // the hub's three signs
  const hub = graph.nodes[graph.hub], hubDef = G.roomDefs[hub.def], pc = (hubDef.marks.find(m => m.ch === 'P') || { c: 14 }).c;
  for (let k = hub.signsPlaced || 0; k < HUB_SIGNS.length; k++) if (!addExtra(hub, 'sign', { text: HUB_SIGNS[k] }, 0, 1, rng, pc)) warn.push('no room for hub sign ' + (k + 1));
  // The Route Board is an authored destination on the Junction's high clock balcony.
  // Its bottom edge sits just above the row-13 one-way platform so a standing player can inspect it.
  // The hub template may say where the board and the Timetable plate hang (hubDef.board / hubDef.timetable = [c, r]).
  const bd = hubDef.board || [59, 13];
  (hub.extras || (hub.extras = [])).push({ type: 'board', data: {}, c: bd[0], r: bd[1], x: bd[0] * T + T / 2, y: bd[1] * T + 16 });
  // The Timetable card hangs on the same balcony, left of the board (prop type 'timetable', js/ui/ledger.js; placement note: docs/HANDOFF_HUB.md)
  const tt = hubDef.timetable || [53, 13];
  hub.extras.push({ type: 'timetable', data: {}, c: tt[0], r: tt[1], x: tt[0] * T + T / 2, y: tt[1] * T + 16 });
  return warn;
}

const OPP = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
/* Loop-back shortcuts (home area). hubDef.shortcuts = [{ region, c, r }]: the home end is a bolted hatch at (c, r) (a fixture in the
   template); its far end is placed here in the region's last main room, near the exit toward the Warden, as an extra 'shortcut' prop.
   The far end can always be used and unbolts both ends (G.run.shortcuts[region]); the home end opens only after that.
   graph.shortcuts[region] = { deep: nodeId, x, y, home: { x, y } }. Placed with no random draws, so it never shifts a seed's other rolls. */
function placeShortcuts(graph, hubDef, warnings) {
  graph.shortcuts = {};
  for (const s of hubDef.shortcuts || []) {
    const rg = graph.regions[s.region]; if (!rg) continue;
    const mains = rg.nodes.filter(id => G.roomDefs[graph.nodes[id].def].kind === 'main' && !graph.nodes[id].parent), deep = graph.nodes[mains[mains.length - 1]];
    if (!deep) continue;
    const d = G.roomDefs[deep.def], fwd = (d.route || ['left', 'right'])[1], port = d.ports && d.ports[fwd];
    const near = fwd === 'right' ? d.cols - 7 : fwd === 'left' ? 6 : port ? port.c : d.cols >> 1;
    const nearRow = fwd === 'left' || fwd === 'right' ? d.rows - 3 : fwd === 'top' ? 0 : d.rows - 1;
    // a spot 3 tiles wide on safe solid floor (rock, salt or mud), 3 tiles of headroom, clear of markers and other extras,
    // nearest the way on to the Warden
    const g = d.grid, ex = deep.extras || [], cand = [];
    for (let r = 3; r < d.rows - 1; r++) for (let c = 4; c < d.cols - 4; c++) {
      let ok = true;
      for (let x = c - 1; x <= c + 1 && ok; x++) ok = '#sm'.includes(g[r + 1][x]) && g[r][x] === '.' && g[r - 1][x] === '.' && g[r - 2][x] === '.';
      if (ok && !d.marks.some(m => Math.abs(m.r - r) <= 2 && Math.abs(m.c - c) <= 2) && !ex.some(e => Math.abs(e.r - r) <= 2 && Math.abs(e.c - c) <= 2)) cand.push({ c, r });
    }
    if (!cand.length) { warnings.push('no room for the ' + s.region + ' loop-back hatch in ' + deep.def); continue; }
    const best = cand.sort((a, b) => (Math.abs(a.c - near) + Math.abs(a.r - nearRow) * 0.5) - (Math.abs(b.c - near) + Math.abs(b.r - nearRow) * 0.5))[0];
    const e = { type: 'shortcut', data: { region: s.region, side: 'deep' }, c: best.c, r: best.r, x: best.c * T + T / 2, y: (best.r + 1) * T };
    (deep.extras || (deep.extras = [])).push(e);
    graph.shortcuts[s.region] = { deep: deep.id, x: e.x, y: e.y, home: { x: (s.c + .5) * T, y: (s.r + 1) * T } };
  }
}

// Every node a node leads to: edge exits, doorways and hub gates.
function links(graph, node) {
  const out = [];
  for (const side of ['left', 'right', 'top', 'bottom']) if (node.exits[side]) out.push(node.exits[side].to);
  for (const q of node.portals || []) out.push(q.dest);                                     // home-area portals
  for (const e of node.extras || []) if (e.type === 'shortcut' && e.data.side === 'deep') out.push(graph.hub);   // loop-back hatches (always open from the deep side)
  for (const c of node.content) {
    if (c && c.type === 'door') out.push(c.data.to);
    if (c && c.type === 'gate') out.push(graph.regions[c.data.region].mouth ? graph.regions[c.data.region].mouth.node : graph.regions[c.data.region].first);
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
     node = { id, def (room template id), region, exits: { left/right/top/bottom }, content: [per marker], seen, parent (branch rooms) }
     Main defs use route: [entrySide, exitSide] (default left -> right); every exit is { to: nodeId, entry }. Per region: `length` main rooms, then the arena; the
     main rooms' doorways lead to the trial room, the region's own branch room (its guarded plinth) and shared branch rooms. */
  build(seed, cuts, extra) {
    // The world is built from the seed and the unlocked cuts only (cuts: the cuts whose rare tokens are in the pool; default: the save's), plus
    // the ledger's part of the run code: extra = { unl: { tokens, cards }, opts: { express, start } } (default: what the save has unlocked and chosen).
    // The Timetable card is rolled here from the seed and the unlocked cards, and the run's tokens are drawn (drawTokens).
    if (!extra) { const unl = G.ledger.unlocked(); extra = { unl, opts: G.ledger.options(unl) }; }
    G.items.cutsOverride = cuts || G.meta.cuts; G.items.ledgerOverride = extra.unl.tokens;
    try { return G.worldgen.build0(seed, extra); } finally { G.items.cutsOverride = null; G.items.ledgerOverride = null; }
  },
  rollChart(seed) { return rollChart(seed, Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate)); },
  build0(seed, extra) {
    const rng = U.makeRng(seed), nodes = {}, regions = {}, warnings = [], ctx = { own: new Set() };
    const rule = G.ledger.rollRule(seed, extra.unl.cards), chart = G.worldgen.rollChart(seed);
    const picks = drawTokens(seed, chart, Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), rule, extra.opts.start);
    ctx.rule = rule; ctx.draw = picks;
    const used = picks.all.slice();                                                  // the run's drawn tokens are placed first: nothing else draws them
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
      const hubPortal = (hubDef.portals || []).find(q => q.id === region.id);
      if (!mains.length || !arenas.length) { G.fail('region ' + region.id + ' has no main rooms or no arena'); return; }
      // A shared branch room with a standpipe (H) is never drawn as an ordinary side room: it is the last region's pre-arena stop.
      const hasH = d => d.marks.some(m => m.ch === 'H'), isLast = ri === Math.min(order.length, gateMarks.length) - 1;
      const campaign = Array.isArray(region.sequence) && region.sequence.length;
      const trials = region.ability ? defsOf('trial', region.pool).concat(defsOf('trial', 'shared')) : [], own = defsOf('branch', region.pool);
      // Shared service closets belong to generated/replay layouts only. In the authored campaign, the Junction owns ticket/kiosk
      // services and regional doors are reserved for authored trials/holds/story spaces.
      const shared = campaign ? [] : defsOf('branch', 'shared').filter(d => !hasH(d));
      const pipes = isLast ? defsOf('branch', 'shared').filter(hasH) : [], pipeDef = pipes.length ? rng.pick(pipes) : null;
      const want = [trials, own, shared].filter(p => p.length).length + (pipeDef ? 1 : 0);
      const chooseMains = () => {
        // Story/campaign regions may define an authored main-room spine. Seed variation still controls enemies, loot,
        // branch contents and elites; it no longer shuffles the spaces the player learns as the core journey.
        if (Array.isArray(region.sequence) && region.sequence.length) {
          const seq = region.sequence.map(id => mains.find(d => d.id === id)).filter(Boolean);
          if (seq.length !== region.sequence.length) G.fail('region ' + region.id + ' sequence references a missing main room');
          return seq.slice(0, region.length);
        }
        const intro = region.introRoom && mains.find(d => d.id === region.introRoom);
        const landmark = region.landmark && mains.find(d => d.id === region.landmark);
        const pinned = [];
        if (intro) pinned.push(intro);
        if (landmark && landmark !== intro) pinned.push(landmark);
        if (!pinned.length) return draw(rng, mains, region.length);
        const rest = mains.filter(d => !pinned.includes(d));
        const picked = pinned.concat(draw(rng, rest, Math.max(0, region.length - pinned.length)));
        if (!intro) return rng.shuffle(picked);
        const tail = picked.filter(d => d !== intro);
        return [intro].concat(rng.shuffle(tail));
      };
      let chosen = chooseMains();
      for (let tries = 0; tries < 30 && chosen.reduce((s, d) => s + d.doors, 0) < want; tries++) chosen = chooseMains();

      chosen.forEach(take);
      const chain = chosen.map(d => add(d, region.id)), arena = add(rng.pick(arenas), region.id);
      const routeOf = node => G.roomDefs[node.def].route || ['left', 'right'];
      chain.forEach((node, i) => {
        const [backSide, forwardSide] = routeOf(node), prev = chain[i - 1], next = chain[i + 1];
        node.exits[backSide] = prev ? { to: prev.id, entry: { side: routeOf(prev)[1] } } : { to: hub.id, entry: hubPortal ? { portal: region.id } : { gate: region.id } };
        node.exits[forwardSide] = next ? { to: next.id, entry: { side: routeOf(next)[0] } } : { to: arena.id, entry: { side: 'left' } };
      });
      const last = chain[chain.length - 1];
      arena.exits.left = { to: last.id, entry: { side: routeOf(last)[1] } };
      const g = regions[region.id] = { first: chain[0].id, arena: arena.id, nodes: chain.map(c => c.id).concat(arena.id) };
      // Home-area portal: the hub's opening for this region leads to the first room, through a connector room when it names one
      // (a vertical approach: the hub's top or bottom edge cannot meet a first room that is entered from its left).
      const firstSide = routeOf(chain[0])[0];
      if (hubPortal) {
        const via = hubPortal.via && G.roomDefs[hubPortal.via];
        let dest = { node: chain[0].id, entry: { side: firstSide } };
        if (hubPortal.via && !via) warnings.push('home portal ' + region.id + ' names a missing connector ' + hubPortal.via);
        if (via) {
          const k = add(via, 'hub'), [kIn, kOut] = via.route || ['left', 'right'];
          k.connector = region.id; g.connector = k.id;
          k.exits[kIn] = { to: hub.id, entry: { portal: region.id } };
          k.exits[kOut] = { to: chain[0].id, entry: { side: firstSide } };
          chain[0].exits[firstSide] = { to: k.id, entry: { side: kOut } };
          if (OPP[kOut] !== firstSide) warnings.push('connector ' + via.id + ' leaves by its ' + kOut + ' edge but ' + chain[0].def + ' is entered from its ' + firstSide);
          dest = { node: k.id, entry: { side: kIn } };
        }
        const inSide = via ? (via.route || ['left'])[0] : firstSide;
        if (OPP[hubPortal.side] !== inSide) warnings.push('home portal ' + region.id + ' on the ' + hubPortal.side + ' edge meets a ' + inSide + ' entrance');
        (hub.portals || (hub.portals = [])).push({ id: region.id, side: hubPortal.side, lo: hubPortal.from, hi: hubPortal.to, dest: dest.node, entry: dest.entry });
        g.mouth = dest;
      }
      const gm = hubDef.gateFor && hubDef.gateFor[region.id] ? hubDef.marks.findIndex(m => m.ch === 'G' && m.c === hubDef.gateFor[region.id][0] && m.r === hubDef.gateFor[region.id][1]) : -1;
      hub.content[gm >= 0 ? gm : gateMarks[ri]] = { type: 'gate', data: { region: region.id } };

      // Doorways: campaign mode uses only authored trial/own/standpipe rooms; generated mode may fill spare doors from shared pools.
      let slots = rng.shuffle(chain.flatMap(node => G.roomDefs[node.def].marks.map((m, i) => m.ch === 'D' ? { node, i } : null).filter(Boolean)));
      const required = [];
      if (trials.length) required.push({ def: rng.pick(trials), kind:'trial', prefer: region.trialAt });
      if (own.length) required.push({ def: rng.pick(own), kind:'own', own:true, prefer: region.ownAt });
      // Authored campaign plans pin the important side rooms to meaningful landmarks while leaving extra/shared doors seeded.
      for (let k = required.length - 1; k >= 0; k--) {
        const pref = required[k].prefer;
        if (!pref) continue;
        const at = slots.findIndex(sl => sl.node.def === pref);
        if (at >= 0) slots.unshift(slots.splice(at, 1)[0]);
      }
      // The standpipe stop goes on a doorway of the last main room when it has one (the Terminus: a standpipe before the arena).
      if (pipeDef) { const at = slots.findIndex(sl => sl.node === chain[chain.length - 1]); required.unshift({ def: pipeDef, pipe: true }); if (at > 0) slots.unshift(slots.splice(at, 1)[0]); }
      if (slots.length < required.length) warnings.push('region ' + region.id + ' has too few doorways for its trial and branch rooms');
      required.forEach(r => take(r.def));
      const extras = campaign ? [] : shared.length ? pickShared(shared, Math.max(0, slots.length - required.length)) : draw(rng, own, Math.max(0, slots.length - required.length));
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
    const graph = { seed, hub: hub.id, nodes, regions, warnings, claimed: used, chart, rule, draw: picks };
    if (rule.region && regions[rule.region]) regions[rule.region].delayed = true;
    warnings.push(...balance(graph, rng, used, ctx));
    placeShortcuts(graph, hubDef, warnings);
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
