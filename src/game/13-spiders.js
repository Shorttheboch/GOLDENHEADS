/* ================= SPIDERS ================= */
// Four kinds with their own look and behaviour.
// hunter: classic leaper · flanker: small, fast · lurker: big, tough · thief: steals cargo and runs to the breach
const SKIN={hunter:{body:0xc4160e,leg:0x4a0805,mark:0x160202,eye:0xffd23a,scale:1,hp:0},
  flanker:{body:0xff5418,leg:0x6a1606,mark:0x2a0602,eye:0xfff07a,scale:0.78,hp:-1},
  lurker:{body:0x6e0810,leg:0x220306,mark:0xff2a2a,eye:0xff5030,scale:1.38,hp:2},
  thief:{body:0xa8120c,leg:0x3a0705,mark:0xffc24a,eye:0x9ff8ff,scale:0.9,hp:-1},
  spitter:{body:0x8a1008,leg:0x2a0503,mark:0xff7a30,eye:0xffb040,scale:1.75,hp:30},
  brood:{body:0xe0200c,leg:0x5a0805,mark:0x200202,eye:0xffe060,scale:0.42,hp:-99}};
const NI=g=>g.index?g.toNonIndexed():g;
const SG=(()=>{ // shared low-poly parts, built once
  const ceph=new THREE.IcosahedronGeometry(0.34,1);ceph.scale(1,0.6,1.15);
  const ridge=NI(new THREE.ConeGeometry(0.06,0.5,4).rotateX(Math.PI/2));ridge.scale(1,0.6,1);ridge.translate(0,0.19,-0.02);
  const fangL=NI(new THREE.ConeGeometry(0.045,0.22,5).rotateX(Math.PI*0.62));fangL.translate(0.07,-0.1,0.38);
  const fangR=fangL.clone();fangR.translate(-0.14,0,0);
  const abd=new THREE.IcosahedronGeometry(0.5,1);abd.scale(0.95,0.8,1.25);abd.translate(0,0.14,-0.66);
  const spin=NI(new THREE.ConeGeometry(0.08,0.18,5).rotateX(-Math.PI/2));spin.translate(0,0.08,-1.27);
  const plates=[];for(let k=0;k<3;k++){const pl=NI(new THREE.BoxGeometry(0.44-k*0.1,0.05,0.13));pl.rotateX(-0.28+k*0.3);pl.translate(0,0.52-k*0.05,-0.42-k*0.27);plates.push(pl);}
  const eyes=[];for(const [x,y,z,r] of [[0.09,0.13,0.37,0.058],[-0.09,0.13,0.37,0.058],[0.18,0.1,0.29,0.036],[-0.18,0.1,0.29,0.036],[0.05,0.2,0.31,0.03],[-0.05,0.2,0.31,0.03]]){
    const e=new THREE.OctahedronGeometry(r,0);e.translate(x,y,z);eyes.push(e);}
  const strip=g=>{g.deleteAttribute('uv');return g;};
  return {body:mergeGeometries([ceph,ridge,fangL,fangR].map(strip)),abdomen:mergeGeometries([abd,spin].map(strip)),mark:mergeGeometries(plates.map(strip)),
    eye:mergeGeometries(eyes.map(strip)),
    femur:mergeGeometries([NI(new THREE.CylinderGeometry(0.036,0.054,0.62,5).rotateX(Math.PI/2).translate(0,0,0.31)),NI(new THREE.SphereGeometry(0.058,6,4).translate(0,0,0.62))].map(strip)),
    tibia:strip(NI(new THREE.CylinderGeometry(0.007,0.04,0.74,5).rotateX(Math.PI/2).translate(0,0,0.37))),
    sack:new THREE.IcosahedronGeometry(0.28,1)};})();
const spiders=[];
/* ================= SPIDER (rigged GLB + procedural IK) ================= */
// rest data exported from Blender (model space: origin on the ground, +Z forward, +Y up)
let SPIDER_GLB=null,CRAB_GLB=null,EGG_GLB=null,BIPED_GLB=null;
// ---- eggs (Santi's EGG_v1): laid on the hull from the round after the first spitter; they throb faster and faster, then burst into a brood ----
const EGGS=[],EGG_S=0.8;let eggPlan=[];
function layEgg(z,th,RK,rd){const n=new THREE.Vector3();let p;if(RK){n.copy(rd);p=RK.c.clone().addScaledVector(rd,rockR(RK,rd));}else{[z,th]=freeSpot(z,th,1);p=hullPoint(z,th,new THREE.Vector3(),n);}
  let m;if(EGG_GLB){m=EGG_GLB.scene.clone(true);m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.castShadow=true;}});}
  else m=new THREE.Mesh(new THREE.SphereGeometry(0.4,20,16).scale(1,1.25,1).translate(0,0.5,0),new THREE.MeshStandardMaterial({color:0x4a0808,emissive:0xff3010,emissiveIntensity:0.3,roughness:0.25}));
  const g=new THREE.Group();g.add(m);g.position.copy(p);g.quaternion.setFromUnitVectors(UP,n);g.scale.setScalar(0.01);scene.add(g);
  const mats=[];m.traverse(o=>{if(o.isMesh)mats.push(o.material);});
  const e={g,mats,z,th,RK,rd:rd&&rd.clone(),n:n.clone(),pos:p.clone().addScaledVector(n,0.45*EGG_S),t:0,hatch:7.5,hp:8+Math.floor(wave/2),ph:0,flash:0};EGGS.push(e);
  burst(p,0x8a0a0a,16);sfx('nest',p);floatText(e.pos.clone().addScaledVector(n,0.9),'¡HUEVO!','loss');
  if(!stats.eggs)showMsg('¡UN HUEVO!','Destrúyelo antes de que eclosione',2.6);say('egg',3,{cd:40});stats.eggs++;return e;}
