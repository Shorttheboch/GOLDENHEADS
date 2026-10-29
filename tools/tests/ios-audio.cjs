// Phone sound: the audio comes back after the system stops it, but not while paused on purpose. Run on dist-test.
// Since v60 the phone start menu replaces the text menu: the tests tap its JUGAR (#mmGo).
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:[...ARGS.filter(a=>a!=='--disable-audio-output'),'--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__lang='es';});
 await p.goto(BASE+'/test.html');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:240000});
 await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go'),null,{timeout:120000});await p.waitForTimeout(2500); // let the menu finish opening
 await p.tap('#mmGo');await p.evaluate(()=>{window.__noRender=1;});await p.waitForTimeout(4000);
 const st=()=>p.evaluate(()=>__AC().state);
 console.log('after play',await st());
 // simulate iOS stopping the context, then a touch while playing
 await p.evaluate(()=>__AC().suspend());await p.waitForTimeout(300);console.log('stopped',await st());
 await p.touchscreen.tap(600,120);await p.waitForTimeout(500);console.log('after a touch',await st());
 // paused on purpose: a touch must NOT restart it; CONTINUAR does
 await p.evaluate(()=>{window.__noRender=0;});await p.tap(await p.evaluate(()=>document.querySelector('.hudm')?'#hud-pause':'#tPause'));await p.waitForTimeout(500);console.log('paused',await st(),'menu',await p.evaluate(()=>!document.getElementById('tPauseM').hidden));
 await p.touchscreen.tap(420,60);await p.waitForTimeout(400);console.log('touch while paused',await st());
 await p.tap('#tPauseM [data-a=go]');await p.waitForTimeout(500);console.log('after CONTINUAR',await st());
 console.log('errors',JSON.stringify(errs.slice(0,3)));await b.close();})();
