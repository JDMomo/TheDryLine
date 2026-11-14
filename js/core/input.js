/* Keyboard and gamepads -> per-player action state.
   A state has held[action] and pressed[action]; pressed is true until the end of the step that sees it. */
(() => {
'use strict';
const G = window.G;

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'item', 'heal', 'cycle', 'interact', 'map', 'pause'];
const KEYS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'], attack: ['KeyX', 'KeyJ'], dash: ['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight'], item: ['KeyV', 'KeyL'],
  heal: ['KeyF'], cycle: ['KeyQ', 'KeyE'], interact: ['ArrowUp', 'KeyW'], map: ['Tab'], pause: ['Escape', 'KeyP']
};
const BOUND = new Set(Object.values(KEYS).flat());
const down = new Set();
const pads = [{}, {}, {}, {}];        // raw action state per gamepad index
const padJoin = [false, false, false, false];
const states = new Set();

function raw(s, a) {
  if (s.forced[a]) return true;
  if (s.kb && KEYS[a].some(k => down.has(k))) return true;
  if (s.pad === 'all') return pads.some(p => p[a]);
  return s.pad >= 0 && !!pads[s.pad][a];
}
function sync() {
  for (const s of states) for (const a of ACTIONS) {
    const h = raw(s, a);
    if (h && !s.held[a]) s.pressed[a] = true;
    s.held[a] = h;
  }
}
function readPad(gp, out) {
  const B = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  out.left = ax < -0.4 || B(14); out.right = ax > 0.4 || B(15); out.up = ay < -0.55 || B(12); out.down = ay > 0.55 || B(13);
  out.jump = B(0); out.attack = B(2); out.dash = B(1) || B(7); out.item = B(3); out.heal = B(4); out.cycle = B(5);
  out.interact = out.up; out.map = B(8); out.pause = B(9);
}

// Wording for the prompts and tips, by the device used last (G.input.last): G.input.name('item') -> 'V' or 'Y'.
const NAMES = {
  keyboard: { left: 'Left', right: 'Right', up: 'Up', down: 'Down', jump: 'Z or Space', attack: 'X', dash: 'C or Shift', item: 'V', heal: 'F', cycle: 'Q or E', interact: 'Up', map: 'Tab', pause: 'Esc',
    move: 'Arrows', confirm: 'Z or Space', choose: 'Up and Down' },
  gamepad: { left: 'Left', right: 'Right', up: 'Up', down: 'Down', jump: 'A', attack: 'X', dash: 'B', item: 'Y', heal: 'LB', cycle: 'RB', interact: 'Up', map: 'Back', pause: 'Start',
    move: 'the stick', confirm: 'A', choose: 'the d-pad' }
};

G.input = {
  last: 'keyboard',                       // 'keyboard' or 'gamepad': whichever was used last
  name(action) { return NAMES[G.input.last][action] || action; },
  // opts: { kb: bool, pad: index | 'all' | -1 }
  makeState(opts = {}) {
    const s = { held: {}, pressed: {}, forced: {}, kb: !!opts.kb, pad: opts.pad === undefined ? -1 : opts.pad };
    states.add(s); return s;
  },
  // Read gamepads once per frame.
  poll() {
    let list = [];
    try { list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch (e) { list = []; }
    for (let i = 0; i < 4; i++) {
      const gp = list[i], was = !!pads[i].jump;
      if (gp && gp.connected) { readPad(gp, pads[i]); if (Object.values(pads[i]).some(Boolean)) G.input.last = 'gamepad'; } else pads[i] = {};
      if (pads[i].jump && !was) padJoin[i] = true;
    }
    sync();
  },
  // Index of a gamepad that just pressed Jump and is not used by any player, or -1.
  takeJoin(usedPads) {
    for (let i = 0; i < 4; i++) if (padJoin[i]) { padJoin[i] = false; if (!usedPads.includes(i)) return i; }
    return -1;
  },
  endStep() {
    for (const s of states) for (const a of ACTIONS) s.pressed[a] = false;
    padJoin.fill(false);
  },
  sync
};
// Any device: used by menus.
G.input.any = G.input.makeState({ kb: true, pad: 'all' });

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (BOUND.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  down.add(e.code); G.input.last = 'keyboard'; sync();
});
addEventListener('keyup', e => { down.delete(e.code); sync(); });
addEventListener('blur', () => { down.clear(); sync(); });
})();
