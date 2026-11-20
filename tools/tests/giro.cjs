// v98: the phone turned without the browser telling the page in time (iOS sends resize before innerWidth / innerHeight change, mostly when the
// game opens from the home screen). The test swallows every `resize` / `orientationchange` the browser sends, turns the phone and checks that,
// within a second, the 3D canvas, the camera and the menu have the new size anyway. Then the same in a round. Run on dist-test.
const {chromium}=require('playwright');const {BASE,ARGS,shot}=require('./lib.cjs');
let fails=0;const ok=(c,m,d)=>{console.log((c?'  ok   ':'  FAIL ')+m+(c||d===undefined?'':'  '+JSON.stringify(d)));if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.addInitScript(()=>{window.__lang='es';window.__eat=0;
   // the browser's own events never reach the game (the game's own synthetic resize still does: isTrusted is false for it)
   for(const t of ['resize','orientationchange'])window.addEventListener(t,e=>{if(e.isTrusted&&window.__eat){e.stopImmediatePropagation();}},true);});
 await p.goto(BASE+'/test.html?q=3');
 await p.waitForFunction(()=>window.__heads&&document.getElementById('mmGo'),null,{timeout:300000});
 const st=()=>p.evaluate(()=>{const c=document.querySelector('canvas'),pr=__composer.renderer.getPixelRatio();return {w:innerWidth,h:innerHeight,cw:c.width,ch:c.height,pr,asp:+__camera.aspect.toFixed(3)};});
 const good=s=>Math.abs(s.cw/s.ch-s.w/s.h)<0.02&&Math.abs(s.asp-s.w/s.h)<0.02;
 await p.waitForTimeout(800);let s=await st();console.log('portrait',JSON.stringify(s));ok(good(s),'portrait: canvas and camera fit the window',s);
 await p.evaluate(()=>{window.__eat=1;});await p.setViewportSize({width:844,height:390});
 await p.waitForTimeout(1300);s=await st();console.log('landscape, no event',JSON.stringify(s));
 ok(good(s),'turned to landscape without any resize event: canvas and camera follow within ~1 s',s);
 await p.screenshot({path:shot('giro_menu.png')});
 await p.evaluate(()=>{window.__eat=0;});
 await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});await p.tap('#mmGo');
 await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
 await p.evaluate(async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();}catch(_){}});await p.waitForTimeout(300); // (JUGAR asks for full screen; the test window can't be resized in it)
 await p.evaluate(()=>{window.__eat=1;});await p.setViewportSize({width:390,height:844});await p.waitForTimeout(1300);s=await st();
 ok(good(s),'in a round, turned to portrait without events: canvas follows',s);
 ok(await p.evaluate(()=>!document.getElementById('tRot').hidden),'in portrait the GIRA EL TELÉFONO warning is up');
 await p.setViewportSize({width:844,height:390});await p.waitForTimeout(1300);s=await st();
 ok(good(s),'and back to landscape without events: canvas follows',s);
 ok(await p.evaluate(()=>document.getElementById('tRot').hidden),'the warning goes away');
 await p.screenshot({path:shot('giro_juego.png')});
 await b.close();console.log(fails?'FAIL '+fails:'ALL OK');process.exit(fails?1:0);})();
