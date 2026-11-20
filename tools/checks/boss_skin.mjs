// Boss skins (js/art/boss_skins.js) with the throwaway fixture skin (tools/art/fixtures/testboss, cut by tools/art/cut_boss.py) on the Tollkeeper:
//  - the strips load with the frame counts of the table (the WIDE charge sheet, parts a + b, is one 8 frame strip);
//  - every state of the boss and every phase of every attack maps to a strip that exists and a valid frame; wind-up frames climb over the real
//    tell timer, the strike frame(s) show while it hurts, recovery frames climb over the recovery timer; hurt (light, heavy), turn (both ways),
//    enraged, move, stagger, defeat each pick their strip;
//  - fare-slot badges are drawn at the real anchors; a skin-drawn shot uses the fx strip; the flag off (or the art off) means no skin;
//  - anything missing falls back to the code-drawn boss: no strip for an attack, or no idle strip at all, draws and does not throw.
// Saves tools/shots/boss_skin.png (the skinned Tollkeeper in four states).
import path from 'path';
export default async ({ page, shots }) => {
  await page.evaluate(() => { G.debug.fullCharts = true; G.debug.newRun(5); G.debug.god(true); G.debug.startBoss('r1'); G.debug.bossSkinFixture = true; });
  await page.waitForFunction(() => { G.bossSkin.entryOf(G.rooms.current.boss); return !G.spritesPending; }, null, { timeout: 8000 });
  const res = await page.evaluate(() => {
    const out = { fail: [], notes: [] }, bad = m => out.fail.push(m), D = G.debug, S = G.bossSkin;
    const b = G.rooms.current.boss, e = G.bossSkinFixtures.tollkeeper;
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    // 1. strips
    for (const n in e.strips) { const st = S.strip(e, n); if (!st || st.frames !== e.strips[n] || !(st.fw > 0 && st.fh > 0)) bad('strip ' + n + ' not loaded with ' + e.strips[n] + ' frames'); else if (st.img.naturalWidth !== st.fw * st.frames) bad('strip ' + n + ' width is not frames x cell'); }
    if (e.strips.charge !== 8) bad('the WIDE charge sheet (parts a and b) should be one strip of 8 frames');
    const split = [S.split(4), S.split(6), S.split(8)].map(a => a.join('/')).join(' ');
    if (split !== '2/1/1 3/1/2 3/2/3') bad('default split of 4, 6, 8 frames: ' + split);
    // 2. helpers
    const valid = (p, why) => {
      if (!p) { bad(why + ': no pick'); return null; }
      const st = S.strip(e, p.name);
      if (!st) { bad(why + ': strip ' + p.name + ' does not exist'); return null; }
      if (!Number.isFinite(p.frame) || Math.floor(p.frame) < 0 || (!p.loop && Math.floor(p.frame) >= st.frames)) bad(why + ': frame ' + p.frame + ' of ' + st.frames + ' in ' + p.name);
      return p;
    };
    const at = (state, t0, frac, extra) => { b.hp = b.maxHp; b.flags = {}; b.set(state, t0); b.t = t0 * (1 - frac); b.sAge = t0 * frac; b.hurtAt = -9; b.speed = 0; Object.assign(b, extra || {}); };
    const run = (why, p0) => valid(S.pick(b, e), why);
    G.time += 100;
    // 3. calm states
    at('sleep', 0, 0); if (run('sleep').name !== 'idle') bad('sleep is not idle');
    at('intro', 1, 0.5); if (run('intro').name !== 'idle') bad('intro is not idle');
    at('idle', 1, 0.2); if (run('idle').name !== 'idle') bad('idle is not idle');
    at('idle', 1, 0.2, { speed: 60 }); if (run('walking').name !== 'move') bad('walking is not move');
    at('idle', 1, 0.2); b.hp = b.maxHp * 0.3; if (run('enraged').name !== 'enraged') bad('below half hp the idle is the enraged loop'); b.hp = b.maxHp;
    at('stagger', 2.6, 0.5); if (run('stagger').name !== 'stagger') bad('stagger');
    for (const heavy of [false, true]) for (const [age, want] of [[0.02, 0], [0.2, 1]]) {
      at('idle', 1, 0.2); b.hurtAt = G.time - age; b.hurtHeavy = heavy; const p = run('hurt'); if (p.name !== 'hurt' || p.frame !== want + (heavy ? 2 : 0)) bad('hurt heavy=' + heavy + ' age ' + age + ' gave ' + p.name + ':' + p.frame);
    }
    // turn: a flip of the facing plays the turn strip (right to left as drawn, left to right backwards and mirrored), then returns to idle
    at('idle', 1, 0.2); b.face = 1; S.pick(b, e); G.time += 1; b.face = -1; G.time += 0.01; let p = run('turn r>l'); if (p.name !== 'turn' || p.frame !== 0 || p.face !== 1) bad('turn right to left starts with frame 0, unmirrored: ' + JSON.stringify(p));
    G.time += 0.29; p = run('turn r>l end'); if (p.name !== 'turn' || p.frame !== 3) bad('turn right to left ends on frame 3');
    G.time += 0.2; p = run('after turn'); if (p.name !== 'idle') bad('after the turn: ' + p.name);
    b.face = 1; G.time += 0.01; p = run('turn l>r'); if (p.name !== 'turn' || p.frame !== 3 || p.face !== -1) bad('turn left to right starts on frame 3, mirrored: ' + JSON.stringify(p));
    G.time += 2;
    // 4. every attack: tell, strike, recovery over the real timers
    const spans = { charge: [8, 3, 2, 3], leap: [6, 3, 1, 2], spit: [4, 2, 1, 1] };           // frames, wind, strike, recover
    for (const id in spans) {
      const a = G.attackDef('tollkeeper', id), [n, w, s, r] = spans[id], seen = [];
      for (const [phase, state, t0, fr] of [['wind', a.tell, 0.75, [0, 0.2, 0.5, 0.7, 0.99]], ['strike', a.strike[0], 9, [0, 0.0001]], ['recover', 'recover', 1, [0, 0.3, 0.6, 0.99]]]) {
        for (const f of fr) {
          at(state, t0, f); b.attack = id; if (phase === 'strike') b.sAge = f === 0 ? 0 : (a.strikeT || 0.3) * 0.99;
          if (b.phase() !== phase) { bad(id + ' ' + state + ': phase ' + b.phase()); continue; }
          const q = run(id + ' ' + phase + ' ' + f); if (!q) continue;
          if (q.name !== id) bad(id + ' ' + phase + ' shows the ' + q.name + ' strip'); seen.push(phase[0] + Math.floor(q.frame));
        }
      }
      const fs = seen.map(x => +x.slice(1)), ph = seen.map(x => x[0]);
      for (let i = 1; i < fs.length; i++) if (fs[i] < fs[i - 1] && ph[i] === ph[i - 1]) bad(id + ': frames go backwards inside a phase: ' + seen.join(' '));
      const wf = fs.filter((f, i) => ph[i] === 'w'), rf = fs.filter((f, i) => ph[i] === 'r'), sf = fs.filter((f, i) => ph[i] === 's');
      if (Math.max(...wf) !== w - 1 || Math.min(...wf) !== 0) bad(id + ': wind-up frames ' + wf.join(',') + ' should span 0 to ' + (w - 1));
      if (Math.min(...sf) !== w || Math.max(...sf) !== w + s - 1) bad(id + ': strike frames ' + sf.join(',') + ' should span ' + w + ' to ' + (w + s - 1));
      if (Math.max(...rf) !== n - 1 || Math.min(...rf) < w + s) bad(id + ': recovery frames ' + rf.join(',') + ' should end on ' + (n - 1));
      out.notes.push(id + ' ' + seen.join(' '));
    }
    // a hit during a wind-up or a strike never swaps in the hurt art
    at('chargeTell', 0.75, 0.5); b.attack = 'charge'; b.hurtAt = G.time - 0.05; b.hurtHeavy = true; if (run('hurt in wind-up').name !== 'charge') bad('hurt art replaced a wind-up');
    // the wind-up of the code-drawn... a tell whose sheet is missing is code-drawn, not idle art
    // 5. defeat
    for (const age of [0, 0.4, 0.99, 1.1]) { at('dead', 0, 0); b.t = -age; const q = run('defeat ' + age); if (q.name !== 'defeat') bad('dead is not the defeat strip'); if (age === 0 && q.frame !== 0) bad('defeat starts on frame 0'); if (age >= 0.99 && q.frame !== 5) bad('defeat ends on frame 5, got ' + q.frame); }
    // 6. drawing, badges, shots
    G.time += 50; at('idle', 1, 0.2); b.x = 500; b.y = b.floor; b.face = 1;
    let painted = 0; const orig = b.paintSpot; b.paintSpot = function (c, sp) { painted++; return orig.call(this, c, sp); };
    b.draw(ctx); b.paintSpot = orig;
    if (!/^idle:/.test(b.skinNote || '')) bad('draw did not use the skin: ' + b.skinNote);
    if (painted !== b.spots.length) bad('badges drawn ' + painted + ' of ' + b.spots.length);
    const rec = []; const oc = ctx.translate.bind(ctx); ctx.translate = (x, y) => { rec.push([x, y]); return oc(x, y); };
    b.draw(ctx); ctx.translate = oc; for (const sp of b.spots) { const q = b.spotPos(sp); if (!rec.some(([x, y]) => Math.abs(x - q.x) < 1e-6 && Math.abs(y - q.y) < 1e-6)) bad('badge ' + sp.cls + ' not drawn at its anchor'); }
    const calls = []; const od = ctx.drawImage.bind(ctx); ctx.drawImage = (...a) => { calls.push(a); return od(...a); };
    if (!S.paintShot(b, 'wave', ctx, { x: 300, y: b.floor, vx: 400, age: 0.1, rect: { w: 26, h: 34 } }) || !calls.length) bad('the wave shot did not use the fx strip');
    if (S.paintShot(b, 'nope', ctx, { x: 0, y: 0, vx: 1, age: 0 })) bad('an unlisted shot kind was drawn from the fx strip');
    calls.length = 0; ctx.drawImage = od;
    // the shot path of the boss itself: a kind + paint is wrapped, and falls back to the paint when the skin is off
    let fell = 0; const sh = b.shoot({ x: 400, y: 300, vx: 1, life: 1, kind: 'wave', paint: () => { fell++; } }); G.debug.bossSkinFixture = false; sh.paint(ctx, sh); G.debug.bossSkinFixture = true; if (!fell) bad('with the skin off a shot must use its own paint'); G.shots.length = 0;
    // 7. fall back: a missing attack strip -> code art; no idle strip -> code art; flag off / art off -> no skin
    const keep = Object.assign({}, G.strips), key = n => 'boss_testboss_' + n;
    delete G.strips[key('spit')]; at('spitTell', 0.5, 0.3); b.attack = 'spit'; b.skinNote = ''; b.draw(ctx); if (b.skinNote) bad('a missing spit strip must fall back to the code-drawn boss'); if (S.pick(b, e) !== null) bad('pick must be null without the attack strip');
    Object.assign(G.strips, keep); at('chargeTell', 0.75, 0.3); b.attack = 'charge'; b.skinNote = ''; b.draw(ctx); if (!b.skinNote) bad('with every strip back the charge shows the skin');
    delete G.strips[key('idle')]; b.skinNote = ''; b.draw(ctx); if (b.skinNote) bad('no idle strip must mean no skin at all'); if (S.entryOf(b)) bad('entryOf must be null without the idle strip'); Object.assign(G.strips, keep);
    delete G.strips[key('hurt')]; at('idle', 1, 0.2); b.hurtAt = G.time - 0.05; if (run('no hurt strip').name !== 'idle') bad('without a hurt strip the idle shows');
    delete G.strips[key('enraged')]; delete G.strips[key('turn')]; b.hp = b.maxHp * 0.3; if (run('no enraged strip').name !== 'idle') bad('without an enraged strip the idle shows'); b.hp = b.maxHp; Object.assign(G.strips, keep);
    G.debug.bossSkinFixture = false; if (S.entryOf(b)) bad('the fixture is on without its flag'); b.skinNote = ''; b.draw(ctx); if (b.skinNote) bad('the skin drew with the flag off');
    G.debug.bossSkinFixture = true; G.artTest = false; if (!S.entryOf(b)) bad('the fixture should not depend on F2'); G.artTest = true; G.debug.bossSkinFixture = false;
    // 8. the real table: every entry names a real boss, real attacks and sheets it lists
    for (const id in G.bossSkins) {
      const k = G.bossSkins[id]; if (!G.bossDefs[id]) bad('skin for unknown boss ' + id);
      for (const a in k.attacks || {}) { if (!G.attackDefs[id] || !G.attackDefs[id][a]) bad(id + ': skin maps unknown attack ' + a); const sh = k.attacks[a].sheet || k.attacks[a]; if (!k.strips[sh]) bad(id + ': attack ' + a + ' maps to the missing sheet ' + sh); }
      for (const a in G.attackDefs[id] || {}) if (!k.strips[(k.attacks && (k.attacks[a].sheet || k.attacks[a])) || a]) out.notes.push(id + '.' + a + ' has no sheet (code-drawn)');
      for (const kind in k.fx || {}) if (!k.strips.fx) bad(id + ': fx kinds listed but no fx strip');
    }
    out.notes.push(Object.keys(G.bossSkins).length + ' real skins');
    return out;
  });
  if (res.fail.length) throw new Error(res.fail.slice(0, 10).join(' | ') + (res.fail.length > 10 ? ' (+' + (res.fail.length - 10) + ' more)' : ''));
  // a picture: the skinned Tollkeeper idle, winding up a charge, striking, staggered
  await page.evaluate(() => { const D = G.debug; D.newRun(5); D.god(true); D.startBoss('r1'); D.bossSkinFixture = true; });
  await page.waitForFunction(() => { G.bossSkin.entryOf(G.rooms.current.boss); return !G.spritesPending; });
  const frames = [['idle', 'idle'], ['chargeTell', 'charge'], ['charge', 'charge'], ['stagger', null]];
  for (let i = 0; i < frames.length; i++) {
    await page.evaluate(([[state, atk], i]) => {
      const b = G.rooms.current.boss; b.x = 560; b.face = -1; G.players[0].place(300, b.floor, 1);
      b.held = { x: 560, y: b.floor, face: -1 }; b.set(state, state === 'idle' ? 1 : 9); b.attack = atk; b.sAge = 0.1; b.t0 = state === 'chargeTell' ? 0.75 : 9; b.t = state === 'chargeTell' ? 0.2 : 9; b.hurtAt = -9;
      G.debug.step(2); G.cam.follow(0, 480, 300, true);
    }, [frames[i], i]);
    if (i === 1 || i === 3) await page.screenshot({ path: path.join(shots, 'boss_skin_' + frames[i][0] + '.png'), clip: { x: 0, y: 0, width: 1040, height: 760 } });
  }
  await page.evaluate(() => { G.rooms.current.boss.held = null; G.debug.bossSkinFixture = false; });
  return res.notes.join('; ');
};
