// Tokens and trinkets: every token is used in an empty room and beside a dummy (no errors, the dummy takes damage, no shot outlives its life);
// one token of each cut punches the matching fare slot on the Tollkeeper; every trinket lands its modifier on the run.
const CUTS = { pierce: 'cobalt_awl', arc: 'ochre_ladle', burst: 'cinder_bell', ground: 'basalt_roller' };
const RANGE = { pierce: 150, arc: 130, burst: 50, ground: 120, sulphur_kettle: 150, chalk_skipstone: 200 };
const WANT = {
  brass_buckle: { maxHp: 1 }, oiled_strap: { dashCd: 0.7 }, whetstone_chip: { dmg: 1.25 }, lead_boot: { knockback: 0.5, speed: 0.92 },
  magnet_tooth: { magnet: 1.6, shopCost: 1.1 }, punch_glove: { itemCd: 0.75 }, brine_flask: { mendTime: 0.7 }, surveyors_slate: { revealMap: true }
};

export default async ({ page }) => {
  const res = await page.evaluate(({ RANGE }) => {
    const D = G.debug, out = { tokens: {}, ids: Object.keys(G.itemDefs), trinkets: Object.keys(G.trinketDefs) };
    G.defineEnemy({ id: 'test_dummy', name: 'Dummy', hp: 100000, w: 30, h: 40, touch: 0, shards: [0, 0], update(e) { e.vx = 0; }, draw() {} });
    // a flat stretch of floor: 16 free columns with 4 rows of headroom
    const spot = () => {
      const t = G.tiles;
      for (let r = t.rows - 1; r > 4; r--) for (let c = 2; c < t.cols - 18; c++) {
        let ok = true;
        for (let k = 0; k < 16 && ok; k++) ok = t.solid(c + k, r) && !t.solid(c + k, r - 1) && !t.solid(c + k, r - 2) && !t.solid(c + k, r - 3) && !t.solid(c + k, r - 4);
        if (ok) return { x: (c + 1) * 32, y: r * 32 };
      }
      return null;
    };
    const setup = id => {
      D.newRun(5); D.god(true); D.gotoRoom('junction'); D.step(2);   // the hub: a wide flat floor, no enemies
      G.rooms.current.enemies.length = 0; G.combat.clear();
      const p = G.players[0]; p.items = [id]; p.sel = 0; p.itemCd = 0;
      const s = spot(); if (!s) return null;
      D.place(0, s.x, s.y, 1); D.step(2); return { p, s };
    };
    const tap = n => { D.setInput(0, { item: true }); D.step(1); D.setInput(0, { item: false }); D.step(n); };
    for (const id of out.ids) {
      const d = G.itemDefs[id], r = { cls: d.cls, cd: d.cd, errs: 0 };
      // 1. empty room
      let c = setup(id); if (!c) { r.noSpot = true; out.tokens[id] = r; continue; }
      const e0 = G.errors.length; tap(60); D.step(1300);
      r.leftEmpty = G.shots.length; r.errs += G.errors.length - e0;
      // 2. beside a dummy
      c = setup(id);
      const e = new G.Enemy(G.enemyDefs.test_dummy, c.s.x + (RANGE[id] || RANGE[d.cls]), c.s.y); G.rooms.current.enemies.push(e);
      const hp0 = e.hp, e1 = G.errors.length;
      tap(0); D.step(id === 'pumice_crawler' ? 400 : 160);
      r.dmg = hp0 - e.hp; D.step(1300); r.left = G.shots.length; r.errs += G.errors.length - e1;
      out.tokens[id] = r;
    }
    return out;
  }, { RANGE });
  const ids = res.ids;
  if (ids.length !== 12) throw new Error('expected 12 tokens, found ' + ids.length + ': ' + ids.join());
  for (const id of ids) {
    const r = res.tokens[id];
    if (r.noSpot) throw new Error(id + ': no flat floor found for the test');
    if (r.errs) throw new Error(id + ': ' + r.errs + ' errors');
    if (!(r.dmg > 0)) throw new Error(id + ': the enemy took no damage');
    if (r.leftEmpty || r.left) throw new Error(id + ': shots left behind (' + r.leftEmpty + ', ' + r.left + ')');
    if (r.cd < 0.6 || r.cd > 1.6) throw new Error(id + ': cooldown ' + r.cd + ' outside 0.6 to 1.6');
  }
  for (const cut of Object.keys(CUTS)) if (ids.filter(i => res.tokens[i].cls === cut).length !== 3) throw new Error('cut ' + cut + ' does not have three tokens');

  // each cut punches its slot on the reference boss (aim values as in punch.mjs)
  const aim = { pierce: [500, 436, 1], arc: [524, 480, 1, { right: true }], burst: [630, 480, 1], ground: [920, 480, -1] };
  const punch = await page.evaluate(({ CUTS, aim }) => {
    const D = G.debug, out = {};
    for (const cut in CUTS) {
      const id = CUTS[cut];
      D.newRun(3); D.god(true); D.gotoRoom('r1'); G.players[0].items = [id]; G.players[0].sel = 0;
      D.startBoss('r1'); const floor = D.state().room.boss.floor;
      D.holdBoss({ x: 720, y: floor, face: -1, rear: cut === 'burst' ? 1 : 0 });
      const [x, y, face, hold] = aim[cut];
      for (let k = 0; k < 3; k++) {
        G.players[0].itemCd = 0; D.place(0, x, y, face); D.step(1);
        if (hold) { D.setInput(0, hold); D.step(1); } D.setInput(0, { item: true }); D.step(1); D.setInput(0, { item: false, right: false }); D.step(160);
      }
      out[cut] = D.state().room.boss.spots.find(s => s.cls === cut).broken;
    }
    return out;
  }, { CUTS, aim });
  for (const cut in CUTS) if (!punch[cut]) throw new Error(cut + ': ' + CUTS[cut] + ' did not punch the slot');

  // trinkets
  const ids8 = Object.keys(WANT);
  const tr = await page.evaluate(ids8 => ids8.map(id => {
    G.debug.newRun(2); G.game.addTrinket(id);
    const base = G.baseMods(), m = G.run.mods, changed = {};
    for (const k in base) if (m[k] !== base[k]) changed[k] = m[k];
    return { id, has: G.debug.state().run.trinkets.includes(id), changed };
  }), ids8);
  const known = await page.evaluate(() => Object.keys(G.trinketDefs));
  if (known.length !== 8 || ids8.some(i => !known.includes(i))) throw new Error('trinket ids: ' + known.join());
  for (const t of tr) {
    if (!t.has) throw new Error(t.id + ' not on the run');
    for (const k in WANT[t.id]) if (Math.abs((t.changed[k] === true ? 1 : t.changed[k]) - (WANT[t.id][k] === true ? 1 : WANT[t.id][k])) > 1e-9) throw new Error(t.id + ': modifier ' + k + ' is ' + t.changed[k]);
  }
  return '12 tokens, 4 cuts, 8 trinkets';
};