function updateEggs(dt,t){for(let i=EGGS.length-1;i>=0;i--){const e=EGGS[i];if(state==='play'&&!CINE.on)e.t+=dt;const k=Math.min(1,e.t/e.hatch),grow=Math.min(1,e.t/0.6);
    e.ph+=dt*(1.1+k*k*4.5);const bt=Math.pow(Math.max(0,Math.sin(e.ph*Math.PI*2)),8); // heartbeat, faster as it nears hatching
    const s=EGG_S*grow*(1+0.05*bt*(1+k))*(1+(k>0.85?0.02*Math.sin(t*45):0));e.g.scale.set(s*(1-0.025*bt),s*(1+0.06*bt*(1+k)),s*(1-0.025*bt));
    e.flash=Math.max(0,e.flash-dt*6);for(const m of e.mats)if(m.emissive)m.emissiveIntensity=0.5+k*1.4+bt*(1+3*k)+e.flash*4;
    if(bt>0.9&&!e.beat){e.beat=1;sfx('thump',e.pos);}else if(bt<0.3)e.beat=0;
    if(e.t>=e.hatch)hatchEgg(e,i);}}
function hatchEgg(e,i){EGGS.splice(i,1);scene.remove(e.g);
  for(let k=0;k<3;k++)burst(e.pos,k?0x6a0606:0xff5020,24);sfx('crack',e.pos);sfx('splat',e.pos);shake(Math.max(0.08,0.35-e.pos.distanceTo(P.pos)*0.015));
  const n=Math.min(12,6+Math.floor(wave/3)),hp=1+Math.floor(Math.max(0,wave-6)/5);
  for(let k=0;k<n;k++){const s=spawnSpider('brood'),a=k/n*Math.PI*2;
    if(e.RK){s.pos.copy(e.pos);landOnRock(s,e.RK);s.rd.copy(e.rd).add(new THREE.Vector3().randomDirection().multiplyScalar(0.35)).normalize();s.pos.copy(e.RK.c).addScaledVector(s.rd,rockR(e.RK,s.rd));s.mesh.position.copy(s.pos);s.cd=0.3+Math.random()*1.2;s.aggr=1;continue;}
    const f=freeSpot(e.z+Math.cos(a)*0.9,e.th+Math.sin(a)*0.25,0);s.z=f[0];s.th=f[1];hullPoint(s.z,s.th,s.pos);
    s.state='crawl';s.hp=hp;s.cd=0.3+Math.random()*1.2;s.aggr=1;s.mesh.position.copy(s.pos);}
  showMsg('¡CRÍAS!','Muchas y rápidas · no comen la nave, van a por ti',2.2);sfx('alert');say('hatch',3,{cd:30});}
function destroyEgg(e){EGGS.splice(EGGS.indexOf(e),1);scene.remove(e.g);for(let k=0;k<3;k++)burst(e.pos,k?0x6a0606:0xffb040,18);sfx('splat',e.pos);sfx('kill',e.pos);
  addPts(150);floatText(e.pos.clone().addScaledVector(e.n,0.9),'HUEVO DESTRUIDO +'+ptsVal(150),'pts');stats.eggsKilled++;}
// a crawling spider away from you lays the egg
function tryLayEgg(){const r=spiders.filter(s=>s.state==='rock'&&s.kind!=='brood'&&s.pos.distanceTo(P.pos)>6);if(r.length&&Math.random()<0.6){const s=r[Math.floor(Math.random()*r.length)];layEgg(0,0,s.rock,s.rd);s.cd=Math.max(s.cd,1.5);return true;}
  const c=spiders.filter(s=>(s.state==='crawl'||s.state==='eat')&&s.kind!=='brood'&&s.kind!=='spitter'&&s.pos.distanceTo(P.pos)>7&&s.pos.distanceTo(HATCH)>4);
  if(!c.length)return false;const s=c[Math.floor(Math.random()*c.length)];layEgg(s.z,s.th);s.cd=Math.max(s.cd,1.5);return true;}
const SPD={tips:{R1:[0.4868,0.0351,0.9445],L1:[-0.4868,0.0351,0.9445],R2:[0.9357,0.0221,0.6481],L2:[-0.9357,0.0221,0.6481],
  R3:[1.2288,0.0053,0.1757],L3:[-1.2288,0.0053,0.1757],R4:[1.1152,0,-0.6115],L4:[-1.1152,0,-0.6115]},
  abdTail:[0,0.47,-1.15],sack:[0.0293,0.8082,-0.6566],head:[0.013,0.415,0.32],rootOff:0.28};
