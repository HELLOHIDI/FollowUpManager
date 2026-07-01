import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLocalAdmin,
  createLocalTestUser,
} from "./helpers/local-supabase-admin";

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
  const suffix = String(Date.now()).slice(-10);
  const { error } = await admin.from("companies").insert({
    id: companyId,
    business_registration_number: suffix,
    business_type: "sole_proprietor",
    company_name: `Dashboard Company ${suffix}`,
    company_size: "small_enterprise",
    founded_at: "2020-01-01",
    profile_status: "complete",
  });
  if (error) throw error;

  const projects = [
    { id: projectId, assignment_number: `DASH-${suffix}`, project_name: `Dashboard Project ${suffix}` },
    { id: emptyProjectId, assignment_number: `EMPTY-${suffix}`, project_name: `Empty Dashboard Project ${suffix}` },
  ].map((project) => ({
    ...project,
    agreement_end_date: "2026-12-31",
    agreement_start_date: "2026-01-01",
    assignment_name: "Dashboard Assignment",
    company_id: companyId,
    government_subsidy_amount: 70,
    host_institution: "Host Institution",
    manager_email: "manager@example.com",
    manager_name: "Manager",
    profile_status: "complete",
    self_cash_amount: 10,
    self_contribution_amount: 30,
    self_in_kind_amount: 20,
    total_project_budget: 100,
  }));
  const projectInsert = await admin.from("projects").insert(projects);
  if (projectInsert.error) throw projectInsert.error;

  const categorySelect = await admin
    .from("project_budget_categories")
    .select("id")
    .eq("project_id", projectId)
    .eq("category_key", "material_cost")
    .single();
  if (categorySelect.error) throw categorySelect.error;

  const expenseInsert = await admin.from("expenses").insert([
    {
      amount: 30,
      category_key: "material_cost",
      project_budget_category_id: categorySelect.data.id,
      project_id: projectId,
      stage_key: "execution_request",
      title: "Execution Request Material",
    },
    {
      amount: 40,
      category_key: "material_cost",
      project_budget_category_id: categorySelect.data.id,
      project_id: projectId,
      stage_key: "execution_completed",
      title: "Execution Completed Material",
    },
  ]);
  if (expenseInsert.error) throw expenseInsert.error;
});

test.afterAll(async () => {
  if (!admin) return;
  await admin.from("expenses").delete().eq("project_id", projectId);
  await admin
    .from("project_budget_categories")
    .delete()
    .eq("project_id", projectId);
  await admin.from("projects").delete().in("id", [projectId, emptyProjectId]);
  await admin.from("companies").delete().eq("id", companyId);
  if (user?.userId) await admin.auth.admin.deleteUser(user.userId);
});

async function login(page: import("@playwright/test").Page, destination: string) {
  await page.goto(destination);
  await expect(page).toHaveURL(/\/login\?redirectedFrom=/);
  await page.locator('[name="email"]').fill(user.email);
  await page.locator('[name="password"]').fill(user.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
}

test("renders completed-only KPIs and one grouped category on desktop", async ({
  page,
}) => {
  await login(page, `/projects/${projectId}`);
  await expect(page.locator("main")).toContainText("100");
  await expect(page.locator("main")).toContainText("60");
  await expect(page.locator("main")).toContainText("40%");
  await expect(
    page.getByRole("link", { name: /Execution Request Material/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Execution Completed Material/ }),
  ).toBeVisible();
});

test("keeps KPI cards and a real empty state on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, `/projects/${emptyProjectId}`);
  await expect(page.locator("main")).toContainText("100");
  await expect(page.locator("main")).toContainText("0");
  await expect(page.locator("main")).not.toContainText("Execution Request Material");
});
