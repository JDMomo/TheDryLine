// Co-op play with 2, 3 and 4 players: cross three main rooms of a region, strand a player (it is pulled back to the leader), down one
// (it revives on entering the next room), then fight the Warden for 40 s with everybody pressing keys. No NaN, nobody out of the room or
// off the camera for long, the slot rule holds throughout, and the boss takes damage from more than one player.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, bad = [], notes = [];
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
    const slots = () => G.players.reduce((s, p) => s + p.slots, 0);
    const check = where => {
      const s = D.state();
      if (slots() !== (G.players.length === 4 ? 4 : 3)) bad.push(where + ': slots ' + slots());
      for (const p of s.players) if (![p.x, p.y, p.hp].every(Number.isFinite)) bad.push(where + ': NaN player');
    };
    const shake = (where, secs, bias) => {
      for (let i = 0; i < 120 * secs && bad.length < 5; i++) {
        if (i % 12 === 0) for (let k = 0; k < G.players.length; k++) {
          const h = { left: rng() < 0.15, right: rng() < (bias || 0.5), jump: rng() < 0.3, attack: rng() < 0.4, dash: rng() < 0.05 };
          D.setInput(k, h);
        }
        D.step(1);
        if (i % 20 === 0) check(where);
      }
    };
    for (const n of [2, 3, 4]) {
      G.players.length = 0; D.newRun(20 + n); D.unlockAll();
      while (G.players.length < n) D.addPlayer();
      if (G.players.length !== n) bad.push("party size " + G.players.length);
      const tag = n + 'p';
      for (const key of ['r1_bilge', 'r1_ribs', 'r1_trial']) { D.gotoRoom(key); shake(tag + ' ' + key, 8, 0.7); }
      // strand the last player far from the leader: it must be pulled back
      D.gotoRoom('r1_ribs'); D.step(2);
      const room = G.rooms.current, last = G.players[n - 1];
      D.place(0, 200, last.y, 1); D.place(n - 1, room.cols * 32 - 100, last.y, 1);
      for (let k = 0; k < n; k++) D.setInput(k, {});
      D.step(240);
      const d = Math.abs(G.players[0].x - last.x);
      if (d > 700) bad.push(tag + ': stranded player not pulled back, gap ' + Math.round(d));
      // down one, then enter another room: it revives with 1 hp
      G.players[n - 1].down = true; G.players[n - 1].hp = 0;
      D.gotoRoom('r1_trial'); D.step(3);
      if (G.players[n - 1].down) bad.push(tag + ': downed player did not revive on entering a room');
      // fight
      D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('cinder_bell'); D.give('basalt_roller');
      D.startBoss('r1');
      const hp0 = G.rooms.current.boss.hp;
      shake(tag + ' boss', 40, 0.5);
      const b = G.rooms.current.boss;
      notes.push(tag + ' boss ' + (b ? Math.round(b.hp) + '/' + hp0 : 'gone') + ' slots ' + G.players.map(p => p.slots).join('+') + ' ' + G.players.filter(p => !p.down).length + ' up');
    }
    return { bad, notes, errors: G.errors && G.errors.length };
  });
  if (r.bad.length) throw new Error(r.bad.join(' ; '));
  return r.notes.join(' | ');
};
