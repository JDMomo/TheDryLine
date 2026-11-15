// Behaviour with the real game loop and real keyboard events (Playwright's keyboard), no G.debug calls until the end:
//  - a key on the title starts the run and the keyboard is player 1; the loop keeps advancing; a hit stop ends (a frozen loop is detected);
//  - held arrows move the player; Esc pauses and time stops (the player does not move while paused); Esc again resumes.
export default async ({ page }) => {
  const q = () => page.evaluate(() => ({ state: G.state, time: G.time, run: G.run ? G.run.time : -1, x: G.players[0] ? G.players[0].x : -1, hs: G.fx.hitstop }));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let s = await q();
  if (s.state !== 'title') throw new Error('not on the title: ' + s.state);
  await page.evaluate(() => { document.getElementById('game').focus(); });
  await page.keyboard.press('KeyX');
  await page.waitForFunction(() => G.state === 'play', null, { timeout: 4000 });
  // game seconds advanced by the real loop within a real-time budget (a loaded machine runs fewer frames, so wait for progress instead of for a fixed time)
  const advance = (field, amount, budget = 8000) => page.waitForFunction(([f, t0, amt]) => (f === 'run' ? G.run.time : f === 'time' ? G.time : G.players[0].x - t0) >= (f === 'x' ? amt : t0 + amt), [field, field === 'run' ? s0.run : field === 'time' ? s0.time : s0.x, amount], { timeout: budget, polling: 50 });
  let s0 = await q(), a, b;
  try { await advance('time', 0.3); await advance('run', 0.3); } catch (e) { b = await q(); throw new Error('the loop is not advancing: time ' + s0.time + ' -> ' + b.time + ', run ' + s0.run + ' -> ' + b.run); }
  if (await page.evaluate(() => G.players.length !== 1 || G.players[0].in.dev !== 'kb')) throw new Error('the keyboard did not become player 1');
  // a hit stop (as after any hit) must end by itself
  await page.evaluate(() => G.fx.jolt(0.12, 0));
  s0 = await q();
  try { await advance('run', 0.3); } catch (e) { b = await q(); throw new Error('the loop froze after a hit stop (hitstop ' + b.hs + ', run ' + s0.run + ' -> ' + b.run + ')'); }
  // arrows move the player
  s0 = await q();
  await page.keyboard.down('ArrowRight');
  try { await advance('x', 60); } catch (e) { b = await q(); throw new Error('holding Right moved the player ' + (b.x - s0.x).toFixed(0) + ' px'); } finally { await page.keyboard.up('ArrowRight'); }
  // pause: time stops, the held key does nothing, resume continues
  await page.keyboard.press('Escape'); await page.waitForFunction(() => G.state === 'pause', null, { timeout: 5000 }).catch(() => {}); await sleep(100);
  a = await q();
  if (a.state !== 'pause') throw new Error('Esc did not pause: ' + a.state);
  await page.keyboard.down('ArrowLeft'); await sleep(600); b = await q(); await page.keyboard.up('ArrowLeft');
  if (Math.abs(b.run - a.run) > 0.01 || Math.abs(b.x - a.x) > 0.5) throw new Error('time or the player moved while paused: run ' + a.run + ' -> ' + b.run + ', x ' + a.x + ' -> ' + b.x);
  await page.keyboard.press('Escape');
  s0 = a; try { await advance('run', 0.3); } catch (e) { /* reported below */ }
  b = await q();
  if (b.state !== 'play' || !(b.run - a.run > 0.3)) throw new Error('Esc did not resume: ' + b.state + ', run ' + a.run + ' -> ' + b.run);
  return 'title key starts, loop advances, hit stop ends, arrows move, pause stops time, resume continues';
};
