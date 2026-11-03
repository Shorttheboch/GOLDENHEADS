// Anonymous metrics (v81): the game side (src/game/39-metricas.js) and the question on the start menu. Run on dist-test:
//   npm run build:test && PORT=8794 tools/run-test.sh dist-test tools/tests/metrics.cjs
// The test build sends nothing (window.__noMetrics defaults to 1, tools/test-hooks.json); here the init script sets it to 0 and /api/m is answered by the test.
// What it checks (screenshots in tools/tests/out/metrics_*.png):
//   question  shown the first time on PC (960x540) and phone (844x390, 667x375, 932x430), Spanish and English; never over JUGAR, the ES/EN boxes,
//             PANTALLA COMPLETA or the logo; its buttons answer where they are drawn; NO / SÍ remembered (gone after a reload); hidden during play
//   payloads  visit (once per page load, at the first game: platform, OS, browser, language, screen, installed, load time, film watched / skipped / none,
//             consent), end (round, cause, time, score, kills, EXTRA POWER, eggs, bosses, repairs, quality and fps, time per round, phone tutorial),
//             quit (sendBeacon when the page is hidden mid-game, once), errors (batched with the next event, deduplicated, at most 5);
//             session id in every event, the player id only with SÍ (and the same after a reload), test:true and r0 with ?ronda=4; 3 requests for 2 games
//   off       nothing is sent and the question is not even in the page with __noMetrics on (the default of the test build)
//   no page errors (apart from the two the test throws on purpose)
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,700):''));if(!c)bad++;};
const HEX=/^[0-9a-f]{24}$/,MINE=/prueba v81/;
const TXT={es:{q:'¿Nos ayudas con estadísticas anónimas?',s:'Para mejorar el juego: rondas, dispositivo y país. Sin nombre ni cuenta.',y:'SÍ',n:'NO'},
  en:{q:'Will you help us with anonymous stats?',s:'To improve the game: rounds, device and country. No name, no account.',y:'YES',n:'NO'}};

async function open(b,{phone,w,h,lang='es',q='',init,metrics=true,ctx}={}){
  ctx=ctx||await b.newContext(phone?{viewport:{width:w||844,height:h||390},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:w||960,height:h||540}});
  const p=await ctx.newPage();p.errs=[];p.sent=[];
  p.on('pageerror',e=>{if(!MINE.test(e.message))p.errs.push(e.message);});
  p.on('crash',()=>{console.log('PAGE CRASHED (out of memory?)');process.exit(3);});
  // every request to /api/m: fetch (keepalive) or sendBeacon
  await p.route('**/api/m',r=>{const q=r.request();let body=null;try{body=JSON.parse(q.postData()||'null');}catch(_){}p.sent.push({type:q.resourceType(),ct:q.headers()['content-type']||'',e:body&&body.e||[]});r.fulfill({status:204});});
  await p.addInitScript(([l,m])=>{window.__lang=l;if(m)window.__noMetrics=0;window.__beacons=0;const sb=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator);
    if(sb)navigator.sendBeacon=(u,d)=>{if(/\/api\/m$/.test(u))window.__beacons++;return sb(u,d);};},[lang,metrics]);
  if(init)await p.addInitScript(init);
  await p.goto(BASE+'/test.html'+q);return p;}
const menuReady=async p=>{await p.waitForFunction(()=>document.getElementById('menu').classList.contains('mgo')&&!document.getElementById('play').disabled,null,{timeout:300000});
  await p.waitForTimeout(3800); // the question comes in 2.8 s after the menu intro
  await p.waitForFunction(()=>{const a=document.getElementById('mtAsk');return !a||a.hidden||+getComputedStyle(a).opacity>=0.999;},null,{timeout:30000}).catch(()=>{});};
