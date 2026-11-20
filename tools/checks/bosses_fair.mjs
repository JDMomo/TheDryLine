// Fair bosses, all five. For every attack of every boss, taken alone:
//   - avoidability: a bot that only moves and jumps (base moves, no dash, no wall grip; it reacts 0.2 s late; tools/lib/fightbot.js) must
//     come through unhurt in most trials (several start positions, normal and enraged);
//   - warning: a player who stands still is not hurt sooner than 0.45 s after the attack starts (0.35 s when enraged);
//   - the tell states the boss really picks last at least that long (measured in the fights below).
// And for every boss: a slashes-only fight by the same bot (no tokens, nothing punched) is won in the time window, and every attack
// cycle leaves at least 1 s in which the boss is not attacking (idle or recovering), measured in that fight.
// `node tools/smoke.mjs bosses_fair`; set BOSS=r2 to run one boss, TRIALS=n for more trials.
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));

const BOSSES = {
  r1: { name: 'Tollkeeper', attacks: { charge: 'chargeTell', leap: 'leapTell', spit: 'spitTell' } },
  r2: { name: 'Lamp-Heron', attacks: { peck: 'peckTell', sweep: 'sweepTell', gust: 'gustTell', fall: 'fallTell' } },
  r3: { name: 'Switchman Idol', attacks: { rings: 'ringTell', geyser: 'geyserTell', lever: 'leverTell', topple: 'toppleTell' } },
  r4: { name: 'Gatewhale', attacks: { roll: 'rollTell', spin: 'spinTell', spawn: 'spawnTell', crates: 'crateTell' } },
  final: { name: 'Long Clock', attacks: { rings: 'ringTell', hands: 'handsTell', rain: 'rainTell', wind: 'windTell', toll: 'tollTell', beam: 'beamTell', sig: 'sigTell', crates: 'crateTell' } }   // toll, beam, sig, crates: borrowed from the Wardens still alive (a run with none beaten borrows all four)
};
// States in which the boss is not attacking and can be slashed in peace (its own hazards are over).
const OPEN = new Set(['idle', 'recover', 'peckStuck', 'peckOut', 'lying', 'rise', 'hop', 'stagger']);
// States in which the clean-play bot actually slashes (a player waits for a real opening, not for the boss to wander about).
const STRICT = new Set(['recover', 'peckStuck', 'peckOut', 'lying', 'rise', 'stagger']);

