// The watercolor player test: strips load, F2 toggles, missing strips fall back, and a shot of the player in the hub.
export default async ({ page, shots }) => {
  await page.evaluate(() => { G.debug.newRun(5); });
  await page.waitForFunction(() => !G.spritesPending);
  const st = await page.evaluate(() => ({ idle: !!G.strips.player_idle, run: !!G.strips.player_run, on: G.artTest, n: G.strips.player_run && G.strips.player_run.frames }));
  if (!st.idle || !st.run || !st.on || st.n !== 8) throw new Error('strips not loaded ' + JSON.stringify(st));
  await page.evaluate(() => { G.players[0].x = 296; G.debug.step(60); });
  const canvas = page.locator('#game');
  await canvas.screenshot({ path: shots + '/art_test_player.png' });
  await page.keyboard.press('F2');
  if (await page.evaluate(() => G.artTest)) throw new Error('F2 did not switch the test off');
  await page.keyboard.press('F2');
  if (!(await page.evaluate(() => G.artTest))) throw new Error('F2 did not switch it back on');
  // fallback: with a strip missing the code-drawn player is used (no error)
  await page.evaluate(() => { delete G.strips.player_run; G.debug.step(10); });
  return 'strips, F2, fallback';
};
