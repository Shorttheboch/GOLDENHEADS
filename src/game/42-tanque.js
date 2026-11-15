/* ================= v86: «TANQUE LLENO» — the notice when the backpack tank is full (PC and phone) ================= */
// Fires when the tank REACHES capacity (P.carry >= CFG.tankCap), whatever filled it (suction, the phone's auto-pickup, the backpack magnet);
// it re-arms when the tank drops below capacity (unloading, a bite). Never during a cinematic, the phone pause / tutorial, the end plate or the menu:
// if the tank fills then, the notice waits and fires when play resumes (if it is still full). Nothing here pauses the game.
// 1) First time on the device (localStorage 'heads_tank_seen'; ?tanque in the address forces this version on every fill and remembers nothing), ~3 s:
//    big cyan title «¡TANQUE LLENO!» + «Llévalo a la BODEGA de la nave» (touch: «Toca BODEGA y te lleva») a bit above the crosshair (#tkT, under the markers),
//    the pilot's line 'tank_full' (prio 4, queued), the BODEGA marker grows and pulses (4 s), a cyan trail of beads flowing from the backpack to the hold
//    (tkTrail*, 3.6 s), and the backpack screen flashes (uFlash, 12-player.js). The old tutorial card 'full' is gone (this replaces it).
// 2) Following fills (short version): «TANQUE LLENO · ve a la bodega» in cyan (PC: the round-message line #msg; phone: the v63 alert under the top panels,
//    with «Toca BODEGA y te lleva»), sfx('full') and the marker pulse (2.6 s). If another message is up it waits for it (3 s at most).
//    A refill less than 8 s after the last notice (a bite spilled a few and you sucked them back) only pulses the marker.
// 3) Voice rule (one game): the first-time notice always speaks. Otherwise the line plays at most once per full event, never in two full events in a row,
//    and never less than 90 s after it last played (the reminders follow the same rule).
// 4) Reminder: full for 20 s without unloading (the clock stops while depositing, while the phone flies you to the hold, in cinematics and while the hold
//    is a nest) -> marker pulse + the short notice again; then every 22 s.
// 5) While full: the marker reads «BODEGA / LLENO · DESCARGAR» (and back to «DEPOSITAR» after unloading), and trying to vacuum (PC right click / E,
//    the phone's auto-suction near trichomes, the magnet prize near trichomes) does not pull: the nozzle coughs out a little gas and two cyan sparks
//    (every 0.45 s; on PC a short beep when you start, at most every 3 s). The old «TANQUE LLENO» float text at the nozzle is gone.
const TK={key:'heads_tank_seen',seen:false,force:/[?&]tanque\b/.test(location.search),
  full:false,pend:false,remT:0,remAt:20,n:0,last:-1e9,voT:-1e9,voEv:false,voPrev:false,pulse:0,big:0,flash:0,mq:null,
  rejT:0,rejOn:false,rejS:-1e9,rejN:0,lbl:null,hn:null,log:[],at:[],voN:0};
const TK_CFG={big:3.1,pulseBig:4,pulse:2.6,rem0:20,rem:22,minGap:8,voGap:90,flash:1.5,rejEvery:0.45};
const TK_SUB='Llévalo a la <b>BODEGA</b> de la nave',TK_SUB_T='Toca <b>BODEGA</b> y te lleva';
try{TK.seen=localStorage.getItem(TK.key)==='1';}catch(_){}
const _tk1=new THREE.Vector3(),_tk2=new THREE.Vector3(),_tk3=new THREE.Vector3();
function tkFirst(){return TK.force||!TK.seen;}
function tkLog(k){TK.log.push(k);TK.at.push(+playT.toFixed(2));if(TK.log.length>40){TK.log.shift();TK.at.shift();}} // (what fired and when: read by the test)
function tankReset(){Object.assign(TK,{full:false,pend:false,remT:0,remAt:TK_CFG.rem0,n:0,last:-1e9,voT:-1e9,voEv:false,voPrev:false,pulse:0,big:0,flash:0,mq:null,rejT:0,rejOn:false,rejS:-1e9,rejN:0,log:[],at:[],voN:0});
  tkTrailOff();const el=$('tkT');if(el)el.classList.remove('go');tkLabel(false);$('hBod').classList.remove('tk');}
