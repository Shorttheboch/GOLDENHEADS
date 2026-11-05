// v85, Cloudflare: the same build works at /headsrescue/ (goldenheads2021.com) and at / (tests, npm run dev, Netlify until the move).
//   npm run build:test && tools/run-test.sh dist-test tools/tests/subpath.cjs           (test build: the test hooks)
//   npm run build      && tools/run-test.sh dist      tools/tests/subpath.cjs           (real build; on the PC runner: subpath@dist)
//   HEADS_LAYOUT=root  ... the same checks with the build at the root of the site (what Netlify served up to v84)
// The test finds the build the runner is serving (test.html = dist-test, else dist), makes the Cloudflare folder from it with
// tools/cloudflare/make-site.mjs (in a temporary folder: <tmp>/headsrescue/ + _headers + _redirects) and serves it with its own small server
// that does what Cloudflare's static assets do (checked against `wrangler dev`, v85): the _redirects rules (query string kept), the _headers
// rules, html_handling "auto-trailing-slash" (/headsrescue -> /headsrescue/, /headsrescue/index.html -> /headsrescue/, admin.html served at
// /headsrescue/admin, /headsrescue/admin.html -> /headsrescue/admin), Range ignored on plain files (200, as Cloudflare's assets) but cut
// (206) on the streamed film and music (as worker/media.ts does), 404 for anything else; and /api/* at the ROOT answered by a stub (the
// Worker: wrangler.jsonc run_worker_first), which records every call. At the root (HEADS_LAYOUT=root) every file takes ranges, as Netlify.
// Chrome opens it as http://heads.localhost:<port> (127.0.0.1; a *.localhost name is a secure origin for Chrome, so the service worker can
// register, and it is not «localhost» for the game, so the ranking and the metrics are on as on a real host): every /api call is seen.
// What it checks (screenshots tools/tests/out/subpath_<sub|root>_<test|real>_*.png):
//   files      _redirects (/ -> /headsrescue/ 302 with ?ronda=14, old /privacidad /privacy /admin -> /headsrescue/... 301), _headers (js immutable,
//              sw.js and manifest no-cache, manifest content type, admin noindex/no-cache/no-referrer/DENY), html_handling, 404 for the rest;
//              netlify.toml (v85): every old address -> https://goldenheads2021.com/headsrescue/<same path>, the API -> /api/<same>, 301, forced
//   PC 960x540   / opens the game at /headsrescue/; the menu art, fonts, models, menu sounds, menu music, the opening film and the game music
//              all come from /headsrescue/...; every /api call goes to the root (/api/run, /api/m); zero 404s and zero failed requests of any
//              kind on the site; a few seconds of play
//   phone 844x390 the same on a touch screen (phone ship model), the service worker registers with scope /headsrescue/ and the script
//              /headsrescue/sw.js, the manifest resolves (start_url and scope = /headsrescue/, the three icons load), a few seconds of play
//   pages      /headsrescue/privacidad/, /headsrescue/privacy/ and /headsrescue/admin render with their fonts and logo; the links between the
//              languages and back to the game stay under /headsrescue/; the old root addresses land there too
//   ?ronda=14  /?ronda=14 -> /headsrescue/?ronda=14, the language switch (a reload) keeps the address, the game starts in round 14
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),{pathToFileURL}=require('url');
const {BASE,ARGS,shot,ROOT}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,900):''));if(!c)bad++;};
const LAYOUT=process.env.HEADS_LAYOUT==='root'?'root':'sub',PRE=LAYOUT==='sub'?'/headsrescue':'',HOST='heads.localhost';
let BUILD='test'; // screenshots: subpath_<layout>_<test|real>_*.png
const SOFT=!process.env.HEADS_CHANNEL; // software GPU (Claude's machine): the 4K ship is swapped for the light one after it has been fetched
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.mp4':'video/mp4',
  '.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.map':'application/json'};

// ---------- the rules files ----------
const parseRedirects=t=>t.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const [from,to,code]=l.split(/\s+/);return {from,to,code:+(code||302)};});
function parseHeaders(t){const rules=[];let cur=null;for(const l of t.split('\n')){if(!l.trim()||l.trim().startsWith('#'))continue;
  if(/^\s/.test(l)){const i=l.indexOf(':');cur.h.push([l.slice(0,i).trim(),l.slice(i+1).trim()]);}else{cur={path:l.trim(),h:[]};rules.push(cur);}}return rules;}
