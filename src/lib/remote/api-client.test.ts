import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client";
import { extractApiErrorCode } from "./api-client";

vi.mock("@/lib/supabase/browser-client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

const createAuthClientStub = () => {
  const getSession = vi.fn().mockResolvedValue({
    data: { session: { access_token: "initial-token" } },
  });
  const refreshSession = vi.fn().mockResolvedValue({
    data: { session: { access_token: "refreshed-token" } },
    error: null,
  });
  const signOut = vi.fn().mockResolvedValue({ error: null });

  return {
    authClient: { auth: { getSession, refreshSession, signOut } },
    getSession,
    refreshSession,
    signOut,
  };
};

const successResponse = (
  config: InternalAxiosRequestConfig
): AxiosResponse => ({
  config,
  data: { ok: true },
  headers: {},
  status: 200,
  statusText: "OK",
});

const unauthorizedError = (config: InternalAxiosRequestConfig) =>
  new AxiosError(
    "Unauthorized",
    "ERR_BAD_REQUEST",
    config,
    undefined,
    {
      config,
      data: { error: { code: "UNAUTHORIZED" } },
      headers: {},
      status: 401,
      statusText: "Unauthorized",
    }
  );

describe("authenticated API client", () => {
  it("extracts a stable API error code", () => {
    const error = new AxiosError(
      "Conflict",
      "ERR_BAD_REQUEST",
      {} as InternalAxiosRequestConfig,
      undefined,
      {
        config: {} as InternalAxiosRequestConfig,
        data: { error: { code: "COMPANY_REGISTRATION_NUMBER_CONFLICT" } },
        headers: {},
        status: 409,
        statusText: "Conflict",
      }
    );

    expect(extractApiErrorCode(error)).toBe(
      "COMPANY_REGISTRATION_NUMBER_CONFLICT"
    );
  });
  it("attaches the current access token", async () => {
    const { authClient } = createAuthClientStub();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      successResponse(config)
    );
    const client = createApiClient({ getAuthClient: () => authClient });

    await client.get("/api/example", { adapter });

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe(
      "Bearer initial-token"
    );
  });

  it("refreshes and retries an unauthorized request exactly once", async () => {
    const { authClient, getSession, refreshSession, signOut } =
      createAuthClientStub();
    getSession
      .mockResolvedValueOnce({
        data: { session: { access_token: "initial-token" } },
      })
      .mockResolvedValue({
        data: { session: { access_token: "refreshed-token" } },
      });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (adapter.mock.calls.length === 1) {
        throw unauthorizedError(config);
      }

      return successResponse(config);
    });
    const redirectToLogin = vi.fn();
    const client = createApiClient({
      getAuthClient: () => authClient,
      redirectToLogin,
    });

    const response = await client.get("/api/example", { adapter });

    expect(response.status).toBe(200);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[1][0].headers.get("Authorization")).toBe(
      "Bearer refreshed-token"
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it("clears the session when the retried request is unauthorized", async () => {
    const { authClient, getSession, refreshSession, signOut } =
      createAuthClientStub();
    getSession
      .mockResolvedValueOnce({
        data: { session: { access_token: "initial-token" } },
      })
      .mockResolvedValue({
        data: { session: { access_token: "refreshed-token" } },
      });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config);
    });
    const redirectToLogin = vi.fn();
    const client = createApiClient({
      getAuthClient: () => authClient,
      redirectToLogin,
    });

    await expect(client.get("/api/example", { adapter })).rejects.toBeInstanceOf(
      AxiosError
    );

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it("clears the session without retrying when refresh fails", async () => {
    const { authClient, refreshSession, signOut } = createAuthClientStub();
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error("refresh failed"),
    });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config);
    });
    const redirectToLogin = vi.fn();
    const client = createApiClient({
      getAuthClient: () => authClient,
      redirectToLogin,
    });

    await expect(client.get("/api/example", { adapter })).rejects.toBeInstanceOf(
      AxiosError
    );

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });
});
