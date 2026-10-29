// ---- points (the currency for later upgrades) ----
let pts=0;const PTS={hit:10,kill:60,head:100,repair:40,perfect:60,nuke:400};
const ptsVal=n=>n*(PU.dbl>0?2:1);
function addPts(n){pts+=ptsVal(n);}
// ---- multikills and headshot streaks ----
const CB={n:0,t:-9,hs:0,heads:0};
function comboBanner(txt,sub){const c=$('combo');c.innerHTML=txt+(sub?`<small>${sub}</small>`:'');c.classList.remove('go');void c.offsetWidth;c.classList.add('go');}
function onKill(s,crit){
  if(playT-CB.t<1.6)CB.n++;else CB.n=1;CB.t=playT;
  if(crit){CB.hs++;CB.heads++;stats.heads++;}else CB.hs=0;stats.multi=Math.max(stats.multi,CB.n);
  if(CB.n>=2){const nm=CB.n===2?'¡DOBLE!':CB.n===3?'¡TRIPLE!':'¡MASACRE!',bn=CB.n===2?50:CB.n===3?100:150;addPts(bn);comboBanner(nm,'+'+ptsVal(bn));sfx('combo');if(CB.n>=3)say('multi_01',2,{cd:35});}
  else if(CB.hs>=3&&CB.hs%3===0){addPts(75);comboBanner('RACHA x'+CB.hs,'headshots · +'+ptsVal(75));sfx('combo');say('streak_01',2,{cd:45});}
  else if(crit&&Math.random()<0.35)say(Math.random()<0.5?'hs_01':'hs_02',2,{cd:40});
  if(stats.kills>=2&&!CB.heads)tutorialEvent('head');
  if(s.kind!=='brood'||Math.random()<0.2)maybeDrop(s.pos.clone());}
// ---- prizes: random drops that float for a while and vanish if not picked up ----
const PU={dbl:0,over:0,weld:0,pack:0};const DROPS=[];let dropsRound=0,lastDrop=-99;
const MAG={on:false,t:0,got:0},EXP={n:0,t:0};
const PU_DEF={nuke:{name:'DESCARGA TOTAL',sub:'Todas las arañas del casco, fritas',col:'#7fe8ff'},
  fix:{name:'REPARACIÓN TOTAL',sub:'El casco queda como nuevo',col:'#7fffd0'},
  over:{name:'SOBRECARGA',sub:'Cada disparo mata · 20 s',col:'#ff7a45'},
  dbl:{name:'PUNTOS DOBLES',sub:'30 s',col:'#ffd36a'},
  mag:{name:'TODO A BORDO',sub:'Todos los tricomas que flotan vuelven a la nave',col:'#ffb840'},
  pack:{name:'IMÁN DE MOCHILA',sub:'Aspira solo los tricomas que tienes cerca · llévalos a la bodega · 15 s',col:'#ffe08a'},
  weld:{name:'SOLDADURA RÁPIDA',sub:'Sueldas 4 veces más rápido y siempre perfecto · 20 s',col:'#9fffe8'},
  xp:{name:'EXTRA POWER',sub:'Plasma · 20 s',col:'#5fd0ff'}};
