/* ================= HUD v4 ================= */
$('menuGo').addEventListener('click',()=>{if(!$('play').disabled)$('play').click();});
setInterval(()=>{if($('menu').hidden)return;const d=$('play').disabled;$('menuGo').disabled=d;if(d){const t=($('load').textContent||'CARGANDO').toUpperCase();if($('menuLoad').textContent!==t)$('menuLoad').textContent=t;}},200);
// ---- v70: phone start menu from Santi's art (loaded only on touch; if it fails, the old text menu stays) ----
// The stage waits for the art, its fonts and the language, then CSS plays the intro (00-base.css). MM_CUES = the beats of that intro in seconds (menuSfx(name) is the mechanical sound of each).
const MM={ready:false,go:false};
const MM_CUES=[['logo',0.64],['bar',1.1,1.3],['land',1.2],['unfold',1.55],['lock',2.25],['decode',1.9],['button',2.65]]; // bar at 1.3x: its stop clack lands as the bar finishes (~1.6 s)
// v73: the phone has no letter-by-letter decoding: its texts come in one after another (--d 1.9 s ... 2.59 s, 0.28 s each), which is where the decoder sound goes; it is longer (1.5 s) than that (to 2.87 s), so it fades out there
const MM_DECODE_END=2.87;
if(isTouch){
  const mmFail=()=>document.body.classList.add('mmfail');
  const mmFonts=()=>Promise.race([Promise.all([window.MENU_FONTS,loadMod('assets/endui.js').then(m=>new FontFace('TekturE',`url(${m.default.font})`,{weight:'400 900'}).load()).then(f=>{document.fonts.add(f);})].map(p=>Promise.resolve(p).catch(()=>{}))),new Promise(r=>setTimeout(r,3000))]);
  loadMod('assets/menumob.js').then(m=>{const A=m.default,ims=[['mmPanel',A.panel],['mmBar',A.bar],['mmLogo',A.logo],['mmPanelGlow',A.panelGlow,1],['mmBarGlow',A.barGlow,1]];
    // every image loaded and decoded (so the intro never shows half-loaded art), plus the fonts
    Promise.all([...ims.map(([id,src,opt])=>new Promise(res=>{const im=$(id);im.onerror=()=>{if(!opt)mmFail();res();};im.onload=()=>(im.decode?im.decode():Promise.resolve()).catch(()=>{}).then(res);im.src=src;})),mmFonts()])
      .then(()=>{MM.ready=true;});})
   .catch(e=>{console.warn('phone menu art unavailable',e);mmFail();});
  $('mmGo').addEventListener('click',()=>{if(!$('play').disabled)$('play').click();});
  setInterval(()=>{if($('menu').hidden)return;
    if(MM.ready&&!MM.go&&$('langPick').hidden){MM.go=true;$('mobMenu').classList.add('go');$('menu').classList.add('mgo');
      if(!matchMedia('(prefers-reduced-motion:reduce)').matches){for(const [n,s,r] of MM_CUES)setTimeout(()=>{try{window.menuSfx&&menuSfx(n,1,r||1);}catch(e){}},s*1000);
        setTimeout(()=>{try{window.menuSfx&&menuSfx.fade&&menuSfx.fade('decode',0.15);}catch(e){}},MM_DECODE_END*1000);}}
    const d=$('play').disabled;$('mmGo').disabled=d;const t=TR(d?($('load').textContent||'CARGANDO').toUpperCase():'JUGAR');if($('mmGoT').textContent!==t)$('mmGoT').textContent=t;},200);}
