"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { can, getContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { STATUSES, validDate } from "@/lib/attendance/shared";

export type AttendanceState = { ok: boolean; error?: "invalid" | "permission" | "reason" | "conflict" | "save" } | null;
const schema = z.object({
  section: z.string().uuid(), date: z.string().refine(validDate),
  entries: z.array(z.object({
    student_id: z.string().uuid(), status: z.enum(STATUSES), note: z.string().trim().max(300),
    expected_marked_at: z.string().datetime({ offset: true }).nullable(),
  })).min(1).max(1000), reason: z.string().trim().max(300),
});
export async function saveAttendance(_: AttendanceState, fd: FormData): Promise<AttendanceState> {
  const ctx = await getContext();
  if (!ctx || ctx === "no-access" || ctx.role === "guardian") return { ok: false, error: "permission" };
  let entries: unknown;
  try { entries = JSON.parse(String(fd.get("entries"))); } catch { return { ok: false, error: "invalid" }; }
  const parsed = schema.safeParse({ section: fd.get("section"), date: fd.get("date"), reason: fd.get("reason") ?? "", entries });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const p = parsed.data;
  if (!can(ctx, "attendance.create") && !ctx.teachesSections.includes(p.section)) return { ok: false, error: "permission" };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("submit_attendance", {
    p_section: p.section, p_date: p.date, p_entries: p.entries.map((e) => ({ ...e, reason: p.reason })),
  });
  if (error) {
    if (error.message.includes("attendance_conflict")) return { ok: false, error: "conflict" };
    if (error.message.includes("reason_required")) return { ok: false, error: "reason" };
    if (error.code === "42501") return { ok: false, error: "permission" };
    if (error.code === "22023") return { ok: false, error: "invalid" };
    console.error("[attendance] save failed", error.message);
    return { ok: false, error: "save" };
  }
  revalidatePath("/attendance");
  revalidatePath("/portal/attendance");
  revalidatePath("/dashboard");
  return { ok: true };
}
