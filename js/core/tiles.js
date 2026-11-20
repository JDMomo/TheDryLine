/* The current room's tile grid and box-vs-tile movement.
   Entities are boxes described by x (centre), y (feet), w, h. */
(() => {
'use strict';
const G = window.G, T = G.C.T;
const SOLID_TERRAIN = '#sm<>cjvt';

const tiles = G.tiles = {
  grid: null, cols: 0, rows: 0, terrain: null,
  blockers: [],                        // [{ c, r0, r1, on }] temporary walls, e.g. a locked arena exit
  load(grid, terrain) {
    tiles.grid = grid; tiles.rows = grid.length; tiles.cols = grid[0].length; tiles.blockers = [];
    tiles.terrain = terrain || { crumble: {} };
    if (!tiles.terrain.crumble) tiles.terrain.crumble = {};
  },
  at(c, r) { return r < 0 || r >= tiles.rows || c < 0 || c >= tiles.cols ? '#' : tiles.grid[r][c]; },
  // Past an edge, repeat that edge tile. Closed borders stay solid; an open left/right/top/bottom port stays open long enough to cross.
  solid(c, r) {
    const cc = c < 0 ? 0 : c >= tiles.cols ? tiles.cols - 1 : c, rr = r < 0 ? 0 : r >= tiles.rows ? tiles.rows - 1 : r;
    for (const b of tiles.blockers) if (b.on && b.c === cc && rr >= b.r0 && rr <= b.r1) return true;
    const ch = tiles.grid[rr][cc];
    if (ch === 'c' && tiles.crumbleGone(cc, rr)) return false;
    return SOLID_TERRAIN.includes(ch);
  },
  spike(c, r) { return tiles.at(c, r) === '^'; },
  oneway(c, r) { return tiles.at(c, r) === '='; },
  crumbleKey(c, r) { return c + ',' + r; },
  crumbleState(c, r) { return tiles.terrain && tiles.terrain.crumble[tiles.crumbleKey(c, r)] || null; },
  crumbleGone(c, r) { const st = tiles.crumbleState(c, r); return !!(st && st.phase === 'gone'); },
  surfaceUnder(o) {
    const c = Math.floor(o.x / T), r = Math.floor((o.y + 1) / T), ch = tiles.at(c, r);
    return ch === 'c' && tiles.crumbleGone(c, r) ? '.' : ch;
  },
  conveyor(o) { const ch = tiles.surfaceUnder(o); return ch === '>' ? 1 : ch === '<' ? -1 : 0; },
  stableFloorAt(c, r) { const ch = tiles.at(c, r); return tiles.floorAt(c, r) && !'cjv'.includes(ch); },
  ventActive(c, r, time = G.time) {
    const phase = (time + ((c * 17 + r * 31) % 13) * 0.07) % 2.6;
    return phase >= 0.48 && phase < 1.12;
  },
  updateTerrain(dt, entities) {
    const state = tiles.terrain && tiles.terrain.crumble;
    if (!state) return;

    // Timed crumble lifecycle: 0.45 s warning, 2.6 s gone, then rebuild once the tile body is clear.
    for (const key of Object.keys(state)) {
      const st = state[key], [c, r] = key.split(',').map(Number);
      if (st.phase === 'warn' && G.time >= st.at) { st.phase = 'gone'; st.at = G.time + 2.6; continue; }
      if (st.phase === 'gone' && G.time >= st.at) {
        const x0 = c * T, x1 = x0 + T, y0 = r * T, y1 = y0 + T;
        const blocked = entities.some(o => !o.dead && o.x + o.w / 2 > x0 + 2 && o.x - o.w / 2 < x1 - 2 && o.y > y0 + 3 && o.y - o.h < y1 - 3);
        if (!blocked) delete state[key];
      }
    }

    for (const o of entities) {
      if (!o || o.dead) continue;
      if (o._ventCd > 0) o._ventCd = Math.max(0, o._ventCd - dt);
      const c = Math.floor(o.x / T), r = Math.floor((o.y + 1) / T), under = tiles.at(c, r);

      if (o.onGround && under === 'c' && !tiles.crumbleState(c, r))
        state[tiles.crumbleKey(c, r)] = { phase: 'warn', at: G.time + 0.45 };

      if (o.onGround && under === 'j') {
        o.vy = -Math.max(760, G.C.MOVE.JUMP_V * 1.24); o.onGround = false;
        // A spring is an external launch, not a button-held jump. Keep it from being shortened next frame by the player's jump-release cut.
        if ('canDouble' in o) { o.canDouble = true; o.coyote = 0; o.jumping = false; o.airJ = false; }
      }

      // A vent launches bodies in the four-tile column above it while its visible steam pulse is active.
      if (!(o._ventCd > 0)) {
        const vc = Math.floor(o.x / T);
        for (let vr = Math.floor(o.y / T); vr < Math.min(tiles.rows, Math.floor(o.y / T) + 5); vr++) {
          if (tiles.at(vc, vr) !== 'v' || !tiles.ventActive(vc, vr)) continue;
          const top = vr * T;
          if (o.y <= top + 3 && o.y >= top - T * 4) {
            o.vy = Math.min(o.vy, -700); o.onGround = false; o._ventCd = 0.24;
            if ('canDouble' in o) o.canDouble = true;
            break;
          }
        }
      }
    }
  },
  replace(c, r, ch) {
    if (r < 0 || r >= tiles.rows || c < 0 || c >= tiles.cols) return false;
    const row = tiles.grid[r]; if (row[c] === ch) return false;
    tiles.grid[r] = row.slice(0, c) + ch + row.slice(c + 1); return true;
  },
  burnTar(x, y, radius) {
    let n=0;
    const c0=Math.max(0,Math.floor((x-radius)/T)), c1=Math.min(tiles.cols-1,Math.floor((x+radius)/T));
    const r0=Math.max(0,Math.floor((y-radius)/T)), r1=Math.min(tiles.rows-1,Math.floor((y+radius)/T));
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
      if(tiles.at(c,r)!=='t')continue;
      const cx=c*T+T/2,cy=r*T+T/2;
      if(Math.hypot(cx-x,cy-y)<=radius+T*.7){tiles.replace(c,r,'.');n++;}
    }
    return n;
  },
  dissolveSalt(x, y, radius) {
    let n = 0;
    const c0 = Math.max(0, Math.floor((x - radius) / T)), c1 = Math.min(tiles.cols - 1, Math.floor((x + radius) / T));
    const r0 = Math.max(0, Math.floor((y - 12) / T)), r1 = Math.min(tiles.rows - 1, Math.floor((y + 20) / T));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (tiles.at(c, r) !== 's') continue;
      const cx = c * T + T / 2, cy = r * T;
      if (Math.abs(cx - x) <= radius + T / 2 && Math.abs(cy - y) <= 24) { tiles.replace(c, r, '.'); n++; }
    }
    return n;
  },
  // Moves the box, stopping at solids. Returns { hx: -1|0|1, hy: -1|0|1 }. o.dropThru lets it fall through one-way platforms.
  moveBox(o, dx, dy) {
    let hx = 0, hy = 0;
    const solid = tiles.solid;
    o.x += dx;
    const top = Math.floor((o.y - o.h) / T), bot = Math.floor((o.y - 0.01) / T);
    if (dx > 0) {
      const c = Math.floor((o.x + o.w / 2) / T);
      for (let r = top; r <= bot; r++) if (solid(c, r)) { o.x = c * T - o.w / 2 - 0.001; hx = 1; break; }
    } else if (dx < 0) {
      const c = Math.floor((o.x - o.w / 2) / T);
      for (let r = top; r <= bot; r++) if (solid(c, r)) { o.x = (c + 1) * T + o.w / 2 + 0.001; hx = -1; break; }
    }
    const prevY = o.y;
    o.y += dy;
    const c0 = Math.floor((o.x - o.w / 2 + 0.01) / T), c1 = Math.floor((o.x + o.w / 2 - 0.01) / T);
    if (dy > 0) {
      const r = Math.floor(o.y / T);
      for (let c = c0; c <= c1; c++) {
        if (solid(c, r) || (tiles.oneway(c, r) && !o.dropThru && prevY <= r * T + 0.01)) { o.y = r * T; hy = 1; break; }
      }
    } else if (dy < 0) {
      const r = Math.floor((o.y - o.h) / T);
      for (let c = c0; c <= c1; c++) if (solid(c, r)) { o.y = (r + 1) * T + o.h + 0.001; hy = -1; break; }
    }
    return { hx, hy };
  },
  // 1 if a wall touches the box's right side, -1 for the left, 0 for none.
  wallDir(o) {
    const r0 = Math.floor((o.y - 13) / T), r1 = Math.floor((o.y - 34) / T);
    const cr = Math.floor((o.x + o.w / 2 + 1.5) / T), cl = Math.floor((o.x - o.w / 2 - 1.5) / T);
    if (tiles.solid(cr, r0) && tiles.solid(cr, r1)) return 1;
    if (tiles.solid(cl, r0) && tiles.solid(cl, r1)) return -1;
    return 0;
  },
  // True if something can stand at tile (c, r): a solid or one-way tile.
  floorAt(c, r) { return tiles.solid(c, r) || tiles.oneway(c, r); }
};
})();
