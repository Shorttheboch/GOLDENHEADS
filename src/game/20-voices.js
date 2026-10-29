/* ================= CREW VOICES (radio) ================= */
// P = piloto (gold subtitles), I = ingeniería (cyan). Text mirrors the recordings in assets/vo_es.js
const VO_LINES={
  int_01:['P','¡Capitán, aquí tu piloto! ¡La nave está llena de arañas!'],int_02:['P','¡Dispárales! ¡Que no se acerquen a la nave!'],
  tut_eat:['I','¡Capitán, aquí ingeniería! ¡Se están comiendo el casco!'],tut_leak:['I','¡Perdemos tricomas! ¡Aspíralos antes de que se alejen!'],
  tut_deliver:['P','Tráelos a la bodega. El anillo verde.'],tut_repair:['I','¡Despejado! Ve al agujero del casco y suéldalo.'],
  tut_windup:['P','¡Si se agachan y les brillan los ojos, saltan! ¡Esquiva!'],
  rnd_start_01:['P','¡Ahí vienen!'],rnd_start_02:['P','¡Más arañas en el radar! ¡Son muchas!'],rnd_start_03:['P','¡Siguiente oleada, capitán! ¡Ojos abiertos!'],
  rnd_clear_01:['P','¡Oleada limpia! ¡Carga asegurada!'],rnd_clear_02:['P','Era la última… ¡por ahora!'],
  zn_eng_hit:['I','¡Arañas en los motores!'],zn_rea_hit:['I','¡Están en el reactor!'],zn_hold_hit:['P','¡Atacan la bodega! ¡Van a por la carga!'],
  zn_cock_hit:['P','Están en la cabina… justo encima de mí.'],zn_hold_nest:['P','¡Perdimos la bodega! ¡La carga se sale!'],zn_sealed:['I','Brecha sellada. ¡Buen trabajo!'],
  hull_25:['I','¡Casco al veinticinco por ciento! ¡No aguanta mucho más!'],pl_hit:['P','¡Te han dado!'],pl_low:['P','¡Tu traje falla! ¡Apártate!'],
  cg_leak_big:['P','¡Estamos perdiendo carga!'],tn_01:['P','Aguanta, preciosa. Aguanta.'],tn_02:['I','Si llegan al núcleo, estamos acabados.'],
  int_03:['P','¡Capitán, nos atacan! ¡Sal y quítalas del casco!'],tut_head:['P','¡Apunta entre los ojos! ¡Ahí es donde les duele!'],
  tanda_01:['P','¡Vuelven! ¡Otra tanda!'],tanda_02:['P','¡Ahí vienen más! ¡Prepárate!'],calm_01:['I','Se han calmado. ¡Suelda rápido, que vuelven!'],
  hs_01:['P','¡En toda la cabeza!'],hs_02:['P','¡Justo entre los ojos!'],streak_01:['P','¡Qué puntería, capitán!'],multi_01:['P','¡Varias de golpe! ¡Sigue así!'],
  pu_drop:['P','¡Premio flotando! ¡Cógelo antes de que se pierda!'],pu_nuke:['I','¡Descarga en el casco! ¡Fritas!'],pu_fix:['I','¡Reparación total! ¡El casco está como nuevo!'],
  pu_over:['P','¡Sobrecarga! ¡Cada tiro es una muerte!'],pu_dbl:['P','¡Puntos dobles! ¡Aprovecha!'],pu_mag:['I','¡Imán activado! ¡La carga vuelve sola!'],
  rnd_start_04:['P','¡Siguiente ronda! ¡Vienen con hambre!'],rnd_start_05:['I','Detecto movimiento en el casco. ¡Vienen más!'],
  rnd_clear_03:['P','¡Ronda superada! ¡Buen trabajo, capitán!'],rnd_clear_04:['I','Casco despejado. Revisa los daños.'],
  sp_land:['I','¡Algo grande ha aterrizado en el casco! ¡Una escupidora!'],sp_spit:['P','¡Ácido! ¡Muévete!'],sp_dead:['P','¡Escupidora abatida! ¡Increíble!'],
  go_ship:['P','La estamos perdiendo… Capitán, lo siento…'],go_suit:['P','¿Capitán? ¡Capitán! …Sin señal.'],
  pu_weld:['I','¡Soldadura rápida! ¡Suelda todo lo que puedas!'],
  pu_pack:['I','¡Imán en la mochila! ¡Acércate a los tricomas!'],
  inc_land:['I','¡Algo enorme ha caído en el casco! ¡Apunta al núcleo del pecho!'],
  egg:['I','¡Ha puesto un huevo! ¡Destrúyelo antes de que eclosione!'],
  hatch:['I','¡Han eclosionado! ¡Van a por ti!'],
  xp_end:['I','Se acabó el plasma. Vuelves a la pistola.'],
  xp_on:['P','¡Extra Power! ¡Arma pesada lista, capitán!'],
  inc_beam:['P','¡Cuidado con el láser! ¡Muévete!'],
  inc_dead:['P','¡La Incineradora ha caído! ¡Increíble, capitán!'],
  cloud:['P','¡Una nube de tricomas! ¡Recógela, la necesitamos!']};
