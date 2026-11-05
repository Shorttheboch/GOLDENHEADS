// ---- online ranking, Season 1 (v82: Google accounts; server worker/ranking.ts -> Supabase, supabase/v82-cuentas.sql) ----
// Every run gets a signed token from the server (rankStart in reset). At game over (rankShow, from endGame) the run is kept in RANK.pending and,
// while the ranking is on, the end plate's panel gets a second framed slide: the Season 1 ranking (#rankBox), after the run's stats.
// The whole frames swap sideways with a blur (ENDV, endSwap below): tabs «TU PARTIDA · RANKING» (a click, or on PC the mouse resting on one),
// gold chevrons ‹ ›, ←/→ on PC, a swipe on touch, and by itself 3.5 s after the stats table has come in (a gold line under RANKING fills; hovering
// or touching the stats pauses it; any manual swap cancels it).
// 40-cuentas.js fills the ranking slide (accEnd):
//   signed in  -> the run is saved at once under the player's nickname: ¡NUEVO RÉCORD! or the season best, the place, the top 5 with my line,
//                 VER RANKING COMPLETO and «CAPITÁN {APODO}» with Salir / Borrar mi cuenta (no full screen every game)
//   guest      -> the top 5 (where this unsaved score would enter, as a «TÚ» line) and GUARDAR MI PUNTUACIÓN (con Google); retrying before the
//                 ranking was seen, with a run that would make the top 50 or a new record, asks once a session «¿GUARDAMOS TU PUNTUACIÓN?» (accNag)
//   ranking down (or a ?ronda=N game) -> exactly v44: the stats, no tabs, no chevrons
// The top 5 is always five lines: empty places wait for a captain, and on an empty board the first one says «¡Sé el primero!».
// The hand-typed names of v81 and before are gone: that board (Netlify Blobs) is archived as «Temporada 0», no longer shown.
const RANK={on:/^https?:$/.test(location.protocol)&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname),token:null,pending:null,seq:0,show:5};
function rankStart(){RANK.token=null;RANK.pending=null;const q=++RANK.seq;if(!RANK.on)return;
  fetch('/api/run',{method:'POST'}).then(r=>r.ok?r.json():null).then(j=>{if(q===RANK.seq&&j&&j.token)RANK.token=j.token;}).catch(()=>{});}
function rankRow(pos,e,cls){return `<li class="${cls||''}"><i>${pos}</i><span>${escH(e.nick)}</span><em>R${e.round}</em><b>${fmtN(e.score)}</b></li>`;}
// one list: the top o.n lines (RANK.show by default); o.fill = always that many lines (empty places wait); o.ghost = {score, round} of a guest's
// unsaved run, shown where it would enter (the lines under it go one place down); my own line under a gap when I am further down.
// Answers {has: the board has someone, ghost: the place of the ghost line or 0}.
function rankRender(ol,d,o={}){const n=o.n||RANK.show,top=(d&&Array.isArray(d.top)?d.top:[]).slice(0,n),list=top.slice();
  let gp=0;if(o.ghost&&o.ghost.score>0){gp=1+top.filter(e=>e.score>=o.ghost.score).length;if(gp>n)gp=0;else list.splice(gp-1,0,{ghost:1,score:o.ghost.score,round:o.ghost.round});}
  let h=list.slice(0,n).map((e,i)=>e.ghost?`<li class="ghost"><i>${i+1}</i><span>${escH(TR('TÚ'))}<small>${escH(TR('sin guardar'))}</small></span><em>R${e.round}</em><b>${fmtN(e.score)}</b></li>`
    :rankRow(i+1,e,e.me?'me':'')).join('');
  if(o.fill)for(let i=Math.min(list.length,n);i<n;i++)h+=`<li class="ph${i===0?' first':''}"><i>${i+1}</i><span>${i===0?escH(TR('¡Sé el primero!')):'· · ·'}</span><em></em><b>—</b></li>`;
  if(!gp&&d&&d.me&&d.me.pos>Math.min(top.length,n))h+=`<li class="gap">···</li>`+rankRow(d.me.pos,d.me,'me');
  ol.innerHTML=h;return {has:top.length>0,ghost:gp};}
function rankLoading(){$('rankList').innerHTML=Array.from({length:RANK.show},(_,i)=>`<li class="ph load"><i>${i+1}</i><span>· · ·</span><em></em><b>—</b></li>`).join('');}
// the ranking does not answer: exactly v44 (the stats only)
function rankOff(){endTabs(false);fitEndPlate();}
function rankShow(total,st){$('rankMsg').textContent='';$('saveBtn').hidden=true;$('acctBar').hidden=true;$('rankAll').hidden=true;
  RANK.pending=null;endTabs(RANK.on);
  if(!RANK.on){$('rankList').innerHTML='';fitEndPlate();return;}
  if(RANK.token&&total>0)RANK.pending={token:RANK.token,score:Math.round(total),round:wave+1,stats:st,secs:Math.round(playT),plat:isTouch?'touch':'pc',
    lang:window.I18N&&I18N.lang==='en'?'en':'es',at:Date.now()};
  RANK.token=null; // a run is saved once
  rankLoading();fitEndPlate();endAuto();
  accEnd();} // 40-cuentas.js
