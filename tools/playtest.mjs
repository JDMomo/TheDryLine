/* The human-like playtester. It plays "The Dry Line" in headless Chrome the way a newcomer would: it serves a COPY of the game (taken when it starts, so other
   people's edits cannot break a run half-way), clicks "Click to play", and presses ONLY real keyboard keys (Playwright keyboard: CDP key events that go through
   js/core/input.js). It decides what to press from what it reads (G.debug.state(), the tile grid, hostile shots); it never acts through G.debug.
   The brain is tools/lib/ptbrain.js.

   node tools/playtest.mjs --seeds=1-25 --jobs=2            batch: one browser process per run, results in tools/playtest_out/<stamp>/
   node tools/playtest.mjs --seed=7                         one run, printed
   node tools/playtest.mjs --seeds=1-4 --ignore-chart       control group: a bot that never looks at the lock chart
   node tools/playtest.mjs --seeds=30-37 --assist           a hit that would kill is turned into a continue (recorded as a death): coverage of the later Wardens
   node tools/playtest.mjs --audio                          one long session with the real AudioContext, sampled once a second (see docs/PLAYTEST_REPORT.md)
   node tools/playtest.mjs --report=<dir>                   markdown tables of a finished batch
   Options: --scale=N (game seconds per real second, default 2; the bot's reactions are in game time), --maxmin=N (game minutes per run, default 40),
            --wallmin=N (real minutes per run, default 30), --keep (keep the temp copy of the game) */
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/npm-tools/node_modules/');
const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mid': 'audio/midi' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEYMAP = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Space', attack: 'KeyX', dash: 'KeyC', item: 'KeyV', heal: 'KeyF', cycle: 'KeyQ', map: 'Tab', pause: 'Escape' };

const serve = root => new Promise(res => {
  const srv = http.createServer((req, rsp) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
    rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
  }).listen(0, '127.0.0.1', () => res(srv));
});

