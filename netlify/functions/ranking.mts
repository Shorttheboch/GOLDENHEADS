// HEADS · Rescate Dorado — Google accounts and the Season 1 ranking (v82). The referee: the game never writes to the database.
//   GET  /api/auth             the Supabase URL and PUBLISHABLE key for the browser's Google login (read at run time, never built into the page)
//   POST /api/run              signed token for a new run (the server notes when the run started); one use
//   GET  /api/scores           the season board: ?n= lines (1-50, default 10) + number of ranked players (no login needed, cached 20 s);
//                              with &me=1 and a Bearer token, also my own line (never cached)
//   GET  /api/me               Bearer: the signed-in player (nickname, best, place), or null when this Google account has no nickname yet
//   POST /api/nick             Bearer: {nick, accept:true} chooses the nickname, once (unique, checked, cannot be changed afterwards)
//   POST /api/save             Bearer: {token, score, round, stats, secs, plat, lang, n} saves a finished run under the player's nickname (n = lines of the board answered)
//   POST /api/forget           Bearer: deletes the account: the player, all its runs and the Supabase Auth user (GDPR)
//   GET  /api/admin/ranking    x-admin-key = ADMIN_PASSWORD: season top, recent and flagged runs, banned players (public/admin.html)
//   POST /api/admin/ranking    x-admin-key: {action: hide|show, run} or {action: ban|unban, player, note}
// Env (Netlify, scope Functions; Production, Deploy Previews and Branch deploys): SUPABASE_URL, SUPABASE_SECRET_KEY (sb_secret_..., server only),
//   SUPABASE_PUBLISHABLE_KEY (sb_publishable_..., not secret: it goes to the browser through /api/auth), ADMIN_PASSWORD. RANK_SECRET optional (below).
// Sessions: the browser signs in with Google through Supabase Auth (PKCE redirect) and sends its access token as Authorization: Bearer <token>.
//   The token is checked here with Supabase Auth (auth.getUser): the player id is never taken from the body. Only Google accounts count.
// Run tokens: `${start}.${id}.${hmac}` as before (v81 and earlier). The HMAC key is derived, so it also works on previews, where RANK_SECRET
//   does not exist: key = HMAC-SHA256(RANK_SECRET if set, else SUPABASE_SECRET_KEY, "heads-run-token|v82|prod" or "|test").
//   A token from a preview is therefore never valid on the real site, and the other way round.
// Previews never pollute the real board: like the v81 metrics (context.deploy.context !== "production"), what a preview saves is a test run,
//   and a preview's board shows only test runs; the real site shows only real ones. Nicknames are shared (one Supabase Auth for both).
// Season 1 lives in Supabase (supabase/v82-cuentas.sql). The old board in Netlify Blobs (store "ranking", hand-typed names) is "Temporada 0":
//   no longer read or written here, and not deleted.
// Netlify's own limit is in config below (the Personal plan allows 2 rules per project: metrics.mts has the other one); on top of it,
//   per-instance limits per IP in memory (bucket) for nicknames, saves, deletes and admin passwords. The IP is never stored.
import { createClient } from "@supabase/supabase-js";
import type { Config, Context } from "@netlify/functions";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const SEASON = 1, TOP_N = 10, MAX_N = 50, VERSION = "v82"; // MAX_N: rank_board in supabase/v82-cuentas.sql gives 50 lines at most
const TERMS_VER = "2026-11-v82";              // the privacy page and ranking rules the player accepts with the nickname
const MAX_AGE_MS = 4 * 60 * 60 * 1000;        // a run token (and so a pending run kept by a guest during the login) is valid for 4 hours
const MAX_BODY = 8_000;

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