const PU_TEX={},PU_HALO=glowTex('rgba(255,255,255,.9)','rgba(255,255,255,.25)');
function puTex(k){if(PU_TEX[k])return PU_TEX[k];const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),col=PU_DEF[k].col;
  g.fillStyle='rgba(12,9,4,.88)';g.beginPath();g.arc(64,64,56,0,7);g.fill();g.lineWidth=7;g.strokeStyle=col;g.beginPath();g.arc(64,64,52,0,7);g.stroke();
  g.lineWidth=3;g.strokeStyle='rgba(255,255,255,.35)';g.beginPath();g.arc(64,64,44,0,7);g.stroke();
  g.fillStyle=col;g.strokeStyle=col;g.lineCap='round';g.lineJoin='round';
  if(k==='nuke'){g.beginPath();g.moveTo(72,20);g.lineTo(38,70);g.lineTo(60,70);g.lineTo(52,108);g.lineTo(90,52);g.lineTo(67,52);g.closePath();g.fill();}
  else if(k==='fix'){g.lineWidth=13;g.beginPath();g.moveTo(42,88);g.lineTo(74,56);g.stroke();g.lineWidth=11;g.beginPath();g.arc(80,48,15,Math.PI*0.95,Math.PI*2.55);g.stroke();}
  else if(k==='over'){g.lineWidth=7;g.beginPath();g.arc(64,64,24,0,7);g.stroke();for(const [x0,y0,x1,y1] of [[64,26,64,44],[64,84,64,102],[26,64,44,64],[84,64,102,64]]){g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
    g.beginPath();g.arc(64,64,7,0,7);g.fill();}
  else if(k==='weld'){g.lineWidth=9;g.beginPath();g.moveTo(34,92);g.lineTo(62,64);g.stroke();g.beginPath();g.moveTo(70,30);g.lineTo(56,58);g.lineTo(72,58);g.lineTo(58,90);g.stroke();
    g.fillStyle='#fff';for(const [x,y] of [[84,40],[92,56],[80,70]]){g.beginPath();g.arc(x,y,4,0,7);g.fill();}}
  else if(k==='dbl'){g.font='900 54px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('x2',64,67);}
  else if(k==='pack'){g.lineWidth=11;g.lineCap='butt';g.beginPath();g.arc(64,66,17,Math.PI,0,true);g.stroke();
    g.fillStyle='#fff';g.fillRect(41,80,13,10);g.fillRect(74,80,13,10);g.fillStyle=col;g.fillRect(41,66,13,14);g.fillRect(74,66,13,14);
    for(const [x,y,r] of [[38,34,5],[64,26,6],[90,34,5],[50,44,3.5],[78,44,3.5]]){g.beginPath();g.arc(x,y,r,0,7);g.fill();}}
  else if(k==='xp'){ // the heavy gun in profile: barrel, energy chamber, grip
    g.beginPath();g.moveTo(26,56);g.lineTo(98,56);g.lineTo(106,62);g.lineTo(98,68);g.lineTo(26,68);g.closePath();g.fill();
    g.fillRect(34,46,40,10);g.beginPath();g.moveTo(44,68);g.lineTo(60,68);g.lineTo(54,98);g.lineTo(40,98);g.closePath();g.fill();
    g.fillStyle='#e8fbff';g.fillRect(48,49,22,4);g.fillRect(80,59,14,3);}
  else if(k==='mag'){g.lineWidth=15;g.lineCap='butt';g.beginPath();g.arc(64,58,24,Math.PI,0,true);g.stroke();
    g.fillStyle='#fff';g.fillRect(32,78,17,13);g.fillRect(79,78,17,13);g.fillStyle=col;g.fillRect(32,58,17,20);g.fillRect(79,58,17,20);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return PU_TEX[k]=t;}
function looseCount(){let n=0;for(let i=0;i<DN;i++)if(dAlive[i]&&!dMag[i])n++;return n;}
// early rounds: only prizes that don't play the game for you (double points, one-shot kills, a short-range backpack magnet).
// From round 5 the big helps join in, weighted by what is going wrong: holes -> repair/weld, spiders on the hull -> discharge, cargo adrift -> all aboard
function pickPU(){const lc=looseCount(),bad=PATCHES.filter(pa=>pa.hp<CFG.patchHp*0.7).length,broken=PATCHES.filter(pa=>pa.hp<=0).length,
    onHull=spiders.filter(s=>s.state==='crawl'||s.state==='eat'||s.state==='windup').length;
  const o=['dbl','over','over'];if(lc>3)o.push('pack','pack');
  if(wave>=4){o.push('weld');if(bad>=2)o.push('fix','weld');if(bad>=4||broken>=2)o.push('fix','fix');if(onHull>=4)o.push('nuke');if(onHull>=7)o.push('nuke','nuke');if(lc>=30)o.push('mag');if(lc>=60)o.push('mag','mag');}
  // round 6+: the ship is full of holes and cargo adrift at the same time -> repair-everything and all-aboard show up more
  if(wave>=5){if(bad>=1)o.push('fix','fix');if(bad>=3)o.push('fix');if(lc>=12)o.push('mag','mag');if(lc>=35)o.push('mag');}
  if(wave>=5&&!XP.on&&XP.g2&&!DROPS.some(d=>d.k==='xp')){o.push('xp');if(onHull>=5||spiders.length>=8)o.push('xp');}
  return o[Math.floor(Math.random()*o.length)];}
// round 6+ (v51): up to 6 prizes a round (one more every 3 rounds), 6 s apart, about one kill in five drops one,
// and if the ship, the cargo or the suit is in trouble and nothing has dropped for 15 s, the next kill always drops one.
// Rounds 1-5 are unchanged.
function dropCap(){return 3+Math.floor(wave/4)+(wave>=5?2+Math.floor((wave-5)/3):0);}
function inTrouble(){const bad=PATCHES.filter(pa=>pa.hp<CFG.patchHp*0.7).length,broken=PATCHES.filter(pa=>pa.hp<=0).length,
    onHull=spiders.filter(s=>s.state==='crawl'||s.state==='eat'||s.state==='windup').length;
  return bad>=3||broken>=1||looseCount()>=25||P.hp<50||onHull>=6;}
function maybeDrop(p){if(wave===0&&stats.kills<3)return;
  const late=wave>=5;if(dropsRound>=dropCap()||playT-lastDrop<(late?6:8))return;
  if(late&&playT-lastDrop>15&&inTrouble()){spawnDrop(p,pickPU());return;}
  const ch=(late?Math.min(0.26,0.18+0.015*(wave-5)):0.11)+Math.min(0.12,CB.hs*0.03)+(CB.n>=3?0.12:0);if(Math.random()>ch)return;spawnDrop(p,pickPU());}
function spawnDrop(p,k){pushOutOfShip(p,1.4,null);
  const g=new THREE.Group();g.position.copy(p);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:PU_HALO,color:new THREE.Color(PU_DEF[k].col).multiplyScalar(1.6),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.8}));halo.scale.setScalar(2.1);
  const icon=new THREE.Sprite(new THREE.SpriteMaterial({map:puTex(k),depthWrite:false,transparent:true}));icon.scale.setScalar(0.95);
  g.add(halo,icon);scene.add(g);DROPS.push({k,g,icon,halo,base:p.clone(),t:0,ph:Math.random()*6});dropsRound++;lastDrop=playT;sfx('drop',p);tutorialEvent('pu');say('pu_drop',2,{cd:60});}
