/* Room props. Template character -> prop type (see G.defineRoom). The clipping booth (K, booth, clip) is no longer placed in any run; its code stays here unused.
   I plinth (a token or trinket to take; kiosk wares are plinths with a price)   C trunk (lost trunk, opens when the room is clear)
   R ticket (ticket machine)   S plinth with a price (kiosk ware)   K booth (clipping booth)   M post (signal post)
   H standpipe   D door (doorway)   G gate (region gate, hub)   ? sign.   Spawned by other props: clip (a clipping booth choice). */
(() => {
'use strict';
const G = window.G, C = G.C, U = G.util, fx = G.fx, art = G.art;

const priceOf = d => Math.round(d.price * G.run.mods.shopCost);
const goodName = d => d.item ? G.itemDefs[d.item].name : d.trinket ? G.trinketDefs[d.trinket].name : d.scrip ? 'Purse of scrip' : '';
const goodDesc = d => d.item ? G.CLASSES[G.itemDefs[d.item].cls].name + ' token. ' + G.itemDefs[d.item].desc : d.trinket ? 'Trinket. ' + G.trinketDefs[d.trinket].desc : d.scrip ? d.scrip + ' scrip.' : '';
const goodColor = d => d.item ? G.itemDefs[d.item].color : d.trinket ? G.trinketDefs[d.trinket].color : d.scrip ? '#fff3c4' : '#888';
const hasGood = d => !!(d.item || d.trinket || d.scrip);
function drawGood(ctx, d, x, y, s) {
  if (d.item) G.items.icon(ctx, d.item, x, y, s); else if (d.trinket) G.trinkets.icon(ctx, d.trinket, x, y, s);
  else if (d.scrip) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#fff3c4'; ctx.fillRect(-7 * s, -7 * s, 14 * s, 14 * s); ctx.fillStyle = '#7a531c'; ctx.fillRect(-3 * s, -3 * s, 6 * s, 6 * s); ctx.restore(); }
}
function pay(cost) {
  if (G.run.shards < cost) { fx.say('Not enough scrip', 'This costs ' + cost + '.', 1.6); return false; }
  G.run.shards -= cost; return true;
}
// Remove every other prop of the same group (the choices nobody took).
function closeGroup(pr) { if (pr.data.group) for (const o of G.rooms.current.props) if (o !== pr && o.data.group === pr.data.group) o.gone = true; }
function stand(ctx, x, y) { ctx.fillStyle = '#22322e'; ctx.fillRect(x - 16, y - 14, 32, 14); ctx.fillStyle = '#3f6b5a'; ctx.fillRect(x - 19, y - 17, 38, 4); }
const TICKET_PRICES = [30, 45];           // the machine can be used twice: the first roll costs 30 scrip, the second 45
const ticketCost = () => TICKET_PRICES[Math.min(G.run.tickets, TICKET_PRICES.length - 1)];
// One line shown the first time a kind of prop is approached (it stops after the player has stood at one for a few seconds).
const TEACH = {
  plinth: 'A plinth holds a token. Up takes it; with the party full, it swaps with your selected token.',
  kiosk: 'The kiosk sells trinkets for scrip. The price is on each ware.',
  trunk: 'A lost trunk opens when the room is clear.',
  ticket: 'The ticket machine shows three tickets for scrip. Keep one; the rest go void. A second roll costs more.',
  booth: 'A clipping booth trades one health pip for a new token of a cut you choose.',
  clip: 'Each cut has a shape and colour. The same shape shows on a Warden\'s fare slot.',
  post: 'A signal post teaches a move. It lasts the whole run.',
  standpipe: 'A standpipe mends the whole party, once per run.',
  door: 'Doorways lead to side rooms. Every side room has a way back.',
  gate: 'Every gate is open. Each line ends at a Warden.'
};
const teachKey = pr => pr.type === 'plinth' && pr.data.price ? 'kiosk' : pr.type;

/* Each type: draw(pr, ctx); optional update(pr, dt), interact(pr, player), prompt(pr, player) -> [title, line, hint] or null.
   A prop can only be used (Up) while it has a prompt. */
const TYPES = {
  plinth: {     // data: { item | trinket, price, locked, group }
    interact(pr, p) {
      const d = pr.data;
      if (!hasGood(d)) return;
      if (d.locked && !G.rooms.current.cleared) return fx.say('Guarded', 'Clear the room first.', 1.6);
      if (d.item && G.game.partyItems().includes(d.item)) return fx.say(G.itemDefs[d.item].name, 'The party already carries one.', 1.8);   // never a second copy
      if (d.price && !pay(priceOf(d))) return;
      fx.spark(pr.x, pr.y - 50, 14, goodColor(d), 200, 0.5, 0);
      if (d.scrip) { G.run.shards += d.scrip; fx.say('+' + d.scrip + ' scrip', 'A purse of scrip.', 1.8); fx.floatText(pr.x, pr.y - 70, '+' + d.scrip + ' scrip', '#fff3c4'); d.scrip = 0; }
      else if (d.trinket) { fx.say(goodName(d), goodDesc(d)); G.game.addTrinket(d.trinket); d.trinket = null; }
      else {
        const took = d.item, old = G.game.takeItem(p, took);   // a full party swaps: the old token stays on the plinth
        d.item = old;
        fx.say(G.itemDefs[took].name, old ? 'Swapped for ' + G.itemDefs[old].name + ', which stays on the plinth.' : goodDesc({ item: took }));
      }
      d.price = 0; closeGroup(pr);
      if (d.group && String(d.group).startsWith('ticket') && !hasGood(d)) pr.gone = true;      // the ticket stand clears, so the machine can come back

    },
    prompt(pr) {
      const d = pr.data;
      if (!hasGood(d)) return null;
      const swap = d.item && G.game.freeSlots() === 0, sel = G.players[0] && G.players[0].items[G.players[0].sel];
      const hint = d.locked && !G.rooms.current.cleared ? 'Guarded until the room is clear'
        : d.price ? 'Up to buy for ' + priceOf(d) + ' scrip' + (G.run.shards < priceOf(d) ? ' (you have ' + Math.floor(G.run.shards) + ')' : '') + (swap ? ', swaps your selected token' : '')
        : swap ? 'Up to swap with your selected token' + (sel ? ' (' + G.itemDefs[sel].name + ')' : '') : 'Up to take';
      return [goodName(d), goodDesc(d), hint];
    },
    draw(pr, ctx) {
      const d = pr.data, x = pr.x, y = pr.y;
      stand(ctx, x, y);
      if (d.price) { ctx.fillStyle = '#7a531c'; ctx.fillRect(x - 22, y - 74, 44, 5); ctx.fillRect(x - 21, y - 74, 2, 60); ctx.fillRect(x + 19, y - 74, 2, 60); }
      if (!hasGood(d)) return;
      const fy = y - 42 + Math.sin(G.time * 2.2 + x) * 3;
      ctx.globalAlpha = 0.18; ctx.fillStyle = goodColor(d); ctx.beginPath(); ctx.arc(x, fy, 22, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      drawGood(ctx, d, x, fy, 1.25);
      // the price tag gives way to the prompt (which names the price) while a player stands at the ware: the two used to overprint
      if (d.price && !G.players.some(p => !p.down && pr.near(p))) art.label(ctx, String(priceOf(d)), x, y - 84, 13, '#fff3c4', 'center', C.FONT, 600);
      if (d.locked && !G.rooms.current.cleared) { ctx.strokeStyle = '#9aa89f'; ctx.lineWidth = 2; ctx.strokeRect(x - 20, fy - 20, 40, 40); }
    }
  },
  trunk: {      // data: { item }
    update(pr) {
      const d = pr.data;
      if (!G.rooms.current.cleared) return;
      fx.spark(pr.x, pr.y - 20, 20, '#f4e6b8', 260, 0.5); fx.jolt(0.04, 4);
      pr.gone = true;                                  // the trunk gives way to a plinth holding what it carried
      if (hasGood(d)) G.rooms.current.props.push(G.props.make('plinth', pr.x, pr.y, Object.assign({}, d)));
    },
    prompt() { return ['Lost trunk', 'Something rattles inside.', 'Opens when the room is clear']; },
    draw(pr, ctx) {
      const x = pr.x, y = pr.y;
      ctx.fillStyle = '#5a4630'; ctx.fillRect(x - 17, y - 20, 34, 20); ctx.fillStyle = '#b8482f'; ctx.fillRect(x - 17, y - 12, 34, 3); ctx.fillRect(x - 3, y - 15, 6, 8);
      ctx.fillStyle = '#8a6c46'; ctx.fillRect(x - 18, y - 26, 36, 8);
    }
  },
  ticket: {     // data: { choices: [3 loot], next: [3 loot] | null, used, wait }. Two uses per run: 30 scrip, then 45.
    update(pr) {
      const d = pr.data;
      if (!d.wait) return;
      if (G.rooms.current.props.filter(o => o.data.group === d.wait).length < 3) { d.wait = null; if (d.used) pr.gone = true; }   // a ticket was taken: the stand clears
    },
    interact(pr) {
      const d = pr.data;
      if (d.used || d.wait || !pay(ticketCost())) return;
      G.run.tickets++; G.run.stats.tickets = (G.run.stats.tickets || 0) + 1; fx.jolt(0.05, 5); fx.ring(pr.x, pr.y - 40, 10, 260, '#f4e6b8', 0.5);
      d.wait = 'ticket' + pr.x + '_' + G.run.tickets;
      d.choices.forEach((o, i) => G.rooms.current.props.push(G.props.make('plinth', pr.x + (i - 1) * 58, pr.y, Object.assign({}, o, { group: d.wait }))));
      if (d.next && d.next.length) { d.choices = d.next; d.next = null; } else d.used = true;
      fx.say('The machine prints three tickets', 'Take one. The others are void.' + (d.used ? '' : ' It can print once more.'), 2.6);
    },
    prompt(pr) {
      if (pr.data.used || pr.data.wait) return null;
      const c = ticketCost();
      return ['Ticket machine', 'Shows three tickets, tokens first. You keep one; the rest are void.' + (pr.data.next ? ' Two rolls per run.' : ' Last roll.'), 'Up to pay ' + c + ' scrip' + (G.run.shards < c ? ' (you have ' + Math.floor(G.run.shards) + ')' : '')];
    },
    draw(pr, ctx) {
      if (pr.data.wait) return;                       // the tickets stand where the machine is
      const x = pr.x, y = pr.y;
      ctx.fillStyle = '#22322e'; ctx.fillRect(x - 14, y - 52, 28, 52); ctx.fillStyle = '#3f6b5a'; ctx.fillRect(x - 18, y - 56, 36, 5);
      ctx.fillStyle = '#f4e6b8'; ctx.fillRect(x - 8, y - 44, 16, 10); ctx.fillStyle = '#0a1110'; ctx.fillRect(x - 6, y - 24, 12, 3);
      ctx.fillStyle = '#f4e6b8'; ctx.fillRect(x - 4, y - 21 + Math.sin(G.time * 3) * 1.5, 8, 6);
    }
  },
  booth: {      // data: { used }. Up: pick a cut; your selected token becomes a random token of that cut for one health pip.
    interact(pr, p) {
      if (pr.data.used) return;
      if (!p.items.length) return fx.say('Clipping booth', 'Carry a token to have it clipped.', 2);
      if (p.maxHp <= 1) return fx.say('Clipping booth', 'You have no health pip to give.', 2);
      if (!p.items[p.sel]) p.sel = 0;
      pr.data.used = true;
      Object.keys(G.CLASSES).forEach((cls, i) => G.rooms.current.props.push(G.props.make('clip', pr.x + (i - 1.5) * 50, pr.y, { cls, group: 'clip' + pr.x, stock: pr.data.stock || [] })));
      fx.say('Choose a cut', G.itemDefs[p.items[p.sel]].name + ' will be reclipped. It costs one health pip for the run.', 3.4);
    },
    prompt(pr) { return pr.data.used ? null : ['Clipping booth', 'Swap your selected token for a random one of a cut you choose.', 'Up to step in. Costs one max health pip for the run']; },
    draw(pr, ctx) {
      const x = pr.x, y = pr.y;
      ctx.fillStyle = '#1d2a2c'; ctx.fillRect(x - 20, y - 70, 40, 70); ctx.fillStyle = '#3f6b5a'; ctx.fillRect(x - 24, y - 74, 48, 6);
      ctx.fillStyle = pr.data.used ? '#2a3036' : '#f4e6b8'; ctx.fillRect(x - 12, y - 60, 24, 14);
      ctx.fillStyle = '#0a1110'; ctx.fillRect(x - 10, y - 38, 20, 38);
    }
  },
  clip: {       // data: { cls, group }
    interact(pr, p) {
      const cls = pr.data.cls, id = p.items[p.sel];
      if (!id) return fx.say('Nothing to clip', 'The selected slot is empty.', 1.6);
      const options = G.game.spareTokens(cls, pr.data.stock);
      if (options.length) {
        const neu = G.run.rng.pick(options);
        G.run.graph.claimed.push(neu);                                // now placed: nothing else offers it
        p.items[p.sel] = neu; G.game.addMaxPips(-1); G.run.stats.clipped = (G.run.stats.clipped || 0) + 1; closeGroup(pr); pr.gone = true;
        fx.say(G.itemDefs[neu].name, G.itemDefs[id].name + ' was clipped. One health pip is gone for the run.', 3);
        return;
      }
      // No token of this cut is left that is not held, void, or already placed or offered in this run: a trinket (or scrip) instead,
      // for the same pip, and the token stays where it is. Never a second copy of a token.
      const t = G.trinkets.roll(G.run.rng, G.run.graph.claimed);
      G.game.addMaxPips(-1); G.run.stats.clipped = (G.run.stats.clipped || 0) + 1; closeGroup(pr); pr.gone = true;
      if (t) { G.run.graph.claimed.push(t); G.game.addTrinket(t); fx.say(G.trinketDefs[t].name, 'No spare ' + G.CLASSES[cls].name + ' token is left, so the booth gave a trinket. One health pip is gone for the run.', 3.4); }
      else { G.run.shards += 60; fx.say('+60 scrip', 'No spare ' + G.CLASSES[cls].name + ' token is left, so the booth paid scrip. One health pip is gone for the run.', 3.4); }
    },
    prompt(pr, p) {
      const c = G.CLASSES[pr.data.cls], id = p && p.items[p.sel], spare = G.game.spareTokens(pr.data.cls, pr.data.stock).length > 0;
      return [c.name + ' cut', spare ? (id ? G.itemDefs[id].name : 'Your selected token') + ' becomes a random ' + c.name + ' token.' : 'No spare ' + c.name + ' token is left. The booth would give a trinket or scrip instead.', 'Up to clip. Costs one max health pip for the run'];
    },
    draw(pr, ctx) {
      const c = G.CLASSES[pr.data.cls], x = pr.x, y = pr.y;
      stand(ctx, x, y); ctx.save(); ctx.translate(x, y - 38 + Math.sin(G.time * 2.2 + x) * 3); ctx.fillStyle = c.color; art.cutShape(ctx, c.shape, 11); ctx.restore();
    }
  },
  post: {       // signal post, data: { abil }. Touching it grants the ability to the whole party.
    update(pr) {
      if (G.run.abil[pr.data.abil]) return;
      for (const p of G.players) if (!p.down && Math.abs(p.x - pr.x) < 22 && Math.abs(p.cy - (pr.y - 34)) < 36) {
        const a = G.abilityDefs[pr.data.abil];
        G.run.abil[pr.data.abil] = true; fx.say(a.name + ' unlocked', a.how, 4.5);
        fx.ring(pr.x, pr.y - 34, 10, 260, '#f4e6b8', 0.5); fx.spark(pr.x, pr.y - 34, 26, '#f4e6b8', 300, 0.7, 0); fx.jolt(0.06, 5);
        break;
      }
    },
    draw(pr, ctx) {
      const got = G.run.abil[pr.data.abil], a = G.abilityDefs[pr.data.abil], bob = got ? 0 : Math.sin(G.time * 2 + pr.x) * 4;
      ctx.fillStyle = '#3a4a44'; ctx.fillRect(pr.x - 2, pr.y - 22, 4, 22);
      ctx.save(); ctx.translate(pr.x, pr.y - 34 + bob);
      if (!got) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(G.time * 3); ctx.fillStyle = '#f4e6b8'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.rotate(Math.PI / 4); ctx.strokeStyle = got ? '#3a4a44' : '#f4e6b8'; ctx.lineWidth = 2.5; ctx.strokeRect(-9, -9, 18, 18);
      if (!got) { ctx.fillStyle = '#fff3c4'; ctx.fillRect(-4, -4, 8, 8); }
      ctx.restore();
      if (!got && a) art.label(ctx, a.name, pr.x, pr.y - 68, 13, '#e9e2cf');
    }
  },
  standpipe: {  // data: { used }. A full heal for the party, once per run.
    interact(pr) {
      if (pr.data.used) return;
      if (G.players.every(p => !p.down && p.hp >= p.maxHp)) return fx.say('Standpipe', 'Everyone is mended already. Save it.', 2);
      pr.data.used = true;
      for (const p of G.players) { if (p.down) p.down = false; p.hp = p.maxHp; }
      fx.ring(pr.x, pr.y - 24, 10, 260, '#fff3c4', 0.5); fx.say('Mended', 'The standpipe runs dry.', 2);
    },
    prompt(pr) { return pr.data.used ? null : ['Standpipe', 'Mends the whole party fully. One use per run.', 'Up to drink']; },
    draw(pr, ctx) {
      const x = pr.x, y = pr.y;
      ctx.fillStyle = '#22322e'; ctx.fillRect(x - 22, y - 12, 44, 12); ctx.fillStyle = '#3f6b5a'; ctx.fillRect(x - 25, y - 15, 50, 4);
      ctx.fillStyle = '#5a4630'; ctx.fillRect(x - 3, y - 46, 6, 34); ctx.fillRect(x - 3, y - 46, 16, 5);
      if (!pr.data.used) { ctx.fillStyle = '#fff3c4'; ctx.globalAlpha = 0.7; for (let i = 0; i < 3; i++) { const k = (G.time * 1.2 + i / 3) % 1; ctx.fillRect(x + 10, y - 40 + k * 26, 2, 5); } ctx.globalAlpha = 1; }
    }
  },
  door: {       // data: { to: nodeId, entry, label, tag }
    interact(pr) { G.rooms.go(pr.data.to, pr.data.entry); },
    prompt(pr) { return [pr.data.label || 'Doorway', '', 'Up to enter']; },
    draw(pr, ctx) {
      const x = pr.x, y = pr.y;
      ctx.fillStyle = '#020505'; ctx.beginPath(); ctx.moveTo(x - 17, y); ctx.lineTo(x - 17, y - 40); ctx.quadraticCurveTo(x, y - 62, x + 17, y - 40); ctx.lineTo(x + 17, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3f6b5a'; ctx.lineWidth = 3; ctx.stroke();
      if (pr.data.tag) art.label(ctx, pr.data.tag, x, y - 70, 12, '#9aa89f');
    }
  },
  gate: {       // hub gate into a region, data: { region }. Shows the region's Warden sigil, dimmed once beaten.
    interact(pr) { G.rooms.go(G.run.graph.regions[pr.data.region].first, { side: 'left' }); },
    prompt(pr) {
      const r = G.regionDefs[pr.data.region], b = G.bossDefs[r.boss];
      const chart = (G.run.graph.chart || {})[r.id];
      return [r.name, (b ? b.name : 'Unknown') + (G.run.beaten[r.id] ? ' has fallen.' : ' waits down the line.') + (chart ? ' Slots: ' + chart.map(c => G.CLASSES[c].name).join(', ') + '.' : ''), 'Up to enter'];
    },
    draw(pr, ctx) {
      const x = pr.x, y = pr.y, r = G.regionDefs[pr.data.region], pal = art.palette(pr.data.region), done = G.run.beaten[pr.data.region];
      ctx.fillStyle = pal.sky1; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x - 26, y - 58); ctx.quadraticCurveTo(x, y - 92, x + 26, y - 58); ctx.lineTo(x + 26, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = done ? '#5c6a63' : pal.accent; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.translate(x, y - 104); ctx.rotate(Math.PI / 4); ctx.fillStyle = done ? '#2a2f2d' : pal.accent; ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = done ? '#5c6a63' : pal.sky0; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
      art.label(ctx, r.name, x, y - 126, 12.5, done ? '#9aa89f' : '#e9e2cf');
    }
  },
  board: {      // the lock chart in the Junction: for every region, the three cuts its Warden has a fare slot for this run
    prompt() { return ['Lock chart', 'Each Warden has three fare slots. A cut not shown is locked out there.', '']; },
    draw(pr, ctx) {
      const x = pr.x, y = pr.y, W = 104, rows = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate), top = y - 16 - 14 - rows.length * 14;
      ctx.fillStyle = '#5a4630'; ctx.fillRect(x - W / 2 + 12, y - 16, 4, 16); ctx.fillRect(x + W / 2 - 16, y - 16, 4, 16);
      ctx.fillStyle = '#8a6c46'; ctx.fillRect(x - W / 2, top, W, y - 16 - top); ctx.fillStyle = '#1d1a14'; ctx.fillRect(x - W / 2 + 3, top + 3, W - 6, y - 16 - top - 6);
      art.label(ctx, 'Lock chart', x, top + 10, 10.5, '#f4e6b8', 'center', C.FONT, 600);
      rows.forEach((r, i) => {
        const ry = top + 25 + i * 14, chart = (G.run.graph.chart || {})[r.id] || [], pal = art.palette(r.id);
        art.label(ctx, r.name, x - W / 2 + 5, ry, 9, G.run.beaten[r.id] ? '#6d6a5c' : pal.accent, 'left');
        chart.forEach((cut, k) => { ctx.save(); ctx.translate(x + W / 2 - 40 + k * 14, ry); ctx.fillStyle = G.run.beaten[r.id] ? '#4a4a40' : G.CLASSES[cut].color; art.cutShape(ctx, G.CLASSES[cut].shape, 5); ctx.restore(); });
      });
    }
  },
  sign: {       // data: { text }
    prompt(pr) { return pr.data.text ? ['', pr.data.text, ''] : null; },
    draw(pr, ctx) { const x = pr.x, y = pr.y; ctx.fillStyle = '#5a4630'; ctx.fillRect(x - 2, y - 26, 4, 26); ctx.fillStyle = '#8a6c46'; ctx.fillRect(x - 15, y - 40, 30, 16); ctx.fillStyle = '#5a4630'; ctx.fillRect(x - 10, y - 35, 20, 2); ctx.fillRect(x - 10, y - 30, 14, 2); }
  }
};

G.props = {
  teachT: {},       // seconds each first-time tip has been on screen this session
  tip(pr) { const k = teachKey(pr); return G.meta.taught[k] ? '' : TEACH[k] || ''; },
  TYPES,            // content may add a prop type here: G.props.TYPES.<name> = { draw, update, interact, prompt }
  make(type, x, y, data = {}) {
    const t = TYPES[type];
    return {
      type, x, y, data, gone: false,
      near(p) { return Math.abs(p.x - x) < 28 && Math.abs(p.y - y) < 50; },
      update(dt) {
        if (t.update) t.update(this, dt);
        const k = teachKey(this), tt = G.props.teachT;
        if (TEACH[k] && !G.meta.taught[k]) for (const p of G.players)
          if (!p.down && p.onGround && this.near(p) && this.prompt(p)) { tt[k] = (tt[k] || 0) + dt; if (tt[k] > 3) { G.meta.taught[k] = true; G.game.saveMeta(); } break; }
      },
      interact(p) { if (t.interact) t.interact(this, p); },
      prompt(p) { return t.prompt ? t.prompt(this, p) : null; },
      draw(ctx) { art.draw('prop_' + type, ctx, { x, y, prop: this }) || t.draw(this, ctx); }
    };
  },
  // Word-wrap text to at most maxW pixels at the given font size (ctx.font is set here). Returns the lines.
  wrap(ctx, text, size, maxW, weight = 500) {
    ctx.font = weight + ' ' + size + 'px ' + C.FONT;
    const out = [];
    for (const para of String(text).split('\n')) {
      let cur = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const t = cur ? cur + ' ' + word : word;
        if (cur && ctx.measureText(t).width > maxW) { out.push(cur); cur = word; } else cur = t;
      }
      if (cur) out.push(cur);
    }
    return out;
  },
  PROMPT_W: 340,     // widest line of a prompt, px
  // Where the prompt panel of a prop goes: lines wrapped to PROMPT_W, the whole panel clamped inside the screen (world coordinates).
  layoutPrompt(ctx, pr, lines) {
    const [title, line, hint] = lines, tip = G.props.tip(pr), maxW = G.props.PROMPT_W, PAD = 10, GAP = 4;
    const rows = [];
    for (const [text, size, kind, weight] of [[tip, 12, 'tip', 500], [title, 15, 'title', 600], [line, 12.5, 'line', 500], [hint, 12.5, 'hint', 500]])
      if (text) for (const t of G.props.wrap(ctx, text, size, maxW, weight)) rows.push({ t, size, kind, weight });
    if (!rows.length) return null;
    let w = 0, h = PAD * 2 - GAP;
    for (const r of rows) { ctx.font = r.weight + ' ' + r.size + 'px ' + C.FONT; w = Math.max(w, ctx.measureText(r.t).width); r.h = r.size + GAP; h += r.h; }
    w += PAD * 2;
    const M = 8, camX = G.cam.x, camY = G.cam.y, topMin = camY + 96;       // below the HUD rows at the top of the screen
    const x0 = U.clamp(pr.x - w / 2, camX + M, camX + C.W - M - w);
    let y0 = pr.y - (pr.type === 'gate' ? 168 : 100) - h / 2;
    y0 = U.clamp(y0, topMin, camY + C.H - M - h);
    if (y0 < camY + M) y0 = camY + M;
    let y = y0 + PAD;
    for (const r of rows) { r.y = y + r.size / 2; y += r.h; }
    return { x0, y0, x1: x0 + w, y1: y0 + h, rows };
  },
  // The label shown above a prop when a player stands at it: a panel, wrapped and kept on screen.
  drawPrompt(ctx, pr, lines) {
    const L = G.props.layoutPrompt(ctx, pr, lines);
    G.props.lastPrompt = L;
    if (!L) return;
    ctx.fillStyle = 'rgba(6,11,11,0.78)'; ctx.fillRect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0);
    const cx = (L.x0 + L.x1) / 2, titleCol = pr.data.item ? G.itemDefs[pr.data.item].color : '#e9a23b';
    for (const r of L.rows)
      art.label(ctx, r.t, cx, r.y, r.size, r.kind === 'tip' ? '#9fd3c7' : r.kind === 'title' ? titleCol : r.kind === 'line' ? '#e9e2cf' : '#9aa89f', 'center', C.FONT, r.weight);
  }
};
})();
