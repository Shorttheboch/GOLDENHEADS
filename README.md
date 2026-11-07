# GOLDENHEADS · HEADS Rescate Dorado

Juego web de Santi (astronauta dorado contra arañas rojas). Usa el nombre y el logo de HEADS.

Se juega en **https://goldenheads2021.com/headsrescue/** (Cloudflare Workers, desde v85).

## Estructura
- `index.html` — la página: todos los textos y paneles del juego.
- `src/game/` — el código del juego, repartido por temas (`04-ship-hull.js`, `13-spiders.js`, `22-touch.js`…). Las piezas se juntan en orden de número y funcionan como un solo programa.
- `src/styles/` — el aspecto (CSS), también por partes.
- `public/i18n.js` — idioma (español / inglés) y menú de inicio de PC; se carga antes que el juego.
- `public/assets/` — archivos reales: `models/` (.glb), `sfx/` y `vo/es`, `vo/en` (.mp3), `ui/` (imágenes .webp y fuentes) y `opening.mp4`. Los `.js` de esa carpeta son solo listas de qué archivo es cada cosa.
- `worker/` — el servidor: un Worker de Cloudflare para `/api/*` (`index.ts` reparte; `ranking.ts`, cuentas de Google y ranking; `metrics.ts`, métricas anónimas y los totales de la página de estadísticas; `media.ts`, la película y la música por trozos). La base de datos está en Supabase (`supabase/`).
- `wrangler.jsonc` — la configuración del Worker y de los archivos estáticos (`site/`).
- `tools/cloudflare/make-site.mjs` — arma `site/`: `site/headsrescue/` (el juego compilado) y las reglas `_headers` y `_redirects`.
- `public/admin.html` — la página de estadísticas, en `/headsrescue/admin` (con contraseña).
- Todas las rutas del juego son relativas (funciona en la raíz y en `/headsrescue/`); solo la API va a la raíz del sitio: `/api/...`.
- `tools/` — traducciones (`tools/i18n/build_i18n.py`) y pruebas automáticas (`tools/tests/`).

## Trabajar en local
```
npm install        # una vez
npm run dev        # abre http://127.0.0.1:5173 y recarga sola al guardar
npm run build      # versión final en dist/
npm run build:cf   # dist/ + site/ (lo que publica Cloudflare)
```

## Publicar
- Cloudflare Workers Builds ejecuta `npm run build:cf` y `npx wrangler deploy` (archivos de `site/` + el Worker).
- Push a `main` → se publica en https://goldenheads2021.com/headsrescue/ (la raíz del dominio lleva ahí de momento).
- Cualquier otra rama → versión de prueba con su propio enlace en workers.dev (`npx wrangler versions upload`), sin tocar la web pública; guarda solo partidas y métricas de prueba.
- Volver a una versión anterior: desde la lista de despliegues del Worker en Cloudflare (Deployments → Rollback).
- La dirección antigua (heads-rescate-dorado.netlify.app) solo redirige a la nueva (`netlify.toml`).

## Secretos
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (texto) y `SUPABASE_SECRET_KEY`, `RANK_SECRET`, `ADMIN_PASSWORD` (secretos) viven en la configuración del Worker en Cloudflare (`keep_vars` en `wrangler.jsonc` evita que un despliegue las borre). Ninguna clave va en este repositorio.
