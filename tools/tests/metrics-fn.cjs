// Anonymous metrics (v81; v85: on Cloudflare): the Worker (worker/index.ts -> worker/metrics.ts) in plain Node (22+, it strips the TypeScript types
// itself), no Cloudflare, no Supabase (tools/tests/worker-lib.cjs: env, request.cf, CF-Connecting-IP, the host of the real site or of a preview).
//   node tools/tests/metrics-fn.cjs
// Supabase is replaced twice:
//   mock  a fake @supabase/supabase-js that records what the function asks of it (always)
//   real  the real @supabase/supabase-js with fetch replaced, to see the HTTP requests it makes (when the package is installed:
//         after `npm install`, or HEADS_SB_DIR=<a folder whose node_modules has @supabase/supabase-js>)
// What it checks:
//   POST /api/m   a batch is cleaned key by key (unknown keys, kinds and values dropped, numbers clamped, texts trimmed), geo added (country, region, city
//                 from request.cf),
//                 the IP never stored, a single event and a sendBeacon text/plain body work, bad JSON / nothing valid -> 400, too big -> 413,
//                 more than 12 events -> only 12, GET -> 405, rate limit per IP (31st request in a minute -> 429, another IP still fine),
//                 no Supabase variables -> 503, a database error -> 500, events from a preview (any host but goldenheads2021.com / www) stored as tests
//   GET /api/admin/stats   no ADMIN_PASSWORD -> 503, missing or wrong x-admin-key -> 401, right one -> 200 with the totals of metrics_stats (range and
//                 platform whitelisted), 8 wrong tries from one IP -> 429 for that IP only, no raw rows or ids in the answer;
//                 v82b: metrics_prune (events older than 2 years) runs with the first admin request, then not again for a day, and its failure never
//                 stops the stats
//   Worker (v85)  request.cf geo (region name, or its code when Cloudflare has no name; nothing when there is no cf), CF-Connecting-IP, the rate
//                 limit binding RL_METRICS (60 a minute per IP and host -> 429 before the handler), real site / preview by host
const path=require('path'),fs=require('fs');
const {ROOT,WORKER,hookSupabase,makeEnv,ctx:ctx0,bind}=require('./worker-lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,600):''));if(!c)bad++;};
const SAMPLE=JSON.parse(fs.readFileSync(path.join(__dirname,'metrics-stats-sample.json'),'utf8'));
const MOCK=`export function createClient(url,key,opts){const L=globalThis.__sb;L.created.push({url,key,opts});return {
  from(t){return {insert(rows){L.inserts.push({t,rows});return Promise.resolve({error:L.fail?{message:'db down'}:null});}};},
  rpc(fn,args){L.rpcs.push({fn,args});if(fn==='metrics_prune')return Promise.resolve(L.failPrune?{data:null,error:{message:'function public.metrics_prune() does not exist'}}:{data:3,error:null});
    return Promise.resolve(L.fail?{data:null,error:{message:'db down'}}:{data:L.stats,error:null});}};}`;
// where the real package is, if anywhere
let SBDIR=process.env.HEADS_SB_DIR||'';
if(!SBDIR){try{require.resolve('@supabase/supabase-js',{paths:[ROOT]});SBDIR=ROOT;}catch(_){}}
hookSupabase(MOCK,SBDIR);

const {cfg:CFG,env:ENV}=makeEnv(); // the Worker's settings: the tests add SUPABASE_URL, ADMIN_PASSWORD... on it
// what Cloudflare puts in request.cf (plain text, not URL-encoded as Netlify's geo was)
const IP='203.0.113.77',GEO={country:'ES',region:'Valencia',regionCode:'VC',city:'València',continent:'EU',timezone:'Europe/Madrid',colo:'MAD'};
const ctx=(ip=IP,dc='production',cf=GEO)=>ctx0(ip,dc,cf);
const SID='0123456789abcdef01234567',PID='fedcba9876543210fedcba98';
const post=(fn,body,{ip,type='application/json'}={})=>fn(new Request('https://example.test/api/m',{method:'POST',headers:{'content-type':type},body:typeof body==='string'?body:JSON.stringify(body)}),ctx(ip));
const admin=(fn,q,key,ip)=>fn(new Request('https://example.test/api/admin/stats'+q,{headers:key==null?{}:{'x-admin-key':key}}),ctx(ip));
const freshL=()=>{globalThis.__sb={created:[],inserts:[],rpcs:[],fail:false,stats:SAMPLE};return globalThis.__sb;};
const deepKeys=(o,out=new Set())=>{if(o&&typeof o==='object')for(const [k,v] of Object.entries(o)){out.add(k);deepKeys(v,out);}return out;};

(async()=>{
  console.log('1) mock Supabase client');
  const fn=bind((await import(WORKER+'?sb=mock')).default,ENV);let L=freshL();
  // no variables yet
  let r=await post(fn,{e:[{kind:'visit',sid:SID}]});ok(r.status===503,'no SUPABASE_URL / SUPABASE_SECRET_KEY -> 503',r.status);
  Object.assign(ENV,{SUPABASE_URL:'https://abcdefgh.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TESTKEY_123'});
  const visit={kind:'visit',sid:SID,pid:PID,ver:'v81',plat:'touch',os:'android',br:'chrome',lang:'en',scr:'phone',blang:'es',inst:true,go:true,ready:true,load:8123.4,consent:'yes',film:'skipped',filmS:7,evil:'<script>',ip:'1.2.3.4'};
  const end={kind:'end',sid:SID,pid:PID,ver:'v81',plat:'touch',os:'android',br:'chrome',lang:'en',game:2,round:7,cause:'ship',secs:612,score:1e12,combat:-5,cargo:'900',kills:44,heads:'x',acc:150,xp:2,eggs:1,eggsK:1,spit:1,inc:0,rep:9,q:2,qMax:3,fps:48,
    rt:Array.from({length:100},(_,i)=>i===3?-20:i===4?'zz':80+i),tut:'skip',tutStep:2,test:'yes',extra:{a:1}};
  const err={kind:'error',sid:SID,ver:'v81',plat:'touch',os:'android',br:'chrome',lang:'en',msg:'TypeError:\u0000 boom '+'x'.repeat(500),at:'index.js:1:2'.repeat(30),n:2};
  r=await post(fn,{e:[visit,end,err,{kind:'hack',sid:SID},{kind:'visit',sid:'NOT-AN-ID'},{kind:'quit',sid:SID,game:2,round:3,secs:100,score:50,os:'beos',br:'netscape',lang:'fr',plat:'tv',pid:'zz',cause:'dead',test:true}]});
  ok(r.status===204,'a batch -> 204',r.status);
  ok(L.created.length===1&&L.created[0].url==='https://abcdefgh.supabase.co'&&L.created[0].key==='sb_secret_TESTKEY_123'&&L.created[0].opts.auth.persistSession===false,'client made once, with SUPABASE_URL and the secret key, no session kept',L.created);
  const rows=L.inserts[0]&&L.inserts[0].rows||[];
  ok(L.inserts.length===1&&L.inserts[0].t==='events'&&rows.length===4,'one insert into events, 4 valid events (bad kind and bad session id dropped)',rows.length);
  const [v,e,x,qt]=rows;
  const COLS=['kind','session_id','player_id','version','test','platform','os','browser','lang','game','round','secs','cause','country','region','city','data'].sort().join();
  ok(rows.every(o=>Object.keys(o).sort().join()===COLS),'every row has exactly the table columns',rows.map(o=>Object.keys(o)));
  ok(v.country==='ES'&&v.region==='Valencia'&&v.city==='València','geo from request.cf: country, region, city',{c:v.country,r:v.region,ci:v.city});
  ok(!JSON.stringify(L.inserts).includes(IP)&&!JSON.stringify(L.inserts).includes('1.2.3.4'),'no IP stored anywhere (neither the real one nor one sent in the body)');
  ok(v.player_id===PID&&v.session_id===SID&&v.version==='v81'&&v.platform==='touch'&&v.lang==='en'&&v.test===false,'visit: ids, version, platform, language',v);
  ok(JSON.stringify(v.data)===JSON.stringify({scr:'phone',blang:'es',inst:true,go:true,ready:true,consent:'yes',load:8123,film:'skipped',filmS:7}),'visit data: whitelisted keys only, numbers rounded',v.data);
  ok(v.game===null&&v.round===null&&v.cause===null,'visit: no game / round / cause');
  ok(e.round===7&&e.game===2&&e.secs===612&&e.cause==='ship','end: round, game, play time, cause',e);
  ok(e.data.score===1e8&&e.data.combat===0&&e.data.cargo===900&&e.data.acc===100&&!('heads' in e.data),'end: numbers clamped (score 1e12 -> 1e8, -5 -> 0, acc 150 -> 100), a non-number dropped',e.data);
  ok(e.data.rt.length===60&&e.data.rt[3]===0&&e.data.rt[4]===0&&e.data.rt[0]===80,'end: round times cut to 60, bad entries 0',e.data.rt.slice(0,6));
  ok(e.test===false&&!('extra' in e.data)&&e.data.tut==='skip'&&e.data.tutStep===2&&e.data.qMax===3&&e.data.fps===48,'end: test only when exactly true, unknown keys dropped, tutorial / quality / fps kept',e.data);
  ok(x.kind==='error'&&x.data.msg.length===200&&!/\u0000/.test(x.data.msg)&&x.data.at.length===120&&x.data.n===2,'error: message trimmed to 200 and cleaned, place to 120',x.data);
  ok(qt.kind==='quit'&&qt.os==='other'&&qt.browser==='other'&&qt.lang===null&&qt.platform===null&&qt.player_id===null&&qt.cause===null&&qt.test===true&&qt.round===3&&JSON.stringify(qt.data)==='{"score":50}','quit: unknown OS / browser -> other, bad language / platform / player id -> null, no cause',qt);
  // single event, beacon body
  r=await post(fn,{kind:'quit',sid:SID,game:1,round:2,secs:30},{type:'text/plain;charset=UTF-8'});
  ok(r.status===204&&L.inserts.length===2&&L.inserts[1].rows.length===1,'a single event, sent as text/plain like sendBeacon -> 204',r.status);
  // limits
  // a Deploy Preview stores its events as tests
  L.inserts.length=0;r=await fn(new Request('https://example.test/api/m',{method:'POST',body:JSON.stringify({kind:'visit',sid:SID})}),ctx('198.51.100.3','deploy-preview'));
  ok(r.status===204&&L.inserts[0].rows[0].test===true,'a preview (preview URL on workers.dev): stored as a test (never in the numbers)',L.inserts[0]&&L.inserts[0].rows[0].test);
  r=await post(fn,'{not json');ok(r.status===400,'bad JSON -> 400',r.status);
  r=await post(fn,{e:[{kind:'nope'}]});ok(r.status===400,'nothing valid -> 400',r.status);
  r=await post(fn,{e:[{kind:'error',sid:SID,msg:'x'.repeat(17000)}]});ok(r.status===413,'body over 16 KB -> 413',r.status);
  L.inserts.length=0;r=await post(fn,{e:Array.from({length:20},()=>({kind:'error',sid:SID,msg:'m'}))});ok(r.status===204&&L.inserts[0].rows.length===12,'20 events -> only the first 12',L.inserts[0]&&L.inserts[0].rows.length);
  r=await fn(new Request('https://example.test/api/m'),ctx());ok(r.status===405,'GET /api/m -> 405',r.status);
  r=await fn(new Request('https://example.test/api/other'),ctx());ok(r.status===404,'another path -> 404',r.status);
  L.fail=true;r=await post(fn,{kind:'visit',sid:SID},{ip:'198.51.100.1'});ok(r.status===500,'database error -> 500',r.status);L.fail=false;
  // rate limit: IP already used 7 times above; 30 a minute
  let codes=[];for(let i=0;i<30;i++)codes.push((await post(fn,{kind:'visit',sid:SID})).status);
  ok(codes.slice(0,23).every(c=>c===204)&&codes.slice(23).every(c=>c===429),'the 31st request of one IP in a minute -> 429',codes.join(','));
  r=await post(fn,{kind:'visit',sid:SID},{ip:'198.51.100.2'});ok(r.status===204,'another IP is still fine',r.status);

  console.log('2) admin');
  r=await admin(fn,'?range=7d','x');ok(r.status===503,'no ADMIN_PASSWORD -> 503',r.status);
  ENV.ADMIN_PASSWORD='dorado-secreto-2026';
  r=await admin(fn,'?range=7d',null,'192.0.2.1');ok(r.status===401,'no key -> 401',r.status);
  r=await admin(fn,'?range=7d','dorado-secreto-2025','192.0.2.1');const j401=await r.json();ok(r.status===401&&/contraseña/.test(j401.error),'wrong key -> 401 with a clear message',j401);
  L.failPrune=true;
  r=await admin(fn,'?range=30d&platform=touch','dorado-secreto-2026','192.0.2.1');const st=await r.json();
  ok(L.rpcs.length===2&&L.rpcs[0].fn==='metrics_prune'&&r.status===200,'the first admin request runs metrics_prune first; it failing (SQL not run yet) does not stop the stats',L.rpcs.map(x=>x.fn));
  L.failPrune=false;
  ok(r.status===200&&r.headers.get('cache-control')==='no-store'&&/json/.test(r.headers.get('content-type')),'right key -> 200 JSON, not cached',r.status);
  ok(JSON.stringify(L.rpcs.at(-1))===JSON.stringify({fn:'metrics_stats',args:{p_range:'30d',p_platform:'touch'}}),'asks metrics_stats for 30d / touch',L.rpcs.at(-1));
  ok(st.range==='30d'&&st.platform==='touch'&&st.summary&&st.funnel&&st.causes&&st.countries&&st.errors&&st.quits&&st.daily,'answer: range, platform and every section',Object.keys(st));
  const keys=deepKeys(st);ok(!['session_id','player_id','sid','pid','id','ip'].some(k=>keys.has(k)),'no ids or IPs anywhere in the answer',[...keys].filter(k=>/id|ip/i.test(k)));
  await admin(fn,'?range=forever&platform=fridge','dorado-secreto-2026','192.0.2.1');ok(JSON.stringify(L.rpcs.at(-1).args)==='{"p_range":"7d","p_platform":"all"}','unknown range / platform -> 7d / all',L.rpcs.at(-1));
  ok(L.rpcs.filter(x=>x.fn==='metrics_prune').length===1,'metrics_prune not again within the day',L.rpcs.map(x=>x.fn));
  r=await fn(new Request('https://example.test/api/admin/stats',{method:'POST',headers:{'x-admin-key':'dorado-secreto-2026'}}),ctx('192.0.2.1'));ok(r.status===405,'POST to the stats -> 405',r.status);
  codes=[];for(let i=0;i<9;i++)codes.push((await admin(fn,'','guess'+i,'192.0.2.9')).status);
  ok(codes.slice(0,8).every(c=>c===401)&&codes[8]===429,'8 wrong tries from one IP, then 429',codes.join(','));
  r=await admin(fn,'','dorado-secreto-2026','192.0.2.9');ok(r.status===429,'that IP stays blocked even with the right key (15 min)',r.status);
  r=await admin(fn,'','dorado-secreto-2026','192.0.2.10');ok(r.status===200,'another IP gets in',r.status);
  L.fail=true;r=await admin(fn,'','dorado-secreto-2026','192.0.2.10');ok(r.status===500,'database error -> 500',r.status);L.fail=false;

  console.log('4) the Worker: request.cf, CF-Connecting-IP, rate limit binding, real site or preview');
  const one=async(cf,dc='production',ip)=>{L.inserts.length=0;const r=await fn(new Request('https://x/api/m',{method:'POST',body:JSON.stringify({kind:'visit',sid:SID})}),ctx(ip||'198.51.100.'+(100+(++NIP)),dc,cf));return {r,row:L.inserts[0]&&L.inserts[0].rows[0]};};let NIP=0;
  let o=await one({country:'FR',regionCode:'IDF',city:'Paris'});ok(o.r.status===204&&o.row.country==='FR'&&o.row.region==='IDF'&&o.row.city==='Paris','no region name from Cloudflare: its code',o.row);
  o=await one({country:'US',region:'California',regionCode:'CA',city:'San José'});ok(o.row.region==='California'&&o.row.city==='San José','the region name first; accents as they come',o.row);
  o=await one(null);ok(o.r.status===204&&o.row.country===null&&o.row.region===null&&o.row.city===null,'no request.cf (local run): no place, still saved',o.row);
  o=await one({country:'XXL',region:'R'.repeat(200),city:'C\u0000ity'});ok(o.row.country==='XX'&&o.row.region.length===80&&o.row.city==='C ity','geo cleaned like any text (2 / 80 / 80, no control characters)',o.row);
  for(const [dc,t] of [['www',false],['branch-deploy',true],['deploy-preview',true]]){o=await one(GEO,dc);ok(o.row.test===t,dc+' host -> test='+t,o.row.test);}
  {const ipx='198.51.100.222';codes=[];for(let i=0;i<31;i++){L.inserts.length=0;codes.push((await fn(new Request('https://x/api/m',{method:'POST',headers:{'x-forwarded-for':'10.1.1.'+i},body:JSON.stringify({kind:'visit',sid:SID})}),ctx(ipx))).status);}
   ok(codes.slice(0,30).every(c=>c===204)&&codes[30]===429,'the 30-a-minute limit counts CF-Connecting-IP (X-Forwarded-For changes nothing)',codes.join(','));}
  {const b=CFG.ratelimits.find(x=>x.name==='RL_METRICS');ok(b&&b.simple.limit===60&&b.simple.period===60&&b.namespace_id!==CFG.ratelimits.find(x=>x.name==='RL_RANKING').namespace_id,'wrangler.jsonc: RL_METRICS 60 a minute, its own namespace',b);
   const RL=ENV.RL_METRICS;RL.on=true;const ipr='192.0.2.150',n0=L.rpcs.length;codes=[];
   for(let i=0;i<61;i++)codes.push((await admin(fn,'?range=7d','dorado-secreto-2026',ipr)).status);
   ok(codes.slice(0,60).every(c=>c===200)&&codes[60]===429,'61st request in a minute from one IP -> 429 (Cloudflare\'s binding, before the handler)',codes.join(','));
   const r6=await admin(fn,'?range=7d','dorado-secreto-2026',ipr),j6=await r6.json();ok(r6.status===429&&j6.error==='demasiadas peticiones'&&L.rpcs.length===n0+60,'429 {"error":"demasiadas peticiones"}, the handler never reached',{j6,n:L.rpcs.length-n0});
   ok((await admin(fn,'?range=7d','dorado-secreto-2026','192.0.2.151')).status===200,'another IP: fine');
   L.inserts.length=0;const rb=await post(fn,{kind:'visit',sid:SID},{ip:ipr});ok(rb.status===429&&L.inserts.length===0,'/api/m too, for that IP');
   ok(RL.keys.every(k=>!k.includes(ipr))&&ENV.RL_RANKING.keys.length===0,'key = host + a hash of the IP; no metrics path goes through RL_RANKING');
   RL.on=false;}

  console.log('3) real @supabase/supabase-js, fetch replaced');
  if(!SBDIR)console.log('  skipped: @supabase/supabase-js is not installed (npm install, or HEADS_SB_DIR=...)');
  else{
    const calls=[];const realFetch=globalThis.fetch;
    globalThis.fetch=async(u,o={})=>{const url=String(u&&u.url||u),h=new Headers(o.headers||(u&&u.headers)||{});calls.push({url,method:o.method||'GET',apikey:h.get('apikey'),auth:h.get('authorization'),prefer:h.get('prefer'),body:o.body?String(o.body):''});
      if(url.includes('/rest/v1/rpc/'))return new Response(JSON.stringify(SAMPLE),{status:200,headers:{'content-type':'application/json'}});
      return new Response(null,{status:201});};
    const fr=bind((await import(WORKER+'?sb=real')).default,ENV);
    r=await post(fr,{e:[visit,end]},{ip:'198.51.100.50'});
    const c=calls[0]||{};
    ok(r.status===204&&/^https:\/\/abcdefgh\.supabase\.co\/rest\/v1\/events(\?|$)/.test(c.url)&&c.method==='POST','insert = POST '+String(c.url).split('?')[0],{status:r.status,c});
    ok(c.apikey==='sb_secret_TESTKEY_123','the secret key goes in the apikey header',c.apikey);
    let body=[];try{body=JSON.parse(c.body);}catch(_){}ok(Array.isArray(body)&&body.length===2&&body[0].country==='ES'&&!c.body.includes('198.51.100.50'),'body: the 2 clean rows, without the IP');
    ok(!/return=representation/.test(c.prefer||''),'no rows read back (insert only needs INSERT)',c.prefer);
    r=await admin(fr,'?range=all&platform=pc','dorado-secreto-2026','192.0.2.20');const d=calls.find(c=>c.url.endsWith('/rpc/metrics_stats'))||{},pr=calls.find(c=>c.url.endsWith('/rpc/metrics_prune'));
    ok(pr&&pr.method==='POST','metrics_prune = POST /rest/v1/rpc/metrics_prune',pr);
    ok(r.status===200&&d.url==='https://abcdefgh.supabase.co/rest/v1/rpc/metrics_stats'&&d.method==='POST'&&d.body==='{"p_range":"all","p_platform":"pc"}','stats = POST /rest/v1/rpc/metrics_stats with the range and platform',d);
    const sj=await r.json();ok(sj.summary&&sj.summary.visits===SAMPLE.summary.visits,'the totals come through');
    globalThis.fetch=realFetch;}
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
