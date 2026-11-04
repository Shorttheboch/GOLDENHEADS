/* ================= v84: TRAILER MODE (?trailer, PC keyboard only) ================= */
// For recording the launch reel (OBS). Only with ?trailer in the address (TRAILER, 01-config.js); it combines with ?ronda=N, ?xp, ?huevo, ?fps, ?q=N...
// Without it nothing in this piece runs: no listeners, no DOM, no CSS class (12-trailer.css hangs everything from body.trailer / trNoHud / trV / trFree / trPlay).
// What the mode turns off: metrics (39-metricas.js: nothing is sent, no question on the menu), the online ranking (26-ranking.js: RANK.on=false, so no save
// reminder either), the local record (25-end-plate.js), the menu music and the game music (M still switches the game music on and off).
// Keys (one each, only while playing, never while typing; the help panel, H, lists them; TRK below is the table):
//   1 invincible astronaut · 2 ship takes no damage (bites still happen: animation, sparks, sounds) · 3 hide / show every HUD element and message
//   4 slow motion 1x > 1/2x > 1/4x · 5 freeze the world (the free camera still flies) · 6 free camera (WASD, Space / C, Shift fast, Z very slow, wheel speed,
//   , . zoom, mouse or arrows to look) · 7 EXTRA POWER with its pose · 8 cargo to full · 9 break a hull plate · 0 hold the round (no spawns, no round advance)
//   U spider · I swarm · O Escupidora · P Incineradora · J egg · K crías (in front of you, on the hull) · L clear every enemy · T bosses / egg with their scene · H help
// World time: slow motion and the freeze patch clock.getDelta() (the loop's only clock, 31-loop.js), so everything that runs on dt and t slows or stops together:
// spiders, bosses, particles, the EXTRA POWER pose, the egg scene, timers. The free camera runs on real time (performance.now).
// Vertical (?trailer&vertical[&escala=2]): fixed picture size in trResize (02-renderer.js), camera numbers in TRV (01-config.js, used by 31-loop.js).
const TRK=[ // code, key shown, label (Spanish: the i18n translates it), switch shown in the panel
  ['Digit1','1','INVENCIBLE','god'],['Digit2','2','NAVE SIN DAÑOS','ship'],['Digit3','3','OCULTAR HUD','nohud'],['Digit4','4','CÁMARA LENTA','slow'],
  ['Digit5','5','CONGELAR EL MUNDO','pause'],['Digit6','6','CÁMARA LIBRE','fc'],['Digit7','7','EXTRA POWER',''],['Digit8','8','CARGA LLENA',''],
  ['Digit9','9','ROMPER UNA PLACA',''],['Digit0','0','RETENER LA RONDA','hold'],
  ['KeyU','U','ARAÑA',''],['KeyI','I','OLEADA DE ARAÑAS',''],['KeyO','O','ESCUPIDORA',''],['KeyP','P','INCINERADORA',''],['KeyJ','J','HUEVO',''],['KeyK','K','CRÍAS',''],
  ['KeyL','L','BORRAR ENEMIGOS',''],['KeyT','T','CON CINEMÁTICA','cine'],['KeyH','H','AYUDA','']];
const TRK_FC=[['WASD','MOVER'],['ESPACIO / C','SUBIR / BAJAR'],['SHIFT','RÁPIDO'],['Z','MUY LENTO'],['RUEDA','VELOCIDAD'],[', .','ZOOM'],['RATÓN / FLECHAS','MIRAR']];
const TRS={1:'1×',0.5:'½×',0.25:'¼×'}; // slow-motion labels (no letters: the same in both languages)
const TRQ=[];   // spawns waiting for a model still downloading: [late key, function]
const FC={p:new THREE.Vector3(),v:new THREE.Vector3(),yaw:0,pit:0,ty:0,tp:0,fov:62,base:2.5,k:{},last:0,drag:false};
const _tr1=new THREE.Vector3(),_tr2=new THREE.Vector3(),_tr3=new THREE.Vector3();
const TRUI={help:null,toast:null,toastEnd:0,play:false};
const FC_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','Space','KeyC','ShiftLeft','ShiftRight','KeyZ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Comma','Period']);
const FC_PASS=new Set(['KeyM','KeyV','Enter','NumpadEnter','Escape']); // free camera on: these still reach the game; any other game key is kept from it (the astronaut stands still)