function removeDrop(d){scene.remove(d.g);d.halo.material.dispose();d.icon.material.dispose();DROPS.splice(DROPS.indexOf(d),1);}
function updateDrops(dt,t){
  for(const d of [...DROPS]){d.t+=dt;const left=CFG.puLife-d.t;
    const dp=P.pos.distanceTo(d.g.position);if(dp<4.5&&state==='play')d.base.lerp(P.pos,Math.min(1,dt*1.2*(4.5-dp)/4.5)); // gentle pull when close
    d.g.position.copy(d.base).addScaledVector(UP,Math.sin(t*2+d.ph)*0.15);
    const pulse=1+Math.sin(t*5+d.ph)*0.08;d.icon.scale.setScalar(0.95*pulse);d.halo.scale.setScalar(2.1*pulse);d.icon.material.rotation=Math.sin(t*1.5+d.ph)*0.25;
    d.g.visible=left>4||((t*(left<1.5?14:7))|0)%2===0; // blinks before vanishing
    if(state==='play'&&dp<1.9){floatText(d.g.position.clone(),PU_DEF[d.k].name,'pu');removeDrop(d);applyPU(d.k);continue;}
    if(left<=0)removeDrop(d);}}
// ---- electric arcs for the hull discharge ----
const ZAPS=[];const zapMat=new THREE.LineBasicMaterial({color:new THREE.Color(1.6,3.6,5),transparent:true});
function zapArc(a,b){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(14*3),3));
  const l=new THREE.Line(g,zapMat.clone());l.frustumCulled=false;scene.add(l);ZAPS.push({l,a:a.clone(),b:b.clone(),life:0.55});}
function updateZaps(dt){for(const z of [...ZAPS]){z.life-=dt;const pa=z.l.geometry.attributes.position,L=z.a.distanceTo(z.b);
    for(let i=0;i<14;i++){const u=i/13;V1.lerpVectors(z.a,z.b,u);if(i&&i<13)V1.add(V2.randomDirection().multiplyScalar(L*0.06*Math.sin(u*Math.PI)+0.05));pa.setXYZ(i,V1.x,V1.y,V1.z);}
    pa.needsUpdate=true;z.l.material.opacity=Math.max(0,z.life/0.55)*(0.6+Math.random()*0.4);
    if(z.life<=0){scene.remove(z.l);z.l.geometry.dispose();z.l.material.dispose();ZAPS.splice(ZAPS.indexOf(z),1);}}}
function applyPU(k){if(k==='xp'){XP.streak=0;xpStart();return;}const D=PU_DEF[k];showMsg(D.name,D.sub,2.4);sfx('power');say('pu_'+k,3);
  if(k==='nuke'){const all=spiders.filter(s=>s.state==='crawl'||s.state==='eat'||s.state==='windup').sort((a,b)=>a.pos.z-b.pos.z);
    for(const s of all)if(s.kind==='spitter'){s.hp-=Math.ceil(s.maxHp*0.4);s.flash=1;}
    for(const e of [...INCS]){if(e.st==='dead'||e.st==='fall'||e.st==='gone')continue;e.hp-=Math.ceil(e.maxHp*0.4);e.flash=1;zapArc(P.pos,incCenter(e,new THREE.Vector3()));
      if(e.hp<=0)killInc(e,false);else if(e.st!=='fly'&&e.st!=='back'){incBeamSnd(false);e.hop=0;e.st='elec';e.t=0;e.B.play('Electrocuted',0.1);}}
    const tg=all.filter(s=>s.kind!=='spitter'||s.hp<=0);for(const s of all)if(s.kind==='spitter'&&s.hp>0)zapArc(P.pos,s.pos);
    let prev=P.pos.clone();for(const s of tg){zapArc(prev,s.pos);prev=s.pos.clone();}
    for(const s of tg)killSpider(s,false,true);
    addPts(PTS.nuke);sfx('zap');shake(0.3);flashLight.color.setHex(0x80e8ff);deathFlash(P.pos);setTimeout(()=>flashLight.color.setHex(0xff6030),400);
    const zf=$('zapFlash');zf.style.transition='none';zf.style.opacity=1;void zf.offsetWidth;zf.style.transition='';zf.style.opacity=0;
    if(tg.length)comboBanner('×'+tg.length,'arañas fritas · +'+ptsVal(PTS.nuke));}
  else if(k==='fix'){for(const pa of PATCHES)if(pa.hp<CFG.patchHp)repairPatch(pa,true,true);sfx('perfect');}
  else if(k==='over'){PU.over=20;bulletMat.color.setRGB(4,0.9,0.35);}
  else if(k==='dbl')PU.dbl=30;
  else if(k==='weld')PU.weld=20;
  else if(k==='pack')PU.pack=CFG.packT;
  else if(k==='mag'){let n=0;for(let i=0;i<DN;i++)if(dAlive[i]){dMag[i]=1;dCap[i]=0;n++;}MAG.on=n>0;MAG.t=0;MAG.got=0;}}
