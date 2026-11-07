/* ================= v76: THE FIRST EGG (cinematic, once per device) and the EGG MARKERS (always) ================= */
// 1) The first egg a device ever sees is shown in a short cinematic (EGGC / eggCineStart / eggCam): the lens cuts to a close, slightly high shot of the spider
//    that laid it (the egg is laid just behind its abdomen, see tryLayEgg), with a big title in the middle; ~2.6 s, skipped like the other cinematics (click, tap, key).
//    The world stands still (the loop runs with dt = 1e-4 while CINE.mode === 'egg', 31-loop.js): spiders, rocks, timers and the egg's hatch timer do not advance;
//    only the egg (it grows and throbs: e.gt / e.ph on real time), the sparks and this camera do. The last 0.7 s bring the lens back to the astronaut.
//    Remembered per device in localStorage ('heads_egg_seen'); ?huevo in the address forces it on the first egg of every game (and does not remember it).
// 2) Every egg carries a red marker with a countdown ring (HUD v4 look, drawn in SVG): through the ship, stuck to the screen edge with an arrow off screen,
//    kept apart from the other markers by h4declutter() (after the hold, before the breaches). Not tappable.
const EGGC={key:'heads_egg_seen',seen:false,flag:/[?&]huevo\b/.test(location.search),sp:null,p0:new THREE.Vector3(),p1:new THREE.Vector3(),look:new THREE.Vector3(),qF:new THREE.Quaternion(),blend:'',u:0,fov:54};
try{EGGC.seen=localStorage.getItem(EGGC.key)==='1';}catch(_){}
// wanted: this egg should get the cinematic (the first one of the device; with ?huevo, the first of each game). window.__noCine (tests) turns it off unless ?huevo
function eggCineWanted(){if(TRAILER&&TRA.egc!==null)return state==='play'&&TRA.egc; // v84: an egg laid with the trailer key gets the scene only when the trailer's cinematics switch is on
  return state==='play'&&(EGGC.flag?stats.eggs===0:!EGGC.seen&&!window.__noCine);}
const _e1=new THREE.Vector3(),_e2=new THREE.Vector3(),_e3=new THREE.Vector3(),_e4=new THREE.Vector3(),_e5=new THREE.Vector3(),_e6=new THREE.Vector3();
// is the straight way a -> b clear of the ship and the rocks (pad m around them)? The last `skip` m before b do not count (b sits right on the hull)
function eggLos(a,b,skip,pad){const L=a.distanceTo(b),N=Math.max(2,Math.ceil(L/0.12));for(let k=1;k<N;k++){if(L*(1-k/N)<skip)break;if(camSolid(_e6.lerpVectors(a,b,k/N),pad))return false;}return true;}
// the shot: behind the egg (so the spider is seen beyond it), a bit to the side and a bit above the surface, 3 m or so away; the first free spot that sees the egg and the spider
function eggShot(e,sp){const n=e.n,ep=e.pos,fw=_e1.set(0,0,1);
  if(sp)fw.applyQuaternion(sp.mesh.quaternion);fw.addScaledVector(n,-fw.dot(n));
  if(fw.lengthSq()<1e-4){fw.set(1,0,0).addScaledVector(n,-n.x);if(fw.lengthSq()<1e-4)fw.set(0,0,1).addScaledVector(n,-n.z);}
  fw.normalize();const sv=_e2.crossVectors(n,fw).normalize();
  const mid=ep.clone();let spc=null;
  if(sp&&sp.mesh.position.distanceTo(ep)<4){spc=sp.mesh.position.clone().addScaledVector(n,0.25*sp.mesh.scale.x);mid.lerp(spc,0.5);}
  let best=null;const cam=new THREE.Vector3();
  for(const a of [0,25,-25,45,-45,65,-65,90,-90,120,-120,150,-150,180])for(const R of [3.4,2.8,4.0,2.3,5.0,6.2])for(const h of [1.5,1.1,2.0,0.8,2.8,4.2]){
    const cost=Math.abs(Math.abs(a)-40)/60+Math.abs(R-3.4)*0.35+Math.abs(h-1.5)*0.5+(a<0?0.01:0);if(best&&cost>=best.cost)continue;
    const ca=Math.cos(a*Math.PI/180),sa=Math.sin(a*Math.PI/180);
    cam.copy(ep).addScaledVector(n,h).addScaledVector(fw,-ca*R).addScaledVector(sv,sa*R);
    if(camSolid(cam,0.5)||P.pos.distanceTo(cam)<1.2)continue;
    if(!eggLos(cam,ep,0.45,0.12)||!eggLos(cam,mid,0.45,0.12)||(spc&&!eggLos(cam,spc,0.6,0.12)))continue;
    let ok=true;for(const o of spiders)if(o!==sp&&o.mesh.position.distanceTo(cam)<1.4){ok=false;break;}
    if(ok)for(const o of EGGS)if(o!==e&&o.pos.distanceTo(cam)<1.0){ok=false;break;}
    if(ok)for(const o of INCS)if(o.pos&&o.pos.distanceTo(cam)<3.5){ok=false;break;}
    if(!ok)continue;best={cost,p0:cam.clone()};}
  if(!best)return null;
  // aim a little above the subject (along the lens's own up) so the egg and the spider sit in the lower part of the frame and the title has the middle
  const fwd=_e3.subVectors(mid,best.p0).normalize(),cu=_e4.copy(UP).addScaledVector(fwd,-UP.dot(fwd));
  if(cu.lengthSq()<0.04)cu.copy(n).addScaledVector(fwd,-n.dot(fwd));cu.normalize();
  best.look=mid.clone().addScaledVector(cu,0.5);
  best.p1=best.p0.clone().lerp(best.look,0.15); // slow push-in
  if(camSolid(best.p1,0.3))best.p1.copy(best.p0);
  return best;}
