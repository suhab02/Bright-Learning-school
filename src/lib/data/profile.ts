import "server-only";
import { cache } from "react";
import { supabaseServer } from "../supabase/server";

/** Deduplicate header/dashboard reads within this request; user RLS still applies. */
export const getProfileName = cache(async (userId: string) => {
  const db = await supabaseServer();
  const { data, error } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.full_name as string | null | undefined;
});
