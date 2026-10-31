// ---- end plate (v44, Santi's design): live gold-3D lettering so every title and language stays sharp ----
const ENDP={t0:0,raf:0};
const escH=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
function g3(t){t=escH(t);return `<div class="g3" data-t="${t}"><i data-t="${t}">${t}</i></div>`;}
function setG3(el,t){const g=el.querySelector('.g3'),i=g&&g.firstElementChild;if(!i)return;t=String(t);if(i.textContent===t)return;i.textContent=t;i.dataset.t=t;g.dataset.t=t;}
const ORN='<svg class="orn" viewBox="0 0 130 40" aria-hidden="true"><path d="M2 8H62L84 30H117"/><circle cx="123" cy="30" r="4"/></svg>';
function showEndPlate(o){ // o: {title, sub, total, round, cargo, combat, rows:[[label,value]...], recHTML, isNew}
  const end=$('end');o.title=TR(o.title);o.sub=TR(o.sub);
  const w=o.title.split(' '),k=Math.ceil(w.length/2),lines=w.length>1?[w.slice(0,k).join(' '),w.slice(k).join(' ')]:[o.title];
  $('endT').innerHTML=lines.map((l,j)=>`<span class="ln">${g3(l)}${j===lines.length-1?ORN+ORN.replace('class="orn"','class="orn r"'):''}</span>`).join('');
  $('endT').setAttribute('aria-label',o.title);
  $('endS').firstChild.textContent=o.sub;
  $('bigScore').innerHTML='<span class="ln">'+g3('0')+'</span>';$('bigScore').classList.remove('pop');
  $('endRound').innerHTML=`RONDA <b>${o.round}</b><em>·</em>CARGA <b>${escH(o.cargo)}</b><em>·</em>COMBATE <b>${escH(o.combat)}</b>`;
  $('endStats').innerHTML=o.rows.map(([a,b],i)=>`<span style="--i:${i}">${escH(a)}</span><span style="--i:${i}">${escH(b)}</span>`).join('');
  const rec=$('record');rec.innerHTML=o.recHTML;rec.classList.toggle('new',!!o.isNew);
  end.classList.remove('go');end.hidden=false;void end.offsetWidth;end.classList.add('go');
  fitEndPlate();
  // the score counts up once it has landed, then pops
  cancelAnimationFrame(ENDP.raf);const t0=performance.now()+950,el=$('bigScore');
  const tick=()=>{const k=Math.max(0,Math.min(1,(performance.now()-t0)/1300)),e=1-Math.pow(1-k,3);setG3(el,fmtN(Math.round(o.total*e)));
    if(k<1)ENDP.raf=requestAnimationFrame(tick);else{el.classList.add('pop');}};
  ENDP.raf=requestAnimationFrame(tick);}
// keep the whole plate on screen however many stat lines there are
function fitEndPlate(){const b=$('endBox');if(!b||$('end').hidden)return;b.style.transform='';const h=b.offsetHeight,H=innerHeight*0.95,W=innerWidth*0.96,w=b.offsetWidth;
  const s=Math.min(1,H/h,W/w);if(s<1)b.style.transform=`scale(${s})`;}
addEventListener('resize',fitEndPlate);
function endGame(win,reason){if(state!=='play')return;state='dead';xpEnd(true);XP.streak=0;$('xpS').classList.remove('show');if(document.exitPointerLock)document.exitPointerLock();inp.fire=inp.suck=false;
  if(suckGain)suckGain.gain.value=0;if(weldG)weldG.gain.value=0;hissLevel(0);incBeamSnd(false);hideTut();$('hatchInd').hidden=true;$('repPrompt').hidden=true;$('rep').classList.remove('show');
  for(let k=0;k<4;k++)$('zi'+k).hidden=true;weldBeam.visible=false;weldLight.intensity=0;
  $('msg').style.opacity=0;msgT=0;document.body.classList.add('ended');say(reason==='ship'?'go_ship':'go_suit',5);
  const fmt=fmtN,total=score+pts,acc=stats.shots?Math.round(stats.hits/stats.shots*100):0;
  const rows=[['Arañas eliminadas',stats.kills+(stats.heads?` · ${stats.heads} headshots`:'')],['Precisión',acc+' %'],['Mejor multikill',stats.multi>=2?'×'+stats.multi:'—'],
    ['Tricomas rescatados',fmt(stats.saved)],['Tricomas perdidos',fmt(lostN)],['Reparaciones',repairs+(stats.perfect?` · ${stats.perfect} perfectas`:'')]];
  if(stats.spitters)rows.push(['Escupidoras abatidas',String(stats.spitters)]);
  if(stats.incs)rows.push(['Incineradoras abatidas',String(stats.incs)]);
  if(stats.eggs)rows.push(['Huevos destruidos',`${stats.eggsKilled} de ${stats.eggs}`]);
  rows.push(['Tricomas a bordo al final',fmt(Math.max(0,cargo))]);
  let best=null;try{best=JSON.parse(localStorage.getItem('heads_best_v3')||'null');}catch(e){}
  let recHTML,isNew=false;
  if(!best||total>best.score){try{localStorage.setItem('heads_best_v3',JSON.stringify({score:total,round:wave+1}));}catch(e){}
    isNew=total>0;recHTML=isTouch?(isNew?'<b>¡NUEVO RÉCORD!</b>':''):(isNew?'<b>¡NUEVO RÉCORD!</b> · ':'')+'Enter para reintentar';}
  else recHTML=`Récord: ${fmt(best.score)} · ronda ${best.round}`+(isTouch?'':' · Enter para reintentar');
  showEndPlate({title:reason==='ship'?'NAVE PERDIDA':reason==='cargo'?'CARGA PERDIDA':'TRAJE ROTO',
    sub:reason==='ship'?'LAS ARAÑAS DEVORARON EL CASCO':reason==='cargo'?'LOS TRICOMAS SE PERDIERON EN EL VACÍO':'SEÑAL VITAL PERDIDA',
    total,round:wave+1,cargo:fmt(score),combat:fmt(pts),rows,recHTML,isNew});
  rankShow(total,{kills:stats.kills,heads:stats.heads,acc,saved:Math.round(stats.saved),repairs});
  sfx('boom');musicEnd(2);} // v73: the music fades out over ~2 s
