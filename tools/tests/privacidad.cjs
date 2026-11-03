// The privacy page and the ranking rules (v82): public/privacidad/index.html (Spanish) and public/privacy/index.html (English). Run on any build:
//   npm run build:test && PORT=8797 tools/run-test.sh dist-test tools/tests/privacidad.cjs
// What it checks (screenshots tools/tests/out/privacidad_*.png):
//   - both pages load with no script at all (static: reachable without login, as Google asks), title, the controller «Golden Heads» and
//     headsrescueadmin@gmail.com as the only email, no personal name, no fixed domain of the game anywhere (every link relative, apart from
//     the email and the Spanish data protection agency)
//   - what it must say: Google account id and email, nickname, runs, anonymous stats and consent, Supabase EU (Frankfurt), Netlify, Google,
//     retention, rights, how to delete (in-game button and email), the rules with fair play, one account per person, cheating = removal,
//     nickname rules, no official prizes; the rules have their own anchor (#normas / #rules) that the game links to
//   - the links between the two languages and back to the game work; the game's fonts and logo load from the site itself
//   - phone widths: nothing wider than the screen; the game links to the right page for its language (stats question, end plate, nickname)
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const {BASE,ARGS,shot,ROOT}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,600):''));if(!c)bad++;};
const PAGES=[['es','privacidad','normas',['identificador de tu cuenta de Google y tu email','apodo','partidas guardadas','Estadísticas anónimas','Nunca guardamos tu IP','Supabase','Fráncfort','Netlify','Google','Cuánto tiempo','Borrar mi cuenta','Juego limpio','Una cuenta por persona','cuenta queda fuera del ranking','de 3 a 12 letras','no hay premios oficiales','aepd.es']],
  ['en','privacy','rules',['Google account id and your email','nickname','saved runs','Anonymous stats','We never keep your IP','Supabase','Frankfurt','Netlify','Google','For how long','Delete my account','Fair play','One account per person','taken off the leaderboard','3 to 12 letters','no official prizes','aepd.es']]];

