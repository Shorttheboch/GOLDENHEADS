// Add to home screen (v75): the PANTALLA COMPLETA button + guide on phones, the manifest and icons, and the service worker. Run on dist-test:
//   npm run build:test && PORT=8779 tools/run-test.sh dist-test tools/tests/install.cjs
// What it checks (screenshots go to tools/tests/out/install_*.png):
//   PC          no button, no service worker, no listener (a fake beforeinstallprompt is left alone), the manifest + icons + Apple tags in the page
//   Android     the button in the start menu (top left, in line with the ES/EN boxes) and in the pause menu · a fake beforeinstallprompt makes a tap call prompt() (accepted / dismissed / appinstalled hide it, dismissed
//               falls back to the guide) · without the event the guide opens with the Android wording · X, ENTENDIDO and a tap outside close it · menuSfx('button') on every tap
//   iPhone/iPad the guide with the iOS wording (iPadOS as a Mac with touch too) · over the pause menu the game stays paused · ES and EN texts, coloured words, nothing cut or overlapping at 844x390, 667x375 and 932x430
//   installed   display-mode standalone / fullscreen or navigator.standalone: both buttons hidden (page fullscreen asked by the game itself is not an install)
//   sw.js       registers on touch; with it active a range request for music (206), an <audio>, the /api calls and the models are not touched by it, nothing is cached (own static server with Range support)
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {BASE,ARGS,shot,ROOT}=require('./lib.cjs');
let bad=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)bad++;};
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SIZES=[[844,390],[667,375],[932,430]];

const TXT={
  es:{ios:['JUEGA A PANTALLA COMPLETA','Añade HEADS a tu pantalla de inicio: se abre sin barras, como una app.','1 · COMPARTIR','iOS 26','Toca Compartir en Safari. En iOS 26, primero toca ···','2 · AÑADIR','Copiar','Añadir a pantalla de inicio','Añadir a favoritos',
       'Baja en la lista y elige «Añadir a pantalla de inicio».','3 · JUGAR','HEADS','Abre HEADS desde su icono: se juega a pantalla completa.','La app guarda sus datos aparte de Safari: la primera vez te pedirá el idioma.','ENTENDIDO'],
      other:['JUEGA A PANTALLA COMPLETA','Instala HEADS en tu móvil: se abre a pantalla completa y en horizontal, como una app.','1 · MENÚ','goldenheads2021.com…','Toca el menú ⋮ del navegador, arriba a la derecha.','2 · INSTALAR','Nueva pestaña','Instalar aplicación','Compartir…',
       'Elige «Instalar aplicación» o «Añadir a pantalla de inicio».','3 · JUGAR','Abre HEADS desde su icono: se juega a pantalla completa.','Esta guía solo sale si tu navegador no deja instalar directamente desde el botón.','ENTENDIDO'],
      btn:'PANTALLA COMPLETA',close:'Cerrar',k:{ios:['Compartir','«Añadir a pantalla de inicio»'],other:['⋮','«Instalar aplicación»']},c:{ios:['···','pantalla completa'],other:['pantalla completa']}},
  en:{ios:['PLAY FULL SCREEN','Add HEADS to your Home Screen: it opens without bars, like an app.','1 · SHARE','iOS 26','Tap Share in Safari. On iOS 26, tap ··· first','2 · ADD','Copy','Add to Home Screen','Add to Favorites',
       'Scroll down and choose “Add to Home Screen”.','3 · PLAY','HEADS','Open HEADS from its icon: it plays full screen.','The app keeps its data apart from Safari: the first time it will ask for your language.','GOT IT'],
      other:['PLAY FULL SCREEN','Install HEADS on your phone: it opens full screen and in landscape, like an app.','1 · MENU','goldenheads2021.com…',"Tap the browser's ⋮ menu, top right.",'2 · INSTALL','New tab','Install app','Share…',
       'Choose “Install app” or “Add to Home screen”.','3 · PLAY','Open HEADS from its icon: it plays full screen.',"This guide only shows if your browser can't install straight from the button.",'GOT IT'],
      btn:'FULL SCREEN',close:'Close',k:{ios:['Share','“Add to Home Screen”'],other:['⋮','“Install app”']},c:{ios:['···','full screen'],other:['full screen']}}};

async function newPhone(b,{lang='es',ua,w=844,h=390,init}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true,...(ua?{userAgent:ua}:{})});
  const p=await ctx.newPage();p.errs=[];p.reqs=[];
  p.on('pageerror',e=>p.errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR|fonts\.g/.test(m.text()))p.errs.push(m.text());});
  p.on('request',r=>p.reqs.push(r.url()));
  await p.addInitScript(l=>{window.__lang=l;window.__prompted=0;},lang);
  if(init)await p.addInitScript(init);
  await p.goto(BASE+'/test.html');
  return p;}
// the phone menu intro is over (ES/EN boxes and the button are in), animations of the menu frozen at their end for the screenshot
async function menuReady(p){
  await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go'),null,{timeout:300000});
  await p.waitForTimeout(3600);
  await p.waitForFunction(()=>{const b=document.getElementById('instMenu');return b.hidden||+getComputedStyle(b).opacity>=0.999;},null,{timeout:30000}).catch(()=>{}); // the button's own entrance (a slow page may be a little late)
  await p.evaluate(()=>{for(const a of document.getAnimations())if(a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('#mobMenu')){a.pause();a.currentTime=4200;}});
  await p.waitForTimeout(300);}
const snap=(p,name)=>p.screenshot({path:shot('install_'+name+'.png'),timeout:240000});
const info=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
  return {hidden:e.hidden,disp:cs.display,op:+cs.opacity,l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,txt:e.textContent.trim()};},sel);
