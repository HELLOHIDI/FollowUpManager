import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const serviceClientMocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/backend/supabase/client", () => serviceClientMocks);

describe("GET /_health", () => {
  it("returns only a non-sensitive liveness payload", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
    expect(serviceClientMocks.createServiceClient).not.toHaveBeenCalled();
  });
});
