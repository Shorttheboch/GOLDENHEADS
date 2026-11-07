-- HEADS Rescate Dorado · Google accounts and the Season 1 ranking (v82)
-- Run it by hand in Supabase > SQL editor, after supabase/schema.sql (v81). It is idempotent: running it again changes nothing
-- (tables and indexes are created only if missing; the functions are replaced).
--
-- Who writes and reads: only the Worker (worker/ranking.ts; Netlify function until v84), with the secret key (SUPABASE_SECRET_KEY, Postgres role
-- service_role). The game never talks to these tables: the browser only talks to Supabase Auth (Google login, publishable key), and sends
-- its runs to the function, which checks the session (Authorization: Bearer <access token>) and the signed run token before saving anything.
-- Everything is explicit, as in schema.sql:
--   * RLS on both tables, with NO policies: nobody gets rows through the browser keys (anon / authenticated)
--   * anon and authenticated get nothing at all, service_role gets no table rights either:
--     only EXECUTE on the rank_* functions below (SECURITY DEFINER, empty search_path), which do exactly what the function needs
--   * no email is ever copied here: the Google account id and email stay in Supabase Auth (auth.users / auth.identities);
--     players.id is the auth user id, and no function returns an email
-- Season 1 starts with v82. The old ranking (Netlify Blobs, hand-typed names) is "Temporada 0": archived, not here, not deleted.
-- Deleting an account (in-game button or by email): rank_forget() deletes the player and its runs, then the function deletes the auth user
-- (auth.admin.deleteUser); the foreign key below also cascades if the auth user is deleted from the Supabase dashboard.

-- ---------------------------------------------------------------------------------------------------------------------
-- players: one row per Google account that chose a nickname (the nickname cannot be changed by the player afterwards)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.players (
  id            uuid primary key references auth.users (id) on delete cascade,  -- the Supabase Auth user (Google login)
  nick          text not null,             -- as shown: upper case, 3-12 of A-Z 0-9 ÁÉÍÓÚÜÑÇ . _ -
  -- the uniqueness key: no accents, no . _ - («santi», «SANTI», «Sántí» and «S.ANTI» are the same nickname)
  nick_key      text generated always as (translate(nick, 'ÁÉÍÓÚÜÑÇ._-', 'AEIOUUNC')) stored,
  terms_at      timestamptz not null,      -- when the player accepted the privacy page and the ranking rules (the line under the nickname box)
  terms_ver     text not null,             -- which version of them ('2026-11-v82', ...)
  from_preview  boolean not null default false,  -- the nickname was chosen on a Netlify preview (a test account, most likely)
  banned        boolean not null default false,  -- banned from the ranking (admin): saves refused, never on the board
  banned_at     timestamptz,
  ban_note      text,
  created_at    timestamptz not null default now(),
  constraint players_nick_ok check (nick ~ '^[A-Z0-9ÁÉÍÓÚÜÑÇ._-]{3,12}$'),
  constraint players_key_ok  check (nick_key ~ '^[A-Z0-9]{3,12}$')
);
create unique index if not exists players_nick_key_uq on public.players (nick_key);
create index if not exists players_banned_idx on public.players (id) where banned;

-- ---------------------------------------------------------------------------------------------------------------------
-- runs: every saved run (a run token can be saved once: token_id is unique)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.runs (
  id           bigint generated always as identity primary key,
  player_id    uuid not null references public.players (id) on delete cascade,
  season       smallint not null default 1,
  token_id     text not null,              -- the id inside the signed run token (one use)
  score        integer not null,
  round        smallint not null,
  secs         integer not null,           -- measured by the server: from the run token (game start) to the save
  stats        jsonb not null default '{}'::jsonb,  -- kills, headshots, accuracy, ... and the game's own clock (csecs), whitelisted by the function
  platform     text,                       -- pc / touch
  lang         text,                       -- es / en
  version      text,                       -- 'v82', ...
  status       text not null default 'ok', -- ok (on the board) · flagged (suspicious, waits for Santi) · rejected (hidden by Santi)
  flags        text[] not null default '{}',  -- why it was flagged
  test         boolean not null default false,  -- saved from a Netlify preview: only the previews' board shows it
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,                -- when Santi hid or showed it
  constraint runs_token_ok    check (token_id ~ '^[0-9a-f]{16}$'),
  constraint runs_score_ok    check (score between 1 and 10000000),
  constraint runs_round_ok    check (round between 1 and 500),
  constraint runs_secs_ok     check (secs between 0 and 86400),
  constraint runs_status_ok   check (status in ('ok', 'flagged', 'rejected')),
  constraint runs_platform_ok check (platform is null or platform in ('pc', 'touch'))
);
create unique index if not exists runs_token_uq on public.runs (token_id);
create index if not exists runs_board_idx   on public.runs (season, test, player_id, score desc, created_at) where status = 'ok';
create index if not exists runs_player_idx  on public.runs (player_id, created_at desc);
create index if not exists runs_recent_idx  on public.runs (created_at desc);
create index if not exists runs_flagged_idx on public.runs (created_at desc) where status = 'flagged';

