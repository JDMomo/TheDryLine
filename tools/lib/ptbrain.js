/* The playtest bot's brain (browser side; loaded into the page by tools/playtest.mjs, never shipped).
   It plays like a newcomer: it only decides WHAT TO PRESS. The page never receives an input except through real keyboard events sent by the
   playtester (Playwright keyboard), so every press goes through js/core/input.js like a person's would.
   What it reads: G.debug.state() (room, props, enemies, players, run), the tile grid (G.tiles), hostile shots (G.shots) and the boss object.
   What it never does: call G.debug.newRun / gotoRoom / give / place / setInput / step / god, or write to any game object.
   (assist mode is the one exception and is set by the playtester, see tools/playtest.mjs: it only stops hits from taking pips.)
   PT.tick() -> { keys: [action names held now], ... } or null when no game time has passed. PT.log holds everything the report needs. */
window.PT = (() => {
  'use strict';
  const G = window.G, C = G.C, T = C.T, M = C.MOVE, U = G.util;
  const PT = { opt: { seed: 1, ignoreChart: false }, taps: {}, lastT: -1, log: null, K: null };
  const rnd = (() => { let s = 12345; return { seed(n) { s = (n * 2654435761 + 97) >>> 0; }, f() { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; } }; })();
  PT.rnd = rnd;
  const P0 = () => G.players[0];
  const RUN = M.RUN;
  const cutOf = id => (G.itemDefs[id] || {}).cls;

  // ------------------------------------------------------------------------------------------------ log
  const fresh = () => ({
    t0: G.time, events: [], decisions: [], rooms: [], fights: [], hits: [], deaths: [], stuck: [], tokens: [], shots: [], spend: [], notes: [],
    chartMatches: [], punchTries: [], castLog: [], says: [], tips: [], trans: [], shots2: [], mends: 0, standpipes: 0, doors: 0, jumps: 0, slashes: 0, casts: 0
  });
  PT._buildNav = () => buildNav();
  PT.reset = opt => { Object.assign(PT.opt, opt || {}); rnd.seed(PT.opt.seed); PT.log = fresh(); PT.K = { rooms: {}, nav: {}, prog: null, ban: {}, aimDb: {}, boss: {}, lastRoom: null, visitedDoors: {}, regionOrder: null, cycleT: 0, fightMem: null, noTarget: 0 }; PT.taps = {}; };
  const ev = (kind, o) => { const L = PT.log; if (L.events.length < 4000) L.events.push(Object.assign({ t: +(G.run ? G.run.time : G.time).toFixed(1), kind }, o)); };
  PT.ev = ev;

  // ------------------------------------------------------------------------------------------------ navigation: a graph of standing places
  const nodeKey = (c, r) => c + ',' + r;
  function sim(b, vx, vy, o) {              // one jump or fall with the engine's tile rules; o: { dir, hold, air, drop }; returns { x, y, t, exit } or null
    const tl = G.tiles, W = tl.cols * T; let t = 0, held = o.hold > 0, dropT = o.drop ? 0.18 : 0;
    for (let i = 0; i < 360; i++) {
      const dt = C.STEP; t += dt;
      const target = t < o.air ? o.dir * RUN : 0;
      vx = U.approach(vx, target, M.AACC * dt);
      if (held && t >= o.hold) { held = false; if (vy < 0) vy *= M.CUT; }
      vy = Math.min(vy + M.GRAV * dt * (held && Math.abs(vy) < 100 ? 0.5 : 1), M.MAXFALL);
      b.dropThru = dropT > 0; dropT -= dt;
      const r = tl.moveBox(b, vx * dt, vy * dt);
      if (r.hx) vx = 0;
      if (r.hy === -1) vy = 0;
      if (b.x < -6) return { exit: 'XL', x: b.x, y: b.y, t };
      if (b.x > W + 6) return { exit: 'XR', x: b.x, y: b.y, t };
      if (b.y - b.h < -8) return { exit: 'XT', x: b.x, y: b.y, t };
      if (b.y > tl.rows * T + 8) return { exit: 'XB', x: b.x, y: b.y, t };
      const sr0 = Math.floor((b.y - b.h) / T), sr1 = Math.floor((b.y - 1) / T);
      for (let c = Math.floor((b.x - b.w / 2) / T); c <= Math.floor((b.x + b.w / 2) / T); c++) for (let rr = sr0; rr <= sr1; rr++) if (tl.spike(c, rr) && b.y > rr * T + 12) return null;
      if (r.hy === 1) return { x: b.x, y: b.y, t, vx };
      if (b.y > tl.rows * T + 40) return null;
    }
    return null;
  }
  function buildNav() {
    const tl = G.tiles, cols = tl.cols, rows = tl.rows, p = P0(), abil = G.run.abil;
    const valid = (c, r) => c >= 0 && c < cols && r >= 2 && r < rows && tl.floorAt(c, r) && !tl.spike(c, r) && !tl.solid(c, r - 1) && !tl.solid(c, r - 2) && !tl.spike(c, r - 1) && !tl.spike(c, r - 2);
    const nodes = new Map();
    for (let r = 2; r < rows; r++) for (let c = 0; c < cols; c++) if (valid(c, r)) nodes.set(nodeKey(c, r), { c, r, x: c * T + T / 2, y: r * T, edges: [] });
    const land = (x, y) => nodes.get(nodeKey(Math.floor(x / T), Math.round(y / T)));
    const HOLDS = [0.07, 0.12, 0.18, 0.26, 0.4], AIRS = [99, 0.5, 0.32, 0.2];
    for (const n of nodes.values()) {
      const best = new Map();
      const add = (to, e) => { const k = typeof to === 'string' ? to : to.c + ',' + to.r; const old = best.get(k); if (!old || e.cost < old.cost) best.set(k, Object.assign(e, { to })); };
      for (const d of [-1, 1]) {
        const m = nodes.get(nodeKey(n.c + d, n.r)); if (m) add(m, { kind: 'walk', dir: d, cost: 0.12 });
        if ((n.c === 0 && d < 0) || (n.c === cols - 1 && d > 0)) add(d < 0 ? 'XL' : 'XR', { kind: 'walk', dir: d, cost: 0.12 });
      }
      // walking off an edge
      for (const d of [-1, 1]) for (const air of [99, 0.15, 0]) {
        if (nodes.has(nodeKey(n.c + d, n.r))) continue;
        const b = { x: n.x + d * 14, y: n.y, w: p.w, h: p.h, dropThru: false };
        if (!tl.floorAt(Math.floor(b.x / T), n.r)) { /* already off the floor */ }
        const s = sim(b, d * RUN, 0, { dir: d, hold: 0, air });
        if (!s) continue;
        if (s.exit) { add(s.exit, { kind: 'fall', dir: d, air, cost: 0.5 + s.t }); continue; }
        const to = land(s.x, s.y); if (to && to !== n) add(to, { kind: 'fall', dir: d, air, cost: 0.4 + s.t + 0.3 });
      }
      // jumps
      for (const d of [-1, 0, 1]) for (const hold of HOLDS) for (const air of (d ? AIRS : [99])) {
        const mv = { x: n.x, y: n.y, w: p.w, h: p.h, dropThru: false }; tl.moveBox(mv, d * 12, 0);
        const off = mv.x - n.x, b = { x: n.x + off, y: n.y, w: p.w, h: p.h, dropThru: false };
        const s = sim(b, d * RUN, -M.JUMP_V, { dir: d, hold, air });
        if (!s) continue;
        if (s.exit) { add(s.exit, { kind: 'jump', dir: d, hold, air, takeX: n.x + off, cost: 0.9 + s.t }); continue; }
        const to = land(s.x, s.y); if (to && to !== n) add(to, { kind: 'jump', dir: d, hold, air, takeX: n.x + off, cost: 0.9 + s.t + hold });
      }
      // dropping through a one-way platform
      if (!tl.solid(n.c, n.r) && tl.oneway(n.c, n.r)) {
        const b = { x: n.x, y: n.y + 1, w: p.w, h: p.h, dropThru: true };
        const s = sim(b, 0, 0, { dir: 0, hold: 0, air: 0, drop: true });
        if (s && !s.exit) { const to = land(s.x, s.y); if (to && to !== n) add(to, { kind: 'drop', cost: 0.6 + s.t }); }
      }
      n.edges = [...best.values()];
    }
    return { nodes, cols, rows, key: G.rooms.current.id };
  }
  function nav() {
    const id = G.rooms.current.id, sig = id + (G.run.abil.double ? 'd' : '');
    if (!PT.K.nav[sig]) { PT.K.nav = {}; PT.K.nav[sig] = buildNav(); }
    return PT.K.nav[sig];
  }
  // Dijkstra from a node to any goal node ('XL' / 'XR' count as nodes). Edges banned in this room (they failed repeatedly) are skipped.
  function path(from, isGoal) {
    const N = nav(), ban = PT.K.ban[N.key] || (PT.K.ban[N.key] = {});
    const pens = G.rooms.current.enemies.filter(e => !e.dead && e.def.touch && !e.def.ceiling).map(e => ({ x: e.x, y: e.y }));
    const tlp = G.tiles;
    const pen = n => { let c = 0; if (typeof n === 'string') return 0; for (const dc of [-2, -1, 1, 2]) if (tlp.spike(n.c + dc, n.r)) c += Math.abs(dc) === 1 ? 4 : 1.5; const ch = tlp.at(n.c, n.r); c += ch === 'j' ? 40 : ch === 'c' ? 25 : ch === 'v' ? 20 : ch === 't' ? 3 : ch === 'm' || ch === 's' ? 1.5 : ch === '<' || ch === '>' ? 2 : 0; for (const q of pens) if (Math.abs(n.x - q.x) < 64 && Math.abs(n.y - q.y) < 70) c += 10; return c; };
    const dist = new Map([[nodeKey(from.c, from.r), 0]]), prev = new Map(), open = [[0, from]], done = new Set();
    const keyOf = n => typeof n === 'string' ? n : nodeKey(n.c, n.r);
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]); const [d, n] = open.shift(); const k = keyOf(n);
      if (done.has(k)) continue; done.add(k);
      if (isGoal(n)) { const out = []; let cur = k; while (prev.has(cur)) { const [pk, e] = prev.get(cur); out.unshift(Object.assign({ from: pk }, e)); cur = pk; } return out; }
      if (typeof n === 'string') continue;
      for (const e of n.edges) {
        const ek = k + '>' + (typeof e.to === 'string' ? e.to : nodeKey(e.to.c, e.to.r)) + e.kind;
        if (ban[ek] >= 3) continue;
        const nd = d + e.cost + (ban[ek] || 0) * 2 + pen(e.to), tk = keyOf(e.to);
        if (nd < (dist.has(tk) ? dist.get(tk) : Infinity)) { dist.set(tk, nd); prev.set(tk, [k, Object.assign({}, e, { ek })]); open.push([nd, e.to]); }
      }
    }
    return null;
  }
  const nodeAt = (x, y) => { const N = nav(); return N.nodes.get(nodeKey(Math.floor(x / T), Math.round(y / T))); };
  const nearestNode = (x, y, maxD = 3) => {
    const N = nav(), c0 = Math.floor(x / T), r0 = Math.round(y / T); let best = null, bd = 1e9;
    for (let dr = -maxD; dr <= maxD; dr++) for (let dc = -maxD; dc <= maxD; dc++) { const n = N.nodes.get(nodeKey(c0 + dc, r0 + dr)); if (n) { const d = Math.abs(dc) + Math.abs(dr) * 1.5; if (d < bd) { bd = d; best = n; } } }
    return best;
  };

  // ------------------------------------------------------------------------------------------------ keys
  const holds = new Set();
  const tap = (k, dur = 0.07) => { PT.taps[k] = G.time + dur; holds.add(k); };
  const hold = k => holds.add(k);

  // ------------------------------------------------------------------------------------------------ executing a path
  // Follows the first edge of a path with real presses. Returns a short reason string when it cannot (no path, in the air, ...).
  function follow(goalFn, label) {
    const p = P0(), prog = PT.K.prog;
    if (prog) {                                   // an edge in progress: keep its keys until we land
      const age = G.time - prog.t0;
      if (prog.kind === 'jump' || prog.kind === 'fall' || prog.kind === 'drop') {
        if (prog.kind === 'drop') hold('down');
        if (age < prog.hold) hold('jump');
        const rising = p.vy < -60 && !p.onGround;
        if (prog.expect && !rising && age > 0.1 && !p.onGround) { const dx = prog.expect.x - p.x; if (Math.abs(dx) > 8) hold(dx < 0 ? 'left' : 'right'); }        // in the air, steer onto the landing
        else if (age < prog.air && prog.dir) hold(prog.dir < 0 ? 'left' : 'right');
        if (prog.kind === 'fall' && age < prog.air && p.onGround && age < 0.4) hold(prog.dir < 0 ? 'left' : 'right');
        if ((p.onGround && age > 0.12) || age > 2.2) {
          PT.K.prog = null;
          const at = nodeAt(p.x, p.y);
          if (prog.expect && at && (at.c !== prog.expect.c || at.r !== prog.expect.r)) { const N = nav(), ban = PT.K.ban[N.key] || (PT.K.ban[N.key] = {}); ban[prog.ek] = (ban[prog.ek] || 0) + 1; ev('edge_miss', { ek: prog.ek, at: at ? at.c + ',' + at.r : '?', x0: Math.round(prog.x0), vx0: Math.round(prog.vx0), x1: Math.round(p.x), take: Math.round(prog.take || 0), age: +age.toFixed(2) }); }
        }
        return 'prog';
      }
    }
    const N = nav();
    let from = nodeAt(p.x, p.y);
    if (!p.onGround || !from) {
      if (p.onGround) { from = nearestNode(p.x, p.y, 1); }
      if (!from) return p.onGround ? 'nonode' : 'air';
    }
    const pa = path(from, n => goalFn(n));
    if (!pa) return 'nopath';
    if (!pa.length) return 'there';
    const e = pa[0], tx = typeof e.to === 'string' ? null : e.to;
    const toX = tx ? tx.x : 0;
    const face = d => hold(d < 0 ? 'left' : 'right');
    if (e.kind === 'walk') {
      if (tx) { if (Math.abs(p.x - toX) > 3) face(toX - p.x); }
      else face(e.dir);
      return 'walk';
    }
    if (e.kind === 'drop') { PT.K.prog = { kind: 'drop', t0: G.time, hold: 0, air: 0, dir: 0, ek: e.ek, expect: tx }; hold('down'); tap('jump', 0.1); return 'drop'; }
    // jump or fall: get to the takeoff spot first
    const takeX = e.kind === 'jump' ? e.takeX : from.x + e.dir * 12;
    const dx = takeX - p.x;
    if (e.kind === 'jump') {
      let pastTake = e.dir > 0 ? p.x >= takeX - 3 : e.dir < 0 ? p.x <= takeX + 3 : Math.abs(dx) < 8;
      const K = PT.K; if (!K.app || Math.abs(K.app.x - p.x) > 2) K.app = { x: p.x, t: G.time }; else if (G.time - K.app.t > 0.5) pastTake = true;
      if (!pastTake || Math.abs(p.x - from.x) > 18) { face(dx); return 'approach'; }
      PT.K.prog = { kind: 'jump', t0: G.time, hold: tx && Math.abs(tx.x - p.x) >= 90 ? Math.max(e.hold * 1.4, 0.33) : e.hold, air: e.air, dir: e.dir, ek: e.ek, expect: tx, x0: p.x, vx0: p.vx, take: takeX }; hold('jump'); if (e.dir) hold(e.dir < 0 ? 'left' : 'right'); PT.log.jumps++; return 'jump';
    }
    // fall: walk off the edge
    PT.K.prog = { kind: 'fall', t0: G.time, hold: 0, air: e.air, dir: e.dir, ek: e.ek, expect: tx }; face(e.dir); return 'fall';
  }
  const goalAt = (x, y) => { const g = nearestNode(x, y, 2); return g ? (n => typeof n !== 'string' && n.c === g.c && n.r === g.r) : (() => false); };
  const EXITN = { left: 'XL', right: 'XR', top: 'XT', bottom: 'XB' };
  const goalExit = side => (n => n === EXITN[side]);
  const holdExit = side => { if (side === 'left') hold('left'); else if (side === 'right') hold('right'); };
  const fwdSide = () => { const rt = G.rooms.current.def.route; return rt ? rt[1] : 'right'; };

  // ------------------------------------------------------------------------------------------------ what a newcomer notices and remembers
  const onScreen = (x, y, m = 80) => x > G.cam.x - m && x < G.cam.x + C.W + m && y > G.cam.y - m && y < G.cam.y + C.H + m + 120;
  const roomK = id => PT.K.rooms[id] || (PT.K.rooms[id] = { props: {}, done: {}, enter: G.run.time, visits: 0, doorsTried: {}, hunted: 0 });
  function look(S) {
    const rk = roomK(S.room.id);
    S.room.props.forEach((pr, i) => { const k = pr.type + '@' + Math.round(pr.x); if (onScreen(pr.x, pr.y) || (S.room.kind === 'hub' && pr.type === 'gate')) rk.props[k] = Object.assign({}, pr, { k, seen: G.run.time }); else if (rk.props[k]) Object.assign(rk.props[k], pr, { k }); });
    for (const k of Object.keys(rk.props)) if (!S.room.props.some(pr => pr.type + '@' + Math.round(pr.x) === k)) delete rk.props[k];
    return rk;
  }
  const hasSlotsLeft = S => P0().items.length < P0().slots;
  const chartOf = region => (S0 => (S0.run.chart[region] || []))(PT.S);

  // ------------------------------------------------------------------------------------------------ danger: predicted contact over the next 0.5 s
  const prect = (x, y, p) => ({ x0: x - p.w / 2 + 2, x1: x + p.w / 2 - 2, y0: y - p.h + 2, y1: y });
  const ov = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  function threats() {
    const room = G.rooms.current, out = [], p = P0();
    for (const e of room.enemies) if (!e.dead && e.def.touch && !e.harmless) out.push({ kind: 'enemy', id: e.id, at: t => ({ x0: e.x + (e.vx || 0) * t - e.w / 2, x1: e.x + (e.vx || 0) * t + e.w / 2, y0: e.y + (e.def.gravity === false ? (e.vy || 0) * t : 0) - e.h, y1: e.y + (e.def.gravity === false ? (e.vy || 0) * t : 0) }), x: e.x, y: e.y, e });
    const b = room.boss;
    if (b && b.state !== 'sleep' && b.state !== 'dead') {
      const k = PT.K.boss, vx = k.t === G.time ? 0 : k.lx !== undefined ? (b.x - k.lx) / Math.max(0.001, G.time - k.t) : 0; k.lx = b.x; k.t = G.time;
      if (b.state !== 'stagger' && b.def.contact !== false) out.push({ kind: 'boss', id: b.id, at: t => { const r = b.rect(), dx = U.clamp(vx, -400, 400) * t; return { x0: r.x0 + dx, x1: r.x1 + dx, y0: r.y0 + 6, y1: r.y1 }; }, x: b.x, y: b.y, b });
    }
    for (const s of G.shots) if (s.hostile) {
      const gr = s.grav || 0;
      out.push({ kind: 'shot', src: s._src, at: t => { const x = s.x + s.vx * t, y = s.hug ? s.y : s.y + s.vy * t + 0.5 * gr * t * t; return s.rect ? { x0: x - s.rect.w / 2, x1: x + s.rect.w / 2, y0: y - s.rect.h, y1: y } : { x0: x - s.r, x1: x + s.r, y0: y - s.r, y1: y + s.r }; }, x: s.x, y: s.y });
    }
    for (const z of PT.zones || []) if (z.until > G.time) out.push({ kind: 'zone', at: () => z.rect, x: (z.rect.x0 + z.rect.x1) / 2, y: z.rect.y1, soft: true });
    return out;
  }
  function simCand(p, c, n, dtS) {
    const box = { x: p.x, y: p.y, w: p.w, h: p.h, dropThru: false }; let vx = p.vx, vy = p.vy, ground = p.onGround, jumped = false; const pts = [];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 5; k++) {
        const dt = 1 / 60;                                    // six looks of 1/12 s = 0.5 s, five 1/60 s sub-steps each
        if (c.jump && ground && !jumped) { vy = -M.JUMP_V; ground = false; jumped = true; }
        vx = U.approach(vx, c.dir * RUN, (ground ? M.GACC : M.AACC) * dt);
        vy = Math.min(vy + M.GRAV * dt, M.MAXFALL);
        const r = G.tiles.moveBox(box, vx * dt, vy * dt);
        if (r.hx) vx = 0; if (r.hy === 1) { ground = true; vy = 0; } else if (r.hy === -1) vy = 0; else ground = false;
      }
      pts.push({ x: box.x, y: box.y });
    }
    return pts;
  }
  const CANDS = [{ dir: 0, jump: 0 }, { dir: -1, jump: 0 }, { dir: 1, jump: 0 }, { dir: 0, jump: 1 }, { dir: -1, jump: 1 }, { dir: 1, jump: 1 }];
  // Choose a move that avoids what is about to hurt, leaning towards `want` ({ dir, x, spacing }).
  function dodge(th, want) {
    const p = P0(), N = 6;
    let best = null, bs = -1e9, base = 0;
    for (const c of CANDS) {
      const pts = simCand(p, c, N); let danger = 0;
      pts.forEach((q, i) => { const t = (i + 1) / 12, pr = prect(q.x, q.y, p); for (const h of th) { const r = h.at(t); if (r && ov(pr, { x0: r.x0 - 3, x1: r.x1 + 3, y0: r.y0 - 3, y1: r.y1 + 3 })) danger += (h.soft ? 0.25 : 1) * (1.4 - i / N * 0.6) * (p.inv > t ? 0.1 : 1); } });
      let goal = 0; const end = pts[pts.length - 1];
      if (want) {
        if (want.spacing !== undefined) goal -= Math.abs(Math.abs(end.x - want.x) - want.spacing) * 0.02 + (want.y !== undefined ? Math.abs(end.y - want.y) * 0.004 : 0);
        else if (want.dir) goal += (c.dir === want.dir ? 0.6 : c.dir === 0 ? 0 : -0.4);
      }
      if (c.jump) goal -= 0.1;
      const sc = -danger * 5 + goal; if (c === CANDS[0]) base = danger;
      if (sc > bs) { bs = sc; best = c; }
    }
    return { c: best, danger: base };
  }

  // ------------------------------------------------------------------------------------------------ fighting
  function slashBox(p, face, up) {
    if (up) return { x0: p.x - 30, x1: p.x + 30, y0: p.y - p.h - 58, y1: p.y - p.h + 8 };
    const a = p.x + face * 6, b = p.x + face * 74; return { x0: Math.min(a, b), x1: Math.max(a, b), y0: p.y - 50, y1: p.y - 4 };
  }
  function foes() {
    const room = G.rooms.current, out = [];
    for (const e of room.enemies) if (!e.dead) out.push({ x: e.x, y: e.y, w: e.w, h: e.h, id: e.id, rect: { x0: e.x - e.w / 2, x1: e.x + e.w / 2, y0: e.y - e.h, y1: e.y }, e, flying: e.def.flying || e.def.gravity === false, ceil: !!e.def.ceiling });
    const b = room.boss;
    if (b && b.state !== 'sleep' && b.state !== 'dead') out.push({ x: b.x, y: b.y, w: b.w, h: b.h, id: b.id, rect: b.rect(), boss: b });
    return out;
  }
  function pickFoe(p, list) {
    let best = null, bd = 1e9;
    for (const f of list) {
      if (f.ceil && f.e.state === 'hang') continue;
      const dx = Math.abs(f.x - p.x), dy = Math.abs((f.y - f.h / 2) - (p.y - p.h / 2));
      const d = dx + dy * 1.6; if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  // ---- tokens against fare slots: the bot learns each token's shot from the shots it sees itself fire (see the wrapper in install())
  const AIMS = ['neutral', 'fwd', 'up', 'down'];
  const aimOf = h => h.up ? 'up' : (h.right && P0().face > 0) || (h.left && P0().face < 0) ? 'fwd' : h.down ? 'down' : 'neutral';
  function predictShot(m, x0, y0, face, target, tr) {       // does a learned shot reach the slot? returns miss distance px (<= tr hits)
    let x = x0 + face * m.dx, y = y0 - m.dy, vx = face * m.vx, vy = m.vy, best = 1e9; const gr = m.grav || 0;
    const life = Math.min(m.life || 1.5, 3), step = 1 / 90;
    for (let t = 0; t < life; t += step) {
      x += vx * step; vy += gr * step; y += vy * step;
      const d = Math.hypot(x - target.x, y - target.y); if (d < best) best = d;
      if (m.hug) { y = y0; }
      if (G.tiles.solid(Math.floor(x / T), Math.floor(y / T))) { if (m.burst) best = Math.min(best, Math.hypot(x - target.x, y - target.y) - m.burst); break; }
    }
    if (m.burst) best = Math.min(best, Math.hypot(x - target.x, y - target.y) - m.burst);
    return best - tr;
  }
  function slotPlan(p, b) {
    // returns { sp, item, idx, aim, x } for the best open slot we hold a token for, or null
    const have = p.items.map((id, i) => ({ id, i, cls: cutOf(id) }));
    let best = null;
    for (const sp of b.spots) {
      if (!sp.open || sp.broken || !b.isExposed(sp)) continue;
      const h = have.find(t => t.cls === sp.cls); if (!h) continue;
      const q = b.spotPos(sp), tr = sp.def.r;
      const db = PT.K.aimDb[h.id] || {};
      let plan = null;
      for (const aim of AIMS) {
        const m = db[aim]; if (!m) continue;
        for (const face of [1, -1]) for (let dx = -420; dx <= 420; dx += 20) {
          const x = q.x + dx; if (x < b.minX - 40 || x > b.maxX + 40) continue;
          if ((x - q.x) * face > 0) continue;                         // the slot must be in front
          const miss = predictShot(m, x, b.floor, face, q, tr + (m.r || 5));
          if (miss <= 0) { const cost = Math.abs(x - p.x); if (!plan || cost < plan.cost) plan = { aim, x, face, cost }; }
        }
      }
      const unknown = AIMS.filter(a => !db[a]);
      const cand = { sp, item: h.id, idx: h.i, plan, unknown, q };
      if (!best || (plan && !best.plan)) best = cand;
    }
    return best;
  }

  // ------------------------------------------------------------------------------------------------ the mission: what to do in this room
  function trinketValue(id) {
    const d = G.trinketDefs[id]; if (!d) return 0; const mods = Object.assign({}, G.baseMods ? G.baseMods() : {}); try { d.apply(mods); } catch (e) { return 0; }
    return (mods.maxHp || 0) * 3 + (mods.dmg > 1 ? 1 : 0) + (d.mat && d.mat.length ? 0.5 : 0) + rnd.f() * 0.4;
  }
  function tokenWanted(S, id, rk) {            // chart-aware: is a token of this cut worth a slot for the next Warden(s)?
    const next = nextRegions(S); const cuts = new Set(); for (const r of next) for (const c of chartOf(r)) cuts.add(c);
    const cls = cutOf(id); return PT.opt.ignoreChart ? true : cuts.has(cls);
  }
  function nextRegions(S) {
    const order = ['r1', 'r2', 'r3', 'r4', 'final'], beaten = S.run.beaten; const left = order.filter(r => !beaten[r]);
    const tgt = PT.K.region && !beaten[PT.K.region] ? PT.K.region : left[0];
    return tgt ? [tgt] : [];
  }
  function chooseRegion(S) {
    const order = ['r1', 'r2', 'r3', 'r4'], beaten = S.run.beaten, left = order.filter(r => !beaten[r]);
    if (!left.length) return 'final';
    if (PT.opt.region && !S.run.beaten[PT.opt.region]) return PT.opt.region;
    if (PT.opt.ignoreChart) return left[0];
    const held = new Set(P0().items.map(cutOf)); let best = left[0], bs = chartOf(left[0]).filter(c => held.has(c)).length;
    for (const r of left) { const sc = chartOf(r).filter(c => held.has(c)).length; if (sc >= 3 && sc > bs) { bs = sc; best = r; } }
    return best;
  }
  const doorWanted = (S, d, rk) => {
    const dt = d.data || {}, needs = dt.needs || [];
    if (needs.some(n => !S.run.abil[n])) return false;
    if (dt.label === 'Way back' || /Back to the Junction/.test(dt.label || '')) return false;
    if (rk.doorsTried[Math.round(d.x)]) return false;
    if (PT.opt.explore) return true;
    if (/Trial/.test(dt.tag || '')) return true;
    const k = 'dw' + Math.round(d.x);
    if (rk.done[k] === undefined) { const hp = P0().hp / P0().maxHp, lowTok = P0().items.length < P0().slots, shards = S.run.shards; rk.done[k] = rnd.f() < (lowTok ? 0.85 : 0.55) + (shards > 45 ? 0.2 : 0) - (hp < 0.4 ? 0.3 : 0) ? 1 : 0; }
    return !!rk.done[k];
  };

  // Returns { x, y, act, why } or { exit: ±1 } or { hunt: true }.
  function mission(S, rk) {
    const p = P0(), room = S.room, run = S.run, props = Object.values(rk.props).filter(x => !x.gone && !(rk.tries && rk.tries[x.k] > 6));
    const hp = p.hp, maxHp = p.maxHp, kind = room.kind, shards = run.shards;
    const near = (a) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 1.5;
    const list = [];
    const pushW = (pr, act, why, pri = 5) => list.push({ x: pr.x, y: pr.y, act, why, pri, pr });
    // standpipe when hurt
    for (const pr of props) if (pr.type === 'standpipe' && !pr.data.used && (hp <= Math.ceil(maxHp / 2) || (PT.opt.pipeAlways && hp < maxHp))) pushW(pr, 'up', 'standpipe', 1);
    if (kind === 'hub') {
      const g = props.filter(x => x.type === 'gate');
      const tgt = PT.K.region = PT.K.region && !run.beaten[PT.K.region] ? PT.K.region : chooseRegion(S);
      if (PT.K.regionChosenAt !== run.time && PT.K.lastChosen !== tgt) { PT.K.lastChosen = tgt; PT.log.decisions.push({ t: +run.time.toFixed(0), kind: 'region', region: tgt, carried: p.items.map(cutOf), chart: chartOf(tgt), ignoreChart: PT.opt.ignoreChart }); }
      const gate = g.find(x => x.data.region === tgt);
      const q = (G.rooms.current.def.portals || []).find(x => x.id === tgt);
      if (q) list.push({ portal: q, why: 'portal ' + tgt, pri: 5 });
      else if (gate) pushW(gate, 'up', 'gate ' + tgt, 5);
    } else {
      // props worth using
      for (const pr of props) {
        const d = pr.data || {};
        if (pr.type === 'plinth') {
          if (d.ware) continue;
          if (d.scrip) { pushW(pr, 'up', 'scrip purse', 3); continue; }
          if (d.trinket) {
            if (d.price) { if (shards >= d.price + 5 && !rk.done['k' + pr.x] && run.trinkets.length < 6) { const v = trinketValue(d.trinket); list.push({ x: pr.x, y: pr.y, act: 'up', why: 'buy ' + d.trinket, pri: 4, pr, value: v, buy: true }); } }
            else list.push({ x: pr.x, y: pr.y, act: 'up', why: 'take ' + d.trinket, pri: 2, pr, value: trinketValue(d.trinket), choose: true });
            continue;
          }
          if (d.item) {
            if (d.locked && !room.cleared) { if (run.time - rk.enter < 120) list.push({ hunt: true, why: 'clear room for plinth', pri: 3, x: pr.x, y: pr.y }); continue; }
            const have = p.items.includes(d.item), free = hasSlotsLeft(S);
            if (have) continue;
            if (d.group) list.push({ x: pr.x, y: pr.y, act: 'up', why: 'ticket ' + d.item, pri: 2, pr, value: (tokenWanted(S, d.item) ? 5 : 1) + rnd.f(), choose: true, item: d.item });
            else if (free || tokenWanted(S, d.item)) list.push({ x: pr.x, y: pr.y, act: 'up', why: 'take token ' + d.item, pri: 2, pr, item: d.item });
            else if (!rk.done['skip' + pr.x]) { rk.done['skip' + pr.x] = 1; PT.log.decisions.push({ t: +run.time.toFixed(0), kind: 'skip-token', item: d.item, cut: cutOf(d.item), carried: p.items.map(cutOf), chart: chartOf(PT.K.region || 'r1') }); }
          }
        } else if (pr.type === 'trunk') { if (!room.cleared && run.time - rk.enter < 120) list.push({ hunt: true, why: 'clear room for trunk', pri: 4, x: pr.x, y: pr.y }); }
        else if (pr.type === 'ticket') { if (!d.used && !d.wait && shards >= (run.tickets ? 45 : 30) + 3 && (hasSlotsLeft(S) || !PT.opt.ignoreChart)) pushW(pr, 'up', 'ticket machine', 3); }
        else if (pr.type === 'post') { if (!rk.done['post']) pushW(pr, 'touch', 'signal post', 2); }
        else if (pr.type === 'door' && (kind === 'main' || kind === 'arena')) { if (doorWanted(S, pr, rk)) pushW(pr, 'door', 'door ' + (d.label || ''), 6); }
        else if (pr.type === 'door' && kind === 'arena' && /Junction/.test(d.label || '')) pushW(pr, 'door', 'back to the junction', 1);
      }
      // a branch or trial room: when nothing is left to do, leave by the way back
      if (kind === 'branch' || kind === 'trial') for (const pr of props) if (pr.type === 'door') list.push({ x: pr.x, y: pr.y, act: 'door', why: 'way back', pri: 9, pr, back: true });
      if (kind === 'arena' && room.boss === null || (kind === 'arena' && run.beaten[room.region])) for (const pr of props) if (pr.type === 'door' && /Junction/.test((pr.data || {}).label || '')) list.push({ x: pr.x, y: pr.y, act: 'door', why: 'back to the junction', pri: 8, pr, back: true });
      if (kind === 'main') list.push({ exit: fwdSide(), why: 'on', pri: 10 });
      if (kind === 'arena' && !run.beaten[room.region]) list.push({ boss: true, why: 'to the Warden', pri: 10 });
    }
    // choose: group "choose" items by value, others by priority then distance
    const choose = list.filter(w => w.choose);
    const rest = list.filter(w => !w.choose);
    if (choose.length) { choose.sort((a, b) => b.value - a.value); const w = choose[0]; w.pri = 2; rest.push(w); }
    rest.sort((a, b) => a.pri - b.pri || (a.x !== undefined && b.x !== undefined ? near(a) - near(b) : 0));
    return rest[0] || { exit: fwdSide(), why: 'on' };
  }

  // ------------------------------------------------------------------------------------------------ one tick
  const lastState = { room: null, hp: null, boss: null, down: false, fight: null };
  let stuckAnchor = null;
  PT.tick = function () {
    if (G.time === PT.lastT) return null;                      // no game time has passed: nothing new to decide
    holds.clear();
    const S = PT.S = G.debug.state(), p = P0(), now = G.time;
    for (const k of Object.keys(PT.taps)) if (PT.taps[k] > now) holds.add(k); else delete PT.taps[k];
    const out = { keys: [], state: S.state, over: S.run ? S.run.over : null, rt: S.run ? S.run.time : 0, deaths: PT.log.deaths.length, room: S.room ? S.room.id : null, note: '' };
    PT.lastT = now; out.shot = PT.shotReq || null; PT.shotReq = null;
    if (S.state === 'title') { out.keys.push('attack'); return out; }
    if (S.state === 'over') { out.done = true; return out; }
    if (S.state === 'pause') { if (!PT.pauseT) PT.pauseT = now; if (now - PT.pauseT > 0.3) { tap('pause', 0.06); PT.pauseT = now + 0.5; } for (const k of holds) out.keys.push(k); return out; }
    if (S.state === 'map') { tap('map', 0.06); for (const k of holds) out.keys.push(k); return out; }
    PT.pauseT = 0;
    if (!S.room || S.room.transition || !p) { for (const k of holds) out.keys.push(k); return out; }
    const room = S.room, run = S.run, rk = look(S);
    // room bookkeeping
    if (lastState.room !== room.id) {
      const L = PT.log, prev = L.rooms[L.rooms.length - 1]; if (prev && !prev.left) prev.left = +run.time.toFixed(1);
      L.rooms.push({ id: room.id, def: room.def, region: room.region, kind: room.kind, enter: +run.time.toFixed(1), hp: p.hp, shards: run.shards });
      rk.visits++; lastState.room = room.id; PT.K.prog = null; PT.zones = [];
      rk.enter = run.time; rk.hunted = 0;
      if (room.kind === 'hub') PT.K.region = null;
    }
    if (rk.visits === 1 && !rk.shotDone && run.time - rk.enter > 1.1 && !room.transition) { rk.shotDone = 1; PT.shotReq = 'room_' + room.def; }
    if (lastState.hp !== null && p.hp < lastState.hp) { /* the playtester's hurt wrapper records the source */ }
    lastState.hp = p.hp;
    // stuck tracking (the playtester also watches from outside)
    if (!stuckAnchor || Math.hypot(stuckAnchor.x - p.x, stuckAnchor.y - p.y) > 40 || stuckAnchor.room !== room.id) stuckAnchor = { x: p.x, y: p.y, t: now, room: room.id };
    PT.stuckFor = now - stuckAnchor.t;
    if (p.down) { out.keys = []; return out; }
    if (PT.stuckFor > 12 && Math.floor(PT.stuckFor / 4) !== PT.K.unstickN) { PT.K.unstickN = Math.floor(PT.stuckFor / 4); wiggle(p); if (PT.stuckFor > 30) { PT.K.nav = {}; const N = PT.K.ban; } if (PT.stuckFor > 40) PT.K.ban[room.id] = {}; }

    { // scrip earned and spent; the Warden fight record
      const K = PT.K, L = PT.log; if (K.lastShards !== undefined) { const d = run.shards - K.lastShards; if (d > 0) L.earned = (L.earned || 0) + d; else if (d < 0) L.spent = (L.spent || 0) - d; } K.lastShards = run.shards;
      const bb = G.rooms.current.boss;
      if (bb && bb.state !== 'sleep' && (!K.fightMem || K.fightMem.b !== bb)) K.fightMem = { b: bb, boss: bb.id, region: bb.region, t0: run.time, hits0: run.stats.hits, spent0: run.spent.length, chart: bb.chart.slice(), open: bb.spots.filter(s => s.open).map(s => s.cls), carried: p.items.map(cutOf), hpMax: Math.round(bb.maxHp), hp0: p.hp, maxHp: p.maxHp, rooms: L.rooms.length, done: false };
      const fm = K.fightMem;
      if (fm && !fm.done && bb === fm.b && bb.state === 'dead') { fm.done = true; L.fights.push(fightRow(fm, 'beaten', run)); }
    }
    const th = threats(), foeList = foes(), foe = pickFoe(p, foeList), boss = G.rooms.current.boss;
    // zones: remember where we were last hurt
    if (PT.hurtRect) { (PT.zones = PT.zones || []).push({ rect: PT.hurtRect, until: now + 0.9 }); PT.hurtRect = null; if (PT.zones.length > 8) PT.zones.shift(); }
    const nearThreat = th.filter(h => !h.soft && Math.abs(h.x - p.x) < 300 && Math.abs(h.y - p.y) < 220);
    let act = 'nav', mis = null;

    // ---- survival first: mend when hurt and nothing is near
    const healing = p.healT > 0;
    if (p.hp < p.maxHp && p.glow >= M.MEND_COST && p.onGround && (healing || (!nearThreat.length && now - (PT.K.lastMend || -9) > 0.2)) && !(boss && boss.state === 'intro')) {
      const calm = th.every(h => Math.abs(h.x - p.x) > 260 || Math.abs(h.y - p.y) > 200) || (boss && boss.state === 'stagger');
      if (calm || healing) { hold('heal'); if (!healing) { PT.log.mends++; PT.K.lastMend = now; } return finish(out, 'mend'); }
    }

    // ---- fighting and dodging
    if (foe && !foe.boss) {
      const k = PT.K.eng;
      if (!k || k.uid !== foe.e.uid) PT.K.eng = { uid: foe.e.uid, t0: now, hp: foe.e.hp, px: p.x, py: p.y };
      else if (foe.e.hp < k.hp) { k.hp = foe.e.hp; k.t0 = now; }
      else if (now - k.t0 > (Math.hypot(p.x - (k.px || p.x), p.y - (k.py || p.y)) < 25 ? 4 : 7)) { (PT.K.ign = PT.K.ign || {})[foe.e.uid] = now + 9; PT.K.eng = null; ev('gave_up_on_enemy', { id: foe.id, x: Math.round(foe.x), y: Math.round(foe.y) }); }
    }
    const ignored = foe && !foe.boss && PT.K.ign && PT.K.ign[foe.e.uid] > now;
    const band = foe ? (foe.boss ? Math.abs((foe.y - foe.h / 2) - (p.y - 20)) < 300 : Math.abs(foe.y - p.y) < (foe.flying ? 150 : 56)) : false;
    const engaged = !ignored && foe && band && Math.abs(foe.x - p.x) < (foe.boss ? 520 : 240) && (!foe.ceil || foe.e.state !== 'hang');
    const hot = nearThreat.length && nearThreat.some(h => h.kind !== 'zone' && !(ignored && h.e === foe.e));
    if (engaged) {
      PT.K.noTarget = 0;
      let want = null;
      if (foe.boss) {
        const b = foe.boss;
        const plan = b.state === 'intro' ? null : slotPlan(p, b);
        if (plan && PT.K.punchOK !== false) {
          const sel = p.items[p.sel];
          if (sel !== plan.item && now - PT.K.cycleT > 0.35 && p.itemCd <= 0.3) { tap('cycle', 0.06); PT.K.cycleT = now; }
          if (plan.plan) want = { spacing: 0, x: plan.plan.x }; else want = { spacing: 130, x: foe.x };
          foe.aimPlan = plan;
        } else if (b.state === 'stagger') want = { spacing: 46, x: foe.x };
        else want = { spacing: 62, x: foe.x };
      } else if (foe.id === 'turnstile' && Math.sign(p.x - foe.x) === foe.e.face && foe.e.state !== 'turn') want = { spacing: 0, x: foe.x - foe.e.face * 56 };
      else want = { spacing: foe.flying ? 20 : 54, x: foe.x };
      const shielded = !foe.boss && foe.id === 'turnstile' && Math.sign(p.x - foe.x) === foe.e.face && foe.e.state !== 'turn';
      let dd = dodge(th, want), c = dd.c;
      if (shielded) {
        const d = foe.x - p.x, ad = Math.abs(d), dt = Math.sign(d) || 1;
        c = !p.onGround ? { dir: dt, jump: 0 } : ad > 108 ? { dir: dt, jump: 0 } : ad > 36 ? { dir: dt, jump: 1 } : { dir: -dt, jump: 1 };
      }
      if (c.dir) hold(c.dir < 0 ? 'left' : 'right'); if (c.jump) hold('jump');
      const above = foe.rect.y1 < p.y - p.h - 6 && Math.abs(foe.x - p.x) < foe.w / 2 + 34;
      const sb = slashBox(p, p.face, above);
      const reach = ov(sb, { x0: foe.rect.x0 - 4, x1: foe.rect.x1 + 4, y0: foe.rect.y0 - 4, y1: foe.rect.y1 + 4 });
      const aiming = foe.boss && foe.aimPlan && foe.aimPlan.plan && Math.abs(p.x - foe.aimPlan.plan.x) < 30 && foe.boss.state !== 'stagger';
      if (above && p.atkCd <= 0 && reach) { hold('up'); tap('attack', 0.06); PT.log.slashes++; }
      else if (reach && p.atkCd <= 0 && p.stun <= 0 && !aiming && !shielded) { tap('attack', 0.06); PT.log.slashes++; }
      else if (!reach && Math.abs(foe.x - p.x) < 110 && Math.sign(foe.x - p.x) !== p.face && !c.dir && p.atkCd <= 0) hold(foe.x < p.x ? 'left' : 'right');
      if (foe.boss && foe.aimPlan) castAtSlot(foe, p, c);
      return finish(out, 'fight');
    }
    mis = PT.mis = mission(S, rk);
    const note = navigate(S, rk, mis, foeList, p, now);
    if (hot && (p.onGround || nearThreat.some(h => h.kind === 'shot'))) {
      const dd = dodge(th, { dir: holds.has('left') ? -1 : holds.has('right') ? 1 : 0 }), cur = { dir: holds.has('left') ? -1 : holds.has('right') ? 1 : 0, jump: holds.has('jump') ? 1 : 0 };
      const curD = dodgeDanger(th, cur);
      if (curD > 0.3 && dd.c && (dd.c.dir !== cur.dir || dd.c.jump !== cur.jump)) {
        holds.delete('left'); holds.delete('right'); holds.delete('jump'); PT.K.prog = null;
        if (dd.c.dir) hold(dd.c.dir < 0 ? 'left' : 'right'); if (dd.c.jump) hold('jump');
        return finish(out, 'dodge');
      }
    }
    return finish(out, note);
  };
  function dodgeDanger(th, c) {
    const p = P0(), pts = simCand(p, c, 6); let danger = 0;
    pts.forEach((q, i) => { const t = (i + 1) / 12, pr = prect(q.x, q.y, p); for (const h of th) { const r = h.at(t); if (r && ov(pr, { x0: r.x0 - 3, x1: r.x1 + 3, y0: r.y0 - 3, y1: r.y1 + 3 })) danger += (h.soft ? 0.25 : 1) * (1.4 - i / 6 * 0.6) * (p.inv > t ? 0.1 : 1); } });
    return danger;
  }
  function navigate(S, rk, mis, foeList, p, now) {
    if (mis.hunt) {
      const f = foeList.slice().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (f) {
        const er = Math.round(f.y / T), side = p.x < f.x ? -1 : 1;
        const r = follow(n => typeof n !== 'string' && Math.abs(n.r - er) <= (f.flying ? 3 : 0) && Math.abs(n.x - f.x) > 70 && Math.abs(n.x - f.x) < 130 && Math.sign(n.x - f.x) === side, 'hunt');
        if (r === 'nopath' || r === 'nonode') { const r2 = follow(goalAt(f.x - side * 90, f.y), 'hunt2'); if (r2 === 'nopath' || r2 === 'nonode') hold(f.x < p.x ? 'left' : 'right'); return 'hunt:' + r2; }
        return 'hunt:' + r;
      }
    }
    const pk = G.pickups.filter(q => Math.abs(q.x - p.x) < 220 && Math.abs(q.y - p.y) < 120).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (pk && !mis.back) { const r = follow(goalAt(pk.x, pk.y + 8), 'scrip'); if (r !== 'nopath' && r !== 'nonode') return 'scrip'; }
    let r = 'idle';
    if (mis.portal) {
      const q = mis.portal, R = G.rooms.current, cols = R.cols, rows = R.rows;
      const inside = n => typeof n !== 'string' && (q.side === 'left' ? n.c <= 1 && n.r >= q.from - 1 && n.r <= q.to + 1 : q.side === 'right' ? n.c >= cols - 2 && n.r >= q.from - 1 && n.r <= q.to + 1 : q.side === 'top' ? n.r <= 4 && n.c >= q.from - 1 && n.c <= q.to + 1 : n.r >= rows - 5 && n.c >= q.from && n.c <= q.to);
      r = follow(inside, 'portal');
      if (q.side === 'top' && Math.abs(p.x - ((q.from + q.to) / 2 * T + T / 2)) < 70 && p.y < 230) { if (p.onGround) { if (Math.floor(G.time / 0.35) % 2 === 0) hold('jump'); hold('up'); } else { hold('jump'); hold('up'); } const mid = (q.from + q.to) / 2 * T + T / 2; if (Math.abs(p.x - mid) > 14) hold(p.x < mid ? 'right' : 'left'); }
      if (r === 'there' || r === 'nopath') { if (q.side === 'left') hold('left'); else if (q.side === 'right') hold('right'); else if (q.side === 'top') { hold('up'); const mid = (q.from + q.to) / 2 * T + T / 2; if (Math.abs(p.x - mid) > 14) hold(p.x < mid ? 'right' : 'left'); } else { const mid = (q.from + q.to) / 2 * T + T / 2; if (Math.abs(p.x - mid) > 20) hold(p.x < mid ? 'right' : 'left'); else hold('down'); } }
    } else if (mis.exit) {
      r = follow(goalExit(mis.exit), 'exit');
      if (r === 'there') holdExit(mis.exit);
    } else if (mis.boss) {
      const dc = G.rooms.current.def.doorCol;
      r = follow(n => typeof n !== 'string' && n.c >= dc + 4 && n.c <= dc + 8, 'boss');
      if (r === 'there' || r === 'nopath') hold('right');
    } else if (mis.x !== undefined) {
      const dx = mis.x - p.x, dy = mis.y - p.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 40 && p.onGround) {
        r = 'use';
        if (mis.act === 'up' && mis.pr && mis.pr.type === 'plinth' && mis.pr.data.item && p.items.length >= p.slots && !mis.pr.data.group) {
          const worst = p.items.map((id, i) => ({ i, w: tokenWanted(S, id) ? 1 : 0 })).sort((a, b) => a.w - b.w)[0];
          if (worst && p.sel !== worst.i) { if (now - PT.K.cycleT > 0.3) { tap('cycle', 0.06); PT.K.cycleT = now; } return 'swap-prep'; }
        }
        if (mis.act === 'up' || mis.act === 'door') { if (!PT.K.upT || now - PT.K.upT > 0.25) { tap('up', 0.08); PT.K.upT = now; onUse(S, mis, rk); } }
        else if (mis.act === 'touch') { rk.done['post'] = rk.done['post'] || now; if (now - rk.done['post'] > 2) rk.done['post'] = 1e9; }
      } else r = follow(goalAt(mis.x, mis.y), 'goto');
    }
    if (r === 'nopath' || r === 'nonode') {
      PT.K.noTarget++;
      if (mis.pr) { rk.tries = rk.tries || {}; rk.tries[mis.pr.k] = (rk.tries[mis.pr.k] || 0) + 0.05; }
      if (PT.K.noTarget > 40) { ev('no_path', { why: mis.why, at: [Math.round(p.x), Math.round(p.y)] }); PT.K.noTarget = 0; wiggle(p); }
    } else PT.K.noTarget = 0;
    return 'nav:' + (mis.why || '') + ':' + r;
  }
  function fightRow(fm, result, run) {
    const b = fm.b, gr = G.run.grades && G.run.grades[fm.region];
    return { boss: fm.boss, region: fm.region, result, start: +fm.t0.toFixed(1), dur: +(run.time - fm.t0).toFixed(1), hits: G.run.stats.hits - fm.hits0, chart: fm.chart, open: fm.open, carried: fm.carried, punched: b.spots.filter(s => s.broken).map(s => s.cls), voided: G.run.spent.slice(fm.spent0),
      bossHpLeft: Math.round(b.hp), bossHpMax: fm.hpMax, hp0: fm.hp0, maxHp: fm.maxHp, grade: gr ? { time: gr.time, par: gr.par, clean: gr.clean } : null, casts: PT.log.casts, tries: PT.K.slotTries || {} };
  }
  PT.finalize = () => { const fm = PT.K.fightMem, run = G.run; if (fm && !fm.done) { fm.done = true; PT.log.fights.push(fightRow(fm, 'lost', run)); } };
  function wiggle(p) {          // a bit of everything: a human mashes buttons when lost
    PT.taps.jump = G.time + 0.2; PT.taps[rnd.f() < 0.5 ? 'left' : 'right'] = G.time + 0.6;
  }
  function onUse(S, mis, rk) {
    const pr = mis.pr, p = P0(), room = S.room;
    rk.tries = rk.tries || {}; rk.tries[pr && pr.k] = (rk.tries[pr && pr.k] || 0) + 1; if (rk.tries[pr && pr.k] > 1 && mis.act === 'up' && pr && pr.type !== 'plinth') return;
    if (mis.act === 'door') { rk.doorsTried[Math.round(pr.x)] = 1; PT.log.doors++; ev('door', { label: (pr.data || {}).label, tag: (pr.data || {}).tag }); }
    if (mis.act === 'up' && pr) {
      if (pr.type === 'plinth' && pr.data.item) {
        // a full party: cycle so the least useful token is selected, then swap
        if (p.items.length >= p.slots) { const worst = p.items.map((id, i) => ({ i, id, w: tokenWanted(S, id) ? 1 : 0 })).sort((a, b) => a.w - b.w)[0]; if (worst && p.sel !== worst.i) { tap('cycle', 0.06); } }
        PT.log.tokens.push({ t: +S.run.time.toFixed(0), item: pr.data.item, cut: cutOf(pr.data.item), room: room.id, region: room.region, def: room.def, why: mis.why, swap: p.items.length >= p.slots, chartMatch: tokenWanted(S, pr.data.item) });
        if (!PT.opt.ignoreChart) PT.log.decisions.push({ t: +S.run.time.toFixed(0), kind: 'take-token', item: pr.data.item, cut: cutOf(pr.data.item), wanted: tokenWanted(S, pr.data.item), swap: p.items.length >= p.slots, carried: p.items.map(cutOf), target: PT.K.region });
      }
      if (pr.type === 'plinth' && pr.data.trinket) { PT.log.spend.push({ t: +S.run.time.toFixed(0), what: pr.data.trinket, price: pr.data.price || 0, room: room.id }); if (pr.data.price) rk.done['k' + pr.x] = 1; }
      if (pr.type === 'ticket') PT.log.spend.push({ t: +S.run.time.toFixed(0), what: 'ticket', price: S.run.tickets ? 45 : 30, room: room.id });
      if (pr.type === 'standpipe') { PT.log.standpipes++; ev('standpipe', { hp: p.hp }); }
    }
  }
  // A token at a slot: aim like the learned shots say, or try an unknown aim to learn it.
  function castAtSlot(foe, p, c) {
    const b = foe.boss, plan = foe.aimPlan; if (!plan || p.itemCd > 0 || p.items[p.sel] !== plan.item || p.stun > 0 || p.healT > 0) return;
    const now = G.time;
    let aim = null, ok = false;
    if (plan.plan) {
      const dx = Math.abs(p.x - plan.plan.x);
      if (dx < 24 && p.face === plan.plan.face && p.onGround) { aim = plan.plan.aim; ok = true; }
    } else if (plan.unknown.length && p.onGround && Math.abs(p.x - plan.q.x) < 520 && p.face === Math.sign(plan.q.x - p.x)) {
      aim = plan.unknown[0]; ok = true;                                // learn: cast once with this aim, watch where the shot goes
    }
    if (!ok || now - (PT.K.castT || -9) < 0.5) return;
    if (aim === 'up') hold('up'); else if (aim === 'down') hold('down'); else if (aim === 'fwd') hold(p.face < 0 ? 'left' : 'right');
    tap('item', 0.07); PT.K.castT = now; PT.K.castAim = aim; PT.log.casts++;
    const k = b.id + ':' + plan.sp.cls; (PT.K.slotTries = PT.K.slotTries || {})[k] = (PT.K.slotTries[k] || 0) + 1;
    PT.log.castLog.push({ t: +G.run.time.toFixed(1), boss: b.id, cls: plan.sp.cls, item: plan.item, aim, planned: !!plan.plan, px: Math.round(p.x), py: Math.round(p.y), slot: [Math.round(plan.q.x), Math.round(plan.q.y)], hp: plan.sp.hp });
  }
  function finish(out, note) {
    for (const k of holds) out.keys.push(k);
    out.note = note; PT.lastNote = note; out.stuck = PT.stuckFor > 10 && /^(nav|hunt|scrip)/.test(note) ? PT.stuckFor : 0;
    return out;
  }

  // ------------------------------------------------------------------------------------------------ monitors (observation only)
  PT.install = function () {
    if (PT.installed) return; PT.installed = true;
    let cur = null;
    const wrap = (obj, name, label) => { const o = obj[name]; obj[name] = function () { const prev = cur; cur = label ? label(this) : cur; try { return o.apply(this, arguments); } finally { cur = prev; } }; };
    wrap(G.Enemy.prototype, 'update', e => ({ kind: 'enemy', id: e.id, state: e.state, left: e.t !== undefined ? +(+e.t).toFixed(2) : null, elite: !!e.elite }));
    wrap(G.Boss.prototype, 'update', b => ({ kind: 'boss', id: b.id, state: b.state }));
    wrap(G.Player.prototype, 'update', () => ({ kind: 'player' }));
    wrap(G.combat, 'update', () => ({ kind: 'combat' }));
    const shoot = G.combat.shoot;
    G.combat.shoot = function (def) {
      const s = shoot.apply(this, arguments);
      if (s && s.hostile && cur) s._src = cur.kind + ':' + (cur.id || '');
      if (s && !s.hostile && s.owner && s.owner === G.players[0] && s.itemId) {            // learn the shot of the token we just used
        const p = s.owner, aim = PT.K && PT.K.castAim || aimOf(p.in.held), db = (PT.K.aimDb[s.itemId] = PT.K.aimDb[s.itemId] || {});
        if (!db[aim] || PT.K.castAim) db[aim] = { dx: (s.x - p.x) * p.face, dy: p.y - s.y, vx: s.vx * p.face, vy: s.vy, grav: s.grav || 0, life: s.life, r: s.r, burst: s.burst || 0, hug: !!s.hug };
        s._cast = { item: s.itemId, aim };
        PT.K.castAim = null;
        if (PT.log.shots.length < 400) PT.log.shots.push({ t: +G.run.time.toFixed(1), item: s.itemId, aim, x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(s.vx * p.face), vy: Math.round(s.vy) });
      }
      return s;
    };
    const say = G.fx.say;
    G.fx.say = function (a, b, c) { const L = PT.log; if (L && L.says.length < 400) L.says.push({ t: +(G.run ? G.run.time : 0).toFixed(1), room: G.rooms.current && G.rooms.current.id, title: String(a || '').slice(0, 120), line: String(b || '').slice(0, 300), dur: c }); return say.apply(this, arguments); };
    if (G.tips && G.tips.fire) { const tf = G.tips.fire; G.tips.fire = function (id) { const r = tf.apply(this, arguments); if (PT.log && PT.log.tips.length < 100 && !PT.log.tips.some(x => x.id === id)) PT.log.tips.push({ t: +(G.run ? G.run.time : 0).toFixed(1), id, room: G.rooms.current && G.rooms.current.id }); return r; }; }
    const enter = G.rooms.enter;
    G.rooms.enter = function (id, entry) {
      const before = G.audio && G.audio.current ? G.audio.current() : null, from = G.rooms.current, t0 = performance.now();
      const r = enter.apply(this, arguments);
      const cur = G.rooms.current, rec = { t: +(G.run ? G.run.time : 0).toFixed(1), from: from && from.id, to: cur.id, regionFrom: from && from.region, regionTo: cur.region, kindTo: cur.kind, before, after: null, afterLate: null, entry: entry && (entry.side || (entry.gate ? 'gate' : 'mark')), enterMs: +(performance.now() - t0).toFixed(1) };
      if (PT.log) { PT.log.trans.push(rec); }
      setTimeout(() => { try { rec.after = G.audio.current(); } catch (e) { /* no audio */ } }, 800);
      setTimeout(() => { try { rec.afterLate = G.audio.current(); } catch (e) { /* no audio */ } }, 3000);
      return r;
    };
    const hurt = G.Player.prototype.hurt;
    G.Player.prototype.hurt = function (fromX) {
      const hp0 = this.hp, inv0 = this.inv, was = this.down;
      const ok = hurt.call(this, fromX);
      let wouldDie = false;
      if (ok && PT.opt.assist && this.down) { wouldDie = true; this.down = false; this.hp = this.maxHp; this.inv = 1.5; }      // assist: a "continue" instead of a game over (recorded as a death)
      if (ok) {
        const room = G.rooms.current, b = room.boss; let src = cur ? (cur.kind === 'boss' ? 'boss:' + cur.id + ':' + cur.state : cur.kind === 'enemy' ? 'enemy:' + cur.id : cur.kind === 'player' ? 'spikes' : cur.kind) : 'unknown';
        if (src === 'combat' || src === 'unknown') {                                  // a shot: name its owner
          let best = null, bd = 1e9; for (const s of G.shots) if (s.hostile) { const d = Math.hypot(s.x - this.x, s.y - this.cy); if (d < bd) { bd = d; best = s; } }
          src = best && bd < 120 ? 'shot:' + (best._src || '?') : 'unknown';
        }
        if (src.startsWith('enemy:') || src.startsWith('boss:') || src.startsWith('shot:') || src === 'spikes' || src === 'unknown') { /* keep */ }
        PT.log.hits.push({ t: +G.run.time.toFixed(1), src, room: room.id, def: room.def.id, region: room.region, hp: this.hp, x: Math.round(this.x), y: Math.round(this.y), bossState: b ? b.state : null, estate: cur && cur.kind === 'enemy' ? cur.state : null, eleft: cur && cur.kind === 'enemy' ? cur.left : null, elite: cur && cur.elite || false, vx: Math.round(this.vx), boss: b && b.state !== 'sleep' ? b.id : null, tp: PT.mis && PT.mis.why, note: PT.lastNote });
        PT.hurtRect = { x0: this.x - 40, x1: this.x + 40, y0: this.y - 90, y1: this.y };
        if (wouldDie || (!PT.opt.assist && this.down)) PT.log.deaths.push({ t: +G.run.time.toFixed(1), room: room.id, def: room.def.id, region: room.region, src, assisted: wouldDie, x: Math.round(this.x), y: Math.round(this.y), boss: b && b.state !== 'sleep' ? b.id : null, bossHp: b ? Math.round(b.hp) : null, bossState: b ? b.state : null });
        PT.hitFlag = (PT.hitFlag || 0) + 1;
      }
      return ok;
    };
    // drawing: the player and the boss must be drawn in every rendered frame of play
    const V = PT.vis = { frames: 0, noPlayer: 0, noBoss: 0, bad: [], pixelBad: 0, pixelChecked: 0, drawMs: [], longFrames: 0 };
    let drawnP = 0, drawnB = 0, wantPixel = false;
    const pd = G.Player.prototype.draw;
    G.Player.prototype.draw = function (ctx, dt) {
      drawnP++; const r = pd.call(this, ctx, dt);
      if (wantPixel && this === G.players[0] && !this.down) {
        wantPixel = false;
        try {
          const m = ctx.getTransform(), s = m.a, x0 = Math.max(0, Math.floor(m.e + (this.x - 24) * s)), y0 = Math.max(0, Math.floor(m.f + (this.y - 68) * s)), w = Math.min(Math.ceil(48 * s), ctx.canvas.width - x0), h = Math.min(Math.ceil(68 * s), ctx.canvas.height - y0);
          if (w > 8 && h > 8) {
            const im = ctx.getImageData(x0, y0, w, h).data; let diff = 0; const f0 = [im[0], im[1], im[2]];
            for (let i = 0; i < im.length; i += 4) if (Math.abs(im[i] - f0[0]) + Math.abs(im[i + 1] - f0[1]) + Math.abs(im[i + 2] - f0[2]) > 60) diff++;
            V.pixelChecked++; if (diff < 40) { V.pixelBad++; if (V.bad.length < 30) V.bad.push({ t: +G.time.toFixed(1), what: 'player crop looks empty', diff, room: G.rooms.current.id, inv: +this.inv.toFixed(2) }); }
          }
        } catch (e) { /* off-canvas */ }
      }
      return r;
    };
    const bd = G.Boss.prototype.draw;
    G.Boss.prototype.draw = function (ctx) { drawnB++; return bd.call(this, ctx); };
    const rd = G.rooms.draw;
    PT.drawCost = {};
    G.rooms.draw = function (ctx, dt) {
      drawnP = 0; drawnB = 0; V.frames++; wantPixel = V.frames % 40 === 0 && !PT.opt.noPixels;
      const b = G.rooms.current.boss, t0 = performance.now();
      rd.apply(this, arguments); wantPixel = false;
      const ms = performance.now() - t0, k = G.rooms.current.region || '?', c = PT.drawCost[k] || (PT.drawCost[k] = { n: 0, sum: 0, max: 0, over16: 0, over33: 0, list: [] });
      c.n++; c.sum += ms; if (ms > c.max) c.max = ms; if (ms > 16) c.over16++; if (ms > 33) c.over33++; if (c.list.length < 600 && c.n % 4 === 0) c.list.push(+ms.toFixed(1));
      if (G.rooms.trans) return;
      if (drawnP !== G.players.length) { V.noPlayer++; if (V.bad.length < 30) V.bad.push({ t: +G.time.toFixed(1), what: 'player not drawn', n: drawnP, state: G.state, room: G.rooms.current.id }); }
      if (b && b.state !== 'sleep' && !(b.state === 'dead' && b.t < -1.2) && drawnB !== 1) { V.noBoss++; if (V.bad.length < 30) V.bad.push({ t: +G.time.toFixed(1), what: 'boss not drawn', n: drawnB, state: b.state, room: G.rooms.current.id }); }
    };
  };
  return PT;
})();
