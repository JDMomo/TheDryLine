// The Switchman Idol (r3): every attack state is entered, wind-ups are long enough, each fare slot can be punched with its
// baseline token (and stays shut outside its exposed state), slashes alone kill it, and 90 s of random input breaks nothing.
// Saves tools/shots/boss_r3.png.
const TOKENS = { pierce: 'cobalt_awl', arc: 'ochre_ladle', burst: 'cinder_bell', ground: 'basalt_roller' };
const ID = 'switchman_idol';

export default async ({ page, shots }) => {
  const notes = [];

  // 1. attack coverage and wind-up lengths over 120 s (the second minute is spent below half health)
  const cov = await page.evaluate(id => {
    const D = G.debug; D.newRun(5); D.god(true); D.startBoss(id);
    const b = G.rooms.current.boss, log = [], seen = {}, orig = b.set.bind(b), bad = [];
    b.set = (s, t) => { log.push([s, t, b.rage]); orig(s, t); };
    const fl = b.floor;
    for (let i = 0; i < 120 * 120; i++) {
      if (i === 120 * 60) b.hp = b.maxHp * 0.4;
      if (i % 60 === 0) D.place(0, 200, fl, 1);
      D.step(1);
      if (![b.x, b.y, b.hp, b.lie].every(Number.isFinite)) bad.push('NaN boss');
    }
    return { log, bad, errors: D.state().errors, hp: b.maxHp };
  }, ID);
  for (const s of ['ringTell', 'ring', 'geyserTell', 'geyser', 'toppleTell', 'topple', 'lying', 'leverTell', 'lever', 'recover']) {
    if (!cov.log.some(l => l[0] === s)) throw new Error('state never entered in 120 s: ' + s);
  }
  for (const [s, t, rage] of cov.log) if (/Tell$/.test(s) && t < (rage ? 0.35 : 0.45)) throw new Error('wind-up too short: ' + s + ' ' + t.toFixed(2) + ' (rage ' + rage + ')');
  const tells = cov.log.filter(l => /Tell$/.test(l[0]));
  if (!tells.some(l => l[2]) || !tells.some(l => !l[2])) throw new Error('no tells seen in both phases');
  if (cov.bad.length) throw new Error(cov.bad.join(';'));
  notes.push(tells.length + ' attacks, shortest tell ' + Math.min(...tells.map(l => l[1])).toFixed(2));

  // 2. each fare slot, with the baseline token of its cut. The boss is held at x 720 facing left with the field that exposes the slot.
  const hold = { pierce: { sig: true }, arc: {}, burst: { lie: 1 }, ground: {} };
  // [x, y, face] candidates, scanned until one punches: ledge shots at the lens, a lob onto the crown, the bell near the seam, a slab at the foot
  const spots = {
    pierce: Array.from({ length: 18 }, (_, i) => [270 + i * 10, 384, 1]),
    arc: Array.from({ length: 30 }, (_, i) => [720 - 60 - i * 6, 480, 1]),
    burst: Array.from({ length: 30 }, (_, i) => [720 - 40 - i * 6, 480, 1]),
    ground: Array.from({ length: 30 }, (_, i) => [720 - 60 - i * 8, 480, 1])
  };
  for (const cut of Object.keys(TOKENS)) {
    const r = await page.evaluate(([cut, token, hold, cands, id]) => {
      const D = G.debug, run = n => D.step(n), tap = (a, n = 1) => { D.setInput(0, { [a]: true }); run(n); D.setInput(0, { [a]: false }); run(1); };
      const fresh = () => { D.newRun(9); D.god(true); D.give(token); D.startBoss(id); D.holdBoss(Object.assign({ x: 720, y: D.state().room.boss.floor, face: -1, sig: false, lie: 0 }, hold)); run(2); };
      fresh();
      const items = D.state().players[0].items.slice(), open = D.state().room.boss.spots.find(s => s.cls === cut).open, hp0 = D.state().room.boss.hp;
      let hits = null, at = null;
      for (const [x, y, face] of cands) {
        fresh(); D.place(0, x, y, face); run(1); tap('item'); run(150);
        const sp = D.state().room.boss.spots.find(s => s.cls === cut);
        if (sp.hp < 3) {
          at = x; hits = [sp.hp];
          for (let k = 0; k < 2; k++) { D.place(0, x, y, face); run(1); tap('item'); run(150); hits.push(D.state().room.boss.spots.find(s => s.cls === cut).hp); }
          break;
        }
      }
      const s = D.state(), b = s.room.boss;
      return { open, items, at, hits, broken: b.spots.find(x => x.cls === cut).broken, state: b.state, lost: hp0 - b.hp, maxHp: b.maxHp, void: s.run.spent.includes(token) && !s.players[0].items.includes(token), errors: s.errors };
    }, [cut, TOKENS[cut], hold[cut], spots[cut], ID]);
    if (!r.open) throw new Error(cut + ': the slot did not open with the token');
    if (!r.hits || r.hits.join() !== '2,1,0' || !r.broken) throw new Error(cut + ': ' + JSON.stringify(r));
    if (r.lost < r.maxHp * 0.2 - 0.01 || !r.void || r.state !== 'stagger') throw new Error(cut + ': ' + JSON.stringify(r));
    notes.push(cut + '@' + r.at);
  }

  // slots must stay shut outside their exposed state: the lens while it does not signal, the seam while it stands
  const shut = await page.evaluate(([spots, id]) => {
    const D = G.debug, run = n => D.step(n), out = {};
    for (const [cut, token, hold, cands] of [['pierce', 'cobalt_awl', { sig: false, lie: 0 }, spots.pierce], ['burst', 'cinder_bell', { lie: 0 }, spots.burst], ['ground', 'basalt_roller', { lie: 1 }, spots.ground]]) {
      D.newRun(9); D.god(true); D.give(token); D.startBoss(id);
      D.holdBoss(Object.assign({ x: 720, y: D.state().room.boss.floor, face: -1 }, hold));
      for (const [x, y, face] of cands) { D.place(0, x, y, face); run(1); D.setInput(0, { item: true }); run(2); D.setInput(0, { item: false }); run(110); }
      out[cut] = D.state().room.boss.spots.find(s => s.cls === cut).hp;
    }
    return out;
  }, [spots, ID]);
  for (const c in shut) if (shut[c] !== 3) throw new Error('the ' + c + ' slot was hit while shut: ' + JSON.stringify(shut));

  // 3. slashes alone kill it, with the real attacks running; it is marked beaten
  const kill = await page.evaluate(id => {
    const D = G.debug; D.newRun(3); D.god(true); D.startBoss(id);
    const hp0 = D.state().players[0].maxHp;
    for (let i = 0; i < 120 * 400 && D.state().room.boss.state !== 'dead'; i++) {
      const b = G.rooms.current.boss;
      if (i % 40 === 0 && b.state !== 'dead') {
        const r = b.rect(), left = r.x0 - 22 > b.minX - 40;
        if (left) D.place(0, r.x0 - 22, b.floor, 1); else D.place(0, r.x1 + 22, b.floor, -1);
        D.setInput(0, { attack: true });
      } else if (i % 40 === 2) D.setInput(0, { attack: false });
      D.step(1);
    }
    const s = D.state();
    return { dead: s.room.boss.state === 'dead', beaten: !!s.run.beaten.r3, fight: s.room.fight, locked: s.room.locked, pip: s.players[0].maxHp - hp0, scrip: s.run.shards, time: s.time, errors: s.errors };
  }, ID);
  if (!kill.dead || !kill.beaten || kill.fight || kill.locked || kill.pip !== 1 || kill.scrip < 40) throw new Error('not beaten by slashes: ' + JSON.stringify(kill));
  notes.push('slashed down in ' + Math.round(kill.time) + ' s');

  // 4. 90 s of random input with every token and move
  const soak = await page.evaluate(id => {
    const D = G.debug, acts = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'item', 'heal', 'cycle', 'interact'];
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7), bad = [];
    D.newRun(21); D.god(true); D.unlockAll(); for (const t of ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']) D.give(t);
    D.startBoss(id);
    let held = {};
    for (let i = 0; i < 120 * 90 && bad.length < 5; i++) {
      if (i % 9 === 0) { held = {}; for (const a of acts) held[a] = rng() < 0.3; D.setInput(0, held); }
      D.step(1);
      if (i % 10 === 0) {
        const s = D.state(), W = s.room.cols * 32, H = s.room.rows * 32, p = s.players[0], b = s.room.boss;
        if (![p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite)) bad.push('NaN player');
        else if (!s.room.transition && (p.x < -8 || p.x > W + 8 || p.y < 0 || p.y > H)) bad.push('player out of bounds ' + p.x + ',' + p.y);
        if (b && (![b.x, b.y, b.hp].every(Number.isFinite) || b.x < b.minX - 1 || b.x > b.maxX + 1 || b.y > b.floor + 1)) bad.push('boss out of bounds ' + b.x + ',' + b.y);
        if (s.errors.length) bad.push(s.errors.join('|'));
      }
    }
    return { bad, st: D.state().room.boss && D.state().room.boss.state };
  }, ID);
  if (soak.bad.length) throw new Error(soak.bad.join(' ; '));

  // 5. screenshot: all four tokens carried, the idol firing its second ring (low lamp lit before each)
  await page.evaluate(id => {
    const D = G.debug; D.newRun(4); D.god(true); for (const t of ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']) D.give(t);
    D.startBoss(id);
    const b = G.rooms.current.boss;
    for (let i = 0; i < 120 * 60 && !(b.state === 'ring' && b.ri >= 1 && b.ph === 0 && b.pt < 0.25); i++) { D.place(0, 330, b.floor, 1); D.step(1); }
    D.place(0, 330, b.floor, 1); D.step(2);
  }, ID);
  await page.waitForTimeout(150);
  await page.locator('#game').screenshot({ path: shots + '/boss_r3.png' });
  return notes.join(', ') + '; soak ok';
};
