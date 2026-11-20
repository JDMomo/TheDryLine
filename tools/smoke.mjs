/* Headless smoke test. `node tools/smoke.mjs` runs every check in tools/checks; `node tools/smoke.mjs <name>` runs one.
   Each check gets a fresh page of index.html and must drive the game only through G.debug (plus reading the public
   registries such as G.itemDefs). Any page error, console error or G.errors entry fails the check. Exits 1 on failure.
   Options: --serial (one browser, one check at a time), --jobs=N (browsers at once, default 4), --fast (skip checks that export
   `slow = true`: bosses_fair, perf), --bail (stop starting new checks after the first failure; used by tools/mutate.mjs).
   A check may export `shards` (an array of names): it then runs once per shard, in parallel, and receives `shard` in its arguments. */
import { launchBrowser } from './lib/browser.mjs';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(path.join(here, '..', 'index.html')).href;
const args = process.argv.slice(2), flag = n => args.includes('--' + n);
const [only, onlyShard] = (args.find(a => !a.startsWith('--')) || '').split(':');          // `name` or `name:shard`
const jobsArg = args.find(a => a.startsWith('--jobs='));
const jobs = flag('serial') ? 1 : Math.max(1, +(jobsArg ? jobsArg.slice(7) : 4) || 4);
const quiet = flag('quiet');

let names = readdirSync(path.join(here, 'checks')).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4)).sort().filter(n => !only || n === only);
if (!names.length) { console.error('no check named ' + only); process.exit(1); }

// Task list: one per check, or one per shard. Slow checks first so they start early and the pool stays full.
const tasks = [];
for (const name of names) {
  const mod = await import(pathToFileURL(path.join(here, 'checks', name + '.mjs')).href);
  if (flag('fast') && mod.slow) continue;
  if (mod.shards) { for (const s of mod.shards) if (!onlyShard || onlyShard === s) tasks.push({ name, shard: s, label: name + ':' + s, weight: mod.weight || 60 }); }
  else tasks.push({ name, shard: undefined, label: name, weight: mod.weight || (mod.slow ? 60 : 1) });
}
const bail = flag('bail');
if (jobs > 1) tasks.sort((a, b) => b.weight - a.weight);

const launch = () => launchBrowser();

let failed = 0, done = 0, stop = false;
const failures = [];
async function runTask(browser, t) {
  const page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  try {
    await page.goto(pageUrl);
    await page.waitForFunction(() => window.G && window.G.debug);
    const check = (await import(pathToFileURL(path.join(here, 'checks', t.name + '.mjs')).href)).default;
    const note = (await check({ page, shots: path.join(here, 'shots'), shard: t.shard })) || '';
    errors.push(...await page.evaluate(() => window.G.errors));
    if (errors.length) throw new Error('errors on the page: ' + errors.join(' | '));
    if (!quiet) console.log('PASS ' + t.label + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)' + (note ? '  ' + note : ''));
  } catch (e) {
    failed++; stop = stop || bail;
    const msg = e && e.message ? e.message : String(e);
    failures.push(t.label);
    console.log('FAIL ' + t.label + ': ' + msg);
  }
  done++;
  await page.close().catch(() => {});
}

const T0 = Date.now();
let next = 0;
await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, async () => {
  const browser = await launch();
  while (!stop && next < tasks.length) await runTask(browser, tasks[next++]);
  await browser.close();
}));
const secs = ((Date.now() - T0) / 1000).toFixed(0);
console.log(failed ? failed + ' of ' + tasks.length + ' checks failed (' + failures.join(', ') + ') in ' + secs + ' s' : 'all ' + tasks.length + ' checks passed in ' + secs + ' s (' + Math.min(jobs, tasks.length) + ' browser' + (Math.min(jobs, tasks.length) > 1 ? 's' : '') + ')');
process.exit(failed ? 1 : 0);
