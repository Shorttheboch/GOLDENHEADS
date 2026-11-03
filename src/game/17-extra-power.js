/* ================= EXTRA POWER (v49) =================
   From round 4: 5 kills in a row (a headshot kill counts 1.5); taking damage takes 2 off the streak. From round 6 it also drops as a prize.
   swap the pistol for Santi's heavy gun for 20 s of combat: blue plasma bolts, 3 damage (x2 head), 7.7 shots/s, no heat,
   and a bolt that kills keeps going into the next spider. The clock stops in cinematics and between rounds.
   v77: power-up pose. The gun arm goes out to the side (upper arm out, elbow at 90 degrees, forearm and gun straight up) for ~1 s and a beam of
   light comes down onto the gun. A scan front runs down the gun from the muzzle to the grip: above it the plasma gun materialises, below it the old
   pistol dissolves into sparks (each gun is clipped by a world plane: XP.cpNew / XP.cpOld). Then a ring, a flash, and the arm goes back to the aim.
   During the pose the world runs at 0.4x for ~0.5 s (xpClock -> dt in the loop), the camera pushes in, the astronaut can move but cannot shoot and cannot be hurt,
   and the 20 s of plasma start when the pose is over. The title (big gold EXTRA POWER) only shows the first time on this device (or always with ?xp). */
const XP={on:false,t:0,dur:20,streak:0,need:5,fromWave:3,dmg:3,rate:0.13,speed:85,pierce:1,name:'EXTRA POWER',
  g1:null,g2:null,sw:0,swDir:0,mz1:new THREE.Vector3(0,0.0887,0.345),mz2:new THREE.Vector3(0,0.122,0.455),pulse:0,
  // v77 pose: pp = seconds into the pose (-1 = no pose), k = how far the arm is out (0..1), ts = world time scale, push/fovD = camera push-in (m / degrees), glow = emissive ramp of the new gun
  pp:-1,pT:1.0,k:0,ts:1,push:0,fovD:0,glow:0,hp0:0,ev:0,seen:false,fx:null,ext:null,ax:new THREE.Vector3(0,1,0),
  cpOld:new THREE.Plane(new THREE.Vector3(0,1,0),1e6),cpNew:new THREE.Plane(new THREE.Vector3(0,1,0),1e6)}; // planes far away = nothing clipped
renderer.localClippingEnabled=true; // (only materials that carry clippingPlanes pay for it: the two guns)
const xpLight=new THREE.PointLight(0x5fd0ff,0,6,2);scene.add(xpLight);
const xpCoreGeo=new THREE.CapsuleGeometry(0.065,1.5,3,8).rotateX(Math.PI/2),xpGlowGeo=new THREE.CapsuleGeometry(0.21,1.8,3,10).rotateX(Math.PI/2);
const xpCoreMat=new THREE.MeshBasicMaterial({color:new THREE.Color(0.75,2.1,3.6)});   // HDR: the bloom turns it into a lit blue bolt
const xpGlowMat=new THREE.MeshBasicMaterial({color:new THREE.Color(0.08,0.42,1.25),transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false});
function xpBolt(){const g=new THREE.Group();g.add(new THREE.Mesh(xpCoreGeo,xpCoreMat));const h=new THREE.Mesh(xpGlowGeo,xpGlowMat);h.renderOrder=4;g.add(h);return g;}
function xpPips(broke){const el=$('xpS');if(!el)return;const s=XP.streak;
  el.classList.toggle('show',!XP.on&&s>=2&&state==='play');
  if(broke){el.classList.remove('brk');void el.offsetWidth;el.classList.add('brk');clearTimeout(XP.brkT);XP.brkT=setTimeout(()=>el.classList.remove('brk'),650);}
  [...el.querySelectorAll('i')].forEach((p,i)=>p.style.setProperty('--f',Math.max(0,Math.min(1,s-i)).toFixed(2)));}
function xpKill(crit,w=1){if(XP.on||wave<XP.fromWave||state!=='play')return;XP.streak+=crit?1.5:w;xpPips();if(XP.streak>=XP.need-1e-6)xpStart();}
function xpBreak(){if(XP.streak>0){XP.streak=Math.max(0,XP.streak-2);xpPips(true);}}
function xpGunPos(){pistol.updateMatrixWorld(true);return muzzle.getWorldPosition(new THREE.Vector3());}

