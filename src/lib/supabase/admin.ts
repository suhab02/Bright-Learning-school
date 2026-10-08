import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Service-role client: BYPASSES RLS. Server-only (the "server-only" import makes any
 * client-side import a build error). Used ONLY for: first-owner bootstrap and reading
 * public branding for the PWA manifest. Never pass user input to it unchecked.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
