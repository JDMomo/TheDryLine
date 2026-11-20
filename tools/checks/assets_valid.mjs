// Every image under assets/ decodes in the browser (a truncated upload once shipped four broken files that silently fell back to code art).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(png|jpe?g|webp)$/i.test(e.name) ? [path.join(d, e.name)] : []);
export default async ({ page }) => {
  const files = walk(path.join(root, 'assets')).map(f => path.relative(root, f).split(path.sep).join('/'));
  const bad = await page.evaluate(async files => {
    const out = [];
    await Promise.all(files.map(f => new Promise(ok => { const im = new Image(); im.onload = () => { if (!im.naturalWidth) out.push(f + ' (0 px)'); ok(); }; im.onerror = () => { out.push(f); ok(); }; im.src = f; })));
    return out;
  }, files);
  if (bad.length) throw new Error(bad.length + ' image(s) do not decode: ' + bad.join(', '));
  return files.length + ' images decode';
};
