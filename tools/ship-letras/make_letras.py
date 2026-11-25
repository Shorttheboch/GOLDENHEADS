# v100: paints «HEADS» along the top of the fuselage into the textures of ship.glb (base colour + ORM), as a worn off-white paint.
# Santi: «la nave debería llevar el HEADS en el lomo así en blanco, pero no súper blanco para que no brille tanto, un tono más disimulado»
# and «que tenga imperfecciones como el dorado… en el roughness, el metallic, o suciedad dentro de los surcos».
#
#   node tools/ship-letras/dump_fuselage.mjs public/assets/models/ship.glb /tmp/fus.f32
#   python3 tools/ship-letras/make_letras.py --tris /tmp/fus.f32 --glb public/assets/models/ship.glb --font ArchivoBlack.ttf --out /tmp/letras
#   node tools/ship-letras/put_textures.cjs public/assets/models/ship.glb /tmp/letras            (writes the two maps back, geometry untouched)
#
# The font is Archivo Black (SIL Open Font License; npm @fontsource/archivo-black), the closest free match to Santi's reference.
# Placement and size were measured on Santi's top view of his ship (same panel layout as the game texture): «H» behind the canopy,
# «S» at the back of the wing roots, centred on the spine, letters standing toward the ship's right so they read from its left side.
# Model space (glTF): +Y up, nose toward +Z, ship's right = -X.
import argparse, io, json, struct, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('--tris', required=True); ap.add_argument('--glb', required=True); ap.add_argument('--font', required=True)
ap.add_argument('--out', required=True); ap.add_argument('--seed', type=int, default=7)
ap.add_argument('--paint', default='176,174,166', help='paint colour, sRGB 0-255 (off-white, a little warm, not pure white)')
ap.add_argument('--zh', type=float, default=9.28); ap.add_argument('--zs', type=float, default=-7.64)   # along the ship: front of the H, back of the S
ap.add_argument('--h', type=float, default=3.33)                                                      # letter height, across the spine
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
rng = np.random.default_rng(a.seed)

# ---------- textures out of the glb ----------
b = open(a.glb, 'rb').read(); off = 12; J = B = None
while off < len(b):
    l, t = struct.unpack_from('<II', b, off); d = b[off + 8:off + 8 + l]
    if t == 0x4E4F534A: J = json.loads(d)
    else: B = d
    off += 8 + l
def img(name):
    im = next(i for i in J['images'] if i['name'] == name); v = J['bufferViews'][im['bufferView']]
    return Image.open(io.BytesIO(B[v['byteOffset']:v['byteOffset'] + v['byteLength']]))
baseI, ormI, nrmI = img('T_Ship_Fuselage_BaseColor'), img('T_Ship_Fuselage_ORM'), img('T_Ship_Fuselage_Normal')
N = baseI.width; NO = ormI.width
base = np.asarray(baseI.convert('RGB')).astype(np.float32) / 255
orm = np.asarray(ormI.convert('RGB')).astype(np.float32) / 255
nrm = np.asarray(nrmI.convert('RGB')).astype(np.float32) / 255 * 2 - 1

