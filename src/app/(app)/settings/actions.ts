"use server";
import { z } from "zod";
import { refresh, updateTag } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { BRANDING_TAG } from "@/lib/school";
import { parseTaka } from "@/lib/format";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> } | null;

const opt = (max = 200) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));
const optUrl = z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "url")
  .transform((v) => (v === "" ? null : v));
const optNum = (min: number, max: number) => z.string().trim()
  .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), "range")
  .transform((v) => (v === "" ? null : Number(v)));

const schema = z.object({
  name_bn: z.string().trim().min(2).max(150),
  name_en: z.string().trim().min(2).max(150),
  slogan_bn: opt(200), slogan_en: opt(200), description: opt(2000), head_teacher_name: opt(150),
  address_line: opt(300), village_area: opt(100), union_name: opt(100), upazila: opt(100),
  district: opt(100), division: opt(100), postal_code: opt(10),
  phone: z.string().trim().refine((v) => v === "" || /^\+?[0-9 -]{6,20}$/.test(v), "phone").transform((v) => v || null),
  whatsapp: z.string().trim().refine((v) => v === "" || /^\+?[0-9 -]{6,20}$/.test(v), "phone").transform((v) => v || null),
  email: z.string().trim().refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "email").transform((v) => v || null),
  website: optUrl, maps_url: optUrl,
  latitude: optNum(-90, 90), longitude: optNum(-180, 180), established_year: optNum(1800, 2200),
  registration_no: opt(100),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  default_locale: z.enum(["bn", "en"]),
  use_bengali_digits: z.boolean(),
  receipt_header: opt(300), report_header: opt(300),
  receipt_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,12}$/),
  working_days: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  school_starts: z.string().regex(/^\d{2}:\d{2}$/), school_ends: z.string().regex(/^\d{2}:\d{2}$/),
  default_due_day: z.coerce.number().int().min(1).max(28),
  late_fee_enabled: z.boolean(),
  late_fee_amount: z.string().transform((v, c) => {
    const p = parseTaka(v || "0");
    if (p === null) { c.addIssue({ code: "custom", message: "amount" }); return z.NEVER; }
    return Number(p);
  }),
  late_fee_grace_days: z.coerce.number().int().min(0).max(60),
});

export async function updateSchool(_: FormState, fd: FormData): Promise<FormState> {
  let ctx;
  try { ctx = await requirePermission("settings.manage"); } catch { return { ok: false, error: "permission" }; }

  const raw: Record<string, unknown> = Object.fromEntries(
    [...fd.entries()].filter(([k]) => k !== "working_days" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  raw.working_days = fd.getAll("working_days").map(String);
  raw.use_bengali_digits = fd.get("use_bengali_digits") === "on";
  raw.late_fee_enabled = fd.get("late_fee_enabled") === "on";

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, fieldErrors };
  }
  const v = parsed.data;
  if (v.school_ends <= v.school_starts) return { ok: false, fieldErrors: { school_ends: "range" } };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("schools").update(v).eq("id", ctx.schoolId).select("id");
  if (error) return { ok: false, error: "save" };
  if (!data?.length) return { ok: false, error: "permission" }; // RLS blocked it
  updateTag(BRANDING_TAG);
  refresh();
  return { ok: true };
}

/** Logo is uploaded from the browser straight to Storage (RLS checks settings.manage);
 *  this action then records the path. Pass null to remove. */
export async function setLogo(path: string | null): Promise<FormState> {
  let ctx;
  try { ctx = await requirePermission("settings.manage"); } catch { return { ok: false, error: "permission" }; }
  if (path !== null && !new RegExp(`^${ctx.schoolId}/logo-[0-9]+\\.(png|jpg|jpeg|webp|svg)$`).test(path)) {
    return { ok: false, error: "save" };
  }
  const supabase = await supabaseServer();
  const { data: old } = await supabase.from("schools").select("logo_path").eq("id", ctx.schoolId).single();
  const { error } = await supabase.from("schools").update({ logo_path: path }).eq("id", ctx.schoolId);
  if (error) return { ok: false, error: "save" };
  if (old?.logo_path && old.logo_path !== path) await supabase.storage.from("branding").remove([old.logo_path]);
  updateTag(BRANDING_TAG);
  refresh();
  return { ok: true };
}
