// HEADS · Rescate Dorado — what the two API modules (ranking.ts, metrics.ts) share on Cloudflare Workers (v85).
// Imports carry their .ts extension so the same files run in Node 22+ (it strips the types itself: tools/tests/ranking-fn.cjs, metrics-fn.cjs)
// and in wrangler's bundle. Plain TypeScript only (types, interfaces): no enums, no namespaces.
import { createHash, randomBytes } from "node:crypto";

// The Worker's settings (dashboard: Workers & Pages > goldenheads > Settings > Variables and Secrets; wrangler.jsonc keeps them: keep_vars).
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  text (the publishable key is not secret: the browser gets it from /api/auth)
//   SUPABASE_SECRET_KEY, RANK_SECRET, ADMIN_PASSWORD  secrets
//   PROD_HOSTS  in wrangler.jsonc: the host names of the real site; any other host (workers.dev, preview URLs) is a preview
export interface Env {
  ASSETS?: { fetch(req: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  RANK_SECRET?: string;
  ADMIN_PASSWORD?: string;
  PROD_HOSTS?: string;
  RL_RANKING?: { limit(o: { key: string }): Promise<{ success: boolean }> };
  RL_METRICS?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

// Where the visitor is, from Cloudflare (request.cf): country code, region name, city. Never stored with the IP.
export interface Geo { country?: string | null; region?: string | null; city?: string | null }

// Everything a handler needs besides the request: what Netlify's `context` gave before (v84 and earlier).
export interface ApiCtx {
  env: Env;
  ip: string;          // CF-Connecting-IP (Netlify: context.ip); only used in memory, hashed with a random salt
  preview: boolean;    // not the real site (Netlify: context.deploy.context !== "production"): runs and events are saved as tests
  geo: Geo;            // request.cf (Netlify: context.geo)
  waitUntil: (p: Promise<unknown>) => void; // ctx.waitUntil (Netlify: context.waitUntil)
}

// ---- limits per IP, per isolate and in memory (the IP only hashed with a random salt, never stored) ----
// The salt is made on the first request: Workers do not allow random values at global scope.
let SALT: Buffer | null = null;
export const ipKey = (ip: string) => createHash("sha256").update((SALT ??= randomBytes(16))).update(ip || "?").digest("base64url").slice(0, 22);
// one table of counters per module (on Netlify each function had its own instance, so its own table: an admin lock-out in one did not lock the other)
export function buckets() {
  const HITS = new Map<string, { n: number; t: number }>();
  return function bucket(name: string, ip: string, windowMs: number) { // this IP's counter in this window
    const k = name + ipKey(ip), now = Date.now();
    if (HITS.size > 5000) for (const [key, v] of HITS) if (now - v.t > 3_600_000) HITS.delete(key);
    let h = HITS.get(k);
    if (!h || now - h.t > windowMs) { h = { n: 0, t: now }; HITS.set(k, h); }
    return h;
  };
}

// The real site or a preview: by the host name the request came to (PROD_HOSTS, comma separated, in wrangler.jsonc).
export function isProd(url: URL, env: Env) {
  const host = url.hostname.toLowerCase();
  return (env.PROD_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean).includes(host);
}

// The key for Cloudflare's rate limit binding: host + a plain hash of the IP (the binding's counters live a minute in Cloudflare, the IP never goes in).
export const rlKey = (host: string, ip: string) => host + "|" + createHash("sha256").update("heads-rl|" + (ip || "?")).digest("base64url").slice(0, 22);
