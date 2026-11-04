# v82: the red BORRAR button (delete account) from Santi's gold button (public/assets/ui/endui/button.webp -> button-red.webp).
# Every pixel takes the same red hue (356°), so the gold plate AND the blue lights at the ends turn red; the shading, highlights and the
# transparency stay exactly as drawn. A CSS hue-rotate turned the gold red but the blue lights green, and sepia washed it out (compared in v82).
#   python3 tools/ui/make_red_button.py
import os
import numpy as np
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC=os.path.join(ROOT,'public','assets','ui','endui','button.webp');DST=os.path.join(ROOT,'public','assets','ui','endui','button-red.webp')
HUE,S_BASE,S_GAIN,V_GAMMA=356,0.65,0.35,1.08
a=np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)/255
rgb,al=a[...,:3],a[...,3:]
v=rgb.max(-1);s=np.where(v>1e-6,(v-rgb.min(-1))/np.maximum(v,1e-6),0)
S=np.clip(S_BASE+S_GAIN*s,0,1)*np.clip(s*4,0,1)   # coloured pixels get a strong saturation; near-greys (highlights, black lines) stay grey
V=np.clip(v**V_GAMMA,0,1)
h6=HUE/60.0;i=int(h6)%6;f=h6-int(h6)
p,q,t=V*(1-S),V*(1-f*S),V*(1-(1-f)*S)
r,g,b=[(V,t,p),(q,V,p),(p,V,t),(p,q,V),(t,p,V),(V,p,q)][i]
out=np.concatenate([np.stack([r,g,b],-1),al],-1)
Image.fromarray((out*255).round().astype(np.uint8),'RGBA').save(DST,'WEBP',quality=90,method=6)
print(DST,os.path.getsize(DST),'bytes')
