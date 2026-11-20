/* Room validator: static lint + a traversal bot, for every defined room (the smoke check) or for a filtered set (tools/roomlint.mjs).
   Lint runs in Node on the template text. The traversal runs inside the page: it drives player 1 only through G.debug
   (newRun, gotoRoom, setInput, step, place, probe) and searches over short input segments (beam search). Documented in docs/ARCHITECTURE.md. */

const CHARS = '#.^=sm<>cjvEFLICRSKMHDBG?PX';
const SOLID = '#sm<>cjv'; 
const GROUND = 'EICRSKMHDBGP?X';         // markers that stand on the tile below them
const TARGETS = 'ICRSKMH';              // things a bot must be able to walk up to in branch and trial rooms
const EXIT_ROWS = [12, 13, 14];
const CW = 30, CH = 17;

// ---------------------------------------------------------------- static lint (Node side)
export function lintRoom(r, abilityIds) {
  const err = [], warn = [];
  const w = r.w || 1, h = r.h || 1, cols = CW * w, rows = CH * h, base = (h - 1) * CH, map = r.map || [];
  if (!['hub', 'main', 'branch', 'trial', 'arena'].includes(r.kind)) { err.push('unknown kind "' + r.kind + '"'); return { err, warn }; }
  if (map.length !== rows) { err.push('needs ' + rows + ' rows (' + CH + ' per cell high), has ' + map.length); return { err, warn }; }
  const badRows = map.map((s, i) => [i, s.length]).filter(([, n]) => n !== cols);
  if (badRows.length) { err.push('row ' + badRows[0][0] + ' is ' + badRows[0][1] + ' wide, needs ' + cols + ' (' + CW + ' per cell wide)' + (badRows.length > 1 ? ' (+' + (badRows.length - 1) + ' more rows)' : '')); return { err, warn }; }
  const marks = [], grid = [];
  map.forEach((row, y) => {
    let out = '';
    for (let c = 0; c < cols; c++) {
      const ch = row[c];
      if (!CHARS.includes(ch)) { err.push('unknown character "' + ch + '" at column ' + c + ', row ' + y); out += '.'; }
      else if ('EFLICRSKMHDBG?PX'.includes(ch)) { marks.push({ ch, c, r: y }); out += '.'; } else out += ch;
    }
    grid.push(out);
  });
  const at = (c, y) => (y < 0 || y >= rows || c < 0 || c >= cols) ? '#' : grid[y][c];
  const solid = (c, y) => SOLID.includes(at(c, y));
  const count = ch => marks.filter(m => m.ch === ch).length;
  const loc = m => '(col ' + m.c + ', row ' + m.r + ')';

  // borders: a main room declares exactly two route ports. Existing rooms default left -> right.
  const SIDES = ['left', 'right', 'top', 'bottom'], route = r.kind === 'main' ? (r.route || ['left', 'right']) : [];
  if (r.kind === 'main' && (route.length !== 2 || route[0] === route[1] || route.some(s => !SIDES.includes(s)))) err.push('main route must be two different sides: left, right, top or bottom');
  const wantSide = side => r.kind === 'arena' ? side === 'left' : r.kind === 'main' && route.includes(side);
  for (const [side, col] of [['left', 0], ['right', cols - 1]]) {
    const want = wantSide(side), bad = [];
    for (let y = 0; y < rows; y++) {
      const isExit = y >= base + 12 && y <= base + 14, open = grid[y][col] !== '#';
      if (isExit && want && !open) bad.push(y);
      else if (!(isExit && want) && open && !(r.kind === 'arena' && side === 'left' && y === base + 11)) bad.push(y);
    }
    if (bad.length) {
      const openRows = bad.filter(y => grid[y][col] !== '#'), shut = bad.filter(y => grid[y][col] === '#');
      if (shut.length) err.push(r.kind + ' room: ' + side + ' exit is closed at row' + (shut.length > 1 ? 's ' : ' ') + shut.join(', '));
      if (openRows.length) err.push(r.kind + ' room: undeclared ' + side + ' edge opening at row' + (openRows.length > 1 ? 's ' : ' ') + openRows.join(', '));
    }
  }
  for (const side of ['top', 'bottom']) {
    const y = side === 'top' ? 0 : rows - 1, openCols = [];
    for (let c = 0; c < cols; c++) if (grid[y][c] !== '#') openCols.push(c);
    const want = wantSide(side);
    if (!want && openCols.length) err.push(r.kind + ' room: undeclared ' + side + ' edge opening at column ' + openCols[0]);
    if (want) {
      if (openCols.length < 3) err.push(side + ' exit needs at least 3 open edge tiles');
      else for (let i = 1; i < openCols.length; i++) if (openCols[i] !== openCols[i - 1] + 1) { err.push(side + ' exit must be one contiguous opening'); break; }
    }
  }

  // markers by kind
  const D = count('D'), B = count('B');
  if (r.kind === 'main') { if (D === 0) warn.push('main room has no D (about one doorway per main room is expected)'); if (D > 2) warn.push(D + ' doorways D in a main room (about one is expected)'); }
  if (r.kind === 'branch' || r.kind === 'trial') { if (D !== 1) err.push(r.kind + ' room needs exactly one D, has ' + D); if (!r.label) err.push(r.kind + ' room needs a label naming the doorway that leads in'); }
  if (r.kind === 'arena' && D) err.push('arena has a D (' + D + '); arenas have no doorways');
  if (r.kind === 'branch' && !marks.some(m => TARGETS.includes(m.ch))) err.push('branch room has nothing to visit (needs one of ' + TARGETS.split('').join(' ') + ')');
  if (r.kind === 'trial' && count('M') !== 1) err.push('trial room needs exactly one M (signal post), has ' + count('M'));
  if (r.kind !== 'trial' && count('M')) err.push('M (signal post) belongs in a trial room');
  if (r.kind !== 'branch' && count('X')) err.push('X (cracked barrier) belongs in a branch room, and only a guarded one (it needs heavy)');
  if (count('X') && !(r.needs || []).includes('heavy')) err.push('a room with a cracked barrier X must declare needs: [\'heavy\']');
  if ((r.needs || []).includes('heavy') && !count('X')) err.push('needs heavy, but the room has no cracked barrier X');
  if (r.kind !== 'arena' && B) err.push('B (boss) outside an arena');
  if (r.kind !== 'hub') { if (count('G')) err.push('G (region gate) outside the hub'); if (count('P')) err.push('P (party start) outside the hub'); }
  if (r.kind === 'hub' && count('P') !== 1) err.push('the hub needs exactly one P');
  const q = count('?'), ns = (r.signs || []).length;
  if (q > ns) warn.push(q + ' sign markers ? but only ' + ns + ' signs[] texts');

  // support: ground markers stand on solid or one-way; a marker is never inside a wall; spikes are not a floor
  for (const m of marks) {
    if (GROUND.includes(m.ch)) {
      const below = at(m.c, m.r + 1);
      if (m.r + 1 >= rows) err.push(m.ch + ' at ' + loc(m) + ' is on the last row');
      else if (below === '^') err.push(m.ch + ' at ' + loc(m) + ' stands on spikes');
      else if (!SOLID.includes(below) && below !== '=') err.push(m.ch + ' at ' + loc(m) + ' floats: no solid ground under it (tile below is empty)');
      if (solid(m.c, m.r - 1)) err.push(m.ch + ' at ' + loc(m) + ' is inside a wall: the tile above it is solid (no headroom)');
    } else if (m.ch === 'L') {
      let r = m.r - 1; while (r >= 0 && !solid(m.c, r)) r--;
      if (m.r < 2 || r < 0) err.push('L at ' + loc(m) + ' has no ceiling above it');
      else if (m.r - r > 6) warn.push('L at ' + loc(m) + ' hangs from a ceiling ' + (m.r - r) + ' tiles up');
    } else if (m.ch === 'F') {
      let free = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !solid(m.c + dx, m.r + dy)) free++;
      if (free < 5) err.push('F at ' + loc(m) + ' is wedged into a wall (only ' + free + ' of 8 neighbours are free)');
    }
    const side = m.ch === 'R' ? 2 : m.ch === 'K' ? 3 : 0;
    for (let d = -side; d <= side && side; d++) {
      const c = m.c + d;
      if (c < 1 || c >= cols - 1 || solid(c, m.r) || at(c, m.r) === '^' || solid(c, m.r - 1)) { err.push(m.ch + ' at ' + loc(m) + ' needs ' + side + ' free tiles each side, column ' + c + ' is blocked'); break; }
      if (at(c, m.r + 1) !== '#' && at(c, m.r + 1) !== '=') { err.push(m.ch + ' at ' + loc(m) + ' needs floor ' + side + ' tiles each side, column ' + c + ' has none'); break; }
    }
  }

  // entrances: a floor to spawn on, headroom, and no spikes right at the door
  const entrance = (col, label) => {
    let fr = -1;
    for (let y = base + 12; y <= base + 15; y++) if (solid(col, y) || at(col, y) === '=') { fr = y; break; }
    if (fr < 0) err.push(label + ': no floor under the entrance (column ' + col + ')');
    else if (solid(col, fr - 1) || solid(col, fr - 2) || at(col, fr - 1) === '^') err.push(label + ': the player cannot stand at column ' + col + ' (floor at row ' + fr + ' has no 2-tile headroom)');
  };
  if (wantSide('left')) entrance(1, 'left entrance');
  if (wantSide('right')) entrance(cols - 2, 'right entrance');
  const verticalEntrance = side => { if (!wantSide(side)) return; const y = side === 'top' ? 0 : rows - 1, cs = []; for (let c = 0; c < cols; c++) if (grid[y][c] === '.') cs.push(c); if (!cs.length) return; const c = cs[Math.floor(cs.length / 2)], dir = side === 'top' ? 1 : -1; for (let k = 1; k <= 3; k++) if (at(c, y + dir * k) === '#') { err.push(side + ' entrance has no clear vertical lane at column ' + c); break; } };
  verticalEntrance('top'); verticalEntrance('bottom');
  const spikesNear = (c0, c1, y0, y1, label) => {
    for (let y = y0; y <= y1; y++) for (let c = c0; c <= c1; c++) if (at(c, y) === '^') { err.push('spikes at (col ' + c + ', row ' + y + ') are directly at ' + label); return; }
  };
  if (wantSide('left')) spikesNear(0, 2, base + 10, base + 16, 'the left entrance (keep columns 0 to 2 clear)');
  if (wantSide('right')) spikesNear(cols - 3, cols - 1, base + 10, base + 16, 'the right entrance (keep the last 3 columns clear)');
  for (const m of marks.filter(m => m.ch === 'D' && r.kind !== 'main')) spikesNear(m.c - 2, m.c + 2, m.r - 1, m.r + 1, 'the doorway at ' + loc(m));

  // arena
  if (r.kind === 'arena' && B === 1) {
    const b = marks.find(m => m.ch === 'B');
    let door = -1;
    for (let c = 0; c < b.c; c++) if (grid[base + 11][c] === '#' && EXIT_ROWS.every(y => grid[base + y][c] === '.')) { door = c; break; }
    if (door < 0) err.push('arena has no boss door: needs a column left of B with row ' + (base + 11) + ' solid and rows ' + (base + 12) + ' to ' + (base + 14) + ' open');
    let c1 = b.c; while (c1 < cols && grid[b.r][c1] !== '#') c1++;
    if (c1 >= cols) err.push('no solid tile to the right of B on its row (the fight floor needs a right wall)');
    else if (door >= 0 && c1 - door - 1 < 10) warn.push('boss floor is only ' + (c1 - door - 1) + ' tiles wide');
  } else if (r.kind === 'arena' && B !== 1) err.push('arena needs exactly one B, has ' + B);

  // declared abilities
  if (r.needs !== undefined) {
    if (!Array.isArray(r.needs)) err.push('needs must be an array of ability ids');
    else {
      const bad = r.needs.filter(a => !abilityIds.includes(a));
      if (bad.length) err.push('needs lists unknown abilities: ' + bad.join(', ') + ' (known: ' + abilityIds.join(', ') + ')');
      if (r.needs.length && !marks.some(m => m.ch === 'I')) err.push('a guarded room (needs) must hold a plinth I: that is what the ability guards');
      if (r.needs.length && r.needs.length !== 1) err.push('a guarded room needs exactly one ability (the ring of unlocks gives one per region)');
      if (r.needs.length && r.kind !== 'branch') err.push(r.kind + ' rooms must be doable with base moves; remove needs: ' + r.needs.join(', '));
    }
  }
  return { err, warn };
}

