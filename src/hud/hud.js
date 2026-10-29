// HEADS HUD v1 para móvil — diseño de Santi (claude/hud-movil-v1.html), todo por código (HTML/CSS/SVG), sin imágenes.
// Es el primer <script> de ese archivo, sin el bloque DEMO ni el fondo de la preview.
// Cambios para encajarlo en el juego (marcados con "v62"):
//  - la raíz se llama .hudm (el juego ya usa la clase .hud para su propio HUD) y queda por debajo del menú de pausa;
//  - las barras anulan dos reglas globales del juego (.bar inclinada con borde, .bar>i con altura 100 %);
//  - los números usan el separador de miles del idioma (1.000 / 1,000), como el resto del juego;
//  - weld({band:false}) oculta la franja dorada en las soldaduras cortas; enemies(n, texto) permite RESPIRO / CALMA;
//  - v63: el cartel RONDA n es más pequeño y está más arriba (27 % en vez de 34 %), para tapar menos el juego.
// Los textos en castellano los traduce el bloque i18n del juego (public/i18n.js) cuando se juega en inglés.
(function () {
  // Todo el HUD se dibuja en "unidades de diseño" sobre una pantalla de referencia
  // de 1844x853 (tu captura). --u escala eso a cualquier móvil en horizontal.
  const REF_W = 1844, REF_H = 853;
  const u = n => `calc(var(--u) * ${n})`;

  const CSS = `
.hudm{--u:min(calc(100vw / ${REF_W}), calc(100vh / ${REF_H}));
  position:fixed;inset:0;pointer-events:none;z-index:9;
  font-family:'Saira Condensed','Arial Narrow',system-ui,sans-serif;font-weight:700;color:#fff;line-height:1;
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;
  --st:env(safe-area-inset-top,0px);--sl:env(safe-area-inset-left,0px);
  --sr:env(safe-area-inset-right,0px);--sb:env(safe-area-inset-bottom,0px);
  --cream:#f4e2b8;--gold:#ffc93a;--cyan:#2fd8ff;--red:#ff4b3a;
  --triL:max(calc(50% - ${u(250)}), calc(var(--sl) + ${u(160 + 480 + 30)}))}
@supports (height:100dvh){.hudm{--u:min(calc(100vw / ${REF_W}), calc(100dvh / ${REF_H}))}}
.hudm *{box-sizing:border-box}
.hudm .probe{position:absolute;visibility:hidden;width:${u(1000)};height:1px}
.hudm .hp{position:absolute;isolation:isolate}
.hudm .hp>svg.fr{position:absolute;inset:0;width:100%;height:100%;z-index:-1;overflow:visible;pointer-events:none}
.hudm .lb{color:var(--cream);font-size:${u(30)};letter-spacing:${u(.6)};text-shadow:0 ${u(2)} 0 #000}
.hudm .num{display:inline-block;font-variant-numeric:tabular-nums;text-shadow:0 ${u(3)} 0 #000}
.hudm .bump{animation:hudBump .28s ease-out}

/* ---------- Pausa ---------- */
#hud-pause{left:calc(var(--sl) + ${u(33)});top:calc(var(--st) + ${u(33)});width:${u(100)};height:${u(97)};
  display:grid;place-items:center;pointer-events:auto;cursor:pointer;transition:transform .1s}
#hud-pause:active{transform:scale(.92)}
#hud-pause .ic{width:${u(38)};height:${u(44)}}

/* ---------- Traje / Nave ---------- */
#hud-stat{left:calc(var(--sl) + ${u(160)});top:calc(var(--st) + ${u(25)});width:${u(480)};height:${u(127)}}
#hud-stat .in{position:absolute;inset:${u(14)} ${u(26)} ${u(14)} ${u(20)};display:grid;
  grid-template-columns:${u(54)} ${u(100)} 1fr ${u(80)};grid-template-rows:1fr 1fr;align-items:center;column-gap:${u(8)}}
#hud-stat .in::after{content:'';position:absolute;left:${u(4)};right:${u(4)};top:50%;height:${u(2)};
  background:linear-gradient(90deg,transparent,rgba(201,146,46,.75) 12%,rgba(201,146,46,.75) 88%,transparent)}
#hud-stat .ic{width:100%;height:${u(44)}}
#hud-stat .pc{font-size:${u(30)};text-align:right}

.hudm .bar{position:relative;height:${u(26)};border-radius:${u(5)};background:#05080a;border:0;transform:none; /* v62: anula .bar del juego */
  box-shadow:0 0 0 ${u(2)} #7a5417,0 0 0 ${u(3.5)} #000,inset 0 ${u(2)} ${u(4)} rgba(0,0,0,.8)}
.hudm .bar>b,.hudm .bar>i{position:absolute;left:${u(3)};top:${u(3)};bottom:${u(3)};height:auto; /* v62: anula .bar>i del juego */
  width:calc((100% - ${u(6)}) * var(--v,1));border-radius:${u(3)}}
.hudm .bar>b{background:#fff;opacity:.7;transition:width .45s ease-in .3s}           /* rastro de daño */
.hudm .bar>i{background:var(--fill);transition:width .2s ease-out}
.hudm .bar>i::after{content:'';position:absolute;inset:0;border-radius:inherit;
  background:repeating-linear-gradient(90deg,transparent 0 ${u(13)},rgba(0,0,0,.55) ${u(13)} ${u(16)}),
             linear-gradient(180deg,rgba(255,255,255,.45),transparent 45%,rgba(0,0,0,.25))}
.hudm .bar.cyan{--fill:linear-gradient(180deg,#a8f5ff,#21c4f0 50%,#0b8cbd)}
.hudm .bar.yel {--fill:linear-gradient(180deg,#fff19a,#ffc916 50%,#cf8700)}
.hudm .bar.low {--fill:linear-gradient(180deg,#ffb4a8,#ff3b30 50%,#b5170e)}
.hudm .bar.low>i{animation:hudBlink .7s steps(2,jump-none) infinite}
.hudm .bar.hit{animation:hudHit .35s ease-out}

/* ---------- Tricomas ---------- */
#hud-tri{left:var(--triL);top:calc(var(--st) + ${u(8)});width:${u(500)};height:${u(112)}}
#hud-tri .in{position:absolute;inset:${u(15)} ${u(30)} ${u(17)};display:flex;flex-direction:column;justify-content:space-between}
#hud-tri .top{display:flex;align-items:center;justify-content:center;gap:${u(22)}}
#hud-tri .lb{font-size:${u(42)}}
#hud-tri .dv{width:${u(2)};height:${u(38)};background:linear-gradient(transparent,#a8741f,transparent)}
#hud-tri .num{font-size:${u(58)};font-weight:800;min-width:${u(130)};text-align:center}
.hudm .tbar{position:relative;height:${u(30)};border-radius:${u(7)};padding:${u(4)} ${u(5)};background:#070605;
  box-shadow:inset 0 0 0 ${u(2)} #b98321,0 0 0 ${u(1.5)} #000}
.hudm .tbar>i{display:block;height:100%;width:calc(100% * var(--v,0));border-radius:${u(3)};
  background:linear-gradient(180deg,#fff4ad,#ffcd1f 50%,#d08a00);transition:width .3s ease-out;
  -webkit-mask:repeating-linear-gradient(90deg,#000 0 ${u(22)},transparent ${u(22)} ${u(26)});
          mask:repeating-linear-gradient(90deg,#000 0 ${u(22)},transparent ${u(22)} ${u(26)})}
.hudm .tbar.full{animation:hudGlow 1s ease-in-out infinite}
.hudm .tbar.full>i{background:linear-gradient(90deg,#ffcd1f 0%,#fffbe0 50%,#ffcd1f 100%) 0 0/200% 100%;
  animation:hudShimmer 1.1s linear infinite}

/* ---------- Avisos ---------- */
#hud-alerts{position:absolute;left:var(--triL);width:${u(500)};top:calc(var(--st) + ${u(128)});display:flex;justify-content:safe center;gap:${u(14)}}
#hud-alerts .hp{position:relative;flex:none;height:${u(56)};padding:0 ${u(22)};display:flex;align-items:center;gap:${u(10)};
  font-size:${u(27)};white-space:nowrap;text-shadow:0 ${u(2)} 0 #000}
#hud-alerts .hp.off{display:none}
#hud-alerts .hp.pop{animation:hudPop .35s ease-out}
#hud-fuga{color:var(--red)}
#hud-fuga svg:not(.fr){width:${u(40)};height:${u(36)};animation:hudPulse .9s ease-in-out infinite}
#hud-fuga span{animation:hudAlarm .9s ease-in-out infinite}
#hud-resc{color:var(--gold)}
#hud-resc svg:not(.fr){width:${u(36)};height:${u(36)}}

/* ---------- Puntos ---------- */
#hud-score{right:calc(var(--sr) + ${u(32)});top:calc(var(--st) + ${u(25)});width:${u(404)};height:${u(182)}}
#hud-score .in{position:absolute;inset:${u(16)} ${u(20)} ${u(14)};display:grid;grid-template-rows:${u(64)} ${u(54)} 1fr;row-gap:${u(6)}}
#hud-score .top{display:flex;align-items:center;justify-content:center;gap:${u(34)}}
#hud-score .top .lb{font-size:${u(38)}}
#hud-score .top .num{font-size:${u(64)};font-weight:800;min-width:${u(120)}}
#hud-score .mid{display:grid;grid-template-columns:1fr 1.25fr;gap:${u(4)}}
#hud-score .mid>div{display:flex;align-items:center;justify-content:center;gap:${u(10)};font-size:${u(30)};color:var(--cream);
  border-radius:${u(3)};background:rgba(0,0,0,.35);box-shadow:inset 0 0 0 ${u(2)} #8d6420,inset 0 0 0 ${u(3.5)} #000;
  text-shadow:0 ${u(2)} 0 #000}
#hud-score .mid .num{color:#fff}
#hud-score .bot{display:flex;align-items:center;justify-content:center;gap:${u(12)};font-size:${u(25)};color:#a9a196}
#hud-score .bot .num{color:#fff}

/* ---------- Mira ---------- */
#hud-xh{position:absolute;left:50%;top:50%;width:${u(72)};height:${u(72)};transform:translate(-50%,-50%);
  color:#fff;transition:color .1s,transform .12s}
#hud-xh svg{width:100%;height:100%;display:block}
#hud-xh.target{color:var(--red);transform:translate(-50%,-50%) scale(.86)}
#hud-xh.assist{color:var(--gold)}
#hud-xh.hidden{opacity:0}

/* ---------- Soldadura ---------- */
#hud-weld{position:absolute;left:50%;top:calc(50% + ${u(50)});transform:translateX(-50%);display:flex;align-items:center;
  gap:${u(10)};padding:${u(12)} ${u(14)};opacity:0;transition:opacity .15s}
#hud-weld.on{opacity:1;pointer-events:auto}
#hud-weld svg{width:${u(22)};height:${u(34)};filter:drop-shadow(0 0 ${u(4)} var(--cyan))}
#hud-weld .wb{position:relative;width:${u(170)};height:${u(16)};border-radius:${u(8)};background:rgba(2,14,20,.8);
  box-shadow:0 0 0 ${u(2)} rgba(47,216,255,.9),0 0 ${u(10)} rgba(47,216,255,.45)}
#hud-weld .wb>i{position:absolute;left:${u(2)};top:${u(2)};bottom:${u(2)};width:calc((100% - ${u(4)}) * var(--p,0));
  border-radius:${u(6)};background:linear-gradient(180deg,#b9f6ff,#2fd8ff 55%,#0a9ccc)}
#hud-weld .wb>b{position:absolute;top:${u(-5)};bottom:${u(-5)};left:calc(100% * var(--s,.6));width:calc(100% * var(--w,.1));
  border-radius:${u(3)};background:rgba(255,201,58,.25);box-shadow:0 0 0 ${u(2)} var(--gold),0 0 ${u(12)} #ffb300}
#hud-weld.noband .wb>b{display:none} /* v62: soldaduras cortas, sin franja */
#hud-weld.paused .wb>i{background:#56636b}
#hud-weld.paused svg{filter:none;opacity:.35}
#hud-weld.perfect .wb{animation:hudPerfect .5s ease-out}
#hud-weld.miss .wb{animation:hudShake .3s}

/* ---------- Subtítulos ---------- */
#hud-sub{position:absolute;left:50%;bottom:calc(var(--sb) + ${u(28)});transform:translate(-50%,${u(12)});
  display:flex;align-items:center;gap:${u(16)};max-width:${u(1000)};padding:${u(11)} ${u(24)};border-radius:${u(14)};
  background:rgba(12,10,8,.7);box-shadow:inset 0 0 0 ${u(1.5)} rgba(242,182,50,.22);font-size:${u(28)};
  opacity:0;transition:opacity .2s,transform .2s}
#hud-sub.on{opacity:1;transform:translate(-50%,0)}
#hud-sub .who{color:var(--gold);font-weight:800;letter-spacing:${u(1)};white-space:nowrap}
#hud-sub .dv{width:${u(2)};align-self:stretch;background:rgba(244,226,184,.4)}
#hud-sub .tx{font-weight:600;line-height:1.15;text-wrap:balance}
#hud-sub.nowho .who,#hud-sub.nowho .dv{display:none}

/* ---------- Cartel de ronda ---------- */
#hud-round{position:absolute;left:50%;top:27%;transform:translate(-50%,-50%);text-align:center;opacity:0}
#hud-round .r1{font-size:${u(28)};color:var(--cream);letter-spacing:${u(8)};text-shadow:0 ${u(3)} 0 #000}
#hud-round .r2{font-size:${u(96)};font-weight:800;color:var(--gold);line-height:.9;
  text-shadow:0 0 ${u(30)} rgba(255,180,40,.6),0 ${u(5)} 0 #000}
#hud-round.show{animation:hudRound 2.6s ease-out forwards}

@keyframes hudBump{35%{transform:scale(1.25)}}
@keyframes hudHit{0%{filter:brightness(2.4)}100%{filter:brightness(1)}}
@keyframes hudBlink{50%{opacity:.35}}
@keyframes hudGlow{50%{box-shadow:inset 0 0 0 ${u(2)} #ffe27a,0 0 0 ${u(1.5)} #000,0 0 ${u(18)} rgba(255,200,40,.85)}}
@keyframes hudShimmer{to{background-position:-200% 0}}
@keyframes hudPulse{50%{transform:scale(1.15)}}
@keyframes hudAlarm{50%{text-shadow:0 0 ${u(14)} rgba(255,60,40,.95),0 ${u(2)} 0 #000}}
@keyframes hudPop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes hudRound{0%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}12%{opacity:1;transform:translate(-50%,-50%) scale(1)}
  80%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}
@keyframes hudPerfect{0%{box-shadow:0 0 0 ${u(3)} #fff,0 0 ${u(34)} var(--gold)}}
@keyframes hudShake{25%{transform:translateX(${u(-5)})}75%{transform:translateX(${u(5)})}}
`;

  // ---------- Iconos (SVG vectorial) ----------
  const GOLD_STOPS = `<stop offset="0" stop-color="#ffeaa8"/><stop offset=".5" stop-color="#d79a2c"/><stop offset="1" stop-color="#8a5a14"/>`;
  const I_PAUSE = `<svg class="ic" viewBox="0 0 38 44"><defs><linearGradient id="hudPg" x1="0" y1="0" x2="0" y2="1">${GOLD_STOPS}</linearGradient></defs>
    <rect x="2" y="2" width="12" height="40" rx="2" fill="url(#hudPg)" stroke="#000" stroke-width="2"/>
    <rect x="24" y="2" width="12" height="40" rx="2" fill="url(#hudPg)" stroke="#000" stroke-width="2"/></svg>`;
  const I_HELMET = `<svg class="ic" viewBox="0 0 48 48"><defs><linearGradient id="hudHg" x1="0" y1="0" x2="0" y2="1">${GOLD_STOPS}</linearGradient></defs>
    <path d="M24 3C13 3 6 11 6 22c0 8 3 15 9 20h18c6-5 9-12 9-20C42 11 35 3 24 3z" fill="url(#hudHg)" stroke="#000" stroke-width="1.6"/>
    <rect x="9.5" y="15" width="29" height="12" rx="6" fill="#0b0b0b"/>
    <path d="M16 30h16l-2.5 8h-11z" fill="#1c1c1c"/>
    <path d="M13 18.5c3-1.8 7-1.8 9 0" stroke="rgba(255,255,255,.4)" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
  const I_SHIP = `<svg class="ic" viewBox="0 0 64 44"><defs><linearGradient id="hudSg" x1="0" y1="0" x2="0" y2="1">${GOLD_STOPS}</linearGradient></defs>
    <g fill="url(#hudSg)" stroke="#000" stroke-width="1.6">
    <rect x="4" y="14" width="17" height="16" rx="6"/><rect x="43" y="14" width="17" height="16" rx="6"/>
    <path d="M21 22h22"/><ellipse cx="32" cy="22" rx="10" ry="19"/></g>
    <rect x="27.5" y="9" width="9" height="7" rx="2" fill="#111"/></svg>`;
  const I_WARN = `<svg viewBox="0 0 40 36"><path d="M20 2 38 34H2z" fill="#ff3b30" stroke="#4d0904" stroke-width="2" stroke-linejoin="round"/>
    <rect x="18" y="12" width="4" height="12" rx="1" fill="#fff"/><circle cx="20" cy="29" r="2.3" fill="#fff"/></svg>`;
  const I_DIAMOND = `<svg viewBox="0 0 40 40"><g transform="rotate(45 20 20)"><rect x="8" y="8" width="24" height="24" fill="none" stroke="#ffc93a" stroke-width="4"/>
    <rect x="16" y="16" width="8" height="8" fill="#ffc93a"/></g></svg>`;
  const I_BOLT = `<svg viewBox="0 0 22 34"><path d="M13 1 2 19h8l-3 14 13-20h-8z" fill="#2fd8ff"/></svg>`;
  const I_XHAIR = `<svg viewBox="0 0 72 72" fill="none" stroke-linecap="round">
    <g stroke="rgba(0,0,0,.5)" stroke-width="5"><circle cx="36" cy="36" r="28" stroke-dasharray="35.98 8" stroke-dashoffset="40"/>
    <path d="M36 2v12M36 58v12M2 36h12M58 36h12"/></g>
    <g stroke="currentColor" stroke-width="2.6"><circle cx="36" cy="36" r="28" stroke-dasharray="35.98 8" stroke-dashoffset="40"/>
    <path d="M36 2v12M36 58v12M2 36h12M58 36h12"/></g></svg>`;

  const TPL = `
<div class="probe"></div>
<div id="hud-pause" class="hp" data-frame data-c="16"><svg class="fr"></svg>${I_PAUSE}</div>

<div id="hud-stat" class="hp" data-frame data-c="20" data-gems><svg class="fr"></svg>
  <div class="in">
    ${I_HELMET}<span class="lb">TRAJE</span><div class="bar cyan" id="hud-suit"><b></b><i></i></div><span class="num pc" id="hud-suit-pc">100%</span>
    ${I_SHIP}<span class="lb">NAVE</span><div class="bar yel" id="hud-ship"><b></b><i></i></div><span class="num pc" id="hud-ship-pc">100%</span>
  </div></div>

<div id="hud-tri" class="hp" data-frame data-c="22" data-gems><svg class="fr"></svg>
  <div class="in">
    <div class="top"><span class="lb">TRICOMAS</span><span class="dv"></span><span class="num" id="hud-tri-n">0</span></div>
    <div class="tbar" id="hud-tri-bar"><i></i></div>
  </div></div>

<div id="hud-alerts">
  <div id="hud-fuga" class="hp off" data-frame data-c="14"><svg class="fr"></svg>${I_WARN}<span id="hud-fuga-t"></span></div>
  <div id="hud-resc" class="hp off" data-frame data-c="14"><svg class="fr"></svg>${I_DIAMOND}<span id="hud-resc-t"></span></div>
</div>

<div id="hud-score" class="hp" data-frame data-c="22" data-gems><svg class="fr"></svg>
  <div class="in">
    <div class="top"><span class="lb">PUNTOS</span><span class="num" id="hud-pts">0</span></div>
    <div class="mid"><div><span>RONDA</span><span class="num" id="hud-rnd">1</span></div>
      <div><span class="num" id="hud-en">0</span><span id="hud-en-l">ENEMIGOS</span></div></div>
    <div class="bot"><span>BAJAS</span><span class="num" id="hud-kills">0</span></div>
  </div></div>

<div id="hud-xh">${I_XHAIR}</div>
<div id="hud-weld">${I_BOLT}<div class="wb"><i></i><b></b></div></div>
<div id="hud-sub"><span class="who"></span><span class="dv"></span><span class="tx"></span></div>
<div id="hud-round"><div class="r1">RONDA</div><div class="r2">1</div></div>`;

  // ---------- Marco dorado (se redibuja al tamaño exacto de cada panel) ----------
  let fid = 0, probe = null;
  const unit = () => (probe && probe.offsetWidth / 1000) || 1;

  function drawFrame(el) {
    const svg = el.querySelector(':scope > svg.fr');
    const w = el.clientWidth, h = el.clientHeight;
    if (!svg || !w || !h) return;
    const s = unit();
    const c = (+el.dataset.c || 18) * s;                      // tamaño del chaflán
    const id = svg.dataset.id || (svg.dataset.id = 'hudF' + (fid++));
    // octógono a "i" px hacia dentro, con chaflanes paralelos
    const P = i => { const k = Math.max(c - i * 0.4142, 1);
      return [[i+k,i],[w-i-k,i],[w-i,i+k],[w-i,h-i-k],[w-i-k,h-i],[i+k,h-i],[i,h-i-k],[i,i+k]]
        .map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '); };
    const a = 1.5*s, b = 3.6*s, d = 6.5*s;

    let gems = '';
    if (el.hasAttribute('data-gems')) {
      const k = c - b * 0.4142, m = b + k / 2, L = Math.max(k * 0.55, 4*s), T = 3.2*s;
      const g = (x, y, r) => `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${r})">
        <rect x="${-L/2-1.5*s}" y="${-T/2-1.5*s}" width="${L+3*s}" height="${T+3*s}" rx="${s}" fill="#4fe3ff" opacity=".35"/>
        <rect x="${-L/2}" y="${-T/2}" width="${L}" height="${T}" rx="${s*.6}" fill="#6cecff" stroke="#003847" stroke-width="${(.8*s).toFixed(2)}"/></g>`;
      gems = g(m, m, -45) + g(w - m, m, 45) + g(w - m, h - m, -45) + g(m, h - m, 45);
    }

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = `<defs>
      <linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">
        <stop offset="0" stop-color="#ffe08a"/><stop offset=".13" stop-color="#c48a26"/><stop offset=".5" stop-color="#8b5812"/>
        <stop offset=".87" stop-color="#c48a26"/><stop offset="1" stop-color="#f5cf6e"/></linearGradient>
      <linearGradient id="${id}h" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".28" stop-color="#fff" stop-opacity=".35"/>
        <stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".76" stop-color="#fff" stop-opacity=".22"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#161513"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient>
    </defs>
    <polygon points="${P(0)}" fill="#050403"/>
    <polygon points="${P(a)}" fill="url(#${id}g)"/>
    <polygon points="${P(a)}" fill="url(#${id}h)"/>
    <polygon points="${P(b)}" fill="none" stroke="#ffe7a0" stroke-width="${(1.1*s).toFixed(2)}" opacity=".9"/>
    <polygon points="${P(d)}" fill="url(#${id}i)" stroke="#000" stroke-width="${(1.2*s).toFixed(2)}"/>
    <polygon points="${P(d + 1.4*s)}" fill="none" stroke="rgba(255,200,110,.16)" stroke-width="${s.toFixed(2)}"/>
    ${gems}`;
  }

  // ---------- Helpers ----------
  const root = document.createElement('div');
  root.className = 'hudm'; // v62: .hud ya lo usa el juego
  root.innerHTML = TPL;
  const q = id => root.querySelector('#' + id);
  const listeners = {};
  const emit = (e, d) => (listeners[e] || []).forEach(f => f(d));
  const retrig = (el, c) => { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };
  // v62: miles con punto en castellano y con coma en inglés, también con 4 cifras (1.000), como el resto del juego
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, window.I18N && window.I18N.lang === 'en' ? ',' : '.');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setNum(el, v, tween = false) {
    const from = +el.dataset.v || 0;
    if (from === v && el.textContent !== '') return;
    el.dataset.v = v;
    if (v > from) retrig(el, 'bump');
    if (!tween) { el.textContent = fmt(v); return; }
    cancelAnimationFrame(el._raf);
    const t0 = performance.now(), dur = 380;
    const step = t => { const k = Math.min((t - t0) / dur, 1);
      el.textContent = fmt(from + (v - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) el._raf = requestAnimationFrame(step); };
    el._raf = requestAnimationFrame(step);
  }

  function setPct(bar, pc, v) {
    v = clamp(v, 0, 100);
    const prev = bar._v ?? 100;
    if (Math.abs(prev - v) < 0.05 && bar._v !== undefined) return;
    bar._v = v;
    bar.style.setProperty('--v', v / 100);
    pc.textContent = Math.round(v) + '%';
    bar.classList.toggle('low', v <= 25);
    const now = performance.now();
    if (prev - v >= 1.5 && now - (bar._hitT || 0) > 350) { bar._hitT = now; retrig(bar, 'hit'); }
  }

  let subTimer = 0, weldState = { p: 0, s: .6, w: .1 };

  // ---------- API pública ----------
  const HUD = {
    mount(parent = document.body) {
      if (!document.getElementById('hud-css')) {
        const st = document.createElement('style'); st.id = 'hud-css'; st.textContent = CSS;
        document.head.appendChild(st);
      }
      parent.appendChild(root);
      probe = root.querySelector('.probe');
      const ro = new ResizeObserver(es => es.forEach(e => drawFrame(e.target)));
      root.querySelectorAll('[data-frame]').forEach(el => { ro.observe(el); drawFrame(el); });
      window.addEventListener('resize', () => root.querySelectorAll('[data-frame]').forEach(drawFrame));
      q('hud-pause').addEventListener('pointerdown', e => { e.preventDefault(); emit('pause'); });
      q('hud-weld').addEventListener('pointerdown', e => {
        e.preventDefault();
        const { p, s, w } = weldState;
        emit('weldTap', { progress: p, inSweet: p >= s && p <= s + w });
      });
      return HUD;
    },
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return HUD; },
    show(v = true) { root.style.display = v ? '' : 'none'; return HUD; },

    suit(pct) { setPct(q('hud-suit'), q('hud-suit-pc'), pct); return HUD; },          // 0–100
    ship(pct) { setPct(q('hud-ship'), q('hud-ship-pc'), pct); return HUD; },          // 0–100
    tricomas(count, fill = 0) {                                                        // fill 0–1
      setNum(q('hud-tri-n'), count);
      const bar = q('hud-tri-bar'); fill = clamp(fill, 0, 1);
      bar.style.setProperty('--v', fill);
      bar.classList.toggle('full', fill >= 1);
      return HUD;
    },
    leaks(n) {
      const el = q('hud-fuga'), was = !el.classList.contains('off');
      q('hud-fuga-t').textContent = n + (n === 1 ? ' FUGA' : ' FUGAS');
      el.classList.toggle('off', n <= 0);
      if (n > 0 && !was) retrig(el, 'pop');
      return HUD;
    },
    rescue(n) {
      const el = q('hud-resc'), was = !el.classList.contains('off');
      q('hud-resc-t').textContent = n + ' POR RESCATAR';
      el.classList.toggle('off', n <= 0);
      if (n > 0 && !was) retrig(el, 'pop');
      return HUD;
    },
    score(n)   { setNum(q('hud-pts'), n, true); return HUD; },
    // v62: el segundo argumento opcional cambia la palabra (p. ej. "s · RESPIRO" con los segundos que quedan)
    enemies(n, label) { setNum(q('hud-en'), n); q('hud-en-l').textContent = label || (n === 1 ? 'ENEMIGO' : 'ENEMIGOS'); return HUD; },
    kills(n)   { setNum(q('hud-kills'), n); return HUD; },
    round(n, banner = true) {
      setNum(q('hud-rnd'), n);
      if (banner) { q('hud-round').querySelector('.r2').textContent = n; retrig(q('hud-round'), 'show'); }
      return HUD;
    },
    crosshair(state = '') { q('hud-xh').className = state; return HUD; },               // '', 'target', 'assist', 'hidden'
    weld(o) {                                                                           // false = ocultar
      const el = q('hud-weld');
      if (!o) { el.classList.remove('on'); return HUD; }
      weldState = { p: clamp(o.progress ?? 0, 0, 1), s: o.sweet ?? weldState.s, w: o.width ?? weldState.w };
      el.classList.add('on');
      el.classList.toggle('paused', !!o.paused);
      el.classList.toggle('noband', o.band === false);                                  // v62
      el.style.setProperty('--p', weldState.p);
      el.style.setProperty('--s', weldState.s);
      el.style.setProperty('--w', weldState.w);
      return HUD;
    },
    weldResult(r) { retrig(q('hud-weld'), r === 'perfect' ? 'perfect' : 'miss'); return HUD; },
    say(who, text, ms = 3500) {
      const el = q('hud-sub');
      el.querySelector('.who').textContent = who || '';
      el.querySelector('.tx').textContent = text;
      el.classList.toggle('nowho', !who);
      el.classList.add('on');
      clearTimeout(subTimer);
      if (ms > 0) subTimer = setTimeout(() => el.classList.remove('on'), ms);
      return HUD;
    },
    hideSay() { clearTimeout(subTimer); q('hud-sub').classList.remove('on'); return HUD; },
  };

  window.HUD = HUD;
})();
