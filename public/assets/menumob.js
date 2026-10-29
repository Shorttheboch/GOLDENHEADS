// v61: interface art as real files (same keys as before).
// Absolute URLs, because some of them end up inside CSS variables, where a relative path would be read from the stylesheet's folder.
const u=p=>new URL(p,document.baseURI).href;
export default {
 "mission": u("assets/ui/menumob/mission.webp"),
 "controls": u("assets/ui/menumob/controls.webp"),
 "logo": u("assets/ui/menumob/logo.webp")
};
