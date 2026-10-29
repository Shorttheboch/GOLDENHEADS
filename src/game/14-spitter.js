// ---- the spitter: a big armoured spider that parks on the hull and lobs molten acid at you ----
const ACID=[];const acidGeo=new THREE.IcosahedronGeometry(0.16,2);const dropGeo=new THREE.IcosahedronGeometry(0.07,1);const acidMat=new THREE.MeshBasicMaterial({color:new THREE.Color(1.15,0.42,0.02)}); // saturated venom orange (kept below the bloom threshold so it reads as liquid, not light)
const acidHalo=glowTex('rgba(255,170,60,1)','rgba(255,70,10,.45)');
let spitN=0,spitFirstW=-1,eggLastW=-9;
function spawnSpitter(cine=false){spitN++;if(spitN===1)spitFirstW=wave;const k=spitN-1,s=spawnSpider('spitter');s.gen=spitN;
  s.mesh.scale.setScalar(Math.min(2.7,1.75+(spitN>=3?0.3+(spitN-3)*0.15:spitN===2?0.1:0)));
  s.hp=s.maxHp=Math.round((40+wave*4)*(1+0.18*k));s.spd=0.75+Math.min(0.5,k*0.08);s.cd=Math.max(1.2,2.2-k*0.2);s.spits=0;
  $('boss').firstChild.textContent='ESCUPIDORA'+(spitN>1?' '+['','II','III','IV','V','VI','VII','VIII','IX','X'][Math.min(9,k)]:'');
  const hp=hullParam(P.pos);s.z=THREE.MathUtils.clamp(hp.z+(Math.random()<0.5?-8:8),-13,20);s.th=hp.th+THREE.MathUtils.randFloatSpread(0.5);
  s.slotZ=(s.z>hp.z?1:-1)*(4.5+Math.random()*3);s.slotTh=THREE.MathUtils.randFloatSpread(0.7);
  if(cine){s.th=Math.PI/2+0.5;s.z=3.6;} // the cylindrical mid-ship: no hull curve between the lens and the spider
  const n=new THREE.Vector3();hullPoint(s.z,s.th,s.pos,n);
  // it drops out of the sky like a meteor and smashes into the hull
  s.fall={tgt:s.pos.clone(),n:n.clone(),v:cine?14:18,cine};s.pos.addScaledVector(n,cine?48:46);s.state='fall';s.mesh.position.copy(s.pos);orient(s.mesh,new THREE.Vector3(0,0,1).addScaledVector(n,-n.z).normalize(),n);
  if(cine){for(const sh of shards)sh.visible=false;CINE.on=true;CINE.mode='boss';CINE.t=0;CINE.dur=4.1;CINE.boss=s;document.body.classList.add('cine');}
  else showMsg('¡CUIDADO ARRIBA!','Algo enorme cae sobre la nave',1.8);
  return s;}
// impact: shockwave, sparks, a dented plate, the whole ship shakes
function spitterLand(s){const F=s.fall;s.pos.copy(F.tgt);{const U=s.mesh.userData;s.mesh.position.copy(s.pos).addScaledVector(F.n,U.rig?U.rig.spd.rootOff*s.mesh.scale.x:0.28);}s.state='crawl';s.cd=Math.max(s.cd,1.6);s.fall=null;FALLFX.trail.visible=false;s.idleT=F.cine?2.4:1.0;s.landK=1;
  {const fw=(F.cine&&CINE.camN?V2.subVectors(CINE.camN,F.tgt):V2.subVectors(P.pos,F.tgt));fw.addScaledVector(F.n,-fw.dot(F.n));if(fw.lengthSq()>1e-4){fw.normalize();orient(s.mesh,fw,F.n);s.face=fw.clone();}} // lands facing the lens (or you)
  const RG=s.mesh.userData.rig;if(RG&&RG.ab){RG.ab.sqv-=1.5;}
  for(const c of [0xffb040,0x8a6a40,0x7a0a06])burst(F.tgt,c,24);if(F.snd){try{F.snd.g.gain.setTargetAtTime(0,AC.currentTime,0.03);F.snd.s.stop(AC.currentTime+0.25);}catch(e){}}sfx('impact');if(!SFXB||!SFXB.impact)sfx('crack',F.tgt);shake(F.cine?0.45:0.75);
  let best=null,bd=9;for(const pa of PATCHES){const d=pa.pos.distanceTo(F.tgt);if(d<bd){bd=d;best=pa;}}if(best&&state==='play')damagePatch(best,10);
  const away=V1.subVectors(P.pos,F.tgt),dd=away.length();if(dd<9&&dd>0.01)P.vel.addScaledVector(away.normalize(),10*(1-dd/9));
  showMsg('¡ESCUPIDORA!','Mátala antes de que destroce la nave · esquiva su ácido con Shift',3.0);say('sp_land',4);}
