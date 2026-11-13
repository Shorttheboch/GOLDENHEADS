/* ================= v87: «¡NUEVO Nº1!» — a new number one of the Season 1 ranking (PC and phone) ================= */
// Santi: «un mensaje potente cuando haces un nuevo top 1 en el ranking». His choices: guests too (their run would be #1: the celebration, then a push
// to save it with Google), a new pilot line, and the same big message when you were already #1 and beat your own score.
// When (one run, once):
//   signed in   -> the run saved by itself (/api/save, accEndSave in 40-cuentas.js) with status ok, a new season best (newBest) and place 1 (me.pos 1)
//   guest       -> the run can be saved (login configured) and would go in at place 1 of the board (rankRender's ghost line at 1, an empty board too)
//   back from Google (accResult) -> the same test on the saved run: over the full ranking screen (#acct), visuals only (no sound before a gesture)
//   flagged runs, ?ronda=N games and a ranking that does not answer: never.
// On the end plate it waits for the plate's own entrance (title, score count and pop: N1_CFG.wait after showEndPlate) and stops the plate's own
// swap countdown meanwhile; then, ~3.7 s over everything (#n1, z 60, above the account screens): a gold flash, slow gold rays, a crown that drops in,
// «¡NUEVO Nº1!» slammed in the end plate's gold 3D letters (.g3) with a small shake, «RANKING DE CAPITANES · TEMPORADA 1», CAPITÁN {APODO} · score
// (a guest: the score and «Guárdala con Google para quedarte el Nº1»), gold sparks (one burst from the title, two smaller ones at the sides, then
// glitter falling: a 2D canvas, a few hundred sprites at most, nothing per frame once it is gone), the 'n1' fanfare (19-audio.js) and the pilot's
// 'top1' line (queued after the game-over line). A click, a tap or any key after 0.5 s skips it (a key never reaches REINTENTAR meanwhile).
// Then the panel goes to the ranking slide with the #1 line glowing with a crown (li.n1) and, for a guest, GUARDAR MI PUNTUACIÓN pulsing; a guest who
// retries without saving still gets «¿GUARDAMOS TU PUNTUACIÓN?» (once a session) with «¡Serías el Nº1 del ranking!», even after seeing the ranking.
// Reduced motion: no rays turning, no sparks, no shake (a fade). Test hooks: window.__n1.
const N1={on:false,run:null,seq:0,timer:0,t0:0,kind:'',after:null,guest:false,log:[]};
const N1_CFG={wait:2600,dur:3700,out:450,skip:500,burst:isTouch?90:150,side:isTouch?40:64,glitter:isTouch?36:64};
const n1Is=j=>!!(j&&j.status==='ok'&&j.newBest&&j.me&&j.me.pos===1);
function n1Log(k){N1.log.push(k);if(N1.log.length>20)N1.log.shift();}
// a new end plate (rankShow) or a retry: nothing left over from the last run
function n1Reset(){N1.seq++;N1.guest=false;clearTimeout(N1.timer);n1Close('abort');$('saveBtn').classList.remove('n1');}
// kind 'saved' | 'guest'; o = {token, score, nick, over: 'end' (wait for the plate) | 'acct' (now, over the account screen), after}
function n1Fire(kind,o){if(!o||(o.token&&N1.run===o.token))return false;N1.run=o.token||null;if(kind==='guest')N1.guest=true;n1Log('fire:'+kind+':'+o.over);
  if(o.over==='acct'){n1Show(kind,o);return true;}
  const seq=N1.seq;endStop(); // (the plate's own swap waits for the celebration)
  clearTimeout(N1.timer);N1.timer=setTimeout(()=>{if(seq!==N1.seq||$('end').hidden||state!=='dead')return;n1Show(kind,o);},Math.max(0,(ENDP.at||0)+N1_CFG.wait-performance.now()));
  return true;}
