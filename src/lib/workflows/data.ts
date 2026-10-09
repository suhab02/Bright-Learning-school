import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type Row = Record<string, unknown>;
export const str = (r: Row, key: string) => String(r[key] ?? "");
export const num = (r: Row, key: string) => Number(r[key] ?? 0);
export const named = (r: Row, locale: "bn" | "en") =>
  str(r, locale === "bn" ? "name_bn" : "name_en") ||
  str(r, "name_en") ||
  str(r, "full_name") ||
  str(r, locale === "bn" ? "full_name_bn" : "full_name_en") ||
  str(r, "full_name_en") || str(r, "name");
export async function schoolRows(
  table: string,
  schoolId: string,
  order = "id",
  ascending = true,
) {
  const db = await supabaseServer();
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("school_id", schoolId)
    .order(order, { ascending })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Row[];
}
export async function relatedRows(table: string, key: string, ids: string[]) {
  if (!ids.length) return [];
  const db = await supabaseServer();
  const { data, error } = await db
    .from(table)
    .select("*")
    .in(key, ids)
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as Row[];
}
