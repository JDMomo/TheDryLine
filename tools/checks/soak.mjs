// Random input: 20 simulated seconds in each of four rooms (all moves unlocked), then 60 seconds of a boss fight.
// No errors, no NaN, and no player outside the current room.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, acts = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'item', 'heal', 'cycle', 'interact'];
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(42);
    const bad = [];
    const check = where => {
      const s = D.state(), room = s.room, W = room.cols * 32, H = room.rows * 32;
      for (const p of s.players) {
        if (![p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite)) bad.push(where + ': NaN player ' + JSON.stringify(p));
        else if (!room.transition && (p.x < -8 || p.x > W + 8 || p.y < 0 || p.y > H)) bad.push(where + ': out of bounds ' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ' in ' + room.def);
      }
      if (room.boss && ![room.boss.x, room.boss.y, room.boss.hp].every(Number.isFinite)) bad.push(where + ': NaN boss');
      for (const e of room.enemies) if (![e.x, e.y].every(Number.isFinite)) bad.push(where + ': NaN enemy');
    };
    const shake = (where, seconds) => {
      let held = {};
      for (let i = 0; i < 120 * seconds && bad.length < 5; i++) {
        if (i % 9 === 0) { held = {}; for (const a of acts) held[a] = rng() < 0.3; D.setInput(0, held); }
        D.step(1);
        if (i % 10 === 0) check(where);
      }
    };
    D.newRun(11); D.god(true); D.unlockAll();
    for (const key of ['junction', 'r1_bilge', 'r1_ribs', 'r1_trial']) { D.gotoRoom(key); shake(key, 20); }
    D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('cinder_bell'); D.give('basalt_roller');
    D.startBoss('r1'); shake('boss fight', 60);
    return { bad, boss: D.state().room.boss };
  });
  if (r.bad.length) throw new Error(r.bad.join(' ; '));
  return 'boss ' + (r.boss ? r.boss.state + ' at ' + Math.round(r.boss.hp) + ' hp' : 'gone (room left)');
};
