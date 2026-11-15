// Controllers map to the right actions (navigator.getGamepads stubbed), for a pad at index 0 and for a lone pad at index 1: the first button press
// on the title makes that pad player 1; then every button and the stick drive exactly the action the notes name.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const btn = (set, ax = [0, 0]) => ({ id: 'stub pad', connected: true, axes: ax, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: set.includes(i) })) });
    const WANT = [[0, 'jump'], [2, 'attack'], [1, 'dash'], [7, 'dash'], [3, 'item'], [4, 'heal'], [5, 'cycle'], [8, 'map'], [9, 'pause'], [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']];
    for (const idx of [0, 1]) {
      G.game.resetParty(); G.state = 'title'; D.step(1);
      const list = [null, null]; navigator.getGamepads = () => list;
      list[idx] = btn([2]); G.input.poll(); D.step(2);
      ok(G.state === 'play' && G.players.length === 1 && G.players[0].in.dev === 'pad:' + idx, 'pad at index ' + idx + ' did not become player 1 (' + G.state + ', ' + G.players.map(p => p.in.dev) + ')');
      list[idx] = btn([]); G.input.poll(); D.step(2);
      const held = () => Object.keys(G.players[0].in.held).filter(a => G.players[0].in.held[a]).sort().join();
      for (const [b, a] of WANT) {
        list[idx] = btn([b]); G.input.poll();
        const exp = a === 'up' ? 'interact,up' : a;
        ok(held() === exp, 'pad ' + idx + ' button ' + b + ' gave "' + held() + '", wanted "' + exp + '"');
        list[idx] = btn([]); G.input.poll();
      }
      for (const [ax, a] of [[[-1, 0], 'left'], [[1, 0], 'right'], [[0, -1], 'interact,up'], [[0, 1], 'down']]) {
        list[idx] = btn([], ax); G.input.poll(); ok(held() === a, 'pad ' + idx + ' stick ' + ax + ' gave "' + held() + '", wanted "' + a + '"'); list[idx] = btn([]); G.input.poll();
      }
      // the wired actions really act: Jump leaves the ground, Slash starts a slash
      D.newRun(5); D.god(true); D.step(40); const y0 = G.players[0].y;
      list[idx] = btn([0]); G.input.poll(); D.step(12); ok(G.players[0].y < y0 - 5, 'A did not jump (pad ' + idx + ')');
      list[idx] = btn([]); G.input.poll(); D.step(80);
      list[idx] = btn([2]); G.input.poll(); D.step(3); ok(!!G.players[0].slash, 'X did not slash (pad ' + idx + ')');
      list[idx] = btn([]); G.input.poll(); D.step(40);
    }
    navigator.getGamepads = () => []; G.input.poll(); G.game.resetParty(); G.state = 'title';
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 6).join(' | '));
  return 'title claim, every button and the stick, pad at index 0 and a lone pad at index 1';
};
