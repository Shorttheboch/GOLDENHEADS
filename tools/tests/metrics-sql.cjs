// Anonymous metrics (v81): supabase/schema.sql against a real local PostgreSQL (no browser, no Supabase).
// Needs psql and a server you can create databases on, given with the usual libpq variables, and HEADS_PG=1:
//   HEADS_PG=1 PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres node tools/tests/metrics-sql.cjs
// What it checks:
//   - the script runs twice without errors (idempotent), with the Supabase roles anon / authenticated / service_role (BYPASSRLS) as on Supabase
//   - RLS on, no policies; anon and authenticated can neither read, write nor call the stats; service_role can insert and call metrics_stats but not read rows
//   - metrics_stats on a small hand-made set: every number (visits, games, funnel, causes, quits, round times, errors, consent, returning players,
//     left without playing, test games left out, platform filter, range filter)
//   - a realistic month of fake play (about 600 visits) for the shape and the speed; its result is saved as tools/tests/metrics-stats-sample.json,
//     the fake answer the admin page test (admin.cjs) and the function test (metrics-fn.cjs) use
// It works in its own database (heads_mt_test), dropped at the end.
const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path');
if(!process.env.HEADS_PG){console.log('skipped: set HEADS_PG=1 and PGHOST/PGPORT/PGUSER for a local PostgreSQL');process.exit(0);}
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i):''));if(!c)bad++;};
const DB='heads_mt_test',SCHEMA=fs.readFileSync(path.join(__dirname,'../../supabase/schema.sql'),'utf8');
const psql=(sql,db=DB)=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const tryq=(sql,db)=>{try{psql(sql,db);return null;}catch(e){return String(e.stderr||e.message).trim();}};
const stats=(r='all',p='all',role='service_role')=>JSON.parse(psql(`set role ${role}; select public.metrics_stats('${r}','${p}');`));
const q=v=>v==null?'null':typeof v==='string'?"'"+v.replace(/'/g,"''")+"'":typeof v==='object'?"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb":String(v);
const COLS=['created_at','kind','session_id','player_id','game','version','test','country','region','city','platform','os','browser','lang','round','secs','cause','data'];
const insert=rows=>{let out='set role service_role;\n';for(let i=0;i<rows.length;i+=500)out+='insert into public.events ('+COLS.join(',')+') values\n'+rows.slice(i,i+500).map(r=>'('+COLS.map(c=>c==='created_at'?q(r.at)+'::timestamptz':q(r[c]===undefined?(c==='test'?false:c==='data'?{}:c==='version'?'v81':null):r[c])).join(',')+')').join(',\n')+';\n';psql(out);};
const norm=v=>Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,norm(v[k])])):v,same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b)); // jsonb sorts its keys
const hex=n=>{let s='';for(let i=0;i<n;i++)s+='0123456789abcdef'[Math.random()*16|0];return s;};

