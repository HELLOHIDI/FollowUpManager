import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHonoApp } from "./app";
import { parseBearerToken } from "@/backend/middleware/auth";
import type { Database } from "@/lib/supabase/types";

const serviceClientMocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/backend/supabase/client", () => serviceClientMocks);

const TEST_USER = {
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-06-22T00:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  user_metadata: {},
} as User;

const createClientStub = ({
  user = TEST_USER,
  authError = null,
  row = null,
  snapshot = null,
}: {
  user?: User | null;
  authError?: Error | null;
  row?: unknown;
  snapshot?: unknown;
} = {}) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn().mockResolvedValue({
    data: { user },
    error: authError,
  });
  const client = {
    auth: { getUser },
    from,
    rpc: vi.fn().mockResolvedValue({ data: snapshot, error: null }),
  } as unknown as SupabaseClient<Database>;

  return { client, from, getUser };
};

describe("parseBearerToken", () => {
  it("returns a well-formed bearer token", () => {
    expect(parseBearerToken("Bearer valid-token")).toBe("valid-token");
    expect(parseBearerToken("bearer valid-token")).toBe("valid-token");
  });

  it.each([
    undefined,
    "",
    "Basic token",
    "Bearer ",
    "Bearer token with-space",
  ])("rejects malformed authorization value %s", (authorization) => {
    expect(parseBearerToken(authorization)).toBeNull();
  });
});

