// The Gatewhale (r4): every attack state is entered, wind-ups are long enough, each fare slot can be punched with its baseline
// token, slashes alone kill it, and 90 s of random input breaks nothing. Saves tools/shots/boss_r4.png.
const TOKENS = { pierce: 'cobalt_awl', arc: 'ochre_ladle', burst: 'cinder_bell', ground: 'basalt_roller' };

export default async ({ page, shots }) => {
  await page.evaluate(() => { G.debug.fullCharts = true; });      // these checks use every cut on every Warden
  const notes = [];

  // 1. attack coverage and wind-up lengths over 120 s (rage included: the boss is wounded for the second minute)
  const cov = await page.evaluate(() => {
    const D = G.debug; D.newRun(5); D.god(true); D.startBoss('gatewhale');
    const b = G.rooms.current.boss, log = [], seen = {}, orig = b.set.bind(b);
    b.set = (s, t) => { log.push([s, t, b.rage]); orig(s, t); };
    D.place(0, 200, b.floor, 1);
    const fl = D.state().room.boss.floor, bad = [];
    for (let i = 0; i < 120 * 120; i++) {
      if (i === 120 * 60) b.hp = b.maxHp * 0.4;                       // second minute: below half health
      if (i % 60 === 0) D.place(0, 200, fl, 1);                       // wait at the door side, harmless
      D.step(1);
      if (i % 12 === 0) { const s = D.state().room.boss; if (s) seen[s.state] = 1; if (![s.x, s.y, s.hp].every(Number.isFinite)) bad.push('NaN boss'); }
    }
    const crabsMax = 0;
    return { states: Object.keys(seen), log, bad, errors: D.state().errors };
  });
  for (const s of ['rollTell', 'roll', 'crateTell', 'crates', 'spawnTell', 'spawn', 'spinTell', 'spin', 'recover']) {
    if (!cov.log.some(l => l[0] === s)) throw new Error('attack state never entered in 120 s: ' + s);
  }
  for (const [s, t, rage] of cov.log) if (/Tell$/.test(s) && t < (rage ? 0.35 : 0.45)) throw new Error('wind-up too short: ' + s + ' ' + t.toFixed(2) + ' (rage ' + rage + ')');
  if (cov.bad.length) throw new Error(cov.bad.join(';'));
  notes.push(cov.log.filter(l => /Tell$/.test(l[0])).length + ' attacks');

  // 2. each fare slot, with the baseline token of its cut
  const aim = {   // stand in front of the boss (held at x 640 facing left, feet on the floor) and throw
    pierce: { state: 'idle' }, arc: { state: 'idle' }, burst: { state: 'crateTell', jaw: 1, t: 5 }, ground: { state: 'recover', t: 5 }
  };
  for (const cut of Object.keys(TOKENS)) {
    const r = await page.evaluate(([cut, token, hold]) => {
      const D = G.debug, run = n => D.step(n), tap = (a, n = 1) => { D.setInput(0, { [a]: true }); run(n); D.setInput(0, { [a]: false }); run(1); };
      D.newRun(9); D.god(true); D.give(token); D.startBoss('gatewhale');
      const floor = D.state().room.boss.floor, bx = 640;
      D.holdBoss(Object.assign({ x: bx, y: floor, face: -1, back: 0, jaw: 0 }, hold));
      run(2);
      const open = D.state().room.boss.spots.find(s => s.cls === cut).open, hp0 = D.state().room.boss.hp;
      // find a standing spot that punches (scan distances in front of the boss)
      let hits = null, at = null;
      for (let d = 96; d <= 330 && !hits; d += 6) {
        D.newRun(9); D.god(true); D.give(token); D.startBoss('gatewhale');
        D.holdBoss(Object.assign({ x: bx, y: floor, face: -1, back: 0, jaw: 0 }, hold));
        D.place(0, bx - d, floor, 1); run(1); tap('item'); run(150);
        let sp = D.state().room.boss.spots.find(s => s.cls === cut);
        if (sp.hp < 3) { at = d; hits = [sp.hp]; for (let k = 0; k < 2; k++) { D.place(0, bx - d, floor, 1); run(1); tap('item'); run(150); hits.push(D.state().room.boss.spots.find(s => s.cls === cut).hp); } }
      }
      const s = D.state(), b = s.room.boss;
      return { open, at, hits, broken: b.spots.find(x => x.cls === cut).broken, lost: hp0 - b.hp, maxHp: b.maxHp, void: s.run.spent.includes(token) && !s.players[0].items.includes(token), errors: s.errors };
    }, [cut, TOKENS[cut], aim[cut]]);
    if (!r.open) throw new Error(cut + ': the slot did not open with the token');
    if (!r.hits || r.hits.join() !== '2,1,0' || !r.broken) throw new Error(cut + ': ' + JSON.stringify(r));
    if (r.lost < r.maxHp * 0.1 - 0.01 || !r.void) throw new Error(cut + ': ' + JSON.stringify(r));
    notes.push(cut + '@' + r.at);
  }

  // a slot must stay shut while the boss is not in its exposed state
  const shut = await page.evaluate(() => {
    const D = G.debug, run = n => D.step(n);
    D.newRun(9); D.god(true); D.give('cobalt_awl'); D.startBoss('gatewhale');
    const floor = D.state().room.boss.floor;
    D.holdBoss({ x: 640, y: floor, face: -1, state: 'roll' });
    const sp0 = D.state().room.boss.spots.find(s => s.cls === 'pierce').hp;
    for (let d = 96; d <= 330; d += 6) { D.place(0, 640 - d, floor, 1); run(1); D.setInput(0, { item: true }); run(2); D.setInput(0, { item: false }); run(60); }
    return [sp0, D.state().room.boss.spots.find(s => s.cls === 'pierce').hp];
  });
  if (shut[0] !== shut[1]) throw new Error('the Headlamp was hit while the whale was rolling');

  // 3. slashes alone kill it, with the real attacks running; it is marked beaten
  const kill = await page.evaluate(() => {
    const D = G.debug; D.newRun(3); D.god(true); D.startBoss('gatewhale');
    const hp0 = D.state().players[0].maxHp; let maxCrabs = 0, maxCrates = 0;
    for (let i = 0; i < 120 * 400 && D.state().room.boss.state !== 'dead'; i++) {
      const b = G.rooms.current.boss;
      if (i % 36 === 0) { D.place(0, b.x - b.face * 72, b.y, b.face); D.setInput(0, { attack: true }); } else if (i % 36 === 2) D.setInput(0, { attack: false });
      D.step(1);
      maxCrabs = Math.max(maxCrabs, G.rooms.current.enemies.length); maxCrates = Math.max(maxCrates, b.crates.length);
    }
    D.step(3);                                      // the crabs it kills on dying are swept from the room a step later
    const s = D.state();
    return { dead: s.room.boss.state === 'dead', beaten: !!s.run.beaten.r4, fight: s.room.fight, locked: s.room.locked, pip: s.players[0].maxHp - hp0, scrip: s.run.shards,
      time: s.time, maxCrabs, maxCrates, left: s.room.enemies.length, errors: s.errors };
  });
  if (!kill.dead || !kill.beaten || kill.fight || kill.locked || kill.pip !== 1 || kill.scrip < 40) throw new Error('not beaten by slashes: ' + JSON.stringify(kill));
  if (kill.maxCrabs > 2) throw new Error('more than two crabs alive: ' + kill.maxCrabs);
  if (kill.left) throw new Error('crabs left after the boss died');
  notes.push('slashed down in ' + Math.round(kill.time) + ' s, crabs max ' + kill.maxCrabs + ', crates max ' + kill.maxCrates);

  // 3b. crates are solid pillars the party can stand on, and a low platform is a safe perch from the roll
  const geo = await page.evaluate(() => {
    const D = G.debug; D.newRun(3); D.god(true); D.startBoss('gatewhale');
    const b = G.rooms.current.boss; let crate = null;
    for (let i = 0; i < 120 * 60 && !crate; i++) { D.place(0, 200, b.floor, 1); D.step(1); crate = b.crates.find(k => k.st === 'stand'); }
    if (!crate) return { err: 'no crate stood in 60 s' };
    D.holdBoss({ x: 840, y: b.floor, face: -1 });                        // pin the whale out of the way
    D.place(0, crate.x, b.floor - 70, 1); D.step(60);
    const onCrate = D.state().players[0].y, ground = D.state().players[0].onGround;
    D.god(false); D.holdBoss(null);
    b.crates.length = 0; b.x = 700; b.face = -1; b.set('rollTell', 0.5); b.flags.noCrates = true; b.last = 'roll';
    const hp0 = D.state().players[0].hp;
    D.place(0, 7 * 32 + 16, 12 * 32, 1);                                  // on the low platform (row 12)
    for (let i = 0; i < 120 * 4; i++) { D.step(1); if (i % 20 === 0 && b.state !== 'roll' && b.state !== 'rollTell') break; }
    return { onCrate, ground, floor: b.floor, hp0, hp1: D.state().players[0].hp, py: D.state().players[0].y, st: b.state };
  });
  if (geo.err) throw new Error(geo.err);
  if (Math.abs(geo.onCrate - (geo.floor - 64)) > 3 || !geo.ground) throw new Error('a crate is not solid: ' + JSON.stringify(geo));
  if (geo.hp1 < geo.hp0) throw new Error('the roll hurt a player standing on the low platform: ' + JSON.stringify(geo));

  // 4. 90 s of random input
  const soak = await page.evaluate(() => {
    const D = G.debug, acts = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'item', 'heal', 'cycle', 'interact'];
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7), bad = [];
    D.newRun(21); D.god(true); D.unlockAll(); for (const t of ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']) D.give(t);
    D.startBoss('gatewhale');
    let held = {};
    for (let i = 0; i < 120 * 90 && bad.length < 5; i++) {
      if (i % 9 === 0) { held = {}; for (const a of acts) held[a] = rng() < 0.3; D.setInput(0, held); }
      D.step(1);
      if (i % 10 === 0) {
        const s = D.state(), W = s.room.cols * 32, H = s.room.rows * 32, p = s.players[0], b = s.room.boss;
        if (![p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite)) bad.push('NaN player');
        else if (!s.room.transition && (p.x < -8 || p.x > W + 8 || p.y < 0 || p.y > H)) bad.push('player out of bounds ' + p.x + ',' + p.y);
        if (b && (![b.x, b.y, b.hp].every(Number.isFinite) || b.x < b.minX - 1 || b.x > b.maxX + 1)) bad.push('boss out of bounds ' + (b && b.x));
        for (const e of s.room.enemies) if (![e.x, e.y].every(Number.isFinite) || e.x < 0 || e.x > W || e.y > H + 40) bad.push('enemy out of bounds ' + e.x + ',' + e.y);
        if (s.errors.length) bad.push(s.errors.join('|'));
      }
    }
    return { bad, st: D.state().room.boss && D.state().room.boss.state };
  });
  if (soak.bad.length) throw new Error(soak.bad.join(' ; '));

  // 5. screenshot: all four tokens carried, the whale in its crate drop wind-up (pinned for a steady frame)
  await page.evaluate(() => {
    const D = G.debug; D.newRun(4); D.god(true); for (const t of ['cobalt_awl', 'ochre_ladle', 'cinder_bell', 'basalt_roller']) D.give(t);
    D.startBoss('gatewhale'); D.step(130);
    const b = G.rooms.current.boss;
    D.holdBoss({ x: 640, y: b.floor, face: -1, state: 'crateTell', t: 0.3, jaw: 1, marks: [13, 17, 20] });
    D.place(0, 300, b.floor, 1); D.step(20);
  });
  await page.waitForTimeout(150);
  await page.locator('#game').screenshot({ path: shots + '/boss_r4.png' });
  return notes.join(', ') + '; soak ok';
};
