// Controllers and scrip. (1) The first device to press a button on the title screen is player 1, whatever its index: a lone controller at index 1
// moves player 1 and does not add a second player; a controller at another index joins as player 2. (2) Scrip left on the floor is collected
// when the party leaves the room, not destroyed.
export default async ({ page }) => {
  const res = await page.evaluate(async () => {
    const D = G.debug, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
    const mk = (right, a) => ({ id: 'stub pad', connected: true, axes: [right ? 1 : 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0 && a })) });
    let pads = [null, mk(false, true)];
    navigator.getGamepads = () => pads;
    // title: the real loop reads the lone pad at index 1; A starts the run and that pad is player 1
    for (let i = 0; i < 100 && G.state === 'title'; i++) await new Promise(r => requestAnimationFrame(r));
    ok(G.state === 'play', 'A on the only controller (index 1) did not start the run: ' + G.state);
    pads = [null, mk(false, false)];
    D.step(30);
    const p = G.players[0];
    ok(G.players.length === 1 && p.in.dev === 'pad:1', 'player 1 is not the pad at index 1: ' + p.in.dev);
    G.input.poll(); D.step(30); const x0 = p.x;
    pads = [null, mk(true, false)]; for (let i = 0; i < 40; i++) { G.input.poll(); D.step(3); }
    ok(p.x > x0 + 40, 'player 1 did not move with the pad at index 1: ' + x0 + ' -> ' + p.x);
    pads = [null, mk(false, true)]; for (let i = 0; i < 5; i++) { G.input.poll(); D.step(2); }
    ok(G.players.length === 1, 'the only controller added a second player');
    pads = [null, mk(false, false)]; G.input.poll(); D.step(2);
    pads = [null, mk(false, false), mk(false, true)]; for (let i = 0; i < 3; i++) { G.input.poll(); D.step(2); }
    ok(G.players.length === 2 && G.players[1].in.dev === 'pad:2', 'a second controller did not join as player 2: ' + G.players.length);
    ok(G.players[0].in.dev === 'pad:1', 'player 1 lost its pad');
    pads = [null, mk(false, false), mk(false, false)]; G.input.poll(); D.step(2);
    navigator.getGamepads = () => []; G.input.poll(); G.game.resetParty();
    // scrip on the floor
    D.newRun(4); D.god(true); D.gotoRoom('r1'); D.step(5);
    const before = G.run.shards; G.combat.dropShards(300, 200, 36);
    ok(G.pickups.length > 0, 'no pickups dropped');
    D.gotoRoom('r2');
    ok(Math.abs(G.run.shards - before - 36) < 0.001 && G.pickups.length === 0, 'scrip left in the room was lost: ' + (G.run.shards - before) + ' of 36');
    // leaving by a doorway transition (the real route) as well
    D.gotoRoom('r1'); G.combat.dropShards(300, 200, 20); const s2 = G.run.shards; G.rooms.go(G.run.graph.hub, { start: true }); D.step(60);
    ok(Math.abs(G.run.shards - s2 - 20) < 0.001, 'scrip lost on a room transition: ' + (G.run.shards - s2));
    // a new run starts with none of the old floor scrip
    G.combat.dropShards(300, 200, 50); D.newRun(5); ok(G.run.shards === 0 && G.pickups.length === 0, 'old scrip followed a new run');
    return bad;
  });
  if (res.length) throw new Error(res.slice(0, 5).join(' | '));
  return 'lone pad at index 1 is player 1, join at 2, scrip kept on leaving';
};
