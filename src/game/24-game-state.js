/* ================= GAME STATE ================= */
let state='menu',wave=0,toSpawn=0,spawnT=0,breakT=0,msgT=0,playT=0,inBreak=false,skipReq=false,dashReq=false;
const CB_={last:undefined,leakT:0,gainT:0,warned:0};
const stats={kills:0,shots:0,hits:0,heads:0,multi:0,saved:0,perfect:0,spitters:0,incs:0,eggs:0,eggsKilled:0};
const MARK_TEX=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,30,2,32,30,30);gr.addColorStop(0,'rgba(255,90,60,0.9)');gr.addColorStop(1,'rgba(255,20,10,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
  g.fillStyle='#ff3b2a';g.strokeStyle='#ffe2c0';g.lineWidth=3;g.beginPath();g.moveTo(32,54);g.lineTo(14,24);g.lineTo(50,24);g.closePath();g.fill();g.stroke();
  return new THREE.CanvasTexture(c);})();
let lastCallW=-1;
function markLast(){const left=spiders.length+toSpawn+EGGS.length;const on=state==='play'&&!inBreak&&toSpawn===0&&left>0&&left<=2&&wave>0;
  for(const s of spiders){let m=s.mesh.userData.mark;
    if(on){if(!m){m=new THREE.Sprite(new THREE.SpriteMaterial({map:MARK_TEX,depthTest:false,depthWrite:false,transparent:true}));m.renderOrder=20;s.mesh.add(m);s.mesh.userData.mark=m;}
      m.visible=true;const k=s.mesh.scale.x,d=camera.position.distanceTo(s.pos);m.position.set(0,1.3,0);m.scale.setScalar(Math.max(0.5,d*0.045)/k*(1+0.15*Math.sin(playT*8)));
      s.aggro=Math.max(s.aggro||0,1);s.patch=null;if(s.state==='eat')s.state='crawl';}
    else if(m)m.visible=false;}
  if(on&&lastCallW!==wave){lastCallW=wave;showMsg(left===1?'QUEDA 1 ARAÑA':'QUEDAN '+left+' ARAÑAS','Marcadas en rojo · vienen a por ti',2.4);}}
// each round arrives in 1-3 bursts with a short calm between them
const WB={groups:[],gi:0,left:0,calm:false,lull:0};let roundLost0=0;
const calmNow=()=>inBreak||WB.calm;
// the opening: the captain bursts out of the hold hatch with spiders already crawling on the hull
const HATCH_N=new THREE.Vector3();
const DEPFX={pool:[],i:0,acc:0,rk:1,ringT:0};
{const mat=new THREE.SpriteMaterial({map:dotTex,color:0xffc860,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});
 for(let k=0;k<80;k++){const s=new THREE.Sprite(mat.clone());s.visible=false;scene.add(s);DEPFX.pool.push({s,t:1,a:new THREE.Vector3(),c:new THREE.Vector3(),sp:1});}
 DEPFX.ring=new THREE.Mesh(new THREE.RingGeometry(0.5,0.68,48),new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,1.6,0.5),transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(DEPFX.ring);}
function updateDepFx(dt,active){
  if(active&&P.tank){DEPFX.acc+=dt*60;while(DEPFX.acc>=1){DEPFX.acc-=1;const q=DEPFX.pool[DEPFX.i++%DEPFX.pool.length];
      P.tank.piv.getWorldPosition(q.a);q.a.addScaledVector(V3.randomDirection(),0.08);
      q.c.copy(q.a).lerp(HATCH,0.5).addScaledVector(HATCH_N,1.1).add(V3.randomDirection().multiplyScalar(0.45));q.t=0;q.sp=1/(0.36+Math.random()*0.2);q.s.visible=true;}
    DEPFX.ringT-=dt;if(DEPFX.ringT<=0){DEPFX.ringT=0.34;DEPFX.rk=0;}}
  for(const q of DEPFX.pool){if(!q.s.visible)continue;q.t+=dt*q.sp;if(q.t>=1){q.s.visible=false;continue;}
    const u=q.t,a=(1-u)*(1-u),bb=2*u*(1-u),c=u*u;q.s.position.set(q.a.x*a+q.c.x*bb+HATCH.x*c,q.a.y*a+q.c.y*bb+HATCH.y*c,q.a.z*a+q.c.z*bb+HATCH.z*c);
    q.s.scale.setScalar(0.16+0.13*Math.sin(u*Math.PI));q.s.material.opacity=Math.min(1,u*6)*(1-u*0.35);}
  const rg=DEPFX.ring;DEPFX.rk=Math.min(1,DEPFX.rk+dt*2.6);rg.position.copy(HATCH).addScaledVector(HATCH_N,0.12);rg.lookAt(V3.copy(rg.position).add(HATCH_N));
  rg.scale.setScalar(0.7+DEPFX.rk*1.8);rg.material.opacity=(1-DEPFX.rk)*0.9;}
