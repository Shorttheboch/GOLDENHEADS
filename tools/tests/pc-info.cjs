// PC info (v68): breach markers, bigger/brighter loose trichomes, a readable tank bar and the key hints at the bottom left.
// Run on dist-test. Screenshots: pc_info_<n>_<name>.png (1920x1080, Spanish); other sizes / English get a prefix.
//   HEADS_LANG=en  → English        HEADS_VP=1280x720,2560x1080  → only the layout checks (1-2) at those sizes
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
const LANG=process.env.HEADS_LANG||'es';
const VPS=(process.env.HEADS_VP||'1920x1080').split(',').map(v=>v.split('x').map(Number));
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const [w,h] of VPS){
 const full=w===1920&&h===1080,pre=(full&&LANG==='es')?'pc_info_':'pc_info_'+w+'x'+h+'_'+LANG+'_';
 console.log('=====',w+'x'+h,LANG);
 const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort()); // no internet here: do not wait for the web font
 await p.addInitScript(l=>{window.__noTip=0;window.__noTut=0;if(l==='en')window.__lang='en';},LANG);
 await p.goto(BASE+'/test.html?q=3');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
 await p.evaluate(()=>document.getElementById('play').click());
 const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 const snap=async name=>{await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(300);
   await p.screenshot({path:shot(pre+name),timeout:180000});await p.evaluate(()=>{window.__manual=0;});};
 const info=()=>p.evaluate(()=>{const vis=el=>el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).opacity!=='0';
   const box=id=>{const el=document.getElementById(id);if(!vis(el))return null;const q=el.getBoundingClientRect();return [q.left,q.top,q.right,q.bottom].map(Math.round);};
   const bx={};for(const id of ['hTop','hVit','hScore','pcKeys','tut','boss','sub','hTk']){const q=box(id);if(q)bx[id]=q;}
   const ov=[],ks=Object.keys(bx);for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const A=bx[ks[i]],B=bx[ks[j]];if(A[0]<B[2]&&B[0]<A[2]&&A[1]<B[3]&&B[1]<A[3])ov.push(ks[i]+'×'+ks[j]);}
   const r=el=>{const q=el.getBoundingClientRect();return [q.left,q.top,q.width,q.height].map(Math.round).join(',');};
   return {brk:[...document.querySelectorAll('#bMk .mk')].filter(vis).map(m=>m.textContent.trim()+'@'+r(m)),
     keys:vis(document.getElementById('pcKeys'))?[...document.querySelectorAll('#pcKeys .pk')].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>e.innerText.replace(/\n+/g,' ')):'hidden',
     lit:[...document.querySelectorAll('#pcKeys .pk.lit')].map(r=>r.dataset.k),boxes:bx,overlaps:ov,playT:+__T.playT.toFixed(1)};});
 // 1) right at the start: the key hints and the tutorial line
 await step(1.5);console.log('start',JSON.stringify(await info()));await snap('1_inicio.png');
 // 2) two breaches and some trichomes floating, a few in the tank (not counted as vacuumed: c0 follows the injected value)
 await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);const P=__heads.P;P.carry=34;__T.PCK.c0=34;__T.PCK.n.suck=0;
   const ps=__T.PATCHES.slice().sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos));
   for(const pa of [ps[3],ps[ps.length-2]]){pa.hp=0;__T.leakFrom(pa,16);}__T.toSpawn=6;});
 await step(1.2);await p.evaluate(()=>{document.getElementById('msg').style.display='none';}); // hide "RONDA 1 SUPERADA" (only because the test kills every spider)
 console.log('breaches',JSON.stringify(await info()));await snap('2_agujeros.png');
 if(full){
 // 3) close to a leak: the floating trichomes, and the weld + vacuum hints light up
 await p.evaluate(()=>{const P=__heads.P,pa=__T.PATCHES.filter(q=>q.hp<=0).sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos))[0];
   P.carry=4;__T.PCK.c0=4;P.pos.copy(pa.pos).addScaledVector(pa.n,3);P.vel.set(0,0,0);__T.leakFrom(pa,20);});
 await step(0.6);console.log('near a leak',JSON.stringify(await info()));
 await p.evaluate(()=>{const P=__heads.P,pa=__T.PATCHES.filter(q=>q.hp<=0).sort((a,b)=>a.pos.distanceTo(P.pos)-b.pos.distanceTo(P.pos))[0],T=__THREE;
   const side=new T.Vector3().crossVectors(pa.n,new T.Vector3(0,0,1)).normalize();window.__shotCam={pos:pa.pos.clone().addScaledVector(pa.n,4.5).addScaledVector(side,4).toArray(),look:pa.pos.clone().addScaledVector(pa.n,1.8).toArray()};});
 await snap('3_particulas.png');await p.evaluate(()=>{window.__shotCam=null;});
 // 4) carrying a full tank away from the hold: "ve a dejar los tricomas" lit
 await p.evaluate(()=>{const P=__heads.P;P.carry=60;__T.PCK.c0=60;P.pos.set(0,22,30);P.vel.set(0,0,0);});await step(0.6);
 console.log('full tank',JSON.stringify(await info()));await snap('4_lleno.png');
 // 5) learning: dashes, vacuumed trichomes and repairs take their rows away (needs real time for the slide-out)
 for(let i=0;i<3;i++){await p.evaluate(()=>{__heads.P.dashCD=0;});await step(0.2);await p.evaluate(()=>{__heads.P.dashCD=1;});await step(0.2);}
 await p.waitForTimeout(700);await step(0.2);console.log('after 3 dashes',JSON.stringify(await info()),JSON.stringify(await p.evaluate(()=>__T.PCK.n)));
 await p.evaluate(()=>{__T.PCK.n.suck=20;});await step(0.2);await p.waitForTimeout(700);await step(0.2);
 console.log('after 20 vacuumed',JSON.stringify(await info()));await snap('5_aprendido.png');
 }
 console.log('errors',JSON.stringify(errs.slice(0,3)));await p.close();}
 await b.close();})();
