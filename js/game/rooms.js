/* Room templates (ASCII), room instances, moving between rooms, and the per-step update and draw of the current room. */
(() => {
'use strict';
const G = window.G, C = G.C, T = C.T, U = G.util, fx = G.fx, tiles = G.tiles, art = G.art;
G.roomDefs = {};

const MARKS = 'EFLICRSKMHDBG?PXYZ AQN'.replace(/ /g, '');
const KINDS = ['hub', 'main', 'branch', 'trial', 'arena'];
const EXIT_ROWS = [12, 13, 14];       // left/right opening rows in the bottom screen cell
const SIDES = ['left', 'right', 'top', 'bottom'];

/* G.defineRoom({ id, region, kind, w, h, label, map: [rows], signs: [texts] })
   region  a region id, 'shared' for branch rooms any region may use, or 'hub'
   kind    'hub' | 'main' | 'branch' | 'trial' | 'arena'
   w, h    size in screen cells (default 1 x 1). map has 17 * h rows of 30 * w characters.
   label   name shown on the doorway that leads to this room (branch and trial rooms)
   Characters:
     #  solid          .  empty          ^  spikes (hurt, can be bounced on with a down slash)      =  one-way platform
     s  slippery salt crust (solid; wet dissolves it)    m  mud (solid; slows movement)    >/<  right/left conveyor (solid; pushes grounded bodies)
     c  crumbling ledge (warns, falls, rebuilds)          j  launch spring                 v  timed steam vent
     t  hardened tar block (solid; spark/fire burns it away for this live room)
     E  ground enemy   F  flying enemy   L  ceiling enemy (hangs from the ceiling above it)   I  plinth (token)    C  lost trunk (opens when the room is clear)
     R  ticket machine (needs 2 free tiles each side)        S  kiosk ware (priced plinth)       K  clipping booth (needs 3 free tiles each side)
     M  signal post    H  standpipe      D  doorway           B  boss (arena)    G  region gate (hub)    ?  sign (text from signs[])    P  party start (hub)
     X  cracked barrier (branch rooms): a wall three tiles tall standing on the tile below the marker; only a heavy cut breaks it
     Y  timed lever       A  pressure plate (held by a player)       Z  mechanical gate paired to Y/A in the same room
     Q  short-span rail cart (optional moving accelerator; carries grounded bodies)
     N  Station Keeper / authored NPC marker
   A marker stands on the tile below it: put it in the empty tile directly above a floor.
   Main route ports: def.route = [entrySide, exitSide], using left/right/top/bottom; omitted means left -> right. Arenas still open on the left only.
   'branch' and 'trial' rooms have exactly one D (the way back) and closed edges.
   Arena boss door: the first column from the left whose row 11 is solid and rows 12 to 14 are open; it closes while the boss fights. */
G.defineRoom = def => {
  const w = def.w || 1, h = def.h || 1, bad = m => G.fail('room ' + def.id + ': ' + m);
  if (!def.id || !KINDS.includes(def.kind)) return bad('needs an id and a valid kind');
  if (!def.map || def.map.length !== C.CH * h) return bad('needs ' + C.CH * h + ' rows, has ' + (def.map ? def.map.length : 0));
  for (let r = 0; r < def.map.length; r++) if (def.map[r].length !== C.CW * w) return bad('row ' + r + ' is ' + def.map[r].length + ' wide, needs ' + C.CW * w);
  const marks = [], grid = [];
  def.map.forEach((row, r) => {
    let out = '';
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (MARKS.includes(ch)) { marks.push({ ch, c, r }); out += '.'; }
      else if ('#.^=sm<>cjvt'.includes(ch)) out += ch;
      else { bad('unknown character "' + ch + '" at row ' + r + ', column ' + c); out += '.'; }
    }
    grid.push(out);
  });
  const base = (h - 1) * C.CH, cols = C.CW * w, rows = C.CH * h;
  const openCol = c => EXIT_ROWS.every(r => grid[base + r][c] === '.');
  const openLR = side => openCol(side === 'left' ? 0 : cols - 1);
  const edgeRun = side => {
    if (side === 'left' || side === 'right') return openLR(side) ? { c: side === 'left' ? 0 : cols - 1, r: base + 13 } : null;
    const r = side === 'top' ? 0 : rows - 1, runs = []; let start = -1;
    for (let c = 0; c <= cols; c++) {
      const open = c < cols && grid[r][c] === '.';
      if (open && start < 0) start = c;
      if (!open && start >= 0) { runs.push([start, c - 1]); start = -1; }
    }
    const best = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
    return best && best[1] - best[0] + 1 >= 3 ? { c: Math.floor((best[0] + best[1]) / 2), r } : null;
  };
  const route = def.kind === 'main' ? (def.route ? def.route.slice() : ['left', 'right']) : null;
  if (route && (route.length !== 2 || route[0] === route[1] || route.some(x => !SIDES.includes(x)))) bad('main route must be two different sides: left, right, top or bottom');
  const ports = {}; for (const side of SIDES) { const p = edgeRun(side); if (p) ports[side] = p; }
  const doors = marks.filter(m => m.ch === 'D').length, bMark = marks.find(m => m.ch === 'B');
  const room = Object.assign({}, def, { w, h, marks, grid, doors, cols, rows, route, ports });
  if (def.kind === 'main' && route) {
    for (const side of route) if (!ports[side]) bad('main route ' + route.join(' -> ') + ' needs an open ' + side + ' edge');
    for (const side of SIDES) if (!route.includes(side) && ports[side]) bad('main room has an undeclared open ' + side + ' edge; add it to route or close it');
  }
  if (def.kind === 'arena') {
    if (!openLR('left') || !bMark) return bad('arenas need an open left edge and a B marker');
    room.doorCol = 0;
    for (let c = 0; c < bMark.c; c++) if (grid[base + 11][c] === '#' && openCol(c)) { room.doorCol = c; break; }
    let c1 = bMark.c; while (c1 < cols && grid[bMark.r][c1] !== '#') c1++;
    room.floorX = [(room.doorCol + 1) * T, c1 * T];          // open floor of the fight, in pixels
  }
  if ((def.kind === 'branch' || def.kind === 'trial') && doors !== 1) bad('branch and trial rooms need exactly one D');
  if (def.kind === 'hub' && !marks.some(m => m.ch === 'P')) bad('the hub needs a P marker');
  /* Home-area portals (kind 'hub' only): several openings on any edge, each its own route out.
     def.portals = [{ id, side, from, to, via }]: side left/right (from..to = open rows) or top/bottom (from..to = open columns).
     id names a region (its route), via optionally names a connector room template (kind 'main', region 'hub') between the hub and the
     region's first room. Every listed opening must be open on that edge; worldgen links each one (node.portals). */
  if (def.portals) {
    room.portals = def.portals.map(p => Object.assign({}, p));
    for (const p of room.portals) {
      const edgeOpen = k => p.side === 'left' ? grid[k][0] === '.' : p.side === 'right' ? grid[k][cols - 1] === '.' : p.side === 'top' ? grid[0][k] === '.' : grid[rows - 1][k] !== '#';
      for (let k = p.from; k <= p.to; k++) if (!edgeOpen(k)) { bad('portal ' + p.id + ' is not open on the ' + p.side + ' edge at ' + k); break; }
    }
  }
  G.roomDefs[def.id] = room;
};

const markPos = m => ({ x: m.c * T + T / 2, y: (m.r + 1) * T });
const ENTRY_GRACE = 1.0;          // seconds after arriving during which the edge the party came in by does not lead out again
const inGrace = (room, side) => room.entrySide === side && G.time - room.enterAt < ENTRY_GRACE;
// Where a party arriving through a bottom opening stands: the nearest stable floor (not the hole, not crumble, spring, vent or spikes)
// with two tiles of headroom, lowest rows first, within 12 columns of the opening. Null if there is none (the old pop-up is used).
function bottomLanding(c0, room) {
  for (let r = room.rows - 2; r >= Math.max(1, room.rows - 14); r--) for (let dc = 0; dc <= 12; dc++) for (const c of dc ? [c0 - dc, c0 + dc] : [c0]) {
    if (c < 1 || c > room.cols - 2 || tiles.solid(c, r) || tiles.solid(c, r - 1) || tiles.spike(c, r)) continue;
    if (!tiles.stableFloorAt(c, r + 1) || tiles.spike(c, r + 1)) continue;
    const dir = c < c0 ? -1 : 1;
    if (dc && !tiles.stableFloorAt(c - dir, r + 1)) continue;          // a full tile of floor between the landing and the hole
    return { x: (c + .5) * T, y: (r + 1) * T, dir };
  }
  return null;
}

// Build the live room for a graph node: props, enemies and the boss come from the node's pre-rolled content.
function instance(node) {
  const def = G.roomDefs[node.def];
  const room = { node, id: node.id, def, region: node.region, kind: def.kind, grid: def.grid.slice(), cols: def.cols, rows: def.rows,
    props: [], enemies: [], boss: null, cleared: false, fight: false, terrain: { crumble: {} } };
  tiles.load(room.grid, room.terrain);                 // enemy and boss constructors read the room size
  def.marks.forEach((m, i) => {
    const c = node.content[i], { x, y } = markPos(m);
    if (!c) return;
    if (c.type === 'enemy') { const d = G.enemyDefs[c.id], e = new G.Enemy(d, x, d.flying ? y - 8 : y); e.applyScale((G.regionDefs[node.region] || {}).scale); if (c.elite) e.makeElite(); if(c.wakeRange){e.wakeRange=c.wakeRange;e.awake=false;e.dormantHarmless=!!e.harmless;e.harmless=true;} room.enemies.push(e); }
    else if (c.type === 'boss') { if (!G.run.beaten[node.region]) room.boss = new G.Boss(G.bossDefs[c.id], x, y, node.region, { x0: def.floorX[0], x1: def.floorX[1] }); }
    else if (c.type !== 'start') room.props.push(G.props.make(c.type, x, y, Object.assign({}, c.data)));
  });
  // Authored fixtures (def.fixtures: [{ type, c, r, data }]): working props placed by the template itself, outside the seeded rolls
  // (the home area's scrip caches and loop-back hatches). Like markers they stand on the tile below (c, r).
  for (const d of (def.fixtures || [])) room.props.push(G.props.make(d.type, (d.c + .5) * T, (d.r + 1) * T, JSON.parse(JSON.stringify(d.data || {}))));
  // Authored visual-only decoration is deliberately outside marker/content rolls: it never changes seed balance or collision.
  for (const d of (def.decor || [])) {
    const x=(d.c+.5)*T, y=(d.r+1)*T, data=Object.assign({decor:true},d.data||{});
    room.props.push(G.props.make(d.type,x,y,data));
  }
  room.cleared = room.enemies.length === 0;
  return room;
}

function groundY(room, c) {
  const base = room.rows - C.CH;
  for (let r = base + EXIT_ROWS[0]; r < room.rows; r++) if (tiles.floorAt(c, r)) return r * T;
  return (room.rows - 2) * T;
}

/* Solid interiors (playtest issue 7: deep rock read as flat black voids). Rock two or more tiles from any open tile gets faint masonry
   courses and joints in the region's palette, and a few dim service vents deeper in; the tile art itself (js/art/world.js, art.js)
   is untouched, this only draws over it. The depth map is cached per room and rebuilt if the grid is replaced. */
function interiorDepth(room) {
  if (room._depth && room._depthGrid === room.grid) return room._depth;
  const g = room.grid, R = g.length, Cc = g[0].length, d = new Uint8Array(R * Cc).fill(9), q = [];   // the grid's own size (tests swap grids)
  for (let r = 0; r < R; r++) for (let c = 0; c < Cc; c++) if (g[r][c] !== '#') { d[r * Cc + c] = 0; q.push(r * Cc + c); }
  for (let i = 0; i < q.length; i++) {
    const k = q[i], r = (k / Cc) | 0, c = k % Cc, v = d[k] + 1;
    if (v > 6) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || rr >= R || cc < 0 || cc >= Cc) continue;
      const kk = rr * Cc + cc; if (d[kk] > v) { d[kk] = v; q.push(kk); }
    }
  }
  d.R = R; d.C = Cc; room._depth = d; room._depthGrid = room.grid; return d;
}
function drawInteriors(ctx, room, pal) {
  const d = interiorDepth(room), Cc = d.C;
  const c0 = Math.max(0, Math.floor(G.cam.x / T)), c1 = Math.min(Cc - 1, Math.floor((G.cam.x + C.W) / T));
  const r0 = Math.max(0, Math.floor(G.cam.y / T)), r1 = Math.min(d.R - 1, Math.floor((G.cam.y + C.H) / T));
  ctx.save(); ctx.fillStyle = pal.edge || '#6a6080';
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const v = d[r * Cc + c]; if (v < 2) continue;
    const x = c * T, y = r * T, course = r >> 1;
    ctx.globalAlpha = v >= 3 ? 0.26 : 0.16;
    if (!(r & 1)) ctx.fillRect(x, y, T, 1.5);                                   // a course line every two rows
    if ((c + (course & 1) * 2) % 4 === 0) ctx.fillRect(x, y + ((r & 1) ? 0 : 1.5), 1.5, T);   // staggered joints
    if (v >= 3 && ((c * 73 + r * 151) % 29) === 0) {                           // a dim service vent now and then, deep in the rock
      ctx.globalAlpha = 0.34; for (let i = 0; i < 3; i++) ctx.fillRect(x + 7, y + 9 + i * 5, 18, 2);
    }
  }
  ctx.restore();
}

