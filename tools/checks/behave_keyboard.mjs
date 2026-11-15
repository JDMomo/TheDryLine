// A keyboard-only player can cross the first room of a run: real keyboard events (Playwright) only, a simple bot holds Right and taps Space (Jump)
// where the floor ends or a wall rises. The game is stepped through G.debug.step between key changes; enemies cannot kill the bot (god mode).
export default async ({ page }) => {
  await page.evaluate(() => document.getElementById('game').focus());
  await page.keyboard.press('KeyX');                                      // the title: the keyboard becomes player 1
  await page.waitForFunction(() => G.state === 'play', null, { timeout: 4000 });
  const crossed = [];
  for (const seed of [5, 9]) {
    await page.evaluate(s => { G.debug.newRun(s); G.debug.god(true); G.debug.gotoRoom('r1'); G.debug.step(20); }, seed);
    const start = await page.evaluate(() => G.rooms.current.id);
    let jumping = 0, done = false;
    await page.keyboard.down('ArrowRight');
    for (let i = 0; i < 700 && !done; i++) {
      const r = await page.evaluate(() => { G.debug.step(4); const p = G.debug.probe(0); return { room: G.rooms.current.id, onGround: p.onGround, wall: p.wall, gap: p.gap, x: G.players[0].x }; });
      if (r.room !== start) { done = true; break; }
      if (jumping > 0) { jumping--; if (!jumping) await page.keyboard.up('Space'); }
      else if (r.onGround && (r.wall || r.gap)) { await page.keyboard.down('Space'); jumping = 3; }
    }
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space');
    crossed.push(done);
  }
  if (!crossed.some(Boolean)) throw new Error('a keyboard-only player could not cross the first room of r1 (seeds 5 and 9: ' + crossed.join(', ') + ')');
  const dev = await page.evaluate(() => G.players[0].in.dev);
  if (dev !== 'kb') throw new Error('player 1 is not on the keyboard: ' + dev);
  return 'crossed r1\'s first room with keyboard events on ' + crossed.filter(Boolean).length + ' of 2 seeds';
};
