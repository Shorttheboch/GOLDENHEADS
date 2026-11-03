// Google accounts (v82): the end plate, the login round trip, the nickname, the saved run, auto-save, sign out, delete. Run on dist-test:
//   npm run build:test && PORT=8796 tools/run-test.sh dist-test tools/tests/cuentas.cjs
// No Google, no Supabase, no Netlify: the test answers /api/* itself (a small fake of netlify/functions/ranking.mts with its state), and
//   fake   window.HEADS_AUTH is replaced by a fake Google (init script): signIn() really leaves the page for test.html?code=... (or ?error=...)
//   real   in part 5 the real login chunk (src/cuentas/sb.js, @supabase/auth-js) runs against a fake Supabase Auth: authorize answers with a
//          302 back to the game, the PKCE code is exchanged at /auth/v1/token (the verifier is checked against the challenge)
// What it checks (screenshots in tools/tests/out/cuentas_*.png):
//   1 PC 960x540 ES  guest end plate: the top 5 and GUARDAR MI PUNTUACIÓN · con Google, where it is drawn; no login code loaded and no request to
//                    Supabase before the end plate; the click keeps the run (heads_pending_run) and goes to Google; back: the address is cleaned,
//                    the nickname screen (format checked here, then taken / bad word / reserved from the server), the rules line links to the
//                    privacy page; the run is saved once (pending gone, Bearer token, same run token) -> ¡NUEVO RÉCORD!, place, top;
//                    Enter on the screens never starts the game; next game saves by itself (CAPITÁN SÁNTÍ · Salir · Borrar mi cuenta);
//                    Salir; guest again -> login -> an existing player saves at once; the same run again -> YA ESTABA GUARDADA;
//                    delete: Escape cancels, BORRAR deletes (never window.confirm), session gone
//   2 PC             Google cancelled -> NO SE HA INICIADO SESIÓN, AHORA NO drops the run; a run older than 4 h -> caducada; login not
//                    configured (/api/auth 503) -> no button, the top still shows; ranking down (/api/scores 503) -> no box at all
//   3 phone 844x390 EN  the same flow in English with touch: button size, the nickname screen (input 16 px or more), the result, auto-save
//   4 quick looks    PC EN and phone ES guest end plates
//   5 real auth-js   PKCE against a fake Supabase Auth, session stored under heads-auth, address cleaned
// No page errors anywhere.
const {chromium}=require('playwright');
const crypto=require('crypto');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,700):''));if(!c)bad++;};
const SB='https://fake-ref.supabase.co';

// ---------- the fake server (what netlify/functions/ranking.mts answers) ----------
function server(){
  const S={players:{},runs:[],used:new Set(),calls:[],authOff:false,scoresOff:false,users:{'tok-u1':'u1','tok-u2':'u2','real-tok':'u3'},n:0};
  const SEED=[['ORION',15200,12],['LUNA',9800,9],['KRAKEN',7400,8],['NOVA',5100,6],['ZETA',2600,4],['ECO',900,2]].map(([nick,score,round],i)=>({id:'s'+i,nick,score,round,t:i}));
  const key=n=>n.normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[._-]/g,'');
  S.board=me=>{const best={};for(const r of S.runs){const p=S.players[r.u];if(!p)continue;if(!best[r.u]||r.score>best[r.u].score)best[r.u]={id:r.u,nick:p.nick,score:r.score,round:r.round,t:r.t};}
    const all=[...SEED,...Object.values(best)].sort((a,b)=>b.score-a.score||a.t-b.t).map((e,i)=>({...e,pos:i+1}));
    const m=all.find(e=>e.id===me);
    return {count:all.length,top:all.slice(0,10).map(e=>({pos:e.pos,nick:e.nick,score:e.score,round:e.round,me:e.id===me})),me:m?{pos:m.pos,nick:m.nick,score:m.score,round:m.round}:null};};
  S.handle=async route=>{const rq=route.request(),u=new URL(rq.url()),p=u.pathname,auth=(rq.headers()['authorization']||'').replace(/^Bearer /,'');
    let body=null;try{body=JSON.parse(rq.postData()||'null');}catch(_){}
    S.calls.push({p,m:rq.method(),auth,body,at:Date.now()});
    const J=(s,j)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(j)});
    if(p==='/api/auth')return S.authOff?J(503,{error:'off'}):J(200,{url:SB,key:'sb_publishable_TEST'});
    if(p==='/api/run')return J(200,{token:`${Date.now()}.${crypto.randomBytes(8).toString('hex')}.sig`});
    if(p==='/api/scores'){if(S.scoresOff)return J(503,{error:'ranking no configurado'});const b=S.board(null);return J(200,{season:1,count:b.count,top:b.top});}
    if(p==='/api/m')return route.fulfill({status:204});
    const uid=S.users[auth];if(!uid)return J(401,{error:'session'});
    const pl=S.players[uid];
    if(p==='/api/me'){if(!pl)return J(200,{season:1,player:null});const b=S.board(uid);return J(200,{season:1,player:{nick:pl.nick,banned:false,best:b.me?{score:b.me.score,round:b.me.round}:null,pos:b.me&&b.me.pos,count:b.count}});}
    if(p==='/api/nick'){const n=String(body&&body.nick||'').normalize('NFC').toUpperCase();if(!body||body.accept!==true)return J(400,{error:'terms'});
      if(pl)return J(409,{error:'exists',nick:pl.nick});
      if(!/^[A-Z0-9ÁÉÍÓÚÜÑÇ._-]{3,12}$/.test(n))return J(400,{error:'format'});
      if(/PUTA|MIERDA/.test(key(n)))return J(400,{error:'bad'});if(/HEADS|ADMIN/.test(key(n)))return J(400,{error:'reserved'});
      if([...SEED,...Object.values(S.players)].some(x=>key(x.nick)===key(n)))return J(409,{error:'taken'});
      S.players[uid]={nick:n};return J(200,{ok:true,nick:n});}
    if(p==='/api/save'){if(!pl)return J(403,{error:'nick'});if(!body||typeof body.token!=='string')return J(400,{error:'token'});
      if(body.token.startsWith('old.'))return J(400,{error:'expired'});
      if(S.used.has(body.token))return J(409,{error:'used'});S.used.add(body.token);
      const prev=S.board(uid).me;S.runs.push({u:uid,score:body.score,round:body.round,t:++S.n+100});const b=S.board(uid);
      const best=S.runs.filter(r=>r.u===uid).sort((a,c)=>c.score-a.score)[0];
      return J(200,{saved:true,status:'ok',nick:pl.nick,newBest:!prev||body.score>prev.score,prevBest:prev?prev.score:null,best:{score:best.score,round:best.round},count:b.count,top:b.top,me:b.me});}
    if(p==='/api/forget'){delete S.players[uid];S.runs=S.runs.filter(r=>r.u!==uid);return J(200,{deleted:true,runs:1});}
    return J(404,{error:'no encontrado'});};
  return S;}
