// The end plate with the Season 1 panel (v82), at every screen size, Spanish and English. Run on dist-test:
//   npm run build:test && PORT=8798 tools/run-test.sh dist-test tools/tests/cuentas-cartel.cjs
//   HEADS_ONLY=pc | phone   only those sizes · HEADS_SHOTS=all   a screenshot of every state at every size (default: the main ones)
// No server: /api/* is answered by the test (the same small fake as cuentas.cjs, with the board it is told to have).
// Sizes: PC 960x540, 1280x720, 1366x768, 1600x900, 1920x1080, 2560x1440 · phones 844x390, 667x375, 932x430. A heavy game (ten stat lines).
// Board states, for a guest:
//   empty0  empty board, score 0 (cannot be saved): five waiting lines, the first says «¡Sé el primero!», no button
//   empty   empty board, a score: the «TÚ» line at #1, «¡Guárdala y serás el primero del ranking!», the button
//   short   two captains: they, then «TÚ» (#3), then two waiting lines
//   full    six captains, a score that enters at #5: four of them, then «TÚ»
//   low     six captains, a score that does not enter: the top 5 and «Guarda tu puntuación…»
//   down    /api/scores 503: no panel, the one column of v44 (balanced, centred)
// What it checks, every size x language x state:
//   two columns while the panel is on: the run on the left, the panel on the right, REINTENTAR under both; nothing of the run (title lines and
//   their ornaments, subtitle, score, stats, record) under the panel; REINTENTAR clear of both; all of it on screen and centred;
//   the panel: title, SEASON 1, five lines (+ the right ones: waiting, first, ghost), every text inside the panel, the scores never cut;
//   GUARDAR MI PUNTUACIÓN, VER RANKING COMPLETO and REINTENTAR answer where they are drawn; on phones the button is at least 30 px tall and
//   the list's letters at least 8 px; VER RANKING COMPLETO opens the full list (framed, scrolls by itself, inside the screen), SEGUIR closes it.
// Screenshots: tools/tests/out/cartel_<w>x<h>_<lang>_<state>.png and cartel_full_<w>x<h>_<lang>.png
const {chromium}=require('playwright');
const crypto=require('crypto');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,900):''));if(!c)bad++;};
const PC=[[960,540],[1280,720],[1366,768],[1600,900],[1920,1080],[2560,1440]],PHONE=[[844,390],[667,375],[932,430]];
const ONLY=process.env.HEADS_ONLY||'',ALL=process.env.HEADS_SHOTS==='all';
const SIX=[['ORION',15200,12],['LUNA',9800,9],['KRAKEN',7400,8],['NOVA_7',5100,6],['ZETA',2600,4],['ECO',900,2]];
const STATES=[['empty0',[],0],['empty',[],3210],['short',SIX.slice(0,2),3000],['full',SIX,4321],['low',SIX,500],['down',null,3000]];
const MAIN=new Set(['1920x1080','844x390']); // every state on these; the others: full (and down) only, unless HEADS_SHOTS=all

function server(){const S={seed:[],down:false};
  S.handle=route=>{const rq=route.request(),u=new URL(rq.url()),p=u.pathname;const J=(s,j)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(j)});
    if(p==='/api/auth')return J(200,{url:'https://fake-ref.supabase.co',key:'sb_publishable_TEST'});
    if(p==='/api/run')return J(200,{token:`${Date.now()}.${crypto.randomBytes(8).toString('hex')}.sig`});
    if(p==='/api/scores'){if(S.down)return J(503,{error:'ranking no configurado'});const n=Math.min(50,+(u.searchParams.get('n')||10));
      const top=S.seed.map(([nick,score,round],i)=>({pos:i+1,nick,score,round,me:false}));return J(200,{season:1,count:top.length,top:top.slice(0,n)});}
    if(p==='/api/m')return route.fulfill({status:204});
    return J(401,{error:'session'});};
  return S;}

