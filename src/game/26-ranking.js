// ---- online ranking, Season 1 (v82: Google accounts; server netlify/functions/ranking.mts -> Supabase, supabase/v82-cuentas.sql) ----
// Every run gets a signed token from the server (rankStart in reset). At game over (rankShow, from endGame) the run is kept in RANK.pending and
// 40-cuentas.js takes over (accEnd):
//   signed in  -> the run is saved at once under the player's nickname; the box shows ¡NUEVO RÉCORD! or the season best, the place and the top,
//                 and «CAPITÁN {APODO}» with Salir / Borrar mi cuenta
//   guest      -> the top and GUARDAR MI PUNTUACIÓN (con Google): the run waits in this device (4 h) while the player signs in with Google
// The hand-typed names of v81 and before are gone: that board (Netlify Blobs) is archived as «Temporada 0», no longer shown.
const RANK={on:/^https?:$/.test(location.protocol)&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname),token:null,pending:null,seq:0,show:5};
function rankStart(){RANK.token=null;RANK.pending=null;const q=++RANK.seq;if(!RANK.on)return;
  fetch('/api/run',{method:'POST'}).then(r=>r.ok?r.json():null).then(j=>{if(q===RANK.seq&&j&&j.token)RANK.token=j.token;}).catch(()=>{});}
function rankRow(pos,e,me){return `<li class="${me?'me':''}"><i>${pos}</i><span>${escH(e.nick)}</span><em>R${e.round}</em><b>${fmtN(e.score)}</b></li>`;}
// the top (RANK.show lines) and, when I am further down, a gap and my own line; false when the board is empty
function rankRender(ol,d){if(!d||!d.top||!d.top.length){ol.innerHTML='';return false;}
  const top=d.top.slice(0,RANK.show);let h=top.map(e=>rankRow(e.pos,e,e.me)).join('');
  if(d.me&&d.me.pos>top.length)h+=`<li class="gap">···</li>`+rankRow(d.me.pos,d.me,true);
  ol.innerHTML=h;return true;}
function rankShow(total,st){const box=$('rankBox');box.hidden=true;$('rankList').innerHTML='';$('rankMsg').textContent='';$('saveBtn').hidden=true;$('acctBar').hidden=true;
  RANK.pending=null;if(!RANK.on)return;
  if(RANK.token&&total>0)RANK.pending={token:RANK.token,score:Math.round(total),round:wave+1,stats:st,secs:Math.round(playT),plat:isTouch?'touch':'pc',
    lang:window.I18N&&I18N.lang==='en'?'en':'es',at:Date.now()};
  RANK.token=null; // a run is saved once
  accEnd();} // 40-cuentas.js
$('again').addEventListener('click',()=>{tcFull();cancelAnimationFrame(ENDP.raf);$('end').hidden=true;$('end').classList.remove('go');reset();state='play';musicStart();
  if(!isTouch&&canvas.requestPointerLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}});
