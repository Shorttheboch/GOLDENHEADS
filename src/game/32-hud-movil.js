// ---- v62: phone HUD by Santi (src/hud/hud.js → window.HUD). Touch only: the PC HUD does not change. ----
// It mounts the first time a game starts. Only then body gets .hm, which hides the previous phone HUD
// (src/styles/05-hud-movil.css); if it could not mount, the previous HUD stays as it was.
// Kept from the previous phone HUD: pistol energy and RACHA under the crosshair, boss bar, prize timers,
// unload bar, messages, tips, tutorial and all the markers (breaches, hold, trichome diamonds).
const MHUD={on:false,last:{},wave:-1,perfT:-1e9,perf:null};
function mhudMount(){if(MHUD.on||!isTouch||!window.HUD)return;const H=window.HUD;
  try{H.mount();}catch(e){console.warn('phone HUD unavailable',e);return;}
  MHUD.on=true;document.body.classList.add('hm');
  H.on('pause',()=>{if(state==='play'&&!TC.paused)tcSetPause(true);});
  // perfect weld: tap the weld bar while the fill is inside the golden band (a miss just keeps welding, as before)
  H.on('weldTap',()=>{if(state!=='play'||!R.pa)return;const p=R.pa.prog;
    if(R.useBand&&p>=R.band&&p<=R.band+CFG.bandW){MHUD.perf={s:R.band,w:CFG.bandW};repairPatch(R.pa,true);R.pa=null;R.on=false;MHUD.perfT=performance.now();H.weldResult('perfect');}
    else H.weldResult('miss');});}
// voices: the crew line goes to the HUD subtitles
function mhudSay(who,txt,ms){if(!MHUD.on)return false;window.HUD.say(who==='P'?'PILOTO':'INGENIERÍA',txt,ms);return true;}
// once per frame (from tick): send the game state to the HUD, only what changed
function mhudFrame(){if(!isTouch)return;if(!MHUD.on){if(state==='play')mhudMount();if(!MHUD.on)return;}
  const H=window.HUD,L=MHUD.last,ch=(k,v)=>{if(L[k]===v)return false;L[k]=v;return true;};
  const show=state==='play'&&!CINE.on;
  if(ch('show',show)){H.show(show);if(!show){H.weld(false);L.weld=null;H.hideSay();}}
  if(!show)return;
  // suit, ship, trichomes on board (the bar = how full the ship is, as on PC)
  const hp=THREE.MathUtils.clamp(P.hp/CFG.hpMax,0,1)*100,sh=shipHp()*100;
  if(ch('suit',Math.round(hp*10)))H.suit(hp);if(ch('ship',Math.round(sh*10)))H.ship(sh);
  const cg=Math.max(0,Math.round(cargo)),fill=THREE.MathUtils.clamp(cargo/CFG.cargo,0,1);
  if(ch('tri',cg+'|'+fill.toFixed(3)))H.tricomas(cg,fill);
  // leaks = broken plates + plates being eaten (same count as the PC HUD) · trichomes floating outside
  let fug=0;for(const pa of PATCHES)if(pa.hp<=0||spiders.some(s=>s.state==='eat'&&s.patch===pa))fug++;
  if(ch('fug',fug))H.leaks(fug);
  const ls=looseCount();if(ch('res',ls))H.rescue(ls);
  // score = trichomes secured + combat points (what PUNTUACIÓN shows on PC) · kills · round · enemies left
  if(ch('pts',score+pts))H.score(score+pts);
  if(ch('kills',stats.kills))H.kills(stats.kills);
  if(MHUD.wave!==wave){MHUD.wave=wave;H.round(wave+1,true);} // big RONDA n when a round starts (also the first one and after RETRY)
  const calm=WB.calm&&!inBreak,left=spiders.length+toSpawn;
  const en=inBreak?[Math.ceil(Math.max(0,breakT)),'s · RESPIRO']:calm?[Math.ceil(Math.max(0,WB.lull)),'s · CALMA']:[left,undefined];
  if(ch('en',en.join('|')))H.enemies(en[0],en[1]);
  // crosshair: red = on target, gold = the aim help has it, hidden while the camera swings round
  const xh=$('cross').style.visibility==='hidden'?'hidden':_tcAimHit?'target':TC.aim?'assist':'';
  if(ch('xh',xh))H.crosshair(xh);
  // weld bar: shown when the game shows its own (#rep); after a perfect weld it stays full for a moment
  const rep=$('rep');let w=null;
  if(performance.now()-MHUD.perfT<450&&MHUD.perf)w={progress:1,sweet:MHUD.perf.s,width:MHUD.perf.w};
  else if(R.pa&&rep.classList.contains('show'))w={progress:Math.min(1,R.pa.prog),sweet:R.band,width:CFG.bandW,band:R.useBand,paused:rep.classList.contains('paused')};
  const wk=w?[w.progress.toFixed(3),w.sweet,w.band,w.paused].join('|'):'';
  if(ch('weld',wk))H.weld(w||false);}