const shown=i=>i&&!i.hidden&&i.disp!=='none'&&i.w>0&&i.h>0;
const fakeBip=(p,outcome)=>p.evaluate(o=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window.__prompted++;return Promise.resolve();};
  e.userChoice=Promise.resolve({outcome:o,platform:'web'});window.__bipPrevented=!window.dispatchEvent(e);},outcome);
const ovOpen=p=>p.waitForFunction(()=>!document.getElementById('instOv').hidden,null,{timeout:15000}).then(()=>true,()=>false);
const ovShut=p=>p.waitForFunction(()=>document.getElementById('instOv').hidden,null,{timeout:5000}).then(()=>true,()=>false);
const spySfx=p=>p.evaluate(()=>{window.__sfx=[];const o=window.menuSfx;if(!o||o.__spy)return;const f=(n,...a)=>{window.__sfx.push(n);return o(n,...a);};Object.assign(f,o);f.__spy=1;window.menuSfx=f;});
const sfxButtons=p=>p.evaluate(()=>window.__sfx.filter(n=>n==='button').length);
const stateNow=p=>p.evaluate(()=>({st:window.__T.state,menu:!document.getElementById('menu').hidden,paused:window.__TC.paused,pm:!document.getElementById('tPauseM').hidden}));
async function toPause(p){
  await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});
  await p.waitForTimeout(500);
  await p.tap('#mmGo');
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
  await p.evaluate(()=>{window.__noRender=1;window.__noSpawn=1;});
  await p.waitForTimeout(1500);
  const sel=await p.evaluate(()=>document.querySelector('.hudm')?'#hud-pause':'#tPause');
  await p.tap(sel);
  await p.waitForFunction(()=>!document.getElementById('tPauseM').hidden,null,{timeout:30000});
  await p.waitForTimeout(500);}

// ---- layout checks ----
async function menuLayout(p,tag){
  const r=await p.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom};};
    const st=document.getElementById('mmStage').getBoundingClientRect(),btn=document.getElementById('instMenu'),cs=getComputedStyle(btn),b=btn.getBoundingClientRect();
    const hit=(x,y)=>{const e=document.elementFromPoint(x,y);return !!e&&(e===btn||btn.contains(e));};const cy=(b.top+b.bottom)/2,cx=b.left+20;
    return {btn:R('#instMenu'),lang:R('#langTog'),logo:R('#mmLogo'),go:R('#mmGo'),stageTop:st.top,u:st.width/1764,op:+cs.opacity,shown:!btn.hidden&&cs.display!=='none',W:innerWidth,H:innerHeight,
      hitTop:hit(cx,cy-21),hitBot:hit(cx,cy+21),fs:cs.fontSize,ff:cs.fontFamily,border:cs.borderTopWidth,text:btn.textContent.trim(),tekt:document.fonts.check('800 12px TekturE')};});
  const b=r.btn,I=(a,c)=>Math.max(0,Math.min(a.r,c.r)-Math.max(a.l,c.l))*Math.max(0,Math.min(a.b,c.b)-Math.max(a.t,c.t));
  ok(r.shown&&r.op>0.99,tag+' button shown and faded in (opacity '+r.op+')');
  ok(b.l>=0&&b.t>=0&&b.r<=r.W&&b.b<=r.H,tag+' button inside the screen ['+[b.l,b.t,b.r,b.b].map(Math.round)+']');
  ok(Math.abs(b.t-r.lang.t)<=1.5,tag+' top in line with the ES/EN boxes ('+b.t.toFixed(1)+' / '+r.lang.t.toFixed(1)+')');
  ok(Math.abs((b.b-b.t)-(r.lang.b-r.lang.t))<=1.5,tag+' same height as the ES/EN boxes ('+(b.b-b.t).toFixed(1)+' / '+(r.lang.b-r.lang.t).toFixed(1)+')');
  ok(b.b<=r.stageTop+118*r.u+2,tag+' above the frame of the panel');
  ok(I(b,r.logo)===0&&I(b,r.go)===0&&I(b,r.lang)===0,tag+' overlaps neither the logo, JUGAR nor ES/EN');
  ok(r.hitTop&&r.hitBot,tag+' touch area is 44 px tall (the button answers 21 px above and below its centre)');
  return r;}
