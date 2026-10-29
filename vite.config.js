// GOLDENHEADS · HEADS Rescate Dorado — build (Vite)
//
// The game code lives in src/game/*.js. Those files are pieces of ONE program: they share
// variables and functions with each other, exactly as when everything was in a single
// <script type="module">. The "heads-game" plugin below joins them in file-name order
// (00-imports.js, 01-config.js, …) into one module, so nothing about how the game runs changes.
// To add a new piece, create a file with the right number so it lands in the right place.
//
//   npm run dev         local server with reload on save
//   npm run build       production build in dist/ (what Netlify publishes)
//   npm run build:test  test build in dist-test/ (adds the hooks the automatic tests use)
import {defineConfig} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.join(ROOT, 'src/game');
const VIRTUAL = 'virtual:heads-game';
const RESOLVED = '\0' + VIRTUAL;

const gameFiles = () => fs.readdirSync(GAME_DIR).filter(f => /^\d\d-.*\.js$/.test(f)).sort();

// Test hooks: small text replacements that expose game internals to the Playwright tests.
// Only applied by `npm run build:test`; the real build never contains them.
function applyHooks(code, file) {
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/test-hooks.json'), 'utf8')).filter(h => h.file === file);
  for (const h of hooks) {
    const n = code.split(h.a).length - 1;
    if (n !== 1) throw new Error(`test hook anchor found ${n} times (expected 1): ${h.a.slice(0, 80)}`);
    code = code.replace(h.a, () => h.b);
  }
  return code;
}

// Line-level source map so errors point at src/game/NN-name.js and its line, not at the joined file.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(n) {
  let v = n < 0 ? (-n << 1) | 1 : n << 1, s = '';
  do { let d = v & 31; v >>>= 5; if (v) d |= 32; s += B64[d]; } while (v);
  return s;
}
function lineMap(parts) {
  const lines = [];
  let prevSrc = 0, prevLine = 0;
  parts.forEach((p, si) => {
    const n = p.code.split('\n').length - (p.code.endsWith('\n') ? 1 : 0);
    for (let l = 0; l < n; l++) {
      lines.push(vlq(0) + vlq(si - prevSrc) + vlq(l - prevLine) + vlq(0));
      prevSrc = si; prevLine = l;
    }
  });
  return {version: 3, sources: parts.map(p => p.file), sourcesContent: parts.map(p => p.code), names: [], mappings: lines.join(';')};
}

function headsGame(test) {
  return {
    name: 'heads-game',
    resolveId(id) { if (id === VIRTUAL) return RESOLVED; },
    load(id) {
      if (id !== RESOLVED) return;
      const parts = gameFiles().map(f => {
        const file = path.join(GAME_DIR, f);
        this.addWatchFile(file);
        return {file, code: fs.readFileSync(file, 'utf8')};
      });
      const code = parts.map(p => p.code).join('');
      if (test) return applyHooks(code, 'game');
      return {code, map: lineMap(parts)};
    },
    configureServer(server) {
      const reload = file => {
        if (path.dirname(file) !== GAME_DIR) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({type: 'full-reload'});
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
    // Test build: the language script gets its hook, the tests get the light ship model and a test.html.
    writeBundle(opts) {
      if (!test) return;
      const out = opts.dir;
      const i18n = path.join(out, 'i18n.js');
      fs.writeFileSync(i18n, applyHooks(fs.readFileSync(i18n, 'utf8'), 'i18n'));
      fs.copyFileSync(path.join(ROOT, 'tools/test-assets/ship_test.glb'), path.join(out, 'assets/models/ship_test.glb'));
      fs.copyFileSync(path.join(out, 'index.html'), path.join(out, 'test.html'));
    },
  };
}

export default defineConfig(({mode}) => {
  const test = mode === 'test';
  return {
    base: './',
    plugins: [headsGame(test)],
    server: {host: '127.0.0.1'},
    build: {
      outDir: test ? 'dist-test' : 'dist',
      emptyOutDir: true,
      assetsDir: 'js',          // built code goes to js/; public/assets/ (models, sounds, art) is copied as is
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 2000,
    },
  };
});
