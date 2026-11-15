// Joining and leaving. Any device can be player 1 (the first to press a button on the title); in the Junction any other device joins by pressing Jump,
// up to four players, the keyboard counting as one device; holding Pause for a second removes that player (a short press still opens the menu).
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const btn = set => ({ id: 'stub pad', connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: set.includes(i) })) });
    const list = [null, null, null, null]; navigator.getGamepads = () => list;
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
    const tapKey = code => { key('keydown', code); D.step(2); key('keyup', code); D.step(2); };
    const tapPad = (i, b) => { list[i] = btn([b]); G.input.poll(); D.step(2); list[i] = btn([]); G.input.poll(); D.step(2); };
    const devs = () => G.players.map(p => p.in.dev).join();
    // a controller at index 3 is the first to press a button: it is player 1, the keyboard is not
    G.game.resetParty(); G.state = 'title'; D.step(1);
    list[3] = btn([]); G.input.poll(); tapPad(3, 1);
    ok(G.state === 'play' && devs() === 'pad:3', 'player 1 should be the pad at index 3: ' + G.state + ' ' + devs());
    tapKey('KeyZ'); ok(G.state === 'play' && G.players.length === 2 && devs() === 'pad:3,kb', 'the keyboard did not join as player 2 with Jump: ' + devs());
    tapPad(3, 0); ok(G.players.length === 2, 'the owner of a device joined again');
    tapKey('Space'); ok(G.players.length === 2, 'the keyboard joined twice');
    list[0] = btn([]); list[1] = btn([]); list[2] = btn([]); G.input.poll();
    tapPad(0, 2); ok(G.players.length === 2, 'a pad that pressed Slash joined (only Jump joins)');
    tapPad(0, 0); ok(G.players.length === 3 && G.players[2].in.dev === 'pad:0', 'pad 0 did not join as player 3: ' + devs());
    tapPad(1, 0); ok(G.players.length === 4 && G.players[3].in.dev === 'pad:1', 'pad 1 did not join as player 4: ' + devs());
    tapPad(2, 0); ok(G.players.length === 4, 'a fifth device joined a party of four');
    // the pad of player 3 leaves: hold Pause (Start) for one second
    D.give('cobalt_awl', 2);
    list[0] = btn([9]); G.input.poll(); D.step(60);
    ok(G.players.length === 4 && G.state === 'play', 'half a second of Pause changed something (' + G.players.length + ', ' + G.state + ')');
    D.step(70);
    ok(G.players.length === 3 && G.state === 'play' && !G.players.some(p => p.in.dev === 'pad:0'), 'holding Pause for a second did not remove player 3: ' + devs() + ' ' + G.state);
    list[0] = btn([]); G.input.poll(); D.step(4);
    ok(G.state === 'play', 'letting go of Pause after leaving opened the menu');
    ok(G.players.map(p => p.index).join() === '0,1,2', 'players were not renumbered: ' + G.players.map(p => p.index));
    // a short press opens the pause menu
    list[1] = btn([9]); G.input.poll(); D.step(20); list[1] = btn([]); G.input.poll(); D.step(4);
    ok(G.state === 'pause' && G.players.length === 3, 'a short press of Pause did not open the menu: ' + G.state);
    G.state = 'play'; navigator.getGamepads = () => []; G.input.poll();
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 6).join(' | '));
  return 'title claim by pad 3, keyboard and pads join with Jump, four at most, hold Pause 1 s leaves';
};
