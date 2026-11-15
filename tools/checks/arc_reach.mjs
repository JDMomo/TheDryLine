// Arc tokens are lobs you aim by what you hold: Ochre Ladle lands 110 to 150 px ahead by default (short and steep), Up lobs it high, the
// facing direction throws it far. Every Warden's arc fare slot can be hit with each of the three arc tokens from a spot near it.
const ARC = ['ochre_ladle', 'sulphur_kettle', 'chalk_skipstone'];
const BOSSES = ['r1', 'r2', 'r3', 'r4', 'final'];
const NEAR = 220;          // the slot is reachable from a standing spot at most this far (horizontally) from it
export default async ({ page }) => {
  await page.evaluate(() => { G.debug.fullCharts = true; });      // these checks use every cut on every Warden
  // 1. how the Ladle lands on flat ground, per aim
  const lob = await page.evaluate(() => {
    const D = G.debug, out = {};
    D.newRun(5); D.god(true); D.gotoRoom('junction'); D.step(2); G.rooms.current.enemies.length = 0;
    const p = G.players[0];
    const flat = () => { const t = G.tiles; for (let r = t.rows - 1; r > 8; r--) for (let c = 4; c < t.cols - 16; c++) { let ok = true; for (let k = 0; k < 14 && ok; k++) ok = t.solid(c + k, r) && !t.solid(c + k, r - 1) && !t.solid(c + k, r - 6); if (ok) return { x: (c + 1) * 32, y: r * 32 }; } return null; };
    const spot = flat(); if (!spot) return { noSpot: true };
    for (const id of ARC_IDS()) for (const aim of ['neutral', 'up', 'fwd', 'down']) {
      G.combat.clear(); p.items = [id]; p.sel = 0; p.itemCd = 0; D.place(0, spot.x, spot.y, 1); D.step(2);
      D.setInput(0, aim === 'up' ? { up: true } : aim === 'fwd' ? { right: true } : aim === 'down' ? { down: true } : {});
      D.step(1); const x0 = p.x;
      D.setInput(0, { item: true }); D.step(1); D.setInput(0, { item: false });
      let last = null, apex = 0, n = 0;
      D.setInput(0, { up: false, right: false, down: false });
      while (G.shots.length && n++ < 600) { const s = G.shots[0]; last = s.x; apex = Math.max(apex, spot.y - 34 - s.y); D.step(1); }
      out[id + ' ' + aim] = { range: Math.round(last - x0), apex: Math.round(apex) };
    }
    return out;
    function ARC_IDS() { return ['ochre_ladle', 'sulphur_kettle', 'chalk_skipstone']; }
  });
  if (lob.noSpot) throw new Error('no flat floor for the lob test');
  const L = k => lob[k];
  if (L('ochre_ladle neutral').range < 110 || L('ochre_ladle neutral').range > 150) throw new Error('Ochre Ladle lands ' + L('ochre_ladle neutral').range + ' px ahead by default, wanted 110 to 150');
  if (L('ochre_ladle up').apex < L('ochre_ladle neutral').apex + 120) throw new Error('holding Up does not lob higher: ' + JSON.stringify([L('ochre_ladle up'), L('ochre_ladle neutral')]));
  if (L('ochre_ladle up').range > 160) throw new Error('the high lob lands too far: ' + L('ochre_ladle up').range);
  if (L('ochre_ladle fwd').range < L('ochre_ladle neutral').range + 70) throw new Error('holding the facing direction does not throw farther: ' + JSON.stringify([L('ochre_ladle fwd'), L('ochre_ladle neutral')]));
  if (L('ochre_ladle down').range > L('ochre_ladle neutral').range - 25) throw new Error('holding Down does not drop it closer: ' + JSON.stringify([L('ochre_ladle down'), L('ochre_ladle neutral')]));
  for (const id of ['ochre_ladle', 'sulphur_kettle']) if (L(id + ' neutral').range > 190) throw new Error(id + ' by default flies ' + L(id + ' neutral').range + ' px');

  // 2. every Warden's arc slot is reachable with every arc token
  const found = {};
  for (const reg of BOSSES) for (const id of ARC) {
    const r = await page.evaluate(({ reg, id, NEAR }) => {
      const D = G.debug;
      D.newRun(3); D.god(true); G.meta.cuts = ['arc', 'pierce', 'burst', 'ground'];
      G.players[0].items = [id]; G.players[0].sel = 0;
      if (!D.startBoss(reg)) return { err: 'no boss for ' + reg };
      let room = G.rooms.current, b = room.boss;
      const x0 = room.def.floorX[0], x1 = room.def.floorX[1], cx = Math.round((x0 + x1) / 2 / 16) * 16, floor = b.floor;
      const hold = { x: cx, y: floor, face: -1 };
      if (reg === 'final') hold.state = 'rainTell';          // the Bell Housing only shows while it chimes
      D.holdBoss(hold); D.step(2);
      const sp = b.spots.find(s => s.cls === 'arc');
      if (!sp) return { err: 'no arc slot' };
      const p = G.players[0], pos = b.spotPos(sp), res = { spotX: Math.round(pos.x), spotY: Math.round(pos.y), best: null, tried: 0 };
      if (!b.isExposed(sp)) return { err: 'the arc slot is not exposed in the test pose' };
      const tryAt = (x, aim, face) => {
        G.combat.clear(); sp.hp = 3; sp.broken = false; p.itemCd = 0; p.items = [id]; p.sel = 0; b.hp = b.maxHp; Object.assign(b, hold);
        D.place(0, x, floor, face); D.step(2);
        D.setInput(0, aim === 'up' ? { up: true } : aim === 'fwd' ? (face > 0 ? { right: true } : { left: true }) : aim === 'down' ? { down: true } : {});
        D.step(1); D.setInput(0, { item: true }); D.step(1); D.setInput(0, { item: false });
        D.setInput(0, { up: false, left: false, right: false, down: false });
        for (let n = 0; n < 220 && G.shots.length; n++) { D.step(1); if (sp.hp < 3) break; }
        return sp.hp < 3;
      };
      const xs = [];
      for (let x = x0 + 16; x <= x1 - 16; x += 16) if (Math.abs(x - cx) > b.w / 2 + 14) xs.push(x);
      xs.sort((a, c) => Math.abs(a - pos.x) - Math.abs(c - pos.x));       // nearest to the slot first
      for (const x of xs) {
        const face = cx > x ? 1 : -1;
        for (const aim of ['neutral', 'up', 'fwd', 'down']) {
          res.tried++;
          if (tryAt(x, aim, face)) { const d = Math.abs(x - pos.x); if (!res.best || d < res.best.d) res.best = { x, aim, d: Math.round(d) }; }
        }
        if (res.best && Math.abs(x - pos.x) > res.best.d + 40) break;
      }
      D.holdBoss(null);
      return res;
    }, { reg, id, NEAR });
    found[reg + ' ' + id] = r;
  }
  const bad = [];
  for (const k in found) {
    const r = found[k];
    if (r.err) bad.push(k + ': ' + r.err);
    else if (!r.best) bad.push(k + ': cannot be hit from anywhere (slot at ' + r.spotX + ',' + r.spotY + ')');
    else if (r.best.d > NEAR) bad.push(k + ': only from ' + r.best.d + ' px away (' + r.best.aim + ')');
  }
  if (bad.length) throw new Error(bad.join(' | '));
  return 'ladle ' + L('ochre_ladle neutral').range + ' px, up ' + L('ochre_ladle up').range + '/' + L('ochre_ladle up').apex + ' high, far ' + L('ochre_ladle fwd').range + '; slots: ' + Object.entries(found).map(([k, r]) => k.replace(/_.*? /, ' ') + ' ' + r.best.d + (r.best.aim[0])).join(', ');
};
