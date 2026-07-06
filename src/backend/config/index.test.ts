import { afterEach, describe, expect, it, vi } from "vitest";

const OLD_ENV = process.env;

const loadConfig = async () => {
  vi.resetModules();
  return import("./index");
};

afterEach(() => {
  process.env = OLD_ENV;
});

describe("backend config", () => {
  it("uses the public Supabase URL for service clients when the private alias is absent", async () => {
    process.env = {
      ...OLD_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      SUPABASE_URL: undefined,
    };

    const { getAppConfig } = await loadConfig();

    expect(getAppConfig().supabase).toEqual({
      serviceRoleKey: "service-role-key",
      url: "http://localhost:54321",
    });
  });

  it("still requires the service role key for mutation clients", async () => {
    process.env = {
      ...OLD_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_URL: undefined,
    };

    const { getAppConfig } = await loadConfig();

    expect(() => getAppConfig()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});
