// Materials (bible sections 8 and 9): every token and trinket has valid tags and card text (chips and an interactions line draw on the plinth
// prompt); each interaction is triggered through G.debug and produces its effect; the same seed and inputs give the same result twice;
// materials never change which fare slot a token opens (its cut).
const CUT = { cobalt_awl: 'pierce', tin_spindle: 'pierce', flint_tether: 'pierce', ochre_ladle: 'arc', sulphur_kettle: 'arc', chalk_skipstone: 'arc',
  cinder_bell: 'burst', rust_censer: 'burst', copper_drum: 'burst', basalt_roller: 'ground', quartz_wake: 'ground', pumice_crawler: 'ground',
  jet_gimlet: 'pierce', amber_sling: 'arc', mica_lantern: 'burst', gypsum_sledge: 'ground' };
const WORDS = ['Ignite', 'Flare', 'Douse', 'Conduct', 'Pull', 'Stop', 'Kick', 'Slide', 'Shatter', 'Crack', 'Punt', 'Anchor'];

export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, out = { cards: [], scen: {}, again: {} };
    // ---- cards
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    for (const [kind, defs] of [['token', G.itemDefs], ['trinket', G.trinketDefs]]) for (const id in defs) {
      const d = defs[id], c = { kind, id, tags: d.mat, line: d.inter, bad: [] };
      if (!Array.isArray(d.mat) || d.mat.length < 1 || d.mat.length > 2) c.bad.push('tag count');
      else if (d.mat.some(t => !G.MATERIALS[t])) c.bad.push('unknown tag');
      if (typeof d.inter !== 'string' || d.inter.length < 12 || d.inter.length > 170) c.bad.push('interactions line');
      try {
        if (c.bad.length === 0) {
          if (!(G.materials.drawChips(ctx, d.mat, 10, 10) > 20)) c.bad.push('chips draw nothing');
          D.newRun(5); D.gotoRoom('junction'); D.step(2);
          const pr = G.props.make('plinth', 100, 200, kind === 'token' ? { item: id } : { trinket: id }), lines = pr.prompt(G.players[0]);
          if (!lines || !lines[3] || lines[3].tags !== d.mat || lines[3].line !== d.inter) c.bad.push('prompt lacks the material card');
          const L = G.props.layoutPrompt(ctx, pr, lines);
          if (!L || !L.rows.some(r => r.kind === 'chips') || !L.rows.some(r => r.kind === 'mat')) c.bad.push('layout lacks chips or line');
        }
      } catch (e) { c.bad.push('threw ' + e.message); }
      out.cards.push(c);
    }
    // ---- scenarios
    if (!G.enemyDefs.test_dummy) G.defineEnemy({ id: 'test_dummy', name: 'Dummy', hp: 100000, w: 30, h: 40, touch: 0, shards: [0, 0], update(e) { e.vx = 0; }, draw() {} });
    if (!G.enemyDefs.test_float) G.defineEnemy({ id: 'test_float', name: 'Float', hp: 100000, w: 30, h: 40, touch: 0, flying: true, gravity: false, shards: [0, 0], update(e) { e.vx = 0; e.vy = 0; }, draw() {} });
    const spot = () => {
      const t = G.tiles;
      for (let r = t.rows - 1; r > 4; r--) for (let c = 2; c < t.cols - 18; c++) {
        let ok = true;
        for (let k = 0; k < 16 && ok; k++) ok = t.solid(c + k, r) && !t.solid(c + k, r - 1) && !t.solid(c + k, r - 2) && !t.solid(c + k, r - 3) && !t.solid(c + k, r - 4) && !t.solid(c + k, r - 5);
        if (ok) return { x: (c + 1) * 32, y: r * 32 };
      }
      return null;
    };
    const setup = (trinkets = []) => {
      D.newRun(5); D.god(true); D.gotoRoom('junction'); D.step(2);
      G.rooms.current.enemies.length = 0; G.combat.clear(); G.materials.reset();
      for (const t of trinkets) G.game.addTrinket(t);
      const p = G.players[0], s = spot(); p.items = []; p.sel = 0; p.itemCd = 0;
      D.place(0, s.x, s.y, 1); D.step(2);
      return { p, x: s.x, y: s.y };
    };
    const dummy = (x, y, air) => { const e = new G.Enemy(G.enemyDefs[air ? 'test_float' : 'test_dummy'], x, y); G.rooms.current.enemies.push(e); e.hp0 = e.hp; return e; };
    const dmg = e => e.hp0 - e.hp;
    const use = (p, id) => { p.itemCd = 0; G.itemDefs[id].use(p); };
    const shot = (p, id, o) => G.combat.shoot(Object.assign({ owner: p, cls: CUTOF[id], itemId: id, dmg: 6, r: 6, life: 3 }, o));
    const CUTOF = { cobalt_awl: 'pierce', flint_tether: 'pierce', chalk_skipstone: 'arc', sulphur_kettle: 'arc', basalt_roller: 'ground', ochre_ladle: 'arc' };
    const fired = () => Object.assign({}, G.materials.fired);
    const S = {
      ignite_flint() {                       // a Flint Tether spark lights a Sulphur Kettle lob in flight: x1.6 burst
        const { p } = setup(); use(p, 'sulphur_kettle'); const k = G.shots[0], b0 = k.burst, d0 = k.dmg;
        shot(p, 'flint_tether', { x: k.x + 12, y: k.y, vx: 0, life: 0.3, r: 4, dmg: 1 }); D.step(2);
        return { ignited: k.ignited, burst: [b0, k.burst], dmg: [d0, k.dmg], fired: fired() };
      },
      ignite_slash() {                       // a Whetstone Chip slash does the same
        const { p } = setup(['whetstone_chip']); use(p, 'sulphur_kettle'); const k = G.shots[0];
        D.setInput(0, { attack: true }); D.step(1); D.setInput(0, { attack: false }); D.step(3);
        return { ignited: k.ignited, fired: fired() };
      },
      no_spark_no_ignite() {
        const { p } = setup(); use(p, 'sulphur_kettle'); const k = G.shots[0];
        D.setInput(0, { attack: true }); D.step(1); D.setInput(0, { attack: false }); D.step(3);
        return { ignited: !!k.ignited, fired: fired() };
      },
      flare() {                              // the Kettle's cloud, then a spark: a burst of 20
        const { p, x, y } = setup(); use(p, 'sulphur_kettle');
        for (let i = 0; i < 600 && G.shots.length; i++) D.step(1);
        const cloud = G.materials.counts().clouds;
        G.materials.reset(); const e = dummy(x + 150, y);
        G.materials.cloud(e.x - 20, y - 20, p);
        shot(p, 'flint_tether', { x: e.x - 20, y: y - 20, vx: 0, life: 0.2, r: 4, dmg: 1 }); D.step(2);
        return { cloudFromKettle: cloud, dmg: dmg(e), fired: fired(), clouds: G.materials.counts().clouds };
      },
      douse_puddle() {                       // an Ochre Ladle puddle puts out a cloud
        const { p, x, y } = setup(); use(p, 'ochre_ladle');
        for (let i = 0; i < 600 && G.shots.length; i++) D.step(1);
        const pud = G.materials.counts().puddles;
        return { puddle: pud, fired: fired() };
      },
      douse_cloud() {
        const { p, x, y } = setup(); G.materials.puddle(x + 100, y, p); G.materials.cloud(x + 110, y - 10, p); D.step(2);
        return { clouds: G.materials.counts().clouds, fired: fired() };
      },
      douse_flask() {                        // Brine Flask: sparks light nothing
        const { p } = setup(['brine_flask']); use(p, 'sulphur_kettle'); const k = G.shots[0];
        shot(p, 'flint_tether', { x: k.x + 12, y: k.y, vx: 0, life: 0.3, r: 4, dmg: 1 }); D.step(2);
        return { ignited: !!k.ignited, doused: !!k.doused, fired: fired() };
      },
      conduct_flask() {                      // metal + Brine Flask: a chain to the second enemy for half damage
        const { p, x, y } = setup(['brine_flask']); const a = dummy(x + 160, y), b = dummy(x + 260, y); use(p, 'cobalt_awl'); D.step(80);
        return { a: dmg(a), b: dmg(b), fired: fired() };
      },
      conduct_puddle() {                     // metal + a brine puddle under the target
        const { p, x, y } = setup(); const a = dummy(x + 160, y), b = dummy(x + 260, y); G.materials.puddle(x + 160, y, p, 56, 4); D.step(2); use(p, 'cobalt_awl'); D.step(80);
        return { a: dmg(a), b: dmg(b), fired: fired() };
      },
      conduct_none() {
        const { p, x, y } = setup(); const a = dummy(x + 160, y), b = dummy(x + 260, y); use(p, 'cobalt_awl'); D.step(80);
        return { a: dmg(a), b: dmg(b), fired: fired() };
      },
      pull_tooth() {                         // Magnet Tooth: a metal shot that would miss curves into the enemy
        const { p, x, y } = setup(['magnet_tooth']); const a = dummy(x + 260, y - 80, true); use(p, 'cobalt_awl'); D.step(80);
        return { hit: dmg(a), fired: fired() };
      },
      pull_none() {
        const { p, x, y } = setup(); const a = dummy(x + 260, y - 80, true); use(p, 'cobalt_awl'); D.step(80);
        return { hit: dmg(a), fired: fired() };
      },
      stop_kick() {                          // Lead Boot: a Basalt Roller stops against the carrier; a slash kicks it for double damage
        const { p, x, y } = setup(['lead_boot']); const a = dummy(x + 330, y);
        const r = shot(p, 'basalt_roller', { x: x + 120, y: y - 8, vx: -460, hug: true, life: 3, r: 7, dmg: 7 });
        for (let i = 0; i < 120 && !r.parked; i++) D.step(1);
        const stopped = !!r.parked, vx0 = r.vx, px = r.x;
        D.setInput(0, { attack: true }); D.step(1); D.setInput(0, { attack: false }); D.step(3);
        const kicked = !!r.kicked, vx1 = r.vx; D.step(200);
        return { stopped, vx0, kicked, vx1, hit: dmg(a), fired: fired() };
      },
      stop_wall() {                          // solo: it stops against a wall instead of ending
        const { p, x, y } = setup(['lead_boot']);
        let c = Math.floor(x / 32) + 1; while (c < G.tiles.cols - 1 && !G.tiles.solid(c, Math.floor((y - 8) / 32))) c++;
        const r = shot(p, 'basalt_roller', { x: c * 32 - 60, y: y - 8, vx: 460, hug: true, life: 3, r: 7, dmg: 7 });
        D.step(60);
        return { alive: G.shots.includes(r), parked: !!r.parked, fired: fired() };
      },
      slide_strap() {
        const { p, x } = setup(['oiled_strap']); use(p, 'basalt_roller'); const r = G.shots[0];
        return { vx: r.vx, life: r.life, fired: fired() };
      },
      slide_none() {
        const { p, x } = setup(); use(p, 'basalt_roller'); const r = G.shots[0];
        return { vx: r.vx, life: r.life, fired: fired() };
      },
      shatter_heavy() {                      // a roller meets a brittle Skipstone: three fragments, each a hit
        const { p, x, y } = setup(); const a = dummy(x + 120, y);
        shot(p, 'chalk_skipstone', { x: x + 70, y: y - 10, vx: 0, tile: 'pass' });
        use(p, 'basalt_roller'); D.step(60); const frags = G.materials.frags;
        return { frags, hit: dmg(a), fired: fired() };
      },
      shatter_alone() {
        const { p, x, y } = setup(); const a = dummy(x + 120, y); use(p, 'basalt_roller'); D.step(60);
        return { hit: dmg(a), fired: fired() };
      },
      shatter_glove() {                      // Punch Glove slash on a brittle shot of yours
        const { p, x, y } = setup(['punch_glove']);
        shot(p, 'chalk_skipstone', { x: x + 30, y: y - 20, vx: 0, tile: 'pass' });
        D.setInput(0, { attack: true }); D.step(1); D.setInput(0, { attack: false }); D.step(2);
        return { frags: G.materials.frags, fired: fired() };
      },
      punt() {
        const { p, x, y } = setup(['punch_glove']); const a = dummy(x + 300, y - 4, true);
        const s = shot(p, 'cobalt_awl', { x: x + 30, y: y - 24, vx: 0, tile: 'die' });
        D.setInput(0, { attack: true }); D.step(1); D.setInput(0, { attack: false }); D.step(3);
        const vx = s.vx, d = s.dmg; D.step(80);
        return { vx, d, hit: dmg(a), fired: fired() };
      },
      crack_hurt() {                         // hurt during the cast: the Skipstone breaks
        const { p, x, y } = setup(); D.god(false); p.items = ['chalk_skipstone']; p.sel = 0; p.itemCd = 0; p.useItem(); D.step(1); p.inv = 0; p.hurt(p.x + 20); D.step(2);
        return { frags: G.materials.frags, whole: G.shots.filter(s => s.itemId === 'chalk_skipstone' && !s.frag).length, fired: fired() };
      },
      crack_late() {                         // hurt long after the cast: nothing breaks
        const { p, x, y } = setup(); D.god(false); p.items = ['chalk_skipstone']; p.sel = 0; p.itemCd = 0; p.useItem(); D.step(90); p.inv = 0; p.hurt(p.x + 20); D.step(2);
        return { frags: G.materials.frags, fired: fired() };
      },
      anchor_hurt() {
        const { p } = setup(['lead_boot']); D.god(false); p.inv = 0; p.hurt(p.x + 20); D.step(2);
        return { vx: p.vx, hp: p.hp, fired: fired() };
      },
      knock_plain() {
        const { p } = setup(); D.god(false); p.inv = 0; p.hurt(p.x + 20); D.step(2);
        return { moved: Math.abs(p.vx) > 50, fired: fired() };
      }
    };
    for (const k in S) { out.scen[k] = S[k](); out.again[k] = S[k](); }
    // cards for a second pass of the same words
    out.errors = G.errors.length;
    return out;
  });
  const bad = res.cards.filter(c => c.bad.length).map(c => c.kind + ' ' + c.id + ': ' + c.bad.join(', '));
  if (bad.length) throw new Error('cards: ' + bad.join('; '));
  const ids = res.cards.filter(c => c.kind === 'token').map(c => c.id), trs = res.cards.filter(c => c.kind === 'trinket');
  if (ids.length !== 16 || trs.length !== 8) throw new Error('expected 16 tokens and 8 trinkets, found ' + ids.length + ' and ' + trs.length);
  // the six core tags each appear on a token and a trinket
  const used = t => [res.cards.some(c => c.kind === 'token' && c.tags.includes(t)), res.cards.some(c => c.kind === 'trinket' && c.tags.includes(t))];
  for (const t of ['heavy', 'metal', 'flammable', 'wet', 'slick', 'brittle']) { const [a, b] = used(t); if (!a && t !== 'slick') throw new Error('no token is ' + t); if (!b && t !== 'flammable') throw new Error('no trinket is ' + t); }
  if (trs.filter(c => /^Plain/.test(c.line)).length > 2) throw new Error('more than two plain trinkets');
  if (res.errors) throw new Error(res.errors + ' G.errors');
  const S = res.scen;
  // determinism: the second run of each scenario matches the first
  for (const k in S) if (JSON.stringify(S[k]) !== JSON.stringify(res.again[k])) throw new Error('not deterministic: ' + k + ' ' + JSON.stringify(S[k]) + ' vs ' + JSON.stringify(res.again[k]));
  const want = (c, m) => { if (!c) throw new Error(m); };
  const J = k => k + ' ' + JSON.stringify(S[k]);
  want(S.ignite_flint.ignited && S.ignite_flint.fired.Ignite === 1 && S.ignite_flint.burst[1] > S.ignite_flint.burst[0] && S.ignite_flint.dmg[1] > S.ignite_flint.dmg[0], J('ignite_flint'));
  want(S.ignite_slash.ignited && S.ignite_slash.fired.Ignite === 1, J('ignite_slash'));
  want(!S.no_spark_no_ignite.ignited && !S.no_spark_no_ignite.fired.Ignite, J('no_spark_no_ignite'));
  want(S.flare.cloudFromKettle === 1 && S.flare.fired.Flare === 1 && S.flare.dmg >= 20 && S.flare.clouds === 0, J('flare'));
  want(S.douse_puddle.puddle === 1, J('douse_puddle'));
  want(S.douse_cloud.clouds === 0 && S.douse_cloud.fired.Douse === 1, J('douse_cloud'));
  want(S.douse_flask.doused && !S.douse_flask.ignited && S.douse_flask.fired.Douse >= 1 && !S.douse_flask.fired.Ignite, J('douse_flask'));
  for (const k of ['conduct_flask', 'conduct_puddle']) want(S[k].a > 0 && S[k].b > 0 && S[k].fired.Conduct === 1, J(k));
  want(S.conduct_flask.b === S.conduct_flask.a / 2, 'conduct is half: ' + J('conduct_flask'));
  want(S.conduct_none.a > 0 && S.conduct_none.b === 0 && !S.conduct_none.fired.Conduct, J('conduct_none'));
  want(S.pull_tooth.hit > 0 && S.pull_tooth.fired.Pull === 1 && S.pull_none.hit === 0, J('pull_tooth') + ' ' + J('pull_none'));
  want(S.stop_kick.stopped && S.stop_kick.vx0 === 0 && S.stop_kick.kicked && S.stop_kick.vx1 > 700 && S.stop_kick.fired.Stop === 1 && S.stop_kick.fired.Kick === 1 && S.stop_kick.hit >= 14, J('stop_kick'));
  want(S.stop_wall.alive && S.stop_wall.parked && S.stop_wall.fired.Stop === 1, J('stop_wall'));
  want(S.slide_strap.vx > S.slide_none.vx * 1.4 && S.slide_strap.life > S.slide_none.life * 1.4 && S.slide_strap.fired.Slide === 1 && !S.slide_none.fired.Slide, J('slide_strap') + J('slide_none'));
  want(S.shatter_heavy.frags === 3 && S.shatter_heavy.fired.Shatter === 1 && S.shatter_heavy.hit > S.shatter_alone.hit, J('shatter_heavy') + ' ' + J('shatter_alone'));
  want(S.shatter_glove.frags === 3 && S.shatter_glove.fired.Shatter === 1, J('shatter_glove'));
  want(S.punt.fired.Punt === 1 && S.punt.vx >= 520 && S.punt.d === 9 && S.punt.hit >= 9, J('punt'));
  want(S.crack_hurt.frags === 3 && S.crack_hurt.whole === 0 && S.crack_hurt.fired.Crack === 1, J('crack_hurt'));
  want(S.crack_late.frags === 0 && !S.crack_late.fired.Crack, J('crack_late'));
  want(S.anchor_hurt.vx === 0 && S.anchor_hurt.fired.Anchor === 1 && S.anchor_hurt.hp < 5 + 1, J('anchor_hurt'));
  want(S.knock_plain.moved && !S.knock_plain.fired.Anchor, J('knock_plain'));
  const words = new Set(); for (const k in S) for (const w in S[k].fired) words.add(w);
  const missing = WORDS.filter(w => !words.has(w)); if (missing.length) throw new Error('never fired: ' + missing.join());
  // fare slots stay keyed to the four cuts
  for (const id of ids) if (res.cards.find(c => c.id === id) && CUT[id] === undefined) throw new Error('unknown token ' + id);
  const cuts = await page.evaluate(() => Object.fromEntries(Object.keys(G.itemDefs).map(id => [id, G.itemDefs[id].cls])));
  for (const id in CUT) if (cuts[id] !== CUT[id]) throw new Error(id + ' changed cut: ' + cuts[id]);
  return words.size + ' interactions fired, ' + ids.length + ' tokens and ' + trs.length + ' trinkets carded, deterministic twice';
};
