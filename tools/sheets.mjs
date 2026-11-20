/* Visual sweep: contact sheets of every room (with its real enemies and props from generated worlds) and of every screen.
   node tools/sheets.mjs                 writes tools/shots/rooms_<region>.png (half size), tools/shots/screens.png and tools/shots/palettes.png
   node tools/sheets.mjs --full <roomId> writes tools/shots/room_<roomId>.png at full size (use it to look closely)
   node tools/sheets.mjs --screens-full  writes every screen at full size to tools/shots/screen_<name>.png
   Rooms are drawn through the game's own G.rooms.draw, one 960 x 544 cell at a time, so what you see is what a player sees. */
import { launchBrowser } from './lib/browser.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const fullIdx = args.indexOf('--full'), fullRoom = fullIdx >= 0 ? args[fullIdx + 1] : null, screensFull = args.includes('--screens-full');

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(here, '..', 'index.html')).href);
await page.waitForFunction(() => window.G && window.G.debug);

const save = (name, dataUrl) => fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

// Everything below runs in the page. A "room image" is the whole room, cell by cell, at scale k.
await page.evaluate(() => {
  window.SH = {
    cell(ctx, node, cx, cy) {                       // draw one 960 x 544 cell of the current room into ctx
      G.cam.x = cx * 960; G.cam.y = cy * 544; G.fx.shake = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0); G.rooms.draw(ctx, 0.016);
    },
    room(nodeId, k) {                               // the whole room as a canvas
      const D = G.debug; D.gotoRoom(nodeId, { side: 'left' }); G.rooms.trans = null;
      const room = G.rooms.current, cols = Math.ceil(room.cols / 30), rows = Math.ceil(room.rows / 17);
      const big = document.createElement('canvas'); big.width = cols * 960 * k; big.height = rows * 544 * k;
      const bc = big.getContext('2d'), cell = document.createElement('canvas'); cell.width = 960; cell.height = 544;
      const cc = cell.getContext('2d');
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { SH.cell(cc, room.node, x, y); bc.drawImage(cell, x * 960 * k, y * 544 * k, 960 * k, 544 * k); }
      return big;
    },
    // Find, for every room template, one node in some generated world that uses it. Returns [{ seed, node, def, region, kind }].
    collect() {
      const want = new Set(Object.keys(G.roomDefs)), got = {};
      for (let seed = 1; seed <= 60 && Object.keys(got).length < want.size; seed++) {
        G.debug.newRun(seed);
        for (const n of Object.values(G.run.graph.nodes)) if (!got[n.def]) got[n.def] = { seed, node: n.id, def: n.def, region: G.roomDefs[n.def].region, kind: G.roomDefs[n.def].kind };
      }
      return Object.values(got);
    }
  };
});

if (fullRoom) {
  const r = await page.evaluate(id => { const c = SH.collect().find(x => x.def === id); if (!c) return null; G.debug.newRun(c.seed); return c; }, fullRoom);
  if (!r) { console.log('no room ' + fullRoom); process.exit(1); }
  const url = await page.evaluate(c => SH.room(c.node, 1).toDataURL('image/png'), r);
  save('room_' + fullRoom + '.png', url); console.log('wrote tools/shots/room_' + fullRoom + '.png');
  await browser.close(); process.exit(0);
}

