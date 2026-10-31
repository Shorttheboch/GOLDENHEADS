// Start-menu machinery sounds (v70, public/menusfx.js + startMenuIntro in public/i18n.js). Run on dist (the real build:
// the test build skips the language picker, and the picker click is the gesture that lets sound start):
//   npm run build && tools/run-test.sh dist tools/tests/menu-sfx.cjs
// PC viewport. Nothing is audible (Chromium runs with --disable-audio-output); the test records which cues fired and when.
//  1) the language picker click is the user gesture: the seven cues must play on the CSS timeline, buffers decoded, no errors.
//     v73: unfold / lock / decode are Santi's recordings (metro.mp3, arma-juguete.mp3, decoder.mp3); decode fires once per menu build,
//     at the first header decoding, and is faded out (menuSfx.fade) when the headers finish, because the sound (1.5 s) is longer
//  2) closing the menu (JUGAR) stops the player and closes its context; the menu song (v73) fades out first and its context closes after that
//  3) without any gesture (picker skipped) the cues are skipped, never queued; the menu song starts on the first gesture, never before
//  4) reduced motion: no machinery cues (the menu song still plays: the music test, tools/tests/music.cjs, covers it in depth)
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
 await p.waitForFunction(()=>menuSfx.info().buffers===7,null,{timeout:20000}).catch(()=>{});
 let info=await p.evaluate(()=>menuSfx.info());console.log('  before click',JSON.stringify(info));
 ok(info.buffers===7,'7 files fetched and decoded before any gesture ('+info.buffers+')');
 ok(info.state==='none','no AudioContext before the first gesture ('+info.state+')');
 ok(await p.evaluate(()=>menuSfx('land'))===0,'a cue before the gesture is skipped');
 await p.evaluate(()=>{menuSfx.log.length=0;
   const f=menuSfx.fade;window.__fades=[];menuSfx.fade=function(n,s){const r=f.apply(this,arguments);window.__fades.push({n,s,r,t:Math.round(performance.now())});return r;};}); // spy on the decoder fade-out
 await p.click('#langPick button[data-l=es]');
 await p.waitForFunction(()=>menuSfx.log.length>=7,null,{timeout:60000}).catch(()=>{});
 await p.waitForFunction(()=>window.__fades.length>=1,null,{timeout:10000}).catch(()=>{});
 await p.waitForTimeout(500);
 let log=await p.evaluate(()=>menuSfx.log.slice());info=await p.evaluate(()=>menuSfx.info());
 console.log('  cues:',rel(log));console.log('  info',JSON.stringify(info));
 const first=log.filter(c=>c.n!=='button');
 ok(first.map(c=>c.n).join()==='land,logo,bar,unfold,land,lock,decode','cue order land,logo,bar,unfold,land,lock,decode ('+first.map(c=>c.n).join()+')');
 ok(first.every(c=>c.ok),'every cue played (state '+info.state+')');
 const want={logo:290,bar:610,unfold:970,lock:1550,decode:1550};const t0=first[0]?first[0].t:0;
 for(const c of first.slice(1))if(want[c.n]&&c.n!=='land')ok(Math.abs(c.t-t0-want[c.n])<160,c.n+' at +'+(c.t-t0)+' ms (expected about '+want[c.n]+')');
 ok(first[4]&&Math.abs(first[4].t-t0-1380)<160,'second land at +'+(first[4]&&first[4].t-t0)+' ms (expected about 1380)');
 ok(info.state==='running','context running ('+info.state+')');
 const st=(await p.evaluate(()=>window.__starts)).filter(s=>s.dur<10); // (the menu song, 60 s, is another source)
 console.log('  sources started:',JSON.stringify(st));
 ok(st.length>=7&&st.every(s=>s.peak>0.1),'7 sources started with non-silent buffers');
 ok(st.some(s=>s.rate===1.5),'bar played at rate 1.5');
 ok(st.some(s=>s.dur>1.4&&s.dur<1.6)&&st.some(s=>s.dur>0.65&&s.dur<0.72)&&st.some(s=>s.dur>0.28&&s.dur<0.36),'the recordings were played (decoded lengths, a little under the files\' because the mp3 padding is trimmed): decoder ~1.5 s, metro ~0.70 s, arma-juguete ~0.32 s');
 // decode: once per menu build, with the first header, and faded out when the headers finish decoding (about 1 s later; the sound lasts 1.5 s)
 const dec=log.filter(c=>c.n==='decode'),fd=await p.evaluate(()=>window.__fades);console.log('  decoder fade-outs:',JSON.stringify(fd));
 ok(dec.length===1&&dec[0].ok,'decode fired exactly once');
 ok(fd.length===1&&fd[0].n==='decode'&&fd[0].s>0&&fd[0].s<=0.2&&fd[0].r===true,'the decoder was faded out once, while still playing');
 ok(dec.length&&fd.length&&fd[0].t-dec[0].t>700&&fd[0].t-dec[0].t<1450,'  at the end of the header decoding (+'+(fd.length&&dec.length?fd[0].t-dec[0].t:'?')+' ms after it started; expected about 970)');
 // ---- 2) JUGAR: the menu hides, the player closes its context (the menu song fades out first: music.cjs checks that part)
 await p.evaluate(()=>{document.getElementById('menu').hidden=true;});await p.waitForTimeout(300);
 info=await p.evaluate(()=>menuSfx.info());console.log('  after the menu hides',JSON.stringify(info));
 ok(info.dead&&info.state==='none','2) stopped and closed when the menu hides');
 ok(await p.evaluate(()=>menuSfx('lock'))===0,'   no sound after that');
 ok(await p.evaluate(()=>menuSfx.fade('decode',0.1))===false,'   nothing left to fade');
 await p.waitForTimeout(1200);
 ok((await p.evaluate(()=>menuMusic.info())).state==='closed','   and the menu song\'s context closes once it has faded ('+JSON.stringify(await p.evaluate(()=>menuMusic.info()))+')');
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs.slice(0,3)));await p.context().close();
 // ---- 3) no gesture at all (picker skipped): everything skipped, nothing queued
 console.log('3) no user gesture');
 p=await newPage(b,{},()=>{window.__lang='es';});
 // wait for the whole intro, JUGAR's 'button' cue included (at 2.6 s): a click before it would rightly let it play on time
 await p.waitForFunction(()=>menuSfx.log.some(c=>c.n==='button'),null,{timeout:60000}).catch(()=>{});await p.waitForTimeout(500);
 log=await p.evaluate(()=>menuSfx.log.slice());console.log('  cues:',rel(log));
 ok(log.length>=8&&log.every(c=>!c.ok),'all cues skipped without a gesture ('+log.length+' cues)');
 ok(!(await p.evaluate(()=>menuMusic())),'  and the menu song is silent too');
 await p.mouse.click(40,40);await p.waitForTimeout(600);
 ok((await p.evaluate(()=>window.__starts)).filter(s=>s.dur<10).length===0,'nothing played late after the click');
 ok(await p.evaluate(()=>menuMusic()),'  but the menu song starts with that first gesture');
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
