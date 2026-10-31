// ---- touch controls (v54): only when the primary pointer is a finger (isTouch). The PC input above is untouched ----
// left half: floating stick · right half: drag to look · SHOOT button: hold to fire, drag it to aim · pause top-left
// every finger is tracked by its pointerId, so moving, looking and shooting work at the same time
const st={x:0,y:0},_tcF=new THREE.Vector3(),_tcV=new THREE.Vector3(),_tcV2=new THREE.Vector3(),_tcT=new THREE.Vector3(),_tcW=new THREE.Vector3(),_tcN=new THREE.Vector3(),_tcD=new THREE.Vector3();
const TC={stickId:null,lookId:null,fireId:null,last:{},ox:0,oy:0,mag:0,ang:0,R:62,boost:false,aim:false,paused:false,ap:null,wPaused:false,mk:[],wSlow:false,
  push:{on:false,ang:0,relT:-9,relAng:0}};
const TC_SENS=0.006; // v56: was 0.0045 — Santi had to slide too far to turn
let _tcAimP=null,_tcAimHit=false;const _tcAimV=new THREE.Vector3(); // body of the spider (or egg / Incinerator core) under the crosshair, for the aim help
// drag to look: faster swipes turn proportionally more (up to 2.2x), slow drags stay precise; the view slows down while the crosshair is on a spider
function tcLook(dx,dy){const sp=Math.hypot(dx,dy),k=TC_SENS*(1+Math.min(1.2,Math.max(0,(sp-4)/25)))*(TC.aim?0.4:1);
  P.yaw-=dx*k;P.pitch-=dy*k;lookInput=performance.now();}
function tcStick(x,y){let dx=x-TC.ox,dy=y-TC.oy;const l=Math.hypot(dx,dy);if(l>TC.R){dx*=TC.R/l;dy*=TC.R/l;}
  st.x=dx/TC.R;st.y=dy/TC.R;TC.mag=Math.min(1,l/TC.R);if(l>4)TC.ang=Math.atan2(dy,dx);$('tKnob').style.transform=`translate(${dx}px,${dy}px)`;tcPush();}
// boost = double push: push to the edge (>80 %), ease off, push again the same way (±35°) within 0.3 s, and keep it there.
// Like Shift on PC: the second push gives the quick impulse, holding it keeps the extra speed.
function tcPush(){const now=performance.now()/1000,P2=TC.push;
  if(!P2.on&&TC.mag>=0.8){P2.on=true;P2.ang=TC.ang;
    if(now-P2.relT<0.3&&Math.abs(angDiff(TC.ang,P2.relAng))<0.61&&state==='play'){TC.boost=true;dashReq=true;}}
  else if(P2.on){if(TC.mag>=0.5)P2.ang=TC.ang;else{P2.on=false;P2.relT=now;P2.relAng=P2.ang;TC.boost=false;}}
  $('tStick').classList.toggle('boost',TC.boost);}