async function guideLayout(p,tag){
  const r=await p.evaluate(()=>{const ov=document.getElementById('instOv'),st=ov.querySelector('.instStage').getBoundingClientRect(),u=st.width/844,probs=[],W=innerWidth,H=innerHeight;
    const vis=e=>e.getClientRects().length>0;
    const tr=e=>{const q=document.createRange();q.selectNodeContents(e);return q.getBoundingClientRect();};
    const inside=(e,box,m,what)=>{const t=tr(e),T=e.textContent.trim().slice(0,28);if(t.left<box.left+m-0.6||t.right>box.right-m+0.6||t.top<box.top-0.6||t.bottom>box.bottom+0.6)probs.push(what+' out of its box: '+T+' ['+[t.left,t.right].map(Math.round)+' in '+[box.left+m,box.right-m].map(Math.round)+']');};
    if(st.left<-0.6||st.top<-0.6||st.right>W+0.6||st.bottom>H+0.6)probs.push('stage outside the screen');
    for(const card of ov.querySelectorAll('.instCard'))if(vis(card)){const cr=card.getBoundingClientRect(),pad=4*u,inner={left:cr.left+pad,right:cr.right-pad,top:cr.top+pad,bottom:cr.bottom-pad};
      inside(card.querySelector('.instCap'),inner,2*u,'caption');inside(card.querySelector('.instPill span'),card.querySelector('.instPill').getBoundingClientRect(),14*u,'pill label');
      for(const s of card.querySelectorAll('.instRow span,.instUrl span,.instTag'))inside(s,card.querySelector('.instViz').getBoundingClientRect(),0,'row text');
      for(const row of card.querySelectorAll('.instRow')){const rr=row.getBoundingClientRect(),sp=[...row.querySelectorAll('span')];for(const s of sp){const t=tr(s);if(t.right>rr.right-3*u+0.6)probs.push('row text reaches the row edge: '+s.textContent);}}}
    for(const e of ov.querySelectorAll('.instInfo span'))if(vis(e))inside(e,e.closest('.instInfo').getBoundingClientRect(),20*u,'note');
    for(const e of ov.querySelectorAll('.instSub,.instT'))if(vis(e))inside(e,{left:st.left+80*u,right:st.right-80*u,top:st.top,bottom:st.bottom},0,'heading');
    const cap=[...ov.querySelectorAll('.instCap')].filter(vis).map(e=>e.getBoundingClientRect().bottom-e.closest('.instCard').getBoundingClientRect().bottom);
    const x=ov.querySelector('.instX'),go=ov.querySelector('.instGo'),xr=x.getBoundingClientRect(),gr=go.getBoundingClientRect();
    const hit=(el,px,py)=>{const e=document.elementFromPoint(px,py);return !!e&&(e===el||el.contains(e));};
    const cx=xr.left+xr.width/2,cy=xr.top+xr.height/2;
    const cards=[...ov.querySelectorAll('.instCard')].filter(vis).map(c=>c.getBoundingClientRect());
    const infoR=[...ov.querySelectorAll('.instInfo')].find(vis).getBoundingClientRect();
    const logoR=ov.querySelector('.instLogo').getBoundingClientRect();
    const ovl=(a,c)=>Math.min(a.right,c.right)-Math.max(a.left,c.left)>0.5&&Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)>0.5;
    if(cards.some(c=>ovl(c,infoR))||ovl(infoR,gr)||ovl(xr,logoR)||cards.some(c=>ovl(c,gr)||ovl(c,xr)))probs.push('blocks overlap');
    return {probs,u,x:[xr.left,xr.top,xr.right,xr.bottom].map(Math.round),go:[gr.left,gr.top,gr.right,gr.bottom].map(Math.round),W,H,capGap:cap.map(v=>+v.toFixed(1)),stage:[st.left,st.top,st.right,st.bottom].map(Math.round),
      xHit:hit(x,cx-22+1,cy)&&hit(x,cx+22-1,cy)&&hit(x,cx,cy-22+1)&&hit(x,cx,cy+22-1),
      inView:xr.left>=0&&xr.top>=0&&xr.right<=W&&xr.bottom<=H&&gr.left>=0&&gr.right<=W&&gr.bottom<=H,
      texts:ov.innerText.replace(/\s+/g,' ').trim(),fontsOk:document.fonts.check('800 20px TekturE')&&document.fonts.check('600 12px TitilliumH')&&document.fonts.check('700 12px TitilliumH'),
      img:[...ov.querySelectorAll('img[data-k]')].filter(vis).map(i=>i.complete&&i.naturalWidth>0)};});
  ok(!r.probs.length,tag+' nothing cut or overlapping'+(r.probs.length?' -> '+JSON.stringify(r.probs):''));
  ok(r.inView,tag+' X and the main button are inside the screen (X '+r.x+' · button '+r.go+' · '+r.W+'x'+r.H+')');
  ok(r.xHit,tag+' the X answers over a 44 x 44 px area');
  ok(r.capGap.every(g=>g<=-3),tag+' captions end inside their cards (gaps '+r.capGap+')');
  ok(r.img.length===3&&r.img.every(Boolean),tag+' art loaded (logo, tile, button)');
  return r;}
async function pauseLayout(p,tag){
  const r=await p.evaluate(()=>{const box=document.querySelector('#tPauseM .tpBox').getBoundingClientRect(),W=innerWidth,H=innerHeight,btns=[...document.querySelectorAll('#tPauseM .tpBox button')].filter(b=>b.getClientRects().length),probs=[];
    const R=btns.map(b=>b.getBoundingClientRect());
    for(let i=0;i<R.length;i++){for(let j=i+1;j<R.length;j++){const a=R[i],c=R[j];if(Math.min(a.right,c.right)-Math.max(a.left,c.left)>0.5&&Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)>0.5)probs.push('overlap '+btns[i].textContent+' / '+btns[j].textContent);}
      if(btns[i].scrollWidth>btns[i].clientWidth+1)probs.push('text cut: '+btns[i].textContent);if(R[i].height<40)probs.push('too short: '+btns[i].textContent);}
    const mus=document.querySelector('#tPauseM [data-a=mus]').getBoundingClientRect(),vo=document.querySelector('#tPauseM [data-a=vo]').getBoundingClientRect(),inst=document.getElementById('instPause').getBoundingClientRect(),tut=document.querySelector('#tPauseM [data-a=tut]').getBoundingClientRect();
    return {probs,box:[box.left,box.top,box.right,box.bottom].map(Math.round),W,H,fits:box.top>=0&&box.bottom<=H&&box.left>=0&&box.right<=W,sameRow:Math.abs(mus.top-vo.top)<1,instBelow:inst.width>0&&inst.top>=tut.bottom-0.5,n:btns.length,
      instTxt:document.getElementById('instPause').textContent.trim()};});
  ok(!r.probs.length,tag+' pause menu: buttons clear of each other, text not cut'+(r.probs.length?' -> '+JSON.stringify(r.probs):''));
  ok(r.fits,tag+' pause menu box inside the screen '+r.box+' of '+r.W+'x'+r.H);
  return r;}
function inkOk(p,lang,os,tag){return p.evaluate(([T,os])=>{const ov=document.getElementById('instOv'),col=e=>getComputedStyle(e).color;
  const ks=[...ov.querySelectorAll('.instCards[data-os='+os+'] .instCap .k')].map(e=>e.textContent+'|'+col(e)),cs=[...ov.querySelectorAll('.instCards[data-os='+os+'] .instCap .c')].map(e=>e.textContent+'|'+col(e));
  return {ks,cs};},[TXT[lang],os]);}
