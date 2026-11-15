/* Heads-up display: party health and mend gauges, scrip, abilities, token slots, void tokens, trinkets, boss bar, banner, room fade. */
(() => {
'use strict';
const G = window.G, C = G.C, U = G.util, art = G.art;

const HUD_BG = '#0b1514', HUD_PLATE = 'rgba(6,11,11,0.86)';
function pips(ctx, p, x, y, size, gap) {
  for (let i = 0; i < p.maxHp; i++) {
    ctx.save(); ctx.translate(x + i * gap, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < p.hp ? '#fff3c4' : 'rgba(0,0,0,0.4)'; ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = i < p.hp ? p.color : '#5c6a63'; ctx.lineWidth = 2; ctx.strokeRect(-size / 2, -size / 2, size, size); ctx.restore();
  }
}
function gauge(ctx, p, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = p.glow >= C.MOVE.MEND_COST ? '#fff3c4' : '#8f8a78'; ctx.fillRect(x, y, w * p.glow / 99, h);
  ctx.fillStyle = '#0a1110'; ctx.fillRect(x + w / 3, y, 1.5, h); ctx.fillRect(x + 2 * w / 3, y, 1.5, h);
}
function slot(ctx, p, i, x, y, s) {
  const id = p.items[i], sel = id && i === p.sel, def = id && G.itemDefs[id];
  ctx.fillStyle = HUD_BG; ctx.fillRect(x, y, s, s);          // opaque: nothing in the room shows through a slot
  ctx.strokeStyle = sel ? def.color : '#3f6b5a'; ctx.lineWidth = sel ? 2.5 : 1.5; ctx.strokeRect(x, y, s, s);
  if (!def) return;
  G.items.icon(ctx, id, x + s / 2, y + s / 2 - 1, s / 36);
  ctx.fillStyle = G.CLASSES[def.cls].color; ctx.fillRect(x + 3, y + s - 5, s - 6, 2.5);
  if (s >= 30) { ctx.save(); ctx.translate(x + 8, y + 8); art.cutShape(ctx, G.CLASSES[def.cls].shape, 4.5); ctx.restore(); }   // the cut's shape, always shown
  if (sel && p.itemCd > 0) { const k = U.clamp(p.itemCd / (p.itemCdMax || 1), 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y + s * (1 - k), s, s * k); }
}

/* One-line contextual tips. G.tips.fire(id) shows the tip once ever (remembered in G.meta.taught), at the moment it matters.
   The wording follows the device used last (G.input.last). */
const N = a => G.input.name(a);
const TIPS = {
  token: () => N('item') + ' uses your token. ' + N('cycle') + ' switches tokens.',
  mend: () => 'Hold ' + N('heal') + ' on the ground to mend a pip with your gauge.',
  bounce: () => 'In the air over spikes, hold Down and slash (' + N('attack') + ') to bounce off them.',
  fare: () => 'A lit fare slot takes the token with the same shape. Not every cut has a slot: see the board and the map.'
};
const tipQ = [];
G.tips = {
  TIPS, queue: tipQ, shown: null,
  // Show a tip if it has never been shown. Returns true if it was queued.
  fire(id) {
    const k = 'tip_' + id;
    if (!TIPS[id] || G.meta.taught[k]) return false;
    G.meta.taught[k] = true; G.game.saveMeta();
    tipQ.push({ id, t: 6, max: 6 });
    return true;
  },
  text(id) { return TIPS[id] ? TIPS[id]() : ''; },
  update(dt) {
    if (G.tips.shown) { G.tips.shown.t -= dt; if (G.tips.shown.t <= 0) G.tips.shown = null; }
    if (!G.tips.shown && tipQ.length) G.tips.shown = tipQ.shift();
  },
  clear() { tipQ.length = 0; G.tips.shown = null; },
  draw(ctx) {
    const tp = G.tips.shown; if (!tp) return;
    const lines = G.props.wrap(ctx, G.tips.text(tp.id), 13.5, C.W - 160, 500), h = lines.length * 18 + 14;
    let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    const x0 = (C.W - w) / 2 - 12, y0 = C.H - 74 - h;
    ctx.globalAlpha = U.clamp(tp.t * 2, 0, 1) * U.clamp((tp.max - tp.t) * 4, 0, 1);
    ctx.fillStyle = 'rgba(6,11,11,0.88)'; ctx.fillRect(x0, y0, w + 24, h);
    ctx.strokeStyle = '#3f6b5a'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w + 23, h - 1);
    lines.forEach((l, i) => art.label(ctx, l, C.W / 2, y0 + 7 + 9 + i * 18, 13.5, '#fff3c4'));
    ctx.globalAlpha = 1;
  }
};

G.hud = {
  draw(ctx) {
    const run = G.run, room = G.rooms.current, p1 = G.players[0], W = C.W, H = C.H, fx = G.fx;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]);      // whatever the room drew, the HUD starts clean
    // plates behind the two corners, so the room never runs through the numbers or the token slots
    let abW = 0; ctx.font = '500 12px ' + C.FONT; for (const id in G.abilityDefs) abW += ctx.measureText(G.abilityDefs[id].name).width + 14;
    ctx.fillStyle = HUD_PLATE; ctx.fillRect(8, 8, Math.max(250, abW + 24), 78 + Math.max(0, G.players.length - 1) * 24);
    ctx.fillRect(W - 8 - (p1.slots * 50 + 30), 8, p1.slots * 50 + 30, 92);
    pips(ctx, p1, 30, 30, 15, 26); gauge(ctx, p1, 20, 50, 124, 7);
    ctx.save(); ctx.translate(162, 53.5); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#fff3c4'; ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    art.label(ctx, Math.floor(run.shards) + ' scrip', 174, 54, 14, '#e9e2cf', 'left', C.FONT, 600);
    let x = 20;
    for (const id in G.abilityDefs) {
      const name = G.abilityDefs[id].name; ctx.font = '500 12px ' + C.FONT;
      const w = ctx.measureText(name).width; art.label(ctx, name, x, 74, 12, run.abil[id] ? '#e9a23b' : '#4d5a54', 'left'); x += w + 14;
    }
    G.players.slice(1).forEach((p, k) => {
      const y = 98 + k * 24;
      pips(ctx, p, 26, y, 9, 15); gauge(ctx, p, 26 + p.maxHp * 15, y - 3, 50, 5);
      for (let i = 0; i < p.slots; i++) slot(ctx, p, i, 90 + p.maxHp * 15 + i * 24, y - 10, 20);
    });
    for (let i = 0; i < p1.slots; i++) slot(ctx, p1, i, W - 22 - (p1.slots - i) * 50, 16, 44);
    let ry = 74;
    const cur = p1.items[p1.sel];
    if (cur) { const d = G.itemDefs[cur]; art.label(ctx, d.name + '  ·  ' + G.CLASSES[d.cls].name + ' cut', W - 22, ry, 12, G.CLASSES[d.cls].color, 'right', C.FONT, 600); ry += 20; }
    else if (!p1.items.length) { art.label(ctx, 'No tokens. Slashes always work.', W - 22, ry, 12, '#9aa89f', 'right'); ry += 20; }
    if (run.spent.length) {
      art.label(ctx, 'Void', W - 26 - run.spent.length * 20, ry, 12, '#9aa89f', 'right');
      ctx.globalAlpha = 0.55; run.spent.forEach((id, i) => G.items.icon(ctx, id, W - 30 - (run.spent.length - 1 - i) * 20, ry, 0.6)); ctx.globalAlpha = 1; ry += 20;
    }
    run.trinkets.forEach((id, i) => G.trinkets.icon(ctx, id, W - 30 - i * 20, ry, 0.7));

    const b = room.boss;
    if (b && (room.fight || (b.state === 'dead' && b.t > -1.2))) {
      const bw = 520, bx = (W - bw) / 2, by = H - 34;
      art.label(ctx, 'Warden', bx, by - 14, 11, '#9aa89f', 'left');
      art.label(ctx, b.def.name, W / 2, by - 14, 16, '#e9e2cf', 'center', C.DISPLAY, 600);
      art.label(ctx, 'Fare slots', bx + bw + 18, by - 14, 11, '#9aa89f', 'left');
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, 9);
      ctx.fillStyle = b.rage ? '#d9603a' : '#e9a23b'; ctx.fillRect(bx, by, bw * U.clamp(b.hp / b.maxHp, 0, 1), 9);
      b.spots.forEach((s, i) => {
        const cx = bx + bw + 18 + i * 20;
        ctx.save(); ctx.translate(cx, by + 4.5); ctx.fillStyle = s.broken ? '#2a2f2d' : s.open ? G.CLASSES[s.cls].color : '#586068'; art.cutShape(ctx, G.CLASSES[s.cls].shape, 7.5); ctx.restore();
        if (s.broken) { ctx.strokeStyle = '#9aa89f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 5, by - 0.5); ctx.lineTo(cx + 5, by + 9.5); ctx.stroke(); }
      });
    }
    G.tips.draw(ctx);
    if (fx.banner) {
      const n = fx.banner;
      ctx.globalAlpha = U.clamp(n.t * 2.5, 0, 1) * U.clamp((n.max - n.t) * 6, 0, 1);
      art.label(ctx, n.a, W / 2, 124, 26, '#e9a23b', 'center', C.DISPLAY, 600);
      if (n.b) art.label(ctx, n.b, W / 2, 152, 14, '#e9e2cf');
      ctx.globalAlpha = 1;
    }
    const tr = G.rooms.trans;
    if (tr) { ctx.fillStyle = 'rgba(4,8,8,' + U.clamp(tr.phase === 'out' ? 1 - tr.t / 0.16 : tr.t / 0.16, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }
  }
};
})();
