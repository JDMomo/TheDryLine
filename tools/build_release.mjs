/* Release builder: dist/dry-line-web.zip for an itch.io "HTML" upload (nothing is uploaded or published by this script).
   node tools/build_release.mjs            build, verify, print size and file count
   node tools/build_release.mjs --no-verify
   The zip has index.html at its root and only what the game needs: index.html, css/, the scripts index.html lists, and the runtime files in assets/ (images, audio,
   data; not the .svg sources, the assets/audio/midi hand-off folder or the README files). A version stamp is written into the zip twice: version.txt and a <meta name="build"> tag in
   the copy of index.html that goes into the zip (the source index.html is not touched). Version = date + a hash of every shipped file.
   Verification: the zip is unpacked into a new empty folder, served over http (a plain static server, like itch.io's), loaded in headless Chrome at 1x and 2x pixel
   ratio, started with a click and a key, and left running for a few seconds. It fails on any page error, console error, G.errors entry, or request that is not a 200.
   It also checks itch.io's limits (docs: https://itch.io/docs/creators/html5): at most 1000 files, paths of at most 240 characters, no file over 200 MB, 500 MB in all,
   relative paths only. */
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/npm-tools/node_modules/');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const args = process.argv.slice(2);
const dist = path.join(root, 'dist'), zipPath = path.join(dist, 'dry-line-web.zip');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webp': 'image/webp', '.txt': 'text/plain' };
const RUNTIME_ASSET = /\.(png|jpe?g|webp|gif|ogg|mp3|wav|json|js|css|woff2?)$/i;           // everything else in assets/ (svg sources, midi, md) stays out
const kb = n => (n / 1024).toFixed(1) + ' KB', mb = n => (n / 1048576).toFixed(2) + ' MB';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- 1. what the game needs
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^(data:|https?:)/.test(u));
const bad = refs.filter(u => u.startsWith('/') || /^[a-z]+:/i.test(u));
if (bad.length) throw new Error('index.html uses absolute or foreign URLs, which break on itch.io: ' + bad.join(', '));
const files = new Set(['index.html']);
for (const r of refs) { if (!fs.existsSync(path.join(root, r))) throw new Error('index.html references a missing file: ' + r); files.add(r); }
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk('assets')) if (RUNTIME_ASSET.test(f) && !/(^|[\\/])midi[\\/]/.test(f)) files.add(f.split(path.sep).join('/'));
for (const f of walk('css')) files.add(f.split(path.sep).join('/'));
// scripts that index.html does not list but that sit in js/ are NOT shipped (index.html is the source of truth); warn about them
const listed = new Set(refs);
const strays = walk('js').map(f => f.split(path.sep).join('/')).filter(f => !listed.has(f));
const list = [...files].sort();

