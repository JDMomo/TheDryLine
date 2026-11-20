// Builds tools/shots/art_items.png (all 20 items at 24, 48 and 128 px on the game's dark background, with names)
// and in-game shots art_hud.png (four tokens held) and art_plinth.png. Run after tools/render_art.mjs.
import { launchBrowser } from './lib/browser.mjs';
import { readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'tools', 'shots');
const ids = d => readdirSync(path.join(root, 'assets', d)).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
const NAMES = { cobalt_awl: 'Cobalt Awl', tin_spindle: 'Tin Spindle', flint_tether: 'Flint Tether', ochre_ladle: 'Ochre Ladle', sulphur_kettle: 'Sulphur Kettle', chalk_skipstone: 'Chalk Skipstone', cinder_bell: 'Cinder Bell', rust_censer: 'Rust Censer', copper_drum: 'Copper Drum', basalt_roller: 'Basalt Roller', quartz_wake: 'Quartz Wake', pumice_crawler: 'Pumice Crawler', brass_buckle: 'Brass Buckle', oiled_strap: 'Oiled Strap', whetstone_chip: 'Whetstone Chip', lead_boot: 'Lead Boot', magnet_tooth: 'Magnet Tooth', punch_glove: 'Punch Glove', brine_flask: 'Brine Flask', surveyors_slate: "Surveyor's Slate" };
const ORDER = ['cobalt_awl', 'tin_spindle', 'flint_tether', 'ochre_ladle', 'sulphur_kettle', 'chalk_skipstone', 'cinder_bell', 'rust_censer', 'copper_drum', 'basalt_roller', 'quartz_wake', 'pumice_crawler'];
const rows = [...ORDER.map(i => ['tokens', i]), ...ids('trinkets').map(i => ['trinkets', i])];
const cell = ([d, i]) => `<div class="c"><div class="n">${NAMES[i] || i}</div><div class="r"><img width="24" height="24" src="../../assets/${d}/${i}.png"><img width="48" height="48" src="../../assets/${d}/${i}.png"><img width="128" height="128" src="../../assets/${d}/${i}@2x.png"></div></div>`;
const html = `<meta charset="utf-8"><style>body{margin:0;background:#0d1a19;font:13px sans-serif;color:#d9c5a0;padding:14px;width:1260px}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.c{background:#152825;border-radius:6px;padding:8px 10px}.n{margin-bottom:4px}.r{display:flex;align-items:center;gap:14px;height:132px}</style><div class="g">${rows.map(cell).join('')}</div>`;
writeFileSync(path.join(shots, 'art_items.html'), html);
const browser = await launchBrowser();
let page = await browser.newPage({ viewport: { width: 1290, height: 900 } });
await page.goto(pathToFileURL(path.join(shots, 'art_items.html')).href); await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shots, 'art_items.png'), fullPage: true });
if (process.argv[2] !== '--sheet') {
  page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.waitForFunction(() => window.G && window.G.debug);
  await page.waitForFunction(() => Object.keys(G.sprites).length >= 20, null, { timeout: 8000 }).catch(() => {});
  const canvas = page.locator('#game');
  await page.evaluate(() => { const D = G.debug; D.newRun(7); D.give('cobalt_awl'); D.give('sulphur_kettle'); D.give('rust_censer'); D.give('quartz_wake'); D.step(60); });
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: path.join(shots, 'art_hud.png') });
  const found = await page.evaluate(() => {
    const D = G.debug; D.newRun(7); D.god(true);
    if (!D.gotoRoom('branch:r1') && !D.gotoRoom('r1_hold')) return 'noroom';
    D.step(30);
    const pl = G.rooms.current.props.find(p => p.type === 'plinth' && p.data.item);
    if (!pl) return 'noplinth';
    D.place(0, pl.x - 120, pl.y, 1); D.step(30); return pl.data.item;
  });
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: path.join(shots, 'art_plinth.png') });
  console.log('plinth:', found);
}
await browser.close();