// ---------------- v77: the power-up pose ----------------
const XP_ALPHA=0.1; // the upper arm is raised a little above horizontal; the forearm stays at 90 degrees to it (tilted a touch toward the head)
const XPT={beam0:0.08,beam1:0.26,scan0:0.28,scan1:0.60,down0:0.68,fade1:0.88}; // seconds into the pose (it lasts XP.pT = 1.0 s)
const xpSS=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x);};
const XPG={R:new THREE.Vector3(),u1:new THREE.Vector3(),f:new THREE.Vector3(),E:new THREE.Vector3(),H:new THREE.Vector3()};
const _xpP=new THREE.Vector3(),_xpS=new THREE.Vector3(),_xpM=new THREE.Matrix4(),_xpH=new THREE.Vector3();
// where the elbow and the hand have to be (from the right shoulder SR): out to the right of the way you look, elbow at 90 degrees, forearm up. Used by poseArms (12-player.js)
function xpPoseGeom(SR){const g=XPG,a=XP_ALPHA;g.R.set(Math.cos(P.yaw),0,-Math.sin(P.yaw));
  g.u1.copy(g.R).multiplyScalar(Math.cos(a)).addScaledVector(UP,Math.sin(a));
  g.f.copy(g.R).multiplyScalar(-Math.sin(a)).addScaledVector(UP,Math.cos(a));
  g.E.copy(SR).addScaledVector(g.u1,P.len.RightArm);g.H.copy(g.E).addScaledVector(g.f,P.len.RightForeArm);XP.ax.copy(g.f);return g;}
// the pistol points where the aim says, except while the arm is out: then it follows the forearm (straight up)
function xpAimDir(z){return XP.k>0?z.lerp(XP.ax,XP.k).normalize():z;}
// z range of a gun in the pistol's own space (the barrel axis; world up during the pose)
function xpExtent(g){pistol.updateMatrixWorld(true);_xpM.copy(pistol.matrixWorld).invert();const bb=new THREE.Box3(),b=new THREE.Box3();
  g.updateWorldMatrix(true,true);g.traverse(o=>{if(o.isMesh&&o.geometry){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(_xpM);bb.union(b);}});
  return [bb.min.z,bb.max.z];}
// both guns carry one world clipping plane each (set when they load, so the shader is built in the menu and not in the middle of a fight)
function xpClipInit(g,plane){g.traverse(o=>{if(o.isMesh&&o.material){const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){m.clippingPlanes=[plane];m.needsUpdate=true;}}});}
function xpClipOff(){XP.cpOld.normal.set(0,1,0);XP.cpOld.constant=1e6;XP.cpNew.normal.set(0,1,0);XP.cpNew.constant=1e6;}
// the effects: beam (three nested light shells), scan ring + disc, two shock rings, a flash
function xpFxBuild(){
  const grp=new THREE.Group();grp.visible=false;grp.frustumCulled=false;scene.add(grp);
  const shell=(r,col,p)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,28,1,true).translate(0,0.5,0),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      uniforms:{uGrow:{value:0},uK:{value:0},uT:{value:0},uCol:{value:col},uP:{value:p},uH:{value:6},uG:{value:0}}, // uG = where the top of the gun is on the beam (0..1)
      vertexShader:`uniform float uG;varying float vY;varying vec3 vN,vV;void main(){vY=position.y;float tp=mix(0.4,1.,smoothstep(uG,uG+0.3,position.y)); /* the beam narrows as it reaches the gun */
        vec4 mv=modelViewMatrix*vec4(position.x*tp,position.y,position.z*tp,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uGrow,uK,uT,uP,uH,uG;uniform vec3 uCol;varying float vY;varying vec3 vN,vV;
        void main(){float d=vY-(1.-uGrow);if(d<0.)discard;                                  /* the beam grows downward from the top: a bright head leads it */
          float lead=exp(-d*40.)*1.4,e=pow(abs(dot(normalize(vN),normalize(vV))),uP);        /* bright in the middle, soft at the edge */
          float band=0.8+0.2*sin(vY*uH*7.-uT*34.);                                           /* bands running down */
          float a=(1.+lead)*e*band*smoothstep(0.,0.03,vY)*(1.-smoothstep(0.45,1.,vY))*uK;
          a*=mix(0.28,1.,smoothstep(uG,uG+0.25,vY));                                         /* thin and dim over the gun itself, so the gun can be seen in it */
          gl_FragColor=vec4(uCol*a,1.);}`}));
    m.scale.set(r,6,r);m.frustumCulled=false;m.renderOrder=6;return m;};
  const beam=new THREE.Group();beam.add(shell(0.03,new THREE.Color(1.8,3.2,4.4),0.7),shell(0.13,new THREE.Color(0.18,0.62,1.7),1.5),shell(0.3,new THREE.Color(0.6,0.36,0.08),2.6));grp.add(beam);
  const add=(geo,col,op)=>{const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));m.frustumCulled=false;m.renderOrder=6;grp.add(m);return m;};
  const scan=add(new THREE.RingGeometry(0.8,1,48).rotateX(-Math.PI/2),new THREE.Color(1.8,3.6,5.2),1);
  const disc=add(new THREE.CircleGeometry(1,40).rotateX(-Math.PI/2),new THREE.Color(0.1,0.42,1.0),0.4);
  const ringB=add(new THREE.RingGeometry(0.86,1,64).rotateX(-Math.PI/2),new THREE.Color(1.1,2.5,4.2),1);
  const ringG=add(new THREE.RingGeometry(0.9,1,64).rotateX(-Math.PI/2),new THREE.Color(3.0,1.9,0.5),1);
  const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,255,255,1)','rgba(110,200,255,.55)'),color:new THREE.Color(2.2,3.4,5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  flash.visible=true;flash.scale.setScalar(0.001);flash.renderOrder=7;grp.add(flash);
  XP.fx={grp,beam,scan,disc,ringB,ringG,flash,sparkGold:new THREE.MeshBasicMaterial({color:new THREE.Color(3,1.9,0.6)}),sparkBlue:new THREE.MeshBasicMaterial({color:new THREE.Color(0.8,2.3,4.2)}),warm:false};
  for(const o of [beam,scan,disc,ringB,ringG,flash])o.visible=false;
  return XP.fx;}
