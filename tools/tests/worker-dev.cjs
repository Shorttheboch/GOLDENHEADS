// v85: the Worker in Cloudflare's own runtime (workerd, through `wrangler dev`, local, no account, no login), with a fake Supabase over HTTP.
//   npm run build:cf && node tools/tests/worker-dev.cjs          (no browser; about a minute)
//   without site/ it makes it from dist/ (npm run build) itself: on the PC runner, worker-dev@dist
// ranking-fn.cjs and metrics-fn.cjs check every answer in Node; this one checks that the same code really runs where it will run:
// the bundle wrangler makes (nodejs_compat: node:crypto, Buffer, @supabase/supabase-js), the rate limit binding, the Cache API, the static
// assets with site/_redirects, site/_headers and html_handling, and the real site / preview split by host name.
//   fake Supabase   a small HTTP server: GET /auth/v1/user (Bearer good-jwt), POST /rest/v1/rpc/<fn>, POST /rest/v1/events; it records every call
//   settings        a temporary env file (wrangler dev --env-file) with SUPABASE_URL pointing at it and test secrets; nothing goes in the repo
//   host            requests to 127.0.0.1 are a preview (not in PROD_HOSTS); a second wrangler dev with --local-upstream goldenheads2021.com
//                   sees the real site's host name
const {spawn,execSync}=require('child_process'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),{createHmac}=require('crypto');
const ROOT=path.join(__dirname,'../..');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,700):''));if(!c)bad++;};
const SAMPLE=JSON.parse(fs.readFileSync(path.join(__dirname,'metrics-stats-sample.json'),'utf8'));
const U1='5b0e2f1c-1111-4aaa-8bbb-000000000001';
const BOARD={count:2,top:[{pos:1,nick:'ORION',score:9000,round:9,me:false},{pos:2,nick:'SANTI',score:5000,round:6,me:true}],me:{pos:2,nick:'SANTI',score:5000,round:6}};

function fakeSupabase(){const calls=[];
  const srv=http.createServer((q,s)=>{let body='';q.on('data',c=>body+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');calls.push({m:q.method,p:u.pathname,auth:q.headers.authorization,apikey:q.headers.apikey,body});
    const J=(c,o)=>{s.writeHead(c,{'content-type':'application/json'});s.end(o===undefined?'':JSON.stringify(o));};
    if(u.pathname==='/auth/v1/user')return q.headers.authorization==='Bearer good-jwt'?J(200,{id:U1,aud:'authenticated',role:'authenticated',email:'santi@gmail.com',app_metadata:{provider:'google',providers:['google']},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}):J(401,{code:401,error_code:'bad_jwt',msg:'invalid JWT'});
    const rpc=/^\/rest\/v1\/rpc\/(\w+)$/.exec(u.pathname);
    if(rpc){const a=body?JSON.parse(body):{};const f=rpc[1];
      if(f==='rank_board')return J(200,a.p_player?BOARD:{count:BOARD.count,top:BOARD.top});
      if(f==='rank_player')return J(200,{nick:'SANTI',banned:false,best:{score:5000,round:6},pos:2,count:2});
      if(f==='metrics_prune')return J(200,0);
      if(f==='metrics_stats')return J(200,SAMPLE);
      return J(200,null);}
    if(u.pathname==='/rest/v1/events'&&q.method==='POST'){s.writeHead(201);return s.end();}
    J(404,{message:'not here'});});});
  return new Promise(r=>srv.listen(0,'127.0.0.1',()=>r({srv,port:srv.address().port,calls})));}