// the spitter (Santi's crab, SPIDER_v3: leg vertex groups and leg bumps re-bound to the right bones in Blender)
const CRD={tips:{R1:[0.9947,0.0647,0.7054],L1:[-0.9947,0.0647,0.7054],R2:[1.2291,0.0648,0.1752],L2:[-1.2291,0.0648,0.1752],
  R3:[1.1367,0.083,-0.3172],L3:[-1.1367,0.083,-0.3172],R4:[1.2034,0.0638,-0.7792],L4:[-1.2034,0.0638,-0.7792]},
  vgMap:{R1:'L4',R2:'L3',R3:'L2',R4:'L1',L1:'R4',L2:'R3',L3:'R2',L4:'R1'},
  abdTail:[0,0.52,-1.348],sack:[0,0.9,-0.6],head:[0.02,0.31,0.235],rootOff:0.3,homeK:0.86}; // feet planted a bit inward: at its size the hull curves away under the legs
const LEGN=['L1','R1','L2','R2','L3','R3','L4','R4'];
const GAIT_A=new Set(['L1','R2','L3','R4']); // alternating tetrapod gait: A legs swing while B legs hold, then swap
const SK_TINT={brood:[1.55,0.5,0.3],spitter:[1,1,1],hunter:[1,1,1],flanker:[1.35,0.8,0.5],lurker:[0.5,0.32,0.36],thief:[0.95,0.78,0.7]};
const GIB_MAT=new THREE.MeshStandardMaterial({color:0x4a0505,metalness:0.2,roughness:0.22,flatShading:true});
const _sq1=new THREE.Quaternion(),_sq2=new THREE.Quaternion(),_sq3=new THREE.Quaternion(),_sq4=new THREE.Quaternion(),_se=new THREE.Euler();
const _sa=new THREE.Vector3(),_sb=new THREE.Vector3(),_sc=new THREE.Vector3(),_sd=new THREE.Vector3(),_su=new THREE.Vector3(),_sv=new THREE.Vector3();
const _fa=new THREE.Vector3(),_fb=new THREE.Vector3(),_ft=new THREE.Vector3();
const sdamp=(a,b,l,dt)=>a+(b-a)*(1-Math.exp(-l*dt));

function makeSpiderRig(kind){
  const S=SKIN[kind];const g=new THREE.Group();
  const crab=kind==='spitter'&&CRAB_GLB,D=crab?CRD:SPD;
  const inner=skClone((crab?CRAB_GLB:SPIDER_GLB).scene);inner.position.y=-D.rootOff;inner.updateMatrixWorld(true);
  const B={},mats={};
  inner.traverse(o=>{
    if(o.isBone)B[o.name]=o;
    if(o.isMesh){o.frustumCulled=false;o.castShadow=true;
      let m=o.material.clone();
      if(isTouch&&m.isMeshPhysicalMaterial){const sm=new THREE.MeshStandardMaterial();THREE.MeshStandardMaterial.prototype.copy.call(sm,m);m=sm;}
      m.side=THREE.FrontSide;o.material=m;
      const nm=m.name||'';mats[nm.includes('Eye')?'eye':nm.includes('Fang')?'fang':nm.includes('Tube')?'tube':'body']=m;}});
  const tint=SK_TINT[kind]||SK_TINT.hunter;mats.body.color.setRGB(tint[0],tint[1],tint[2]);
  if(mats.eye)mats.eye.userData.e0=mats.eye.emissive.clone();
  for(const m of Object.values(mats))m.userData.ei0=m.emissiveIntensity;
  const R={inner,body:B.body,abd:B.abdomen,fL:B.fang_L,fR:B.fang_R,spit:B.spit||null,legs:[],mats,spd:D,crab:!!crab,ph:Math.random()*6.28};
  R.headL=B.body.worldToLocal(inner.localToWorld(new THREE.Vector3(...D.head))); // between the eyes, in the body bone's space
  // rest frames: every procedural offset is expressed in the parent's rest (model) frame
  for(const b of [R.body,R.abd,R.fL,R.fR]){const u=b.userData;u.q0=b.quaternion.clone();u.p0=b.position.clone();
    u.pq=b.parent.getWorldQuaternion(new THREE.Quaternion());u.pqi=u.pq.clone().invert();}
  const tl=R.abd.worldToLocal(inner.localToWorld(new THREE.Vector3(...D.abdTail)));
  const ta=[Math.abs(tl.x),Math.abs(tl.y),Math.abs(tl.z)];R.abdAx=ta.indexOf(Math.max(...ta));
  for(const n of LEGN){const bs=[0,1,2,3,4].map(i=>B['leg_'+(D.legMap?D.legMap[n]:n)+'_'+i]);
    const L={n,bs,A:GAIT_A.has(n),side:n[0]==='L'?-1:1,pair:+n[1],q0:bs.map(b=>b.quaternion.clone()),ax:[],len:[0,0,0,0,0],
      home:new THREE.Vector3(...D.tips[n]).multiply(new THREE.Vector3(D.homeK||1,1,D.homeK||1)).add(new THREE.Vector3(0,-D.rootOff,0)),hw:new THREE.Vector3(),
      p:[0,1,2,3,4,5].map(()=>new THREE.Vector3()),f:new THREE.Vector3(),from:new THREE.Vector3(),st:0,dur:0.15,step:false,ov:false};
    for(let i=0;i<4;i++)L.ax.push(bs[i+1].position.clone().normalize());
    L.tipL=bs[4].worldToLocal(inner.localToWorld(new THREE.Vector3(...D.tips[n])));L.ax.push(L.tipL.clone().normalize());
    R.legs.push(L);}
  let sack=null;
  if(kind==='thief'){sack=new THREE.Mesh(SG.sack,new THREE.MeshStandardMaterial({color:0xffc24a,emissive:0xffa21c,emissiveIntensity:1.6,metalness:0.3,roughness:0.3,flatShading:true}));
    sack.position.copy(R.abd.worldToLocal(inner.localToWorld(new THREE.Vector3(SPD.sack[0],SPD.sack[1]+0.04,SPD.sack[2]))));
    sack.scale.setScalar(0.001);R.abd.add(sack);}
  g.add(inner);g.scale.setScalar(S.scale);
  const gibLegs=[0,1,2,3,4,5].map(()=>({lo:{material:GIB_MAT}}));
  g.userData={rig:R,legs:gibLegs,mBody:mats.body,mEye:mats.eye,sack,S};scene.add(g);return g;}
