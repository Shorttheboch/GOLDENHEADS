// v61: interface art as real files (same keys as before).
// Absolute URLs, because some of them end up inside CSS variables, where a relative path would be read from the stylesheet's folder.
const u=p=>new URL(p,document.baseURI).href;
export default {
 "frame": u("assets/ui/endui/frame.webp"),
 "button": u("assets/ui/endui/button.webp"),
 "font": u("assets/ui/endui/font.woff2")
};
