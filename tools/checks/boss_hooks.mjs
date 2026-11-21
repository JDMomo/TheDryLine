// The boss hooks and the attack registry (js/game/bosses.js):
//  - no boss file assigns to an instance method the base class owns (b.rect = ..., b.start = ..., b.update = ...), uses accessors for a fare slot's
//    anchor, or keeps a module-level "current boss" variable; at run time no boss instance carries an own property named like a Boss method;
//  - every attack a boss starts (every *Tell state in its file) is in the registry, with a fair note, a tell of 0.45 s or more (0.35 s enraged), real
//    strike and tell states in the boss's code, and fare-slot links that match the slot's onBreak; b.begin() sets exactly the registered wind-up;
//  - the borrowed attacks of the Long Clock resolve through `like`;
//  - hooks: several hit boxes, per-state contact, damage filter, onDeath, summoned enemies (owned, loot or no loot, die with the boss).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export default async ({ page }) => {
  const problems = [], bad = m => problems.push(m);
  const proto = await page.evaluate(() => Object.getOwnPropertyNames(G.Boss.prototype).filter(n => n !== 'constructor'));
  const files = fs.readdirSync(path.join(root, 'js', 'content')).filter(f => /^boss_.*\.js$/.test(f));
  const src = {};
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, 'js', 'content', f), 'utf8'); src[f] = text;
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const n of proto) { const m = code.match(new RegExp('\\b(?:b|this|boss)\\.' + n + '\\s*=(?!=)')); if (m) bad(f + ': assigns to the base class method ' + m[0]); }
    if (/Object\.defineProperty\(/.test(code)) bad(f + ': uses Object.defineProperty (a fare slot anchor is a function of the boss)');
    if (/\bget\s+local\b/.test(code)) bad(f + ': a getter for a fare slot anchor (use local: b => [x, y])');
    if (/^let\s+cur\b/m.test(code)) bad(f + ': a module-level "cur" boss variable (hooks receive the boss)');
    if (/G\.Boss\.prototype\.(start|damage|update)\b/.test(code)) bad(f + ': wraps a Boss method (use onStart, filterDamage, onDeath)');
  }
  const res = await page.evaluate(async ({ proto }) => {
    const D = G.debug, out = { fail: [], notes: [] }, bad = m => out.fail.push(m);
    const regionOf = { tollkeeper: 'r1', lamp_heron: 'r2', switchman_idol: 'r3', gatewhale: 'r4', long_clock: 'final' };
    const tells = {};
    for (const id in regionOf) {
      D.fullCharts = true; D.newRun(7); D.god(true); D.startBoss(regionOf[id]);
      const b = G.rooms.current.boss, def = G.bossDefs[id];
      if (!b || b.id !== id) { bad(id + ': could not start'); continue; }
      for (const k of Object.keys(b)) if (proto.includes(k)) bad(id + ': the instance has an own property ' + k + ' that shadows a Boss method');
      for (const cut in def.spots) { const d = Object.getOwnPropertyDescriptor(def.spots[cut], 'local'); if (d && d.get) bad(id + '.' + cut + ': local is a getter'); }
      for (const sp of b.spots) { const q = b.spotPos(sp); if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad(id + ': spot ' + sp.cls + ' has no position'); }
      const shapes = b.shapes(); if (!Array.isArray(shapes) || !shapes.length || !shapes.every(q => q.x1 > q.x0 && q.y1 > q.y0)) bad(id + ': shapes() is not a list of boxes');
      const r = b.rect(); if (!(r.x1 > r.x0)) bad(id + ': rect() is empty');
      if (!Array.isArray(b.contactBoxes())) bad(id + ': contactBoxes() is not a list');
      // the registry
      const reg = G.attackDefs[id]; if (!reg || !Object.keys(reg).length) { bad(id + ': no attack registry'); continue; }
      tells[id] = {};
      for (const aid in reg) {
        const a = G.attackDef(id, aid);
        tells[id][aid] = { tell: a.tell, strike: a.strike, recover: a.recoverStates, wind: a.wind };
        if (!a.name || !a.fair || a.fair.length < 30) bad(id + '.' + aid + ': name and a fairness note are required');
        if (!(a.wind >= 0.45)) bad(id + '.' + aid + ': wind-up ' + a.wind + ' s is under 0.45 s');
        if (!a.strike.length) bad(id + '.' + aid + ': no strike state');
        if (!(a.recover >= 0)) bad(id + '.' + aid + ': no recovery time');
        if (!['jump', 'duck', 'move', 'leave', 'cut'].includes(a.dodge)) bad(id + '.' + aid + ': dodge is ' + a.dodge);
        for (const s of a.slots) {
          const sd = def.spots[s.cut];
          if (!sd) { bad(id + '.' + aid + ': slot cut ' + s.cut + ' does not exist on the boss'); continue; }
          if (!['disable', 'weaken'].includes(s.mode)) bad(id + '.' + aid + ': slot mode ' + s.mode);
          if (!sd.onBreak.toString().includes('flags.' + s.flag)) bad(id + '.' + aid + ': the ' + s.cut + ' slot does not set flags.' + s.flag);
        }
        // begin() puts the boss in the registered tell with the scaled wind-up, calm and enraged
        b.hp = b.maxHp; b.set('idle', 5); b.flags.p2 = false;
        if (b.begin(aid) !== a || b.state !== a.tell || b.attack !== aid || Math.abs(b.t - Math.max(a.min, a.wind * b.windScale())) > 1e-9) bad(id + '.' + aid + ': begin() did not set the registered tell');
        if (b.phase() !== 'wind') bad(id + '.' + aid + ': phase() is ' + b.phase() + ' in the tell');
        b.hp = b.maxHp * 0.3; if (id === 'long_clock') b.flags.p2 = true;
        b.begin(aid);
        if (!(b.t >= 0.35 - 1e-9)) bad(id + '.' + aid + ': enraged wind-up ' + b.t.toFixed(3) + ' s is under 0.35 s');
        b.set(a.strike[0], 1); if (b.phase() !== 'strike') bad(id + '.' + aid + ': phase() is ' + b.phase() + ' in its strike state');
        b.set(a.recoverStates[0], 1); if (b.phase() !== 'recover') bad(id + '.' + aid + ': phase() is ' + b.phase() + ' in its recovery state');
        b.flags.p2 = false; b.hp = b.maxHp; b.set('idle', 5);
        for (const s of a.slots) if (s.mode === 'disable') { b.flags[s.flag] = true; if (b.available(aid)) bad(id + '.' + aid + ': still available with ' + s.flag); b.flags[s.flag] = false; }
        if (!b.available(aid)) bad(id + '.' + aid + ': not available with no slot punched');
      }
    }
    // borrowed attacks resolve through `like`
    for (const aid of ['toll', 'beam', 'sig', 'crates']) {
      const a = G.attackDef('long_clock', aid), parent = G.attackDef(...G.attackDefs.long_clock[aid].like.split('.'));
      if (!a || !parent) { bad('long_clock.' + aid + ': like does not resolve'); continue; }
      if (a.slots.length) bad('long_clock.' + aid + ': borrowed attacks do not inherit fare slots');
      if (!a.from) bad('long_clock.' + aid + ': no `from` region');
    }
    // hooks on a throwaway boss: several hit boxes, contact per state, damage filter, onDeath, ownership
    {
      let died = 0;
      G.defineBoss({ id: 't_hooks', name: 'Test', hp: 100, w: 40, h: 40, spots: {},
        shapes: b => [{ x0: b.x - 20, x1: b.x + 20, y0: b.y - 40, y1: b.y }, { x0: b.x + 100, x1: b.x + 140, y0: b.y - 40, y1: b.y }],
        contact: b => b.state === 'a' && [{ x0: b.x - 5, x1: b.x + 5, y0: b.y - 40, y1: b.y }, { x0: b.x + 100, x1: b.x + 110, y0: b.y - 40, y1: b.y }],
        filterDamage: (b, d) => d * 0.5, onDeath() { died++; }, update(b) { if (b.state === 'idle' || b.state === 'a') b.t = 5; } });
      G.defineAttacks('t_hooks', { a: { tell: 'aTell', wind: 0.5, strike: ['a'], fair: 'A test attack that exists only for this check.' } });
      D.newRun(3); D.startBoss('r1');
      const room = G.rooms.current, t = new G.Boss(G.bossDefs.t_hooks, 400, room.boss.floor, 'r1', { x0: 100, x1: 900 });
      room.boss = t; t.start(); t.set('idle', 5);
      if (t.shapes().length !== 2) bad('hooks: two hit boxes expected');
      const r = t.rect(); if (!(Math.abs(r.x0 - 380) < 1e-6 && Math.abs(r.x1 - 540) < 1e-6)) bad('hooks: rect() is not the union of the shapes');
      if (!t.hitsCircle(520, t.y - 20, 5) || t.hitsCircle(470, t.y - 20, 5)) bad('hooks: hitsCircle must find the far box and miss the gap');
      if (!t.hitsRect({ x0: 500, x1: 510, y0: t.y - 30, y1: t.y - 10 }) || t.hitsRect({ x0: 440, x1: 460, y0: t.y - 30, y1: t.y - 10 })) bad('hooks: hitsRect');
      t.attack = 'a'; t.set('aTell', 1); if (t.contactBoxes().length) bad('hooks: contact while winding up'); t.set('a', 5); if (t.contactBoxes().length !== 2) bad('hooks: contact function should give two boxes in the strike'); t.set('stagger', 1); if (t.contactBoxes().length) bad('hooks: contact function gave boxes while staggered');
      t.set('a', 5); const hp0 = t.hp; t.damage(10); if (Math.abs(hp0 - t.hp - 5) > 1e-9) bad('hooks: filterDamage not applied');
      // a hit on the far box in the real combat path
      D.god(false); G.players[0].place(t.x + 100 + 20, t.y, 1); const p = G.players[0]; p.hp = p.maxHp = 50; p.inv = 0; t.set('a', 5); t.attack = 'a'; t.held = null; D.step(1);
      if (p.hp >= 50) bad('hooks: standing in the far contact box did not hurt ' + JSON.stringify([t.state, t.attack, t.phase(), t.contactBoxes(), p.x, p.y, p.inv, p.down, G.state]));
      // ownership
      const owned = t.summon('ballast_crab', 300, t.y, { loot: false }), looted = t.summon('ballast_crab', 320, t.y);
      if (owned.owner !== t || !owned.summoned || !owned.noLoot || looted.noLoot || t.ownedAlive('ballast_crab').length !== 2) bad('hooks: summon bookkeeping');
      const pk = G.pickups.length; owned.damage(999, 0); if (!owned.dead || G.pickups.length !== pk) bad('hooks: a no-loot summon must die without dropping scrip');
      if (t.ownedAlive().length !== 1) bad('hooks: ownedAlive after a death');
      t.hp = 0; D.step(1);
      if (died !== 1 || t.state !== 'dead') bad('hooks: onDeath ran ' + died + ' times');
      if (!looted.dead) bad('hooks: a summoned enemy survived its boss');
      delete G.bossDefs.t_hooks; delete G.attackDefs.t_hooks;
    }
    // the real bosses' own hooks: the Idol's lying body, the Heron's stuck head, the Whale's cleanup, the Clock's armour
    {
      D.newRun(5); D.god(true); D.startBoss('r3'); let b = G.rooms.current.boss; b.set('idle', 9); b.held = { x: 700 };
      const stand = b.rect(); b.lie = 1; const lie = b.rect(); b.held = null;
      if (!(lie.x1 - lie.x0 > stand.x1 - stand.x0 + 40 && lie.y1 - lie.y0 < stand.y1 - stand.y0)) bad('r3: shapes() does not follow the lying body');
      if (b.contactBoxes().length) bad('r3: a lying Idol must not hurt on touch'); b.lie = 0; b.attack = 'rings'; b.set('ring', 5); if (b.contactBoxes().length !== 1) bad('r3: a standing Idol hurts on touch in a strike');
      D.newRun(5); D.startBoss('r2'); b = G.rooms.current.boss; const body = b.rect(); b.set('peckStuck', 2); b.hx = 100; b.hy = -20; const head = b.rect();
      if (Math.abs(head.y1 - head.y0 - 76) > 1e-6 || Math.abs(body.y1 - body.y0 - 150) > 1e-6) bad('r2: shapes() body and stuck head');
      const sp = b.spots.find(s => s.cls === 'pierce'); if (sp) { const q1 = b.spotPos(sp); b.hx = 20; const q2 = b.spotPos(sp); if (Math.abs(q1.x - q2.x) < 20) bad('r2: the Lamp anchor does not move with the head'); }
      D.newRun(5); D.startBoss('r4'); b = G.rooms.current.boss; b.set('idle', 9);
      b.summon('ballast_crab', b.x - 200, b.floor); b.crates.push({ c: 20, x: 650, y: b.floor, vy: 0, st: 'land', life: 5, bl: { c: 20, r0: 1, r1: 2, on: true } }); G.tiles.blockers.push(b.crates[0].bl);
      const nb = G.tiles.blockers.length; b.hp = 0; D.step(2);
      if (b.crates.length || G.tiles.blockers.length >= nb || b.ownedAlive().length) bad('r4: onDeath did not clear the crates and crabs');
      D.fullCharts = true; D.newRun(5); D.startBoss('final'); b = G.rooms.current.boss; b.set('ringTell', 1);
      const h0 = b.hp; b.damage(100); if (Math.abs(h0 - b.hp - 30) > 1e-6) bad('long_clock: shutters should take 70% off a hit during an attack');
      b.set('recover', 1); const h1 = b.hp; b.damage(100); if (Math.abs(h1 - b.hp - 100) > 1e-6) bad('long_clock: no armour while it recovers');
    }
    out.tells = tells; return out;
  }, { proto });
  for (const f of res.fail) bad(f);
  // every *Tell state the boss files can set is a registered tell, and every registered state is handled by the boss's code
  const idOf = { 'boss_r1.js': 'tollkeeper', 'boss_r2.js': 'lamp_heron', 'boss_r3.js': 'switchman_idol', 'boss_r4.js': 'gatewhale', 'boss_final.js': 'long_clock' };
  for (const f of files) {
    const id = idOf[f]; if (!id) { bad(f + ': a boss file this check does not know (add it to idOf)'); continue; }
    const code = src[f].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const used = new Set([...code.matchAll(/case '(\w+Tell)'/g)].map(m => m[1]));
    const reg = res.tells[id] || {}, tellOf = new Set(Object.values(reg).map(a => a.tell));
    for (const t of used) if (!tellOf.has(t)) bad(f + ': the tell state ' + t + ' has no attack in the registry');
    for (const aid in reg) for (const s of [reg[aid].tell, ...reg[aid].strike, ...reg[aid].recover]) if (!new RegExp("case '" + s + "'|'" + s + "'").test(code)) bad(f + ': registry state ' + s + ' of ' + aid + ' never appears in the boss code');
    // and the boss picks attacks through the registry (b.begin), not with b.set(<tell>, number)
    if (/\.set\('\w+Tell',/.test(code)) bad(f + ': starts an attack with b.set(...Tell, t): use b.begin(id)');
  }
  if (problems.length) throw new Error(problems.slice(0, 12).join(' | ') + (problems.length > 12 ? ' (+' + (problems.length - 12) + ' more)' : ''));
  const n = Object.values(res.tells).reduce((s, t) => s + Object.keys(t).length, 0);
  return n + ' attacks in the registry, none under 0.45 s, hooks on all five bosses, no instance overrides';
};