// =============== PC ===============
async function pcPhase(b){
  console.log('PC) no button, no service worker, no listener; manifest, icons and tags');
  const ctx=await b.newContext({viewport:{width:1280,height:720}});const p=await ctx.newPage();const errs=[],reqs=[];
  p.on('pageerror',e=>errs.push(e.message));p.on('request',r=>reqs.push(r.url()));
  await p.addInitScript(()=>{window.__lang='es';});await p.goto(BASE+'/test.html');
  await p.waitForFunction(()=>window.__TC&&document.readyState==='complete',null,{timeout:300000});await p.waitForTimeout(3000);
  for(const s of ['#instMenu','#instPause'])ok(!shown(await info(p,s)),'PC: '+s+' stays hidden');
  ok((await info(p,'#instOv')).hidden,'PC: the guide is closed');
  ok(await p.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length===0),'PC: no service worker registered');
  ok(!reqs.some(u=>/\/sw\.js/.test(u)),'PC: sw.js is never even requested');
  ok(!reqs.some(u=>/icons\/icon-192/.test(u)),'PC: the guide art is not fetched');
  await p.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window.__prompted++;};e.userChoice=new Promise(()=>{});window.__bipPrevented=!window.dispatchEvent(e);});
  ok(await p.evaluate(()=>window.__bipPrevented===false),'PC: beforeinstallprompt is left alone (not cancelled)');
  ok(!shown(await info(p,'#instMenu')),'PC: still no button after the event');
  // manifest, icons, tags (the page links them on PC too; they do nothing there)
  const man=await p.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');if(!l)return null;const r=await fetch(l.href);return {href:l.href,status:r.status,json:await r.json().catch(()=>null)};});
  ok(man&&man.status===200&&man.json,'manifest: linked from index.html and parses ('+(man&&man.href)+')');
  const m=man.json||{},icons=m.icons||[];
  ok(m.name==='HEADS Rescate Dorado'&&m.short_name==='HEADS','manifest: name "HEADS Rescate Dorado", short_name "HEADS"');
  ok(m.start_url==='./'&&m.scope==='./'&&m.id===undefined,'manifest: start_url "./" and scope "./", relative to the manifest (v85: the game\'s own folder, / here, /headsrescue/ on goldenheads2021.com); no id, so the app\'s identity is that folder');
  const mres=await p.evaluate(h=>({start:new URL('./',h).href,icon:new URL('icons/icon-192.png',h).href}),man.href);
  ok(mres.start===BASE+'/'&&mres.icon===BASE+'/icons/icon-192.png','manifest: start_url and icons resolve next to it ('+mres.start+')');
  ok(m.display==='fullscreen'&&JSON.stringify(m.display_override)===JSON.stringify(['fullscreen','standalone']),'manifest: display fullscreen, display_override [fullscreen, standalone]');
  ok(m.orientation==='landscape','manifest: orientation landscape');
  ok(m.background_color==='#000000'&&m.theme_color==='#000000','manifest: background_color and theme_color black');
  ok(m.prefer_related_applications===undefined,'manifest: no prefer_related_applications');
  const has=(s,pu)=>icons.some(i=>i.sizes===s&&i.type==='image/png'&&(i.purpose||'any')===pu);
  ok(has('192x192','any')&&has('512x512','any')&&has('512x512','maskable'),'manifest: icons 192 any, 512 any, 512 maskable');
  const png=buf=>({w:buf.readUInt32BE(16),h:buf.readUInt32BE(20),depth:buf[24],type:buf[25],sig:buf.slice(0,8).toString('hex')});
  for(const i of icons){const r=await p.request.get(new URL(i.src,man.href).href),buf=await r.body(),h=png(buf),[dw,dh]=i.sizes.split('x').map(Number);
    ok(r.status()===200&&h.sig==='89504e470d0a1a0a'&&h.w===dw&&h.h===dh,'icon '+i.src+' loads as a '+h.w+'x'+h.h+' PNG, declared '+i.sizes+(h.type===2?' (RGB, opaque)':' (colour type '+h.type+')'));}
  const at=await p.evaluate(async()=>{const l=document.querySelector('link[rel=apple-touch-icon]');if(!l)return null;const r=await fetch(l.href);return {href:l.href,status:r.status,buf:Array.from(new Uint8Array(await r.arrayBuffer()).slice(0,32))};});
  {const buf=Buffer.from(at.buf),h=png(buf);ok(at.status===200&&h.w===180&&h.h===180&&h.type===2,'apple-touch-icon: 180x180, opaque RGB (no alpha) ('+at.href+')');}
  const metas=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('meta[name]')].map(m=>[m.name,m.content])));
  ok(metas['apple-mobile-web-app-capable']==='yes'&&metas['apple-mobile-web-app-status-bar-style']==='black-translucent'&&metas['apple-mobile-web-app-title']==='HEADS','Apple tags: capable yes, status bar black-translucent, title HEADS');
  ok(metas['mobile-web-app-capable']==='yes'&&metas['theme-color']==='#000000','Android tags: mobile-web-app-capable yes, theme-color black');
  // the maskable icon keeps the whole logo inside the 80 % safe circle; the "any" ones use ~86 % of the width
  const sz=await p.evaluate(async()=>{const out={};for(const [k,src] of [['maskable','icons/icon-maskable-512.png'],['any','icons/icon-512.png']]){const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.drawImage(im,0,0);
      const d=x.getImageData(0,0,512,512).data;let far=0,minx=512,maxx=0;for(let y=0;y<512;y++)for(let xx=0;xx<512;xx++){const i=(y*512+xx)*4;if(d[i]+d[i+1]+d[i+2]>150){far=Math.max(far,Math.hypot(xx-256,y-256));minx=Math.min(minx,xx);maxx=Math.max(maxx,xx);}}
      out[k]={far,wFrac:(maxx-minx)/512};}return out;});
  ok(sz.maskable.far<=0.4*512,'maskable icon: the whole logo is inside the safe circle (farthest bright pixel '+sz.maskable.far.toFixed(1)+' of '+(0.4*512)+')');
  ok(sz.any.wFrac>0.8&&sz.any.wFrac<0.9,'"any" icon: the logo is about 86 % of the width ('+(sz.any.wFrac*100).toFixed(0)+' %)');
  ok(!errs.length,'PC: no page errors '+JSON.stringify(errs.slice(0,3)));
  await ctx.close();}

