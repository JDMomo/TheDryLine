/* Main loop, the top-level state machine (title, play, pause, map, over) and the G.debug API used by tests. */
(() => {
'use strict';
const G = window.G, C = G.C;
const cv = document.getElementById('game'), ctx = cv.getContext('2d'), overlay = document.getElementById('start');
const any = G.input.any;

G.time = 0;
G.state = 'title';
let manual = false, last = 0, acc = 0;

// Holding Pause for LEAVE_T seconds in the Junction removes that player; a shorter press opens the pause menu when the button is let go.
const LEAVE_T = 1.0;
function hubPause(dt) {
  let open = false;
  for (const p of G.players.slice()) {
    if (p.in.held.pause) { p.leaveT = (p.leaveT || 0) + dt; if (p.leaveT >= LEAVE_T && !p.leftNow) { p.leftNow = true; if (G.players.length > 1) G.game.removePlayer(p); else open = true; } }
    else { if (p.leaveT > 0 && !p.leftNow) open = true; p.leaveT = 0; p.leftNow = false; }
  }
  return open;
}
// A controller of the party is gone: pause and say who. It comes back by reconnecting, or when another device presses a button.
function checkLost() {
  const lost = G.input.lost();
  if (!lost.length) { if (G.menus.lost.length && G.menus.lostPause && G.state === 'pause') G.state = 'play'; G.menus.lost = []; G.menus.lostPause = false; return; }
  if (G.state === 'play') { G.state = 'pause'; G.menus.open(G.players[0] && G.players[0].in.dev); G.menus.lostPause = true; }
  const dev = G.input.takeOver(G.players.filter(p => !lost.includes(p)).map(p => p.in.dev).concat(lost.map(p => p.in.dev)));
  if (dev) { lost[0].in.dev = dev; G.fx.say('Player ' + (lost[0].index + 1), 'now plays on ' + (dev === 'kb' ? 'the keyboard' : 'another controller'), 2.4); G.input.sync(); return checkLost(); }
  G.menus.lost = lost.map(p => p.index);
}

function step(dt) {
  G.time += dt;
  const pr = any.pressed;
  if (G.state === 'title') {
    const dev = G.input.claim();
    if (dev || pr.jump || pr.attack) { G.input.claimed = dev || 'kb'; G.game.newRun(G.game.parseCode(location.hash) ? location.hash.slice(1) : undefined); G.input.claimed = null; G.state = 'play'; }   // the first device to press a button is player 1; a #CODE in the address replays that run
  }
  else if (G.state === 'play') {
    const run = G.run, inHub = G.rooms.current.id === run.graph.hub;
    checkLost();
    if (G.state !== 'play') { G.input.endStep(); return; }
    if (inHub) {                                                    // new players may join at the Junction: any other device, by pressing Jump
      const dev = G.input.takeJoin(G.players.map(p => p.in.dev));
      if (dev && G.players.length < 4) G.game.addPlayer(dev);
    }
    if (!run.over) run.time += dt;
    G.rooms.update(dt); G.fx.update(dt); G.tips.update(dt); G.game.checkEnd();
    if (run.over) { run.overT += dt; if (run.overT > 1.4) G.state = 'over'; }
    else if (inHub ? (hubPause(dt) || (pr.pause && !G.players.some(p => p.in.held.pause))) : pr.pause) { G.state = 'pause'; G.menus.open(G.input.pauseDev() || (G.players[0] && G.players[0].in.dev)); }
    else if (pr.map) G.state = 'map';
  }
  else if (G.state === 'pause') {
    for (const p of G.players) { p.leaveT = 0; p.leftNow = !!p.in.held.pause; }          // a Pause press that closes the menu must not count again as a hold in the Junction
    checkLost(); if (G.state === 'pause') G.menus.pauseStep(pr);
  }
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
const autoPause = () => { if (G.state === 'play' && G.run && !G.run.over) { G.state = 'pause'; G.menus.open(G.players[0] && G.players[0].in.dev); } };
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
  hidePlayers: false,        // tests: draw no player (compare a picture with and without)
  fullCharts: false,         // tests that need every cut on every Warden: newRun then gives all four cuts to each region
  newRun(seed, cuts) {
    manual = true; G.game.newRun(seed, cuts); G.state = 'play';
    if (G.debug.fullCharts) for (const r in G.run.graph.chart) G.run.graph.chart[r] = Object.keys(G.CLASSES);
    return G.run.seed;
  },
  // Replace a region's lock chart (three cuts) before its fight starts, for tests that need a particular slot.
  chart(region, cuts) { G.run.graph.chart[region] = cuts.slice(); G.run.chart = G.run.graph.chart; },
  // key: a node id, a room template id, a region id (its first room) or 'kind:region', e.g. 'arena:r1', 'trial:r1', 'branch:r1'.
  gotoRoom(key, entry) { manual = true; const id = findNode(key); if (!id) return false; G.rooms.trans = null; G.rooms.enter(id, entry || { side: 'left' }); return true; },
  give(itemId, playerIndex = 0) { if (!G.itemDefs[itemId]) return false; G.game.takeItem(G.players[playerIndex], itemId); return true; },
  unlockAll() { for (const id in G.run.abil) G.run.abil[id] = true; },
  addPlayer() { return !!G.game.addPlayer(null); },
  // Hold (true) or release (false) actions for one player until changed again, e.g. setInput(0, { right: true, jump: false }).
  setInput(playerIndex, map) { const s = G.players[playerIndex].in; Object.assign(s.forced, map); G.input.syncState(s); },
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
      players: G.players.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, hp: p.hp, inv: p.inv, dev: p.in.dev, maxHp: run ? p.maxHp : 0, down: p.down, onGround: p.onGround, face: p.face,
        items: p.items.slice(), slots: p.slots, sel: p.sel, glow: p.glow, itemCd: p.itemCd })),
      run: run && { seed: run.seed, code: run.code, cuts: run.cuts.slice(), chart: JSON.parse(JSON.stringify(run.graph.chart)), time: run.time, shards: run.shards, abil: Object.assign({}, run.abil), spent: run.spent.slice(), trinkets: run.trinkets.slice(),
        beaten: Object.assign({}, run.beaten), over: run.over, stats: Object.assign({}, run.stats) },
      graph: run && Object.assign({ hub: run.graph.hub, regions: JSON.parse(JSON.stringify(run.graph.regions)), warnings: run.graph.warnings.slice(),
        count: Object.keys(run.graph.nodes).length }, G.worldgen.check(run.graph))
    };
  }
};
requestAnimationFrame(frame);
})();
