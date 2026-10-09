"use client";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: ReturnType<typeof createBrowserClient> | undefined;
/** Browser client — runs as the signed-in user; every query is filtered by RLS. */
export function supabaseBrowser() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

let emailClient: ReturnType<typeof createClient> | undefined;
/**
 * Used ONLY to request sign-up confirmation and password-reset emails.
 * The default (PKCE) flow makes email links work only in the browser that asked for
 * them; this "implicit" flow puts a one-time session in the link itself, so the email
 * works on any phone or computer. /auth/complete turns it into a normal session.
 */
export function supabaseEmailLinks() {
  emailClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return emailClient;
}