const CINE={on:false,t:0,dur:6.4,eater:null,yaw:0,pitch:0,nPos:new THREE.Vector3(),nLook:new THREE.Vector3()};
function introStart(){const hp=hullParam(HATCH);hullPoint(hp.z,hp.th,V1,HATCH_N);
  // the astronaut floats just above the nose, looking back along the ship
  const n=new THREE.Vector3(),np=hullPoint(18.5,Math.PI/2,new THREE.Vector3(),n);
  P.pos.copy(np).addScaledVector(n,2.4);P.vel.set(0,0,0);P.yaw=0;P.pitch=-0.24;camYaw=P.yaw;camPitch=P.pitch;
  // a devourer is already chewing the top of the hull...
  const pa=PATCHES.filter(p=>p.z>3&&p.z<15).sort((a,b)=>(Math.abs(a.th-Math.PI/2)+Math.abs(a.z-10)*0.04)-(Math.abs(b.th-Math.PI/2)+Math.abs(b.z-10)*0.04))[0];
  const e=spawnSpider('lurker');e.z=pa.z-0.45;e.th=pa.th;hullPoint(e.z,e.th,e.pos);e.patch=pa;e.state='eat';e.t=0;e.chewT=0;e.cd=9;e.mesh.position.copy(e.pos);pa.hp=CFG.patchHp*0.6;CINE.eater=e;
  // ...two hunters prowl the back and two more walk out on the wings
  for(const [z,th] of [[5.5,1.2],[0.5,1.95]]){const s=spawnSpider('hunter'),f=freeSpot(z,th,1);s.z=f[0];s.th=f[1];hullPoint(s.z,s.th,s.pos);s.state='crawl';s.cd=7.5+Math.random()*2;s.mesh.position.copy(s.pos);}
  for(const sx of [1,-1]){const s=spawnSpider('hunter');s.perch={x:5.8*sx,z:-7,dx:-0.3*sx,dz:1};s.state='perch';s.perchT=7+Math.random()*4;s.t=0;s.pos.set(5.8*sx,wingTop(5.8*sx,-7)??0.4,-7);s.mesh.position.copy(s.pos);}
  toSpawn=2;WB.groups=[5,2];WB.gi=0;WB.left=0;WB.calm=false;
  CINE.on=!window.__noCine;CINE.mode='intro';CINE.t=0;CINE.yaw=P.yaw;CINE.pitch=P.pitch;document.body.classList.toggle('cine',CINE.on);
  if(!CINE.on)startFight();}
function startFight(){CINE.on=false;document.body.classList.remove('cine');P.inv=0;for(const s of spiders)if(s.kind==='hunter'&&s.state==='crawl')s.cd=Math.max(s.cd,2.2+Math.random()*1.5);showMsg('¡NOS ATACAN!','Defiende la nave',2.6);sfx('alert');tip('shoot',2.4);}
function skipCine(){if(CINE.on&&CINE.t>0.4)CINE.t=Math.max(CINE.t,CINE.dur-(CINE.mode==='boss'?0.76:0.7));}
addEventListener('mousedown',skipCine);addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'||e.code==='Escape')skipCine();});addEventListener('touchstart',skipCine,{passive:true});
// opening camera: close on the devourer chewing, rising over the back and the wings, then settling behind the astronaut
function cineCam(dt){CINE.t+=dt;const T=CINE.t,e=CINE.eater,ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
  P.yaw=CINE.yaw;P.pitch=CINE.pitch;P.vel.set(0,0,0);P.inv=1;
  const n=new THREE.Vector3(),c=new THREE.Vector3();hullPoint(e.z,e.th,c,n);const [ha,hb]=hullAB(e.z),tth=new THREE.Vector3(-Math.sin(e.th)*ha,Math.cos(e.th)*hb,0).normalize();
  const l1=e.mesh.position.clone().addScaledVector(n,0.3).add(V3.set(0,0,0.35)),p1=l1.clone().addScaledVector(n,0.75+0.12*T).addScaledVector(tth,-0.55).add(V3.set(0,0,2.5+0.3*T));
  const l2=new THREE.Vector3(5.6,0.8,-6.8),p2=new THREE.Vector3(3.2,3.9,-0.8-0.7*Math.max(0,T-2.4));
  const k2=ease((T-2.3)/1.3),k3=ease((T-4.3)/(CINE.dur-4.3));
  const pos=p1.lerp(p2,k2).lerp(CINE.nPos,k3),look=l1.lerp(l2,k2).lerp(CINE.nLook,k3);
  camera.position.copy(pos);camera.lookAt(look);
  if(T>=CINE.dur)startFight();}

