// Lists the painted world images found in assets/world/ into assets/world/manifest.js, so the game loads exactly those (a missing file is never
// requested, which keeps the browser console clean). Names must be sheet names from js/art/world_hooks.js plus .png.
// Usage: node tools/art/world_manifest.mjs        (prints what it found, what it did not recognise, and what is still missing)
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sandbox = { window: {} }; sandbox.window.G = {}; sandbox.G = sandbox.window.G;
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/art/world_hooks.js'), 'utf8'), sandbox);
const hooks = sandbox.window.G.worldHooks.hooks, dir = path.join(root, 'assets/world');
const have = fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).sort();
const known = have.filter(n => hooks[n]), unknown = have.filter(n => !hooks[n]);
fs.writeFileSync(path.join(dir, 'manifest.js'), '/* Written by `node tools/art/world_manifest.mjs`: the sheet names (see js/art/world_hooks.js) that have a PNG in this folder. */\nwindow.G = window.G || {}; G.worldFiles = ' + JSON.stringify(known) + ';\n');
console.log('wrote assets/world/manifest.js with ' + known.length + ' of ' + Object.keys(hooks).length + ' sheets');
if (unknown.length) console.log('not in the table (ignored): ' + unknown.join(', '));
const missing = Object.keys(hooks).filter(n => hooks[n].wired !== false && !known.includes(n));
console.log(missing.length + ' wired sheets still code-drawn' + (missing.length > 12 ? '' : ': ' + missing.join(', ')));
