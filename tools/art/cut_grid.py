# Cut a 4x3 ChatGPT sprite grid on a white background into 12 frames with a soft alpha matte.
# Each frame keeps its x position inside its cell (the sheets are drawn centred), and its feet are moved onto one ground line.
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi

def cells(path, cols=4, rows=3):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = im.shape[:2]; ch, cw = H / rows, W / cols; out = []
    for r in range(rows):
        for c in range(cols):
            y0, y1, x0, x1 = round(r * ch), round((r + 1) * ch), round(c * cw), round((c + 1) * cw)
            out.append(matte(im[y0:y1, x0:x1]))
    return out

def matte(rgb):
    d = 255 - rgb.min(axis=2)                                  # how far from white (0 = white)
    near = d < 28
    lab, k = ndi.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))                              # white connected to the cell border = background
    fig = ndi.binary_opening(~bg, iterations=1)
    lab2, k2 = ndi.label(fig)                                  # drop specks: keep pieces bigger than 0.3% of the largest
    if k2:
        area = ndi.sum(np.ones_like(lab2), lab2, np.arange(1, k2 + 1)); keep = np.where(area >= 0.003 * area.max())[0] + 1
        fig = np.isin(lab2, keep)
    ring = ndi.binary_dilation(fig, iterations=2) & ~ndi.binary_erosion(fig, iterations=1)
    a = np.where(fig, 1.0, 0.0)
    a[ring] = np.clip((d[ring] - 6) / 50, 0, 1)                # soft edge from the colour's distance to white
    a = np.maximum(a, ndi.binary_erosion(fig, iterations=1).astype(float))
    al = a[..., None]; col = np.where(al > 0.02, (rgb - (1 - al) * 255) / np.maximum(al, 0.02), rgb)   # take the white back out of the edge
    rgba = np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

if __name__ == '__main__':
    for p in sys.argv[1:]:
        fr = cells(p)
        print(p, [(f.getbbox()[3] - f.getbbox()[1]) for f in fr], [round((f.getbbox()[0] + f.getbbox()[2]) / 2) for f in fr], [f.getbbox()[3] for f in fr])
