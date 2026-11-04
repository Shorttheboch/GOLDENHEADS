// ---- v75: "PANTALLA COMPLETA" = add the game to the home screen (phones only) ----
// A small button (phone start menu #instMenu, phone pause menu #instPause; both are [data-inst] in index.html) takes the player to the browser's own
// "install / add to home screen", so the game runs full screen without browser bars. A web page cannot open the iPhone Share sheet's "Add to Home Screen" by itself,
// so there the button opens a short guide (#instOv, Santi's design) that says where to tap:
//   · Android with a captured beforeinstallprompt (Chrome, Edge, Samsung Internet): the button calls prompt() = the native install dialog; after "accepted" / appinstalled it hides.
//     Chrome sends that event only when it considers the site installable and the visitor engaged, so it may arrive late (or never, e.g. Firefox): until then the button opens the guide.
//   · Android / other without the event: the guide with the browser-menu wording.
//   · iPhone / iPad (iPadOS reports itself as a Mac with touch): the guide with the Share wording (in iOS 26 Share is behind the ··· button first).
//   · Already running as an installed app (display-mode standalone / fullscreen, navigator.standalone): both buttons stay hidden.
// The guide closes with its X, ENTENDIDO or a tap outside the cards; it pauses nothing (over the pause menu the game stays paused). The art (button, logo) and the fonts are
// made sure of before it first shows. The service worker (public/sw.js) is registered here, only on touch: it caches nothing and exists so Chrome offers the install.
// PC: nothing here runs (no button, no listeners, no service worker). Look of button and guide: src/styles/08-instalar.css.
const INST={bip:null,done:false,open:false,busy:false,assets:null,btns:[...document.querySelectorAll('[data-inst]')],ov:$('instOv')};
const instIOS=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
// installed = launched from the home screen icon. (display-mode: fullscreen) also matches while the page itself is in fullscreen (tcFull asks for it on Android when JUGAR is tapped): then document.fullscreenElement is set, and that is not an install.
function instInstalled(){try{
  if(navigator.standalone===true||matchMedia('(display-mode: standalone)').matches)return true;
  if(matchMedia('(display-mode: fullscreen)').matches&&!(document.fullscreenElement||document.webkitFullscreenElement))return true;
}catch(_){}return false;}
function instRefresh(){const show=isTouch&&!INST.done&&!instInstalled();
  for(const b of INST.btns)b.hidden=!show;
  if(!show&&INST.open)instClose();}
// the guide's art and fonts: the button art (endui.js), the logo (menumob.js: the phone menu already fetched it), TekturE (endui.js font) and the menu's TitilliumH (window.MENU_FONTS).
// Done once, ahead of time when idle, and awaited by the first tap; a slow network shows the guide anyway after 3 s.
function instAssets(){if(INST.assets)return INST.assets;
  const ov=INST.ov,setImg=(k,src)=>new Promise(res=>{const L=[...ov.querySelectorAll('img[data-k="'+k+'"]')];if(!L.length||!src)return res();let n=L.length;
    for(const im of L){im.onload=im.onerror=()=>{if(!--n)res();};im.src=src;}});
  const tek=url=>{const has=[...document.fonts].some(f=>f.family.replace(/["']/g,'')==='TekturE'&&f.status==='loaded');
    return has?null:new FontFace('TekturE',`url(${url})`,{weight:'400 900'}).load().then(f=>{document.fonts.add(f);});};
  const jobs=[Promise.resolve(window.MENU_FONTS),
    loadMod('assets/endui.js').then(m=>Promise.all([setImg('btn',m.default.button),tek(m.default.font)])),
    loadMod('assets/menumob.js').then(m=>setImg('logo',m.default.logo))].map(p=>Promise.resolve(p).catch(()=>{}));
  return INST.assets=Promise.race([Promise.all(jobs),new Promise(r=>setTimeout(r,3000))]);}
function instOpen(){const ov=INST.ov;if(!ov||INST.open||INST.busy)return;INST.busy=true;
  ov.dataset.os=instIOS()?'ios':'other';
  instAssets().then(()=>{INST.busy=false;if(INST.open||!isTouch)return;ov.dataset.os=instIOS()?'ios':'other';ov.hidden=false;INST.open=true;});}
function instClose(){if(INST.ov)INST.ov.hidden=true;INST.open=false;INST.busy=false;}
const instSfx=()=>{try{if(window.menuSfx)menuSfx('button');}catch(_){}}; // the menus' own click (it says nothing when the menu sounds are gone, e.g. in the pause menu)
function instTap(e){e.stopPropagation();instSfx();
  const b=INST.bip;
  if(b&&typeof b.prompt==='function'){
    INST.bip=null; // prompt() works once per event; if the visitor dismisses the dialog, the next tap shows the guide until Chrome sends the event again
    let p;try{p=b.prompt();}catch(_){instOpen();return;}
    Promise.resolve(p).catch(()=>instOpen());
    Promise.resolve(b.userChoice).then(c=>{if(c&&c.outcome==='accepted'){INST.done=true;instRefresh();}}).catch(()=>{});
    return;}
  instOpen();}
if(isTouch){
  for(const b of INST.btns)b.addEventListener('click',instTap);
  if(INST.ov){
    // close: the X, ENTENDIDO, or a tap outside the cards (on the dark backdrop or the empty part of the stage)
    INST.ov.addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('.instX,.instGo')||!e.target.closest('.instCard,.instHead,.instInfo,.instLogo')){instSfx();instClose();}});
    document.addEventListener('keydown',e=>{if(INST.open&&e.code==='Escape')instClose();});
    // sentences with coloured words are translated whole (I18N.H), once the language is known
    if(window.LANG_READY)window.LANG_READY.then(()=>{if(window.TRH)for(const el of INST.ov.querySelectorAll('[data-rich]'))el.innerHTML=TRH(el.innerHTML);});
    setTimeout(instAssets,4000);} // idle: have the art and the fonts ready before anyone taps
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();INST.bip=e;});
  addEventListener('appinstalled',()=>{INST.done=true;INST.bip=null;instRefresh();});
  try{for(const q of ['(display-mode: standalone)','(display-mode: fullscreen)']){const m=matchMedia(q),f=()=>setTimeout(instRefresh,300);if(m.addEventListener)m.addEventListener('change',f);else if(m.addListener)m.addListener(f);}}catch(_){}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)instRefresh();}); // maybe installed from the browser menu in the meantime
  {const pm=$('tPauseM');if(pm)new MutationObserver(()=>{if(!pm.hidden)instRefresh();}).observe(pm,{attributes:true,attributeFilter:['hidden']});} // the pause menu opens: look again (fullscreen may have changed)
  instRefresh();
  // service worker: only so Chrome offers "install" (public/sw.js caches nothing)
  if('serviceWorker' in navigator){const reg=()=>navigator.serviceWorker.register(new URL('sw.js',document.baseURI).href).catch(e=>console.warn('service worker',e));
    if(document.readyState==='complete')reg();else addEventListener('load',reg,{once:true});}
}
