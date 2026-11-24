// How many requests does one visit make to the Cloudflare Worker? (the free plan: 100,000 a day). Not a pass/fail test, a measurement.
//   npm run build:test && node tools/tests/peticiones.cjs            (serves dist-test itself, at http://heads.localhost:<port>/headsrescue/)
// Only these reach the Worker (wrangler.jsonc run_worker_first): /api/*, /headsrescue/assets/opening.mp4, /headsrescue/assets/music/*.
// Everything else is a static file (free, no limit) and is only counted for reference.
// The server does what Cloudflare does: Range cut (206) on the film and the music (worker/media.ts), ignored elsewhere; /api answered by a stub.
// One visit = menu, JUGAR, the opening film, HEADS_PLAY seconds of play (default 150), the end plate, REINTENTAR, a second game of 40 s,
// end, then the page is closed (the leave beacon). Browsers: HEADS_B=pc,android,iphone (iphone = WebKit, which is not iOS Safari).
// Needs heads.localhost -> 127.0.0.1 (Chromium knows it; WebKit needs it in /etc/hosts).
const {chromium,webkit}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {ARGS,ROOT}=require('./lib.cjs');
const DIR=path.join(ROOT,process.env.HEADS_DIR||'dist-test'),PRE='/headsrescue',PORT=+(process.env.PORT||8790),HOST='heads.localhost';
const PLAY=+(process.env.HEADS_PLAY||150);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff2':'font/woff2','.woff':'font/woff'};
const MEDIA=/^\/headsrescue\/assets\/(opening\.mp4|music\/[A-Za-z0-9_-]+\.mp3)$/;
let log=[];
const srv=http.createServer((q,s)=>{
  const u=new URL(q.url,'http://x'),p=decodeURIComponent(u.pathname),t=Date.now();
  const worker=p.startsWith('/api/')||MEDIA.test(p);
  log.push({t,m:q.method,p,range:q.headers.range||'',worker});
  if(p.startsWith('/api/')){let body='';q.on('data',c=>body+=c);q.on('end',()=>{
    const J=(c,o)=>{s.writeHead(c,{'content-type':'application/json','cache-control':'no-store'});s.end(o==null?undefined:JSON.stringify(o));};
    if(p==='/api/run')return J(200,{token:Date.now()+'.0123456789abcdef.'+'x'.repeat(43)});
    if(p==='/api/scores')return J(200,{season:1,count:3,top:[{pos:1,nick:'AAA',score:90000,round:12},{pos:2,nick:'BBB',score:50000,round:9},{pos:3,nick:'CCC',score:20000,round:6}]});
    if(p==='/api/m')return J(204,null);
    if(p==='/api/auth')return J(200,{url:'https://example.invalid',key:'sb_publishable_TEST'});
    return J(404,{error:'no encontrado'});});return;}
  let rel=p.startsWith(PRE+'/')?p.slice(PRE.length):p==='/'?null:p;
  if(rel===null){s.writeHead(302,{location:PRE+'/'});return s.end();}
  if(rel.endsWith('/'))rel+='index.html';
  const f=path.join(DIR,rel);let st;try{st=fs.statSync(f);}catch(_){s.writeHead(404);return s.end();}
  if(!st.isFile()){s.writeHead(404);return s.end();}
  const type=MIME[path.extname(f)]||'application/octet-stream';
  const m=MEDIA.test(p)&&/^bytes=(\d*)-(\d*)$/.exec(q.headers.range||'');
  if(m){let a=m[1]===''?st.size-(+m[2]):+m[1],b=m[1]===''?st.size-1:(m[2]===''?st.size-1:Math.min(+m[2],st.size-1));
    s.writeHead(206,{'content-type':type,'content-range':`bytes ${a}-${b}/${st.size}`,'content-length':b-a+1,'accept-ranges':'bytes'});
    return fs.createReadStream(f,{start:a,end:b}).on('error',()=>s.end()).pipe(s);}
  s.writeHead(200,{'content-type':type,'content-length':st.size,...(MEDIA.test(p)?{'accept-ranges':'bytes'}:{})});
  if(q.method==='HEAD')return s.end();fs.createReadStream(f).pipe(s);});

const sum=(rows)=>{const w=rows.filter(r=>r.worker),by={};for(const r of w){const k=(r.p.startsWith('/api/')?r.m+' ':'')+r.p.replace(PRE+'/assets/','');by[k]=(by[k]||0)+1;}
  return {worker:w.length,static:rows.length-w.length,by};};
