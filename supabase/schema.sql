-- HEADS Rescate Dorado · anonymous play metrics (v81)
-- Run it by hand in Supabase > SQL editor. It is idempotent: running it again changes nothing (it only replaces the stats function).
--
-- Who writes and reads: only the Netlify function netlify/functions/metrics.mts, with the secret key (SUPABASE_SECRET_KEY = sb_secret_...,
-- Postgres role service_role). The game and the /admin page never talk to Supabase.
-- The project has "automatically expose new tables" OFF and automatic RLS ON, so everything is explicit here:
--   * RLS on the table, with NO policies (nobody gets rows through the browser keys: anon / authenticated)
--   * anon and authenticated get nothing at all
--   * service_role gets exactly what the function needs: INSERT on public.events and EXECUTE on public.metrics_stats()
--     (metrics_stats runs as its owner, SECURITY DEFINER, so service_role needs no SELECT: the function only ever returns totals)
-- No IP is ever stored. player_id is a random id the game keeps only when the player said yes to the question on the start menu.
-- v82 (Google accounts) will add public.players and public.runs next to this table; events.player_id can then point at a player. Not created here.

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('visit', 'end', 'quit', 'error')),
  session_id  text not null check (session_id ~ '^[0-9a-f]{16,32}$'),   -- random per page load, kept in memory only by the game
  player_id   text check (player_id is null or player_id ~ '^[0-9a-f]{16,32}$'), -- only with consent
  game        smallint,                 -- end / quit: number of the game inside the session (1, 2, ...)
  version     text not null,            -- 'v81', ...
  test        boolean not null default false,  -- games started with ?ronda=N, and every event of a Deploy Preview: never counted
  country     text,                     -- from Netlify geo: ISO code ('ES')
  region      text,                     -- subdivision ('Valencia')
  city        text,
  platform    text check (platform in ('pc', 'touch')),
  os          text,                     -- ios / android / windows / mac / other
  browser     text,                     -- chrome / safari / firefox / edge / samsung / opera / other
  lang        text,                     -- game language: es / en
  round       smallint,                 -- end / quit: round reached
  secs        integer,                  -- end / quit: seconds played
  cause       text,                     -- end: dead (suit) / ship / cargo
  data        jsonb not null default '{}'::jsonb   -- everything else, already whitelisted and clamped by the function
);
create index if not exists events_created_idx      on public.events (created_at);
create index if not exists events_kind_created_idx on public.events (kind, created_at);
create index if not exists events_session_idx      on public.events (session_id);
create index if not exists events_player_idx       on public.events (player_id) where player_id is not null;

alter table public.events enable row level security;   -- and no policies on purpose

revoke all on table public.events from public, anon, authenticated, service_role;
grant usage on schema public to service_role;
grant insert on table public.events to service_role;
do $$
declare s text := pg_get_serial_sequence('public.events', 'id');
begin
  if s is not null then
    execute format('revoke all on sequence %s from public, anon, authenticated', s);
    execute format('grant usage on sequence %s to service_role', s);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- metrics_stats(range, platform): everything the admin page (/admin) shows, already aggregated, as one JSON object.
