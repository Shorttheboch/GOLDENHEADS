// ---- v66: phone tutorial (Santi). The first game on a phone starts with no lessons: you play a little on instinct
// (the first impression). After MTUT.at seconds of play the game pauses, the screen goes dark and five quick screens
// explain the controls and the HUD. The piece being explained is lifted above the dark, a bit bigger and glowing.
// The title "decodes" in and the lines slide in (under half a second). Each screen passes on its own (thin bar) or
// with a tap; SALTAR ends it. Remembered on the phone; the pause menu has CÓMO SE JUEGA to see it again.
// If no trichomes are floating when it shows, step 4 is left out and shows on its own the first time some float.
// Touch only (isTouch): PC does not change. Design: Design canvas "Controles móvil", boards 5–11.
const MTUT={on:false,done:false,list:[],i:0,k:'',t0:0,tap0:0,last:0,at:20,dur:4200,up:[],bod:false,later4:false,D:null,L:null,title:'',tLock:false};
try{MTUT.done=localStorage.getItem('heads_tut')==='1';}catch(_){}
const MTUT_ORDER=['move','aim','tri','collect','life'];
const MTUT_S={
  move:{t:'MUÉVETE',l:['<b>Pulgar izquierdo</b>: empuja para moverte.','<b class="c">Doble empuje</b> = acelerón.'],art:'stick',lb:'PULGAR IZQUIERDO'},
  aim:{t:'MIRA Y DISPARA',l:['<b>Arrastra</b> a la derecha para girar.','<b>Mantén DISPARAR</b> y desliza para apuntar.'],art:'aim',lb:'ARRASTRA = GIRAS',lb2:'MANTÉN'},
  tri:{t:'TRICOMAS',l:['Es tu carga: <b>mantén la barra llena</b>.','Si llega a <b class="r">0, pierdes</b>.']},
  collect:{t:'RECOGE Y DEPOSITA',l:['<b>1</b> Pasa cerca: se aspiran solos.','<b>2</b> Llévalos a la <b class="c">BODEGA</b>.']},
  life:{t:'TRAJE Y NAVE',l:['<b>TRAJE</b>: tu vida.','<b>NAVE</b>: mata las arañas y suelda las roturas.','Si alguno llega a <b class="r">0, pierdes</b>.']}};
// the joystick and the aim drawings come from Santi's phone menu art (controls.webp, 990 × 990): x, y, w, h of each
const MTUT_ART={stick:[80,160,370,320],aim:[520,160,368,330]};
const mtTR=s=>window.TR?window.TR(s):s,mtTRH=h=>window.TRH?window.TRH(h):h;
function mtutDom(){if(MTUT.L)return;
  const D=document.createElement('div');D.id='mTutD';D.hidden=true;D.innerHTML='<div class="mtA"></div>';
  const L=document.createElement('div');L.id='mTutL';L.hidden=true;
  L.innerHTML='<p class="mtLb"></p><p class="mtLb2"></p><i class="mtN">1</i><i class="mtN">2</i>'+
    '<div class="mtT"><div class="mtDots"></div><h2 class="mtH"></h2><div class="mtX"></div><p class="mtHint"></p><div class="mtBar"><i></i></div><span class="mtGo"></span></div>'+
    '<button type="button" class="mtSkip"><span></span><b>››</b></button>';
  document.body.append(D,L);MTUT.D=D;MTUT.L=L;
  // a tap anywhere = next screen (not in the first moments: the thumbs are still on the glass when it pauses) · SALTAR = end
  L.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!MTUT.on)return;
    if(e.target.closest('.mtSkip')){mtutEnd();return;}
    if(performance.now()-MTUT.tap0>(MTUT.i===0?600:300))mtutNext();});}
// a floating-trichome marker on screen (the gold diamond with "N POR RESCATAR"), or null
function mtutLoose(){for(const m of document.querySelectorAll('#h4m .mk:not([hidden])'))return m;return null;}
// lift a HUD piece above the dark: raise the outermost layer that holds it, fade its neighbours, and make it bigger and glowing
function mtutLift(el,origin){if(!el)return;let up=null;
  for(let n=el;n&&n!==document.body;n=n.parentElement){const cs=getComputedStyle(n);if(cs.position!=='static'&&cs.zIndex!=='auto')up=n;}
  up=up||el;up.classList.add('mtut-up');MTUT.up.push(up);
  if(up!==el)for(let n=el.parentElement;n;n=n.parentElement){n.classList.add('mtut-path');MTUT.up.push(n);if(n===up)break;}
  el.classList.add('mtut-hl');el.style.setProperty('--mto',origin||'50% 50%');MTUT.up.push(el);}
