/* ================= EXTRA POWER (v49) =================
   From round 4: 5 kills in a row (a headshot kill counts 1.5); taking damage takes 2 off the streak. From round 6 it also drops as a prize.
   swap the pistol for Santi's heavy gun for 20 s of combat: blue plasma bolts, 3 damage (x2 head), 7.7 shots/s, no heat,
   and a bolt that kills keeps going into the next spider. The clock stops in cinematics and between rounds. */
const XP={on:false,t:0,dur:20,streak:0,need:5,fromWave:3,dmg:3,rate:0.13,speed:85,pierce:1,name:'EXTRA POWER',
  g1:null,g2:null,sw:0,swDir:0,mz1:new THREE.Vector3(0,0.0887,0.345),mz2:new THREE.Vector3(0,0.122,0.455),pulse:0};
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
function xpStart(){if(!XP.g2)return;XP.on=true;XP.t=XP.dur;XP.streak=0;xpPips();XP.sw=0.42;XP.swDir=1;
  P.ammo=CFG.gunCap;P.gunLock=0;P.reloading=false;
  const p=xpGunPos();burst(p,0x6fe0ff,12);burst(p,0xffd060,8);XP.pulse=1.6;shake(0.09);
  {const f=$('xpFlash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}
  showMsg(XP.name,'Plasma · '+XP.dur+' s',2.4);sfx('power');sfx('combo');say('xp_on',3);}
function xpEnd(quiet){if(!XP.on)return;XP.on=false;XP.t=0;P.ammo=CFG.gunCap;P.gunLock=0;
  if(quiet){XP.sw=0;if(XP.g2)XP.g2.visible=false;if(XP.g1){XP.g1.visible=true;XP.g1.scale.setScalar(1);}return;}
  XP.sw=0.42;XP.swDir=-1;const p=xpGunPos();burst(p,0x6fe0ff,16);burst(p,0xb8f2ff,8);sfx('tss');showMsg('','EXTRA POWER agotado',1.4);say('xp_end',2,{cd:30});}
function xpUpdate(dt,t){
  if(XP.on&&state==='play'&&!CINE.on&&!inBreak){XP.t-=dt;if(XP.t<=0)xpEnd();}
  // swap: the old gun shrinks into a flash, the new one pops out with a little overshoot
  if(XP.g1&&XP.g2){
    if(XP.sw>0){XP.sw=Math.max(0,XP.sw-dt);const k=1-XP.sw/0.42,inG=XP.swDir>0?XP.g2:XP.g1,outG=XP.swDir>0?XP.g1:XP.g2;
      if(k<0.35){outG.visible=true;outG.scale.setScalar(Math.max(0.05,1-k/0.35));inG.visible=false;}
      else{outG.visible=false;const u=(k-0.35)/0.65,c=1.70158;const e=1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2);inG.visible=true;inG.scale.setScalar(Math.max(0.05,e));}}
    else{XP.g1.visible=!XP.on;XP.g2.visible=XP.on;XP.g1.scale.setScalar(1);XP.g2.scale.setScalar(1);}
    muzzle.position.copy(XP.on?XP.mz2:XP.mz1);}
  // blue glow follows the time left; it flickers in the last 3 s
  XP.pulse=Math.max(0,XP.pulse-dt*5);
  if(P.gun2Mats){const k=XP.on?XP.t/XP.dur:0.3;for(const [m,e0] of P.gun2Mats)m.emissiveIntensity=e0*(0.35+0.65*k+XP.pulse*0.6)*(XP.on&&XP.t<3?0.55+0.45*Math.sin(t*22):1);}
  if(XP.on||XP.pulse>0){xpLight.position.copy(xpGunPos());xpLight.intensity=XP.pulse*9+(XP.on?0.6:0);}else xpLight.intensity=0;}
window.__xp={XP,xpStart,xpEnd,xpKill,xpBreak,shoot:()=>fire(aimTarget),shootAt:v=>fire(v),get DROPS(){return DROPS},get dropsRound(){return dropsRound},spawnDrop:(p,k)=>spawnDrop(p,k)};

