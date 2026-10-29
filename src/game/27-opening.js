// ---- opening film (Santi's HEADS_GAME_OPENING): plays once per session before the first game, skippable ----
let opSeen=false;
function playOpening(done){const el=$('opening'),v=$('opVid');let fin=false,idleT=0;
  const end=()=>{if(fin)return;fin=true;document.removeEventListener('keydown',kd,true);el.classList.remove('on','ui');if(master)master.gain.value=1;if(AC&&AC.state!=='running'&&AC.state!=='closed')AC.resume().catch(()=>{});
    setTimeout(()=>{el.hidden=true;v.pause();v.removeAttribute('src');v.load();},650);done();};
  const kd=e=>{if(['Enter','NumpadEnter','Space','Escape'].includes(e.code)){e.preventDefault();e.stopPropagation();end();}};
  const wake=()=>{el.classList.add('ui');el.classList.remove('idle');clearTimeout(idleT);idleT=setTimeout(()=>el.classList.add('idle'),2200);};
  v.src=window.__OPENING||'assets/opening.mp4';v.onended=end;v.onerror=end;
  v.ontimeupdate=()=>{$('opBar').firstChild.style.width=(v.currentTime/(v.duration||30)*100)+'%';};
  el.hidden=false;requestAnimationFrame(()=>el.classList.add('on'));setTimeout(()=>{if(!fin)MENU_BG.warm=true;},800);if(master)master.gain.value=0; // the film carries its own sound
  v.play().catch(()=>{v.muted=true;v.play().catch(end);});
  setTimeout(wake,700);el.onmousemove=wake;el.ontouchstart=wake;$('opSkip').onclick=e=>{e.stopPropagation();end();};
  document.addEventListener('keydown',kd,true);}
$('play').addEventListener('click',()=>{tcFull();initAudio();loadVO();loadSfx();$('menu').hidden=true;
  const go=()=>{$('touch').hidden=!isTouch;$('tZone').hidden=!isTouch;
    $('hint').textContent=isTouch?'':'Haz clic para capturar el ratón · Esc para soltarlo';reset();state='play';
    if(!isTouch&&canvas.requestPointerLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}};
  if(!opSeen&&!window.__noOpening){opSeen=true;playOpening(go);}else go();});