const last=(S,p)=>S.calls.filter(c=>c.p===p).at(-1);
const count=(S,p)=>S.calls.filter(c=>c.p===p).length;

// ---------- a fake Google (replaces window.HEADS_AUTH; sessionStorage __google = good:<token> | cancel) ----------
const FAKE=`window.HEADS_AUTH=async()=>({makeAuth:(url,key)=>{const L=localStorage;window.__fakeCfg={url,key};
  return {async init(){const q=new URLSearchParams(location.search);
      if(q.get('code')&&L.getItem('heads-auth-code-verifier')){L.setItem('heads-auth',JSON.stringify({access_token:q.get('code')}));L.removeItem('heads-auth-code-verifier');}
      if(q.get('error')){L.removeItem('heads-auth-code-verifier');return {error:{message:q.get('error_description')||'x'}};}
      return {error:null};},
    async token(){const s=L.getItem('heads-auth');return s?JSON.parse(s).access_token:null;},
    async signIn(redirectTo){window.__redirectTo=redirectTo;sessionStorage.setItem('__redirectTo',redirectTo);L.setItem('heads-auth-code-verifier','v');
      const g=sessionStorage.getItem('__google')||'good:tok-u1';
      setTimeout(()=>{location.href=redirectTo+(g==='cancel'?'?error=access_denied&error_description=The+user+denied':'?code='+g.split(':')[1]);},50);},
    async signOut(){L.removeItem('heads-auth');}};}});`;

async function open(b,S,{phone,w,h,lang='es',fake=true,init}={}){
  const ctx=await b.newContext(phone?{viewport:{width:w||844,height:h||390},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:w||960,height:h||540}});
  await ctx.route('**/api/**',S.handle);
  ctx.reqs=[];ctx.on('request',r=>ctx.reqs.push({u:r.url(),t:Date.now()}));
  await ctx.addInitScript(l=>{window.__rankOn=1;window.__lang=l;window.alert=window.confirm=window.prompt=()=>{window.__dialog=(window.__dialog||0)+1;return false;};},lang);
  if(fake)await ctx.addInitScript(FAKE);
  if(init)await ctx.addInitScript(init);
  const p=await ctx.newPage();p.errs=[];
  p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',d=>{p.errs.push('dialog: '+d.message());d.dismiss();});
  p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});
  await p.goto(BASE+'/test.html');return p;}
