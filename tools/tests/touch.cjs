// Phone (844x390): stick + aim drag + fire with three fingers, and the slow-down while welding. Run on dist-test.
// Since v60 the phone start menu replaces the text menu: the tests tap its JUGAR (#mmGo).
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'/test.html');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:240000});
 console.log('keys',await p.evaluate(()=>[...document.querySelectorAll('#keysTouch kbd')].map(k=>k.textContent).join(' | ')));
 await p.tap('#mmGo');await p.evaluate(()=>{window.__noRender=1;__step(40);for(const s of [...__heads.spiders])__heads.killSpider(s);window.__noSpawn=1;});
 console.log('layout',JSON.stringify(await p.evaluate(()=>{const r=document.getElementById('tFire').getBoundingClientRect();return {fire:[Math.round(r.left),Math.round(r.top),Math.round(r.width)],look:!!document.getElementById('tLook')};})));
 const cdp=await ctx.newCDPSession(p);const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id}))});
 // stick + drag-look + fire with three fingers
 let y0=await p.evaluate(()=>__heads.P.yaw);
 await touch('touchStart',[[150,300,1]]);await touch('touchMove',[[150,250,1]]);
 await touch('touchStart',[[150,250,1],[560,140,2]]);for(let i=1;i<=4;i++)await touch('touchMove',[[150,250,1],[560+i*10,140,2]]);
 await touch('touchStart',[[150,250,1],[600,140,2],[795,320,3]]);await p.waitForTimeout(300);
 console.log('3 fingers',JSON.stringify(await p.evaluate(()=>({stick:[+__st.x.toFixed(2),+__st.y.toFixed(2)],fire:__heads.inp.fire}))),'yaw',(await p.evaluate(()=>__heads.P.yaw)-y0).toFixed(3));
 await touch('touchEnd',[]);await p.waitForTimeout(200);
 // slow down while welding: full sideways stick, steady top speed near a breach (welding) vs. in open space
 const w=await p.evaluate(()=>{const P=__heads.P;__heads.inp.fire=false;const pa=__T.PATCHES[4];pa.hp=5;
   const face=()=>{const d=pa.pos.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));};
   const run=(near)=>{P.vel.set(0,0,0);for(let i=0;i<40;i++){if(near){pa.hp=2;pa.prog=0;P.pos.copy(pa.pos).addScaledVector(pa.n,2.0);}else P.pos.set(0,30,40);face();__st.x=1;__st.y=0;__step(1);}return +P.vel.length().toFixed(2);};
   const a=run(false),wNear=run(true),slow=__TC.wSlow;__st.x=0;return {open:a,welding:wNear,wSlow:slow,expectedCap:+(__CFG.maxSpeed*0.55).toFixed(2)};});
 console.log('weld slow',JSON.stringify(w));
 console.log('errors',JSON.stringify(errs.slice(0,3)));await b.close();})();
