// v88 «TANQUE LLENO» quieter: pictures of the small indicator under the TRICOMAS bar (PC #hFull, phone #hud-full), with a leak and floating trichomes so
// the FUGAS / POR RESCATAR chips are there too. Only pictures (tools/tests/out/tanque88_*.png) and a few sanity checks.
//   npm run build:test && tools/run-test.sh dist-test tools/tests/tanque-shots.cjs
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i):''));if(!c)bad++;};
const PLAT={pc:{viewport:{width:1600,height:900}},phone:{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}};
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const [plat,lang] of [['pc','es'],['phone','es'],['pc','en']]){
  const ctx=await b.newContext(PLAT[plat]),p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.addInitScript(l=>{window.__noTut=1;window.__noCine=1;if(l==='en')window.__lang='en';try{localStorage.setItem('heads_tank_seen','1');}catch(_){}},lang);
  await p.goto(BASE+'/test.html?q=1');
  if(plat==='pc'){await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});await p.evaluate(()=>document.getElementById('play').click());}
  else{await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});await p.waitForTimeout(1500);await p.tap('#mmGo');}
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
  await p.evaluate(()=>{const H=__heads;window.__noSpawn=1;__T.toSpawn=3;H.WB.spitQ=[1e9];for(const s of [...H.spiders])H.killSpider(s);H.P.hp=100;H.P.inv=1e9;
    __T.PATCHES[3].hp=20;__T.PATCHES[9].hp=0; // two leaks
    const h=__T.HATCH,P=H.P;P.pos.set(h.x+7,h.y+4,h.z+12);P.vel.set(0,0,0);const d=h.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z)-0.25;P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z))+0.05;});
  await p.waitForTimeout(2500);
  // full: a new fill (the indicator pops in), then a bite spills two and they come back (nothing new)
  await p.evaluate(()=>{__heads.P.carry=__CFG.tankCap;});await p.waitForTimeout(450);
  await p.screenshot({path:shot(`tanque88_${plat}_${lang}_entra.png`)});
  await p.waitForTimeout(1600);
  const id=plat==='pc'?'hFull':'hud-full';
  let r=await p.evaluate(i=>{const e=document.getElementById(i),K=__tank.TK;return {on:!!e&&(i==='hFull'?!e.hidden:!e.classList.contains('off')),txt:e?e.textContent:'',log:K.log.join(','),say:K.voN,msg:document.getElementById('msg').textContent};},id);
  ok(r.on&&r.log==='fill',`${plat} ${lang}: full -> the small indicator «${r.txt}», no message on the round line`,r);
  await p.screenshot({path:shot(`tanque88_${plat}_${lang}.png`)});
  await p.evaluate(()=>{__heads.P.carry=__CFG.tankCap-2;});await p.waitForTimeout(500);await p.evaluate(()=>{__heads.P.carry=__CFG.tankCap;});await p.waitForTimeout(600);
  r=await p.evaluate(i=>{const e=document.getElementById(i),K=__tank.TK;return {on:!!e&&(i==='hFull'?!e.hidden:!e.classList.contains('off')),log:K.log.join(','),say:K.voN};},id);
  ok(r.on&&r.log==='fill','  a bite spills 2 and they come back: nothing new (indicator stays, no sound, no voice)',r);
  if(plat==='pc'&&lang==='es'){ // the whole top of the screen, closer
    await p.screenshot({path:shot('tanque88_pc_es_arriba.png'),clip:{x:400,y:0,width:800,height:200}});}
  ok(p.errs.length===0,'  no page errors',p.errs.slice(0,3));await ctx.close();}
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
