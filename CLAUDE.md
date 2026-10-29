# GOLDENHEADS — notas para Claude

Juego web **HEADS Rescate Dorado** de Santi: un astronauta dorado defiende su nave de arañas rojas. El juego es de Santi y solo usa el nombre y el logo de HEADS. Habla con Santi en español.

## Dónde está cada cosa
- `site/index.html`: el juego entero en un archivo (three.js por CDN, un `<script type="module">`).
- `site/assets/`: modelos, HUD, menú, sonidos y voces como `.js` (base64) y el vídeo `opening.mp4`.
- `netlify/functions/ranking.mts`: ranking online. El juego llama a `/api/run` y `/api/scores` con rutas relativas.
- Diseño, historial de versiones y decisiones: doc `claude/heads-juego-diseno-gameplay.md` del proyecto HEADS en claude.ai. Versión actual: **v58** publicada en la vista previa; v59–v60 en la rama `pendiente` (sin publicar).

## Cómo publicar
- Este repositorio es la versión buena. Las carpetas antiguas `F:\AI\HEADS\JUEGO\game` y `web` quedan como copia.
- Push a `main` = publicación en https://heads-rescate-dorado.netlify.app. Santi tiene el plan Personal de Netlify: 1.000 créditos al mes; cada publicación gasta 15 y cada GB servido 20.
- Trabaja en una rama. Cada rama o pull request tiene su vista previa gratis. Pasa a `main` solo cuando Santi lo apruebe.
- Para subir solo documentación sin publicar, pon `[skip netlify]` en el mensaje del commit.
- `RANK_SECRET` está solo en Production: las vistas previas no guardan partidas en el ranking.
- Firma los commits como `Shorttheboch <174453569+Shorttheboch@users.noreply.github.com>`. Netlify bloquea las publicaciones de autores que no reconoce (el correo personal de Santi está asociado en GitHub a otra cuenta).
- Ninguna clave en el repositorio. `RANK_SECRET` (y en el futuro las de Supabase) van en las variables de entorno de Netlify.

## Reglas del juego
- Los controles de PC no se cambian salvo que Santi lo pida.
- Todo lo táctil va detrás de `isTouch` (`pointer: coarse`).
- Todo texto en pantalla es texto real. Si añades uno, añade también su traducción al inglés en el bloque i18n.
- Cada versión lleva número (vNN) y un resumen en el doc de diseño.

## Antes de subir
- Comprobar la sintaxis: extraer el `<script type="module">` de `site/index.html` y pasar `node --check`.
- Jugar una partida en PC. Si tocas lo táctil, probar también en emulación móvil horizontal (844×390) con varios dedos.
- No reproducir audio en voz alta en el navegador de Santi.
