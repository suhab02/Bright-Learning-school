import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { apiAs, login, useLanguage } from "./helpers";

test.describe.serial("attendance", () => {
  let section: string;
  let today: string;
  const names = ["Attendance Student One", "Attendance Student Two"];
  test.beforeAll(async () => {
    const api = await apiAs("owner@bls.test");
    const { data: ctx, error: ce } = await api.rpc("my_context");
    expect(ce).toBeNull();
    const suffix = randomUUID().slice(0, 8);
    const { data: cls, error: classError } = await api.from("classes").insert({ school_id: ctx.school_id,
      name_en: `Attendance Test ${suffix}`, name_bn: `হাজিরা পরীক্ষা ${suffix}` }).select("id").single();
    expect(classError).toBeNull();
    const { data: sec, error: sectionError } = await api.from("sections").insert({ school_id: ctx.school_id,
      class_id: cls!.id, name: "A" }).select("id").single();
    expect(sectionError).toBeNull();
    section = sec!.id;
    for (const name of names) {
      const { error } = await api.rpc("admit_student", { p: { full_name_en: name, section_id: section } });
      expect(error).toBeNull();
    }
    const { data: date, error } = await api.rpc("local_today", { p_school: ctx.school_id });
    expect(error).toBeNull();
    today = date;
  });

  test("save and reopen a phone register; notes and statuses persist @mobile", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    await page.goto(`/attendance?section=${section}&date=${today}`);
    await expect(page.getByRole("button", { name: "Save attendance", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Mark all present" }).click();
    await page.getByRole("group", { name: `Attendance: ${names[1]}`, exact: true }).getByLabel("Absent", { exact: true }).check();
    await page.getByRole("textbox", { name: "Note (optional)" }).nth(1).fill("Guardian informed school");
    await page.getByRole("button", { name: "Save attendance", exact: true }).click();
    await expect(page.getByText("Attendance saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("group", { name: `Attendance: ${names[1]}`, exact: true }).getByLabel("Absent", { exact: true })).toBeChecked();
    await expect(page.getByRole("textbox", { name: "Note (optional)" }).nth(1)).toHaveValue("Guardian informed school");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("past register requires a reason before saving", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    const yesterday = new Date(`${today}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await page.goto(`/attendance?section=${section}&date=${yesterday.toISOString().slice(0, 10)}`);
    await page.getByRole("button", { name: "Mark all present" }).click();
    await expect(page.getByRole("button", { name: "Save attendance", exact: true })).toBeDisabled();
    await page.getByLabel("Reason for past attendance", { exact: true }).fill("Transcribed office register");
    await page.getByRole("button", { name: "Save attendance", exact: true }).click();
    await expect(page.getByText("Attendance saved", { exact: true })).toBeVisible();
  });

  test("Bangla register and invalid dates @mobile", async ({ page }) => {
    await useLanguage(page, "bn");
    await login(page, "owner@bls.test");
    await page.goto(`/attendance?section=${section}&date=${today}`);
    await expect(page.getByRole("button", { name: "হাজিরা সংরক্ষণ করুন" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "উপস্থিত", exact: true }).first()).toBeVisible();
    await page.goto(`/attendance?section=${section}&date=2026-02-30`);
    await expect(page.getByText("শ্রেণি, তারিখ ও হাজিরার তথ্য যাচাই করুন।")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
  });
});