const pathMatch=(pat,p)=>pat.endsWith('*')?p.startsWith(pat.slice(0,-1)):pat===p;

// ---------- a server that does what Cloudflare's static assets + the Worker's /api do ----------
const MEDIA=/\/assets\/(opening\.mp4|music\/[A-Za-z0-9_-]+\.mp3)$/; // worker/media.ts
function serve(dir,{redirects=[],headers=[],rangeAll=false}){
  const api=[],hits=[];
  const isFile=f=>{try{return fs.statSync(f).isFile();}catch(_){return false;}};
  const srv=http.createServer((q,s)=>{
    const u=new URL(q.url,'http://x');let p;try{p=decodeURIComponent(u.pathname);}catch(_){s.writeHead(400);return s.end();}
    hits.push(q.method+' '+u.pathname+u.search);
    const send=(code,h,body)=>{s.writeHead(code,h);s.end(body);};
    if(p==='/api'||p.startsWith('/api/')){ // the Worker (run_worker_first: /api/*); always at the root of the site
      let body='';q.on('data',c=>body+=c);q.on('end',()=>{api.push({m:q.method,p:u.pathname,q:u.search,body:body.slice(0,300)});
        const J=(c,o)=>send(c,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},o===null?undefined:JSON.stringify(o));
        if(p==='/api/run'&&q.method==='POST')return J(200,{token:Date.now()+'.0123456789abcdef.'+'x'.repeat(43)});
        if(p==='/api/scores')return J(200,{season:1,count:0,top:[]});
        if(p==='/api/m'&&q.method==='POST')return J(204,null);
        if(p==='/api/auth')return J(200,{url:'https://example.invalid',key:'sb_publishable_TEST'});
        if(p==='/api/me')return J(401,{error:'session'});
        J(404,{error:'no encontrado'});});return;}
    for(const r of redirects){ // _redirects first (they win even over a file)
      if(!pathMatch(r.from,p))continue;
      let to=r.to.replace(':splat',r.from.endsWith('*')?p.slice(r.from.length-1):'');if(u.search&&!to.includes('?'))to+=u.search;
      return send(r.code,{location:to});}
    // html_handling: auto-trailing-slash
    const f=path.join(dir,p);if(f!==dir&&!f.startsWith(dir+path.sep))return send(403,{});
    const R=to=>send(307,{location:to+u.search});
    let file=null;
    if(p.endsWith('/')){if(isFile(path.join(f,'index.html')))file=path.join(f,'index.html');else if(p.length>1&&isFile(f.slice(0,-1)+'.html'))return R(p.slice(0,-1));}
    else if(p.endsWith('/index.html')&&isFile(f))return R(p.slice(0,-'index.html'.length));
    else if(p.endsWith('.html')&&isFile(f))return R(p.slice(0,-5));
    else if(isFile(f))file=f;
    else if(isFile(f+'.html'))file=f+'.html';
    else if(isFile(path.join(f,'index.html')))return R(p+'/');
    if(!file)return send(404,{'content-type':'text/plain'},'404 not found');
    const st=fs.statSync(file),h={'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'public, max-age=0, must-revalidate','accept-ranges':'bytes','etag':'"'+st.size+'-'+(+st.mtime)+'"'};
    for(const r of headers)if(pathMatch(r.path,p))for(const [k,v] of r.h)h[k.toLowerCase()]=v;
    let start=0,end=st.size-1,code=200;const rg=(rangeAll||MEDIA.test(p))&&/^bytes=(\d*)-(\d*)$/.exec(q.headers.range||'');
    if(!rangeAll&&!MEDIA.test(p))delete h['accept-ranges'];
    if(rg){if(rg[1]===''){start=Math.max(0,st.size-(+rg[2]));}else{start=+rg[1];if(rg[2]!=='')end=Math.min(end,+rg[2]);}
      if(start>end||start>=st.size)return send(416,{'content-range':'bytes */'+st.size});code=206;h['content-range']=`bytes ${start}-${end}/${st.size}`;}
    h['content-length']=end-start+1;s.writeHead(code,h);if(q.method==='HEAD')return s.end();
    fs.createReadStream(file,{start,end}).on('error',()=>s.destroy()).pipe(s);});
  return new Promise(res=>srv.listen(0,'127.0.0.1',()=>res({srv,port:srv.address().port,api,hits})));}