const ready=p=>p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});
async function play(p,phone){await ready(p);await p.evaluate(ph=>{document.getElementById(ph?'mmGo':'play').click();},phone);
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});await p.evaluate(()=>{window.__noSpawn=1;});}
// end a game with a score; waits for the run token first (the end plate needs it to offer saving)
async function finish(p,S,score=4321,secs=640){for(let i=0;i<100&&!count(S,'/api/run');i++)await p.waitForTimeout(50);
  await p.waitForTimeout(400); // the run token (POST /api/run at the start of the game) is in
  await p.evaluate(([sc,s])=>{__T.score=Math.round(sc*0.7);__T.pts=sc-Math.round(sc*0.7);__T.playT=s;__MUS().endGame(false,'dead');},[score,secs]);
  await p.waitForFunction(()=>!document.getElementById('end').hidden,null,{timeout:30000});}
const rankBox=p=>p.waitForFunction(()=>{const b=document.getElementById('rankBox');return !b.hidden&&getComputedStyle(b).opacity>0.99;},null,{timeout:30000}).catch(()=>{});
const plate=p=>p.evaluate(()=>{const g=id=>document.getElementById(id),btn=g('saveBtn'),r=btn.getBoundingClientRect();
  const hit=el=>{if(!el||el.hidden)return false;const q=el.getBoundingClientRect();const x=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return !!x&&(x===el||el.contains(x));};
  return {box:!g('rankBox').hidden,h:g('rankH').textContent,msg:[...g('rankMsg').querySelectorAll('span')].map(s=>s.textContent),rows:g('rankList').querySelectorAll('li:not(.gap)').length,
    me:(g('rankList').querySelector('li.me span')||{}).textContent||null,btn:!btn.hidden,btnT:btn.querySelector('b').textContent,btnS:btn.querySelector('small').textContent,btnHit:hit(btn),
    btnBox:[r.left,r.top,r.width,r.height].map(Math.round),bar:!g('acctBar').hidden,nick:g('acctNick').textContent,out:!g('acctOut').hidden,del:!g('acctDel').hidden,delHit:hit(g('acctDel')),
    priv:g('acctPriv').getAttribute('href'),again:hit(g('again')),W:innerWidth,H:innerHeight,inside:(()=>{const e=g('endBox').getBoundingClientRect();return e.left>=-1&&e.top>=-1&&e.right<=innerWidth+1&&e.bottom<=innerHeight+1;})()};});
const scr=p=>p.evaluate(()=>{const a=document.getElementById('acct'),g=id=>document.getElementById(id),q=s=>a.querySelector(s);
  return {open:!a.hidden,s:a.dataset.s,t:(g('acT').getAttribute('aria-label')||''),txt:g('acS').innerText.trim(),go:g('acGo').hidden?null:g('acGo').textContent.trim(),no:g('acNo').hidden?null:g('acNo').textContent.trim(),
    err:g('acErr').textContent,l1:g('acL1').hidden?'':g('acL1').textContent,l2:g('acL2').hidden?'':g('acL2').textContent,rows:g('acList').querySelectorAll('li:not(.gap)').length,me:(q('#acList li.me span')||{}).textContent||null,
    inside:(()=>{const e=g('acBox').getBoundingClientRect();return e.left>=-1&&e.top>=-1&&e.right<=innerWidth+1&&e.bottom<=innerHeight+1;})(),
    cut:[g('acS'),g('acHint'),g('acErr'),q('.acRules'),g('acL1'),g('acL2')].some(x=>x&&!x.hidden&&x.offsetParent&&x.scrollWidth>x.clientWidth+1)};});
const waitScr=(p,s,ms=30000)=>p.waitForFunction(s=>{const a=document.getElementById('acct');return !a.hidden&&a.dataset.s===s;},s,{timeout:ms}).then(()=>true,()=>false);
const settle=p=>p.waitForTimeout(700); // the screens come in with a short animation
async function snap(p,name){await p.evaluate(()=>{window.__noRender=1;});await p.waitForTimeout(250); // the 3D scene stays as it is (the screenshot is quick even without a GPU)
  await p.screenshot({path:shot(name),timeout:240000});await p.evaluate(()=>{window.__noRender=0;});}
const nickTry=async(p,v,phone)=>{await p.fill('#acIn',v);if(phone)await p.tap('#acGo');else await p.click('#acGo');await p.waitForTimeout(400);
  await p.waitForFunction(()=>!document.getElementById('acct').classList.contains('busy'),null,{timeout:15000}).catch(()=>{});};
const clickSave=async(p,phone)=>{const nav=p.waitForNavigation({timeout:60000});if(phone)await p.tap('#saveBtn');else await p.click('#saveBtn');await nav;};

