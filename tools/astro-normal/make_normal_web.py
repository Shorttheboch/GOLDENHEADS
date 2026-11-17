# v92: the astronaut's normal map for the web, from the 4096 bake (16-bit PNG, tangent space, OpenGL / glTF convention: +Y up).
#
#   python3 tools/astro-normal/make_normal_web.py <T_Astronaut_Normal_4k.png> [--sizes 2048,1024] [--q 90]
#
# The bake (Blender, Cycles, HI -> low: NEW_body_HI with the puffer fabric bump -> astronaut_body with the UV map UV_game; see the design doc, v92)
# already has 32 px of margin around every UV island. Each size here is an area downsample in float of the decoded vectors, renormalised
# (so the averaging keeps unit normals), then 8-bit JPEG with 4:4:4 colour (no chroma subsampling: R and G carry separate information; lossy WebP
# and 4:2:0 JPEG are 4:2:0 only and bend the small details up to 25-30 degrees, measured; 4:4:4 q90: mean 1.5, 99% under 9 degrees).
# Writes tools/astro-normal/normal_<size>.jpg.
import sys, os
import numpy as np, cv2
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]
if not a or a[0].startswith('--'): sys.exit('usage: make_normal_web.py <T_Astronaut_Normal_4k.png> [--sizes 2048,1024] [--q 90]')
sizes = [int(s) for s in (a[a.index('--sizes') + 1] if '--sizes' in a else '2048,1024').split(',')]
Q = int(a[a.index('--q') + 1]) if '--q' in a else 90
im = cv2.imread(a[0], cv2.IMREAD_UNCHANGED)
if im is None: sys.exit('cannot read ' + a[0])
im = im[..., :3][..., ::-1].astype(np.float32) / (65535.0 if im.dtype == np.uint16 else 255.0)  # RGB 0..1
n = im * 2 - 1
for S in sizes:
    m = cv2.resize(n, (S, S), interpolation=cv2.INTER_AREA)
    m /= np.maximum(np.linalg.norm(m, axis=2, keepdims=True), 1e-6)
    rgb = np.clip(np.round((m * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)
    out = os.path.join(HERE, 'normal_%d.jpg' % S)
    Image.fromarray(rgb, 'RGB').save(out, 'JPEG', quality=Q, subsampling=0, optimize=True)
    back = np.asarray(Image.open(out).convert('RGB')).astype(np.float32) / 255 * 2 - 1
    back /= np.maximum(np.linalg.norm(back, axis=2, keepdims=True), 1e-6)
    err = np.degrees(np.arccos(np.clip((back * m).sum(2), -1, 1)))
    print('%s: %d bytes, JPEG error vs exact: mean %.2f deg, 99%% %.2f deg' % (out, os.path.getsize(out), err.mean(), np.percentile(err, 99)))
