# v94: the detail texture of the rocks (asteroids), made from nothing but noise: tileable, 1024 and 512.
#   python3 tools/rocks/make_rock_tex.py [preview.jpg]   -> public/assets/tex/rock_1024.jpg, rock_512.jpg  (JPEG 4:4:4)
# One image, three things: R,G = the surface normal (tangent space, x and y), B = how light the stone is there. The game lays it on the rocks
# from three sides (triplanar, 04-ship-hull.js), so the rocks need no UVs. Everything wraps, so it tiles exactly.
# The look (Santi's reference, 19-11): broken angular rock (flat facets with sharp creases, in two sizes), dust between the outcrops, round
# craters with a raised rim in several sizes, pebbles, a few layered streaks; hollows dark, edges and fresh faces light.
import numpy as np, os, sys
from PIL import Image
from scipy.spatial import cKDTree
N=1024; rng=np.random.default_rng(94)
fy=np.fft.fftfreq(N)[:,None]*N; fx=np.fft.fftfreq(N)[None,:]*N; F=np.sqrt(fx*fx+fy*fy); F[0,0]=1
def spec(beta,lo=1,hi=N,seed=0):
    r=np.random.default_rng(seed); a=F**(-beta/2.0)*(F>=lo)*(F<=hi); a[0,0]=0
    z=np.fft.ifft2(a*np.exp(2j*np.pi*r.random((N,N)))).real; return (z-z.mean())/z.std()
def blur(z,sig): return np.fft.ifft2(np.fft.fft2(z)*np.exp(-2*(np.pi*sig/N)**2*(fx*fx+fy*fy))).real
yy,xx=np.mgrid[0:N,0:N].astype(np.float32); P=np.stack([xx.ravel(),yy.ravel()],1)
def facets(ncell,seed,tilt):
    """broken rock: every cell of a (wrapped) Voronoi pattern is a flat face with its own height and tilt. Returns height, per-cell random, edge distance"""
    r=np.random.default_rng(seed); c=r.random((ncell,2))*N
    cc=np.concatenate([c+[dx,dy] for dx in (-N,0,N) for dy in (-N,0,N)]); t=cKDTree(cc); d,i=t.query(P,k=2); i0=i[:,0]%ncell
    h=r.normal(0,1,ncell); g=r.normal(0,tilt,(ncell,2)); rv=r.random(ncell)
    rel=P-cc[i[:,0]]; size=np.sqrt(N*N/ncell)
    H=h[i0]+(rel*g[i0]).sum(1)/size
    return H.reshape(N,N), rv[i0].reshape(N,N), ((d[:,1]-d[:,0])/size).reshape(N,N)
# where the rock shows (outcrops) and where dust has settled
rocky=np.clip(0.5+0.9*spec(2.6,1,14,11),0,1); rocky=rocky*rocky*(3-2*rocky)
fa,ra,ea=facets(150,1,2.3); fb,rb,eb=facets(1300,2,1.7); fc,rc,ec=facets(7000,3,1.2)
warp=spec(2.4,2,20,4)
strata=np.sin((yy*0.9+xx*0.35+warp*38)*2*np.pi/23)                  # layered rock, bent
rockH=1.0*fa+0.42*fb+0.16*fc+0.10*strata*np.clip(spec(2.5,1,8,12),0,1)
rockH-=0.09*np.exp(-(ea/0.05)**2)+0.05*np.exp(-(eb/0.07)**2)        # the creases between faces are cut in
dustH=0.55*spec(3.0,1,60,5)+0.05*spec(1.4,40,200,6)
H=rocky*rockH+(1-rocky)*(dustH-0.5)
H+=0.5*spec(3.2,1,10,7)
# pebbles on the dust: small domes
for k in range(2600):
    cx,cy=rng.random(2)*N; rad=rng.uniform(1.6,5.5)
    x0,y0=int(cx),int(cy); R=int(rad)+2; ix=np.arange(x0-R,x0+R+1)%N; iy=np.arange(y0-R,y0+R+1)%N
    dx=(np.arange(x0-R,x0+R+1)-cx)[None,:]; dy=(np.arange(y0-R,y0+R+1)-cy)[:,None]; d2=(dx*dx+dy*dy)/(rad*rad)
    H[np.ix_(iy,ix)]+=0.11*(rad/4)*np.clip(1-d2,0,1)**0.6*(1-0.75*rocky[y0%N,x0%N])