function tcStickEnd(){TC.stickId=null;st.x=st.y=0;TC.mag=0;tcPush();$('tStick').classList.remove('on');$('tKnob').style.transform='';}
function tcReset(){TC.stickId=TC.lookId=TC.fireId=null;st.x=st.y=0;TC.mag=0;TC.boost=false;TC.push.on=false;inp.fire=false;
  $('tStick').classList.remove('on','boost');$('tKnob').style.transform='';$('tFire').classList.remove('on');}
{const tz=$('tZone');
 tz.addEventListener('pointerdown',e=>{if(!isTouch||state!=='play'||TC.paused)return;e.preventDefault();
   if(e.clientX<innerWidth*0.5){if(TC.stickId!==null)return;TC.stickId=e.pointerId;TC.ox=e.clientX;TC.oy=e.clientY;
     const s=$('tStick');s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';s.classList.add('on');tcStick(e.clientX,e.clientY);}
   else{if(TC.lookId!==null)return;TC.lookId=e.pointerId;}
   TC.last[e.pointerId]=[e.clientX,e.clientY];try{tz.setPointerCapture(e.pointerId);}catch(_){}});
 tz.addEventListener('pointermove',e=>{const L=TC.last[e.pointerId];if(!L)return;
   if(e.pointerId===TC.stickId)tcStick(e.clientX,e.clientY);else if(e.pointerId===TC.lookId)tcLook(e.clientX-L[0],e.clientY-L[1]);
   TC.last[e.pointerId]=[e.clientX,e.clientY];});
 const up=e=>{delete TC.last[e.pointerId];if(e.pointerId===TC.stickId)tcStickEnd();if(e.pointerId===TC.lookId)TC.lookId=null;};
 tz.addEventListener('pointerup',up);tz.addEventListener('pointercancel',up);
 // SHOOT: pressing fires; dragging the same finger turns the view too
 const fb=$('tFire');
 fb.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(state!=='play'||TC.paused||TC.fireId!==null)return;TC.fireId=e.pointerId;TC.last[e.pointerId]=[e.clientX,e.clientY];
   inp.fire=true;fb.classList.add('on');try{fb.setPointerCapture(e.pointerId);}catch(_){}});
 fb.addEventListener('pointermove',e=>{if(e.pointerId!==TC.fireId)return;const L=TC.last[e.pointerId];tcLook(e.clientX-L[0],e.clientY-L[1]);TC.last[e.pointerId]=[e.clientX,e.clientY];});
 const fUp=e=>{if(e.pointerId!==TC.fireId)return;delete TC.last[e.pointerId];TC.fireId=null;inp.fire=false;fb.classList.remove('on');};
 fb.addEventListener('pointerup',fUp);fb.addEventListener('pointercancel',fUp);fb.addEventListener('contextmenu',e=>e.preventDefault());
 $('tPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(state==='play')tcSetPause(true);});
 for(const btn of $('tPauseM').querySelectorAll('button'))btn.addEventListener('click',e=>{e.stopPropagation();const a=btn.dataset.a;
   if(a==='go')tcSetPause(false);
   else if(a==='next'){if(inBreak||WB.calm){skipReq=true;tcSetPause(false);}}
   else if(a==='tut'){mtutAgain();} // v66: see the tutorial again
   else if(a==='mus'){musicOn=!musicOn;musicTick();tcPauseLabels();} // v73: the game is paused (sound suspended): set the music level now, not after CONTINUAR
   else if(a==='vo'){voOn=!voOn;if(!voOn&&voSrc){try{voSrc.stop();}catch(_){}$('sub').classList.remove('show');if(MHUD.on)window.HUD.hideSay();}tcPauseLabels();}});
 // perfect weld: tap the weld bar while the fill is inside the golden band (a miss just keeps welding)
 $('rep').addEventListener('pointerdown',e=>{if(!isTouch||state!=='play'||!R.pa)return;e.preventDefault();e.stopPropagation();
   if(tcWeldTap()==='miss'){const el=$('rep');el.classList.remove('miss');void el.offsetWidth;el.classList.add('miss');}});
 // the hold marker: tap = fly to the hold
 $('hBod').addEventListener('pointerdown',e=>{if(!isTouch||state!=='play')return;e.preventDefault();e.stopPropagation();tcGo({hatch:true});});
 if(isTouch){
   document.addEventListener('touchmove',e=>{if(!(e.target&&e.target.closest&&e.target.closest('input,textarea')))e.preventDefault();},{passive:false});
   for(const ev of ['gesturestart','gesturechange','dblclick','contextmenu'])document.addEventListener(ev,e=>{if(!(e.target&&e.target.closest&&e.target.closest('input,textarea')))e.preventDefault();});
   addEventListener('resize',tcOrient);addEventListener('orientationchange',tcOrient);
   document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')tcSetPause(true);});
   const lb=document.querySelector('#lbB span');if(lb)lb.textContent='TOCA PARA SALTAR';setTimeout(tcOrient,0);}
}
// v65: perfect weld on phones = ONE try per plate. Missing doesn't punish (it keeps welding), but that plate can no longer be perfect,
// so tapping the bar over and over until it hits is no longer a trick. On PC releasing F outside the band already jams the weld.
function tcWeldTap(){if(state!=='play'||!R.pa)return null;const pa=R.pa,p=pa.prog;
  if(!R.useBand||pa.noPerf)return 'used';
  if(p>=R.band&&p<=R.band+CFG.bandW){repairPatch(pa,true);R.pa=null;R.on=false;return 'perfect';}
  pa.noPerf=true;sfx('jam');return 'miss';}
function tcPauseLabels(){const M=$('tPauseM');M.querySelector('[data-a=mus]').textContent=musicOn?'MÚSICA ON':'MÚSICA OFF';
  M.querySelector('[data-a=vo]').textContent=voOn?'VOCES ON':'VOCES OFF';M.querySelector('[data-a=next]').disabled=!(inBreak||WB.calm);}
