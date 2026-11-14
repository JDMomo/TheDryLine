/* Camera: follows the party centre, clamped to the room. Looks ahead in the facing direction (smoothed) and pans up or down
   (up to C.MOVE.PAN px) when a player holds up or down while standing still, in rooms taller than one screen. */
(() => {
'use strict';
const G = window.G, C = G.C, M = C.MOVE, U = G.util;
let lookX = 0, panY = 0, panT = 0;
G.cam = {
  x: 0, y: 0,
  follow(dt, tx, ty, snap) {
    const maxX = Math.max(0, G.tiles.cols * C.T - C.W), maxY = Math.max(0, G.tiles.rows * C.T - C.H);
    const live = (G.players || []).filter(p => !p.down);
    let dir = 0, want = 0;
    if (live.length && !snap) {
      // the party centre (2 to 4 players) and the party's average facing; the caller's own target is replaced
      tx = live.reduce((s, p) => s + p.x, 0) / live.length; ty = live.reduce((s, p) => s + p.y, 0) / live.length;
      dir = live.reduce((s, p) => s + p.face, 0) / live.length;
      const still = live.find(p => p.onGround && Math.abs(p.vx) < 10 && p.stun <= 0 && (p.in.held.up !== p.in.held.down) && !p.slash);
      if (still && G.tiles.rows > C.CH) { panT += dt; if (panT >= M.PAN_T) want = still.in.held.up ? -M.PAN : M.PAN; } else panT = 0;
    } else { lookX = 0; panY = 0; panT = 0; }
    const k = snap ? 1 : Math.min(1, dt * 7);
    lookX += (dir * M.LOOK - lookX) * Math.min(1, dt * 3);
    panY += (want - panY) * Math.min(1, dt * 6);
    const gx = U.clamp(tx + lookX - C.W / 2, 0, maxX), gy = U.clamp(ty - C.H * 0.6 + panY, 0, maxY);
    G.cam.x = U.clamp(G.cam.x + (gx - G.cam.x) * k, 0, maxX);
    G.cam.y = U.clamp(G.cam.y + (gy - G.cam.y) * k, 0, maxY);
  }
};
})();