// the marker's second line: «DEPOSITAR» <-> «LLENO · DESCARGAR» (the i18n observer translates the new text node)
function tkLabel(full){if(TK.lbl===full)return;TK.lbl=full;const bod=$('hBod'),b=bod.querySelector('span b');if(b)b.textContent=full?'LLENO · DESCARGAR':'DEPOSITAR';bod.classList.toggle('lleno',full);}
function tkSay(prio){TK.voT=playT;TK.voEv=true;TK.voN++;say('tank_full',prio,{queue:true});}
function tkVoiceOk(){return playT-TK.voT>=TK_CFG.voGap&&!TK.voEv&&!TK.voPrev;}
// the big title (first time)
function tkTitle(){const el=$('tkT');if(!el)return;
  if(!el._tk){el._tk=1;el.addEventListener('animationend',e=>{if(e.target===el.firstElementChild)el.classList.remove('go');});}
  el.querySelector('.tkTl').innerHTML=g3(TR('¡TANQUE LLENO!')).replace('class="g3"','class="g3 cy"');
  el.querySelector('.tkTs').innerHTML=TRH(isTouch?TK_SUB_T:TK_SUB);
  el.classList.remove('go');void el.offsetWidth;el.classList.add('go');}
// kind: 'big' (first time) · 'short' (a following fill) · 'remind' (still full after 20 s)
function tkNotice(kind){const big=kind==='big';
  if(kind==='short'&&playT-TK.last<TK_CFG.minGap){TK.pulse=Math.max(TK.pulse,TK_CFG.pulse);tkLog('gap');return;}
  TK.n++;TK.last=playT;TK.rejS=playT;tkLog(kind);
  TK.pulse=Math.max(TK.pulse,big?TK_CFG.pulseBig:TK_CFG.pulse);sfx('full');
  if(big){TK.big=TK_CFG.big;TK.flash=TK_CFG.flash;TK.mq=null;tkTitle();tkTrailStart();tkSay(4);
    if(!TK.force){TK.seen=true;try{localStorage.setItem(TK.key,'1');}catch(_){}}}
  else{TK.mq={w:0};if(tkVoiceOk())tkSay(3);}}
// the short notice, once the message line is free (another message up: wait for it, 3 s at most)
function tkMsgBusy(){if(isTouch){const a=$('mAlert');return !!(a&&a.classList.contains('on'))||!!(MHUD.pend&&MHUD.pend.length);}return msgT>0.4;}
function tkMsgTick(dt){const q=TK.mq;if(!q)return;q.w+=dt;if(tkMsgBusy()&&q.w<3)return;TK.mq=null;TK.pulse=Math.max(TK.pulse,TK_CFG.pulse); // (the marker pulses with the message)
  showMsg('TANQUE LLENO · ve a la bodega',isTouch?'Toca BODEGA y te lleva':'',2.6,'tk');}
// trying to vacuum with a full tank: the nozzle coughs instead of pulling (pooled gas puffs + two sparks)
function tkReject(noz,nd){TK.rejN++;_tk3.copy(noz).addScaledVector(nd,0.06);
  for(let k=0;k<4;k++)puff(_tk3,_tk1.copy(nd).multiplyScalar(2.4+Math.random()*1.8).add(_tk2.randomDirection().multiplyScalar(0.7)).add(P.vel),0.045,0.34,0.55,1.1);
  burst(_tk3,0x8ff8ff,2);}
