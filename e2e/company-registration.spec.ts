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
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/settings\/company$/);
  await expect(page.getByText("등록된 기업이 없습니다.")).toBeVisible();
  await expect(page.getByLabel("대표자명")).toHaveCount(0);
  await expect(page.getByLabel("담당자 이메일")).toHaveCount(0);
  await expect(page.getByLabel("주소")).toHaveCount(0);
  await expect(page.getByLabel("업태")).toHaveCount(0);
  await expect(page.getByLabel("업종")).toHaveCount(0);

  await page.getByLabel("기업명").fill("신규 법인");
  await page.getByLabel("회사 형태").selectOption("corporation");
  await page.getByLabel("기업규모").selectOption("small_enterprise");
  await page.getByLabel("사업자등록번호").fill(corporationBusinessNumber);
  await page.getByLabel("설립일").fill(seoulTomorrow);
  await expect(page.getByText("설립일은 오늘 이후일 수 없습니다.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "기업 등록", exact: true })
  ).toBeDisabled();
  await page.getByLabel("설립일").fill(seoulToday);
  await page
    .getByLabel("법인등록번호")
    .fill(corporateRegistrationNumber);
  await page.getByRole("button", { name: "기업 등록", exact: true }).click();

  await expect(page.getByRole("button", { name: /신규 법인/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("기업명")).toHaveValue("신규 법인");

  await page.getByRole("button", { name: "기업 추가" }).click();
  await expect(page.getByLabel("법인등록번호")).toHaveCount(0);
  await page.getByLabel("기업명").fill("개인 기업");
  await page.getByLabel("기업규모").selectOption("unknown");
  await page.getByLabel("사업자등록번호").fill(soleBusinessNumber);
  await page.getByLabel("설립일").fill("2021-02-02");
  await page.getByRole("button", { name: "기업 등록", exact: true }).click();

  await expect(page.getByText("2개 기업을 관리하고 있습니다.")).toBeVisible();
  await expect(page.getByText("기업규모 확인 필요")).toBeVisible();

  await page.getByRole("button", { name: "기업 추가" }).click();
  await page.getByLabel("기업명").fill("중복 기업");
  await page.getByLabel("기업규모").selectOption("small_enterprise");
  await page
    .getByLabel("사업자등록번호")
    .fill(corporationBusinessNumber);
  await page.getByLabel("설립일").fill("2022-03-03");
  await page
    .getByRole("button", { name: "기업 등록", exact: true })
    .click();
  await expect(
    page.getByText("이미 등록된 사업자등록번호입니다.").first()
  ).toBeVisible();
  await expect(page.getByText("2개 기업을 관리하고 있습니다.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /신규 법인/ }).click();
  await page.getByLabel("기업명").fill("수정된 법인");
  await page.getByLabel("회사 형태").selectOption("sole_proprietor");
  await expect(page.getByLabel("법인등록번호")).toHaveCount(0);
  await page.getByRole("button", { name: "기업 정보 수정" }).click();
  await expect(page.getByRole("button", { name: /수정된 법인/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /수정된 법인/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /개인 기업/ })).toBeVisible();
  await expect(page.getByLabel("회사 형태")).toHaveValue("sole_proprietor");
  await expect(page.getByLabel("법인등록번호")).toHaveCount(0);
});
