// Slashing the Tollkeeper to death marks it beaten, opens the boss door, gives the Warden reward, and the party can walk out.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug;
    D.newRun(3); D.god(true); D.startBoss('r1');
    const s0 = D.state(), floor = s0.room.boss.floor, locked = s0.room.locked, hp0 = s0.players[0].maxHp;
    D.holdBoss({ x: 720, y: floor, face: -1 });
    for (let i = 0; i < 120 && D.state().room.boss.state !== 'dead'; i++) {
      D.place(0, 640, floor, 1); D.setInput(0, { attack: true }); D.step(2); D.setInput(0, { attack: false }); D.step(36);
    }
    const s = D.state();
    const out = { lockedBefore: locked, dead: s.room.boss.state === 'dead', beaten: !!s.run.beaten.r1, fight: s.room.fight, locked: s.room.locked,
      door: s.room.props.some(p => p.type === 'door'), trinkets: s.room.props.filter(p => p.type === 'plinth' && p.data.trinket).length,
      pip: s.players[0].maxHp - hp0, scrip: s.run.shards, from: s.room.id };
    D.place(0, 300, floor, -1); D.setInput(0, { left: true }); D.step(120 * 3); D.setInput(0, { left: false });
    out.leftTo = D.state().room.kind;
    return out;
  });
  if (!r.lockedBefore) throw new Error('the boss door should lock during the fight');
  if (!r.dead || !r.beaten || r.fight || r.locked) throw new Error(JSON.stringify(r));
  if (!r.door || r.trinkets < 1 || r.pip !== 1 || r.scrip < 40) throw new Error('reward missing: ' + JSON.stringify(r));
  if (r.leftTo !== 'main') throw new Error('could not walk out of the arena: ' + r.leftTo);
};