// once a frame from the loop (31-loop.js), after the HUD and before the markers are decluttered (dt: game time, rdt: real time)
function tankTick(dt,rdt,noz,nd,sucking,packOn,room,atHatch){
  const play=state==='play',full=play&&P.carry>=CFG.tankCap,can=play&&!CINE.on;
  TK.pulse=Math.max(0,TK.pulse-rdt);TK.big=Math.max(0,TK.big-rdt);TK.flash=Math.max(0,TK.flash-rdt);TK.rejT=Math.max(0,TK.rejT-dt);
  if(!full){TK.full=false;TK.pend=false;TK.remT=0;TK.mq=null;}
  else{
    if(!TK.full){TK.full=true;TK.pend=true;TK.remT=0;TK.remAt=TK_CFG.rem0;TK.voPrev=TK.voEv;TK.voEv=false;}
    if(TK.pend){const big=tkFirst();if(can&&!(big&&$('xpT').classList.contains('go'))){TK.pend=false;tkNotice(big?'big':'short');}} // (the big title waits for the EXTRA POWER title, ~1.9 s)
    else if(can&&!P.depActive&&!atHatch&&!(TC.ap&&TC.ap.hatch)&&!ZONES[2].nest){TK.remT+=dt;if(TK.remT>=TK.remAt){TK.remT=0;TK.remAt=TK_CFG.rem;tkNotice('remind');}}
    if(can)tkMsgTick(dt);}
  // the marker: label while full, strong pulse for a few seconds after a notice
  if(play){tkLabel(full);const bod=$('hBod');bod.classList.toggle('tk',TK.pulse>0&&full&&!bod.hidden);}
  // the backpack screen blinks three times
  if(P.scr&&P.scr.material.uniforms.uFlash){const k=TK.flash;P.scr.material.uniforms.uFlash.value=k>0?(0.5+0.5*Math.cos((TK_CFG.flash-k)*13.8))*Math.min(1,k/0.4):0;}
  // the nozzle refuses
  let trying=can&&!room&&(sucking||(packOn&&TK.rejT<=0&&!!nearestDust(P.pos,isTouch?15:CFG.packR)));
  if(trying){if(TK.rejT<=0){TK.rejT=TK_CFG.rejEvery;tkReject(noz,nd);}
    if(!TK.rejOn&&!isTouch&&playT-TK.rejS>3){TK.rejS=playT;sfx('full');}}
  TK.rejOn=trying;
  tkTrailTick(dt);}