function eggCineStart(e,sp){if(CINE.on||!eggCineWanted())return false;
  const sh=eggShot(e,sp||null);if(!sh)return false; // no free spot for the lens (very rare): no cinematic, the old message
  EGGC.p0.copy(sh.p0);EGGC.p1.copy(sh.p1);EGGC.look.copy(sh.look);EGGC.sp=sp||null;EGGC.blend='';EGGC.u=0;
  CINE.on=true;CINE.mode='egg';CINE.t=0;CINE.dur=2.6;CINE.egg=e;CINE.fov=0;CINE.yaw=P.yaw;CINE.pitch=P.pitch;
  document.body.classList.add('cine','eggc');
  if(!EGGC.flag){EGGC.seen=true;try{localStorage.setItem(EGGC.key,'1');}catch(_){}}
  const R=sp&&sp.mesh.userData.rig;if(R&&R.ab){R.ab.sqv-=2.6;R.ab.pv+=1.1;} // the abdomen pumps once as the egg comes out
  return true;}
function eggCineEnd(){if(CINE.mode!=='egg')return;CINE.on=false;CINE.mode='';CINE.egg=null;CINE.fov=0;EGGC.sp=null;EGGC.blend='';
  document.body.classList.remove('cine','eggc');$('eggT').classList.remove('on');$('eggFade').classList.remove('on');}
// called by the loop every frame of the cinematic (rdt = real time), after the follow camera is placed (CINE.nPos is where it is, EGGC.qF how it looks)
function eggCam(rdt){const E=EGGC,T=(CINE.t+=rdt),D=CINE.dur,BS=D-0.7,ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
  P.yaw=CINE.yaw;P.pitch=CINE.pitch;P.vel.set(0,0,0);P.inv=Math.max(P.inv,1);
  E.qF.copy(camera.quaternion);
  if(E.sp&&spiders.includes(E.sp)&&E.sp.mesh.userData.rig)animSpider(E.sp,rdt,clock.elapsedTime); // it settles: the legs plant, the abdomen spring plays
  E.u=Math.min(E.u+rdt,D-0.3);const kp=ease(E.u/(D-0.3)); // (own clock: a skip jumps CINE.t, not the push-in)
  camera.position.lerpVectors(E.p0,E.p1,kp);camera.lookAt(E.look);let fov=E.fov-5*kp;
  $('eggT').classList.toggle('on',T>0.3&&T<BS);
  if(T>=BS){ // the way back to the astronaut: straight there if nothing is in the way, else a quick dip to black
    if(!E.blend){E.blend=eggLos(camera.position,CINE.nPos,0.3,0.2)?'lerp':'cut';if(E.blend==='cut')$('eggFade').classList.add('on');}
    if(E.blend==='lerp'){const k=ease((T-BS)/0.7);camera.position.lerp(CINE.nPos,k);camera.quaternion.slerp(E.qF,k);fov=THREE.MathUtils.lerp(fov,62,k);}
    else if(T>=BS+0.14){camera.position.copy(CINE.nPos);camera.quaternion.copy(E.qF);fov=62;$('eggFade').classList.remove('on');}}
  CINE.fov=fov;
  if(T>=D)eggCineEnd();}

