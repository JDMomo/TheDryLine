import { createRequire } from 'module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1040, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
await page.goto('file:///home/claude/proto/index.html');
await page.waitForTimeout(300);

const out = await page.evaluate(() => {
  const g = window.__g, P = g.P, T = 32, FLOOR = 480, R = {};
  const set = (o) => { for (const k of ['left','right','up','down','jump','attack','dash','item','heal']) { const h = !!o[k]; if (h && !g.held[k]) g.pressed[k] = true; g.held[k] = h; } };
  const place = (x, y = FLOOR) => { Object.assign(P, { x, y, vx: 0, vy: 0, onGround: true, hp: 5, inv: 0, stun: 0, dashT: 0, dashCd: 0, canDash: true, canDouble: true, dead: false, jbuf: 0, dbuf: 0, coyote: 0, wlock: 0, sliding: false, slash: null, safeX: x, safeY: y }); };
  const ab = (o) => { for (const k in g.abil) g.abil[k] = !!o[k]; };
  // cross a gap: try many jump take-off points and dash / double timings; report the best landing x and whether any try crosses unhurt
  function cross(startX, edgeX, farX, useDash, useDouble) {
    let ok = false, best = 0;
    for (let jx = edgeX - 30; jx <= edgeX + 40; jx += 3) for (const dashAt of useDash ? [-200, 0, 200, 400] : [null]) for (const djAt of useDouble ? [0, 150, 300, 500] : [null]) {
      place(startX); set({});
      let jumped = false, dashed = false, dj = false, done = false;
      for (let i = 0; i < 120 * 4 && !done; i++) {
        const inp = { right: true };
        if (!jumped && P.x >= jx) { jumped = true; }
        if (jumped) inp.jump = true;
        if (jumped && useDouble && !dj && !P.onGround && P.vy >= djAt) { dj = true; inp.jump = false; }
        if (jumped && useDash && !dashed && !P.onGround && P.vy >= dashAt) { dashed = true; inp.dash = true; }
        set(inp); if (dj === true) { dj = 2; } else if (dj === 2) { set({ ...inp, jump: true }); dj = 3; }
        g.step(1 / 120);
        if (P.hp < 5) done = true;
        else if (jumped && P.onGround && P.x > edgeX + 40) { done = true; best = Math.max(best, P.x); if (P.x >= farX) ok = true; }
      }
    }
    return { ok, best: Math.round(best) };
  }
  ab({}); R.gap1_jumpOnly = cross(400, 15 * T, 24 * T, false, false);
  ab({ dash: 1 }); R.gap1_dash = cross(400, 15 * T, 24 * T, true, false);
  ab({ dash: 1, grip: 1 }); R.gap2_dashOnly = cross(1270, 42 * T, 56 * T, true, false);
  ab({ dash: 1, grip: 1, double: 1 }); R.gap2_doubleDash = cross(1270, 42 * T, 56 * T, true, true);

  // single jump numbers
  ab({}); place(200); set({ jump: true }); let top = FLOOR, n = 0; do { g.step(1 / 120); top = Math.min(top, P.y); n++; set({ jump: true }); } while (!P.onGround && n < 400);
  R.fullJump = { heightPx: Math.round(FLOOR - top), airTime: +(n / 120).toFixed(2) };
  place(200); set({ jump: true }); g.step(1 / 120); set({}); top = FLOOR; n = 1; do { g.step(1 / 120); top = Math.min(top, P.y); n++; } while (!P.onGround && n < 400);
  R.tapJump = { heightPx: Math.round(FLOOR - top), airTime: +(n / 120).toFixed(2) };

  // wall climb with grip only, then without
  for (const grip of [1, 0]) {
    ab({ grip }); place(29 * T); set({}); let t = 0, pulse = 0;
    for (; t < 120 * 12 && P.x < 34.5 * T; t++) {
      const want = P.onGround || (P.wall && P.vy > -150);
      pulse = want && pulse <= 0 ? 6 : pulse - 1;
      set({ right: true, jump: pulse > 3 || (!want && P.vy < 0) });
      g.step(1 / 120);
    }
    R[grip ? 'wall_withGrip' : 'wall_noGrip'] = { passed: P.x >= 34.5 * T, seconds: +(t / 120).toFixed(1) };
  }
  // heavy-cut ledge by double jump
  ab({ double: 1 }); place(1915); set({});
  let st = 0, got = false;
  for (let i = 0; i < 120 * 3; i++) {
    if (st === 0) { set({ jump: true }); st = 1; }
    else if (st === 1 && P.vy > -40) { set({}); st = 2; }
    else if (st === 2) { set({ jump: true, right: true }); st = 3; }
    else if (st === 3) set({ jump: true, right: true });
    g.step(1 / 120);
    if (g.abil.heavy) { got = true; break; }
  }
  R.ledge_doubleJump = got;
  return R;
});
console.log(JSON.stringify(out, null, 1));

