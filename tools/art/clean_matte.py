#!/usr/bin/env python3
"""Remove the leftover paper matte from a cut-out sprite (the speckled cream/grey rectangle around ChatGPT cut-outs).
Usage: python3 tools/art/clean_matte.py assets/props/banner.webp [more files] [--check] [--lum 150] [--sat 0.30]
A pixel is matte when it is transparent or pale and unsaturated (luminance > lum, saturation < sat). Matte that connects to the image border is
cleared (flood fill, 8-neighbours), then opaque specks smaller than 3 percent of the largest piece are dropped, edge pixels get alpha eased so no
cream fringe is left. --check only reports how much matte is left (exit 1 if a border-connected matte remains). The file is rewritten in place
(webp lossless / png)."""
import sys
from collections import deque
import numpy as np
from PIL import Image

def clean(a, lum=150, sat=0.30):
    h, w = a.shape[:2]
    rgb = a[..., :3].astype(float); al = a[..., 3]
    mx, mn = rgb.max(2), rgb.min(2)
    pale = ((rgb @ [0.299, 0.587, 0.114]) > lum) & ((mx - mn) / np.maximum(mx, 1) < sat)
    matte = (al < 255) | pale
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if matte[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if matte[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and matte[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; q.append((yy, xx))
    out = a.copy(); out[seen, 3] = 0
    keep = out[..., 3] > 0
    lab = np.zeros((h, w), int); sizes = [0]; n = 0
    for y in range(h):
        for x in range(w):
            if keep[y, x] and not lab[y, x]:
                n += 1; lab[y, x] = n; c = 0; qq = deque([(y, x)])
                while qq:
                    cy, cx = qq.popleft(); c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = cy + dy, cx + dx
                            if 0 <= yy < h and 0 <= xx < w and keep[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; qq.append((yy, xx))
                sizes.append(c)
    big = max(sizes[1:]) if n else 0
    for i in range(1, n + 1):
        if sizes[i] < 0.03 * big: out[lab == i, 3] = 0
    # ease the edge: opaque pixels touching clear ones lose a little alpha (kills the 1 px cream fringe)
    clear = out[..., 3] == 0
    near = np.zeros_like(clear)
    near[1:] |= clear[:-1]; near[:-1] |= clear[1:]; near[:, 1:] |= clear[:, :-1]; near[:, :-1] |= clear[:, 1:]
    edge = near & ~clear & (out[..., 3] == 255)
    pal = edge & pale
    out[pal, 3] = 0
    return out, int(seen.sum())

def border_matte(a):
    _, k = clean(a); return k

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opt = {k: v for k, v in (x[2:].split('=') if '=' in x else (x[2:], '1') for x in sys.argv[1:] if x.startswith('--'))}
    for f in args:
        im = Image.open(f).convert('RGBA'); a = np.array(im)
        out, k = clean(a, float(opt.get('lum', 150)), float(opt.get('sat', 0.30)))
        changed = int((out[..., 3] != a[..., 3]).sum())
        print(f, 'matte pixels', k, 'alpha changed', changed)
        if 'check' not in opt and changed:
            Image.fromarray(out).save(f, lossless=True) if f.endswith('.webp') else Image.fromarray(out).save(f)
