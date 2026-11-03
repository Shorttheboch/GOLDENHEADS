/* ================= METRICS (v81) ================= */
// Anonymous play metrics for Santi: how people play, how far they get and from where, to improve the game (no contest, no accounts yet).
// Server: netlify/functions/metrics.mts (POST /api/m, relative path: no domain anywhere) -> Supabase (supabase/schema.sql). Santi reads them at /admin (public/admin.html).
// Events, about 3 requests a game (Netlify bills every call):
//   visit · once per page load, when the first game starts (just after JUGAR, or after the opening film when it plays) or on page hide if no game started:
//           PC/touch, OS, browser, language, screen class, installed, load time until JUGAR was enabled, film watched / skipped
//   end   · endGame (25-end-plate.js): round, cause, play time, score, kills, bosses, eggs, EXTRA POWER, repairs, phone tutorial, quality level, median fps, time per round
//   quit  · the page is hidden or closed mid-game (sendBeacon): the round where they left. If they come back and finish, the end event of that game wins (SQL).
//   error · window error / unhandledrejection, at most 5 different ones a session; they ride along with the next event or the page hide (no request of their own)
// Every event: session id (random, in memory only), version, platform/OS/browser/language, test:true for ?ronda=N games (38-ronda.js); the player id only with consent.
// Consent, Santi's option B: the start menu asks once (#mtAsk in index.html, look in src/styles/10-metricas.css). YES = a random anonymous player id is kept in
// localStorage (heads_pid) so returning players can be counted. NO or no answer = the same anonymous events, and nothing on the device but the answer (heads_stats).
// Off on localhost / file: (the RANK rule of 26-ranking.js) and in test builds (window.__noMetrics, tools/test-hooks.json). Nothing runs per frame; it never throws.
const MT_VER='v81';
const MT={on:/^https?:$/.test(location.protocol)&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)&&!window.__noMetrics,
  sid:mtId(),pid:null,cs:'unset',visit:false,go:false,ready:null,film:null,g:0,gm:null,quitK:'',err:[],errK:new Set(),env:null};
function mtId(){try{const a=new Uint8Array(12);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
  catch(_){let s='';for(let i=0;i<24;i++)s+=(Math.random()*16|0).toString(16);return s;}}
const mtLS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(_){}return null;};
// the answer to the question, and with YES the anonymous player id
function mtConsentLoad(){const c=mtLS('heads_stats');MT.cs=c==='1'?'yes':c==='0'?'no':'unset';MT.pid=null;
  if(MT.cs==='yes'){let p=mtLS('heads_pid');if(!/^[0-9a-f]{24}$/.test(p||'')){p=mtId();mtLS('heads_pid',p);}MT.pid=p;}}
mtConsentLoad();
// device, once: OS and browser family from the user agent (iPadOS reports itself as a Mac with touch), screen class from the screen size in CSS px
MT.env=(()=>{try{const ua=navigator.userAgent||'',W=Math.max(screen.width,screen.height),H=Math.min(screen.width,screen.height);
  const os=instIOS()?'ios':/Android/.test(ua)?'android':/Windows/.test(ua)?'windows':/Macintosh|Mac OS X/.test(ua)?'mac':'other';
  const br=/Edg(e|A|iOS)?\//.test(ua)?'edge':/OPR\/|OPT\/|Opera/.test(ua)?'opera':/SamsungBrowser/.test(ua)?'samsung':/Firefox\/|FxiOS/.test(ua)?'firefox':/CriOS|Chrome\/|Chromium/.test(ua)?'chrome':/Safari\//.test(ua)?'safari':'other';
  return {os,br,scr:isTouch?(H<500?'phone':'tablet'):(W<1366?'pc-s':W<=1920?'pc-m':'pc-l'),bl:(navigator.language||'').slice(0,2).toLowerCase()};}
 catch(_){return {os:'other',br:'other',scr:isTouch?'phone':'pc-m',bl:''};}})();
