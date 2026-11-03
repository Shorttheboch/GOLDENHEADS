/* ================= ACCOUNTS (v82): Google login, a nickname, every score saved under it ================= */
// Santi's decisions: you play as a guest; the login (Google only) comes at the END of a game, on the end plate: GUARDAR MI PUNTUACIÓN · con Google.
// The first time you choose a nickname (unique, checked by the server, cannot be changed afterwards; no 18+ box, just the line with the privacy
// page and the ranking rules); from then on the session stays on this device and every game is saved by itself when it ends.
// Pieces: 26-ranking.js (run token, end-plate box, RANK.pending) · this file (flow and screens) · src/cuentas/sb.js (@supabase/auth-js, its own chunk,
// loaded only when needed through window.HEADS_AUTH, src/cuentas/loader.js) · netlify/functions/ranking.mts (the referee: /api/auth, /api/me,
// /api/nick, /api/save, /api/forget) · markup #rankBox / #acct in index.html · look src/styles/11-cuentas.css · privacy page public/privacidad/.
// The login is a redirect (PKCE), so the page reloads: before leaving, the run waits in localStorage (heads_pending_run: token, score, round,
// stats; 4 h, claimed once); back from Google, over the menu: nickname if needed -> the run saved -> the full ranking (top 50, my line, place).
// VER RANKING COMPLETO (end-plate panel) opens the same screen without the header. Signed-in auto-saves do not pop it every game. The address is
// cleaned of the login's ?code= / ?error=. redirectTo is built from location (origin + path): no domain written anywhere.
// Without the Supabase settings (/api/auth 503) there is simply no button; the game never waits for any of this and never shows an error box.
// Nothing here runs per frame. The game keys are ignored while #acct is open (body.acctOn, 21-input-pc.js).
const ACC={p:null,cfgP:null,auth:null,nick:null,seq:0,busy:false,scr:'',onGo:null,onNo:null};
const ACC_K={sess:'heads-auth',pend:'heads_pending_run',go:'heads_auth_go',nick:'heads_capitan'};
const ACC_PEND_MS=4*3600e3;   // a pending run waits 4 h at most (the server's run tokens last as long)
const acLS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(_){}return null;};
ACC.nick=acLS(ACC_K.nick)||null;
const accSigned=()=>!!acLS(ACC_K.sess);
const accEn=()=>!!(window.I18N&&I18N.lang==='en');
// privacy links follow the language: privacidad/ (#normas) or privacy/ (#rules), relative to the game (no domain)
function accPrivLinks(root){for(const a of (root||document).querySelectorAll('a[data-priv]')){const n=a.dataset.priv==='normas';
  a.href=(accEn()?'privacy/':'privacidad/')+(n?(accEn()?'#rules':'#normas'):'');}}
// ---- loading: the settings (/api/auth, cached by the browser for 5 min) and the login chunk, only when needed ----
function accCfg(){if(!ACC.cfgP){ACC.cfgP=fetch('/api/auth').then(r=>r.ok?r.json():null).then(c=>c&&c.url&&c.key?c:null,()=>{ACC.cfgP=null;return null;});}return ACC.cfgP;}
function accLoad(){if(!ACC.p){ACC.p=(async()=>{const c=await accCfg();if(!c)throw new Error('off');
    const m=await window.HEADS_AUTH();const a=m.makeAuth(c.url,c.key);await a.init();ACC.auth=a;return a;})(); // (init reads the way back from Google, if any)
    ACC.p.catch(()=>{ACC.p=null;});}
  return ACC.p;}
const accPreload=()=>{try{window.HEADS_AUTH&&window.HEADS_AUTH().catch(()=>{});}catch(_){}}; // the chunk only (a static file), so the click is quick
// the function, with the session's access token unless auth:false; {s: status (0 = no network), j: answer}
async function accApi(path,o={}){const h={};let body;
  if(o.body){h['content-type']='application/json';body=JSON.stringify(o.body);}
  if(o.auth!==false){let t=null;try{t=await (await accLoad()).token();}catch(_){}if(!t)return {s:401,j:{error:'session'}};h.authorization='Bearer '+t;}
  try{const r=await fetch(path,{method:o.method||(body?'POST':'GET'),headers:h,body,cache:'no-store'});let j={};try{j=(await r.json())||{};}catch(_){}return {s:r.status,j};}
  catch(_){return {s:0,j:{error:'net'}};}}
