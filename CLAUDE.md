# GOLDENHEADS — notas para Claude

Juego web **HEADS Rescate Dorado** de Santi: un astronauta dorado defiende su nave de arañas rojas. El juego es de Santi y solo usa el nombre y el logo de HEADS. Habla con Santi en español.

## Dónde está cada cosa
Desde v61 el proyecto se compila con Vite (`npm run build` → `dist/`; Netlify hace lo mismo).
- `index.html`: el marcado de la página.
- `src/game/NN-nombre.js`: el código del juego en piezas (35 desde v68). Comparten un solo ámbito: el plugin `heads-game` de `vite.config.js` las concatena por orden de nombre, igual que el antiguo `<script type="module">` único. No uses `import`/`export` entre piezas; una pieza nueva va con el número que le toque.
- `src/styles/NN-*.css`: el CSS en el orden de cascada original (los importa `src/main.js`).
- `src/hud/hud.js`: HUD de móvil de Santi (v62, todo por código, `window.HUD`); lo conecta `src/game/32-hud-movil.js` y solo se monta en táctil.
- `public/i18n.js`: script clásico que corre antes del juego (bloque i18n ES/EN, selector de idioma y menú de PC). three.js viene de npm (versión fija 0.170.0).
- `public/menusfx.js` (v70): `window.menuSfx(nombre)`, ruidos mecánicos de los menús de PC y móvil (`logo`, `land`, `bar`, `unfold`, `lock`, `button`). Seis mp3 en `public/assets/sfx/menu/`, sintetizados con `tools/menu-sfx/synth_menu_sfx.py`. Suenan flojos (master 0.35), solo después de un gesto del usuario (si no, se saltan) y se cierran al pulsar JUGAR. Prueba: `tools/run-test.sh dist tools/tests/menu-sfx.cjs` (con la compilación real: la de prueba se salta el selector de idioma).
- `public/assets/`: archivos reales (`models/*.glb`, `sfx/`, `vo/es`, `vo/en`, `ui/<kit>/`, `opening.mp4`). Los `.js` de esa carpeta son listas con las mismas claves de antes; las de `ui/` dan URL absolutas porque algunas acaban en variables CSS.
- `netlify/functions/ranking.mts`: ranking online. El juego llama a `/api/run` y `/api/scores` con rutas relativas.
- Diseño, historial de versiones y decisiones: doc `claude/heads-juego-diseno-gameplay.md` del proyecto HEADS en claude.ai. Versión publicada: **v65** (30-10, incluye v63–v64). En la rama `v66-tutorial-movil`: **v66**, tutorial en partida para móvil (`src/game/33-tutorial-movil.js`, `src/styles/07-tutorial-movil.css`), **v67**, Incineradora más fácil y más viva. **v68**, más información en PC (`src/game/34-pistas-pc.js`). **v69**, la Incineradora nada y se agarra a las rocas. **v70**, nuevo inicio en el móvil y ruidos de menú.

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
- Todo texto en pantalla es texto real. Si añades uno, añade su inglés en `tools/i18n/build_i18n.py` y ejecútalo (reescribe el bloque i18n de `public/i18n.js`).
- Cada versión lleva número (vNN) y un resumen en el doc de diseño.

## Antes de subir
- `npm run build` sin errores (comprueba la sintaxis del juego y de `public/i18n.js`).
- Pruebas automáticas: `npm run build:test` y `tools/run-test.sh dist-test tools/tests/<prueba>.cjs` (`pc-game`, `touch`, `phone-menu`, `phone-hud`, `phone-clean`, `phone-balance`, `phone-tutorial`, `incinerator`, `pc-hud`, `pc-info`, `assets`, `ios-audio`; `menu-sfx` con la compilación real, ver arriba). Las pruebas no ven el tutorial salvo que pongan `window.__noTut=0`; con la compilación real, `tools/run-test.sh dist tools/tests/pc-menu-real.cjs`. Los ganchos de prueba están en `tools/test-hooks.json`: si cambias el código que usan como ancla, la compilación de prueba avisa.
- Jugar una partida en PC. Si tocas lo táctil, probar también en emulación móvil horizontal (844×390) con varios dedos.
- No reproducir audio en voz alta en el navegador de Santi.
