-- HEADS Rescate Dorado · v82b: nicknames with À È Ò Ï, and old anonymous stats pruned after 2 years
-- Run it by hand in Supabase > SQL editor, AFTER supabase/schema.sql (v81) and supabase/v82-cuentas.sql (v82). It is idempotent: running it
-- again changes nothing. A fresh database needs the three files, in that order.
--
-- 1) Nicknames: Santi's decision, for Catalan / Valencian names: À È Ò Ï are allowed too (Ç already was). In the uniqueness key they fold to
--    A E O I like the other accents («JÒRDI» = «JORDI» = «Jordi»). The key is a generated column, so it is rebuilt here (only if it is still
--    the v82 one). No existing nickname can contain the new letters, so no key changes and no clash can appear.
--    The Worker (worker/ranking.ts, checkNick) and the game (src/game/40-cuentas.js) check the same letters.
-- 2) metrics_prune(): deletes the anonymous play events (public.events, v81) older than 2 years, as the privacy page says.
--    The Worker (worker/metrics.ts) calls it at most once a day, when Santi opens /admin (GET /api/admin/stats).

-- ---------------------------------------------------------------------------------------------------------------------
-- 1) players: the allowed letters and the uniqueness key
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.players drop constraint if exists players_nick_ok;
alter table public.players add constraint players_nick_ok check (nick ~ '^[A-Z0-9ÁÉÍÓÚÜÑÇÀÈÒÏ._-]{3,12}$');

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'players' and column_name = 'nick_key'
                   and generation_expression like '%ÀÈÒÏ%') then
    drop index if exists public.players_nick_key_uq;
    alter table public.players drop constraint if exists players_key_ok;
    alter table public.players drop column if exists nick_key;
    -- Á É Í Ó Ú Ü Ñ Ç À È Ò Ï -> A E I O U U N C A E O I; . _ - are dropped (no counterpart in the second list)
    alter table public.players add column nick_key text generated always as (translate(nick, 'ÁÉÍÓÚÜÑÇÀÈÒÏ._-', 'AEIOUUNCAEOI')) stored;
    alter table public.players add constraint players_key_ok check (nick_key ~ '^[A-Z0-9]{3,12}$');
    create unique index players_nick_key_uq on public.players (nick_key);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2) metrics_prune(): anonymous events older than 2 years go. Answers how many were deleted. Only the function (service_role) may call it.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.metrics_prune()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare n int;
begin
  delete from public.events where created_at < now() - interval '2 years';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.metrics_prune() from public, anon, authenticated;
grant execute on function public.metrics_prune() to service_role;

-- the Data API (PostgREST) picks up the new function at once
notify pgrst, 'reload schema';
