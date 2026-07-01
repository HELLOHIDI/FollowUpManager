import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLocalAdmin,
  createLocalTestUser,
} from "./helpers/local-supabase-admin";

test.describe.configure({ mode: "serial" });

let admin: SupabaseClient;
let user: Awaited<ReturnType<typeof createLocalTestUser>>;
let companyAId: string;
let companyBId: string;
let projectAId: string;
let projectBId: string;
const suffix = String(Date.now()).slice(-9);
const assignmentNumber = `TASK-${suffix}`;
const projectAName = `Project A ${suffix}`;
const projectBName = `Project B ${suffix}`;

const fill = async (
  page: import("@playwright/test").Page,
  name: string,
  value: string,
) => {
  await page.locator(`[name="${name}"]`).fill(value);
};

async function login(page: import("@playwright/test").Page) {
  await page.locator('[name="email"]').fill(user.email);
  await page.locator('[name="password"]').fill(user.password);
  await page.locator('form button[type="submit"]').click();
}

async function fillProjectForm(
  page: import("@playwright/test").Page,
  options: {
    assignmentNumber?: string;
    projectName?: string;
    withEmail?: boolean;
  },
) {
  await fill(page, "projectName", options.projectName ?? projectAName);
  await fill(page, "hostInstitution", "Host Institution");
  await fill(page, "assignmentNumber", options.assignmentNumber ?? assignmentNumber);
  await fill(page, "assignmentName", "Assignment Name");
  await fill(page, "agreementStartDate", "2026-01-01");
  await fill(page, "agreementEndDate", "2026-12-31");
  await fill(page, "managerName", "Manager");
  await fill(
    page,
    options.withEmail ? "managerEmail" : "managerPhone",
    options.withEmail ? "manager@example.com" : "010-1234-5678",
  );
  await fill(page, "governmentSubsidyAmount", "1000000");
  await fill(page, "selfCashAmount", "200000");
  await fill(page, "selfInKindAmount", "300000");
}

const projectCreatePath = (companyId: string) =>
  `/settings/company?mode=project-create&projectCompanyId=${companyId}&returnTo=%2Fprojects`;

const projectIdFromSetupUrl = (url: string) => {
  const match = url.match(/\/settings\/company\/projects\/([^/]+)\/setup$/);
  if (!match) throw new Error(`Unexpected project setup URL: ${url}`);
  return match[1];
};

test.beforeAll(async () => {
  admin = createLocalAdmin();
  user = await createLocalTestUser(admin, "project-e2e");
  const { data, error } = await admin
    .from("companies")
    .insert([
      {
        business_registration_number: `3${suffix}`,
        business_type: "sole_proprietor",
        company_name: `Project Company A ${suffix}`,
        company_size: "small_enterprise",
        founded_at: "2020-01-01",
        profile_status: "complete",
      },
      {
        business_registration_number: `4${suffix}`,
        business_type: "sole_proprietor",
        company_name: `Project Company B ${suffix}`,
        company_size: "small_enterprise",
        founded_at: "2020-01-01",
        profile_status: "complete",
      },
    ])
    .select("id, company_name");
  if (error) throw error;
  companyAId = data.find((row) => row.company_name.startsWith("Project Company A"))!.id;
  companyBId = data.find((row) => row.company_name.startsWith("Project Company B"))!.id;
});

test.afterAll(async () => {
  if (!admin) return;
  const { data: projects } = await admin
    .from("projects")
    .select("id")
    .in("company_id", [companyAId, companyBId]);
  const projectIds = projects?.map(({ id }) => id) ?? [];
  if (projectIds.length) {
    const { data: documents } = await admin
      .from("project_documents")
      .select("storage_path")
      .in("project_id", projectIds);
    const paths = documents?.map(({ storage_path }) => storage_path) ?? [];
    if (paths.length) await admin.storage.from("project-documents").remove(paths);
    await admin.from("project_documents").delete().in("project_id", projectIds);
    await admin.from("projects").delete().in("id", projectIds);
  }
  await admin.from("companies").delete().in("id", [companyAId, companyBId]);
  if (user?.userId) await admin.auth.admin.deleteUser(user.userId);
});

test("keeps projects company-scoped and manages registration documents", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/settings/company");
  await login(page);
  await expect(page).toHaveURL(/\/projects$/);

  await page.goto(projectCreatePath(companyAId));
  await fillProjectForm(page, { withEmail: true });
  await page.locator("form").getByRole("button").click();
  await expect(page).toHaveURL(
    /\/settings\/company\/projects\/[0-9a-f-]+\/setup$/,
    { timeout: 15_000 },
  );
  projectAId = projectIdFromSetupUrl(page.url());

  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "project-a.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,value\nA,1"),
  });
  await expect(page.getByText("project-a.csv")).toBeVisible();

  await page.goto(projectCreatePath(companyBId));
  await fillProjectForm(page, {
    assignmentNumber: `TASK-B-${suffix}`,
    projectName: projectBName,
  });
  await page.locator("form").getByRole("button").click();
  await expect(page).toHaveURL(
    /\/settings\/company\/projects\/[0-9a-f-]+\/setup$/,
    { timeout: 15_000 },
  );
  projectBId = projectIdFromSetupUrl(page.url());

  const { data: companyAProjects, error: companyAError } = await admin
    .from("projects")
    .select("project_name")
    .eq("company_id", companyAId);
  if (companyAError) throw companyAError;
  expect(companyAProjects.map((project) => project.project_name)).toEqual([
    projectAName,
  ]);

  const { data: companyBProjects, error: companyBError } = await admin
    .from("projects")
    .select("project_name")
    .eq("company_id", companyBId);
  if (companyBError) throw companyBError;
  expect(companyBProjects.map((project) => project.project_name)).toEqual([
    projectBName,
  ]);

  await page.goto(`/settings/company/projects/${projectAId}`);
  await expect(page.getByText("project-a.csv")).toBeVisible();
  await page.getByRole("button", { name: /project-a\.csv/ }).last().click();
  await expect(page.getByText("project-a.csv")).toHaveCount(0);
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "project-a-updated.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,value\nC,3"),
  });
  await expect(page.getByText("project-a-updated.csv")).toBeVisible();
  await fill(page, "projectNotes", "Updated project notes");
  await page.locator("form").getByRole("button").click();
  await expect(page.locator('[name="projectNotes"]')).toHaveValue(
    "Updated project notes",
  );

  expect(projectBId).toMatch(/^[0-9a-f-]+$/);
});
