// v99: shaders and textures are prepared while the menu is up (28-load.js), so the first frames after JUGAR do not stutter.
// Plays the start twice in a phone-sized page, once as now and once without the warm-up (window.__noWarm), and prints the longest frame in the first 2.5 s
// after JUGAR (with the start cinematic, without the film). Passes when the warm-up ran (textures sent) and the game started; the numbers are for reading (they depend on the machine).
const {chromium}=require('playwright');const {BASE,ARGS}=require('./lib.cjs');
let fails=0;const ok=(c,m,d)=>{console.log((c?'  ok   ':'  FAIL ')+m+(c||d===undefined?'':'  '+JSON.stringify(d)));if(!c)fails++;};
const GPU=process.env.HEADS_GPU_ARGS?JSON.parse(process.env.HEADS_GPU_ARGS):null;
(async()=>{const res={};
 // a new browser for every run (programs compiled by one run would help the next), and the order alternates
 for(const mode of ['cold','warm','cold2','warm2']){const b=await chromium.launch({args:GPU||ARGS});
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('ERR',e.message));
  await p.addInitScript(m=>{window.__lang='es';if(m.startsWith('cold'))window.__noWarm=1;window.__noCine=0;},mode); // (with the start cinematic, as a player sees it; the film stays off)
  await p.goto(BASE+'/test.html');
  await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});
  await p.waitForTimeout(6000); // menu idle (warm-up at 3.5 s)
  const warmed=await p.evaluate(()=>window.__warmed||0);
  await p.evaluate(()=>{window.__ft=[];let last=performance.now();const f=t=>{window.__ft.push(t-last);last=t;if(window.__ft.length<400)requestAnimationFrame(f);};requestAnimationFrame(f);});
  await p.tap('#mmGo');
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000}).catch(()=>{});
  await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>{const a=window.__ft.slice(2);const s=[...a].sort((x,y)=>y-x);return {n:a.length,max:Math.round(s[0]||0),top3:s.slice(0,3).map(Math.round),state:window.__T&&__T.state};});
  res[mode]={warmed,...r};console.log(mode,JSON.stringify(res[mode]));await ctx.close();await b.close();}
 ok(res.warm.warmed>0&&res.warm2.warmed>0,'the warm-up ran in the menu (textures sent: '+res.warm.warmed+')');
 ok(res.cold.warmed===0,'…and not with __noWarm');
 ok(res.warm.state==='play'&&res.warm2.state==='play','the game started');
 console.log('longest frame after JUGAR (ms): with warm-up',res.warm.max,res.warm2.max,'· without',res.cold.max,res.cold2.max);
 console.log(fails?'FAIL '+fails:'ALL OK');process.exit(fails?1:0);})();
