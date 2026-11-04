// v82: the Google login (src/cuentas/sb.js + @supabase/supabase-js) is its own chunk. The game (src/game/40-cuentas.js) asks for it with
// window.HEADS_AUTH() only when it needs it: the end plate's button, the way back from Google, or a session kept on this device.
// Imported before the game, so it exists when the game starts. The tests may put their own window.HEADS_AUTH first (a fake Google).
window.HEADS_AUTH = window.HEADS_AUTH || (() => import('./sb.js'));
