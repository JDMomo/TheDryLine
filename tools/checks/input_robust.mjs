// Robustness: (1) when the window loses and regains focus no key is stuck down and a key still held is picked up again (the browser's auto-repeat);
// (2) when a joined controller disconnects the game pauses with a message naming the player, and resumes when it reconnects or when another
// device presses a button to take over.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const btn = set => ({ id: 'stub pad', connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: set.includes(i) })) });
    const list = [null, btn([]), null]; navigator.getGamepads = () => list;
    const key = (type, code, extra = {}) => window.dispatchEvent(new KeyboardEvent(type, Object.assign({ code, key: code, bubbles: true }, extra)));
    const held = (i = 0) => G.players[i].in.held;
    D.newRun(5); D.god(true); D.step(20);
    // ---- focus
    key('keydown', 'ArrowRight'); ok(held().right, 'Right did not register');
    window.dispatchEvent(new Event('blur')); ok(!held().right, 'a key is stuck down after the window lost focus');
    window.dispatchEvent(new Event('focus'));
    key('keydown', 'ArrowRight', { repeat: true }); ok(held().right, 'a key still held after the focus came back was not picked up (auto-repeat)');
    key('keyup', 'ArrowRight'); ok(!held().right, 'Right stuck after release');
    key('keydown', 'ArrowLeft'); window.dispatchEvent(new Event('blur')); key('keyup', 'ArrowLeft'); key('keydown', 'KeyA', { repeat: true }); ok(held().left, 'A (left) after focus returned');
    key('keyup', 'KeyA');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    key('keydown', 'KeyD'); document.dispatchEvent(new Event('visibilitychange')); ok(!held().right, 'a key is stuck after the tab was hidden'); delete document.hidden;
    G.state = 'play'; D.step(2);
    // ---- hot-plug: the pad at index 1 joins as player 2
    list[1] = btn([0]); G.input.poll(); D.step(2); list[1] = btn([]); G.input.poll(); D.step(2);
    ok(G.players.length === 2 && G.players[1].in.dev === 'pad:1', 'player 2 did not join on pad 1: ' + G.players.map(p => p.in.dev));
    const texts = [], ctx = document.createElement('canvas').getContext('2d'), label = G.art.label;
    G.art.label = (c, t, ...r) => { texts.push(String(t)); return label.call(G.art, c, t, ...r); };
    const draw = () => { texts.length = 0; G.rooms.draw(ctx, 0); G.menus.pause(ctx); return texts.join(' | '); };
    list[1] = null; G.input.poll(); D.step(2);
    ok(G.state === 'pause' && G.menus.lost.join() === '1', 'unplugging player 2\'s controller did not pause (' + G.state + ' ' + G.menus.lost + ')');
    ok(/Player 2.*disconnected/.test(draw()), 'the pause screen does not name the player: ' + draw().slice(0, 200));
    const t0 = G.run.time; D.step(60); ok(G.run.time === t0, 'time moved while a controller was missing');
    G.input.any.forced.pause = true; G.input.sync(); D.step(2); G.input.any.forced.pause = false; G.input.sync(); D.step(2);
    ok(G.state === 'pause', 'Esc resumed the game while a controller was missing');
    list[1] = btn([]); G.input.poll(); D.step(2);
    ok(G.state === 'play' && !G.menus.lost.length, 'reconnecting the controller did not resume the game (' + G.state + ')');
    // unplug again; a different, unused controller presses a button and takes over
    list[1] = null; G.input.poll(); D.step(2); ok(G.state === 'pause', 'second unplug did not pause');
    list[2] = btn([2]); G.input.poll(); D.step(2); list[2] = btn([]); G.input.poll(); D.step(2);
    ok(G.state === 'play' && G.players[1].in.dev === 'pad:2' && G.players.length === 2, 'another controller did not take over (' + G.state + ' ' + G.players.map(p => p.in.dev) + ')');
    list[2] = btn([14]); G.input.poll(); ok(held(1).left, 'the new controller does not drive player 2'); list[2] = btn([]); G.input.poll(); D.step(2);
    // a lone player on a pad: the keyboard (unused) takes over
    G.game.removePlayer(G.players[1]); G.game.resetParty(); G.state = 'title'; D.step(1);
    list[2] = btn([0]); G.input.poll(); D.step(2); list[2] = btn([]); G.input.poll(); D.step(2);
    ok(G.state === 'play' && G.players[0].in.dev === 'pad:2', 'player 1 on pad 2 failed to start');
    list[2] = null; G.input.poll(); D.step(2); ok(G.state === 'pause' && /Player 1/.test(draw()), 'player 1\'s pad was unplugged: ' + G.state);
    key('keydown', 'KeyZ'); D.step(2); key('keyup', 'KeyZ'); D.step(2);
    ok(G.state === 'play' && G.players[0].in.dev === 'kb', 'the keyboard did not take over (' + G.state + ' ' + G.players[0].in.dev + ')');
    G.art.label = label; navigator.getGamepads = () => []; G.input.poll();
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 6).join(' | '));
  return 'focus loss and return, unplug pauses and names the player, reconnect and takeover resume';
};
