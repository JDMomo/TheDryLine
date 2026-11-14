// Rasterises every assets/tokens/*.svg and assets/trinkets/*.svg to transparent PNGs: <id>.png (64 px) and <id>@2x.png (128 px).
// Re-run: node tools/render_art.mjs   (headless Chrome via playwright; no network)
import { createRequire } from 'module';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
let n = 0;
for (const dir of ['tokens', 'trinkets']) {
  const folder = path.join(root, 'assets', dir);
  for (const file of readdirSync(folder).filter(f => f.endsWith('.svg')).sort()) {
    const svg = readFileSync(path.join(folder, file), 'utf8').replace(/<svg([^>]*?)\swidth="\d+"\s+height="\d+"/, '<svg$1');
    for (const [size, suffix] of [[64, ''], [128, '@2x']]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
      writeFileSync(path.join(folder, file.replace(/\.svg$/, suffix + '.png')), png); n++;
    }
  }
}
await browser.close();
console.log('rendered ' + n + ' PNGs');
