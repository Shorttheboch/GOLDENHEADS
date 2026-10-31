/* ================= INCINERADORA: the four-armed biped (Santi, SPIDER_BIPED_v1) ================= */
// A 3.3 m mini-boss that comes alone (with a few small spiders) in round 8 and every 3 rounds after. It cares about killing YOU:
// an orange chest laser that sweeps after you (outrun it, dash or hide), it SWIMS through space after you (v69) and claws you, claws and a bite up close.
// Shot from the front again and again it covers up with its four arms; while it charges/fires, the glowing chest core takes triple damage.
const INC_SC=3.0,INCS=[];let incN=0;
const isIncRound=i=>i>=7&&(i-7)%3===0;
const INC_SND={},INC_FX={beamOn:0,aimOn:0,aimO:new THREE.Vector3(),aimD:new THREE.Vector3()};
const _jq1=new THREE.Quaternion(),_jq2=new THREE.Quaternion(),_j1=new THREE.Vector3(),_j2=new THREE.Vector3(),_j3=new THREE.Vector3(),_j4=new THREE.Vector3(),_j5=new THREE.Vector3(),_j6=new THREE.Vector3(),_jm=new THREE.Matrix4();
{const g=new THREE.CylinderGeometry(1,1,1,18,1,true);g.translate(0,0.5,0);g.rotateX(Math.PI/2); // unit beam along +Z
 const mk=(w,a)=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uT:{value:0},uA:{value:0}},
   vertexShader:`varying vec3 vN,vV,vX;varying float vZ;void main(){vZ=position.z;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vX=normalize((modelViewMatrix*vec4(0.,0.,1.,0.)).xyz);gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`uniform float uT,uA;varying vec3 vN,vV,vX;varying float vZ;
     void main(){vec3 V=normalize(vV);float al=abs(dot(normalize(vX),V));float e=mix(pow(abs(dot(normalize(vN),V)),${w}),0.75,al*al); /* coming straight at you: a blazing disc, never invisible */float fl=0.82+0.18*sin(uT*83.+vZ*31.)+0.08*sin(uT*151.+vZ*7.);
       vec3 c=mix(vec3(1.,.26,.03),vec3(1.,.6,.22),e*e*e);float a=e*fl*uA*${a};gl_FragColor=vec4(c*a,a);}`});
 INC_FX.outer=new THREE.Mesh(g,mk('1.2','1.0'));INC_FX.core=new THREE.Mesh(g,mk('3.0','1.9'));INC_FX.haze=new THREE.Mesh(g,mk('0.8','0.22'));INC_FX.aimM=new THREE.Mesh(g,mk('1.0','1.3'));
 for(const m of [INC_FX.outer,INC_FX.core,INC_FX.haze,INC_FX.aimM]){m.visible=false;m.frustumCulled=false;m.renderOrder=6;scene.add(m);}
 INC_FX.aim=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,1)]),new THREE.LineBasicMaterial({color:new THREE.Color(3.2,0.7,0.12),transparent:true,opacity:0.75,depthWrite:false}));
 INC_FX.aim.visible=false;INC_FX.aim.frustumCulled=false;scene.add(INC_FX.aim);
 const gt=glowTex('rgba(255,225,170,1)','rgba(255,90,20,.5)');
 INC_FX.glow=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,color:new THREE.Color(2.6,0.85,0.18),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
 INC_FX.hit=new THREE.Sprite(INC_FX.glow.material.clone());for(const s of [INC_FX.glow,INC_FX.hit]){s.visible=false;scene.add(s);}
 INC_FX.light=new THREE.PointLight(0xff6a20,0,16,2);scene.add(INC_FX.light);}
function incBone(B,n){return B.bones[n]||B.bones[n.replace(/\./g,'')]||null;}
const incCenter=(e,out)=>out.copy(e.pos).addScaledVector(e.n,0.55*INC_SC+(e.hop||0));
const incCore=(e,out)=>e.bChest.localToWorld(out.copy(e.coreL));
// how far a ray gets before it hits a rock, a wing/nacelle or the hull
function incRayLen(o,d,max=48){let L=max;const rt=rockRay(o,_j1.copy(d).multiplyScalar(max));if(rt>=0)L=rt*max;let ship=false;
  for(let s=1.2;s<L;s+=0.4){const p=_j1.copy(o).addScaledVector(d,s);if(wingAt(p)||(p.z>HZ0&&p.z<HZ1&&pushOutOfShip(_j2.copy(p),0,null))){L=s;ship=true;break;}}
  return [L,ship];}
function spawnInc(cine){const B=makeBiped(INC_SC);if(!B)return null;incN++;const k=incN-1;
  const e={isInc:true,B,mesh:B.g,gen:incN,pos:new THREE.Vector3(),n:new THREE.Vector3(),face:new THREE.Vector3(),vel:new THREE.Vector3(),aim:new THREE.Vector3(),z:0,th:0,hop:0,sdir:new THREE.Vector3(),sc:new THREE.Vector3(),sspd:0,sa:0,sl:0,sw:null,lp:null,clk:0,rk:null,rockStops:0,lastRock:null,
    hp:0,maxHp:0,st:'fall',state:'fall',t:0,cds:{beam:2.0,leap:5,melee:0,guard:0,stag:0,hop:3},roam:null,roamT:0,front:[],stagAcc:0,coreHit:0,flash:0,hs:[],side:Math.random()<0.5?1:-1,sideT:2,
    lookH:0.5,topH:1.15,camD:7.5};
  e.hp=e.maxHp=Math.round(50*(1+0.2*k)); // v67: 95 -> 50 (+20 % each time, was +25 %): Santi found it far too strong
  e.bHead=incBone(B,'head');e.bChest=incBone(B,'chest');
  e.bBody=['pelvis','spine','chest','hump','abdomen.02','abdomen.03','abdomen.04','thigh.L','thigh.R'].map(n=>incBone(B,n));e.rBody=[0.15,0.14,0.15,0.12,0.2,0.18,0.16,0.1,0.1];
  $('boss').firstChild.textContent='INCINERADORA'+(incN>1?' '+['','II','III','IV','V','VI'][Math.min(5,k)]:'');
  const hp=hullParam(P.pos);e.z=THREE.MathUtils.clamp(hp.z+(Math.random()<0.5?-9:9),-12,19);e.th=hp.th+THREE.MathUtils.randFloatSpread(0.4);
  if(cine){e.th=Math.PI/2+0.5;e.z=3.6;}
  [e.z,e.th]=freeSpot(e.z,e.th,2);hullPoint(e.z,e.th,e.pos,e.n);
  e.face.subVectors(P.pos,e.pos);if(e.face.lengthSq()<1e-4)e.face.set(0,0,1);
  // the chest core (weak spot), measured once on the idle pose in the chest bone's own space
  scene.add(B.g);incPlace(e);B.play('Idle',0);B.update(0.01);B.g.updateMatrixWorld(true);
  e.fg=incFootGeom(e); // v71: where the Idle clip puts its feet (for standing on rocks)
  e.coreL=e.bChest.worldToLocal(e.bChest.getWorldPosition(new THREE.Vector3()).addScaledVector(e.face,0.075*INC_SC).addScaledVector(e.n,0.02*INC_SC));
  e.fall={tgt:e.pos.clone(),n:e.n.clone(),v:cine?14:18,cine};e.pos.addScaledVector(e.n,cine?48:46);B.play('ZeroG_Float',0);incPlace(e);INCS.push(e);
  if(cine){for(const sh of shards)sh.visible=false;CINE.on=true;CINE.mode='boss';CINE.t=0;CINE.dur=5.6;CINE.boss=e;document.body.classList.add('cine');}
  else showMsg('¡CUIDADO ARRIBA!','La Incineradora cae sobre la nave',2);
  return e;}
// stand on the hull: up = hull normal, facing kept in the tangent plane
function incPlace(e){const f=_j3.copy(e.face).addScaledVector(e.n,-e.face.dot(e.n));if(f.lengthSq()<1e-6)f.set(1,0,0).addScaledVector(e.n,-e.n.x);f.normalize();e.face.copy(f);
  const x=_j4.crossVectors(e.n,f).normalize();_jm.makeBasis(x,e.n,f);e.B.g.quaternion.setFromRotationMatrix(_jm);e.B.g.position.copy(e.pos).addScaledVector(e.n,e.hop||0);}
function incTurn(e,dir,rate,dt){const d=_j3.copy(dir).addScaledVector(e.n,-dir.dot(e.n));if(d.lengthSq()<1e-6)return 1;d.normalize();
  const c=THREE.MathUtils.clamp(e.face.dot(d),-1,1),ang=Math.acos(c);if(ang<1e-4)return 1;const s=Math.sign(_j4.crossVectors(e.face,d).dot(e.n))||1;
  e.face.applyAxisAngle(e.n,s*Math.min(ang,rate*dt));return c;}
// walk along the hull, sidestepping wings and nacelles
function incMove(e,dir,spd,dt){if(spd<=0)return false;
  for(const a of [0,0.6,-0.6,1.2,-1.2]){const d=_j5.copy(dir).applyAxisAngle(e.n,a),np=_j6.copy(e.pos).addScaledVector(d,spd*dt),hp=hullParam(np);
    if(hp.z<-13.5||hp.z>20.5||hullBlocked(hp.z,hp.th,2))continue;e.z=hp.z;e.th=hp.th;hullPoint(e.z,e.th,e.pos,e.n);return true;}
  return false;}
function incAimTrack(e,dt,rate){const c=incCore(e,_j1),d=_j2.subVectors(P.pos,c).normalize();const ang=Math.acos(THREE.MathUtils.clamp(e.aim.dot(d),-1,1));if(ang<1e-4)return;
  const ax=_j3.crossVectors(e.aim,d);if(ax.lengthSq()<1e-10)return;e.aim.applyAxisAngle(ax.normalize(),Math.min(ang,rate*dt)).normalize();}
function incStep(e,k=1){const v=Math.max(0.15,1-e.pos.distanceTo(P.pos)/40);if(!(AC&&playS('step',0.6*v*k,0.85+Math.random()*0.15)))sfx('thump',e.pos);}
function incBeamSnd(on){if(!AC)return;
  if(on&&!INC_SND.s){if(SFXB&&SFXB.laserLoop){const g=AC.createGain();g.gain.value=0;g.connect(master);g.gain.setTargetAtTime(0.6,AC.currentTime,0.02);INC_SND.g=g;INC_SND.s=loopSrc(SFXB.laserLoop[0],(SFXL&&SFXL.laserLoop)||2.5,g);}else sfx('zap');}
  if(!on&&INC_SND.s){try{INC_SND.g.gain.setTargetAtTime(0,AC.currentTime,0.05);INC_SND.s.stop(AC.currentTime+0.4);}catch(err){}INC_SND.s=null;}}
function incStalk(e){e.st=e.rk?'rock':'stalk';e.t=0;e.hop=0;e.sa=0;e.sl=0;} // v69: back to what it was doing: stalking on the hull, or perched on a rock
// a new spot on the hull around you: anywhere from 6 to 18 m along the ship and up to ~65 degrees around it
// v67 (Santi): far enough from where it stands that it RUNS there across the hull
function incPickRoam(e){const hq=hullParam(P.pos);
  for(let k=0;k<16;k++){const z=THREE.MathUtils.clamp(hq.z+(Math.random()<0.5?-1:1)*(6+Math.random()*12),-12,19),th=hq.th+THREE.MathUtils.randFloatSpread(2.3);
    if(hullBlocked(z,th,2))continue;const n=new THREE.Vector3(),p=hullPoint(z,th,new THREE.Vector3(),n);if(p.distanceTo(e.pos)<8)continue;return {z,th,p,n};}
  return null;}
// long zero-g leap from one part of the ship to another: an arc a few metres over the hull
function incHullLeap(e,R){e.st='hopTake';e.t=0;e.hopTo=R;e.B.play('ZeroG_Takeoff',0.15);}
// ================= v69 (Santi): it SWIMS whenever it leaves the hull, and it GRABS ROCKS =================
// stalk -> swimStart (crouch, push off at f11) -> swim (Swim_Loop; Swim_Slash up close; Swim_Turn180 if you get behind it) -> swimBack (to a hull spot or a rock,
// turning first if the spot is behind it) -> swimLand (hooks the surface at f8, drops, guard) -> stalk on the hull, or 'rock' on an asteroid (it sticks to it, turns to you,
// fires the laser once, then leaves with Swim_Start). The old zero-g jump clips stay only for hull-to-hull leaps and the fall from space.
// In the swim pose the body lies along e.face with its back along e.n; e.pos is the root (the legs hang under the body), the swim moves the body centre e.sc.
const INC_CO=0.55*INC_SC; // root -> body centre along e.n (the same as incCenter)
const ZERO3=new THREE.Vector3();
const _w1=new THREE.Vector3(),_w2=new THREE.Vector3(),_w3=new THREE.Vector3(),_w4=new THREE.Vector3(),_h1=new THREE.Vector3(),_h2=new THREE.Vector3(),_h3=new THREE.Vector3(),_rp1=new THREE.Vector3(),_rp2=new THREE.Vector3();
// off the surface: no foot IK there, and a death in the air flies back to the hull first
const incAir=e=>e.st==='fall'||e.st==='hop'||e.st==='swim'||e.st==='swimBack'||(e.st==='swimStart'&&!!e.sa)||(e.st==='swimLand'&&!e.sl)||(e.st==='dead'&&!!e.deadFly);
// ---- rocks: signed distance to the rock surface, its normal, the surface point in a direction from the centre
function incRockF(R,p){const d=_rp1.subVectors(p,R.c),L=d.length();if(L<1e-6)return -R.r;d.multiplyScalar(1/L);return L-rockR(R,d);}
function incRockNormal(R,p,out){const h=0.08,q=_rp2,f=(x,y,z)=>incRockF(R,q.set(p.x+x,p.y+y,p.z+z));return out.set(f(h,0,0)-f(-h,0,0),f(0,h,0)-f(0,-h,0),f(0,0,h)-f(0,0,-h)).normalize();}
function incRockPoint(R,rd,p,n){p.copy(R.c).addScaledVector(rd,rockR(R,rd));return incRockNormal(R,p,n);}
// a rock it may land on: solid (not fading in or drifting away), not the one it just left, and at most 2 rock stops per trip so it does come back to the ship
const incRockOK=(e,R)=>R.fade>=0.999&&!R.leaving&&R!==e.lastRock&&e.rockStops<2;
// a rock in its way: the body centre inside it, or 4 m ahead
function incRockAhead(e){for(const R of ROCKS){if(R===e.lastRock&&e.sw.t<1.5)continue;
    for(const k of [0,4]){const d=_w4.copy(e.sc).addScaledVector(e.sdir,k).sub(R.c),L=d.length();if(L<R.rmax+1.6&&L>1e-6&&L<rockR(R,d.multiplyScalar(1/L))+(k?1.0:1.6))return R;}}return null;}
// ---- v71 (Santi: "arréglalo"): standing on a rock with both feet ON the stone.
// Where the Idle clip puts its feet, in the root frame (x left, y up, z forward, metres): the root, both ankles and the six toe tips. Measured once in spawnInc.
function incFootGeom(e){const B=e.B,g=B.g,G=[{x:0,y:0,z:0,w:0.6,k:'r'}];
  const add=(b,w,k)=>{if(!b)return;const l=g.worldToLocal(b.getWorldPosition(_j1)).multiplyScalar(INC_SC);G.push({x:l.x,y:l.y,z:l.z,w,k,n:b.name});};
  for(const s of ['L','R']){add(incBone(B,'foot.'+s),0.5,'a');for(const b of incTips(B,s))add(b,/_03/.test(b.name)?1:0.7,'t');}
  return G;}
const _sk={p:new THREE.Vector3(),n:new THREE.Vector3(),f:new THREE.Vector3()},_sN0=new THREE.Vector3(),_sO=new THREE.Vector3(),_sX=new THREE.Vector3(),_sP=new THREE.Vector3(),_sQ=new THREE.Vector3(),_sM=[0,0,0];
// how far P is above the rock (negative inside): along the surface normal under it (the surface point straight below P along the radius, and the tangent plane there). Smooth and
// well behaved on a steep, lumpy surface, where a ray along a tilted axis would graze it. The same number the foot and body fits aim at.
const _cS=new THREE.Vector3(),_cN=new THREE.Vector3(),_cD=new THREE.Vector3();
function incClear(R,P){const d=_cD.subVectors(P,R.c),L=d.length();if(L<1e-4)return -R.r;d.multiplyScalar(1/L);
  _cS.copy(R.c).addScaledVector(d,rockR(R,d));incRockNormal(R,_cS,_cN);return (P.x-_cS.x)*_cN.x+(P.y-_cS.y)*_cN.y+(P.z-_cS.z)*_cN.z;}
// symmetric 3x3 system [m11 m12 m13; m12 m22 m23; m13 m23 m33] x = r (Cramer), the answer in _sM
function incSolve3(m11,m12,m13,m22,m23,m33,r1,r2,r3){const a11=m22*m33-m23*m23,a12=m13*m23-m12*m33,a13=m12*m23-m13*m22,d=m11*a11+m12*a12+m13*a13;if(Math.abs(d)<1e-9)return false;
  _sM[0]=(r1*a11+r2*a12+r3*a13)/d;_sM[1]=(r1*a12+r2*(m11*m33-m13*m13)+r3*(m12*m13-m11*m23))/d;_sM[2]=(r1*a13+r2*(m12*m13-m11*m23)+r3*(m11*m22-m12*m12))/d;return true;}
// the body frame (root, up, forward) that puts the feet on the stone: start from the rock normal at the spot rd, then 4 times fit a plane h = a+b*x+c*z to the height of the
// surface under the feet points (weighted) and tilt/lower the body to it. Not a fixed plane under the root: the feet are 0.6-1.3 m ahead of it and the rock curves away there.
function incStandFit(e,R,rd,fh,out){const G=e.fg,n=out.n,f=out.f,O=_sO,x=_sX,m=_sM,n0=_sN0;
  O.copy(R.c).addScaledVector(rd,rockR(R,rd));incRockNormal(R,O,n);n0.copy(n);
  const frame=()=>{f.copy(fh).addScaledVector(n,-fh.dot(n));if(f.lengthSq()<1e-6)f.set(1,0,0).addScaledVector(n,-n.x);f.normalize();x.crossVectors(n,f);};
  for(let it=0;it<4;it++){frame();
    let sw=0,sX=0,sZ=0,sXX=0,sXZ=0,sZZ=0,sH=0,sHX=0,sHZ=0;
    for(const g of G){const h=-incClear(R,_sP.copy(O).addScaledVector(x,g.x).addScaledVector(f,g.z)),w=g.w;sw+=w;sX+=w*g.x;sZ+=w*g.z;sXX+=w*g.x*g.x;sXZ+=w*g.x*g.z;sZZ+=w*g.z*g.z;sH+=w*h;sHX+=w*h*g.x;sHZ+=w*h*g.z;}
    sXX+=0.1;sZZ+=0.1; // a little ridge so a lumpy bit cannot tilt the body wildly
    if(!incSolve3(sw,sX,sZ,sXX,sXZ,sZZ,sH,sHX,sHZ))break;const cl=THREE.MathUtils.clamp;
    O.addScaledVector(n,cl(m[0],-0.5,0.5));n.addScaledVector(x,-cl(m[1],-0.6,0.6)).addScaledVector(f,-cl(m[2],-0.6,0.6)).normalize();}
  const cn=n.dot(n0);if(cn<0.7){const t=_sQ.copy(n).addScaledVector(n0,-cn);if(t.lengthSq()>1e-8)n.copy(n0).multiplyScalar(0.7).addScaledVector(t.normalize(),0.714);} // never more than ~45 degrees off the rock normal at the spot
  frame();O.addScaledVector(n,INC_STAND_LIFT);
  out.p.copy(O);return out;}
const _sD=new THREE.Vector3(),_sD2=new THREE.Vector3();
const INC_STAND_LIFT=0.02; // the plane sits this far above the stone-fit: a toe in the stone looks worse than one a hand's breadth over it
// it stands on a rock: the rock only drifts, so a direction from its centre (e.rk.rd) is all that is stored; position and up are re-derived every frame.
// v71: the pose is the fitted one (see incStandFit), eased in over 0.7 s after the landing so nothing pops
function incRockStick(e,dt){const K=e.rk,R=K.R,S=incStandFit(e,R,K.rd,e.face,_sk),k=THREE.MathUtils.smoothstep(e.clk-K.t0,0,0.7);
  incRockPoint(R,K.rd,_sQ,_sP); // (_sQ = the spot, _sP = the rock normal there)
  if(!(S.p.x+S.p.y+S.p.z+S.n.x+S.n.y+S.n.z>-1e9))S.p.copy(_sQ),S.n.copy(_sP); // (never NaN into the pose)
  // the fitted pose as an offset from the spot pose, eased over ~0.1 s: a lump passing under the feet while it turns cannot jerk the body
  const fp=_sD.subVectors(S.p,_sQ),fn=_sD2.subVectors(S.n,_sP);
  if(!K.dp){K.dp=fp.clone();K.dn=fn.clone();}else{const a=1-Math.exp(-(dt||0.016)/0.1);K.dp.lerp(fp,a);K.dn.lerp(fn,a);}
  e.pos.copy(_sQ).addScaledVector(K.dp,k);e.n.copy(_sP).addScaledVector(K.dn,k).normalize();
  e.face.addScaledVector(e.n,-e.face.dot(e.n));if(e.face.lengthSq()<1e-6)e.face.set(1,0,0).addScaledVector(e.n,-e.n.x);e.face.normalize();e.sc.copy(e.pos).addScaledVector(e.n,INC_CO);}
// the surface under a point for the foot IK: the rock it stands on, or the hull
function incSurf(e,C,p,n){if(e.rk){const R=e.rk.R,d=_rp1.subVectors(C,R.c),L=d.length();if(L<1e-4)return false;d.multiplyScalar(1/L);p.copy(R.c).addScaledVector(d,rockR(R,d));incRockNormal(R,p,n);
    return true;}
  const hq=hullParam(C);if(hq.z<-14.4||hq.z>21.4)return false;hullPoint(hq.z,hq.th,p,n);return true;}
function incRockLeave(e){e.st='swimStart';e.t=0;e.sa=0;e.B.play('Swim_Start',0.2);} // off the rock: the same crouch and push as off the hull
// speed along the stroke: ~5.5 m/s gliding, up to ~10 m/s on the pull (Swim_Loop frames 11-22), ~7.5 m/s on average. The input leads the pull a little because the speed eases in.
function incStrokeV(f){const sm=THREE.MathUtils.smoothstep;return 5.5+5*sm(f,4,10)*(1-sm(f,18,25));}
// push off the surface at 8 m/s toward you (never into it); from here on the body centre is what moves
function incSwimLaunch(e){const C=incCenter(e,_w1),d=_w2.subVectors(P.pos,C).normalize(),k=d.dot(e.n);if(k<0.25)d.addScaledVector(e.n,0.25-k).normalize();
  const rk=e.rk;if(rk){e.lastRock=rk.R;e.rk=null;}
  e.sdir.copy(d);e.sspd=8;e.vel.copy(d).multiplyScalar(8);e.sc.copy(C);e.sa=1;e.sw={o:e.pos.clone(),T:(rk?3.5:5)+Math.random(),t:0,sm:'loop',turnT:-9,fr:0};
  if(!(AC&&playS('tss',0.55,0.6)))sfx('dash');}
// one frame of swimming. Heavy: the heading eases toward `want` (wide turns) while the speed eases toward `spd`. face: undefined = look where it swims, null = frozen, vector = look there.
function incSwimMove(e,dt,want,spd,turnK,face){
  if(want&&turnK>0){e.sdir.lerp(want,1-Math.exp(-turnK*dt));if(e.sdir.lengthSq()<1e-6)e.sdir.copy(e.face);e.sdir.normalize();}
  e.sspd+=(spd-e.sspd)*(1-Math.exp(-5*dt));e.vel.copy(e.sdir).multiplyScalar(e.sspd);e.sc.addScaledVector(e.vel,dt);
  if(face!==null){e.face.lerp(face||e.sdir,1-Math.exp(-5*dt)).normalize();
    e.n.addScaledVector(e.face,-e.n.dot(e.face));if(e.n.lengthSq()<1e-4)e.n.copy(UP).addScaledVector(e.face,-e.face.y);e.n.normalize();
    // its back drifts toward the sky (a roll around its own axis) so it never swims upside down for long
    const nr=_w3.copy(UP).addScaledVector(e.face,-UP.dot(e.face));if(nr.lengthSq()>0.09){nr.normalize();
      e.n.applyAxisAngle(e.face,Math.atan2(e.face.dot(_w4.crossVectors(e.n,nr)),e.n.dot(nr))*(1-Math.exp(-0.9*dt)));}}
  e.pos.copy(e.sc).addScaledVector(e.n,-INC_CO);}
// Swim_Turn180 ends facing backwards: flip the entity 180 degrees around its up, move it forward by the clip's pivot shift, and hand the pose to the
// derived Swim_Turn180_R (same pose in the flipped frame, see bipedFlipClip) with no fade; then a normal crossfade into the loop
function incSwimFlip(e){const B=e.B,F=B.flip,f=_w1.copy(e.face),x=_w2.crossVectors(e.n,f),n=_w3.copy(e.n),sh=_w4.set(0,0,0).addScaledVector(x,F[0]*INC_SC).addScaledVector(n,F[1]*INC_SC).addScaledVector(f,F[2]*INC_SC);
  e.pos.add(sh);e.sc.add(sh);e.face.applyAxisAngle(n,Math.PI);e.sdir.copy(e.face);e.vel.copy(e.sdir).multiplyScalar(e.sspd);
  B.set('Swim_Turn180_R',B.acts.Swim_Turn180.getClip().duration);B.play('Swim_Loop',0.2);}
// height of p (relative to the target's frame) over the surface: the hull under it, or the rock it is going to
function incHullH(p){const hq=hullParam(p);hullPoint(hq.z,hq.th,_h1,_h2);return _h3.subVectors(p,_h1).dot(_h2);}
const incSurfH=(L,p)=>L.ref?incRockF(L.ref,_h3.copy(p).add(L.ref.c)):incHullH(p);
// the way home: a Hermite curve for the root from here to the landing spot, leaving the way it is heading and arriving ALONG the surface (a bump pushes it out if it would dip).
// It lives in the target's frame (a rock drifts). The speed is separate from the curve: it ramps up to ~7 m/s and brakes at 7 m/s2 so that the root reaches the spot at 2 m/s.
// the clearance bump leans toward the end (peak at u=0.6, flat at both ends): the start of the curve keeps its heading
const incBump=u=>28.935*u*u*u*(1-u)*(1-u);
function incPathAt(L,u,p,d){const u2=u*u,u3=u2*u;
  p.copy(L.P0).multiplyScalar(2*u3-3*u2+1).addScaledVector(L.T0,u3-2*u2+u).addScaledVector(L.H,-2*u3+3*u2).addScaledVector(L.T1,u3-u2).addScaledVector(L.n,L.B*incBump(u));
  if(d)d.copy(L.P0).multiplyScalar(6*u2-6*u).addScaledVector(L.T0,3*u2-4*u+1).addScaledVector(L.H,-6*u2+6*u).addScaledVector(L.T1,3*u2-2*u).addScaledVector(L.n,L.B*28.935*u2*(1-u)*(3-5*u));
  return p;}
function incSwimPlan(e){const L=e.lp,R=L.ref,B=e.B;L.sm='path';if(B.curName!=='Swim_Loop')B.play('Swim_Loop',0.2);
  L.off=R?R.c:ZERO3;L.P0=e.pos.clone().sub(L.off);
  if(R){L.H=L.rd.clone().multiplyScalar(rockR(R,L.rd));L.n=incRockNormal(R,_w1.copy(L.H).add(R.c),new THREE.Vector3());}else{L.H=L.hullH.clone();L.n=L.hullN.clone();}
  // arrive along the surface: the way it is facing, or toward you, or along the ship
  L.fH=null;for(const c of [R?new THREE.Vector3().subVectors(L.H,L.P0):e.face.clone(),e.face.clone(),new THREE.Vector3().subVectors(P.pos,L.H).sub(L.off),new THREE.Vector3(0,0,1)]){c.addScaledVector(L.n,-c.dot(L.n));if(c.lengthSq()>0.12){L.fH=c.normalize();break;}}
  if(!L.fH)L.fH=new THREE.Vector3(1,0,0).addScaledVector(L.n,-L.n.x).normalize();
  const V0=e.vel.clone(),sp=V0.length(),d=L.P0.distanceTo(L.H);
  L.T0=(sp>1?V0.multiplyScalar(1/sp):e.face.clone()).multiplyScalar(Math.max(2,d*0.9));L.T1=L.fH.clone().multiplyScalar(THREE.MathUtils.clamp(d,4,20));L.B=0;
  for(let k=1;k<=16;k++){const u=k/17;if(u<0.25)continue;const need=Math.min(0.7,(L.ref?6:10)*(1-u))-incSurfH(L,incPathAt(L,u,_w2)),b=incBump(u);if(need>0&&b>0.02)L.B=Math.max(L.B,need/b);}
  L.B=Math.min(L.B,3,d*0.4);
  // arc length table, and the parallel-transported back vector along the curve: it ends rolled by L.rho from the surface normal, and that roll is spread over the way (no flips)
  L.tab=[0];L.bs=[];const pv=L.P0.clone(),b=e.n.clone();
  for(let k=0;k<=48;k++){incPathAt(L,k/48,_w2,_w3);if(k)L.tab.push(L.tab[k-1]+_w2.distanceTo(pv));pv.copy(_w2);const t=_w3.normalize();
    b.addScaledVector(t,-b.dot(t));if(b.lengthSq()<1e-6)b.copy(L.n).addScaledVector(t,-L.n.dot(t));b.normalize();L.bs.push(b.clone());}
  L.rho=Math.atan2(_w3.dot(_w4.crossVectors(L.bs[48],L.n)),L.bs[48].dot(L.n));
  L.len=L.tab[48];L.s=0;L.vc=THREE.MathUtils.clamp(Math.max(e.sspd,7),7,10);}
// back to the landing spot. Its nose follows the curve and its back is the carried vector plus the spread roll. Swim_Land starts 8 frames before it arrives:
// the hands hook the surface at f8 right as the root reaches the spot, then it stays put and the clip drops the body.
function incSwimPath(e,dt){const L=e.lp,r=Math.max(0,L.len-L.s),tb=L.tab;
  e.sspd+=THREE.MathUtils.clamp(Math.min(L.vc,Math.sqrt(4+14*r))-e.sspd,-14*dt,5*dt);L.s=Math.min(L.len,L.s+e.sspd*dt);
  let k=0;while(k<47&&tb[k+1]<L.s)k++;const fr=(L.s-tb[k])/Math.max(1e-6,tb[k+1]-tb[k]),u=(k+fr)/48,x=L.len>1e-3?L.s/L.len:1;
  incPathAt(L,u,e.pos,_w2);e.pos.add(L.off);if(_w2.lengthSq()>1e-8)_w2.normalize();e.vel.copy(_w2).multiplyScalar(e.sspd);
  e.face.lerp(_w2,1-Math.exp(-(9+60*THREE.MathUtils.smoothstep(x,0.1,0.4))*dt)).normalize();
  const n=_w3.lerpVectors(L.bs[k],L.bs[k+1],Math.min(1,fr));n.addScaledVector(_w2,-n.dot(_w2)).normalize();n.applyAxisAngle(_w2,L.rho*THREE.MathUtils.smoothstep(u,0.1,0.92));
  e.n.copy(n).addScaledVector(e.face,-n.dot(e.face));if(e.n.lengthSq()<1e-4)e.n.copy(L.n).addScaledVector(e.face,-L.n.dot(e.face));e.n.normalize();
  e.sc.copy(e.pos).addScaledVector(e.n,INC_CO);
  if(!L.land&&2*Math.max(0,L.len-L.s)/(e.sspd+2)<=8/24){L.land=1;e.st='swimLand';e.t=0;e.B.play('Swim_Land',0.2);}
  if(L.s>=L.len-1e-3){if(!L.land){e.st='swimLand';e.t=0;e.B.play('Swim_Land',0.05);}
    e.vel.set(0,0,0);e.sspd=0;e.sl=1;e.cds.leap=7+Math.random()*3;
    if(L.ref){e.rk={R:L.ref,rd:L.rd.clone(),t0:e.clk,stay:4+Math.random()*3,fired:0};e.rockStops++;e.lastRock=L.ref;incRockStick(e);e.face.copy(L.fH).addScaledVector(e.n,-L.fH.dot(e.n)).normalize();} // a rock stop: it is now glued to it
    else{e.rk=null;e.rockStops=0;e.lastRock=null;e.pos.copy(L.H);e.n.copy(L.n);e.face.copy(L.fH);e.z=L.z;e.th=L.th;e.sc.copy(e.pos).addScaledVector(e.n,INC_CO);}
    e.lp=null;incStep(e,1.4);shake(Math.max(0.05,0.25-e.pos.distanceTo(P.pos)*0.01));burst(e.pos,0x8a6a40,10);return true;}
  return false;}
// the spot on rock R that is best to land on from here: reached on a shallow glide (not diving into it), close to the way it is heading, with the line in the clear (and, if asked, with a view of you for the laser)
function incRockSpot(e,R,needSee){const P0=e.pos,V=(e.vel.lengthSq()>1?_h1.copy(e.vel):_h1.copy(e.face)).normalize(),to=new THREE.Vector3().subVectors(e.sc,R.c).normalize(),d=new THREE.Vector3(),H=new THREE.Vector3(),n=new THREE.Vector3(),v=new THREE.Vector3(),q=new THREE.Vector3(),o=new THREE.Vector3();
  let best=null,bc=1e9;const N=140;
  for(let i=0;i<N;i++){const y=1-2*(i+0.5)/N,rr=Math.sqrt(1-y*y),ph=i*2.399963;d.set(Math.cos(ph)*rr,y,Math.sin(ph)*rr);if(d.dot(to)<0.1)continue;
    H.copy(R.c).addScaledVector(d,rockR(R,d));v.subVectors(H,P0);const L=v.length();if(L<1.5)continue;v.multiplyScalar(1/L);
    incRockNormal(R,H,n);const sa=-v.dot(n);if(sa<0.02)continue; // it comes from above the surface
    let clear=true;for(let k=1;k<=7;k++){q.copy(P0).addScaledVector(v,L*k/8);if(incRockF(R,q)<0.5){clear=false;break;}}if(!clear)continue;
    if(needSee){o.copy(H).addScaledVector(n,0.8);if(shipBetween(o,P.pos)||rockRay(o,_h2.subVectors(P.pos,o))>=0)continue;}
    // how sharply the curve to this spot bends (the same Hermite the plan uses): a heavy swimmer wants the gentlest one
    const T0=_h3.copy(V).multiplyScalar(Math.max(2,L*0.9)),T1=q.copy(v).addScaledVector(n,sa).normalize().multiplyScalar(THREE.MathUtils.clamp(L,4,20));
    let pt=null,pp=_h2.copy(P0),worst=0,need=0;
    for(let k=1;k<=20;k++){const u=k/20,u2=u*u,u3=u2*u;
      const tg=_w3.copy(P0).multiplyScalar(6*u2-6*u).addScaledVector(T0,3*u2-4*u+1).addScaledVector(H,-6*u2+6*u).addScaledVector(T1,3*u2-2*u),
        pos=_w4.copy(P0).multiplyScalar(2*u3-3*u2+1).addScaledVector(T0,u3-2*u2+u).addScaledVector(H,-2*u3+3*u2).addScaledVector(T1,u3-u2);
      if(tg.lengthSq()<1e-6){worst=9;break;}tg.normalize();
      if(u>=0.25&&u<0.95)need=Math.max(need,Math.min(0.7,6*(1-u))-incRockF(R,pos)); // would the curve dip into the rock before the end?
      if(pt){const ds=pos.distanceTo(pp);if(ds>1e-4)worst=Math.max(worst,Math.acos(THREE.MathUtils.clamp(tg.dot(pt),-1,1))/ds);}
      pt=pt?pt.copy(tg):tg.clone();pp.copy(pos);}
    const c=2.2*worst+1.2*need+3*Math.max(0,sa-0.4)+0.03*L;
    if(c<bc){bc=c;best=d.clone();}}
  return best;}
// time to go home. A rock it ran into is where it lands (if it may); when its time is up, about half the time a rock closer than the hull spot (within ~15 m, with a clear view
// of you) is as good as the hull. If the spot is behind it, it turns first.
function incSwimBack(e,rock){const S=e.sw,hp=hullParam(e.sc),[z,th]=freeSpot(THREE.MathUtils.clamp(hp.z,-12,19),hp.th,2),hn=new THREE.Vector3(),H=hullPoint(z,th,new THREE.Vector3(),hn);
  let R=rock&&incRockOK(e,rock)?rock:null,rd=null;
  if(!rock&&e.rockStops<2&&Math.random()<0.5){let best=1e9;
    for(const Q of ROCKS){if(!incRockOK(e,Q))continue;const d=_w1.subVectors(e.sc,Q.c),L=d.length();if(L<1e-4)continue;d.multiplyScalar(1/L);const sd=L-rockR(Q,d);if(sd>=15||sd>=e.sc.distanceTo(H)||sd>=best)continue;
      const o=_w2.copy(Q.c).addScaledVector(d,rockR(Q,d)+0.8);if(shipBetween(o,P.pos)||rockRay(o,_w3.subVectors(P.pos,o))>=0)continue;best=sd;R=Q;}}
  if(R){ // inside the rock already (it noticed late)? come out first; then pick the landing spot
    const f=incRockF(R,e.sc);if(f<1.2){const out=_w1.subVectors(e.sc,R.c).normalize().multiplyScalar(1.2-f);e.sc.add(out);e.pos.add(out);}
    rd=incRockSpot(e,R,!rock)||(rock?incRockSpot(e,R,false):null);
    if(!rd){if(rock)rd=new THREE.Vector3().subVectors(e.sc,R.c).normalize();else R=null;}}
  e.st='swimBack';e.t=0;e.lp={ref:R,rd,hullH:H,hullN:hn,z,th,sm:'path',land:0,B:0};
  const tgt=R?_w2.copy(R.c).addScaledVector(rd,rockR(R,rd)):H;
  // the spot is behind it (by where it looks or where it is heading, a bit stricter than in the chase because a U-turn path would whip its body round): turn first
  const dT=_w1.subVectors(tgt,e.sc).normalize(),hd=e.vel.lengthSq()>1?_w3.copy(e.vel).normalize():e.face;
  if(Math.min(e.face.dot(dT),hd.dot(dT))<-0.35&&e.clk-S.turnT>2){e.lp.sm='turn';S.turnT=e.clk;e.B.play('Swim_Turn180',0.2);}else incSwimPlan(e);}
function incCharge(e){e.st='charge';e.t=0;say('inc_beam',4,{cd:25});e.B.play('Idle',0.2);e.aim.subVectors(P.pos,incCore(e,_j1)).normalize();e.coreHit=0;if(!(AC&&playS('laserCharge',0.75,1)))sfx('reload');}
function incMelee(e,clip){e.st='melee';e.t=0;e.atk=clip;e.B.play(clip,0.12);e.cds.melee=1.8;sfx('chitter',e.pos);}
function incFall(e,dt){const F=e.fall;F.v=Math.min(70,F.v+(F.cine?40:55)*dt);const d=_j1.subVectors(F.tgt,e.pos),L=d.length(),a=F.cine?40:55,eta=(-F.v+Math.sqrt(F.v*F.v+2*a*L))/a;
  if(!F.snd&&AC&&SFXB&&SFXB.fall&&SFXB.fall.length){if(F.take==null)F.take=Math.floor(Math.random()*SFXB.fall.length);if(eta<=SFXB.fall[F.take].duration)F.snd=playTake('fall',F.take,0.85,0.85);}
  if(!F.arr&&eta<=9/24){F.arr=1;e.B.play('Arrive',0.12);} // the impact frame of Arrive (f9) lands on the hit
  if(L<=F.v*dt+0.05||d.dot(F.n)>0){incLand(e);return;}
  e.pos.addScaledVector(d.normalize(),F.v*dt);}
function incLand(e){const F=e.fall;e.pos.copy(F.tgt);e.n.copy(F.n);e.fall=null;e.st='arrive';e.t=0;if(!F.arr)e.B.play('Arrive',0.05);
  if(F.cine&&CINE.camN)e.face.subVectors(CINE.camN,e.pos);else e.face.subVectors(P.pos,e.pos);
  if(F.snd){try{F.snd.g.gain.setTargetAtTime(0,AC.currentTime,0.03);F.snd.s.stop(AC.currentTime+0.25);}catch(err){}}
  for(const c of [0xffb040,0x8a6a40,0xff5a10])burst(F.tgt,c,30);sfx('impact');shake(F.cine?0.5:0.8);
  let best=null,bd=10;for(const pa of PATCHES){const dd=pa.pos.distanceTo(F.tgt);if(dd<bd){bd=dd;best=pa;}}if(best&&state==='play')damagePatch(best,8);
  const away=_j1.subVectors(P.pos,F.tgt),dd=away.length();if(dd<10&&dd>0.01)P.vel.addScaledVector(away.normalize(),12*(1-dd/10));
  showMsg('¡INCINERADORA!','Viene a por ti · esquiva el láser con Shift · su núcleo del pecho es el punto débil',3.4);say('inc_land',4);}
// fly back down onto the hull after a leap (also used if it dies in the air)
// v67 (Santi: "la animación de vuelta es muy dura"): a smooth curve that carries on from how it was moving and comes down onto the hull
// gently; its back turns to the hull little by little over the whole trip (before: a straight line and a quick flip)
function incBack(e,dt){
  if(!e.tgt){const hp=hullParam(e.pos);const [z,th]=freeSpot(THREE.MathUtils.clamp(hp.z,-12,19),hp.th,2);e.tz=z;e.tth=th;e.tn=new THREE.Vector3();e.tgt=hullPoint(z,th,new THREE.Vector3(),e.tn);
    const v0=e.vel.clone();if(v0.length()>10)v0.setLength(10);e.bk={p0:e.pos.clone(),v0,n0:e.n.clone(),T:THREE.MathUtils.clamp(e.pos.distanceTo(e.tgt)/7,1.1,3.4),x:0};}
  const K=e.bk,T=K.T;K.x=Math.min(1,K.x+dt/T);const x=K.x,x2=x*x,x3=x2*x;
  // Hermite curve: leaves with its own speed, arrives dropping onto the hull at ~2 m/s
  const p=_j1.copy(K.p0).multiplyScalar(2*x3-3*x2+1).addScaledVector(K.v0,(x3-2*x2+x)*T).addScaledVector(e.tgt,-2*x3+3*x2).addScaledVector(e.tn,-2.2*(x3-x2)*T);
  e.vel.subVectors(p,e.pos).divideScalar(Math.max(dt,1e-4));e.pos.copy(p);
  const sm=x*x*(3-2*x);_jq1.setFromUnitVectors(K.n0,e.tn);e.n.copy(K.n0).applyQuaternion(_jq2.identity().slerp(_jq1,sm)).normalize();
  if(!e.lg&&e.st!=='dead'&&(1-x)*T<=9/24){e.lg=1;e.B.play('ZeroG_LandGrip',0.22);}
  if(x>=1){e.pos.copy(e.tgt);e.n.copy(e.tn);e.z=e.tz;e.th=e.tth;e.tgt=null;e.bk=null;e.lg=0;e.vel.set(0,0,0);incStep(e,1.6);return true;}
  return false;}
// v67 (Santi): its own entrance, not the spitter's. A higher lens watches it fall; after the impact the camera pushes in and zooms
// to its face while it threatens and roars, looking slightly down at it.
function incCam(dt){CINE.t+=dt;const s=CINE.boss;P.inv=Math.max(P.inv,1);P.vel.multiplyScalar(0.9);
  if(s.st==='fall'&&CINE.t>=CINE.dur-0.75)incFall(s,99); // skipped before it landed: land now
  if(!CINE.camN){const F=s.fall,tg=F?F.tgt:s.pos,hp=hullParam(tg);CINE.n=(F?F.n:UP).clone();
    // wide lens ~10 m along the hull from where it lands and ~4.5 m up (the spitter's lens is low, looking up)
    const n0=new THREE.Vector3(),foot=hullPoint(hp.z+10,hp.th+0.12,new THREE.Vector3(),n0),cam=new THREE.Vector3(),top=tg.clone().addScaledVector(CINE.n,1.2*INC_SC);
    for(let h=4.5;h<9;h+=0.3){cam.copy(foot).addScaledVector(n0,h);if(hullClear(cam,tg)&&hullClear(cam,top))break;}
    pushOutOfRocks(cam,1.5,null);CINE.camN=cam;CINE.camA=cam.clone();CINE.look=s.pos.clone();CINE.landT=-1;camPos.copy(cam);}
  let fov=60;
  if(s.fall){CINE.look.lerp(V2.copy(s.pos).addScaledVector(CINE.n,0.55*INC_SC),1-Math.exp(-20*dt));camPos.copy(CINE.camA);}
  else{if(CINE.landT<0)CINE.landT=0;CINE.landT+=dt;const L=CINE.landT;if(L<0.6)shake(0.32*(1-L/0.6));
    const head=s.bHead.getWorldPosition(V3),close=V1.copy(head).addScaledVector(s.face,3.3).addScaledVector(CINE.n,1.0); // in front of its face, a bit above
    const k=THREE.MathUtils.smoothstep(L,0.45,1.9);camPos.copy(CINE.camA).lerp(close,k);fov=60-18*k;
    CINE.look.lerp(V2.copy(s.pos).addScaledVector(CINE.n,0.55*INC_SC).lerp(head,k),1-Math.exp(-8*dt));}
  camera.position.copy(camPos);
  if(CINE.landT>=0&&CINE.landT<0.8){const k=CINE.landT;camera.position.addScaledVector(CINE.n,-0.35*Math.exp(-k*6)*Math.cos(k*26));} // the hull kicks under the lens
  camera.lookAt(CINE.look);CINE.fov=fov;
  if(CINE.t>=CINE.dur){for(const sh of shards)sh.visible=true;CINE.on=false;CINE.mode='';CINE.camN=null;CINE.boss=null;CINE.fov=0;document.body.classList.remove('cine');}}
function incBeam(e,dt,t){const o=incCore(e,_j5).clone(),d=e.aim;let [L,ship]=incRayLen(o,d);
  // the astronaut anywhere near the beam line burns (and stops it)
  const pr=_j1.subVectors(P.pos,o),along=pr.dot(d),off=pr.addScaledVector(d,-along).length();
  if(state==='play'&&!CINE.on&&along>0&&along<L&&off<0.8){L=along+0.25;ship=false;
    if(!e.beamHit){e.beamHit=1;damagePlayer(12,d.clone());}
    P.hp=Math.max(0,P.hp-26*dt);P.lastHit=playT;e.burnFx=(e.burnFx||0)-dt;
    if(e.burnFx<=0){e.burnFx=0.3;shake(0.14);$('flash').style.opacity=0.6;setTimeout(()=>$('flash').style.opacity=0,90);sfx('sizzle');}
    if(P.hp<=0)endGame(false,'dead');}
  const end=_j2.copy(o).addScaledVector(d,L);
  // a miss scorches the hull: the plate under the beam gets eaten
  if(ship&&state==='play'){let best=null,bd=2.2;for(const pa of PATCHES){const dd=pa.pos.distanceTo(end);if(dd<bd){bd=dd;best=pa;}}if(best){const h0=best.hp;damagePatch(best,5*dt);if(h0>0&&best.hp<=0&&AC)playS('plateRip',0.8,1);}}
  // thick enough to read from far away too (never thinner than ~0.5 % of its distance to the lens)
  const r=Math.max(0.24+0.05*Math.sin(t*60),camera.position.distanceTo(_j3.copy(o).addScaledVector(d,L*0.5))*0.005);
  INC_FX.outer.position.copy(o);INC_FX.outer.lookAt(end);INC_FX.outer.scale.set(r*2.6,r*2.6,L);
  for(const [m,k] of [[INC_FX.core,1],[INC_FX.haze,4.5]]){m.position.copy(o);m.quaternion.copy(INC_FX.outer.quaternion);m.scale.set(r*k,r*k,L);}
  for(const m of [INC_FX.outer,INC_FX.core,INC_FX.haze]){m.visible=true;m.material.uniforms.uT.value=t;m.material.uniforms.uA.value=Math.min(1,e.t*8);}
  INC_FX.glow.visible=true;INC_FX.glow.position.copy(o);INC_FX.glow.scale.setScalar(2.6+Math.random()*0.4);
  INC_FX.hit.visible=true;INC_FX.hit.position.copy(end);INC_FX.hit.scale.setScalar(3.4+Math.random()*0.9);
  INC_FX.light.position.copy(end).addScaledVector(d,-0.6);INC_FX.light.intensity=75;
  e.sparkT=(e.sparkT||0)-dt;if(e.sparkT<=0){e.sparkT=0.05;burst(end,Math.random()<0.5?0xffb040:0xff5010,3);}
  INC_FX.beamOn=1;}
// The clips are made on flat ground. On the curved hull each leg is re-solved so the ankle keeps its height over the REAL surface under it,
// and the foot tilts with that surface. The mixer rewrites these bones every frame (we restore them first in case a track is static).
const _f1=new THREE.Vector3(),_f2=new THREE.Vector3(),_f3=new THREE.Vector3(),_f4=new THREE.Vector3(),_f5=new THREE.Vector3(),_f6=new THREE.Vector3(),_f7=new THREE.Vector3(),_f8=new THREE.Vector3();
const _fN=new THREE.Vector3(),_fq1=new THREE.Quaternion(),_fq2=new THREE.Quaternion(),_fq3=new THREE.Quaternion(),_fq4=new THREE.Quaternion();
function boneRotWorld(bone,q){const pw=bone.parent.getWorldQuaternion(_fq1),w=bone.getWorldQuaternion(_fq2);w.premultiply(q);bone.quaternion.copy(pw.invert().multiply(w));bone.updateMatrixWorld(true);}
function boneSetWorld(bone,qw){const pw=bone.parent.getWorldQuaternion(_fq1);bone.quaternion.copy(pw.invert().multiply(qw));bone.updateMatrixWorld(true);}
// one leg re-solved so the ankle sits dS above/below the flat floor of the clip, and the foot lies on nS
function incLegSolve(e,L,dS,nS){
  const A=L.a.getWorldPosition(_f1),Bk=L.b.getWorldPosition(_f2),C=L.c.getWorldPosition(_f3);
  const T=_f7.copy(C).addScaledVector(e.n,dS);
  const fw0=L.c.getWorldQuaternion(_fq3).clone();
  if(Math.abs(dS)>0.004){
    const l1=Bk.distanceTo(A),l2=C.distanceTo(Bk),dir=_f8.subVectors(T,A);let D=dir.length();if(D<1e-4)return;dir.divideScalar(D);D=THREE.MathUtils.clamp(D,Math.abs(l1-l2)+1e-3,l1+l2-1e-3);
    const pn=_f4.subVectors(Bk,A).cross(_f5.subVectors(C,A));if(pn.lengthSq()<1e-10)return;pn.normalize();
    const ca=THREE.MathUtils.clamp((l1*l1+D*D-l2*l2)/(2*l1*D),-1,1),sa=Math.sqrt(1-ca*ca);
    const side=_f5.crossVectors(pn,dir);if(side.dot(_f6.subVectors(Bk,A))<0)side.negate(); // bend the knee the same way as the clip
    const Bn=_f6.copy(A).addScaledVector(dir,l1*ca).addScaledVector(side,l1*sa);
    boneRotWorld(L.a,_fq4.setFromUnitVectors(_f4.subVectors(Bk,A).normalize(),_f5.subVectors(Bn,A).normalize()));
    const C1=L.c.getWorldPosition(_f4),B1=L.b.getWorldPosition(_f5);
    boneRotWorld(L.b,_fq4.setFromUnitVectors(_f8.subVectors(C1,B1).normalize(),_f6.subVectors(T,B1).normalize()));}
  // the foot follows the slope under it
  const qt=_fq4.setFromUnitVectors(e.n,nS);
  boneSetWorld(L.c,_fq2.copy(qt).multiply(fw0));}
// v71: the tips that touch the stone: the last bone of every toe (3 or 4 per foot; the hind one sits under the ankle)
function incTips(B,s){const o=[];for(let k=1;k<=4;k++){const b=B.bones['toe'+k+'_03'+s]||B.bones['toe'+k+'_02'+s];if(b)o.push(b);}return o;}
const _k1=new THREE.Vector3(),_k2=new THREE.Vector3(),_k3=new THREE.Vector3(),_k4=new THREE.Vector3(),INC_TOE_LIFT=0.01,INC_GN_DAMP=0.65;
// v71: a rock is lumpy, so the foot is measured and re-solved (up to 6 damped passes from the foot of the last frame). The toe tips make a plane: how high it hangs over the stone, compared with the clip's
// own toe heights over a flat floor, lowers or lifts the ankle, and the slopes of that plane tilt the sole (nS), so every toe rests on the stone and none digs in.
function incToesDown(e,L,dS,nS,dt){const R=e.rk.R,nT=L.ct.length,cl=THREE.MathUtils.clamp;if(nT<2)return;
  let bw=1e9,bd=dS;const bn=(L.bn||(L.bn=new THREE.Vector3())).copy(nS);
  for(let it=0;it<6;it++){
    const u=_k1.copy(e.face).addScaledVector(nS,-e.face.dot(nS)),v=_k2,ank=L.c.getWorldPosition(_k3);if(u.lengthSq()<1e-4)return;u.normalize();v.crossVectors(nS,u);
    // a toe j is d_j over where it should be; lowering the ankle by s and tilting the sole by tu (toward u) and tv (toward v) about the ankle moves it by -(s + tu*a_j + tv*b_j), a/b = its offset from the ankle along u/v
    let n12=0,n13=0,n22=0,n23=0,n33=0,r1=0,r2=0,r3=0,worst=0;
    for(let j=0;j<nT;j++){const w=L.ct[j].getWorldPosition(_k4),dj=incClear(R,w)-L.ty[j]-INC_TOE_LIFT;w.sub(ank);const a=w.dot(u),b=w.dot(v);
      n12+=a;n13+=b;n22+=a*a;n23+=a*b;n33+=b*b;r1+=dj;r2+=a*dj;r3+=b*dj;worst=Math.max(worst,Math.abs(dj));}
    if(worst<bw){bw=worst;bd=dS;bn.copy(nS);}
    if(worst<0.012||it===5||!incSolve3(nT,n12,n13,n22+0.01,n23,n33+0.01,r1,r2,r3))break;
    dS=cl(dS-INC_GN_DAMP*cl(_sM[0],-0.5,0.5),-0.45,0.35); // (damped: the full step overshoots on a lumpy stone and the passes swing between two poses)
    nS.addScaledVector(u,INC_GN_DAMP*cl(_sM[1],-0.45,0.45)).addScaledVector(v,INC_GN_DAMP*cl(_sM[2],-0.45,0.45)).normalize();
    const cn=nS.dot(e.n);if(cn<0.77){const t=_k4.copy(nS).addScaledVector(e.n,-cn);if(t.lengthSq()>1e-6)nS.copy(e.n).multiplyScalar(0.77).addScaledVector(t.normalize(),0.638);} // the sole never leans more than ~40 degrees off the body
    L.a.quaternion.copy(L.qa);L.b.quaternion.copy(L.qb);L.c.quaternion.copy(L.qc);L.a.updateMatrixWorld(true);incLegSolve(e,L,dS,nS);}
  // the best pass, but not in one jump: on a lumpy stone the best pose can change a lot between two frames, so the foot slides to it (~0.07 s) instead of snapping
  let ws=L.ws&&L.ws.k===e.rk?L.ws:null;
  if(ws){const a=1-Math.exp(-(dt||0.016)/0.07);bd=ws.d+(bd-ws.d)*a;bn.lerpVectors(ws.n,bn,a).normalize();}else ws=L.ws={k:e.rk,d:0,n:new THREE.Vector3()};
  if(bd!==dS||bn.dot(nS)<0.99999){L.a.quaternion.copy(L.qa);L.b.quaternion.copy(L.qb);L.c.quaternion.copy(L.qc);L.a.updateMatrixWorld(true);incLegSolve(e,L,bd,bn);} // the last pass was not the one to show: back to it
  ws.d=bd;ws.n.copy(bn);}
function incFeet(e){const dt=e.dt; // (the frame time of updateInc)
  if(!e.legs)e.legs=['L','R'].map(s=>{const ct=incTips(e.B,s);return {a:incBone(e.B,'thigh.'+s),b:incBone(e.B,'shin.'+s),c:incBone(e.B,'foot.'+s),qa:new THREE.Quaternion(),qb:new THREE.Quaternion(),qc:new THREE.Quaternion(),s:false,
    ct,ty:ct.map(b=>{const g=e.fg.find(q=>q.n===b.name);return g?g.y:0.1;})};}).filter(l=>l.a&&l.b&&l.c);
  for(const L of e.legs){L.qa.copy(L.a.quaternion);L.qb.copy(L.b.quaternion);L.qc.copy(L.c.quaternion);L.s=true;
    const C=L.c.getWorldPosition(_f3);
    if(!incSurf(e,C,_f5,_f6))continue;const nS=_fN.copy(_f6); // v69: the hull, or the rock it stands on
    // v69 (Santi): a rock is lumpy, its slope changes within a stride: the sole lies along the chord to the surface under the toes (mean of both normals)
    if(e.rk){_f4.copy(C).addScaledVector(e.face,0.65);if(incSurf(e,_f4,_f7,_f8))nS.add(_f8).normalize();}
    let dS=THREE.MathUtils.clamp(_f4.subVectors(_f5,e.pos).dot(e.n),-0.9,0.6); // where the real hull is, vs the flat floor of the clip
    if(e.rk&&L.ws&&L.ws.k===e.rk){dS=L.ws.d;nS.copy(L.ws.n);} // v71: on a rock, carry on from the foot of the last frame (no snapping from one fit to another while it turns)
    incLegSolve(e,L,dS,nS);
    if(e.rk)incToesDown(e,L,dS,nS,dt);}}
function incSpheres(e){if(!e.hs.length){e.hs=[{p:new THREE.Vector3(),r:0.11*INC_SC,part:'head'},{p:new THREE.Vector3(),r:0.09*INC_SC,part:'core'}];
    for(let i=0;i<e.bBody.length;i++)if(e.bBody[i])e.hs.push({p:new THREE.Vector3(),r:e.rBody[i]*INC_SC,part:'body',b:e.bBody[i]});}
  e.bHead.getWorldPosition(e.hs[0].p);incCore(e,e.hs[1].p);for(let i=2;i<e.hs.length;i++)e.hs[i].b.getWorldPosition(e.hs[i].p);}
// bullets: the small weak spots (core, head) win when the shot passes through them, otherwise the first body sphere
function incRay(p0,step,sl){let best=null;
  for(const e of INCS){if(e.st==='dead'||e.st==='fall'||e.st==='gone'||!e.hs.length)continue;let bodyT=2,crit=null;
    for(const h of e.hs){const tt=THREE.MathUtils.clamp(_j4.subVectors(h.p,p0).dot(step)/sl,0,1);if(_j6.copy(p0).addScaledVector(step,tt).distanceTo(h.p)>=h.r)continue;
      if(h.part==='body'){if(tt<bodyT)bodyT=tt;}else if(!crit||tt<crit.t)crit={t:tt,part:h.part};}
    const hit=crit?{e,t:crit.t,part:crit.part}:bodyT<2?{e,t:bodyT,part:'body'}:null;if(hit&&(!best||hit.t<best.t))best=hit;}
  return best;}
function incDamage(e,dmg,part,bvel,p){if(e.st==='dead'||e.st==='fall'||e.st==='gone')return;const bd=_j1.copy(bvel).normalize();
  const front=-bd.dot(e.face)>0.3,guard=(e.st==='guard'||e.st==='guardS')&&front,firing=e.st==='charge'||e.st==='beamStart'||e.st==='beam';
  let m=part==='head'?2:part==='core'?(firing?3:1.5):1;if(guard)m=0.5; // v67: the guard stops half (was 80 %), the core always hurts more
  const d=(PU.over>0?5:dmg)*m;e.hp-=d;e.flash=1;stats.hits++;addPts(PTS.hit);
  if(guard){burst(p,0xd8d0c0,6);sfx('hit',p);floatText(p.clone(),'BLOQUEADO','loss');}else if(m>=2){burst(p,0xffffff,10);sfx('crit',p);crossCrit();}else{burst(p,0xffc050,7);sfx('hit',p);crossHit();}
  if(e.hp<=0){killInc(e,m>=2);return;}
  // shot from the front again and again: it covers up with all four arms
  if(front&&!guard){e.front.push(playT);e.front=e.front.filter(x=>playT-x<1.3);
    if(e.front.length>=4&&(e.st==='stalk'||e.st==='rock')&&e.cds.guard<=0){e.st='guardS';e.t=0;e.B.play('Guard_Start',0.1);e.cds.guard=9;e.front.length=0;return;}}
  // the core cracks while it charges or fires: it reels back and the beam dies
  if(part==='core'&&firing){e.coreHit+=d;if(e.coreHit>=7){incBeamSnd(false);e.st='hit';e.t=0;e.B.play('Hit_Front',0.08);e.cds.beam=3;e.cds.stag=2.5;return;}}
  e.stagAcc+=d;if(e.stagAcc>=12&&e.cds.stag<=0&&(e.st==='stalk'||e.st==='rock')){e.stagAcc=0;e.cds.stag=3;const side=-bd.dot(_j2.crossVectors(e.n,e.face));
    e.st='hit';e.t=0;e.B.play(front?'Hit_Front':side>0?'Hit_Left':'Hit_Right',0.08);}}
function killInc(e,crit){incBeamSnd(false);const air=incAir(e);e.st='dead';e.t=0;e.hop=0;e.deadFly=air;
  if(!e.deadFly)e.B.play(crit?'Death_Shot':'Death_Collapse',0.15);e.crit=crit;
  stats.incs=(stats.incs||0)+1;stats.kills++;addPts(800);comboBanner('¡INCINERADORA ABATIDA!','+'+ptsVal(800));say('inc_dead',4);
  const c=incCenter(e,new THREE.Vector3());floatText(c.clone(),(crit?'CRÍTICO +':'+')+ptsVal(800),'crit');
  if(!(AC&&playS('roar',0.9,0.6)))sfx('kill',e.pos);shake(0.5);hitStop=0.08;crossKill();for(let i=0;i<3;i++)burst(c,0xff7a30,20);spawnDrop(c.clone().addScaledVector(e.n,1.2),pickPU());}
function incRemove(e){burst(incCenter(e,_j1),0xff3020,40);burst(incCenter(e,_j1),0xff9a40,30);deathFlash(e.pos);sfx('kill',e.pos);scene.remove(e.B.g);e.st='gone';INCS.splice(INCS.indexOf(e),1);}
function updateInc(e,dt,t){const B=e.B;e.t+=dt;e.clk+=dt;e.dt=dt;if(e.rk)incRockStick(e,dt);for(const k in e.cds)e.cds[k]-=dt;e.flash=Math.max(0,e.flash-dt*5);
  const live=state==='play'&&!CINE.on;const toP=new THREE.Vector3().subVectors(P.pos,e.pos),dist=toP.length();let glow=1.4;
  switch(e.st){
    case 'fall':if(!(CINE.on&&CINE.boss===e&&CINE.t<0.35))incFall(e,dt);glow=1.2;break;
    case 'arrive':if(B.at(29)){if(!(AC&&playS('roar',1.0,0.72)))sfx('roar',e.pos);}glow=1.3+Math.min(1,e.t/1.2)*1.2;if(B.done()){e.st='roar';e.t=0;B.play('Roar',0.2);}break;
    case 'roar':if(B.at(16)){if(!(AC&&playS('roar',0.9,0.66)))sfx('roar',e.pos);shake(0.25);}glow=B.cur.time>14/24?3.2:1.6;if(B.done()){incStalk(e);e.cds.beam=Math.min(e.cds.beam,1.2);}break;
    case 'stalk':{
      const hq=hullParam(P.pos);hullPoint(hq.z,hq.th,_j5,_j6);const pH=_j1.subVectors(P.pos,_j5).dot(_j6); // how high you float above the hull
      const tan=toP.clone().addScaledVector(e.n,-toP.dot(e.n)),flat=tan.length();
      const core=incCore(e,new THREE.Vector3()),see=!shipBetween(core,P.pos)&&rockRay(core,_j2.subVectors(P.pos,core))<0;
      const running=e.roam&&e.roam.p.distanceTo(e.pos)>4.5;const facing=running?e.face.dot(_j3.copy(tan).normalize()):incTurn(e,flat>0.3?tan:e.face,2.4,dt);
      if(live){
        if(dist<4.6&&e.cds.melee<=0&&facing>0.4){incMelee(e,dist<3.3?'Bite':'JumpSlash');break;}
        if(see&&e.cds.leap<=0&&dist>6&&dist<70&&pH>2.5){e.st='swimStart';e.t=0;e.sa=0;B.play('Swim_Start',0.2);break;} // v67: also when you shoot it from far off the ship (v69: it swims, no jump clip)
        if(see&&e.cds.beam<=0&&dist<44&&dist>3.5){incCharge(e);break;}}
      // it never stands still: it keeps moving to new spots around you (running, walking or side-stepping while it stares at you)
      // and covers big distances with long leaps across the hull
      e.roamT-=dt;if(!e.roam||e.roamT<=0||e.pos.distanceTo(e.roam.p)<2.2){e.roam=incPickRoam(e);e.roamT=4+Math.random()*3;}
      let spd=0,clip='Idle';const mdir=new THREE.Vector3();
      if(e.roam){const to=_j3.subVectors(e.roam.p,e.pos);to.addScaledVector(e.n,-to.dot(e.n));const dR=to.length();
        if(live&&dR>16&&e.cds.hop<=0){incHullLeap(e,e.roam);e.roam=null;break;} // long leaps only for the far ones: the rest it runs
        if(dR>0.5){mdir.copy(to).normalize();
          if(dR>4.5){spd=6.5;clip='Run';incTurn(e,mdir,3.6,dt);} // running: it looks where it goes (v67: runs more, and faster)
          else{const fw=mdir.dot(e.face),lat=mdir.dot(_j4.crossVectors(e.n,e.face));
            if(Math.abs(lat)>Math.abs(fw)){spd=1.3;clip=lat>0?'Strafe_L':'Strafe_R';}else if(fw>0){spd=1.25;clip='Walk';}else{spd=1.25;clip='Walk';incTurn(e,mdir,3,dt);}}}}
      if(!live||!(spd>0&&incMove(e,mdir,spd,dt))){spd=0;clip='Idle';if(live&&e.roam)e.roamT=Math.min(e.roamT,0.5);}
      const base={Walk:0.36,Run:1.5,Strafe_L:0.4,Strafe_R:0.4}[clip];B.play(clip,0.25,base?spd/(base*INC_SC):1);
      if(base){e.stepT=(e.stepT||0)-dt;if(e.stepT<=0){e.stepT=clip==='Run'?0.32:0.6;incStep(e);}}
      break;}
    case 'melee':{incTurn(e,toP,3,dt);
      const hitAt=(f,dmg,r)=>{if(B.at(f)&&live&&dist<r&&_j1.copy(toP).normalize().dot(e.face)>0.15){damagePlayer(dmg,toP.clone());shake(0.4);}};
      if(e.atk==='Bite')hitAt(10,18,4.4);
      else{hitAt(16,14,5.4);hitAt(22,14,5.4);const ft=B.cur.time*24;e.hop=ft>8&&ft<26?Math.sin((ft-8)/18*Math.PI)*1.6:0; // the leap of the slash
        if(ft>8&&ft<22){const tg=toP.clone().addScaledVector(e.n,-toP.dot(e.n));if(tg.length()>2.5)incMove(e,tg.normalize(),3.2,dt);}}
      glow=2.4;if(B.done())incStalk(e);break;}
    // v69 (Santi): leaving the hull = swimming. Crouch on the hull, push off at f11 at 8 m/s toward you, swim pose by f25.
    case 'swimStart':glow=2.2;
      if(!e.sa){incTurn(e,toP,3,dt);if(B.at(11))incSwimLaunch(e);}
      else{e.sw.t+=dt;incSwimMove(e,dt,_w1.subVectors(P.pos,e.sc).normalize(),6.5,1.5);}
      if(B.done()&&e.sa){e.st='swim';e.t=0;e.sw.sm='loop';e.sw.fr=0;B.play('Swim_Loop',0.2);}
      break;
    // v67 (Santi): it doesn't just lunge once. It swims through space after you with heavy strokes and claws at you up close,
    // so floating far off the ship to shoot it from a distance is no longer safe. It can only stay out a few seconds, then it goes back.
    // v69: Swim_Loop at ~7.5 m/s (the speed follows the pull of the stroke), Swim_Slash within ~5 m in front of it, Swim_Turn180 when you are >120 degrees behind it.
    case 'swim':{const S=e.sw,want=_w1.subVectors(P.pos,e.sc),dl=want.length();want.divideScalar(Math.max(dl,1e-4));glow=2.4;S.t+=dt;
      if(S.sm==='loop'){const fr=B.cur.time*24;
        if(S.fr<11&&fr>=11&&AC)playS('tss',0.2,0.55+Math.random()*0.1);S.fr=fr; // one puff at the start of every pull
        const fw=e.face.dot(want);
        if(live&&fw<-0.5&&e.clk-S.turnT>2){S.sm='turn';S.turnT=e.clk;B.play('Swim_Turn180',0.2);} // more than ~120 degrees behind its facing (at most one turn every 2 s)
        else if(live&&dl<5&&fw>0.5&&e.cds.melee<=0){S.sm='slash';B.play('Swim_Slash',0.2);e.cds.melee=2.2;sfx('chitter',e.pos);}
        incSwimMove(e,dt,want,incStrokeV(fr),2.0);}
      else if(S.sm==='slash'){ // three claws (f9 left, f16 right, f27 left) while it keeps drifting toward you
        for(const f of [9,16,27])if(B.at(f)&&live&&dl<5.2&&e.face.dot(want)>0.5){damagePlayer(10,want.clone());P.vel.addScaledVector(want,6);shake(0.4);}
        incSwimMove(e,dt,want,3.5,1.2,want);
        if(B.done()){S.sm='loop';S.fr=0;B.play('Swim_Loop',0.2);}}
      else{ // the turn: brake, heading and facing frozen (the clip turns the body); at its end the entity flips 180 degrees
        incSwimMove(e,dt,null,1.5,0,null);
        if(B.done()){incSwimFlip(e);S.sm='loop';S.fr=0;}}
      if(S.sm!=='turn'){const RK=S.t>0.5?incRockAhead(e):null; // a rock in its way: it lands on it (if it may) instead of bouncing back to the hull
        if(RK||S.t>S.T||e.sc.distanceTo(S.o)>30||(S.t>0.9&&pushOutOfShip(_w2.copy(e.sc),1.2,null)))incSwimBack(e,RK||undefined);}
      break;}
    case 'swimBack':glow=2;
      if(e.lp.sm==='turn'){incSwimMove(e,dt,null,1.5,0,null);if(B.done()){incSwimFlip(e);incSwimPlan(e);}}
      else incSwimPath(e,dt);
      break;
    case 'swimLand':glow=2;
      if(!e.sl)incSwimPath(e,dt);else if(B.done())incStalk(e);
      break;
    // v69 (Santi): perched on a rock (glued to it, see incRockStick). It turns to you, fires the chest laser once if it sees you, and after 4-7 s (or when you come within ~6 m)
    // it leaves with Swim_Start. The laser states go back to this one through incStalk.
    case 'rock':{const K=e.rk,R=K.R;glow=1.5;incTurn(e,toP,2.4,dt);B.play('Idle',0.25);
      const core=incCore(e,new THREE.Vector3()),see=!shipBetween(core,P.pos)&&rockRay(core,_j2.subVectors(P.pos,core))<0;
      if(R.leaving||R.fade<0.98||(live&&(e.clk-K.t0>K.stay||dist<6)))incRockLeave(e);
      else if(live&&!K.fired&&see&&e.cds.beam<=0&&dist<44&&dist>6){K.fired=1;incCharge(e);}
      break;}
    case 'hopTake':{const R=e.hopTo;incTurn(e,_j3.subVectors(R.p,e.pos),3,dt);glow=2;
      if(B.at(12)){const d=e.pos.distanceTo(R.p);e.arc={p0:e.pos.clone(),n0:e.n.clone(),p1:R.p.clone(),n1:R.n.clone(),z1:R.z,th1:R.th,d,T:Math.max(1.0,d/11),H:Math.min(7,2.5+d*0.17)};
        e.arc.c=e.arc.p0.clone().add(e.arc.p1).multiplyScalar(0.5).addScaledVector(e.arc.n0.clone().add(e.arc.n1).normalize(),2*e.arc.H);
        e.st='hop';e.t=0;B.play('ZeroG_Float',0.15);if(!(AC&&playS('tss',0.6,0.5)))sfx('dash');}
      break;}
    case 'hop':{const A=e.arc,u=Math.min(1,e.t/A.T),v=1-u;glow=1.8;
      e.pos.set(0,0,0).addScaledVector(A.p0,v*v).addScaledVector(A.c,2*u*v).addScaledVector(A.p1,u*u);
      e.n.copy(A.n0).lerp(A.n1,u).normalize();const dv=_j3.subVectors(A.c,A.p0).multiplyScalar(2*v).addScaledVector(_j4.subVectors(A.p1,A.c),2*u);if(dv.lengthSq()>1e-6)e.face.copy(dv);
      if(!A.lg&&A.T-e.t<=9/24){A.lg=1;B.play('ZeroG_LandGrip',0.2);}
      if(u>=1){e.pos.copy(A.p1);e.n.copy(A.n1);e.z=A.z1;e.th=A.th1;e.arc=null;e.st='land';e.t=0;if(B.curName!=='ZeroG_LandGrip')B.play('ZeroG_LandGrip',0.05);
        incStep(e,1.8);shake(Math.max(0.05,0.3-e.pos.distanceTo(P.pos)*0.01));burst(e.pos,0x8a6a40,14);e.cds.hop=9+Math.random()*5;}
      break;}
    case 'land':if(B.done()){e.st='rise';B.play('Grip_Rise',0.25);}break;
    case 'rise':if(B.done())incStalk(e);break;
    case 'charge':incTurn(e,toP,3,dt);incAimTrack(e,dt,2.2);glow=1.5+Math.min(1,e.t/0.6)*2.5;INC_FX.aimOn=1;
      if(e.t>=0.6){e.st='beamStart';e.t=0;B.play('Beam_Start',0.1);}break;
    case 'beamStart':incTurn(e,toP,2,dt);incAimTrack(e,dt,1.4);glow=4;INC_FX.aimOn=1;if(B.done()){e.st='beam';e.t=0;B.play('Beam_Loop',0.08);e.beamHit=0;incBeamSnd(true);}break;
    case 'beam':{const rate=Math.min(1.6,7.5/Math.max(3,dist)); // it sweeps after you at ~7.5 m/s: keep moving fast or dash out of it
      incAimTrack(e,dt,rate);incTurn(e,e.aim,rate,dt);glow=4.5;incBeam(e,dt,t);
      if(e.t>=1.7){e.st='beamEnd';e.t=0;B.play('Beam_End',0.12);incBeamSnd(false);e.cds.beam=3.6+Math.random()*1.8;}break;}
    case 'beamEnd':glow=2;if(B.done())incStalk(e);break;
    case 'guardS':glow=1.8;if(B.done()){e.st='guard';e.t=0;B.play('Guard_Loop',0.1);}break;
    case 'guard':incTurn(e,toP,2.5,dt);glow=1.8;if(e.t>1.4){e.st='guardE';e.t=0;B.play('Guard_End',0.1);}break;
    case 'guardE':glow=2.5;if(B.done()){if(e.rk)incStalk(e);else if(dist<5.5)incMelee(e,'JumpSlash');else incCharge(e);}break;
    case 'hit':glow=2;if(B.done())incStalk(e);break;
    case 'elec':glow=Math.random()<0.5?5:0.5;if(e.t>3){incStalk(e);e.cds.beam=Math.min(e.cds.beam,1);}break;
    case 'dead':glow=Math.max(0,1.5-e.t*0.8);
      if(e.deadFly){if(incBack(e,dt)){e.deadFly=false;e.t=0;B.play(e.crit?'Death_Shot':'Death_Collapse',0.1);}}
      else if(e.t>3.3)incRemove(e);break;
  }
  if(e.st==='gone')return;
  e.state=e.st;B.glow(glow*(1+e.flash*0.6));incPlace(e);
  if(e.legs)for(const L of e.legs)if(L.s){L.a.quaternion.copy(L.qa);L.b.quaternion.copy(L.qb);L.c.quaternion.copy(L.qc);L.s=false;}
  B.update(dt);B.g.updateMatrixWorld(true);
  const onHull=!incAir(e);if(onHull)incFeet(e);
  incSpheres(e);}
// shared beam / aim-line visuals: shown only while someone is charging or firing
function incFxFrame(){
  if(!INC_FX.beamOn){INC_FX.outer.visible=INC_FX.core.visible=INC_FX.haze.visible=INC_FX.hit.visible=INC_FX.glow.visible=false;INC_FX.light.intensity=0;}
  const a=INCS.find(e=>e.st==='charge'||e.st==='beamStart');INC_FX.aim.visible=INC_FX.aimM.visible=!!a&&!INC_FX.beamOn;
  if(a){const o=incCore(a,_j5).clone(),[L]=incRayLen(o,a.aim);const p=INC_FX.aim.geometry.attributes.position;p.setXYZ(0,o.x,o.y,o.z);p.setXYZ(1,o.x+a.aim.x*L,o.y+a.aim.y*L,o.z+a.aim.z*L);p.needsUpdate=true;
    INC_FX.aim.material.opacity=0.35+0.4*Math.abs(Math.sin(playT*22));INC_FX.glow.visible=true;INC_FX.glow.position.copy(o);INC_FX.glow.scale.setScalar(0.8+Math.min(1.6,a.t*2.5));
    // the aiming beam: thin, flickering, it tells you exactly where the shot will go
    const ar=Math.max(0.035,camera.position.distanceTo(o)*0.0018);INC_FX.aimM.position.copy(o);INC_FX.aimM.lookAt(_j4.copy(o).add(a.aim));INC_FX.aimM.scale.set(ar,ar,L);
    INC_FX.aimM.material.uniforms.uT.value=playT;INC_FX.aimM.material.uniforms.uA.value=0.45+0.4*Math.abs(Math.sin(playT*22));}
  INC_FX.beamOn=0;INC_FX.aimOn=0;}
function spitterAim(s,dist){if(state!=='play'||s.cd>0||dist>42)return;if(shipBetween(s.pos,P.pos)){s.cd=0.4;return;}
  // close: rears up and pounces like the small ones (bigger bite) · far: spits burning venom
  const g=(s.gen||1)-1;s.atk=dist<14+g&&Math.random()<0.72?'pounce':'spit';s.state='windup';s.t=0;s.windT=Math.max(0.45,(s.atk==='pounce'?0.75:1.0)-g*0.06);sfx(s.atk==='pounce'?'chitter':'gurgle',s.pos);}
function spitAcid(s){const R=s.mesh.userData.rig;s.mesh.updateMatrixWorld(true);
  const o=R&&R.spit?R.spit.getWorldPosition(new THREE.Vector3()):s.mesh.position.clone().addScaledVector(UP,1.2);
  const spd=15,lead=P.pos.clone().addScaledVector(P.vel,o.distanceTo(P.pos)/spd*0.75);
  const m=new THREE.Group();m.position.copy(o);const blob=new THREE.Mesh(acidGeo,acidMat);m.add(blob);
  const h=new THREE.Sprite(new THREE.SpriteMaterial({map:acidHalo,color:new THREE.Color(1.0,0.45,0.08),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.45}));h.scale.setScalar(0.7);m.add(h);
  const drops=[];for(let k=0;k<6;k++){const d=new THREE.Mesh(dropGeo,acidMat);d.scale.setScalar(1-k*0.13);scene.add(d);drops.push({d,o:new THREE.Vector3().randomDirection().multiplyScalar(0.06)});}
  scene.add(m);const vel=lead.sub(o).normalize().multiplyScalar(spd);m.lookAt(o.clone().add(vel));ACID.push({m,blob,drops,vel,life:3.4,trail:0,t:0});
  burst(o,0xff7a30,10);sfx('spit',s.pos);s.state='crawl';const gk=(s.gen||1)-1;s.cd=THREE.MathUtils.randFloat(Math.max(1.1,2.9-wave*0.05-gk*0.2),Math.max(1.7,3.9-wave*0.05-gk*0.25));s.lastGen=gk;
  if(++s.spits<=2)say('sp_spit',2,{cd:25});}
function updateAcid(dt){for(let i=ACID.length-1;i>=0;i--){const a=ACID[i];a.life-=dt;a.t+=dt;a.m.position.addScaledVector(a.vel,dt);
    // a wobbling stretched glob of liquid, its droplets trailing behind
    const w=Math.sin(a.t*38)*0.18;a.blob.scale.set(1+w,1-w*0.6,2.4-w);
    const back=V2.copy(a.vel).normalize().multiplyScalar(-1);a.drops.forEach((q,k)=>{q.d.position.copy(a.m.position).addScaledVector(back,0.32+k*0.2).add(q.o).addScaledVector(V3.set(Math.sin(a.t*20+k),Math.cos(a.t*17+k*2),0),0.04);});
    a.trail-=dt;if(a.trail<=0){a.trail=0.06;mistAcid(V3.copy(a.m.position).addScaledVector(back,1.1));}
    let pop=a.life<=0,hitP=false;
    if(state==='play'&&a.m.position.distanceTo(P.pos)<1.0&&P.inv<=0){hitP=true;pop=true;}
    else if(pushOutOfShip(V1.copy(a.m.position),0.1,null)||wingAt(a.m.position)||rockAt(a.m.position))pop=true;
    if(pop){burst(a.m.position,0xff8a20,18);sfx('splat',a.m.position);scene.remove(a.m);a.m.children[1].material.dispose();for(const q of a.drops)scene.remove(q.d);ACID.splice(i,1);
      if(hitP)acidBurn(a.vel);}}}
// the venom sticks and burns: a small hit, then the suit melts away for a few seconds
function acidBurn(dir){const g=Math.max(0,spitN-1);damagePlayer(6+g,dir.clone().multiplyScalar(0.3));P.burn=3.4+Math.min(1.5,g*0.3);P.burnDps=5+Math.min(5,wave*0.25)+Math.min(4,g*0.8);
  floatText(P.pos.clone().addScaledVector(UP,1),'¡ÁCIDO!','loss');sfx('sizzle');}
function updateBurn(dt){if(!(P.burn>0)||state!=='play'){if($('burn').style.opacity!=='0')$('burn').style.opacity=0;return;}
  P.burn-=dt;P.hp=Math.max(0,P.hp-P.burnDps*dt);P.lastHit=playT;
  $('burn').style.opacity=(0.75+0.25*Math.sin(playT*14))*Math.min(1,P.burn);
  P.burnFx=(P.burnFx||0)-dt;if(P.burnFx<=0){P.burnFx=0.07;const p=P.pos.clone().add(V3.randomDirection().multiplyScalar(0.45));burst(p,Math.random()<0.5?0xff8a20:0xffc040,1);mistAcid(p);}
  P.burnSnd=(P.burnSnd||0)-dt;if(P.burnSnd<=0){P.burnSnd=0.5;sfx('sizzle');}
  if(P.hp<=0)endGame(false,'dead');}
function mistAcid(p){const q=MIST[mistI++%MIST.length];q.s.position.copy(p);q.vel.set(0,0,0);q.life=q.max=0.45;q.s0=0.25;q.a=0.5;q.s.visible=true;q.s.material.color.setRGB(1,0.55,0.25);q.acid=true;}
function updateBoss(){const s=spiders.find(o=>o.kind==='spitter')||INCS.find(e=>e.st!=='fall'&&e.st!=='dead'),el=$('boss');el.hidden=!s||state!=='play';if(s)el.lastChild.firstChild.style.width=Math.max(0,s.hp/s.maxHp*100)+'%';}
function makeSpiderOld(kind){
  const S=SKIN[kind];const g=new THREE.Group();const body=new THREE.Group();g.add(body);
  const mBody=new THREE.MeshStandardMaterial({color:S.body,metalness:0.45,roughness:0.38,flatShading:true,emissive:0x2a0000});
  const mLeg=new THREE.MeshStandardMaterial({color:S.leg,metalness:0.5,roughness:0.42,flatShading:true});
  const glowMark=kind==='thief'||kind==='lurker';
  const mMark=new THREE.MeshStandardMaterial({color:S.mark,metalness:0.6,roughness:0.3,flatShading:true,emissive:glowMark?S.mark:0x000000,emissiveIntensity:glowMark?0.7:0});
  const mEye=new THREE.MeshBasicMaterial({color:S.eye});
  body.add(new THREE.Mesh(SG.body,mBody),new THREE.Mesh(SG.abdomen,mBody),new THREE.Mesh(SG.mark,mMark),new THREE.Mesh(SG.eye,mEye));
  let sack=null;
  if(kind==='thief'){sack=new THREE.Mesh(SG.sack,new THREE.MeshStandardMaterial({color:0xffc24a,emissive:0xffa21c,emissiveIntensity:1.6,metalness:0.3,roughness:0.3,flatShading:true}));
    sack.position.set(0,0.66,-0.72);sack.scale.setScalar(0.001);body.add(sack);}
  const legs=[];
  for(let side=-1;side<=1;side+=2)for(let k=0;k<4;k++){
    const hip=new THREE.Group();hip.position.set(0.2*side,0.02,0.2-k*0.13);hip.rotation.y=side*(-0.9+k*0.55)+(side<0?Math.PI:0);
    const up=new THREE.Mesh(SG.femur,mLeg);up.rotation.x=-0.7;hip.add(up);
    const knee=new THREE.Group();knee.position.set(0,0,0.62);up.add(knee);
    const lo=new THREE.Mesh(SG.tibia,mLeg);lo.rotation.x=1.5;knee.add(lo);
    body.add(hip);legs.push({hip,up,lo,ph:k*1.3+(side>0?0.6:0)});}
  g.scale.setScalar(S.scale);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.userData={body,legs,mBody,mEye,sack,S};scene.add(g);return g;}
// endless rounds: everything ramps slowly and caps out so very late rounds stay fair
// three stages: rounds 1-3 learn · 4-7 it gets hard · 8+ it gets brutal (and keeps climbing)
function waveDef(i){const hard=Math.max(0,i-3),brutal=Math.max(0,i-7);
  // tougher every round (+1 hit about every 2 rounds), more spiders on the hull at once, quicker to pounce
  const late=Math.max(0,i-5);
  return {n:Math.round(6+i*1.6+brutal*0.8),cap:Math.min(20,5+i+Math.floor(late/2)),spd:Math.min(1.8,0.92+i*0.05+brutal*0.02),hp:2+Math.floor(i/3)+Math.floor(late/3)+Math.floor(brutal/3),
  cd:[Math.max(0.7,2.0-i*0.12-brutal*0.04),Math.max(1.3,3.3-i*0.16-brutal*0.05)],maxLeap:Math.min(6,2+Math.floor(i/3)+Math.floor(brutal/3)),bite:Math.min(22,8+i*0.9+brutal*0.6),
  every:Math.max(0.4,1.1-i*0.065-brutal*0.02),range:Math.min(30,16+i),eat:1.5+i*0.22+hard*0.05};}
// round 1 = only hunters (learn to shoot); from round 2 the eaters arrive
function waveKinds(i){return isIncRound(i)?['flanker','flanker','flanker','hunter']:i===0?['hunter']:i===1?['hunter','hunter','lurker']:i<5?['hunter','hunter','flanker','lurker','lurker']:['hunter','hunter','flanker','flanker','lurker','lurker'];}
const EAT={hunter:0.6,flanker:0.9,lurker:1.3,thief:0,spitter:1.5,brood:0};
function spawnSpider(kind){
  const W=waveDef(wave),K=waveKinds(wave);kind=kind||K[Math.floor(Math.random()*K.length)];
  const nests=ZONES.filter(Z=>Z.nest);let z,th,fromSpace=true;
  if(nests.length&&Math.random()<0.6){const Z=nests[Math.floor(Math.random()*nests.length)],pa=Z.patches[Math.floor(Math.random()*4)];z=pa.z;th=pa.th;fromSpace=false;}
  else{let tries=0;do{z=THREE.MathUtils.randFloat(-13,20);th=Math.random()*Math.PI*2;tries++;}while(tries<40&&(hullBlocked(z,th,1)||hullPoint(z,th,V1).distanceTo(P.pos)<12));}
  const s={mesh:makeSpider(kind),hp:Math.max(1,W.hp+SKIN[kind].hp),state:fromSpace?'return':'crawl',z,th,pos:new THREE.Vector3(),vel:new THREE.Vector3(),t:0,
    cd:THREE.MathUtils.randFloat(0.8,2.2),flash:0,kind,loot:0,patch:null,eo:[THREE.MathUtils.randFloatSpread(0.7),THREE.MathUtils.randFloatSpread(0.25)],chewT:0,
    spd:THREE.MathUtils.randFloat(0.8,1.25)*(kind==='flanker'?1.3:kind==='lurker'?0.8:kind==='brood'?1.75:1),
    slotZ:THREE.MathUtils.randFloatSpread(kind==='hunter'?4:9),slotTh:THREE.MathUtils.randFloatSpread(kind==='hunter'?1.2:2.6),
    orbit:(Math.random()<0.5?-1:1)*THREE.MathUtils.randFloat(0.15,0.5),aggr:kind==='lurker'?0.7:kind==='flanker'?0.9:1.2,wz:z,wth:th,wt:0};
  const n=new THREE.Vector3();hullPoint(z,th,s.pos,n);
  if(fromSpace)s.pos.addScaledVector(n,12+Math.random()*6); // they land on the hull from space
  s.mesh.position.copy(s.pos);spiders.push(s);return s;}
const gibs=[];
const ringTex=glowTex('rgba(255,120,80,1)','rgba(255,40,20,.5)');
function spawnGibs(s){const U=s.mesh.userData;const sc=s.mesh.scale.x;
  const parts=U.legs.slice(0,6).map(L=>[SG.tibia,L.lo.material,1]).concat([[SG.abdomen,U.mBody,0.6],[SG.body,U.mBody,0.7]]);
  for(const [g,mt,k] of parts){const m=new THREE.Mesh(g,mt);m.position.copy(s.mesh.position);m.quaternion.copy(s.mesh.quaternion);m.scale.setScalar(sc*k);scene.add(m);
    gibs.push({m,vel:new THREE.Vector3().randomDirection().multiplyScalar(3+Math.random()*5),spin:new THREE.Vector3().randomDirection().multiplyScalar(9),life:1.1+Math.random()*0.5,s0:sc*k});}
  const ring=new THREE.Sprite(new THREE.SpriteMaterial({map:ringTex,color:new THREE.Color(3,1.2,0.6),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  ring.position.copy(s.mesh.position);ring.scale.setScalar(0.4);scene.add(ring);gibs.push({m:ring,ring:true,life:0.28});}
function crossKill(){const c=$('cross');c.classList.add('kill');clearTimeout(crossKill.t);crossKill.t=setTimeout(()=>c.classList.remove('kill'),160);}
function killSpider(s,crit=false,quiet=false){s.silk=null;burst(s.pos,0xff3020,22);deathFlash(s.pos);spawnGibs(s);hitStop=quiet?0:0.055;
  if(crit){const hp=headPos(s,HEADL);burst(hp,0xffffff,12);}
  if(!quiet){const v=crit?PTS.head:PTS.kill;addPts(v);floatText(s.pos.clone().addScaledVector(UP,0.6),(crit?'HEADSHOT +':'+')+ptsVal(v),crit?'crit':'pts');}
  if(s.loot>0){const n=spawnLoose(s.pos,s.loot,4);lostN+=s.loot-n;s.loot=0;}
  scene.remove(s.mesh);spiders.splice(spiders.indexOf(s),1);stats.kills++;sfx('kill',s.pos);
  shake(Math.max(0.06,0.3-s.pos.distanceTo(P.pos)*0.012));crossKill();tutorialEvent('kill');
  if(!quiet)onKill(s,crit);
  if(s.kind==='spitter'){stats.spitters++;addPts(500);comboBanner('¡ESCUPIDORA ABATIDA!','+'+ptsVal(500));say('sp_dead',3);shake(0.45);
    for(let i=0;i<3;i++)burst(s.pos,0xff7a30,20);spawnDrop(s.pos.clone(),pickPU());}}
const HEADL=new THREE.Vector3();
