// HEADS · Rescate Dorado — anonymous play metrics (v81)
// POST /api/m               one event or a small batch {e:[...]} from the game (src/game/39-metricas.js) -> Supabase table public.events
// GET  /api/admin/stats     ?range=today|7d|30d|all&platform=all|pc|touch, for the admin page (public/admin.html, /admin).
//                           Header x-admin-key must equal ADMIN_PASSWORD. Answers only totals (SQL function public.metrics_stats, supabase/schema.sql).
// Env (Netlify, scope Functions; Production AND Deploy Previews): SUPABASE_URL, SUPABASE_SECRET_KEY (sb_secret_...), ADMIN_PASSWORD.
// Deploy Previews and branch deploys store their events as tests (test = true): they show only in the test count of /admin, never in the numbers.
// Privacy: the IP is only used here, in memory, hashed with a random salt for the rate limit, and never stored. Country / region / city come from Netlify geo.
// Every field is whitelisted and clamped; anything else is dropped. Paths are relative (/api/...): no domain anywhere.
import { createClient } from "@supabase/supabase-js";
import type { Config, Context } from "@netlify/functions";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_BODY = 16_000, MAX_EVENTS = 12;
const json = (data: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// ---- rate limit, per instance and in memory (Netlify's own limit in config below covers all instances) ----
const SALT = randomBytes(16);
const ipKey = (ip: string) => createHash("sha256").update(SALT).update(ip || "?").digest("base64url").slice(0, 22);
const HITS = new Map<string, { n: number; t: number }>();
function bucket(name: string, ip: string, windowMs: number) { // this IP's counter in this window
  const k = name + ipKey(ip), now = Date.now();
  if (HITS.size > 5000) for (const [key, v] of HITS) if (now - v.t > 3_600_000) HITS.delete(key);
  let h = HITS.get(k);
  if (!h || now - h.t > windowMs) { h = { n: 0, t: now }; HITS.set(k, h); }
  return h;
}

// ---- input cleaning: only these keys, these values, these ranges ----
const ID = /^[0-9a-f]{16,32}$/;
const oneOf = (v: unknown, list: string[]) => (typeof v === "string" && list.includes(v) ? v : null);
const int = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return v === null || v === "" || typeof v === "boolean" || !Number.isFinite(n) ? null : Math.min(hi, Math.max(lo, n));
};
const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max) || null : null);
const OS = ["ios", "android", "windows", "mac", "linux", "other"], BR = ["chrome", "safari", "firefox", "edge", "samsung", "opera", "other"];
// data fields by kind: [key, cleaner]
const DATA: Record<string, [string, (v: unknown) => unknown][]> = {
  visit: [
    ["scr", (v) => oneOf(v, ["phone", "tablet", "pc-s", "pc-m", "pc-l"])], ["blang", (v) => (typeof v === "string" && /^[a-z]{2}$/.test(v) ? v : null)],
    ["inst", bool], ["go", bool], ["ready", bool], ["consent", (v) => oneOf(v, ["yes", "no", "unset"])], ["load", (v) => int(v, 0, 600_000)],
    ["film", (v) => oneOf(v, ["none", "watched", "skipped", "error", "left"])], ["filmS", (v) => int(v, 0, 120)],
  ],
  end: [
    ["score", (v) => int(v, 0, 1e8)], ["combat", (v) => int(v, 0, 1e8)], ["cargo", (v) => int(v, 0, 1e8)], ["kills", (v) => int(v, 0, 1e5)],
    ["heads", (v) => int(v, 0, 1e5)], ["acc", (v) => int(v, 0, 100)], ["xp", (v) => int(v, 0, 999)], ["eggs", (v) => int(v, 0, 999)],
    ["eggsK", (v) => int(v, 0, 999)], ["spit", (v) => int(v, 0, 999)], ["inc", (v) => int(v, 0, 999)], ["rep", (v) => int(v, 0, 1e5)],
    ["q", (v) => int(v, 0, 9)], ["qMax", (v) => int(v, 0, 9)], ["fps", (v) => int(v, 0, 1000)], ["r0", (v) => int(v, 1, 999)],
    ["rt", (v) => (Array.isArray(v) ? v.slice(0, 60).map((x) => int(x, 0, 36_000) ?? 0) : null)],
    ["tut", (v) => oneOf(v, ["skip", "done", "before", "none"])], ["tutStep", (v) => int(v, 1, 9)],
  ],
  quit: [["score", (v) => int(v, 0, 1e8)]],
  error: [["msg", (v) => str(v, 200)], ["at", (v) => str(v, 120)], ["n", (v) => int(v, 1, 999)]],
};
const decode = (s: unknown) => { if (typeof s !== "string" || !s) return null; try { return decodeURIComponent(s); } catch { return s; } };