function mtBase(kind){const e={kind,sid:MT.sid,ver:MT_VER,plat:isTouch?'touch':'pc',os:MT.env.os,br:MT.env.br,lang:window.I18N&&I18N.lang==='en'?'en':'es'};
  if(MT.pid)e.pid=MT.pid;if(RONDA.n)e.test=true;return e;}
// one request for everything pending (the errors ride along); page hide uses sendBeacon, the rest fetch with keepalive. Never throws, never waits.
function mtSend(list,beacon){if(!MT.on)return;
  try{list=list.filter(Boolean);for(const x of MT.err.splice(0))list.push(Object.assign(mtBase('error'),{msg:x.msg,at:x.at,n:x.n}));if(!list.length)return;
    const body=JSON.stringify({e:list.slice(0,12)});
    if(beacon&&navigator.sendBeacon&&navigator.sendBeacon('/api/m',body))return;
    fetch('/api/m',{method:'POST',body,keepalive:true,headers:{'content-type':'application/json'}}).catch(()=>{});}catch(_){}}
// ---- visit: load time (JUGAR enabled, ms from the start of the page), JUGAR pressed, the opening film ----
{const pl=$('play'),f=()=>{if(MT.ready===null&&!pl.disabled)MT.ready=performance.now();};f();
 if(MT.ready===null){const mo=new MutationObserver(()=>{f();if(MT.ready!==null)mo.disconnect();});mo.observe(pl,{attributes:true,attributeFilter:['disabled']});}
 pl.addEventListener('click',()=>{MT.go=true;});}
// how the film went, read when the first game starts (27-opening.js calls the game's start right from the film's end, while the video still has its src)
function mtFilm(){const v=$('opVid');if(!v||!v.getAttribute('src'))return {film:'none'};
  const c=v.currentTime||0,d=v.duration||30;
  if(v.error||(v.paused&&!v.ended&&c<0.1))return {film:'error'};
  return v.ended||c>=d-0.6?{film:'watched'}:{film:'skipped',filmS:Math.round(c)};}
function mtVisit(){if(MT.visit)return null;MT.visit=true;
  const e=Object.assign(mtBase('visit'),{scr:MT.env.scr,blang:MT.env.bl,inst:instInstalled(),go:MT.go,ready:MT.ready!==null,consent:MT.cs});
  if(MT.ready!==null)e.load=Math.round(MT.ready);
  if(MT.film)Object.assign(e,MT.film);
  else if(MT.go&&!$('opening').hidden)Object.assign(e,{film:'left',filmS:Math.round($('opVid').currentTime||0)}); // the page goes away during the film
  return e;}
// ---- one game: reset() (24-game-state.js) -> mtStart, startWave -> mtRound, the phone tutorial -> mtTut, the quality loop -> mtFps, endGame -> mtEnd ----
function mtStart(){if(!MT.on)return;MT.g++;MT.quitK='';MT.go=true; // (a game starting = JUGAR was pressed: 27-opening.js may start it inside the same click, before the listener above runs)
  MT.gm={rt:[],w:-1,wt:0,tut0:!isTouch||MTUT.done,tut:null,tutStep:0,qMax:QA.lvl,fps:[]};
  if(!MT.visit){MT.film=mtFilm();mtSend([mtVisit()]);}}