function accSetNick(n){ACC.nick=n||null;acLS(ACC_K.nick,n||null);}
// signed out on this device: the stored session (and the login's own keys), the nickname shown
function accForgetLocal(){try{for(const k of Object.keys(localStorage))if(k===ACC_K.sess||k.startsWith(ACC_K.sess+'-'))localStorage.removeItem(k);}catch(_){}
  accSetNick(null);if(ACC.auth)ACC.auth.signOut();}
// ---- the run waiting while the player signs in ----
function accPendGet(){let p=null;try{p=JSON.parse(acLS(ACC_K.pend)||'null');}catch(_){}
  if(!p||typeof p!=='object'||typeof p.token!=='string'||!(p.at>0)){if(p)acLS(ACC_K.pend,null);return null;}
  if(Date.now()-p.at>ACC_PEND_MS){acLS(ACC_K.pend,null);return {expired:true};}
  return p;}
const accSave=(p,n)=>accApi('/api/save',{body:{token:p.token,score:p.score,round:p.round,stats:p.stats,secs:p.secs,plat:p.plat,lang:p.lang,n:n||RANK.show}});
const AC_FULL=50; // lines of the full ranking screen (the server gives 50 at most)

/* ---------- the end plate (rankShow -> accEnd) ---------- */
function accMsg(lines,cls){const m=$('rankMsg');m.className=cls||'';m.innerHTML='';for(const l of [].concat(lines).filter(Boolean)){const s=document.createElement('span');s.textContent=l;m.appendChild(s);}}
function accBar(){const b=$('acctBar'),me=!!ACC.nick&&accSigned();b.querySelector('.abMe').hidden=!me;$('acctNick').textContent=me?ACC.nick:'';
  $('acctOut').hidden=$('acctDel').hidden=!me;accPrivLinks(b);b.hidden=false;}
const accBestLine=b=>b?`Tu mejor de la temporada: ${fmtN(b.score)} · ronda ${b.round}`:'';
const accPlace=(pos,count)=>count===1?`Puesto #${pos} de 1 capitán`:`Puesto #${pos} de ${fmtN(count)} capitanes`;
const accPlaceLine=j=>j&&j.me?accPlace(j.me.pos,j.count):'';
// a saved run on the end plate: ¡NUEVO RÉCORD! or the season best, the place, the top
function accPlateSaved(j){if(j.status==='flagged')accMsg(['Partida guardada · en revisión',accBestLine(j.best)]);
  else accMsg([j.newBest?'¡NUEVO RÉCORD!':accBestLine(j.best),accPlaceLine(j)],j.newBest?'new':'');
  $('rankAll').hidden=!rankRender($('rankList'),j,{fill:true}).has;}
async function accEnd(){const seq=++ACC.seq,pend=RANK.pending,box=$('rankBox'),live=()=>seq===ACC.seq&&!$('end').hidden;
  if(accSigned()){accBar();box.hidden=false;
    if(pend){accMsg('Guardando tu partida…');fitEndPlate();return accEndSave(pend,seq);}
    const d=await fetch('/api/scores').then(r=>r.ok?r.json():null).catch(()=>null);if(!live())return;
    if(!d)return rankOff();
    $('rankAll').hidden=!rankRender($('rankList'),d,{fill:true}).has;fitEndPlate();return;}
  return accEndGuest(pend,seq);}
// guest: the top, and the button when this run can be saved and the login is configured
async function accEndGuest(pend,seq){const box=$('rankBox'),live=()=>seq===ACC.seq&&!$('end').hidden;
  const [d,cfg]=await Promise.all([fetch('/api/scores').then(r=>r.ok?r.json():null).catch(()=>null),pend?accCfg():null]);
  if(!live())return;
  if(!d)return rankOff(); // the ranking does not answer: the one column of v44
  const can=!!(pend&&cfg),R=rankRender($('rankList'),d,{fill:true,ghost:can?pend:null});
  $('rankAll').hidden=!R.has;
  if(can){$('saveBtn').hidden=false;accSaveBtn(false);accPreload();accMsg(!R.ghost?'Guarda tu puntuación con tu apodo de capitán':R.has?`Con esta partida entrarías en el puesto #${R.ghost}`:'¡Guárdala y serás el primero del ranking!');}
  accBar();box.hidden=false;fitEndPlate();}