// ---------------------------------------------------------------- traversal bot (runs inside the page)
// spec: { id, abil: ['dash', ...], budget (max simulated steps per job), seg, beam, only: job name filter | null }
// Returns [{ name, ok, steps, ms, msg }].
export function pageTraverse(spec) {
  // strict mode also weakens the player a little (run 6% slower, jump 1.5% lower: about 4 px less height and 0.4 tile less carry)
  // so a route that needs a pixel-exact jump fails: a first-time player is not a bot.
  const M0 = Object.assign({}, G.C.MOVE);
  if (spec.strict) { G.C.MOVE.RUN = M0.RUN * 0.94; G.C.MOVE.JUMP_V = M0.JUMP_V * 0.985; }
  try {   // spec.nodeId: run on that real graph node instead of a throwaway one (tools/checks/walk.mjs)
  const D = G.debug, C = G.C, T = C.T, def = G.roomDefs[spec.id];
  const results = [];
  const nid = spec.nodeId || 'qa_' + spec.id, marks = def.marks, base = def.rows - C.CH, cols = def.cols, rows = def.rows;
  const region = G.regionDefs[def.region] ? def.region : 'r1';
  const mpos = m => ({ x: m.c * T + T / 2, y: (m.r + 1) * T });
  const P = () => G.players[0];
  if (!spec.nodeId) G.run.graph.nodes[nid] = { id: nid, def: spec.id, region, exits: {}, content: marks.map(m => m.ch === 'X' ? { type: 'crack', data: {} } : { type: 'start' }), seen: true, parent: null };

  // --- jobs
  const jobs = [];
  const doorIdx = marks.findIndex(m => m.ch === 'D');
  if (def.kind === 'main') {
    const route = def.route || ['left', 'right'], a = route[0], b = route[1];
    jobs.push({ name: a + ' to ' + b, entry: { side: a }, goal: { type: 'edge', side: b } });
    jobs.push({ name: b + ' to ' + a, entry: { side: b }, goal: { type: 'edge', side: a } });
    if (spec.strict) marks.forEach((m, i) => {
      if (!'DC'.includes(m.ch)) return;
      jobs.push({ name: a + ' to ' + m.ch + ' (col ' + m.c + ', row ' + m.r + ')', entry: { side: a }, goal: { type: 'mark', i } });
      jobs.push({ name: b + ' to ' + m.ch + ' (col ' + m.c + ', row ' + m.r + ')', entry: { side: b }, goal: { type: 'mark', i } });
    });
  } else if (def.kind === 'arena') {
    jobs.push({ name: 'entrance to boss door', entry: { side: 'left' }, goal: { type: 'door' } });
  } else if (def.kind === 'branch' || def.kind === 'trial') {
    if (doorIdx >= 0) marks.forEach((m, i) => {
      if (!'ICRSKMH'.includes(m.ch)) return;
      const nm = m.ch + ' (col ' + m.c + ', row ' + m.r + ')';
      jobs.push({ name: 'doorway to ' + nm, entry: { mark: doorIdx }, goal: { type: 'mark', i } });
      jobs.push({ name: nm + ' to doorway', entry: { mark: i }, goal: { type: 'mark', i: doorIdx } });
    });
  }

  // --- goal test and distance field (tile BFS that ignores jump limits: only a heuristic to point the search the right way)
  const goalTiles = g => {
    const out = [];
    if (g.type === 'edge') {
      if (g.side === 'left' || g.side === 'right') for (const y of [12, 13, 14]) out.push([g.side === 'left' ? 0 : cols - 1, base + y]);
      else { const p = def.ports[g.side], y = g.side === 'top' ? 0 : rows - 1; if (p) for (let c = Math.max(0, p.c - 1); c <= Math.min(cols - 1, p.c + 1); c++) out.push([c, y]); }
    }
    else if (g.type === 'door') for (const y of [12, 13, 14]) out.push([def.doorCol + 3, base + y]);
    else out.push([marks[g.i].c, marks[g.i].r]);
    return out;
  };
  const isWin = (p, g) => {
    if (g.type === 'edge') {
      if (g.side === 'left') return p.x <= 11.6;
      if (g.side === 'right') return p.x >= cols * T - 11.6;
      if (g.side === 'top') return p.y - p.h <= 12;
      return p.y >= rows * T - 12;
    }
    if (g.type === 'door') return p.x > (def.doorCol + 2.6) * T && p.onGround;
    const m = marks[g.i], t = mpos(m);
    return p.onGround && Math.abs(p.x - t.x) < (spec.strict ? 72 : 24) && Math.abs(p.y - t.y) < 10;   // strict: on the same ledge, within two tiles of the mark
  };
  const field = g => {
    const dist = new Float64Array(cols * rows).fill(Infinity), qu = [];
    const open = (c, y) => c >= 0 && c < cols && y >= 0 && y < rows && !'#sm<>cjv^'.includes(def.grid[y][c]);
    for (const [c, y] of goalTiles(g)) if (open(c, y)) { dist[y * cols + c] = 0; qu.push(c, y); }
    for (let i = 0; i < qu.length; i += 2) {
      const c = qu[i], y = qu[i + 1], d = dist[y * cols + c];
      for (const [dc, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, ny = y + dy;
        if (open(nc, ny) && dist[ny * cols + nc] === Infinity) { dist[ny * cols + nc] = d + 1; qu.push(nc, ny); }
      }
    }
    return dist;
  };

  // --- state snapshot and restore. Dynamic terrain (crumble/vent timing) is part of search state too.
  const KEYS = Object.keys(P()).filter(k => typeof P()[k] === 'number' || typeof P()[k] === 'boolean');
  const snap = () => {
    const p = P(), o = {};
    for (const k of KEYS) o[k] = p[k];
    o.slash = p.slash ? JSON.parse(JSON.stringify(p.slash)) : null;
    o.held = Object.assign({}, p.in.held); o.forced = Object.assign({}, p.in.forced);
    o.time = G.time; o.runTime = G.run.time;
    o.terrain = JSON.parse(JSON.stringify((G.rooms.current && G.rooms.current.terrain) || { crumble: {} }));
    return o;
  };
  const restore = o => {
    const p = P();
    for (const k of KEYS) p[k] = o[k];
    p.slash = o.slash ? JSON.parse(JSON.stringify(o.slash)) : null;
    G.time = o.time; G.run.time = o.runTime;
    if (G.rooms.current) {
      G.rooms.current.terrain = JSON.parse(JSON.stringify(o.terrain));
      G.tiles.terrain = G.rooms.current.terrain;
    }
    for (const a in p.in.pressed) p.in.pressed[a] = false;
    for (const a in p.in.forced) delete p.in.forced[a];
    Object.assign(p.in.forced, o.forced); Object.assign(p.in.held, o.held);
  };

  const L = spec.seg || 8, W = spec.beam || 36, abil = spec.strict ? [] : (spec.abil || []);   // strict: run and jump only (no slash, bounce or dash)
  const setAbil = () => { for (const a in G.run.abil) G.run.abil[a] = abil.includes(a); };
  const act = (dir, jump, ex) => ({ dir, jump, ex });                 // ex: 0 none, 1 down slash, 2 dash
  const apply = a => D.setInput(0, { left: a.dir < 0, right: a.dir > 0, jump: !!a.jump, down: a.ex === 1, attack: a.ex === 1, dash: a.ex === 2 });
  const actionsFor = onGround => {
    const out = [];
    for (const dir of [1, -1, 0]) for (const jump of [0, 1]) {
      out.push(act(dir, jump, 0));
      if (!onGround && !spec.strict) out.push(act(dir, jump, 1));
      if (abil.includes('dash') && dir && !spec.strict) out.push(act(dir, jump, 2));
    }
    return out;
  };

  const fresh = job => {
    // Timed terrain must begin every search branch family and replay at the same phase.
    // Otherwise a valid route found on one steam-vent cycle may fail when replayed on another.
    if (job._qaTime === undefined) { job._qaTime = G.time; job._qaRunTime = G.run.time; }
    D.setInput(0, { left: false, right: false, jump: false, down: false, attack: false, dash: false });
    D.gotoRoom(nid, job.entry);
    G.time = job._qaTime; G.run.time = job._qaRunTime;
    setAbil();
    const p = P(); p.hp = p.maxHp; p.down = false; p.inv = 0; p.stun = 0; p.dashCd = 0; p._ventCd = 0;
    G.run.rooms[nid].enemies.length = 0;
    G.run.rooms[nid].terrain = { crumble: {} }; G.tiles.terrain = G.run.rooms[nid].terrain;
    // Heavy Cut is modelled as "can break cracked barriers" (the bot has no heavy slash; the unlocks check drives a real one)
    if (abil.includes('heavy')) for (const pr of G.run.rooms[nid].props) if (pr.type === 'crack') G.props.TYPES.crack.hit(pr, true);
  };
  // run one segment; returns 'win' | 'dead' | 'ok'
  const runSeg = (a, job, hp0) => {
    apply(a);
    for (let i = 0; i < L; i++) {
      D.step(1);
      const p = P();
      if (p.hp < hp0 || p.down || (spec.strict && p.slash)) return 'dead';      // strict: a slash (so a bounce) is never allowed
      if (isWin(p, job.goal)) return 'win';
    }
    return 'ok';
  };

  // --- deterministic RNG
  let seed = 2166136261; for (const ch of spec.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rng = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const hint = (p, job, dist) => {
    // describe what lies ahead of the best state
    const fc = Math.floor(p.x / T), fr = Math.floor((p.y - 1) / T);
    let dir = 0, bd = dist[fr * cols + fc];
    for (const d of [-1, 1]) for (let k = 1; k <= 6; k++) { const nc = fc + d * k; if (nc < 0 || nc >= cols) break; const dd = dist[fr * cols + nc]; if (dd < bd) { bd = dd; dir = d; } }
    if (!dir) { const g = goalTiles(job.goal)[0]; dir = g[0] >= fc ? 1 : -1; }
    const at = (c, y) => (c < 0 || c >= cols || y < 0 || y >= rows) ? '#' : def.grid[y][c];
    for (let k = 1; k < 20; k++) {
      const c = fc + dir * k;
      if (c < 0 || c >= cols) break;
      if ('#sm<>cjv'.includes(at(c, fr)) || '#sm<>cjv'.includes(at(c, fr - 1))) {
        let top = fr; while ('#sm<>cjv'.includes(at(c, top - 1)) && top > 0) top--;
        let flr = fr; while (flr < rows && !'#sm<>cjv'.includes(at(fc, flr)) && at(fc, flr) !== '=') flr++;      // floor under the player
        const hgt = Math.max(1, flr - top);
        return 'a wall ' + hgt + ' tile' + (hgt > 1 ? 's' : '') + ' high at column ' + c + ' blocks the way ' + (dir > 0 ? 'right' : 'left') + ' (a base jump rises about 4 tiles)';
      }
      let floor = false; for (let y = fr + 1; y <= fr + 3; y++) if ('#sm<>cjv'.includes(at(c, y)) || at(c, y) === '=') { floor = true; break; }
      if (!floor) {
        let wdt = 0; while (true) { const cc = c + dir * wdt; let f = false; for (let y = fr + 1; y <= fr + 3; y++) if ('#sm<>cjv'.includes(at(cc, y)) || at(cc, y) === '=') { f = true; break; } if (f || cc < 0 || cc >= cols) break; wdt++; if (wdt > 40) break; }
        return 'a gap or pit ' + wdt + ' tile' + (wdt > 1 ? 's' : '') + ' wide starts at column ' + c + ' (a base jump carries about 6)';
      }
    }
    return 'no obvious wall or gap ahead; the route may need a platform that is too high or too far';
  };

  for (const job of jobs) {
    if (spec.only && !job.name.includes(spec.only)) continue;
    const t0 = performance.now(); let used = 0;
    const res = { name: job.name, ok: false, steps: 0, ms: 0, msg: '' };
    const dist = field(job.goal);
    const goalPoint = j => { const g = goalTiles(j.goal)[0] || [Math.floor(cols / 2), Math.floor(rows / 2)]; return { x: g[0] * T + T / 2, y: g[1] * T + T / 2 }; };
    const sc = p => { const c = Math.max(0, Math.min(cols - 1, Math.floor(p.x / T))), y = Math.max(0, Math.min(rows - 1, Math.floor((p.y - 16) / T))); const d = dist[y * cols + c], gp = goalPoint(job); return (d === Infinity ? 1e6 : d * 1000) + Math.hypot(p.x - gp.x, p.cy - gp.y) * 0.5; };
    const goalX = j => goalPoint(j).x;
    fresh(job);
    const startDist = dist[Math.floor((P().y - 16) / T) * cols + Math.floor(P().x / T)];
    if (startDist === Infinity) { res.msg = 'the goal cannot be reached even by walking through open air: it is walled off or the start is enclosed'; res.ms = performance.now() - t0; results.push(res); continue; }
    const root = { snap: snap(), parent: null, act: null, d: sc(P()) };
    let best = root, found = null;
    const seqOf = n => { const s = []; for (; n.parent; n = n.parent) s.unshift(n.act); return s; };

    // 1. cheap pass: walk toward the goal, jump at walls and gaps (several jump lengths)
    for (const hold of [6, 3, 9, 1]) {
      if (found) break;
      fresh(job); const seq = []; let jt = 0, hp0 = P().hp, st = 'ok';
      for (let i = 0; i < 140 && st === 'ok'; i++) {
        const p = P(), gx = goalX(job), dir = Math.abs(p.x - gx) < 10 ? 0 : (gx > p.x ? 1 : -1);
        D.setInput(0, { left: dir < 0, right: dir > 0 });
        const pr = D.probe(0);
        let jump = 0;
        if (jt > 0) { jump = 1; jt--; } else if (jt === 0 && pr.onGround && (pr.wall || pr.gap) && dir) { jt = hold - 1; jump = 1; }
        else if (jt === 0 && !pr.onGround) jump = 0;
        if (jt === 0 && jump === 0) jt = -1;                   // one released segment so the next jump is a fresh press
        else if (jt < 0) jt = 0;
        const a = act(dir, jump, 0); seq.push(a); st = runSeg(a, job, hp0); used += L;
      }
      if (st === 'win') found = seq;
    }

    // 1b. with Dash: a scripted opening (run n0 segments, jump n1, wait n2, dash once, run on). The beam search's distance heuristic crowds out
    // the one narrow flight that works (the greedy jumps that hug the far wall score better), so this pass tries the family directly.
    if (!found && abil.includes('dash')) {
      const dir = goalX(job) > P().x ? 1 : -1;
      for (let n0 = 0; n0 <= 16 && !found; n0++) for (let n1 = 3; n1 <= 7 && !found; n1++) for (let n2 = 0; n2 <= 5 && !found; n2++) {
        fresh(job); const seq = [], hp0 = P().hp; let st = 'ok';
        const push = (a, n) => { for (let i = 0; i < n && st === 'ok'; i++) { seq.push(a); st = runSeg(a, job, hp0); used += L; } };
        push(act(dir, 0, 0), n0); push(act(dir, 1, 0), n1); push(act(dir, 0, 0), n2); push(act(dir, 0, 2), 1); push(act(dir, 0, 0), 45);
        if (st === 'win') found = seq;
      }
    }

    // 2. randomized beam search over segments
    if (!found) {
      fresh(job);
      const seen = new Set(), keyOf = (p, a) => [Math.round(p.x / 5), Math.round(p.y / 5), p.onGround ? 1 : 0, Math.sign(Math.round(p.vy / 150)), Math.round(p.vx / 120), p.canDouble ? 1 : 0, p.canDash ? 1 : 0, p.sliding ? 1 : 0, p.slash ? 1 : 0, a.jump].join(',');
      let beam = [root], layers = 0;
      while (!found && used < spec.budget && beam.length && layers++ < 600) {
        const cand = [];
        for (const s of beam) {
          for (const a of actionsFor(s.snap.onGround)) {
            restore(s.snap); const hp0 = P().hp;
            const st = runSeg(a, job, hp0); used += L;
            if (st === 'dead') continue;
            if (st === 'win') { found = seqOf(s).concat([a]); break; }
            const key = keyOf(P(), a);
            if (seen.has(key)) continue;
            seen.add(key);
            const n = { snap: snap(), parent: s, act: a, d: sc(P()) };
            cand.push(n);
            if (n.d < best.d) best = n;
          }
          if (found) break;
        }
        cand.sort((x, y) => x.d - y.d);
        const top = cand.slice(0, W >> 1), rest = cand.slice(W >> 1);
        for (let i = 0; i < (W >> 1) && rest.length; i++) top.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
        beam = top;
      }
    }

    // 3. prove it: replay the winning inputs from a fresh start in the real engine
    if (found) {
      fresh(job); const hp0 = P().hp; let st = 'ok';
      for (const a of found) { st = runSeg(a, job, hp0); if (st !== 'ok') break; }
      if (st === 'win') { res.ok = true; res.steps = found.length * L; res.bounce = found.some(a => a.ex === 1); }
      else res.msg = 'found a path but the replay did not reproduce it (' + st + '); report this to the QA tools engineer';
    }
    if (!res.ok && !res.msg) {
      restore(best.snap);
      const p = P();
      const left = best.d >= 1e6 ? '?' : Math.floor(best.d / 1000);
      res.msg = 'stuck near tile (col ' + Math.floor(p.x / T) + ', row ' + Math.floor((p.y - 1) / T) + '), x ' + Math.round(p.x) + ' y ' + Math.round(p.y) + ', about ' + left + ' tiles of path left to the goal (started ' + startDist + '); ' + hint(p, job, dist) + '. Tried ' + Math.round(used / L) + ' input segments with: ' + (abil.length ? abil.join(', ') : 'base moves only') + '.';
    }
    res.ms = performance.now() - t0; results.push(res);
  }
  if (!spec.nodeId) { delete G.run.graph.nodes[nid]; delete G.run.rooms[nid]; }
  D.setInput(0, { left: false, right: false, jump: false, down: false, attack: false, dash: false });
  return results;
  } finally { Object.assign(G.C.MOVE, M0); }
}

// ---------------------------------------------------------------- driver (used by the smoke check and by tools/roomlint.mjs)
// opts: { filter: id substring, walk: bool (default true), strict: bool (main rooms: run and jump only, plus every D and C reachable), budget, seg, beam, log(line) }
export async function runRooms(page, opts = {}) {
  const filter = opts.filter || '', walk = opts.walk !== false, budget = opts.budget || 800000;
  const info = await page.evaluate(() => {
    if (!G.run || !G.run.graph) G.debug.newRun(1);
    return { abil: Object.keys(G.abilityDefs), rooms: Object.values(G.roomDefs).map(r => ({ id: r.id, kind: r.kind, region: r.region, w: r.w, h: r.h, map: r.map, route: r.route, needs: r.needs, signs: r.signs, label: r.label })) };
  });
  const errTexts = await page.evaluate(() => G.errors.slice());
  const out = [];
  const todo = info.rooms.filter(r => r.id.includes(filter));
  // content mistakes that G.defineRoom refused (the room never got registered) show up in G.errors only
  const known = new Set(info.rooms.map(r => r.id));
  const orphan = {};
  for (const e of errTexts) { const m = /^room (\S+): (.*)$/.exec(e); if (m && !known.has(m[1]) && m[1].includes(filter)) (orphan[m[1]] = orphan[m[1]] || []).push(m[2]); }
  for (const id of Object.keys(orphan)) { const o = { id, kind: '?', lint: orphan[id].map(m => 'G.defineRoom rejected it: ' + m), warn: [], jobs: [], ms: 0 }; out.push(o); if (opts.log) opts.log(o); }
  for (const r of todo) {
    const t0 = Date.now(), { err, warn } = lintRoom(r, info.abil);
    const res = { id: r.id, kind: r.kind, lint: err, warn, jobs: [], ms: 0 };
    if (walk && !err.length && r.kind !== 'hub') {
      const spec = { id: r.id, abil: r.kind === 'branch' ? (r.needs || []) : [], budget, seg: opts.seg, beam: opts.beam, strict: !!opts.strict && r.kind === 'main' };
      res.jobs = await page.evaluate(pageTraverse, spec);
      // the other direction of the rule: a guarded room's plinth must be UNREACHABLE without its ability (nothing but base moves)
      if (r.kind === 'branch' && (r.needs || []).length) {
        res.negative = await page.evaluate(pageTraverse, Object.assign({}, spec, { abil: [], budget: Math.min(budget, 250000), only: 'doorway to I' }));
        res.negative = res.negative.filter(j => j.name.startsWith('doorway to I'));
        res.negFail = res.negative.length ? res.negative.filter(j => j.ok).map(j => j.name + ' was reached with base moves only') : ['no plinth job ran'];
      }
      // the beam search can be trapped by its distance heuristic (a ledge directly under the goal): retry a failed job once with a 3x wider beam
      for (let i = 0; i < res.jobs.length; i++) if (!res.jobs[i].ok) {
        const again = await page.evaluate(pageTraverse, Object.assign({}, spec, { only: res.jobs[i].name, beam: (opts.beam || 36) * 3 }));
        if (again[0] && again[0].ok) res.jobs[i] = again[0];
      }
    }
    res.ms = Date.now() - t0;
    out.push(res);
    if (opts.log) opts.log(res);
  }
  return out;
}

export const okRoom = r => !r.lint.length && r.jobs.every(j => j.ok) && !(r.negFail && r.negFail.length);
export function formatRoom(r) {
  const head = (okRoom(r) ? 'PASS ' : 'FAIL ') + r.id.padEnd(18) + r.kind.padEnd(7);
  const parts = r.jobs.length ? r.jobs.map(j => (j.ok ? 'ok ' : 'FAILED ') + j.name + (j.ok ? ' ' + j.ms.toFixed(0) + 'ms' + (j.bounce ? ' (uses a down-slash bounce)' : '') : '')).join('; ') : (r.lint.length ? '' : (r.kind === 'hub' ? 'lint only' : 'lint only'));
  let s = head + (r.lint.length ? 'lint: ' + r.lint.length + ' error' + (r.lint.length > 1 ? 's' : '') : 'lint ok') + (r.warn.length ? ' (' + r.warn.length + ' warning' + (r.warn.length > 1 ? 's' : '') + ')' : '') + (parts ? '  |  ' + parts : '') + '  ' + (r.ms / 1000).toFixed(2) + ' s';
  for (const m of r.lint) s += '\n      lint error: ' + m;
  for (const m of r.warn) s += '\n      warning: ' + m;
  for (const j of r.jobs) if (!j.ok) s += '\n      ' + j.name + ': ' + j.msg;
  if (r.negative) s += '\n      without ' + (r.needsText || 'its ability') + ': ' + (r.negFail.length ? 'FAILED: ' + r.negFail.join('; ') : 'plinth unreachable, as it should be (' + r.negative.map(j => j.ms.toFixed(0) + ' ms').join(', ') + ')');
  return s;
}

export default async ({ page }) => {
  const t0 = Date.now();
  const res = await runRooms(page, { strict: true });
  const bad = res.filter(r => !okRoom(r));
  if (bad.length) throw new Error(bad.length + ' of ' + res.length + ' rooms fail:\n' + bad.map(formatRoom).join('\n'));
  const jobs = res.reduce((n, r) => n + r.jobs.length, 0);
  return res.length + ' rooms linted, ' + jobs + ' traversals in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s';
};