function mtutDrop(){for(const n of MTUT.up){n.classList.remove('mtut-up','mtut-path','mtut-hl');n.style.removeProperty('--mto');}MTUT.up=[];
  if(MTUT.bod){$('hBod').hidden=true;MTUT.bod=false;} // the hold marker shown for step 4 goes back to its own rule on the next frame
  if(MTUT.D){const D=MTUT.D;D.style.webkitMaskImage=D.style.maskImage='';}}
function mtutStart(){if(MTUT.on||!isTouch||!MHUD.on)return;
  const list=MTUT_ORDER.filter(k=>k!=='collect'||mtutLoose());MTUT.later4=list.length<MTUT_ORDER.length;mtutOpen(list);}
function mtutOpen(list){mtutDom();MTUT.list=list;MTUT.i=0;MTUT.on=true;tcReset();
  MTUT.D.hidden=MTUT.L.hidden=false;document.body.classList.add('mtut');MTUT.last=performance.now();mtutShow();}
function mtutShow(){const k=MTUT.list[MTUT.i],S=MTUT_S[k],L=MTUT.L,D=MTUT.D,n=MTUT_ORDER.indexOf(k),W=innerWidth,H=innerHeight,q=s=>L.querySelector(s);
  mtutDrop();MTUT.k=k;MTUT.t0=MTUT.tap0=MTUT.last=performance.now();MTUT.title=mtTR(S.t);MTUT.tLock=false;
  L.className='s-'+k;D.className='s-'+k;
  q('.mtDots').innerHTML=MTUT_ORDER.map((_,j)=>'<i'+(j===n?' class="on"':'')+'></i>').join('');
  q('.mtX').innerHTML=S.l.map((h,j)=>'<p style="animation-delay:'+(0.12+0.07*j).toFixed(2)+'s">'+mtTRH(h)+'</p>').join('');
  const last=k==='life';q('.mtHint').textContent=last?'':mtTR('TOCA PARA SEGUIR');q('.mtBar').style.display=last?'none':'';
  q('.mtGo').textContent=last?mtTR('¡A JUGAR!'):'';q('.mtSkip span').textContent=mtTR('SALTAR');q('.mtBar i').style.width='0%';
  q('.mtLb').textContent=S.lb?mtTR(S.lb):'';q('.mtLb2').textContent=S.lb2?mtTR(S.lb2):'';
  for(const b of L.querySelectorAll('.mtN'))b.style.display='none';
  // the drawing (in the dark layer, so its black background melts into the dark)
  const A=D.querySelector('.mtA'),img=$('mmRImg')&&$('mmRImg').src;A.style.display='none';
  const T=q('.mtT'),put=(el,x,y,w)=>{el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px';if(w)el.style.width=Math.round(w)+'px';};
  T.classList.toggle('c',k==='tri');
  // the SALTAR button sits just under the score panel, right-aligned with it
  {const r=$('hud-score')?$('hud-score').getBoundingClientRect():null,sk=q('.mtSkip');put(sk,(r?r.right:W-18)-128,(r?r.bottom:94)+8);}
  if(S.art&&img){const [ax,ay,aw,ah]=MTUT_ART[S.art],w=Math.min(k==='move'?230:250,W*0.29,H*0.62),s=w/aw,h=ah*s;
    const x=k==='move'?Math.max(W*0.09,52):W*0.535,y=H-h-H*0.11;
    A.style.cssText=`display:block;left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px;background-image:url("${img}");`+
      `background-size:${Math.round(990*s)}px ${Math.round(990*s)}px;background-position:${Math.round(-ax*s)}px ${Math.round(-ay*s)}px`;
    A.classList.remove('in');void A.offsetWidth;A.classList.add('in');put(q('.mtLb'),x,y+h+4,w);}
  if(k==='move')put(T,W*0.52,H*0.27,Math.min(300,W*0.4));
  if(k==='aim'){put(T,Math.max(W*0.06,52),H*0.25,Math.min(340,W*0.4));
    const f=$('tFire');mtutLift(f,'50% 50%');const r=f.getBoundingClientRect();put(q('.mtLb2'),r.left+r.width/2-80,r.top-30,160);}
  if(k==='tri'){const el=$('hud-tri');mtutLift(el,'50% 0%');const r=el.getBoundingClientRect(),w=Math.min(440,W*0.7);put(T,r.left+r.width/2-w/2,r.bottom+46,w);}
  if(k==='life'){const el=$('hud-stat');mtutLift(el,'0% 0%');const r=el.getBoundingClientRect();put(T,r.left+6,r.bottom+40,Math.min(440,W*0.55));}
  if(k==='collect'){put(T,Math.max(W*0.05,52),H*0.42,Math.min(300,W*0.38));
    // the nearest floating cluster and the hold, wherever they are now (at the edge with their arrow if off screen); the hold marker shows even with an empty tank
    const holes=[],mk=mtutLoose(),bod=$('hBod');
    if(bod.hidden&&!ZONES[2].nest){bod.hidden=false;h4apply(bod,h4proj(HATCH),bod.children[0],0,28);MTUT.bod=true;tcAvoid();} // clear of DISPARAR, as always
    if(mk&&!bod.hidden){const A=mk.getBoundingClientRect(),B=bod.getBoundingClientRect(); // both stuck to the same edge: keep them apart
      if(A.left<B.right&&B.left<A.right&&A.top<B.bottom&&B.top<A.bottom){const x=A.left+A.width/2>W/2?A.left-B.width/2-14:A.right+B.width/2+14;
        bod.style.left=Math.round(x)+'px';bod.style.top=Math.round(A.top+A.height/2)+'px';}}
    [[mk,1],[bod.hidden?null:bod,2]].forEach(([el,num])=>{if(!el)return;el.classList.remove('mid');mtutLift(el,'50% 50%');
      const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,b=L.querySelectorAll('.mtN')[num-1];
      holes.push(`radial-gradient(circle at ${Math.round(cx)}px ${Math.round(cy)}px, transparent 46px, #000 86px)`);
      let by=r.top-32;if(by<60)by=r.bottom+6; // the number sits just above its marker (below if that is under the top panels)
      b.style.display='';put(b,Math.min(W-34,Math.max(8,cx-13)),by);});
    if(holes.length){D.style.webkitMaskImage=D.style.maskImage=holes.join(',');D.style.webkitMaskComposite='source-in';D.style.maskComposite='intersect';}}
  L.classList.remove('in');void L.offsetWidth;L.classList.add('in');mtutTitle(0);}
// the title spins through random glyphs and locks in from left to right in about 0.35 s
const MT_G='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&$';
function mtutTitle(ms){if(MTUT.tLock)return;const t=MTUT.title,h=MTUT.L.querySelector('.mtH');let o='';
  for(let i=0;i<t.length;i++){const c=t[i],lock=70+i/Math.max(1,t.length-1)*280;o+=(c===' '||ms>=lock)?c:MT_G[Math.random()*MT_G.length|0];}
  h.textContent=o;if(ms>=360){h.textContent=t;MTUT.tLock=true;}}
function mtutNext(){if(++MTUT.i>=MTUT.list.length)mtutEnd();else mtutShow();}
function mtutEnd(){if(!MTUT.on)return;mtutDrop();MTUT.on=false;MTUT.D.hidden=MTUT.L.hidden=true;document.body.classList.remove('mtut');
  MTUT.done=true;try{localStorage.setItem('heads_tut','1');}catch(_){}
  P.inv=Math.max(P.inv,1.2); // a moment of grace when the game starts again
  // the side tips that say the same no longer need to show
  TIP.done.shoot=TIP.done.suck=TIP.done.deliver=1;TUT.shown.eat=TUT.shown.leak=1;}
// every frame while it is open (the game is frozen): title, bar, and passing on its own · the pause menu on top stops the clock
function mtutFrame(){const now=performance.now();if(TC.paused)MTUT.t0+=now-MTUT.last;MTUT.last=now;
  const el=now-MTUT.t0;mtutTitle(el);MTUT.L.querySelector('.mtBar i').style.width=Math.min(100,el/MTUT.dur*100).toFixed(1)+'%';
  if(!TC.paused&&el>=MTUT.dur+(MTUT.k==='life'?800:0))mtutNext();}
// every frame of play: open it after MTUT.at s of play the first time, and step 4 on its own when trichomes first float
function mtutTick(){if(!isTouch||MTUT.on||window.__noTut||state!=='play'||CINE.on||TC.paused||!MHUD.on)return;
  if(!MTUT.done&&playT>=MTUT.at){mtutStart();return;}
  if(MTUT.later4&&mtutLoose()){MTUT.later4=false;mtutOpen(['collect']);}}
// pause menu: CÓMO SE JUEGA shows it all again
function mtutAgain(){MTUT.later4=false;tcSetPause(false);mtutOpen(MTUT_ORDER.slice());}
