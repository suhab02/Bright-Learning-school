import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { apiAs, login, useLanguage, URL } from "./helpers";

// These cases create records only in the disposable local Supabase test stack.
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(URL), "Local test stack required");

test("owner opens every remaining school screen @mobile", async ({ page }) => {
  await useLanguage(page, "en");
  await login(page, "owner@bls.test");
  for (const [path, title] of [["classes", "Classes"], ["teachers", "Teachers"], ["staff", "Staff management"], ["guardians", "Guardians"], ["homework", "Homework"], ["notices", "Notices"], ["exams", "Examinations"], ["expenses", "Expenses"], ["reports", "Reports"]]) {
    await page.goto(`/${path}`);
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.getByText("Not built yet", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});

test("staff form saves a bilingual record and keeps it after reopening @mobile", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const name = `Teacher ${suffix}`;
  await useLanguage(page, "en");
  await login(page, "owner@bls.test");
  await page.goto("/teachers");
  await page.getByText("Add staff / teacher", { exact: true }).click();
  const form = page.locator("details").filter({ has: page.getByText("Add staff / teacher", { exact: true }) }).locator("form");
  await form.getByLabel("Name in English", { exact: true }).fill(name);
  await form.getByLabel("Name in Bangla", { exact: true }).fill(`শিক্ষক ${suffix}`);
  await form.getByLabel("Designation", { exact: true }).fill("Teacher");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const api = await apiAs("owner@bls.test");
  const { data, error } = await api.from("staff").select("id,full_name_bn").eq("full_name_en", name);
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  expect(data![0].full_name_bn).toBe(`শিক্ষক ${suffix}`);
  await useLanguage(page, "bn");
  await page.reload();
  await expect(page.getByRole("heading", { name: `শিক্ষক ${suffix}`, exact: true })).toBeVisible();
});