const layout=p=>p.evaluate(()=>{const g=id=>document.getElementById(id),R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
  const over=(a,b)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;
  const W=innerWidth,H=innerHeight,inside=r=>r.l>=-1&&r.t>=-1&&r.r<=W+1&&r.b<=H+1;
  const rng=el=>{const q=document.createRange();q.selectNodeContents(el);return R(q);};
  const hit=el=>{if(!el||el.hidden||!el.getClientRects().length)return false;const q=el.getBoundingClientRect(),x=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return !!x&&(x===el||el.contains(x));};
  const box=g('endBox'),rk=g('rankBox'),run=g('endRun'),again=g('again'),two=box.classList.contains('rk')&&!rk.hidden,rb=two?R(rk):null;
  const runParts=[...run.querySelectorAll('#endT .ln,.orn,#endS,.eLbl,#bigScore .ln,#endRound,#endPanel,#record')].filter(e=>e.getClientRects().length);
  const ar=R(again),scale=(()=>{const m=/scale\(([\d.]+)\)/.exec(box.style.transform||'');return m?+m[1]:1;})();
  const out={two,W,H,scale,box:R(box),inside:inside(R(box))&&inside(ar)&&(!two||inside(rb)),
    centre:Math.abs((R(box).l+R(box).r)/2-W/2),
    under:two?runParts.filter(e=>over(R(e),rb)).map(e=>e.id||e.className.baseVal||e.className):[],
    againOver:over(ar,R(g('endPanel')))||(two&&over(ar,rb))||over(ar,R(g('record'))),
    againHit:hit(again),runLeft:two?R(run).r<=rb.l+1:true};
  if(!two)return out;
  const lis=[...g('rankList').children];
  Object.assign(out,{h:g('rankH').textContent,s:g('rankS').textContent,msg:[...g('rankMsg').querySelectorAll('span')].map(e=>e.textContent),
    rows:lis.filter(l=>!l.classList.contains('gap')).length,ph:lis.filter(l=>l.classList.contains('ph')).length,
    first:(lis[0]&&lis[0].classList.contains('first'))?lis[0].querySelector('span').textContent:null,
    ghost:lis.findIndex(l=>l.classList.contains('ghost'))+1,ghostT:(g('rankList').querySelector('.ghost span')||{}).textContent||null,
    names:lis.map(l=>(l.querySelector('span')||{}).textContent),
    save:!g('saveBtn').hidden,saveHit:hit(g('saveBtn')),saveH:R(g('saveBtn')).h,all:!g('rankAll').hidden,allHit:hit(g('rankAll')),
    cutIn:[g('rankH'),g('rankS'),g('rankAll'),...g('rankMsg').querySelectorAll('span'),...g('saveBtn').querySelectorAll('b,small'),g('acctBar')].filter(e=>e&&!e.hidden&&e.getClientRects().length)
      .filter(e=>{const r=rng(e);return r.l<rb.l-1||r.r>rb.r+1;}).map(e=>e.id||e.tagName+':'+e.textContent.slice(0,20)),
    scoreCut:lis.some(l=>{const b=l.querySelector('b');if(!b)return false;const r=rng(b),lr=R(l);return r.r>lr.r+1||r.l<lr.l-1;}),
    font:lis[0]?parseFloat(getComputedStyle(lis[0]).fontSize)*scale:0});
  return out;});

