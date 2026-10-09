import "server-only";
import { supabaseServer } from "../supabase/server";

/**
 * Student photos live in a PRIVATE bucket. Turn stored paths into short-lived links
 * (1 hour) — the storage rules decide who may get one. Missing/forbidden → no photo.
 */
export async function photoUrls(paths: (string | null | undefined)[], bucket: "student-photos" | "teacher-photos" = "student-photos"): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return {};
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(list, 3600);
    if (error || !data) return {};
    const out: Record<string, string> = {};
    for (const d of data) if (d.path && d.signedUrl && !d.error) out[d.path] = d.signedUrl;
    return out;
  } catch {
    return {};
  }
}
