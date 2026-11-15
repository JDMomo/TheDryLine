/* CONTENT: trinkets (bible section 9). One G.defineTrinket per trinket; apply(mods) edits the run's modifier object (G.baseMods in js/game/trinkets.js).
   Each has material tags (mat) and a card line (inter); six enable a materials rule (js/game/combat.js), two are plain (Brass Buckle, Surveyor's Slate).
   A trinket belongs to the whole party, like every run modifier. */
(() => {
'use strict';
const G = window.G;
const def = (id, name, desc, color, mat, inter, apply, drawIcon) => G.defineTrinket({ id, name, desc, color, mat, inter, apply, drawIcon });

def('brass_buckle', 'Brass Buckle', 'One more health pip.', '#b9a77a', ['metal'], 'Plain: no interactions. Conducts like any metal.', m => { m.maxHp += 1; }, ctx => {
  ctx.strokeStyle = '#b9a77a'; ctx.lineWidth = 3; ctx.strokeRect(-8, -6, 16, 12); ctx.fillStyle = '#b9a77a'; ctx.fillRect(-1.5, -6, 3, 12);
});
def('oiled_strap', 'Oiled Strap', 'Your Ground shots slide.', '#8a5a2b', ['slick'], 'Slide: Ground shots start 45% faster and last 50% longer.', m => { m.slick = true; }, ctx => {
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 7, 0.4, 5.9); ctx.stroke();
  ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.arc(5, -5, 2.2, 0, 6.283); ctx.fill();
});
def('whetstone_chip', 'Whetstone Chip', 'A slash strikes sparks.', '#b8b4a6', ['metal', 'spark'], 'Ignite: a slash lights your flammable shot in flight; Flare: it sets off a Sulphur cloud.', m => { m.spark = true; }, ctx => {
  ctx.fillStyle = '#b8b4a6'; ctx.save(); ctx.rotate(-0.4); ctx.fillRect(-9, -4, 18, 8); ctx.restore();
});
def('lead_boot', 'Lead Boot', 'No knockback. 8% slower running.', '#7d8590', ['heavy', 'metal'], 'Anchor: no knockback. Stop: heavy Ground shots halt at you or a wall; Kick: a slash re-sends them.', m => { m.anchor = true; m.knockback = 0; m.speed *= 0.92; }, ctx => {
  ctx.fillStyle = '#7d8590'; ctx.fillRect(-6, -9, 8, 13); ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-6, 9); ctx.lineTo(9, 9); ctx.quadraticCurveTo(9, 3, 2, 4); ctx.closePath(); ctx.fill();
});
def('magnet_tooth', 'Magnet Tooth', 'Metal shots and scrip are drawn in.', '#c04a3a', ['magnetic', 'metal'], 'Pull: metal shots curve to the nearest enemy or open slot; scrip flies in from further.', m => { m.magnetic = true; m.magnet *= 1.6; }, ctx => {
  ctx.strokeStyle = '#c04a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 1, 7, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(-7, 8); ctx.moveTo(7, 1); ctx.lineTo(7, 8); ctx.stroke();
  ctx.fillStyle = '#e9e2cf'; ctx.fillRect(-9, 6, 4, 3); ctx.fillRect(5, 6, 4, 3);
});
def('punch_glove', 'Punch Glove', 'A slash punts your own shots.', '#a07a5a', ['heavy'], 'Punt: a slash launches your shot at 1.5x damage; Shatter: on a brittle shot it breaks it.', m => { m.punt = true; }, ctx => {
  ctx.fillStyle = '#a07a5a'; ctx.beginPath(); ctx.arc(0, -1, 8, 0, 6.283); ctx.fill(); ctx.fillRect(-6, 4, 12, 7);
});
def('brine_flask', 'Brine Flask', 'Metal hits conduct. Fire is doused.', '#5f88a8', ['wet'], 'Conduct: metal hits chain to a second enemy. Douse: sparks cannot light anything.', m => { m.conduct = true; }, ctx => {
  ctx.fillStyle = '#5f88a8'; ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(3, -10); ctx.lineTo(3, -4); ctx.lineTo(8, 8); ctx.lineTo(-8, 8); ctx.lineTo(-3, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9c5a0'; ctx.fillRect(-4, -12, 8, 3);
});
def('surveyors_slate', "Surveyor's Slate", 'The map shows what every branch room holds.', '#6f7f78', ['brittle'], 'Plain: no interactions. A map, not a tool.', m => { m.revealMap = true; }, ctx => {
  ctx.fillStyle = '#6f7f78'; ctx.fillRect(-9, -8, 18, 16); ctx.strokeStyle = '#d9c5a0'; ctx.lineWidth = 1.6; ctx.strokeRect(-9, -8, 18, 16);
  ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(-1, -2); ctx.lineTo(2, 2); ctx.lineTo(6, -4); ctx.stroke();
});
})();