function n1Show(kind,o){const el=$('n1');N1.kind=kind;N1.after=o.after||(o.over==='acct'?n1AfterAcct:()=>n1AfterEnd(kind));n1Log('show:'+kind);
  el.querySelector('.n1Tl').innerHTML='<span class="ln">'+g3(TR('¡NUEVO Nº1!'))+'</span>';
  el.querySelector('.n1Ts span').textContent=TR('RANKING DE CAPITANES · TEMPORADA 1');
  const who=el.querySelector('.n1Who');
  who.innerHTML=(kind==='saved'&&o.nick?`<span>${escH(TR('CAPITÁN'))}</span> <b data-noi18n>${escH(o.nick)}</b><em>·</em>`:'')+`<i data-noi18n>${fmtN(o.score||0)}</i>`;
  el.querySelector('.n1Hint').textContent=TR(kind==='guest'?'Guárdala con Google para quedarte el Nº1':'Nadie lo ha hecho mejor esta temporada');
  el.classList.toggle('guest',kind==='guest');el.classList.remove('go','out');el.hidden=false;void el.offsetWidth;el.classList.add('go');
  N1.on=true;N1.t0=performance.now();document.body.classList.add('n1On');
  if(document.exitPointerLock&&document.pointerLockElement)document.exitPointerLock();
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches)n1FxStart();
  try{sfx('n1');say('top1',5,{queue:true});}catch(_){} // (no audio context on the way back from Google: both just do nothing)
  clearTimeout(N1.timer);N1.timer=setTimeout(()=>n1Close('end'),N1_CFG.dur);}
// 'end' (its time is up) · 'skip' (a click, a tap, a key: quicker) · 'abort' (a retry, a new plate: gone at once, nothing after)
function n1Close(how){const el=$('n1');clearTimeout(N1.timer);
  if(!N1.on){if(how==='abort'){el.hidden=true;el.classList.remove('go','out');n1FxStop();}return;}
  N1.on=false;document.body.classList.remove('n1On');const after=N1.after;N1.after=null;n1Log('close:'+how);
  const fin=()=>{if(N1.on)return;el.hidden=true;el.classList.remove('go','out');n1FxStop();};
  if(how==='abort'){fin();return;}
  el.classList.add('out');el.style.setProperty('--n1out',(how==='skip'?250:N1_CFG.out)+'ms');N1.timer=setTimeout(fin,how==='skip'?250:N1_CFG.out);
  if(after)setTimeout(after,how==='skip'?0:N1_CFG.out*0.5);}
// back on the end plate: the ranking slide, the #1 line glowing; a guest's GUARDAR pulses
function n1AfterEnd(kind){if($('end').hidden||state!=='dead')return;endSlide(1,'auto');
  const L=$('rankList'),li=L.querySelector(kind==='guest'?'li.ghost':'li.me')||L.firstElementChild;if(li)li.classList.add('n1');
  if(kind==='guest'&&!$('saveBtn').hidden)$('saveBtn').classList.add('n1');}
function n1AfterAcct(){const li=$('acList').querySelector('li.me');if(li)li.classList.add('n1');}
{const el=$('n1');
 el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(N1.on&&performance.now()-N1.t0>N1_CFG.skip)n1Close('skip');});
 el.addEventListener('click',e=>e.stopPropagation());}
// while it is up no key reaches the game or the plate (Enter would retry): a key skips it
addEventListener('keydown',e=>{if(!N1.on)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat&&performance.now()-N1.t0>N1_CFG.skip)n1Close('skip');},true);

/* ---------- the gold sparks (2D canvas over the whole screen) ---------- */
const N1FX={g:null,P:[],raf:0,t0:0,last:0,spr:null,W:0,H:0,k:1,cx:0,cy:0,bursts:[],gl:false};
function n1Sprite(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(255,255,236,1)');r.addColorStop(.22,'rgba(255,220,120,.95)');r.addColorStop(.55,'rgba(255,160,40,.3)');r.addColorStop(1,'rgba(255,120,0,0)');
  g.fillStyle=r;g.fillRect(0,0,64,64);return c;}
