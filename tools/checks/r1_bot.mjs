// The first region is a gentle introduction. (1) Structure: its first main room on any seed has at most 2 enemies and no turnstile or brine
// spout within 8 tiles of the entrance; r1 enemies are scaled down per region (health, tempo) without touching their definitions; a kill
// puts a little into the mend gauge; the Wardens do not attack in the first 1.5 s after their intro.
// (2) A plain bot (walks right, jumps at walls and gaps, slashes what is ahead of it, mends when it can; no dash, no tokens, no dodging)
// should usually cross r1's three main rooms alive.
const SEEDS = 12, NEED = 9;     // at least 9 of 12 seeds
export default async ({ page }) => {
  const st = await page.evaluate(() => {
    const D = G.debug, bad = [];
    // structure, on 60 seeds
    let firstRooms = 0;
    for (let seed = 1; seed <= 60; seed++) {
      D.newRun(seed);
      const g = G.run.graph, node = g.nodes[g.regions.r1.first], def = G.roomDefs[node.def];
      const en = [];
      def.marks.forEach((m, i) => { const c = node.content[i]; if (c && c.type === 'enemy') en.push({ id: c.id, col: m.c }); });
      firstRooms++;
      if (en.length > 2) bad.push('seed ' + seed + ': first r1 room ' + node.def + ' has ' + en.length + ' enemies');
      for (const e of en) if (['turnstile', 'brine_spout'].includes(e.id) && e.col - 1 <= 8) bad.push('seed ' + seed + ': a ' + e.id + ' ' + (e.col - 1) + ' tiles from the entrance in ' + node.def);
      // later rooms keep their usual numbers (2 to 3 in r1)
      for (const id of g.regions.r1.nodes) { const n = g.nodes[id], d = G.roomDefs[n.def]; if (d.kind !== 'main' || id === g.regions.r1.first) continue; const k = n.content.filter(c => c && c.type === 'enemy').length; if (k > 3) bad.push('seed ' + seed + ': ' + n.def + ' has ' + k + ' enemies'); }
    }
    // scaling: r1 enemies have less health and a slower tempo than the same enemy elsewhere; the definitions are untouched
    D.newRun(2);
    const mk = (id, region) => { const n = Object.values(G.run.graph.nodes).find(n => n.region === region && G.roomDefs[n.def].kind === 'main'); D.gotoRoom(n.id); const e = new G.Enemy(G.enemyDefs[id], 100, 100); e.applyScale((G.regionDefs[region] || {}).scale); return e; };
    const a = mk('ballast_crab', 'r1'), b = mk('ballast_crab', 'r3');
    if (!(a.hp < b.hp && a.hp >= b.hp * 0.7)) bad.push('r1 crab health ' + a.hp + ' vs ' + b.hp + ' elsewhere');
    if (!(a.aggro < 1 && a.aggro >= 0.75 && b.aggro === 1)) bad.push('r1 aggression ' + a.aggro + ', elsewhere ' + b.aggro);
    if (G.enemyDefs.ballast_crab.hp !== 26) bad.push('the crab definition was edited (hp ' + G.enemyDefs.ballast_crab.hp + ')');
    // the tempo: a turnstile-free test, a spout takes longer to wind up and fire in r1
    const tempo = id => { D.gotoRoom('r1_ribs'); const e = new G.Enemy(G.enemyDefs[id], 100, 100); e.applyScale(G.regionDefs.r1.scale); const t0 = e.t; e.t = 1; e.update(0.1); return +(1 - e.t).toFixed(3); };
    if (!(tempo('brine_spout') < 0.1)) bad.push('timers run at full speed in r1 (' + tempo('brine_spout') + ' s per 0.1 s)');
    // a kill rewards careful play with a little mend
    D.newRun(2); D.god(false); D.gotoRoom('r1_ribs'); const room = G.rooms.current; room.enemies.length = 0;
    const p = G.players[0]; p.glow = 0; D.place(0, 200, 480, 1);
    const e = new G.Enemy(G.enemyDefs.ballast_crab, 230, 480); e.harmless = true; room.enemies.push(e); e.damage(1000, p.x); D.step(2);
    if (!(p.glow >= 5 && p.glow < 33)) bad.push('a kill gave ' + p.glow + ' mend (wanted a little)');
    // Wardens: nothing happens for 1.5 s after the intro (no shots, no attack states), then they do attack
    const grace = {};
    for (const reg of ['r1', 'r2', 'r3', 'r4', 'final']) {
      D.newRun(3); D.god(true); D.startBoss(reg); const b = G.rooms.current.boss;
      let tIntro = null, t = 0, early = null, attacked = null;
      for (let i = 0; i < 120 * 12; i++) {
        D.step(1);
        if (b.state !== 'intro' && b.state !== 'sleep' && tIntro === null) tIntro = i;
        const quiet = b.state === 'intro' || b.state === 'idle';
        const since = tIntro === null ? 0 : (i - tIntro) / 120;
        if (tIntro !== null && since < 1.5 && (!quiet || G.shots.some(s => s.hostile))) early = early || (reg + ': ' + b.state + ' ' + since.toFixed(2) + ' s after the intro');
        if (since >= 1.5 && !quiet && attacked === null) attacked = since;
      }
      grace[reg] = attacked;
      if (early) bad.push('a Warden acted early: ' + early);
      if (attacked === null) bad.push(reg + ' never attacked');
    }
    return { bad, firstRooms, grace };
  });
  if (st.bad.length) throw new Error(st.bad.slice(0, 5).join(' | '));

  // 2. the plain bot
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = await page.evaluate(seed => {
      const D = G.debug, tap = (a, n = 2) => { D.setInput(0, { [a]: true }); D.step(n); D.setInput(0, { [a]: false }); };
      D.newRun(seed); D.god(false);
      const g = G.run.graph, chain = g.regions.r1.nodes.filter(id => G.roomDefs[g.nodes[id].def].kind === 'main');
      D.gotoRoom(g.regions.r1.first);
      const p = G.players[0]; let rooms = 0, last = G.rooms.current.id, steps = 0, hits0 = G.run.stats.hits, mended = 0, stuckAt = 0, lastX = p.x, why = '';
      const MAX = 120 * 120;
      while (steps < MAX) {
        const room = G.rooms.current, kind = room.kind;
        if (kind === 'arena') break;
        if (p.down) { why = 'died in ' + last + ' (room ' + (rooms + 1) + ')'; break; }
        if (room.id !== last) { rooms++; last = room.id; stuckAt = 0; }
        // one decision, then 6 engine steps
        const enemies = room.enemies.filter(e => !e.dead), pr = D.probe(0);
        const ahead = enemies.filter(e => (e.x - p.x) * p.face > -10 && Math.abs(e.x - p.x) < 84 && Math.abs(e.y - p.y) < 70 && !e.def.ceiling);
        const near = enemies.some(e => Math.abs(e.x - p.x) < 220 && Math.abs(e.y - p.y) < 160);
        const wantMend = p.hp < p.maxHp && p.glow >= 33 && p.onGround && !near;
        if (wantMend) { D.setInput(0, { right: false, heal: true, jump: false, attack: false }); D.step(6); mended++; continue; }
        D.setInput(0, { heal: false });
        const close = ahead.some(e => Math.abs(e.x - p.x) < 72);
        const jump = (p.onGround && (pr.wall || pr.gap || close)) || (!p.onGround && p.vy < 0 && p.jumping);   // hold the button through the rise
        D.setInput(0, { right: !ahead.length || true, left: false, jump });
        D.setInput(0, { attack: ahead.length > 0 && steps % 36 < 18 });
        D.step(6); steps += 6;
        if (Math.abs(p.x - lastX) < 3 && !ahead.length) { stuckAt += 6; if (stuckAt > 120 * 8) { why = 'stuck in ' + last + ' at ' + Math.round(p.x); break; } } else { stuckAt = 0; lastX = p.x; }
      }
      D.setInput(0, { right: false, jump: false, attack: false, heal: false });
      const arrived = G.rooms.current.kind === 'arena' && !p.down;
      return { seed, arrived, rooms, why: why || (arrived ? '' : 'time'), hits: G.run.stats.hits - hits0, hp: p.hp, maxHp: p.maxHp, mended, secs: Math.round(steps / 120) };
    }, seed);
    runs.push(r);
  }
  const ok = runs.filter(r => r.arrived).length;
  const note = runs.map(r => (r.arrived ? 'ok' : r.why) + ' h' + r.hits).join(', ');
  if (ok < NEED) throw new Error('the plain bot crossed r1 alive on ' + ok + ' of ' + SEEDS + ' seeds (need ' + NEED + '): ' + note);
  return 'plain bot crossed r1 on ' + ok + ' of ' + SEEDS + ' seeds (' + note + ')';
};
