// slow-ish (offline renders of every track and effect): weight lets the runner start it early
export const weight = 40;
// Audio: every track's patterns are valid and export to correct MIDI, the engine builds its graph under a stubbed AudioContext and schedules
// ahead of the clock, nothing plays before a gesture, layer changes land on beat and bar lines, tracks crossfade, the director picks the right
// track and layers (including the boss stems and the Long Clock's borrowed attacks), every sound effect name used exists, every track and
// effect renders (offline, real Web Audio) without clipping or silence, the pause menu's sound sliders work, and the game runs with no audio at all.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- MIDI: parse the files the exporter writes and compare them with the pattern data
function parseMidi(buf) {
  let p = 0; const u32 = () => { const v = buf.readUInt32BE(p); p += 4; return v; };
  if (buf.toString('latin1', 0, 4) !== 'MThd') throw new Error('not a MIDI file');
  p = 8; const fmt = buf.readUInt16BE(p), n = buf.readUInt16BE(p + 2), ppq = buf.readUInt16BE(p + 4); p += 6;
  const tracks = [];
  for (let i = 0; i < n; i++) {
    if (buf.toString('latin1', p, p + 4) !== 'MTrk') throw new Error('missing MTrk');
    p += 4; const len = u32(), end = p + len; let tick = 0, on = 0, off = 0, tempo = null, sig = null, name = '', last = 0, run = 0;
    const vlq = () => { let v = 0, b; do { b = buf[p++]; v = (v << 7) | (b & 127); } while (b & 128); return v; };
    while (p < end) {
      tick += vlq(); let st = buf[p];
      if (st === 0xff) { const type = buf[p + 1]; p += 2; const l = vlq(), d = buf.subarray(p, p + l); p += l; if (type === 0x51) tempo = (d[0] << 16) | (d[1] << 8) | d[2]; if (type === 0x58) sig = [d[0], 1 << d[1]]; if (type === 0x03) name = d.toString('utf8'); continue; }
      if (st & 0x80) { run = st; p++; } else st = run;
      const hi = st & 0xf0;
      if (hi === 0x90) { if (buf[p + 1] > 0) on++; else off++; p += 2; } else if (hi === 0x80) { off++; p += 2; } else if (hi === 0xc0 || hi === 0xd0) p += 1; else p += 2;
      last = tick;
    }
    tracks.push({ tick, last, on, off, tempo, sig, name });
  }
  return { fmt, ppq, tracks };
}