function makeSpider(kind){return SPIDER_GLB?makeSpiderRig(kind):makeSpiderOld(kind);}
// ---- four-armed biped spider (Santi, SPIDER_BIPED_v1): 1 m tall at scale 1, origin between the feet, faces +Z,
// 31 in-place clips at 24 fps (the game moves and turns the entity). One material: the orange tubes/core/veins are the emissive map.
const BIPED_LOOP=new Set(['Idle','Walk','Run','Strafe_L','Strafe_R','Beam_Loop','FloorAttack','Guard_Loop','Electrocuted','ZeroG_Float','Grip_Idle']);
function makeBiped(scale=1){if(!BIPED_GLB)return null;
  const g=new THREE.Group(),inner=skClone(BIPED_GLB.scene),bones={};let mat=null;
  inner.traverse(o=>{if(o.isBone)bones[o.name]=o;
    if(o.isMesh){o.frustumCulled=false;o.castShadow=true;let m=o.material.clone();
      if(isTouch&&m.isMeshPhysicalMaterial){const sm=new THREE.MeshStandardMaterial();THREE.MeshStandardMaterial.prototype.copy.call(sm,m);m=sm;}
      o.material=m;mat=m;}});
  g.add(inner);g.scale.setScalar(scale);
  const mixer=new THREE.AnimationMixer(inner),acts={};
  for(const c of BIPED_GLB.animations){const a=mixer.clipAction(c);const loop=BIPED_LOOP.has(c.name);a.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,Infinity);a.clampWhenFinished=!loop;acts[c.name]=a;}
  const B={g,inner,bones,mixer,acts,mat,e0:mat?mat.emissiveIntensity:1,cur:null,curName:'',ev:{},
    // crossfade to a clip (0.15-0.25 s); one-shots stop on their last frame
    play(name,fade=0.2,speed=1){const a=acts[name];if(!a)return null;a.timeScale=speed;if(B.cur===a)return a;
      a.reset();a.setEffectiveWeight(1);a.play();if(B.cur)B.cur.crossFadeTo(a,fade,false);B.cur=a;B.curName=name;B.ev={};return a;},
    // fire a clip event once when the playing clip passes frame f (24 fps)
    at(f){const a=B.cur;if(!a||B.ev[f])return false;if(a.time>=f/24){B.ev[f]=1;return true;}return false;},
    done(){const a=B.cur;return !!a&&!BIPED_LOOP.has(B.curName)&&a.time>=a.getClip().duration-1e-3;},
    glow(k){if(mat)mat.emissiveIntensity=B.e0*k;},
    update(dt){mixer.update(dt);}};
  B.play('Idle',0);return B;}

// rotate a bone by qm, given in its parent's rest frame (= model axes): +X pitch (head down / tail up), +Y yaw (left), +Z roll
function sBoneRot(b,qm){const u=b.userData;b.quaternion.copy(u.pqi).multiply(qm).multiply(u.pq).multiply(u.q0);}
function sHull(p,out){if(_rockS){_rk.subVectors(p,_rockS.c).normalize();return out.copy(_rockS.c).addScaledVector(_rk,rockR(_rockS,_rk));}if(_perch){const y=wingTop(p.x,p.z);if(y!==null){out.set(p.x,y,p.z);return out;}}const hp=hullParam(p);return hullPoint(hp.z,hp.th,out);}
// FABRIK on the 5-segment leg; starting every frame from the rest pose keeps the knee arched upwards
// FABRIK on the first n segments (p[0]..p[n])
const _t4=new THREE.Vector3();
function sFabrikN(p,len,T,n){let tot=0;for(let i=0;i<n;i++)tot+=len[i];_fb.copy(p[0]);_ft.copy(T);
  if(_ft.distanceTo(_fb)>tot*0.995)_ft.sub(_fb).setLength(tot*0.995).add(_fb);
  for(let it=0;it<10;it++){
    p[n].copy(_ft);for(let i=n-1;i>=0;i--){_fa.subVectors(p[i],p[i+1]).setLength(len[i]);p[i].copy(p[i+1]).add(_fa);}
    p[0].copy(_fb);for(let i=0;i<n;i++){_fa.subVectors(p[i+1],p[i]).setLength(len[i]);p[i+1].copy(p[i]).add(_fa);}
    if(p[n].distanceToSquared(_ft)<1e-6)break;}}