// ---- world time: the loop's clock returns the scaled time (1 / 0.5 / 0.25, or ~0 frozen: 1e-4 a frame, like the egg scene) and keeps its elapsed time on it ----
if(TRAILER){const gd=clock.getDelta.bind(clock);
  clock.getDelta=function(){const d=gd();const w=TRA.pause?Math.min(d,1e-4):d*TRA.slow;this.elapsedTime+=w-d;return w;};}

// ---- the hull spot in front of you: where the view meets the hull, or else the hull under a point 6 m ahead of the astronaut ----
function trSpot(){const o=camera.position,d=_tr1.set(0,0,-1).applyQuaternion(camera.quaternion);let hit=null;
  for(let s=0.4;s<60;s+=0.2){const p=_tr2.copy(o).addScaledVector(d,s);if(p.z<=-14.5||p.z>=21.5)continue;const [a,b,c]=hullAB(p.z);if((p.x/a)**2+((p.y-c)/b)**2<=1){hit=p;break;}}
  if(!hit){const cp=Math.cos(P.pitch);hit=_tr2.copy(P.pos).add(_tr3.set(-Math.sin(P.yaw)*cp,0,-Math.cos(P.yaw)*cp).multiplyScalar(6));}
  const hp=hullParam(hit);return [hp.z,hp.th];}
function trSpider(kind,z,th,pad){const s=spawnSpider(kind),f=freeSpot(THREE.MathUtils.clamp(z,-14.5,21.5),th,pad??spPad(s));
  s.z=f[0];s.th=f[1];s.wz=s.z;s.wth=s.th;hullPoint(s.z,s.th,s.pos);s.state='crawl';s.t=0;s.patch=null;s.cd=0.6+Math.random()*1.2;s.mesh.position.copy(s.pos);return s;}
const TR_MAX=60; // never more spiders than this at once (the game's own rounds stay well under it)
function trWait(k,fn){if(lateOk(k)){fn();return;}if(!TRQ.some(q=>q[1]===fn))TRQ.push([k,fn]);trToast('CARGANDO MODELO…');}
// one spider · a swarm of 14 around the spot
function trOne(){if(spiders.length>=TR_MAX)return;const [z,th]=trSpot();trSpider('hunter',z,th);trToast('ARAÑA');}
function trSwarm(){const [z,th]=trSpot(),K=['hunter','hunter','flanker','lurker'],n=Math.min(14,TR_MAX-spiders.length);
  for(let k=0;k<n;k++)trSpider(K[k%K.length],z+THREE.MathUtils.randFloatSpread(6),th+THREE.MathUtils.randFloatSpread(1.1));trToast('OLEADA DE ARAÑAS');}
// the bosses fall from the sky onto the spot (their usual entrance); with T on and no other scene running, they come with their first-time scene (and its own spot)
function trSpitter(){trWait('crab',()=>{TRA.at=trSpot();try{spawnSpitter(TRA.cine&&!CINE.on);}finally{TRA.at=null;}trToast('ESCUPIDORA');});}
function trInc(){trWait('bip',()=>{TRA.at=trSpot();let e=null;try{e=spawnInc(TRA.cine&&!CINE.on);}finally{TRA.at=null;}trToast(e?'INCINERADORA':'NO DISPONIBLE');});}
function trEgg(){trWait('egg',()=>{const [z,th]=trSpot();TRA.egc=TRA.cine;try{layEgg(z,th,null,null,null);}finally{TRA.egc=null;}trToast('HUEVO');});}
// a brood, as an egg hatches (13-spiders.js hatchEgg): 8 crías in a ring
function trBrood(){const [z,th]=trSpot(),n=Math.min(8,TR_MAX-spiders.length),hp=1+Math.floor(Math.max(0,wave-6)/5),c=hullPoint(z,th,new THREE.Vector3());
  for(let k=0;k<3;k++)burst(c,k?0x6a0606:0xff5020,24);sfx('crack',c);sfx('splat',c);
  for(let k=0;k<n;k++){const a=k/n*Math.PI*2,s=trSpider('brood',z+Math.cos(a)*0.9,th+Math.sin(a)*0.25,0);s.hp=hp;s.cd=0.3+Math.random()*1.2;s.aggr=1;}trToast('CRÍAS');}