async function accEndSave(pend,seq){const live=()=>seq===ACC.seq&&!$('end').hidden;
  const r=await accSave(pend);if(!live())return;
  if(r.s===200&&r.j.saved){accSetNick(r.j.nick);accBar();accPlateSaved(r.j);}
  else if(r.s===401||r.j.error==='google'){accForgetLocal();$('acctBar').hidden=true;return accEndGuest(pend,seq);} // the session is gone: back to the guest box (the run can still be saved)
  else if(r.j.error==='nick'){accPendSet(pend);accMsg('Elige tu apodo para guardar la partida');accOpen('nick');}
  else if(r.j.error==='banned')accMsg('Esta cuenta está fuera del ranking.');
  else if(r.j.error==='used')accMsg('Esta partida ya estaba guardada.');
  else if(r.j.error==='expired')accMsg('La partida ha caducado.');
  else if(r.s===400)accMsg('El servidor no ha aceptado esta partida.');
  else{accMsg('No se pudo guardar ahora.');const b=document.createElement('button');b.type='button';b.className='rkRetry';b.textContent='REINTENTAR';
    b.onclick=e=>{e.stopPropagation();accMsg('Guardando tu partida…');accEndSave(pend,seq);};$('rankMsg').appendChild(b);}
  fitEndPlate();}
function accPendSet(p){if(p)acLS(ACC_K.pend,JSON.stringify(p));}
function accSaveBtn(busy){const b=$('saveBtn');b.disabled=busy;b.classList.toggle('busy',busy);b.querySelector('b').textContent=busy?'ABRIENDO GOOGLE…':'GUARDAR MI PUNTUACIÓN';}
// guest: off to Google. The run waits in this device; the language picker is skipped on the way back (the player already chose).
$('saveBtn').addEventListener('click',async e=>{e.stopPropagation();const p=RANK.pending;if(!p||ACC.busy)return;ACC.busy=true;
  accPendSet(p);acLS(ACC_K.go,String(Date.now()));try{sessionStorage.setItem('heads_lang_skip','1');}catch(_){}
  accSaveBtn(true);try{window.menuSfx&&menuSfx('button');}catch(_){}
  try{const a=await accLoad();await a.signIn(location.origin+location.pathname);} // the page leaves for Google here
  catch(_){ACC.busy=false;acLS(ACC_K.go,null);accSaveBtn(false);accMsg('Google no está disponible ahora mismo. Inténtalo más tarde.');}});
$('acctOut').addEventListener('click',async e=>{e.stopPropagation();accForgetLocal();accBar();accMsg('Sesión cerrada.');fitEndPlate();});
$('acctDel').addEventListener('click',e=>{e.stopPropagation();accOpen('confirm');});
$('rankAll').addEventListener('click',e=>{e.stopPropagation();accBoard();});