// fight checks
const fightRes = await page.evaluate(() => {
  const g = window.__g, P = g.P, b = g.boss, FLOOR = 480, R = {};
  const set = (o) => { for (const k of ['left','right','up','down','jump','attack','dash','item','heal','cycle','party','skip','restart']) { const h = !!o[k]; if (h && !g.held[k]) g.pressed[k] = true; g.held[k] = h; } };
  const tick = (n, o = {}) => { for (let i = 0; i < n; i++) { set(o); g.step(1 / 120); } };
  set({ skip: true }); tick(2); set({ party: true }); tick(2);
  // take all three
  for (const q of g.pedestals) { P.x = q.x; P.vx = 0; tick(3); set({ down: true }); tick(2); tick(2); }
  R.carried = g.carried.slice();
  // walk into the arena
  for (let i = 0; i < 120 * 8 && !g.fight; i++) { set({ right: true }); g.step(1 / 120); }
  R.fightStarted = g.fight; R.spotsOpen = Object.fromEntries(Object.entries(b.spots).map(([k, s]) => [k, s.open]));
  const hold = () => { b.state = 'idle'; b.t = 99; b.x = 2800; b.y = FLOOR; b.face = -1; b.rear = 0; P.hp = 5; P.inv = 5; P.itemCd = 0; P.stun = 0; };
  const sel = (id) => { P.sel = g.carried.indexOf(id); };
  // lance at eye height
  for (let i = 0; i < 3; i++) { hold(); sel('lance'); P.x = 2600; P.y = 480 - 68 + 24; P.vy = 0; P.vx = 0; P.face = 1; P.onGround = false; set({}); g.step(1 / 120); hold(); P.y = 480 - 68 + 24; P.vy = 0; set({ item: true }); for (let j = 0; j < 60; j++) { hold(); g.step(1 / 120); } set({}); }
  R.eye = { ...b.spots.eye }; R.hpAfterEye = b.hp; R.stateAfterEye = b.state;
  // lance thrown from the ground should miss the eye
  hold(); const before = b.spots.hump.hp;
  // flask lobbed from the ground about 147 px in front of centre
  for (let i = 0; i < 3; i++) { hold(); sel('flask'); P.x = 2800 - 147; P.y = FLOOR; P.vx = 0; P.vy = 0; P.face = 1; P.onGround = true; set({}); g.step(1 / 120); set({ item: true }); for (let j = 0; j < 150; j++) { hold(); P.x = 2800 - 147; P.vx = 0; g.step(1 / 120); } set({}); }
  R.hump = { ...b.spots.hump }; R.hpAfterHump = b.hp;
  // bell while the boss rears
  for (let i = 0; i < 3; i++) { hold(); b.rear = 1; b.state = 'chargeTell'; b.t = 99; sel('bell'); P.x = 2800 - 90; P.y = FLOOR; P.vx = 0; P.face = 1; set({}); g.step(1 / 120); b.rear = 1; set({ item: true }); g.step(1 / 120); set({}); for (let j = 0; j < 20; j++) { hold(); g.step(1 / 120); } }
  R.belly = { ...b.spots.belly }; R.hpAfterBelly = b.hp; R.carriedAfter = g.carried.slice();
  // finish with slashes
  let n = 0; while (b.state !== 'dead' && n < 4000) { hold(); P.x = 2800 - 80; P.y = FLOOR; P.face = 1; set({ attack: n % 40 < 4 }); g.step(1 / 120); n++; }
  R.dead = b.state === 'dead'; R.result = g.result; R.slashFrames = n;
  return R;
});
console.log(JSON.stringify(fightRes, null, 1));

// soak: random inputs through a real fight, several attempts
const soak = await page.evaluate(() => {
  const g = window.__g, P = g.P, b = g.boss; let deaths = 0, wins = 0, minHp = 420;
  const keys = ['left','right','up','down','jump','attack','dash','item','heal','cycle'];
  const set = (o) => { for (const k of [...keys, 'restart', 'skip', 'party']) { const h = !!o[k]; if (h && !g.held[k]) g.pressed[k] = true; g.held[k] = h; } };
  set({ restart: true }); g.step(1 / 120); set({}); g.step(1 / 120);
  let o = {}, wasDead = false;
  for (let i = 0; i < 120 * 240; i++) {
    if (i % 9 === 0) { o = {}; for (const k of keys) o[k] = Math.random() < 0.35; if (!g.fight) { o.right = true; o.left = false; o.down = Math.random() < 0.5; } }
    set(o); g.step(1 / 120);
    if (P.dead && !wasDead) deaths++; wasDead = P.dead;
    if (g.fight) minHp = Math.min(minHp, b.hp);
    if (g.result) { wins++; set({ restart: true }); g.step(1 / 120); set({}); }
    if (!isFinite(P.x) || !isFinite(P.y) || !isFinite(b.x)) return { bad: 'NaN', i };
    if (P.x < 32 || P.x > 3168 || P.y > 512 || P.y < 32) return { bad: 'out of bounds', x: P.x, y: P.y, i };
  }
  return { deaths, wins, minBossHp: minHp };
});
console.log(JSON.stringify(soak));

// one look
await page.evaluate(() => { const g = window.__g; g.start(); });
await page.waitForTimeout(100);
await page.evaluate(() => {
  const g = window.__g, set = (o) => { for (const k in o) { if (o[k] && !g.held[k]) g.pressed[k] = true; g.held[k] = o[k]; } };
  set({ restart: true });
});
await page.waitForTimeout(200);
await page.keyboard.press('KeyM'); await page.waitForTimeout(80);
await page.evaluate(() => { const g = window.__g; g.P.x = g.pedestals[0].x; });
await page.waitForTimeout(120); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(120);
await page.evaluate(() => { const g = window.__g; g.P.x = g.pedestals[1].x; });
await page.waitForTimeout(120); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);
await page.screenshot({ path: 'hall.png', clip: { x: 0, y: 0, width: 1040, height: 900 } });
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2600); await page.keyboard.up('ArrowRight');
await page.keyboard.press('KeyX'); await page.waitForTimeout(60);
await page.screenshot({ path: 'arena.png', clip: { x: 24, y: 60, width: 992, height: 570 } });
console.log('errors:', JSON.stringify(errs));
await browser.close();
