import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PASSWORD } from "./helpers";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

test("password-reset email link works in a different browser and lets the owner back in", async ({ browser }) => {
  // The link is generated server-side (as the email would contain it) and opened in a
  // brand-new browser context that never requested it — like opening Gmail on a phone.
  const { data, error } = await admin().auth.admin.generateLink({
    type: "recovery", email: "owner@bls.test",
    options: { redirectTo: "http://localhost:3000/auth/complete?next=/auth/update-password" },
  });
  expect(error).toBeNull();
  const other = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await other.newPage();
  // the local test stack omits the /auth/v1 prefix that hosted Supabase links have
  const link = data!.properties!.action_link.replace(/^(http:\/\/localhost:8000)\/verify/, "$1/auth/v1/verify");
  await page.goto(link);
  await page.waitForURL((u) => u.pathname === "/auth/update-password", { timeout: 15000 });
  expect(page.url()).not.toContain("access_token"); // tokens removed from the address bar
  await page.locator("#password").fill("New-password-456");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

  // the new password works for a normal sign-in, the old one doesn't
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  expect((await c.auth.signInWithPassword({ email: "owner@bls.test", password: PASSWORD })).error).not.toBeNull();
  expect((await c.auth.signInWithPassword({ email: "owner@bls.test", password: "New-password-456" })).error).toBeNull();
  // put it back for other tests
  const { data: u } = await admin().auth.admin.listUsers();
  const owner = u.users.find((x) => x.email === "owner@bls.test")!;
  await admin().auth.admin.updateUserById(owner.id, { password: PASSWORD });
  await other.close();
});

test("an expired or used link explains what to do", async ({ page }) => {
  await page.goto("/auth/complete#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByText("ইমেইলের লিংকটির মেয়াদ শেষ")).toBeVisible();
  await expect(page.getByRole("button", { name: "নতুন রিসেট লিংক পাঠান" })).toBeVisible();
});

test("the reset form requests an email for any device and gives the same answer for unknown emails", async ({ page }) => {
  await page.goto("/reset-password");
  await page.locator("#email").fill("nobody@bls.test");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("রিসেট লিংক পাঠানো হয়েছে")).toBeVisible();
});
