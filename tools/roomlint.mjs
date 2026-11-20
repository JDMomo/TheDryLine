/* Room validator for level designers.
   node tools/roomlint.mjs <substring>              lint + traversal test for every room whose id contains the substring ('' or no argument: all rooms)
   node tools/roomlint.mjs r2_ --strict            main rooms: run and jump only (no slash, bounce or dash), both directions, every doorway and trunk reached
   node tools/roomlint.mjs r2_ --lint               lint only (no browser bot)
   node tools/roomlint.mjs r2_ --file my_rooms.js   load an extra script of G.defineRoom calls first (e.g. a draft that is not in index.html yet)
   One line per room; failures print what is wrong and where the bot got stuck. Exit code 1 if any room fails. */
import { launchBrowser } from './lib/browser.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { runRooms, formatRoom, okRoom } from './checks/rooms.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = n => args.includes(n), val = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const file = val('--file');
const filter = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--file') || '';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
page.on('pageerror', e => console.log('page error: ' + e));
await page.goto(pathToFileURL(path.join(here, '..', 'index.html')).href);
await page.waitForFunction(() => window.G && window.G.debug);
await page.evaluate(() => G.debug.newRun(1));       // before the extra file, so draft rooms never enter the generated world
if (file) await page.addScriptTag({ content: fs.readFileSync(path.resolve(file), 'utf8') });
const t0 = Date.now();
const res = await runRooms(page, { filter, walk: !flag('--lint'), strict: flag('--strict'), log: r => console.log(formatRoom(r)) });
await browser.close();
const bad = res.filter(r => !okRoom(r));
if (!res.length) console.log('no room id contains "' + filter + '"');
console.log(res.length + ' rooms, ' + bad.length + ' failing, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
process.exit(bad.length || !res.length ? 1 : 0);
