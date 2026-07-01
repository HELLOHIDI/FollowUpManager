import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createLocalAdmin } from "./helpers/local-supabase-admin";

test.describe.configure({ mode: "serial" });

const email = `company-e2e-${Date.now()}@example.com`;
const password = "Company-E2E-Password-2026!";
const suffix = String(Date.now()).slice(-9);
const corporationBusinessNumber = `1${suffix}`;
const soleBusinessNumber = `2${suffix}`;
const corporateRegistrationNumber = `1234${suffix}`;
const corporationName = `Corporation ${suffix}`;
const soleCompanyName = `Sole Company ${suffix}`;
const updatedCorporationName = `Updated Corporation ${suffix}`;
const seoulToday = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Seoul",
  year: "numeric",
}).format(new Date());
const tomorrowDate = new Date(`${seoulToday}T00:00:00.000Z`);
tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
const seoulTomorrow = tomorrowDate.toISOString().slice(0, 10);

let admin: SupabaseClient;
let userId: string;

const fill = async (
  page: import("@playwright/test").Page,
  name: string,
  value: string,
) => {
  await page.locator(`[name="${name}"]`).fill(value);
};

async function login(page: import("@playwright/test").Page) {
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

async function fillCompanyForm(
  page: import("@playwright/test").Page,
  input: {
    businessNumber: string;
    businessType?: "corporation" | "sole_proprietor";
    companyName: string;
    companySize?: string;
    corporateNumber?: string;
    foundedAt: string;
  },
) {
  await fill(page, "companyName", input.companyName);
  await page
    .locator('[name="businessType"]')
    .selectOption(input.businessType ?? "sole_proprietor");
  await page
    .locator('[name="companySize"]')
    .selectOption(input.companySize ?? "small_enterprise");
  await fill(page, "businessRegistrationNumber", input.businessNumber);
  await fill(page, "foundedAt", input.foundedAt);

  if (input.corporateNumber) {
    await fill(page, "corporateRegistrationNumber", input.corporateNumber);
  }
}

const companyCreatePath = "/settings/company?mode=create&returnTo=%2Fprojects";
const companyEditPath = (companyId: string) =>
  `/settings/company?companyId=${companyId}&returnTo=%2Fprojects`;

test.beforeAll(async () => {
  admin = createLocalAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (error) {
    throw error;
  }

  userId = data.user.id;
});

test.afterAll(async () => {
  if (admin) {
    await admin
      .from("companies")
      .delete()
      .in("business_registration_number", [
        corporationBusinessNumber,
        soleBusinessNumber,
      ]);
  }

  if (admin && userId) {
    await admin.auth.admin.deleteUser(userId);
  }
});

test("creates multiple companies, edits one, and persists through refresh", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/settings/company");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fsettings%2Fcompany$/);
  await login(page);
  await expect(page).toHaveURL(/\/projects$/);

  await page.goto(companyCreatePath);
  await fillCompanyForm(page, {
    businessNumber: corporationBusinessNumber,
    businessType: "corporation",
    companyName: corporationName,
    corporateNumber: corporateRegistrationNumber,
    foundedAt: seoulTomorrow,
  });
  await expect(page.locator('form button[type="submit"]')).toBeDisabled();

  await fill(page, "foundedAt", seoulToday);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole("heading", { exact: true, name: corporationName }),
  ).toBeVisible();

  const { data: corporation, error: corporationError } = await admin
    .from("companies")
    .select("id, company_name")
    .eq("business_registration_number", corporationBusinessNumber)
    .single();
  if (corporationError) throw corporationError;
  expect(corporation.company_name).toBe(corporationName);

  await page.goto(companyCreatePath);
  await fillCompanyForm(page, {
    businessNumber: soleBusinessNumber,
    companyName: soleCompanyName,
    companySize: "unknown",
    foundedAt: "2021-02-02",
  });
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole("heading", { exact: true, name: soleCompanyName }),
  ).toBeVisible();

  await page.goto(companyCreatePath);
  await fillCompanyForm(page, {
    businessNumber: corporationBusinessNumber,
    companyName: `Duplicate ${suffix}`,
    foundedAt: "2022-03-03",
  });
  await page.locator('form button[type="submit"]').click();
  const { count: duplicateCount, error: duplicateCountError } = await admin
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("business_registration_number", corporationBusinessNumber);
  if (duplicateCountError) throw duplicateCountError;
  expect(duplicateCount).toBe(1);

  await page.goto(companyEditPath(corporation.id));
  await fill(page, "companyName", updatedCorporationName);
  await page.locator('[name="businessType"]').selectOption("sole_proprietor");
  await expect(page.locator('[name="corporateRegistrationNumber"]')).toHaveCount(0);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole("heading", { exact: true, name: updatedCorporationName }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { exact: true, name: updatedCorporationName }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: soleCompanyName }),
  ).toBeVisible();

  const { data: companies, error: companiesError } = await admin
    .from("companies")
    .select("company_name")
    .in("business_registration_number", [
      corporationBusinessNumber,
      soleBusinessNumber,
    ])
    .order("company_name");
  if (companiesError) throw companiesError;
  expect(companies.map((company) => company.company_name).sort()).toEqual(
    [soleCompanyName, updatedCorporationName].sort(),
  );
});
