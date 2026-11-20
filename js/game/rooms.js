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
  G.roomDefs[def.id] = room;
};

const markPos = m => ({ x: m.c * T + T / 2, y: (m.r + 1) * T });

// Build the live room for a graph node: props, enemies and the boss come from the node's pre-rolled content.
function instance(node) {
  const def = G.roomDefs[node.def];
  const room = { node, id: node.id, def, region: node.region, kind: def.kind, grid: def.grid.slice(), cols: def.cols, rows: def.rows,
    props: [], enemies: [], boss: null, cleared: false, fight: false, terrain: { crumble: {} } };
  tiles.load(room.grid, room.terrain);                 // enemy and boss constructors read the room size
  def.marks.forEach((m, i) => {
    const c = node.content[i], { x, y } = markPos(m);
    if (!c) return;
    if (c.type === 'enemy') { const d = G.enemyDefs[c.id], e = new G.Enemy(d, x, d.flying ? y - 8 : y); e.applyScale((G.regionDefs[node.region] || {}).scale); if (c.elite) e.makeElite(); room.enemies.push(e); }
    else if (c.type === 'boss') { if (!G.run.beaten[node.region]) room.boss = new G.Boss(G.bossDefs[c.id], x, y, node.region, { x0: def.floorX[0], x1: def.floorX[1] }); }
    else if (c.type !== 'start') room.props.push(G.props.make(c.type, x, y, Object.assign({}, c.data)));
  });
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
    let x = 3 * T, y = groundY(room, 1), face = 1;
    if (entry.side === 'left') { x = 40; y = groundY(room, 1); }
    else if (entry.side === 'right') { x = room.cols * T - 40; y = groundY(room, room.cols - 2); face = -1; }
    else if (entry.side === 'top' || entry.side === 'bottom') {
      const port = room.def.ports[entry.side];
      x = ((port && port.c) !== undefined ? port.c + 0.5 : room.cols / 2) * T;
      y = entry.side === 'top' ? 8 : room.rows * T - 6;
    } else {
      let i = entry.mark;
      if (entry.gate) i = room.def.marks.findIndex((m, k) => node.content[k] && node.content[k].type === 'gate' && node.content[k].data.region === entry.gate);
      if (entry.start) i = room.def.marks.findIndex(m => m.ch === 'P');
      if (i >= 0 && room.def.marks[i]) ({ x, y } = markPos(room.def.marks[i]));
    }
    G.players.forEach((p, k) => {
      if (p.down && G.players.some(q => !q.down)) p.revive(1);   // co-op revive on entering a room
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
    for (const p of live) {
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
