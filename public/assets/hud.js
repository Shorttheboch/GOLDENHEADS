// v61: interface art as real files (same keys as before).
// Absolute URLs, because some of them end up inside CSS variables, where a relative path would be read from the stylesheet's folder.
const u=p=>new URL(p,document.baseURI).href;
export default {
 "base": u("assets/ui/hud/base.webp"),
 "segs": u("assets/ui/hud/segs.webp"),
 "z0": u("assets/ui/hud/z0.webp"),
 "z1": u("assets/ui/hud/z1.webp"),
 "z2": u("assets/ui/hud/z2.webp"),
 "z3": u("assets/ui/hud/z3.webp")
};
