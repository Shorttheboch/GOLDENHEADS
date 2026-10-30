/* ================= HUD v4 ================= */
$('menuGo').addEventListener('click',()=>{if(!$('play').disabled)$('play').click();});
setInterval(()=>{if($('menu').hidden)return;const d=$('play').disabled;$('menuGo').disabled=d;if(d){const t=($('load').textContent||'CARGANDO').toUpperCase();if($('menuLoad').textContent!==t)$('menuLoad').textContent=t;}},200);
// ---- v70: phone start menu from Santi's art (loaded only on touch; if it fails, the old text menu stays) ----
// The stage waits for the art, its fonts and the language, then CSS plays the intro (00-base.css). MM_CUES = the beats of that intro in seconds (menuSfx(name) is the mechanical sound of each).
const MM={ready:false,go:false};
const MM_CUES=[['logo',0.64],['bar',1.1,1.3],['land',1.2],['unfold',1.55],['lock',2.25],['button',2.65]]; // bar at 1.3x: its stop clack lands as the bar finishes (~1.6 s)
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
      if(!matchMedia('(prefers-reduced-motion:reduce)').matches)for(const [n,s,r] of MM_CUES)setTimeout(()=>{try{window.menuSfx&&menuSfx(n,1,r||1);}catch(e){}},s*1000);}
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
function h4proj(p){_hv.copy(p).project(camera);let x=_hv.x,y=_hv.y;const behind=_hv.z>1;if(behind){x=-x;y=-y;if(Math.abs(x)+Math.abs(y)<1e-3)y=-1;}
  const mx=0.86,mt=0.48,mb=-0.56,off=behind||x<-mx||x>mx||y>mt||y<mb;
  if(off){const s=Math.min(Math.abs(x)>1e-4?mx/Math.abs(x):1e9,y>1e-4?mt/y:y<-1e-4?mb/y:1e9);if(behind||s<1){x*=s;y*=s;}}
  return {px:(x+1)/2*innerWidth,py:(1-y)/2*innerHeight,off,ang:Math.atan2(-y*innerHeight,x*innerWidth)*180/Math.PI};}
function h4apply(el,s,ar,base,gap){el.style.left=s.px.toFixed(1)+'px';el.style.top=s.py.toFixed(1)+'px';el.classList.toggle('off',s.off);
  if(s.off&&ar)ar.style.transform=`rotate(${s.ang.toFixed(1)}deg) translateX(${gap}px) rotate(${base}deg)`;}
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
    for(const it of items){if(it.dead)continue;const m=h4mark(i++);m.hidden=false;h4apply(m,it.s,m.children[0],180,24);
      const urg=it.rem<10,lb=m.children[2],tm=m.children[3],txt=it.n+' POR RESCATAR';if(lb.textContent!==txt)lb.textContent=txt;
      tm.style.display=urg?'':'none';if(urg){tm.lastChild.textContent=Math.max(0,Math.ceil(it.rem))+' s';tm.firstChild.style.setProperty('--a',(THREE.MathUtils.clamp(it.rem/10,0,1)*360).toFixed(0)+'deg');}
      m.classList.toggle('urg',it.rem<5);m.classList.toggle('near',!it.s.off&&it.near);
      if(isTouch)m.classList.toggle('mid',!it.s.off&&Math.abs(it.s.px-innerWidth/2)<innerWidth*0.3&&Math.abs(it.s.py-innerHeight/2)<innerHeight*0.32);}} // v63: phones hide the count near the crosshair
  for(;i<HUD4.pool.length;i++)HUD4.pool[i].hidden=true;
  const bod=$('hBod'),atH=P.pos.distanceTo(HATCH)<CFG.depositR,showB=!CINE.on&&P.carry>0&&!atH&&!ZONES[2].nest;bod.hidden=!showB;
  if(showB){h4apply(bod,h4proj(HATCH),bod.children[0],0,28);bod.classList.toggle('call',full);}
  if(ml>=1.3)tutorialEvent('mult');}
