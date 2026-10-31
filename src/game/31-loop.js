/* ================= LOOP ================= */
let camYaw=0,camPitch=0,camOrbit=0,showcaseT=0,lookInput=0;
const angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const clock=new THREE.Clock();const camPos=new THREE.Vector3(10,3,14);const aimTarget=new THREE.Vector3();const _sf=new THREE.Vector3(); // _sf: how the vacuumed stream follows the astronaut (v65)
const ray=new THREE.Ray();
// ---- v55: automatic quality ----
// Measures the real frame time while playing, in 1 s windows (median, so a one-off hitch such as a shader compiling does not count). Slower than ~48 fps twice in a row -> one level down (two at once below 25 fps),
// unless the game logic itself is what takes the time (then a lower resolution would not help). Steady at the screen's refresh rate for 5 s ->
// try one level up; if that level stutters again within the next 4 s it goes back and is not retried for 90 s.
QA.gpu=(()=>{try{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)):'';}catch(_){return '';}})();
function qaSet(l){l=Math.max(0,Math.min(QA.budget.length-1,l));if(l===QA.lvl)return;QA.lvl=l;
  const s=QA.samples[l];if(composer.renderTarget1.samples!==s){const rt=composer.renderTarget1.clone();rt.samples=s;composer.reset(rt);}
  const m=QA.shadow[l];if(sun.shadow.mapSize.x!==m){sun.shadow.mapSize.set(m,m);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  resize();QA.cool=2;QA.bad=QA.good=0;qaHud();}
function qaDecide(ft,jt){ // ft: average frame time of the last window (ms); jt: game-logic time per frame (ms)
  const now=performance.now();
  if(QA.cool>0){QA.cool--;return;}
  if(QA.probeAt>=0&&++QA.probeW>4)QA.probeAt=-1; // the level we climbed to held up: keep it
  if(ft>21&&jt<ft*0.7){QA.good=0;if(++QA.bad>=(ft>40?1:2)){if(QA.probeAt>=0){QA.block=QA.probeAt;QA.blockT=now;QA.probeAt=-1;}qaSet(QA.lvl+(ft>40?2:1));}return;}
  QA.bad=0;
  if(ft<17.6&&QA.lvl>0){if(++QA.good>=5){const up=QA.lvl-1;if(QA.block===up&&now-QA.blockT<90000)QA.good=0;else{QA.probeAt=up;QA.probeW=0;qaSet(up);}}}else QA.good=0;}
function qaMed(a){a.sort((x,y)=>x-y);return a[a.length>>1];}
function qaFrame(t0){const now=performance.now(),fd=now-QA.last,js=now-t0;QA.last=now;
  if(!QA.on||window.__manual||fd>3000||document.hidden||state!=='play'||CINE.on)return; // only real play time counts (a gap over 3 s = the page was suspended)
  QA.wT+=fd;QA.wF.push(fd);QA.wJ.push(js);if(QA.wT<1000)return;
  const ft=qaMed(QA.wF),jt=qaMed(QA.wJ);QA.wT=0;QA.wF=[];QA.wJ=[];QA.fps=1000/ft;qaDecide(ft,jt);qaHud();}
// add ?fps to the address to see frame rate, level, rendered megapixels and GPU; ?q=0..5 fixes the level (no automatic changes)
const QA_HUD=/[?&]fps\b/.test(location.search)?(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;left:50%;bottom:4px;transform:translateX(-50%);z-index:60;font:600 12px/1.2 monospace;color:#ffd27a;background:rgba(0,0,0,.6);padding:4px 8px;border-radius:4px;pointer-events:none;white-space:nowrap';document.body.appendChild(d);return d;})():null;
function qaHud(){if(!QA_HUD)return;const pr=renderer.getPixelRatio();QA_HUD.textContent=Math.round(QA.fps)+' fps · Q'+QA.lvl+' · '+(innerWidth*innerHeight*pr*pr/1e6).toFixed(1)+' MP · '+QA.gpu.replace(/^ANGLE \(/,'').replace(/^[^,(]*, /,'').replace(/ (Direct3D|vs_|OpenGL).*$/,'').slice(0,48);}
{const qf=/[?&]q=([0-5])\b/.exec(location.search);
 if(qf){QA.on=false;qaSet(+qf[1]);}
 // start lower on GPUs that cannot carry the full look (it climbs back if there is headroom): software rendering -> 4, integrated Intel/AMD -> 2
 else if(QA.on&&!isTouch){if(/swiftshader|basic render|llvmpipe|softpipe/i.test(QA.gpu))qaSet(4);else if(/intel|radeon\(tm\)|radeon graphics|vega/i.test(QA.gpu)&&!/\barc\b/i.test(QA.gpu))qaSet(2);}}
qaHud();
function tick(){const _qa0=performance.now();
  if((TC.paused||MTUT.on)&&state==='play'){clock.getDelta();tcOrientTick();if(MTUT.on)mtutFrame();if(!window.__noRender)composer.render();if(!window.__manual)requestAnimationFrame(tick);return;} // touch pause · v66 phone tutorial
  const rdt=Math.min(clock.getDelta(),0.05),t=clock.elapsedTime;let dt=rdt;if(hitStop>0){hitStop-=rdt;dt=rdt*0.12;} // tiny freeze on kills
  FLOW.dz=(state==='play'||state==='menu')?CFG.worldV*dt:0;
  for(const [o,sp] of ROTORS)o.rotation.z+=sp*dt;
  for(const s of shards){s.rotation.x+=s.userData.spin.x*dt;s.rotation.y+=s.userData.spin.y*dt;}
  hatchRing.rotation.z+=dt*0.8;
  if(P.model&&(state==='play'||state==='menu')){
    // look
    if(!isTouch&&!locked&&state==='play'){const k=1.8*dt;if(keys.ArrowLeft)P.yaw+=k;if(keys.ArrowRight)P.yaw-=k;if(keys.ArrowUp)P.pitch+=k;if(keys.ArrowDown)P.pitch-=k;}
    P.pitch=THREE.MathUtils.clamp(P.pitch,-1.2,1.2);
    const cp=Math.cos(P.pitch),f3=new THREE.Vector3(-Math.sin(P.yaw)*cp,Math.sin(P.pitch),-Math.cos(P.yaw)*cp);
    const right=new THREE.Vector3(Math.cos(P.yaw),0,-Math.sin(P.yaw));
    if(state==='play'&&!CINE.on){
      // move
      let fx=(keys.KeyD?1:0)-(keys.KeyA?1:0),fz=(keys.KeyW?1:0)-(keys.KeyS?1:0),fy=(keys.Space?1:0)-(keys.KeyC||keys.ControlLeft?1:0);
      if(isTouch){fx+=st.x;fz+=-st.y;}
      const fwd=isTouch&&inp.fire?_tcF.set(-Math.sin(P.yaw),0,-Math.cos(P.yaw)):f3; // touch only: while shooting the stick stays level
      const acc=new THREE.Vector3().addScaledVector(fwd,fz).addScaledVector(right,fx).addScaledVector(UP,fy);if(isTouch)tcAutopilot(acc);P.thrust=acc;
      if(acc.lengthSq()>1)acc.normalize();const boost=keys.ShiftLeft||keys.ShiftRight||TC.boost?CFG.boost:1;
      P.dashCD=Math.max(0,P.dashCD-dt);
      if(dashReq){dashReq=false;if(P.dashCD<=0){const dir=acc.lengthSq()>0.01?acc.clone().normalize():f3.clone();
        P.vel.copy(dir).multiplyScalar(CFG.dashSpeed);P.inv=Math.max(P.inv,0.3);P.dashCD=CFG.dashCD;P.suckJolt=1; /* v65: the jolt shakes loose part of the vacuumed stream */
        for(const o of jetOrigins(dir))for(let k=0;k<6;k++)puff(o,dir.clone().multiplyScalar(-(9+Math.random()*5)).add(new THREE.Vector3().randomDirection().multiplyScalar(1.2)),0.06,0.5,0.35,0.7);AN.jetDir=dir.clone();AN.jetT=0.4;
        AN.pitchV+=dir.dot(f3)*5;AN.rollV+=dir.dot(right)*6;sfx('dash');shake(0.06);fovK=6;}}
      P.vel.addScaledVector(acc,CFG.thrust*boost*dt);P.vel.multiplyScalar(Math.exp(-CFG.damping*dt));
      const ms=CFG.maxSpeed*boost*(TC.wSlow?0.55:1),vl=P.vel.length();if(vl>ms)P.vel.setLength(Math.max(ms,vl*Math.exp(-3*dt))); // a dash bleeds off smoothly · v58 phones: 55 % top speed while welding, so passing by gives the weld time
      if(playT-P.lastHit>CFG.regenDelay&&P.hp<CFG.hpMax)P.hp=Math.min(CFG.hpMax,P.hp+CFG.regenRate*dt);
      {const mv=V1.copy(P.vel).multiplyScalar(dt),lead=V2.copy(P.vel).normalize().multiplyScalar(0.45);
       if(P.vel.lengthSq()>1e-4&&(wingRay(V3.copy(P.pos).add(lead),mv)>=0||wingAt(V3.copy(P.pos).add(lead)))){P.vel.multiplyScalar(-0.25);}else P.pos.add(mv);}
      pushOutOfShip(P.pos,0.64,P.vel);pushOutOfRocks(P.pos,0.64,P.vel);
      if(P.pos.length()>90){P.pos.setLength(90);P.vel.multiplyScalar(-0.3);showMsg('DEMASIADO LEJOS','Vuelve a la nave',1.5);}
      P.inv=Math.max(0,P.inv-dt);
    }
    // camera
    // trails the aim slightly on fast turns; swings round to the front with Q / VER, after a cleared round and on the menu
    {const kl=1-Math.exp(-CFG.camLag*dt);camYaw+=(P.yaw-camYaw)*kl;camYaw=P.yaw+clamp(camYaw-P.yaw,-1.0,1.0);camPitch+=(P.pitch-camPitch)*kl;}
    if(performance.now()-lookInput<200||inp.fire)showcaseT=0;showcaseT=Math.max(0,showcaseT-dt);
    const viewHeld=state==='play'&&(keys.KeyQ||inp.view);
    const wantOrbit=state==='menu'?2.55+Math.sin(t*0.25)*0.35:(viewHeld||showcaseT>0)?2.6:0;
    camOrbit+=(wantOrbit-camOrbit)*(1-Math.exp(-4*dt));
    const w=THREE.MathUtils.clamp(camOrbit/2.6,0,1),cyaw=camYaw+camOrbit,cpit=camPitch*(1-w)+0.15*w,ccp=Math.cos(cpit);
    const fc=new THREE.Vector3(-Math.sin(cyaw)*ccp,Math.sin(cpit),-Math.cos(cyaw)*ccp);
    const rightC=new THREE.Vector3(Math.cos(camYaw),0,-Math.sin(camYaw));
    const pivot=P.pos.clone().addScaledVector(UP,0.5-0.2*w).addScaledVector(rightC,(isTouch?0.8:0.98)*(1-w));
    const want=pivot.clone().addScaledVector(fc,-((isTouch?2.55:3.3)-0.5*w)); // v56: closer on phones so the astronaut reads biggerpushOutOfShip(want,0.4,null);pushOutOfRocks(want,0.4,null);
    camPos.lerp(want,1-Math.exp(-12*dt));camera.position.copy(camPos);camera.lookAt(pivot.clone().addScaledVector(fc,20*(1-w)+0.01));
    if(CINE.on){if(CINE.mode==='boss')bossCam(dt);else{CINE.nPos.copy(camPos);CINE.nLook.copy(pivot).addScaledVector(fc,20);cineCam(dt);}}
    // lens feel: a short zoom kick on the dash, and a slow, tiny hand-held drift
    fovK=THREE.MathUtils.damp(fovK,0,5,dt);{const fv=CINE.on&&CINE.fov?CINE.fov:62+fovK; /* v67: a cinematic can set its own lens */if(Math.abs(camera.fov-fv)>0.01){camera.fov=fv;camera.updateProjectionMatrix();}}
    if(!window.__camOv){camera.rotateX(Math.sin(t*0.83)*0.0015+Math.sin(t*2.1)*0.0005);camera.rotateY(Math.sin(t*0.61+1.3)*0.0017+Math.sin(t*1.7)*0.0005);}
    $('cross').style.visibility=w>0.3?'hidden':'';camFill.intensity=0.6+1.3*w;
    if(window.__camOv){camera.position.copy(P.pos).add(window.__camOv);camera.lookAt(P.pos.clone().add(window.__camLook||new THREE.Vector3()));}
    // aim
    ray.origin.copy(camera.position);ray.direction.copy(f3);aimTarget.copy(camera.position).addScaledVector(f3,80);
    let best=1e9;_tcAimP=null;_tcAimHit=false;for(const s of spiders){const d=ray.distanceSqToPoint(s.mesh.position);if(d<(isTouch?1.25:0.8)*Math.max(1,s.mesh.scale.x*s.mesh.scale.x*0.6)){const dd=camera.position.distanceTo(s.mesh.position);if(dd<best){best=dd;_tcAimP=s.mesh.position;
      _tcAimHit=d<0.36;if(_tcAimHit)ray.closestPointToPoint(s.mesh.position,aimTarget);else aimTarget.copy(s.mesh.position);}}} // on target: precise · just off: gentle pull to the body
    for(const e of INCS){if(e.st==='fall'||e.st==='dead')continue;const c=incCenter(e,_j6),d=ray.distanceSqToPoint(c);if(d<(0.6*INC_SC)**2){const dd=camera.position.distanceTo(c);if(dd<best){best=dd;_tcAimP=_tcAimV.copy(c);_tcAimHit=true;ray.closestPointToPoint(c,aimTarget);}}}
    for(const e of EGGS){const d=ray.distanceSqToPoint(e.pos);if(d<0.5*0.5){const dd=camera.position.distanceTo(e.pos);if(dd<best){best=dd;_tcAimP=e.pos;_tcAimHit=true;aimTarget.copy(e.pos);}}} // eggs: aim converges on the egg under the crosshair
    TC.aim=isTouch&&best<1e9;
    // touch aim help (v56, stronger in v58): while you are aiming or shooting, the view is drawn onto the body under the crosshair (never the head)
    if(TC.aim&&_tcAimP&&state==='play'&&!CINE.on&&(inp.fire||performance.now()-lookInput<350)){_tcV.subVectors(_tcAimP,camera.position);
      const k=1-Math.exp(-3.6*dt);P.yaw+=angDiff(Math.atan2(-_tcV.x,-_tcV.z),P.yaw)*k;P.pitch+=(Math.atan2(_tcV.y,Math.hypot(_tcV.x,_tcV.z))-P.pitch)*k;}
    // model
    animateBody(dt,t);
    const tcDust=isTouch&&state==='play'&&!CINE.on?tcNearDust():null; // touch: the hose finds floating trichomes on its own
    const sucking=state==='play'&&!CINE.on&&(inp.suck||keys.KeyE||!!tcDust);
    const aimDir=aimTarget.clone().sub(childPos('RightArm')).normalize();
    const welding=R.on&&R.pa;
    poseArms(aimDir,sucking||welding,dt,welding?R.pa.pos.clone().sub(childPos('LeftArm')).normalize():tcDust&&P.carry<CFG.tankCap?tcDust.clone().sub(childPos('LeftArm')).normalize():null,t);
    // pistol in right hand
    
    {const gw=P.gripW||childPos('RightHand'),z=aimTarget.clone().sub(gw).normalize(),y=(P.gripHole||UP).clone();y.addScaledVector(z,-y.dot(z)).normalize();
     PM4.makeBasis(new THREE.Vector3().crossVectors(y,z),y,z);pistol.quaternion.setFromRotationMatrix(PM4);pistol.position.copy(gw).sub(PGRIP.clone().applyQuaternion(pistol.quaternion));}
    xpUpdate(dt,t);
    // recoil kick + muzzle flash
    pistol.translateZ(-0.07*(P.recoil||0));pistol.rotateX(-0.28*(P.recoil||0));P.recoil=Math.max(0,(P.recoil||0)-dt*9);
    if(muzzleT>0){muzzleT-=dt;muzzleFlash.visible=true;pistol.updateMatrixWorld(true);muzzle.getWorldPosition(muzzleFlash.position);muzzleFlash.material.rotation=Math.random()*6;}
    else muzzleFlash.visible=false;
    // fire
    P.fireT-=dt;P.gunIdle=(P.gunIdle||0)+dt;P.gunLock=Math.max(0,(P.gunLock||0)-dt);if(P.ammo===undefined)P.ammo=CFG.gunCap;
    if(state==='play'&&!CINE.on&&inp.fire&&P.fireT<=0&&P.gunLock<=0&&P.ammo>=1){P.fireT=XP.on?XP.rate:CFG.fireRate;fire(aimTarget);P.gunIdle=0;
      if(!(PU.over>0)&&!XP.on)P.ammo-=1; // overcharge prize: free shots
      if(P.ammo<1){P.gunLock=CFG.gunLock;sfx('overheat');tutorialEvent('reload');}}
    if(P.gunLock>0)P.ammo=Math.min(CFG.gunCap,P.ammo+CFG.gunCap/(P.reloading?CFG.reloadT:CFG.gunLock)*dt);
    else{P.reloading=false;if(P.gunIdle>CFG.gunDelay)P.ammo=Math.min(CFG.gunCap,P.ammo+CFG.gunRegen*dt);}
    {const k=XP.on?Math.max(0,XP.t/XP.dur):P.ammo/CFG.gunCap,el=$('ammo');el.classList.toggle('xp',XP.on);el.classList.toggle('xpend',XP.on&&XP.t<3);if(el.lastChild.textContent!==(XP.on?XP.name:'RECARGANDO'))el.lastChild.textContent=XP.on?XP.name:'RECARGANDO';el.classList.toggle('show',state==='play'&&!CINE.on&&(XP.on||k<0.995||P.gunLock>0));el.classList.toggle('low',!XP.on&&(k<0.3||P.gunLock>0));el.classList.toggle('lock',P.gunLock>0);el.children[1].style.setProperty('--r',((1-k)*100).toFixed(1)+'%');
     if(P.gunMats)for(const [m,e0] of P.gunMats)m.emissiveIntensity=e0*(0.2+0.8*k)*(P.gunLock>0?0.5+0.5*Math.sin(t*20):1);}
    // suction (only while the tank has room)
    const noz=P.bones.Hose_Grip.getWorldPosition(new THREE.Vector3());
    const ndir=P.nozzleLocal.clone().applyQuaternion(P.bones.Hose_Grip.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const nozTip=P.bones.Hose_Grip.localToWorld(new THREE.Vector3(0,0.17,0));
    const sdir=(tcDust||aimTarget).clone().sub(nozTip).normalize();
    cone.position.copy(nozTip);cone.lookAt(nozTip.clone().add(ndir));
    cone.visible=false;
    const room=P.carry<CFG.tankCap,packOn=PU.pack>0&&state==='play',pulling=(sucking||packOn)&&room;
    if((sucking||packOn)&&!room&&!P.fullWarn){P.fullWarn=1;sfx('full');tutorialEvent('full');floatText(nozTip,'TANQUE LLENO','loss');}
    if(room)P.fullWarn=0;
    nozzleGlow.position.copy(nozTip);nozzleGlow.material.opacity=THREE.MathUtils.damp(nozzleGlow.material.opacity,pulling?0.9:0,12,dt);
    nozzleGlow.scale.setScalar(0.32+Math.sin(t*30)*0.05+(pulling?0.14:0));
    if(suckGain)suckGain.gain.value=THREE.MathUtils.damp(suckGain.gain.value,pulling?0.05:0,10,dt);
    if(weldG)weldG.gain.value=THREE.MathUtils.damp(weldG.gain.value,performance.now()-WELD_T<160?0.32:0,14,dt);
    if(humOsc)humOsc.frequency.value=92+Math.sin(t*9)*6;
    pickCD-=dt;P.intake=Math.min(2,(P.intake||0)+(pulling?CFG.intakeRate*(calmNow()?1.6:1)*dt:0));
    const drift=state==='play'?CFG.drift*(1+wave*0.08)*dt:0;let loose=0,expired=0;
    // v65 (Santi): the vacuumed stream keeps up with the astronaut at normal speed (moving no longer drags it away),
    // but only with part of the extra speed of a Shift boost / dash, so a fast getaway still leaves a few grains behind
    // and while boosting (faster than normal top speed) nothing new is vacuumed: what was still floating is left behind for later
    const _sp=P.vel.length(),boosting=_sp>CFG.maxSpeed*1.05;{const fk=_sp>CFG.maxSpeed?(CFG.maxSpeed*0.97+(_sp-CFG.maxSpeed)*0.25)/_sp:0.97;_sf.copy(P.vel).multiplyScalar(fk);}
    const relD=packOn&&isTouch?17:CFG.suckRange+2; // a grain left this far behind the mouth drops out of the stream and floats again
    for(let i=0;i<DN;i++){if(!dAlive[i])continue;const j=i*3;loose++;
      V1.set(dPos[j],dPos[j+1],dPos[j+2]);
      // magnet prize: fly straight back into the hold
      if(dMag[i]){V2.set(HATCH.x-dPos[j],HATCH.y-dPos[j+1],HATCH.z-dPos[j+2]);const d=V2.length();
        if(d<0.7){dAlive[i]=0;dMag[i]=0;dPos[j+1]=-9999;cargo++;MAG.got++;loose--;continue;}
        const spd=Math.min(22,5+MAG.t*9),k=1-Math.exp(-6*dt);dVel[j]+=(V2.x/d*spd-dVel[j])*k;dVel[j+1]+=(V2.y/d*spd-dVel[j+1])*k;dVel[j+2]+=(V2.z/d*spd-dVel[j+2])*k;
        dPos[j]+=dVel[j]*dt;dPos[j+1]+=dVel[j+1]*dt;dPos[j+2]+=dVel[j+2]*dt;continue;}
      // floating cargo is lost for good after a while (unless it is already being sucked in)
      if(state==='play'&&!dCap[i]){dAge[i]+=dt;if(dAge[i]>CFG.floatLife){dAlive[i]=0;dPos[j+1]=-9999;lostN++;loose--;expired++;continue;}}
      if(pulling){V2.subVectors(V1,nozTip);const d=V2.length();
        if(dFree[i]>0)dFree[i]-=dt;
        if(!dCap[i]&&dFree[i]<=0&&!boosting&&((d<(isTouch?6:CFG.suckRange)&&V2.dot(sdir)/d>CFG.suckCos)||(packOn&&V1.distanceTo(P.pos)<(isTouch?15:CFG.packR))))dCap[i]=1; // v65 phones: reach 6 m, magnet 15 m
        // a dash shakes loose 1 in 4 of the grains in the stream (they stop and are left behind), or one left too far behind drops out: it floats again and can be picked up later
        if(dCap[i]&&P.suckJolt&&Math.random()<0.25){dCap[i]=0;dFree[i]=0.8;dVel[j]*=0.15;dVel[j+1]*=0.15;dVel[j+2]*=0.15;}else if(dCap[i]&&d>relD)dCap[i]=0;
        if(dCap[i]){
          // swallowed when it reaches the tip (or slips just behind the mouth plane)
          if(d<0.07||(V2.dot(sdir)<0&&d<0.14)){
            if(P.carry<CFG.tankCap&&P.intake>=1){P.intake-=1;dAlive[i]=0;dCap[i]=0;dPos[j+1]=-9999;P.carry++;if(pickCD<=0){sfx('pick');pickCD=0.06;}continue;}
            if(P.carry>=CFG.tankCap)dCap[i]=0;else{dVel[j]=_sf.x;dVel[j+1]=_sf.y;dVel[j+2]=_sf.z;dPos[j]+=dVel[j]*dt;dPos[j+1]+=dVel[j+1]*dt;dPos[j+2]+=dVel[j+2]*dt;continue;}}
          else{
          // steer straight into the nozzle, faster as it gets closer (stream)
          // v65 (Santi): the stream rides along with the astronaut (_sf) and is faster
          const spd=Math.min(Math.max(3,3+(CFG.suckRange-d)*1.6),d/dt*0.9);const k=1-Math.exp(-13*dt);
          dVel[j]+=(_sf.x-V2.x/d*spd-dVel[j])*k;dVel[j+1]+=(_sf.y-V2.y/d*spd-dVel[j+1])*k;dVel[j+2]+=(_sf.z-V2.z/d*spd-dVel[j+2])*k;
          dPos[j]+=dVel[j]*dt;dPos[j+1]+=dVel[j+1]*dt;dPos[j+2]+=dVel[j+2]*dt;continue;}}}
      else dCap[i]=0;
      // the product slowly disperses away from the ship; past lostR it is lost in space
      if(drift){const hl=Math.hypot(dHome[j],dHome[j+1],dHome[j+2])||1;dHome[j]+=dHome[j]/hl*drift;dHome[j+1]+=dHome[j+1]/hl*drift;dHome[j+2]+=dHome[j+2]/hl*drift;}
      if(FLOW.dz){dHome[j+2]-=FLOW.dz;dPos[j+2]-=FLOW.dz;}
      // drift home + damping
      dVel[j]+=(dHome[j]-dPos[j])*0.6*dt+Math.sin(t*1.3+i)*0.05*dt;dVel[j+1]+=(dHome[j+1]-dPos[j+1])*0.6*dt+Math.cos(t*1.1+i*1.7)*0.05*dt;dVel[j+2]+=(dHome[j+2]-dPos[j+2])*0.6*dt+Math.cos(t*0.7+i)*0.05*dt;
      const damp=Math.exp(-(sucking?0.8:2.2)*dt);dVel[j]*=damp;dVel[j+1]*=damp;dVel[j+2]*=damp;
      dPos[j]+=dVel[j]*dt;dPos[j+1]+=dVel[j+1]*dt;dPos[j+2]+=dVel[j+2]*dt;
      if(dPos[j]*dPos[j]+dPos[j+1]*dPos[j+1]+dPos[j+2]*dPos[j+2]>CFG.lostR*CFG.lostR){dAlive[i]=0;dPos[j+1]=-9999;lostN++;}}
    dGeo.attributes.position.needsUpdate=true;updateClusters(t);updateMist(dt);
    P.suckJolt=0;
    if(expired){EXP.n+=expired;}EXP.t-=dt;if(EXP.n>0&&EXP.t<=0){floatText(P.pos.clone().addScaledVector(UP,1.1),'−'+EXP.n+' tricomas perdidos','loss');EXP.n=0;EXP.t=2.5;}
    if(MAG.on){MAG.t+=dt;if(!dMag.some(v=>v)||MAG.t>6){for(let i=0;i<DN;i++)if(dMag[i]){dMag[i]=0;dAlive[i]=0;dPos[i*3+1]=-9999;cargo++;MAG.got++;}
      MAG.on=false;floatText(HATCH.clone().add(new THREE.Vector3(0.9,0.7,0)),'+'+MAG.got+' a bordo','gain');sfx('deposit');}}
    if(P.carry>=2)tutorialEvent('collect');
    // delivery at the hold hatch (only while the hold is not a nest)
    const bodega=ZONES[2],atHatch=P.pos.distanceTo(HATCH)<CFG.depositR;
    const flushBatch=()=>{if(P.depBatch){floatText(HATCH.clone().add(new THREE.Vector3(0.9,0.7,0)),'+'+P.depBatch+' a bordo','gain');P.depBatch=0;}};
    if(state==='play'&&atHatch&&P.carry>0&&!bodega.nest){if(!P.depActive){P.depActive=true;P.depStart=P.carry;}P.depAcc+=CFG.depositRate*dt;const n=Math.min(P.carry,Math.floor(P.depAcc));
      if(n>0){P.depAcc-=n;P.carry-=n;cargo+=n;stats.saved+=n;P.depBatch+=n;sfx('deposit');}
      if(P.carry===0){flushBatch();P.depActive=false;P.depDone=1.4;sfx('repaired');if(PATCHES.some(pa=>pa.hp<CFG.patchHp)){if(!TIP.done.weld)say('tut_repair',3,{once:true,queue:true});tip('weld');}burst(V3.copy(HATCH).addScaledVector(HATCH_N,0.4),0xffd060,40);DEPFX.rk=0;DEPFX.ringT=0.5;}}
    else{flushBatch();P.depAcc=0;if(P.depActive&&P.carry>0)P.depLeft=1.2;P.depActive=false;
      if(state==='play'&&atHatch&&P.carry>0&&bodega.nest&&!(P.nestWarn>0)){P.nestWarn=2;floatText(HATCH.clone().add(new THREE.Vector3(0.9,0.7,0)),'BODEGA DESTRUIDA','loss');}}
    updateDepFx(dt,state==='play'&&!!P.depActive);
    P.nestWarn=(P.nestWarn||0)-dt;P.depDone=Math.max(0,(P.depDone||0)-dt);P.depLeft=Math.max(0,(P.depLeft||0)-dt);
    {const el=$('dep'),show=state==='play'&&(P.depActive||P.depDone>0||P.depLeft>0);el.classList.toggle('show',show);el.classList.toggle('done',P.depDone>0);
     if(show){const tot=Math.max(1,P.depStart||1);$('depFill').style.width=(P.depDone>0?100:(1-P.carry/tot)*100)+'%';
       $('depLbl').textContent=P.depDone>0?'¡DESCARGA COMPLETA!':P.depActive?'DESCARGANDO · quedan '+P.carry:'TE FALTAN '+P.carry+' · vuelve a la bodega';}}
    // spiders & waves
    for(const Z of ZONES){Z.eaters=0;Z.alarmT-=dt;}
    updateRocks();
    for(const s of [...spiders])updateSpider(s,dt,t);updateSilk(t);
    for(const e of [...INCS])updateInc(e,dt,t);incFxFrame();
    if(state==='play'&&!inBreak&&WB.bossT>0){WB.bossT-=dt;if(WB.bossT<=0){WB.bossT=0;spawnSpitter(true);}}
    if(state==='play'&&!inBreak&&WB.incT>0){WB.incT-=dt;if(WB.incT<=0){WB.incT=0;spawnInc(incN===0);}}
    if(state==='play'&&!inBreak&&WB.spitQ&&WB.spitQ.length){WB.spitQ[0]-=dt;if(WB.spitQ[0]<=0){WB.spitQ.shift();spawnSpitter();}}
    if(state==='play'&&!inBreak&&cloudPlan<0&&cloudLastW!==wave&&wave>=2&&cargo<CFG.cargo*0.6){const W0=waveDef(wave);cloudPlan=Math.min(0.9,(W0.n-toSpawn)/Math.max(1,W0.n)+0.1);cloudLastW=wave;} // dropped below 60 % mid-round
    if(state==='play'&&!inBreak&&cloudPlan>=0){const W0=waveDef(wave);if((W0.n-toSpawn)/Math.max(1,W0.n)>=cloudPlan){cloudPlan=-1;spawnCloud();}}
    WB.rt=(WB.rt||0)+dt;
    if(state==='play'&&!inBreak&&eggPlan.length){const W0=waveDef(wave),fr=(W0.n-toSpawn)/Math.max(1,W0.n);if((fr>=eggPlan[0]||WB.rt>25+eggPlan[0]*20)&&tryLayEgg())eggPlan.shift();}
    updateEggs(dt,t);
    markLast();
    if(state==='play'){
      playT+=dt;
      const W=waveDef(wave),nests=ZONES.filter(Z=>Z.nest).length;
      if(toSpawn>0&&!CINE.on){
        if(WB.left<=0&&wave===0){if(spiders.length<=1||stats.kills>=2){WB.gi++;WB.left=toSpawn;WB.intro2=true;spawnT=0.2;}}
        else if(WB.left<=0){ // burst spawned: once it is (almost) cleared, a short calm before the next one
          if(!WB.calm&&spiders.length<=1){WB.calm=true;const need=workLeft();WB.lull=need?CFG.lullTime*(wave<3?0.5:wave<5?0.75:1):1.2;if(need){showMsg('CALMA','Repara y recoge la carga · llega otra tanda',2.2);tutorialEvent('calm');say('calm_01',2,{cd:60});}}
          if(WB.calm&&WB.lull>1.5&&!workLeft())WB.lull=1.5;
          if(WB.calm){WB.lull-=dt;if(WB.lull<=0||skipReq){WB.calm=false;WB.gi++;WB.left=WB.groups[WB.gi]??toSpawn;spawnT=0.3;showMsg('¡OTRA TANDA!','',1.6);sfx('alert');say(Math.random()<0.5?'tanda_01':'tanda_02',2,{cd:35});
            if(wave>=5&&!WB.spit&&WB.gi>=WB.groups.length-1){WB.spit=true;WB.spitQ=wave>=9?[1.8,7.2]:[1.8];} /* round 6+: one, round 10+: two (game-time timers) */}}}
        else{WB.calm=false;spawnT-=dt*(1+nests*0.5);if(spawnT<=0&&spiders.length<W.cap){if(WB.intro2){WB.intro2=false;dropNear(spawnSpider('lurker'));}else spawnSpider();toSpawn--;WB.left--;spawnT=W.every*THREE.MathUtils.randFloat(0.6,1.4);}}}
      else if(spiders.length===0&&EGGS.length===0&&!(WB.spitQ&&WB.spitQ.length)&&!(WB.bossT>0)&&!INCS.length&&!(WB.incT>0)){
        if(!inBreak){inBreak=true;breakT=workLeft()?CFG.breakTime*(wave<3?0.5:wave<5?0.75:1):(wave<3?2.5:4);const sec=cargo;score+=sec;showcaseT=3.2;sfx('win');
          const rl=lostN-roundLost0;showMsg('RONDA '+(wave+1)+' SUPERADA','+'+fmtN(sec)+' puntos por la carga a bordo'+(rl?' · perdidos '+rl:'')+(isTouch?'':' · Enter para seguir'),3.8);WB.calm=false;{const L=['rnd_clear_01','rnd_clear_02','rnd_clear_03','rnd_clear_04'];say(L[Math.floor(Math.random()*L.length)],2,{queue:true});}
          if(PATCHES.some(p=>p.hp<CFG.patchHp))tutorialEvent('repairTime');}
        if(breakT>3&&!workLeft())breakT=3; // nothing left to fix or collect -> next round right away
        breakT-=dt;if(skipReq||breakT<=0)startWave(wave+1);}
      skipReq=false;
      $('round').textContent=inBreak?`Ronda ${wave+2} en ${Math.ceil(Math.max(0,breakT))} s · Enter`:`Ronda ${wave+1} · ${spiders.length+toSpawn} arañas`;
    }
    // ---- hull patches: visuals, sparks and slow leaks from broken holes ----
    PETAL_PULSE.value=0.55+0.45*Math.sin(t*6);
    for(const pa of PATCHES){const d=1-pa.hp/CFG.patchHp;pa.mesh.visible=d>0.02;const u=pa.mat.uniforms;updatePetals(pa);
      u.uLevel.value=0.25+0.75*d;u.uBroken.value=pa.hp<=0?1:0;u.uTime.value=t;
      if(pa.hp<=0&&state==='play'){pa.sparkT-=dt;if(pa.sparkT<=0){pa.sparkT=0.5+Math.random()*0.9;burst(V3.copy(pa.pos).addScaledVector(pa.n,0.2),0xff7030,3);
        pa.leak+=1.2*leakScale();if(pa.leak>=1){const n=Math.floor(pa.leak);pa.leak-=n;leakFrom(pa,n);}}}}
    // ---- repair: hold F next to a damaged patch; release inside the golden band for an instant weld ----
    let near=null,nd=CFG.repairR;
    if(state==='play')for(const pa of PATCHES){if(pa.hp>=CFG.patchHp)continue;const d=P.pos.distanceTo(pa.pos);if(d<nd){nd=d;near=pa;}}
    const blocked=!!near&&spiders.some(s=>s.state!=='leap'&&s.state!=='drift'&&s.pos.distanceTo(near.pos)<3.2);
    P.jam=Math.max(0,P.jam-dt);
    // touch: welds on its own next to a breach while it is within 120° of the view; facing away pauses it (the progress stays)
    let tcW=false,tcPause=false;
    if(isTouch&&state==='play'&&near&&!blocked){const cp=Math.cos(P.pitch);_tcF.set(-Math.sin(P.yaw)*cp,Math.sin(P.pitch),-Math.cos(P.yaw)*cp);
      tcW=_tcF.angleTo(_tcV.subVectors(near.pos,P.pos))<=2.0944;tcPause=!tcW;}
    TC.wSlow=tcW&&P.jam<=0; // read by the movement next frame
    const fHeld=!!keys.KeyF||tcW;
    if(state==='play'&&fHeld&&near&&!blocked&&P.jam<=0){
      const need=Math.max(0.35,1-near.hp/CFG.patchHp),dur=CFG.repairTime*need*(calmNow()?0.5:1)*(PU.weld>0?0.25:1); // welding is twice as fast in the calm (x4 with the prize)
      if(R.pa!==near){R.pa=near;R.band=THREE.MathUtils.randFloat(0.42,0.7);R.useBand=dur>=1.0;if(R.useBand)tutorialEvent('band');}
      R.on=true;near.prog+=dt/dur;
      R.weldT-=dt;if(R.weldT<=0){R.weldT=0.05;burst(V3.copy(near.pos).addScaledVector(near.n,0.15),0xbff8ff,2);}
      WELD_T=performance.now();if(!LOOPS.weldOn){R.sfxT-=dt;if(R.sfxT<=0){R.sfxT=0.11;sfx('weld');}}
      weldLight.position.copy(near.pos).addScaledVector(near.n,0.5);weldLight.intensity=3+Math.random()*4;
      weldBeam.visible=true;const bp=weldBeam.geometry.attributes.position;bp.setXYZ(0,nozTip.x,nozTip.y,nozTip.z);bp.setXYZ(1,near.pos.x,near.pos.y,near.pos.z);bp.needsUpdate=true;
      if(near.prog>=1){repairPatch(near,PU.weld>0);R.pa=null;R.on=false;}}
    else{
      if(R.on&&R.pa&&!fHeld&&!isTouch){const p=R.pa.prog; // released (PC; on touch letting go keeps the progress)
        if(R.useBand&&p>=R.band&&p<=R.band+CFG.bandW)repairPatch(R.pa,true);
        else if(p>0.05){R.pa.prog=Math.max(0,p-0.35);P.jam=0.6;sfx('jam');}}
      R.on=false;if(R.pa&&R.pa!==near)R.pa=null;weldBeam.visible=false;weldLight.intensity=0;}
    {const el=$('rep'),tp=isTouch&&tcPause&&!!R.pa&&R.pa===near,show=state==='play'&&R.pa&&(R.on||P.jam>0||tp);el.classList.toggle('show',!!show);el.classList.toggle('jam',P.jam>0);
     el.classList.toggle('paused',tp);if(tp&&!TC.wPaused)sfx('jam');TC.wPaused=tp;$('tip').classList.toggle('wHide',!!show);
     if(R.pa){$('repLbl').textContent='REPARANDO '+R.pa.zone.name;$('repFill').style.width=Math.min(100,R.pa.prog*100)+'%';
       const bd=$('repBand');bd.hidden=!R.useBand||!!R.pa.noPerf;bd.style.left=(R.band*100)+'%';bd.style.width=(CFG.bandW*100)+'%';}
     const pr=$('repPrompt');let showP=state==='play'&&near&&!R.on&&!(isTouch&&tcPause&&R.pa===near);
     if(showP){_pv.copy(near.pos).addScaledVector(near.n,0.6).project(camera);showP=_pv.z<1&&Math.abs(_pv.x)<0.95&&Math.abs(_pv.y)<0.95;
       if(showP){pr.style.left=((_pv.x+1)/2*innerWidth)+'px';pr.style.top=((1-_pv.y)/2*innerHeight)+'px';pr.classList.toggle('blocked',blocked);
         $('repPromptT').textContent=blocked?'ARAÑAS ENCIMA':'SOLDAR '+near.zone.name;if(!blocked)tip('weld');}}
     pr.hidden=!showP;}
    if(state==='play'){
      // hatch beacon + off-screen indicator
      const call=P.carry>=CFG.tankCap*0.7&&!bodega.nest;
      hatchLight.intensity=call?4+Math.sin(t*4)*2:P.carry>0?1.2:0;
      hatchRing.material.color.setHex(bodega.nest?0x5a1008:P.carry>0?0x7fffd0:0x2a4a40);
      hatchRing.scale.setScalar(1+(atHatch&&P.carry>0?Math.sin(t*14)*0.08:0));
      const ind=$('hatchInd'),showInd=call&&!atHatch&&state==='play';ind.hidden=!showInd;
      if(showInd){_pv.copy(HATCH).project(camera);let x=_pv.x,y=_pv.y;const behind=_pv.z>1;if(behind){x=-x;y=-y;}
        const m=0.86,off=behind||Math.abs(x)>m||Math.abs(y)>m;if(off){const s=m/Math.max(Math.abs(x),Math.abs(y),1e-3);x*=s;y*=s;}
        ind.style.left=((x+1)/2*innerWidth)+'px';ind.style.top=((1-y)/2*innerHeight)+'px';
        ind.firstChild.style.transform=`rotate(${off?Math.atan2(x,y)*180/Math.PI:180}deg)`;
        $('hatchDist').textContent=Math.round(P.pos.distanceTo(HATCH))+' m';}
      // zones being eaten off-screen -> red arrow at the screen edge
      for(const Z of ZONES){const el=$('zi'+Z.idx);let show=Z.eaters>0&&Z.bite;
        if(show){_pv.copy(Z.bite.pos).project(camera);let x=_pv.x,y=_pv.y;const behind=_pv.z>1;if(behind){x=-x;y=-y;}
          const m=0.86,off=behind||Math.abs(x)>m||Math.abs(y)>m;show=off;
          if(off){const s=m/Math.max(Math.abs(x),Math.abs(y),1e-3);x*=s;y*=s;el.style.left=((x+1)/2*innerWidth)+'px';el.style.top=((1-y)/2*innerHeight)+'px';
            el.firstChild.style.transform=`rotate(${Math.atan2(x,y)*180/Math.PI}deg)`;el.lastChild.textContent=Z.name;}}
        el.hidden=!show;}
    }
    updateFX(dt);updateFallFX(dt);updateDrops(dt,t);updateZaps(dt);updatePU(dt);updateAcid(dt);updateBoss();updateBurn(dt);
    // HUD
    {const el=$('cargoBar'),k=Math.max(0,cargo/CFG.cargo);el.querySelector('i').style.width=Math.min(100,k*100)+'%';$('cargoPct').textContent=Math.round(k*100)+'%';
     if(CB_.last===undefined)CB_.last=cargo;if(cargo<CB_.last)CB_.leakT=1.2;else if(cargo>CB_.last)CB_.gainT=0.8;CB_.last=cargo;CB_.leakT-=dt;CB_.gainT-=dt;
     el.classList.toggle('leak',CB_.leakT>0);el.classList.toggle('gain',CB_.gainT>0&&!(CB_.leakT>0));el.classList.toggle('low',k<0.3);
     $('cargoNote').textContent=CB_.leakT>0?'▼ FUGA · recógelos y llévalos a la bodega':k<0.3?'¡RESERVA BAJA!':'';
     if(state==='play'&&k<0.3&&!CB_.warned){CB_.warned=1;showMsg('¡LA CARGA SE AGOTA!','Si los tricomas a bordo llegan a 0, se acabó',2.8);sfx('alert');}
     if(state==='play'&&cargo<=0)endGame(false,'cargo');}
    {const el=$('scoreN');if(el.textContent!==String(score)){if(+el.textContent<score){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}el.textContent=score;}}$('ptsN').textContent=pts;updateDash(t,loose);updateHud4(dt,t);updateTip(dt);
    if(TUT.timer>0){TUT.timer-=dt;if(TUT.timer<=0){TUT.timer=0;if(TUT.q.length){const [k,d]=TUT.q.shift();showTut(k,d);}else resumeTut();}}
    if(P.tank){const T=P.tank;T.level=THREE.MathUtils.damp(Number.isFinite(T.level)?T.level:0,(P.carry||0)/CFG.tankCap,6,dt); // (carry is undefined on the menu: never let NaN stick)
      const U=T.mat.uniforms;U.uLevel.value=T.level;U.uTime.value=t;U.uSuck.value=THREE.MathUtils.damp(U.uSuck.value,sucking||P.depActive?1:0,6,dt);T.fill.visible=T.level>0.004;if(P.scr){const S=P.scr.material.uniforms;S.uLevel.value=T.level;S.uTime.value=t;S.uSuck.value=U.uSuck.value;S.uGlow.value=QA.lvl>=4?0:1;} /* v64 backpack screen */T.glow.intensity=T.level>0.01?(sucking?0.45:0.2):0;}
    if(msgT>0){msgT-=dt;if(msgT<=0)$('msg').style.opacity=0;}
  }else{updateFX(dt);
    if(P.model){const a=t*0.22;camera.position.set(P.pos.x+Math.sin(a)*3.3,P.pos.y+0.8,P.pos.z+Math.cos(a)*3.3);camera.lookAt(P.pos.x,P.pos.y+0.35,P.pos.z);}}
  const menuBg=state==='menu'&&!MENU_BG.warm;camera.layers.mask=menuBg?2:1;
  if(menuBg&&!window.__camOv)menuCam(t);
  flashT=Math.max(0,flashT-dt*4);flashLight.intensity=flashT*40;
  sun.target.position.copy(P.pos);sun.position.copy(P.pos).addScaledVector(SUN_DIR,60);
  updateBelt(FLOW.dz);DUST.off.z-=FLOW.dz;DUST.mat.uniforms.uCam.value.copy(camera.position);DUST.mat.uniforms.uPx.value=renderer.getPixelRatio();
  updateLook(dt,t);
  camFill.target.position.copy(P.pos);camFill.position.copy(camera.position).addScaledVector(UP,2.5);
  updateMusic();
  // camera shake on top of the follow camera (re-copied from camPos every frame, so it never accumulates)
  if(shakeAmp>0.002){camera.position.x+=(Math.random()-0.5)*shakeAmp;camera.position.y+=(Math.random()-0.5)*shakeAmp;camera.position.z+=(Math.random()-0.5)*shakeAmp;shakeAmp*=Math.exp(-dt*10);}
  tcFrame(dt);mhudFrame();mtutTick();pckFrame(dt);qaFrame(_qa0);if(!window.__noRender)composer.render();requestAnimationFrame(tick);}
camera.position.set(14,4,16);camera.lookAt(0,0,0);
requestAnimationFrame(tick);
window.__renderer=renderer;window.__GRADE=GRADE;window.__heads={get CINE(){return CINE},spawnCloud,shipClear,BELT,DUST,get leakMult(){return leakMult()},ROCKS,rockAt,landOnRock,get ammo(){return P.ammo},EGGS,layEgg,tryLayEgg,P,spiders,CLOUDS,killSpider,spawnSpider,spawnSpitter,spitAcid,ACID,hullBlocked,stats,inp,get lost(){return lostN;},get pts(){return pts},PU,DROPS,spawnDrop,applyPU,WB,get cargo(){return cargo}};
