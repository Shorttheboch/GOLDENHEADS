// Google accounts and the Season 1 ranking (v82): the Netlify function netlify/functions/ranking.mts in plain Node (22+), no Netlify, no Supabase.
//   node tools/tests/ranking-fn.cjs
// Supabase is replaced twice, as in metrics-fn.cjs:
//   mock  a fake @supabase/supabase-js that records what the function asks of it: auth.getUser(token), auth.admin.deleteUser(id), rpc(fn, args)
//   real  the real @supabase/supabase-js with fetch replaced, to see the HTTP requests it makes (when the package is installed)
// What it checks:
//   /api/auth     the Supabase URL and the PUBLISHABLE key from the environment (503 without them, never a sb_secret_ key), cacheable
//   /api/run      a signed token; the key is derived (RANK_SECRET if set, else SUPABASE_SECRET_KEY) and differs between the real site and previews
//   /api/scores   the board of season 1, real runs on the real site and test runs on previews, cached 20 s by Netlify's CDN
//   sessions      no / bad Authorization -> 401, an account that is not Google -> 403, the player id always from Supabase Auth (never from the body)
//   /api/nick     terms must be accepted, format (3-12, letters, digits, ÁÉÍÓÚÜÑÇ . _ -, at least 3 letters or digits), upper case, bad words
//                 (also with 0/1/3/4/5/7 for letters), reserved names, taken / exists from the database, preview flag, limit per IP
//   /api/save     token signature, age (4 h), one use ('used' from the database), plausibility as before v82, flags (no clock, clock, fast, score)
//                 that save the run as 'flagged', stats whitelisted, nickname missing / banned, previews saved as test
//   /api/forget   the player and its runs (rank_forget) and the Supabase Auth user (admin deleteUser); any account may delete itself
//   admin         ADMIN_PASSWORD (503 / 401 / 429 after 8 wrong tries), rank_admin for the page, hide / show / ban / unban validated
const path=require('path'),{pathToFileURL}=require('url'),{register}=require('module'),{createHmac}=require('crypto');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,700):''));if(!c)bad++;};
const ROOT=path.join(__dirname,'../..'),FN=pathToFileURL(path.join(ROOT,'netlify/functions/ranking.mts')).href;
const MOCK=`export function createClient(url,key,opts){const L=globalThis.__sb;L.created.push({url,key,opts});return {
  auth:{getUser(t){L.getUser.push(t);const u=L.users[t];return Promise.resolve(u?{data:{user:u},error:null}:{data:{user:null},error:{message:'invalid JWT'}});},
        admin:{deleteUser(id){L.deleted.push(id);return Promise.resolve(L.failDelete?{data:null,error:{message:'auth down'}}:{data:{},error:null});}}},
  rpc(fn,args){L.rpcs.push({fn,args});if(L.fail)return Promise.resolve({data:null,error:{message:'db down'}});
    const h=L.answers[fn];return Promise.resolve({data:typeof h==='function'?h(args):h===undefined?null:h,error:null});}};}`;
let SBDIR='';try{require.resolve('@supabase/supabase-js',{paths:[ROOT]});SBDIR=ROOT;}catch(_){}
register('data:text/javascript,'+encodeURIComponent(`import {pathToFileURL} from 'node:url';let DIR='';export function initialize(d){DIR=d.dir;}
export async function resolve(spec,ctx,next){if(spec==='@supabase/supabase-js'){
  if(ctx.parentURL&&ctx.parentURL.includes('sb=real')&&DIR)return next(spec,{...ctx,parentURL:pathToFileURL(DIR+'/x.mjs').href});
  return {url:'data:text/javascript,'+encodeURIComponent(${JSON.stringify(MOCK)}),shortCircuit:true};}
 return next(spec,ctx);}`),{data:{dir:SBDIR}});