export default async ({ page }) => {
  const notes = [];

  // ---- 1. patterns and MIDI export
  const music = await page.evaluate(() => {
    const M = G.music, out = { order: M.order.slice(), bad: [], info: {} };
    for (const id of ['title', 'hub', 'r1', 'r2', 'r3', 'r4', 'final', 'boss_warden', 'boss_clock', 'win', 'lose']) if (!M.tracks[id]) out.bad.push('missing track ' + id);
    for (const r of Object.keys(G.regionDefs)) if (!M.tracks[M.regionTrack[r]]) out.bad.push('region ' + r + ' has no track');
    for (const id of M.order) {
      const t = M.tracks[id], c = M.compile(t);
      for (const m of M.validate(t)) out.bad.push(m);
      const spb = M.stepsPerBar(t), secs = t.bars * t.sig[0] * 4 / t.sig[1] * 60 / t.bpm;
      if (c.steps !== spb * t.bars) out.bad.push(id + ': compiled length ' + c.steps + ' is not ' + spb * t.bars);
      if (t.loop !== false && (c.loopEndStep !== c.steps || c.loopStartStep !== 0)) out.bad.push(id + ': loop points are not the whole track');
      if (c.layers.length !== t.layers.length) out.bad.push(id + ': layer count');
      for (const L of c.layers) for (const ev of L.events) {
        if (ev.s + ev.len > c.steps) out.bad.push(id + '/' + L.id + ': a note runs past the end of the loop');
        for (const n of ev.n || []) if (!(n >= 24 && n <= 96)) out.bad.push(id + '/' + L.id + ': note ' + n + ' out of range');
      }
      if (!(secs >= 12 && secs <= 90)) out.bad.push(id + ': ' + secs.toFixed(1) + ' s is an odd length');
      out.info[id] = { bpm: t.bpm, sig: t.sig, bars: t.bars, secs, layers: t.layers.length, steps: c.steps, loop: t.loop !== false, variants: Object.keys(M.variants[id] || {}).length };
    }
    return out;
  });
  if (music.bad.length) throw new Error('patterns: ' + music.bad.slice(0, 5).join(' | '));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dryline-midi-'));
  execFileSync('node', [path.join(root, 'tools', 'audio', 'export_midi.mjs'), tmp], { stdio: 'pipe' });
  for (const id of music.order) {
    const f = path.join(tmp, id + '.mid'); if (!fs.existsSync(f)) throw new Error('no MIDI file for ' + id);
    const m = parseMidi(fs.readFileSync(f)), i = music.info[id], ticks = i.steps * 120;
    if (m.fmt !== 1 || m.ppq !== 480) throw new Error(id + ': MIDI header');
    if (m.tracks.length !== i.layers + 1) throw new Error(id + ': ' + m.tracks.length + ' MIDI tracks for ' + i.layers + ' layers');
    const c = m.tracks[0];
    if (Math.abs(60e6 / c.tempo - i.bpm) > 0.01 || c.sig[0] !== i.sig[0] || c.sig[1] !== i.sig[1]) throw new Error(id + ': tempo or time signature wrong (' + 60e6 / c.tempo + ', ' + c.sig + ')');
    if (c.last > ticks || c.tick !== ticks) throw new Error(id + ': loop end marker at ' + c.tick + ', expected ' + ticks);
    m.tracks.slice(1).forEach(t => { if (t.on !== t.off) throw new Error(id + '/' + t.name + ': unbalanced notes'); if (t.last > ticks) throw new Error(id + '/' + t.name + ': a note runs past the loop end'); });
  }
  if (!fs.existsSync(path.join(tmp, 'boss_warden__variant_r2.mid'))) throw new Error('Warden variant files not written');
  fs.rmSync(tmp, { recursive: true, force: true });
  notes.push(music.order.length + ' tracks valid and exported');

  // ---- 2. sound effect names used in the source all exist
  const names = await page.evaluate(() => G.audio.SFX_NAMES);
  const used = new Set(), srcDir = path.join(root, 'js');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
  for (const f of walk(srcDir)) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bsfx\(\s*'([A-Za-z]+)'\s*[,)]/g)) used.add(m[1]);
  const unknown = [...used].filter(n => !names.includes(n));
  if (unknown.length) throw new Error('sound effects used in the code but not defined: ' + unknown.join(', '));
  const required = ['jump', 'doubleJump', 'land', 'dash', 'slash', 'heavyCut', 'hitEnemy', 'enemyDefeat', 'hurt', 'mend', 'cutPierce', 'cutArc', 'cutBurst', 'cutGround', 'slotCrack', 'slotPunch', 'tokenVoid', 'pickupScrip', 'pickupToken', 'propUse', 'door', 'bossIntro', 'bossStagger', 'bossDefeat', 'menuMove', 'menuSelect', 'pause'];
  const missing = required.filter(n => !names.includes(n));
  if (missing.length) throw new Error('missing sound effects: ' + missing.join(', '));
  notes.push(names.length + ' effects, ' + used.size + ' names used in the source');

  // ---- 3. the engine under a stubbed AudioContext, and the director
  const eng = await page.evaluate(async () => {
    const bad = [], ok = (c, m) => { if (!c) bad.push(m); }, D = G.debug, A = G.audio;
    const realAC = window.AudioContext, realWK = window.webkitAudioContext;
    class P { constructor() { this.value = 0; this.calls = []; } setValueAtTime(v, t) { this.value = v; this.calls.push(['set', v, t]); return this; } linearRampToValueAtTime(v, t) { this.calls.push(['lin', v, t]); return this; } exponentialRampToValueAtTime(v, t) { this.calls.push(['exp', v, t]); return this; } setTargetAtTime(v, t, k) { this.calls.push(['target', v, t, k]); return this; } cancelScheduledValues() { return this; } }
    let made = 0, stubCtx = null;
    class Nd {
      constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; ctx.nodes.push(this); for (const k of ['frequency', 'gain', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[k] = new P(); }
      connect(x) { return x; } disconnect() {} start(t) { this.ctx.starts.push({ kind: this.kind, t }); } stop() {} setPeriodicWave() {}
    }
    class Stub {
      constructor() { made++; stubCtx = this; this.nodes = []; this.starts = []; this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 48000; this.destination = new Nd(this, 'destination'); }
      resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); } addEventListener() {}
      createBuffer(c, n) { return { getChannelData: () => new Float32Array(Math.min(n, 64)), length: n }; }
      createPeriodicWave() { return {}; } decodeAudioData() {}
    }
    for (const k of ['Oscillator', 'Gain', 'BiquadFilter', 'BufferSource', 'DynamicsCompressor', 'Convolver', 'Delay', 'StereoPanner']) Stub.prototype['create' + k] = function () { return new Nd(this, k.toLowerCase()); };
    window.AudioContext = Stub; window.webkitAudioContext = undefined; A.reset();
    const names = A.SFX_NAMES;

    // nothing before a gesture
    ok(A.unlocked === false && made === 0, 'a context exists before any gesture');
    ok(A.sfx('jump') === false && A.play('hub') === null, 'sounds played before the first gesture');
    // the first gesture unlocks: a real key event reaches the capture listener
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ' }));
    ok(made === 1 && A.unlocked, 'the first keydown did not create and resume the context (' + made + ')');
    const ctx = stubCtx, e = A.engine; e.debug = true;
    const kinds = k => ctx.nodes.filter(n => n.kind === k).length;
    ok(kinds('dynamicscompressor') === 1 && kinds('convolver') === 2 && kinds('gain') >= 6, 'bus graph incomplete: ' + JSON.stringify({ comp: kinds('dynamicscompressor'), conv: kinds('convolver'), gain: kinds('gain') }));

    // sequencer: schedules ahead, never in the past, never far ahead
    G.state = 'play'; D.newRun(5); D.step(2);
    ctx.currentTime = 1.0; A.update();
    ok(A.current() === 'hub', 'the Junction did not start the hub track: ' + A.current());
    const inst = e.cur; ctx.starts.length = 0; ctx.currentTime = inst.start + 0.5; e.tick();
    const st = ctx.starts.map(s => s.t);
    ok(st.length > 0, 'the sequencer scheduled nothing');
    ok(st.every(t => t >= ctx.currentTime - 0.06 && t <= ctx.currentTime + 0.5), 'notes scheduled outside the look-ahead window: ' + Math.min(...st).toFixed(3) + ' to ' + Math.max(...st).toFixed(3) + ' at ' + ctx.currentTime);

    // layer changes land on beat and bar lines
    const spb = inst.spb, bar = spb * inst.stepDur, beat = M_beatSteps(inst.track) * inst.stepDur;
    function M_beatSteps(T) { return G.music.beatSteps(T); }
    for (const [unit, len, at] of [['beat', beat, 2.371], ['bar', bar, 3.113], ['beat', beat, 5.05], ['bar', bar, 7.99]]) {
      ctx.currentTime = inst.start + at;
      const ch = A.setLayer('lead', unit === 'beat' ? false : true, { when: unit });
      const k = (ch.t - inst.start) / len;
      ok(ch && Math.abs(k - Math.round(k)) < 1e-6, 'layer change not on a ' + unit + ' line (k ' + k + ')');
      ok(ch.t >= ctx.currentTime + 0.09 && ch.t <= ctx.currentTime + len + 0.11, 'layer change at ' + ch.t.toFixed(3) + ' is not the next ' + unit + ' after ' + ctx.currentTime.toFixed(3));
    }
    // no note of a muted layer after its boundary
    e.log.length = 0; ctx.currentTime = inst.start + 20; A.setLayer('chords', true, { when: 'bar' });
    const off = A.setLayer('lead', false, { when: 'bar' });
    for (let i = 0; i < 80; i++) { ctx.currentTime += 0.05; e.tick(); }
    const lateLead = e.log.filter(x => x.layer === 'lead' && x.t >= off.gateT - 1e-6 && x.t < off.gateT + 3), earlyLead = e.log.filter(x => x.layer === 'lead' && x.t < off.t - 1e-6);
    ok(lateLead.length === 0, 'a muted layer kept playing after its bar line (' + lateLead.length + ' notes)');
    ok(earlyLead.length > 0, 'the lead layer played nothing before it was muted (test is not testing)');
    const on = A.setLayer('lead', true, { when: 'bar' }); e.log.length = 0;
    for (let i = 0; i < 80; i++) { ctx.currentTime += 0.05; e.tick(); }
    ok(e.log.some(x => x.layer === 'lead' && x.t >= on.t - 1e-6), 'a layer switched back on never played');
    ok(!e.log.some(x => x.layer === 'lead' && x.t < on.t - 1e-6 && x.t > off.gateT), 'a layer played between its mute and unmute');

    // crossfade, no restart on the same track
    const n0 = e.insts.length; A.play('hub'); ok(e.insts.length === n0 && A.current() === 'hub', 'playing the same track again restarted it');
    D.gotoRoom('main:r1'); D.step(2); ctx.currentTime += 0.2; A.update();
    ok(A.current() === 'r1', 'a Wreck Quay room did not start its track: ' + A.current());
    ok(e.insts.some(i => i.id === 'hub' && i.stopping) && e.cur.id === 'r1', 'the old track did not fade out as the new one began');
    const fades = e.insts.find(i => i.id === 'hub').out.gain.calls.filter(c => c[0] === 'lin' && c[1] < 0.01);
    ok(fades.length === 1, 'no fade-out ramp on the old track');
    // music follows the area: walking room to room inside a region (main rooms, a side branch) keeps the same track instance playing
    const r1inst = e.cur;
    for (const id of ['main:r1', 'branch:r1', 'main:r1']) { D.gotoRoom(id); D.step(2); ctx.currentTime += 0.2; A.update(); ok(A.current() === 'r1' && e.cur === r1inst, id + ' changed the music inside Wreck Quay: ' + A.current()); }
    D.gotoRoom('branch:r1'); D.step(2); ctx.currentTime += 0.2; A.update(); ok(e.layerOn('lead') === false && e.layerOn('perc') === false, 'a side branch did not quieten the region track');
    D.gotoRoom('main:r1'); D.step(2); ctx.currentTime += 0.2; A.update();
    D.gotoRoom('main:r2'); D.step(2); ctx.currentTime += 0.2; A.update(); ok(A.current() === 'r2', 'Signal Reef: ' + A.current());
    G.state = 'pause'; ctx.currentTime += 0.2; A.update(); const f = e.pauseF.frequency.calls.filter(c => c[0] === 'target').pop(); ok(f && f[1] < 2000 && e.paused === 1, 'pausing did not close the music filter');
    G.state = 'play'; ctx.currentTime += 0.2; A.update(); ok(e.paused === 0 && e.pauseF.frequency.calls.filter(c => c[0] === 'target').pop()[1] > 10000, 'resuming did not open the filter');
    // low health in an explore room: lead off, tense on (on the next bar line)
    G.players[0].hp = 1; ctx.currentTime += 0.2; A.update();
    ok(e.layerOn('tense') === true && e.layerOn('lead') === false, 'low health did not swap the lead for the tense layer');
    G.players[0].hp = G.players[0].maxHp; ctx.currentTime += 0.2; A.update(); ok(e.layerOn('tense') === false && e.layerOn('lead') === true, 'tense layer stayed on after healing');

    // a Warden fight: charted open slots have their stems, a punched slot's stem fades on the next bar, the lead lifts, rage and low health add layers
    D.chart('r1', ['pierce', 'arc', 'burst']); D.give('cobalt_awl'); D.startBoss('r1'); D.step(3); ctx.currentTime += 0.3; A.update();
    ok(A.current() === 'boss_warden:r1', 'the Tollkeeper fight did not start the Warden track: ' + A.current());
    const b = G.rooms.current.boss, L = () => e.cur.layers, lo = id => e.layerOn(id), bar2 = e.cur.spb * e.cur.stepDur;
    ok(lo('slot_pierce') === true && lo('slot_arc') === false && lo('slot_ground') === false && lo('slot_burst') === false, 'slot stems do not follow the open slots: ' + ['pierce', 'arc', 'burst', 'ground'].map(c => c + '=' + lo('slot_' + c)));
    ok(lo('rage') === false && lo('lift') === false && lo('tense') === false, 'rage, lift or tense layers started on');
    const sp = b.spots.find(s => s.cls === 'pierce'); sp.broken = true; ctx.currentTime += 0.2; A.update();
    ok(lo('slot_pierce') === false && lo('lift') === true, 'a punched slot did not drop its stem and lift the lead');
    const ch = L().slot_pierce.changes[0]; ok(ch && Math.abs((ch.t - e.cur.start) / bar2 - Math.round((ch.t - e.cur.start) / bar2)) < 1e-6 && Math.abs(ch.gateT - ch.t - bar2) < 1e-6, 'the punched slot stem does not fade over one bar from a bar line');
    b.hp = b.maxHp * 0.4; ctx.currentTime += 0.2; A.update(); ok(lo('rage') === true, 'rage layer did not start below half health');
    G.players[0].hp = 1; ctx.currentTime += 0.2; A.update(); ok(lo('tense') === true, 'low health did not add the tense layer in a fight');
    b.hp = 0; b.state = 'dead'; G.rooms.current.fight = false; ctx.currentTime += 0.2; A.update(); ok(A.current() === 'r1', 'the music did not return to the region track after the Warden fell: ' + A.current());
    G.players[0].hp = G.players[0].maxHp;
    // the Long Clock: borrowed attacks bring in the borrowed Warden's layer
    D.newRun(6); D.step(2); D.startBoss('final'); D.step(3); ctx.currentTime += 0.3; A.update();
    const borrows = G.game.borrows().map(x => x.region);
    ok(A.current() === 'boss_clock', 'the Long Clock did not start its track: ' + A.current());
    for (const r of ['r1', 'r2', 'r3', 'r4']) ok(lo('borrow_' + r) === borrows.includes(r), 'borrow layer ' + r + ' is ' + lo('borrow_' + r) + ' with borrows ' + borrows);
    ok(borrows.length === 4, 'expected four borrowed attacks at the start of a run, got ' + borrows.length);
    // win and lose stings play once
    G.rooms.current.fight = false; G.run.over = 'win'; ctx.currentTime += 0.5; A.update(); ok(A.current() === 'win', 'win sting: ' + A.current());
    const wins = e.insts.filter(i => i.id === 'win').length; ctx.currentTime += 60; e.tick(); A.update(); A.update(); ok(e.insts.filter(i => i.id === 'win').length <= wins, 'the win sting restarted');
    G.run.over = 'dead'; ctx.currentTime += 0.5; A.update(); ok(A.current() === 'lose', 'lose sting: ' + A.current()); G.run.over = false;
    G.state = 'title'; ctx.currentTime += 0.5; A.update(); ok(A.current() === 'title', 'title track: ' + A.current()); G.state = 'play';

    // real files in place of the synth: a full mix, then stems; no synth notes are scheduled for them, a stem fades on a bar line
    G.music.files.title = true; e.buffers.title = { ready: true, stems: {}, mix: {} };
    const f1 = e.play('title', { fade: 0, variant: 'file1' }); ctx.starts.length = 0; ctx.currentTime = f1.start + 1; e.tick();
    ok(f1.mode === 'mix' && (f1.sources || []).length === 1, 'a full-mix file was not started as one source (' + f1.mode + ')');
    ok(ctx.starts.every(s => s.kind === 'buffersource') || ctx.starts.length === 0, 'the synth played notes over a file');
    G.music.files.title = { stems: ['bed', 'lead'] }; e.buffers.title = { ready: true, stems: { bed: {}, lead: {} }, mix: null };
    const f2 = e.play('title', { fade: 0, variant: 'file2' }); ctx.currentTime = f2.start + 0.7;
    ok(f2.mode === 'stems' && f2.sources.length === 2, 'stems were not started as one source each (' + f2.mode + ')');
    const fc = e.setLayer('lead', false, { when: 'bar', inst: f2 }); ok(fc && f2.layers.lead.gain.gain.calls.some(c => c[0] === 'lin' && c[1] < 0.01), 'a stem layer was not faded by gain');
    delete G.music.files.title; delete e.buffers.title; e.play('hub', { fade: 0, variant: 'back' });
    ok(e.play('r1', { fade: 0.2 }).mode === 'synth', 'a track with no file did not fall back to the synth');

    // effects: every name plays; voice cap; unknown names are refused; the hooks reach real names
    ctx.currentTime += 5; let played = 0; for (const n of names) { ctx.currentTime += 1; if (A.sfx(n)) played++; }
    ok(played === names.length, 'only ' + played + ' of ' + names.length + ' effects played');
    ok(A.sfx('noSuchSound') === false, 'an unknown effect name was accepted');
    ctx.currentTime += 5; let n = 0; for (let i = 0; i < 12; i++) if (A.sfx('hitEnemy', { gap: 0 })) n++; ok(n === 4, 'voice cap: ' + n + ' voices of one effect at once');
    for (const cls of Object.keys(G.CLASSES)) ok(names.includes('cut' + cls[0].toUpperCase() + cls.slice(1)), 'no effect for the ' + cls + ' cut');
    const log = [], orig = A.sfx; A.sfx = (nm, o) => { log.push(nm); return orig.call(A, nm, o); };
    D.newRun(7); D.god(false); D.gotoRoom('main:r1'); D.step(30);
    const hold = (a, v) => { G.input.any.forced[a] = v; G.input.sync(); }, press = a => { hold(a, true); D.step(1); hold(a, false); D.step(2); };
    D.unlockAll(); D.setInput(0, { jump: true }); D.step(2); D.setInput(0, { jump: false }); D.step(90);
    D.setInput(0, { attack: true }); D.step(2); D.setInput(0, { attack: false }); D.step(20); D.setInput(0, { dash: true }); D.step(2); D.setInput(0, { dash: false }); D.step(20);
    D.give('cobalt_awl'); D.setInput(0, { item: true }); D.step(2); D.setInput(0, { item: false }); D.step(10);
    G.players[0].inv = 0; G.players[0].hurt(0); D.step(2);
    let en = null; for (const id of Object.keys(G.run.graph.nodes)) { D.gotoRoom(id); D.step(2); en = G.rooms.current.enemies.find(x => !x.dead && !x.def.guard); if (en) break; }
    if (en) { en.damage(1, en.x - 10); en.damage(9999, en.x - 10); }
    G.state = 'pause'; G.menus.open('kb'); press('down'); press('jump'); press('pause');
    D.startBoss('r1'); D.step(2);
    A.sfx = orig;
    for (const want of ['jump', 'slash', 'dash', 'cutPierce', 'hurt', 'enemyDefeat', 'pause', 'menuMove', 'bossIntro']) if (en || !['enemyDefeat'].includes(want)) ok(log.includes(want), 'the game did not trigger "' + want + '" (' + [...new Set(log)].join(' ') + ')');
    for (const nm of new Set(log)) ok(names.includes(nm), 'the game asked for an unknown effect ' + nm);

    // volume, mute, the M key
    A.setVolume('music', 0.3); ok(Math.abs(A.getVolume('music') - 0.3) < 1e-9, 'music volume not stored'); A.setVolume('music', 0.8);
    ok(A.setVolume('bogus', 1) === false && A.setVolume('music', NaN) === false, 'a bad volume call was accepted');
    ok(A.muted === false, 'muted at the start'); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })); ok(A.muted === true, 'M did not mute');
    ok(e.master.gain.calls.filter(c => c[0] === 'target').pop()[1] === 0, 'muting did not close the master'); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })); ok(A.muted === false, 'M did not unmute');

    // the pause menu's sound sliders (Comfort page)
    D.newRun(5); D.step(5); G.state = 'pause'; G.menus.open('kb'); const Mn = G.menus.menu; A.setVolume('master', 0.5); A.setVolume('music', 0.5);
    press('down'); press('down'); press('jump'); ok(Mn.page === 'comfort', 'Comfort did not open'); press('down'); press('down'); press('down');
    press('right'); ok(Math.abs(A.getVolume('master') - 0.6) < 1e-9, 'Right did not raise the master volume: ' + A.getVolume('master'));
    press('left'); press('left'); ok(Math.abs(A.getVolume('master') - 0.4) < 1e-9, 'Left did not lower it');
    press('down'); press('right'); ok(Math.abs(A.getVolume('music') - 0.6) < 1e-9, 'the Music slider did not move');
    press('down'); press('down'); press('jump'); ok(A.muted === true, 'the Sound row did not mute'); press('jump'); ok(A.muted === false, 'the Sound row did not unmute');
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544; G.menus.pause(cv.getContext('2d'));
    press('pause'); ok(Mn.page === 'main', 'Esc did not leave the Comfort page from the sound rows (' + Mn.page + ')');
    A.setVolume('master', 0.9); A.setVolume('music', 0.8);

    window.AudioContext = realAC; window.webkitAudioContext = realWK; A.reset(); G.state = 'play';
    return bad;
  });
  if (eng.length) throw new Error(eng.slice(0, 6).join(' | '));
  notes.push('engine, layers, crossfades and director under a stub');

  // ---- 4. offline renders with the real Web Audio graph: no silence, no clipping, effects end
  const render = await page.evaluate(async () => {
    const bad = [], out = { tracks: {}, sfx: 0 };
    for (const id of G.music.order) {
      const t = G.music.tracks[id], secs = Math.min(6, t.bars * t.sig[0] * 4 / t.sig[1] * 60 / t.bpm), r = await G.audio.renderOffline('track', id, secs);
      if (!r) return { skip: true };
      out.tracks[id] = [+r.peak.toFixed(2), +r.rms.toFixed(3)];
      if (r.peak < 0.05) bad.push(id + ' is silent (peak ' + r.peak.toFixed(3) + ')'); if (r.clipped) bad.push(id + ' clips'); if (r.rms > 0.25) bad.push(id + ' is too loud (rms ' + r.rms.toFixed(2) + ')'); if (r.rms < 0.02) bad.push(id + ' is very quiet (rms ' + r.rms.toFixed(3) + ')');
    }
    for (const n of G.audio.SFX_NAMES) {
      const r = await G.audio.renderOffline('sfx', n, 2.8); out.sfx++;
      if (r.peak < 0.05) bad.push('effect ' + n + ' is silent'); if (r.clipped) bad.push('effect ' + n + ' clips'); if (r.seconds > 2.6) bad.push('effect ' + n + ' lasts ' + r.seconds.toFixed(1) + ' s');
    }
    // many echo effects in a row (a door, a standpipe, tokens, a boss) must still die away: the reverb send once fed back into itself
    const seq = []; for (let i = 0; i < 24; i++) seq.push([['door', 'mend', 'pickupToken', 'slotPunch', 'bossIntro', 'bossDefeat'][i % 6], i * 0.25]);
    const st = await G.audio.renderOffline('sfxSeq', seq, 16, { tailFrom: 13 });
    out.stressTail = +st.tail.toFixed(4);
    if (!(st.peak < 2) || !isFinite(st.rms)) bad.push('a run of echo effects runs away (peak ' + st.peak + ', rms ' + st.rms + '): a feedback loop in the effects graph');
    if (!(st.tail <= 0.003)) bad.push('sound keeps ringing after a run of echo effects (tail peak ' + st.tail.toFixed(3) + ' ten seconds later)');
    out.bad = bad; return out;
  });
  if (!render.skip) {
    if (render.bad.length) throw new Error('render: ' + render.bad.slice(0, 5).join(' | '));
    notes.push('rendered ' + Object.keys(render.tracks).length + ' tracks and ' + render.sfx + ' effects');
  } else notes.push('no OfflineAudioContext: renders skipped');

  // ---- 5. a real gesture with the real AudioContext
  await page.evaluate(() => { G.audio.reset(); });
  await page.keyboard.press('Space');
  const real = await page.evaluate(() => ({ eng: !!G.audio.engine, state: G.audio.state().unlocked }));
  if (!real.eng) throw new Error('a real key press did not create the audio engine');

  // ---- 6. the game runs with no audio at all
  const page2 = await page.context().browser().newPage();
  const errors = [];
  page2.on('pageerror', e => errors.push(String(e))); page2.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page2.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; window.OfflineAudioContext = undefined; window.webkitOfflineAudioContext = undefined; });
  await page2.goto(page.url()); await page2.waitForFunction(() => window.G && window.G.debug);
  const none = await page2.evaluate(() => {
    const bad = [], ok = (c, m) => { if (!c) bad.push(m); }, D = G.debug, A = G.audio;
    ok(A.available === false, 'audio reports available with no AudioContext');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ' }));
    ok(A.unlock() === false && A.unlocked === false, 'unlock claimed success with no AudioContext');
    ok(A.sfx('jump') === false && A.play('hub') === null && A.setLayer('lead', false) === null, 'calls did something with no AudioContext');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    A.setVolume('master', 0.4); A.update(); A.update();
    const hold = (a, v) => { G.input.any.forced[a] = v; G.input.sync(); }, press = a => { hold(a, true); D.step(1); hold(a, false); D.step(2); };
    D.newRun(3); D.unlockAll(); D.step(200); D.setInput(0, { jump: true, attack: true }); D.step(30); D.setInput(0, { jump: false, attack: false });
    G.players[0].inv = 0; G.players[0].hurt(0); D.startBoss('r1'); D.step(300);
    G.state = 'pause'; G.menus.open('kb'); press('down'); press('down'); press('jump'); press('down'); press('down'); press('down'); press('right'); press('pause'); G.state = 'play';
    D.step(30); A.setVolume('master', 0.9);
    return { bad, errors: G.errors.slice() };
  });
  await page2.close();
  if (none.bad.length) throw new Error('no-audio: ' + none.bad.join(' | '));
  if (none.errors.length || errors.length) throw new Error('errors with no audio: ' + none.errors.concat(errors).join(' | '));
  notes.push('runs with no AudioContext');
  return notes.join('; ');
};
