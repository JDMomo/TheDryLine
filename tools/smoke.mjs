/* Headless smoke test. `node tools/smoke.mjs` runs every check in tools/checks; `node tools/smoke.mjs <name>` runs one.
   Each check gets a fresh page of index.html and must drive the game only through G.debug (plus reading the public
   registries such as G.itemDefs). Any page error, console error or G.errors entry fails the check. Exits 1 on failure. */
import { createRequire } from 'module';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(path.join(here, '..', 'index.html')).href;
const only = process.argv[2];
const names = readdirSync(path.join(here, 'checks')).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4)).sort().filter(n => !only || n === only);
if (!names.length) { console.error('no check named ' + only); process.exit(1); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--no-first-run', '--disable-background-networking', '--disable-sync', '--disable-component-update'] });
let failed = 0;
for (const name of names) {
  const page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  let note = '';
  try {
    await page.goto(pageUrl);
    await page.waitForFunction(() => window.G && window.G.debug);
    const check = (await import(pathToFileURL(path.join(here, 'checks', name + '.mjs')).href)).default;
    note = (await check({ page, shots: path.join(here, 'shots') })) || '';
    const gErrors = await page.evaluate(() => window.G.errors);
    errors.push(...gErrors);
    if (errors.length) throw new Error('errors on the page: ' + errors.join(' | '));
    console.log('PASS ' + name + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)' + (note ? '  ' + note : ''));
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ': ' + (e && e.message ? e.message : e));
  }
  await page.close();
}
await browser.close();
console.log(failed ? failed + ' of ' + names.length + ' checks failed' : 'all ' + names.length + ' checks passed');
process.exit(failed ? 1 : 0);