describe("Hono authentication boundary", () => {
  beforeEach(() => {
    serviceClientMocks.createServiceClient.mockClear();
  });

  it("rejects a missing token before creating any Supabase client", async () => {
    const createAuthenticatedClient = vi.fn();
    const app = createHonoApp({ createAuthenticatedClient });

    const response = await app.request("/api/auth/me");

    expect(response.status).toBe(401);
    expect(createAuthenticatedClient).not.toHaveBeenCalled();
    expect(serviceClientMocks.createServiceClient).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/companies/22222222-2222-4222-8222-222222222222/projects"],
    ["POST", "/api/companies/22222222-2222-4222-8222-222222222222/projects"],
    ["GET", "/api/projects/33333333-3333-4333-8333-333333333333"],
    ["GET", "/api/projects/33333333-3333-4333-8333-333333333333/dashboard"],
    ["PATCH", "/api/projects/33333333-3333-4333-8333-333333333333"],
    ["GET", "/api/projects/33333333-3333-4333-8333-333333333333/documents"],
    ["POST", "/api/projects/33333333-3333-4333-8333-333333333333/documents/upload-intents"],
    ["GET", "/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/history"],
    ["GET", "/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/evidence"],
    ["POST", "/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/evidence"],
    ["POST", "/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/evidence/55555555-5555-4555-8555-555555555555/signed-url"],
    ["DELETE", "/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/evidence/55555555-5555-4555-8555-555555555555"],
    ["PATCH", "/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/stage"],
  ])("rejects unauthenticated project API %s %s before privileged access", async (method, path) => {
    const createAuthenticatedClient = vi.fn();
    const createProjectMutationClient = vi.fn();
    const createExpenseMutationClient = vi.fn();
    const app = createHonoApp({ createAuthenticatedClient, createProjectMutationClient, createExpenseMutationClient });

    const response = await app.request(path, { method });

    expect(response.status).toBe(401);
    expect(createAuthenticatedClient).not.toHaveBeenCalled();
    expect(createProjectMutationClient).not.toHaveBeenCalled();
    expect(createExpenseMutationClient).not.toHaveBeenCalled();
  });

  it("rejects a token that Supabase Auth does not validate", async () => {
    const { client, getUser } = createClientStub({
      user: null,
      authError: new Error("expired token"),
    });
    const createAuthenticatedClient = vi.fn(() => client);
    const app = createHonoApp({ createAuthenticatedClient });

    const response = await app.request("/api/auth/me", {
      headers: { Authorization: "Bearer expired-token" },
    });

    expect(response.status).toBe(401);
    expect(getUser).toHaveBeenCalledWith("expired-token");
    expect(serviceClientMocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("returns the authoritative Supabase user for a valid token", async () => {
    const { client, getUser } = createClientStub();
    const createAuthenticatedClient = vi.fn(() => client);
    const app = createHonoApp({ createAuthenticatedClient });

    const response = await app.request("/api/auth/me", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: { id: TEST_USER.id, email: null },
    });
    expect(getUser).toHaveBeenCalledWith("valid-token");
    expect(serviceClientMocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("validates dashboard project UUIDs before database reads", async () => {
    const { client } = createClientStub();
    const app = createHonoApp({ createAuthenticatedClient: vi.fn(() => client) });
    const response = await app.request("/api/projects/not-a-uuid/dashboard", {
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_DASHBOARD_PARAMS" } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("validates expense stage route params and body before mutation access", async () => {
    const { client } = createClientStub();
    const createExpenseMutationClient = vi.fn();
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => client),
      createExpenseMutationClient,
    });

    const invalidParamsResponse = await app.request("/api/projects/not-a-uuid/expenses/44444444-4444-4444-8444-444444444444/stage", {
      method: "PATCH",
      headers: { Authorization: "Bearer valid-token" },
      body: JSON.stringify({ targetStageKey: "pre_approval" }),
    });
    expect(invalidParamsResponse.status).toBe(400);
    expect(await invalidParamsResponse.json()).toMatchObject({ error: { code: "INVALID_EXPENSE_PARAMS" } });

    const invalidBodyResponse = await app.request("/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/stage", {
      method: "PATCH",
      headers: { Authorization: "Bearer valid-token" },
      body: JSON.stringify({ stageKey: "pre_approval" }),
    });
    expect(invalidBodyResponse.status).toBe(400);
    expect(await invalidBodyResponse.json()).toMatchObject({ error: { code: "INVALID_EXPENSE_BODY" } });
    expect(createExpenseMutationClient).not.toHaveBeenCalled();
  });

  it("validates expense history route params before database reads", async () => {
    const { client, from } = createClientStub();
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => client),
    });

    const response = await app.request(
      "/api/projects/not-a-uuid/expenses/44444444-4444-4444-8444-444444444444/history",
      { headers: { Authorization: "Bearer valid-token" } },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_EXPENSE_PARAMS" } });
    expect(from).not.toHaveBeenCalled();
  });

  it("validates expense evidence route params before database reads", async () => {
    const { client, from } = createClientStub();
    const createExpenseMutationClient = vi.fn();
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => client),
      createExpenseMutationClient,
    });

    const listResponse = await app.request(
      "/api/projects/not-a-uuid/expenses/44444444-4444-4444-8444-444444444444/evidence",
      { headers: { Authorization: "Bearer valid-token" } },
    );
    expect(listResponse.status).toBe(400);
    expect(await listResponse.json()).toMatchObject({ error: { code: "INVALID_EXPENSE_PARAMS" } });

    const deleteResponse = await app.request(
      "/api/projects/33333333-3333-4333-8333-333333333333/expenses/44444444-4444-4444-8444-444444444444/evidence/not-a-uuid",
      { method: "DELETE", headers: { Authorization: "Bearer valid-token" } },
    );
    expect(deleteResponse.status).toBe(400);
    expect(await deleteResponse.json()).toMatchObject({ error: { code: "INVALID_EXPENSE_PARAMS" } });
    expect(from).not.toHaveBeenCalled();
    expect(createExpenseMutationClient).not.toHaveBeenCalled();
  });

  it("returns a validated empty dashboard snapshot", async () => {
    const projectId = "33333333-3333-4333-8333-333333333333";
    const { client } = createClientStub({ snapshot: {
      activeExpenseCount: 0,
      expenseRows: [],
      integrityCode: null,
      kpis: { burnRatio: 0, remainingAmount: 100, spentAmount: 0, totalBudget: 100 },
      project: { id: projectId, name: "빈 프로젝트" },
    } });
    const app = createHonoApp({ createAuthenticatedClient: vi.fn(() => client) });
    const response = await app.request(`/api/projects/${projectId}/dashboard`, {
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ categories: [], kpis: { spentAmount: 0 } });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("uses the authenticated client for the existing read-only route", async () => {
    const { client, from } = createClientStub();
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => client),
    });

    const response = await app.request(
      "/api/example/22222222-2222-4222-8222-222222222222",
      { headers: { Authorization: "Bearer valid-token" } }
    );

    expect(response.status).toBe(404);
    expect(from).toHaveBeenCalledWith("example");
    expect(serviceClientMocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("does not expose unexpected error details", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createHonoApp({
      createAuthenticatedClient: () => {
        throw new Error("sensitive-token-value");
      },
    });

    const response = await app.request("/api/auth/me", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const responseBody = await response.text();

    expect(response.status).toBe(500);
    expect(responseBody).not.toContain("sensitive-token-value");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
      "sensitive-token-value"
    );
    expect(serviceClientMocks.createServiceClient).not.toHaveBeenCalled();

    errorLog.mockRestore();
  });
});
