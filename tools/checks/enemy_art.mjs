// The enemy skins (assets/enemies, G.enemySkins): strips load, every state of every skinned enemy maps to a real frame, the defeat strip
// plays and ends, the Scrapper's guard shows "Blocked", nothing errors with G.artTest on or off, and the figures fit their hitboxes.
// Saves tools/shots/enemy_art.png (each skinned enemy idle, wind-up and strike, hitboxes drawn) and enemy_art_game.png (in the game).
export default async ({ page, shots }) => {
  await page.evaluate(() => { G.debug.newRun(5); });
  await page.waitForFunction(() => !G.spritesPending);
  const res = await page.evaluate(() => {
    const D = G.debug, T = G.C.T, out = { fail: [], notes: [] }, bad = m => out.fail.push(m);
    const SKINNED = ['ballast_crab', 'brine_spout', 'signal_gull', 'handcar', 'turnstile'];
    const FIG = { strider: 60, boiler: 84, rivet: 59, gearling: 88, scrapper: 112 };      // standing figure heights in the move strips (cell px, measured)
    D.god(true); D.gotoRoom('r1_stern');
    const grid = [];
    for (let r = 0; r < 17; r++) { let row = ''; for (let c = 0; c < 30; c++) row += (r === 0 || r >= 15 || c === 0 || c === 29) ? '#' : '.'; grid.push(row); }
    const room = G.rooms.current;
    room.grid = grid; room.cols = 30; room.rows = 17; room.enemies = []; room.props = []; room.cleared = false; room.boss = null; G.tiles.load(grid);
    const mk = (id, col, dy = 0) => { const d = G.enemyDefs[id], e = new G.Enemy(d, col * T + T / 2, 15 * T + (d.flying ? -60 : 0) + dy); return e; };
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    const nameOf = { ballast_crab: 'Strider', brine_spout: 'Boiler', signal_gull: 'Rivet', handcar: 'Gearling', turnstile: 'Scrapper', lamp_wisp: 'Lamp Wisp', brine_toad: 'Brine Toad', hanging_lamp: 'Hanging Lamp' };
    for (const id in nameOf) if (G.enemyDefs[id].name !== nameOf[id]) bad('display name of ' + id + ' is ' + G.enemyDefs[id].name);

    // 1. strips and fit
    for (const id of SKINNED) {
      const sk = G.enemySkins[id], d = G.enemyDefs[id];
      if (!sk) { bad('no skin for ' + id); continue; }
      for (const [a, n] of [['move', 4], ['attack', 6], ['defeat', 4]]) { const st = G.strips[sk.id + '_' + a]; if (!st || st.frames !== n) bad(sk.id + '_' + a + ' not loaded with ' + n + ' frames'); }
      const k = sk.h / G.strips[sk.id + '_move'].fh, fh = FIG[sk.id] * k, ratio = fh / d.h;
      if (ratio < 0.95 || ratio > 1.3) bad(id + ': figure ' + fh.toFixed(1) + ' px tall against a hitbox of ' + d.h + ' (ratio ' + ratio.toFixed(2) + ')');
      if (d.flying && !(sk.center && sk.fig)) bad(id + ': a flyer needs center and fig in its skin');
    }

    // 2. every state maps to a valid frame, across the whole of its timer
    const STATES = { ballast_crab: [['patrol',0],['wind',0.38],['lunge',0.34],['recover',0.5]],
      brine_spout: [['idle', 1], ['wind', 0.6], ['ventwind',0.42], ['spent', 0.72]],
      signal_gull: [['hover', 1], ['wind', 0.55], ['swoop', 1], ['recover',0.48]],
      handcar: [['roll', 0], ['wind', 0.65], ['dash', 1], ['rest', 0.9]],
      turnstile: [['walk', 0], ['turn', 0.5], ['wind',0.55], ['charge',0.48], ['recover',0.72], ['walk', 0, 'blocked']] };
    const seen = {};
    for (const id of SKINNED) {
      const e = mk(id, 10), sk = G.enemySkins[id], d = G.enemyDefs[id]; seen[id] = new Set();
      for (const s of STATES[id]) {
        const [state, t0, extra] = Array.isArray(s) ? s : [s, 0];
        for (let i = 0; i <= 10; i++) {
          e.set(state, t0); e.t = t0 * (1 - i / 10); e.prev = extra === 'swoop' ? 'swoop' : e.prev; e.sAt = G.time - i * 0.03; e.shieldHit = extra === 'blocked' ? 0.1 : 0; e.vx = 80; e.vy = 40;
          const pick = d.skinFrame ? d.skinFrame(e, sk) : ['move', G.time];
          const st = G.strips[sk.id + '_' + pick[0]];
          if (!st) { bad(id + ' ' + state + ': no strip ' + pick[0]); continue; }
          const f = Math.floor(pick[1]);
          if (!(f >= 0) || !Number.isFinite(pick[1]) || (pick[0] !== 'move' && f >= st.frames)) bad(id + ' ' + state + ' maps to frame ' + pick[1] + ' of ' + st.frames);
          seen[id].add(pick[0] + ':' + (pick[0] === 'move' ? '*' : f));
        }
      }
      e.shieldHit = 0;
    }
    const hasF = (id, k) => seen[id].has(k);
    for (const k of ['attack:0', 'attack:1', 'attack:2', 'attack:3', 'attack:4', 'attack:5']) { if (!hasF('ballast_crab', k)) bad('ballast_crab never shows ' + k); }
    for (const k of ['attack:0', 'attack:1', 'attack:2', 'attack:3', 'attack:4', 'attack:5']) { if (!hasF('brine_spout', k)) bad('brine_spout never shows ' + k); }
    for (const k of ['attack:0', 'attack:1', 'attack:2', 'attack:3', 'attack:4']) { if (!hasF('signal_gull', k)) bad('signal_gull never shows ' + k); }
    for (const k of ['attack:0', 'attack:1', 'attack:2', 'attack:3', 'attack:4', 'attack:5']) { if (!hasF('handcar', k)) bad('handcar never shows ' + k); }
    for (const k of ['attack:0', 'attack:1', 'attack:2', 'attack:3', 'attack:4', 'attack:5']) { if (!hasF('turnstile', k)) bad('turnstile never shows ' + k); }

    // 3. the Scrapper's guard: held frame facing a player, a front slash is refused with a float and a spark, a back slash hurts
    {
      room.enemies.length = 0; G.fx.clear();
      const e = mk('turnstile', 15); e.face = 1; e.set('walk', 0); e.cool = 99; room.enemies.push(e);
      const p = G.players[0]; D.place(0, e.x + 60, e.y, -1); p.vx = 0;
      const sk = G.enemySkins.turnstile, g = G.enemyDefs.turnstile.skinFrame(e, sk);
      if (g[0] !== 'move') bad('scrapper should stay in its neutral move strip while merely guarding: ' + g);
      const hp = e.hp; G.combat.slashBy = { p, s: { dir: 'side' } }; e.damage(5, p.x); G.combat.slashBy = null;
      if (e.hp !== hp) bad('front slash got through the Scrapper');
      if (!G.fx.floaters.some(f => f.text === 'Blocked')) bad('no Blocked float');
      if (G.enemyDefs.turnstile.skinFrame(e, sk)[1] !== 3) bad('no shove frame on a block');
      D.place(0, e.x - 60, e.y, 1); G.combat.slashBy = { p, s: { dir: 'side' } }; e.damage(5, p.x); G.combat.slashBy = null;
      if (e.hp !== hp - 5) bad('back slash should hurt the Scrapper');
      const away = G.enemyDefs.turnstile.skinFrame(e, sk); e.shieldHit = 0; D.place(0, e.x - 60, e.y, 1);
      if (G.enemyDefs.turnstile.skinFrame(e, sk)[0] !== 'move') bad('Scrapper should walk when the player is behind it');
      room.enemies.length = 0;
    }

    // 4. defeat: the strip plays where the enemy fell, then ends; with the art off only the generic burst
    const defeat = on => {
      G.artTest = on; const r = {};
      for (const id of SKINNED) {
        G.fx.clear(); room.enemies.length = 0; const e = mk(id, 12); room.enemies.push(e);
        e.damage(9999, e.x - 10);
        const anims = () => G.fx.parts.filter(q => q.anim);
        r[id] = { dead: e.dead, start: anims().length, pos: anims()[0] ? [Math.round(anims()[0].x - e.x)] : null };
        D.step(20); r[id].mid = anims().length;
        for (let i = 0; i < 5; i++) { G.fx.draw(ctx); }
        D.step(110); r[id].end = anims().length;
      }
      return r;
    };
    const on = defeat(true), off = defeat(false); G.artTest = true;
    for (const id of SKINNED) {
      if (!on[id].dead) bad(id + ' did not die');
      if (on[id].start !== 1 || on[id].mid !== 1 || on[id].end !== 0) bad(id + ' defeat with art on: ' + JSON.stringify(on[id]));
      if (off[id].start !== 0) bad(id + ' defeat with art off should play no strip');
    }
    for (const id of ['lamp_wisp', 'brine_toad', 'hanging_lamp']) {
      G.fx.clear(); const e = mk(id, 12); room.enemies.push(e); e.damage(9999, e.x - 10); D.step(2);
      if (G.fx.parts.some(q => q.anim)) bad(id + ' has no art and should not play a defeat strip');
      room.enemies.length = 0;
    }

    // 5. everything draws and updates, art on and off, in every state it passes through
    for (const art of [true, false]) {
      G.artTest = art;
      for (const id in nameOf) {
        room.enemies.length = 0; G.fx.clear();
        const e = mk(id, 14); room.enemies.push(e);
        for (let i = 0; i < 240; i++) { D.step(1); if (i % 4 === 0) { ctx.clearRect(0, 0, 960, 544); e.draw(ctx); } if (i === 100 && !e.dead) { e.kbT = 0.12; e.kbV = 200; e.flash = 0.1; } }
        G.debugBoxes = true; e.draw(ctx); G.debugBoxes = false;
        if (e.dead) continue;
      }
    }
    G.artTest = true; room.enemies.length = 0; G.fx.clear();
    out.errors = G.errors.slice();
    return out;
  });
  if (res.fail.length) throw new Error(res.fail.join('; '));
  if (res.errors.length) throw new Error('G.errors: ' + JSON.stringify(res.errors));

  // the shot: each skinned enemy in idle, wind-up and strike, hitboxes drawn (a canvas in the page, photographed by the browser)
  await page.evaluate(() => {
    const T = G.C.T, SK = ['ballast_crab', 'brine_spout', 'signal_gull', 'handcar', 'turnstile'];
    const cv = document.createElement('canvas'); cv.id = 'enemy_art_shot'; cv.width = 960; cv.height = 360;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:960px;height:360px;background:#1f3a3a';
    document.body.appendChild(cv); const ctx = cv.getContext('2d');
    const POSES = {
      ballast_crab: [['patrol', 0], ['wind', 0.38, 0.2], ['lunge', 0.34, 0.2]],
      brine_spout: [['idle', 1], ['wind', 0.6, 0.45], ['spent', 0.35, 0.34]],
      signal_gull: [['hover', 1], ['wind', 0.55, 0.3], ['swoop', 1, 0.4]],
      handcar: [['roll', 0], ['wind', 0.65, 0.35], ['dash', 1, 0.5]],
      turnstile: [['walk', 0], ['wind', 0.55, 0.25], ['charge', 0.48, 0.2, true]]
    };
    ctx.fillStyle = '#e9e2cf'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ['idle', 'wind-up (Scrapper: turn)', 'strike (Scrapper: blocked)'].forEach((t, i) => ctx.fillText(t, 160 + i * 320, 16));
    SK.forEach((id, r) => {
      const y0 = 70 + r * 70;
      ctx.strokeStyle = '#5b7a73'; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(960, y0); ctx.stroke();
      ctx.fillStyle = '#e9e2cf'; ctx.textAlign = 'left'; ctx.fillText(G.enemyDefs[id].name, 4, y0 - 52); ctx.textAlign = 'center';
      POSES[id].forEach(([state, t0, tl, blocked], c) => {
        const d = G.enemyDefs[id], e = new G.Enemy(d, 160 + c * 320, y0 + (d.flying ? -20 : 0));
        e.face = 1; e.set(state, t0); if (tl !== undefined) e.t = tl; e.vx = 120; e.vy = 60; if (blocked) e.shieldHit = 0.1;
        G.debugBoxes = true; e.draw(ctx); G.debugBoxes = false;
      });
    });
  });
  await page.waitForTimeout(100);
  await page.locator('#enemy_art_shot').screenshot({ path: shots + '/enemy_art.png' });
  await page.evaluate(() => document.getElementById('enemy_art_shot').remove());
  // the same enemies in the game with the boxes on
  await page.evaluate(() => {
    const D = G.debug, T = G.C.T; D.newRun(5); D.god(true); D.gotoRoom('r1_stern');
    const grid = []; for (let r = 0; r < 17; r++) { let row = ''; for (let c = 0; c < 30; c++) row += (r === 0 || r >= 15 || c === 0 || c === 29) ? '#' : '.'; grid.push(row); }
    const room = G.rooms.current; room.grid = grid; room.cols = 30; room.rows = 17; room.enemies = []; room.props = []; room.boss = null; room.cleared = false; G.tiles.load(grid);
    ['ballast_crab', 'brine_spout', 'turnstile', 'handcar'].forEach((id, i) => { const d = G.enemyDefs[id], e = new G.Enemy(d, (6 + i * 5) * T + 16, 15 * T); e.face = 1; room.enemies.push(e); });
    const g = G.enemyDefs.signal_gull; room.enemies.push(new G.Enemy(g, 27 * T, 11 * T));
    D.place(0, 4 * T, 15 * T, 1); G.debugBoxes = true; D.step(2);
  });
  await page.waitForTimeout(150);
  await page.locator('#game').screenshot({ path: shots + '/enemy_art_game.png' });
  await page.evaluate(() => { G.debugBoxes = false; });
  return 'strips, states, defeat, guard, fit, art on/off; shots saved';
};
