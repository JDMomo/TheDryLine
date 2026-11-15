// The Junction's layout: no hub prop's box overlaps a gate or another prop's label, every label stays on screen, and every row of the lock chart board is
// readable (a region's name never runs into its cut shapes, and the last row, "The Terminus", is not clipped by the panel). Seeds with 0 to 4 Wardens
// beaten, so the Terminus gate's "Borrows:" lines (up to two lines) are covered too.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D = G.debug, U = G.util, bad = [], cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    let nProps = 0, nBoxes = 0;
    for (const seed of [1, 5, 9, 33, 77]) for (const nb of [0, 2, 4]) {
      D.newRun(seed); for (const r of ['r1', 'r2', 'r3', 'r4'].slice(4 - nb)) G.run.beaten[r] = true;
      const room = G.rooms.current, all = [];
      room.props.forEach((pr, i) => { for (const b of G.props.boxes(pr, ctx)) all.push(Object.assign({ i, type: pr.type, region: pr.data && pr.data.region }, b)); nProps++; });
      nBoxes += all.length;
      const tag = b => b.type + (b.region ? ' ' + b.region : '') + (b.text ? ' "' + b.text + '"' : '') + ' [' + [b.x0, b.y0, b.x1, b.y1].map(Math.round) + ']';
      for (let a = 0; a < all.length; a++) {
        const A = all[a];
        if (A.x0 < 0 || A.x1 > 960 || A.y0 < 0) bad.push('seed ' + seed + '/' + nb + ': off screen ' + tag(A));
        for (let b = a + 1; b < all.length; b++) {
          const B = all[b];
          if (A.i === B.i) continue;                                              // a prop's own parts (a gate and its own label) belong together; the board's rows are checked below
          if (U.overlap(A, B)) bad.push('seed ' + seed + '/' + nb + ': ' + tag(A) + ' overlaps ' + tag(B));
        }
      }
      // the board: every row inside the panel, name clear of its cuts, nothing clipped
      const board = room.props.find(p => p.type === 'board'), L = (() => { const bx = G.props.boxes(board, ctx); return bx; })();
      const panel = L.find(b => b.kind === 'body'), regions = Object.values(G.regionDefs);
      for (const r of regions) {
        const nm = L.find(b => b.text === r.name); if (!nm) { bad.push('board has no row for ' + r.name); continue; }
        const cuts = L.filter(b => b.text === 'cut' && b.y0 === nm.y0);
        if (cuts.length !== 3) bad.push(r.name + ': ' + cuts.length + ' cuts on its row');
        for (const c of cuts) if (nm.x1 + 2 > c.x0) bad.push('board row ' + r.name + ' runs into its cut shapes (' + Math.round(nm.x1) + ' vs ' + Math.round(c.x0) + ')');
        if (nm.x0 < panel.x0 + 4 || nm.y1 > panel.y1 - 3 || cuts.some(c => c.x1 > panel.x1 - 4)) bad.push('board row ' + r.name + ' is clipped by the panel');
      }
    }
    return { bad, nProps, nBoxes };
  });
  if (res.bad.length) throw new Error(res.bad.length + ' problems: ' + [...new Set(res.bad)].slice(0, 6).join(' | '));
  return res.nProps + ' hub props, ' + res.nBoxes + ' boxes on 15 hubs, no overlaps';
};
