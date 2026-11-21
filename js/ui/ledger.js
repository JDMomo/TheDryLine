/* The roguelike half's screens: the Ledger (feats done and not done, the token pool, the Timetable deck, the options for the next run), reachable from
   the title (Map button) and the pause menu (Map button); the Timetable card on the hub board, on the map, on the run-over screen and for the first
   seconds of a run (the title-to-Junction transition); and what each region's guarded plinth holds, on the map.
   Everything here wraps drawing and step functions of js/ui/menus.js, map.js, hud.js once (loaded after them), so those files stay as they are, except for one
   line in js/main.js: G.ledgerUI.titleStep(pr) in the title step. Drawing never changes game state; only the options page writes (G.ledger.setOption). */
(() => {
'use strict';
const G = window.G, C = G.C, art = G.art, W = C.W, H = C.H, U = G.util;
const L = G.ledger, CUTS = Object.keys(G.CLASSES);
const INTRO_T = 8;                                           // seconds the card stays over the first view of the Junction
const clock = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const ui = G.ledgerUI = { open: false, from: 'title', page: 0, sel: 0 };
const PAGES = ['Feats', 'Tokens', 'Timetable', 'Options'];
const GOLD = '#e9a23b', CREAM = '#e9e2cf', DIM = '#9aa89f', FAINT = '#5c6a63';
const kbName = a => G.input.label('keyboard', a), padName = a => G.input.label('gamepad', a);
const ledgerKey = () => kbName('map') + ' or ' + padName('map');

// A line of text cut to fit maxW (with an ellipsis).
function fit(ctx, t, maxW, size, weight = 500) {
  ctx.font = weight + ' ' + size + 'px ' + C.FONT;
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
const wrap = (ctx, t, size, maxW, weight = 500) => G.props.wrap(ctx, t, size, maxW, weight);
const tokenOf = id => G.itemDefs[id];

// ---------------------------------------------------------------- the Timetable card on the hub board (a prop type: worldgen places it next to the lock chart)
const PLATE_W = 176;
function plate(ctx, pr) {
  const rule = G.run && G.run.rule; if (!rule) return null;
  const lines = wrap(ctx, rule.text, 10, PLATE_W - 16), h = 40 + lines.length * 12 + 6;
  return { rule, lines, x0: pr.x - PLATE_W / 2, x1: pr.x + PLATE_W / 2, y0: pr.y - h, y1: pr.y };
}
G.props.TYPES.timetable = {
  boxes(pr, ctx) { const q = plate(ctx, pr); return q ? [{ x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1, kind: 'body' }] : []; },
  draw(pr, ctx) {
    const q = plate(ctx, pr); if (!q) return;
    ctx.fillStyle = '#5a4630'; ctx.fillRect(pr.x - 54, 32, 3, q.y0 - 32); ctx.fillRect(pr.x + 51, 32, 3, q.y0 - 32);                  // hanging cords
    ctx.fillStyle = '#8a6c46'; ctx.fillRect(q.x0, q.y0, PLATE_W, q.y1 - q.y0); ctx.fillStyle = '#1d1a14'; ctx.fillRect(q.x0 + 3, q.y0 + 3, PLATE_W - 6, q.y1 - q.y0 - 6);
    art.label(ctx, 'Timetable', pr.x, q.y0 + 12, 10, '#f4e6b8', 'center', C.FONT, 600);
    art.label(ctx, q.rule.name, pr.x, q.y0 + 27, 12.5, GOLD, 'center', C.FONT, 600);
    q.lines.forEach((t, i) => art.label(ctx, t, pr.x, q.y0 + 43 + i * 12, 10, CREAM, 'center'));
  }
};

// ---------------------------------------------------------------- the card for the first seconds of a run, and on the map and the run-over screen
function card(ctx, x, y, w, rule, opts) {
  const lines = wrap(ctx, rule.text, 13, w - 28), h = 52 + lines.length * 17 + (opts ? 20 : 0);
  ctx.fillStyle = 'rgba(6,11,11,0.88)'; ctx.fillRect(x - w / 2, y, w, h); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y, w, h);
  art.label(ctx, 'TIMETABLE FOR THIS RUN', x, y + 15, 10.5, DIM, 'center', C.FONT, 600);
  art.label(ctx, rule.name, x, y + 34, 20, GOLD, 'center', C.DISPLAY, 600);
  lines.forEach((t, i) => art.label(ctx, t, x, y + 56 + i * 17, 13, CREAM, 'center'));
  if (opts) art.label(ctx, opts, x, y + h - 14, 11.5, DIM, 'center');
  return h;
}
const optsText = run => {
  const o = run.opts || {}, parts = [];
  if (o.express) parts.push('Express mode'); if (o.start && L.commonOf(o.start)) parts.push('starting token: ' + L.commonOf(o.start).name);
  return parts.length ? 'Options: ' + parts.join(', ') : '';
};
const hudDraw = G.hud.draw;
// One message at a time (same rule as the tips): the card waits for the story banner and the room-name card, then stays INTRO_T seconds of free screen,
// low in the middle of the view where no HUD label is.
const intro = G.ledgerIntro = { run: null, left: 0, last: 0, shown: false, spot: 0, box: null };
// Where the intro card goes: a spot that covers no player and no Station Keeper (screen boxes), the previous spot first so it does not jump. Bottom, top, then the sides.
const introSpots = (w, h) => [{ cx: W / 2, y: G.C.H - 64 - h }, { cx: W / 2, y: 100 }, { cx: W - w / 2 - 14, y: 100 }, { cx: w / 2 + 14, y: 100 }, { cx: W - w / 2 - 14, y: G.C.H - 64 - h }, { cx: w / 2 + 14, y: G.C.H - 64 - h }];
function partyBoxes(room) {
  const cx = Math.round(G.cam.x), cy = Math.round(G.cam.y), out = [];
  for (const p of G.players) { const y = p.cy !== undefined ? p.cy : p.y - 24; out.push({ x0: p.x - cx - 50, x1: p.x - cx + 50, y0: y - cy - 70, y1: y - cy + 60 }); }
  for (const pr of room.props) if (pr.type === 'guide') out.push({ x0: pr.x - cx - 60, x1: pr.x - cx + 60, y0: pr.y - cy - 100, y1: pr.y - cy + 10 });
  return out;
}
const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
function introAt(room, w, h) {
  const boxes = partyBoxes(room), spots = introSpots(w, h), clear = s => !boxes.some(b => hits({ x0: s.cx - w / 2, x1: s.cx + w / 2, y0: s.y, y1: s.y + h }, b));
  const prev = spots[intro.spot];
  const pick = prev && clear(prev) ? prev : spots.find(clear) || spots[0];
  intro.spot = spots.indexOf(pick); intro.box = { x0: pick.cx - w / 2, x1: pick.cx + w / 2, y0: pick.y, y1: pick.y + h };
  return pick;
}

G.hud.draw = function (ctx) {
  hudDraw.apply(this, arguments);
  const run = G.run, room = G.rooms && G.rooms.current;
  if (intro.run !== run) { intro.run = run; intro.left = INTRO_T; intro.last = G.time; intro.shown = false; }
  intro.shown = false; intro.box = null;
  if (G.state === 'play' && run && run.rule && !run.over && room && intro.left > 0) {
    const waiting = !!(G.fx && G.fx.banner) || (room.enterAt !== undefined && G.time - room.enterAt < 2.6) || G.tips.shown;
    const dt = Math.min(0.1, Math.max(0, G.time - intro.last));
    if (!waiting) {
      intro.left -= dt; intro.shown = true;
      ctx.save(); ctx.globalAlpha = Math.min(1, intro.left / 1.2, 0.2 + (INTRO_T - intro.left) / 0.4);
      const o = optsText(run), w = 440, text = o ? o : 'Run code ' + run.code;
      const lines = wrap(ctx, run.rule.text, 13, w - 28), h = 52 + lines.length * 17 + 20, at = introAt(room, w, h);
      card(ctx, at.cx, at.y, w, run.rule, text);
      ctx.restore();
    }
  }
  intro.last = G.time;
};

// ---------------------------------------------------------------- objectives: why a lost trunk is shut, and which enemy is left
// A trunk opens when the room is clear. While one is shut a line at the top says how many enemies are left; after 20 s in the room the last two
// are marked with a ring (and an arrow at the screen edge when they are out of view), so a hunt is never a guessing game.
G.objective = { text: '', marks: 0 };
const hudObjective = G.hud.draw;
G.hud.draw = function (ctx) {
  hudObjective.apply(this, arguments);
  const room = G.rooms && G.rooms.current, obj = G.objective; obj.text = ''; obj.marks = 0;
  if (G.state !== 'play' || !room || room.cleared || room.boss || room.fight || (G.fx && G.fx.banner)) return;
  if (!room.props.some(p => p.type === 'trunk' && !p.gone)) return;
  const live = room.enemies.filter(e => !e.dead && e.hp > 0), n = live.length; if (!n) return;
  obj.text = 'Lost trunk: clear the room to open it (' + n + ' left)';
  ctx.save(); ctx.font = '600 13px ' + C.FONT; const w = ctx.measureText(obj.text).width + 28;
  ctx.fillStyle = 'rgba(6,11,11,0.78)'; ctx.fillRect(W / 2 - w / 2, 46, w, 24);
  art.label(ctx, obj.text, W / 2, 63, 13, CREAM, 'center'); ctx.restore();
  if (n <= 2 && G.time - (room.enterAt || 0) > 20) {
    const cx = Math.round(G.cam.x), cy = Math.round(G.cam.y), pulse = 0.6 + 0.4 * Math.sin(G.time * 5);
    obj.marks = n;
    for (const e of live) {
      const sx = e.x - cx, sy = (e.cy !== undefined ? e.cy : e.y - 20) - cy, inView = sx > 10 && sx < W - 10 && sy > 10 && sy < G.C.H - 10;
      ctx.save(); ctx.strokeStyle = GOLD; ctx.fillStyle = GOLD; ctx.lineWidth = 2; ctx.globalAlpha = pulse;
      if (inView) { ctx.beginPath(); ctx.arc(sx, sy, 30 + 4 * pulse, 0, 6.283); ctx.stroke(); }
      else { const ax = U.clamp(sx, 20, W - 20), ay = U.clamp(sy, 90, G.C.H - 40), ang = Math.atan2(sy - ay, sx - ax);
        ctx.translate(ax, ay); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  }
};

// ---------------------------------------------------------------- the map: the card, each plinth's token, a delayed line
const mapDraw = G.map.draw;
G.map.draw = function (ctx) {
  mapDraw.apply(this, arguments);
  const run = G.run, graph = run.graph, rule = run.rule;
  if (rule) {
    art.label(ctx, 'Timetable: ' + rule.name, 24, 20, 12.5, GOLD, 'left', C.FONT, 600);
    art.label(ctx, fit(ctx, rule.text, W - 48, 11), 24, 33, 11, CREAM, 'left');
  }
  // the rows of js/ui/map.js: first row at hy + 58, rowH = min(80, (H - 146) / regions); the left column under the region name
  const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), rowH = Math.min(80, (H - 146) / order.length), gone = new Set([...G.game.partyItems(), ...run.spent, ...(run.cracked || [])]);
  order.forEach((reg, ri) => {
    const y = 66 + 58 + ri * rowH, g = graph.regions[reg.id]; if (!g) return;
    if (g.delayed) art.label(ctx, 'Running late', 150, y + 48, 11.5, GOLD, 'left', C.FONT, 600);
    const id = graph.draw && graph.draw.plinth[reg.id];
    if (!id || !tokenOf(id) || (run.grades || {})[reg.id]) return;
    const d = tokenOf(id), cx = 30;
    ctx.save(); ctx.translate(cx, y + 62); ctx.fillStyle = d.color; art.cutShape(ctx, G.CLASSES[d.cls].shape, 5); ctx.restore();
    art.label(ctx, fit(ctx, 'Plinth: ' + d.name + (gone.has(id) ? ' (taken)' : ''), 226, 11.5, 600), cx + 12, y + 62, 11.5, gone.has(id) ? FAINT : d.color, 'left', C.FONT, 600);
  });
};

// ---------------------------------------------------------------- the run-over screen: the card and the feats this run earned
const overDraw = G.menus.over;
G.menus.over = function (ctx) {
  overDraw.apply(this, arguments);
  const run = G.run; if (!run) return;
  if (run.rule) {
    art.label(ctx, 'Timetable: ' + run.rule.name + (optsText(run) ? '   ·   ' + optsText(run) : ''), W / 2, 14, 13, GOLD, 'center', C.FONT, 600);
    art.label(ctx, fit(ctx, run.rule.text, W - 40, 11.5), W / 2, 30, 11.5, CREAM, 'center');
  }
  const fresh = (run.featsNew || []).map(L.featById).filter(Boolean);
  if (fresh.length) {
    art.label(ctx, 'Feats earned: ' + fresh.map(f => f.name).join(', '), W / 2, H - 34, 13, GOLD, 'center', C.FONT, 600);
    art.label(ctx, fit(ctx, fresh.map(f => L.unlockText(f.unlock)).join(' '), W - 40, 11), W / 2, H - 16, 11, DIM, 'center');
  } else art.label(ctx, 'The Ledger (' + ledgerKey() + ' on the title or pause screen) lists every feat and what it unlocks.', W / 2, H - 16, 11, FAINT, 'center');
};

// ---------------------------------------------------------------- the Ledger screen
const done = f => !!(G.meta.feats && G.meta.feats[f.id]);
function icon(ctx, id, x, y, s = 1) { G.items.icon(ctx, id, x, y, s); }
// why a token is not in the pool yet, in words
function tokenState(d) {
  const feats = G.meta.feats, led = L.unlocked();
  if (d.rarity === 'rare') return G.meta.cuts.includes(d.cls) ? ['In the pool', true] : ['Punch a ' + d.cls + ' slot to unlock', false];
  if (d.rarity === 'ledger') { const f = L.FEATS.find(f => f.unlock && f.unlock.id === d.id); return led.tokens.includes(d.id) ? ['In the pool (' + f.name + ')', true] : ['Feat: ' + f.name, false]; }
  return ['In the pool', true];
}
function drawFeats(ctx) {
  const col = [24, W / 2 + 6], rowW = W / 2 - 36, n = L.FEATS.length, per = Math.ceil(n / 2);
  const total = L.FEATS.filter(done).length;
  art.label(ctx, total + ' of ' + n + ' feats done', W - 24, 74, 12, DIM, 'right');
  L.FEATS.forEach((f, i) => {
    const c = Math.floor(i / per), r = i % per, x = col[c], y0 = 92 + r * 60, ok = done(f);
    ctx.fillStyle = ok ? 'rgba(63,107,90,0.28)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(x, y0, rowW, 54);
    ctx.strokeStyle = ok ? '#6fbf94' : '#2a3a35'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y0, rowW, 54);
    ctx.strokeStyle = ok ? '#9fd6a8' : FAINT; ctx.lineWidth = 2; ctx.strokeRect(x + 8, y0 + 8, 12, 12);
    if (ok) { ctx.beginPath(); ctx.moveTo(x + 10, y0 + 14); ctx.lineTo(x + 13.5, y0 + 18); ctx.lineTo(x + 19, y0 + 9); ctx.stroke(); }
    art.label(ctx, f.name, x + 30, y0 + 14, 13, ok ? '#fff3c4' : CREAM, 'left', C.FONT, 600);
    art.label(ctx, ok ? 'Done' : 'Not done', x + rowW - 8, y0 + 14, 11, ok ? '#9fd6a8' : FAINT, 'right', C.FONT, 600);
    art.label(ctx, fit(ctx, f.text, rowW - 20, 11), x + 10, y0 + 31, 11, DIM, 'left');
    art.label(ctx, fit(ctx, 'Unlocks: ' + L.unlockText(f.unlock).replace(/^Adds /, '').replace(/^Unlocks /, ''), rowW - 20, 10.5), x + 10, y0 + 46, 10.5, f.unlock ? GOLD : FAINT, 'left');
  });
}
function drawTokens(ctx) {
  const ids = [], by = c => Object.values(G.itemDefs).filter(d => d.cls === c).sort((a, b) => ['common', 'fixed', 'rare', 'ledger'].indexOf(a.rarity) - ['common', 'fixed', 'rare', 'ledger'].indexOf(b.rarity));
  const cw = (W - 48) / 4;
  let inPool = 0;
  CUTS.forEach((cut, ci) => {
    const x = 24 + ci * cw;
    ctx.save(); ctx.translate(x + 8, 92); ctx.fillStyle = G.CLASSES[cut].color; art.cutShape(ctx, G.CLASSES[cut].shape, 7); ctx.restore();
    art.label(ctx, G.CLASSES[cut].name, x + 22, 92, 14, G.CLASSES[cut].color, 'left', C.FONT, 600);
    by(cut).forEach((d, k) => {
      const [txt, on] = tokenState(d), y = 112 + k * 88; if (on) inPool++;
      ctx.fillStyle = on ? 'rgba(63,107,90,0.22)' : 'rgba(255,255,255,0.03)'; ctx.fillRect(x, y, cw - 10, 80); ctx.strokeStyle = on ? '#3f6b5a' : '#2a3a35'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, cw - 10, 80);
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.35; icon(ctx, d.id, x + 22, y + 24, 1.1); ctx.restore();
      art.label(ctx, fit(ctx, d.name, cw - 56, 12.5, 600), x + 42, y + 14, 12.5, on ? CREAM : FAINT, 'left', C.FONT, 600);
      art.label(ctx, fit(ctx, txt, cw - 56, 10.5), x + 42, y + 30, 10.5, on ? '#9fd6a8' : GOLD, 'left');
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.5; G.materials.drawChips(ctx, d.mat, x + 8, y + 50, 'left'); ctx.restore();
      art.label(ctx, fit(ctx, d.desc, cw - 24, 9.5), x + 8, y + 68, 9.5, DIM, 'left');
    });
  });
  art.label(ctx, inPool + ' of ' + Object.keys(G.itemDefs).length + ' tokens are in the pool. Each run draws about 7 of them: 4 plinths, 2 trunks, 1 ticket machine.', W / 2, 476, 12, DIM);
}
function drawDeck(ctx) {
  const unl = L.unlocked().cards, cw = (W - 60) / 2, per = Math.ceil(L.CARDS.length / 2);
  L.CARDS.forEach((c, i) => {
    const col = Math.floor(i / per), r = i % per, x = 24 + col * (cw + 12), y = 92 + r * 78, on = !c.locked || unl.includes(c.id);
    ctx.fillStyle = on ? 'rgba(63,107,90,0.22)' : 'rgba(255,255,255,0.03)'; ctx.fillRect(x, y, cw, 70); ctx.strokeStyle = on ? '#3f6b5a' : '#2a3a35'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, cw, 70);
    art.label(ctx, c.name, x + 10, y + 14, 14, on ? GOLD : FAINT, 'left', C.FONT, 600);
    const f = L.FEATS.find(f => f.unlock && f.unlock.id === c.id);
    art.label(ctx, on ? (c.locked ? 'Unlocked (' + f.name + ')' : 'In the deck') : 'Feat: ' + f.name, x + cw - 10, y + 14, 11, on ? '#9fd6a8' : FAINT, 'right', C.FONT, 600);
    const lines = wrap(ctx, c.about || c.text(L.makeRule(c.id, 1)), 11, cw - 20);
    lines.slice(0, 3).forEach((t, k) => art.label(ctx, t, x + 10, y + 32 + k * 14, 11, on ? CREAM : FAINT, 'left'));
  });
  art.label(ctx, 'Each run rolls one card from the deck, from its seed: the same run code always has the same card.', W / 2, 500, 12, DIM);
}
const OPT_ROWS = ['start', 'express'];
function drawOptions(ctx) {
  const unl = L.unlocked(), o = L.options(unl);
  const row = (i, y, title, value, locked, help) => {
    const on = ui.sel === i;
    if (on) { ctx.fillStyle = 'rgba(233,162,59,0.16)'; ctx.fillRect(60, y - 22, W - 120, 66); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.strokeRect(60, y - 22, W - 120, 66); }
    art.label(ctx, title, 80, y, 16, locked ? FAINT : on ? '#fff3c4' : CREAM, 'left', C.FONT, 600);
    art.label(ctx, value, W - 80, y, 16, locked ? FAINT : GOLD, 'right', C.FONT, 600);
    art.label(ctx, help, 80, y + 24, 12, DIM, 'left');
  };
  const st = o.start && L.commonOf(o.start) ? L.commonOf(o.start).name + ' (' + o.start + ')' : 'None';
  row(0, 130, 'Starting token', unl.start ? st : 'Locked', !unl.start, unl.start ? 'Begin the run holding the common token of one cut; it is not drawn again that run. Jump to change.' : 'Feat: Full Fare (punch all three fare slots of one Warden).');
  row(1, 230, 'Express mode', unl.express ? (o.express ? 'On' : 'Off') : 'Locked', !unl.express, unl.express ? 'Every Warden has 15% more health and the party starts with one health pip fewer. Jump to switch.' : 'Feat: The Clock Stops (beat the Long Clock).');
  art.label(ctx, 'Options are saved and apply to the next run. They are part of the run code, so a code replays them.', W / 2, 340, 12.5, DIM);
  art.label(ctx, 'Next run: ' + (o.express ? 'Express mode' : 'normal') + ', ' + (o.start ? 'starting with ' + L.commonOf(o.start).name : 'no starting token') + '.', W / 2, 366, 13, CREAM);
}
function drawLedger(ctx, behind) {
  if (behind === 'title') { art.backdrop(ctx, art.palette('hub'), G.time * 12, G.time); ctx.fillStyle = 'rgba(6,11,11,0.78)'; ctx.fillRect(0, 0, W, H); }
  else { ctx.fillStyle = 'rgba(6,11,11,0.96)'; ctx.fillRect(0, 0, W, H); }
  art.label(ctx, 'The Ledger', W / 2, 26, 26, GOLD, 'center', C.DISPLAY, 600);
  PAGES.forEach((p, i) => {
    const x = W / 2 + (i - 1.5) * 150, on = ui.page === i;
    art.label(ctx, p, x, 56, on ? 15 : 13.5, on ? '#fff3c4' : DIM, 'center', C.FONT, on ? 600 : 500);
    if (on) { ctx.fillStyle = GOLD; ctx.fillRect(x - 38, 66, 76, 2); }
  });
  [drawFeats, drawTokens, drawDeck, drawOptions][ui.page](ctx);
  art.label(ctx, 'Left and Right: page   ·   ' + (ui.page === 3 ? 'Up and Down: choose, Jump: change   ·   ' : '') + 'Pause or ' + kbName('map') + ': back.   Feats unlock options, never power.', W / 2, H - 14, 11.5, DIM);
}
function ledgerStep(pr) {
  if (pr.pause || pr.map || pr.attack || pr.dash) { ui.open = false; if (ui.from === 'pause') G.menus.menu.page = 'main'; return; }
  if (pr.left) ui.page = (ui.page + PAGES.length - 1) % PAGES.length; else if (pr.right) ui.page = (ui.page + 1) % PAGES.length;
  else if (ui.page === 3) {                                          // Options: Up and Down choose a row, Jump changes it (to the next value)
    if (pr.up || pr.down) ui.sel = (ui.sel + 1) % OPT_ROWS.length;
    else if (pr.jump) {
      const unl = L.unlocked(), o = L.options(unl);
      if (OPT_ROWS[ui.sel] === 'start' && unl.start) { const i = (CUTS.indexOf(o.start) + 2) % 5; L.setOption('start', i ? CUTS[i - 1] : null); }
      else if (OPT_ROWS[ui.sel] === 'express' && unl.express) L.setOption('express', !o.express);
    }
  }
}
Object.assign(ui, {
  // Open the Ledger from the title ('title') or the pause menu ('pause').
  show(from) { ui.open = true; ui.from = from; ui.page = 0; ui.sel = 0; if (from === 'pause') G.menus.menu.page = 'ledger'; },
  // js/main.js calls this in the title step: true while the Ledger has the title (it takes the presses), or when the Map button opens it.
  titleStep(pr) {
    if (ui.open && ui.from === 'title') { ledgerStep(pr); return true; }
    if (pr.map) { ui.show('title'); return true; }
    return false;
  },
  step: ledgerStep, draw: drawLedger
});

