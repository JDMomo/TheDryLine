// The pause screen is a clear menu (Resume, Restart run, Quit to title): holding Down and tapping Slash does nothing, Restart and Quit ask
// for a confirm, the selected entry is highlighted, the menu's controls are shown, and losing the window's focus pauses the game.
export default async ({ page }) => {
  const res = await page.evaluate(async () => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const hold = (a, on) => { G.input.any.forced[a] = on; G.input.sync(); };
    const press = a => { hold(a, true); D.step(1); hold(a, false); D.step(2); };
    const open = () => { G.state = 'play'; hold('pause', true); D.step(1); hold('pause', false); D.step(2); };
    G.artTest = false; D.newRun(5); D.step(30);
    const seed = G.run.seed, M = G.menus.menu;
    ok(JSON.stringify(G.menus.items) === JSON.stringify(['Resume', 'Controls', 'Comfort', 'Restart run', 'Quit to title']), 'menu entries: ' + G.menus.items);
    open(); ok(G.state === 'pause' && M.sel === 0 && !M.confirm, 'pause opens on Resume');
    // the old accident: Down held, Slash tapped
    hold('down', true); D.step(2); press('attack'); press('attack'); hold('down', false); D.step(2);
    ok(G.state === 'pause', 'Down + Slash left the pause screen: ' + G.state);
    ok(G.run && G.run.seed === seed, 'the run was lost');
    ok(M.sel === 1, 'Down moved the selection one entry (sel ' + M.sel + ')');
    M.sel = 0; M.confirm = false;
    // keys that are not menu keys do nothing
    for (const a of ['attack', 'dash', 'item', 'heal', 'left', 'right']) press(a);
    ok(G.state === 'pause' && M.sel === 0, 'a stray key changed the menu');
    // wrap around and highlight
    press('up'); ok(M.sel === 4, 'Up from Resume goes to Quit (sel ' + M.sel + ')'); press('down'); ok(M.sel === 0, 'Down from Quit wraps to Resume');
    // restart: select, confirm step, Esc cancels, confirm again restarts the same seed
    for (let i = 0; i < 3; i++) press('down'); ok(M.sel === 3, 'Restart is the fourth entry'); press('jump'); ok(M.confirm && G.state === 'pause', 'Restart asks to confirm');
    press('pause'); ok(!M.confirm && G.state === 'pause', 'Esc cancels the confirm and stays paused');
    press('jump'); press('jump'); ok(G.state === 'play' && G.run.seed === seed && G.run.time < 0.3, 'Restart run restarts the same seed (' + G.state + ')');
    // quit: two presses of Jump, and only then the title
    D.step(30); open(); for (let i = 0; i < 4; i++) press('down'); ok(M.sel === 4, 'Quit is the fifth entry');
    press('jump'); ok(G.state === 'pause' && M.confirm, 'Quit asks to confirm (' + G.state + ')');
    press('down'); ok(!M.confirm, 'moving the selection drops the confirm');
    M.sel = 4; M.confirm = false; press('jump'); ok(M.confirm && G.state === 'pause', 'second try: confirm (' + G.state + ' ' + M.confirm + ')'); press('jump'); ok(G.state === 'title', 'Quit to title goes to the title (' + G.state + ')');
    // resume
    D.newRun(5); open(); press('jump'); ok(G.state === 'play', 'Resume resumes');
    // Esc resumes too
    open(); press('pause'); ok(G.state === 'play', 'Esc resumes');
    // losing focus pauses; so does a hidden tab; not on the title or after the run is over
    G.state = 'play'; window.dispatchEvent(new Event('blur')); ok(G.state === 'pause', 'losing focus pauses (' + G.state + ')');
    ok(M.sel === 0 && !M.confirm, 'the auto pause opens on Resume');
    G.state = 'play'; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    ok(G.state === 'pause', 'a hidden tab pauses'); delete document.hidden;
    G.state = 'title'; window.dispatchEvent(new Event('blur')); ok(G.state === 'title', 'blur on the title does nothing');
    G.state = 'play'; G.run.over = 'dead'; window.dispatchEvent(new Event('blur')); ok(G.state === 'play', 'blur after the run is over does nothing'); G.run.over = null;
    // drawing: the selected entry is highlighted, the controls of the menu are named, for both devices
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    const texts = [];
    const label = G.art.label; G.art.label = (c, t, ...r) => { texts.push(t); return label.call(G.art, c, t, ...r); };
    const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    const shot = sel => { G.state = 'pause'; M.sel = sel; M.confirm = false; ctx.setTransform(1, 0, 0, 1, 0, 0); G.rooms.draw(ctx, 0); G.menus.pause(ctx); return [0, 1, 2].map(i => px(480 - 140, (544 - 490) / 2 + 78 + i * 30 - 8)); };
    const a = shot(0), b = shot(1);
    const warm = c => c[0] - c[2];
    ok(warm(a[0]) > warm(a[1]) + 8 && warm(b[1]) > warm(b[0]) + 8, 'the selected row is not highlighted: ' + JSON.stringify([a, b]));
    for (const dev of ['keyboard', 'gamepad']) {
      M.type = dev; texts.length = 0; shot(3); M.confirm = true; G.menus.pause(ctx);
      const all = texts.join(' | ');
      ok(/Resume/.test(all) && /Restart run/.test(all) && /Quit to title/.test(all), dev + ': entries missing');
      ok(/choose/.test(all) && /confirm/.test(all) && /resume/.test(all), dev + ': the menu controls are not shown');
      ok(dev === 'keyboard' ? /Z or Space to confirm/.test(all) : /A to confirm/.test(all), dev + ': wording does not match the device: ' + all.slice(0, 300));
      ok(/again to confirm/.test(all), dev + ': no confirm line');
    }
    M.type = 'keyboard'; G.art.label = label; G.state = 'play';
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 5).join(' | '));
  return 'menu, confirm steps, no accidental quit, auto pause';
};
