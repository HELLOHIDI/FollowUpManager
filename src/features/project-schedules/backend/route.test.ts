import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createHonoApp } from "@/backend/hono/app";
import type { Database } from "@/lib/supabase/types";

const USER = {
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  user_metadata: {},
} as User;

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const authenticatedClient = (from = vi.fn()) => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }) },
  from,
}) as unknown as SupabaseClient<Database>;

describe("project schedule routes", () => {
  it("rejects an invalid project id before querying Supabase", async () => {
    const from = vi.fn();
    const app = createHonoApp({ createAuthenticatedClient: vi.fn(() => authenticatedClient(from)) });

    const response = await app.request("/api/projects/not-a-uuid/schedules", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an incomplete schedule payload before querying Supabase", async () => {
    const from = vi.fn();
    const app = createHonoApp({ createAuthenticatedClient: vi.fn(() => authenticatedClient(from)) });

    const response = await app.request(`/api/projects/${PROJECT_ID}/schedules`, {
      body: JSON.stringify({ title: "" }),
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