const get=(port,p,h={})=>new Promise((res,rej)=>{const q=http.request({host:'127.0.0.1',port,path:p,method:'GET',headers:{host:HOST+':'+port,...h}},r=>{r.resume();r.on('end',()=>res({s:r.statusCode,h:r.headers}));});q.on('error',rej);q.end();});

// ---------- the browser side ----------
async function open(b,O,{phone=false,init=null,lang='es'}={}){
  const ctx=await b.newContext(phone?{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{viewport:{width:960,height:540}});
  const L={req:[],fail:[],badStatus:[],errs:[],outside:[]};
  ctx.on('request',r=>{const u=new URL(r.url());if(u.host===O.host)L.req.push({m:r.method(),p:u.pathname,q:u.search,t:r.resourceType(),sw:!!r.serviceWorker()});else if(!/^(data|blob):/.test(r.url()))L.outside.push(r.url());});
  ctx.on('requestfailed',r=>{const u=new URL(r.url()),e=(r.failure()||{}).errorText||'';if(u.host!==O.host)return;
    // ERR_ABORTED = the page itself stopped it (the film skipped, a background model when the test leaves the page, the stats sent with
    // keepalive / sendBeacon, whose answer the page never waits for): not a failure of the site; the stats are checked on the server (S.api)
    if(/ERR_ABORTED/.test(e))L.aborted=(L.aborted||[]).concat(u.pathname);else L.fail.push(u.pathname+' '+e);});
  ctx.on('response',r=>{const u=new URL(r.url());if(u.host===O.host&&r.status()>=400)L.badStatus.push(r.status()+' '+u.pathname);});
  await ctx.addInitScript(l=>{window.__noMetrics=0;window.__rankOn=1;window.__noOpening=0;window.__noTut=1;
    try{if(!sessionStorage.getItem('heads_lang_skip'))window.__lang=l;}catch(_){window.__lang=l;}},lang);
  if(init)await ctx.addInitScript(init);
  if(SOFT)await ctx.route(/\/assets\/models\/ship(_mobile)?\.glb$/,async r=>{const sp=new URL(r.request().url()).pathname,res=await get(O.port,sp);L.ship=(L.ship||[]).concat(res.s+' '+sp);
    r.fulfill({status:res.s,contentType:'model/gltf-binary',body:res.s===200?fs.readFileSync(path.join(ROOT,'tools/test-assets/ship_test.glb')):''});});
  const p=await ctx.newPage();p.L=L;p.on('pageerror',e=>L.errs.push(e.message));p.on('crash',()=>{L.errs.push('the page crashed');say('THE PAGE CRASHED');});
  p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|ERR_PROXY|Failed to load resource/.test(m.text()))L.errs.push(m.text());});
  return p;}
const menuReady=(p,phone)=>p.waitForFunction(ph=>{const g=document.getElementById(ph?'mmGo':'menuGo');return g&&!g.disabled;},phone,{timeout:400000});
const playing=p=>p.waitForFunction(()=>document.getElementById('menu').hidden&&document.getElementById('opening').hidden,null,{timeout:240000});
const T0=Date.now(),say=m=>console.log(`    [${((Date.now()-T0)/1000).toFixed(0)} s] ${m}`);
async function jugar(p,phone){
  for(let i=0;i<6;i++){ // a real click / tap on JUGAR (again if the menu's own entrance was still running and it did not take)
    const g=await p.evaluate(ph=>{const r=document.getElementById(ph?'mmGo':'menuGo').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];},phone);
    say('JUGAR at '+g.map(Math.round));if(phone)await p.touchscreen.tap(g[0],g[1]);else await p.mouse.click(g[0],g[1]);
    if(await p.waitForFunction(()=>document.getElementById('menu').hidden,null,{timeout:4000}).then(()=>true,()=>false))break;}
  // the opening film: wait until it is asked for, then skip it (Esc / SALTAR); without H.264 (Claude's Chromium) it ends by itself
  await p.waitForFunction(()=>{const v=document.getElementById('opVid');return document.getElementById('opening').hidden&&document.getElementById('menu').hidden||(v&&v.currentSrc);},null,{timeout:60000}).catch(()=>{});
  await p.waitForTimeout(1500);say('film: '+JSON.stringify(await p.evaluate(()=>{const v=document.getElementById('opVid');return {open:!document.getElementById('opening').hidden,menu:!document.getElementById('menu').hidden,src:v&&v.currentSrc,err:v&&v.error&&v.error.code,t:v&&v.currentTime};})));
  if(!(await p.evaluate(()=>document.getElementById('opening').hidden))){if(phone)await p.tap('#opSkip').catch(()=>{});else await p.keyboard.press('Escape');say('film skipped');}
  await playing(p);say('playing');}
