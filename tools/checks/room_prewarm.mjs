// Entering a room builds the watercolor tile chunks of its first view inside rooms.enter (under the room fade), so the first drawn frame has nothing to
// build but at most the one ring chunk the drawing adds every second frame (playtest: 128 to 302 ms frames on room entry).
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const out = { fail: [], notes: [] }, D = G.debug; D.fullCharts = true; D.newRun(7); D.god(true);
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d'); if (G.view) ctx.setTransform(G.view.scale, 0, 0, G.view.sy, 0, 0);       // the transform the real canvas draws with
    if (!G.world || !G.world.prewarm || !G.world.stats) { out.fail.push('no G.world.prewarm'); return out; }
    let entered = 0, firstFrame = 0, rooms = 0, worstFirst = 0;
    for (const id of Object.keys(G.run.graph.nodes)) {
      const c0 = G.world.stats.chunks; G.rooms.enter(id, { side: 'left' }); const c1 = G.world.stats.chunks;
      ctx.setTransform(G.view ? G.view.scale : 1, 0, 0, G.view ? G.view.sy : 1, 0, 0); G.rooms.draw(ctx, 0.008); const c2 = G.world.stats.chunks;
      entered += c1 - c0; firstFrame += c2 - c1; worstFirst = Math.max(worstFirst, c2 - c1); rooms++;
    }
    if (!entered) out.fail.push('entering rooms built no chunks (is the watercolor tile art on?)');
    if (worstFirst > 1) out.fail.push('the first frame of a room still built ' + worstFirst + ' chunks');
    out.notes.push(rooms + ' rooms, ' + entered + ' chunks built on entry, ' + firstFrame + ' in first frames (worst ' + worstFirst + ')');
    return out;
  });
  if (res.fail.length) throw new Error(res.fail.join(' | '));
  return res.notes.join('; ');
};
