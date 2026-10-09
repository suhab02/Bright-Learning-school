"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function removeSchoolRecord(table: string, id: string, reason: string) {
  try {
    const ctx = await requireContext();
    if (!["admin", "super_admin"].includes(ctx.role)) return { ok: false, error: "permission" };
    z.uuid().parse(id);
    const note = z.string().trim().min(3).max(300).parse(reason);
    const db = await supabaseServer();
    const { error } = await db.rpc("admin_remove_record", { p_school: ctx.schoolId, p_table: table, p_id: id, p_reason: note });
    if (error) return { ok: false, error: error.message.includes("record_in_use") ? "linked" : error.message.includes("history_protected") ? "history" : "save" };
    revalidatePath("/", "layout");
    return { ok: true, error: "" };
  } catch { return { ok: false, error: "save" }; }
}
