/* Map overlay (Tab or Back). Top: the tokens the party holds, each with its cut's shape and colour. Then one row for the Junction and
   one per region: a box per room (seen, here, unseen), the Warden's sigil on the last box and whether it has fallen, what every
   side room found so far holds, and a line naming the Warden's three charted fare slots by cut so the party can plan its tokens.
   With the Surveyor's Slate (mods.revealMap) the side rooms not yet entered show what they hold too. */
(() => {
'use strict';
const G = window.G, C = G.C, art = G.art;
const W = C.W, H = C.H, X0 = 286;
const REGION_TAGS = {
  r1:'mud · wrecks · crumble',
  r2:'vertical · steam · lamps',
  r3:'salt · exposed rails · springs',
  r4:'conveyors · canopies · machinery',
  final:'steam · clockwork · borrowed attacks'
};
const routeGlyph = d => {
  const r=d.route||['left','right'], k=r.join('>');
  return ({'left>right':'→','right>left':'←','bottom>top':'↑','top>bottom':'↓','left>top':'↗','top>right':'↘','right>top':'↖','top>left':'↙','left>bottom':'↘','bottom>right':'↗','right>bottom':'↙','bottom>left':'↖'})[k] || '·';
};

// A line of coloured text and cut shapes. parts: { text, color } | { cut, color? }. Stops with an ellipsis at maxX.
function inline(ctx, parts, x, y, maxX, size = 10.5) {
  ctx.font = '500 ' + size + 'px ' + C.FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const p of parts) {
    if (p.cut) {
      if (x + 14 > maxX) break;
      ctx.save(); ctx.translate(x + 5, y); ctx.fillStyle = G.CLASSES[p.cut].color; art.cutShape(ctx, G.CLASSES[p.cut].shape, 5); ctx.restore(); x += 14; continue;
    }
    let t = p.text;
    if (x + ctx.measureText(t).width > maxX) {
      while (t.length > 1 && x + ctx.measureText(t + '…').width > maxX) t = t.slice(0, -1);
      ctx.fillStyle = p.color || '#e9e2cf'; ctx.fillText(t + '…', x, y); return;
    }
    ctx.fillStyle = p.color || '#e9e2cf'; ctx.fillText(t, x, y); x += ctx.measureText(t).width;
  }
}

function box(ctx, x, y, w, h, node, here, label) {
  ctx.fillStyle = node.seen ? '#22322e' : 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = here ? '#fff3c4' : node.seen ? '#3f6b5a' : '#2a3a35'; ctx.lineWidth = here ? 2.5 : 1.5; ctx.strokeRect(x, y, w, h);
  if (label) art.label(ctx, label, x + w / 2, y + h / 2, label.length > 11 ? 8.5 : 10.5, node.seen ? '#e9e2cf' : '#5c6a63');
}

// The Warden's sigil: the diamond shown on its gate in the Junction. Dim with a cross once the Warden has fallen.
function sigil(ctx, x, y, color, done) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = done ? '#2a2f2d' : color; ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = done ? '#5c6a63' : '#0a1110'; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
  if (done) { ctx.strokeStyle = '#9aa89f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 9, y - 9); ctx.lineTo(x + 9, y + 9); ctx.moveTo(x + 9, y - 9); ctx.lineTo(x - 9, y + 9); ctx.stroke(); }
}

// Parts describing one side room: letter, name, then what it holds (or a question mark).
function sideRoom(run, bn, letter) {
  const def = G.roomDefs[bn.def], slate = !!run.mods.revealMap, parts = [{ text: letter + ' ', color: '#e9a23b' }];
  const needs = G.worldgen.needsText(bn.def);                                 // a guarded room names the move it needs before the player walks in
  if (!bn.seen && !slate) return parts.concat({ text: '? not yet entered', color: '#5c6a63' }, needs ? { text: '  (needs ' + needs + ')', color: '#e9a23b' } : { text: '' });
  parts.push({ text: (def.label || 'Side room') + (bn.seen ? '' : ' (not entered)') + ': ', color: '#9aa89f' });
  const all = G.worldgen.describe(bn), held = all.filter(h => h.text !== def.label);
  if (needs) parts.splice(2, 0, { text: '[needs ' + needs + '] ', color: '#e9a23b' });
  if (!all.length) parts.push({ text: 'nothing left', color: '#5c6a63' });
  else if (!held.length) parts.pop(), parts.push({ text: (def.label || 'Side room') + (bn.seen ? '' : ' (not entered)'), color: '#e9e2cf' });
  held.forEach((h, i) => { if (i) parts.push({ text: ', ', color: '#9aa89f' }); if (h.cut) parts.push({ cut: h.cut }); parts.push({ text: h.text }); });
  return parts;
}

const UndefSafeNote=(n,len)=>Math.max(0,Math.min(len-1,Number.isFinite(n)?n:len-1));

G.map = {
  note: 0,
  open() { const n=G.story?G.story.notes().length:0; G.map.note=Math.max(0,n-1); },
  step(pr) {
    const n=G.story?G.story.notes().length:0;if(n<2)return;
    if(pr.left)G.map.note=(G.map.note+n-1)%n;
    else if(pr.right)G.map.note=(G.map.note+1)%n;
  },
  draw(ctx) {
    const run = G.run, graph = run.graph, here = G.rooms.current.id;
    ctx.fillStyle = 'rgba(6,11,11,0.98)'; ctx.fillRect(0, 0, W, H);
    art.label(ctx, 'Route Board', W / 2, 18, 22, '#e9a23b', 'center', C.DISPLAY, 600);
    if (G.story) art.label(ctx, G.story.objective(), W / 2, 39, 11.5, '#e9e2cf');

    // tokens the party holds
    const held = G.game.heldTokens(), total = G.players.reduce((s, p) => s + p.slots, 0);
    art.label(ctx, 'Tokens held', 24, 60, 12, '#9aa89f', 'left');
    for (let i = 0; i < total; i++) {
      const t = held[i], x = 116 + i * 205;
      if (!t) { art.label(ctx, '(empty slot)', x + 16, 60, 12, '#4d5a54', 'left'); continue; }
      G.items.icon(ctx, t.id, x + 6, 60, 0.75);
      art.label(ctx, t.name + ' · ' + G.CLASSES[t.cls].name, x + 20, 60, 12, t.color, 'left', C.FONT, 600);
      G.materials.drawChips(ctx, G.itemDefs[t.id].mat, x + 20, 73, 'left');
    }

    const order = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), rowH = Math.min(70, (H - 178) / order.length);
    const hub = graph.nodes[graph.hub], hy = 80;
    art.label(ctx, 'The Junction', 24, hy + 14, 14, '#e9e2cf', 'left', C.FONT, 600);
    art.label(ctx, 'Gates are all open', 24, hy + 32, 11.5, '#9aa89f', 'left');
    box(ctx, X0, hy + 14, 70, 22, hub, hub.id === here, '');
    const pipeNodes = Object.values(graph.nodes).filter(n => G.worldgen.contents(n).some(c => c.type === 'standpipe'));
    inline(ctx, [{ text: 'Standpipes: ', color: '#9aa89f' }].concat(pipeNodes.map((n, i) => {
      const live = run.rooms[n.id], used = live && live.props.some(p => p.type === 'standpipe' && p.data.used);
      return { text: (i ? ', ' : '') + (n === hub ? 'Junction' : (G.regionDefs[n.region] || {}).name || '?') + (used ? ' (used)' : ' (ready)'), color: used ? '#5c6a63' : '#e9e2cf' };
    })), X0, hy + 44, W - 20);

    order.forEach((reg, ri) => {
      const g = graph.regions[reg.id], y = hy + 58 + ri * rowH, pal = art.palette(reg.id), boss = G.bossDefs[reg.boss], done = run.beaten[reg.id];
      if (!g) return;
      art.label(ctx, reg.name, 24, y + 11, 14, pal.accent, 'left', C.FONT, 600);
      const seenMain=g.nodes.filter(id=>!graph.nodes[id].parent&&graph.nodes[id].seen).length, totalMain=g.nodes.filter(id=>!graph.nodes[id].parent).length;
      art.label(ctx, 'Route ' + seenMain + '/' + totalMain + '   ·   ' + (REGION_TAGS[reg.id]||''), 24, y + 27, 10.5, '#9aa89f', 'left');
      art.label(ctx, (boss ? boss.name : '?') + (done ? ' — fallen' : ' — waiting'), 24, y + 42, 11, done ? '#5c6a63' : '#e9e2cf', 'left');
      if(reg.ability) art.label(ctx, (run.abil[reg.ability] ? '✓ ' : '○ ') + G.abilityDefs[reg.ability].name, 24, y + 57, 10.5, run.abil[reg.ability] ? '#e9a23b' : '#5c6a63', 'left');
      const gr = (run.grades || {})[reg.id];
      if (gr) art.label(ctx, G.game.gradeText(gr), 206, y + 57, 10.5, gr.clean ? '#fff3c4' : '#e9a23b', 'right', C.FONT, 600);

      const chain = g.nodes.filter(id => !graph.nodes[id].parent);
      let mainN = 0;
      chain.forEach((id, i) => {
        const node = graph.nodes[id], isArena = id === g.arena, x = X0 + i * 100;
        if (i) { ctx.fillStyle = '#2a3a35'; ctx.fillRect(x - 30, y + 24, 24, 2); }
        if (!isArena) mainN++;
        const d=G.roomDefs[node.def], known=node.seen||run.mods.revealMap, nm=known ? (G.story ? G.story.roomName(node.def) : 'Room ' + mainN) : '?';
        box(ctx, x, y + 12, 76, 24, node, id === here, isArena ? '' : nm);
        if (!isArena && node.seen) art.label(ctx, routeGlyph(d), x + 68, y + 24, 10, '#9aa89f');
        if (isArena) sigil(ctx, x + 38, y + 24, pal.accent, done);
        g.nodes.filter(b => graph.nodes[b].parent === id).forEach((b, k) => {
          if (!node.seen && !run.mods.revealMap) return;
          const bn = graph.nodes[b], letter = String.fromCharCode(65 + g.nodes.filter(q => graph.nodes[q].parent).indexOf(b));
          const known = bn.seen || run.mods.revealMap;
          box(ctx, x + k * 24, y - 3, 20, 13, bn, bn.id === here, known ? letter : '?');
        });
      });
      if (reg.id === 'final') {                                // what the Long Clock will borrow, shown before the player commits
        const bs = G.game.borrows(run);
        inline(ctx, [{ text: 'Borrows: ', color: '#9aa89f' }].concat(bs.length ? bs.map((x, i) => ({ text: (i ? ', ' : '') + x.short, color: '#e9a23b' })) : [{ text: 'nothing', color: '#5c6a63' }]), X0 + 288, y + 24, W - 10, 9.5);
      }
      // what each side room holds
      const sides = g.nodes.filter(b => graph.nodes[b].parent && (graph.nodes[graph.nodes[b].parent].seen || run.mods.revealMap));
      const letters = g.nodes.filter(q => graph.nodes[q].parent), pieces = sides.map(b => sideRoom(run, graph.nodes[b], String.fromCharCode(65 + letters.indexOf(b))));
      if (pieces.length) {
        // side rooms fill two columns of up to two lines
        const half = (W - 20 - X0) / 2;
        pieces.forEach((parts, k) => inline(ctx, parts, X0 + (k % 2) * half, y + 42 + Math.floor(k / 2) * 11, X0 + (k % 2) * half + half - 8, 9.5));
      } else inline(ctx, [{ text: 'No side rooms found yet', color: '#4d5a54' }], X0, y + 42, W - 20, 9.5);
      // the Warden's three fare slots on this run's lock chart, by cut
      const parts = [{ text: 'Lock chart: ', color: '#9aa89f' }];
      for (const cut of (graph.chart && graph.chart[reg.id]) || Object.keys(G.CLASSES)) {
        const s = boss && boss.spots && boss.spots[cut];
        parts.push({ cut }); parts.push({ text: (s ? s.name : '?') + ' (' + G.CLASSES[cut].name.toLowerCase() + ')   ', color: G.CLASSES[cut].color });
      }
      inline(ctx, parts, X0, y + 63, W - 10, 9.5);
    });
    const notes=G.story?G.story.notes():[], ni=notes.length?UndefSafeNote(G.map.note,notes.length):0, note=notes[ni];
    if(note) {
      ctx.fillStyle='rgba(6,11,11,0.9)';ctx.fillRect(18,H-50,W-36,25);
      art.label(ctx, (notes.length>1?'←  ':'')+'Note '+(ni+1)+'/'+notes.length+' — '+note.title+': '+note.text+(notes.length>1?'  →':''), W/2, H-37, 9.8, '#e9e2cf');
    }
    art.label(ctx, 'Bright = visited   ·   outline = here   ·   arrows = route   ·   diamond = Warden   ·   Left/Right notes   ·   Tab close', W / 2, H - 12, 9.7, '#9aa89f');
  }
};
})();
