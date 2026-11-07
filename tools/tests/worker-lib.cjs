// Shared bits for the Worker tests without a browser (v85): ranking-fn.cjs and metrics-fn.cjs run worker/index.ts in plain Node 22+
// (Node strips the TypeScript types itself), the same entry Cloudflare runs, with:
//   env          a plain object (the Worker's settings): PROD_HOSTS from wrangler.jsonc, ASSETS, the two rate limit bindings, and whatever the test sets
//   request.cf   set on the Request (country, region, regionCode, city), as Cloudflare does
//   IP           the CF-Connecting-IP header
//   host         the real site (goldenheads2021.com, www) or a preview (a preview URL, the workers.dev address): ctx(ip, dc) picks it like
//                Netlify's deploy contexts did: 'production' = the real site, 'deploy-preview' / 'branch-deploy' = previews
//   waitUntil    collected (fn.WAIT)
//   Supabase     replaced by the test's fake module (mock) or the real @supabase/supabase-js with fetch replaced (real): the loader below gives
//                each mode its own copy of the worker's modules (the ?sb= of the entry goes to every relative import), as the old tests did per file
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url'),{register}=require('module');
const ROOT=path.join(__dirname,'../..');
const WORKER=pathToFileURL(path.join(ROOT,'worker/index.ts')).href;
const HOSTS={production:'goldenheads2021.com',www:'www.goldenheads2021.com','deploy-preview':'cloudflare-goldenheads.santi.workers.dev','branch-deploy':'goldenheads.santi.workers.dev'};

// wrangler.jsonc as JSON (its comments are whole lines)
function wranglerConfig(){const t=fs.readFileSync(path.join(ROOT,'wrangler.jsonc'),'utf8');return JSON.parse(t.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n'));}

function hookSupabase(MOCK,SBDIR){
  register('data:text/javascript,'+encodeURIComponent(`import {pathToFileURL} from 'node:url';let DIR='';export function initialize(d){DIR=d.dir;}
export async function resolve(spec,ctx,next){const q=ctx.parentURL&&/[?&]sb=(mock|real)/.exec(ctx.parentURL);
 if(spec==='@supabase/supabase-js'){
  if(q&&q[1]==='real'&&DIR)return next(spec,{...ctx,parentURL:pathToFileURL(DIR+'/x.mjs').href});
  return {url:'data:text/javascript,'+encodeURIComponent(${JSON.stringify(MOCK)}),shortCircuit:true};}
 if(q&&/^\\.\\.?\\//.test(spec)){const r=await next(spec,ctx);return r.url.startsWith('file:')&&!r.url.includes('?')?{...r,url:r.url+'?sb='+q[1]}:r;}
 return next(spec,ctx);}`),{data:{dir:SBDIR}});}

// Cloudflare's rate limit binding, counting per key like the real one (off = always allowed, so the older checks see only the handlers' own limits)
function limiter(limit,period){const M=new Map();const o={on:false,keys:[],limit:async({key})=>{o.keys.push(key);if(!o.on)return {success:true};
  const now=Date.now();let h=M.get(key);if(!h||now-h.t>period*1000){h={n:0,t:now};M.set(key,h);}return {success:++h.n<=limit};}};return o;}

// the env object the tests keep changing (ENV.X = ..., delete ENV.X), with the parts wrangler.jsonc declares
function makeEnv(){const cfg=wranglerConfig(),rl={};
  for(const b of cfg.ratelimits)rl[b.name]=limiter(b.simple.limit,b.simple.period);
  // the static assets: a page for any path; for the streamed media (worker/media.ts) a 100 000-byte file and assets/media.json with its size
  // (assets.noSizes = no media.json), answered like Cloudflare's: 200, whole file, no Content-Length the Worker can read
  const assets={calls:[],noSizes:false,FILM:Uint8Array.from({length:100000},(_,i)=>(i*7+3)%251),fetch:async req=>{const p=new URL(req.url).pathname;assets.calls.push(req.url);
    if(p.endsWith('/assets/media.json'))return assets.noSizes?new Response('404 not found',{status:404}):new Response(JSON.stringify({'opening.mp4':assets.FILM.length,'music/game.mp3':assets.FILM.length}),{headers:{'content-type':'application/json'}});
    if(/\/assets\/(opening\.mp4|music\/[\w-]+\.mp3)$/.test(p))return new Response(req.method==='HEAD'?null:new Blob([assets.FILM]).stream(),{status:200,headers:{'content-type':p.endsWith('.mp4')?'video/mp4':'audio/mpeg',etag:'"film"'}});
    return new Response('<!doctype html>asset '+p,{status:200,headers:{'content-type':'text/html'}});}};
  return {cfg,env:{PROD_HOSTS:cfg.vars.PROD_HOSTS,ASSETS:assets,...rl}};}

const ctx=(ip='203.0.113.5',dc='production',cf={})=>({ip,dc,cf});
// call the Worker as Cloudflare would: the test's request moved to the host of the context, with CF-Connecting-IP and request.cf
function bind(W,env){const WAIT=[];
  const fn=async(rq,c=ctx())=>{const u=new URL(rq.url);u.protocol='https:';u.host=c.host||HOSTS[c.dc]||c.dc;
    const h=new Headers(rq.headers);if(c.ip)h.set('cf-connecting-ip',c.ip);
    const init={method:rq.method,headers:h};if(!['GET','HEAD'].includes(rq.method))init.body=await rq.arrayBuffer();
    const r2=new Request(u,init);if(c.cf!==undefined)Object.defineProperty(r2,'cf',{value:c.cf,enumerable:true});
    return W.fetch(r2,env,{waitUntil:p=>{WAIT.push(p);}});};
  fn.WAIT=WAIT;return fn;}

// Cloudflare's cache of the data centre (caches.default) as far as the Worker uses it: match / put, honouring max-age
function fakeCaches(){const M=new Map(),log=[];const d={log,match:async k=>{const e=M.get(k.url);log.push(['match',k.url,!!e]);if(!e||Date.now()>e.exp)return undefined;return new Response(e.body,{headers:e.headers});},
  put:async(k,r)=>{const cc=r.headers.get('cache-control')||'',m=/max-age=(\d+)/.exec(cc);log.push(['put',k.url,cc]);M.set(k.url,{body:await r.text(),headers:[...r.headers],exp:Date.now()+(m?+m[1]*1000:0)});},
  expire:()=>{for(const e of M.values())e.exp=0;},size:()=>M.size};return {default:d};}

module.exports={ROOT,WORKER,HOSTS,wranglerConfig,hookSupabase,makeEnv,ctx,bind,fakeCaches};
