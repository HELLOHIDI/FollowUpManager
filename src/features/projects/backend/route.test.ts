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

const authClient = () => {
  const from = vi.fn();
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

describe("project routes", () => {
  it("uses the server mutation client when listing projects for company setup", async () => {
    const authenticated = authClient();
    const service = projectClient();
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => authenticated.client),
      createProjectMutationClient: vi.fn(() => service.client),
    });

    const response = await app.request(`/api/companies/${COMPANY_ID}/projects`, {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(authenticated.from).not.toHaveBeenCalled();
    expect(service.from).toHaveBeenCalledWith("companies");
    expect(service.from).toHaveBeenCalledWith("projects");
  });
});
