// HEADS · Rescate Dorado — the folder Cloudflare publishes (v85). `npm run build:cf` runs it after `vite build`.
//   node tools/cloudflare/make-site.mjs [--dist dist] [--out site]
// site/                  = the static assets of the Worker (wrangler.jsonc: assets.directory)
//   headsrescue/         = a copy of dist/ (the game, its files, admin.html, privacidad/, privacy/, sw.js, manifest.webmanifest)
//   _headers, _redirects = read by Cloudflare from the assets root, never served. They live only here, never in dist/,
//                          so what Netlify (or any server at the root) publishes from dist/ does not change.
//   headsrescue/assets/media.json = the sizes of the streamed media (opening.mp4, music/*.mp3), for worker/media.ts: Cloudflare's static
//                          assets ignore Range, so the Worker cuts those files itself, and it needs their size to do it streaming.
// The same dist/ works at the root (tests, npm run dev, Netlify until the move) and at /headsrescue/: every URL in the front end is relative,
// except the API, which stays at the root of the site (/api/..., the Worker: wrangler.jsonc run_worker_first).
// The header rules are those of netlify.toml up to v84, with the /headsrescue prefix.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const BASE = '/headsrescue';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const HEADERS = `# HEADS · Rescate Dorado on Cloudflare (v85): written by tools/cloudflare/make-site.mjs. The rules of netlify.toml (v84) under ${BASE}/.
# Built code has a fingerprint in its name (index-XXXX.js), so browsers can keep it for good.
${BASE}/js/*
  Cache-Control: public, max-age=31536000, immutable

# v75: the service worker and the manifest must never be kept for long, or a new version would not reach the phones.
${BASE}/sw.js
  Cache-Control: no-cache

${BASE}/manifest.webmanifest
  Cache-Control: no-cache
  Content-Type: application/manifest+json

# v81: Santi's statistics page (admin.html, served at ${BASE}/admin by html_handling). Never indexed, never cached, never in a frame.
${BASE}/admin
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-cache
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY

${BASE}/admin.html
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-cache
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
`;

// Paths are matched in order; the first rule that matches wins. /headsrescue (no slash), /headsrescue/index.html, /headsrescue/admin(.html)
// and /headsrescue/privacidad (no slash) are not here: wrangler.jsonc's html_handling ("auto-trailing-slash") does them.
export const REDIRECTS = `# HEADS · Rescate Dorado on Cloudflare (v85): written by tools/cloudflare/make-site.mjs.
# The root is for a landing page one day: for now it sends people to the game (302, temporary).
/  ${BASE}/  302
/index.html  ${BASE}/  302
# The game's pages used to live at the root (Netlify): same pages, new place (301, for good).
/privacidad  ${BASE}/privacidad/  301
/privacidad/*  ${BASE}/privacidad/:splat  301
/privacy  ${BASE}/privacy/  301
/privacy/*  ${BASE}/privacy/:splat  301
/admin  ${BASE}/admin  301
/admin/  ${BASE}/admin  301
/admin.html  ${BASE}/admin  301
`;

// the same files as MEDIA in worker/media.ts: assets/opening.mp4 and assets/music/*.mp3 (path inside assets/ -> bytes)
export function mediaSizes(assets) {
  const out = {}, add = rel => { const f = path.join(assets, rel); if (fs.existsSync(f)) out[rel] = fs.statSync(f).size; };
  add('opening.mp4');
  const mu = path.join(assets, 'music');
  if (fs.existsSync(mu)) for (const f of fs.readdirSync(mu).sort()) if (/^[A-Za-z0-9_-]+\.mp3$/.test(f)) add('music/' + f);
  return out;
}

export function makeSite({dist = path.join(ROOT, 'dist'), out = path.join(ROOT, 'site')} = {}) {
  dist = path.resolve(dist); out = path.resolve(out);
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no ${path.join(dist, 'index.html')}: run vite build first`);
  for (const f of ['_headers', '_redirects']) if (fs.existsSync(path.join(dist, f))) throw new Error(`${f} must never be in ${dist}`);
  fs.rmSync(out, {recursive: true, force: true});
  fs.mkdirSync(out, {recursive: true});
  fs.cpSync(dist, path.join(out, BASE.slice(1)), {recursive: true});
  fs.writeFileSync(path.join(out, '_headers'), HEADERS);
  fs.writeFileSync(path.join(out, '_redirects'), REDIRECTS);
  fs.writeFileSync(path.join(out, BASE.slice(1), 'assets/media.json'), JSON.stringify(mediaSizes(path.join(out, BASE.slice(1), 'assets')), null, 1) + '\n');
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const out = makeSite({dist: arg('--dist'), out: arg('--out')});
  let n = 0;
  const walk = d => { for (const e of fs.readdirSync(d, {withFileTypes: true})) e.isDirectory() ? walk(path.join(d, e.name)) : n++; };
  walk(out);
  console.log(`site ready: ${path.relative(ROOT, out) || out} (${n} files: ${BASE.slice(1)}/ + _headers + _redirects)`);
}