/* ---------- the panel's two slides (ENDV): 0 = the run's stats, 1 = the ranking ---------- */
const ENDV={on:false,i:0,auto:false,left:0,t0:0,raf:0,startT:0,hover:false,touchT:0,seen:false,down:null,hovI:null,hovT:0};
const END_WAIT=3500; // the stats stay this long once their table has come in (Santi: 3.5 s)
function endTabs(on){ENDV.on=on;ENDV.seen=false;$('endBox').classList.toggle('rk',on);$('endTabs').hidden=!on;$('rankBox').hidden=!on;endStop();endSlide(0,'now');}
// show slide i: 'auto' (the countdown), 'manual' (tabs, chevrons, keys, swipe: the countdown is off for this plate) or 'now' (no animation)
function endSlide(i,how){if(!ENDV.on)i=0;const prev=ENDV.i;ENDV.i=i;if(i===1)ENDV.seen=true;if(how==='manual'||i===1)endStop();
  const a=$('endSlide0'),b=$('rankBox'),to=i===1?b:a,from=i===1?a:b;endSwapStop();
  for(const [el,on] of [[a,i===0],[b,i===1]]){el.inert=!on;el.setAttribute('aria-hidden',String(!on));} // the slide that is not shown: no focus, no clicks
  $('endTab0').setAttribute('aria-selected',String(i===0));$('endTab1').setAttribute('aria-selected',String(i===1));
  $('endPrev').hidden=!ENDV.on||i===0;$('endNext').hidden=!ENDV.on||i===1;$('endPanel').classList.toggle('live',how!=='now');
  to.classList.remove('off');
  if(how==='now'||prev===i||!ENDV.on||$('end').hidden||typeof to.animate!=='function'){from.classList.add('off');return;}
  endSwap(from,to,i===1?1:-1);}
// the swap (~0.5 s): the whole frame that leaves slides out (to the left going to the ranking, s=1; mirrored back) with a sideways blur that grows
// while it fades; the other one comes in from the other side 0.11 s later, from blurred and transparent to sharp, and settles with a small overshoot.
// The blur: on PC an SVG filter (#endBlurA/#endBlurB in index.html) blurs only sideways, its stdDeviation "N 0" set frame by frame from the
// animations' clocks; on touch a light CSS blur that the compositor animates (an SVG filter is drawn again every frame); reduced motion: a crossfade.
const ENDX={a:null,b:null,raf:0};
function endSwapStop(){cancelAnimationFrame(ENDX.raf);ENDX.raf=0;for(const k of ['a','b']){if(ENDX[k])ENDX[k].cancel();ENDX[k]=null;}
  for(const el of [$('endSlide0'),$('rankBox')])el.style.filter='';}
function endSwap(from,to,s){from.classList.remove('off'); // seen while it leaves
  const done=()=>{endSwapStop();from.classList.add('off');};
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){ENDX.a=from.animate([{opacity:1},{opacity:0}],{duration:260,easing:'ease-out',fill:'forwards'});
    ENDX.b=to.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out',fill:'both'});ENDX.b.onfinish=done;return;}
  const OUT=300,IN=390,DL=110,svg=!isTouch,B=svg?Math.max(6,from.offsetWidth*.03):Math.max(2,from.offsetWidth*.008);
  const fo=svg?[{},{}]:[{filter:'blur(0px)'},{filter:`blur(${B.toFixed(1)}px)`}];
  ENDX.a=from.animate([{transform:'none',opacity:1,...fo[0]},{transform:`translateX(${-42*s}%) scaleX(1.08)`,opacity:0,...fo[1]}],
    {duration:OUT,easing:'cubic-bezier(.4,0,.75,.5)',fill:'forwards'});
  ENDX.b=to.animate([{offset:0,transform:`translateX(${40*s}%) scaleX(1.08)`,opacity:0,...(svg?{}:{filter:`blur(${B.toFixed(1)}px)`}),easing:'cubic-bezier(.16,.62,.34,1)'},
    {offset:.45,opacity:1},...(svg?[]:[{offset:.6,filter:'blur(0px)'}]),
    {offset:.72,transform:`translateX(${-1.8*s}%) scaleX(.995)`,easing:'ease-in-out'},{offset:.87,transform:`translateX(${.6*s}%) scaleX(1)`,easing:'ease-in-out'},
    {offset:1,transform:'none',opacity:1,...(svg?{}:{filter:'none'})}],{duration:IN,delay:DL,fill:'both'});
  ENDX.b.onfinish=done;
  if(!svg)return;
  const fa=$('endBlurA').firstElementChild,fb=$('endBlurB').firstElementChild,set=(f,v)=>f.setAttribute('stdDeviation',v.toFixed(2)+' 0');
  set(fa,0);set(fb,B);from.style.filter='url(#endBlurA)';to.style.filter='url(#endBlurB)';
  const tick=()=>{if(!ENDX.b)return;const ta=Math.min(1,(ENDX.a.currentTime||0)/OUT),tb=Math.max(0,Math.min(1,((ENDX.b.currentTime||0)-DL)/(IN*.6)));
    set(fa,B*Math.pow(ta,1.2));set(fb,B*(1-tb*tb*(3-2*tb)));ENDX.raf=requestAnimationFrame(tick);};
  ENDX.raf=requestAnimationFrame(tick);}
