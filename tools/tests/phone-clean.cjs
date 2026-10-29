// Phone "clean screen" (v63): messages go to a small alert (top) or a side feed (left), breach markers fade with distance,
// trichome counts hide near the middle. Run on dist-test. Screenshots: phone_clean_<moment>.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__lang='es';});
 await p.goto(BASE+'/test.html?q=3');
 await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});
 await p.tap('#mmGo');
 const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 const snap=async name=>{await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(350);
   await p.screenshot({path:shot('phone_clean_'+name+'.png'),timeout:180000});await p.evaluate(()=>{window.__manual=0;});};
 const st=()=>p.evaluate(()=>{const tx=id=>{const e=document.getElementById(id);return e?e.innerText.replace(/\n/g,' / '):null;};
   return {alert:document.getElementById('mAlert')&&document.getElementById('mAlert').classList.contains('on')?tx('mAlert'):'-',feed:tx('mFeed'),
     msgShown:getComputedStyle(document.getElementById('msg')).display,combo:getComputedStyle(document.getElementById('combo')).display,
     brk:[...document.querySelectorAll('.mk.brk:not([hidden])')].map(m=>m.style.opacity+'@'+m.style.transform.replace(/translate\(-50%, -50%\) /,'')),
     tri:[...document.querySelectorAll('#h4m .mk:not([hidden])')].map(m=>(m.classList.contains('mid')?'mid':'edge')+':'+getComputedStyle(m.querySelector('.lb')).display)};});
 await step(0.6);console.log('start',JSON.stringify(await st()));await snap('a_inicio');
 // two breaches: one near the astronaut, one far away; some trichomes floating out
 await p.evaluate(()=>{const P=__heads.P,ps=__T.PATCHES.slice().sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos));
   ps[2].hp=0;ps[ps.length-1].hp=0;__T.leakFrom(ps[2],12);__T.leakFrom(ps[ps.length-1],10);});
 await step(1.5);console.log('breaches',JSON.stringify(await st()));await snap('b_roturas');
 // an important message with no voice (voices off in the pause menu): too far from the ship
 await p.evaluate(()=>{__TC.paused=false;});const pb=await p.evaluate(()=>{const r=document.getElementById('hud-pause').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];});
 await p.touchscreen.tap(pb[0],pb[1]);await p.waitForTimeout(300);await p.tap('#tPauseM [data-a=vo]');await p.tap('#tPauseM [data-a=go]');await p.waitForTimeout(200);
 await p.evaluate(()=>{for(const s of [...__heads.spiders])__heads.killSpider(s);window.__noSpawn=1;__heads.P.pos.set(0,10,95);__heads.P.vel.set(0,0,0);});
 await step(0.3);console.log('too far',JSON.stringify(await st()));await snap('c_alerta');
 console.log('errors',JSON.stringify(errs.slice(0,5)));
 await b.close();})();
