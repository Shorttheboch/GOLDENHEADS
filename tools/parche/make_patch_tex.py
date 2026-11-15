# v89: the HEADS patch texture for the astronaut's chest (parche.webp + parche.json), from Santi's photo of the embroidered patch on the gold jacket.
#
#   python3 tools/parche/make_patch_tex.py <photo.png> [--size 512]
#
# 1) finds the patch circle (black twill + white and red thread, the gold fabric is everything else) and fits a circle to its outline;
# 2) alpha = the circle, plus the red swoosh where it leaves the circle (top right, left end, bottom left), like the real patch;
# 3) crops a square around the circle that holds the swoosh tips, downsamples it to --size and fills the transparent texels with the nearest solid
#    colour (so no gold bleeds into the edge through filtering or mipmaps);
# 4) writes tools/parche/parche.webp (RGBA) and tools/parche/parche.json ({"r": circle radius in UV units, centre at 0.5,0.5}).
# make_patch_glb.cjs puts that texture on the astronaut. Needs python3 with numpy, opencv-python and Pillow (WebP).
import sys, json, os
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
if not args or args[0].startswith('--'): sys.exit(__doc__ if __doc__ else 'usage: make_patch_tex.py <photo.png> [--size 512]')
SRC = args[0]
SIZE = int(args[args.index('--size') + 1]) if '--size' in args else 512

im = cv2.imread(SRC, cv2.IMREAD_COLOR)
if im is None: sys.exit('cannot read ' + SRC)
h, w = im.shape[:2]
hsv = cv2.cvtColor(cv2.GaussianBlur(im, (0, 0), 3), cv2.COLOR_BGR2HSV)
H, S, V = [hsv[..., i].astype(int) for i in range(3)]
# the patch is black (twill), white or red thread; the gold fabric (even its dark folds and pale highlights) is none of these
dark = V < 42
white = (S < 40) & (V > 150)
red = ((H < 7) | (H > 160)) & (S > 110) & (V > 40)
pm = ((dark | white | red)).astype(np.uint8) * 255
pm = cv2.morphologyEx(pm, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
pm = cv2.morphologyEx(pm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
n, lab, st, _ = cv2.connectedComponentsWithStats(pm)
k = lab[h // 2, w // 2]
if k == 0: sys.exit('no patch in the middle of the picture')
cnts, _ = cv2.findContours((lab == k).astype(np.uint8) * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
pts = max(cnts, key=cv2.contourArea)[:, 0, :].astype(float)

def fit(p):
    A = np.c_[2 * p[:, 0], 2 * p[:, 1], np.ones(len(p))]
    s = np.linalg.lstsq(A, (p ** 2).sum(1), rcond=None)[0]
    return s[0], s[1], np.sqrt(s[2] + s[0] ** 2 + s[1] ** 2)

cx, cy, R = fit(pts)
for _ in range(12):  # robust: the swoosh tips stick out of the circle, drop the far points
    d = np.abs(np.hypot(pts[:, 0] - cx, pts[:, 1] - cy) - R)
    cx, cy, R = fit(pts[d < max(3, np.percentile(d, 65))])
print('circle: centre (%.1f, %.1f) radius %.1f px' % (cx, cy, R))

yy, xx = np.mgrid[0:h, 0:w]
rr = np.hypot(xx - cx, yy - cy)
disk = rr <= R - 1.5
# the red swoosh outside the circle: red thread plus its darker edge (dilated a little), only the parts that touch the circle's rim
redm = (((H < 9) | (H > 158)) & (S > 90) & (V > 30)).astype(np.uint8) * 255
redm = cv2.morphologyEx(redm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
redm = cv2.dilate(redm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
n, lab, st, _ = cv2.connectedComponentsWithStats(redm)
ring = (rr > R - 25) & (rr < R + 12)
tips = np.zeros((h, w), bool)
for i in range(1, n):
    comp = lab == i
    if (comp & ring).any() and (comp & (rr > R + 4)).sum() > 200: tips |= comp & (rr > R - 3)
alpha = (disk | tips).astype(np.uint8) * 255
alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
ys, xs = np.nonzero(alpha)
half = max(np.abs(xs - cx).max(), np.abs(ys - cy).max()) + 8  # square around the circle centre that holds every tip
print('tips: %d px outside the circle; square half-size %.1f px = %.3f R' % ((tips & (rr > R)).sum(), half, half / R))

# crop (padding with the edge colour if the square leaves the picture), then downsample
x0, y0 = int(round(cx - half)), int(round(cy - half))
side = int(round(2 * half))
pad = max(0, -x0, -y0, x0 + side - w, y0 + side - h)
crop = lambda a, mode, v=0: cv2.copyMakeBorder(a, pad, pad, pad, pad, mode, value=v)[y0 + pad:y0 + pad + side, x0 + pad:x0 + pad + side]
rgb = cv2.resize(crop(im, cv2.BORDER_REPLICATE), (SIZE, SIZE), interpolation=cv2.INTER_AREA)

def rgba(alpha):
    al = cv2.resize(crop(alpha, cv2.BORDER_CONSTANT), (SIZE, SIZE), interpolation=cv2.INTER_AREA)
    # transparent and edge texels take the colour of the nearest fully solid texel (no gold fringe through filtering or mipmaps)
    solid = (al >= 250).astype(np.uint8)
    _, labels = cv2.distanceTransformWithLabels(1 - solid, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    sy, sx = np.nonzero(solid)
    lut = np.zeros((labels.max() + 1, 3), np.uint8)
    lut[1:len(sy) + 1] = rgb[sy, sx]  # DIST_LABEL_PIXEL numbers the zero pixels of its input (the solid texels) in scan order
    col = np.where(solid[..., None] == 1, rgb, lut[labels])
    return np.dstack([cv2.cvtColor(col, cv2.COLOR_BGR2RGB), al])

out = rgba(alpha)
webp = os.path.join(HERE, 'parche.webp')
Image.fromarray(out, 'RGBA').save(webp, 'WEBP', quality=92, alpha_quality=100, method=6)
r_uv = (R / (2 * half))
json.dump({'r': round(float(r_uv), 5), 'size': SIZE, 'src_circle_px': [round(float(cx), 1), round(float(cy), 1), round(float(R), 1)]},
          open(os.path.join(HERE, 'parche.json'), 'w'), indent=1)
print('wrote %s (%dx%d, %d bytes), circle radius %.4f in UV' % (webp, SIZE, SIZE, os.path.getsize(webp), r_uv))
