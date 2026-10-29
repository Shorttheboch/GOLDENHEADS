// v61: interface art as real files (same keys as before).
// Absolute URLs, because some of them end up inside CSS variables, where a relative path would be read from the stylesheet's folder.
const u=p=>new URL(p,document.baseURI).href;
export default {
 "barra-carga-base": u("assets/ui/hud4/barra-carga-base.webp"),
 "barra-recurso-relleno": u("assets/ui/hud4/barra-recurso-relleno.webp"),
 "energia-base": u("assets/ui/hud4/energia-base.webp"),
 "energia-relleno": u("assets/ui/hud4/energia-relleno.webp"),
 "flecha-bodega": u("assets/ui/hud4/flecha-bodega.webp"),
 "flecha-rescate": u("assets/ui/hud4/flecha-rescate.webp"),
 "icono-bodega": u("assets/ui/hud4/icono-bodega.webp"),
 "icono-energia": u("assets/ui/hud4/icono-energia.webp"),
 "icono-fuga": u("assets/ui/hud4/icono-fuga.webp"),
 "marcador-rescate": u("assets/ui/hud4/marcador-rescate.webp"),
 "mira": u("assets/ui/hud4/mira.webp"),
 "mochila": u("assets/ui/hud4/mochila.webp"),
 "panel-mochila": u("assets/ui/hud4/panel-mochila.webp"),
 "panel-puntuacion": u("assets/ui/hud4/panel-puntuacion.webp"),
 "panel-traje-nave": u("assets/ui/hud4/panel-traje-nave.webp"),
 "temporizador-anillo": u("assets/ui/hud4/temporizador-anillo.webp"),
 "vida-relleno-segmentado": u("assets/ui/hud4/vida-relleno-segmentado.webp")
};
