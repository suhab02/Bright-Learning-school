import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:8000";
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const PASSWORD = "Test-password-123";

/** A user-scoped Supabase client, exactly like the browser would have. */
export async function apiAs(email: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

export async function signUpViaApi(email: string, name = email.split("@")[0]) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signUp({ email, password: PASSWORD, options: { data: { full_name: name } } });
  if (error && !/already/i.test(error.message)) throw error;
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function useLanguage(page: Page, lang: "bn" | "en") {
  await page.context().addCookies([{ name: "bls_locale", value: lang, url: "http://localhost:3000" }]);
}
