// The end plate with the Season 1 ranking (v82): one centred column, a panel with two framed slides (the run's stats, the ranking) that swap as whole frames.
// Run on dist-test:
//   npm run build:test && PORT=8798 tools/run-test.sh dist-test tools/tests/cuentas-cartel.cjs
//   HEADS_ONLY=pc | phone | timing | nag   only that part · HEADS_SHOTS=all   screenshots of every state at every size (default: the main ones)
// No server: /api/* is answered by the test (a small fake of netlify/functions/ranking.mts with the board it is told to have).
// 1) layout, every size (PC 960x540, 1280x720, 1366x768, 1600x900, 1920x1080, 2560x1440 · phones 844x390, 667x375, 932x430), ES and EN,
//    a heavy game (ten stat lines), board states empty0 (score 0: «¡Sé el primero!», no button) · empty (TÚ #1) · short (TÚ #3) · full (TÚ #5) ·
//    low (not in the top 5) · down (/api/scores 503: v44, no tabs, no chevrons):
//    both slides (each in its own frame): the plate on screen and centred, the ranking frame exactly where and as big as the stats frame (nothing
//    jumps), nothing cut by its frame,
//    tabs and chevrons answering where they are drawn, REINTENTAR clear; the ranking slide: five lines (waiting / first / ghost as the state says),
//    every text inside, GUARDAR MI PUNTUACIÓN and VER RANKING COMPLETO answering; phones: list letters >= 8 px, the button >= 30 px tall;
//    ←/→ (PC) or a swipe (phone) go back and forth; VER RANKING COMPLETO opens the full list (and SEGUIR closes it)
// 2) the swap by itself: not before the stats table is in + 3.5 s, the gold line under RANKING filling meanwhile, then the ranking; the mouse over the
//    panel (PC) or a finger on it (phone) holds it; a manual swap cancels it for the plate; nothing at all without the ranking.
//    PC: the mouse resting on a tab swaps to it after ~140 ms (a 50 ms pass does nothing, the tab shown does nothing, during a swap it waits for it).
//    The swap itself: frame times during four swaps against the plate standing still; caught half way (animations paused): the stats frame on its
//    way out left, the ranking frame coming in, both half seen, the sideways SVG blur on PC / a light CSS blur on touch, the tabs and chevrons where
//    they were; at the end nothing left (no blur, no transform); reduced motion: a plain crossfade
//    (only the running animations are paused and resumed: play() on a finished one would start it again)
// 3) the reminder «¿GUARDAMOS TU PUNTUACIÓN?» (guests): REINTENTAR / Enter / R before the ranking was seen, with a run that makes the top 50 → shown,
//    with the score and «Entrarías en el puesto #N», REINTENTAR has the focus, Enter retries; only once a session; not after the ranking was seen;
//    not when the run would not make the top 50 and is no record; a new device record alone is enough («¡Es tu nuevo récord!»); Esc and Space retry
// Screenshots: tools/tests/out/cartel_<w>x<h>_<lang>_<state>_<stats|ranking>.png, cartel_full_*, cartel_timing_*, cartel_swap_1920x1080_es (half way), cartel_nag_*
const {chromium}=require('playwright');
const crypto=require('crypto');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,900):''));if(!c)bad++;};
const PC=[[960,540],[1280,720],[1366,768],[1600,900],[1920,1080],[2560,1440]],PHONE=[[844,390],[667,375],[932,430]];
const ONLY=process.env.HEADS_ONLY||'',ALL=process.env.HEADS_SHOTS==='all';
const SIX=[['ORION',15200,12],['LUNA',9800,9],['KRAKEN',7400,8],['NOVA_7',5100,6],['ZETA',2600,4],['ECO',900,2]];
const SIXTY=Array.from({length:60},(_,i)=>['CAPI'+(i+1),90000-i*1000,12]);
const STATES=[['empty0',[],0],['empty',[],3210],['short',SIX.slice(0,2),3000],['full',SIX,4321],['low',SIX,500],['down',null,3000]];
const MAIN=new Set(['1920x1080','844x390']);

function server(){const S={seed:[],down:false};
  S.handle=route=>{const rq=route.request(),u=new URL(rq.url()),p=u.pathname;const J=(s,j)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(j)});
    if(p==='/api/auth')return J(200,{url:'https://fake-ref.supabase.co',key:'sb_publishable_TEST'});
    if(p==='/api/run')return J(200,{token:`${Date.now()}.${crypto.randomBytes(8).toString('hex')}.sig`});
    if(p==='/api/scores'){if(S.down)return J(503,{error:'ranking no configurado'});const n=Math.min(50,+(u.searchParams.get('n')||10));
      const top=S.seed.map(([nick,score,round],i)=>({pos:i+1,nick,score,round,me:false}));return J(200,{season:1,count:top.length,top:top.slice(0,n)});}
    if(p==='/api/m')return route.fulfill({status:204});
    return J(401,{error:'session'});};
  return S;}