const HUD4={art:null,last:{},hot:{},seal:0,fug0:0,cl:[],clT:0,pool:[],score:-1};
const fmtN=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,window.I18N&&I18N.lang==='en'?',':'.');
function h4set(id,v){if(HUD4.last[id]!==v){HUD4.last[id]=v;$(id).textContent=v;return true;}return false;}
function h4hot(id){HUD4.hot[id]=1.6;}
// group the floating cargo into a few rescue spots (one marker each, not one per particle)
function clusterLoose(){const L=[];
  for(let i=0;i<DN;i++){if(!dAlive[i]||dMag[i]||dCap[i])continue;const j=i*3,x=dPos[j],y=dPos[j+1],z=dPos[j+2];let c=null;
    for(const o of L){const dx=x-o.x,dy=y-o.y,dz=z-o.z;if(dx*dx+dy*dy+dz*dz<16){c=o;break;}}
    if(!c){c={x,y,z,n:0,sx:0,sy:0,sz:0,age:-99};L.push(c);}
    c.n++;c.sx+=x;c.sy+=y;c.sz+=z;c.x=c.sx/c.n;c.y=c.sy/c.n;c.z=c.sz/c.n;if(dAge[i]>c.age)c.age=dAge[i];}
  L.sort((a,b)=>b.n-a.n);return L.filter(c=>c.n>=2).slice(0,5);}
function h4mark(i){let m=HUD4.pool[i];if(!m){m=document.createElement('div');m.className='mk';m.hidden=true;
    m.innerHTML='<img class="ar" alt=""><img class="ic" alt=""><div class="lb"></div><div class="tm"><i></i><b></b></div>';$('h4m').appendChild(m);HUD4.pool[i]=m;}
  if(!m.dataset.art&&HUD4.art){const H=HUD4.art;m.dataset.art=1;m.children[0].src=H['flecha-rescate'];m.children[1].src=H['marcador-rescate'];m.querySelector('.tm i').style.backgroundImage=`url(${H['temporizador-anillo']})`;}
  return m;}
const _hv=new THREE.Vector3(),_hc=new THREE.Vector3();
// where a marker goes: on screen, or (off screen / behind) stuck to the edge of the play area with the direction to turn
// v71: also says which edge it is stuck to (ex: left/right, ey: top/bottom, both = a corner) and where the target really is (tx, ty), for h4declutter()
const H4F={mx:0.86,mt:0.48,mb:-0.56}; // the frame markers are clamped to, in NDC
function h4proj(p){_hv.copy(p).project(camera);let x=_hv.x,y=_hv.y;const behind=_hv.z>1;if(behind){x=-x;y=-y;if(Math.abs(x)+Math.abs(y)<1e-3)y=-1;}
  const mx=H4F.mx,mt=H4F.mt,mb=H4F.mb,off=behind||x<-mx||x>mx||y>mt||y<mb,tx=(x+1)/2*innerWidth,ty=(1-y)/2*innerHeight;let ex=0,ey=0;
  if(off){const sx=Math.abs(x)>1e-4?mx/Math.abs(x):1e9,sy=y>1e-4?mt/y:y<-1e-4?mb/y:1e9,s=Math.min(sx,sy);
    if(behind||s<1){if(sx<=sy*1.001)ex=x<0?-1:1;if(sy<=sx*1.001)ey=y<0?-1:1;x*=s;y*=s;}}
  return {px:(x+1)/2*innerWidth,py:(1-y)/2*innerHeight,off,behind,ex,ey,tx,ty,ang:Math.atan2(-y*innerHeight,x*innerWidth)*180/Math.PI};}
function h4arrow(el,deg){const ar=el._ar;if(ar)ar.style.transform=`rotate(${deg.toFixed(1)}deg) translateX(${el._ag}px) rotate(${el._ab}deg)`;}
function h4apply(el,s,ar,base,gap){el.style.left=s.px.toFixed(1)+'px';el.style.top=s.py.toFixed(1)+'px';el.classList.toggle('off',s.off);
  el._s=s;el._ar=ar;el._ab=base;el._ag=gap;
  if(s.off&&ar)h4arrow(el,s.ang);}