// ---- rooms: one sheet per region
const list = await page.evaluate(() => SH.collect().map(c => Object.assign({ cols: G.roomDefs[c.def].w, rows: G.roomDefs[c.def].h }, c)));
const regions = ['hub', 'shared', 'r1', 'r2', 'r3', 'r4', 'final'];
for (const reg of regions) {
  const rs = list.filter(c => c.region === reg || (reg === 'shared' && !['hub', 'r1', 'r2', 'r3', 'r4', 'final'].includes(c.region)));
  if (!rs.length) continue;
  const url = await page.evaluate(({ rs }) => {
    const K = 0.5, pad = 6, W = 1920, label = 14;
    // simple shelf packing, wide rooms first
    const items = rs.map(c => ({ c, w: c.cols * 960 * K, h: c.rows * 544 * K })).sort((a, b) => b.w - a.w);
    const place = []; let x = 0, y = 0, rowH = 0;
    for (const it of items) { if (x + it.w > W) { x = 0; y += rowH + pad; rowH = 0; } place.push({ it, x, y: y + label }); x += it.w + pad; rowH = Math.max(rowH, it.h + label); }
    const H = y + rowH + pad, sheet = document.createElement('canvas'); sheet.width = W; sheet.height = H;
    const sc = sheet.getContext('2d'); sc.fillStyle = '#000'; sc.fillRect(0, 0, W, H);
    for (const p of place) {
      G.debug.newRun(p.it.c.seed);
      const img = SH.room(p.it.c.node, K);
      sc.drawImage(img, p.x, p.y);
      sc.fillStyle = '#fff'; sc.font = '12px monospace'; sc.textBaseline = 'top'; sc.fillText(p.it.c.def + ' (' + p.it.c.kind + ', seed ' + p.it.c.seed + ')', p.x + 2, p.y - label + 1);
    }
    return sheet.toDataURL('image/png');
  }, { rs });
  save('rooms_' + reg + '.png', url); console.log('wrote tools/shots/rooms_' + reg + '.png (' + rs.length + ' rooms)');
}

