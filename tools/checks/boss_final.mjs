// The Long Clock (boss id long_clock, arena room final_arena): attacks, fare slots, Warden bonuses, slashes alone, a soak, two screenshots.
// Until regions.js points final at long_clock and the final pool, the check patches the run's final arena node itself (setup below).
export default async ({ page, shots }) => {
  await page.evaluate(() => { G.debug.fullCharts = true; });      // these checks use every cut on every Warden
  await page.evaluate(() => {
    const D = G.debug;
    // A fresh run with the final arena node set to the Long Clock; the fight is started with the party inside the door.
    window.T = {
      setup(beaten = [], tokens = [], god = true, seed = 5) {
        D.newRun(seed); D.god(god);
        for (const r of beaten) G.run.beaten[r] = true;
        const node = G.run.graph.nodes[G.run.graph.regions.final.arena];
        if (node.def !== 'final_arena' || !node.content[0] || node.content[0].id !== 'long_clock') { node.def = 'final_arena'; node.content = [{ type: 'boss', id: 'long_clock' }]; }
        for (const t of tokens) D.give(t);
        if (!D.startBoss('final')) throw new Error('could not start the fight');
        return G.rooms.current.boss;
      },
      boss: () => G.rooms.current.boss,
      // Stand next to the clock and slash whenever `when(boss)` is true.
      slasher(b, side = 1) { D.place(0, b.x + side * 125, b.floor, -side); },
    };
  });

  // ---- 0. definitions
  const defs = await page.evaluate(() => {
    const r = G.roomDefs.final_arena, d = G.bossDefs.long_clock;
    return { room: r && { kind: r.kind, region: r.region, doorCol: r.doorCol, floorX: r.floorX, cols: r.cols, rows: r.rows }, boss: d && { hp: d.hp, spots: Object.keys(d.spots), contact: d.contact },
      wired: G.regionDefs.final.boss, pool: G.regionDefs.final.pool };
  });
  if (!defs.room || defs.room.kind !== 'arena' || defs.room.region !== 'final' || defs.room.cols !== 30 || defs.room.rows !== 17) throw new Error('arena room: ' + JSON.stringify(defs.room));
  if (defs.room.doorCol !== 3 || defs.room.floorX[0] !== 128 || defs.room.floorX[1] !== 928) throw new Error('arena door/floor: ' + JSON.stringify(defs.room));
  if (!defs.boss || defs.boss.hp !== 1300 || defs.boss.spots.join() !== 'pierce,arc,burst,ground') throw new Error('boss def: ' + JSON.stringify(defs.boss));

  // ---- 1. every attack state in 150 s of play, both phases; tells last 0.45 s or more; at most three crabs; every slot exposed at some time
  const cov = await page.evaluate(() => {
    const D = G.debug, b = T.setup([], ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']);
    const need = ['ringTell', 'ring', 'handsTell', 'hands', 'rainTell', 'rain', 'windTell', 'wind', 'recover', 'transition'];
    const seen = {}, seen2 = {}, exposed = {}, entered = {}, minDur = {}, bad = [];
    let prev = '', since = 0, maxCrabs = 0, p2Armed = 0, openT = 0, armT = 0, hpAtP2 = null, t0 = G.time;
    T.slasher(b); b.maxHp = b.hp = 760;               // coverage needs both phases inside 150 s, not the tuned health (fight_len measures that)
    for (let i = 0; i < 150 * 120; i++) {
      const slashing = b.hp > b.maxHp * 0.12;
      D.setInput(0, { attack: slashing && i % 40 < 2 && b.state !== 'intro' });
      D.step(1);
      if (b.state !== prev) {
        if (prev && /Tell$/.test(prev)) minDur[prev] = Math.min(minDur[prev] === undefined ? 9 : minDur[prev], G.time - since);
        prev = b.state; since = G.time; entered[b.state] = (entered[b.state] || 0) + 1;
      }
      (b.flags.p2 ? seen2 : seen)[b.state] = 1;
      if (b.flags.p2 && hpAtP2 === null) hpAtP2 = b.hp / b.maxHp;
      for (const s of b.spots) if (b.isExposed(s)) exposed[s.cls] = 1;
      const crabs = G.rooms.current.enemies.filter(e => e.id === 'ballast_crab' && !e.dead).length; maxCrabs = Math.max(maxCrabs, crabs);
      if (![b.x, b.y, b.hp].every(Number.isFinite) || (b.bob && !Number.isFinite(b.bob.x))) bad.push('NaN boss');
      if (b.flags.p2 && b.bob && b.state !== 'transition' && b.state !== 'stagger') p2Armed++;
      if (b.state === 'dead') break;
      if (i % 600 === 0 && Math.abs(G.players[0].x - (b.x + 125)) > 60) T.slasher(b);
      if (need.every(n => seen[n] || seen2[n]) && b.flags.p2 && Object.keys(exposed).length === 4 && p2Armed > 600 && G.time - t0 > 100) break;
    }
    const both = need.filter(n => seen[n] && seen2[n]);
    return { seen: need.filter(n => seen[n] || seen2[n]), missing: need.filter(n => !seen[n] && !seen2[n]), p2: Object.keys(seen2), both, exposed: Object.keys(exposed), minDur, maxCrabs, p2Armed, hpAtP2, secs: G.time - t0, bad, state: b.state };
  });
  if (cov.missing.length) throw new Error('attack states never entered in ' + cov.secs.toFixed(0) + ' s: ' + cov.missing.join(', '));
  if (cov.bad.length) throw new Error(cov.bad.join(' ; '));
  if (cov.exposed.length !== 4) throw new Error('slots never exposed in normal play: have ' + cov.exposed.join());
  for (const k in cov.minDur) if (cov.minDur[k] < 0.45) throw new Error(k + ' wind-up only ' + cov.minDur[k].toFixed(2) + ' s');
  if (cov.maxCrabs > 3) throw new Error('more than three crabs at once: ' + cov.maxCrabs);
  if (!cov.p2Armed) throw new Error('the pendulum never swung in phase two');
  if (!cov.p2.includes('transition')) throw new Error('no phase two transition');

  // ---- 2. each cut: matching baseline token, boss steered into the exposed state, three hits punch the slot and the token is void
  const cuts = [
    { cls: 'pierce', token: 'cobalt_awl', state: 'handsTell', at: [880, 384, -1], cd: 100 },       // right outer plank, at vent height
    { cls: 'arc', token: 'ochre_ladle', state: 'rainTell', at: [765, 288, -1], cd: 160 },          // right inner plank, lobbed onto the bell from above
    { cls: 'burst', token: 'cinder_bell', state: 'windTell', at: [628, 480, -1], cd: 160 },        // close, at the mainspring
    { cls: 'ground', token: 'basalt_roller', state: 'recover', at: [800, 480, -1], cd: 160 }       // slide in along the floor from the right
  ];
  const punched = [];
  for (const c of cuts) {
    const r = await page.evaluate(c => {
      const D = G.debug, clr = { up: false, left: false, right: false, down: false };
      let aim = {};                                   // the arc lob is aimed by what is held (none, Up, the facing way, Down)
      const tap = n => { D.setInput(0, aim); D.step(1); D.setInput(0, { item: true }); D.step(1); D.setInput(0, Object.assign({ item: false }, clr)); D.step(n); };
      const b = T.setup([], [c.token]), spot = () => b.spots.find(s => s.cls === c.cls), out = {};
      const hold = (state, vent = true) => D.holdBoss({ x: b.x, y: b.floor, face: 1, state, t: 99, ventOpen: vent, ventSide: 1 });
      out.open = spot().open; D.step(130);                                                         // let the intro end
      // sealed while not in its exposed state (the ground slot has no such rule)
      hold('idle', c.cls !== 'pierce'); D.place(0, ...c.at); D.step(2); if (c.cls !== 'ground') tap(c.cd);
      out.idleHp = spot().hp;
      if (c.cls === 'pierce') { D.holdBoss({ x: b.x, y: b.floor, face: 1, state: 'handsTell', t: 99, ventOpen: true, ventSide: -1 }); D.place(0, ...c.at); D.step(2); tap(c.cd); out.wrongSideHp = spot().hp; D.holdBoss({ x: b.x, y: b.floor, face: 1, state: 'handsTell', t: 99, ventOpen: true, ventSide: 1 }); }
      else hold(c.state);
      const hp0 = b.hp, hits = [];
      if (c.cls === 'arc') for (const a of [{}, { up: true }, { left: true }, { down: true }]) { aim = a; D.place(0, ...c.at); D.step(2); const h0 = spot().hp; tap(c.cd); if (spot().hp < h0) { hits.push(spot().hp); break; } }
      for (let k = hits.length; k < 3; k++) { D.place(0, ...c.at); D.step(2); tap(c.cd); hits.push(spot().hp); }
      const p = G.players[0];
      return Object.assign(out, { hits, broken: spot().broken, lost: hp0 - b.hp, max: b.maxHp, void: G.run.spent.includes(c.token) && !p.items.includes(c.token), flags: Object.assign({}, b.flags) });
    }, c);
    if (!r.open) throw new Error(c.cls + ': slot not open with its token');
    if (r.idleHp !== 3 || (r.wrongSideHp !== undefined && r.wrongSideHp !== 3)) throw new Error(c.cls + ': slot took a hit when it should be closed: ' + JSON.stringify(r));
    if (r.hits.join() !== '2,1,0' || !r.broken) throw new Error(c.cls + ': hits left ' + r.hits + ', broken ' + r.broken);
    if (r.lost < r.max * 0.1 - 0.01 || !r.void) throw new Error(c.cls + ': ' + JSON.stringify(r));
    punched.push(c.cls);
  }

  // ---- 3. Wardens: 12% off the health and one hazard each
  const w = await page.evaluate(() => {
    const m = b => ({ hp: b.maxHp, hp0: b.hp, mods: Object.assign({}, b.mods) });
    const base = m(T.setup([])), all = m(T.setup(['r1', 'r2', 'r3', 'r4'])), one = {};
    for (const r of ['r1', 'r2', 'r3', 'r4']) one[r] = m(T.setup([r]));
    // behaviour, not just numbers: ring speed, hand speed, spark count, summons
    const run = (beaten, state, secs, probe) => {
      const D = G.debug, b = T.setup(beaten); D.step(130); T.slasher(b, 1);
      let n = 0; const shoot = b.shoot.bind(b); b.shoot = d => { n++; return shoot(d); };
      b.last = state === 'ringTell' ? 'rings' : ''; b.set(state, 0.05); let v = 0, a0 = null, a1 = null;
      for (let i = 0; i < secs * 120; i++) {
        D.step(1);
        if (probe === 'ring' && !v) { const s = G.shots.find(s => s.rect); if (s) v = Math.abs(s.vx); }
        if (probe === 'hand' && b.state === 'hands' && b.hands[0] && !b.hands[0].ghost) { if (a0 === null) a0 = [b.hT, b.hands[0].a]; a1 = [b.hT, b.hands[0].a]; }
      }
      return { n, v, w: a0 && a1 && (a0[1] - a1[1]) / (a1[0] - a0[0]), crabs: G.rooms.current.enemies.filter(e => e.id === 'ballast_crab').length };
    };
    return { base, all, one,
      ring: [run([], 'ringTell', 2, 'ring').v, run(['r1'], 'ringTell', 2, 'ring').v],
      hand: [run([], 'handsTell', 3, 'hand').w, run(['r2'], 'handsTell', 3, 'hand').w],
      rain: [run([], 'rainTell', 3.6).n, run(['r3'], 'rainTell', 3.6).n],
      crabs: [run([], 'windTell', 3).crabs, run(['r4'], 'windTell', 3).crabs] };
  });
  if (Math.abs(w.base.hp - 1300) > 1e-6) throw new Error('base health ' + w.base.hp);
  if (Math.abs(w.all.hp - 1300 * 0.52) > 1e-6 || Math.abs(w.all.hp0 - w.all.hp) > 1e-6) throw new Error('four Wardens: health ' + w.all.hp + ', wanted ' + 1300 * 0.52);
  for (const r of ['r1', 'r2', 'r3', 'r4']) if (Math.abs(w.one[r].hp - 1300 * 0.88) > 1e-6) throw new Error(r + ' alone should take 12%: ' + w.one[r].hp);
  if (!(w.ring[1] < w.ring[0] * 0.8)) throw new Error('r1 should slow the floor rings: ' + w.ring);
  if (!(w.hand[1] < w.hand[0] * 0.8)) throw new Error('r2 should slow the steam hands: ' + w.hand);
  if (!(w.rain[1] < w.rain[0] * 0.75)) throw new Error('r3 should thin the spark rain: ' + w.rain);
  if (!(w.crabs[0] >= 1 && w.crabs[0] <= 3 && w.crabs[1] === 0)) throw new Error('r4 should end the summons: ' + w.crabs);

  // ---- 4. the hazards can be avoided with a jump (non-god runs: no hurt allowed). Rings and hands from both sides, then the pendulum.
  const dodge = await page.evaluate(() => {
    const D = G.debug, out = {};
    const jump = () => { D.setInput(0, { jump: true }); D.step(1); D.setInput(0, { jump: false }); };
    for (const [name, state] of [['rings', 'ringTell'], ['hands', 'handsTell']]) for (const side of [1, -1]) for (const d of [105, 170, 230]) {
      const b = T.setup([], [], false); D.step(130); D.place(0, b.x + side * d, b.floor, -side); const p = G.players[0]; let jumped = -999;
      b.last = name === 'rings' ? 'rings' : 'hands'; b.set(state, 0.1);
      for (let i = 0; i < 12 * 120 && !(b.state === 'recover') ; i++) {
        if (name === 'rings') {                                              // jump just before each pair of waves appears
          if (p.onGround && jumped < i - 60 && ((b.state === 'ringTell' && b.t < 0.1) || (b.state === 'ring' && b.ringT < 0.09))) { jumped = i; }
        } else {
          for (const h of b.hands) if (!h.ghost && h.s === side && h.a > 0.2 && p.onGround && jumped < i - 100) {
            const dc = 150 / Math.tan(h.a), vc = 150 * b.mods.handSpeed / Math.sin(h.a) ** 2, ttc = (d - dc) / vc;     // time until the jet reaches us
            if (ttc > 0.06 && ttc < 0.24) { jumped = i; D.setInput(0, { [side > 0 ? 'right' : 'left']: true }); }
          }
          if (p.onGround && i - jumped > 8) D.setInput(0, { right: false, left: false });
        }
        D.setInput(0, { jump: i - jumped >= 0 && i - jumped < 30 }); D.step(1);
      }
      D.setInput(0, { right: false, left: false, jump: false });
      out[name + ' ' + (side > 0 ? 'R' : 'L') + d] = { hurt: 5 - p.hp, jumps: jumped > -999, state: b.state };
    }
    // pendulum: phase two, jump when it comes at us
    for (const d of [60, 140]) {
      const b = T.setup([], [], false); D.step(130); b.hp = b.maxHp * 0.4; b.set('idle', 0); D.step(2); D.place(0, b.x + d, b.floor, -1); const p = G.players[0];
      let px = null, last = -999; b.flags.p2 = true;
      for (let i = 0; i < 24 * 120; i++) {
        if (b.state === 'transition') { D.place(0, b.x + d, b.floor, -1); }
        else if (b.bob) {
          const v = px === null ? 0 : b.bob.x - px, dx = b.bob.x - p.x;
          if (p.onGround && dx * v < 0 && Math.abs(dx) < 115 && i - last > 60 && b.bob.y > b.floor - 120) { last = i; }
          px = b.bob.x;
        }
        D.setInput(0, { jump: i - last >= 0 && i - last < 30 }); D.step(1);
        if (/Tell$|^(rain|hands|ring|wind)$/.test(b.state)) b.set('recover', 2);                // the pendulum alone
        if (G.players[0].hp < 5) break;
      }
      out['pendulum ' + d] = { hurt: 5 - p.hp, p2: b.flags.p2, t: G.time };
    }
    return out;
  });
  const hurt = Object.entries(dodge).filter(([k, v]) => v.hurt > 0);
  if (hurt.length) throw new Error('hazards not avoidable by a simple bot: ' + hurt.map(([k, v]) => k + ' lost ' + v.hurt).join(', '));
  if (!Object.entries(dodge).some(([k, v]) => /hands/.test(k) && v.jumps)) throw new Error('the hands probe never jumped');

  // ---- 5. slashes alone (no token, every slot sealed, no Warden beaten) kill it and win the run
  const kill = await page.evaluate(() => {
    const D = G.debug, b = T.setup([], []); let t0 = G.time;
    T.slasher(b);
    for (let i = 0; i < 600 * 120 && b.state !== 'dead'; i++) { D.setInput(0, { attack: i % 40 < 2 }); D.step(1); if (i % 300 === 0) T.slasher(b); }
    D.step(300); D.setInput(0, { attack: false }); D.step(60);
    const s = D.state();
    return { dead: b.state === 'dead', secs: G.time - t0, beaten: s.run.beaten.final, over: s.run.over, errors: s.errors, door: s.room.props.some(p => p.type === 'door'), fight: s.room.fight };
  });
  if (!kill.dead || !kill.beaten || kill.over !== 'win' || kill.fight) throw new Error('slashes alone: ' + JSON.stringify(kill));

  // ---- 6. soak: 90 s of random input, in a fight with four tokens and every move unlocked
  const soak = await page.evaluate(() => {
    const D = G.debug, acts = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'item', 'heal', 'cycle', 'interact'];
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7), bad = [];
    const b = T.setup([], ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']); D.unlockAll();
    let held = {};
    for (let i = 0; i < 90 * 120 && bad.length < 5; i++) {
      if (i % 9 === 0) { held = {}; for (const a of acts) held[a] = rng() < 0.3; D.setInput(0, held); }
      if (i % 20000 === 19999) b.hp = Math.min(b.hp, b.maxHp * 0.45);                // make sure phase two gets soaked as well
      D.step(1);
      if (i % 10 === 0) {
        const s = D.state(), room = s.room;
        for (const p of s.players) {
          if (![p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite)) bad.push('NaN player');
          else if (!room.transition && (p.x < -8 || p.x > room.cols * 32 + 8 || p.y < 0 || p.y > room.rows * 32)) bad.push('out of bounds ' + p.x.toFixed(0) + ',' + p.y.toFixed(0));
        }
        for (const e of room.enemies) if (![e.x, e.y].every(Number.isFinite)) bad.push('NaN enemy');
        if (room.boss && ![room.boss.x, room.boss.y, room.boss.hp].every(Number.isFinite)) bad.push('NaN boss');
        for (const sh of G.shots) if (![sh.x, sh.y].every(Number.isFinite)) bad.push('NaN shot');
      }
    }
    return { bad, boss: D.state().room.boss && D.state().room.boss.state, hp: b.hp };
  });
  if (soak.bad.length) throw new Error('soak: ' + soak.bad.join(' ; '));

  // ---- 7. screenshots: phase one (steam hands sweeping) and phase two (pendulum swinging, bell chiming)
  const canvas = page.locator('#game');
  await page.evaluate(() => {
    const D = G.debug, b = T.setup([], ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']); D.step(130);
    D.place(0, 880, 384, -1); b.set('handsTell', 0.05);
    for (let i = 0; i < 12 * 120 && !(b.state === 'hands' && b.hT > 1.55); i++) D.step(1);
    D.place(0, 250, 480, 1);
  });
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: shots + '/boss_final_1.png' });
  await page.evaluate(() => {
    const D = G.debug, b = T.setup([], ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']); D.step(130);
    b.hp = b.maxHp * 0.4; b.set('idle', 0); D.step(2);
    for (let i = 0; i < 12 * 120 && b.state !== 'transition'; i++) D.step(1);
    D.step(120 * 2); b.last = 'wind'; b.set('rainTell', 0.05); D.place(0, 765, 288, -1); D.step(220);
    for (let i = 0; i < 6 * 120 && !(b.bob && b.bob.x < b.x - 150); i++) D.step(1);
  });
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: shots + '/boss_final_2.png' });

  return 'attacks ' + cov.seen.length + '/10 in ' + cov.secs.toFixed(0) + ' s, slots punched ' + punched.join('/') + ', 4 Wardens -> ' + w.all.hp.toFixed(1) + ' hp, slash kill in ' + kill.secs.toFixed(0) + ' s' + (defs.wired === 'long_clock' ? '' : ' (regions.js not wired yet: final boss is ' + defs.wired + ')');
};