// ---- v71: one declutter pass, once a frame, after every marker is where it points (rescue, hold, breach): none may sit on another one.
// Priority (keeps its place): hold, then breach (nearest first), then rescue (biggest count first). A marker that overlaps one already placed
// slides along the screen edge it is stuck to (left/right edge: up or down, top/bottom edge: left or right; a corner may use both) to the nearest free
// spot inside the frame h4proj clamps to; on screen it moves up or down instead. Rescue markers that find no room hide (their count is on the top
// panel); hold and breach markers never hide. PC: also clear of the key hints and the tank. Phone: clear of the two corners tcAvoid() protects.
// To keep it calm: a moved marker stays on its side and in its place while that still works, goes back only with room to spare, and glides to its spot.
const DC={PAD:8,EXTRA:8,EASE:16};
function h4declutter(dt){
  if(state!=='play'||CINE.on)return;
  const W=innerWidth,H=innerHeight,bod=$('hBod'),L=[];
  if(!bod.hidden&&bod._s){bod._k=0;L.push(bod);}
  for(const m of TC.mk)if(!m.hidden&&m._s){m._k=1;L.push(m);} // already nearest first
  const rs=HUD4.pool.filter(m=>!m.hidden&&m._s).sort((a,b)=>b._n-a._n);for(const m of rs){m._k=2;L.push(m);}
  for(const m of HUD4.pool)if(m.hidden&&m._dc)m._dc.hide=0; // (not in use this frame: forget that it was hidden for lack of room)
  if(!L.length)return;
  // read phase: the box of each marker (with its arrow when it is at an edge) relative to the point it hangs from
  const F=L.map(el=>{const r=el.getBoundingClientRect();let l=r.left,t=r.top,rr=r.right,b=r.bottom;
    if(el._s.off&&el._ar){const a=el._ar.getBoundingClientRect();if(a.width||a.height){l=Math.min(l,a.left);t=Math.min(t,a.top);rr=Math.max(rr,a.right);b=Math.max(b,a.bottom);}}
    const cx=parseFloat(el.style.left),cy=parseFloat(el.style.top);return {cx,cy,l:l-cx,t:t-cy,r:rr-cx,b:b-cy};});
  // what is already in the way: PC key hints and tank (boxes) · phone: the corners tcAvoid() keeps markers out of (only the marker centre counts: c)
  const ob=[],PAD=DC.PAD;
  if(!isTouch){const pk=$('pcKeys'),tk=$('hTk');
    if(!pk.hidden){const r=pk.getBoundingClientRect();if(r.width)ob.push({l:r.left-4,t:r.top-4,r:r.right+4,b:r.bottom+4});}
    if(tk){const r=tk.getBoundingClientRect();if(r.width)ob.push({l:r.left-4,t:r.top-4,r:r.right+4,b:r.bottom+4});}}
  else ob.push({l:W-170,t:H-160,r:1e9,b:1e9,c:1},{l:-1e9,t:-1e9,r:100,b:74,c:1});
  for(const id of ['tip','sub']){const e=$(id);if(!e||e.hidden||!e.classList.contains('show')||e.classList.contains('wHide'))continue; // the hint card and the radio line, while they show
    const r=e.getBoundingClientRect();if(r.width>2)ob.push({l:r.left-4,t:r.top-4,r:r.right+4,b:r.bottom+4});}
  const kk=1-Math.exp(-(dt||0.016)*DC.EASE);
  for(let i=0;i<L.length;i++){
    const el=L[i],f=F[i],s=el._s;if(!(f.cx>-1e6&&f.cy>-1e6))continue;
    let d=el._dc;if(!d||Math.hypot(f.cx-d.bx,f.cy-d.by)>160)d=el._dc={dx:0,dy:0,tx:0,ty:0,hide:0,hideT:0,an:'',sd:0}; // far from last frame = another target: start again
    d.bx=f.cx;d.by=f.cy;
    if(d.hide&&d.hideT<0.25){d.hideT+=dt||0.016;el.hidden=true;continue;} // hidden a moment ago: stays hidden a little (no blinking)
    const free=(x,y,pad)=>{for(const o of ob){if(o.c){if(x>=o.l&&x<=o.r&&y>=o.t&&y<=o.b)return false;}
      else if(x+f.l<o.r+pad-0.05&&x+f.r>o.l-pad+0.05&&y+f.t<o.b+pad-0.05&&y+f.b>o.t-pad+0.05)return false;}return true;}; // (0.05: a spot touching its neighbour exactly is free)
    const ovl=(x,y)=>{let a=0;for(const o of ob){if(o.c){if(x>=o.l&&x<=o.r&&y>=o.t&&y<=o.b)a+=1e4;}
      else a+=Math.max(0,Math.min(x+f.r,o.r)-Math.max(x+f.l,o.l))*Math.max(0,Math.min(y+f.b,o.b)-Math.max(y+f.t,o.t));}return a;};
    const moved=Math.abs(d.tx)+Math.abs(d.ty)>1,gp=d.hide?PAD+DC.EXTRA:PAD; // a hidden marker needs room to spare to show again; so does a moved one to go back to its own place
    let tx=0,ty=0,hide=0,an='',sd=0;
    if(!free(f.cx,f.cy,moved?PAD+DC.EXTRA:gp)){
      // the lines it may slide along, each with the centre's allowed range (the clamp frame at an edge, the screen otherwise) and a small cost
      const ax=[];
      if(s.off){if(s.ex)ax.push(['y',(1-H4F.mt)/2*H,(1-H4F.mb)/2*H,0]);if(s.ey)ax.push(['x',(1-H4F.mx)/2*W,(1+H4F.mx)/2*W,0]);
        // hold and breach markers (they never hide) may also step inwards when the edge is crowded (a second row), at a cost
        if(el._k<2&&s.ex&&!s.ey)ax.push(['x',s.ex<0?f.cx:(1-H4F.mx)/2*W,s.ex<0?(1+H4F.mx)/2*W:f.cx,60]);
        if(el._k<2&&s.ey&&!s.ex)ax.push(['y',s.ey<0?(1-H4F.mt)/2*H:f.cy,s.ey<0?f.cy:(1-H4F.mb)/2*H,60]);}
      if(!ax.length){ax.push(['y',8-f.t,H-8-f.b,0]);ax.push(['x',8-f.l,W-8-f.r,40]);}
      const cs=[];
      for(const [a,lo,hi,pen] of ax){const y=a==='y',p0=y?f.cy:f.cx,C=[lo,hi];if(moved&&d.an===a)C.push(p0+(y?d.ty:d.tx));
        for(const o of ob){if(o.c){if(y)C.push(o.t-1,o.b+1);else C.push(o.l-1,o.r+1);}else if(y)C.push(o.t-gp-f.b,o.b+gp-f.t);else C.push(o.l-gp-f.r,o.r+gp-f.l);}
        const lim=el._k===2?(d.hide?1.2:2)*((y?f.b-f.t:f.r-f.l)+PAD):1e9; // a rescue marker only slides two of its own sizes (else it hides; to show again, one and a bit): no hopping across a crowded edge
        for(const q of C){if(q<lo-0.01||q>hi+0.01||Math.abs(q-p0)>lim)continue;const x=y?f.cx:q,yy=y?q:f.cy,sg=Math.sign(q-p0);
          let c=Math.abs(q-p0)+pen;if(d.an===a&&d.sd&&sg&&sg!==d.sd)c+=120;if(moved&&d.an===a&&Math.abs(q-p0-(y?d.ty:d.tx))<5)c-=28; // keep its side and its place
          cs.push({x,y:yy,a,sg,c,ok:free(x,yy,gp)});}}
      let best=null;for(const c of cs)if(c.ok&&(!best||c.c<best.c))best=c;
      if(best){tx=best.x-f.cx;ty=best.y-f.cy;an=best.a;sd=best.sg;}
      else if(el._k===2)hide=1; // no room: the count is on the top panel
      else{let bo=ovl(f.cx,f.cy);for(const c of cs){const o=ovl(c.x,c.y);if(o<bo-1){bo=o;best=c;}}if(best){tx=best.x-f.cx;ty=best.y-f.cy;an=best.a;sd=best.sg;}} // never hide: the least bad spot
    }
    if(hide&&!d.hide)d.hideT=0;else if(hide)d.hideT+=dt||0.016;
    d.tx=tx;d.ty=ty;d.an=an||d.an;d.sd=an?sd:0;d.hide=hide;
    if(hide){el.hidden=true;d.dx=d.dy=0;continue;}
    // glide to it (a short lerp); if the way there is blocked it jumps instead, so two markers never overlap, not even on the way
    let nx=d.dx+(tx-d.dx)*kk,ny=d.dy+(ty-d.dy)*kk;if(Math.abs(nx-tx)<0.6)nx=tx;if(Math.abs(ny-ty)<0.6)ny=ty;
    if((nx!==tx||ny!==ty)&&!free(f.cx+nx,f.cy+ny,2)){nx=tx;ny=ty;}
    d.dx=nx;d.dy=ny;const px=f.cx+nx,py=f.cy+ny;
    if(nx||ny){el.style.left=px.toFixed(1)+'px';el.style.top=py.toFixed(1)+'px';
      if(s.off&&!s.behind){let g=Math.atan2(s.ty-py,s.tx-px)*180/Math.PI-s.ang;g=((g+540)%360)-180;h4arrow(el,s.ang+Math.max(-60,Math.min(60,g)));}} // the arrow still points at the target from its new place
    ob.push({l:px+f.l,t:py+f.t,r:px+f.r,b:py+f.b});
  }
}
function updateHud4(dt,t){
  document.body.classList.toggle('h4off',state!=='play');if(state!=='play')return;
  for(const k in HUD4.hot){HUD4.hot[k]-=dt;$(k).classList.toggle('hot',HUD4.hot[k]>0);}
  // top: trichomes on board, leaks, what is still out there
  h4set('hCargoN',fmtN(Math.max(0,cargo)));
  const k=THREE.MathUtils.clamp(cargo/CFG.cargo,0,1),bar=$('hCargoBar');bar.lastChild.style.setProperty('--r',((1-k)*100).toFixed(2)+'%');
  bar.classList.toggle('leak',CB_.leakT>0);bar.classList.toggle('gain',CB_.gainT>0&&!(CB_.leakT>0));bar.classList.toggle('low',k<0.3);
  const fs=new Set();for(const pa of PATCHES)if(pa.hp<=0)fs.add(pa);for(const s of spiders)if(s.state==='eat'&&s.patch)fs.add(s.patch);const fug=fs.size;
  const ml=Math.round(leakMult()*10)/10;$('hLeak').hidden=!fug;
  if(fug)h4set('hLeakT',fug+(fug===1?' FUGA':' FUGAS')+(ml>=1.1?' · PÉRDIDA ×'+ml.toLocaleString(window.I18N&&I18N.lang==='en'?'en-US':'es-ES',{minimumFractionDigits:1}):''));
  if(HUD4.fug0>0&&fug===0){HUD4.seal=2.2;const s=$('hSeal');s.hidden=false;s.style.animation='none';void s.offsetWidth;s.style.animation='';}
  HUD4.fug0=fug;HUD4.seal-=dt;if(HUD4.seal<=0||fug)$('hSeal').hidden=true;
  const ls=looseCount();$('hRes').hidden=!ls;if(ls&&!TIP.done.suck&&HUD4.cl.some(c=>Math.hypot(c.x-P.pos.x,c.y-P.pos.y,c.z-P.pos.z)<14))tip('suck');if(ls)h4set('hRes',fmtN(ls)+' POR RESCATAR');$('hSep').hidden=!(fug&&ls);
  // score panel
  const tot=score+pts;if(tot!==HUD4.score){const el=$('hScoreN');if(HUD4.score>=0&&tot>HUD4.score){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');h4hot('hScore');}HUD4.score=tot;el.textContent=fmtN(tot);}
  h4set('hKills',String(stats.kills));
  const left=spiders.length+toSpawn,calm=WB.calm&&!inBreak;
  h4set('hRound',inBreak?'RESPIRO · '+Math.ceil(Math.max(0,breakT))+' s':calm?'CALMA · '+Math.ceil(Math.max(0,WB.lull))+' s':'RONDA '+(wave+1)+' · '+left+(left===1?' ENEMIGO':' ENEMIGOS'));
  $('hScore').classList.toggle('brk',inBreak||calm);
  // suit + ship (segmented: snap to whole segments)
  const hp=THREE.MathUtils.clamp(P.hp/CFG.hpMax,0,1),sh=shipHp();
  if(h4set('hSuitN',Math.max(0,Math.ceil(P.hp))+'%'))h4hot('hVit');if(h4set('hShipN',Math.round(sh*100)+'%'))h4hot('hVit');
  $('hSuitB').style.setProperty('--r',((1-Math.ceil(hp*20-1e-6)/20)*100).toFixed(1)+'%');$('hShipB').style.setProperty('--r',((1-Math.ceil(sh*20-1e-6)/20)*100).toFixed(1)+'%');
  const v=$('hVit');v.classList.toggle('low1',hp<0.3);v.classList.toggle('low2',sh<0.35);
  // backpack tank
  if(h4set('hTankN',P.carry+' / '+CFG.tankCap))h4hot('hTank');
  const full=P.carry>=CFG.tankCap,tk=$('hTank');tk.classList.toggle('full',full);tk.classList.toggle('dep',!!P.depActive);
  h4set('hTankS',P.depActive?'DESCARGANDO…':full?'LLENO · VE A BODEGA':P.carry>0?'LLÉVALOS A LA BODEGA':'TRICOMAS RECOGIDOS');
  $('hTankB').style.setProperty('--r',((1-P.carry/CFG.tankCap)*100).toFixed(1)+'%');
  // v64 (PC): the tank as Santi's backpack icon in a gold ring + a bar
  h4set('hTkN',P.carry+' / '+CFG.tankCap);$('hTkB').style.setProperty('--r',((1-P.carry/CFG.tankCap)*100).toFixed(1)+'%');
  {const tk2=$('hTk');tk2.classList.toggle('full',full);tk2.classList.toggle('dep',!!P.depActive);}
  // rescue markers (count + countdown under 10 s) and the hold
  HUD4.clT-=dt;if(HUD4.clT<=0){HUD4.clT=0.25;HUD4.cl=clusterLoose();}else for(const c of HUD4.cl)c.z-=FLOW.dz;
  let i=0;
  if(!CINE.on){const items=HUD4.cl.map(c=>{_hc.set(c.x,c.y,c.z);return {s:h4proj(_hc),n:c.n,rem:CFG.floatLife-c.age,near:P.pos.distanceTo(_hc)<3.5};});
    for(let a=0;a<items.length;a++){const A=items[a];if(A.dead)continue;for(let q=a+1;q<items.length;q++){const B=items[q];if(B.dead)continue;
      if(Math.abs(A.s.px-B.s.px)<96&&Math.abs(A.s.py-B.s.py)<(A.s.off||B.s.off?52:40)){A.n+=B.n;A.rem=Math.min(A.rem,B.rem);A.near=A.near&&B.near;B.dead=1;}}}
    for(const it of items){if(it.dead)continue;const m=h4mark(i++);m.hidden=false;m._n=it.n;h4apply(m,it.s,m.children[0],180,24);
      const urg=it.rem<10,lb=m.children[2],tm=m.children[3],txt=it.n+' POR RESCATAR';if(lb.textContent!==txt)lb.textContent=txt;
      tm.style.display=urg?'':'none';if(urg){tm.lastChild.textContent=Math.max(0,Math.ceil(it.rem))+' s';tm.firstChild.style.setProperty('--a',(THREE.MathUtils.clamp(it.rem/10,0,1)*360).toFixed(0)+'deg');}
      m.classList.toggle('urg',it.rem<5);m.classList.toggle('near',!it.s.off&&it.near);
      if(isTouch)m.classList.toggle('mid',!it.s.off&&Math.abs(it.s.px-innerWidth/2)<innerWidth*0.3&&Math.abs(it.s.py-innerHeight/2)<innerHeight*0.32);}} // v63: phones hide the count near the crosshair
  for(;i<HUD4.pool.length;i++)HUD4.pool[i].hidden=true;
  const bod=$('hBod'),atH=P.pos.distanceTo(HATCH)<CFG.depositR,showB=!CINE.on&&P.carry>0&&!atH&&!ZONES[2].nest;bod.hidden=!showB;
  if(showB){h4apply(bod,h4proj(HATCH),bod.children[0],0,28);bod.classList.toggle('call',full);}
  if(ml>=1.3)tutorialEvent('mult');}