// ---------------------------------------------------------------------------------------------------------------- one run
async function worker() {
  const { chromium } = require('playwright');
  const root = args.root, seed = args.seed, out = args.out, scale = +(args.scale || 3), maxGame = +(args.maxmin || 40) * 60, wallMax = +(args.wallmin || 30) * 60e3;
  const audio = !!args.audio, assist = !!args.assist || audio, ignoreChart = !!args['ignore-chart'];
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
  const srv = await serve(root), url = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--no-first-run', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 560 } });
  const page = await ctx.newPage();
  const errors = [], failed = [], t0 = Date.now(); let end = 'unknown';
  page.on('pageerror', e => errors.push({ kind: 'pageerror', text: String(e.stack || e).slice(0, 600) }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ kind: 'console', text: m.text().slice(0, 300) }); });
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  const sc = scale;
  await page.addInitScript(s => { if (s === 1) return; const raf = window.requestAnimationFrame.bind(window), b = performance.now(); window.requestAnimationFrame = cb => raf(t => cb(b + (t - b) * s)); }, sc);
  const result = { seed, ignoreChart, assist, scale, audio };
  try {
    await page.goto(url + '#' + (+seed).toString(36).toUpperCase() + '-0');          // a run code: this seed, no cuts unlocked (a fresh player)
    await page.waitForFunction(() => window.G && G.debug && G.strips && !G.spritesPending, null, { timeout: 30000 });
    await page.addScriptTag({ path: path.join(here, 'lib', 'ptbrain.js') });
    await page.evaluate(o => { PT.reset(o); PT.install(); }, { seed: +seed, region: args.region || null, ignoreChart, assist, explore: audio, pipeAlways: audio });
    await page.evaluate(AUDIO_SAMPLER);
    await page.click('#start'); await sleep(300);
    await page.keyboard.press('KeyX'); await sleep(300);
    result.startState = await page.evaluate(() => G.state);
    result.code = await page.evaluate(() => G.run && G.run.code);
    const held = new Set(); let lastStuckAt = -99, nDeaths = 0, last = {}, lastShot = 0, ticks = 0;
    const kb = page.keyboard;
    const shot = async name => { try { const f = `playtest_s${seed}_${name}.png`; await page.screenshot({ path: path.join(out, 'shots', f) }); fs.mkdirSync(path.join(gameRoot, 'tools', 'shots'), { recursive: true }); fs.copyFileSync(path.join(out, 'shots', f), path.join(gameRoot, 'tools', 'shots', f)); } catch (e) { /* page busy */ } };
    for (;;) {
      if (Date.now() - t0 > wallMax) { end = 'wall-timeout'; break; }
      const r = await page.evaluate(() => { const o = PT.tick(); return o && { keys: o.keys, done: o.done, rt: o.rt, shot: o.shot, deaths: o.deaths, room: o.room, note: o.note, stuck: o.stuck, state: o.state, over: o.over }; });
      ticks++;
      if (!r) { await sleep(4); continue; }
      last = r;
      const want = new Set(r.keys);
      for (const k of held) if (!want.has(k)) { await kb.up(KEYMAP[k]); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await kb.down(KEYMAP[k]); held.add(k); }
      if (r.shot) await shot(r.shot);
      if (r.deaths > nDeaths) { nDeaths = r.deaths; await shot(`death${nDeaths}`); }
      if (r.stuck && r.rt - lastStuckAt > 12) { lastStuckAt = r.rt; const info = await page.evaluate(() => { const p = G.players[0]; return { room: G.rooms.current.id, def: G.rooms.current.def.id, x: Math.round(p.x), y: Math.round(p.y), onGround: p.onGround, mission: PT.mis && PT.mis.why, note: PT.lastNote, at: PT.mis && PT.mis.x !== undefined ? [Math.round(PT.mis.x), Math.round(PT.mis.y)] : null }; }); await page.evaluate(i => PT.log.stuck.push(Object.assign({ t: +G.run.time.toFixed(1), for: Math.round(PT.stuckFor) }, i)), info); await shot(`stuck${(await page.evaluate(() => PT.log.stuck.length))}`); }
      if (r.done) { end = r.over === 'win' ? 'win' : 'dead'; break; }
      if (r.state === 'over') { end = 'dead'; break; }
      if (r.rt > maxGame) { end = 'game-timeout'; break; }
      if (audio && r.rt > 0 && await page.evaluate(() => PT.log.fights.some(f => f.result === 'beaten') && (window.__audDone = (window.__audDone || G.run.time)) && G.run.time - window.__audDone > 40)) { end = 'audio-session-done'; break; }
      if (audio && Date.now() - t0 > (+(args.audiomin || 12)) * 60e3) { end = 'audio-time-up'; break; }
      await sleep(3);
    }
    for (const k of held) await kb.up(KEYMAP[k]);
    if (end === 'dead') { await sleep(150); await shot('over'); }
    result.final = await page.evaluate(() => {
      PT.finalize(); const run = G.run, S = G.debug.state();
      return { log: PT.log, vis: PT.vis, drawCost: PT.drawCost, errorsG: G.errors.slice(), rebuilds: G.audio ? G.audio.rebuilds || 0 : null, run: { code: run.code, seed: run.seed, time: +run.time.toFixed(1), shards: run.shards, abil: run.abil, trinkets: run.trinkets, beaten: run.beaten, over: run.over, stats: run.stats, grades: run.grades, chart: run.graph.chart, items: G.players[0].items.slice(), spent: run.spent, tickets: run.tickets, maxHp: G.players[0].maxHp, rooms: Object.keys(run.rooms).length, nodes: Object.keys(run.graph.nodes).length }, state: G.state, aud: window.AUD || null };
    });
  } catch (e) { end = 'error'; result.error = String(e && e.stack || e).slice(0, 1500); }
  result.end = end; result.wall = Math.round((Date.now() - t0) / 1000); result.errors = errors; result.failed = failed;
  fs.writeFileSync(path.join(out, `run_${audio ? 'audio' : seed}.json`), JSON.stringify(result));
  await browser.close().catch(() => {}); srv.close();
  process.exit(0);
}