// the frame is drawn into the composer's target (linear, no tone mapping), so the shaders have to be built with that target set: the canvas variants would be useless
function xpWarm(){const F=XP.fx||xpFxBuild();try{renderer.setRenderTarget(composer.renderTarget1);renderer.compile(F.grp,camera,scene);renderer.compile(XP.g2,camera,scene);}catch(e){}renderer.setRenderTarget(null);}
function xpSpark(p,mat,n,sp){for(let i=0;i<n;i++){const m=new THREE.Mesh(sparkGeo,mat);m.position.copy(p);scene.add(m); // (the spark shrinks with its life: a short life is a small spark, the camera is close)
  sparks.push({m,vel:new THREE.Vector3().randomDirection().multiplyScalar(sp*(0.3+Math.random())).add(_xpH.set(0,sp*0.25,0)),life:0.2+Math.random()*0.3});}}
function xpFxOff(){const F=XP.fx;if(!F)return;F.grp.visible=false;for(const o of [F.beam,F.scan,F.disc,F.ringB,F.ringG,F.flash])o.visible=false;xpClipOff();XP.glow=0;}
// real-time clock of the pose; called first thing every frame (31-loop.js). Returns the time scale of the world (1 = normal)
function xpClock(rdt){
  if(XP.pp<0)return 1;
  if(!XP.on||state!=='play'||CINE.on){xpPoseEnd();return 1;} // died, restarted or a cinematic took over: the pose just ends (the plasma gun is simply there)
  XP.pp+=rdt;const u=XP.pp;
  if(u>=XP.pT){xpPoseEnd();return 1;}
  const up=1-Math.pow(1-Math.min(1,u/0.26),3);                       // the arm comes out fast and settles
  XP.k=up*(1-xpSS(XPT.down0,XP.pT,u));                              // ... and goes back to the aim
  XP.ts=1-0.6*(xpSS(0.05,0.17,u)-xpSS(0.56,0.76,u));                // 0.4x for ~0.4 s, eased in and out
  const pu=xpSS(0,0.3,u)*(1-xpSS(0.72,1,u));XP.push=0.5*pu;XP.fovD=3*pu; // camera push-in
  P.inv=Math.max(P.inv,0.3);XP.hp0=Math.max(XP.hp0,P.hp);P.hp=Math.max(P.hp,XP.hp0); // cannot be hurt (damagePlayer checks P.inv; the fire and acid damage over time are floored)
  P.fireT=Math.max(P.fireT,0.1);                                    // cannot shoot
  return XP.ts;}
