// PC info (v68): breach markers, bigger/brighter loose trichomes, a readable tank bar and the key hints at the bottom left.
// Run on dist-test. Screenshots: pc_info_<n>.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__noTip=0;});
 await p.goto(BASE+'/test.html?q=3');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
 await p.evaluate(()=>document.getElementById('play').click());
 const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 const snap=async name=>{await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(300);
   await p.screenshot({path:shot(name),timeout:180000});await p.evaluate(()=>{window.__manual=0;});};
 const info=()=>p.evaluate(()=>{const vis=el=>el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
   const r=el=>{const q=el.getBoundingClientRect();return [q.left,q.top,q.width,q.height].map(Math.round).join(',');};
   return {brk:[...document.querySelectorAll('#bMk .mk')].filter(vis).map(m=>m.textContent.trim()+'@'+r(m)),
     keys:vis(document.getElementById('pcKeys'))?[...document.querySelectorAll('#pcKeys .pk')].filter(vis).map(e=>e.innerText.replace(/\n+/g,' ')):'hidden',
     tk:r(document.querySelector('#hTk .tkT')),playT:+__T.playT.toFixed(1)};});
 // 1) right at the start: the key hints
 await step(1.5);console.log('start',JSON.stringify(await info()));await snap('pc_info_1_inicio.png');
 // 2) two breaches and some trichomes floating, a few in the tank
 await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);const P=__heads.P;P.carry=34;
   const ps=__T.PATCHES.slice().sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos));
   for(const pa of [ps[3],ps[ps.length-2]]){pa.hp=0;__T.leakFrom(pa,16);}__T.toSpawn=6;});
 await step(1.2);console.log('breaches',JSON.stringify(await info()));await snap('pc_info_2_agujeros.png');
 // 3) close to a leak: the floating trichomes, and the weld + vacuum hints light up
 const lit=await p.evaluate(()=>{const P=__heads.P,T=__THREE,pa=__T.PATCHES.filter(q=>q.hp<=0).sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos))[0];
   P.pos.copy(pa.pos).addScaledVector(pa.n,3);P.vel.set(0,0,0);__T.leakFrom(pa,20);return true;});
 await step(0.6);console.log('near a leak',JSON.stringify(await info()),JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#pcKeys .pk.lit')].map(r=>r.dataset.k))));
 await p.evaluate(()=>{const P=__heads.P,pa=__T.PATCHES.filter(q=>q.hp<=0).sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos))[0],T=__THREE;
   const side=new T.Vector3().crossVectors(pa.n,new T.Vector3(0,0,1)).normalize();window.__shotCam={pos:pa.pos.clone().addScaledVector(pa.n,4.5).addScaledVector(side,4).toArray(),look:pa.pos.clone().addScaledVector(pa.n,1.8).toArray()};});
 await snap('pc_info_3_particulas.png');await p.evaluate(()=>{window.__shotCam=null;});
 // 4) carrying a full tank away from the hold: "ve a dejar los tricomas" lit
 await p.evaluate(()=>{const P=__heads.P;P.carry=60;P.pos.set(0,22,30);P.vel.set(0,0,0);});await step(0.6);
 console.log('full tank',JSON.stringify(await info()),JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#pcKeys .pk.lit')].map(r=>r.dataset.k))));
 await snap('pc_info_4_lleno.png');
 // 5) learning: 3 dashes and 2 repairs take those rows away
 await p.evaluate(()=>{for(let i=0;i<3;i++){__heads.P.dashCD=1;__step(2);}});
 await step(1);console.log('after 3 dashes',JSON.stringify(await info()));
 console.log('errors',JSON.stringify(errs.slice(0,3)));await b.close();})();