const phase=(name,from)=>{const rows=log.filter(r=>r.t>=from);const s=sum(rows);console.log(`   ${name}: Worker ${s.worker} · static ${s.static}  `+JSON.stringify(s.by));return s;};

async function visit(kind){
  const B=kind==='iphone'?webkit:chromium;
  const b=await B.launch(kind==='iphone'?{}:{args:ARGS});
  const opt=kind==='pc'?{viewport:{width:1280,height:720}}:
    kind==='android'?{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}:
    {viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'};
  const ctx=await b.newContext(opt);const pg=await ctx.newPage();
  await pg.addInitScript(()=>{window.__noMetrics=0;window.__rankOn=1;window.__noOpening=0;});
  pg.on('pageerror',e=>console.log('   pageerror',e.message.slice(0,120)));
  log=[];const t0=Date.now();console.log(`\n== ${kind} (${B.name()})`);
  await pg.goto(`http://${HOST}:${PORT}${PRE}/test.html`,{waitUntil:'domcontentloaded',timeout:120000});
  const go=kind==='pc'?'#menuGo':'#mmGo';
  await pg.waitForFunction(g=>{const e=document.querySelector(g);return e&&!e.disabled;},go,{timeout:400000});
  await pg.waitForTimeout(4000);
  // the stats question: answer SÍ like a player who helps (adds the player id, same number of requests)
  await pg.evaluate(()=>{const y=document.querySelector('#mtAsk [data-a="yes"]');if(y)y.click();});
  const s1=phase('menu (until JUGAR)',t0);
  const t1=Date.now();
  if(kind==='pc')await pg.click(go,{timeout:20000}).catch(e=>console.log('   click',e.message.slice(0,80)));else await pg.tap(go,{timeout:20000}).catch(e=>console.log('   tap',e.message.slice(0,80)));
  // the film: wait until it ends or fails (the game starts), 45 s at most
  await pg.waitForFunction(()=>document.getElementById('opening').hidden,null,{timeout:60000}).catch(()=>{});
  const film=await pg.evaluate(()=>{const v=document.getElementById('opVid');return {err:v.error&&v.error.code,t:+v.currentTime.toFixed(1)};});
  const s2=phase('JUGAR + film '+JSON.stringify(film),t1);
  const t2=Date.now();await pg.waitForTimeout(PLAY*1000);
  const mus=await pg.evaluate(()=>{try{const e=__MUS().M.el;return {t:+e.currentTime.toFixed(1),paused:e.paused,rs:e.readyState};}catch(e){return String(e);}});
  const s3=phase(`${PLAY} s of play (music ${JSON.stringify(mus)})`,t2);
  const t3=Date.now();await pg.evaluate(()=>{try{__MUS().endGame(false,'test');}catch(e){}});await pg.waitForTimeout(9000);
  const s4=phase('end of game + plate',t3);
  const t4=Date.now();await pg.keyboard.press('Enter').catch(()=>{});await pg.evaluate(()=>{try{if(document.getElementById('end').hidden===false)document.getElementById('again').click();}catch(e){}});
  await pg.waitForTimeout(40000);await pg.evaluate(()=>{try{__MUS().endGame(false,'test');}catch(e){}});await pg.waitForTimeout(6000);
  const s5=phase('second game (40 s) + end',t4);
  const t5=Date.now();await pg.close({runBeforeUnload:true});await new Promise(r=>setTimeout(r,1500));
  const s6=phase('leaving the page',t5);
  const all=sum(log);console.log(`   TOTAL Worker ${all.worker} (static ${all.static}) in ${Math.round((Date.now()-t0)/1000)} s`);
  const media=log.filter(r=>MEDIA.test(r.p));console.log('   media requests:',JSON.stringify(media.map(r=>r.p.split('/').pop()+' '+r.range)));
  await b.close();return all.worker;}

srv.listen(PORT,'127.0.0.1',async()=>{const res={};
  for(const k of (process.env.HEADS_B||'pc,android,iphone').split(','))try{res[k]=await visit(k);}catch(e){console.log('  ',k,'failed',e.message.slice(0,200));}
  console.log('\nWorker requests per visit:',JSON.stringify(res));srv.close();process.exit(0);});
