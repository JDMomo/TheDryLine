// A whole run through the real room graph, for 5 seeds. The page plays it with G.debug helpers and god mode:
// enter each region from the hub through its gate, pass through every main room by its exits (the player runs off the edge, as in
// play), enter every doorway once and come back, take the signal post in each trial room, reach each arena, wake and beat the Warden,
// check its rewards, take the way back to the hub, and finish with the Terminus.
// Asserts: no page error (smoke does), every room entered draws one frame without error, each Warden grants a pip, 40 scrip, the
// three trinket plinths and the way back, the Long Clock's health never depends on the Wardens beaten and it borrows one attack per Warden still alive, every fight is graded, the run ends on the
// win screen with its stats filled in; and the same seed builds the same graph twice.
function playSeed(seed) {
  const D = G.debug, T = G.C.T, notes = [], fails = [], fail = m => fails.push('seed ' + seed + ': ' + m);
  const ctx = document.getElementById('game').getContext('2d');
  const sig = () => JSON.stringify(Object.values(G.run.graph.nodes).map(n => [n.id, n.def, n.region, n.parent, n.exits, n.content, n.extras]));
  const seen = new Set(), room = () => G.rooms.current;
  const draw = () => { try { G.rooms.draw(ctx, 0); G.hud.draw(ctx); } catch (e) { fail('drawing ' + room().id + ' (' + room().def.id + ') threw ' + e.message); } };
  const settle = () => { for (let i = 0; i < 300 && G.rooms.trans; i++) D.step(1); D.step(3); };
  const landed = id => { if (room().id !== id) { fail('expected to be in ' + id + ' but in ' + room().id); return false; } seen.add(id); draw(); return true; };
  const props = type => room().props.filter(p => p.type === type && !p.gone);
  const use = pr => { D.place(0, pr.x, pr.y, 1); D.step(3); D.setInput(0, { interact: true }); D.step(2); D.setInput(0, { interact: false }); D.step(1); settle(); };
  const floorRow = (c, from) => { for (let r = from; r < G.tiles.rows; r++) if (G.tiles.floorAt(c, r)) return r; return G.tiles.rows - 2; };

  D.newRun(seed); D.god(true);
  const a = sig(); D.newRun(seed);
  if (a !== sig()) fail('the same seed built two different graphs');
  const g = G.run.graph, order = Object.values(G.regionDefs).sort((x, y) => x.gate - y.gate);
  const regionNodes = new Set();
  let kills0 = 0;
  landed(g.hub);

  for (const reg of order) {
    const rg = g.regions[reg.id], pips0 = G.players[0].maxHp, scrip0 = G.run.shards;
    // hub gate
    const gate = props('gate').find(p => p.data.region === reg.id);
    if (!gate) { fail('no gate for ' + reg.id + ' in the hub'); continue; }
    use(gate);
    // the gate takes the route's mouth: the first room, or a home-area connector room (kind main, region hub) leading to it
    const mouth = rg.mouth ? rg.mouth.node : rg.first;
    if (!landed(mouth)) continue;
    // main rooms (and any connector), then the arena
    let id = mouth, guard = 0;
    while (id && guard++ < 12) {
      const node = g.nodes[id], kind = G.roomDefs[node.def].kind;
      if (!landed(id)) break;
      if (kind !== 'arena') {
        const e = room().enemies[0];
        if (e) { e.damage(99999, e.x - 10); D.step(2); kills0++; }
        for (const door of props('door')) {                                    // each doorway once, and back
          use(door);
          if (!landed(door.data.to)) break;
          const bk = G.roomDefs[g.nodes[door.data.to].def].kind;
          const post = props('post')[0];
          if (post) { D.place(0, post.x, post.y, 1); D.step(4); if (!G.run.abil[post.data.abil]) fail('the signal post of ' + reg.id + ' gave no ability'); }
          if (bk === 'trial' && !post) fail('trial room of ' + reg.id + ' has no signal post');
          const back = props('door')[0];
          if (!back) { fail('no way back in ' + door.data.to); break; }
          use(back);
          if (!landed(id)) break;
        }
        // leave through the room's declared forward edge, as a player does
        const def = G.roomDefs[node.def], side = (def.route || ['left', 'right'])[1], want = node.exits[side].to, p = G.players[0], port = def.ports[side], W = room().cols * T, H = room().rows * T;
        if (side === 'right') { const r = floorRow(room().cols - 2, room().rows - G.C.CH + 12); D.place(0, W - 8, r * T, 1); p.vx = 420; p.onGround = false; }
        else if (side === 'left') { const r = floorRow(1, room().rows - G.C.CH + 12); D.place(0, 8, r * T, -1); p.vx = -420; p.onGround = false; }
        else if (side === 'top') { D.place(0, (port.c + 0.5) * T, p.h + 5, 1); p.vy = -520; p.onGround = false; }
        else { D.place(0, (port.c + 0.5) * T, H - 4, 1); p.vy = 520; p.onGround = false; }
        for (let i = 0; i < 90 && G.rooms.current.id === id && !G.rooms.trans; i++) D.step(1);
        settle();
        if (!landed(want)) break;
        id = want;
      } else break;
    }
    if (room().kind !== 'arena') { fail('did not reach the arena of ' + reg.id); continue; }
    // the Warden
    const r0 = room(), b0 = r0.boss;
    if (!b0) { fail('no boss in the arena of ' + reg.id); continue; }
    if (b0.id !== reg.boss) fail('arena of ' + reg.id + ' holds ' + b0.id + ', wanted ' + reg.boss);
    D.place(0, (r0.def.doorCol + 3) * T, b0.floor, 1); D.step(6);
    if (!room().fight) { fail('the fight of ' + reg.id + ' did not start'); continue; }
    D.step(260);
    const b = room().boss, beatenBefore = ['r1', 'r2', 'r3', 'r4'].filter(k => G.run.beaten[k]).length;
    if (reg.id === 'final') {
      const want = G.bossDefs.long_clock.hp;
      if (Math.abs(b.maxHp - want) > 0.01) fail('the Long Clock has ' + b.maxHp + ' health after ' + beatenBefore + ' Wardens, wanted ' + want);
      if (b.borrowed.length !== 4 - beatenBefore) fail('the Long Clock borrows ' + b.borrowed.length + ' attacks after ' + beatenBefore + ' Wardens, wanted ' + (4 - beatenBefore));
      notes.push('clock ' + Math.round(b.maxHp) + ' hp, borrows ' + b.borrowed.length);
    }
    b.hp = Math.min(b.hp, 1);
    D.holdBoss({ x: Math.max(b.minX + 140, Math.min(b.maxX - 140, b.x)), y: b.floor, face: b.face });
    const offs = [-70, 70, -110, 110, -150, 150, -40, 40];
    for (let i = 0; i < 160 && b.state !== 'dead'; i++) {
      const o = offs[i % offs.length];
      D.place(0, b.x + o, b.floor, o > 0 ? -1 : 1); D.setInput(0, { attack: true }); D.step(2); D.setInput(0, { attack: false }); D.step(30);
    }
    D.holdBoss(null);
    if (b.state !== 'dead') { const pl = G.players[0]; fail('could not beat ' + b.id + ' (state ' + b.state + ', hp ' + b.hp + ', player ' + Math.round(pl.x) + ',' + Math.round(pl.y) + ' down ' + pl.down + ', boss ' + Math.round(b.x) + ',' + Math.round(b.y) + ')'); break; }
    D.step(30);
    if (!G.run.beaten[reg.id]) fail(reg.id + ' not marked beaten');
    if (reg.id === 'final') {
      D.step(260);
      if (G.run.over !== 'win') fail('beating the Long Clock did not win the run (over = ' + G.run.over + ')');
      if (G.state !== 'over') fail('the run did not reach the win screen (state ' + G.state + ')');
      try { G.menus.over(ctx); } catch (e) { fail('the win screen threw ' + e.message); }
      const s = G.run.stats;
      if (!(G.run.time > 0) || !(s.kills > 0) || !(G.run.shards > 0)) fail('stats not filled in: ' + JSON.stringify({ time: G.run.time, shards: G.run.shards, stats: s }));
      for (const k of ['hits', 'breaks', 'kills']) if (typeof s[k] !== 'number') fail('stat ' + k + ' is not a number');
      notes.push('won in ' + Math.round(G.run.time) + ' s, kills ' + s.kills);
      break;
    }
    // rewards
    const r1 = room(), trin = r1.props.filter(p => p.type === 'plinth' && p.data.trinket && !p.gone), back = r1.props.find(p => p.type === 'door' && p.data.to === g.hub);
    if (!G.run.grades[reg.id] || G.game.gradeText(G.run.grades[reg.id]).indexOf('Beaten') !== 0) fail(reg.id + ' fight was not graded');
    const rule = G.run.rule || {};
    if (G.players[0].maxHp !== pips0 + (rule.wardenPips || 1)) fail(reg.id + ' Warden gave ' + (G.players[0].maxHp - pips0) + ' health pips');
    if (G.run.shards < scrip0 + 40 * (rule.scrip || 1)) fail(reg.id + ' Warden gave ' + (G.run.shards - scrip0) + ' scrip');
    if (trin.length !== 3) fail(reg.id + ' Warden left ' + trin.length + ' trinket plinths');
    if (!back) { fail(reg.id + ' Warden left no way back to the Junction'); break; }
    const nt = G.run.trinkets.length;
    if (trin.length) { use(trin[1] || trin[0]); if (G.run.trinkets.length !== nt + 1) fail(reg.id + ' trinket could not be taken'); }
    use(back);
    if (!landed(g.hub)) break;
  }
  for (const reg of order) for (const n of g.regions[reg.id].nodes) if (!seen.has(n)) fail('room ' + n + ' (' + g.nodes[n].def + ') of ' + reg.id + ' was never entered');
  return { seed, fails, notes: notes.join(', '), rooms: seen.size };
}

