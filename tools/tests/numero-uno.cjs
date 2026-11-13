// «¡NUEVO Nº1!» (v87, src/game/43-numero-uno.js): the celebration of a new #1 of the Season 1 ranking. Run on dist-test:
//   npm run build:test && tools/run-test.sh dist-test tools/tests/numero-uno.cjs
//   HEADS_ONLY=fit | guest | signed | google   only that part
// No server: /api/* is answered by the test (a small fake of worker/ranking.ts: the board it is told to have, and the answer /api/save gives).
// 1) fit: the celebration alone (shown straight over the menu) at every size (PC 960x540 … 2560x1440, phones 844x390, 667x375, 932x430), ES and EN,
//    a 12-letter nickname and a 7-digit score: crown, title, lines all on screen and centred, nothing over the edges, the title above the lines
// 2) guest, PC ES: a run that would be #1 -> not before the plate's entrance (+2.6 s), then the overlay: title, «Guárdala con Google…», sparks;
//    keys never reach REINTENTAR while it is up (Enter skips it after 0.5 s, the plate stays); then the ranking slide with the TÚ line crowned and
//    GUARDAR pulsing, «¡SERÍAS EL Nº1!» on the plate; REINTENTAR -> «¿GUARDAMOS TU PUNTUACIÓN?» with «¡Serías el Nº1 del ranking!» even after
//    the ranking was seen. A guest run at #2: nothing, «Con esta partida entrarías en el puesto #2». Phone EN: a tap skips it; «NEW #1!».
// 3) signed in, PC: the save answers place 1 + new best -> the overlay with CAPITÁN {APODO} · score, by itself it closes (~3.7 s + 0.45 s), then
//    the ranking slide with my line crowned, «¡NUEVO Nº1 DE LA TEMPORADA!»; place 1 without a new best, a flagged run, place 2: nothing
// 4) back from Google (accResult): the full ranking screen «¡NUEVO Nº1 DE LA TEMPORADA!» with the celebration over it; then my line crowned
// Screenshots: tools/tests/out/n1_*.png
const {chromium}=require('playwright');
const crypto=require('crypto');
const {BASE,ARGS}=require('./lib.cjs');
const path=require('path');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,900):''));if(!c)bad++;};
const ONLY=process.env.HEADS_ONLY||'';
const OUT=path.join(__dirname,'out');
const SIX=[['ORION',15200,12],['LUNA',9800,9],['KRAKEN',7400,8],['NOVA_7',5100,6],['ZETA',2600,4],['ECO',900,2]];
const FAKE=`window.HEADS_AUTH=async()=>({makeAuth:()=>({async init(){return {error:null};},async token(){const s=localStorage.getItem('heads-auth');return s?JSON.parse(s).access_token:null;},
  async signIn(){},async signOut(){localStorage.removeItem('heads-auth');}})});`;
function server(){const S={seed:SIX,save:null,calls:[]};
  S.handle=route=>{const rq=route.request(),u=new URL(rq.url()),p=u.pathname;S.calls.push(p);const J=(s,j)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(j)});
    if(p==='/api/auth')return J(200,{url:'https://fake-ref.supabase.co',key:'sb_publishable_TEST'});
    if(p==='/api/run')return J(200,{token:`${Date.now()}.${crypto.randomBytes(8).toString('hex')}.sig`});
    if(p==='/api/scores'){const n=Math.min(50,+(u.searchParams.get('n')||10));const top=S.seed.map(([nick,score,round],i)=>({pos:i+1,nick,score,round,me:false}));
      return J(200,{season:1,count:top.length,top:top.slice(0,n)});}
    if(p==='/api/save'){let body=null;try{body=JSON.parse(rq.postData()||'null');}catch(_){}
      const sc=body&&body.score||0,o=S.save||{},pos=o.pos||1+S.seed.filter(e=>e[1]>=sc).length;
      const top=S.seed.map(([nick,score,round])=>({nick,score,round,me:false}));if(pos<=top.length+1)top.splice(pos-1,0,{nick:'SÁNTÍ',score:sc,round:body.round,me:true});
      top.forEach((e,i)=>e.pos=i+1);const me={...top.find(e=>e.me)||{nick:'SÁNTÍ',score:sc,round:body.round,me:true},pos};
      return J(200,{saved:true,status:o.status||'ok',nick:'SÁNTÍ',newBest:o.newBest!==false,prevBest:null,best:{score:sc,round:body.round},count:top.length,top:top.slice(0,+(body.n||5)),me});}
    if(p==='/api/m')return route.fulfill({status:204});
    return J(401,{error:'session'});};
  return S;}