(async()=>{
  const b=await chromium.launch({args:ARGS});
  // ================= 1) PC, Spanish =================
  console.log('1) PC 960x540, Spanish: guest -> Google -> nickname -> saved -> auto-save -> sign out -> again -> delete');
  let S=server(),p=await open(b,S,{});
  await play(p,false);
  const ctx=p.context();
  ok(!ctx.reqs.some(r=>/\/js\/sb-[^/]*\.js/.test(r.u)||/supabase\.co/.test(r.u)),'no login code and no Supabase request while loading and playing');
  ok(count(S,'/api/auth')===0,'/api/auth not asked before the end plate');
  await finish(p,S,4321,640);await rankBox(p);await p.waitForTimeout(600);
  let P=await plate(p);
  ok(P.box&&P.h==='RANKING DE CAPITANES · TEMPORADA 1'&&P.rows===5,'guest end plate: the season box with the top 5',P);
  ok(P.btn&&P.btnT==='GUARDAR MI PUNTUACIÓN'&&P.btnS==='con Google'&&P.btnHit,'GUARDAR MI PUNTUACIÓN · con Google, and it answers where it is drawn',P);
  ok(P.again&&P.inside,'REINTENTAR still answers, the whole plate is on screen',P);
  ok(P.bar&&!P.out&&!P.del&&P.priv==='privacidad/','guest: only the privacy link under it (no Salir / Borrar)',P);
  ok(count(S,'/api/auth')===1&&count(S,'/api/me')===0,'the end plate asked /api/auth once (to know the login is configured), no session calls');
  await snap(p,'cuentas_end_guest_pc_es.png');
  await clickSave(p,false);
  // back from Google
  ok(await waitScr(p,'nick'),'back from Google: the nickname screen over the menu');
  let st=await p.evaluate(()=>({url:location.search,pend:JSON.parse(localStorage.getItem('heads_pending_run')||'null'),go:localStorage.getItem('heads_auth_go'),sess:!!localStorage.getItem('heads-auth'),redir:sessionStorage.getItem('__redirectTo'),state:__T&&__T.state,menu:!document.getElementById('menu').hidden,lp:document.getElementById('langPick').hidden}));
  ok(st.url===''&&!st.go&&st.sess,'the address is cleaned (no ?code=), the session kept on the device',st);
  ok(st.redir===BASE+'/test.html','redirectTo built from location (origin + path), no fixed domain',st.redir);
  ok(st.pend&&st.pend.score===4321&&st.pend.round===1&&typeof st.pend.token==='string'&&st.pend.plat==='pc'&&st.pend.lang==='es'&&st.pend.stats&&st.pend.stats.kills===0&&st.pend.secs===640,'the run waited on the device: token, score, round, stats, game clock',st.pend);
  ok(st.menu&&st.state==='menu'&&st.lp,'over the menu, no language picker again',st);
  let A=await scr(p);
  ok(A.t==='ELIGE TU APODO'&&/único y no se puede cambiar/.test(A.txt)&&A.go==='GUARDAR'&&A.no==='AHORA NO'&&A.inside&&!A.cut,'nickname screen: title, text, GUARDAR / AHORA NO, on screen, nothing cut',A);
  const rules=await p.evaluate(()=>[...document.querySelectorAll('#acNick .acRules a')].map(a=>[a.textContent,a.getAttribute('href'),a.target]));
  ok(JSON.stringify(rules)===JSON.stringify([['privacidad','privacidad/','_blank'],['normas del ranking','privacidad/#normas','_blank']]),'«Al guardar aceptas la privacidad y las normas del ranking», links open the privacy page (new tab)',rules);
  ok(await p.evaluate(()=>document.activeElement===document.getElementById('acIn')),'PC: the field has the focus');
  await settle(p);await snap(p,'cuentas_nick_pc_es.png');
  let n0=count(S,'/api/nick');
  await nickTry(p,'ab');A=await scr(p);ok(/de 3 a 12/i.test(A.err)&&count(S,'/api/nick')===n0,'«ab»: format message, checked here (no request)',A.err);
  await nickTry(p,'hola mundo');A=await scr(p);ok(/sin espacios/.test(A.err)&&count(S,'/api/nick')===n0,'«hola mundo»: no spaces',A.err);
  await nickTry(p,'a.b');A=await scr(p);ok(/al menos 3/.test(A.err),'«a.b»: at least 3 letters or digits',A.err);
  await nickTry(p,'orion');A=await scr(p);ok(/ya es de otro capitán/.test(A.err)&&last(S,'/api/nick').body.nick==='ORION'&&last(S,'/api/nick').body.accept===true,'«orion»: taken (server), sent upper case with accept:true',A.err);
  await nickTry(p,'puta');A=await scr(p);ok(/no está permitido/.test(A.err),'bad word: not allowed',A.err);
  await nickTry(p,'heads_fan');A=await scr(p);ok(/reservado/.test(A.err),'reserved',A.err);
  await settle(p);await snap(p,'cuentas_nick_error_pc_es.png');
  // keys while the screens are open: never the game (Enter would start it from the menu)
  await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.keyboard.press('Enter');await p.waitForTimeout(300);
  let k=await p.evaluate(()=>({state:__T.state,open:!document.getElementById('acct').hidden,menu:!document.getElementById('menu').hidden}));
  ok(k.state==='menu'&&k.open&&k.menu,'Enter with the screen open does not start the game',k);
  await p.fill('#acIn','Sántí');await p.focus('#acIn');await p.keyboard.press('Enter');
  ok(await waitScr(p,'saved'),'Enter in the field saves the nickname, then the run');
  A=await scr(p);const sv=last(S,'/api/save');
  ok(A.t==='¡PUNTUACIÓN GUARDADA!'&&A.l1==='¡NUEVO RÉCORD!'&&/^Puesto #\d+ de \d+ capitanes$/.test(A.l2)&&A.rows>=5&&A.me==='SÁNTÍ'&&/CAPITÁN\s+SÁNTÍ/.test(A.txt),'result: ¡PUNTUACIÓN GUARDADA!, ¡NUEVO RÉCORD!, place, top with me, CAPITÁN SÁNTÍ',A);
  ok(sv.auth==='tok-u1'&&sv.body.token===st.pend.token&&sv.body.score===4321&&sv.body.round===1&&sv.body.secs===640&&sv.body.plat==='pc'&&sv.body.lang==='es','saved with the Bearer token, the run token, score, round, game clock',sv);
  ok(await p.evaluate(()=>!localStorage.getItem('heads_pending_run')&&localStorage.getItem('heads_capitan')==='SÁNTÍ'),'the pending run is gone (claimed once), the nickname remembered for the plate');
  ok(A.inside&&!A.cut,'result on screen, nothing cut',A);
  await settle(p);await snap(p,'cuentas_result_pc_es.png');
  await p.keyboard.press('Enter');await p.waitForTimeout(500);
  st=await p.evaluate(()=>({open:!document.getElementById('acct').hidden,state:__T.state,menu:!document.getElementById('menu').hidden,on:document.body.classList.contains('acctOn')}));
  ok(!st.open&&st.state==='menu'&&st.menu&&!st.on,'Enter on SEGUIR closes the screen and does not start the game: back to the menu',st);
  // next game: saved by itself
  await play(p,false);await finish(p,S,2500,400);await rankBox(p);
  await p.waitForFunction(()=>!/Guardando/.test(document.getElementById('rankMsg').textContent),null,{timeout:20000}).catch(()=>{});
  P=await plate(p);const sv2=last(S,'/api/save');
  ok(!P.btn&&P.bar&&P.nick==='SÁNTÍ'&&P.out&&P.del&&P.delHit,'signed in: no button, CAPITÁN SÁNTÍ · Salir · Borrar mi cuenta',P);
  ok(sv2.auth==='tok-u1'&&sv2.body.score===2500&&count(S,'/api/save')===2,'the run saved by itself at the end of the game',sv2);
  ok(P.msg[0]==='Tu mejor de la temporada: 4.321 · ronda 1'&&/^Puesto #\d+ de \d+ capitanes$/.test(P.msg[1])&&P.me==='SÁNTÍ','not a record: season best and place, my line in the top',P.msg);
  await snap(p,'cuentas_end_signed_pc_es.png');
  // sign out
  await p.click('#acctOut');await p.waitForTimeout(300);P=await plate(p);
  ok(P.msg[0]==='Sesión cerrada.'&&!P.out&&!P.del&&await p.evaluate(()=>!localStorage.getItem('heads-auth')&&!localStorage.getItem('heads_capitan')),'Salir: session and nickname forgotten on this device',P);
  // guest again -> Google -> an existing player saves at once
  await p.click('#again');await p.waitForFunction(()=>__T.state==='play',null,{timeout:30000});await p.evaluate(()=>{window.__noSpawn=1;});
  await finish(p,S,9000,800);await rankBox(p);await p.waitForFunction(()=>!document.getElementById('saveBtn').hidden,null,{timeout:20000});
  await clickSave(p,false);
  ok(await waitScr(p,'saved'),'already has a nickname: straight to the saved run');
  A=await scr(p);ok(A.l1==='¡NUEVO RÉCORD!'&&/CAPITÁN\s+SÁNTÍ/.test(A.txt),'9.000 is a new record',A);
  const used=last(S,'/api/save').body;
  // the same run again (claimed once): put it back and come back from Google again
  await p.keyboard.press('Escape');await p.waitForTimeout(200);
  await p.evaluate(u=>{localStorage.setItem('heads_pending_run',JSON.stringify({...u,at:Date.now()}));localStorage.setItem('heads_auth_go',String(Date.now()));localStorage.setItem('heads-auth-code-verifier','v');},used);
  await p.goto(BASE+'/test.html?code=tok-u1');
  ok(await waitScr(p,'used'),'the same run token again -> YA ESTABA GUARDADA');
  ok(await p.evaluate(()=>!localStorage.getItem('heads_pending_run')),'and the pending run is gone');
  await p.click('#acGo');await p.waitForTimeout(300);
  // delete the account
  await play(p,false);await finish(p,S,1200,300);await rankBox(p);await p.waitForFunction(()=>!document.getElementById('acctDel').hidden,null,{timeout:20000});
  const f0=count(S,'/api/forget');
  await p.click('#acctDel');ok(await waitScr(p,'confirm'),'Borrar mi cuenta: the in-game confirmation');
  A=await scr(p);ok(A.t==='¿BORRAR TU CUENTA?'&&A.go==='BORRAR'&&A.no==='CANCELAR'&&/No se puede deshacer/.test(A.txt)&&/CAPITÁN\s+SÁNTÍ/.test(A.txt),'¿BORRAR TU CUENTA?, BORRAR (red) / CANCELAR',A);
  ok(await p.evaluate(()=>document.getElementById('acGo').classList.contains('red')),'the delete button is red');
  await settle(p);await snap(p,'cuentas_delete_pc_es.png');
  await p.keyboard.press('Escape');await p.waitForTimeout(300);
  ok(!(await scr(p)).open&&count(S,'/api/forget')===f0,'Escape = CANCELAR: closed, nothing deleted');
  await p.click('#acctDel');await waitScr(p,'confirm');await p.click('#acGo');
  ok(await waitScr(p,'gone'),'BORRAR -> CUENTA BORRADA');
  const fg=last(S,'/api/forget');ok(fg&&fg.auth==='tok-u1'&&fg.m==='POST','POST /api/forget with the session',fg);
  await p.click('#acGo');await p.waitForTimeout(300);P=await plate(p);
  ok(!P.out&&!P.del&&P.msg[0]==='Cuenta borrada.'&&await p.evaluate(()=>!localStorage.getItem('heads-auth')&&!localStorage.getItem('heads_capitan')),'signed out, the plate says Cuenta borrada.',P);
  ok(!S.players.u1,'the fake server has no player u1 left');
  ok(!(await p.evaluate(()=>window.__dialog||0)),'no window.alert / confirm / prompt used');
  ok(!p.errs.length,'no page errors (PC)',p.errs);
  await p.context().close();

  // ================= 2) PC: cancelled, expired, not configured, ranking down =================
  console.log('2) PC: Google cancelled, run expired, login not configured, ranking down');
  S=server();p=await open(b,S,{init:()=>sessionStorage.setItem('__google','cancel')});
  await play(p,false);await finish(p,S,3000,500);await rankBox(p);await p.waitForFunction(()=>!document.getElementById('saveBtn').hidden,null,{timeout:20000});
  await clickSave(p,false);
  ok(await waitScr(p,'fail'),'cancelled at Google -> NO SE HA INICIADO SESIÓN');
  A=await scr(p);ok(A.go==='PROBAR OTRA VEZ'&&A.no==='AHORA NO'&&/sigue guardada/.test(A.txt),'PROBAR OTRA VEZ / AHORA NO, the run still waits',A);
  ok(await p.evaluate(()=>location.search===''&&!!localStorage.getItem('heads_pending_run')),'address cleaned, the run kept');
  await settle(p);await snap(p,'cuentas_fail_pc_es.png');
  await p.click('#acNo');await p.waitForTimeout(300);
  ok(await p.evaluate(()=>document.getElementById('acct').hidden&&!localStorage.getItem('heads_pending_run')),'AHORA NO: closed, the run dropped');
  // expired: a run 5 h old
  await p.evaluate(()=>{sessionStorage.setItem('__google','good:tok-u2');localStorage.setItem('heads_pending_run',JSON.stringify({token:'x.y.z',score:5,round:1,stats:{},secs:60,plat:'pc',lang:'es',at:Date.now()-5*3600e3}));
    localStorage.setItem('heads_auth_go','1');localStorage.setItem('heads-auth-code-verifier','v');});
  await p.goto(BASE+'/test.html?code=tok-u2');
  ok(await waitScr(p,'nick'),'u2 has no nickname yet');await nickTry(p,'LUNA_2');
  ok(await waitScr(p,'expired'),'a run older than 4 h -> LA PARTIDA HA CADUCADO (nothing sent)');
  ok(count(S,'/api/save')===0,'(no save request)');
  await p.click('#acGo');await p.context().close();
  // not configured / ranking down
  S=server();S.authOff=true;p=await open(b,S,{});await play(p,false);await finish(p,S,3000,500);await rankBox(p);await p.waitForTimeout(800);
  P=await plate(p);ok(P.box&&P.rows===5&&!P.btn,'/api/auth 503: the top, no button',P);ok(!p.errs.length,'no page errors',p.errs);
  await p.context().close();
  S=server();S.scoresOff=true;p=await open(b,S,{});await play(p,false);await finish(p,S,3000,500);await p.waitForTimeout(2500);
  P=await plate(p);ok(!P.box&&!P.btn&&P.again,'/api/scores 503: no box at all, REINTENTAR fine',P);ok(!p.errs.length,'no page errors',p.errs);
  await p.context().close();

  // ================= 3) phone, English =================
  console.log('3) phone 844x390, English, touch');
  S=server();p=await open(b,S,{phone:true,lang:'en'});
  await play(p,true);await finish(p,S,6789,700);await rankBox(p);await p.waitForFunction(()=>!document.getElementById('saveBtn').hidden,null,{timeout:20000});await p.waitForTimeout(800);
  P=await plate(p);
  ok(P.h==='CAPTAINS LEADERBOARD · SEASON 1'&&P.btnT==='SAVE MY SCORE'&&P.btnS==='with Google'&&P.btnHit&&P.inside,'phone EN: SAVE MY SCORE · with Google, where it is drawn, plate on screen',P);
  ok(P.btnBox[3]>=26&&P.btnBox[2]>=150,'phone: the button is big enough to tap ('+P.btnBox[2]+'x'+P.btnBox[3]+' px)',P.btnBox);
  ok(P.priv==='privacy/','the privacy link goes to the English page',P.priv);
  await snap(p,'cuentas_end_guest_phone_en.png');
  await clickSave(p,true);
  ok(await waitScr(p,'nick'),'phone: back from Google, nickname screen');
  A=await scr(p);const en=await p.evaluate(()=>({fs:parseFloat(getComputedStyle(document.getElementById('acIn')).fontSize),rules:document.querySelector('#acNick .acRules').innerHTML,hint:document.getElementById('acHint').textContent}));
  ok(A.t==='CHOOSE YOUR NICKNAME'&&A.go==='SAVE'&&A.no==='NOT NOW'&&/can't be changed/.test(A.txt)&&/3 to 12/.test(en.hint),'nickname screen in English',{A,en});
  ok(/By saving you accept the <a[^>]*href="privacy\/"[^>]*>privacy policy<\/a> and the <a[^>]*href="privacy\/#rules"[^>]*>leaderboard rules<\/a>/.test(en.rules),'rules line in English, links to privacy/ and privacy/#rules',en.rules);
  ok(en.fs>=16,'touch: the field is '+en.fs+' px (iOS does not zoom)');
  ok(A.inside&&!A.cut,'on screen, nothing cut',A);
  await settle(p);await snap(p,'cuentas_nick_phone_en.png');
  await p.tap('#acIn');await p.keyboard.type('nova');await p.tap('#acGo');await p.waitForTimeout(500);
  A=await scr(p);ok(/belongs to another captain/.test(A.err),'taken, in English',A.err);
  await p.fill('#acIn','');await p.keyboard.type('capi_7');await p.tap('#acGo');
  ok(await waitScr(p,'saved'),'saved');
  A=await scr(p);ok(A.t==='SCORE SAVED!'&&A.l1==='NEW RECORD!'&&/^Rank #\d+ of \d+ captains$/.test(A.l2)&&A.me==='CAPI_7'&&/CAPTAIN\s+CAPI_7/.test(A.txt)&&A.inside&&!A.cut,'result in English: SCORE SAVED!, NEW RECORD!, Rank #N of M captains',A);
  await settle(p);await snap(p,'cuentas_result_phone_en.png');
  await p.tap('#acGo');await p.waitForTimeout(400);
  await play(p,true);await finish(p,S,1000,200);await rankBox(p);
  await p.waitForFunction(()=>!/Saving/.test(document.getElementById('rankMsg').textContent),null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(600);
  P=await plate(p);ok(P.msg[0]==='Your season best: 6.789 · round 1'&&/^Rank #\d+ of \d+ captains$/.test(P.msg[1])&&P.nick==='CAPI_7'&&P.delHit&&P.inside,'phone: saved by itself, season best and place, CAPTAIN CAPI_7 · Sign out · Delete my account',P);
  ok(await p.evaluate(()=>[...document.querySelectorAll('#acctBar .abCap,#acctOut,#acctDel,#acctPriv')].map(e=>e.textContent).join('|'))==='CAPTAIN|Sign out|Delete my account|Privacy','account line in English');
  await snap(p,'cuentas_end_signed_phone_en.png');
  await p.tap('#acctDel');await waitScr(p,'confirm');await settle(p);A=await scr(p);
  ok(A.t==='DELETE YOUR ACCOUNT?'&&A.go==='DELETE'&&A.no==='CANCEL'&&A.inside,'phone: delete confirmation in English, on screen',A);
  await snap(p,'cuentas_delete_phone_en.png');
  await p.tap('#acNo');await p.waitForTimeout(300);
  ok(!p.errs.length,'no page errors (phone)',p.errs);
  await p.context().close();

  // ================= 4) quick looks =================
  console.log('4) PC English and phone Spanish guest end plates');
  S=server();p=await open(b,S,{lang:'en'});await play(p,false);await finish(p,S,2222,300);await rankBox(p);await p.waitForFunction(()=>!document.getElementById('saveBtn').hidden,null,{timeout:20000});await p.waitForTimeout(800);
  P=await plate(p);ok(P.btnT==='SAVE MY SCORE'&&P.btnHit&&P.inside,'PC EN guest plate',P);await snap(p,'cuentas_end_guest_pc_en.png');await p.context().close();
  S=server();p=await open(b,S,{phone:true,lang:'es'});await play(p,true);await finish(p,S,2222,300);await rankBox(p);await p.waitForFunction(()=>!document.getElementById('saveBtn').hidden,null,{timeout:20000});await p.waitForTimeout(800);
  P=await plate(p);ok(P.btnT==='GUARDAR MI PUNTUACIÓN'&&P.btnHit&&P.inside,'phone ES guest plate',P);await snap(p,'cuentas_end_guest_phone_es.png');
  ok(!p.errs.length,'no page errors',p.errs);await p.context().close();

  // ================= 5) the real login chunk against a fake Supabase Auth =================
  console.log('5) real @supabase/auth-js (src/cuentas/sb.js), PKCE against a fake Supabase Auth');
  S=server();const AU={};
  p=await open(b,S,{fake:false});const c5=p.context();
  await c5.route(SB+'/**',async route=>{const rq=route.request(),u=new URL(rq.url());
    if(u.pathname==='/auth/v1/authorize'){AU.authorize=Object.fromEntries(u.searchParams);AU.headers=rq.headers();
      return route.fulfill({status:302,headers:{location:u.searchParams.get('redirect_to')+'?code=REALCODE'}});}
    if(u.pathname==='/auth/v1/token'&&u.searchParams.get('grant_type')==='pkce'){let bd={};try{bd=JSON.parse(rq.postData()||'{}');}catch(_){}AU.token=bd;AU.tokenHeaders=rq.headers();
      const now=Math.floor(Date.now()/1000);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'real-tok',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'refresh-1',
        user:{id:'00000000-0000-4000-8000-000000000003',aud:'authenticated',role:'authenticated',email:'tester@gmail.com',app_metadata:{provider:'google',providers:['google']},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}})});}
    AU.other=(AU.other||[]).concat(rq.method()+' '+u.pathname);return route.fulfill({status:404,contentType:'application/json',body:'{}'});});
  await play(p,false);
  ok(!c5.reqs.some(r=>/\/js\/sb-[^/]*\.js/.test(r.u)),'the login chunk is not loaded while playing');
  const tEnd=Date.now();await finish(p,S,3333,500);await rankBox(p);await p.waitForFunction(()=>!document.getElementById('saveBtn').hidden,null,{timeout:20000});await p.waitForTimeout(500);
  const chunk=c5.reqs.filter(r=>/\/js\/sb-[^/]*\.js/.test(r.u));
  ok(chunk.length>=1&&chunk[0].t>=tEnd,'the login chunk comes only with the end plate (preloaded for the click)',chunk.map(c=>c.u));
  await clickSave(p,false);
  ok(await waitScr(p,'nick',60000),'real PKCE round trip: back with a session, nickname screen');
  const ch=AU.authorize||{},ver=(AU.token||{}).code_verifier||'';
  ok(ch.provider==='google'&&ch.redirect_to===BASE+'/test.html'&&ch.code_challenge_method==='s256'&&ch.prompt==='select_account','authorize: Google, back to the game (from location), S256 challenge, choose the account',ch);
  ok(AU.token&&AU.token.auth_code==='REALCODE'&&crypto.createHash('sha256').update(ver).digest('base64url')===ch.code_challenge,'the code is exchanged with the verifier that matches the challenge',AU.token);
  ok(AU.tokenHeaders&&AU.tokenHeaders.apikey==='sb_publishable_TEST','the exchange carries the publishable key from /api/auth',AU.tokenHeaders&&AU.tokenHeaders.apikey);
  st=await p.evaluate(()=>{let s=null;try{s=JSON.parse(localStorage.getItem('heads-auth')||'null');}catch(_){}return {url:location.search,tok:s&&s.access_token,ver:Object.keys(localStorage).filter(k=>/code-verifier/.test(k))};});
  ok(st.url===''&&st.tok==='real-tok'&&!st.ver.length,'session stored under heads-auth, verifier removed, address cleaned',st);
  ok(last(S,'/api/me').auth==='real-tok','/api/me with the real access token');
  await p.fill('#acIn','REAL.ONE');await p.click('#acGo');
  ok(await waitScr(p,'saved'),'saved with the real login');
  ok(!AU.other,'no other Supabase request',AU.other);
  ok(!p.errs.length,'no page errors',p.errs);
  await p.context().close();
  await b.close();
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
