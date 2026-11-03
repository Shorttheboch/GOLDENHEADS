// Google accounts and the Season 1 ranking (v82): supabase/v82-cuentas.sql against a real local PostgreSQL (no browser, no Supabase).
// Needs psql and a server you can create databases on, given with the usual libpq variables, and HEADS_PG=1:
//   HEADS_PG=1 PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres node tools/tests/ranking-sql.cjs
// It builds what Supabase has around the script: the roles anon / authenticated / service_role (BYPASSRLS) and a small auth.users table,
// then runs supabase/schema.sql (v81) and supabase/v82-cuentas.sql twice (idempotent).
// What it checks:
//   - RLS on both tables, no policies; anon and authenticated can neither read, write nor call anything; service_role cannot touch the tables
//     directly either (no SELECT / INSERT / UPDATE / DELETE), only EXECUTE the rank_* functions
//   - nicknames: one per account and it cannot be changed, unique on the key (no accents, no . _ -: SANTI = Sántí = S.ANTI, PEÑA = PENA),
//     the table refuses a bad format by itself, an unknown auth user is refused
//   - saving: a run token saves once ('used'), best run per player, new best or not, flagged / rejected runs and banned players never on the
//     board (a banned player cannot save), real and test (Netlify preview) runs never mixed, ties go to who got there first, your place when
//     you are outside the top, limits clamped, no email anywhere
//   - deleting: rank_forget deletes the player and every run; deleting the auth user cascades too
//   - admin: summary, season top with flags, recent and flagged runs, hide / show a run, ban / unban, unknown action or id
//   - a bigger season (3000 players, 30000 runs) for the speed; the admin answer is saved as tools/tests/ranking-admin-sample.json
//     (the fake answer the admin page test admin.cjs uses)
// It works in its own database (heads_rk_test), dropped at the end.
const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path');
if(!process.env.HEADS_PG){console.log('skipped: set HEADS_PG=1 and PGHOST/PGPORT/PGUSER for a local PostgreSQL');process.exit(0);}
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i).slice(0,800):''));if(!c)bad++;};
const DB='heads_rk_test',ROOT=path.join(__dirname,'../..');
const V81=fs.readFileSync(path.join(ROOT,'supabase/schema.sql'),'utf8'),V82=fs.readFileSync(path.join(ROOT,'supabase/v82-cuentas.sql'),'utf8');
const psql=(sql,db=DB)=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:64<<20}).trim();
const tryq=(sql,db)=>{try{psql(sql,db);return null;}catch(e){return String(e.stderr||e.message).trim();}};
// SQL literals: strings, booleans, numbers, null, jsonb objects, text[] arrays, and {smallint:n} for the smallint arguments
const lit=v=>v==null?'null':typeof v==='string'?"'"+v.replace(/'/g,"''")+"'":typeof v==='boolean'||typeof v==='number'?String(v)
  :Array.isArray(v)?"array["+v.map(lit).join(',')+"]::text[]":'smallint' in v?v.smallint+'::smallint':"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb";
const callS=(fn,args,role='service_role')=>{const out=psql(`set role ${role}; select public.${fn}(${args.map(lit).join(',')});`);return out===''?null:JSON.parse(out);};
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tok=n=>n.toString(16).padStart(16,'0');
let T=1;const save=(p,score,round,o={})=>callS('rank_submit',[p,o.token||tok(T++),score,round,o.secs??(round*60),o.stats||{kills:round*5,csecs:round*55},o.plat||'pc','es','v82',o.status||'ok',o.flags||[],o.test||false,{smallint:o.season||1},o.limit??10]);
const board=(test=false,limit=10,me=null,season=1)=>callS('rank_board',[{smallint:season},test,limit,me]);
const S1={smallint:1};

(async()=>{
  psql(`drop database if exists ${DB}`,'postgres');psql(`create database ${DB}`,'postgres');
  psql(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  end $$; grant anon, authenticated, service_role to current_user;
  grant usage on schema public to anon, authenticated;
  create schema auth; create table auth.users (id uuid primary key, email text, created_at timestamptz default now());`); // as on Supabase: the Auth users live in auth.users
  try{
    console.log('1) the script, twice, after the v81 one');
    ok(tryq(V81)===null,'schema.sql (v81)');
    ok(tryq(V82)===null,'v82-cuentas.sql, first run');
    const second=tryq(V82);ok(second===null,'v82-cuentas.sql, second run (idempotent)',second);
    ok(psql(`select string_agg(relname||':'||relrowsecurity::text,',' order by relname) from pg_class where oid in ('public.players'::regclass,'public.runs'::regclass)`)==='players:true,runs:true','RLS on players and runs');
    ok(psql(`select count(*) from pg_policies where tablename in ('players','runs')`)==='0','no policies');
    ok(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'rank\\_%' and p.prosecdef and array_to_string(p.proconfig,',')='search_path=""'`)==='7','7 rank_* functions, all SECURITY DEFINER with an empty search_path');

    console.log('2) who can do what');
    psql(`insert into auth.users (id,email) select ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid, 'player'||g||'@gmail.com' from generate_series(1,40) g`);
    const FN=[['rank_board',`1::smallint,false,10,null`],['rank_player',`'${uid(1)}',1::smallint,false`],['rank_nick',`'${uid(1)}','HACKER','t',false`],
      ['rank_submit',`'${uid(1)}','${tok(999)}',100,1,60,'{}'::jsonb,'pc','es','v82','ok','{}'::text[],false,1::smallint,10`],['rank_forget',`'${uid(1)}'`],
      ['rank_admin',`1::smallint,false,10`],['rank_moderate',`'ban',null,'${uid(1)}',null`]];
    for(const r of ['anon','authenticated']){
      ok(/permission denied/.test(tryq(`set role ${r}; select count(*) from public.players`)||'')&&/permission denied/.test(tryq(`set role ${r}; select count(*) from public.runs`)||''),r+' cannot read players or runs');
      ok(/permission denied/.test(tryq(`set role ${r}; insert into public.players (id,nick,terms_at,terms_ver) values ('${uid(1)}','HACKER',now(),'t')`)||''),r+' cannot insert a player');
      ok(FN.every(([f,a])=>/permission denied/.test(tryq(`set role ${r}; select public.${f}(${a})`)||'')),r+' cannot call any rank_* function');}
    ok(/permission denied/.test(tryq(`set role service_role; select count(*) from public.players`)||'')&&/permission denied/.test(tryq(`set role service_role; select * from public.runs`)||''),'service_role cannot read the tables (only through the functions)');
    ok(/permission denied/.test(tryq(`set role service_role; insert into public.players (id,nick,terms_at,terms_ver) values ('${uid(1)}','HACKER',now(),'t')`)||'')&&/permission denied/.test(tryq(`set role service_role; update public.runs set status='ok'`)||'')&&/permission denied/.test(tryq(`set role service_role; delete from public.players`)||''),'service_role cannot insert, update or delete directly');
    ok(psql(`select count(*) from public.players`)==='0','(and the function calls above by anon / authenticated changed nothing)');

    console.log('3) nicknames');
    let r=callS('rank_nick',[uid(1),'SÁNTI','2026-11-v82',false]);ok(r&&r.ok&&r.nick==='SÁNTI','SÁNTI chosen',r);
    for(const [n,u] of [['SANTI',2],['S.ANTI',2],['SANTI_',2],['SAN-TÍ',2]]){r=callS('rank_nick',[uid(u),n,'t',false]);ok(r&&r.error==='taken',n+' -> taken (same key SANTI)',r);}
    r=callS('rank_nick',[uid(2),'PEÑA','t',true]);ok(r&&r.ok,'PEÑA chosen (on a preview)',r);
    r=callS('rank_nick',[uid(3),'PENA','t',false]);ok(r&&r.error==='taken','PENA -> taken (Ñ = N in the key)',r);
    r=callS('rank_nick',[uid(2),'OTRO','t',false]);ok(r&&r.error==='exists'&&r.nick==='PEÑA','PEÑA cannot change its nickname -> exists',r);
    for(const n of ['santi2','AB','A.B','ABCDEFGHIJKLM','HOLA MUNDO','JOSÉ😀','ÀLEX']){r=callS('rank_nick',[uid(3),n,'t',false]);ok(r&&r.error==='format','«'+n+'» refused by the table itself -> format',r);}
    r=callS('rank_nick',['99999999-9999-4999-8999-999999999999','NADIE','t',false]);ok(r&&r.error==='nouser','an id that is not an auth user -> nouser',r);
    const pl=JSON.parse(psql(`select json_agg(json_build_object('nick',nick,'key',nick_key,'terms',terms_at is not null,'ver',terms_ver,'prev',from_preview) order by created_at) from public.players`));
    ok(pl.length===2&&pl[0].key==='SANTI'&&pl[1].key==='PENA'&&pl[0].terms&&pl[0].ver==='2026-11-v82'&&pl[1].prev===true,'2 players, keys SANTI / PENA, when the terms were accepted, which version, from a preview',pl);
    // more players for the board
    const NICKS=['VEGA_FAN','ORION','KRAKEN','LUNA','TITAN','NOVA','ASTRO7','ZETA','ECO','PULSAR','QUASAR','COMETA'];
    NICKS.forEach((n,i)=>callS('rank_nick',[uid(10+i),n,'t',false]));

    console.log('4) saving runs and the board');
    r=save(uid(1),5000,6);ok(r&&r.saved&&r.status==='ok'&&r.new_best===true&&r.prev_best===null&&r.best.score===5000&&r.nick==='SÁNTI','first run: saved, new best',r);
    ok(r.board.count===1&&r.board.me.pos===1&&r.board.top[0].me===true&&r.board.top[0].nick==='SÁNTI','board: count 1, #1, it is me',r.board);
    r=save(uid(1),3000,4);ok(r.saved&&r.new_best===false&&r.prev_best===5000&&r.best.score===5000&&r.best.round===6&&r.board.count===1,'a worse run: saved, not a new best, best still 5000 (round 6), still one line for this player',r);
    r=save(uid(1),7000,8);ok(r.new_best===true&&r.prev_best===5000&&r.best.score===7000,'a better run: new best 7000',r);
    const used=tok(T++);save(uid(2),2000,3,{token:used});r=save(uid(2),9999,9,{token:used});ok(r&&r.error==='used','the same run token again -> used (a run is saved once)',r);
    r=save(uid(3),1000,2);ok(r&&r.error==='nick','an account without a nickname -> nick',r);
    // the others
    const sc=[9000,8000,8000,6500,6000,4000,3500,3000,2500,2000,1500,1000];NICKS.forEach((n,i)=>save(uid(10+i),sc[i],5+i%4));
    let b=board(false,10,uid(2));
    ok(b.count===14&&b.top.length===10,'14 players on the board, top 10 given',{count:b.count,n:b.top.length});
    ok(b.top[0].nick==='VEGA_FAN'&&b.top[3].nick==='SÁNTI'&&b.top[0].score===9000&&b.top[3].score===7000,'best first: VEGA_FAN 9000 ... SÁNTI 7000 (#4)',b.top.slice(0,4));
    ok(b.top[1].nick==='ORION'&&b.top[2].nick==='KRAKEN'&&b.top[1].score===8000&&b.top[2].score===8000,'a tie (8000): who got there first goes first',b.top.slice(1,3));
    ok(b.me&&b.me.nick==='PEÑA'&&b.me.pos===11&&!b.top.some(x=>x.me)&&board(false,20).top[11].nick==='PULSAR','my place when I am outside the top: PEÑA #11 (2000, before PULSAR, who got 2000 later)',b.me);
    ok(b.top.every(x=>Object.keys(x).sort().join()==='me,nick,pos,round,score'),'each line: pos, nick, score, round, me (no ids)',b.top[0]);
    ok(board(false,500).top.length===14&&board(false,0).top.length===1&&board(false,-3).top.length===1,'limit clamped to 1..50');
    ok(!JSON.stringify([b,board(false,50)]).includes('@'),'no email anywhere in the board');
    // flagged, rejected, banned, test
    r=save(uid(11),99999,9,{status:'flagged',flags:['score']});ok(r.saved&&r.status==='flagged'&&r.new_best===false&&r.best.score===8000,'a flagged run: saved, not a new best, best stays 8000',r);
    ok(board(false,20).top.find(x=>x.nick==='ORION').score===8000,'the flagged run is not on the board');
    r=save(uid(12),50000,9,{status:'rejected'});ok(board(false,20).top.find(x=>x.nick==='KRAKEN').score===8000,'a rejected run is not on the board');
    r=save(uid(13),12345,7,{test:true});ok(r.saved&&r.board.count===1&&r.board.top[0].nick==='LUNA','a test (preview) run: only on the test board (1 player there)',r.board);
    ok(board(false,20).top.find(x=>x.nick==='LUNA').score===6500,'... and the real board does not see it');
    ok(board(true,20).count===1&&board(true,20).top.every(x=>x.score===12345),'the test board sees only test runs');
    r=save(uid(1),1000,1,{season:2});ok(r.saved&&r.board.count===1,'another season has its own board');
    ok(board(false,20).top.find(x=>x.nick==='SÁNTI').score===7000,'season 1 is not touched by season 2');
    r=callS('rank_player',[uid(1),S1,false]);ok(r&&r.nick==='SÁNTI'&&r.best.score===7000&&r.best.round===8&&r.pos===4&&r.count===14&&r.banned===false,'rank_player: nick, best, place, count',r);
    ok(callS('rank_player',[uid(3),S1,false])===null,'rank_player of an account without a nickname -> null');
    ok(callS('rank_player',[uid(13),S1,true]).best.score===12345&&callS('rank_player',[uid(13),S1,false]).best.score===6500,'rank_player real / test apart');

    console.log('5) admin');
    let a=callS('rank_admin',[S1,false,50]);
    ok(a.summary.players===14&&a.summary.ranked===14&&a.summary.runs===18&&a.summary.flagged===1&&a.summary.rejected===1&&a.summary.banned===0&&a.summary.accounts===14,'summary: players, runs, flagged, rejected, banned',a.summary);
    ok(a.top.length===14&&a.top[0].nick==='VEGA_FAN'&&a.top[0].run>0&&/^[0-9a-f-]{36}$/.test(a.top[0].player)&&'flags' in a.top[0],'season top with run id, player id and flags',a.top[0]);
    const orion=a.top.find(x=>x.nick==='ORION');ok(orion.flagged===1&&orion.runs===2,'ORION: 2 runs, 1 flagged',orion);
    ok(a.recent.length===18&&a.recent[0].at>=a.recent[1].at&&a.recent.some(x=>x.status==='rejected')&&a.recent[0].csecs!==undefined,'recent runs, newest first, every status',a.recent.slice(0,2));
    ok(a.flagged.length===1&&a.flagged[0].nick==='ORION'&&a.flagged[0].flags[0]==='score','flagged runs',a.flagged);
    ok(!JSON.stringify(a).includes('@'),'no email anywhere in the admin answer');
    const fr=a.flagged[0].run;
    r=callS('rank_moderate',['show',fr,null,null]);ok(r.ok&&board(false,20).top[0].nick==='ORION'&&board(false,20).top[0].score===99999,'show the flagged run: ORION goes to #1 with 99999',board(false,3).top);
    r=callS('rank_moderate',['hide',fr,null,null]);ok(r.ok&&board(false,20).top.find(x=>x.nick==='ORION').score===8000,'hide it: back to 8000');
    a=callS('rank_admin',[S1,false,50]);ok(a.summary.rejected===2&&a.summary.flagged===0&&a.recent.find(x=>x.run===fr).reviewed,'the hidden run is rejected, with the time it was reviewed',a.summary);
    r=callS('rank_moderate',['ban',null,uid(10),'trampas con la consola']);ok(r.ok,'ban VEGA_FAN');
    b=board(false,20);ok(b.count===13&&b.top[0].nick==='ORION'&&!b.top.some(x=>x.nick==='VEGA_FAN'),'a banned player leaves the board',b.top.slice(0,2));
    r=save(uid(10),100,1);ok(r&&r.error==='banned','a banned player cannot save -> banned',r);
    a=callS('rank_admin',[S1,false,50]);ok(a.banned.length===1&&a.banned[0].nick==='VEGA_FAN'&&a.banned[0].note==='trampas con la consola'&&a.summary.banned===1&&a.top.at(-1).nick==='VEGA_FAN'&&a.top.at(-1).banned,'admin: banned list with the note, banned players listed last in the top',a.banned);
    ok(callS('rank_player',[uid(10),S1,false]).banned===true,'rank_player says banned');
    r=callS('rank_moderate',['unban',null,uid(10),null]);ok(r.ok&&board(false,20).top[0].nick==='VEGA_FAN','unban: back on the board');
    ok(callS('rank_moderate',['nuke',1,null,null]).error==='action'&&callS('rank_moderate',['hide',987654,null,null]).error==='notfound'&&callS('rank_moderate',['ban',null,'99999999-9999-4999-8999-999999999999',null]).error==='notfound','unknown action -> action, unknown run / player -> notfound');

    console.log('6) deleting an account');
    const before=Number(psql(`select count(*) from public.runs where player_id='${uid(1)}'`));
    r=callS('rank_forget',[uid(1)]);ok(r.runs===before&&r.player===true,'rank_forget: '+before+' runs and the player deleted',r);
    ok(psql(`select count(*) from public.runs where player_id='${uid(1)}'`)==='0'&&psql(`select count(*) from public.players where id='${uid(1)}'`)==='0','nothing of SÁNTI left (every season)');
    ok(!board(false,50).top.some(x=>x.nick==='SÁNTI'),'gone from the board');
    r=callS('rank_nick',[uid(5),'SANTI','t',false]);ok(r.ok,'the nickname is free again');
    r=callS('rank_forget',[uid(1)]);ok(r.runs===0&&r.player===false,'forgetting again: nothing to delete');
    save(uid(5),777,2);psql(`delete from auth.users where id='${uid(5)}'`);
    ok(psql(`select count(*) from public.players where id='${uid(5)}'`)==='0'&&psql(`select count(*) from public.runs where player_id='${uid(5)}'`)==='0','deleting the auth user (Supabase dashboard / admin API) cascades to the player and its runs');

    console.log('7) a bigger season');
    psql(`truncate public.runs, public.players cascade; delete from auth.users;
      insert into auth.users (id,email) select ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid, 'p'||g||'@gmail.com' from generate_series(1,3000) g;
      insert into public.players (id,nick,terms_at,terms_ver,banned,banned_at,ban_note)
        select ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid, 'CAPI'||g, now()-(g||' minutes')::interval, '2026-11-v82', g%500=0, case when g%500=0 then now() end, case when g%500=0 then 'trampas' end from generate_series(1,3000) g;
      insert into public.runs (player_id,token_id,score,round,secs,stats,platform,lang,version,status,flags,test,created_at)
        select ('00000000-0000-4000-8000-'||lpad((1+(g*7919)%3000)::text,12,'0'))::uuid, lpad(to_hex(g),16,'0'), 500+(g::bigint*104729)%40000, 1+(g*31)%18, 60+(g*13)%2000,
               jsonb_build_object('kills',g%90,'csecs',50+(g*13)%1900), case when g%5<3 then 'touch' else 'pc' end, 'es','v82',
               case when g%97=0 then 'flagged' when g%331=0 then 'rejected' else 'ok' end, case when g%97=0 then array['score'] else '{}'::text[] end,
               g%41=0, now()-((g%43200)||' minutes')::interval
        from generate_series(1,30000) g;`);
    let t0=Date.now();b=board(false,10,uid(77));const msB=Date.now()-t0;
    ok(b.count>2900&&b.top.length===10&&b.me&&b.me.pos>0,'about '+b.count+' players on the board, mine at #'+(b.me&&b.me.pos),{count:b.count});
    ok(msB<1500,'rank_board answers in '+msB+' ms (psql round trip included)');
    t0=Date.now();a=callS('rank_admin',[S1,false,50]);const msA=Date.now()-t0;
    ok(a.top.length===50&&a.recent.length===50&&a.flagged.length===100&&a.summary.runs>29000,'admin: top 50, recent 50, flagged 100',a.summary);
    ok(msA<2500,'rank_admin answers in '+msA+' ms');
    // a smaller, readable sample for the admin page test: the first 12 of each list
    const sample={season:1,test:false,summary:a.summary,top:a.top.slice(0,12),recent:a.recent.slice(0,12),flagged:a.flagged.slice(0,6),banned:a.banned.slice(0,4)};
    fs.writeFileSync(path.join(__dirname,'ranking-admin-sample.json'),JSON.stringify(sample,null,1)+'\n');
    console.log('  sample saved: tools/tests/ranking-admin-sample.json');
  }finally{psql(`drop database if exists ${DB}`,'postgres');}
  console.log(bad?`\n${bad} FAILED`:'\nALL OK');process.exit(bad?1:0);
})().catch(e=>{console.error(e.stderr||e);try{psql(`drop database if exists ${DB}`,'postgres');}catch(_){}process.exit(2);});