// =============== Android (Chrome) ===============
async function androidMenuPhase(b){
  console.log('Android) start menu: button, guide, fake beforeinstallprompt');
  const p=await newPhone(b,{lang:'es',ua:ANDROID});await menuReady(p);
  // service worker: registered on touch (from index.html's game code), scope "/", the real file
  await p.waitForFunction(()=>navigator.serviceWorker.getRegistration().then(r=>!!(r&&r.active)),null,{timeout:60000}).catch(()=>{});
  const sw=await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();const w=r&&(r.active||r.waiting||r.installing);return r?{scope:r.scope,script:w&&w.scriptURL,state:w&&w.state}:null;});
  ok(sw&&/\/sw\.js$/.test(sw.script)&&sw.scope===BASE+'/','phone: sw.js registered with scope "/" ('+JSON.stringify(sw)+')');
  // layout of the button at three phone sizes
  for(const [w,h] of SIZES){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(600);const r=await menuLayout(p,w+'x'+h);if(w===844)ok(r.text==='PANTALLA COMPLETA','button text is «PANTALLA COMPLETA», TekturE 800 12px ('+r.fs+', border '+r.border+', font loaded '+r.tekt+')');}
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(600);await snap(p,'menu_es');
  await spySfx(p);
  const st0=await stateNow(p);
  // no beforeinstallprompt yet: the button opens the Android guide
  await p.tap('#instMenu');ok(await ovOpen(p),'tap -> the guide opens (no beforeinstallprompt yet)');
  let g=await p.evaluate(()=>({os:document.getElementById('instOv').dataset.os,aria:document.querySelector('.instX').getAttribute('aria-label')}));
  ok(g.os==='other','guide shows the Android / other wording');
  g=await guideLayout(p,'android ES 844x390');
  for(const t of TXT.es.other)ok(g.texts.includes(t),'text present: '+t);
  ok(!g.texts.includes('Toca Compartir'),'the iOS texts are not shown');
  ok(g.fontsOk,'TekturE and TitilliumH loaded when the guide shows');
  await snap(p,'guide_android_es');
  for(const [w,h] of SIZES.slice(1)){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(600);await guideLayout(p,'android ES '+w+'x'+h);if(w===667)await snap(p,'guide_android_es_667x375');}
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(500);
  ok((await stateNow(p)).menu&&(await stateNow(p)).st===st0.st,'the guide pauses nothing in the menu (menu still there, state '+st0.st+')');
  await p.tap('.instX');ok(await ovShut(p),'X closes the guide');
  await p.tap('#instMenu');await ovOpen(p);await p.touchscreen.tap(5,5);ok(await ovShut(p),'a tap outside closes it');
  await p.tap('#instMenu');await ovOpen(p);await p.tap('.instGo');ok(await ovShut(p),'ENTENDIDO closes it');
  ok(await sfxButtons(p)===6,'menuSfx("button") played on every tap: menu button x3, X, outside, ENTENDIDO ('+await sfxButtons(p)+')');
  ok((await info(p,'#mmGo')).disp!=='none'&&(await stateNow(p)).menu,'the start menu is intact after the guide');
  // Chrome sends beforeinstallprompt: the page cancels the mini-infobar and keeps the event; a tap calls prompt()
  await spySfx(p);
  await fakeBip(p,'dismissed');ok(await p.evaluate(()=>window.__bipPrevented===true),'beforeinstallprompt: default prevented, event kept');
  await p.tap('#instMenu');await p.waitForTimeout(500);
  ok(await p.evaluate(()=>window.__prompted)===1,'tap -> prompt() called once (native dialog)');
  ok((await info(p,'#instOv')).hidden,'the guide does not open when prompt() is available');
  ok(shown(await info(p,'#instMenu')),'dismissed: the button stays');
  await p.tap('#instMenu');ok(await ovOpen(p),'dismissed: the next tap falls back to the guide (the event works once)');
  ok(await p.evaluate(()=>window.__prompted)===1,'prompt() was not called again');
  await p.tap('.instGo');await ovShut(p);
  // a new event, then the OS says it is installed
  await fakeBip(p,'dismissed');await p.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await p.waitForTimeout(400);
  ok(!shown(await info(p,'#instMenu'))&&!shown(await info(p,'#instPause')),'appinstalled: both buttons hidden');
  ok(!p.errs.length,'no page errors '+JSON.stringify(p.errs.slice(0,3)));
  await p.context().close();}

