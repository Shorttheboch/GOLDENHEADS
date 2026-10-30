// Phone tutorial (v66): after 20 s of play the game pauses and five screens explain controls and HUD.
// Checks: it opens on time and freezes the game, the piece explained is lifted, a tap / the timer pass screens, SALTAR ends it,
// it is remembered, CÓMO SE JUEGA shows it again, English texts. Run on dist-test. Screenshots: phone_tut_<n>_<step>.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
async function game(b,lang,store){
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([l,s])=>{window.__lang=l;window.__noTut=0;if(s)localStorage.setItem('heads_tut','1');},[lang,store]);
  await p.goto(BASE+'/test.html?q=3');
  await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});
  await p.waitForTimeout(2500);await p.tap('#mmGo');
  return {ctx,p,errs,step:s=>p.evaluate(n=>__step(n),Math.round(s/0.05))};}
const st=p=>p.evaluate(()=>{const L=document.getElementById('mTutL'),q=s=>L&&L.querySelector(s);
  return {open:!!L&&!L.hidden,step:L?L.className.replace(/\s*in\b/,''):'',title:q('.mtH')&&q('.mtH').textContent,lines:q('.mtX')&&q('.mtX').innerText.replace(/\n+/g,' / '),
    hl:[...document.querySelectorAll('.mtut-hl')].map(e=>e.id||e.className.split(' ')[0]),up:[...document.querySelectorAll('.mtut-up')].map(e=>e.id||e.className.split(' ')[0]),
    playT:+__T.playT.toFixed(2),on:__T.MTUT.on,done:__T.MTUT.done,list:__T.MTUT.list.join(','),stored:localStorage.getItem('heads_tut')};});
const settle=async p=>{await p.waitForTimeout(450);await p.evaluate(()=>__step(1));};
const snap=async(p,name)=>{await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(150);await p.evaluate(()=>__render());await p.waitForTimeout(300);
  await p.screenshot({path:shot(name),timeout:180000});};
(async()=>{
 const b=await chromium.launch({args:ARGS});
 // 1) first game: play 20 s, then the tutorial (with trichomes floating, so step 4 is in)
 {const {ctx,p,errs,step}=await game(b,'es',false);
  await step(1);console.log('at 1 s',JSON.stringify(await st(p)));
  await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);const P=__heads.P,ps=__T.PATCHES.slice().sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos));
    const far=ps[ps.length-1];far.hp=0;__T.leakFrom(far,14);__T.playT=19.5;});
  await step(0.8);await p.evaluate(()=>{__T.MTUT.dur=1e9;});await settle(p);const a=await st(p);console.log('opened',JSON.stringify(a));
  await step(2);console.log('frozen (playT unchanged)',(await st(p)).playT===a.playT);
  const names=['1_mueve','2_mira','3_tricomas','4_recoge','5_traje'];
  for(let i=0;i<5;i++){await settle(p);console.log('screen',i+1,JSON.stringify(await st(p)));await snap(p,'phone_tut_'+names[i]+'.png');
    if(i<4){await p.waitForTimeout(650);await p.touchscreen.tap(420,330);await p.evaluate(()=>__step(1));}}
  // the last screen passes on its own
  await p.evaluate(()=>{__T.MTUT.dur=4200;__T.MTUT.t0=performance.now();});await p.waitForTimeout(5200);await p.evaluate(()=>__step(1));const e=await st(p);console.log('after the last one (timer)',JSON.stringify(e));
  await step(1);console.log('game runs again',(await st(p)).playT>e.playT);
  // CÓMO SE JUEGA in the pause menu shows it again; SALTAR ends it
  const pb=await p.evaluate(()=>{const r=document.getElementById('hud-pause').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];});
  await p.touchscreen.tap(pb[0],pb[1]);await p.waitForTimeout(300);await p.tap('#tPauseM [data-a=tut]');await settle(p);
  console.log('again from pause',JSON.stringify(await st(p)));
  await p.waitForTimeout(4500);await p.evaluate(()=>__step(1));console.log('passed on its own',JSON.stringify((await st(p)).step));
  const sk=await p.evaluate(()=>{const r=document.querySelector('#mTutL .mtSkip').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,r.width,r.height];});
  console.log('SALTAR box',JSON.stringify(sk.slice(2)));
  await p.touchscreen.tap(sk[0],sk[1]);await p.evaluate(()=>__step(1));console.log('after SALTAR',JSON.stringify(await st(p)));
  console.log('errors',JSON.stringify(errs.slice(0,5)));await ctx.close();}
 // 2) a phone that has seen it: nothing at 20 s
 {const {ctx,p,errs,step}=await game(b,'es',true);
  await step(0.5);await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);__T.playT=19.5;});await step(1.5);
  console.log('seen before',JSON.stringify(await st(p)));console.log('errors',JSON.stringify(errs.slice(0,5)));await ctx.close();}
 // 3) English, and no trichomes floating: step 4 waits and shows on its own when they float
 {const {ctx,p,errs,step}=await game(b,'en',false);
  await step(0.5);await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);__T.playT=19.5;});
  await step(0.8);await p.evaluate(()=>{__T.MTUT.dur=1e9;});await settle(p);console.log('EN opened',JSON.stringify(await st(p)));
  for(let i=0;i<3;i++){await p.waitForTimeout(650);await p.touchscreen.tap(420,330);await p.evaluate(()=>__step(1));await settle(p);console.log('EN screen',i+2,JSON.stringify(await st(p)));}
  await p.waitForTimeout(650);await p.touchscreen.tap(420,330);await p.evaluate(()=>__step(1));console.log('EN closed',JSON.stringify(await st(p)));
  await p.evaluate(()=>{const P=__heads.P,ps=__T.PATCHES.slice().sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos)),far=ps[ps.length-1];far.hp=0;__T.leakFrom(far,14);});
  await step(1);await settle(p);console.log('step 4 later',JSON.stringify(await st(p)));await snap(p,'phone_tut_en_4_later.png');
  console.log('errors',JSON.stringify(errs.slice(0,5)));await ctx.close();}
 await b.close();})();
