import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";

export type Role = "super_admin" | "admin" | "accountant" | "teacher" | "guardian";
export type AppContext = {
  userId: string;
  email: string | null;
  schoolId: string;
  role: Role;
  permissions: Set<string>;
  staffId: string | null;
  guardianId: string | null;
  teachesSections: string[];
};

type RawCtx = {
  user_id: string; member: null | undefined; school_id?: string; role?: Role; permissions?: string[];
  staff_id?: string | null; guardian_id?: string | null; teaches_sections?: string[];
};

/**
 * Secure first-owner bootstrap. Grants Super Admin ONLY when:
 *  - BOOTSTRAP_OWNER_EMAIL is set on the server,
 *  - the signed-in user's email matches it AND is verified by Supabase Auth,
 *  - the school has no Super Admin yet (enforced again inside the database).
 */
async function tryBootstrap(userId: string, email: string | null | undefined, verified: boolean) {
  const owner = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !email || !verified || email.toLowerCase() !== owner) return false;
  const admin = supabaseAdmin();
  const { data: schoolId } = await admin.rpc("school_needs_owner");
  if (!schoolId) return false;
  const { error } = await admin.rpc("bootstrap_owner", { p_user: userId, p_school: schoolId });
  return !error;
}

/** Reads the session once per request. Returns null when signed out. */
export const getContext = cache(async (): Promise<AppContext | "no-access" | null> => {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); // validated with Supabase, not just decoded
  if (!user) return null;

  let { data } = await supabase.rpc("my_context");
  let raw = data as RawCtx | null;
  if (!raw?.school_id) {
    const verified = Boolean(user.email_confirmed_at);
    if (await tryBootstrap(user.id, user.email, verified)) {
      ({ data } = await supabase.rpc("my_context"));
      raw = data as RawCtx | null;
    }
  }
  if (!raw?.school_id || !raw.role) return "no-access";
  return {
    userId: user.id,
    email: user.email ?? null,
    schoolId: raw.school_id,
    role: raw.role,
    permissions: new Set(raw.permissions ?? []),
    staffId: raw.staff_id ?? null,
    guardianId: raw.guardian_id ?? null,
    teachesSections: raw.teaches_sections ?? [],
  };
});

/** For pages: always returns a usable context or redirects. */
export async function requireContext(): Promise<AppContext> {
  const ctx = await getContext();
  if (ctx === null) redirect("/login");
  if (ctx === "no-access") redirect("/no-access");
  return ctx;
}

export function can(ctx: AppContext, perm: string) {
  return ctx.role === "super_admin" || ctx.permissions.has(perm);
}

/** For server actions: throws instead of redirecting. The database re-checks everything. */
export async function requirePermission(perm: string): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx || ctx === "no-access" || !can(ctx, perm)) throw new Error("permission_denied");
  return ctx;
}