const rooms = G.rooms = {
  current: null, trans: null,
  propNear(p) { return rooms.current.props.find(pr => !pr.gone && pr.near(p) && pr.prompt(p)); },
  // Start a faded move to another room. entry: { side: 'left' | 'right' } | { mark: index } | { gate: regionId } | { start: true }
  go(nodeId, entry) { if (!rooms.trans) rooms.trans = { phase: 'out', t: 0.16, to: nodeId, entry }; },
  // Switch rooms immediately.
  enter(nodeId, entry) {
    const node = G.run.graph.nodes[nodeId];
    const room = G.run.rooms[nodeId] || (G.run.rooms[nodeId] = instance(node));
    if (rooms.current && rooms.current !== room) G.combat.leave();         // scrip on the floor goes with the party
    rooms.current = room; room.enterAt = G.time; tiles.load(room.grid, room.terrain); G.combat.clear(); fx.clear();
    let x = 3 * T, y = groundY(room, 1), face = 1, landing = null;
    // The edge the party came in by: for ENTRY_GRACE seconds it does not lead out again (no instant bounce back through a hole).
    room.entrySide = entry.side || (entry.portal && ((room.def.portals || []).find(q => q.id === entry.portal) || {}).side) || null;
    // A home-area portal arrives as its edge does: a side portal on the floor under the opening, a top portal falling in,
    // a bottom portal standing on the grating over the hole (the hub's grates are one-way: arriving from below never falls back out).
    const portal = entry.portal && (room.def.portals || []).find(q => q.id === entry.portal);
    if (portal) {
      const mid = Math.floor((portal.from + portal.to) / 2);
      if (portal.side === 'left' || portal.side === 'right') {
        const c = portal.side === 'left' ? 1 : room.cols - 2; let r = portal.from;
        while (r < room.rows - 1 && !tiles.floorAt(c, r)) r++;
        entry = { at: { x: portal.side === 'left' ? 40 : room.cols * T - 40, y: r * T, face: portal.side === 'left' ? 1 : -1 } };
      } else if (portal.side === 'top') entry = { side: 'top', col: mid };
      else { let r = room.rows - 6; while (r < room.rows - 1 && !tiles.floorAt(mid, r)) r++; entry = { at: { x: (mid + .5) * T, y: r * T, face: -1 } }; }
    }
    if (entry.at) { x = entry.at.x; y = entry.at.y; face = entry.at.face || 1; }
    else if (entry.side === 'left') { x = 40; y = groundY(room, 1); }
    else if (entry.side === 'right') { x = room.cols * T - 40; y = groundY(room, room.cols - 2); face = -1; }
    else if (entry.side === 'top' || entry.side === 'bottom') {
      const port = entry.col !== undefined ? { c: entry.col } : room.def.ports[entry.side];
      x = ((port && port.c) !== undefined ? port.c + 0.5 : room.cols / 2) * T;
      y = entry.side === 'top' ? 8 : room.rows * T - 6;
      // Arriving from below: never over the open hole. Stand on the nearest stable floor beside it (a small hop for the feel of climbing out).
      if (entry.side === 'bottom') landing = bottomLanding(Math.floor(x / T), room);
    } else {
      let i = entry.mark;
      if (entry.gate) i = room.def.marks.findIndex((m, k) => node.content[k] && node.content[k].type === 'gate' && node.content[k].data.region === entry.gate);
      if (entry.start) i = room.def.marks.findIndex(m => m.ch === 'P');
      if (i >= 0 && room.def.marks[i]) ({ x, y } = markPos(room.def.marks[i]));
    }
    G.players.forEach((p, k) => {
      if (p.down && G.players.some(q => !q.down)) p.revive(1);   // co-op revive on entering a room
      if (landing) {
        p.place(landing.x + landing.dir * k * 14, landing.y, landing.dir || 1); p.inv = 0.5;
        p.onGround = false; p.vy = -260; p.safeX = landing.x; p.safeY = landing.y;
        return;
      }
      const vertical = entry.side === 'top' || entry.side === 'bottom';
      p.place(x + (vertical ? (k - (G.players.length - 1) / 2) * 14 : -face * k * 14), vertical && entry.side === 'top' ? p.h + 8 : y, face); p.inv = 0.5;
      if (vertical) {
        p.onGround = false; p.safeX = p.x; p.safeY = p.y;
        if (entry.side === 'top') p.vy = 140;
        else { p.vy = -C.MOVE.JUMP_V * 0.82; p.jumping = true; p.airJ = true; }
      }
    });
    const firstVisit = !node.seen;
    if (firstVisit) node.seen = true;
    if (G.story) G.story.enter(room, firstVisit);
    else if (firstVisit) {
      const reg = G.regionDefs[node.region], g = G.run.graph.regions[node.region];
      if (reg && g && g.first === nodeId) fx.say(reg.name, reg.blurb || '', 3);
    }
    G.cam.follow(0, x, y, true);
    if (G.world && G.world.prewarm) G.world.prewarm();      // the tile chunks of the first view are built now, under the room fade, not in the first drawn frame
  },
  // Close the boss door, pull stragglers inside and wake the boss.
  startFight(room) {
    const base = room.rows - C.CH, door = room.def.doorCol, lead = G.players.filter(p => !p.down).sort((a, b) => b.x - a.x)[0];
    room.fight = true;
    tiles.blockers.push({ c: door, r0: base + EXIT_ROWS[0], r1: base + EXIT_ROWS[2], on: true });
    for (const p of G.players) if (!p.down && p.x < (door + 1) * T + p.w) p.place(lead.x, lead.y, lead.face);
    if (G.story) G.story.wardenAwake(room.region);
    room.boss.start();
  },
  // The boss is down: open the door and add a doorway straight back to the hub.
  endFight(room) {
    room.fight = false; tiles.blockers = [];
    room.props.push(G.props.make('door', room.def.floorX[0] + 48, room.boss.floor, { to: G.run.graph.hub, entry: { gate: room.region }, label: 'Back to the Junction' }));
  },

  update(dt) {
    const tr = rooms.trans;
    if (tr) {
      tr.t -= dt;
      if (tr.t <= 0) { if (tr.phase === 'out') { rooms.enter(tr.to, tr.entry); tr.phase = 'in'; tr.t = 0.16; } else rooms.trans = null; }
      return;
    }
    const room = rooms.current, live = G.players.filter(p => !p.down), lead = live[0];
    if (room.mech) for (const s of Object.values(room.mech)) if (s.timer > 0) s.timer = Math.max(0, s.timer - dt);
    for (const p of G.players) p.update(dt);
    for (const pr of room.props) pr.update(dt);
    room.props = room.props.filter(pr => !pr.gone);
    for (const e of room.enemies) e.update(dt);
    // Enemies the party cannot reach must not hold the room (the 'Room clear' objective): one wedged inside rock for a second is lifted to
    // the first open tile above it; one that has left the room's bounds is dropped (no kill, no scrip).
    for (const e of room.enemies) {
      if (e.dead || !e.def) continue;
      if (e.y > room.rows * T + 96 || e.y < -96 || e.x < -96 || e.x > room.cols * T + 96) { e.lost = true; continue; }
      const ec = Math.floor(e.x / T), er = Math.floor((e.y - 1) / T);
      if (!e.def.flying && tiles.solid(ec, er)) {
        e._wedge = (e._wedge || 0) + dt;
        if (e._wedge > 1) { let rr = er; while (rr > 0 && tiles.solid(ec, rr)) rr--; e.y = (rr + 1) * T; e.vy = 0; e._wedge = 0; }
      } else e._wedge = 0;
    }
    if (room.enemies.some(e => e.lost)) room.enemies = room.enemies.filter(e => !e.lost);
    tiles.updateTerrain(dt, G.players.concat(room.enemies));
    if (room.enemies.some(e => e.dead)) { G.run.stats.kills += room.enemies.filter(e => e.dead).length; room.enemies = room.enemies.filter(e => !e.dead); }
    if (!room.cleared && !room.enemies.length) { room.cleared = true; if (lead) fx.floatText(lead.x, lead.y - 70, 'Room clear', '#e9e2cf'); }
    if (room.boss) {
      if (room.boss.state === 'sleep' && live.some(p => p.x > (room.def.doorCol + 2) * T)) rooms.startFight(room);
      room.boss.update(dt);
    }
    G.combat.update(dt);
    if (!G.meta.taught.tip_bounce && live.length) {         // the first spike pit a player comes up to: tell them about the bounce
      if (!room.spikes) { room.spikes = []; room.grid.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '^') room.spikes.push({ x: c * T + T / 2, y: r * T + T / 2 }); }); }
      if (room.spikes.some(k => live.some(p => Math.abs(p.x - k.x) < 190 && Math.abs(p.cy - k.y) < 150))) G.tips.fire('bounce');
    }

    // Teach authored terrain where it first matters. Positions are cached once per live room.
    if (live.length) {
      if (!room.terrainTips) {
        room.terrainTips = {};
        const kinds = { c:'crumble', j:'spring', v:'steam', s:'salt', m:'mud', t:'tar', '>':'belt', '<':'belt' };
        room.grid.forEach((row,r)=>{ for(let c=0;c<row.length;c++){ const id=kinds[row[c]]; if(id)(room.terrainTips[id]||(room.terrainTips[id]=[])).push({x:(c+.5)*T,y:(r+.5)*T}); } });
      }
      for (const id in room.terrainTips) {
        if (G.meta.taught['tip_'+id]) continue;
        if (room.terrainTips[id].some(k=>live.some(p=>Math.abs(p.x-k.x)<120&&Math.abs(p.cy-k.y)<105))) G.tips.fire(id);
      }
    }

    // side exits, and the invisible wall where there is none
    const W = room.cols * T, H = room.rows * T;
    // Home-area portals first: which opening of an edge a player leaves by decides where it leads.
    if (room.node.portals && !room.fight) {
      const out = p => p.x < -6 ? ['left', Math.floor((p.y - 1) / T)] : p.x > W + 6 ? ['right', Math.floor((p.y - 1) / T)]
        : p.y - p.h < T ? ['top', Math.floor(p.x / T)] : p.y > H + 8 ? ['bottom', Math.floor(p.x / T)] : null;   // top: once the head is in the roof hatch (a short hop from the ledge under it does it)
      for (const p of live) {
        const o = out(p); if (!o || inGrace(room, o[0])) continue;
        const q = room.node.portals.find(q => q.side === o[0] && o[1] >= q.lo - 1 && o[1] <= q.hi + 1);
        if (q) { rooms.go(q.dest, q.entry); return; }
      }
    }
    for (const p of live) {
      const side = p.x < -6 ? 'left' : p.x > W + 6 ? 'right' : p.y - p.h < -8 ? 'top' : p.y > H + 8 ? 'bottom' : null;
      if (side && inGrace(room, side)) {      // just arrived through this edge: hold the party in the room instead of bouncing it back
        if (side === 'left') p.x = p.w / 2; else if (side === 'right') p.x = W - p.w / 2;
        else if (side === 'top') { p.y = p.h + 2; p.vy = Math.max(0, p.vy); } else { p.y = H - 2; p.vy = Math.min(0, p.vy); }
        continue;
      }
      if (p.x < -6) { if (room.node.exits.left && !room.fight) { rooms.go(room.node.exits.left.to, room.node.exits.left.entry); break; } p.x = p.w / 2; }
      else if (p.x > W + 6) { if (room.node.exits.right && !room.fight) { rooms.go(room.node.exits.right.to, room.node.exits.right.entry); break; } p.x = W - p.w / 2; }
      else if (p.y - p.h < -8) { if (room.node.exits.top && !room.fight) { rooms.go(room.node.exits.top.to, room.node.exits.top.entry); break; } p.y = p.h + 2; p.vy = Math.max(0, p.vy); }
      else if (p.y > H + 8) { if (room.node.exits.bottom && !room.fight) { rooms.go(room.node.exits.bottom.to, room.node.exits.bottom.entry); break; } p.y = H - 2; p.vy = Math.min(0, p.vy); }
    }
    // co-op: the camera follows the party's middle; anyone left off-screen is pulled to the leader
    if (lead) {
      const cx = live.reduce((s, p) => s + p.x, 0) / live.length, cy = live.reduce((s, p) => s + p.y, 0) / live.length;
      G.cam.follow(dt, cx, cy);
      for (const p of live) if (p !== lead && (p.x < G.cam.x - 30 || p.x > G.cam.x + C.W + 30 || p.y < G.cam.y - 80 || p.y > G.cam.y + C.H + 80)) { p.place(lead.x, lead.y, lead.face); p.inv = 0.6; }
    }
  },

  draw(ctx, dt) {
    const room = rooms.current, pal = art.palette(room.region), sh = fx.shake;
    art.backdrop(ctx, pal, G.cam.x, G.time, room.region);
    ctx.save();
    ctx.translate(-Math.round(G.cam.x) + (sh ? U.rnd(-sh, sh) * 0.6 : 0), -Math.round(G.cam.y) + (sh ? U.rnd(-sh, sh) * 0.6 : 0));
    for (const pr of room.props) pr.draw(ctx);
    art.tiles(ctx, pal);
    if (!(G.artTest !== false && G.world && G.world.tilesOn && G.world.tilesOn())) drawInteriors(ctx, room, pal);   // the watercolor chunks paint their own deep-rock variety
    for (const e of room.enemies) e.draw(ctx);
    if (room.boss) room.boss.draw(ctx);
    G.combat.draw(ctx);
    for (const p of G.players) p.draw(ctx, dt);
    fx.draw(ctx);
    if (!rooms.trans) for (const p of G.players) {
      if (p.down || !p.onGround) continue;
      const pr = rooms.propNear(p);
      if (pr) { const L = pr.prompt(p); if (L && L[2]) L[2] = L[2].replace(/^Up\b/, G.input.name('interact', p)); G.props.drawPrompt(ctx, pr, L); break; }
    }
    ctx.restore();
  }
};
})();