function sFabrik(p,len,T){
  const tot=len[0]+len[1]+len[2]+len[3]+len[4];_fb.copy(p[0]);_ft.copy(T);
  if(_ft.distanceTo(_fb)>tot*0.995)_ft.sub(_fb).setLength(tot*0.995).add(_fb);
  for(let it=0;it<10;it++){
    p[5].copy(_ft);for(let i=4;i>=0;i--){_fa.subVectors(p[i],p[i+1]).setLength(len[i]);p[i].copy(p[i+1]).add(_fa);}
    p[0].copy(_fb);for(let i=0;i<5;i++){_fa.subVectors(p[i+1],p[i]).setLength(len[i]);p[i+1].copy(p[i]).add(_fa);}
    if(p[5].distanceToSquared(_ft)<1e-6)break;}}

const _rp=[0,1,2,3,4,5].map(()=>new THREE.Vector3()),_kax=new THREE.Vector3(),_kq=new THREE.Quaternion(),_kup=new THREE.Vector3();
// crab legs are strongly arched: FABRIK folds them. Instead keep the leg's own shape, flex it at the knee to match the reach, then swing it from the hip
function remapCrabSkin(root){let n=0;
  root.traverse(o=>{if(!o.isSkinnedMesh)return;const bones=o.skeleton.bones,byName={};bones.forEach((bn,i)=>byName[bn.name]=i);
    const re=bones.map(bn=>{const m=/^leg_([LR]\d)_(\d)$/.exec(bn.name);return m?byName['leg_'+CRD.vgMap[m[1]]+'_'+m[2]]:-1;});
    const si=o.geometry.attributes.skinIndex;
    for(let i=0;i<si.count;i++)for(let k=0;k<4;k++){const j=si.getComponent(i,k),r=re[j];if(r>=0&&r!==undefined){si.setComponent(i,k,r);n++;}}
    si.needsUpdate=true;});
  return n;}
// keep every joint of a leg outside the hull surface (the real surface: ellipse + measured offset)
const _uc=new THREE.Vector3(),_un=new THREE.Vector3();
function unclipLeg(p,m){for(let i=1;i<=5;i++){const q=p[i];if(q.z<-14.6||q.z>21.6)continue;const hp=hullParam(q);hullPoint(hp.z,hp.th,_uc,_un);
    const d=_uc.subVectors(q,_uc).dot(_un);if(d<m)q.addScaledVector(_un,m-d);}}
function solveLeg(R,L,T,ground){const p=L.p;solveLeg0(R,L,T,ground);if(R.sc&&!_rockS)unclipLeg(p,0.035*R.sc);}
function solveLeg0(R,L,T,ground){const p=L.p;
  if(!R.crab&&!ground){sFabrik(p,L.len,T);return;} // raised / reaching legs keep the free FABRIK motion
  if(!R.crab){ // spider: knees lifted high, the claw segment hangs down onto the foothold so it never digs into the hull
    const up=_kup.set(0,1,0).applyQuaternion(R.body.getWorldQuaternion(_kq));
    for(let i=1;i<=2;i++)p[i].addScaledVector(up,L.len[i-1]*0.3);
    _t4.copy(T).addScaledVector(up,L.len[4]*0.7);sFabrikN(p,L.len,_t4,4);
    p[5].copy(T).sub(p[4]).setLength(L.len[4]).add(p[4]);return;}
  const d=T.distanceTo(p[0]);_kup.set(0,1,0).applyQuaternion(R.body.getWorldQuaternion(_kq));
  _kax.subVectors(p[5],p[0]).cross(_kup).normalize();
  const err=a=>{_kq.setFromAxisAngle(_kax,a);for(let i=2;i<=5;i++)_rp[i].subVectors(p[i],p[1]).applyQuaternion(_kq).add(p[1]);return Math.abs(_rp[5].distanceTo(p[0])-d)+Math.abs(a)*0.03;};
  let best=0,be=err(0);for(let a=-1.2;a<=1.21;a+=0.15){const e=err(a);if(e<be){be=e;best=a;}}
  for(let s=0.075;s>0.004;s/=2)for(const a of [best-s,best+s]){const e=err(a);if(e<be){be=e;best=a;}}
  err(best);for(let i=2;i<=5;i++)p[i].copy(_rp[i]);
  _kq.setFromUnitVectors(_rp[0].subVectors(p[5],p[0]).normalize(),_rp[1].subVectors(T,p[0]).normalize());
  for(let i=1;i<=5;i++)p[i].sub(p[0]).applyQuaternion(_kq).add(p[0]);}
