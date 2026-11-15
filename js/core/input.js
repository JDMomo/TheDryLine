/* Devices -> per-player action state.
   A device is the keyboard ('kb') or one gamepad ('pad:<index>'). Each player owns exactly one device (p.in.dev); the keyboard counts as one device.
   A state has held[action] and pressed[action]; pressed is true until the end of the step that sees it. `forced` is for tests and tools (G.debug.setInput).
   Bindings: defaults below, overridden per device type ('keyboard', 'gamepad') by G.meta.bindings (set with G.input.bind, saved in the meta save).
   Raw key codes and navigator.getGamepads live in this file only. */
(() => {
'use strict';
const G = window.G;

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'item', 'heal', 'cycle', 'interact', 'map', 'pause'];
// interact is not bound on its own: it is whatever Up is (Up and Use are the same press, as they always were).
const REBINDABLE = ACTIONS.filter(a => a !== 'interact');
const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'], attack: ['KeyX', 'KeyJ'], dash: ['KeyC', 'ShiftLeft', 'ShiftRight', 'KeyK'], item: ['KeyV', 'KeyL'],
  heal: ['KeyF'], cycle: ['KeyQ', 'KeyE'], map: ['Tab'], pause: ['Escape', 'KeyP']
};
const DEFAULT_PAD = { left: [14], right: [15], up: [12], down: [13], jump: [0], attack: [2], dash: [1, 7], item: [3], heal: [4], cycle: [5], map: [8], pause: [9] };
const DEFAULTS = { keyboard: DEFAULT_KEYS, gamepad: DEFAULT_PAD };
const RESERVED = { keyboard: 'Escape', gamepad: 9 };      // Esc / Start always pause (and cancel a rebind), so nobody can lock themselves out
const ACTION_NAMES = { left: 'Move left', right: 'Move right', up: 'Up', down: 'Down', jump: 'Jump', attack: 'Slash', dash: 'Dash', item: 'Use token', heal: 'Mend', cycle: 'Switch token',
  interact: 'Use, enter (same as Up)', map: 'Map', pause: 'Pause' };

const KEYNAME = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  AltLeft: 'Alt', AltRight: 'Alt', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter', NumpadEnter: 'Enter', Backspace: 'Backspace', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', CapsLock: 'Caps Lock' };
const PADNAME = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Home'];
let layout = null;                                  // navigator.keyboard layout map where the browser has one: the key's printed letter on this layout (AZERTY and the like)
try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { layout = m; }, () => {}); } catch (e) { /* no layout map */ }
function keyLabel(code) {
  if (KEYNAME[code]) return KEYNAME[code];
  if (layout && layout.get(code)) return String(layout.get(code)).toUpperCase();
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1];
  return String(code).replace(/^Numpad/, 'Num ');
}
const padLabel = b => PADNAME[b] || ('Button ' + b);
const typeOf = dev => (dev === 'kb' || dev === '*' ? 'keyboard' : dev ? 'gamepad' : 'keyboard');

const NPAD = 8;
const down = new Set();                            // keyboard codes held now
const blank = () => { const o = {}; for (const a of ACTIONS) o[a] = false; return o; };
const raws = { kb: blank() };                      // raw action state per device: raws.kb, raws['pad:0'] ...
for (let i = 0; i < NPAD; i++) raws['pad:' + i] = blank();
const connected = new Array(NPAD).fill(false), padIds = new Array(NPAD).fill('');
const prevButtons = [];                            // last button pressed flags per pad, for rebind capture
const anyRaw = blank();
const states = new Set();
let stateList = [];                                // the same, as an array (cheaper to walk every step)
const edges = { any: new Set(), jump: new Set(), pause: new Set() };     // devices that pressed anything / Jump / Pause since the last step ended
let keyMap = null, padMap = null, cap = null;      // action lookups per key code / pad button; the rebind listener

function bindingsOf(type) {
  const over = (G.meta && G.meta.bindings && G.meta.bindings[type]) || {}, out = {};
  for (const a of REBINDABLE) out[a] = Array.isArray(over[a]) && over[a].length ? over[a].slice() : DEFAULTS[type][a].slice();
  out.interact = out.up;
  return out;
}
function rebuild() {
  keyMap = new Map(); padMap = new Map();
  const add = (map, k, a) => { if (!map.has(k)) map.set(k, []); map.get(k).push(a); };
  const kb = bindingsOf('keyboard'), pd = bindingsOf('gamepad');
  for (const a of ACTIONS) { for (const c of kb[a]) add(keyMap, c, a); for (const b of pd[a]) add(padMap, b, a); }
  add(keyMap, RESERVED.keyboard, 'pause'); add(padMap, RESERVED.gamepad, 'pause');
}
function ensure() { if (!keyMap) rebuild(); }