/* ---------- the account screens (#acct), over the menu or the end plate ---------- */
const AC_T={ // title, text, primary, secondary
  wait:['CONECTANDO…','Volviendo de Google…'],saving:['GUARDANDO…','Guardando tu partida en el ranking…'],
  nick:['ELIGE TU APODO','Así te verán en el ranking de capitanes. Es único y no se puede cambiar después.','GUARDAR','AHORA NO'],
  saved:['¡PUNTUACIÓN GUARDADA!','','SEGUIR'],flagged:['PARTIDA EN REVISIÓN','La hemos guardado, pero saldrá en el ranking cuando la revisemos.','SEGUIR'],
  used:['YA ESTABA GUARDADA','Esta partida ya está en el ranking.','SEGUIR'],expired:['LA PARTIDA HA CADUCADO','Han pasado más de 4 horas. Juega otra: ahora se guardará sola.','SEGUIR'],
  invalid:['NO SE PUDO GUARDAR','El servidor no ha aceptado esta partida.','SEGUIR'],
  hello:['SESIÓN INICIADA','Desde ahora tus partidas se guardan solas al terminar.','SEGUIR'],
  board:['RANKING DE CAPITANES','','SEGUIR'],loading:['RANKING DE CAPITANES','Cargando…',null,'CERRAR'],
  fail:['NO SE HA INICIADO SESIÓN','Google no ha confirmado el acceso. Tu partida sigue guardada en este dispositivo unas horas.','PROBAR OTRA VEZ','AHORA NO'],
  fail0:['NO SE HA INICIADO SESIÓN','Google no ha confirmado el acceso.','PROBAR OTRA VEZ','AHORA NO'],
  off:['RANKING NO DISPONIBLE','No podemos conectar con el ranking ahora mismo. Inténtalo más tarde.','CERRAR'],
  neterr:['SIN CONEXIÓN','No se pudo hablar con el ranking. Comprueba la conexión.','REINTENTAR','AHORA NO'],
  banned:['CUENTA FUERA DEL RANKING','Esta cuenta no puede guardar partidas. Si crees que es un error, escribe a headsrescueadmin@gmail.com.','CERRAR'],
  confirm:['¿BORRAR TU CUENTA?','Se borrarán tu apodo, todas tus partidas del ranking y tu acceso con Google. No se puede deshacer.','BORRAR','CANCELAR'],
  gone:['CUENTA BORRADA','Hemos borrado tu apodo, tus partidas y tu acceso con Google.','CERRAR'],
  gonePart:['CUENTA BORRADA','Hemos borrado tu apodo y tus partidas. Para borrar también el acceso con Google, escribe a headsrescueadmin@gmail.com.','CERRAR']};
function accOpen(k,o={}){if(k==='fail'&&!accPendGet())k='fail0';if(k==='confirm')o={cap:true,go:accDelete,...o};
  const T=AC_T[k],el=$('acct');ACC.scr=k;ACC.onGo=o.go||null;ACC.onNo=o.no||null;
  el.dataset.s=k;$('acT').innerHTML='<span class="ln">'+g3(TR(T[0]))+'</span>';$('acT').setAttribute('aria-label',TR(T[0]));
  const s=$('acS');s.innerHTML='';if(T[1]){const t=document.createElement('span');t.textContent=T[1];s.appendChild(t);}
  if(o.cap&&ACC.nick){const c=document.createElement('span');c.className='acMe';c.innerHTML='<span>CAPITÁN</span> <b data-noi18n></b>';c.querySelector('b').textContent=ACC.nick;s.appendChild(c);}
  s.hidden=!s.childNodes.length;
  $('acNick').hidden=k!=='nick';$('acRes').hidden=!o.res;
  const L=$('acList');L.classList.toggle('big',!!o.big);L.scrollTop=0;L.style.maxHeight='';
  if(o.res){$('acL1').textContent=o.res.l1||'';$('acL2').textContent=o.res.l2||'';$('acL1').className=o.res.cls||'';$('acL1').hidden=!o.res.l1;$('acL2').hidden=!o.res.l2;
    if(!rankRender(L,o.res.board,{n:o.big?AC_FULL:RANK.show}).has)L.innerHTML='';}
  const go=$('acGo'),no=$('acNo');go.hidden=!T[2];no.hidden=!T[3];go.querySelector('span').textContent=T[2]||'';no.textContent=T[3]||'';
  go.className=k==='confirm'?'red':'';go.disabled=no.disabled=false;el.classList.toggle('busy',k==='wait'||k==='saving'||k==='loading');
  if(k==='nick'){$('acErr').textContent='';$('acIn').value='';$('acIn').placeholder=TR('APODO');accPrivLinks($('acNick'));}
  const was=el.hidden;el.hidden=false;document.body.classList.add('acctOn');accFit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(accFit);if(was){el.classList.remove('in');void el.offsetWidth;el.classList.add('in');}
  if(document.exitPointerLock&&document.pointerLockElement)document.exitPointerLock();
  if(o.big){accFit();accScrollMe();}
  setTimeout(()=>{if(el.hidden)return;if(k==='nick'&&!isTouch)$('acIn').focus();else if(!go.hidden&&!isTouch)go.focus();},60);}