async function androidPausePhase(b){
  console.log('Android) pause menu: accepted prompt');
  const p=await newPhone(b,{lang:'es',ua:ANDROID});await menuReady(p);
  await fakeBip(p,'accepted');
  await toPause(p);
  const i=await info(p,'#instPause');ok(shown(i)&&i.txt==='PANTALLA COMPLETA','the pause menu shows the button «PANTALLA COMPLETA»');
  for(const [w,h] of SIZES){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(600);const r=await pauseLayout(p,w+'x'+h);if(w===844)ok(r.sameRow&&r.instBelow&&r.n===6,'MÚSICA and VOCES share a row, the button is the last one (6 buttons)');}
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(600);await snap(p,'pause_es');
  ok((await stateNow(p)).paused===true,'paused');
  await p.tap('#instPause');await p.waitForTimeout(600);
  ok(await p.evaluate(()=>window.__prompted)===1,'tap in the pause menu -> prompt() called');
  const s=await stateNow(p);ok(s.paused&&s.pm&&s.st==='play','still paused, the pause menu still up');
  ok((await info(p,'#instOv')).hidden,'no guide');
  await p.waitForTimeout(300);ok(!shown(await info(p,'#instPause')),'accepted: the button is gone');
  const r=await pauseLayout(p,'without the button');ok(r.n===5&&!r.sameRow,'without the button the pause menu is as it was (5 buttons, one per row)');
  await p.tap('#tPauseM [data-a=go]');await p.waitForTimeout(500);ok((await stateNow(p)).paused===false,'CONTINUAR resumes');
  ok(!p.errs.length,'no page errors '+JSON.stringify(p.errs.slice(0,3)));
  await p.context().close();}

