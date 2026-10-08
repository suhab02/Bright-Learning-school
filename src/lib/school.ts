import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { supabaseAdmin } from "./supabase/admin";
import { SUPABASE_URL } from "./supabase/env";

/** Public branding only (names, logo, colour). Safe to cache and show on the sign-in page. */
export type PublicBranding = {
  nameBn: string; nameEn: string; sloganBn: string | null; sloganEn: string | null;
  logoUrl: string | null; primaryColor: string; place: string;
};

export const BRANDING_TAG = "school-branding";

export function logoPublicUrl(path: string | null | undefined, version?: string) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/branding/${path}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}

export async function getPublicBranding(): Promise<PublicBranding | null> {
  "use cache";
  cacheTag(BRANDING_TAG);
  cacheLife("hours");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await supabaseAdmin()
    .from("schools")
    .select("name_bn,name_en,slogan_bn,slogan_en,logo_path,primary_color,village_area,upazila,district,updated_at")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    nameBn: data.name_bn, nameEn: data.name_en, sloganBn: data.slogan_bn, sloganEn: data.slogan_en,
    logoUrl: logoPublicUrl(data.logo_path, data.updated_at),
    primaryColor: data.primary_color,
    place: [data.village_area, data.upazila, data.district].filter(Boolean).join(", "),
  };
}
