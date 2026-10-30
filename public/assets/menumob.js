// v70: phone start menu art as real files. panel = the whole panel without texts; bar = the long gold bar on top; the two *Glow files are the blue lights that flick on.
// Absolute URLs, because some of them end up inside CSS variables, where a relative path would be read from the stylesheet's folder.
const u=p=>new URL(p,document.baseURI).href;
export default {
 "panel": u("assets/ui/menumob/panel.webp"),
 "bar": u("assets/ui/menumob/bar.webp"),
 "logo": u("assets/ui/menumob/logo.webp"),
 "panelGlow": u("assets/ui/menumob/panel-glow.webp"),
 "barGlow": u("assets/ui/menumob/bar-glow.webp")
};
