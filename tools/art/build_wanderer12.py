# Build the Wanderer's 12-frame strips from the ChatGPT grid sheets (see tools/art/README.md).
# Usage: python3 -I tools/art/build_wanderer12.py idle=<png> run=<png> jump=<png> attack=<png> hurtko=<png>
# Frames are 192 x 136 (twice game scale), feet 4 px above the bottom edge, the same as the older strips, so they mix.
import sys, os, numpy, scipy.ndimage
from PIL import Image
sys.path.append(os.path.dirname(os.path.abspath(__file__))); from cut_grid import cells

FW, FH, FOOT, STAND = 192, 136, 4, 119            # STAND = the standing figure's height in strip pixels (matches the older idle)
args = dict(a.split('=', 1) for a in sys.argv[1:]); out = 'assets/player/'; prev = 'tools/shots/anim12/'; os.makedirs(prev, exist_ok=True)

def scale_for(fr):
    hs = sorted(f.getbbox()[3] - f.getbbox()[1] for f in fr); return STAND / hs[len(hs) // 2]

def place(f, s):
    g = f.resize((round(f.width * s), round(f.height * s)), Image.LANCZOS); b = g.getbbox()
    cell = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    cell.alpha_composite(g, (FW // 2 - g.width // 2, max(0, FH - FOOT - b[3])))   # x kept as drawn in its cell, feet on the ground line
    return cell

def strip(name, frames):
    im = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames): im.alpha_composite(f, (i * FW, 0))
    im.save(out + name + '.png', optimize=True)
    gif = [Image.alpha_composite(Image.new('RGBA', (FW, FH), (40, 52, 58, 255)), f).convert('P', palette=Image.ADAPTIVE) for f in frames]
    gif[0].save(prev + name + '.gif', save_all=True, append_images=gif[1:], duration=80, loop=0, disposal=2)
    print(name, im.size)

s = None
if 'idle' in args:
    fr = cells(args['idle']); s = scale_for(fr); strip('idle', [place(f, s) for f in fr])
s = s or 0.36
for key, name in (('run', 'run'), ('jump', 'jump'), ('attack', 'swing')):
    if key in args: strip(name, [place(f, s) for f in cells(args[key])])
if 'hurtko' in args:
    fr = [place(f, s) for f in cells(args['hurtko'])]
    strip('hurt', fr[0:4]); strip('ko', fr[4:12]); strip('revive', [fr[10], fr[8], fr[6], fr[4]])
print('scale', s)