const FALLFX={};
{FALLFX.trail=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,230,200,1)','rgba(255,90,30,.55)'),color:new THREE.Color(3,1.2,0.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
 FALLFX.trail.visible=false;scene.add(FALLFX.trail);
 FALLFX.ring=new THREE.Mesh(new THREE.RingGeometry(0.55,1,48),new THREE.MeshBasicMaterial({color:new THREE.Color(3,1.6,0.6),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
 FALLFX.ring.visible=false;scene.add(FALLFX.ring);FALLFX.ringT=9;}
function updateFall(s,dt){const F=s.fall;F.v=Math.min(70,F.v+(F.cine?40:55)*dt);const d=V2.subVectors(F.tgt,s.pos),L=d.length();
  if(!F.snd&&AC&&SFXB&&SFXB.fall&&SFXB.fall.length){if(F.take==null)F.take=Math.floor(Math.random()*SFXB.fall.length);const a=F.cine?40:55,eta=(-F.v+Math.sqrt(F.v*F.v+2*a*L))/a;
    if(eta<=SFXB.fall[F.take].duration)F.snd=playTake('fall',F.take,0.75);}
  if(L<=F.v*dt+0.05||d.dot(F.n)>0){spitterLand(s);return;}
  s.pos.addScaledVector(d.normalize(),F.v*dt);s.mesh.position.copy(s.pos);
}
function updateFallFX(dt){if(FALLFX.ringT<0.9){FALLFX.ringT+=dt;const k=FALLFX.ringT/0.9;FALLFX.ring.scale.setScalar(0.5+k*6.5);FALLFX.ring.material.opacity=(1-k)*(1-k);if(k>=1)FALLFX.ring.visible=false;}}
// the camera for the first drop: down on the hull a few metres away, low and looking slightly up (it looks gigantic),
// the spitter smashes into the ship right in front of the lens, everything shakes, then it settles, sways its abdomen and stares
// is the straight line a->b clear of the hull (real surface), the wings and the nacelles?
function hullClear(a,b){for(let k=1;k<24;k++){const p=V3.lerpVectors(a,b,k/24);if(wingAt(p))return false;
    if(p.z>-14.5&&p.z<21.5){const hp=hullParam(p),q=hullPoint(hp.z,hp.th,_hcq,_hcn);if(V1.subVectors(p,q).dot(_hcn)<0.35)return false;}}return true;}
const _hcq=new THREE.Vector3(),_hcn=new THREE.Vector3();
// the first drop: a low lens on the hull, a few metres away; it tilts up to the sky and follows the spitter all the way down
// (always whole in frame), the spitter lands on its feet, sinks with the blow and holds; the lens takes the jolt
function bossCam(dt){CINE.t+=dt;const s=CINE.boss;P.inv=Math.max(P.inv,1);P.vel.multiplyScalar(0.9);
  if(s&&s.state==='fall'&&CINE.t>=CINE.dur-0.75){if(s.isInc)incFall(s,99);else updateFall(s,99);} // skipped: land now
  if(!CINE.camN&&s){const F=s.fall,tg=F?F.tgt:s.pos,hp=hullParam(tg);CINE.n=(F?F.n:UP).clone();
    // low lens on the straight mid-ship, ~4 m along the hull, just high enough that nothing hides the whole spider
    const sc=s.mesh.scale.x,base=tg.clone().addScaledVector(CINE.n,0.3*sc),top=tg.clone().addScaledVector(CINE.n,(s.topH||1.6)*sc);
    const n0=new THREE.Vector3(),foot=hullPoint(hp.z+(s.camD||4.2),hp.th,new THREE.Vector3(),n0),cam=new THREE.Vector3();let h=0.85;
    for(;h<5;h+=0.2){cam.copy(foot).addScaledVector(n0,h);if(hullClear(cam,base)&&hullClear(cam,top))break;}
    CINE.camN=cam;pushOutOfRocks(CINE.camN,1.5,null);
    CINE.look=s.pos.clone();CINE.landT=-1;camPos.copy(CINE.camN);}
  if(s){const sc=s.mesh.scale.x;CINE.look.lerp(V2.copy(s.pos).addScaledVector(CINE.n,(s.lookH||0.75)*sc),1-Math.exp(-(s.fall?20:6)*dt)); // centred on the spitter, falling or standing
    if(!s.fall){if(CINE.landT<0)CINE.landT=0;CINE.landT+=dt;if(CINE.landT<0.6)shake(0.32*(1-CINE.landT/0.6));}}
  camPos.copy(CINE.camN);camera.position.copy(camPos); // hard cut to the drop lens (the follow camera must not pull it back)
  if(CINE.landT>=0&&CINE.landT<0.8){const k=CINE.landT;camera.position.addScaledVector(CINE.n,-0.35*Math.exp(-k*6)*Math.cos(k*26));} // the hull kicks under the lens
  camera.lookAt(CINE.look);
  const fv=70;if(Math.abs(camera.fov-fv)>0.01){camera.fov=fv;camera.updateProjectionMatrix();}
  if(CINE.t>=CINE.dur){for(const sh of shards)sh.visible=true;CINE.on=false;CINE.mode='';CINE.camN=null;if(CINE.boss&&!CINE.boss.isInc){const b=CINE.boss;b.cd=Math.max(b.cd,1.4);b.idleT=0;b.idle0=0;if(b.state==='windup'){b.state='crawl';b.t=0;}}CINE.boss=null;document.body.classList.remove('cine');}}


