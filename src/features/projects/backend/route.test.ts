import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createHonoApp } from "@/backend/hono/app";
import type { Database } from "@/lib/supabase/types";

const TEST_USER = {
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-06-22T00:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  user_metadata: {},
} as User;

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_INPUT = {
  agreementEndDate: "2026-12-31",
  agreementStartDate: "2026-01-01",
  assignmentName: "Grant",
  assignmentNumber: "A-1",
  governmentSubsidyAmount: "1000",
  hostInstitution: "Agency",
  managerEmail: "pm@example.com",
  managerName: "PM",
  managerPhone: null,
  projectName: "Project",
  projectNotes: null,
  selfCashAmount: "100",
  selfInKindAmount: "50",
};
const PROJECT_ROW = {
  agreement_end_date: "2026-12-31",
  agreement_start_date: "2026-01-01",
  assignment_name: "Grant",
  assignment_number: "A-1",
  company_id: COMPANY_ID,
  created_at: "2026-01-01T00:00:00.000Z",
  government_subsidy_amount: 1000,
  host_institution: "Agency",
  id: PROJECT_ID,
  manager_email: "pm@example.com",
  manager_name: "PM",
  manager_phone: null,
  profile_status: "complete",
  project_name: "Project",
  project_notes: null,
  self_cash_amount: 100,
  self_contribution_amount: 150,
  self_in_kind_amount: 50,
  total_project_budget: 1150,
  updated_at: "2026-01-01T00:00:00.000Z",
};

const authClient = (from = vi.fn()) => {
  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: TEST_USER }, error: null }),
      },
      from,
    } as unknown as SupabaseClient<Database>,
    from,
  };
};

const projectClient = () => {
  const companyMaybeSingle = vi.fn().mockResolvedValue({ data: { id: COMPANY_ID }, error: null });
  const companyIs = vi.fn(() => ({ maybeSingle: companyMaybeSingle }));
  const companyEq = vi.fn(() => ({ is: companyIs }));

  const projectSecondOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const projectFirstOrder = vi.fn(() => ({ order: projectSecondOrder }));
  const projectIs = vi.fn(() => ({ order: projectFirstOrder }));
  const projectEq = vi.fn(() => ({ is: projectIs }));

  const from = vi.fn((table: string) => ({
    select: vi.fn(() => table === "companies" ? { eq: companyEq } : { eq: projectEq }),
  }));

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
  };
};

const createProjectClient = (insertResult: { data: unknown; error: unknown }) => {
  const companyMaybeSingle = vi.fn().mockResolvedValue({ data: { id: COMPANY_ID }, error: null });
  const companyIs = vi.fn(() => ({ maybeSingle: companyMaybeSingle }));
  const companyEq = vi.fn(() => ({ is: companyIs }));

  const projectSingle = vi.fn().mockResolvedValue(insertResult);
  const projectSelect = vi.fn(() => ({ single: projectSingle }));
  const projectInsert = vi.fn(() => ({ select: projectSelect }));

  const from = vi.fn((table: string) => table === "companies"
    ? { select: vi.fn(() => ({ eq: companyEq })) }
    : { insert: projectInsert });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
  };
};

describe("project routes", () => {
  it("uses the authenticated client when listing projects for company setup", async () => {
    const service = projectClient();
    const authenticated = authClient(service.from);
    const mutation = authClient();
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => authenticated.client),
      createProjectMutationClient: vi.fn(() => mutation.client),
    });

    const response = await app.request(`/api/companies/${COMPANY_ID}/projects`, {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(service.from).toHaveBeenCalledWith("companies");
    expect(service.from).toHaveBeenCalledWith("projects");
    expect(mutation.from).not.toHaveBeenCalled();
  });

  it("falls back to the authenticated client when service project inserts are not granted", async () => {
    const service = createProjectClient({
      data: null,
      error: { code: "42501", message: "permission denied for table projects" },
    });
    const fallback = createProjectClient({ data: PROJECT_ROW, error: null });
    const authenticated = authClient(fallback.from);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => authenticated.client),
      createProjectMutationClient: vi.fn(() => service.client),
    });

    const response = await app.request(`/api/companies/${COMPANY_ID}/projects`, {
      body: JSON.stringify(PROJECT_INPUT),
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: PROJECT_ID, companyId: COMPANY_ID });
    expect(service.from).toHaveBeenCalledWith("projects");
    expect(fallback.from).toHaveBeenCalledWith("projects");
  });
});