const ENV={};globalThis.Netlify={env:{get:k=>ENV[k]}};
const ctx=(ip='203.0.113.5',dc='production')=>({ip,geo:{},params:{},deploy:{context:dc,id:'d1',published:dc==='production'}});
const U1='5b0e2f1c-1111-4aaa-8bbb-000000000001',U2='5b0e2f1c-2222-4aaa-8bbb-000000000002',U3='5b0e2f1c-3333-4aaa-8bbb-000000000003';
const USERS={'tok-google':{id:U1,email:'santi@gmail.com',app_metadata:{provider:'google',providers:['google']}},
  'tok-google2':{id:U2,email:'otro@gmail.com',app_metadata:{provider:'google',providers:['google']}},
  'tok-email':{id:U3,email:'x@y.z',app_metadata:{provider:'email',providers:['email']}}};
const BOARD={count:3,top:[{pos:1,nick:'ORION',score:9000,round:9,me:false},{pos:2,nick:'SANTI',score:5000,round:6,me:true},{pos:3,nick:'LUNA',score:100,round:1,me:false}],me:{pos:2,nick:'SANTI',score:5000,round:6}};
const fresh=()=>{globalThis.__sb={created:[],getUser:[],deleted:[],rpcs:[],fail:false,failDelete:false,users:USERS,answers:{
  rank_board:BOARD,rank_player:a=>a.p_player===U1?{nick:'SANTI',banned:false,best:{score:5000,round:6},pos:2,count:3}:null,
  rank_nick:a=>({ok:true,nick:a.p_nick}),rank_submit:a=>({saved:true,status:a.p_status,nick:'SANTI',new_best:true,prev_best:4000,best:{score:a.p_score,round:a.p_round},board:BOARD}),
  rank_forget:{runs:4,player:true},rank_admin:{summary:{players:3},top:[],recent:[],flagged:[],banned:[]},rank_moderate:{ok:true}}};return globalThis.__sb;};
const req=(fn,p,{method='GET',body,auth,ip,dc,admin,type}={})=>{const h={};if(auth)h.authorization='Bearer '+auth;if(admin!=null)h['x-admin-key']=admin;if(body!==undefined)h['content-type']=type||'application/json';
  return fn(new Request('https://example.test'+p,{method,headers:h,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}),ctx(ip,dc));};
const J=async r=>{try{return await r.json();}catch(_){return null;}};
// a run token made the way the function makes them (to have one that started minutes ago, or one that is too old)
const keyOf=(base,scope)=>createHmac('sha256',base).update('heads-run-token|v82|'+scope).digest();
const forge=(key,agoS,id='0123456789abcdef')=>{const p=`${Date.now()-agoS*1000}.${id}`;return p+'.'+createHmac('sha256',key).update(p).digest('base64url');};
let IPN=0;const nip=()=>'198.51.100.'+(++IPN);

