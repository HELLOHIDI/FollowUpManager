import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { getProjectExport } from "./service";

type ChainResult = {
  data?: unknown;
  error?: unknown;
};

type ChainCall = {
  method: "eq" | "gte" | "is" | "lte" | "order";
  args: unknown[];
};

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const buildChain = (result: ChainResult, calls: ChainCall[]) => {
  const chain: any = {
    select: () => chain,
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return chain;
    },
    gte: (...args: unknown[]) => {
      calls.push({ method: "gte", args });
      return chain;
    },
    is: (...args: unknown[]) => {
      calls.push({ method: "is", args });
      return chain;
    },
    lte: (...args: unknown[]) => {
      calls.push({ method: "lte", args });
      return chain;
    },
    order: (...args: unknown[]) => {
      calls.push({ method: "order", args });
      return chain;
    },
    maybeSingle: async () => result,
    then: (resolve: (value: ChainResult) => unknown, reject?: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
};

const clientFor = (results: Record<string, ChainResult>) => {
  const calls: Record<string, ChainCall[]> = {};
  const client = {
    from: (table: string) => {
      calls[table] = calls[table] ?? [];
      return buildChain(results[table] ?? { data: [] }, calls[table]);
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient<Database>;

  return { calls, client };
};

describe("project export service", () => {
  it("returns filtered export rows with category and stage labels", async () => {
    const { calls, client } = clientFor({
      projects: { data: { id: PROJECT_ID, project_name: "Export Project", deleted_at: null } },
      budget_category_policy_templates: {
        data: [{ category_key: "material_cost", category_name: "재료비" }],
      },
      expenses: {
        data: [
          {
            amount: 1200,
            category_key: "material_cost",
            created_at: "2026-06-24T00:00:00.000Z",
            expected_spend_date: "2026-06-30",
            execution_request_date: null,
            funding_source_key: "government_subsidy",
            id: "22222222-2222-4222-8222-222222222222",
            memo: "memo",
            stage_key: "budget_registration",
            title: "시제품 재료",
            vendor_name: "Vendor",
          },
        ],
      },
    });

    const result = await getProjectExport(client, PROJECT_ID, {
      category: "material_cost",
      from: "2026-06-01",
      stage: "budget_registration",
      to: "2026-06-30",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.project.name).toBe("Export Project");
    expect(result.data.filters).toMatchObject({ category: "material_cost", from: "2026-06-01", stage: "budget_registration" });
    expect(result.data.rows[0]).toMatchObject({
      amount: 1200,
      categoryName: "재료비",
      stageKey: "budget_registration",
      title: "시제품 재료",
    });
    expect(calls.expenses).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["project_id", PROJECT_ID] },
        { method: "eq", args: ["category_key", "material_cost"] },
        { method: "eq", args: ["stage_key", "budget_registration"] },
        { method: "gte", args: ["expected_spend_date", "2026-06-01"] },
        { method: "lte", args: ["expected_spend_date", "2026-06-30"] },
      ]),
    );
  });

  it("returns not found when the project is missing", async () => {
    const { client } = clientFor({
      projects: { data: null },
      budget_category_policy_templates: { data: [] },
      expenses: { data: [] },
    });

    const result = await getProjectExport(client, PROJECT_ID, {});

    expect(result.ok).toBe(false);
    if (!("error" in result)) return;
    expect(result.status).toBe(404);
    expect(result.error.code).toBe("PROJECT_EXPORT_NOT_FOUND");
  });
});
