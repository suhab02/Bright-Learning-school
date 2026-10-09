"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export type StudentFormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

const valuesOf = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;
const str = (max: number) => z.string().trim().max(max).optional().transform((v) => v || "");
const phone = z.string().trim().optional().transform((v) => (v ?? "").replace(/[\s-]/g, ""))
  .refine((v) => v === "" || BD_MOBILE.test(v.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))), "phone")
  .transform((v) => v.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
const date = z.string().trim().optional().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "date").transform((v) => v || "");

const schema = z.object({
  full_name_bn: str(150), full_name_en: str(150),
  date_of_birth: date, admission_date: date, admission_no: str(40),
  gender: z.enum(["", "male", "female", "other"]).optional().transform((v) => v || ""),
  blood_group: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().transform((v) => v || ""),
  section_id: z.string().uuid("class_required"),
  roll_no: z.string().trim().optional().transform((v) => (v ?? "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))))
    .refine((v) => v === "" || (/^\d{1,4}$/.test(v) && Number(v) > 0), "invalid_roll"),
  address: str(400),
  guardian_name: str(150), guardian_relationship: z.enum(["father", "mother", "legal_guardian", "other"]).default("father"),
  guardian_phone: phone, guardian_email: z.string().trim().optional().transform((v) => (v ?? "").toLowerCase())
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "email"),
  emergency_contact_name: str(150), emergency_contact_phone: phone,
  request_id: z.string().uuid().optional(),
});

function parse(fd: FormData) {
  const raw = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const r = schema.safeParse(raw);
  const noName = !String(raw.full_name_bn ?? "").trim() && !String(raw.full_name_en ?? "").trim();
  if (!r.success) {
    const fieldErrors: Record<string, string> = noName ? { full_name_bn: "name_required" } : {};
    for (const i of r.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors } as const;
  }
  if (!r.data.full_name_bn && !r.data.full_name_en) return { fieldErrors: { full_name_bn: "name_required" } } as const;
  return { data: r.data } as const;
}

/** Map a database error to a friendly code the form can translate. */
function dbError(message: string): NonNullable<StudentFormState> {
  const known = ["name_required", "class_required", "duplicate_roll", "duplicate_admission_no", "invalid_roll", "no_current_year", "reason_required"];
  const code = known.find((k) => message.includes(k));
  if (code) return { ok: false, error: code, fieldErrors: code === "duplicate_roll" || code === "invalid_roll" ? { roll_no: code }
    : code === "duplicate_admission_no" ? { admission_no: code } : code === "class_required" ? { section_id: code } : undefined };
  if (/permission/i.test(message)) return { ok: false, error: "permission" };
  console.error("[students] save failed:", message);
  return { ok: false, error: "save" };
}

export async function admitStudent(_: StudentFormState, fd: FormData): Promise<StudentFormState> {
  try { await requirePermission("students.create"); } catch { return { ok: false, error: "permission" }; }
  const p = parse(fd);
  if ("fieldErrors" in p) return { ok: false, fieldErrors: p.fieldErrors, values: valuesOf(fd) };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admit_student", { p: p.data });
  if (error) return { ...dbError(error.message), values: valuesOf(fd) };
  // optional photo, uploaded by the form before submitting
  const photo = String(fd.get("photo_path") ?? "");
  if (PHOTO_PATH.test(photo)) {
    const { error: pe } = await supabase.rpc("set_student_photo", { p_student: data, p_path: photo });
    if (pe) console.error("[students] photo link failed:", pe.message);
  }
  redirect(`/students/${data}?admitted=1`);
}

export async function updateStudent(id: string, _: StudentFormState, fd: FormData): Promise<StudentFormState> {
  try { await requirePermission("students.edit"); } catch { return { ok: false, error: "permission" }; }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "save" };
  const p = parse(fd);
  if ("fieldErrors" in p) return { ok: false, fieldErrors: p.fieldErrors, values: valuesOf(fd) };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("update_student", { p_id: id, p: p.data });
  if (error) return { ...dbError(error.message), values: valuesOf(fd) };
  redirect(`/students/${id}?saved=1`);
}

export async function setStudentStatus(id: string, _: StudentFormState, fd: FormData): Promise<StudentFormState> {
  try { await requirePermission("students.archive"); } catch { return { ok: false, error: "permission" }; }
  const status = String(fd.get("status") ?? "");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 300);
  if (!["active", "withdrawn", "transferred", "graduated"].includes(status)) return { ok: false, error: "save" };
  if (status !== "active" && reason.length < 3) return { ok: false, fieldErrors: { reason: "reason_required" } };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_student_status", { p_id: id, p_status: status, p_reason: reason || null });
  if (error) return dbError(error.message);
  refresh();
  return { ok: true };
}

const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;

/** Link a newly uploaded photo (or remove with null) and delete the previous file. */
export async function setStudentPhoto(studentId: string, path: string | null): Promise<StudentFormState> {
  try { await requirePermission("students.edit"); } catch { return { ok: false, error: "permission" }; }
  if (!z.string().uuid().safeParse(studentId).success) return { ok: false, error: "save" };
  if (path !== null && !PHOTO_PATH.test(path)) return { ok: false, error: "save" };
  const supabase = await supabaseServer();
  const { data: old, error } = await supabase.rpc("set_student_photo", { p_student: studentId, p_path: path });
  if (error) return dbError(error.message);
  if (old && old !== path) await supabase.storage.from("student-photos").remove([old as string]);
  refresh();
  return { ok: true };
}
