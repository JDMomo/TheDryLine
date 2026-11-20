# Shared cutting code for cut_set.py (enemies) and cut_boss.py (bosses): find the frames of one generated sheet, scale them, lay them out as strips.
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def read_frames(path, n):
    """Cut one sheet into its n frames, in reading order (rows by y, then x).
    Returns ([(RGBA image, figure height, figure centre x inside the image, pixels below the figure)], hazy). Handles transparent and hazy mattes."""
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32); A = im[..., 3] / 255.0
    border = np.concatenate([A[:6].ravel(), A[-6:].ravel(), A[:, :6].ravel(), A[:, -6:].ravel()])
    hazy = np.median(border) > 0.03 or np.percentile(border, 90) > 0.08
    mask = ndi.binary_opening(A > (0.8 if hazy else 0.2), iterations=2 if hazy else 1)
    lab, k = ndi.label(ndi.binary_closing(mask, iterations=2))
    idx = np.arange(1, k + 1); area = ndi.sum(np.ones_like(lab), lab, idx); cen = np.array(ndi.center_of_mass(np.ones_like(lab), lab, idx))
    order = np.argsort(-area); seeds = order[:n]
    sy = sorted(seeds, key=lambda i: cen[i][0]); objs = ndi.find_objects(lab)
    hmax = max(objs[i][0].stop - objs[i][0].start for i in seeds); rows = [[sy[0]]]
    for i in sy[1:]:
        if cen[i][0] - np.mean([cen[j][0] for j in rows[-1]]) > 0.5 * hmax: rows.append([i])
        else: rows[-1].append(i)
    seeds = [i for r in rows for i in sorted(r, key=lambda i: cen[i][1])]
    members = {i: [i] for i in seeds}
    for i in order[n:]:
        if area[i] < 60 or area[i] < 0.004 * area[seeds[0]]: continue
        j = min(seeds, key=lambda s: np.hypot(*(cen[i] - cen[s]))); members[j].append(i)
    got = []
    for s in seeds:
        fm = np.isin(lab, [i + 1 for i in members[s]])
        ys, xs = np.where(fm); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        soft = ndi.binary_dilation(fm, iterations=2)[y0:y1, x0:x1]
        rgba = im[y0:y1, x0:x1].copy(); al = A[y0:y1, x0:x1] * soft
        if hazy: al = np.clip((al - 0.55) / 0.4, 0, 1)
        rgba[..., 3] = al * 255; body = objs[s]
        got.append((Image.fromarray(rgba.astype(np.uint8), 'RGBA'), body[0].stop - body[0].start, (body[1].start + body[1].stop) / 2 - x0, y1 - body[0].stop))
    return got, hazy


def scale_frames(got, sc):
    """[(image, centre x, pixels below)] scaled by sc."""
    fr = []
    for g, h, cx, below in got:
        g2 = g.resize((max(1, round(g.width * sc)), max(1, round(g.height * sc))), Image.LANCZOS); fr.append((g2, round(cx * sc), round(below * sc)))
    return fr


def cell_size(frames):
    """One cell for every frame of every animation: wide enough for the widest figure either side of its centre, tall enough for the tallest."""
    half = max(max(cx, g.width - cx) for fr in frames.values() for g, cx, _ in fr)
    CW = int(np.ceil(2 * half / 8) * 8) + 8
    CH = int(np.ceil(max(g.height for fr in frames.values() for g, _, _ in fr) / 8) * 8) + 8
    return CW, CH


def build_strip(fr, CW, CH, foot=4, center_y=False):
    """Frames side by side, each in a CW x CH cell, figure centred, feet `foot` px above the bottom edge (or the figure centred vertically for effects)."""
    strip = Image.new('RGBA', (CW * len(fr), CH), (0, 0, 0, 0))
    for i, (g, cx, below) in enumerate(fr):
        y = (CH - g.height) // 2 if center_y else max(0, CH - foot - g.height + below)
        strip.alpha_composite(g, (i * CW + CW // 2 - cx, y))
    return strip


def preview(out_dir, names, CW, CH, path, cols=6):
    sheet = Image.new('RGBA', (CW * cols, CH * len(names)), (24, 44, 44, 255))
    for r, name in enumerate(names): sheet.alpha_composite(Image.open('%s/%s.png' % (out_dir, name)).crop((0, 0, CW * cols, CH)), (0, r * CH))
    sheet.convert('RGB').save(path, quality=85)
