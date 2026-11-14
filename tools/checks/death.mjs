// Standing still in the Tollkeeper's arena without god mode: the player falls, the run ends and the run-over screen shows.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug;
    D.newRun(5); D.god(false); D.startBoss('r1');
    let s = D.state();
    for (let i = 0; i < 120 && s.state === 'play'; i++) { D.step(60); s = D.state(); }
    return { state: s.state, over: s.run.over, hp: s.players[0].hp, down: s.players[0].down, time: s.run.time };
  });
  if (r.over !== 'dead' || !r.down || r.state !== 'over') throw new Error(JSON.stringify(r));
  return 'fell after ' + r.time.toFixed(1) + ' s';
};