(async()=>{
  const b=await chromium.launch({args:ARGS});
  const toml=fs.readFileSync(path.join(ROOT,'netlify.toml'),'utf8');
  ok(/from = "\/privacidad"\s+to = "\/privacidad\/index.html"\s+status = 200/.test(toml)&&/from = "\/privacy"\s+to = "\/privacy\/index.html"\s+status = 200/.test(toml),'netlify.toml: /privacidad and /privacy');
  for(const [lang,dir,anchor,must] of PAGES){
    console.log(`${lang}: /${dir}/`);
    const ctx=await b.newContext({viewport:{width:1280,height:800}}),p=await ctx.newPage(),errs=[],outside=[];
    p.on('pageerror',e=>errs.push(e.message));p.on('request',r=>{const u=new URL(r.url());if(u.origin!==new URL(BASE).origin)outside.push(r.url());});
    const r=await p.goto(BASE+`/${dir}/`);ok(r&&r.status()===200,'200');
    const src=fs.readFileSync(path.join(ROOT,'public',dir,'index.html'),'utf8');
    const I=await p.evaluate(()=>({lang:document.documentElement.lang,title:document.title,text:document.body.textContent.replace(/\s+/g,' '),scripts:document.scripts.length,
      links:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')),anchor:[...document.querySelectorAll('section[id]')].map(s=>s.id),
      fonts:document.fonts.check('800 16px TekturE')&&document.fonts.check('600 14px TitilliumH'),logo:(i=>i&&i.complete&&i.naturalWidth>0)(document.querySelector('header img')),
      over:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}));
    await p.waitForTimeout(300);
    ok(I.lang===lang&&I.scripts===0,'lang="'+lang+'", no script',I.lang);
    ok(/HEADS/.test(I.title),'title: '+I.title);
    ok(/Golden Heads/.test(I.text)&&I.text.includes('headsrescueadmin@gmail.com'),'controller Golden Heads, contact headsrescueadmin@gmail.com');
    const emails=[...new Set(src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)||[])];ok(emails.length===1&&emails[0]==='headsrescueadmin@gmail.com','the only email is headsrescueadmin@gmail.com',emails);
    ok(!/netlify\.app|golden-heads|goldenheads\.|https?:\/\/(?!www\.aepd\.es)/i.test(src.replace(/<!--[\s\S]*?-->/g,'')),'no fixed domain: every link relative (only aepd.es outside)');
    ok(I.links.every(h=>/^(\.\.\/|mailto:headsrescueadmin@gmail\.com$|https:\/\/www\.aepd\.es$)/.test(h)),'links: ../ (the game and the other language), mailto, aepd.es',I.links);
    const miss=must.filter(m=>!I.text.includes(m));ok(!miss.length,'says what it must ('+must.length+' points)',miss);
    ok(I.anchor.includes(anchor),'the rules have their anchor #'+anchor,I.anchor);
    ok(I.fonts&&I.logo,'fonts and logo from the site itself',{f:I.fonts,l:I.logo});
    ok(I.over<=0,'nothing wider than the window');
    await p.screenshot({path:shot(`privacidad_${lang}_pc.png`),fullPage:true});
    ok(!errs.length&&!outside.length,'no errors, nothing from another site',{errs,outside});
    // the other language and back to the game
    const other=lang==='es'?'privacy':'privacidad';await p.click(`nav a[href="../${other}/"]`);await p.waitForLoadState();
    ok(new URL(p.url()).pathname===`/${other}/`,'the language link goes to /'+other+'/',p.url());
    await p.goBack();await p.click('nav a.go');await p.waitForLoadState();ok(new URL(p.url()).pathname==='/','«'+(lang==='es'?'Volver al juego':'Back to the game')+'» goes to the game (../)',p.url());
    await ctx.close();
    for(const [w,h] of [[390,844],[844,390]]){const c2=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true}),q=await c2.newPage();
      await q.goto(BASE+`/${dir}/#${anchor}`);await q.waitForTimeout(400);
      const o=await q.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);ok(o<=0,w+'x'+h+': nothing wider than the screen ('+o+')');
      if(w===390)await q.screenshot({path:shot(`privacidad_${lang}_phone_${anchor}.png`)});await c2.close();}}

  console.log('the game links to it (stats question, end plate, nickname screen), per language');
  for(const lang of ['es','en']){const c=await b.newContext({viewport:{width:960,height:540}}),p=await c.newPage();
    await p.addInitScript(l=>{window.__lang=l;window.__noMetrics=0;window.__rankOn=1;},lang);
    await p.route('**/api/**',r=>r.fulfill({status:204}));
    await p.goto(BASE+'/test.html');await p.waitForFunction(()=>document.querySelector('#acctPriv')&&window.I18N&&I18N.lang===document.documentElement.lang,null,{timeout:60000});await p.waitForTimeout(500);
    const L=await p.evaluate(()=>({ask:document.querySelector('#mtAsk .mtAskP')&&[document.querySelector('#mtAsk .mtAskP').getAttribute('href'),document.querySelector('#mtAsk .mtAskP').textContent],
      plate:[document.getElementById('acctPriv').getAttribute('href'),document.getElementById('acctPriv').textContent],
      rules:[...document.querySelectorAll('#acNick .acRules a')].map(a=>[a.getAttribute('href'),a.textContent,a.target])}));
    const P=lang==='es'?'privacidad/':'privacy/',R=lang==='es'?'privacidad/#normas':'privacy/#rules',W=lang==='es'?'Privacidad':'Privacy';
    ok(L.ask&&L.ask[0]===P&&L.ask[1]===W,lang+': stats question -> '+P,L.ask);
    ok(L.plate[0]===P&&L.plate[1]===W,lang+': end plate -> '+P,L.plate);
    ok(L.rules.length===2&&L.rules[0][0]===P&&L.rules[1][0]===R&&L.rules.every(x=>x[2]==='_blank'),lang+': nickname screen -> '+P+' and '+R+' (new tab)',L.rules);
    await c.close();}
  await b.close();
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