// every enemy goes, quietly: no points, no drops, no banners (the round itself carries on: with 0 on it does not advance)
function trClear(){const stopFall=F=>{if(F&&F.snd){try{F.snd.g.gain.setTargetAtTime(0,AC.currentTime,0.03);F.snd.s.stop(AC.currentTime+0.2);}catch(_){}}};
  if(CINE.on&&CINE.mode==='boss'){for(const sh of shards)sh.visible=true;CINE.on=false;CINE.mode='';CINE.camN=null;CINE.boss=null;CINE.fov=0;document.body.classList.remove('cine');}
  if(CINE.on&&CINE.mode==='egg')eggCineEnd();
  for(const s of spiders){s.silk=null;stopFall(s.fall);scene.remove(s.mesh);}spiders.length=0;
  for(const e of INCS){stopFall(e.fall);scene.remove(e.B.g);e.st='gone';}INCS.length=0;incBeamSnd(false);
  for(const e of EGGS)scene.remove(e.g);EGGS.length=0;
  for(const a of ACID){scene.remove(a.m);for(const q of a.drops)scene.remove(q.d);}ACID.length=0;
  FALLFX.trail.visible=false;updateBoss.who=null;trToast('BORRAR ENEMIGOS');}
// EXTRA POWER with its whole pose, as often as wanted (if it is already on, it ends quietly first so the pose plays again)
function trXP(){trWait('gun2',()=>{if(!XP.g2){trToast('NO DISPONIBLE');return;}if(XP.on)xpEnd(true);XP.streak=XP.need;xpPips();xpStart();trToast('EXTRA POWER');});}
function trCargo(){cargo=CFG.cargo;CB_.warned=0;if(TRA.ship)TRA.c0=cargo;trToast('CARGA LLENA');}
// a hull plate breaks: the nearest intact one in view (facing the lens), else the nearest one; it goes through even with 2 on (that is what it is for)
function trBreak(){let best=null,bd=1e9,any=null,ad=1e9;
  for(const pa of PATCHES){if(pa.hp<=0)continue;const d=pa.pos.distanceTo(P.pos);if(d<ad){ad=d;any=pa;}
    _tr1.copy(pa.pos).project(camera);if(_tr1.z<1&&Math.abs(_tr1.x)<0.92&&Math.abs(_tr1.y)<0.92&&_tr2.subVectors(camera.position,pa.pos).dot(pa.n)>0&&d<bd){bd=d;best=pa;}}
  const pa=best||any;if(!pa){trToast('NO QUEDAN PLACAS');return;}
  TRA.brk=true;try{damagePatch(pa,pa.hp+1);}finally{TRA.brk=false;}trToast('ROMPER UNA PLACA');}

// ---- the switches ----
function trSet(k,v){TRA[k]=v;
  if(k==='god'&&v){P.hp=CFG.hpMax;P.burn=0;}
  if(k==='ship'&&v){TRA.c0=Math.max(50,cargo);if(cargo<TRA.c0)cargo=TRA.c0;}
  if(k==='hud')document.body.classList.toggle('trNoHud',!v);
  if(k==='fc')trFree(v);
  trPanel();}
function trFree(on){
  if(on){FC.p.copy(camera.position);const d=_tr1.set(0,0,-1).applyQuaternion(camera.quaternion);FC.yaw=FC.ty=Math.atan2(-d.x,-d.z);FC.pit=FC.tp=Math.asin(THREE.MathUtils.clamp(d.y,-1,1));
    FC.fov=camera.fov;FC.v.set(0,0,0);FC.k={};FC.drag=false;FC.last=performance.now();
    for(const c of FC_KEYS)keys[c]=false;for(const c of ['KeyE','KeyF','KeyQ','KeyR','ControlLeft'])keys[c]=false;inp.fire=inp.suck=false;dashReq=false;} // the astronaut lets go of everything
  else camera.rotation.order='XYZ';
  document.body.classList.toggle('trFree',on);}
