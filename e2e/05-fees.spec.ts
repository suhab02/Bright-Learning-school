import { expect, test } from "@playwright/test";
import { apiAs, login, useLanguage } from "./helpers";

test.describe.serial("fees", () => {
  test("owner sets tuition per class and bills the month once", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    await page.goto("/fees/setup");
    const tuition = page.locator("form").filter({ has: page.getByText("Class One") }).first();
    await tuition.getByLabel("Class One").fill("1500");
    await tuition.getByLabel("KG").fill("1000");
    await tuition.getByRole("button", { name: "Save rates" }).click();
    await expect(page.getByText("Rates saved.")).toBeVisible();

    await page.goto("/fees");
    await page.getByRole("button", { name: "Bill this month" }).click();
    await expect(page.getByText(/^1 charges added$/)).toBeVisible();
    await page.getByRole("button", { name: "Bill this month" }).click();
    await expect(page.getByText(/already billed/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: /Ayesha Rahman/ })).toBeVisible();
    await expect(page.getByText("৳1,500").first()).toBeVisible();
  });

  test("cashier flow: ৳1,500 bKash payment needs a reference and reconciles everywhere", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    await page.goto("/fees");
    await page.getByRole("link", { name: /Ayesha Rahman/ }).click();
    await expect(page.locator("#amount")).toHaveValue("1500");
    await page.getByText("bKash", { exact: true }).click();
    await page.getByRole("button", { name: /Confirm payment/ }).click();
    await expect(page.getByText("Enter the transaction ID for this payment method.")).toBeVisible();
    await page.locator("#reference").fill("BK7Q2X9");
    await page.getByRole("button", { name: /Confirm payment/ }).click();

    await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}\?new=1/);
    await expect(page.getByText("Payment saved.")).toBeVisible();
    await expect(page.getByText(/BLS-\d{4}-000001/)).toBeVisible();
    await expect(page.getByText("bKash · BK7Q2X9")).toBeVisible();
    await expect(page.getByText("Reference recorded by staff — not verified with the provider")).toBeVisible();
    await expect(page.getByText("৳1,500").first()).toBeVisible();

    // everything agrees: ledger, balances, finance report, payments list
    const api = await apiAs("owner@bls.test");
    const { data: pays } = await api.from("payments").select("amount, method, status");
    expect(pays).toEqual([{ amount: 150000, method: "bkash", status: "confirmed" }]);
    const { data: bal } = await api.from("student_fee_balances").select("outstanding, paid");
    expect(bal!.every((b) => Number(b.outstanding) === 0)).toBe(true);
    const { data: ctx } = await api.rpc("my_context");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
    const { data: sum } = await api.rpc("finance_summary", { p_school: ctx.school_id, p_from: today, p_to: today });
    expect(Number(sum.collected_gross)).toBe(150000);
    expect(Number(sum.unverified_wallet_bank)).toBe(150000);
    await page.goto("/payments");
    await expect(page.getByText("bKash: ৳1,500")).toBeVisible();
  });

  test("owner reverses a mistaken payment; the due comes back and the receipt stays", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    await page.goto("/payments");
    await page.getByRole("link", { name: /Ayesha Rahman/ }).click();
    await page.getByRole("button", { name: "Reverse this payment" }).click();
    await page.getByLabel("Reason").fill("Wrong student selected");
    await page.getByRole("button", { name: "Reverse payment" }).click();
    await expect(page.getByText(/This payment was reversed/)).toBeVisible();
    const api = await apiAs("owner@bls.test");
    const { data: pays } = await api.from("payments").select("status");
    expect(pays).toEqual([{ status: "reversed" }]);
    const { data: bal } = await api.from("student_fee_balances").select("outstanding").gt("outstanding", 0);
    expect(Number(bal![0].outstanding)).toBe(150000);
  });

  test("one-time charge and a discount, then an overpayment becomes advance", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    await page.goto("/fees?q=ayesha");
    await page.getByRole("link", { name: /Ayesha Rahman/ }).click();
    await page.getByRole("button", { name: "Add a charge" }).click();
    await page.locator("#category").selectOption({ label: "Admission Fee" });
    await page.locator("#charge_amount").fill("2000");
    await page.getByRole("button", { name: "Add charge" }).click();
    await expect(page.getByText("Charge added.")).toBeVisible();
    await page.getByRole("button", { name: "Discount or waiver" }).last().click();
    await page.getByPlaceholder("৳", { exact: true }).fill("500");
    await page.getByPlaceholder("Reason").fill("Sibling discount");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Discount applied.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Discount ৳500")).toBeVisible();
    // due: 2,000 admission + 1,500 tuition - 500 discount = 3,000. Pay 3,200 cash.
    await expect(page.getByText("৳3,000").first()).toBeVisible();
    await page.locator("#amount").fill("3200");
    await page.getByRole("button", { name: /Confirm payment/ }).click();
    await expect(page.getByText("Kept as advance")).toBeVisible();
    await expect(page.getByText("৳200").first()).toBeVisible();
  });
});
