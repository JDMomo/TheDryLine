// Movement feel targets (bible section 7), measured in a flat test room loaded into G.tiles.
// Floor top is y 480. Columns 0 to 9 are floor, 10 to 29 are a pit (for the walk-off test); a block at column 15, row 9
// hangs a ceiling lip in the pit zone's air; a second floor strip sits at the bottom of the pit so nothing falls out.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, T = 32, out = {};
    D.newRun(3); D.god(true); D.unlockAll();
    D.gotoRoom('hub');
    const row = (fill, n = 30) => fill.padEnd(n, '.').slice(0, n);
    const grid = [];
    for (let i = 0; i < 17; i++) grid.push(row(''));
    grid[15] = '#'.repeat(30); grid[16] = '#'.repeat(30);                   // full floor, top at y 480
    const flat = grid.slice();
    const ledge = grid.slice();                                             // floor only left of column 10, pit below
    ledge[15] = row('#'.repeat(10)); ledge[16] = '#'.repeat(30);
    const lip = grid.slice(); lip[9] = row('').slice(0, 15) + '#' + row('', 14);   // block at column 15 (x 480 to 512), bottom y 320
    const P = G.players[0];
    const use = g => { G.tiles.load(g); G.rooms.current.grid = g; };
    const set = a => D.setInput(0, a), run = n => D.step(n);
    const clear = () => set({ left: false, right: false, up: false, down: false, jump: false, dash: false, attack: false });
    const reset = (g, x, y) => { use(g); clear(); D.place(0, x, y, 1); run(3); };
    const tap = (a, n = 1) => { set({ [a]: true }); run(n); set({ [a]: false }); };

    // 1. full jump (hold) and 2. tap jump
    reset(flat, 200, 480); set({ jump: true }); let top = 480;
    for (let i = 0; i < 160; i++) { run(1); top = Math.min(top, P.y); } out.full = 480 - top; clear(); run(60);
    reset(flat, 200, 480); set({ jump: true }); run(1); set({ jump: false }); top = 480;
    for (let i = 0; i < 160; i++) { run(1); top = Math.min(top, P.y); } out.tap = 480 - top; clear();

    // 3. walk off a ledge, then jump 0.08 s later
    reset(ledge, 280, 480); set({ right: true }); let n = 0;
    while (P.onGround && n++ < 200) run(1);
    out.leftGround = !P.onGround; run(8); const y0 = P.y; set({ jump: true }); run(1); set({ jump: false });
    run(3); out.coyoteRise = y0 - P.y; out.coyoteVy = P.vy; clear();

    // 4. jump pressed 0.09 s before landing (double jump off, or the air press would spend it)
    G.run.abil.double = false;
    reset(flat, 200, 380); P.onGround = false; let guard = 0, t = 1;
    while (guard++ < 400) { const d = 480 - P.y, v = P.vy, g = G.C.MOVE.GRAV; t = (-v + Math.sqrt(v * v + 2 * g * d)) / g; if (t <= 0.09) break; run(1); }
    out.pressAt = t; set({ jump: true }); let landed = false, fired = false;
    for (let i = 0; i < 60; i++) { run(1); if (P.onGround) landed = true; if (landed && P.vy < -500) { fired = true; break; } }
    out.bufferFired = fired; clear(); run(80); G.run.abil.double = true;

    // 5. dash distance
    reset(flat, 200, 480); const x0 = P.x; tap('dash'); let steps = 0;
    while ((P.dashT > 0 || steps === 0) && steps++ < 100) run(1);
    out.dash = P.x - x0; clear(); run(60);

    // 6. corner correction: the head clips the left edge of the block by 6 px
    reset(lip, 475, 480); set({ jump: true }); top = 480; run(1);
    for (let i = 0; i < 160; i++) { run(1); top = Math.min(top, P.y); } out.cornerRise = 480 - top; out.cornerX = P.x; clear();
    return out;
  });
  const bad = [];
  if (!(r.full >= 125 && r.full <= 140)) bad.push('full jump ' + r.full.toFixed(1) + ' px, want 125 to 140');
  if (!(r.tap < r.full / 2)) bad.push('tap jump ' + r.tap.toFixed(1) + ' px, want under ' + (r.full / 2).toFixed(1));
  if (!r.leftGround || !(r.coyoteRise > 4 && r.coyoteVy < 0)) bad.push('jump 0.08 s after leaving a ledge did not fire (rise ' + r.coyoteRise + ')');
  if (!r.bufferFired) bad.push('jump pressed ' + r.pressAt.toFixed(3) + ' s before landing did not fire');
  if (!(r.dash >= 115 && r.dash <= 135)) bad.push('dash ' + r.dash.toFixed(1) + ' px, want 115 to 135');
  if (!(r.cornerRise >= r.full - 3)) bad.push('corner correction: rose ' + r.cornerRise.toFixed(1) + ' px under a ceiling lip, want about ' + r.full.toFixed(1));
  if (bad.length) throw new Error(bad.join('; '));
  return 'jump ' + r.full.toFixed(0) + ' px, tap ' + r.tap.toFixed(0) + ', dash ' + r.dash.toFixed(0) + ', corner rise ' + r.cornerRise.toFixed(0);
};
