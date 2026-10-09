import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Server client acting AS THE USER (their cookies) — RLS applies. Use this for almost everything. */
export const supabaseServer = cache(async () => {
  await connection(); // request-time only: never prerender anything that touches user data
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component; the proxy refreshes the session instead
        }
      },
    },
  });
});