function updatePU(dt){
  if(state==='play'){if(PU.over>0){PU.over-=dt;if(PU.over<=0){PU.over=0;bulletMat.color.setRGB(3,2.2,0.9);}}if(PU.dbl>0)PU.dbl=Math.max(0,PU.dbl-dt);if(PU.weld>0)PU.weld=Math.max(0,PU.weld-dt);if(PU.pack>0)PU.pack=Math.max(0,PU.pack-dt);}$('cross').classList.toggle('over',PU.over>0);
  let h='';if(PU.over>0)h+=`<span style="color:${PU_DEF.over.col}">SOBRECARGA ${Math.ceil(PU.over)}</span>`;
  if(PU.dbl>0)h+=`<span style="color:${PU_DEF.dbl.col}">PUNTOS x2 ${Math.ceil(PU.dbl)}</span>`;
  if(PU.weld>0)h+=`<span style="color:${PU_DEF.weld.col}">SOLDADURA RÁPIDA ${Math.ceil(PU.weld)}</span>`;
  if(PU.pack>0)h+=`<span style="color:${PU_DEF.pack.col}">IMÁN ${Math.ceil(PU.pack)}</span>`;
  if(h!==updatePU.h){updatePU.h=h;$('pwr').innerHTML=h;}}
function escapeSpider(s){lostN+=s.loot;s.loot=0;burst(s.pos,0x5a0905,14);scene.remove(s.mesh);spiders.splice(spiders.indexOf(s),1);}
// who goes for the astronaut instead of the hull
function huntMode(s,dist,W){return s.kind==='brood'||(s.aggro||0)>0||(wave===0&&s.kind!=='lurker')||s.kind==='hunter'||(s.kind==='hunter'&&dist<W.range*1.1)||!PATCHES.some(p=>p.hp>0);}
function tryWindup(s,dist,W,dt,hunting){if(CINE.on)return;
  const lr=(s.aggro||0)>0?W.range*0.8:s.kind==='lurker'?6:s.kind==='flanker'?11:W.range;
  let leaping=0;for(const o of spiders)if(o.state==='leap'||o.state==='windup')leaping++;
  s.wait=(hunting&&dist>=W.range&&s.cd<=0&&dist<45)?(s.wait||0)+dt:0; // player hovering out of reach -> launch anyway after a moment
  s.hopTo=null;if(s.wait>1.2&&s.kind!=='spitter'){for(const R of ROCKS){if(R.fade<1||R.leaving)continue;const dp=R.c.distanceTo(P.pos),ds=R.c.distanceTo(s.pos);if(dp<16&&ds<26&&dp<dist-4){_rk.subVectors(s.pos,R.c).normalize();s.hopTo=R.c.clone().addScaledVector(_rk,rockR(R,_rk)*0.9);break;}}}
  if(state==='play'&&s.cd<=0&&leaping<W.maxLeap&&((dist<lr&&Math.random()<s.aggr*dt*6)||s.wait>2+Math.random()*2)){s.wait=0;if(shipBetween(s.pos,P.pos)){s.aggro=Math.max(s.aggro||0,2);return;}
    // telegraph: crouch, eyes flare, chitter -> then leap
    s.state='windup';s.t=0;s.windT=Math.max(0.35,0.62-wave*0.03);sfx('chitter',s.pos);if(dist<30)tutorialEvent('windup');}}
function launchLeap(s){const W=waveDef(wave);
  const lead=s.hopTo?s.hopTo.clone():P.pos.clone().addScaledVector(P.vel,0.35).add(new THREE.Vector3().randomDirection().multiplyScalar(0.4));
  s.state='leap';s.vel.subVectors(lead,s.pos).normalize().multiplyScalar(CFG.leapSpeed*(0.85+W.spd*0.15));s.t=0;s.leapMax=s.pos.distanceTo(P.pos)/s.vel.length()+1.5;
  const n0=new THREE.Vector3();hullPoint(s.z,s.th,V3,n0);s.pos.addScaledVector(n0,0.5);sfx('leap',s.pos);
  const u=s.mesh.userData;if(!u.rig){u.body.position.y=0;u.body.rotation.x=0;u.mEye.color.setHex(u.S.eye);}}
const UP=new THREE.Vector3(0,1,0),M4=new THREE.Matrix4();
function orient(obj,fwd,up){const r=new THREE.Vector3().crossVectors(up,fwd).normalize();const u=new THREE.Vector3().crossVectors(fwd,r).normalize();
  M4.makeBasis(r,u,fwd);obj.quaternion.setFromRotationMatrix(M4);}
