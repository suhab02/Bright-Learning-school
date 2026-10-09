"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function setTeacherPhoto(staffId: string, path: string | null) {
  try {
    const ctx = await requirePermission("teachers.manage");
    z.uuid().parse(staffId);
    if (path && !new RegExp(`^${ctx.schoolId}/[0-9a-f-]{36}\\.jpg$`).test(path))
      return { ok: false as const };
    const db = await supabaseServer();
    const { data: old, error } = await db.rpc("set_staff_photo", { p_staff: staffId, p_path: path });
    if (error) return { ok: false as const };
    if (old && old !== path) await db.storage.from("teacher-photos").remove([String(old)]);
    const signed = path ? await db.storage.from("teacher-photos").createSignedUrl(path, 3600) : null;
    revalidatePath("/teachers");
    return { ok: true as const, url: signed?.data?.signedUrl ?? null };
  } catch {
    return { ok: false as const };
  }
}
