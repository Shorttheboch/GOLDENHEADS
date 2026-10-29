# GOLDENHEADS · HEADS Rescate Dorado

Juego web de Santi (astronauta dorado contra arañas rojas). Usa el nombre y el logo de HEADS.

## Estructura
- `index.html` — la página: todos los textos y paneles del juego.
- `src/game/` — el código del juego, repartido por temas (`04-ship-hull.js`, `13-spiders.js`, `22-touch.js`…). Las piezas se juntan en orden de número y funcionan como un solo programa.
- `src/styles/` — el aspecto (CSS), también por partes.
- `public/i18n.js` — idioma (español / inglés) y menú de inicio de PC; se carga antes que el juego.
- `public/assets/` — archivos reales: `models/` (.glb), `sfx/` y `vo/es`, `vo/en` (.mp3), `ui/` (imágenes .webp y fuentes) y `opening.mp4`. Los `.js` de esa carpeta son solo listas de qué archivo es cada cosa.
- `netlify/functions/ranking.mts` — ranking online (`/api/run`, `/api/scores`).
- `tools/` — traducciones (`tools/i18n/build_i18n.py`) y pruebas automáticas (`tools/tests/`).

## Trabajar en local
```
npm install        # una vez
npm run dev        # abre http://127.0.0.1:5173 y recarga sola al guardar
npm run build      # versión final en dist/ (lo mismo que hace Netlify)
```

## Publicar
- Netlify ejecuta `npm run build` y publica la carpeta `dist/`.
- Push a `main` → se publica en https://heads-rescate-dorado.netlify.app (cuenta como despliegue de producción).
- Cualquier otra rama o pull request → vista previa con su propio enlace, sin tocar la web pública.
- Volver a una versión anterior: desde la lista de despliegues de Netlify.

## Secretos
- `RANK_SECRET` vive en las variables de entorno de Netlify. Ninguna clave va en este repositorio.
