/* ================= INPUT ================= */
const keys={};const inp={mx:0,my:0,up:0,fire:false,suck:false,boost:false};
addEventListener('keydown',e=>{if(e.target&&e.target.tagName==='INPUT')return; // typing a name for the ranking
  keys[e.code]=true;if(e.code==='Space')e.preventDefault();
  if(e.code==='KeyM'&&!e.repeat){musicOn=!musicOn;showMsg(musicOn?'MÚSICA ON':'MÚSICA OFF','',0.9);}
  if(e.code==='KeyV'&&!e.repeat){voOn=!voOn;if(!voOn&&voSrc){try{voSrc.stop();}catch(_){}$('sub').classList.remove('show');}showMsg(voOn?'VOCES ON':'VOCES OFF','',0.9);}
  if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat&&state==='play')dashReq=true;
  if(e.code==='KeyR'&&!e.repeat&&state==='play'&&P.ammo<CFG.gunCap-0.5&&!(P.gunLock>0)){P.gunLock=CFG.reloadT;P.reloading=true;sfx('reload');}
  if((e.code==='Enter'||e.code==='NumpadEnter')&&!e.repeat){
    if(state==='play'&&(inBreak||WB.calm))skipReq=true;
    else if(state==='dead'&&!$('end').hidden)$('again').click();
    else if(state==='menu'&&!$('play').disabled)$('play').click();}
  if(e.code==='KeyR'&&!e.repeat&&state==='dead'&&!$('end').hidden)$('again').click();});
addEventListener('keyup',e=>{keys[e.code]=false;});
let locked=false;
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;});
canvas.addEventListener('mousedown',e=>{if(state!=='play')return;
  if(!locked&&!isTouch&&canvas.requestPointerLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}
  if(e.button===0)inp.fire=true;if(e.button===2)inp.suck=true;});
addEventListener('mouseup',e=>{if(e.button===0)inp.fire=false;if(e.button===2)inp.suck=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(locked&&state==='play'){P.yaw-=e.movementX*0.0022;P.pitch-=e.movementY*0.0022;if(Math.abs(e.movementX)+Math.abs(e.movementY)>3)lookInput=performance.now();}});