function xpPoseEnd(){XP.pp=-1;XP.k=0;XP.ts=1;XP.push=0;XP.fovD=0;xpFxOff();}
function xpPoseFx(dt,t){
  const u=XP.pp,F=XP.fx||xpFxBuild();
  if(!XP.ext)XP.ext=[xpExtent(XP.g1),xpExtent(XP.g2)];
  pistol.updateMatrixWorld(true);const gp=pistol.getWorldPosition(_xpP);
  const R=XPG.R.set(Math.cos(P.yaw),0,-Math.sin(P.yaw));
  const zHi=Math.max(XP.ext[0][1],XP.ext[1][1]),zLo=Math.min(XP.ext[0][0],XP.ext[1][0]);
  const yTop=gp.y+zHi*AS+0.04,yBot=gp.y+zLo*AS-0.04;
  const cx=gp.x+R.x*0.05,cz=gp.z+R.z*0.05,yMid=gp.y+(zHi+zLo)*0.5*AS;
  // scan front: above it the new gun, below it the old one
  const s=xpSS(XPT.scan0,XPT.scan1,u),yF=yTop+(yBot-yTop)*s,scanning=u>=XPT.scan0&&u<XPT.scan1+0.04;
  if(u>=XPT.scan0-0.02){XP.cpNew.normal.set(0,1,0);XP.cpNew.constant=-yF;XP.cpOld.normal.set(0,-1,0);XP.cpOld.constant=yF;}
  F.grp.visible=true;
  // beam
  const grow=xpSS(XPT.beam0,XPT.beam1,u);let K=u<XPT.fade1?1-xpSS(0.6,XPT.fade1,u):0;
  if(u>=XPT.scan1)K+=0.7*Math.exp(-(u-XPT.scan1)*14);
  K*=0.9+0.1*Math.sin(t*61);
  const on=grow>0&&K>0.01;F.beam.visible=on;
  if(on){F.beam.position.set(cx,yBot-0.05,cz);const g=(yTop-(yBot-0.05))/6;for(const m of F.beam.children){const U=m.material.uniforms;U.uGrow.value=grow;U.uK.value=K;U.uT.value=t;U.uG.value=g;}}
  // scan ring + disc at the front
  F.scan.visible=F.disc.visible=scanning;
  if(scanning){const fk=xpSS(XPT.scan0,XPT.scan0+0.04,u)*(1-xpSS(XPT.scan1,XPT.scan1+0.04,u));
    F.scan.position.set(cx,yF,cz);F.disc.position.set(cx,yF,cz);F.scan.scale.setScalar(0.34);F.disc.scale.setScalar(0.3);F.scan.material.opacity=fk;F.disc.material.opacity=0.45*fk;
    for(let i=0;i<(isTouch?1:2);i++){_xpS.set(cx+(Math.random()-0.5)*0.3,yF,cz+(Math.random()-0.5)*0.3).addScaledVector(R,(Math.random()-0.3)*0.2);
      xpSpark(_xpS,Math.random()<0.5?F.sparkGold:F.sparkBlue,1,2.2);}}
  // one-shot events
  if(!(XP.ev&1)&&u>=XPT.beam1){XP.ev|=1;shake(0.05);XP.pulse=Math.max(XP.pulse,1.0);}
  if(!(XP.ev&2)&&u>=XPT.scan0){XP.ev|=2;sfx('combo');_xpS.set(cx,yTop,cz);xpSpark(_xpS,F.sparkBlue,6,3.5);}
  if(!(XP.ev&4)&&u>=XPT.scan1){XP.ev|=4;shake(0.09);XP.pulse=1.6;_xpS.set(cx,yMid,cz);xpSpark(_xpS,F.sparkBlue,12,4.5);xpSpark(_xpS,F.sparkGold,8,4);
    const f=$('xpFlash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}
  // shock rings (blue, then gold a beat later), flash
  const v=(u-XPT.scan1)/0.45;
  for(const [r,d,mx] of [[F.ringB,0,1.0],[F.ringG,0.06,0.78]]){const w=(v-d)/(1-d);r.visible=w>0&&w<1;
    if(r.visible){r.position.set(cx,yMid,cz);r.scale.setScalar(0.25+mx*(1-Math.pow(1-w,3)));r.material.opacity=0.8*Math.pow(1-w,1.6);}}
  const fv=(u-XPT.scan1)/0.3;F.flash.visible=fv>0&&fv<1;if(F.flash.visible){F.flash.position.set(cx,yMid,cz);F.flash.scale.setScalar(1.6*Math.sin(Math.PI*Math.sqrt(fv)));}
  XP.glow=xpSS(XPT.scan0,XPT.scan1,u)*(1-xpSS(0.62,1,u));
  XP.pulse=Math.max(XP.pulse,K*0.7);}
// the title of the first EXTRA POWER on this device (or every one with ?xp in the address)
const XP_FORCE=/[?&]xp(?:[=&#]|$)/.test(location.search);
function xpFirst(){if(XP_FORCE)return true;if(XP.seen)return false;try{return !localStorage.getItem('heads_xp_seen');}catch(e){return true;}}
function xpTitle(){const el=$('xpT');if(!el)return;
  if(!el._xp){el._xp=1;el.addEventListener('animationend',()=>el.classList.remove('go'));}
  el.querySelector('.xpTl').innerHTML=g3(TR(XP.name));el.querySelector('.xpTs').textContent=TR('Plasma '+XP.dur+' s · atraviesa arañas');
  el.classList.remove('go');void el.offsetWidth;el.classList.add('go');}
function xpStart(){if(!XP.g2)return;
  if(XP.on){if(XP.pp>=0)return;XP.t=XP.dur;XP.streak=0;xpPips();XP.pulse=1.2;sfx('power');say('xp_on',3);return;} // already out: a second one only refills the 20 s
  XP.on=true;XP.t=XP.dur;XP.streak=0;xpPips();XP.sw=0;stats.xp++; // (v81 metrics: EXTRA POWER activations, refills not counted)
  P.ammo=CFG.gunCap;P.gunLock=0;P.reloading=false;
  XP.pp=0;XP.ev=0;XP.hp0=P.hp;XP.pulse=0.6;
  const first=xpFirst();$('xpT')&&$('xpT').classList.remove('go');
  if(first){xpTitle();XP.seen=true;if(!XP_FORCE)try{localStorage.setItem('heads_xp_seen','1');}catch(e){}}
  sfx('power');say('xp_on',3);}
function xpEnd(quiet){if(!XP.on)return;XP.on=false;XP.t=0;P.ammo=CFG.gunCap;P.gunLock=0;
  if(quiet){XP.sw=0;if(XP.g2)XP.g2.visible=false;if(XP.g1){XP.g1.visible=true;XP.g1.scale.setScalar(1);}return;}
  XP.sw=0.42;XP.swDir=-1;const p=xpGunPos();burst(p,0x6fe0ff,16);burst(p,0xb8f2ff,8);sfx('tss');showMsg('','EXTRA POWER agotado',1.4);say('xp_end',2,{cd:30});}
function xpUpdate(dt,t){
  if(XP.g1&&!XP.c1){XP.c1=1;xpClipInit(XP.g1,XP.cpOld);}
  if(XP.g2&&!XP.c2){XP.c2=1;xpClipInit(XP.g2,XP.cpNew);}
  if(XP.g2&&XP.c2===1){XP.c2=2;xpWarm();} // build the shaders now, not in the middle of the pose
  if(XP.on&&XP.pp<0&&state==='play'&&!CINE.on&&!inBreak){XP.t-=dt;if(XP.t<=0)xpEnd();}  // the 20 s only run once the pose is over
  if(XP.pp>=0)xpPoseFx(dt,t);
  // the old gun shrinks into a flash and the new one pops out when it runs out (xpEnd); the way in is the pose
  if(XP.g1&&XP.g2){
    if(XP.pp>=0){XP.g1.visible=XP.pp<XPT.scan1+0.02;XP.g2.visible=XP.pp>=XPT.scan0-0.02;XP.g1.scale.setScalar(1);XP.g2.scale.setScalar(1);}
    else if(XP.sw>0){XP.sw=Math.max(0,XP.sw-dt);const k=1-XP.sw/0.42,inG=XP.swDir>0?XP.g2:XP.g1,outG=XP.swDir>0?XP.g1:XP.g2;
      if(k<0.35){outG.visible=true;outG.scale.setScalar(Math.max(0.05,1-k/0.35));inG.visible=false;}
      else{outG.visible=false;const u=(k-0.35)/0.65,c=1.70158;const e=1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2);inG.visible=true;inG.scale.setScalar(Math.max(0.05,e));}}
    else{XP.g1.visible=!XP.on;XP.g2.visible=XP.on;XP.g1.scale.setScalar(1);XP.g2.scale.setScalar(1);}
    muzzle.position.copy(XP.on?XP.mz2:XP.mz1);}
  // blue glow follows the time left; it flickers in the last 3 s
  XP.pulse=Math.max(0,XP.pulse-dt*5);
  if(P.gun2Mats){const k=XP.on?XP.t/XP.dur:0.3;for(const [m,e0] of P.gun2Mats)m.emissiveIntensity=e0*(0.35+0.65*k+XP.pulse*0.6+XP.glow*2.2)*(XP.on&&XP.t<3?0.55+0.45*Math.sin(t*22):1);}
  if(XP.on||XP.pulse>0){xpLight.position.copy(xpGunPos());xpLight.intensity=XP.pulse*9+(XP.on?0.6:0);}else xpLight.intensity=0;}
window.__xp={XP,xpStart,xpEnd,xpKill,xpBreak,shoot:()=>fire(aimTarget),shootAt:v=>fire(v),get DROPS(){return DROPS},get dropsRound(){return dropsRound},spawnDrop:(p,k)=>spawnDrop(p,k)};