// the full list: my line in the middle of the frame (only the list scrolls, never the page)
function accScrollMe(){const L=$('acList'),me=L.querySelector('li.me');if(!me)return;
  const y=me.offsetTop-(L.clientHeight-me.offsetHeight)/2;L.scrollTop=Math.max(0,Math.min(y,L.scrollHeight-L.clientHeight));}
// the screens are drawn for 960 x 540 and grow with bigger windows (zoom, up to x2); a long title (¡PUNTUACIÓN GUARDADA!, NO SE HA INICIADO
// SESIÓN, English...) shrinks to the width of the frame; the full list takes the height that is left, so SEGUIR is always on screen
function accFit(){const t=$('acT'),l=t.firstElementChild,b=$('acBox');if(!l||b.offsetParent===null)return;t.style.fontSize='';
  const z=Math.max(1,Math.min(2,Math.min(innerWidth/960,innerHeight/540)*0.75));b.style.zoom=z>1.02?z.toFixed(3):'';
  const L=$('acList');if(L.classList.contains('big')){L.style.maxHeight='none';const free=innerHeight-24-b.getBoundingClientRect().height,lh=L.getBoundingClientRect().height,row=L.firstElementChild?L.firstElementChild.getBoundingClientRect().height:20;
    const want=Math.max(row*3.2,Math.min(lh,lh+free));L.style.maxHeight=(want/(z>1.02?z:1)).toFixed(0)+'px';}
  const cs=getComputedStyle(b),max=b.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-8,w=l.offsetWidth*1.16; // (layout width x the scaleX of .ln: no animation in it)
  if(w>max)t.style.fontSize=(parseFloat(getComputedStyle(t).fontSize)*max/w).toFixed(1)+'px';}
addEventListener('resize',()=>{if(!$('acct').hidden)accFit();});
function accClose(){const el=$('acct');el.hidden=true;el.classList.remove('in');document.body.classList.remove('acctOn');ACC.scr='';
  if(!$('end').hidden){accBar();fitEndPlate();}}
$('acGo').addEventListener('click',e=>{e.stopPropagation();if(ACC.scr==='nick')return accNickSubmit();const f=ACC.onGo;if(f)f();else accClose();});
$('acNo').addEventListener('click',e=>{e.stopPropagation();const f=ACC.onNo;if(f)f();else accClose();});
$('acNick').addEventListener('submit',e=>{e.preventDefault();accNickSubmit();});
$('acct').addEventListener('keydown',e=>{e.stopPropagation();if(e.code==='Escape'&&!$('acNo').hidden&&!$('acNo').disabled)$('acNo').click();});
$('acct').addEventListener('click',e=>e.stopPropagation());

// a result screen from the server's answer to /api/save (also updates the end plate if it is open behind)
function accResult(r){acLS(ACC_K.pend,null); // claimed once, whatever the server said (only a network error keeps it)
  const j=r.j||{};
  if(r.s===200&&j.saved){accSetNick(j.nick);if(!$('end').hidden)accPlateSaved(j);
    const res={l1:j.status==='flagged'?accBestLine(j.best):j.newBest?'¡NUEVO RÉCORD!':accBestLine(j.best),l2:accPlaceLine(j),cls:j.newBest&&j.status!=='flagged'?'new':'',board:j};
    return accOpen(j.status==='flagged'?'flagged':'saved',{res,cap:true,big:true});} // the full ranking (top 50, my line, my place)
  if(j.error==='used')return accOpen('used',{cap:true});
  if(j.error==='expired')return accOpen('expired',{cap:true});
  if(j.error==='banned')return accOpen('banned');
  return accOpen('invalid');}
