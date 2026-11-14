// The page loads without errors, shows the title, and a run starts in the hub with every region and boss in place.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, before = D.state().state;
    D.newRun(1); D.step(120);
    const s = D.state();
    return { before, after: s.state, kind: s.room.kind, regions: Object.keys(s.graph.regions), bosses: Object.values(G.regionDefs).every(r => G.bossDefs[r.boss]),
      gates: s.room.props.filter(p => p.type === 'gate').length, overlay: document.getElementById('start').hidden };
  });
  if (r.before !== 'title') throw new Error('expected the title screen first, got ' + r.before);
  if (r.after !== 'play' || r.kind !== 'hub') throw new Error('a new run should start in the hub: ' + JSON.stringify(r));
  if (r.regions.join() !== 'r1,r2,r3,r4,final') throw new Error('regions: ' + r.regions);
  if (!r.bosses) throw new Error('a region names a boss that does not exist');
  if (r.gates !== 5) throw new Error('the hub should show 5 gates, shows ' + r.gates);
};
