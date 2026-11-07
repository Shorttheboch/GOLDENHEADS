// HEADS · Rescate Dorado — the Cloudflare Worker (v85). It replaces the two Netlify Functions (netlify/functions/ranking.mts and metrics.mts, v81-v84).
// wrangler.jsonc sends /api/* (and the two streamed media) here first (assets.run_worker_first); the game, its files and the pages are static assets served by Cloudflare
// itself from site/ (npm run build:cf), with site/_headers and site/_redirects. A path that is not an asset also ends here: it goes back to ASSETS (404).
//   /api/auth /api/run /api/scores /api/me /api/nick /api/save /api/forget /api/admin/ranking   -> ranking.ts (Google accounts and the Season 1 ranking)
//   /api/m /api/admin/stats                                                                      -> metrics.ts (anonymous metrics and the /admin totals)
//   any other /api/...                                                                           -> 404 {"error":"no encontrado"}
//   .../assets/opening.mp4, .../assets/music/*.mp3 (run_worker_first too)                       -> media.ts: the static file, cut to the
//                                                    Range asked (206), because Cloudflare's static assets ignore Range and iPhone Safari needs it
// What Netlify's `context` gave, here:
//   real site or preview   the host name: PROD_HOSTS (wrangler.jsonc) = the real site; workers.dev, preview URLs and anything else = a preview
//                          (runs and events saved as tests, the board of tests), like a Netlify Deploy Preview
//   the visitor's IP       CF-Connecting-IP (only for the limits, in memory)
//   country, region, city  request.cf (country, region or regionCode, city)
//   the platform's limit   the rate limit bindings RL_RANKING (40 a minute) and RL_METRICS (60 a minute) per IP and host, before the handler,
//                          like Netlify's rateLimit rule (429 {"error":"demasiadas peticiones"})
//   waitUntil              ctx.waitUntil
import { ranking, RANKING_PATHS } from "./ranking.ts";
import { metrics, METRICS_PATHS } from "./metrics.ts";
import { MEDIA, media } from "./media.ts";
import { isProd, rlKey } from "./lib.ts";
import type { Env } from "./lib.ts";

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url), path = url.pathname;
    const isRank = RANKING_PATHS.includes(path), isMet = !isRank && METRICS_PATHS.includes(path);
    if (!isRank && !isMet) {
      if (path === "/api" || path.startsWith("/api/")) return json({ error: "no encontrado" }, 404);
      if (env.ASSETS && MEDIA.test(path)) return media(request, env); // the film and the music: byte ranges (iPhone Safari)
      if (env.ASSETS) return env.ASSETS.fetch(request); // not an asset (the asset layer already looked): its 404
      return new Response("404 not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    const ip = request.headers.get("cf-connecting-ip") || "";
    const rl = isRank ? env.RL_RANKING : env.RL_METRICS;
    if (rl) {
      let okay = true;
      try { okay = (await rl.limit({ key: rlKey(url.hostname, ip) })).success; } catch (e) { console.error("rate limit binding", e); } // the binding failing never blocks a player
      if (!okay) return json({ error: "demasiadas peticiones" }, 429);
    }
    const cf: any = (request as any).cf || {};
    const c = {
      env, ip, preview: !isProd(url, env),
      geo: { country: cf.country ?? null, region: cf.region || cf.regionCode || null, city: cf.city ?? null },
      waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
    };
    return isRank ? ranking(request, c) : metrics(request, c);
  },
};