// the first devourer lands from space close to where you are looking
function dropNear(s){const hp=hullParam(P.pos);s.z=THREE.MathUtils.clamp(hp.z+(Math.random()<0.5?-5:5),-13,20);s.th=hp.th+THREE.MathUtils.randFloatSpread(0.6);
  const n=new THREE.Vector3();hullPoint(s.z,s.th,s.pos,n);s.pos.addScaledVector(n,9);s.state='return';s.mesh.position.copy(s.pos);}
function workLeft(){return PATCHES.some(p=>p.hp<CFG.patchHp)||looseCount()>3||P.carry>0;}
function planBursts(n){WB.spitQ=[];const G=wave<1?1:wave<5?2:3,a=[];let r=n;for(let k=0;k<G;k++){const c=k===G-1?r:Math.round(n/G);a.push(c);r-=c;}
  WB.groups=a;WB.gi=0;WB.left=a[0];WB.calm=false;WB.lull=0;WB.spit=false;}
function showMsg(t,sub='',dur=2.5){if(mhudMsg(t,sub,dur,'msg'))return; // v63: phones route it (alert or side feed)
  $('msg').innerHTML=t+(sub?`<small>${sub}</small>`:'');$('msg').style.opacity=1;msgT=dur;}
function crossHit(){const c=$('cross');c.classList.add('hit');clearTimeout(crossHit.t);crossHit.t=setTimeout(()=>c.classList.remove('hit'),120);}
function crossCrit(){const c=$('cross');c.classList.add('crit');clearTimeout(crossCrit.t);crossCrit.t=setTimeout(()=>c.classList.remove('crit'),180);}
function damagePlayer(d,dir){if(P.inv>0||state!=='play')return;P.hp=Math.max(0,P.hp-d);P.inv=0.9;P.lastHit=playT;xpBreak();
  AN.pitchV+=(Math.random()-0.3)*7;AN.rollV+=(Math.random()-0.5)*9;
  if(P.hp>0&&P.hp<30)say('pl_low',4,{cd:20});else if(P.hp>0)say('pl_hit',2,{cd:25});
  $('dash').classList.add('hit');setTimeout(()=>$('dash').classList.remove('hit'),260);$('hVit').classList.add('hit','hot');setTimeout(()=>$('hVit').classList.remove('hit'),260);
  P.vel.addScaledVector(dir.clone().normalize(),6);$('flash').style.opacity=1;setTimeout(()=>$('flash').style.opacity=0,120);sfx('hurt');shake(0.32);
  // a bite knocks cargo out of the tank: it floats nearby and can be recovered
  if(P.carry>0){const n=Math.min(P.carry,Math.ceil(P.carry*CFG.spillFrac)+2);P.carry-=n;const k=spawnLoose(P.pos.clone().addScaledVector(UP,0.3),n,4.5);lostN+=n-k;
    floatText(P.pos.clone().addScaledVector(UP,0.9),'−'+n+' carga','loss');sfx('spill');tutorialEvent('spill');}
  if(P.hp<=0)endGame(false,'dead');}
let cloudPlan=-1,cloudLastW=-9;
function spawnCloud(){let best=null;for(let k=0;k<24;k++){const a=Math.random()*Math.PI*2,r=10+Math.random()*5,p=new THREE.Vector3(Math.cos(a)*r*1.2,Math.sin(a)*r*0.9+1,26+Math.random()*6);
    if(rockAt(p,5)||Math.abs(p.x)<6&&Math.abs(p.y)<6)continue;best=p;break;}
  if(!best)best=new THREE.Vector3(14,6,28);const n=Math.max(40,Math.min(150+Math.floor(Math.random()*30),CFG.cargo-cargo-looseCount()-P.carry));let k=0; // never enough to overfill the ship
  for(let i=0;i<DN&&k<n;i++){if(dAlive[i])continue;const j=i*3,v=new THREE.Vector3().randomDirection().multiplyScalar(0.6+Math.cbrt(Math.random())*3.2);v.y*=0.6;
    dPos[j]=best.x+v.x;dPos[j+1]=best.y+v.y;dPos[j+2]=best.z+v.z;dHome[j]=dPos[j];dHome[j+1]=dPos[j+1];dHome[j+2]=dPos[j+2];dVel[j]=dVel[j+1]=dVel[j+2]=0;
    dAlive[i]=1;dCap[i]=0;dMag[i]=0;dAge[i]=-14;k++;}
  dGeo.attributes.position.needsUpdate=true;stats.clouds=(stats.clouds||0)+1;
  showMsg('¡NUBE DE TRICOMAS!','Recógela antes de que se pierda en el vacío',2.8);tutorialEvent('cloud');say('cloud',3);sfx('drop',best);return k;}
