import { expect, test } from "@playwright/test";
import { apiAs, login, signUpViaApi } from "./helpers";

test("a stranger who signs up gets no access (Google/email sign-in never grants a role)", async ({ page }) => {
  await signUpViaApi("stranger@bls.test");
  await login(page, "stranger@bls.test");
  await expect(page).toHaveURL(/\/no-access/);
  const api = await apiAs("stranger@bls.test");
  const { data: schools } = await api.from("schools").select("id");
  expect(schools).toEqual([]);
});

test("invited admin can sign in, but cannot change school settings", async ({ page }) => {
  const owner = await apiAs("owner@bls.test");
  const { data: ctx } = await owner.rpc("my_context");
  const { data: token, error } = await owner.rpc("create_invitation", {
    p_school: ctx.school_id, p_email: "admin@bls.test", p_role: "admin",
  });
  expect(error).toBeNull();
  await signUpViaApi("admin@bls.test", "Office Admin");
  await login(page, "admin@bls.test");
  await expect(page).toHaveURL(/\/no-access/);           // not linked until the invite is accepted
  await page.goto(`/invite/${token}`);
  await page.getByRole("button", { name: "গ্রহণ করে এগিয়ে যান" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "আরও" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "নোটিশ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "সেটিংস" })).toHaveCount(0); // hidden from menu
  await page.goto("/settings");
  await expect(page.getByText("শুধু সুপার অ্যাডমিন এই সেটিংস পরিবর্তন করতে পারেন।")).toBeVisible();

  // and the database refuses even if the UI is bypassed
  const admin = await apiAs("admin@bls.test");
  await admin.from("schools").update({ name_en: "Hacked" }).eq("id", ctx.school_id);
  const { data: s } = await owner.from("schools").select("name_en").single();
  expect(s?.name_en).toBe("Bright Learning School");

  // the token cannot be reused
  await page.goto(`/invite/${token}`);
  await page.getByRole("button", { name: "গ্রহণ করে এগিয়ে যান" }).click();
  await expect(page.getByText("আমন্ত্রণটি অবৈধ")).toBeVisible();
});

test("phone app: tab bar, More sheet, no horizontal overflow @mobile", async ({ page }) => {
  await login(page, "owner@bls.test");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("navigation").last().getByRole("link", { name: "ড্যাশবোর্ড" })).toBeVisible();
  await page.getByRole("button", { name: "আরও" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "সেটিংস" })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "সেটিংস" }).click();
  await expect(page).toHaveURL(/\/settings/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "e2e/screens/phone-dashboard.png", fullPage: true });
});
