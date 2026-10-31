// Music (v73): menu song + game song, PC and phone. Run on dist-test:
//   npm run build:test && tools/run-test.sh dist-test tools/tests/music.cjs
// Nothing is audible (Chromium runs with --disable-audio-output); the test reads the real state of the audio graph:
//   menu   (public/menusfx.js, window.menuMusic): silent until the first gesture · loops after it · fades out and frees the context at JUGAR
//   game   (19-audio.js, MUSIC): an <audio> routed through the game's AC into musicGain · starts at 0 with the round · ducks under a voice ·
//          M / the phone pause menu fade it · it pauses with the phone pause · fades out and pauses at the end · starts again from 0 at REINTENTAR
// Gains are read from the AudioParam (it follows the automation while the context runs). If the element's clock did not advance in this headless
// Chromium the test says so and falls back to the element's state (paused / readyState); the 'currentTime advances' lines show which case it is.
const {chromium}=require('playwright');
const {BASE,ARGS}=require('./lib.cjs');
let bad=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)bad++;};
const SPY=()=>{window.__starts=[];const s0=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...a){try{const b=this.buffer;if(b&&b.length>1)window.__starts.push({dur:+b.duration.toFixed(1),loop:this.loop});}catch(e){}return s0.apply(this,a);};};
const SPY2=()=>{window.__fx=[];const st=AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime=function(v,t,tc){try{window.__fx.push({k:'target',v,tc,t:Math.round(performance.now())});}catch(e){}return st.apply(this,arguments);};
  const s1=AudioScheduledSourceNode.prototype.stop;
  AudioScheduledSourceNode.prototype.stop=function(w){try{window.__fx.push({k:'stop',in:(w||0)-this.context.currentTime,t:Math.round(performance.now())});}catch(e){}return s1.apply(this,arguments);};};
const SPY3=()=>{window.__pauses=[];const pa=HTMLMediaElement.prototype.pause; // when the music element is paused, what were its level and its target? (the page may be slow, so this does not depend on wall-clock waits)
  HTMLMediaElement.prototype.pause=function(){try{const m=window.__MUS&&__MUS();window.__pauses.push({tgt:m?+m.M.tgt.toFixed(4):-1,gain:m?+m.g.gain.value.toFixed(4):-1});}catch(e){}return pa.apply(this,arguments);};};
const newPage=async(b,opts)=>{const ctx=await b.newContext(opts);const p=await ctx.newPage();p.errs=[];
  p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/audio|music|menusfx/i.test(m.text()))p.errs.push(m.text());});
  p.on('response',r=>{if(r.status()>=400&&/music/.test(r.url()))p.errs.push(r.status()+' '+r.url());});
  await p.addInitScript(SPY);await p.addInitScript(SPY2);await p.addInitScript(SPY3);await p.addInitScript(()=>{window.__lang='es';});await p.goto(BASE+'/test.html');return p;};
const MU=p=>p.evaluate(()=>menuMusic.info());
const G=p=>p.evaluate(()=>{const m=__MUS(),e=m.M.el;return {gain:+m.g.gain.value.toFixed(4),tgt:+m.M.tgt.toFixed(4),live:m.M.live,ending:m.M.ending,asleep:m.M.asleep,held:m.M.held,paused:e?e.paused:null,t:e?+e.currentTime.toFixed(2):-1,
  rs:e?e.readyState:-1,err:m.M.err,loop:e?e.loop:null,ac:__AC()?__AC().state:'none',on:m.on,vol:m.M.vol,duckTo:m.M.duckTo};});
// poll a condition on the page (calling the music tick by hand too, so a slow software-GPU frame rate does not matter)
const until=(p,fn,arg,ms=15000)=>p.waitForFunction(([f,a])=>{try{__MUS().tick();}catch(e){}return (new Function('a','return ('+f+')(a)'))(a);},[fn.toString(),arg],{timeout:ms,polling:100}).then(()=>true,()=>false);