alter table public.players enable row level security;   -- and no policies on purpose
alter table public.runs    enable row level security;

revoke all on table public.players, public.runs from public, anon, authenticated, service_role;
do $$
declare s text := pg_get_serial_sequence('public.runs', 'id');
begin
  if s is not null then execute format('revoke all on sequence %s from public, anon, authenticated, service_role', s); end if;
end $$;
grant usage on schema public to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- rank_board(season, test, limit, player): the board. Best run per player (status ok, player not banned), best first; ties: who got there first.
--   test = false on the real site, true on Netlify previews (each only ever sees its own runs).
--   Answers {count, top: [{pos, nick, score, round, me}], me: {pos, nick, score, round} | null}. No ids, no emails.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.rank_board(p_season smallint, p_test boolean, p_limit int default 10, p_player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with best as (
  select distinct on (r.player_id) r.player_id, r.score, r.round, r.created_at
  from public.runs r join public.players p on p.id = r.player_id
  where r.season = p_season and r.test = p_test and r.status = 'ok' and not p.banned
  order by r.player_id, r.score desc, r.created_at
),
ranked as (
  select b.*, p.nick, row_number() over (order by b.score desc, b.created_at, b.player_id) as pos
  from best b join public.players p on p.id = b.player_id
)
select jsonb_build_object(
  'count', (select count(*) from ranked),
  'top',   coalesce((select jsonb_agg(jsonb_build_object('pos', pos, 'nick', nick, 'score', score, 'round', round, 'me', coalesce(player_id = p_player, false)) order by pos)
                     from ranked where pos <= least(greatest(coalesce(p_limit, 10), 1), 50)), '[]'::jsonb),
  'me',    (select jsonb_build_object('pos', pos, 'nick', nick, 'score', score, 'round', round) from ranked where player_id = p_player)
);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- rank_player(player, season, test): the signed-in player, or null when this Google account has no nickname yet.
--   {nick, banned, best: {score, round} | null, pos | null, count}
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.rank_player(p_player uuid, p_season smallint, p_test boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare pl public.players; b jsonb;
begin
  select * into pl from public.players where id = p_player;
  if not found then return null; end if;
  b := public.rank_board(p_season, p_test, 1, p_player);
  return jsonb_build_object(
    'nick', pl.nick, 'banned', pl.banned,
    'best', (select jsonb_build_object('score', r.score, 'round', r.round) from public.runs r
             where r.player_id = p_player and r.season = p_season and r.test = p_test and r.status = 'ok'
             order by r.score desc, r.created_at limit 1),
    'pos', b -> 'me' -> 'pos', 'count', b -> 'count');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- rank_nick(player, nick, terms version, from preview): chooses the nickname, once.
--   The function has already cleaned it (upper case, allowed letters, length, bad words, reserved names); the table checks the format again.
--   {ok, nick} · {error: 'exists', nick} (this account already has one: it cannot be changed) · {error: 'taken'} · {error: 'format'} · {error: 'nouser'}
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.rank_nick(p_player uuid, p_nick text, p_terms_ver text, p_preview boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare cur text; con text;
begin
  select nick into cur from public.players where id = p_player;
  if found then return jsonb_build_object('error', 'exists', 'nick', cur); end if;
  begin
    insert into public.players (id, nick, terms_at, terms_ver, from_preview) values (p_player, p_nick, now(), p_terms_ver, coalesce(p_preview, false));
  exception
    when unique_violation then
      get stacked diagnostics con = constraint_name;
      if con = 'players_pkey' then
        select nick into cur from public.players where id = p_player;
        return jsonb_build_object('error', 'exists', 'nick', cur);
      end if;
      return jsonb_build_object('error', 'taken');
    when check_violation then return jsonb_build_object('error', 'format');
    when foreign_key_violation then return jsonb_build_object('error', 'nouser');
  end;
  return jsonb_build_object('ok', true, 'nick', p_nick);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- rank_submit(...): saves one run of a player that has a nickname, and answers with everything the end plate shows.
--   The function has already checked the session, the signed run token (age, one use is checked here), plausibility and the flags.
--   {saved, status, nick, new_best, prev_best, best: {score, round}, board: rank_board(...)}
--   · {error: 'nick'} no nickname yet · {error: 'banned'} · {error: 'used'} that run token was already saved
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.rank_submit(
  p_player uuid, p_token text, p_score int, p_round int, p_secs int, p_stats jsonb,
  p_platform text, p_lang text, p_version text, p_status text, p_flags text[], p_test boolean,
  p_season smallint default 1, p_limit int default 10)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare pl public.players; prev int; rid bigint;
begin
  select * into pl from public.players where id = p_player;
  if not found then return jsonb_build_object('error', 'nick'); end if;
  if pl.banned then return jsonb_build_object('error', 'banned'); end if;
  select max(score) into prev from public.runs
   where player_id = p_player and season = p_season and test = p_test and status = 'ok';
  begin
    insert into public.runs (player_id, season, token_id, score, round, secs, stats, platform, lang, version, status, flags, test)
    values (p_player, p_season, p_token, p_score, p_round, p_secs, coalesce(p_stats, '{}'::jsonb), p_platform, p_lang, p_version,
            coalesce(p_status, 'ok'), coalesce(p_flags, '{}'), p_test)
    returning id into rid;
  exception when unique_violation then
    return jsonb_build_object('error', 'used');
  end;
  return jsonb_build_object(
    'saved', true, 'status', coalesce(p_status, 'ok'), 'nick', pl.nick,
    'prev_best', prev,
    'new_best', coalesce(p_status, 'ok') = 'ok' and (prev is null or p_score > prev),
    'best', (select jsonb_build_object('score', r.score, 'round', r.round) from public.runs r
             where r.player_id = p_player and r.season = p_season and r.test = p_test and r.status = 'ok'
             order by r.score desc, r.created_at limit 1),
    'board', public.rank_board(p_season, p_test, p_limit, p_player));
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- rank_forget(player): deletes the player and all its runs (every season, real and test). {runs: n, player: true|false}
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.rank_forget(p_player uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare n int; m int;
begin
  delete from public.runs where player_id = p_player;
  get diagnostics n = row_count;
  delete from public.players where id = p_player;
  get diagnostics m = row_count;
  return jsonb_build_object('runs', n, 'player', m > 0);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- rank_admin(season, test, limit): Santi's Ranking section in /admin, in one call.
--   {summary, top (best ok run per player, banned players included and marked), recent (last runs), flagged (runs waiting), banned (players)}
--   Player ids are given (to ban / unban), emails never.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.rank_admin(p_season smallint, p_test boolean, p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with lim as (select least(greatest(coalesce(p_limit, 50), 1), 200) as n),
r as (select * from public.runs where season = p_season and test = p_test),
best as (
  select distinct on (r.player_id) r.player_id, r.id, r.score, r.round, r.secs, r.created_at, r.flags, r.platform
  from r where r.status = 'ok' order by r.player_id, r.score desc, r.created_at
),
per as (
  select player_id, count(*) as runs, count(*) filter (where status = 'flagged') as flagged, count(*) filter (where status = 'rejected') as rejected
  from r group by player_id
),
top as (
  select b.*, p.nick, p.banned, per.runs, per.flagged, per.rejected,
         row_number() over (order by p.banned, b.score desc, b.created_at, b.player_id) as pos
  from best b join public.players p on p.id = b.player_id join per on per.player_id = b.player_id
),
run_row as (
  select r.id, r.player_id, p.nick, p.banned, r.score, r.round, r.secs, r.platform, r.status, r.flags, r.created_at, r.reviewed_at,
         case when jsonb_typeof(r.stats -> 'csecs') = 'number' then (r.stats ->> 'csecs')::int end as csecs
  from r join public.players p on p.id = r.player_id
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'players',  (select count(*) from per),
    'ranked',   (select count(*) from top where not banned),
    'runs',     (select count(*) from r),
    'flagged',  (select count(*) from r where status = 'flagged'),
    'rejected', (select count(*) from r where status = 'rejected'),
    'banned',   (select count(*) from public.players where banned),
    'accounts', (select count(*) from public.players),
    'today',    (select count(*) from r where created_at >= date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid')),
  'top', coalesce((select jsonb_agg(jsonb_build_object('pos', pos, 'player', player_id, 'nick', nick, 'banned', banned, 'run', id, 'score', score, 'round', round,
                     'secs', secs, 'platform', platform, 'at', created_at, 'flags', to_jsonb(flags), 'runs', runs, 'flagged', flagged, 'rejected', rejected) order by pos)
                   from top, lim where pos <= lim.n), '[]'::jsonb),
  'recent', coalesce((select jsonb_agg(q.x order by q.created_at desc) from (
                   select jsonb_build_object('run', id, 'player', player_id, 'nick', nick, 'banned', banned, 'score', score, 'round', round, 'secs', secs,
                     'csecs', csecs, 'platform', platform, 'status', status, 'flags', to_jsonb(flags), 'at', created_at, 'reviewed', reviewed_at) as x, created_at
                   from run_row, lim order by created_at desc limit (select n from lim)) q), '[]'::jsonb),
  'flagged', coalesce((select jsonb_agg(q.x order by q.created_at desc) from (
                   select jsonb_build_object('run', id, 'player', player_id, 'nick', nick, 'banned', banned, 'score', score, 'round', round, 'secs', secs,
                     'csecs', csecs, 'platform', platform, 'status', status, 'flags', to_jsonb(flags), 'at', created_at) as x, created_at
                   from run_row where status = 'flagged' order by created_at desc limit 100) q), '[]'::jsonb),
  'banned', coalesce((select jsonb_agg(jsonb_build_object('player', p.id, 'nick', p.nick, 'at', p.banned_at, 'note', p.ban_note) order by p.banned_at desc nulls last)
                   from public.players p where p.banned), '[]'::jsonb)
);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- rank_moderate(action, run, player, note): hide (run -> rejected) · show (run -> ok, also approves a flagged one) · ban · unban (player)
--   {ok: true} · {error: 'notfound'} · {error: 'action'}
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.rank_moderate(p_action text, p_run bigint default null, p_player uuid default null, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare n int := 0;
begin
  if p_action in ('hide', 'show') then
    update public.runs set status = case when p_action = 'hide' then 'rejected' else 'ok' end, reviewed_at = now() where id = p_run;
    get diagnostics n = row_count;
  elsif p_action in ('ban', 'unban') then
    update public.players set banned = (p_action = 'ban'), banned_at = case when p_action = 'ban' then now() end,
                              ban_note = case when p_action = 'ban' then left(p_note, 200) end
     where id = p_player;
    get diagnostics n = row_count;
  else
    return jsonb_build_object('error', 'action');
  end if;
  if n = 0 then return jsonb_build_object('error', 'notfound'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- only the Netlify function (service_role) may call them; the browser roles nothing
revoke all on function public.rank_board(smallint, boolean, int, uuid) from public, anon, authenticated;
revoke all on function public.rank_player(uuid, smallint, boolean) from public, anon, authenticated;
revoke all on function public.rank_nick(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.rank_submit(uuid, text, int, int, int, jsonb, text, text, text, text, text[], boolean, smallint, int) from public, anon, authenticated;
revoke all on function public.rank_forget(uuid) from public, anon, authenticated;
revoke all on function public.rank_admin(smallint, boolean, int) from public, anon, authenticated;
revoke all on function public.rank_moderate(text, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.rank_board(smallint, boolean, int, uuid) to service_role;
grant execute on function public.rank_player(uuid, smallint, boolean) to service_role;
grant execute on function public.rank_nick(uuid, text, text, boolean) to service_role;
grant execute on function public.rank_submit(uuid, text, int, int, int, jsonb, text, text, text, text, text[], boolean, smallint, int) to service_role;
grant execute on function public.rank_forget(uuid) to service_role;
grant execute on function public.rank_admin(smallint, boolean, int) to service_role;
grant execute on function public.rank_moderate(text, bigint, uuid, text) to service_role;

-- the Data API (PostgREST) picks up the new functions at once
notify pgrst, 'reload schema';