function animSpider(s,dt,t){
  const g=s.mesh,U=g.userData,R=U.rig,sc=g.scale.x;dt=Math.min(Math.max(dt,1e-4),0.05);R.sc=sc;
  const air=!(s.state==='crawl'||s.state==='eat'||s.state==='windup'||s.state==='perch'||s.state==='rock');_perch=s.state==='perch';_rockS=s.state==='rock'?s.rock:null;
  const upW=_su.set(0,1,0).applyQuaternion(g.quaternion);
  if(!R.init){R.init=true;R.pp=g.position.clone();R.v=new THREE.Vector3();R.vl=new THREE.Vector3();R.al=new THREE.Vector3();R.qp=g.quaternion.clone();
    R.yaw=0;R.walk=0;R.ab={px:0,pv:0,yx:0,yv:0,sq:0,sqv:0};R.bd={h:0,p:0,r:0,y:0,f:0,hv:0};R.ps=s.state;R.chew=s.chewT||0;R.bite=0;R.gulp=0;R.wasAir=air;R.eye=0;R.fo=0;R.fs=0;
    g.updateMatrixWorld(true);for(const L of R.legs){g.localToWorld(L.f.copy(L.home));if(!air)sHull(L.f,L.f);}}
  // ---------- motion in the spider's own frame (drives lean + the soft abdomen)
  const v=_sa.subVectors(g.position,R.pp).divideScalar(dt);R.pp.copy(g.position);if(v.lengthSq()>900)v.set(0,0,0);
  R.v.lerp(v,1-Math.exp(-10*dt));
  _sq1.copy(g.quaternion).invert();const vl=_sb.copy(R.v).applyQuaternion(_sq1).divideScalar(sc);
  R.al.lerp(_sc.subVectors(vl,R.vl).divideScalar(dt).clampLength(0,40),1-Math.exp(-8*dt));R.vl.copy(vl);
  _sq2.copy(R.qp).invert().multiply(g.quaternion);R.qp.copy(g.quaternion);
  const dy=2*Math.asin(THREE.MathUtils.clamp(_sq2.y*Math.sign(_sq2.w||1),-1,1));R.yaw=sdamp(R.yaw,THREE.MathUtils.clamp(dy/dt,-6,6),8,dt);
  const spd=Math.hypot(vl.x,vl.z);const mv=Math.min(1,spd/1.5);R.walk+=spd*dt*3.4;
  // ---------- events
  if(R.ps!==s.state){if(R.ps==='leap'&&s.state==='drift'&&s.pos.distanceTo(P.pos)<2.2)R.bite=1;R.ps=s.state;}
  if((s.chewT||0)>R.chew+0.05){R.ab.sqv+=1.8;R.ab.pv+=0.6;R.gulp=1;}R.chew=s.chewT||0;
  if(R.wasAir&&!air){R.ab.pv+=2.2;R.ab.sqv-=2;R.bd.hv-=0.6;for(const L of R.legs)L.step=false;}
  R.wasAir=air;R.bite=Math.max(0,R.bite-dt*3);R.gulp=Math.max(0,R.gulp-dt*5);
  const k=s.state==='windup'?Math.min(1,s.t/(s.windT||0.5)):0;const ph=R.ph;
  // ---------- body pose
  let tH=0.008*Math.sin(t*2.2+ph),tP=0,tR=0,tY=0,tF=0;
  if(s.landK>0){tH-=0.07*Math.sin(Math.min(1,s.landK)*Math.PI);s.landK=Math.max(0,s.landK-dt*1.8);}
  if(!air){let hf=0,hb=0,hl=0,hr=0,ha=0;
    for(const L of R.legs){const h=_sc.subVectors(L.f,g.position).dot(upW)/sc+R.spd.rootOff;ha+=h/8;
      if(L.pair<=2)hf+=h/4;else hb+=h/4;if(L.side<0)hl+=h/4;else hr+=h/4;}
    tH+=THREE.MathUtils.clamp(ha*0.6,-0.12,0.12);
    tP+=THREE.MathUtils.clamp(Math.atan((hb-hf)/1.4),-0.3,0.3);tR+=THREE.MathUtils.clamp(Math.atan((hr-hl)/2.2),-0.3,0.3);
    let lift=0,sway=0;for(const L of R.legs)if(L.step){const w=Math.sin(Math.PI*Math.min(1,L.st));lift+=w/4;sway+=L.side*w/4;}
    tH-=0.03*lift*mv;tY+=0.06*sway*mv;tR-=0.04*sway*mv;
    tP+=THREE.MathUtils.clamp(-R.al.z*0.012,-0.12,0.12);tR+=THREE.MathUtils.clamp(R.al.x*0.01-R.yaw*0.03,-0.15,0.15);}
  if(s.state==='eat'){const c=t*8.5+ph;tH-=0.11;tP+=0.34+0.1*Math.sin(c);tR+=0.07*Math.sin(c*0.5);tF+=0.06+0.05*Math.sin(c);}
  else if(s.state==='windup'){tH-=0.13*k;tF-=0.15*k;tP-=0.4*k;tH+=Math.sin(t*61)*0.012*k;tR+=Math.sin(t*53)*0.03*k;}
  else if(s.state==='leap'){tP-=0.25;}
  else if(s.state==='drift'){tP+=Math.sin(t*9+ph)*0.35;tR+=Math.cos(t*7+ph)*0.4;}
  else if(s.state==='fall'){tH+=0.05;}
  else if(air){tP+=0.12+Math.sin(t*6+ph)*0.08;}
  if(s.idleT>0&&s.state==='windup'){const q=Math.min(1,k*1.5);tH=0.1*q+0.012*Math.sin(t*11);tP=-0.17*q+0.04*Math.sin(t*2.6);tR=0.07*Math.sin(t*1.7)*q;tY=0.2*Math.sin(t*1.25)*q;tF=-0.04*q;}
  const lam=s.state==='windup'||s.state==='leap'?18:9,bd=R.bd;
  const hPrev=bd.h;bd.h=sdamp(bd.h,tH,lam,dt);bd.hv=sdamp(bd.hv,(bd.h-hPrev)/dt,12,dt);
  bd.p=sdamp(bd.p,tP,lam,dt);bd.r=sdamp(bd.r,tR,lam,dt);bd.y=sdamp(bd.y,tY,lam,dt);bd.f=sdamp(bd.f,tF,lam,dt);
  _se.set(bd.p,bd.y,bd.r,'YXZ');_sq3.setFromEuler(_se);sBoneRot(R.body,_sq3);
  R.body.position.copy(R.body.userData.p0).add(_sc.set(0,bd.h,bd.f).applyQuaternion(R.body.userData.pqi));
  R.body.scale.setScalar(1+s.flash*0.12);
  // ---------- abdomen: a soft sack on a damped spring (lags behind, bounces on every step, breathes, gulps)
  const A=R.ab;let gp=-0.03+0.05*Math.sin(R.walk*2)*mv,gy=0.08*Math.sin(R.walk)*mv-R.yaw*0.12,breath=0.022*Math.sin(t*2.3+ph);
  if(s.state==='eat'){gp=0.1+0.05*Math.sin(t*8.5+ph);breath=0.04*Math.sin(t*5+ph);}
  else if(s.state==='windup'){gp=0.38*k+Math.sin(t*47)*0.03*k;}
  else if(s.state==='leap'){gp=-0.18;}
  else if(s.state==='drift'){gp=Math.sin(t*11+ph)*0.3;gy+=Math.cos(t*9+ph)*0.3;}
  if(s.idleT>0){gp=0.3+Math.sin(t*3.1)*0.1;gy=Math.sin(t*5.2)*0.42;breath=0.05*Math.sin(t*4.4);}
  const ka=70,ca=5;
  A.pv+=(ka*(gp-A.px)-ca*A.pv-bd.hv*9-R.al.z*0.25)*dt;A.px+=A.pv*dt;
  A.yv+=(ka*(gy-A.yx)-ca*A.yv+R.al.x*0.35)*dt;A.yx+=A.yv*dt;
  A.sqv+=(-110*A.sq-6*A.sqv+bd.hv*4)*dt;A.sq+=A.sqv*dt;
  A.px=THREE.MathUtils.clamp(A.px,-0.6,0.7);A.yx=THREE.MathUtils.clamp(A.yx,-0.6,0.6);A.sq=THREE.MathUtils.clamp(A.sq,-0.35,0.35);
  _se.set(A.px,A.yx,0,'YXZ');_sq3.setFromEuler(_se);sBoneRot(R.abd,_sq3);
  const along=1+A.sq*0.2+breath*0.5,across=1-A.sq*0.1+breath;
  R.abd.scale.set(across,across,across);R.abd.scale.setComponent(R.abdAx,along);
  // ---------- fangs (chelicerae): +fo spreads the tips, -fs swings them forward
  let fo=0.05+0.04*Math.sin(t*3+ph),fs=0;
  if(s.state==='eat'){fo=0.12+0.28*Math.max(0,Math.sin(t*16+ph))+R.gulp*0.25;fs=-0.15*Math.max(0,Math.sin(t*16+ph));}
  else if(s.state==='windup'){fo=0.6*k+0.06*Math.sin(t*40)*k;fs=-0.4*k;}
  else if(s.state==='leap'){fo=0.65;fs=-0.45;}
  else if(s.state==='drift'){fo=0.1+0.15*Math.max(0,Math.sin(t*22));}
  if(R.bite>0){fo=THREE.MathUtils.lerp(fo,-0.2,R.bite);fs=THREE.MathUtils.lerp(fs,0.35,R.bite);}
  R.fo=sdamp(R.fo,fo,R.bite>0?40:16,dt);R.fs=sdamp(R.fs,fs,R.bite>0?40:16,dt);
  _se.set(R.fs,0,-R.fo,'XYZ');sBoneRot(R.fL,_sq3.setFromEuler(_se));_se.set(R.fs,0,R.fo,'XYZ');sBoneRot(R.fR,_sq3.setFromEuler(_se));
  // ---------- materials: hit flash, eyes heating up before the pounce, lurker pulse
  R.eye=sdamp(R.eye,s.state==='windup'?k:s.state==='leap'?0.6:0,12,dt);
  const lp=s.kind==='lurker'?0.1+0.07*Math.sin(t*3+ph):0;
  if(R.crab){R.mats.body.emissive.setRGB(1,1-s.flash*0.4,1-s.flash*0.7);R.mats.body.emissiveIntensity=R.mats.body.userData.ei0*(1+s.flash*1.5+R.eye*0.6);
    if(R.mats.tube)R.mats.tube.emissiveIntensity=R.mats.tube.userData.ei0*(0.7+R.eye*2.6+0.15*Math.sin(t*4+ph));}
  else R.mats.body.emissive.setRGB(lp+s.flash*0.85,s.flash*0.3,0);
  if(R.mats.eye){const e0=R.mats.eye.userData.e0;R.mats.eye.emissive.setRGB(e0.r+R.eye*3,e0.g+R.eye*0.7,e0.b+R.eye*0.5);}
  // ---------- legs
  for(const L of R.legs)for(let i=0;i<5;i++)L.bs[i].quaternion.copy(L.q0[i]);
  g.updateMatrixWorld(true);
  const thr=(spd>0.2?0.36:0.13)*sc,lead=0.13;
  let stA=0,stB=0;for(const L of R.legs)if(L.step){if(L.A)stA++;else stB++;}
  for(const L of R.legs){
    for(let i=0;i<5;i++)L.bs[i].getWorldPosition(L.p[i]);L.bs[4].localToWorld(L.p[5].copy(L.tipL));
    for(let i=0;i<5;i++)L.len[i]=L.p[i].distanceTo(L.p[i+1]);
    g.localToWorld(L.hw.copy(L.home));
    let T=null;L.ov=false;
    if(air){ // airborne poses, relative to the body
      const l=_sc.copy(L.home),fl=Math.sin(t*16+L.pair*1.7+(L.side>0?1:0)+ph);
      if(s.state==='leap'){const o=[[0.08,0.5,0.5],[0.1,0.35,0.28],[0,0.06,-0.1],[-0.2,0.12,-0.3]][L.pair-1];l.x+=o[0]*L.side;l.y+=o[1];l.z+=o[2];l.y+=fl*0.03;}
      else if(s.state==='drift'){l.multiplyScalar(0.55);l.y+=0.1+fl*0.14;}
      else if(s.state==='fall'){l.x*=1.12;l.z*=1.05;l.y-=0.22;l.y+=fl*0.015;}
      else{l.y+=0.06+fl*0.06;l.z+=Math.sin(t*13+L.pair*1.3+(L.side>0?Math.PI:0))*0.16;}
      g.localToWorld(l);L.f.lerp(l,1-Math.exp(-14*dt));L.step=false;T=L.f;}
    else if(s.state==='eat'&&L.pair===1){ // front legs rake and tear the hull towards the fangs
      const c=((t*2.3+(L.side>0?0.5:0)+ph*0.1)%1+1)%1;let z,lift;
      if(c<0.6){const u=c/0.6;z=1.05-0.45*u;lift=0;}else{const u=(c-0.6)/0.4;z=0.6+0.45*u;lift=Math.sin(Math.PI*u)*0.3;}
      g.localToWorld(_sc.set(0.33*L.side,-R.spd.rootOff,z));sHull(_sc,_sc).addScaledVector(upW,lift*sc);
      L.f.lerp(_sc,1-Math.exp(-25*dt));L.step=false;L.ov=true;T=L.f;}
    else if(s.state==='windup'&&L.pair<=2){ // threat pose: front legs rear up and spread
      const r=L.pair===1?[0.55,0.75,1.0]:[1.0,0.42,0.72],kk=L.pair===1?k:k*0.7;
      _sc.set(THREE.MathUtils.lerp(L.home.x,r[0]*L.side,kk),THREE.MathUtils.lerp(L.home.y,r[1],kk)+Math.sin(t*45+L.pair)*0.03*kk,THREE.MathUtils.lerp(L.home.z,r[2],kk));
      g.localToWorld(_sc);if(kk<0.05)sHull(_sc,_sc);L.f.lerp(_sc,1-Math.exp(-20*dt));L.step=false;L.ov=true;T=L.f;}
    if(T){solveLeg(R,L,T,false);continue;}
    // ---- grounded gait
    L.hw.addScaledVector(R.v,lead+L.dur*0.5);sHull(L.hw,L.hw);
    if(L.step){L.st+=dt/L.dur;const u=Math.min(1,L.st),e=u<0.5?2*u*u:1-2*(1-u)*(1-u);
      L.f.lerpVectors(L.from,L.hw,e).addScaledVector(upW,Math.sin(Math.PI*u)*L.lift);
      if(u>=1){L.step=false;L.f.copy(L.hw);A.sqv+=0.35;A.pv+=(L.side*0.1+0.15)*mv;}}
    else{const d=L.f.distanceTo(L.hw),other=L.A?stB:stA,hgt=_sc.subVectors(L.f,L.hw).dot(upW);
      if((d>thr&&other===0)||d>thr*2.4||hgt>0.08*sc){L.step=true;L.st=0;L.from.copy(L.f);
        L.dur=THREE.MathUtils.clamp(0.24-spd*0.025,0.1,0.24)*Math.sqrt(sc)*(0.9+Math.random()*0.2);
        L.lift=0.2*sc*(0.45+0.55*Math.min(1,d/(0.45*sc)));if(L.A)stA++;else stB++;}}
    solveLeg(R,L,L.f,true);}
  // ---------- write the solved chains back as bone rotations
  for(const L of R.legs){L.bs[0].parent.getWorldQuaternion(_sq1);
    for(let i=0;i<5;i++){_sq2.copy(_sq1).multiply(L.q0[i]);_sv.copy(L.ax[i]).applyQuaternion(_sq2);
      _sd.subVectors(L.p[i+1],L.p[i]).normalize();_sq4.setFromUnitVectors(_sv,_sd).multiply(_sq2);
      L.bs[i].quaternion.copy(_sq3.copy(_sq1).invert().multiply(_sq4));_sq1.copy(_sq4);}}}

// world position of the weak spot (between the eyes)
function headPos(s,out){const R=s.mesh.userData.rig;return R?R.body.localToWorld(out.copy(R.headL)):s.mesh.localToWorld(out.set(0,0.14,0.36));}
