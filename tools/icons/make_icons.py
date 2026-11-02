#!/usr/bin/env python3
"""Icons of the installed game (v75): home-screen icon on iPhone/iPad and Android.

Takes Santi's logo (public/assets/ui/menuui/logo.webp, 1200x810, transparent) as it is, centres it on a near-black square
with a very subtle warm radial glow behind it, and writes public/icons/:

  apple-touch-icon.png     180x180  opaque (iOS rounds the corners itself; transparency would turn black)
  icon-192.png             192x192  purpose "any"
  icon-512.png             512x512  purpose "any"
  icon-maskable-512.png    512x512  purpose "maskable": the logo sits inside the 80 % safe circle (Android crops it to a circle, squircle, ...)

No new artwork and no extra text: only the logo, scaled, on a background. Needs Pillow (pip install pillow).

  python3 tools/icons/make_icons.py          # rewrites public/icons/*.png
"""
import math
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGO = os.path.join(ROOT, 'public', 'assets', 'ui', 'menuui', 'logo.webp')
OUT = os.path.join(ROOT, 'public', 'icons')

EDGE = (4, 3, 2)        # near-black at the corners
GLOW = (44, 29, 11)     # warm gold-brown at the centre: very subtle, the logo is what shines
GLOW_R = 0.95           # the glow fades to nothing at this fraction of the half-width (0.95: just short of the edges)
ANY_FIT = 0.86          # "any" icons: the logo is 86 % of the icon width
GLOW_SHOULDER = 1.6     # how soft the glow's edge is (higher = tighter in the middle)
SAFE_R = 0.40           # maskable: the safe zone is a circle of 40 % of the icon size in radius (80 % across)
SAFE_MARGIN = 0.96      # ... and the logo stays a little inside it
SS = 2                  # supersampling: drawn at 2x and reduced, so the smooth glow does not band


def background(n):
    """Near-black square with a soft warm radial glow in the middle (n x n, RGB)."""
    steps = 255 * 2
    R = n / 2 * GLOW_R
    mask = Image.new('L', (n, n), 0)                        # 255 in the centre (full glow) down to 0 at radius R and beyond
    dr = ImageDraw.Draw(mask)
    for i in range(steps):                                  # concentric discs, outside in: far finer than one grey level
        t = i / (steps - 1)                                 # 0 at the rim ... 1 in the centre
        r = R * (1 - t)
        v = round(255 * t ** GLOW_SHOULDER)
        dr.ellipse((n / 2 - r - 1, n / 2 - r - 1, n / 2 + r, n / 2 + r), fill=v)
    return Image.composite(Image.new('RGB', (n, n), GLOW), Image.new('RGB', (n, n), EDGE), mask)


def enclosing_circle(img):
    """Smallest circle (cx, cy, r) holding every visible pixel of the logo (alpha > 24), so the maskable fit is exact."""
    a = img.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    w, h = a.size
    px = a.load()
    pts = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if px[x, y]]   # every other pixel: plenty for a circle
    # Convex hull (monotone chain), then Ritter-style iteration refined by a coarse search: tiny input, so keep it simple.
    pts = sorted(set(pts))

    def cross(o, p, q):
        return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    hull = lo[:-1] + up[:-1]
    cx = sum(p[0] for p in hull) / len(hull)
    cy = sum(p[1] for p in hull) / len(hull)
    step = max(w, h) / 4
    for _ in range(200):                                    # move the centre towards the farthest point, shrinking steps
        far = max(hull, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
        d = math.hypot(far[0] - cx, far[1] - cy) or 1
        cx += (far[0] - cx) / d * step
        cy += (far[1] - cy) / d * step
        step *= 0.97
    r = max(math.hypot(p[0] - cx, p[1] - cy) for p in hull)
    return cx, cy, r


def make(n, maskable):
    s = n * SS
    bg = background(s).convert('RGBA')
    logo = Image.open(LOGO).convert('RGBA')
    if maskable:
        cx, cy, r = enclosing_circle(logo)
        k = SAFE_R * SAFE_MARGIN * s / r                    # the whole logo inside the safe circle
        cx_t, cy_t = s / 2, s / 2                           # circle centre -> icon centre
    else:
        bb = logo.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        k = ANY_FIT * s / (bb[2] - bb[0])
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2   # visible box centre -> icon centre
        cx_t, cy_t = s / 2, s / 2
    lw, lh = round(logo.width * k), round(logo.height * k)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    bg.alpha_composite(logo, (round(cx_t - cx * k), round(cy_t - cy * k)))
    return bg.resize((n, n), Image.LANCZOS).convert('RGB')   # opaque: no alpha channel at all


def main():
    if not os.path.exists(LOGO):
        sys.exit('logo not found: ' + LOGO)
    os.makedirs(OUT, exist_ok=True)
    for name, n, m in (('apple-touch-icon.png', 180, False), ('icon-192.png', 192, False), ('icon-512.png', 512, False),
                       ('icon-maskable-512.png', 512, True)):
        make(n, m).save(os.path.join(OUT, name), optimize=True)
        print('public/icons/' + name, n + 0, 'x', n, 'maskable' if m else 'any')


if __name__ == '__main__':
    main()
