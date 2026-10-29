/* ================= BULLETS / FX ================= */
const bullets=[];
const bulletGeo=new THREE.CapsuleGeometry(0.035,0.45,2,6).rotateX(Math.PI/2);
const bulletMat=new THREE.MeshBasicMaterial({color:new THREE.Color(3,2.2,0.9)});
function fire(target){
  pistol.updateMatrixWorld(true);const o=muzzle.getWorldPosition(new THREE.Vector3());const d=target.clone().sub(o).normalize();
  if(XP.on){const m=xpBolt();m.position.copy(o).addScaledVector(d,0.45);m.lookAt(o.clone().add(d));if(PU.over>0)m.scale.set(1.4,1.4,1.2);scene.add(m);
    bullets.push({m,vel:d.multiplyScalar(XP.speed),life:1.3,xp:true,pierce:XP.pierce});sfx('shotBig');stats.shots++;
    muzzleFlash.material.color.setRGB(0.9,2.6,4.6);muzzleFlash.scale.setScalar(1.05);XP.pulse=Math.max(XP.pulse,0.9);
    P.recoil=1.35;muzzleT=0.07;shake(0.05);P.shotT=1.6;return;}
  muzzleFlash.material.color.setRGB(4,4,4);
  const m=new THREE.Mesh(bulletGeo,bulletMat);m.position.copy(o);m.lookAt(o.clone().add(d));if(PU.over>0)m.scale.set(2.6,2.6,1.5);scene.add(m);
  bullets.push({m,vel:d.multiplyScalar(CFG.bulletSpeed),life:1.4});sfx(PU.over>0?'shotBig':'shot');stats.shots++;if(PU.over>0){muzzleFlash.scale.setScalar(0.95);shake(0.06);}else muzzleFlash.scale.setScalar(0.55);
  P.recoil=1;muzzleT=0.06;shake(0.035);P.shotT=1.6;}
const sparks=[];
const sparkGeo=new THREE.TetrahedronGeometry(0.08,0);
function burst(p,color,n){const mat=new THREE.MeshBasicMaterial({color});for(let i=0;i<n;i++){const m=new THREE.Mesh(sparkGeo,mat);m.position.copy(p);scene.add(m);
  sparks.push({m,vel:new THREE.Vector3().randomDirection().multiplyScalar(2+Math.random()*6),life:0.6+Math.random()*0.5});}}
function updateFX(dt){
  for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.life-=dt;const step=b.vel.clone().multiplyScalar(dt);
    let hit=null,crit=false,bt=2;const p0=b.m.position,sl=step.lengthSq();
    for(const s of spiders){
      // the head (eyes + fangs) is the weak spot: a hit there counts double
      const hp=headPos(s,HEADL),th=THREE.MathUtils.clamp(V1.subVectors(hp,p0).dot(step)/sl,0,1);
      if(th<bt&&V2.copy(p0).addScaledVector(step,th).distanceTo(hp)<0.11*s.mesh.scale.x){hit=s;bt=th;crit=true;continue;}
      const c=s.mesh.position,t=THREE.MathUtils.clamp(V1.subVectors(c,p0).dot(step)/sl,0,1);
      if(t<bt&&V2.copy(p0).addScaledVector(step,t).distanceTo(c)<0.75*Math.max(1,s.mesh.scale.x*0.8)){hit=s;bt=t;crit=false;}}
    let eg=null,et=2;for(const e of EGGS){const tt=THREE.MathUtils.clamp(V1.subVectors(e.pos,p0).dot(step)/sl,0,1);if(tt<et&&V2.copy(p0).addScaledVector(step,tt).distanceTo(e.pos)<0.42*EGG_S){eg=e;et=tt;}}
    if(eg&&(!hit||et<bt))hit=null;else eg=null;
    let IH=INCS.length?incRay(p0,step,sl):null;if(IH&&(!hit||IH.t<bt)&&(!eg||IH.t<et)){hit=null;eg=null;}else IH=null;
    const wt=wingRay(p0,step);if(wt>=0&&(!hit||wt<bt)&&(!eg||wt<et)&&(!IH||wt<IH.t)){p0.addScaledVector(step,wt);burst(p0,0xffd080,5);sfx('hit',p0);hit=null;eg=null;IH=null;b.life=0;}
    else if(hit)p0.addScaledVector(step,bt);else if(eg)p0.addScaledVector(step,et);else if(IH)p0.addScaledVector(step,IH.t);else p0.add(step);
    if(IH){const was=IH.e.st;incDamage(IH.e,b.xp?XP.dmg:CFG.bulletDmg,IH.part,b.vel,p0.clone());if(b.xp)burst(p0,0x7fe6ff,6);if(was!=='dead'&&IH.e.st==='dead')xpKill(false,2);b.life=0;}
    if(eg){eg.hp-=PU.over>0?99:(b.xp?XP.dmg:CFG.bulletDmg);eg.flash=1;stats.hits++;addPts(PTS.hit);burst(p0,0xff6030,8);sfx('hit',p0);crossHit();if(eg.hp<=0)destroyEgg(eg);b.life=0;}
    if(hit){hit.hp-=PU.over>0?(hit.kind==='spitter'?6:99):(b.xp?XP.dmg:CFG.bulletDmg)*(crit?2:1);if(b.xp)burst(p0,0x7fe6ff,8);hit.flash=1;addPts(PTS.hit);stats.hits++;hit.aggro=Math.max(hit.aggro||0,6);
      if(crit){burst(p0,0xffffff,9);sfx('crit',p0);crossCrit();}else{burst(p0,0xffc050,7);sfx('hit',p0);crossHit();}
      hit.kick=(hit.kick||new THREE.Vector3()).addScaledVector(V3.copy(b.vel).normalize(),(b.xp?0.55:0.3)/hit.mesh.scale.x); // knocked back by the impact
      if(hit.state==='crawl'||hit.state==='eat'){hit.cd=Math.max(hit.cd,0.3);}if(hit.hp<=0){killSpider(hit,crit);xpKill(crit);if(b.xp&&b.pierce>0)b.pierce--;else b.life=0;}else b.life=0;}
    else if(b.life>0&&pushOutOfShip(V1.copy(p0),0,null)){burst(p0,0xffd080,4);b.life=0;}
    else if(b.life>0){const rt=rockRay(V1.copy(p0).sub(step),step);if(rt>=0){p0.copy(V1).addScaledVector(step,rt);burst(p0,0x8a7a6a,6);sfx('hit',p0);b.life=0;}}
    if(b.life<=0){scene.remove(b.m);bullets.splice(i,1);}}
  for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];s.life-=dt;s.m.position.addScaledVector(s.vel,dt);s.m.rotation.x+=dt*8;s.m.scale.setScalar(Math.max(0.01,s.life));
    if(s.life<=0){scene.remove(s.m);sparks.splice(i,1);}}
  for(let i=gibs.length-1;i>=0;i--){const g=gibs[i];g.life-=dt;
    if(g.ring){g.m.scale.setScalar(0.4+(0.28-g.life)*12);g.m.material.opacity=Math.max(0,g.life/0.28);}
    else{g.m.position.addScaledVector(g.vel,dt);g.vel.multiplyScalar(Math.exp(-1.2*dt));g.m.rotation.x+=g.spin.x*dt;g.m.rotation.y+=g.spin.y*dt;g.m.rotation.z+=g.spin.z*dt;
      if(g.life<0.35)g.m.scale.setScalar(g.s0*Math.max(0.01,g.life/0.35));}
    if(g.life<=0){scene.remove(g.m);if(g.ring)g.m.material.dispose();gibs.splice(i,1);}}}

