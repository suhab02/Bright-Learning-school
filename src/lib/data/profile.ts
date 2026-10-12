import "server-only";
import { cache } from "react";
import { supabaseServer } from "../supabase/server";

/** Deduplicate header/dashboard reads within this request; user RLS still applies. */
export const getProfileName = cache(async (userId: string, schoolId: string) => {
  const db = await supabaseServer();
  const { data: member, error: memberError } = await db.from("school_members")
    .select("display_name").eq("school_id", schoolId).eq("user_id", userId).maybeSingle();
  if (memberError) throw memberError;
  if (member?.display_name) return member.display_name as string;
  const { data, error } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.full_name as string | null | undefined;
});
