// Phone start menu (v70: logo, long bar and the panel that unfolds), ES and EN: animation frames, layout checks, then tap JUGAR. Run on dist-test.
// Screenshots: menu_<lang>_<w>x<h>_<moment>.png. Checks: everything inside the screen, every text inside its box (English too), the logo fully visible.
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
// stage units (1764 x 866): the boxes the texts must stay in
const BOX={cap:[[93,483],[502,878],[896,1270],[1290,1675]],ctl:[[213,466],[668,876],[1065,1279],[1475,1690]],warn:[[495,1275]],capY:[500,596]};
const SIZES=[[844,390],[667,375]],EXTRA=[[932,430],[1024,600]];
const MS=[[250,'a_logo_grande'],[850,'b_logo_volando'],[1400,'c_barra'],[1730,'d_panel_abriendo'],[2350,'e_textos']];
let bad=0;
async function run(b,lang,w,h,{frames=false,tap=false}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(l=>{window.__lang=l;window.__cues=[];window.menuSfx=n=>window.__cues.push([n,Math.round(performance.now())]);},lang);
  await p.goto(BASE+'/test.html');
  await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go'),null,{timeout:300000});
  const t0=await p.evaluate(()=>performance.now());
  // pause the CSS animations to grab a frame at a set time
  const at=async(ms,name)=>{await p.evaluate(ms=>{for(const a of document.getAnimations())if(a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('#mobMenu')){a.pause();a.currentTime=ms;}},ms);
    await p.waitForTimeout(250);await p.screenshot({path:shot(`menu_${lang}_${w}x${h}_${name}.png`),timeout:240000});};
  if(frames)for(const [ms,n] of MS)await at(ms,n);
  if(!frames)await p.waitForTimeout(2800); // the ES/EN switch fades in a little after the intro (real time)
  await at(4200,'f_final');
  const r=await p.evaluate(([BOX])=>{const st=document.getElementById('mmStage').getBoundingClientRect(),u=st.width/1764,W=innerWidth,H=innerHeight,probs=[];
    const un=r=>({l:(r.left-st.left)/u,t:(r.top-st.top)/u,r:(r.right-st.left)/u,b:(r.bottom-st.top)/u});
    if(st.left<-0.5||st.top<-0.5||st.right>W+0.5||st.bottom>H+0.5)probs.push('stage outside the screen '+[st.left,st.top,st.right,st.bottom].map(Math.round));
    const lg=document.getElementById('mmLogo').getBoundingClientRect();if(lg.top<-0.5||lg.left<0||lg.right>W)probs.push('logo cut '+[lg.left,lg.top,lg.right,lg.bottom].map(Math.round));
    const rng=el=>{const q=document.createRange();q.selectNodeContents(el);return q;};
    for(const el of document.querySelectorAll('.mmTx')){const q=rng(el);for(const c of (q.getClientRects()))if(c.left<0||c.right>W||c.top<0||c.bottom>H)probs.push('text outside the screen: '+el.textContent.slice(0,20));
      const o=un(q.getBoundingClientRect()),tx=el.textContent.slice(0,22);
      if(el.classList.contains('mmCap')){const i=BOX.cap.findIndex(([a,b])=>(o.l+o.r)/2>a&&(o.l+o.r)/2<b),[a,b]=BOX.cap[i];if(o.l<a+4||o.r>b-4)probs.push('caption wider than its card: '+tx+' '+Math.round(o.l)+'-'+Math.round(o.r)+' in '+a+'-'+b);}
      if(el.classList.contains('mmWarn')&&(o.l<BOX.warn[0][0]+60||o.r>BOX.warn[0][1]-6))probs.push('warning wider than its strip: '+Math.round(o.l)+'-'+Math.round(o.r));
      if(el.classList.contains('mmCtl')){const i=BOX.ctl.findIndex(([a,b])=>o.l>=a-3&&o.l<b),[a,b]=BOX.ctl[i];if(o.r>b)probs.push('control text too wide: '+tx+' '+Math.round(o.r)+' > '+b);}
      if(el.classList.contains('mmTab')&&(o.r-o.l>320))probs.push('tab too wide: '+tx);}
    const g=document.getElementById('mmGo'),gr=un(g.getBoundingClientRect());
    return {probs,stage:[st.left,st.top,st.width,st.height].map(Math.round).join(','),go:document.getElementById('mmGoT').textContent,dis:g.disabled,
      logo:[lg.left,lg.top,lg.width,lg.height].map(Math.round).join(','),goBox:[gr.l,gr.t,gr.r,gr.b].map(Math.round).join(','),panelHidden:getComputedStyle(document.getElementById('menuPanel')).display,
      fonts:['TekturE','TitilliumH'].map(f=>f+':'+document.fonts.check('700 20px '+f)).join(' ')};},[BOX]);
  console.log(lang,w+'x'+h,JSON.stringify({...r,probs:undefined}));
  if(frames){const c=await p.evaluate(()=>window.__cues);console.log('  sound cues (name, ms after the start; none if the game brings its own menuSfx):',JSON.stringify(c.map(([n,t])=>[n,Math.round(t-t0)])));}
  if(r.probs.length){bad++;console.log('  PROBLEMS',JSON.stringify(r.probs));}
  // while the game loads, the plate shows the loading text: it must fit inside the plate (checked by faking the loading state for a moment)
  {const L=await p.evaluate(async()=>{const pl=document.getElementById('play'),ld=document.getElementById('load'),old=[pl.disabled,ld.textContent];pl.disabled=true;ld.textContent='Cargando modelos 100%';
      await new Promise(r=>setTimeout(r,600));const t=document.getElementById('mmGoT'),q=document.createRange();q.selectNodeContents(t);const o={txt:t.textContent,w:q.getBoundingClientRect().width,box:document.getElementById('mmGo').getBoundingClientRect().width};
      pl.disabled=old[0];ld.textContent=old[1];return o;});
   console.log('  loading text',JSON.stringify(L));if(L.w>L.box*0.86){bad++;console.log('  PROBLEM loading text too wide for the plate');}}
  if(tap){
    await p.waitForFunction(()=>!document.getElementById('mmGo').disabled,null,{timeout:200000});
    await p.evaluate(()=>{for(const a of document.getAnimations())if(a.playState==='paused')a.play();});await p.waitForTimeout(600);
    const q=await p.evaluate(()=>{const e=document.getElementById('mmGo').getBoundingClientRect();return [e.left+e.width/2,e.top+e.height/2];});
    await p.touchscreen.tap(q[0],q[1]);await p.waitForTimeout(2500);
    console.log(lang,'after tap',JSON.stringify(await p.evaluate(()=>({menuHidden:document.getElementById('menu').hidden,state:__T.state}))),'errors',JSON.stringify(errs.slice(0,3)));}
  else console.log('  errors',JSON.stringify(errs.slice(0,3)));
  if(errs.length)bad++;
  await ctx.close();}
(async()=>{
 const b=await chromium.launch({args:ARGS});
 await run(b,'es',844,390,{frames:true,tap:true});
 await run(b,'en',844,390);
 await run(b,'es',667,375);await run(b,'en',667,375);
 for(const [w,h] of EXTRA)await run(b,'es',w,h);
 await b.close();
 // sound cues: the menu calls window.menuSfx(name) at its beats (the sounds are another piece); checked in the last page only through the frames above
 console.log(bad?'FAIL':'OK');process.exitCode=bad?1:0;})();