(async()=>{
  const b=await chromium.launch({args:ARGS});
  const sizes=[...(ONLY==='phone'?[]:PC.map(s=>[...s,false])),...(ONLY==='pc'?[]:PHONE.map(s=>[...s,true]))];
  for(const [w,h,phone] of sizes)for(const lang of ['es','en']){
    const tag=`${w}x${h} ${lang}`,S=server();console.log(tag);
    const ctx=await b.newContext(phone?{viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:w,height:h}});
    await ctx.route('**/api/**',S.handle);
    await ctx.addInitScript(l=>{window.__rankOn=1;window.__lang=l;},lang);
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});
    await p.goto(BASE+'/test.html');await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});
    if(phone)await p.waitForFunction(()=>!document.getElementById('mmGo').disabled,null,{timeout:30000});
    await p.evaluate(ph=>document.getElementById(ph?'mmGo':'play').click(),phone);
    await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});await p.evaluate(()=>{window.__noSpawn=1;});
    for(const [st,seed,score] of STATES){
      S.seed=seed||[];S.down=seed===null;
      if(await p.evaluate(()=>__T.state!=='play')){await p.click('#again',{force:true});await p.waitForFunction(()=>__T.state==='play',null,{timeout:30000});await p.evaluate(()=>{window.__noSpawn=1;});}
      await p.waitForTimeout(500); // the run token
      await p.evaluate(sc=>{const s=__heads.stats;Object.assign(s,{kills:57,heads:12,shots:300,hits:171,multi:3,saved:2400,perfect:2,spitters:2,incs:1,eggs:3,eggsKilled:2});
        __T.score=Math.round(sc*0.7);__T.pts=sc-Math.round(sc*0.7);__T.playT=700;__MUS().endGame(false,sc%2?'cargo':'dead');},score); // the longest subtitle (cargo) or the widest English title (SUIT BREACHED), ten stat lines
      await p.waitForFunction(()=>!document.getElementById('end').hidden,null,{timeout:30000});
      await p.waitForFunction(down=>down?document.getElementById('rankBox').hidden:!document.querySelector('#rankList li.load'),seed===null,{timeout:20000}).catch(()=>{});
      await p.waitForTimeout(2700); // the plate's entrance and the score counting up
      const L=await layout(p);const T=`${tag} ${st}:`;
      ok(L.inside&&L.centre<=W2(L),T+' on screen and centred (scale '+L.scale.toFixed(2)+')',L);
      ok(L.againHit&&!L.againOver,T+' REINTENTAR clear and answering',L);
      if(st==='down'){ok(!L.two,T+' ranking down: no panel, one column',L);}
      else{
        ok(L.two&&!L.under.length&&L.runLeft,T+' two columns, nothing of the run under the panel',L.under);
        ok(L.rows===5,T+' five lines',L.names);
        ok(!L.cutIn.length&&!L.scoreCut,T+' every text inside the panel, scores not cut',{cut:L.cutIn,s:L.scoreCut});
        ok(L.h===(lang==='es'?'RANKING DE CAPITANES':'CAPTAINS LEADERBOARD')&&L.s===(lang==='es'?'TEMPORADA 1':'SEASON 1'),T+' title and season',[L.h,L.s]);
        const FIRST=lang==='es'?'¡Sé el primero!':'Be the first!',YOU=lang==='es'?'TÚ':'YOU';
        if(st==='empty0')ok(L.ph===5&&L.first===FIRST&&!L.save&&!L.all&&!L.ghost,T+' five waiting lines, «'+FIRST+'», no button, no full list',L);
        if(st==='empty')ok(L.ghost===1&&L.ph===4&&L.save&&/primero|first/.test(L.msg.join(' ')),T+' «'+YOU+'» at #1, the button, «be the first»',L);
        if(st==='short')ok(L.ghost===3&&L.ph===2&&L.names[0]==='ORION'&&L.save&&L.all,T+' two captains, «'+YOU+'» #3, two waiting',L.names);
        if(st==='full')ok(L.ghost===5&&L.ph===0&&L.names[3]==='NOVA_7'&&/#5/.test(L.msg.join(' ')),T+' «'+YOU+'» enters at #5',{n:L.names,m:L.msg});
        if(st==='low')ok(!L.ghost&&L.ph===0&&L.names.join()==='ORION,LUNA,KRAKEN,NOVA_7,ZETA'&&L.save,T+' not in the top 5: the five captains',L.names);
        if(L.ghost)ok(L.ghostT&&L.ghostT.startsWith(YOU),T+' the ghost line says '+YOU,L.ghostT);
        if(L.save)ok(L.saveHit,T+' GUARDAR MI PUNTUACIÓN answers where it is drawn',L);
        if(L.all)ok(L.allHit,T+' VER RANKING COMPLETO answers where it is drawn',L);
        if(phone){if(L.save)ok(L.saveH>=30,T+' phone: the button is '+Math.round(L.saveH)+' px tall');ok(L.font>=8,T+' phone: list letters '+L.font.toFixed(1)+' px');}
      }
      if(ALL||MAIN.has(w+'x'+h)||st==='full'||st==='down')await p.screenshot({path:shot(`cartel_${w}x${h}_${lang}_${st}.png`),timeout:240000});
      // the full list from the panel
      if(st==='full'){await p.click('#rankAll');await p.waitForFunction(()=>{const a=document.getElementById('acct');return !a.hidden&&a.dataset.s==='board';},null,{timeout:20000});await p.waitForTimeout(600);
        const F=await p.evaluate(()=>{const L=document.getElementById('acList'),b=document.getElementById('acBox').getBoundingClientRect(),r=L.getBoundingClientRect(),go=document.getElementById('acGo').getBoundingClientRect();
          return {rows:L.querySelectorAll('li:not(.gap)').length,big:L.classList.contains('big'),inside:b.top>=-1&&b.bottom<=innerHeight+1&&b.left>=-1&&b.right<=innerWidth+1,list:[r.width,r.height].map(Math.round),
            go:go.bottom<=innerHeight+1&&go.height>0,l1:document.getElementById('acL1').textContent,t:document.getElementById('acT').getAttribute('aria-label')};});
        ok(F.big&&F.rows===6&&F.inside&&F.go&&F.t===(lang==='es'?'RANKING DE CAPITANES':'CAPTAINS LEADERBOARD')&&/6/.test(F.l1),T+' VER RANKING COMPLETO: the framed list (6 captains), on screen, SEGUIR reachable',F);
        if(ALL||MAIN.has(w+'x'+h)||lang==='es')await p.screenshot({path:shot(`cartel_full_${w}x${h}_${lang}.png`),timeout:240000});
        await p.click('#acGo');await p.waitForTimeout(300);ok(await p.evaluate(()=>document.getElementById('acct').hidden&&!document.getElementById('end').hidden),T+' SEGUIR: back to the end plate');}
    }
    ok(!errs.length,tag+': no page errors',errs);
    await ctx.close();}
  await b.close();
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
function W2(L){return Math.max(4,L.W*0.01);} // centred within 1 % of the width
