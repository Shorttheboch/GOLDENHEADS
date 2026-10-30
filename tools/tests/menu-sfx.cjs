// Start-menu machinery sounds (v70, public/menusfx.js + startMenuIntro in public/i18n.js). Run on dist (the real build:
// the test build skips the language picker, and the picker click is the gesture that lets sound start):
//   npm run build && tools/run-test.sh dist tools/tests/menu-sfx.cjs
// PC viewport. Nothing is audible (Chromium runs with --disable-audio-output); the test records which cues fired and when.
//  1) the language picker click is the user gesture: the six cues must play on the CSS timeline, buffers decoded, no errors
//  2) closing the menu (JUGAR) stops the player and closes its context
//  3) without any gesture (picker skipped) the cues are skipped, never queued
//  4) reduced motion: no machinery cues
const {chromium}=require('playwright');
const path=require('path');
const {BASE,ARGS,ROOT}=require('./lib.cjs');
let bad=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)bad++;};
// count what really reaches the audio graph (and that the decoded buffers are not silent)
const SPY=()=>{window.__starts=[];const pk=new WeakMap();const s0=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...a){try{const b=this.buffer;if(b&&b.length>1){if(!pk.has(b)){let m=0;const d=b.getChannelData(0);for(let i=0;i<d.length;i++)m=Math.max(m,Math.abs(d[i]));pk.set(b,m);}
    window.__starts.push({dur:+b.duration.toFixed(2),peak:+pk.get(b).toFixed(2),rate:this.playbackRate.value});}}catch(e){}return s0.apply(this,a);};};
const newPage=async(b,opts,init)=>{const ctx=await b.newContext({viewport:{width:1280,height:720},...opts});const p=await ctx.newPage();p.errs=[];
  await p.route('**/assets/models/ship.glb',r=>r.fulfill({path:path.join(ROOT,'tools/test-assets/ship_test.glb'),contentType:'model/gltf-binary'})); // the software GPU can't take the 4K textures
  p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/audio|menusfx|sfx/i.test(m.text()))p.errs.push(m.text());});
  await p.addInitScript(SPY);if(init)await p.addInitScript(init);await p.goto(BASE+'/index.html');return p;};
const rel=log=>{const t0=log.length?log[0].t:0;return log.map(c=>c.n+(c.ok?'':'(skipped:'+c.why+')')+' +'+(c.t-t0)+'ms').join(', ');};
(async()=>{
 const b=await chromium.launch({args:ARGS});
 // ---- 1) gesture from the language picker
 console.log('1) PC intro after the language click');
 let p=await newPage(b);
 await p.waitForSelector('#langPick:not([hidden])',{timeout:120000});
 ok(await p.evaluate(()=>typeof window.menuSfx==='function'),'window.menuSfx exists');
 await p.waitForFunction(()=>menuSfx.info().buffers===6,null,{timeout:20000}).catch(()=>{});
 let info=await p.evaluate(()=>menuSfx.info());console.log('  before click',JSON.stringify(info));
 ok(info.buffers===6,'6 files fetched and decoded before any gesture ('+info.buffers+')');
 ok(info.state==='none','no AudioContext before the first gesture ('+info.state+')');
 ok(await p.evaluate(()=>menuSfx('land'))===0,'a cue before the gesture is skipped');
 await p.evaluate(()=>{menuSfx.log.length=0;});
 await p.click('#langPick button[data-l=es]');
 await p.waitForFunction(()=>menuSfx.log.length>=6,null,{timeout:60000}).catch(()=>{});
 await p.waitForTimeout(500);
 let log=await p.evaluate(()=>menuSfx.log.slice());info=await p.evaluate(()=>menuSfx.info());
 console.log('  cues:',rel(log));console.log('  info',JSON.stringify(info));
 const first=log.filter(c=>c.n!=='button');
 ok(first.map(c=>c.n).join()==='land,logo,bar,unfold,land,lock','cue order land,logo,bar,unfold,land,lock ('+first.map(c=>c.n).join()+')');
 ok(first.every(c=>c.ok),'every cue played (state '+info.state+')');
 const want={logo:290,bar:610,unfold:970,lock:1510};const t0=first[0]?first[0].t:0;
 for(const c of first.slice(1))if(want[c.n]&&c.n!=='land')ok(Math.abs(c.t-t0-want[c.n])<160,c.n+' at +'+(c.t-t0)+' ms (expected about '+want[c.n]+')');
 ok(first[4]&&Math.abs(first[4].t-t0-1380)<160,'second land at +'+(first[4]&&first[4].t-t0)+' ms (expected about 1380)');
 ok(info.state==='running','context running ('+info.state+')');
 const st=await p.evaluate(()=>window.__starts);console.log('  sources started:',JSON.stringify(st));
 ok(st.length>=6&&st.every(s=>s.peak>0.1),'6 sources started with non-silent buffers');
 ok(st.some(s=>s.rate===1.5),'bar played at rate 1.5');
 // ---- 2) JUGAR: the menu hides, the player closes its context
 await p.evaluate(()=>{document.getElementById('menu').hidden=true;});await p.waitForTimeout(300);
 info=await p.evaluate(()=>menuSfx.info());console.log('  after the menu hides',JSON.stringify(info));
 ok(info.dead&&info.state==='none','2) stopped and closed when the menu hides');
 ok(await p.evaluate(()=>menuSfx('lock'))===0,'   no sound after that');
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs.slice(0,3)));await p.context().close();
 // ---- 3) no gesture at all (picker skipped): everything skipped, nothing queued
 console.log('3) no user gesture');
 p=await newPage(b,{},()=>{window.__lang='es';});
 await p.waitForFunction(()=>menuSfx.log.length>=6,null,{timeout:60000}).catch(()=>{});await p.waitForTimeout(500);
 log=await p.evaluate(()=>menuSfx.log.slice());console.log('  cues:',rel(log));
 ok(log.length>=6&&log.every(c=>!c.ok),'all cues skipped without a gesture');
 await p.mouse.click(40,40);await p.waitForTimeout(600);
 ok((await p.evaluate(()=>window.__starts)).length===0,'nothing played late after the click');
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs.slice(0,3)));await p.context().close();
 // ---- 4) reduced motion
 console.log('4) prefers-reduced-motion');
 p=await newPage(b,{reducedMotion:'reduce'});
 await p.waitForSelector('#langPick:not([hidden])',{timeout:120000});await p.click('#langPick button[data-l=es]');
 await p.waitForFunction(()=>document.getElementById('menuArt').classList.contains('go'),null,{timeout:60000});await p.waitForTimeout(3500);
 log=await p.evaluate(()=>menuSfx.log.filter(c=>c.t>0).slice());console.log('  cues:',rel(log));
 ok(log.every(c=>c.n==='button'),'only the JUGAR chime (or nothing) with reduced motion');
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs.slice(0,3)));await p.context().close();
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
