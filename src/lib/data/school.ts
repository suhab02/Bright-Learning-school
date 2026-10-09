import "server-only";
import { cache } from "react";
import { supabaseServer } from "../supabase/server";
import { DEFAULT_LOGO, logoPublicUrl } from "../school";

export type SchoolRow = {
  id: string; name_bn: string; name_en: string; slogan_bn: string | null; slogan_en: string | null;
  description: string | null; head_teacher_name: string | null; address_line: string | null;
  village_area: string | null; union_name: string | null; upazila: string | null; district: string | null;
  division: string | null; postal_code: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; website: string | null; maps_url: string | null; latitude: number | null;
  longitude: number | null; established_year: number | null; registration_no: string | null;
  logo_path: string | null; primary_color: string; theme: string; default_locale: "bn" | "en";
  use_bengali_digits: boolean; receipt_header: string | null; report_header: string | null;
  receipt_prefix: string; working_days: number[]; school_starts: string | null; school_ends: string | null;
  late_fee_enabled: boolean; late_fee_amount: number; late_fee_grace_days: number; default_due_day: number;
  updated_at: string;
};

/** The signed-in user's school (RLS: members only). One query per request. */
export const getSchool = cache(async (schoolId: string) => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("schools").select("*").eq("id", schoolId).single();
  if (error) throw error;
  const s = data as SchoolRow;
  return { ...s, logoUrl: logoPublicUrl(s.logo_path, s.updated_at) ?? DEFAULT_LOGO, customLogo: Boolean(s.logo_path) };
});

export function schoolName(s: Pick<SchoolRow, "name_bn" | "name_en">, locale: "bn" | "en") {
  return locale === "bn" ? s.name_bn : s.name_en;
}
export function schoolPlace(s: Pick<SchoolRow, "village_area" | "upazila" | "district">) {
  return [s.village_area, s.upazila, s.district].filter(Boolean).join(", ");
}
export const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
