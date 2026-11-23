// The watercolor player test: strips load, F2 toggles, missing strips fall back, and a shot of the player in the hub.
export default async ({ page, shots }) => {
  await page.evaluate(() => { G.debug.newRun(5); });
  await page.waitForFunction(() => !G.spritesPending);
  const st = await page.evaluate(() => ({ idle: !!G.strips.player_idle, run: !!G.strips.player_run, on: G.artTest, n: G.strips.player_run && G.strips.player_run.frames }));
  if (!st.idle || !st.run || !st.on || st.n !== 12) throw new Error('strips not loaded ' + JSON.stringify(st));
  await page.evaluate(() => { G.players[0].x = 296; G.debug.step(60); });
  const canvas = page.locator('#game');
  await canvas.screenshot({ path: shots + '/art_test_player.png' });
  await page.keyboard.press('F2');
  if (await page.evaluate(() => G.artTest)) throw new Error('F2 did not switch the test off');
  await page.keyboard.press('F2');
  if (!(await page.evaluate(() => G.artTest))) throw new Error('F2 did not switch it back on');
  // players 2 to 4 wear the strips too, each with a marker in their own colour; revive and interact strips; the dash afterimage is a silhouette of the dash frame
  const more = await page.evaluate(() => {
    const D = G.debug, out = {}, cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; const ctx = cv.getContext('2d');
    D.newRun(5); D.god(true); G.artTest = true; while (G.players.length < 4) D.addPlayer(); D.step(5);
    const frames = [], fills = []; const df = G.art.drawFrame; G.art.drawFrame = function (id, c, n, o) { frames.push(id); return df.apply(this, arguments); };
    const fill0 = ctx.fill.bind(ctx); ctx.fill = (...a) => { fills.push(String(ctx.fillStyle).toLowerCase()); return fill0(...a); };
    for (const p of G.players) p.draw(ctx, 1 / 60);
    G.art.drawFrame = df;
    out.frames = frames.length; out.fills = [...new Set(fills)]; out.colors = G.C.PLAYER_COLORS.map(c => c.toLowerCase());
    // revive: a downed player gets back up on entering a room
    const q = G.players[1]; q.hp = 0; q.down = true; q.downAt = G.time; D.gotoRoom('r1'); D.step(2);
    out.revived = !q.down && q.hp === 1; out.reviveStrip = G.pickStrip(q)[0]; D.step(100); out.afterRevive = G.pickStrip(q)[0];
    // interact: using a prop plays the interact strip for a moment
    D.newRun(5); D.god(true); D.step(5);
    const sign = G.rooms.current.props.find(p => p.type === 'sign' && p.data.text), p0 = G.players[0];
    D.place(0, sign.x, sign.y, 1); D.step(3); D.setInput(0, { interact: true }); D.step(2); D.setInput(0, { interact: false });
    out.useStrip = G.pickStrip(p0)[0]; D.step(80); out.afterUse = G.pickStrip(p0)[0];
    // dash afterimage
    G.run.abil.dash = true; p0.canDash = true; p0.dashCd = 0; D.place(0, sign.x - 100, sign.y, 1); D.step(3);
    const sil = []; const ds = G.art.drawSilhouette; G.art.drawSilhouette = function (id) { sil.push(id); return ds.apply(this, arguments); };
    D.setInput(0, { dash: true }); D.step(4); D.setInput(0, { dash: false });
    const n0 = G.fx.parts.filter(q2 => q2.paint).length; G.fx.draw(ctx); G.art.drawSilhouette = ds;
    out.ghosts = n0; out.silhouettes = sil.length; out.silId = sil[0];
    return out;
  });
  if (more.frames !== 4) throw new Error('four players should all draw strips: ' + more.frames);
  const others = more.colors.slice(1);
  if (!others.every(c => more.fills.includes(c)) || more.fills.includes(more.colors[0])) throw new Error('players 2 to 4 need a marker each in their own colour: ' + JSON.stringify(more));
  if (!more.revived || more.reviveStrip !== 'revive' || more.afterRevive === 'revive') throw new Error('revive strip: ' + JSON.stringify(more));
  if (more.useStrip !== 'interact' || more.afterUse === 'interact') throw new Error('interact strip: ' + JSON.stringify(more));
  if (!more.ghosts || !more.silhouettes || more.silId !== 'player_dash') throw new Error('dash afterimage should be a silhouette of the dash frame: ' + JSON.stringify(more));
  await page.evaluate(() => { G.debug.newRun(5); });
  // fallback: with a strip missing the code-drawn player is used (no error)
  await page.evaluate(() => { delete G.strips.player_run; G.debug.step(10); });
  return 'strips, F2, fallback';
};