// v57 (iPhone): Safari stops the game's audio when the opening film plays (state "interrupted") or another app takes the sound,
// and only a touch can restart it, so every touch brings it back; coming back to the tab tries too
if(isTouch){const wakeAC=()=>{if(AC&&AC.state!=='running'&&AC.state!=='closed'&&!(TC.paused&&state==='play'))AC.resume().catch(()=>{});};
  for(const ev of ['touchend','pointerup','click'])document.addEventListener(ev,wakeAC,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)wakeAC();});}
// pause (touch only): freezes the game and its sound; music, voices and "start the round now" live here
function tcSetPause(v){if(!isTouch||TC.paused===v)return;TC.paused=v;$('tPauseM').hidden=!v;musicHold(v); // v73: the music element pauses with the game and resumes where it was
  if(v){tcReset();tcPauseLabels();if(typeof AC!=='undefined'&&AC&&AC.state==='running')AC.suspend().catch(()=>{});}
  else if(typeof AC!=='undefined'&&AC&&AC.state==='suspended')AC.resume().catch(()=>{});}
// phone held upright: warning on top, and the game pauses
function tcOrient(){if(!isTouch)return;const port=innerHeight>innerWidth*1.05;$('tRot').hidden=!port;if(port&&state==='play')tcSetPause(true);}
function tcOrientTick(){if(!isTouch)return;const port=innerHeight>innerWidth*1.05;if(port!==TC.port){TC.port=port;tcOrient();}} // also checked every frame (some browsers are late with resize)
// full screen + landscape lock when PLAY / RETRY is tapped (Android; iPhone Safari allows neither for web pages)
function tcFull(){if(!isTouch)return;const de=document.documentElement,rq=de.requestFullscreen||de.webkitRequestFullscreen;
  const lock=()=>{try{const o=screen.orientation;if(o&&o.lock)o.lock('landscape').catch(()=>{});}catch(_){}};
  if(rq&&!(document.fullscreenElement||document.webkitFullscreenElement)){try{const p=rq.call(de,{navigationUI:'hide'});if(p&&p.then)p.then(lock).catch(()=>{});else lock();}catch(_){}}else lock();}
// ---- touch: trichomes come to the hose on their own when you pass near (Sonic rings) ----
function tcNearDust(){const r=PU.pack>0?15:4.5;let best=r*r,bi=-1;const p=P.pos; // v65: 4.5 m (was 7: you have to go and fetch them) · 15 m with the backpack magnet prize
  for(let i=0;i<DN;i++){if(!dAlive[i]||dMag[i])continue;const j=i*3,dx=dPos[j]-p.x,dy=dPos[j+1]-p.y,dz=dPos[j+2]-p.z,d=dx*dx+dy*dy+dz*dz;if(d<best){best=d;bi=j;}}
  return bi<0?null:_tcD.set(dPos[bi],dPos[bi+1],dPos[bi+2]);}