// ---- 2. stage, stamp, zip
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dryline-rel-'));
for (const f of list) { fs.mkdirSync(path.dirname(path.join(stage, f)), { recursive: true }); fs.copyFileSync(path.join(root, f), path.join(stage, f)); }
const hash = crypto.createHash('sha256'); for (const f of list) { hash.update(f); hash.update(fs.readFileSync(path.join(root, f))); }
const date = new Date().toISOString().slice(0, 10), version = `${date}-${hash.digest('hex').slice(0, 8)}`;
fs.writeFileSync(path.join(stage, 'version.txt'), `The Dry Line, web build ${version}\nBuilt ${new Date().toISOString()}\nFiles: ${list.length + 1}\n`);
const stamped = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="build" content="${version}">`);
if (stamped === html) throw new Error('could not place the version stamp in index.html');
fs.writeFileSync(path.join(stage, 'index.html'), stamped);
fs.mkdirSync(dist, { recursive: true }); fs.rmSync(zipPath, { force: true });
const all = [...list, 'version.txt'].sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a < b ? -1 : 1));
execFileSync('zip', ['-X', '-q', '-9', zipPath, ...all], { cwd: stage });
fs.rmSync(stage, { recursive: true, force: true });

// ---- 3. itch.io limits
const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
const sizes = Object.fromEntries(execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' }).split('\n').map(l => /^\s*(\d+)\s+\S+\s+\S+\s+(.+)$/.exec(l)).filter(Boolean).map(m => [m[2], +m[1]]));
const total = Object.values(sizes).reduce((a, b) => a + b, 0), biggest = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0];
const problems = [];
if (listing[0] !== 'index.html') problems.push('index.html is not the first entry');
if (listing.length > 1000) problems.push(`${listing.length} files (itch.io allows 1000)`);
for (const f of listing) if (f.length > 240) problems.push('path over 240 characters: ' + f);
if (biggest[1] > 200 * 1048576) problems.push('a file is over 200 MB: ' + biggest[0]);
if (total > 500 * 1048576) problems.push('over 500 MB extracted');
const dupCase = new Map(); for (const f of listing) { const k = f.toLowerCase(); if (dupCase.has(k)) problems.push(`names differ only by case: ${f} / ${dupCase.get(k)}`); dupCase.set(k, f); }

// ---- 4. verify: clean folder, plain http server, headless Chrome at 1x and 2x
async function verify() {
  const { chromium } = require('playwright');
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'dryline-clean-'));
  execFileSync('unzip', ['-q', zipPath, '-d', clean]);
  const srv = await new Promise(res => { const s = http.createServer((req, rsp) => {
    const f = path.join(clean, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(clean) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
    rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
  }).listen(0, '127.0.0.1', () => res(s)); });
  const url = 'http://127.0.0.1:' + srv.address().port + '/', browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--mute-audio'] });
  const requested = new Set(), report = [];
  try {
    for (const dpr of [1, 2]) {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: dpr }), pg = await ctx.newPage(), errs = [], failed = [];
      pg.on('pageerror', e => errs.push(String(e).slice(0, 200))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
      pg.on('response', r => { const u = new URL(r.url()); if (u.origin === new URL(url).origin) requested.add(decodeURIComponent(u.pathname.slice(1)) || 'index.html'); if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
      await pg.goto(url); await pg.waitForFunction(() => window.G && G.debug && G.strips && !G.spritesPending, null, { timeout: 30000 });
      const build = await pg.evaluate(() => (document.querySelector('meta[name=build]') || {}).content);
      await pg.click('#start'); await sleep(300); await pg.keyboard.press('KeyX'); await sleep(400);
      await pg.keyboard.down('ArrowRight'); await sleep(1500); await pg.keyboard.up('ArrowRight'); await pg.keyboard.press('Space');
      for (let i = 0; i < 20 && (await pg.evaluate(() => G.time)) < 2; i++) await sleep(300);           // a slow or busy machine renders fewer frames: wait for 2 s of game time
      const st = await pg.evaluate(() => ({ state: G.state, time: G.time, errors: G.errors.slice(), sprites: Object.keys(G.sprites || {}).length, strips: Object.keys(G.strips || {}).length }));
      if (st.state !== 'play' || st.time < 2) errs.push(`state ${st.state}, time ${st.time}`);
      errs.push(...st.errors.map(e => 'G.errors: ' + e));
      if (!build) errs.push('version stamp missing from the page');
      report.push({ dpr, ...st, build, errs, failed }); await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  fs.rmSync(clean, { recursive: true, force: true });
  return { report, requested };
}

console.log(`built ${path.relative(root, zipPath)}\n  version     ${version}\n  files       ${listing.length}\n  size        ${mb(fs.statSync(zipPath).size)} zipped (${kb(fs.statSync(zipPath).size)}), ${mb(total)} unpacked\n  largest     ${biggest[0]} (${kb(biggest[1])})`);
if (strays.length) console.log(`  note        ${strays.length} file(s) in js/ are not listed in index.html and are not shipped: ${strays.join(', ')}`);
for (const p of problems) console.log('  PROBLEM     ' + p);
let ok = !problems.length;
if (!args.includes('--no-verify')) {
  const { report, requested } = await verify();
  for (const r of report) {
    const bad = r.errs.length || r.failed.length; ok = ok && !bad;
    console.log(`  verify ${r.dpr}x   ${bad ? 'FAIL' : 'ok'}: state ${r.state}, ${r.time.toFixed(1)} s of game time, ${r.sprites} sprites, ${r.strips} strips, build ${r.build}${bad ? '\n    ' + [...r.errs, ...r.failed].join('\n    ') : ''}`);
  }
  const unused = listing.filter(f => f !== 'version.txt' && !requested.has(f));
  console.log(`  requested   ${requested.size} of ${listing.length} files during the check (${unused.length} shipped files were not requested at the title screen or in the Junction${unused.length ? '; first few: ' + unused.slice(0, 6).join(', ') : ''})`);
}
console.log(ok ? 'RELEASE OK (nothing was uploaded)' : 'RELEASE CHECK FAILED');
process.exit(ok ? 0 : 1);
