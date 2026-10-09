import { expect, test } from "@playwright/test";
import { apiAs, login, signUpViaApi, useLanguage } from "./helpers";

const OWNER = "owner@bls.test";

test.describe.serial("owner journey", () => {
  test("signed-out visitors are sent to sign in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
    await expect(page.getByRole("heading", { name: "ব্রাইট লার্নিং স্কুল" })).toBeVisible();
  });

  test("first owner signs in and becomes Super Admin (bootstrap)", async ({ page }) => {
    await signUpViaApi(OWNER, "Suhabul Islam");
    await login(page, OWNER);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("banner").getByText("ব্রাইট লার্নিং স্কুল")).toBeVisible();
    await expect(page.getByRole("banner").locator("img[src='/brand/logo.png']")).toBeVisible();
    await expect(page.getByRole("main").getByText("Suhabul Islam")).toBeVisible();
    // empty production database → setup checklist, no fabricated numbers
    await expect(page.getByText("স্কুলের সেটআপ সম্পূর্ণ করুন")).toBeVisible();
    await expect(page.getByText("৳০").first()).toBeVisible();
  });

  test("language switch changes the interface, not the data", async ({ page }) => {
    await login(page, OWNER);
    await page.getByRole("button", { name: "প্রোফাইল" }).click();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("banner").getByText("Bright Learning School")).toBeVisible();
    await expect(page.getByText("Finish setting up your school")).toBeVisible();
    await page.getByRole("button", { name: "বাংলা" }).click();
    await expect(page.getByRole("banner").getByText("ব্রাইট লার্নিং স্কুল")).toBeVisible();
  });

  test("owner edits school details; invalid input is explained, valid input saves and is audited", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, OWNER);
    await page.goto("/settings");
    await page.locator("#phone").fill("not a phone");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();

    await page.locator("#phone").fill("01711-000000");
    await page.locator("#head_teacher_name").fill("Md. Abdul Karim");
    await page.locator("#name_en").fill("Bright Learning School, Mulagul");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();

    await page.reload();
    await expect(page.locator("#phone")).toHaveValue("01711-000000");
    await page.goto("/dashboard");
    await expect(page.getByRole("banner").getByText("Bright Learning School, Mulagul")).toBeVisible();

    const api = await apiAs(OWNER);
    const { data } = await api.from("audit_logs").select("action, after_data").eq("action", "settings.update");
    expect(data?.some((r) => r.after_data?.phone === "01711-000000")).toBe(true);

    // restore the name for other tests
    await page.goto("/settings");
    await page.locator("#name_en").fill("Bright Learning School");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();
  });
});