// ---- limits per IP, per instance and in memory (the IP only hashed with a random salt, never stored) ----
const SALT = randomBytes(16);
const ipKey = (ip: string) => createHash("sha256").update(SALT).update(ip || "?").digest("base64url").slice(0, 22);
const HITS = new Map<string, { n: number; t: number }>();
function bucket(name: string, ip: string, windowMs: number) {
  const k = name + ipKey(ip), now = Date.now();
  if (HITS.size > 5000) for (const [key, v] of HITS) if (now - v.t > 3_600_000) HITS.delete(key);
  let h = HITS.get(k);
  if (!h || now - h.t > windowMs) { h = { n: 0, t: now }; HITS.set(k, h); }
  return h;
}
const over = (name: string, ip: string, windowMs: number, max: number) => ++bucket(name, ip, windowMs).n > max;

// ---- run tokens ----
function tokenKey(preview: boolean) {
  const base = Netlify.env.get("RANK_SECRET") || Netlify.env.get("SUPABASE_SECRET_KEY");
  if (!base) return null;
  return createHmac("sha256", base).update("heads-run-token|v82|" + (preview ? "test" : "prod")).digest();
}
const sign = (key: Buffer, payload: string) => createHmac("sha256", key).update(payload).digest("base64url");
function makeToken(key: Buffer) {
  const payload = `${Date.now()}.${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  return `${payload}.${sign(key, payload)}`;
}
function readToken(key: Buffer, tok: unknown) {
  if (typeof tok !== "string" || tok.length > 200) return null;
  const parts = tok.split(".");
  if (parts.length !== 3) return null;
  const [t, id, sig] = parts;
  const a = Buffer.from(sig), b = Buffer.from(sign(key, `${t}.${id}`));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const start = Number(t);
  if (!Number.isFinite(start) || !/^[0-9a-f]{16}$/.test(id)) return null;
  return { start, id };
}

// ---- nicknames: 3-12 of A-Z 0-9 ÁÉÍÓÚÜÑÇ . _ -, upper case; unique on the key (no accents, no . _ -), no bad words, no reserved names ----
const NICK_RE = /^[A-Z0-9ÁÉÍÓÚÜÑÇ._-]{3,12}$/;
const FOLD: Record<string, string> = { "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U", "Ñ": "N", "Ç": "C" };
const nickKey = (n: string) => n.replace(/[ÁÉÍÓÚÜÑÇ._-]/g, (c) => FOLD[c] ?? ""); // the same as the nick_key column in SQL
const BAD = /(puta|puto|mierda|polla|joder|cabron|maricon|zorra|nazi|hitler|fuck|shit|cunt|nigg|fagg|bitch|gilipoll|subnormal|pendej|verga|chinga|follar|whore|slut|pussy|porn|penis)/i;
const LEET: Record<string, string> = { "0": "O", "1": "I", "3": "E", "4": "A", "5": "S", "7": "T", "8": "B" };
const RESERVED_IN = ["HEADS", "ADMIN", "GOLDENHEAD"]; // anywhere in the nickname
const RESERVED = new Set(["PILOTO", "NUGGET", "VEGA", "IRIS", "MOD", "MODERADOR", "MODERATOR", "SOPORTE", "SUPPORT", "OFICIAL", "OFFICIAL", "STAFF",
  "SISTEMA", "SYSTEM", "ROOT", "ASTRONAUTA", "ASTRONAUT", "CAPITAN", "CAPTAIN", "ANONIMO", "ANONYMOUS", "INVITADO", "GUEST", "NULL", "UNDEFINED"]);
function checkNick(raw: unknown): { nick: string } | { error: "format" | "bad" | "reserved" } {
  const n = String(typeof raw === "string" ? raw : "").normalize("NFC").trim().toUpperCase();
  if (!NICK_RE.test(n)) return { error: "format" };
  const key = nickKey(n);
  if (key.length < 3) return { error: "format" };
  const unleet = key.replace(/[0134578]/g, (c) => LEET[c]);
  if (BAD.test(key) || BAD.test(unleet)) return { error: "bad" };
  if (RESERVED.has(key) || RESERVED.has(unleet) || RESERVED_IN.some((w) => key.includes(w) || unleet.includes(w))) return { error: "reserved" };
  return { nick: n };
}

// ---- Supabase (server side only, secret key) ----
let DB: ReturnType<typeof createClient> | null = null;
function db() {
  const url = Netlify.env.get("SUPABASE_URL"), key = Netlify.env.get("SUPABASE_SECRET_KEY");
  if (!url || !key) return null;
  return (DB ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
}
async function rpc(sb: NonNullable<ReturnType<typeof db>>, fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(fn + ": " + error.message);
  return data as any;
}
// the signed-in user, checked with Supabase Auth; null = no valid session
async function who(req: Request, sb: NonNullable<ReturnType<typeof db>>) {
  const m = /^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/.exec(req.headers.get("authorization") || "");
  if (!m || m[1].length > 4096) return null;
  const { data, error } = await sb.auth.getUser(m[1]);
  const u = data?.user;
  if (error || !u?.id) return null;
  const am: any = u.app_metadata || {};
  const google = (am.provider === "google" || (Array.isArray(am.providers) && am.providers.includes("google"))) && !(u as any).is_anonymous;
  return { id: u.id as string, google };
}

const num = (v: unknown, hi = 1e9) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, hi) : null; };
// the stats kept with a run: only these keys, only numbers
const STATS: [string, number][] = [["kills", 1e5], ["heads", 1e5], ["acc", 100], ["saved", 1e7], ["repairs", 1e5], ["combat", 1e8], ["cargo", 1e8],
  ["spit", 999], ["inc", 999], ["eggs", 999], ["xp", 999]];
async function body(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try { const b = JSON.parse(text || "{}"); return b && typeof b === "object" && !Array.isArray(b) ? b : null; } catch { return null; }
}
const sha = (s: string) => createHash("sha256").update(s).digest();
// how many lines of the board to answer: 1..MAX_N, TOP_N when missing or not a number
const lines = (v: unknown) => { const n = Math.round(Number(v)); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? TOP_N : Math.min(MAX_N, Math.max(1, n)); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req: Request, context: Context) => {
  const path = new URL(req.url).pathname, ip = context.ip || "";
  const preview = !!context.deploy?.context && context.deploy.context !== "production";
  try {
    // ---------- the browser's login settings ----------
    if (path === "/api/auth") {
      if (req.method !== "GET") return json({ error: "método no permitido" }, 405);
      const url = Netlify.env.get("SUPABASE_URL"), key = Netlify.env.get("SUPABASE_PUBLISHABLE_KEY");
      if (!url || !key || /^sb_secret_/.test(key)) return json({ error: "off" }, 503); // (never hand out a secret key by mistake)
      return json({ url, key }, 200, { "cache-control": "public, max-age=300" });
    }

    // ---------- a new run ----------
    if (path === "/api/run") {
      if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
      const key = tokenKey(preview);
      if (!key) return json({ error: "ranking no configurado" }, 503);
      return json({ token: makeToken(key) });
    }

    // ---------- admin (Santi's /admin page, same password as the statistics) ----------
    if (path === "/api/admin/ranking") {
      if (req.method !== "GET" && req.method !== "POST") return json({ error: "método no permitido" }, 405);
      const pass = Netlify.env.get("ADMIN_PASSWORD");
      if (!pass) return json({ error: "admin no configurado" }, 503);
      const fails = bucket("a:", ip, 15 * 60_000); // 8 wrong passwords from one IP = 15 minutes out
      if (fails.n >= 8) return json({ error: "demasiados intentos, espera unos minutos" }, 429);
      if (!timingSafeEqual(sha(req.headers.get("x-admin-key") || ""), sha(pass))) { fails.n++; return json({ error: "contraseña incorrecta" }, 401); }
      const sb = db();
      if (!sb) return json({ error: "ranking no configurado" }, 503);
      if (req.method === "GET") {
        const data = await rpc(sb, "rank_admin", { p_season: SEASON, p_test: preview, p_limit: 50 });
        return json({ season: SEASON, test: preview, at: new Date().toISOString(), ...data });
      }
      const b = await body(req);
      if (!b) return json({ error: "datos no válidos" }, 400);
      const action = ["hide", "show", "ban", "unban"].includes(b.action) ? b.action : null;
      const run = Number.isSafeInteger(b.run) && b.run > 0 ? b.run : null;
      const player = typeof b.player === "string" && UUID.test(b.player) ? b.player : null;
      if (!action || ((action === "hide" || action === "show") ? !run : !player)) return json({ error: "datos no válidos" }, 400);
      const note = typeof b.note === "string" ? b.note.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim().slice(0, 200) || null : null;
      const r = await rpc(sb, "rank_moderate", { p_action: action, p_run: run, p_player: player, p_note: note });
      if (r?.error) return json({ error: r.error === "notfound" ? "no encontrado" : "acción no válida" }, r.error === "notfound" ? 404 : 400);
      return json({ ok: true });
    }

    const sb = db();
    if (!sb) return json({ error: "ranking no configurado" }, 503);

    // ---------- the board, for everybody ----------
    if (path === "/api/scores") {
      if (req.method !== "GET") return json({ error: "método no permitido" }, 405);
      const q = new URL(req.url).searchParams, n = lines(q.get("n"));
      if (q.get("me") === "1") { // my own line too: the session is checked, and the answer is never cached (its address differs from the shared one)
        if (over("u:", ip, 10 * 60_000, 120)) return json({ error: "demasiadas peticiones" }, 429);
        const u = req.headers.get("authorization") ? await who(req, sb) : null;
        const b = await rpc(sb, "rank_board", { p_season: SEASON, p_test: preview, p_limit: n, p_player: u?.google ? u.id : null });
        return json({ season: SEASON, count: b?.count ?? 0, top: b?.top ?? [], me: b?.me ?? null });
      }
      const b = await rpc(sb, "rank_board", { p_season: SEASON, p_test: preview, p_limit: n, p_player: null });
      return json({ season: SEASON, count: b?.count ?? 0, top: b?.top ?? [] }, 200, {
        "netlify-cdn-cache-control": "public, durable, s-maxage=20, stale-while-revalidate=60",
      });
    }

    // ---------- everything below needs a Google session ----------
    if (!["/api/me", "/api/nick", "/api/save", "/api/forget"].includes(path)) return json({ error: "no encontrado" }, 404);
    if (path === "/api/me" ? req.method !== "GET" : req.method !== "POST") return json({ error: "método no permitido" }, 405);
    if (over("u:", ip, 10 * 60_000, 120)) return json({ error: "demasiadas peticiones" }, 429);
    const u = await who(req, sb);
    if (!u) return json({ error: "session" }, 401);

    if (path === "/api/forget") { // GDPR: the player, every run, then the Supabase Auth user (any account may delete itself)
      if (over("f:", ip, 60 * 60_000, 6)) return json({ error: "demasiadas peticiones" }, 429);
      const r = await rpc(sb, "rank_forget", { p_player: u.id });
      const { error } = await sb.auth.admin.deleteUser(u.id);
      if (error) { console.error("forget: auth user not deleted", error.message); return json({ error: "auth", runs: r?.runs ?? 0 }, 502); }
      return json({ deleted: true, runs: r?.runs ?? 0 });
    }
    if (!u.google) return json({ error: "google" }, 403);

    if (path === "/api/me") {
      const player = await rpc(sb, "rank_player", { p_player: u.id, p_season: SEASON, p_test: preview });
      return json({ season: SEASON, player: player ?? null });
    }

    if (path === "/api/nick") {
      if (over("n:", ip, 10 * 60_000, 20)) return json({ error: "demasiadas peticiones" }, 429);
      const b = await body(req);
      if (!b) return json({ error: "datos no válidos" }, 400);
      if (b.accept !== true) return json({ error: "terms" }, 400);
      const c = checkNick(b.nick);
      if ("error" in c) return json({ error: c.error }, 400);
      const r = await rpc(sb, "rank_nick", { p_player: u.id, p_nick: c.nick, p_terms_ver: TERMS_VER, p_preview: preview });
      if (r?.error === "taken") return json({ error: "taken" }, 409);
      if (r?.error === "exists") return json({ error: "exists", nick: r.nick }, 409);
      if (r?.error) return json({ error: r.error === "format" ? "format" : "nouser" }, 400);
      return json({ ok: true, nick: r.nick });
    }

    // ---------- /api/save: one finished run ----------
    if (over("s:", ip, 10 * 60_000, 40)) return json({ error: "demasiadas peticiones" }, 429);
    const b = await body(req);
    if (!b) return json({ error: "datos no válidos" }, 400);
    const key = tokenKey(preview);
    const tok = key && readToken(key, b.token);
    if (!tok) return json({ error: "token" }, 400);
    const now = Date.now(), elapsed = (now - tok.start) / 1000;
    if (now - tok.start > MAX_AGE_MS) return json({ error: "expired" }, 400);
    const score = Math.round(Number(b.score)), round = Math.round(Number(b.round));
    const sane = Number.isFinite(score) && score >= 1 && score <= 10_000_000 && Number.isFinite(round) && round >= 1 && round <= 500;
    // impossible (refused): rounds take time and points come at a bounded pace, measured with the server's clock (as before v82)
    if (!sane || elapsed < 3 || round > 1 + elapsed / 12 || score > 3000 * round + 400 * elapsed) return json({ error: "implausible" }, 400);
    const st = b.stats && typeof b.stats === "object" ? b.stats : {};
    const stats: Record<string, number> = {};
    for (const [k, hi] of STATS) { const v = num(st[k], hi); if (v !== null) stats[k] = v; }
    const csecs = num(b.secs, 86_400); // the game's own clock (play time, pauses and the login not counted)
    if (csecs !== null) stats.csecs = csecs;
    // suspicious (saved, but off the board until Santi looks at it in /admin)
    const flags: string[] = [];
    if (csecs === null) flags.push("no_clock");
    else {
      if (csecs > elapsed + 15) flags.push("clock");          // the game says it played longer than the server saw
      if (round > 2 + csecs / 15) flags.push("fast");         // under 15 s a round on average
    }
    if (score > 6000 * round) flags.push("score");           // far above what a round gives (about 1.000 of cargo + combat)
    const r = await rpc(sb, "rank_submit", {
      p_player: u.id, p_token: tok.id, p_score: score, p_round: round, p_secs: Math.min(86_400, Math.round(elapsed)), p_stats: stats,
      p_platform: ["pc", "touch"].includes(b.plat) ? b.plat : null, p_lang: ["es", "en"].includes(b.lang) ? b.lang : null, p_version: VERSION,
      p_status: flags.length ? "flagged" : "ok", p_flags: flags, p_test: preview, p_season: SEASON, p_limit: lines(b.n),
    });
    if (r?.error === "nick") return json({ error: "nick" }, 403);
    if (r?.error === "banned") return json({ error: "banned" }, 403);
    if (r?.error === "used") return json({ error: "used" }, 409);
    if (!r?.saved) throw new Error("rank_submit: unexpected answer");
    return json({ saved: true, status: r.status, nick: r.nick, newBest: !!r.new_best, prevBest: r.prev_best ?? null, best: r.best ?? null,
      count: r.board?.count ?? 0, top: r.board?.top ?? [], me: r.board?.me ?? null });
  } catch (err) {
    console.error("ranking error", err);
    return json({ error: "ranking no disponible" }, 500);
  }
};

export const config: Config = {
  path: ["/api/auth", "/api/run", "/api/scores", "/api/me", "/api/nick", "/api/save", "/api/forget", "/api/admin/ranking"],
  // Netlify's limit, across all instances (the Personal plan allows 2 rules per project: metrics.mts has the other one)
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
