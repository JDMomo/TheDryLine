// A player pinned between a wide boss body and a wall can get out: every arena has a perch 3 tiles up against both walls, reached with a
// single jump from the corner. A scripted bot (no dash, no tokens) stands in each corner with the boss pushed against that wall, jumps once
// onto the perch, takes no body damage there, and walks and jumps off past the body to the open floor.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, out = [], bad = [];
    for (const reg of ['r1', 'r2', 'r3', 'r4', 'final']) for (const side of ['left', 'right']) {
      D.newRun(3); D.god(false); if (!D.startBoss(reg)) { bad.push(reg + ': no boss'); continue; }
      const room = G.rooms.current, b = room.boss, p = G.players[0], floor = b.floor, x0 = room.def.floorX[0], x1 = room.def.floorX[1];
      const dir = side === 'left' ? 1 : -1;                                   // towards the middle of the arena
      const bx = side === 'left' ? b.minX : b.maxX;
      const pin = { x: bx, y: floor, face: -dir };
      D.holdBoss(pin); p.hp = 60; p.inv = 0;
      D.place(0, side === 'left' ? x0 + 11 : x1 - 11, floor, dir); D.step(2);
      const tag = reg + ' ' + side + ' wall';
      // 1. one jump from the corner: straight up (the perch is directly above). A boss that overlaps the corner hurts first and stuns for a
      //    moment; the bot waits until it can act, then jumps once and holds the button to the apex.
      for (let k = 0; k < 300 && !(p.onGround && p.stun <= 0); k++) D.step(1);
      D.setInput(0, { jump: true }); let t = 0; const hp0 = p.hp;
      for (; t < 80 && !(p.vy > 0); t++) D.step(1);
      D.setInput(0, { jump: false });
      for (let k = 0; k < 120 && !(p.onGround && p.y < floor - 40); k++) D.step(1);
      const onPerch = p.onGround && Math.abs(p.y - (floor - 96)) < 2;
      if (!onPerch) { bad.push(tag + ': a single jump from the corner does not reach a perch 3 tiles up (y ' + Math.round(p.y) + ', floor ' + floor + ')'); continue; }
      // 2. no body damage while standing on it
      const hpOn = p.hp; D.step(120);
      if (p.hp < hpOn) bad.push(tag + ': the boss body hurts a player standing on the perch');
      // 3. walk to the end of the perch and jump over the body to the open floor
      let escaped = false, jumped = 0;
      for (let k = 0; k < 600 && !escaped; k++) {
        const pr = D.probe(0);
        D.setInput(0, { right: dir > 0, left: dir < 0, jump: false });
        if (p.onGround && pr.gap && p.y < floor - 40 && !jumped) { D.setInput(0, { right: dir > 0, left: dir < 0, jump: true }); jumped = 1; }
        else if (jumped === 1 && !p.onGround) D.setInput(0, { right: dir > 0, left: dir < 0, jump: true });
        else if (jumped === 1 && p.onGround) jumped = 2;
        D.step(1);
        const far = dir > 0 ? p.x > b.x + b.w / 2 + 14 : p.x < b.x - b.w / 2 - 14;
        escaped = far && p.onGround;            // past the body, standing on the floor or on a perch there
      }
      D.setInput(0, { right: false, left: false, jump: false });
      if (!escaped) bad.push(tag + ': from the perch the bot did not get past the boss body (x ' + Math.round(p.x) + ', y ' + Math.round(p.y) + ', boss ' + Math.round(b.x) + ' wide ' + b.w + ')');
      out.push(tag + ' ok');
    }
    return { bad, n: out.length };
  });
  if (res.bad.length) throw new Error(res.bad.join(' | '));
  return res.n + ' corners (5 arenas, both walls): one jump to the perch, then out';
};
