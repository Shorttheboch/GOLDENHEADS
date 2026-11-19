# v94: the detail texture of the rocks (asteroids), made from nothing but noise: tileable, 1024 and 512.
#   python3 tools/rocks/make_rock_tex.py        -> public/assets/tex/rock_1024.jpg, rock_512.jpg  (JPEG 4:4:4)
# One image, three things: R,G = the surface normal (tangent space, x and y), B = how light the stone is there (dust in the hollows is
# darker, edges and flecks lighter). The game lays it on the rocks from three sides (triplanar, 04-ship-hull.js), so the rocks need no UVs.
# It tiles exactly: every layer is built in the frequency domain (random phases) or wrapped by hand.
import numpy as np, os, sys
from PIL import Image
N=1024; rng=np.random.default_rng(94)
fy=np.fft.fftfreq(N)[:,None]*N; fx=np.fft.fftfreq(N)[None,:]*N; F=np.sqrt(fx*fx+fy*fy); F[0,0]=1
def spec(beta,lo=1,hi=N,seed=0):
    r=np.random.default_rng(seed); a=F**(-beta/2.0)*(F>=lo)*(F<=hi); a[0,0]=0
    z=np.fft.ifft2(a*np.exp(2j*np.pi*r.random((N,N)))).real; return (z-z.mean())/z.std()
def blur(z,sig):
    return np.fft.ifft2(np.fft.fft2(z)*np.exp(-2*(np.pi*sig/N)**2*(fx*fx+fy*fy))).real
base=spec(3.2,1,160,1)                       # the big lumps and slopes
mid=spec(2.9,5,140,2)                        # knobbly middle scale
ridge=1-np.abs(spec(2.2,3,60,3))*1.6         # sharp creases where two lumps meet
ridge=np.clip(ridge,0,1)**3
warp=spec(2.4,2,30,4)
crack=np.abs(spec(1.9,4,90,5)+0.35*warp)     # thin dark cracks: where a band of noise crosses zero
crack=np.clip(1-crack*11,0,1)**1.5
crack=blur(crack,1.6)
grain=spec(1.6,40,220,6)                     # sand-paper grain
H=0.62*base+0.20*mid+0.22*ridge-0.34*crack+0.012*grain
# small impact pits, with a soft raised rim (wrapped at the edges)
yy,xx=np.mgrid[0:N,0:N]
for k in range(70):
    cx,cy=rng.random(2)*N; rad=rng.uniform(5,34) if k>6 else rng.uniform(38,70); dep=rng.uniform(0.25,0.6)*(rad/30)**0.5
    dx=(xx-cx+N/2)%N-N/2; dy=(yy-cy+N/2)%N-N/2; d=np.sqrt(dx*dx+dy*dy)/rad
    bowl=np.where(d<1,-np.clip(1-d*d,0,1)**1.5,0)+0.22*np.exp(-((d-1.08)/0.16)**2)
    H+=dep*bowl
H=(H-H.mean())/H.std()
# normal from the slope (wrapped differences), scaled so the median tilt is TILT degrees
H=blur(H,1.1)
gx=(np.roll(H,-1,1)-np.roll(H,1,1))*0.5; gy=(np.roll(H,-1,0)-np.roll(H,1,0))*0.5
TILT=float(sys.argv[1]) if len(sys.argv)>1 else 17   # median tilt of the surface, degrees
S=np.tan(np.radians(TILT))/np.median(np.sqrt(gx*gx+gy*gy)); gx*=S; gy*=S
nz=1/np.sqrt(1+gx*gx+gy*gy); nx=-gx*nz; ny=gy*nz   # y up in the image = +v
# lightness: hollows and cracks darker (dust, shadowed), high edges lighter, plus mottling and a few pale flecks
cav=blur(H,6)-blur(H,28)                      # local height against its surroundings
mott=spec(2.4,2,40,7)
fleck=blur(np.clip(spec(0.2,120,512,8)-2.6,0,1)*2.2,0.7)
L=0.50+0.16*np.tanh(cav*2.2)+0.11*mott+0.05*np.tanh(H)-0.26*crack+fleck*0.6+0.012*grain
L=np.clip(L,0.04,1)
img=np.dstack([nx*0.5+0.5,ny*0.5+0.5,L]); img=(np.clip(img,0,1)*255+0.5).astype(np.uint8)
out=os.path.join(os.path.dirname(__file__),'..','..','public','assets','tex')
im=Image.fromarray(img,'RGB'); im.save(os.path.join(out,'rock_1024.jpg'),quality=88,subsampling=0)
im.resize((512,512),Image.LANCZOS).save(os.path.join(out,'rock_512.jpg'),quality=88,subsampling=0)
for f in ('rock_1024.jpg','rock_512.jpg'): print(f,os.path.getsize(os.path.join(out,f)))
print('tilt: median %.0f deg, p95 %.0f deg'%(np.degrees(np.arccos(np.median(nz))),np.degrees(np.arccos(np.percentile(nz,5)))),'| lightness mean %.2f min %.2f max %.2f'%(L.mean(),L.min(),L.max()))
# a lit preview (sun from the upper left) to look at
lx,ly,lz=-0.5,0.5,0.7; sh=np.clip((nx*lx+ny*ly+nz*lz)/np.sqrt(lx*lx+ly*ly+lz*lz),0,1)
pv=(np.clip(np.dstack([sh*L*1.25,sh*L*1.15,sh*L*1.2]),0,1)*255).astype(np.uint8)
if len(sys.argv)>2: Image.fromarray(np.tile(pv,(1,2,1))[:768]).resize((1024,384)).save(sys.argv[2],quality=88)
