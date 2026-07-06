import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
const COMPANY_ROW = {
  business_registration_number: "1234567890",
  business_type: "corporation",
  company_name: "테스트 기업",
  company_size: "small_enterprise",
  corporate_registration_number: "1234561234567",
  created_at: "2026-06-22T00:00:00.000Z",
  deleted_at: null,
  founded_at: "2020-01-01",
  id: COMPANY_ID,
  profile_status: "complete",
  updated_at: "2026-06-22T00:00:00.000Z",
};
const COMPANY_INPUT = {
  businessRegistrationNumber: "123-45-67890",
  businessType: "corporation",
  companyName: "테스트 기업",
  companySize: "small_enterprise",
  corporateRegistrationNumber: "123456-1234567",
  foundedAt: "2020-01-01",
};

const authorizedClient = (rows: unknown[] = [], detail: unknown = null) => {
  const listSecondOrder = vi.fn().mockResolvedValue({ data: rows, error: null });
  const listFirstOrder = vi.fn(() => ({ order: listSecondOrder }));
  const listIs = vi.fn(() => ({ order: listFirstOrder }));
  const detailMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: detail, error: null });
  const detailIs = vi.fn(() => ({ maybeSingle: detailMaybeSingle }));
  const detailEq = vi.fn(() => ({ is: detailIs }));
  const select = vi.fn(() => ({ eq: detailEq, is: listIs }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn().mockResolvedValue({
    data: { user: TEST_USER },
    error: null,
  });

  return {
    client: { auth: { getUser }, from } as unknown as SupabaseClient<Database>,
    from,
    listFirstOrder,
    listSecondOrder,
  };
};

const mutationClient = ({
  insertError = null,
  insertRow = COMPANY_ROW,
  updateError = null,
  updateRow = COMPANY_ROW,
}: {
  insertError?: { code: string; message: string } | null;
  insertRow?: unknown;
  updateError?: { code: string; message: string } | null;
  updateRow?: unknown;
} = {}) => {
  const insertSingle = vi
    .fn()
    .mockResolvedValue({ data: insertRow, error: insertError });
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  const updateMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: updateRow, error: updateError });
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateIs = vi.fn(() => ({ select: updateSelect }));
  const updateEq = vi.fn(() => ({ is: updateIs }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ insert, update }));

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    insert,
    update,
  };
};

