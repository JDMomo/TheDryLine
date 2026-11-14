// Saves tools/shots/hub.png and tools/shots/boss_r1.png for a human (or agent) to look at.
export default async ({ page, shots }) => {
  const canvas = page.locator('#game');
  await page.evaluate(() => { G.debug.newRun(7); G.debug.step(90); });
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: shots + '/hub.png' });
  await page.evaluate(() => {
    const D = G.debug;
    D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('basalt_roller');
    D.god(true); D.startBoss('r1'); D.step(240);
    D.setInput(0, { attack: true }); D.step(3);
  });
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: shots + '/boss_r1.png' });
  return 'saved hub.png, boss_r1.png';
};