// ---- touch: tap a breach marker / the hold marker = the astronaut flies there on his own (you keep aiming and shooting);
// moving the stick cancels it. Around the hull it follows the surface at a safe height instead of cutting through the ship.
function tcGo(t){TC.ap=Object.assign({t0:playT,best:1e9,bestT:playT,path:null},t);}
function tcPathClear(a,c){const n=Math.max(2,Math.ceil(a.distanceTo(c)/0.5));for(let k=1;k<=n;k++){_tcW.lerpVectors(a,c,k/n);const q=_tcN.copy(_tcW);if(pushOutOfShip(q,0.9,null)||wingAt(_tcW))return false;}return true;}
// route around the ship: A* on a 1 m grid (cells inside the hull + 1.1 m, the engines or the wings are blocked), then shortcuts
const TC_OFF=[[0.7,0,0],[-0.7,0,0],[0,0.7,0],[0,-0.7,0],[0,0,0.7],[0,0,-0.7]];
function tcBlocked(x,y,z){_tcW.set(x,y,z);if(wingAt(_tcW))return true;for(const o of TC_OFF){_tcW.set(x+o[0],y+o[1],z+o[2]);if(wingAt(_tcW))return true;}_tcN.set(x,y,z);return pushOutOfShip(_tcN,1.1,null);}
function tcPlan(A,B){const C=1,x0=Math.min(A.x,B.x,-15)-2,y0=Math.min(A.y,B.y,-10)-2,z0=Math.min(A.z,B.z,-27)-2;
  const NX=Math.ceil((Math.max(A.x,B.x,15)+2-x0)/C)+1,NY=Math.ceil((Math.max(A.y,B.y,12)+2-y0)/C)+1,NZ=Math.ceil((Math.max(A.z,B.z,27)+2-z0)/C)+1,N=NX*NY*NZ;if(N>500000)return null;
  const cl=(v,lo,n)=>Math.min(n-1,Math.max(0,Math.round((v-lo)/C)));
  const si=(cl(A.z,z0,NZ)*NY+cl(A.y,y0,NY))*NX+cl(A.x,x0,NX),gi=(cl(B.z,z0,NZ)*NY+cl(B.y,y0,NY))*NX+cl(B.x,x0,NX);
  const st=new Uint8Array(N),g=new Float32Array(N).fill(1e9),par=new Int32Array(N).fill(-1),heap=[],hf=[];
  const gx=gi%NX,gy=((gi/NX)|0)%NY,gz=(gi/(NX*NY))|0,h=i=>{const x=i%NX,y=((i/NX)|0)%NY,z=(i/(NX*NY))|0;return Math.hypot(x-gx,y-gy,z-gz);};
  const push=(i,f)=>{heap.push(i);hf.push(f);let c=heap.length-1;while(c>0){const p=(c-1)>>1;if(hf[p]<=hf[c])break;[heap[p],heap[c]]=[heap[c],heap[p]];[hf[p],hf[c]]=[hf[c],hf[p]];c=p;}};
  const pop=()=>{const r=heap[0],li=heap.pop(),lf=hf.pop();if(heap.length){heap[0]=li;hf[0]=lf;let c=0;for(;;){const l=2*c+1,rr=l+1;let m=c;if(l<heap.length&&hf[l]<hf[m])m=l;if(rr<heap.length&&hf[rr]<hf[m])m=rr;if(m===c)break;[heap[m],heap[c]]=[heap[c],heap[m]];[hf[m],hf[c]]=[hf[c],hf[m]];c=m;}}return r;};
  g[si]=0;push(si,h(si));let n=0,found=false;
  while(heap.length&&n<90000){const i=pop();if(st[i]===3)continue;st[i]=3;n++;if(i===gi){found=true;break;}
    const x=i%NX,y=((i/NX)|0)%NY,z=(i/(NX*NY))|0;
    for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy&&!dz)continue;const X=x+dx,Y=y+dy,Z=z+dz;
      if(X<0||Y<0||Z<0||X>=NX||Y>=NY||Z>=NZ)continue;const j=(Z*NY+Y)*NX+X;if(st[j]===3)continue;
      if(st[j]===0)st[j]=(j!==gi&&tcBlocked(x0+X*C,y0+Y*C,z0+Z*C))?2:1;if(st[j]===2)continue;
      const ng=g[i]+Math.hypot(dx,dy,dz);if(ng<g[j]){g[j]=ng;par[j]=i;push(j,ng+h(j));}}}
  if(!found)return null;const pts=[];for(let i=gi;i>=0&&i!==si;i=par[i])pts.push(new THREE.Vector3(x0+(i%NX)*C,y0+(((i/NX)|0)%NY)*C,z0+((i/(NX*NY))|0)*C));
  pts.reverse();if(pts.length)pts[pts.length-1]=B.clone();else pts.push(B.clone());return pts;}
function tcAutopilot(acc){const A=TC.ap;if(!A)return;
  if(Math.hypot(st.x,st.y)>0.25||state!=='play'){TC.ap=null;return;}
  let T,arrive;
  if(A.pa){if(A.pa.hp>=CFG.patchHp){TC.ap=null;return;}T=_tcT.copy(A.pa.pos).addScaledVector(A.pa.n,1.5);arrive=P.pos.distanceTo(A.pa.pos)<CFG.repairR*0.7;}
  else{if(!P.carry&&!P.depActive){TC.ap=null;return;}const hp=hullParam(HATCH);hullPoint(hp.z,hp.th,_tcW,_tcN);T=_tcT.copy(HATCH).addScaledVector(_tcN,1.4);arrive=P.pos.distanceTo(HATCH)<CFG.depositR*0.6;}
  if(arrive){TC.ap=null;return;}
  if(!A.path||A.replan){A.replan=false;A.path=tcPathClear(P.pos,T)?[T.clone()]:(tcPlan(P.pos,T)||[T.clone()]);}
  const path=A.path;path[path.length-1].copy(T); // the hull moves past slowly: keep the end on the target
  while(path.length>1&&(P.pos.distanceTo(path[0])<1.2||tcPathClear(P.pos,path[1])))path.shift(); // shortcut to the furthest point in sight
  const goal=path[0],last=path.length===1;
  const dir=_tcV.subVectors(goal,P.pos),dl=dir.length();
  const want=dir.multiplyScalar(Math.min(CFG.maxSpeed,last?dl*2.2:CFG.maxSpeed)/Math.max(dl,1e-3));
  acc.copy(want.sub(P.vel)).multiplyScalar(0.45);if(acc.lengthSq()>1)acc.normalize();
  const d=P.pos.distanceTo(T);if(d<A.best-0.4){A.best=d;A.bestT=playT;}else if(playT-A.bestT>1.5){A.replan=true;A.bestT=playT;} // stuck: plan again from here
  if(playT-A.t0>30)TC.ap=null;}
