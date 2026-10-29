// PC HUD (v64): TRAJE/NAVE and score at the top, bigger and further in; tank as icon + bar; the blue charge screen on the backpack.
// Run on dist-test. Screenshots: pc_hud_<width>.png and backpack_<load>.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const [w,h] of [[1920,1080],[2560,1080]]){
  const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/test.html?q=3');
  await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
  await p.evaluate(()=>document.getElementById('play').click());
  const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
  await p.evaluate(()=>{window.__noSpawn=1;__heads.P.carry=38;window.__pwrTest=1;});await step(1.5);
  const box=await p.evaluate(()=>Object.fromEntries(['hVit','hScore','hTk','pwr','hTop','hTank'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();
    return [id,getComputedStyle(document.getElementById(id)).display==='none'?'hidden':[r.left,r.top,r.width,r.height].map(Math.round).join(',')];})));
  console.log(w+'x'+h,JSON.stringify(box));
  await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(300);
  await p.screenshot({path:shot('pc_hud_'+w+'.png'),timeout:180000});await p.evaluate(()=>{window.__manual=0;});
  if(w===1920){
   // close-up of the backpack screen at several loads
   for(const [name,carry] of [['vacia',0],['media',30],['llena',60]]){
    await p.evaluate(c=>{const P=__heads.P;P.carry=c;for(const sp of [...__heads.spiders])__heads.killSpider(sp);P.pos.set(0,25,40);P.vel.set(0,0,0);},carry);await step(3); // far from the hold and the spiders, so nothing unloads or bites
    await p.evaluate(()=>{const P=__heads.P,T=__THREE,s=new T.Vector3(),q=new T.Quaternion();P.scr.getWorldPosition(s);P.scr.getWorldQuaternion(q);
      const n=new T.Vector3(0,0,1).applyQuaternion(q);window.__shotCam={pos:s.clone().addScaledVector(n,0.55).add(new T.Vector3(0,0.05,0)).toArray(),look:s.toArray()};window.__manual=1;});
    await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(300);
    await p.screenshot({path:shot('backpack_'+name+'.png'),clip:{x:560,y:240,width:800,height:600},timeout:180000});
    await p.evaluate(()=>{window.__shotCam=null;window.__manual=0;});
    console.log('backpack',name,JSON.stringify(await p.evaluate(()=>({level:+__heads.P.tank.level.toFixed(2),u:+__heads.P.scr.material.uniforms.uLevel.value.toFixed(2)}))));}
  }
  console.log('errors',JSON.stringify(errs.slice(0,3)));await p.close();}
 await b.close();})();
