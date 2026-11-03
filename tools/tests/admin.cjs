// Statistics page (v81): public/admin.html (served at /admin on Netlify) with GET /api/admin/stats answered by the test (the realistic month of
// tools/tests/metrics-stats-sample.json, made by metrics-sql.cjs from the real SQL). Run on any build:
//   npm run build:test && PORT=8792 tools/run-test.sh dist-test tools/tests/admin.cjs
// What it checks (screenshots go to tools/tests/out/admin_*.png):
//   - not indexed (meta robots, X-Robots-Tag + /admin rewrite in netlify.toml), no request to another site, no page errors
//   - login: a wrong password says so and is not kept; the right one goes in the x-admin-key header and lives in sessionStorage only; Salir forgets it
//   - every section renders with numbers (no NaN / undefined), the funnel has one row per round, the errors table one row per error
//   - range and platform buttons ask the server again (range=30d&platform=touch...) and are remembered on reload
//   - empty period (no data yet), server not configured (503) and too many tries (429) show clear messages
//   - phone width (390 portrait, 844 landscape): nothing wider than the screen
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const {BASE,ARGS,shot,ROOT}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,500):''));if(!c)bad++;};
const SAMPLE=JSON.parse(fs.readFileSync(path.join(__dirname,'metrics-stats-sample.json'),'utf8'));
const PASS='dorado-2026';
const EMPTY={summary:{visits:0,sessions:0,players:0,returning:0,games:0,games_pc:0,games_touch:0,secs_total:0,secs_avg:null,left_no_play:0,consent_yes:0,consent_no:0,consent_unset:0,test_games:2},
  daily:[],funnel:[],last_round:{all:null,pc:null,touch:null},round_secs:[],causes:[],countries:[],cities:[],platforms:{},os:{},browsers:{},screens:{},langs:{},
  installed:{yes:0,of:0,touch_yes:0,touch_of:0},quality:{},fps:{pc:null,touch:null,n:0},load:{pc_p50:null,pc_p90:null,touch_p50:null,touch_p90:null,not_ready:0},
  film:{},film_skip_secs:null,tutorial:{},tutorial_step:{},errors:[],quits:[]};
const TITLES=['Resumen','Hasta dónde llegan','De qué mueren','Abandonos','Desde dónde','Con qué juegan','Película y tutorial','Errores'];

async function page(b,opt,mode){
  const ctx=await b.newContext(opt);const p=await ctx.newPage();p.errs=[];p.calls=[];p.mode=mode||'data';p.outside=[];
  p.on('pageerror',e=>p.errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/status of 40[13]|status of 429|status of 503/.test(m.text()))p.errs.push(m.text());});
  p.on('request',r=>{const u=new URL(r.url());if(u.origin!==new URL(BASE).origin)p.outside.push(r.url());});
  await p.route('**/api/admin/stats*',r=>{const u=new URL(r.request().url()),key=r.request().headers()['x-admin-key'];p.calls.push({q:u.search,key});
    if(p.mode==='503')return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'métricas no configuradas'})});
    if(p.mode==='429')return r.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'demasiados intentos, espera unos minutos'})});
    if(key!==PASS)return r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'contraseña incorrecta'})});
    const d=p.mode==='empty'?EMPTY:SAMPLE;
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({range:u.searchParams.get('range'),platform:u.searchParams.get('platform'),at:new Date().toISOString(),...d})});});
  await p.goto(BASE+'/admin.html');return p;}
const login=async(p,pw)=>{await p.fill('#pw',pw);await p.click('#login button[type=submit]');await p.waitForTimeout(400);};
const loggedIn=p=>p.waitForFunction(()=>!document.getElementById('app').hidden&&document.querySelectorAll('#out section').length>0,null,{timeout:15000}).then(()=>true,()=>false);
const look=p=>p.evaluate(()=>{let t=document.getElementById('out').innerText;for(const c of document.querySelectorAll('#out code'))t=t.replace(c.innerText,''); // (the error messages themselves may say undefined)
  return {titles:[...document.querySelectorAll('#out section h2')].map(h=>h.textContent),text:t,
  funnel:document.querySelectorAll('.funnel .l').length,errRows:document.querySelectorAll('.tbl tbody tr').length,
  over:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
  pressed:[...document.querySelectorAll('.seg button[aria-pressed=true]')].map(b=>b.textContent),
  fonts:document.fonts.check('800 16px TekturE')&&document.fonts.check('600 14px TitilliumH'),logo:(i=>i&&i.complete&&i.naturalWidth>0)(document.querySelector('header img'))};});

