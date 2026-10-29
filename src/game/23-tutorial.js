/* ================= TUTORIAL (guided first steps) ================= */
const TUT={done:{},shown:{},cur:null,timer:0,q:[]};
// a hint never cuts off the one being read: it waits its turn
function queueTut(k,d){if(TUT.cur&&TUT.cur!=='shoot'&&TUT.timer>1.2){if(!TUT.q.some(e=>e[0]===k))TUT.q.push([k,d]);return;}showTut(k,d);}
// touch versions of the hints that name keys (v54)
const TUT_T={
  shoot:'¡Arañas en el casco! Mantén <b>DISPARAR</b> y arrástralo para apuntar',
  eat:'Las arañas <b>se comen la nave</b>. Mira el estado de la <b>NAVE</b> (arriba a la izquierda) y elimínalas',
  leak:'Se escapan <b>tricomas</b>, tu carga: <b>pasa cerca</b> y la manguera los aspira sola. Sigue los <b>rombos dorados</b>: lo que flote <b>30 s</b> se pierde',
  deliver:'Lleva los tricomas a la <b>bodega</b> (anillo verde) o <b>toca su icono</b> para ir solo: lo que esté <b>a bordo</b> al acabar la ronda suma puntos',
  repairTime:'Aprovecha el respiro: <b>toca una ROTURA</b> o acércate a ella y se suelda sola',
  band:'<b>Toca la barra</b> cuando pase por la <b>franja dorada</b> para reparar al instante',
  windup:'Cuando una araña <b>se agacha y le brillan los ojos</b>, va a saltar: esquiva con un <b>doble empuje</b> del joystick'};
const TIPS_T={shoot:{k:['DISPARAR'],t:'DISPARAR',s:'Mantén el botón y arrástralo para apuntar'},
  suck:{k:['AUTO'],t:'ASPIRAR TRICOMAS',s:'Pasa cerca del polvo dorado y se aspira solo'},
  deliver:{k:['BODEGA'],c:'cy',t:'DESCARGA EN LA BODEGA',s:'Toca el icono de la bodega o sigue el marcador cian'},
  weld:{k:['CERCA'],t:'QUÉDATE CERCA DE LA ROTURA',s:'Se suelda sola si la miras · toca la barra en la franja dorada'}};
const tutTxt=k=>({
  shoot:'¡Arañas en el casco! <b>Clic izquierdo</b> para dispararles',
  eat:'Las arañas <b>se comen la nave</b>. Mira el estado de la <b>NAVE</b> (abajo a la izquierda) y elimínalas',
  leak:'Se escapan <b>tricomas</b>, tu carga: aspíralos con <b>clic derecho</b> o <b>E</b>. Sigue los <b>rombos dorados</b>: lo que flote <b>30 s</b> se pierde',
  deliver:'Lleva los tricomas a la <b>bodega</b> (anillo verde): lo que esté <b>a bordo</b> al acabar la ronda suma puntos',
  mult:'Cuanto más <b>dañada</b> está la nave, más rápido se escapan los tricomas: <b>suelda</b> las roturas para frenar la fuga',
  cloud:'¡Una <b>nube de tricomas</b>! Rescátala y llévala a la bodega para <b>recuperar carga</b>',
  head:'Su punto débil está <b>entre los ojos</b>: headshot = doble daño y más puntos',
  pu:'¡Premio! <b>Tócalo</b> antes de que desaparezca',
  calm:'<b>Calma</b>: aprovecha para reparar (el doble de rápido) y recoger carga',
  repairTime:'Aprovecha el respiro: acércate al daño y mantén <b>F</b> para reparar',
  band:'Suelta <b>F</b> dentro de la <b>franja dorada</b> para reparar al instante',
  spill:'¡Cuidado! Si te muerden <b>pierdes parte de la carga</b>. Vuelve a aspirarla',
  full:'<b>Tanque lleno</b>. Vuelve a la bodega a descargar',
  windup:'Cuando una araña <b>se agacha y le brillan los ojos</b>, va a saltar: esquiva con <b>Shift</b>',
  nestBodega:'La <b>bodega</b> está destruida: repárala para poder entregar tricomas'})[k];
function showTut(k,dur=0){if(TIP.cur)return;const el=$('tut');el.innerHTML=TRH((isTouch&&TUT_T[k])||tutTxt(k));el.classList.add('show');TUT.cur=k;TUT.timer=dur;}
function hideTut(){$('tut').classList.remove('show');TUT.cur=null;TUT.timer=0;}
function resumeTut(){hideTut();}
// first-time control tips (once per session, queued so they never overlap, long enough to read)
const TIP={q:[],cur:null,t:0,gap:0,done:{}};
const TIPS={shoot:{k:['CLIC IZQ.'],t:'DISPARAR',s:'Apunta a las arañas con la mira'},
  suck:{k:['CLIC DER.','E'],t:'ASPIRAR TRICOMAS',s:'Apunta la boquilla al polvo dorado que flota'},
  deliver:{k:['BODEGA'],c:'cy',t:'DESCARGA EN LA BODEGA',s:'Sigue el marcador cian hasta el anillo verde'},
  weld:{k:['F'],t:'MANTÉN PARA SOLDAR',s:'Acércate a la rotura y suelda el casco'}};
function tip(k,delay=0){if(TIP.done[k])return;TIP.done[k]=1;TIP.q.push(k);if(delay&&!TIP.cur)TIP.gap=Math.max(TIP.gap,delay);}
function updateTip(dt){const el=$('tip');
  if(TIP.cur){TIP.t-=dt;if(TIP.t<=0||state!=='play'){el.classList.remove('show');TIP.cur=null;TIP.gap=0.8;}return;}
  TIP.gap-=dt;if(TIP.gap>0||!TIP.q.length||state!=='play'||CINE.on)return;
  const k=TIP.q.shift(),d=(isTouch&&TIPS_T[k])||TIPS[k];TIP.cur=k;TIP.t=4.6;
  el.firstChild.innerHTML=d.k.map(x=>'<kbd'+(d.c?' class="'+d.c+'"':'')+'>'+x+'</kbd>').join('<span>o</span>');el.lastChild.firstChild.textContent=d.t;el.lastChild.lastChild.textContent=d.s;el.classList.add('show');
  if(TUT.cur)hideTut();}
const TUT_ONCE=['mult','cloud','eat','leak','repairTime','band','spill','windup','nestBodega','head','pu','calm'];
const TUT_VO={eat:'tut_eat',leak:'tut_leak',repairTime:'tut_repair'};
function tutorialEvent(ev){if(CINE.on)return;
  if(ev==='leak'){if(TUT_VO.leak)say(TUT_VO.leak,3,{once:true,queue:true});tip('suck');return;}
  if(ev==='repairTime'){if(TUT_VO.repairTime)say(TUT_VO.repairTime,3,{once:true,queue:true});tip('weld');return;}
  if(ev==='kill'){if(!TUT.done.shoot){TUT.done.shoot=1;if(!TUT.timer)resumeTut();}return;}
  if(TUT_VO[ev])say(TUT_VO[ev],3,{once:true,queue:true});
  if(ev==='collect'){say('tut_deliver',4,{once:true,queue:true});tip('deliver');return;}
  if(ev==='full'){showTut('full',3.5);return;}
  if(TUT_ONCE.includes(ev)&&!TUT.shown[ev]){TUT.shown[ev]=1;queueTut(ev,5.5);}}