async function open(b,S,{w=1280,h=720,phone=false,lang='es',signed=false,game=true}={}){
  const ctx=await b.newContext(phone?{viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:w,height:h}});
  await ctx.route('**/api/**',S.handle);
  await ctx.addInitScript(([l,sg])=>{window.__rankOn=1;window.__lang=l;if(sg){localStorage.setItem('heads-auth',JSON.stringify({access_token:'tok-u1'}));localStorage.setItem('heads_capitan','SÁNTÍ');}
    new MutationObserver(()=>{const e=document.getElementById('end');if(e&&!e.hidden&&!window.__endAt)window.__endAt=performance.now();if(e&&e.hidden)window.__endAt=0;})
      .observe(document,{subtree:true,attributes:true,attributeFilter:['hidden']});},[lang,signed]);
  await ctx.addInitScript(FAKE);
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});
  await p.goto(BASE+'/test.html');await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});
  if(!game)return p;
  if(phone)await p.waitForFunction(()=>!document.getElementById('mmGo').disabled,null,{timeout:30000});
  await p.evaluate(ph=>document.getElementById(ph?'mmGo':'play').click(),phone);
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
  await p.evaluate(()=>{window.__noSpawn=1;window.__noRender=1;}); // (no 3D drawing: the software GPU is slow and runs out of memory; the plate and the celebration are HTML)
  return p;}
async function finish(p,score){await p.waitForTimeout(600); // (the run token)
  await p.evaluate(sc=>{__T.score=Math.round(sc*0.7);__T.pts=sc-Math.round(sc*0.7);__T.playT=900;__MUS().endGame(false,'dead');},score);
  await p.waitForFunction(()=>!document.getElementById('end').hidden,null,{timeout:30000});
  await p.waitForFunction(()=>!document.querySelector('#rankList li.load'),null,{timeout:20000}).catch(()=>{});}
const n1=p=>p.evaluate(()=>{const el=document.getElementById('n1'),q=s=>el.querySelector(s),tx=s=>(q(s)&&q(s).textContent||'').trim();
  return {shown:!el.hidden,go:el.classList.contains('go'),on:__n1.N1.on,title:tx('.n1Tl .g3>i'),ts:tx('.n1Ts'),who:tx('.n1Who'),hint:tx('.n1Hint'),guest:el.classList.contains('guest'),
    t0:__n1.N1.t0,endAt:window.__endAt,sparks:__n1.N1FX.P.length,raf:__n1.N1FX.raf,log:__n1.N1.log.slice()};});
const plate=p=>p.evaluate(()=>{const g=id=>document.getElementById(id);
  return {end:!g('end').hidden,slide:g('endTab1').getAttribute('aria-selected')==='true'?1:0,msg:[...g('rankMsg').querySelectorAll('span')].map(s=>s.textContent),
    n1row:!!g('rankList').querySelector('li.n1'),n1rowKind:(g('rankList').querySelector('li.n1')||{}).className||'',save:!g('saveBtn').hidden,savePulse:g('saveBtn').classList.contains('n1'),state:__T.state,
    acct:!g('acct').hidden,acctS:g('acct').dataset.s||'',l1:g('acL1').textContent,l2:g('acL2').textContent};});
