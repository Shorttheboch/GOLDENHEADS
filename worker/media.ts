// HEADS · Rescate Dorado — byte ranges for the files the browser streams (v85): the opening film (<video>, assets/opening.mp4) and the
// music (<audio> for the game, assets/music/game.mp3; the menu music lives in the same folder).
// Cloudflare's static assets answer a Range request with the whole file (200; checked with wrangler dev 4.151), and Safari on iPhone / iPad
// plays <video> and <audio> only from a server that answers ranges with 206 (Netlify did). So these paths go through the Worker
// (wrangler.jsonc: assets.run_worker_first) and the Worker cuts the asset's answer to the range asked.
// The asset's answer carries no Content-Length the Worker can read, so the sizes come from assets/media.json, written next to the files by
// tools/cloudflare/make-site.mjs in the same build: the cut is streamed (nothing held in memory). Without that file (or for a file not in
// it) the Worker reads the file whole and cuts it (works, uses memory). Everything else (models, sounds fetched whole, art, pages) stays a
// plain static asset: free, no Worker request. One range per request (what browsers send for media); several ranges get the whole file.
import type { Env } from "./lib.ts";

// the paths, under any folder (the game is at /headsrescue/, but nothing here depends on it)
export const MEDIA = /\/assets\/(opening\.mp4|music\/[A-Za-z0-9_-]+\.mp3)$/;

// sizes per assets folder, read once per isolate (only the values are kept: never a promise shared between requests)
const SIZES = new Map<string, Record<string, number>>();
async function sizeOf(env: Env, url: URL): Promise<number | null> {
  const i = url.pathname.lastIndexOf("/assets/"), dir = url.origin + url.pathname.slice(0, i + 8), rel = url.pathname.slice(i + 8);
  let m = SIZES.get(dir);
  if (!m) {
    try {
      const r = await env.ASSETS!.fetch(new Request(dir + "media.json"));
      const j = r.ok ? await r.json() : null;
      if (j && typeof j === "object") { m = j as Record<string, number>; SIZES.set(dir, m); }
    } catch { /* no sizes: read whole */ }
  }
  const n = m ? m[rel] : null;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null;
}

function cut(start: number, end: number) { // a stream that lets through bytes start..end (inclusive) of what it is given
  let pos = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      const a = pos, b = pos + chunk.byteLength; pos = b;
      if (b <= start) return;
      if (a > end) { ctrl.terminate(); return; }
      ctrl.enqueue(chunk.subarray(Math.max(0, start - a), Math.min(chunk.byteLength, end - a + 1)));
      if (b > end) ctrl.terminate();
    },
  });
}

// "bytes=a-b" -> [start, end] inside a file of `size` bytes; "whole" for anything else (several ranges, nonsense); null = unsatisfiable
export function span(range: string, size: number): [number, number] | "whole" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "whole";
  let start: number, end: number;
  if (m[1] === "") { if (Number(m[2]) === 0) return null; start = Math.max(0, size - Number(m[2])); end = size - 1; } // the last N bytes
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(size - 1, Number(m[2])); }
  return start <= end && start < size ? [start, end] : null;
}

// the film or the music: the static asset, cut to the Range asked
export async function media(req: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS!.fetch(req);
  const h = new Headers(res.headers);
  h.set("accept-ranges", "bytes");
  const range = req.headers.get("range");
  if (res.status !== 200 || !res.body || !range || req.method !== "GET" || res.headers.get("content-encoding"))
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  const size = await sizeOf(env, new URL(req.url));
  if (size === null) { // no size known: read it whole (a few MB) and cut
    const all = new Uint8Array(await res.arrayBuffer()), sp = span(range, all.byteLength);
    if (sp === "whole") return new Response(all, { status: 200, headers: h });
    h.delete("content-length");
    if (!sp) { h.set("content-range", `bytes */${all.byteLength}`); return new Response(null, { status: 416, headers: h }); }
    h.set("content-range", `bytes ${sp[0]}-${sp[1]}/${all.byteLength}`);
    return new Response(all.subarray(sp[0], sp[1] + 1), { status: 206, headers: h });
  }
  const sp = span(range, size);
  if (sp === "whole") return new Response(res.body, { status: 200, headers: h });
  if (!sp) {
    res.body.cancel().catch(() => {});
    h.set("content-range", `bytes */${size}`); h.delete("content-length");
    return new Response(null, { status: 416, headers: h });
  }
  const [start, end] = sp;
  h.set("content-range", `bytes ${start}-${end}/${size}`);
  h.set("content-length", String(end - start + 1));
  let body = res.body.pipeThrough(cut(start, end));
  const FLS = (globalThis as any).FixedLengthStream; // workerd: the answer carries its Content-Length (not chunked)
  if (FLS) body = body.pipeThrough(new FLS(end - start + 1));
  return new Response(body, { status: 206, headers: h });
}