async function open(b,S,w,h,phone,lang,init){
  const ctx=await b.newContext(phone?{viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:w,height:h}});
  await ctx.route('**/api/**',S.handle);
  await ctx.addInitScript(l=>{window.__rankOn=1;window.__lang=l;},lang);if(init)await ctx.addInitScript(init);
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});
  await p.goto(BASE+'/test.html');await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});
  if(phone)await p.waitForFunction(()=>!document.getElementById('mmGo').disabled,null,{timeout:30000});
  await p.evaluate(ph=>document.getElementById(ph?'mmGo':'play').click(),phone);
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});await p.evaluate(()=>{window.__noSpawn=1;});return p;}
// end a game (from play): heavy stats, a score; resolves when the plate is up and the ranking answered (or not)
async function finish(p,score,down){
  if(await p.evaluate(()=>__T.state!=='play')){await p.click('#again',{force:true}).catch(()=>{});
    if(await p.evaluate(()=>!document.getElementById('acct').hidden))await p.click('#acGo');
    await p.waitForFunction(()=>__T.state==='play',null,{timeout:30000});await p.evaluate(()=>{window.__noSpawn=1;});}
  await p.waitForTimeout(500); // the run token
  const t=await p.evaluate(sc=>{const s=__heads.stats;Object.assign(s,{kills:57,heads:12,shots:300,hits:171,multi:3,saved:2400,perfect:2,spitters:2,incs:1,eggs:3,eggsKilled:2});
    __T.score=Math.round(sc*0.7);__T.pts=sc-Math.round(sc*0.7);__T.playT=700;__MUS().endGame(false,sc%2?'cargo':'dead');return performance.now();},score);
  await p.waitForFunction(()=>!document.getElementById('end').hidden,null,{timeout:30000});
  await p.waitForFunction(dn=>dn?document.getElementById('endTabs').hidden:!document.querySelector('#rankList li.load'),!!down,{timeout:20000}).catch(()=>{});
  return t;}
const slide=p=>p.evaluate(()=>document.getElementById('endTab1').getAttribute('aria-selected')==='true'?1:0);
const layout=(p,which)=>p.evaluate(which=>{const g=id=>document.getElementById(id),R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
  const over=(a,b)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;
  const W=innerWidth,H=innerHeight,inside=r=>r.l>=-1&&r.t>=-1&&r.r<=W+1&&r.b<=H+1;
  const rng=el=>{const q=document.createRange();q.selectNodeContents(el);return R(q);};
  const hit=el=>{if(!el||el.hidden||!el.getClientRects().length)return false;const q=el.getBoundingClientRect(),x=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return !!x&&(x===el||el.contains(x));};
  const box=g('endBox'),tabsOn=!g('endTabs').hidden,pan=R(g('endPanel')),ag=R(g('again')),scale=(()=>{const m=/scale\(([\d.]+)\)/.exec(box.style.transform||'');return m?+m[1]:1;})();
  const cur=which===1?g('rankBox'):g('endSlide0'),fr=R(cur),cs=getComputedStyle(cur),pd=k=>parseFloat(cs['padding'+k])*scale*.5; // the frame (the slide) and the inside of it
  const tr={l:fr.l+pd('Left'),r:fr.r-pd('Right'),t:fr.t+pd('Top'),b:fr.b-pd('Bottom')};
  const parts=which===1?[g('rankH'),...g('rankMsg').querySelectorAll('span'),...g('rankList').children,g('rankAll'),g('saveBtn'),g('acctBar')]:[...g('endStats').children];
  const vis=parts.filter(e=>e&&!e.hidden&&e.getClientRects().length);
  const out={W,H,scale,tabsOn,box:R(box),pan,fr,inside:inside(R(box))&&inside(ag)&&inside(pan),centre:Math.abs((R(box).l+R(box).r)/2-W/2),
    clipped:vis.filter(e=>{const r=R(e);return r.l<tr.l-1||r.r>tr.r+1||r.t<tr.t-1||r.b>tr.b+1;}).map(e=>e.id||e.tagName+':'+e.textContent.slice(0,16)),
    textOut:vis.filter(e=>{const r=rng(e),pr=R(e.closest('li')||e);return r.r>Math.max(pr.r,tr.r)+1||r.l<Math.min(pr.l,tr.l)-1;}).map(e=>e.id||e.textContent.slice(0,16)),
    againOver:over(ag,pan)||over(ag,R(g('record'))),againHit:hit(g('again')),panelOverRecord:over(pan,R(g('record'))),tabsOverRound:tabsOn&&over(R(g('endTabs')),R(g('endRound'))),tabsOverPanel:tabsOn&&over(R(g('endTabs')),pan),
    tabFont:parseFloat(getComputedStyle(g('endTabs')).fontSize)*scale,roundFont:parseFloat(getComputedStyle(g('endRound')).fontSize)*scale,
    chevIn:[g('endPrev'),g('endNext')].filter(e=>!e.hidden).every(e=>inside(R(e))&&hit(e)&&+getComputedStyle(e).opacity>0.9),chev:[!g('endPrev').hidden,!g('endNext').hidden],
    tabsHit:tabsOn?[hit(g('endTab0')),hit(g('endTab1'))]:null,curVis:getComputedStyle(cur).visibility==='visible'&&!cur.inert,
    other:(which===1?g('endSlide0'):g('rankBox')).inert};
  if(which!==1)return Object.assign(out,{statFont:parseFloat(getComputedStyle(g('endStats')).fontSize)*scale});
  const lis=[...g('rankList').children];
  return Object.assign(out,{h:[...g('rankH').children].map(e=>e.textContent),msg:[...g('rankMsg').querySelectorAll('span')].map(e=>e.textContent),
    rows:lis.filter(l=>!l.classList.contains('gap')).length,ph:lis.filter(l=>l.classList.contains('ph')).length,
    first:(lis[0]&&lis[0].classList.contains('first'))?lis[0].querySelector('span').textContent:null,
    ghost:lis.findIndex(l=>l.classList.contains('ghost'))+1,ghostT:(g('rankList').querySelector('.ghost span')||{}).textContent||null,names:lis.map(l=>(l.querySelector('span')||{}).textContent),
    save:!g('saveBtn').hidden,saveHit:hit(g('saveBtn')),saveH:R(g('saveBtn')).h,all:!g('rankAll').hidden,allHit:hit(g('rankAll')),
    font:lis[0]?parseFloat(getComputedStyle(lis[0]).fontSize)*scale:0,
    scoreCut:lis.some(l=>{const b=l.querySelector('b');if(!b)return false;const r=rng(b),lr=R(l);return r.r>lr.r+1;})});},which);