// =============== iPhone / iPad ===============
async function iosPhase(b){
  console.log('iPhone) guide (ES), iPadOS as a Mac, over the pause menu');
  const p=await newPhone(b,{lang:'es',ua:IPHONE});await menuReady(p);
  await menuLayout(p,'iPhone 844x390');
  await spySfx(p);
  await p.tap('#instMenu');ok(await ovOpen(p),'tap -> the guide opens');
  ok(await p.evaluate(()=>document.getElementById('instOv').dataset.os)==='ios','guide shows the iOS wording');
  let g=await guideLayout(p,'iOS ES 844x390');
  for(const t of TXT.es.ios)ok(g.texts.includes(t),'text present: '+t);
  ok(!g.texts.includes('Instalar aplicación'),'the Android texts are not shown');
  const ink=await inkOk(p,'es','ios');ok(ink.ks.some(s=>s.startsWith('Compartir|rgb(255, 200, 60)'))&&ink.ks.some(s=>s.includes('«Añadir a pantalla de inicio»|rgb(255, 200, 60)')),'gold words (#ffc83c): '+ink.ks.join(' / '));
  ok(ink.cs.some(s=>s.startsWith('···|rgb(143, 227, 255)'))&&ink.cs.some(s=>s.startsWith('pantalla completa|rgb(143, 227, 255)')),'cyan words (#8fe3ff): '+ink.cs.join(' / '));
  await snap(p,'guide_ios_es');
  for(const [w,h] of SIZES.slice(1)){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(600);await guideLayout(p,'iOS ES '+w+'x'+h);await snap(p,'guide_ios_es_'+w+'x'+h);}
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(500);
  await p.tap('.instX');await ovShut(p);
  // iPadOS 13+ says it is a Mac, but with touch; and back to an Android phone (the choice is made each time the guide opens)
  await p.evaluate(()=>{Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',configurable:true});
    Object.defineProperty(navigator,'platform',{get:()=>'MacIntel',configurable:true});Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5,configurable:true});});
  await p.tap('#instMenu');await ovOpen(p);ok(await p.evaluate(()=>document.getElementById('instOv').dataset.os)==='ios','iPadOS (Mac with touch) gets the iOS guide');await p.tap('.instGo');await ovShut(p);
  await p.evaluate(()=>{Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0,configurable:true});Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',configurable:true});});
  await p.tap('#instMenu');await ovOpen(p);ok(await p.evaluate(()=>document.getElementById('instOv').dataset.os)==='other','a non-Apple phone gets the Android guide');await p.tap('.instX');await ovShut(p);
  await p.evaluate(()=>{Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1',configurable:true});});
  // over the pause menu: it stays paused
  await toPause(p);
  await p.tap('#instPause');ok(await ovOpen(p),'pause menu: the button opens the guide');
  let s=await stateNow(p);ok(s.paused&&s.pm&&s.st==='play','the game stays paused with the guide on top, the pause menu is still there');
  await snap(p,'guide_over_pause_ios_es');
  await p.touchscreen.tap(5,5);ok(await ovShut(p),'a tap outside closes it');
  s=await stateNow(p);ok(s.paused&&s.pm,'back in the pause menu, still paused (the tap did not go through)');
  await p.tap('#instPause');await ovOpen(p);await p.tap('.instGo');await ovShut(p);s=await stateNow(p);ok(s.paused&&s.pm,'ENTENDIDO: still paused');
  await p.tap('#tPauseM [data-a=go]');await p.waitForTimeout(500);ok((await stateNow(p)).paused===false,'CONTINUAR resumes');
  ok(!p.errs.length,'no page errors '+JSON.stringify(p.errs.slice(0,3)));
  await p.context().close();}

async function enPhase(b){
  console.log('iPhone) English: button, guide (iOS and Android wording), pause menu');
  const p=await newPhone(b,{lang:'en',ua:IPHONE});await menuReady(p);
  const mb=await menuLayout(p,'EN 844x390');ok(mb.text==='FULL SCREEN','button text «FULL SCREEN»');
  for(const [w,h] of SIZES.slice(1)){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(600);await menuLayout(p,'EN '+w+'x'+h);}
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(600);await snap(p,'menu_en');
  await p.tap('#instMenu');await ovOpen(p);
  for(const os of ['ios','other']){
    if(os==='other'){await p.tap('.instX');await ovShut(p);await p.evaluate(()=>{Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',configurable:true});});await p.tap('#instMenu');await ovOpen(p);}
    ok(await p.evaluate(()=>document.getElementById('instOv').dataset.os)===os,'EN: '+os+' wording');
    const g=await guideLayout(p,'EN '+os+' 844x390');
    for(const t of TXT.en[os])ok(g.texts.includes(t),'EN text present: '+t);
    ok(!/[ÁÉÍÓÚÑáéíóúñ¿¡«»]/.test(g.texts.replace(/goldenheads2021\.com…/,'')),'EN: no Spanish left in the guide ('+(g.texts.match(/[^ ]*[ÁÉÍÓÚÑáéíóúñ¿¡«»][^ ]*/g)||[]).join(', ')+')');
    ok(await p.evaluate(()=>document.querySelector('.instX').getAttribute('aria-label'))==='Close','EN: the X says "Close" (aria-label)');
    const ink=await inkOk(p,'en',os);ok(TXT.en.k[os].every(w=>ink.ks.some(s=>s.startsWith(w+'|rgb(255, 200, 60)'))),'EN gold words: '+ink.ks.join(' / '));
    ok(TXT.en.c[os].every(w=>ink.cs.some(s=>s.startsWith(w+'|rgb(143, 227, 255)'))),'EN cyan words: '+ink.cs.join(' / '));
    await snap(p,'guide_'+(os==='ios'?'ios':'android')+'_en');
    for(const [w,h] of SIZES.slice(1)){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(600);await guideLayout(p,'EN '+os+' '+w+'x'+h);if(w===667)await snap(p,'guide_'+(os==='ios'?'ios':'android')+'_en_667x375');}
    await p.setViewportSize({width:844,height:390});await p.waitForTimeout(500);}
  await p.tap('.instGo');await ovShut(p);
  await toPause(p);
  const i=await info(p,'#instPause');ok(shown(i)&&i.txt==='FULL SCREEN','EN: the pause menu button says «FULL SCREEN»');
  for(const [w,h] of SIZES){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(600);await pauseLayout(p,'EN '+w+'x'+h);}
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(600);await snap(p,'pause_en');
  ok(!p.errs.length,'no page errors '+JSON.stringify(p.errs.slice(0,3)));
  await p.context().close();}

// =============== already installed ===============
async function installedPhase(b){
  console.log('installed) the buttons hide when the game runs as an app');
  const p=await newPhone(b,{lang:'es',ua:ANDROID,init:()=>{
    window.__dm='standalone';window.__nav=false;window.__fsEl=false;
    const orig=window.matchMedia.bind(window);
    window.matchMedia=q=>{const m=/display-mode:\s*(\w+)/.exec(q);if(!m)return orig(q);return {matches:window.__dm===m[1],media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null};};
    Object.defineProperty(navigator,'standalone',{get:()=>window.__nav||undefined,configurable:true});
    const fe=Object.getOwnPropertyDescriptor(Document.prototype,'fullscreenElement');Object.defineProperty(document,'fullscreenElement',{get:()=>window.__fsEl?document.documentElement:null,configurable:true});}});
  await p.waitForFunction(()=>window.__TC&&document.readyState==='complete',null,{timeout:300000});await p.waitForTimeout(1500);
  const both=async()=>[shown(await info(p,'#instMenu')),await p.evaluate(()=>!document.getElementById('instPause').hidden)];
  const poke=async()=>{await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(200);};
  let v=await both();ok(!v[0]&&!v[1],'display-mode: standalone -> both buttons hidden from the start');
  await p.evaluate(()=>{window.__dm='';});await poke();v=await both();ok(v[0]&&v[1],'in the browser (no display-mode) -> both buttons show');
  await p.evaluate(()=>{window.__dm='fullscreen';});await poke();v=await both();ok(!v[0]&&!v[1],'display-mode: fullscreen (installed fullscreen app) -> hidden');
  await p.evaluate(()=>{window.__fsEl=true;});await poke();v=await both();ok(v[0]&&v[1],'display-mode: fullscreen because the game itself asked for fullscreen (fullscreenElement set) -> not an install, the buttons show');
  await p.evaluate(()=>{window.__dm='';window.__fsEl=false;window.__nav=true;});await poke();v=await both();ok(!v[0]&&!v[1],'navigator.standalone (iOS home screen app) -> hidden');
  await p.evaluate(()=>{window.__nav=false;});await poke();v=await both();ok(v[0]&&v[1],'back in Safari -> shown again');
  ok(!p.errs.length,'no page errors '+JSON.stringify(p.errs.slice(0,3)));
  await p.context().close();}

// =============== service worker vs media range requests (own static server with Range support: python's http.server has none) ===============
function serve(dir){return new Promise(res=>{let n=0;const log=[];
  const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.mp4':'video/mp4','.json':'application/json','.webmanifest':'application/manifest+json','.webp':'image/webp','.glb':'model/gltf-binary','.woff2':'font/woff2'};
  const srv=http.createServer((rq,rs)=>{const u=new URL(rq.url,'http://x');log.push({m:rq.method,p:u.pathname,range:rq.headers.range||null});
    if(u.pathname==='/blank.html'){n++;rs.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});rs.end('<!doctype html><title>blank</title><body>load '+n+'<script>window.N='+n+'</script>');return;}
    if(u.pathname==='/api/run'&&rq.method==='POST'){rs.writeHead(200,{'content-type':'application/json'});rs.end('{"token":"stub"}');return;}
    const f=path.join(dir,decodeURIComponent(u.pathname));if(!f.startsWith(dir)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);rs.end();return;}
    const st=fs.statSync(f),h={'content-type':MIME[path.extname(f)]||'application/octet-stream','accept-ranges':'bytes','cache-control':'no-store'};
    const m=/^bytes=(\d*)-(\d*)$/.exec(rq.headers.range||'');
    if(m){const a=m[1]===''?Math.max(0,st.size-(+m[2])):+m[1],z=m[1]===''||m[2]===''?st.size-1:Math.min(+m[2],st.size-1);
      if(a>z||a>=st.size){rs.writeHead(416,{'content-range':'bytes */'+st.size});rs.end();return;}
      rs.writeHead(206,{...h,'content-range':'bytes '+a+'-'+z+'/'+st.size,'content-length':z-a+1});fs.createReadStream(f,{start:a,end:z}).pipe(rs);return;}
    rs.writeHead(200,{...h,'content-length':st.size});fs.createReadStream(f).pipe(rs);});
  srv.listen(0,'127.0.0.1',()=>res({srv,log,origin:'http://127.0.0.1:'+srv.address().port}));});}
async function swPhase(b){
  console.log('sw.js) with the service worker in control, media range requests, models and /api are untouched; nothing is cached');
  const dir=path.resolve(process.env.HEADS_DIR||path.join(ROOT,'dist-test'));
  const S=await serve(dir);
  const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[],resp=[];
  p.on('pageerror',e=>errs.push(e.message));
  p.on('response',r=>{const u=new URL(r.url());if(u.origin===S.origin)resp.push({p:u.pathname,s:r.status(),sw:r.fromServiceWorker(),rg:r.request().headers()['range']||null,doc:r.request().resourceType()==='document'});});
  await p.goto(S.origin+'/blank.html');
  const ctl=await p.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(res=>{navigator.serviceWorker.addEventListener('controllerchange',res,{once:true});setTimeout(res,8000);});return !!navigator.serviceWorker.controller;});
  ok(ctl,'the service worker is active and controls the page');
  resp.length=0;
  const f1=await p.evaluate(async()=>{const r=await fetch('/assets/music/game.mp3',{headers:{Range:'bytes=0-1023'}});const bb=await r.arrayBuffer();return {s:r.status,cr:r.headers.get('content-range'),n:bb.byteLength,ar:r.headers.get('accept-ranges')};});
  ok(f1.s===206&&f1.n===1024&&/^bytes 0-1023\/\d+$/.test(f1.cr),'range request for game.mp3 bytes 0-1023 -> 206, 1024 bytes, '+f1.cr);
  const f2=await p.evaluate(async()=>{const r=await fetch('/assets/music/game.mp3',{headers:{Range:'bytes=500000-500999'}});const bb=await r.arrayBuffer();return {s:r.status,cr:r.headers.get('content-range'),n:bb.byteLength};});
  ok(f2.s===206&&f2.n===1000&&/^bytes 500000-500999\//.test(f2.cr),'range request in the middle of the file -> 206, '+f2.cr);
  const f3=await p.evaluate(async()=>{const r=await fetch('/assets/opening.mp4',{headers:{Range:'bytes=0-'}});const rd=r.body.getReader();const c=await rd.read();rd.cancel();return {s:r.status,cr:r.headers.get('content-range'),got:c.value?c.value.length:0};});
  ok(f3.s===206&&f3.got>0,'open-ended range for the opening film -> 206 ('+f3.cr+')');
  const au=await p.evaluate(()=>new Promise(res=>{const a=new Audio('/assets/music/menu.mp3');a.preload='auto';a.onloadedmetadata=()=>res({d:a.duration});a.onerror=()=>res({d:0,err:a.error&&a.error.code});setTimeout(()=>res({d:-1}),20000);}));
  ok(au.d>30,'an <audio> element streams menu.mp3 through the service worker page ('+(au.d>0?au.d.toFixed(1)+' s':JSON.stringify(au))+')');
  const api=await p.evaluate(async()=>{const r=await fetch('/api/run',{method:'POST'});return {s:r.status,j:await r.json()};});
  ok(api.s===200&&api.j.token==='stub','POST /api/run reaches the server untouched');
  const glb=await p.evaluate(async()=>{const r=await fetch('/assets/models/ship_test.glb');return {s:r.status,n:(await r.arrayBuffer()).byteLength};});
  ok(glb.s===200&&glb.n>1000,'a model downloads normally ('+glb.n+' bytes)');
  await p.waitForTimeout(300);
  const subs=resp.filter(r=>!r.doc);
  ok(subs.length>=6&&subs.every(r=>r.sw===false),'none of the '+subs.length+' non-page requests went through the service worker');
  ok(resp.some(r=>r.rg&&r.s===206),'the range requests arrived at the server with their Range header and were answered 206');
  // navigations: answered by the worker with a plain network fetch, never from a cache
  const nav=await p.goto(S.origin+'/blank.html');
  ok(nav.fromServiceWorker(),'a page navigation is answered by the service worker');
  ok(await p.evaluate(()=>window.N)===S.log.filter(l=>l.p==='/blank.html').length,'the page comes from the network every time (load #'+await p.evaluate(()=>window.N)+')');
  ok(await p.evaluate(async()=>(await caches.keys()).length===0),'nothing is cached (Cache Storage is empty)');
  ok(!errs.length,'no page errors '+JSON.stringify(errs.slice(0,3)));
  await ctx.close();S.srv.close();}

(async()=>{
  const b=await chromium.launch({args:ARGS});
  const all={pc:pcPhase,android:androidMenuPhase,pause:androidPausePhase,ios:iosPhase,en:enPhase,installed:installedPhase,sw:swPhase};
  const only=(process.env.INSTALL_PHASES||'').split(',').filter(Boolean); // e.g. INSTALL_PHASES=ios,en to run just those while working on one of them
  const phases=Object.keys(all).filter(k=>!only.length||only.includes(k)).map(k=>all[k]);
  for(const ph of phases){
    try{await ph(b);}catch(e){bad++;console.log('  FAIL phase '+ph.name+' crashed: '+(e&&e.stack||e));}}
  await b.close();
  console.log(bad?'FAIL ('+bad+')':'OK');process.exitCode=bad?1:0;})();
