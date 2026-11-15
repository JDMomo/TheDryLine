// Fight lengths with the clean-play bot (tools/lib/fightbot.js, the bot of bosses_fair): every Warden, once with slashes alone and once with
// all three charted fare slots punched (punches are applied directly to the boss at 3, 8 and 13 s: the same effect as a landed third hit
// without the time a player needs to line it up, so this is the shortest the punched fight can be). Rules: slashes alone win in 150 s or less;
// the punched fight lasts at least 30 s and is clearly shorter (under 85% of the slash-only time). BOSS=r2 runs one boss (final4: the last
// Warden with the other four beaten).
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const REGIONS = ['r1', 'r2', 'r3', 'r4', 'final', 'final2', 'final4'];   // finalN: the Long Clock with N Wardens beaten (it borrows one attack per Warden alive; its health does not change)

export default async ({ page }) => {
  await page.addScriptTag({ path: path.join(here, '..', 'lib', 'fightbot.js') });
  const only = process.env.BOSS, report = [], problems = [], slashT = {};
  for (const name of REGIONS) {
    if (only && only !== name) continue;
    const nBeaten = /^final\d$/.test(name) ? +name.slice(5) : 0, region = nBeaten ? 'final' : name;
    const res = await page.evaluate(async ({ region, nBeaten }) => {
      const D = G.debug, C = G.C, out = {};
      for (const punched of [false, true]) {
        D.newRun(77); D.god(false);
        for (const r of ['r1', 'r2', 'r3', 'r4'].slice(4 - nBeaten)) G.run.beaten[r] = true;   // 2: r3 and r4 beaten, r1 and r2 still borrowed
        if (!D.startBoss(region)) throw new Error('no arena for ' + region);
        const b = G.rooms.current.boss; D.step(130);
        const charted = b.spots.map(s => s.cls);
        D.place(0, Math.max(b.minX, b.x - 150), b.floor, 1);
        const t0 = G.time, at = [3, 8, 13]; let n = 0;
        const OPEN = new Set(['recover', 'peckStuck', 'peckOut', 'lying', 'rise', 'stagger']);
        const r = FB.run({ mode: 'fight', maxT: 260, seed: 5, open: OPEN, delay: 0.35, until: bb => {
          if (punched && n < 3 && G.time - t0 >= at[n]) {
            const sp = bb.spots.find(s => !s.broken);
            if (sp) { sp.broken = true; bb.hp -= bb.maxHp * C.BREAK_FRAC; bb.set('stagger', C.STAGGER); if (sp.def.onBreak) sp.def.onBreak(bb); }
            n++;
          }
          return false;
        } });
        out[punched ? 'punched' : 'slash'] = { dead: r.dead, t: r.t, hits: r.hits, hpPct: b.hp / b.maxHp, maxHp: b.maxHp, charted };
      }
      return out;
    }, { region, nBeaten });
    const s = res.slash, p = res.punched; slashT[name] = s.dead ? s.t : Infinity;
    report.push(name + ' ' + (s.dead ? s.t.toFixed(0) : 'NOT WON') + ' s slash only, ' + (p.dead ? p.t.toFixed(0) : 'NOT WON') + ' s with three punches (hp ' + s.maxHp.toFixed(0) + ')');
    if (s.charted.length !== 3) problems.push(name + ': ' + s.charted.length + ' fare slots');
    if (!s.dead) problems.push(name + ': slashes alone did not win in ' + s.t.toFixed(0) + ' s (boss at ' + (s.hpPct * 100).toFixed(0) + '%)');
    else if (s.t > 150) problems.push(name + ': slash-only fight took ' + s.t.toFixed(0) + ' s (limit 150)');
    if (!p.dead) problems.push(name + ': the three-punch fight was not won in ' + p.t.toFixed(0) + ' s');
    else {
      if (p.t < 30) problems.push(name + ': three punches end the fight in ' + p.t.toFixed(0) + ' s (at least 30)');
      if (s.dead && p.t > s.t * 0.85) problems.push(name + ': three punches only save ' + (100 - 100 * p.t / s.t).toFixed(0) + '% (' + p.t.toFixed(0) + ' of ' + s.t.toFixed(0) + ' s)');
    }
  }
  // the Long Clock: with every Warden beaten (nothing borrowed) a slash-only fight takes 90 to 120 s; straight to the clock is clearly the longest
  if (slashT.final4 !== undefined && (slashT.final4 < 90 || slashT.final4 > 120)) problems.push('Long Clock with four Wardens beaten: ' + slashT.final4.toFixed(0) + ' s slash only (wanted 90 to 120)');
  if (slashT.final !== undefined && slashT.final4 !== undefined && slashT.final < slashT.final4 + 8) problems.push('going straight to the Long Clock (' + slashT.final.toFixed(0) + ' s) must be clearly longer than with four Wardens beaten (' + slashT.final4.toFixed(0) + ' s)');
  if (slashT.final2 !== undefined && slashT.final !== undefined && slashT.final4 !== undefined && !(slashT.final4 <= slashT.final2 && slashT.final2 <= slashT.final)) problems.push('Long Clock length should grow with the borrowed attacks: ' + [slashT.final4, slashT.final2, slashT.final].map(x => x.toFixed(0)).join(' <= '));
  if (problems.length) throw new Error(problems.join(' | ') + '   [' + report.join('; ') + ']');
  return report.join('; ');
};