# ---------- texel -> model-space (x, z) on the top of the fuselage ----------
T = np.fromfile(a.tris, dtype=np.float32).reshape(-1, 3, 5)
P = T[:, :, :3]; UV = T[:, :, 3:]
nf = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]); nf /= np.linalg.norm(nf, axis=1, keepdims=True) + 1e-12
cen = P.mean(1)
pad = 0.6
sel = (nf[:, 1] > 0.2) & (cen[:, 1] > 1.5) & (np.abs(cen[:, 0]) < a.h / 2 + pad) & (cen[:, 2] < max(a.zh, a.zs) + pad) & (cen[:, 2] > min(a.zh, a.zs) - pad)
print('top triangles in the letter area', int(sel.sum()), 'of', len(T))
WX = np.full((N, N), np.nan, np.float32); WZ = np.full((N, N), np.nan, np.float32)
def raster(tri_ids, wx, wz, tol=0.0):
    for i in tri_ids:
        uv = UV[i] * N; p = P[i]
        x0, y0 = np.floor(uv.min(0) - 1).astype(int); x1, y1 = np.ceil(uv.max(0) + 1).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, N - 1), min(y1, N - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = uv
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12: continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den; l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den; l3 = 1 - l1 - l2
        e = -tol / max(1.0, np.sqrt(abs(den)))
        m = (l1 >= e) & (l2 >= e) & (l3 >= e)
        if not m.any(): continue
        X = l1 * p[0, 0] + l2 * p[1, 0] + l3 * p[2, 0]; Z = l1 * p[0, 2] + l2 * p[1, 2] + l3 * p[2, 2]
        sy, sx = slice(y0, y1 + 1), slice(x0, x1 + 1)
        wx[sy, sx] = np.where(m, X, wx[sy, sx]); wz[sy, sx] = np.where(m, Z, wz[sy, sx])
raster(np.nonzero(sel)[0], WX, WZ, tol=1.5)   # 1.5 px of overdraw past each triangle: no gold hairline along UV seams
cov = ~np.isnan(WX)
ys, xs = np.nonzero(cov); Y0, Y1, X0, X1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
print('texel box', X0, Y0, X1, Y1, 'texels', int(cov.sum()))

# ---------- the letters (antialiased, sampled in model space) ----------
font = ImageFont.truetype(a.font, 900)
dummy = ImageDraw.Draw(Image.new('L', (10, 10)))
bb = dummy.textbbox((0, 0), 'HEADS', font=font)
L = Image.new('L', (bb[2] - bb[0] + 40, bb[3] - bb[1] + 40), 0); ImageDraw.Draw(L).text((20 - bb[0], 20 - bb[1]), 'HEADS', font=font, fill=255)
L = L.crop(L.getbbox()); Lm = np.asarray(L).astype(np.float32) / 255; LH, LW = Lm.shape
print('letters raster', LW, LH, 'aspect', round(LW / LH, 2), '-> on the ship', round(abs(a.zs - a.zh) / a.h, 2))
def sample(A, fx, fy):   # bilinear, outside = 0
    h, w = A.shape; fx = fx * w - 0.5; fy = fy * h - 0.5
    x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int); tx = fx - x0; ty = fy - y0
    def g(x, y):
        ok = (x >= 0) & (y >= 0) & (x < w) & (y < h)
        return np.where(ok, A[np.clip(y, 0, h - 1), np.clip(x, 0, w - 1)], 0)
    return (g(x0, y0) * (1 - tx) * (1 - ty) + g(x0 + 1, y0) * tx * (1 - ty) + g(x0, y0 + 1) * (1 - tx) * ty + g(x0 + 1, y0 + 1) * tx * ty)
sx = slice(X0, X1); sy = slice(Y0, Y1)
wx = WX[sy, sx]; wz = WZ[sy, sx]; inside = ~np.isnan(wx)
s = (np.nan_to_num(wz) - a.zh) / (a.zs - a.zh)          # 0 at the front of the H, 1 at the back of the S
t = (np.nan_to_num(wx) + a.h / 2) / a.h                  # letter top toward -X (the ship's right)
M = np.where(inside, sample(Lm, s, t), 0).astype(np.float32)

# ---------- noise (texture space; the island is ~100 texels per metre, no stretch) ----------
H_, W_ = M.shape
def fbm(scales, weights, aniso=(1, 1)):
    out = np.zeros((H_, W_), np.float32)
    for sc, w in zip(scales, weights):
        gh, gw = max(2, int(H_ / (sc * aniso[0])) + 2), max(2, int(W_ / (sc * aniso[1])) + 2)
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8)).resize((W_, H_), Image.BICUBIC)
        out += w * (np.asarray(g).astype(np.float32) / 255 - 0.5)
    return out / sum(weights) * 2   # about -1..1
from scipy.ndimage import gaussian_filter
def blur(A, r): return gaussian_filter(A.astype(np.float32), r)

# grooves and rivets: where the normal map leans away from flat (+ the baked AO)
n = nrm[sy, sx]; dev = np.sqrt(n[..., 0] ** 2 + n[..., 1] ** 2)
cav = np.clip((blur(dev, 1.2) - 0.06) / 0.25, 0, 1)
ao = np.asarray(Image.fromarray((orm[..., 0] * 255).astype(np.uint8)).resize((N, N), Image.BILINEAR)).astype(np.float32)[sy, sx] / 255
grime = np.clip(cav * 0.85 + (1 - ao) * 0.8, 0, 1)
grime = np.clip(grime + 0.35 * blur(grime, 3), 0, 1)            # dirt spreads a little out of the seams

mott = fbm([90, 40, 15], [1, 0.6, 0.3])                          # large soft patches of uneven paint
streak = fbm([160, 60], [1, 0.5], aniso=(1, 0.18))               # streaks along the ship (V = along the fuselage in this island)
fine = fbm([6, 3, 1.5], [1, 0.7, 0.5])                           # chip detail
chipN = fbm([28, 10], [1, 0.6]) * 0.7 + fine * 0.3