// ---------------------------------------------------------------- title and pause: the Ledger is one button away
const titleDraw = G.menus.title;
G.menus.title = function (ctx) {
  if (ui.open && ui.from === 'title') return drawLedger(ctx, 'title');
  titleDraw.apply(this, arguments);
  const n = L.FEATS.filter(done).length, o = L.options();
  art.label(ctx, 'The Ledger: ' + ledgerKey() + '   ·   Feats ' + n + ' of ' + L.FEATS.length + (o.express || o.start ? '   ·   Next run: ' + [o.express ? 'Express' : '', o.start ? 'start ' + L.commonOf(o.start).name : ''].filter(Boolean).join(', ') : ''), W / 2, H - 18, 12.5, GOLD);
};
const pauseStep = G.menus.pauseStep, pauseDraw = G.menus.pause;
G.menus.pauseStep = function (pr) {
  const menu = G.menus.menu;
  if (menu.page === 'ledger') return ledgerStep(pr);
  if (menu.page === 'main' && pr.map && !G.menus.lost.length) { ui.show('pause'); return; }
  return pauseStep.apply(this, arguments);
};
G.menus.pause = function (ctx) {
  if (G.menus.menu.page === 'ledger') return drawLedger(ctx, 'pause');
  pauseDraw.apply(this, arguments);
  if (G.menus.menu.page === 'main') art.label(ctx, G.input.name('map', G.menus.menu.type) + ': the Ledger', W / 2 + 190, (H - 490) / 2 + 34, 12.5, GOLD, 'right', C.FONT, 600);
};
})();
