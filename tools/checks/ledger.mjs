// The feat ledger between runs: at least twelve feats; each triggers on its own event, persists in the meta save, and unlocks an OPTION (a ledger token that enters the
// pool, a Timetable card, a starting-token choice, Express mode), never power. The run code carries the unlocks so a code replays on any save. Storage that throws or
// holds rubbish never breaks the game. The Ledger screen lists every feat as done or not done with what it unlocks, from the title and from the pause menu.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, L = G.ledger, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const spy = fn => { const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d'), texts = [];
      const ft = ctx.fillText.bind(ctx); ctx.fillText = (t, ...r) => { texts.push(String(t)); return ft(t, ...r); };
      const lb = G.art.label; G.art.label = function (c, t, ...r) { texts.push(String(t)); return lb.call(this, c, t, ...r); };
      try { fn(ctx); } finally { G.art.label = lb; } return texts.join(' | '); };
    const reset = () => { G.meta.feats = {}; G.meta.mats = []; G.meta.cuts = []; G.meta.opts = { start: null, express: false }; try { localStorage.removeItem('dryline-meta-v1'); } catch (e) {} };
    const fresh = (seed = 5) => { L.force = 'none'; D.newRun(seed); D.god(false); G.players.length = 1; return G.run; };
    const done = id => !!G.meta.feats[id];
    // ---- the list
    ok(L.FEATS.length >= 12, 'only ' + L.FEATS.length + ' feats');
    const kinds = { token: 0, card: 0, option: 0, none: 0 };
    for (const f of L.FEATS) {
      ok(f.name && f.text && /[.]$/.test(f.text), f.id + ': name or text'); kinds[f.unlock ? f.unlock.kind : 'none']++;
      if (f.unlock) ok(f.unlock.kind === 'token' ? G.itemDefs[f.unlock.id] && G.itemDefs[f.unlock.id].rarity === 'ledger' : f.unlock.kind === 'card' ? L.CARDS.find(c => c.id === f.unlock.id && c.locked) : ['start', 'express'].includes(f.unlock.id), f.id + ': unlocks something that does not exist: ' + JSON.stringify(f.unlock));
    }
    ok(kinds.token === 4 && kinds.card === 4 && kinds.option === 2, 'unlock kinds ' + JSON.stringify(kinds));
    ok(L.LEDGER_TOKENS.every(t => L.FEATS.some(f => f.unlock && f.unlock.id === t)) && L.LOCKED_CARDS.every(c => L.FEATS.some(f => f.unlock && f.unlock.id === c)), 'a ledger token or locked card has no feat');
    // ---- every feat triggers, and only on its event
    reset(); fresh();
    ok(Object.keys(G.meta.feats).length === 0, 'feats before any play');
    for (const r of ['r1', 'r2', 'r3', 'r4']) {
      L.event('beaten', { region: r, grade: { clean: false } }); ok(done('beat_' + r) && !done('clean_' + r), r + ': a beaten Warden earned the wrong feats');
      L.event('beaten', { region: r, grade: { clean: true } }); ok(done('clean_' + r), r + ': a Clean did not earn its feat');
    }
    L.event('beaten', { region: 'final', grade: { clean: true } }); ok(!done('beat_final') && !done('clean_final'), 'the Long Clock earned a Warden feat');
    // real fights: a clean r2 kill in play; a hit makes it not clean
    reset(); fresh(); D.startBoss('r2'); D.step(130); { const b = G.rooms.current.boss; b.damage(1e6); D.step(3); ok(done('beat_r2') && done('clean_r2'), 'a clean fight did not earn beat and clean: ' + Object.keys(G.meta.feats)); }
    reset(); fresh(); D.startBoss('r2'); D.step(130); { const b = G.rooms.current.boss; G.run.stats.hits++; b.damage(1e6); D.step(3); ok(done('beat_r2') && !done('clean_r2'), 'a fight with a hit earned Clean: ' + Object.keys(G.meta.feats)); }
    // win: only the Long Clock; nobeat only with no Warden beaten; par only under 30 minutes
    reset(); fresh(); G.run.beaten.final = true; G.run.time = 1500; G.game.checkEnd();
    ok(G.run.over === 'win' && done('win') && done('win_nobeat') && done('win_par'), 'a quick straight win earned ' + Object.keys(G.meta.feats));
    reset(); fresh(); G.run.beaten.r1 = true; G.run.beaten.final = true; G.run.time = 2000; G.game.checkEnd();
    ok(done('win') && !done('win_nobeat') && !done('win_par'), 'a slow win after a Warden earned ' + Object.keys(G.meta.feats));
    reset(); fresh(); ok(!done('win'), 'win earned without winning'); G.run.time = 1; G.run.beaten.r1 = true; G.game.checkEnd(); ok(!done('win'), 'beating a Warden earned the win');
    // punch all three slots of one boss, with real token hits
    reset(); fresh(); D.chart('r1', ['pierce', 'arc', 'burst']); D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('cinder_bell'); D.startBoss('r1'); D.step(130);
    { const b = G.rooms.current.boss, p = G.players[0]; b.spots.forEach((sp, i) => { const id = ['cobalt_awl', 'ochre_ladle', 'cinder_bell'].find(t => G.itemDefs[t].cls === sp.cls);
        for (let k = 0; k < 3; k++) b.hitSpot(sp, { cls: sp.cls, itemId: id, owner: p, dmg: 5 }); ok(i < 2 ? !done('punch_all') : done('punch_all'), 'punch_all after ' + (i + 1) + ' slots: ' + done('punch_all')); }); }
    ok(!done('punch_cuts'), 'punch_cuts after three cuts'); G.game.punched('ground'); ok(done('punch_cuts'), 'punch_cuts after all four cuts');
    // materials: all twelve, across runs; eleven are not enough
    reset(); fresh(); for (const w of L.WORDS.slice(0, 11)) G.materials.word(0, 0, w, 'wet'); ok(!done('materials') && G.meta.mats.length === 11, 'materials after eleven: ' + G.meta.mats.length);
    fresh(9); ok(G.meta.mats.length === 11, 'the material list did not survive a new run'); G.materials.word(0, 0, 'Shatter', 'brittle'); G.materials.word(0, 0, 'Spark', 'wet'); ok(!done('materials'), 'a made-up word counted'); G.materials.word(0, 0, L.WORDS[11], 'wet'); ok(done('materials'), 'twelve materials did not earn Chemistry');
    // a feat is earned once, and is announced
    reset(); fresh(); ok(L.earn('win') === true && L.earn('win') === false && G.run.featsNew.join() === 'win', 'earn twice: ' + G.run.featsNew);
    // ---- persistence
    reset(); fresh(); L.earn('clean_r1'); L.earn('beat_r3'); G.meta.mats = ['Douse'];
    G.game.saveMeta(); const raw = localStorage.getItem('dryline-meta-v1'); ok(!!raw && JSON.parse(raw).feats.clean_r1, 'the feat is not in the save: ' + raw);
    G.meta.feats = {}; G.meta.mats = []; G.game.loadMeta(); ok(done('clean_r1') && done('beat_r3') && G.meta.mats.join() === 'Douse', 'feats did not come back from the save');
    // ---- unlocks: options, never power
    reset(); fresh(); ok(L.unlocked().tokens.length === 0 && L.unlocked().cards.length === 0 && !L.unlocked().start && !L.unlocked().express, 'something is unlocked on a new save');
    L.earn('clean_r1'); ok(L.unlocked().tokens.join() === 'jet_gimlet', 'clean_r1 does not unlock the Jet Gimlet'); ok(G.items.pool().includes('jet_gimlet') === false, 'the running world followed the save');
    G.meta.cuts = []; { D.newRun(5); ok(G.items.pool().includes('jet_gimlet') && G.run.unl.tokens.includes('jet_gimlet'), 'the run did not record the ledger token'); G.meta.feats = {}; ok(G.items.pool().includes('jet_gimlet'), 'the running world followed the save'); }
    L.earn('beat_r1'); ok(L.unlocked().cards.join() === 'wide_plates' && L.deck(L.unlocked().cards).some(c => c.id === 'wide_plates'), 'beat_r1 does not add Wide Plates to the deck');
    reset(); L.earn('win'); ok(L.unlocked().express && !L.unlocked().start, 'win unlocks Express'); L.earn('punch_all'); ok(L.unlocked().start, 'punch_all unlocks the starting token');
    for (const id of ['win_nobeat', 'win_par', 'punch_cuts', 'materials']) { reset(); L.earn(id); const u = L.unlocked(); ok(!u.tokens.length && !u.cards.length && !u.start && !u.express, id + ' unlocked something'); }
    // options need their feat; Express and a starting token change the run
    reset(); L.setOption('express', true); L.setOption('start', 'burst'); ok(!L.options().express && L.options().start === null, 'options worked without their feats');
    G.meta.feats = {}; L.earn('win'); L.earn('punch_all'); ok(L.options().express && L.options().start === 'burst', 'options lost: ' + JSON.stringify(L.options()));
    L.force = 'none'; D.newRun(21); const run = G.run, boss = (() => { D.startBoss('r1'); D.step(130); return G.rooms.current.boss; })();
    ok(run.opts.express && /\.[0-9A-F]+$/.test(run.code), 'the code does not carry the options: ' + run.code);
    ok(G.players[0].maxHp === 4, 'Express: the party has ' + G.players[0].maxHp + ' pips (wanted 4)'); ok(Math.abs(boss.maxHp / G.bossDefs.tollkeeper.hp - 1.15) < 1e-6, 'Express: Warden health x' + boss.maxHp / G.bossDefs.tollkeeper.hp);
    ok(G.game.partyItems().length === 1 && G.itemDefs[G.game.partyItems()[0]].cls === 'burst', 'the starting token is ' + G.game.partyItems());
    const code = run.code, world = JSON.stringify(Object.values(run.graph.nodes).map(n => [n.def, n.content, n.extras]));
    reset(); D.newRun(code); ok(G.run.code === code && JSON.stringify(Object.values(G.run.graph.nodes).map(n => [n.def, n.content, n.extras])) === world && G.run.opts.express && G.game.partyItems().length === 1, 'the code ' + code + ' did not replay on an empty save');
    ok(G.game.parseCode('1K9Z-5') && G.game.parseCode('1K9Z-5').extra.opts.express === false && G.game.codeOf(5, ['pierce'], { unl: { tokens: [], cards: [] }, opts: {} }) === '5-1', 'old two-part codes changed');
    // ---- storage that fails
    reset(); fresh();
    { const set = Storage.prototype.setItem, get = Storage.prototype.getItem; let threw = null;
      Storage.prototype.setItem = () => { throw new Error('quota'); }; Storage.prototype.getItem = () => { throw new Error('denied'); };
      try { L.earn('win'); G.game.saveMeta(); G.game.loadMeta(); fresh(3); G.run.beaten.final = true; G.game.checkEnd(); } catch (e) { threw = e.message; }
      Storage.prototype.setItem = set; Storage.prototype.getItem = get;
      ok(!threw, 'a failing storage threw: ' + threw); ok(done('win'), 'the feat was lost in memory when storage failed'); }
    for (const rubbish of ['{not json', '[]', '{"feats":[1,2],"mats":"x","opts":5}', '{"feats":{"win":"yes","nope":{"run":1},"clean_r1":{"run":-4}},"mats":["Douse","Bogus",7],"opts":{"start":"fire","express":"yes"}}']) {
      localStorage.setItem('dryline-meta-v1', rubbish); G.meta.feats = { win: { run: 1 } };
      try { G.game.loadMeta(); } catch (e) { bad.push('rubbish save threw: ' + rubbish); }
      ok(typeof G.meta.feats === 'object' && !Array.isArray(G.meta.feats) && Array.isArray(G.meta.mats) && G.meta.opts && typeof G.meta.opts.express === 'boolean', 'meta shape after ' + rubbish + ': ' + JSON.stringify([G.meta.feats, G.meta.mats, G.meta.opts]));
      ok(Object.keys(G.meta.feats).every(k => L.featById(k)), 'unknown feat kept after ' + rubbish);
      ok(G.meta.opts.start === null && G.meta.opts.express === false, 'options after rubbish: ' + JSON.stringify(G.meta.opts));
      try { fresh(2); } catch (e) { bad.push('a run could not start after ' + rubbish); }
    }
    // ---- the Ledger screen: from the title and from the pause menu
    reset(); L.earn('clean_r1'); L.earn('win'); G.meta.cuts = ['pierce'];
    G.state = 'title'; ok(G.ledgerUI.titleStep({ map: true }) === true && G.ledgerUI.open, 'Map on the title did not open the Ledger');
    const pages = [];
    for (let i = 0; i < 4; i++) { pages.push(spy(ctx => G.menus.title(ctx))); G.ledgerUI.titleStep({ right: true }); }
    const all = pages.join(' || ');
    for (const f of L.FEATS) { ok(pages[0].includes(f.name), 'the Ledger does not list ' + f.name); }
    ok(/Done/.test(pages[0]) && /Not done/.test(pages[0]) && /2 of 14 feats done/.test(pages[0]), 'the feats page lacks done / not done counts');
    ok(pages[0].includes('Unlocks: ') && /Jet Gimlet/.test(pages[0]) && /Express mode/.test(pages[0]) && /Wide Plates/.test(pages[0]), 'the feats page does not say what each feat unlocks');
    ok(L.LEDGER_TOKENS.every(t => pages[1].includes(G.itemDefs[t].name)) && pages[1].includes('In the pool (Clean Toll)') && pages[1].includes('Feat: Clean Idol') && pages[1].includes('Punch a arc slot'), 'the tokens page: ' + pages[1].slice(0, 300));
    ok(L.CARDS.every(c => pages[2].includes(c.name)) && /Feat: First Toll/.test(pages[2]), 'the timetable page');
    ok(/Express mode/.test(pages[3]) && /Starting token/.test(pages[3]) && /Locked/.test(pages[3]), 'the options page');
    G.ledgerUI.titleStep({ pause: true }); ok(!G.ledgerUI.open, 'Pause did not close the Ledger on the title');
    ok(spy(ctx => G.menus.title(ctx)).includes('The Ledger'), 'the title does not mention the Ledger');
    // options page: Express can be switched now that it is unlocked, Starting token is locked
    G.ledgerUI.titleStep({ map: true }); G.ledgerUI.page = 3; G.ledgerUI.sel = 1; G.ledgerUI.titleStep({ jump: true }); ok(L.options().express === true, 'Jump did not switch Express on');
    G.ledgerUI.sel = 0; G.ledgerUI.titleStep({ jump: true }); ok(L.options().start === null, 'a locked starting token changed'); G.ledgerUI.titleStep({ pause: true });
    // pause menu
    fresh(); G.state = 'pause'; G.menus.open('kb'); G.menus.pauseStep({ map: true }); ok(G.menus.menu.page === 'ledger' && G.ledgerUI.open, 'Map in the pause menu did not open the Ledger');
    ok(spy(ctx => G.menus.pause(ctx)).includes('The Ledger'), 'the pause menu did not draw the Ledger'); G.menus.pauseStep({ pause: true }); ok(G.menus.menu.page === 'main' && !G.ledgerUI.open, 'the Ledger did not close back to the pause menu');
    ok(spy(ctx => G.menus.pause(ctx)).includes('Paused'), 'the pause menu is gone after the Ledger'); G.state = 'play';
    // the run-over screen lists the feats the run earned
    reset(); fresh(); G.run.over = 'win'; L.earn('win'); const over = spy(ctx => G.menus.over(ctx)); ok(over.includes('Feats earned: The Clock Stops') && /Express mode/.test(over), 'the run-over screen does not list the new feat: ' + over.slice(-300));
    reset(); L.force = null;
    return { bad, kinds };
  });
  if (res.bad.length) throw new Error(res.bad.length + ' problems: ' + res.bad.slice(0, 4).join(' | '));
  return '14 feats (' + JSON.stringify(res.kinds) + '), triggers, saves, unlocks, codes, storage failures, the Ledger screen';
};
