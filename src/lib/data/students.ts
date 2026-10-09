import "server-only";
import { cache } from "react";
import { supabaseServer } from "../supabase/server";

export const PAGE_SIZE = 30;

export type SectionOption = { id: string; name: string; class_id: string; class_name_en: string; class_name_bn: string; sort: number };
export type DirectoryRow = {
  id: string; student_code: string; admission_no: string | null; full_name_en: string; full_name_bn: string | null;
  gender: string | null; date_of_birth: string | null; blood_group: string | null; status: string;
  admission_date: string; address: string | null; photo_path: string | null;
  roll_no: number | null; section_id: string | null; section_name: string | null; class_id: string | null;
  class_name_en: string | null; class_name_bn: string | null; class_order: number | null;
  guardian_id: string | null; guardian_name: string | null; guardian_phone: string | null; guardian_relationship: string | null;
};

/** Sections of active classes, in class order: "Class One — A" */
export const getSectionOptions = cache(async (schoolId: string): Promise<SectionOption[]> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("sections")
    .select("id, name, class_id, classes!inner(name_en, name_bn, sort_order, is_active)")
    .eq("school_id", schoolId).eq("is_active", true).eq("classes.is_active", true);
  if (error) throw error;
  type Row = { id: string; name: string; class_id: string; classes: { name_en: string; name_bn: string; sort_order: number } };
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({ id: r.id, name: r.name, class_id: r.class_id, class_name_en: r.classes.name_en,
      class_name_bn: r.classes.name_bn, sort: r.classes.sort_order }))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
});

/** Strip characters that have meaning in PostgREST filter syntax. */
function cleanSearch(q: string) {
  return q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export async function listStudents(opts: { q?: string; classId?: string; includeLeft?: boolean; page?: number }) {
  const supabase = await supabaseServer();
  const page = Math.max(1, opts.page ?? 1);
  let query = supabase.from("student_directory").select("*", { count: "exact" });
  if (!opts.includeLeft) query = query.in("status", ["active", "applicant"]);
  if (opts.classId) query = query.eq("class_id", opts.classId);
  const q = cleanSearch(opts.q ?? "");
  if (q) {
    const digits = q.replace(/[^0-9০-৯]/g, "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
    const ors = [`full_name_en.ilike.*${q}*`, `full_name_bn.ilike.*${q}*`, `student_code.ilike.*${q}*`, `admission_no.ilike.*${q}*`, `guardian_name.ilike.*${q}*`];
    if (digits.length >= 3) ors.push(`guardian_phone.ilike.*${digits}*`);
    if (digits && digits.length <= 3 && digits === q.replace(/\s/g, "")) ors.push(`roll_no.eq.${Number(digits)}`);
    query = query.or(ors.join(","));
  }
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("class_order", { ascending: true, nullsFirst: false })
    .order("roll_no", { ascending: true, nullsFirst: false })
    .order("full_name_en")
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as DirectoryRow[], total: count ?? 0, page, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) };
}

export type GuardianLink = { id: string; full_name: string; phone: string | null; email: string | null; relationship: string; is_primary: boolean };

export async function getStudent(id: string) {
  const supabase = await supabaseServer();
  const [{ data: row }, { data: extra }, { data: links }] = await Promise.all([
    supabase.from("student_directory").select("*").eq("id", id).maybeSingle(),
    supabase.from("students").select("emergency_contact_name, emergency_contact_phone").eq("id", id).maybeSingle(),
    supabase.from("student_guardians").select("relationship, is_primary, guardians(id, full_name, phone, email)").eq("student_id", id),
  ]);
  if (!row) return null; // not found OR not allowed (RLS) — the page shows 404 either way
  type L = { relationship: string; is_primary: boolean; guardians: { id: string; full_name: string; phone: string | null; email: string | null } };
  const guardians: GuardianLink[] = ((links ?? []) as unknown as L[]).filter((l) => l.guardians)
    .map((l) => ({ ...l.guardians, relationship: l.relationship, is_primary: l.is_primary }))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  return { ...(row as DirectoryRow), emergency_contact_name: extra?.emergency_contact_name ?? null,
    emergency_contact_phone: extra?.emergency_contact_phone ?? null, guardians };
}
export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudent>>>;

export function displayName(s: { full_name_en: string; full_name_bn: string | null }, locale: "bn" | "en") {
  return locale === "bn" ? s.full_name_bn || s.full_name_en : s.full_name_en || s.full_name_bn || "";
}
export function className(s: { class_name_en: string | null; class_name_bn: string | null; section_name?: string | null }, locale: "bn" | "en") {
  const c = locale === "bn" ? s.class_name_bn : s.class_name_en;
  if (!c) return "";
  return s.section_name ? `${c} (${s.section_name})` : c;
}