// the countdown: it starts when the stats table has come in (the rows of 01-end-plate.css: 1.45 s + 55 ms a row + 0.35 s), runs END_WAIT,
// pauses while the mouse is over the panel or a finger on it (and 2 s after), stops for good after any manual swap
function endAuto(){endStop();if(!ENDV.on)return;const n=$('endStats').children.length/2,reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  ENDV.auto=true;ENDV.left=END_WAIT;ENDV.startT=performance.now()+(reduce?0:1450+Math.max(0,n-1)*55+350);ENDV.t0=0;$('endTab1').querySelector('.prog').hidden=false;endProg(0);
  const tick=now=>{if(!ENDV.auto)return;ENDV.raf=requestAnimationFrame(tick);if(now<ENDV.startT||$('end').hidden)return;
    const dt=ENDV.t0?Math.min(250,now-ENDV.t0):0;ENDV.t0=now;
    if(ENDV.hover||now<ENDV.touchT||document.body.classList.contains('acctOn')||document.visibilityState==='hidden')return;
    ENDV.left-=dt;endProg(1-ENDV.left/END_WAIT);if(ENDV.left<=0)endSlide(1,'auto');};
  ENDV.raf=requestAnimationFrame(tick);}
function endProg(p){$('endTab1').querySelector('.prog i').style.setProperty('--p',Math.max(0,Math.min(1,p)).toFixed(3));}
function endStop(){ENDV.auto=false;cancelAnimationFrame(ENDV.raf);const g=$('endTab1').querySelector('.prog');if(g)g.hidden=true;}
$('endTab0').addEventListener('click',e=>{e.stopPropagation();endSlide(0,'manual');});
$('endTab1').addEventListener('click',e=>{e.stopPropagation();endSlide(1,'manual');});
// PC: the mouse resting on a tab swaps to it (no click needed) after a short hover intent, so crossing the tabs on the way to REINTENTAR does
// nothing; the tab already shown does nothing; during a swap it waits for the swap to end (never two at once). It counts as a manual swap.
const END_HOVER=140;
function endHover(i){clearTimeout(ENDV.hovT);ENDV.hovT=setTimeout(function go(){
    if(ENDV.hovI!==i||!ENDV.on||$('end').hidden||state!=='dead'||document.body.classList.contains('acctOn'))return;
    if(ENDX.b){ENDV.hovT=setTimeout(go,60);return;}
    if(ENDV.i!==i)endSlide(i,'manual');},END_HOVER);}
for(const [id,i] of [['endTab0',0],['endTab1',1]]){const t=$(id);
  t.addEventListener('pointerenter',e=>{if(e.pointerType!=='mouse')return;ENDV.hovI=i;endHover(i);});
  t.addEventListener('pointerleave',e=>{if(e.pointerType!=='mouse')return;if(ENDV.hovI===i){ENDV.hovI=null;clearTimeout(ENDV.hovT);}});}
$('endPrev').addEventListener('click',e=>{e.stopPropagation();endSlide(0,'manual');});
$('endNext').addEventListener('click',e=>{e.stopPropagation();endSlide(1,'manual');});
{const pn=$('endPanel');
 // the mouse over the panel pauses the countdown (pointer events: a tap also sends a mouseenter, with no mouseleave after it)
 pn.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')ENDV.hover=true;});pn.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')ENDV.hover=false;});
 // touch: a finger on the panel pauses the countdown; a sideways swipe swaps (vertical moves are left alone)
 pn.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;ENDV.touchT=Infinity;ENDV.down={x:e.clientX,y:e.clientY,t:performance.now()};});
 const up=e=>{if(e.pointerType==='mouse'||!ENDV.down)return;const d=ENDV.down;ENDV.down=null;ENDV.touchT=performance.now()+2000;
   const dx=e.clientX-d.x,dy=e.clientY-d.y;if(ENDV.on&&Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.5&&performance.now()-d.t<900)endSlide(dx<0?1:0,'manual');};
 pn.addEventListener('pointerup',up);pn.addEventListener('pointercancel',up);}
// ←/→ on PC (Enter still retries, 21-input-pc.js)
addEventListener('keydown',e=>{if(!ENDV.on||$('end').hidden||state!=='dead'||document.body.classList.contains('acctOn'))return;
  if(e.code==='ArrowRight'||e.code==='ArrowLeft'){e.preventDefault();endSlide(e.code==='ArrowRight'?1:0,'manual');}});
function endRetry(){tcFull();endStop();cancelAnimationFrame(ENDP.raf);$('end').hidden=true;$('end').classList.remove('go');reset();state='play';musicStart();
  if(!isTouch&&canvas.requestPointerLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}}
$('again').addEventListener('click',()=>{if(accNag())return;endRetry();}); // accNag (40-cuentas.js): «¿GUARDAMOS TU PUNTUACIÓN?», at most once a session
