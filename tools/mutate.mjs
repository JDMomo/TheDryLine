/* Mutation run: breaks the game in 20 small ways (the 20 deliberate breakages of the outside technical audit, tools in /home/claude/audit/tech/mut/mutate.py,
   re-made here as source patches), one at a time, in a temporary copy of the game, and runs the fast checks against each copy. A mutation is CAUGHT when at
   least one check fails. This is not part of the normal suite (about 10 to 20 minutes).
   node tools/mutate.mjs                 all 20
   node tools/mutate.mjs M03 M17         only these
   node tools/mutate.mjs --list          list them
   --jobs=N  browsers per run (default 4)    --full  run every check on a mutant, not stopping at the first failure   --keep  keep the temporary copies
   Each mutation is a { file, find, replace } patch; the find text must occur in the file (the run reports a patch that no longer applies). A control run on the
   unmodified copy comes first and must pass. Exit code 1 when fewer than 18 of 20 are caught or the control fails. */
import { spawnSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const MUTATIONS = {
  M01: ['enemy touch does not hurt', 'js/game/enemies.js', 'if (def.touch && !this.harmless) G.combat.hurtPlayers(this.rect(), this.x);', ''],
  M02: ['mend heals nothing', 'js/game/player.js', 'p.healT = 0.001; p.hp++;', 'p.healT = 0.001;'],
  M03: ['spikes do no damage', 'js/game/player.js', '{ p.hurt(p.x); if (!p.down) { p.x = p.safeX;', '{ if (!p.down) { p.x = p.safeX;'],
  M04: ['scrip on the floor is never collected', 'js/game/combat.js', 'G.run.shards += k.value;', ''],
  M05: ['a punch is worth half as much', 'js/core/util.js', 'BREAK_FRAC: 0.1,', 'BREAK_FRAC: 0.05,'],
  M06: ['no revive on entering a room', 'js/game/rooms.js', 'if (p.down && G.players.some(q => !q.down)) p.revive(1);', ''],
  M07: ['the hit stop never ends (the loop freezes on the first hit)', 'js/main.js', 'G.fx.hitstop -= dt;', 'G.fx.hitstop -= 0;'],
  M08: ['extra controllers can no longer join', 'js/core/input.js', 'takeJoin(used) { for (const d of edges.jump) if (!used.includes(d)) return d; return null; },', 'takeJoin(used) { return null; },'],
  M09: ['slash and dash buttons swapped on gamepads', 'js/core/input.js', 'jump: [0], attack: [2], dash: [1, 7],', 'jump: [0], attack: [1], dash: [2, 7],'],
  M10: ['world generation uses Math.random', 'js/game/worldgen.js', 'const rng = U.makeRng(seed), nodes', 'const rng = U.makeRng(seed ^ (Math.random() * 1e6 | 0)), nodes'],
  M11: ['no invincibility after a hit', 'js/core/util.js', 'MEND_COST: 33, INV: 1.0,', 'MEND_COST: 33, INV: 0.0,'],
  M12: ['keys stay down when the window loses focus', 'js/core/input.js', "addEventListener('blur', releaseAll);", ''],
  M13: ['coyote time is zero', 'js/core/util.js', 'COYOTE: 0.09,', 'COYOTE: 0.0,'],
  M14: ['dash cooldown is zero', 'js/core/util.js', 'DASH_CD: 0.35,', 'DASH_CD: 0.0,'],
  M15: ['co-op leash removed (a partner off screen stays there)', 'js/game/rooms.js', '{ p.place(lead.x, lead.y, lead.face); p.inv = 0.6; }', '{ }'],
  M16: ['the meta save is never written', 'js/game/run.js', 'try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.meta)); } catch (e) { /* storage unavailable */ }', ''],
  M17: ['a Warden\'s body stops hurting', 'js/game/bosses.js', "if (this.state !== 'stagger' && this.def.contact !== false)\n      G.combat.hurtPlayers(", "if (false)\n      G.combat.hurtPlayers("],
  M18: ['the ticket machine is free', 'js/game/props.js', 'const TICKET_PRICES = [30, 45];', 'const TICKET_PRICES = [0, 0];'],
  M19: ['the unique-token rule is removed', 'js/game/items.js', 'const ids = G.items.pool().filter(id => !exclude.includes(id));', 'const ids = G.items.pool();'],
  M20: ['the light slash does three times the damage', 'js/game/combat.js', '(s.heavy ? 32 : 13)', '(s.heavy ? 32 : 39)']
};

const args = process.argv.slice(2);
if (args.includes('--list')) { for (const [k, v] of Object.entries(MUTATIONS)) console.log(k + '  ' + v[0] + '  (' + v[1] + ')'); process.exit(0); }
const picked = args.filter(a => /^M\d\d$/.test(a)), jobs = (args.find(a => a.startsWith('--jobs=')) || '--jobs=4'), full = args.includes('--full'), keep = args.includes('--keep');
const ids = picked.length ? picked : Object.keys(MUTATIONS);

function copyGame() {
  const dir = mkdtempSync(path.join(tmpdir(), 'dryline-mut-'));
  cpSync(root, dir, { recursive: true, filter: src => !/[\\/](shots|\.git|docs|reference|node_modules)([\\/]|$)/.test(path.relative(root, src)) });
  return dir;
}
function runFast(dir) {
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(dir, 'tools', 'smoke.mjs'), '--fast', '--quiet', jobs].concat(full ? [] : ['--bail']), { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || '');
  const failed = out.split('\n').filter(l => l.startsWith('FAIL')).map(l => l.slice(5).split(':')[0].trim());
  return { code: r.status, failed: [...new Set(failed)], secs: Math.round((Date.now() - t0) / 1000), out };
}

console.log('control run (unmodified copy)...');
{
  const dir = copyGame(), c = runFast(dir);
  if (!keep) rmSync(dir, { recursive: true, force: true });
  if (c.code !== 0) { console.log('CONTROL FAILED: the fast checks do not pass on the unmodified game:\n' + c.out.split('\n').filter(l => l.startsWith('FAIL')).join('\n')); process.exit(1); }
  console.log('control passes (' + c.secs + ' s)');
}
let caught = 0; const missed = [], broken = [];
for (const id of ids) {
  const [what, file, find, replace] = MUTATIONS[id];
  const dir = copyGame(), fp = path.join(dir, file), src = readFileSync(fp, 'utf8');
  if (!src.includes(find)) { console.log(id + ' PATCH DOES NOT APPLY  ' + what + ' (' + file + ')'); broken.push(id); if (!keep) rmSync(dir, { recursive: true, force: true }); continue; }
  writeFileSync(fp, src.replace(find, () => replace));
  const r = runFast(dir);
  if (r.code !== 0) { caught++; console.log(id + ' CAUGHT  ' + what + '   by ' + (r.failed.join(', ') || '(crash)') + '  (' + r.secs + ' s)'); }
  else { missed.push(id); console.log(id + ' MISSED  ' + what + '   all fast checks passed  (' + r.secs + ' s)'); }
  if (!keep) rmSync(dir, { recursive: true, force: true });
}
console.log('\nmutation score: ' + caught + ' of ' + ids.length + ' caught' + (missed.length ? '; missed: ' + missed.join(', ') : '') + (broken.length ? '; patches that no longer apply: ' + broken.join(', ') : ''));
process.exit(caught >= Math.min(18, ids.length) && !broken.length ? 0 : 1);
