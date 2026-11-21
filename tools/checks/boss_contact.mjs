// Fairness (playtest round 2, issue 7): a Warden's body only hurts during the committed strike frames of an attack.
// For every Warden and every attack in its registry, with a player standing inside the body:
//  - wind-up (tell), recovery, idle, intro and stagger states give no contact box and no damage;
//  - the strike states are the only ones that may have a contact box (and, for bosses with a body hit, one that touches the player).
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, out = { fail: [], notes: [] }, bad = m => out.fail.push(m);
    const regionOf = { tollkeeper: 'r1', lamp_heron: 'r2', switchman_idol: 'r3', gatewhale: 'r4', long_clock: 'final' };
    let checked = 0, struck = 0;
    for (const id in regionOf) {
      D.fullCharts = true; D.newRun(5); D.god(false); D.startBoss(regionOf[id]);
      const b = G.rooms.current.boss, p = G.players[0];
      const inside = () => { p.place(b.x, b.floor, 1); p.hp = p.maxHp; p.inv = 0; };
      const probe = (why) => {
        b.hp = b.maxHp; inside(); const boxes = b.contactBoxes();
        if (boxes.length) bad(id + ' ' + why + ': contact box while not striking');
        const hp0 = p.hp; G.combat.hurtPlayers && 0; for (const r of b.contactBoxes()) G.combat.hurtPlayers(r, b.x);
        if (p.hp < hp0) bad(id + ' ' + why + ': the player was hurt standing inside the boss');
        checked++;
      };
      for (const st of ['idle', 'stagger', 'intro']) { b.attack = null; b.set(st, 5); probe(st); }
      for (const aid in G.attackDefs[id] || {}) {
        const a = G.attackDef(id, aid); if (!a || !a.tell) continue;
        b.attack = aid; b.set(a.tell, 5); if (b.phase() !== 'wind') bad(id + '.' + aid + ': tell is not a wind phase'); probe(aid + ' tell ' + a.tell);
        for (const rs of a.recoverStates) { b.set(rs, 5); b.attack = aid; probe(aid + ' recover ' + rs); }
        for (const ss of a.strike) { b.set(ss, 5); b.attack = aid; if (b.phase() !== 'strike') bad(id + '.' + aid + ': ' + ss + ' is not a strike phase'); if (b.contactBoxes().length) struck++; }
      }
    }
    out.notes.push(checked + ' non-strike states safe, ' + struck + ' strike states with a body box');
    return out;
  });
  if (res.fail.length) throw new Error(res.fail.slice(0, 8).join(' | '));
  return res.notes.join('; ');
};
