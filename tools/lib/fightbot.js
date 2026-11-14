/* Fight bot for the boss checks (browser side; loaded into the page by tools/checks/bosses_fair.mjs, not shipped).
   A "simple bot that only moves, jumps and (if unlocked) dashes". It cannot see the future by magic: it plans by simulating the real engine
   a short way ahead from a snapshot, but it reacts late: the action it picks now is only applied LAT macro steps (0.1 s each) later, like a
   player's reaction time. The checks run it with base moves only (run and jump, no dash, no wall grip), the hardest case a first-time
   player is in.
   window.FB: snap(), restore(s), run({ mode: 'dodge' | 'fight', maxT, until(b), lat, horizon, samples, seed }) -> { hits, t, dealt, ... } */
window.FB = (() => {
  const G = window.G, D = G.debug, STEP = G.C.STEP, K = 12;           // one macro step = 12 engine steps = 0.1 s

  // ---------------------------------------------------------------- snapshot and restore of everything a boss fight changes
  const GLOBALS = () => [G, G.run, G.rooms, G.tiles, G.combat, G.fx, G.game, G.input, G.util, G.art, G.props, G.cam, G.debug, window];
  const SKIP = new Set(['def', 'node', 'grid', 'region']);
  const isPlain = v => { const p = Object.getPrototypeOf(v); return p === Object.prototype || p === null; };
  function clone(v, map, keep) {
    if (v === null || typeof v !== 'object') return v;
    if (keep.has(v)) return v;
    if (map.has(v)) return map.get(v);
    if (Array.isArray(v)) { const a = []; map.set(v, a); for (let i = 0; i < v.length; i++) a.push(clone(v[i], map, keep)); return a; }
    if (v instanceof Set) { const s = new Set(); map.set(v, s); for (const x of v) s.add(clone(x, map, keep)); return s; }
    if (v instanceof Map) { const m = new Map(); map.set(v, m); for (const [k, x] of v) m.set(k, clone(x, map, keep)); return m; }
    if (!isPlain(v) && !(v instanceof G.Enemy)) return v;                 // DOM nodes, canvases and other foreign objects stay shared
    const o = Object.create(Object.getPrototypeOf(v)); map.set(v, o);
    for (const k of Object.keys(v)) o[k] = SKIP.has(k) ? v[k] : clone(v[k], map, keep);
    return o;
  }
  // A player's input state is registered with the input module: it is never replaced, only copied back.
  const inCopy = s => ({ held: Object.assign({}, s.held), pressed: Object.assign({}, s.pressed), forced: Object.assign({}, s.forced) });
  const inPut = (s, c) => { for (const k of ['held', 'pressed', 'forced']) { for (const a in s[k]) delete s[k][a]; Object.assign(s[k], c[k]); } };
  const roots = () => { const room = G.rooms.current; return [...G.players, room, room.boss].filter(Boolean); };
  function snap() {
    const keep = new Set([...GLOBALS(), ...roots()]), map = new Map(), room = G.rooms.current;
    const ents = roots().map(a => { const props = {}; for (const k of Object.keys(a)) props[k] = SKIP.has(k) ? a[k] : k === 'in' ? inCopy(a.in) : clone(a[k], map, keep); return [a, props]; });
    const run = G.run;
    return { ents, shots: clone(G.shots, map, keep), pickups: clone(G.pickups, map, keep), blockers: clone(G.tiles.blockers, map, keep),
      time: G.time, rng: run.rng.get(), rtime: run.time, stats: Object.assign({}, run.stats), shards: run.shards, over: run.over, overT: run.overT,
      state: G.state, boss: room.boss };
  }
  function restore(s) {
    const keep = new Set([...GLOBALS(), ...roots()]), map = new Map();
    for (const [a, props] of s.ents) {
      for (const k of Object.keys(a)) if (!(k in props)) delete a[k];
      for (const k of Object.keys(props)) { if (k === 'in') inPut(a.in, props.in); else a[k] = SKIP.has(k) ? props[k] : clone(props[k], map, keep); }
    }
    G.shots.length = 0; for (const x of clone(s.shots, map, keep)) G.shots.push(x);
    G.pickups.length = 0; for (const x of clone(s.pickups, map, keep)) G.pickups.push(x);
    G.tiles.blockers = clone(s.blockers, map, keep);
    G.time = s.time; G.run.rng.set(s.rng); G.run.time = s.rtime; Object.assign(G.run.stats, s.stats); G.run.shards = s.shards; G.run.over = s.over; G.run.overT = s.overT; G.state = s.state;
  }

  // Cosmetic effects are switched off while the bot runs (speed); gameplay never reads them.
  let saved = null;
  function quiet(on) {
    const fx = G.fx;
    if (on && !saved) { saved = {}; for (const k of ['spark', 'dust', 'ring', 'ghost', 'floatText', 'say']) { saved[k] = fx[k]; fx[k] = () => {}; } }
    else if (!on && saved) { Object.assign(fx, saved); saved = null; }
  }

  // ---------------------------------------------------------------- actions
  const ACTS = [];
  for (const dir of [0, -1, 1]) for (const jump of [0, 1]) ACTS.push({ dir, jump });
  const ACT_NAME = a => (a.dir < 0 ? 'L' : a.dir > 0 ? 'R' : '-') + (a.jump ? 'J' : '');
  // In a fight the bot also holds slash, and Up when the boss is overhead (a heron's head is far above a standing player).
  const apply = (a, fight) => {
    let up = false;
    if (fight) { const b = G.rooms.current.boss, p = G.players[0], q = b.rect(); up = q.y1 < p.y - 70 && p.x > q.x0 - 30 && p.x < q.x1 + 30; }
    D.setInput(0, { left: a.dir < 0, right: a.dir > 0, jump: !!a.jump, attack: false, dash: false, down: false, up });
  };

  function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // How long the boss has been in its current state (a player needs a moment to see an opening).
  const age = () => { const b = G.rooms.current.boss; if (b._st !== b.state) { b._st = b.state; b._age = 0; } else b._age += STEP; };

  // Distance from the player to the boss body (0 = within a slash).
  const gap = () => { const b = G.rooms.current.boss, p = G.players[0], q = b.rect(); return Math.max(0, Math.max(q.x0 - p.x, p.x - q.x1) - 60); };

  function run(o) {
    const mode = o.mode || 'dodge', fight = mode === 'fight', lat = o.lat === undefined ? 2 : o.lat, H = o.horizon || 10, N = o.samples || 20, rnd = mulberry(o.seed || 1);
    const p = G.players[0], b = G.rooms.current.boss, maxSteps = Math.round((o.maxT || 12) / STEP);
    quiet(true);
    p.hp = 60; const hp00 = p.hp;                                          // far from death: only hits are counted
    const queue = []; for (let i = 0; i < lat; i++) queue.push(ACTS[0]);
    const out = { hits: 0, hitAt: [], steps: 0, dealt: 0, over: false, hpStart: b.hp, log: [] };
    let pHp = p.hp;
    const rollout = (prefix, seq, bhp0) => {
      const hp0 = p.hp; let score = 0, t = 0;
      FB.sim = true;
      const bb0 = G.game.bossBeaten, ce0 = G.game.checkEnd; G.game.bossBeaten = () => {}; G.game.checkEnd = () => {};    // a rollout that kills the boss must not hand out the win
      try {
        for (const a of prefix.concat(seq)) {
          apply(a, fight);
          for (let i = 0; i < K; i++) {
            if (fight) { age(); D.setInput(0, { attack: i % 8 < 4 && (!o.open || (o.open.has(b.state) && b._age >= (o.delay || 0))) }); }
            D.step(1); t++;
            if (p.hp < hp0 || p.down) return -1000 + t * 0.4;
            if (b.state === 'dead') return 5000;
          }
        }
        score += (bhp0 - b.hp) * 4;
        if (fight && (!o.open || o.open.has(b.state))) score -= gap() * 0.02;
        return score;
      } finally { FB.sim = false; G.game.bossBeaten = bb0; G.game.checkEnd = ce0; }
    };
    try {
      let plan = null, planAge = 0;
      while (out.steps < maxSteps && b.state !== 'dead' && !p.down) {
        if (o.until && o.until(b, out)) break;
        const s0 = snap(), bhp0 = b.hp;
        // keep the current plan while it is still safe (and, in a fight, for at most two ticks); otherwise search again
        let keep = false;
        if (plan && plan.length >= H && planAge < (fight ? 2 : 6)) { restore(s0); keep = rollout(queue, plan.slice(0, H), bhp0) > -500; }
        if (!keep) {
          let best = null, bs = -Infinity;
          const cands = [];
          for (const a of ACTS) cands.push(Array(H).fill(a));
          // structured family: move d1 for w macros, then jump (direction d2) for j macros, then keep d2
          for (const d1 of [0, -1, 1]) for (const w of [0, 2, 4, 6]) for (const d2 of [0, -1, 1]) for (const j of [2, 3, 5]) {
            const seq = []; for (let i = 0; i < H; i++) seq.push(i < w ? { dir: d1, jump: 0 } : i < w + j ? { dir: d2, jump: 1 } : { dir: d2, jump: 0 });
            cands.push(seq);
          }
          for (let n = 0; n < N; n++) {
            const seq = []; let prev = ACTS[Math.floor(rnd() * ACTS.length)];
            for (let i = 0; i < H; i++) { if (rnd() < 0.4) prev = ACTS[Math.floor(rnd() * ACTS.length)]; seq.push(prev); }
            cands.push(seq);
          }
          for (const seq of cands) {
            restore(s0);
            const sc = rollout(queue, seq, bhp0) + (seq[0].dir === 0 && !seq[0].jump ? 0.01 : 0);
            if (sc > bs) { bs = sc; best = seq; }
          }
          plan = best.slice(); planAge = 0;
        }
        restore(s0);
        const d = plan.shift(); plan.push(plan[plan.length - 1] || ACTS[0]); planAge++;
        queue.push(d);
        const a = queue.shift();
        apply(a, fight);
        for (let i = 0; i < K; i++) {
          if (fight) { age(); D.setInput(0, { attack: i % 8 < 4 && (!o.open || (o.open.has(b.state) && b._age >= (o.delay || 0))) }); }
          D.step(1); out.steps++;
          if (p.hp < pHp) { out.hits++; out.hitAt.push(+(out.steps * STEP).toFixed(2)); pHp = p.hp; plan = null; }
        }
        if (o.log) out.log.push(ACT_NAME(a));
      }
    } finally { quiet(false); D.setInput(0, { left: false, right: false, jump: false, attack: false, dash: false }); }
    out.t = out.steps * STEP; out.dealt = out.hpStart - b.hp; out.dead = b.state === 'dead'; out.hpLost = hp00 - p.hp;
    return out;
  }

  const FB = { snap, restore, run, quiet, gap, sim: false };
  return FB;
})();