function n1FxStart(){const F=N1FX,cv=$('n1Fx'),d=Math.min(devicePixelRatio||1,isTouch?1.5:2);F.W=innerWidth;F.H=innerHeight;
  cv.width=Math.round(F.W*d);cv.height=Math.round(F.H*d);F.g=cv.getContext('2d');if(!F.g)return;F.g.setTransform(d,0,0,d,0,0);F.g.lineCap='round';
  if(!F.spr)F.spr=n1Sprite();F.P.length=0;F.gl=false;F.k=Math.max(0.45,Math.min(F.W,F.H)/700);
  const t=$('n1').querySelector('.n1In').getBoundingClientRect();F.cx=t.left+t.width/2;F.cy=t.top+t.height*0.45;
  F.bursts=[[0.42,F.cx,F.cy,N1_CFG.burst],[1.2,F.cx-F.W*0.27,F.cy-F.H*0.1,N1_CFG.side],[1.5,F.cx+F.W*0.27,F.cy-F.H*0.06,N1_CFG.side]];
  F.t0=F.last=performance.now();cancelAnimationFrame(F.raf);F.raf=requestAnimationFrame(n1FxTick);}
function n1FxStop(){const F=N1FX;cancelAnimationFrame(F.raf);F.raf=0;F.P.length=0;if(F.g)F.g.clearRect(0,0,F.W,F.H);}
function n1Burst(x,y,n){const F=N1FX,k=F.k;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=(160+Math.random()*640)*k;
  F.P.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*0.85-140*k,l:0,m:1+Math.random()*1.3,r:(2+Math.random()*3.4)*k,tw:Math.random()*6.28,st:1});}}
function n1Glitter(n){const F=N1FX,k=F.k;for(let i=0;i<n;i++)F.P.push({x:Math.random()*F.W,y:-10-Math.random()*F.H*0.5,vx:(Math.random()-0.5)*30*k,vy:(70+Math.random()*120)*k,
  l:0,m:2.4+Math.random()*1.4,r:(1.4+Math.random()*2.4)*k,tw:Math.random()*6.28,st:0});}
function n1FxTick(now){const F=N1FX,g=F.g;if(!g)return;const dt=Math.min(0.05,(now-F.last)/1000),t=(now-F.t0)/1000;F.last=now;
  for(let i=F.bursts.length-1;i>=0;i--)if(t>=F.bursts[i][0]){const b=F.bursts.splice(i,1)[0];n1Burst(b[1],b[2],b[3]);}
  if(!F.gl&&t>0.7){F.gl=true;n1Glitter(N1_CFG.glitter);}
  g.globalCompositeOperation='source-over';g.clearRect(0,0,F.W,F.H);g.globalCompositeOperation='lighter';g.strokeStyle='rgb(255,214,120)';
  let j=0;
  for(const p of F.P){p.l+=dt;if(p.l>=p.m)continue;F.P[j++]=p;
    const drag=p.st?Math.pow(0.2,dt):1;p.vx*=drag;p.vy=p.vy*drag+(p.st?520:16)*F.k*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    const f=1-p.l/p.m,tw=0.55+0.45*Math.sin(p.tw+t*(p.st?17:8)),a=Math.min(1,f*1.7)*tw,s=p.r*(p.st?0.7+f*0.7:1)*4;
    if(p.st){g.globalAlpha=a*0.55;g.lineWidth=p.r*0.55;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-p.vx*0.035,p.y-p.vy*0.035);g.stroke();}
    g.globalAlpha=a;g.drawImage(F.spr,p.x-s/2,p.y-s/2,s,s);}
  F.P.length=j;g.globalAlpha=1;
  if(j||F.bursts.length||(N1.on&&!F.gl))F.raf=requestAnimationFrame(n1FxTick);else{F.raf=0;g.globalCompositeOperation='source-over';g.clearRect(0,0,F.W,F.H);}}
window.__n1={N1,N1_CFG,N1FX,fire:n1Fire,show:n1Show,close:n1Close,reset:n1Reset,is:n1Is};
