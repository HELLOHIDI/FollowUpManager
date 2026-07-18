import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { deleteProjectSchedule, listProjectSchedules, updateProjectSchedule } from "./service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SCHEDULE_ID = "22222222-2222-4222-8222-222222222222";

const deletedProjectClient = () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const is = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    if (table === "projects") return { select };
    throw new Error("Schedules must not be queried for deleted projects.");
  });
  return { client: { from } as unknown as SupabaseClient<Database>, from };
};

describe("project schedule service", () => {
  it("rejects list, update, and delete for a deleted project before touching schedules", async () => {
    const input = { memo: null, scheduledOn: "2026-07-20", title: "Report" };
    for (const operation of [
      (client: SupabaseClient<Database>) => listProjectSchedules(client, PROJECT_ID, "upcoming"),
      (client: SupabaseClient<Database>) => updateProjectSchedule(client, PROJECT_ID, SCHEDULE_ID, input),
      (client: SupabaseClient<Database>) => deleteProjectSchedule(client, PROJECT_ID, SCHEDULE_ID),
    ]) {
      const { client, from } = deletedProjectClient();
      await expect(operation(client)).resolves.toMatchObject({ ok: false, status: 404 });
      expect(from).toHaveBeenCalledWith("projects");
      expect(from).not.toHaveBeenCalledWith("project_schedules");
    }
  });
});