// Audio session: an AnalyserNode on G.audio.engine.limiter, sampled about once a second. NaN, a sustained RMS above 0.3 and G.audio.rebuilds > 0 are flagged.
const AUDIO_SAMPLER = () => {
  const A = window.AUD = { samples: [], flags: [], maxRms: 0, maxPeak: 0, nan: 0, hot: 0, hotRun: 0, hotMax: 0, engines: 0, ctxStates: {} };
  let an = null, eng = null, buf = null;
  const sample = () => {
    const e = G.audio && G.audio.engine; if (!e || !e.limiter) { A.samples.push({ t: +G.time.toFixed(1), noEngine: true }); return; }
    if (e !== eng) { eng = e; A.engines++; try { an = e.limiter.context.createAnalyser(); an.fftSize = 2048; e.limiter.connect(an); buf = new Float32Array(2048); } catch (x) { A.flags.push('cannot attach analyser: ' + x); } }
    const ctx = e.limiter.context; A.ctxStates[ctx.state] = (A.ctxStates[ctx.state] || 0) + 1;
    if (!an) return;
    an.getFloatTimeDomainData(buf); let sum = 0, peak = 0, nan = 0;
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (v !== v) { nan++; continue; } sum += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); }
    const rms = Math.sqrt(sum / buf.length);
    A.maxRms = Math.max(A.maxRms, rms); A.maxPeak = Math.max(A.maxPeak, peak); if (nan) { A.nan++; A.flags.push('NaN at game ' + G.time.toFixed(1)); }
    if (rms > 0.3) { A.hot++; A.hotRun++; A.hotMax = Math.max(A.hotMax, A.hotRun); if (A.hotRun === 3) A.flags.push('RMS above 0.3 for 3 samples in a row at game ' + G.time.toFixed(1)); } else A.hotRun = 0;
    const rb = G.audio.rebuilds || 0; if (rb > (A.rebuilds || 0)) A.flags.push('G.audio.rebuilds = ' + rb + ' at game ' + G.time.toFixed(1)); A.rebuilds = rb;
    A.samples.push({ t: +G.time.toFixed(1), rms: +rms.toFixed(4), peak: +peak.toFixed(3), ctx: ctx.state, track: G.audio.current && G.audio.current(), room: G.rooms.current && G.rooms.current.id });
  };
  setInterval(() => { try { sample(); } catch (e) { A.flags.push('sampler: ' + e); } }, 1000);
};

// ---------------------------------------------------------------------------------------------------------------- batch
const parseSeeds = s => String(s).split(',').flatMap(p => { const m = /^(\d+)-(\d+)$/.exec(p); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [+p]; });
function copyGame(dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['index.html', 'js', 'css', 'assets']) fs.cpSync(path.join(gameRoot, f), path.join(dest, f), { recursive: true });
}
async function checkCopy(root) {
  const { chromium } = require('playwright'), srv = await serve(root), errs = [];
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--mute-audio'] });
  try {
    const pg = await br.newPage(); pg.on('pageerror', e => errs.push(String(e).slice(0, 200))); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html#1-0'); await pg.waitForFunction(() => window.G && G.debug && G.strips && !G.spritesPending, null, { timeout: 30000 });
    await pg.click('#start'); await pg.keyboard.press('KeyX'); await sleep(2500);
    const st = await pg.evaluate(() => ({ state: G.state, t: G.time, errs: G.errors.slice(0, 3) }));
    if (st.state !== 'play' || st.t < 1) errs.push('state ' + st.state + ' t ' + st.t); if (st.errs.length) errs.push(...st.errs);
  } catch (e) { errs.push(String(e).slice(0, 200)); } finally { await br.close(); srv.close(); }
  return errs.length ? errs[0] : '';
}
async function batch() {
  const seeds = args.seed ? [+args.seed] : args.audio ? [1] : parseSeeds(args.seeds || '1-25'), jobs = +(args.jobs || 2);
  const stamp = args.audio ? 'audio' : new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + (args['ignore-chart'] ? '_nochart' : '') + (args.assist ? '_assist' : '');
  const out = path.join(gameRoot, 'tools', 'playtest_out', args.out || stamp); fs.mkdirSync(out, { recursive: true });
  // Other teams edit the tree while this runs: take a copy, and only accept it when the copy itself loads and draws a few frames without an error.
  let tmp = '';
  for (let attempt = 1; attempt <= 8; attempt++) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dryline-pt-')); copyGame(tmp);
    const why = await checkCopy(tmp);
    if (!why) break;
    console.log(`snapshot ${attempt} is not a working game (${why}); the tree is probably being edited, trying again in 20 s`);
    fs.rmSync(tmp, { recursive: true, force: true }); if (attempt === 8) throw new Error('could not take a working snapshot of the game'); await sleep(20000);
  }
  console.log('playtest: game copied to ' + tmp + ', results in ' + out + ', seeds ' + seeds.join(','));
  const passthrough = Object.entries(args).filter(([k]) => !['seeds', 'seed', 'jobs', 'out', 'report'].includes(k)).map(([k, v]) => v === true ? '--' + k : '--' + k + '=' + v);
  const queue = seeds.slice(); let running = 0, done = 0;
  await new Promise(resolve => {
    const next = () => {
      while (running < jobs && queue.length) {
        const seed = queue.shift(); running++;
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', `--root=${tmp}`, `--seed=${seed}`, `--out=${out}`, ...passthrough], { stdio: ['ignore', 'inherit', 'inherit'] });
        const t0 = Date.now();
        child.on('exit', () => { running--; done++; let note = '?'; try { const j = JSON.parse(fs.readFileSync(path.join(out, `run_${args.audio ? 'audio' : seed}.json`))); note = `${j.end}, game ${j.final ? j.final.run.time + ' s' : '-'}, rooms ${j.final ? j.final.run.rooms : '-'}, beaten ${j.final ? Object.keys(j.final.run.beaten).join('+') || '-' : '-'}`; } catch (e) { /* no file */ }
          console.log(`seed ${seed} done in ${Math.round((Date.now() - t0) / 1000)} s (${done}/${seeds.length}): ${note}`); if (queue.length) next(); else if (!running) resolve(); });
      }
      if (!queue.length && !running) resolve();
    };
    next();
  });
  if (!args.keep) fs.rmSync(tmp, { recursive: true, force: true });
  console.log('done: ' + out);
  if (!args.audio) report(out);
}