function clean(e: any, geo: Context["geo"] | undefined, preview: boolean) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return null;
  const kind = oneOf(e.kind, ["visit", "end", "quit", "error"]);
  if (!kind || typeof e.sid !== "string" || !ID.test(e.sid)) return null;
  const data: Record<string, unknown> = {};
  for (const [k, f] of DATA[kind]) { const v = f(e[k]); if (v !== null && v !== undefined) data[k] = v; }
  if (kind === "error" && !data.msg) return null;
  const play = kind === "end" || kind === "quit";
  return {
    kind, session_id: e.sid, player_id: typeof e.pid === "string" && ID.test(e.pid) ? e.pid : null,
    version: typeof e.ver === "string" && /^v\d{1,4}$/.test(e.ver) ? e.ver : "v?", test: e.test === true || preview,
    platform: oneOf(e.plat, ["pc", "touch"]), os: oneOf(e.os, OS) ?? "other", browser: oneOf(e.br, BR) ?? "other", lang: oneOf(e.lang, ["es", "en"]),
    game: play ? int(e.game, 1, 999) : null, round: play ? int(e.round, 1, 999) : null, secs: play ? int(e.secs, 0, 86_400) : null,
    cause: kind === "end" ? oneOf(e.cause, ["dead", "ship", "cargo"]) : null,
    country: str(geo?.country?.code, 2), region: str(decode(geo?.subdivision?.name) ?? geo?.subdivision?.code, 80), city: str(decode(geo?.city), 80),
    data,
  };
}

// ---- Supabase (server side only, secret key) ----
let DB: ReturnType<typeof createClient> | null = null;
function db() {
  const url = Netlify.env.get("SUPABASE_URL"), key = Netlify.env.get("SUPABASE_SECRET_KEY");
  if (!url || !key) return null;
  return (DB ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
}

const sha = (s: string) => createHash("sha256").update(s).digest();
const RANGES = ["today", "7d", "30d", "all"], PLATS = ["all", "pc", "touch"];

export default async (req: Request, context: Context) => {
  const path = new URL(req.url).pathname, ip = context.ip || "";
  try {
    if (path === "/api/m") {
      if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
      if (++bucket("m:", ip, 60_000).n > 30) return json({ error: "demasiadas peticiones" }, 429);
      const text = await req.text(); // sendBeacon sends text/plain, fetch application/json: both are JSON text
      if (text.length > MAX_BODY) return json({ error: "demasiado grande" }, 413);
      let body: any;
      try { body = JSON.parse(text); } catch { return json({ error: "datos no válidos" }, 400); }
      const list = Array.isArray(body?.e) ? body.e : [body];
      const preview = !!context.deploy?.context && context.deploy.context !== "production";
      const rows = list.slice(0, MAX_EVENTS).map((e: unknown) => clean(e, context.geo, preview)).filter(Boolean);
      if (!rows.length) return json({ error: "datos no válidos" }, 400);
      const sb = db();
      if (!sb) return json({ error: "métricas no configuradas" }, 503);
      const { error } = await sb.from("events").insert(rows);
      if (error) { console.error("metrics insert", error.message); return json({ error: "no se pudo guardar" }, 500); }
      return json(null, 204);
    }

    if (path === "/api/admin/stats") {
      if (req.method !== "GET") return json({ error: "método no permitido" }, 405);
      const pass = Netlify.env.get("ADMIN_PASSWORD");
      if (!pass) return json({ error: "admin no configurado" }, 503);
      const fails = bucket("a:", ip, 15 * 60_000); // 8 wrong passwords from one IP = 15 minutes out
      if (fails.n >= 8) return json({ error: "demasiados intentos, espera unos minutos" }, 429);
      const given = req.headers.get("x-admin-key") || "";
      if (!timingSafeEqual(sha(given), sha(pass))) { fails.n++; return json({ error: "contraseña incorrecta" }, 401); }
      const q = new URL(req.url).searchParams;
      const range = oneOf(q.get("range"), RANGES) ?? "7d", platform = oneOf(q.get("platform"), PLATS) ?? "all";
      const sb = db();
      if (!sb) return json({ error: "métricas no configuradas" }, 503);
      const { data, error } = await sb.rpc("metrics_stats", { p_range: range, p_platform: platform });
      if (error || !data || typeof data !== "object") { console.error("metrics stats", error?.message); return json({ error: "no se pudieron leer las métricas" }, 500); }
      return json({ range, platform, at: new Date().toISOString(), ...data });
    }
    return json({ error: "no encontrado" }, 404);
  } catch (err) {
    console.error("metrics error", err);
    return json({ error: "métricas no disponibles" }, 500);
  }
};

export const config: Config = {
  path: ["/api/m", "/api/admin/stats"],
  // Netlify's limit, across all instances (the Personal plan allows 2 rules per project: ranking.mts has the other one)
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
