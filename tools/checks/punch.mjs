// Take the token from r1's guarded plinth (clearing its guards first). Then, for each of the four cuts, land three hits
// with that cut's baseline token on the Tollkeeper's fare slot. The slot is punched, the boss loses 20% of its hp and staggers, the token is void.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, out = {}, run = n => D.step(n);
    const tap = (action, n = 1) => { D.setInput(0, { [action]: true }); run(n); D.setInput(0, { [action]: false }); run(1); };
    // Where to stand and which way to face for each cut, with the boss held at x 720 facing left (feet at y 480).
    const aim = { pierce: [500, 436, 1], arc: [524, 480, 1, { right: true }], burst: [630, 480, 1], ground: [920, 480, -1] };   // arc: the Ladle is thrown far by holding the way you face
    const base = { pierce: 'cobalt_awl', arc: 'ochre_ladle', burst: 'cinder_bell', ground: 'basalt_roller' };
    // Picking up: clear the guards of r1's guarded plinth room with slashes, then take what the plinth holds.
    D.newRun(1); D.god(true); D.gotoRoom('r1_hold');
    let s = D.state();
    const held = s.room.props.find(p => p.type === 'plinth').data.item;
    for (let i = 0; i < 400 && s.room.enemies.length; i++) {
      const e = s.room.enemies[0]; D.place(0, e.x - 40, e.y, 1); tap('attack', 2); run(36); s = D.state();
    }
    const plinth = s.room.props.find(p => p.type === 'plinth');
    D.place(0, plinth.x, plinth.y); run(2); tap('interact');
    out.took = D.state().players[0].items.includes(held);
    // Punching: one baseline token per cut against the Tollkeeper.
    for (const cls in base) {
      const id = base[cls];
      D.newRun(7); D.god(true); D.give(id);
      D.startBoss('r1');
      const floor = D.state().room.boss.floor;
      D.holdBoss({ x: 720, y: floor, face: -1, rear: cls === 'burst' ? 1 : 0 });
      const hp0 = D.state().room.boss.hp, [x, y, face, hold] = aim[cls], hits = [];
      for (let k = 0; k < 3; k++) {
        D.place(0, x, y, face); run(1); if (hold) D.setInput(0, hold); run(1); D.setInput(0, { item: true }); run(1); D.setInput(0, { item: false, right: false, left: false, up: false, down: false }); run(160);
        hits.push(D.state().room.boss.spots.find(sp => sp.cls === cls).hp);
      }
      const b = D.state().room.boss, p = D.state().players[0];
      out[cls] = { id, hits, broken: b.spots.find(sp => sp.cls === cls).broken, lost: hp0 - b.hp, maxHp: b.maxHp,
        state: b.state, void: D.state().run.spent.includes(id) && !p.items.includes(id) };
    }
    return out;
  });
  const cuts = ['pierce', 'arc', 'burst', 'ground'];
  if (!res.took) throw new Error('the plinth token was not picked up');
  for (const c of cuts) {
    const r = res[c];
    if (r.hits.join() !== '2,1,0' || !r.broken) throw new Error(c + ': hits left after each shot ' + r.hits + ', broken ' + r.broken);
    if (r.lost < r.maxHp * 0.2 || r.state !== 'stagger' || !r.void) throw new Error(c + ': ' + JSON.stringify(r));
  }
  return cuts.map(c => res[c].id).join(', ');
};
