// Wreck Quay's renderer has region-specific hull/rib/chain silhouettes and tile detail without changing gameplay.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544;
    const ctx = cv.getContext('2d');
    const countBackdrop = id => {
      const n = { quad: 0, bez: 0, ellipse: 0, stroke: 0 };
      const q = ctx.quadraticCurveTo.bind(ctx), b = ctx.bezierCurveTo.bind(ctx), e = ctx.ellipse.bind(ctx), s = ctx.stroke.bind(ctx);
      ctx.quadraticCurveTo = (...a) => { n.quad++; return q(...a); };
      ctx.bezierCurveTo = (...a) => { n.bez++; return b(...a); };
      ctx.ellipse = (...a) => { n.ellipse++; return e(...a); };
      ctx.stroke = (...a) => { n.stroke++; return s(...a); };
      G.art.backdrop(ctx, G.art.palette(id), 240, 3.5, id);
      ctx.quadraticCurveTo = q; ctx.bezierCurveTo = b; ctx.ellipse = e; ctx.stroke = s;
      return n;
    };
    const r1 = countBackdrop('r1'), r2 = countBackdrop('r2');
    const D = G.debug; D.newRun(5); D.god(true); D.gotoRoom('r1_ribs'); G.rooms.current.enemies.length = 0;
    G.rooms.draw(ctx, 0.016);
    return { r1, r2, state: D.state().state, room: G.rooms.current.def.id };
  });
  const bad = [];
  if (r.r1.quad < 16 || r.r1.bez < 20 || r.r1.ellipse < 12) bad.push('Wreck Quay backdrop motifs missing: ' + JSON.stringify(r.r1));
  if (r.r2.quad || r.r2.bez || r.r2.ellipse) bad.push('Wreck Quay motifs leaked into r2: ' + JSON.stringify(r.r2));
  if (r.state !== 'play' || r.room !== 'r1_ribs') bad.push('render pass disturbed game state: ' + JSON.stringify(r));
  if (bad.length) throw new Error(bad.join(' | '));
  return 'Wreck Quay hulls, ribs, chains and rust tile detail are region-scoped';
};
