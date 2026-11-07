// v82: the Google login, with Supabase Auth. This file is its own small chunk: the game loads it only when it needs it
// (window.HEADS_AUTH, src/cuentas/loader.js), so the first load of the game does not grow. Used by src/game/40-cuentas.js.
// Only the auth part of supabase-js (@supabase/auth-js, the same version 2.118.0 that @supabase/supabase-js uses): about 25 KB gzipped
// instead of 59 KB for the whole client (database, storage, realtime), which the browser never uses. Configured exactly as createClient() does.
// The browser only signs in here; it never reads or writes the database: every run goes to the Worker (worker/ranking.ts),
// which checks the access token with Supabase Auth. URL and publishable key come at run time from /api/auth (nothing built into the page).
// PKCE redirect: signIn() sends the page to Google and back to redirectTo; on the way back, the client finds ?code= in the address
// (detectSessionInUrl), exchanges it for a session and keeps it in localStorage under "heads-auth".
import {AuthClient} from '@supabase/auth-js';

export const STORAGE_KEY = 'heads-auth';

export function makeAuth(url, key) {
  const auth = new AuthClient({
    url: String(url).replace(/\/+$/, '') + '/auth/v1', headers: {Authorization: `Bearer ${key}`, apikey: key},
    flowType: 'pkce', storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
  });
  const sb = {auth};
  return {
    // finished reading the address (the way back from Google) or the stored session: {error} if Google / Supabase said no
    init: () => sb.auth.initialize(),
    // the access token to send to the function (refreshed if it expired), or null when there is no session
    async token() {
      const {data} = await sb.auth.getSession();
      return data && data.session ? data.session.access_token : null;
    },
    // off to Google (the page goes away); redirectTo is built by the caller from location, never a fixed domain
    async signIn(redirectTo) {
      const {error} = await sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo, queryParams: {prompt: 'select_account'}}});
      if (error) throw error;
    },
    // forget the session on this device
    async signOut() {
      try { await sb.auth.signOut({scope: 'local'}); } catch (_) { /* the stored session is removed below anyway */ }
    },
  };
}
