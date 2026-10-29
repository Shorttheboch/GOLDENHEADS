// PC with the REAL build (dist/, no test hooks): language picker, menu, a real mouse click on JUGAR, then the opening video.
// The ship model is swapped for the light test one only because the software GPU runs out of memory with the 4K textures.
const {chromium}=require('playwright');
const path=require('path');
const {BASE,ARGS,shot,ROOT}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext({viewport:{width:1280,height:720}});const p=await ctx.newPage();
 const errs=[],bad=[];p.on('pageerror',e=>errs.push(e.message));
 p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url());});p.on('requestfailed',r=>{if(!/fonts\.g/.test(r.url()))bad.push('failed '+r.url()+' '+(r.failure()&&r.failure().errorText));});
 await p.route('**/assets/models/ship.glb',r=>r.fulfill({path:path.join(ROOT,'tools/test-assets/ship_test.glb'),contentType:'model/gltf-binary'}));
 await p.goto(BASE+'/index.html');
 await p.waitForSelector('#langPick:not([hidden])',{timeout:120000});await p.click('#langPick button[data-l=es]');
 await p.waitForFunction(()=>{const g=document.getElementById('menuGo');return g&&!g.disabled;},null,{timeout:300000});
 await p.waitForTimeout(3000);await p.screenshot({path:shot('pc_menu_real.png'),timeout:180000});
 const r=await p.evaluate(()=>{const g=document.getElementById('menuGo').getBoundingClientRect();return [g.left+g.width/2,g.top+g.height/2];});
 await p.mouse.click(r[0],r[1]);await p.waitForTimeout(300);
 console.log('after real mouse click on JUGAR',JSON.stringify(await p.evaluate(()=>({menuHidden:document.getElementById('menu').hidden,opening:!document.getElementById('opening').hidden}))));
 // note: the test Chromium has no H.264, so the video fails after a moment and the game skips the opening (as it would on a real failure)
 console.log('bad responses',JSON.stringify(bad.slice(0,10)),'errors',JSON.stringify(errs.slice(0,3)));
 await b.close();})();