const has=(L,re)=>L.req.filter(r=>re.test(r.p));
function siteChecks(tag,L,O,{need=[],allow=[],allowStatus=[]}={}){
  const wrong=L.req.filter(r=>!(r.p.startsWith('/api/')||r.p.startsWith(PRE+'/')||(PRE&&(r.p==='/'))||allow.includes(r.p)));
  ok(!wrong.length,tag+': every request to the site is under '+(PRE||'')+'/ or the API ('+L.req.length+' requests)',wrong.slice(0,12));
  const bs=L.badStatus.filter(x=>!allowStatus.includes(x));ok(!bs.length,tag+': zero 404s / errors from the site',bs.slice(0,12));
  ok(!L.fail.length,tag+': zero failed requests',L.fail.slice(0,12));
  const apiWrong=L.req.filter(r=>/\/api\//.test(r.p)&&!r.p.startsWith('/api/'));ok(!apiWrong.length,tag+': no API call under '+PRE+'/ (the API is at the root)',apiWrong);
  for(const [name,re] of need){const n=has(L,re);ok(n.length>0,tag+': '+name+' from '+(PRE||'')+'/… ('+(n[0]?n[0].p:'none')+(n.length>1?' +'+(n.length-1):'')+')');}
  ok(!L.errs.length,tag+': no page errors',L.errs.slice(0,6));}

(async()=>{
  const test=await fetch(BASE+'/test.html').then(r=>r.ok,()=>false),build=test?'dist-test':'dist',dist=path.join(ROOT,build);BUILD=test?'test':'real';
  console.log(`build ${build} (${test?'test hooks':'real build'}), layout ${LAYOUT}${PRE?' ('+PRE+'/)':' (root)'}${SOFT?', software GPU: light ship':''}`);
  const {makeSite,HEADERS,REDIRECTS}=await import(pathToFileURL(path.join(ROOT,'tools/cloudflare/make-site.mjs')).href);
  let dir=dist,tmp=null,rules={};
  if(LAYOUT==='sub'){tmp=fs.mkdtempSync(path.join(os.tmpdir(),'heads-site-'));makeSite({dist,out:tmp});dir=tmp;
    rules={redirects:parseRedirects(fs.readFileSync(path.join(tmp,'_redirects'),'utf8')),headers:parseHeaders(fs.readFileSync(path.join(tmp,'_headers'),'utf8'))};
    ok(fs.readFileSync(path.join(tmp,'_redirects'),'utf8')===REDIRECTS&&fs.readFileSync(path.join(tmp,'_headers'),'utf8')===HEADERS&&fs.existsSync(path.join(tmp,'headsrescue/index.html'))&&!fs.existsSync(path.join(dist,'_headers')),
      'make-site: <site>/headsrescue/ = the build, _headers and _redirects at the root of the site (never in the build)');}
  const S=await serve(dir,{...rules,rangeAll:LAYOUT==='root'}),O={host:HOST+':'+S.port,origin:`http://${HOST}:${S.port}`,port:S.port};
  console.log('serving',dir,'as',O.origin);
  const b=await chromium.launch({args:[...ARGS,`--host-resolver-rules=MAP ${HOST} 127.0.0.1`]});
  try{
  console.log('1) files: redirects, headers, html_handling');
  if(LAYOUT==='sub'){
    for(const [u,code,loc] of [['/',302,'/headsrescue/'],['/?ronda=14',302,'/headsrescue/?ronda=14'],['/index.html',302,'/headsrescue/'],['/headsrescue',307,'/headsrescue/'],['/headsrescue?ronda=3',307,'/headsrescue/?ronda=3'],
      ['/headsrescue/index.html',307,'/headsrescue/'],['/headsrescue/admin.html',307,'/headsrescue/admin'],['/headsrescue/admin/',307,'/headsrescue/admin'],['/headsrescue/privacidad',307,'/headsrescue/privacidad/'],
      ['/privacidad',301,'/headsrescue/privacidad/'],['/privacidad/',301,'/headsrescue/privacidad/'],['/privacy/',301,'/headsrescue/privacy/'],['/admin',301,'/headsrescue/admin'],['/admin/',301,'/headsrescue/admin'],['/admin?x=1',301,'/headsrescue/admin?x=1']]){
      const r=await get(S.port,u);ok(r.s===code&&r.h.location===loc,u+' -> '+code+' '+loc,{s:r.s,l:r.h.location});}
    for(const [u,code] of [['/headsrescue/',200],['/headsrescue/admin',200],['/headsrescue/privacidad/',200],['/headsrescue/privacy/',200],['/headsrescue/nope',404],['/assets/ui/menuui/logo.webp',404],['/sw.js',404]]){
      const r=await get(S.port,u);ok(r.s===code,u+' -> '+code,r.s);}
    const js=fs.readdirSync(path.join(dist,'js')).find(f=>/^index-.*\.js$/.test(f));
    let r=await get(S.port,'/headsrescue/js/'+js);ok(r.h['cache-control']==='public, max-age=31536000, immutable','/headsrescue/js/*: immutable, a year',r.h['cache-control']);
    r=await get(S.port,'/headsrescue/sw.js');ok(r.h['cache-control']==='no-cache','/headsrescue/sw.js: no-cache',r.h['cache-control']);
    r=await get(S.port,'/headsrescue/manifest.webmanifest');ok(r.h['cache-control']==='no-cache'&&r.h['content-type']==='application/manifest+json','/headsrescue/manifest.webmanifest: no-cache, application/manifest+json',r.h);
    r=await get(S.port,'/headsrescue/admin');ok(r.h['x-robots-tag']==='noindex, nofollow, noarchive'&&r.h['cache-control']==='no-cache'&&r.h['referrer-policy']==='no-referrer'&&r.h['x-frame-options']==='DENY','/headsrescue/admin: noindex, no-cache, no-referrer, DENY',r.h);
    r=await get(S.port,'/headsrescue/assets/opening.mp4',{range:'bytes=0-1'});ok(r.s===206&&r.h['content-range']==='bytes 0-1/'+fs.statSync(path.join(dist,'assets/opening.mp4')).size,'the film: Range -> 206 (the Worker cuts it: worker/media.ts)',r.h);
    r=await get(S.port,'/headsrescue/assets/models/egg.glb',{range:'bytes=0-1'});ok(r.s===200,'a plain file: Range ignored, 200 (as Cloudflare\'s static assets)',r.s);
    const ms=JSON.parse(fs.readFileSync(path.join(tmp,'headsrescue/assets/media.json'),'utf8'));
    ok(ms['opening.mp4']===fs.statSync(path.join(dist,'assets/opening.mp4')).size&&ms['music/game.mp3']===fs.statSync(path.join(dist,'assets/music/game.mp3')).size&&ms['music/menu.mp3']>0,'make-site: headsrescue/assets/media.json has the sizes of the film and the music',ms);
    // netlify.toml from v85 on: the old address sends everything here
    const toml=fs.readFileSync(path.join(ROOT,'netlify.toml'),'utf8'),R=[...toml.matchAll(/\[\[redirects\]\]\s+from = "([^"]+)"\s+to = "([^"]+)"\s+status = (\d+)\s+force = (true|false)/g)].map(m=>({from:m[1],to:m[2],code:+m[3],force:m[4]==='true'}));
    const nl=u=>{const x=new URL(u,'https://heads-rescate-dorado.netlify.app'),p=x.pathname;for(const r of R)if(pathMatch(r.from,p))return r.code+' '+r.to.replace(':splat',r.from.endsWith('*')?p.slice(r.from.length-1):'')+x.search;return null;};
    ok(R.length===2&&R.every(r=>r.code===301&&r.force)&&!/\[functions\]|npm run build/.test(toml)&&/publish = "netlify-redirect"/.test(toml),'netlify.toml: only forced 301s, no functions, no Vite build',R);
    for(const [u,want] of [['/','301 https://goldenheads2021.com/headsrescue/'],['/privacidad/','301 https://goldenheads2021.com/headsrescue/privacidad/'],['/privacy/#rules','301 https://goldenheads2021.com/headsrescue/privacy/'],
      ['/admin','301 https://goldenheads2021.com/headsrescue/admin'],['/?ronda=14','301 https://goldenheads2021.com/headsrescue/?ronda=14'],['/assets/opening.mp4','301 https://goldenheads2021.com/headsrescue/assets/opening.mp4'],
      ['/api/scores?n=5','301 https://goldenheads2021.com/api/scores?n=5']])ok(nl(u)===want,'old address '+u+' -> '+want,nl(u));
  }else{
    for(const [u,code,loc] of [['/',200],['/index.html',307,'/'],['/admin',200],['/admin.html',307,'/admin'],['/privacidad',307,'/privacidad/'],['/privacidad/',200],['/privacy/',200]]){
      const r=await get(S.port,u);ok(r.s===code&&(!loc||r.h.location===loc),u+' -> '+code+(loc?' '+loc:''),{s:r.s,l:r.h.location});}}

  console.log('2) PC 960x540: '+(PRE?'/ -> ':'')+PRE+'/, menu, JUGAR, a few seconds of play');
  let p=await open(b,O);
  await p.goto(O.origin+'/');ok(new URL(p.url()).pathname===PRE+'/','the address: '+PRE+'/',p.url());
  await menuReady(p,false);await p.waitForTimeout(2500);
  await p.mouse.click(480,40);await p.waitForTimeout(1500); // a first gesture: the menu sounds and the menu music start loading
  await p.screenshot({path:shot(`subpath_${LAYOUT}_${BUILD}_pc_menu.png`),timeout:180000});
  const api0=S.api.length;
  await jugar(p,false);
  await p.mouse.move(480,270);for(const k of ['KeyW','KeyA','KeyD']){await p.keyboard.down(k);await p.waitForTimeout(900);await p.keyboard.up(k);}
  await p.mouse.down();await p.waitForTimeout(600);await p.mouse.up();await p.waitForTimeout(2500);
  await p.screenshot({path:shot(`subpath_${LAYOUT}_${BUILD}_pc_play.png`),timeout:180000});
  const PA=S.api.slice(api0);
  siteChecks('PC',p.L,O,{need:[['menu art',/\/assets\/ui\/menuui\/.*\.webp$/],['menu fonts',/\/assets\/ui\/menuui\/f\d00\.woff2$/],['end-plate font',/\/assets\/ui\/endui\/font\.woff2$/],
    ['the built code',/\/js\/index-.*\.js$/],['the styles',/\/js\/index-.*\.css$/],['the ship',/\/assets\/models\/ship(_test)?\.glb$/],['the astronaut',/\/assets\/models\/astronaut\.glb$/],
    ['the spider',/\/assets\/models\/spider\.glb$/],['the background models (gun2, crab, biped, egg)',/\/assets\/models\/(gun2|crab|spider_biped|egg)\.glb$/],['the sound lists',/\/assets\/(sfx|vo_es)\.js$/],
    ['menu sounds',/\/assets\/sfx\/menu\/.*\.mp3$/],['menu music',/\/assets\/music\/menu\.mp3$/],['the opening film',/\/assets\/opening\.mp4$/],['game music',/\/assets\/music\/game\.mp3$/],
    ['game sounds',/\/assets\/sfx\/[^/]+\.mp3$/],['the HUD art',/\/assets\/ui\/hud4\/.*\.webp$/]].map(([n,re])=>[n,new RegExp('^'+PRE.replace('/','\\/')+re.source)])});
  ok(PA.some(a=>a.m==='POST'&&a.p==='/api/run')&&PA.some(a=>a.m==='POST'&&a.p==='/api/m'),'PC: the game called /api/run and /api/m at the root',PA.map(a=>a.m+' '+a.p));
  if(p.L.ship)ok(p.L.ship.every(s=>s.startsWith('200 '+PRE+'/assets/models/')),'PC: the ship model was served ('+p.L.ship.join(', ')+')');
  ok(await p.evaluate(()=>!navigator.serviceWorker.controller),'PC: no service worker (only on touch)');
  console.log('  outside the site (not checked):',[...new Set(p.L.outside.map(u=>new URL(u).host))].join(', ')||'none');
  await p.context().close();

  console.log('3) phone 844x390: menu, service worker, manifest, a few seconds of play');
  p=await open(b,O,{phone:true});
  await p.goto(O.origin+PRE+'/');await menuReady(p,true);await p.waitForTimeout(3500);
  const sw=await p.evaluate(async()=>{const r=await Promise.race([navigator.serviceWorker.ready,new Promise(res=>setTimeout(()=>res(null),20000))]);const w=r&&(r.active||r.waiting||r.installing);return r?{scope:r.scope,script:w&&w.scriptURL}:null;});
  ok(sw&&sw.scope===O.origin+PRE+'/'&&sw.script===O.origin+PRE+'/sw.js','phone: service worker registered, scope '+PRE+'/, script '+PRE+'/sw.js',sw);
  const man=await p.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]'),r=await fetch(l.href),m=await r.json();
    const abs=x=>new URL(x,l.href).href,icons=[];for(const i of m.icons){const q=await fetch(abs(i.src));icons.push({src:abs(i.src),s:q.status,t:q.headers.get('content-type')});}
    const at=document.querySelector('link[rel=apple-touch-icon]'),aq=await fetch(at.href);
    return {href:l.href,ct:r.headers.get('content-type'),start:abs(m.start_url),scope:abs(m.scope),id:m.id,icons,apple:{href:at.href,s:aq.status}};});
  ok(man.href===O.origin+PRE+'/manifest.webmanifest'&&/manifest\+json/.test(man.ct),'phone: the manifest at '+PRE+'/manifest.webmanifest',man);
  ok(man.start===O.origin+PRE+'/'&&man.scope===O.origin+PRE+'/'&&man.id===undefined,'phone: start_url and scope = '+PRE+'/ (no id: the identity is the game\'s folder)',man);
  ok(man.icons.length===3&&man.icons.every(i=>i.s===200&&i.src.startsWith(O.origin+PRE+'/icons/')&&i.t==='image/png')&&man.apple.s===200&&man.apple.href===O.origin+PRE+'/icons/apple-touch-icon.png','phone: the 3 icons and the apple-touch-icon load from '+PRE+'/icons/',man.icons);
  await p.screenshot({path:shot(`subpath_${LAYOUT}_${BUILD}_phone_menu.png`),timeout:180000});
  const api1=S.api.length;
  await jugar(p,true);
  const cx=422,cy=250;await p.touchscreen.tap(cx,cy);await p.waitForTimeout(3000);
  await p.screenshot({path:shot(`subpath_${LAYOUT}_${BUILD}_phone_play.png`),timeout:180000});
  siteChecks('phone',p.L,O,{need:[['the phone menu art',/\/assets\/ui\/menumob\/.*\.webp$/],['the ship',/\/assets\/models\/ship_(mobile|test)\.glb$/],['the opening film',/\/assets\/opening\.mp4$/],
    ['game music',/\/assets\/music\/game\.mp3$/],['the manifest',/\/manifest\.webmanifest$/],['the phone HUD font (Saira)',/\/js\/saira-condensed-.*\.woff2$/]].map(([n,re])=>[n,new RegExp('^'+PRE.replace('/','\\/')+re.source)])});
  ok(S.api.slice(api1).some(a=>a.p==='/api/run'),'phone: /api/run at the root',S.api.slice(api1).map(a=>a.m+' '+a.p));
  await p.reload();await p.waitForLoadState('load');await menuReady(p,true);
  const ctl=await p.evaluate(async()=>({ctl:navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL,caches:'caches' in self?(await caches.keys()).length:0,path:location.pathname}));
  ok(ctl.ctl===O.origin+PRE+'/sw.js'&&ctl.path===PRE+'/'&&ctl.caches===0,'phone: reloaded under the service worker: the page loads, nothing cached',ctl);
  await p.context().close();

  console.log('4) the pages: privacy (ES / EN) and admin');
  p=await open(b,O);
  for(const [dir,other,back] of [['privacidad','privacy','Volver al juego'],['privacy','privacidad','Back to the game']]){
    const start=PRE?'/'+dir+'/':'/'+dir; // the old root address (Cloudflare) or the address without the slash (root)
    await p.goto(O.origin+start);await p.waitForLoadState('load');
    ok(new URL(p.url()).pathname===PRE+'/'+dir+'/',start+' -> '+PRE+'/'+dir+'/',p.url());
    await p.waitForTimeout(300);
    const I=await p.evaluate(()=>({fonts:document.fonts.check('800 16px TekturE')&&document.fonts.check('600 14px TitilliumH'),logo:(i=>i&&i.complete&&i.naturalWidth>0?i.src:null)(document.querySelector('header img'))}));
    ok(I.fonts&&I.logo===O.origin+PRE+'/assets/ui/menuui/logo.webp',dir+': fonts and logo from '+PRE+'/assets/',I);
    await p.screenshot({path:shot(`subpath_${LAYOUT}_${BUILD}_${dir}.png`),timeout:180000});
    await p.click(`nav a[href="../${other}/"]`);await p.waitForLoadState('load');ok(new URL(p.url()).pathname===PRE+'/'+other+'/','the language link -> '+PRE+'/'+other+'/',p.url());
    await p.goBack();await p.waitForLoadState('load');await p.click('nav a.go');await p.waitForLoadState('load');ok(new URL(p.url()).pathname===PRE+'/','«'+back+'» -> '+PRE+'/',p.url());
}
  await p.goto(O.origin+(PRE?'/admin':'/admin'));await p.waitForLoadState('load');await p.waitForTimeout(300);
  const A=await p.evaluate(()=>({path:location.pathname,login:!!document.getElementById('pw'),fonts:document.fonts.check('800 16px TekturE')&&document.fonts.check('600 14px TitilliumH'),logo:(i=>i&&i.complete&&i.naturalWidth>0?i.src:null)(document.querySelector('header img'))}));
  ok(A.path===PRE+'/admin'&&A.login&&A.fonts&&A.logo===O.origin+PRE+'/assets/ui/menuui/logo.webp','/admin -> '+PRE+'/admin: the login, its fonts and logo from '+PRE+'/assets/',A);
  await p.route('**/api/admin/stats*',r=>r.fulfill({status:401,contentType:'application/json',body:'{"error":"contraseña incorrecta"}'}));
  await p.fill('#pw','nope');await p.click('#login button[type=submit]');await p.waitForTimeout(500);
  ok(p.L.req.some(r=>r.p==='/api/admin/stats'),'admin: asks /api/admin/stats at the root',p.L.req.filter(r=>/api/.test(r.p)).map(r=>r.p));
  await p.screenshot({path:shot(`subpath_${LAYOUT}_${BUILD}_admin.png`),timeout:180000});
  siteChecks('pages',p.L,O,{allow:PRE?['/privacidad/','/privacy/','/admin']:[],allowStatus:['401 /api/admin/stats']}); // (that 401 is the test's own answer to a wrong password)
  await p.context().close();

  console.log('5) ?ronda=14 and the language switch');
  p=await open(b,O);
  await p.goto(O.origin+'/?ronda=14');ok(new URL(p.url()).pathname+new URL(p.url()).search===PRE+'/?ronda=14','/?ronda=14 -> '+PRE+'/?ronda=14',p.url());
  await menuReady(p,false);await p.waitForTimeout(2000);
  await p.click('#langTog button[data-l=en]');await p.waitForLoadState('load');await menuReady(p,false);await p.waitForTimeout(1500);
  const after=await p.evaluate(()=>({path:location.pathname+location.search,lang:localStorage.getItem('heads_lang'),html:document.documentElement.lang}));
  ok(after.path===PRE+'/?ronda=14','the language switch reloads the same address ('+after.path+')',after);
  if(!test)ok(after.lang==='en'&&after.html==='en','real build: EN saved and the page in English after the reload',after); // (the test build always forces ES: its hook on window.__lang)
  await jugar(p,false);
  const rn=await p.waitForFunction(()=>{const t=(document.getElementById('dRound')||{}).textContent+' '+(document.getElementById('msg')||{}).textContent;return /(RONDA|ROUND) 14\b/.test(t)&&t;},null,{timeout:60000}).then(h=>h.jsonValue(),()=>null);
  ok(!!rn,'the game starts in round 14',rn);
  await p.waitForTimeout(1500);await p.screenshot({path:shot(`subpath_${LAYOUT}_${BUILD}_ronda14.png`),timeout:180000});
  siteChecks('ronda',p.L,O);
  await p.context().close();
  }catch(e){console.error(e);bad++;}
  finally{await b.close();S.srv.close();if(tmp)fs.rmSync(tmp,{recursive:true,force:true});}
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
