# Cut a boss's generated sheets and register the skin in the game, in one command.
#   python3 -I tools/art/cut_boss.py <zip or folder> <asset id> --boss <game boss id> --height <standing height in game px>
#          [--attack <attack id>=<sheet> ...] [--fx <kind>=<cell>[,<cell>...] ...] [--scale <sheet>=<factor> ...] [--fps <loop>=<n> ...]
#          [--out DIR] [--fixture] [--preview FILE.jpg] [--no-register]
# The sheets are named as in docs/art/SPRITE_PROMPT_PACK.md section 9 and 10: <asset id>_<sheet>_f<frames>.png, WIDE sheets in parts
# <asset id>_<sheet>_a_f4.png + <asset id>_<sheet>_b_f4.png (cut as one strip, a then b). Sheets: idle move turn hurt stagger enraged defeat fx arena,
# ref (ignored) and any number of attack sheets. What it does:
#   - cuts every sheet into frames and scales ALL of them by one factor (the tallest idle frame becomes 2 x --height pixels, cells are at twice
#     game scale), so an attack's reach never changes the boss's size; --scale <sheet>=<factor> corrects one sheet that was drawn larger or smaller;
#   - writes assets/bosses/<asset id>/<sheet>.png (one strip per sheet, every frame in the same cell, feet 4 px above the bottom edge), fx.png
#     (items centred in their own cell), arena.png (the arena picture, at most 1920 px wide) and strips.json;
#   - writes a contact sheet to --preview (default /tmp/<asset id>_cut.jpg);
#   - registers the skin: one line in js/art/boss_skins.js, in G.bossSkins (G.bossSkinFixtures with --fixture), keyed by the game boss id.
# --attack leap=lunge: the boss's attack `leap` (its id in the attack registry) uses the sheet `lunge`. A sheet named like an attack id needs no mapping.
# --fx wave=0 glob=1,2: the shot kind `wave` is cell 0 of the fx sheet, `glob` cycles cells 1 and 2.
# Needs Python 3 with numpy, Pillow and scipy. Run it with -I on files you downloaded; a zip is unpacked into a new temporary folder.
import sys, os, re, json, glob, shutil, tempfile, zipfile, argparse, importlib.util
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
_spec = importlib.util.spec_from_file_location('cutlib', os.path.join(here, 'cutlib.py')); cutlib = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cutlib)
from PIL import Image

STANDARD = ['idle', 'move', 'turn', 'hurt', 'stagger', 'enraged', 'defeat']
EXPECT = {'idle': (4,), 'move': (6, 8), 'turn': (4,), 'hurt': (4,), 'stagger': (4,), 'enraged': (4,), 'defeat': (6, 8)}

ap = argparse.ArgumentParser(description='Cut a boss\'s generated sheets and register the skin in the game (see the comment at the top of this file).')
ap.add_argument('source'); ap.add_argument('asset')
ap.add_argument('--boss', required=True, help='the game boss id (js/content/boss_*.js), e.g. tollkeeper')
ap.add_argument('--height', type=float, required=True, help='standing height of the boss in game pixels (the strips are cut at twice that)')
ap.add_argument('--attack', action='append', default=[]); ap.add_argument('--fx', action='append', default=[]); ap.add_argument('--scale', action='append', default=[]); ap.add_argument('--fps', action='append', default=[])
ap.add_argument('--out'); ap.add_argument('--fixture', action='store_true'); ap.add_argument('--preview'); ap.add_argument('--no-register', action='store_true')
a = ap.parse_args()
kv = lambda items: dict(x.split('=', 1) for x in items)
ATTACKS, FX, SCALE, FPS = kv(a.attack), kv(a.fx), {k: float(v) for k, v in kv(a.scale).items()}, {k: float(v) for k, v in kv(a.fps).items()}

# ---- the source: a folder, or a zip unpacked into a new folder (member names are checked: no absolute paths, no ..)
src = a.source; tmp = None
if os.path.isfile(src) and src.lower().endswith('.zip'):
    tmp = tempfile.mkdtemp(prefix='bossart_')
    with zipfile.ZipFile(src) as z:
        for m in z.namelist():
            if m.startswith('/') or '..' in m.split('/') or os.path.isabs(m): sys.exit('unsafe name in zip: ' + m)
        z.extractall(tmp)
    src = tmp
files = sorted(f for f in glob.glob(src + '/**/*.png', recursive=True))

# ---- group the sheets: name -> [(part, n, path)]
sheets = {}; arena = None
for f in files:
    base = os.path.basename(f)[:-4]
    m = re.match(r'(?:' + re.escape(a.asset) + r'|ID)_(.+?)(?:_([ab]))?_f(\d+)$', base)
    if not m: continue
    name, part, n = m.group(1), m.group(2) or '', int(m.group(3))
    if name == 'ref': continue
    if name == 'arena': arena = f; continue
    sheets.setdefault(name, []).append((part, n, f))