/* ---------- egg markers ---------- */
HUD4.eg=[];
const EGG_ICON=i=>`<svg class="eg" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="egG${i}" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#ff9266"/><stop offset=".45" stop-color="#e3301a"/><stop offset="1" stop-color="#7a0b08"/></radialGradient></defs>`
 +`<circle class="bg" cx="32" cy="32" r="30"/><circle class="trk" cx="32" cy="32" r="26.5"/><circle class="arc" cx="32" cy="32" r="26.5" pathLength="100" transform="rotate(-90 32 32)"/><circle class="rim" cx="32" cy="32" r="30"/>`
 +`<g class="ei"><path d="M32 14.5C24.6 14.5 19 26 19 35.5 19 44.2 24.8 50 32 50S45 44.2 45 35.5C45 26 39.4 14.5 32 14.5Z" fill="url(#egG${i})" stroke="#2b0605" stroke-width="1.6"/>`
 +`<ellipse cx="27.2" cy="27" rx="2.8" ry="5.6" fill="#ffd9c2" opacity=".78" transform="rotate(16 27.2 27)"/><circle cx="37.5" cy="38" r="2.3" fill="#5a0a07" opacity=".7"/><circle cx="31" cy="42.5" r="1.7" fill="#5a0a07" opacity=".7"/><circle cx="38.5" cy="30.5" r="1.4" fill="#5a0a07" opacity=".6"/></g></svg>`;
function h4egg(i){let m=HUD4.eg[i];if(!m){m=document.createElement('div');m.className='mk egg';m.hidden=true;
    m.innerHTML=EGG_ICON(i)+'<img class="ar" alt="">';$('eMk').appendChild(m);m._arc=m.querySelector('.arc');m._ei=m.querySelector('.ei');m._ar=m.querySelector('.ar');HUD4.eg[i]=m;}
  if(!m.dataset.art&&HUD4.art){m.dataset.art=1;m._ar.src=HUD4.art['flecha-rescate'];}
  return m;}
const _hu=new THREE.Vector3(),_hp=new THREE.Vector3();
// once a frame (from updateHud4): one marker per egg, the one about to hatch first (h4declutter keeps that order). It hangs a little above the egg on screen.
function h4eggs(dt){let n=0;
  if(state==='play'&&!CINE.on&&EGGS.length){
    const up=_hu.set(0,1,0).applyQuaternion(camera.quaternion),size=isTouch?34:THREE.MathUtils.clamp(innerHeight*0.048,38,56),off=size*0.5+10;
    const L=EGGS.map(e=>({e,rem:Math.max(0,e.hatch-e.t)})).sort((a,b)=>a.rem-b.rem);
    for(const {e,rem} of L){const m=h4egg(n++),k=THREE.MathUtils.clamp(e.t/e.hatch,0,1),d=Math.max(0.5,camera.position.distanceTo(e.pos));
      _hp.copy(e.pos).addScaledVector(up,off*2*Math.tan(camera.fov*Math.PI/360)*d/innerHeight); // `off` px above the egg whatever its distance
      m.hidden=false;m._e=e;h4apply(m,h4proj(_hp),m._ar,180,size*0.5+4);
      const bt=Math.pow(Math.max(0,Math.sin(e.ph*Math.PI*2)),8); // the same heartbeat as the egg itself: faster as it nears hatching
      m._arc.style.strokeDashoffset=(-k*100).toFixed(2); // the ring empties as the egg nears hatching
      m._ei.style.transform=`scale(${(1+0.17*bt*(1+k)).toFixed(3)})`;
      m.classList.toggle('urg',rem<=2.2);}}
  for(;n<HUD4.eg.length;n++)HUD4.eg[n].hidden=true;}