const requestOptions = (method = "GET", body?: unknown) => ({
  method,
  headers: {
    Authorization: "Bearer valid-token",
    ...(body ? { "Content-Type": "application/json" } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

describe("company API boundary", () => {
  const createCompanyMutationClient = vi.fn();

  beforeEach(() => {
    createCompanyMutationClient.mockReset();
  });

  it.each([
    ["GET", "/api/companies"],
    ["POST", "/api/companies"],
    ["GET", `/api/companies/${COMPANY_ID}`],
    ["PATCH", `/api/companies/${COMPANY_ID}`],
  ])("protects %s %s before privileged client creation", async (method, url) => {
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(),
      createCompanyMutationClient,
    });
    const response = await app.request(url, { method });

    expect(response.status).toBe(401);
    expect(createCompanyMutationClient).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/companies"],
    ["POST", "/api/companies"],
    ["GET", `/api/companies/${COMPANY_ID}`],
    ["PATCH", `/api/companies/${COMPANY_ID}`],
  ])("rejects an invalid token for %s %s", async (method, url) => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token"),
    });
    const createAuthenticatedClient = vi.fn(() => ({
      auth: { getUser },
    } as unknown as SupabaseClient<Database>));
    const app = createHonoApp({
      createAuthenticatedClient,
      createCompanyMutationClient,
    });
    const response = await app.request(url, {
      headers: { Authorization: "Bearer invalid-token" },
      method,
    });

    expect(response.status).toBe(401);
    expect(createAuthenticatedClient).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(createCompanyMutationClient).not.toHaveBeenCalled();
  });

  it("uses the authenticated client for list reads", async () => {
    const auth = authorizedClient([COMPANY_ROW]);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      "/api/companies",
      requestOptions()
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ id: COMPANY_ID, companyName: "테스트 기업" }),
    ]);
    expect(auth.from).toHaveBeenCalledWith("companies");
    expect(auth.listFirstOrder).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
    expect(auth.listSecondOrder).toHaveBeenCalledWith("id", {
      ascending: true,
    });
    expect(createCompanyMutationClient).not.toHaveBeenCalled();
  });

  it("rejects invalid mutation input before privileged client creation", async () => {
    const auth = authorizedClient();
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      "/api/companies",
      requestOptions("POST", { ...COMPANY_INPUT, businessRegistrationNumber: "bad" })
    );

    expect(response.status).toBe(400);
    expect(createCompanyMutationClient).not.toHaveBeenCalled();
  });

  it("creates an allowlisted company after validation", async () => {
    const auth = authorizedClient();
    const mutation = mutationClient();
    createCompanyMutationClient.mockReturnValue(mutation.client);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      "/api/companies",
      requestOptions("POST", COMPANY_INPUT)
    );

    expect(response.status).toBe(201);
    expect(createCompanyMutationClient).toHaveBeenCalledTimes(1);
    expect(mutation.insert).toHaveBeenCalledWith({
      business_registration_number: "1234567890",
      business_type: "corporation",
      company_name: "테스트 기업",
      company_size: "small_enterprise",
      corporate_registration_number: "1234561234567",
      founded_at: "2020-01-01",
      profile_status: "complete",
    });
  });

  it("falls back to the authenticated client when service company inserts are not granted", async () => {
    const authMutation = mutationClient();
    const auth = authorizedClient();
    auth.client.from = authMutation.client.from;
    const mutation = mutationClient({
      insertError: { code: "42501", message: "permission denied for table companies" },
    });
    createCompanyMutationClient.mockReturnValue(mutation.client);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      "/api/companies",
      requestOptions("POST", COMPANY_INPUT)
    );

    expect(response.status).toBe(201);
    expect(createCompanyMutationClient).toHaveBeenCalledTimes(1);
    expect(mutation.insert).toHaveBeenCalledTimes(1);
    expect(authMutation.insert).toHaveBeenCalledTimes(1);
  });

  it("falls back to the authenticated client when service client creation fails", async () => {
    const authMutation = mutationClient();
    const auth = authorizedClient();
    auth.client.from = authMutation.client.from;
    createCompanyMutationClient.mockImplementation(() => {
      throw new Error("Invalid backend configuration");
    });
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      "/api/companies",
      requestOptions("POST", COMPANY_INPUT)
    );

    expect(response.status).toBe(201);
    expect(createCompanyMutationClient).toHaveBeenCalledTimes(1);
    expect(authMutation.insert).toHaveBeenCalledTimes(1);
  });

  it("clears stale corporate input and derives review status for a sole proprietor", async () => {
    const auth = authorizedClient();
    const mutation = mutationClient({
      insertRow: {
        ...COMPANY_ROW,
        business_type: "sole_proprietor",
        company_size: "unknown",
        corporate_registration_number: null,
        profile_status: "review_required",
      },
    });
    createCompanyMutationClient.mockReturnValue(mutation.client);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      "/api/companies",
      requestOptions("POST", {
        ...COMPANY_INPUT,
        businessType: "sole_proprietor",
        companySize: "unknown",
      })
    );

    expect(response.status).toBe(201);
    expect(mutation.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        corporate_registration_number: null,
        profile_status: "review_required",
      })
    );
  });

  it("rejects a stored row whose cross-field invariants are invalid", async () => {
    const auth = authorizedClient([
      { ...COMPANY_ROW, company_size: "unknown", profile_status: "complete" },
    ]);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request("/api/companies", requestOptions());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "COMPANY_RESPONSE_INVALID" },
    });
  });

  it("maps only the discovered registration unique constraint to 409", async () => {
    const auth = authorizedClient();
    const mutation = mutationClient({
      insertError: {
        code: "23505",
        message:
          'duplicate key violates unique constraint "companies_business_registration_number_key"',
      },
    });
    createCompanyMutationClient.mockReturnValue(mutation.client);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      "/api/companies",
      requestOptions("POST", COMPANY_INPUT)
    );

    expect(response.status).toBe(409);
    expect(createCompanyMutationClient).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({
      error: { code: "COMPANY_REGISTRATION_NUMBER_CONFLICT" },
    });
  });

  it("returns 404 from a valid update without recreating the client", async () => {
    const auth = authorizedClient();
    const mutation = mutationClient({ updateRow: null });
    createCompanyMutationClient.mockReturnValue(mutation.client);
    const app = createHonoApp({
      createAuthenticatedClient: vi.fn(() => auth.client),
      createCompanyMutationClient,
    });
    const response = await app.request(
      `/api/companies/${COMPANY_ID}`,
      requestOptions("PATCH", COMPANY_INPUT)
    );

    expect(response.status).toBe(404);
    expect(createCompanyMutationClient).toHaveBeenCalledTimes(1);
  });
});