if 'idle' not in sheets: sys.exit('no %s_idle_f4.png found: the idle sheet sets the scale for the whole boss' % a.asset)

def frames_of(name):
    got = []
    for part, n, f in sorted(sheets[name]):
        g, hazy = cutlib.read_frames(f, n); got += g
    return got

raw = {name: frames_of(name) for name in sheets}
idle_h = max(h for _, h, _, _ in raw['idle']); base_sc = 2.0 * a.height / idle_h
print('idle figure %d px tall in the sheet -> scale %.3f (standing height %.0f game px, cells at twice game scale)' % (idle_h, base_sc, a.height))
scaled = {name: cutlib.scale_frames(raw[name], base_sc * SCALE.get(name, 1.0)) for name in raw}
body = {n: fr for n, fr in scaled.items() if n != 'fx'}
CW, CH = cutlib.cell_size(body)

out = a.out or os.path.join(root, 'assets', 'bosses', a.asset)
os.makedirs(out, exist_ok=True)
for old in glob.glob(out + '/*.png'): os.remove(old)
counts = {}
for name, fr in body.items():
    cutlib.build_strip(fr, CW, CH).save('%s/%s.png' % (out, name)); counts[name] = len(fr)
if 'fx' in scaled:
    FW, FH = cutlib.cell_size({'fx': scaled['fx']}); cutlib.build_strip(scaled['fx'], FW, FH, center_y=True).save(out + '/fx.png'); counts['fx'] = len(scaled['fx'])
if arena:
    im = Image.open(arena).convert('RGB')
    if im.width > 1920: im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
    im.save(out + '/arena.png')
json.dump({'cell': [CW, CH], 'strips': counts}, open(out + '/strips.json', 'w'))
prev = a.preview or '/tmp/%s_cut.jpg' % a.asset
cutlib.preview(out, list(body), CW, CH, prev, cols=8)
print('cell %d x %d (game %d x %d), strips: %s' % (CW, CH, CW / 2, CH / 2, ', '.join('%s %d' % kv_ for kv_ in counts.items())))
for name in STANDARD:
    if name not in counts: print('  missing %s: the game draws the code-drawn boss in that state' % name)
    elif counts[name] not in EXPECT[name]: print('  note: %s has %d frames (the prompt pack asks for %s)' % (name, counts[name], ' or '.join(map(str, EXPECT[name]))))
attack_sheets = [n for n in counts if n not in STANDARD and n not in ('fx', 'props')]
print('  attack sheets: %s' % (', '.join(attack_sheets) or 'none'))
for atk, sh in ATTACKS.items():
    if sh not in counts: sys.exit('--attack %s=%s: there is no sheet %s' % (atk, sh, sh))

# ---- register: one line in js/art/boss_skins.js
if not a.no_register:
    rel = os.path.relpath(out, root).replace(os.sep, '/') + '/'
    entry = {'id': a.asset, 'base': rel, 'h': CH / 2, 'strips': counts}
    if ATTACKS: entry['attacks'] = ATTACKS
    if FX: entry['fx'] = {k: ([int(c) for c in v.split(',')] if ',' in v else int(v)) for k, v in FX.items()}
    if FPS: entry['fps'] = FPS
    table, tag = ('G.bossSkinFixtures', 'boss-skin-fixtures') if a.fixture else ('G.bossSkins', 'boss-skins')
    js = os.path.join(root, 'js', 'art', 'boss_skins.js'); text = open(js).read()
    m = re.search(r'(/\* <%s>[^\n]*\n)(.*?)(\s*/\* </%s> \*/)' % (tag, tag), text, re.S)
    if not m: sys.exit('markers /* <%s> */ ... /* </%s> */ not found in %s' % (tag, tag, js))
    lines = {}
    for ln in m.group(2).splitlines():
        km = re.match(r'\s*"?([A-Za-z0-9_]+)"?\s*:', ln)
        if km: lines[km.group(1)] = ln.rstrip().rstrip(',')
    lines[a.boss] = '  %s: %s' % (a.boss, json.dumps(entry, separators=(', ', ': ')))
    block = m.group(1) + ',\n'.join(lines[k] for k in sorted(lines)) + '\n' + m.group(3).lstrip('\n')
    open(js, 'w').write(text[:m.start()] + block + text[m.end():])
    print('registered %s in %s (%s): %s' % (a.boss, os.path.relpath(js, root), table, json.dumps(entry)))
else:
    print('not registered (--no-register)')
print('contact sheet:', prev)
if tmp: shutil.rmtree(tmp, ignore_errors=True)
