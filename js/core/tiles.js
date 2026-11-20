/* The current room's tile grid and box-vs-tile movement.
   Entities are boxes described by x (centre), y (feet), w, h. */
(() => {
'use strict';
const G = window.G, T = G.C.T;
const SOLID_TERRAIN = '#sm<>';

const tiles = G.tiles = {
  grid: null, cols: 0, rows: 0,
  blockers: [],                        // [{ c, r0, r1, on }] temporary walls, e.g. a locked arena exit
  load(grid) { tiles.grid = grid; tiles.rows = grid.length; tiles.cols = grid[0].length; tiles.blockers = []; },
  at(c, r) { return r < 0 || r >= tiles.rows || c < 0 || c >= tiles.cols ? '#' : tiles.grid[r][c]; },
  // Past an edge, repeat that edge tile. Closed borders stay solid; an open left/right/top/bottom port stays open long enough to cross.
  solid(c, r) {
    const cc = c < 0 ? 0 : c >= tiles.cols ? tiles.cols - 1 : c, rr = r < 0 ? 0 : r >= tiles.rows ? tiles.rows - 1 : r;
    for (const b of tiles.blockers) if (b.on && b.c === cc && rr >= b.r0 && rr <= b.r1) return true;
    return SOLID_TERRAIN.includes(tiles.grid[rr][cc]);
  },
  spike(c, r) { return tiles.at(c, r) === '^'; },
  oneway(c, r) { return tiles.at(c, r) === '='; },
  surfaceUnder(o) { return tiles.at(Math.floor(o.x / T), Math.floor((o.y + 1) / T)); },
  conveyor(o) { const ch = tiles.surfaceUnder(o); return ch === '>' ? 1 : ch === '<' ? -1 : 0; },
  replace(c, r, ch) {
    if (r < 0 || r >= tiles.rows || c < 0 || c >= tiles.cols) return false;
    const row = tiles.grid[r]; if (row[c] === ch) return false;
    tiles.grid[r] = row.slice(0, c) + ch + row.slice(c + 1); return true;
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