function mtRound(){const G=MT.gm;if(!G)return;if(G.w>=0&&G.rt.length<60)G.rt.push(Math.max(0,Math.round(playT-G.wt)));G.w=wave;G.wt=playT;} // seconds of each round (its breather included)
function mtTut(skip){const G=MT.gm;if(G&&!G.tut0&&!G.tut){G.tut=skip?'skip':'done';G.tutStep=skip||0;}} // the first phone tutorial: SALTAR (at which screen) or seen to the end
function mtFps(){const G=MT.gm;if(!G)return;if(G.fps.length<7200)G.fps.push(Math.round(QA.fps));if(QA.lvl>G.qMax)G.qMax=QA.lvl;} // once a second of real play, after the quality decision
function mtEnd(reason,acc){const G=MT.gm;if(!MT.on||!G)return;mtRound();MT.gm=null;
  const f=G.fps.slice().sort((a,b)=>a-b),e=Object.assign(mtBase('end'),{game:MT.g,round:wave+1,cause:reason,secs:Math.round(playT),
    score:Math.round(score+pts),combat:Math.round(pts),cargo:Math.round(score),kills:stats.kills,heads:stats.heads,acc,
    xp:stats.xp,eggs:stats.eggs,eggsK:stats.eggsKilled,spit:stats.spitters,inc:stats.incs||0,rep:repairs,q:QA.lvl,qMax:Math.max(G.qMax,QA.lvl),rt:G.rt});
  if(isTouch){e.tut=G.tut||(G.tut0?'before':'none');if(G.tutStep)e.tutStep=G.tutStep;}
  if(f.length)e.fps=f[f.length>>1];if(RONDA.n)e.r0=RONDA.n;
  mtSend([e]);}
function mtQuit(){if(!MT.gm||state!=='play')return null;const k=MT.g+':'+(wave+1);if(MT.quitK===k)return null;MT.quitK=k; // once per game and round (visibilitychange and pagehide both fire)
  return Object.assign(mtBase('quit'),{game:MT.g,round:wave+1,secs:Math.round(playT),score:Math.round(score+pts)});}
// page hidden or closed: the visit if it never went, a quit if a game is running, and the pending errors, in one beacon
function mtHide(){if(!MT.on)return;try{mtSend([mtVisit(),mtQuit()],true);}catch(_){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')mtHide();});
addEventListener('pagehide',mtHide);
// ---- errors: message trimmed, file:line, at most 5 different ones a session (the same one again only counts up while it waits) ----
function mtErr(msg,at){if(!MT.on)return;msg=String(msg||'').replace(/\s+/g,' ').trim().slice(0,200);if(!msg)return;at=String(at||'').slice(0,120);const k=msg+'|'+at;
  if(MT.errK.has(k)){const o=MT.err.find(x=>x.k===k);if(o)o.n++;return;}
  if(MT.errK.size>=5)return;MT.errK.add(k);MT.err.push({k,msg,at,n:1});}
const mtAt=(file,l,c)=>file?String(file).split(/[?#]/)[0].split('/').pop()+(l?':'+l+(c?':'+c:''):''):'';
addEventListener('error',e=>{try{mtErr(e.message||(e.error&&e.error.message),mtAt(e.filename,e.lineno,e.colno));}catch(_){}});
addEventListener('unhandledrejection',e=>{try{const r=e.reason,s=r&&r.stack&&/([^\s/()]+\.js):(\d+):(\d+)/.exec(r.stack);mtErr('(promesa) '+(r&&r.message||r),s?mtAt(s[1],s[2],s[3]):'');}catch(_){}});
// ---- the question on the start menu (PC: top left, mirroring ES/EN · phone: in the top strip between the logo and ES/EN; it never covers JUGAR, ES/EN or PANTALLA COMPLETA)
// It comes in once the menu intro is done (#menu.mgo in CSS, or after a while if the menu art failed), only while the question is open and only where metrics are on.
{const ask=$('mtAsk');
 if(ask&&MT.on&&MT.cs==='unset'){ask.hidden=false;
   if(window.LANG_READY)LANG_READY.then(()=>setTimeout(()=>{if(!$('menu').classList.contains('mgo'))ask.classList.add('now');},6000));
   const answer=yes=>{mtLS('heads_stats',yes?'1':'0');if(!yes)mtLS('heads_pid',null);mtConsentLoad();try{window.menuSfx&&menuSfx('button');}catch(_){}
     ask.classList.add('out');setTimeout(()=>{ask.hidden=true;},320);};
   ask.addEventListener('click',e=>{e.stopPropagation();const b=e.target.closest('button[data-a]');if(b)answer(b.dataset.a==='yes');});
   ask.addEventListener('keydown',e=>{if(['Enter','NumpadEnter','Space'].includes(e.code))e.stopPropagation();});} // answering with the keyboard does not also start the game
 else if(ask)ask.remove();}