// Store a device's new raw action state and note presses (a press of anything, of Jump, of Pause) for joining, taking over and the title.
function setRaw(dev, next, pressedSomething) {
  const old = raws[dev];
  for (const a of ACTIONS) {
    if (next[a] && !old[a]) { if (a === 'jump') edges.jump.add(dev); if (a === 'pause') edges.pause.add(dev); pressedSomething = true; }
    if (old[a] !== next[a]) { old[a] = next[a]; anyStale = true; }
  }
  if (pressedSomething) edges.any.add(dev);
}
function kbRaw() {
  ensure();
  const n = blank();
  for (const c of down) { const l = keyMap.get(c); if (l) for (const a of l) n[a] = true; }
  setRaw('kb', n, false);
}
let anyStale = true;                                // the union of all devices (for the menus' state) is recomputed only when a device's raw state changed
function syncState(s) {
  const r = s.dev === '*' ? anyRaw : (s.dev && raws[s.dev]) || null, f = s.forced, held = s.held, pr = s.pressed;
  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i], h = !!(f[a] || (r && r[a]));
    if (h && !held[a]) pr[a] = true;
    held[a] = h;
  }
}
function sync() {
  ensure();
  if (anyStale) { for (const a of ACTIONS) { let h = false; for (const d in raws) if (raws[d][a]) { h = true; break; } anyRaw[a] = h; } anyStale = false; }
  for (let k = 0; k < stateList.length; k++) syncState(stateList[k]);
}
function readPad(i, gp) {
  ensure();
  const B = b => !!(gp.buttons[b] && gp.buttons[b].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, n = blank();
  for (let b = 0; b < gp.buttons.length; b++) if (B(b)) { const l = padMap.get(b); if (l) for (const a of l) n[a] = true; }
  if (ax < -0.4) n.left = true; if (ax > 0.4) n.right = true; if (ay < -0.55) n.up = true; if (ay > 0.55) n.down = true;
  n.interact = n.interact || n.up;
  // a button that went down since the last poll (for the rebind listener and "press any button")
  const prev = prevButtons[i] || [], now = [];
  let pressedNew = false;
  for (let b = 0; b < gp.buttons.length; b++) {
    now[b] = B(b);
    if (now[b] && !prev[b]) { pressedNew = true; if (cap && cap.type === 'gamepad' && (cap.dev === undefined || cap.dev === 'pad:' + i)) { const c = cap; if (c.cb('gamepad', b, 'pad:' + i)) cap = null; } }
  }
  prevButtons[i] = now;
  return { n, pressedNew, any: pressedNew || n.left || n.right || n.up || n.down };
}

G.input = {
  last: 'keyboard',                       // 'keyboard' or 'gamepad': the kind of device used last by anyone (tips use it)
  ACTIONS, REBINDABLE, DEFAULTS, ACTION_NAMES, RESERVED,
  typeOf,
  // opts: { dev: 'kb' | 'pad:N' | '*' (any device) | null (none: forced input only) }
  makeState(opts = {}) {
    const s = { held: {}, pressed: {}, forced: {}, dev: opts.dev === undefined ? null : opts.dev };
    for (const a of ACTIONS) { s.held[a] = false; s.pressed[a] = false; }
    states.add(s); stateList = [...states]; return s;
  },
  release(s) { states.delete(s); stateList = [...states]; },
  // Read gamepads once per frame (any index: browsers number them in connection order).
  poll() {
    let list = [];
    try { list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch (e) { list = []; }
    for (let i = 0; i < NPAD; i++) {
      const gp = list[i], dev = 'pad:' + i;
      connected[i] = !!(gp && gp.connected);
      if (connected[i]) {
        padIds[i] = gp.id || '';
        const r = readPad(i, gp);
        if (r.any) G.input.last = 'gamepad';
        setRaw(dev, r.n, r.pressedNew);
      } else { prevButtons[i] = []; setRaw(dev, blank(), false); }
    }
    sync();
  },
  isConnected(dev) { const m = /^pad:(\d+)$/.exec(dev || ''); return m ? !!connected[+m[1]] : true; },
  padId(dev) { const m = /^pad:(\d+)$/.exec(dev || ''); return m ? padIds[+m[1]] : ''; },
  // The first device that pressed any button since the last step ended (the title screen: it becomes player 1), or null.
  claim() { for (const d of edges.any) return d; return null; },
  // A device that just pressed Jump and is not in `used` (the hub: it joins as the next player), or null.
  takeJoin(used) { for (const d of edges.jump) if (!used.includes(d)) return d; return null; },
  // A device that just pressed anything and is not in `used` (a lost controller's player: it takes over), or null.
  takeOver(used) { for (const d of edges.any) if (!used.includes(d)) return d; return null; },
  // The device that pressed Pause this step, if any.
  pauseDev() { for (const d of edges.pause) return d; return null; },
  // Players whose controller is no longer connected.
  lost() { return G.players.filter(p => p.in.dev && p.in.dev !== 'kb' && p.in.dev !== '*' && !G.input.isConnected(p.in.dev)); },
  endStep() {
    for (let k = 0; k < stateList.length; k++) {                       // (pressed may also be put back by a snapshot restore, so there is no dirty flag)
      const pr = stateList[k].pressed;
      for (let i = 0; i < ACTIONS.length; i++) if (pr[ACTIONS[i]]) pr[ACTIONS[i]] = false;
    }
    edges.any.clear(); edges.jump.clear(); edges.pause.clear();
  },
  sync,
  syncState,

  // ---- bindings (per device type; saved in G.meta.bindings)
  bindings: bindingsOf,
  refresh() { keyMap = null; padMap = null; },
  isDefault(type) { const o = (G.meta && G.meta.bindings && G.meta.bindings[type]) || {}; return !Object.keys(o).length; },
  label(type, action) {                   // the key or button name(s) of an action on a device type, after remapping
    const b = bindingsOf(type)[action] || [], seen = [];
    for (const c of b) { const t = type === 'keyboard' ? keyLabel(c) : padLabel(c); if (!seen.includes(t)) seen.push(t); }
    return (type === 'keyboard' ? seen.slice(0, 2) : seen.slice(0, 1)).join(' or ') || '(none)';
  },
  // Rebind an action on a device type to a key code or button index. Returns { ok, msg }. Duplicates and the reserved Esc / Start are refused.
  bind(type, action, code) {
    if (!REBINDABLE.includes(action)) return { ok: false, msg: ACTION_NAMES[action] + ': it follows the Up binding, rebind Up.' };
    const nameOf = c => type === 'keyboard' ? keyLabel(c) : padLabel(c);
    if (code === RESERVED[type]) return { ok: false, msg: nameOf(code) + ' is reserved: it always pauses. Pick another ' + (type === 'keyboard' ? 'key' : 'button') + '.' };
    const all = bindingsOf(type);
    for (const a of REBINDABLE) if (a !== action && all[a].includes(code)) return { ok: false, msg: nameOf(code) + ' is already used for ' + ACTION_NAMES[a] + '. Pick another ' + (type === 'keyboard' ? 'key' : 'button') + ', or change ' + ACTION_NAMES[a] + ' first.' };
    if (!G.meta.bindings[type]) G.meta.bindings[type] = {};
    G.meta.bindings[type][action] = [code];
    G.game.saveMeta(); G.input.refresh(); kbRaw();
    return { ok: true, msg: ACTION_NAMES[action] + ' is now ' + nameOf(code) + '.' };
  },
  resetBindings(type) { G.meta.bindings[type] = {}; G.game.saveMeta(); G.input.refresh(); kbRaw(); },
  // Listen for the next key (type 'keyboard') or button (type 'gamepad', optionally only on one device) instead of playing it: cb(type, code, dev) returns true when done.
  capture(type, dev, cb) { cap = { type, dev, cb }; },
  stopCapture() { cap = null; },
  capturing() { return !!cap; },

  // Wording for prompts and tips: G.input.name('item', player) -> 'V' or 'Y' for the device that player uses (a device type 'keyboard' / 'gamepad' works too); without a player, for the device used last.
  name(action, p) {
    const type = typeof p === 'string' ? p : p ? typeOf(p.in.dev) : G.input.last, b = bindingsOf(type), L = a => G.input.label(type, a);
    switch (action) {
      case 'move': return type === 'gamepad' ? 'the stick' : (['left', 'right', 'up', 'down'].every(a => b[a].join() === DEFAULT_KEYS[a].join()) ? 'Arrows' : L('left') + ', ' + L('right'));
      case 'confirm': return L('jump');
      case 'choose': return type === 'gamepad' ? 'the d-pad' : L('up') + ' and ' + L('down');
      default: return ACTIONS.includes(action) ? L(action) : action;
    }
  }
};
// Any device: used by menus.
G.input.any = G.input.makeState({ dev: '*' });

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  ensure();
  if (cap && cap.type === 'keyboard') { e.preventDefault(); if (!e.repeat && cap.cb('keyboard', e.code, 'kb')) cap = null; return; }
  if (keyMap.has(e.code)) e.preventDefault();
  // A repeat event is accepted: a key still held when the window regains focus is picked up again by the browser's auto-repeat.
  const fresh = !down.has(e.code);
  down.add(e.code); G.input.last = 'keyboard';
  kbRaw(); if (fresh) edges.any.add('kb');
  sync();
});
addEventListener('keyup', e => { down.delete(e.code); kbRaw(); sync(); });
const releaseAll = () => { down.clear(); kbRaw(); sync(); };
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
})();