(async()=>{
  const b=await chromium.launch({args:ARGS});
  console.log('1) the page itself');
  const toml=fs.readFileSync(path.join(ROOT,'netlify.toml'),'utf8');
  ok(/from = "\/admin"\s+to = "\/admin.html"\s+status = 200/.test(toml)&&/for = "\/admin\*"[\s\S]*?X-Robots-Tag = "noindex/.test(toml),'netlify.toml: /admin -> admin.html, X-Robots-Tag noindex');
  let p=await page(b,{viewport:{width:1280,height:720}});
  ok(await p.evaluate(()=>/noindex/.test(document.querySelector('meta[name=robots]').content)),'meta robots noindex');
  ok(await p.evaluate(()=>!document.getElementById('login').hidden&&document.getElementById('app').hidden),'starts at the login, nothing else shown');
  ok(!(await p.evaluate(()=>[...document.scripts].some(s=>s.src))),'no outside script (everything inline)');

  console.log('2) login');
  await login(p,'no-es-esta');
  let st=await p.evaluate(()=>({err:document.getElementById('loginErr').textContent,app:!document.getElementById('app').hidden,kept:sessionStorage.getItem('heads_admin_key')}));
  ok(st.err==='Contraseña incorrecta.'&&!st.app&&!st.kept,'wrong password: clear message, not kept',st);
  await p.screenshot({path:shot('admin_login_pc.png')});
  await login(p,PASS);
  ok(await loggedIn(p),'right password: the statistics show');
  ok(p.calls.at(-1).key===PASS&&p.calls.at(-1).q==='?range=7d&platform=all','asks /api/admin/stats?range=7d&platform=all with the x-admin-key header',p.calls.at(-1));
  ok(await p.evaluate(()=>sessionStorage.getItem('heads_admin_key')==='dorado-2026'&&!localStorage.length&&!document.cookie),'password in sessionStorage only (no localStorage, no cookie)');
  await p.waitForTimeout(300);
  let L=await look(p);
  ok(JSON.stringify(L.titles)===JSON.stringify(TITLES),'all 8 sections',L.titles);
  ok(!/NaN|undefined|\[object/.test(L.text),'no NaN / undefined in the page');
  ok(L.funnel===SAMPLE.funnel.length,'funnel: one row per round ('+L.funnel+')');
  ok(L.errRows===SAMPLE.errors.length,'errors: one row per error ('+L.errRows+')');
  ok(/España/.test(L.text)&&/Valencia/.test(L.text)&&/Ronda 14/.test(L.text)&&/Traje roto/.test(L.text)&&/Saltada/.test(L.text)&&/Samsung Internet/.test(L.text),'countries by name, cities, rounds, causes, film, browsers');
  ok(L.text.includes(SAMPLE.summary.visits.toLocaleString('es-ES'))&&L.text.includes('Partidas de prueba'),'summary numbers and the test-game count');
  ok(L.fonts&&L.logo,'the game fonts and logo load from the site itself',{fonts:L.fonts,logo:L.logo});
  ok(L.over<=0,'nothing wider than the window ('+L.over+')');
  await p.screenshot({path:shot('admin_pc.png'),fullPage:true});

  console.log('3) range and platform');
  await p.click('#range button[data-v="30d"]');await p.waitForTimeout(300);await p.click('#plat button[data-v="touch"]');await p.waitForTimeout(500);
  ok(p.calls.at(-1).q==='?range=30d&platform=touch','30 días + Móvil ask again with range=30d&platform=touch',p.calls.at(-1));
  L=await look(p);ok(JSON.stringify(L.pressed)===JSON.stringify(['30 días','Móvil']),'the pressed buttons show it',L.pressed);
  ok(!/NaN|undefined/.test(L.text)&&L.funnel===SAMPLE.funnel.length,'one platform: still renders');
  await p.screenshot({path:shot('admin_pc_movil.png'),fullPage:true});
  await p.reload();ok(await loggedIn(p),'reload: still in (same tab)');
  L=await look(p);ok(JSON.stringify(L.pressed)===JSON.stringify(['30 días','Móvil'])&&p.calls.at(-1).q==='?range=30d&platform=touch','reload: remembers 30 días / Móvil',L.pressed);
  await p.click('#logout');await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!document.getElementById('login').hidden&&!sessionStorage.getItem('heads_admin_key')&&!document.getElementById('out').innerHTML),'Salir: back to the login, password forgotten, numbers cleared');

  console.log('4) empty period, server not configured, too many tries');
  p.mode='empty';await login(p,PASS);ok(await loggedIn(p),'empty data: renders');
  L=await look(p);ok(/Sin datos en este periodo/.test(L.text)&&/Ningún error/.test(L.text)&&!/NaN|undefined|Infinity/.test(L.text),'empty: "Sin datos" messages, no NaN / Infinity');
  await p.screenshot({path:shot('admin_empty.png'),fullPage:true});
  p.mode='503';await p.click('#reload');await p.waitForTimeout(500);
  st=await p.evaluate(()=>document.getElementById('state').textContent);ok(/SUPABASE_URL/.test(st)&&/ADMIN_PASSWORD/.test(st),'503: says which Netlify variables are missing',st);
  p.mode='429';await p.click('#reload');await p.waitForTimeout(500);
  st=await p.evaluate(()=>({err:document.getElementById('loginErr').textContent,login:!document.getElementById('login').hidden}));ok(st.login&&/espera/.test(st.err),'429: back to the login with "espera unos minutos"',st);
  ok(!p.errs.length,'no page errors (PC)',p.errs);ok(!p.outside.length,'no request to another site',p.outside);
  await p.context().close();

  console.log('5) phone');
  for(const [w,h] of [[390,844],[844,390]]){
    p=await page(b,{viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await p.evaluate(k=>sessionStorage.setItem('heads_admin_key',k),PASS);await p.reload();
    ok(await loggedIn(p),w+'x'+h+': in');await p.waitForTimeout(300);
    L=await look(p);ok(L.over<=0,w+'x'+h+': nothing wider than the screen ('+L.over+')');
    const tiny=await p.evaluate(()=>[...document.querySelectorAll('.seg button,.btn')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect()).filter(r=>r.height<32).length);
    ok(tiny===0,w+'x'+h+': buttons at least 32 px tall');
    // a full-page shot taller than ~8000 device pixels repeats the top with the software GPU: the page goes in parts of at most 3600 px
    const H=await p.evaluate(()=>document.documentElement.scrollHeight),V=Math.min(H,3600);await p.setViewportSize({width:w,height:V});
    for(let k=0,y=0;y<H;k++,y+=V){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(300);await p.screenshot({path:shot(`admin_phone_${w}x${h}_${k+1}.png`)});}
    ok(!p.errs.length,w+'x'+h+': no page errors',p.errs);
    await p.context().close();}
  await b.close();
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
