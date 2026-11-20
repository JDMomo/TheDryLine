// Short contextual tips, each shown once at the moment it matters: first token (use and switch buttons), first hurt with a gauge that can
// mend, first spike pit (the bounce), first boss with an open fare slot (match the shape), first cracked-barrier mistake and first Warden grade.
// Wording follows the device used last. The hub signs say where tokens come from.
export default async ({ page }) => {
  await page.evaluate(() => { G.debug.fullCharts = true; });      // the fare tip needs the token's cut on the Tollkeeper's chart
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const fresh = () => { G.meta.taught = {}; G.tips.clear(); G.input.last = 'keyboard'; };
    const text = () => G.tips.queue.map(t => G.tips.text(t.id)).concat(G.tips.shown ? [G.tips.text(G.tips.shown.id)] : []);
    const has = id => G.tips.queue.some(t => t.id === id) || (G.tips.shown && G.tips.shown.id === id);
    const run = (n = 3) => D.step(n);

    // 1. first token: the token button and the switch button, in the words of the device
    fresh(); D.newRun(7); D.god(true); G.tips.clear(); run();
    ok(!has('token'), 'a tip before any token');
    D.give('cobalt_awl'); run();
    ok(has('token'), 'no token tip after the first token');
    const t1 = text().join(' ');
    ok(/\bV\b/.test(t1) && /Q or E/.test(t1) && /token/.test(t1), 'keyboard wording: ' + t1);
    G.tips.clear(); D.give('ochre_ladle'); run(); ok(!has('token'), 'the token tip came a second time');
    fresh(); G.input.last = 'gamepad'; D.give('cobalt_awl'); run();
    const t1g = text().join(' '); ok(/\bY\b/.test(t1g) && /RB/.test(t1g) && !/\bV\b/.test(t1g), 'gamepad wording: ' + t1g);
    ok(G.tips.text('token').split('\n').length === 1, 'the tip is more than one line of text');

    // 2. first time hurt with a gauge that can mend
    fresh(); D.newRun(7); D.god(false); const p = G.players[0]; p.inv = 0; p.glow = 10; p.hurt(p.x + 30); run(1);
    ok(!has('mend'), 'mend tip with an almost empty gauge');
    p.inv = 0; p.hp = p.maxHp; p.glow = 40; p.hurt(p.x + 30); run(1);
    ok(has('mend'), 'no mend tip when hurt with a gauge that can mend');
    const t2 = text().join(' '); ok(/Hold F/.test(t2) && /mend/.test(t2), 'mend wording: ' + t2);
    G.input.last = 'gamepad'; ok(/Hold LB/.test(G.tips.text('mend')), 'gamepad mend wording');
    G.tips.clear(); p.inv = 0; p.hp = p.maxHp; p.glow = 40; p.hurt(p.x + 30); run(1); ok(!has('mend'), 'the mend tip came twice');

    // 3. first spike pit: the bounce. Campaign composition may contain no spikes, so teach/test the hazard in a deterministic room.
    fresh(); D.newRun(7); D.god(true);
    {
      const g=Array.from({length:17},(_,r)=>Array.from({length:30},(_,c)=>(r===0||r>=15||((c===0||c===29)&&(r<12||r>14)))?'#':'.'));
      for(let c=12;c<=15;c++)g[15][c]='^';
      if(!G.roomDefs.qa_spike_tip)G.defineRoom({id:'qa_spike_tip',region:'r1',kind:'main',map:g.map(row=>row.join(''))});
      const id='qa_spike_tip_node';G.run.graph.nodes[id]={id,def:'qa_spike_tip',region:'r1',exits:{},content:[],seen:true,parent:null};
      G.rooms.enter(id,{side:'left'});G.rooms.current.enemies.length=0;G.tips.clear();run(3);
      ok(!has('bounce'),'bounce tip at the room entrance, far from spikes');
      D.place(0,12*32-90,16*32);run(3);
      ok(has('bounce'),'no bounce tip beside the deterministic spike bed');
      ok(/Down/.test(text().join(' '))&&/bounce/.test(text().join(' ')),'bounce wording: '+text().join(' '));
      G.tips.clear();D.place(0,12*32-90,16*32);run(3);ok(!has('bounce'),'the bounce tip came twice');
    }

    // 4. first fare slot opened
    fresh(); D.newRun(7); D.god(true); D.startBoss('r1'); run(2);
    ok(!has('fare'), 'fare tip with no token carried (every slot sealed)');
    fresh(); D.newRun(7); D.god(true); D.give('ochre_ladle'); D.startBoss('r1'); run(2);
    ok(has('fare'), 'no fare tip when a slot opens'); ok(/shape/.test(text().join(' ')), 'fare wording: ' + text().join(' '));

    // 5. first cracked barrier: a plain slash teaches Heavy Cut, once, and follows the attack binding
    fresh(); D.newRun(5); D.god(true); const own = G.run.graph.regions.r1.own; D.gotoRoom(own);
    const crack = G.rooms.current.props.find(p => p.type === 'crack');
    ok(!!crack, 'no cracked barrier for the tip');
    if (crack) {
      const cp = G.players[0]; D.place(0, crack.x - 40, crack.y, 1); run(3);
      D.setInput(0, { attack: true }); run(4); D.setInput(0, { attack: false }); run(4);
      ok(has('crack'), 'no crack tip after a plain slash');
      ok(/Heavy Cut/.test(text().join(' ')) && /Ticket Hall/.test(text().join(' ')), 'crack wording before unlock: ' + text().join(' '));
      G.tips.clear(); crack.data.clink = 0; D.setInput(0, { attack: true }); run(4); D.setInput(0, { attack: false }); run(4);
      ok(!has('crack'), 'the crack tip came twice');
    }

    // 6. first Warden grade explains Par, Clean and the refund, once
    fresh(); D.newRun(7); D.god(true); D.startBoss('r1'); run(130);
    let boss = G.rooms.current.boss; boss.damage(1e6); run(3);
    ok(has('grade'), 'no grade tip after the first Warden');
    ok(/Par/.test(text().join(' ')) && /Clean/.test(text().join(' ')) && /refund/.test(text().join(' ')), 'grade wording: ' + text().join(' '));
    G.tips.clear(); D.newRun(8); D.god(true); D.startBoss('r1'); run(130); boss = G.rooms.current.boss; boss.damage(1e6); run(3);
    ok(!has('grade'), 'the grade tip came twice');

    // 7. hub signs include token sources and the chart
    fresh(); D.newRun(7); const signs = G.rooms.current.props.filter(p => p.type === 'sign').map(p => p.data.text).join(' ');
    ok(/plinth/i.test(signs) && /trunk/i.test(signs) && /ticket/i.test(signs) && /kiosk/i.test(signs) && /three/i.test(signs) && /chart/i.test(signs), 'hub signs do not say where tokens come from: ' + signs);

    // 8. the tip is drawn on screen, wrapped, inside the canvas
    fresh(); D.newRun(7); G.input.last = 'keyboard'; D.give('cobalt_awl'); D.step(130); G.fx.banner = null; D.step(2);   // a story banner holds tips back, so clear it first
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d'), seen = [];
    const label = G.art.label; G.art.label = (c, t, x, y, ...r) => { seen.push([t, x, y]); return label.call(G.art, c, t, x, y, ...r); };
    G.rooms.draw(ctx, 0); G.hud.draw(ctx); G.art.label = label;
    ok(seen.some(s => /uses your token/.test(s[0]) && s[2] > 400 && s[2] < 544), 'the tip is not drawn near the bottom of the screen');
    G.meta.taught = {};
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 5).join(' | '));
  return 'six tips, once each, device wording, hub signs';
};
