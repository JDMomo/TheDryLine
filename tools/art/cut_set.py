# Cut generated sprite sheets into uniform strips. usage: cut_set.py <srcdir> <outdir> <prefix> <standing height in output px> <preview.jpg> [anim=factor ...]
# (for a boss use cut_boss.py: one scale for the whole boss, WIDE parts, fx, arena and registration in one command)
import sys, os, glob, json, re, importlib.util
# cutlib.py sits beside this script; it is loaded by path (not by putting this folder on sys.path, where inspect.py would shadow the standard library)
_spec = importlib.util.spec_from_file_location('cutlib', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cutlib.py')); cutlib = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cutlib)
src, out, prefix, TARGET, prev = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
FACT = dict(a.split('=') for a in sys.argv[6:]); os.makedirs(out, exist_ok=True)
frames = {}
for f in sorted(glob.glob(src + '/*.png')):
    m = re.match(r'(?:' + prefix + r'|ID)_(.+)_f(\d+)\.png', os.path.basename(f))
    if not m or m.group(1) == 'ref': continue
    name, n = m.group(1), int(m.group(2))
    got, hazy = cutlib.read_frames(f, n)
    S = max(h for _, h, _, _ in got) / float(FACT.get(name, 1)); sc = TARGET / S
    fr = cutlib.scale_frames(got, sc)
    frames[name] = fr; print(f'{prefix}.{name}: {len(fr)} frames hazy={int(hazy)} scale={sc:.3f} maxw={max(g.width for g, _, _ in fr)} maxh={max(g.height for g, _, _ in fr)}')
CW, CH = cutlib.cell_size(frames)
meta = {'cell': [CW, CH], 'anims': {}}
for name, fr in frames.items():
    cutlib.build_strip(fr, CW, CH).save(f'{out}/{name}.png'); meta['anims'][name] = len(fr)
json.dump(meta, open(out + '/strips.json', 'w')); print(prefix, 'cell', CW, CH)
cutlib.preview(out, list(frames), CW, CH, prev)