(async()=>{
  psql(`drop database if exists ${DB}`,'postgres');psql(`create database ${DB}`,'postgres');
  psql(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  end $$; grant anon, authenticated, service_role to current_user;
  grant usage on schema public to anon, authenticated;`); // as on Supabase: the browser roles can see the schema, so only the table / function grants keep them out
  try{
    console.log('1) the script, twice');
    ok(tryq(SCHEMA)===null,'first run');
    const second=tryq(SCHEMA);ok(second===null,'second run (idempotent)',second);
    ok(psql(`select relrowsecurity from pg_class where oid='public.events'::regclass`)==='t','RLS is on');
    ok(psql(`select count(*) from pg_policies where tablename='events'`)==='0','no policies');

    console.log('2) who can do what');
    for(const r of ['anon','authenticated']){
      ok(/permission denied/.test(tryq(`set role ${r}; select count(*) from public.events`)||''),r+' cannot read the events');
      ok(/permission denied/.test(tryq(`set role ${r}; insert into public.events (kind,session_id,version) values ('visit','${hex(24)}','v81')`)||''),r+' cannot insert');
      ok(/permission denied/.test(tryq(`set role ${r}; select public.metrics_stats('all','all')`)||''),r+' cannot call metrics_stats');}
    ok(tryq(`set role service_role; insert into public.events (kind,session_id,version) values ('visit','${hex(24)}','v81')`)===null,'service_role can insert');
    ok(/permission denied/.test(tryq(`set role service_role; select count(*) from public.events`)||''),'service_role cannot read rows (only the totals of metrics_stats)');
    ok(/permission denied/.test(tryq(`set role service_role; update public.events set kind='end'`)||'')&&/permission denied/.test(tryq(`set role service_role; delete from public.events`)||''),'service_role cannot update or delete');
    ok(tryq(`set role service_role; select public.metrics_stats('7d','pc')`)===null,'service_role can call metrics_stats');
    ok(/violates check constraint/.test(tryq(`set role service_role; insert into public.events (kind,session_id,version) values ('visit','NOT-HEX','v81')`)||''),'a bad session id is refused by the table itself');
    psql('truncate public.events');

    console.log('3) the numbers on a small hand-made set');
    const now=Date.now(),ago=(h)=>new Date(now-h*3600e3).toISOString(),A='a'.repeat(24),B='b'.repeat(24),C='c'.repeat(24),D='d'.repeat(24),T='e'.repeat(24),P1='1'.repeat(24);
    const base={version:'v81',country:'ES',region:'Valencia',city:'Valencia',lang:'es'};
    insert([
      // A: PC, consent yes (player P1, also seen 3 days ago), two games: round 3 dead, then round 1 ship
      {...base,at:ago(1),kind:'visit',session_id:A,player_id:P1,platform:'pc',os:'windows',browser:'chrome',data:{scr:'pc-m',inst:false,go:true,ready:true,load:4000,consent:'yes',film:'skipped',filmS:8}},
      {...base,at:ago(0.9),kind:'end',session_id:A,player_id:P1,platform:'pc',os:'windows',browser:'chrome',game:1,round:3,secs:300,cause:'dead',data:{fps:60,qMax:0,rt:[100,120,80]}},
      {...base,at:ago(0.8),kind:'end',session_id:A,player_id:P1,platform:'pc',os:'windows',browser:'chrome',game:2,round:1,secs:50,cause:'ship',data:{fps:58,qMax:1,rt:[50]}},
      {...base,at:ago(72),kind:'visit',session_id:'f'.repeat(24),player_id:P1,platform:'pc',os:'windows',browser:'chrome',data:{scr:'pc-m',inst:false,go:false,ready:true,load:6000,consent:'yes'}},
      // B: phone, no consent: game 1 quit at round 2, then came back and finished at round 4 (cargo) -> the end wins; tutorial skipped at screen 2; an error
      {...base,at:ago(2),kind:'visit',session_id:B,platform:'touch',os:'android',browser:'chrome',country:'AR',region:'Buenos Aires',city:'Buenos Aires',data:{scr:'phone',inst:true,go:true,ready:true,load:9000,consent:'no',film:'watched'}},
      {...base,at:ago(1.9),kind:'quit',session_id:B,platform:'touch',os:'android',browser:'chrome',country:'AR',city:'Buenos Aires',game:1,round:2,secs:150,data:{score:900}},
      {...base,at:ago(1.8),kind:'end',session_id:B,platform:'touch',os:'android',browser:'chrome',country:'AR',city:'Buenos Aires',game:1,round:4,secs:420,cause:'cargo',data:{fps:30,qMax:3,tut:'skip',tutStep:2,rt:[90,100,110,120]}},
      {...base,at:ago(1.7),kind:'error',session_id:B,platform:'touch',os:'android',browser:'chrome',data:{msg:'TypeError: x is undefined',at:'index.js:10:5',n:3}},
      // C: phone iOS, unset, quit at round 1 and never came back
      {...base,at:ago(3),kind:'visit',session_id:C,platform:'touch',os:'ios',browser:'safari',data:{scr:'phone',inst:false,go:true,ready:true,load:12000,consent:'unset',film:'skipped',filmS:2}},
      {...base,at:ago(2.9),kind:'quit',session_id:C,platform:'touch',os:'ios',browser:'safari',game:1,round:1,secs:40,data:{score:100}},
      {...base,at:ago(2.8),kind:'error',session_id:C,platform:'touch',os:'ios',browser:'safari',data:{msg:'TypeError: x is undefined',at:'index.js:10:5',n:1}},
      // D: PC, left without playing; 40 days ago (outside 7d and 30d)
      {...base,at:ago(24*40),kind:'visit',session_id:D,platform:'pc',os:'mac',browser:'safari',country:'MX',city:'Ciudad de México',data:{scr:'pc-l',inst:false,go:false,ready:true,load:3000,consent:'unset'}},
      // T: a ?ronda=5 test game: never counted, only in test_games
      {...base,at:ago(0.5),kind:'visit',session_id:T,platform:'pc',os:'linux',browser:'firefox',test:true,data:{consent:'unset'}},
      {...base,at:ago(0.4),kind:'end',session_id:T,platform:'pc',os:'linux',browser:'firefox',test:true,game:1,round:9,secs:200,cause:'dead',data:{r0:5,rt:[1,2,3,4,5]}},
    ]);
    let s=stats('all','all'),S=s.summary;
    ok(S.visits===5&&S.sessions===5,'5 visits / 5 sessions (the test visit left out)',S);
    ok(S.games===4&&S.games_pc===2&&S.games_touch===2,'4 games: B game 1 counts once (its end wins over the quit)',S);
    ok(S.players===1&&S.returning===1,'1 player with consent, who came back on another day',S);
    ok(S.secs_total===300+50+420+40&&S.secs_avg===Math.round((300+50+420+40)/4),'time played total and average',S);
    ok(S.left_no_play===2,'2 visits never led to a game (P1 3 days ago and D)',S);
    ok(S.consent_yes===2&&S.consent_no===1&&S.consent_unset===2,'consent answers',S);
    ok(S.test_games===1,'1 test game, counted apart',S);
    ok(same(s.funnel,[{round:1,all:4,pc:2,touch:2},{round:2,all:2,pc:1,touch:1},{round:3,all:2,pc:1,touch:1},{round:4,all:1,pc:0,touch:1}]),'funnel per round, PC and phone',s.funnel);
    ok(s.last_round.all===1&&s.last_round.pc!==null,'most common last round',s.last_round);
    const c4=s.causes.find(c=>c.round===4),c1=s.causes.find(c=>c.round===1);
    ok(c4&&c4.cargo===1&&c1&&c1.ship===1&&c1.quit===1,'causes by round',s.causes);
    ok(same(s.quits,[{round:1,all:1,pc:0,touch:1}]),'quits: only C (B came back and finished)',s.quits);
    const r1=s.round_secs.find(r=>r.round===1);ok(r1&&r1.secs===95&&r1.n===2&&!s.round_secs.some(r=>r.round>=4),'round times: finished rounds only (round 1 = 100 and 90)',s.round_secs);
    ok(s.errors.length===1&&s.errors[0].n===4&&s.errors[0].sessions===2&&s.errors[0].env.length===2,'errors grouped, counted, with OS / browser',s.errors);
    ok(s.countries[0].code==='ES'&&s.countries.some(c=>c.code==='AR')&&s.cities.some(c=>c.city==='Buenos Aires'),'countries and cities',{c:s.countries,ci:s.cities});
    ok(s.installed.touch_yes===1&&s.installed.touch_of===2,'installed on phones 1 of 2',s.installed);
    ok(s.fps.pc===59&&s.fps.touch===30,'median fps per platform',s.fps);
    ok(s.load.pc_p50===4000&&s.load.touch_p50===10500,'load time p50',s.load);
    ok(s.film.skipped===2&&s.film.watched===1,'film watched / skipped',s.film);
    ok(s.tutorial.skip===1&&s.tutorial_step['2']===1,'phone tutorial skipped at screen 2',{t:s.tutorial,st:s.tutorial_step});
    ok(s.quality['3']===1&&s.quality['0']===1,'quality level reached',s.quality);
    ok(Array.isArray(s.daily)&&s.daily.reduce((a,d)=>a+d.visits,0)===5&&s.daily.reduce((a,d)=>a+d.games,0)===4,'visits and games per day',s.daily);
    s=stats('all','pc');ok(s.summary.games===2&&s.summary.visits===3&&s.funnel.length===3,'platform filter PC',s.summary);
    s=stats('all','touch');ok(s.summary.games===2&&s.summary.visits===2,'platform filter phone',s.summary);
    s=stats('30d','all');ok(s.summary.visits===4,'30 days leaves out the visit of 40 days ago',s.summary);
    s=stats('7d','all');ok(s.summary.visits===4&&s.summary.returning===1,'7 days',s.summary);
    s=stats('today','all');ok(s.summary.visits<=4,'today runs',s.summary);
    psql('truncate public.events');
    s=stats('all','all');ok(s.summary.visits===0&&s.funnel.length===0&&s.summary.secs_avg===null&&Array.isArray(s.errors),'empty table: zeros and empty lists',s.summary);

    console.log('4) a realistic month of fake play');
    const rows=fakeMonth(now);insert(rows);
    const t0=Date.now();s=stats('30d','all');const ms=Date.now()-t0;
    ok(s.summary.visits>400&&s.funnel.length>8,'about '+s.summary.visits+' visits, '+s.summary.games+' games, rounds up to '+s.funnel.length,s.summary);
    ok(ms<3000,'metrics_stats answers in '+ms+' ms');
    fs.writeFileSync(path.join(__dirname,'metrics-stats-sample.json'),JSON.stringify(s,null,1)+'\n');
    console.log('  sample saved: tools/tests/metrics-stats-sample.json');
  }finally{psql(`drop database if exists ${DB}`,'postgres');}
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e.stderr||e);process.exit(2);});

// ~600 visits over 30 days: 55 % phone, about 70 % play, rounds reached fall off round by round (phones a little earlier), some quits, some errors
function fakeMonth(now){
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,pick=a=>a[Math.floor(rnd()*a.length)];
  const PLACES=[['ES','Valencia','Valencia',30],['ES','Madrid','Madrid',22],['ES','Cataluña','Barcelona',16],['ES','Andalucía','Sevilla',8],['AR','Buenos Aires','Buenos Aires',10],['MX','Ciudad de México','Ciudad de México',7],['US','California','Los Angeles',5],['CL','Santiago','Santiago',3],['DE','Berlin','Berlin',2],['FR','Île-de-France','Paris',2]];
  const place=()=>{let r=rnd()*PLACES.reduce((a,p)=>a+p[3],0);for(const p of PLACES){r-=p[3];if(r<=0)return p;}return PLACES[0];};
  const ERR=['TypeError: Cannot read properties of undefined (reading \'position\')','(promesa) AbortError: The play() request was interrupted','RangeError: Maximum call stack size exceeded'];
  const out=[],players=[];
  for(let i=0;i<600;i++){
    const t=now-rnd()*30*86400e3,touch=rnd()<0.55,sid=hex(24),[country,region,city]=place();
    const os=touch?(rnd()<0.45?'ios':'android'):(rnd()<0.8?'windows':'mac'),browser=os==='ios'?'safari':os==='mac'?(rnd()<0.5?'safari':'chrome'):pick(['chrome','chrome','chrome','edge','firefox','samsung'].filter(b=>touch||b!=='samsung'));
    const consent=rnd()<0.4?'yes':rnd()<0.5?'no':'unset';let pid=null;if(consent==='yes'){if(players.length&&rnd()<0.35)pid=pick(players);else{pid=hex(24);players.push(pid);}}
    const e={version:'v81',session_id:sid,player_id:pid,platform:touch?'touch':'pc',os,browser,lang:rnd()<0.8?'es':'en',country,region,city};
    const play=rnd()<0.72,film=play?(rnd()<0.6?'skipped':'watched'):undefined;
    out.push({...e,at:new Date(t).toISOString(),kind:'visit',data:{scr:touch?(rnd()<0.85?'phone':'tablet'):pick(['pc-s','pc-m','pc-m','pc-l']),blang:'es',inst:touch&&rnd()<0.12,go:play,ready:true,load:Math.round((touch?7000:4000)*(0.6+rnd()*1.6)),consent,...(film?{film,...(film==='skipped'?{filmS:Math.floor(rnd()*20)}:{})}:{})}});
    if(!play)continue;
    const n=1+Math.floor(rnd()*rnd()*4);let at=t+40e3;
    for(let g=1;g<=n;g++){
      let round=1;while(round<20&&rnd()<(touch?0.68:0.74)-round*0.015)round++;
      const rt=Array.from({length:round},()=>Math.round(55+rnd()*70)),secs=rt.reduce((a,b)=>a+b,0);at+=secs*1000;
      const quit=rnd()<0.12,cause=pick(round<4?['dead','dead','ship','cargo']:['dead','ship','ship','cargo']);
      const fps=touch?Math.round(24+rnd()*36):Math.round(45+rnd()*100),qMax=touch?Math.floor(rnd()*4):Math.floor(rnd()*rnd()*3);
      if(quit)out.push({...e,at:new Date(at).toISOString(),kind:'quit',game:g,round,secs,data:{score:round*900}});
      else out.push({...e,at:new Date(at).toISOString(),kind:'end',game:g,round,secs,cause,data:{score:round*1100,combat:round*400,cargo:round*700,kills:round*9,heads:round*2,acc:Math.round(30+rnd()*40),
        xp:round>=4?Math.floor(rnd()*3):0,eggs:round>=9?Math.floor(rnd()*3):0,eggsK:0,spit:round>=6?1:0,inc:round>=8?1:0,rep:Math.floor(rnd()*round*2),q:qMax,qMax,fps,rt,
        ...(touch&&g===1?(rnd()<0.35?{tut:'skip',tutStep:1+Math.floor(rnd()*4)}:{tut:rnd()<0.5?'done':'before'}):{})}});
      if(quit)break;}
    if(rnd()<0.04)out.push({...e,at:new Date(at+1000).toISOString(),kind:'error',data:{msg:pick(ERR),at:'index-BqVoEnlT.js:1:'+Math.floor(rnd()*900000),n:1+Math.floor(rnd()*3)}});}
  // a few ?ronda=N test games
  for(let i=0;i<6;i++){const sid=hex(24);out.push({version:'v81',session_id:sid,platform:'pc',os:'windows',browser:'chrome',test:true,at:new Date(now-i*3600e3).toISOString(),kind:'end',game:1,round:6+i,secs:120,cause:'dead',data:{r0:6}});}
  return out;}