function startWave(i){wave=i;const W=waveDef(i);WB.bossT=0;eggPlan=[];cloudPlan=-1;if(i>=2&&cargo<CFG.cargo*0.6){cloudPlan=0.2+Math.random()*0.3;cloudLastW=i;}if(spitFirstW>=0&&i>=spitFirstW+2&&!isIncRound(i)&&(i===(isIncRound(spitFirstW+2)?spitFirstW+3:spitFirstW+2)||(i-eggLastW>=2&&Math.random()<(i-eggLastW>=4?0.9:0.45)))){eggPlan.push(0.3+Math.random()*0.35);eggLastW=i;if(i>=spitFirstW+6&&Math.random()<0.3)eggPlan.push(0.65+Math.random()*0.25);}toSpawn=isIncRound(i)?Math.min(W.n,7):W.n;spawnT=i===0?4:0.5;inBreak=false;breakT=0;skipReq=false;planBursts(toSpawn);if(i===5&&spitN===0){WB.bossT=2.9;WB.spit=true;spawnT=5.5;}
  WB.incT=0;WB.rt=0;if(isIncRound(i)){WB.incT=3.2;WB.spit=true;spawnT=incN===0?7:2;}dropsRound=0;roundLost0=lostN;
  const sub=i===0?'':i===1?'Ahora vienen a comerse la nave':isIncRound(i)?'Algo enorme se acerca…':`${W.n} arañas`;
  if(i>0){showMsg('RONDA '+(i+1),sub,2.6);sfx('alert');}
  if(i===0)say('int_03',3,{queue:true});
  else{const L=['rnd_start_01','rnd_start_02','rnd_start_03','rnd_start_04','rnd_start_05'];say(L[Math.floor(Math.random()*L.length)],2,{queue:true});}}
function reset(){TC.ap=null;if(TC.paused)tcSetPause(false);setTimeout(tcOrient,0);
  for(const s of [...spiders])scene.remove(s.mesh);spiders.length=0;
  for(const b of bullets)scene.remove(b.m);bullets.length=0;
  for(const g of gibs)scene.remove(g.m);gibs.length=0;
  P.pos.set(10,1.2,9);P.vel.set(0,0,0);P.yaw=Math.PI/2+0.35;P.pitch=0.12;P.hp=CFG.hpMax;P.thrust=null;AN.init=false;P.inv=0;P.lastHit=-99;P.dashCD=0;P.jam=0;
  P.carry=0;P.depAcc=0;P.depBatch=0;P.depActive=false;P.depDone=0;P.depLeft=0;P.fullWarn=0;P.intake=0;camYaw=P.yaw;camPitch=P.pitch;camOrbit=0;showcaseT=0;
  cargo=CFG.cargo;score=0;repairs=0;lostN=0;for(const k in stats)stats[k]=0;spitFirstW=-1;eggLastW=-9;cloudPlan=-1;cloudLastW=-9;CB_.last=undefined;CB_.warned=0;xpEnd(true);XP.streak=0;xpPips();P.ammo=CFG.gunCap;P.gunLock=0;lastCallW=-1;for(const e of EGGS)scene.remove(e.g);EGGS.length=0;eggPlan=[];playT=0;R.pa=null;R.on=false;hitStop=0;
  pts=0;PU.dbl=0;PU.over=0;PU.weld=0;PU.pack=0;bulletMat.color.setRGB(3,2.2,0.9);for(const d of [...DROPS])removeDrop(d);lastDrop=-99;CB.n=0;CB.hs=0;CB.heads=0;CB.t=-9;MAG.on=false;EXP.n=0;dMag.fill(0);
  for(const pa of PATCHES){pa.hp=CFG.patchHp;pa.prog=0;pa.leak=0;pa.noPerf=false;}TUT.q.length=0;for(const a of ACID){scene.remove(a.m);for(const q of a.drops)scene.remove(q.d);}ACID.length=0;P.burn=0;spitN=0;incN=0;WB.incT=0;for(const e of INCS)scene.remove(e.B.g);INCS.length=0;incBeamSnd(false);for(const p of MIST){p.life=0;p.s.visible=false;}for(const Z of ZONES){Z.nest=false;Z.alarmT=0;Z.eaters=0;}
  fxLayer.innerHTML='';document.body.classList.remove('ended');
  resetDust();startWave(0);introStart();resumeTut();rankStart();}