async function menuPhase(p,tag,gesture){
  console.log(tag+') menu music');
  ok(await p.evaluate(()=>typeof menuMusic==='function'),'window.menuMusic exists');
  ok(await p.waitForFunction(()=>menuMusic.info().loaded,null,{timeout:60000}).then(()=>true,()=>false),'menu.mp3 fetched and decoded');
  await p.waitForTimeout(1500);
  let m=await MU(p);console.log('   before any gesture',JSON.stringify(m));
  ok(!m.playing&&m.state==='none','silent before the first gesture (no AudioContext, not playing)');
  ok((await p.evaluate(()=>window.__starts)).length===0,'no source started before the gesture');
  await gesture();
  ok(await p.waitForFunction(()=>menuMusic.info().playing,null,{timeout:10000}).then(()=>true,()=>false),'plays after the first gesture');
  await p.waitForTimeout(2300);m=await MU(p);console.log('   2.3 s after',JSON.stringify(m));
  ok(m.state==='running','context running');
  ok(m.gain>0.8*m.vol&&m.gain<=m.vol+0.002,'faded in to its level ('+m.gain+' of '+m.vol+')');
  ok(m.vol>0&&m.vol<=0.2,'menu level is low ('+m.vol+')');
  const st=await p.evaluate(()=>window.__starts.filter(s=>s.dur>20));console.log('   long sources',JSON.stringify(st));
  ok(st.length===1&&st[0].loop===true,'one ~60 s source, looping');
  ok(await p.evaluate(()=>menuMusic()),'menuMusic() says it is playing');
  // menuMusic(false) / (true): fades out, then comes back (no second source while one plays)
  await p.evaluate(()=>menuMusic(false));await p.waitForTimeout(1300);m=await MU(p);
  ok(!m.playing&&m.gain<0.004,'menuMusic(false) fades it out ('+m.gain+')');
  await p.evaluate(()=>menuMusic(true));await p.waitForTimeout(2300);m=await MU(p);
  ok(m.playing&&m.gain>0.8*m.vol,'menuMusic(true) brings it back ('+m.gain+')');
}
async function jugar(p,click){
  await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{window.__fx.length=0;});
  await click();
  await p.evaluate(()=>{window.__noRender=1;}); // the game keeps ticking (that is where the music logic runs); only the heavy software-GPU drawing is skipped, as in the other tests
  await p.waitForTimeout(250);
  const m=await MU(p);console.log('   JUGAR +0.25 s',JSON.stringify(m));
  // what JUGAR scheduled (read from the automation calls, so a slow page at JUGAR cannot fool it): level to 0 with a ~0.18 s time constant (0.8 s), source stopped ~0.9 s ahead
  const fx=await p.evaluate(()=>window.__fx.slice());console.log('   JUGAR automation',JSON.stringify(fx.filter(f=>f.k==='stop'||f.v===0)));
  ok(fx.some(f=>f.k==='target'&&f.v===0&&f.tc>0.12&&f.tc<0.25),'JUGAR: the menu song level is taken to 0 with a ~0.8 s fade');
  ok(fx.some(f=>f.k==='stop'&&f.in>0.7&&f.in<1.1),'JUGAR: the song source is stopped after that fade (+0.9 s), not cut');
  await p.waitForTimeout(1400);
  const z=await MU(p);console.log('   JUGAR +1.6 s',JSON.stringify(z));
  ok(!z.playing&&!z.fading&&z.state==='closed'&&z.gain<0.003,'menu song gone, its context closed');
}
async function gamePhase(p,tag,{phone}){
  console.log(tag+') game music');
  ok(await p.waitForFunction(()=>window.__MUS&&__MUS().M.live,null,{timeout:60000}).then(()=>true,()=>false),'music started with the round');
  ok(await until(p,s=>!__MUS().M.el.paused&&__MUS().M.el.readyState>=2,null,30000),'element playing (not paused, data loaded)');
  await p.waitForTimeout(3500);
  // the phone opens with a voice line: the music rightly sits ducked under it. Wait until it is over and the level is back, then measure
  await until(p,()=>{const m=__MUS();return __AC().currentTime>m.VOQ.until+m.M.hang+1&&m.g.gain.value>0.9*m.M.vol;},null,60000);
  let s=await G(p);console.log('   playing',JSON.stringify(s));
  ok(s.loop===true&&!s.err,'element loops, no load error');
  ok(s.ac==='running','game audio context running');
  ok(Math.abs(s.gain-s.vol)<0.2*s.vol,'fade-in reached the game level ('+s.gain+' of '+s.vol+')');
  ok(s.vol<=0.3&&s.vol>=0.1,'game level is low ('+s.vol+')');
  const t0=s.t;await p.waitForTimeout(1500);s=await G(p);
  const adv=s.t>t0+0.5;console.log('   element clock',t0,'->',s.t,adv?'(advances)':'(does NOT advance in this headless Chromium: state-only checks)');
  ok(adv||(!s.paused&&s.rs>=2),'currentTime advances (or, if the headless clock is frozen, the element is playing with data)');
  ok(await p.evaluate(()=>__MUS().M.el.src.endsWith('assets/music/game.mp3')&&__MUS().M.el.preload!=='auto'),'streams assets/music/game.mp3, preload is not auto');

  // ---- ducking under a voice
  ok(await p.waitForFunction(()=>__VO().n>0,null,{timeout:120000}).then(()=>true,()=>false),'voices decoded');
  await p.waitForTimeout(500);
  const said=await p.evaluate(()=>{const m=__MUS();return m.say('int_01',4);});
  // v74: poll instead of fixed waits: under load (another Chromium on the machine) the fixed waits could outlast the voice line
  // the snapshot is taken at the moment the level is down (the line is short; a slow page could read the release instead)
  await until(p,()=>{const m=__MUS();m.tick();const g=m.g.gain.value;if(g<0.5*m.M.vol){window.__duckSnap={gain:+g.toFixed(4),tgt:+m.M.tgt.toFixed(4),vol:m.M.vol,duckTo:m.M.duckTo};return true;}return false;},null,4000);
  const d=Object.assign(await G(p),await p.evaluate(()=>window.__duckSnap||{}));console.log('   voice playing: say()->'+said,JSON.stringify(d));
  ok(said===true,'a voice line played');
  ok(d.gain<0.5*d.vol&&d.gain>0,'music ducked while the voice plays ('+d.gain+' vs '+d.vol+')');
  ok(Math.abs(d.tgt-d.vol*d.duckTo)<0.002,'duck target is '+d.duckTo+' x level ('+d.tgt+')');
  ok(await until(p,()=>{const m=__MUS();return m.g.gain.value>0.85*m.M.vol;},null,20000),'music comes back after the voice');

  // ---- M / pause menu toggle
  let before=await G(p);
  if(!phone){
    await p.evaluate(()=>{window.__pauses.length=0;});
    await p.keyboard.press('KeyM');await p.waitForTimeout(1500);await p.evaluate(()=>__MUS().tick());
    let o=await G(p);console.log('   M off',JSON.stringify(o));
    ok(!o.on&&o.gain<0.02,'M: music fades out ('+o.gain+')');
    await p.waitForTimeout(1500);await p.evaluate(()=>__MUS().tick());o=await G(p);
    ok(o.paused&&o.asleep,'M off: the element rests (paused) after the fade');
    const pz=await p.evaluate(()=>window.__pauses.slice());console.log('   pause() calls since M off',JSON.stringify(pz));
    ok(pz.length>=1&&pz[0].tgt===0&&pz[0].gain<0.01,'M off: the element is paused only after the level reached 0 (no cut): target '+(pz[0]&&pz[0].tgt)+', level '+(pz[0]&&pz[0].gain));
    const tOff=o.t;await p.keyboard.press('KeyM');
    ok(await until(p,()=>{const m=__MUS();return !m.M.el.paused&&m.g.gain.value>0.8*m.M.vol;},null,15000),'M on: plays again and fades in');
    o=await G(p);console.log('   M on',JSON.stringify(o));
    ok(o.t>=tOff-0.3,'M on: continues where it was ('+tOff+' -> '+o.t+')');
  }
  else{
    const pauseBtn=await p.evaluate(()=>document.querySelector('.hudm')?'#hud-pause':'#tPause');
    const t1=(await G(p)).t;
    await p.tap(pauseBtn);await p.waitForTimeout(900);
    let o=await G(p);console.log('   paused',JSON.stringify(o));
    ok(o.held&&o.paused,'phone pause: the element is paused');
    ok(o.ac==='suspended','phone pause: audio context suspended');
    const tp=o.t;await p.waitForTimeout(1200);o=await G(p);
    ok(Math.abs(o.t-tp)<0.1,'phone pause: it does not run on silently ('+tp+' -> '+o.t+')');
    // switch music off inside the pause menu: the level drops at once (the context is suspended, so nothing would fade)
    await p.tap('#tPauseM [data-a=mus]');await p.waitForTimeout(300);o=await G(p);
    ok(!o.on&&o.gain===0,'pause menu MUSICA OFF: level 0 at once ('+o.gain+')');
    await p.tap('#tPauseM [data-a=mus]');await p.waitForTimeout(300);o=await G(p);
    ok(o.on&&o.gain>0.8*o.vol,'pause menu MUSICA ON: level back ('+o.gain+')');
    await p.tap('#tPauseM [data-a=go]');
    ok(await until(p,()=>{const m=__MUS();return !m.M.el.paused&&m.g.gain.value>0.5*m.M.vol&&__AC().state==='running';},null,15000),'CONTINUAR: resumes');
    o=await G(p);console.log('   continued',JSON.stringify(o));
    ok(o.t>=tp-0.3,'CONTINUAR: resumes where it was ('+tp+' -> '+o.t+')');
    // M off from the pause menu, then CONTINUAR: stays silent, the element rests
    await p.tap(pauseBtn);await p.waitForTimeout(700);await p.tap('#tPauseM [data-a=mus]');await p.tap('#tPauseM [data-a=go]');
    await p.waitForTimeout(2500);await p.evaluate(()=>__MUS().tick());o=await G(p);
    ok(!o.on&&o.gain<0.01,'music off + CONTINUAR: stays silent ('+o.gain+')');
    await p.waitForTimeout(1500);await p.evaluate(()=>__MUS().tick());o=await G(p);ok(o.paused,'music off: the element rests');
    await p.tap(pauseBtn);await p.waitForTimeout(700);await p.tap('#tPauseM [data-a=mus]');await p.tap('#tPauseM [data-a=go]');
    ok(await until(p,()=>{const m=__MUS();return !m.M.el.paused&&m.g.gain.value>0.8*m.M.vol;},null,15000),'music on again');
  }

  // ---- end of the game: fades out ~2 s, then pauses
  await p.evaluate(()=>{window.__noSpawn=1;});
  await p.evaluate(()=>{__MUS().endGame(false,'dead');});
  await p.waitForTimeout(1000);await p.evaluate(()=>__MUS().tick());let e=await G(p);console.log('   end +1 s',JSON.stringify(e));
  ok(e.ending&&e.gain<e.vol*0.9&&e.gain>0,'game over: fading out ('+e.gain+')');
  ok(await until(p,()=>{const m=__MUS();return m.M.el.paused&&!m.M.live;},null,15000),'game over: stopped (paused, not live) after the fade');
  e=await G(p);console.log('   end done',JSON.stringify(e));
  ok(e.gain<0.01,'  and silent ('+e.gain+')');

  // ---- REINTENTAR: starts again from the beginning
  const tEnd=e.t;
  if(phone)await p.tap('#again');else await p.click('#again');
  ok(await until(p,()=>{const m=__MUS();return m.M.live&&!m.M.el.paused&&m.g.gain.value>0.3*m.M.vol;},null,20000),'REINTENTAR: music starts again');
  e=await G(p);console.log('   retry',JSON.stringify(e));
  ok(e.t<Math.max(6,tEnd-1),'REINTENTAR: from the beginning ('+tEnd+' -> '+e.t+')');
}

(async()=>{
 const b=await chromium.launch({args:ARGS});
 // ================= PC =================
 console.log('=== PC');
 let p=await newPage(b,{viewport:{width:1280,height:720}});
 await menuPhase(p,'1',()=>p.mouse.click(30,30));
 await jugar(p,async()=>{const r=await p.evaluate(()=>{const g=document.getElementById('menuGo').getBoundingClientRect();return [g.left+g.width/2,g.top+g.height/2];});await p.mouse.click(r[0],r[1]);});
 await gamePhase(p,'2',{phone:false});
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs.slice(0,3)));await p.context().close();
 // ================= PHONE =================
 console.log('=== phone 844x390');
 p=await newPage(b,{viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go'),null,{timeout:300000}).catch(()=>{});
 await menuPhase(p,'3',()=>p.touchscreen.tap(8,8));
 await jugar(p,()=>p.tap('#mmGo'));
 await gamePhase(p,'4',{phone:true});
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs.slice(0,3)));await p.context().close();
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