// ---- touch: one marker over each breach (broken plates and plates being eaten), visible from afar; tap = go there ----
// v68: on PC too (Santi), with ROTURA and the distance; there they can't be clicked
function tcMarkers(){const box=$('bMk');
  if(state!=='play'||CINE.on||TC.paused){for(const m of TC.mk)m.hidden=true;return;}
  const L=[];for(const pa of PATCHES){if(pa.hp>=CFG.patchHp)continue;const eat=spiders.some(s=>s.state==='eat'&&s.patch===pa);if(pa.hp>0&&!eat)continue;
    const d=P.pos.distanceTo(pa.pos);if(d<CFG.repairR)continue;L.push({pa,d,eat,s:h4proj(pa.pos)});}
  L.sort((a,b)=>a.d-b.d);const shown=[];
  // phone: breaches close to each other count once (the nearest shows). PC: all of them (up to 5); h4declutter() keeps every marker apart
  for(const it of L){if(isTouch&&shown.some(o=>Math.abs(o.s.px-it.s.px)<64&&Math.abs(o.s.py-it.s.py)<56))continue;shown.push(it);if(shown.length>=5)break;}
  for(let i=0;i<shown.length;i++){let m=TC.mk[i];
    if(!m){m=document.createElement('div');m.className='mk brk';m.innerHTML='<img class="ar" alt=""><img class="ic" alt=""><span>ROTURA</span><em></em>';box.appendChild(m);TC.mk[i]=m;
      m.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(m._pa&&state==='play')tcGo({pa:m._pa});});}
    if(!m.dataset.art&&HUD4.art){m.dataset.art=1;m.children[0].src=HUD4.art['flecha-rescate'];m.children[1].src=HUD4.art['icono-fuga'];}
    const it=shown[i];m._pa=it.pa;m.hidden=false;h4apply(m,it.s,m.children[0],180,26);m.classList.toggle('eat',it.eat);
    {const k=THREE.MathUtils.clamp((it.d-8)/27,0,1);m.style.opacity=(1-(isTouch?0.72:0.38)*k).toFixed(2);m.style.transform=`translate(-50%,-50%) scale(${(1-(isTouch?0.28:0.15)*k).toFixed(2)})`;} // v63: 8 m → full, 35 m → faint and smaller (v68: PC fades less)
    const t=Math.round(it.d)+' m';if(m.children[3].textContent!==t)m.children[3].textContent=t;}
  for(let i=shown.length;i<TC.mk.length;i++)TC.mk[i].hidden=true;}
// once per frame (touch): show the controls only while playing, keep the markers in place
function tcFrame(dt){if(!isTouch){tcMarkers();h4declutter(dt);return;}tcOrientTick();const on=state==='play'&&!TC.paused&&!CINE.on;
  if($('touch').hidden===on){$('touch').hidden=!on;$('tZone').hidden=!on;if(!on)tcReset();}
  tcMarkers();h4declutter(dt);tcAvoid();}
// touch: markers stuck to the screen edge keep clear of the SHOOT and pause buttons
function tcAvoid(){const W=innerWidth,H=innerHeight;for(const el of document.querySelectorAll('.mk:not([hidden])')){const x=parseFloat(el.style.left),y=parseFloat(el.style.top);if(!(x>=0))continue;
  if(x>W-170&&y>H-160)el.style.top=(H-160)+'px';else if(x<100&&y<74)el.style.top='74px';}}

