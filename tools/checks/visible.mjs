// "The character is disappearing": play the PUBLISHED way (served over http, click "Click to play", real keyboard events in real time, no G.debug stepping) and fail
// if the player's sprite is not drawn in any frame of any situation. A monitor in the page wraps Player.draw: every draw must call G.art.drawFrame for a player strip
// (or draw the code-drawn body) at a finite frame, with globalAlpha >= 0.4, and must change pixels in a crop around the player (the crop before and after the same draw).
// Every rendered frame in play, pause and map must also draw each player once. Situations: run, jump, double jump, dash, wall slide, slashes, heavy cut, tokens, mend,
// hurt, death and restart, rooms, pause and resume, hold Esc in the hub, tab away, idle for a minute. Set VISIBLE_SHOTS=1 to keep a crop after each action.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const slow = true;
export const weight = 120;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

const serve = () => new Promise(res => {
  const srv = http.createServer((req, rsp) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
    rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
  }).listen(0, '127.0.0.1', () => res(srv));
});

const MONITOR = () => {
  const V = window.__vis = { draws: 0, bad: [], frames: 0, missing: 0, log: [], pixel: true, minChange: 25 };
  const art = G.art, df = art.drawFrame, dr = art.draw;
  let calls = null;
  art.drawFrame = function (id, ctx, n, o) { if (calls && /^player_/.test(id)) calls.push({ id, n, alpha: ctx.globalAlpha }); return df.apply(this, arguments); };
  const pd = G.Player.prototype.draw;
  let drawn = 0;
  G.Player.prototype.draw = function (ctx, dt) {
    const p = this; drawn++; V.draws++;
    calls = [];
    let before = null, x0 = 0, y0 = 0, w = 0, h = 0;
    if (V.pixel) {
      const m = ctx.getTransform(), s = m.a;
      x0 = Math.floor(m.e + (p.x - 40) * s); y0 = Math.floor(m.f + (p.y - 84) * s); w = Math.ceil(80 * s); h = Math.ceil(92 * s);
      const cw = ctx.canvas.width, ch = ctx.canvas.height, cx0 = Math.max(0, x0), cy0 = Math.max(0, y0);
      x0 = cx0; y0 = cy0; w = Math.min(cw, x0 + w) - x0; h = Math.min(ch, y0 + h) - y0;
      if (w > 4 && h > 4) before = ctx.getImageData(x0, y0, w, h).data; else before = null;
    }
    pd.call(this, ctx, dt);
    const why = [];
    const strips = calls.filter(c => c.id.startsWith('player_'));
    if (G.debug.hidePlayers) return;
    if (G.artTest && G.strips.player_idle && G.strips.player_run) {
      if (strips.length !== 1) why.push('drawFrame calls: ' + strips.length);
      for (const c of strips) { if (!Number.isFinite(c.n)) why.push('frame ' + c.n); if (!(c.alpha >= 0.4)) why.push('alpha ' + c.alpha + ' strip ' + c.id); }
    }
    if (before) {
      const after = ctx.getImageData(x0, y0, w, h).data; let ch = 0;
      for (let i = 0; i < after.length; i += 4) if (Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]) > 24) ch++;
      if (ch < V.minChange) why.push('crop unchanged (' + ch + ' px)');
    }
    if (why.length && V.bad.length < 40) V.bad.push({ t: +G.time.toFixed(2), what: V.what, why: why.join('; '), x: Math.round(p.x), y: Math.round(p.y), inv: +p.inv.toFixed(2), down: p.down, strip: G.pickStrip(p).join(':'), face: p.face, state: G.state, trans: !!G.rooms.trans });
  };
  const rd = G.rooms.draw;
  G.rooms.draw = function (ctx, dt) {
    drawn = 0; rd.apply(this, arguments); V.frames++;
    if (drawn !== G.players.length && V.log.length < 20) V.log.push({ t: +G.time.toFixed(2), what: V.what, expected: G.players.length, drawn, state: G.state });
    if (drawn !== G.players.length) V.missing++;
  };
};

