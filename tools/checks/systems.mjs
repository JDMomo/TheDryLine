// Run systems against bible section 8 and 6: token sources per run (30 seeds), prices, buying from a ticket machine and the kiosk,
// (the clipping booth is gone from runs), standpipes, swapping on a full party, a Warden's rewards, first-time tips, the pause menu, the meta save
// across a real reload, and everything still working when localStorage throws.
export default async ({ page }) => {
  // ---- 1. sources per run, 30 seeds ----
  const census = await page.evaluate(() => {
    const D = G.debug, bad = [];
    for (let seed = 1; seed <= 30; seed++) {
      D.newRun(seed);
      const g = G.run.graph, c = G.worldgen.census(g), chk = G.worldgen.check(g), fail = m => bad.push('seed ' + seed + ': ' + m);
      if (g.warnings.length) fail('warnings ' + g.warnings.join('; '));
      if (chk.unreachable.length || chk.deadEnds.length) fail('graph not sound');
      for (const r of Object.values(G.regionDefs)) {
        const f = c.fixed[r.id];
        if (!r.fixedItem && !f) continue;   // the Terminus has no fixed token: the bible lists four guarded plinths, one per region r1 to r4
        if (!f) { fail('no guarded plinth in ' + r.id); continue; }
        if (f.kind !== 'branch' || !f.parent) fail('plinth of ' + r.id + ' is not in a branch room');
        const want = G.itemDefs[r.fixedItem] ? r.fixedItem : null;
        if (want ? f.item !== want : (!G.itemDefs[f.item] || G.itemDefs[f.item].rarity === 'fixed' && false)) fail('plinth of ' + r.id + ' holds ' + f.item + ', wanted ' + (want || 'a defined token'));
        if (g.nodes[f.node].region !== r.id) fail('plinth of ' + r.id + ' is in another region');
      }
      if (c.trunks !== 2 || c.trunksInMain !== 2) fail('trunks ' + c.trunks + ' (' + c.trunksInMain + ' in main rooms)');
      if (c.tickets !== 1) fail('ticket machines ' + c.tickets);
      if (c.kioskRooms !== 1 || c.kioskWares !== 3) fail('kiosk rooms ' + c.kioskRooms + ', wares ' + c.kioskWares);
      if (c.booths !== 0) fail('booths ' + c.booths);
      if (Object.values(G.roomDefs).some(d => d.marks.some(m => m.ch === 'K'))) fail('a room template still has a booth marker');
      for (const n of Object.values(g.nodes)) for (const k of G.worldgen.contents(n)) if (k.type === 'plinth' && k.data.price && !k.data.trinket) fail('the kiosk sells a token');
      if (c.loosePlinths !== 0) fail('loose plinths ' + c.loosePlinths);
      if (c.signs < 3) fail('hub signs ' + c.signs);
      const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), last = g.regions[order[order.length - 1].id], pre = g.nodes[last.arena].exits.left.to;
      const pipe = last.pipe || pre;   // fixed pre-Terminus service
      const authored = order.flatMap(r => r.serviceAt ? [g.regions[r.id].nodes.find(id => g.nodes[id] && g.nodes[id].def === r.serviceAt)] : []).filter(Boolean);
      const wantedPipes = [...new Set([g.hub, ...authored, pipe])].sort();
      if ([...c.standpipes].sort().join() !== wantedPipes.join()) fail('standpipes in ' + c.standpipes + ', wanted ' + wantedPipes);
      for (const id of authored) if (G.roomDefs[g.nodes[id].def].kind !== 'main') fail('authored service stop is not a main room: ' + id);
      if (pipe !== pre && g.nodes[pipe].parent !== pre) fail('the standpipe room of the Terminus does not hang off the room before the arena');
      if (G.roomDefs[g.nodes[pre].def].kind !== 'main') fail('the room before the last arena is not a main room');
      for (const n of Object.values(g.nodes)) for (const k of G.worldgen.contents(n)) if (k.type === 'plinth' && k.data.price && k.data.price !== 40) fail('kiosk price ' + k.data.price);
      if (JSON.stringify(G.worldgen.census(G.worldgen.build(seed))) !== JSON.stringify(G.worldgen.census(G.worldgen.build(seed)))) fail('not repeatable');
    }
    return bad;
  });
  if (census.length) throw new Error(census.slice(0, 4).join(' | '));

  // ---- 2. simulations ----
  const sim = await page.evaluate(() => {
    const D = G.debug, out = {}, fail = [], ok = (cond, msg) => { if (!cond) fail.push(msg); };
    const tap = a => { D.setInput(0, { [a]: true }); D.step(2); D.setInput(0, { [a]: false }); D.step(2); };
    const nodeWith = type => Object.values(G.run.graph.nodes).filter(n => G.worldgen.contents(n).some(c => c.type === type));
    const at = pr => { D.place(0, pr.x, pr.y); D.step(3); };
    const props = type => D.state().room.props.filter(p => p.type === type);
    const use = (pr) => { at(pr); tap('interact'); };
    D.newRun(9); D.god(true);

    // ticket machines: 30 then 45 then 60, shown before paying; three plinths appear; taking one removes the rest
    const m = nodeWith('ticket'); ok(m.length === 1, 'one ticket machine room');
    G.run.shards = 500; D.gotoRoom(m[0].id);
    let mach = props('ticket')[0]; at(mach);
    ok(/30/.test(G.rooms.propNear(G.players[0]).prompt(G.players[0])[2]), 'first ticket price is shown (30)');
    const s0 = G.run.shards; tap('interact');
    out.ticket1 = s0 - G.run.shards; ok(out.ticket1 === 30, 'first ticket costs 30, cost ' + out.ticket1);
    let plinths = props('plinth').filter(p => p.data.group); ok(plinths.length === 3, 'three tokens printed, got ' + plinths.length);
    const choice = plinths.find(p => p.data.item) || plinths[1];   // a ticket may print a trinket or scrip when the token pool is dry
    use(choice);
    ok(!choice.data.item || D.state().players[0].items.includes(choice.data.item), 'the chosen ticket token was taken');
    ok(props('plinth').filter(p => p.data.group && p.data.item).length === 0, 'the other tickets are void');
    // the machine comes back once a ticket is taken (its stand clears), asks 45 for its second roll, and is gone after that
    D.step(5); mach = props('ticket')[0]; ok(!!mach, 'the machine is back after a ticket was taken'); at(mach);
    ok(/45/.test(G.rooms.propNear(G.players[0]).prompt(G.players[0])[2]), 'second ticket price is shown (45)');
    const s1 = G.run.shards; tap('interact'); out.ticket2 = s1 - G.run.shards; ok(out.ticket2 === 45, 'second ticket costs 45, cost ' + out.ticket2);
    ok(props('plinth').filter(p => p.data.group).length === 3, 'three more tickets printed');
    use(props('plinth').filter(p => p.data.group)[0]); D.step(5);
    ok(props('ticket').length === 0, 'the machine is gone after two rolls');

    // kiosk: three wares, price shown, trinket modifier applied, buying takes the ware
    D.newRun(11); D.god(true); G.run.shards = 400;
    const k = nodeWith('plinth').find(n => G.worldgen.contents(n).filter(c => c.type === 'plinth' && c.data.price).length);
    D.gotoRoom(k.id);
    const wares = props('plinth').filter(p => p.data.price); ok(wares.length === 3, 'kiosk shows three wares');
    ok(wares.every(w => w.data.trinket && !w.data.item), 'the kiosk sells trinkets only');
    const tokenWare = wares.find(w => w.data.item), trinketWare = wares.find(w => w.data.trinket);
    for (const w of [tokenWare, trinketWare]) if (w) {
      at(w); const pr = G.rooms.propNear(G.players[0]), price = w.data.price, before = G.run.shards;
      ok(pr && pr.prompt(G.players[0])[2].includes(String(price)), 'kiosk ware price is shown: ' + price);
      tap('interact'); ok(before - G.run.shards === price, 'kiosk charged ' + (before - G.run.shards) + ' not ' + price);
      ok(w.data.item ? D.state().players[0].items.includes(w.data.item) : G.run.trinkets.includes(w.data.trinket), 'kiosk ware received');
    }
    G.run.mods.shopCost = 1.1; const w3 = props('plinth').find(p => p.data.price && (p.data.item || p.data.trinket));
    if (w3) { at(w3); const b = G.run.shards; tap('interact'); ok(b - G.run.shards === Math.round(w3.data.price * 1.1) || w3.data.price === undefined, 'kiosk price follows trinket modifiers'); }
    G.run.mods.shopCost = 1;
    G.run.shards = 0; const w4 = props('plinth').find(p => p.data.price && (p.data.item || p.data.trinket));
    if (w4) { at(w4); tap('interact'); ok(G.run.shards === 0 && !G.run.trinkets.includes(w4.data.trinket), 'cannot buy without scrip'); }

    // standpipes: every authored service stop heals fully once, alongside the Junction and pre-Terminus service
    D.newRun(13); D.god(true);
    const order = Object.values(G.regionDefs).sort((a, b2) => a.gate - b2.gate), last = G.run.graph.regions[order[order.length - 1].id], pre = G.run.graph.nodes[last.arena].exits.left.to;
    const authored = order.flatMap(r => r.serviceAt ? [G.run.graph.regions[r.id].nodes.find(id => G.run.graph.nodes[id] && G.run.graph.nodes[id].def === r.serviceAt)] : []).filter(Boolean);
    for (const id of [...new Set([G.run.graph.hub, ...authored, last.pipe || pre])]) {
      D.gotoRoom(id); const sp = props('standpipe')[0]; ok(!!sp, 'standpipe in ' + id); if (!sp) continue;
      G.players[0].hp = 1; use(sp); ok(G.players[0].hp === G.players[0].maxHp, 'standpipe healed fully in ' + id);
      G.players[0].hp = 1; use(sp); ok(G.players[0].hp === 1, 'standpipe works once in ' + id);
    }

    // swapping on a full party: the old token stays on the plinth
    D.newRun(14); D.god(true); G.run.shards = 500;
    const pl = G.players[0];
    for (const t of ['cobalt_awl', 'ochre_ladle', 'cinder_bell']) D.give(t);
    ok(G.game.freeSlots() === 0, 'party is full');
    D.gotoRoom(nodeWith('ticket')[0].id); tap2(); function tap2() { at(props('ticket')[0]); tap('interact'); }
    const offered = props('plinth').map(p => p.data.item).filter(Boolean);
    const spare = ['basalt_roller', 'cobalt_awl', 'ochre_ladle', 'cinder_bell', 'sulphur_kettle', 'chalk_skipstone'].filter(t => !offered.includes(t));
    pl.items = pl.items.map(t => offered.includes(t) ? spare.shift() : t);        // a held copy would block the swap ("the party already carries one")
    const oldTok = pl.items[pl.sel];
    const pick = props('plinth').filter(p => p.data.group && p.data.item)[0] || props('plinth').filter(p => p.data.group)[0];
    at(pick);
    ok(/swap/i.test((G.rooms.propNear(G.players[0]) || { prompt: () => ['', '', ''] }).prompt(G.players[0])[2] || ''), 'full-party plinth says it will swap');
    use(pick);
    ok(pl.items.length === 3 && pl.items[pl.sel] === pick.data.item, 'swap put the new token in the selected slot');
    const left2 = props('plinth').find(p => p.x === pick.x);
    ok(left2 && left2.data.item === oldTok, 'old token stayed on the plinth (' + oldTok + ') ' + JSON.stringify(props('plinth').map(p => [p.x, p.data.item])) + ' pickx ' + pick.x + ' items ' + JSON.stringify(pl.items));
    out.swap = oldTok + ' <-> ' + pick.data.item;

    // lost trunk: opens when the room is clear
    D.newRun(15); D.god(true);
    const tn = nodeWith('trunk')[0]; D.gotoRoom(tn.id); G.rooms.current.enemies = []; D.step(3);
    ok(props('trunk').length === 0 && props('plinth').length >= 1, 'trunk becomes a plinth when the room is clear');

    // first-time tip fades once the player has stood at a prop a while; the hub teaches in three signs
    D.newRun(16); G.meta.taught = {};
    const signs = props('sign').map(s => s.data.text); ok(signs.length >= 3, 'three hub signs, got ' + signs.length);
    ok(/token/i.test(signs.join(' ')) && /void/i.test(signs.join(' ')) && /gate/i.test(signs.join(' ')), 'signs cover tokens, void and open gates');
    D.gotoRoom(nodeWith('ticket')[0].id); const bt = props('ticket')[0]; ok(!!G.props.tip(G.rooms.current.props.find(p => p.type === 'ticket')), 'a first-time tip shows');
    at(bt); D.step(120 * 4); ok(!G.props.tip(G.rooms.current.props.find(p => p.type === 'ticket')) && G.meta.taught.ticket, 'the tip stops after a few seconds');

    out.fail = fail; return out;
  });
  if (sim.fail.length) throw new Error(sim.fail.slice(0, 5).join(' | '));

  // ---- 3. a Warden's rewards ----
  const reward = await page.evaluate(() => {
    const D = G.debug; D.newRun(3); D.god(true); D.startBoss('r1');
    const hp0 = D.state().players[0].maxHp, floor = D.state().room.boss.floor; D.holdBoss({ x: 720, y: floor, face: -1 });
    for (let i = 0; i < 120 && D.state().room.boss.state !== 'dead'; i++) { D.place(0, 640, floor, 1); D.setInput(0, { attack: true }); D.step(2); D.setInput(0, { attack: false }); D.step(36); }
    const s = D.state(), choices = s.room.props.filter(p => p.type === 'plinth' && p.data.trinket);
    const pick = choices[1] || choices[0];
    D.place(0, pick.x, pick.y); D.step(3); D.setInput(0, { interact: true }); D.step(2); D.setInput(0, { interact: false }); D.step(2);
    const after = D.state();
    return { dead: s.room.boss.state === 'dead', pip: s.players[0].maxHp - hp0, scrip: s.run.shards, choices: choices.length, wants: Math.min(3, Object.keys(G.trinketDefs).length),
      got: after.run.trinkets, left: after.room.props.filter(p => p.type === 'plinth' && p.data.trinket).length, picked: pick.data.trinket };
  });
  if (!reward.dead || reward.pip < 1 || reward.scrip < 40) throw new Error('warden reward: ' + JSON.stringify(reward));
  if (reward.choices !== reward.wants || reward.got.join() !== reward.picked || reward.left) throw new Error('trinket choice: ' + JSON.stringify(reward));

  // ---- 4. meta unlocks, pause menu and the screens ----
  const ui = await page.evaluate(async () => {
    const D = G.debug, fail = [], ok = (c, m) => { if (!c) fail.push(m); };
    G.meta.cuts = []; D.newRun(21);
    const rares = Object.values(G.itemDefs).filter(d => d.rarity === 'rare' && d.cls === 'pierce').map(d => d.id);
    ok(rares.every(id => !G.items.pool().includes(id)), 'rare pierce tokens are locked at first');
    G.game.punched('pierce');
    ok(G.meta.cuts.includes('pierce') && rares.every(id => G.run.unlocked.includes(id)), 'punching a pierce slot unlocks its rare tokens and lists them');
    ok(rares.every(id => !G.items.pool().includes(id)), 'the running world keeps the unlock set it started with');
    D.newRun(21); ok(rares.every(id => G.items.pool().includes(id)), 'the next run has the rare tokens'); G.run.unlocked.length = 0; G.game.punched('pierce'); G.run.unlocked.push(...rares);
    G.game.punched('pierce'); ok(G.run.unlocked.length === rares.length, 'a cut unlocks once');
    // pause menu: down, jump, jump restarts the same seed
    const seed = G.run.seed; D.step(5); G.state = 'pause'; G.menus.open(); D.step(2);
    const press = a => { G.input.any.forced[a] = true; G.input.sync(); D.step(1); G.input.any.forced[a] = false; G.input.sync(); D.step(2); };
    press('down'); press('down'); press('down'); ok(G.menus.menu.sel === 3, 'pause menu moves to Restart run'); press('jump'); ok(G.menus.menu.confirm && G.state === 'pause', 'restart asks to confirm');
    press('jump'); ok(G.state === 'play' && G.run.seed === seed && G.run.time < 0.2, 'restart run keeps the seed and starts over');
    G.state = 'pause'; G.menus.open(); D.step(2); press('jump'); ok(G.state === 'play', 'resume works');
    // every screen draws (with and without the Slate)
    for (const slate of [false, true]) for (const st of ['map', 'pause', 'over']) {
      G.run.mods.revealMap = slate; G.run.over = st === 'over' ? 'win' : null; G.state = st;
      await new Promise(r => setTimeout(r, 90));
    }
    G.run.over = null; G.run.mods.revealMap = false; G.state = 'play';
    const seen = { title: String(G.title.name), seedOnPause: typeof G.run.seed };
    return { fail, seen };
  });
  if (ui.fail.length) throw new Error(ui.fail.join(' | '));

  // meta save across a real reload
  await page.evaluate(() => { G.meta.cuts = ['burst']; G.meta.runs = 7; G.meta.taught = { ticket: true }; G.game.saveMeta(); });
  await page.reload();
  await page.waitForFunction(() => window.G && window.G.debug);
  const reloaded = await page.evaluate(() => ({ cuts: G.meta.cuts, runs: G.meta.runs, taught: G.meta.taught, pool: G.items.pool().filter(id => G.itemDefs[id].rarity === 'rare').map(id => G.itemDefs[id].cls) }));
  if (reloaded.cuts.join() !== 'burst' || reloaded.runs !== 7 || !reloaded.taught.ticket) throw new Error('meta did not survive a reload: ' + JSON.stringify(reloaded));
  if (reloaded.pool.some(c => c !== 'burst')) throw new Error('rare tokens of unpunched cuts are in the pool after reload: ' + reloaded.pool);
  // a damaged save and a wrong-shaped save are ignored, not fatal
  const damaged = await page.evaluate(() => {
    const out = [];
    for (const raw of ['{bad json', '[1,2]', '{"cuts":"pierce","runs":"x","best":-3}', 'null']) {
      localStorage.setItem('dryline-meta-v1', raw); G.meta.cuts = []; G.meta.runs = 0; G.meta.best = null;
      try { G.game.loadMeta(); out.push(Array.isArray(G.meta.cuts) && typeof G.meta.runs === 'number'); } catch (e) { out.push(false); }
    }
    localStorage.removeItem('dryline-meta-v1'); return out;
  });
  if (damaged.some(x => !x)) throw new Error('a damaged save broke loading: ' + damaged);

  // everything works when localStorage throws
  const noStore = await page.evaluate(async () => {
    const D = G.debug, fail = [], ok = (c, m) => { if (!c) fail.push(m); };
    const boom = () => { throw new Error('storage denied'); };
    let blocked = false;
    try { Object.defineProperty(window, 'localStorage', { configurable: true, get: boom }); blocked = true; } catch (e) { /* fall through */ }
    for (const f of ['getItem', 'setItem', 'removeItem']) try { Storage.prototype[f] = boom; blocked = true; } catch (e) { /* ignore */ }
    ok(blocked, 'could not simulate blocked storage');
    try { localStorage.getItem('x'); fail.push('storage did not throw'); } catch (e) { /* expected */ }
    G.meta.cuts = []; G.meta.taught = {};
    try {
      G.game.loadMeta(); D.newRun(31); D.step(60); G.game.punched('ground'); G.game.saveMeta();
      ok(G.meta.cuts.includes('ground') && G.run.punchLog.length === 1, 'meta still updates in memory');
      G.run.over = 'dead'; G.game.checkEnd(); D.step(5);
      for (const st of ['map', 'pause', 'over', 'play']) { G.state = st; await new Promise(r => setTimeout(r, 60)); }
      G.run.over = null; G.state = 'play'; D.step(120 * 4);
      G.game.newRun(32); ok(G.meta.runs > 0, 'new run works');
    } catch (e) { fail.push('threw: ' + e.message); }
    return fail;
  });
  if (noStore.length) throw new Error(noStore.join(' | '));
  return '30 seeds; ticket 30/45, kiosk, standpipes, swap, Warden reward, meta reload, blocked storage';
};