--   p_range    'today' (since midnight in Spain) | '7d' | '30d' | 'all'
--   p_platform 'all' | 'pc' | 'touch'
-- Test events (test = true) are left out of every number; only test_games counts them.
-- A "game" is one (session_id, game) pair: its end event, or, if the page went away before the end, its last quit event.
-- Numbers inside data are read only when they really are JSON numbers (a bad row can never break the page).
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.metrics_stats(p_range text default '7d', p_platform text default 'all')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
lim as (
  select case p_range
           when 'today' then date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'
           when '7d'    then now() - interval '7 days'
           when '30d'   then now() - interval '30 days'
           else '-infinity'::timestamptz
         end as t0,
         case when p_platform in ('pc', 'touch') then p_platform end as plat
),
ev as (
  select e.* from public.events e, lim
  where e.created_at >= lim.t0 and (lim.plat is null or e.platform = lim.plat)
),
ok as (select * from ev where not test),
visits as (select * from ok where kind = 'visit'),
games as (
  select distinct on (session_id, game) session_id, game, kind, platform, round, secs, cause, data
  from ok
  where kind in ('end', 'quit') and game is not null and round is not null
  order by session_id, game, (kind = 'end') desc, created_at desc
),
num as (   -- the numbers of each game that the page needs, only when they are real numbers
  select g.*,
         case when jsonb_typeof(data -> 'fps')  = 'number' then (data ->> 'fps')::numeric end  as fps,
         case when jsonb_typeof(data -> 'qMax') = 'number' then (data ->> 'qMax')::int end     as qmax
  from games g
),
vnum as (
  select v.*, case when jsonb_typeof(data -> 'load') = 'number' then (data ->> 'load')::numeric end as load
  from visits v
),
pids as (select distinct player_id from ok where player_id is not null),
back as (   -- players (with consent) seen on two or more different days, counting their whole history
  select e.player_id
  from public.events e join pids using (player_id)
  where not e.test
  group by e.player_id
  having count(distinct (e.created_at at time zone 'Europe/Madrid')::date) >= 2
),
top_round as (select least(coalesce(max(round), 1), 100) as m from games),
funnel as (
  select r,
         count(*) filter (where g.round >= r)                             as n_all,
         count(*) filter (where g.round >= r and g.platform = 'pc')       as n_pc,
         count(*) filter (where g.round >= r and g.platform = 'touch')    as n_touch
  from top_round, generate_series(1, top_round.m) as r, games g
  group by r
),
round_times as (   -- seconds spent in each finished round (the last, unfinished one of every game is left out)
  select t.ord::int as r, t.v::numeric as s
  from games g,
       jsonb_array_elements_text(case when jsonb_typeof(g.data -> 'rt') = 'array' then g.data -> 'rt' else '[]'::jsonb end) with ordinality as t(v, ord)
  where t.ord < jsonb_array_length(case when jsonb_typeof(g.data -> 'rt') = 'array' then g.data -> 'rt' else '[]'::jsonb end)
    and t.v ~ '^[0-9]{1,6}$'
),
errs as (
  select data ->> 'msg' as msg, data ->> 'at' as at, os, browser,
         case when jsonb_typeof(data -> 'n') = 'number' then (data ->> 'n')::int else 1 end as n, session_id, created_at
  from ok where kind = 'error' and data ? 'msg'
),
err_top as (
  select msg, sum(n) as n, count(distinct session_id) as sessions, max(created_at) as last,
         (array_agg(at order by created_at desc))[1] as at
  from errs group by msg order by sum(n) desc limit 30
),
days as (   -- visits and games per day in Spain (the last 60 days of the range at most)
  select d, count(*) filter (where kind = 'visit') as visits, count(*) filter (where kind = 'g') as games
  from (select (created_at at time zone 'Europe/Madrid')::date as d, kind from visits
        union all
        select (min(created_at) at time zone 'Europe/Madrid')::date, 'g' from ok
        where kind in ('end', 'quit') and game is not null group by session_id, game) x
  group by d order by d desc limit 60
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'visits',        (select count(*) from visits),
    'sessions',      (select count(distinct session_id) from ok),
    'players',       (select count(*) from pids),
    'returning',     (select count(*) from back),
    'games',         (select count(*) from games),
    'games_pc',      (select count(*) from games where platform = 'pc'),
    'games_touch',   (select count(*) from games where platform = 'touch'),
    'secs_total',    (select coalesce(sum(secs), 0) from games),
    'secs_avg',      (select round(avg(secs)) from games),
    'left_no_play',  (select count(*) from visits v      -- the visit never led to a game (whatever the visit itself said)
                      where not exists (select 1 from public.events g
                                        where g.session_id = v.session_id and g.kind in ('end', 'quit'))),
    'consent_yes',   (select count(*) from visits where data ->> 'consent' = 'yes'),
    'consent_no',    (select count(*) from visits where data ->> 'consent' = 'no'),
    'consent_unset', (select count(*) from visits where data ->> 'consent' = 'unset'),
    'test_games',    (select count(distinct (session_id, game)) from ev where test and kind in ('end', 'quit'))
  ),
  'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visits', visits, 'games', games) order by d), '[]'::jsonb) from days),
  'funnel', (select coalesce(jsonb_agg(jsonb_build_object('round', r, 'all', n_all, 'pc', n_pc, 'touch', n_touch) order by r), '[]'::jsonb) from funnel),
  'last_round', jsonb_build_object(
    'all',   (select mode() within group (order by round) from games),
    'pc',    (select mode() within group (order by round) from games where platform = 'pc'),
    'touch', (select mode() within group (order by round) from games where platform = 'touch')
  ),
  'round_secs', (select coalesce(jsonb_agg(jsonb_build_object('round', r, 'secs', s, 'n', n) order by r), '[]'::jsonb)
                 from (select r, round(avg(s)) as s, count(*) as n from round_times where r between 1 and 100 group by r) x),
  'causes', (select coalesce(jsonb_agg(jsonb_build_object('round', round, 'dead', dead, 'ship', ship, 'cargo', cargo, 'quit', quit) order by round), '[]'::jsonb)
             from (select round,
                          count(*) filter (where kind = 'end' and cause = 'dead')  as dead,
                          count(*) filter (where kind = 'end' and cause = 'ship')  as ship,
                          count(*) filter (where kind = 'end' and cause = 'cargo') as cargo,
                          count(*) filter (where kind = 'quit')                    as quit
                   from games group by round) c),
  'countries', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'n', n) order by n desc, code), '[]'::jsonb)
                from (select coalesce(country, '??') as code, count(distinct session_id) as n from ok group by 1 order by 2 desc, 1 limit 25) x),
  'cities', (select coalesce(jsonb_agg(jsonb_build_object('city', city, 'region', region, 'code', code, 'n', n) order by n desc, city), '[]'::jsonb)
             from (select city, max(region) as region, coalesce(country, '??') as code, count(distinct session_id) as n
                   from ok where city is not null group by city, country order by 4 desc, 1 limit 25) x),
  'platforms', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(platform, '?') as k, count(distinct session_id) as n from ok group by 1) x),
  'os',        (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(os, '?') as k, count(distinct session_id) as n from ok group by 1) x),
  'browsers',  (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(browser, '?') as k, count(distinct session_id) as n from ok group by 1) x),
  'screens',   (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(data ->> 'scr', '?') as k, count(*) as n from visits group by 1) x),
  'langs',     (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(lang, '?') as k, count(*) as n from visits group by 1) x),
  'installed', jsonb_build_object(
    'yes',       (select count(*) from visits where data -> 'inst' = 'true'::jsonb),
    'of',        (select count(*) from visits where data ? 'inst'),
    'touch_yes', (select count(*) from visits where platform = 'touch' and data -> 'inst' = 'true'::jsonb),
    'touch_of',  (select count(*) from visits where platform = 'touch' and data ? 'inst')
  ),
  'quality', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select qmax::text as k, count(*) as n from num where qmax is not null group by 1) x),
  'fps', jsonb_build_object(
    'pc',    (select round(percentile_cont(0.5) within group (order by fps)) from num where platform = 'pc' and fps is not null),
    'touch', (select round(percentile_cont(0.5) within group (order by fps)) from num where platform = 'touch' and fps is not null),
    'n',     (select count(*) from num where fps is not null)
  ),
  'load', jsonb_build_object(
    'pc_p50',    (select round(percentile_cont(0.5) within group (order by load)) from vnum where platform = 'pc' and load is not null),
    'pc_p90',    (select round(percentile_cont(0.9) within group (order by load)) from vnum where platform = 'pc' and load is not null),
    'touch_p50', (select round(percentile_cont(0.5) within group (order by load)) from vnum where platform = 'touch' and load is not null),
    'touch_p90', (select round(percentile_cont(0.9) within group (order by load)) from vnum where platform = 'touch' and load is not null),
    'not_ready', (select count(*) from visits where data -> 'ready' = 'false'::jsonb)
  ),
  'film', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select data ->> 'film' as k, count(*) as n from visits where data ? 'film' group by 1) x),
  'film_skip_secs', (select round(percentile_cont(0.5) within group (order by (data ->> 'filmS')::numeric)) from visits
                     where data ->> 'film' = 'skipped' and jsonb_typeof(data -> 'filmS') = 'number'),
  'tutorial', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select data ->> 'tut' as k, count(*) as n from games where kind = 'end' and data ? 'tut' group by 1) x),
  'tutorial_step', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select data ->> 'tutStep' as k, count(*) as n from games where data ->> 'tut' = 'skip' and data ? 'tutStep' group by 1) x),
  'errors', (select coalesce(jsonb_agg(jsonb_build_object(
                 'msg', t.msg, 'at', t.at, 'n', t.n, 'sessions', t.sessions, 'last', t.last,
                 'env', (select jsonb_agg(jsonb_build_object('os', os, 'browser', browser, 'n', n) order by n desc)
                         from (select os, browser, sum(n) as n from errs e where e.msg = t.msg group by os, browser order by 3 desc limit 6) z)
               ) order by t.n desc), '[]'::jsonb) from err_top t),
  'quits', (select coalesce(jsonb_agg(jsonb_build_object('round', round, 'all', n, 'pc', pc, 'touch', touch) order by round), '[]'::jsonb)
            from (select round, count(*) as n, count(*) filter (where platform = 'pc') as pc, count(*) filter (where platform = 'touch') as touch
                  from games where kind = 'quit' group by round) q)
);
$$;

revoke all on function public.metrics_stats(text, text) from public, anon, authenticated;
grant execute on function public.metrics_stats(text, text) to service_role;

-- the Data API (PostgREST) picks up the new function at once
notify pgrst, 'reload schema';