const swapTo=async(p,i,phone,how)=>{if(how==='key')await p.keyboard.press(i?'ArrowRight':'ArrowLeft');
  else if(how==='swipe'){const r=await p.evaluate(()=>{const e=document.getElementById('endPanel').getBoundingClientRect();return [e.left+e.width/2,e.top+e.height/2,e.width];});
    const cdp=await p.context().newCDPSession(p),x0=r[0]+(i?r[2]*0.25:-r[2]*0.25),x1=r[0]+(i?-r[2]*0.25:r[2]*0.25);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:r[1]}]});
    for(let k=1;k<=6;k++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*k/6,y:r[1]+k}]});await p.waitForTimeout(16);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else if(phone)await p.tap(i?'#endNext':'#endPrev');else await p.click(i?'#endNext':'#endPrev');
  await p.waitForTimeout(650);};

(async()=>{
  const b=await chromium.launch({args:ARGS});
  // ================= 1) layout =================
  if(!ONLY||ONLY==='pc'||ONLY==='phone'){
  const sizes=[...(ONLY==='phone'?[]:PC.map(s=>[...s,false])),...(ONLY==='pc'?[]:PHONE.map(s=>[...s,true]))];
  for(const [w,h,phone] of sizes)for(const lang of ['es','en']){
    const tag=`${w}x${h} ${lang}`,S=server();console.log(tag);
    const p=await open(b,S,w,h,phone,lang,()=>{sessionStorage.setItem('heads_save_nag','1');});
    for(const [st,seed,score] of STATES){
      S.seed=seed||[];S.down=seed===null;await finish(p,score,seed===null);await p.waitForTimeout(2600); // the plate's entrance and the score counting up
      const T=`${tag} ${st}:`,shots=ALL||MAIN.has(w+'x'+h)||st==='full'||st==='down';
      ok(await slide(p)===0,T+' it opens on the stats');
      const A=await layout(p,0);
      ok(A.inside&&A.centre<=Math.max(4,w*0.01),T+' stats: on screen and centred (scale '+A.scale.toFixed(2)+')',A);
      ok(!A.clipped.length&&!A.panelOverRecord&&!A.againOver&&A.againHit&&!A.tabsOverRound,T+' stats: nothing cut, nothing on top of anything, REINTENTAR answering',A);
      if(phone)ok(A.statFont>=7.5,T+' phone: stats letters '+A.statFont.toFixed(1)+' px');
      if(shots)await p.screenshot({path:shot(`cartel_${w}x${h}_${lang}_${st}_stats.png`),timeout:240000});
      if(st==='down'){ok(!A.tabsOn&&!A.chev[0]&&!A.chev[1],T+' ranking down: v44, no tabs, no chevrons',A);continue;}
      ok(A.tabFont>=A.roundFont*0.97&&!A.tabsOverPanel,T+' TU PARTIDA · RANKING at least as big as the RONDA line ('+A.tabFont.toFixed(1)+' / '+A.roundFont.toFixed(1)+' px), clear of the frame',A);
      ok(A.tabsOn&&A.tabsHit.every(Boolean)&&A.chev[1]&&!A.chev[0]&&A.chevIn&&A.curVis&&A.other,T+' tabs and the › chevron answering, the ranking slide asleep',A);
      await swapTo(p,1,phone,st==='full'?'click':phone?'swipe':'key');
      ok(await slide(p)===1,T+' → the ranking ('+(st==='full'?'chevron':phone?'swipe':'→')+')');
      const L=await layout(p,1);
      ok(['l','t','w','h'].every(k=>Math.abs(L.fr[k]-A.fr[k])<0.6&&Math.abs(L.pan[k]-A.pan[k])<0.6)&&Math.abs(L.box.h-A.box.h)<0.6,T+' the ranking frame has exactly the place and size of the stats frame (nothing else moves)',{a:A.fr,b:L.fr});
      ok(!L.clipped.length&&!L.textOut.length&&!L.scoreCut&&L.curVis&&L.other,T+' ranking: everything inside the frame, nothing cut',{c:L.clipped,t:L.textOut});
      ok(L.chev[0]&&!L.chev[1]&&L.chevIn,T+' the ‹ chevron to go back to the stats, seen and answering',L.chev);
      ok(L.rows===5,T+' five lines',L.names);
      const FIRST=lang==='es'?'¡Sé el primero!':'Be the first!',YOU=lang==='es'?'TÚ':'YOU';
      ok(JSON.stringify(L.h)===JSON.stringify(lang==='es'?['RANKING DE CAPITANES','TEMPORADA 1']:['CAPTAINS LEADERBOARD','SEASON 1']),T+' title and season',L.h);
      if(st==='empty0')ok(L.ph===5&&L.first===FIRST&&!L.save&&!L.all&&!L.ghost,T+' five waiting lines, «'+FIRST+'», no button',L);
      if(st==='empty')ok(L.ghost===1&&L.ph===4&&L.save&&/primero|first/.test(L.msg.join(' ')),T+' «'+YOU+'» at #1, the button',L);
      if(st==='short')ok(L.ghost===3&&L.ph===2&&L.names[0]==='ORION'&&L.save&&L.all,T+' two captains, «'+YOU+'» #3, two waiting',L.names);
      if(st==='full')ok(L.ghost===5&&L.ph===0&&L.names[3]==='NOVA_7'&&/#5/.test(L.msg.join(' ')),T+' «'+YOU+'» enters at #5',{n:L.names,m:L.msg});
      if(st==='low')ok(!L.ghost&&L.ph===0&&L.names.join()==='ORION,LUNA,KRAKEN,NOVA_7,ZETA'&&L.save,T+' not in the top 5: the five captains',L.names);
      if(L.save)ok(L.saveHit,T+' GUARDAR MI PUNTUACIÓN answers where it is drawn',L);
      if(L.all)ok(L.allHit,T+' VER RANKING COMPLETO answers where it is drawn',L);
      if(phone){if(L.save)ok(L.saveH>=30,T+' phone: the button is '+Math.round(L.saveH)+' px tall');ok(L.font>=8,T+' phone: list letters '+L.font.toFixed(1)+' px');}
      if(shots)await p.screenshot({path:shot(`cartel_${w}x${h}_${lang}_${st}_ranking.png`),timeout:240000});
      if(st==='full'){await p.click('#rankAll');await p.waitForFunction(()=>{const a=document.getElementById('acct');return !a.hidden&&a.dataset.s==='board';},null,{timeout:20000});await p.waitForTimeout(600);
        const F=await p.evaluate(()=>{const L=document.getElementById('acList'),b=document.getElementById('acBox').getBoundingClientRect(),r=L.getBoundingClientRect(),go=document.getElementById('acGo').getBoundingClientRect(),last=L.querySelector('li:last-child').getBoundingClientRect();
          return {rows:L.querySelectorAll('li:not(.gap)').length,big:L.classList.contains('big'),allSeen:last.bottom<=r.bottom+1,inside:b.top>=-1&&b.bottom<=innerHeight+1&&b.left>=-1&&b.right<=innerWidth+1,go:go.bottom<=innerHeight+1&&go.height>0,t:document.getElementById('acT').getAttribute('aria-label')};});
        ok(F.big&&F.rows===6&&F.allSeen&&F.inside&&F.go&&F.t===(lang==='es'?'RANKING DE CAPITANES':'CAPTAINS LEADERBOARD'),T+' VER RANKING COMPLETO: the framed list, on screen, SEGUIR reachable',F);
        if(ALL||MAIN.has(w+'x'+h)||lang==='es')await p.screenshot({path:shot(`cartel_full_${w}x${h}_${lang}.png`),timeout:240000});
        await p.click('#acGo');await p.waitForTimeout(300);ok(await p.evaluate(()=>document.getElementById('acct').hidden&&!document.getElementById('end').hidden),T+' SEGUIR: back to the end plate');}
      await swapTo(p,0,phone,st==='full'?'click':phone?'swipe':'key');
      ok(await slide(p)===0,T+' ← back to the stats ('+(st==='full'?'chevron':phone?'swipe':'←')+')');
    }
    ok(!p.errs.length,tag+': no page errors',p.errs);
    await p.context().close();}}

  // ================= 2) the swap by itself =================
  if(!ONLY||ONLY==='timing'){
  console.log('2) the swap by itself');
  for(const [w,h,phone,lang] of [[1920,1080,false,'es'],[844,390,true,'es'],[960,540,false,'en']]){
    const S=server();S.seed=SIX;const tag=`${w}x${h} ${lang}`;
    const p=await open(b,S,w,h,phone,lang,()=>{sessionStorage.setItem('heads_save_nag','1');});
    let t0=await finish(p,4321);
    // when the table is in: 1.45 s + 55 ms a row (10 rows) + 0.35 s
    const tIn=1450+9*55+350;
    const at=async ms=>{const now=await p.evaluate(()=>performance.now());if(t0+ms>now)await p.waitForTimeout(t0+ms-now);};
    await at(tIn+1750);let s1=await p.evaluate(()=>({i:document.getElementById('endTab1').getAttribute('aria-selected'),p:+getComputedStyle(document.querySelector('#endTab1 .prog i')).getPropertyValue('--p'),vis:!document.querySelector('#endTab1 .prog').hidden}));
    ok(s1.i==='false'&&s1.vis&&s1.p>0.35&&s1.p<0.65,tag+': half way (table in + 1.75 s): still the stats, the gold line about half full ('+s1.p.toFixed(2)+')',s1);
    await p.screenshot({path:shot(`cartel_timing_${w}x${h}_${lang}.png`),timeout:240000});
    await at(tIn+3100);ok(await slide(p)===0,tag+': table in + 3.1 s: still the stats');
    await at(tIn+4200);ok(await slide(p)===1,tag+': table in + 4.2 s: the ranking came by itself (3.5 s)');
    ok(await p.evaluate(()=>document.querySelector('#endTab1 .prog').hidden),tag+': the gold line goes away');
    // hold: the mouse over the panel / a finger on it
    t0=await finish(p,4321);
    if(phone){await at(tIn+1000);const c=await p.evaluate(()=>{const e=document.getElementById('endPanel').getBoundingClientRect();return [e.left+e.width/2,e.top+e.height/2];});
      const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c[0],y:c[1]}]});
      await at(tIn+6000);ok(await slide(p)===0,tag+': a finger on the panel holds the swap');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      await p.waitForTimeout(1500);ok(await slide(p)===0,tag+': ... and for a moment after it lifts');
      await p.waitForTimeout(4000);ok(await slide(p)===1,tag+': then the countdown goes on and the ranking comes');}
    else{await at(tIn+1000);await p.hover('#endStats');await at(tIn+6000);ok(await slide(p)===0,tag+': the mouse over the stats holds the swap');
      await p.mouse.move(5,5);await p.waitForTimeout(3100);ok(await slide(p)===1,tag+': the mouse leaves: the rest of the countdown, then the ranking');}
    // a manual swap cancels it
    t0=await finish(p,4321);await at(tIn+1000);
    if(phone)await p.tap('#endTab1');else await p.click('#endTab1');await p.waitForTimeout(500);
    if(phone)await p.tap('#endTab0');else await p.click('#endTab0');
    await at(tIn+6000);ok(await slide(p)===0&&await p.evaluate(()=>document.querySelector('#endTab1 .prog').hidden),tag+': after a manual swap (tabs) it stays where the player left it');
    // PC: the mouse resting on a tab swaps to it (no click), after a short hover intent; a quick pass does nothing; the tab shown does nothing;
    // during a swap it waits for the swap to end (one at a time); it cancels the swap by itself
    if(!phone){t0=await finish(p,4321);await p.mouse.move(5,5);await at(tIn+300);
      const anims=()=>p.evaluate(()=>document.getElementById('endSlide0').getAnimations().length+document.getElementById('rankBox').getAnimations().length);
      await p.hover('#endTab1');await p.waitForTimeout(50);await p.mouse.move(5,5);await p.waitForTimeout(400);
      ok(await slide(p)===0&&!(await anims()),tag+': the mouse crossing RANKING quickly (50 ms, on its way somewhere else): nothing');
      await p.hover('#endTab0');await p.waitForTimeout(400);ok(await slide(p)===0&&!(await anims()),tag+': resting on TU PARTIDA (already shown): nothing');
      await p.hover('#endTab1');await p.waitForTimeout(90);ok(await slide(p)===0,tag+': resting on RANKING: not yet at 90 ms (hover intent)');
      if(w===1920){await p.waitForTimeout(250);await p.evaluate(()=>(window.__held=document.getAnimations().filter(a=>a.playState==='running')).forEach(a=>a.pause()));
        await p.screenshot({path:shot(`cartel_hover_${w}x${h}_${lang}.png`),timeout:240000});await p.evaluate(()=>(window.__held||[]).forEach(a=>a.play()));}
      await p.waitForTimeout(700);
      ok(await slide(p)===1&&!(await anims())&&await p.evaluate(()=>document.querySelector('#endTab1 .prog').hidden),tag+': resting on RANKING: the swap to the ranking (no click), the countdown off');
      await p.hover('#endTab0');await p.waitForTimeout(800);ok(await slide(p)===0,tag+': resting on TU PARTIDA: back to the stats');
      await at(tIn+4500);ok(await slide(p)===0,tag+': ... and it stays there (a hover swap cancels the one by itself)');
      await p.mouse.move(5,5);await p.keyboard.press('ArrowRight');await p.waitForTimeout(20);await p.hover('#endTab0');await p.waitForTimeout(280);
      const q1=await p.evaluate(()=>document.getElementById('endTab1').getAttribute('aria-selected'));const n1=await anims();
      await p.waitForTimeout(420);const n2=await anims();await p.waitForTimeout(700);
      ok(q1==='true'&&n1<=2&&n2<=2&&await slide(p)===0&&!(await anims()),tag+': resting on TU PARTIDA during a swap (→): it waits for that swap to end, then swaps back; never two at once',{q1,n1,n2});}
    // the swap itself: frame times while the frames fly (four swaps) against the plate standing still; caught half way (screenshot on PC 1920)
    t0=await finish(p,4321);await at(tIn+300);
    const ft=await p.evaluate(async()=>{const tm=async(ms,act)=>{const d=[];let last=0,run=true;const f=t=>{if(last)d.push(t-last);last=t;if(run)requestAnimationFrame(f);};requestAnimationFrame(f);
        if(act)for(const k of [1,0,1,0]){document.getElementById(k?'endTab1':'endTab0').click();await new Promise(r=>setTimeout(r,ms/4));}else await new Promise(r=>setTimeout(r,ms));
        run=false;d.sort((a,b)=>a-b);return {n:d.length,avg:+(d.reduce((a,b)=>a+b,0)/d.length).toFixed(1),p95:+d[Math.floor(d.length*.95)].toFixed(1),max:+d[d.length-1].toFixed(1)};};
      return {still:await tm(2400,false),swap:await tm(2400,true)};});
    ok(ft.swap.p95<=Math.max(40,ft.still.p95*1.6),`${tag}: frame times, standing still avg ${ft.still.avg} / 95% ${ft.still.p95} ms; during four swaps avg ${ft.swap.avg} / 95% ${ft.swap.p95} / worst ${ft.swap.max} ms`,ft);
    await p.waitForTimeout(700);
    const prevAt=async()=>p.evaluate(()=>{const r=document.getElementById('endPrev').getBoundingClientRect(),t=document.getElementById('endTabs').getBoundingClientRect();return [r.left,r.top,t.left,t.top].map(v=>Math.round(v*10)/10).join();});
    if(phone)await p.tap('#endTab1');else await p.click('#endTab1');await p.waitForTimeout(190);await p.evaluate(()=>(window.__held=document.getAnimations().filter(a=>a.playState==='running')).forEach(a=>a.pause()));
    const M=await p.evaluate(()=>{const a=document.getElementById('endSlide0'),b=document.getElementById('rankBox'),ga=getComputedStyle(a),gb=getComputedStyle(b),pn=document.getElementById('endPanel').getBoundingClientRect();
      return {fa:a.style.filter,fb:b.style.filter,ca:ga.filter,cb:gb.filter,oa:+ga.opacity,ob:+gb.opacity,va:ga.visibility,vb:gb.visibility,ta:ga.transform,
        left:a.getBoundingClientRect().left<pn.left-2,right:b.getBoundingClientRect().left>pn.left+2,sa:document.querySelector('#endBlurA feGaussianBlur').getAttribute('stdDeviation'),sb:document.querySelector('#endBlurB feGaussianBlur').getAttribute('stdDeviation')};});
    const mid=await prevAt();
    ok(M.va==='visible'&&M.vb==='visible'&&M.oa>0.02&&M.oa<0.98&&M.ob>0.02&&M.left&&M.right,tag+': half way: the stats frame on its way out to the left and fading, the ranking frame coming in from the right',M);
    if(phone)ok(!M.fa&&/blur\(/.test(M.ca)&&/blur\(/.test(M.cb),tag+': touch: a light CSS blur on both frames (no SVG filter)',M);
    else ok(M.fa==='url("#endBlurA")'&&M.fb==='url("#endBlurB")'&&/^[1-9][\d.]* 0$/.test(M.sa)&&/^[\d.]+ 0$/.test(M.sb)&&+M.sa.split(' ')[0]>2,tag+': PC: the sideways-only blur (SVG, stdDeviation "N 0") on both frames, growing on the one leaving ('+M.sa+')',M);
    if(w===1920)await p.screenshot({path:shot(`cartel_swap_${w}x${h}_${lang}.png`),timeout:240000});
    await p.evaluate(()=>(window.__held||[]).forEach(a=>a.play()));await p.waitForTimeout(800);
    const E=await p.evaluate(()=>{const a=document.getElementById('endSlide0'),b=document.getElementById('rankBox');return {a:a.className,va:getComputedStyle(a).visibility,ob:+getComputedStyle(b).opacity,fa:a.style.filter,fb:b.style.filter,cb:getComputedStyle(b).filter,tb:getComputedStyle(b).transform,anims:a.getAnimations().length+b.getAnimations().length};});
    ok(await slide(p)===1&&/off/.test(E.a)&&E.va==='hidden'&&E.ob===1&&!E.fa&&!E.fb&&E.cb==='none'&&E.tb==='none'&&!E.anims,tag+': then the ranking frame sharp and in place, the stats frame put away, no blur or animation left',E);
    ok(mid===await prevAt(),tag+': the tabs and the ‹ chevron did not travel with the frames');
    if(w===960){await p.emulateMedia({reducedMotion:'reduce'});await p.click('#endTab0');await p.waitForTimeout(120);await p.evaluate(()=>(window.__held=document.getAnimations().filter(a=>a.playState==='running')).forEach(a=>a.pause()));
      const RM=await p.evaluate(()=>{const a=getComputedStyle(document.getElementById('endSlide0')),b=getComputedStyle(document.getElementById('rankBox'));return {ta:a.transform,tb:b.transform,fa:a.filter,fb:b.filter,oa:+a.opacity,ob:+b.opacity};});
      ok(RM.ta==='none'&&RM.tb==='none'&&RM.fa==='none'&&RM.fb==='none'&&RM.oa>0.02&&RM.oa<0.98&&RM.ob>0.02&&RM.ob<0.98,tag+': reduced motion: a plain crossfade (no travel, no blur)',RM);
      await p.evaluate(()=>(window.__held||[]).forEach(a=>a.play()));await p.waitForTimeout(500);await p.emulateMedia({reducedMotion:null});}
    // no ranking: nothing moves
    S.down=true;t0=await finish(p,4321,true);await at(tIn+7000);
    ok(await p.evaluate(()=>document.getElementById('endTabs').hidden&&document.getElementById('rankBox').hidden&&document.getElementById('endTab0').getAttribute('aria-selected')==='true'),tag+': ranking down: no swap at all');
    S.down=false;ok(!p.errs.length,tag+': no page errors',p.errs);await p.context().close();}}

  // ================= 3) the reminder =================
  if(!ONLY||ONLY==='nag'){
  console.log('3) the reminder «¿GUARDAMOS TU PUNTUACIÓN?»');
  const nagOpen=p=>p.evaluate(()=>{const a=document.getElementById('acct');return !a.hidden&&a.dataset.s==='nag';});
  const state=p=>p.evaluate(()=>__T.state);
  for(const [w,h,phone,lang] of [[1920,1080,false,'es'],[844,390,true,'es'],[1280,720,false,'en']]){
    const tag=`${w}x${h} ${lang}`;let S=server();S.seed=SIX;
    let p=await open(b,S,w,h,phone,lang);await finish(p,4321);await p.waitForTimeout(2600);
    if(phone)await p.tap('#again');else await p.keyboard.press('Enter');await p.waitForTimeout(500);
    ok(await nagOpen(p)&&await state(p)==='dead',tag+': retrying before the ranking was seen, a run in the top 50 → the reminder (the game waits)');
    const N=await p.evaluate(()=>({t:document.getElementById('acT').getAttribute('aria-label'),l1:document.getElementById('acL1').textContent,l2:document.getElementById('acL2').textContent,
      save:!document.getElementById('acSave').hidden,saveT:document.querySelector('#acSave b').textContent,go:document.getElementById('acGo').textContent.trim(),focus:document.activeElement&&document.activeElement.id,
      inside:(r=>r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1)(document.getElementById('acBox').getBoundingClientRect())}));
    const ES=lang==='es';
    ok(N.t===(ES?'¿GUARDAMOS TU PUNTUACIÓN?':'SHALL WE SAVE YOUR SCORE?')&&/4[.,]321/.test(N.l1)&&N.l2===(ES?'Entrarías en el puesto #5':"You'd be #5")&&N.save&&N.saveT===(ES?'GUARDAR MI PUNTUACIÓN':'SAVE MY SCORE')&&N.go===(ES?'REINTENTAR':'RETRY')&&N.inside,tag+': the score, «#5», GUARDAR · con Google and REINTENTAR',N);
    if(!phone)ok(N.focus==='acGo',tag+': REINTENTAR has the focus (Enter / Space)',N.focus);
    await p.screenshot({path:shot(`cartel_nag_${w}x${h}_${lang}.png`),timeout:240000});
    if(phone)await p.tap('#acGo');else await p.keyboard.press('Enter');await p.waitForTimeout(500);
    ok(!(await nagOpen(p))&&await state(p)==='play',tag+': '+(phone?'REINTENTAR':'Enter')+' retries at once');
    await p.evaluate(()=>{window.__noSpawn=1;});await finish(p,6000);await p.waitForTimeout(1200);
    if(phone)await p.tap('#again');else await p.keyboard.press('Enter');await p.waitForTimeout(500);
    ok(!(await nagOpen(p))&&await state(p)==='play',tag+': only once a session: the next time it retries straight away');
    await p.context().close();
    if(phone)continue;
    // a new session: the ranking was seen (by itself) → no reminder
    S=server();S.seed=SIX;p=await open(b,S,w,h,phone,lang);await finish(p,4321);await p.waitForFunction(()=>document.getElementById('endTab1').getAttribute('aria-selected')==='true',null,{timeout:15000});
    await p.keyboard.press('Enter');await p.waitForTimeout(500);ok(!(await nagOpen(p))&&await state(p)==='play',tag+': the ranking was seen → no reminder');await p.context().close();
    // the ranking seen by hand (→ and back) → no reminder
    S=server();S.seed=SIX;p=await open(b,S,w,h,phone,lang);await finish(p,4321);await p.waitForTimeout(1500);await p.keyboard.press('ArrowRight');await p.waitForTimeout(300);await p.keyboard.press('ArrowLeft');await p.waitForTimeout(300);
    await p.keyboard.press('KeyR');await p.waitForTimeout(500);ok(!(await nagOpen(p))&&await state(p)==='play',tag+': seen by hand and back → no reminder (R retries)');await p.context().close();
    // seen by resting the mouse on RANKING (no click) and back → no reminder
    S=server();S.seed=SIX;p=await open(b,S,w,h,phone,lang);await finish(p,4321);await p.waitForTimeout(1500);await p.hover('#endTab1');await p.waitForTimeout(800);await p.hover('#endTab0');await p.waitForTimeout(800);
    await p.keyboard.press('Enter');await p.waitForTimeout(500);ok(!(await nagOpen(p))&&await state(p)==='play',tag+': seen by resting the mouse on RANKING and back → no reminder');await p.context().close();
    // would not make the top 50 and no record → no reminder
    S=server();S.seed=SIXTY;p=await open(b,S,w,h,phone,lang,()=>{localStorage.setItem('heads_best_v3',JSON.stringify({score:999999,round:30}));});await finish(p,500);await p.waitForTimeout(1500);
    await p.keyboard.press('Enter');await p.waitForTimeout(500);ok(!(await nagOpen(p))&&await state(p)==='play',tag+': not in the top 50 and not a record → no reminder, no delay');await p.context().close();
    // a new device record alone is enough; Esc retries
    S=server();S.seed=SIXTY;p=await open(b,S,w,h,phone,lang);await finish(p,500);await p.waitForTimeout(1500);
    await p.click('#again');await p.waitForTimeout(500);const R2=await p.evaluate(()=>document.getElementById('acL2').textContent);
    ok(await nagOpen(p)&&R2===(ES?'¡Es tu nuevo récord!':"It's your new record!"),tag+': not in the top 50 but a new record on this device → the reminder, «'+R2+'»');
    await p.keyboard.press('Escape');await p.waitForTimeout(500);ok(!(await nagOpen(p))&&await state(p)==='play',tag+': Esc retries');await p.context().close();
    // Space retries too
    S=server();S.seed=SIX;p=await open(b,S,w,h,phone,lang);await finish(p,4321);await p.waitForTimeout(1500);await p.click('#again');await p.waitForTimeout(400);
    await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.keyboard.press('Space');await p.waitForTimeout(500);
    ok(!(await nagOpen(p))&&await state(p)==='play',tag+': Space retries (even with the focus nowhere)');await p.context().close();
    // ranking down → no reminder
    S=server();S.down=true;p=await open(b,S,w,h,phone,lang);await finish(p,4321,true);await p.waitForTimeout(1500);
    await p.keyboard.press('Enter');await p.waitForTimeout(500);ok(!(await nagOpen(p))&&await state(p)==='play',tag+': ranking down → no reminder');await p.context().close();}}
  await b.close();
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
