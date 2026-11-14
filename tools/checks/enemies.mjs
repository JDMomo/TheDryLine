// Spawns each of the eight enemies in a plain test room and checks them: 20 s with an idle player, 20 s with random input,
// then kills by slashes (scrip must drop), the down-slash bounce, the Turnstile's shield and the Hanging Lamp's drop.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, T = G.C.T, run = n => D.step(n);
    const IDS = ['ballast_crab', 'brine_spout', 'turnstile', 'signal_gull', 'lamp_wisp', 'brine_toad', 'handcar', 'hanging_lamp'];
    const out = { fail: [], notes: [] };
    const bad = (id, msg) => out.fail.push(id + ': ' + msg);
    D.newRun(5); D.god(true); D.gotoRoom('r1_stern');
    // A test room: 30 x 17, floor rows 15-16, a spiked pit at columns 12-14, walls and ceiling.
    const grid = [];
    for (let r = 0; r < 17; r++) {
      let row = '';
      for (let c = 0; c < 30; c++) row += (r === 0 || r >= 15 || c === 0 || c === 29) ? '#' : '.';
      grid.push(row);
    }
    grid[15] = grid[15].slice(0, 12) + '^^^' + grid[15].slice(15);
    const room = G.rooms.current;
    room.grid = grid; room.cols = 30; room.rows = 17; room.enemies = []; room.props = []; room.cleared = false; room.boss = null;
    G.tiles.load(grid);
    const spikeCell = (x, y) => G.tiles.spike(Math.floor(x / T), Math.floor((y - 2) / T)) || G.tiles.spike(Math.floor(x / T), Math.floor((y + 2) / T));
    const spawn = (id, col) => {
      const d = G.enemyDefs[id], x = col * T + T / 2, y = 15 * T;
      const e = new G.Enemy(d, x, d.flying ? y - 8 - (id === 'signal_gull' ? 60 : 0) : y);
      room.enemies.push(e); return e;
    };
    const clearAll = () => { room.enemies.length = 0; G.shots.length = 0; G.pickups.length = 0; };
    const sane = (id, e, tag) => {
      const vals = [e.x, e.y, e.vx, e.vy, e.hp];
      if (vals.some(v => typeof v !== 'number' || Number.isNaN(v))) bad(id, tag + ' NaN ' + vals);
      if (e.x < 0 || e.x > 30 * T || e.y < 0 || e.y > 17 * T + 1) bad(id, tag + ' left the room ' + Math.round(e.x) + ',' + Math.round(e.y));
      if (!G.enemyDefs[id].flying && !e.dead && spikeCell(e.x, e.y) && id !== 'hanging_lamp') bad(id, tag + ' stood in spikes');
      if (!G.enemyDefs[id].flying && id !== 'hanging_lamp' && !e.dead && e.y > 15 * T + 1) bad(id, tag + ' fell into the pit');
    };
    const rng = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
    const keys = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash'];

    const seen = {}; IDS.forEach(i => seen[i] = new Set());
    for (const id of IDS) {
      const def = G.enemyDefs[id];
      if (!def) { bad(id, 'not defined'); continue; }
      if (def.hp < 20 || def.hp > 60 || !def.touch || def.shards[0] < 2 || def.shards[1] > 5) bad(id, 'numbers out of range');
      for (const mode of ['idle', 'random']) {
        clearAll(); D.place(0, 4 * T, 15 * T, 1); run(2);
        const e = spawn(id, id === 'hanging_lamp' ? 20 : 18);
        for (let i = 0; i < 20 * 120 / 12; i++) {
          if (mode === 'random') {
            if (i % 5 === 0) for (const k of keys) D.setInput(0, { [k]: rng() < 0.3 });
            if (i % 40 === 0) D.place(0, (3 + rng() * 24) * T, 15 * T, 1);
          }
          run(12); sane(id, e, mode);
          seen[id].add(e.state);
          if (e.dead) break;
        }
        for (const k of keys) D.setInput(0, { [k]: false });
      }
      // kill by slashes (from behind) and check the scrip
      clearAll(); G.run.shards = 0; D.place(0, 4 * T, 15 * T, 1); run(2);
      const e = spawn(id, id === 'hanging_lamp' ? 20 : 18);
      let killed = false;
      for (let i = 0; i < 400 && !killed; i++) {
        D.place(0, e.x - e.face * 40, e.y, e.face); run(1);
        D.setInput(0, { attack: true }); run(2); D.setInput(0, { attack: false }); run(22);
        sane(id, e, 'kill'); killed = e.dead && e.hp <= 0.01;
      }
      if (!killed) { bad(id, 'could not be killed by slashes (hp ' + e.hp + ', ' + e.state + ')'); continue; }
      const dropped = G.pickups.reduce((a, k) => a + k.value, 0) + G.run.shards;
      if (dropped < def.shards[0] - 0.01) bad(id, 'dropped only ' + dropped);
      out.notes.push(id + ' drops ' + Math.round(dropped));
      clearAll();
    }

    // down slash bounces off every enemy
    for (const id of IDS) {
      clearAll(); D.place(0, 4 * T, 15 * T, 1); run(2);
      const e = spawn(id, id === 'hanging_lamp' ? 20 : 18);
      if (id === 'hanging_lamp') { D.place(0, e.x, 15 * T, 1); for (let i = 0; i < 200 && e.state !== 'landed'; i++) run(2); if (e.state !== 'landed') { bad(id, 'did not drop and land'); continue; } }
      if (id === 'lamp_wisp' || id === 'signal_gull') { e.vx = e.vy = 0; }
      let bounced = false;
      for (let tries = 0; tries < 8 && !bounced; tries++) {
        e.hp = e.def.hp; e.state === 'landed' && (e.t = 3);
        D.place(0, e.x, e.y - e.h - 30, 1); D.setInput(0, { down: true, attack: false }); run(1);
        D.setInput(0, { attack: true }); let minVy = 0;
        for (let k = 0; k < 8; k++) { run(1); minVy = Math.min(minVy, D.state().players[0].vy); }
        D.setInput(0, { attack: false, down: false }); run(12);
        bounced = minVy < -200;
      }
      if (!bounced) bad(id, 'down slash did not bounce');
    }

    // Turnstile shield: front slash blocked, back slash and token hurt
    clearAll(); D.place(0, 4 * T, 15 * T, 1); run(2);
    { const e = spawn('turnstile', 18); e.face = -1; e.vx = 0;
      const slash = (side) => { const hp = e.hp; D.place(0, e.x + side * 40, e.y, -side); run(1); D.setInput(0, { attack: true }); run(2); D.setInput(0, { attack: false }); run(30); return hp - e.hp; };
      const front = slash(-1); // player at x - 40 while e.face = -1: front
      e.face = -1; e.state = 'walk'; e.vx = 0;
      const back = slash(1);
      e.face = -1; const hp = e.hp; G.combat.strike({ x: e.x, y: e.y - 20, r: 10, cls: 'pierce', dmg: 6, owner: G.players[0] });
      const tok = hp - e.hp;
      out.notes.push('turnstile front ' + front + ' back ' + back + ' token ' + tok);
      if (front !== 0) bad('turnstile', 'a front slash hurt it (' + front + ')');
      if (back <= 0) bad('turnstile', 'a back slash did not hurt it');
      if (tok <= 0) bad('turnstile', 'a token did not hurt it');
    }

    // Hanging Lamp: hangs at the ceiling, drops when passed under, breaks by itself a few seconds after landing
    clearAll(); D.place(0, 4 * T, 15 * T, 1); run(2);
    { const e = spawn('hanging_lamp', 20); const y0 = e.y, ceil = T;
      if (Math.abs(e.ceil - ceil) > 1 || y0 > ceil + 80) bad('hanging_lamp', 'not hanging from the ceiling (y ' + y0 + ')');
      run(240); if (e.state !== 'hang') bad('hanging_lamp', 'dropped with nobody under it');
      D.place(0, e.x, 15 * T, 1); let t = 0, fall = 0;
      for (; t < 60 && e.state !== 'fall' && e.state !== 'landed'; t++) run(6);
      if (e.state === 'hang') bad('hanging_lamp', 'did not drop when a player was under it');
      for (let i = 0; i < 200 && e.state !== 'landed'; i++) { run(6); fall++; }
      if (e.state !== 'landed') bad('hanging_lamp', 'never landed');
      D.place(0, 4 * T, 15 * T, 1);
      for (let i = 0; i < 600 && !e.dead; i++) run(6);
      if (!e.dead) bad('hanging_lamp', 'never broke after landing');
    }
    for (const id of IDS) out.notes.push(id + ' states ' + [...seen[id]].join('/'));
    return out;
  });
  if (res.fail.length) throw new Error(res.fail.slice(0, 12).join(' | '));
  return res.notes.join('; ');
};
