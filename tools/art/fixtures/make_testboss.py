# Throwaway test boss: simple coloured shapes saved as PNG sheets in the sprite prompt pack's format (docs/art/SPRITE_PROMPT_PACK.md section 9),
# so the boss skin pipeline can be tried end to end without any real art. Every frame of every sheet is different (a row of dots counts the frame,
# the colour names the animation), so a wrong frame is visible.
#   python3 -I tools/art/fixtures/make_testboss.py tools/art/fixtures/testboss/sheets
# Then: python3 -I tools/art/cut_boss.py tools/art/fixtures/testboss/sheets testboss --boss tollkeeper --height 120 --out tools/art/fixtures/testboss/strips --fixture
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1] if len(sys.argv) > 1 else 'tools/art/fixtures/testboss/sheets'
os.makedirs(out, exist_ok=True)
CELL = 256
COL = {'idle': (70, 120, 200), 'move': (60, 170, 120), 'turn': (200, 160, 60), 'hurt': (220, 90, 90), 'stagger': (170, 90, 200), 'enraged': (230, 80, 40),
       'defeat': (110, 110, 120), 'charge': (30, 150, 200), 'leap': (200, 200, 60), 'spit': (120, 200, 90)}

def figure(d, ox, oy, name, i, n, lean=0.0, stretch=0.0):
    # one frame in the cell at (ox, oy): body, head, a nose that points right, and i+1 dots over the head
    c = COL.get(name, (150, 150, 150)); dark = tuple(int(v * 0.55) for v in c)
    w = 120 + int(stretch * 50); h = 130 - int(abs(stretch) * 20)
    x0 = ox + CELL // 2 - w // 2 + int(lean * 20); y1 = oy + CELL - 20
    d.rounded_rectangle([x0, y1 - h, x0 + w, y1], 26, fill=c, outline=dark, width=5)
    d.ellipse([x0 + w - 70, y1 - h - 46, x0 + w - 6, y1 - h + 18], fill=c, outline=dark, width=5)
    d.polygon([(x0 + w - 6, y1 - h - 22), (x0 + w + 40, y1 - h - 10), (x0 + w - 6, y1 - h + 2)], fill=(250, 220, 90), outline=dark)    # the nose: faces right
    d.rectangle([x0 + 18, y1, x0 + 46, y1 + 12], fill=dark); d.rectangle([x0 + w - 46, y1, x0 + w - 18, y1 + 12], fill=dark)
    for k in range(i + 1): d.ellipse([x0 + 14 + k * 14, y1 - h - 4, x0 + 26 + k * 14, y1 - h + 8], fill=(255, 255, 255))

def sheet(name, n, across, anim=None, lean=lambda i, n: 0.0, stretch=lambda i, n: 0.0, wide=False, part=None):
    rows = (n + across - 1) // across
    im = Image.new('RGBA', (CELL * across, CELL * rows), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for i in range(n):
        figure(d, (i % across) * CELL, (i // across) * CELL, anim or name, i + (4 if part == 'b' else 0), n, lean(i, n), stretch(i, n))
    fn = os.path.join(out, 'testboss_%s_f%d.png' % (name, n)); im.save(fn); print(fn)

sheet('idle', 4, 4); sheet('move', 6, 3, lean=lambda i, n: (i % 3 - 1) * 0.5)
sheet('turn', 4, 4, lean=lambda i, n: i * 0.4); sheet('hurt', 4, 4, lean=lambda i, n: -0.6 if i < 2 else -1.2)
sheet('stagger', 4, 4, lean=lambda i, n: (i % 2 - 0.5)); sheet('enraged', 4, 4); sheet('defeat', 6, 3, stretch=lambda i, n: -i * 0.15)
# attack sheets: the stretch grows through the wind-up, peaks at the strike, relaxes in the recovery
sheet('leap', 6, 3, stretch=lambda i, n: [0, 0.3, 0.6, 1.0, 0.4, 0.1][i])
sheet('spit', 4, 4, stretch=lambda i, n: [0, 0.5, 1.0, 0.3][i])
# WIDE: a long attack split into parts a and b of 4 frames (the prompt pack names them testboss_charge_a_f4, testboss_charge_b_f4)
for part, off in (('a', 0), ('b', 4)):
    n = 4; im = Image.new('RGBA', (CELL * 4, CELL), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for i in range(n): figure(d, i * CELL, 0, 'charge', i + off, 8, stretch=[0, 0.2, 0.5, 0.8, 1.0, 1.0, 0.5, 0.1][i + off])
    fn = os.path.join(out, 'testboss_charge_%s_f4.png' % part); im.save(fn); print(fn)
# fx: six separate items, 3 across 2 rows, pale cream-white and soft gold (the game tints them)
im = Image.new('RGBA', (CELL * 3, CELL * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
for i in range(6):
    ox, oy = (i % 3) * CELL, (i // 3) * CELL; cx, cy = ox + CELL // 2, oy + CELL // 2; r = 30 + i * 6
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(250, 240, 210), outline=(230, 190, 90), width=6)
    if i % 2: d.polygon([(cx - r, cy), (cx, cy - r - 20), (cx + r + 30, cy), (cx, cy + r + 20)], fill=(250, 230, 160), outline=(230, 190, 90))
im.save(os.path.join(out, 'testboss_fx_f6.png'))
# ref and arena (single pictures)
ref = Image.new('RGBA', (CELL * 2, CELL * 2), (0, 0, 0, 0)); figure(ImageDraw.Draw(ref), CELL // 2, CELL // 2, 'idle', 0, 1); ref.save(os.path.join(out, 'testboss_ref_f1.png'))
arena = Image.new('RGB', (1536, 640), (40, 44, 56)); ad = ImageDraw.Draw(arena); ad.rectangle([0, 500, 1536, 640], fill=(24, 26, 34)); ad.line([0, 500, 1536, 500], fill=(90, 96, 120), width=4)
arena.save(os.path.join(out, 'testboss_arena_f1.png'))
print('done')