export default async ({ page }) => {
  const out = [];
  for (const seed of [1, 2, 3, 4, 5]) out.push(await page.evaluate(playSeed, seed));
  // the Long Clock's health does not follow the Wardens beaten (none, one, two): what it borrows does
  const hp = await page.evaluate(() => {
    const D = G.debug, o = [];
    for (const beaten of [[], ['r1'], ['r1', 'r3']]) {
      D.newRun(7); D.god(true); for (const k of beaten) G.run.beaten[k] = true;
      D.startBoss('final'); o.push([beaten.length, G.rooms.current.boss.maxHp, G.bossDefs.long_clock.hp, G.rooms.current.boss.borrowed.length]);
    }
    return o;
  });
  for (const [n, max, base, bor] of hp) if (Math.abs(max - base) > 0.01 || bor !== 4 - n) out.push({ fails: ['Long Clock with ' + n + ' Wardens beaten has ' + max + ' health (base ' + base + ') and borrows ' + bor] });
  const bad = out.flatMap(o => o.fails);
  if (bad.length) throw new Error(bad.slice(0, 6).join(' | ') + (bad.length > 6 ? ' (+' + (bad.length - 6) + ' more)' : ''));
  return '5 seeds, ' + out.map(o => o.rooms).join('/') + ' rooms entered; ' + out[0].notes;
};