# chips: more along the letter edges and the panel seams, a few out in the open
Mb = blur(M, 4); edge = np.clip(1 - np.abs(Mb - 0.5) * 2.2, 0, 1)
chipT = 0.62 - 0.30 * edge - 0.22 * cav
chip = np.clip((chipN - chipT) / 0.05, 0, 1)
alpha = np.clip(M * (1 - chip), 0, 1)
alpha *= np.clip(0.93 + 0.07 * mott, 0, 1)                       # thin spots let a hint of gold through

# ---------- base colour ----------
paint = np.array([int(c) for c in a.paint.split(',')], np.float32) / 255
ob = base[sy, sx]
lum = ob @ np.array([0.2126, 0.7152, 0.0722], np.float32)
detail = np.clip(lum / (blur(lum, 5) + 1e-4), 0.55, 1.25)[..., None]   # the panel lines and rivets of the original map, kept in the paint
pc = paint[None, None, :] * (1 + 0.06 * mott[..., None]) * (1 - 0.10 * np.clip(streak, 0, 1)[..., None]) * detail
dirt = np.array([0.30, 0.27, 0.22], np.float32)
pc = pc * (1 - 0.62 * grime[..., None]) + dirt * 0.62 * grime[..., None] * 0.55
pc = np.clip(pc, 0, 1)
nb = ob * (1 - alpha[..., None]) + pc * alpha[..., None]
# a thin dark lip where the paint stops (paint edge / chip edge picks up dirt)
lip = np.clip(blur(alpha, 1.0) - alpha, 0, 1) * 0.9
nb *= (1 - 0.35 * lip[..., None])

# ---------- ORM: R = AO (unchanged), G = roughness, B = metallic (2048: averaged from the 4096 work) ----------
rough_p = np.clip(0.56 + 0.10 * mott + 0.06 * fine + 0.25 * grime + 0.08 * np.clip(streak, 0, 1), 0.35, 0.95)
def down(A):  # 4096 crop -> 2048 crop (box)
    h, w = A.shape[:2]; return A[:h - h % 2, :w - w % 2].reshape(h // 2, 2, w // 2, 2, *A.shape[2:]).mean((1, 3))
k = N // NO
assert k == 2, 'the ORM map is expected at half the size of the base colour'
Xa, Ya = X0 - X0 % 2, Y0 - Y0 % 2
def pad2(A):  # align the crop to even texels before halving
    out = np.zeros((A.shape[0] + (Y0 - Ya) + 1, A.shape[1] + (X0 - Xa) + 1) + A.shape[2:], A.dtype); out[Y0 - Ya:Y0 - Ya + A.shape[0], X0 - Xa:X0 - Xa + A.shape[1]] = A; return out
al2 = down(pad2(alpha)); rp2 = down(pad2(rough_p * alpha)) / np.maximum(al2, 1e-4)
oy, ox = Ya // 2, Xa // 2; h2, w2 = al2.shape
o2 = orm[oy:oy + h2, ox:ox + w2]
o2[..., 1] = o2[..., 1] * (1 - al2) + rp2 * al2
o2[..., 2] = o2[..., 2] * (1 - al2)                              # paint is not metal; chips keep the gold's metal

# ---------- write ----------
out_base = base.copy(); out_base[sy, sx] = nb
orm[oy:oy + h2, ox:ox + w2] = o2
def save(A, ref, name):
    im = Image.fromarray(np.clip(A * 255 + 0.5, 0, 255).astype(np.uint8))
    im.save(os.path.join(a.out, name + '.jpg'), qtables=ref.quantization, subsampling=2, optimize=True)   # same tables and 4:2:0 as the original maps
    print(name, os.path.getsize(os.path.join(a.out, name + '.jpg')))
save(out_base, baseI, 'T_Ship_Fuselage_BaseColor'); save(orm, ormI, 'T_Ship_Fuselage_ORM')
# previews of the area (for checking only)
Image.fromarray(np.clip(nb * 255, 0, 255).astype(np.uint8)).save(os.path.join(a.out, '_base_area.png'))
Image.fromarray(np.clip(np.stack([alpha, grime, chip], -1) * 255, 0, 255).astype(np.uint8)).save(os.path.join(a.out, '_masks_area.png'))
json.dump({'box': [int(X0), int(Y0), int(X1), int(Y1)], 'zh': a.zh, 'zs': a.zs, 'h': a.h, 'paint': a.paint}, open(os.path.join(a.out, 'letras.json'), 'w'))
