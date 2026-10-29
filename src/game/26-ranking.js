// ---- online ranking (Netlify Functions + Blobs: web/netlify/functions/ranking.mts) ----
// Every run gets a signed token from the server (rankStart in reset); at game over the player types a name and saves the run once.
// TEMPORARY: names are typed by hand. Player accounts (Google/Apple login, Supabase) will replace this: see claude/ranking-cuentas-plan.md in the project.
const RANK={on:/^https?:$/.test(location.protocol)&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname),token:null,sent:false,pending:null,seq:0,show:5};
const rkL=(es,en)=>window.I18N&&I18N.lang==='en'?en:es;
function rankStart(){RANK.token=null;RANK.sent=false;RANK.pending=null;const q=++RANK.seq;if(!RANK.on)return;
  fetch('/api/run',{method:'POST'}).then(r=>r.ok?r.json():null).then(j=>{if(q===RANK.seq&&j&&j.token)RANK.token=j.token;}).catch(()=>{});}
function rankRow(pos,e,me){return `<li class="${me?'me':''}"><i>${pos}</i><span>${escH(e.name)}</span><em>R${e.round}</em><b>${fmtN(e.score)}</b></li>`;}
function rankRender(d,myId){const ol=$('rankList');if(!d||!d.top||!d.top.length){ol.innerHTML='';return;}
  const top=d.top.slice(0,RANK.show);let h=top.map((e,i)=>rankRow(i+1,e,myId&&e.id===myId)).join('');
  if(myId&&d.rank>top.length&&d.me)h+=`<li class="gap">···</li>`+rankRow(d.rank,d.me,true);
  ol.innerHTML=h;}
function rankShow(total,st){const box=$('rankBox');box.hidden=true;$('rankList').innerHTML='';
  if(!RANK.on)return;const can=!!RANK.token&&total>0;
  $('rankH').textContent=rkL('RANKING DE CAPITANES','CAPTAINS LEADERBOARD');$('rankName').placeholder=rkL('TU NOMBRE','YOUR NAME');$('rankSend').textContent=rkL('GUARDAR','SAVE');
  RANK.pending={score:Math.round(total),round:wave+1,stats:st};
  $('rankForm').hidden=!can;$('rankSend').disabled=!can;
  $('rankMsg').textContent=can?rkL('Escribe tu nombre y guarda la partida','Type your name and save this run'):'';
  if(can){let nm='';try{nm=localStorage.getItem('heads_name')||'';}catch(_){}$('rankName').value=nm;box.hidden=false;}
  fitEndPlate();
  fetch('/api/scores').then(r=>r.ok?r.json():null).then(d=>{if(!d||RANK.sent||$('end').hidden)return;
    if(d.top&&d.top.length)box.hidden=false;rankRender(d);fitEndPlate();}).catch(()=>{});}
$('rankForm').addEventListener('submit',e=>{e.preventDefault();if(RANK.sent||!RANK.token||!RANK.pending)return;
  const name=$('rankName').value.trim().slice(0,12);try{localStorage.setItem('heads_name',name);}catch(_){}
  RANK.sent=true;$('rankSend').disabled=true;$('rankMsg').textContent=rkL('Guardando…','Saving…');$('rankName').blur();
  fetch('/api/scores',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:RANK.token,name,...RANK.pending})})
    .then(r=>r.json().catch(()=>({})).then(j=>({ok:r.ok,j})))
    .then(({ok,j})=>{if(!ok)throw new Error(j.error||rkL('error del servidor','server error'));
      $('rankForm').hidden=true;$('rankMsg').innerHTML=rkL(`Puesto <b>#${j.rank}</b> de ${fmtN(j.count)} partidas`,`Rank <b>#${j.rank}</b> of ${fmtN(j.count)} runs`);
      rankRender(j,j.id);fitEndPlate();})
    .catch(err=>{RANK.sent=false;$('rankSend').disabled=false;$('rankMsg').textContent=rkL('No se pudo guardar: ','Could not save: ')+err.message;});});
$('again').addEventListener('click',()=>{tcFull();cancelAnimationFrame(ENDP.raf);$('end').hidden=true;$('end').classList.remove('go');reset();state='play';
  if(!isTouch&&canvas.requestPointerLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}});
