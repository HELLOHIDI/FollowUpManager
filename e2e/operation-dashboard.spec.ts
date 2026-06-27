import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLocalAdmin, createLocalTestUser } from "./helpers/local-supabase-admin";

test.describe.configure({ mode: "serial" });

let admin: SupabaseClient;
let user: Awaited<ReturnType<typeof createLocalTestUser>>;
let projectId: string;
let emptyProjectId: string;
let companyId: string;

test.beforeAll(async () => {
  admin = createLocalAdmin();
  user = await createLocalTestUser(admin, "dashboard-e2e");
  companyId = crypto.randomUUID();
  projectId = crypto.randomUUID();
  emptyProjectId = crypto.randomUUID();
  const categoryId = crypto.randomUUID();
  const suffix = String(Date.now()).slice(-10);
  const { error } = await admin.from("companies").insert({
    id: companyId,
    business_registration_number: suffix,
    business_type: "sole_proprietor",
    company_name: "대시보드 기업",
    company_size: "small_enterprise",
    founded_at: "2020-01-01",
    profile_status: "complete",
  });
  if (error) throw error;
  const projects = [
    { id: projectId, project_name: "운영 대시보드", assignment_number: `DASH-${suffix}` },
    { id: emptyProjectId, project_name: "빈 대시보드", assignment_number: `EMPTY-${suffix}` },
  ].map((project) => ({
    ...project,
    company_id: companyId,
    host_institution: "전담기관",
    agreement_start_date: "2026-01-01",
    agreement_end_date: "2026-12-31",
    government_subsidy_amount: 70,
    self_cash_amount: 10,
    self_in_kind_amount: 20,
    self_contribution_amount: 30,
    total_project_budget: 100,
    assignment_name: "운영 과제",
    manager_name: "담당자",
    manager_email: "manager@example.com",
    profile_status: "complete",
  }));
  const projectInsert = await admin.from("projects").insert(projects);
  if (projectInsert.error) throw projectInsert.error;
  const categoryInsert = await admin.from("project_budget_categories").insert({ id: categoryId, project_id: projectId, category_key: "material_cost", sort_order: 1 });
  if (categoryInsert.error) throw categoryInsert.error;
  const expenseInsert = await admin.from("expenses").insert([
    { project_id: projectId, project_budget_category_id: categoryId, category_key: "material_cost", title: "집행 요청 자재", amount: 30, stage_key: "execution_request" },
    { project_id: projectId, project_budget_category_id: categoryId, category_key: "material_cost", title: "집행 완료 자재", amount: 40, stage_key: "execution_completed" },
  ]);
  if (expenseInsert.error) throw expenseInsert.error;
});

test.afterAll(async () => {
  if (!admin) return;
  await admin.from("expenses").delete().eq("project_id", projectId);
  await admin.from("project_budget_categories").delete().eq("project_id", projectId);
  await admin.from("projects").delete().in("id", [projectId, emptyProjectId]);
  await admin.from("companies").delete().eq("id", companyId);
  if (user?.userId) await admin.auth.admin.deleteUser(user.userId);
});

async function login(page: import("@playwright/test").Page, destination: string) {
  await page.goto(destination);
  await expect(page).toHaveURL(/\/login\?redirectedFrom=/);
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
}

test("renders completed-only KPIs and one grouped category on desktop", async ({ page }) => {
  await login(page, `/projects/${projectId}`);
  await expect(page.getByLabel("총사업비 100원")).toBeVisible();
  await expect(page.getByLabel("잔여예산 60원")).toBeVisible();
  await expect(page.getByLabel("예산 소진율 40%")).toBeVisible();
  await expect(page.getByRole("heading", { name: "재료비" })).toBeVisible();
  await expect(page.getByText("2건의 지출")).toBeVisible();
  await expect(page.getByLabel("재료비 합계 70원")).toBeVisible();
  await expect(page.getByRole("link", { name: /집행 요청 자재/ })).toBeVisible();
  await expect(page.locator("#kanban")).toContainText("다음 슬라이스");
});

test("keeps KPI cards and a real empty state on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, `/projects/${emptyProjectId}`);
  await expect(page.getByLabel("총사업비 100원")).toBeVisible();
  await expect(page.getByLabel("잔여예산 100원")).toBeVisible();
  await expect(page.getByText("등록된 지출이 없습니다")).toBeVisible();
  await expect(page.getByRole("heading", { name: "재료비" })).toHaveCount(0);
});
