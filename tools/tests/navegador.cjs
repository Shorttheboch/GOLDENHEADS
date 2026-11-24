// v99: the screen shown inside the browser of Instagram & co. (public/navegador.js). Run on dist-test (or dist).
// iPhone Instagram (ES, EN, small screen) · Android Instagram (ABRIR EN CHROME = intent:// link) · nothing downloads behind it · COPIAR ENLACE copies the link
// with ?nav=ig · «seguir aquí» lets the game load · a normal browser arriving with ?nav=ig: no screen, the mark leaves the address and PANTALLA COMPLETA glows ·
// Safari, Chrome and PC without the mark: nothing changes. Photos: out/navegador_*.png
const {chromium}=require('playwright');const {BASE,ARGS,shot}=require('./lib.cjs');
let fails=0;const ok=(c,m,d)=>{console.log((c?'  ok   ':'  FAIL ')+m+(c||d===undefined?'':'  '+JSON.stringify(d)));if(!c)fails++;};
const UA={
  igIOS:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 385.0.0.0.80 (iPhone15,2; iOS 18_5; es_ES; es; scale=3.00; 1179x2556; IABMV/1; 731296383)',
  igAnd:'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36 Instagram 356.0.0.41.101 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; es_ES; 658486497)',
  fbIOS:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 [FBAN/FBIOS;FBAV/500.0.0.40.110;FBBV/700000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBCR/;FBID/phone;FBLC/es_ES;FBOP/5]',
  safari:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'};
(async()=>{const b=await chromium.launch({args:ARGS});
 const open=async(name,{ua,w=390,h=844,locale='es-ES',q='',touch=true,spot=0})=>{
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:touch,hasTouch:touch,userAgent:ua,locale});
  try{await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:BASE});}catch(_){}
  const p=await ctx.newPage();const reqs=[];if(spot)await p.addInitScript(ms=>{window.__spotMs=ms;},spot);p.on('request',r=>reqs.push(r.url()));p.on('pageerror',e=>console.log('ERR',name,e.message));
  await p.goto(BASE+'/test.html'+q,{waitUntil:'domcontentloaded'});return {ctx,p,reqs};};
 const look=p=>p.evaluate(()=>{const o=document.getElementById('navOv');if(!o)return null;const r=o.querySelector('.nb').getBoundingClientRect();
   return {h:o.querySelector('h1').textContent,sub:o.querySelector('.sub').textContent,tip:o.querySelector('.tip').textContent,os:o.dataset.os,
     chrome:(o.querySelector('#navChrome')||{}).href||null,copy:(o.querySelector('#navCopy')||{}).textContent,url:o.querySelector('#navUrl').textContent,
     over:document.documentElement.scrollWidth>innerWidth+1,nbW:Math.round(r.width),vis:getComputedStyle(o).display!=='none',z:+getComputedStyle(o).zIndex};});
 const models=reqs=>reqs.filter(u=>/\.glb(\?|$)/.test(u)).length;

 // 1) iPhone Instagram, Spanish
 {const {ctx,p,reqs}=await open('ios',{ua:UA.igIOS});await p.waitForTimeout(3000);const s=await look(p);console.log('ios',JSON.stringify(s));
  ok(s&&s.vis&&s.z>=100,'iPhone Instagram: the screen covers the page');
  ok(s&&s.h==='JUEGA EN TU NAVEGADOR'&&/Instagram no deja jugar a pantalla completa/.test(s.sub),'iPhone: title and «Instagram no deja jugar…»',s);
  ok(s&&s.os==='ios'&&!s.chrome,'iPhone: no Chrome button (Safari steps instead)',s);
  ok(s&&/PANTALLA COMPLETA/.test(s.tip),'the full-screen tip is in the same message',s&&s.tip);
  ok(s&&!s.over,'nothing sticks out sideways (upright 390 px)');
  ok(models(reqs)===0,'nothing downloads behind the screen (no .glb requested in 3 s)',models(reqs));
  ok(await p.evaluate(()=>!!window.HEADS_INAPP&&window.HEADS_INAPP==='ig'),'HEADS_INAPP = ig');
  ok(await p.evaluate(()=>/[?&]nav=ig\b/.test(location.search)),'the address itself carries ?nav=ig (Instagram\'s own «open in browser» takes it along)',await p.evaluate(()=>location.search));
  await p.screenshot({path:shot('navegador_ios.png')});
  await p.tap('#navCopy');await p.waitForTimeout(400);
  const after=await p.evaluate(async()=>({btn:document.getElementById('navCopy').textContent,clip:await navigator.clipboard.readText().catch(()=>null),n:window.HEADS_NAV_COPIED||0}));
  console.log('copy',JSON.stringify(after));
  ok(after.btn==='¡COPIADO!'&&after.n===1,'COPIAR ENLACE → ¡COPIADO!',after);
  ok(after.clip===null||/\/test\.html\?nav=ig$/.test(after.clip),'the copied link is this page with ?nav=ig',after.clip);
  ok(/\?nav=ig$/.test(s.url),'the link shown carries ?nav=ig',s.url);
  await p.screenshot({path:shot('navegador_ios_copiado.png')});
  // stay anyway → the game loads
  await p.tap('#navStay');await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!document.getElementById('navOv')),'«seguir aquí de todos modos» removes the screen');
  await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000}).catch(()=>{});
  ok(models(reqs)>0&&await p.evaluate(()=>{const g=document.getElementById('mmGo');return !!g&&!g.disabled;}),'…and the game loads as always',models(reqs));
  await ctx.close();}

 // 2) English, small iPhone (SE)
 {const {ctx,p}=await open('ios-en',{ua:UA.igIOS.replace('es_ES; es','en_US; en'),w:320,h:568,locale:'en-US'});await p.waitForTimeout(1500);const s=await look(p);console.log('ios-en',JSON.stringify(s));
  ok(s&&s.h==='PLAY IN YOUR BROWSER'&&/Instagram can't run the game full screen/.test(s.sub)&&/FULL SCREEN/.test(s.tip),'English texts',s);
  ok(s&&!s.over,'320 px wide: nothing sticks out sideways');
  await p.screenshot({path:shot('navegador_ios_en_se.png'),fullPage:true});await ctx.close();}

 // 3) Android Instagram
 {const {ctx,p,reqs}=await open('android',{ua:UA.igAnd,w:412,h:915});await p.waitForTimeout(2000);const s=await look(p);console.log('android',JSON.stringify(s));
  ok(s&&s.os==='android','Android Instagram: the screen is up');
  ok(s&&/^intent:\/\/[^#]+\/test\.html\?nav=ig#Intent;scheme=https;package=com\.android\.chrome;S\.browser_fallback_url=https?%3A%2F%2F/.test(s.chrome),'ABRIR EN CHROME is an intent:// link to this page in Chrome, with a fallback',s&&s.chrome);
  ok(s&&s.copy==='COPIAR ENLACE','COPIAR ENLACE is there too, in case Chrome does not open');
  ok(models(reqs)===0,'Android: nothing downloads behind it');
  await p.screenshot({path:shot('navegador_android.png')});await ctx.close();}

 // 4) Facebook says its name
 {const {ctx,p}=await open('fb',{ua:UA.fbIOS});await p.waitForTimeout(1200);const s=await look(p);ok(s&&/^Facebook no deja/.test(s.sub),'inside Facebook: «Facebook no deja jugar…»',s&&s.sub);await ctx.close();}

 // 5) Safari arriving with ?nav=ig: no screen, the mark leaves the address, PANTALLA COMPLETA glows
 {const {ctx,p}=await open('safari-nav',{ua:UA.safari,w:844,h:390,q:'?nav=ig',spot:9000});await p.waitForTimeout(800);
  const s=await p.evaluate(()=>({ov:!!document.getElementById('navOv'),url:location.search,from:window.HEADS_NAV_FROM,ss:sessionStorage.getItem('heads_nav')}));console.log('safari-nav',JSON.stringify(s));
  ok(!s.ov,'Safari: no screen');ok(s.url==='','the ?nav mark leaves the address',s.url);ok(s.from==='ig'&&s.ss==='ig','…and is kept for the session',s);
  await p.waitForFunction(()=>{const m=document.getElementById('instMenu');return m&&!m.hidden;},null,{timeout:300000}).catch(()=>{});
  await p.waitForTimeout(4200);
  const g=await p.evaluate(()=>{const m=document.getElementById('instMenu');return {hidden:m.hidden,cls:m.className,anim:getComputedStyle(m).animationName};});console.log('glow',JSON.stringify(g));
  ok(!g.hidden&&/navGlow/.test(g.cls)&&/navGlow/.test(g.anim),'the PANTALLA COMPLETA button glows',g);
  const sp=await p.evaluate(()=>{const d=document.getElementById('navSpot'),m=document.getElementById('instMenu');if(!d)return null;const a=d.getBoundingClientRect(),b=m.getBoundingClientRect();
    return {on:d.classList.contains('on'),op:+getComputedStyle(d).opacity,inside:a.left<=b.left&&a.top<=b.top&&a.right>=b.right&&a.bottom>=b.bottom,pe:getComputedStyle(d).pointerEvents};});
  console.log('spot',JSON.stringify(sp));
  ok(sp&&sp.on&&sp.inside&&sp.pe==='none','everything else goes dark around PANTALLA COMPLETA for a moment (taps still pass)',sp);
  await p.screenshot({path:shot('navegador_safari_brillo.png')});
  await p.waitForFunction(()=>!document.getElementById('navSpot'),null,{timeout:15000}).catch(()=>{});ok(await p.evaluate(()=>!document.getElementById('navSpot')),'…and the dark goes away by itself');
  await ctx.close();}

 // 6) Safari without the mark and PC: nothing changes
 {const {ctx,p}=await open('safari',{ua:UA.safari,w:844,h:390});await p.waitForTimeout(1500);
  const s=await p.evaluate(()=>({ov:!!document.getElementById('navOv'),iab:window.HEADS_INAPP||null,from:window.HEADS_NAV_FROM||null,glow:document.getElementById('instMenu').classList.contains('navGlow')}));
  ok(!s.ov&&!s.iab&&!s.from&&!s.glow,'Safari without the mark: nothing new',s);await ctx.close();}
 {const ctx=await b.newContext({viewport:{width:1280,height:720}});const p=await ctx.newPage();await p.goto(BASE+'/test.html');await p.waitForTimeout(1500);
  ok(await p.evaluate(()=>!document.getElementById('navOv')&&!window.HEADS_INAPP&&!window.HEADS_NAV_WAIT),'PC: nothing new');await ctx.close();}
 await b.close();console.log(fails?'FAIL '+fails:'ALL OK');process.exit(fails?1:0);})();
