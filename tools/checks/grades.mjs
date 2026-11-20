// Boss grades. Every fight is graded when it ends: Beaten; Par if it took less than the boss's par time (about 1.2 x the slash-only bot time of
// the fight_len check; co-op scales it with the health); Clean if no player took a hit during the fight. A Clean fight refunds one token that was
// punched in it: into a free party slot, or onto the arena floor as a plinth when the party is full. The grade shows as a stamp when the fight ends and
// is listed on the map, the run-over screen and the win screen.
const SLASH_ONLY = { tollkeeper: 105, lamp_heron: 108, switchman_idol: 96, gatewhale: 117, long_clock: 141 };   // seconds, fight_len (seed 77); long_clock: straight to it
export default async ({ page }) => {
  const res = await page.evaluate(slash => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); }, out = {};
    // par times: about 1.2 x the bot's slash-only time
    for (const id in slash) { const par = G.bossDefs[id].par; ok(par >= slash[id] * 0.6 && par <= slash[id] * 1.3, id + ': par ' + par + ' is not 0.6 to 1.3 x ' + slash[id]); }
    const kill = (region, setup) => {
      D.newRun(5); D.god(false); G.players.length = 1; D.startBoss(region); const b = G.rooms.current.boss; D.step(130);
      if (setup) setup(b); b.damage(1e6); D.step(3);
      return { b, g: G.run.grades[region], room: G.rooms.current };
    };
    // a quick clean fight, a slow one, one with a hit
    let r = kill('r1', b => { b.clock = 20; });
    ok(r.g && r.g.par && r.g.clean && r.b.state === 'dead', 'fast clean fight: ' + JSON.stringify(r.g));
    ok(G.fx.stampNow && G.fx.stampNow.lines.join() === 'BEATEN,PAR,CLEAN', 'stamp: ' + JSON.stringify(G.fx.stampNow));
    ok(G.game.gradeText(r.g) === 'Beaten · Par · Clean', 'grade text: ' + G.game.gradeText(r.g));
    r = kill('r1', b => { b.clock = G.bossDefs.tollkeeper.par + 5; });
    ok(r.g && !r.g.par && r.g.clean && G.game.gradeText(r.g) === 'Beaten · Clean', 'slow clean fight: ' + JSON.stringify(r.g));
    r = kill('r2', b => { b.clock = 30; G.run.stats.hits++; });
    ok(r.g && r.g.par && !r.g.clean && G.game.gradeText(r.g) === 'Beaten · Par', 'fast fight with a hit: ' + JSON.stringify(r.g));
    r = kill('r3', b => { b.clock = G.bossDefs.switchman_idol.par + 1; G.run.stats.hits++; });
    ok(r.g && !r.g.par && !r.g.clean && G.game.gradeText(r.g) === 'Beaten', 'slow fight with a hit: ' + JSON.stringify(r.g));
    // a hit taken by a real hazard (a spike) counts: stats.hits only moves when a player is hurt
    D.newRun(5); D.god(false); D.startBoss('r1'); D.step(130); const h0 = G.run.stats.hits; G.players[0].hurt(0); ok(G.run.stats.hits === h0 + 1, 'hurt() did not count a hit');
    // co-op: par scales with the boss health
    D.newRun(5); while (G.players.length < 2) D.addPlayer(); D.startBoss('r1'); const bc = G.rooms.current.boss; D.step(130); bc.clock = G.bossDefs.tollkeeper.par * 1.3; bc.damage(1e6); D.step(3);
    ok(G.run.grades.r1 && G.run.grades.r1.par && Math.abs(G.run.grades.r1.parTime - G.bossDefs.tollkeeper.par * 1.6) < 1e-6, 'two players: par should be x1.6: ' + JSON.stringify(G.run.grades.r1)); G.players.length = 1;
    // refund: a punched token comes back on a Clean fight (free slot), and stays void otherwise
    D.newRun(5); D.god(false); G.players.length = 1; D.give('cobalt_awl'); D.startBoss('r1'); let b = G.rooms.current.boss; D.step(130);
    G.game.spend('cobalt_awl', G.players[0]); ok(G.run.spent.includes('cobalt_awl') && !G.players[0].items.includes('cobalt_awl'), 'spend did not void the token');
    b.damage(1e6); D.step(3);
    out.refundParty = { items: G.players[0].items.slice(), spent: G.run.spent.slice(), g: G.run.grades.r1 };
    ok(G.players[0].items.includes('cobalt_awl') && !G.run.spent.includes('cobalt_awl') && G.run.grades.r1.where === 'party', 'refund into a free slot: ' + JSON.stringify(out.refundParty));
    D.newRun(5); D.god(false); G.players.length = 1; D.give('cobalt_awl'); D.startBoss('r1'); b = G.rooms.current.boss; D.step(130);
    G.game.spend('cobalt_awl', G.players[0]); G.run.stats.hits++; b.damage(1e6); D.step(3);
    ok(!G.run.grades.r1.clean && G.run.spent.includes('cobalt_awl') && !G.players[0].items.includes('cobalt_awl') && !G.run.grades.r1.refund, 'a fight with a hit must not refund: ' + JSON.stringify(G.run.grades.r1));
    // full party: the refund lies on the arena floor as a pickup (plinth), and taking it works
    D.newRun(5); D.god(false); G.players.length = 1; D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('cinder_bell'); D.startBoss('r1'); b = G.rooms.current.boss; D.step(130);
    G.game.spend('cobalt_awl', G.players[0]); D.give('basalt_roller');
    ok(G.game.freeSlots() === 0, 'party should be full: ' + G.game.freeSlots());
    b.damage(1e6); D.step(3);
    const pl = G.rooms.current.props.find(p => p.type === 'plinth' && p.data.item === 'cobalt_awl' && p.data.refund);
    ok(G.run.grades.r1.where === 'floor' && !!pl && !G.run.spent.includes('cobalt_awl'), 'full party: refund should be a plinth on the floor: ' + JSON.stringify(G.run.grades.r1));
    ok(pl && Math.abs(pl.y - G.rooms.current.boss.floor) < 1 && pl.x > G.rooms.current.def.floorX[0] && pl.x < G.rooms.current.def.floorX[1], 'the refund plinth is not on the arena floor');
    // where grades are shown: the map, the run-over screen and the win screen
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d'), texts = [];
    const ft = ctx.fillText.bind(ctx); ctx.fillText = (t, ...a) => { texts.push(String(t)); return ft(t, ...a); };
    const lb = G.art.label; G.art.label = (c, t, ...a) => { texts.push(String(t)); return lb.call(G.art, c, t, ...a); };
    const want = G.game.gradeText(G.run.grades.r1);
    texts.length = 0; G.map.draw(ctx); ok(texts.some(t => t === want || t === 'Grade: ' + want), 'the map does not show the grade: ' + want);
    G.run.beaten.final = true; G.run.grades.final = { time: 100, parTime: 150, par: true, clean: false };
    for (const over of ['dead', 'win']) { G.run.over = over; texts.length = 0; G.menus.over(ctx); ok(texts.some(t => t.includes('Tollkeeper:') && t.includes(want)), over + ' screen does not list the Tollkeeper grade'); ok(over === 'dead' || texts.some(t => t.includes('The Long Clock:') && t.includes('Beaten · Par')), 'win screen does not list the Long Clock grade'); }
    G.art.label = lb; G.run.over = null;
    // the stamp draws without error
    G.fx.stamp(['BEATEN', 'PAR'], 'note'); G.hud.draw(ctx);
    return { bad };
  }, SLASH_ONLY);
  if (res.bad.length) throw new Error(res.bad.slice(0, 6).join(' | '));
  return 'grades, par, clean, refunds, map and end screens';
};