function updateSpider(s,dt,t){
  if(s.idleT>0&&(s.state==='crawl'||s.state==='windup')){s.idleT-=dt;s.idle0=(s.idle0||0)+dt;
    if(s.idle0>0.35&&s.state!=='windup'){s.state='windup';s.t=0;s.windT=0.4;sfx('roar',s.pos);}if(s.state==='windup')s.t+=dt;
    s.moving=false;{const U=s.mesh.userData;s.mesh.position.copy(s.pos).addScaledVector(V1.set(0,1,0).applyQuaternion(s.mesh.quaternion),U.rig?U.rig.spd.rootOff*s.mesh.scale.x:0.28);}s.cd=Math.max(s.cd,0.6);if(s.idleT<=0){s.state='crawl';s.t=0;s.idle0=0;}
    if(s.mesh.userData.rig)animSpider(s,dt,t);return;}
  s.t+=dt;s.cd-=dt;s.flash=Math.max(0,s.flash-dt*5);s.aggro=Math.max(0,(s.aggro||0)-dt);
  if(s.kind!=='spitter'&&(s.state==='crawl'||s.state==='eat')&&s.pos.distanceTo(P.pos)<6.5&&state==='play'){if(!(s.aggro>0))s.cd=Math.min(s.cd,0.4);s.aggro=Math.max(s.aggro,3);}
  if(s.aggro>0&&s.patch){s.patch=null;if(s.state==='eat')s.state='crawl';}
  const toP=V1.subVectors(P.pos,s.pos);const dist=toP.length();const U=s.mesh.userData;
  if(s.state==='crawl'){
    const W=waveDef(wave);const [a,b]=hullAB(s.z);const rr=(a+b)/2;
    let gz,gth;
    if(s.kind!=='thief'&&s.kind!=='spitter'&&s.kind!=='hunter'&&s.kind!=='brood'&&!(s.aggro>0)&&(wave>0||s.kind==='lurker')&&(!s.patch||s.patch.hp<=0))s.patch=eatSlotFree(s)?pickPatch(s):null; // only a few may chew at once; the rest hunt you
    if(s.kind==='spitter'){ // you near the ship -> it hunts you · you far away -> it bites big holes until you come back
      if(dist>(s.patch?22:27)&&!(s.aggro>0)&&state==='play'){if(!s.patch||s.patch.hp<=0)s.patch=pickPatch(s);}else s.patch=null;}
    const hunting=s.kind!=='thief'&&(huntMode(s,dist,W)||!s.patch);
    if(s.kind==='thief'){
      gz=s.wz;gth=s.wth;s.wt-=dt;if(s.wt<=0){s.wz=THREE.MathUtils.randFloat(-12,18);s.wth=Math.PI/2+THREE.MathUtils.randFloatSpread(2.4);s.wt=3;}}
    else if(!hunting){ // head for a hull patch and chew it open
      gz=s.patch.z+s.eo[0];gth=s.patch.th+s.eo[1];}
    else{const tp=hullParam(P.pos);
      // slot oscillates around the side facing the player (never wraps to the far side)
      const off=THREE.MathUtils.clamp(s.slotTh,-0.9,0.9)*Math.sin(t*Math.abs(s.orbit)*(s.kind==='flanker'?2:1)+s.slotZ);
      // out of jumping range -> head straight under the player
      const shrink=dist>W.range*0.8?0.15:(s.kind==='hunter'?THREE.MathUtils.clamp(dist/12,0.25,1):1);
      gz=tp.z+s.slotZ*shrink;gth=tp.th+off*shrink;
      if(s.kind==='spitter'){gz=tp.z+s.slotZ*0.35;gth=tp.th+s.slotTh*0.5;}} // the spitter crawls right up under you
    {const pad=s.mesh.scale.x>1.3?2:1;s.pathT=(s.pathT||0)-dt;
     if(s.pathT<=0){s.pathT=0.45+Math.random()*0.2;s.wp=hullLineFree(s.z,s.th,gz,gth,pad)?null:(hullPath(s.z,s.th,gz,gth,pad)||hullPath(s.z,s.th,gz,gth,0));}
     if(s.wp){if(Math.hypot(s.wp[0]-s.z,Math.atan2(Math.sin(s.wp[1]-s.th),Math.cos(s.wp[1]-s.th))*rr)<0.3)s.pathT=0;else{gz=s.wp[0];gth=s.wp[1];}}}
    let dth=Math.atan2(Math.sin(gth-s.th),Math.cos(gth-s.th));let mz=gz-s.z,mt=dth*rr;const ml=Math.hypot(mz,mt);
    if(ml>0.001){mz/=ml;mt/=ml;}else{mz=mt=0;}
    if(ml<0.6){mz*=ml/0.6;mt*=ml/0.6;}
    // separation from other crawling spiders
    let sz=0,st2=0;for(const o of spiders){if(o===s||o.state!=='crawl')continue;const d=o.pos.distanceTo(s.pos);if(d<2.6&&d>0.001){
      const oz=s.z-o.z,ot=Math.atan2(Math.sin(s.th-o.th),Math.cos(s.th-o.th))*rr;const l=Math.hypot(oz,ot)||0.01;const w=(2.6-d)/2.6;sz+=oz/l*w;st2+=ot/l*w;}}
    mz+=sz*1.8;mt+=st2*1.8;const ll=Math.hypot(mz,mt);if(ll>1){mz/=ll;mt/=ll;}
    // a little skitter so they never move in lockstep
    mz+=Math.sin(t*3.1+s.orbit*40)*0.15;mt+=Math.cos(t*2.3+s.slotZ*7)*0.15;
    const step=CFG.crawlSpeed*W.spd*s.spd*dt*(s.loot>0?0.6:1)*(CINE.on?0.3:1); // loaded thieves are slower
    {const pad=s.mesh.scale.x>1.3?2:1,nz=THREE.MathUtils.clamp(s.z+mz*step,-14.5,21.5),nt=s.th+mt*step/rr;
     if(!hullBlocked(nz,nt,pad)){s.z=nz;s.th=nt;}
     else if(!hullBlocked(nz,s.th,pad))s.z=nz;
     else if(!hullBlocked(s.z,nt,pad))s.th=nt;
     else{const f=freeSpot(s.z,s.th,pad);s.z=f[0];s.th=f[1];}
     if(hullBlocked(nz,nt,pad)){s.slotTh=-s.slotTh;s.orbit=-s.orbit;}}
    const n=new THREE.Vector3();const prev=s.pos.clone();hullPoint(s.z,s.th,s.pos,n);
    const mv=s.pos.clone().sub(prev);if(mv.lengthSq()>1e-8){mv.normalize();s.face=(s.face||mv.clone()).lerp(mv,Math.min(1,dt*8)).normalize();orient(s.mesh,s.face,n);}
    s.mesh.position.copy(s.pos).addScaledVector(n,U.rig?U.rig.spd.rootOff*s.mesh.scale.x:0.28);s.moving=mv.lengthSq()>0;
    // watchdog: a crawler that has not really moved for 5 s skitters a couple of metres along its path
    s.stillP=s.stillP||s.pos.clone();if(s.pos.distanceTo(s.stillP)>0.6){s.stillP.copy(s.pos);s.stillT=0;}else s.stillT=(s.stillT||0)+dt;
    if(s.stillT>5){s.stillT=0;const pad=s.mesh.scale.x>1.3?2:1,tp=hullParam(P.pos),w=hullPath(s.z,s.th,tp.z,tp.th,pad,12)||hullPath(s.z,s.th,tp.z,tp.th,0,12)||freeSpot(s.z,s.th,pad+1);s.z=w[0];s.th=w[1];s.pathT=0;s.aggro=Math.max(s.aggro||0,4);}
    if(!hunting&&s.patch&&!s.wp&&ml<0.45&&state==='play'){s.state='eat';s.t=0;if(s.kind==='spitter'&&!s.ateMsg){s.ateMsg=1;showMsg('¡LA ESCUPIDORA MUERDE LA NAVE!','Si no vas a por ella, abre agujeros enormes',2.6);}}
    if(s.kind==='spitter')spitterAim(s,dist);else if(s.kind!=='thief')tryWindup(s,dist,W,dt,hunting);
  }else if(s.state==='eat'){
    const W=waveDef(wave),pa=s.patch;
    if(!pa||pa.hp<=0||state!=='play'){s.state='crawl';s.patch=null;if(!U.rig){U.body.rotation.x=0;U.body.position.y=0;}}
    else{const n=new THREE.Vector3();hullPoint(s.z,s.th,s.pos,n);
      const fw=V2.subVectors(pa.pos,s.pos).addScaledVector(n,-V2.dot(n));if(fw.lengthSq()>0.01){fw.normalize();s.face=(s.face||fw.clone()).lerp(fw,Math.min(1,dt*6)).normalize();}
      if(s.face)orient(s.mesh,s.face,n);
      s.mesh.position.copy(s.pos).addScaledVector(n,U.rig?U.rig.spd.rootOff*s.mesh.scale.x:0.22);
      if(!U.rig){U.body.position.y=-0.07;U.body.rotation.x=0.3+Math.sin(t*15+s.orbit*9)*0.14;} // head down, chewing
      damagePatch(pa,W.eat*EAT[s.kind]*dt);pa.zone.eaters++;pa.zone.bite=pa;
      s.chewT-=dt;if(s.chewT<=0){s.chewT=0.22+Math.random()*0.2;burst(V3.copy(pa.pos).addScaledVector(n,0.25),0xffc050,2);sfx('chew',s.pos);}
      s.moving=false;if(s.kind==='spitter'){if(dist<22){s.state='crawl';s.patch=null;}else spitterAim(s,dist);}else tryWindup(s,dist,W,dt,huntMode(s,dist,W));}
  }else if(s.state==='windup'){
    const n=new THREE.Vector3();hullPoint(s.z,s.th,V3,n);const fw=V2.copy(toP).addScaledVector(n,-toP.dot(n)).normalize();
    if(fw.lengthSq()>0.5)orient(s.mesh,fw,n);
    const k=Math.min(1,s.t/s.windT);if(!U.rig){U.body.position.y=-0.13*k;U.body.rotation.x=-0.22*k+Math.sin(t*60)*0.03*k;U.mEye.color.setHex(U.S.eye).lerp(WHITE,k);}
    if(s.t>=s.windT){if(s.kind==='spitter'&&s.atk!=='pounce')spitAcid(s);else{launchLeap(s);if(s.kind==='spitter')s.cd=THREE.MathUtils.randFloat(2,3.2);}}
  }else if(s.state==='steal'){
    const to=V2.subVectors(s.target,s.pos);const d=to.length();
    s.vel.lerp(to.normalize().multiplyScalar(8),Math.min(1,dt*3));s.pos.addScaledVector(s.vel,dt);s.mesh.position.copy(s.pos);
    if(s.vel.lengthSq()>0.01)orient(s.mesh,V3.copy(s.vel).normalize(),UP);
    if(d<1.3||s.t>5){let got=0;const R2=2.6*2.6;
      for(let i=0;i<DN&&got<22;i++){if(!dAlive[i])continue;const j=i*3,dx=dPos[j]-s.pos.x,dy=dPos[j+1]-s.pos.y,dz=dPos[j+2]-s.pos.z;
        if(dx*dx+dy*dy+dz*dz<R2){dAlive[i]=0;dCap[i]=0;dPos[j+1]=-9999;got++;}}
      s.loot+=got;if(got){sfx('grab',s.pos);floatText(s.pos,'−'+got,'loss');}s.state='return';s.t=0;}
  }else if(s.state==='leap'||s.state==='drift'){
    if(s.state==='leap'&&!s.hopTo){s.vel.lerp(V2.copy(toP).normalize().multiplyScalar(s.vel.length()),Math.min(1,dt*1.6));
      if(dist<(s.kind==='spitter'?2.1:1.15)){damagePlayer(waveDef(wave).bite*(s.kind==='spitter'?1.5+0.15*((s.gen||1)-1):s.kind==='brood'?0.4:1),toP);s.state='drift';s.t=0;s.vel.copy(toP).normalize().multiplyScalar(-5).add(new THREE.Vector3().randomDirection().multiplyScalar(3));}
      if(s.t>(s.leapMax||2.5)){s.state='drift';s.t=0;}}
    else{s.vel.multiplyScalar(1-dt*1.5);if(s.t>0.5){s.state='return';s.t=0;}}
    if(wingRay(s.pos,V2.copy(s.vel).multiplyScalar(dt))>=0){s.vel.multiplyScalar(-0.35);if(s.state==='leap'){s.state='drift';s.t=0;}}
    s.pos.addScaledVector(s.vel,dt);s.mesh.position.copy(s.pos);
    if(s.kind!=='spitter'){const RK=rockAt(s.pos,0.15*s.mesh.scale.x);if(RK){landOnRock(s,RK);return;}}else pushOutOfRocks(s.pos,0.6*s.mesh.scale.x,s.vel);
    if(s.vel.lengthSq()>0.01)orient(s.mesh,V2.copy(s.vel).normalize(),UP);
    if(pushOutOfShip(s.pos,0.3,s.vel)&&!(s.state==='leap'&&s.t<0.6)){const hp=hullParam(s.pos);[s.z,s.th]=freeSpot(hp.z,hp.th,s.mesh.scale.x>1.3?2:1);s.state='crawl';const W=waveDef(wave);s.cd=THREE.MathUtils.randFloat(W.cd[0],W.cd[1]);}
  }else if(s.state==='perch'){ // walking out on a wing (opening scene); pounces at you once the game starts
    const q=s.perch,d=V2.set(q.dx,0,q.dz).normalize(),stp=0.75*dt;let nx=q.x+d.x*stp,nz=q.z+d.z*stp;
    if(wingTop(nx,nz)===null||Math.abs(nx)<4.4||Math.abs(nx)>7.3){q.dx=-q.dx;q.dz=-q.dz;nx=q.x;nz=q.z;}
    q.x=nx;q.z=nz;s.pos.set(q.x,wingTop(q.x,q.z)??0.4,q.z);orient(s.mesh,V2.set(q.dx,0,q.dz).normalize(),UP);
    s.mesh.position.copy(s.pos).addScaledVector(UP,U.rig?U.rig.spd.rootOff*s.mesh.scale.x:0.28);s.moving=true;
    if(state==='play'&&!CINE.on){s.perchT-=dt;
      if((s.perchT<=0||dist<9)&&!shipBetween(s.pos,P.pos)){const lead=P.pos.clone().addScaledVector(P.vel,0.35);
        s.state='leap';s.t=0;s.vel.subVectors(lead,s.pos).normalize().multiplyScalar(CFG.leapSpeed);s.leapMax=dist/CFG.leapSpeed+1.5;sfx('chitter',s.pos);sfx('leap',s.pos);}
      else if(s.perchT<-6){s.state='return';s.t=0;}}
  }else if(s.state==='fall'){if(!(CINE.on&&CINE.mode==='boss'&&CINE.boss===s&&CINE.t<0.35))updateFall(s,dt);
  }else if(s.state==='return'){
    // no swimming in vacuum: shoot a silk line at the nearest walkable hull spot, then reel in along it (faster and faster)
    if(!s.silk){const hp=hullParam(s.pos);[hp.z,hp.th]=freeSpot(hp.z,hp.th,s.mesh.scale.x>1.3?2:1);s.silk={a:hullPoint(hp.z,hp.th,new THREE.Vector3()),z:hp.z,th:hp.th,v:1.5,t:0};silkOn(s);sfx('silk',s.pos);}
    const SK=s.silk;SK.t+=dt;const d=V3.subVectors(SK.a,s.pos),L=d.length();
    if(L<0.4){s.z=SK.z;s.th=SK.th;s.state='crawl';const W=waveDef(wave);s.cd=THREE.MathUtils.randFloat(W.cd[0],W.cd[1]);s.slotTh+=THREE.MathUtils.randFloatSpread(1.5);s.silk=null;}
    else{if(SK.t>0.16)SK.v=Math.min(s.kind==='spitter'?14:19,SK.v+(s.kind==='spitter'?11:17)*dt);else SK.v*=Math.exp(-3*dt);
      s.pos.addScaledVector(d.normalize(),Math.min(L,SK.v*dt));s.mesh.position.copy(s.pos);orient(s.mesh,d,UP);
      if(s.kind!=='spitter'&&!(s.t<0.5)){const RK=rockAt(s.pos,0.15*s.mesh.scale.x);if(RK){s.silk=null;landOnRock(s,RK);}}}
  }else if(s.state==='rock'){ // clinging to an asteroid: crawls round to the side facing you, crouches and pounces again
    const RK=s.rock,want=V2.subVectors(P.pos,RK.c).normalize(),prev=V3.copy(s.rd),ang=s.rd.angleTo(want);
    if(ang>0.08){const ax=new THREE.Vector3().crossVectors(s.rd,want);if(ax.lengthSq()>1e-8)s.rd.applyAxisAngle(ax.normalize(),Math.min(ang,CFG.crawlSpeed*0.7*s.spd*dt/RK.r));}
    s.pos.copy(RK.c).addScaledVector(s.rd,rockR(RK,s.rd));const n=s.rd;
    let face=V1.subVectors(s.rd,prev);if(face.lengthSq()<1e-9)face.copy(want);face.addScaledVector(n,-face.dot(n));if(face.lengthSq()<1e-8)face.set(1,0,0).addScaledVector(n,-n.x);face.normalize();
    s.face=(s.face||face.clone()).lerp(face,Math.min(1,dt*6)).normalize();orient(s.mesh,s.face,n);
    s.mesh.position.copy(s.pos).addScaledVector(n,U.rig?U.rig.spd.rootOff*s.mesh.scale.x:0.28);s.moving=ang>0.08;
    if(state==='play'&&!CINE.on){s.rockT+=dt;
      if(s.cd<=0&&dist<34&&!shipBetween(s.pos,P.pos)){s.rw+=dt;if(s.rw>0.45){s.rw=0;const lead=P.pos.clone().addScaledVector(P.vel,0.3);
          s.state='leap';s.t=0;s.vel.subVectors(lead,s.pos).normalize().multiplyScalar(CFG.leapSpeed*1.05);s.leapMax=dist/CFG.leapSpeed+1.5;s.pos.addScaledVector(n,0.5*s.mesh.scale.x);sfx('leap',s.pos);}}
      else if(s.rockT>9&&dist>30){s.state='return';s.t=0;s.pos.addScaledVector(n,0.8);}}}
  if(U.rig){animSpider(s,dt,t);
  if(U.sack){const tg=s.loot>0?0.55+Math.min(1,s.loot/22)*0.6:0.001;U.sack.scale.setScalar(THREE.MathUtils.damp(U.sack.scale.x,tg,8,dt));}}
  else{
  // legs
  const {legs,body}=U;const sp=s.state==='crawl'?(s.moving?14:3):s.state==='windup'?22:s.state==='eat'?9:6;
  for(const L of legs){const w=Math.sin(t*sp+L.ph);L.up.rotation.x=-0.7+w*0.28;L.hip.rotation.z=w*0.1;L.lo.rotation.x=(s.state==='crawl'||s.state==='windup'||s.state==='eat'?1.5:0.6)+Math.cos(t*sp+L.ph)*0.2;}
  U.mBody.emissive.setRGB(0.16+s.flash*0.85,s.flash*0.35,0);
  if(U.sack){const tg=s.loot>0?0.55+Math.min(1,s.loot/22)*0.6:0.001;U.sack.scale.setScalar(THREE.MathUtils.damp(U.sack.scale.x,tg,8,dt));}
  body.scale.setScalar(1+s.flash*0.25);}
  if(s.kick){s.mesh.position.add(s.kick);s.kick.multiplyScalar(Math.exp(-14*dt));}}