# craters: a bowl, a raised rim, a little ejecta; a few big ones, many small
crat=np.zeros((N,N))
def crater(cx,cy,rad,dep):
    R=int(rad*1.9)+2; x0,y0=int(cx),int(cy); ix=np.arange(x0-R,x0+R+1)%N; iy=np.arange(y0-R,y0+R+1)%N
    dx=(np.arange(x0-R,x0+R+1)-cx)[None,:]; dy=(np.arange(y0-R,y0+R+1)-cy)[:,None]; d=np.sqrt(dx*dx+dy*dy)/rad
    prof=np.where(d<1,-(1-d**2.4)*1.0,0)+0.34*np.exp(-((d-1.06)/0.17)**2)+0.08*np.exp(-((d-1.35)/0.3)**2)
    sub=np.ix_(iy,ix); m=np.clip(1.25-d,0,1)                           # inside, the crater replaces what was there (it is younger)
    H[sub]=H[sub]*(1-0.8*np.clip(m*2,0,1))+dep*prof; crat[sub]=np.maximum(crat[sub],np.clip(1-d,0,1))
for k in range(8): crater(*(rng.random(2)*N),rng.uniform(55,118),rng.uniform(1.1,1.6))
for k in range(46): crater(*(rng.random(2)*N),rng.uniform(12,36),rng.uniform(0.5,0.9))
for k in range(420): crater(*(rng.random(2)*N),rng.uniform(2.5,7),rng.uniform(0.16,0.3))
H+=0.012*spec(1.2,60,300,8)
H=blur(H,0.7); H=(H-H.mean())/H.std()
gx=(np.roll(H,-1,1)-np.roll(H,1,1))*0.5; gy=(np.roll(H,-1,0)-np.roll(H,1,0))*0.5
TILT=26; S=np.tan(np.radians(TILT))/np.percentile(np.sqrt(gx*gx+gy*gy),60); gx*=S; gy*=S
gm=np.sqrt(gx*gx+gy*gy); lim=np.tan(np.radians(62)); k=np.minimum(1,lim/np.maximum(gm,1e-6)); gx*=k; gy*=k   # nothing steeper than 62 degrees
nz=1/np.sqrt(1+gx*gx+gy*gy); nx=-gx*nz; ny=gy*nz
# lightness: each face its own grey, dust paler and even, hollows / creases / crater floors dark, rims and high edges light
cav=blur(H,5)-blur(H,24)
face=0.5*(ra-0.5)+0.5*(rb-0.5)
L=0.47+rocky*(0.24*face+0.06*strata)+(1-rocky)*0.05+0.19*np.tanh(cav*2.0)+0.07*spec(2.4,2,30,9)-0.10*crat**0.5
L-=0.07*rocky*np.exp(-(ea/0.05)**2)+0.04*rocky*np.exp(-(eb/0.07)**2)
L+=0.05*np.tanh(blur(H,1.5)-blur(H,4))*3
L=np.clip(L,0.05,1)
img=np.dstack([nx*0.5+0.5,ny*0.5+0.5,L]); img=(np.clip(img,0,1)*255+0.5).astype(np.uint8)
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','public','assets','tex')
im=Image.fromarray(img,'RGB'); im.save(os.path.join(out,'rock_1024.jpg'),quality=86,subsampling=0)
im.resize((512,512),Image.LANCZOS).save(os.path.join(out,'rock_512.jpg'),quality=86,subsampling=0)
for f in ('rock_1024.jpg','rock_512.jpg'): print(f,os.path.getsize(os.path.join(out,f)))
print('tilt: median %.0f deg, p95 %.0f deg'%(np.degrees(np.arccos(np.median(nz))),np.degrees(np.arccos(np.percentile(nz,5)))),'| lightness mean %.2f'%L.mean())
if len(sys.argv)>1:
    lx,ly,lz=-0.55,0.5,0.6; sh=np.clip((nx*lx+ny*ly+nz*lz)/np.sqrt(lx*lx+ly*ly+lz*lz),0,1)
    pv=(np.clip(np.dstack([sh*L*1.5,sh*L*1.38,sh*L*1.3]),0,1)*255).astype(np.uint8); Image.fromarray(pv).save(sys.argv[1],quality=88)