export default async ({ page, shots }) => {
  const srv = await serve(), url = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pg = await ctx.newPage();
  const errors = [], failed = [];
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('requestfailed', r => failed.push(r.url()));
  pg.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  const keep = !!process.env.VISIBLE_SHOTS;
  const dir = shots + '/visible'; if (keep) fs.mkdirSync(dir, { recursive: true });
  const wait = ms => pg.waitForTimeout(ms);
  const kb = pg.keyboard;
  const tap = async (k, ms = 70) => { await kb.down(k); await wait(ms); await kb.up(k); };
  const mark = async what => { await pg.evaluate(w => { window.__vis.what = w; }, what); };
  const shot = async what => {
    if (!keep) return;
    const box = await pg.evaluate(() => { const p = G.players[0], r = document.getElementById('game').getBoundingClientRect(), k = r.width / 960; return { x: r.x + (p.x - G.cam.x) * k, y: r.y + (p.y - G.cam.y) * k, k }; });
    await pg.screenshot({ path: dir + '/' + what.replace(/\W+/g, '_') + '.png', clip: { x: Math.max(0, box.x - 90), y: Math.max(0, box.y - 120), width: 180, height: 150 } });
  };
  const _skip = 0;
  const act = async (what, fn, settle = 120) => { await mark(what); await fn(); await wait(settle); await shot(what); };
  const check = async what => {
    const r = await pg.evaluate(() => ({ bad: window.__vis.bad.slice(), missing: window.__vis.missing, log: window.__vis.log.slice(), n: window.__vis.draws, st: G.state, errs: G.errors.slice() }));
    if (r.bad.length || r.missing || r.errs.length) throw new Error('player not visible after "' + what + '": ' + JSON.stringify({ bad: r.bad.slice(0, 5), missing: r.missing, log: r.log.slice(0, 5), errs: r.errs.slice(0, 3) }));
    if (!r.n) throw new Error('no player drawn after "' + what + '"');
    return r;
  };
  try {
    await pg.goto(url);
    await pg.waitForFunction(() => window.G && G.debug && G.strips && !G.spritesPending, null, { timeout: 15000 });
    await pg.evaluate(MONITOR);
    // the strips load over http
    const strips = await pg.evaluate(() => Object.keys(G.strips).filter(k => k.startsWith('player_')).length);
    if (strips < 19) throw new Error('only ' + strips + ' of 19 player strips loaded over http: ' + failed.join(' '));
    // start flow: the title shows, the overlay button starts, any key makes the keyboard player 1
    await pg.click('#start'); await wait(300);
    if (await pg.evaluate(() => !document.getElementById('start').hidden)) throw new Error('"Click to play" overlay still showing after the click');
    await kb.press('KeyX'); await wait(400);
    if (await pg.evaluate(() => G.state) !== 'play') throw new Error('a key press on the title did not start the run');
    await pg.evaluate(() => { G.run.abil.dash = G.run.abil.grip = G.run.abil.double = G.run.abil.heavy = true; });
    await check('start');
    await act('idle', async () => {}, 500); await check('idle');
    await act('run right', async () => { await kb.down('ArrowRight'); await wait(700); }); await shot('run right b'); await kb.up('ArrowRight');
    await act('run left', async () => { await kb.down('ArrowLeft'); await wait(700); }); await kb.up('ArrowLeft'); await check('run');
    await act('jump', async () => { await kb.down('Space'); await wait(250); }, 50); await kb.up('Space'); await wait(500);
    await act('jump left', async () => { await kb.down('ArrowLeft'); await tap('Space', 200); await wait(300); await kb.up('ArrowLeft'); }, 400); await check('jump');
    await act('double jump', async () => { await kb.down('KeyZ'); await wait(60); await kb.up('KeyZ'); await wait(150); await kb.down('KeyZ'); await wait(200); await kb.up('KeyZ'); }, 600); await check('double jump');
    await act('dash', async () => { await kb.down('ArrowRight'); await tap('KeyC', 60); await wait(300); await kb.up('ArrowRight'); }, 300);
    await act('dash left in air', async () => { await tap('Space', 200); await kb.down('ArrowLeft'); await tap('ShiftLeft', 60); await wait(300); await kb.up('ArrowLeft'); }, 600); await check('dash');
    for (const [name, keys] of [['slash', []], ['slash up', ['ArrowUp']], ['slash down air', ['ArrowDown']], ['slash left', ['ArrowLeft']]]) {
      await act(name, async () => {
        if (name === 'slash down air') { await tap('Space', 250); await wait(150); }
        for (const k of keys) await kb.down(k); await tap('KeyX', 60); await wait(120); for (const k of keys) await kb.up(k);
      }, 500);
    }
    await check('slashes');
    await act('heavy cut', async () => { await kb.down('KeyX'); await wait(700); await shot('heavy charge'); await kb.up('KeyX'); await wait(100); }, 500); await check('heavy');
    // wall slide: put the player beside a wall in the air (setup only), then hold into it
    await act('wall slide', async () => {
      const ok = await pg.evaluate(() => {
        const t = G.tiles, T = G.C.T; for (let r = 4; r < t.rows - 2; r++) for (let c = 2; c < t.cols - 2; c++) {
          if (t.solid(c, r) && t.solid(c, r - 1) && t.solid(c, r - 2) && t.solid(c, r - 3) && !t.solid(c - 1, r) && !t.solid(c - 1, r - 1) && !t.solid(c - 1, r - 2) && !t.solid(c - 1, r - 3) && !t.solid(c - 1, r - 4)) {
            G.players[0].place(c * T - 12, (r - 3) * T, 1); return true; } }
        return false; });
      await kb.down('ArrowRight'); await wait(500); await shot('wall slide hold'); await tap('Space', 150); await wait(200); await kb.up('ArrowRight');
      return ok;
    }, 400); await check('wall slide');
    // tokens: one of each cut, use and switch
    await pg.evaluate(() => { const p = G.players[0]; p.items = []; const ids = Object.keys(G.itemDefs).filter(id => !G.itemDefs[id].rare); const seen = new Set(); for (const id of ids) { const c = G.itemDefs[id].cls; if (!seen.has(c) && p.items.length < p.slots) { seen.add(c); p.items.push(id); } } });
    for (let i = 0; i < 3; i++) await act('token ' + i, async () => { await pg.evaluate(() => { G.players[0].itemCd = 0; }); await tap('KeyV', 60); await wait(400); await tap('KeyQ', 50); }, 500);
    await check('tokens');
    await act('mend', async () => { await pg.evaluate(() => { const p = G.players[0]; p.hp = 1; p.glow = 90; }); await kb.down('KeyF'); await wait(900); await shot('mend hold'); await wait(600); await kb.up('KeyF'); }, 300); await check('mend');
    await act('hurt', async () => { await pg.evaluate(() => { G.players[0].hurt(G.players[0].x + 30); }); await wait(150); await shot('hurt flash'); await wait(1400); }, 300); await check('hurt');
    const inv = await pg.evaluate(() => G.players[0].inv); if (inv > 0) throw new Error('invincibility never ended: ' + inv);
    await act('die', async () => { await pg.evaluate(() => { const p = G.players[0]; p.inv = 0; p.hp = 1; p.hurt(p.x + 20); }); await wait(900); }, 300); await check('die');
    await wait(1200); await act('over screen', async () => {}, 200);
    if (await pg.evaluate(() => G.state) !== 'over') throw new Error('state after death is ' + await pg.evaluate(() => G.state) + ', not over');
    await act('restart', async () => { await tap('Space', 80); await wait(500); }, 300);
    if (await pg.evaluate(() => G.state) !== 'play') throw new Error('Jump on the run-over screen did not restart');
    await pg.evaluate(() => { G.run.abil.dash = G.run.abil.grip = G.run.abil.double = G.run.abil.heavy = true; });
    await check('restart');
    // rooms: walk through the hub's gates and each region's first rooms with real Up presses at doors
    const names = await pg.evaluate(() => Object.keys(G.regionDefs));
    for (const r of names.slice(0, 4)) {
      await act('door to ' + r, async () => {
        const ok = await pg.evaluate(rg => {
          const room = G.rooms.current; if (!room) return false;
          const d = room.props.find(p => (p.type === 'gate' || p.type === 'door') && JSON.stringify(p.data).includes(rg)) || room.props.find(p => p.type === 'gate' || p.type === 'door');
          if (!d) return false; G.players[0].place(d.x, d.y, 1); return true;
        }, r);
        await wait(80); await tap('ArrowUp', 100); await wait(600);
      }, 400);
      await check('door ' + r);
      await act('in ' + r, async () => { await kb.down('ArrowRight'); await wait(900); await tap('Space', 150); await wait(500); await kb.up('ArrowRight'); }, 200); await check('walk ' + r);
      await pg.evaluate(() => { G.game.newRun(); G.run.abil.dash = G.run.abil.grip = G.run.abil.double = G.run.abil.heavy = true; }); await wait(300);
    }
    await pg.evaluate(() => { const ids = Object.keys(G.run.graph.nodes); const n = ids[Math.min(ids.length - 1, 5)]; G.rooms.go(n, { side: 'left' }); });
    await wait(600); await check('room transition'); await shot('room transition');
    // pause and resume, hold keys while paused, the map
    await act('pause', async () => { await tap('Escape', 60); await wait(400); }, 100);
    if (await pg.evaluate(() => G.state) !== 'pause') throw new Error('Esc did not pause');
    await tap('Escape', 60); await wait(300);
    if (await pg.evaluate(() => G.state) !== 'play') throw new Error('Esc did not resume: ' + await pg.evaluate(() => G.state));
    await act('pause key P', async () => { await tap('KeyP', 60); await wait(300); await tap('KeyP', 60); await wait(300); }, 100); await check('pause');
    await act('map', async () => { await tap('Tab', 60); await wait(300); await tap('Tab', 60); await wait(300); }, 100); await check('map');
    // the Junction: hold Esc for 1.3 s with the only player: nothing is removed
    await pg.evaluate(() => { G.game.newRun(); }); await wait(300);
    const hub = await pg.evaluate(() => G.rooms.current.id === G.run.graph.hub);
    await act('hold Esc in hub', async () => { await kb.down('Escape'); await wait(1400); await kb.up('Escape'); await wait(300); }, 200);
    const np = await pg.evaluate(() => G.players.length);
    if (!hub || np !== 1) throw new Error('hold Esc in the hub: hub ' + hub + ', players ' + np);
    if (await pg.evaluate(() => G.state) === 'pause') await tap('Escape', 60); await wait(300);
    if (await pg.evaluate(() => G.state) !== 'play') throw new Error('could not resume after holding Esc');
    await check('hold Esc');
    // tab away and back
    await act('blur', async () => { await pg.evaluate(() => window.dispatchEvent(new Event('blur'))); await wait(300); }, 100);
    await pg.evaluate(() => document.getElementById('game').focus());
    if (await pg.evaluate(() => G.state) === 'pause') await tap('Escape', 60); await wait(300);
    const page2 = await ctx.newPage(); await page2.bringToFront(); await wait(500); await pg.bringToFront(); await wait(400);
    await page2.close(); await pg.bringToFront();
    if (await pg.evaluate(() => G.state) === 'pause') await tap('Escape', 60); await wait(300);
    await act('after tab', async () => { await kb.down('ArrowRight'); await wait(500); await kb.up('ArrowRight'); }, 200); await check('tab away');
    // a held key across a pause
    await kb.down('ArrowLeft'); await wait(300); await tap('Escape', 60); await wait(300); await tap('Escape', 60); await wait(500); await kb.up('ArrowLeft'); await check('held across pause');
    // a second player joins by pressing nothing here (no extra device): four code players wear the strips too
    await act('idle one minute', async () => { await wait(process.env.VISIBLE_IDLE ? +process.env.VISIBLE_IDLE : 60000); }, 100); await check('idle');
    const r = await check('end');
    const stuck = await pg.evaluate(() => G.state);
    if (stuck !== 'play') throw new Error('after the minute of idling the state is ' + stuck);
    if (errors.length) throw new Error('page errors: ' + errors.slice(0, 3).join(' | ') + ' failed: ' + failed.join(' '));
    const miss = failed.filter(u => /assets\/player\//.test(u)); if (miss.length) throw new Error('player strips failed to load: ' + miss.join(' '));
    return r.n + ' player draws, all visible' + (failed.length ? ' (other failed requests: ' + failed.length + ')' : '');
  } finally { await ctx.close().catch(() => {}); srv.close(); }
};