/* ---------- the cyan trail: beads flowing from the backpack to the hold, around the hull ---------- */
// The path is worked out every frame (25 points, no allocations): around the ship's axis it blends the astronaut's angle and distance into the hold's
// (so it wraps round the hull instead of cutting through it), bulges outwards a little (a gentle curve), never comes closer than ~1 m to the real hull
// (the ellipse moved out by the measured map; 0.45 m at the very end), is pushed out of the nacelles / pylons, and steps over (or under) a wing. 56 beads ride along it towards the hold
// at 4.2 m/s with brighter pulses travelling the same way; they fade in over the first metres (nothing big right in front of the lens) and at the hold.
// Two Points layers sharing one geometry: the cores, and a soft halo (off on the two lowest quality levels, v55). Hidden by the hull where it goes behind.
const TKT={on:false,t:0,dur:3.6,K:24,N:56,p:new Float32Array(25*3),s:new Float32Array(25),pos:null,col:null,geo:null,core:null,halo:null,len:0};
{const N=TKT.N;TKT.pos=new Float32Array(N*3).fill(-9999);TKT.col=new Float32Array(N*3);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(TKT.pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(TKT.col,3).setUsage(THREE.DynamicDrawUsage));
 const tex=glowTex('rgba(235,255,255,1)','rgba(70,225,255,.6)');
 TKT.core=new THREE.Points(g,new THREE.PointsMaterial({size:isTouch?0.17:0.18,map:tex,vertexColors:true,color:new THREE.Color(0.55,2.3,2.6),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
 TKT.halo=new THREE.Points(g,new THREE.PointsMaterial({size:isTouch?0.55:0.66,map:tex,vertexColors:true,color:new THREE.Color(0.08,0.62,0.8),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
 for(const o of [TKT.core,TKT.halo]){o.frustumCulled=false;o.visible=false;o.renderOrder=4;scene.add(o);}TKT.geo=g;}
function tkTrailStart(){TKT.on=true;TKT.t=0;TKT.core.visible=true;TKT.halo.visible=QA.lvl<4;}
function tkTrailOff(){TKT.on=false;TKT.core.visible=false;TKT.halo.visible=false;}
// the hold end: the hatch (what the BODEGA marker points at), 0.6 m out along the hull normal
function tkHold(out){if(!TK.hn){const hp=hullParam(HATCH);TK.hn=new THREE.Vector3();hullPoint(hp.z,hp.th,_tk1,TK.hn);}return out.copy(HATCH).addScaledVector(TK.hn,0.6);}
function tkTrailPath(){const T=TKT,K=T.K,A=_tk1,B=tkHold(_tk2),Q=_tk3;
  if(P.tank)P.tank.piv.getWorldPosition(A);else A.copy(P.pos);
  const cA=hullAB(A.z)[2],cB=hullAB(B.z)[2],fA=Math.atan2(A.y-cA,A.x),fB=Math.atan2(B.y-cB,B.x),df=Math.atan2(Math.sin(fB-fA),Math.cos(fB-fA));
  const rA=Math.hypot(A.x,A.y-cA),rB=Math.hypot(B.x,B.y-cB),bul=Math.min(2.2,0.1*A.distanceTo(B));
  let len=0;
  for(let k=0;k<=K;k++){const u=k/K;
    if(k===0)Q.copy(A);else if(k===K)Q.copy(B);
    else{const z=A.z+(B.z-A.z)*u,[a,b,c]=hullAB(z),f=fA+df*u,cf=Math.cos(f),sf=Math.sin(f);
      let r=rA+(rB-rA)*u+bul*Math.sin(Math.PI*u);
      if(z>HZ0&&z<HZ1)r=Math.max(r,1/Math.sqrt((cf/a)*(cf/a)+(sf/b)*(sf/b))+(z>-14.6&&z<21.6?hullOff(z,Math.atan2(sf/b,cf/a)):0)+Math.min(1,0.45+(1-u)*3)); // (hullOff: the real hull stands out of the ellipse here and there, up to ~1.5 m)
      Q.set(r*cf,c+r*sf,z);pushOutOfShip(Q,0.55,null);
      for(let i=0;i<14&&wingAt(Q);i++)Q.y+=Q.y>-0.4?0.22:-0.22;}
    const j=k*3;if(k){const dx=Q.x-T.p[j-3],dy=Q.y-T.p[j-2],dz=Q.z-T.p[j-1];len+=Math.sqrt(dx*dx+dy*dy+dz*dz);}
    T.p[j]=Q.x;T.p[j+1]=Q.y;T.p[j+2]=Q.z;T.s[k]=len;}
  return T.len=len;}
function tkTrailTick(dt){const T=TKT;if(!T.on)return;
  if(state!=='play'||CINE.on){tkTrailOff();return;}
  T.t+=dt;if((P.depActive||P.carry<CFG.tankCap)&&T.t<T.dur-0.5)T.t=T.dur-0.5; // at the hold (or the tank emptied another way): it goes now
  if(T.t>=T.dur){tkTrailOff();return;}
  const ss=THREE.MathUtils.smoothstep,g=Math.min(1,T.t/0.25)*(1-ss(T.t,T.dur-1.0,T.dur));
  const L=tkTrailPath(),N=T.N,sp=Math.max(isTouch?0.45:0.36,L/N),ph=(T.t*4.2)%sp;let k=0;
  for(let i=0;i<N;i++){const s=ph+i*sp,j=i*3;
    if(s>L){T.pos[j]=0;T.pos[j+1]=-9999;T.pos[j+2]=0;T.col[j]=T.col[j+1]=T.col[j+2]=0;continue;}
    while(k<T.K-1&&T.s[k+1]<s)k++;
    const s0=T.s[k],s1=T.s[k+1],f=s1>s0?(s-s0)/(s1-s0):0,a=k*3;
    T.pos[j]=T.p[a]+(T.p[a+3]-T.p[a])*f;T.pos[j+1]=T.p[a+1]+(T.p[a+4]-T.p[a+1])*f;T.pos[j+2]=T.p[a+2]+(T.p[a+5]-T.p[a+2])*f;
    const w=0.5+0.5*Math.pow(0.5+0.5*Math.sin((s/2.4-T.t*1.7)*6.2832),3),e=ss(s,0.5,1.8)*ss(L-s,0,0.7),c=g*w*e;
    T.col[j]=T.col[j+1]=T.col[j+2]=c;}
  T.geo.attributes.position.needsUpdate=true;T.geo.attributes.color.needsUpdate=true;T.halo.visible=QA.lvl<4;}
window.__tank={TK,TKT,TK_CFG,tankReset,tkNotice,trailStart:tkTrailStart,path:()=>tkTrailPath(),get cap(){let n=0;for(let i=0;i<DN;i++)n+=dCap[i];return n;}};
