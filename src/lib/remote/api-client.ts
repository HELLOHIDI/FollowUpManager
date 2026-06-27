"use client";

import axios, {
  AxiosHeaders,
  isAxiosError,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
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

type AuthRetryConfig = InternalAxiosRequestConfig & {
  hasRetriedAuthentication?: boolean;
};

type CreateApiClientOptions = {
  getAuthClient?: () => BrowserAuthClient;
  redirectToLogin?: () => void;
};

const setAuthorization = (
  config: InternalAxiosRequestConfig,
  accessToken: string
) => {
  const headers = AxiosHeaders.from(config.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  config.headers = headers;
};

const redirectBrowserToLogin = () => {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(buildLoginRedirectPath(currentPath));
};

const isUnauthorizedResponse = (error: unknown): error is AxiosError =>
  isAxiosError(error) && error.response?.status === 401;

export const createApiClient = ({
  getAuthClient = getSupabaseBrowserClient,
  redirectToLogin = redirectBrowserToLogin,
}: CreateApiClientOptions = {}): AxiosInstance => {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const clearSession = async () => {
    try {
      await getAuthClient().auth.signOut();
    } finally {
      redirectToLogin();
    }
  };

  client.interceptors.request.use(async (config) => {
    const { data } = await getAuthClient().auth.getSession();

    if (data.session?.access_token) {
      setAuthorization(config, data.session.access_token);
    }

    return config;
  });

  client.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isUnauthorizedResponse(error) || !error.config) {
      return Promise.reject(error);
    }

    const config = error.config as AuthRetryConfig;

    if (config.hasRetriedAuthentication) {
      await clearSession();
      return Promise.reject(error);
    }

    config.hasRetriedAuthentication = true;
    const authClient = getAuthClient();
    const refreshResult = await authClient.auth.refreshSession();
    const refreshedToken = refreshResult.data.session?.access_token;

    if (refreshResult.error || !refreshedToken) {
      await clearSession();
      return Promise.reject(error);
    }

    setAuthorization(config, refreshedToken);
    return client.request(config);
  });

  return client;
};

export const extractApiErrorMessage = (
  error: unknown,
  fallbackMessage = "API request failed."
) => {
  if (isAxiosError(error)) {
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
  if (!isAxiosError(error)) {
    return null;
  }

  const payload = error.response?.data as ErrorPayload | undefined;
  return typeof payload?.error?.code === "string"
    ? payload.error.code
    : null;
};

export const apiClient = createApiClient();

export { isAxiosError };