const snap=(p,n)=>p.screenshot({path:path.join(OUT,n)}).catch(()=>{});
// the overlay on screen and nothing over the edges
const fit=p=>p.evaluate(()=>{const W=innerWidth,H=innerHeight,R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
  const el=document.getElementById('n1'),parts={crown:el.querySelector('.n1Crown'),title:el.querySelector('.n1Tl .g3'),ts:el.querySelector('.n1Ts'),who:el.querySelector('.n1Who'),hint:el.querySelector('.n1Hint')};
  const o={W,H,out:[],rects:{}};for(const [k,e] of Object.entries(parts)){const r=R(e);o.rects[k]=r;if(r.l<2||r.r>W-2||r.t<2||r.b>H-2)o.out.push(k);}
  const t=o.rects.title;o.centre=Math.abs((t.l+t.r)/2-W/2);o.order=o.rects.crown.b<=t.t+t.h*0.35&&t.b<=o.rects.ts.t+2&&o.rects.ts.b<=o.rects.who.t+2&&o.rects.who.b<=o.rects.hint.t+2;
  o.titleH=t.h;return o;});
(async()=>{
 const b=await chromium.launch({args:ARGS});
 // ---------- 1) fit
 if(!ONLY||ONLY==='fit'){console.log('1) the celebration at every size');
  const S=server();
  for(const lang of ['es','en'])for(const [phone,sizes] of [[0,[[960,540],[1280,720],[1366,768],[1920,1080],[2560,1440]]],[1,[[844,390],[667,375],[932,430]]]]){
   const p=await open(b,S,{w:sizes[0][0],h:sizes[0][1],phone:!!phone,lang,game:false});
   await p.evaluate(()=>{window.__noRender=1;__n1.N1_CFG.dur=600000;}); // (the 3D behind the menu is not what is measured here; it stays up while measured)
   for(const [w,h] of sizes){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(200);
    for(const kind of ['saved','guest']){
      await p.evaluate(k=>__n1.show(k,{score:9999999,nick:'WWWWWWWWWWWW',over:'acct',after:()=>{}}),kind);
      // measure once the entrance has really finished (the software GPU can hold frames back: the CSS clock only moves with frames)
      await p.evaluate(()=>{const q=s=>document.querySelector('#n1 '+s).getAnimations().filter(a=>isFinite(a.effect.getComputedTiming().endTime));
        return Promise.race([Promise.all([...q('.n1Tl'),...q('.n1Hint'),...q('.n1In')].map(a=>a.finished.catch(()=>{}))),new Promise(r=>setTimeout(r,9000))]);});await p.waitForTimeout(150);
      const f=await fit(p),s=await n1(p);
      ok(s.shown&&f.out.length===0&&f.centre<3&&f.order,`${w}x${h} ${lang} ${kind}: on screen, centred, crown > title > lines (${s.title} · ${s.who} · ${s.hint})`,f);
      ok(f.titleH>=(phone?40:h*0.09),`  the title is big (${Math.round(f.titleH)} px)`,f);
      if(lang==='en')ok(s.title==='NEW #1!'&&(kind==='guest'?s.hint==='Save it with Google to keep the #1 spot':s.hint==='Nobody has done better this season')&&s.ts==='CAPTAINS LEADERBOARD · SEASON 1','  English',s);
      else ok(s.title==='¡NUEVO Nº1!'&&s.ts==='RANKING DE CAPITANES · TEMPORADA 1','  Spanish',s);
      if(kind==='saved'&&(w===1920||w===844))await snap(p,`n1_fit_${w}x${h}_${lang}.png`);
      await p.evaluate(()=>__n1.close('abort'));}}
    ok(p.errs.length===0,'  no page errors',p.errs);await p.context().close();}}
 // ---------- 2) guest
 if(!ONLY||ONLY==='guest'){console.log('2) guest');
  const S=server();let p=await open(b,S,{w:1600,h:900}); // (1920x1080 runs the software GPU out of memory with the game behind)
  await p.evaluate(()=>{__n1.N1_CFG.dur=60000;}); // (it stays up until Enter: this machine is slow)
  await finish(p,20000);
  let s;
  await p.waitForFunction(()=>__n1.N1.on,null,{timeout:15000}).catch(()=>{});s=await n1(p);
  ok(s.shown&&s.go&&s.guest,'then the celebration (guest)',s);
  ok(s.t0-s.endAt>=2500,`  after the plate's entrance (+${Math.round(s.t0-s.endAt)} ms, wanted >= 2600)`,s);
  ok(s.title==='¡NUEVO Nº1!'&&s.hint==='Guárdala con Google para quedarte el Nº1'&&/20\.000/.test(s.who),'  title, score and «Guárdala con Google para quedarte el Nº1»',s);
  await p.waitForTimeout(900);s=await n1(p);ok(s.sparks>40&&s.raf,'  gold sparks flying ('+s.sparks+')',s);
  await snap(p,'n1_guest_1600x900_es.png');
  let P=await plate(p);ok(P.msg[0]==='¡SERÍAS EL Nº1!'&&P.msg[1]==='Guárdala con Google para quedarte el Nº1','  the plate behind: «¡SERÍAS EL Nº1!»',P);
  await p.keyboard.press('Enter');await p.waitForTimeout(500);P=await plate(p);s=await n1(p);
  ok(P.end&&P.state==='dead','  Enter does not retry while it is up',P);
  ok(!s.on,'  Enter skips it',s);
  await p.waitForTimeout(900);P=await plate(p);s=await n1(p);
  ok(!s.shown&&P.slide===1&&P.n1row&&/ghost/.test(P.n1rowKind)&&P.savePulse,'  then the ranking: the TÚ line crowned, GUARDAR pulsing',P);
  ok(!s.raf&&s.sparks===0,'  the sparks are gone',s);
  await snap(p,'n1_guest_after_1600x900_es.png');
  await p.click('#again');await p.waitForTimeout(400);P=await plate(p);
  ok(P.acct&&P.acctS==='nag'&&P.l2==='¡Serías el Nº1 del ranking!'&&P.state==='dead','REINTENTAR: «¿GUARDAMOS TU PUNTUACIÓN?» with «¡Serías el Nº1 del ranking!» (the ranking was seen)',P);
  await snap(p,'n1_guest_nag_1600x900_es.png');
  await p.click('#acGo');await p.waitForFunction(()=>__T.state==='play',null,{timeout:30000});await p.evaluate(()=>{window.__noSpawn=1;});
  // a second run at #2: nothing
  await finish(p,12000);await p.waitForTimeout(4500);s=await n1(p);P=await plate(p);
  ok(!s.shown&&s.log.filter(x=>x.startsWith('fire')).length===1&&P.msg[0]==='Con esta partida entrarías en el puesto #2'&&!P.n1row&&!P.savePulse,'a guest run at #2: no celebration, «… puesto #2»',{s,P});
  ok(p.errs.length===0,'no page errors',p.errs);await p.context().close();
  // phone, English: a tap skips it
  p=await open(b,S,{w:844,h:390,phone:true,lang:'en'});await p.evaluate(()=>{__n1.N1_CFG.dur=60000;});await finish(p,30000);
  await p.waitForFunction(()=>__n1.N1.on,null,{timeout:15000}).catch(()=>{});await p.waitForTimeout(1100);s=await n1(p);
  ok(s.shown&&s.title==='NEW #1!'&&s.hint==='Save it with Google to keep the #1 spot','phone EN: «NEW #1!»',s);
  await snap(p,'n1_guest_844x390_en.png');
  await p.touchscreen.tap(422,195);await p.waitForTimeout(800);s=await n1(p);P=await plate(p);
  ok(!s.shown&&P.end&&P.slide===1&&P.n1row,'  a tap skips it, the plate stays, the ranking with the #1 line',{s,P});
  ok(p.errs.length===0,'no page errors',p.errs);await p.context().close();}
 // ---------- 3) signed in
 if(!ONLY||ONLY==='signed'){console.log('3) signed in');
  const S=server();let p=await open(b,S,{w:1280,h:720,signed:true});
  await p.evaluate(()=>{__n1.N1_CFG.dur=3700;});S.save={pos:1};await finish(p,21000);
  await p.waitForFunction(()=>__n1.N1.on,null,{timeout:15000}).catch(()=>{});let s=await n1(p);const t0=Date.now();
  ok(s.shown&&!s.guest&&/CAPITÁN\s*SÁNTÍ/.test(s.who)&&/21\.000/.test(s.who)&&s.hint==='Nadie lo ha hecho mejor esta temporada','the save says #1 + new best: CAPITÁN SÁNTÍ · 21.000',s);
  ok(S.calls.includes('/api/save'),'  (the run was saved)');
  let P=await plate(p);ok(P.msg[0]==='¡NUEVO Nº1 DE LA TEMPORADA!'&&/Puesto #1 de/.test(P.msg[1]||''),'  the plate: «¡NUEVO Nº1 DE LA TEMPORADA!» · Puesto #1',P);
  await p.waitForTimeout(1200);await snap(p,'n1_signed_1280x720_es.png');
  await p.waitForFunction(()=>document.getElementById('n1').hidden,null,{timeout:12000}).catch(()=>{});const dt=Date.now()-t0;
  P=await plate(p);ok(dt>2800&&dt<6500,`  it closes by itself (${dt} ms)`);
  await p.waitForTimeout(700);P=await plate(p);ok(P.slide===1&&P.n1row&&/me/.test(P.n1rowKind)&&!P.savePulse,'  then the ranking with my line crowned',P);
  await snap(p,'n1_signed_after_1280x720_es.png');
  for(const [lbl,o,sc] of [['place 1, no new best',{pos:1,newBest:false},21000],['flagged',{pos:1,status:'flagged'},22000],['place 2',{pos:2},12000]]){
    await p.click('#again');await p.waitForFunction(()=>__T.state==='play',null,{timeout:30000});await p.evaluate(()=>{window.__noSpawn=1;});
    S.save=o;await finish(p,sc);await p.waitForTimeout(4500);s=await n1(p);
    ok(!s.shown&&s.log.filter(x=>x.startsWith('fire')).length===1,`${lbl}: no celebration`,s);}
  ok(p.errs.length===0,'no page errors',p.errs);await p.context().close();}
 // ---------- 4) back from Google
 if(!ONLY||ONLY==='google'){console.log('4) back from Google (accResult)');
  const S=server();const p=await open(b,S,{w:1366,h:768,game:false});
  const top=[{pos:1,nick:'SÁNTÍ',score:25000,round:13,me:true},...SIX.map(([nick,score,round],i)=>({pos:i+2,nick,score,round,me:false}))];
  await p.evaluate(t=>__acc.result({s:200,j:{saved:true,status:'ok',nick:'SÁNTÍ',newBest:true,prevBest:null,best:{score:25000,round:13},count:t.length,top:t,me:t[0]}},{token:'tk-1',score:25000}),top);
  await p.waitForTimeout(1300);let s=await n1(p),P=await plate(p);
  ok(s.shown&&/SÁNTÍ/.test(s.who)&&P.acct&&P.acctS==='saved'&&P.l1==='¡NUEVO Nº1 DE LA TEMPORADA!','the full ranking screen «¡NUEVO Nº1 DE LA TEMPORADA!» with the celebration over it',{s,P});
  await snap(p,'n1_google_1366x768_es.png');
  await p.waitForFunction(()=>document.getElementById('n1').hidden,null,{timeout:12000}).catch(()=>{});await p.waitForTimeout(400);
  const row=await p.evaluate(()=>{const li=document.querySelector('#acList li.me');return li?li.className:'';});
  ok(/n1/.test(row),'  then my line in the list crowned',row);
  await snap(p,'n1_google_after_1366x768_es.png');
  ok(p.errs.length===0,'no page errors',p.errs);await p.context().close();}
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
