import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getProjectDashboard } from "./service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const expense = (id: string, amount: number) => ({
  amount,
  categoryKey: "material_cost",
  categoryName: "재료비",
  categorySortOrder: 1,
  id,
  stageKey: "execution_completed",
  title: `지출 ${id.slice(0, 1)}`,
});
const snapshot = (overrides: Record<string, unknown> = {}) => ({
  activeExpenseCount: 2,
  expenseRows: [expense("22222222-2222-4222-8222-222222222222", 30), expense("33333333-3333-4333-8333-333333333333", 20)],
  integrityCode: null,
  kpis: { burnRatio: 0.5, remainingAmount: 50, spentAmount: 50, totalBudget: 100 },
  project: { id: PROJECT_ID, name: "운영 사업" },
  ...overrides,
});

const clientFor = (data: unknown, error: unknown = null) => ({
  rpc: vi.fn().mockResolvedValue({ data, error }),
}) as unknown as SupabaseClient<Database>;

describe("getProjectDashboard", () => {
  it("uses one snapshot call and derives category count and sum", async () => {
    const client = clientFor(snapshot());
    const result = await getProjectDashboard(client, PROJECT_ID);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("get_project_dashboard_snapshot", { project_id: PROJECT_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.categories[0]).toMatchObject({ expenseCount: 2, totalAmount: 50 });
  });

  it("returns not found for a missing project", async () => {
    const result = await getProjectDashboard(clientFor(snapshot({ project: null, kpis: null, activeExpenseCount: 0, expenseRows: [] })), PROJECT_ID);
    expect(result).toMatchObject({ ok: false, status: 404, error: { code: "DASHBOARD_PROJECT_NOT_FOUND" } });
  });

  it.each([
    snapshot({ integrityCode: "INVALID_BUDGET_STATE" }),
    snapshot({ activeExpenseCount: 3 }),
    snapshot({ kpis: { burnRatio: 1.1, remainingAmount: -10, spentAmount: 110, totalBudget: 100 } }),
  ])("returns a sanitized integrity error for inconsistent snapshots", async (data) => {
    const result = await getProjectDashboard(clientFor(data), PROJECT_ID);
    expect(result).toMatchObject({ ok: false, status: 409, error: { code: "DASHBOARD_INTEGRITY_ERROR" } });
  });

  it("returns a sanitized fetch error", async () => {
    const result = await getProjectDashboard(clientFor(null, new Error("database secret")), PROJECT_ID);
    expect(result).toMatchObject({ ok: false, status: 500, error: { code: "DASHBOARD_FETCH_ERROR" } });
    expect(JSON.stringify(result)).not.toContain("database secret");
  });
});
