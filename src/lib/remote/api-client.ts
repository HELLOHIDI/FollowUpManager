"use client";

import { buildLoginRedirectPath } from "@/constants/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

type BrowserAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null };
    }>;
    refreshSession: () => Promise<{
      data: { session: { access_token: string } | null };
      error: unknown;
    }>;
    signOut: () => Promise<unknown>;
  };
};

type RequestConfig = {
  body?: BodyInit | Record<string, unknown> | unknown[];
  headers?: HeadersInit;
  hasRetriedAuthentication?: boolean;
};

type ApiResponse<TData = unknown> = {
  data: TData;
  headers: Headers;
  status: number;
  statusText: string;
};

type ApiClient = {
  get: <TData = unknown>(
    path: string,
    config?: RequestConfig
  ) => Promise<ApiResponse<TData>>;
  post: <TData = unknown>(
    path: string,
    body?: RequestConfig["body"],
    config?: RequestConfig
  ) => Promise<ApiResponse<TData>>;
  put: <TData = unknown>(
    path: string,
    body?: RequestConfig["body"],
    config?: RequestConfig
  ) => Promise<ApiResponse<TData>>;
  patch: <TData = unknown>(
    path: string,
    body?: RequestConfig["body"],
    config?: RequestConfig
  ) => Promise<ApiResponse<TData>>;
  delete: <TData = unknown>(
    path: string,
    config?: RequestConfig
  ) => Promise<ApiResponse<TData>>;
};

type Fetcher = typeof fetch;

type CreateApiClientOptions = {
  getAuthClient?: () => BrowserAuthClient;
  redirectToLogin?: () => void;
  fetcher?: Fetcher;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly response: ApiResponse
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const setAuthorization = (headers: Headers, accessToken: string) => {
  headers.set("Authorization", `Bearer ${accessToken}`);
};

const redirectBrowserToLogin = () => {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(buildLoginRedirectPath(currentPath));
};

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const isUnauthorizedResponse = (error: unknown): error is ApiError =>
  isApiError(error) && error.response.status === 401;

const parseResponseData = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? text : null;
};

const createRequestBody = (
  body: RequestConfig["body"]
): BodyInit | undefined => {
  if (body === undefined) {
    return undefined;
  }

  if (
    body instanceof FormData ||
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  ) {
    return body as BodyInit;
  }

  return JSON.stringify(body);
};

export const createApiClient = ({
  getAuthClient = getSupabaseBrowserClient,
  redirectToLogin = redirectBrowserToLogin,
  fetcher = fetch,
}: CreateApiClientOptions = {}): ApiClient => {
  const clearSession = async () => {
    try {
      await getAuthClient().auth.signOut();
    } finally {
      redirectToLogin();
    }
  };

  const request = async <TData>(
    method: string,
    path: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<TData>> => {
    const headers = new Headers(config.headers);
    const { data } = await getAuthClient().auth.getSession();

    if (data.session?.access_token) {
      setAuthorization(headers, data.session.access_token);
    }

    const body = createRequestBody(config.body);

    if (
      body !== undefined &&
      !(body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetcher(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${path}`,
      { body, headers, method }
    );
    const responseData = await parseResponseData(response);
    const apiResponse = {
      data: responseData as TData,
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    };

    if (response.ok) {
      return apiResponse;
    }

    const error = new ApiError(
      response.statusText || "API request failed.",
      apiResponse
    );

    if (!isUnauthorizedResponse(error)) {
      throw error;
    }

    if (config.hasRetriedAuthentication) {
      await clearSession();
      throw error;
    }

    const authClient = getAuthClient();
    const refreshResult = await authClient.auth.refreshSession();
    const refreshedToken = refreshResult.data.session?.access_token;

    if (refreshResult.error || !refreshedToken) {
      await clearSession();
      throw error;
    }

    return request<TData>(method, path, {
      ...config,
      hasRetriedAuthentication: true,
      headers,
    });
  };

  return {
    delete: (path, config) => request("DELETE", path, config),
    get: (path, config) => request("GET", path, config),
    patch: (path, body, config) => request("PATCH", path, { ...config, body }),
    post: (path, body, config) => request("POST", path, { ...config, body }),
    put: (path, body, config) => request("PUT", path, { ...config, body }),
  };
};

export const extractApiErrorMessage = (
  error: unknown,
  fallbackMessage = "API request failed."
) => {
  if (isApiError(error)) {
    const payload = error.response?.data as ErrorPayload | undefined;

    if (typeof payload?.error?.message === "string") {
      return payload.error.message;
    }

    if (typeof payload?.message === "string") {
      return payload.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

export const extractApiErrorCode = (error: unknown) => {
  if (!isApiError(error)) {
    return null;
  }

  const payload = error.response?.data as ErrorPayload | undefined;
  return typeof payload?.error?.code === "string"
    ? payload.error.code
    : null;
};

export const apiClient = createApiClient();
