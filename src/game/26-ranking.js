// ---- online ranking, Season 1 (v82: Google accounts; server netlify/functions/ranking.mts -> Supabase, supabase/v82-cuentas.sql) ----
// Every run gets a signed token from the server (rankStart in reset). At game over (rankShow, from endGame) the run is kept in RANK.pending,
// the end plate opens in two columns (#endBox.rk: the run on the left, the Season 1 panel on the right) with the top 5 loading, and
// 40-cuentas.js takes over (accEnd):
//   signed in  -> the run is saved at once under the player's nickname; the panel shows ¡NUEVO RÉCORD! or the season best, the place, the top 5
//                 with my line, VER RANKING COMPLETO and «CAPITÁN {APODO}» with Salir / Borrar mi cuenta (no full screen every game)
//   guest      -> the top 5 (where this unsaved score would enter, as a «TÚ» line) and GUARDAR MI PUNTUACIÓN (con Google): the run waits in this
//                 device (4 h) while the player signs in; after saving, the full ranking screen opens (40-cuentas.js)
//   ranking down (or a ?ronda=N game) -> the one column of v44, no panel
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
// the ranking does not answer: back to the one column of v44
function rankOff(){$('rankBox').hidden=true;$('endBox').classList.remove('rk');fitEndPlate();}
function rankShow(total,st){const box=$('rankBox');$('rankMsg').textContent='';$('saveBtn').hidden=true;$('acctBar').hidden=true;$('rankAll').hidden=true;
  RANK.pending=null;box.hidden=!RANK.on;$('endBox').classList.toggle('rk',RANK.on);
  if(!RANK.on){$('rankList').innerHTML='';fitEndPlate();return;}
  if(RANK.token&&total>0)RANK.pending={token:RANK.token,score:Math.round(total),round:wave+1,stats:st,secs:Math.round(playT),plat:isTouch?'touch':'pc',
    lang:window.I18N&&I18N.lang==='en'?'en':'es',at:Date.now()};
  RANK.token=null; // a run is saved once
  rankLoading();fitEndPlate();
  accEnd();} // 40-cuentas.js
$('again').addEventListener('click',()=>{tcFull();cancelAnimationFrame(ENDP.raf);$('end').hidden=true;$('end').classList.remove('go');reset();state='play';musicStart();
  if(!isTouch&&canvas.requestPointerLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}});
