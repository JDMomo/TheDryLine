// Run length. A competent player's full clear should take about 25 to 35 minutes. What the bots and the graph can count is counted, the rest is a small model with
// its constants written down here (change them when real play-tests say otherwise).
//   counted, on 8 seeds with no Timetable card: main rooms crossed per line (and their width and height in cells), enemies fought on the main chains, side rooms.
//   modelled per line:  crossing a room = its width at the run speed (285 px/s) x 2.5 for jumps, hazards and looking around, plus 1 s per extra cell of height;
//                       each enemy fought = 7 s (the plain bot of r1_bot needs about 7 s per enemy to reach and kill it);
//                       two side rooms visited (the trial, which a line needs, and the guarded plinth room): crossing time + 20 s each;
//                       the Warden: 0.65 x the slash-only bot's time (a competent player punches slots) + 6 s of intro; 40 s at the Junction (gate, trinket, plan).
//   The slash-only times come from bosses_fair / fight_len (the bot): pass them in FIGHT_SECS as JSON, or edit FIGHT below.
// Fails when the modelled run is outside 22 to 38 minutes (the target is 25 to 35).
export const slow = true;
const FIGHT = JSON.parse(process.env.FIGHT_SECS || '{"r1":100,"r2":100,"r3":100,"r4":105,"final":135}');
export default async ({ page }) => {
  const out = await page.evaluate(() => {
    const D = G.debug, regions = Object.values(G.regionDefs).sort((a, b) => a.gate - b.gate).map(r => r.id), res = {};
    G.ledger && (G.ledger.force = 'none');
    for (const reg of regions) {
      res[reg] = [];
      for (let seed = 1; seed <= 8; seed++) {
        D.newRun(seed); const g = G.run.graph, rg = g.regions[reg], def = id => G.roomDefs[g.nodes[id].def];
        const mains = rg.nodes.filter(id => def(id).kind === 'main'), cross = id => def(id).cols * 32 / 285 * 2.5 + Math.max(0, def(id).rows - 17);
        const side = rg.nodes.filter(id => g.nodes[id].parent && (def(id).kind === 'trial' || id === rg.own));
        res[reg].push({ mains: mains.length, enemies: mains.reduce((s, id) => s + g.nodes[id].content.filter(c => c && c.type === 'enemy').length, 0), cross: mains.reduce((s, id) => s + cross(id), 0),
          side: side.reduce((s, id) => s + cross(id) + 20, 0), sides: rg.nodes.filter(id => g.nodes[id].parent).length });
      }
    }
    return res;
  });
  const lines = [], avg = (rows, k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  let total = 60, rooms = 0, fights = 0, fightTime = 0;
  for (const reg of Object.keys(out)) {
    const rows = out[reg], n = avg(rows, 'mains'), foes = avg(rows, 'enemies'), cross = avg(rows, 'cross'), side = avg(rows, 'side'), boss = 0.65 * FIGHT[reg] + 6;
    const t = cross + foes * 7 + side + boss + 40; total += t; rooms += n; fights += foes; fightTime += boss;
    lines.push(reg + ': ' + n.toFixed(1) + ' rooms, ' + foes.toFixed(1) + ' enemies, ' + (t / 60).toFixed(1) + ' min');
  }
  const mins = total / 60, msg = 'modelled full clear ' + mins.toFixed(1) + ' min (' + rooms.toFixed(0) + ' main rooms crossed, ' + fights.toFixed(0) + ' enemies and 5 Wardens fought, Wardens ' + (fightTime / 60).toFixed(1) + ' min): ' + lines.join('; ');
  console.log(msg);
  if (mins < 22 || mins > 38) throw new Error('the modelled run takes ' + mins.toFixed(1) + ' min (target 25 to 35): ' + lines.join('; '));
  return msg;
};
