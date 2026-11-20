#!/usr/bin/env python3
"""Launch screens of the installed game on iPhone (v97): public/icons/splash/*.png + the <link> lines for index.html.

An iPhone that opens the game from the home screen shows a launch screen before the page draws anything. Without one it is
plain white. iOS only uses an image whose size matches the screen exactly (CSS size, pixel ratio and orientation in the media
query), so there is one per iPhone screen and orientation. Each is the near-black background of the icons with Santi's logo in
the middle (the same art as make_icons.py: no new artwork, no text). Android uses the manifest instead (black, with the icon).

iOS reads these when the game is added to the home screen: an icon added before v97 keeps the white screen until it is added again.

  python3 tools/icons/make_splash.py           # rewrites public/icons/splash/*.png and prints the <link> lines
"""
import os
from PIL import Image
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('mk', os.path.join(HERE, 'make_icons.py'))
mk = importlib.util.module_from_spec(spec); spec.loader.exec_module(mk)
OUT = os.path.join(mk.ROOT, 'public', 'icons', 'splash')

# iPhone screens (portrait CSS width x height, pixel ratio): SE / 8, 8 Plus, X-11 Pro / 12-13 mini, XR / 11, XS Max / 11 Pro Max,
# 12-14 / 16e, 12-13 Pro Max / 14 Plus, 14 Pro-16 / 17, 14 Pro Max-16 Plus, 16 Pro, 16 Pro Max / 17 Pro Max, Air
PHONES = [(375, 667, 2), (414, 736, 3), (375, 812, 3), (414, 896, 2), (414, 896, 3), (390, 844, 3), (428, 926, 3),
          (393, 852, 3), (430, 932, 3), (402, 874, 3), (440, 956, 3), (420, 912, 3)]
LOGO_K = 0.46   # the logo is 46 % of the short side wide


def splash(w, h):
    n = max(w, h)
    bg = mk.background(n).crop(((n - w) // 2, (n - h) // 2, (n - w) // 2 + w, (n - h) // 2 + h))
    logo = Image.open(mk.LOGO).convert('RGBA')
    lw = round(min(w, h) * LOGO_K); lh = round(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    bg.paste(logo, ((w - lw) // 2, (h - lh) // 2), logo)
    return bg.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def main():
    os.makedirs(OUT, exist_ok=True)
    lines = []
    for cw, ch, dpr in PHONES:
        for orient in ('portrait', 'landscape'):
            w, h = cw * dpr, ch * dpr
            if orient == 'landscape': w, h = h, w
            name = f'splash-{w}x{h}.png'
            splash(w, h).save(os.path.join(OUT, name), optimize=True)
            lines.append(f'<link rel="apple-touch-startup-image" href="icons/splash/{name}" media="(device-width: {cw}px) and '
                         f'(device-height: {ch}px) and (-webkit-device-pixel-ratio: {dpr}) and (orientation: {orient})">')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