// ---------------------------------------------------------------------------------------------------------------- tables
const fmtT = s => s === undefined || s === null || isNaN(s) ? '-' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '-';
const median = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quant = (a, q) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const table = (head, rows) => '| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|\n' + rows.map(r => '| ' + r.join(' | ') + ' |').join('\n') + '\n';
export function report(dir) {
  const runs = fs.readdirSync(dir).filter(f => /^run_\d+\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(dir, f)))).sort((a, b) => a.seed - b.seed);
  let md = '';
  md += '### Runs\n\n' + table(['seed', 'run code', 'ended', 'game time', 'wall s', 'rooms', 'Wardens beaten', 'deaths', 'hits taken', 'scrip earned / spent', 'stuck', 'errors', 'undrawn frames'],
    runs.map(r => { const f = r.final; if (!f) return [r.seed, '-', r.end + (r.error ? ' (' + r.error.split('\n')[0] + ')' : ''), '-', r.wall, '-', '-', '-', '-', '-', '-', r.errors.length, '-']; const L = f.log;
      return [r.seed, r.code, r.end, fmtT(f.run.time), r.wall, f.run.rooms + '/' + f.run.nodes, Object.keys(f.run.beaten).filter(k => f.run.beaten[k]).join(' ') || '-', L.deaths.length, L.hits.length, Math.round(L.earned || 0) + ' / ' + Math.round(L.spent || 0), L.stuck.length, r.errors.length + f.errorsG.length, f.vis.noPlayer + f.vis.noBoss + f.vis.pixelBad]; }));
  const ok = runs.filter(r => r.final);
  // lengths
  const times = ok.map(r => r.final.run.time), wins = ok.filter(r => r.end === 'win');
  md += '\n### Run length (game time)\n\n' + table(['n', 'min', 'p25', 'median', 'p75', 'max', 'wins', 'deaths', 'timeouts'], [[ok.length, fmtT(Math.min(...times)), fmtT(quant(times, .25)), fmtT(median(times)), fmtT(quant(times, .75)), fmtT(Math.max(...times)), wins.length, ok.filter(r => r.end === 'dead').length, ok.filter(r => /timeout/.test(r.end)).length]]);
  // damage by source
  const bySrc = {}, byRegion = {}; let total = 0;
  for (const r of ok) for (const h of r.final.log.hits) { const k = h.src.replace(/^boss:([a-z_0-9]+):.*/, 'boss:$1').replace(/^shot:/, 'shot from '); bySrc[k] = (bySrc[k] || 0) + 1; total++; byRegion[h.region] = (byRegion[h.region] || 0) + 1; }
  md += '\n### Damage taken by source (all runs, pips)\n\n' + table(['source', 'pips', 'share'], Object.entries(bySrc).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, pct(v, total)]));
  md += '\n### Damage by region\n\n' + table(['region', 'pips'], Object.entries(byRegion).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]));
  // deaths
  const deaths = ok.flatMap(r => r.final.log.deaths.map(d => Object.assign({ seed: r.seed }, d)));
  md += '\n### Deaths\n\n' + (deaths.length ? table(['seed', 'game time', 'room', 'template', 'region', 'killed by', 'boss', 'boss hp left', 'assisted'], deaths.map(d => [d.seed, fmtT(d.t), d.room, d.def, d.region, d.src, d.boss || '-', d.bossHp !== null && d.bossHp !== undefined ? d.bossHp : '-', d.assisted ? 'yes' : ''])) : 'none\n');
  // fights
  const fights = ok.flatMap(r => r.final.log.fights.map(f => Object.assign({ seed: r.seed }, f)));
  md += '\n### Warden fights\n\n' + (fights.length ? table(['seed', 'Warden', 'result', 'time', 'hits taken', 'chart', 'slots open', 'carried', 'punched', 'boss hp left', 'grade'], fights.map(f => [f.seed, f.boss, f.result, fmtT(f.dur), f.hits, (f.chart || []).join('/'), f.open.join('/') || '-', f.carried.join('/') || '-', f.punched.join('/') || '-', f.bossHpLeft + '/' + f.bossHpMax, f.grade ? (f.grade.clean ? 'clean ' : '') + fmtT(f.grade.time) + ' (par ' + fmtT(f.grade.par) + ')' : '-'])) : 'none\n');
  // rooms
  const rt = {};
  for (const r of ok) for (const x of r.final.log.rooms) { const end = x.left !== undefined ? x.left : r.final.run.time; (rt[x.def] = rt[x.def] || []).push(end - x.enter); }
  md += '\n### Time per room template (s, game time)\n\n' + table(['template', 'visits', 'median', 'max'], Object.entries(rt).sort((a, b) => median(b[1]) - median(a[1])).slice(0, 25).map(([k, v]) => [k, v.length, Math.round(median(v)), Math.round(Math.max(...v))]));
  // tokens
  const tk = ok.flatMap(r => r.final.log.tokens.map(t => Object.assign({ seed: r.seed }, t)));
  md += '\n### Tokens picked up\n\n' + (tk.length ? table(['seed', 'game time', 'token', 'cut', 'room', 'why', 'full party swap', 'on the next Warden\'s chart'], tk.map(t => [t.seed, fmtT(t.t), t.item, t.cut, t.room + ' (' + t.def + ')', t.why, t.swap ? 'yes' : '', t.chartMatch ? 'yes' : 'no'])) : 'none\n');
  // stuck
  const st = ok.flatMap(r => r.final.log.stuck.map(s => Object.assign({ seed: r.seed }, s)));
  md += '\n### Stuck for more than 10 s\n\n' + (st.length ? table(['seed', 'game time', 'for (s)', 'room', 'template', 'at', 'wanted', 'doing', 'on ground'], st.map(s => [s.seed, fmtT(s.t), s.for, s.room, s.def, s.x + ',' + s.y, s.mission || '-', s.note || '-', s.onGround])) : 'none\n');
  // visibility and errors
  const vis = ok.map(r => ({ seed: r.seed, np: r.final.vis.noPlayer, nb: r.final.vis.noBoss, px: r.final.vis.pixelBad, frames: r.final.vis.frames, checked: r.final.vis.pixelChecked }));
  md += '\n### Drawing and errors\n\n' + table(['what', 'count'], [['rendered frames', vis.reduce((a, v) => a + v.frames, 0)], ['frames with a player not drawn', vis.reduce((a, v) => a + v.np, 0)], ['frames with the boss not drawn', vis.reduce((a, v) => a + v.nb, 0)], ['pixel checks of the player crop', vis.reduce((a, v) => a + v.checked, 0)], ['pixel checks that found an empty crop', vis.reduce((a, v) => a + v.px, 0)], ['console / page errors', runs.reduce((a, r) => a + r.errors.length, 0)], ['G.errors entries', ok.reduce((a, r) => a + r.final.errorsG.length, 0)], ['failed requests', runs.reduce((a, r) => a + r.failed.length, 0)]]);
  const errs = runs.flatMap(r => r.errors.map(e => `seed ${r.seed}: ${e.text}`).concat(r.final ? r.final.errorsG.map(e => `seed ${r.seed}: G.errors ${e}`) : []));
  if (errs.length) md += '\n' + [...new Set(errs)].slice(0, 20).map(e => '- ' + e).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'tables.md'), md);
  console.log(md);
}

if (args.worker) await worker();
else if (args.report) report(path.resolve(args.report === true ? '.' : args.report));
else await batch();