const freePort=()=>new Promise(r=>{const s=http.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function dev(envFile,extra=[]){const port=await freePort(),log=[];
  const ch=spawn(process.execPath,[path.join(ROOT,'node_modules/wrangler/bin/wrangler.js'),'dev','--port',String(port),'--ip','127.0.0.1','--env-file',envFile,'--show-interactive-dev-session=false',...extra],
    {cwd:ROOT,env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'1'},detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  ch.stdout.on('data',d=>log.push(String(d)));ch.stderr.on('data',d=>log.push(String(d)));
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<120;i++){try{const r=await fetch(base+'/api/nope');if(r.status===404)return {ch,base,log};}catch(_){}await new Promise(r=>setTimeout(r,500));}
  throw new Error('wrangler dev did not start:\n'+log.join('').slice(-3000));}
function stop(ch){try{if(process.platform==='win32')execSync('taskkill /PID '+ch.pid+' /T /F',{stdio:'ignore'});else process.kill(-ch.pid,'SIGTERM');}catch(_){}}
const keyOf=(base,scope)=>createHmac('sha256',base).update('heads-run-token|v82|'+scope).digest();
const signedBy=(tok,key)=>{const [a,b,c]=String(tok).split('.');return createHmac('sha256',key).update(a+'.'+b).digest('base64url')===c;};

(async()=>{
  if(!fs.existsSync(path.join(ROOT,'site/headsrescue/index.html'))||!fs.existsSync(path.join(ROOT,'site/_redirects'))){
    if(!fs.existsSync(path.join(ROOT,'dist/index.html'))){console.log('no site/ and no dist/: run npm run build:cf first');process.exit(2);}
    const {makeSite}=await import(require('url').pathToFileURL(path.join(ROOT,'tools/cloudflare/make-site.mjs')).href);makeSite({});console.log('site/ made from dist/');}
  const SB=await fakeSupabase(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'heads-dev-')),envFile=path.join(tmp,'dev.vars');
  fs.writeFileSync(envFile,[`SUPABASE_URL=http://127.0.0.1:${SB.port}`,'SUPABASE_SECRET_KEY=sb_secret_DEVTEST','SUPABASE_PUBLISHABLE_KEY=sb_publishable_DEVTEST','RANK_SECRET=dev-rank-secret','ADMIN_PASSWORD=dev-admin'].join('\n')+'\n');
  const runs=[];
  try{
    console.log('1) wrangler dev at 127.0.0.1 (a preview: not in PROD_HOSTS)');
    const A=await dev(envFile);runs.push(A.ch);const B=A.base;
    let r=await fetch(B+'/api/auth'),j=await r.json();ok(r.status===200&&j.url===`http://127.0.0.1:${SB.port}`&&j.key==='sb_publishable_DEVTEST'&&/max-age=300/.test(r.headers.get('cache-control')),'/api/auth: the settings from the env, cacheable 5 min',j);
    r=await fetch(B+'/api/run',{method:'POST'});j=await r.json();ok(r.status===200&&signedBy(j.token,keyOf('dev-rank-secret','test'))&&!signedBy(j.token,keyOf('dev-rank-secret','prod')),'/api/run in workerd (node:crypto): signed with the preview label',j);
    const tokPreview=j.token;
    r=await fetch(B+'/api/scores?n=5');j=await r.json();const n1=SB.calls.filter(c=>c.p==='/rest/v1/rpc/rank_board').length;
    ok(r.status===200&&j.count===2&&j.top.length===2&&r.headers.get('cache-control')==='no-store'&&JSON.parse(SB.calls.find(c=>c.p==='/rest/v1/rpc/rank_board').body).p_test===true,'/api/scores: supabase-js in workerd -> rank_board (test board on a preview)',j);
    await new Promise(r=>setTimeout(r,300));
    r=await fetch(B+'/api/scores?n=5');await r.json();const n2=SB.calls.filter(c=>c.p==='/rest/v1/rpc/rank_board').length;
    ok(r.headers.get('x-heads-cache')==='hit'&&n2===n1,'the second ask within 20 s comes from the Cache API (no database call)',{hit:r.headers.get('x-heads-cache'),n1,n2});
    r=await fetch(B+'/api/scores?n=5&me=1',{headers:{authorization:'Bearer good-jwt'}});j=await r.json();
    ok(r.status===200&&j.me&&j.me.pos===2&&!r.headers.get('x-heads-cache')&&SB.calls.some(c=>c.p==='/auth/v1/user'&&c.auth==='Bearer good-jwt'&&c.apikey==='sb_secret_DEVTEST'),'&me=1: the session checked with Supabase Auth, never cached',j);
    r=await fetch(B+'/api/me',{headers:{authorization:'Bearer good-jwt'}});j=await r.json();ok(r.status===200&&j.player&&j.player.nick==='SANTI','/api/me with a Google session -> the player',j);
    r=await fetch(B+'/api/me',{headers:{authorization:'Bearer bad-jwt'}});ok(r.status===401,'/api/me with a token Supabase refuses -> 401',r.status);
    r=await fetch(B+'/api/m',{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:JSON.stringify({e:[{kind:'visit',sid:'0123456789abcdef01234567',ver:'v81',plat:'pc',scr:'pc-m'}]})});
    const ev=SB.calls.filter(c=>c.p==='/rest/v1/events').at(-1);let rows=[];try{rows=JSON.parse(ev.body);}catch(_){}
    ok(r.status===204&&rows.length===1&&rows[0].test===true&&rows[0].kind==='visit'&&'country' in rows[0]&&!ev.body.includes('127.0.0.1'),'/api/m: one row into events, a test on a preview, place from request.cf, no IP',rows[0]);
    r=await fetch(B+'/api/admin/stats?range=7d',{headers:{'x-admin-key':'dev-admin'}});j=await r.json();
    ok(r.status===200&&j.summary&&SB.calls.some(c=>c.p==='/rest/v1/rpc/metrics_prune'),'/api/admin/stats: prune once, then the totals',Object.keys(j));
    r=await fetch(B+'/api/nope');j=await r.json();ok(r.status===404&&j.error==='no encontrado','unknown /api/* -> 404 JSON',j);
    r=await fetch(B+'/',{redirect:'manual'});ok(r.status===302&&new URL(r.headers.get('location'),B).pathname==='/headsrescue/','/ -> 302 /headsrescue/ (site/_redirects)',r.headers.get('location'));
    r=await fetch(B+'/?ronda=14',{redirect:'manual'});ok(r.status===302&&/\/headsrescue\/\?ronda=14$/.test(r.headers.get('location')),'/?ronda=14 keeps its query string',r.headers.get('location'));
    r=await fetch(B+'/headsrescue',{redirect:'manual'});ok([301,307,308].includes(r.status)&&/\/headsrescue\/$/.test(r.headers.get('location')),'/headsrescue -> /headsrescue/ (html_handling)',{s:r.status,l:r.headers.get('location')});
    r=await fetch(B+'/headsrescue/');const html=await r.text();ok(r.status===200&&/<canvas id="c">/.test(html)&&/manifest\.webmanifest/.test(html),'/headsrescue/ -> the game',r.status);
    r=await fetch(B+'/headsrescue/admin');ok(r.status===200&&r.headers.get('x-robots-tag')==='noindex, nofollow, noarchive'&&r.headers.get('x-frame-options')==='DENY','/headsrescue/admin: admin.html with its headers (site/_headers)',[...r.headers]);
    r=await fetch(B+'/headsrescue/manifest.webmanifest');ok(r.headers.get('content-type')==='application/manifest+json'&&r.headers.get('cache-control')==='no-cache','manifest: application/manifest+json, no-cache',[...r.headers]);
    r=await fetch(B+'/headsrescue/sw.js');ok(r.headers.get('cache-control')==='no-cache','sw.js: no-cache',r.headers.get('cache-control'));
    {const film=fs.readFileSync(path.join(ROOT,'site/headsrescue/assets/opening.mp4')),music=fs.readFileSync(path.join(ROOT,'site/headsrescue/assets/music/game.mp3'));
     const same=(buf,a,b)=>Buffer.compare(buf,film.subarray(a,b+1))===0;
     r=await fetch(B+'/headsrescue/assets/opening.mp4',{headers:{range:'bytes=0-1'}});let buf=Buffer.from(await r.arrayBuffer());
     ok(r.status===206&&r.headers.get('content-range')==='bytes 0-1/'+film.length&&r.headers.get('content-length')==='2'&&r.headers.get('accept-ranges')==='bytes'&&same(buf,0,1),'the film, Range bytes=0-1 (what Safari asks first) -> 206, 2 bytes, Content-Length (worker/media.ts)',[r.status,...r.headers]);
     const mid=Math.floor(film.length/2);r=await fetch(B+'/headsrescue/assets/opening.mp4',{headers:{range:`bytes=${mid}-${mid+65535}`}});buf=Buffer.from(await r.arrayBuffer());
     ok(r.status===206&&buf.length===65536&&same(buf,mid,mid+65535),'a range in the middle of the film: the right 64 KB',{s:r.status,n:buf.length});
     r=await fetch(B+'/headsrescue/assets/opening.mp4',{headers:{range:`bytes=${film.length-1000}-`}});buf=Buffer.from(await r.arrayBuffer());ok(r.status===206&&buf.length===1000&&same(buf,film.length-1000,film.length-1),'open-ended range to the end',{s:r.status,n:buf.length});
     r=await fetch(B+'/headsrescue/assets/music/game.mp3',{headers:{range:'bytes=-500'}});buf=Buffer.from(await r.arrayBuffer());ok(r.status===206&&Buffer.compare(buf,music.subarray(music.length-500))===0,'the game music, last 500 bytes',{s:r.status,n:buf.length});
     r=await fetch(B+'/headsrescue/assets/opening.mp4',{headers:{range:`bytes=${film.length+10}-`}});ok(r.status===416&&r.headers.get('content-range')==='bytes */'+film.length,'a range past the end -> 416',r.status);
     r=await fetch(B+'/headsrescue/assets/opening.mp4');buf=Buffer.from(await r.arrayBuffer());ok(r.status===200&&buf.length===film.length&&r.headers.get('accept-ranges')==='bytes'&&r.headers.get('content-type')==='video/mp4','the film without Range: the whole file, Accept-Ranges: bytes',{s:r.status,n:buf.length});
     r=await fetch(B+'/headsrescue/assets/models/egg.glb',{headers:{range:'bytes=0-9'}});await r.arrayBuffer();ok(r.status===200||r.status===206,'(other files are plain static assets: Range answered with '+r.status+' by Cloudflare itself)');}
    r=await fetch(B+'/headsrescue/nope');ok(r.status===404,'anything else -> 404',r.status);
    let codes=[];for(let i=0;i<45;i++)codes.push((await fetch(B+'/api/auth')).status);
    ok(codes.includes(429)&&codes.slice(0,25).every(c=>c===200),'the rate limit binding (40 a minute) answers 429 in workerd',codes.join(','));
    r=await fetch(B+'/api/auth');j=await r.json().catch(()=>null);ok(r.status!==429||j&&j.error==='demasiadas peticiones','429 {"error":"demasiadas peticiones"}',j);
    stop(A.ch);
    console.log('2) wrangler dev as goldenheads2021.com (--local-upstream): the real site');
    const P=await dev(envFile,['--local-upstream','goldenheads2021.com']);runs.push(P.ch);
    r=await fetch(P.base+'/api/run',{method:'POST'});j=await r.json();
    ok(r.status===200&&signedBy(j.token,keyOf('dev-rank-secret','prod')),'/api/run on the real site: signed with the prod label',j);
    const sv=await fetch(P.base+'/api/save',{method:'POST',headers:{authorization:'Bearer good-jwt','content-type':'application/json'},body:JSON.stringify({token:tokPreview,score:100,round:1,secs:60})});
    ok(sv.status===400&&(await sv.json()).error==='token','a preview\'s token is refused on the real site (one secret, two labels)',sv.status);
    const nb=SB.calls.length;r=await fetch(P.base+'/api/scores?n=3');await r.json();const rb=SB.calls.slice(nb).find(c=>c.p==='/rest/v1/rpc/rank_board');
    ok(rb&&JSON.parse(rb.body).p_test===false,'the real board (p_test false)',rb&&rb.body);
    stop(P.ch);
  }catch(e){console.error(e);bad++;}
  finally{for(const c of runs)stop(c);SB.srv.close();fs.rmSync(tmp,{recursive:true,force:true});}
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
