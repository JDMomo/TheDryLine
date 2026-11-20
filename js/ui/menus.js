/* Full-screen overlays: title, pause (a menu: Resume, Restart run, Quit to title, the last two with a confirm step; plus the controls),
   and the end of a run (won or fallen). main.js calls G.menus.open() when the game pauses and G.menus.pauseStep(pressed) every paused step. */
(() => {
'use strict';
const G = window.G, C = G.C, art = G.art;
const W = C.W, H = C.H;
const clock = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function panel(ctx, w, h, y = 0) {
  ctx.fillStyle = 'rgba(6,11,11,0.9)'; ctx.fillRect((W - w) / 2, (H - h) / 2 + y, w, h);
  ctx.strokeStyle = '#3f6b5a'; ctx.lineWidth = 1.5; ctx.strokeRect((W - w) / 2, (H - h) / 2 + y, w, h);
}
const premise = 'The sea is gone, the toll railway is not: carry tokens down the Dry Line and punch the Wardens\' fare slots.';
// The controls tables: what each action is on each kind of device, from the live bindings (so they follow a remap).
const ROWS = [['Move', 'move'], ['Jump', 'jump'], ['Slash', 'attack'], ['Dash', 'dash'], ['Token', 'item'], ['Switch token', 'cycle'], ['Mend (hold)', 'heal'], ['Use, enter', 'interact'], ['Map', 'map'], ['Pause', 'pause']];
function rowsFor(type) {
  const I = G.input;
  return ROWS.map(([name, a]) => [name, a === 'move' ? (type === 'gamepad' ? 'Stick or d-pad' : I.label(type, 'left') + ' ' + I.label(type, 'right') + ' ' + I.label(type, 'up') + ' ' + I.label(type, 'down')) : I.label(type, a)]);
}
function table(ctx, rows, x, y, head) {
  art.label(ctx, head, x, y, 13.5, '#e9a23b', 'left', C.FONT, 600);
  rows.forEach((r, i) => { art.label(ctx, r[0], x, y + 22 + i * 19, 12.5, '#9aa89f', 'left'); art.label(ctx, r[1], x + 104, y + 22 + i * 19, 12.5, '#e9e2cf', 'left'); });
}
const tokenName = id => (G.itemDefs[id] && G.itemDefs[id].name) || id;
const cutLabel = c => (G.CLASSES[c] && G.CLASSES[c].name.toLowerCase()) || c;

// The pause menu. Up and Down choose, Jump confirms, Esc resumes. Restart and Quit ask once more. Slash does nothing here.
// Controls: every action for the device that opened the menu, rebound with a keypress; Comfort: screen shake and reduced flashes.
const menu = { sel: 0, confirm: false, page: 'main', dev: null, type: 'keyboard', msg: '', ok: true, capture: null, skip: false };
const items = ['Resume', 'Controls', 'Comfort', 'Restart run', 'Quit to title'];
const CTRL_ROWS = [...G.input.ACTIONS, 'reset', 'back'];
const COMFORT_ROWS = ['shake', 'flash', 'back'];
const comfortText = i => i === 0 ? 'Screen shake: ' + (G.meta.settings.shake ? 'On' : 'Off') : i === 1 ? 'Reduced flashes: ' + (G.meta.settings.reduceFlashes ? 'On' : 'Off') : 'Back';

function startCapture(action) {
  menu.capture = action; menu.msg = '';
  G.input.capture(menu.type, menu.type === 'gamepad' ? menu.dev : undefined, (type, code) => {
    menu.capture = null; menu.skip = true;
    if (code === G.input.RESERVED[type]) { menu.msg = 'Cancelled. ' + (type === 'keyboard' ? 'Esc' : 'Start') + ' always pauses.'; menu.ok = false; return true; }
    const r = G.input.bind(type, action, code); menu.msg = r.msg; menu.ok = r.ok; return true;
  });
}
function controlsStep(pr) {
  if (menu.skip) { menu.skip = false; return; }
  if (menu.capture) return;
  const n = CTRL_ROWS.length;
  if (pr.pause) { menu.page = 'main'; menu.sel = 1; menu.msg = ''; return; }
  if (pr.up || pr.down) { menu.sel = (menu.sel + (pr.down ? 1 : n - 1)) % n; menu.msg = ''; }
  else if (pr.jump) {
    const row = CTRL_ROWS[menu.sel];
    if (row === 'back') { menu.page = 'main'; menu.sel = 1; menu.msg = ''; }
    else if (row === 'reset') { G.input.resetBindings(menu.type); menu.msg = 'Controls reset to defaults.'; menu.ok = true; }
    else if (row === 'interact') { menu.msg = 'Use and enter are the Up binding: rebind Up.'; menu.ok = false; }
    else startCapture(row);
  }
}
function comfortStep(pr) {
  if (pr.pause) { menu.page = 'main'; menu.sel = 2; return; }
  const n = COMFORT_ROWS.length;
  if (pr.up || pr.down) menu.sel = (menu.sel + (pr.down ? 1 : n - 1)) % n;
  else if (pr.jump) {
    const row = COMFORT_ROWS[menu.sel], st = G.meta.settings;
    if (row === 'back') { menu.page = 'main'; menu.sel = 2; }
    else { if (row === 'shake') st.shake = !st.shake; else st.reduceFlashes = !st.reduceFlashes; G.game.saveMeta(); }
  }
}

G.menus = {
  menu,
  items,
  lost: [],                // indices of players whose controller is gone (main.js keeps it up to date); lostPause: the pause came from that
  lostPause: false,
  // dev: the device that opened the menu ('kb' or 'pad:N'); the Controls page edits that kind of device.
  open(dev) { menu.sel = 0; menu.confirm = false; menu.page = 'main'; menu.msg = ''; menu.capture = null; menu.skip = false; G.input.stopCapture(); menu.dev = dev || 'kb'; menu.type = G.input.typeOf(menu.dev); },
  // One step of the pause menu (main.js calls it while the state is 'pause'). pr: the pressed actions of any device.
  pauseStep(pr) {
    if (menu.page === 'controls') return controlsStep(pr);
    if (menu.page === 'comfort') return comfortStep(pr);
    const lost = G.menus.lost.length > 0;
    if (pr.pause) { if (menu.confirm) menu.confirm = false; else if (!lost) G.state = 'play'; return; }       // Esc backs out of a confirm first; while a controller is missing the game stays paused
    if (pr.up || pr.down) { const n = items.length; menu.sel = (menu.sel + (pr.down ? 1 : n - 1)) % n; menu.confirm = false; }
    else if (pr.attack || pr.dash || pr.map) menu.confirm = false;
    else if (pr.jump) {
      if (menu.sel === 0) { if (!lost) G.state = 'play'; }
      else if (menu.sel === 1) { menu.page = 'controls'; menu.sel = 0; menu.msg = ''; }
      else if (menu.sel === 2) { menu.page = 'comfort'; menu.sel = 0; }
      else if (!menu.confirm) menu.confirm = true;
      else {
        menu.confirm = false;
        if (menu.sel === 3) { G.game.newRun(G.run.code); G.state = 'play'; }
        else { G.game.resetParty(); G.state = 'title'; }
      }
    }
  },
  title(ctx) {
    const on = G.ui.on();
    if (on) G.world.backdrop(ctx, 'hub', G.time * 12, 0, G.time); else art.backdrop(ctx, art.palette('hub'), G.time * 12, G.time);
    ctx.fillStyle = 'rgba(6,11,11,0.6)'; ctx.fillRect(0, 0, W, H);
    if (on) { G.ui.paper(ctx, 36, 8, W - 72, H - 12, 'page'); G.ui.title(ctx, W / 2, 68, 440); }      // a parchment page, the lettering in brush script
    else art.label(ctx, G.title.name && G.title.name !== 'Untitled' ? G.title.name : 'The Dry Line', W / 2, 62, 54, '#e9a23b', 'center', C.DISPLAY, 600);
    art.label(ctx, premise, W / 2, on ? 124 : 106, 14, '#e9e2cf');
    if (Math.floor(G.time * 2) % 2) art.label(ctx, 'Click here, then press any button on the keyboard or a controller to begin: that device is player 1', W / 2, on ? 150 : 146, 16, '#e9e2cf');
    panel(ctx, 640, 244, 14);
    table(ctx, rowsFor('keyboard'), 170, 188, 'Keyboard');
    table(ctx, rowsFor('gamepad'), 520, 188, 'Gamepad');
    art.label(ctx, 'Players 2 to 4: at the Junction, press Jump on any other device (keyboard or controller). Hold Pause for 1 second there to leave.', W / 2, 428, 13, '#e9e2cf');
    art.label(ctx, 'The party carries three tokens. Each Warden has three fare slots, set by the lock chart; a punched token is void.', W / 2, 452, 13, '#9aa89f');
    const m = G.meta;
    art.label(ctx, 'Runs ' + m.runs + '   ·   Wins ' + m.wins + (m.best !== null ? '   ·   Best ' + clock(m.best) : '') + '   ·   Cuts punched ' + m.cuts.length + ' of 4', W / 2, H - 40, 13, '#9aa89f');
  },
  pause(ctx) {
    const PH = 520;
    ctx.fillStyle = 'rgba(6,11,11,0.6)'; ctx.fillRect(0, 0, W, H); panel(ctx, 640, PH);
    const top = (H - PH) / 2, N = a => G.input.name(a, menu.type), lost = G.menus.lost;
    const row = (t, i, y, on) => {
      if (on) { ctx.fillStyle = 'rgba(233,162,59,0.18)'; ctx.fillRect(W / 2 - 220, y - 11, 440, 22); ctx.strokeStyle = '#e9a23b'; ctx.lineWidth = 1.5; ctx.strokeRect(W / 2 - 220, y - 11, 440, 22); }
      art.label(ctx, (on ? '> ' : '') + t + (on ? ' <' : ''), W / 2, y, on ? 15 : 14, on ? '#fff3c4' : '#9aa89f', 'center', C.FONT, on ? 600 : 500);
    };
    if (menu.page === 'controls') {
      const type = menu.type, rows = CTRL_ROWS, L = G.input.label;
      art.label(ctx, 'Controls: ' + (type === 'keyboard' ? 'keyboard' : 'gamepad'), W / 2, top + 30, 24, '#e9a23b', 'center', C.DISPLAY, 600);
      rows.forEach((r, i) => {
        const y = top + 62 + i * 22, on = menu.sel === i;
        if (r === 'reset') return row('Reset to defaults' + (G.input.isDefault(type) ? ' (already)' : ''), i, y + 4, on);
        if (r === 'back') return row('Back', i, y + 4, on);
        if (on) { ctx.fillStyle = 'rgba(233,162,59,0.18)'; ctx.fillRect(W / 2 - 220, y - 11, 440, 22); ctx.strokeStyle = '#e9a23b'; ctx.lineWidth = 1.5; ctx.strokeRect(W / 2 - 220, y - 11, 440, 22); }
        art.label(ctx, G.input.ACTION_NAMES[r].replace(' (same as Up)', ''), W / 2 - 200, y, 13.5, on ? '#fff3c4' : '#9aa89f', 'left');
        const val = menu.capture === r ? (type === 'keyboard' ? 'Press a key (Esc cancels)' : 'Press a button (Start cancels)') : r === 'interact' ? 'same as Up: ' + L(type, 'up') : L(type, r);
        art.label(ctx, val, W / 2 + 200, y, 13.5, menu.capture === r ? '#e9a23b' : '#e9e2cf', 'right', C.FONT, 600);
      });
      if (menu.msg) art.label(ctx, menu.msg, W / 2, top + PH - 52, 13.5, menu.ok ? '#9fd6a8' : '#ff9f8a', 'center', C.FONT, 600);
      art.label(ctx, 'Saved for every ' + (type === 'keyboard' ? 'keyboard' : 'controller') + '. ' + N('choose') + ' to choose, ' + N('confirm') + ' to change, ' + N('pause') + ' to go back', W / 2, top + PH - 26, 12.5, '#9aa89f');
      return;
    }
    if (menu.page === 'comfort') {
      art.label(ctx, 'Comfort', W / 2, top + 34, 28, '#e9a23b', 'center', C.DISPLAY, 600);
      COMFORT_ROWS.forEach((r, i) => row(comfortText(i), i, top + 100 + i * 40, menu.sel === i));
      art.label(ctx, 'Screen shake off: the camera never shakes. Reduced flashes: no blinking while hurt, softer hit flashes.', W / 2, top + 250, 12.5, '#9aa89f');
      art.label(ctx, N('choose') + ' to choose, ' + N('confirm') + ' to switch, ' + N('pause') + ' to go back', W / 2, top + PH - 26, 12.5, '#9aa89f');
      return;
    }
    art.label(ctx, 'Paused', W / 2, top + 34, 28, '#e9a23b', 'center', C.DISPLAY, 600);
    items.forEach((t, i) => row(t, i, top + 78 + i * 30, menu.sel === i));
    const warn = menu.confirm ? (menu.sel === 3 ? 'Restart this run code from the start? ' : 'Quit to the title? This run is lost. ') + N('confirm') + ' again to confirm, ' + N('pause') + ' to cancel' : '';
    if (warn) art.label(ctx, warn, W / 2, top + 78 + items.length * 30 + 2, 13.5, '#e9a23b', 'center', C.FONT, 600);
    if (lost.length) art.label(ctx, lost.map(i => 'Player ' + (i + 1)).join(' and ') + (lost.length > 1 ? ': controllers disconnected.' : ': controller disconnected.') + ' Reconnect it, or press a button on another device to take over.', W / 2, top + 78 + items.length * 30 + 2, 13.5, '#ff9f8a', 'center', C.FONT, 600);
    table(ctx, rowsFor('keyboard'), 170, top + 252, 'Keyboard');
    table(ctx, rowsFor('gamepad'), 520, top + 252, 'Gamepad');
    art.label(ctx, 'Menu: ' + N('choose') + ' to choose, ' + N('confirm') + ' to confirm, ' + N('pause') + ' to resume', W / 2, top + PH - 52, 12.5, '#9aa89f');
    art.label(ctx, 'Run code ' + G.run.code + '   ·   Time ' + clock(G.run.time) + '   ·   ' + Math.floor(G.run.shards) + ' scrip', W / 2, top + PH - 28, 13, '#e9e2cf');
  },
  over(ctx) {
    const run = G.run, won = run.over === 'win', log = run.punchLog || [];
    const shown = Math.min(5, log.length), nGraded = Object.keys(run.grades || {}).length, ph = 76 + 72 + 22 * nGraded + 20 * shown + (log.length > 5 ? 24 : 0) + 28 + 24 + 70, top = (H - ph) / 2;
    ctx.fillStyle = 'rgba(6,11,11,0.72)'; ctx.fillRect(0, 0, W, H); panel(ctx, 700, ph);
    art.label(ctx, won ? G.title.winText : G.title.loseText, W / 2, top + 36, 30, won ? '#e9a23b' : '#e9e2cf', 'center', C.DISPLAY, 600);
    const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), fallen = order.filter(r => run.beaten[r.id]);
    const names = fallen.map(r => (G.bossDefs[r.boss] ? G.bossDefs[r.boss].name : r.name));
    let y = top + 76;
    const line = (t, col = '#e9e2cf', size = 14.5) => { art.label(ctx, t, W / 2, y, size, col); y += 24; };
    line('Time ' + clock(run.time) + '   ·   Scrip ' + Math.floor(run.shards) + '   ·   Hits taken ' + run.stats.hits);
    line('Wardens beaten ' + fallen.length + ' of ' + order.length + (names.length ? ': ' + names.join(', ') : ''));
    for (const r of fallen) {                                   // each boss's grade: Beaten, Par (under its par time), Clean (no hits taken)
      const g = (run.grades || {})[r.id], b = G.bossDefs[r.boss];
      if (!g) continue;
      art.label(ctx, (b ? b.name : r.name) + ':  ' + G.game.gradeText(g) + '  (' + clock(g.time) + (g.parTime ? ', par ' + clock(g.parTime) : '') + ')', W / 2, y, 13, g.clean ? '#fff3c4' : '#e9e2cf'); y += 22;
    }
    line('Tokens punched ' + log.length + (log.length ? '' : ' (every fare slot stayed shut)'));
    log.slice(0, 5).forEach(l => {
      const r = G.regionDefs[l.region];
      const x0 = W / 2 - 250;
      ctx.save(); ctx.translate(x0, y); ctx.fillStyle = (G.CLASSES[l.cut] || {}).color || '#888'; art.cutShape(ctx, (G.CLASSES[l.cut] || {}).shape || 'slab', 6); ctx.restore();
      art.label(ctx, (l.item ? tokenName(l.item) : 'A token') + ' (' + cutLabel(l.cut) + ') into ' + (l.slot || 'a fare slot') + (l.boss ? ', ' + l.boss : '') + (r ? ' in ' + r.name : ''), x0 + 16, y, 13, '#e9e2cf', 'left');
      y += 20;
    });
    if (log.length > 5) line('and ' + (log.length - 5) + ' more', '#9aa89f', 12.5);
    y += 4;
    const un = (run.unlocked || []).map(tokenName);
    if (un.length) line('New tokens unlocked: ' + un.join(', '), '#e9a23b');
    else line('Punch a fare slot of a cut for the first time to unlock its rare tokens.', '#9aa89f', 12.5);
    art.label(ctx, 'Run code ' + run.code, W / 2, y + 8, 14, '#9aa89f');
    art.label(ctx, 'Press Jump for a new run', W / 2, y + 38, 14, '#e9e2cf');
  }
};

})();
