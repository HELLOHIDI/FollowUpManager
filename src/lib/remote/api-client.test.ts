import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, extractApiErrorCode, extractApiErrorMessage } from "./api-client";

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

const jsonResponse = (status: number, data: unknown, statusText = "OK") =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    status,
    statusText,
  });

describe("authenticated API client", () => {
  it("extracts a stable API error code", () => {
    const error = new ApiError(
      "Conflict",
      {
        data: { error: { code: "COMPANY_REGISTRATION_NUMBER_CONFLICT" } },
        headers: new Headers(),
        status: 409,
        statusText: "Conflict",
      }
    );

    expect(extractApiErrorCode(error)).toBe(
      "COMPANY_REGISTRATION_NUMBER_CONFLICT"
    );
  });

  it("uses the server error message for failed requests", async () => {
    const { authClient } = createAuthClientStub();
    const fetcher = vi.fn(async () =>
      jsonResponse(409, { error: { code: "POLICY_EXTRACTION_FAILED", message: "정책 PDF에서 텍스트를 추출하지 못했습니다." } }, "API Request failed")
    );
    const client = createApiClient({ fetcher, getAuthClient: () => authClient });

    await expect(client.post("/api/example")).rejects.toMatchObject({
      message: "정책 PDF에서 텍스트를 추출하지 못했습니다.",
    });

    try {
      await client.post("/api/example");
    } catch (error) {
      expect(extractApiErrorMessage(error)).toBe("정책 PDF에서 텍스트를 추출하지 못했습니다.");
    }
  });

  it("attaches the current access token", async () => {
    const { authClient } = createAuthClientStub();
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true })
    );
    const client = createApiClient({ fetcher, getAuthClient: () => authClient });

    await client.get("/api/example");

    const init = fetcher.mock.calls[0]?.[1];
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
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
    const fetcher = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { ok: true })
      )
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: "UNAUTHORIZED" } }, "Unauthorized")
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const redirectToLogin = vi.fn();
    const client = createApiClient({
      fetcher,
      getAuthClient: () => authClient,
      redirectToLogin,
    });

    const response = await client.get("/api/example");

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization")).toBe(
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
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(401, { error: { code: "UNAUTHORIZED" } }, "Unauthorized")
    );
    const redirectToLogin = vi.fn();
    const client = createApiClient({
      fetcher,
      getAuthClient: () => authClient,
      redirectToLogin,
    });

    await expect(client.get("/api/example")).rejects.toBeInstanceOf(ApiError);

    expect(fetcher).toHaveBeenCalledTimes(2);
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
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(401, { error: { code: "UNAUTHORIZED" } }, "Unauthorized")
    );
    const redirectToLogin = vi.fn();
    const client = createApiClient({
      fetcher,
      getAuthClient: () => authClient,
      redirectToLogin,
    });

    await expect(client.get("/api/example")).rejects.toBeInstanceOf(ApiError);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });
});
