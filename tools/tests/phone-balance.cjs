// Phone balance (v65): one try at the golden band per plate, auto-collect 4.5 m (15 m with the magnet prize), boss bar small at the top right.
// Run on dist-test. Screenshot: phone_boss.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__lang='es';});
 await p.goto(BASE+'/test.html?q=3');
 await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});
 await p.waitForTimeout(2500);await p.tap('#mmGo');
 const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 await step(0.5);
 // weld: next to a broken plate during combat (the band is there), first tap outside the band, then inside it
 await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);
   const P=__heads.P,pa=__T.PATCHES[9];pa.hp=0;P.pos.copy(pa.pos).addScaledVector(pa.n,2.0);P.vel.set(0,0,0);const d=pa.pos.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));window.__pa=pa;});
 await step(0.3);
 const tapWeld=async()=>{const r=await p.evaluate(()=>{const e=document.getElementById('hud-weld').getBoundingClientRect();return [e.left+e.width/2,e.top+e.height/2];});await p.touchscreen.tap(r[0],r[1]);};
 const w0=await p.evaluate(()=>({useBand:__T.R.useBand,band:+__T.R.band.toFixed(2),prog:+window.__pa.prog.toFixed(2),perfect:__heads.stats.perfect,cls:document.getElementById('hud-weld').className}));
 await p.evaluate(()=>{const R=__T.R;if(R.pa)R.pa.prog=Math.max(0,R.band-0.2);});await tapWeld();await step(0.1);
 const w1=await p.evaluate(()=>({noPerf:!!window.__pa.noPerf,cls:document.getElementById('hud-weld').className}));
 await p.evaluate(()=>{const R=__T.R;if(R.pa)R.pa.prog=R.band+0.03;});await tapWeld();await step(0.1);
 const w2=await p.evaluate(()=>({hp:Math.round(window.__pa.hp),perfect:__heads.stats.perfect}));
 for(let k=0;k<20&&await p.evaluate(()=>window.__pa.hp<25);k++)await step(0.25);
 const w3=await p.evaluate(()=>({hp:Math.round(window.__pa.hp),perfect:__heads.stats.perfect,noPerf:!!window.__pa.noPerf}));
 console.log('weld one try',JSON.stringify({w0,w1,w2,w3}));
 // auto-collect radius: one floating grain, the astronaut placed 6 m, 4 m and (with the magnet prize) 12 m away from it
 const near=await p.evaluate(()=>{const P=__heads.P,T=__THREE,out={};for(const s of [...__heads.spiders])__heads.killSpider(s);
   const pa=__T.PATCHES[3];__T.leakFrom(pa,1);__heads.PU.pack=15;P.pos.copy(pa.pos).addScaledVector(pa.n,3);const g=__tcNearDust();
   if(!g)return 'no grain';const G=g.clone(),dir=new T.Vector3(0,1,0);
   for(const [k,dist,pack] of [['6m',6,0],['4m',4,0],['12m_iman',12,15],['17m_iman',17,15]]){__heads.PU.pack=pack;P.pos.copy(G).addScaledVector(dir,dist);out[k]=!!__tcNearDust();}
   __heads.PU.pack=0;return out;});
 console.log('auto-collect finds the grain',JSON.stringify(near));
 // boss bar: bring in a spitter and look where its bar sits
 await p.evaluate(()=>{__heads.spawnSpitter&&__heads.spawnSpitter();});await step(3);
 const boss=await p.evaluate(()=>{const r=id=>{const e=document.getElementById(id);if(!e)return null;const q=e.getBoundingClientRect();return [q.left,q.top,q.right,q.bottom].map(Math.round);};
   return {hidden:document.getElementById('boss').hidden,boss:r('boss'),score:r('hud-score'),pwr:r('pwr'),alerts:r('hud-alerts')};});
 console.log('boss',JSON.stringify(boss));
 await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(350);
 await p.screenshot({path:shot('phone_boss.png'),timeout:180000});
 console.log('errors',JSON.stringify(errs.slice(0,5)));
 await b.close();})();