const ZONE_VO={MOTORES:'zn_eng_hit',REACTOR:'zn_rea_hit',BODEGA:'zn_hold_hit',CABINA:'zn_cock_hit'};
let VOB=null,voBus=null,voOn=true,voSrc=null;
const VOQ={until:0,prio:0,lastEnd:-99,cool:{},lastVar:{},queue:[]};
let voSeen={};try{voSeen=JSON.parse(localStorage.getItem('heads_vo_seen')||'{}');}catch(e){}
async function loadVO(){if(VOB||!AC)return;VOB={};
  try{let m;if(I18N.lang==='en'){try{m=await loadMod('assets/vo_en.js');}catch(e){console.warn('English voices not available yet: using Spanish',e);}}
    if(!m)m=await loadMod('assets/vo_es.js');
    const F=assetBufs(m.default);for(const id of Object.keys(F))VOB[id]=await Promise.all(F[id].map(q=>q.then(b=>AC.decodeAudioData(b))));}
  catch(e){console.warn('voices unavailable',e);}}
function voChain(){if(voBus)return voBus;
  // comms radio: band-limited, a little grit, short squelch on key-up/down
  const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=320;
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3600;
  const pk=AC.createBiquadFilter();pk.type='peaking';pk.frequency.value=1900;pk.gain.value=4;pk.Q.value=0.8;
  const ws=AC.createWaveShaper();const cv=new Float32Array(1024);for(let i=0;i<1024;i++){const x=i/511.5-1;cv[i]=Math.tanh(x*1.8)/Math.tanh(1.8);}ws.curve=cv;
  const g=AC.createGain();g.gain.value=0.7;hp.connect(lp).connect(pk).connect(ws).connect(g).connect(master);voBus=hp;return voBus;}
function squelch(when){const s=AC.createBufferSource();s.buffer=NOISE;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=2400;f.Q.value=1.2;
  const g=AC.createGain();g.gain.setValueAtTime(0.09,when);g.gain.exponentialRampToValueAtTime(0.0001,when+0.07);s.connect(f).connect(g).connect(master);s.start(when,Math.random());s.stop(when+0.08);}
// prio: 5 game over · 4 critical · 3 zone/tutorial · 2 status · 1 ambience. A line never cuts one of equal or higher priority.
function say(id,prio=2,o={}){
  if(!AC||!voOn||!VO_LINES[id])return false;const now=AC.currentTime;
  if(o.once&&voSeen[id])return false;
  if(VOQ.cool[id]&&now<VOQ.cool[id])return false;
  const enqueue=()=>{if(o.queue&&!VOQ.queue.some(q=>q.id===id))VOQ.queue.push({id,prio,o,exp:now+10});return false;};
  if(!VOB||!VOB[id])return enqueue();                       // still decoding: play it as soon as it is ready
  if(now<VOQ.until){if(prio<=VOQ.prio)return enqueue();
    if(voSrc){try{voSrc.stop();}catch(e){}}}
  if(prio<=1&&now-VOQ.lastEnd<20)return false;            // ambience only after a long silence
  if(prio===2&&(now-VOQ.lastEnd<6||playT<14))return false;   // chatter needs room to breathe, and none during the opening
  const vs=VOB[id];let k=Math.floor(Math.random()*vs.length);if(vs.length>1&&k===VOQ.lastVar[id])k=(k+1)%vs.length;VOQ.lastVar[id]=k;
  const buf=vs[k],src=AC.createBufferSource();src.buffer=buf;src.connect(voChain());const t0=now+0.06;squelch(now);src.start(t0);squelch(t0+buf.duration);voSrc=src;
  VOQ.until=t0+buf.duration+0.1;VOQ.prio=prio;VOQ.lastEnd=VOQ.until;VOQ.cool[id]=now+(o.cd||0);
  if(o.once){voSeen[id]=1;try{localStorage.setItem('heads_vo_seen',JSON.stringify(voSeen));}catch(e){}}
  const [who,txt]=VO_LINES[id],el=$('sub');el.innerHTML=`<b class="${who==='P'?'p':'i'}">${who==='P'?'PILOTO':'INGENIERÍA'}</b>${txt}`;el.classList.add('show');
  clearTimeout(say.t);say.t=setTimeout(()=>el.classList.remove('show'),(buf.duration+1.1)*1000);
  return true;}
function voTick(){if(!AC||!VOB)return;const now=AC.currentTime;
  if(now>=VOQ.until&&VOQ.queue.length){VOQ.queue=VOQ.queue.filter(q=>q.exp>now);const i=VOQ.queue.findIndex(q=>VOB[q.id]);
    if(i>=0){const q=VOQ.queue.splice(i,1)[0];say(q.id,q.prio,Object.assign({},q.o,{queue:false}));}}}
let pickCD=0;

