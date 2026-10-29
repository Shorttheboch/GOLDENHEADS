# GOLDENHEADS · HEADS Rescate Dorado

Juego web de Santi (astronauta dorado contra arañas rojas). Usa el nombre y el logo de HEADS.

## Estructura
- `site/index.html` — el juego (un solo archivo).
- `site/assets/` — modelos, sonidos, voces, interfaz y vídeo de apertura.
- `netlify/functions/ranking.mts` — ranking online (`/api/run`, `/api/scores`).
- `netlify.toml` — Netlify publica `site/` y las funciones; no hay paso de compilación.

## Publicar
- Push a `main` → se publica en https://heads-rescate-dorado.netlify.app (cuenta como despliegue de producción).
- Cualquier otra rama o pull request → vista previa con su propio enlace, sin tocar la web pública.
- Volver a una versión anterior: desde la lista de despliegues de Netlify.

## Secretos
- `RANK_SECRET` vive en las variables de entorno de Netlify. Ninguna clave va en este repositorio.
