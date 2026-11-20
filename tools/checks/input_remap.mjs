// Remapping through the pause menu's Controls page: lists every action for the device that opened the menu, rebinds with a keypress or button press,
// refuses duplicates with a message, resets to defaults, saves per device type in the meta save (survives a reload), and prompts follow the new names.
export default async ({ page }) => {
  const run = () => page.evaluate(() => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const btn = set => ({ id: 'stub pad', connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: set.includes(i) })) });
    const list = [btn([])]; navigator.getGamepads = () => list;
    const key = (type, code, extra = {}) => window.dispatchEvent(new KeyboardEvent(type, Object.assign({ code, key: code, bubbles: true }, extra)));
    const hold = (a, on) => { G.input.any.forced[a] = on; G.input.sync(); };
    const press = a => { hold(a, true); D.step(1); hold(a, false); D.step(2); };
    const M = G.menus.menu, texts = [], ctx = document.createElement('canvas').getContext('2d'), label = G.art.label;
    G.art.label = (c, t, ...r) => { texts.push(String(t)); return label.call(G.art, c, t, ...r); };
    const draw = () => { texts.length = 0; ctx.canvas.width = 960; ctx.canvas.height = 544; G.rooms.draw(ctx, 0); G.menus.pause(ctx); return texts.join(' | '); };
    const goto = row => { const rows = [...G.input.ACTIONS, 'reset', 'back']; while (rows[M.sel] !== row) press('down'); };
    D.newRun(5); D.god(true); D.step(10);
    G.state = 'pause'; G.menus.open('kb');
    ok(M.type === 'keyboard', 'the keyboard opened the menu but the page edits ' + M.type);
    press('down'); press('jump'); ok(M.page === 'controls', 'Controls entry did not open the controls page: ' + M.page);
    let t = draw();
    for (const a of ['Move left', 'Move right', 'Jump', 'Slash', 'Dash', 'Use token', 'Mend', 'Switch token', 'Use, enter', 'Map', 'Pause', 'Reset to defaults'])
      ok(t.includes(a), 'the controls page does not list "' + a + '"');
    ok(t.includes('Z or Space'), 'the jump keys are not shown: ' + t.slice(0, 200));
    // rebind Jump to B by a real keypress
    goto('jump'); press('jump'); ok(M.capture === 'jump', 'Jump did not start listening for a key');
    ok(/Press a key/.test(draw()), 'no "Press a key" prompt');
    key('keydown', 'KeyB'); key('keyup', 'KeyB'); D.step(2);
    ok(!M.capture && /now B/.test(M.msg) && G.input.label('keyboard', 'jump') === 'B', 'Jump was not rebound to B: "' + M.msg + '" ' + G.input.label('keyboard', 'jump'));
    key('keydown', 'KeyB'); ok(G.players[0].in.held.jump, 'the new Jump key does nothing'); key('keyup', 'KeyB');
    key('keydown', 'KeyZ'); ok(!G.players[0].in.held.jump, 'the old Jump key still jumps'); key('keyup', 'KeyZ');
    // a duplicate is refused with a clear message
    goto('attack'); press('jump'); key('keydown', 'KeyB'); key('keyup', 'KeyB'); D.step(2);
    ok(/already used for Jump/.test(M.msg) && !M.ok, 'a duplicate was not refused clearly: "' + M.msg + '"');
    ok(G.input.label('keyboard', 'attack') === 'X or J', 'a refused rebind changed the binding: ' + G.input.label('keyboard', 'attack'));
    ok(/already used for Jump/.test(draw()), 'the refusal is not on screen');
    // Esc cancels, and is not a target
    goto('attack'); press('jump'); key('keydown', 'Escape'); D.step(2); ok(!M.capture && G.input.label('keyboard', 'attack') === 'X or J', 'Esc did not cancel the rebind');
    ok(!G.input.bind('keyboard', 'map', 'Escape').ok, 'Esc was accepted as a binding');
    // prompts and tips use the new names
    G.input.last = 'keyboard';
    ok(G.input.name('jump', G.players[0]) === 'B' && G.input.name('confirm', G.players[0]) === 'B', 'names do not follow the remap: ' + G.input.name('jump', G.players[0]));
    ok(G.input.bind('keyboard', 'item', 'KeyG').ok, 'could not rebind the token key');
    ok(/^G uses your token/.test(G.tips.text('token')), 'the token tip does not use the new key: ' + G.tips.text('token'));
    ok(G.input.bind('keyboard', 'up', 'KeyY').ok && G.input.name('interact', G.players[0]) === 'Y', 'Use / enter does not follow Up');
    ok(G.input.bind('keyboard', 'down', 'KeyN').ok && /hold N/.test(G.tips.text('bounce')), 'the bounce tip does not follow the remapped Down key: ' + G.tips.text('bounce'));
    // a prompt at a prop shows the new key
    const node = Object.values(G.run.graph.nodes).find(n => G.worldgen.contents(n).some(c => c.type === 'plinth' && c.data.price));
    D.gotoRoom(node.id); D.step(2); G.state = 'play'; G.run.shards = 400;
    const w = D.state().room.props.find(q => q.type === 'plinth' && q.data.price); D.place(0, w.x, w.y); D.step(3);
    ok(/^Y to buy for/.test((() => { texts.length = 0; G.rooms.draw(ctx, 0); return texts.find(x => /to buy for/.test(x)) || ''; })()), 'the kiosk prompt does not name the remapped key: ' + texts.filter(x => /buy|take|Up/.test(x)).join(' | '));
    // gamepad bindings are separate
    ok(G.input.bind('gamepad', 'jump', 6).ok && G.input.label('gamepad', 'jump') === 'LT' && G.input.label('keyboard', 'jump') === 'B', 'gamepad and keyboard bindings are not separate');
    ok(!G.input.bind('gamepad', 'attack', 6).ok, 'a duplicate pad button was accepted');
    const saved = JSON.parse(localStorage.getItem('dryline-meta-v1'));
    ok(saved.bindings.keyboard.jump[0] === 'KeyB' && saved.bindings.gamepad.jump[0] === 6, 'the bindings are not in the meta save: ' + JSON.stringify(saved.bindings));
    // a pad opens the menu: the page lists the pad's buttons and a button press rebinds
    G.state = 'pause'; G.menus.open('pad:0'); ok(M.type === 'gamepad', 'a pad opened the menu but the page edits ' + M.type);
    press('down'); press('jump'); goto('dash'); press('jump'); ok(M.capture === 'dash', 'the pad page did not listen');
    ok(/Press a button/.test(draw()) && /LT/.test(draw()), 'the pad page does not list buttons: ' + draw().slice(0, 300));
    list[0] = btn([10]); G.input.poll(); list[0] = btn([]); G.input.poll(); D.step(3);
    ok(G.input.label('gamepad', 'dash') === 'L3' && M.page === 'controls', 'a pad button did not rebind Dash: ' + G.input.label('gamepad', 'dash') + ' ' + M.msg);
    // reset to defaults, for the device that opened the menu only
    goto('reset'); press('jump');
    ok(G.input.label('gamepad', 'jump') === 'A' && G.input.label('gamepad', 'dash') === 'B' && G.input.label('keyboard', 'jump') === 'B', 'reset did not restore the pad only');
    G.state = 'pause'; G.menus.open('kb'); press('down'); press('jump'); goto('reset'); press('jump');
    ok(G.input.label('keyboard', 'jump') === 'Z or Space' && G.input.label('keyboard', 'up') === 'Up or W' && G.input.label('keyboard', 'item') === 'V or L', 'reset to defaults did not restore the keyboard: ' + G.input.label('keyboard', 'jump'));
    // leave one remap saved for the reload test
    ok(G.input.bind('keyboard', 'heal', 'KeyH').ok, 'bind heal'); G.art.label = label; G.state = 'play';
    return bad;
  });
  const bad = await run();
  if (bad.length) throw new Error(bad.slice(0, 6).join(' | '));
  await page.reload(); await page.waitForFunction(() => window.G && window.G.debug);
  const after = await page.evaluate(() => ({ b: G.meta.bindings, h: G.input.label('keyboard', 'heal'), j: G.input.label('keyboard', 'jump') }));
  if (after.h !== 'H' || after.j !== 'Z or Space') throw new Error('the remap did not survive a reload: ' + JSON.stringify(after));
  // blocked storage: remapping still works in memory and does not throw
  const blocked = await page.evaluate(() => { const g = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('quota'); }; const r = G.input.bind('keyboard', 'map', 'KeyM'); Storage.prototype.setItem = g; return r.ok && G.input.label('keyboard', 'map') === 'M'; });
  if (!blocked) throw new Error('remapping failed when the storage is blocked');
  await page.evaluate(() => { G.input.resetBindings('keyboard'); });
  return 'controls page for keyboard and pad, duplicates refused, reset, saved per device type, survives reload, prompts follow';
};
