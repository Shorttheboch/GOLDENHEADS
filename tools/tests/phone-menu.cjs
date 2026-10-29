// Phone start menu (ES and EN): animation frames, layout, then tap JUGAR. Run on dist-test.
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const lang of ['es','en']){
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(l=>{window.__lang=l;},lang);
  await p.goto(BASE+'/test.html');
  await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go'),null,{timeout:300000});
  // pause the CSS animations to grab frames at set times
  const at=async(ms,name)=>{await p.evaluate(ms=>{for(const a of document.getAnimations())if(a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('#mobMenu')){a.pause();a.currentTime=ms;}},ms);await p.waitForTimeout(300);await p.screenshot({path:shot('menu_'+lang+'_'+name+'.png'),timeout:240000});};
  if(lang==='es'){await at(250,'a_logo_grande');await at(800,'b_logo_moviendo');await at(1250,'c_paneles_abriendo');}
  await at(4000,'d_final');
  const info=await p.evaluate(()=>({panelHidden:getComputedStyle(document.getElementById('menuPanel')).display,go:document.getElementById('mmGoT').textContent,dis:document.getElementById('mmGo').disabled,
    over:['mmL','mmR','mmLogo'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return id+':'+[r.left,r.top,r.width,r.height].map(Math.round).join(',');}).join(' ')}));
  console.log(lang,JSON.stringify(info));
  // wait until loaded, then tap JUGAR
  await p.waitForFunction(()=>!document.getElementById('mmGo').disabled,null,{timeout:200000});
  await p.evaluate(()=>{for(const a of document.getAnimations())if(a.playState==='paused')a.play();});
  const r=await p.evaluate(()=>{const q=document.getElementById('mmGo').getBoundingClientRect();return [q.left+q.width/2,q.top+q.height/2];});
  await p.touchscreen.tap(r[0],r[1]);await p.waitForTimeout(2500);
  console.log(lang,'after tap',JSON.stringify(await p.evaluate(()=>({menuHidden:document.getElementById('menu').hidden,state:__T.state}))),'errors',JSON.stringify(errs.slice(0,3)));
  await ctx.close();}
 await b.close();})();
