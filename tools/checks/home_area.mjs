// The home area (the Junction): size, every route out, the loop-back shortcuts, the freight gates and co-op join.
// - size: at least 4 screens wide and 3 storeys tall; its five routes leave by at least three different edges and at least three heights
// - routes (10 seeds): each region's portal leads (through its connector, if any) to that region's first room, and the way back leads home
//   to the same portal; physically: leaving through each opening (walking off a side, jumping out of the roof hatch, Down + Jump on the
//   grating) arrives in the right room, and the connectors are walked through to the region (run and jump only: the rooms check proves the
//   start -> portal halves)
// - loop-back shortcuts: the home hatch is bolted at first; its far end stands in the region's last main room, reachable from that room's
//   entrance with run and jump only; unbolting it lands the party at the home hatch, and the home hatch then leads back to the far end
// - freight gates: shut until their Warden falls, then open
// - co-op: a player joins in the Junction next to player 1, both act, nothing throws
import { pageTraverse } from './rooms.mjs';

export default async ({ page }) => {
  const bad = [], note = {};
  const r1 = await page.evaluate(() => {
    const D = G.debug, T = G.C.T, out = { bad: [], seeds: 0 }, def = G.roomDefs.junction;
    if (!def) return { bad: ['no junction room'] };
    if (def.w < 4 || def.h < 3) out.bad.push('home area is ' + def.w + 'x' + def.h + ' screens, wanted at least 4x3');
    const ports = def.portals || [];
    const ids = ports.map(p => p.id).sort().join();
    if (ids !== ['final', 'r1', 'r2', 'r3', 'r4'].sort().join()) out.bad.push('portals ' + ids + ', wanted one per region and the Terminus');
    const edges = new Set(ports.map(p => p.side)), heights = new Set(ports.filter(p => p.side === 'left' || p.side === 'right').map(p => Math.floor(p.from / 17)).concat(ports.filter(p => p.side === 'top').map(() => -1)).concat(ports.filter(p => p.side === 'bottom').map(() => 9)));
    if (edges.size < 3) out.bad.push('routes leave by only ' + edges.size + ' edges');
    if (heights.size < 3) out.bad.push('routes leave at only ' + heights.size + ' heights');
    for (let seed = 1; seed <= 10; seed++) {
      D.newRun(seed); out.seeds++;
      const g = G.run.graph, hub = g.nodes[g.hub], fail = m => out.bad.push('seed ' + seed + ': ' + m);
      const ch = G.worldgen.check(g);
      if (ch.unreachable.length || ch.deadEnds.length) fail('graph unreachable ' + ch.unreachable + ' dead ends ' + ch.deadEnds);
      if (g.warnings.length) fail('warnings ' + g.warnings.join('; '));
      for (const p of ports) {
        const q = (hub.portals || []).find(x => x.id === p.id), rg = g.regions[p.id];
        if (!q || !rg) { fail('portal ' + p.id + ' is not linked'); continue; }
        const first = g.nodes[rg.first], fdef = G.roomDefs[first.def], fin = (fdef.route || ['left', 'right'])[0];
        if (p.via) {
          const k = g.nodes[q.dest], kd = G.roomDefs[k.def];
          if (k.def !== p.via || k.region !== 'hub') { fail(p.id + ' portal leads to ' + k.def + ', wanted connector ' + p.via); continue; }
          const [a, b] = kd.route;
          if (!k.exits[a] || k.exits[a].to !== g.hub || k.exits[a].entry.portal !== p.id) fail(p.via + ' does not lead home to portal ' + p.id);
          if (!k.exits[b] || k.exits[b].to !== rg.first) fail(p.via + ' does not lead on to ' + first.def);
          if (!first.exits[fin] || first.exits[fin].to !== k.id) fail(first.def + ' does not lead back to ' + p.via);
        } else {
          if (q.dest !== rg.first) fail(p.id + ' portal leads to ' + g.nodes[q.dest].def + ', wanted ' + first.def);
          if (!first.exits[fin] || first.exits[fin].to !== g.hub || first.exits[fin].entry.portal !== p.id) fail(first.def + ' does not lead back to portal ' + p.id);
        }
        const gate = hub.content.find(c => c && c.type === 'gate' && c.data.region === p.id);
        if (!gate) fail('no gate for ' + p.id);
      }
      for (const s of def.shortcuts || []) if (!g.shortcuts[s.region]) fail('no far end for the ' + s.region + ' loop-back hatch');
    }
    return out;
  });
  bad.push(...r1.bad);

  // physically leave by every opening, and walk each connector through to its region
  const r2 = await page.evaluate(() => {
    const D = G.debug, T = G.C.T, bad = [], g0 = () => G.run.graph;
    const settle = () => { for (let i = 0; i < 300 && G.rooms.trans; i++) D.step(1); D.step(2); };
    const out = [];
    D.newRun(3); D.god(true);
    for (const p of G.roomDefs.junction.portals) {
      const g = g0(); G.rooms.enter(g.hub, { start: true }); D.step(2);
      const q = g.nodes[g.hub].portals.find(x => x.id === p.id), pl = G.players[0], W = G.tiles.cols * T;
      if (p.side === 'right') { let r = p.from; while (!G.tiles.floorAt(G.tiles.cols - 2, r)) r++; D.place(0, W - 30, r * T, 1); D.setInput(0, { right: true }); }
      else if (p.side === 'top') { D.place(0, ((p.from + p.to) / 2 + .5) * T, 4 * T, 1); D.setInput(0, { jump: true }); }
      else { D.place(0, ((p.from + p.to) / 2 + .5) * T, 47 * T, 1); D.step(2); D.setInput(0, { down: true, jump: true }); }
      for (let i = 0; i < 120 && G.rooms.current.id === g.hub && !G.rooms.trans; i++) D.step(1);
      D.setInput(0, { right: false, jump: false, down: false }); settle();
      out.push([p.id, G.rooms.current.id === q.dest, G.rooms.current.def.id]);
      if (G.rooms.current.id !== q.dest) bad.push('leaving by the ' + p.id + ' opening arrived in ' + G.rooms.current.def.id + ', wanted ' + g.nodes[q.dest].def);
    }
    return { bad, out };
  });
  bad.push(...r2.bad); note.exits = r2.out.length;

  // walk each connector through (entered from the home side) to its region's first room, as the walk check does for main rooms
  const conns = await page.evaluate(() => { G.debug.newRun(3); const g = G.run.graph; return G.roomDefs.junction.portals.filter(p => p.via).map(p => ({ id: p.id, node: g.regions[p.id].mouth.node, def: p.via, first: g.regions[p.id].first })); });
  for (const c of conns) {
    await page.evaluate(id => { const n = G.run.graph.nodes[id]; n.savedExits = n.exits; n.exits = {}; }, c.node);
    const route = await page.evaluate(d => G.roomDefs[d].route, c.def);
    const jobs = await page.evaluate(pageTraverse, { id: c.def, nodeId: c.node, abil: [], budget: 400000, strict: true, only: route[0] + ' to ' + route[1] });
    await page.evaluate(id => { const n = G.run.graph.nodes[id]; n.exits = n.savedExits; delete n.savedExits; }, c.node);
    if (!jobs.length || !jobs.every(j => j.ok)) { bad.push(c.def + ': ' + jobs.map(j => j.msg).join('; ')); continue; }
    const arrived = await page.evaluate(side => {
      const D = G.debug, p = G.players[0], T = G.C.T;
      D.setInput(0, { right: side === 'right', left: side === 'left' }); for (let i = 0; i < 150 && !G.rooms.trans; i++) D.step(1);
      D.setInput(0, { right: false, left: false }); for (let i = 0; i < 300 && G.rooms.trans; i++) D.step(1);
      return G.rooms.current.id;
    }, route[1]);
    if (arrived !== c.first) bad.push(c.def + ': walking on arrived in ' + arrived + ', wanted the first room of ' + c.id);
  }

  // loop-back shortcuts: the far end is reachable on foot, unbolting it, both directions
  const sc = await page.evaluate(() => { G.debug.newRun(5); const g = G.run.graph; return Object.entries(g.shortcuts).map(([region, s]) => ({ region, deep: s.deep, def: g.nodes[s.deep].def, x: s.x, y: s.y, entry: (G.roomDefs[g.nodes[s.deep].def].route || ['left'])[0] })); });
  if (sc.length !== 4) bad.push(sc.length + ' loop-back shortcuts, wanted 4');
  for (const s of sc) {
    await page.evaluate(id => { const n = G.run.graph.nodes[id]; n.savedExits = n.exits; n.exits = {}; }, s.deep);
    const jobs = await page.evaluate(pageTraverse, { id: s.def, nodeId: s.deep, abil: [], budget: 400000, strict: true, entry: { side: s.entry }, point: { x: s.x, y: s.y } });
    await page.evaluate(id => { const n = G.run.graph.nodes[id]; n.exits = n.savedExits; delete n.savedExits; }, s.deep);
    if (!jobs.length || !jobs[0].ok) bad.push(s.region + ' hatch in ' + s.def + ' is not reachable from its entrance: ' + (jobs[0] ? jobs[0].msg : 'no job'));
  }
  const r3 = await page.evaluate(() => {
    const D = G.debug, bad = [], g = G.run.graph, settle = () => { for (let i = 0; i < 300 && G.rooms.trans; i++) D.step(1); D.step(2); };
    D.god(true);
    for (const [region, s] of Object.entries(g.shortcuts)) {
      G.rooms.enter(g.hub, { start: true }); D.step(1);
      const home = G.rooms.current.props.find(p => p.type === 'shortcut' && p.data.region === region);
      if (!home) { bad.push('no home hatch for ' + region); continue; }
      if (!home.prompt(G.players[0])) bad.push(region + ' home hatch has no prompt');
      home.interact(G.players[0]); settle();
      if (G.rooms.current.id !== g.hub) bad.push(region + ' home hatch opened before it was unbolted');
      G.rooms.enter(s.deep, { side: (G.roomDefs[g.nodes[s.deep].def].route || ['left'])[0] }); D.step(1);
      const far = G.rooms.current.props.find(p => p.type === 'shortcut' && p.data.region === region);
      if (!far) { bad.push('no far hatch for ' + region + ' in ' + G.rooms.current.def.id); continue; }
      D.place(0, far.x, far.y, 1); D.step(2);
      if (G.rooms.propNear(G.players[0]) !== far) bad.push(region + ' far hatch cannot be used where it stands');
      far.interact(G.players[0]); settle();
      if (G.rooms.current.id !== g.hub || !(G.run.shortcuts && G.run.shortcuts[region])) { bad.push(region + ' far hatch did not unbolt and lead home'); continue; }
      const p = G.players[0];
      if (Math.abs(p.x - home.x) > 40 || Math.abs(p.y - home.y) > 4) bad.push(region + ' shortcut landed at ' + Math.round(p.x) + ',' + Math.round(p.y) + ', not at its home hatch');
      if (!p.onGround) { D.step(10); if (!p.onGround) bad.push(region + ' shortcut landing is not on a floor'); }
      home.interact(p); settle();
      if (G.rooms.current.id !== s.deep) bad.push(region + ' home hatch did not lead back once unbolted');
    }
    return { bad };
  });
  bad.push(...r3.bad);

  // freight gates follow the Wardens; co-op join in the Junction
  const r4 = await page.evaluate(() => {
    const D = G.debug, bad = [], ch = G.roomDefs.junction.channels || {};
    D.newRun(9); D.god(true); D.step(2);
    const gates = () => G.rooms.current.props.filter(p => p.type === 'mech_gate' && /^beaten:/.test(p.data.channel));
    if (gates().length !== Object.values(ch).filter(c => /^beaten:/.test(c)).length || gates().length < 4) bad.push(gates().length + ' freight gates in the live Junction');
    for (const gt of gates()) if (gt.data.open || !gt.bl || !gt.bl.on) bad.push(gt.data.channel + ' freight gate is open before its Warden falls');
    for (const r of ['r1', 'r2', 'r3', 'r4']) G.run.beaten[r] = true;
    D.step(2);
    for (const gt of gates()) if (!gt.data.open || gt.bl.on) bad.push(gt.data.channel + ' freight gate stayed shut after its Warden fell');
    // co-op: a second player joins here, next to player 1, and both can move
    D.newRun(9); D.step(2);
    const n0 = G.players.length;
    if (!D.addPlayer()) bad.push('could not join a player in the Junction');
    const [a, b] = G.players;
    if (G.players.length !== n0 + 1 || Math.hypot(a.x - b.x, a.y - b.y) > 64) bad.push('joined player is not next to player 1');
    D.setInput(1, { right: true }); D.step(60); D.setInput(1, { right: false });
    if (b.x <= a.x + 20) bad.push('joined player could not move in the Junction');
    if (G.rooms.current.id !== G.run.graph.hub) bad.push('join left the Junction');
    while (G.players.length > n0) G.game.removePlayer(G.players[G.players.length - 1]);
    return { bad, errors: G.errors.slice() };
  });
  bad.push(...r4.bad, ...r4.errors);
  if (bad.length) throw new Error(bad.length + ' problems: ' + bad.slice(0, 8).join(' | '));
  return r1.seeds + ' seeds: 5 routes by ' + 'portal (3 edges), ' + note.exits + ' openings left physically, ' + conns.length + ' connectors walked, ' + sc.length + ' loop-back shortcuts both ways, freight gates and co-op join';
};
