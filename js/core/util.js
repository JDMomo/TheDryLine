/* Constants and small helpers. Everything hangs off the single global G. */
(() => {
'use strict';
const G = window.G = {};

G.C = {
  W: 960, H: 544, T: 32, CW: 30, CH: 17, STEP: 1 / 120,
  FONT: '"IBM Plex Sans", system-ui, sans-serif',
  DISPLAY: '"Spectral SC", Georgia, serif',
  SLOTS: 4,            // party token slots in total
  BASE_HP: 5,
  SPOT_HP: 3,          // token hits needed to punch a fare slot
  BREAK_FRAC: 0.2,     // share of max hp a boss loses when a fare slot is punched
  STAGGER: 2.6,        // seconds a boss staggers after a punch
  BOSS_GRACE: 1.5,     // seconds a Warden waits after its intro before its first attack
  KILL_MEND: 7,        // mend gauge (of 33 per pip) a player gains when an enemy dies near them
  WARDEN_SCRIP: 40,    // scrip (code: shards) for beating a Warden
  PLAYER_COLORS: ['#e2a03f', '#d9c5a0', '#9fb8c8', '#a79be0'],   // cloak colour per player
  // movement feel (prototype values retuned to bible section 7)
  MOVE: {
    RUN: 285, GACC: 5200, AACC: 4200, JUMP_V: 735, GRAV: 2150, MAXFALL: 920, CUT: 0.42,
    COYOTE: 0.09, JBUF: 0.10, DASH_V: 800, DASH_T: 0.155, DASH_CD: 0.35, SLIDE: 140,
    WJ_VX: 330, WJ_VY: 700, WJ_LOCK: 0.14, DJ_V: 600, POGO_V: 590, ATK_CD: 0.27, ATK_ACTIVE: 0.11,
    HEAVY_T: 0.65, MEND_T: 0.85, MEND_COST: 33, INV: 1.0,
    CORNER: 10, STOP_HIT: 0.06, STOP_HURT: 0.10, QUICK_TURN: 0.4, LOOK: 50, PAN: 80, PAN_T: 0.5
  }
};

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

G.util = {
  clamp,
  approach: (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t),
  rnd: (a, b) => a + Math.random() * (b - a),          // cosmetic randomness only
  overlap: (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0,
  circleRect(x, y, r, q) {
    const dx = x - clamp(x, q.x0, q.x1), dy = y - clamp(y, q.y0, q.y1);
    return dx * dx + dy * dy <= r * r;
  },
  // Seeded generator (mulberry32). r() is 0..1; helpers hang off the function.
  makeRng(seed) {
    let s = seed >>> 0;
    const r = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.get = () => s; r.set = v => { s = v >>> 0; };      // state access for test tools that snapshot and restore a fight
    r.int = n => Math.floor(r() * n);
    r.range = (a, b) => a + r() * (b - a);
    r.chance = p => r() < p;
    r.pick = arr => arr[r.int(arr.length)];
    r.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    return r;
  }
};

// Game name and end-of-run wording; js/content/regions.js overrides these.
G.title = { name: 'Untitled', tagline: '', winText: 'The run is won', loseText: 'The party has fallen' };

// Content mistakes are reported loudly; the smoke test fails on any of them.
G.errors = [];
G.fail = msg => { G.errors.push(msg); console.error('[G] ' + msg); };
})();
