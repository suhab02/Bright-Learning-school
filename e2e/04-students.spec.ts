import { expect, test } from "@playwright/test";
import { apiAs, login, useLanguage } from "./helpers";

test.describe.serial("students", () => {
  test("owner admits a student; roll number is given automatically", async ({ page }) => {
    await login(page, "owner@bls.test");
    await page.goto("/students");
    await expect(page.getByText("এখনো কোনো শিক্ষার্থী নেই")).toBeVisible();
    await page.getByRole("link", { name: "শিক্ষার্থী ভর্তি" }).first().click();
    await expect(page).toHaveURL(/\/students\/new/);

    // validation: no name, no class
    await page.getByRole("button", { name: "ভর্তি করুন" }).click();
    await expect(page.getByText("শিক্ষার্থীর নাম বাংলা বা ইংরেজিতে লিখুন।")).toBeVisible();

    await page.locator("#full_name_bn").fill("আয়েশা রহমান");
    await page.locator("#full_name_en").fill("Ayesha Rahman");
    await page.locator("#gender").selectOption("female");
    await page.locator("#section_id").selectOption({ label: "প্রথম শ্রেণি — A" });
    await page.locator("#guardian_name").fill("Karim Rahman");
    await page.locator("#guardian_phone").fill("01711-123456");
    await page.getByRole("button", { name: "ভর্তি করুন" }).click();

    await expect(page).toHaveURL(/\/students\/[0-9a-f-]{36}\?admitted=1/);
    await expect(page.getByText("শিক্ষার্থী ভর্তি হয়েছে।")).toBeVisible();
    await expect(page.getByRole("heading", { name: "আয়েশা রহমান" })).toBeVisible();
    await expect(page.getByText("রোল নম্বর ১")).toBeVisible();
    await expect(page.getByRole("link", { name: /কল করুন Karim Rahman/ })).toHaveAttribute("href", "tel:01711123456");
  });

  test("a sibling with the same guardian phone is linked to the same guardian", async ({ page }) => {
    await login(page, "owner@bls.test");
    await page.goto("/students/new");
    await page.locator("#full_name_en").fill("Rafi Rahman");
    await page.locator("#section_id").selectOption({ label: "কেজি — A" });
    await page.locator("#guardian_name").fill("Karim");
    await page.locator("#guardian_phone").fill("+8801711123456");
    await page.getByRole("button", { name: "ভর্তি করুন" }).click();
    await expect(page).toHaveURL(/admitted=1/);
    const api = await apiAs("owner@bls.test");
    const { data } = await api.from("guardians").select("id, phone").eq("phone", "01711123456");
    expect(data).toHaveLength(1);
    const { data: kids } = await api.from("student_guardians").select("student_id").eq("guardian_id", data![0].id);
    expect(kids).toHaveLength(2);
  });

  test("search by name, roll or phone; filter by class", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    await page.goto("/students");
    await expect(page.getByText("2 students")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search students" }).fill("ayesha");
    await expect(page.getByRole("link", { name: /Ayesha Rahman/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Rafi Rahman/ })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search students" }).fill("123456");
    await expect(page.getByRole("link", { name: /Rafi Rahman/ })).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("link", { name: "KG", exact: true }).click();
    await expect(page.getByRole("link", { name: /Rafi Rahman/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ayesha Rahman/ })).toHaveCount(0);
  });

  test("edit moves class, duplicate roll is explained, mark as left needs a reason", async ({ page }) => {
    await useLanguage(page, "en");
    await login(page, "owner@bls.test");
    await page.goto("/students?q=rafi");
    await page.getByRole("link", { name: /Rafi Rahman/ }).click();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.locator("#section_id").selectOption({ label: "Class One — A" });
    await page.locator("#roll_no").fill("1");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("This roll number is already taken in this class.")).toBeVisible();
    await page.locator("#roll_no").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();
    await expect(page.getByText("Class One (A)")).toBeVisible();
    await expect(page.getByText("Roll number 2")).toBeVisible();

    await page.getByRole("button", { name: "Mark as left school" }).click();
    await page.getByRole("button", { name: "Mark as left" }).click();
    await expect(page.getByText("Write a short reason.")).toBeVisible();
    await page.locator("#reason").fill("Family moved to Dhaka");
    await page.getByRole("button", { name: "Mark as left" }).click();
    await expect(page.getByText("This student has left the school. Their records are kept.")).toBeVisible();
    await page.goto("/students");
    await expect(page.getByText("1 students")).toBeVisible();
    await page.getByRole("link", { name: "Include students who left" }).click();
    await expect(page.getByText("Left school")).toBeVisible();
  });

  test("the invited admin sees students but a stranger gets nothing", async () => {
    const admin = await apiAs("admin@bls.test");
    expect((await admin.from("student_directory").select("id")).data!.length).toBe(2);
    const stranger = await apiAs("stranger@bls.test");
    expect((await stranger.from("student_directory").select("id")).data).toEqual([]);
  });
});
