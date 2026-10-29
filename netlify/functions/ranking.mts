// HEADS · Rescate Dorado — online ranking
// POST /api/run     -> signed token for a new run (the server notes when the run started)
// GET  /api/scores  -> top 10 + number of saved runs
// POST /api/scores  -> save a finished run {token, name, score, round, stats}; answers with rank + top 10
// Each run is its own blob (no read-modify-write); name, score and round live in the key so the
// board is built from a single listing without downloading every entry.
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const STORE = "ranking";
const TOP_N = 10;
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // a run token is valid for 4 hours
const BAD = /(puta|puto|mierda|polla|joder|cabron|maricon|zorra|nazi|hitler|fuck|shit|cunt|nigg|fagg|bitch)/i;

type Entry = { id: string; name: string; score: number; round: number; ts: number };

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

function sign(payload: string) {
  const secret = Netlify.env.get("RANK_SECRET");
  if (!secret) throw new Error("RANK_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function makeToken() {
  const payload = `${Date.now()}.${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(tok: unknown) {
  if (typeof tok !== "string" || tok.length > 200) return null;
  const parts = tok.split(".");
  if (parts.length !== 3) return null;
  const [t, id, sig] = parts;
  const a = Buffer.from(sig), b = Buffer.from(sign(`${t}.${id}`));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const start = Number(t);
  if (!Number.isFinite(start) || !/^[0-9a-f]{16}$/.test(id)) return null;
  return { start, id };
}

const keyOf = (e: Entry) => `s/${e.id}|${e.score}|${e.round}|${encodeURIComponent(e.name)}|${e.ts}`;

function parseKey(k: string): Entry | null {
  const p = k.slice(2).split("|");
  if (p.length !== 5) return null;
  const score = Number(p[1]), round = Number(p[2]), ts = Number(p[4]);
  if (!Number.isFinite(score) || !Number.isFinite(round)) return null;
  let name = p[3];
  try { name = decodeURIComponent(name); } catch { /* keep raw */ }
  return { id: p[0], score, round, name, ts };
}

const byRank = (a: Entry, b: Entry) => b.score - a.score || a.ts - b.ts;

async function allEntries(store: ReturnType<typeof getStore>) {
  const { blobs } = await store.list({ prefix: "s/" });
  const out: Entry[] = [];
  for (const b of blobs) { const e = parseKey(b.key); if (e) out.push(e); }
  return out.sort(byRank);
}

const pub = ({ id, name, score, round }: Entry) => ({ id, name, score, round });
const num = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : 0; };

function cleanName(raw: unknown) {
  let n = typeof raw === "string" ? raw : "";
  n = n.normalize("NFC").toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÜÑÇ .\-_]/g, "").replace(/\s+/g, " ").trim().slice(0, 12);
  if (!n || BAD.test(n.replace(/[\s.\-_]/g, ""))) n = "ASTRONAUTA";
  return n;
}

export default async (req: Request, context: Context) => {
  const path = new URL(req.url).pathname;
  try {
    if (path === "/api/run") {
      if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
      return json({ token: makeToken() });
    }

    if (req.method === "GET") {
      const list = await allEntries(getStore(STORE));
      return json({ top: list.slice(0, TOP_N).map(pub), count: list.length }, 200, {
        "netlify-cdn-cache-control": "public, durable, s-maxage=20, stale-while-revalidate=60",
      });
    }
    if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "datos no válidos" }, 400); }
    const tok = readToken(body?.token);
    if (!tok) return json({ error: "partida no válida" }, 400);
    const now = Date.now(), elapsed = (now - tok.start) / 1000;
    if (now - tok.start > MAX_AGE_MS) return json({ error: "la partida ha caducado" }, 400);

    const score = Math.round(Number(body.score)), round = Math.round(Number(body.round));
    const sane = Number.isFinite(score) && score >= 1 && score <= 10_000_000 && Number.isFinite(round) && round >= 1 && round <= 500;
    // plausibility: rounds take time, and points come at a bounded pace
    if (!sane || elapsed < 3 || round > 1 + elapsed / 12 || score > 3000 * round + 400 * elapsed)
      return json({ error: "puntuación no válida" }, 400);

    const store = getStore({ name: STORE, consistency: "strong" });
    const first = await store.set(`used/${tok.id}`, String(now), { onlyIfNew: true });
    if (!first.modified) return json({ error: "esta partida ya está guardada" }, 409);

    const entry: Entry = { id: tok.id, name: cleanName(body.name), score, round, ts: now };
    const s = body.stats && typeof body.stats === "object" ? body.stats : {};
    const stats = { kills: num(s.kills), heads: num(s.heads), acc: num(s.acc), saved: num(s.saved), repairs: num(s.repairs), secs: Math.round(elapsed) };
    await store.setJSON(keyOf(entry), { ...entry, stats });

    const list = await allEntries(store);
    if (!list.some((e) => e.id === entry.id)) { list.push(entry); list.sort(byRank); }
    const rank = list.findIndex((e) => e.id === entry.id) + 1;
    return json({ id: entry.id, name: entry.name, rank, count: list.length, top: list.slice(0, TOP_N).map(pub), me: pub(entry) });
  } catch (err) {
    console.error("ranking error", err);
    return json({ error: "ranking no disponible" }, 500);
  }
};

export const config: Config = {
  path: ["/api/run", "/api/scores"],
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
