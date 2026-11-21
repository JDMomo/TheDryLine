// Overlays never cover the party. (1) The Timetable intro card picks a spot that overlaps no player and not the Station Keeper, for every card, a few seeds and
// with the player standing wherever the card would otherwise sit; (2) in the Junction the Route Board's prompt overlaps neither the board's panel and rows, nor the
// Timetable plate, nor a player standing at the board; the plate overlaps neither the board nor its prompt; (3) a taller story banner still holds the card back.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, L = G.ledger, bad = [], hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    const frame = () => { G.ledgerIntro.left = 8; G.ledgerIntro.last = G.time; G.hud.draw(ctx); };
    const screenBox = (p) => { const cx = Math.round(G.cam.x), cy = Math.round(G.cam.y), y = p.cy !== undefined ? p.cy : p.y - 24; return { x0: p.x - cx - 20, x1: p.x - cx + 20, y0: y - cy - 40, y1: y - cy + 30 }; };
    const cards = ['none', ...L.CARDS.map(c => c.id)];
    for (let k = 0; k < cards.length; k++) for (const seed of [2, 8]) {
      L.force = cards[k]; D.newRun(seed); D.god(true); G.players.length = 1; G.fx.banner = null; G.tips.shown = null;
      const room = G.rooms.current, p = G.players[0]; room.enterAt = G.time - 10; G.ledgerIntro.run = null;
      for (const dy of [0, 150, -150]) {                              // stand the player low, mid and high on screen: the card must move out of the way
        p.y += dy; G.cam.follow(0, p.x, p.y, true); G.ledgerIntro.run = null; frame();
        const box = G.ledgerIntro.box; if (!box) { bad.push(cards[k] + ' seed ' + seed + ': the card is not drawn'); continue; }
        if (hit(box, screenBox(p))) bad.push(cards[k] + ' seed ' + seed + ' dy ' + dy + ': the card covers the player ' + JSON.stringify(box) + ' ' + JSON.stringify(screenBox(p)));
        for (const pr of room.props.filter(q => q.type === 'guide')) { const cx = Math.round(G.cam.x), cy = Math.round(G.cam.y); if (hit(box, { x0: pr.x - cx - 30, x1: pr.x - cx + 30, y0: pr.y - cy - 80, y1: pr.y - cy })) bad.push(cards[k] + ': the card covers the Station Keeper'); }
        if (box.x0 < 0 || box.x1 > 960 || box.y0 < 0 || box.y1 > 544) bad.push('the card leaves the screen ' + JSON.stringify(box));
        p.y -= dy;
      }
    }
    // a taller banner (long text) still holds the card back
    L.force = 'none'; D.newRun(3); D.god(true); G.players.length = 1; G.tips.shown = null; G.rooms.current.enterAt = G.time - 10; G.ledgerIntro.run = null;
    G.fx.banner = { a: 'A long story card', b: 'word '.repeat(60), t: 4, max: 4 }; frame(); ok2(!G.ledgerIntro.box, 'the card is drawn over a tall banner');
    function ok2(c, m) { if (!c) bad.push(m); }
    // the Junction's board, plate and prompts
    D.newRun(1); D.god(true); G.players.length = 1; const room = G.rooms.current, board = room.props.find(q => q.type === 'board'), plate = room.props.find(q => q.type === 'timetable');
    if (!board || !plate) bad.push('the Junction has no board or no Timetable plate');
    else {
      const body = G.props.boxes(board, ctx).filter(b => b.kind === 'body'), pl = G.props.boxes(plate, ctx)[0], pp = G.players[0];
      pp.x = board.x; pp.y = board.y; G.cam.x = Math.max(0, board.x - 480); G.cam.y = Math.max(0, board.y - 272);
      const P = G.props.layoutPrompt(ctx, board, G.props.TYPES.board.prompt(board, pp)), pb = { x0: P.x0, x1: P.x1, y0: P.y0, y1: P.y1 };
      for (const b of G.props.boxes(board, ctx)) if (hit(pb, b)) bad.push('the board prompt overlaps the board (' + (b.text || b.kind) + ')');
      if (hit(pb, pl)) bad.push('the board prompt overlaps the Timetable plate');
      for (const b of body) if (hit(pl, b)) bad.push('the Timetable plate overlaps the board');
      const me = { x0: pp.x - 20, x1: pp.x + 20, y0: pp.y - 64, y1: pp.y };
      if (hit(pb, me)) bad.push('the board prompt covers the player standing at the board');
      if (hit(pl, me) && Math.abs(plate.x - board.x) < 100) bad.push('the plate is too close to the board');
      if (P.y0 < G.cam.y) bad.push('the board prompt leaves the top of the screen');
    }
    return bad;
  });
  if (res.length) throw new Error(res.length + ' problems: ' + res.slice(0, 6).join(' | '));
  return 'the intro card keeps clear of the player and Keeper (10 cards, 2 seeds, 3 positions); the board prompt, board and Timetable plate do not overlap';
};
