// v61: interface art as real files (same keys as before).
// Absolute URLs, because some of them end up inside CSS variables, where a relative path would be read from the stylesheet's folder.
const u=p=>new URL(p,document.baseURI).href;
export default {
 "top": u("assets/ui/menuui/top.webp"),
 "mid": u("assets/ui/menuui/mid.webp"),
 "bot": u("assets/ui/menuui/bot.webp"),
 "logo": u("assets/ui/menuui/logo.webp"),
 "blue": u("assets/ui/menuui/blue.webp"),
 "gold": u("assets/ui/menuui/gold.webp"),
 "logoblue": u("assets/ui/menuui/logoblue.webp"),
 "f600": u("assets/ui/menuui/f600.woff2"),
 "f700": u("assets/ui/menuui/f700.woff2"),
 "f900": u("assets/ui/menuui/f900.woff2")
};
