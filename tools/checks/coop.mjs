// Adding players through G.debug applies the slot rule (four slots: 4; 2+2; 2+1+1; 1+1+1+1) and keeps every token.
export default async ({ page }) => {
  const r = await page.evaluate(() => {
    const D = G.debug, snap = () => D.state().players.map(p => p.slots + ':' + p.items.length).join(' ');
    D.newRun(2); D.give('cobalt_awl'); D.give('ochre_ladle'); D.give('cinder_bell');
    const out = [snap()];
    for (let i = 0; i < 3; i++) { D.addPlayer(); out.push(snap()); }
    out.push(String(D.addPlayer()));
    D.step(60);
    const s = D.state();
    return { out, room: s.room.kind, together: s.players.every(p => Math.abs(p.x - s.players[0].x) < 200) };
  });
  const want = ['4:3', '2:2 2:1', '2:2 1:1 1:0', '1:1 1:1 1:1 1:0', 'false'];
  if (r.out.join('|') !== want.join('|')) throw new Error('got ' + r.out.join(' | ') + ', want ' + want.join(' | '));
  if (!r.together) throw new Error('new players should appear beside player 1');
};