const all=p=>p.sent.flatMap(r=>r.e);
const kinds=p=>all(p).map(e=>e.kind);
const waitSent=async(p,n,ms=8000)=>{for(let t=0;t<ms&&p.sent.length<n;t+=100)await p.waitForTimeout(100);};
const R=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{l:r.left,t:r.top,r:r.right,b:r.bottom}:null;},sel);
const over=(a,c)=>!!a&&!!c&&Math.min(a.r,c.r)-Math.max(a.l,c.l)>0.5&&Math.min(a.b,c.b)-Math.max(a.t,c.t)>0.5;
async function askLayout(p,tag,phone,lang){
  const A=await p.evaluate(()=>{const e=document.getElementById('mtAsk');if(!e)return null;const cs=getComputedStyle(e),r=e.getBoundingClientRect();
    const hit=b=>{const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,el=document.elementFromPoint(x,y);return !!el&&(el===b||b.contains(el));};
    return {shown:!e.hidden&&cs.visibility==='visible'&&+cs.opacity>0.99,box:{l:r.left,t:r.top,r:r.right,b:r.bottom},W:innerWidth,H:innerHeight,
      q:document.getElementById('mtAskQ').textContent.trim(),s:e.querySelector('.mtAskS').textContent.trim(),sShown:getComputedStyle(e.querySelector('.mtAskS')).display!=='none',
      btns:[...e.querySelectorAll('button')].map(b=>({t:b.textContent.trim(),hit:hit(b),h:b.getBoundingClientRect().height})),
      cut:[...e.querySelectorAll('p')].some(x=>getComputedStyle(x).display!=='none'&&x.scrollWidth>x.clientWidth+1)||[...e.querySelectorAll('button')].some(x=>{const q=document.createRange();q.selectNodeContents(x);return q.getBoundingClientRect().width>x.getBoundingClientRect().width;})};});
  ok(A&&A.shown,tag+' the question is shown',A);if(!A||!A.shown)return A;
  const T=TXT[lang];
  ok(A.q===T.q&&A.btns.map(b=>b.t).join('/')===T.y+'/'+T.n&&A.s===T.s,tag+' text in '+(lang==='es'?'Spanish':'English')+': «'+A.q+'» '+A.btns.map(b=>b.t).join(' / '),A);
  ok(A.box.l>=0&&A.box.t>=0&&A.box.r<=A.W&&A.box.b<=A.H,tag+' inside the screen '+JSON.stringify(Object.values(A.box).map(Math.round)));
  const go=await R(p,phone?'#mmGo':'#menuGo'),lt=await R(p,'#langTog'),inst=await R(p,'#instMenu'),logo=await R(p,phone?'#mmLogo':'#mLogoW');
  ok(go&&!over(A.box,go),tag+' not over JUGAR');ok(lt&&!over(A.box,lt),tag+' not over ES/EN');
  ok(phone?inst&&!over(A.box,inst):!inst,tag+(phone?' not over PANTALLA COMPLETA':' (no PANTALLA COMPLETA on PC)'));ok(logo&&!over(A.box,logo),tag+' not over the logo');
  ok(A.btns.every(b=>b.hit),tag+' both buttons answer where they are drawn');ok(!A.cut,tag+' no text cut');
  ok(await p.evaluate(s=>{const b=document.querySelector(s),r=b.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!e&&(e===b||b.contains(e));},phone?'#mmGo':'#menuGo'),tag+' JUGAR still answers where it is drawn');
  return A;}
const startGame=async(p,phone)=>{if(phone)await p.tap('#mmGo');else await p.click('#menuGo');
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});};
const endGame=(p,why='dead')=>p.evaluate(w=>__MUS().endGame(false,w),why);
const hide=p=>p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});