// ---- screens
const screens = await page.evaluate(() => {
  const D = G.debug, shots = [];
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
  const snap = name => { const c = document.createElement('canvas'); c.width = 960; c.height = 544; c.getContext('2d').drawImage(cv, 0, 0); shots.push({ name, c }); };
  const clear = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 960, 544); };
  const world = () => { G.fx.banner = null; clear(); G.rooms.draw(ctx, 0.016); G.hud.draw(ctx); };
  const near = (def, type, back) => {                  // stand next to a prop of this type in a room of this template
    D.newRun(3);
    const c = SH.collect().find(x => x.def === def); D.newRun(c.seed); D.gotoRoom(c.node, { side: 'left' }); G.rooms.trans = null;
    const room = G.rooms.current, pr = room.props.find(p => p.type === type && !p.gone);
    if (!pr) return null;
    G.players[0].place(pr.x - (back || 0), pr.y, 1); D.step(2); return pr;
  };

  // title
  D.newRun(3); G.state = 'title'; clear(); G.menus.title(ctx); snap('title');
  // hub
  D.newRun(3); G.state = 'play'; D.step(30); world(); snap('hub');
  // hub, standing at a gate and at the standpipe (prompts)
  { const room = G.rooms.current, g = room.props.find(p => p.type === 'gate'); if (g) { G.players[0].place(g.x, g.y, 1); D.step(2); world(); snap('hub_gate_prompt'); } }
  // map and pause (mid-run: a few rooms seen, tokens held)
  D.newRun(3); D.give('cobalt_awl'); D.give('ochre_ladle'); for (const n of Object.values(G.run.graph.nodes).slice(0, 14)) n.seen = true;
  G.fx.banner = null; G.state = 'map'; clear(); G.rooms.draw(ctx, 0.016); G.hud.draw(ctx); G.map.draw(ctx); snap('map');
  G.fx.banner = null; G.state = 'pause'; clear(); G.rooms.draw(ctx, 0.016); G.hud.draw(ctx); G.menus.pause(ctx); snap('pause');
  G.state = 'play';
  // a trinket choice: the plinths a beaten Warden leaves
  D.newRun(3); D.startBoss('r1'); { const b = G.rooms.current.boss; G.game.bossBeaten(b); b.state = 'dead'; D.step(2); G.players[0].place((G.rooms.current.def.floorX[0] + G.rooms.current.def.floorX[1]) / 2, b.floor, 1); D.step(2); world(); snap('trinket_choice'); }
  // kiosk, ticket machine, clipping booth, standpipe
  for (const [name, def, type, back] of [['kiosk', 'side_kiosk_counter', 'plinth', 0], ['ticket_machine', 'side_ticket_office', 'ticket', 0], ['clipping_booth', 'side_booth_chains', 'booth', 0], ['standpipe', 'side_standpipe', 'standpipe', 0]]) {
    G.state = 'play'; const pr = near(def, type, back); if (!pr) { shots.push({ name: name + ' (MISSING)', c: cv }); continue; }
    D.give('cobalt_awl'); G.run.shards = 200; D.step(2); world(); snap(name);
    if (type === 'ticket' || type === 'booth') { pr.interact(G.players[0]); D.step(20); world(); snap(name + '_used'); }
  }
  // run over, win
  D.newRun(3); G.run.punchLog = [{ cut: 'pierce', item: 'cobalt_awl', slot: 'Eye', boss: 'The Tollkeeper', region: 'r1' }]; G.run.over = 'dead'; G.state = 'over'; G.fx.banner = null; clear(); G.rooms.draw(ctx, 0.016); G.hud.draw(ctx); G.menus.over(ctx); snap('run_over');
  G.run.over = 'win'; G.run.beaten = { r1: true, r2: true, r3: true, r4: true, final: true }; clear(); G.rooms.draw(ctx, 0.016); G.hud.draw(ctx); G.menus.over(ctx); snap('win');
  G.state = 'play';
  return shots.map(s => ({ name: s.name, url: s.c.toDataURL('image/png') }));
});
if (screensFull) for (const s of screens) save('screen_' + s.name + '.png', s.url);
const sheetUrl = await page.evaluate(async screens => {
  const cols = 3, w = 640, h = 363, pad = 4, rows = Math.ceil(screens.length / cols);
  const sheet = document.createElement('canvas'); sheet.width = cols * (w + pad); sheet.height = rows * (h + pad + 14);
  const sc = sheet.getContext('2d'); sc.fillStyle = '#222'; sc.fillRect(0, 0, sheet.width, sheet.height);
  for (let i = 0; i < screens.length; i++) {
    const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = screens[i].url; });
    const x = (i % cols) * (w + pad), y = Math.floor(i / cols) * (h + pad + 14);
    sc.drawImage(img, x, y + 14, w, h); sc.fillStyle = '#fff'; sc.font = '12px monospace'; sc.textBaseline = 'top'; sc.fillText(screens[i].name, x + 2, y + 1);
  }
  return sheet.toDataURL('image/png');
}, screens);
save('screens.png', sheetUrl); console.log('wrote tools/shots/screens.png (' + screens.length + ' screens)');

// ---- palettes: the sky, far, near, tile, edge and accent colours of every region side by side
const pal = await page.evaluate(() => {
  const ids = ['hub', 'r1', 'r2', 'r3', 'r4', 'final'], keys = ['sky0', 'sky1', 'sky2', 'far', 'near', 'tile', 'side', 'edge', 'edgeHi', 'accent', 'spike'];
  const sheet = document.createElement('canvas'); sheet.width = 120 + keys.length * 70; sheet.height = ids.length * 40 + 20;
  const sc = sheet.getContext('2d'); sc.fillStyle = '#111'; sc.fillRect(0, 0, sheet.width, sheet.height); sc.font = '11px monospace'; sc.textBaseline = 'middle';
  keys.forEach((k, j) => { sc.fillStyle = '#ccc'; sc.fillText(k, 124 + j * 70, 8); });
  ids.forEach((id, i) => { const p = G.art.palette(id); sc.fillStyle = '#ccc'; sc.fillText(id, 4, 40 + i * 40); keys.forEach((k, j) => { sc.fillStyle = p[k] || '#f0f'; sc.fillRect(120 + j * 70, 22 + i * 40, 64, 34); }); });
  return sheet.toDataURL('image/png');
});
save('palettes.png', pal); console.log('wrote tools/shots/palettes.png');
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();
