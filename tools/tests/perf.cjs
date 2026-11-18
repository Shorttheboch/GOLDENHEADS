// v93: how fast the game really runs. Not a pass/fail test: it prints numbers (and writes out/perf_<tag>.json) to compare versions and settings.
// Chrome runs with vsync and the frame limit off, so "fps" is what the machine can do, not the screen's 60.
//   HEADS_PERF=pc1080,pc1440,pc4k,phone   viewports (default all)      HEADS_PERF_R=1,7,14   rounds (default)
//   HEADS_PERF_SEC=8   seconds measured per case                       HEADS_PERF_SET=<js>   run in the page before measuring (try a setting)
//   HEADS_TAG          name of the json
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const {BASE,ARGS,OUT,lateReady}=require('./lib.cjs');
const VP={pc1080:{w:1920,h:1080,d:1},pc1440:{w:2560,h:1440,d:1},pc4k:{w:1920,h:1080,d:2},phone:{w:844,h:390,d:3,touch:1}};
const WHICH=(process.env.HEADS_PERF||'pc1080,pc1440,pc4k,phone').split(','),ROUNDS=(process.env.HEADS_PERF_R||'1,7,14').split(',').map(Number),SEC=+(process.env.HEADS_PERF_SEC||8);
const INIT=()=>{const raf=window.requestAnimationFrame.bind(window),F=window.__pf={on:0,dt:[],js:[],last:0,info:null};
  window.requestAnimationFrame=cb=>raf(ts=>{const a=performance.now();if(F.on){if(F.last)F.dt.push(a-F.last);F.last=a;}
    const r=window.__composer&&window.__composer.renderer;if(r&&F.on){r.info.autoReset=false;r.info.reset();}
    cb(ts);if(F.on){F.js.push(performance.now()-a);if(r)F.info={calls:r.info.render.calls,tris:r.info.render.triangles,pts:r.info.render.points,geo:r.info.memory.geometries,tex:r.info.memory.textures,prog:r.info.programs.length};}});};
const st=a=>{const s=a.slice().sort((x,y)=>x-y),q=p=>s[Math.min(s.length-1,Math.floor(s.length*p))]||0;return {n:s.length,mean:+(s.reduce((x,y)=>x+y,0)/Math.max(1,s.length)).toFixed(2),p50:+q(.5).toFixed(2),p95:+q(.95).toFixed(2),p99:+q(.99).toFixed(2),max:+(s[s.length-1]||0).toFixed(1)};};
(async()=>{
 const b=await chromium.launch({args:[...ARGS,'--disable-gpu-vsync','--disable-frame-rate-limit']});const res=[];
 for(const k of WHICH){const v=VP[k];for(const R of ROUNDS){
   const ctx=await b.newContext({viewport:{width:v.w,height:v.h},deviceScaleFactor:v.d,...(v.touch?{isMobile:true,hasTouch:true}:{})}),p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
   await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await p.addInitScript(INIT);
   await p.goto(BASE+'/test.html?ronda='+R);
   await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
   if(R>3)await lateReady(p);
   if(v.touch){await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go'),null,{timeout:120000});await p.waitForTimeout(2500);await p.tap('#mmGo');}
   else await p.evaluate(()=>document.getElementById('play').click());
   await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
   // stay alive and let the round fill up
   await p.evaluate(()=>{const P=__heads.P;setInterval(()=>{P.hp=100;P.inv=5;for(const z of __T.PATCHES)if(z.hp<30)z.hp=30;__T.cargo=Math.max(__T.cargo,500);},200);});
   if(process.env.HEADS_PERF_SET)await p.evaluate(process.env.HEADS_PERF_SET);
   await p.waitForTimeout(R>1?14000:5000);
   await p.evaluate(()=>{const F=__pf;F.dt.length=F.js.length=0;F.last=0;F.on=1;});await p.waitForTimeout(SEC*1000);
   const r=await p.evaluate(()=>{const F=__pf;F.on=0;const r=__composer.renderer,H=__heads;return {dt:F.dt,js:F.js,info:F.info,pr:r.getPixelRatio(),px:r.domElement.width*r.domElement.height,spiders:H.spiders.length,incs:H.INCS?H.INCS.length:0,wave:__T.wave,state:__T.state,gpu:(()=>{try{const g=r.getContext(),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'';}catch(_){return '';}})()};});
   const dt=st(r.dt),js=st(r.js),o={case:k+' r'+R,fps:+(1000/dt.mean).toFixed(1),frame:dt,js,info:r.info,mpx:+(r.px/1e6).toFixed(2),spiders:r.spiders,incs:r.incs,wave:r.wave,state:r.state,errs:errs.length};res.push(o);
   console.log(`${o.case.padEnd(12)} ${String(o.fps).padStart(6)} fps | frame ms mean ${dt.mean} p95 ${dt.p95} p99 ${dt.p99} max ${dt.max} | js ms mean ${js.mean} p95 ${js.p95} max ${js.max} | ${o.mpx} Mpx | calls ${r.info&&r.info.calls} tris ${r.info&&r.info.tris} tex ${r.info&&r.info.tex} geo ${r.info&&r.info.geo} prog ${r.info&&r.info.prog} | spiders ${r.spiders} incs ${r.incs} wave ${r.wave} ${r.state} | ${r.gpu.slice(0,60)}${errs.length?' ERR '+errs[0]:''}`);
   await ctx.close();}}
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'perf_'+(process.env.HEADS_TAG||'x')+'.json'),JSON.stringify(res));await b.close();})();
