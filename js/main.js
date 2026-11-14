/* Main loop, the top-level state machine (title, play, pause, map, over) and the G.debug API used by tests. */
(() => {
'use strict';
const G = window.G, C = G.C;
const cv = document.getElementById('game'), ctx = cv.getContext('2d'), overlay = document.getElementById('start');
const any = G.input.any;

G.time = 0;
G.state = 'title';
let manual = false, last = 0, acc = 0;

function step(dt) {
  G.time += dt;
  const pr = any.pressed;
  if (G.state === 'title') { if (pr.jump || pr.attack) { G.game.newRun(); G.state = 'play'; } }
  else if (G.state === 'play') {
    const run = G.run;
    if (G.rooms.current.id === run.graph.hub) {                     // new players may join at the Junction
      const pad = G.input.takeJoin(G.players.map(p => p.in.pad));
      if (pad >= 0) G.game.addPlayer(pad);
    }
    if (!run.over) run.time += dt;
    G.rooms.update(dt); G.fx.update(dt); G.tips.update(dt); G.game.checkEnd();
    if (run.over) { run.overT += dt; if (run.overT > 1.4) G.state = 'over'; }
    else if (pr.pause) { G.state = 'pause'; G.menus.open(); }
    else if (pr.map) G.state = 'map';
  }
  else if (G.state === 'pause') G.menus.pauseStep(pr);
  else if (G.state === 'map') { if (pr.map || pr.pause) G.state = 'play'; }
  else if (G.state === 'over') { if (pr.jump) { G.game.newRun(); G.state = 'play'; } }
  G.input.endStep();
}

function render(dt) {
  const s = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== C.W * s) { cv.width = C.W * s; cv.height = C.H * s; }
  ctx.setTransform(s, 0, 0, s, 0, 0);
  if (G.state === 'title') return G.menus.title(ctx);
  G.rooms.draw(ctx, dt); G.hud.draw(ctx);
  if (G.state === 'pause') G.menus.pause(ctx);
  else if (G.state === 'map') G.map.draw(ctx);
  else if (G.state === 'over') G.menus.over(ctx);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
  G.input.poll();
  if (!manual) {
    if (G.fx.hitstop > 0 && G.state === 'play') G.fx.hitstop -= dt;
    else { acc += dt; while (acc >= C.STEP) { step(C.STEP); acc -= C.STEP; } }
  }
  if (G.state !== 'title') overlay.hidden = true;
  render(dt);
  requestAnimationFrame(frame);
}
// Losing the window's focus pauses a run in progress (nothing is lost while the player is away).
const autoPause = () => { if (G.state === 'play' && G.run && !G.run.over) { G.state = 'pause'; G.menus.open(); } };
addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
overlay.addEventListener('click', () => { overlay.hidden = true; cv.focus(); });
cv.addEventListener('pointerdown', () => cv.focus());

/* Test and tooling API. Every call that changes the game switches it to manual stepping: from then on only step(n) advances it
   (the page keeps drawing). A check drives the game through these calls and reads state(); it never touches anything else. */
const findNode = key => {
  const g = G.run.graph;
  if (g.nodes[key]) return key;
  if (g.regions[key]) return g.regions[key].first;
  const [kind, region] = String(key).split(':');
  return Object.keys(g.nodes).find(id => g.nodes[id].def === key || (region && g.nodes[id].region === region && G.roomDefs[g.nodes[id].def].kind === kind));
};
const regionOf = id => G.regionDefs[id] ? id : Object.keys(G.regionDefs).find(r => G.regionDefs[r].boss === id);
G.debug = {
  godMode: false,
  newRun(seed) { manual = true; G.game.newRun(seed); G.state = 'play'; return G.run.seed; },
  // key: a node id, a room template id, a region id (its first room) or 'kind:region', e.g. 'arena:r1', 'trial:r1', 'branch:r1'.
  gotoRoom(key, entry) { manual = true; const id = findNode(key); if (!id) return false; G.rooms.trans = null; G.rooms.enter(id, entry || { side: 'left' }); return true; },
  give(itemId, playerIndex = 0) { if (!G.itemDefs[itemId]) return false; G.game.takeItem(G.players[playerIndex], itemId); return true; },
  unlockAll() { for (const id in G.run.abil) G.run.abil[id] = true; },
  addPlayer() { return !!G.game.addPlayer(-1); },
  // Hold (true) or release (false) actions for one player until changed again, e.g. setInput(0, { right: true, jump: false }).
  setInput(playerIndex, map) { Object.assign(G.players[playerIndex].in.forced, map); G.input.sync(); },
  step(n = 1) { manual = true; for (let i = 0; i < n; i++) step(C.STEP); },
  // id: a region id or a boss id. Goes to that region's arena, puts the party inside the boss door and wakes the boss.
  startBoss(id) {
    const r = regionOf(id);
    if (!r || !G.debug.gotoRoom('arena:' + r)) return false;
    const room = G.rooms.current;
    if (!room.boss) return false;
    G.players.forEach((p, k) => p.place(room.def.floorX[0] + 2 * C.T + k * 14, room.boss.floor, 1));
    G.rooms.startFight(room); return true;
  },
  god(on) { G.debug.godMode = !!on; },
  // Put player i at a point (feet centre) with no motion.
  place(i, x, y, face = 1) { G.players[i].place(x, y, face); },
  // Pin the active boss: every step the fields are copied onto it and its attacks do not run, e.g. { x: 720, face: -1, rear: 0 }. null releases it.
  holdBoss(fields) { const b = G.rooms.current.boss; if (b) b.held = fields || null; return !!b; },
  // What player i would walk into next, for simple test bots: a wall, or a gap (no floor within 3 tiles below, or spikes).
  probe(i = 0) {
    const p = G.players[i], T = C.T, f = p.in.held.left ? -1 : 1, tl = G.tiles;
    const cAhead = Math.floor((p.x + f * (p.w / 2 + 10)) / T), rFeet = Math.floor((p.y - 1) / T);
    let gap = true;
    for (let r = rFeet + 1; r <= rFeet + 3; r++) {
      if (tl.spike(cAhead, r)) break;
      if (tl.floorAt(cAhead, r)) { gap = false; break; }
    }
    return { wall: tl.solid(cAhead, rFeet) || tl.solid(cAhead, rFeet - 1), gap, onGround: p.onGround };
  },
  // A plain summary of everything a check may read.
  state() {
    const room = G.rooms.current, b = room && room.boss, run = G.run;
    return {
      state: G.state, time: G.time, errors: G.errors.slice(),
      room: room && { id: room.id, def: room.def.id, region: room.region, kind: room.kind, cols: room.cols, rows: room.rows, cleared: room.cleared, fight: room.fight,
        locked: G.tiles.blockers.some(k => k.on), transition: !!G.rooms.trans,
        enemies: room.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp })), props: room.props.map(p => ({ type: p.type, x: p.x, y: p.y, data: JSON.parse(JSON.stringify(p.data)) })),
        boss: b && { id: b.id, hp: b.hp, maxHp: b.maxHp, state: b.state, x: b.x, y: b.y, face: b.face, floor: b.floor, minX: b.minX, maxX: b.maxX,
          spots: b.spots.map(s => ({ cls: s.cls, name: s.def.name, hp: s.hp, open: s.open, broken: s.broken })) } },
      players: G.players.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, hp: p.hp, maxHp: run ? p.maxHp : 0, down: p.down, onGround: p.onGround, face: p.face,
        items: p.items.slice(), slots: p.slots, sel: p.sel, glow: p.glow, itemCd: p.itemCd })),
      run: run && { seed: run.seed, time: run.time, shards: run.shards, abil: Object.assign({}, run.abil), spent: run.spent.slice(), trinkets: run.trinkets.slice(),
        beaten: Object.assign({}, run.beaten), over: run.over, stats: Object.assign({}, run.stats) },
      graph: run && Object.assign({ hub: run.graph.hub, regions: JSON.parse(JSON.stringify(run.graph.regions)), warnings: run.graph.warnings.slice(),
        count: Object.keys(run.graph.nodes).length }, G.worldgen.check(run.graph))
    };
  }
};
requestAnimationFrame(frame);
})();
