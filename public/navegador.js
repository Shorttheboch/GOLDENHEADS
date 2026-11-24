// ---- v99: inside the browser of Instagram (and Facebook, Messenger, Threads, TikTok) the game can't be played: those browsers stay upright, have no
// full screen and Google refuses to sign in there. Santi: «ABRE EL LINK EN TU NAVEGADOR · COPY LINK · y presiona PANTALLA COMPLETA», with the full-screen
// tip small in the same message so the player arrives ready for it.
// Classic script, runs before i18n.js and the game: when the browser says it is one of those apps, a screen (#navOv, built here, upright layout) covers
// everything, and the game waits before downloading its models (window.HEADS_NAV_WAIT, awaited in src/game/28-load.js), so nobody spends 10 MB on a page
// they can't play. Its own texts are written here in Spanish and English (data-noi18n: the translator leaves them alone).
//   · iPhone / iPad: 1 · COPIA EL ENLACE [button] · 2 · ÁBRELO EN SAFARI (or ··· → open in browser). No link can open Safari from Instagram reliably.
//   · Android: ABRIR EN CHROME (an intent:// link: Chrome opens the page) and COPIAR ENLACE below it in case that fails.
//   · Small, at the bottom: «seguir aquí de todos modos» (in case the app was recognised by mistake): the screen goes and the game loads as always.
// The link it copies or opens carries ?nav=<app>. A normal browser that arrives with it takes it out of the address (history.replaceState), keeps it for the
// session (sessionStorage heads_nav) and the PANTALLA COMPLETA button of the phone menu glows for a few seconds (src/game/35-instalar.js).
// Metrics: visit.iab = the app the page is open in, visit.nav = the app the player came from (src/game/39-metricas.js, worker/metrics.ts).
(function(){
  var ua=navigator.userAgent||'';
  var APPS=[['ig',/Instagram/i,'Instagram'],['th',/Barcelona|Threads/i,'Threads'],['ms',/Messenger|Orca-Android/i,'Messenger'],
            ['fb',/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i,'Facebook'],['tt',/musical_ly|Bytedance|TikTok/i,'TikTok']];
  var app=null;for(var i=0;i<APPS.length;i++)if(APPS[i][1].test(ua)){app=APPS[i];break;}
  if(/[?&]inapp=(ig|fb|tt|th|ms)\b/.test(location.search)){var f=RegExp.$1;for(var j=0;j<APPS.length;j++)if(APPS[j][0]===f)app=APPS[j];} // (for testing on a normal browser)
  // arriving from the screen: keep the mark, clean the address
  try{var q=new URLSearchParams(location.search),from=q.get('nav');
    if(from&&/^(ig|fb|tt|th|ms)$/.test(from)){if(!app){try{sessionStorage.setItem('heads_nav',from);}catch(e){}window.HEADS_NAV_FROM=from;}
      q.delete('nav');var s=q.toString();history.replaceState(history.state,'',location.pathname+(s?'?'+s:'')+location.hash);}
    else{try{window.HEADS_NAV_FROM=sessionStorage.getItem('heads_nav')||null;}catch(e){}}}catch(e){}
  if(!app)return;
  window.HEADS_INAPP=app[0];
  var go;window.HEADS_NAV_WAIT=new Promise(function(r){go=r;});
  var lang='es';try{lang=localStorage.getItem('heads_lang')||((navigator.language||'es').toLowerCase().indexOf('es')===0?'es':'en');}catch(e){}
  var ios=/iP(hone|ad|od)/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),android=/Android/i.test(ua);
  var name=app[2],es=lang!=='en';
  var T=es?{h:'JUEGA EN TU NAVEGADOR',sub:name+' no deja jugar a pantalla completa.',c1:'COPIA EL ENLACE',copy:'COPIAR ENLACE',done:'¡COPIADO!',
      c2:'ÁBRELO EN SAFARI',c2s:'o toca ··· arriba → Abrir en el navegador',chrome:'ABRIR EN CHROME',chromeS:'o toca ⋮ arriba → Abrir en Chrome',
      copyS:'¿No se abre? Copia el enlace y pégalo en Chrome',tip:'Consejo: en el menú del juego toca <b>PANTALLA COMPLETA</b> para la mejor experiencia.',stay:'seguir aquí de todos modos',
      manual:'Mantén pulsado el enlace para copiarlo'}
    :{h:'PLAY IN YOUR BROWSER',sub:name+" can't run the game full screen.",c1:'COPY THE LINK',copy:'COPY LINK',done:'COPIED!',
      c2:'OPEN IT IN SAFARI',c2s:'or tap ··· at the top → Open in browser',chrome:'OPEN IN CHROME',chromeS:'or tap ⋮ at the top → Open in Chrome',
      copyS:"Doesn't open? Copy the link and paste it into Chrome",tip:'Tip: in the game menu tap <b>FULL SCREEN</b> for the best experience.',stay:'stay here anyway',
      manual:'Press and hold the link to copy it'};
  var q2=new URLSearchParams(location.search);q2.delete('inapp');q2.set('nav',app[0]);
  var url=location.origin+location.pathname+'?'+q2.toString()+location.hash;
  var intent='intent://'+location.host+location.pathname+'?'+q2.toString()+'#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(url)+';end';
  var css="@font-face{font-family:'TekturNav';src:url(assets/ui/endui/font.woff2) format('woff2');font-weight:400 900;font-display:swap}"+
    "#navOv{position:fixed;inset:0;z-index:200;overflow:auto;background:radial-gradient(120% 70% at 50% 0%,#2a1a05 0%,#07070c 55%,#000 100%);color:#f3ead8;"+
    "font-family:'TekturNav','Oxanium','Segoe UI',system-ui,sans-serif;display:flex;justify-content:center;-webkit-text-size-adjust:100%;touch-action:manipulation}"+
    "#navOv .nb{box-sizing:border-box;width:min(100%,430px);min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(10px,2.4vh,20px);"+
      "padding:calc(18px + env(safe-area-inset-top,0px)) 22px calc(16px + env(safe-area-inset-bottom,0px));text-align:center}"+
    "#navOv img{width:min(62%,240px);height:auto;filter:drop-shadow(0 0 18px rgba(255,180,50,.35))}"+
    "#navOv h1{margin:0;font-weight:800;font-size:clamp(24px,7.4vw,32px);letter-spacing:.06em;line-height:1.05;color:#ffd36a;text-shadow:0 2px 0 #6b4310,0 0 18px rgba(255,190,60,.35)}"+
    "#navOv .sub{margin:-4px 0 0;font-size:clamp(14px,4vw,16px);color:#c9bfae;font-weight:500}"+
    "#navOv .card{box-sizing:border-box;width:100%;border:1.5px solid #e8b13a;border-radius:4px;background:rgba(4,5,10,.78);box-shadow:0 0 14px rgba(255,190,60,.18);padding:14px 14px 15px;display:flex;flex-direction:column;align-items:center;gap:9px}"+
    "#navOv .st{display:flex;align-items:center;gap:9px;font-weight:800;font-size:clamp(16px,4.6vw,19px);letter-spacing:.06em;color:#fff}"+
    "#navOv .st i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#2f7fd6;color:#fff;font-size:15px;box-shadow:0 0 10px rgba(60,150,255,.5)}"+
    "#navOv .sm{font-size:13px;color:#b9ae9c;font-weight:500;line-height:1.35}"+
    "#navOv button,#navOv a.nbtn{box-sizing:border-box;min-height:50px;width:100%;border:0;border-radius:3px;cursor:pointer;font:inherit;font-weight:800;font-size:clamp(16px,4.6vw,19px);letter-spacing:.08em;"+
      "color:#2a1600;background:linear-gradient(#ffe08a,#e8b13a 55%,#b9801c);box-shadow:0 0 0 1px #6b4310,0 4px 14px rgba(255,170,40,.3);text-decoration:none;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}"+
    "#navOv button:active,#navOv a.nbtn:active{transform:translateY(1px);filter:brightness(1.08)}"+
    "#navOv button.ok{background:linear-gradient(#bff3c9,#4fc46a 60%,#2b8a43);color:#05200c}"+
    "#navOv button.sec{background:rgba(232,177,58,.12);color:#ffd36a;box-shadow:inset 0 0 0 1.5px #e8b13a}"+
    "#navOv .url{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:3px;background:rgba(255,255,255,.06);color:#e9dfcd;font:500 12px/1.3 ui-monospace,Menlo,monospace;word-break:break-all;-webkit-user-select:all;user-select:all}"+
    "#navOv .tip{font-size:clamp(13px,3.8vw,15px);line-height:1.4;color:#d8cdb9;max-width:340px}#navOv .tip b{color:#ffd36a;font-weight:800;letter-spacing:.04em;white-space:nowrap}"+
    "#navOv .stay{background:none;border:0;padding:6px 10px;font:500 12px 'Segoe UI',system-ui,sans-serif;color:#7d7566;text-decoration:underline;cursor:pointer;width:auto;min-height:0;box-shadow:none;letter-spacing:0}";
  function el(t,a,h){var e=document.createElement(t);if(a)for(var k in a)e.setAttribute(k,a[k]);if(h!=null)e.innerHTML=h;return e;}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function build(){
    var st=el('style');st.textContent=css;document.head.appendChild(st);
    var ov=el('div',{id:'navOv','data-noi18n':'',role:'dialog','aria-modal':'true','aria-labelledby':'navH',lang:es?'es':'en','data-app':app[0],'data-os':android?'android':(ios?'ios':'other')});
    var b=el('div',{'class':'nb'});ov.appendChild(b);
    b.appendChild(el('img',{src:'assets/ui/menuui/logo.webp',alt:'HEADS Rescue'}));
    b.appendChild(el('h1',{id:'navH'},esc(T.h)));b.appendChild(el('p',{'class':'sub'},esc(T.sub)));
    var copyBtn=el('button',{type:'button','class':android?'sec':'',id:'navCopy'},esc(T.copy));
    var urlBox=el('div',{'class':'url',id:'navUrl'},esc(url));
    if(android){
      var c=el('div',{'class':'card'});c.appendChild(el('a',{'class':'nbtn',id:'navChrome',href:intent},esc(T.chrome)));c.appendChild(el('div',{'class':'sm'},esc(T.chromeS)));b.appendChild(c);
      var c2=el('div',{'class':'card'});c2.appendChild(el('div',{'class':'sm'},esc(T.copyS)));c2.appendChild(copyBtn);c2.appendChild(urlBox);b.appendChild(c2);
    }else{
      var c3=el('div',{'class':'card'});c3.appendChild(el('div',{'class':'st'},'<i>1</i>'+esc(T.c1)));c3.appendChild(copyBtn);c3.appendChild(urlBox);b.appendChild(c3);
      var c4=el('div',{'class':'card'});c4.appendChild(el('div',{'class':'st'},'<i>2</i>'+esc(T.c2)));c4.appendChild(el('div',{'class':'sm'},esc(T.c2s)));b.appendChild(c4);
    }
    b.appendChild(el('p',{'class':'tip'},T.tip));
    var stay=el('button',{type:'button','class':'stay',id:'navStay'},esc(T.stay));b.appendChild(stay);
    document.body.appendChild(ov);
    function copied(){copyBtn.textContent=T.done;copyBtn.classList.add('ok');window.HEADS_NAV_COPIED=(window.HEADS_NAV_COPIED||0)+1;
      setTimeout(function(){copyBtn.textContent=T.copy;copyBtn.classList.remove('ok');},2500);}
    function manual(){try{var r=document.createRange();r.selectNodeContents(urlBox);var s=getSelection();s.removeAllRanges();s.addRange(r);}catch(e){}
      var m=urlBox.nextSibling;if(!m||m.className!=='sm man'){m=el('div',{'class':'sm man'},esc(T.manual));urlBox.parentNode.insertBefore(m,urlBox.nextSibling);}}
    function legacy(){var ta=el('textarea');ta.value=url;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0;font-size:16px';document.body.appendChild(ta);
      ta.focus();ta.select();try{ta.setSelectionRange(0,url.length);}catch(e){}var ok=false;try{ok=document.execCommand('copy');}catch(e){}ta.remove();return ok;}
    copyBtn.addEventListener('click',function(){
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(copied,function(){if(legacy())copied();else manual();});}
      else if(legacy())copied();else manual();});
    stay.addEventListener('click',function(){ov.remove();window.HEADS_NAV_STAYED=1;go();});
  }
  if(document.body)build();else document.addEventListener('DOMContentLoaded',build);
})();