// signed in: nickname? then the pending run
async function accAfterLogin(){accOpen('wait');
  const r=await accApi('/api/me');
  if(r.s===401||r.j.error==='google'){accForgetLocal();return accOpen('fail',{go:accRelogin});}
  if(r.s!==200)return accOpen('neterr',{go:accAfterLogin,no:accDrop});
  if(!r.j.player)return accOpen('nick',{no:accDrop});
  accSetNick(r.j.player.nick);
  if(r.j.player.banned){acLS(ACC_K.pend,null);return accOpen('banned');}
  return accClaim(r.j.player);}
async function accClaim(player){const p=accPendGet();
  if(!p){const b=player&&player.best,res=b?{l1:accBestLine(b),l2:player.pos?accPlace(player.pos,player.count):''}:null;return accOpen('hello',{cap:true,res});}
  if(p.expired)return accOpen('expired',{cap:true});
  accOpen('saving');
  const r=await accSave(p,AC_FULL);
  if(r.s===0||r.s>=500||r.s===429)return accOpen('neterr',{go:()=>accClaim(player),no:accDrop});
  if(r.s===401){accForgetLocal();return accOpen('fail',{go:accRelogin});}
  if(r.j.error==='nick')return accOpen('nick',{no:accDrop});
  return accResult(r);}
// VER RANKING COMPLETO: the full screen without the saved header (with my line and place when signed in)
async function accBoard(){if(ACC.scr)return;accOpen('loading');const signed=accSigned();
  let r=signed?await accApi('/api/scores?n='+AC_FULL+'&me=1'):{s:401};
  if(r.s===401||r.s===403){if(r.s===401&&signed&&r.j.error==='session')accForgetLocal();
    r=await fetch('/api/scores?n='+AC_FULL,{cache:'no-store'}).then(async x=>({s:x.status,j:x.ok?await x.json():{}}),()=>({s:0,j:{}}));}
  if(ACC.scr!=='loading')return; // closed meanwhile
  if(r.s!==200)return accOpen('neterr',{go:()=>{accClose();accBoard();}});
  const d=r.j,res={l1:d.me?accPlace(d.me.pos,d.count):d.count?(d.count===1?'Temporada 1 · 1 capitán':`Temporada 1 · ${fmtN(d.count)} capitanes`):'Aún no hay nadie en el ranking: ¡sé el primero!',board:d};
  accOpen('board',{res,big:true,cap:!!d.me});}
// "AHORA NO" while a run waits: the player chose not to save it
function accDrop(){acLS(ACC_K.pend,null);accClose();}
async function accRelogin(){accOpen('wait');acLS(ACC_K.go,String(Date.now()));try{sessionStorage.setItem('heads_lang_skip','1');}catch(_){}
  try{const a=await accLoad();await a.signIn(location.origin+location.pathname);}catch(_){acLS(ACC_K.go,null);accOpen('off');}}
// ---- the nickname ----
const AC_NICK=/^[A-Z0-9ÁÉÍÓÚÜÑÇÀÈÒÏ._-]{3,12}$/; // the same letters as the server (ranking.mts checkNick) and the table (supabase/v82b-apodos.sql)
const AC_ERR={format:'Usa de 3 a 12 letras o números (también . _ -), sin espacios.',short:'Necesita al menos 3 letras o números.',
  taken:'Ese apodo ya es de otro capitán. Prueba otro.',bad:'Ese apodo no está permitido.',reserved:'Ese apodo está reservado.',
  many:'Demasiados intentos. Espera unos minutos.',other:'No se pudo guardar el apodo. Inténtalo otra vez.'};
function accNickErr(k){const e=$('acErr');e.textContent=AC_ERR[k]||AC_ERR.other;$('acIn').setAttribute('aria-invalid','true');}
async function accNickSubmit(){if(ACC.busy)return;const v=$('acIn').value.normalize('NFC').trim().toUpperCase();
  if(!AC_NICK.test(v))return accNickErr('format');
  if(v.replace(/[._-]/g,'').length<3)return accNickErr('short');
  ACC.busy=true;$('acErr').textContent='';$('acIn').removeAttribute('aria-invalid');$('acGo').disabled=$('acNo').disabled=true;$('acct').classList.add('busy');
  const r=await accApi('/api/nick',{body:{nick:v,accept:true}});
  ACC.busy=false;$('acGo').disabled=$('acNo').disabled=false;$('acct').classList.remove('busy');
  if(r.s===200&&r.j.ok||r.j.error==='exists'){accSetNick(r.j.nick);return accClaim({});}
  if(r.s===401||r.j.error==='google'){accForgetLocal();return accOpen('fail',{go:accRelogin});}
  accNickErr(r.s===429?'many':r.j.error);if(!isTouch)$('acIn').focus();}
