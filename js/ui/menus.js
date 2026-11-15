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
const KEYBOARD = [['Move', 'Arrows or WASD'], ['Jump', 'Z or Space'], ['Slash', 'X or J'], ['Dash', 'C, K or Shift'], ['Token', 'V or L (switch Q, E)'],
  ['Mend', 'Hold F'], ['Use, enter', 'Up'], ['Map', 'Tab'], ['Pause', 'Esc or P']];
const GAMEPAD = [['Move', 'Stick or d-pad'], ['Jump', 'A'], ['Slash', 'X'], ['Dash', 'B or RT'], ['Token', 'Y (switch RB)'],
  ['Mend', 'Hold LB'], ['Use, enter', 'Up'], ['Map', 'Back'], ['Pause', 'Start']];
function table(ctx, rows, x, y, head) {
  art.label(ctx, head, x, y, 13.5, '#e9a23b', 'left', C.FONT, 600);
  rows.forEach((r, i) => { art.label(ctx, r[0], x, y + 22 + i * 19, 12.5, '#9aa89f', 'left'); art.label(ctx, r[1], x + 84, y + 22 + i * 19, 12.5, '#e9e2cf', 'left'); });
}
const tokenName = id => (G.itemDefs[id] && G.itemDefs[id].name) || id;
const cutLabel = c => (G.CLASSES[c] && G.CLASSES[c].name.toLowerCase()) || c;

// The pause menu. Up and Down choose, Jump confirms, Esc resumes. Restart and Quit ask once more. Slash does nothing here.
const menu = { sel: 0, confirm: false };
const items = ['Resume', 'Restart run', 'Quit to title'];

G.menus = {
  menu,
  items,
  open() { menu.sel = 0; menu.confirm = false; },
  // One step of the pause menu (main.js calls it while the state is 'pause'). pr: the pressed actions of any device.
  pauseStep(pr) {
    if (pr.pause) { if (menu.confirm) menu.confirm = false; else G.state = 'play'; return; }       // Esc backs out of a confirm first
    if (pr.up || pr.down) { const n = items.length; menu.sel = (menu.sel + (pr.down ? 1 : n - 1)) % n; menu.confirm = false; }
    else if (pr.attack || pr.dash || pr.map) menu.confirm = false;
    else if (pr.jump) {
      if (menu.sel === 0) G.state = 'play';
      else if (!menu.confirm) menu.confirm = true;
      else {
        menu.confirm = false;
        if (menu.sel === 1) { G.game.newRun(G.run.code); G.state = 'play'; }
        else { G.state = 'title'; }
      }
    }
  },
  title(ctx) {
    art.backdrop(ctx, art.palette('hub'), G.time * 12, G.time);
    ctx.fillStyle = 'rgba(6,11,11,0.6)'; ctx.fillRect(0, 0, W, H);
    art.label(ctx, G.title.name && G.title.name !== 'Untitled' ? G.title.name : 'The Dry Line', W / 2, 62, 54, '#e9a23b', 'center', C.DISPLAY, 600);
    art.label(ctx, premise, W / 2, 106, 14, '#e9e2cf');
    if (Math.floor(G.time * 2) % 2) art.label(ctx, 'Click here, then press Jump (Z, Space or controller A) to begin', W / 2, 146, 16, '#e9e2cf');
    panel(ctx, 640, 212, -2);
    table(ctx, KEYBOARD, 170, 188, 'Keyboard (player 1)');
    table(ctx, GAMEPAD, 520, 188, 'Gamepad');
    art.label(ctx, 'Players 2 to 4: plug in a controller and press A (Jump) on it while the party is at the Junction.', W / 2, 402, 13, '#e9e2cf');
    art.label(ctx, 'The party carries three tokens. Each Warden has three fare slots, set by the lock chart; a punched token is void.', W / 2, 426, 13, '#9aa89f');
    const m = G.meta;
    art.label(ctx, 'Runs ' + m.runs + '   ·   Wins ' + m.wins + (m.best !== null ? '   ·   Best ' + clock(m.best) : '') + '   ·   Cuts punched ' + m.cuts.length + ' of 4', W / 2, H - 40, 13, '#9aa89f');
  },
  pause(ctx) {
    ctx.fillStyle = 'rgba(6,11,11,0.6)'; ctx.fillRect(0, 0, W, H); panel(ctx, 640, 440);
    const top = (H - 440) / 2, N = G.input.name;
    art.label(ctx, 'Paused', W / 2, top + 34, 28, '#e9a23b', 'center', C.DISPLAY, 600);
    items.forEach((t, i) => {
      const on = menu.sel === i, y = top + 80 + i * 34;
      if (on) { ctx.fillStyle = 'rgba(233,162,59,0.18)'; ctx.fillRect(W / 2 - 150, y - 15, 300, 30); ctx.strokeStyle = '#e9a23b'; ctx.lineWidth = 1.5; ctx.strokeRect(W / 2 - 150, y - 15, 300, 30); }
      art.label(ctx, (on ? '> ' : '') + t + (on ? ' <' : ''), W / 2, y, 17, on ? '#fff3c4' : '#9aa89f', 'center', C.FONT, on ? 600 : 500);
    });
    const warn = menu.confirm ? (menu.sel === 1 ? 'Restart this run code from the start? ' : 'Quit to the title? This run is lost. ') + N('confirm') + ' again to confirm, ' + N('pause') + ' to cancel' : '';
    if (warn) art.label(ctx, warn, W / 2, top + 80 + items.length * 34 + 6, 13.5, '#e9a23b', 'center', C.FONT, 600);
    table(ctx, KEYBOARD, 170, top + 196, 'Keyboard');
    table(ctx, GAMEPAD, 520, top + 196, 'Gamepad');
    art.label(ctx, 'Menu: ' + N('choose') + ' to choose, ' + N('confirm') + ' to confirm, ' + N('pause') + ' to resume', W / 2, top + 400, 12.5, '#9aa89f');
    art.label(ctx, 'Run code ' + G.run.code + '   ·   Time ' + clock(G.run.time) + '   ·   ' + Math.floor(G.run.shards) + ' scrip', W / 2, top + 422, 13, '#e9e2cf');
  },
  over(ctx) {
    const run = G.run, won = run.over === 'win', log = run.punchLog || [];
    const shown = Math.min(5, log.length), ph = 76 + 72 + 20 * shown + (log.length > 5 ? 24 : 0) + 28 + 24 + 70, top = (H - ph) / 2;
    ctx.fillStyle = 'rgba(6,11,11,0.72)'; ctx.fillRect(0, 0, W, H); panel(ctx, 700, ph);
    art.label(ctx, won ? G.title.winText : G.title.loseText, W / 2, top + 36, 30, won ? '#e9a23b' : '#e9e2cf', 'center', C.DISPLAY, 600);
    const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), fallen = order.filter(r => run.beaten[r.id]);
    const names = fallen.map(r => (G.bossDefs[r.boss] ? G.bossDefs[r.boss].name : r.name));
    let y = top + 76;
    const line = (t, col = '#e9e2cf', size = 14.5) => { art.label(ctx, t, W / 2, y, size, col); y += 24; };
    line('Time ' + clock(run.time) + '   ·   Scrip ' + Math.floor(run.shards) + '   ·   Hits taken ' + run.stats.hits);
    line('Wardens beaten ' + fallen.length + ' of ' + order.length + (names.length ? ': ' + names.join(', ') : ''));
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