// the free camera: called by the loop (31-loop.js) right after the follow camera, and again just before the frame is drawn (trFrame: no shake on it)
function trCam(){const now=performance.now(),rd=Math.min(0.1,Math.max(0,(now-FC.last)/1000));FC.last=now;const K=FC.k;
  FC.ty+=((K.ArrowLeft?1:0)-(K.ArrowRight?1:0))*1.1*rd;FC.tp+=((K.ArrowUp?1:0)-(K.ArrowDown?1:0))*0.9*rd;FC.tp=THREE.MathUtils.clamp(FC.tp,-1.52,1.52);
  const kl=1-Math.exp(-16*rd);FC.yaw+=(FC.ty-FC.yaw)*kl;FC.pit+=(FC.tp-FC.pit)*kl; // a touch of smoothing on the look, so hand moves read as camera moves
  const cp=Math.cos(FC.pit),f=_tr1.set(-Math.sin(FC.yaw)*cp,Math.sin(FC.pit),-Math.cos(FC.yaw)*cp),r=_tr2.set(Math.cos(FC.yaw),0,-Math.sin(FC.yaw));
  const w=_tr3.set(0,0,0).addScaledVector(f,(K.KeyW?1:0)-(K.KeyS?1:0)).addScaledVector(r,(K.KeyD?1:0)-(K.KeyA?1:0)).addScaledVector(UP,(K.Space?1:0)-(K.KeyC?1:0));
  if(w.lengthSq()>1)w.normalize();w.multiplyScalar(FC.base*(K.ShiftLeft||K.ShiftRight?4:1)*(K.KeyZ?0.25:1));
  FC.v.lerp(w,1-Math.exp(-7*rd));FC.p.addScaledVector(FC.v,rd);
  camera.position.copy(FC.p);camera.rotation.set(FC.pit,FC.yaw,0,'YXZ');
  if(Math.abs(camera.fov-FC.fov)>0.01){camera.fov=FC.fov;camera.updateProjectionMatrix();}}

// ---- every frame: first thing (trPre, before the clock) and just before the frame is drawn (trFrame) ----
function trPre(){
  if(state==='play'){
    if(TRA.god){P.hp=CFG.hpMax;P.burn=0;} // the laser and the burns take a little every frame: never enough to matter
    if(TRA.ship){if(cargo<TRA.c0)cargo=TRA.c0;else TRA.c0=cargo;} // leaks still fly out of a broken plate, the cargo on board does not go down
    for(let i=TRQ.length-1;i>=0;i--)if(lateOk(TRQ[i][0])){const fn=TRQ[i][1];TRQ.splice(i,1);fn();}}
  else if(TRQ.length)TRQ.length=0;}
function trFrame(){const B=document.body,play=state==='play';
  if(TRA.fc){if(play)camera.position.copy(FC.p);else trSet('fc',false);}
  if(play!==TRUI.play){TRUI.play=play;B.classList.toggle('trPlay',play); // the cursor hides while playing
    if(!play&&(TRA.pause||TRA.slow!==1)){TRA.pause=false;TRA.slow=1;trPanel();}} // the game is over: the world runs at its own pace again
  if(!TRA.hud)for(const s of spiders){const m=s.mesh.userData.mark;if(m)m.visible=false;} // the red "last spiders" sign above them is a 3D sprite, not DOM
  if(TRUI.toastEnd&&performance.now()>TRUI.toastEnd){TRUI.toastEnd=0;TRUI.toast.classList.remove('on');}}

// ---- keys (capture phase: they are seen before the game's own handlers) ----
function trKey(e){if(e.target&&e.target.tagName==='INPUT'||document.body.classList.contains('acctOn'))return;
  const play=state==='play',free=TRA.fc&&play,mod=e.ctrlKey||e.altKey||e.metaKey;
  if(free&&!mod){
    if(FC_KEYS.has(e.code)){FC.k[e.code]=true;e.preventDefault();e.stopImmediatePropagation();
      if(e.code==='Comma'||e.code==='Period'){FC.fov=THREE.MathUtils.clamp(FC.fov+(e.code==='Comma'?2:-2),12,110);trToast('ZOOM',Math.round(FC.fov)+'°');}
      return;}
    if(!FC_PASS.has(e.code)&&!TRK.some(k=>k[0]===e.code)){e.stopImmediatePropagation();return;}}
  if(mod||e.repeat)return;
  const k=TRK.find(x=>x[0]===e.code);if(!k)return;
  if(e.code==='KeyH'){TRUI.help.hidden=!TRUI.help.hidden;return;}
  if(e.code==='Digit3'){trSet('hud',!TRA.hud);if(TRA.hud)trToast('OCULTAR HUD','OFF');return;}
  if(!play)return;
  e.preventDefault();
  switch(e.code){
    case 'Digit1':trSet('god',!TRA.god);trToast('INVENCIBLE',TRA.god?'ON':'OFF');break;
    case 'Digit2':trSet('ship',!TRA.ship);trToast('NAVE SIN DAÑOS',TRA.ship?'ON':'OFF');break;
    case 'Digit4':trSet('slow',TRA.slow===1?0.5:TRA.slow===0.5?0.25:1);trToast('CÁMARA LENTA',TRS[TRA.slow]);break;
    case 'Digit5':trSet('pause',!TRA.pause);trToast('CONGELAR EL MUNDO',TRA.pause?'ON':'OFF');break;
    case 'Digit6':trSet('fc',!TRA.fc);trToast('CÁMARA LIBRE',TRA.fc?'ON':'OFF');break;
    case 'Digit7':trXP();break;
    case 'Digit8':trCargo();break;
    case 'Digit9':trBreak();break;
    case 'Digit0':trSet('hold',!TRA.hold);trToast('RETENER LA RONDA',TRA.hold?'ON':'OFF');break;
    case 'KeyU':trOne();break;
    case 'KeyI':trSwarm();break;
    case 'KeyO':trSpitter();break;
    case 'KeyP':trInc();break;
    case 'KeyJ':trEgg();break;
    case 'KeyK':trBrood();break;
    case 'KeyL':trClear();break;
    case 'KeyT':trSet('cine',!TRA.cine);trToast('CON CINEMÁTICA',TRA.cine?'ON':'OFF');break;}}