(async()=>{
  const b=await chromium.launch({args:ARGS});
  // ================= 1) PC, Spanish, first visit: NO; two games, errors, quit =================
  console.log('1) PC 960x540, Spanish: the question, NO, two games');
  let p=await open(b,{init:()=>{window.__noQA=0;}});
  await menuReady(p);
  await askLayout(p,'PC ES:',false,'es');
  await p.screenshot({path:shot('metrics_ask_pc_es.png')});
  ok(p.sent.length===0,'nothing sent while on the menu');
  ok(await p.evaluate(()=>localStorage.getItem('heads_stats')===null&&localStorage.getItem('heads_pid')===null),'nothing stored before an answer');
  await p.click('#mtAsk button[data-a=no]');await p.waitForTimeout(500);
  let st=await p.evaluate(()=>({hidden:document.getElementById('mtAsk').hidden,s:localStorage.getItem('heads_stats'),pid:localStorage.getItem('heads_pid'),state:__T.state}));
  ok(st.hidden&&st.s==='0'&&st.pid===null&&st.state==='menu','NO: the question goes, the answer is kept (heads_stats=0), no player id, the game did not start',st);
  await startGame(p,false);await p.evaluate(()=>{window.__noSpawn=1;});await waitSent(p,1);
  ok(p.sent.length===1&&p.sent[0].e.length===1,'JUGAR: one request',p.sent);
  const v=all(p)[0]||{};
  ok(v.kind==='visit'&&HEX.test(v.sid)&&v.ver==='v81'&&v.plat==='pc'&&v.lang==='es'&&!('pid' in v)&&!v.test,'visit: session id, v81, pc, es, no player id, not a test',v);
  ok(v.consent==='no'&&v.go===true&&v.ready===true&&v.load>0&&v.film==='none'&&/^pc-[sml]$/.test(v.scr)&&v.inst===false&&typeof v.os==='string'&&typeof v.br==='string','visit: consent, played, load time '+v.load+' ms, film none (test build), screen '+v.scr+', not installed, '+v.os+'/'+v.br,v);
  ok(p.sent[0].type==='fetch'&&/json/.test(p.sent[0].ct),'sent with fetch (keepalive), JSON',p.sent[0]);
  ok(await p.evaluate(()=>document.getElementById('menu').hidden),'the menu (and the question) are gone during play');
  // two errors on purpose, one twice; play ~4 s of real frames so the quality loop measures fps
  await p.evaluate(()=>{for(let i=0;i<2;i++)setTimeout(()=>{throw new Error('prueba v81 A');},0);Promise.reject(new Error('prueba v81 B'));});
  await p.waitForTimeout(4500);await p.evaluate(()=>__step(60)); // real frames for the quality loop (software GPU: very slow ones), then 3 s of game time
  ok(p.sent.length===1,'errors wait for the next event (no request of their own)');
  await p.evaluate(()=>{__T.score=1234;});await endGame(p,'ship');await waitSent(p,2);
  const r2=p.sent[1]||{e:[]},e=r2.e.find(x=>x.kind==='end')||{},errs=r2.e.filter(x=>x.kind==='error');
  ok(p.sent.length===2&&e.kind==='end','end of the game: one request',p.sent.length);
  ok(e.sid===v.sid&&e.game===1&&e.round===1&&e.cause==='ship'&&e.secs>=3&&e.score>=1234&&e.cargo>=1234&&typeof e.kills==='number'&&typeof e.acc==='number'&&e.xp===0&&e.eggs===0&&e.spit===0&&e.inc===0&&typeof e.rep==='number','end: same session, game 1, round 1, cause, time '+e.secs+' s, score, kills, accuracy, EXTRA POWER, eggs, bosses, repairs',e);
  ok(Array.isArray(e.rt)&&e.rt.length===1&&typeof e.q==='number'&&typeof e.qMax==='number','end: time per round '+JSON.stringify(e.rt)+', quality '+e.q+' (lowest '+e.qMax+')',e);
  ok(typeof e.fps==='number'&&e.fps>=0,'end: median fps '+e.fps+' (quality loop on; the software GPU makes it tiny)',e.fps);
  ok(!('tut' in e)&&!('pid' in e),'end on PC: no tutorial field, no player id');
  const eA=errs.find(x=>/prueba v81 A/.test(x.msg)),eB=errs.find(x=>/prueba v81 B/.test(x.msg));
  ok(errs.length===2&&eA&&eA.n===2&&eB&&/^\(promesa\)/.test(eB.msg)&&eA.sid===v.sid,'errors ride with the end event: deduplicated (the same one twice = n 2), the promise one marked',errs);
  ok(eA&&eA.msg.length<=200&&typeof eA.at==='string','error: message and place',eA);
  // second game, then the page is hidden mid-game: a quit beacon
  await p.evaluate(()=>document.getElementById('again').click());await p.waitForFunction(()=>__T.state==='play',null,{timeout:60000});await p.waitForTimeout(1500);
  ok(p.sent.length===2,'a second game sends no new visit');
  await hide(p);await p.waitForTimeout(800);await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await waitSent(p,3,4000);await p.waitForTimeout(800);
  const qt=all(p).find(x=>x.kind==='quit')||{};
  ok(qt.kind==='quit'&&qt.sid===v.sid&&qt.game===2&&qt.round===1&&typeof qt.secs==='number','page hidden mid-game: quit with game 2, round 1',qt);
  ok(await p.evaluate(()=>window.__beacons)===1&&(p.sent[2]||{}).type!=='fetch','the quit goes by sendBeacon',{beacons:await p.evaluate(()=>window.__beacons),type:(p.sent[2]||{}).type});
  ok(p.sent.length===3&&kinds(p).filter(k=>k==='quit').length===1,'hidden + pagehide = one quit; 3 requests for 2 games',kinds(p));
  ok(all(p).filter(x=>x.kind==='visit').length===1,'one visit per page load');
  ok(!p.errs.length,'no page errors',p.errs);
  // reload: NO is remembered
  await p.reload();await menuReady(p);
  ok(await p.evaluate(()=>{const e=document.getElementById('mtAsk');return !e||e.hidden;}),'after a reload the question does not come back');
  await p.context().close();

  // ================= 2) PC, English, SÍ, with the opening film =================
  console.log('2) PC 960x540, English: YES, the opening film skipped, player id kept');
  const FILM=require('path').join(require('./lib.cjs').OUT,'opening_test.webm');let film=false;
  try{require('child_process').execFileSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','testsrc=size=160x90:rate=10','-t','12','-c:v','libvpx','-b:v','60k','-an',FILM]);film=true;}catch(_){console.log('  (no ffmpeg: the film cannot play here, only its error path is checked)');}
  const ctx2=await b.newContext({viewport:{width:960,height:540}});
  if(film)await ctx2.route('**/opening_test.webm',r=>r.fulfill({status:200,contentType:'video/webm',body:require('fs').readFileSync(FILM)}));
  p=await open(b,{ctx:ctx2,lang:'en',init:film?()=>{window.__noOpening=0;window.__OPENING='opening_test.webm';}:()=>{window.__noOpening=0;}});
  await menuReady(p);await askLayout(p,'PC EN:',false,'en');
  await p.screenshot({path:shot('metrics_ask_pc_en.png')});
  await p.click('#mtAsk button[data-a=yes]');await p.waitForTimeout(500);
  st=await p.evaluate(()=>({s:localStorage.getItem('heads_stats'),pid:localStorage.getItem('heads_pid')}));
  ok(st.s==='1'&&HEX.test(st.pid||''),'YES: heads_stats=1 and a random anonymous player id',st);
  await p.click('#menuGo');await p.waitForFunction(()=>!document.getElementById('opening').hidden,null,{timeout:30000});await p.waitForTimeout(2500);
  if(film)ok(p.sent.length===0,'nothing yet while the film plays (the visit waits to know how the film went)',p.sent);
  await p.evaluate(()=>document.getElementById('opSkip').click());await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:60000});await p.evaluate(()=>{window.__noSpawn=1;});await waitSent(p,1);
  let vv=all(p)[0]||{};
  ok(vv.kind==='visit'&&vv.pid===st.pid&&vv.consent==='yes'&&vv.lang==='en','visit: the player id, consent yes, English',vv);
  if(film)ok(vv.film==='skipped'&&vv.filmS>=1&&vv.filmS<=10,'visit: film skipped at '+vv.filmS+' s',vv);else ok(vv.film==='error','visit: film error (it could not play)',vv);
  await endGame(p,'cargo');await waitSent(p,2);const ee=all(p).find(x=>x.kind==='end')||{};
  ok(ee.pid===st.pid&&ee.cause==='cargo','end: the same player id, cause cargo',ee);
  await p.reload();await menuReady(p);
  ok(await p.evaluate(()=>{const e=document.getElementById('mtAsk');return !e||e.hidden;}),'after a reload the question does not come back');
  p.sent.length=0;await startGame(p,false);await waitSent(p,1);vv=all(p)[0]||{};
  ok(vv.kind==='visit'&&vv.pid===st.pid&&vv.sid!==ee.sid,'next visit: the same player id, a new session id',{pid:vv.pid,sid:vv.sid});
  ok(!p.errs.length,'no page errors',p.errs);
  await p.context().close();

  // ================= 3) ?ronda=4: test games =================
  console.log('3) ?ronda=4: every event says test');
  p=await open(b,{q:'?ronda=4'});
  await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});await p.waitForTimeout(500);
  await p.evaluate(()=>document.getElementById('play').click());await p.waitForFunction(()=>__T.state==='play',null,{timeout:60000});await p.evaluate(()=>{window.__noSpawn=1;});
  await waitSent(p,1);await endGame(p);await waitSent(p,2);
  const tv=all(p).find(x=>x.kind==='visit')||{},te=all(p).find(x=>x.kind==='end')||{};
  ok(tv.test===true&&te.test===true,'visit and end carry test:true',{tv,te});
  ok(te.round===4&&te.r0===4&&tv.go===true,'end: round 4, started at round 4 (r0)',te);
  ok(!p.errs.length,'no page errors',p.errs);
  await p.context().close();

  // ================= 4) __noMetrics on (the test build default): nothing at all =================
  console.log('4) __noMetrics on: nothing sent, no question');
  p=await open(b,{metrics:false});
  await menuReady(p);
  ok(await p.evaluate(()=>window.__noMetrics===1&&!document.getElementById('mtAsk')),'the question is not in the page');
  await startGame(p,false);await p.evaluate(()=>{window.__noSpawn=1;setTimeout(()=>{throw new Error('prueba v81 C');},0);});await p.waitForTimeout(1500);
  await endGame(p);await p.waitForTimeout(500);await hide(p);await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await p.waitForTimeout(1500);
  ok(p.sent.length===0&&await p.evaluate(()=>window.__beacons)===0,'no request and no beacon',p.sent);
  ok(await p.evaluate(()=>localStorage.getItem('heads_stats')===null&&localStorage.getItem('heads_pid')===null),'nothing stored');
  ok(!p.errs.length,'no page errors',p.errs);
  await p.context().close();

  // ================= 5) phone =================
  console.log('5) phone: the question in the top strip, SÍ, the tutorial skipped');
  for(const [w,h,lang] of [[844,390,'es'],[844,390,'en'],[667,375,'es'],[932,430,'en']]){
    p=await open(b,{phone:true,w,h,lang});
    await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go')&&!document.getElementById('play').disabled,null,{timeout:300000});await p.waitForTimeout(4000);
    await p.waitForFunction(()=>{const b=document.getElementById('instMenu');return b.hidden||+getComputedStyle(b).opacity>=0.999;},null,{timeout:30000}).catch(()=>{});
    await p.waitForFunction(()=>{const a=document.getElementById('mtAsk');return a&&+getComputedStyle(a).opacity>=0.999;},null,{timeout:30000}).catch(()=>{});
    await askLayout(p,`phone ${w}x${h} ${lang.toUpperCase()}:`,true,lang);
    await p.screenshot({path:shot(`metrics_ask_phone_${w}x${h}_${lang}.png`)});
    ok(!p.errs.length,'no page errors',p.errs);
    if(w!==844||lang!=='es'){await p.context().close();continue;}
    // 844x390 ES: SÍ by touch, a game with the tutorial skipped at its first screen
    await p.tap('#mtAsk button[data-a=yes]');await p.waitForTimeout(500);
    st=await p.evaluate(()=>({hidden:document.getElementById('mtAsk').hidden,s:localStorage.getItem('heads_stats'),pid:localStorage.getItem('heads_pid'),state:__T.state}));
    ok(st.hidden&&st.s==='1'&&HEX.test(st.pid||'')&&st.state==='menu','SÍ by touch: kept, player id, the game did not start',st);
    const ctx=p.context();await p.close();
    p=await open(b,{ctx,phone:true,init:()=>{window.__noTut=0;}}); // a new page in the same phone (same storage): the question does not come back
    await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go')&&!document.getElementById('play').disabled,null,{timeout:300000});await p.waitForTimeout(3000);
    ok(await p.evaluate(()=>{const e=document.getElementById('mtAsk');return !e||e.hidden;}),'new page in the same phone: the question does not come back');
    await startGame(p,true);await waitSent(p,1);const pv=all(p)[0]||{};
    ok(pv.kind==='visit'&&pv.plat==='touch'&&pv.scr==='phone'&&pv.pid===st.pid&&pv.consent==='yes','visit: touch, phone screen, the player id',pv);
    await p.evaluate(()=>{window.__noSpawn=1;__step(10);for(const s of [...__heads.spiders])__heads.killSpider(s);__T.MTUT.played=4.9;__T.MTUT.dur=1e9;});
    await p.evaluate(()=>__step(16));await p.waitForTimeout(400);
    const tutOn=await p.evaluate(()=>__T.MTUT.on);ok(tutOn,'the phone tutorial opened');
    if(tutOn){await p.waitForTimeout(1200);const sk=await p.evaluate(()=>{const r=document.querySelector('#mTutL .mtSkip').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];});
      await p.touchscreen.tap(sk[0],sk[1]);await p.evaluate(()=>__step(2));}
    await endGame(p,'dead');await waitSent(p,2);const pe=all(p).find(x=>x.kind==='end')||{};
    ok(pe.tut==='skip'&&pe.tutStep===1&&pe.pid===st.pid&&pe.cause==='dead','end: tutorial skipped at screen 1, the player id',pe);
    ok(!p.errs.length,'no page errors',p.errs);
    await ctx.close();}
  await b.close();
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
