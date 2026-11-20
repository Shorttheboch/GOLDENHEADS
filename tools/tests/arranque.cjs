// v97: the first frames of the page, before the game's code runs. PC: no HUD under the menu (body.menuOn from the HTML on). Phone: black
// from the first paint (no white screen), and every iPhone launch screen named in the page exists with the size its media query asks for.
// The game's script is held back 4 s so the page is caught as it is before it. Run on dist-test or dist.
const {chromium,devices}=require('playwright');const fs=require('fs');const path=require('path');const {BASE,ARGS,shot}=require('./lib.cjs');
let fails=0;const ok=(c,m,d)=>{console.log((c?'  ok   ':'  FAIL ')+m+(c||d===undefined?'':'  '+JSON.stringify(d)));if(!c)fails++;};
const dark=c=>{const m=/rgba?\((\d+), (\d+), (\d+)/.exec(c);return !!m&&Math.max(+m[1],+m[2],+m[3])<24;};
const DIR=process.argv[2]||process.env.HEADS_DIR||'dist-test';
(async()=>{const b=await chromium.launch({args:ARGS});
 const look=async(name,opt)=>{const ctx=await b.newContext(opt);const p=await ctx.newPage();
  await p.route(/\/(js|src)\/.*\.js(\?.*)?$/,async r=>{await new Promise(z=>setTimeout(z,4000));await r.continue();});
  await p.goto(BASE+'/'+(fs.existsSync(path.join(DIR,'test.html'))?'test.html':''),{waitUntil:'commit'});await p.waitForFunction(()=>document.body&&document.getElementById('menu'),null,{timeout:20000});await p.waitForTimeout(800);
  const s=await p.evaluate(()=>{const vis=[...document.querySelectorAll('.hud,.mk,#hTop,#hScore,#hVit,#hTank,#cross')].filter(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return c.visibility!=='hidden'&&c.display!=='none'&&r.width>0&&r.height>0&&+c.opacity>0;}).map(e=>e.id||e.className);
    return {menuOn:document.body.classList.contains('menuOn'),bg:getComputedStyle(document.body).backgroundColor,html:getComputedStyle(document.documentElement).backgroundColor,vis,gameRan:!!window.__heads};});
  await p.screenshot({path:shot('arranque_'+name+'.png')});
  await ctx.close();return s;};
 const pc=await look('pc',{viewport:{width:1280,height:720}});
 console.log('pc',JSON.stringify(pc));
 ok(!pc.gameRan,'pc: caught before the game code ran');
 ok(pc.menuOn,'pc: body.menuOn is on from the HTML');
 ok(pc.vis.length===0,'pc: no HUD visible under the menu in the first frames',pc.vis);
 ok(dark(pc.html)&&dark(pc.bg),'pc: the page is black from the start',pc);
 const ph=await look('iphone',{...devices['iPhone 14 landscape']});
 console.log('iphone',JSON.stringify(ph));
 ok(!ph.gameRan,'iphone: caught before the game code ran');
 ok(dark(ph.html)&&dark(ph.bg),'iphone: black from the first paint, no white screen',ph);
 ok(ph.vis.length===0,'iphone: no HUD visible in the first frames',ph.vis);
 // launch screens
 const html=fs.readFileSync(path.join(DIR,'index.html'),'utf8');const L=[...html.matchAll(/<link rel="apple-touch-startup-image" href="([^"]+)" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (\w+)\)">/g)];
 ok(L.length>=20,'launch screens named in the page: '+L.length);let bad=[];
 for(const [,href,w,h,d,o] of L){const f=path.join(DIR,href);if(!fs.existsSync(f)){bad.push(href+' missing');continue;}const buf=fs.readFileSync(f),W=buf.readUInt32BE(16),H=buf.readUInt32BE(20);
  const ew=(o==='portrait'?+w:+h)*+d,eh=(o==='portrait'?+h:+w)*+d;if(W!==ew||H!==eh)bad.push(href+' is '+W+'x'+H+', wanted '+ew+'x'+eh);}
 ok(!bad.length,'every launch screen exists with the exact size of its screen',bad);
 ok(/<meta name="color-scheme" content="dark">/.test(html)&&/<style>html,body\{background:#000\}<\/style>/.test(html),'dark color scheme and black background inline in <head>');
 ok(/fonts\.googleapis\.com[^>]+media="print" onload=/.test(html),'the Oxanium font does not hold back the first frame');
 await b.close();console.log(fails?'FAIL '+fails:'ALL OK');process.exit(fails?1:0);})();