function trKeyUp(e){FC.k[e.code]=false;}
// mouse while the free camera is on: it looks (pointer locked, or dragging with a button held when the lock is not there: OBS); it never shoots
function trMouse(e){if(!(TRA.fc&&state==='play'))return;
  if(e.type==='mousedown'){e.stopImmediatePropagation();if(document.pointerLockElement!==canvas&&canvas.requestPointerLock){FC.drag=true;try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}return;}
  if(e.type==='mouseup'){FC.drag=false;return;}
  e.stopImmediatePropagation();
  if(document.pointerLockElement===canvas||FC.drag&&e.buttons){FC.ty-=e.movementX*0.0016;FC.tp=THREE.MathUtils.clamp(FC.tp-e.movementY*0.0016,-1.52,1.52);}}
function trWheel(e){if(!(TRA.fc&&state==='play'))return;FC.base=THREE.MathUtils.clamp(FC.base*(e.deltaY<0?1.25:0.8),0.3,30);trToast('VELOCIDAD',FC.base.toFixed(1)+' m/s');}

// ---- the help panel (H) and the little notice when something switches (not with the HUD hidden) ----
function trPanel(){const H=TRUI.help;if(!H)return;
  for(const i of H.querySelectorAll('i[data-s]')){const s=i.dataset.s,v=s==='nohud'?!TRA.hud:s==='slow'?TRA.slow!==1:!!TRA[s];i.classList.toggle('on',v);if(s==='slow')i.textContent=TRS[TRA.slow];}}
function trToast(label,val){const T=TRUI.toast;if(!T)return;T.firstChild.textContent=label;T.lastChild.textContent=val||'';T.lastChild.hidden=!val;
  T.classList.remove('on');void T.offsetWidth;T.classList.add('on');TRUI.toastEnd=performance.now()+1400;}
function trBuild(){
  const H=document.createElement('div');H.id='trHelp';H.hidden=true;
  const row=(k,l,s)=>`<div class="trR"><b>${k}</b><span>${l}</span>${s?`<i data-s="${s}"></i>`:''}</div>`;
  H.innerHTML='<div class="trH">MODO TRÁILER</div>'+TRK.slice(0,10).map(x=>row(x[1],x[2],x[3])).join('')+
    '<div class="trH">ENEMIGOS DELANTE, EN EL CASCO</div>'+TRK.slice(10).map(x=>row(x[1],x[2],x[3])).join('')+row('M','MÚSICA','')+row('V','VOCES','')+
    '<div class="trH">CÁMARA LIBRE</div>'+TRK_FC.map(x=>row(x[0],x[1],'')).join('');
  const T=document.createElement('div');T.id='trToast';T.innerHTML='<span></span><b></b>';
  document.body.append(H,T);TRUI.help=H;TRUI.toast=T;trPanel();}

// ---- start ----
if(TRAILER){
  trBuild();
  addEventListener('keydown',trKey,true);addEventListener('keyup',trKeyUp,true);
  for(const ev of ['mousedown','mouseup','mousemove'])addEventListener(ev,trMouse,true);addEventListener('wheel',trWheel,{passive:true});
  musicOn=false;window.__noMenuMusic=true;try{if(window.menuMusic)window.menuMusic(false);}catch(_){} // the music starts off (M switches the game music on)
  if(!/[?&]q=[0-5]\b/.test(location.search)){QA.on=false;qaSet(0);} // full quality, never lowered on its own (the picture size must not drop while recording)
  if(TRV&&Math.abs(innerWidth/innerHeight-TRV.w/TRV.h)>0.01)trSet('hud',false); // vertical in a window of another shape: the canvas is letterboxed and the HUD would not line up with it
}