// ---- deleting the account (the in-game confirmation, never window.confirm) ----
async function accDelete(){if(ACC.busy)return;ACC.busy=true;$('acGo').disabled=$('acNo').disabled=true;$('acct').classList.add('busy');
  const r=await accApi('/api/forget',{method:'POST'});
  ACC.busy=false;$('acct').classList.remove('busy');
  if(r.s===200||r.s===502&&r.j.error==='auth'){accForgetLocal();acLS(ACC_K.pend,null);
    if(!$('end').hidden)accMsg('Cuenta borrada.');return accOpen(r.s===502?'gonePart':'gone');}
  $('acGo').disabled=$('acNo').disabled=false;const s=$('acS');let e=s.querySelector('.acErr2');if(!e){e=document.createElement('span');e.className='acErr2';s.appendChild(e);}
  e.textContent=r.s===401?'Tu sesión ha caducado: vuelve a entrar con Google para borrar la cuenta, o escríbenos a headsrescueadmin@gmail.com.':'No se pudo borrar ahora. Inténtalo otra vez.';}

/* ---------- page load: back from Google, or a session kept on this device ---------- */
function accCleanUrl(){try{const u=new URL(location.href);let ch=false;
  for(const k of ['code','error','error_description','error_code','state','sb','sb_flow_id'])if(u.searchParams.has(k)){u.searchParams.delete(k);ch=true;}
  if(/(^|&)(access_token|error)=/.test(u.hash.slice(1))){u.hash='';ch=true;}
  if(ch)history.replaceState(history.state,'',u.pathname+u.search+u.hash);}catch(_){}}
async function accReturn(){acLS(ACC_K.go,null);accOpen('wait');
  let a=null;try{a=await accLoad();}catch(_){}
  accCleanUrl();
  if(!a)return accOpen('off',{go:()=>{acLS(ACC_K.pend,null);accClose();}});
  const t=await a.token().catch(()=>null);
  if(!t)return accOpen('fail',{go:accRelogin,no:accDrop}); // cancelled at Google, or the code could not be exchanged
  return accAfterLogin();}
{let q=null;try{q=new URLSearchParams(location.search);}catch(_){}
 const hasVer=()=>{try{return Object.keys(localStorage).some(k=>k.startsWith(ACC_K.sess+'-code-verifier')||k.startsWith(ACC_K.sess+'-flow-'));}catch(_){return false;}}; // auth-js keeps the PKCE verifier here
 const back=!!q&&(q.has('code')||q.has('error')||q.has('error_description'))&&(!!acLS(ACC_K.go)||hasVer());
 // the language is known: the sentence with links is translated whole (its English links already point to privacy/), then every privacy link
 const lang=(window.LANG_READY||Promise.resolve()).then(()=>{if(window.TRH)for(const el of $('acct').querySelectorAll('[data-rich]'))el.innerHTML=TRH(el.innerHTML);accPrivLinks();});
 if(RANK.on&&back){opSeen=true;lang.then(accReturn);} // back from Google: this visit already went through the film before the game that is being saved
 else{
   // a session kept on this device: the login chunk comes in quietly once the game is ready, so the save at the end of the game is quick
   if(RANK.on&&accSigned()){const pl=$('play'),go=()=>setTimeout(()=>{accLoad().catch(()=>{});},3000);
     if(!pl.disabled)go();else{const mo=new MutationObserver(()=>{if(!pl.disabled){mo.disconnect();go();}});mo.observe(pl,{attributes:true,attributeFilter:['disabled']});}}}}
// the player came back with the browser's Back button from Google (page kept in memory): the button works again
addEventListener('pageshow',e=>{if(e.persisted&&ACC.busy&&!ACC.scr){ACC.busy=false;acLS(ACC_K.go,null);accSaveBtn(false);}});