(async()=>{
  console.log('1) mock Supabase client');
  const fn=(await import(FN+'?sb=mock')).default;let L=fresh();
  let r=await req(fn,'/api/auth');ok(r.status===503,'/api/auth without the variables -> 503',r.status);
  r=await req(fn,'/api/run',{method:'POST'});ok(r.status===503,'/api/run without any secret -> 503',r.status);
  r=await req(fn,'/api/scores');ok(r.status===503,'/api/scores without Supabase -> 503',r.status);
  Object.assign(ENV,{SUPABASE_URL:'https://abcdefgh.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TESTKEY_123',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_PUBKEY_456'});
  r=await req(fn,'/api/auth');let j=await J(r);
  ok(r.status===200&&j.url==='https://abcdefgh.supabase.co'&&j.key==='sb_publishable_PUBKEY_456'&&Object.keys(j).length===2,'/api/auth -> the URL and the publishable key, nothing else',j);
  ok(/public, max-age=300/.test(r.headers.get('cache-control')||''),'/api/auth can be cached (5 min)',r.headers.get('cache-control'));
  ENV.SUPABASE_PUBLISHABLE_KEY='sb_secret_OOPS';r=await req(fn,'/api/auth');ok(r.status===503,'a secret key put in SUPABASE_PUBLISHABLE_KEY by mistake is never handed out -> 503',r.status);
  ENV.SUPABASE_PUBLISHABLE_KEY='sb_publishable_PUBKEY_456';
  r=await req(fn,'/api/auth',{method:'POST'});ok(r.status===405,'POST /api/auth -> 405',r.status);

  console.log('2) run tokens');
  r=await req(fn,'/api/run',{method:'POST'});j=await J(r);
  ok(r.status===200&&/^\d{13}\.[0-9a-f]{16}\.[A-Za-z0-9_-]{43}$/.test(j.token),'a token: start.id.signature',j);
  const KP=keyOf('sb_secret_TESTKEY_123','prod'),KT=keyOf('sb_secret_TESTKEY_123','test');
  const [t0,id0,s0]=j.token.split('.');ok(createHmac('sha256',KP).update(t0+'.'+id0).digest('base64url')===s0,'without RANK_SECRET: signed with HMAC(SUPABASE_SECRET_KEY, "heads-run-token|v82|prod")');
  ok(Math.abs(Number(t0)-Date.now())<2000,'it carries the server time');
  r=await req(fn,'/api/run',{method:'POST',dc:'deploy-preview'});const tp=(await J(r)).token,[a1,b1,c1]=tp.split('.');
  ok(createHmac('sha256',KT).update(a1+'.'+b1).digest('base64url')===c1,'on a preview: HMAC(SUPABASE_SECRET_KEY, "...|test") (previews work without RANK_SECRET)');
  ENV.RANK_SECRET='rank-secret-prod';r=await req(fn,'/api/run',{method:'POST'});const tr=(await J(r)).token,[a2,b2,c2]=tr.split('.');
  ok(createHmac('sha256',keyOf('rank-secret-prod','prod')).update(a2+'.'+b2).digest('base64url')===c2,'with RANK_SECRET (production): HMAC(RANK_SECRET, "...|prod")');
  delete ENV.RANK_SECRET;
  r=await req(fn,'/api/run');ok(r.status===405,'GET /api/run -> 405',r.status);

  console.log('3) the board');
  r=await req(fn,'/api/scores');j=await J(r);
  ok(r.status===200&&j.season===1&&j.count===3&&j.top.length===3&&!('me' in j),'season, count, top (no "me" without a session)',j);
  ok(JSON.stringify(L.rpcs.at(-1))===JSON.stringify({fn:'rank_board',args:{p_season:1,p_test:false,p_limit:10,p_player:null}}),'rank_board(1, real, 10, nobody)',L.rpcs.at(-1));
  ok(/s-maxage=20/.test(r.headers.get('netlify-cdn-cache-control')||''),'cached 20 s by the CDN',r.headers.get('netlify-cdn-cache-control'));
  await req(fn,'/api/scores',{dc:'deploy-preview'});ok(L.rpcs.at(-1).args.p_test===true,'on a preview: the test board');
  await req(fn,'/api/scores',{dc:'branch-deploy'});ok(L.rpcs.at(-1).args.p_test===true,'on a branch deploy: the test board too');
  ok(L.created.length===1&&L.created[0].key==='sb_secret_TESTKEY_123'&&L.created[0].opts.auth.persistSession===false,'one server client, with the secret key, no session kept',L.created);
  L.fail=true;r=await req(fn,'/api/scores');ok(r.status===500,'database error -> 500',r.status);L.fail=false;

  console.log('4) sessions');
  r=await req(fn,'/api/me');ok(r.status===401&&(await J(r)).error==='session','no Authorization -> 401 session',r.status);
  r=await req(fn,'/api/me',{auth:'tok-nope'});ok(r.status===401,'a token Supabase Auth does not know -> 401',r.status);
  ok(L.getUser.at(-1)==='tok-nope','the token is checked with Supabase Auth (getUser)');
  r=await fn(new Request('https://example.test/api/me',{headers:{authorization:'Basic abc'}}),ctx());ok(r.status===401,'not a Bearer -> 401',r.status);
  r=await req(fn,'/api/me',{auth:'tok-email'});ok(r.status===403&&(await J(r)).error==='google','an account that is not Google (email / anonymous) -> 403 google',r.status);
  r=await req(fn,'/api/me',{auth:'tok-google'});j=await J(r);
  ok(r.status===200&&j.player&&j.player.nick==='SANTI'&&j.player.best.score===5000,'/api/me with a Google session -> the player',j);
  ok(JSON.stringify(L.rpcs.at(-1))===JSON.stringify({fn:'rank_player',args:{p_player:U1,p_season:1,p_test:false}}),'rank_player with the id from Supabase Auth',L.rpcs.at(-1));
  r=await req(fn,'/api/me',{auth:'tok-google2'});j=await J(r);ok(r.status===200&&j.player===null,'an account without a nickname -> player null',j);
  r=await req(fn,'/api/me',{method:'POST',auth:'tok-google'});ok(r.status===405,'POST /api/me -> 405',r.status);
  r=await req(fn,'/api/save',{auth:'tok-google'});ok(r.status===405,'GET /api/save -> 405',r.status);

  console.log('5) nicknames');
  const nick=(n,o={})=>req(fn,'/api/nick',{method:'POST',auth:o.auth||'tok-google2',ip:o.ip||nip(),dc:o.dc,body:{nick:n,accept:o.accept??true,player:U1}});
  r=await nick('NOVA',{accept:false});ok(r.status===400&&(await J(r)).error==='terms','without accepting the privacy page and the rules -> 400 terms',r.status);
  r=await nick('nova');j=await J(r);const nr=L.rpcs.at(-1);
  ok(r.status===200&&j.ok&&j.nick==='NOVA','«nova» -> NOVA',j);
  ok(nr.fn==='rank_nick'&&nr.args.p_player===U2&&nr.args.p_nick==='NOVA'&&nr.args.p_terms_ver==='2026-11-v82'&&nr.args.p_preview===false,'rank_nick: the session\'s id (not the one in the body), upper case, terms version',nr);
  r=await nick('Sántí_7');ok(r.status===200&&L.rpcs.at(-1).args.p_nick==='SÁNTÍ_7','accents and _ kept as written, upper case: SÁNTÍ_7',L.rpcs.at(-1).args);
  r=await nick('peña.ç-ü');ok(r.status===200&&L.rpcs.at(-1).args.p_nick==='PEÑA.Ç-Ü','Ñ Ç Ü . - allowed',L.rpcs.at(-1).args);
  for(const n of ['ab','abcdefghijklm','hola mundo','josé😀','<script>','a.b','..._','àlex','Ünï',' ','',null,12345678]){r=await nick(n);const e=(await J(r)||{}).error;ok(r.status===400&&e==='format','«'+n+'» -> format',{s:r.status,e});}
  for(const n of ['puta','PUTO.X','mierda','Fuck_you','m1erda','p0lla','j0der','cabrón','maricón','NAZI88','hitler','gilipollas','B1TCH']){r=await nick(n);const e=(await J(r)||{}).error;ok(r.status===400&&e==='bad','«'+n+'» -> bad word',{s:r.status,e});}
  for(const n of ['heads','Heads_Fan','admin1','SUPERADMIN','vega','Piloto','IRIS','nugget','capitán','h3ads','GoldenHeads']){r=await nick(n);const e=(await J(r)||{}).error;ok(r.status===400&&e==='reserved','«'+n+'» -> reserved',{s:r.status,e});}
  L.answers.rank_nick={error:'taken'};r=await nick('ORION');ok(r.status===409&&(await J(r)).error==='taken','taken in the database -> 409 taken',r.status);
  L.answers.rank_nick={error:'exists',nick:'NOVA'};r=await nick('OTRO');j=await J(r);ok(r.status===409&&j.error==='exists'&&j.nick==='NOVA','this account already has one -> 409 exists + its nickname (it cannot be changed)',j);
  L.answers.rank_nick=a=>({ok:true,nick:a.p_nick});
  r=await nick('TESTER',{dc:'deploy-preview'});ok(r.status===200&&L.rpcs.at(-1).args.p_preview===true,'chosen on a preview: marked from_preview');
  r=await nick('NOVA',{auth:'tok-email'});ok(r.status===403,'not Google -> 403',r.status);
  const ipn=nip();let codes=[];for(let i=0;i<21;i++)codes.push((await nick('NOVA',{ip:ipn})).status);
  ok(codes.slice(0,20).every(c=>c===200)&&codes[20]===429,'21st nickname try from one IP in 10 minutes -> 429',codes.join(','));
  r=await req(fn,'/api/nick',{method:'POST',auth:'tok-google2',ip:nip(),body:'{not json'});ok(r.status===400,'bad JSON -> 400',r.status);

  console.log('6) saving a run');
  const save=(b,o={})=>req(fn,'/api/save',{method:'POST',auth:o.auth||'tok-google',ip:o.ip||nip(),dc:o.dc,body:b});
  const GOOD={score:4200,round:4,secs:580,plat:'touch',lang:'en',stats:{kills:31,heads:7,acc:44,saved:900,repairs:3,combat:1200,cargo:3000,spit:0,inc:0,eggs:0,xp:1,evil:'<b>',ip:'1.2.3.4'},player:U2};
  r=await save({...GOOD,token:forge(KP,600)});j=await J(r);const sv=L.rpcs.at(-1);
  ok(r.status===200&&j.saved&&j.status==='ok'&&j.newBest===true&&j.prevBest===4000&&j.best.score===4200&&j.count===3&&j.top.length===3&&j.me.pos===2&&j.nick==='SANTI','saved: status, new best, best, place and top',j);
  ok(sv.fn==='rank_submit'&&sv.args.p_player===U1&&sv.args.p_token==='0123456789abcdef'&&sv.args.p_score===4200&&sv.args.p_round===4&&Math.abs(sv.args.p_secs-600)<=1,'rank_submit: the session\'s id (not the body\'s), the token id, score, round, server-measured seconds (600)',sv.args);
  ok(sv.args.p_platform==='touch'&&sv.args.p_lang==='en'&&sv.args.p_version==='v82'&&sv.args.p_test===false&&sv.args.p_season===1&&sv.args.p_status==='ok'&&sv.args.p_flags.length===0,'platform, language, version, real (not test), season 1, ok, no flags',sv.args);
  ok(JSON.stringify(sv.args.p_stats)===JSON.stringify({kills:31,heads:7,acc:44,saved:900,repairs:3,combat:1200,cargo:3000,spit:0,inc:0,eggs:0,xp:1,csecs:580}),'stats whitelisted (unknown keys dropped) + the game\'s clock (csecs)',sv.args.p_stats);
  r=await save({...GOOD,token:forge(KT,600)});ok(r.status===400&&(await J(r)).error==='token','a preview token on the real site -> token',r.status);
  r=await save({...GOOD,token:forge(KP,600)},{dc:'deploy-preview'});ok(r.status===400,'a real-site token on a preview -> token',r.status);
  r=await save({...GOOD,token:forge(KT,600)},{dc:'deploy-preview'});ok(r.status===200&&L.rpcs.at(-1).args.p_test===true,'a preview saves its runs as test');
  r=await save({...GOOD,token:forge(KP,600).replace(/.$/,c=>c==='A'?'B':'A')});ok(r.status===400&&(await J(r)).error==='token','a changed signature -> token',r.status);
  r=await save({...GOOD});ok(r.status===400,'no token -> token',r.status);
  r=await save({...GOOD,token:forge(KP,4*3600+60)});ok(r.status===400&&(await J(r)).error==='expired','a token older than 4 h -> expired (a pending run is valid 4 h)',r.status);
  r=await save({...GOOD,token:forge(KP,1)});ok(r.status===400&&(await J(r)).error==='implausible','saved 1 s after it started -> implausible',r.status);
  r=await save({...GOOD,round:60,token:forge(KP,600)});ok(r.status===400&&(await J(r)).error==='implausible','60 rounds in 10 minutes -> implausible',r.status);
  r=await save({...GOOD,score:3000*4+400*600+500,token:forge(KP,600)});ok(r.status===400&&(await J(r)).error==='implausible','points faster than possible -> implausible',r.status);
  for(const s of [0,-5,'x',2e7])ok((await save({...GOOD,score:s,token:forge(KP,600)})).status===400,'score '+JSON.stringify(s)+' -> 400');
  // flags
  const flagged=async(b,want,m)=>{r=await save({...GOOD,...b,token:forge(KP,b._ago||600)});const a=L.rpcs.at(-1).args;ok(r.status===200&&a.p_status==='flagged'&&JSON.stringify(a.p_flags)===JSON.stringify(want)&&(await J(r)).status==='flagged',m+' -> flagged '+want.join(','),{s:r.status,a:a.p_flags,st:a.p_status});};
  await flagged({secs:undefined},['no_clock'],'no game clock');
  await flagged({secs:700},['clock'],'the game says 700 s of play, the server saw 600');
  await flagged({secs:100,round:9},['fast'],'9 rounds in 100 s of play');
  await flagged({score:6001*4,secs:580},['score'],'more than 6000 points a round');
  r=await save({...GOOD,secs:590,token:forge(KP,600)});ok(L.rpcs.at(-1).args.p_status==='ok','590 s of game clock for 600 s of server time: ok (pauses and the login only make the server time longer)');
  L.answers.rank_submit={error:'nick'};r=await save({...GOOD,token:forge(KP,600)});ok(r.status===403&&(await J(r)).error==='nick','no nickname yet -> 403 nick',r.status);
  L.answers.rank_submit={error:'banned'};r=await save({...GOOD,token:forge(KP,600)});ok(r.status===403&&(await J(r)).error==='banned','banned -> 403 banned',r.status);
  L.answers.rank_submit={error:'used'};r=await save({...GOOD,token:forge(KP,600)});ok(r.status===409&&(await J(r)).error==='used','the same run again -> 409 used (claimed once)',r.status);
  L.answers.rank_submit=a=>({saved:true,status:a.p_status,nick:'SANTI',new_best:false,prev_best:9000,best:{score:9000,round:9},board:BOARD});
  r=await save({...GOOD,token:forge(KP,600)});j=await J(r);ok(j.newBest===false&&j.best.score===9000,'not a new best: says so, with the best',j);
  r=await save({...GOOD,token:forge(KP,600)},{auth:'tok-email'});ok(r.status===403,'not Google -> 403',r.status);
  r=await save({...GOOD,token:forge(KP,600)},{auth:'tok-bad'});ok(r.status===401,'no valid session -> 401',r.status);
  r=await req(fn,'/api/save',{method:'POST',auth:'tok-google',ip:nip(),body:'x'.repeat(9000)});ok(r.status===400,'a body over 8 KB -> 400',r.status);
  L.fail=true;r=await save({...GOOD,token:forge(KP,600)});ok(r.status===500,'database error -> 500',r.status);L.fail=false;

  console.log('7) deleting the account');
  r=await req(fn,'/api/forget',{method:'POST',auth:'tok-google',ip:nip()});j=await J(r);
  ok(r.status===200&&j.deleted&&j.runs===4,'deleted: player and runs',j);
  ok(L.rpcs.at(-1).fn==='rank_forget'&&L.rpcs.at(-1).args.p_player===U1&&L.deleted.at(-1)===U1,'rank_forget and auth.admin.deleteUser, both with the session\'s id',{r:L.rpcs.at(-1),d:L.deleted});
  r=await req(fn,'/api/forget',{method:'POST',auth:'tok-email',ip:nip()});ok(r.status===200&&L.deleted.at(-1)===U3,'any account may delete itself (also a non-Google one)');
  L.failDelete=true;r=await req(fn,'/api/forget',{method:'POST',auth:'tok-google',ip:nip()});j=await J(r);ok(r.status===502&&j.error==='auth'&&j.runs===4,'the Auth user could not be deleted -> 502 auth (the game data is gone already)',j);L.failDelete=false;
  r=await req(fn,'/api/forget',{method:'POST',ip:nip()});ok(r.status===401,'no session -> 401',r.status);
  const ipf=nip();codes=[];for(let i=0;i<7;i++)codes.push((await req(fn,'/api/forget',{method:'POST',auth:'tok-google',ip:ipf})).status);ok(codes[6]===429,'7th delete from one IP in an hour -> 429',codes.join(','));

  console.log('8) admin');
  const adm=(o={})=>req(fn,'/api/admin/ranking',{ip:o.ip||'192.0.2.1',admin:o.key,method:o.method,body:o.body,dc:o.dc});
  r=await adm({key:'x'});ok(r.status===503,'no ADMIN_PASSWORD -> 503',r.status);
  ENV.ADMIN_PASSWORD='dorado-secreto-2026';
  r=await adm({});ok(r.status===401,'no key -> 401',r.status);
  r=await adm({key:'nope'});ok(r.status===401,'wrong key -> 401',r.status);
  r=await adm({key:'dorado-secreto-2026'});j=await J(r);
  ok(r.status===200&&j.season===1&&j.test===false&&j.summary&&Array.isArray(j.top)&&Array.isArray(j.flagged)&&j.at,'GET: season, real runs, summary and lists',j);
  ok(JSON.stringify(L.rpcs.at(-1))===JSON.stringify({fn:'rank_admin',args:{p_season:1,p_test:false,p_limit:50}}),'rank_admin(1, real, 50)',L.rpcs.at(-1));
  await adm({key:'dorado-secreto-2026',dc:'deploy-preview'});ok(L.rpcs.at(-1).args.p_test===true,'on a preview: the test runs');
  const act=b=>adm({key:'dorado-secreto-2026',method:'POST',body:b});
  r=await act({action:'hide',run:42});ok(r.status===200&&JSON.stringify(L.rpcs.at(-1))===JSON.stringify({fn:'rank_moderate',args:{p_action:'hide',p_run:42,p_player:null,p_note:null}}),'hide run 42',L.rpcs.at(-1));
  r=await act({action:'show',run:42});ok(r.status===200&&L.rpcs.at(-1).args.p_action==='show','show run 42');
  r=await act({action:'ban',player:U2,note:'  trampas\u0000 con la consola  '});ok(r.status===200&&L.rpcs.at(-1).args.p_player===U2&&L.rpcs.at(-1).args.p_note==='trampas con la consola','ban a player, with a cleaned note',L.rpcs.at(-1).args);
  r=await act({action:'unban',player:U2});ok(r.status===200&&L.rpcs.at(-1).args.p_action==='unban','unban');
  const n0=L.rpcs.length;
  for(const b of [{action:'hide'},{action:'hide',run:'42'},{action:'hide',run:-1},{action:'ban'},{action:'ban',player:'not-a-uuid'},{action:'drop',run:1},{}])ok((await act(b)).status===400,'refused: '+JSON.stringify(b));
  ok(L.rpcs.length===n0,'(none of them reached the database)');
  L.answers.rank_moderate={error:'notfound'};r=await act({action:'hide',run:999});ok(r.status===404,'unknown run -> 404',r.status);L.answers.rank_moderate={ok:true};
  r=await req(fn,'/api/admin/ranking',{method:'DELETE',admin:'dorado-secreto-2026'});ok(r.status===405,'DELETE -> 405',r.status);
  codes=[];for(let i=0;i<9;i++)codes.push((await adm({key:'guess'+i,ip:'192.0.2.9'})).status);
  ok(codes.slice(0,8).every(c=>c===401)&&codes[8]===429,'8 wrong tries from one IP, then 429',codes.join(','));
  r=await adm({key:'dorado-secreto-2026',ip:'192.0.2.9'});ok(r.status===429,'that IP stays out even with the right key',r.status);
  r=await adm({key:'dorado-secreto-2026',ip:'192.0.2.10'});ok(r.status===200,'another IP gets in',r.status);
  r=await req(fn,'/api/other');ok(r.status===404,'another path -> 404',r.status);

  console.log('9) real @supabase/supabase-js, fetch replaced');
  if(!SBDIR)console.log('  skipped: @supabase/supabase-js is not installed (npm install)');
  else{
    const calls=[];const realFetch=globalThis.fetch;
    globalThis.fetch=async(u,o={})=>{const url=String(u&&u.url||u),h=new Headers(o.headers||(u&&u.headers)||{});calls.push({url,method:o.method||'GET',apikey:h.get('apikey'),auth:h.get('authorization'),body:o.body?String(o.body):''});
      if(url.endsWith('/auth/v1/user'))return h.get('authorization')==='Bearer good-jwt'?new Response(JSON.stringify({id:U1,aud:'authenticated',role:'authenticated',email:'santi@gmail.com',app_metadata:{provider:'google',providers:['google']},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}),{status:200,headers:{'content-type':'application/json'}})
        :new Response(JSON.stringify({code:401,error_code:'bad_jwt',msg:'invalid JWT'}),{status:401,headers:{'content-type':'application/json'}});
      if(url.includes('/auth/v1/admin/users/'))return new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/rest/v1/rpc/rank_player'))return new Response(JSON.stringify({nick:'SANTI',banned:false,best:null,pos:null,count:0}),{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/rest/v1/rpc/rank_forget'))return new Response(JSON.stringify({runs:2,player:true}),{status:200,headers:{'content-type':'application/json'}});
      return new Response('null',{status:200,headers:{'content-type':'application/json'}});};
    const fr=(await import(FN+'?sb=real')).default;
    r=await req(fr,'/api/me',{auth:'good-jwt',ip:nip()});j=await J(r);
    const gu=calls.find(c=>c.url.endsWith('/auth/v1/user')),rp=calls.find(c=>c.url.includes('/rpc/rank_player'));
    ok(r.status===200&&j.player.nick==='SANTI','/api/me with the real client -> 200',{s:r.status,j});
    ok(gu&&gu.url==='https://abcdefgh.supabase.co/auth/v1/user'&&gu.auth==='Bearer good-jwt'&&gu.apikey==='sb_secret_TESTKEY_123','the session is checked with GET /auth/v1/user, Bearer = the player\'s token, apikey = the secret key',gu);
    ok(rp&&rp.method==='POST'&&JSON.parse(rp.body).p_player===U1&&rp.auth==='Bearer sb_secret_TESTKEY_123'||rp&&rp.apikey==='sb_secret_TESTKEY_123','rank_player = POST /rest/v1/rpc/rank_player with the secret key and the checked id',rp);
    calls.length=0;r=await req(fr,'/api/me',{auth:'bad-jwt',ip:nip()});ok(r.status===401,'a token Supabase refuses -> 401',r.status);
    calls.length=0;r=await req(fr,'/api/forget',{method:'POST',auth:'good-jwt',ip:nip()});const du=calls.find(c=>c.url.includes('/auth/v1/admin/users/'));
    ok(r.status===200&&du&&du.method==='DELETE'&&du.url.endsWith('/auth/v1/admin/users/'+U1),'delete = DELETE /auth/v1/admin/users/<the session\'s id>',du);
    globalThis.fetch=realFetch;}
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
