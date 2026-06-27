import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLocalAdmin, createLocalTestUser } from "./helpers/local-supabase-admin";

test.describe.configure({ mode: "serial" });

let admin: SupabaseClient;
let user: Awaited<ReturnType<typeof createLocalTestUser>>;
let companyAId: string;
let companyBId: string;
const suffix = String(Date.now()).slice(-9);
const assignmentNumber = `TASK-${suffix}`;

async function fillProjectForm(page: import("@playwright/test").Page, options: {
  assignmentNumber?: string;
  projectName?: string;
  withContact?: boolean;
}) {
  await page.getByLabel("사업명", { exact: true }).fill(options.projectName ?? "성장 지원사업");
  await page.getByLabel("주관기관", { exact: true }).fill("지원기관");
  await page.getByLabel("과제번호", { exact: true }).fill(options.assignmentNumber ?? assignmentNumber);
  await page.getByLabel("과제명", { exact: true }).fill("성장 과제");
  await page.getByLabel("협약 시작일", { exact: true }).fill("2026-01-01");
  await page.getByLabel("협약 종료일", { exact: true }).fill("2026-12-31");
  await page.getByLabel("담당자명", { exact: true }).fill("홍길동");
  if (options.withContact) await page.getByLabel("담당자 이메일", { exact: true }).fill("manager@example.com");
  else await page.getByLabel("담당자 연락처", { exact: true }).fill("010-1234-5678");
  await page.getByLabel("정부지원금", { exact: true }).fill("1000000");
  await page.getByLabel("자기부담금(현금)", { exact: true }).fill("200000");
  await page.getByLabel("자기부담금(현물)", { exact: true }).fill("300000");
}

test.beforeAll(async () => {
  admin = createLocalAdmin();
  user = await createLocalTestUser(admin, "project-e2e");
  const { data, error } = await admin.from("companies").insert([
    { business_registration_number: `3${suffix}`, business_type: "sole_proprietor", company_name: "사업 기업 A", company_size: "small_enterprise", founded_at: "2020-01-01", profile_status: "complete" },
    { business_registration_number: `4${suffix}`, business_type: "sole_proprietor", company_name: "사업 기업 B", company_size: "small_enterprise", founded_at: "2020-01-01", profile_status: "complete" },
  ]).select("id, company_name");
  if (error) throw error;
  companyAId = data.find((row) => row.company_name === "사업 기업 A")!.id;
  companyBId = data.find((row) => row.company_name === "사업 기업 B")!.id;
});

test.afterAll(async () => {
  if (!admin) return;
  const { data: projects } = await admin.from("projects").select("id").in("company_id", [companyAId, companyBId]);
  const projectIds = projects?.map(({ id }) => id) ?? [];
  if (projectIds.length) {
    const { data: documents } = await admin.from("project_documents").select("storage_path").in("project_id", projectIds);
    const paths = documents?.map(({ storage_path }) => storage_path) ?? [];
    if (paths.length) await admin.storage.from("project-documents").remove(paths);
    await admin.from("project_documents").delete().in("project_id", projectIds);
    await admin.from("projects").delete().in("id", projectIds);
  }
  await admin.from("companies").delete().in("id", [companyAId, companyBId]);
  if (user?.userId) await admin.auth.admin.deleteUser(user.userId);
});

test("keeps projects company-scoped and manages registration documents", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/settings/company");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/settings\/company$/);

  await page.getByRole("button", { name: /사업 기업 A/ }).click();
  await page.getByLabel("기업 목록").getByRole("button", { name: "사업 등록", exact: true }).click();
  await expect(page.getByRole("heading", { name: "새 사업 등록" })).toBeVisible();
  await fillProjectForm(page, { withContact: true });
  await page.getByLabel("기관 제공 서류").setInputFiles({ name: "기관서류.csv", mimeType: "text/csv", buffer: Buffer.from("name,value\nA,1") });
  await page.locator("form").getByRole("button", { name: "사업 등록", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/, { timeout: 15_000 });

  await page.goto("/settings/company");
  await page.getByRole("button", { name: /사업 기업 B/ }).click();
  await expect(page.getByLabel("기업 목록").getByText("성장 지원사업")).toHaveCount(0);
  await expect(page.getByLabel("기업 목록").getByText("등록된 사업이 없습니다.", { exact: true })).toBeVisible();
  await page.getByLabel("기업 목록").getByRole("button", { name: "사업 등록", exact: true }).click();
  await fillProjectForm(page, { projectName: "지역 지원사업" });
  await page.getByLabel("기관 제공 서류").setInputFiles([
    { name: "기관서류-B.csv", mimeType: "text/csv", buffer: Buffer.from("name,value\nB,2") },
    { name: "허용되지않는파일.exe", mimeType: "application/octet-stream", buffer: Buffer.from("invalid") },
  ]);
  await page.locator("form").getByRole("button", { name: "사업 등록", exact: true }).click();
  await expect(page.getByText("1개 파일은 업로드하지 못했습니다. 관리 화면에서 다시 시도해 주세요.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/, { timeout: 15_000 });

  await page.goto("/settings/company");
  await page.getByRole("button", { name: /사업 기업 A/ }).click();
  await expect(page.getByText("성장 지원사업")).toBeVisible();
  await expect(page.getByText("지역 지원사업")).toHaveCount(0);

  await page.getByLabel("기업 목록").getByRole("button", { name: "사업 등록", exact: true }).click();
  await fillProjectForm(page, { projectName: "성장 지원사업" });
  await expect(page.getByText("같은 기업에 동일한 사업명이 있습니다. 과제번호가 다르면 등록할 수 있습니다.")).toBeVisible();
  await page.locator("form").getByRole("button", { name: "사업 등록", exact: true }).click();
  await expect(page.locator("form").getByText("같은 기업에 이미 등록된 과제번호입니다.", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "성장 지원사업 관리" }).click();
  await expect(page).toHaveURL(/\/settings\/company\/projects\/[0-9a-f-]+$/, { timeout: 15_000 });
  await expect(page.getByText("기관서류.csv")).toBeVisible();
  const openedDocument = page.waitForEvent("popup");
  await page.getByRole("button", { name: "기관서류.csv 새 창에서 열기" }).click();
  const documentPage = await openedDocument;
  await documentPage.close();
  await page.getByRole("button", { name: "기관서류.csv 삭제" }).click();
  await expect(page.getByText("기관서류.csv")).toHaveCount(0);
  await page.getByLabel("파일 추가").setInputFiles({ name: "추가서류.csv", mimeType: "text/csv", buffer: Buffer.from("name,value\nC,3") });
  await expect(page.getByText("추가서류.csv")).toBeVisible();
  await page.getByLabel("유의사항").fill("정산 서류 원본 보관");
  await page.getByRole("button", { name: "사업 정보 수정" }).click();
  await expect(page.getByText("사업 정보가 수정되었습니다.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("유의사항")).toHaveValue("정산 서류 원본 보관");
});
