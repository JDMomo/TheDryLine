// The Lamp-Heron (r2), fought in the arena the real graph builds for region r2.
// 1. every attack state is entered within 120 s, every wind-up is long enough (also in rage)
// 2. for each cut: the slot is sealed outside its exposed state, then three hits in the exposed state punch it and void the token
// 3. a punched slot changes the fight (no sweep, longer stuck time, weaker gust, fewer sparks)
// 4. slashes alone kill it (a bot that chases it, and a pinned boss) and it is marked beaten
// 5. 90 s of random input: no error, NaN or out-of-bounds; then a screenshot to tools/shots/boss_r2.png
export default async ({ page, shots }) => {
  await page.evaluate(() => { G.debug.fullCharts = true; });      // these checks use every cut on every Warden
  await page.evaluate(() => {
    window.__setup = (seed, items = []) => {
      const D = G.debug; D.newRun(seed); D.god(true);
      for (const i of items) D.give(i);
      if (!D.startBoss('r2')) throw new Error('could not start the fight');
      const b = G.rooms.current.boss; if (!b || b.id !== 'lamp_heron') throw new Error('the arena has no Lamp-Heron');
      return D.state().room.boss.floor;
    };
    // Watch the boss for `seconds`: states entered, the shortest wind-ups, the longest stuck / gust, most bolts at once.
    window.__observe = (seconds, keepAt) => {
      const D = G.debug, b = G.rooms.current.boss, seen = {}, len = {}, run = {}; let maxBolts = 0, prev = '', n = 0;
      for (let i = 0; i < 120 * seconds; i++) {
        if (i % 90 === 0 && keepAt) D.place(0, keepAt, b.floor, 1);
        D.step(1);
        const s = b.state; seen[s] = (seen[s] || 0) + 1;
        if (s !== prev) { if (prev) len[prev] = Math.min(len[prev] === undefined ? 1e9 : len[prev], n); prev = s; n = 0; }
        n++; run[s] = Math.max(run[s] || 0, n);
        maxBolts = Math.max(maxBolts, G.shots.filter(k => k.hostile && k.rect).length);
        if (![b.x, b.y, b.hp, b.hx, b.hy].every(Number.isFinite)) throw new Error('NaN boss ' + b.state);
      }
      return { seen, shortest: len, longest: run, maxBolts };
    };
  });

  // ---- 1. coverage and wind-ups
  const cov = await page.evaluate(() => {
    const floor = __setup(5), D = G.debug;
    const calm = __observe(120, 470);
    G.rooms.current.boss.hp = 200;                       // below half hp
    const rage = __observe(60, 470);
    return { calm, rage, floor };
  });
  const attackStates = ['peckTell', 'peckStab', 'peckStuck', 'sweepTell', 'sweep', 'gustTell', 'gust', 'fallTell', 'fall', 'recover'];
  for (const s of attackStates) if (!cov.calm.seen[s]) throw new Error('state never entered in 120 s: ' + s + ' ' + JSON.stringify(cov.calm.seen));
  const tellSteps = { peckTell: 0.7, sweepTell: 0.8, gustTell: 0.75, fallTell: 0.85 };
  for (const t in tellSteps) {
    const calmMin = cov.calm.shortest[t] / 120, rageMin = cov.rage.shortest[t] === undefined ? 9 : cov.rage.shortest[t] / 120;
    if (calmMin < 0.45) throw new Error(t + ' wind-up only ' + calmMin.toFixed(2) + ' s');
    if (rageMin < 0.35) throw new Error(t + ' rage wind-up only ' + rageMin.toFixed(2) + ' s');
  }
  for (const s of ['sweepTell', 'gustTell', 'fallTell', 'peckTell']) if (!cov.rage.seen[s]) throw new Error('rage never used ' + s);
  for (const s of ['sweep', 'gust', 'fall']) if (cov.calm.longest[s] / 120 > 7) throw new Error(s + ' lasts too long');

  // ---- 2. slots
  const items = { pierce: 'cobalt_awl', arc: 'ochre_ladle', burst: 'cinder_bell', ground: 'basalt_roller' };
  const res = await page.evaluate(items => {
    const D = G.debug, out = {};
    let staggered = false;                                         // held states overwrite 'stagger' on the next step, so look every step
    const run = n => { for (let i = 0; i < n; i++) { D.step(1); if (G.rooms.current.boss.state === 'stagger') staggered = true; } };
    const tap = (a, n = 2) => { D.setInput(0, { [a]: true }); run(n); D.setInput(0, { [a]: false }); run(1); };
    const slot = cls => D.state().room.boss.spots.find(s => s.cls === cls);
    for (const cls of ['pierce', 'arc', 'burst', 'ground']) {
      const floor = __setup(7, [items[cls]]), id = items[cls];
      const hold = f => D.holdBoss(Object.assign({ x: 592, y: floor, face: -1, hx: 60, hy: -188, ha: 0.25 }, f));
      const exposedHold = { pierce: { state: 'sweep', hx: 72, hy: -150, ha: 0.35 }, arc: { state: 'idle' }, burst: { state: 'peckStuck', t: 5, hx: 100, hy: -46, ha: 1.4 },
        ground: { state: 'peckTell', hx: 120, hy: -234, ha: -0.6 } }[cls];
      const shootOnce = () => {                                           // one token use from the right place for this cut
        if (cls === 'pierce') { D.place(0, 520, floor, -1); run(1); D.setInput(0, { up: true }); tap('item'); D.setInput(0, { up: false }); }
        else if (cls === 'burst') { D.place(0, 470, floor, 1); run(1); tap('item'); }
        else if (cls === 'ground') { D.place(0, 400, floor, 1); run(1); tap('item'); }
      };
      staggered = false; const hp0 = D.state().room.boss.hp, o = { sealedOutside: true, hits: [] };
      if (!slot(cls).open) throw new Error(cls + ' slot did not open with its token');
      // not exposed: the slot must not take a punch
      if (cls !== 'arc') {
        hold(Object.assign({}, exposedHold, { state: 'idle' })); shootOnce(); run(100);
        o.sealedOutside = slot(cls).hp === 3;
      }
      hold(exposedHold);
      if (cls === 'arc') {
        // lob from the right-hand shelf (feet at y 384) at a boss standing a little way off: find the distance where it lands on the hatch
        let off = 90;
        for (let k = 0; k < 40 && !slot('arc').broken; k++, off += 12) {
          if (off > 330) off = 90;
          hold({ state: 'idle', x: 760 - off }); D.place(0, 760, 384, -1); run(1); tap('item'); run(110);
          const hp = slot('arc').hp; if (o.hits.length === 0 || hp !== o.hits[o.hits.length - 1]) o.hits.push(hp);
          if (o.hits.length >= 1 && hp < 3) { /* keep the same distance for the next hits */ for (let j = 0; j < 8 && !slot('arc').broken; j++) { hold({ state: 'idle', x: 760 - off }); D.place(0, 760, 384, -1); run(1); tap('item'); run(125); const h2 = slot('arc').hp; if (h2 !== o.hits[o.hits.length - 1]) o.hits.push(h2); } break; }
        }
        o.sealedOutside = true;
      } else for (let k = 0; k < 3; k++) { if (cls === 'burst' && k === 2) D.holdBoss(null); shootOnce(); run(cls === 'burst' ? 150 : 110); o.hits.push(slot(cls).hp); }
      const s = D.state(), b = s.room.boss, p = s.players[0];
      Object.assign(o, { id, broken: slot(cls).broken, lost: (hp0 - b.hp), maxHp: b.maxHp, state: staggered ? 'stagger' : b.state, void: s.run.spent.includes(id) && !p.items.includes(id) });
      out[cls] = o;
    }
    return out;
  }, items);
  for (const cls of ['pierce', 'arc', 'burst', 'ground']) {
    const r = res[cls];
    if (!r.sealedOutside) throw new Error(cls + ': slot took a hit outside its exposed state');
    if (!r.broken || r.state !== 'stagger' || !r.void || r.lost < r.maxHp * 0.1 - 1) throw new Error(cls + ': ' + JSON.stringify(r));
    if (cls !== 'arc' && r.hits.join() !== '2,1,0') throw new Error(cls + ': hits left ' + r.hits);
  }

  // ---- 3. what each punch removes (after the stagger, the boss is released and watched)
  const eff = await page.evaluate(items => {
    const D = G.debug, out = {}, run = n => D.step(n);
    for (const cls of ['pierce', 'ground', 'arc', 'burst']) {
      const floor = __setup(9, [items[cls]]), b = G.rooms.current.boss;
      b.spots.find(s => s.cls === cls).broken = true; b.spots.find(s => s.cls === cls).def.onBreak(b);   // the same hook a punch runs
      out[cls] = __observe(70, 470);
    }
    return out;
  }, items);
  if (eff.pierce.seen.sweepTell || eff.pierce.seen.sweep) throw new Error('lamp punched but it still sweeps');
  if (!eff.pierce.seen.gust || !eff.pierce.seen.fall) throw new Error('lamp punched: other attacks missing');
  if (eff.ground.longest.peckStuck < 2.0 * 120 - 3) throw new Error('ankle punched but stuck time ' + eff.ground.longest.peckStuck / 120);
  if (eff.arc.longest.gust > 1.9 * 120 + 3) throw new Error('hatch punched but the gust lasts ' + eff.arc.longest.gust / 120);
  if (eff.burst.maxBolts > 2) throw new Error('throat punched but ' + eff.burst.maxBolts + ' bolts fall');

  // ---- 4. slashes alone
  const kill = await page.evaluate(() => {
    const D = G.debug, out = {};
    // a) a bot that chases the real boss and slashes (no tokens at all)
    let floor = __setup(21), b = G.rooms.current.boss, steps = 0;
    D.state().players[0];
    while (b.state !== 'dead' && steps < 120 * 420) {
      const p = G.players[0], hx = b.state === 'peckStuck' ? b.headWorld().x : b.x, dx = hx - p.x;
      D.setInput(0, { left: dx < -45, right: dx > 45, attack: steps % 24 < 3, jump: false, up: false });
      if (steps % 60 === 0 && G.shots.some(s => s.hostile && Math.abs(s.x - p.x) < 140 && s.y > floor - 130)) { D.setInput(0, { jump: true }); }
      D.step(1); steps++; if (steps % 20 === 0) D.setInput(0, { jump: false });
    }
    out.bot = { dead: b.state === 'dead', seconds: steps / 120, beaten: !!G.run.beaten.r2 };
    // b) a pinned boss
    floor = __setup(22); b = G.rooms.current.boss; D.holdBoss({ x: 720, y: floor, face: -1, state: 'idle' });
    for (let i = 0; i < 200 && b.state !== 'dead'; i++) { D.place(0, 660, floor, 1); D.setInput(0, { attack: true }); D.step(2); D.setInput(0, { attack: false }); D.step(36); }
    const s = D.state();
    out.pinned = { dead: s.room.boss.state === 'dead', beaten: !!s.run.beaten.r2, fight: s.room.fight, locked: s.room.locked, hp: s.room.boss.maxHp };
    return out;
  });
  if (!kill.pinned.dead || !kill.pinned.beaten || kill.pinned.fight || kill.pinned.locked) throw new Error('pinned kill: ' + JSON.stringify(kill.pinned));
  if (!kill.bot.dead || !kill.bot.beaten) throw new Error('slash bot did not win in 420 s: ' + JSON.stringify(kill.bot));
  if (kill.pinned.hp !== 1180) throw new Error('hp should be 1180');

  // ---- 5. random input, 90 s, all tokens
  const soak = await page.evaluate(() => {
    const D = G.debug, acts = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'item', 'heal', 'cycle', 'interact'], bad = [];
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(77);
    D.unlockAll(); __setup(31, ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']);
    let held = {};
    for (let i = 0; i < 120 * 90 && bad.length < 5; i++) {
      if (i % 9 === 0) { held = {}; for (const a of acts) held[a] = rng() < 0.3; D.setInput(0, held); }
      D.step(1);
      if (i % 10 === 0) {
        const s = D.state(), r = s.room, p = s.players[0], b = r.boss;
        if (![p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite)) bad.push('NaN player');
        else if (p.x < -8 || p.x > r.cols * 32 + 8 || p.y < 0 || p.y > r.rows * 32) bad.push('player out of bounds ' + p.x + ',' + p.y);
        if (b && ![b.x, b.y, b.hp].every(Number.isFinite)) bad.push('NaN boss');
        if (b && (b.x < b.minX - 1 || b.x > b.maxX + 1)) bad.push('boss out of bounds ' + b.x);
      }
    }
    return { bad, state: D.state().room.boss && D.state().room.boss.state };
  });
  if (soak.bad.length) throw new Error(soak.bad.join(' ; '));

  // ---- screenshot: the wind-up of a peck, all four slots open
  await page.evaluate(() => {
    const D = G.debug; __setup(41, ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']);
    const b = G.rooms.current.boss; D.place(0, 470, b.floor, 1);
    for (let i = 0; i < 120 * 40 && !(b.state === 'peckTell' && b.t < 0.3); i++) { if (i % 90 === 0) D.place(0, 470, b.floor, 1); D.step(1); }
  });
  await page.waitForTimeout(150);
  await page.locator('#game').screenshot({ path: shots + '/boss_r2.png' });
  return 'bot win in ' + kill.bot.seconds.toFixed(0) + ' s; tells ' + Object.entries(cov.calm.shortest).filter(([k]) => /Tell/.test(k)).map(([k, v]) => k + ' ' + (v / 120).toFixed(2)).join(', ');
};