// Shards (they run side by side): each Warden's dodge trials and its slashes-only fight apart; the Long Clock's eight attacks in two halves. `BOSS=r2` still runs one whole boss.
export const slow = true, weight = 100;
export const shards = ['r1:dodge', 'r1:fight', 'r2:dodge', 'r2:fight', 'r3:dodge', 'r3:fight', 'r4:dodge', 'r4:fight', 'final:dodge1', 'final:dodge2', 'final:fight'];
export default async ({ page, shard }) => {
  await page.addScriptTag({ path: path.join(here, '..', 'lib', 'fightbot.js') });
  const [only, part] = (shard || process.env.BOSS || '').split(':'), onlyAttack = process.env.ATTACK, noFight = !!process.env.NOFIGHT, trials = +(process.env.TRIALS || 9);
  const report = [], problems = [];
  for (const region of Object.keys(BOSSES)) {
    if (only && only !== region) continue;
    const spec = BOSSES[region];
    const keys = Object.keys(spec.attacks);
    const list = part === 'fight' ? [] : part === 'dodge1' ? keys.filter((k, i) => i % 2 === 0) : part === 'dodge2' ? keys.filter((k, i) => i % 2 === 1) : null;   // which attacks this shard runs
    const pendulum = region === 'final' && (!part || part === 'dodge2');
    const res = await page.evaluate(async ({ region, attacks, trials, open, strict, onlyAttack, noFight, list, pendulum }) => {
      const OPEN = new Set(open);
      const D = G.debug, out = { attacks: {}, fight: null };
      const setup = (seed, rage) => {
        D.newRun(seed); D.god(false);
        if (!D.startBoss(region)) throw new Error('no arena for ' + region);
        const b = G.rooms.current.boss; D.step(130);
        if (rage) { b.hp = b.maxHp * 0.4; if (region === 'final') b.flags.p2 = true; }
        return b;
      };
      const launch = (b, a) => { G.run.rng.pick = arr => arr.includes(a) ? a : arr[0]; b.last = ''; b.next = a; b.bag = [a]; b.set('idle', 0); };
      const floor = () => G.rooms.current.def.floorX;
      const spot = (b, off) => { const [x0, x1] = floor(); return Math.max(x0 + 90, Math.min(x1 - 90, b.x + off)); };
      // Start positions: the boss somewhere in the arena, the player 120 to 340 px from it on a side with at least 300 px of floor behind
      // the player. (A player boxed into the pocket between the boss and a wall cannot be helped by any attack tuning: that pocket is
      // reported separately as a weakness.)
      const BOSS_AT = [0.5, 0.3, 0.7, 0.4, 0.6, 0.35, 0.65, 0.45, 0.55], DIST = [210, 330, 125, 260, 170, 340, 150, 300, 230];
      const place = (b, i, a) => {
        const [x0, x1] = floor(); b.x = Math.max(b.minX, Math.min(b.maxX, x0 + (x1 - x0) * BOSS_AT[i % 9]));
        let d = DIST[i % 9]; if (region === 'r2' && a === 'peck') d = Math.min(d, 200);
        const side = (b.x - x0 > x1 - b.x) ? -1 : 1;                              // the roomier side of the boss
        D.place(0, Math.max(x0 + 40, Math.min(x1 - 40, b.x + side * d)), b.floor, -side); return side * d;
      };
      for (const a in attacks) {
        if (onlyAttack && onlyAttack !== a) continue;
        if (list && !list.includes(a)) continue;
        const tell = attacks[a], rec = { dodged: 0, n: 0, hits: [], still: Infinity, stillRage: Infinity };
        for (let i = 0; i < trials; i++) {
          const rage = i >= trials - 3;
          // avoidability
          const b = setup(11 + i, rage);
          const off = place(b, i, a);
          launch(b, a);
          let seen = false;
          const r = FB.run({ mode: 'dodge', maxT: 16, seed: 3 + i, until: (bb, o) => { if (bb.state === tell) seen = true; return seen && bb.state === 'idle'; } });
          rec.n++; if (r.hits === 0) rec.dodged++; else rec.hits.push((rage ? 'rage ' : '') + 'off ' + off + ' at ' + r.hitAt[0] + ' s');
          // warning: stand still, time until the first hit
          const b2 = setup(31 + i, rage);
          place(b2, i, a); G.players[0].hp = 60;
          launch(b2, a);
          let t = 0, hit = Infinity, seen2 = false; const p = G.players[0], hp0 = p.hp;
          FB.quiet(true);
          for (; t < 14 * 120; t++) { D.step(1); if (p.hp < hp0) { hit = (t + 1) / 120; break; } if (b2.state === tell) seen2 = true; if (seen2 && b2.state === 'idle') break; }
          FB.quiet(false);
          if (rage) { if (region !== 'final') rec.stillRage = Math.min(rec.stillRage, hit); }      // (phase two: the pendulum hurts a stander at any moment)
          else rec.still = Math.min(rec.still, hit);
        }
        out.attacks[a] = rec;
      }
      // the Long Clock's pendulum (phase two) taken alone
      if (pendulum && (!onlyAttack || onlyAttack === 'pendulum')) {
        let ok = 0, n = 0; const hits = [];
        for (let i = 0; i < 4; i++) {
          const b = setup(51 + i, true); b.set('recover', 99); b.pt = 0;
          place(b, i + 2, 'pendulum');
          const r = FB.run({ mode: 'dodge', maxT: 20, seed: 9 + i }); n++; if (r.hits === 0) ok++; else hits.push(r.hitAt[0]);
        }
        out.attacks.pendulum = { dodged: ok, n, hits, still: Infinity, stillRage: Infinity };
      }
      if (noFight || onlyAttack) return out;
      // a slashes-only fight: nothing carried, nothing punched, same bot (plus Slash), clean play
      const b = setup(77, false); const p = G.players[0];
      const tells = {}, cycles = []; let cur = null, prev = '', t0 = G.time, hpLost = 0;
      const set0 = b.set.bind(b);
      b.set = (s, t = 0) => { if (!FB.sim && /Tell$/.test(s)) { const k = (b.rage || b.flags.p2 ? 'rage ' : '') + s; tells[k] = Math.min(tells[k] === undefined ? 9 : tells[k], t); } return set0(s, t); };
      D.place(0, spot(b, -150), b.floor, 1);
      let lastState = '', since = G.time;
      // an attack cycle runs from one tell to the next: its attack, the recovery, the idle shuffle and any hops in between
      const r = FB.run({ mode: 'fight', maxT: 260, seed: 5, open: new Set(strict), delay: 0.35, until: (bb, o) => {
        if (bb.state !== lastState) {
          const d = G.time - since;
          if (lastState && cur) { cur.t += d; if (OPEN.has(lastState)) cur.open += d; }
          if (/Tell$/.test(bb.state)) { if (cur && !cur.skip && cur.t > 1) cycles.push(cur); cur = { open: 0, t: 0, skip: false }; }
          if (cur && (bb.state === 'stagger' || bb.state === 'transition' || bb.state === 'dead')) cur.skip = true;
          lastState = bb.state; since = G.time;
        }
        return false;
      } });
      b.set = set0;
      const opens = cycles.map(c => c.open).sort((x, y) => x - y);
      out.fight = { dead: r.dead, t: r.t, hits: r.hits, hitAt: r.hitAt.slice(0, 6), cycles: cycles.length, openMin: opens[0], openP10: opens[Math.floor(opens.length * 0.1)], openMed: opens[Math.floor(opens.length / 2)], tells, hpPct: b.hp / b.maxHp };
      // the same fight with all three charted fare slots punched at 3, 8 and 13 s (applied directly: the shortest a punched fight can be; this was the old `fight_len` check)
      const b2 = setup(77, false); D.place(0, Math.max(b2.minX, b2.x - 150), b2.floor, 1);
      const t1 = G.time, at = [3, 8, 13]; let np = 0;
      const r2 = FB.run({ mode: 'fight', maxT: 260, seed: 5, open: new Set(strict), delay: 0.35, until: bb => {
        if (np < 3 && G.time - t1 >= at[np]) {
          const sp = bb.spots.find(x => !x.broken);
          if (sp) { sp.broken = true; bb.hp -= bb.maxHp * G.C.BREAK_FRAC; bb.set('stagger', G.C.STAGGER); if (sp.def.onBreak) sp.def.onBreak(bb); }
          np++;
        }
        return false;
      } });
      out.fight.punched = { dead: r2.dead, t: r2.t, slots: b2.spots.length, maxHp: b2.maxHp };
      return out;
    }, { region, attacks: spec.attacks, trials, open: [...OPEN], strict: [...STRICT], onlyAttack, noFight: noFight || part === 'dodge' || part === 'dodge1' || part === 'dodge2', list, pendulum });
    // verdicts
    const line = [];
    for (const a in res.attacks) {
      const r = res.attacks[a];
      line.push(a + ' ' + r.dodged + '/' + r.n + (r.still < 90 || r.stillRage < 90 ? ' warn ' + (r.still < 90 ? r.still.toFixed(2) : '-') + '/' + (r.stillRage < 90 ? r.stillRage.toFixed(2) : '-') : ''));
      if (process.env.VERBOSE || r.dodged < Math.ceil(r.n * 0.75)) problems.push(spec.name + ' ' + a + ': only ' + r.dodged + ' of ' + r.n + ' trials dodged by a move-and-jump bot (hits: ' + r.hits.join('; ') + ')');
      if (r.still < 0.45) problems.push(spec.name + ' ' + a + ': a player standing still is hurt after only ' + r.still.toFixed(2) + ' s (warning must be 0.45 s or more)');
      if (r.stillRage < 0.35) problems.push(spec.name + ' ' + a + ': enraged, a player standing still is hurt after only ' + r.stillRage.toFixed(2) + ' s (0.35 s or more)');
    }
    if (!res.fight) { report.push(region + ' [' + line.join(', ') + ']'); continue; }
    const f = res.fight;
    for (const k in f.tells) { const lim = /^rage/.test(k) ? 0.35 : 0.45; if (f.tells[k] < lim - 1e-9) problems.push(spec.name + ' ' + k + ' lasts only ' + f.tells[k].toFixed(2) + ' s (needs ' + lim + ')'); }
    if (!f.dead) problems.push(spec.name + ': the slashes-only bot did not win in ' + f.t.toFixed(0) + ' s (boss at ' + (f.hpPct * 100).toFixed(0) + '%)');
    else if (f.t > (region === 'final' ? 150 : 120)) problems.push(spec.name + ': slashes-only fight took ' + f.t.toFixed(0) + ' s (aim: Wardens 90 to 120, Long Clock up to 150)');
    if (f.openMin < 1.0) problems.push(spec.name + ': an attack cycle leaves only ' + f.openMin.toFixed(2) + ' s of safe slashing time (median ' + f.openMed.toFixed(2) + ', ' + f.cycles + ' cycles)');
    // fight length rules (they were the check `fight_len`): slashes alone win in 150 s or less; three punched slots take at least 30 s and clearly shorten the fight
    const pf = f.punched;
    if (pf.slots !== 3) problems.push(spec.name + ': ' + pf.slots + ' fare slots (the lock chart gives three)');
    if (!pf.dead) problems.push(spec.name + ': the three-punch fight was not won in ' + pf.t.toFixed(0) + ' s');
    else {
      if (pf.t < 30) problems.push(spec.name + ': three punches end the fight in ' + pf.t.toFixed(0) + ' s (at least 30)');
      if (f.dead && pf.t > f.t * 0.85) problems.push(spec.name + ': three punches only save ' + (100 - 100 * pf.t / f.t).toFixed(0) + '% (' + pf.t.toFixed(0) + ' of ' + f.t.toFixed(0) + ' s)');
    }
    if (region === 'final' && f.dead && f.t < 106) problems.push('going straight to the Long Clock takes ' + f.t.toFixed(0) + ' s slash only (it borrows four attacks: wanted 106 or more)');
    report.push(region + ' [' + line.join(', ') + '] fight ' + (f.dead ? f.t.toFixed(0) + ' s' : 'NOT WON') + ' hits ' + f.hits + ' open min/med ' + f.openMin.toFixed(2) + '/' + f.openMed.toFixed(2));
  }
  if (problems.length) throw new Error(problems.length + ' problems:\n  ' + problems.join('\n  ') + '\n' + report.join('\n'));
  return report.join(' | ');
};
